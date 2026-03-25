'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { ArrowLeft, Wand2, Save, Loader2, RotateCcw, Printer, Eye, Pencil } from 'lucide-react'
import Link from 'next/link'
import { PRINT_CSS, markdownToHtml } from '@/lib/printStyles'
import ReactMarkdown from 'react-markdown'

export default function NuevaNotaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [form, setForm] = useState({
    motivo_consulta: '',
    exploracion_fisica: '',
    diagnosticos: '',
    plan_tratamiento: '',
    proxima_cita: '',
  })
  const [notaGenerada, setNotaGenerada] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data } = await supabase.from('pacientes').select('*').eq('id', id).single()
      setPaciente(data)
    }
    cargar()
  }, [id])

  function update(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function generarNota() {
    if (!form.motivo_consulta) { setError('Ingresa al menos el motivo de consulta'); return }
    setGenerando(true)
    setError('')

    const edad = paciente?.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null

    try {
      const res = await fetch('/api/nota-medica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: `${paciente?.nombre} ${paciente?.apellidos}`,
          edad,
          sexo: paciente?.sexo,
          peso: paciente?.peso_kg,
          talla: paciente?.talla_cm,
          antecedentes: [
            paciente?.ant_patologicos,
            paciente?.ant_quirurgicos,
            paciente?.medicamentos_actuales ? `Medicamentos: ${paciente.medicamentos_actuales}` : null,
            paciente?.alergias ? `Alergias: ${paciente.alergias}` : null,
          ].filter(Boolean).join('. '),
          ...form,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNotaGenerada(data.nota)
    } catch (e: any) {
      setError('Error al generar nota: ' + e.message)
    } finally {
      setGenerando(false)
    }
  }

  async function guardar() {
    if (!notaGenerada && !form.motivo_consulta) { setError('Completa la nota antes de guardar'); return }
    setGuardando(true)
    const supabase = createClient()

    const { error: err } = await supabase.from('consultas').insert({
      paciente_id: id,
      fecha: new Date().toISOString(),
      motivo_consulta: form.motivo_consulta,
      exploracion_fisica: form.exploracion_fisica,
      diagnosticos: form.diagnosticos ? [{ descripcion: form.diagnosticos }] : [],
      plan_tratamiento: form.plan_tratamiento,
      notas_evolucion: notaGenerada,
      proxima_cita: form.proxima_cita || null,
    })

    setGuardando(false)
    if (err) setError('Error al guardar: ' + err.message)
    else router.push(`/expediente/${id}`)
  }

  function imprimir() {
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana || !paciente) return

    const ahora = new Date()
    const edad = paciente.fecha_nacimiento
      ? differenceInYears(ahora, parseISO(paciente.fecha_nacimiento))
      : null
    const fechaHora = ahora.toLocaleString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })

    const notaHtml = markdownToHtml(notaGenerada)

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Nota Médica</title>
<style>${PRINT_CSS}</style></head><body>
  <div class="header">
    <img class="logo" src="/logo.png" onerror="this.style.display='none'" />
    <div>
      <div class="doctor-name">Dr. Angel M. Ancona Pérez</div>
      <div class="especialidad">Cirugía de Columna Vertebral · Traumatología y Ortopedia</div>
      <div class="credenciales">Céd. Prof. 12085805 · CMOT 26/5567/25 · Lun–Vie 09:00–14:00 / 15:00–20:00</div>
    </div>
  </div>
  <div class="titulo">Nota de Evolución Médica</div>
  <div class="datos-grid">
    <div class="dato"><span class="dato-label">Paciente:</span><span>${paciente.nombre} ${paciente.apellidos}</span></div>
    <div class="dato"><span class="dato-label">Fecha y hora:</span><span>${fechaHora}</span></div>
    <div class="dato"><span class="dato-label">Edad:</span><span>${edad !== null ? edad + ' años' : '—'}</span></div>
    <div class="dato"><span class="dato-label">Sexo:</span><span>${paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : '—'}</span></div>
    ${paciente.peso_kg ? `<div class="dato"><span class="dato-label">Peso:</span><span>${paciente.peso_kg} kg</span></div>` : ''}
    ${paciente.talla_cm ? `<div class="dato"><span class="dato-label">Talla:</span><span>${paciente.talla_cm} cm</span></div>` : ''}
  </div>
  <div class="nota-content">${notaHtml}</div>
  ${form.proxima_cita ? `<div class="proxima-cita"><strong>Próxima cita:</strong> ${form.proxima_cita}</div>` : ''}
  <div class="footer"><div class="firma"><p>Dr. Angel M. Ancona Pérez</p></div></div>
</body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Nueva Nota Médica</h1>
          {paciente && (
            <p className="text-slate-500 text-sm mt-0.5">
              {paciente.nombre} {paciente.apellidos} ·{' '}
              {paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) + ' años' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Datos de la consulta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Datos de la consulta</h2>
          <p className="text-xs text-slate-400 mt-0.5">Completa los campos y Claude redactará la nota médica</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Motivo de consulta <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.motivo_consulta}
              onChange={e => update('motivo_consulta', e.target.value)}
              placeholder="Ej: Dolor lumbar crónico, limitación funcional..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico(s)</label>
            <input
              type="text"
              value={form.diagnosticos}
              onChange={e => update('diagnosticos', e.target.value)}
              placeholder="Ej: Hernia discal L4-L5 con radiculopatía derecha, Espondilolistesis L5-S1 grado I..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Exploración física <span className="text-slate-400 font-normal">(opcional — Claude la complementa)</span>
            </label>
            <textarea
              value={form.exploracion_fisica}
              onChange={e => update('exploracion_fisica', e.target.value)}
              placeholder="Ej: Marcha antiálgica, Lasègue positivo a 45° derecho, hipoestesia en L5..."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Plan de tratamiento <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.plan_tratamiento}
              onChange={e => update('plan_tratamiento', e.target.value)}
              placeholder="Ej: Manejo conservador, fisioterapia, AINES, valorar cirugía..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Próxima cita</label>
            <input
              type="text"
              value={form.proxima_cita}
              onChange={e => update('proxima_cita', e.target.value)}
              placeholder="Ej: En 4 semanas con RMN / 15 de Abril a las 10:00 am"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Botón generar */}
      <button
        onClick={generarNota}
        disabled={generando || !form.motivo_consulta}
        className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generando
          ? <><Loader2 size={18} className="animate-spin" /> Redactando nota médica...</>
          : <><Wand2 size={18} /> Generar nota médica con IA</>
        }
      </button>

      {/* Nota generada */}
      {notaGenerada && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-700 text-sm">Nota médica generada</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {modoEdicion ? 'Editando texto — cambia lo que necesites' : 'Vista previa — haz clic en Editar para modificar'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModoEdicion(!modoEdicion)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${modoEdicion ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {modoEdicion ? <><Eye size={12} /> Vista previa</> : <><Pencil size={12} /> Editar</>}
              </button>
              <button onClick={generarNota} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                <RotateCcw size={12} /> Regenerar
              </button>
            </div>
          </div>
          <div className="p-5">
            {modoEdicion ? (
              <textarea
                value={notaGenerada}
                onChange={e => setNotaGenerada(e.target.value)}
                rows={22}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 resize-y"
              />
            ) : (
              <div className="prose prose-sm max-w-none
                prose-headings:text-[#1a3a5c] prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-1
                prose-strong:text-[#1a3a5c] prose-strong:font-semibold
                prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1
                prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-700
              ">
                <ReactMarkdown>
                  {notaGenerada}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acciones */}
      {notaGenerada && (
        <div className="flex gap-3 pb-6">
          <button
            onClick={imprimir}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors"
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
          >
            {guardando
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : <><Save size={16} /> Guardar en expediente</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
