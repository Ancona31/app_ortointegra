/**
 * src/lib/agenda/leyendaHusos.ts
 *
 * Tanda K, punto 15 de Angel · la leyenda de husos de la agenda v2:
 * «Mostrando el horario de tu ubicación actual (UTC−6, Mérida)». La rejilla se
 * queda en la hora del DISPOSITIVO (decisión de diseño; cabecera de
 * `horarioRejilla.ts`); la leyenda sólo lo dice cuando puede confundir:
 *   · la clínica tiene consultorios en más de un huso (los que la agenda conoce:
 *     los de toda la clínica para el administrador y la secretaria; los suyos
 *     para el médico invitado, que no ve los demás y no se piden aparte), o
 *   · el dispositivo está en un huso distinto al de los consultorios del médico
 *     que se ve (con «Todos los médicos», los de la clínica).
 * «Huso» es el desfase con UTC en el instante `referencia`, no el nombre de la
 * zona: un dispositivo en America/Mexico_City y un consultorio en
 * America/Merida (los dos UTC−6) no la sacan.
 *
 * El desfase y el lugar salen del dispositivo (`Intl`). El lugar es la ciudad de
 * la zona en español para las de México (`CIUDADES`); para otra, el nombre que
 * da `Intl` en es-MX («hora de Colombia»).
 *
 * ⚠️ MÓDULO PURO: sin `'use client'`, sin Supabase, sin peticiones. Lo pinta
 * `AvisosAgenda` con lo que la agenda ya tiene.
 */
import { desfaseUtc, type ConsultorioRejilla } from '@/lib/agenda/horarioRejilla'

/** La ciudad de cada zona de `ZONAS_MEXICO` (`zonas-mexico.ts`), con acentos. */
const CIUDADES: Readonly<Record<string, string>> = {
  'America/Tijuana': 'Tijuana',
  'America/Mazatlan': 'Mazatlán',
  'America/Hermosillo': 'Hermosillo',
  'America/Mexico_City': 'Ciudad de México',
  'America/Merida': 'Mérida',
  'America/Monterrey': 'Monterrey',
  'America/Matamoros': 'Matamoros',
  'America/Chihuahua': 'Chihuahua',
  'America/Ojinaga': 'Ojinaga',
  'America/Ciudad_Juarez': 'Ciudad Juárez',
  'America/Bahia_Banderas': 'Bahía de Banderas',
  'America/Cancun': 'Cancún',
}

export interface EntradaLeyendaHusos {
  /** Los consultorios que la agenda conoce (`consultoriosV2`); los archivados no cuentan. */
  consultorios: readonly ConsultorioRejilla[]
  /** El médico que enseña la rejilla, o `null` con «Todos los médicos». */
  medicoMostrado: string | null
  zonaDispositivo: string
  /** El instante en que se mide cada desfase (el inicio del rango visible); 0 = ahora. */
  referencia: number
}

/** «UTC−6», «UTC+5:30», «UTC+0»: con el signo menos tipográfico (U+2212). */
export function rotuloUtc(minutos: number): string {
  const abs = Math.abs(minutos)
  const mm = abs % 60
  return `UTC${minutos < 0 ? '−' : '+'}${Math.floor(abs / 60)}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`
}

/** El lugar de una zona, para una persona: su ciudad si es de México; si no, el nombre de `Intl` en es-MX. */
export function lugarDeZona(zona: string, t: number): string {
  if (CIUDADES[zona]) return CIUDADES[zona]
  try {
    const nombre = new Intl.DateTimeFormat('es-MX', { timeZone: zona, timeZoneName: 'longGeneric' })
      .formatToParts(new Date(t)).find(p => p.type === 'timeZoneName')?.value
    if (nombre) return nombre
  } catch { /* zona que no vale: el identificador */ }
  return zona.split('/').pop()?.replace(/_/g, ' ') ?? zona
}

/** La leyenda, o `null` si no hace falta (reglas de la cabecera). */
export function leyendaHusos(e: EntradaLeyendaHusos): string | null {
  const t = e.referencia || Date.now()
  const dispositivo = desfaseUtc(e.zonaDispositivo, t)
  if (dispositivo === null) return null
  /* Sin zona (o una que no vale) cuenta como el dispositivo, como en la rejilla (`desfaseConDispositivo`). */
  const huso = (c: ConsultorioRejilla): number => (c.timezone ? desfaseUtc(c.timezone, t) : null) ?? dispositivo
  const vivos = e.consultorios.filter(c => c.activo !== false)
  const deLaClinica = new Set(vivos.map(huso))
  const delMedico = vivos.filter(c => !e.medicoMostrado || c.medico_id === e.medicoMostrado).map(huso)
  const hace = deLaClinica.size > 1 || delMedico.some(h => h !== dispositivo)
  return hace ? `Mostrando el horario de tu ubicación actual (${rotuloUtc(dispositivo)}, ${lugarDeZona(e.zonaDispositivo, t)})` : null
}
