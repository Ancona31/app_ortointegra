/**
 * Clasificador único de estado de pago de una clínica.
 *
 * Usar este módulo desde TODOS los endpoints de super-admin que necesiten
 * derivar `EstadoPago`. Antes existían 3 copias casi idénticas con la regla
 * derivativa `max_pacientes IS NULL → vip`, que era incorrecta porque clínicas
 * con plan pagado también pueden tener `max_pacientes` nulo legítimamente.
 *
 * La fuente de verdad para "es VIP" es ahora `clinicas.es_vip_grant`
 * (boolean NOT NULL DEFAULT false, agregado en migración de Fase 2).
 */

import type { EstadoPago } from './types'

export interface ClasificarPagoInput {
  es_vip_grant: boolean
  stripe_subscription_id: string | null
  suscripcion_estado: string
  plan: string | null
}

export function clasificarPago(c: ClasificarPagoInput): EstadoPago {
  if (c.es_vip_grant) return 'vip'
  if (c.stripe_subscription_id && c.suscripcion_estado === 'activo' && c.plan && c.plan !== 'free') return 'pagando'
  if (c.suscripcion_estado === 'trial') return 'trial'
  if (c.suscripcion_estado === 'vencido') return 'pago_fallido'
  if (c.suscripcion_estado === 'cancelado') return 'cancelado'
  return 'gratuito'
}
