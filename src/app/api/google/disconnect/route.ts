import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { resolverConexionClinica, borrarConexion } from '@/lib/gcalConexion'
import { logAudit } from '@/lib/audit'

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
/* `req` es nuevo y sólo sirve para la `ip` de la entrada de auditoría. Es la
   firma canónica de un handler de Next —siempre recibe la petición como primer
   argumento—, así que declararla no cambia nada más de esta ruta. */
export async function DELETE(req: Request) {
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

  /* LA ENTRADA QUE JUSTIFICA MÁS ESTE REGISTRO DESPUÉS DE LA REVOCADA: aquí
     alguien deja a la clínica ENTERA sin sincronizar de un clic, y hasta hoy no
     quedaba rastro de quién.

     VA DESPUÉS DEL BORRADO, no antes: `borrarConexion` lanza si la fuente nueva
     falla, y esa excepción sale de aquí como 500 sin llegar a esta línea. Sólo
     se registra lo que de verdad ocurrió. El `return` temprano de arriba —sin
     conexión que borrar— tampoco escribe nada, que es lo correcto: no se borró
     nada, y es también lo que corta el segundo clic de un doble clic.

     ⚠ EL `clinica_id` VA EN LA DESCRIPCIÓN Y NO ES REDUNDANTE CON
     `registro_id`. `audit_log` no tiene columna de clínica, y esta fila que
     acabamos de borrar es justamente la que traducía ese uuid a una clínica:
     sin `clinica` aquí dentro, `registro_id` queda apuntando a nada y la
     entrada más consecuente de las cuatro no sirve para investigar.

     `duenoConexion` es de quién era la cuenta de Google, en uuid de Spinus —no
     tiene por qué ser quien pulsa—. El correo de esa cuenta NO entra; ver la
     nota de la acción en `src/lib/audit.ts`.

     El `await` no se quita: sin él el `insert` sigue en vuelo cuando responde
     la ruta y en Vercel se pierde a veces. Esto es un clic de /perfil con
     spinner sobre una operación que ya habló con la base: el viaje extra no se
     nota. */
  await logAudit({
    userId:      user.id,
    accion:      'gcal_conexion_baja',
    tabla:       'clinica_conexiones_google',
    registroId:  conexion.id,
    ip:          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    descripcion: JSON.stringify({
      clinica:       conexion.clinicaId,
      duenoConexion: conexion.userId,
      calendario:    conexion.calendarId,
    }),
  })

  return NextResponse.json({ ok: true })
}
