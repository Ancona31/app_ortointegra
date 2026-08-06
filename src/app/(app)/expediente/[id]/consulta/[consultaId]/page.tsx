'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta, MedicoInfo } from '@/types'
import { parseISO, format } from 'date-fns'
import { generateDocFileName } from '@/lib/patientUtils'
import { es } from 'date-fns/locale'
import { ArrowLeft, Printer, Stethoscope, Plus, Loader2, FileText, Lock, PenLine, Sparkles, Eye } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useAuditAccess } from '@/hooks/useAudit'
import { buildNotaRenderData } from '@/lib/notaRenderData'
import { generarPdf } from '@/lib/mobileShare'

type Addendum = {
  id: string
  contenido: string
  medico_nombre: string
  created_at: string
}

// Mismo patrón que ModalConsultas: muestra el primer diagnóstico (CIE-10 ·
// descripción) y cae al motivo_consulta si la consulta no tiene diagnóstico.
function diagnosticoTexto(c: Consulta): string {
  const primero = c.diagnosticos?.[0]
  if (primero?.descripcion) {
    return primero.codigo_cie10
      ? `${primero.codigo_cie10} · ${primero.descripcion}`
      : primero.descripcion
  }
  return c.motivo_consulta || 'Consulta sin detalles'
}

export default function ConsultaDetallePage() {
  const { id, consultaId } = useParams<{ id: string; consultaId: string }>()
  useAuditAccess('consultas', consultaId)

  // ── Data fetching: direct Supabase queries ──
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    Promise.all([
      supabase.from('pacientes').select('*').eq('id', id).single(),
      supabase.from('consultas').select('*').eq('id', consultaId).single(),
    ]).then(([pacRes, conRes]) => {
      if (cancelled) return
      if (!pacRes.error && pacRes.data) setPaciente(pacRes.data as Paciente)
      if (!conRes.error && conRes.data) setConsulta(conRes.data as Consulta)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [id, consultaId])

  // ── Datos complementarios ──
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [addendums, setAddendums] = useState<Addendum[]>([])

  // Addendum form
  const [showAddendum, setShowAddendum] = useState(false)
  const [addendumTexto, setAddendumTexto] = useState('')
  const [guardandoAddendum, setGuardandoAddendum] = useState(false)
  const [error, setError] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  /**
   * El botón no abre el PDF: se convierte en el enlace que lo abre.
   *
   * `generarPdf` lo abría él mismo al terminar, después del refresco del perfil
   * médico, el fetch del logo, los imports dinámicos y el render. Para entonces
   * la activación transitoria del gesto ya estaba consumida y Safari bloqueaba
   * la apertura — en silencio en iOS y en la PWA. En una nota duele más que en
   * un documento: la reimpresión no se persiste, así que si no se abre no queda
   * en ninguna lista donde ir a buscarla.
   *
   * Con el href ya resuelto, entre el toque y la navegación no hay asincronía.
   * Mismo criterio que ModalDocumentoGenerado, duplicado a propósito.
   */
  const pdfUrl = useMemo(() => (pdfBlob ? URL.createObjectURL(pdfBlob) : null), [pdfBlob])

  useEffect(() => {
    if (!pdfUrl) return
    return () => {
      // 60s de gracia: si el médico ya lo abrió, el visor tiene su copia
      // interna y revocar es seguro.
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    }
  }, [pdfUrl])

  useEffect(() => {
    // Perfil médico — best-effort
    fetch('/api/me/perfil-medico')
      .then(r => r.json())
      .then(({ medico }) => setMedicoInfo(medico))
      .catch(() => {})

    // Addendums
    fetch(`/api/consultas/${consultaId}/addendum`)
      .then(r => r.json())
      .then(data => setAddendums(data.addendums ?? []))
      .catch(() => {})
  }, [consultaId])

  async function guardarAddendum() {
    if (!addendumTexto.trim()) { setError('El addendum no puede estar vacío'); return }
    setGuardandoAddendum(true)
    setError('')

    const res = await fetch(`/api/consultas/${consultaId}/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: addendumTexto }),
    })

    const data = await res.json()
    setGuardandoAddendum(false)

    if (!res.ok) {
      setError(data.message || data.error || 'No se pudo guardar el addendum')
      return
    }

    setAddendums(prev => [...prev, data.addendum])
    setAddendumTexto('')
    setShowAddendum(false)
    // El PDF ya generado no lleva este addendum: se descarta para que el botón
    // vuelva a "Imprimir" en lugar de ofrecer un enlace a un documento viejo.
    setPdfBlob(null)
  }

  async function imprimir() {
    if (!paciente || !consulta) return
    setError('')
    setImprimiendo(true)
    try {
      // Refresco best-effort: la firma es un signed URL con TTL 1h que pudo
      // expirar si la página lleva rato abierta. Fallo (offline/error) → cae a
      // medicoInfo del estado, sin bloquear la generación. El snapshot
      // definitivo llegará con consultas.medico_firma_path (Paquete Firma).
      let medicoVivo = medicoInfo
      try {
        const { medico } = await fetch('/api/me/perfil-medico').then(r => r.json())
        if (medico) medicoVivo = medico
      } catch { /* sin red: conservar medicoInfo del estado */ }

      const notaRenderData = buildNotaRenderData({
        origen: 'consulta',
        consulta,
        paciente,
        addendums,
        medicoVivo,
      })
      const { blob } = await generarPdf({
        tipo: 'nota_evolucion',
        medico: null,
        data: { ...notaRenderData },
        logoUrl: notaRenderData.medico.logoUrl,
        filename: generateDocFileName(notaRenderData.paciente.nombreCompleto, 'Nota-Evolucion'),
        entregar: false,
      })

      setPdfBlob(blob)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ConsultaDetalle] imprimir falló:', err)
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setImprimiendo(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>
  if (!consulta || !paciente) return <div className="text-center py-12 text-slate-400">Consulta no encontrada</div>

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
              <Stethoscope size={22} /> Nota de Consulta
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {paciente.nombre} {paciente.apellidos} ·{' '}
              {format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
            {consulta.consultorio_nombre && (
              <p className="text-xs text-slate-500 mt-1">
                Atendido en: <span className="font-semibold text-[#1e5fa8]">{consulta.consultorio_nombre_corto || consulta.consultorio_nombre}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {consulta.nota_origen === 'manual' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
              <PenLine size={12} /> Nota manual
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e5fa8] bg-[#1e5fa8]/5 border border-[#1e5fa8]/20 rounded-lg">
              <Sparkles size={11} />
              Nota IA
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
            <Lock size={12} /> Nota sellada
          </span>
          {/* El enlace se queda hasta que se agregue un addendum (que invalida
              el PDF) o se recargue la página: si el médico cierra la pestaña
              del visor por error, puede volver a abrirla sin regenerar. */}
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-4 py-2 bg-[#1a3a5c] border-2 border-[#1a3a5c] text-white rounded-lg text-sm font-medium hover:bg-[#0f2540] transition-colors"
            >
              <Eye size={16} /> Abrir PDF
            </a>
          ) : (
            <button
              onClick={imprimir}
              disabled={imprimiendo}
              className="flex items-center gap-2 px-4 py-2 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors disabled:opacity-50"
            >
              {imprimiendo
                ? <><Loader2 size={16} className="animate-spin" /> Generando...</>
                : <><Printer size={16} /> Imprimir</>}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Contenido de la nota — inmutable */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Diagnóstico</span>
            <p className="text-sm font-medium text-slate-800">{diagnosticoTexto(consulta)}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Próxima cita</span>
            <p className="text-sm font-medium text-slate-800">{consulta.proxima_cita || '—'}</p>
          </div>
        </div>

        {consulta.notas_evolucion ? (
          <div className="prose prose-sm max-w-none
            prose-headings:text-[#1a3a5c] prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-1
            prose-strong:text-[#1a3a5c] prose-strong:font-semibold
            prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1
            prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-700
          ">
            <ReactMarkdown>{consulta.notas_evolucion}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Sin nota de evolución registrada</p>
        )}
      </div>

      {/* Addendums — notas aclaratorias */}
      {addendums.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
            <FileText size={14} /> Notas aclaratorias ({addendums.length})
          </h3>
          {addendums.map(a => (
            <div key={a.id} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-[#1e5fa8]">{a.medico_nombre}</span>
                <span className="text-xs text-slate-400">
                  {format(parseISO(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
                  <Lock size={9} /> Sellado
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line">{a.contenido}</p>
            </div>
          ))}
        </div>
      )}

      {/* Botón de agregar addendum — siempre visible */}
      {!showAddendum ? (
        <button
          onClick={() => setShowAddendum(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#1e5fa8]/30 text-[#1e5fa8] rounded-xl text-sm font-medium hover:bg-[#1e5fa8]/5 hover:border-[#1e5fa8]/50 transition-all"
        >
          <Plus size={16} /> Agregar nota aclaratoria (addendum)
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
            <Plus size={14} /> Nueva nota aclaratoria
          </h3>
          <p className="text-xs text-slate-400">
            Este addendum se adjuntará a la nota original y no podrá modificarse una vez guardado.
          </p>
          <textarea
            value={addendumTexto}
            onChange={e => setAddendumTexto(e.target.value)}
            rows={4}
            placeholder="Escriba la aclaración, corrección o nota adicional..."
            autoFocus
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAddendum(false); setAddendumTexto(''); setError('') }}
              className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardarAddendum}
              disabled={guardandoAddendum}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
            >
              {guardandoAddendum ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : 'Guardar addendum'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
