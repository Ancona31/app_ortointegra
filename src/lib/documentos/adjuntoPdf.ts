import type { SupabaseClient } from '@supabase/supabase-js'

/* ═══ EL ARCHIVO QUE SE ADJUNTA ═══
   Módulo NEUTRO, como `correoPaciente.ts`: no sabe de correo ni de Resend.
   Devuelve bytes y un nombre de archivo, y quien lo transporta decide qué hacer
   con ellos.

   ⚠️ ESTÁ SEPARADO DEL CORREO PORQUE WHATSAPP VIENE DESPUÉS, y ahí se manda el
   MISMO archivo. Si esto se hubiera escrito dentro de la ruta de correo, el
   segundo canal habría empezado copiándola.

   ⚠️⚠️ SE ADJUNTA EL PDF GUARDADO, NUNCA UNO RECOMPUESTO. El documento se
   renderiza UNA vez, al emitirlo, y se sube a Storage; `documentos.pdf_url`
   guarda su ruta dentro del bucket. Ese objeto es exactamente el papel que el
   paciente tiene en la mano y exactamente lo que la página `/r/[folio]`
   respalda. Volver a componerlo aquí —con otra versión del formato, otro perfil
   del médico o otro logo— produciría un archivo que NO es el que se emitió, y
   entonces el cotejo contra el papel dejaría de significar nada.

   Por eso este módulo solo DESCARGA. Si algún día ves aquí un `generarPdf`, la
   garantía se rompió. */

/** Donde viven los PDF de los documentos. Ruta interna: `<pacienteId>/<archivo>.pdf`. */
export const BUCKET_DOCUMENTOS_PDF = 'documentos-pdf'

export interface AdjuntoPdf {
  readonly nombre: string
  readonly contenido: Buffer
}

/**
 * El PDF emitido de un documento, listo para adjuntar.
 *
 * Devuelve `null` —y no lanza— cuando no hay nada que adjuntar: la fila puede no
 * tener `pdf_url` (subida fallida al emitir, o documento histórico anterior a
 * Storage) y el objeto puede haber desaparecido del bucket. Quien llama decide
 * qué contarle al médico; lo que NO puede pasar es mandar el mensaje sin el
 * archivo, porque el mensaje entero habla de un adjunto que no llegaría.
 */
export async function descargarPdfEmitido(
  supabase: SupabaseClient,
  pdfUrl: string | null | undefined,
  nombre: string,
): Promise<AdjuntoPdf | null> {
  if (typeof pdfUrl !== 'string' || pdfUrl.trim() === '') return null

  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS_PDF)
    .download(pdfUrl)

  if (error !== null || data === null) return null

  const contenido = Buffer.from(await data.arrayBuffer())
  if (contenido.byteLength === 0) return null

  return { nombre, contenido }
}
