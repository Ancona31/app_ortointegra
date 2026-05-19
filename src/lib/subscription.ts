import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * SubscriptionState — fuente única de verdad para el predicado de bloqueo
 * Fase 8.1/8.2 a nivel server-side.
 *
 * Predicado:
 *   isBlocked = suscripcion_estado === 'cancelado'
 *            && !es_vip_grant
 *            && count_pacientes_activos > 5
 *
 * "Paciente activo" = (activo = true OR activo IS NULL), idéntico al usado
 * por la policy RLS pacientes_select_activos y por la policy
 * *_block_post_cancellation creada en Fase 8.1.
 */
export type SubscriptionState = {
  suscripcion_estado: string
  es_vip_grant: boolean
  count_pacientes: number
  role: string
  esAdminDeClinica: boolean
  isBlocked: boolean
}

/**
 * FAIL_OPEN — estado por defecto cuando no se puede determinar la
 * suscripción. NUNCA bloquear por bugs de infra: un fallo de red, una
 * query rota o un user sin sesión deben dejar pasar al usuario para que
 * la app siga funcionando, no para abrir el feature de pago. La barrera
 * real son las RLS policies de Fase 8.1; este helper alimenta la UX
 * (banner + modal-on-click) y la Capa 2 (layout-guards). Si el helper
 * falla, las RLS siguen vivas.
 */
const FAIL_OPEN: SubscriptionState = {
  suscripcion_estado: 'free',
  es_vip_grant: false,
  count_pacientes: 0,
  role: 'medico',
  esAdminDeClinica: false,
  isBlocked: false,
}

/**
 * getSubscriptionState — invocado server-side desde:
 *   - (app)/layout.tsx para popular el SubscriptionGateProvider.
 *   - (launcher)/layout.tsx por la misma razón.
 *   - layouts hermanos de las rutas bloqueadas para decidir redirect.
 *
 * Casos de retorno isBlocked=false (fail-open documentado):
 *   1) user es null (sesión expirada o ruta llamada sin auth).
 *   2) profile no existe o query falla.
 *   3) profile.clinica_id es null (super_admin u onboarding incompleto).
 *   4) query a clinicas falla.
 *   5) suscripcion_estado distinto de 'cancelado' o es_vip_grant=true
 *      (short-circuit: no se necesita el count).
 *   6) count de pacientes activos falla.
 *   7) cualquier excepción no capturada por los chequeos anteriores.
 *
 * Caso de retorno isBlocked=true:
 *   suscripcion_estado='cancelado' AND es_vip_grant=false AND count > 5.
 */
export async function getSubscriptionState(
  supabase: SupabaseClient,
): Promise<SubscriptionState> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return FAIL_OPEN

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, clinica_id, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) return FAIL_OPEN

    const role = (profile.role as string) ?? 'medico'
    const esAdminDeClinica = (profile.es_admin_de_clinica as boolean) === true

    if (!profile.clinica_id) {
      return { ...FAIL_OPEN, role, esAdminDeClinica }
    }

    const clinicaId = profile.clinica_id as string

    const { data: clinica, error: clinicaErr } = await supabase
      .from('clinicas')
      .select('suscripcion_estado, es_vip_grant')
      .eq('id', clinicaId)
      .single()
    if (clinicaErr || !clinica) return { ...FAIL_OPEN, role, esAdminDeClinica }

    const suscripcion_estado = (clinica.suscripcion_estado as string) ?? 'free'
    const es_vip_grant = (clinica.es_vip_grant as boolean) ?? false

    // Short-circuit: si la clínica no está cancelada o es VIP, no
    // hace falta el count de pacientes.
    if (suscripcion_estado !== 'cancelado' || es_vip_grant) {
      return {
        suscripcion_estado,
        es_vip_grant,
        count_pacientes: 0,
        role,
        esAdminDeClinica,
        isBlocked: false,
      }
    }

    const { count, error: countErr } = await supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId)
      .or('activo.eq.true,activo.is.null')
    if (countErr) {
      return {
        suscripcion_estado,
        es_vip_grant,
        count_pacientes: 0,
        role,
        esAdminDeClinica,
        isBlocked: false,
      }
    }

    const count_pacientes = count ?? 0
    return {
      suscripcion_estado,
      es_vip_grant,
      count_pacientes,
      role,
      esAdminDeClinica,
      isBlocked: count_pacientes > 5,
    }
  } catch {
    return FAIL_OPEN
  }
}
