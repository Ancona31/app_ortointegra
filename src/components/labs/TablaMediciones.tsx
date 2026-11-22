'use client'

import { useState, useMemo } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import ModalShell from '@/components/ui/ModalShell'
import type { AnalitoCatalogo, MedicionAnalito } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'

const LIMITE_DEFAULT = 10

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

  return (
    /* Sin marco ni fondo de encabezado: la tabla es la última zona de la card
       del detalle, y sus filas se separan con filetes de 1 px. */
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px] leading-5">
          <thead>
            <tr className="border-b border-linea text-[12px] font-semibold leading-4 text-tinta2">
              <th className="py-2 pr-3 text-left font-semibold">Fecha y hora</th>
              <th className="py-2 pr-3 text-right font-semibold">Valor</th>
              <th className="py-2 pr-3 text-left font-semibold">Notas</th>
              <th className="w-11 py-2"><span className="sr-only">Eliminar</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m, idx) => {
              const fechaActual = fechaDia(m.medido_en)
              const fechaAnterior = idx > 0 ? fechaDia(visibles[idx - 1].medido_en) : null
              const mismaFecha = fechaActual === fechaAnterior
              return (
                <tr key={m.id} className="border-b border-linea last:border-b-0">
                  <td className="k-num whitespace-nowrap py-2 pr-3 align-top text-tinta">
                    {mismaFecha ? (
                      <span className="inline-flex items-center gap-1 pl-4 text-tinta2">
                        <span aria-hidden="true" className="text-tinta3">↳</span>
                        {formatHora(m.medido_en)}
                      </span>
                    ) : (
                      formatFechaCompleta(m.medido_en)
                    )}
                  </td>
                  <td className="k-num whitespace-nowrap py-2 pr-3 text-right align-top font-semibold text-tinta">
                    {formatValor(Number(m.valor), precision)}
                    <span className="ml-1 text-[13px] font-normal text-tinta2">{analito.unidad}</span>
                  </td>
                  {/* Arreglo de front (B7): la nota SIN truncar, entera y envuelta;
                      la nota completa sigue también en el `title`. */}
                  <td className="min-w-[160px] py-2 pr-3 align-top text-tinta2 [overflow-wrap:anywhere]">
                    {m.notas ? <span title={m.notas}>{m.notas}</span> : <span aria-hidden="true">—</span>}
                  </td>
                  <td className="py-0.5 text-right align-top">
                    <button type="button" onClick={() => setConfirmar(m)} className="k-b k-b-icono" aria-label="Eliminar medición">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > LIMITE_DEFAULT && (
        <div className="border-t border-linea pt-1 text-center">
          <button type="button" onClick={() => setExpandida(e => !e)} className="k-b k-b-texto">
            {expandida ? 'Ver menos' : `Ver todas (${total})`}
          </button>
        </div>
      )}

      {/* Alerta destructiva del catálogo (CALMA §13): el foco entra en «Cancelar». */}
      <ModalShell
        open={!!confirmar}
        onClose={cerrarModal}
        variante="alerta"
        tono="destruir"
        icon={<AlertTriangle aria-hidden="true" />}
        title="Eliminar medición"
        subtitle={analito.nombre}
        footer={
          <>
            <button type="button" autoFocus onClick={cerrarModal} disabled={eliminando} className="k-b k-b-capa k-b-quieto">
              Cancelar
            </button>
            <button type="button" data-principal onClick={confirmarEliminar} disabled={eliminando} className="k-b k-b-capa k-b-mal">
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        {confirmar && (
          <p>
            ¿Seguro que quieres eliminar esta medición de{' '}
            <span className="font-semibold">{analito.nombre}</span> del{' '}
            <span className="font-semibold">{formatFechaCompleta(confirmar.medido_en)}</span>?
          </p>
        )}
        <p className="mt-2">Esta acción no se puede deshacer.</p>
        {error && <p role="alert" className="k-campo-error mt-3">{error}</p>}
      </ModalShell>
    </div>
  )
}
