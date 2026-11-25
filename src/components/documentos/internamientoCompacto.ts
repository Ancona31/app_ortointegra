/**
 * Lógica pura de la solicitud de internamiento compacta (maqueta
 * `internamiento.html`, aprobada por el dueño). Sin React y sin red: la usa
 * también el búnker sin conexión.
 *
 * Dos partes:
 *
 * 1. Las indicaciones de piso (`GUIA_FORM_INTERNAMIENTO.md` §3), que salieron
 *    de `IndicacionesPiso.tsx` tal cual —`GRUPOS_FIJOS`, `contarRenglones`,
 *    `textoIndicaciones`, `leerGrupos`— más la conversión entre lo GUARDADO
 *    (`GrupoIndicaciones[]`, igual que siempre) y la HOJA DE ÓRDENES que se
 *    edita (los cuatro grupos fijos siempre presentes).
 * 2. Los resúmenes de las cinco secciones plegadas.
 *
 * ⚠ **LO GUARDADO NO CAMBIA DE FORMA.** Hoy un grupo «apagado» no existe en
 * `grupos`; en la hoja los cuatro fijos están siempre. `gruposDeHoja` deshace
 * eso al guardar y al emitir: un grupo sin renglones con texto no se guarda ni
 * se imprime, y los renglones vacíos tampoco. `hojaDeGrupos` lo rehace al
 * cargar: los fijos ausentes vuelven vacíos.
 */

export interface GrupoIndicaciones {
  readonly nombre: string
  readonly renglones: readonly string[]
}

/**
 * Los cuatro de siempre, **en orden clínico y no de activación**: enfermería
 * lee siempre en el mismo orden. Los propios —en los datos reales aparece «Al
 * ingreso»— se listan detrás.
 */
export const GRUPOS_FIJOS = [
  'Dieta',
  'Soluciones',
  'Medicamentos',
  'Cuidados de enfermería',
] as const

/**
 * Sugerencia del primer renglón, una por grupo. **Es texto de ayuda y no se
 * inserta**: nada de esto llega al documento si el médico no lo teclea.
 *
 * Va por grupo y no una sola para los cuatro porque la misma frase —«Ayuno
 * estricto de 8 horas»— en Soluciones o en Medicamentos no orienta: despista.
 * Las cuatro salen de los datos reales de producción.
 */
const EJEMPLO: Record<string, string> = {
  Dieta: 'Ayuno estricto de 8 horas',
  Soluciones: 'Solución Hartmann 1000 ml para 24 horas',
  Medicamentos: 'Cefalotina 1 g IV una hora antes de la cirugía',
  'Cuidados de enfermería': 'Signos vitales cada 8 horas',
}

/**
 * Un grupo propio puede ser cualquier cosa —en los datos reales aparece «Al
 * ingreso»—, así que su sugerencia no puede parecerse a ninguno de los cuatro:
 * cualquier ejemplo con contenido clínico empujaría hacia el grupo del que
 * salió. Dice qué se escribe, no qué escribir.
 */
const EJEMPLO_PROPIO = 'Una indicación por renglón'

/** Texto de ayuda del renglón: el ejemplo en el primero, una pista en los demás. */
export function ejemploDe(nombre: string, renglon: number): string {
  if (renglon > 0) return 'Siguiente indicación'
  return `Ej: ${EJEMPLO[nombre] ?? EJEMPLO_PROPIO}`
}

export function esFijo(nombre: string): boolean {
  return GRUPOS_FIJOS.some(g => g === nombre)
}

/** Posición en el orden clínico. Los propios comparten la última y empatan. */
function orden(nombre: string): number {
  const i = GRUPOS_FIJOS.findIndex(g => g === nombre)
  return i === -1 ? GRUPOS_FIJOS.length : i
}

/**
 * `sort` es estable desde ES2019, así que los grupos propios —todos con la
 * misma clave— conservan su orden de creación, que es lo que §3.1 pide.
 */
function ordenar(grupos: readonly GrupoIndicaciones[]): GrupoIndicaciones[] {
  return [...grupos].sort((a, b) => orden(a.nombre) - orden(b.nombre))
}

/** Renglones con texto. Los vacíos no cuentan: el recuento resume contenido. */
export function contarRenglones(grupos: readonly GrupoIndicaciones[]): number {
  return grupos.reduce((n, g) => n + g.renglones.filter(r => r.trim() !== '').length, 0)
}

/**
 * SERIALIZA A LA ÚNICA SINTAXIS QUE EL ANALIZADOR DE 2.J RECONOCE.
 *
 *     Dieta
 *     - Ayuno estricto de 8 horas
 *     (línea vacía)
 *     Soluciones
 *     - SSN 0.9% 1000 ml a 60 ml/h
 *
 * Regla del analizador: una línea sin viñeta CON ítems debajo es encabezado de
 * bloque; con la línea vacía delante, el bloque anterior ya está cerrado. Por
 * eso el guion lo pone AQUÍ y no el médico: el renglón se escribe limpio
 * («Ayuno estricto de 8 horas») y la numeración la compone el documento.
 *
 * Un grupo sin renglones con texto no se emite: su nombre quedaría como línea
 * suelta y el analizador lo degradaría a párrafo, que es exactamente el ruido
 * que este control existe para quitar.
 */
export function textoIndicaciones(grupos: readonly GrupoIndicaciones[]): string {
  return grupos
    .map(g => ({
      nombre: g.nombre.trim(),
      renglones: g.renglones.map(r => r.trim()).filter(r => r !== ''),
    }))
    .filter(g => g.nombre !== '' && g.renglones.length > 0)
    .map(g => [g.nombre, ...g.renglones.map(r => `- ${r}`)].join('\n'))
    .join('\n\n')
}

/** Relee lo que guardó una plantilla. El jsonb pudo escribirlo otra versión. */
export function leerGrupos(valor: unknown): GrupoIndicaciones[] {
  if (!Array.isArray(valor)) return []
  const grupos: GrupoIndicaciones[] = []
  for (const g of valor) {
    if (typeof g !== 'object' || g === null) continue
    const { nombre, renglones } = g as Record<string, unknown>
    if (typeof nombre !== 'string' || nombre.trim() === '') continue
    const filas = Array.isArray(renglones)
      ? renglones.filter((r): r is string => typeof r === 'string')
      : []
    grupos.push({ nombre, renglones: filas.length > 0 ? filas : [''] })
  }
  return ordenar(grupos)
}

// ── Hoja de órdenes ⇄ lo guardado ─────────────────────────────────────────

/**
 * Lo guardado → la hoja: los cuatro fijos SIEMPRE, en su orden, con lo que
 * traigan (o un renglón vacío), y detrás los propios en su orden. Un grupo
 * repetido en lo guardado (no debería) se funde en el primero.
 */
export function hojaDeGrupos(guardados: readonly GrupoIndicaciones[]): GrupoIndicaciones[] {
  const conTexto = (rs: readonly string[]): string[] => (rs.length > 0 ? [...rs] : [''])
  const fijos = GRUPOS_FIJOS.map(nombre => {
    const rs = guardados.filter(g => g.nombre === nombre).flatMap(g => g.renglones)
    return { nombre: String(nombre), renglones: conTexto(rs) }
  })
  const propios: GrupoIndicaciones[] = []
  for (const g of guardados) {
    if (esFijo(g.nombre)) continue
    const previo = propios.findIndex(p => p.nombre === g.nombre)
    if (previo === -1) propios.push({ nombre: g.nombre, renglones: conTexto(g.renglones) })
    else propios[previo] = { ...propios[previo], renglones: [...propios[previo].renglones, ...g.renglones] }
  }
  return [...fijos, ...propios]
}

/**
 * La hoja → lo que se guarda y se imprime, con la forma de siempre: sólo los
 * grupos con nombre y algún renglón con texto, sólo sus renglones con texto
 * (tal cual se teclearon: `textoIndicaciones` ya recorta), y el nombre
 * recortado como lo dejaba la fila de grupo propio.
 */
export function gruposDeHoja(hoja: readonly GrupoIndicaciones[]): GrupoIndicaciones[] {
  return hoja
    .map(g => ({ nombre: g.nombre.trim(), renglones: g.renglones.filter(r => r.trim() !== '') }))
    .filter(g => g.nombre !== '' && g.renglones.length > 0)
}

/** El nombre de un grupo propio: vacío no vale y repetido (sin mayúsculas) tampoco. */
export function validarNombreGrupo(
  hoja: readonly GrupoIndicaciones[], indice: number, nombre: string,
): 'ok' | 'vacio' | 'repetido' {
  const n = nombre.trim().toLowerCase()
  if (n === '') return 'vacio'
  return hoja.some((g, i) => i !== indice && g.nombre.trim().toLowerCase() === n) ? 'repetido' : 'ok'
}

/**
 * Lo pegado → renglones: una línea por renglón, sin viñetas ni números al
 * principio («• », «- », «1. », «2) »), sin líneas vacías.
 */
export function lineasPegadas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:[•·\-–—*]+|\d+\s*[.)-]+)\s*/, '').trim())
    .filter(l => l !== '')
}

/**
 * Reparte lo pegado en los renglones de un grupo a partir del renglón `i`: si
 * está vacío lo ocupa la primera línea; si ya tiene texto, las líneas van
 * debajo. Devuelve los renglones y el índice del último pegado.
 */
export function pegarEnRenglones(
  renglones: readonly string[], i: number, lineas: readonly string[],
): { renglones: string[]; ultimo: number } {
  const vacio = (renglones[i] ?? '').trim() === ''
  const desde = vacio ? i : i + 1
  const nuevos = [...renglones.slice(0, desde), ...lineas, ...renglones.slice(i + 1)]
  return { renglones: nuevos, ultimo: desde + lineas.length - 1 }
}

// ── Resúmenes de las secciones plegadas ──────────────────────────────────

export type SeccionInternamiento = 'gen' | 'dx' | 'req' | 'ins' | 'piso'
export const SECCIONES: readonly SeccionInternamiento[] = ['gen', 'dx', 'req', 'ins', 'piso']

/** Un resumen y si la sección cuenta como completa (verde). */
export interface Resumen { texto: string; completa: boolean }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `2026-11-25` → `25 nov`. Sin `Date`: la cadena ya es la fecha de pared. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`.trim()
}

const unir = (partes: readonly (string | false | undefined)[]): string =>
  partes.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(' · ')

export interface DatosGenerales {
  tipoInternamiento: string; fechaIngreso: string; diasEstimados: string
  asa: string; lugar: string; urgente: boolean
}

export function resumenGenerales(d: DatosGenerales): Resumen {
  const texto = unir([
    d.urgente && 'Urgente', d.tipoInternamiento,
    d.fechaIngreso !== '' && `ingreso ${fechaCorta(d.fechaIngreso)}`,
    d.diasEstimados.trim(), d.asa, d.lugar.trim(),
  ])
  return texto === ''
    ? { texto: 'Sin datos del internamiento', completa: false }
    : { texto, completa: true }
}

export function resumenDiagnostico(diagnostico: string, secundarios: readonly string[], procedimiento: string): Resumen {
  const n = secundarios.filter(s => s.trim() !== '').length
  const texto = unir([diagnostico.trim(), n > 0 && `+${n} ${n === 1 ? 'secundario' : 'secundarios'}`, procedimiento.trim()])
  if (diagnostico.trim() === '') return { texto: texto || 'Falta el diagnóstico principal', completa: false }
  return { texto, completa: true }
}

export function resumenRequerimientos(lista: readonly string[], justificacion: string): Resumen {
  const req = lista.filter(r => r.trim() !== '').join(', ')
  const texto = unir([req || 'Sin requerimientos', justificacion.trim() !== '' && 'con justificación'])
  return { texto, completa: req !== '' || justificacion.trim() !== '' }
}

export function resumenInstrucciones(editadas: boolean): Resumen {
  return { texto: editadas ? 'Editadas' : 'Texto estándar', completa: true }
}

/** `Dieta 1 · Medicamentos 3`, o `Sin indicaciones`. */
export function resumenPiso(hoja: readonly GrupoIndicaciones[]): Resumen {
  const partes = gruposDeHoja(hoja).map(g => `${g.nombre} ${g.renglones.length}`)
  return partes.length > 0
    ? { texto: partes.join(' · '), completa: true }
    : { texto: 'Sin indicaciones', completa: false }
}

/** En qué sección vive cada obligatorio (las claves de la validación de hoy). */
export function seccionDe(clave: string): SeccionInternamiento {
  return clave === 'diagnostico' ? 'dx' : 'gen'
}

/** Requerimientos: añadir o quitar, en el orden en que se eligen (como hoy). */
export function alternar(lista: readonly string[], r: string): string[] {
  return lista.includes(r) ? lista.filter(x => x !== r) : [...lista, r]
}
