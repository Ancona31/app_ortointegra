/**
 * ExpedienteCompletoPdf.tsx — expediente clínico completo en un solo Document.
 *
 * Compone, sin duplicar plantilla:
 *   página(s) de hoja frontal  →  {@link PaginaHojaFrontal}
 *   N notas de evolución       →  {@link PaginaNota} (contexto 'expediente')
 *
 * Cada nota arranca en página nueva por el break natural de `<Page>`; su
 * header y footer siguen siendo `fixed` por página, como en la nota suelta.
 * La numeración es continua sobre TODO el documento porque `pageNumber` y
 * `totalPages` de react-pdf son globales al Document.
 *
 * La paleta se deriva UNA vez aquí y viaja por prop a todas las páginas: las
 * notas de un expediente son de la misma clínica, y `derivarPaletaNota` corre
 * bucles de contraste WCAG que no vale repetir por nota.
 */

import { Document } from '@react-pdf/renderer'
import { PaginaHojaFrontal } from './HojaFrontalPdf'
import { PaginaNota } from './NotaEvolucionPdf'
import { derivarPaletaNota } from './paletaNota'
import type { HojaFrontalData } from '@/lib/hojaFrontalData'
import type { NotaRenderData } from '@/lib/notaRenderData'

export interface ExpedienteCompletoData {
  hojaFrontal: HojaFrontalData
  /** Una por consulta, en orden cronológico ascendente. */
  notas: NotaRenderData[]
}

export interface ExpedienteCompletoProps {
  data: ExpedienteCompletoData
  /** Logo de la clínica ya resuelto a base64 por el pipeline. */
  logoUrl?: string
}

export function renderExpedienteCompleto(props: ExpedienteCompletoProps) {
  return <ExpedienteCompletoPdf {...props} />
}

export default function ExpedienteCompletoPdf({ data, logoUrl }: ExpedienteCompletoProps) {
  const paleta = derivarPaletaNota(
    data.hojaFrontal.colorPrimario,
    data.hojaFrontal.colorSecundario,
  )

  return (
    <Document>
      <PaginaHojaFrontal data={data.hojaFrontal} logoUrl={logoUrl} paleta={paleta} />
      {data.notas.map((nota, i) => (
        <PaginaNota
          key={`nota-${i}`}
          data={nota}
          logoUrl={logoUrl}
          paleta={paleta}
          contexto="expediente"
        />
      ))}
    </Document>
  )
}
