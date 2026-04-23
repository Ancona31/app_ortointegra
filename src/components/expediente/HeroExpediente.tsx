'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Calendar,
  LayoutDashboard,
} from 'lucide-react'
import type { Paciente, Consulta } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import { ultimaConsultaLabel } from '@/lib/expedienteUtils'
import ExportarExpedienteButton from './ExportarExpedienteButton'

const SEXO_LABEL: Record<Paciente['sexo'], string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

type Addendum = {
  id: string
  consulta_id: string
  contenido: string
  medico_nombre: string
  created_at: string
}

type HeroExpedienteProps = {
  paciente: Paciente
  consultas: Consulta[]
  addendums: Addendum[]
  isDoctor: boolean
  onEditar: () => void
}

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

export default function HeroExpediente({
  paciente,
  consultas,
  addendums,
  isDoctor,
  onEditar,
}: HeroExpedienteProps) {
  const edad = paciente.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento).anios
    : null
  const sexoLabel = SEXO_LABEL[paciente.sexo]
  const nombreCompleto = `${paciente.nombre} ${paciente.apellidos}`.trim()

  return (
    <div>
      <Link
        href="/expediente"
        className="inline-flex items-center gap-1 text-xs text-slate-500 mb-4 transition-colors duration-200 hover:text-slate-700"
        style={{ transitionTimingFunction: IOS_EASING }}
      >
        <ArrowLeft size={12} />
        Volver a pacientes
      </Link>

      <div className="flex items-start justify-between gap-8 mb-5">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            EXPEDIENTE CLÍNICO
          </div>
          <h1
            className="font-bold text-slate-900 mb-1.5"
            style={{ fontSize: '36px', letterSpacing: '-1px', lineHeight: '1.15' }}
          >
            {nombreCompleto}
          </h1>
          <div className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
            {edad !== null && (
              <>
                <strong className="font-medium text-slate-600">{edad} años</strong>
                <span className="text-slate-400">·</span>
              </>
            )}
            <span>{sexoLabel}</span>
            <span className="text-slate-400">·</span>
            <span>Exp. {paciente.numero_expediente || '—'}</span>
          </div>
        </div>

        {isDoctor && (
          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
              style={{ transitionTimingFunction: IOS_EASING }}
            >
              <Pencil size={14} /> Editar
            </button>
            <ExportarExpedienteButton
              paciente={paciente}
              consultas={consultas}
              addendums={addendums}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl">
        <div
          className="stat stat--clickable flex items-center gap-2 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors duration-150"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <MapPin size={14} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ÚLTIMA CONSULTA
            </div>
            <div
              className="text-[13px] font-semibold text-slate-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {ultimaConsultaLabel(consultas)}
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-100" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <Calendar size={14} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              TOTAL CONSULTAS
            </div>
            <div
              className="text-[13px] font-semibold text-slate-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {String(consultas.length)}
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-100" />

        <Link
          href={`/expediente/${paciente.id}/estado`}
          className="stat stat--clickable flex items-center gap-2 px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors duration-150"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <LayoutDashboard size={14} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              DASHBOARD
            </div>
            <div className="text-[13px] font-semibold text-slate-900">
              Ver estado →
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
