'use client'

/**
 * El horario de consulta de la clínica en la pantalla de configuración (B4).
 * Se edita con el MISMO `HorarioModal` de la agenda y la MISMA ruta,
 * `PUT /api/me/horario`: no hay un segundo camino de guardado. Sólo lo edita
 * quien administra la clínica (la ruta responde 403 a los demás).
 *
 * ⚠️ «Sin horario» se pinta como `HORARIO_DEFAULT`, que es lo que la agenda
 * pinta en ese caso, y se dice; el modal recibe el valor crudo (`fuente`) para
 * no confundir un fallo de lectura con un horario (ver `FuenteHorario`).
 */
import { useState } from 'react'
import HorarioModal, { type FuenteHorario } from '@/components/agenda/HorarioModal'
import ResumenHorario from '@/components/agenda/configuracion/ResumenHorario'
import type { ActualizarConfig } from '@/components/agenda/configuracion/ConfiguracionCalendario'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { useToast } from '@/components/ui/Toast'
import type { Horario } from '@/lib/configApp'

interface Props {
  fuente: FuenteHorario
  puedeEditar: boolean
  actualizarConfig: ActualizarConfig
}

export default function SeccionHorarioClinica({ fuente, puedeEditar, actualizarConfig }: Props) {
  const [abierto, setAbierto] = useState(false)
  const toast = useToast()

  /* El modal no se cierra si falla: lo editado sólo vive en su estado. */
  async function guardar(horario: Horario): Promise<void> {
    try {
      const res = await fetch('/api/me/horario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario }),
      })
      if (!res.ok) {
        toast.error(await leerMotivoError(res, 'No se pudo guardar el horario'))
        return
      }
      actualizarConfig(c => ({ ...c, horario }))
      setAbierto(false)
      toast.success('Horario actualizado')
    } catch {
      toast.error('No se pudo guardar el horario')
    }
  }

  return (
    <section aria-labelledby="config-horario" className="rounded-2xl border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="config-horario" className="text-base font-semibold text-[var(--ag-text)]">Horario de la clínica</h2>
          <p className="text-sm text-[var(--ag-muted)]">Es el que pinta la agenda y el que usan los avisos de fuera de horario.</p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            disabled={fuente.estado !== 'listo'}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)] disabled:opacity-50"
          >
            Editar horario
          </button>
        )}
      </div>
      {fuente.estado === 'listo' ? (
        <>
          {!fuente.horario && <p className="text-sm text-[var(--ag-muted)]">La clínica aún no tiene horario; la agenda usa este.</p>}
          <ResumenHorario horario={fuente.horario ?? HORARIO_DEFAULT} />
        </>
      ) : (
        <p className="text-sm text-[var(--ag-muted)]">
          {fuente.estado === 'error' ? 'No se pudo cargar el horario. Recarga la página.' : 'Cargando el horario…'}
        </p>
      )}
      {abierto && <HorarioModal fuente={fuente} onClose={() => setAbierto(false)} onSave={guardar} />}
    </section>
  )
}
