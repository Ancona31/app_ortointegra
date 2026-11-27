'use client'

/**
 * src/components/agenda/ConfirmModal.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.3, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 *
 * B13 · AG5 (CALMA §29.3–§29.4) · Con `verbo`, la ALERTA DEL CATÁLOGO
 * (`.k-capa`/`.k-al` de `sistema.css`, la de `ModalShell variante="alerta"`):
 * icono en círculo de 48, la PREGUNTA como título y el resto como mensaje (el
 * texto es el mismo de siempre, partido por `partirPregunta`), y dos botones
 * parejos: el secundario («Volver» si la acción cancela algo, «Cancelar» en el
 * resto) y el principal con su VERBO («Cancelar cita», «Mover», «Guardar»…).
 * Lo pasan sólo los caminos de la agenda v2 (`guardadoCitas.ts`, `altaCitas.ts`,
 * `InteraccionesV2.tsx`); sin `verbo` es el de antes, letra por letra («Cancelar» /
 * «Aceptar»), que es lo que ve la agenda con la v2 apagada y la configuración.
 * El nombre del diálogo sigue siendo el texto entero (título + mensaje): las
 * pruebas y el lector lo encuentran igual que antes. Sin salida animada
 * (decisión 17) y sin `ModalShell`: conserva `useDialogoModal` y el `z-[60]`.
 */

import { useId, type ReactElement } from 'react'
import { AlertTriangle, Trash2, UserX, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'

/** El icono del círculo: lo que la acción hace. Rojo los dos primeros, ámbar los otros. */
export type IconoConfirmacion = 'cancelar' | 'eliminar' | 'no-asistio' | 'aviso'

export interface PropsConfirmacion {
  message: string
  onConfirm: () => void
  onCancel: () => void
  /** B13 · AG5: el botón principal con verbo; activa la alerta del catálogo. */
  verbo?: string
  /** B13 · AG5: «Volver» cuando la acción cancela algo; por omisión, «Cancelar». */
  secundario?: string
  icono?: IconoConfirmacion
  /** Botones uno sobre otro (`.k-al-pila` del catálogo, el principal arriba): para un verbo que no cabe al
      lado de «Volver» en la alerta de 310/320 («Dejar como evento», corrección 8). Sólo con `verbo`. */
  apilada?: boolean
}

/**
 * La pregunta (`¿…?`) como título y el resto como mensaje. Sin pregunta, el
 * texto entero es el título. Tanto si la pregunta va delante («¿Cancelar la cita
 * de…? El horario…») como detrás («Vas a agendar… ¿Es correcto?»).
 */
export function partirPregunta(texto: string): { titulo: string; resto: string } {
  const m = /¿[^¿?]*\?/.exec(texto)
  if (!m) return { titulo: texto.trim(), resto: '' }
  const resto = (texto.slice(0, m.index) + texto.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  return { titulo: m[0], resto }
}

function IconoAlerta({ icono }: { icono: IconoConfirmacion }): ReactElement {
  if (icono === 'cancelar') return <X aria-hidden="true" />
  if (icono === 'eliminar') return <Trash2 aria-hidden="true" />
  if (icono === 'no-asistio') return <UserX aria-hidden="true" />
  return <AlertTriangle aria-hidden="true" />
}

/** La alerta del catálogo (v2). */
function AlertaCatalogo({ message, onConfirm, onCancel, verbo, secundario = 'Cancelar', icono = 'aviso', apilada = false }: PropsConfirmacion & { verbo: string }): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(onCancel)
  const tituloId = useId()
  const mensajeId = useId()
  const { titulo, resto } = partirPregunta(message)
  const destruye = icono === 'cancelar' || icono === 'eliminar'
  return (
    <Portal>
      <div className="k-capa ag-confirmacion fixed inset-0 z-[60]" data-variante="alerta" data-fase="abierta">
        <div className="k-velo ag-modal-velo" onClick={onCancel} />
        <div ref={montarPanel} onKeyDown={alPulsarTecla} role="dialog" aria-modal="true"
          aria-labelledby={resto ? `${tituloId} ${mensajeId}` : tituloId} tabIndex={-1} className="k-capa-panel">
          <div className="k-al">
            <span className={`k-al-i ${destruye ? 'k-al-i-destruir' : 'k-al-i-avisar'}`} aria-hidden="true"><IconoAlerta icono={icono} /></span>
            <h2 id={tituloId} className="k-al-tit">{titulo}</h2>
            {resto && <p id={mensajeId} className="k-al-t">{resto}</p>}
            <div className={apilada ? 'k-al-b k-al-pila' : 'k-al-b'}>
              <button type="button" autoFocus onClick={onCancel} className="k-b k-b-capa k-b-quieto">{secundario}</button>
              <button type="button" data-principal onClick={onConfirm} className={`k-b k-b-capa ${destruye ? 'k-b-mal' : 'k-b-prim'}`}>{verbo}</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/* ─── Modal de confirmación genérico ───────────────────── */

export default function ConfirmModal(props: PropsConfirmacion) {
  if (props.verbo) return <AlertaCatalogo {...props} verbo={props.verbo} />
  return <ConfirmacionClasica {...props} />
}

function ConfirmacionClasica({ message, onConfirm, onCancel }: PropsConfirmacion) {
  const { montarPanel, alPulsarTecla } = useDialogoModal(onCancel)
  const mensajeId = useId()
  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Bloque F (F2.7): `ag-modal-velo` y `ag-modal-panel` y no
          `animate-modal-enter`, que es de toda la app (220 ms, `scale(.94)`,
          curva propia): fuera de la escala de la agenda. Entrada con fundido y
          6 px; SIN salida animada (decisión 17: sólo el modal de la cita la
          tiene). Las dos clases ya están en el bloque de movimiento reducido. */}
      <div className="ag-modal-velo absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      {/* ⚠️ `aria-alertdialog` NO: el rol correcto para una confirmación es
          `alertdialog`, pero exige `aria-describedby` apuntando al mensaje y
          `role="dialog"` con el mensaje como NOMBRE hace exactamente lo que
          aquí se necesita —el lector lee la pregunta al abrir— con una pieza
          menos. El texto es corto y es lo único que hay dentro. */}
      <div
        ref={montarPanel}
        onKeyDown={alPulsarTecla}
        role="dialog"
        aria-modal="true"
        aria-labelledby={mensajeId}
        tabIndex={-1}
        className="ag-modal-panel relative focus:outline-none bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <p id={mensajeId} className="text-sm text-[#1d1d1f] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
