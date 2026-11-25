/**
 * src/lib/agenda/rejillaMes.ts
 *
 * La aritmética del minicalendario de mes (bloque F, F3.3, detrás del
 * interruptor): qué días pinta y adónde va el foco con cada tecla. Pura y en
 * FECHAS-SOLO (`YYYY-MM-DD`), sin `Date` con huso: un día del calendario no
 * tiene hora, y tratarlo como instante es como se cuela un día de más o de
 * menos con el cambio de horario. Se apoya en `desplazarFecha` de
 * `src/lib/dates.ts`, que ya ancla a mediodía por ese mismo motivo.
 *
 * El nombre del archivo NO es `miniMes.ts` a propósito: con `MiniMes.tsx` al
 * lado serían dos nombres que sólo se distinguen por la mayúscula, y eso no
 * compila en macOS ni en Windows (CLAUDE.md, «Estilo de código»).
 */
import { desplazarFecha } from '@/lib/dates'

export interface DiaRejilla {
  fecha: string
  /** `false` en los días del mes anterior o siguiente que rellenan la rejilla. */
  delMes: boolean
}

/** Día de la semana de una fecha-solo, con el lunes = 0 … domingo = 6. */
export function diaSemanaLunes(fecha: string): number {
  return (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7
}

/** `YYYY-MM-01` del mes de una fecha. */
export function primeroDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

/** Cuántos días tiene el mes de una fecha (año bisiesto incluido). */
export function diasDelMes(fecha: string): number {
  const [a, m] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/**
 * Seis semanas fijas, lunes primero. SEIS SIEMPRE, aunque el mes quepa en
 * cinco o en cuatro: así el minicalendario mide lo mismo todos los meses y
 * cambiar de mes no mueve lo que hay debajo (el panel de Día, el desplegable).
 */
export function rejillaDelMes(fechaDelMes: string): DiaRejilla[][] {
  const uno = primeroDelMes(fechaDelMes)
  const inicio = desplazarFecha(uno, { dias: -diaSemanaLunes(uno) })
  const mes = uno.slice(0, 7)
  const semanas: DiaRejilla[][] = []
  for (let s = 0; s < 6; s++) {
    const semana: DiaRejilla[] = []
    for (let d = 0; d < 7; d++) {
      const fecha = desplazarFecha(inicio, { dias: s * 7 + d })
      semana.push({ fecha, delMes: fecha.slice(0, 7) === mes })
    }
    semanas.push(semana)
  }
  return semanas
}

/**
 * La misma fecha `n` meses después (o antes), con el día recortado al último
 * del mes de destino: del 31 de enero, un mes adelante es el 28 o 29 de febrero.
 */
export function desplazarMeses(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const destino = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`
  const dia = Math.min(d, diasDelMes(destino))
  return `${destino.slice(0, 8)}${String(dia).padStart(2, '0')}`
}

/** La tecla tal como llega, con Mayús (Mayús+Re Pág cambia de año, como en APG). */
export interface TeclaRejilla { key: string; shiftKey: boolean }

/**
 * Adónde va el foco con una tecla, según el patrón de selector de fechas de
 * WAI-ARIA APG: flechas (día y semana), Inicio/Fin (lunes y domingo de esa
 * semana), Re Pág/Av Pág (mes; con Mayús, año). `null`: la tecla no es suya.
 */
export function moverFoco(fecha: string, t: TeclaRejilla): string | null {
  switch (t.key) {
    case 'ArrowLeft': return desplazarFecha(fecha, { dias: -1 })
    case 'ArrowRight': return desplazarFecha(fecha, { dias: 1 })
    case 'ArrowUp': return desplazarFecha(fecha, { dias: -7 })
    case 'ArrowDown': return desplazarFecha(fecha, { dias: 7 })
    case 'Home': return desplazarFecha(fecha, { dias: -diaSemanaLunes(fecha) })
    case 'End': return desplazarFecha(fecha, { dias: 6 - diaSemanaLunes(fecha) })
    case 'PageUp': return desplazarMeses(fecha, t.shiftKey ? -12 : -1)
    case 'PageDown': return desplazarMeses(fecha, t.shiftKey ? 12 : 1)
    default: return null
  }
}

/** ¿`fecha` cae en `[desde, hasta)`? Fechas-solo; `hasta` exclusivo, como el rango de FullCalendar. */
export function enRango(fecha: string, desde: string, hasta: string): boolean {
  return fecha >= desde && fecha < hasta
}
