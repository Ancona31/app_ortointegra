'use client'

/**
 * src/components/agenda/HorarioModal.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.3, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { useId, useState } from 'react'
import { X, Settings } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { DIAS, HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import type { DiaSemana, Horario } from '@/lib/configApp'

/* ─── Modal de configuración de horario ─────────────────── */

/**
 * De dónde saca el modal su horario, en TRES situaciones y no en dos.
 *
 * ⚠️ `error` NO PUEDE DEGRADAR A `HORARIO_DEFAULT`, y por eso es un estado
 * propio y no un `?? HORARIO_DEFAULT` en el sitio de lectura. Si el agregado
 * falla y el modal pinta 09:00–19:00, esas horas no se distinguen de las de la
 * clínica: el administrador ve un horario plausible, pulsa «Guardar» y machaca
 * el verdadero con uno inventado. El fallo tiene que verse Y no dejar guardar.
 *
 * `listo` con `horario: null` es OTRA cosa y sí es legítima: la clínica existe
 * y todavía no ha configurado horario. Ahí `HORARIO_DEFAULT` es un punto de
 * partida editable, que es lo que el modal hacía ya.
 */
export type FuenteHorario =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; horario: Horario | null }

export default function HorarioModal({ fuente, onClose, onSave }: { fuente: FuenteHorario; onClose: () => void; onSave: (h: Horario) => Promise<void> }) {
  const { montarPanel, alPulsarTecla } = useDialogoModal(onClose)
  const tituloId = useId()
  const errorId  = useId()
  /* Lo que dice el agregado, ya resuelto el caso legítimo de «clínica todavía
     sin horario». `null` mientras no haya una lectura buena que ofrecer. */
  const base = fuente.estado === 'listo' ? fuente.horario ?? HORARIO_DEFAULT : null
  /* SÓLO las ediciones del médico, no una copia del horario. Se deriva en vez
     de sembrarse con un efecto —el dato ya está en el cliente, no hay nada que
     esperar— y eso trae gratis lo que antes había que vigilar: mientras no haya
     edición manda el agregado, y en cuanto la hay manda la edición, así que una
     revalidación de SWR con el modal abierto no puede pisar lo escrito. */
  const [edicion, setEdicion] = useState<Horario | null>(null)
  const [saving,  setSaving]  = useState(false)
  const horario = edicion ?? base

  function toggle(dia: DiaSemana) {
    setEdicion(prev => {
      const actual = prev ?? base
      return actual ? { ...actual, [dia]: { ...actual[dia], activo: !actual[dia].activo } } : actual
    })
  }

  function setHora(dia: DiaSemana, campo: 'inicio' | 'fin', val: string) {
    setEdicion(prev => {
      const actual = prev ?? base
      return actual ? { ...actual, [dia]: { ...actual[dia], [campo]: val } } : actual
    })
  }

  async function handleSave() {
    if (!horario) return
    setSaving(true)
    try {
      await onSave(horario)
    } catch {
      /* Quien avisa al médico es `onSave`, que es donde está el toast; aquí no
         se duplica el mensaje. Este `catch` existe para que un rechazo que se
         le escape no quede como promesa sin capturar. */
    } finally {
      /* ⚠️ EN `finally`, Y NO DETRÁS DEL `await`. Ahí estaba antes, y un
         rechazo lo saltaba: el botón se quedaba en «Guardando…» y deshabilitado
         para siempre, y la única salida era cerrar el modal perdiendo lo
         editado. El botón tiene que volver falle lo que falle. */
      setSaving(false)
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Los cinco atributos del bloque 9 son los mismos en los tres modales de
          este archivo; el porqué de cada uno está junto a `useDialogoModal`. */}
      <div
        ref={montarPanel}
        onKeyDown={alPulsarTecla}
        role="dialog"
        aria-modal="true"
        /* ⚠️ EL PATRÓN ES EL DE `ConfirmModal`, NO EL DE `Banda`, y la
           diferencia no es de gusto. `Banda` usa `role="alert"` porque
           INTERRUMPE: la agenda ya estaba en pantalla y algo falló mientras el
           médico la leía. Aquí no interrumpe nada — el médico acaba de abrir
           este diálogo y el fallo ES su contenido, igual que la pregunta es
           todo el contenido de `ConfirmModal`. Por eso el mensaje se nombra
           desde el propio diálogo y se lee al recibir el foco, sin cortar nada.

           Los DOS ids, y no sólo el del error: `aria-labelledby` concatena, así
           que el lector anuncia «Horario de consulta. No se pudo cargar el
           horario». `ConfirmModal` puede prescindir del título porque no tiene;
           éste sí, y perderlo dejaría un diálogo sin identidad. */
        aria-labelledby={fuente.estado === 'error' ? `${tituloId} ${errorId}` : tituloId}
        tabIndex={-1}
        className="relative focus:outline-none bg-white rounded-2xl shadow-2xl w-full max-w-md animate-modal-enter overflow-hidden"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Settings size={15} className="text-slate-600" />
            </div>
            <h2 id={tituloId} className="font-semibold text-[15px] text-[#1d1d1f]">Horario de consulta</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {fuente.estado === 'error' ? (
            /* Ni horario ni pickers: si no se pudo leer, no hay nada que
               ofrecer. Enseñar aquí un horario por defecto sería justo el
               camino que lleva a guardar uno inventado encima del real. */
            <div className="py-8 text-center">
              <p id={errorId} className="text-sm font-medium text-[#1d1d1f]">No se pudo cargar el horario</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Cierra y vuelve a abrir esta ventana. Si sigue igual, recarga la página.
              </p>
            </div>
          ) : !horario ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {DIAS.map(({ key, label }) => {
                const dia = horario[key]
                return (
                  <div key={key} className={`rounded-xl px-3 py-2.5 transition-colors ${dia.activo ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    {/* Fila: toggle + nombre */}
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => toggle(key)}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-[#1e5fa8]' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${dia.activo ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-sm font-medium flex-1 ${dia.activo ? 'text-[#1d1d1f]' : 'text-slate-400'}`}>
                        {label}
                      </span>
                      {!dia.activo && (
                        <span className="text-[11px] text-slate-400 italic">Sin consulta</span>
                      )}
                    </div>

                    {/* Fila: pickers de hora (solo si activo) */}
                    {dia.activo && (
                      <div className="flex items-center gap-2 mt-2 pl-[52px]">
                        <input
                          type="time"
                          value={dia.inicio}
                          onChange={e => setHora(key, 'inicio', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                        <span className="text-xs text-slate-400 flex-shrink-0">–</span>
                        <input
                          type="time"
                          value={dia.fin}
                          min={dia.inicio}
                          onChange={e => setHora(key, 'fin', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            /* `fuente.estado !== 'listo'` es redundante con `!horario` —sin
               lectura buena nunca se siembra— y se deja escrito a propósito:
               que el candado no dependa de razonar sobre otra variable. */
            disabled={saving || !horario || fuente.estado !== 'listo'}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
