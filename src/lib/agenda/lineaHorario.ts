/**
 * src/lib/agenda/lineaHorario.ts
 *
 * El horario de siete días en UNA línea, para la fila de cada consultorio en
 * la configuración (G2, punto 5: la maqueta enseña una línea y los días, no
 * siete renglones): días seguidos con la misma hora se juntan
 * («Lun–vie 08:00 – 18:00 · Sáb 08:00 – 13:00»); los cerrados no se dicen.
 *
 * ⚠️ MÓDULO PURO. Sustituye al componente `ResumenHorario` (siete renglones),
 * que se retiró con G2.
 */
import type { Horario } from '@/lib/configApp'
import { DIAS } from '@/lib/agenda/horarioAgenda'

const CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

/** La inicial de cada día, en el orden de `DIAS` (lunes primero). */
export const INICIALES_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export function lineaHorario(h: Horario): string {
  const tramos: { desde: number; hasta: number; horas: string }[] = []
  DIAS.forEach(({ key }, i) => {
    const d = h[key]
    if (!d?.activo) return
    const horas = `${d.inicio} – ${d.fin}`
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.hasta === i - 1 && ultimo.horas === horas) ultimo.hasta = i
    else tramos.push({ desde: i, hasta: i, horas })
  })
  if (!tramos.length) return 'Sin días abiertos'
  return tramos.map(t => {
    const dias = t.desde === t.hasta ? CORTO[t.desde] : `${CORTO[t.desde]}${t.hasta - t.desde > 1 ? '–' : ' y '}${CORTO[t.hasta]?.toLowerCase()}`
    return `${dias} ${t.horas}`
  }).join(' · ')
}
