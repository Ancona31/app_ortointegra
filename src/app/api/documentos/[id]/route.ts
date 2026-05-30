import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ── DELETE /api/documentos/[id] ───────────────────────── */
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/documentos/[id]'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('id, clinica_id').eq('id', user.id).single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params

    // RLS filtra por clinica_id (y, tras 5.G Paso 4, también por subido_por)
    const { data: doc } = await supabase.from('documentos').select('id, paciente_id, pdf_url').eq('id', id).single()
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // 5.G Paso 2: .select('id') retorna las filas realmente borradas para
    // distinguir éxito de "RLS bloqueó silenciosamente". Robusto ante
    // divergencia entre policies de SELECT y DELETE (EJE 5.2 de auditoría).
    const { data: deleted, error } = await supabase.from('documentos').delete().eq('id', id).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 403 })
    }

    // 5.G Paso 2: hard delete del PDF en bucket 'documentos-pdf' (D-5.G-3).
    // Solo se ejecuta si el borrado de la fila fue confirmado por RLS.
    // Espeja el patrón de Ruta B: error de Storage es no-fatal (warning + continue).
    if (doc.pdf_url) {
      const { error: stErr } = await supabase.storage.from('documentos-pdf').remove([doc.pdf_url])
      if (stErr) {
        // eslint-disable-next-line no-console
        console.warn('[documentos-delete] Archivo huérfano en storage:', stErr.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
