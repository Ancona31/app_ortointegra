/**
 * src/lib/agenda/horarioAgenda.ts
 *
 * El horario de consulta de la clínica: días activos, horas de apertura y
 * los avisos de fuera-de-horario/día-cerrado que usan el alta y el
 * redimensionado de citas. Movido tal cual desde `AgendaCliente.tsx` (A2.1,
 * movimiento puro), con sus comentarios; sólo cambiaron los
 * `import`/`export` que hacían falta.
 */

import type { DiaSemana, Horario } from '@/lib/configApp'

/* ─── Horario de consulta ──────────────────────────────── */

/* `DiaSemana`, `HorarioDia` y `Horario` viven en src/lib/configApp.ts: es el
   tipo de `clinicas.horario_consulta` tal como lo devuelve el agregado. */

/* `plural` es para la frase del aviso de fuera de horario («esta clínica no
   atiende los domingos»), no para ninguna etiqueta de la interfaz. */
export const DIAS: { key: DiaSemana; label: string; plural: string; fc: number }[] = [
  { key: 'lunes',     label: 'Lunes',     plural: 'los lunes',     fc: 1 },
  { key: 'martes',    label: 'Martes',    plural: 'los martes',    fc: 2 },
  { key: 'miercoles', label: 'Miércoles', plural: 'los miércoles', fc: 3 },
  { key: 'jueves',    label: 'Jueves',    plural: 'los jueves',    fc: 4 },
  { key: 'viernes',   label: 'Viernes',   plural: 'los viernes',   fc: 5 },
  { key: 'sabado',    label: 'Sábado',    plural: 'los sábados',   fc: 6 },
  { key: 'domingo',   label: 'Domingo',   plural: 'los domingos',  fc: 0 },
]

export const HORARIO_DEFAULT: Horario = {
  lunes:     { activo: true,  inicio: '09:00', fin: '19:00' },
  martes:    { activo: true,  inicio: '09:00', fin: '19:00' },
  miercoles: { activo: true,  inicio: '09:00', fin: '19:00' },
  jueves:    { activo: true,  inicio: '09:00', fin: '19:00' },
  viernes:   { activo: true,  inicio: '09:00', fin: '19:00' },
  sabado:    { activo: false, inicio: '09:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '14:00' },
}

export function horarioToBusinessHours(h: Horario) {
  return DIAS.filter(d => h[d.key]?.activo).map(d => ({
    daysOfWeek: [d.fc],
    startTime:  h[d.key].inicio,
    endTime:    h[d.key].fin,
  }))
}

/** Hora de pared del navegador, `HH:MM`. Comparable con `horario.inicio`/`fin`. */
export function horaDeReloj(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * El aviso de que una hora cae fuera del horario de consulta, YA REDACTADO, o
 * `null` si cae dentro.
 *
 * ⚠️  EL TEXTO DICE LA HORA Y DICE EL HORARIO, A PROPÓSITO. Un «23:00» dentro
 * de una frase se reconoce como error de tecleo; un campo del formulario ya
 * relleno con 23:00 no se reconoce, porque es justo lo que no se vuelve a
 * mirar. En producción hay cinco citas de madrugada que salieron de ahí.
 *
 * ⚠️  NO BLOQUEA NADA, Y NO DEBE HACERLO. Agendar fuera de horario sigue
 * siendo un clic: hay urgencias, favores y consultas a deshora. Un bloqueo
 * duro no evita la cita rara, enseña a falsear el dato para colarla.
 *
 * `encabezado` es la frase hasta la hora, sin ella: «Vas a agendar a las».
 */
export function avisoFueraDeHorario(date: Date, h: Horario, encabezado: string): string | null {
  const dia = DIAS.find(d => d.fc === date.getDay())
  if (!dia) return null
  const horarioDia = h[dia.key]
  const hhmm = horaDeReloj(date)
  if (!horarioDia?.activo) {
    return `${encabezado} ${hhmm} del ${dia.label.toLowerCase()}, y esta clínica no atiende ${dia.plural}. ¿Es correcto?`
  }
  if (hhmm >= horarioDia.inicio && hhmm < horarioDia.fin) return null
  return `${encabezado} ${hhmm}, y esta clínica atiende de ${horarioDia.inicio} a ${horarioDia.fin}. ¿Es correcto?`
}

/**
 * Lo mismo para la hora de FIN, que necesita su propia regla.
 *
 * ⚠️  EL CIERRE ES INCLUSIVO AQUÍ. Una cita de 18:00 a 19:00 en una clínica
 * que atiende hasta las 19:00 termina justo al cerrar y no tiene nada de raro;
 * con la regla del inicio (`hhmm < fin`) saltaría el aviso en TODAS las citas
 * de última hora, y un aviso que salta siempre se aprende a despachar sin
 * leerlo — que es peor que no tenerlo.
 *
 * Devuelve `null` en un día no atendido: de eso ya avisa la hora de inicio, y
 * dos ventanas seguidas para el mismo error son una de más.
 */
export function avisoFinFueraDeHorario(fin: Date, h: Horario): string | null {
  const dia = DIAS.find(d => d.fc === fin.getDay())
  if (!dia) return null
  const horarioDia = h[dia.key]
  if (!horarioDia?.activo) return null
  const hhmm = horaDeReloj(fin)
  if (hhmm > horarioDia.inicio && hhmm <= horarioDia.fin) return null
  /* «Terminaría» y no «La cita terminaría»: esto lo disparan también el modal de
     un EVENTO genérico y el redimensionado de su tarjeta, y ahí «la cita» nombra
     algo que no existe. Sin sujeto la frase vale para los dos y no hace falta
     pasarle el tipo de fila, que este ayudante no tiene ni necesita. */
  return `Terminaría a las ${hhmm}, y esta clínica atiende de ${horarioDia.inicio} a ${horarioDia.fin}. ¿Es correcto?`
}

/**
 * El aviso de DÍA CERRADO, sin mencionar ninguna hora.
 *
 * Existe porque la vista Mes abre el alta SIN HORA (`ModalState`, `hora: null`),
 * y `avisoFueraDeHorario` no sirve ahí: su mensaje interpola la hora en las dos
 * ramas, así que soltaría «vas a agendar a las 00:00 del domingo» — justo el
 * dato inventado que se quiso quitar de esa ruta.
 *
 * ⚠️ NO LO FUSIONES CON `avisoFueraDeHorario` NI LA TOQUES A ELLA PARA
 * REUTILIZARLA. Esa función la usan `handleSelect` y las vistas de rejilla, con
 * una hora real y un mensaje que la nombra a propósito; ahí funciona bien.
 * Aquí la pregunta es OTRA —¿se atiende este día?— y por eso son dos.
 *
 * ⚠️ Y AQUÍ VIVÍA `horaDeAperturaDelDia`, QUE SE RETIRÓ: subía el clic del mes
 * a la hora de apertura para que el aviso no saltara siempre. Ya no hace falta
 * suponer ninguna hora, porque la ruta del mes no pone hora en absoluto. Si
 * vuelves a necesitar una hora por defecto para el mes, léete antes por qué se
 * quitó: inventarla hacía que el médico viera «07:00» donde quería las 10:00 y
 * cancelara creyendo que el sistema le había entendido mal.
 */
export function avisoDiaCerrado(date: Date, h: Horario): string | null {
  const dia = DIAS.find(d => d.fc === date.getDay())
  if (!dia || h[dia.key]?.activo) return null
  return `Vas a agendar un ${dia.label.toLowerCase()}, y esta clínica no atiende ${dia.plural}. ¿Es correcto?`
}

