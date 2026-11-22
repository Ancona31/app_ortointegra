'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, MailCheck, Send, MoreHorizontal, Users } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import CapaMenu from '@/components/ui/CapaMenu'
import Avatar, { inicialesDe } from '@/components/ui/Avatar'
import EstadoVacio from '@/components/ui/EstadoVacio'
import EstadoError from '@/components/ui/EstadoError'
import { useProfile, type Role } from '@/hooks/useProfile'
import { canManageClinica, isMedico } from '@/lib/permissions'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import PestanasAdministracion from '@/components/admin/PestanasAdministracion'

/* ⚠️ AQUÍ YA NO SE ESCRIBE NINGUNA CONTRASEÑA (Bloque B5-bis). Hasta ahora este
   formulario pedía una, y el administrador se la dictaba a su médico o a su
   secretaria: quedaba conociendo la clave de alguien que firma en un expediente
   clínico. Ahora se manda una invitación y la contraseña la elige quien la
   recibe, en `/invitacion`.
   Tampoco se piden ya especialidad, cédulas NI NOMBRE: los exige el gate a cada
   uno en su propio onboarding, y son los datos que se imprimen en sus recetas —
   no los teclea quien no es su dueño. El de la asistente es el que más cuidado
   pide: al quitar este campo, su paso `nombre` del onboarding
   (`lib/perfil/gate.ts`) pasó a ser el ÚNICO sitio donde puede escribirse, así
   que devolver el campo aquí sin quitar aquél deja dos capturas del mismo dato,
   y quitar aquél sin devolver éste la deja «Sin nombre» para siempre.
   Si vuelves a tocar cualquiera de los dos bloques, lee antes
   `src/lib/perfil/schemas.ts`, donde está el porqué. */

type EstadoUsuario = 'pendiente' | 'activa'

type Usuario = {
  id: string
  role: Role
  nombre: string | null
  email: string
  /** Lo calcula el servidor desde `auth.users`; no hay columna nuestra. */
  estado: EstadoUsuario
}

type LicenciaInfo = {
  max_medicos: number | null
  max_secretarias: number | null
}

const FORM_VACIO = { email: '', role: 'secretaria' }

export default function AdminUsuariosPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const toast = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [licencia, setLicencia] = useState<LicenciaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Usuario | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [reenviando, setReenviando] = useState<string | null>(null)
  /* La baja bloqueada por la base. Es un estado del diálogo y no un toast a
     propósito: el mensaje lleva un correo que la persona tiene que escribir, y
     un aviso que se desvanece en ocho segundos no sirve para eso. */
  const [bajaBloqueada, setBajaBloqueada] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loadingProfile && profile && !canManageClinica(profile)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    try {
      const res = await fetch('/api/admin/usuarios')
      const data = await res.json()
      setUsuarios(data.usuarios || [])
      setLicencia(data.licencia ?? null)
    } catch {
      setError('Error al cargar usuarios. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    try {
      const res = await fetch('/api/admin/invitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { ok?: boolean; correo_enviado?: boolean; error?: string }

      if (!res.ok) { setError(data.error || 'No se pudo enviar la invitación'); return }

      /* Dos desenlaces distintos y el admin tiene que poder distinguirlos: la
         cuenta se crea igual aunque el correo no salga (decisión de la ruta), y
         entonces lo que toca es reenviar desde la lista. */
      if (data.correo_enviado === false) {
        toast.warning(`La invitación de ${form.email} quedó creada, pero el correo no salió. Reenvíala desde la lista.`)
      } else {
        toast.success(`Invitación enviada a ${form.email}`)
      }
      setForm(FORM_VACIO)
      setShowForm(false)
      cargarUsuarios()
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function reenviar(usuario: Usuario) {
    setReenviando(usuario.id)
    try {
      const res = await fetch('/api/admin/invitar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuario.id }),
      })
      const data = await res.json() as { ok?: boolean; correo_enviado?: boolean; error?: string }

      /* `ya_activa` no es un error que se reintente: significa que esa cuenta ya
         no admite invitación —aceptó, o su correo se confirmó por otra vía—, y
         la única salida es cancelarla y volver a invitar. El mensaje lo dice en
         vez de dejar al admin pulsando un botón que nunca va a funcionar. */
      if (res.status === 409 && data.error === 'ya_activa') {
        toast.error('Esa cuenta ya no admite invitación. Cancélala y vuelve a invitar.')
        cargarUsuarios()
        return
      }
      if (!res.ok) { toast.error(data.error || 'No se pudo reenviar la invitación'); return }
      if (data.correo_enviado === false) {
        toast.warning('El correo no salió. Vuelve a intentarlo: el enlace anterior ya no sirve.')
        return
      }
      toast.success(`Invitación reenviada a ${usuario.email}`)
    } catch {
      toast.error('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setReenviando(null)
    }
  }

  async function confirmarEliminar() {
    if (!confirmDelete) return
    const eraPendiente = confirmDelete.estado === 'pendiente'
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: confirmDelete.id }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }

      /* La base bloquea la baja de quien tiene historia clínica: seis tablas
         apuntan a `profiles` con ON DELETE RESTRICT. Hasta ahora la ruta
         respondía `ok` igual y esta pantalla cantaba «Usuario eliminado» con la
         persona todavía en la lista. */
      if (res.status === 409 && data.error === 'tiene_historia_clinica') {
        setBajaBloqueada(true)
        return
      }
      if (!res.ok) { toast.error(data.error || 'No se pudo dar de baja'); return }

      toast.success(eraPendiente
        ? `Invitación de ${confirmDelete.email} cancelada`
        : `${confirmDelete.nombre || confirmDelete.email} ya no tiene acceso`)
      setConfirmDelete(null)
      cargarUsuarios()
    } catch {
      toast.error('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    }
  }

  function cerrarConfirmacion() {
    setConfirmDelete(null)
    setBajaBloqueada(false)
  }

  if (loadingProfile || loading) return (
    <div className="mx-auto max-w-[760px]" aria-busy="true">
      <div className="k-tarjeta flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <div className="skeleton h-3 w-32 rounded" />
              <div className="skeleton h-2.5 w-48 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  /* La carga falló (la licencia sólo queda en null por el `catch`): se dice,
     en vez de pintar un equipo vacío que no lo está. */
  const cargaFallida = Boolean(error) && usuarios.length === 0 && licencia === null

  return (
    /* Rediseño B10 (maqueta `admin`, vista 1): título con «Invitar» como único
       primario, los contadores como números sueltos y «Tu equipo» en una
       tarjeta de filas con avatar, etiquetas de rol y estado, «Reenviar»
       tonal a la vista y lo destructivo dentro de «···». */
    <div className="mx-auto max-w-[760px]">
      {/* B4: Estadísticas · Usuarios · Facturación (CALMA §30.2). */}
      <PestanasAdministracion />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="k-t-rotulo">Admin</p>
          <h1 className="k-t-pantalla mt-0.5">Usuarios</h1>
          <p className="k-t-sec mt-0.5">Invita a tu equipo y administra los accesos</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setError('') }}
          className="k-b k-b-prim max-sm:order-last"
        >
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" /> Invitar
        </button>

        {/* Indicadores de licencia. Las invitaciones pendientes CUENTAN: ocupan
            plaza en cuanto se envían, igual que en el tope del servidor. */}
        {licencia && (
          <div className="flex basis-full gap-8">
            <Contador rotulo="Médicos" usados={usuarios.filter(u => u.role === 'medico').length} tope={licencia.max_medicos} />
            <Contador rotulo="Asistentes" usados={usuarios.filter(u => u.role === 'secretaria').length} tope={licencia.max_secretarias} />
          </div>
        )}
      </div>

      {/* Lista de usuarios */}
      <section aria-labelledby="usuarios-equipo" className="k-tarjeta mt-5 pb-1 esc:px-5">
        <h2 id="usuarios-equipo" className="k-t-tarjeta pb-3">Tu equipo</h2>
        {cargaFallida ? (
          <EstadoError variante="tarjeta" mensaje={error} />
        ) : usuarios.length === 0 ? (
          <EstadoVacio variante="seccion" icono={Users} titulo="Todavía no hay nadie en tu equipo" />
        ) : (
          <ul className="k-lista border-t border-linea">
            {usuarios.map((u, i) => (
              <FilaEquipo
                key={u.id}
                usuario={u}
                indice={i}
                reenviando={reenviando === u.id}
                onReenviar={() => reenviar(u)}
                onBaja={() => { setBajaBloqueada(false); setConfirmDelete(u) }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Invitar — capa del catálogo (hoja en teléfono, tarjeta en ancho). */}
      <ModalShell
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Invitar a alguien"
        maxWidth="max-w-[440px]"
        footer={
          <div className="flex items-center justify-end gap-2 px-6 py-3 max-sm:grid max-sm:grid-cols-2 ext:px-5">
            <button type="button" onClick={() => setShowForm(false)} className="k-b k-b-quieto min-w-[104px]">
              Cancelar
            </button>
            <button type="submit" form="form-invitar" disabled={guardando} className="k-b k-b-prim min-w-[104px]">
              {guardando ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Enviando...</> : 'Enviar invitación'}
            </button>
          </div>
        }
      >
        <FormInvitar form={form} setForm={setForm} error={error} onSubmit={invitar} />
      </ModalShell>

      {/* Confirmación — el texto cambia según lo que se esté deshaciendo:
          cancelar una invitación que nadie usó no es lo mismo que dar de baja a
          quien lleva meses escribiendo en expedientes. */}
      <ModalShell
        open={confirmDelete !== null}
        onClose={cerrarConfirmacion}
        title={bajaBloqueada ? 'No se puede dar de baja' : confirmDelete?.estado === 'pendiente' ? 'Cancelar invitación' : 'Dar de baja'}
        icon={<AlertTriangle aria-hidden="true" />}
        variante="alerta"
        tono={bajaBloqueada ? 'avisar' : 'destruir'}
        apilada={!bajaBloqueada && confirmDelete?.estado === 'pendiente'}
        footer={bajaBloqueada ? (
          <button type="button" autoFocus onClick={cerrarConfirmacion} className="k-b k-b-capa k-b-quieto">
            Entendido
          </button>
        ) : (
          <>
            <button type="button" autoFocus onClick={cerrarConfirmacion} className="k-b k-b-capa k-b-quieto">
              Volver
            </button>
            <button type="button" data-principal onClick={confirmarEliminar} className="k-b k-b-capa k-b-mal">
              {confirmDelete?.estado === 'pendiente' ? 'Cancelar invitación' : 'Dar de baja'}
            </button>
          </>
        )}
      >
        {confirmDelete && <TextoConfirmacion usuario={confirmDelete} bloqueada={bajaBloqueada} />}
      </ModalShell>
    </div>
  )
}

function Contador({ rotulo, usados, tope }: { rotulo: string; usados: number; tope: number | null }) {
  return (
    <div>
      <p className="k-t-rotulo">{rotulo}</p>
      <p className="k-num mt-0.5 text-[22px] font-bold leading-7 text-tinta">
        {usados}
        <span className="text-[15px] font-normal text-tinta2"> / {tope ?? '∞'}</span>
      </p>
    </div>
  )
}

/** Una persona del equipo. «Reenviar» a la vista en las pendientes; la baja, dentro de «···». */
function FilaEquipo({ usuario: u, indice, reenviando, onReenviar, onBaja }: {
  usuario: Usuario
  indice: number
  reenviando: boolean
  onReenviar: () => void
  onBaja: () => void
}) {
  const [menu, setMenu] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const esMedico = isMedico({ role: u.role })
  const pendiente = u.estado === 'pendiente'
  /* Mientras está pendiente, el correo manda: puede que no haya nombre y es lo
     único que identifica a quien todavía no ha entrado. */
  const titulo = pendiente ? u.email : (u.nombre || 'Sin nombre')
  /* Iniciales de las dos primeras palabras que no son un título («Dra.»). */
  const [nom, ape] = (u.nombre ?? '').split(' ').filter(p => p && !p.endsWith('.'))
  return (
    <li className="flex items-center gap-3 py-3">
      {pendiente
        ? <span aria-hidden="true" className="k-avatar bg-aviso-fondo text-aviso-tinta"><MailCheck size={16} /></span>
        : <Avatar texto={inicialesDe(nom ?? '', ape ?? '')} indice={indice} />}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-[180px]">
          <p className="k-t-fila truncate">{titulo}</p>
          <p className="k-t-sec truncate">{pendiente ? (u.nombre || 'Sin nombre todavía') : u.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`k-etq ${esMedico ? 'k-etq-tonal' : 'bg-sup2 text-tinta2'}`}>{esMedico ? 'Médico' : 'Asistente'}</span>
          {pendiente && <span className="k-etq k-etq-aviso">Invitación enviada</span>}
          {pendiente && (
            <button type="button" onClick={onReenviar} disabled={reenviando} title="Reenviar invitación" className="k-b k-b-tonal ml-1 h-8 px-3">
              {reenviando ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <Send size={15} aria-hidden="true" />}
              Reenviar
            </button>
          )}
        </div>
      </div>
      <button
        ref={ancla}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-label={`Acciones de ${titulo}`}
        onClick={() => setMenu(m => !m)}
        className="k-b k-b-icono shrink-0"
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      <CapaMenu
        abierto={menu}
        alCerrar={() => setMenu(false)}
        ancla={ancla}
        titulo={titulo}
        opciones={[{
          id: 'baja',
          texto: pendiente ? 'Cancelar invitación' : 'Dar de baja',
          icono: <Trash2 aria-hidden="true" />,
          peligro: true,
          alElegir: onBaja,
        }]}
      />
    </li>
  )
}

/** El cuerpo de la alerta de baja: el de bloqueo por historia clínica, o el de cancelar / dar de baja. */
function TextoConfirmacion({ usuario, bloqueada }: { usuario: Usuario; bloqueada: boolean }) {
  if (bloqueada) {
    /* ⚠️ EL `mailto` ES UNA PARADA PROVISIONAL, NO EL DISEÑO. Con las palabras
       de Angel: «Dar de baja a un médico invitado es una facultad del
       administrador de su clínica, y debe seguir siéndolo. Mandarlo a soporte
       es una parada provisional mientras se construye el flujo de baja con
       volcado; no es el diseño, es lo único honesto que se puede decir hoy.»
       Ver BAJA-01 en `DEUDA_TECNICA.md`. */
    return (
      <p>
        No se puede dar de baja a un médico que ya tiene pacientes en la clínica.
        Escríbenos a{' '}
        <a href="mailto:soporte@spinus.com.mx" className="font-semibold text-enlace hover:underline">
          soporte@spinus.com.mx
        </a>{' '}
        y lo resolvemos contigo.
      </p>
    )
  }
  return usuario.estado === 'pendiente' ? (
    <p>La invitación de <b>{usuario.email}</b> dejará de funcionar y su plaza quedará libre.</p>
  ) : (
    <p>¿Dar de baja a <b>{usuario.nombre || usuario.email}</b>? Perderá el acceso y su plaza quedará libre. Lo que haya registrado se queda en la clínica.</p>
  )
}

/** El formulario de invitación (el `<form>` lo envía el botón del pie por `form="form-invitar"`). */
function FormInvitar({ form, setForm, error, onSubmit }: {
  form: typeof FORM_VACIO
  setForm: (f: typeof FORM_VACIO) => void
  error: string
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form id="form-invitar" onSubmit={onSubmit} className="flex flex-col gap-4 px-6 pt-2 pb-5 ext:px-5">
      <div className="k-campo-g">
        <label htmlFor="invitar-rol" className="k-etiqueta">Rol</label>
        <select id="invitar-rol" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="k-campo">
          <option value="secretaria">Asistente Médico/a</option>
          <option value="medico">Médico</option>
        </select>
      </div>

      <div className="k-campo-g">
        <label htmlFor="invitar-correo" className="k-etiqueta">Correo electrónico</label>
        <input id="invitar-correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="correo@email.com" required className="k-campo" />
      </div>

      {/* Lo que el admin NO tiene que teclear, dicho donde antes estaban los
          campos: es la pregunta que se va a hacer al ver un formulario de dos
          líneas. */}
      <p className="k-campo-ayuda">
        {form.role === 'medico'
          ? 'Su nombre, su especialidad y sus cédulas los captura él mismo al entrar: son los datos que salen impresos en sus recetas.'
          : 'Escribirá su nombre al entrar por primera vez.'}
      </p>

      {/* ⚠️ EL AVISO DE LA HORA VA ANTES DE ENVIAR, NO DESPUÉS. La caducidad la
          fija `otp_expiry` de GoTrue; lo que sí podemos es no prometer lo que
          el sistema no cumple. */}
      <div className="flex gap-2 rounded-[12px] bg-aviso-fondo px-3 py-2.5">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-aviso-tinta" />
        <p className="text-[13px] leading-[18px] text-aviso-tinta">
          El enlace caduca <strong>en 1 hora</strong>. Si se le pasa, podrás reenviarle la invitación desde la lista.
        </p>
      </div>

      {error && <p role="alert" className="rounded-[12px] bg-mal-fondo px-3 py-2 text-[13px] leading-[18px] text-mal-tinta">{error}</p>}
    </form>
  )
}
