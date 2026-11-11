'use client'

import { memo } from 'react'

/* ─── Las piezas visuales ──────────────────────────────────────────────── */

/** Un tile del resumen. `valor` es una CADENA ya formateada y no un número
 *  porque el guión de «sin dato» es un valor legítimo — ver `SIN_DATO`. */
export const TileResumen = memo(function TileResumen(
  { valor, etiqueta, tono }: { valor: string; etiqueta: string; tono?: 'primario' },
) {
  return (
    <div className={`ag-tile${tono === 'primario' ? ' ag-tile--primario' : ''}`}>
      <span className="ag-tile-n">{valor}</span>
      <span className="ag-tile-l">{etiqueta}</span>
    </div>
  )
})
