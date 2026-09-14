import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const BUCKET = 'firmas-medicos'
const MAX_SIZE = 1 * 1024 * 1024 // 1 MB — PNGs procesados son pequeños

/* `FirmaCaptura` pinta el `error` de esta ruta tal cual en su aviso, así que
   cada rechazo tiene que decir qué pasó y qué hacer. Lo crudo de Supabase
   —inglés, nombres de bucket— se queda en el log del servidor. */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('firma') as File | null
  if (!file) {
    return NextResponse.json(
      { error: 'No llegó ninguna imagen. Vuelve a capturar o a elegir la firma e inténtalo otra vez.' },
      { status: 400 },
    )
  }

  if (file.type !== 'image/png') {
    return NextResponse.json(
      { error: `La firma tiene que ser PNG y esta llegó como ${file.type || 'un tipo desconocido'}. Dibújala aquí mismo o sube un PNG con fondo claro.` },
      { status: 400 },
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'La firma no debe superar 1 MB. Vuelve a capturarla desde aquí: el trazo dibujado pesa unos pocos kilobytes.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const storagePath = `${user.id}/firma.png`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    logger.error('api/me/firma', `upload falló: ${uploadError.message}`)
    return NextResponse.json(
      { error: 'No pudimos guardar la firma en el almacenamiento. Vuelve a intentarlo en un momento; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
  }

  // Guardar el PATH (no la URL) en profiles — la URL se genera on-demand
  const { error: updateError } = await admin
    .from('profiles')
    .update({ firma_url: storagePath })
    .eq('id', user.id)

  if (updateError) {
    logger.error('api/me/firma', `update de firma_url falló: ${updateError.message}`)
    return NextResponse.json(
      { error: 'La imagen se subió pero no pudimos asociarla a tu perfil. Vuelve a guardarla; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
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
