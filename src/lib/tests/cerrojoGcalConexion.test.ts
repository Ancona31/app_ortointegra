/**
 * EL CANDADO: nadie escribe en la conexión de Google desde fuera de su dueño.
 *
 * `src/lib/gcalConexion.ts` sabe cómo se toca esa conexión: cifra los secretos,
 * respeta el índice único parcial de una conexión por clínica, NO promueve el
 * `rol` al reconectar, y escribe el `calendar_id` por comparar-y-cambiar. Hoy
 * todo el código de `src/` pasa por ahí — pero nada lo obliga.
 *
 * El riesgo no es un atacante. Es que dentro de seis meses alguien escriba una
 * ruta nueva, necesite marcar una conexión, y consulte la tabla directamente.
 * Funcionaría, no daría error, y se saltaría las cuatro reglas de arriba.
 *
 * Esta prueba es lo que lo impide. Los seis literales del plan §2.2:
 *
 *   alta_conexion_google · guardar_secretos_conexion ·
 *   leer_conexion_google_con_secretos · clinica_conexiones_google ·
 *   google_tokens · google_conexiones_secretos
 *
 * ── ⚠ CUÁNDO SALTA, DICHO SIN ADORNARLO ─────────────────────────────────────
 * SALTA EN `npm test`. **NO SALTA EN EL BUILD.** `npm run build` es `next build
 * --webpack` y no ejecuta Vitest; `vercel.json` fija ese mismo comando; no hay
 * CI ni hooks de git en este repo. Así que este candado vale exactamente lo que
 * valga la costumbre de correr las pruebas antes de integrar una rama, ni un
 * gramo más. Se dice aquí porque venderlo como una barrera del build sería peor
 * que no tenerlo: daría por cubierto lo que no lo está.
 *
 * ── ALCANCE, Y EL HUECO QUE DEJA ────────────────────────────────────────────
 * Recorre `src/` y nada más. **Los tres scripts de humo van directos a la tabla
 * y este candado NO los cubre**, a propósito:
 *
 *   scripts/gcal-puente-humo.ts · scripts/gcal-attendees-humo.ts ·
 *   scripts/gcal-notificaciones-humo.ts
 *
 * Los tres LEEN con cliente admin y sondean el puente por RPC — que es su
 * trabajo—, ninguno se despliega, y ninguno corre en una ruta de petición.
 * Incluirlos obligaría a este archivo a nacer con tres exenciones, y un candado
 * que nace con exenciones enseña que las exenciones son rutina. Queda escrito
 * aquí, no en la deuda técnica: quien lee el candado tiene que saber qué NO
 * cubre. Si algún día un script pasa a ESCRIBIR en esa tabla, esa decisión
 * merece revisarse.
 *
 * ── POR QUÉ POR FORMA DE LLAMADA Y NO POR TEXTO PLANO ───────────────────────
 * Un candado que busque el nombre de la tabla como cadena suelta nace rojo en
 * diez sitios legítimos: las tres llamadas a `logAudit` que guardan el nombre
 * de la tabla COMO DATO en `audit_log` (`google/calendar`, `google/callback`,
 * `google/disconnect`), cinco comentarios, un `logger.warn` y la constante del
 * doble de prueba de `gcalConexion.test.ts`. Se silenciaría en una semana.
 *
 * Por eso sólo cuenta como violación el literal dentro de una LLAMADA: `.from(`
 * o `.rpc(`. Con esa regla el candado arranca con la lista de exenciones VACÍA,
 * que es la única situación en la que un candado afirma algo. Efecto lateral
 * limpio: este archivo tampoco se delata a sí mismo, porque aquí los seis
 * nombres viven en un array de strings, nunca dentro de un `.from(`.
 *
 * **Lo que NO atrapa, dicho claro: la indirección.** `const T = '…'; from(T)`
 * pasa. Y no pasa nada: el riesgo real es el descuido honesto de quien escribe
 * lo natural, no el rodeo deliberado. Cerrar eso exigiría analizar el AST con
 * TypeScript, una máquina mucho mayor para un modo de fallo que no es el
 * nuestro.
 *
 * ── SI ALGÚN DÍA FALLA POR UN CASO LEGÍTIMO ─────────────────────────────────
 * Se añade una entrada a `EXENCIONES`, aquí abajo. NO hay flag, NO hay variable
 * de entorno, NO hay `it.skip`, y NO existe ningún comentario mágico que puedas
 * poner en el archivo infractor para callar esto. La única salida es escribir
 * una línea EN EL GUARDIÁN, con un `motivo` que el tipo obliga a rellenar, y
 * que por tanto aparece en el diff delante de quien revise. El grano es
 * (archivo, literal): eximir un archivo para `google_tokens` no le abre las
 * otras cinco puertas.
 *
 * ── LA OTRA TABLA QUE PODRÍA QUERER ESTO, Y QUE NO LO LLEVA ─────────────────
 * `audit_log` es el único segundo candidato plausible del repo: lo escribe sólo
 * `src/lib/audit.ts` (`logAudit`) y un `insert` directo se saltaría su catálogo
 * de acciones y sus reglas de PII. Se descarta DE ESTE COMMIT a propósito, no
 * por olvido: su candado sería distinto, porque tendría que distinguir el VERBO
 * y no sólo la tabla — sus lecturas legítimas están repartidas en dos rutas de
 * super-admin. No lo copies desde aquí sin rehacer esa parte.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Ruta del único archivo autorizado, relativa a la raíz del repo. */
const DUENO = 'src/lib/gcalConexion.ts'

const LITERALES = [
  'alta_conexion_google',
  'guardar_secretos_conexion',
  'leer_conexion_google_con_secretos',
  'clinica_conexiones_google',
  'google_tokens',
  'google_conexiones_secretos',
] as const

/**
 * La salida de emergencia. NACE VACÍA, y eso es una afirmación sobre el repo:
 * hoy no existe ni un solo caso legítimo. Lee la cabecera antes de añadir uno.
 */
interface Exencion {
  archivo: string
  literal: (typeof LITERALES)[number]
  motivo:  string
}
const EXENCIONES: Exencion[] = []

/* La comilla se acepta simple, doble o invertida (`\u0060` es la invertida,
   escrita por codepoint para no pelearse con la plantilla de esta cadena). */
const LLAMADA = new RegExp(
  String.raw`\.\s*(?:from|rpc)\s*\(\s*['"\u0060](` + LITERALES.join('|') + String.raw`)['"\u0060]`,
  'g',
)

interface Violacion {
  archivo:   string
  linea:     number
  literal:   string
  fragmento: string
}

/** Ruta relativa a la raíz del repo, con `/` siempre. */
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

function violaciones(archivo: string, texto: string): Violacion[] {
  const encontradas: Violacion[] = []
  texto.split('\n').forEach((linea, i) => {
    for (const coincidencia of linea.matchAll(LLAMADA)) {
      encontradas.push({
        archivo,
        linea:     i + 1,
        literal:   coincidencia[1],
        fragmento: linea.trim(),
      })
    }
  })
  return encontradas
}

const estaExenta = (v: Violacion): boolean =>
  EXENCIONES.some((e) => e.archivo === v.archivo && e.literal === v.literal)

const describir = (v: Violacion): string =>
  `${v.archivo}:${v.linea} — '${v.literal}' en: ${v.fragmento}`

describe('cerrojo de gcalConexion (plan §2.2)', () => {
  it('ningún archivo de src/ salvo su dueño consulta esas tablas ni llama a esos RPC', () => {
    const encontradas = archivosFuente(join(process.cwd(), 'src'))
      .map((ruta) => ({ ruta, rel: aRelativa(ruta) }))
      .filter(({ rel }) => rel !== DUENO)
      .flatMap(({ ruta, rel }) => violaciones(rel, readFileSync(ruta, 'utf8')))
      .filter((v) => !estaExenta(v))

    /* Se compara la LISTA, no la longitud: así el fallo dice archivo, línea y
       la línea infractora entera, en vez de «se esperaba 0 y hubo 1». */
    expect(encontradas.map(describir)).toEqual([])
  })

  it('el detector no está muerto: ve las llamadas del dueño, en sus dos formas', () => {
    /* Sin esto, un candado con la expresión rota pasaría verde para siempre y
       nadie se enteraría: cero violaciones se lee igual que cero cobertura. */
    const propias = violaciones(DUENO, readFileSync(join(process.cwd(), DUENO), 'utf8'))
    const vistos = new Set(propias.map((v) => v.literal))

    expect(vistos.has('clinica_conexiones_google')).toBe(true)        // forma .from(
    expect(vistos.has('leer_conexion_google_con_secretos')).toBe(true) // forma .rpc(
  })
})
