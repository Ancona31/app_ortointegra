'use client'

/**
 * D7 · «Ligar a un paciente», en el modal de una cita POR LIGAR, al pulsar
 * «Iniciar consulta». Dos salidas, como pide §2:
 *   · un paciente EXISTENTE, con el buscador de siempre del modal (lo maneja
 *     `AppointmentModal`, que es quien tiene `usePacientes`);
 *   · uno NUEVO, con `QuickPatientModal`, que exige el consentimiento de
 *     privacidad antes de crear (regla de `CLAUDE.md`) y ya resuelve el
 *     duplicado o el vínculo con otro médico.
 * Elegido el paciente, el modal liga la cita y abre la nota. El teléfono de
 * quien reservó se enseña para copiarlo a mano: no se copia a la ficha (lista
 * A, punto 9).
 */
import { Loader2, Plus } from 'lucide-react'
import type { PacienteParaLigar } from '@/lib/agenda/ligarCita'

interface Props {
  nombreReserva: string
  telefono: string | null
  correo: string | null
  search: string
  onSearch: (v: string) => void
  resultados: (PacienteParaLigar & { telefono: string | null })[]
  buscando: boolean
  enviando: boolean
  error: string | null
  onElegir: (p: PacienteParaLigar) => void
  onNuevo: () => void
  onVolver: () => void
}

const CAMPO = 'w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)]'

export default function PanelLigarCita(p: Props) {
  return (
    <section aria-label="Ligar a un paciente" className="px-3 py-3 rounded-xl border space-y-2.5"
      style={{ background: 'var(--ag-patient-card-bg)', borderColor: 'var(--ag-patient-card-border)' }}>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--ag-ink)' }}>Ligar a un paciente</p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
          Reservó {p.nombreReserva}{[p.telefono, p.correo].some(Boolean) ? ` (${[p.telefono, p.correo].filter(Boolean).join(' · ')})` : ''}.
          Elige su expediente o regístralo; después se abre la nota de la consulta.
        </p>
      </div>
      <input autoFocus value={p.search} onChange={e => p.onSearch(e.target.value)} disabled={p.enviando}
        placeholder="Buscar paciente existente…" aria-label="Buscar paciente existente" className={CAMPO} />
      <ul className="max-h-[220px] overflow-y-auto overscroll-contain rounded-xl border divide-y"
        style={{ borderColor: 'var(--ag-input-border)', background: 'var(--ag-modal-bg)' }}>
        {p.buscando && <li className="px-3 py-2.5 text-xs" style={{ color: 'var(--ag-muted)' }}>Buscando…</li>}
        {!p.buscando && p.search.trim().length >= 2 && p.resultados.length === 0 && (
          <li className="px-3 py-2.5 text-xs" style={{ color: 'var(--ag-muted)' }}>Sin coincidencias.</li>
        )}
        {p.resultados.map(r => (
          <li key={r.id}>
            <button type="button" disabled={p.enviando} onClick={() => p.onElegir(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--ag-btn-ghost-hover)] disabled:opacity-50">
              <span className="block text-sm font-medium" style={{ color: 'var(--ag-ink)' }}>{r.nombre} {r.apellidos}</span>
              {r.telefono && <span className="block text-[11px]" style={{ color: 'var(--ag-muted)' }}>{r.telefono}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={p.onNuevo} disabled={p.enviando}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
          <Plus size={14} /> Registrar paciente nuevo
        </button>
        <button type="button" onClick={p.onVolver} disabled={p.enviando}
          className="ml-auto px-3 py-2 rounded-xl text-sm font-bold hover:bg-[var(--ag-btn-ghost-hover)] disabled:opacity-50" style={{ color: 'var(--ag-muted)' }}>
          Volver
        </button>
        {p.enviando && <Loader2 size={16} className="animate-spin" aria-label="Ligando" />}
      </div>
      {p.error && <p role="alert" className="text-[12px] text-red-600">{p.error}</p>}
    </section>
  )
}
