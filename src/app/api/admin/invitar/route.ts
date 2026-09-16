import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { checkIpRateLimit } from '@/lib/rateLimit'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { InvitarUsuarioSchema } from '@/lib/perfil/schemas'
import { escapeHtml } from '@/lib/htmlEscape'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Invitación por correo (Bloque B5-bis). Sustituye a `api/admin/crear-usuario`.
 *
 * QUÉ CAMBIA RESPECTO A LO QUE HABÍA: el administrador ya no escribe la
 * contraseña de su equipo. Escribía una, se la dictaba, y quedaba conociendo la
 * clave de alguien que firma en un expediente clínico. Aquí se crea la cuenta
 * sin contraseña y se manda un enlace; la elige el invitado en `/invitacion`.
 *
 * QUÉ NO CAMBIA, y conviene que se vea: la fila de `profiles` se escribe AQUÍ,
 * al invitar, con `clinica_id` e `invitado_por` puestos. No es un detalle de
 * implementación, es lo que hace que el invitado aterrice en el sitio correcto:
 * `lib/perfil/gate.ts` mira esos dos campos para decidir si a un médico se le
 * enseña el formulario de alta de clínica, el panel de soporte, o —cuando ya
 * tiene clínica, que es este caso— ninguno de los dos. Y es también lo que hace
 * que la invitación pendiente OCUPE PLAZA en los topes del plan, que es lo
 * correcto: tres invitaciones abiertas no pueden convertirse en tres médicos
 * por encima del tope.
 *
 * ⚠️ `generateLink` Y NO `inviteUserByEmail`, Y NO ES INDIFERENTE. Producción
 * tiene puesto el hook «Send Email» (`api/auth/email-hook`), y GoTrue enruta
 * por él TODOS sus correos. Ese hook atiende `signup`, `recovery` y
 * `magiclink`, y cualquier otro tipo cae en su rama final, que registra «Tipo
 * no manejado» y responde `{ok:true}`: la invitación se daría por enviada y no
 * llegaría nunca. `generateLink` no dispara el hook —solo fabrica el token— y
 * el correo lo mandamos nosotros, que es el patrón que ya usa
 * `api/auth/registro` para la confirmación de cuenta.
 *
 * ⚠️⚠️ EL ENLACE DEL CORREO LO CONSTRUIMOS NOSOTROS. `generateLink` devuelve
 * también un `action_link` que apunta a `/auth/v1/verify` de GoTrue: ESE NO SE
 * MANDA NUNCA. Canjear en el navegador establece sesión en cookies de todo el
 * dominio, y es exactamente el agujero que se cerró en B6-bis (ver el bloque de
 * `api/auth/reset-password/route.ts`). Lo que viaja es `/invitacion?token_hash=`,
 * y quien canjea es el servidor.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  /* Se piden además los campos del nombre: quien invita firma el correo. No se
     compone aquí a mano —`componerNombreMedicoCompleto` es la fuente única
     desde NOMBRES_PLAN.md Fase 4— y NUNCA se lee el campo legacy `nombre`. */
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, clinica_id, es_admin_de_clinica, titulo, nombres, apellido_paterno, apellido_materno')
    .eq('id', user.id)
    .single()

  /* ⚠️ `clinica_id` VA EN LA CONDICIÓN, NO SOLO EN EL `select`. `canManageClinica`
     afirma «es dueño», no «es dueño DE ESTA clínica» — ver su comentario en
     `lib/permissions.ts`. Sin este primer término, una cuenta con el flag en
     true y `clinica_id` NULL pasaba la guarda, y además se saltaba ENTEROS los
     topes de plan de abajo, porque ese bloque cuelga de que la clínica exista. */
  if (!creatorProfile?.clinica_id || !canManageClinica(creatorProfile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  /* ⚠️ EL TOPE POR IP VA DESPUÉS DE LA GUARDA, al revés que en `registro`, y la
     diferencia es que aquella ruta es pública y ésta no. Con el tope delante,
     cualquiera sin sesión podría agotar el presupuesto de la IP de una clínica
     —todas comparten una— y dejar a su administrador sin poder invitar: una
     palanca de denegación de servicio regalada. Después de la guarda, solo
     gasta presupuesto quien ya demostró que administra esta clínica.
     Que exista es nuevo: `crear-usuario` no tenía ninguno, y ahora esta ruta
     además EMITE CORREO hacia una dirección que elige quien llama, firmado con
     nuestro DKIM. 10/h por IP es holgado para dar de alta a un equipo.
     ⚠️ Y hace falta aquí porque GoTrue no lo trae: comprobado contra
     `admin/generate_link` (tres llamadas en el mismo segundo, tres 200). */
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limitado = await checkIpRateLimit(ip, 'invitar', 10)
  if (limitado) return limitado

  const parsed = InvitarUsuarioSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  const { email, role } = parsed.data
  const clinicaId = creatorProfile.clinica_id
  const admin = createAdminClient()

  /* Una sola consulta para las dos cosas que hacen falta de la clínica: sus
     topes y su nombre, que va en el correo.
     ⚠️ SI NO HAY FILA, SE PARA. Antes esto era un `if (clinica)` que seguía
     adelante sin comprobar ningún tope — con `clinica_id` no nulo la fila
     existe siempre, así que la rama era inalcanzable, pero describía el fallo
     al revés: ante la duda, dejaba pasar. */
  const { data: clinica } = await admin
    .from('clinicas')
    .select('nombre, max_medicos, max_secretarias')
    .eq('id', clinicaId)
    .single()

  if (!clinica) {
    logger.error('api/admin/invitar', `clinica ${clinicaId} no encontrada; no se puede comprobar el tope`)
    return NextResponse.json({ error: 'No pudimos verificar tu plan. Intenta de nuevo.' }, { status: 500 })
  }

  const tope = role === 'medico' ? clinica.max_medicos : clinica.max_secretarias
  if (tope !== null) {
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId)
      .eq('role', role)

    if ((count ?? 0) >= tope) {
      return NextResponse.json(
        {
          error: role === 'medico'
            ? 'Has alcanzado el límite de médicos de tu plan'
            : 'Has alcanzado el límite de asistentes de tu plan',
        },
        { status: 403 },
      )
    }
  }

  /* Crea la cuenta de `auth` SIN contraseña y devuelve el token del enlace.
     No se le pasa `redirectTo` a propósito: su único efecto es el `redirect_to`
     que cuelga del `action_link`, y el `action_link` no se usa (ver cabecera). */
  const { data: enlace, error: enlaceError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
  })

  if (enlaceError) {
    /* Comprobado contra GoTrue v2.196.0: un correo que ya tiene cuenta —en esta
       clínica o en cualquier otra— responde 422 `email_exists`. Se traduce, no
       se reenvía: el mensaje crudo de GoTrue llegaba tal cual al cliente y es
       texto de una API ajena en medio de un formulario en español. */
    if (enlaceError.code === 'email_exists') {
      return NextResponse.json({ error: 'Ese correo ya tiene una cuenta en Spinus.' }, { status: 409 })
    }
    logger.error('api/admin/invitar', `generateLink falló (${enlaceError.code}): ${enlaceError.message}`)
    return NextResponse.json({ error: 'No pudimos crear la invitación. Intenta de nuevo.' }, { status: 400 })
  }

  const invitado = enlace?.user
  const tokenHash = enlace?.properties?.hashed_token

  if (!invitado || !tokenHash) {
    /* Sin token no hay invitación posible, así que la cuenta a medio nacer no se
       queda: sería una plaza ocupada por alguien que no puede entrar. */
    if (invitado) await admin.auth.admin.deleteUser(invitado.id)
    logger.error('api/admin/invitar', 'generateLink respondió sin usuario o sin token')
    return NextResponse.json({ error: 'No pudimos crear la invitación. Intenta de nuevo.' }, { status: 500 })
  }

  /* ⚠️ AQUÍ NO SE ESCRIBE NINGÚN NOMBRE, y es lo último que salió de esta ruta.
     Ni `nombres`, ni apellidos, ni el campo legacy `nombre`. Lo pone su dueño:
     el médico en el paso `datos` de su onboarding, la secretaria en el paso
     `nombre` que `lib/perfil/gate.ts` le pide desde B5-bis. Ese paso existe
     PORQUE este campo desapareció de aquí: sin él, y sin «Mi perfil» en su
     menú, no le quedaba ningún otro sitio donde escribirlo.

     · `nombre_confirmado: false` PARA LOS DOS ROLES. La secretaria nacía en
       `true` cuando su nombre lo tecleaba el administrador —no había nadie que
       fuera a reconfirmarlo—. Ahora lo teclea ella, y quien lo pone en `true`
       es su propio guardado: `PUT /api/me/perfil-medico` lo hace solo al
       recibir `nombres`.
     · `titulo` explícito en los dos casos: 'Dr.' para el médico, que es lo que
       ponía el formulario del admin cuando lo escribía él, y null para la
       secretaria, que ANULA el DEFAULT 'Dr.' de la columna
       (20260912190416_remote_schema.sql). El médico lo corrige en su onboarding
       si es 'Dra.'; especialidad y cédulas ya no se escriben aquí en absoluto.
     · `invitado_por` es PROCEDENCIA, no permiso, y se escribe para los dos
       roles. `user.id` es el del llamante, validado arriba. Lo lee
       `lib/perfil/gate.ts` para decidir a dónde mandar a quien no tiene
       clínica. */
  const { error: perfilError } = await admin.from('profiles').upsert({
    id: invitado.id,
    role,
    nombre_confirmado: false,
    clinica_id: clinicaId,
    invitado_por: user.id,
    titulo: role === 'medico' ? 'Dr.' : null,
  })

  /* ⚠️ ESTE ERROR SE COMPRUEBA PORQUE EL TRIGGER DE B5.6 LO VOLVIÓ INVISIBLE.
     La fila ya existe cuando llegamos aquí: `handle_new_user` la creó con
     `role='medico'` y nada más. Así que un fallo en este upsert deja a la
     SECRETARIA que el admin quiso invitar convertida en médico, sin
     `clinica_id` y sin `invitado_por` — y con esos tres valores el gate
     concluye que es dueña de una cuenta por crear y le enseña el FORMULARIO de
     clínica: podría fabricarse su propio inquilino con `es_admin_de_clinica`
     en true en vez de entrar en la clínica que la invitó.

     SE REVIERTE EL USUARIO. El patrón encaja porque llegar hasta aquí garantiza
     que la cuenta la creó ESTA petición: si el correo ya existía, `generateLink`
     salió arriba con `email_exists` (comprobado). No hay forma de borrar una
     cuenta ajena preexistente. Y la fila del trigger se va con ella:
     `profiles_id_fkey` es ON DELETE CASCADE.

     ⚠️ SE REGISTRAN `code` Y `message`, NUNCA `details` NI `hint`: esos dos
     traen los valores de la fila que falló. */
  if (perfilError) {
    logger.error(
      'api/admin/invitar',
      `Upsert de profiles falló (${perfilError.code}): ${perfilError.message}. Revirtiendo el usuario de auth.`,
    )
    const { error: rollbackError } = await admin.auth.admin.deleteUser(invitado.id)
    if (rollbackError) {
      logger.error(
        'api/admin/invitar',
        `NO se pudo revertir el usuario ${invitado.id}: queda con la fila del trigger (role='medico'). Revisar a mano.`,
      )
    }
    return NextResponse.json({ error: 'No pudimos crear la invitación. Intenta de nuevo.' }, { status: 500 })
  }

  /* Va aquí y no al final: a partir de esta línea la cuenta existe y ocupa
     plaza, mande o no mande el correo.
     ⚠️ LA DESCRIPCIÓN NO LLEVA EL CORREO DEL INVITADO, y no es un olvido: el
     `audit_log` es inmutable por trigger y no admite cancelación ARCO. Con
     `registro_id` se sabe a quién se invitó sin guardar su dirección para
     siempre. */
  logAudit({
    userId: user.id,
    accion: 'usuario_invitado',
    tabla: 'profiles',
    registroId: invitado.id,
    ip,
    descripcion: `rol: ${role}`,
  })

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
  const url = `${siteUrl}/invitacion?token_hash=${tokenHash}`
  const invitador = componerNombreMedicoCompleto(creatorProfile)

  const { error: errorCorreo } = await resend.emails.send({
    from: 'Spinus <noreply@mail.spinus.com.mx>',
    to: email,
    subject: 'Te invitaron a Spinus',
    html: emailInvitacion({ invitador, clinica: clinica.nombre, role, url }),
  })

  /* ⚠️ SI EL CORREO NO SALE, LA INVITACIÓN NO SE REVIERTE. Decisión tomada, no
     descuido: la cuenta y su perfil son válidos, la plaza ya está contada y
     reenviar es un botón del panel. Deshacerlo obligaría al admin a repetir el
     alta entera por un fallo de un tercero. Lo que sí se hace es DECIRLO: el
     panel pinta el aviso con `correo_enviado` y ofrece el reenvío. */
  if (errorCorreo) {
    logger.error('api/admin/invitar', `Resend falló para el usuario ${invitado.id}; la invitación queda creada`)
  }

  return NextResponse.json({ ok: true, correo_enviado: !errorCorreo })
}

/**
 * Reenvío de una invitación pendiente.
 *
 * ⚠️ VIVE AQUÍ Y NO EN `api/admin/usuarios`, QUE ERA EL PLAN. El motivo lo
 * decidió el correo: reenviar es mandar EXACTAMENTE el mismo mensaje, y la
 * maqueta, el cliente de Resend y la construcción del enlace están en este
 * archivo. Ponerlo en la otra ruta obligaba a una de dos: cuarta copia de la
 * plantilla, o que una ruta importe de otra ruta. A cambio se duplica la
 * guarda de permisos, que son diez líneas y ya estaban duplicadas entre las
 * tres rutas de admin.
 *
 * ⚠️ COMPROBADO CONTRA GoTrue v2.196.0: `generateLink` sobre un invitado que
 * NO ha aceptado devuelve 200 con un token nuevo, y el anterior deja de
 * servir. Sobre uno que ya aceptó —correo confirmado— devuelve 422
 * `email_exists`. Por eso aquí se comprueba el estado ANTES de pedir el
 * enlace: el 422 se puede traducir a algo que el admin pueda hacer, y un
 * reenvío a alguien que ya entró no tiene sentido.
 */
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, clinica_id, es_admin_de_clinica, titulo, nombres, apellido_paterno, apellido_materno')
    .eq('id', user.id)
    .single()

  if (!creatorProfile?.clinica_id || !canManageClinica(creatorProfile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  /* MISMA CLAVE DE LIMITADOR QUE EL ALTA, y es deliberado: si el reenvío
     tuviera su propio presupuesto, sería la forma de saltarse el del alta
     —invitar poco y reenviar mucho manda los mismos correos—. */
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limitado = await checkIpRateLimit(ip, 'invitar', 10)
  if (limitado) return limitado

  const cuerpo = await req.json().catch(() => null) as { userId?: unknown } | null
  const userId = typeof cuerpo?.userId === 'string' ? cuerpo.userId : ''
  if (!userId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const admin = createAdminClient()

  /* ⚠️ EL AISLAMIENTO ENTRE CLÍNICAS ES ESTA COMPROBACIÓN Y NADA MÁS. El
     cliente de servicio esquiva la RLS, así que sin este `clinica_id` un
     administrador podría reenviarle la invitación a alguien de otra clínica
     —o averiguar si un id existe—. Mismo criterio que el DELETE de
     `api/admin/usuarios`. */
  const { data: destino } = await admin
    .from('profiles')
    .select('clinica_id, role')
    .eq('id', userId)
    .single()

  if (!destino || destino.clinica_id !== creatorProfile.clinica_id) {
    return NextResponse.json({ error: 'Ese usuario no es de tu clínica' }, { status: 403 })
  }

  const { data: cuenta, error: cuentaError } = await admin.auth.admin.getUserById(userId)
  if (cuentaError || !cuenta?.user) {
    logger.error('api/admin/invitar', `getUserById falló al reenviar a ${userId}`)
    return NextResponse.json({ error: 'No pudimos reenviar la invitación. Intenta de nuevo.' }, { status: 500 })
  }

  /* El mismo criterio que pinta el estado en el panel (`api/admin/usuarios`),
     aplicado otra vez en servidor: el botón puede no estar, y aun así llegar
     la petición. */
  const pendiente = Boolean(cuenta.user.invited_at) && !cuenta.user.email_confirmed_at
  if (!pendiente) {
    return NextResponse.json({ error: 'ya_activa' }, { status: 409 })
  }

  const correo = cuenta.user.email
  if (!correo) {
    logger.error('api/admin/invitar', `el usuario ${userId} no tiene correo; no se puede reenviar`)
    return NextResponse.json({ error: 'No pudimos reenviar la invitación. Intenta de nuevo.' }, { status: 500 })
  }

  const { data: enlace, error: enlaceError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: correo,
  })

  if (enlaceError || !enlace?.properties?.hashed_token) {
    /* `email_exists` aquí significa que la cuenta se confirmó por otra vía
       entre la comprobación de arriba y esta línea, o que el invitado pulsó un
       enlace de confirmación en vez del de invitación. No tiene arreglo por
       reenvío: hay que cancelar y volver a invitar, y eso es lo que el panel
       ofrece al recibir este código. */
    if (enlaceError?.code === 'email_exists') {
      return NextResponse.json({ error: 'ya_activa' }, { status: 409 })
    }
    logger.error('api/admin/invitar', `generateLink falló al reenviar (${enlaceError?.code}): ${enlaceError?.message}`)
    return NextResponse.json({ error: 'No pudimos reenviar la invitación. Intenta de nuevo.' }, { status: 500 })
  }

  const { data: clinica } = await admin
    .from('clinicas')
    .select('nombre')
    .eq('id', creatorProfile.clinica_id)
    .single()

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
  const url = `${siteUrl}/invitacion?token_hash=${enlace.properties.hashed_token}`

  const { error: errorCorreo } = await resend.emails.send({
    from: 'Spinus <noreply@mail.spinus.com.mx>',
    to: correo,
    subject: 'Te invitaron a Spinus',
    html: emailInvitacion({
      invitador: componerNombreMedicoCompleto(creatorProfile),
      clinica: clinica?.nombre ?? 'tu clínica',
      role: destino.role === 'secretaria' ? 'secretaria' : 'medico',
      url,
    }),
  })

  if (errorCorreo) {
    /* ⚠️ AQUÍ SÍ IMPORTA MÁS QUE EN EL ALTA: el enlace anterior YA ESTÁ MUERTO
       —`generateLink` lo sustituyó— así que un reenvío que no sale deja a la
       persona peor que antes. No hay nada que revertir (el token nuevo es
       válido y el viejo no vuelve), así que lo que toca es decirlo y que el
       admin lo repita. */
    logger.error('api/admin/invitar', `Resend falló al reenviar a ${userId}; el enlace anterior ya no sirve`)
  }

  logAudit({
    userId: user.id,
    accion: 'invitacion_reenviada',
    tabla: 'profiles',
    registroId: userId,
    ip,
  })

  return NextResponse.json({ ok: true, correo_enviado: !errorCorreo })
}

/* ─── Maqueta del correo ──────────────────────────────────────────────────────
   ⚠️ TERCERA COPIA DE LA MISMA MAQUETA (las otras dos: `api/auth/email-hook` y
   `api/auth/registro`). Está duplicada a sabiendas: con tres usos reales ya se
   justificaría extraerla, pero hacerlo desde aquí sería un refactor de tres
   archivos metido en un cambio que no lo pidió. Anotado en `DEUDA_TECNICA.md`.
   Lo que NO es negociable mientras viva duplicada: los valores interpolados se
   escapan SIEMPRE, vengan de donde vengan. Este correo lo firma DKIM con
   mail.spinus.com.mx y su cuerpo no lo elige un tercero. */
function maqueta(titulo: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
        <tr><td style="background-color:#1a3a5c;padding:28px;">
          <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${titulo}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          ${contenido}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function boton(url: string, texto: string): string {
  const urlSegura = escapeHtml(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
    <tr><td align="center" style="background-color:#1e5fa8;padding:14px 36px;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${urlSegura}" style="height:48px;width:220px;v-text-anchor:middle;" arcsize="20%" fillcolor="#1e5fa8" stroke="f"><v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:Segoe UI,Helvetica,sans-serif;font-size:15px;font-weight:600;"><![endif]-->
      <a href="${urlSegura}" style="display:inline-block;background-color:#1e5fa8;color:#ffffff;text-decoration:none;padding:14px 36px;font-weight:600;font-size:15px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        ${texto}
      </a>
      <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
    </td></tr>
  </table>
  <p style="color:#64748b;font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:<br>
  <span style="color:#1e5fa8;word-break:break-all;">${urlSegura}</span></p>`
}

interface DatosInvitacion {
  /** Quien invita, ya compuesto. Vacío solo si su propio perfil no tiene nombre. */
  invitador: string
  clinica: string
  role: 'medico' | 'secretaria'
  url: string
}

function emailInvitacion({ invitador, clinica, role, url }: DatosInvitacion): string {
  /* «asistente médico» y no «secretaria»: es como se llama el rol de cara al
     usuario en todo el panel. `secretaria` es el valor de la columna. */
  const rol = role === 'medico' ? 'médico' : 'asistente médico'

  /* ⚠️ SALUDO SIN NOMBRE, Y NO ES QUE NO SEPAMOS EL SUYO: es que cuando este
     correo sale, no existe. La invitación ya no lo pide, y ése es justamente el
     punto — lo pondrá quien lo lleva. Mismo saludo que `api/auth/registro` y
     que `api/auth/reenviar-confirmacion`.
     ⚠️ Y EL ÚNICO TRATAMIENTO DEL TEXTO ES EL DE QUIEN INVITA. No le cuelgues
     un «Dr.» al destinatario: este mismo correo le llega a la asistente. */

  /* Si quien invita no tiene nombre en su perfil, la frase se reescribe entera
     en vez de dejar un hueco delante del verbo. */
  const alta = invitador
    ? `<strong>${escapeHtml(invitador)}</strong> te dio de alta en <strong>${escapeHtml(clinica)}</strong> como <strong>${rol}</strong>.`
    : `Te dieron de alta en <strong>${escapeHtml(clinica)}</strong> como <strong>${rol}</strong>.`

  const pieReenvio = invitador
    ? `Si se te pasa, pídele a ${escapeHtml(invitador)} que te lo reenvíe desde Spinus.`
    : 'Si se te pasa, pídele a quien te invitó que te lo reenvíe desde Spinus.'

  return maqueta('Te invitaron a Spinus', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${alta}</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Para entrar solo falta una cosa: elegir tu contraseña. La eliges tú y no la ve nadie más — tampoco quien te invitó.</p>
    ${boton(url, 'Elegir mi contraseña')}
    <p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Este enlace caduca en 1 hora.</strong> ${pieReenvio}</p>
    <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
      Si no esperabas esta invitación, ignora este mensaje: sin contraseña, la cuenta no se activa.
    </p>
  `)
}
