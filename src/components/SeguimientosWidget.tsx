'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { format, isPast, isToday, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Seguimiento = {
  consulta_id: string
  paciente_id: string
  paciente_nombre: string
  proxima_cita: string
  motivo_consulta: string
}

export default function SeguimientosWidget() {
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me/seguimientos')
      .then(r => r.json())
      .then(d => setSeguimientos(d.seguimientos || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading || seguimientos.length === 0) return null

  const vencidos = seguimientos.filter(s => isPast(parseISO(s.proxima_cita)) && !isToday(parseISO(s.proxima_cita)))

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <CalendarCheck size={15} className="text-amber-600" />
        <h2 className="font-semibold text-amber-800 text-sm">Seguimientos pendientes</h2>
        {vencidos.length > 0 && (
          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
            {vencidos.length} vencido{vencidos.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {seguimientos.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {seguimientos.map(s => {
          const fecha = parseISO(s.proxima_cita)
          const vencido = isPast(fecha) && !isToday(fecha)
          const hoy = isToday(fecha)
          const diasRestantes = differenceInDays(fecha, new Date())

          return (
            <Link
              key={s.consulta_id}
              href={`/expediente/${s.paciente_id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                vencido ? 'bg-red-100' : hoy ? 'bg-amber-100' : 'bg-blue-50'
              }`}>
                {vencido
                  ? <AlertCircle size={15} className="text-red-500" />
                  : <Clock size={15} className={hoy ? 'text-amber-500' : 'text-blue-400'} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{s.paciente_nombre}</p>
                {s.motivo_consulta && (
                  <p className="text-xs text-slate-400 truncate">{s.motivo_consulta}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-semibold ${
                  vencido ? 'text-red-500' : hoy ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  {vencido
                    ? `Hace ${Math.abs(diasRestantes)}d`
                    : hoy
                    ? 'Hoy'
                    : `En ${diasRestantes}d`}
                </p>
                <p className="text-[10px] text-slate-400">
                  {format(fecha, "d 'de' MMM", { locale: es })}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
