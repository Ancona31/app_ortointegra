/**
 * src/lib/agenda/duracionCita.ts
 *
 * `DEFAULT_DURATION` — 60 minutos, la duración que se propone cuando no hay
 * ninguna que heredar (alta sin hora, chip de duración, `eventDrop` que no
 * inventa una hora de fin).
 *
 * Vivía como `export const` dentro de `AppointmentModal.tsx` (A2.3). Se saca
 * a un archivo propio en A2.6: `AgendaCliente.tsx` la usa como VALOR, no sólo
 * como tipo, y un `import` de valor no se borra en compilación como sí pasa
 * con `import type` — así que mientras siguiera en `AppointmentModal.tsx`,
 * importarla desde `AgendaCliente.tsx` obligaba a `webpack` a meter el modal
 * entero (iconos, `Portal`, `QuickPatientModal`, los hooks de consultorios…)
 * en el bundle inicial de `/agenda`, aunque `AppointmentModal` se cargara con
 * `next/dynamic` unas líneas más abajo. El chunk no se separaba por esto.
 *
 * Los demás símbolos que `AppointmentModal.tsx` exportaba para `AgendaCliente`
 * — `ModalState`, `TodoElDiaInicial`, `PacienteBusqueda` — son sólo TIPOS y se
 * siguen importando con `import type` desde allí: ésos sí se borran en
 * compilación y no arrastran nada al bundle.
 */
export const DEFAULT_DURATION = 60
