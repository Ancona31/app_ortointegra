import { MedicoInfo } from '@/types'

export type PdfColors = { cp: string; cs: string }

export function getPdfColors(medico: MedicoInfo | null): PdfColors {
  return {
    cp: medico?.color_primario  || '#1a3a5c',
    cs: medico?.color_secundario || '#1e5fa8',
  }
}

export function getLogoUrl(medico: MedicoInfo | null, origin: string): string {
  return medico?.logo_url?.startsWith('https://')
    ? medico.logo_url
    : `${origin}/logo.png`
}

/**
 * Genera el HTML del membrete del médico (barra superior, logo, nombre,
 * especialidad, cédulas y contacto). Reutilizado en todos los documentos PDF.
 */
export function buildPdfHeader(
  medico: MedicoInfo | null,
  logoUrl: string,
  cp: string,
  cs: string,
): string {
  const nombre  = medico?.nombre                || 'Médico'
  const esp     = medico?.especialidad          || ''
  const cedProf = medico?.cedula_profesional    || ''
  const cedEsp  = medico?.cedula_especialidad   || ''
  const dir     = medico?.direccion_consultorio || ''
  const tel     = medico?.telefono_consultorio  || ''

  const contacto = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `
  <div class="header">
    <div class="logo-wrap">
      <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
    </div>
    <div class="header-info">
      <div class="doctor-name">${nombre}</div>
      ${esp     ? `<div class="especialidad">${esp}</div>` : ''}
      <div class="credenciales">
        ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
        ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
        ${cedEsp  ? `Cédula Esp.: ${cedEsp}` : ''}
      </div>
      ${contacto ? `<div class="contacto">${contacto}</div>` : ''}
    </div>
  </div>`
}

/** CSS base compartido para el membrete (header, firma, barras). */
export function buildPdfHeaderCss(cp: string, cs: string): string {
  return `
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); width:320px; height:320px; object-fit:contain; opacity:0.05; pointer-events:none; z-index:0; }
  .barra-top { background:linear-gradient(135deg,${cp} 0%,${cs} 100%); height:12px; }
  .barra-bottom { background:linear-gradient(135deg,${cp} 0%,${cs} 100%); height:8px; margin-top:16px; }
  .contenido { padding:12mm 18mm 10mm; position:relative; z-index:1; }
  .header { display:flex; align-items:center; gap:18px; padding-bottom:12px; margin-bottom:12px; border-bottom:2px solid ${cp}; }
  .logo-wrap { width:70px; height:70px; border-radius:50%; border:3px solid ${cs}; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .logo { width:100%; height:100%; object-fit:contain; }
  .header-info { flex:1; }
  .doctor-name { font-size:14pt; font-weight:bold; color:${cp}; line-height:1.2; }
  .especialidad { font-size:9pt; color:${cs}; margin:3px 0; font-style:italic; }
  .credenciales { font-size:8pt; color:#666; }
  .contacto { font-size:7.5pt; color:#888; margin-top:3px; }
  .footer-area { margin-top:24px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; min-width:210px; border-top:1.5px solid ${cp}; padding-top:8px; }
  .firma-nombre { font-weight:bold; font-size:9.5pt; color:${cp}; }
  .firma-ced { font-size:8pt; color:#666; margin-top:2px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }`
}

/** HTML del bloque firma del médico. */
export function buildPdfFirma(medico: MedicoInfo | null, cp: string): string {
  const nombre  = medico?.nombre             || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp  = medico?.cedula_especialidad || ''
  return `
  <div class="footer-area">
    <div class="firma">
      <div class="firma-nombre">${nombre}</div>
      ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
      ${cedEsp  ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>`  : ''}
    </div>
  </div>`
}
