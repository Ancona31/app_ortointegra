import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { user, error } = await requireSuperAdmin()
  if (error) return error

  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/svg+xml']
  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

  const formData = await req.formData()
  const file = formData.get('file') as File
  const clinicaId = formData.get('clinicaId') as string
  if (!file || !clinicaId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  if (!ALLOWED_MIMES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo JPG, PNG o SVG.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el límite de 5 MB.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  const ext = extMap[file.type] ?? 'png'
  const path = `${clinicaId}/logo.${ext}`

  const admin = createAdminClient()

  // Crear bucket si no existe (ignorar error si ya existe)
  await admin.storage.createBucket('clinica-logos', { public: true }).catch(() => {})

  const { error: uploadError } = await admin.storage
    .from('clinica-logos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: { publicUrl } } = admin.storage.from('clinica-logos').getPublicUrl(path)

  // Guardar URL en clinicas
  await admin.from('clinicas').update({ logo_url: publicUrl }).eq('id', clinicaId)

  await logAudit({
    userId: user.id,
    accion: 'sa_subir_logo',
    tabla: 'clinicas',
    registroId: String(clinicaId),
    descripcion: `mime=${file.type}`,
  })

  return NextResponse.json({ url: publicUrl })
}
