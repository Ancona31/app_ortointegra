'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { PLANS, formatPrecio, type PlanKey } from '@/lib/plans'
import { CheckCircle, CreditCard, Loader2, ExternalLink, AlertTriangle, Zap, Users, UserCheck, FileText, ArrowUpRight } from 'lucide-react'
import { BillingSkeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Suspense } from 'react'

type ClinicaInfo = {
  plan: PlanKey
  suscripcion_estado: string
  trial_ends_at: string | null
  suscripcion_ends_at: string | null
  stripe_customer_id: string | null
  max_medicos: number
  max_secretarias: number
  max_pacientes: number | null
}

type UsageInfo = {
  medicos: number
  secretarias: number
  pacientes: number
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free:      { label: 'Plan gratuito',   color: 'bg-slate-100 text-slate-600',    icon: <Zap size={14} /> },
  trial:     { label: 'Prueba gratuita', color: 'bg-blue-100 text-blue-700',      icon: <Zap size={14} /> },
  activo:    { label: 'Activo',          color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle size={14} /> },
  vencido:   { label: 'Pago pendiente',  color: 'bg-red-100 text-red-700',        icon: <AlertTriangle size={14} /> },
  cancelado: { label: 'Cancelado',       color: 'bg-slate-100 text-slate-500',    icon: <AlertTriangle size={14} /> },
}

function BillingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { profile, loading: loadingProfile } = useProfile()
  const [clinica, setClinica] = useState<ClinicaInfo | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingPortal, setOpeningPortal] = useState(false)
  const success = searchParams.get('success') === 'true'
  const newPlan = searchParams.get('plan') as PlanKey | null

  useEffect(() => {
    if (!loadingProfile && profile && !['admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    if (!profile?.clinica_id) return
    const supabase = createClient()

    async function load() {
      const [{ data: c }, { data: medicos }, { data: secretarias }, { data: pacientes }] = await Promise.all([
        supabase.from('clinicas').select(
          'plan, suscripcion_estado, trial_ends_at, suscripcion_ends_at, stripe_customer_id, max_medicos, max_secretarias, max_pacientes, tipo'
        ).eq('id', profile!.clinica_id!).single(),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('clinica_id', profile!.clinica_id!).eq('role', 'medico'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('clinica_id', profile!.clinica_id!).eq('role', 'secretaria'),
        supabase.from('pacientes').select('id', { count: 'exact' }).eq('clinica_id', profile!.clinica_id!),
      ])
      setClinica(c as any)
      // Independiente: el admin ES el médico → contar como 1
      const esMedicoCount = (c as any)?.tipo === 'independiente'
        ? 1
        : (medicos?.length ?? 0)
      setUsage({
        medicos: esMedicoCount,
        secretarias: secretarias?.length ?? 0,
        pacientes: pacientes?.length ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [profile])

  async function abrirPortal() {
    setOpeningPortal(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    setOpeningPortal(false)
    if (data.url) window.location.href = data.url
    else alert(data.error || 'Error al abrir el portal')
  }

  if (loading || loadingProfile) return <BillingSkeleton />

  if (!clinica) return null

  const plan = PLANS[clinica.plan]
  const estado = ESTADO_CONFIG[clinica.suscripcion_estado] ?? ESTADO_CONFIG.free
  const tieneStripe = !!clinica.stripe_customer_id

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">

      <div>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Cuenta</p>
        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Facturación</h1>
        <p className="text-sm text-[#86868b] mt-0.5">Gestiona tu suscripción y plan</p>
      </div>

      {/* Banner de éxito */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">¡Suscripción activada!</p>
            <p className="text-sm text-emerald-700">
              Tu plan {newPlan ? PLANS[newPlan]?.nombre : ''} está activo. Bienvenido a Spinus® Pro.
            </p>
          </div>
        </div>
      )}

      {/* Banner de pago vencido */}
      {clinica.suscripcion_estado === 'vencido' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Pago pendiente</p>
            <p className="text-sm text-red-700">Hay un problema con tu método de pago. Actualízalo para mantener el acceso.</p>
            <button
              onClick={abrirPortal}
              disabled={openingPortal}
              className="mt-2 text-sm font-medium text-red-700 underline hover:no-underline"
            >
              {openingPortal ? 'Abriendo...' : 'Actualizar método de pago →'}
            </button>
          </div>
        </div>
      )}

      {/* Card del plan actual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-slate-800">{plan.nombre}</h2>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${estado.color}`}>
                  {estado.icon} {estado.label}
                </span>
              </div>
              {clinica.plan !== 'free' && (
                <p className="text-2xl font-bold text-[#1a3a5c]">
                  {formatPrecio(plan.precio_mensual)}<span className="text-sm font-normal text-slate-400"> / mes</span>
                </p>
              )}
              {clinica.suscripcion_ends_at && (
                <p className="text-xs text-slate-400 mt-1">
                  Próxima renovación: {format(parseISO(clinica.suscripcion_ends_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              )}
              {clinica.suscripcion_estado === 'trial' && clinica.trial_ends_at && (
                <p className="text-xs text-blue-600 mt-1">
                  Trial hasta: {format(parseISO(clinica.trial_ends_at), "dd 'de' MMMM", { locale: es })}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {tieneStripe && (
                <button
                  onClick={abrirPortal}
                  disabled={openingPortal}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1a3a5c] text-white rounded-xl text-sm font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-60"
                >
                  {openingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  Gestionar
                </button>
              )}
              {clinica.plan === 'free' || clinica.suscripcion_estado !== 'activo' ? (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
                >
                  <ArrowUpRight size={14} /> Actualizar plan
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Uso actual */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Uso actual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UsageCard
              icon={<Users size={18} className="text-blue-600" />}
              label="Médicos"
              usado={usage?.medicos ?? 0}
              limite={clinica.max_medicos}
            />
            <UsageCard
              icon={<UserCheck size={18} className="text-emerald-600" />}
              label="Asistentes"
              usado={usage?.secretarias ?? 0}
              limite={clinica.max_secretarias}
            />
            <UsageCard
              icon={<FileText size={18} className="text-violet-600" />}
              label="Pacientes"
              usado={usage?.pacientes ?? 0}
              limite={clinica.max_pacientes}
            />
          </div>
        </div>
      </div>

      {/* Features del plan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Incluido en tu plan</h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {plan.features.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        {clinica.plan !== 'premium' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link href="/pricing" className="text-sm text-[#1e5fa8] hover:underline font-medium flex items-center gap-1">
              Ver todos los planes y funcionalidades <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </div>

      {/* Seguridad de pagos */}
      <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1.5">
        <CreditCard size={12} /> Pagos procesados de forma segura por Stripe. Spinus® no almacena datos de tarjetas.
      </p>

    </div>
  )
}

function UsageCard({ icon, label, usado, limite }: {
  icon: React.ReactNode
  label: string
  usado: number
  limite: number | null
}) {
  const ilimitado = limite === null || limite === -1
  const porcentaje = ilimitado ? 0 : Math.min((usado / (limite || 1)) * 100, 100)
  const enLimite = !ilimitado && usado >= (limite ?? 0)

  return (
    <div className="bg-slate-50/80 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">
        {usado}
        <span className="text-sm font-normal text-slate-400">
          /{ilimitado ? '∞' : limite}
        </span>
      </p>
      {!ilimitado && (
        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${enLimite ? 'bg-red-500' : 'bg-[#1e5fa8]'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  )
}
