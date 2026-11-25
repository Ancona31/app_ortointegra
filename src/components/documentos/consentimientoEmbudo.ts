/**
 * Lógica pura del embudo del consentimiento informado (maqueta
 * `consentimiento.html`, aprobada por el dueño). Sin React y sin red: la usan
 * el formulario, el búnker sin conexión y la pestaña Documentos del expediente.
 *
 * Qué hay aquí:
 *  1. Los faltantes del consentimiento y de la denegación —los MISMOS nueve y
 *     siete de siempre, movidos del formulario sin cambiar ninguna regla— y su
 *     reparto entre los cuatro bloques de la captura.
 *  2. Los resúmenes de una línea de cada bloque plegado.
 *  3. «Quién firma» ⇄ `pacienteNoPuedeFirmar` (la misma clave de siempre).
 *  4. La fecha y la edad al firmar (CI-DT-3): la fecha es la del día de la firma.
 *  5. Las plantillas sin testigos (CI-DT-19).
 *  6. El estado de un borrador para mostrarlo donde se retoma («Falta firmar»).
 *  7. Si un documento sellado ofrece «Regenerar» (CI-DT-1).
 *
 * ⚠ NADA DE ESTO CAMBIA LAS CLAVES NI LOS TIPOS DE `contenido`. Lee y decide;
 * lo que se guarda lo sigue componiendo el formulario como siempre.
 */
import { calcularEdad } from '@/lib/patientUtils'

/** Los cuatro bloques de la captura, en orden. */
export type BloqueConsentimiento = 'dat' | 'txt' | 'aut' | 'fir'
export const BLOQUES: readonly BloqueConsentimiento[] = ['dat', 'txt', 'aut', 'fir']

/** Las siete claves de `contenido.secciones`. `preoperatorio` NO se renombra. */
export const CLAVES_SECCION = [
  'preoperatorio', 'beneficios', 'anestesia', 'descripcion',
  'riesgosComunes', 'riesgosEspecificos', 'alternativas',
] as const
export type ClaveSeccion = typeof CLAVES_SECCION[number]

/**
 * Las dos que nacen vacías y bloquean la emisión (validación legal auditada,
 * NOM-004-SSA3-2012). El nombre es el que el banner de faltantes decía antes.
 */
export const SECCIONES_OBLIGATORIAS: readonly { clave: ClaveSeccion; nombre: string }[] = [
  { clave: 'descripcion', nombre: 'Descripción del procedimiento' },
  { clave: 'riesgosEspecificos', nombre: 'Riesgos específicos' },
]

/**
 * El texto de la casilla de fotografías: el MISMO que imprime el PDF
 * («Autorizo la toma de fotografías clínicas con fines de documentación médica
 * y seguimiento del tratamiento»), en tercera persona (CI-DT-4). El PDF no se
 * toca; la prueba compara los dos.
 */
export const TEXTO_CASILLA_FOTOS =
  'Autoriza fotografías clínicas con fines de documentación médica y seguimiento del tratamiento'

export interface Faltante { clave: string; nombre: string }

export interface EstadoValidable {
  fecha: string
  lugar: string
  paciente: string
  edad: string
  diagnostico: string
  procedimiento: string
  familiar: string
  pacienteNoPuedeFirmar: boolean
  autorizaTransfusion: 'si' | 'no' | null
  secciones: Readonly<Record<ClaveSeccion, string>>
  esDenegacion: boolean
}

/**
 * Los NUEVE obligatorios del consentimiento y los SIETE de la denegación, en
 * el orden de lectura. Es la regla que vivía en el formulario, sin cambios:
 * el familiar sólo si el paciente no puede firmar (o siempre en denegación),
 * la transfusión sin valor por defecto, y las dos secciones obligatorias.
 */
export function faltantesConsentimiento(e: EstadoValidable): Faltante[] {
  const f: Faltante[] = []
  if (!e.fecha) f.push({ clave: 'fecha', nombre: 'Fecha' })
  if (!e.lugar.trim()) f.push({ clave: 'lugar', nombre: 'Lugar' })
  if (!e.paciente.trim()) f.push({ clave: 'paciente', nombre: 'Paciente' })
  if (!e.edad.trim()) f.push({ clave: 'edad', nombre: 'Edad del paciente' })
  if (!e.esDenegacion && !e.diagnostico.trim()) f.push({ clave: 'diagnostico', nombre: 'Diagnóstico' })
  if (!e.procedimiento.trim()) f.push({ clave: 'procedimiento', nombre: 'Procedimiento' })
  if (!e.familiar.trim() && (e.esDenegacion || e.pacienteNoPuedeFirmar)) {
    f.push({ clave: 'familiar', nombre: 'Familiar responsable o representante legal' })
  }
  if (!e.esDenegacion && e.autorizaTransfusion === null) {
    f.push({ clave: 'transfusion', nombre: 'Autorización de transfusión' })
  }
  if (!e.esDenegacion) {
    for (const s of SECCIONES_OBLIGATORIAS) {
      if (!e.secciones[s.clave].trim()) f.push({ clave: `seccion-${s.clave}`, nombre: s.nombre })
    }
  }
  return f
}

/** En qué bloque de la captura vive cada faltante. La fecha va con los datos. */
export function bloqueDeFaltante(clave: string): BloqueConsentimiento {
  if (clave.startsWith('seccion-')) return 'txt'
  if (clave === 'transfusion') return 'aut'
  if (clave === 'familiar') return 'fir'
  return 'dat'
}

// ── Resúmenes de una línea ──────────────────────────────────────────────────

export interface Resumen { texto: string; completa: boolean }

export function resumenDatos(d: { paciente: string; edad: string; procedimiento: string; lugar: string; diagnostico: string }): Resumen {
  const partes = [d.paciente.trim(), d.edad.trim(), d.procedimiento.trim()].filter(Boolean)
  const completa = [d.paciente, d.edad, d.lugar, d.diagnostico, d.procedimiento].every(v => v.trim() !== '')
  return { texto: partes.join(' · ') || 'Sin datos', completa }
}

/** Cómo está una sección: con el texto de fábrica, escrita por el médico, u obligatoria vacía. */
export type EstadoSeccion = 'estandar' | 'propia' | 'falta'
export function estadoSeccion(valor: string, defecto: string, obligatoria: boolean): EstadoSeccion {
  if (obligatoria && valor.trim() === '') return 'falta'
  return valor === defecto ? 'estandar' : 'propia'
}
export const TEXTO_ESTADO_SECCION: Record<EstadoSeccion, string> = {
  estandar: 'Texto estándar',
  propia: 'Escrita por ti',
  falta: 'Obligatoria · falta',
}

export function resumenTexto(
  secciones: Readonly<Record<ClaveSeccion, string>>,
  defectos: Readonly<Record<ClaveSeccion, string>>,
): Resumen {
  const obligatorias = SECCIONES_OBLIGATORIAS.map(s => s.clave)
  const estados = CLAVES_SECCION.map(k => estadoSeccion(secciones[k], defectos[k], obligatorias.includes(k)))
  const faltan = estados.filter(e => e === 'falta').length
  const propias = estados.filter(e => e === 'propia').length
  if (faltan > 0) {
    return { texto: faltan === 1 ? 'Falta 1 sección obligatoria' : `Faltan ${faltan} secciones obligatorias`, completa: false }
  }
  return { texto: `7 secciones · ${propias} escrita${propias === 1 ? '' : 's'} por ti`, completa: true }
}

export function resumenAutorizaciones(transfusion: 'si' | 'no' | null, fotos: boolean): Resumen {
  if (transfusion === null) return { texto: 'Falta decidir la transfusión', completa: false }
  return {
    texto: `Transfusión: ${transfusion === 'si' ? 'Sí' : 'No'} · Fotografías: ${fotos ? 'Sí' : 'No'}`,
    completa: true,
  }
}

// ── Quién firma ─────────────────────────────────────────────────────────────

/**
 * Las dos opciones de un toque del bloque 4. Son la MISMA casilla de siempre,
 * `pacienteNoPuedeFirmar`, vista como una elección: «Familiar o representante»
 * ES «el paciente no puede firmar», y su regla —el nombre del familiar pasa a
 * ser obligatorio— no cambia.
 */
export type QuienFirma = 'paciente' | 'familiar'
export function quienFirmaDe(pacienteNoPuedeFirmar: boolean): QuienFirma {
  return pacienteNoPuedeFirmar ? 'familiar' : 'paciente'
}
export function noPuedeFirmarDe(q: QuienFirma): boolean {
  return q === 'familiar'
}

export function resumenFirmantes(d: {
  pacienteNoPuedeFirmar: boolean; familiar: string; testigo1: string; testigo2: string
}): Resumen {
  const n = [d.testigo1, d.testigo2].filter(t => t.trim() !== '').length
  const testigos = n === 0 ? ' · sin testigos' : ` · ${n} testigo${n > 1 ? 's' : ''}`
  if (d.pacienteNoPuedeFirmar) {
    const nombre = d.familiar.trim()
    return { texto: `Firma ${nombre || 'un familiar o representante'}${testigos}`, completa: nombre !== '' }
  }
  const acomp = d.familiar.trim() ? ` y ${d.familiar.trim()}` : ''
  return { texto: `Firma el paciente${acomp}${testigos}`, completa: true }
}

// ── Fecha y edad al firmar (CI-DT-3) ────────────────────────────────────────

export interface FechaYEdad {
  fecha: string
  edad: string
  /** La edad no salió de la ficha: la tecleó el médico y se respeta (se le enseña en la revisión). */
  edadManual: boolean
}

/** La edad de la ficha en un día dado, redactada como la escribe el formulario. */
function edadEn(fechaNacimiento: string, dia: string): string | null {
  try { return calcularEdad(fechaNacimiento, dia).textoElegante } catch { return null }
}

/**
 * La fecha del documento es la del DÍA DE LA FIRMA (decisión del dueño). Al
 * firmar en el dispositivo o al imprimir para papel, la fecha pasa a `hoy`, y
 * la edad se recalcula desde la ficha SI la que hay salió de la ficha en la
 * fecha que tenía el documento. Si el médico la tecleó a mano, se respeta.
 *
 * Sin fecha de nacimiento en la ficha no hay con qué recalcular: la edad se
 * deja como está y cuenta como manual.
 */
export function fechaYEdadAlFirmar(p: {
  hoy: string; fechaActual: string; edadActual: string; fechaNacimiento?: string | null
}): FechaYEdad {
  const edad = p.edadActual.trim()
  const fn = p.fechaNacimiento?.trim() || null
  if (!fn) return { fecha: p.hoy, edad: p.edadActual, edadManual: edad !== '' }
  const deHoy = edadEn(fn, p.hoy)
  if (deHoy === null) return { fecha: p.hoy, edad: p.edadActual, edadManual: edad !== '' }
  const deEntonces = p.fechaActual ? edadEn(fn, p.fechaActual) : null
  if (edad === '' || edad === deHoy || edad === deEntonces) return { fecha: p.hoy, edad: deHoy, edadManual: false }
  return { fecha: p.hoy, edad: p.edadActual, edadManual: true }
}

// ── Plantillas sin testigos (CI-DT-19) ──────────────────────────────────────

/**
 * Lo que una plantilla de consentimiento guarda: lugar, procedimiento y las
 * siete secciones. Los testigos YA NO (cambian siempre y suelen ser
 * familiares: copiarlos llevaría datos de un tercero a otro expediente).
 */
export function plantillaConsentimiento(lugar: string, procedimiento: string, secciones: Readonly<Record<ClaveSeccion, string>>): {
  _v: 1; lugar: string; procedimiento: string; secciones: Record<ClaveSeccion, string>
} {
  return { _v: 1, lugar, procedimiento, secciones: { ...secciones } }
}

/**
 * Lugar y procedimiento de una plantilla (de esta versión o de una antigua). Una
 * antigua con `testigo1`/`testigo2` los trae, y aquí se IGNORAN: aplicarla no
 * toca los testigos que haya en pantalla.
 */
export function camposDePlantilla(c: Readonly<Record<string, unknown>>): { lugar: string; procedimiento: string } {
  return {
    lugar: typeof c.lugar === 'string' ? c.lugar : '',
    procedimiento: typeof c.procedimiento === 'string' ? c.procedimiento : '',
  }
}

// ── Estado de un borrador (pendientes visibles) ─────────────────────────────

function txt(v: unknown): string { return typeof v === 'string' ? v : '' }

/**
 * Lo que le falta a un borrador guardado, leído de su `contenido` con la misma
 * regla que el formulario. Lo que falte en el jsonb (otra versión del
 * formulario) cuenta como vacío; las secciones ausentes, como su texto de
 * fábrica —que en las dos obligatorias es vacío—.
 */
export function faltantesDeBorrador(contenido: Readonly<Record<string, unknown>> | null): Faltante[] {
  const c = contenido ?? {}
  const s = (c.secciones && typeof c.secciones === 'object') ? c.secciones as Record<string, unknown> : {}
  // Sólo cuentan las dos obligatorias (las otras cinco no pueden faltar).
  const secciones: Record<ClaveSeccion, string> = {
    preoperatorio: txt(s.preoperatorio), beneficios: txt(s.beneficios), anestesia: txt(s.anestesia),
    descripcion: txt(s.descripcion), riesgosComunes: txt(s.riesgosComunes),
    riesgosEspecificos: txt(s.riesgosEspecificos), alternativas: txt(s.alternativas),
  }
  const t = c.autorizaTransfusion
  return faltantesConsentimiento({
    fecha: txt(c.fecha) || 'hoy', lugar: txt(c.lugar), paciente: txt(c.paciente), edad: txt(c.edad),
    diagnostico: txt(c.diagnostico), procedimiento: txt(c.procedimiento), familiar: txt(c.familiar),
    pacienteNoPuedeFirmar: c.pacienteNoPuedeFirmar === true,
    autorizaTransfusion: t === 'si' || t === 'no' ? t : null,
    secciones, esDenegacion: false,
  })
}

/** «Falta firmar» si está completo; «Faltan N datos» si no. */
export function estadoBorrador(contenido: Readonly<Record<string, unknown>> | null): { etiqueta: string; faltan: number } {
  const n = faltantesDeBorrador(contenido).length
  if (n === 0) return { etiqueta: 'Falta firmar', faltan: 0 }
  return { etiqueta: n === 1 ? 'Falta 1 dato' : `Faltan ${n} datos`, faltan: n }
}

// ── Regenerar (CI-DT-1) ─────────────────────────────────────────────────────

/**
 * Un consentimiento (o denegación) SELLADO no se vuelve a generar: «Regenerar»
 * recompone sólo desde `contenido`, sin firmas, sello ni identificaciones, y
 * dejaría en el expediente un papel que afirma que nadie firmó. Decisión del
 * dueño. El resto de tipos y estados, como siempre.
 */
export function ofreceRegenerar(tipo: string, estado: string | null | undefined): boolean {
  const esConsentimiento = tipo === 'consentimiento_informado' || tipo === 'denegacion_consentimiento'
  return !(esConsentimiento && estado === 'firmado')
}
