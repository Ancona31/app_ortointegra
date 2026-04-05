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

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; btn: string; check: string }> = {
  slate:   { bg: 'bg-white',       border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-600',    btn: 'bg-slate-700 hover:bg-slate-800 text-white',   check: 'text-slate-400' },
  blue:    { bg: 'bg-white',       border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',      btn: 'bg-blue-600 hover:bg-blue-700 text-white',     check: 'text-blue-500' },
  emerald: { bg: 'bg-white',       border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',check: 'text-emerald-500' },
  violet:  { bg: 'bg-white',       border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700',  btn: 'bg-violet-600 hover:bg-violet-700 text-white',  check: 'text-violet-500' },
  amber:   { bg: 'bg-white',       border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',    btn: 'bg-amber-500 hover:bg-amber-600 text-white',   check: 'text-amber-500' },
}

const PAID_PLANS: PlanKey[] = ['individual', 'basica', 'pro', 'premium']
const ALL_PLANS: PlanKey[] = ['free', ...PAID_PLANS]

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

      if (res.status === 401) { router.push('/login?redirect=/pricing'); return }

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al iniciar el pago')
        return
      }
      if (data.url) window.location.href = data.url
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div
          className="flex items-center gap-3 mb-10 animate-slide-up"
          style={{ animationDelay: '0ms' }}
        >
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[#1a3a5c]">Planes y precios</h1>
            <p className="text-slate-500 mt-1">Elige el plan que mejor se adapta a tu practica medica</p>
          </div>
        </div>

        {/* Toggle mensual/anual — iOS segmented control */}
        <div
          className="flex justify-center mb-10 animate-slide-up"
          style={{ animationDelay: '80ms' }}
        >
          <div className="relative inline-flex items-center bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-1 shadow-sm">
            {/* Sliding indicator */}
            <div
              className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] shadow-md transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                left: interval === 'monthly' ? '4px' : '50%',
                width: 'calc(50% - 4px)',
              }}
            />
            <button
              onClick={() => setInterval('monthly')}
              className={`relative z-10 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-300 ${
                interval === 'monthly' ? 'text-white' : 'text-slate-500'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`relative z-10 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-300 flex items-center gap-2 ${
                interval === 'annual' ? 'text-white' : 'text-slate-500'
              }`}
            >
              Anual
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-all duration-300 ${
                interval === 'annual'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Cards de planes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">

          {ALL_PLANS.map((planKey, idx) => {
            const plan = PLANS[planKey]
            const c = COLOR_MAP[plan.color]
            const isFree = planKey === 'free'
            const precio = isFree
              ? 0
              : interval === 'monthly'
                ? plan.precio_mensual
                : Math.round(plan.precio_anual / 12)
            const isLoading = loadingPlan === planKey

            return (
              <div
                key={planKey}
                className={`
                  rounded-2xl border-2 ${c.border} ${c.bg} p-5 flex flex-col gap-4 relative
                  backdrop-blur-xl shadow-sm
                  hover:shadow-lg hover:-translate-y-1
                  active:scale-[0.98]
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  animate-slide-up
                  ${plan.badge ? 'ring-2 ring-violet-400 ring-offset-2' : ''}
                `}
                style={{ animationDelay: `${160 + idx * 80}ms` }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-600 to-violet-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <div className="transition-transform duration-300 hover:scale-110">
                    {PLAN_ICONS[planKey]}
                  </div>
                  <span className="font-bold text-slate-800">{plan.nombre}</span>
                </div>

                {/* Precio con transición */}
                <div className="relative min-h-[3.5rem]">
                  <div
                    key={`${planKey}-${interval}`}
                    className="animate-slide-up"
                    style={{ animationDuration: '350ms' }}
                  >
                    <span className="text-3xl font-bold text-slate-800">
                      {isFree ? '$0' : formatPrecio(precio)}
                    </span>
                    <span className="text-slate-400 text-sm"> / mes</span>
                    {!isFree && interval === 'annual' && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                        {formatPrecio(plan.precio_anual)}/año · 2 meses gratis
                      </p>
                    )}
                  </div>
                </div>

                {!isFree && (
                  <div className="flex gap-3 text-xs text-slate-400 font-medium">
                    <span>{plan.max_medicos} medico{plan.max_medicos > 1 ? 's' : ''}</span>
                    {plan.max_secretarias > 0 && <span>· {plan.max_secretarias} asistente{plan.max_secretarias > 1 ? 's' : ''}</span>}
                  </div>
                )}

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f, fi) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <Check size={14} className={`mt-0.5 flex-shrink-0 ${c.check}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={isLoading}
                  className={`
                    w-full py-2.5 rounded-xl text-sm font-semibold
                    transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
                    active:scale-[0.96]
                    flex items-center justify-center gap-2 disabled:opacity-70
                    ${c.btn}
                  `}
                >
                  {isLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Redirigiendo...</>
                    : isFree ? 'Empezar gratis' : 'Elegir plan'
                  }
                </button>
              </div>
            )
          })}
        </div>

        {/* Nota al pie */}
        <p
          className="text-center text-xs text-slate-400 mt-8 animate-slide-up"
          style={{ animationDelay: '600ms' }}
        >
          Todos los precios en MXN. IVA no incluido. Puedes cancelar en cualquier momento.
          Los pagos son procesados de forma segura por Stripe.
        </p>
      </div>
    </div>
  )
}
