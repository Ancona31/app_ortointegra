/**
 * notaRenderData.ts — arma los datos de una nota clínica listos para render.
 *
 * Módulo neutro (sin dependencias de cliente/servidor): recibe TODO por
 * parámetro (sin fetch) y devuelve un {@link NotaRenderData} que cualquier
 * render (PDF, visor, formulario) consume tal cual. La única lógica es la
 * cascada de fuentes (snapshot inmutable de la consulta → médico vivo → '')
 * y el formateo de fechas en la zona de la clínica.
 *
 * ─── LA ZONA DE LA CLÍNICA AQUÍ ES DELIBERADA. NO LA "ARREGLES". ───────
 *
 * `renderEnTZ` se llama con `TZ_CLINICA` a propósito. Esto NO es el bug de
 * husos de agosto de 2026, aunque se le parezca: aquel era de horas de
 * CITAS, que se pintan en el huso del DISPOSITIVO de quien mira (ver LA
 * REGLA en la cabecera de `@/lib/dates`).
 *
 * Hasta agosto de 2026 el huso se OMITÍA y la zona de la clínica llegaba
 * sola, por el valor por defecto de `renderEnTZ`. Ese default se quitó: la
 * decisión no ha cambiado, sólo dejó de ser tácita. Que el huso esté
 * escrito aquí no es un descuido de quien auditó los llamadores; es el
 * resultado de la auditoría.
 *
 * Un DOCUMENTO CLÍNICO es la excepción, y por eso vive aquí. Lleva fecha
 * fija de la clínica y NO puede cambiar según quién lo abra: una nota es
 * inmutable y su fecha forma parte del expediente. Si el huso dependiera
 * del lector, el mismo PDF saldría fechado distinto para el médico que lo
 * firmó y para el perito que lo revisa. Decisión de producto, tomada a
 * propósito.
 */

import type { Consulta, Paciente, MedicoInfo, Diagnostico, SignosVitales } from '@/types'
import { parseNota, type NotaParseada } from '@/lib/notaParser'
import { calcularEdad, type EdadPaciente } from '@/lib/patientUtils'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { decodificarEntidadesHTML } from '@/lib/textUtils'

/** Formato de fecha legible en español para encabezados de nota y addendums. */
const FMT_FECHA = "d 'de' MMMM 'de' yyyy"

/** Placeholder cuando una fecha no es renderizable. */
const SIN_FECHA = '—'

type Instante = string | Date | null | undefined

/**
 * Formatea en la zona de la clínica SIN poder lanzar. Devuelve null si el valor
 * está ausente o no representa una fecha real.
 *
 * `renderEnTZ` delega en `formatInTimeZone`, que lanza `RangeError: Invalid time
 * value` ante una fecha inválida. Eso era tolerable cuando cada PDF formateaba
 * una nota: reventaba esa nota y ya. Desde el export del expediente completo
 * (Fase 6) se formatean N notas en un solo documento, y una sola fila corrupta
 * tumbaba el PDF entero. Aquí la fila degrada y el resto del expediente sale.
 *
 * Doble red a propósito: el chequeo con `new Date()` cubre el caso normal, y el
 * try/catch cubre que el parser de date-fns y el de `Date` no coincidan al 100%
 * en formatos raros.
 */
function renderFechaSegura(instante: Instante, formato: string): string | null {
  if (instante === null || instante === undefined || instante === '') return null
  const parsed = instante instanceof Date ? instante : new Date(instante)
  if (Number.isNaN(parsed.getTime())) return null
  try {
    return renderEnTZ(instante, formato, TZ_CLINICA)
  } catch {
    return null
  }
}

/** Fecha larga del encabezado: "21 de julio de 2026". Inválida → "—". */
function formatearFechaLarga(instante: Instante): string {
  return renderFechaSegura(instante, FMT_FECHA) ?? SIN_FECHA
}

/**
 * Formatea una hora al formato compacto del encabezado de nota: "11:50 a.m.".
 * renderEnTZ con locale es produce p.ej. "11:50 a. m." (minúsculas con espacio
 * interno); se compacta el "a. m." → "a.m." (y "p. m." → "p.m.") sin espacio.
 */
function formatearHoraCompacta(instante: Instante): string {
  const salida = renderFechaSegura(instante, 'h:mm a')
  if (salida === null) return SIN_FECHA
  return salida
    .toLowerCase()
    .replace(/([ap])\.?\s*m\.?/i, '$1.m.')
}

/**
 * Formatea una fecha al formato corto del chip de encabezado: "21 / jul / 2026".
 * renderEnTZ con locale es produce el mes abreviado con punto ("jul."); se pasa
 * a minúsculas y se eliminan los puntos para dejar "21 / jul / 2026".
 */
function formatearFechaCorta(instante: Instante): string {
  const salida = renderFechaSegura(instante, 'dd / MMM / yyyy')
  if (salida === null) return SIN_FECHA
  return salida
    .toLowerCase()
    .replace(/\./g, '')
}

/**
 * `consultas.proxima_cita` es una columna TEXT LIBRE (baseline/02_tables.sql:186),
 * no un timestamp. Las notas viejas guardan ahí cosas como "en 2 semanas" o
 * "al terminar rehabilitación", perfectamente legítimas.
 *
 * Por eso este campo NO cae a "—" cuando no parsea: se devuelve el texto tal
 * cual, que es exactamente lo que el médico escribió. Solo se formatea cuando
 * el valor sí es una fecha.
 */
function formatearProximaCita(valor: string | null | undefined): string | null {
  const texto = valor?.trim()
  if (!texto) return null
  return renderFechaSegura(texto, FMT_FECHA) ?? texto
}

/** Addendum tal como llega desde BD (input; el módulo no lo consulta). */
export interface AddendumInput {
  contenido: string | null
  medico_nombre?: string | null
  created_at?: string | null
}

/** Addendum ya formateado para render. */
export interface AddendumRender {
  parseado: NotaParseada
  medicoNombre: string
  fechaFormateada: string
}

export interface NotaRenderData {
  paciente: {
    nombreCompleto: string
    edad: EdadPaciente | null
    sexo: Paciente['sexo']
    numeroExpediente: string
    alergias: string
    pesoKg: number | null
    tallaCm: number | null
    imc: number | null
  }
  medico: {
    nombre: string
    especialidad: string
    cedulaProfesional: string
    cedulaEspecialidad: string
    logoUrl: string
    firmaUrl: string
    // Colores del perfil para tematizar el PDF. Ausentes → la plantilla cae a
    // su paleta azul del mockup (fallback total en derivarPaletaNota).
    colorPrimario?: string
    colorSecundario?: string
  }
  consultorio: {
    nombre: string
    nombreCorto: string
    direccion: string
    telefono: string
  }
  fechaFormateada: string
  fechaCorta: string
  horaFormateada: string
  diagnosticos: Diagnostico[]
  motivoConsulta: string
  signosVitales: SignosVitales | null
  proximaCita: string | null
  notaOrigen: 'ia' | 'manual' | null
  notaParseada: NotaParseada
  addendums: AddendumRender[]
}

/** Consultorio en vuelo (formulario); solo los campos que el render necesita. */
interface ConsultorioLike {
  nombre?: string | null
  nombre_corto?: string | null
  direccion?: string | null
  telefono?: string | null
}

/**
 * Input de {@link buildNotaRenderData}. Dos orígenes soportados vía discriminante:
 *  - 'consulta': consulta ya guardada (usa snapshot medico_* y consultorio_*).
 *  - 'formulario': datos en vuelo, aún sin snapshot (todo desde fuentes vivas).
 */
export type BuildNotaInput =
  | {
      origen: 'consulta'
      consulta: Consulta
      paciente: Paciente
      addendums?: AddendumInput[]
      medicoVivo?: MedicoInfo | null
    }
  | {
      origen: 'formulario'
      paciente: Paciente
      medicoVivo: MedicoInfo
      consultorio?: ConsultorioLike | null
      fecha: string
      notasEvolucion: string | null
      diagnosticos: Diagnostico[]
      motivoConsulta: string
      signosVitales?: SignosVitales | null
      proximaCita?: string | null
      notaOrigen?: 'ia' | 'manual' | null
    }

function construirPaciente(p: Paciente): NotaRenderData['paciente'] {
  return {
    nombreCompleto: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim(),
    edad: p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null,
    sexo: p.sexo,
    numeroExpediente: p.numero_expediente ?? '',
    alergias: p.alergias ?? '',
    pesoKg: p.peso_kg ?? null,
    tallaCm: p.talla_cm ?? null,
    imc: p.imc ?? null,
  }
}

function construirMedicoDesdeConsulta(c: Consulta, vivo?: MedicoInfo | null): NotaRenderData['medico'] {
  return {
    nombre: c.medico_nombre?.trim() || (vivo ? componerNombreMedicoCompleto(vivo) : ''),
    especialidad: c.medico_especialidad ?? vivo?.especialidad ?? '',
    cedulaProfesional: c.medico_cedula_profesional ?? vivo?.cedula_profesional ?? '',
    cedulaEspecialidad: c.medico_cedula_especialidad ?? vivo?.cedula_especialidad ?? '',
    logoUrl: c.medico_logo_url ?? vivo?.logo_url ?? '',
    // EXCEPCIÓN: la firma SIEMPRE sale del médico vivo. Todavía no existe snapshot
    // consultas.medico_firma_*; se agregará consultas.medico_firma_path en el
    // Paquete Firma. Hasta entonces se resuelve contra el perfil vivo aunque el
    // resto del bloque médico sea snapshot inmutable.
    firmaUrl: vivo?.firma_url ?? '',
    // MISMA EXCEPCIÓN que la firma: no existe snapshot de color en consultas
    // (solo medico_nombre/especialidad/cedulas/logo_url). El color vive en
    // clinicas y se resuelve contra el perfil vivo, así que notas históricas
    // reflejan el color ACTUAL de la clínica. Deuda futura: consultas.medico_color_*.
    colorPrimario: vivo?.color_primario ?? undefined,
    colorSecundario: vivo?.color_secundario ?? undefined,
  }
}

function construirMedicoDesdeVivo(vivo: MedicoInfo): NotaRenderData['medico'] {
  return {
    nombre: componerNombreMedicoCompleto(vivo) || vivo.nombre || '',
    especialidad: vivo.especialidad ?? '',
    cedulaProfesional: vivo.cedula_profesional ?? '',
    cedulaEspecialidad: vivo.cedula_especialidad ?? '',
    logoUrl: vivo.logo_url ?? '',
    firmaUrl: vivo.firma_url ?? '',
    colorPrimario: vivo.color_primario ?? undefined,
    colorSecundario: vivo.color_secundario ?? undefined,
  }
}

/**
 * "22 de julio de 2026 · 10:33 a.m.". Devuelve '' si `created_at` falta o no es
 * una fecha real: el addendum se sigue mostrando, solo pierde el sello de tiempo.
 */
function formatearFechaAddendum(createdAt: string | null | undefined): string {
  const fecha = renderFechaSegura(createdAt, FMT_FECHA)
  if (fecha === null) return ''
  return `${fecha} · ${formatearHoraCompacta(createdAt)}`
}

function construirAddendums(addendums?: AddendumInput[]): AddendumRender[] {
  return (addendums ?? []).map((a) => ({
    parseado: parseNota(decodificarEntidadesHTML(a.contenido)),
    medicoNombre: a.medico_nombre ?? '',
    // Fecha + hora en la zona de la clínica: "22 de julio de 2026 · 10:33 a.m.".
    // Ausente o corrupta → '' (la plantilla ya tolera el addendum sin fecha).
    fechaFormateada: formatearFechaAddendum(a.created_at),
  }))
}

/** Arma el {@link NotaRenderData} a partir de una consulta guardada o del formulario en vuelo. */
export function buildNotaRenderData(input: BuildNotaInput): NotaRenderData {
  if (input.origen === 'consulta') {
    const { consulta: c, paciente, addendums, medicoVivo } = input
    return {
      paciente: construirPaciente(paciente),
      medico: construirMedicoDesdeConsulta(c, medicoVivo),
      consultorio: {
        nombre: c.consultorio_nombre ?? '',
        nombreCorto: c.consultorio_nombre_corto ?? '',
        direccion: c.consultorio_direccion ?? '',
        telefono: c.consultorio_telefono ?? '',
      },
      fechaFormateada: formatearFechaLarga(c.fecha),
      fechaCorta: formatearFechaCorta(c.fecha),
      horaFormateada: formatearHoraCompacta(c.fecha),
      diagnosticos: c.diagnosticos ?? [],
      motivoConsulta: c.motivo_consulta ?? '',
      signosVitales: c.signos_vitales ?? null,
      proximaCita: formatearProximaCita(c.proxima_cita),
      notaOrigen: c.nota_origen ?? null,
      notaParseada: parseNota(decodificarEntidadesHTML(c.notas_evolucion)),
      addendums: construirAddendums(addendums),
    }
  }

  return {
    paciente: construirPaciente(input.paciente),
    medico: construirMedicoDesdeVivo(input.medicoVivo),
    consultorio: {
      nombre: input.consultorio?.nombre ?? '',
      nombreCorto: input.consultorio?.nombre_corto ?? '',
      direccion: input.consultorio?.direccion ?? '',
      telefono: input.consultorio?.telefono ?? '',
    },
    fechaFormateada: formatearFechaLarga(input.fecha),
    fechaCorta: formatearFechaCorta(input.fecha),
    horaFormateada: formatearHoraCompacta(new Date()),
    diagnosticos: input.diagnosticos,
    motivoConsulta: input.motivoConsulta,
    signosVitales: input.signosVitales ?? null,
    proximaCita: formatearProximaCita(input.proximaCita),
    notaOrigen: input.notaOrigen ?? null,
    notaParseada: parseNota(decodificarEntidadesHTML(input.notasEvolucion)),
    addendums: [],
  }
}
