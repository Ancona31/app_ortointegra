'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Printer, Stethoscope, Pencil, Trash2, Save, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { PRINT_CSS, markdownToHtml } from '@/lib/printStyles'
import ReactMarkdown from 'react-markdown'

export default function ConsultaDetallePage() {
  const { id, consultaId } = useParams<{ id: string; consultaId: string }>()
  const router = useRouter()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(true)

  // Edición
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ motivo_consulta: '', notas_evolucion: '', proxima_cita: '' })
  const [guardando, setGuardando] = useState(false)

  // Eliminar
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('id', consultaId).single(),
      ])
      setPaciente(p)
      setConsulta(c)
      if (c) setForm({
        motivo_consulta: c.motivo_consulta || '',
        notas_evolucion: c.notas_evolucion || '',
        proxima_cita: c.proxima_cita || '',
      })
      setLoading(false)
    }
    cargar()
  }, [id, consultaId])

  async function guardarEdicion() {
    setGuardando(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('consultas')
      .update({
        motivo_consulta: form.motivo_consulta,
        notas_evolucion: form.notas_evolucion,
        proxima_cita: form.proxima_cita || null,
      })
      .eq('id', consultaId)
    setGuardando(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    setConsulta(prev => prev ? { ...prev, ...form } : prev)
    setEditando(false)
  }

  async function eliminar() {
    setEliminando(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('consultas').delete().eq('id', consultaId)
    setEliminando(false)
    if (err) { setError('Error al eliminar: ' + err.message); return }
    router.push(`/expediente/${id}`)
  }

  function imprimir() {
    if (!paciente || !consulta) return
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return

    const logoUrl = `${window.location.origin}/logo.png`
    const edad = paciente.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null
    const fechaHora = format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy, HH:mm 'hrs'", { locale: es })
    const notaHtml = markdownToHtml(consulta.notas_evolucion || '')

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Nota Médica</title>
<style>${PRINT_CSS}</style></head><body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div>
      <div class="doctor-name">Dr. Angel M. Ancona Pérez</div>
      <div class="especialidad">Cirugía de Columna Vertebral · Traumatología y Ortopedia</div>
      <div class="credenciales">Céd. Prof. 12085805 · CMOT 26/5567/25 · Yucatán</div>
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
  <div class="footer"><div class="firma"><p>Dr. Angel M. Ancona Pérez</p></div></div>
</body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>
  if (!consulta || !paciente) return <div className="text-center py-12 text-slate-400">Consulta no encontrada</div>

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Modal confirmar eliminación */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-2">
              <Trash2 size={22} className="text-red-500" />
              <h2 className="font-bold text-slate-800">¿Eliminar nota?</h2>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Esta acción no se puede deshacer. La nota del{' '}
              <span className="font-medium">{format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}</span> será eliminada permanentemente.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmEliminar(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {eliminando ? <><Loader2 size={14} className="animate-spin" /> Eliminando...</> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {!editando && (
            <>
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={() => setConfirmEliminar(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Eliminar
              </button>
              <button
                onClick={imprimir}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors"
              >
                <Printer size={16} /> Imprimir
              </button>
            </>
          )}
          {editando && (
            <>
              <button
                onClick={() => { setEditando(false); setError('') }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X size={14} /> Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
              >
                {guardando ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Save size={14} /> Guardar</>}
              </button>
            </>
          )}
        </div>
      </div>

      {error && !confirmEliminar && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Contenido */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Motivo y próxima cita */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Motivo de consulta</span>
            {editando ? (
              <input
                type="text"
                value={form.motivo_consulta}
                onChange={e => setForm(f => ({ ...f, motivo_consulta: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
              />
            ) : (
              <p className="text-sm font-medium text-slate-800">{consulta.motivo_consulta}</p>
            )}
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Próxima cita</span>
            {editando ? (
              <input
                type="text"
                value={form.proxima_cita}
                onChange={e => setForm(f => ({ ...f, proxima_cita: e.target.value }))}
                placeholder="Ej: En 4 semanas"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
              />
            ) : (
              <p className="text-sm font-medium text-slate-800">{consulta.proxima_cita || '—'}</p>
            )}
          </div>
        </div>

        {/* Nota de evolución */}
        {editando ? (
          <div>
            <span className="text-xs text-slate-400 block mb-2">Nota de evolución</span>
            <textarea
              value={form.notas_evolucion}
              onChange={e => setForm(f => ({ ...f, notas_evolucion: e.target.value }))}
              rows={22}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 resize-y"
            />
          </div>
        ) : (
          consulta.notas_evolucion ? (
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
          )
        )}
      </div>
    </div>
  )
}
