import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

/* ═══ PATCH /api/pacientes/[id]/correo — guardar el correo en la ficha ═══
   Lo llama el modal de envío DESPUÉS de mandar el documento, cuando el médico
   tuvo que teclear la dirección porque la ficha no tenía ninguna. El envío ya
   ocurrió: esto es solo para la próxima vez.

   ⚠️⚠️ NO SUSTITUYE UN CORREO QUE YA EXISTA. NUNCA. Si la ficha ya tiene una
   dirección, esta ruta responde 409 y no toca nada, aunque el médico insista.

   La razón es que el caso que la origina es el contrario: el paciente pide que
   ESE documento se lo manden a un familiar, o dicta otra dirección ese día. Si
   guardar sobrescribiera, un envío puntual a la hija se llevaría por delante el
   correo bueno del paciente, y nadie se enteraría hasta que un envío futuro
   fuera a parar a la persona equivocada. Por eso el modal ni siquiera ofrece
   guardar cuando ya hay correo, y por eso además el servidor lo impide: la
   segunda barrera es la que sigue en pie cuando alguien cambia la primera.

   Cambiar un correo existente es editar la ficha, y ahí es donde se hace — con
   el dato viejo a la vista.

   ── QUIÉN PUEDE ────────────────────────────────────────────────────────────
   No lo decide esta ruta: lo decide la RLS de `pacientes`. La policy
   `pacientes_update` (20260524_etapa5e_bd1_policies_pacientes.sql:77) exige, en
   la clínica del usuario, ser admin de clínica, secretaria, o MÉDICO TRATANTE
   del paciente. Un médico que emitió un documento para un paciente que no es
   suyo puede enviarlo, pero NO puede escribir en su ficha: el UPDATE no afecta
   ninguna fila y aquí sale un 403 legible. Se deja que mande la RLS a propósito
   —duplicar el criterio en TypeScript es cómo se desincronizan—.

   ⚠️ Y SE REGISTRA EN `audit_log`, porque es una escritura sobre datos
   personales del paciente. Nota para quien pase por aquí: `PUT
   /api/pacientes/[id]`, que también escribe `email`, NO registra nada. Es un
   hueco anterior a este cambio y sigue abierto; no lo tapa esta ruta. */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const cuerpo: unknown = await req.json()
    const correo = typeof (cuerpo as { correo?: unknown })?.correo === 'string'
      ? ((cuerpo as { correo: string }).correo).trim().toLowerCase()
      : ''

    if (!EMAIL_REGEX.test(correo)) {
      return NextResponse.json({ error: 'Correo no válido' }, { status: 400 })
    }

    /* La RLS de SELECT ya limita a la clínica: si no aparece, no es suyo. */
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id, email')
      .eq('id', id)
      .single<{ id: string; email: string | null }>()

    if (!paciente) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
    }

    const yaTenia = paciente.email?.trim() ?? ''
    if (yaTenia !== '') {
      /* Ni siquiera cuando coincide: si ya está guardado no hay nada que hacer,
         y si es distinto, sustituirlo es justo lo que esta ruta impide. */
      return NextResponse.json(
        {
          error: yaTenia.toLowerCase() === correo
            ? 'Este correo ya está en la ficha del paciente.'
            : 'La ficha ya tiene otro correo. Para cambiarlo, edita la ficha del paciente.',
          correoEnFicha: yaTenia,
        },
        { status: 409 },
      )
    }

    /* `is('email', null)` además del control de arriba: entre la lectura y la
       escritura cabe otro guardado, y sin esta condición el último ganaría en
       silencio. Con ella, el segundo no afecta ninguna fila. */
    const { data: actualizado, error } = await supabase
      .from('pacientes')
      .update({ email: correo })
      .eq('id', id)
      .is('email', null)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    /* Cero filas = la RLS lo rechazó, o alguien guardó primero. Los dos casos se
       cuentan igual porque el desenlace para el médico es el mismo: no se
       guardó, y el envío —que ya ocurrió— no se ve afectado. */
    if (actualizado === null || actualizado.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo guardar en la ficha. Puede que no tengas permiso para editar a este paciente.' },
        { status: 403 },
      )
    }

    logAudit({
      userId: user.id,
      accion: 'actualizar_paciente_correo',
      tabla: 'pacientes',
      registroId: id,
      ip,
      descripcion: `Correo guardado en la ficha (${correo}) tras enviar un documento. La ficha no tenía ninguno.`,
    })

    return NextResponse.json({ ok: true, correo })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
