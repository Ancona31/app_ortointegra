'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica } from '@/lib/permissions'
import { PLANS, formatPrecio, type PlanKey } from '@/lib/plans'
import { CheckCircle, Check, CreditCard, Loader2, ExternalLink, AlertTriangle, Zap, ArrowUpRight, Sparkles } from 'lucide-react'
import { BillingSkeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Suspense } from 'react'
import PestanasAdministracion from '@/components/admin/PestanasAdministracion'

type ClinicaInfo = {
  plan: PlanKey
  suscripcion_estado: string
  trial_ends_at: string | null
  suscripcion_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  es_vip_grant: boolean
  max_medicos: number
  max_secretarias: number
  max_pacientes: number | null
}

type UsageInfo = {
  medicos: number
  secretarias: number
  pacientes: number
}

/* Rediseño B10: cada estado es una etiqueta del kit (CALMA §11), con su icono de 14. */
const ESTADO_CONFIG: Record<string, { label: string; etq: string; icon: React.ReactNode }> = {
  free:      { label: 'Plan gratuito',   etq: 'bg-sup2 text-tinta2', icon: <Zap aria-hidden="true" /> },
  trial:     { label: 'Prueba gratuita', etq: 'k-etq-tonal',         icon: <Zap aria-hidden="true" /> },
  activo:    { label: 'Activo',          etq: 'k-etq-ok',            icon: <CheckCircle aria-hidden="true" /> },
  vencido:   { label: 'Pago pendiente',  etq: 'k-etq-mal',           icon: <AlertTriangle aria-hidden="true" /> },
  cancelado: { label: 'Cancelado',       etq: 'bg-sup2 text-tinta2', icon: <AlertTriangle aria-hidden="true" /> },
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
    if (!loadingProfile && profile && !canManageClinica(profile)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    if (!profile?.clinica_id) return
    const supabase = createClient()

    async function load() {
      const [{ data: c }, { data: medicos }, { data: secretarias }, { data: pacientes }] = await Promise.all([
        supabase.from('clinicas').select(
          'plan, suscripcion_estado, trial_ends_at, suscripcion_ends_at, stripe_customer_id, stripe_subscription_id, es_vip_grant, max_medicos, max_secretarias, max_pacientes, tipo'
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
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[abrirPortal] Error response:', res.status, data)
        alert(data.message ?? data.error ?? 'No se pudo abrir el portal de Stripe. Intenta de nuevo.')
        return
      }
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Error al abrir el portal')
    } catch (err) {
      console.error('[abrirPortal] Error:', err)
      alert('No se pudo abrir el portal de Stripe. Intenta de nuevo.')
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading || loadingProfile) return <BillingSkeleton />

  if (!clinica) return null

  const plan = PLANS[clinica.plan]
  const estado = ESTADO_CONFIG[clinica.suscripcion_estado] ?? ESTADO_CONFIG.free
  const tieneStripe = !!clinica.stripe_customer_id
  const esVip = clinica.es_vip_grant
  const tieneSuscripcionStripe = !!clinica.stripe_subscription_id

  /* Rediseño B10 (maqueta `admin`, vista 2): una tarjeta del plan con el uso
     dentro, otra con lo incluido, y avisos como franjas tintadas. Textos de
     hoy salvo «funciones» y «Prueba» (CALMA §23.10). Sin lógica nueva: los
     mismos estados, los mismos botones y los mismos destinos. */
  return (
    <div className="mx-auto max-w-[840px]">
      {/* B4: Estadísticas · Usuarios · Facturación (CALMA §30.2). */}
      <PestanasAdministracion />

      <div>
        <p className="k-t-rotulo">Cuenta</p>
        <h1 className="k-t-pantalla mt-0.5">Facturación</h1>
        <p className="k-t-sec mt-0.5">Gestiona tu suscripción y plan</p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* Banner de éxito */}
        {success && (
          <div role="status" className="flex items-start gap-3 rounded-[var(--r-tarjeta)] bg-ok-fondo px-4 py-3">
            <CheckCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ok-tinta" />
            <div>
              <p className="text-[15px] font-semibold leading-5 text-ok-tinta">¡Suscripción activada!</p>
              <p className="text-[14px] leading-5 text-ok-tinta">
                Tu plan {newPlan ? PLANS[newPlan]?.nombre : ''} está activo. Bienvenido a Spinus® Pro.
              </p>
            </div>
          </div>
        )}

        {/* Banner de pago vencido */}
        {clinica.suscripcion_estado === 'vencido' && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--r-tarjeta)] bg-mal-fondo px-4 py-3">
            <AlertTriangle size={20} aria-hidden="true" className="shrink-0 text-mal-tinta" />
            <div className="min-w-0 flex-1 basis-[220px]">
              <p className="text-[15px] font-semibold leading-5 text-mal-tinta">Pago pendiente</p>
              <p className="text-[14px] leading-5 text-mal-tinta">Hay un problema con tu método de pago. Actualízalo para mantener el acceso.</p>
            </div>
            <button type="button" onClick={abrirPortal} disabled={openingPortal} className="k-b bg-sup text-mal-tinta">
              {openingPortal ? 'Abriendo...' : 'Actualizar método de pago →'}
            </button>
          </div>
        )}

        {/* Tarjeta del plan actual */}
        <section className="k-tarjeta esc:p-5" aria-labelledby="billing-plan">
          {esVip ? (
            <PlanVip tieneSuscripcionStripe={tieneSuscripcionStripe} openingPortal={openingPortal} onPortal={abrirPortal} />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="billing-plan" className="k-t-seccion">{plan.nombre}</h2>
                  <span className={`k-etq ${estado.etq}`}>{estado.icon} {estado.label}</span>
                </div>
                {clinica.plan !== 'free' && (
                  <p className="k-num mt-1 text-[22px] font-bold leading-7 text-tinta">
                    {formatPrecio(plan.precio_mensual)}<span className="text-[14px] font-normal text-tinta2"> / mes</span>
                  </p>
                )}
                {clinica.suscripcion_ends_at && (
                  <p className="k-t-sec mt-1">
                    Próxima renovación: {format(parseISO(clinica.suscripcion_ends_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                )}
                {clinica.suscripcion_estado === 'trial' && clinica.trial_ends_at && (
                  <p className="mt-1 text-[13px] font-semibold leading-[18px] text-enlace">
                    Prueba hasta: {format(parseISO(clinica.trial_ends_at), "dd 'de' MMMM", { locale: es })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tieneStripe && (
                  <button type="button" onClick={abrirPortal} disabled={openingPortal} className="k-b k-b-tonal">
                    {openingPortal ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <ExternalLink size={16} aria-hidden="true" />}
                    Gestionar
                  </button>
                )}
                {clinica.plan === 'free' || clinica.suscripcion_estado !== 'activo' ? (
                  <Link href="/pricing" className="k-b k-b-prim">
                    <ArrowUpRight size={16} aria-hidden="true" /> Actualizar plan
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          {/* Uso actual */}
          <div className="mt-4 border-t border-linea pt-4">
            <h3 className="k-t-tarjeta mb-3">Uso actual</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <UsageCard label="Médicos" usado={usage?.medicos ?? 0} limite={clinica.max_medicos} />
              <UsageCard label="Asistentes" usado={usage?.secretarias ?? 0} limite={clinica.max_secretarias} />
              <UsageCard label="Pacientes" usado={usage?.pacientes ?? 0} limite={clinica.max_pacientes} />
            </div>
          </div>
        </section>

        {/* Lo incluido en el plan */}
        <section className="k-tarjeta esc:p-5">
          {esVip ? (
            <h3 className="k-t-tarjeta">Acceso VIP — todo incluido</h3>
          ) : (
            <>
              <h3 className="k-t-tarjeta mb-3">Incluido en tu plan</h3>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[14px] leading-5 text-tinta">
                    <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ok-tinta" />
                    {f}
                  </li>
                ))}
              </ul>
              {clinica.plan !== 'premium' && (
                <div className="mt-3 border-t border-linea pt-2">
                  <Link href="/pricing" className="k-b k-b-texto text-[14px]">
                    Ver todos los planes y funcionalidades <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </>
          )}
        </section>

        {/* Seguridad de pagos */}
        <p className="flex items-start gap-2 px-1 text-[13px] leading-[18px] text-tinta2">
          <CreditCard size={16} aria-hidden="true" className="mt-px shrink-0" /> Pagos procesados de forma segura por Stripe. Spinus® no almacena datos de tarjetas.
        </p>
      </div>
    </div>
  )
}

function PlanVip({ tieneSuscripcionStripe, openingPortal, onPortal }: {
  tieneSuscripcionStripe: boolean
  openingPortal: boolean
  onPortal: () => void
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="billing-plan" className="k-t-seccion">Plan VIP</h2>
          <span className="k-etq k-etq-tonal"><Sparkles aria-hidden="true" /> Acceso completo</span>
        </div>
        <p className="k-t-sec mt-1">Tienes acceso a todas las funciones de Spinus®.</p>
        {tieneSuscripcionStripe && (
          <p className="k-t-sec mt-2">
            Tienes una suscripción Stripe activa adicional. Puedes cancelarla desde el portal de Stripe.
          </p>
        )}
      </div>
      {tieneSuscripcionStripe && (
        <button type="button" onClick={onPortal} disabled={openingPortal} className="k-b k-b-tonal">
          {openingPortal ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <ExternalLink size={16} aria-hidden="true" />}
          Gestionar suscripción Stripe
        </button>
      )}
    </div>
  )
}

/* Una barra de uso. La barra crece con `scaleX` desde la izquierda (sólo
   `transform`); antes animaba `width`. En el límite, en `--mal-tinta`. */
function UsageCard({ label, usado, limite }: {
  label: string
  usado: number
  limite: number | null
}) {
  const ilimitado = limite === null || limite === -1
  const fraccion = ilimitado ? 0 : Math.min(usado / (limite || 1), 1)
  const enLimite = !ilimitado && usado >= (limite ?? 0)

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold leading-5 text-tinta">{label}</span>
        <span className="k-num text-[15px] font-bold leading-5 text-tinta">
          {usado}
          <span className="text-[13px] font-normal text-tinta2"> /{ilimitado ? '∞' : limite}</span>
        </span>
      </div>
      {!ilimitado && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sup2">
          <div
            className={`h-full w-full origin-left rounded-full ${enLimite ? 'bg-mal-tinta' : 'bg-accion'}`}
            style={{ transform: `scaleX(${fraccion})` }}
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
