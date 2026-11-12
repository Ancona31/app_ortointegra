/**
 * Imprime la versión y el sha256 del aviso de privacidad de la reserva por
 * enlace (src/lib/reserva/avisoReserva.ts) y el INSERT que lo aprueba en
 * `public.reserva_avisos`. NO TOCA NINGUNA BASE: sólo escribe en la consola.
 *
 *   npx tsx scripts/aviso-reserva-hash.ts
 *
 * Aprobar es decisión de Angel, tras la revisión legal. Mientras el texto
 * lleve la marca «PENDIENTE DE REVISIÓN LEGAL», este script lo dice y la
 * página NO se publica aunque el hash se apruebe (doble cierre).
 */
import { AVISO_PLANTILLA, AVISO_VERSION, MARCA_PENDIENTE, hashAviso, sqlAprobacion } from '../src/lib/reserva/avisoReserva'

const pendiente = AVISO_PLANTILLA.includes(MARCA_PENDIENTE)
console.log(`versión: ${AVISO_VERSION}`)
console.log(`sha256:  ${hashAviso()}`)
if (pendiente) {
  console.log(`\n⚠️  El texto lleva «${MARCA_PENDIENTE}». NO SE APRUEBA así:`)
  console.log('    revisarlo, quitar la marca y los [VERIFICAR], subir la versión y volver a correr esto.')
} else {
  console.log('\nPara aprobarlo, pegar en el SQL Editor de Supabase:\n')
  console.log(sqlAprobacion())
}
