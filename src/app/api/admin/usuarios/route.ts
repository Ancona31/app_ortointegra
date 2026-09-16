import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id, es_admin_de_clinica').eq('id', user.id).single()

  // Solo admin de clínica puede gestionar usuarios
  if (!profile?.clinica_id || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  /* ⚠️ `perPage: 1000` Y NO LA LLAMADA PELADA. Sin el parámetro, GoTrue sirve
     su página por defecto —50 cuentas de TODO el proyecto, no de esta
     clínica—, así que a partir de la cuenta 51 el cruce de abajo no encuentra
     al usuario. Hasta ahora eso solo pintaba el correo como «—»; desde que de
     ese mismo cruce sale el ESTADO de la invitación, un usuario fuera de la
     primera página se pintaría «Invitación enviada» llevando meses dentro. Un
     defecto cosmético pasó a ser uno que miente, y por eso se arregla aquí.
     Los otros seis llamadores de `listUsers` del proyecto ya pasan este valor. */
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })

  // Traer perfiles de la misma clínica
  const { data: profiles } = await admin
    .from('profiles')
    .select('*')
    .eq('clinica_id', profile.clinica_id)

  // Admin de clínica ve a todo su equipo, excepto a sí mismo
  const usuarios = (profiles || [])
    .filter(p => p.id !== user.id)
    .map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      // nombre se COMPONE desde campos estructurados (NOMBRES_PLAN.md, Fase 4).
      // Filas migradas en Fase 2 ya tienen los 3 campos poblados. Se conserva la
      // key `nombre` en la respuesta → page.tsx / type Usuario no cambian.
      /* ⚠️ EL ESTADO SE CALCULA EN SERVIDOR Y SALE DE `auth.users`, NO DE UNA
         COLUMNA NUESTRA. No hace falta ninguna: GoTrue ya lo dice, y lo
         comprobé contra v2.196.0 —recién invitado, `invited_at` puesto y
         `email_confirmed_at` vacío; tras aceptar, los dos puestos—.
         Se miran LOS DOS campos y no solo el segundo: un médico que se
         registró por su cuenta y no ha confirmado el correo también tiene
         `email_confirmed_at` vacío, y ése no es un invitado. `invited_at` solo
         lo pone la invitación.
         Las cuentas anteriores a B5-bis nacieron con `email_confirm: true`, así
         que salen como 'activa', que es lo que son. */
      const pendiente = Boolean(authUser?.invited_at) && !authUser?.email_confirmed_at

      return {
        id: p.id,
        role: p.role,
        estado: pendiente ? 'pendiente' : 'activa',
        nombre: componerNombreMedicoCompleto({
          titulo: p.titulo,
          nombres: p.nombres,
          apellido_paterno: p.apellido_paterno,
          apellido_materno: p.apellido_materno,
        }),
        clinica_id: p.clinica_id,
        es_admin_de_clinica: p.es_admin_de_clinica,
        email: authUser?.email ?? '—',
      }
    })

  // Info de licencia
  let licencia = null
  if (profile.clinica_id) {
    const { data: clinica } = await admin
      .from('clinicas')
      .select('max_medicos, max_secretarias')
      .eq('id', profile.clinica_id)
      .single()
    if (clinica) licencia = { max_medicos: clinica.max_medicos, max_secretarias: clinica.max_secretarias }
  }

  return NextResponse.json({ usuarios, licencia })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, clinica_id, es_admin_de_clinica').eq('id', user.id).single()

  // Solo admin de clínica puede eliminar
  if (!profile?.clinica_id || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cuerpo = await req.json().catch(() => null) as { userId?: unknown } | null
  const userId = typeof cuerpo?.userId === 'string' ? cuerpo.userId : ''
  if (!userId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  // Verificar que el objetivo pertenece a la misma clínica
  const admin = createAdminClient()
  const { data: targetProfile } = await admin.from('profiles').select('role, clinica_id').eq('id', userId).single()

  if (targetProfile?.clinica_id !== profile.clinica_id) {
    return NextResponse.json({ error: 'No puedes eliminar usuarios de otra clínica' }, { status: 403 })
  }

  /* ⚠️ `profiles` PRIMERO Y `auth` DESPUÉS, AL REVÉS DE COMO ESTABA, Y EL
     MOTIVO ES QUE ESTE ES EL ÚNICO PASO QUE SABE DECIR POR QUÉ FALLA.

     Seis tablas apuntan a `profiles` con ON DELETE RESTRICT —`consultorios`,
     `documentos.subido_por`, `mediciones_analitos`, `firmas_documento`,
     `casos_clinicos`, `calculadora_resultados`—, así que borrar a un médico que
     ejerce está BLOQUEADO por la base. Eso está bien: es lo que impide que una
     baja se lleve por delante la autoría de un expediente.

     Lo que estaba mal era enterarse. Comprobado contra GoTrue v2.196.0 con la
     librería real:
       · `admin.auth.admin.deleteUser()` devuelve `AuthApiError` 500 con
         `code: 'unexpected_failure'` y «Database error deleting user». GoTrue
         NO propaga el SQLSTATE, así que por esa vía es imposible distinguir
         «tiene pacientes» de una caída de red.
       · `profiles.delete()` devuelve `code: '23503'` con el nombre de la
         restricción y la tabla que retiene. Código estable y documentado.
     Y las dos llamadas iban SIN COMPROBAR SU ERROR, con un `{ok:true}` detrás:
     el administrador leía «Usuario eliminado» y la persona seguía en la lista.

     ⚠️⚠️ Y SI VIENES A CONSTRUIR LA BAJA DE VERDAD, LEE BAJA-01 EN
     `DEUDA_TECNICA.md` ANTES DE TOCAR ESTO. El resumen: **la baja efectiva
     probablemente NO es un `DELETE`**. Las columnas que NO son RESTRICT son
     `ON DELETE SET NULL` —`consultas.medico_id` entre ellas—, así que borrar la
     fila de `profiles` deja las notas clínicas sin autor, que es el defecto de
     las 87 consultas que ya se arrastra. Quitarle el acceso a alguien y borrar
     su fila son dos cosas distintas, y lo que hace falta es la primera.

     ⚠️ SE BORRA, NO SE CONSULTA, y es deliberado: preguntar antes «¿tiene
     consultorios, documentos, mediciones…?» son seis consultas y una lista que
     se queda vieja en cuanto alguien añada una tabla con RESTRICT. Dejar que lo
     diga la propia base no se desactualiza nunca.

     ⚠️ Y EL ORDEN TIENE UN COSTE QUE HAY QUE CONOCER: si esto funciona y el
     borrado de auth de abajo falla, queda una cuenta sin fila de `profiles`.
     Esa persona podría iniciar sesión, pero no vería nada —sin perfil no hay
     `clinica_id` y la RLS le niega todo— y el siguiente intento de baja la
     termina de borrar. Se acepta a cambio de poder decirle al administrador qué
     pasó; antes no se enteraba de nada. */
  const { error: errPerfil } = await admin.from('profiles').delete().eq('id', userId)

  if (errPerfil) {
    /* 23503 = foreign_key_violation. El texto que ve el administrador vive en
       la pantalla, en español; aquí va sólo el código. */
    if (errPerfil.code === '23503') {
      return NextResponse.json({ error: 'tiene_historia_clinica' }, { status: 409 })
    }
    logger.error('api/admin/usuarios', `baja: delete de profiles falló (${errPerfil.code}): ${errPerfil.message}`)
    return NextResponse.json({ error: 'No se pudo dar de baja. Intenta de nuevo.' }, { status: 500 })
  }

  const { error: errAuth } = await admin.auth.admin.deleteUser(userId)
  if (errAuth) {
    logger.error(
      'api/admin/usuarios',
      `baja: la fila de profiles de ${userId} se borró pero su cuenta de auth NO (${errAuth.code}). Queda sin perfil: revisar a mano.`,
    )
    return NextResponse.json({ error: 'No se pudo dar de baja. Intenta de nuevo.' }, { status: 500 })
  }

  /* El rol viaja en la descripción y el correo NO, mismo criterio que las
     cuatro acciones de la invitación. */
  logAudit({
    userId: user.id,
    accion: 'usuario_dado_de_baja',
    tabla: 'profiles',
    registroId: userId,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    descripcion: `rol: ${targetProfile?.role ?? 'desconocido'}`,
  })

  return NextResponse.json({ ok: true })
}
