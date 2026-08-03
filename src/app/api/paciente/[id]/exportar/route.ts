import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { canManageClinica } from '@/lib/permissions'
import type { MedicionAnalito, AnalitoCatalogo } from '@/types'

/**
 * POST /api/paciente/[id]/exportar — Derecho de Acceso (ARCO)
 *
 * Ejercicio del derecho de ACCESO bajo la LFPDPPP vigente (DOF 20/03/2025,
 * reformada 14/11/2025). ⚠️ El "Art. 28" que citaba este bloque es de la ley
 * de 2010, ABROGADA el 21/03/2025: no lo repongas ni lo cites en texto de
 * cara al usuario sin verificar el articulado nuevo.
 *
 * Genera un JSON con TODOS los datos del paciente: datos personales,
 * consultas con addendums, mediciones (con analito del catálogo embebido),
 * documentos y recetas.
 *
 * ═══ RESTRINGIDO A ADMIN DE CLÍNICA (QW3 / LP-DT-22, 2026-07-31) ═══
 * Antes exigía sesión y nada más: CUALQUIER médico autenticado podía pedir por
 * fetch el expediente íntegro de un paciente de su clínica, sin UI y sin
 * dejar más rastro que un `arco_acceso` indistinguible de uno legítimo.
 *
 * ⚠️ SE CERRÓ AHORA Y NO ES CASUALIDAD: la landing pasa a decir en público que
 * el médico puede llevarse su información (§7·12b, pregunta 1). Lo que la
 * landing describe es el botón de PDF en cliente
 * (`ExportarExpedienteButton.tsx`), no esta ruta — pero es el primer sitio
 * donde mirará quien vaya a buscar cómo se exporta, y un pendiente sin
 * visibilidad se convierte en superficie documentada por nuestro propio
 * marketing.
 *
 * ⚠️ SUPER_ADMIN NO ENTRA, y eso SE APARTA de la redacción original de QW3
 * ("super_admin + admin"). Dos motivos, los dos en el repo:
 *   · `permissions.ts:31-34` fija la doctrina: "super_admin opera
 *     EXCLUSIVAMENTE vía endpoints /api/super-admin/*. NO accede a endpoints
 *     regulares de la app médica". QW3 se escribió antes del refactor de
 *     roles de la etapa 4.
 *   · Y aunque entrara, no serviría: esta ruta usa el cliente con sesión, y
 *     las policies de `pacientes` no tienen rama de super_admin (decisión
 *     D2-A, `20260524_etapa5e_bd1_policies_pacientes.sql`). Se llevaría un 404
 *     después de haber pasado el gate, que es lo peor de los dos mundos.
 * El `admin` legacy tampoco existe: lo eliminó
 * `20260519114652_etapa4a8_eliminar_rol_admin_legacy.sql`. El admin de clínica
 * es `role='medico' + es_admin_de_clinica=true`, que es justo lo que
 * `canManageClinica()` comprueba.
 */
type MedicionConAnalito = MedicionAnalito & {
  analito: AnalitoCatalogo | null
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/paciente/[id]/exportar'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    /* Gate de rol — ver el bloque de arriba. Va ANTES de tocar la base: un
       médico invitado no debe poder ni confirmar que el paciente existe.
       El intento denegado SÍ se registra (y con `await`, no fire-and-forget:
       aquí no hay nada que entregar al usuario, así que no hay prisa que
       justifique perder el evento). */
    if (!canManageClinica(profile)) {
      await logAudit({
        userId: user.id,
        accion: 'arco_intento_denegado',
        tabla: 'pacientes',
        registroId: id,
        ip,
        descripcion: `Intento de exportación ARCO sin rol de admin de clínica (role=${profile.role})`,
      })
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Verificar que el paciente pertenece a la clínica (RLS)
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Cargar todos los datos clínicos en paralelo
    const [
      { data: consultas },
      { data: mediciones },
      { data: documentos },
      { data: addendums },
    ] = await Promise.all([
      supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
      supabase
        .from('mediciones_analitos')
        .select('*, analito:analitos_catalogo(*)')
        .eq('paciente_id', id)
        .order('medido_en', { ascending: false }),
      supabase.from('documentos').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
      supabase.from('addendums').select('*').order('created_at', { ascending: true }),
    ])

    // Vincular addendums a sus consultas
    const consultaIds = new Set((consultas ?? []).map(c => c.id))
    const allAddendums = addendums ?? []
    const addendumsPorConsulta: Record<string, typeof allAddendums> = {}
    for (const a of allAddendums) {
      if (consultaIds.has(a.consulta_id)) {
        if (!addendumsPorConsulta[a.consulta_id]) addendumsPorConsulta[a.consulta_id] = []
        addendumsPorConsulta[a.consulta_id]!.push(a)
      }
    }

    const consultasConAddendums = (consultas ?? []).map(c => ({
      ...c,
      addendums: addendumsPorConsulta[c.id] ?? [],
    }))

    const expediente = {
      exportado_en: new Date().toISOString(),
      version: 'v1.1',
      derecho_arco: 'ACCESO',
      paciente,
      consultas: consultasConAddendums,
      mediciones: (mediciones ?? []) as MedicionConAnalito[],
      documentos: documentos ?? [],
    }

    // Registrar en audit_log
    logAudit({
      userId: user.id,
      accion: 'arco_acceso',
      tabla: 'pacientes',
      registroId: id,
      ip,
      descripcion: 'Exportación completa de expediente (Derecho de Acceso ARCO)',
    })

    return NextResponse.json(expediente)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
