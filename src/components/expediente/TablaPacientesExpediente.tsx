'use client'

import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { calcularEdad } from '@/lib/patientUtils'
import { renderEnTZ } from '@/lib/dates'
import { ListaChipsMedicos } from '@/components/expediente/ChipMedico'
import type { PacienteExpediente, OrdenColumna, OrdenDireccion } from '@/lib/expediente/fetchPacientes'

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

interface Props {
  pacientes: PacienteExpediente[]
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
}

// Encabezado ordenable: clic dispara onOrden(col). La flechita refleja si esta
// columna es la activa y en qué dirección.
function ThOrdenable({
  col,
  orden,
  direccion,
  onOrden,
  children,
}: {
  col: OrdenColumna
  orden: OrdenColumna
  direccion: OrdenDireccion
  onOrden: (col: OrdenColumna) => void
  children: React.ReactNode
}) {
  const activa = orden === col
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-[#86868b] px-4 py-3">
      <button
        type="button"
        onClick={() => onOrden(col)}
        className="inline-flex items-center gap-1 hover:text-[#1e5fa8] transition-colors"
      >
        {children}
        {activa ? (
          direccion === 'asc'
            ? <ChevronUp size={12} className="text-[#1e5fa8]" />
            : <ChevronDown size={12} className="text-[#1e5fa8]" />
        ) : (
          <ChevronsUpDown size={12} className="text-slate-300" />
        )}
      </button>
    </th>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-[#86868b] px-4 py-3">
      {children}
    </th>
  )
}

export function TablaPacientesExpediente({ pacientes, orden, direccion, onOrden }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <ThOrdenable col="apellidos" orden={orden} direccion={direccion} onOrden={onOrden}>Paciente</ThOrdenable>
            <ThOrdenable col="fecha_nacimiento" orden={orden} direccion={direccion} onOrden={onOrden}>Edad</ThOrdenable>
            <ThOrdenable col="numero_expediente" orden={orden} direccion={direccion} onOrden={onOrden}>Expediente</ThOrdenable>
            <ThOrdenable col="created_at" orden={orden} direccion={direccion} onOrden={onOrden}>Fecha de ingreso</ThOrdenable>
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
