'use client'

import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, ClipboardList } from 'lucide-react'
import type { Consulta } from '@/types'
import ModalShell from '@/components/ui/ModalShell'

type ModalConsultasProps = {
  open: boolean
  onClose: () => void
  consultas: Consulta[]
  pacienteId: string
}

function diagnosticoTexto(c: Consulta): string {
  const primero = c.diagnosticos?.[0]
  if (primero?.descripcion) {
    return primero.codigo_cie10
      ? `${primero.codigo_cie10} · ${primero.descripcion}`
      : primero.descripcion
  }
  return c.motivo_consulta || 'Consulta sin detalles'
}

export default function ModalConsultas({ open, onClose, consultas, pacienteId }: ModalConsultasProps) {
  const router = useRouter()

  function abrirConsulta(consultaId: string) {
    router.push(`/expediente/${pacienteId}/consulta/${consultaId}`)
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`Consultas · ${consultas.length}`}
      icon={<ClipboardList size={16} />}
      iconBg="bg-blue-50 text-blue-600"
      maxWidth="max-w-lg"
    >
      {consultas.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Sin consultas registradas</p>
          <p className="text-slate-400 text-sm mt-1">Las notas médicas aparecerán aquí</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {consultas.map(c => (
            <button
              key={c.id}
              onClick={() => abrirConsulta(c.id)}
              className="w-full px-4 py-3 hover:bg-slate-50 transition-colors duration-150 text-left"
              style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
            >
              <p className="text-[13px] font-medium text-slate-900 tabular-nums">
                {format(parseISO(c.fecha), "d 'de' MMMM yyyy", { locale: es })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {diagnosticoTexto(c)}
              </p>
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  )
}
