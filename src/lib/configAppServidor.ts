/**
 * src/lib/configAppServidor.ts
 *
 * La lectura de la configuración de la app (`ConfigApp`, `lib/configApp.ts`)
 * que antes vivía entera dentro de `GET /api/me/config`. La comparten dos
 * sitios (A1.6):
 *   - la ruta, que la sirve al navegador tras su propio `getUser()`;
 *   - `(app)/layout.tsx`, que la siembra como `fallback` de su `SWRConfig` con
 *     la sesión de `sesionServidor()`, para que la carga dura no pida la ruta.
 *
 * ⚠️⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`. La RLS es la barrera:
 * `consultorios` no lleva filtro de clínica a propósito («modo owner-scope» de
 * `/api/consultorios`, lo filtra la RLS). Con el cliente de servicio esa
 * consulta devolvería los consultorios de TODAS las clínicas.
 *
 * ⚠️ Lo que devuelve es EXACTAMENTE el cuerpo 200 de la ruta, mismas claves y
 * en el mismo orden: el layout lo mete en el documento de cada página de (app)
 * y no debe llevar un campo que la ruta no le daría a este mismo usuario.
 * Ni una columna más en estos `select` sin pensar en eso.
 *
 * No decide nada de sesión: recibe un cliente y una clínica ya resueltos por
 * quien llama, con la autoridad que a quien llama le toque.
 */
import type { createClient } from '@/lib/supabase/server'
import type { ConfigApp } from '@/lib/configApp'
import { logger } from '@/lib/logger'

type ClienteServidor = Awaited<ReturnType<typeof createClient>>

/** `ok: false` = alguna de las tres consultas falló; la ruta responde 500 y
 *  el layout no siembra. El detalle ya quedó en el log. */
export type LecturaConfigApp = { ok: true; config: ConfigApp } | { ok: false }

/** Las tres consultas, EN PARALELO: encadenadas, el agregado tardaría la suma
 *  de las tres. Lo que se evita son arranques en frío de instancia, no
 *  consultas. */
function consultarConfig(supabase: ClienteServidor, clinicaId: string) {
  return Promise.all([
    /* Los siete campos de /api/me/clinica + el horario de /api/me/horario +
       `tipo`.
       ⚠️ `tipo` NO ES DE ESTE ENDPOINT NI DE LA MARCA: lo pide el dashboard,
       que antes lo consultaba por su cuenta con un `clinicas?select=tipo`
       propio. Aquella consulta encadenaba a la de `appointments` —medido en
       producción: 539 ms de espera pura al final de la cascada— y pedía UNA
       columna de esta misma fila, que aquí ya viaja entera. Pedirla aquí es
       gratis: mismo viaje, misma fila.
       Va en el `select` y en `ClinicaConfig` (src/lib/configApp.ts) a la vez;
       son las dos mitades de la misma lista. */
    supabase
      .from('clinicas')
      .select('id, nombre, nombre_display, subtitulo, color_primario, color_secundario, logo_url, tipo, horario_consulta')
      .eq('id', clinicaId)
      .single(),
    // Modo owner-scope de /api/consultorios: el filtrado lo hace la RLS.
    // Los archivados no se exponen.
    supabase
      .from('consultorios')
      .select('*')
      .eq('activo', true)
      .order('es_default', { ascending: false })
      .order('created_at', { ascending: true }),
    // Solo los campos con los que la agenda compone el nombre y las
    // iniciales. `especialidad` y `es_admin_de_clinica` se quedan en
    // /api/clinica/medicos, que es quien tiene consumidores para ellos.
    supabase
      .from('profiles')
      .select('id, titulo, nombres, apellido_paterno, apellido_materno')
      .eq('clinica_id', clinicaId)
      .eq('role', 'medico')
      .order('apellido_paterno'),
  ])
}

export async function leerConfigApp(
  supabase: ClienteServidor,
  clinicaId: string,
): Promise<LecturaConfigApp> {
  const [clinicaRes, consultoriosRes, medicosRes] = await consultarConfig(supabase, clinicaId)

  /* Las tres se comprueban por separado, y no con un `??` encadenado, por dos
     razones: el log dice QUÉ rebanada falló, y TypeScript necesita el chequeo
     individual para estrechar cada `data` a no-nulo. `.single()` de la clínica
     también entra por aquí si la fila no existe, que es un estado roto y no
     una clínica ausente. */
  if (clinicaRes.error) {
    logger.error('me/config', `consulta de clinica: ${clinicaRes.error.message}`)
    return { ok: false }
  }
  if (consultoriosRes.error) {
    logger.error('me/config', `consulta de consultorios: ${consultoriosRes.error.message}`)
    return { ok: false }
  }
  if (medicosRes.error) {
    logger.error('me/config', `consulta de medicos: ${medicosRes.error.message}`)
    return { ok: false }
  }

  const { horario_consulta: horario = null, ...clinica } = clinicaRes.data

  return {
    ok: true,
    config: { clinica, consultorios: consultoriosRes.data, horario, medicos: medicosRes.data },
  }
}
