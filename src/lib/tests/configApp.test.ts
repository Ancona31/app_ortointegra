/**
 * configApp.test.ts — `revalidarConfigAlMontar` (A1.6). Decide si un
 * `useSWR(CLAVE_CONFIG)` que monta vuelve a pedir `/api/me/config`:
 *
 *   · sin semilla del layout → sí (lo de antes de A1.6);
 *   · semilla y caché vacía (`undefined`) → no: lo que se pinta es la semilla;
 *   · semilla y caché `null` (cierre de sesión, `Sidebar` o `SessionGuard`) →
 *     sí: la semilla puede ser de una sesión que ya no existe;
 *   · semilla y caché con datos → sí (la caché le gana a la semilla).
 *
 * Más el camino real: el `mutate(CLAVE_CONFIG, null, …)` global que escriben
 * `Sidebar` y `SessionGuard`, sobre la caché por defecto de SWR, deja la
 * decisión en `true`.
 */
import { describe, it, expect } from 'vitest'
import { mutate, type Cache, type State } from 'swr'
import { cache as cacheGlobal } from 'swr/_internal'
import { CLAVE_CONFIG, CONFIG_VACIA, revalidarConfigAlMontar, type ConfigApp } from '@/lib/configApp'

const SEMILLA: ConfigApp = { ...CONFIG_VACIA, clinica: { id: 'c1', nombre: 'Clínica', nombre_display: null, subtitulo: null, color_primario: null, color_secundario: null, logo_url: null } }

function cacheCon(data?: ConfigApp | null): Cache {
  const m = new Map<string, State<unknown>>()
  if (data !== undefined) m.set(CLAVE_CONFIG, { data })
  return m
}

describe('revalidarConfigAlMontar', () => {
  it('sin semilla → revalida', () => {
    expect(revalidarConfigAlMontar({ cache: cacheCon(), fallback: {} })).toBe(true)
  })
  it('semilla y caché undefined → no revalida', () => {
    expect(revalidarConfigAlMontar({ cache: cacheCon(), fallback: { [CLAVE_CONFIG]: SEMILLA } })).toBe(false)
  })
  it('semilla y caché null → revalida', () => {
    expect(revalidarConfigAlMontar({ cache: cacheCon(null), fallback: { [CLAVE_CONFIG]: SEMILLA } })).toBe(true)
  })
  it('semilla y caché con datos → revalida', () => {
    expect(revalidarConfigAlMontar({ cache: cacheCon(CONFIG_VACIA), fallback: { [CLAVE_CONFIG]: SEMILLA } })).toBe(true)
  })
  it('el mutate a null de Sidebar/SessionGuard deja la caché global en null y la decisión en true', async () => {
    await mutate(CLAVE_CONFIG, null, { revalidate: false })
    expect(cacheGlobal.get(CLAVE_CONFIG)?.data).toBeNull()
    expect(revalidarConfigAlMontar({ cache: cacheGlobal, fallback: { [CLAVE_CONFIG]: SEMILLA } })).toBe(true)
  })
})
