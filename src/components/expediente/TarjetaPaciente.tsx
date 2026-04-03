'use client'

import { useState } from 'react'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { AlertTriangle, Pencil, ChevronDown, Pill, Scissors, Users, Stethoscope, Phone } from 'lucide-react'
import Link from 'next/link'

interface Props {
  paciente: Paciente
  id: string
  isDoctor: boolean
}

export default function TarjetaPaciente({ paciente, id, isDoctor }: Props) {
  const [antExpanded, setAntExpanded] = useState(false)

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  const tieneAntecedentes = !!(
    paciente.ant_patologicos ||
    paciente.ant_quirurgicos ||
    paciente.ant_familiares ||
    paciente.medicamentos_actuales
  )

  const antecedentes = [
    { key: 'ant_patologicos', label: 'Patológicos',  icon: Stethoscope, gradient: 'from-blue-400 to-blue-600',    value: paciente.ant_patologicos },
    { key: 'ant_quirurgicos', label: 'Quirúrgicos',  icon: Scissors,    gradient: 'from-amber-400 to-amber-600',  value: paciente.ant_quirurgicos },
    { key: 'ant_familiares',  label: 'Familiares',   icon: Users,       gradient: 'from-violet-400 to-violet-600', value: (paciente as any).ant_familiares },
    { key: 'medicamentos',    label: 'Medicamentos', icon: Pill,        gradient: 'from-emerald-400 to-emerald-600', value: paciente.medicamentos_actuales },
  ].filter(a => a.value)

  const stats = [
    { label: 'Peso',     value: paciente.peso_kg  ? `${paciente.peso_kg} kg`   : '—' },
    { label: 'Talla',    value: paciente.talla_cm ? `${paciente.talla_cm} cm`  : '—' },
    { label: 'IMC',      value: paciente.imc      ? `${paciente.imc}`          : '—', unit: 'kg/m²' },
    { label: 'Teléfono', value: paciente.telefono || '—', icon: Phone },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

      {/* ── Header con gradiente ── */}
      <div className="bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] px-6 py-5 flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-inner">
          {paciente.nombre.charAt(0)}{paciente.apellidos.charAt(0)}
        </div>

        {/* Nombre e info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-tight tracking-tight">
            {paciente.nombre} {paciente.apellidos}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {edad !== null && (
              <span className="text-[11px] font-semibold bg-white/15 text-white px-2 py-0.5 rounded-full">
                {edad} años
              </span>
            )}
            <span className="text-[11px] font-semibold bg-white/15 text-white px-2 py-0.5 rounded-full">
              {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Otro'}
            </span>
            {paciente.numero_expediente && (
              <span className="text-[11px] font-semibold bg-white/15 text-white px-2 py-0.5 rounded-full">
                Exp. {paciente.numero_expediente}
              </span>
            )}
          </div>
        </div>

        {/* Botón editar */}
        {isDoctor && (
          <Link
            href={`/expediente/${id}/editar`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-xl text-xs font-semibold transition-all duration-150 flex-shrink-0"
          >
            <Pencil size={12} /> Editar
          </Link>
        )}
      </div>

      {/* ── Alergias ── */}
      {paciente.alergias && (
        <div className="flex items-center gap-3 px-6 py-3" style={{ backgroundColor: '#EF5350' }}>
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Alergias</p>
            <p className="text-sm font-semibold text-white leading-snug">{paciente.alergias}</p>
          </div>
        </div>
      )}

      {/* ── Antropometría ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-t border-slate-100">
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-3.5">
            <p className="text-[9px] font-semibold text-[#86868b] uppercase tracking-widest">{s.label}</p>
            <p className="text-sm font-bold text-[#1d1d1f] mt-1.5 leading-none tabular-nums">
              {s.value}
            </p>
            {s.unit && s.value !== '—' && (
              <p className="text-[9px] text-[#86868b] mt-0.5">{s.unit}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Antecedentes colapsables ── */}
      {tieneAntecedentes && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setAntExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50/60 transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#3d3d3f]">Antecedentes médicos</span>
              <span className="text-[9px] font-bold bg-slate-100 text-[#86868b] w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                {antecedentes.length}
              </span>
            </div>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform duration-200 ${antExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {antExpanded && (
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {antecedentes.map(({ key, label, icon: Icon, gradient, value }) => (
                <div key={key} className="flex items-start gap-2.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100/80">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={11} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">{label}</p>
                    <p className="text-[11px] text-[#1d1d1f] mt-0.5 leading-snug">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
