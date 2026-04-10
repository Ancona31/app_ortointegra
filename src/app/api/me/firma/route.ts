import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'firmas-medicos'
const MAX_SIZE = 1 * 1024 * 1024 // 1 MB — PNGs procesados son pequeños

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('firma') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  if (file.type !== 'image/png') {
    return NextResponse.json({ error: 'Solo se aceptan archivos PNG' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo no debe superar 1 MB' }, { status: 400 })
  }

  const admin = createAdminClient()
  const storagePath = `${user.id}/firma.png`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Guardar el PATH (no la URL) en profiles — la URL se genera on-demand
  const { error: updateError } = await admin
    .from('profiles')
    .update({ firma_url: storagePath })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Signed URL de 1h para que el cliente pueda mostrarlo inmediatamente
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({ url: signed?.signedUrl ?? null })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const storagePath = `${user.id}/firma.png`

  // Ignorar error si el archivo no existe (idempotente)
  await admin.storage.from(BUCKET).remove([storagePath])

  await admin
    .from('profiles')
    .update({ firma_url: null })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
