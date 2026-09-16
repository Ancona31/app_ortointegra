import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'
import { evaluarPerfil } from '@/lib/perfil/gate'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
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

  /* ⚠️ `getClaims()` Y NO `getUser()`, Y ES LA MITAD DE LA ESPERA DE ESTA RUTA.
     `getUser()` SIEMPRE sale a la red contra el servidor de Auth —el
     razonamiento largo, con la medición, está en `src/middleware.ts`—, y esta
     ruta está en el camino crítico de entrar a la aplicación: `GateOnboarding`
     la llama en cada carga dura de `(app)` y hasta que responde el modal no se
     monta, así que la aplicación se ve usable unos segundos antes de bloquearse.
     `getClaims()` verifica la FIRMA del JWT con WebCrypto contra la clave
     pública del proyecto: es criptografía, no confianza, y un token manipulado
     falla igual. Depende de que el proyecto firme con clave ASIMÉTRICA, que es
     el caso (ES256 con `kid`, comprobado al escribir el middleware); si alguien
     rota a HS256, `getClaims()` cae solo a `getUser()` y esto vuelve a ser lento
     sin romperse.
     ⚠️ LO QUE NO CAMBIA: quién puede leer qué. Las consultas de abajo van con el
     cliente de SESIÓN, así que la RLS evalúa el JWT igual que antes. Aquí sólo
     hacía falta el `sub` para preguntar por la fila propia. Una sesión revocada
     pasa por aquí hasta que caduque su token, que es exactamente la ventana que
     el middleware ya documenta y acepta — y lo que se decide con esto es qué
     pantalla se enseña, no a qué datos se llega. */
  const { data: sesion } = await supabase.auth.getClaims()
  const userId = sesion?.claims?.sub
  if (typeof userId !== 'string') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

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
  /* ⚠️ LAS DOS EN PARALELO, Y NO ES UN CAPRICHO: EL CONTEO NO DEPENDE DEL
     PERFIL. Iban en fila —perfil, luego consultorios, luego clínica— y la
     segunda sólo esperaba porque estaba escrita debajo. `consultorios` se filtra
     por `medico_id`, que es el `sub` que ya tenemos; el único que sí depende del
     perfil es el `select` de `clinicas`, y ése se queda donde está.
     Si un día alguien añade aquí una consulta que necesite `profile`, NO la meta
     en este `Promise.all`: va después, con la de la clínica. */
  const [{ data: profile }, { count: consultoriosActivos }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, es_admin_de_clinica, invitado_por, titulo, nombres, apellido_paterno, apellido_materno, especialidad, cedula_profesional, cedula_especialidad, firma_url, clinica_id')
      .eq('id', userId)
      .single(),
    supabase
      .from('consultorios')
      .select('id', { count: 'exact', head: true })
      .eq('medico_id', userId)
      .eq('activo', true),
  ])

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
  /* ⚠️ `role === 'medico'` DELANTE, Y NO SOBRA. Sin ese término, el cálculo
     daba `true` para cualquiera sin especialidad —una secretaria no tiene
     ninguna, así que `soloMedicinaGeneral` es false y la cédula está vacía—, y
     desde B5-bis ella ya no está exenta del gate: el campo habría viajado en su
     respuesta afirmando que le falta un documento que no existe para su rol.
     Hoy su único lector (el aviso del sidebar) ya pregunta por el rol, así que
     esto es la segunda barrera; va aquí igualmente para que el dato no mienta
     al siguiente que lo lea. */
  const faltaCedulaEspecialidad =
    role === 'medico' &&
    !soloMedicinaGeneral &&
    !(typeof cedulaEspecialidad === 'string' && cedulaEspecialidad.trim().length > 0)

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
    /* ⚠️ EL NOMBRE VIAJA AQUÍ PARA QUE EL SIDEBAR NO DEPENDA DE `useProfile`.
       Ese hook memoiza en una promesa de módulo y en una copia cifrada que no
       se invalidan al escribir, así que el sidebar —montado en el layout— se
       quedaba con el nombre de cuando se montó: la asistente guardaba el suyo
       en el onboarding y no aparecía hasta recargar en duro. Esta clave de SWR
       SÍ se revalida al terminar (`GateOnboarding.onComplete`), y es el mismo
       remedio que ya usa `isAdmin` unas líneas más arriba en ese archivo.
       Las tres columnas del nombre viajan en el `select` de arriba, que ya se
       hacía igual: se compone aquí y no en el cliente para que haya UNA sola
       forma de componerlo (`componerNombreMedicoCompleto`, NOMBRES_PLAN.md
       Fase 4) y para no mandar tres campos sueltos que cada consumidor junte a
       su manera. */
    nombre: componerNombreMedicoCompleto({
      titulo: profile.titulo as string | null,
      nombres: profile.nombres as string | null,
      apellido_paterno: profile.apellido_paterno as string | null,
      apellido_materno: profile.apellido_materno as string | null,
    }),
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
