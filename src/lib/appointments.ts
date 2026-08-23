import type { calendar_v3 } from 'googleapis'
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

/* ═══ LA PINTA DEL EVENTO GENÉRICO ═══════════════════════════════════════════
 *
 * Las dos listas cerradas de `appointments.icono` y `appointments.color`
 * (plan §12.14). Viven aqui, y no en la pagina de la agenda, porque tienen TRES
 * consumidores: el selector del modal, el POST y el PUT — y los dos ultimos son
 * servidor. Una lista que el cliente conociera y el servidor no seria una
 * validacion decorativa.
 *
 * ⚠️ ESTAS DOS LISTAS SON EL ESPEJO EXACTO DE LOS CHECK DE LA BASE
 * (`appointments_icono_check` y `appointments_color_check`, definidos hoy por
 * 20260822_agenda_pinta_definitiva.sql). Si divergen, la base
 * rechaza con un 23514 crudo que el usuario lee como «no se pudo guardar» sin
 * mas. Cambiar una lista es cambiar las dos, y la de la base va por migracion.
 *
 * ⚠️ LOS VALORES YA NO SON PROVISIONALES. Lo fueron: nacieron como cinco iconos
 * y cuatro colores de relleno a la espera del rediseno del calendario. Ese
 * rediseno cerro y estas son sus listas definitivas — 20 iconos y 6 colores,
 * migracion 20260822_agenda_pinta_definitiva.sql. Si encuentras un comentario
 * que siga anunciando que «Claude Design va a sustituirlas», esta desfasado.
 *
 * ⚠️ CADA NOMBRE DE ICONO ES EL NOMBRE DE UN ARCHIVO de `/public/icons/`, sin
 * `.svg`. Anadir uno a esta lista sin subir su archivo compila, pasa la
 * validacion del servidor, pasa el CHECK de la base y sale como un HUECO EN
 * BLANCO en la agenda. Ver el aviso de `agenda/page.tsx`, que es donde se
 * consume la ruta.
 *
 * ⚠️ `pizarra` NO ESTA EN LA PALETA Y NO DEBE ANADIRSE: es el color del estado
 * «no asistio» (#64748b), y un evento generico con el se lee como una cita de
 * ese estado de un vistazo, que es lo unico que esta paleta tiene prohibido.
 * `grafito` es el neutro que `pizarra` iba a cubrir.
 *
 * ⚠️ `teal` TAMBIEN SE HABIA RETIRADO Y YA NO ESTA VETADO. Lo estuvo mientras
 * «atendida» era teal (#0f766e); la rotacion de la paleta de estados dejo ese
 * estado en verde y nada choca ya con el teal. Lo mismo vale para `cian`
 * (#0891b2), retirado en su dia por estar a diecisiete grados de aquel teal.
 * OJO: que se pueda no quiere decir que salga gratis. Esta lista viaja al CHECK
 * `appointments_color_check`, asi que anadir un septimo color SI es una
 * migracion. Lo que cayo es el veto de color, no el coste.
 *
 * Lo que NO esta aqui y es a proposito: la ruta del SVG de cada icono y su
 * etiqueta (eso es interfaz y vive en la agenda) y el hex de cada color (eso
 * vive en globals.css, junto a los de los estados, que es con quien no puede
 * chocar).
 */
export const ICONOS_EVENTO = [
  // Quirofano y hospital
  'cirugia', 'instrumental', 'urgencias', 'internamiento', 'ronda',
  // Clinica y estudios
  'columna', 'ortopedia', 'imagen', 'ultrasonido', 'rehabilitacion', 'laboratorio', 'vacuna',
  // Agenda no clinica
  'junta', 'videollamada', 'docencia', 'congreso', 'viaje', 'comida', 'personal', 'bloqueo',
] as const
export type IconoEvento = typeof ICONOS_EVENTO[number]

export const COLORES_EVENTO = ['indigo', 'magenta', 'carmin', 'oliva', 'bronce', 'grafito'] as const
export type ColorEvento = typeof COLORES_EVENTO[number]

/**
 * Valida un valor de pinta que llega del cliente y lo normaliza.
 *
 * Devuelve `null` para ausente, vacio y para el string vacio: los tres
 * significan lo mismo —sin icono, sin color— y la columna guarda NULL. NO
 * existe un valor «ninguno» dentro de la lista; §12.14 proponia uno (`punto`)
 * y se retiro justamente para no tener dos nombres del mismo concepto.
 *
 * Devuelve `undefined` cuando el valor NO es aceptable, que el llamador
 * distingue de `null` para responder 400 en vez de guardar un vacio: tragarse
 * en silencio un valor invalido es como el evento sale roto sin que nadie se
 * entere, que es lo que el CHECK existe para impedir.
 */
export function pintaValida<T extends string>(
  valor: unknown,
  permitidos: readonly T[],
): T | null | undefined {
  if (valor === undefined || valor === null || valor === '') return null
  if (typeof valor !== 'string') return undefined
  return (permitidos as readonly string[]).includes(valor) ? (valor as T) : undefined
}

/** El valor de `appointments.status` que marca una cita cancelada. */
const ESTADO_CANCELADA = 'cancelled'

/**
 * Lo que se antepone al titulo cuando la cita esta cancelada.
 *
 * ── POR QUE UN PREFIJO Y NO BORRAR EL EVENTO ────────────────────────────────
 * En Spinus «Cancelada» es solo un estado visual: la fila sigue viva y la cita
 * puede reactivarse. Borrar el evento haria irreversible en Google algo que en
 * Spinus no lo es. El prefijo avisa sin destruir.
 *
 * ── ⚠️⚠️ LA IDEMPOTENCIA SALE GRATIS, Y HAY UNA SOLA FORMA DE ROMPERLA ──────
 * Marcar cancelada dos veces NO produce «CANCELADA — CANCELADA — …» porque
 * `summary` se RECOMPONE DESDE CERO en cada escritura a Google, a partir del
 * paciente y del estado de la fila. Este modulo NUNCA lee el titulo que hay
 * ahora mismo en el evento.
 *
 * Y esa es exactamente la linea que no se puede cruzar: el dia que alguien lea
 * el `summary` de Google para anteponerle algo —«asi conservo lo que hubiera
 * puesto el medico a mano»— la duplicacion aparece al segundo guardado. Si hace
 * falta conservar algo del titulo ajeno, hay que resolverlo sin leerlo de
 * vuelta.
 *
 * Por lo mismo, el camino de vuelta no necesita codigo: reactivar una cita
 * recompone el titulo sin prefijo y el prefijo desaparece solo.
 *
 * El separador es una raya larga con espacios, no un guion: se lee como
 * separador en la cuadricula del calendario, donde el titulo va apretado.
 */
const PREFIJO_CANCELADA = 'CANCELADA — '

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
  estado: string,
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

  const titulo = tituloParaGoogle(paciente, fallbackTitulo)

  return {
    summary:     estado === ESTADO_CANCELADA ? PREFIJO_CANCELADA + titulo : titulo,
    description: renglones.filter(Boolean).join('\n'),
    reminders: {
      useDefault: false,
      overrides:  [{ method: 'popup', minutes: GCAL_RECORDATORIO_MINUTOS }],
    },
  }
}

/* ═══ ASISTENTES DEL EVENTO ══════════════════════════════════════════════════ */

/** Quien tiene que estar, quien tiene que salir. Todo en correos, ya resueltos. */
export interface AsistentesDeseados {
  /**
   * El medico asignado a la cita AHORA. Entra siempre y sin que nadie lo pida:
   * si tiene la cita, tiene que tenerla en su calendario. No es una eleccion.
   */
  readonly medicoActual: string | null
  /**
   * El medico que DEJA de tener la cita, en una reasignacion. Sale.
   *
   * ⚠️ SACARLO NO ES OPCIONAL Y NO ES LIMPIEZA. Mientras siga en la lista recibe
   * TODAS las actualizaciones futuras de esa cita —cambios de hora,
   * cancelaciones— con el nombre de un paciente que ya no atiende.
   */
  readonly medicoSaliente: string | null
  /**
   * El paciente que DEJA de ser el de la cita, cuando cambia `paciente_id`. Sale
   * por el mismo motivo que el medico saliente.
   *
   * ⚠️ SOLO CUBRE EL CAMBIO DE PACIENTE, NO EL CAMBIO DE SU CORREO, y no es una
   * omision: es que el dato no existe. Si a un paciente le editan el correo en
   * la ficha, `PUT /api/pacientes/[id]` sobrescribe la columna y la direccion
   * anterior no queda en ninguna parte de Spinus. Sin ella no hay forma de saber
   * cual de las entradas de la lista era la suya, y adivinar esta prohibido por
   * la regla de abajo. Ahi entra la nueva y la vieja se queda hasta que alguien
   * la quite a mano. Coste aceptado, anotado en el plan.
   *
   * El cambio de PACIENTE si se puede: al saliente se le lee su correo porque su
   * ficha sigue existiendo.
   */
  readonly pacienteSaliente: string | null
  /** Los que entran por el boton de invitacion: el paciente, o alguien externo. */
  readonly nuevos: readonly string[]
}

/** Normaliza para comparar. Google no distingue mayusculas en los correos. */
function correoNormalizado(correo: string | null | undefined): string {
  return correo?.trim().toLowerCase() ?? ''
}

/**
 * La lista de asistentes que debe quedar en el evento.
 *
 * PUNTO UNICO: toda la decision de quien esta y quien no vive aqui, y no
 * repartida por los tres `patch` que escriben en Google. Es pura —no consulta
 * nada, no lanza— asi que se puede razonar leyendola entera de una vez.
 *
 * ── ⚠️⚠️ POR QUE SE PARTE DE `previos` Y NO DE CERO ─────────────────────────
 * `events.patch` con `attendees` PISA LA LISTA ENTERA: no anade, sustituye. Una
 * lista compuesta desde cero borraria a todos los demas invitados, y Google les
 * mandaria una CANCELACION de la cita. Por eso el llamador hace `events.get`
 * antes y pasa aqui lo que habia.
 *
 * ── ⚠️ SE QUITA POR NOMBRE, NUNCA POR NO RECONOCER ──────────────────────────
 * Solo salen los dos correos que el llamador nombra explicitamente. Todo lo
 * demas se conserva aunque este modulo no sepa quien es, y tiene que ser asi:
 * en esa lista estan tambien el paciente, los invitados externos del boton y a
 * veces el propietario del calendario. Un «quito lo que no reconozco» los
 * echaria a todos, y con la cancelacion de Google por delante.
 *
 * ── EL `responseStatus` SE CONSERVA ─────────────────────────────────────────
 * Se copia con su respuesta: reenviar la lista sin ese campo devolveria a
 * «pendiente de responder» a quien ya habia aceptado. Se copia solo lo que la
 * API admite escribir; lo de solo lectura (`id`, `self`, `organizer`) se queda
 * fuera. Un asistente sin correo no es escribible y no se puede reenviar.
 */
export function componerAsistentes(
  previos: readonly calendar_v3.Schema$EventAttendee[],
  deseados: AsistentesDeseados,
): calendar_v3.Schema$EventAttendee[] {
  const salen = new Set(
    [deseados.medicoSaliente, deseados.pacienteSaliente]
      .map(correoNormalizado)
      .filter(c => c !== ''),
  )

  const lista: calendar_v3.Schema$EventAttendee[] = []
  const yaEstan = new Set<string>()

  for (const previo of previos) {
    const correo = correoNormalizado(previo.email)
    if (correo === '' || salen.has(correo) || yaEstan.has(correo)) continue
    yaEstan.add(correo)
    lista.push({
      email: previo.email?.trim() ?? correo,
      ...(previo.displayName      != null ? { displayName:      previo.displayName }      : {}),
      ...(previo.optional         != null ? { optional:         previo.optional }         : {}),
      ...(previo.responseStatus   != null ? { responseStatus:   previo.responseStatus }   : {}),
      ...(previo.comment          != null ? { comment:          previo.comment }          : {}),
      ...(previo.additionalGuests != null ? { additionalGuests: previo.additionalGuests } : {}),
      ...(previo.resource         != null ? { resource:         previo.resource }         : {}),
    })
  }

  // Los que entran van al final y sin `responseStatus`: Google los pone en
  // `needsAction` solo. Uno que ya estuviera en la lista NO se duplica — se
  // quedo arriba con su respuesta intacta, que es lo que hace que volver a
  // pulsar «Enviar invitacion» reenvie el correo en vez de resetear a nadie.
  for (const entrante of [deseados.medicoActual, ...deseados.nuevos]) {
    const correo = correoNormalizado(entrante)
    if (correo === '' || yaEstan.has(correo)) continue
    yaEstan.add(correo)
    lista.push({ email: correo })
  }

  return lista
}

/**
 * Los tres interruptores, en un solo sitio porque van en TODA escritura de
 * evento —el `insert` del alta y los tres `patch`— y separarlos es como se
 * quedan desparejados.
 *
 * ⚠️ VAN SIEMPRE, AUNQUE EL EVENTO YA LOS TUVIERA. VERIFICADO CONTRA PRODUCCION
 * que los eventos NACEN sin ellos y que los valores por defecto NO son iguales:
 * `guestsCanModify` es false por omision, pero `guestsCanInviteOthers` y
 * `guestsCanSeeOtherGuests` valen TRUE. Si una escritura no los manda, el medico
 * y el paciente se ven el correo el uno al otro.
 *
 * Cuidado al comprobarlo en la respuesta: Google omite el campo cuando vale su
 * valor por defecto, asi que un campo ausente significa «aplicado» en el primero
 * y «Google lo ignoro» en los otros dos.
 */
export const INTERRUPTORES_INVITADOS = {
  guestsCanModify:         false,
  guestsCanInviteOthers:   false,
  guestsCanSeeOtherGuests: false,
} as const
