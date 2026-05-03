'use client'

import { useMemo } from 'react'
import { Plus, Layers, Clock, Calendar, LayoutDashboard, Activity } from 'lucide-react'
import type { Paciente, Consulta, Diagnostico } from '@/types'
import ExpedienteCard from './ExpedienteCard'
import { useStatsLabs } from '@/hooks/useStatsLabs'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import {
  ultimaConsultaLabel,
  ultimaConsultaFecha,
  formatFechaRelativaFutura,
  formatFechaCompleta,
} from '@/lib/expedienteUtils'

function labsSubtitle(
  analitosTracked: number,
  documentosCount: number,
  isLoading: boolean,
  hasError: boolean,
): string {
  if (isLoading) return 'Cargando…'
  if (hasError) return 'Mediciones longitudinales y archivos clínicos'
  if (analitosTracked === 0 && documentosCount === 0) {
    return 'Sin mediciones ni documentos'
  }
  const analitosTxt =
    analitosTracked > 0
      ? `${analitosTracked} ${analitosTracked === 1 ? 'analito' : 'analitos'}`
      : ''
  const docsTxt =
    documentosCount > 0
      ? `${documentosCount} ${documentosCount === 1 ? 'documento' : 'documentos'}`
      : ''
  if (analitosTracked > 0 && documentosCount > 0) {
    return `${analitosTxt} \u00B7 ${docsTxt}`
  }
  if (analitosTracked > 0) {
    return `${analitosTxt} ${analitosTracked === 1 ? 'rastreado' : 'rastreados'}`
  }
  return `${docsTxt} ${documentosCount === 1 ? 'clínico' : 'clínicos'}`
}

export type ProximaCita = {
  id: string
  start_time: string
  end_time: string
  title: string
  status: string
}

type ExpedienteCardsGridProps = {
  paciente: Paciente
  consultas: Consulta[]
  proximaCita: ProximaCita | null
  isDoctor: boolean
}

export default function ExpedienteCardsGrid({
  paciente,
  consultas,
  proximaCita,
  isDoctor,
}: ExpedienteCardsGridProps) {
  const { diagnosticosCard, fechaDiagnostico } = useMemo(() => {
    const ordenadas = [...consultas].sort((a, b) => b.fecha.localeCompare(a.fecha))
    const conDx = ordenadas.find(
      (c) =>
        Array.isArray(c.diagnosticos) &&
        c.diagnosticos.length > 0 &&
        !!c.diagnosticos[0]?.descripcion,
    )
    if (!conDx?.diagnosticos?.length) {
      return {
        diagnosticosCard: [] as Diagnostico[],
        fechaDiagnostico: null as string | null,
      }
    }
    return {
      diagnosticosCard: conDx.diagnosticos.filter(d => d.descripcion?.trim()),
      fechaDiagnostico: ultimaConsultaFecha([conDx]),
    }
  }, [consultas])

  const MAX_TITLE_LEN = 72
  const formatDx = (d: Diagnostico): string =>
    d.codigo_cie10 ? `${d.codigo_cie10} · ${d.descripcion}` : d.descripcion
  const truncate = (s: string): string =>
    s.length > MAX_TITLE_LEN ? `${s.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…` : s

  let diagnosticoTitle = 'Sin diagnóstico registrado'
  let diagnosticoSubtitle: string | undefined
  if (diagnosticosCard.length >= 1) {
    diagnosticoTitle = truncate(formatDx(diagnosticosCard[0]))
    const extra = diagnosticosCard.length - 1
    if (extra > 0) {
      diagnosticoSubtitle = fechaDiagnostico
        ? `+${extra} más · ${fechaDiagnostico}`
        : `+${extra} diagnóstico${extra === 1 ? '' : 's'} más`
    } else {
      diagnosticoSubtitle = fechaDiagnostico ? `Actualizado el ${fechaDiagnostico}` : undefined
    }
  }

  const fechaUltimaConsulta = ultimaConsultaFecha(consultas)

  const { stats, isLoading: isStatsLoading, error: statsError } = useStatsLabs(paciente.id)
  const medicionesSubtitle = labsSubtitle(
    stats.analitosTracked,
    stats.documentosCount,
    isStatsLoading,
    !!statsError,
  )

  // Fase 8.2: si la suscripción está bloqueada, la card "Nueva consulta"
  // pasa de Link a button con onClick que abre el BloqueoFeatureModal.
  // ExpedienteCard renderiza Link si recibe `href`, button si recibe `onClick`.
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const nuevaConsultaProps = subState.isBlocked
    ? { onClick: openBloqueoModal }
    : { href: `/expediente/${paciente.id}/nueva-nota` }

  return (
    <div
      className="grid gap-3 mb-8"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
    >
      {isDoctor && (
        <ExpedienteCard
          label="ACCIÓN"
          title="Nueva consulta"
          subtitle="Iniciar consulta clínica con este paciente"
          icon={Plus}
          iconColor=""
          variant="cta"
          {...nuevaConsultaProps}
        />
      )}

      <ExpedienteCard
        label="DIAGNÓSTICO"
        title={diagnosticoTitle}
        subtitle={diagnosticoSubtitle}
        icon={Layers}
        iconColor="#af52de"
      />

      <ExpedienteCard
        label="ÚLTIMA VISITA"
        title={ultimaConsultaLabel(consultas)}
        subtitle={fechaUltimaConsulta ?? undefined}
        icon={Clock}
        iconColor="#14b8a6"
      />

      <ExpedienteCard
        label="PRÓXIMA CITA"
        title={proximaCita ? formatFechaRelativaFutura(proximaCita.start_time) : 'Sin cita programada'}
        subtitle={proximaCita ? formatFechaCompleta(proximaCita.start_time) : 'Agendar nueva cita'}
        icon={Calendar}
        iconColor="#ff9500"
        href="/agenda"
      />

      <ExpedienteCard
        label="DASHBOARD"
        title="Estado del paciente"
        subtitle="Datos antropométricos, labs, gráficas, antecedentes"
        icon={LayoutDashboard}
        iconColor="#6366f1"
        href={`/expediente/${paciente.id}/estado`}
      />

      <ExpedienteCard
        label="MEDICIONES & DOCUMENTOS"
        title="Mediciones y Documentos"
        subtitle={medicionesSubtitle}
        icon={Activity}
        iconColor="#0d9488"
        href={`/expediente/${paciente.id}/laboratorios`}
      />
    </div>
  )
}
