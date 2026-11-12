'use client'

/**
 * La disponibilidad de UN consultorio (P6, paso B5): el horario de la clínica
 * o uno propio, con `PATCH /api/consultorios/[id]` (`horario_propio` y
 * `horario`). Sólo la cambia el dueño del consultorio —la RLS de UPDATE es
 * sólo suya—; los demás (la secretaria) la ven en solo lectura.
 *
 * El horario propio se edita con el mismo `HorarioModal` que el de la clínica.
 * Al pasar a horario propio se parte del que el consultorio ya tenía si tiene
 * algún día abierto, y si no del de la clínica: un consultorio nace con los
 * siete días cerrados, y empezar ahí obligaría a abrirlos uno a uno.
 *
 * Lo que se pinta es `horarioEfectivo`, el mismo que usará el cálculo de
 * turnos: un día mal formado sale «Cerrado» aquí igual que allí.
 */
import { useState } from 'react'
import HorarioModal from '@/components/agenda/HorarioModal'
import ResumenHorario from '@/components/agenda/configuracion/ResumenHorario'
import type { ActualizarConfig } from '@/components/agenda/configuracion/ConfiguracionCalendario'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import { DIAS, HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { useToast } from '@/components/ui/Toast'
import type { Horario } from '@/lib/configApp'
import type { Consultorio } from '@/types'

interface Props {
  consultorio: Consultorio
  horarioClinica: Horario | null
  esDueno: boolean
  /** El médico dueño, para quien ve consultorios ajenos (la secretaria). */
  nombreMedico: string | null
  actualizarConfig: ActualizarConfig
}

type Cambios = { horario_propio: boolean; horario?: Horario }

const BOTON = 'px-3 py-2 rounded-xl text-sm font-medium border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)] disabled:opacity-50'

export default function FilaDisponibilidad({ consultorio, horarioClinica, esDueno, nombreMedico, actualizarConfig }: Props) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()
  const propio = consultorio.horario_propio === true
  const tieneDiaAbierto = DIAS.some(d => consultorio.horario?.[d.key]?.activo)
  const base: Horario = propio || tieneDiaAbierto ? consultorio.horario : horarioClinica ?? HORARIO_DEFAULT

  async function enviar(cambios: Cambios, hecho: string): Promise<void> {
    setGuardando(true)
    try {
      const res = await fetch(`/api/consultorios/${consultorio.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      })
      if (!res.ok) { toast.error(await leerMotivoError(res, 'No se pudo guardar la disponibilidad')); return }
      actualizarConfig(c => ({ ...c, consultorios: c.consultorios.map(x => (x.id === consultorio.id ? { ...x, ...cambios } : x)) }))
      setModal(false)
      toast.success(hecho)
    } catch {
      toast.error('No se pudo guardar la disponibilidad')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <li className="py-3 space-y-3" aria-label={consultorio.nombre}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ag-text)]">{consultorio.nombre}</p>
          <p className="text-sm text-[var(--ag-muted)]">
            {nombreMedico && !esDueno ? `${nombreMedico} · ` : ''}{propio ? 'Horario propio' : 'Usa el horario de la clínica'}
          </p>
        </div>
        {esDueno && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BOTON} disabled={guardando} onClick={() => setModal(true)}>
              {propio ? 'Editar horario propio' : 'Usar horario propio'}
            </button>
            {propio && (
              <button type="button" className={BOTON} disabled={guardando}
                onClick={() => void enviar({ horario_propio: false }, 'Ahora usa el horario de la clínica')}>
                Usar el de la clínica
              </button>
            )}
          </div>
        )}
      </div>
      <ResumenHorario horario={horarioEfectivo(consultorio, horarioClinica)} />
      {modal && (
        <HorarioModal fuente={{ estado: 'listo', horario: base }} onClose={() => setModal(false)}
          onSave={h => enviar({ horario_propio: true, horario: h }, 'Disponibilidad guardada')} />
      )}
    </li>
  )
}
