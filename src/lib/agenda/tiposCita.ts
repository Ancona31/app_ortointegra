/**
 * src/lib/agenda/tiposCita.ts
 *
 * Tipos de cita (plan del bloque B, paso B6; decisión P5), que viven en
 * `public.tipos_cita` (migración `20261112150000_agenda_b6_tipos_cita.sql`):
 *   - de la clínica (`medico_id = null`, vale para todos sus médicos) o de un
 *     médico (`medico_id` con valor, sólo para él);
 *   - los crea, edita y archiva sólo el administrador de la clínica; nunca se
 *     borran (las citas los referencian con RESTRICT);
 *   - duración de 5 a 600 min en múltiplos de 5 (el techo de una cita con
 *     paciente es `TOPE_CITA_HORAS = 10`);
 *   - el color es sólo marca en el selector, NUNCA sustituye al color del
 *     estado en la tarjeta;
 *   - sólo para citas con paciente o por ligar (D6), opcional, con instantánea del nombre.
 *
 * ⚠️ MÓDULO NEUTRO: sin `'use client'` ni nada de servidor. Lo usan las rutas
 * de `/api/agenda/tipos-cita` y lo usarán POST/PUT de `/api/appointments` y el
 * selector del modal.
 *
 * ⚠️⚠️ LOS LÍMITES ESTÁN DOS VECES: aquí y en los CHECK de `tipos_cita`. Si
 * cambias uno, cambia el otro (lo dice también el COMMENT ON TABLE).
 *
 * ⚠️⚠️ EL CONVENIO QUE LA BASE NO IMPONE (dimensión 16, y el COMMENT de
 * `appointments.tipo_cita_id`): la FK compuesta sólo garantiza que el tipo sea
 * de la misma clínica. Que sea de toda la clínica o del médico de la cita, y
 * que la cita tenga paciente, lo comprueba `validarTipoParaCita` y nadie más.
 * Todo camino que escriba `tipo_cita_id` tiene que pasar por ella.
 */
import { z } from 'zod'
import { COLORES_EVENTO, type ColorEvento } from '@/lib/appointments'

/** Límites de P5, inclusivos. Los mismos que los CHECK de `tipos_cita`. */
export const LIMITES_TIPO_CITA = {
  nombreMax: 60,
  duracionMin: 5,
  duracionMax: 600,
  pasoDuracion: 5,
} as const

/** Una fila de `tipos_cita` tal como la devuelven las rutas. */
export interface TipoCita {
  id: string
  clinica_id: string
  medico_id: string | null
  nombre: string
  duracion_min: number
  color: ColorEvento | null
  activo: boolean
  created_at: string
  updated_at: string
}

/** Las columnas que piden las rutas: las de `TipoCita`, ni una más. */
export const COLUMNAS_TIPO_CITA = 'id, clinica_id, medico_id, nombre, duracion_min, color, activo, created_at, updated_at'

const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio')
  .max(LIMITES_TIPO_CITA.nombreMax, `El nombre tiene como máximo ${LIMITES_TIPO_CITA.nombreMax} caracteres`)
const duracionSchema = z.number().int()
  .min(LIMITES_TIPO_CITA.duracionMin, `La duración mínima es de ${LIMITES_TIPO_CITA.duracionMin} minutos`)
  .max(LIMITES_TIPO_CITA.duracionMax, `La duración máxima es de ${LIMITES_TIPO_CITA.duracionMax} minutos`)
  .multipleOf(LIMITES_TIPO_CITA.pasoDuracion, `La duración va en múltiplos de ${LIMITES_TIPO_CITA.pasoDuracion} minutos`)
const colorSchema = z.enum(COLORES_EVENTO).nullable()

/**
 * Alta. `strictObject`: rechaza `clinica_id` (la pone el servidor desde el
 * perfil), `activo` (nace activo) y cualquier otra clave, en vez de
 * ignorarla. `medico_id` ausente o `null` = tipo de toda la clínica.
 */
export const CrearTipoCitaSchema = z.strictObject({
  nombre: nombreSchema,
  duracion_min: duracionSchema,
  color: colorSchema.optional(),
  medico_id: z.guid('Médico inválido').nullable().optional(),
})

/**
 * Edición parcial. El ÁMBITO (`medico_id`) no se edita: cambiarlo dejaría
 * citas ya agendadas con un tipo de otro médico. Para cambiar de ámbito se
 * archiva y se crea otro. Archivar y reactivar es `activo`.
 */
export const EditarTipoCitaSchema = z.strictObject({
  nombre: nombreSchema.optional(),
  duracion_min: duracionSchema.optional(),
  color: colorSchema.optional(),
  activo: z.boolean().optional(),
}).refine(o => Object.values(o).some(v => v !== undefined), { message: 'Nada que actualizar' })

export type CrearTipoCita = z.infer<typeof CrearTipoCitaSchema>
export type EditarTipoCita = z.infer<typeof EditarTipoCitaSchema>

/** ¿Vale este tipo para una cita de este médico? De toda la clínica, o del mismo médico. */
export function tipoCompatible(tipo: Pick<TipoCita, 'medico_id'>, medicoId: string | null): boolean {
  return tipo.medico_id === null || tipo.medico_id === medicoId
}

export type ErrorTipoCita = 'tipo_no_encontrado' | 'tipo_archivado' | 'tipo_incompatible' | 'tipo_sin_paciente'

/** Texto para el 400 de POST/PUT de citas. */
export const MENSAJE_ERROR_TIPO_CITA: Record<ErrorTipoCita, string> = {
  tipo_no_encontrado: 'El tipo de cita no existe o no está disponible',
  tipo_archivado: 'Ese tipo de cita está archivado',
  tipo_incompatible: 'Ese tipo de cita es de otro médico',
  tipo_sin_paciente: 'Los tipos de cita sólo se usan en citas con paciente o por ligar',
}

export type ResultadoTipoCita =
  | { ok: true; columnas: { tipo_cita_id: string | null; tipo_cita_nombre: string | null } | null }
  | { ok: false; error: ErrorTipoCita }

/**
 * Decide si una cita puede quedar con este tipo, y qué escribir.
 *
 * - `tipoCitaId` es el tipo con el que QUEDARÁ la cita (el que manda el
 *   cuerpo, o el que ya tenía si el cuerpo no lo toca); `null` = sin tipo.
 * - `tipo` es esa fila leída con el cliente de SESIÓN: `null` si la RLS no la
 *   deja ver (otra clínica, o el tipo personal de otro médico).
 * - `recienAsignado`: el cuerpo trae un `tipo_cita_id` distinto del que tenía
 *   la cita. Sólo entonces se exige que esté activo y se toma la instantánea
 *   del nombre; un tipo ya asignado y luego archivado o renombrado se queda
 *   como estaba.
 * - `medicoId` y `conPaciente` son los EFECTIVOS tras la escritura: reasignar
 *   la cita a un médico incompatible con su tipo da `tipo_incompatible` (P5).
 *   D6 amplía P5: `conPaciente` = tiene paciente O está POR LIGAR (nació de
 *   una reserva por enlace, `reserva_canal` no nulo), porque quien reserva
 *   elige tipo. Lo calcula el llamador (`comprobarTipoDelPut` con `porLigar`);
 *   esta función sigue siendo pura y no sabe de dónde viene.
 *
 * ⚠️ QUITAR EL PACIENTE DE UNA CITA CON TIPO DA `tipo_sin_paciente`, aunque el
 * cuerpo no toque el tipo. No limpia el tipo por su cuenta, a propósito: el
 * llamador que quita el paciente tiene que mandar también `tipo_cita_id: null`
 * (entonces `tipoCitaId` es `null` y sale bien). Así ningún camino deja una
 * cita sin paciente con tipo, ni borra el tipo sin que nadie lo haya pedido.
 *
 * `columnas: null` = no hay nada que escribir en `tipo_cita_*`.
 */
export function validarTipoParaCita(args: {
  tipoCitaId: string | null
  tipo: Pick<TipoCita, 'id' | 'medico_id' | 'nombre' | 'activo'> | null
  medicoId: string | null
  conPaciente: boolean
  recienAsignado: boolean
}): ResultadoTipoCita {
  const { tipoCitaId, tipo, medicoId, conPaciente, recienAsignado } = args
  if (tipoCitaId === null) {
    return { ok: true, columnas: recienAsignado ? { tipo_cita_id: null, tipo_cita_nombre: null } : null }
  }
  if (!tipo || tipo.id !== tipoCitaId) return { ok: false, error: 'tipo_no_encontrado' }
  if (!conPaciente) return { ok: false, error: 'tipo_sin_paciente' }
  if (recienAsignado && !tipo.activo) return { ok: false, error: 'tipo_archivado' }
  if (!tipoCompatible(tipo, medicoId)) return { ok: false, error: 'tipo_incompatible' }
  return { ok: true, columnas: recienAsignado ? { tipo_cita_id: tipo.id, tipo_cita_nombre: tipo.nombre } : null }
}

/**
 * ⚠️ EL TEXTO ESTÁ DOS VECES: aquí y en el RAISE EXCEPTION de
 * `validar_tipo_cita_medico()` (migración 20261112150000). Si cambia uno sin el
 * otro, el 400 deja de decir `medico_invalido` y dice `datos_invalidos`.
 */
const MENSAJE_PG_MEDICO_AJENO = 'médico del tipo de cita'

/**
 * Traduce el error de Postgres de un alta o edición de `tipos_cita` a la
 * respuesta HTTP. Nunca devuelve el mensaje crudo de la base.
 */
export function respuestaErrorTipoCita(error: { code?: string; message?: string }): {
  status: number
  body: { error: string; mensaje: string }
} {
  if (error.code === '23505') {
    return { status: 409, body: { error: 'nombre_repetido', mensaje: 'Ya hay un tipo de cita activo con ese nombre' } }
  }
  if (error.code === '23514' && error.message?.includes(MENSAJE_PG_MEDICO_AJENO)) {
    return { status: 400, body: { error: 'medico_invalido', mensaje: 'El médico elegido no es de esta clínica' } }
  }
  if (error.code === '23514' || error.code === '22P02') {
    return { status: 400, body: { error: 'datos_invalidos', mensaje: 'Datos del tipo de cita inválidos' } }
  }
  if (error.code === '42501') {
    return { status: 403, body: { error: 'sin_permisos', mensaje: 'Sin permisos' } }
  }
  return { status: 500, body: { error: 'error_interno', mensaje: 'No se pudo guardar el tipo de cita' } }
}
