/**
 * agendaPublicaTokens.test.ts — las páginas públicas de la agenda (`/reservar`,
 * `/confirmar`) se ven SIEMPRE en claro (tanda H, punto 2 de Angel): ni el
 * oscuro del sistema ni el guardado en la app (`html.dark`, que puede quedar
 * colgada al llegar desde la app sin recargar).
 *
 * Cómo se garantiza (ver la cabecera de `agendaPublica.css`): la hoja no tiene
 * ningún `@media (prefers-color-scheme: dark)` y redeclara en `body:has(.rp)`,
 * con el valor del `:root` de globals.css, cada `--ag-*` que usa (directa o
 * indirectamente) y que `html.dark` cambia. Esta prueba lo exige token a
 * token, también para los que la hoja empiece a usar mañana.
 *
 * (Sustituye a la de la tanda G1, que exigía lo contrario: el oscuro del
 * teléfono con los valores de `html.dark`.)
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const normal = (v: string) => v.replace(/\s+/g, ' ').replace(/,\s*/g, ',').trim()

/** Las declaraciones `--ag-*` de un bloque, en un mapa nombre → valor normalizado. */
function declaraciones(bloque: string): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const m of bloque.matchAll(/(--ag-[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) mapa.set(m[1], normal(m[2]))
  }
  return mapa
}

/** El primer bloque de nivel superior que empieza por `cabecera`, hasta su `}` (ninguno anida llaves). */
function bloqueDe(css: string, cabecera: RegExp): string {
  const inicio = css.search(cabecera)
  expect(inicio, String(cabecera)).toBeGreaterThanOrEqual(0)
  return css.slice(inicio, css.indexOf('}', inicio))
}

const GLOBAL = leer('src/app/globals.css')
const PUBLICA = leer('src/components/agendaPublica/agendaPublica.css')
const claro = declaraciones(bloqueDe(GLOBAL, /^:root \{/m))
const oscuro = declaraciones(bloqueDe(GLOBAL, /^html\.dark \{/m))
const forzado = declaraciones(bloqueDe(PUBLICA, /^body:has\(\.rp\) \{/m))

/** Los `.tsx` de las dos páginas y del marco: también pintan con `style={{ … var(--ag-*) }}` en línea. */
function componentesPublicos(): string {
  return ['src/app/reservar/[codigo]', 'src/app/confirmar/[codigo]', 'src/components/agendaPublica']
    .flatMap(dir => readdirSync(resolve(process.cwd(), dir)).filter(f => f.endsWith('.tsx')).map(f => leer(join(dir, f))))
    .join('\n')
}

/** Los `--ag-*` que leen la hoja pública y los componentes, y los que éstos leen a su vez en el `:root`. */
function usadosPorLaHoja(): Set<string> {
  const reglas = PUBLICA.replace(/^body:has\(\.rp\) \{[\s\S]*?\n\}/m, '') + componentesPublicos()
  const pendientes = [...reglas.matchAll(/var\((--ag-[\w-]+)/g)].map(m => m[1] ?? '')
  const vistos = new Set<string>()
  while (pendientes.length) {
    const t = pendientes.pop() ?? ''
    if (vistos.has(t)) continue
    vistos.add(t)
    for (const m of (claro.get(t) ?? '').matchAll(/var\((--ag-[\w-]+)/g)) pendientes.push(m[1] ?? '')
  }
  return vistos
}

describe('las páginas públicas de la agenda, siempre en claro', () => {
  it('no siguen el oscuro del sistema: ningún prefers-color-scheme en la hoja', () => {
    expect(PUBLICA).not.toMatch(/prefers-color-scheme/)
  })

  it('declaran color-scheme: light en el documento y en el cuerpo', () => {
    expect(bloqueDe(PUBLICA, /^html:has\(\.rp\) \{/m)).toMatch(/color-scheme:\s*light/)
    expect(bloqueDe(PUBLICA, /^body:has\(\.rp\) \{/m)).toMatch(/color-scheme:\s*light/)
  })

  it('cada token que usan y que html.dark cambia se redeclara con su valor claro de globals.css', () => {
    const necesarios = [...usadosPorLaHoja()].filter(t => oscuro.has(t))
    expect(necesarios.length).toBeGreaterThan(10)
    for (const t of necesarios) expect(forzado.get(t), t).toBe(claro.get(t))
  })

  it('no redeclara nada con un valor oscuro', () => {
    for (const [t, v] of forzado) expect(v, t).toBe(claro.get(t))
  })
})
