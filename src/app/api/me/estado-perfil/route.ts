import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/plans'
import { evaluarPerfil } from '@/lib/perfil/gate'
import type { Role } from '@/hooks/useProfile'

/**
 * ⚠️ TRES CONSULTAS QUE SE FUERON, Y POR QUÉ NO VUELVEN. Esta ruta calculaba
 * también `gridMode` (dos conteos: `pacientes` y `consultas`) y
 * `count_pacientes` (un tercero). NADIE los leía — comprobado con grep sobre
 * todo `src/`: `gridMode` solo aparecía en la interfaz de `/inicio`, que no lo
 * usaba en el render, y el `AccionesGrid` que lo habría consumido no tiene
 * consumidores; el `count_pacientes` de `lib/subscription.ts` es un campo
 * distinto de otro tipo, que esa función calcula por su cuenta.
 *
 * Importa porque desde el Bloque B5 este endpoint está en el CAMINO CRÍTICO de
 * entrar a la aplicación: `GateOnboarding` lo llama en cada carga dura de
 * `(app)`, no solo en `/inicio`. Eran seis consultas de las que tres servían a
 * campos muertos.
 *
 * `es_vip_grant` se queda aunque tampoco se lea: sale del `select` de
 * `clinicas` que de todas formas hace falta, así que no cuesta un viaje.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, es_admin_de_clinica, nombres, especialidad, cedula_profesional, cedula_especialidad, firma_url, clinica_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const role = profile.role as string

  // Calcular porcentaje de completitud del perfil (médicos: invitados y admins de clínica)
  let porcentaje = 0
  if (role !== 'secretaria') {
    if (profile.nombres) porcentaje += 25
    if (profile.especialidad) porcentaje += 25
    if (profile.cedula_profesional) porcentaje += 25
    if (profile.cedula_especialidad) porcentaje += 10
    if (profile.firma_url) porcentaje += 15
  } else {
    porcentaje = 100
  }

  /* ⚠️ EL DISPARADOR DEL ONBOARDING YA NO ES EL PORCENTAJE DE AQUÍ ARRIBA.
     Ese porcentaje pondera `cedula_especialidad` (10) y `firma_url` (15) y no
     mira ni `clinica_id` ni los consultorios, así que discrepaba del criterio
     único en los dos sentidos: un médico general con todo lo exigido se
     quedaba en 75 —y con el modal ya bloqueante eso es un encierro de por
     vida—, mientras que uno al 100 % sin consultorio pasaba sin modal y se
     comía el rechazo de la RLS sin nada que pudiera hacer al respecto.
     El porcentaje SE QUEDA porque el banner de /inicio lo pinta; lo que deja
     de hacer es decidir el bloqueo. Eso lo decide `evaluarPerfil`, el mismo
     criterio que `public.perfil_completo()` aplica en la base. */
  const { count: consultoriosActivos } = await supabase
    .from('consultorios')
    .select('id', { count: 'exact', head: true })
    .eq('medico_id', user.id)
    .eq('activo', true)

  const gate = evaluarPerfil({
    role: role as Role,
    es_admin_de_clinica: profile.es_admin_de_clinica as boolean | null,
    nombres: profile.nombres as string | null,
    especialidad: profile.especialidad as string | null,
    cedula_profesional: profile.cedula_profesional as string | null,
    clinica_id: profile.clinica_id as string | null,
    consultoriosActivos: consultoriosActivos ?? 0,
  })

  const requiereOnboarding = !gate.completo

  /* ── ¿Se le puede pedir la cédula de especialidad? ───────────────────────
     Solo si ejerce alguna especialidad que la tenga. A un médico general se le
     estaría pidiendo un documento que no existe.

     ⚠️ SE PARTE POR ' · ' Y SE EXIGE QUE **TODAS** LAS PARTES SEAN
     'Medicina General'. La columna guarda las dos especialidades fundidas con
     ese separador, así que `'Medicina General · Medicina del Deporte'` es un
     médico que SÍ tiene cédula —la de la segunda— y no debe quedar exento.
     Las filas viejas escritas con ', ' (defecto corregido en el onboarding)
     siguen en la base: `'Medicina General'` sola se exime igual, y
     `'Medicina General, Otra'` no, que es lo correcto.

     ⚠️ COMPARACIÓN EXACTA Y SENSIBLE A MAYÚSCULAS, contra ese literal y nada
     más. Un `includes('General')` dejaría sin aviso a `'Cirugía General'`, y
     `'Medicina Familiar'` y `'Medicina Familiar y Comunitaria'` también llevan
     cédula. Hueco conocido y aceptado: la SEGUNDA especialidad es texto libre
     (`ComboEscribible`), así que alguien podría teclear 'medicina general' en
     minúsculas; solo importaría si la escribiera dos veces, y comparar sin
     mayúsculas ablandaría la regla para todos los demás. */
  const especialidades = (profile.especialidad as string | null ?? '')
    .split(' · ')
    .map((e) => e.trim())
    .filter(Boolean)
  const soloMedicinaGeneral =
    especialidades.length > 0 && especialidades.every((e) => e === 'Medicina General')
  const cedulaEspecialidad = profile.cedula_especialidad as string | null
  const faltaCedulaEspecialidad =
    !soloMedicinaGeneral && !(typeof cedulaEspecialidad === 'string' && cedulaEspecialidad.trim().length > 0)

  // Plan de la clínica
  let plan: PlanKey = 'free'
  let suscripcion_estado = 'free'
  let es_vip_grant = false
  // Los dos pasos OMITIBLES del onboarding (logo y firma) no salen del gate:
  // el criterio no los exige. Se mandan aparte para no enseñárselos a quien
  // ya los tiene. El logo vive en la clínica, no en el perfil.
  let tieneLogo = false
  if (profile.clinica_id) {
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('plan, suscripcion_estado, es_vip_grant, logo_url')
      .eq('id', profile.clinica_id as string)
      .single()
    if (clinica) {
      plan = (clinica.plan as PlanKey) ?? 'free'
      suscripcion_estado = (clinica.suscripcion_estado as string) ?? 'free'
      es_vip_grant = (clinica.es_vip_grant as boolean) ?? false
      tieneLogo = typeof clinica.logo_url === 'string' && clinica.logo_url.length > 0
    }
  }

  return NextResponse.json({
    porcentaje,
    requiereOnboarding,
    gate,
    faltaCedulaEspecialidad,
    // Lo consume `GateOnboarding` para decidir si enseña el paso del logo. Va
    // en la respuesta y no se lee de `useProfile` en el cliente porque ese hook
    // cae a una copia en `secureStorage` que vive en el navegador del usuario.
    es_admin_de_clinica: profile.es_admin_de_clinica === true,
    tieneFirma: typeof profile.firma_url === 'string' && profile.firma_url.length > 0,
    tieneLogo,
    role,
    plan,
    planNombre: PLANS[plan]?.nombre ?? 'Free',
    suscripcion_estado,
    es_vip_grant,
  })
}
