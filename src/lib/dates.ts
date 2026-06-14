/**
 * src/lib/dates.ts
 *
 * Única fuente de verdad para fechas y horas en Spinus.
 *
 * Helpers dependientes de zona horaria (usan TZ_CLINICA): hoyEnTZ,
 * fechaHoraLocalAInstante, renderEnTZ. Calculan "hoy", convierten
 * hora-de-pared a UTC y renderizan, SIEMPRE en la zona de la clínica.
 * Eliminan el desfase de usar UTC del navegador o del servidor.
 *
 * Helpers de calendario puro (NO dependen de TZ_CLINICA): desplazarFecha,
 * fechaSoloSegura. Operan sobre fechas-solo ancladas a mediodía; su
 * resultado es independiente de la zona del runtime.
 *
 * Multiconsultorio: cuando llegue, solo se cambia TZ_CLINICA por una zona
 * por-consultorio. Nada más en la app necesita tocarse.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { addDays, addYears, parseISO, format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

/** Zona horaria de la clínica. Única constante de TZ del sistema. */
export const TZ_CLINICA = 'America/Mexico_City'

/**
 * "Hoy" como string YYYY-MM-DD, calculado en la zona de la clínica.
 * Reemplaza el patrón roto new Date().toISOString().split('T')[0].
 * Bugs 1 y 2.
 */
export function hoyEnTZ(timezone: string = TZ_CLINICA): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd')
}

/**
 * Desplaza una fecha-solo (YYYY-MM-DD) por días y/o años de calendario y
 * devuelve YYYY-MM-DD. Ancla a mediodía para que un cambio de horario de
 * verano nunca sume ni reste un día por error. Calendario puro: no usa TZ.
 * Bug 1 (max de honorarios, +1 año) y Bug 2 (mañana +1d, semana -7d).
 */
export function desplazarFecha(
  fechaISO: string,
  { dias = 0, anios = 0 }: { dias?: number; anios?: number },
): string {
  const base = parseISO(`${fechaISO.split('T')[0]}T12:00:00`)
  if (!isValid(base)) {
    throw new Error(`desplazarFecha: fecha inválida "${fechaISO}"`)
  }
  const desplazada = addDays(addYears(base, anios), dias)
  return format(desplazada, 'yyyy-MM-dd')
}

/**
 * Convierte una fecha + hora "de pared" (tal como las teclea el médico,
 * en la zona de la clínica) al instante UTC correcto en formato ISO.
 * Reemplaza combinarFechaHora, que interpretaba la hora en la zona del
 * servidor (Vercel = UTC).
 * Bug 3.
 */
export function fechaHoraLocalAInstante(
  fecha: string,
  hora: string,
  timezone: string = TZ_CLINICA,
): string {
  const instante = fromZonedTime(`${fecha}T${hora}:00`, timezone)
  if (Number.isNaN(instante.getTime())) {
    throw new Error('Fecha/hora inválida')
  }
  return instante.toISOString()
}

/**
 * Toma una fecha-solo (YYYY-MM-DD, o un ISO completo del que se ignora la
 * hora) y la ancla a mediodía local, devolviendo un Date seguro para
 * comparar con differenceIn* sin que el truncado salte de día.
 * Bug 5: ambos operandos de la comparación deben pasar por aquí.
 */
export function fechaSoloSegura(fechaISO: string): Date {
  const fecha = parseISO(`${fechaISO.split('T')[0]}T12:00:00`)
  if (!isValid(fecha)) {
    throw new Error(`fechaSoloSegura: fecha inválida "${fechaISO}"`)
  }
  return fecha
}

/**
 * Formatea un instante UTC para mostrarlo en la zona de la clínica, con
 * locale español. instante puede ser un Date o un ISO string.
 * Bug 4 (preparación del render simétrico de citas).
 */
export function renderEnTZ(
  instante: string | Date,
  formato: string,
  timezone: string = TZ_CLINICA,
): string {
  return formatInTimeZone(instante, timezone, formato, { locale: es })
}
