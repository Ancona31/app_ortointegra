import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const admin = createAdminClient()

  const [
    clinicasRes,
    profilesRes,
    pacientesRes,
    consultasRes,
    docsRes,
    rateRes,
  ] = await Promise.all([
    admin.from('clinicas').select('id, nombre, nombre_display').order('nombre'),
    admin.from('profiles').select('id, nombre, clinica_id, role'),
    admin.from('pacientes').select('id, clinica_id, medico_id, created_at'),
    admin.from('consultas').select('id, paciente_id, created_at'),
    admin.from('documentos').select('id, paciente_id, tipo, created_at'),
    admin.from('rate_limits').select('user_id, ruta, created_at'),
  ])

  const clinicas = clinicasRes.data || []
  const profiles = profilesRes.data || []
  const pacientes = pacientesRes.data || []
  const consultas = consultasRes.data || []
  const documentos = docsRes.data || []
  const rateLimits = rateRes.data || []

  // Índices para joins rápidos
  const pacienteMap = new Map(pacientes.map(p => [p.id, p]))

  // --- Resumen global ---
  const totalMedicos = profiles.filter(p => p.role === 'medico' || p.role === 'admin').length
  const totalIA = rateLimits.length

  const resumen = {
    total_clinicas: clinicas.length,
    total_medicos: totalMedicos,
    total_pacientes: pacientes.length,
    total_consultas: consultas.length,
    total_documentos: documentos.length,
    total_ia_calls: totalIA,
  }

  // --- Métricas por clínica ---
  const clinicasMetricas = clinicas.map(c => {
    const medicosCli = profiles.filter(p => p.clinica_id === c.id && (p.role === 'medico' || p.role === 'admin'))
    const secretariasCli = profiles.filter(p => p.clinica_id === c.id && p.role === 'secretaria')
    const pacientesCli = pacientes.filter(p => p.clinica_id === c.id)
    const pacientesIds = new Set(pacientesCli.map(p => p.id))
    const consultasCli = consultas.filter(c => pacientesIds.has(c.paciente_id))
    const docsCli = documentos.filter(d => pacientesIds.has(d.paciente_id))
    const medicosIds = new Set(medicosCli.map(p => p.id))
    const iaCli = rateLimits.filter(r => medicosIds.has(r.user_id))

    return {
      id: c.id,
      nombre: c.nombre_display || c.nombre,
      medicos: medicosCli.length,
      secretarias: secretariasCli.length,
      pacientes: pacientesCli.length,
      consultas: consultasCli.length,
      documentos: docsCli.length,
      ia_calls: iaCli.length,
    }
  })

  // --- Métricas por usuario (médicos y admins) ---
  const usuariosMetricas = profiles
    .filter(p => p.role === 'medico' || p.role === 'admin' || p.role === 'super_admin')
    .map(p => {
      const clinica = clinicas.find(c => c.id === p.clinica_id)
      const pacientesUser = pacientes.filter(pac => pac.medico_id === p.id)
      const pacientesIds = new Set(pacientesUser.map(pac => pac.id))
      const consultasUser = consultas.filter(c => pacientesIds.has(c.paciente_id))
      const docsUser = documentos.filter(d => pacientesIds.has(d.paciente_id))
      const rateUser = rateLimits.filter(r => r.user_id === p.id)

      return {
        id: p.id,
        nombre: p.nombre || '—',
        clinica: clinica ? (clinica.nombre_display || clinica.nombre) : (p.role === 'super_admin' ? 'Super Admin' : 'Sin clínica'),
        role: p.role,
        pacientes: pacientesUser.length,
        consultas: consultasUser.length,
        documentos: docsUser.length,
        ia_nota_medica: rateUser.filter(r => r.ruta === 'nota-medica').length,
        ia_consulta_rapida: rateUser.filter(r => r.ruta === 'consulta-rapida').length,
        ia_labs_extract: rateUser.filter(r => r.ruta === 'labs-extract').length,
        ia_total: rateUser.length,
      }
    })
    .sort((a, b) => b.ia_total - a.ia_total)

  return NextResponse.json({ resumen, clinicas: clinicasMetricas, usuarios: usuariosMetricas })
}
