import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const maxSize = 2 * 1024 * 1024 // 2 MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'El archivo no debe superar 2 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    return NextResponse.json({ error: 'Formato no permitido. Usa PNG, JPG, WEBP o SVG.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const path = `${profile.clinica_id}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('clinica-logos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from('clinica-logos')
    .getPublicUrl(path)

  // Actualizar logo_url en clinicas
  await admin.from('clinicas')
    .update({ logo_url: publicUrl })
    .eq('id', profile.clinica_id)

  return NextResponse.json({ url: publicUrl })
}
