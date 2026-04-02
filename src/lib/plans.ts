export type PlanKey = 'free' | 'individual' | 'basica' | 'pro' | 'premium'
export type BillingInterval = 'monthly' | 'annual'

export interface Plan {
  key: PlanKey
  nombre: string
  precio_mensual: number      // MXN, 0 para free
  precio_anual: number        // MXN total/año (10 meses), 0 para free
  max_medicos: number
  max_secretarias: number
  max_pacientes: number | null  // null = ilimitado
  features: string[]
  badge?: string
  color: string
  priceId: {
    monthly: string | null
    annual: string | null
  }
}

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    nombre: 'Free',
    precio_mensual: 0,
    precio_anual: 0,
    max_medicos: 1,
    max_secretarias: 0,
    max_pacientes: 15,
    color: 'slate',
    features: [
      'Hasta 15 pacientes',
      'Expedientes clínicos',
      'Documentos médicos básicos',
      'Recetas con QR verificable',
    ],
    priceId: { monthly: null, annual: null },
  },
  individual: {
    key: 'individual',
    nombre: 'Individual',
    precio_mensual: 649,
    precio_anual: 6490,
    max_medicos: 1,
    max_secretarias: 0,
    max_pacientes: null,
    color: 'blue',
    features: [
      'Pacientes ilimitados',
      'Todos los tipos de documentos',
      'Visor DICOM',
      'Extracción de labs con IA',
      'Google Calendar integrado',
      'Estadísticas clínicas',
      'Envío de docs por email',
      'Nota de honorarios',
    ],
    priceId: {
      monthly: process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY ?? null,
      annual:  process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL  ?? null,
    },
  },
  basica: {
    key: 'basica',
    nombre: 'Clínica Básica',
    precio_mensual: 1990,
    precio_anual: 19900,
    max_medicos: 3,
    max_secretarias: 1,
    max_pacientes: null,
    color: 'emerald',
    features: [
      'Todo lo de Individual × 3 médicos',
      '1 secretaria',
      'Panel de administración',
      'Gestión de equipo',
      'Pacientes compartidos en clínica',
    ],
    priceId: {
      monthly: process.env.STRIPE_PRICE_BASICA_MONTHLY ?? null,
      annual:  process.env.STRIPE_PRICE_BASICA_ANNUAL  ?? null,
    },
  },
  pro: {
    key: 'pro',
    nombre: 'Clínica Pro',
    precio_mensual: 3200,
    precio_anual: 32000,
    max_medicos: 5,
    max_secretarias: 2,
    max_pacientes: null,
    color: 'violet',
    badge: 'Más popular',
    features: [
      'Todo lo de Clínica Básica',
      '5 médicos + 2 secretarias',
      'Estadísticas por médico',
      'Soporte prioritario <24h',
    ],
    priceId: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
      annual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? null,
    },
  },
  premium: {
    key: 'premium',
    nombre: 'Clínica Premium',
    precio_mensual: 4800,
    precio_anual: 48000,
    max_medicos: 10,
    max_secretarias: 2,
    max_pacientes: null,
    color: 'amber',
    features: [
      'Todo lo de Clínica Pro',
      '10 médicos + 2 secretarias',
      'Onboarding personalizado',
      'SLA de respuesta <8h',
      'Factura mensual',
    ],
    priceId: {
      monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? null,
      annual:  process.env.STRIPE_PRICE_PREMIUM_ANNUAL  ?? null,
    },
  },
}

export const PLAN_LIMITS: Record<PlanKey, { max_medicos: number; max_secretarias: number; max_pacientes: number | null }> = {
  free:       { max_medicos: 1,  max_secretarias: 0, max_pacientes: 15   },
  individual: { max_medicos: 1,  max_secretarias: 0, max_pacientes: null },
  basica:     { max_medicos: 3,  max_secretarias: 1, max_pacientes: null },
  pro:        { max_medicos: 5,  max_secretarias: 2, max_pacientes: null },
  premium:    { max_medicos: 10, max_secretarias: 2, max_pacientes: null },
}

export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceId.monthly === priceId || plan.priceId.annual === priceId) {
      return plan.key
    }
  }
  return null
}

export function formatPrecio(mxn: number): string {
  return mxn.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
}
