/**
 * Punto único de verdad del calendario propio de Spinus en Google.
 *
 * Spinus ya no escribe en el calendario `primary` del médico: crea y posee un
 * calendario secundario ("Spinus - Dr. Fulano") con el scope NO sensible
 * `calendar.app.created`. Toda la lógica de resolver ese calendario vive aquí
 * — si se reparte por las rutas, el día que un médico borre el calendario
 * desde Google cada ruta se romperá a su manera.
 *
 * PRIVACIDAD — nada clínico sale hacia Google. A este módulo sólo llegan
 * títulos y horarios; notas, motivo de consulta y diagnóstico se quedan en
 * Spinus (ver el comentario "NO enviar notes/descripción" en las rutas).
 */
import { google, type calendar_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/encrypt'
import { componerNombreMedicoCompleto, type CamposNombre } from '@/lib/nombreMedico'

export const GCAL_TIMEZONE = 'America/Mexico_City'

export type GCalCliente = calendar_v3.Calendar

interface FilaTokens {
  access_token:  string | null
  refresh_token: string | null
  expires_at:    number | null
  calendar_id:   string | null
}

/** ¿El error de la API de Google es un 404? Distingue "no existe" de "falló". */
function esNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ('code'   in err && err.code   === 404) return true
  if ('status' in err && err.status === 404) return true
  if ('response' in err && typeof err.response === 'object' && err.response !== null
      && 'status' in err.response && err.response.status === 404) return true
  return false
}

/**
 * Abre sesión con Google para un médico: refresca el token si expiró y
 * devuelve el cliente de Calendar junto al calendario que tenga registrado
 * (null si todavía no se le ha creado uno).
 * Devuelve null si el médico no tiene Google conectado.
 */
async function abrirSesionGoogle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ calendar: GCalCliente; calendarId: string | null } | null> {
  const { data: tokenData } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at, calendar_id')
    .eq('user_id', userId)
    .maybeSingle<FilaTokens>()
  if (!tokenData) return null

  // Una instancia por petición: compartirla entre peticiones concurrentes
  // deja que un usuario sobrescriba las credenciales de otro.
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token:  decrypt(tokenData.access_token),
    refresh_token: decrypt(tokenData.refresh_token),
    expiry_date:   tokenData.expires_at,
  })

  if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await supabase.from('google_tokens').update({
      access_token: credentials.access_token ? encrypt(credentials.access_token) : null,
      expires_at:   credentials.expiry_date ?? null,
    }).eq('user_id', userId)
    oauth2Client.setCredentials(credentials)
  }

  return {
    calendar:   google.calendar({ version: 'v3', auth: oauth2Client }),
    calendarId: tokenData.calendar_id,
  }
}

/**
 * Cliente de Calendar autenticado, sin resolver calendario.
 * Para operar sobre el calendario de Spinus usa `conCalendarioSpinus`.
 */
export async function getGCalClient(
  supabase: SupabaseClient,
  userId: string,
): Promise<GCalCliente | null> {
  const sesion = await abrirSesionGoogle(supabase, userId)
  return sesion?.calendar ?? null
}

/**
 * Crea el calendario de Spinus del médico y persiste su id en `google_tokens`.
 * Se llama desde el callback de OAuth y, si allí falló, desde el helper en la
 * primera operación. Devuelve null si Google no devolvió id.
 */
export async function crearCalendarioSpinus(
  supabase: SupabaseClient,
  userId: string,
  calendar: GCalCliente,
): Promise<string | null> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('titulo, nombres, apellido_paterno')
    .eq('id', userId)
    .maybeSingle<CamposNombre>()

  // Perfil incompleto → "Spinus" a secas, nunca "Spinus - undefined".
  const nombre = perfil ? componerNombreMedicoCompleto(perfil).trim() : ''

  const { data: cal } = await calendar.calendars.insert({
    requestBody: {
      summary:     nombre ? `Spinus - ${nombre}` : 'Spinus',
      timeZone:    GCAL_TIMEZONE,
      description: 'Citas sincronizadas desde Spinus. No borres este calendario.',
    },
  })

  const calendarId = cal?.id ?? null
  if (calendarId) {
    await supabase.from('google_tokens').update({ calendar_id: calendarId }).eq('user_id', userId)
  }
  return calendarId
}

/** ¿Sigue existiendo el calendario? Un error que no sea 404 se lee como "sí". */
async function calendarioVive(calendar: GCalCliente, calendarId: string): Promise<boolean> {
  try {
    await calendar.calendars.get({ calendarId })
    return true
  } catch (err) {
    return !esNotFound(err)
  }
}

/**
 * El médico borró el calendario desde Google: los eventos murieron con él.
 * Se sueltan los vínculos, NUNCA la cita.
 */
async function desvincularCitas(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from('appointments')
    .update({ google_event_id: null, gcal_sync_status: 'unbound' })
    .eq('medico_id', userId)
    .not('google_event_id', 'is', null)
}

/**
 * Ejecuta una operación contra el calendario de Spinus del médico.
 *
 * Resuelve el calendario (creándolo si hace falta), corre la operación y, si
 * Google responde 404 **sobre ese calendario**, lo recrea, desvincula las
 * citas huérfanas y reintenta UNA sola vez. El 404 se confirma con
 * `calendars.get` antes de actuar: un `events.patch` sobre un evento borrado
 * también responde 404 y no debe desencadenar nada de esto.
 *
 * Devuelve null si el médico no tiene Google conectado.
 *
 * Nota: si la operación llevaba un eventId del calendario muerto, el reintento
 * vuelve a fallar y el error sube al llamador — correcto, esa escritura sí
 * falló. La cita ya quedó desvinculada.
 */
export async function conCalendarioSpinus<T>(
  supabase: SupabaseClient,
  userId: string,
  operacion: (calendar: GCalCliente, calendarId: string) => Promise<T>,
): Promise<T | null> {
  const sesion = await abrirSesionGoogle(supabase, userId)
  if (!sesion) return null
  const { calendar } = sesion

  const calendarId = sesion.calendarId ?? await crearCalendarioSpinus(supabase, userId, calendar)
  if (!calendarId) return null

  try {
    return await operacion(calendar, calendarId)
  } catch (err) {
    if (!esNotFound(err)) throw err
    if (await calendarioVive(calendar, calendarId)) throw err

    await desvincularCitas(supabase, userId)
    const recreado = await crearCalendarioSpinus(supabase, userId, calendar)
    if (!recreado) throw err
    return await operacion(calendar, recreado)
  }
}
