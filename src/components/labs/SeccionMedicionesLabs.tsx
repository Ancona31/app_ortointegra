'use client'

import { useState, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import { Activity, Plus } from 'lucide-react'
import { parseISO, subMonths, subYears } from 'date-fns'
import ModalAgregarMedicion from '@/components/labs/ModalAgregarMedicion'
import DropdownSelectorAnalito from '@/components/labs/DropdownSelectorAnalito'
import AnalitoDetailHeader from '@/components/labs/AnalitoDetailHeader'
import TablaMediciones from '@/components/labs/TablaMediciones'
import FiltroTemporal, { type RangoTemporal } from '@/components/labs/FiltroTemporal'
import GraficaAnalito from '@/components/labs/GraficaAnalito'
import LeyendaBandas from '@/components/labs/LeyendaBandas'
import { useAnalitosRastreados } from '@/hooks/useAnalitosRastreados'
import { useMedicionesAnalito } from '@/hooks/useMedicionesAnalito'
import { useCatalogoAnalitos } from '@/hooks/useCatalogoAnalitos'
import { useToast } from '@/components/ui/Toast'
import type { Sexo } from '@/lib/labs/utils'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type Props = {
  pacienteId: string
  sexoPaciente: Sexo
}

export default function SeccionMedicionesLabs({ pacienteId, sexoPaciente }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [claveUsuario, setClaveUsuario] = useState<string | null>(null)
  const [rangoTemporal, setRangoTemporal] = useState<RangoTemporal>('todo')
  const [claveSnapshot, setClaveSnapshot] = useState<string | null>(null)
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

  // Reset del filtro temporal al cambiar de analito — pattern render-time sync
  // (en lugar de useEffect) para evitar cascading renders.
  if (claveSnapshot !== claveSeleccionada) {
    setClaveSnapshot(claveSeleccionada)
    setRangoTemporal('todo')
  }

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

  const contadoresPorRango = useMemo<Record<RangoTemporal, number>>(() => {
    const now = new Date()
    const cutoffs = {
      '1m': subMonths(now, 1),
      '3m': subMonths(now, 3),
      '6m': subMonths(now, 6),
      '1a': subYears(now, 1),
      '5a': subYears(now, 5),
    }
    const countFrom = (cutoff: Date) =>
      mediciones.filter(m => parseISO(m.medido_en) >= cutoff).length
    return {
      '1m': countFrom(cutoffs['1m']),
      '3m': countFrom(cutoffs['3m']),
      '6m': countFrom(cutoffs['6m']),
      '1a': countFrom(cutoffs['1a']),
      '5a': countFrom(cutoffs['5a']),
      'todo': mediciones.length,
    }
  }, [mediciones])

  const medicionesFiltradas = useMemo(() => {
    if (rangoTemporal === 'todo') return mediciones
    const now = new Date()
    const cutoff = {
      '1m': subMonths(now, 1),
      '3m': subMonths(now, 3),
      '6m': subMonths(now, 6),
      '1a': subYears(now, 1),
      '5a': subYears(now, 5),
    }[rangoTemporal]
    return mediciones.filter(m => parseISO(m.medido_en) >= cutoff)
  }, [mediciones, rangoTemporal])

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

          {analitoSeleccionado && mediciones.length > 0 && (
            <FiltroTemporal
              rango={rangoTemporal}
              contadores={contadoresPorRango}
              onChange={setRangoTemporal}
            />
          )}

          {analitoSeleccionado && (
            medicionesLoading && mediciones.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-[12px] text-slate-400 text-center">
                Cargando…
              </div>
            ) : mediciones.length > 0 ? (
              <>
                <GraficaAnalito
                  analito={analitoSeleccionado}
                  analitoCatalogo={analitoCatalogo}
                  mediciones={medicionesFiltradas}
                  sexoPaciente={sexoPaciente}
                  onResetFiltro={() => setRangoTemporal('todo')}
                />
                <LeyendaBandas
                  analito={analitoSeleccionado}
                  analitoCatalogo={analitoCatalogo}
                  sexoPaciente={sexoPaciente}
                />
                {medicionesFiltradas.length > 0 && (
                  <TablaMediciones
                    mediciones={medicionesFiltradas}
                    analito={analitoSeleccionado}
                    analitoCatalogo={analitoCatalogo}
                    onDelete={handleDelete}
                  />
                )}
              </>
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
