'use client'

/**
 * Lo que le falta a un médico para que su enlace de reserva abra, dicho y
 * resuelto AHÍ MISMO, en su bloque de enlaces (tanda T2, punto 8): sin tipo
 * de cita, un clic crea «Consulta, 30 min» para toda la clínica; sin días
 * abiertos, lleva a la disponibilidad; sin consultorio, al perfil. Antes no
 * lo decía nadie y el enlace abría con «Este enlace ya no está disponible».
 *
 * Quién puede resolver qué lo deciden la RLS y las rutas de siempre: los
 * tipos, quien administra la clínica (`tipos_cita_insert`); la
 * disponibilidad, el dueño del consultorio. A los demás se les dice a quién
 * pedírselo. El tipo por defecto pasa por `POST /api/agenda/tipos-cita`, con
 * el mismo esquema que el formulario (`CrearTipoCitaSchema`).
 */
import Link from 'next/link'
import { useState } from 'react'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { BOTON_SECUNDARIO, CAJA_AVISO } from '@/components/agenda/configuracion/clasesConfig'
import { CrearTipoCitaSchema } from '@/lib/agenda/tiposCita'
import type { MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import { useToast } from '@/components/ui/Toast'

/** El tipo que se ofrece por defecto (punto 8 de Angel). */
export const TIPO_POR_DEFECTO = { nombre: 'Consulta', duracion_min: 30, color: null, medico_id: null } as const

const ENLACE = 'font-medium underline underline-offset-2'

interface Props {
  motivos: readonly MotivoApertura[]
  /** ¿Es el médico que mira? Sólo él cambia su disponibilidad y sus consultorios. */
  esPropio: boolean
  puedeCrearTipos: boolean
  /** Tras crear el tipo: releer tipos y enlaces. */
  alResolver: () => void
}

async function crearTipoPorDefecto(): Promise<string | null> {
  const cuerpo = CrearTipoCitaSchema.parse(TIPO_POR_DEFECTO)
  try {
    const res = await fetch('/api/agenda/tipos-cita', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    })
    return res.ok ? null : await leerMotivoError(res, 'No se pudo crear el tipo de cita')
  } catch {
    return 'No se pudo crear el tipo de cita'
  }
}

export default function FaltaParaEnlace({ motivos, esPropio, puedeCrearTipos, alResolver }: Props) {
  const toast = useToast()
  const [creando, setCreando] = useState(false)
  const falta = (m: MotivoApertura) => motivos.includes(m)
  if (!falta('sin_tipos') && !falta('sin_disponibilidad') && !falta('sin_consultorio')) return null

  async function crear(): Promise<void> {
    setCreando(true)
    const motivo = await crearTipoPorDefecto()
    setCreando(false)
    if (motivo) { toast.error(motivo); return }
    toast.success('Tipo de cita «Consulta» creado')
    alResolver()
  }

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
          <li className="flex flex-wrap items-center gap-[var(--ag-2)]">
            <span>Un tipo de cita.</span>
            {puedeCrearTipos ? (
              <button type="button" className={`${BOTON_SECUNDARIO} bg-[var(--ag-surface)]`} disabled={creando} onClick={() => void crear()}>
                {creando ? 'Creando…' : 'Crear «Consulta», 30 min'}
              </button>
            ) : <span>Pídele a quien administra la clínica que cree uno.</span>}
          </li>
        )}
      </ul>
    </div>
  )
}
