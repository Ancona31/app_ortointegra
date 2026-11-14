/**
 * whatsappServidor.ts — la cita para el WhatsApp manual (agenda E7), leída con
 * la SESIÓN. SÓLO SERVIDOR. La usan `POST /api/agenda/whatsapp` y
 * `GET /api/agenda/por-confirmar`.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: qué cita se ve lo decide
 * la RLS de `appointments` (el médico invitado, sólo las suyas), y cada
 * consulta lleva `clinica_id` explícito. Sólo la llaman rutas que ya pasaron
 * por `entradaGestion()` (interruptor encendido): nombra columnas `reserva_*`.
 */
import { z } from 'zod'
import { formatInTimeZone } from 'date-fns-tz'
import { desplazarFecha } from '@/lib/dates'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import { motivoCitaSinWhatsApp, telefonoParaWhatsApp } from '@/lib/agenda/whatsappCita'

export const SELECT_CITA_WHATSAPP =
  'id, title, status, start_time, all_day, paciente_id, reserva_canal, reserva_telefono, consultorio_nombre, consultorio_timezone, ' +
  'whatsapp_sent_at, whatsapp_reminder_sent_at, pacientes(telefono), ' +
  'medico:profiles!appointments_medico_id_fkey(titulo, nombres, apellido_paterno, apellido_materno)'

const Nombre = z.object({
  titulo: z.string().nullable(), nombres: z.string().nullable(),
  apellido_paterno: z.string().nullable(), apellido_materno: z.string().nullable(),
})
const CitaSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  start_time: z.string(),
  all_day: z.boolean().nullable(),
  paciente_id: z.string().nullable(),
  reserva_canal: z.string().nullable(),
  reserva_telefono: z.string().nullable(),
  consultorio_nombre: z.string().nullable(),
  consultorio_timezone: z.string().nullable(),
  whatsapp_sent_at: z.string().nullable(),
  whatsapp_reminder_sent_at: z.string().nullable(),
  pacientes: z.object({ telefono: z.string().nullable() }).nullable(),
  medico: Nombre.nullable(),
})
export type CitaWhatsApp = z.infer<typeof CitaSchema>

/** La cita por id con la RLS de quien llama. null si no existe o no la deja ver. Lanza si la lectura falla. */
export async function leerCitaWhatsApp(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<CitaWhatsApp | null> {
  const { data, error } = await supabase.from('appointments').select(SELECT_CITA_WHATSAPP)
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) throw new Error(`cita para WhatsApp sin leer: ${error.code ?? ''}`)
  if (!data) return null
  const p = CitaSchema.safeParse(data)
  if (!p.success) throw new Error('cita para WhatsApp: forma inesperada')
  return p.data
}

/** Varias citas ya leídas por una consulta propia, validadas con la misma forma. */
export function citasWhatsApp(filas: unknown): CitaWhatsApp[] {
  return z.array(CitaSchema).parse(filas ?? [])
}

/** El teléfono al que va el mensaje: el del paciente y, si no, el de la reserva. */
export function telefonoDeCita(c: CitaWhatsApp): string | null {
  return telefonoParaWhatsApp(c.pacientes?.telefono, c.reserva_telefono)
}

/**
 * ¿Se le puede mandar el WhatsApp? Con paciente o por ligar, agendada o
 * confirmada, con hora y futura. `ahora` en ms. T1: es la regla compartida con
 * el cliente (`motivoCitaSinWhatsApp`, sin el teléfono: la lista de mañana
 * enseña «Sin teléfono» en vez de esconder la fila).
 */
export function citaAdmiteWhatsApp(c: CitaWhatsApp, ahora: number): boolean {
  return motivoCitaSinWhatsApp(c, ahora) === null
}

/** Zona por omisión de una cita sin `consultorio_timezone` (la de la clínica). */
export const ZONA_CITA_POR_OMISION = 'America/Mexico_City'

/**
 * ¿La cita es de MAÑANA en la zona de su consultorio? (plan_E lista A 13:
 * «mañana» se calcula en la zona del consultorio, no en la del navegador ni
 * en la del servidor). `ahora` en ms.
 */
export function esDeManana(inicio: string, zona: string | null, ahora: number): boolean {
  const tz = zona || ZONA_CITA_POR_OMISION
  try {
    const manana = desplazarFecha(formatInTimeZone(new Date(ahora), tz, 'yyyy-MM-dd'), { dias: 1 })
    return formatInTimeZone(new Date(inicio), tz, 'yyyy-MM-dd') === manana
  } catch {
    return false
  }
}
