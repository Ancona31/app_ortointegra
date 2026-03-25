'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Printer, Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { PRINT_CSS, markdownToHtml } from '@/lib/printStyles'
import ReactMarkdown from 'react-markdown'

export default function ConsultaDetallePage() {
  const { id, consultaId } = useParams<{ id: string; consultaId: string }>()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('id', consultaId).single(),
      ])
      setPaciente(p)
      setConsulta(c)
      setLoading(false)
    }
    cargar()
  }, [id, consultaId])

  function imprimir() {
    if (!paciente || !consulta) return
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return

    const logoUrl = `${window.location.origin}/logo.png`
    const edad = paciente.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null
    const fechaHora = format(
      parseISO(consulta.fecha),
      "dd 'de' MMMM 'de' yyyy, HH:mm 'hrs'",
      { locale: es }
    )
    const notaHtml = markdownToHtml(consulta.notas_evolucion || '')

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Nota Médica</title>
<style>${PRINT_CSS}</style></head><body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
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
        <button onClick={imprimir}
          className="flex items-center gap-2 px-4 py-2 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors">
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 pb-5 border-b border-slate-100">
          <div><span className="text-xs text-slate-400">Motivo de consulta</span>
            <p className="text-sm font-medium text-slate-800 mt-0.5">{consulta.motivo_consulta}</p></div>
          {consulta.proxima_cita && (
            <div><span className="text-xs text-slate-400">Próxima cita</span>
              <p className="text-sm font-medium text-slate-800 mt-0.5">{consulta.proxima_cita}</p></div>
          )}
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
    </div>
  )
}
