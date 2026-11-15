/**
 * POST /api/agenda/restablecer — «Restablecer configuración de la agenda»
 * (tanda H, punto 10 de Angel). Deja la configuración de la agenda v2 de la
 * clínica como si nunca se hubiera configurado: horario de cada consultorio
 * el de partida de la v2 (el de la clínica copiado como suyo, la herencia de
 * G4), tipos de cita archivados, enlaces de reserva revocados, plazos
 * de fábrica y recordatorio apagado. NO toca citas, pacientes, auditoría ni
 * contactos bloqueados. Todo lo hace UNA función transaccional de la base,
 * `agenda_restablecer_configuracion` (migración `20261120121000`), sólo
 * ejecutable por service_role.
 *
 * ⚠️ SE VALIDA EN EL SERVIDOR, NO EN EL CLIENTE:
 *   1. `entradaGestion()`: sesión con `getUser()`, perfil con clínica e
 *      interruptor de la v2 encendido (apagado → 404, como el resto de la
 *      gestión de la agenda v2).
 *   2. Sólo el ADMINISTRADOR de la clínica (`canManageClinica`): la
 *      secretaria y el médico invitado reciben 403 sin tocar nada.
 *   3. El cuerpo tiene que traer la palabra escrita: `{ confirmacion:
 *      'RESTABLECER' }` (`strictObject`; 400 si no).
 *   4. `createAdminClient()` sólo para `.rpc()`, con `p_clinica_id` y
 *      `p_actor` SACADOS DE LA SESIÓN, nunca del cuerpo. La función vuelve a
 *      comprobar que `p_actor` es administrador de esa clínica.
 * Es una excepción anotada a «sólo cliente de sesión» de la gestión de la
 * agenda, del mismo tipo que `reserva_enlace_emitir`: la función es sólo de
 * service_role porque reescribe tablas cuyos disparadores no dejan a la
 * sesión (revocar enlaces de otros médicos, archivar sus tipos).
 *
 * Auditoría: la función escribe UNA fila `agenda_configuracion_restablecida`
 * a nombre de quien la pidió, en la misma transacción.
 *
 * Sin la migración: PGRST202 → 503 `no_disponible`, sin tocar nada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** La palabra que hay que escribir para confirmar. La misma en la pantalla. */
const PALABRA = 'RESTABLECER'
const CuerpoSchema = z.strictObject({ confirmacion: z.literal(PALABRA) })
const CODIGOS_AUSENTE = new Set(['PGRST202', '42883'])

const ResultadoSchema = z.array(z.object({
  r_resultado: z.enum(['ok', 'apagado', 'sin_permiso']),
  r_consultorios: z.number().int(),
  r_tipos: z.number().int(),
  r_enlaces: z.number().int(),
})).length(1)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  if (!canManageClinica(e.perfil)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  const cuerpo = CuerpoSchema.safeParse(await req.json().catch(() => null))
  if (!cuerpo.success) return NextResponse.json({ error: `Escribe ${PALABRA} para confirmar` }, { status: 400 })
  try {
    const { data, error } = await createAdminClient().rpc('agenda_restablecer_configuracion', {
      p_clinica_id: e.clinicaId, p_actor: e.perfil.id,
    })
    if (error) {
      if (error.code && CODIGOS_AUSENTE.has(error.code)) return NextResponse.json({ error: 'no_disponible' }, { status: 503 })
      logger.error('agenda', `configuración sin restablecer: ${error.code ?? 'sin código'}`)
      return NextResponse.json({ error: 'No se pudo restablecer la configuración' }, { status: 500 })
    }
    const r = ResultadoSchema.safeParse(data)
    if (!r.success) {
      logger.error('agenda', 'restablecer configuración: respuesta con forma inesperada')
      return NextResponse.json({ error: 'No se pudo restablecer la configuración' }, { status: 500 })
    }
    const [fila] = r.data
    if (fila.r_resultado === 'sin_permiso') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (fila.r_resultado === 'apagado') return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    return NextResponse.json({ ok: true, consultorios: fila.r_consultorios, tipos: fila.r_tipos, enlaces: fila.r_enlaces })
  } catch (err: unknown) {
    logger.error('agenda', `POST restablecer: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
