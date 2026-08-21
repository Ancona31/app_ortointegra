/**
 * src/lib/dates.ts
 *
 * Única fuente de verdad para fechas y horas en Spinus.
 *
 * ───────────────────────────────────────────────────────────────────────
 * LA REGLA
 * ───────────────────────────────────────────────────────────────────────
 *
 * Las horas de CITAS se pintan en el huso del DISPOSITIVO de quien mira.
 *
 * El huso del consultorio se señala APARTE, con un aviso —como ya hace la
 * agenda leyendo `consultorio_timezone` en `agenda/page.tsx:1189-1207`—,
 * NUNCA cambiando el huso de la hora principal.
 *
 * Los DOCUMENTOS CLÍNICOS son la excepción: llevan fecha fija de la clínica
 * (`TZ_CLINICA`) y no cambian según quién los abra. Decisión de producto,
 * tomada a propósito; ver el comentario en `notaRenderData.ts`.
 *
 * ───────────────────────────────────────────────────────────────────────
 * ⚠️  EL HUSO ES OBLIGATORIO. NO HAY VALOR POR DEFECTO. NO SE LO PONGAS.
 * ───────────────────────────────────────────────────────────────────────
 *
 * `hoyEnTZ`, `fechaHoraLocalAInstante` y `renderEnTZ` exigen el parámetro
 * `timezone`. Omitirlo es un error de compilación, y esa es toda la gracia:
 * la red que impide que este bug vuelva no es un test, es `tsc`.
 *
 * Hasta agosto de 2026 las tres llevaban `TZ_CLINICA` como valor por
 * defecto, así que todo llamador que omitía el huso obtenía hora del Centro
 * EN SILENCIO, con código que PARECÍA consciente del huso y no lo era. De
 * ahí salió el bug: una médica en Sonora (`America/Hermosillo`, UTC-7 todo
 * el año, sin horario de verano) veía las horas de sus citas una hora MÁS
 * tarde de lo que eran, porque el dashboard, el contador de `/inicio` y la
 * tarjeta del expediente llamaban a `renderEnTZ` y a `hoyEnTZ` sin pasar
 * huso. La agenda no fallaba: FullCalendar usa `timeZone: 'local'` por
 * defecto y ya pintaba en el huso del dispositivo.
 *
 * El default se quitó auditando sus ~20 llamadores UNO POR UNO. Poner
 * `TZ_CLINICA` en todos habría sido el mismo bug con más letras, así que
 * cada sitio lleva el huso que le toca y los que se quedaron en la zona de
 * la clínica lo dicen por escrito, con el motivo al lado.
 *
 * Si escribes un llamador nuevo y no sabes qué huso pasarle, la respuesta
 * está en LA REGLA de arriba: cita → dispositivo; documento clínico →
 * `TZ_CLINICA`. Si sigue sin estar claro, pregunta antes de elegir; poner
 * `TZ_CLINICA` "porque compila" es reintroducir el default a mano.
 *
 * ───────────────────────────────────────────────────────────────────────
 * QUÉ HAY EN ESTE MÓDULO
 * ───────────────────────────────────────────────────────────────────────
 *
 * Dependientes de huso: `hoyEnTZ`, `fechaHoraLocalAInstante`, `renderEnTZ`.
 * Calculan "hoy", convierten hora-de-pared a UTC y renderizan. Eliminan el
 * desfase de usar UTC del navegador o del servidor.
 *
 * Huso del dispositivo: `tzDispositivo`. SÓLO CLIENTE — ver su docstring.
 *
 * Calendario puro (NO dependen de ningún huso): `desplazarFecha`,
 * `fechaSoloSegura`. Operan sobre fechas-solo ancladas a mediodía; su
 * resultado es independiente de la zona del runtime. Ojo con
 * `fechaSoloSegura`, que corta en UTC: lee su aviso antes de combinarla.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { addDays, addYears, parseISO, format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

/** Zona horaria de la clínica. Única constante de TZ del sistema. */
export const TZ_CLINICA = 'America/Mexico_City'

/**
 * Huso horario del DISPOSITIVO de quien mira. Es el huso con el que se
 * pintan las horas de citas (ver LA REGLA arriba).
 *
 * ⚠️  LLAMAR SÓLO DESDE COMPONENTES DE CLIENTE.
 *
 * En la pasada de servidor, `Intl` devuelve el huso del SERVIDOR —UTC en
 * Vercel—, no el del usuario. Y `'use client'` NO significa "sólo cliente":
 * en el App Router esos componentes SÍ se renderizan en el servidor durante
 * el SSR.
 *
 * Hoy ningún llamador explota, pero por una propiedad ACCIDENTAL, no por
 * una garantía: en los sitios que la usan los datos de citas llegan por
 * `useEffect`, que no corre en el servidor, así que durante el SSR la lista
 * está vacía y estas funciones nunca se ejecutan con datos reales.
 *
 * Basta con que alguien suba uno de esos fetch a un Server Component para
 * que reviente sin aviso, y reventaría PEOR que el bug que este helper
 * arregla: de −1 h constante y visible se pasaría a +7 h en el primer
 * pintado, corrigiéndose sola al hidratar. Un parpadeo es muchísimo más
 * difícil de reportar —y de creerle a quien lo reporta— que un error
 * estable. Si algún día hace falta el huso en servidor, hay que mandarlo
 * desde el cliente, no adivinarlo aquí.
 */
export function tzDispositivo(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * "Hoy" como string YYYY-MM-DD, calculado en la zona indicada.
 * Reemplaza el patrón roto new Date().toISOString().split('T')[0].
 * Bugs 1 y 2.
 *
 * El huso NO es opcional: para horas de citas pásale `tzDispositivo()`; para
 * documentos clínicos, `TZ_CLINICA`. Ver la cabecera.
 */
export function hoyEnTZ(timezone: string): string {
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
 * en la zona indicada) al instante UTC correcto en formato ISO.
 * Reemplaza combinarFechaHora, que interpretaba la hora en la zona del
 * servidor (Vercel = UTC).
 * Bug 3.
 *
 * El huso NO es opcional: para ventanas de citas pásale `tzDispositivo()`.
 * Ver la cabecera.
 */
export function fechaHoraLocalAInstante(
  fecha: string,
  hora: string,
  timezone: string,
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
 *
 * ⚠️  NO ES CONSCIENTE DEL HUSO, y su nombre no lo delata.
 *
 * `fechaISO.split('T')[0]` se queda con la parte de fecha TAL COMO VIENE en
 * la cadena. Si el argumento es un `timestamptz` en ISO —que termina en Z—,
 * eso es EL DÍA EN UTC, no el día en ninguna zona con sentido para el
 * usuario. Combinarla con `hoyEnTZ()` compara DOS HUSOS DISTINTOS entre sí.
 *
 * Es la trampa que tenía `ultimaConsultaLabel` en `expedienteUtils.ts`:
 * comparaba el día en Centro contra el día en UTC, y en Sonora rompía a
 * partir de las 17:00 hora local.
 *
 * Regla: si el valor es un instante (timestamptz), NORMALÍZALO ANTES con
 * `renderEnTZ(valor, 'yyyy-MM-dd', tz)` y pásale a esta función el
 * resultado. Si ya es una fecha-solo, entra directo.
 */
export function fechaSoloSegura(fechaISO: string): Date {
  const fecha = parseISO(`${fechaISO.split('T')[0]}T12:00:00`)
  if (!isValid(fecha)) {
    throw new Error(`fechaSoloSegura: fecha inválida "${fechaISO}"`)
  }
  return fecha
}

/**
 * Formatea un instante UTC para mostrarlo en la zona indicada, con locale
 * español. instante puede ser un Date o un ISO string.
 * Bug 4 (preparación del render simétrico de citas).
 *
 * El huso NO es opcional: para horas de citas pásale `tzDispositivo()`; para
 * documentos clínicos, `TZ_CLINICA`. Ver la cabecera.
 */
export function renderEnTZ(
  instante: string | Date,
  formato: string,
  timezone: string,
): string {
  return formatInTimeZone(instante, timezone, formato, { locale: es })
}
