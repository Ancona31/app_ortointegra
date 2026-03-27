'use client'

import { format, parseISO } from 'date-fns'
import { Activity, BarChart2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Palabras que no distinguen el parámetro clínico (se ignoran al agrupar)
const QUALIFIERS_IGNORAR = new Set([
  'serica','serico','sericas','sericos',
  'basal','en','ayunas','simple','total','completo','completa',
  'plasmatica','plasmatico','venosa','venoso','capilar','capilary',
  'sangre','sanguinea','sanguineo','urinaria','urinario',
  'de','la','el','los','las','y','o',
])

export function normalizarKey(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')      // quitar puntuación
    .split(/\s+/)
    .filter(w => w.length >= 2 && !QUALIFIERS_IGNORAR.has(w))
    .join(' ')
    .trim()
}

// Parsea strings como "70-100", "<5.7", ">40", "40-60"
export function parseRango(rango?: string): { min: number | null; max: number | null } {
  if (!rango) return { min: null, max: null }
  const rng = rango.trim()
  const entre = rng.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)$/)
  if (entre) return { min: parseFloat(entre[1]), max: parseFloat(entre[2]) }
  const menorQ = rng.match(/^[<≤]\s*(\d+\.?\d*)$/)
  if (menorQ) return { min: null, max: parseFloat(menorQ[1]) }
  const mayorQ = rng.match(/^[>≥]\s*(\d+\.?\d*)$/)
  if (mayorQ) return { min: parseFloat(mayorQ[1]), max: null }
  return { min: null, max: null }
}

type PuntoGrafica = { fechaLabel: string; fechaISO: string; valor: number; estado?: string }
export type ParamGrafica = {
  nombre: string
  aliases: string[]
  unidad: string
  rango_ref?: string
  rango_optimo?: string
  puntos: PuntoGrafica[]
}

function GraficaParametro({ param }: { param: ParamGrafica }) {
  const { min: refMin, max: refMax } = parseRango(param.rango_ref)
  const { min: optMin, max: optMax } = parseRango(param.rango_optimo)

  const vals = param.puntos.map(p => p.valor)
  const allNums = [
    ...vals, refMin, refMax, optMin, optMax,
  ].filter((v): v is number => v !== null && v !== undefined && !isNaN(v))

  const span = Math.max(...allNums) - Math.min(...allNums)
  const pad = span * 0.15 || Math.max(...allNums) * 0.1
  const yMin = Math.min(...allNums) - pad
  const yMax = Math.max(...allNums) + pad

  const data = param.puntos.map(p => ({ fecha: p.fechaLabel, valor: p.valor }))

  const getColor = (estado?: string) => {
    if (estado === 'bajo' || estado === 'alto') return '#dc2626'
    if (estado === 'suboptimo') return '#d97706'
    return '#1e5fa8'
  }
  const lastEstado = param.puntos[param.puntos.length - 1]?.estado
  const lineColor = getColor(lastEstado)

  return (
    <div className="pt-3 pb-1">
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 6, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px' }}
            formatter={(v: any) => [`${v} ${param.unidad}`, param.nombre]}
          />
          {optMin !== null && (
            <ReferenceLine y={optMin} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Ópt. mín', position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
          )}
          {optMax !== null && (
            <ReferenceLine y={optMax} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Ópt. máx', position: 'insideBottomRight', fontSize: 9, fill: '#10b981' }} />
          )}
          {refMin !== null && (
            <ReferenceLine y={refMin} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
          )}
          {refMax !== null && (
            <ReferenceLine y={refMax} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
          )}
          <Line
            type="monotone"
            dataKey="valor"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={(props: any) => {
              const est = param.puntos[props.index]?.estado
              const c = getColor(est)
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={c} stroke="#fff" strokeWidth={1.5} />
            }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {param.puntos.length === 1 && (
        <p className="text-center text-xs text-slate-400 mt-1">Solo 1 medición — agrega más laboratorios para ver la tendencia</p>
      )}
    </div>
  )
}

interface Props {
  todosLosParams: ParamGrafica[]
  paramsFiltrados: ParamGrafica[]
  conTendencia: number
  busquedaParam: string
  graficasAbiertas: Record<string, boolean>
  onBusquedaChange: (valor: string) => void
  onToggleGrafica: (nombre: string) => void
}

export default function TabGraficas({
  todosLosParams,
  paramsFiltrados,
  conTendencia,
  busquedaParam,
  graficasAbiertas,
  onBusquedaChange,
  onToggleGrafica,
}: Props) {
  return (
    <div className="space-y-3">
      {todosLosParams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <BarChart2 size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sin datos para graficar</p>
          <p className="text-xs text-slate-400 mt-1">Agrega laboratorios para ver la evolución de los parámetros</p>
        </div>
      ) : (
        <>
          {/* Info + stats */}
          <div className="flex items-start gap-3">
            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-[#1a3a5c]">
              <Activity size={14} className="mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-semibold">{todosLosParams.length} parámetros</span> detectados en todos los laboratorios ·{' '}
                <span className="text-emerald-700 font-semibold">{conTendencia} con tendencia</span> (2+ mediciones).
                Las líneas <span className="text-emerald-600 font-semibold">verdes</span> = rango óptimo,{' '}
                <span className="text-amber-500 font-semibold">amarillas</span> = rango de referencia.
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busquedaParam}
              onChange={e => onBusquedaChange(e.target.value)}
              placeholder="Buscar parámetro..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 bg-white"
            />
          </div>

          {/* Lista de parámetros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {paramsFiltrados.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Sin resultados para "{busquedaParam}"</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paramsFiltrados.map(param => {
                  const abierto = !!graficasAbiertas[param.nombre]
                  const ultimo = param.puntos[param.puntos.length - 1]
                  const estadoColor: Record<string, string> = {
                    optimo: 'bg-emerald-100 text-emerald-700',
                    normal: 'bg-emerald-100 text-emerald-700',
                    suboptimo: 'bg-amber-100 text-amber-700',
                    bajo: 'bg-red-100 text-red-700',
                    alto: 'bg-red-100 text-red-700',
                  }
                  const estadoLabel: Record<string, string> = {
                    optimo: 'Óptimo', normal: 'Normal', suboptimo: 'Sub-óptimo', bajo: 'Bajo', alto: 'Alto'
                  }
                  const est = ultimo?.estado || ''

                  return (
                    <div key={param.nombre}>
                      <div className="flex items-center px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-800">{param.nombre}</p>
                            {est && estadoColor[est] && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[est]}`}>
                                {estadoLabel[est]}
                              </span>
                            )}
                            {param.puntos.length > 1 && (
                              <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
                                {param.puntos.length} mediciones
                              </span>
                            )}
                            {param.aliases.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full" title={`También encontrado como: ${param.aliases.join(', ')}`}>
                                ~agrupado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Último: <span className="font-medium text-slate-600">{ultimo.valor} {param.unidad}</span>
                            {' · '}{format(parseISO(ultimo.fechaISO), "dd/MM/yyyy")}
                            {param.aliases.length > 0 && (
                              <span className="italic"> · también: {param.aliases.join(', ')}</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => onToggleGrafica(param.nombre)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                            abierto
                              ? 'bg-[#1e5fa8] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <BarChart2 size={12} />
                          {abierto ? 'Ocultar' : 'Ver gráfica'}
                          {abierto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </div>

                      {abierto && (
                        <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                          <GraficaParametro param={param} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
