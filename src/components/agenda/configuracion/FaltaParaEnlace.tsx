'use client'

/**
 * Lo que le falta a un médico para que su enlace de reserva abra, dicho y
 * resuelto AHÍ MISMO, en su bloque de enlaces (tanda T2, punto 8): sin días
 * abiertos, lleva a la disponibilidad; sin consultorio, al perfil. Antes no
 * lo decía nadie y el enlace abría con «Este enlace ya no está disponible».
 *
 * G2 (punto 7 de Angel): sin tipo de cita ya no se crea «Consulta, 30 min»
 * (ninguna nace con un valor fijo): se PREGUNTA la duración de la consulta de
 * ese médico (`DuracionConsulta`) y con ella se crea su tipo principal.
 *
 * Quién puede resolver qué lo deciden la RLS y las rutas de siempre: la
 * duración, el propio médico o quien administra la clínica
 * (`tipos_cita_insert`); la disponibilidad, el dueño del consultorio. A los
 * demás se les dice a quién pedírselo.
 */
import Link from 'next/link'
import DuracionConsulta from '@/components/agenda/configuracion/DuracionConsulta'
import { CAJA_AVISO } from '@/components/agenda/configuracion/clasesConfig'
import type { MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import { useToast } from '@/components/ui/Toast'

const ENLACE = 'font-medium underline underline-offset-2'

interface Props {
  motivos: readonly MotivoApertura[]
  /** El médico de la ficha. */
  medicoId: string
  /** ¿Es el médico que mira? Sólo él cambia su disponibilidad y sus consultorios. */
  esPropio: boolean
  /** Quien administra la clínica: contesta la duración de cualquier médico. */
  puedeCrearTipos: boolean
  /** Tras guardar la duración: releer tipos y enlaces. */
  alResolver: () => void
}

export default function FaltaParaEnlace({ motivos, medicoId, esPropio, puedeCrearTipos, alResolver }: Props) {
  const toast = useToast()
  const falta = (m: MotivoApertura) => motivos.includes(m)
  if (!falta('sin_tipos') && !falta('sin_disponibilidad') && !falta('sin_consultorio')) return null
  const contesta = esPropio || puedeCrearTipos

  return (
    <div role="note" aria-label="Falta para que el enlace abra" className={`${CAJA_AVISO} flex flex-col gap-[var(--ag-2)]`}>
      <p className="font-medium">Para que el enlace abra, falta:</p>
      <ul className="flex flex-col gap-[var(--ag-2)]">
        {falta('sin_consultorio') && (
          <li>Un consultorio activo.{' '}
            {esPropio ? <Link href="/perfil" className={ENLACE}>Dar de alta en Mi perfil</Link> : 'El médico lo da de alta en su perfil.'}
          </li>
        )}
        {falta('sin_disponibilidad') && (
          <li>Algún día abierto en un consultorio.{' '}
            {esPropio ? <a href="#config-disponibilidad" className={ENLACE}>Ir a la disponibilidad</a> : 'Lo abre el médico en su disponibilidad.'}
          </li>
        )}
        {falta('sin_tipos') && (
          <li className="flex flex-col gap-[var(--ag-2)]">
            <span>La duración de la consulta.</span>
            {contesta ? (
              <div className="rounded-[var(--ag-r-btn)] bg-[var(--ag-surface)] p-[var(--ag-3)] text-[var(--ag-text)]">
                <DuracionConsulta medicoId={medicoId} pregunta={esPropio ? '¿Cuánto dura tu consulta?' : '¿Cuánto dura su consulta?'}
                  onHecho={() => { toast.success('Duración de la consulta guardada'); alResolver() }} />
              </div>
            ) : <span>El médico la contesta en su configuración.</span>}
          </li>
        )}
      </ul>
    </div>
  )
}
