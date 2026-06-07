'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta } from '@/types'
import { parseISO, format } from 'date-fns'
import { calcularEdad } from '@/lib/patientUtils'
import { es } from 'date-fns/locale'
import { ArrowLeft, Printer, Stethoscope, Plus, Loader2, FileText, Lock, PenLine, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { PRINT_CSS, markdownToHtml } from '@/lib/printStyles'
import ReactMarkdown from 'react-markdown'
import { useAuditAccess } from '@/hooks/useAudit'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
  firma_url: string | null
}

type Addendum = {
  id: string
  contenido: string
  medico_nombre: string
  created_at: string
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
  }

  function imprimir() {
    if (!paciente || !consulta) return
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return

    const doctorNombre = consulta.medico_nombre || medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = consulta.medico_especialidad || medicoInfo?.especialidad || ''
    const cedulas = [
      (consulta.medico_cedula_profesional || medicoInfo?.cedula_profesional) ? `Céd. Prof. ${consulta.medico_cedula_profesional || medicoInfo?.cedula_profesional}` : '',
      (consulta.medico_cedula_especialidad || medicoInfo?.cedula_especialidad) ? `Céd. Esp. ${consulta.medico_cedula_especialidad || medicoInfo?.cedula_especialidad}` : '',
    ].filter(Boolean).join(' · ')
    const logoUrl = consulta.medico_logo_url || medicoInfo?.logo_url || `${window.location.origin}/logo.png`
    const edad = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento).anios : null
    const fechaHora = format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy, HH:mm 'hrs'", { locale: es })
    const notaHtml = markdownToHtml(consulta.notas_evolucion || '')

    const addendumsHtml = addendums.length > 0
      ? `<div style="margin-top:24px;border-top:2px solid #e2e8f0;padding-top:16px;">
          <h3 style="font-size:11pt;font-weight:bold;color:#1a3a5c;margin-bottom:8px;">Notas aclaratorias (Addendums)</h3>
          ${addendums.map(a => `
            <div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-left:3px solid #1e5fa8;border-radius:4px;">
              <p style="font-size:9pt;color:#64748b;margin:0 0 4px;">${format(parseISO(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })} — ${a.medico_nombre}</p>
              <p style="font-size:10pt;color:#334155;margin:0;white-space:pre-line;">${a.contenido}</p>
            </div>
          `).join('')}
        </div>`
      : ''

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Nota Médica</title>
<style>${PRINT_CSS}</style></head><body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div>
      <div class="doctor-name">${doctorNombre}</div>
      ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
      ${cedulas ? `<div class="credenciales">${cedulas}</div>` : ''}
    </div>
  </div>
  <div class="titulo">Nota de Evolución Médica</div>
  <div class="datos-grid">
    <div class="dato"><span class="dato-label">Paciente:</span><span>${paciente.nombre} ${paciente.apellidos}</span></div>
    <div class="dato"><span class="dato-label">Fecha y hora:</span><span>${fechaHora}</span></div>
    <div class="dato"><span class="dato-label">Edad:</span><span>${edad !== null ? edad + ' años' : '—'}</span></div>
    <div class="dato"><span class="dato-label">Sexo:</span><span>${paciente.sexo === 'M' ? 'Masculino' : 'Femenino'}</span></div>
    ${paciente.peso_kg ? `<div class="dato"><span class="dato-label">Peso:</span><span>${paciente.peso_kg} kg</span></div>` : ''}
    ${paciente.talla_cm ? `<div class="dato"><span class="dato-label">Talla:</span><span>${paciente.talla_cm} cm</span></div>` : ''}
  </div>
  <div class="nota-content">${notaHtml}</div>
  ${consulta.proxima_cita ? `<div class="proxima-cita"><strong>Próxima cita:</strong> ${consulta.proxima_cita}</div>` : ''}
  ${addendumsHtml}
  <div class="footer"><div class="firma">${medicoInfo?.firma_url ? `<img src="${medicoInfo.firma_url}" style="max-height:60px;max-width:160px;display:block;margin:0 auto 6px;object-fit:contain;" />` : ''}<p>${doctorNombre}</p>${(consulta.medico_cedula_profesional || medicoInfo?.cedula_profesional) ? `<p>Céd. Prof. ${consulta.medico_cedula_profesional || medicoInfo?.cedula_profesional}</p>` : ''}</div></div>
</body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
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
          <button
            onClick={imprimir}
            className="flex items-center gap-2 px-4 py-2 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Contenido de la nota — inmutable */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Motivo de consulta</span>
            <p className="text-sm font-medium text-slate-800">{consulta.motivo_consulta}</p>
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
