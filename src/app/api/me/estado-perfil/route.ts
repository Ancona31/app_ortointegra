import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'
import { evaluarPerfil } from '@/lib/perfil/gate'
import type { Role } from '@/hooks/useProfile'

/**
 * ⚠️ TRES CONSULTAS QUE SE FUERON, Y POR QUÉ NO VUELVEN. Esta ruta calculaba
 * también `gridMode` (dos conteos: `pacientes` y `consultas`) y
 * `count_pacientes` (un tercero). NADIE los leía — comprobado con grep sobre
 * todo `src/`: `gridMode` solo aparecía en la interfaz de `/inicio`, que no lo
 * usaba en el render, y `AccionesGrid` —el único componente que podría haberlo
 * consumido— no tenía ningún consumidor y se borró con él; el `count_pacientes`
 * de `lib/subscription.ts` es un campo distinto de otro tipo, que esa función
 * calcula por su cuenta.
 *
 * Importa porque desde el Bloque B5 este endpoint está en el CAMINO CRÍTICO de
 * entrar a la aplicación: `GateOnboarding` lo llama en cada carga dura de
 * `(app)`, no solo en `/inicio`. Eran seis consultas de las que tres servían a
 * campos muertos.
 *
 * ⚠️ SELECCIONAR ES GRATIS, DEVOLVER NO — y aquí estuvo escrito lo contrario.
 * `es_vip_grant` sigue en el `select` de `clinicas` porque ese viaje se hace de
 * todas formas por `plan`, y una columna de más en la lista no cuesta nada. Pero
 * de eso NO se sigue que devolverla salga gratis: un campo en la respuesta sin
 * un solo lector engorda el payload y, peor, hace creer al siguiente que algo
 * depende de él. Por eso la columna se queda en la consulta y el campo salió de
 * la respuesta.
 *
 * Lo mismo se llevó por delante a `porcentaje`, `requiereOnboarding` y
 * `suscripcion_estado`. Ojo con el último: el bloqueo por suscripción NO se
 * servía nunca desde aquí. Lo calcula `getSubscriptionState`
 * (`lib/subscription.ts:242`) con su propia consulta a `clinicas` y viaja por
 * props de servidor hasta `SubscriptionGateProvider`, que no hace fetch. Esta
 * ruta tenía una copia sin lector, no la fuente.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  /* ⚠️ `invitado_por` EXIGE LA MIGRACIÓN 20260914_b56 APLICADA, Y EL ORDEN DE
     DESPLIEGUE NO ES NEGOCIABLE: LA MIGRACIÓN VA PRIMERO. Si este código sale
     a producción antes que ella, la columna no existe, PostgREST responde 400
     al `select` entero —no a la columna: a la consulta completa—, `profile`
     llega vacío y esta ruta devuelve 404. Y esta ruta está en el CAMINO
     CRÍTICO de entrar a la aplicación: `GateOnboarding` la llama en cada carga
     dura de `(app)`, así que se queda sin gate para TODOS los usuarios, no
     sólo para los afectados por el criterio.
     Ni el build ni las pruebas lo detectan: son locales, y en local la
     migración ya está puesta. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, es_admin_de_clinica, invitado_por, nombres, especialidad, cedula_profesional, cedula_especialidad, firma_url, clinica_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const role = profile.role as string

  /* ⚠️ AQUÍ VIVÍA UN PORCENTAJE DE COMPLETITUD, Y NO VUELVE. Ponderaba
     nombres/especialidad/cédula profesional a 25 cada uno, `cedula_especialidad`
     a 10 y `firma_url` a 15, y no miraba ni `clinica_id` ni los consultorios:
     discrepaba del criterio único en los dos sentidos. Un médico general con
     todo lo exigido se quedaba en 75 —y con el modal ya bloqueante, eso es un
     encierro de por vida—; uno al 100 % sin consultorio pasaba sin modal y se
     comía el rechazo de la RLS sin poder hacer nada.
     El bloqueo lo decide `evaluarPerfil`, el mismo criterio que
     `public.perfil_completo()` aplica en la base. El porcentaje sobrevivió un
     tiempo porque lo pintaba un banner de `/inicio`; ese banner se retiró —el
     aviso de perfil vive solo en el sidebar y dice QUÉ falta, no cuánto— y con
     él se fue su último lector. */
  const { count: consultoriosActivos } = await supabase
    .from('consultorios')
    .select('id', { count: 'exact', head: true })
    .eq('medico_id', user.id)
    .eq('activo', true)

  const gate = evaluarPerfil({
    role: role as Role,
    /* `es_admin_de_clinica` SIGUE EN EL SELECT de arriba y no es un resto: lo
       necesita la respuesta (`es_admin_de_clinica` más abajo) para el paso del
       logo. Lo que salió del gate es su uso como criterio de procedencia, no
       la columna. */
    invitado_por: profile.invitado_por as string | null,
    nombres: profile.nombres as string | null,
    especialidad: profile.especialidad as string | null,
    cedula_profesional: profile.cedula_profesional as string | null,
    clinica_id: profile.clinica_id as string | null,
    consultoriosActivos: consultoriosActivos ?? 0,
  })

  /* ── ¿Se le puede pedir la cédula de especialidad? ───────────────────────
     Solo si ejerce alguna especialidad que la tenga. A un médico general se le
     estaría pidiendo un documento que no existe.

     ⚠️ SE PARTE POR ' · ' Y SE EXIGE QUE **TODAS** LAS PARTES SEAN
     'Medicina General'. La columna guarda las dos especialidades fundidas con
     ese separador, así que `'Medicina General · Medicina del Deporte'` es un
     médico que SÍ tiene cédula —la de la segunda— y no debe quedar exento.
     Las filas viejas escritas con ', ' (defecto corregido en el onboarding)
     siguen en la base: `'Medicina General'` sola se exime igual, y
     `'Medicina General, Otra'` no, que es lo correcto.

     ⚠️ COMPARACIÓN EXACTA Y SENSIBLE A MAYÚSCULAS, contra ese literal y nada
     más. Un `includes('General')` dejaría sin aviso a `'Cirugía General'`, y
     `'Medicina Familiar'` y `'Medicina Familiar y Comunitaria'` también llevan
     cédula. Hueco conocido y aceptado: la SEGUNDA especialidad es texto libre
     (`ComboEscribible`), así que alguien podría teclear 'medicina general' en
     minúsculas; solo importaría si la escribiera dos veces, y comparar sin
     mayúsculas ablandaría la regla para todos los demás. */
  const especialidades = (profile.especialidad as string | null ?? '')
    .split(' · ')
    .map((e) => e.trim())
    .filter(Boolean)
  const soloMedicinaGeneral =
    especialidades.length > 0 && especialidades.every((e) => e === 'Medicina General')
  const cedulaEspecialidad = profile.cedula_especialidad as string | null
  const faltaCedulaEspecialidad =
    !soloMedicinaGeneral && !(typeof cedulaEspecialidad === 'string' && cedulaEspecialidad.trim().length > 0)

  // Plan de la clínica
  let plan: PlanKey = 'free'
  // Los dos pasos OMITIBLES del onboarding (logo y firma) no salen del gate:
  // el criterio no los exige. Se mandan aparte para no enseñárselos a quien
  // ya los tiene. El logo vive en la clínica, no en el perfil.
  let tieneLogo = false
  if (profile.clinica_id) {
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('plan, suscripcion_estado, es_vip_grant, logo_url')
      .eq('id', profile.clinica_id as string)
      .single()
    if (clinica) {
      plan = (clinica.plan as PlanKey) ?? 'free'
      tieneLogo = typeof clinica.logo_url === 'string' && clinica.logo_url.length > 0
    }
  }

  return NextResponse.json({
    gate,
    faltaCedulaEspecialidad,
    // Lo consume `GateOnboarding` para decidir si enseña el paso del logo. Va
    // en la respuesta y no se lee de `useProfile` en el cliente porque ese hook
    // cae a una copia en `secureStorage` que vive en el navegador del usuario.
    es_admin_de_clinica: profile.es_admin_de_clinica === true,
    tieneFirma: typeof profile.firma_url === 'string' && profile.firma_url.length > 0,
    tieneLogo,
    role,
    plan,
    planNombre: PLANS[plan]?.nombre ?? 'Free',
  })
}
