import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { resolverConexionClinica, borrarConexion } from '@/lib/gcalConexion'

/**
 * Desconecta Google de la CLÍNICA.
 *
 * ⚠ ES DESTRUCTIVO PARA TODA LA CLÍNICA, Y ANTES NO LO ERA. Mientras la
 * conexión era de cada usuario, desconectar sólo se afectaba a uno mismo y no
 * hacía falta gatearlo. Ahora borra la única conexión de la clínica: el
 * administrador, la secretaria y todos los médicos invitados dejan de
 * sincronizar a la vez. De ahí el gate (plan §0.6, §2.5 y F5).
 *
 * Los secretos caen solos con la conexión, por el `ON DELETE CASCADE`.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // OJO: no se gatea por `role === 'admin'`. Un médico dueño de su cuenta
  // tiene role='medico' con es_admin_de_clinica=true.
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  if (!canManageClinica(profile) || !profile?.clinica_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const conexion = await resolverConexionClinica(supabase, profile.clinica_id)
  // Sin conexión, el trabajo ya está hecho. No es un error: quien pulsa quería
  // quedarse desconectado y lo está.
  if (!conexion) return NextResponse.json({ ok: true })

  await borrarConexion({ conexion })
  return NextResponse.json({ ok: true })
}
