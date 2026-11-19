'use client'

/**
 * El huso horario de la clínica (K3, punto 12): un selector con las zonas de
 * México de siempre (`ZONAS_MEXICO`, las del alta de consultorios). Si la
 * clínica ya tiene una que no está en la lista, se añade para no pisarla. Lo
 * usan el paso de la clínica del funnel y el diálogo del horario de la
 * clínica de «Cuándo das consulta».
 */
import { useId } from 'react'
import { CAMPO_NUEVO } from '@/components/agenda/configuracion/estilosConfig'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'

/** El nombre de una zona para enseñarlo («Yucatán — Mérida, Valladolid (UTC-6)»), o el IANA crudo. */
export function nombreHuso(tz: string): string {
  return ZONAS_MEXICO.find(z => z.value === tz)?.label ?? tz
}

export default function SelectorHuso({ valor, alCambiar }: { valor: string; alCambiar: (tz: string) => void }) {
  const id = useId()
  const zonas = ZONAS_MEXICO.some(z => z.value === valor) ? ZONAS_MEXICO : [{ value: valor, label: valor }, ...ZONAS_MEXICO]
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={id} className="text-[13.5px] sm:text-[13px] font-semibold text-[var(--ag-ink)]">Huso horario de la clínica</label>
      <select id={id} className={`${CAMPO_NUEVO} w-full`} value={valor} onChange={e => alCambiar(e.target.value)}>
        {zonas.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
      </select>
    </div>
  )
}
