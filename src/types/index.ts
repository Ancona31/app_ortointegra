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
  fecha_nacimiento: string
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

// ─── Laboratorio ──────────────────────────────────────────────────────────────
export interface ResultadoLab {
  nombre: string
  valor: number | string
  unidad?: string
  rango_ref?: string
  rango_optimo?: string
  estado?: 'optimo' | 'suboptimo' | 'bajo' | 'alto' | 'normal'
  nota_clinica?: string | null
}

export interface Laboratorio {
  id: string
  paciente_id: string
  fecha_toma: string
  pdf_url?: string
  valores: ValoresLab
  resultados?: ResultadoLab[]
  analisis_ia?: AnalisisIA
  created_at?: string
}

export interface ValoresLab {
  vitamina_d?: number         // ng/mL
  insulina_basal?: number     // uIU/mL
  trigliceridos?: number      // mg/dL
  pcr_us?: number             // mg/L
  albumina?: number           // g/dL
  tgp_alt?: number            // U/L
  tsh?: number                // mIU/L
  hba1c?: number              // %
  creatinina?: number         // mg/dL
  cistatina_c?: number        // mg/L
  // Espacio para otros valores
  [key: string]: number | undefined
}

// ─── Análisis IA ──────────────────────────────────────────────────────────────
export interface AnalisisIA {
  suplementos_recomendados: SuplementoRec[]
  alertas: Alerta[]
  resumen_clinico: string
  generado_en?: string
}

export interface SuplementoRec {
  nombre: string
  dosis?: string
  justificacion: string
  prioridad: 'alta' | 'media' | 'baja'
}

export interface Alerta {
  tipo: 'critica' | 'warning' | 'info'
  parametro: string
  mensaje: string
  valor_actual?: number
  valor_optimo?: string
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

// ─── Valores de Referencia ────────────────────────────────────────────────────
export const VALORES_REFERENCIA = {
  vitamina_d:     { ref_min: 20,   ref_max: 30,   opt_min: 40,   opt_max: 60,   unidad: 'ng/mL',  label: 'Vitamina D 25-OH' },
  insulina_basal: { ref_min: 2.6,  ref_max: 24.9, opt_min: null, opt_max: 8,    unidad: 'uIU/mL', label: 'Insulina Basal' },
  trigliceridos:  { ref_min: null, ref_max: 150,  opt_min: null, opt_max: 100,  unidad: 'mg/dL',  label: 'Triglicéridos' },
  pcr_us:         { ref_min: null, ref_max: 3.0,  opt_min: null, opt_max: 1.0,  unidad: 'mg/L',   label: 'PCR-us' },
  albumina:       { ref_min: 3.5,  ref_max: 5.2,  opt_min: 4.2,  opt_max: null, unidad: 'g/dL',   label: 'Albúmina' },
  tgp_alt:        { ref_min: 0,    ref_max: 41,   opt_min: null, opt_max: 30,   unidad: 'U/L',    label: 'TGP (ALT)' },
  tsh:            { ref_min: 0.4,  ref_max: 4.5,  opt_min: 1.0,  opt_max: 2.5,  unidad: 'mIU/L',  label: 'TSH' },
  hba1c:          { ref_min: null, ref_max: 5.7,  opt_min: 4.8,  opt_max: 5.3,  unidad: '%',      label: 'HbA1c' },
  creatinina:     { ref_min: 0.7,  ref_max: 1.3,  opt_min: null, opt_max: null, unidad: 'mg/dL',  label: 'Creatinina' },
  cistatina_c:    { ref_min: 0.6,  ref_max: 1.0,  opt_min: null, opt_max: 0.9,  unidad: 'mg/L',   label: 'Cistatina C' },
} as const

export type ParametroLab = keyof typeof VALORES_REFERENCIA

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
