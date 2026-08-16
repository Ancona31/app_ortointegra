import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/me/config
 *
 * Agregado de los datos de configuración de la sesión. Junta lo que antes
 * pedían en paralelo `/api/me/clinica`, `/api/consultorios` (modo owner-scope,
 * sin params), `/api/me/horario` y `/api/clinica/medicos`.
 *
 * NO sustituye a esos cuatro: siguen vivos y con sus consumidores propios
 * (`perfil`, `expediente`, `pacientes/nuevo`, `QuickPatientModal`). Este
 * agregado solo sirve a `useClinica`, `useConsultorios` y la agenda.
 *
 * Las consultas van EN PARALELO. Si se encadenaran, el agregado tardaría la
 * suma de las cuatro y no habría ganado nada frente a cuatro peticiones
 * simultáneas: lo que se está evitando son cuatro arranques en frío de
 * instancia, no cuatro consultas.
 *
 * `clinica` y `horario` salen de UNA sola consulta porque ambos viven en la
 * fila de `clinicas`; separarlas era el reparto entre dos endpoints, no una
 * necesidad.
 *
 * ─── ESTE ENDPOINT NUNCA DEVUELVE UNA REBANADA VACÍA QUE NO SEA VERDAD ───
 *
 * Devolvía 200 con `{clinica: null, consultorios: [], …}` sin sesión y sin
 * clínica, y hacía `consultoriosRes.data ?? []` sin mirar el error de la
 * consulta. Para SWR las tres cosas eran un éxito legítimo, indistinguible de
 * un médico que de verdad no tiene consultorios — y `PrimerConsultorioModal`,
 * que ESCRIBE, se dispara justo ante esa lectura. Un vacío inventado por un
 * fallo de base de datos le hacía crear un consultorio de más a un médico que
 * ya tenía los suyos.
 *
 * Ahora: 401 sin sesión, 403 sin clínica (lo que ya hacía `/api/consultorios`),
 * 500 si cualquiera de las consultas falla. El 200 significa exactamente una
 * cosa: pregunté y esto es lo que hay.
 *
 * El comentario que vivía aquí justificaba el 200 permisivo porque un 401 haría
 * que `useClinica` cayera a su cache cifrado de la sesión anterior. El síntoma
 * era real; la cura era peor que la enfermedad. Si un médico se loguea en una
 * máquina que usó otro y el agregado responde 401 antes de que su sesión se
 * asiente, ese cache le pinta la clínica del anterior: una fuga entre cuentas.
 * Se arregló donde estaba el defecto —el fallback offline de `useClinica` y
 * `useConsultorios` ya no se activa ante 401/403, solo ante fallo de red o
 * 500 (ver `esErrorDeSesion` en src/lib/configApp.ts)—. El cache cifrado es el
 * respaldo para trabajar sin red estando dentro, no un sustituto de una sesión
 * cerrada.
 *
 * ⚠ PRECIO ACEPTADO DE LA CONSOLIDACIÓN, ANOTADO A PROPÓSITO: las cuatro
 * rebanadas comparten UNA clave de SWR, así que un error parcial no se puede
 * expresar —o la clave falla o no falla—. Consolidar convirtió cuatro fallos
 * independientes en uno solo: si un día revienta la consulta de `medicos`, se
 * lleva por delante la marca de la clínica y los consultorios. Se acepta con
 * los ojos abiertos, porque la alternativa (200 con marcadores de error por
 * rebanada) obliga a los tres consumidores a manejar formas nuevas y
 * reintroduce la misma ambigüedad un nivel más arriba. Los hooks caen a su
 * cache cifrado ante el 500, que es para lo que ese cache existe.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'no_autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single()

    // No pude averiguarlo ≠ no hay. Un perfil ilegible es un fallo, no un
    // usuario sin clínica.
    if (profileError) {
      logger.error('me/config', `perfil ilegible: ${profileError.message}`)
      return NextResponse.json({ error: 'configuracion_ilegible' }, { status: 500 })
    }

    if (!profile?.clinica_id) {
      return NextResponse.json({ error: 'sin_clinica' }, { status: 403 })
    }

    const [clinicaRes, consultoriosRes, medicosRes] = await Promise.all([
      // Los siete campos de /api/me/clinica + el horario de /api/me/horario.
      supabase
        .from('clinicas')
        .select('id, nombre, nombre_display, subtitulo, color_primario, color_secundario, logo_url, horario_consulta')
        .eq('id', profile.clinica_id)
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
        .eq('clinica_id', profile.clinica_id)
        .eq('role', 'medico')
        .order('apellido_paterno'),
    ])

    /* Las tres se comprueban por separado, y no con un `??` encadenado, por dos
       razones: el log dice QUÉ rebanada falló, y TypeScript necesita el chequeo
       individual para estrechar cada `data` a no-nulo. `.single()` de la clínica
       también entra por aquí si la fila no existe, que es un estado roto y no
       una clínica ausente. */
    if (clinicaRes.error) {
      logger.error('me/config', `consulta de clinica: ${clinicaRes.error.message}`)
      return NextResponse.json({ error: 'configuracion_ilegible' }, { status: 500 })
    }
    if (consultoriosRes.error) {
      logger.error('me/config', `consulta de consultorios: ${consultoriosRes.error.message}`)
      return NextResponse.json({ error: 'configuracion_ilegible' }, { status: 500 })
    }
    if (medicosRes.error) {
      logger.error('me/config', `consulta de medicos: ${medicosRes.error.message}`)
      return NextResponse.json({ error: 'configuracion_ilegible' }, { status: 500 })
    }

    const { horario_consulta: horario = null, ...clinica } = clinicaRes.data

    return NextResponse.json({
      clinica,
      consultorios: consultoriosRes.data,
      horario,
      medicos: medicosRes.data,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    logger.error('me/config', message)
    return NextResponse.json({ error: 'configuracion_ilegible' }, { status: 500 })
  }
}
