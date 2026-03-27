import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const clinicaId = formData.get('clinicaId') as string
  if (!file || !clinicaId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'png'
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

  return NextResponse.json({ url: publicUrl })
}
