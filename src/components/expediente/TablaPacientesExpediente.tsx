'use client'

import { ChevronsUpDown } from 'lucide-react'
import { calcularEdad } from '@/lib/patientUtils'
import { renderEnTZ } from '@/lib/dates'
import { ListaChipsMedicos } from '@/components/expediente/ChipMedico'
import type { PacienteExpediente } from '@/lib/expediente/fetchPacientes'

// Paleta de avatares por índice (mismo criterio que la card de la lista).
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

// Encabezado de columna. Las flechitas de orden son INERTES en sub-fase 2:
// el orden funcional por columna se cablea en la sub-fase 3 (junto con filtros).
function ThOrdenable({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] font-semibold uppercase tracking-wide text-[#86868b] px-4 py-3 ${className}`}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ChevronsUpDown size={12} className="text-slate-300" />
      </span>
    </th>
  )
}

// Encabezado simple (sin orden), p. ej. Médicos.
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] font-semibold uppercase tracking-wide text-[#86868b] px-4 py-3 ${className}`}>
      {children}
    </th>
  )
}

interface Props {
  pacientes: PacienteExpediente[]
}

export function TablaPacientesExpediente({ pacientes }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <ThOrdenable>Paciente</ThOrdenable>
            <ThOrdenable>Edad</ThOrdenable>
            <ThOrdenable>Expediente</ThOrdenable>
            <ThOrdenable>Fecha de ingreso</ThOrdenable>
            <Th>Médicos</Th>
          </tr>
        </thead>
        <tbody>
          {pacientes.map((p, i) => {
            const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const sexoLabel = p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : 'Otro'
            return (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                      {p.nombre.charAt(0)}{p.apellidos.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                        {p.nombre} {p.apellidos}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">{sexoLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#3d3d3f] whitespace-nowrap">
                  {edad !== null ? edad.textoElegante : '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-[#3d3d3f] whitespace-nowrap">
                  {p.numero_expediente || '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-[#3d3d3f] whitespace-nowrap">
                  {p.created_at ? renderEnTZ(p.created_at, 'd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3.5">
                  <ListaChipsMedicos medicos={p.medicos} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
