/**
 * QR del Teaser 2 — GENERADO, NO SE EDITA A MANO.
 *
 * Codifica https://www.spinus.com.mx/demo/receta en nivel de corrección M
 * (versión 3, 29×29 módulos, 441 oscuros) con un margen
 * silencioso de 4 módulos ya incluido en el viewBox.
 *
 * ⚠️ SE GENERA CON EL PAQUETE `qrcode`, QUE YA ES DEPENDENCIA DEL PROYECTO
 * (lo usa la receta real). §12 prohíbe librerías de QR NUEVAS y prohíbe
 * generarlo en cliente; esto no es ni lo uno ni lo otro: es un artefacto
 * estático producido a mano una vez. Si cambia la URL hay que regenerar ESTE
 * archivo Y `public/demo/qr-receta-demo.svg` en la misma corrida — son el
 * mismo símbolo y desincronizarlos deja un QR que apunta a otro sitio del que
 * dice. El script vive en la nota de la tanda F3; son ~40 líneas con
 * `QRCode.create(URL, { errorCorrectionLevel: 'M' })` y el reparto en bandas
 * de abajo.
 *
 * Los módulos vienen repartidos en 8 BANDAS diagonales, y ese reparto ES la
 * coreografía de §5.7 ("módulos del QR, rects visibles 0→N"): cada banda es un
 * solo `<path>` cuya opacidad anima el scroll. Ocho nodos en el DOM en vez de
 * 441 `<rect>`, y ocho valores animados en vez de 441 — sin eso, el beat
 * del QR se come el presupuesto de §4.3·3 él solo.
 */

/** Lado del símbolo en módulos, margen silencioso incluido. */
export const QR_LADO = 37

/** Un `d` de `<path>` por banda, en orden de aparición. */
export const QR_BANDAS: readonly string[] = [
  'M4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM4 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM4 9h1v1h-1zM4 10h1v1h-1z',
  'M15 4h1v1h-1zM10 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM13 6h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM4 13h1v1h-1zM5 13h1v1h-1zM6 13h1v1h-1zM7 13h1v1h-1zM5 16h1v1h-1z',
  'M20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM23 4h1v1h-1zM19 5h1v1h-1zM21 5h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM15 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM21 7h1v1h-1zM15 8h1v1h-1zM17 8h1v1h-1zM20 8h1v1h-1zM13 9h1v1h-1zM14 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM10 12h1v1h-1zM15 12h1v1h-1zM9 13h1v1h-1zM12 13h1v1h-1zM14 13h1v1h-1zM9 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM9 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM6 16h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM12 16h1v1h-1zM5 17h1v1h-1zM6 17h1v1h-1zM8 17h1v1h-1zM11 17h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM7 18h1v1h-1zM8 18h1v1h-1zM9 18h1v1h-1zM10 18h1v1h-1zM9 19h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM4 21h1v1h-1zM6 21h1v1h-1zM4 22h1v1h-1zM4 23h1v1h-1zM4 24h1v1h-1z',
  'M26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM31 4h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM28 6h1v1h-1zM29 6h1v1h-1zM23 7h1v1h-1zM26 7h1v1h-1zM28 7h1v1h-1zM21 8h1v1h-1zM22 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM20 9h1v1h-1zM24 9h1v1h-1zM26 9h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM19 11h1v1h-1zM20 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM16 13h1v1h-1zM20 13h1v1h-1zM21 13h1v1h-1zM15 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM18 15h1v1h-1zM13 16h1v1h-1zM14 16h1v1h-1zM15 16h1v1h-1zM19 16h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM16 17h1v1h-1zM17 17h1v1h-1zM18 17h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM15 18h1v1h-1zM16 18h1v1h-1zM17 18h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM15 19h1v1h-1zM9 20h1v1h-1zM10 20h1v1h-1zM15 20h1v1h-1zM9 21h1v1h-1zM11 21h1v1h-1zM12 21h1v1h-1zM14 21h1v1h-1zM8 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM13 22h1v1h-1zM7 23h1v1h-1zM8 23h1v1h-1zM6 24h1v1h-1zM8 24h1v1h-1zM10 24h1v1h-1zM11 24h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM7 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM4 27h1v1h-1zM4 28h1v1h-1zM6 28h1v1h-1zM7 28h1v1h-1zM4 29h1v1h-1zM6 29h1v1h-1zM4 30h1v1h-1zM4 31h1v1h-1z',
  'M32 4h1v1h-1zM32 5h1v1h-1zM30 6h1v1h-1zM32 6h1v1h-1zM29 7h1v1h-1zM30 7h1v1h-1zM32 7h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM32 8h1v1h-1zM32 9h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM28 10h1v1h-1zM29 10h1v1h-1zM30 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM26 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM29 12h1v1h-1zM30 12h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM26 13h1v1h-1zM27 13h1v1h-1zM28 13h1v1h-1zM22 14h1v1h-1zM24 14h1v1h-1zM25 14h1v1h-1zM22 15h1v1h-1zM23 15h1v1h-1zM26 15h1v1h-1zM27 15h1v1h-1zM21 16h1v1h-1zM22 16h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM18 18h1v1h-1zM19 18h1v1h-1zM20 18h1v1h-1zM21 18h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1zM23 19h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM21 20h1v1h-1zM15 21h1v1h-1zM16 21h1v1h-1zM20 21h1v1h-1zM15 22h1v1h-1zM16 22h1v1h-1zM19 22h1v1h-1zM13 23h1v1h-1zM16 23h1v1h-1zM18 23h1v1h-1zM12 24h1v1h-1zM14 24h1v1h-1zM16 24h1v1h-1zM12 25h1v1h-1zM15 25h1v1h-1zM17 25h1v1h-1zM10 26h1v1h-1zM13 26h1v1h-1zM10 27h1v1h-1zM12 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h1v1h-1zM13 28h1v1h-1zM14 28h1v1h-1zM7 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM12 29h1v1h-1zM13 29h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM10 30h1v1h-1zM12 30h1v1h-1zM10 31h1v1h-1zM4 32h1v1h-1zM5 32h1v1h-1zM6 32h1v1h-1zM7 32h1v1h-1zM8 32h1v1h-1zM9 32h1v1h-1zM10 32h1v1h-1z',
  'M32 13h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM29 16h1v1h-1zM30 16h1v1h-1zM26 17h1v1h-1zM28 17h1v1h-1zM32 17h1v1h-1zM25 18h1v1h-1zM27 18h1v1h-1zM29 18h1v1h-1zM30 18h1v1h-1zM24 19h1v1h-1zM25 19h1v1h-1zM27 19h1v1h-1zM28 19h1v1h-1zM23 20h1v1h-1zM27 20h1v1h-1zM29 20h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM25 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM28 21h1v1h-1zM24 22h1v1h-1zM25 22h1v1h-1zM26 22h1v1h-1zM27 22h1v1h-1zM22 23h1v1h-1zM23 23h1v1h-1zM19 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM18 25h1v1h-1zM20 25h1v1h-1zM22 25h1v1h-1zM23 25h1v1h-1zM24 25h1v1h-1zM17 26h1v1h-1zM18 26h1v1h-1zM19 26h1v1h-1zM20 26h1v1h-1zM23 26h1v1h-1zM17 27h1v1h-1zM20 27h1v1h-1zM15 28h1v1h-1zM16 28h1v1h-1zM18 28h1v1h-1zM21 28h1v1h-1zM14 29h1v1h-1zM16 29h1v1h-1zM14 30h1v1h-1zM15 30h1v1h-1zM16 30h1v1h-1zM17 30h1v1h-1zM19 30h1v1h-1zM14 31h1v1h-1zM15 31h1v1h-1zM12 32h1v1h-1zM13 32h1v1h-1zM14 32h1v1h-1z',
  'M31 19h1v1h-1zM30 20h1v1h-1zM30 21h1v1h-1zM32 21h1v1h-1zM30 22h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM31 23h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM28 24h1v1h-1zM30 24h1v1h-1zM31 24h1v1h-1zM32 24h1v1h-1zM28 25h1v1h-1zM29 25h1v1h-1zM30 25h1v1h-1zM31 25h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM30 26h1v1h-1zM23 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM27 28h1v1h-1zM28 28h1v1h-1zM21 29h1v1h-1zM22 29h1v1h-1zM23 29h1v1h-1zM27 29h1v1h-1zM20 30h1v1h-1zM23 30h1v1h-1zM25 30h1v1h-1zM26 30h1v1h-1zM20 31h1v1h-1zM23 31h1v1h-1zM24 31h1v1h-1zM21 32h1v1h-1zM23 32h1v1h-1z',
  'M32 25h1v1h-1zM30 28h1v1h-1zM29 29h1v1h-1zM30 29h1v1h-1zM31 29h1v1h-1zM32 29h1v1h-1zM27 30h1v1h-1zM28 30h1v1h-1zM29 30h1v1h-1zM30 30h1v1h-1zM31 30h1v1h-1zM26 31h1v1h-1zM27 31h1v1h-1zM29 31h1v1h-1zM31 31h1v1h-1zM25 32h1v1h-1zM26 32h1v1h-1zM27 32h1v1h-1zM28 32h1v1h-1zM29 32h1v1h-1zM30 32h1v1h-1z',
]
