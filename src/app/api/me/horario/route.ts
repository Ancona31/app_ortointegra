import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'

async function getProfileAndClinica(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/* ── AQUÍ VIVÍA `GET /api/me/horario`, Y NO VUELVE ───────────────────────────
   El horario se lee del agregado `/api/me/config`, que ya lo trae en la misma
   consulta a `clinicas` (ver su cabecera) y que el cliente pide desde que monta
   la agenda, así que en la práctica está resuelto mucho antes de que nadie abra
   el modal. NO está garantizado, y el modal no lo da por hecho: el engranaje se
   pinta según `canEditHorario` y el perfil, no según la config, de modo que se
   puede abrir con el agregado aún en vuelo — para eso tiene estado de carga, y
   otro de error. Su único consumidor era `HorarioModal`
   (`(app)/agenda/page.tsx`), que pedía este GET en cada apertura: una petición
   —y su posible arranque en frío— por un dato que casi siempre ya estaba en
   memoria.

   ⚠️ NO REPONGAS UN GET AQUÍ. La agenda deriva del MISMO objeto `horario` el
   gris de fuera de horario, el suelo/techo de los huecos y las cabeceras de
   día; un segundo origen es la segunda fuente de verdad que prohíbe la nota de
   «EL RESUMEN Y LOS HUECOS DE LA VISTA DÍA» en esa página. Si necesitas el
   horario en el cliente, suscríbete a `CLAVE_CONFIG` (`src/lib/configApp.ts`).

   El PUT se queda: escribir sí es cosa de esta ruta. */

/* ── PUT /api/me/horario ────────────────────────────────── */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const profile  = await getProfileAndClinica(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!canManageClinica(profile)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { horario } = await req.json()
    if (!horario) return NextResponse.json({ error: 'Horario requerido' }, { status: 400 })

    // clinicas no tiene política UPDATE para authenticated — necesita admin client (service role)
    const admin = createAdminClient()
    const { error } = await admin
      .from('clinicas')
      .update({ horario_consulta: horario })
      .eq('id', profile.clinica_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
