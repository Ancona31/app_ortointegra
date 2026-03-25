export const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 10mm 15mm; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.4; }

  /* Encabezado */
  .header { display:flex; align-items:center; gap:14px; padding-bottom:8px; border-bottom:2.5px solid #1a3a5c; margin-bottom:8px; }
  .logo { width:60px; height:60px; object-fit:contain; flex-shrink:0; }
  .doctor-name { font-size:13pt; font-weight:700; color:#1a3a5c; line-height:1.2; }
  .especialidad { font-size:8.5pt; color:#1e5fa8; margin:2px 0; }
  .credenciales { font-size:8pt; color:#555; }

  /* Título del documento */
  .titulo { text-align:center; font-size:10pt; font-weight:700; color:#1a3a5c; text-transform:uppercase; border:1.5px solid #1a3a5c; padding:3px 8px; margin-bottom:8px; letter-spacing:0.5px; }

  /* Datos del paciente */
  .datos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px 12px; margin-bottom:8px; padding:6px 8px; background:#f5f7fa; border-radius:3px; }
  .dato { display:flex; gap:4px; font-size:8.5pt; }
  .dato-label { font-weight:700; color:#1a3a5c; white-space:nowrap; }

  /* Contenido SOAP */
  .nota-content { font-size:8.5pt; line-height:1.5; }
  .nota-content p { margin-bottom:3px; }

  /* Solo los encabezados de sección SOAP van resaltados */
  .nota-content .seccion-soap {
    color:#1a3a5c;
    font-size:9pt;
    font-weight:700;
    display:block;
    margin-top:9px;
    margin-bottom:2px;
    padding:2px 6px;
    background:#eef3fa;
    border-left:3px solid #1e5fa8;
  }

  /* Negrita normal dentro del contenido — sin resaltado */
  .nota-content strong {
    font-weight:600;
    color:#1a1a1a;
  }

  /* Próxima cita */
  .proxima-cita { margin-top:8px; font-size:8.5pt; padding:4px 8px; background:#e8f4fd; border-left:3px solid #1e5fa8; }

  /* Firma */
  .footer { margin-top:28px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; border-top:1px solid #333; padding-top:4px; min-width:180px; font-size:8pt; color:#555; }

  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`

// Encabezados SOAP reconocidos — solo estos van resaltados
const SOAP_HEADERS = /^\*\*(S\s*[\(（]|O\s*[\(（]|A\s*[\(（]|P\s*[\(（]|Pronóstico|Pronostico)/i

// Convierte markdown a HTML limpio para impresión
export function markdownToHtml(texto: string): string {
  const lineas = texto.split('\n')
  let html = ''

  for (const linea of lineas) {
    const trimmed = linea.trim()
    if (!trimmed) {
      html += '<br/>'
      continue
    }

    // Detectar encabezados SOAP: **S (Subjetivo):**, **O (Objetivo):**, etc.
    const soapMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/)
    if (soapMatch && SOAP_HEADERS.test(trimmed)) {
      html += `<span class="seccion-soap">${soapMatch[1]}</span>`
      continue
    }

    // Resto del contenido: convertir **negrita** inline sin resaltado
    const contenido = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html += `<p>${contenido}</p>`
  }

  return html
}
