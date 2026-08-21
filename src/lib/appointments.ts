import { renderEnTZ } from '@/lib/dates'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'

/**
 * Forma canonica de una cita tal como la consume el calendario.
 * GET, POST y PUT deben devolver exactamente esta forma: el cliente
 * re-hidrata su estado desde la respuesta, asi que cualquier campo que
 * falte aqui se queda obsoleto en la UI hasta que el usuario recargue.
 *
 * `clinicas` viaja aqui para que las rutas puedan armar la descripcion del
 * evento de Google sin un round trip extra.
 *
 * `pacientes.email` viaja por el mismo motivo y para un solo consumidor: el
 * boton de invitacion del modal de la cita, que necesita saber si hay correo en
 * la ficha ANTES de que nadie pulse nada —para decidir si ofrece la casilla del
 * paciente o pide la direccion a mano— y no puede preguntarlo por su cuenta sin
 * una peticion extra por cita abierta.
 *
 * NO ES EL CAMINO DEL CORREO DEL MEDICO, y no puede serlo: `profiles` no tiene
 * columna `email` (son 16 y ninguna es esa), asi que ampliar el join del medico
 * no sirve. Ese sale de la API de Admin de Auth, EN EL SERVIDOR y al pulsar, y
 * no viaja al navegador nunca. Ver `/api/appointments/[id]/invitacion`.
 */
export const APPOINTMENT_SELECT =
  '*, pacientes(id, nombre, apellidos, telefono, email), clinicas(nombre, nombre_display), medico:profiles!appointments_medico_id_fkey(id, titulo, nombres, apellido_paterno, apellido_materno)'

/** El paciente tal como llega dentro de una cita de `APPOINTMENT_SELECT`. */
export type PacienteEnCita = { nombre: string; apellidos: string } | null

/** La clinica tal como llega dentro de una cita de `APPOINTMENT_SELECT`. */
export type ClinicaEnCita = { nombre: string; nombre_display: string | null } | null

/**
 * Minutos antes de la cita en que Google avisa al medico.
 *
 * Constante y no numero suelto porque tarde o temprano sera configurable por
 * clinica. Solo se aplica al crear el evento: si el medico cambia o quita el
 * recordatorio a mano en Google, ninguna edicion posterior desde Spinus se lo
 * vuelve a imponer.
 */
export const GCAL_RECORDATORIO_MINUTOS = 60

/**
 * Titulo del evento en el calendario propio de Spinus.
 *
 * El prefijo "Cita medica:" NO es decorativo. Google agrega por su cuenta una
 * ilustracion de cabecera al evento cuando reconoce ciertas palabras clave en
 * el titulo, y esa es la que la dispara: no hay campo en la API para pedir la
 * imagen, el recurso Events no tiene portada. El texto es la unica palanca.
 * No cambiar sin avisar.
 *
 * Una sola linea: Google trunca el `summary` en la cuadricula del calendario.
 *
 * Sin paciente ligado el titulo cae al texto libre de la cita, tal cual y sin
 * prefijo — ahi no hay nada que anunciar como cita medica.
 */
function tituloParaGoogle(paciente: PacienteEnCita, fallback: string): string {
  return paciente ? `Cita médica: ${paciente.nombre} ${paciente.apellidos}` : fallback
}

/** Nombre de la clinica de cara a Google. `nombre_display` es nullable; `nombre` no. */
function nombreClinica(clinica: ClinicaEnCita): string {
  return clinica ? (clinica.nombre_display?.trim() || clinica.nombre) : ''
}

/**
 * ANCLA DE HORA LOCAL — el renglon que fija por escrito a que hora es la cita y
 * en que huso, p.ej. "Hora de la cita: 9:00 a.m., hora Sonora".
 *
 * POR QUE EXISTE. Google traduce todo evento al huso de quien lo mira. Un
 * paciente que abra la invitacion desde otro huso —de viaje, o viviendo
 * fuera— ve una hora distinta de la que le dijeron por telefono. Esa
 * traduccion es CORRECTA y no hay que pelearse con ella, pero confunde. El
 * texto no se traduce: dice la hora del consultorio pase lo que pase.
 *
 * La region sale de `regionDeTimezone`, o sea el estado y no la ciudad:
 * "Sonora" identifica mejor la zona para un paciente que "Hermosillo".
 *
 * El formato de la hora replica el del encabezado de las notas
 * (`notaRenderData.ts`): `renderEnTZ` con locale `es` produce "9:00 a. m." con
 * espacio interno, y se compacta a "9:00 a.m.". Son cinco lineas duplicadas a
 * proposito — la version de notaRenderData es privada de aquel modulo y
 * extraerla a un tercer sitio para dos usos seria abstraccion prematura.
 *
 * Nunca lanza: un instante corrupto devuelve null y la descripcion sale sin
 * ancla, que es peor que con ella pero mucho mejor que un evento sin crear.
 */
function anclaDeHora(startISO: string, timezone: string): string | null {
  if (Number.isNaN(new Date(startISO).getTime())) return null
  try {
    const hora = renderEnTZ(startISO, 'h:mm a', timezone)
      .toLowerCase()
      .replace(/([ap])\.?\s*m\.?/i, '$1.m.')
    const region = regionDeTimezone(timezone)
    return region ? `Hora de la cita: ${hora}, hora ${region}` : `Hora de la cita: ${hora}`
  } catch {
    return null
  }
}

/**
 * Lo que Spinus escribe en el evento de Google. Punto unico: si el formato se
 * duplicara entre el POST y el PUT, el evento cambiaria de forma segun por
 * donde pasara la ultima edicion.
 *
 * PRIVACIDAD — la descripcion tiene formato fijo y solo lleva nombre de
 * clinica, nombre de paciente y la hora de la cita con su huso. NADA clinico:
 * ni `notes`, ni motivo de consulta, ni diagnostico, ni el estado de la cita.
 * El aviso de privacidad declara exactamente esto. El ancla de hora NO es una
 * excepcion a esa regla: una hora y una region no dicen nada del padecimiento.
 *
 * `reminders` se devuelve siempre pero solo el `events.insert` debe mandarlo
 * (ver GCAL_RECORDATORIO_MINUTOS).
 *
 * `startISO` y `timezone` son el instante de inicio de la cita y el huso de su
 * consultorio (`appointments.consultorio_timezone`, con `TZ_CLINICA` de
 * respaldo para las citas anteriores a esa columna). OJO EN LA EDICION: el
 * instante tiene que salir de la FILA YA ACTUALIZADA, nunca del `start_time`
 * del cuerpo de la peticion — la descripcion se recalcula en toda edicion que
 * toque Google, incluida una que solo cambie el `status`, y ahi `start_time`
 * viene `undefined`.
 */
export function eventoParaGoogle(
  paciente: PacienteEnCita,
  clinica: ClinicaEnCita,
  fallbackTitulo: string,
  startISO: string,
  timezone: string,
): {
  summary: string
  description: string
  reminders: { useDefault: false; overrides: Array<{ method: 'popup'; minutes: number }> }
} {
  const clinicaNombre = nombreClinica(clinica)
  // El ancla va tambien en las citas sin paciente ligado: habla de la hora, no
  // de quien viene. `filter(Boolean)` se come el null si el instante no sirve.
  const ancla = anclaDeHora(startISO, timezone)
  const renglones = paciente
    ? [clinicaNombre, 'Consulta:', `${paciente.nombre} ${paciente.apellidos}`, ancla]
    : [clinicaNombre, ancla]

  return {
    summary:     tituloParaGoogle(paciente, fallbackTitulo),
    description: renglones.filter(Boolean).join('\n'),
    reminders: {
      useDefault: false,
      overrides:  [{ method: 'popup', minutes: GCAL_RECORDATORIO_MINUTOS }],
    },
  }
}
