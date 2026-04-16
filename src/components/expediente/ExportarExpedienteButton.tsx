'use client'

import { Paciente, Consulta, Laboratorio, Documento } from '@/types'
import { parseISO, format } from 'date-fns'
import { calcularEdad } from '@/lib/patientUtils'
import { es } from 'date-fns/locale'
import { FileDown } from 'lucide-react'
import { PRINT_CSS, markdownToHtml } from '@/lib/printStyles'

type Addendum = { id: string; consulta_id: string; contenido: string; medico_nombre: string; created_at: string }

interface Props {
  paciente: Paciente
  consultas: Consulta[]
  labs: Laboratorio[]
  documentos: Documento[]
  addendums?: Addendum[]
}

const ESTADO_BADGE: Record<string, string> = {
  optimo:   'background:#d1fae5;color:#065f46',
  suboptimo:'background:#fef9c3;color:#854d0e',
  bajo:     'background:#fee2e2;color:#991b1b',
  alto:     'background:#fee2e2;color:#991b1b',
  normal:   'background:#f1f5f9;color:#475569',
}

const TIPO_DOC: Record<string, string> = {
  receta:              'Receta médica',
  solicitud_lab:       'Solicitud de laboratorio',
  solicitud_imagen:    'Solicitud de imagen',
  informe_clinico:     'Informe clínico',
  plan_suplementacion: 'Plan de suplementación',
}

const EXTRA_CSS = `
  .seccion-titulo {
    font-size:11pt; font-weight:700; color:#1a3a5c; text-transform:uppercase;
    border-bottom:2px solid #1e5fa8; padding-bottom:4px; margin:18px 0 10px;
    letter-spacing:0.4px;
  }
  .consulta-bloque {
    page-break-inside:avoid; border:1px solid #d1d9e6; border-radius:4px;
    padding:10px 12px; margin-bottom:12px;
  }
  .consulta-header {
    display:flex; justify-content:space-between; align-items:baseline;
    margin-bottom:6px;
  }
  .consulta-fecha { font-weight:700; color:#1a3a5c; font-size:9.5pt; }
  .consulta-motivo { font-size:8.5pt; color:#64748b; }
  .diag-chip {
    display:inline-block; background:#eef3fa; color:#1a3a5c; font-size:7.5pt;
    padding:1px 6px; border-radius:3px; margin:2px 2px 2px 0;
  }
  .lab-bloque {
    page-break-inside:avoid; border:1px solid #d1d9e6; border-radius:4px;
    padding:10px 12px; margin-bottom:12px;
  }
  .lab-tabla { width:100%; border-collapse:collapse; margin-top:6px; font-size:8pt; }
  .lab-tabla th {
    background:#f1f5f9; color:#475569; font-weight:600; padding:4px 8px;
    text-align:left; border-bottom:1px solid #cbd5e1;
  }
  .lab-tabla td { padding:3px 8px; border-bottom:1px solid #f1f5f9; }
  .estado-badge {
    display:inline-block; font-size:7pt; padding:1px 5px; border-radius:3px;
    font-weight:600;
  }
  .ia-resumen {
    background:#f8fafc; border-left:3px solid #1e5fa8; padding:6px 10px;
    margin-top:8px; font-size:8pt; color:#334155;
  }
  .alerta-critica { color:#991b1b; font-weight:600; }
  .alerta-warning  { color:#854d0e; }
  .doc-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9; font-size:8.5pt; }
  .antecedentes-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
  .ant-item { font-size:8.5pt; }
  .ant-label { font-weight:700; color:#1a3a5c; font-size:8pt; margin-bottom:2px; }
  .alergia-box {
    background:#fff1f2; border:1px solid #fecdd3; border-radius:4px;
    padding:5px 10px; font-size:8.5pt; color:#9f1239;
    margin-bottom:8px;
  }
  .proxima { background:#e8f4fd; border-left:3px solid #1e5fa8; padding:4px 8px; font-size:8pt; margin-top:6px; }
`

export default function ExportarExpedienteButton({ paciente, consultas, labs, documentos, addendums = [] }: Props) {
  function exportar() {
    const edad = paciente.fecha_nacimiento
      ? calcularEdad(paciente.fecha_nacimiento)
      : null

    const fechaExport = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })

    // Doctor info from most recent consulta that has it
    const consultaConMedico = consultas.find(c => c.medico_nombre)
    const medicoNombre = consultaConMedico?.medico_nombre ?? ''
    const medicoEspecialidad = consultaConMedico?.medico_especialidad ?? ''
    const medicoCedProf = consultaConMedico?.medico_cedula_profesional ?? ''
    const medicoCedEsp = consultaConMedico?.medico_cedula_especialidad ?? ''
    const medicoLogo = consultaConMedico?.medico_logo_url ?? ''

    // ── Encabezado del médico ──────────────────────────────────────────
    const headerHtml = medicoNombre ? `
      <div class="header">
        ${medicoLogo ? `<img class="logo" src="${medicoLogo}" alt="logo"/>` : ''}
        <div>
          <div class="doctor-name">${medicoNombre}</div>
          ${medicoEspecialidad ? `<div class="especialidad">${medicoEspecialidad}</div>` : ''}
          <div class="credenciales">
            ${medicoCedProf ? `Cédula Prof.: ${medicoCedProf}` : ''}
            ${medicoCedEsp ? ` · Ced. Esp.: ${medicoCedEsp}` : ''}
          </div>
        </div>
      </div>
    ` : ''

    // ── Datos del paciente ─────────────────────────────────────────────
    const datosHtml = `
      <div class="datos-grid">
        <div class="dato"><span class="dato-label">Nombre:</span> ${paciente.nombre} ${paciente.apellidos}</div>
        ${paciente.numero_expediente ? `<div class="dato"><span class="dato-label">Expediente:</span> ${paciente.numero_expediente}</div>` : '<div></div>'}
        <div class="dato"><span class="dato-label">Sexo:</span> ${paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Otro'}</div>
        ${paciente.fecha_nacimiento ? `<div class="dato"><span class="dato-label">Fecha nac.:</span> ${format(parseISO(paciente.fecha_nacimiento), 'dd/MM/yyyy')}</div>` : '<div></div>'}
        ${edad !== null ? `<div class="dato"><span class="dato-label">Edad:</span> ${edad.textoElegante}</div>` : '<div></div>'}
        ${paciente.peso_kg ? `<div class="dato"><span class="dato-label">Peso:</span> ${paciente.peso_kg} kg</div>` : '<div></div>'}
        ${paciente.talla_cm ? `<div class="dato"><span class="dato-label">Talla:</span> ${paciente.talla_cm} cm</div>` : '<div></div>'}
        ${paciente.imc ? `<div class="dato"><span class="dato-label">IMC:</span> ${paciente.imc} kg/m²</div>` : '<div></div>'}
        ${paciente.telefono ? `<div class="dato"><span class="dato-label">Teléfono:</span> ${paciente.telefono}</div>` : '<div></div>'}
        ${paciente.email ? `<div class="dato"><span class="dato-label">Email:</span> ${paciente.email}</div>` : '<div></div>'}
      </div>
    `

    // ── Antecedentes ───────────────────────────────────────────────────
    const tieneAntecedentes = paciente.alergias || paciente.ant_patologicos ||
      paciente.ant_quirurgicos || paciente.ant_familiares || paciente.medicamentos_actuales

    const antecedentesHtml = tieneAntecedentes ? `
      <div class="seccion-titulo">Antecedentes</div>
      ${paciente.alergias ? `<div class="alergia-box">⚠ <strong>Alergias:</strong> ${paciente.alergias}</div>` : ''}
      <div class="antecedentes-grid">
        ${paciente.ant_patologicos ? `<div class="ant-item"><div class="ant-label">Patológicos</div>${paciente.ant_patologicos}</div>` : ''}
        ${paciente.ant_quirurgicos ? `<div class="ant-item"><div class="ant-label">Quirúrgicos</div>${paciente.ant_quirurgicos}</div>` : ''}
        ${paciente.ant_familiares ? `<div class="ant-item"><div class="ant-label">Familiares</div>${paciente.ant_familiares}</div>` : ''}
        ${paciente.medicamentos_actuales ? `<div class="ant-item"><div class="ant-label">Medicamentos actuales</div>${paciente.medicamentos_actuales}</div>` : ''}
      </div>
    ` : ''

    // ── Consultas ──────────────────────────────────────────────────────
    const consultasHtml = consultas.length === 0 ? '' : `
      <div class="seccion-titulo">Consultas (${consultas.length})</div>
      ${consultas.map(c => {
        const fecha = format(parseISO(c.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })
        const diagnosticosHtml = (c.diagnosticos || []).map(d =>
          `<span class="diag-chip">${d.codigo_cie10 ? `${d.codigo_cie10} · ` : ''}${d.descripcion}</span>`
        ).join('')

        const consultaAddendums = addendums.filter(a => a.consulta_id === c.id)
        const addendumsHtml = consultaAddendums.length === 0 ? '' : `
          <div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px;">
            <div style="font-size:7.5pt;font-weight:600;color:#1e5fa8;margin-bottom:4px;">Notas aclaratorias (${consultaAddendums.length})</div>
            ${consultaAddendums.map(a => `
              <div style="margin-bottom:6px;padding:5px 8px;background:#f0f4ff;border-left:2px solid #1e5fa8;border-radius:3px;">
                <div style="font-size:7pt;color:#64748b;">${format(parseISO(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })} — ${a.medico_nombre}</div>
                <div style="font-size:8pt;color:#334155;white-space:pre-line;">${a.contenido}</div>
              </div>
            `).join('')}
          </div>
        `

        return `
          <div class="consulta-bloque">
            <div class="consulta-header">
              <span class="consulta-fecha">${fecha}</span>
              <span class="consulta-motivo">${c.motivo_consulta}</span>
            </div>
            ${diagnosticosHtml ? `<div style="margin-bottom:6px">${diagnosticosHtml}</div>` : ''}
            ${c.notas_evolucion ? `<div class="nota-content">${markdownToHtml(c.notas_evolucion)}</div>` : ''}
            ${c.plan_tratamiento ? `<div style="margin-top:6px;font-size:8.5pt"><strong>Plan:</strong> ${c.plan_tratamiento}</div>` : ''}
            ${c.proxima_cita ? `<div class="proxima">Próxima cita: ${c.proxima_cita}</div>` : ''}
            ${addendumsHtml}
          </div>
        `
      }).join('')}
    `

    // ── Laboratorios ───────────────────────────────────────────────────
    const labsHtml = labs.length === 0 ? '' : `
      <div class="seccion-titulo">Laboratorios (${labs.length})</div>
      ${labs.map(lab => {
        const fecha = format(parseISO(lab.fecha_toma), "d 'de' MMMM 'de' yyyy", { locale: es })
        const resultados = lab.resultados || []

        const tablaHtml = resultados.length > 0 ? `
          <table class="lab-tabla">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Valor</th>
                <th>Rango ref.</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${resultados.map(r => {
                const estilo = r.estado ? (ESTADO_BADGE[r.estado] ?? '') : ''
                return `
                  <tr>
                    <td>${r.nombre}</td>
                    <td>${r.valor}${r.unidad ? ` ${r.unidad}` : ''}</td>
                    <td style="color:#64748b">${r.rango_optimo || r.rango_ref || '—'}</td>
                    <td>${r.estado ? `<span class="estado-badge" style="${estilo}">${r.estado}</span>` : '—'}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        ` : ''

        const ia = lab.analisis_ia
        const iaHtml = ia ? `
          <div class="ia-resumen">
            ${ia.resumen_clinico ? `<p style="margin-bottom:4px">${ia.resumen_clinico}</p>` : ''}
            ${ia.alertas?.filter(a => a.tipo === 'critica').map(a =>
              `<p class="alerta-critica">⚠ ${a.parametro}: ${a.mensaje}</p>`
            ).join('') ?? ''}
            ${ia.suplementos_recomendados?.filter(s => s.prioridad === 'alta').map(s =>
              `<p>• <strong>${s.nombre}</strong>${s.dosis ? ` ${s.dosis}` : ''}: ${s.justificacion}</p>`
            ).join('') ?? ''}
          </div>
        ` : ''

        return `
          <div class="lab-bloque">
            <span style="font-weight:700;color:#1a3a5c;font-size:9.5pt">${fecha}</span>
            ${tablaHtml}
            ${iaHtml}
          </div>
        `
      }).join('')}
    `

    // ── Documentos ─────────────────────────────────────────────────────
    const docsHtml = documentos.length === 0 ? '' : `
      <div class="seccion-titulo">Documentos generados (${documentos.length})</div>
      ${documentos.map(d => {
        const fecha = d.created_at ? format(parseISO(d.created_at), "dd/MM/yyyy", { locale: es }) : ''
        const tipo = TIPO_DOC[d.tipo as string] ?? d.tipo
        return `<div class="doc-row"><span>${tipo}</span><span style="color:#64748b">${fecha}</span></div>`
      }).join('')}
    `

    // ── Footer ─────────────────────────────────────────────────────────
    const footerHtml = `
      <div style="margin-top:24px;border-top:1px solid #d1d9e6;padding-top:8px;font-size:7.5pt;color:#94a3b8;display:flex;justify-content:space-between">
        <span>Spinus® · Expediente exportado el ${fechaExport}</span>
        <span>Documento confidencial — uso médico exclusivo</span>
      </div>
    `

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Expediente — ${paciente.nombre} ${paciente.apellidos}</title>
  <style>${PRINT_CSS}${EXTRA_CSS}</style>
</head>
<body>
  ${headerHtml}
  <div class="titulo">Expediente Clínico</div>
  ${datosHtml}
  ${antecedentesHtml}
  ${consultasHtml}
  ${labsHtml}
  ${docsHtml}
  ${footerHtml}
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  return (
    <button
      onClick={exportar}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#1e5fa8] transition-colors py-1"
    >
      <FileDown size={13} /> Exportar PDF
    </button>
  )
}
