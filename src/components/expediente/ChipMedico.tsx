// src/components/expediente/ChipMedico.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Chip de médico tratante para la lista de Expediente.
//
//   [AM] Dr. Ancona
//   └─ mini-avatar con iniciales + tono determinístico por id de médico
//
// El LABEL ("Dr. Apellido") y las INICIALES se componen con los helpers ya
// existentes (src/lib/nombreMedico.ts), fuente de verdad del display de nombres.
// El TONO (color) NO lo dan esos helpers; se deriva aquí de forma determinística
// a partir del id del médico, para que el color sea ESTABLE por médico.
// ─────────────────────────────────────────────────────────────────────────────

import {
  componerNombreMedicoCorto,
  componerInicialesMedico,
} from '@/lib/nombreMedico'

// Campos que el chip necesita de cada médico (subconjunto del jsonb del RPC).
export interface MedicoChipData {
  id: string
  titulo: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
}

// Paleta de tonos pastel, alineada con los avatares de la app.
const TONOS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
] as const

// Hash determinístico simple sobre el id (uuid) → índice de tono estable.
function tonoPorId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % TONOS.length
  return TONOS[idx]
}

interface ChipMedicoProps {
  medico: MedicoChipData
  size?: 'sm' | 'md'
}

export function ChipMedico({ medico, size = 'sm' }: ChipMedicoProps) {
  const label = componerNombreMedicoCorto(medico)
  const iniciales = componerInicialesMedico(medico)
  const tono = tonoPorId(medico.id)

  const dims =
    size === 'md'
      ? { wrap: 'gap-1.5 pl-1 pr-2.5 py-1', av: 'w-6 h-6 text-[10px]', txt: 'text-sm' }
      : { wrap: 'gap-1 pl-0.5 pr-2 py-0.5', av: 'w-5 h-5 text-[9px]', txt: 'text-xs' }

  return (
    <span
      className={`inline-flex items-center ${dims.wrap} rounded-full bg-slate-50 border border-slate-200/70 max-w-full`}
      title={label}
    >
      <span
        className={`inline-flex items-center justify-center ${dims.av} rounded-full font-semibold shrink-0 ${tono}`}
        aria-hidden="true"
      >
        {iniciales}
      </span>
      <span className={`${dims.txt} text-slate-700 truncate`}>{label}</span>
    </span>
  )
}

// ── Contenedor: lista de chips de un paciente, con colapso "+N" ──────────────
interface ListaChipsMedicosProps {
  medicos: MedicoChipData[] | null | undefined
  max?: number
  size?: 'sm' | 'md'
}

export function ListaChipsMedicos({
  medicos,
  max = 2,
  size = 'sm',
}: ListaChipsMedicosProps) {
  const lista = medicos ?? []

  if (lista.length === 0) {
    return <span className="text-xs text-slate-400">—</span>
  }

  const visibles = lista.slice(0, max)
  const ocultos = lista.slice(max)

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visibles.map((m) => (
        <ChipMedico key={m.id} medico={m} size={size} />
      ))}
      {ocultos.length > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium"
          title={ocultos.map((m) => componerNombreMedicoCorto(m)).join(', ')}
        >
          +{ocultos.length}
        </span>
      )}
    </span>
  )
}
