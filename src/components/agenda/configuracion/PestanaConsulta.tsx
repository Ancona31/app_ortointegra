'use client'

/**
 * Pestaña «Tu consulta» (tanda J, J5, punto 14; maqueta
 * `Configuracion.dc.html`): la duración del médico en una rejilla de 15 a 60
 * minutos —se guarda al pulsar— y «Otros tipos de cita», con «Quitar» y
 * «Agregar tipo de cita». Con las rutas de siempre (`/api/agenda/tipos-cita`:
 * Zod, roles y RLS en el servidor).
 *
 * Lo que la maqueta no tiene y se conserva (inventario de J5, filas 9, 14, 16,
 * 17 y 18):
 *   · «Otra duración», para una que no está en la rejilla (la que ya tenga,
 *     también: sale escrita y la rejilla sin nada elegido);
 *   · la duración distinta en cada consultorio (`DuracionEnConsultorio`, punto 17);
 *   · «Editar» junto a «Quitar», el color y para quién es cada tipo, y los
 *     quitados con «Reactivar».
 * Quien no puede cambiar un tipo lo ve sin botones (lo decide el servidor).
 *
 * B13 · AG9 (rediseño, maqueta `ag-config`): la duración va primero, sin rótulo, en una superficie con sus cinco
 * opciones; luego los grupos «En cada consultorio» y «Otros tipos de cita» con su rótulo, filas de lista y
 * acciones de texto. Cada tipo enseña su COLOR (CALMA §29.10): un punto de 12 con su tono de evento
 * (`--cal-ev-*`, con su oscuro) y nombre accesible «Color: Índigo»; sin color, un aro vacío «Sin color».
 */
import { useId, useState, type ReactNode } from 'react'
import { ChevronRight, List, MapPin, Plus } from 'lucide-react'
import DuracionEnConsultorio from '@/components/agenda/configuracion/DuracionEnConsultorio'
import FormTipoCita, { type DatosTipoCita } from '@/components/agenda/configuracion/FormTipoCita'
import { crearTipo, editarTipo, guardarDuracion } from '@/components/agenda/configuracion/accionesConfig'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import {
  AVISO_EN_LISTA, AVISO_SOLO_ADMIN, AYUDA, BLOQUE, BOTON_TEXTO, BOTON_TEXTO_ROJO, CAMPO_NUEVO, ERROR, FILA, FILA_ACCION, FILA_GRIS, LISTA, opcion, PANEL, PIE, ROTULO,
  SOLO_ADMIN, SOLO_ADMIN_TIPOS, SUB_PANEL, TITULO_PANEL,
} from '@/components/agenda/configuracion/estilosConfig'
import { DURACIONES } from '@/components/agenda/configuracion/PasoDuracion'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { COLOR_ETIQUETA } from '@/lib/agenda/tarjetasAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'

interface Props {
  tipos: readonly TipoCita[] | null
  usuarioId: string
  esMedico: boolean
  puedeAdministrar: boolean
  medicos: readonly MedicoConfig[]
  /** Los consultorios activos del médico (su duración en cada uno). */
  misConsultorios: readonly Consultorio[]
  avisar: Avisar
  /** Releer los tipos del servidor. */
  alCambiar: () => void
}

const VACIO: DatosTipoCita = { nombre: '', duracion: '45', color: '', medicoId: '' }

function MiDuracion({ p, mia }: { p: Props; mia: TipoCita | null }) {
  const id = useId()
  /* Lo último guardado aquí, con su id: la primera duración se crea UNA vez aunque la lista aún no la traiga. */
  const [local, setLocal] = useState<{ id: string; minutos: number } | null>(null)
  const [otra, setOtra] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const actual = local?.minutos ?? mia?.duracion_min ?? null
  const editarId = mia?.id ?? local?.id
  async function elegir(minutos: number): Promise<void> {
    if (minutos === actual && editarId) return
    setOcupado(true)
    const r = await guardarDuracion({ medicoId: p.usuarioId, editarId, minutos })
    setOcupado(false)
    p.avisar(r.ok ? { ok: true } : r)
    if (!r.ok) return
    const nuevo = r.valor ?? editarId
    setLocal(nuevo ? { id: nuevo, minutos } : null)
    setOtra(false)
    p.alCambiar()
  }
  return (
    <>
      <p className={SUB_PANEL}>
        {actual ? <>Tu consulta dura <strong className="font-semibold text-tinta">{actual} minutos</strong>. </> : 'Aún no elegiste cuánto dura tu consulta. '}
        Con esto sabemos cuántas citas caben en tu día.
      </p>
      <div className={LISTA}>
        <div className={`${FILA} grid grid-cols-5 gap-[6px]`}>
          {DURACIONES.map(d => (
            <button key={d} type="button" aria-pressed={actual === d} disabled={ocupado} onClick={() => void elegir(d)} className={opcion(actual === d)}>{d} min</button>
          ))}
        </div>
        {otra ? (
          <div className={`${FILA} flex-wrap justify-start gap-[8px]`}>
            <label htmlFor={`${id}-o`} className="flex items-center gap-[8px] text-[15px] leading-[20px] text-tinta esc:text-[14px]">Mi consulta dura
              <input id={`${id}-o`} type="number" inputMode="numeric" min={5} max={600} step={5} className={`${CAMPO_NUEVO} agc-num w-[76px]`}
                value={texto} onChange={e => setTexto(e.target.value)} />
              minutos</label>
            <button type="button" className={BOTON_TEXTO} disabled={ocupado || !(Number(texto) >= 5)} onClick={() => void elegir(Number(texto))}>Guardar</button>
            <button type="button" className={BOTON_TEXTO} onClick={() => setOtra(false)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" className={FILA_ACCION} onClick={() => { setTexto(String(actual ?? '')); setOtra(true) }}>Otra duración</button>
        )}
      </div>
    </>
  )
}

/** El rótulo de un grupo, con su icono, fuera de la superficie. */
function Rotulo({ icono: Icono, titulo }: { icono: typeof List; titulo: string }) {
  return <h3 className={ROTULO}><Icono size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />{titulo}</h3>
}

function EnCadaConsultorio({ p }: { p: Props }) {
  if (p.misConsultorios.length === 0) return null
  return (
    <section className={BLOQUE} aria-label="En cada consultorio">
      <Rotulo icono={MapPin} titulo="En cada consultorio" />
      <div className={LISTA}>
        {p.misConsultorios.map(c => (
          <div key={c.id} role="group" aria-label={c.nombre} className={`${FILA} flex-wrap`}>
            <span className="text-[15px] font-semibold leading-[20px] text-tinta">{c.nombre}</span>
            <DuracionEnConsultorio consultorioId={c.id} consultorioNombre={c.nombre} medicoId={p.usuarioId} tipos={p.tipos} alCambiar={p.alCambiar} />
          </div>
        ))}
      </div>
      <p className={PIE}>Si en algún consultorio tu consulta dura distinto, cámbiala solo ahí.</p>
    </section>
  )
}

function ambito(t: TipoCita, p: Props): string | null {
  if (t.medico_id === p.usuarioId) return null
  const m = t.medico_id ? p.medicos.find(x => x.id === t.medico_id) : null
  const quien = !t.medico_id ? 'Toda la clínica' : m ? componerNombreMedicoCompleto(m) : 'Un médico'
  return t.principal ? `Duración de la consulta · ${quien}` : quien
}

export default function PestanaConsulta(p: Props) {
  const mia = p.tipos?.find(t => t.activo && t.principal && t.medico_id === p.usuarioId && !t.consultorio_id) ?? null
  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-[6px]">
        <h2 className={TITULO_PANEL}>{p.esMedico ? 'Tu consulta' : 'Tipos de cita'}</h2>
        {!p.esMedico && <p className={SUB_PANEL}>La duración de la consulta de cada médico y los demás tipos de cita de la clínica.</p>}
      </div>
      {/* Tanda M (punto 15): la secretaria no cambia ningún tipo (`/api/agenda/tipos-cita`: 403). */}
      {!p.esMedico && <p data-solo-admin className={AVISO_SOLO_ADMIN}>{SOLO_ADMIN_TIPOS}</p>}
      {!p.tipos ? <p className={`m-0 ${AYUDA}`}>No se pudieron leer los tipos de cita. Recarga la página.</p> : (
        <>
          {p.esMedico && <MiDuracion p={p} mia={mia} />}
          {p.esMedico && mia && <EnCadaConsultorio p={p} />}
          <OtrosTipos p={p} tipos={p.tipos} />
        </>
      )}
    </div>
  )
}

/** Los tipos que no son la duración de quien mira (esa va arriba), activos y quitados. */
/** «Agregar tipo de cita» y su formulario. */
function AgregarTipo({ p }: { p: Props }) {
  const [agregando, setAgregando] = useState(false)
  if (!agregando) {
    return (
      <button type="button" className={FILA_ACCION} onClick={() => setAgregando(true)}>
        <Plus size={18} strokeWidth={2.2} aria-hidden="true" /> Agregar tipo de cita
      </button>
    )
  }
  return (
    <FormTipoCita enLista inicial={p.puedeAdministrar ? VACIO : { ...VACIO, medicoId: p.usuarioId }} medicos={p.puedeAdministrar ? p.medicos : null}
      textoBoton="Agregar" onCancelar={() => setAgregando(false)}
      onGuardar={async d => {
        const r = await crearTipo(d)
        p.avisar(r.ok ? { ok: true } : r)
        if (r.ok) { setAgregando(false); p.alCambiar() }
        return r.ok ? null : r.motivo
      }} />
  )
}

function OtrosTipos({ p, tipos }: { p: Props; tipos: readonly TipoCita[] }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const puedeCambiar = (t: TipoCita) => p.puedeAdministrar || (p.esMedico && t.medico_id === p.usuarioId)
  const otros = tipos.filter(t => !(t.principal && t.medico_id === p.usuarioId))
  /* Tanda M (punto 15): el médico invitado ve primero los suyos y, tras el aviso, los de los demás, que no cambia
     (la ruta da 404). El administrador los cambia todos; la secretaria lee el aviso al inicio de la pestaña. */
  const activos = otros.filter(t => t.activo && puedeCambiar(t))
  const ajenos = otros.filter(t => t.activo && !puedeCambiar(t))
  const quitados = otros.filter(t => !t.activo && puedeCambiar(t))
  async function activo(t: TipoCita, valor: boolean): Promise<void> {
    setOcupado(t.id)
    const r = await editarTipo(t.id, { activo: valor })
    setOcupado(null)
    p.avisar(r.ok ? { ok: true } : r)
    setError(r.ok ? null : r.motivo)
    if (r.ok) p.alCambiar()
  }
  const fila = (t: TipoCita) => editando === t.id ? (
    <FormTipoCita key={t.id} enLista inicial={{ nombre: t.nombre, duracion: String(t.duracion_min), color: t.color ?? '', medicoId: t.medico_id ?? '' }} medicos={null}
      textoBoton="Guardar" onCancelar={() => setEditando(null)}
      onGuardar={async d => {
        const r = await editarTipo(t.id, { nombre: d.nombre, duracion_min: Number(d.duracion), color: d.color || null })
        p.avisar(r.ok ? { ok: true } : r)
        if (r.ok) { setEditando(null); p.alCambiar() }
        return r.ok ? null : r.motivo
      }} />
  ) : <FilaTipo key={t.id} t={t} ambito={ambito(t, p)} acciones={puedeCambiar(t)} ocupado={ocupado === t.id}
    alEditar={() => setEditando(t.id)} alActivar={v => void activo(t, v)} />
  return (
    <section className={BLOQUE} aria-label="Otros tipos de cita">
      <Rotulo icono={List} titulo="Otros tipos de cita" />
      <div className={LISTA}>
        {activos.map(fila)}
        {error && <p role="alert" className={`${ERROR} ${FILA}`}>{error}</p>}
        {(p.esMedico || p.puedeAdministrar) && <AgregarTipo p={p} />}
        {p.esMedico && ajenos.length > 0 && <p data-solo-admin className={`${AVISO_SOLO_ADMIN} ${AVISO_EN_LISTA}`}>{SOLO_ADMIN}</p>}
        {ajenos.map(fila)}
      </div>
      <p className={PIE}>Si también das citas de otra duración, como primera vez o curación, agrégalas. El paciente elige cuál al apartar.</p>
      {quitados.length > 0 && <Quitados tipos={quitados} fila={fila} />}
    </section>
  )
}

/** El color del tipo (CALMA §29.10): punto de 12 en su tono de evento; sin color, un aro vacío. */
function PuntoColor({ color }: { color: TipoCita['color'] }) {
  if (!color) return <span role="img" aria-label="Sin color" className="h-[12px] w-[12px] flex-none rounded-full border-2 border-tinta3" />
  return <span role="img" aria-label={`Color: ${COLOR_ETIQUETA[color]}`} className="h-[12px] w-[12px] flex-none rounded-full" style={{ background: `var(--cal-ev-${color})` }} />
}

function FilaTipo({ t, ambito, acciones, ocupado, alEditar, alActivar }: {
  t: TipoCita; ambito: string | null; acciones: boolean; ocupado: boolean; alEditar: () => void; alActivar: (v: boolean) => void
}) {
  return (
    <div className={FILA_GRIS} role="group" aria-label={t.nombre}>
      <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-[2px]">
        <span className="flex items-center gap-[8px] text-[15px] font-semibold leading-[20px] text-tinta">
          <PuntoColor color={t.color} /><strong className="font-semibold [overflow-wrap:anywhere]">{t.nombre}</strong>
        </span>
        <span className="text-[13px] leading-[18px] text-tinta2">{t.duracion_min} minutos{ambito ? ` · ${ambito}` : ''}</span>
      </span>
      {acciones && (
        <span className="flex flex-none items-center">
          {t.activo && <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={alEditar} aria-label={`Editar ${t.nombre}`}>Editar</button>}
          {t.activo
            ? <button type="button" className={BOTON_TEXTO_ROJO} disabled={ocupado} onClick={() => alActivar(false)} aria-label={`Quitar ${t.nombre}`}>Quitar</button>
            : <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={() => alActivar(true)} aria-label={`Reactivar ${t.nombre}`}>Reactivar</button>}
        </span>
      )}
    </div>
  )
}

function Quitados({ tipos, fila }: { tipos: readonly TipoCita[]; fila: (t: TipoCita) => ReactNode }) {
  return (
    <details className="group flex flex-col gap-[8px]">
      <summary className="flex h-[44px] w-fit cursor-pointer list-none items-center gap-[6px] px-[16px] text-[15px] font-semibold text-enlace ih:h-[36px] esc:h-[36px] ih:px-[20px] iv:px-[20px] esc:px-[20px] ih:text-[14px] esc:text-[14px] [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" className="transition-transform duration-[var(--dur-toque)] group-open:rotate-90 motion-reduce:transition-none" />
        Quitados ({tipos.length})
      </summary>
      <div className={LISTA}>{tipos.map(fila)}</div>
    </details>
  )
}
