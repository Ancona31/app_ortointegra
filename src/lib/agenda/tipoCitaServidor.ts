/**
 * src/lib/agenda/tipoCitaServidor.ts
 *
 * B6c · El tipo de cita en el alta y la edición, la parte del SERVIDOR. Lo
 * llaman `POST /api/appointments` y `PUT /api/appointments/[id]` SÓLO con el
 * interruptor encendido; apagado, `tipo_cita_id` del cuerpo se ignora y nada
 * de aquí corre, así que ninguna consulta nombra `tipo_cita_*` en una base
 * que todavía no tenga la migración 20261112150000.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: que el tipo se vea es
 * parte de la regla (el invitado no ve los tipos personales de otros médicos,
 * y uno que no ve es `tipo_no_encontrado`). El `eq('clinica_id')` es explícito
 * aunque la RLS ya filtre (pendiente prioritario de `CLAUDE.md`).
 *
 * Falla CERRADO, al revés que el empalme: si no se puede leer el tipo no se
 * escribe la cita (500). El empalme sólo avisa; esto decide qué se guarda.
 *
 * ⚠️ LA DURACIÓN DEL TIPO NO SE IMPONE AQUÍ. Elegir un tipo en el modal
 * escribe el fin (inicio + `duracion_min`), igual que los botones de
 * duración, y el usuario puede cambiarlo después. El servidor guarda y
 * comprueba el empalme con el fin que llega, que ya es el final.
 */
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { MENSAJE_ERROR_TIPO_CITA, validarTipoParaCita, type TipoCita } from '@/lib/agenda/tiposCita'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lo que decide la ruta: seguir (y qué columnas añadir) o contestar con esto. */
export type VeredictoTipoCita =
  | { ok: true; columnas: { tipo_cita_id: string | null; tipo_cita_nombre: string | null } | null }
  | { ok: false; status: 400 | 500; cuerpo: { error: string; message: string } }

const ERROR_LECTURA: VeredictoTipoCita = {
  ok: false, status: 500, cuerpo: { error: 'error_interno', message: 'No se pudo comprobar el tipo de cita.' },
}

/**
 * `tipo_cita_id` del cuerpo. `undefined` = el cuerpo no lo toca; `null` (o
 * cadena vacía) = sin tipo; uuid = ese tipo. Cualquier otra cosa: `false`
 * (400 `tipo_cita_invalido`).
 */
export function leerTipoCitaId(valor: unknown): string | null | undefined | false {
  if (valor === undefined) return undefined
  if (valor === null || valor === '') return null
  return typeof valor === 'string' && UUID.test(valor) ? valor : false
}

export const CUERPO_TIPO_INVALIDO = { error: 'tipo_cita_invalido', message: 'tipo_cita_id no tiene formato UUID válido.' } as const

/**
 * Lee el tipo con el que QUEDARÁ la cita y pasa la regla de `validarTipoParaCita`.
 * `tipoAnterior` es el que ya tenía (`null` en un alta): sólo si cambia se
 * exige que esté activo y se toma la instantánea del nombre.
 */
export async function comprobarTipoDeCita(supabase: ClienteSesion, a: {
  clinicaId: string
  tipoCitaId: string | null
  tipoAnterior: string | null
  medicoId: string | null
  conPaciente: boolean
}): Promise<VeredictoTipoCita> {
  let tipo: Pick<TipoCita, 'id' | 'medico_id' | 'nombre' | 'activo'> | null = null
  if (a.tipoCitaId !== null) {
    const { data, error } = await supabase.from('tipos_cita').select('id, medico_id, nombre, activo')
      .eq('id', a.tipoCitaId).eq('clinica_id', a.clinicaId).maybeSingle()
    if (error) {
      logger.error('agenda', `tipo de cita sin leer: ${error.code ?? ''} ${error.message}`)
      return ERROR_LECTURA
    }
    tipo = data
  }
  const r = validarTipoParaCita({
    tipoCitaId: a.tipoCitaId, tipo, medicoId: a.medicoId, conPaciente: a.conPaciente,
    recienAsignado: a.tipoCitaId !== a.tipoAnterior,
  })
  if (!r.ok) return { ok: false, status: 400, cuerpo: { error: r.error, message: MENSAJE_ERROR_TIPO_CITA[r.error] } }
  return { ok: true, columnas: r.columnas }
}

/**
 * El PUT. Sólo hace algo si el cuerpo trae `tipo_cita_id` o si cambian el
 * médico o el paciente EFECTIVOS: en esos casos lee el tipo que la cita ya
 * tenía y valida el que le quedará (el del cuerpo, o el de antes). Así, pasar
 * la cita a un médico con el que su tipo no es compatible da 400
 * `tipo_incompatible` aunque el cuerpo no nombre el tipo (P5).
 * Editar la hora o las notas no consulta nada.
 */
export async function comprobarTipoDelPut(supabase: ClienteSesion, a: {
  clinicaId: string
  citaId: string
  tipoDelCuerpo: string | null | undefined
  antes: { medico_id: string | null; paciente_id: string | null }
  medicoEfectivo: string | null
  pacienteEfectivo: string | null
}): Promise<VeredictoTipoCita> {
  const cambia = a.medicoEfectivo !== a.antes.medico_id || a.pacienteEfectivo !== a.antes.paciente_id
  if (a.tipoDelCuerpo === undefined && !cambia) return { ok: true, columnas: null }
  const { data, error } = await supabase.from('appointments').select('tipo_cita_id')
    .eq('id', a.citaId).eq('clinica_id', a.clinicaId).maybeSingle()
  if (error || !data) {
    logger.error('agenda', `tipo de la cita sin leer: ${error?.message ?? 'sin fila'}`)
    return ERROR_LECTURA
  }
  const anterior: string | null = data.tipo_cita_id ?? null
  return comprobarTipoDeCita(supabase, {
    clinicaId: a.clinicaId,
    tipoCitaId: a.tipoDelCuerpo === undefined ? anterior : a.tipoDelCuerpo,
    tipoAnterior: anterior,
    medicoId: a.medicoEfectivo,
    conPaciente: Boolean(a.pacienteEfectivo),
  })
}
