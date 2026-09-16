'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Shield, UserCheck, X, AlertTriangle, MailCheck, Send } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useProfile, type Role } from '@/hooks/useProfile'
import { canManageClinica, isMedico } from '@/lib/permissions'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

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
    <div className="max-w-2xl mx-auto space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-3 w-32 bg-slate-200 rounded" />
              <div className="h-2.5 w-48 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Usuarios</h1>
          <p className="text-sm text-[#86868b] mt-0.5">Invita a tu equipo y administra los accesos</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} /> Invitar
        </button>
      </div>

      {/* Modal de invitación — macOS sheet */}
      {showForm && (
      <Portal>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--sp-surface-glass)] backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-[#1d1d1f]">Invitar a alguien</h2>
              <button onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>

            <form id="form-invitar" onSubmit={invitar} className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Rol</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:bg-white transition-all">
                  <option value="secretaria">Asistente Médico/a</option>
                  <option value="medico">Médico</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Correo electrónico</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@email.com" required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all" />
              </div>

              {/* Lo que el admin NO tiene que teclear, dicho donde antes estaban
                  los campos: es la pregunta que se va a hacer al ver un
                  formulario de dos líneas. */}
              <p className="text-[11px] text-[#86868b] leading-relaxed">
                {form.role === 'medico'
                  ? 'Su nombre, su especialidad y sus cédulas los captura él mismo al entrar: son los datos que salen impresos en sus recetas.'
                  : 'Escribirá su nombre al entrar por primera vez.'}
              </p>

              {/* ⚠️ EL AVISO DE LA HORA VA ANTES DE ENVIAR, NO DESPUÉS. La
                  caducidad la fija `otp_expiry` de GoTrue, el mismo dial que la
                  recuperación de contraseña, y no se toca por esto. Lo que sí
                  podemos es no prometer lo que el sistema no cumple: si el admin
                  sabe que es una hora, avisa a la persona o reenvía sin
                  sorprenderse. */}
              <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  El enlace caduca <strong>en 1 hora</strong>. Si se le pasa, podrás reenviarle la invitación desde la lista.
                </p>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            </form>

            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-[#3d3d3f] hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" form="form-invitar" disabled={guardando}
                className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                {guardando ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}

      {/* Indicadores de licencia. Las invitaciones pendientes CUENTAN: ocupan
          plaza en cuanto se envían, igual que en el tope del servidor. */}
      {licencia && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">Médicos</p>
              <p className="text-xl font-bold text-[#1d1d1f] mt-1.5 tabular-nums">
                {usuarios.filter(u => u.role === 'medico').length}
                <span className="text-sm font-normal text-[#86868b]"> / {licencia.max_medicos ?? '∞'}</span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">Asistentes</p>
              <p className="text-xl font-bold text-[#1d1d1f] mt-1.5 tabular-nums">
                {usuarios.filter(u => u.role === 'secretaria').length}
                <span className="text-sm font-normal text-[#86868b]"> / {licencia.max_secretarias ?? '∞'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación — el texto cambia según lo que se esté deshaciendo:
          cancelar una invitación que nadie usó no es lo mismo que dar de baja a
          quien lleva meses escribiendo en expedientes. */}
      {confirmDelete && (
      <Portal>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--sp-surface-glass)] backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: bajaBloqueada ? '#FFF7ED' : '#FEF2F2' }}>
                <AlertTriangle size={22} style={{ color: bajaBloqueada ? '#F59E0B' : '#EF5350' }} />
              </div>

              {bajaBloqueada ? (
                /* ⚠️ EL `mailto` ES UNA PARADA PROVISIONAL, NO EL DISEÑO. Con las
                   palabras de Angel, que quedan aquí para que nadie las lea al
                   revés: «Dar de baja a un médico invitado es una facultad del
                   administrador de su clínica, y debe seguir siéndolo. Mandarlo
                   a soporte es una parada provisional mientras se construye el
                   flujo de baja con volcado; no es el diseño, es lo único
                   honesto que se puede decir hoy.»
                   Cuando exista ese flujo —el médico que se va recibe una COPIA
                   de lo que firmó y los expedientes se quedan en la clínica—,
                   esta pantalla deja de mandar a soporte y lo ofrece. Ver
                   BAJA-01 en `DEUDA_TECNICA.md`. */
                <>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">No se puede dar de baja</h3>
                  <p className="text-sm text-[#86868b] mt-1">
                    No se puede dar de baja a un médico que ya tiene pacientes en la clínica.
                    Escríbenos a{' '}
                    <a href="mailto:soporte@spinus.com.mx" className="font-semibold text-[#1e5fa8] hover:underline">
                      soporte@spinus.com.mx
                    </a>{' '}
                    y lo resolvemos contigo.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">
                    {confirmDelete.estado === 'pendiente' ? 'Cancelar invitación' : 'Dar de baja'}
                  </h3>
                  <p className="text-sm text-[#86868b] mt-1">
                    {confirmDelete.estado === 'pendiente' ? (
                      <>La invitación de <span className="font-semibold text-[#3d3d3f]">{confirmDelete.email}</span> dejará de funcionar y su plaza quedará libre.</>
                    ) : (
                      <>¿Dar de baja a <span className="font-semibold text-[#3d3d3f]">{confirmDelete.nombre || confirmDelete.email}</span>? Perderá el acceso y su plaza quedará libre. Lo que haya registrado se queda en la clínica.</>
                    )}
                  </p>
                </>
              )}
            </div>

            {bajaBloqueada ? (
              <div className="border-t border-slate-100">
                <button onClick={cerrarConfirmacion}
                  className="w-full px-4 py-3.5 text-sm font-semibold text-[#1e5fa8] hover:bg-slate-50 transition-colors">
                  Entendido
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 grid grid-cols-2">
                <button onClick={cerrarConfirmacion}
                  className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors border-r border-slate-100">
                  Volver
                </button>
                <button onClick={confirmarEliminar}
                  className="px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-red-50"
                  style={{ color: '#EF5350' }}>
                  {confirmDelete.estado === 'pendiente' ? 'Cancelar invitación' : 'Dar de baja'}
                </button>
              </div>
            )}
          </div>
        </div>
      </Portal>
      )}

      {/* Lista de usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Tu equipo</p>
        </div>
        <div className="divide-y divide-slate-100">
          {usuarios.map(u => {
            const esMedico = isMedico({ role: u.role })
            const pendiente = u.estado === 'pendiente'
            return (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${pendiente ? 'bg-amber-50' : esMedico ? 'bg-blue-50' : 'bg-violet-50'}`}>
                    {pendiente
                      ? <MailCheck size={15} className="text-amber-600" />
                      : esMedico
                        ? <Shield size={15} className="text-[#1e5fa8]" />
                        : <UserCheck size={15} className="text-violet-600" />}
                  </div>
                  <div className="min-w-0">
                    {/* Mientras está pendiente, el correo manda: puede que no haya
                        nombre (el del médico es opcional) y es lo único que
                        identifica a quien todavía no ha entrado. */}
                    <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                      {pendiente ? u.email : (u.nombre || 'Sin nombre')}
                    </p>
                    <p className="text-[11px] text-[#86868b] truncate">
                      {pendiente ? (u.nombre || 'Sin nombre todavía') : u.email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-[#86868b] capitalize">{esMedico ? 'médico' : 'asistente'}</p>
                      {pendiente && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                          Invitación enviada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {pendiente && (
                    <button onClick={() => reenviar(u)} disabled={reenviando === u.id} title="Reenviar invitación"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#1e5fa8] hover:bg-blue-50 disabled:opacity-50 transition-colors">
                      {reenviando === u.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Send size={12} />}
                      Reenviar
                    </button>
                  )}
                  <button onClick={() => { setBajaBloqueada(false); setConfirmDelete(u) }}
                    title={pendiente ? 'Cancelar invitación' : 'Eliminar usuario'}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                    style={{ color: '#EF5350' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
