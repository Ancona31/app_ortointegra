'use client'

import { CheckCircle2, Clock } from 'lucide-react'

export function StatusChip({ status }: { status: string }) {
  if (status === 'confirmed') return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
      <CheckCircle2 size={10} /> Confirmada
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1e5fa8] bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Clock size={10} /> Agendada
    </span>
  )
}
