'use client'

/**
 * Paso 1 del funnel de primera vez, «¿Cuándo das consulta?» (tanda J, J5,
 * punto 13; maqueta `Main.dc.html`): una tarjeta por cada consultorio activo
 * del médico con «Igual que la clínica» u «Otro horario» y, en el segundo, los
 * días y las horas (`EditorDias`). No guarda: lo guarda «Continuar»
 * (`PrimeraVez`), que es quien tiene lo elegido.
 */
import EditorDias from '@/components/agenda/configuracion/EditorDias'
import { AYUDA, SOLO_ADMIN, SUB_PASO, TARJETA, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
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

function Opcion({ elegida, titulo, sub, alElegir }: { elegida: boolean; titulo: string; sub: string; alElegir: () => void }) {
  return (
    <button type="button" aria-pressed={elegida} onClick={alElegir}
      className={`flex min-h-[56px] w-full cursor-pointer items-center gap-[14px] rounded-[12px] border-2 px-[16px] py-[12px] text-left ${elegida
        ? 'border-[var(--ag-brand-secondary)] bg-[var(--ag-primary-bg-faint)]' : 'border-[var(--ag-border-card)] bg-[var(--ag-surface)]'}`}>
      <span aria-hidden="true" className={`h-[20px] w-[20px] flex-none rounded-full bg-[var(--ag-surface)] ${elegida
        ? 'border-[6px] border-[var(--ag-brand-secondary)]' : 'border-2 border-[var(--ag-muted2)]'}`} />
      <span className="flex flex-col gap-[2px]">
        <span className="text-[15px] font-semibold text-[var(--ag-ink)]">{titulo}</span>
        <span className="text-[13.5px] text-[var(--ag-ink-600)]">{sub}</span>
      </span>
    </button>
  )
}

function TarjetaConsultorio({ nombre, eleccion, textoClinica, alCambiar }: { nombre: string; eleccion: EleccionHorario; textoClinica: string; alCambiar: (e: EleccionHorario) => void }) {
  return (
    <div className={`${TARJETA} gap-[14px]`} aria-label={nombre} role="group">
      <h2 className="m-0 text-[16px] font-bold text-[var(--ag-ink)]">{nombre}</h2>
      <div className="flex flex-col gap-[8px]">
        <Opcion elegida={eleccion.modo === 'clinica'} titulo="Igual que la clínica" sub={textoClinica || 'La clínica no tiene días de consulta'}
          alElegir={() => alCambiar({ ...eleccion, modo: 'clinica' })} />
        <Opcion elegida={eleccion.modo === 'propio'} titulo="Otro horario" sub="Tú eliges qué días vienes y a qué hora"
          alElegir={() => alCambiar({ ...eleccion, modo: 'propio' })} />
      </div>
      {eleccion.modo === 'propio' && (
        <EditorDias horario={eleccion.propio} conInstruccion alCambiar={propio => alCambiar({ ...eleccion, propio })} />
      )}
    </div>
  )
}

export default function PasoHorario({ consultorios, elecciones, horarioClinica, puedeAdministrar, alCambiar }: Props) {
  const textoClinica = textoHorario(horarioClinica)
  return (
    <section className="flex flex-col gap-[20px]" aria-labelledby="primera-vez-titulo">
      <div className="flex flex-col gap-[8px]">
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>¿Cuándo das consulta?</h1>
        <p className={SUB_PASO}>Tus pacientes solo podrán pedir cita en estos días y horas.</p>
      </div>
      {consultorios.map(c => {
        const e = elecciones[c.id]
        return e ? <TarjetaConsultorio key={c.id} nombre={c.nombre} eleccion={e} textoClinica={textoClinica} alCambiar={x => alCambiar(c.id, x)} /> : null
      })}
      {!puedeAdministrar && (
        <p className={`m-0 ${AYUDA}`}>
          El horario de la clínica es {textoClinica || 'sin días de consulta'}.{' '}
          <span data-solo-admin>{SOLO_ADMIN}</span>
        </p>
      )}
    </section>
  )
}
