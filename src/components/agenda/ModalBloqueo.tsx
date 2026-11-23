'use client'

/**
 * src/components/agenda/ModalBloqueo.tsx
 *
 * K1 (tanda K, sección A) · Crear, editar y quitar un BLOQUEO DE HORARIO: un
 * periodo, de horas o de días completos, de un médico, con un motivo opcional.
 * No es el modal de la cita (`AppointmentModal`) a propósito: un bloqueo no
 * tiene paciente, estado, consultorio ni invitados, y meterlo como un tercer
 * `TipoFila` habría ensanchado el tipo del que cuelgan las citas.
 *
 * Mismo armazón que `ConfirmModal` (Portal, velo, `useDialogoModal`), sin
 * salida animada (decisión 17). Al CREAR, las horas se teclean en la hora de
 * pared de quien mira —la misma de la rejilla y del modal de la cita
 * (`componerIso`)— y esa zona viaja con el bloqueo, para que los días
 * completos sean medianoche a medianoche ahí. Al EDITAR se enseñan y se guardan
 * en la zona del bloqueo (la de quien lo creó): si quien edita está en otro
 * huso, ve otras horas que en la rejilla (deuda anotada, caso raro).
 *
 * Punto 5: guardar no toca las citas; si hay, el aviso dice cuántas.
 */
import { useId, useState, type ReactElement } from 'react'
import Portal from '@/components/ui/Portal'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { addMinutes, componerIso, partirFechaHora } from '@/lib/agenda/fechasAgenda'
import { renderEnTZ, desplazarFecha } from '@/lib/dates'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'
import type { AperturaBloqueo, BloqueoAgenda } from '@/lib/agenda/bloqueosAgenda'
import { logger } from '@/lib/logger'

export type ModoBloqueo = { tipo: 'crear'; desde: AperturaBloqueo } | { tipo: 'editar'; bloqueo: BloqueoAgenda }

interface Props {
  modo: ModoBloqueo
  medicos: readonly MedicoConfig[]
  /** Con un solo médico (o un médico que sólo agenda para sí) no se elige. */
  ocultarMedico: boolean
  /** La zona de la rejilla (la del navegador). */
  zona: string
  onClose: () => void
  /** Tras guardar: cuántas citas hay en el periodo (no se tocan). */
  onGuardado: (citas: number) => void
  onQuitado: () => void
}

interface Campos { medicoId: string; todoElDia: boolean; fecha: string; hora: string; fechaFin: string; horaFin: string; motivo: string }

/** Lo que el formulario enseña al abrir. Un bloqueo de días: `fechaFin` es el último día INCLUIDO. */
export function camposIniciales(modo: ModoBloqueo, zona: string): Campos {
  if (modo.tipo === 'editar') {
    const b = modo.bloqueo
    const z = b.zona ?? zona
    const finDia = renderEnTZ(b.fin, 'yyyy-MM-dd', z)
    return {
      medicoId: b.medico_id, todoElDia: b.todo_el_dia, motivo: b.motivo ?? '',
      fecha: renderEnTZ(b.inicio, 'yyyy-MM-dd', z), hora: renderEnTZ(b.inicio, 'HH:mm', z),
      fechaFin: b.todo_el_dia ? desplazarFecha(finDia, { dias: -1 }) : finDia, horaFin: renderEnTZ(b.fin, 'HH:mm', z),
    }
  }
  const d = modo.desde
  const hora = d.hora || '09:00'
  /* Sin fin, una hora después — y si eso cruza la medianoche, el fin es del día siguiente. */
  const fin = d.horaFin ? { fecha: d.fechaFin || d.fecha, hora: d.horaFin } : partirFechaHora(addMinutes(componerIso(d.fecha, hora), 60))
  return {
    medicoId: d.medicoId ?? '', todoElDia: d.todoElDia ?? !d.hora, motivo: '',
    fecha: d.fecha, hora, fechaFin: fin.fecha, horaFin: fin.hora,
  }
}

/** El cuerpo de la petición (`PuntasBloqueoSchema` del servidor). */
export function cuerpoBloqueo(c: Campos, zona: string): Record<string, unknown> {
  const motivo = c.motivo.trim() || null
  return c.todoElDia
    ? { todo_el_dia: true, desde: c.fecha, hasta: c.fechaFin, zona, motivo }
    : { todo_el_dia: false, fecha: c.fecha, hora_inicio: c.hora, fecha_fin: c.fechaFin, hora_fin: c.horaFin, zona, motivo }
}

/** Por qué no se puede guardar todavía, o `null`. */
export function motivoParaNoGuardarBloqueo(c: Campos): string | null {
  if (!c.medicoId) return 'Elige el médico.'
  if (!c.fecha || !c.fechaFin) return 'Pon las fechas.'
  if (c.todoElDia) return c.fechaFin < c.fecha ? 'El último día no puede ser antes del primero.' : null
  if (!c.hora || !c.horaFin) return 'Pon las horas.'
  return `${c.fechaFin}T${c.horaFin}` > `${c.fecha}T${c.hora}` ? null : 'El fin tiene que ser después del inicio.'
}

async function enviar(modo: ModoBloqueo, c: Campos, zona: string): Promise<{ ok: true; citas: number } | { ok: false; error: string }> {
  const cuerpo = cuerpoBloqueo(c, zona)
  const res = modo.tipo === 'crear'
    ? await fetch('/api/agenda/bloqueos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo, medico_id: c.medicoId }) })
    : await fetch(`/api/agenda/bloqueos/${modo.bloqueo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const datos: unknown = await res.json().catch(() => null)
  if (res.ok) {
    const citas = typeof datos === 'object' && datos !== null && 'citas' in datos && typeof datos.citas === 'number' ? datos.citas : 0
    return { ok: true, citas }
  }
  const error = typeof datos === 'object' && datos !== null && 'error' in datos && typeof datos.error === 'string' ? datos.error : 'No se pudo guardar el bloqueo'
  return { ok: false, error }
}

/* B13 · AG6 · las piezas del catálogo (maqueta `ag-form`, vista 2 «Bloqueo»): rótulo 13/600, campo
   relleno `--sup2` sin borde (44/16 táctil, 40/15 computadora) con contorno `--enlace` al enfocar. */
const ETIQUETA = 'block text-[13px] leading-[18px] font-semibold mb-1.5'
const CAMPO = 'w-full h-11 esc:h-10 rounded-xl border-0 px-3 text-base esc:text-[15px] focus:outline-2 focus:outline-enlace'
const ESTILO_CAMPO = { color: 'var(--tinta)', background: 'var(--sup2)' }

function CamposPeriodo({ c, set }: { c: Campos; set: (p: Partial<Campos>) => void }): ReactElement {
  return (
    <>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ag-ink)' }}>
        <input type="checkbox" checked={c.todoElDia} onChange={e => set({ todoElDia: e.target.checked })} data-bloqueo-todo-el-dia />
        Días completos
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={ETIQUETA} style={{ color: 'var(--tinta2)' }}>{c.todoElDia ? 'Desde' : 'Inicio'}</label>
          <input type="date" className={CAMPO} style={ESTILO_CAMPO} value={c.fecha} aria-label="Fecha de inicio"
            onChange={e => set({ fecha: e.target.value, ...(c.fechaFin < e.target.value ? { fechaFin: e.target.value } : {}) })} />
          {!c.todoElDia && <input type="time" className={`${CAMPO} mt-1.5`} style={ESTILO_CAMPO} value={c.hora} aria-label="Hora de inicio" onChange={e => set({ hora: e.target.value })} />}
        </div>
        <div>
          <label className={ETIQUETA} style={{ color: 'var(--tinta2)' }}>{c.todoElDia ? 'Hasta (incluido)' : 'Fin'}</label>
          <input type="date" className={CAMPO} style={ESTILO_CAMPO} value={c.fechaFin} aria-label="Fecha de fin" onChange={e => set({ fechaFin: e.target.value })} />
          {!c.todoElDia && <input type="time" className={`${CAMPO} mt-1.5`} style={ESTILO_CAMPO} value={c.horaFin} aria-label="Hora de fin" onChange={e => set({ horaFin: e.target.value })} />}
        </div>
      </div>
    </>
  )
}

function CampoMedico({ c, set, medicos }: { c: Campos; set: (p: Partial<Campos>) => void; medicos: readonly MedicoConfig[] }): ReactElement {
  return (
    <div>
      <label className={ETIQUETA} style={{ color: 'var(--tinta2)' }}>Médico</label>
      <select className={CAMPO} style={ESTILO_CAMPO} value={c.medicoId} aria-label="Médico" onChange={e => set({ medicoId: e.target.value })}>
        <option value="">Elige el médico</option>
        {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
      </select>
    </div>
  )
}

function useGuardadoBloqueo(p: Props) {
  const [estado, setEstado] = useState<{ ocupado: boolean; error: string | null }>({ ocupado: false, error: null })
  const guardar = async (c: Campos): Promise<void> => {
    const falta = motivoParaNoGuardarBloqueo(c)
    if (falta) { setEstado({ ocupado: false, error: falta }); return }
    setEstado({ ocupado: true, error: null })
    try {
      const r = await enviar(p.modo, c, p.modo.tipo === 'editar' ? (p.modo.bloqueo.zona ?? p.zona) : p.zona)
      if (r.ok) { p.onGuardado(r.citas); return }
      setEstado({ ocupado: false, error: r.error })
    } catch (err: unknown) {
      logger.warn('agenda', `bloqueo sin guardar: ${err instanceof Error ? err.message : 'red'}`)
      setEstado({ ocupado: false, error: 'No se pudo guardar el bloqueo' })
    }
  }
  const quitar = async (id: string): Promise<void> => {
    setEstado({ ocupado: true, error: null })
    try {
      const res = await fetch(`/api/agenda/bloqueos/${id}`, { method: 'DELETE' })
      if (res.ok) { p.onQuitado(); return }
      setEstado({ ocupado: false, error: res.status === 403 ? 'Sin permisos' : 'No se pudo quitar el bloqueo' })
    } catch {
      setEstado({ ocupado: false, error: 'No se pudo quitar el bloqueo' })
    }
  }
  return { estado, guardar, quitar }
}

export default function ModalBloqueo(p: Props): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(p.onClose)
  const tituloId = useId()
  const [c, setC] = useState<Campos>(() => camposIniciales(p.modo, p.zona))
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  const set = (parte: Partial<Campos>): void => setC(v => ({ ...v, ...parte }))
  const { estado, guardar, quitar } = useGuardadoBloqueo(p)
  const editar = p.modo.tipo === 'editar' ? p.modo.bloqueo : null
  return (
    <Portal>
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div className="ag-modal-velo absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={p.onClose} />
        <div ref={montarPanel} onKeyDown={alPulsarTecla} role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1}
          data-modal-bloqueo
          className="ag-modal-panel relative focus:outline-none bg-sup text-tinta rounded-[20px] shadow-[var(--sombra-capa)] w-full max-w-[440px] ext:max-w-[310px] p-6 ext:p-5 flex flex-col gap-3 max-h-full overflow-y-auto">
          <h2 id={tituloId} className="text-[17px] leading-[22px] font-bold text-tinta">{editar ? 'Bloqueo de horario' : 'Bloquear horario'}</h2>
          <p className="text-[13px] leading-[18px] text-tinta2">
            En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.
          </p>
          {!p.ocultarMedico && !editar && <CampoMedico c={c} set={set} medicos={p.medicos} />}
          <CamposPeriodo c={c} set={set} />
          <div>
            <label className={ETIQUETA} style={{ color: 'var(--tinta2)' }}>Motivo (opcional)</label>
            <input className={CAMPO} style={ESTILO_CAMPO} value={c.motivo} maxLength={120} aria-label="Motivo"
              placeholder="Vacaciones, congreso…" onChange={e => set({ motivo: e.target.value })} />
            <p className="text-[12px] leading-4 mt-1 text-tinta2">
              Si la clínica usa Google Calendar, el motivo aparece allí. No escribas datos de pacientes.
            </p>
          </div>
          {estado.error && <p role="alert" className="text-[13px] font-semibold text-mal-tinta">{estado.error}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* B13 · AG6 (§29.2, §29.4): «Quitar bloqueo» pregunta con la alerta del catálogo y su verbo. */}
            {editar && <button type="button" className="k-b k-b-capa k-b-texto text-mal-tinta" disabled={estado.ocupado}
              onClick={() => setConfirmandoQuitar(true)}>Quitar bloqueo</button>}
            <span className="flex-1" />
            <button type="button" onClick={p.onClose} className="k-b k-b-capa k-b-quieto">Cancelar</button>
            <button type="button" disabled={estado.ocupado} onClick={() => void guardar(c)} className="k-b k-b-capa k-b-prim">
              {estado.ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
      {editar && confirmandoQuitar && (
        <ConfirmModal message="¿Quitar el bloqueo de horario? Se vuelve a poder agendar en ese periodo."
          verbo="Quitar bloqueo" icono="eliminar"
          onConfirm={() => { setConfirmandoQuitar(false); void quitar(editar.id) }} onCancel={() => setConfirmandoQuitar(false)} />
      )}
    </Portal>
  )
}
