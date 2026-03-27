'use client'

import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { AlertTriangle, Pencil } from 'lucide-react'
import Link from 'next/link'

interface Props {
  paciente: Paciente
  id: string
  isDoctor: boolean
}

export default function TarjetaPaciente({ paciente, id, isDoctor }: Props) {
  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-[#1a3a5c] px-6 py-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
          {paciente.nombre.charAt(0)}{paciente.apellidos.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-tight">{paciente.nombre} {paciente.apellidos}</h2>
          <p className="text-blue-200 text-sm mt-0.5">
            {edad !== null && `${edad} años · `}
            {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Otro'}
            {paciente.numero_expediente && ` · Exp. ${paciente.numero_expediente}`}
          </p>
        </div>
        {isDoctor && (
          <Link href={`/expediente/${id}/editar`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0">
            <Pencil size={13} /> Editar
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
        {[
          { label: 'Peso', value: paciente.peso_kg ? `${paciente.peso_kg} kg` : '—' },
          { label: 'Talla', value: paciente.talla_cm ? `${paciente.talla_cm} cm` : '—' },
          { label: 'IMC', value: paciente.imc ? `${paciente.imc} kg/m²` : '—' },
          { label: 'Teléfono', value: paciente.telefono || '—' },
        ].map(item => (
          <div key={item.label} className="px-4 py-3">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
      {(paciente.ant_patologicos || paciente.alergias || paciente.medicamentos_actuales || paciente.ant_quirurgicos) && (
        <div className="px-5 py-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {paciente.alergias && (
            <div className="sm:col-span-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-600">Alergias</p>
                <p className="text-sm text-red-700">{paciente.alergias}</p>
              </div>
            </div>
          )}
          {paciente.ant_patologicos && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Antecedentes patológicos</p>
              <p className="text-sm text-slate-600">{paciente.ant_patologicos}</p>
            </div>
          )}
          {paciente.ant_quirurgicos && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Antecedentes quirúrgicos</p>
              <p className="text-sm text-slate-600">{paciente.ant_quirurgicos}</p>
            </div>
          )}
          {paciente.medicamentos_actuales && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Medicamentos actuales</p>
              <p className="text-sm text-slate-600">{paciente.medicamentos_actuales}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
