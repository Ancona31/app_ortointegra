import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAccion =
  | 'ver_expediente'
  | 'generar_pdf'
  | 'verificar_receta'
  | 'exportar_expediente'
  | 'enviar_documento'
  | 'enviar_documento_denegado'

/**
 * Registra una acción sensible en el audit_log.
 * Usa el service role para garantizar que siempre se registre,
 * independientemente de las políticas RLS.
 *
 * No lanza excepciones — un fallo de auditoría no debe romper la operación.
 */
export async function logAudit(params: {
  userId: string
  accion: AuditAccion
  tabla?: string
  registroId?: string
  ip?: string
  descripcion?: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      user_id: params.userId,
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
