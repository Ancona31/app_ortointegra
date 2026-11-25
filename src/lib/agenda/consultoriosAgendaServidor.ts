/**
 * src/lib/agenda/consultoriosAgendaServidor.ts
 *
 * Los consultorios con los que se dibuja la agenda v2 (`horarioRejilla.ts`):
 * su horario y su zona. SÓLO SERVIDOR; lo llama `agenda/page.tsx` y sólo con
 * el interruptor encendido.
 *
 * ⚠️ CLIENTE DE SERVICIO, FILTRADO POR `clinica_id` Y POR EL ALCANCE DE LA
 * AGENDA. La RLS de `consultorios` (`consultorios_select`) sólo le enseña al
 * médico los suyos, pero la agenda del administrador enseña las citas de todos
 * los médicos (`appointments_select`), y con «Todos los médicos» la rejilla va
 * de la apertura más temprana al cierre más tardío de TODOS (punto 11 de
 * Angel). El alcance copia el de `appointments_select`: administrador y
 * secretaria, los de la clínica; el médico invitado, sólo los suyos. Sólo
 * horario, zona y a quién pertenecen: ni nombre, ni dirección, ni teléfono.
 * Mismo patrón que `preparacionServidor.ts` (lo anota CLAUDE.md).
 *
 * TOLERANCIA: cualquier error (también la columna `horario_propio` ausente,
 * producción sin B5) da `null`, y la agenda sigue con los consultorios de la
 * sesión, como antes.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import type { ConsultorioRejilla } from '@/lib/agenda/horarioRejilla'

/** Lo que hace falta del perfil de la sesión, ya validado (`analizarPerfilSesion`). */
export interface PerfilAgenda {
  id: string
  role: string
  clinica_id: string
  es_admin_de_clinica: boolean
}

/** ¿Ve quien mira las citas de todos los médicos? La regla de `appointments_select`. */
export function veTodosLosMedicos(p: PerfilAgenda): boolean {
  return p.role === 'secretaria' || (p.role === 'medico' && p.es_admin_de_clinica)
}

export async function leerConsultoriosAgenda(p: PerfilAgenda): Promise<ConsultorioRejilla[] | null> {
  if (p.role !== 'medico' && p.role !== 'secretaria') return null
  let q = createAdminClient()
    .from('consultorios')
    .select('id, medico_id, timezone, horario, horario_propio, activo')
    .eq('clinica_id', p.clinica_id)
  if (!veTodosLosMedicos(p)) q = q.eq('medico_id', p.id)
  const { data, error } = await q
  if (error) {
    logger.warn('agenda', `consultorios de la rejilla sin leer: ${error.code ?? 'error'}`)
    return null
  }
  return data ?? []
}
