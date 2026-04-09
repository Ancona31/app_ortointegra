'use client'

import { Search } from 'lucide-react'
import type { ChangeEvent, ReactElement } from 'react'
import type {
  ClinicasFilter,
  EstadoClinica,
  EstadoPago,
  TipoCuenta,
} from '@/lib/super-admin/types'

interface Props {
  value: ClinicasFilter
  onChange: (next: ClinicasFilter) => void
}

const TIPO_OPTS: ReadonlyArray<{ value: TipoCuenta | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'independiente', label: 'Independiente' },
]

const PLAN_OPTS: ReadonlyArray<{ value: EstadoPago | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los planes' },
  { value: 'gratuito', label: 'Gratuito' },
  { value: 'trial', label: 'Trial' },
  { value: 'pagando', label: 'Pagando' },
  { value: 'vip', label: 'VIP' },
  { value: 'pago_fallido', label: 'Pago fallido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const ESTADO_OPTS: ReadonlyArray<{ value: EstadoClinica | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'activa', label: 'Activa' },
  { value: 'suspendida', label: 'Suspendida' },
  { value: 'inactiva', label: 'Inactiva' },
]

const SELECT_CLASSES =
  'bg-slate-900 border border-slate-800 text-slate-200 text-[12.5px] rounded-lg px-3 py-2 hover:border-slate-700 focus:outline-none focus:border-[#1e5fa8] transition-colors'

export default function ClinicasFilters({ value, onChange }: Props): ReactElement {
  const handleQ = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...value, q: e.target.value })
  }
  const handleTipo = (e: ChangeEvent<HTMLSelectElement>): void => {
    const v = e.target.value
    if (v === 'clinica' || v === 'independiente' || v === 'todos') {
      onChange({ ...value, tipo: v })
    }
  }
  const handlePlan = (e: ChangeEvent<HTMLSelectElement>): void => {
    const v = e.target.value
    const allowed: ReadonlyArray<EstadoPago | 'todos'> = [
      'todos',
      'gratuito',
      'trial',
      'pagando',
      'vip',
      'pago_fallido',
      'cancelado',
    ]
    if ((allowed as ReadonlyArray<string>).includes(v)) {
      onChange({ ...value, plan: v as EstadoPago | 'todos' })
    }
  }
  const handleEstado = (e: ChangeEvent<HTMLSelectElement>): void => {
    const v = e.target.value
    if (v === 'activa' || v === 'suspendida' || v === 'inactiva' || v === 'todos') {
      onChange({ ...value, estado: v })
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={value.q}
          onChange={handleQ}
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[12.5px] rounded-lg pl-9 pr-3 py-2 hover:border-slate-700 focus:outline-none focus:border-[#1e5fa8] transition-colors placeholder:text-slate-600"
        />
      </div>
      <select value={value.tipo} onChange={handleTipo} className={SELECT_CLASSES}>
        {TIPO_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select value={value.plan} onChange={handlePlan} className={SELECT_CLASSES}>
        {PLAN_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select value={value.estado} onChange={handleEstado} className={SELECT_CLASSES}>
        {ESTADO_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
