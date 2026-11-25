'use client'

/**
 * El diálogo «Horario en {consultorio}» de la configuración (tanda J, J5,
 * punto 14; maqueta `Configuracion.dc.html`): «Igual que la clínica» / «Otro
 * horario» y el control de días (`EditorDias`). Sin `modos`, es el editor del
 * horario de la CLÍNICA (punto 15): el mismo control, sin la elección.
 *
 * No guarda por su cuenta: `alGuardar` llama a la ruta y devuelve el motivo si
 * falla, que se queda escrito en el diálogo (y el diálogo abierto).
 *
 * B13 · AG9 (rediseño, maqueta `ag-config`): es el modal del catálogo (`ModalShell`: tarjeta de 520 centrada en
 * el área de contenido, hoja inferior arrastrable en `tel`, 310 en `ext`; foco atrapado, Esc y foco devuelto).
 * El velo no lo cierra: lleva campos (decisión del dueño). El segmentado es el del kit (`.k-seg`).
 */
import { useState } from 'react'
import ModalShell from '@/components/ui/ModalShell'
import EditorDias, { horarioGuardable } from '@/components/agenda/configuracion/EditorDias'
import SelectorHuso from '@/components/agenda/configuracion/SelectorHuso'
import { AYUDA, BOTON_AZUL, BOTON_BLANCO, ERROR } from '@/components/agenda/configuracion/estilosConfig'
import type { ModoHorario } from '@/lib/agenda/primeraVez'
import type { Horario } from '@/lib/configApp'

interface Props {
  titulo: string
  /** Con la elección «Igual que la clínica / Otro horario» (consultorio) o sin ella (clínica). */
  modos: { inicial: ModoHorario; textoClinica: string } | null
  horario: Horario
  /** Lo que se dice bajo el editor. */
  nota: string
  /** K3 (punto 12): sólo en el de la clínica, su huso de partida; con él, el diálogo lo deja cambiar. */
  huso?: string
  alGuardar: (modo: ModoHorario, horario: Horario, huso?: string) => Promise<string | null>
  alCerrar: () => void
}

function Segmento({ modo, alElegir }: { modo: ModoHorario; alElegir: (m: ModoHorario) => void }) {
  const boton = (m: ModoHorario, texto: string) => (
    <button type="button" aria-pressed={modo === m} onClick={() => alElegir(m)} className="k-seg-op flex-1 text-[15px] esc:text-[14px]">{texto}</button>
  )
  return (
    <div className="k-seg flex h-[44px] w-full ih:h-[36px] esc:h-[36px]">
      {boton('clinica', 'Igual que la clínica')}
      {boton('propio', 'Otro horario')}
    </div>
  )
}

export default function DialogoHorario({ titulo, modos, horario, nota, huso: husoInicial, alGuardar, alCerrar }: Props) {
  const [modo, setModo] = useState<ModoHorario>(modos?.inicial ?? 'propio')
  const [dias, setDias] = useState(horario)
  const [huso, setHuso] = useState(husoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sePuede = modo === 'clinica' || horarioGuardable(dias)
  async function guardar(): Promise<void> {
    setGuardando(true)
    const motivo = await alGuardar(modo, dias, huso)
    setGuardando(false)
    setError(motivo)
  }
  return (
    <ModalShell open onClose={alCerrar} title={titulo} maxWidth="max-w-[520px]" cierraConVelo={false}
      footer={(
        <div className="flex flex-wrap justify-end gap-[8px] px-[20px] py-[12px] iv:justify-center">
          <button type="button" className={BOTON_BLANCO} onClick={alCerrar}>Cancelar</button>
          <button type="button" className={BOTON_AZUL} disabled={!sePuede || guardando} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
      )}>
      {/* Sólo el cuerpo se desplaza: el título y «Guardar horario» siempre a la vista (en el teléfono, los siete días no caben). */}
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px] pt-[8px] ih:px-[24px] iv:px-[24px] esc:px-[24px]">
        {modos && <Segmento modo={modo} alElegir={setModo} />}
        {modos && modo === 'clinica' ? (
          <p className="m-0 rounded-[12px] bg-tonal p-[14px] text-[15px] leading-[21px] text-tonal-tinta esc:text-[14px] esc:leading-[20px]">
            Aquí darás consulta en el horario de la clínica: <strong>{modos.textoClinica || 'sin días de consulta'}</strong>. Si la clínica cambia su horario, el tuyo cambia también.
          </p>
        ) : <EditorDias horario={dias} alCambiar={setDias} />}
        {huso !== undefined && <SelectorHuso valor={huso} alCambiar={setHuso} />}
        <p className={`m-0 ${AYUDA}`}>{nota}</p>
        {error && <p role="alert" className={ERROR}>{error}</p>}
      </div>
    </ModalShell>
  )
}
