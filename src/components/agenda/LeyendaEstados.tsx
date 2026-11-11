/**
 * src/components/agenda/LeyendaEstados.tsx
 *
 * La leyenda de colores de la tarjeta de citas: los cinco estados de
 * `STATUS_CONFIG` más la marca de Google Calendar. Movido tal cual desde
 * `AgendaCliente.tsx` (A2.5.10, movimiento puro, con sus comentarios).
 *
 * SIN PROPS: todo lo que pinta es estático —`STATUS_CONFIG` es una constante
 * importada, no estado del componente—, así que no hay nada que recibir del
 * padre. La condición que decide si se monta (`!isMobile || currentView ===
 * 'listDay'`) se queda en `AgendaCliente.tsx`, igual que el elemento raíz
 * `<div className="ag-leyenda">`, que es el mismo que pintaba allí — `.ag-
 * leyenda` es un área de rejilla de `.agenda-fc` en `globals.css`.
 */

import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import type { Status } from '@/lib/agenda/tiposAgenda'

export function LeyendaEstados() {
  return (
    <div className="ag-leyenda">
      {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            /* UN token y un solo color: `-dot`, que es exactamente el que la
               tarjeta pinta en su `borderLeft`. Aquí hubo un cuadrado que
               mezclaba relleno de `-bg` con barra de `-dot` —dos colores
               para nombrar uno— y de lejos se leía el relleno pálido.
               Nunca un hex: hubo una segunda paleta a mano y enseñaba «No
               asistió» en naranja mientras la tarjeta lo pintaba gris. */
            style={{ backgroundColor: `var(--ag-status-${key}-dot)` }}
          />
          <span className="text-[11px] font-medium text-[var(--ag-muted)]">{cfg.label}</span>
        </div>
      ))}
      {/* ── GOOGLE VA APARTE, DETRÁS DE UNA BARRA ─────────────────────
          Y no como un sexto estado. `STATUS_CONFIG` es `Record<Status, …>`
          y ahí no cabe: un evento de Google no tiene estado de cita, viene
          de otro sitio y no se edita. Meterlo dentro obligaría a ensanchar
          `Status`, que es el tipo del que cuelgan el selector del modal, los
          tokens de color y la exhaustividad que garantiza el compilador. La
          barra dice justo eso: lo de la izquierda es una escala, esto no. */}
      <span aria-hidden className="text-[11px] text-[var(--ag-faint)]">|</span>
      <div className="flex items-center gap-1.5">
        <GoogleGIcon size={11} />
        {/* ── «GCal» Y NO «GOOGLE CALENDAR», POR ANCHO ─────────────────
            Medido el 2026-08-25 a 1280 px de ventana, con la tarjeta a 954
            px de interior: la leyenda pedía 542 px para caber en UNA línea y
            su celda le daba 453,46, así que envolvía a dos y subía el
            toolbar de 60,32 a 74 px. Acortar este rótulo se lleva 63 de esos
            px —de 542 a 479—, que es el recorte más grande que se puede
            hacer sin tocar los cinco rótulos de estado.

            ⚠️ SOLO NO BASTABA: con 479 contra 453,46 seguían faltando 25,54
            y la leyenda seguía en dos líneas. Lo que cerró el hueco fue
            encoger la ETIQUETA DE FECHA —formato corto y 15 px en vez de
            22—, que le devolvió 153,24 px a aquella celda.

            ⚠️ ESA CUENTA CADUCÓ EN EL BLOQUE 8, y lo que queda de ella es el
            orden de magnitud, no el margen. La leyenda ya no comparte fila con
            la fecha: tiene fila propia y dispone del ancho entero de la
            tarjeta menos los 36 px de su relleno, así que la etiqueta de fecha
            salió de esta ecuación y reponerla larga ya no la estrecha.
            Quien la estrecha ahora es el PANEL de la vista Día, que se lleva
            los 300 px del riel más 14 de `gap`: sobre los 954 px de interior
            medidos a 1280 de ventana quedan ~640, o ~604 para el contenido.
            Ahí los 479 de «GCal» entran con holgura; por debajo de ~1155 px
            de ventana, con el panel abierto, ya no —esa cuenta está en
            `globals.css`, en el bloque del reparto de la tarjeta—. El rótulo
            corto se queda porque no cuesta nada y porque es lo que empuja ese
            umbral hacia abajo. Si lo alargas, mide CON EL PANEL PUESTO, que es
            el caso estrecho.

            ⚠️ EL NOMBRE COMPLETO SIGUE ACCESIBLE en el `title`: la
            abreviatura es visual, no semántica, y un lector de pantalla no
            tiene por qué deletrear «GCal». */}
        <span
          className="text-[11px] font-medium text-[var(--ag-gcal-text)]"
          title="Google Calendar"
        >
          GCal
        </span>
      </div>
    </div>
  )
}
