import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Control de acceso — DETALLE clínico del paciente.
//
// Bloqueo server-side de TODO el subárbol /expediente/[id] para el rol
// 'secretaria'. La secretaria SÍ puede ver la LISTA (/expediente) — gestiona
// agenda y alta de pacientes — pero NO el expediente clínico del paciente:
// notas, diagnósticos, laboratorios, documentos, consultas, edición.
//
// Este guard cubre por composición todas las sub-rutas bajo [id]/ (page,
// estado, laboratorios, editar, consulta/[consultaId], documentos, nueva-nota),
// incluidas rutas futuras que se agreguen bajo [id]/. Los layouts de
// suscripción de sub-rutas (documentos/, nueva-nota/) siguen aplicándose por
// debajo de éste.
//
// CONVENCIÓN (mantener el guard fail-closed): todo lo CLÍNICO de un paciente va
// bajo /expediente/[id]/. Lo que cuelga directo de /expediente/ es nivel-LISTA
// (roster, seguro para secretaria). Una sub-ruta clínica nueva debe ir bajo
// [id]/ para heredar este bloqueo automáticamente.
//
// Nota de defensa en profundidad: la protección PRIMARIA de los datos clínicos
// es la RLS de las tablas (consultas/documentos/mediciones/addendums excluyen a
// la secretaria en lectura y escritura). Este guard es la capa de navegación:
// evita que la secretaria aterrice en una página de detalle vacía/rota y
// responde server-side a la URL directa.
export default async function ExpedienteDetalleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'secretaria') redirect('/expediente')

  return <>{children}</>
}
