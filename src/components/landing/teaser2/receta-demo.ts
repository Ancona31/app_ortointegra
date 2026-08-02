/**
 * Datos de la receta de demostración del Teaser 2 (§5.7) y de `/demo/receta`.
 *
 * ⚠️ TODO ES FICTICIO Y ESTÁ CONFIRMADO POR ANGEL (orden de F3). Cero PII:
 * ninguna de estas personas existe. Los DOS consumidores —la hoja de la landing
 * y la página de verificación de demo— leen de aquí para no poder divergir: si
 * alguien edita un medicamento en un sitio y no en el otro, el visitante que
 * escanee el QR ve una receta distinta de la que acaba de firmar.
 *
 * ⚠️ ACENTOS: se escriben correctos, carácter a carácter. La cuenta demo del
 * VIDEO del expediente escribe "Ana Gomez Sanchez" SIN acentos (verificado en
 * el primer fotograma, `public/landing/expediente-demo-poster.jpg`); aquí va
 * acentuado porque es lo que dice la orden y porque en el demo controlamos cada
 * carácter. El desajuste es de la cuenta demo, no de este archivo, y está
 * levantado como deuda — no lo "arregles" desacentuando esto.
 */

/** Nombre completo. Recupera el hilo narrativo con el video de Expediente. */
export const PACIENTE = 'Ana Gómez Sánchez'

/**
 * Iniciales para la página de verificación. §5.7 + la política de minimización
 * pendiente: quien escanea un QR no necesita el nombre completo del paciente.
 * Se escriben a mano y NO se derivan de `PACIENTE` con un `split`, porque un
 * apellido compuesto ("de la Vega") rompe cualquier derivación automática y el
 * fallo sería silencioso.
 */
export const PACIENTE_INICIALES = 'A. G. S.'

export const EDAD = '27 años'
export const SEXO = 'Femenino'
/**
 * Fecha LITERAL, nunca `new Date()`. Una fecha calculada en render se resuelve
 * distinta en el servidor y en el cliente (zona horaria, y el propio paso del
 * tiempo entre las dos) y eso es hydration mismatch garantizado en una landing
 * estática. Coincide con la fecha de ingreso que se ve en el video.
 */
export const FECHA = '1 de agosto de 2026'
export const FECHA_EMISION = '1 de agosto de 2026, 10:24 a. m.'

/**
 * Diagnóstico con su clave CIE-10. Se muestra en la HOJA (que es lo que el
 * médico imprime) y NO en `/demo/receta` — ver el aviso de minimización de esa
 * página.
 */
export const DIAGNOSTICO = 'M54.4 · Lumbago con radiculopatía'

/**
 * Folio en el formato real (`R-` + 12 caracteres, `RecetaForm.tsx:246`), pero
 * imposible de confundir con uno auténtico: los reales salen de un slice
 * hexadecimal de `crypto.randomUUID()`, y "m" y "o" NO son dígitos
 * hexadecimales. Ningún folio real puede contener "demo".
 */
export const FOLIO = 'R-demo00000001'

export interface MedicamentoDemo {
  nombre: string
  presentacion: string
  principio: string
  via: string
  indicacion: string
}

/**
 * Los 3 medicamentos que Angel confirmó. §9·3 del maestro pedía 4 y la ficha
 * §5.7 dibujaba "índice 0→4"; llegaron 3 y con 3 se implementa — la
 * coreografía escalona lo que haya, no un número fijo.
 */
export const MEDICAMENTOS: readonly MedicamentoDemo[] = [
  {
    nombre: 'CELECOXIB',
    presentacion: 'Cápsulas 200 mg',
    principio: 'Celecoxib',
    via: 'Oral',
    indicacion: 'Tomar 1 cápsula cada 24 hrs por 10 días.',
  },
  {
    nombre: 'PREGABALINA',
    presentacion: 'Cápsulas 75 mg',
    principio: 'Pregabalina',
    via: 'Oral',
    indicacion: 'Tomar 1 cápsula cada 24 hrs por 30 días.',
  },
  {
    nombre: 'PARACETAMOL',
    presentacion: 'Tabletas 1 g',
    principio: 'Paracetamol',
    via: 'Oral',
    indicacion: 'Tomar 1 tableta cada 8 hrs por 10 días.',
  },
]

/**
 * Médico del membrete: el MISMO de la cuenta demo que aparece en el video
 * (ahí, otra vez, sin acentos), con su especialidad.
 *
 * ⚠️ LAS CÉDULAS SON CEROS A PROPÓSITO Y NO SON UN PENDIENTE. Esto es una
 * receta falsa de cara al público: llevarla firmada con una cédula real —de
 * Angel o de quien sea— pone un número de licencia profesional auténtico en un
 * documento inventado, que es exactamente lo que no debe circular. La SEP no
 * emite la cédula 0000000, así que el hueco se lee como lo que es. Si Angel
 * quiere las suyas, es decisión suya y consciente, no un arreglo.
 */
export const MEDICO = {
  nombre: 'Dr. Ángel Pérez',
  especialidad: 'Cirugía de Columna',
  cedulaProfesional: '0000000',
  cedulaEspecialidad: '0000000',
  consultorio: 'Av. Reforma 100, Mérida, Yucatán · Tel: 999 000 0000',
} as const

export interface PaletaReceta {
  id: string
  nombre: string
  /** Barra superior, "Rx", encabezado de tabla, barras de sección, barra inf. */
  navy: string
  /** Acento: número de medicamento, vía, filetes finos. */
  acento: string
}

/**
 * Las 3 paletas de los swatches (§5.7).
 *
 * ⚠️ CONTRASTE VERIFICADO ANTES DE FIJARLAS, que es lo que pedía la orden.
 * Texto blanco sobre cada navy (fórmula WCAG 2.x, luminancia relativa):
 *   · Spinus #1a3a5c → L 0.0402 → **11.64:1**
 *   · Bosque #14432f → L 0.0437 → **11.21:1**
 *   · Vino   #4a1d2e → L 0.0253 → **13.94:1**
 * Las tres pasan AAA (7:1) para cualquier tamaño. Los acentos van sobre blanco
 * y solo visten texto grande ("Rx", 34px) o rótulos secundarios:
 *   · #1e5fa8 → 6.10:1 · #1d7a52 → 5.31:1 · #9c3352 → 6.98:1
 * Las tres pasan AA normal (4.5) y AA grande (3) con margen. **Si alguien
 * cambia un hex, hay que rehacer estas seis cuentas** — no es decoración, es la
 * legibilidad de un documento clínico.
 */
export const PALETAS: readonly PaletaReceta[] = [
  { id: 'spinus', nombre: 'Spinus', navy: '#1a3a5c', acento: '#1e5fa8' },
  { id: 'bosque', nombre: 'Bosque', navy: '#14432f', acento: '#1d7a52' },
  { id: 'vino', nombre: 'Vino', navy: '#4a1d2e', acento: '#9c3352' },
]

/**
 * Los otros 7 formatos ("y estos 7 más", §5.7). NO es una lista de marketing:
 * son exactamente los 7 formularios que hay junto a la receta en
 * `src/components/documentos/` — Consentimiento, Escrito médico, Honorarios,
 * Suplementación, Imagen, Internamiento y Laboratorio. Receta + estos 7 = los 8
 * documentos que el producto emite hoy. Si se añade un octavo formulario, esta
 * lista y el copy "7 más" se quedan cortos a la vez.
 */
export const FORMATOS: readonly string[] = [
  'Consentimiento informado',
  'Escrito médico',
  'Nota de honorarios',
  'Plan de suplementación',
  'Solicitud de imagen',
  'Solicitud de internamiento',
  'Solicitud de laboratorio',
]
