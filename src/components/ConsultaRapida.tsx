'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Send, Bot, User, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type Mensaje = {
  rol: 'usuario' | 'claude'
  texto: string
}

const SUGERENCIAS = [
  'Dosis de ketorolaco IV postoperatorio',
  'Nombre comercial de pregabalina en México',
  'Escala de Daniels para fuerza muscular',
  'Posología de metilprednisolona en radiculopatía aguda',
  'Clasificación de Frankel para lesión medular',
]

export default function ConsultaRapida() {
  const [abierto, setAbierto] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

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
        body: JSON.stringify({ pregunta: q }),
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
        className="w-full flex items-center justify-between px-5 py-3 bg-violet-50 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-violet-600" />
          <span className="font-semibold text-violet-800 text-sm">Consulta rápida a Claude</span>
          <span className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">
            Medicamentos · Dosis · Escalas · Clasificaciones
          </span>
        </div>
        {abierto ? <ChevronUp size={16} className="text-violet-500" /> : <ChevronDown size={16} className="text-violet-500" />}
      </button>

      {abierto && (
        <div className="flex flex-col" style={{ maxHeight: '400px' }}>
          {/* Sugerencias rápidas */}
          {mensajes.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs text-slate-400 mb-2">Sugerencias:</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map(s => (
                  <button
                    key={s}
                    onClick={() => preguntar(s)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-600 rounded-full transition-colors"
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
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={13} className="text-violet-600" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.rol === 'usuario'
                      ? 'bg-violet-600 text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {m.rol === 'claude' ? (
                      <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-p:leading-relaxed prose-strong:text-slate-900">
                        <ReactMarkdown>{m.texto}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{m.texto}</p>
                    )}
                  </div>
                  {m.rol === 'usuario' && (
                    <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={13} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {cargando && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-violet-600" />
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
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 disabled:opacity-50"
            />
            <button
              onClick={() => preguntar()}
              disabled={!pregunta.trim() || cargando}
              className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40"
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
