export const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 10mm 15mm; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.4; }

  .header { display:flex; align-items:center; gap:14px; padding-bottom:8px; border-bottom:2.5px solid #1a3a5c; margin-bottom:8px; }
  .logo { width:60px; height:60px; object-fit:contain; flex-shrink:0; }
  .doctor-name { font-size:13pt; font-weight:700; color:#1a3a5c; line-height:1.2; }
  .especialidad { font-size:8.5pt; color:#1e5fa8; margin:2px 0; }
  .credenciales { font-size:8pt; color:#555; }

  .titulo { text-align:center; font-size:10pt; font-weight:700; color:#1a3a5c; text-transform:uppercase; border:1.5px solid #1a3a5c; padding:3px 8px; margin-bottom:8px; letter-spacing:0.5px; }

  .datos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px 12px; margin-bottom:8px; padding:6px 8px; background:#f5f7fa; border-radius:3px; }
  .dato { display:flex; gap:4px; font-size:8.5pt; }
  .dato-label { font-weight:700; color:#1a3a5c; white-space:nowrap; }

  .nota-content { font-size:8.5pt; line-height:1.45; }
  .nota-content strong { color:#1a3a5c; display:block; margin-top:7px; margin-bottom:1px; font-size:9pt; border-bottom:1px solid #dde3ea; padding-bottom:1px; }

  .proxima-cita { margin-top:8px; font-size:8.5pt; padding:4px 8px; background:#e8f4fd; border-left:3px solid #1e5fa8; }

  .footer { margin-top:30px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; border-top:1px solid #333; padding-top:4px; min-width:180px; font-size:8pt; color:#555; }

  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`
