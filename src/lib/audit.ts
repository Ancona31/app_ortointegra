/**
 * Sistema de auditoría centralizado — NOM-024-SSA3-2012
 *
 * Registra TODAS las acciones sobre datos clínicos:
 * - Lecturas (SELECT) de expedientes, notas, laboratorios, documentos
 * - Escrituras (INSERT/UPDATE/DELETE) vía triggers de Postgres
 * - Logins exitosos y fallidos
 * - Logouts
 * - Intentos de acceso no autorizado
 * - Generación de PDFs, envío de emails, verificación de recetas
 *
 * Usa el service role para garantizar que siempre se registre,
 * independientemente de las políticas RLS.
 * No lanza excepciones — un fallo de auditoría no debe romper la operación.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAccion =
  // Lecturas de datos clínicos
  | 'ver_expediente'
  | 'ver_consulta'
  | 'ver_laboratorio'
  | 'ver_documento'
  | 'ver_pacientes'
  // Operaciones sobre documentos
  | 'generar_pdf'
  | 'verificar_receta'
  | 'exportar_expediente'
  | 'enviar_documento'
  | 'enviar_documento_denegado'
  // Autenticación
  | 'login_exitoso'
  | 'login_fallido'
  | 'logout'
  // Acceso no autorizado
  | 'acceso_denegado'

interface AuditParams {
  userId?: string | null
  accion: AuditAccion
  tabla?: string
  registroId?: string
  ip?: string
  descripcion?: string
  userAgent?: string
}

/** Registra una acción en el audit_log */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      user_id: params.userId ?? 'anonymous',
      accion: params.accion,
      tabla: params.tabla ?? null,
      registro_id: params.registroId ?? null,
      ip: params.ip ?? null,
      descripcion: params.descripcion ?? null,
    })
  } catch {
    // Audit failure is silent — never block the main operation
  }
}

// ── Funciones especializadas ─────────────────────────────────────────

/** Registra lectura de un recurso clínico */
export async function logAccess(
  userId: string,
  tabla: string,
  registroId: string,
  ip?: string
): Promise<void> {
  const accionMap: Record<string, AuditAccion> = {
    pacientes: 'ver_expediente',
    consultas: 'ver_consulta',
    laboratorios: 'ver_laboratorio',
    documentos: 'ver_documento',
  }
  await logAudit({
    userId,
    accion: accionMap[tabla] ?? 'ver_expediente',
    tabla,
    registroId,
    ip,
  })
}

/** Registra login exitoso o fallido */
export async function logLogin(
  params: {
    userId?: string | null
    email?: string
    success: boolean
    ip?: string
    userAgent?: string
  }
): Promise<void> {
  await logAudit({
    userId: params.userId,
    accion: params.success ? 'login_exitoso' : 'login_fallido',
    ip: params.ip,
    descripcion: params.success
      ? undefined
      : `Intento fallido: ${params.email ?? 'email no proporcionado'}`,
    userAgent: params.userAgent,
  })
}

/** Registra intento de acceso no autorizado */
export async function logUnauthorized(
  userId: string | null,
  recurso: string,
  ip?: string
): Promise<void> {
  await logAudit({
    userId,
    accion: 'acceso_denegado',
    descripcion: `Recurso: ${recurso}`,
    ip,
  })
}
