/**
 * agendaPublicaTokens.test.ts — tanda G1: las páginas públicas de la agenda
 * (`/reservar`, `/confirmar`) no tienen `html.dark` (no montan ScriptTema), así
 * que su CSS redeclara en `@media (prefers-color-scheme: dark)` los `--ag-*`
 * que usa. Esta prueba exige que cada uno valga EXACTAMENTE lo que vale en el
 * `html.dark` de globals.css: si alguien cambia el oscuro de la agenda, las
 * páginas públicas no se quedan con el viejo sin que nadie lo note.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Las declaraciones `--ag-*` de un bloque, en un mapa nombre → valor normalizado. */
function declaraciones(bloque: string): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const m of bloque.matchAll(/(--ag-[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) mapa.set(m[1], m[2].replace(/\s+/g, ' ').replace(/,\s*/g, ',').trim())
  }
  return mapa
}

/** El bloque `html.dark { … }` de nivel superior de globals.css. */
function oscuroDeLaAgenda(): Map<string, string> {
  const css = leer('src/app/globals.css')
  const inicio = css.search(/^html\.dark \{/m)
  const fin = css.indexOf('\n}', inicio)
  return declaraciones(css.slice(inicio, fin))
}

function oscuroDeLasPaginasPublicas(): Map<string, string> {
  const css = leer('src/components/agendaPublica/agendaPublica.css')
  const inicio = css.indexOf('body:has(.rp) {')
  return declaraciones(css.slice(inicio, css.indexOf('}', inicio)))
}

describe('el oscuro de las páginas públicas de la agenda', () => {
  it('redeclara al menos las superficies, la tinta y el navy', () => {
    const publico = oscuroDeLasPaginasPublicas()
    for (const t of ['--ag-bg-app', '--ag-surface', '--ag-ink', '--ag-text', '--ag-navy', '--ag-brand-legible']) expect(publico.has(t)).toBe(true)
  })
  it('cada token vale lo mismo que en html.dark de globals.css', () => {
    const agenda = oscuroDeLaAgenda()
    for (const [token, valor] of oscuroDeLasPaginasPublicas()) {
      expect(agenda.get(token), token).toBe(valor)
    }
  })
})
