import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAccess } from '@/lib/audit'

/**
 * POST /api/audit — registrar lectura de recurso clínico
 *
 * NOM-024-SSA3: trazabilidad de quién consultó cada expediente.
 * El frontend llama este endpoint al abrir un expediente, consulta,
 * laboratorio o documento. Se valida la sesión server-side.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tabla, registroId } = await req.json()

  const tablasPermitidas = ['pacientes', 'consultas', 'laboratorios', 'documentos']
  if (!tabla || !tablasPermitidas.includes(tabla)) {
    return NextResponse.json({ error: 'Tabla inválida' }, { status: 400 })
  }

  if (!registroId || typeof registroId !== 'string') {
    return NextResponse.json({ error: 'registroId requerido' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // fire-and-forget — no bloquea la respuesta
  logAccess(user.id, tabla, registroId, ip)

  return NextResponse.json({ ok: true })
}
