'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Printer, Stethoscope } from 'lucide-react'
import Link from 'next/link'

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
    const edad = paciente.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null
    const fechaConsulta = format(parseISO(consulta.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const notaHtml = (consulta.notas_evolucion || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Nota Médica</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 15mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.6; }
  .header { display:flex; align-items:center; gap:20px; padding-bottom:12px; border-bottom:3px solid #1a3a5c; margin-bottom:14px; }
  .logo { width:75px; height:75px; object-fit:contain; }
  .doctor-name { font-size:15pt; font-weight:bold; color:#1a3a5c; }
  .especialidad { font-size:10pt; color:#1e5fa8; margin:2px 0 3px; }
  .credenciales { font-size:9pt; color:#555; }
  .titulo { text-align:center; font-size:12pt; font-weight:bold; color:#1a3a5c; text-transform:uppercase; border:1.5px solid #1a3a5c; padding:5px; margin-bottom:12px; }
  .datos-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; margin-bottom:14px; font-size:10pt; }
  .dato { display:flex; gap:5px; }
  .dato-label { font-weight:bold; color:#1a3a5c; min-width:80px; }
  .nota-content { font-size:10pt; line-height:1.7; }
  .nota-content strong { color:#1a3a5c; display:block; margin-top:10px; }
  .footer { margin-top:50px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; border-top:1px solid #333; padding-top:6px; min-width:200px; font-size:9pt; color:#555; }
</style></head><body>
  <div class="header">
    <img class="logo" src="/logo.png" onerror="this.style.display='none'" />
    <div>
      <div class="doctor-name">Dr. Angel M. Ancona Pérez</div>
      <div class="especialidad">Cirugía de Columna Vertebral · Traumatología y Ortopedia</div>
      <div class="credenciales">Céd. Prof. 12085805 · CMOT 26/5567/25</div>
    </div>
  </div>
  <div class="titulo">Nota de Evolución Médica</div>
  <div class="datos-grid">
    <div class="dato"><span class="dato-label">Paciente:</span><span>${paciente.nombre} ${paciente.apellidos}</span></div>
    <div class="dato"><span class="dato-label">Fecha:</span><span>${fechaConsulta}</span></div>
    <div class="dato"><span class="dato-label">Edad:</span><span>${edad !== null ? edad + ' años' : '—'}</span></div>
    <div class="dato"><span class="dato-label">Sexo:</span><span>${paciente.sexo === 'M' ? 'Masculino' : 'Femenino'}</span></div>
  </div>
  <div class="nota-content">${notaHtml}</div>
  ${consulta.proxima_cita ? `<p style="margin-top:16px;font-size:10pt;"><strong style="color:#1a3a5c;">Próxima cita:</strong> ${consulta.proxima_cita}</p>` : ''}
  <div class="footer"><div class="firma"><p>Dr. Angel M. Ancona Pérez</p><p>Céd. Prof. 12085805</p></div></div>
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
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
              {consulta.notas_evolucion}
            </pre>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Sin nota de evolución registrada</p>
        )}
      </div>
    </div>
  )
}
