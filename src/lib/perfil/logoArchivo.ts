/**
 * El criterio de aceptación del logo de la clínica, en UN solo sitio.
 *
 * MÓDULO NEUTRO —sin `'use client'` y sin dependencias de React—, igual que
 * `src/lib/consultorios/zonas-mexico.ts`: lo importan la ruta de servidor
 * (`api/me/logo`) y dos pantallas de cliente (el onboarding y Mi Perfil).
 *
 * ⚠️ POR QUÉ VIVE AQUÍ Y NO DUPLICADO EN CADA SITIO — Y POR QUÉ EXPORTA EL
 * MENSAJE Y NO SOLO LOS NÚMEROS. La comprobación del navegador existe para que
 * el médico se entere al ELEGIR el archivo y no tres pasos después, al subirlo.
 * Eso solo funciona si las dos comprobaciones dicen LO MISMO: si el navegador
 * rechaza por un motivo y el servidor por otro, o con otro texto, el médico
 * recibe dos explicaciones distintas del mismo hecho y deja de fiarse de las
 * dos. Compartir solo las constantes no lo garantiza —el texto se redacta
 * aparte en cada sitio y diverge—; por eso lo que se comparte es el veredicto
 * COMPLETO, mensaje incluido.
 *
 * Ya había divergido: el onboarding rechazaba a los 2 MB y el servidor a los
 * 500 KB, así que un logo de 1 MB pasaba la vista previa, se daba por bueno y
 * se estrellaba al subir.
 *
 * ⚠️ LA COMPROBACIÓN DEL SERVIDOR NO SE VA A NINGUNA PARTE. Ésta es comodidad,
 * no seguridad: cualquiera puede hacer el POST sin pasar por la pantalla. La de
 * `api/me/logo` es la que manda y la que decide de verdad.
 *
 * Aquí NO se cambia qué se acepta: extensiones y tope son los que ya aplicaba
 * la ruta.
 */

export const LOGO_EXTENSIONES = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const

export const LOGO_MAX_BYTES = 500 * 1024

/** Para el atributo `accept` de los dos `<input type="file">`. */
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg'

/** Lo mínimo de un `File` que hace falta para juzgarlo. */
export interface ArchivoJuzgable {
  name: string
  size: number
}

export type VeredictoLogo =
  | { ok: true; ext: string }
  | { ok: false; error: string }

function extensionDe(nombre: string): string | null {
  const ext = nombre.split('.').pop()?.toLowerCase()
  // Un nombre sin punto devuelve el nombre entero, que no es una extensión.
  if (!ext || !nombre.includes('.')) return null
  return ext
}

/**
 * El criterio, y en este orden: primero el tamaño y después el formato. El
 * orden importa porque un archivo que falla los dos tiene que dar el MISMO
 * mensaje en el navegador y en el servidor.
 */
export function revisarLogo(archivo: ArchivoJuzgable): VeredictoLogo {
  if (archivo.size > LOGO_MAX_BYTES) {
    return { ok: false, error: 'El logo no debe superar 500 KB. Sube una imagen más pequeña.' }
  }

  /* El formato se juzga por la EXTENSIÓN del nombre, así que el mensaje la
     nombra: un archivo sin extensión y uno en .heic se rechazan igual, y sin
     decirlo el médico no sabe cuál de las dos cosas le pasó. */
  const ext = extensionDe(archivo.name)
  if (!ext) {
    return {
      ok: false,
      error: 'El archivo no tiene extensión, así que no sabemos qué formato es. Usa un PNG, JPG, WEBP o SVG.',
    }
  }
  if (!(LOGO_EXTENSIONES as readonly string[]).includes(ext)) {
    return { ok: false, error: `No aceptamos archivos .${ext} como logo. Usa PNG, JPG, WEBP o SVG.` }
  }

  return { ok: true, ext }
}
