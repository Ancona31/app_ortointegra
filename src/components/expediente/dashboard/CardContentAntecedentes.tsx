import type { Paciente } from '@/types'

type Props = { paciente: Paciente }

const ITEMS = [
  { key: 'ant_no_patologicos',    label: 'No patológicos' },
  { key: 'ant_patologicos',       label: 'Patológicos' },
  { key: 'ant_quirurgicos',       label: 'Quirúrgicos' },
  { key: 'ant_familiares',        label: 'Familiares' },
  { key: 'medicamentos_actuales', label: 'Medicamentos actuales' },
] as const

export default function CardContentAntecedentes({ paciente }: Props) {
  const valores = ITEMS.map((it) => ({ ...it, value: paciente[it.key] }))
  const todosVacios = valores.every((v) => !v.value || !v.value.trim())

  if (todosVacios) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        Sin antecedentes registrados
      </div>
    )
  }

  return (
    <div>
      {valores.map((v, i) => (
        <div
          key={v.key}
          className={`flex py-3 ${i < valores.length - 1 ? 'border-b border-slate-100' : ''}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 shrink-0 pt-0.5">
            {v.label}
          </div>
          <div className="flex-1 text-sm leading-relaxed text-slate-900">
            {v.value && v.value.trim()
              ? v.value
              : <span className="text-slate-400 italic">Sin registro</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
