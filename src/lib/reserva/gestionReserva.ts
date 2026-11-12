/**
 * src/lib/reserva/gestionReserva.ts
 *
 * Lo que la CLÍNICA usa para gestionar la reserva por enlace (bloque D, la
 * parte de D1 y D2 que quedó pendiente): quién gestiona qué (lista A, punto
 * 16), los cuerpos que aceptan las rutas de `/api/agenda/enlaces*` y
 * `/api/agenda/reservas/*`, y el estado de un enlace.
 *
 * ⚠️ MÓDULO NEUTRO, sin `'use client'` ni nada de servidor: lo importan las
 * rutas y las secciones de la pantalla de configuración. El código del enlace
 * NO se deriva aquí (eso es `secretos.ts`, sólo servidor).
 */
import { z } from 'zod'
import { canVerAgendaCompleta, isMedico } from '@/lib/permissions'
import type { Role } from '@/hooks/useProfile'

/** Lo mínimo del perfil para decidir permisos. */
export interface PerfilGestion {
  id: string
  role: Role
  es_admin_de_clinica?: boolean
}

/**
 * Lista A, punto 16: cada médico gestiona SUS enlaces y SUS contactos; el
 * administrador de la clínica y la secretaria, los de todos los médicos.
 * Es la misma regla que las policies de `reserva_enlaces` y
 * `reserva_contactos`; aquí se repite para contestar 403 antes de tocar la
 * base y para que la interfaz no ofrezca lo que la RLS va a rechazar.
 */
export function puedeGestionarDelMedico(perfil: PerfilGestion | null, medicoId: string | null): boolean {
  if (!perfil || !medicoId) return false
  return canVerAgendaCompleta(perfil) || (isMedico(perfil) && medicoId === perfil.id)
}

/** ¿Ve lo de todos los médicos (administrador o secretaria)? */
export function gestionaTodos(perfil: PerfilGestion | null): boolean {
  return canVerAgendaCompleta(perfil)
}

const etiquetaSchema = z.string().trim().min(1, 'La etiqueta no puede quedar en blanco')
  .max(60, 'La etiqueta tiene como máximo 60 caracteres')

/**
 * POST /api/agenda/enlaces. `fijo` crea el enlace fijo del médico o lo
 * REGENERA (revoca el vigente y emite otro en una transacción); `unico` emite
 * uno de un solo uso, con la vigencia que la base congela al emitir
 * (`vigencia_enlace_unico_dias` de ESE momento). `strictObject`: ni
 * `clinica_id`, ni `caduca_en`, ni `vigencia_dias` viajan desde el navegador.
 */
export const CrearEnlaceSchema = z.discriminatedUnion('clase', [
  z.strictObject({ clase: z.literal('fijo'), medico_id: z.guid('Médico inválido') }),
  z.strictObject({ clase: z.literal('unico'), medico_id: z.guid('Médico inválido'), etiqueta: etiquetaSchema.nullish() }),
])

/** PATCH /api/agenda/enlaces/[id]: lo único que se hace con un enlace emitido. */
export const RevocarEnlaceSchema = z.strictObject({ accion: z.literal('revocar') })

/** POST /api/agenda/reservas/contactos. */
export const MarcarContactoSchema = z.strictObject({
  cita_id: z.guid('Cita inválida'),
  accion: z.enum(['bloquear', 'desbloquear']),
})

/** Las columnas de `reserva_enlaces` que salen hacia el navegador. Nunca `codigo_hash`. */
export const COLUMNAS_ENLACE = 'id, medico_id, clase, etiqueta, vigencia_dias, caduca_en, usado_en, revocado_en, created_at'

/** Un enlace tal como lo devuelven las rutas (sin el código). */
export interface EnlaceReserva {
  id: string
  medico_id: string
  clase: 'fijo' | 'unico'
  etiqueta: string | null
  vigencia_dias: number | null
  caduca_en: string | null
  usado_en: string | null
  revocado_en: string | null
  created_at: string
}

export type EstadoEnlace = 'vigente' | 'usado' | 'caducado' | 'revocado'

/** El estado de un enlace en `ahora`. Sólo un enlace `vigente` vuelve a enseñar su código. */
export function estadoEnlace(
  e: Pick<EnlaceReserva, 'clase' | 'caduca_en' | 'usado_en' | 'revocado_en'>,
  ahora: Date,
): EstadoEnlace {
  if (e.revocado_en) return 'revocado'
  if (e.clase === 'unico' && e.usado_en) return 'usado'
  if (e.clase === 'unico' && (!e.caduca_en || new Date(e.caduca_en) <= ahora)) return 'caducado'
  return 'vigente'
}

/** Un contacto bloqueado tal como lo devuelve `reserva_contactos_bloqueados()`. */
export interface ContactoBloqueado {
  cita_id: string
  medico_id: string
  nombre: string | null
  telefono: string | null
  correo: string | null
  manual: boolean
  cancelaciones: number
  no_shows: number
  hasta: string | null
}

/** El estado del candado de un contacto (`reserva_contacto_estado`). */
export interface HistorialContacto {
  bloqueado: boolean
  manual: boolean
  cancelaciones: number
  no_shows: number
  hasta: string | null
}

/**
 * «3 cancelaciones · 1 inasistencia», o `null` si no hay ninguna. Lo usan la
 * lista de bloqueados y el historial del modal (D6).
 */
export function frasearHistorial(cancelaciones: number, noShows: number): string | null {
  const partes: string[] = []
  if (cancelaciones > 0) partes.push(`${cancelaciones} ${cancelaciones === 1 ? 'cancelación' : 'cancelaciones'}`)
  if (noShows > 0) partes.push(`${noShows} ${noShows === 1 ? 'inasistencia' : 'inasistencias'}`)
  return partes.length ? partes.join(' · ') : null
}

/**
 * Traduce el error de Postgres de un alta o revocación de enlace. Nunca
 * devuelve el texto crudo de la base.
 *   · 23505: ya hay un fijo vigente (dos pestañas a la vez).
 *   · 23514: el médico no es un médico de la clínica (`proteger_reserva_enlaces`).
 *   · 42501: la RLS o la protección lo rechazan.
 */
export function respuestaErrorEnlace(error: { code?: string }): { status: number; body: { error: string; mensaje: string } } {
  if (error.code === '23505') {
    return { status: 409, body: { error: 'fijo_vigente', mensaje: 'Ese médico ya tiene un enlace fijo vigente; recarga la página' } }
  }
  if (error.code === '23514') {
    return { status: 400, body: { error: 'medico_invalido', mensaje: 'El médico elegido no es un médico de esta clínica' } }
  }
  if (error.code === '42501') {
    return { status: 403, body: { error: 'sin_permisos', mensaje: 'Sin permisos' } }
  }
  return { status: 500, body: { error: 'error_interno', mensaje: 'No se pudo guardar el enlace' } }
}
