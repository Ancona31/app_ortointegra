/**
 * correosReserva.ts — los correos de la reserva por enlace (agenda D5 y D8): el
 * CÓDIGO para verificar el correo y el COMPROBANTE de la cita. Puro: devuelve
 * asunto, texto y HTML; quien llama los manda por `src/lib/correo/transporte.ts`.
 *
 * Tanda M (M5, puntos 10 y 11): el código sigue la maqueta
 * `docs/spec/correo-codigo-reserva.html` y el comprobante
 * `docs/spec/correo-cita-paciente.html`, armados por `plantillaCita.ts`. Los
 * asuntos y los enlaces NO cambiaron.
 *
 * ⚠️ TODO VALOR VA ESCAPADO (lo hace la plantilla): el nombre lo escribe quien
 * reserva. ⚠️ NADA CLÍNICO: ni el tipo de cita (lista A, 10: puede revelar el
 * padecimiento), ni notas, ni motivo. El nombre de la clínica tampoco (lista
 * A, 24): va el médico, el consultorio, su dirección y su teléfono. El nombre
 * del paciente sí (el que escribió), en el saludo y en «Paciente».
 */
import { fechaDeCorreo, htmlCorreoCita, textoCorreoCita, urlSegura, type BloqueCorreo, type CorreoArmado } from '@/lib/correo/plantillaCita'
import { saludoDe } from '@/lib/confirmacion/correosCita'

/** `remitente`: el NOMBRE con que sale (el del médico, tanda I punto 21); la dirección no cambia (`transporte.ts`). */
export interface CorreoListo { asunto: string; texto: string; html: string; remitente: string }

/** Lo que dura el código (`reserva_verificaciones`, D5). */
const VIGENCIA_CODIGO = '10 minutos'

/**
 * El código de 6 dígitos para verificar el correo antes de reservar. A nombre
 * del médico, con el consultorio elegido encima si se sabe (I21). M5 (punto
 * 10): el código va SIN espacios, en el cuerpo y en la vista previa, para que
 * se copie entero; «Continuar mi reserva» abre la página con el código en el
 * fragmento (K2, la URL la arma la ruta).
 */
export function correoCodigo(
  medico: string, codigo: string, opciones: { consultorio?: string | null; url?: string | null } = {},
): CorreoListo {
  const url = urlSegura(opciones.url)
  const armado: CorreoArmado = {
    marca: { medico, consultorio: opciones.consultorio ?? null },
    preencabezado: `Tu código es ${codigo}. Vence en ${VIGENCIA_CODIGO}.`,
    titulo: 'Tu código para reservar',
    bloques: [
      { tipo: 'entrada', encabezado: 'Tu código para reservar', parrafos: ['Escribe este código en la página de reserva para continuar con tu cita.'] },
      { tipo: 'codigo', codigo, vigencia: VIGENCIA_CODIGO },
      ...(url ? [{
        tipo: 'botones', arriba: 24, botones: [{ texto: 'Continuar mi reserva', url }],
        nota: ['¿Cerraste la página? Este botón te regresa a tu reserva.'],
        enTexto: [`Continuar mi reserva: ${url}`, '¿Cerraste la página? Este enlace te regresa a tu reserva.'],
      } satisfies BloqueCorreo] : []),
      { tipo: 'aviso', raya: true, lineas: ['No compartas este código con nadie; el consultorio nunca te lo pedirá.', 'Si no lo solicitaste, ignora este correo.'] },
    ],
  }
  return { asunto: `Tu código para reservar: ${codigo}`, texto: textoCorreoCita(armado), html: htmlCorreoCita(armado), remitente: medico }
}

export interface DatosComprobante {
  medico: string
  consultorio: string
  direccion: string | null
  telefono: string | null
  /** Instante de inicio (ISO) y la zona IANA del consultorio. */
  inicio: string
  zona: string
  /** El nombre que escribió quien reservó (saludo y fila «Paciente»); null = «Hola:» y sin la fila. */
  paciente?: string | null
  /** El enlace de confirmación de la cita (agenda E5), o null/ausente si no se pudo emitir. */
  urlConfirmacion?: string | null
}

/** «lunes 16 de noviembre de 2026, 10:30 h» en la zona del consultorio (lo usan la página y la vista de confirmación). */
export function fechaHoraEnZona(inicio: string, zona: string): string {
  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: zona })
    .format(new Date(inicio))
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona })
    .format(new Date(inicio))
  return `${fecha}, ${hora} h`
}

/** «Para tu consulta», TAL COMO VIENE en la maqueta (punto 11). Genérico: nada de la cita ni del paciente. */
const PARA_TU_CONSULTA = [
  'Llega 10 minutos antes de tu hora.',
  'Trae una identificación oficial.',
  'Si tienes estudios previos (radiografías, resonancias, análisis) o recetas de tus medicamentos actuales, tráelos.',
]

function bloquesComprobante(d: DatosComprobante, url: string | null, paciente: string | null): BloqueCorreo[] {
  return [
    { tipo: 'entrada', pildora: { texto: 'Cita agendada', hecho: true }, encabezado: saludoDe(paciente) ?? 'Hola:',
      parrafos: ['Tu cita quedó registrada. Aquí tienes los datos para que la tengas a la mano.'] },
    { tipo: 'fecha', fecha: fechaDeCorreo(d.inicio, d.zona) },
    { tipo: 'datos', filas: [
      { etiqueta: 'Médico', valor: d.medico }, { etiqueta: 'Consultorio', valor: d.consultorio },
      { etiqueta: 'Dirección', valor: d.direccion }, { etiqueta: 'Paciente', valor: paciente },
    ] },
    url
      ? { tipo: 'botones', antes: 'Para confirmar tu asistencia o avisar que no podrás ir, usa este enlace:',
        botones: [{ texto: 'Confirmar o cancelar mi cita', url }],
        enTexto: ['Para confirmar tu asistencia o avisar que no podrás ir, usa este enlace:', url] }
      : { tipo: 'botones', antes: 'Para cambiar o cancelar, comunícate con el consultorio.', botones: [] },
    { tipo: 'lista', titulo: 'Para tu consulta', puntos: PARA_TU_CONSULTA },
    { tipo: 'recuadro', fuerte: '¿No puedes asistir?', texto: 'Avísanos con anticipación para darle el espacio a otro paciente.',
      llamada: { frase: 'Llámanos o escríbenos al', telefono: d.telefono } },
  ]
}

/**
 * El comprobante (D8, M5 punto 11): la píldora dice «Cita agendada», no
 * «confirmada» (aún no lo está). Fecha y hora en la zona del consultorio,
 * médico, consultorio, dirección y el nombre del paciente. Con el enlace de
 * confirmación (E5) lleva el botón de siempre a ese enlace, tal cual; sin
 * enlace, «comunícate con el consultorio» (D8). SIN tipo de cita, sin la
 * clínica y sin datos clínicos.
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN (lista B 12 de plan_E). Determinista: nada
 * de «ahora» en el cuerpo (E4 lo manda con llave de idempotencia).
 */
export function correoComprobante(d: DatosComprobante): CorreoListo {
  const url = urlSegura(d.urlConfirmacion)
  const paciente = d.paciente?.replace(/\s+/g, ' ').trim() || null
  const f = fechaDeCorreo(d.inicio, d.zona)
  const armado: CorreoArmado = {
    marca: { medico: d.medico, consultorio: d.consultorio },
    preencabezado: `Tu cita con ${d.medico} es el ${f.completa} a las ${f.hora}.`,
    titulo: 'Cita agendada',
    bloques: bloquesComprobante(d, url, paciente),
  }
  return { asunto: `Tu cita con ${d.medico}`, texto: textoCorreoCita(armado), html: htmlCorreoCita(armado), remitente: d.medico }
}
