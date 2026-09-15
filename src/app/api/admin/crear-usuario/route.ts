import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { CrearUsuarioSchema } from '@/lib/perfil/schemas'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, clinica_id, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  /* ⚠️ `clinica_id` VA EN LA CONDICIÓN, NO SOLO EN EL `select`. `canManageClinica`
     afirma «es dueño», no «es dueño DE ESTA clínica» — ver su comentario en
     `lib/permissions.ts`. Sin este primer término, una cuenta con el flag en
     true y `clinica_id` NULL pasaba la guarda, y además se saltaba ENTEROS los
     topes de plan de abajo, porque ese bloque cuelga de que `clinicaId` exista.
     Sin rate limit en esta ruta, eso permitía acuñar usuarios de auth sin
     límite. */
  if (!creatorProfile?.clinica_id || !canManageClinica(creatorProfile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const parsed = CrearUsuarioSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  // Campos presentes en AMBAS variantes → desestructuración directa segura.
  const { email, password, role, nombres, apellido_paterno, apellido_materno } = parsed.data

  // C2 — campos exclusivos de médico: estrechar SOBRE parsed.data (la discriminante
  // se lee del objeto, no de una copia desestructurada) para que TS narre la unión.
  // Para secretaria → null EXPLÍCITO (el upsert escribe la columna con NULL y anula
  // el DEFAULT 'Dr.' de 02_tables.sql:406; omitirla dejaría actuar el default).
  const titulo = parsed.data.role === 'medico' ? (parsed.data.titulo || 'Dr.') : null
  const especialidad = parsed.data.role === 'medico' ? (parsed.data.especialidad || null) : null
  const cedula_profesional = parsed.data.role === 'medico' ? (parsed.data.cedula_profesional || null) : null
  const cedula_especialidad = parsed.data.role === 'medico' ? (parsed.data.cedula_especialidad || null) : null

  const clinicaId = creatorProfile.clinica_id
  const admin = createAdminClient()

  // Verificar límites de licencia
  if (clinicaId && (role === 'medico' || role === 'secretaria')) {
    const { data: clinica } = await admin
      .from('clinicas')
      .select('max_medicos, max_secretarias')
      .eq('id', clinicaId)
      .single()

    if (clinica) {
      const { count: countMedicos } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('role', 'medico')

      const { count: countSecretarias } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('role', 'secretaria')

      if (role === 'medico' && clinica.max_medicos !== null && (countMedicos ?? 0) >= clinica.max_medicos) {
        return NextResponse.json({ error: 'Has alcanzado el límite de médicos de tu plan' }, { status: 403 })
      }
      if (role === 'secretaria' && clinica.max_secretarias !== null && (countSecretarias ?? 0) >= clinica.max_secretarias) {
        return NextResponse.json({ error: 'Has alcanzado el límite de secretarias de tu plan' }, { status: 403 })
      }
    }
  }

  // Crear usuario en Supabase Auth
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Crear perfil. Nombre en 3 campos estructurados (NO `nombre` legacy).
  // C1 — nombre_confirmado condicional al rol: secretaria→true (el admin captura
  // su nombre y no hay onboarding que lo reconfirme); médico invitado→false (lo
  // confirmará en su onboarding, 3.C).
  // titulo/especialidad/cédulas ya vienen resueltos arriba (null para secretaria).
  const { error: perfilError } = await admin.from('profiles').upsert({
    id: newUser.user.id,
    role,
    nombres,
    apellido_paterno,
    apellido_materno,
    nombre_confirmado: parsed.data.role === 'secretaria',
    clinica_id: clinicaId ?? null,
    /* B5.7 — PROCEDENCIA, no permiso, y por eso se escribe para los DOS roles
       que salen de aquí: al médico invitado y a la secretaria los da de alta
       un administrador. En la secretaria hoy no cambia nada visible —el gate
       la exime antes de llegar al criterio—, pero el hecho es el mismo y
       guardarlo a medias sería peor que no guardarlo. `user.id` es el del
       llamante, ya validado arriba: sesión, `clinica_id` propio y
       `canManageClinica`. Lo lee `lib/perfil/gate.ts` para decidir si un
       usuario sin clínica va al formulario de alta o al panel de soporte. */
    invitado_por: user.id,
    titulo,
    especialidad,
    cedula_profesional,
    cedula_especialidad,
  })

  /* ⚠️ ESTE ERROR NO SE COMPROBABA, Y EL TRIGGER DE B5.6 LO VOLVIÓ INVISIBLE.
     Antes del trigger, un upsert fallido dejaba un usuario de `auth` SIN fila
     en `profiles`: huérfano, pero ruidoso — la aplicación no sabe quién es.
     Desde el trigger la fila ya existe con `role='medico'` y nada más
     (`handle_new_user`, 20260914_b56_trigger_aprovisionamiento.sql:397-399),
     así que un fallo aquí deja a la SECRETARIA que el admin quiso dar de alta
     convertida en médico, sin `clinica_id` y sin `invitado_por` — y la ruta
     respondía `ok`.

     Y DESDE B5.7 ESO YA NO ACABA EN EL PANEL DE SOPORTE, QUE ES LO QUE VUELVE
     URGENTE ESTA COMPROBACIÓN. El gate mira `invitado_por`, y con los tres
     valores que deja el trigger —`role='medico'`, sin clínica, sin invitador—
     concluye que la secretaria rota es dueña de una cuenta por crear: le
     enseña el FORMULARIO de clínica, no el panel. Puede crearse su propio
     inquilino, con `es_admin_de_clinica: true` (`api/me/clinica/route.ts:219`),
     en vez de entrar en la clínica del administrador que la invitó. El trigger
     cambió un fallo visible por uno silencioso, y B5.7 le dio salida.

     SE REVIERTE EL USUARIO, igual que `api/auth/registro/route.ts:93-96`. El
     patrón encaja aquí porque llegar a esta línea garantiza que la cuenta la
     creó ESTA petición: si el correo ya existía, `createUser` falla y la ruta
     sale arriba. No hay forma de borrar una cuenta ajena preexistente. Y la
     fila del trigger se va con ella: `profiles_id_fkey` es ON DELETE CASCADE
     (20260912190416_remote_schema.sql:2361-2362).

     ⚠️ SE REGISTRAN `code` Y `message`, NUNCA `details` NI `hint`: esos dos
     traen los valores de la fila que falló, y este upsert escribe `nombres`.
     Al cliente va un mensaje genérico, mismo criterio que `registro`. */
  if (perfilError) {
    logger.error(
      'crear-usuario',
      `Upsert de profiles fallo (${perfilError.code}): ${perfilError.message}. Revirtiendo el usuario de auth.`,
    )
    const { error: rollbackError } = await admin.auth.admin.deleteUser(newUser.user.id)
    if (rollbackError) {
      /* El único caso en que SÍ sobrevive la fila del trigger. Se registra
         porque es exactamente la secretaria-convertida-en-médico que este
         bloque viene a evitar, y hay que poder encontrarla a mano. */
      logger.error(
        'crear-usuario',
        `NO se pudo revertir el usuario ${newUser.user.id}: queda con la fila del trigger (role='medico'). Revisar a mano.`,
      )
    }
    return NextResponse.json({ error: 'Error al crear el usuario. Intenta de nuevo.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
