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
import DuracionEnConsultorio from '@/components/agenda/configuracion/DuracionEnConsultorio'
import type { ActualizarConfig } from '@/components/agenda/configuracion/ConfiguracionCalendario'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import { DIAS, HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { INICIALES_DIAS, lineaHorario } from '@/lib/agenda/lineaHorario'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { useToast } from '@/components/ui/Toast'
import { BOTON_SECUNDARIO } from '@/components/agenda/configuracion/clasesConfig'
import type { Horario } from '@/lib/configApp'
import type { Consultorio } from '@/types'

interface Props {
  consultorio: Consultorio
  horarioClinica: Horario | null
  esDueno: boolean
  /** El médico dueño, para quien ve consultorios ajenos (la secretaria). */
  nombreMedico: string | null
  actualizarConfig: ActualizarConfig
  alCambiar?: () => void
  /** G2: para la duración distinta en este consultorio (sólo el dueño la ve). */
  tipos?: readonly TipoCita[] | null
  puedeAdministrar?: boolean
  /** Tras crear o cambiar la duración: releer los tipos. */
  alCambiarTipos?: () => void
}

type Cambios = { horario_propio: boolean; horario?: Horario }

const BOTON = BOTON_SECUNDARIO

/** Los siete días como iniciales, apagadas las cerradas (G2, la maqueta). Decorativo: la línea lo dice. */
function DiasSemana({ horario }: { horario: Horario }) {
  return (
    <span aria-hidden="true" className="flex gap-[var(--ag-1)]">
      {DIAS.map((d, i) => (
        <i key={d.key} className={`grid h-6 w-6 place-items-center rounded-[var(--ag-r-btn-sm)] text-[11px] font-bold not-italic ${horario[d.key].activo
          ? 'bg-[var(--ag-primary-bg-faint)] text-[var(--ag-brand-legible)]' : 'bg-[var(--ag-bg-app)] text-[var(--ag-muted)]'}`}>
          {INICIALES_DIAS[i]}
        </i>
      ))}
    </span>
  )
}

/** El nombre, de quién y de dónde sale el horario, y (G2, punto 5) una línea con
 *  los días y horas y sus iniciales, como la maqueta; antes, siete renglones
 *  sólo con horario propio. */
function Cabecera({ nombre, detalle, horario }: { nombre: string; detalle: string; horario: Horario }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-[var(--ag-3)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--ag-text)]">{nombre}</p>
        <p className="text-sm text-[var(--ag-muted)]">{detalle}</p>
        <p className="text-sm text-[var(--ag-text)] tabular-nums">{lineaHorario(horario)}</p>
      </div>
      <DiasSemana horario={horario} />
    </div>
  )
}

export default function FilaDisponibilidad(props: Props) {
  const { consultorio, horarioClinica, esDueno, nombreMedico, actualizarConfig, alCambiar } = props
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
      alCambiar?.()
    } catch {
      toast.error('No se pudo guardar la disponibilidad')
    } finally {
      setGuardando(false)
    }
  }

  const efectivo = horarioEfectivo(consultorio, horarioClinica)
  return (
    <li className="flex flex-col gap-[var(--ag-3)] py-[var(--ag-4)] first:pt-0 last:pb-0" aria-label={consultorio.nombre}>
      <Cabecera nombre={consultorio.nombre} detalle={`${nombreMedico && !esDueno ? `${nombreMedico} · ` : ''}${propio ? 'Horario propio' : 'Usa el horario de la clínica'}`}
        horario={efectivo} />
      {esDueno && (
        <div className="flex flex-wrap gap-[var(--ag-2)]">
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
      {esDueno && props.alCambiarTipos && (
        <DuracionEnConsultorio consultorioId={consultorio.id} consultorioNombre={consultorio.nombre} medicoId={consultorio.medico_id}
          tipos={props.tipos ?? null} puedeAdministrar={props.puedeAdministrar === true} alCambiar={props.alCambiarTipos} />
      )}
      {modal && (
        <HorarioModal fuente={{ estado: 'listo', horario: base }} onClose={() => setModal(false)}
          onSave={h => enviar({ horario_propio: true, horario: h }, 'Disponibilidad guardada')} />
      )}
    </li>
  )
}
