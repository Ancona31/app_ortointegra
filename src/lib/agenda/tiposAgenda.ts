/**
 * src/lib/agenda/tiposAgenda.ts
 *
 * Los tipos de cita/evento que comparten `AgendaCliente.tsx` y el resto de
 * `src/lib/agenda/*Agenda.ts` (A2.1, movimiento puro). `AgendaCliente.tsx`
 * sigue re-exportando `Appointment` —de ahí lo importa `page.tsx`— para no
 * tocar ningún otro archivo.
 *
 * Movido tal cual desde `AgendaCliente.tsx`, con sus comentarios; sólo
 * cambiaron los `import`/`export` que hacían falta.
 */

import type { IconoEvento, ColorEvento } from '@/lib/appointments'

/* `attended` (plan §12.13). Lo escribe el servidor al crear la nota clínica que
   salió de la cita, y también se puede poner a mano en el selector de abajo.

   ⚠️ AÑADIR UN ESTADO AQUÍ ROMPE `STATUS_CONFIG` en compilación —es un
   `Record<Status, …>`— pero NO rompe los tokens CSS, que se consumen por
   interpolación (`var(--ag-status-${status}-dot)`). Si faltan los cuatro tokens
   del estado nuevo en globals.css, la tarjeta sale transparente y sin borde, sin
   un solo error. Los de `attended` están puestos, en claro y en oscuro.
   El otro consumidor de esos mismos tokens es `dashboard/StatusChip.tsx`, que
   sólo pinta `scheduled` y `confirmed` a propósito. */
export type Status = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'

/** T1 · Lo que `handleSave` devuelve de un ALTA que entró: la fila del servidor y el estado de Google. */
export interface AltaGuardada { cita: Appointment; gcalSync: string | null }
/** T1 · `sinInvitacion`: no abrir sola la invitación de Google tras el alta (la burbuja la ofrece como botón). */
export interface OpcionesGuardado { sinInvitacion?: boolean }

export type Appointment = {
  id: string
  title: string
  start_time: string
  end_time: string
  /* Días enteros en vez de horas (bloque 5B). El CONVENIO va con la columna y
     no se puede leer de otra forma: `start_time` es medianoche del primer día y
     `end_time` medianoche del día SIGUIENTE al último —fin EXCLUSIVO—, las dos
     en `consultorio_timezone`, NO en el huso de quien mira. Un evento del 19
     va de `19T00:00` a `20T00:00`.
     Quien la escribe es el SERVIDOR: el modal manda dos fechas y las rutas
     componen la medianoche con la zona del consultorio. Ver
     `appointments_all_day_medianoche_check`. */
  all_day: boolean
  status: Status
  notes: string | null
  paciente_id: string | null
  medico_id: string | null
  google_event_id: string | null
  gcal_sync_status: 'synced' | 'pending' | 'failed' | 'unbound'
  updated_at: string
  // F3-6: snapshots de consultorio (persistidos en POST/PUT, devueltos en GET).
  consultorio_id: string | null
  consultorio_nombre: string | null
  consultorio_nombre_corto: string | null
  consultorio_direccion: string | null
  consultorio_telefono: string | null
  consultorio_timezone: string | null
  /* La pinta del evento genérico sin paciente (§12.14). Una CITA no lleva
     ninguna de las dos y ahí NULL es lo corriente, no una carencia. */
  icono: IconoEvento | null
  color: ColorEvento | null
  /* B6 · Tipo de cita (P5) y la instantánea de su nombre. OPCIONALES, y no por
     comodidad: llegan sólo porque `APPOINTMENT_SELECT` es `*`, y en producción
     las columnas pueden no existir todavía (migración 20261112150000). Ninguna
     consulta las nombra salvo con el interruptor encendido. La instantánea NO
     se pinta en la tarjeta (P5); sólo la lee el selector del modal. */
  tipo_cita_id?: string | null
  tipo_cita_nombre?: string | null
  /* D6 · La reserva por enlace (migración 20261114120000). OPCIONALES por lo
     mismo que el tipo: llegan sólo por el `*` de `APPOINTMENT_SELECT` cuando
     las columnas existen, y en una base sin D1 no llegan nunca (`undefined`
     cuenta como «no nació de una reserva»). «Por ligar» = `reserva_canal` no
     nulo y `paciente_id` nulo (`esPorLigar`). `reserva_historial_previo` es la
     instantánea de cancelaciones + inasistencias AL RESERVAR; el historial en
     vivo lo pide el modal. Los `*_hmac` también llegan y nadie los lee aquí. */
  reserva_canal?: 'fijo' | 'unico' | null
  reserva_nombre?: string | null
  reserva_telefono?: string | null
  reserva_correo?: string | null
  reserva_historial_previo?: number | null
  /* C (T3) · De dónde nació la fila: `google` = importada por el sondeo de la
     v2 (migración C1). OPCIONAL por lo mismo que `reserva_*`: llega por el `*`
     de `APPOINTMENT_SELECT` sólo si la columna existe. La lee la tarjeta para
     ofrecer «Convertir en cita» (§2, AG-DT-29). */
  origen?: 'spinus' | 'google' | null
  /* E7 · La marca del WhatsApp manual (columna del baseline, vacía hasta E7):
     cuándo se ABRIÓ el mensaje desde el botón de la cita. Llega por el `*`. */
  whatsapp_sent_at?: string | null
  /* `email` viaja desde `APPOINTMENT_SELECT` para un solo consumidor: el botón
     de invitación. Que esté aquí es lo que evita una petición por cita abierta
     sólo para saber si la ficha tiene correo.

     OPCIONAL, y no por comodidad: la actualización optimista de `handleSave`
     mete aquí el `PacienteBusqueda` que devuelve el buscador, que NO trae
     correo porque su endpoint no lo selecciona. Ese hueco dura lo que tarda la
     respuesta del PUT —que trae la fila canónica y la pisa vía
     `aplicarAppointmentAlEvento`— y encima ocurre con el modal ya cerrado. */
  pacientes?: { id: string; nombre: string; apellidos: string; telefono: string | null; email?: string | null } | null
  medico?: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

/**
 * Lo que el modal manda a guardar.
 *
 * Es `Partial<Appointment>` más DOS CAMPOS QUE NO SON COLUMNAS, y por eso están
 * nombrados aparte en vez de colarse dentro del tipo de la fila: `all_day_desde`
 * y `all_day_hasta` son FECHAS-SOLO (`YYYY-MM-DD`), y `all_day_hasta` es el
 * ÚLTIMO DÍA INCLUIDO, no el fin exclusivo que guarda la columna.
 *
 * ⚠️ POR QUÉ EL CLIENTE MANDA FECHAS Y NO INSTANTES. La medianoche de una fila
 * de todo el día es la de la zona del CONSULTORIO, y componerla aquí exigiría
 * que el navegador la conociera y la aplicara bien. `componerIso` no lo hace
 * —usa el reloj del dispositivo— y el resultado violaría
 * `appointments_all_day_medianoche_check` desde cualquier huso que no sea el
 * del consultorio. Así que el cliente manda el DÍA, que no tiene huso, y las
 * rutas componen el instante con la zona que ya tienen a mano.
 *
 * Cuando `all_day` es `false` estos dos no viajan y las puntas van en
 * `start_time`/`end_time` como siempre. Nunca viajan las cuatro a la vez.
 */
export type DatosGuardado = Partial<Appointment> & {
  id?: string
  all_day_desde?: string
  all_day_hasta?: string
  /** B7: los ids de las citas con las que el usuario ACEPTÓ empalmarse. Sólo
   *  viaja si hay alguno, y el servidor lo ignora con el interruptor apagado. */
  empalmes_aceptados?: string[]
}
