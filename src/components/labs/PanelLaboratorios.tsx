'use client'

import type { Paciente } from '@/types'
import SeccionDocumentosLabs from './SeccionDocumentosLabs'
import SeccionMedicionesLabs from './SeccionMedicionesLabs'

/**
 * El contenido que hasta ahora vivía en la ruta `/expediente/[id]/laboratorios`.
 *
 * ⚠️ RECIBE EL PACIENTE POR PROP Y NO LO CONSULTA, por el mismo motivo que
 * `PanelEstado`: aquella página repetía la consulta del paciente que el
 * expediente ya hacía.
 *
 * ⚠️ SIN `HeroLabs`. Aquel encabezado repetía nombre, edad y expediente —que
 * ahora están en la cabecera del paciente, visible en las cuatro pestañas— y
 * traía dos botones cuyo `onClick` era un `console.log` de marcador. Duplicar
 * la identidad dentro de su propia pestaña es justo lo que la cabecera
 * persistente viene a evitar. Sus conteos vuelven en el rediseño de esta
 * pestaña, en su encabezado propio.
 *
 * Las dos secciones se montan tal cual: este bloque las muda de ruta a pestaña,
 * no las rediseña.
 */
export default function PanelLaboratorios({ paciente }: { paciente: Paciente }) {
  return (
    <div className="flex flex-col gap-[var(--sp-gap-band)]">
      <SeccionDocumentosLabs pacienteId={paciente.id} />
      <SeccionMedicionesLabs pacienteId={paciente.id} sexoPaciente={paciente.sexo} />
    </div>
  )
}
