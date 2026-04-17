'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus, Users, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { calcularEdad } from '@/lib/patientUtils'

export default function SecretariaDashboard() {
  const [recientes, setRecientes] = useState<Paciente[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes')
      .select('*')
      .neq('activo', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }: { data: Paciente[] | null }) => setRecientes(data || []))
  }, [])

  const hoy = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Saludo */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] rounded-2xl px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Bienvenida</p>
        <p className="text-xl font-bold mb-1 capitalize">{hoy}</p>
        <p className="text-sm opacity-75">Consultorio Dr. Angel M. Ancona Pérez</p>
      </div>

      {/* Acción principal */}
      <Link href="/pacientes/nuevo"
        className="flex items-center justify-between p-6 bg-white rounded-2xl border-2 border-[#1e5fa8] hover:bg-blue-50 transition-all group shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1e5fa8] rounded-xl flex items-center justify-center">
            <UserPlus size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[#1a3a5c] text-lg">Registrar nuevo paciente</p>
            <p className="text-slate-500 text-sm">Datos básicos de ingreso</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-[#1e5fa8] group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Pacientes recientes */}
      {recientes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Users size={15} className="text-slate-500" />
            <h2 className="font-semibold text-slate-700 text-sm">Últimos pacientes registrados</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recientes.map(p => {
              const edad = p.fecha_nacimiento
                ? calcularEdad(p.fecha_nacimiento)
                : null
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs">
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{p.nombre} {p.apellidos}</p>
                      <p className="text-xs text-slate-400">
                        {edad !== null ? `${edad.textoElegante} · ` : ''}
                        {p.created_at ? format(parseISO(p.created_at), "d MMM yyyy", { locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                    Registrado
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
