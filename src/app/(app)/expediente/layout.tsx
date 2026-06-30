import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Control de acceso — LISTA de pacientes (/expediente).
//
// Este layout cubre la LISTA y, por composición, el subárbol [id]/. El bloqueo
// de rol de la secretaria se movió a /expediente/[id]/layout.tsx: la secretaria
// SÍ puede ver la lista de pacientes (roster) pero NO el expediente clínico del
// paciente (que vive bajo [id]/).
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
