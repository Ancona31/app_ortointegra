'use client'

import { Activity } from 'lucide-react'
import type { Paciente } from '@/types'
import { useStatsLabs } from '@/hooks/useStatsLabs'
import SeccionDocumentosLabs from './SeccionDocumentosLabs'
import SeccionMedicionesLabs from './SeccionMedicionesLabs'

/**
 * La pestaña «Mediciones y archivos». Dos secciones, en el orden del §6:
 * archivos clínicos primero, mediciones longitudinales después.
 *
 * ⚠️ RECIBE EL PACIENTE POR PROP Y NO LO CONSULTA. Lo que sí consulta es
 * `useStatsLabs`, y solo para decidir si la pestaña ENTERA está vacía: los
 * conteos que se enseñan los pone cada sección con sus propios datos, que son
 * los que ya tiene cargados. Duplicar aquí el conteo de analitos o de archivos
 * daría dos números que pueden discrepar mientras uno de los dos revalida.
 *
 * ⚠️ SIN `HeroLabs`. Aquel encabezado repetía nombre, edad y expediente —que
 * ahora están en la cabecera del paciente, visible en las cuatro pestañas— y
 * traía dos botones cuyo `onClick` era un `console.log` de marcador. Sus dos
 * conteos —analitos rastreados y última medición— vuelven en este bloque, pero
 * repartidos: cada uno en el encabezado de la sección que lo puede afirmar. Los
 * botones muertos no vuelven.
 *
 * ⚠️ ES EL ÚNICO SITIO DONDE VIVEN LOS ARCHIVOS SUBIDOS. La pestaña Documentos
 * los dejó fuera a propósito —allí solo van los formatos que la app compone— y
 * su visor remite aquí cuando alguien llega a uno por url. Si algún día esta
 * sección se mueve, hay que arreglar ese enlace.
 */
export default function PanelLaboratorios({ paciente }: { paciente: Paciente }) {
  const { stats, isLoading } = useStatsLabs(paciente.id)

  /* Estado vacío de la PESTAÑA: un solo bloque cuando no hay ni archivos ni
     analitos. Con uno de los dos, cada sección enseña el suyo — que es más útil,
     porque dice cuál de las dos falta. */
  const vacioTotal = !isLoading && stats.analitosTracked === 0 && stats.documentosCount === 0

  if (vacioTotal) {
    return (
      <div className="flex flex-col items-center gap-[var(--sp-2-5)] rounded-[var(--sp-r-card)] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-pad-row-x)] py-[var(--sp-10)]">
        <Activity size={20} className="text-[var(--sp-ink-150)]" />
        <p className="text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
          Este paciente no tiene todavía mediciones ni archivos clínicos.
        </p>
        <p className="text-center text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
          Sube un resultado de laboratorio o registra la primera medición para empezar el seguimiento.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <SeccionDocumentosLabs pacienteId={paciente.id} />

      {/* Las dos secciones se separan por línea divisoria y cada una lleva su
          encabezado propio, que es lo que pide el §6.2. */}
      <div className="mt-[var(--sp-6-5)] border-t border-[color:var(--sp-line-card)] pt-[var(--sp-5-5)]">
        <SeccionMedicionesLabs pacienteId={paciente.id} sexoPaciente={paciente.sexo} />
      </div>
    </div>
  )
}
