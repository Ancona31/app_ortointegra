/**
 * src/lib/agenda/semillaCitas.ts
 *
 * La SEMILLA de citas de la primera pintura (A1.4c): `agenda/page.tsx` lanza en
 * el servidor, sin esperarla, una consulta de tres semanas —la anterior, la de
 * hoy y la siguiente— y le pasa la promesa a `AgendaCliente`, que la parte en
 * las claves EXACTAS que pedirá FullCalendar y la guarda en
 * `cacheRangosCitas.ts`. Así la agenda abre, y se mueve una semana a cada lado,
 * sin `GET /api/appointments`.
 *
 * ⚠️ MÓDULO NEUTRO, sin `'use client'` ni nada de servidor: el rango lo calcula
 * el servidor y la partición el navegador.
 *
 * ⚠️⚠️ POR QUÉ SE PARTE EN EL NAVEGADOR Y NO EN EL SERVIDOR. FullCalendar va
 * sin `timeZone`, así que sus semanas son las del reloj del NAVEGADOR y
 * `rangoQuePedir` las encaja en esa zona. El servidor no la conoce: siembra en
 * `TZ_CLINICA` con un día de margen por lado, y aquí sólo se guarda una semana
 * que quede ENTERA dentro de lo sembrado. Lo que no, se pide a la red como
 * siempre; equivocarse hacia aquí cuesta una petición.
 */
import type { EventInput } from '@fullcalendar/core'
import { desplazarFecha, fechaHoraLocalAInstante, TZ_CLINICA } from '@/lib/dates'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'
import { claveCitas, generacionCitas, guardarCitas, leerCitas } from '@/lib/agenda/cacheRangosCitas'

/** Lo único que la partición mira de cada fila. */
export interface FilaConPuntas { start_time: string; end_time: string }

/** Lo que viaja del servidor al cliente: datos planos, serializables. */
export interface SemillaCitas<F extends FilaConPuntas> {
  /** Identidad de ESTA semilla: una ya guardada no se vuelve a guardar. */
  id: string
  usuario: string
  /** El filtro con el que se consultó: `''` = todos los médicos. */
  filtro: string
  /** La ventana consultada: `desde` inclusivo, `hasta` EXCLUSIVO, en ISO. */
  desde: string
  hasta: string
  /** Reloj del servidor al salir la consulta (ms). */
  salio: number
  appointments: F[]
  incompleta: boolean
}

/**
 * La ventana del servidor: del lunes de la semana anterior a la de `hoy` hasta
 * el lunes de dos semanas después, en `TZ_CLINICA`, más un día por cada lado.
 * `hoy` es `YYYY-MM-DD` en `TZ_CLINICA` (`hoyEnTZ`).
 */
export function ventanaDeLaSemilla(hoy: string): { desde: string; hasta: string } {
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay() // 0 = domingo
  const lunes = desplazarFecha(hoy, { dias: -((diaSemana + 6) % 7) })
  return {
    desde: fechaHoraLocalAInstante(desplazarFecha(lunes, { dias: -7 - 1 }), '00:00', TZ_CLINICA),
    hasta: fechaHoraLocalAInstante(desplazarFecha(lunes, { dias: 14 + 1 }), '00:00', TZ_CLINICA),
  }
}

/** W-1, W y W+1 de `hoy` en la zona del navegador, tal como salen de
 *  `rangoQuePedir`, que es por donde pasa toda petición de FullCalendar. */
export function semanasAlrededor(hoy: Date): { startStr: string; endStr: string }[] {
  return [-7, 0, 7].map((dias) => {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
    const siguiente = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1)
    return rangoQuePedir({ startStr: dia.toISOString(), endStr: siguiente.toISOString() })
  })
}

/**
 * La semilla, partida en las semanas que se pueden GARANTIZAR completas.
 *
 * El filtro por fila es el de `consultaCitas.ts`: `start < fin && end >= inicio`.
 *
 * ⚠️ SI LLEGÓ `incompleta`, el recorte del proveedor se queda con las PRIMERAS
 * filas por `start_time` (`.order()` de la consulta), así que lo que empieza
 * antes del último inicio recibido está entero y lo de después no se sabe. Sólo
 * vale una semana que termine a más tardar ahí; sin filas, ninguna.
 */
export function partirSemilla<F extends FilaConPuntas>(
  semilla: SemillaCitas<F>,
  hoy: Date,
): { clave: string; filas: F[] }[] {
  const desde = Date.parse(semilla.desde)
  const hasta = Date.parse(semilla.hasta)
  const corte = semilla.incompleta
    ? Math.max(-Infinity, ...semilla.appointments.map((f) => Date.parse(f.start_time)))
    : Infinity
  return semanasAlrededor(hoy).flatMap(({ startStr, endStr }) => {
    const inicio = Date.parse(startStr)
    const fin = Date.parse(endStr)
    if (inicio < desde || fin > hasta || fin > corte) return []
    const filas = semilla.appointments.filter(
      (f) => Date.parse(f.start_time) < fin && Date.parse(f.end_time) >= inicio,
    )
    return [{ clave: claveCitas(semilla.usuario, semilla.filtro, startStr, endStr), filas }]
  })
}

/* Las semillas ya guardadas. La caché del router (`staleTimes.dynamic`) puede
   devolverle a una agenda nueva la MISMA semilla de una visita anterior, con
   datos de antes de lo que se escribió en ella: no vuelve a entrar.
   ⚠️ NO SE VACÍA EN `vaciarCacheCitas()`: ésa corre en CADA evento de tiempo
   real y en cada escritura, y olvidar aquí dejaría reaplicar esa semilla vieja
   con una generación ya actual —que es justo lo que este registro impide—. Se
   olvida sólo al cerrar sesión (`olvidarSemillas`, desde `Sidebar.tsx`).
   ⚠️ Y TIENE TOPE (`MAX_SEMILLAS_RECORDADAS`): una pestaña abierta todo el día
   suma una por cada apertura de la agenda. Se descartan las más viejas, que son
   las primeras del `Set` (orden de inserción). La caché del router sólo
   devuelve payloads de los últimos `staleTimes.dynamic` (30 s), así que una
   semilla de hace 50 aperturas ya no puede volver. */
const MAX_SEMILLAS_RECORDADAS = 50
const usadas = new Set<string>()

function recordarSemilla(id: string): void {
  usadas.add(id)
  for (const vieja of usadas) {
    if (usadas.size <= MAX_SEMILLAS_RECORDADAS) break
    usadas.delete(vieja)
  }
}

/** Al cerrar sesión, junto a `vaciarCacheCitas()`; en ningún otro sitio. */
export function olvidarSemillas(): void {
  usadas.clear()
}

/** Lo que una traída de citas espera a la semilla antes de ir a la red. */
export const TOPE_SEMILLA_MS = 3_000

/**
 * La espera de la fuente de citas a la semilla (A1.4c): su marca si entró en
 * la caché a tiempo, o `null` —rechazó, no entró o tardó más de `tope`—. En
 * cualquier `null` la fuente vuelve a mirar la caché, no encuentra su clave y
 * va a la red como siempre. Nunca rechaza.
 */
export function esperarSemilla(semilla: Promise<number | null>, tope: number = TOPE_SEMILLA_MS): Promise<number | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<null>((resolver) => { reloj = setTimeout(() => resolver(null), tope) })
  const llegada = semilla.then((marca) => marca, () => null)
  return Promise.race([llegada, limite]).finally(() => clearTimeout(reloj))
}

/**
 * Guarda la semilla en `cacheRangosCitas`. `gen` es `generacionCitas()` tomada
 * al RECIBIR la promesa: un vaciado entre ese momento y éste la descarta.
 * `recibida` es `Date.now()` de entonces; la vigencia cuenta desde la más vieja
 * de las dos marcas, porque el reloj del servidor no es el de aquí.
 *
 * Devuelve esa marca si la semilla entró —es la «última traída» que vale para
 * el refresco por foco— o `null` si no (ya usada, o un vaciado la invalidó).
 */
export function sembrarCacheCitas<F extends FilaConPuntas>(
  semilla: SemillaCitas<F>,
  traducir: (fila: F) => EventInput,
  gen: number,
  recibida: number,
  hoy: Date = new Date(),
): number | null {
  if (usadas.has(semilla.id)) return null
  recordarSemilla(semilla.id)
  if (gen !== generacionCitas()) return null
  const en = Math.min(semilla.salio, recibida)
  for (const { clave, filas } of partirSemilla(semilla, hoy)) {
    /* Lo que ya trajo la red —la semilla tardó más que el tope— es más nuevo. */
    if (leerCitas(clave)) continue
    guardarCitas(clave, filas.map(traducir), false, en, gen)
  }
  return en
}
