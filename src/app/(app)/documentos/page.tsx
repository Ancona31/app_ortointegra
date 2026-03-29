'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Pill, FlaskConical, ScanLine, ClipboardList, Search, User, X, BedDouble, PenLine } from 'lucide-react'
import RecetaForm from '@/components/documentos/RecetaForm'
import SolicitudLabForm from '@/components/documentos/SolicitudLabForm'
import SolicitudImagenForm from '@/components/documentos/SolicitudImagenForm'
import PlanSuplementacionForm from '@/components/documentos/PlanSuplementacionForm'
import SolicitudInternamientoForm from '@/components/documentos/SolicitudInternamientoForm'
import EscritoMedicoForm from '@/components/documentos/EscritoMedicoForm'
import { createClient } from '@/lib/supabase/client'

const TIPOS = [
  { key: 'receta', label: 'Receta Médica', icon: Pill, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { key: 'lab', label: 'Solicitud de Laboratorio', icon: FlaskConical, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { key: 'imagen', label: 'Solicitud de Imagen', icon: ScanLine, color: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
  { key: 'suplementacion', label: 'Plan de Suplementación', icon: ClipboardList, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { key: 'internamiento', label: 'Solicitud de Internamiento', icon: BedDouble, color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' },
  { key: 'escrito', label: 'Escrito Médico', icon: PenLine, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
] as const

type TipoDoc = typeof TIPOS[number]['key']

type Paciente = { id: string; nombre: string; apellidos: string }

function DocumentosContent() {
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState<TipoDoc | null>(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const t = searchParams.get('tipo') as TipoDoc | null
    if (t && TIPOS.some(x => x.key === t)) setTipo(t)
  }, [searchParams])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos')
        .or(`nombre.ilike.%${busqueda}%,apellidos.ilike.%${busqueda}%`)
        .limit(8)
      setResultados(data ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  function seleccionar(p: Paciente) {
    setPacienteSeleccionado(p)
    setBusqueda('')
    setResultados([])
  }

  function limpiarPaciente() {
    setPacienteSeleccionado(null)
    setTipo(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <FileText size={24} /> Documentos
        </h1>
        <p className="text-slate-500 text-sm mt-1">Genera e imprime documentos con tu membrete oficial</p>
      </div>

      {/* Paso 1 — Seleccionar paciente */}
      {!pacienteSeleccionado ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <User size={18} className="text-[#1e5fa8]" />
            <h2 className="font-semibold text-slate-700">Selecciona el paciente</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">Todos los documentos se guardan en el expediente del paciente.</p>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o apellido..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
              autoFocus
            />
          </div>
          {resultados.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              {resultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => seleccionar(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-slate-100 last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-[#1e5fa8]/10 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-[#1e5fa8]" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{p.nombre} {p.apellidos}</span>
                </button>
              ))}
            </div>
          )}
          {buscando && <p className="text-xs text-slate-400 mt-2 text-center">Buscando...</p>}
          {busqueda.length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 text-center">No se encontraron pacientes.</p>
          )}
        </div>
      ) : (
        <>
          {/* Paciente seleccionado */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1e5fa8] flex items-center justify-center">
                <User size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a3a5c]">{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellidos}</p>
                <p className="text-xs text-slate-400">Paciente seleccionado</p>
              </div>
            </div>
            <button onClick={limpiarPaciente} className="text-slate-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Selector de tipo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {TIPOS.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setTipo(key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${color} ${tipo === key ? 'ring-2 ring-offset-1 ring-[#1e5fa8]' : ''}`}
              >
                <Icon size={24} />
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Formulario según tipo */}
          {tipo === 'receta' && (
            <RecetaForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'lab' && <SolicitudLabForm pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'imagen' && <SolicitudImagenForm pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'suplementacion' && <PlanSuplementacionForm pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'internamiento' && (
            <SolicitudInternamientoForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'escrito' && (
            <EscritoMedicoForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {!tipo && (
            <div className="text-center py-12 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p>Selecciona el tipo de documento que deseas generar</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DocumentosPage() {
  return (
    <Suspense>
      <DocumentosContent />
    </Suspense>
  )
}
