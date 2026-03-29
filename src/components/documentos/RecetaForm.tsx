'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Printer, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { Medicamento } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ConsultaRapida from '@/components/ConsultaRapida'
import { createClient } from '@/lib/supabase/client'
import { imprimirOCompartir } from '@/lib/mobileShare'
import AutocompleteMedicamento from '@/components/AutocompleteMedicamento'
import { MedicamentoDB } from '@/data/medicamentos'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
  color_primario: string
  color_secundario: string
  clinica_nombre: string | null
  direccion_consultorio: string
  telefono_consultorio: string
}

type MedicamentoConVia = Medicamento & { via_administracion?: string }

const VIAS = ['Oral', 'Tópica', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Sublingual', 'Oftálmica', 'Ótica', 'Nasal', 'Inhalatoria', 'Rectal', 'Transdérmica']

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pacienteData, setPacienteData] = useState<{ edad?: number | null; sexo?: string } | null>(null)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])

  useEffect(() => {
    if (!pacienteId) return
    const supabase = createClient()
    supabase.from('pacientes').select('fecha_nacimiento, sexo').eq('id', pacienteId).single()
      .then(({ data }) => {
        if (data) {
          const edad = data.fecha_nacimiento
            ? Math.floor((Date.now() - new Date(data.fecha_nacimiento).getTime()) / (365.25 * 24 * 3600 * 1000))
            : null
          setPacienteData({ edad, sexo: data.sexo })
        }
      })
  }, [pacienteId])

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [medicamentos, setMedicamentos] = useState<MedicamentoConVia[]>([
    { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }
  ])
  const [sugerenciasDosis, setSugerenciasDosis] = useState<string[]>([''])
  const [recomendaciones, setRecomendaciones] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addMed() {
    setMedicamentos([...medicamentos, { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }])
    setSugerenciasDosis(prev => [...prev, ''])
  }

  function removeMed(i: number) {
    setMedicamentos(medicamentos.filter((_, idx) => idx !== i))
    setSugerenciasDosis(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMed(i: number, field: keyof Medicamento, val: string) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function autocompletarMed(i: number, med: MedicamentoDB) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? {
      ...m,
      nombre_comercial: med.nombre_comercial,
      presentacion: med.presentacion,
      principio_activo: med.principio_activo,
    } : m))
    setSugerenciasDosis(prev => prev.map((s, idx) => idx === i ? med.dosis_sugerida : s))
  }

  async function imprimir() {
    setErrorGuardado('')
    setImprimiendo(true)
    try {
    const folio = `R-${Date.now().toString().slice(-8)}`
    const contenido = {
      folio,
      paciente,
      diagnostico,
      medicamentos,
      recomendaciones,
      fecha,
      medico_nombre: medicoInfo?.nombre || '',
      medico_especialidad: medicoInfo?.especialidad || '',
      medico_cedula_profesional: medicoInfo?.cedula_profesional || '',
      medico_cedula_especialidad: medicoInfo?.cedula_especialidad || '',
      clinica_nombre: medicoInfo?.clinica_nombre || '',
      color_primario: medicoInfo?.color_primario || '#1a3a5c',
      color_secundario: medicoInfo?.color_secundario || '#1e5fa8',
    }

    if (pacienteId) {
      const supabase = createClient()
      const { error } = await supabase.from('documentos').insert({
        paciente_id: pacienteId,
        tipo: 'receta',
        contenido,
      })
      if (error) {
        setErrorGuardado('No se pudo guardar la receta en el expediente.')
        return
      }
    }

    const verificacionUrl = `${window.location.origin}/r/${folio}`
    const qrDataUrl = await QRCode.toDataURL(verificacionUrl, { width: 96, margin: 1, color: { dark: '#1a3a5c', light: '#ffffff' } })

    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

    const medsData = medicamentos.filter(m => m.nombre_comercial)
    const meds = medsData.length === 0 ? '' : `
      <table class="meds-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-med">Medicamento</th>
            <th class="col-via">Vía</th>
            <th class="col-ind">Indicaciones</th>
          </tr>
        </thead>
        <tbody>
          ${medsData.map((m, i) => `
          <tr>
            <td class="col-num num-cell">${i + 1}</td>
            <td class="col-med">
              <span class="med-nombre">${m.nombre_comercial.toUpperCase()}${m.presentacion ? ` <span class="med-pres">${m.presentacion}</span>` : ''}</span>
              ${m.principio_activo ? `<br><span class="principio">(${m.principio_activo})</span>` : ''}
            </td>
            <td class="col-via via-cell">${m.via_administracion || 'Oral'}</td>
            <td class="col-ind ind-cell">${m.indicacion || ''}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    `

    const doctorNombre = medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = medicoInfo?.especialidad || ''
    const cedProf = medicoInfo?.cedula_profesional || ''
    const cedEsp = medicoInfo?.cedula_especialidad || ''
    const direccion = medicoInfo?.direccion_consultorio || ''
    const telefono = medicoInfo?.telefono_consultorio || ''
    const logoUrl = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://') ? medicoInfo.logo_url : `${window.location.origin}/logo.png`
    const cp = medicoInfo?.color_primario || '#1a3a5c'
    const cs = medicoInfo?.color_secundario || '#1e5fa8'
    const edadPaciente = pacienteData?.edad
    const sexoPaciente = pacienteData?.sexo === 'M' ? 'Masculino' : pacienteData?.sexo === 'F' ? 'Femenino' : pacienteData?.sexo || ''
    const marcaAguaUrl = logoUrl

    const _html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Receta — ${paciente}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Serif&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; position: relative; }

  /* ── Marca de agua ── */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    width: 320px; height: 320px;
    object-fit: contain; opacity: 0.06;
    pointer-events: none; z-index: 0;
  }

  /* ── Barra superior ── */
  .barra-top {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 12px; width: 100%;
  }

  /* ── Contenido principal ── */
  .contenido { padding: 14mm 18mm 10mm; position: relative; z-index: 1; }

  /* ── Encabezado ── */
  .header {
    display: flex; align-items: center; gap: 18px;
    padding-bottom: 14px; margin-bottom: 14px;
    border-bottom: 2px solid ${cp};
  }
  .logo-wrap {
    width: 78px; height: 78px; border-radius: 50%;
    border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: #f8fafc;
  }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 15pt; font-weight: bold; color: ${cp}; line-height: 1.2; font-family: Arial, sans-serif; }
  .especialidad { font-size: 9.5pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8.5pt; color: #666; }
  .contacto-consultorio { font-size: 8pt; color: #888; margin-top: 3px; }
  .rp-wrap { text-align: right; }
  .rp { font-size: 52pt; font-weight: 900; color: ${cs}; line-height: 1; opacity: 0.85; font-family: 'Noto Serif', Georgia, serif; }
  .folio { font-size: 7.5pt; color: #aaa; text-align: right; margin-top: 2px; font-family: Arial, sans-serif; }

  /* ── Datos del paciente ── */
  .datos-box {
    background: linear-gradient(135deg, ${cp}08, ${cs}08);
    border-left: 4px solid ${cs};
    border-radius: 0 6px 6px 0;
    padding: 10px 14px; margin-bottom: 16px;
  }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9.5pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8.5pt; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.3px; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }

  /* ── Sección header ── */
  .seccion-header {
    display: flex; align-items: center; gap: 8px;
    margin: 16px 0 10px;
  }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo {
    font-size: 8pt; font-weight: bold; color: ${cp};
    text-transform: uppercase; letter-spacing: 1.5px;
    font-family: Arial, sans-serif;
    background: ${cp}12; padding: 3px 10px; border-radius: 20px;
  }

  /* ── Tabla de medicamentos ── */
  .meds-table {
    width: 100%; border-collapse: collapse;
    font-family: Arial, sans-serif;
  }
  .meds-table thead tr {
    background: linear-gradient(135deg, ${cp}, ${cs});
  }
  .meds-table thead th {
    color: #fff; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.8px;
    padding: 6px 10px; text-align: left;
  }
  .meds-table thead th.col-num { text-align: center; width: 24px; }
  .meds-table tbody tr { border-bottom: 1px solid ${cp}18; }
  .meds-table tbody tr:last-child { border-bottom: none; }
  .meds-table tbody tr:nth-child(even) { background: ${cp}05; }
  .meds-table td { padding: 8px 10px; vertical-align: top; font-size: 9.5pt; }
  .num-cell { text-align: center; color: ${cs}; font-weight: 700; font-size: 9pt; }
  .med-nombre { font-weight: 700; color: #111; font-size: 10pt; }
  .med-pres { font-weight: 400; color: #555; font-size: 9pt; }
  .principio { font-style: italic; color: #777; font-size: 8.5pt; }
  .via-cell { color: ${cs}; font-weight: 600; font-size: 8.5pt; white-space: nowrap; }
  .ind-cell { color: #444; line-height: 1.55; }

  .recomendaciones { font-size: 9.5pt; line-height: 1.7; color: #444; white-space: pre-line; padding-left: 10px; }

  /* ── Barra inferior + firma ── */
  .footer-area { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  .qr-area { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .qr-img { width: 72px; height: 72px; }
  .qr-label { font-size: 6.5pt; color: #aaa; font-family: Arial, sans-serif; text-align: center; line-height: 1.4; }
  .firma {
    text-align: center; min-width: 220px;
    border-top: 1.5px solid ${cp}; padding-top: 8px;
  }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; font-family: Arial, sans-serif; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }

  .barra-bottom {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 8px; width: 100%; margin-top: 18px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .barra-top, .barra-bottom { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <img class="watermark" src="${marcaAguaUrl}" onerror="this.style.display='none'" />

  <div class="barra-top"></div>

  <div class="contenido">

    <div class="header">
      <div class="logo-wrap">
        <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
      </div>
      <div class="header-info">
        <div class="doctor-name">${doctorNombre}</div>
        ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
        <div class="credenciales">
          ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
          ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
          ${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}
        </div>
        ${direccion || telefono ? `<div class="contacto-consultorio">${[direccion, telefono ? `Tel: ${telefono}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      </div>
      <div class="rp-wrap">
        <div class="rp">℞</div>
        <div class="folio">${folio}</div>
      </div>
    </div>

    <div class="datos-box">
      <div class="datos-grid">
        <div class="dato"><span class="dato-label">Fecha</span><span class="dato-valor">${fechaFormat}</span></div>
        <div class="dato"><span class="dato-label">Paciente</span><span class="dato-valor">${paciente}</span></div>
        ${edadPaciente != null ? `<div class="dato"><span class="dato-label">Edad</span><span class="dato-valor">${edadPaciente} años</span></div>` : ''}
        ${sexoPaciente ? `<div class="dato"><span class="dato-label">Sexo</span><span class="dato-valor">${sexoPaciente}</span></div>` : ''}
        ${diagnostico ? `<div class="dato" style="grid-column:span 2"><span class="dato-label">Diagnóstico</span><span class="dato-valor">${diagnostico}</span></div>` : ''}
      </div>
    </div>

    <div class="seccion-header">
      <div class="seccion-linea"></div>
      <div class="seccion-titulo">Medicamentos</div>
      <div class="seccion-linea"></div>
    </div>

    ${meds}

    ${recomendaciones ? `
    <div class="seccion-header">
      <div class="seccion-linea"></div>
      <div class="seccion-titulo">Recomendaciones</div>
      <div class="seccion-linea"></div>
    </div>
    <p class="recomendaciones">${recomendaciones}</p>
    ` : ''}

    <div class="footer-area">
      <div class="qr-area">
        <img class="qr-img" src="${qrDataUrl}" />
        <div class="qr-label">Escanea para<br>verificar receta</div>
      </div>
      <div class="firma">
        <div class="firma-nombre">${doctorNombre}</div>
        ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
        ${cedEsp ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>` : ''}
      </div>
    </div>

  </div>

  <div class="barra-bottom"></div>

</body>
</html>
    `
    await imprimirOCompartir(_html, 'receta-medica.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Datos básicos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nombre del paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
        </div>
      </div>

      {/* Medicamentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Medicamentos</h2>
          <button onClick={addMed} className="flex items-center gap-1 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium">
            <Plus size={14} /> Agregar
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {medicamentos.map((med, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">MEDICAMENTO {i + 1}</span>
                {medicamentos.length > 1 && (
                  <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Nombre comercial</label>
                  <AutocompleteMedicamento
                    value={med.nombre_comercial}
                    onChange={val => updateMed(i, 'nombre_comercial', val)}
                    onSelect={m => autocompletarMed(i, m)}
                    placeholder="VOLTAREN"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Presentación</label>
                  <input type="text" value={med.presentacion || ''} onChange={e => updateMed(i, 'presentacion', e.target.value)}
                    placeholder="Tabletas 50 mg" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Vía de administración</label>
                  <select value={(med as MedicamentoConVia).via_administracion || 'Oral'} onChange={e => updateMed(i, 'via_administracion' as any, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                    {VIAS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Principio activo</label>
                  <input type="text" value={med.principio_activo || ''} onChange={e => updateMed(i, 'principio_activo', e.target.value)}
                    placeholder="Diclofenaco sódico" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Indicaciones de administración</label>
                  <textarea value={med.indicacion} onChange={e => updateMed(i, 'indicacion', e.target.value)}
                    placeholder="Tomar 1 tableta cada 8 hrs con alimentos por 7 días"
                    rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  {sugerenciasDosis[i] && (
                    <p className="mt-1 text-xs text-slate-400 flex items-start gap-1">
                      <span className="font-medium text-slate-500">Sugerencia:</span> {sugerenciasDosis[i]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-700 block mb-3">Recomendaciones / Notas</label>
        <textarea value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)}
          placeholder="Uso de inmovilizador, cuidados de herida, cita de seguimiento, datos de alarma..."
          rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
      </div>

      <ConsultaRapida />

      {errorGuardado && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorGuardado}
        </p>
      )}

      <button
        onClick={imprimir}
        disabled={!paciente || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Receta</>}
      </button>
    </div>
  )
}
