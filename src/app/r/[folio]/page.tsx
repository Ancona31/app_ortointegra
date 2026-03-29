import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, ShieldCheck, Pill } from 'lucide-react'

type Medicamento = {
  nombre_comercial: string
  presentacion?: string
  principio_activo?: string
  via_administracion?: string
  indicacion?: string
}

type Receta = {
  folio: string
  paciente: string
  diagnostico?: string
  medicamentos: Medicamento[]
  recomendaciones?: string
  fecha: string
  timezone?: string
  medico_nombre?: string
  medico_especialidad?: string
  medico_cedula_profesional?: string
  medico_cedula_especialidad?: string
  clinica_nombre?: string
  color_primario?: string
  color_secundario?: string
}

export default async function VerificacionPage({ params }: { params: Promise<{ folio: string }> }) {
  const { folio } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('documentos')
    .select('contenido, created_at')
    .eq('tipo', 'receta')
    .filter('contenido->>folio', 'eq', folio)
    .single()

  if (error || !data) notFound()

  const receta = data.contenido as Receta
  const emitida = data.created_at
  const cp = receta.color_primario || '#1a3a5c'
  const cs = receta.color_secundario || '#1e5fa8'

  const fechaFormato = receta.fecha
    ? format(parseISO(receta.fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : '—'

  const tz = receta.timezone || 'America/Mexico_City'
  const emitidaFormato = emitida
    ? new Date(emitida).toLocaleString('es-MX', {
        timeZone: tz,
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Sello de verificación */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${cp}, ${cs})` }}
        >
          <ShieldCheck size={40} className="flex-shrink-0 opacity-90" />
          <div>
            <p className="font-bold text-lg leading-tight">Receta Verificada</p>
            <p className="text-sm opacity-80 mt-0.5">
              Emitida el {emitidaFormato} · Folio {receta.folio}
            </p>
          </div>
          <CheckCircle size={28} className="ml-auto flex-shrink-0 opacity-80" />
        </div>

        {/* Datos del médico */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100" style={{ borderLeftWidth: 4, borderLeftColor: cp }}>
            <p className="font-bold text-slate-800 text-base">{receta.medico_nombre || '—'}</p>
            {receta.medico_especialidad && <p className="text-sm italic mt-0.5" style={{ color: cs }}>{receta.medico_especialidad}</p>}
            {receta.clinica_nombre && <p className="text-xs text-slate-400 mt-0.5">{receta.clinica_nombre}</p>}
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-4 text-xs text-slate-500">
            {receta.medico_cedula_profesional && (
              <span><span className="font-semibold text-slate-600">Cédula Prof.:</span> {receta.medico_cedula_profesional}</span>
            )}
            {receta.medico_cedula_especialidad && (
              <span><span className="font-semibold text-slate-600">Cédula Esp.:</span> {receta.medico_cedula_especialidad}</span>
            )}
          </div>
        </div>

        {/* Datos del paciente */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-2">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</span>
              <p className="font-medium text-slate-800 mt-0.5">{receta.paciente}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</span>
              <p className="font-medium text-slate-800 mt-0.5">{fechaFormato}</p>
            </div>
            {receta.diagnostico && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnóstico</span>
                <p className="font-medium text-slate-800 mt-0.5">{receta.diagnostico}</p>
              </div>
            )}
          </div>
        </div>

        {/* Medicamentos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Pill size={15} style={{ color: cp }} />
            <span className="font-semibold text-slate-700 text-sm">Medicamentos prescritos</span>
          </div>
          <div className="divide-y divide-slate-100">
            {(receta.medicamentos || []).filter(m => m.nombre_comercial).map((m, i) => (
              <div key={i} className="px-5 py-4 flex gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: cs }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {m.nombre_comercial.toUpperCase()}
                    {m.presentacion && <span className="font-normal text-slate-500 ml-1">{m.presentacion}</span>}
                  </p>
                  {m.principio_activo && <p className="text-xs italic text-slate-400 mt-0.5">{m.principio_activo}</p>}
                  {m.via_administracion && (
                    <span className="inline-block text-xs font-semibold mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${cs}15`, color: cs }}>
                      Vía {m.via_administracion}
                    </span>
                  )}
                  {m.indicacion && <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{m.indicacion}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendaciones */}
        {receta.recomendaciones && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Recomendaciones</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{receta.recomendaciones}</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-300 pb-4">
          OrtoIntegra · Sistema de Gestión Clínica · ortointegra.com
        </p>
      </div>
    </div>
  )
}
