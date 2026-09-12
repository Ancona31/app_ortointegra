import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Control de acceso — LISTA de pacientes (/expediente).
//
// Este layout cubre la LISTA y, por composición, el subárbol [id]/. El bloqueo
// de rol de la secretaria se movió a /expediente/[id]/layout.tsx: la secretaria
// SÍ puede ver la lista de pacientes (roster) pero NO el expediente clínico del
// paciente (que vive bajo [id]/).
//
// ⚠️ EL REPARTO ENTRE LOS DOS GUARDAS, ESCRITO PARA QUE NO HAYA QUE DEDUCIRLO:
// ÉSTE EXIGE SESIÓN Y NADA MÁS; el de `[id]/layout.tsx` DECIDE POR ROL. Aquí no
// se consulta `profiles` — no por descuido, sino porque no hay ninguna decisión
// de rol que tomar sobre el roster. De ahí que el cierre de PERF-DT-2 (fallar
// cerrado cuando el rol no consta) toque sólo al hijo: sin consulta no hay
// consulta que pueda fallar. Si algún día este layout necesitara el perfil,
// hereda esa misma regla — mira la nota larga del hijo antes de escribirlo.
//
// Aquí solo se exige sesión. La RLS del RPC listar_pacientes_expediente
// (SECURITY INVOKER) acota los datos de la lista por clínica/rol; la secretaria
// ve el roster + chips de médico, nada clínico.
export default async function ExpedienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <>{children}</>
}
