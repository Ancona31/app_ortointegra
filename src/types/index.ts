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
  existingPatientIsMine?: boolean
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
  ant_no_patologicos?: string
  ant_patologicos?: string
  ant_quirurgicos?: string
  ant_familiares?: string
  alergias?: string
  medicamentos_actuales?: string
  created_at?: string
  updated_at?: string
}

// ─── Signos vitales (snapshot por consulta) ──────────────────────────────────
// Todos los campos numéricos y opcionales; ausente/undefined = no capturado.
export interface SignosVitales {
  ta_sistolica?: number
  ta_diastolica?: number
  fc?: number
  fr?: number
  temp?: number
  spo2?: number
  peso_kg?: number
  talla_cm?: number
}

// Medicamento tal como se guarda en consultas.medicamentos (jsonb). Shape real
// del formulario de nueva-nota (MedRow). NO confundir con Medicamento (recetas),
// que tiene una forma distinta.
export interface MedicamentoConsulta {
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
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
  // Médico que creó la nota (id vivo del profile). Snapshot inmutable aparte
  // en los campos medico_* de abajo.
  medico_id?: string
  // Medicamentos prescritos en la consulta (jsonb). Ver MedicamentoConsulta.
  medicamentos?: MedicamentoConsulta[]
  // Pronóstico clínico de la consulta.
  pronostico?: string
  // Snapshot de signos vitales tomados en la consulta.
  signos_vitales?: SignosVitales | null
  // Origen de la nota: 'ia' = Gemini, 'manual' = escrita por el médico
  nota_origen?: 'ia' | 'manual'
  // Médico que creó la nota — inmutable tras la creación
  medico_nombre?: string | null
  medico_especialidad?: string | null
  medico_cedula_profesional?: string | null
  medico_cedula_especialidad?: string | null
  medico_logo_url?: string | null
  created_at?: string
  // Snapshot inmutable del consultorio (Fase 2.6 multiconsultorio).
  // Se congela al momento de crear la consulta. Si null, es consulta legacy
  // pre-multiconsultorio (renderizador usa fallback a datos del médico).
  consultorio_id?: string | null
  consultorio_nombre?: string | null
  consultorio_nombre_corto?: string | null
  consultorio_direccion?: string | null
  consultorio_telefono?: string | null
  consultorio_timezone?: string | null
}

/**
 * Cita agendada en calendario (tabla appointments).
 *
 * Espejo completo del schema BD. Incluye snapshot inmutable de consultorio
 * (Fase 2.6 multiconsultorio): los 6 campos consultorio_* se congelan al
 * momento de crear la cita y pueden actualizarse vía PATCH antes de que la
 * cita se convierta en consulta.
 */
export interface Appointment {
  id: string
  clinica_id: string
  paciente_id: string | null
  created_by: string | null
  title: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show'
  notes: string | null
  google_event_id: string | null
  whatsapp_sent_at?: string | null
  whatsapp_reminder_sent_at?: string | null
  gcal_sync_status: 'synced' | 'pending' | 'failed'
  medico_id: string | null
  // Identificador de idempotencia del outbox-engine offline. La feature
  // del outbox fue eliminada en abril 2026 (ver CLAUDE.md), pero la columna
  // persiste en BD por convención forward-only de migraciones. Conservado
  // en el tipo por fidelidad al schema; ningún código nuevo debe usarlo.
  client_id?: string | null
  created_at?: string
  updated_at?: string
  // Snapshot inmutable del consultorio (Fase 2.6).
  consultorio_id?: string | null
  consultorio_nombre?: string | null
  consultorio_nombre_corto?: string | null
  consultorio_direccion?: string | null
  consultorio_telefono?: string | null
  consultorio_timezone?: string | null
}

/**
 * Consultorio del médico (tabla consultorios — Fase 2.1).
 *
 * Espejo completo del schema BD. Un médico puede tener hasta 10 consultorios
 * activos (cap enforzado por trigger BD). Soft-delete vía activo=false +
 * fecha_baja; archivados no se exponen al usuario por diseño (R1).
 */
export interface Consultorio {
  id: string
  clinica_id: string
  medico_id: string
  nombre: string
  nombre_corto: string
  direccion: string
  telefono: string | null
  timezone: string
  horario: {
    lunes: { activo: boolean; inicio: string; fin: string }
    martes: { activo: boolean; inicio: string; fin: string }
    miercoles: { activo: boolean; inicio: string; fin: string }
    jueves: { activo: boolean; inicio: string; fin: string }
    viernes: { activo: boolean; inicio: string; fin: string }
    sabado: { activo: boolean; inicio: string; fin: string }
    domingo: { activo: boolean; inicio: string; fin: string }
  }
  es_default: boolean
  activo: boolean
  fecha_baja: string | null
  created_at: string
  updated_at: string
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
  titulo?: string | null
  nombres?: string | null
  apellido_paterno?: string | null
  apellido_materno?: string | null
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
  /**
   * ⚠ **NUNCA SE USÓ, Y YA NO VA A USARSE.** Nació como interruptor por médico
   * del despliegue de documentos v2; el encendido acabó siendo para todos a la
   * vez, tras probar los nueve documentos en la rama.
   *
   * Su migración —`20260804_profiles_flag_documentos_v2.sql`— **se queda sin
   * aplicar**, así que la columna no existe en producción y `/api/medico` no la
   * selecciona. El interruptor de verdad es `VERSION_DE_EMISION`, en
   * `src/lib/mobileShare.ts`, y es una constante: ver su nota para el porqué.
   *
   * No lo leas desde ningún sitio. Está aquí para que quien lo encuentre en la
   * migración sepa que no es un cable suelto.
   */
  usa_documentos_v2?: boolean
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
  // Documento INDEPENDIENTE que se emite EN LUGAR del consentimiento, no como
  // hoja suya: si el paciente deniega, no se imprimen las siete hojas que
  // explican y otorgan lo que acaba de rechazar. Tipo propio y no
  // discriminador dentro de `contenido` —al revés que Honorarios/Cotización—
  // porque los dos actos son opuestos y confundirlos en una lista sí hace daño.
  | 'denegacion_consentimiento'
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
  /**
   * Chasis de diseño con el que se emitió el documento (1 = v1, 2 = v2).
   * Columna en DB: NOT NULL DEFAULT 1. Opcional aquí porque la migración
   * `20260804_documentos_formato_version.sql` todavía no está aplicada, así que
   * a runtime llega `undefined`. Es la señal que usa el guard de regeneración
   * en ModalDocumentos.tsx: si no se puede establecer la versión, no se
   * regenera.
   */
  formato_version?: 1 | 2
  /**
   * Estado del documento — hoy solo lo mueve el consentimiento informado
   * (`20260812_documentos_estado.sql`). `borrador` es trabajo sin terminar: no
   * tiene folio, no tiene PDF y solo lo ve su autor. Los otros dos son
   * TERMINALES: de ellos no se vuelve, ni se pasa de uno al otro.
   *
   * Opcional aquí, como `formato_version`: la columna es `NOT NULL DEFAULT
   * 'emitido_firma_manual'`, así que quien no la pida en el `select` la recibe
   * `undefined` y debe tratarse como emitida.
   */
  estado?: 'borrador' | 'emitido_firma_manual' | 'firmado'
  /**
   * FOLIO DE LA SERIE, columna propia y escrita por la base
   * (`20260807_folio_01_esquema_y_generador.sql`). El cliente no lo propone: el
   * trigger lo rechaza.
   *
   * `null` en tres casos legítimos y en ninguno más: un borrador —lo recibe al
   * salir de ese estado—, un formato sin clase de folio —`escrito_medico`— y
   * las filas anteriores al generador.
   *
   * **ES TAMBIÉN EL FOLIO QUE IMPRIME LA RECETA, y el que codifica su QR de
   * verificación.** Lo fue desde agosto de 2026: antes imprimía un `R-…` propio
   * que el navegador generaba y que guardaba en `contenido.folio`, y que
   * `/r/[folio]` no resuelve. Las recetas de entonces conservan esa clave y se
   * regeneran con ella.
   *
   * Qué formatos imprimen esta columna lo decide `folioImpreso()` en
   * `src/lib/documentos/folio.ts`, que es el único sitio donde está escrito.
   */
  folio?: string | null
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
