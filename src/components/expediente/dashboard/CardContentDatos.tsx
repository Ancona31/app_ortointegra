import type { Paciente } from '@/types'

type Props = { paciente: Paciente }

type Stat = { label: string; value: string; unit?: string }

export default function CardContentDatos({ paciente }: Props) {
  const stats: Stat[] = [
    { label: 'Peso',     value: paciente.peso_kg  != null ? String(paciente.peso_kg)  : '—', unit: paciente.peso_kg  != null ? 'kg'    : undefined },
    { label: 'Talla',    value: paciente.talla_cm != null ? String(paciente.talla_cm) : '—', unit: paciente.talla_cm != null ? 'cm'    : undefined },
    { label: 'IMC',      value: paciente.imc      != null ? String(paciente.imc)      : '—', unit: paciente.imc      != null ? 'kg/m²' : undefined },
    { label: 'Teléfono', value: paciente.telefono ?? '—' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-slate-50 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {s.label}
          </div>
          <div
            className="text-base font-semibold text-slate-900 mt-1"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {s.value}
            {s.unit && <span className="text-xs font-normal text-slate-500 ml-1">{s.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
