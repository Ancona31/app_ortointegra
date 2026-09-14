import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { revisarLogo } from '@/lib/perfil/logoArchivo'

/* Los mensajes de rechazo de esta ruta LOS LEE EL MÉDICO TAL CUAL: el
   onboarding y Mi Perfil los pintan en su aviso. Por eso cada rama dice qué
   pasó y qué hacer al respecto, y ninguna devuelve el texto crudo de Supabase
   —que llega en inglés, habla de buckets y no le dice a nadie qué hacer—. Lo
   crudo va al log del servidor, que es donde sirve.

   El criterio de aceptación —extensiones y tope— vive en
   `src/lib/perfil/logoArchivo.ts` porque las pantallas lo aplican también al
   elegir el archivo, y los dos mensajes tienen que ser el mismo. ESTA sigue
   siendo la comprobación que manda: la del navegador es comodidad, y el POST
   se puede hacer sin pasar por ninguna pantalla. */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id) {
    return NextResponse.json(
      { error: 'Tu cuenta no está asociada a ninguna clínica, así que no hay dónde guardar el logo. Escribe a soporte@spinus.com.mx.' },
      { status: 403 },
    )
  }
  if (!canManageClinica(profile)) {
    return NextResponse.json(
      { error: 'El logo es de la clínica: solo quien la administra puede cambiarlo. Pídeselo a esa persona.' },
      { status: 403 },
    )
  }

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) {
    return NextResponse.json(
      { error: 'No llegó ninguna imagen. Vuelve a elegir el archivo e inténtalo otra vez.' },
      { status: 400 },
    )
  }

  const veredicto = revisarLogo(file)
  if (!veredicto.ok) {
    return NextResponse.json({ error: veredicto.error }, { status: 400 })
  }
  const { ext } = veredicto

  const admin = createAdminClient()
  const path = `${profile.clinica_id}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('clinica-logos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    logger.error('api/me/logo', `upload falló: ${uploadError.message}`)
    return NextResponse.json(
      { error: 'No pudimos guardar el logo en el almacenamiento. Vuelve a intentarlo en un momento; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
  }

  const { data: { publicUrl } } = admin.storage
    .from('clinica-logos')
    .getPublicUrl(path)

  /* ⚠️ ESTE ERROR SE COMPROBABA EN LA RUTA DE LA FIRMA Y AQUÍ NO. Sin la
     comprobación, un fallo al escribir `logo_url` devolvía 200 con la url: la
     pantalla decía «logo guardado», el archivo estaba en el almacenamiento y
     la clínica seguía sin logo. Decir que algo funcionó sin saberlo es peor
     que fallar. */
  const { error: updateError } = await admin.from('clinicas')
    .update({ logo_url: publicUrl })
    .eq('id', profile.clinica_id)

  if (updateError) {
    logger.error('api/me/logo', `update de logo_url falló: ${updateError.message}`)
    return NextResponse.json(
      { error: 'La imagen se subió pero no pudimos asociarla a tu clínica. Vuelve a guardarla; si sigue fallando, escribe a soporte@spinus.com.mx.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: publicUrl })
}
