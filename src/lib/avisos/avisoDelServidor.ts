/**
 * src/lib/avisos/avisoDelServidor.ts — el aviso de la campana que sólo el SERVIDOR puede dejar,
 * porque lo que pasó no deja rastro que un disparador de la base pueda ver (avisos globales, M1):
 *   · `reserva_frenada`: alguien intentó reservar por enlace y lo frenó el candado o un contacto
 *     bloqueado. La cita no nace, así que no hay fila que dispare nada. Lleva el nombre que tecleó
 *     (decisión de Angel; puede no ser real). Ni teléfono ni correo.
 *   · `personal_movio`: «Reagendar» del personal, que escribe con `service_role` (sin `auth.uid()`):
 *     el disparador de citas no sabe quién fue.
 * SÓLO SERVIDOR.
 *
 * ⚠️ `createAdminClient()` Y POR ESO `clinica_id` EXPLÍCITO (regla del proyecto): la RPC
 * `aviso_clinica_registrar` (sólo `service_role`, lista blanca de tipos) vuelve a comprobar en la
 * base que médico, cita y actor son de ESA clínica. Quien llama pasa la clínica de la sesión o del
 * enlace, nunca una del cuerpo de la petición.
 *
 * ⚠️ NUNCA LANZA Y NUNCA FRENA: un aviso es accesorio. Se llama dentro de `after()`. Sin M1 en la
 * base (PGRST202) no hace nada, en silencio: es el estado esperado hasta que se aplique.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

type AvisoDelServidor =
  | { tipo: 'reserva_frenada'; clinicaId: string; medicoId: string; nombre: string }
  | { tipo: 'personal_movio'; clinicaId: string; citaId: string; actorId: string }

export async function registrarAvisoDelServidor(a: AvisoDelServidor): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc('aviso_clinica_registrar', {
      p_clinica_id: a.clinicaId, p_tipo: a.tipo,
      p_cita_id: a.tipo === 'personal_movio' ? a.citaId : null,
      p_medico_id: a.tipo === 'reserva_frenada' ? a.medicoId : null,
      p_actor_id: a.tipo === 'personal_movio' ? a.actorId : null,
      p_nombre: a.tipo === 'reserva_frenada' ? a.nombre : null,
    })
    // Sin datos de nadie en el log: sólo el tipo y el código.
    if (error && error.code !== 'PGRST202') logger.warn('avisos', `aviso ${a.tipo} sin registrar: ${error.code ?? ''}`)
  } catch (err: unknown) {
    logger.warn('avisos', `aviso ${a.tipo} sin registrar: ${err instanceof Error ? err.name : 'error'}`)
  }
}
