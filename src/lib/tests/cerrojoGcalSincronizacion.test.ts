/**
 * EL CANDADO de la sincronización de vuelta (bloque C): las nueve RPC que
 * escriben o leen citas y estado con el cliente de servicio sólo se llaman
 * desde su dueño, y los archivos de sincronización no consultan tablas.
 *
 *   · Ocho RPC sólo por `.rpc(` dentro de `src/lib/gcalSincronizacionBase.ts`,
 *     que valida `clinicaId` y lo manda como `p_clinica_id` en cada una.
 *   · `gcal_sync_clinicas_pendientes` (la única lectura entre clínicas, para
 *     el cron) sólo dentro de `src/lib/gcalConexion.ts`, el dueño de leer la
 *     conexión.
 *   · NINGÚN `.from(` en los tres `src/lib/gcalSincronizacion*.ts`: todo lo
 *     que tocan de la base pasa por RPC con `p_clinica_id`. Es la defensa del
 *     pendiente prioritario de CLAUDE.md (createAdminClient esquiva la RLS).
 *
 * Mismo diseño y mismas limitaciones que `cerrojoGcalConexion.test.ts` (léelo:
 * salta en `npm test`, NO en el build; no atrapa la indirección). Se duplica
 * en vez de abstraer, como prefiere el Protocolo 4 de CLAUDE.md.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const BASE = 'src/lib/gcalSincronizacionBase.ts'
const CONEXION = 'src/lib/gcalConexion.ts'
const SINCRONIZACION = ['src/lib/gcalSincronizacion.ts', BASE, 'src/lib/gcalSincronizacionDecidir.ts'] as const

/** RPC → único archivo autorizado a llamarla. */
const DUENOS: Record<string, string> = {
  gcal_sync_tomar: BASE,
  gcal_sync_avanzar: BASE,
  gcal_sync_reiniciar: BASE,
  gcal_sync_soltar: BASE,
  gcal_sync_clinica_habilitada: BASE,
  gcal_citas_por_evento: BASE,
  gcal_aplicar_evento: BASE,
  gcal_importar_evento: BASE,
  gcal_sync_clinicas_pendientes: CONEXION,
}

/* En la base, `llamar()` recibe el nombre como primer argumento de una función
   propia, no dentro de `.rpc(` literal; por eso aquí se cuenta el literal
   entre comillas SIMPLES O DOBLES en cualquier sitio, y no sólo dentro de
   `.rpc(`. La comilla invertida no cuenta: es la de los comentarios, que
   citan estos nombres a menudo. Una plantilla con el nombre pasaría: es la
   misma indirección que el otro cerrojo declara no atrapar. */
const LITERAL = new RegExp(String.raw`['"](` + Object.keys(DUENOS).join('|') + String.raw`)['"]`, 'g')
const FROM = /\.\s*from\s*\(/

function aRelativa(ruta: string): string {
  return relative(process.cwd(), ruta).split('\\').join('/')
}

function archivosFuente(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) archivosFuente(ruta, acumulado)
    else if (/\.tsx?$/.test(entrada.name)) acumulado.push(ruta)
  }
  return acumulado
}

/** Archivo:línea de cada literal de RPC fuera de su dueño. Las pruebas no cuentan. */
function literalesFueraDeSuDueno(): string[] {
  const fuera: string[] = []
  for (const ruta of archivosFuente(join(process.cwd(), 'src'))) {
    const rel = aRelativa(ruta)
    if (rel.startsWith('src/lib/tests/')) continue
    readFileSync(ruta, 'utf8').split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(LITERAL)) {
        if (DUENOS[m[1]] !== rel) fuera.push(`${rel}:${i + 1} — '${m[1]}'`)
      }
    })
  }
  return fuera
}

describe('cerrojo de la sincronización con Google (bloque C)', () => {
  it('cada RPC de la sincronización sólo aparece en su dueño', () => {
    expect(literalesFueraDeSuDueno()).toEqual([])
  })

  it('ningún archivo de sincronización consulta una tabla con .from(', () => {
    const conFrom = SINCRONIZACION.flatMap((rel) =>
      readFileSync(join(process.cwd(), rel), 'utf8').split('\n')
        .map((linea, i) => (FROM.test(linea) ? `${rel}:${i + 1}` : null))
        .filter((x): x is string => x !== null))
    expect(conFrom).toEqual([])
  })

  it('el detector no está muerto: ve las nueve RPC en sus dueños y un .from( de verdad', () => {
    const vistos = new Set<string>()
    for (const rel of [BASE, CONEXION]) {
      for (const m of readFileSync(join(process.cwd(), rel), 'utf8').matchAll(LITERAL)) vistos.add(m[1])
    }
    expect([...vistos].sort()).toEqual(Object.keys(DUENOS).sort())
    expect(/\.\s*from\s*\(/.test(readFileSync(join(process.cwd(), CONEXION), 'utf8'))).toBe(true)
  })
})
