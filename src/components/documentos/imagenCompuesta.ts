/**
 * Lógica pura de la solicitud de imagen estructurada (maqueta aprobada
 * `solicitud-imagen.html`): un estudio abierto, los demás plegados; el editor
 * pide sólo lo que aplica al tipo y la región. Sin React: lo prueban
 * `src/lib/tests/imagenCompuesta.test.ts` y `estudiosImagen.test.ts`.
 *
 * ⚠️ NO CAMBIA LO QUE SE GUARDA: cada estudio sigue siendo el objeto de cuatro
 * cadenas (`tipo`, `region`, `proyecciones`, `indicacion`) que leen el PDF, el
 * expediente, el búnker y las plantillas. El editor COMPONE esas cadenas
 * (`componer`) y, al reabrir algo guardado, intenta reconocerlas
 * (`interpretar`). Lo que no reconoce con certeza —es decir, lo que al volver
 * a componerse no daría EXACTAMENTE el mismo texto— se abre en «Otro» con las
 * cuatro cadenas intactas: nunca se reescribe texto guardado sin que el médico
 * lo edite.
 */
import { MODALIDADES_IMAGEN, type Concordancia, type IdModalidad, type ModalidadImagen, type RegionImagen } from '@/lib/estudiosImagen'

export type Lado = 'Derecha' | 'Izquierda' | 'Bilateral'
export const LADOS: readonly Lado[] = ['Derecha', 'Izquierda', 'Bilateral']

/** Lo que se guarda y se imprime: las cuatro cadenas de siempre. */
export interface EstudioGuardado { tipo: string; region: string; proyecciones?: string; indicacion?: string }

/** El estado del editor de UN estudio. Nada de esto viaja al jsonb. */
export interface EstudioEditor {
  modalidad: IdModalidad | ''
  /** Pestaña de grupo visible (no se guarda; al reabrir sale de la región). */
  grupo: number
  region: string
  lado: Lado | ''
  contraste: string
  /** Proyecciones elegidas, en el orden en que se marcaron. */
  proyecciones: string[]
  otra: string
  indicacion: string
  /** Los campos libres del modo «Otro» (las cuatro cadenas de antes). */
  tipoLibre: string
  regionLibre: string
  proyLibre: string
}

export const ESTUDIO_EDITOR_VACIO: EstudioEditor = {
  modalidad: '', grupo: 0, region: '', lado: '', contraste: '', proyecciones: [], otra: '', indicacion: '',
  tipoLibre: '', regionLibre: '', proyLibre: '',
}

export function modalidadDe(id: IdModalidad | ''): ModalidadImagen | undefined {
  return MODALIDADES_IMAGEN.find(m => m.id === id)
}

/** La región elegida en el catálogo (busca primero en la pestaña visible). */
export function regionDe(e: EstudioEditor): (RegionImagen & { grupo: string }) | null {
  const m = modalidadDe(e.modalidad)
  if (!m || !e.region) return null
  const orden = [m.grupos[e.grupo], ...m.grupos].filter(g => g !== undefined)
  for (const g of orden) {
    const r = g.regiones.find(x => x.nombre === e.region)
    if (r) return { ...r, grupo: g.nombre }
  }
  return null
}

/** Angio-TC y angio-RM: el contraste va implícito y no se pregunta. */
export function contrasteImplicito(e: EstudioEditor): boolean {
  return /^angio/i.test(regionDe(e)?.grupo ?? '')
}

export function pideContraste(e: EstudioEditor): boolean {
  const m = modalidadDe(e.modalidad)
  return !!m && m.contrastes.length > 0 && !contrasteImplicito(e)
}

export function pideLado(e: EstudioEditor): boolean {
  return !!regionDe(e)?.lado
}

/** Vacío = no se tocó: ni tipo, ni región, ni indicación, ni texto libre. */
export function estaVacio(e: EstudioEditor): boolean {
  return !e.modalidad && !e.region && !e.indicacion.trim() && !e.tipoLibre.trim()
}

export type Falta = 'tipo' | 'region' | 'lado' | 'contraste'

/** Lo que le falta a un estudio CON DATOS para imprimirse; vacío no falta nada. */
export function faltasDe(e: EstudioEditor): Falta[] {
  if (estaVacio(e)) return []
  const f: Falta[] = []
  if (e.modalidad === 'otro') {
    if (!e.tipoLibre.trim()) f.push('tipo')
    if (!e.regionLibre.trim()) f.push('region')
    return f
  }
  if (!e.modalidad) f.push('tipo')
  if (!e.region) f.push('region')
  if (pideLado(e) && !e.lado) f.push('lado')
  if (e.region && pideContraste(e) && !e.contraste) f.push('contraste')
  return f
}

/** Cómo se nombra cada falta en la línea plegada y en el aviso. */
export function nombreFalta(f: Falta, e: EstudioEditor): string {
  if (f === 'contraste') return e.modalidad === 'mx' ? 'tipo de mastografía' : 'simple o contrastada'
  return { tipo: 'tipo de estudio', region: 'región', lado: 'lado' }[f]
}

/** «a», «a y b», «a, b y c». */
export function unirLista(a: readonly string[]): string {
  return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`
}

const ADJETIVO: Record<Exclude<Lado, 'Bilateral'>, Record<Concordancia, string>> = {
  Derecha: { a: 'derecha', o: 'derecho', as: 'derechas', os: 'derechos' },
  Izquierda: { a: 'izquierda', o: 'izquierdo', as: 'izquierdas', os: 'izquierdos' },
}

/** « derecha», « izquierdo», « bilateral»…, concordado con la región. */
export function sufijoLado(lado: Lado, c: Concordancia): string {
  if (lado === 'Bilateral') return c === 'as' || c === 'os' ? ' bilaterales' : ' bilateral'
  return ` ${ADJETIVO[lado][c]}`
}

/** Nombre del tipo en el PDF: modalidad (Doppler, gammagrafía) + contraste. */
function tipoCompuesto(e: EstudioEditor, m: ModalidadImagen): string {
  const r = regionDe(e)
  let tipo = m.nombre
  if (m.id === 'us' && r?.grupo === 'Doppler') tipo = 'Ultrasonido Doppler'
  if (m.id === 'mn') tipo = 'Gammagrafía'
  if (pideContraste(e) && e.contraste) tipo += ` ${e.contraste.toLowerCase()}`
  return tipo
}

/** Las cuatro cadenas que guarda la app y pinta el PDF (`cadenas()` de la maqueta). */
export function componer(e: EstudioEditor): Required<EstudioGuardado> {
  if (e.modalidad === 'otro') {
    return { tipo: e.tipoLibre, region: e.regionLibre, proyecciones: e.proyLibre, indicacion: e.indicacion }
  }
  const m = modalidadDe(e.modalidad)
  if (!m) return { tipo: '', region: '', proyecciones: '', indicacion: e.indicacion }
  const r = regionDe(e)
  const lado = r?.lado && e.lado ? sufijoLado(e.lado, r.lado) : ''
  const otra = e.otra.trim()
  const proyecciones = m.proyecciones ? unirLista([...e.proyecciones, ...(otra ? [otra] : [])]) : ''
  return { tipo: tipoCompuesto(e, m), region: e.region + lado, proyecciones, indicacion: e.indicacion }
}

/** Elegir una región (del buscador o de una ficha): premarca las de rutina. */
export function conRegion(e: EstudioEditor, modalidad: IdModalidad, grupo: number, region: string): EstudioEditor {
  const base: EstudioEditor = { ...e, modalidad, grupo, region, lado: '', otra: '', proyecciones: [] }
  const r = regionDe(base)
  const contraste = modalidad === e.modalidad && !contrasteImplicito(base) ? e.contraste : ''
  return { ...base, contraste, proyecciones: [...(r?.rutina ?? [])] }
}

/**
 * Cambiar de tipo limpia lo que dependía del anterior. Pasar a «Otro» lleva
 * lo ya compuesto a los campos libres, para corregirlo a mano sin reescribirlo.
 */
export function conModalidad(e: EstudioEditor, id: IdModalidad): EstudioEditor {
  if (id === e.modalidad) return e
  const limpio: EstudioEditor = { ...ESTUDIO_EDITOR_VACIO, indicacion: e.indicacion, modalidad: id }
  if (id !== 'otro') return limpio
  const c = componer(e)
  return { ...limpio, tipoLibre: c.tipo, regionLibre: c.region, proyLibre: c.proyecciones }
}

export type Siguiente = 'tipo' | 'region' | 'lado' | 'contraste' | 'indicacion' | 'tipoLibre'

/** Tras cada elección el foco va a lo siguiente que falta; sin faltas, a la indicación. */
export function siguienteCampo(e: EstudioEditor): Siguiente {
  if (e.modalidad === 'otro') return e.tipoLibre.trim() ? 'indicacion' : 'tipoLibre'
  if (!e.modalidad) return 'tipo'
  if (!e.region) return 'region'
  if (pideLado(e) && !e.lado) return 'lado'
  if (pideContraste(e) && !e.contraste) return 'contraste'
  return 'indicacion'
}

/** Familia de color de la etiqueta (sólo pantalla; el PDF no la usa). */
export type ColorModalidad = 'rx' | 'tc' | 'rm' | 'us' | 'verde' | 'otra'
export function colorModalidad(id: IdModalidad | ''): ColorModalidad {
  const tabla: Partial<Record<IdModalidad, ColorModalidad>> = { rx: 'rx', tc: 'tc', rm: 'rm', us: 'us', dxa: 'verde', mx: 'verde' }
  return (id && tabla[id]) || 'otra'
}

// ── Buscador «tipo + región» ──────────────────────────────────────────────

export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface ResultadoImagen { modalidad: IdModalidad; corto: string; nombreModalidad: string; grupo: number; nombreGrupo: string; region: string }
type Entrada = ResultadoImagen & { texto: string; palabras: string[] }

let indice: Entrada[] | null = null
function indiceImagen(): Entrada[] {
  indice ??= MODALIDADES_IMAGEN.flatMap(m => m.grupos.flatMap((g, gi) => g.regiones.map(r => {
    const texto = sinAcentos(`${m.corto} ${m.nombre} ${r.nombre}`)
    return { modalidad: m.id, corto: m.corto, nombreModalidad: m.nombre, grupo: gi, nombreGrupo: g.nombre, region: r.nombre, texto, palabras: texto.split(/[^a-z0-9]+/) }
  })))
  return indice
}

/**
 * Busca por tipo y región a la vez («rm rod», «rx col lum»), sin acentos. Cada
 * palabra escrita tiene que aparecer; puntúa más la que coincide con el INICIO
 * de una palabra («lum» → lumbar antes que columna). Menos de 2 letras: nada.
 */
export function buscarImagen(texto: string, max = 9): ResultadoImagen[] {
  const ps = sinAcentos(texto.trim()).split(/\s+/).filter(Boolean)
  if (ps.join('').length < 2) return []
  const puntos = (x: Entrada) => ps.reduce((n, p) => n + (x.palabras.some(w => w.startsWith(p)) ? 1 : 0), 0)
  return indiceImagen()
    .filter(x => ps.every(p => x.texto.includes(p)))
    .map((x, i) => ({ x, n: puntos(x), i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map(({ x }) => ({ modalidad: x.modalidad, corto: x.corto, nombreModalidad: x.nombreModalidad, grupo: x.grupo, nombreGrupo: x.nombreGrupo, region: x.region }))
}

// ── Interpretar lo guardado ───────────────────────────────────────────────

/** Separa «AP, Lateral y Oblicua especial» en conocidas (en orden) + la «Otra» final. */
function partirProyecciones(texto: string, conocidas: readonly string[]): { elegidas: string[]; otra: string } {
  const orden = [...conocidas].sort((a, b) => b.length - a.length)
  const elegidas: string[] = []
  let resto = texto
  for (;;) {
    const k = orden.find(c => !elegidas.includes(c) && (resto === c || resto.startsWith(`${c}, `) || resto.startsWith(`${c} y `)))
    if (!k) break
    elegidas.push(k)
    resto = resto.slice(k.length)
    resto = resto.startsWith(', ') ? resto.slice(2) : resto.startsWith(' y ') ? resto.slice(3) : resto
  }
  return { elegidas, otra: resto }
}

/** Candidatos de región: cada región del catálogo (y «sin región») con cada lado posible. */
function candidatos(m: ModalidadImagen, region: string): EstudioEditor[] {
  const base: EstudioEditor = { ...ESTUDIO_EDITOR_VACIO, modalidad: m.id }
  if (region === '') return [base]
  const lista: EstudioEditor[] = []
  m.grupos.forEach((g, gi) => g.regiones.forEach(r => {
    if (!region.startsWith(r.nombre)) return
    const lados: (Lado | '')[] = r.lado ? ['', ...LADOS] : ['']
    for (const lado of lados) lista.push({ ...base, grupo: gi, region: r.nombre, lado })
  }))
  return lista
}

/** Un candidato con el contraste y las proyecciones que hagan falta, si cuadra. */
function ajustar(c: EstudioEditor, m: ModalidadImagen, g: Required<EstudioGuardado>): EstudioEditor | null {
  for (const contraste of ['', ...m.contrastes]) {
    let e: EstudioEditor = { ...c, contraste, indicacion: g.indicacion }
    if (m.proyecciones) {
      const r = regionDe(e)
      const { elegidas, otra } = partirProyecciones(g.proyecciones, [...(r?.rutina ?? []), ...(r?.especiales ?? [])])
      e = { ...e, proyecciones: elegidas, otra }
    }
    const x = componer(e)
    if (x.tipo === g.tipo && x.region === g.region && x.proyecciones === g.proyecciones) return e
  }
  return null
}

/**
 * Reconoce un estudio guardado (o de una plantilla) en el catálogo. SÓLO se
 * acepta si `componer` devuelve exactamente las mismas cadenas; si no, «Otro»
 * con las cuatro cadenas intactas.
 */
export function interpretar(guardado: EstudioGuardado): EstudioEditor {
  const g: Required<EstudioGuardado> = {
    tipo: guardado.tipo, region: guardado.region,
    proyecciones: guardado.proyecciones ?? '', indicacion: guardado.indicacion ?? '',
  }
  if (!g.tipo && !g.region && !g.proyecciones) return { ...ESTUDIO_EDITOR_VACIO, indicacion: g.indicacion }
  if (g.tipo) {
    for (const m of MODALIDADES_IMAGEN) {
      if (m.id === 'otro') continue
      for (const c of candidatos(m, g.region)) {
        const e = ajustar(c, m, g)
        if (e) return e
      }
    }
  }
  return { ...ESTUDIO_EDITOR_VACIO, modalidad: 'otro', tipoLibre: g.tipo, regionLibre: g.region, proyLibre: g.proyecciones, indicacion: g.indicacion }
}
