import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAccess, logAudit, type AuditAccion } from '@/lib/audit'

/**
 * POST /api/audit — registrar lectura de recurso clínico
 *
 * NOM-024-SSA3: trazabilidad de quién consultó cada expediente.
 * El frontend llama este endpoint al abrir un expediente, consulta,
 * laboratorio o documento. Se valida la sesión server-side.
 *
 * `accion` es OPCIONAL y limitada a la allowlist de abajo: sin ella el
 * comportamiento es el de siempre (lectura → logAccess mapea por tabla).
 * Con ella se registra una acción explícita — hoy solo la exportación del
 * expediente completo a PDF, que no es una simple lectura.
 */

/** Acciones que el cliente puede pedir por nombre. Cerrada a propósito. */
const ACCIONES_PERMITIDAS: Record<string, AuditAccion> = {
  exportar_expediente: 'exportar_expediente',
}

const DESCRIPCION: Record<string, string> = {
  exportar_expediente: 'Exportación del expediente completo a PDF',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tabla, registroId, accion } = await req.json()

  const tablasPermitidas = ['pacientes', 'consultas', 'documentos']
  if (!tabla || !tablasPermitidas.includes(tabla)) {
    return NextResponse.json({ error: 'Tabla inválida' }, { status: 400 })
  }

  if (!registroId || typeof registroId !== 'string') {
    return NextResponse.json({ error: 'registroId requerido' }, { status: 400 })
  }

  if (accion !== undefined && !ACCIONES_PERMITIDAS[accion]) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // fire-and-forget — no bloquea la respuesta
  if (accion) {
    logAudit({
      userId: user.id,
      accion: ACCIONES_PERMITIDAS[accion],
      tabla,
      registroId,
      ip,
      descripcion: DESCRIPCION[accion],
    })
  } else {
    logAccess(user.id, tabla, registroId, ip)
  }

  return NextResponse.json({ ok: true })
}
