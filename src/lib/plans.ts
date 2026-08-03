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
    max_pacientes: 5,
    color: 'slate',
    /* ⚠️ LAS NOTAS CON IA NO ESTÁN EN ESTA LISTA Y EL PRODUCTO SÍ LAS DA A FREE.
       No es un descuido: es una discrepancia REAL entre el copy y el runtime,
       y se deja anotada en vez de resolverse por cuenta propia. `rateLimit.ts`
       aplica el mismo tope de 60/24 h a todo el mundo sin mirar el plan, así
       que hoy un usuario Free las tiene igual que uno de pago. Añadirlas aquí
       sería prometer algo que Angel está a punto de restringir; quitárselas al
       runtime es decisión suya, no de este archivo. Cuando el límite se
       diferencie por plan, esta lista y la de `individual` se resuelven juntas. */
    features: [
      'Hasta 5 pacientes',
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
    /* ⚠️ ESTA LISTA ES COPY DE CARA AL CLIENTE Y LA LEEN TRES SUPERFICIES:
       la landing (§5.12), /pricing y /billing. Solo va aquí lo que el producto
       hace HOY. Cambios de 2026-08-02:
       · «Extracción de labs con IA» — RETIRADA. La función ya no existe:
         `/api/labs-extract` se eliminó en la sub-fase 8C1 del rediseño de labs
         (2026-04-23) y la única ruta de IA que queda es `/api/nota-medica`.
         Sobrevive `/api/labs/mediciones`, que es CRUD, no extracción. No la
         devuelvas a la lista sin que exista el endpoint.
       · «Google Calendar integrado» → «Sincronización con Google Calendar».
         Lo anterior sugería que Google vive dentro de la app.
       · «Nota de honorarios» — RETIRADA por redundante: es uno de los 8
         formatos que ya cubre «Todos los tipos de documentos». */
    features: [
      'Pacientes ilimitados',
      /* ⚠️ SIN NÚMERO, Y ES DELIBERADO. El tope vive en `rateLimit.ts`
         (`nota-medica: 60` cada 24 h) y HOY NO DISTINGUE PLAN: `checkRateLimit`
         recibe `userId` y ruta, nunca el plan. Angel va a diferenciarlo, así
         que publicar la cifra sería anunciar algo a punto de dejar de ser
         cierto. Cuando se diferencie, el número entra aquí. */
      'Notas médicas con IA',
      'Todos los tipos de documentos',
      'Visor DICOM',
      'Sincronización con Google Calendar',
      'Estadísticas clínicas',
      'Envío de docs por email',
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
      // ⚠️ SIN CIFRA A PROPÓSITO (2026-07-31). Decía "Soporte prioritario
      // <24h" y Premium decía "SLA de respuesta <8h": dos compromisos de
      // tiempo publicados en /pricing sin nada detrás que los sostenga —ni
      // ticketing, ni turnos, ni cláusula en los términos— y contra los que
      // la FAQ pública (§7·12b, pregunta 6) tendría que competir. La landing
      // compromete UN techo ("nuestro objetivo es responder dentro de las 24
      // horas hábiles") y aquí solo se dice que el plan tiene prioridad.
      // Si algún día hay un SLA de verdad, vuelve la cifra — a los dos sitios
      // a la vez, no solo a este.
      'Soporte prioritario',
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
      // Ver la nota de `pro`. ⚠️ QUEDA REDUNDANTE CON "Todo lo de Clínica
      // Pro", que ya incluye esta línea: sin cifras, Premium deja de tener
      // un escalón propio de soporte. Se conserva porque la instrucción era
      // sustituir las dos cifras por este rótulo, no reempaquetar los planes
      // — decidir si Premium recupera un diferenciador (o si la línea
      // desaparece de aquí) es de producto, no de esta tanda.
      'Soporte prioritario',
      'Factura mensual',
    ],
    priceId: {
      monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? null,
      annual:  process.env.STRIPE_PRICE_PREMIUM_ANNUAL  ?? null,
    },
  },
}

export const PLAN_LIMITS: Record<PlanKey, { max_medicos: number; max_secretarias: number; max_pacientes: number | null }> = {
  free:       { max_medicos: 1,  max_secretarias: 0, max_pacientes: 5    },
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
