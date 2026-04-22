'use client'

import { useState, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import { Activity, Plus } from 'lucide-react'
import ModalAgregarMedicion from '@/components/labs/ModalAgregarMedicion'
import DropdownSelectorAnalito from '@/components/labs/DropdownSelectorAnalito'
import AnalitoDetailHeader from '@/components/labs/AnalitoDetailHeader'
import TablaMediciones from '@/components/labs/TablaMediciones'
import { useAnalitosRastreados } from '@/hooks/useAnalitosRastreados'
import { useMedicionesAnalito } from '@/hooks/useMedicionesAnalito'
import { useCatalogoAnalitos } from '@/hooks/useCatalogoAnalitos'
import { useToast } from '@/components/ui/Toast'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type Props = {
  pacienteId: string
}

export default function SeccionMedicionesLabs({ pacienteId }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [claveUsuario, setClaveUsuario] = useState<string | null>(null)
  const { mutate } = useSWRConfig()
  const toast = useToast()

  const { analitos, isLoading: analitosLoading } = useAnalitosRastreados(pacienteId)
  const { analitos: catalogo } = useCatalogoAnalitos()

  // Clave efectiva derivada: respeta la selección del usuario si sigue viva;
  // si no (o si no hay selección), cae al analito más recientemente capturado.
  const claveSeleccionada = useMemo<string | null>(() => {
    if (analitos.length === 0) return null
    if (claveUsuario && analitos.some(a => a.clave === claveUsuario)) {
      return claveUsuario
    }
    const ordenados = [...analitos].sort(
      (a, b) => b.ultimoMedidoEn.localeCompare(a.ultimoMedidoEn),
    )
    return ordenados[0]?.clave ?? null
  }, [analitos, claveUsuario])

  const analitoSeleccionado = useMemo(
    () =>
      claveSeleccionada
        ? analitos.find(a => a.clave === claveSeleccionada) ?? null
        : null,
    [analitos, claveSeleccionada],
  )

  const analitoCatalogo = useMemo(() => {
    if (!analitoSeleccionado?.analitoId) return null
    return catalogo.find(a => a.id === analitoSeleccionado.analitoId) ?? null
  }, [analitoSeleccionado, catalogo])

  const { mediciones, isLoading: medicionesLoading } = useMedicionesAnalito(
    pacienteId,
    claveSeleccionada,
  )

  function invalidarTodo() {
    mutate(['stats-labs', pacienteId])
    mutate(['analitos-rastreados', pacienteId])
    if (claveSeleccionada) {
      mutate(['mediciones-analito', pacienteId, claveSeleccionada])
    }
  }

  async function handleDelete(medicionId: string) {
    const res = await fetch(`/api/labs/mediciones/${medicionId}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(typeof body?.error === 'string' ? body.error : 'Error al eliminar')
    }
    invalidarTodo()
    toast.success('Medición eliminada')
  }

  const hayAnalitos = analitos.length > 0

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          Mediciones longitudinales
        </h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          <Plus size={14} /> Agregar medición
        </button>
      </div>

      {analitosLoading && !hayAnalitos ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-[18px]">
          <div className="flex items-center justify-center py-8 text-[12px] text-slate-400">
            Cargando mediciones…
          </div>
        </div>
      ) : !hayAnalitos ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-[18px]">
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
              <Activity size={18} />
            </div>
            <p className="text-[13px] font-medium text-slate-700">
              Sin mediciones registradas.
            </p>
            <p className="text-[12px] text-slate-500 mt-1">
              Agrega tu primer dato para comenzar el seguimiento.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <DropdownSelectorAnalito
            analitos={analitos}
            value={analitoSeleccionado}
            onChange={a => setClaveUsuario(a.clave)}
          />

          {analitoSeleccionado && mediciones.length > 0 && (
            <AnalitoDetailHeader
              analito={analitoSeleccionado}
              analitoCatalogo={analitoCatalogo}
              mediciones={mediciones}
            />
          )}

          {analitoSeleccionado && (
            medicionesLoading && mediciones.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-[12px] text-slate-400 text-center">
                Cargando…
              </div>
            ) : mediciones.length > 0 ? (
              <TablaMediciones
                mediciones={mediciones}
                analito={analitoSeleccionado}
                analitoCatalogo={analitoCatalogo}
                onDelete={handleDelete}
              />
            ) : null
          )}
        </div>
      )}

      {modalOpen && (
        <ModalAgregarMedicion
          open
          onClose={() => setModalOpen(false)}
          pacienteId={pacienteId}
          onSuccess={invalidarTodo}
        />
      )}
    </section>
  )
}
