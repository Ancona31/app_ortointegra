/**
 * cronAutorizacion.ts — la puerta de las tareas programadas de Vercel Cron
 * (S2 de `mejora_agendaV2.md`). La usan `/api/cron/google-sync` (C7) y
 * `/api/cron/recordatorios` (E4): una sola implementación que auditar.
 *
 * La cabecera `Authorization` tiene que ser EXACTAMENTE `Bearer <CRON_SECRET>`.
 * Se compara en TIEMPO CONSTANTE: los dos lados se reducen a SHA-256 (32 bytes
 * siempre) y se comparan con `timingSafeEqual`. Así los buffers miden lo mismo
 * por construcción, una cabecera de otra longitud no lanza, y ni la longitud
 * del secreto ni el sitio donde difieren se filtran por el tiempo. Sin la
 * variable, o vacía: nunca.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

function huella(valor: string): Buffer {
  return createHash('sha256').update(valor, 'utf8').digest()
}

/** ¿`cabecera` es `Bearer <CRON_SECRET>`? Sin secreto configurado, false. */
export function autorizada(cabecera: string | null): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto || cabecera === null) return false
  return timingSafeEqual(huella(cabecera), huella(`Bearer ${secreto}`))
}
