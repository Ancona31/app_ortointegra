/**
 * correosReserva.ts — las plantillas de los correos de la reserva por enlace
 * (agenda D5 y D8). Puro: devuelve asunto, texto y HTML; quien llama los manda
 * por `src/lib/correo/transporte.ts`.
 *
 * ⚠️ TODO VALOR VA ESCAPADO (`escapeHtml`): el nombre lo escribe quien
 * reserva. ⚠️ NADA CLÍNICO: ni el tipo de cita (lista A, 10: puede revelar el
 * padecimiento), ni notas, ni motivo. El nombre de la clínica tampoco (lista
 * A, 24): va el médico, el consultorio, su dirección y su teléfono.
 */
import { escapeHtml } from '@/lib/htmlEscape'

export interface CorreoListo { asunto: string; texto: string; html: string }

function envolver(parrafos: string[]): string {
  const cuerpo = parrafos.map(p => `<p style="margin:0 0 12px">${p}</p>`).join('')
  return `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#1a2b3c;line-height:1.5">${cuerpo}</body></html>`
}

/** El código de 6 dígitos para verificar el correo antes de reservar. */
export function correoCodigo(medico: string, codigo: string): CorreoListo {
  const asunto = `Tu código para reservar: ${codigo}`
  const texto = `Tu código para reservar con ${medico} es ${codigo}. Vence en 10 minutos.\n\nSi no lo pediste, ignora este correo.`
  const html = envolver([
    `Tu código para reservar con ${escapeHtml(medico)} es <strong style="font-size:20px;letter-spacing:2px">${escapeHtml(codigo)}</strong>.`,
    'Vence en 10 minutos.',
    'Si no lo pediste, ignora este correo.',
  ])
  return { asunto, texto, html }
}
