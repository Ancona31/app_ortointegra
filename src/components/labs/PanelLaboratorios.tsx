'use client'

import type { Paciente } from '@/types'
import SeccionDocumentosLabs from './SeccionDocumentosLabs'
import SeccionMedicionesLabs from './SeccionMedicionesLabs'

/**
 * La pestaña «Mediciones y archivos». Dos secciones, en el orden del §6:
 * archivos clínicos primero, mediciones longitudinales después.
 *
 * ⚠️ RECIBE EL PACIENTE POR PROP Y NO CONSULTA NADA. Los conteos y los estados
 * vacíos los pone cada sección con sus propios datos, que son los que ya tiene
 * cargados. Duplicar aquí el conteo de analitos o de archivos daría dos números
 * que pueden discrepar mientras uno de los dos revalida.
 *
 * ⚠️ AQUÍ NO VUELVE NINGÚN ESTADO VACÍO DE PESTAÑA. Vivió uno: cuando el
 * paciente no tenía ni archivos ni analitos, un bloque que contaba con el hook
 * `useStatsLabs` —retirado con él, porque era su único consumidor—
 * sustituía a las DOS secciones enteras y se llevaba por delante la zona de
 * arrastre y el botón «Medición». Resultado: un paciente nuevo leía «registra la
 * primera medición» sin ningún control con el que hacerlo, y no había forma de
 * empezar su seguimiento. Un estado vacío describe una lista; no puede tapar la
 * acción que lo resuelve. Cada sección ya enseña el suyo —con su control
 * dentro—, y además dice cuál de las dos falta.
 *
 * ⚠️ ES EL ÚNICO SITIO DONDE VIVEN LOS ARCHIVOS SUBIDOS. La pestaña Documentos
 * los dejó fuera a propósito —allí solo van los formatos que la app compone— y
 * su visor remite aquí cuando alguien llega a uno por url. Si algún día esta
 * sección se mueve, hay que arreglar ese enlace.
 */
export default function PanelLaboratorios({ paciente }: { paciente: Paciente }) {
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
