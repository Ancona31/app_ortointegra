'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { Stethoscope, CalendarDays, ChevronRight } from 'lucide-react'

interface PacienteReciente {
  id: string
  nombre_completo: string
  ultima_visita: string | null
}

interface CitaProxima {
  id: string
  fecha: string
  paciente_nombre: string | null
  tipo: string | null
}

export default function ActividadReciente() {
  const [pacientes, setPacientes] = useState<PacienteReciente[]>([])
  const [citas, setCitas] = useState<CitaProxima[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    Promise.all([
      // Últimos 5 pacientes con consulta reciente
      supabase
        .from('pacientes')
        .select('id, nombre_completo, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5),
      // Próximas citas (hoy y futuras)
      supabase
        .from('citas')
        .select('id, fecha, tipo, paciente_id, pacientes(nombre_completo)')
        .gte('fecha', today)
        .order('fecha', { ascending: true })
        .limit(5),
    ]).then(([pacRes, citaRes]) => {
      const pacs = ((pacRes.data ?? []) as Array<Record<string, unknown>>).map(p => ({
        id: p.id as string,
        nombre_completo: p.nombre_completo as string,
        ultima_visita: p.updated_at as string | null,
      }))
      const cits = (citaRes.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        fecha: c.fecha as string,
        tipo: c.tipo as string | null,
        paciente_nombre: (c.pacientes as { nombre_completo?: string } | null)?.nombre_completo ?? null,
      }))
      setPacientes(pacs)
      setCitas(cits)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="h-28 bg-white rounded-xl border border-slate-100 animate-pulse" />
        ))}
      </section>
    )
  }

  if (pacientes.length === 0 && citas.length === 0) return null

  return (
    <section className="space-y-6">
      {citas.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <CalendarDays size={13} /> Próximas citas
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {citas.map(c => (
              <Link key={c.id} href="/agenda" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.paciente_nombre ?? 'Paciente'}</p>
                  <p className="text-xs text-slate-400">
                    {format(parseISO(c.fecha), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                    {c.tipo ? ` · ${c.tipo}` : ''}
                  </p>
                </div>
                <ChevronRight size={15} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {pacientes.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Stethoscope size={13} /> Pacientes recientes
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {pacientes.map(p => (
              <Link key={p.id} href={`/expediente/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e5fa8]/10 text-[#1e5fa8] flex items-center justify-center font-semibold text-sm">
                    {(p.nombre_completo ?? 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.nombre_completo}</p>
                    {p.ultima_visita && (
                      <p className="text-xs text-slate-400">
                        {format(parseISO(p.ultima_visita), "d 'de' MMMM", { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight size={15} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
