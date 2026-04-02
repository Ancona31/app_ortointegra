'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useState } from 'react'
import { Printer, Loader2, Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
}

interface LineaConcepto {
  id: number
  concepto: string
  precio: string
}

const FORMAS_PAGO = ['Efectivo', 'Transferencia bancaria', 'Tarjeta de crédito', 'Tarjeta de débito', 'Cheque']

function generarFolio(): string {
  const now = new Date()
  const ymd = format(now, 'yyyyMMdd')
  const seq = String(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()).padStart(5, '0')
  return `NOH-${ymd}-${seq}`
}

type Divisa = 'MXN' | 'USD'

function fmt(n: number, divisa: Divisa = 'MXN'): string {
  return n.toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', { style: 'currency', currency: divisa })
}

export default function NotaHonorariosForm({ pacienteInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente]       = useState(pacienteInicial)
  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0])
  const [rfcMedico, setRfcMedico]     = useState('')
  const [rfcPaciente, setRfcPaciente] = useState('')
  const [formaPago, setFormaPago]     = useState('Efectivo')
  const [folio]                       = useState(generarFolio)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [lineas, setLineas]           = useState<LineaConcepto[]>([{ id: 1, concepto: '', precio: '' }])
  const [nextId, setNextId]           = useState(2)
  const [divisa, setDivisa]           = useState<Divisa>('MXN')

  const total = lineas.reduce((sum, l) => sum + (parseFloat(l.precio) || 0), 0)
  const puedeImprimir = lineas.some(l => l.concepto.trim() !== '' && parseFloat(l.precio) > 0)

  function agregarLinea() {
    setLineas(prev => [...prev, { id: nextId, concepto: '', precio: '' }])
    setNextId(n => n + 1)
  }

  function eliminarLinea(id: number) {
    if (lineas.length === 1) return
    setLineas(prev => prev.filter(l => l.id !== id))
  }

  function updateLinea(id: number, field: 'concepto' | 'precio', value: string) {
    setLineas(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  async function imprimir() {
    if (!puedeImprimir) return
    flushSync(() => setImprimiendo(true))
    try {
      const lineasValidas = lineas.filter(l => l.concepto.trim() !== '' && parseFloat(l.precio) > 0)
      const supabase = createClient()
      await supabase.from('documentos').insert({
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
        tipo: 'nota_honorarios',
        contenido: {
          paciente, fecha, folio,
          rfc_medico: rfcMedico,
          rfc_paciente: rfcPaciente,
          lineas: lineasValidas,
          monto: total,
          divisa,
          forma_pago: formaPago,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      const cp      = medicoInfo?.color_primario       || '#1a3a5c'
      const cs      = medicoInfo?.color_secundario      || '#1e5fa8'
      const nombre  = medicoInfo?.nombre                || 'Médico'
      const esp     = medicoInfo?.especialidad          || ''
      const cedProf = medicoInfo?.cedula_profesional    || ''
      const cedEsp  = medicoInfo?.cedula_especialidad   || ''
      const dir     = medicoInfo?.direccion_consultorio || ''
      const tel     = medicoInfo?.telefono_consultorio  || ''
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://')
        ? medicoInfo.logo_url
        : `${window.location.origin}/logo.png`

      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const filasTabla = lineasValidas.map((l, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="concepto-col">${l.concepto}</td>
          <td class="precio-col">${fmt(parseFloat(l.precio), divisa)}</td>
        </tr>
      `).join('')

      const _html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Nota de Honorarios</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; }
  .watermark { position: fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); width:320px; height:320px; object-fit:contain; opacity:0.05; pointer-events:none; z-index:0; }
  .barra-top { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 12px; }
  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }
  .header { display:flex; align-items:center; gap:18px; padding-bottom:12px; margin-bottom:14px; border-bottom:2px solid ${cp}; }
  .logo-wrap { width:70px; height:70px; border-radius:50%; border:3px solid ${cs}; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .logo { width:100%; height:100%; object-fit:contain; }
  .doctor-name { font-size:14pt; font-weight:bold; color:${cp}; line-height:1.2; }
  .especialidad { font-size:9pt; color:${cs}; margin:3px 0; font-style:italic; }
  .credenciales { font-size:8pt; color:#666; }
  .contacto { font-size:7.5pt; color:#888; margin-top:3px; }
  .titulo-doc { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color:#fff; font-size:11pt; font-weight:700; text-transform:uppercase; letter-spacing:2px; padding:8px 16px; border-radius:4px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; }
  .folio { font-size:8pt; font-weight:400; letter-spacing:0.5px; opacity:0.85; }
  .grid-meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
  .campo-label { font-size:7.5pt; font-weight:700; color:${cp}; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px; }
  .campo-valor { font-size:10pt; color:#1a1a1a; border-bottom:1.5px solid #d1d5db; padding-bottom:4px; min-height:22px; }
  .campo-valor.vacio { color:#aaa; font-style:italic; font-size:9pt; }
  /* Tabla de conceptos */
  .tabla-conceptos { width:100%; border-collapse:collapse; margin-bottom:20px; }
  .tabla-conceptos thead tr { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color:#fff; }
  .tabla-conceptos thead th { padding:8px 12px; font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; }
  .tabla-conceptos thead th.num { width:36px; text-align:center; }
  .tabla-conceptos thead th.concepto-col { text-align:left; }
  .tabla-conceptos thead th.precio-col { text-align:right; width:130px; }
  .tabla-conceptos tbody tr { border-bottom:1px solid #e2e8f0; }
  .tabla-conceptos tbody tr:nth-child(even) { background:#f8fafc; }
  .tabla-conceptos tbody td { padding:9px 12px; font-size:10pt; }
  .tabla-conceptos tbody td.num { text-align:center; color:#94a3b8; font-size:9pt; }
  .tabla-conceptos tbody td.concepto-col { color:#1a1a1a; }
  .tabla-conceptos tbody td.precio-col { text-align:right; color:#1a1a1a; font-weight:500; }
  .tabla-conceptos tfoot { display:none; }
  .total-card { display:flex; justify-content:flex-end; margin:16px 0 20px; }
  .total-inner { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color:#fff; border-radius:10px; padding:14px 28px; text-align:right; min-width:220px; }
  .total-inner-label { font-size:8pt; text-transform:uppercase; letter-spacing:1px; opacity:0.8; margin-bottom:4px; }
  .total-inner-valor { font-size:22pt; font-weight:700; letter-spacing:0.5px; }
  .total-inner-divisa { font-size:7.5pt; opacity:0.75; margin-top:3px; }
  .forma-pago-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .forma-pago-badge { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; padding:5px 12px; font-size:9pt; color:#475569; }
  .footer-area { display:flex; justify-content:space-between; align-items:flex-end; margin-top:60px; }
  .nota-fiscal { font-size:7.5pt; color:#999; max-width:260px; line-height:1.5; }
  .firma { text-align:center; min-width:210px; border-top:1.5px solid ${cp}; padding-top:8px; }
  .firma-nombre { font-weight:bold; font-size:9.5pt; color:${cp}; }
  .firma-ced { font-size:8pt; color:#666; margin-top:2px; }
  .barra-bottom { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height:8px; margin-top:16px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<img class="watermark" src="${logoUrl}" onerror="this.style.display='none'" />
<div class="barra-top"></div>
<div class="contenido">

  <div class="header">
    <div class="logo-wrap"><img class="logo" src="${logoUrl}" onerror="this.style.display='none'" /></div>
    <div>
      <div class="doctor-name">${nombre}</div>
      ${esp     ? `<div class="especialidad">${esp}</div>` : ''}
      <div class="credenciales">
        ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
        ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
        ${cedEsp  ? `Cédula Esp.: ${cedEsp}` : ''}
      </div>
      ${dir || tel ? `<div class="contacto">${[dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      ${rfcMedico ? `<div class="contacto" style="margin-top:2px;font-weight:600;color:${cp}">RFC: ${rfcMedico.toUpperCase()}</div>` : ''}
    </div>
  </div>

  <div class="titulo-doc">
    <span>Recibo de Honorarios</span>
    <span class="folio">${folio}</span>
  </div>

  <div class="grid-meta">
    <div>
      <div class="campo-label">Fecha</div>
      <div class="campo-valor">${fechaFmt}</div>
    </div>
    <div>
      <div class="campo-label">Paciente / Cliente</div>
      <div class="campo-valor ${paciente ? '' : 'vacio'}">${paciente || 'No especificado'}</div>
    </div>
    ${rfcPaciente ? `
    <div>
      <div class="campo-label">RFC del paciente</div>
      <div class="campo-valor">${rfcPaciente.toUpperCase()}</div>
    </div>` : ''}
  </div>

  <table class="tabla-conceptos">
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="concepto-col">Concepto</th>
        <th class="precio-col">Precio</th>
      </tr>
    </thead>
    <tbody>
      ${filasTabla}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" class="total-label">Total a pagar</td>
        <td class="total-valor">${fmt(total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="total-card">
    <div class="total-inner">
      <div class="total-inner-label">Total a pagar</div>
      <div class="total-inner-valor">${fmt(total, divisa)}</div>
      <div class="total-inner-divisa">${divisa === 'MXN' ? 'Pesos mexicanos (MXN)' : 'Dólares americanos (USD)'}</div>
    </div>
  </div>

  <div class="forma-pago-row">
    <span class="campo-label">Forma de pago</span>
    <span class="forma-pago-badge">${formaPago}</span>
  </div>

  <div class="footer-area">
    <div class="nota-fiscal">
      Este documento es una nota de honorarios médicos.<br/>
      ${rfcMedico ? `Expedida por RFC <strong>${rfcMedico.toUpperCase()}</strong>.` : ''}
      No es un comprobante fiscal digital (CFDI).
    </div>
    <div class="firma">
      <div class="firma-nombre">${nombre}</div>
      ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
      ${cedEsp  ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>`  : ''}
    </div>
  </div>

</div>
<div class="barra-bottom"></div>
</body></html>`

      await imprimirOCompartir(_html, 'nota-honorarios.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* Datos generales */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del documento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente / Cliente</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Folio</label>
            <input type="text" value={folio} readOnly className={inputCls + ' bg-slate-50 text-slate-400 cursor-not-allowed'} />
          </div>
        </div>
      </div>

      {/* Datos fiscales */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos fiscales <span className="text-slate-400 font-normal">(opcionales)</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">RFC del médico</label>
            <input type="text" value={rfcMedico} onChange={e => setRfcMedico(e.target.value.toUpperCase())} placeholder="Ej: AABC800101ABC" maxLength={13} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">RFC del paciente <span className="text-slate-400">(para deducción)</span></label>
            <input type="text" value={rfcPaciente} onChange={e => setRfcPaciente(e.target.value.toUpperCase())} placeholder="Ej: XAXX010101000" maxLength={13} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Tabla de conceptos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Conceptos <span className="text-red-400">*</span></h2>

        <div className="space-y-2 mb-3">
          {/* Encabezado */}
          <div className="grid grid-cols-[1fr_140px_36px] gap-2 px-1">
            <span className="text-xs font-medium text-slate-400">Concepto</span>
            <span className="text-xs font-medium text-slate-400">Precio (MXN)</span>
            <span />
          </div>

          {lineas.map((linea, idx) => (
            <div key={linea.id} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
              <input
                type="text"
                value={linea.concepto}
                onChange={e => updateLinea(linea.id, 'concepto', e.target.value)}
                placeholder={`Ej: Consulta de ortopedia`}
                className={inputCls}
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={linea.precio}
                  onChange={e => updateLinea(linea.id, 'precio', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={inputCls + ' pl-7'}
                />
              </div>
              <button
                onClick={() => eliminarLinea(linea.id)}
                disabled={lineas.length === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={agregarLinea}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors py-1"
        >
          <Plus size={14} /> Agregar concepto
        </button>

        {/* Total */}
        {total > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-500">Total</span>
            <span className="text-xl font-bold text-[#1a3a5c]">{fmt(total, divisa)}</span>
          </div>
        )}
      </div>

      {/* Forma de pago y divisa */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Pago</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Forma de pago</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
              {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Divisa</label>
            <div className="flex gap-2">
              {(['MXN', 'USD'] as Divisa[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDivisa(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    divisa === d
                      ? 'border-[#1e5fa8] bg-[#1e5fa8] text-white'
                      : 'border-slate-200 text-slate-500 hover:border-[#1e5fa8] hover:text-[#1e5fa8]'
                  }`}
                >
                  {d === 'MXN' ? '🇲🇽 MXN' : '🇺🇸 USD'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={imprimir}
        disabled={!puedeImprimir || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Nota de Honorarios</>
        }
      </button>
    </div>
  )
}
