'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Send, User, ChevronDown, ChevronUp, TriangleAlert, Copy, Check } from 'lucide-react'

function GeminiIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C12 2 13.8 9 19 12C13.8 15 12 22 12 22C12 22 10.2 15 5 12C10.2 9 12 2 12 2Z" fill="currentColor" />
    </svg>
  )
}

type Mensaje = {
  rol: 'usuario' | 'claude'
  texto: string
}

const SUGERENCIAS = [
  'Dosis de dexketoprofeno inyectable en adulto',
  'Nombres comerciales de pregabalina en México',
  'Tratamiento de infección de vías urinarias no complicada en México',
  'Posología de metilprednisolona en radiculopatía aguda',
  'Clasificación de Frankel para lesión medular',
  'Esquema de antibiótico para herida quirúrgica infectada',
  'Dosis de tramadol en adulto mayor con insuficiencia renal leve',
]

export default function ConsultaRapida() {
  const [abierto, setAbierto] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(false)
  const [copiado, setCopiado] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  function copiar(texto: string, idx: number) {
    navigator.clipboard.writeText(texto)
    setCopiado(idx)
    setTimeout(() => setCopiado(null), 2000)
  }

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function preguntar(texto?: string) {
    const q = texto || pregunta.trim()
    if (!q || cargando) return

    setMensajes(prev => [...prev, { rol: 'usuario', texto: q }])
    setPregunta('')
    setCargando(true)

    try {
      const res = await fetch('/api/consulta-rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q, historial: mensajes }),
      })
      const data = await res.json()
      setMensajes(prev => [...prev, {
        rol: 'claude',
        texto: data.error ? `Error: ${data.error}` : data.respuesta,
      }])
    } catch {
      setMensajes(prev => [...prev, { rol: 'claude', texto: 'Error al conectar con el servidor.' }])
    } finally {
      setCargando(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      preguntar()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — toggle */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GeminiIcon size={18} className="text-[#4285F4]" />
          <span className="font-semibold text-[#1a3a5c] text-sm">Consulta rápida a Gemini</span>
          <span className="text-xs text-[#4285F4] bg-blue-100 px-2 py-0.5 rounded-full">
            Medicamentos · Dosis · Escalas · Clasificaciones
          </span>
        </div>
        {abierto ? <ChevronUp size={16} className="text-[#4285F4]" /> : <ChevronDown size={16} className="text-[#4285F4]" />}
      </button>

      {abierto && (
        <div className="flex flex-col" style={{ maxHeight: '400px' }}>
          {/* Aviso de responsabilidad */}
          <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <TriangleAlert size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              La IA puede cometer errores. Verifica siempre la información antes de aplicarla. El uso clínico de estas respuestas es responsabilidad exclusiva del profesional de salud.
            </p>
          </div>
          {/* Sugerencias rápidas */}
          {mensajes.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs text-slate-400 mb-2">Sugerencias:</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map(s => (
                  <button
                    key={s}
                    onClick={() => preguntar(s)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-[#4285F4] text-slate-600 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial de mensajes */}
          {mensajes.length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {mensajes.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  {m.rol === 'claude' && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <GeminiIcon size={13} className="text-[#4285F4]" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.rol === 'usuario'
                      ? 'bg-[#4285F4] text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {m.rol === 'claude' ? (
                      <div>
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{m.texto}</p>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => copiar(m.texto, i)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#4285F4] transition-colors"
                          >
                            {copiado === i
                              ? <><Check size={11} className="text-emerald-500" /><span className="text-emerald-500">Copiado</span></>
                              : <><Copy size={11} /><span>Copiar</span></>
                            }
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{m.texto}</p>
                    )}
                  </div>
                  {m.rol === 'usuario' && (
                    <div className="w-6 h-6 rounded-full bg-[#4285F4] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={13} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {cargando && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <GeminiIcon size={13} className="text-[#4285F4]" />
                  </div>
                  <div className="bg-slate-100 rounded-xl rounded-tl-sm px-3 py-2">
                    <Loader2 size={14} className="animate-spin text-violet-500" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ej: Dosis de tramadol en adulto mayor con insuficiencia renal..."
              disabled={cargando}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4285F4]/30 focus:border-[#4285F4] disabled:opacity-50"
            />
            <button
              onClick={() => preguntar()}
              disabled={!pregunta.trim() || cargando}
              className="px-3 py-2 bg-[#4285F4] text-white rounded-lg hover:bg-[#3367d6] transition-colors disabled:opacity-40"
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
