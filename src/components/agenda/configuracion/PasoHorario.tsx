'use client'

/**
 * Paso 1 del funnel de primera vez, «¿Cuándo das consulta?» (tanda J, J5,
 * punto 13; maqueta `Main.dc.html`): una tarjeta por cada consultorio activo
 * del médico con «Igual que la clínica» u «Otro horario» y, en el segundo, los
 * días y las horas (`EditorDias`). No guarda: lo guarda «Continuar»
 * (`PrimeraVez`), que es quien tiene lo elegido.
 */
import { Building2 } from 'lucide-react'
import EditorDias from '@/components/agenda/configuracion/EditorDias'
import { AVISO_SOLO_ADMIN, AYUDA, BLOQUE, CABECERA_PASO, ROTULO, SECCION_PASO, SOLO_ADMIN, SUB_PASO, SUPERFICIE, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
import { textoHorario } from '@/lib/agenda/gruposHorario'
import type { ModoHorario } from '@/lib/agenda/primeraVez'
import type { Horario } from '@/lib/configApp'

export interface EleccionHorario { modo: ModoHorario; propio: Horario }

interface Props {
  consultorios: readonly { id: string; nombre: string }[]
  elecciones: Readonly<Record<string, EleccionHorario>>
  horarioClinica: Horario
  /** Tanda L (punto 16): quien no administra ve de qué horario parte «Igual que la clínica» y que no lo cambia él. */
  puedeAdministrar: boolean
  alCambiar: (id: string, e: EleccionHorario) => void
}

/** Una opción de radio en fila (maqueta `ag-pv`, paso 2): círculo de 22, título 15/600 y su línea 13. */
function Opcion({ elegida, titulo, sub, alElegir }: { elegida: boolean; titulo: string; sub: string; alElegir: () => void }) {
  return (
    <button type="button" aria-pressed={elegida} onClick={alElegir}
      className="flex min-h-[62px] w-full cursor-pointer items-center gap-[14px] border-0 border-t border-linea bg-transparent py-[10px] text-left first:border-t-0 ih:min-h-[56px] esc:min-h-[56px]">
      <span aria-hidden="true" className={`h-[22px] w-[22px] flex-none rounded-full bg-sup transition-[border-width] duration-[var(--dur-toque)] motion-reduce:transition-none ${elegida
        ? 'border-[7px] border-accion' : 'border-2 border-tinta3'}`} />
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="text-[15px] font-semibold leading-[20px] text-tinta">{titulo}</span>
        <span className="text-[13px] leading-[18px] tabular-nums text-tinta2">{sub}</span>
      </span>
    </button>
  )
}

function TarjetaConsultorio({ nombre, eleccion, textoClinica, alCambiar }: { nombre: string; eleccion: EleccionHorario; textoClinica: string; alCambiar: (e: EleccionHorario) => void }) {
  return (
    <div className={BLOQUE} aria-label={nombre} role="group">
      <h2 className={ROTULO}><Building2 size={16} strokeWidth={2} aria-hidden="true" className="flex-none" />{nombre}</h2>
      <div className={SUPERFICIE}>
        <div className="flex flex-col">
          <Opcion elegida={eleccion.modo === 'clinica'} titulo="Igual que la clínica" sub={textoClinica || 'La clínica no tiene días de consulta'}
            alElegir={() => alCambiar({ ...eleccion, modo: 'clinica' })} />
          <Opcion elegida={eleccion.modo === 'propio'} titulo="Otro horario" sub="Tú eliges qué días vienes y a qué hora"
            alElegir={() => alCambiar({ ...eleccion, modo: 'propio' })} />
        </div>
        {eleccion.modo === 'propio' && (
          <div className="border-t border-linea pb-[4px] pt-[10px]">
            <EditorDias horario={eleccion.propio} conInstruccion alCambiar={propio => alCambiar({ ...eleccion, propio })} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function PasoHorario({ consultorios, elecciones, horarioClinica, puedeAdministrar, alCambiar }: Props) {
  const textoClinica = textoHorario(horarioClinica)
  return (
    <section className={SECCION_PASO} aria-labelledby="primera-vez-titulo">
      <div className={CABECERA_PASO}>
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>¿Cuándo das consulta?</h1>
        <p className={SUB_PASO}>Tus pacientes solo podrán pedir cita en estos días y horas.</p>
      </div>
      {consultorios.map(c => {
        const e = elecciones[c.id]
        return e ? <TarjetaConsultorio key={c.id} nombre={c.nombre} eleccion={e} textoClinica={textoClinica} alCambiar={x => alCambiar(c.id, x)} /> : null
      })}
      {!puedeAdministrar && (
        <div className="flex flex-col gap-[10px]">
          <p className={`m-0 px-[4px] ${AYUDA}`}>El horario de la clínica es {textoClinica || 'sin días de consulta'}.</p>
          {/* Tanda M (punto 15): el aviso, en su caja, bajo el horario de la clínica que no puede cambiar. */}
          <p data-solo-admin className={AVISO_SOLO_ADMIN}>{SOLO_ADMIN}</p>
        </div>
      )}
    </section>
  )
}
