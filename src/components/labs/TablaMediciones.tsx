'use client'

import { useState, useMemo } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import ModalShell from '@/components/ui/ModalShell'
import type { AnalitoCatalogo, MedicionAnalito } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

const LIMITE_DEFAULT = 10
const NOTAS_TRUNCATE = 50

function formatValor(v: number, precision: number): string {
  if (precision <= 0) return String(Math.round(v))
  return v.toFixed(precision)
}

function fechaDia(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

function formatFechaCompleta(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
}

function formatHora(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

function truncarNotas(s: string): { mostrar: string; truncada: boolean } {
  if (s.length <= NOTAS_TRUNCATE) return { mostrar: s, truncada: false }
  return { mostrar: s.slice(0, NOTAS_TRUNCATE).trimEnd() + '…', truncada: true }
}

interface Props {
  mediciones: MedicionAnalito[]
  analito: AnalitoRastreado
  analitoCatalogo: AnalitoCatalogo | null
  onDelete: (medicionId: string) => Promise<void>
}

export default function TablaMediciones({ mediciones, analito, analitoCatalogo, onDelete }: Props) {
  const [expandida, setExpandida] = useState(false)
  const [confirmar, setConfirmar] = useState<MedicionAnalito | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const precision = analitoCatalogo?.precision_decimales ?? 2
  const total = mediciones.length

  const visibles = useMemo(
    () => (expandida ? mediciones : mediciones.slice(0, LIMITE_DEFAULT)),
    [mediciones, expandida],
  )

  async function confirmarEliminar() {
    if (!confirmar) return
    setEliminando(true)
    setError(null)
    try {
      await onDelete(confirmar.id)
      setConfirmar(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar'
      setError(msg)
    } finally {
      setEliminando(false)
    }
  }

  function cerrarModal() {
    if (eliminando) return
    setConfirmar(null)
    setError(null)
  }

  const modalFooter = (
    <div className="flex items-center justify-end gap-2 px-5 py-3">
      <button
        type="button"
        onClick={cerrarModal}
        disabled={eliminando}
        className="px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={confirmarEliminar}
        disabled={eliminando}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white rounded-xl text-[13px] font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ transitionTimingFunction: IOS_EASING }}
      >
        {eliminando ? 'Eliminando…' : 'Eliminar'}
      </button>
    </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                Fecha y hora
              </th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                Valor
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                Notas
              </th>
              <th className="w-12 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((m, idx) => {
              const fechaActual = fechaDia(m.medido_en)
              const fechaAnterior = idx > 0 ? fechaDia(visibles[idx - 1].medido_en) : null
              const mismaFecha = fechaActual === fechaAnterior
              const { mostrar, truncada } = truncarNotas(m.notas ?? '')

              return (
                <tr
                  key={m.id}
                  className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    {mismaFecha ? (
                      <span className="inline-flex items-center gap-1 pl-4 text-slate-500">
                        <span className="text-slate-300">↳</span>
                        {formatHora(m.medido_en)}
                      </span>
                    ) : (
                      formatFechaCompleta(m.medido_en)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">
                    {formatValor(Number(m.valor), precision)}
                    <span className="text-slate-400 ml-1 font-normal">{analito.unidad}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-[240px]">
                    {m.notas ? (
                      <span title={truncada ? (m.notas ?? '') : undefined} className="block truncate">
                        {mostrar}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmar(m)}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      aria-label="Eliminar medición"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > LIMITE_DEFAULT && (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/30 text-center">
          <button
            type="button"
            onClick={() => setExpandida(e => !e)}
            className="text-[12px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {expandida ? 'Ver menos' : `Ver todas (${total})`}
          </button>
        </div>
      )}

      {confirmar && (
        <ModalShell
          open
          onClose={cerrarModal}
          title="Eliminar medición"
          subtitle={analito.nombre}
          icon={<AlertTriangle size={16} />}
          iconBg="bg-red-50 text-red-600"
          maxWidth="max-w-sm"
          footer={modalFooter}
        >
          <div className="px-5 py-4 space-y-3">
            <p className="text-[13px] text-slate-700 leading-relaxed">
              ¿Seguro que quieres eliminar esta medición de{' '}
              <span className="font-semibold">{analito.nombre}</span> del{' '}
              <span className="font-semibold">{formatFechaCompleta(confirmar.medido_en)}</span>?
            </p>
            <p className="text-[12px] text-slate-500">Esta acción no se puede deshacer.</p>
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
                {error}
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  )
}
