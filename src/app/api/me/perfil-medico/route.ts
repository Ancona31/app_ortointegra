import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ medico: null })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, titulo, nombres, apellido_paterno, apellido_materno, especialidad, cedula_profesional, cedula_especialidad, universidad, clinica_id, direccion_consultorio, telefono_consultorio, firma_url')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ medico: null })

  let logo_url: string | null = null
  let color_primario = '#1a3a5c'
  let color_secundario = '#1e5fa8'
  let clinicaNombre: string | null = null

  if (profile.clinica_id) {
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('logo_url, color_primario, color_secundario, nombre_display, nombre')
      .eq('id', profile.clinica_id)
      .single()
    if (clinica) {
      logo_url = clinica.logo_url ?? null
      color_primario = clinica.color_primario ?? '#1a3a5c'
      color_secundario = clinica.color_secundario ?? '#1e5fa8'
      clinicaNombre = clinica.nombre_display ?? clinica.nombre ?? null
    }
  }

  const titulo = profile.titulo ?? 'Dr.'
  const nombreCompleto = componerNombreMedicoCompleto({
    titulo,
    nombres: profile.nombres,
    apellido_paterno: profile.apellido_paterno,
    apellido_materno: profile.apellido_materno,
  })

  // Generar signed URL (1h) para la firma si existe
  let firmaSignedUrl: string | null = null
  if (profile.firma_url) {
    const admin = createAdminClient()
    const { data: signed } = await admin.storage
      .from('firmas-medicos')
      .createSignedUrl(profile.firma_url as string, 3600)
    firmaSignedUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({
    medico: {
      nombre: nombreCompleto,
      titulo,
      nombres: profile.nombres ?? null,
      apellido_paterno: profile.apellido_paterno ?? null,
      apellido_materno: profile.apellido_materno ?? null,
      especialidad: profile.especialidad ?? '',
      cedula_profesional: profile.cedula_profesional ?? '',
      cedula_especialidad: profile.cedula_especialidad ?? '',
      universidad: profile.universidad ?? '',
      logo_url,
      firma_url: firmaSignedUrl,
      color_primario,
      color_secundario,
      clinica_nombre: clinicaNombre,
      direccion_consultorio: profile.direccion_consultorio ?? '',
      telefono_consultorio: profile.telefono_consultorio ?? '',
    }
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { direccion_consultorio, telefono_consultorio, especialidad, cedula_profesional, cedula_especialidad, titulo, nombre, universidad } = await req.json()

  const updateData: Record<string, string | undefined> = { direccion_consultorio, telefono_consultorio, especialidad, cedula_profesional, cedula_especialidad, titulo }
  if (nombre !== undefined) updateData.nombre = nombre
  if (universidad !== undefined) updateData.universidad = universidad

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
