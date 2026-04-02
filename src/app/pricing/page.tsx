'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, Building2, Star, Crown, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { PLANS, formatPrecio, type PlanKey, type BillingInterval } from '@/lib/plans'

const PLAN_ICONS: Record<PlanKey, React.ReactNode> = {
  free:       <Zap size={22} className="text-slate-500" />,
  individual: <Star size={22} className="text-blue-600" />,
  basica:     <Building2 size={22} className="text-emerald-600" />,
  pro:        <Building2 size={22} className="text-violet-600" />,
  premium:    <Crown size={22} className="text-amber-600" />,
}

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; btn: string }> = {
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-600',    btn: 'bg-slate-700 hover:bg-slate-800 text-white' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',      btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',btn: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700',  btn: 'bg-violet-600 hover:bg-violet-700 text-white' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',    btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
}

const PAID_PLANS: PlanKey[] = ['individual', 'basica', 'pro', 'premium']

export default function PricingPage() {
  const router = useRouter()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleSelectPlan(planKey: PlanKey) {
    if (planKey === 'free') { router.push('/login'); return }
    setLoadingPlan(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, interval }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Si no está autenticado, redirigir al login
        if (res.status === 401) { router.push('/login?redirect=/pricing'); return }
        alert(data.error || 'Error al iniciar el pago')
        return
      }
      if (data.url) window.location.href = data.url
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-10">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[#1a3a5c]">Planes y precios</h1>
            <p className="text-slate-500 mt-1">Elige el plan que mejor se adapta a tu práctica médica</p>
          </div>
        </div>

        {/* Toggle mensual/anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                interval === 'monthly' ? 'bg-[#1a3a5c] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                interval === 'annual' ? 'bg-[#1a3a5c] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Anual
              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">2 meses gratis</span>
            </button>
          </div>
        </div>

        {/* Cards de planes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-start">

          {/* Plan Free */}
          {(() => {
            const plan = PLANS.free
            const c = COLOR_MAP[plan.color]
            return (
              <div key="free" className={`rounded-2xl border-2 ${c.border} ${c.bg} p-5 flex flex-col gap-4`}>
                <div className="flex items-center gap-2">
                  {PLAN_ICONS.free}
                  <span className="font-bold text-slate-700">{plan.nombre}</span>
                </div>
                <div>
                  <span className="text-3xl font-bold text-slate-800">$0</span>
                  <span className="text-slate-400 text-sm"> / mes</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectPlan('free')}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${c.btn}`}
                >
                  Empezar gratis
                </button>
              </div>
            )
          })()}

          {/* Planes de pago */}
          {PAID_PLANS.map(planKey => {
            const plan = PLANS[planKey]
            const c = COLOR_MAP[plan.color]
            const precio = interval === 'monthly'
              ? plan.precio_mensual
              : Math.round(plan.precio_anual / 12)
            const isLoading = loadingPlan === planKey

            return (
              <div
                key={planKey}
                className={`rounded-2xl border-2 ${c.border} ${c.bg} p-5 flex flex-col gap-4 relative ${
                  plan.badge ? 'ring-2 ring-violet-400 ring-offset-1' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {PLAN_ICONS[planKey]}
                  <span className="font-bold text-slate-800 text-sm">{plan.nombre}</span>
                </div>

                <div>
                  <span className="text-3xl font-bold text-slate-800">{formatPrecio(precio)}</span>
                  <span className="text-slate-400 text-sm"> / mes</span>
                  {interval === 'annual' && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      {formatPrecio(plan.precio_anual)}/año
                    </p>
                  )}
                </div>

                <div className="flex gap-3 text-xs text-slate-500">
                  <span>{plan.max_medicos} médico{plan.max_medicos > 1 ? 's' : ''}</span>
                  {plan.max_secretarias > 0 && <span>· {plan.max_secretarias} secretaria{plan.max_secretarias > 1 ? 's' : ''}</span>}
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={14} className={`mt-0.5 flex-shrink-0 text-${plan.color}-500`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={isLoading}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${c.btn}`}
                >
                  {isLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Redirigiendo...</>
                    : 'Elegir plan'
                  }
                </button>
              </div>
            )
          })}
        </div>

        {/* Nota al pie */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Todos los precios en MXN. IVA no incluido. Puedes cancelar en cualquier momento.
          Los pagos son procesados de forma segura por Stripe.
        </p>
      </div>
    </div>
  )
}
