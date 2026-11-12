/**
 * src/lib/reserva/gestionServidor.ts
 *
 * La entrada común de las rutas con las que la CLÍNICA gestiona la reserva por
 * enlace: `/api/agenda/enlaces`, `/api/agenda/enlaces/[id]`,
 * `/api/agenda/reservas/contactos` y `/api/agenda/reservas/historial`. Las
 * cuatro hacen lo mismo antes de su trabajo, en el mismo orden, y por eso vive
 * aquí y no repetido cuatro veces:
 *   1. `getUser()` (401). Ninguna decide un redirect: es un nodo terminal.
 *   2. El perfil con clínica (403 sin clínica).
 *   3. El interruptor de la agenda v2 de ESA clínica (404 apagado o sin la
 *      tabla). Con él apagado ninguna de estas rutas nombra una tabla de D,
 *      así que no fallan aunque en producción falten las migraciones.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: lo que se ve y lo que se
 * escribe lo decide la RLS de `reserva_enlaces`, `reserva_contactos`,
 * `reserva_incidencias` y `appointments`. Cada consulta lleva además
 * `clinica_id` explícito (pendiente prioritario de `CLAUDE.md`).
 *
 * SÓLO SERVIDOR.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import type { PerfilGestion } from '@/lib/reserva/gestionReserva'
import { logger } from '@/lib/logger'

export type ClienteSesion = Awaited<ReturnType<typeof createClient>>

export type EntradaGestion =
  | { ok: true; supabase: ClienteSesion; perfil: PerfilGestion; clinicaId: string }
  | { ok: false; respuesta: NextResponse }

/** Las tres puertas comunes, en orden. Nunca lanza: un fallo inesperado es 500. */
export async function entradaGestion(): Promise<EntradaGestion> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    const { data: profile, error } = await supabase.from('profiles')
      .select('id, clinica_id, role, es_admin_de_clinica').eq('id', user.id).maybeSingle()
    if (error) {
      logger.error('agenda', `perfil sin leer en la gestión de reservas: ${error.code ?? ''}`)
      return { ok: false, respuesta: NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
    }
    if (!profile?.clinica_id) return { ok: false, respuesta: NextResponse.json({ error: 'Sin clínica' }, { status: 403 }) }
    if (!(await agendaV2Encendida(supabase, profile.clinica_id))) {
      return { ok: false, respuesta: NextResponse.json({ error: 'no_disponible' }, { status: 404 }) }
    }
    const perfil: PerfilGestion = { id: user.id, role: profile.role, es_admin_de_clinica: profile.es_admin_de_clinica === true }
    return { ok: true, supabase, perfil, clinicaId: profile.clinica_id }
  } catch {
    return { ok: false, respuesta: NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  }
}

/** La cita de reserva que una ruta de gestión va a tocar, leída con la sesión. */
export interface CitaDeReserva {
  id: string
  medico_id: string | null
  reserva_canal: string | null
  reserva_tel_hmac: string | null
  reserva_correo_hmac: string | null
}

/**
 * Lee la cita por id, con la RLS de quien llama y `clinica_id` explícito.
 * `null` si no existe, no la deja ver o no nació de una reserva por enlace.
 * Lanza si la lectura falla (la ruta contesta 500).
 * ⚠️ Sólo la llaman rutas que ya pasaron por `entradaGestion()`: nombra
 * columnas `reserva_*`, que sólo existen con D1 aplicada.
 */
export async function leerCitaDeReserva(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<CitaDeReserva | null> {
  const { data, error } = await supabase.from('appointments')
    .select('id, medico_id, reserva_canal, reserva_tel_hmac, reserva_correo_hmac')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) throw new Error(`cita de reserva sin leer: ${error.code ?? ''}`)
  if (!data?.reserva_canal) return null
  return data
}
