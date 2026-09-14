import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { PLAN_LIMITS } from '@/lib/plans'
import { logger } from '@/lib/logger'

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

/* ⚠️ EL CAMPO `nombre` SE DEFINE UNA VEZ Y LO USAN EL PUT Y EL POST. El tope de
   120 y su porqué están escritos arriba; copiar el literal en el alta era la
   forma segura de que los dos se separaran en cuanto alguien tocara uno. */
const nombreClinicaSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la clínica no puede quedar vacío')
  .max(120, 'El nombre de la clínica no puede pasar de 120 caracteres')

const ClinicaUpdateSchema = z.object({
  nombre: nombreClinicaSchema,
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


/**
 * POST /api/me/clinica — crea la PRIMERA clínica del médico y lo pone de dueño.
 *
 * Es el paso de clínica del gate de perfil (Bloque B5). No existía: el único
 * INSERT en `clinicas` de todo el repositorio vivía en el registro, con cliente
 * de servicio y sin sesión, y con el registro recortado a correo y contraseña
 * todo médico nuevo llega aquí sin clínica.
 *
 * ⚠️ CREA LA PRIMERA, NO CAMBIA DE CLÍNICA. Si el llamador ya tiene
 * `clinica_id`, responde 409 y no escribe nada: mover a alguien de clínica es
 * otra operación, con otras consecuencias (sus pacientes se quedan atrás), y no
 * puede caer por accidente en el alta.
 *
 * ⚠️ EL INVITADO NO LLEGA AQUÍ. Un médico sin clínica y sin
 * `es_admin_de_clinica` es alguien a quien le borraron la suya: el gate le
 * enseña el panel de soporte, no este formulario. Aun así la ruta se defiende
 * sola —comprueba el rol— porque un endpoint no puede confiar en que la
 * pantalla correcta sea la única que lo llame.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No encontramos tu perfil. Escribe a soporte@spinus.com.mx.' }, { status: 404 })
  }
  if (profile.role !== 'medico') {
    return NextResponse.json({ error: 'Solo un médico puede crear una clínica.' }, { status: 403 })
  }
  if (profile.clinica_id) {
    return NextResponse.json(
      { error: 'Tu cuenta ya pertenece a una clínica. Puedes cambiarle el nombre desde Mi Perfil.' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = z.object({ nombre: nombreClinicaSchema }).safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  /* Plan, estado y los tres topes son los MISMOS que ponía el registro
     (api/auth/registro/route.ts), leídos de `PLAN_LIMITS` y no transcritos:
     una clínica nueva nace igual venga de donde venga.
     `tipo: 'independiente'` es el único valor que el registro mandaba —lo
     fijaba la pantalla, no el médico—, así que aquí se fija igual. */
  const limits = PLAN_LIMITS.free
  const admin = createAdminClient()

  const { data: clinica, error: clinicaError } = await admin
    .from('clinicas')
    .insert({
      nombre:             parsed.data.nombre,
      tipo:               'independiente',
      plan:               'free',
      suscripcion_estado: 'free',
      max_medicos:        limits.max_medicos,
      max_secretarias:    limits.max_secretarias,
      max_pacientes:      limits.max_pacientes,
    })
    .select('id')
    .single()

  if (clinicaError || !clinica) {
    logger.error('api/me/clinica', `insert de clinica falló: ${clinicaError?.message ?? 'sin fila'}`)
    return NextResponse.json(
      { error: 'No pudimos crear tu clínica. Vuelve a intentarlo; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
  }

  /* ⚠️ CON CLIENTE DE SERVICIO, Y NO POR COMODIDAD: el trigger
     `proteger_columnas_sensibles_profiles` lanza excepción si `clinica_id` o
     `es_admin_de_clinica` cambian con `auth.uid()` no nulo, así que desde la
     sesión del médico esta escritura es imposible. Con `service_role`
     `auth.uid()` es null y el trigger se aparta.
     ⚠️ EL `.eq('id', user.id)` ES EL ÚNICO AISLAMIENTO QUE QUEDA. No lo
     cambies por un id que venga en el body.
     `es_admin_de_clinica: true` porque quien crea la clínica es su dueño. */
  const { error: perfilError } = await admin
    .from('profiles')
    .update({ clinica_id: clinica.id, es_admin_de_clinica: true })
    .eq('id', user.id)

  if (perfilError) {
    /* Se revierte la clínica. Sin esto queda una fila sin dueño —nadie la
       referencia y nadie puede borrarla desde la app— y el médico sigue sin
       `clinica_id`, o sea atascado en este mismo paso sin saber por qué. */
    await admin.from('clinicas').delete().eq('id', clinica.id)
    logger.error('api/me/clinica', `update de profiles falló, clinica revertida: ${perfilError.message}`)
    return NextResponse.json(
      { error: 'Creamos la clínica pero no pudimos asociarla a tu cuenta, así que la deshicimos. Vuelve a intentarlo; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ clinica_id: clinica.id }, { status: 201 })
}
