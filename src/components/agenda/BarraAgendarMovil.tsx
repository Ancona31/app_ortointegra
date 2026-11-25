/**
 * src/components/agenda/BarraAgendarMovil.tsx
 *
 * La barra fija inferior del teléfono: la ÚNICA puerta para crear una cita
 * en móvil. Movido tal cual desde `AgendaCliente.tsx` (A2.5.9, movimiento
 * puro, con sus comentarios); sólo cambiaron `onClick`/`onMouseEnter`/
 * `onFocus`, que ahora llegan por props en vez de cerrar sobre el estado del
 * componente.
 *
 * ⚠️ MISMO ELEMENTO RAÍZ, SIN NODOS DE MÁS: el `<div className="ag-barra-
 * movil">` de abajo es exactamente el que pintaba `AgendaCliente.tsx`, y la
 * condición `isMobile` que decide si se monta se queda en el padre.
 */

import { Plus } from 'lucide-react'

interface Props {
  onAgendar: () => void
  onIntencionAgendar: () => void
}

export function BarraAgendarMovil({ onAgendar, onIntencionAgendar }: Props) {
  return (
    /* ═══ BARRA INFERIOR MÓVIL ═════════════════════════════════════════
       ⚠️ ES LA ÚNICA PUERTA PARA CREAR EN MÓVIL, y por eso es una barra fija
       y no un botón dentro del scroll. Las vistas de lista NO disparan
       `dateClick` ni `select` —`ListView` se registra como componente
       interactivo pero no implementa consulta de posición—, así que tocar una
       fila abre la cita que ya existe y tocar el hueco no hace nada. Sin esta
       barra, un teléfono no puede agendar.
       De ahí las dos propiedades que no se negocian: no depende de scroll y
       no la tapa nada. Si algún día se esconde al hacer scroll, hay que dar
       antes otra puerta.

       ⚠️ EL `onClick` TIENE EL MISMO CUERPO QUE EL DE ESCRITORIO, LITERALMENTE.
       Mismo bloqueo por suscripción, misma hora de arranque —la de ahora— y
       mismo `tipo: 'cita'`. Dos puertas al mismo sitio tienen que hacer lo
       mismo; si una de las dos cambia, cambian las dos. Pero NO es la MISMA
       función: el padre pasa tres cierres distintos a propósito —éste,
       `CabeceraEscritorio` y `AvisosAgenda`— y no se funden en uno. */
    <div className="ag-barra-movil">
      <button
        type="button"
        className="ag-barra-movil-cta"
        data-onboard="nueva-cita-movil"
        onClick={onAgendar}
        /* A2.6: misma red de seguridad que el botón de escritorio — ver
           su comentario. En táctil no hay `onMouseEnter`, pero no estorba
           dejarlo por si algún día se navega esta barra con teclado. */
        onMouseEnter={onIntencionAgendar}
        onFocus={onIntencionAgendar}
      >
        <Plus size={19} />
        Agendar
      </button>
    </div>
  )
}
