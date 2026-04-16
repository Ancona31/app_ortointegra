'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useCallback, useEffect, useState } from 'react'
import { Printer, Loader2, Plus, Trash2, Save, FileText, AlertTriangle } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { useProfile } from '@/hooks/useProfile'
import type { AseguradoraInfo, HonorariosTemplate } from '@/types'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
}

interface LineaConcepto {
  id: number
  concepto: string
  precio: number
}

const FORMAS_PAGO = ['Efectivo', 'Transferencia bancaria', 'Tarjeta de crédito', 'Tarjeta de débito', 'Cheque']
const BLOCKED_KEYS = new Set(['e', 'E', '+', '-'])

type TipoDoc = 'honorarios' | 'cotizacion'
type Divisa = 'MXN' | 'USD'

function generarFolio(tipo: TipoDoc = 'honorarios'): string {
  const now = new Date()
  const ymd = format(now, 'yyyyMMdd')
  const seq = String(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()).padStart(5, '0')
  const prefix = tipo === 'cotizacion' ? 'COT' : 'NOH'
  return `${prefix}-${ymd}-${seq}`
}

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number, divisa: Divisa = 'MXN'): string {
  return roundCurrency(n).toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', { style: 'currency', currency: divisa })
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function maxDateISO(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

/** True when all lines are blank / zero (form is "empty") */
function isFormEmpty(lineas: LineaConcepto[], paciente: string, notas: string): boolean {
  return (
    paciente.trim() === '' &&
    notas.trim() === '' &&
    lineas.every(l => l.concepto.trim() === '' && l.precio === 0)
  )
}

export default function NotaHonorariosForm({ pacienteInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const { userId } = useAuth()
  const { profile } = useProfile()
  const toast = useToast()

  // ─── Form state ────────────────────────────────────────────────────────────
  const [tipoDoc, setTipoDoc]             = useState<TipoDoc>('honorarios')
  const [paciente, setPaciente]           = useState(pacienteInicial)
  const [fecha, setFecha]                 = useState(todayISO)
  const [formaPago, setFormaPago]         = useState('Efectivo')
  const [folio, setFolio]                 = useState(() => generarFolio('honorarios'))
  const [imprimiendo, setImprimiendo]     = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [lineas, setLineas]               = useState<LineaConcepto[]>([{ id: 1, concepto: '', precio: 0 }])
  const [nextId, setNextId]               = useState(2)
  const [divisa, setDivisa]               = useState<Divisa>('MXN')
  const [notas, setNotas]                 = useState('')
  const [aseguradora, setAseguradora]     = useState<AseguradoraInfo | null>(null)

  // ─── Template state ────────────────────────────────────────────────────────
  const [templates, setTemplates]                   = useState<HonorariosTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [loadingTemplates, setLoadingTemplates]     = useState(false)
  const [showSaveTemplate, setShowSaveTemplate]     = useState(false)
  const [templateName, setTemplateName]             = useState('')
  const [savingTemplate, setSavingTemplate]         = useState(false)
  const [modalConfirm, setModalConfirm]             = useState<{
    titulo: string
    mensaje: string
    labelConfirm: string
    destructivo: boolean
    onConfirm: () => void
  } | null>(null)

  // ─── Derived ───────────────────────────────────────────────────────────────
  const folioDisplay = tipoDoc === 'cotizacion' ? folio.replace('NOH-', 'COT-') : folio
  const tituloDoc    = tipoDoc === 'cotizacion' ? 'Cotización' : 'Recibo de Honorarios'
  const total        = roundCurrency(lineas.reduce((sum, l) => sum + l.precio, 0))

  const hayLineaInvalida  = lineas.some(l => l.concepto.trim() !== '' && l.precio <= 0)
  const puedeImprimir     = lineas.some(l => l.concepto.trim() !== '' && l.precio > 0) && !hayLineaInvalida

  // ─── Load templates ────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plantillas_honorarios')
        .select('id, nombre, contenido')
        .order('nombre')
      if (error) throw error
      setTemplates((data ?? []) as HonorariosTemplate[])
    } catch {
      // Silently ignore — templates are an enhancement, not critical
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // ─── Apply template ────────────────────────────────────────────────────────
  function doApplyTemplate(tpl: HonorariosTemplate): void {
    const c = tpl.contenido
    setTipoDoc(c.tipoDoc)
    setDivisa(c.divisa)
    setFormaPago(c.formaPago)
    setNotas(c.notas ?? '')
    setAseguradora(c.aseguradora ?? null)
    const newLineas = c.lineas.map((l, i) => ({ id: i + 1, concepto: l.concepto, precio: l.precio }))
    setLineas(newLineas.length > 0 ? newLineas : [{ id: 1, concepto: '', precio: 0 }])
    setNextId((newLineas.length > 0 ? newLineas.length : 1) + 1)
    setFolio(generarFolio(c.tipoDoc))
    setFecha(todayISO())
  }

  function applyTemplate(templateId: string): void {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return

    if (!isFormEmpty(lineas, paciente, notas)) {
      setModalConfirm({
        titulo: 'Sobreescribir formulario',
        mensaje: 'El formulario tiene datos. ¿Deseas reemplazarlos con la plantilla seleccionada?',
        labelConfirm: 'Sobreescribir',
        destructivo: false,
        onConfirm: () => doApplyTemplate(tpl),
      })
      return
    }

    doApplyTemplate(tpl)
  }

  // ─── Save template (core) ───────────────────────────────────────────────────
  function buildContenido() {
    return {
      tipoDoc,
      lineas: lineas.filter(l => l.concepto.trim() !== '').map(l => ({ concepto: l.concepto, precio: l.precio })),
      divisa,
      formaPago,
      notas,
      aseguradora,
    }
  }

  async function doSaveTemplate(name: string, existingId?: string): Promise<void> {
    if (!userId || !profile?.clinica_id) {
      toast.error('No se pudo determinar tu usuario o clínica')
      return
    }
    setSavingTemplate(true)
    try {
      const supabase = createClient()
      const contenido = buildContenido()

      if (existingId) {
        const { error } = await supabase
          .from('plantillas_honorarios')
          .update({ contenido })
          .eq('id', existingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('plantillas_honorarios')
          .insert({ user_id: userId, clinica_id: profile.clinica_id, nombre: name, contenido })
        if (error) throw error
      }

      toast.success('Plantilla guardada')
      setShowSaveTemplate(false)
      setTemplateName('')
      fetchTemplates()
    } catch (err) {
      toast.error('Error al guardar plantilla')
      console.error('[NotaHonorariosForm] saveTemplate:', err)
    } finally {
      setSavingTemplate(false)
    }
  }

  async function saveTemplate(): Promise<void> {
    const name = templateName.trim()
    if (!name) { toast.error('Ingresa un nombre para la plantilla'); return }

    const supabase = createClient()
    const { data: existing, error: findErr } = await supabase
      .from('plantillas_honorarios')
      .select('id')
      .eq('nombre', name)

    if (findErr) { toast.error('Error al verificar plantilla'); return }

    if (existing && existing.length > 0) {
      setModalConfirm({
        titulo: 'Plantilla existente',
        mensaje: `Ya existe una plantilla "${name}". ¿Deseas sobreescribir su contenido?`,
        labelConfirm: 'Sobreescribir',
        destructivo: false,
        onConfirm: () => doSaveTemplate(name, existing[0].id),
      })
      return
    }

    doSaveTemplate(name)
  }

  // ─── Delete template ──────────────────────────────────────────────────────
  function requestDeleteTemplate(): void {
    const tpl = templates.find(t => t.id === selectedTemplateId)
    if (!tpl) return

    setModalConfirm({
      titulo: 'Eliminar plantilla',
      mensaje: `¿Estás seguro de que deseas eliminar "${tpl.nombre}" de forma permanente?`,
      labelConfirm: 'Eliminar',
      destructivo: true,
      onConfirm: async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('plantillas_honorarios')
            .delete()
            .eq('id', selectedTemplateId)
          if (error) throw error
          toast.success('Plantilla eliminada')
          setSelectedTemplateId('')
          fetchTemplates()
        } catch {
          toast.error('Error al eliminar plantilla')
        }
      },
    })
  }

  // ─── Line operations ───────────────────────────────────────────────────────
  function agregarLinea(): void {
    setLineas(prev => [...prev, { id: nextId, concepto: '', precio: 0 }])
    setNextId(n => n + 1)
  }

  function eliminarLinea(id: number): void {
    if (lineas.length === 1) return
    setLineas(prev => prev.filter(l => l.id !== id))
  }

  function updateConcepto(id: number, value: string): void {
    setLineas(prev => prev.map(l => l.id === id ? { ...l, concepto: value } : l))
  }

  function updatePrecio(id: number, raw: string): void {
    const parsed = raw === '' ? 0 : parseFloat(raw)
    if (Number.isNaN(parsed)) return
    setLineas(prev => prev.map(l => l.id === id ? { ...l, precio: roundCurrency(parsed) } : l))
  }

  function blockInvalidKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (BLOCKED_KEYS.has(e.key)) e.preventDefault()
  }

  // ─── Print / persist ───────────────────────────────────────────────────────
  async function imprimir(): Promise<void> {
    if (!puedeImprimir) return

    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })
    toast.info(tipoDoc === 'cotizacion' ? 'Generando cotización...' : 'Generando recibo de honorarios...')

    const clientId = crypto.randomUUID()
    const lineasValidas = lineas.filter(l => l.concepto.trim() !== '' && l.precio > 0)
    const contenido = {
      paciente, fecha, folio: folioDisplay, tipo_doc: tipoDoc,
      lineas: lineasValidas,
      monto: total,
      divisa,
      forma_pago: formaPago,
      notas,
      aseguradora,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    let pdfGenerated = false

    try {
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
        especialidad: medicoInfo.especialidad,
        cedula_profesional: medicoInfo.cedula_profesional,
        cedula_especialidad: medicoInfo.cedula_especialidad,
        color_primario: medicoInfo.color_primario,
        color_secundario: medicoInfo.color_secundario,
        direccion_consultorio: medicoInfo.direccion_consultorio,
        telefono_consultorio: medicoInfo.telefono_consultorio,
        firma_url: medicoInfo.firma_url ?? null,
      } : null
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined

      await generarPdf({
        tipo: 'nota_honorarios',
        medico: medicoData,
        data: {
          paciente, fecha: fechaFmt, folio: folioDisplay, tipoDoc,
          lineas: lineasValidas.map(l => ({ concepto: l.concepto, precio: l.precio })),
          total, divisa, formaPago: tipoDoc !== 'cotizacion' ? formaPago : undefined,
          notas: notas || undefined,
          aseguradora,
        },
        logoUrl,
        filename: generateDocFileName(paciente, tipoDoc === 'cotizacion' ? 'Cotizacion' : 'Nota_Honorarios'),
      })

      pdfGenerated = true

      const supabase = createClient()
      const insertPayload: Record<string, unknown> = {
        tipo: 'nota_honorarios',
        contenido,
        client_id: clientId,
      }
      if (pacienteId) insertPayload.paciente_id = pacienteId

      const { error } = await supabase.from('documentos').insert(insertPayload)
      if (error) throw error

      const docLabel = tipoDoc === 'cotizacion' ? 'Cotizacion' : 'Recibo'
      toast.success(docLabel + ' guardado')
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Documento generado pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar el documento.')
      }
      // eslint-disable-next-line no-console
      console.error('[NotaHonorariosForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* ── Template selector ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
          <FileText size={13} /> Plantilla
        </p>
        <div className="flex items-center gap-2">
          <select
            value={selectedTemplateId}
            onChange={e => {
              setSelectedTemplateId(e.target.value)
              if (e.target.value) applyTemplate(e.target.value)
            }}
            disabled={loadingTemplates}
            className={inputCls + ' flex-1'}
          >
            <option value="">
              {loadingTemplates ? 'Cargando plantillas...' : '— Seleccionar plantilla —'}
            </option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={requestDeleteTemplate}
              title="Eliminar plantilla"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Selector de tipo ──────────────────────────────────────────────── */}
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

      {/* ── Datos generales ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del documento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              min="1900-01-01"
              max={maxDateISO()}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Folio</label>
            <input type="text" value={folioDisplay} readOnly className={inputCls + ' bg-slate-50 text-slate-400 cursor-not-allowed'} />
          </div>
        </div>
      </div>

      {/* ── Seguro de gastos médicos ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700 text-sm">Seguro de gastos médicos</h2>
          <button
            type="button"
            onClick={() => setAseguradora(prev => prev ? null : { nombre: '', poliza: '', cobertura: '' })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              aseguradora ? 'bg-[#1e5fa8]' : 'bg-slate-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              aseguradora ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {aseguradora && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Nombre de aseguradora</label>
              <input
                type="text"
                list="aseguradoras-mx"
                value={aseguradora.nombre}
                onChange={e => setAseguradora({ ...aseguradora, nombre: e.target.value })}
                placeholder="Ej: GNP Seguros"
                className={inputCls}
              />
              <datalist id="aseguradoras-mx">
                <option value="MetLife" />
                <option value="GNP Seguros" />
                <option value="AXA Seguros" />
                <option value="Quálitas" />
                <option value="Seguros Monterrey New York Life" />
                <option value="Banorte Seguros" />
                <option value="Mapfre" />
                <option value="Inbursa" />
                <option value="Zurich" />
                <option value="Seguros Atlas" />
                <option value="Allianz" />
                <option value="ABA Seguros (Chubb)" />
                <option value="Afirme" />
                <option value="Bupa" />
                <option value="Plan Seguro" />
                <option value="La Latinoamericana" />
                <option value="General de Salud" />
                <option value="Multiva" />
                <option value="HDI Seguros" />
                <option value="Pan-American México" />
              </datalist>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Número de póliza</label>
              <input
                type="text"
                value={aseguradora.poliza}
                onChange={e => setAseguradora({ ...aseguradora, poliza: e.target.value })}
                placeholder="Ej: POL-123456"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Cobertura</label>
              <input
                type="text"
                value={aseguradora.cobertura}
                onChange={e => setAseguradora({ ...aseguradora, cobertura: e.target.value })}
                placeholder="Ej: 80%"
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabla de conceptos ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Conceptos <span className="text-red-400">*</span></h2>

        <div className="space-y-2 mb-3">
          {/* Encabezado */}
          <div className="grid grid-cols-[1fr_140px_36px] gap-2 px-1">
            <span className="text-xs font-medium text-slate-400">Concepto</span>
            <span className="text-xs font-medium text-slate-400">Precio ({divisa})</span>
            <span />
          </div>

          {lineas.map(linea => {
            const conceptoFilled = linea.concepto.trim() !== ''
            const precioInvalido = conceptoFilled && linea.precio <= 0
            return (
              <div key={linea.id}>
                <div className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                  <input
                    type="text"
                    value={linea.concepto}
                    onChange={e => updateConcepto(linea.id, e.target.value)}
                    placeholder="Ej: Consulta de ortopedia"
                    className={inputCls}
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      value={linea.precio === 0 ? '' : linea.precio}
                      onChange={e => updatePrecio(linea.id, e.target.value)}
                      onKeyDown={blockInvalidKeys}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`${inputCls} pl-7${precioInvalido ? ' border-red-300 focus:ring-red-300/30 focus:border-red-400' : ''}`}
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
                {precioInvalido && (
                  <p className="text-xs text-red-500 mt-0.5 pl-1">El precio debe ser mayor a 0</p>
                )}
              </div>
            )
          })}
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

      {/* ── Forma de pago y divisa ────────────────────────────────────────── */}
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
                  {d === 'MXN' ? 'MXN' : 'USD'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notas y Consideraciones ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Notas y Consideraciones</h2>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Observaciones adicionales, indicaciones especiales, etc."
          rows={3}
          className={inputCls + ' resize-y'}
        />
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={imprimir}
          disabled={!puedeImprimir || imprimiendo}
          className="doc-print-btn flex-1 flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
        >
          {imprimiendo
            ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
            : <><Printer size={18} /> Imprimir {tituloDoc}</>
          }
        </button>

        {!showSaveTemplate ? (
          <button
            type="button"
            onClick={() => setShowSaveTemplate(true)}
            className="flex items-center justify-center gap-2 py-3 px-5 border-2 border-[#1e5fa8] text-[#1e5fa8] rounded-xl font-medium hover:bg-[#1e5fa8]/5 transition-colors"
          >
            <Save size={18} /> Guardar como plantilla
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className={inputCls + ' flex-1'}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false) }}
            />
            <button
              type="button"
              onClick={saveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="py-2 px-4 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-50"
            >
              {savingTemplate ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}
              className="py-2 px-3 text-slate-400 hover:text-slate-600 text-sm"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación — patrón Spinus (blur + slide) ──────────── */}
      {modalConfirm && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-4 text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: modalConfirm.destructivo ? '#FEF2F2' : '#EFF6FF' }}
                >
                  <AlertTriangle
                    size={22}
                    style={{ color: modalConfirm.destructivo ? '#EF5350' : '#1e5fa8' }}
                  />
                </div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">{modalConfirm.titulo}</h2>
                <p className="text-[13px] text-[#3d3d3f] mt-3 leading-relaxed">
                  {modalConfirm.mensaje}
                </p>
              </div>
              <div className="border-t border-slate-100 grid grid-cols-2">
                <button
                  onClick={() => {
                    setModalConfirm(null)
                    if (selectedTemplateId && !templates.find(t => t.id === selectedTemplateId)) {
                      setSelectedTemplateId('')
                    }
                  }}
                  className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors border-r border-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    modalConfirm.onConfirm()
                    setModalConfirm(null)
                  }}
                  className="px-4 py-3.5 text-sm font-semibold hover:bg-red-50 transition-colors"
                  style={{ color: modalConfirm.destructivo ? '#EF5350' : '#1e5fa8' }}
                >
                  {modalConfirm.labelConfirm}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
