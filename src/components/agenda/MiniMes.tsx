'use client'

/**
 * src/components/agenda/MiniMes.tsx
 *
 * El minicalendario de mes (bloque F, F3.3, detrás del interruptor). Va en el
 * hueco inferior del panel de Día y en el desplegable de la fecha de la barra
 * de escritorio; en el teléfono no (decisión 21). Pulsar un día llama a
 * `alElegir(fecha)` y el llamador hace `api.gotoDate(d)` conservando la vista.
 * SIN PUNTOS DE OCUPACIÓN: no pide datos (presupuesto de A).
 * Archivo nuevo de F3, sin enchufar todavía.
 *
 * Accesibilidad, patrón de selector de fechas de WAI-ARIA APG:
 *   · `role="grid"` nombrado por el mes; cabeceras de columna con el nombre
 *     entero del día en `abbr`;
 *   · cada día es un botón con la fecha completa en `aria-label`
 *     («miércoles, 11 de noviembre de 2026»); `aria-current="date"` en hoy;
 *     `aria-selected` en la celda de los días del rango visible;
 *   · FOCO ITINERANTE: un solo botón con `tabIndex=0`; flechas, Inicio/Fin y
 *     Re Pág/Av Pág (con Mayús, año) lo mueven (`moverFoco`), y si sale del mes
 *     el mes cambia con él.
 *
 * Las fechas son FECHAS-SOLO (`YYYY-MM-DD`): ver `rejillaMes.ts`.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { desplazarMeses, enRango, moverFoco, rejillaDelMes, type DiaRejilla } from '@/lib/agenda/rejillaMes'

interface Props {
  /** La fecha que enseña al abrir (el inicio del rango visible, o hoy). */
  fechaInicial: string
  hoy: string
  /** El rango que pinta el calendario, `[desde, hasta)`. */
  visibleDesde: string
  visibleHasta: string
  alElegir: (fecha: string) => void
}

const UTC = { timeZone: 'UTC' } as const
const FMT_COMPLETA = new Intl.DateTimeFormat('es-MX', { ...UTC, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const FMT_MES = new Intl.DateTimeFormat('es-MX', { ...UTC, month: 'long', year: 'numeric' })
const aFecha = (f: string): Date => new Date(`${f}T12:00:00Z`)

const CABECERAS = [
  ['L', 'lunes'], ['M', 'martes'], ['X', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo'],
] as const

interface PropsDia { dia: DiaRejilla; foco: string; hoy: string; enVista: boolean; alElegir: (f: string) => void }

function CeldaDia({ dia, foco, hoy, enVista, alElegir }: PropsDia): ReactElement {
  return (
    <td role="gridcell" aria-selected={enVista}>
      <button
        type="button"
        className="ag-minimes-dia"
        data-fecha={dia.fecha}
        data-fuera={!dia.delMes}
        tabIndex={dia.fecha === foco ? 0 : -1}
        aria-label={FMT_COMPLETA.format(aFecha(dia.fecha))}
        aria-current={dia.fecha === hoy ? 'date' : undefined}
        onClick={() => alElegir(dia.fecha)}
      >
        {Number(dia.fecha.slice(8))}
      </button>
    </td>
  )
}

function CabeceraMes({ id, foco, alCambiar }: { id: string; foco: string; alCambiar: (f: string) => void }): ReactElement {
  return (
    <div className="ag-minimes-cab">
      <h2 id={id} className="ag-minimes-titulo" aria-live="polite">{FMT_MES.format(aFecha(foco))}</h2>
      <button type="button" className="ag-capa-cerrar" aria-label="Mes anterior" onClick={() => alCambiar(desplazarMeses(foco, -1))}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <button type="button" className="ag-capa-cerrar" aria-label="Mes siguiente" onClick={() => alCambiar(desplazarMeses(foco, 1))}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function MiniMes({ fechaInicial, hoy, visibleDesde, visibleHasta, alElegir }: Props): ReactElement {
  const [foco, setFoco] = useState(fechaInicial)
  /* El calendario navegó por otra vía: el minicalendario lo sigue. Patrón de
     «ajustar el estado cuando cambia una prop», sin efecto. */
  const [inicialPrevia, setInicialPrevia] = useState(fechaInicial)
  if (inicialPrevia !== fechaInicial) { setInicialPrevia(fechaInicial); setFoco(fechaInicial) }
  const raiz = useRef<HTMLDivElement>(null)
  const porTeclado = useRef(false)
  const idTitulo = useId()

  /* Sólo tras una tecla se lleva el foco al día nuevo: al abrir o al cambiar de
     mes con los botones, no se le roba a nadie. */
  useEffect(() => {
    if (!porTeclado.current) return
    porTeclado.current = false
    raiz.current?.querySelector<HTMLButtonElement>(`[data-fecha="${foco}"]`)?.focus()
  }, [foco])

  function alTeclear(e: KeyboardEvent<HTMLTableElement>): void {
    const nueva = moverFoco(foco, { key: e.key, shiftKey: e.shiftKey })
    if (!nueva) return
    e.preventDefault()
    porTeclado.current = true
    setFoco(nueva)
  }

  return (
    <div ref={raiz} className="ag-minimes">
      <CabeceraMes id={idTitulo} foco={foco} alCambiar={setFoco} />
      <table role="grid" aria-labelledby={idTitulo} className="ag-minimes-rejilla" onKeyDown={alTeclear}>
        <thead>
          <tr>{CABECERAS.map(([c, nombre]) => <th key={nombre} scope="col" abbr={nombre}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rejillaDelMes(foco).map(semana => (
            <tr key={semana[0].fecha}>
              {semana.map(dia => (
                <CeldaDia key={dia.fecha} dia={dia} foco={foco} hoy={hoy}
                  enVista={enRango(dia.fecha, visibleDesde, visibleHasta)} alElegir={alElegir} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
