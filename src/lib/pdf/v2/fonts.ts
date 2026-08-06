/**
 * Sistema de documentos v2 — registro de tipografías.
 *
 * ANDAMIAJE INERTE (Paso 0.a). Nadie importa este módulo todavía.
 *
 * PROCEDENCIA DE LOS TTF
 * Los cinco archivos en `public/fonts/` se obtuvieron de la API de CSS de
 * Google Fonts, que sirve los binarios desde `fonts.gstatic.com`. Esas URLs
 * incluyen un hash de versión y CADUCAN en cuanto Google publica una revisión
 * de la fuente: no sirven como referencia estable. Si algún día hay que
 * reponer un archivo, hay que volver a pedir el CSS a la API y leer la URL
 * vigente de ahí. Por eso los TTF quedan versionados en el repo y no se
 * descargan en build time.
 *
 * TRES RESTRICCIONES QUE NO SE NEGOCIAN
 *
 * a. Se cargan por URL desde `/fonts/`, NUNCA en Base64. `src/lib/pdf/fonts.ts`
 *    ya arrastra 2.7 MB de Roboto embebido que hoy quedan inertes en el bundle;
 *    v2 no repite ese patrón.
 *
 * Y UNA CUARTA COSA QUE ESTE MÓDULO HACE ADEMÁS DE REGISTRAR FUENTES:
 * desactivar la hifenación. Ver la nota larga junto a la llamada.
 * b. Este módulo NO importa nada de `src/lib/pdf/PdfStyles.tsx` ni de
 *    `src/lib/pdf/fonts.ts`, ni al revés. v1 registra Roboto por dos vías
 *    distintas (filesystem en servidor, URL en cliente); v2 no hereda ese
 *    enredo. La única dependencia compartida es `@react-pdf/renderer`.
 * c. El registro es idempotente y NO ocurre como efecto de módulo de
 *    top-level: hay que llamar a `registrarFuentesV2()` explícitamente.
 *
 * NOTA SOBRE ENTORNO: las rutas `/fonts/...` son relativas al origen, así que
 * este registro asume render en el CLIENTE, que es donde vive hoy toda la
 * generación de PDF (`src/lib/mobileShare.ts`). Si alguna vez se renderiza v2
 * en el servidor, estas rutas no resuelven y habrá que resolver el archivo por
 * filesystem o por URL absoluta.
 */

import { Font } from '@react-pdf/renderer'

/** Latch de idempotencia: el registro corre una sola vez por vida del módulo. */
let registrado = false

/**
 * Registra las tipografías de v2 en @react-pdf/renderer.
 * Segura de llamar tantas veces como haga falta: solo la primera hace trabajo.
 */
export function registrarFuentesV2(): void {
  if (registrado) return
  registrado = true

  /**
   * HIFENACIÓN DESACTIVADA (I.3.8). No es una preferencia tipográfica.
   *
   * react-pdf parte palabras con guion por defecto: en el taller salió
   * `RECOMEN-DACIONES`. Su algoritmo además corrompe caracteres acentuados, que
   * es la razón por la que v1 ya lo desactiva en dos sitios
   * (`PdfStyles.tsx` y `pdfClientFallback.ts`) con este mismo callback.
   *
   * EL MOTIVO QUE OBLIGA, Y QUE NO ES ESTÉTICO: si no se desactiva, la
   * denominación genérica de una receta puede salir partida con guion. Es el
   * único campo obligatorio por normativa y tiene que ser legible por máquina en
   * el gate de extracción de texto del Paso 3 (I.3.1). `RECOMEN-DACIONES` es
   * feo; `AMOXICI-LINA` es un problema legal.
   *
   * El callback es GLOBAL al renderer, no por familia: una sola llamada cubre
   * las dos familias y cualquier otra que se registre después. Que v1 lo llame
   * también no es un conflicto —los dos registran exactamente la misma función
   * identidad—, pero v2 no depende de que v1 se haya cargado: la restricción (b)
   * de la cabecera sigue en pie.
   */
  Font.registerHyphenationCallback((palabra) => [palabra])

  Font.register({
    family: 'Archivo',
    fonts: [
      { src: '/fonts/Archivo-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/Archivo-Medium.ttf', fontWeight: 500 },
      { src: '/fonts/Archivo-SemiBold.ttf', fontWeight: 600 },
    ],
  })

  Font.register({
    family: 'IBM Plex Sans',
    fonts: [
      { src: '/fonts/IBMPlexSans-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/IBMPlexSans-Medium.ttf', fontWeight: 500 },
    ],
  })
}
