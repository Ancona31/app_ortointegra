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
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import { BOTON_SECUNDARIO, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
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

  const editar = puedeEditar && (
    <button type="button" onClick={() => setAbierto(true)} disabled={fuente.estado !== 'listo'} className={BOTON_SECUNDARIO}>
      Editar horario
    </button>
  )
  return (
    <TarjetaSeccion id="config-horario" titulo="Horario de la clínica" acciones={editar}
      ayuda="La plantilla: la usan la agenda y los avisos de fuera de horario en todo consultorio sin horario propio.">
      {fuente.estado === 'listo' ? (
        <>
          {!fuente.horario && <p className={TEXTO_SUAVE}>La clínica aún no tiene horario; mientras tanto se usa este.</p>}
          <ResumenHorario horario={fuente.horario ?? HORARIO_DEFAULT} />
        </>
      ) : (
        <p className={TEXTO_SUAVE}>
          {fuente.estado === 'error' ? 'No se pudo cargar el horario. Recarga la página.' : 'Cargando el horario…'}
        </p>
      )}
      {abierto && <HorarioModal fuente={fuente} onClose={() => setAbierto(false)} onSave={guardar} />}
    </TarjetaSeccion>
  )
}
