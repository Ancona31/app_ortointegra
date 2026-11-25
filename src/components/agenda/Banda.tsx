'use client'

import { type ReactElement, type ReactNode } from 'react'

/* ═══ BLOQUE 9 · LAS BANDAS DE AVISO ══════════════════════════════════════
   Las cuatro bandas que pueden aparecer entre el toolbar y la rejilla. Viven
   todas dentro de UN envoltorio, `<div class="ag-avisos">`, y ése es el detalle
   que importa.

   ⚠️⚠️ POR QUÉ UN ENVOLTORIO Y NO UNA FILA NUEVA EN EL GRID. `.agenda-fc`
   reparte sus piezas con un `grid-template-rows` y un `grid-template-areas` que
   TIENEN QUE TENER EL MISMO NÚMERO DE FILAS, y descuadrar ese par ya dejó el
   calendario entero en blanco una vez, sin un solo error, durante dos bloques
   de trabajo (la historia está escrita al lado de la regla, en globals.css).
   Añadir tres bandas por la vía de las áreas serían tres filas nuevas en los dos
   sitios y tres ocasiones de repetir aquello. Con el envoltorio, el par sigue
   siendo 4 ↔ 4 y no se toca: lo único que cambia es QUIÉN ocupa el área `banda`
   —antes `.ag-banda-compacta`, ahora el envoltorio— y las bandas se apilan
   dentro de él como bloques. Una sola línea de CSS movida.

   ⚠️ EL ENVOLTORIO SE PINTA SIEMPRE, incluso vacío. Sin bandas mide cero —el
   área es `auto` y dentro no hay nada— y a cambio le da a la barra de carga un
   ancla fija donde posicionarse sin empujar la rejilla hacia abajo.

   ── EL ORDEN EN QUE SE PINTAN ES LA PRIORIDAD ──────────────────────────────
   Está escrito AQUÍ, junto a la pieza que las cuatro comparten, y no en el JSX
   donde se montan: allí el orden es una línea que cualquiera reordena sin ver
   que estaba decidido. De más grave a menos, que es el orden en que hay que
   leerlas:

     1. ERROR DE CARGA — faltan datos y no se sabe cuáles. Es lo único que
        invalida lo que se está viendo.
     1 bis. CITAS INCOMPLETAS — llegaron datos válidos, pero no todos: la traída
        tocó el techo de filas del proveedor. Va JUSTO DESPUÉS de la 1 y con su
        mismo tono porque es la misma clase de gravedad —lo que se ve no es la
        agenda— y NUNCA sale con ella: la 1 se escribe en el `catch` y ésta en el
        camino de éxito. Si algún día pudieran coincidir, la 1 manda.
     2. FALLO DE GOOGLE — falta una PARTE conocida de los datos. Grave, pero la
        agenda propia de debajo es correcta.
     3. VACÍO — no falta nada: no hay nada. Sólo se pinta si NINGUNA de las de
        arriba está puesta, y el porqué está en su propia condición.
     4. VISTA COMPACTA — no falta nada y no es un aviso de datos: es la confesión
        de un recorte que pidió el usuario. Va la última porque es la única que
        habla de la vista y no del contenido.

   Pueden coincidir todas menos la 3, que se excluye con la 1, la 1 bis y la 2. */

/** La caja de una banda. Las cuatro comparten geometría y sólo cambia el tono. */
export function Banda(
  { tono, urgente, saliendo, children }: {
    tono: 'error' | 'gcal' | 'vacio'
    /** `role="alert"` en vez de `role="status"`: interrumpe al lector de
     *  pantalla. Sólo la banda de error lo lleva — una agenda que no cargó sí
     *  merece cortar lo que se estuviera leyendo; un día sin citas, no. */
    urgente?: boolean
    /** Bloque F (F2.8): la banda ya no aplica y se está desvaneciendo antes de
     *  desmontarse. La pone `ConSalida` (`AvisosAgenda.tsx`); el CSS lee
     *  `data-estado`. Mientras sale va `inert` y no `aria-hidden`: lo que dice
     *  ya no es verdad y se oculta a las ayudas técnicas, pero además suelta el
     *  foco (p. ej. el del botón que la acaba de apagar), que `aria-hidden` no
     *  puede contener. */
    saliendo?: boolean
    children: ReactNode
  },
): ReactElement {
  return (
    <div className={`ag-aviso ag-aviso--${tono}`} role={urgente ? 'alert' : 'status'}
      data-estado={saliendo ? 'saliendo' : undefined} inert={saliendo || undefined}>
      {children}
    </div>
  )
}
