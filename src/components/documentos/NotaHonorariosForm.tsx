'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useEffect, useState } from 'react'
import { Printer, Loader2, Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import type { AseguradoraInfo } from '@/types'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
  /**
   * Reporta al host si el formulario sigue vacío. Lo consume el selector de
   * tipo de documento para la confirmación previa al cambiar de tipo y el
   * aviso al concluir la consulta (GUIA_FORMULARIOS_04 §6.1 y §6.2).
   *
   * Emite `isFormEmpty` — el predicado que este formulario YA usaba para
   * decidir si aplicar una plantilla pisa datos. No hay un segundo criterio:
   * si hubiera dos, dos partes del sistema discreparían sobre si hay algo
   * escrito. Los otros siete formularios todavía no lo emiten y el host los
   * da por vacíos; se cablean en el paso del acabado, donde de todos modos
   * se toca cada uno.
   */
  onVacioChange?: (vacio: boolean) => void
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

/** True when the user hasn't entered meaningful data beyond the pre-filled patient name */
function isFormEmpty(lineas: LineaConcepto[], paciente: string, notas: string, pacienteInicial: string): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  return (
    pacienteIntacto &&
    notas.trim() === '' &&
    lineas.every(l => l.concepto.trim() === '' && l.precio === 0)
  )
}

export default function NotaHonorariosForm({ pacienteInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // In offline mode, read doctor profile from localStorage (pre-fetched with Base64 assets)
  const offlineProfile = offlineMode ? (() => {
    try {
      const raw = localStorage.getItem('spinus_doctor_profile')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })() : null

  const medicoInfo = offlineMode && offlineProfile ? {
    ...onlineMedicoInfo,
    nombre: offlineProfile.nombre,
    especialidad: offlineProfile.especialidad,
    cedula_profesional: offlineProfile.cedula_profesional,
    cedula_especialidad: offlineProfile.cedula_especialidad,
    universidad: offlineProfile.universidad,
    direccion_consultorio: offlineProfile.direccion_consultorio,
    telefono_consultorio: offlineProfile.telefono_consultorio,
    color_primario: offlineProfile.color_primario,
    color_secundario: offlineProfile.color_secundario,
    logo_url: offlineProfile.logo_base64,
    firma_url: offlineProfile.firma_base64,
    clinica_nombre: offlineProfile.clinica_nombre,
  } : onlineMedicoInfo

  // Imprimir antes de que resuelva el perfil produce un PDF con el encabezado
  // vacío: sin nombre, sin cédulas, sin domicilio. Solo bloquea mientras carga;
  // si resuelve sin datos el botón se habilita igual.
  const perfilPendiente = cargandoPerfil && !medicoInfo

  const toast = useToast()

  // ─── Form state ────────────────────────────────────────────────────────────
  const [tipoDoc, setTipoDoc]             = useState<TipoDoc>('honorarios')
  const [paciente, setPaciente]           = useState(pacienteInicial)
  const [fecha, setFecha]                 = useState(hoyEnTZ)
  const [formaPago, setFormaPago]         = useState('Efectivo')
  // Sin setter: lo movía el sistema viejo de plantillas al aplicar una. El folio
  // se calcula al montar y el display lo deriva del tipo de documento.
  const [folio]                           = useState(() => generarFolio('honorarios'))
  const [imprimiendo, setImprimiendo]     = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado]     = useState<{ blob: Blob; guardado: boolean } | null>(null)
  const [lineas, setLineas]               = useState<LineaConcepto[]>([{ id: 1, concepto: '', precio: 0 }])
  const [nextId, setNextId]               = useState(2)
  const [divisa, setDivisa]               = useState<Divisa>('MXN')
  const [notas, setNotas]                 = useState('')
  const [aseguradora, setAseguradora]     = useState<AseguradoraInfo | null>(null)

  // El sistema VIEJO de plantillas vivía aquí: leía `plantillas_honorarios` con
  // un `clinica_id` que siempre resolvía a null, así que guardar llevaba roto
  // desde abril de 2026. Se retira entero en el paso 5.3.b. El sistema nuevo
  // —`plantillas_documento`, común a los ocho— entra en Honorarios cuando le
  // toque su paso; la tabla vieja se retira aparte, no aquí.

  // ─── Derived ───────────────────────────────────────────────────────────────
  const folioDisplay = tipoDoc === 'cotizacion' ? folio.replace('NOH-', 'COT-') : folio
  const tituloDoc    = tipoDoc === 'cotizacion' ? 'Cotización' : 'Recibo de Honorarios'
  const total        = roundCurrency(lineas.reduce((sum, l) => sum + l.precio, 0))

  const hayLineaInvalida  = lineas.some(l => l.concepto.trim() !== '' && l.precio <= 0)
  const puedeImprimir     = lineas.some(l => l.concepto.trim() !== '' && l.precio > 0) && !hayLineaInvalida

  // Misma llamada que gobierna «Sobreescribir formulario» al aplicar plantilla:
  // un solo predicado, dos consumidores.
  const vacio = isFormEmpty(lineas, paciente, notas, pacienteInicial)
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

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
    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false

    try {
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
        titulo: medicoInfo.titulo ?? null,
        nombres: medicoInfo.nombres ?? null,
        apellido_paterno: medicoInfo.apellido_paterno ?? null,
        apellido_materno: medicoInfo.apellido_materno ?? null,
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

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'nota_honorarios',
        pacienteId,
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
        consultorio: consultorioData,
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfGenerated = true
      pdfBlob = blob

      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'nota_honorarios',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Nota de honorarios guardada en bunker offline')
        onOfflineSave?.()
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'nota_honorarios',
          contenido,
          client_id: clientId,
          pdf_url: storagePath,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { error } = await supabase.from('documentos').insert(insertPayload)
        if (error) throw error

        // Sin storagePath la fila se inserta igual pero sin PDF en Storage:
        // mobileShare captura el error de subida y no lo relanza. El documento
        // no queda recuperable desde la lista y el modal tiene que decirlo.
        guardado = storagePath !== null

        const docLabel = tipoDoc === 'cotizacion' ? 'Cotizacion' : 'Recibo'
        toast.success(docLabel + ' guardado')
      }
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
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

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
              max={desplazarFecha(hoyEnTZ(), { anios: 1 })}
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
          disabled={!puedeImprimir || imprimiendo || perfilPendiente}
          className="doc-print-btn flex-1 flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
        >
          {imprimiendo
            ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
            : <><Printer size={18} /> Imprimir {tituloDoc}</>
          }
        </button>
      </div>

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        onClose={() => setDocGenerado(null)}
        blob={docGenerado?.blob ?? null}
        titulo={tituloDoc}
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}
