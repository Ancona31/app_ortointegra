import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
 * Respuesta permisiva (200 con rebanadas vacías) cuando no hay sesión o no
 * hay clínica, igual que hacía `/api/me/clinica`. Devolver 401/403 haría que
 * `useClinica` cayera a su cache cifrado de la sesión anterior en una pantalla
 * sin sesión.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json(VACIO)

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single()

    if (!profile?.clinica_id) return NextResponse.json(VACIO)

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

    const { horario_consulta: horario = null, ...clinica } = clinicaRes.data ?? {}

    return NextResponse.json({
      clinica: clinicaRes.data ? clinica : null,
      consultorios: consultoriosRes.data ?? [],
      horario,
      medicos: medicosRes.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

const VACIO = { clinica: null, consultorios: [], horario: null, medicos: [] }
