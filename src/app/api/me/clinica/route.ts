import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'

/**
 * Lo que quien administra la clínica puede cambiar desde Mi perfil.
 *
 * TODO OPCIONAL, porque el PUT es PARCIAL: la pantalla manda sólo lo que el
 * médico tocó. Lo que no viene no se escribe — ojo, eso es lo que impide que
 * guardar un color borre el nombre.
 *
 * ⚠️ `nombre` ES `NOT NULL` EN LA BASE (baseline/02_tables.sql:145) y ADEMÁS
 * es el nombre al que cae toda la app: las diecisiete clínicas tienen
 * `nombre_display` en nulo, así que cada `nombre_display ?? nombre` del
 * repositorio resuelve a ÉSTE. Por eso el `min(1)`: un vacío aquí no deja un
 * hueco, deja sin nombre a las recetas, a los eventos de Google y a la hoja
 * frontal. La misma regla está en el cliente; ésta es la que manda.
 *
 * El tope de 120 no sale de la base —la columna es `text` sin límite— sino de
 * que el nombre viaja a encabezados de PDF y a títulos de evento, donde algo
 * más largo no cabe ni truncado. Es una decisión de producto, no un reflejo
 * del esquema.
 */
const HEX = /^#[0-9A-Fa-f]{6}$/

const ClinicaUpdateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la clínica no puede quedar vacío')
    .max(120, 'El nombre de la clínica no puede pasar de 120 caracteres'),
  color_primario: z.string().regex(HEX, 'Color primario inválido'),
  color_secundario: z.string().regex(HEX, 'Color secundario inválido'),
}).partial()

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ clinica: null })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single()

    if (!profile?.clinica_id) return NextResponse.json({ clinica: null })

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('id, nombre, nombre_display, subtitulo, color_primario, color_secundario, logo_url')
      .eq('id', profile.clinica_id)
      .single()

    return NextResponse.json({ clinica })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = ClinicaUpdateSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  /* Sólo las claves REALMENTE presentes en el body, mismo patrón que
     `/api/me/perfil-medico`. Antes esto escribía siempre `color_primario` y
     `color_secundario` vinieran o no; con un tercer campo en juego eso deja de
     ser inofensivo, porque un PUT de colores llegaría con `nombre: undefined`
     y la intención de un update parcial se vuelve ambigua. */
  const ALLOWED = ['nombre', 'color_primario', 'color_secundario'] as const
  const updateData: Record<string, string> = {}
  for (const key of ALLOWED) {
    const valor = parsed.data[key]
    if (key in body && valor !== undefined) updateData[key] = valor
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true })
  }

  /* clinicas no tiene política UPDATE para `authenticated` (la única policy es
     de SELECT), así que la escritura va con cliente de servicio.
     ⚠️ EL `.eq('id', profile.clinica_id)` ES EL ÚNICO AISLAMIENTO QUE QUEDA.
     Sin RLS por debajo, ese filtro es lo que impide escribir en la clínica de
     otro. No lo quites ni lo cambies por el id que venga en el body. */
  const admin = createAdminClient()
  const { error } = await admin.from('clinicas')
    .update(updateData)
    .eq('id', profile.clinica_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
