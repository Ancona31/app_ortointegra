/**
 * hojaFrontalData.ts — arma los datos de la hoja frontal del expediente listos
 * para render.
 *
 * Módulo hermano de {@link file://./notaRenderData.ts}: mismo contrato de
 * neutralidad (sin dependencias de cliente/servidor, sin fetch — recibe TODO por
 * parámetro) y misma responsabilidad acotada: normalizar, formatear y decidir
 * fallbacks para que la plantilla no tenga lógica.
 *
 * NO se fusionó con notaRenderData porque `NotaRenderData` no contiene clínica
 * ni responsable, y añadírselos obligaría a los flujos A y B' (nota suelta) a
 * rellenar campos que no usan.
 *
 * Fechas — dos tratamientos distintos, deliberados:
 *  - `fecha_nacimiento` es `date` en BD (fecha-solo): se ancla a mediodía con
 *    `fechaSoloSegura` y se formatea con date-fns. NUNCA `renderEnTZ`, que
 *    convertiría de zona y podría correr el día.
 *  - `fechaAperturaISO` sale de `consultas.fecha`, que es `timestamptz` (un
 *    instante): se renderiza con `renderEnTZ` en la zona de la clínica, igual
 *    que hace notaRenderData con esa misma columna. `TZ_CLINICA` va escrito a
 *    mano y es deliberado —la hoja frontal es un documento clínico, y su
 *    fecha no puede cambiar según quién lo abra—; hasta agosto de 2026 esa
 *    zona llegaba sola por el valor por defecto de `renderEnTZ`, que se
 *    quitó. La decisión es la misma; sólo dejó de ser tácita.
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Paciente } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import { fechaSoloSegura, renderEnTZ, TZ_CLINICA } from '@/lib/dates'

/** Formato de fecha legible en español, idéntico al de notaRenderData. */
const FMT_FECHA = "d 'de' MMMM 'de' yyyy"

/** Valor que pinta la plantilla cuando un campo obligatorio no tiene dato. */
const SIN_DATO = '—'

/**
 * `pacientes.sexo` es `text` NULLABLE en BD (con CHECK, pero sin NOT NULL),
 * mientras que el tipo `Paciente` lo declara no-nulo. El lookup absorbe esa
 * discrepancia: cualquier valor fuera de la tabla cae a "—".
 */
const SEXO_LABEL: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

/** Datos del paciente ya formateados para la hoja frontal. */
export interface HojaFrontalPaciente {
  nombreCompleto: string
  /** "Masculino" | "Femenino" | "Otro" | "—". */
  sexo: string
  /** Texto elegante de {@link calcularEdad} ("36 años", "8 meses") o "—". */
  edad: string
  /** Fecha-solo formateada, o "—". */
  fechaNacimiento: string
  numeroExpediente: string
  telefono: string | null
  email: string | null
  direccion: string | null
  antNoPatologicos: string | null
  antQuirurgicos: string | null
  antFamiliares: string | null
  medicamentosActuales: string | null
  /** `pacientes.ant_patologicos`. Vacío → null (la plantilla pinta el fallback). */
  padecimientosCronicos: string | null
  /** Vacío → null (la plantilla conmuta la banda roja a su variante neutra). */
  alergias: string | null
}

/** Identidad de la clínica en el banner. */
export interface HojaFrontalClinica {
  /** El consumidor decide: `nombre_display ?? nombre`. */
  nombre: string
  subtitulo: string | null
  logoUrl: string | null
}

export interface HojaFrontalData {
  paciente: HojaFrontalPaciente
  clinica: HojaFrontalClinica
  /** Admin de la clínica — custodia NOM-004. Lo resuelve el caller. */
  responsable: { nombre: string }
  /** Primera nota del expediente, ya formateada. null → la fila pinta "—". */
  fechaApertura: string | null
  /** Colores del perfil para tematizar. Ausentes → paleta azul del mockup. */
  colorPrimario?: string
  colorSecundario?: string
}

/** Input de {@link buildHojaFrontalData}. Todo explícito, nada se consulta. */
export interface BuildHojaFrontalInput {
  paciente: Paciente
  clinica: {
    nombre: string
    subtitulo?: string | null
    logoUrl?: string | null
  }
  /** Nombre ya compuesto del admin de la clínica. */
  responsableNombre?: string | null
  /** ISO de `min(consultas.fecha)`, o null si el paciente no tiene notas. */
  fechaAperturaISO?: string | null
  colorPrimario?: string | null
  colorSecundario?: string | null
}

/** Trim + colapso a null: undefined, '' y '   ' caen todos a null. */
function limpiar(valor: string | null | undefined): string | null {
  const texto = valor?.trim()
  return texto ? texto : null
}

export function buildHojaFrontalData(input: BuildHojaFrontalInput): HojaFrontalData {
  const p = input.paciente

  // Edad y nacimiento comparten guarda: si la fecha en BD está corrupta,
  // `fechaSoloSegura` lanza y ambos campos quedan en "—" en vez de tumbar el PDF.
  let edad = SIN_DATO
  let fechaNacimiento = SIN_DATO
  if (p.fecha_nacimiento) {
    try {
      edad = calcularEdad(p.fecha_nacimiento).textoElegante
      fechaNacimiento = format(fechaSoloSegura(p.fecha_nacimiento), FMT_FECHA, { locale: es })
    } catch {
      /* fecha inválida → ambos conservan SIN_DATO */
    }
  }

  return {
    paciente: {
      nombreCompleto: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim(),
      sexo: SEXO_LABEL[p.sexo] ?? SIN_DATO,
      edad,
      fechaNacimiento,
      numeroExpediente: limpiar(p.numero_expediente) ?? SIN_DATO,
      telefono: limpiar(p.telefono),
      email: limpiar(p.email),
      direccion: limpiar(p.direccion),
      antNoPatologicos: limpiar(p.ant_no_patologicos),
      antQuirurgicos: limpiar(p.ant_quirurgicos),
      antFamiliares: limpiar(p.ant_familiares),
      medicamentosActuales: limpiar(p.medicamentos_actuales),
      padecimientosCronicos: limpiar(p.ant_patologicos),
      alergias: limpiar(p.alergias),
    },
    clinica: {
      nombre: limpiar(input.clinica.nombre) ?? SIN_DATO,
      subtitulo: limpiar(input.clinica.subtitulo),
      logoUrl: limpiar(input.clinica.logoUrl),
    },
    responsable: { nombre: limpiar(input.responsableNombre) ?? SIN_DATO },
    fechaApertura: input.fechaAperturaISO
      ? renderEnTZ(input.fechaAperturaISO, FMT_FECHA, TZ_CLINICA)
      : null,
    colorPrimario: limpiar(input.colorPrimario) ?? undefined,
    colorSecundario: limpiar(input.colorSecundario) ?? undefined,
  }
}
