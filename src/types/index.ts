// ─── Detección de duplicados ──────────────────────────────────────────────────
export interface DuplicatePatientResponse {
  error: 'DUPLICATE_PATIENT'
  existingPatient: {
    id: string
    nombre: string
    apellidos: string
    numero_expediente: string | null
    fecha_nacimiento: string | null
  }
  message: string
}

// ─── Paciente ─────────────────────────────────────────────────────────────────
export interface Paciente {
  id: string
  numero_expediente?: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  edad?: number
  sexo: 'M' | 'F' | 'Otro'
  peso_kg?: number
  talla_cm?: number
  imc?: number
  telefono?: string
  email?: string
  direccion?: string
  // Antecedentes
  ant_patologicos?: string
  ant_quirurgicos?: string
  ant_familiares?: string
  alergias?: string
  medicamentos_actuales?: string
  created_at?: string
  updated_at?: string
}

// ─── Consulta / Expediente ────────────────────────────────────────────────────
export interface Consulta {
  id: string
  paciente_id: string
  fecha: string
  motivo_consulta: string
  exploracion_fisica?: string
  diagnosticos?: Diagnostico[]
  plan_tratamiento?: string
  notas_evolucion?: string
  proxima_cita?: string
  // Origen de la nota: 'ia' = Gemini, 'manual' = escrita por el médico
  nota_origen?: 'ia' | 'manual'
  // Médico que creó la nota — inmutable tras la creación
  medico_nombre?: string | null
  medico_especialidad?: string | null
  medico_cedula_profesional?: string | null
  medico_cedula_especialidad?: string | null
  medico_logo_url?: string | null
  created_at?: string
}

export interface Diagnostico {
  codigo_cie10?: string
  descripcion: string
}

// ─── Plan de Suplementación (usado por DocumentoContenido) ───────────────────
export interface SuplementoRec {
  nombre: string
  dosis?: string
  justificacion: string
  prioridad: 'alta' | 'media' | 'baja'
}

// ─── Médico (perfil del doctor autenticado) ───────────────────────────────────
export interface MedicoInfo {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  universidad?: string | null
  logo_url: string | null
  /** Signed URL (1h) de la firma autógrafa en PNG transparente */
  firma_url?: string | null
  color_primario: string
  color_secundario: string
  direccion_consultorio: string
  telefono_consultorio: string
  clinica_nombre?: string
}

// ─── Documentos ───────────────────────────────────────────────────────────────
export type TipoDocumento =
  | 'receta'
  | 'solicitud_lab'
  | 'solicitud_imagen'
  | 'informe_clinico'
  | 'plan_suplementacion'
  | 'solicitud_internamiento'
  | 'escrito_medico'
  | 'nota_honorarios'
  | 'consentimiento_informado'
  | 'resultado_laboratorio'
  | 'estudio_imagen'
  // Legacy (documentos existentes en DB antes del rename)
  | 'lab'
  | 'imagen'

export interface Documento {
  id: string
  paciente_id: string
  consulta_id?: string
  tipo: TipoDocumento
  contenido: DocumentoContenido
  pdf_url?: string
  // Metadata de uploads clínicos (sub-fase 6A). NULL en documentos generados por la app.
  storage_bucket?: string | null
  storage_path?: string | null
  mime_type?: string | null
  tamaño_bytes?: number | null
  nombre_original?: string | null
  subido_por?: string | null
  created_at?: string
}

export interface DocumentoContenido {
  fecha?: string
  diagnostico?: string
  paciente?: string
  folio?: string
  // Receta
  medicamentos?: Medicamento[]
  recomendaciones?: string
  // Solicitudes
  estudios?: (string | { tipo?: string; region?: string; proyecciones?: string; indicacion?: string })[]
  indicacion_clinica?: string
  region?: string
  notas?: string
  urgente?: boolean
  // Suplementación
  suplementos?: SuplementoRec[]
  seleccionados?: { nombre: string; dosis: string; frecuencia: string; duracion: string; notas?: string }[]
  // Internamiento
  motivo?: string
  servicio?: string
  medico_tratante?: string
  // Escrito médico
  titulo?: string
  cuerpo?: string
  // Honorarios
  lineas?: { concepto: string; cantidad: number; precio: number }[]
  monto?: number
  divisa?: string
  forma_pago?: string
  // Informe
  resumen?: string
  // Flexible para contenido adicional
  [key: string]: unknown
}

export interface Medicamento {
  nombre_comercial: string
  presentacion?: string
  dosis?: string
  principio_activo?: string
  indicacion: string
}

// ─── Laboratorios — catálogo y mediciones ────────────────────────────────────
// Interfaces del modelo mediciones_analitos + analitos_catalogo.

export type CategoriaAnalito =
  | 'antropometria'
  | 'signos_vitales'
  | 'hematologia'
  | 'quimica'
  | 'hueso'
  | 'endocrino'
  | 'inmunologia'
  | 'coagulacion'
  | 'cardiaco'
  | 'marcador_tumoral'
  | 'vitaminas_minerales'
  | 'otros'

export type BandsType = 'high-bad' | 'low-bad' | 'low-and-high-bad' | 'none'

export interface RangoAnalito {
  ok_min?: number
  ok_max?: number
  warn_min?: number
  warn_max?: number
}

export interface AnalitoCatalogo {
  id: string
  clave: string
  nombre: string
  nombres_alternativos: string[]
  categoria: CategoriaAnalito
  unidad: string
  bands_type: BandsType
  rango_default: RangoAnalito | null
  rango_femenino: RangoAnalito | null
  rango_masculino: RangoAnalito | null
  precision_decimales: number
  activo: boolean
  created_at: string
}

export interface MedicionAnalito {
  id: string
  paciente_id: string
  analito_id: string | null
  nombre_custom: string | null
  unidad_custom: string | null
  categoria_custom: string | null
  valor: number
  medido_en: string
  notas: string | null
  creado_por: string
  created_at: string
}

// ─── Honorarios / Plantillas ─────────────────────────────────────────────────
export interface AseguradoraInfo {
  nombre: string
  poliza: string
  cobertura: string
}

export interface HonorariosTemplate {
  id: string
  nombre: string
  contenido: {
    tipoDoc: 'honorarios' | 'cotizacion'
    lineas: { concepto: string; precio: number }[]
    divisa: 'MXN' | 'USD'
    formaPago: string
    notas: string
    aseguradora: AseguradoraInfo | null
  }
}
