'use client'

/**
 * El diálogo «Horario en {consultorio}» de la configuración (tanda J, J5,
 * punto 14; maqueta `Configuracion.dc.html`): «Igual que la clínica» / «Otro
 * horario» y el control de días (`EditorDias`). Sin `modos`, es el editor del
 * horario de la CLÍNICA (punto 15): el mismo control, sin la elección.
 *
 * No guarda por su cuenta: `alGuardar` llama a la ruta y devuelve el motivo si
 * falla, que se queda escrito en el diálogo (y el diálogo abierto).
 * Accesibilidad: `useDialogoModal` (foco atrapado, Escape, foco devuelto).
 */
import { useId, useState } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import EditorDias, { horarioGuardable } from '@/components/agenda/configuracion/EditorDias'
import SelectorHuso from '@/components/agenda/configuracion/SelectorHuso'
import { BOTON_AZUL, BOTON_BLANCO, ERROR } from '@/components/agenda/configuracion/estilosConfig'
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
    <button type="button" aria-pressed={modo === m} onClick={() => alElegir(m)}
      className={`min-h-[44px] sm:min-h-[40px] cursor-pointer rounded-[9px] border-0 text-[15px] sm:text-[13px] font-semibold ${modo === m
        ? 'bg-[var(--ag-surface)] text-[var(--ag-brand-legible)] shadow-[0_1px_3px_rgba(15,23,42,0.15)]' : 'bg-transparent text-[var(--ag-ink-600)]'}`}>{texto}</button>
  )
  return (
    <div className="grid grid-cols-2 gap-[4px] rounded-[12px] bg-[var(--ag-segment-bg)] p-[4px]">
      {boton('clinica', 'Igual que la clínica')}
      {boton('propio', 'Otro horario')}
    </div>
  )
}

export default function DialogoHorario({ titulo, modos, horario, nota, huso: husoInicial, alGuardar, alCerrar }: Props) {
  const id = useId()
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
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
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-[16px] sm:p-[20px]">
        <div className="ag-modal-velo absolute inset-0 bg-[var(--ag-modal-overlay)]" onClick={alCerrar} />
        <div ref={montarPanel} onKeyDown={alPulsarTecla} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} tabIndex={-1}
          className="ag-modal-panel relative flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-[20px] bg-[var(--ag-modal-bg)] shadow-[var(--ag-shadow-pop)] focus:outline-none">
          <div className="flex items-center justify-between gap-[12px] border-b border-[var(--ag-hairline)] px-[20px] py-[16px] sm:px-[24px] sm:py-[16px]">
            <h2 id={`${id}-t`} className="m-0 text-[16px] font-bold text-[var(--ag-ink)]">{titulo}</h2>
            <button type="button" onClick={alCerrar} aria-label="Cerrar"
              className="inline-flex h-[44px] w-[44px] sm:h-[40px] sm:w-[40px] cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent text-[var(--ag-ink-600)]">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          {/* Sólo el cuerpo se desplaza: el título y «Guardar horario» siempre a la vista (en el teléfono, los siete días no caben). */}
          <div className="flex min-h-0 flex-1 flex-col gap-[16px] sm:gap-[14px] overflow-y-auto px-[20px] py-[22px] sm:py-[18px] sm:px-[24px]">
            {modos && <Segmento modo={modo} alElegir={setModo} />}
            {modos && modo === 'clinica' ? (
              <p className="m-0 rounded-[12px] bg-[var(--ag-primary-bg-faint)] p-[16px] sm:p-[14px] text-[14px] leading-[1.5] text-[var(--ag-ink)]">
                Aquí darás consulta en el horario de la clínica: <strong>{modos.textoClinica || 'sin días de consulta'}</strong>. Si la clínica cambia su horario, el tuyo cambia también.
              </p>
            ) : <EditorDias horario={dias} alCambiar={setDias} />}
            {huso !== undefined && <SelectorHuso valor={huso} alCambiar={setHuso} />}
            <p className="m-0 text-[13.5px] sm:text-[13px] leading-[1.5] text-[var(--ag-ink-600)]">{nota}</p>
            {error && <p role="alert" className={ERROR}>{error}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-[10px] border-t border-[var(--ag-hairline)] px-[20px] py-[16px] sm:py-[14px] sm:px-[24px]">
            <button type="button" className={BOTON_BLANCO} onClick={alCerrar}>Cancelar</button>
            <button type="button" className={BOTON_AZUL} disabled={!sePuede || guardando} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar horario'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
