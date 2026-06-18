import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EditarConsultorioSchema } from '@/lib/consultorios/schemas'

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
 * GET /api/consultorios/[id]
 *
 * Devuelve un consultorio específico. La RLS filtra acceso por clínica/médico.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('consultorios')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/consultorios/[id]] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ consultorio: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/consultorios/[id]
 *
 * Edita un consultorio. Solo el médico dueño (vía RLS UPDATE policy).
 *
 * Regla del PATCH (plan §2.5 nota A):
 * - Si nombre_corto NO viene en body → conservar el previo (no se incluye).
 * - Si nombre_corto viene como null o '' → re-derivar:
 *     - El handler carga el nombre vigente (nuevo del body si vino, o el actual
 *       de BD si no vino) para evaluar la condición length <= 12.
 *     - Si length <= 12 → setear nombre_corto = nombre vigente.
 *     - Si length > 12 → rechazar con 400 (no se puede dejar vacío con nombre largo).
 * - Si nombre_corto viene como string no vacío → usar tal cual (validado por Zod).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const parsed = EditarConsultorioSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }
    const input = parsed.data

    // Detectar si el cliente pidió reset de nombre_corto (null o string vacío
    // post-trim). Tras Zod, '' viene trimmed a '', null es null tal cual.
    const pideResetNombreCorto =
      'nombre_corto' in body &&
      (input.nombre_corto === null || input.nombre_corto === '')

    let nombreCortoFinal: string | undefined = undefined
    if (pideResetNombreCorto) {
      // Cargar nombre actual de BD para evaluar condición length <= 12.
      const { data: actual, error: errLoad } = await supabase
        .from('consultorios')
        .select('nombre')
        .eq('id', id)
        .maybeSingle()

      if (errLoad) {
        console.error('[PATCH /api/consultorios/[id]] error load:', errLoad)
        return NextResponse.json({ error: errLoad.message }, { status: 500 })
      }
      if (!actual) {
        return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })
      }

      // El nombre vigente tras el PATCH: el nuevo si vino, o el actual.
      const nombreVigente = input.nombre ?? actual.nombre

      if (nombreVigente.length > 12) {
        return NextResponse.json(
          {
            error:
              'Nombre corto requerido cuando el nombre supera 12 caracteres',
          },
          { status: 400 }
        )
      }
      nombreCortoFinal = nombreVigente
    } else if (input.nombre_corto !== undefined && input.nombre_corto !== null) {
      // Caso normal: el cliente envió un nombre_corto válido.
      nombreCortoFinal = input.nombre_corto
    }
    // Si no se envió nombre_corto en absoluto, queda undefined → no se incluye
    // en el payload → se preserva el valor previo.

    // Construir payload solo con campos presentes (PATCH parcial).
    const updatePayload: Record<string, unknown> = {}
    if (input.nombre !== undefined) updatePayload.nombre = input.nombre
    if (nombreCortoFinal !== undefined) updatePayload.nombre_corto = nombreCortoFinal
    if (input.direccion !== undefined) updatePayload.direccion = input.direccion
    if (input.telefono !== undefined) updatePayload.telefono = input.telefono
    if (input.timezone !== undefined) updatePayload.timezone = input.timezone
    if (input.horario !== undefined) updatePayload.horario = input.horario

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('consultorios')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[PATCH /api/consultorios/[id]] error:', error)

      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Conflicto de unicidad. Reintenta.' },
          { status: 409 }
        )
      }
      if (error.code === '23514') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ consultorio: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/consultorios/[id]
 *
 * Archiva un consultorio (soft-delete: UPDATE activo=false + fecha_baja=now()).
 * Irreversible desde la perspectiva del usuario (plan R1).
 *
 * Reglas de validación:
 * 1. Existe → si no, 404.
 * 2. Pertenece al médico autenticado → si no, 404 (no leak ownership ajeno).
 * 3. NO es el único activo del médico → si lo es, 409.
 * 4. Si es default Y hay otros activos → 409.
 * 5. Si pasa todo → UPDATE soft-delete + 200.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Cargar consultorio.
    const { data: consultorio, error: errLoad } = await supabase
      .from('consultorios')
      .select('id, medico_id, es_default, activo')
      .eq('id', id)
      .maybeSingle()

    if (errLoad) {
      console.error('[DELETE /api/consultorios/[id]] error load:', errLoad)
      return NextResponse.json({ error: errLoad.message }, { status: 500 })
    }
    if (!consultorio) {
      return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })
    }

    // Verificación de ownership: solo el médico dueño puede archivar.
    // Aunque admin/secretaria pueden VER el consultorio (RLS SELECT), no
    // pueden archivarlo. Esto cierra el bypass de "endpoint responde ok=true
    // pero la RLS UPDATE filtra 0 filas".
    if (consultorio.medico_id !== profile.userId) {
      return NextResponse.json({ error: 'Consultorio no encontrado' }, { status: 404 })
    }

    // Idempotencia: si ya está archivado, responder 200 sin hacer nada.
    if (!consultorio.activo) {
      return NextResponse.json({ ok: true, ya_archivado: true })
    }

    // Contar OTROS consultorios activos del médico dueño.
    const { count: otrosActivos, error: errCount } = await supabase
      .from('consultorios')
      .select('id', { count: 'exact', head: true })
      .eq('medico_id', consultorio.medico_id)
      .eq('activo', true)
      .neq('id', id)

    if (errCount) {
      console.error('[DELETE /api/consultorios/[id]] error count:', errCount)
      return NextResponse.json({ error: errCount.message }, { status: 500 })
    }

    // Regla 3: bloquear si es el único activo.
    if ((otrosActivos ?? 0) === 0) {
      return NextResponse.json(
        {
          error:
            'No puedes borrar tu único consultorio. Debes tener al menos uno.',
        },
        { status: 409 }
      )
    }

    // Regla 4: bloquear si es default y hay otros activos.
    if (consultorio.es_default && (otrosActivos ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'Marca otro consultorio como default antes de borrar este.',
        },
        { status: 409 }
      )
    }

    // Ejecutar soft-delete.
    const { error: errUpdate } = await supabase
      .from('consultorios')
      .update({
        activo: false,
        fecha_baja: new Date().toISOString(),
      })
      .eq('id', id)

    if (errUpdate) {
      console.error('[DELETE /api/consultorios/[id]] error update:', errUpdate)
      return NextResponse.json({ error: errUpdate.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
