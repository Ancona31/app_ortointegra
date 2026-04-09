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
