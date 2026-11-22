'use client'

import type { ReactElement } from 'react'
import Link from 'next/link'
import { Plus, CalendarPlus, UserPlus } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useClinica } from '@/hooks/useClinica'
import BuscadorPaciente from '@/components/dashboard/BuscadorPaciente'
import ProximasCitas from '@/components/dashboard/ProximasCitas'
import TarjetaHoy from '@/components/dashboard/TarjetaHoy'
import UltimosPacientes from '@/components/dashboard/UltimosPacientes'
import HoyEnConsultorio from '@/components/dashboard/HoyEnConsultorio'
import Identidad from './Identidad'

/* Retícula de la secretaria (rediseño B5, maqueta `dashboard-final`): una
   columna en ext/tel/ih/iv con el orden de la maqueta; en esc, conteos y
   próximas citas a la izquierda, acciones y últimos pacientes a la derecha. */
const RETICULA = 'grid grid-cols-1 items-start gap-4 esc:grid-cols-[minmax(0,1fr)_minmax(300px,384px)] esc:gap-5'
const HUECO = {
  acciones: 'order-1 esc:col-start-2 esc:row-start-1',
  conteos: 'order-2 esc:col-start-1 esc:row-start-1',
  lista: 'order-3 esc:col-start-1 esc:row-start-2 esc:row-span-2',
  ultimos: 'order-4 esc:col-start-2 esc:row-start-2',
} as const

/**
 * El inicio del rol asistente médico/a.
 *
 * Mismas piezas que la del médico con el ALCANCE RECORTADO DEL ROL.
 *
 * ⚠️ NADA CLÍNICO ES ALCANZABLE DESDE AQUÍ, Y ES UNA FRONTERA, NO UN DESCUIDO.
 * No hay expediente, ni notas, ni documentos, ni «iniciar consulta»; el renglón
 * de una cita no enseña diagnóstico ni motivo, y la única acción sobre un
 * paciente es «Agendar». `ProximasCitas` con `medicoId={null}` no recibe
 * acciones: cada fila es «Ver cita» (a la agenda), y ese componente no conoce
 * ninguna url clínica, así que la garantía es estructural.
 */
export default function AsistenteDashboard(): ReactElement {
  const { profile } = useProfile()
  const { clinica, nombreDisplay } = useClinica()
  const primerNombre = profile?.nombres ? profile.nombres.split(' ')[0] : ''

  /* ⚠️ EL RESPALDO ES `clinicas.nombre`, NO EL NOMBRE DEL USUARIO: para una
     secretaria un nombre de médico da cadena vacía. Se prefiere el de marca
     (`nombre_display`) y si no el legal; si tampoco hay, la ceja no se pinta.
     El dato es de SÓLO LECTURA para este rol. */
  const nombreClinica = nombreDisplay ?? clinica?.nombre ?? ''

  const abrirBusqueda = (): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  }

  return (
    <div className="mx-auto flex max-w-[1044px] flex-col gap-5 pb-6 pt-2 esc:gap-6">
      <header className="flex flex-col gap-4 esc:flex-row esc:flex-wrap esc:items-end esc:justify-between esc:gap-x-8 esc:gap-y-4">
        <Identidad ceja={nombreClinica} nombre={primerNombre} />
        {/* Sin médico: el conteo es de la clínica entera. */}
        <TarjetaHoy medicoId={null} />
      </header>

      <div className={RETICULA}>
        {/* DOS botones: el rol no crea documentos ni consultas. El primario es
            «Agendar cita», la acción más frecuente del puesto. */}
        <div className={`${HUECO.acciones} flex flex-col gap-3`}>
          <BuscadorPaciente onAbrir={abrirBusqueda} />
          <div className="order-2 grid grid-cols-2 gap-2">
            <Link href="/agenda" prefetch={false} className="k-b k-b-prim h-11 min-w-0 px-3 ih:h-10 esc:h-10">
              <CalendarPlus aria-hidden="true" className="size-[18px]" /> Agendar cita
            </Link>
            {/* `data-onboard` NO va aquí: vive en el botón del dashboard del
                médico y `OnboardingGuide` resuelve por el primer nodo. */}
            <Link href="/pacientes/nuevo" prefetch={false} aria-label="Nuevo paciente"
              className="k-b h-11 min-w-0 bg-sup px-3 text-tonal-tinta ih:h-10 esc:h-10">
              <span className="contents ext:hidden"><UserPlus aria-hidden="true" className="size-[18px] ih:hidden iv:hidden" />Nuevo paciente</span>
              <span className="hidden items-center gap-1 ext:inline-flex"><Plus aria-hidden="true" className="size-4" />Paciente</span>
            </Link>
          </div>
        </div>
        <div className={HUECO.conteos}><HoyEnConsultorio /></div>
        {/* ⚠️ `medicoId={null}` = TODAS LAS CITAS DE LA CLÍNICA, y con ello el
            renglón enseña de quién es cada una. La secretaria no tiene citas
            propias. Cada fila navega a la agenda SIN parámetros: el detalle por
            url se descartó porque el modal espera la fila entera. */}
        <ProximasCitas medicoId={null} claseLista={HUECO.lista} />
        <div className={HUECO.ultimos}><UltimosPacientes /></div>
      </div>
    </div>
  )
}
