import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ medico: null })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, titulo, especialidad, cedula_profesional, cedula_especialidad, clinica_id')
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
  const nombreCompleto = `${titulo} ${profile.nombre ?? ''}`.trim()

  return NextResponse.json({
    medico: {
      nombre: nombreCompleto,
      titulo,
      especialidad: profile.especialidad ?? '',
      cedula_profesional: profile.cedula_profesional ?? '',
      cedula_especialidad: profile.cedula_especialidad ?? '',
      logo_url,
      color_primario,
      color_secundario,
      clinica_nombre: clinicaNombre,
    }
  })
}
