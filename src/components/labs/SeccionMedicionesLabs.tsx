'use client'

import { useState, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import { Activity, Plus } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import ModalAgregarMedicion from '@/components/labs/ModalAgregarMedicion'
import ListaAnalitos from '@/components/labs/ListaAnalitos'
import AnalitoDetailHeader from '@/components/labs/AnalitoDetailHeader'
import TablaMediciones from '@/components/labs/TablaMediciones'
import FiltroMediciones, { recortar, type LimiteMediciones } from '@/components/labs/FiltroMediciones'
import GraficaAnalito from '@/components/labs/GraficaAnalito'
import LeyendaBandas from '@/components/labs/LeyendaBandas'
import { useAnalitosRastreados } from '@/hooks/useAnalitosRastreados'
import { useMedicionesAnalito } from '@/hooks/useMedicionesAnalito'
import { useCatalogoAnalitos } from '@/hooks/useCatalogoAnalitos'
import { useToast } from '@/components/ui/Toast'
import type { Sexo } from '@/lib/labs/utils'

type Props = {
  pacienteId: string
  sexoPaciente: Sexo
}

export default function SeccionMedicionesLabs({ pacienteId, sexoPaciente }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [claveUsuario, setClaveUsuario] = useState<string | null>(null)
  const [limite, setLimite] = useState<LimiteMediciones>('todas')
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

  // Reset del filtro al cambiar de analito — pattern render-time sync
  // (en lugar de useEffect) para evitar cascading renders.
  if (claveSnapshot !== claveSeleccionada) {
    setClaveSnapshot(claveSeleccionada)
    setLimite('todas')
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

  /* ⚠️ EL RECORTE ES POR NÚMERO, NO POR FECHA. Aquí vivía un cálculo de
     ventanas temporales con `subMonths`/`subYears` y un contador por rango; se
     retiró entero con el filtro que lo pedía. `mediciones` llega ordenada de
     más reciente a más antigua, así que «las últimas N» son las N primeras. */
  const medicionesFiltradas = useMemo(
    () => recortar(mediciones, limite),
    [mediciones, limite],
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

  /* La fecha de la última medición sale del propio conjunto, nunca escrita a
     mano: `analitos` ya trae el `ultimoMedidoEn` de cada uno. */
  const ultimaMedicion = useMemo(() => {
    if (analitos.length === 0) return null
    const iso = [...analitos].sort((a, b) => b.ultimoMedidoEn.localeCompare(a.ultimoMedidoEn))[0].ultimoMedidoEn
    try { return format(parseISO(iso), 'd MMM yyyy', { locale: es }) } catch { return null }
  }, [analitos])

  return (
    <section>
      {/* Encabezado propio de la sección, con el conteo y la fecha derivados. */}
      <div className="mb-[var(--sp-3-5)] flex flex-wrap items-baseline justify-between gap-[var(--sp-2-5)]">
        <h2 className="text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
          Mediciones longitudinales
        </h2>
        {hayAnalitos && (
          <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
            {analitos.length} {analitos.length === 1 ? 'analito' : 'analitos'}
            {ultimaMedicion && <> · última medición {ultimaMedicion}</>}
          </p>
        )}
      </div>

      {analitosLoading && !hayAnalitos ? (
        <div className="rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] p-[var(--sp-4-5)]">
          <div className="skeleton h-[220px] rounded-[10px]" />
        </div>
      ) : !hayAnalitos ? (
        <div className="flex flex-col items-center gap-[var(--sp-2-5)] rounded-[var(--sp-r-card)] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-4)] py-[var(--sp-10)]">
          <Activity size={20} className="text-[var(--sp-ink-150)]" />
          <p className="text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
            Sin mediciones registradas. Agrega el primer dato para empezar el seguimiento.
          </p>
          <button type="button" onClick={() => setModalOpen(true)} className="sp-btn sp-btn--compact">
            <Plus size={14} /> Medición
          </button>
        </div>
      ) : (
        /* Lista permanente + detalle. En escritorio en paralelo; por debajo, la
           lista arriba y el detalle debajo, que es el orden del §6.2. */
        <div className="flex flex-col gap-[var(--sp-4)] lg:flex-row lg:items-start">
          <ListaAnalitos
            analitos={analitos}
            catalogo={catalogo}
            sexoPaciente={sexoPaciente}
            claveSeleccionada={claveSeleccionada}
            onSeleccionar={setClaveUsuario}
            onAgregar={() => setModalOpen(true)}
          />

          {/* ⚠️ UNA SOLA CARD PARA TODO EL DETALLE, Y DENTRO NO HAY MÁS CAJAS.
              Antes eran cuatro apiladas —cabecera, gráfica, leyenda y tabla—,
              cada una con su borde: el diseño anterior recolocado. Cada
              contenedor extra convierte la lectura en un formulario, que es el
              mismo principio que ya gobierna los dos visores.
              Las zonas se separan con espacio y, como mucho, un filete de 1 px;
              las piezas de dentro perdieron su marco y NO deben recuperarlo. */}
          <div className="min-w-0 flex-1 rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-5)] py-[var(--sp-4-5)]">
            {analitoSeleccionado && mediciones.length > 0 && (
              <AnalitoDetailHeader
                analito={analitoSeleccionado}
                analitoCatalogo={analitoCatalogo}
                mediciones={mediciones}
                sexoPaciente={sexoPaciente}
                filtro={
                  <FiltroMediciones
                    limite={limite}
                    total={mediciones.length}
                    onChange={setLimite}
                  />
                }
              />
            )}

            {analitoSeleccionado && (
              medicionesLoading && mediciones.length === 0 ? (
                <div className="skeleton mt-[var(--sp-4)] h-[200px] rounded-[10px]" />
              ) : mediciones.length > 0 ? (
                <>
                  <div className="mt-[var(--sp-4)]">
                    <GraficaAnalito
                      analito={analitoSeleccionado}
                      analitoCatalogo={analitoCatalogo}
                      mediciones={medicionesFiltradas}
                      sexoPaciente={sexoPaciente}
                      onResetFiltro={() => setLimite('todas')}
                    />
                  </div>

                  <div className="mt-[var(--sp-3-5)]">
                    <LeyendaBandas
                      analito={analitoSeleccionado}
                      analitoCatalogo={analitoCatalogo}
                      sexoPaciente={sexoPaciente}
                    />
                  </div>

                  {medicionesFiltradas.length > 0 && (
                    /* El único filete de la card: separa la lectura de la
                       gráfica del registro tabulado. */
                    <div className="mt-[var(--sp-4)] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-2)]">
                      <TablaMediciones
                        mediciones={medicionesFiltradas}
                        analito={analitoSeleccionado}
                        analitoCatalogo={analitoCatalogo}
                        onDelete={handleDelete}
                      />
                    </div>
                  )}
                </>
              ) : null
            )}
          </div>
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
