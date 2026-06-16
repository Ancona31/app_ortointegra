import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMedico, canManageClinica, isSecretaria } from '@/lib/permissions'
import { CrearConsultorioSchema } from '@/lib/consultorios/schemas'

/**
 * Helper local: obtiene el profile del usuario autenticado.
 * Patrón replicado de appointments/route.ts.
 */
async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/**
 * GET /api/consultorios
 *
 * Lista los consultorios activos visibles para el usuario autenticado.
 *
 * Modo 1 — sin params (owner-scope, default):
 *   - Médico: ve los suyos propios (vía RLS).
 *   - Secretaria: ve todos los de la clínica (vía RLS).
 *   - Admin de clínica: ve solo los suyos (vía RLS owner-only tras migración 06).
 *
 * Modo 2 — con ?medico_id=<uuid> (modo operativo para agenda):
 *   - Solo permitido para admin de clínica o secretaria (rol operativo).
 *   - Devuelve los consultorios del médico target (siempre que pertenezca
 *     a la misma clínica del caller).
 *   - Usa admin client (bypass RLS) tras autorizar el caller y validar el target.
 *
 * Los archivados NO se exponen en ningún modo.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!profile.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asignada' }, { status: 403 })
    }

    // F3-5c: leer query param opcional medico_id (modo operativo para agenda).
    const medicoIdParam = req.nextUrl.searchParams.get('medico_id')

    if (medicoIdParam) {
      // Modo operativo: solo admin de clínica o secretaria.
      if (!canManageClinica(profile) && !isSecretaria(profile)) {
        return NextResponse.json(
          { error: 'forbidden', message: 'No tienes permiso para consultar consultorios de otros médicos.' },
          { status: 403 }
        )
      }

      // Validar formato UUID del param antes de query.
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(medicoIdParam)) {
        return NextResponse.json(
          { error: 'medico_id_invalido', message: 'medico_id no tiene formato UUID válido.' },
          { status: 400 }
        )
      }

      // Validar que el médico target pertenece a la clínica del caller.
      const admin = createAdminClient()
      const { data: medicoTarget } = await admin
        .from('profiles')
        .select('id, role, clinica_id')
        .eq('id', medicoIdParam)
        .maybeSingle()

      if (!medicoTarget || medicoTarget.role !== 'medico' || medicoTarget.clinica_id !== profile.clinica_id) {
        return NextResponse.json(
          { error: 'medico_invalido', message: 'El médico no pertenece a tu clínica.' },
          { status: 400 }
        )
      }

      // Bypass RLS deliberado: ya autorizamos al caller y validamos el target.
      const { data, error } = await admin
        .from('consultorios')
        .select('*')
        .eq('medico_id', medicoIdParam)
        .eq('clinica_id', profile.clinica_id)
        .eq('activo', true)
        .order('es_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[GET /api/consultorios?medico_id] error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ consultorios: data ?? [] })
    }

    // Modo owner-scope (default): delega a RLS.
    const { data, error } = await supabase
      .from('consultorios')
      .select('*')
      .eq('activo', true)
      .order('es_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/consultorios] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ consultorios: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/consultorios
 *
 * Crea un consultorio nuevo para el médico autenticado.
 *
 * Reglas:
 * - Solo médicos pueden crear (RLS lo enforza, API valida server-side).
 * - El médico solo puede crear consultorios para sí mismo y su clínica.
 * - Si nombre_corto no se envía y nombre.length <= 12, autocompletar con nombre.
 * - Cap-10, default-insert y demás invariantes están en triggers BD (2.2).
 * - es_default NO se acepta del cliente: lo gobiernan los triggers BD y el
 *   endpoint marcar-default. Zod strip silencioso lo descarta si llega.
 *
 * Errores mapeados:
 * - 401 no autenticado
 * - 403 sin clínica o no es médico
 * - 400 validación (Zod)
 * - 409 unique_violation (SQLSTATE 23505)
 * - 409 check_violation (SQLSTATE 23514) — cap-10 alcanzado
 * - 500 otros errores
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!profile.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asignada' }, { status: 403 })
    }
    if (!isMedico(profile)) {
      return NextResponse.json(
        { error: 'Solo médicos pueden crear consultorios' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const parsed = CrearConsultorioSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }
    const input = parsed.data

    // Autocompletar nombre_corto si no vino y nombre cabe en 12 chars.
    const nombre_corto = input.nombre_corto ?? input.nombre

    const insertPayload = {
      clinica_id: profile.clinica_id,
      medico_id: profile.userId,
      nombre: input.nombre,
      nombre_corto,
      direccion: input.direccion,
      telefono: input.telefono ?? null,
      timezone: input.timezone,
      ...(input.horario ? { horario: input.horario } : {}),
    }

    const { data, error } = await supabase
      .from('consultorios')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      console.error('[POST /api/consultorios] error:', error)

      // 23505: unique_violation (índice consultorios_default_unico).
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Conflicto creando consultorio. Reintenta.' },
          { status: 409 }
        )
      }
      // 23514: check_violation (cap-10, nombre_corto length, etc.).
      if (error.code === '23514') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ consultorio: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
