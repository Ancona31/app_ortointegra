/**
 * src/lib/agenda/contratosV2.ts
 *
 * Los CONTRATOS del enchufe de las interacciones v2 (bloque F, F3), en un
 * archivo SÓLO DE TIPOS: quien lo importa con `import type` no se lleva ni un
 * byte al JS de `/agenda`, y así el interruptor apagado no descarga nada nuevo.
 *
 * Tres clases de contrato, por quién lo cumple:
 *
 *   1. `ApiInteraccionesV2` — lo cumple `InteraccionesV2.tsx` (el chunk diferido)
 *      y lo llaman `altaCitas.ts` y `AgendaCliente.tsx` por una referencia. Si
 *      la referencia está vacía (interruptor apagado, o el chunk todavía no
 *      llegó), el gesto hace lo de siempre: abrir el modal.
 *
 *   2. Campos que pide F y viven en archivos de OTROS agentes. Se declaran aquí
 *      como AMPLIACIONES OPCIONALES, para que el enchufe compile ya y funcione
 *      del todo en cuanto su dueño los aplique, sin tocar una línea de aquí:
 *        · `ModalState.create.horaFin` y `.medicoId` y `ModalState.edit.enfocar`
 *          — los aplica la superficie en `AppointmentModal.tsx`
 *          (`valoresInicialesDelModal` usa `horaFin` en vez de
 *          `DEFAULT_DURATION`; `enfocar: 'fecha'` lleva el foco al campo Fecha).
 *          Mientras no estén, el modal ignora los campos y abre como hoy.
 *        · `cambiarEstadoCita` en el retorno de `crearGuardadoCitas`
 *          (`guardadoCitas.ts`, de Movimiento): mientras no exista, la tarjeta
 *          NO ofrece «Confirmar» (la opción que menos cambia: no se inventa una
 *          segunda escritura de la cita fuera de `guardadoCitas`).
 *
 *   3. Lo que `altaCitas.ts` le pasa a la burbuja: el gesto crudo (instantes y
 *      ancla). La DURACIÓN se calcula dentro del chunk (`altaRapida.ts`), para
 *      que `altaCitas` no importe ningún valor nuevo.
 */
import type { ModalState } from '@/components/agenda/AppointmentModal'
import type { Appointment, Status } from '@/lib/agenda/tiposAgenda'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'

/** El alta del modal con los campos que añade F (opcionales). Ver la cabecera. */
export type AperturaAltaV2 = Extract<ModalState, { mode: 'create' }> & {
  /** `HH:MM`: el fin propuesto (la duración arrastrada o la de la burbuja). */
  horaFin?: string
  /** El médico elegido en la burbuja, si el filtro estaba en «Todos». */
  medicoId?: string
}

/** La edición del modal con el campo que añade F (opcional). Ver la cabecera. */
export type AperturaEdicionV2 = Extract<ModalState, { mode: 'edit' }> & {
  /** «Reagendar» abre el modal con el foco en la fecha. */
  enfocar?: 'fecha'
}

/**
 * La firma que la tarjeta espera de `cambiarEstadoCita` (`guardadoCitas.ts`):
 * el mismo PUT, la misma firma de escritura (`client_id`) y la misma auditoría
 * que `handleCancelar`, generalizado al estado. La tarjeta sólo la llama con
 * `'confirmed'`.
 */
export type CambiarEstadoCita = (id: string, estado: Status) => Promise<void>

/** El gesto de alta tal como lo ve `altaCitas`, antes de proponer duración. */
export interface GestoAlta {
  /** `YYYY-MM-DD` del inicio. */
  fecha: string
  /** `HH:MM`, o `null` si el gesto fue sobre un DÍA (celda del Mes). */
  hora: string | null
  /** El inicio y el fin de la selección (el fin sólo en un `select` con hora). */
  inicio: Date
  fin: Date | null
  /** `seleccionDesdeHueco`: vino de un hueco del panel de Día, no de un arrastre. */
  desdeHueco: boolean
  /** Dónde se pulsó, en coordenadas de ventana. */
  ancla: Caja
  punto?: Punto
}

/** Lo que el chunk de interacciones expone a la agenda. */
export interface ApiInteraccionesV2 {
  abrirBurbuja: (gesto: GestoAlta) => void
  /** `ancla` null: la cita no tiene un sitio pulsado (panel del Mes, buscador). */
  abrirTarjeta: (cita: Appointment, ancla: Caja | null, punto?: Punto) => void
}

/**
 * `abrirHueco` deja aquí el ancla del botón del hueco ANTES de `api.select()`,
 * y `handleSelect` la recoge y la vacía en su primera línea. `api.select()`
 * dispara `select` de forma síncrona (`triggerDateSelect` dentro de
 * `CalendarImpl.select`, `@fullcalendar/core/internal-common.js:5066-5070`).
 */
export type SeleccionDesdeHueco = { current: { ancla: Caja | null } | null }
