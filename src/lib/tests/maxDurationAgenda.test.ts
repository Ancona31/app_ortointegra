/**
 * maxDurationAgenda.test.ts — oleada 3, arreglo 2 (orden de Angel): «declara
 * `export const maxDuration = 30` en las dos rutas de reserva y en las demás
 * rutas de la agenda que usan after()».
 *
 * Next 16.2.1: `after` corre dentro del `maxDuration` de la ruta
 * (`docs/01-app/03-api-reference/04-functions/after.md`, «Duration»); sin
 * declararlo, manda el límite por omisión de la plataforma
 * (`02-route-segment-config/index.md`: «Set by deployment platform»).
 *
 * Se lee el texto del archivo (no se importa la ruta) para que ninguna
 * edición la pierda sin que esto falle. `src/app/api/consultas/route.ts` NO
 * está a propósito (orden de Angel: es la ruta de las notas clínicas).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUTAS = [
  'src/app/api/reservar/[codigo]/route.ts',
  'src/app/api/reservar/[codigo]/turnos/route.ts',
  'src/app/api/confirmar/[codigo]/route.ts',
  'src/app/api/appointments/[id]/reagendar/route.ts',
  'src/app/api/agenda/bloqueos/route.ts',
  'src/app/api/agenda/bloqueos/[id]/route.ts',
  'src/app/api/appointments/route.ts',
  'src/app/api/appointments/[id]/route.ts',
] as const

const leer = (ruta: string): string => readFileSync(join(process.cwd(), ruta), 'utf8')

describe('maxDuration = 30 en las rutas de la agenda con after()', () => {
  it.each(RUTAS)('%s', (ruta) => {
    expect(leer(ruta)).toMatch(/^export const maxDuration = 30$/m)
  })

  it('la ruta de las notas clínicas no lo declara (decisión de Angel)', () => {
    expect(leer('src/app/api/consultas/route.ts')).not.toMatch(/maxDuration/)
  })
})
