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
  | 'ver_documento'
  | 'ver_pacientes'
  // Operaciones sobre documentos
  | 'generar_pdf'
  | 'verificar_receta'
  | 'exportar_expediente'
  | 'enviar_documento'
  | 'enviar_documento_denegado'
  /* Escritura del correo en la ficha desde el modal de envío, y solo cuando la
     ficha NO tenía ninguno — sustituir uno existente está prohibido en
     `/api/pacientes/[id]/correo`. Acción propia y no un `editar_paciente`
     genérico: es un dato de contacto que se guarda a raíz de un envío, y quien
     audite una dirección equivocada quiere poder aislar justo esos. */
  | 'actualizar_paciente_correo'
  /* Invitación de una cita enviada a Google desde el modal de la agenda: el
     médico asignado, el paciente, o los dos, añadidos como asistentes del
     evento con `sendUpdates: 'all'`.

     ⚠️ LA DESCRIPCIÓN NO LLEVA NINGUNA DIRECCIÓN DE CORREO, y no es un olvido.
     Lo que se registra es QUÉ PAPEL se invitó —«el médico asignado», «el
     paciente»— y `registro_id` con el id de la cita, que basta para reconstruir
     a quién le tocaba. El `audit_log` lo leen ojos que no tienen por qué ver la
     libreta de direcciones de la clínica, y el correo del médico además no sale
     del servidor en ningún otro punto de esa ruta.

     `audit_log.accion` es `text` sin CHECK, así que esta línea no necesita
     migración. */
  | 'enviar_invitacion_cita'
  // Autenticación
  | 'login_exitoso'
  | 'login_fallido'
  | 'logout'
  // Derechos ARCO (LFPDPPP)
  | 'arco_acceso'
  /* Intento de exportación ARCO rechazado por rol insuficiente (QW3).
     Acción propia y no `acceso_denegado` genérico a propósito: un intento
     contra el endpoint que devuelve el expediente ENTERO en JSON merece poder
     filtrarse solo en el panel de auditoría. */
  | 'arco_intento_denegado'
  | 'arco_rectificacion'
  | 'arco_cancelacion'
  // Acceso no autorizado
  | 'acceso_denegado'
  // Acciones de super_admin (centro de control)
  | 'sa_crear_clinica'
  | 'sa_eliminar_clinica'
  | 'sa_editar_clinica'
  | 'sa_editar_limites'
  | 'sa_suspender_clinica'
  | 'sa_reactivar_clinica'
  | 'sa_upgrade_clinica'
  | 'sa_toggle_vip'
  | 'sa_subir_logo'
  | 'sa_crear_independiente'
  | 'sa_eliminar_independiente'
  | 'sa_crear_usuario_clinica'
  | 'sa_eliminar_usuario_clinica'
  | 'sa_asignar_admin'
  | 'sa_ver_dashboard'
  | 'sa_ver_uso'
  | 'sa_ver_audit'
  | 'sa_ver_alertas'
  | 'sa_ver_legal'
  | 'sa_export_audit_csv'
  // Vinculación médico-paciente (modelo M:N)
  | 'vincular_medico'
  /* Los cuatro actos sobre la CONEXIÓN de Google de la clínica (plan §8). No
     hay trigger de auditoría en `clinica_conexiones_google` —`baseline/
     06_triggers.sql` lista doce y ninguno es suyo—, así que lo que no escriba
     `logAudit` no queda en ninguna parte.

     Se registran los actos sobre la conexión, que son raros y consecuentes.
     NO se registra la sincronización por cita ni el refresco de token: eso es
     tráfico, y convertiría el `audit_log` en un log de red.

     ⚠️ NI EL CORREO DE GOOGLE DEL ADMINISTRADOR NI EL NOMBRE DEL CALENDARIO
     ENTRAN EN NINGUNA DE LAS CUATRO DESCRIPCIONES, Y NO ES UN OLVIDO. Si estás
     a punto de añadir uno pensando que ayuda a investigar, esto es lo que te
     falta:

       · Para responder «quién desconectó esto» bastan `user_id`, la clínica y
         `created_at`. El correo de Google no añade nada a esa pregunta.
       · El `audit_log` es INMUTABLE POR TRIGGER (`supabase_migration_audit_
         immutable.sql`): ni el service role puede borrar ni modificar una fila.
         Meter ahí un dato personal es meterlo sin ninguna posibilidad de
         cancelación ARCO, para siempre.
       · El correo es el de una cuenta PERSONAL de un tercero, y este panel es
         de `super_admin` y global: acumularlos construye una libreta de
         direcciones de los administradores de todas las clínicas.
       · El nombre del calendario es `"Spinus - Dr. Fulano"` (`gcal.ts:260`),
         o sea el nombre de una persona, y no hace falta para nada.

     Es la misma regla que ya rige en `enviar_invitacion_cita`, unas líneas más
     arriba: se registra el papel y el id, nunca la dirección.

     Lo que sí va en `descripcion`, en JSON: el `clinica_id` —`audit_log` no
     tiene columna propia para él y el panel filtra por texto—, ids de conexión
     y de calendario, y el uuid de Spinus del dueño de la cuenta. Nunca un
     token, ni cifrado, ni truncado, ni su `expires_at`.

     `audit_log.accion` es `text` sin CHECK: estas cuatro líneas no necesitan
     migración. */
  | 'gcal_conexion_alta'
  | 'gcal_conexion_baja'
  | 'gcal_calendario_recreado'
  | 'gcal_conexion_revocada'

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
