'use client'

import { CheckCircle2, Clock } from 'lucide-react'

/* El color sale de los tokens `--ag-status-*` de globals.css, los mismos que
 * pinta la agenda. NO vuelvas a poner clases de Tailwind aquí: hasta el
 * bloque 2B este chip tenía las suyas (`text-emerald-700 bg-emerald-50` para
 * confirmada, `bg-blue-50` + #1e5fa8 para agendada) y era la última paleta de
 * estado que quedaba fuera de globals.css. La rotación de colores la habría
 * dejado atrás en silencio: la misma cita saldría de un color en la agenda y de
 * otro en el dashboard, dos pantallas que el médico ve seguidas. Es la misma
 * divergencia que se eliminó al retirar `STATUS_STYLE` de agenda/page.tsx.
 *
 * ⚠️ AQUÍ LOS NOMBRES DE TOKEN SON LITERALES, no interpolados como en la agenda
 * (`var(--ag-status-${status}-dot)`), y esa diferencia es una garantía que
 * conviene no tirar. Un token interpolado que no exista en globals.css no da
 * error de compilación ni de runtime: deja el elemento sin pintar, transparente
 * y sin borde, y nadie se entera. Escritos enteros, un token fantasma sí se ve
 * buscándolo en la hoja, y renombrar la familia rompe aquí de forma localizable.
 * Si algún día esto pasa a interpolación, se pierde eso a cambio de nada: con
 * dos casos no hay repetición que valga la pena ahorrar.
 *
 * ⚠️ DOS ESTADOS A PROPÓSITO, no cinco. Las DOS consultas que alimentan este
 * chip filtran con `.in('status', ['scheduled', 'confirmed'])`
 * (dashboard/page.tsx:178 y dashboard/AsistenteDashboard.tsx:68), así que los
 * otros tres no llegan aquí y ampliarlo sería código sin camino.
 * Los sitios de RENDER sí son tres: la primera consulta alimenta dos, porque
 * `proximaCita` es `proximasCitas[0]` (dashboard/page.tsx:213). No busques una
 * tercera consulta, no existe.
 */
export function StatusChip({ status }: { status: string }) {
  if (status === 'confirmed') return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: 'var(--ag-status-confirmed-text)', background: 'var(--ag-status-confirmed-bg)' }}
    >
      <CheckCircle2 size={10} /> Confirmada
    </span>
  )
  /* Catch-all, no un caso `scheduled` explícito: fijado a `scheduled` porque es
   * lo que este mismo return pintaba antes (azul de «agendada») y porque es el
   * único otro estado que la consulta deja pasar. Si algún día llegara otro,
   * saldría rotulado «Agendada» — eso ya era así, y sigue siéndolo. */
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: 'var(--ag-status-scheduled-text)', background: 'var(--ag-status-scheduled-bg)' }}
    >
      <Clock size={10} /> Agendada
    </span>
  )
}
