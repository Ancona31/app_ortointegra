'use client'

/**
 * La duración distinta SÓLO en un consultorio (G2, punto 7 de Angel): «en el
 * horario de cada consultorio hay una opción discreta para poner una duración
 * distinta solo ahí; si no se usa, no estorba». Es un botón de fila dentro de
 * la disponibilidad del consultorio, sólo para su dueño y sólo si ya tiene su
 * duración general (el paso 2 de «Primeros pasos»).
 *
 * Por dentro es otro tipo principal del médico con `consultorio_id` (migración
 * 20261119120000): allí sustituye al general en el enlace, en el selector del
 * modal y en el ajuste al turno (`tiposDelConsultorio`). Crearlo lo puede el
 * médico (`tipos_cita_insert`) y, desde G2b, también cambiarlo o quitarlo
 * (un UPDATE: `tipos_cita_update` de 20261119121000 deja al médico los suyos).
 * Tanda L (puntos 12 y 17): botones chicos de 44 px de la configuración nueva, con borde y fondo (tanda H, punto 7).
 */
import { useState } from 'react'
import DuracionConsulta from '@/components/agenda/configuracion/DuracionConsulta'
import { BOTON_CHICO } from '@/components/agenda/configuracion/estilosConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { useToast } from '@/components/ui/Toast'

interface Props {
  consultorioId: string
  consultorioNombre: string
  medicoId: string
  tipos: readonly TipoCita[] | null
  alCambiar: () => void
}

async function quitar(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/agenda/tipos-cita/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: false }),
    })
    return res.ok ? null : await leerMotivoError(res, 'No se pudo quitar la duración')
  } catch {
    return 'No se pudo quitar la duración'
  }
}

export default function DuracionEnConsultorio(p: Props) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const principales = (p.tipos ?? []).filter(t => t.activo && t.principal && t.medico_id === p.medicoId)
  const general = principales.find(t => !t.consultorio_id)
  const aqui = principales.find(t => t.consultorio_id === p.consultorioId)
  if (!general && !aqui) return null
  const hecho = (texto: string) => { toast.success(texto); setAbierto(false); p.alCambiar() }

  if (abierto) {
    return (
      <div className="rounded-[10px] border border-[var(--ag-border-card)] p-[12px]">
        <DuracionConsulta medicoId={p.medicoId} consultorioId={aqui ? null : p.consultorioId} editarId={aqui?.id}
          pregunta={`¿Cuánto dura la consulta en ${p.consultorioNombre}?`} actual={aqui?.duracion_min ?? general?.duracion_min}
          onHecho={() => hecho('Duración del consultorio guardada')} onCancelar={() => setAbierto(false)} />
      </div>
    )
  }
  if (!aqui) {
    return (
      <button type="button" className={`${BOTON_CHICO} w-fit`} onClick={() => setAbierto(true)}>
        Otra duración en este consultorio
      </button>
    )
  }
  async function alQuitar(id: string): Promise<void> {
    const motivo = await quitar(id)
    if (motivo) toast.error(motivo)
    else hecho('Ahora usa tu duración general')
  }
  return (
    <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px]">
      <span className="text-[14px] text-[var(--ag-text)]">
        Aquí la consulta dura <strong className="tabular-nums">{aqui.duracion_min} min</strong>
        {general ? <span className="text-[var(--ag-muted)]"> (en los demás, {general.duracion_min} min)</span> : null}
      </span>
      <span className="flex gap-[8px]">
        <button type="button" className={BOTON_CHICO} onClick={() => setAbierto(true)}>Cambiar</button>
        <button type="button" className={BOTON_CHICO} onClick={() => void alQuitar(aqui.id)}>Usar la general</button>
      </span>
    </div>
  )
}
