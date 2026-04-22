'use client'

import Link from 'next/link'
import { ArrowLeft, Edit3, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Paciente } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import type { StatsLabs } from '@/hooks/useStatsLabs'

const SEXO_LABEL: Record<Paciente['sexo'], string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type HeroLabsProps = {
  paciente: Paciente
  stats: StatsLabs
  isStatsLoading: boolean
  isDoctor: boolean
  onEditar: () => void
  onExportar: () => void
}

export default function HeroLabs({
  paciente,
  stats,
  isStatsLoading,
  isDoctor,
  onEditar,
  onExportar,
}: HeroLabsProps) {
  const edad = paciente.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento).anios
    : null
  const sexoLabel = SEXO_LABEL[paciente.sexo]
  const nombreCompleto = `${paciente.nombre} ${paciente.apellidos}`.trim()

  const fechaNacLabel = paciente.fecha_nacimiento
    ? format(parseISO(paciente.fecha_nacimiento), "d MMM yyyy", { locale: es })
    : null

  const ultimaMedicionLabel = isStatsLoading
    ? '—'
    : stats.ultimaMedicionISO
      ? format(parseISO(stats.ultimaMedicionISO), "d MMM yyyy", { locale: es })
      : '—'

  const analitosLabel = isStatsLoading ? '—' : String(stats.analitosTracked)

  return (
    <div>
      <Link
        href={`/expediente/${paciente.id}`}
        className="inline-flex items-center gap-1 text-xs text-slate-500 mb-4 transition-colors duration-200 hover:text-slate-700"
        style={{ transitionTimingFunction: IOS_EASING }}
      >
        <ArrowLeft size={12} />
        Volver al expediente
      </Link>

      <div className="flex items-start justify-between gap-8 mb-5">
        <div className="flex-1 min-w-0">
          <span
            className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full mb-2"
            style={{
              color: 'var(--cp)',
              background: 'color-mix(in srgb, var(--cp) 10%, transparent)',
            }}
          >
            Mediciones &amp; documentos
          </span>
          <h1
            className="font-bold text-slate-900 mb-1.5"
            style={{ fontSize: '36px', letterSpacing: '-0.022em', lineHeight: '1.15' }}
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
            {fechaNacLabel && (
              <>
                <span className="text-slate-400">·</span>
                <span>Nac. {fechaNacLabel}</span>
              </>
            )}
            {paciente.numero_expediente && (
              <>
                <span className="text-slate-400">·</span>
                <span>Exp. {paciente.numero_expediente}</span>
              </>
            )}
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
              <Edit3 size={14} /> Editar paciente
            </button>
            <button
              type="button"
              onClick={onExportar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
              style={{ transitionTimingFunction: IOS_EASING }}
            >
              <Download size={14} /> Exportar
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2 px-2 py-0.5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ANALITOS RASTREADOS
            </div>
            <div
              className="text-[13px] font-semibold text-slate-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {analitosLabel}
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-100" />

        <div className="flex items-center gap-2 px-2 py-0.5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ÚLTIMA MEDICIÓN
            </div>
            <div
              className="text-[13px] font-semibold text-slate-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {ultimaMedicionLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
