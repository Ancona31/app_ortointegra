/* ═══ EL MENSAJE CON QUE UN DOCUMENTO LLEGA AL PACIENTE ═══
   Módulo NEUTRO: no sabe de correo, de Resend ni de HTML. Devuelve un asunto y
   unos párrafos de texto llano, y quien los transporta decide cómo pintarlos.

   ⚠️ ESTÁ ASÍ A PROPÓSITO, PORQUE WHATSAPP VIENE DESPUÉS. Ahí se manda el mismo
   archivo con el mismo mensaje, y no habrá asunto ni etiquetas. Si algún día ves
   una etiqueta HTML o una dirección de correo dentro de este archivo, el módulo
   dejó de servir para el segundo canal y hay que sacarla.

   ⚠️⚠️ NINGÚN DATO CLÍNICO SALE DE AQUÍ, NI EN EL ASUNTO NI EN EL CUERPO. Ni
   diagnóstico, ni medicamentos, ni estudios, ni el motivo de un internamiento.
   Todo eso viaja DENTRO del PDF adjunto. La razón es que un correo no viaja
   cifrado de extremo a extremo de forma garantizada, y el asunto además se lee
   en la lista del buzón sin abrir nada — encima del hombro, en la pantalla de
   bloqueo o en la notificación del reloj.

   El TIPO de documento sí va en el asunto, y es una decisión tomada: sin él, el
   paciente no sabe qué le llegó ni puede encontrarlo después. Es también el
   único dato que el propio interesado ya conoce, porque acaba de salir de la
   consulta con el papel en la mano.

   ── LOS CUATRO GRUPOS ───────────────────────────────────────────────────────
   No son nueve mensajes ni es uno solo: son cuatro, agrupados por LO QUE EL
   PACIENTE TIENE QUE HACER con el documento.

     1 · Receta                          → llevarla impresa a la farmacia
     2 · Lab, Imagen, Suplementación,
         Internamiento, Escrito médico   → seguir las indicaciones de la consulta
     3 · Consentimiento y Denegación     → conservarlo y preguntar dudas
     4 · Honorarios y Cotización         → tratar el cobro con el médico

   ⚠️ EL GRUPO 1 ES EL QUE NO PUEDE FALLAR. Una receta que llega por correo y se
   queda en el teléfono no surte nada: la farmacia necesita el papel. Si alguien
   recorta ese párrafo por brevedad, el correo deja de servir para lo único que
   tiene que servir. */

/** Un mensaje listo para cualquier canal. Los párrafos ya van en orden. */
export interface MensajePaciente {
  readonly asunto: string
  readonly parrafos: readonly string[]
}

/**
 * Cómo se llama el documento de cara al paciente.
 *
 * ⚠️ HONORARIOS Y COTIZACIÓN COMPARTEN `tipo` Y NO COMPARTEN NOMBRE. Los dos son
 * `nota_honorarios`; lo que los distingue es la SERIE DEL FOLIO —`COT-…` contra
 * `NOH-…`—, igual que en la página de verificación. Sin mirar el folio, a quien
 * pide un presupuesto le llegaría un «recibo» que no ha pagado.
 */
export function etiquetaDocumento(tipo: string, folio: string | null): string {
  if (tipo === 'nota_honorarios') {
    return folio?.startsWith('COT-') === true ? 'cotización' : 'recibo de honorarios'
  }
  const porTipo: Record<string, string> = {
    receta: 'receta médica',
    solicitud_lab: 'solicitud de laboratorio',
    solicitud_imagen: 'solicitud de imagenología',
    plan_suplementacion: 'plan de suplementación',
    solicitud_internamiento: 'solicitud de internamiento',
    escrito_medico: 'escrito médico',
    consentimiento_informado: 'consentimiento informado',
    denegacion_consentimiento: 'denegación de consentimiento',
    informe_clinico: 'informe clínico',
  }
  return porTipo[tipo] ?? 'documento clínico'
}

/** `receta médica` → `Receta médica`. Solo la primera letra; el resto se queda. */
function conMayusculaInicial(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Los cinco que comparten el mensaje del grupo 2. Ver la cabecera. */
const GRUPO_INDICACIONES = new Set([
  'solicitud_lab',
  'solicitud_imagen',
  'plan_suplementacion',
  'solicitud_internamiento',
  'informe_clinico',
])

const GRUPO_CONSENTIMIENTO = new Set([
  'consentimiento_informado',
  'denegacion_consentimiento',
])

/**
 * El mensaje con que este documento llega a su paciente.
 *
 * `medicoNombre` va en el asunto porque el paciente recibe el documento DE SU
 * MÉDICO, no de una plataforma: es lo que hace que abra el correo en vez de
 * tomarlo por publicidad.
 */
export function mensajeParaPaciente(
  tipo: string,
  folio: string | null,
  medicoNombre: string,
): MensajePaciente {
  const etiqueta = etiquetaDocumento(tipo, folio)
  const asunto = `Su ${etiqueta} · ${medicoNombre}`

  // ── 1 · RECETA ────────────────────────────────────────────────────────────
  if (tipo === 'receta') {
    return {
      asunto,
      parrafos: [
        'Adjunto a este correo encontrará su receta médica.',
        'Guárdela para tenerla siempre a la mano.',
        'Recuerde llevarla IMPRESA a la farmacia: para surtir sus medicamentos '
          + 'necesita entregar el papel, no basta con enseñar el archivo en el teléfono.',
        'Ante cualquier duda, comuníquese con su médico.',
      ],
    }
  }

  // ── 2 · INDICACIONES DE LA CONSULTA ───────────────────────────────────────
  if (GRUPO_INDICACIONES.has(tipo)) {
    return {
      asunto,
      parrafos: [
        `Aquí tiene su ${etiqueta}.`,
        'Por favor apéguese a las indicaciones que le dio su médico en la consulta.',
      ],
    }
  }

  /* El escrito médico es del grupo 2 por trámite, pero NO por texto: una carta,
     una constancia o un justificante no traen indicaciones a las que apegarse, y
     mandarle al paciente que siga unas que no existen lo deja buscándolas. Se
     queda con la primera frase del grupo y cambia la segunda. */
  if (tipo === 'escrito_medico') {
    return {
      asunto,
      parrafos: [
        'Aquí tiene su escrito médico.',
        'Consérvelo. Ante cualquier duda, comuníquese con su médico.',
      ],
    }
  }

  // ── 3 · CONSENTIMIENTO Y DENEGACIÓN ───────────────────────────────────────
  if (GRUPO_CONSENTIMIENTO.has(tipo)) {
    return {
      asunto,
      parrafos: [
        `Adjunto a este correo encontrará su ${etiqueta}.`,
        'Para cualquier duda o información adicional, comuníquese con su médico.',
      ],
    }
  }

  // ── 4 · HONORARIOS Y COTIZACIÓN ───────────────────────────────────────────
  if (tipo === 'nota_honorarios') {
    return {
      asunto,
      parrafos: [
        `Adjunto a este correo encontrará su ${etiqueta}.`,
        'Cualquier duda sobre este documento, trátela directamente con su médico.',
      ],
    }
  }

  /* Un tipo que no conocemos cae en el mensaje más neutro que existe, y NUNCA en
     uno que afirme algo del documento: si mañana se abre un décimo formato, lo
     peor sería que saliera con el texto de la receta. */
  return {
    asunto,
    parrafos: [
      `Adjunto a este correo encontrará su ${etiqueta}.`,
      'Ante cualquier duda, comuníquese con su médico.',
    ],
  }
}

/** El nombre del archivo adjunto: `Receta medica RX-2026-0020.pdf`. */
export function nombreArchivoAdjunto(tipo: string, folio: string | null): string {
  const etiqueta = conMayusculaInicial(etiquetaDocumento(tipo, folio))
  /* Sin acentos ni signos: los clientes de correo y los sistemas de archivos de
     destino no los tratan igual, y un adjunto que no se puede guardar es un
     adjunto perdido. El folio va tal cual — ya es A-Z, dígitos y guiones. */
  const limpio = etiqueta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
  return folio !== null ? `${limpio} ${folio}.pdf` : `${limpio}.pdf`
}
