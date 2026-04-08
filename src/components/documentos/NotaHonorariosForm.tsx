'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useState } from 'react'
import { Printer, Loader2, Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
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

type TipoDoc = 'honorarios' | 'cotizacion'

function generarFolio(tipo: TipoDoc = 'honorarios'): string {
  const now = new Date()
  const ymd = format(now, 'yyyyMMdd')
  const seq = String(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()).padStart(5, '0')
  const prefix = tipo === 'cotizacion' ? 'COT' : 'NOH'
  return `${prefix}-${ymd}-${seq}`
}

type Divisa = 'MXN' | 'USD'

function fmt(n: number, divisa: Divisa = 'MXN'): string {
  return n.toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', { style: 'currency', currency: divisa })
}

export default function NotaHonorariosForm({ pacienteInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [tipoDoc, setTipoDoc]         = useState<TipoDoc>('honorarios')
  const [paciente, setPaciente]       = useState(pacienteInicial)
  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0])
  const [formaPago, setFormaPago]     = useState('Efectivo')
  const [folio]                       = useState(() => generarFolio('honorarios'))
  const [imprimiendo, setImprimiendo] = useState(false)
  const [lineas, setLineas]           = useState<LineaConcepto[]>([{ id: 1, concepto: '', precio: '' }])
  const [nextId, setNextId]           = useState(2)
  const [divisa, setDivisa]           = useState<Divisa>('MXN')

  const folioDisplay = tipoDoc === 'cotizacion' ? folio.replace('NOH-', 'COT-') : folio
  const tituloDoc    = tipoDoc === 'cotizacion' ? 'Cotización' : 'Recibo de Honorarios'

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
          paciente, fecha, folio: folioDisplay, tipo_doc: tipoDoc,
          lineas: lineasValidas,
          monto: total,
          divisa,
          forma_pago: formaPago,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const medicoData = medicoInfo ? { nombre: medicoInfo.nombre, especialidad: medicoInfo.especialidad, cedula_profesional: medicoInfo.cedula_profesional, cedula_especialidad: medicoInfo.cedula_especialidad, color_primario: medicoInfo.color_primario, color_secundario: medicoInfo.color_secundario, direccion_consultorio: medicoInfo.direccion_consultorio, telefono_consultorio: medicoInfo.telefono_consultorio } : null
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined

      await generarPdf({
        tipo: 'nota_honorarios',
        medico: medicoData,
        data: {
          paciente, fecha: fechaFmt, folio: folioDisplay, tipoDoc,
          lineas: lineasValidas.map(l => ({ concepto: l.concepto, precio: parseFloat(l.precio) })),
          total, divisa, formaPago: tipoDoc !== 'cotizacion' ? formaPago : undefined,
        },
        logoUrl,
        filename: tipoDoc === 'cotizacion' ? 'cotizacion.pdf' : 'nota-honorarios.pdf',
      })
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* Selector de tipo */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500 mb-2">Tipo de documento</p>
        <div className="flex gap-2">
          {([
            { key: 'honorarios', label: 'Recibo de honorarios' },
            { key: 'cotizacion', label: 'Cotización' },
          ] as { key: TipoDoc; label: string }[]).map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setTipoDoc(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                tipoDoc === key
                  ? 'border-[#1e5fa8] bg-[#1e5fa8] text-white'
                  : 'border-slate-200 text-slate-500 hover:border-[#1e5fa8] hover:text-[#1e5fa8]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

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
            <input type="text" value={folioDisplay} readOnly className={inputCls + ' bg-slate-50 text-slate-400 cursor-not-allowed'} />
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
          {tipoDoc !== 'cotizacion' && (
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Forma de pago</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
              {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          )}
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
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir {tituloDoc}</>
        }
      </button>
    </div>
  )
}
