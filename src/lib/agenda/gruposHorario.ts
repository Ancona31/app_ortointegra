/**
 * src/lib/agenda/gruposHorario.ts
 *
 * El horario de siete días tal como lo escriben las maquetas de la
 * configuración de la agenda (tanda J, J5: `docs/spec/Main.dc.html` y
 * `Configuracion.dc.html`): los días con la MISMA hora van juntos aunque no
 * sean seguidos, y dentro de cada grupo los días seguidos se escriben como
 * tramo («Lun a vie», tres o más) o par («Lun, Mar»). Las horas sin cero a la
 * izquierda («8:00»). Es la función `daysToLines`/`rowsText` del guion de las
 * maquetas, en TypeScript.
 *
 * No sustituye a `lineaHorario` (`lineaHorario.ts`), que agrupa sólo días
 * seguidos y escribe «08:00»: la usa la configuración vieja.
 *
 * ⚠️ MÓDULO PURO. Recibe un horario YA normalizado (`horarioEfectivo`): un día
 * mal formado tiene que llegar cerrado.
 */
import type { Horario } from '@/lib/configApp'
import { DIAS } from '@/lib/agenda/horarioAgenda'

const CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

/** «08:00» → «8:00». */
export function horaCorta(t: string): string {
  const [h = '', m = '00'] = t.split(':')
  return `${Number(h)}:${m}`
}

/** Los días marcados (lunes primero) en tramos: «Lun a vie», «Lun, Mar», «Sáb». */
function textoDias(marcados: readonly boolean[]): string {
  const tramos: string[] = []
  let i = 0
  while (i < 7) {
    if (!marcados[i]) { i++; continue }
    let j = i
    while (j + 1 < 7 && marcados[j + 1]) j++
    tramos.push(j - i >= 2 ? `${CORTO[i]} a ${CORTO[j].toLowerCase()}` : j > i ? `${CORTO[i]}, ${CORTO[j]}` : CORTO[i])
    i = j + 1
  }
  return tramos.join(', ')
}

interface Grupo { dias: boolean[]; inicio: string; fin: string }

/** Los días abiertos agrupados por su hora, en el orden en que aparece cada hora. */
function grupos(h: Horario): Grupo[] {
  const salida: Grupo[] = []
  DIAS.forEach(({ key }, i) => {
    const d = h[key]
    if (!d?.activo) return
    let g = salida.find(x => x.inicio === d.inicio && x.fin === d.fin)
    if (!g) { g = { dias: [false, false, false, false, false, false, false], inicio: d.inicio, fin: d.fin }; salida.push(g) }
    g.dias[i] = true
  })
  return salida
}

/** Una línea por grupo: «Lun a vie · 8:00 – 18:00». Sin días abiertos, ninguna. */
export function lineasHorario(h: Horario): string[] {
  return grupos(h).map(g => `${textoDias(g.dias)} · ${horaCorta(g.inicio)} – ${horaCorta(g.fin)}`)
}

/** Todo en una frase: «Lun a vie 8:00 – 18:00 · Sáb 8:00 – 13:00». Sin días abiertos, `''`. */
export function textoHorario(h: Horario): string {
  return grupos(h).map(g => `${textoDias(g.dias)} ${horaCorta(g.inicio)} – ${horaCorta(g.fin)}`).join(' · ')
}

const minutos = (t: string): number => {
  const [h = '0', m = '0'] = t.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * «En un día de 8:00 a 18:00 te caben 20 consultas de 30 minutos» (paso 2 del
 * funnel): el primer día abierto del primer horario, como la maqueta. `null`
 * si no hay ninguno o la duración no da para una consulta.
 */
export function consultasQueCaben(horarios: readonly Horario[], duracion: number): { desde: string; hasta: string; cuantas: number } | null {
  if (!(duracion >= 5)) return null
  for (const h of horarios) {
    for (const { key } of DIAS) {
      const d = h[key]
      if (!d?.activo || minutos(d.fin) <= minutos(d.inicio)) continue
      const cuantas = Math.floor((minutos(d.fin) - minutos(d.inicio)) / duracion)
      return cuantas > 0 ? { desde: horaCorta(d.inicio), hasta: horaCorta(d.fin), cuantas } : null
    }
  }
  return null
}
