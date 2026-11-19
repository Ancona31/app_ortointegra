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
 */
import { useId, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import DuracionEnConsultorio from '@/components/agenda/configuracion/DuracionEnConsultorio'
import FormTipoCita, { type DatosTipoCita } from '@/components/agenda/configuracion/FormTipoCita'
import { crearTipo, editarTipo, guardarDuracion } from '@/components/agenda/configuracion/accionesConfig'
import type { Avisar } from '@/components/agenda/configuracion/estadoAvisos'
import { AYUDA, BLOQUE, BOTON_TEXTO, BOTON_TEXTO_ROJO, CAMPO_NUEVO, ERROR, FILA_GRIS, opcion, PANEL, SUB_PANEL, TITULO_BLOQUE, TITULO_PANEL } from '@/components/agenda/configuracion/estilosConfig'
import { DURACIONES } from '@/components/agenda/configuracion/PasoDuracion'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
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
        {actual ? <>Tu consulta dura <strong className="text-[var(--ag-ink)]">{actual} minutos</strong>. </> : 'Aún no elegiste cuánto dura tu consulta. '}
        Con esto sabemos cuántas citas caben en tu día.
      </p>
      <div className="grid grid-cols-3 gap-[10px] sm:grid-cols-5">
        {DURACIONES.map(d => (
          <button key={d} type="button" aria-pressed={actual === d} disabled={ocupado} onClick={() => void elegir(d)}
            className={`${opcion(actual === d)} min-h-[52px]`}>{d} min</button>
        ))}
      </div>
      {otra ? (
        <div className="flex flex-wrap items-center gap-[10px]">
          <label htmlFor={`${id}-o`} className="flex items-center gap-[10px] text-[14px] text-[var(--ag-text)]">Mi consulta dura
            <input id={`${id}-o`} type="number" inputMode="numeric" min={5} max={600} step={5} className={`${CAMPO_NUEVO} w-[96px]`}
              value={texto} onChange={e => setTexto(e.target.value)} />
            minutos</label>
          <button type="button" className={BOTON_TEXTO} disabled={ocupado || !(Number(texto) >= 5)} onClick={() => void elegir(Number(texto))}>Guardar</button>
          <button type="button" className={BOTON_TEXTO} onClick={() => setOtra(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className={`${BOTON_TEXTO} self-start px-0`} onClick={() => { setTexto(String(actual ?? '')); setOtra(true) }}>Otra duración</button>
      )}
    </>
  )
}

function EnCadaConsultorio({ p }: { p: Props }) {
  if (p.misConsultorios.length === 0) return null
  return (
    <div className={BLOQUE}>
      <div className="flex flex-col gap-[4px]">
        <span className={TITULO_BLOQUE}>En cada consultorio</span>
        <span className={AYUDA}>Si en algún consultorio tu consulta dura distinto, cámbiala solo ahí.</span>
      </div>
      {p.misConsultorios.map(c => (
        <div key={c.id} role="group" aria-label={c.nombre} className="flex flex-col gap-[6px]">
          <span className="text-[15px] font-semibold text-[var(--ag-ink)]">{c.nombre}</span>
          <DuracionEnConsultorio consultorioId={c.id} consultorioNombre={c.nombre} medicoId={p.usuarioId} tipos={p.tipos} alCambiar={p.alCambiar} />
        </div>
      ))}
    </div>
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
      {!p.tipos ? <p className={AYUDA}>No se pudieron leer los tipos de cita. Recarga la página.</p> : (
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
      <button type="button" className={`${BOTON_TEXTO} self-start px-0`} onClick={() => setAgregando(true)}>
        <Plus size={18} aria-hidden="true" /> Agregar tipo de cita
      </button>
    )
  }
  return (
    <FormTipoCita inicial={p.puedeAdministrar ? VACIO : { ...VACIO, medicoId: p.usuarioId }} medicos={p.puedeAdministrar ? p.medicos : null}
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
  const activos = otros.filter(t => t.activo)
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
    <FormTipoCita key={t.id} inicial={{ nombre: t.nombre, duracion: String(t.duracion_min), color: t.color ?? '', medicoId: t.medico_id ?? '' }} medicos={null}
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
    <div className={BLOQUE}>
      <div className="flex flex-col gap-[4px]">
        <span className={TITULO_BLOQUE}>Otros tipos de cita</span>
        <span className={AYUDA}>Si también das citas de otra duración, como primera vez o curación, agrégalas. El paciente elige cuál al apartar.</span>
      </div>
      {activos.map(fila)}
      {error && <p role="alert" className={ERROR}>{error}</p>}
      {(p.esMedico || p.puedeAdministrar) && <AgregarTipo p={p} />}
      {quitados.length > 0 && <Quitados tipos={quitados} fila={fila} />}
    </div>
  )
}

function FilaTipo({ t, ambito, acciones, ocupado, alEditar, alActivar }: {
  t: TipoCita; ambito: string | null; acciones: boolean; ocupado: boolean; alEditar: () => void; alActivar: (v: boolean) => void
}) {
  return (
    <div className={FILA_GRIS} role="group" aria-label={t.nombre}>
      <span className="text-[14px] text-[var(--ag-ink)]">
        <strong>{t.nombre}</strong> · {t.duracion_min} minutos{ambito ? <span className="text-[var(--ag-ink-600)]"> · {ambito}</span> : null}
      </span>
      {acciones && (
        <div className="flex gap-[4px]">
          {t.activo && <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={alEditar} aria-label={`Editar ${t.nombre}`}>Editar</button>}
          {t.activo
            ? <button type="button" className={BOTON_TEXTO_ROJO} disabled={ocupado} onClick={() => alActivar(false)} aria-label={`Quitar ${t.nombre}`}>Quitar</button>
            : <button type="button" className={BOTON_TEXTO} disabled={ocupado} onClick={() => alActivar(true)} aria-label={`Reactivar ${t.nombre}`}>Reactivar</button>}
        </div>
      )}
    </div>
  )
}

function Quitados({ tipos, fila }: { tipos: readonly TipoCita[]; fila: (t: TipoCita) => ReactNode }) {
  return (
    <details className="flex flex-col gap-[8px]">
      <summary className="min-h-[44px] cursor-pointer content-center text-[14px] font-semibold text-[var(--ag-ink-600)]">Quitados ({tipos.length})</summary>
      <div className="flex flex-col gap-[8px]">{tipos.map(fila)}</div>
    </details>
  )
}
