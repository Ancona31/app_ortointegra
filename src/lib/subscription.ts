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
 * por la policy RLS pacientes_select_activos (etapa 5.E, en prod desde
 * 2026-05-24).
 *
 * OJO — este predicado NO es el mismo que el de la barrera RLS. Las policies
 * *_gates_insert (etapa 5.E-5.I) NO cuentan pacientes: usan el helper
 * clinica_tiene_acceso(), basado en el latch clinicas.ha_tenido_acceso_premium.
 * Son dos criterios distintos que coexisten a propósito. No unificar uno con
 * el otro sin plan explícito — cambia quién queda bloqueado en producción.
 * Ver CLAUDE.md § "2026-07-18 — la barrera RLS de suscripción está ACTIVA".
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
 * real son las policies RLS RESTRICTIVE *_gates_insert (etapa 5.E-5.I, en
 * producción desde 2026-05-30/31); este helper alimenta la UX (banner +
 * modal-on-click) y la Capa 2 (layout-guards). Si el helper falla, las RLS
 * siguen vivas.
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
 * Las tres columnas de `profiles` que este módulo necesita, para que un
 * llamador que YA las tenga pueda ahorrarse que se vuelvan a pedir.
 *
 * ⚠️ SI AÑADES UNA COLUMNA AL `select` DE ABAJO, AÑÁDELA AQUÍ TAMBIÉN, y al
 * revés. Son las dos mitades de la misma lista: el `select` de la rama que
 * consulta, y el contrato de la rama que recibe. Desincronizarlas no da error
 * de compilación en la rama que consulta —el cliente no está tipado contra el
 * esquema— y sale como un campo `undefined` en tiempo de ejecución sólo por
 * uno de los dos caminos, que es la clase de fallo que aparece en producción y
 * no en local.
 */
export type PerfilParaSuscripcion = {
  role: string | null
  clinica_id: string | null
  es_admin_de_clinica: boolean | null
}

/**
 * getSubscriptionState — invocado server-side desde:
 *   - (app)/layout.tsx para popular el SubscriptionGateProvider.
 *   - (launcher)/layout.tsx por la misma razón.
 *   - layouts hermanos de las rutas bloqueadas para decidir redirect.
 *
 * ⚠️ EL SEGUNDO PARÁMETRO ES SÓLO RENDIMIENTO Y NO CAMBIA NINGÚN VEREDICTO.
 * Sin él, esta función abre pidiendo `auth.getUser()` —que SIEMPRE sale a la
 * red— y después `profiles`. El problema es que `(app)/layout.tsx` acaba de
 * hacer exactamente esas dos cosas cuatro líneas antes, así que cada render de
 * CUALQUIER página de `(app)` pagaba el par dos veces. Pasándole el perfil ya
 * resuelto se salta las dos consultas y entra directo por `clinicas`.
 *
 * Medido en el proyecto: 1.656 peticiones a Auth contra 117 a Postgres en 24 h.
 * Esta duplicación es una de las que alimentan ese catorce a uno.
 *
 * ⚠️ QUIEN LO PASA ASUME DOS COSAS, y las dos las cumple el layout: que HAY
 * sesión (si no la hubiera ya habría redirigido) y que el perfil es el del
 * usuario de esa sesión. Pasar el perfil de otro usuario devolvería el estado
 * de suscripción de otra clínica — no lo alimentes con nada que no venga de un
 * `profiles` filtrado por el `id` del usuario en curso.
 *
 * ⚠️ Y NO ES UN ATAJO PARA SALTARSE LA COMPROBACIÓN DE SESIÓN. Si dudas de si
 * hay sesión, NO pases el parámetro: la rama que consulta la comprueba ella
 * sola y devuelve FAIL_OPEN. Omitirlo siempre es correcto; pasarlo mal, no.
 *
 * Casos de retorno isBlocked=false (fail-open documentado):
 *   1) user es null (sesión expirada o ruta llamada sin auth).
 *      — sólo alcanzable SIN el segundo parámetro; con él, el llamador ya
 *        garantizó la sesión.
 *   2) profile no existe o query falla. — ídem.
 *   3) profile.clinica_id es null (super_admin u onboarding incompleto).
 *   4) query a clinicas falla.
 *   5) suscripcion_estado distinto de 'cancelado' o es_vip_grant=true
 *      (short-circuit: no se necesita el count).
 *   6) count de pacientes activos falla.
 *   7) cualquier excepción no capturada por los chequeos anteriores.
 *
 * Los casos 3 a 7 se comportan IGUAL con parámetro y sin él: lo único que el
 * parámetro cambia es de dónde sale el perfil, nunca qué se decide con él.
 *
 * Caso de retorno isBlocked=true:
 *   suscripcion_estado='cancelado' AND es_vip_grant=false AND count > 5.
 */
export async function getSubscriptionState(
  supabase: SupabaseClient,
  perfilYaResuelto?: PerfilParaSuscripcion,
): Promise<SubscriptionState> {
  try {
    let profile: PerfilParaSuscripcion

    if (perfilYaResuelto) {
      profile = perfilYaResuelto
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return FAIL_OPEN

      /* ⚠️⚠️ ESTA LISTA DE COLUMNAS TIENE QUE SER IDÉNTICA, CARÁCTER POR
         CARÁCTER, A LA DE `(app)/layout.tsx`. NO ES ESTILO: ES LO ÚNICO QUE
         EVITA UN VIAJE DUPLICADO A LA BASE, Y SE ROMPE EN SILENCIO.

         Next desduplica las peticiones `fetch` idénticas dentro de un mismo
         render (Request Memoization del App Router), y la clave de esa
         desduplicación es LA URL. Supabase construye la URL con el `select`
         dentro:

           /rest/v1/profiles?select=role%2Cclinica_id%2Ces_admin_de_clinica&id=eq.…

         Así que dos llamadores que pidan las MISMAS columnas cuestan un viaje, y
         dos que pidan columnas distintas cuestan dos. Añadir una columna aquí y
         no allí —o al revés— no da error de compilación, no falla ningún test y
         no se ve en ninguna parte: sólo aparece una consulta de más por cada
         render de cada página de `(app)`.

         COMPROBADO MIDIENDO, no deducido. Instrumentando `fetch` en el servidor,
         una carga de `/documentos` hace 3 viajes a Supabase; una de
         `/expediente/[id]` hace 4, y el cuarto es exactamente este `profiles`
         pedido con otro `select` desde `expediente/[id]/layout.tsx:40`, que
         todavía pide sólo `role`.

         Se intentó volver esto estructural —un resolvedor de sesión compartido
         con `cache()` de React— y se descartó: diez archivos, dos de ellos
         guardas de acceso al expediente clínico, para ahorrar UNA consulta.
         Registrado en `DEUDA_TECNICA.md` como PERF-DT-1. Mientras tanto, la
         garantía es este comentario y su gemelo en el layout. */
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('role, clinica_id, es_admin_de_clinica')
        .eq('id', user.id)
        .single()
      if (profileErr || !data) return FAIL_OPEN
      profile = data
    }

    const role = profile.role ?? 'medico'
    const esAdminDeClinica = profile.es_admin_de_clinica === true

    if (!profile.clinica_id) {
      return { ...FAIL_OPEN, role, esAdminDeClinica }
    }

    const clinicaId = profile.clinica_id

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
