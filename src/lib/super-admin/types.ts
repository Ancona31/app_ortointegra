/**
 * Tipos compartidos y schemas Zod para el dashboard de super_admin.
 *
 * Reglas:
 * - Cero `any`. Cero `as` para silenciar errores.
 * - Cada respuesta de API tiene su Zod schema paralelo.
 * - Los estados de carga usan discriminated unions.
 */

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Estado asíncrono compartido
// ──────────────────────────────────────────────────────────────────

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }

// ──────────────────────────────────────────────────────────────────
// Errores de API
// ──────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
}

export const apiErrorSchema = z.object({
  error: z.string(),
})

// ──────────────────────────────────────────────────────────────────
// Sección 1 — Resumen ejecutivo
// ──────────────────────────────────────────────────────────────────

export type Direccion = 'up' | 'down' | 'flat'

export interface KpiVariacion {
  valor: number
  variacionPct: number | null
  direccion: Direccion
}

export const kpiVariacionSchema: z.ZodType<KpiVariacion> = z.object({
  valor: z.number(),
  variacionPct: z.number().nullable(),
  direccion: z.union([z.literal('up'), z.literal('down'), z.literal('flat')]),
})

export interface SeriePunto {
  fecha: string
  valor: number
}

export const seriePuntoSchema: z.ZodType<SeriePunto> = z.object({
  fecha: z.string(),
  valor: z.number(),
})

export interface DistribucionItem {
  etiqueta: string
  valor: number
  color: string
}

export const distribucionItemSchema: z.ZodType<DistribucionItem> = z.object({
  etiqueta: z.string(),
  valor: z.number(),
  color: z.string(),
})

export interface ResumenEjecutivo {
  totalClinicas: KpiVariacion
  totalMedicosActivos: KpiVariacion
  totalPacientes: KpiVariacion
  totalConsultas: KpiVariacion
  mrr: KpiVariacion
  consultasHoy: KpiVariacion
  serieClinicasPorMes: SeriePunto[]
  serieConsultasPorDia: SeriePunto[]
  serieIngresosPorMes: SeriePunto[]
  documentosPorTipo: DistribucionItem[]
  distribucionPlanes: DistribucionItem[]
  serieIaPorDia: SeriePunto[]
}

export const resumenEjecutivoSchema: z.ZodType<ResumenEjecutivo> = z.object({
  totalClinicas: kpiVariacionSchema,
  totalMedicosActivos: kpiVariacionSchema,
  totalPacientes: kpiVariacionSchema,
  totalConsultas: kpiVariacionSchema,
  mrr: kpiVariacionSchema,
  consultasHoy: kpiVariacionSchema,
  serieClinicasPorMes: z.array(seriePuntoSchema),
  serieConsultasPorDia: z.array(seriePuntoSchema),
  serieIngresosPorMes: z.array(seriePuntoSchema),
  documentosPorTipo: z.array(distribucionItemSchema),
  distribucionPlanes: z.array(distribucionItemSchema),
  serieIaPorDia: z.array(seriePuntoSchema),
})

// ──────────────────────────────────────────────────────────────────
// Sección 2 — Clínicas y usuarios
// ──────────────────────────────────────────────────────────────────

export type TipoCuenta = 'clinica' | 'independiente'
export type EstadoClinica = 'activa' | 'suspendida' | 'inactiva'
export type EstadoPago = 'gratuito' | 'trial' | 'pagando' | 'vip' | 'pago_fallido' | 'cancelado'
export type Rol = 'super_admin' | 'admin' | 'medico' | 'secretaria'
export type RetencionBadge = 'activo_7d' | 'tibio_14d' | 'frio_30d' | 'inactivo'

export const tipoCuentaSchema = z.union([z.literal('clinica'), z.literal('independiente')])
export const estadoClinicaSchema = z.union([
  z.literal('activa'),
  z.literal('suspendida'),
  z.literal('inactiva'),
])
export const estadoPagoSchema = z.union([
  z.literal('gratuito'),
  z.literal('trial'),
  z.literal('pagando'),
  z.literal('vip'),
  z.literal('pago_fallido'),
  z.literal('cancelado'),
])
export const rolSchema = z.union([
  z.literal('super_admin'),
  z.literal('admin'),
  z.literal('medico'),
  z.literal('secretaria'),
])
export const retencionSchema = z.union([
  z.literal('activo_7d'),
  z.literal('tibio_14d'),
  z.literal('frio_30d'),
  z.literal('inactivo'),
])

export interface ClinicaResumen {
  id: string
  nombre: string
  nombreDisplay: string | null
  logoUrl: string | null
  tipo: TipoCuenta
  plan: string | null
  estadoPago: EstadoPago
  /**
   * Indica si la clínica tiene grant VIP activo.
   * Se deriva de `clinicas.es_vip_grant` en BD (NO de `max_pacientes`,
   * que era la regla derivativa anterior y resultó incorrecta).
   */
  esVip: boolean
  maxMedicos: number
  countMedicos: number
  maxSecretarias: number
  countSecretarias: number
  countPacientes: number
  countConsultas: number
  ultimoAccesoIso: string | null
  estado: EstadoClinica
  suspendida: boolean
}

export const clinicaResumenSchema: z.ZodType<ClinicaResumen> = z.object({
  id: z.string(),
  nombre: z.string(),
  nombreDisplay: z.string().nullable(),
  logoUrl: z.string().nullable(),
  tipo: tipoCuentaSchema,
  plan: z.string().nullable(),
  estadoPago: estadoPagoSchema,
  esVip: z.boolean(),
  maxMedicos: z.number(),
  countMedicos: z.number(),
  maxSecretarias: z.number(),
  countSecretarias: z.number(),
  countPacientes: z.number(),
  countConsultas: z.number(),
  ultimoAccesoIso: z.string().nullable(),
  estado: estadoClinicaSchema,
  suspendida: z.boolean(),
})

export interface ClinicasListResponse {
  items: ClinicaResumen[]
  nextCursor: string | null
}

export const clinicasListResponseSchema: z.ZodType<ClinicasListResponse> = z.object({
  items: z.array(clinicaResumenSchema),
  nextCursor: z.string().nullable(),
})

export interface UsuarioClinica {
  id: string
  email: string
  nombre: string
  rol: Rol
  ultimoLoginIso: string | null
}

export const usuarioClinicaSchema: z.ZodType<UsuarioClinica> = z.object({
  id: z.string(),
  email: z.string(),
  nombre: z.string(),
  rol: rolSchema,
  ultimoLoginIso: z.string().nullable(),
})

export interface ClinicaDetalleMetricas {
  pacientes: number
  consultas: number
  documentos: number
  iaCalls: number
}

export const clinicaDetalleMetricasSchema: z.ZodType<ClinicaDetalleMetricas> = z.object({
  pacientes: z.number(),
  consultas: z.number(),
  documentos: z.number(),
  iaCalls: z.number(),
})

export interface ClinicaDetalle {
  resumen: ClinicaResumen
  usuarios: UsuarioClinica[]
  metricas: ClinicaDetalleMetricas
  serieConsultasPorMes: SeriePunto[]
}

export const clinicaDetalleSchema: z.ZodType<ClinicaDetalle> = z.object({
  resumen: clinicaResumenSchema,
  usuarios: z.array(usuarioClinicaSchema),
  metricas: clinicaDetalleMetricasSchema,
  serieConsultasPorMes: z.array(seriePuntoSchema),
})

export interface UsuarioGlobal {
  id: string
  nombre: string
  email: string
  rol: Rol
  clinicaId: string | null
  clinicaNombre: string | null
  ultimoLoginIso: string | null
  consultasGeneradas: number
  retencion: RetencionBadge
}

export const usuarioGlobalSchema: z.ZodType<UsuarioGlobal> = z.object({
  id: z.string(),
  nombre: z.string(),
  email: z.string(),
  rol: rolSchema,
  clinicaId: z.string().nullable(),
  clinicaNombre: z.string().nullable(),
  ultimoLoginIso: z.string().nullable(),
  consultasGeneradas: z.number(),
  retencion: retencionSchema,
})

export interface UsuariosListResponse {
  items: UsuarioGlobal[]
  nextCursor: string | null
}

export const usuariosListResponseSchema: z.ZodType<UsuariosListResponse> = z.object({
  items: z.array(usuarioGlobalSchema),
  nextCursor: z.string().nullable(),
})

// ──────────────────────────────────────────────────────────────────
// Sección 3 — Ingresos
// ──────────────────────────────────────────────────────────────────

export type EstadoTransaccion = 'paid' | 'open' | 'void' | 'uncollectible' | 'draft' | 'desconocido'

export const estadoTransaccionSchema = z.union([
  z.literal('paid'),
  z.literal('open'),
  z.literal('void'),
  z.literal('uncollectible'),
  z.literal('draft'),
  z.literal('desconocido'),
])

export interface TransaccionStripe {
  id: string
  fechaIso: string
  monto: number
  moneda: string
  estado: EstadoTransaccion
  clinicaId: string | null
  clinicaNombre: string | null
  customerId: string | null
  hostedInvoiceUrl: string | null
}

export const transaccionStripeSchema: z.ZodType<TransaccionStripe> = z.object({
  id: z.string(),
  fechaIso: z.string(),
  monto: z.number(),
  moneda: z.string(),
  estado: estadoTransaccionSchema,
  clinicaId: z.string().nullable(),
  clinicaNombre: z.string().nullable(),
  customerId: z.string().nullable(),
  hostedInvoiceUrl: z.string().nullable(),
})

export interface ClinicaPagoFallido {
  clinicaId: string
  nombre: string
  diasFallido: number
}

export const clinicaPagoFallidoSchema: z.ZodType<ClinicaPagoFallido> = z.object({
  clinicaId: z.string(),
  nombre: z.string(),
  diasFallido: z.number(),
})

export interface ClinicaTrial {
  clinicaId: string
  nombre: string
  diasRestantes: number
}

export const clinicaTrialSchema: z.ZodType<ClinicaTrial> = z.object({
  clinicaId: z.string(),
  nombre: z.string(),
  diasRestantes: z.number(),
})

export interface SuscripcionPorVencer {
  clinicaId: string
  nombre: string
  diasParaVencer: number
  monto: number
}

export const suscripcionPorVencerSchema: z.ZodType<SuscripcionPorVencer> = z.object({
  clinicaId: z.string(),
  nombre: z.string(),
  diasParaVencer: z.number(),
  monto: z.number(),
})

export interface IngresosResumen {
  mrrActual: KpiVariacion
  clinicasEnTrial: number
  conversionTrialPct: number | null
  clinicasPagoFallido: number
  suscripcionesVencen7d: number
  serieIngresosPorMes: SeriePunto[]
  trials: ClinicaTrial[]
  pagosFallidos: ClinicaPagoFallido[]
  porVencer: SuscripcionPorVencer[]
  transacciones: TransaccionStripe[]
}

export const ingresosResumenSchema: z.ZodType<IngresosResumen> = z.object({
  mrrActual: kpiVariacionSchema,
  clinicasEnTrial: z.number(),
  conversionTrialPct: z.number().nullable(),
  clinicasPagoFallido: z.number(),
  suscripcionesVencen7d: z.number(),
  serieIngresosPorMes: z.array(seriePuntoSchema),
  trials: z.array(clinicaTrialSchema),
  pagosFallidos: z.array(clinicaPagoFallidoSchema),
  porVencer: z.array(suscripcionPorVencerSchema),
  transacciones: z.array(transaccionStripeSchema),
})

// ──────────────────────────────────────────────────────────────────
// Sección 4 — Uso de plataforma
// ──────────────────────────────────────────────────────────────────

export interface RankingFuncion {
  accion: string
  total: number
}

export const rankingFuncionSchema: z.ZodType<RankingFuncion> = z.object({
  accion: z.string(),
  total: z.number(),
})

export interface HeatmapCell {
  hora: number      // 0-23
  diaSemana: number // 0=domingo … 6=sábado
  total: number
}

export const heatmapCellSchema: z.ZodType<HeatmapCell> = z.object({
  hora: z.number(),
  diaSemana: z.number(),
  total: z.number(),
})

export interface TopMedico {
  userId: string
  nombre: string
  clinicaNombre: string | null
  total: number
}

export const topMedicoSchema: z.ZodType<TopMedico> = z.object({
  userId: z.string(),
  nombre: z.string(),
  clinicaNombre: z.string().nullable(),
  total: z.number(),
})

export interface UsoIaItem {
  accion: string
  total: number
}

export const usoIaItemSchema: z.ZodType<UsoIaItem> = z.object({
  accion: z.string(),
  total: z.number(),
})

export interface UsoPlataformaResponse {
  rankingFunciones: RankingFuncion[]
  heatmap: HeatmapCell[]
  topMedicos: TopMedico[]
  usoIA: UsoIaItem[]
}

export const usoPlataformaResponseSchema: z.ZodType<UsoPlataformaResponse> = z.object({
  rankingFunciones: z.array(rankingFuncionSchema),
  heatmap: z.array(heatmapCellSchema),
  topMedicos: z.array(topMedicoSchema),
  usoIA: z.array(usoIaItemSchema),
})

// ──────────────────────────────────────────────────────────────────
// Sección 5 — Audit log viewer
// ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  userId: string
  userNombre: string | null
  accion: string
  tabla: string | null
  registroId: string | null
  ip: string | null
  descripcion: string | null
  createdAtIso: string
}

export const auditLogEntrySchema: z.ZodType<AuditLogEntry> = z.object({
  id: z.string(),
  userId: z.string(),
  userNombre: z.string().nullable(),
  accion: z.string(),
  tabla: z.string().nullable(),
  registroId: z.string().nullable(),
  ip: z.string().nullable(),
  descripcion: z.string().nullable(),
  createdAtIso: z.string(),
})

export interface AuditLogResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  totalPages: number
}

export const auditLogResponseSchema: z.ZodType<AuditLogResponse> = z.object({
  items: z.array(auditLogEntrySchema),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
})

// ──────────────────────────────────────────────────────────────────
// Sección 6 — Alertas
// ──────────────────────────────────────────────────────────────────

export type SeveridadAlerta = 'critico' | 'warning' | 'info'

export const severidadAlertaSchema = z.union([
  z.literal('critico'),
  z.literal('warning'),
  z.literal('info'),
])

export interface AlertaItem {
  id: string
  severidad: SeveridadAlerta
  titulo: string
  descripcion: string
  clinicaId: string | null
  clinicaNombre: string | null
  fechaIso: string
}

export const alertaItemSchema: z.ZodType<AlertaItem> = z.object({
  id: z.string(),
  severidad: severidadAlertaSchema,
  titulo: z.string(),
  descripcion: z.string(),
  clinicaId: z.string().nullable(),
  clinicaNombre: z.string().nullable(),
  fechaIso: z.string(),
})

export interface CohorteRetencion {
  mes: string
  totalClinicas: number
  activas: number
  pct: number
}

export const cohorteRetencionSchema: z.ZodType<CohorteRetencion> = z.object({
  mes: z.string(),
  totalClinicas: z.number(),
  activas: z.number(),
  pct: z.number(),
})

export interface AlertasResponse {
  alertas: AlertaItem[]
  cohortes: CohorteRetencion[]
}

export const alertasResponseSchema: z.ZodType<AlertasResponse> = z.object({
  alertas: z.array(alertaItemSchema),
  cohortes: z.array(cohorteRetencionSchema),
})

// ──────────────────────────────────────────────────────────────────
// Sección 7 — Legal / ARCO
// ──────────────────────────────────────────────────────────────────

export type TipoArco = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion'
export type EstadoArco = 'pendiente' | 'en_proceso' | 'completada' | 'rechazada'

export const tipoArcoSchema = z.union([
  z.literal('acceso'),
  z.literal('rectificacion'),
  z.literal('cancelacion'),
  z.literal('oposicion'),
])

export const estadoArcoSchema = z.union([
  z.literal('pendiente'),
  z.literal('en_proceso'),
  z.literal('completada'),
  z.literal('rechazada'),
])

export interface SolicitudArco {
  id: string
  clinicaId: string
  clinicaNombre: string | null
  tipo: TipoArco
  estado: EstadoArco
  descripcion: string | null
  fechaSolicitudIso: string
  fechaLimiteIso: string | null
  fechaResolucionIso: string | null
}

export const solicitudArcoSchema: z.ZodType<SolicitudArco> = z.object({
  id: z.string(),
  clinicaId: z.string(),
  clinicaNombre: z.string().nullable(),
  tipo: tipoArcoSchema,
  estado: estadoArcoSchema,
  descripcion: z.string().nullable(),
  fechaSolicitudIso: z.string(),
  fechaLimiteIso: z.string().nullable(),
  fechaResolucionIso: z.string().nullable(),
})

export interface ConsentimientoClinica {
  clinicaId: string
  clinicaNombre: string
  totalPacientes: number
  conConsentimiento: number
  pct: number
}

export const consentimientoClinicaSchema: z.ZodType<ConsentimientoClinica> = z.object({
  clinicaId: z.string(),
  clinicaNombre: z.string(),
  totalPacientes: z.number(),
  conConsentimiento: z.number(),
  pct: z.number(),
})

export interface LegalResponse {
  solicitudesArco: SolicitudArco[]
  consentimientos: ConsentimientoClinica[]
  totalAnonimizados: number
}

export const legalResponseSchema: z.ZodType<LegalResponse> = z.object({
  solicitudesArco: z.array(solicitudArcoSchema),
  consentimientos: z.array(consentimientoClinicaSchema),
  totalAnonimizados: z.number(),
})

// ──────────────────────────────────────────────────────────────────
// Filtros de UI
// ──────────────────────────────────────────────────────────────────

export interface ClinicasFilter {
  q: string
  tipo: TipoCuenta | 'todos'
  plan: EstadoPago | 'todos'
  estado: EstadoClinica | 'todos'
}

// ──────────────────────────────────────────────────────────────────
// Helpers de retención y dirección
// ──────────────────────────────────────────────────────────────────

export function calcularRetencion(ultimoLoginIso: string | null): RetencionBadge {
  if (!ultimoLoginIso) return 'inactivo'
  const dias = (Date.now() - new Date(ultimoLoginIso).getTime()) / 86_400_000
  if (dias <= 7) return 'activo_7d'
  if (dias <= 14) return 'tibio_14d'
  if (dias <= 30) return 'frio_30d'
  return 'inactivo'
}

export function calcularDireccion(actual: number, anterior: number): Direccion {
  if (actual > anterior) return 'up'
  if (actual < anterior) return 'down'
  return 'flat'
}

export function calcularVariacion(actual: number, anterior: number): KpiVariacion {
  const variacionPct =
    anterior === 0
      ? actual === 0
        ? 0
        : null
      : ((actual - anterior) / anterior) * 100
  return {
    valor: actual,
    variacionPct,
    direccion: calcularDireccion(actual, anterior),
  }
}
