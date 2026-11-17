/**
 * src/lib/agenda/sustitucionServidor.ts — tanda I, punto 12 de Angel. SÓLO
 * SERVIDOR; lo usa `POST /api/appointments` con `sustituye_a` (la agenda v2).
 *
 * «Reagendar cita» y «Reasignar» de una cita CANCELADA crean otra cita; al
 * entrar la nueva, la cancelada queda CERRADA (`cerrada_en`) y LIGADA a la que
 * la sustituyó (`sustituida_por`), migración 20261121142000. No se borra: se
 * conserva en la base y en la auditoría, y deja de pintarse en la agenda
 * (`consultaCitas` la quita).
 *
 * Dos pasos, en la MISMA petición que crea la nueva:
 *   1. `comprobarSustituible` (ANTES del alta, cliente de SESIÓN y la clínica
 *      explícita): la cita existe, quien pide la ve (RLS), es una cancelada y
 *      no está ya cerrada. Si no, 409 y no se crea nada. Salvo un REINTENTO
 *      de la misma alta (mismo `client_id`, que ya la cerró): pasa, y la ruta
 *      devuelve la cita que ya entró (23505) con su `sustituida`.
 *   2. `cerrarSustituida` (DESPUÉS del alta): ⚠️ CLIENTE DE SERVICIO, filtrado
 *      por `clinica_id` de la sesión, por el id y por «cancelada y abierta».
 *      Por qué: las dos columnas sólo las escribe `service_role`
 *      (`cita_proteger_cierre`, como las `reserva_*`): la sesión no puede
 *      esconder citas de la agenda por PostgREST. Si falla (una carrera: otra
 *      persona la reactivó o la cerró entre el paso 1 y éste), la nueva ya
 *      está creada y la cancelada sigue como estaba: se registra y se devuelve
 *      `null`, nunca un error (no hay nada a medias que deshacer).
 */
import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El veredicto del paso 1: `null` = se puede; si no, el cuerpo y el estado HTTP. */
export type VetoSustitucion = { estado: number; cuerpo: { error: string; message: string } } | null

/** `sustituye_a` del cuerpo: `undefined` si no vino; `false` si vino mal formado. */
export function leerSustituyeA(valor: unknown): string | undefined | false {
  if (valor === undefined || valor === null) return undefined
  return typeof valor === 'string' && UUID.test(valor) ? valor : false
}

/** ¿La cerró ya ESTA misma alta (mismo `client_id`)? Es un reintento: se deja pasar al 23505 de la ruta. */
async function cerradaPorEsteReintento(supabase: ClienteSesion, clinicaId: string, sustitutaId: unknown, clientId: string | null): Promise<boolean> {
  if (!clientId || typeof sustitutaId !== 'string') return false
  const { data } = await supabase.from('appointments').select('id')
    .eq('id', sustitutaId).eq('clinica_id', clinicaId).eq('client_id', clientId).maybeSingle()
  return Boolean(data)
}

export async function comprobarSustituible(
  supabase: ClienteSesion, clinicaId: string, citaId: string, clientId: string | null,
): Promise<VetoSustitucion> {
  const { data, error } = await supabase.from('appointments').select('id, status, cerrada_en, sustituida_por')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) throw new Error(`cita a sustituir sin leer: ${error.code ?? ''}`)
  if (!data) return { estado: 404, cuerpo: { error: 'sustituye_a_invalida', message: 'No se encontró la cita cancelada que se iba a sustituir.' } }
  if (data.cerrada_en && await cerradaPorEsteReintento(supabase, clinicaId, data.sustituida_por, clientId)) return null
  if (data.status !== 'cancelled' || data.cerrada_en) {
    return { estado: 409, cuerpo: { error: 'sustituye_a_invalida', message: 'Esa cita ya no está cancelada o ya se sustituyó: recarga la agenda.' } }
  }
  return null
}

async function yaCerradaPor(o: { clinicaId: string; viejaId: string; nuevaId: string }): Promise<boolean> {
  const { data } = await createAdminClient().from('appointments').select('id')
    .eq('id', o.viejaId).eq('clinica_id', o.clinicaId).eq('sustituida_por', o.nuevaId).maybeSingle()
  return Boolean(data)
}

export async function cerrarSustituida(o: { clinicaId: string; viejaId: string; nuevaId: string; userId: string }): Promise<string | null> {
  const { data, error } = await createAdminClient().from('appointments')
    .update({ cerrada_en: new Date().toISOString(), sustituida_por: o.nuevaId })
    .eq('id', o.viejaId).eq('clinica_id', o.clinicaId).eq('status', 'cancelled').is('cerrada_en', null)
    .select('id')
  if (error || !data?.length) {
    /* Reintento del mismo alta (23505 de la ruta): ya quedó cerrada por ÉSTA; nada que auditar otra vez. */
    if (!error && await yaCerradaPor(o)) return o.viejaId
    logger.warn('agenda', `cancelada sin cerrar tras sustituirla: ${error?.code ?? 'ninguna fila'}`)
    return null
  }
  await logAudit({
    userId: o.userId, accion: 'cita_sustituida', tabla: 'appointments', registroId: o.viejaId,
    descripcion: JSON.stringify({ sustituida_por: o.nuevaId }),
  })
  return o.viejaId
}
