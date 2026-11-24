'use client'

/**
 * src/components/agenda/CapaMasEventos.tsx
 *
 * B13 · remate (AG-DT-280, PIEZAS-MES §4, maqueta `ag-mes` vista 2): la capa del «+N más» del Mes con la
 * v2, en lugar del popover de FullCalendar. Sólo `ih`, `iv` y `esc` (en `ext`/`tel` el «+N» elige el día
 * y el panel ya trae la lista). En `esc` cuelga SOBRE la celda, sin velo oscuro; en `ih`/`iv` es la
 * tarjeta centrada del catálogo con su velo.
 *
 * El título es el enlace al Día (`alIrAlDia`: `cambiarVista`, la misma salida del número del día). Las
 * filas son las del panel del día del teléfono (`FilaDelPanel`, v2) y abren la cita por `abrirCita`,
 * la única puerta. Diálogo modal: foco atrapado, Escape y devolución del foco (`useDialogoModal`).
 */
import { useMemo, type CSSProperties, type ReactElement } from 'react'
import { ChevronRight, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { FilaDelPanel } from '@/components/agenda/FilaDelPanel'
import type { FilaDelDia } from '@/lib/agenda/conteoAgenda'
import { ventanaParaCapas, MARGEN_VENTANA, type Caja } from '@/lib/agenda/posicionCapa'

const FMT_TITULO = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
const ANCHO_ANCLADA = 340

interface Props {
  fecha: Date
  filas: readonly FilaDelDia[]
  /** La celda del día (`esc`); `null` = tarjeta centrada con velo. */
  ancla: Caja | null
  alIrAlDia: () => void
  alAbrir: (id: string) => void
  alCerrar: () => void
}

/** Sobre la celda, desde su esquina de arriba a la izquierda, dentro de la ventana sin el cromo. */
function sobreLaCelda(ancla: Caja): CSSProperties {
  const v = ventanaParaCapas()
  const izq = v.left ?? 0
  const arr = v.top ?? 0
  const left = Math.max(izq + MARGEN_VENTANA, Math.min(ancla.left, izq + v.width - MARGEN_VENTANA - ANCHO_ANCLADA))
  const top = Math.max(arr + MARGEN_VENTANA, Math.min(ancla.top, arr + v.height - MARGEN_VENTANA - 200))
  return { left, top, width: ANCHO_ANCLADA, maxHeight: arr + v.height - MARGEN_VENTANA - top, transformOrigin: '0 0' }
}

function mayuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function CapaMasEventos({ fecha, filas, ancla, alIrAlDia, alAbrir, alCerrar }: Props): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  /* Sólo se monta tras un clic (en el cliente): la ventana se puede medir al pintar. */
  const estilo = useMemo(() => (ancla ? sobreLaCelda(ancla) : undefined), [ancla])
  const titulo = FMT_TITULO.format(fecha)
  return (
    <Portal>
      <div className={ancla ? 'ag-capa-velo ag-capa-velo--claro' : 'ag-capa-velo'} aria-hidden="true" onClick={alCerrar} />
      <div ref={montarPanel} role="dialog" aria-modal="true" aria-label={mayuscula(titulo)} tabIndex={-1}
        onKeyDown={alPulsarTecla} data-capa="mas" style={estilo}
        className={ancla ? 'ag-capa ag-capa-mas' : 'ag-capa ag-capa--centro ag-capa-mas'}>
        <div className="ag-capa-cab">
          <h2 className="ag-capa-titulo">
            <button type="button" className="ag-capa-mas-dia" aria-label={`Ir al ${titulo}`} onClick={alIrAlDia}>
              {mayuscula(titulo)}<ChevronRight size={18} aria-hidden="true" />
            </button>
          </h2>
          <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={alCerrar}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="ag-capa-mas-lista">
          {filas.map(f => <FilaDelPanel key={f.id} fila={f} onAbrir={alAbrir} />)}
          {filas.length === 0 && <p className="ag-capa-mas-vacio">Sin citas este día</p>}
        </div>
      </div>
    </Portal>
  )
}
