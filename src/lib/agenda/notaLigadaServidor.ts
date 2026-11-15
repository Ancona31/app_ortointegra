/**
 * src/lib/agenda/notaLigadaServidor.ts — G3 · ¿Tiene la cita una nota clínica
 * ligada (`consultas.appointment_id`)? SÓLO SERVIDOR; lo usa
 * `PUT /api/appointments/[id]` para `vetoPorNotaLigada` (`estadoCita.ts`).
 *
 * ⚠️ CLIENTE DE SERVICIO, y por qué: la RLS de `consultas` sólo deja ver las
 * notas propias (o al administrador), así que con la sesión de la secretaria o
 * de otro médico la nota «no existiría» y el veto se saltaría. La consulta va
 * filtrada por la CLÍNICA DE LA SESIÓN (por el paciente de la nota: `consultas`
 * no tiene `clinica_id`) y por la cita, que quien llama ya leyó con la RLS. Sólo
 * devuelve un booleano: nada del contenido de la nota sale de aquí.
 * Lanza si la lectura falla (la ruta contesta 500 sin escribir: falla cerrado).
 */
import { createAdminClient } from '@/lib/supabase/admin'

export async function tieneNotaLigada(clinicaId: string, citaId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('consultas')
    .select('id, pacientes!inner(clinica_id)')
    .eq('appointment_id', citaId).eq('pacientes.clinica_id', clinicaId)
    .limit(1)
  if (error) throw new Error(`nota ligada sin leer: ${error.code ?? ''}`)
  return (data ?? []).length > 0
}
