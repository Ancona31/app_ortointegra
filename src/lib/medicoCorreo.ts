/**
 * El correo de un medico de la clinica, resuelto EN EL SERVIDOR.
 *
 * ── POR QUE ES UN MODULO Y NO UNA FUNCION SUELTA EN UNA RUTA ────────────────
 * Nacio dentro de `/api/appointments/[id]/invitacion`, cuando invitar al medico
 * era una eleccion. Desde que el medico asignado entra SOLO en el evento, lo
 * necesitan tres llamadores: el alta (`events.insert`), la edicion (el `patch`
 * de una reasignacion) y la propia ruta de invitacion. Tres usos reales, no una
 * abstraccion especulativa.
 *
 * ── POR QUE NO VIAJA EN LA CITA ─────────────────────────────────────────────
 * `public.profiles` NO TIENE COLUMNA `email` —son 16 y ninguna es esa—, asi que
 * ampliar el join de `APPOINTMENT_SELECT` no es cuestion de anadir un campo: no
 * se puede pedir lo que la tabla no tiene. Tampoco hay vista que lo exponga
 * (`public` no tiene ninguna) y PostgREST no cruza al esquema `auth`. Sale por
 * la API de Admin de Auth, que exige service role.
 *
 * ── `getUserById` Y NUNCA `listUsers` ───────────────────────────────────────
 * `/api/admin/usuarios` barre el proyecto con `listUsers()` y cruza despues por
 * id, porque necesita a todos. Aqui hace falta UNO. Barrer mil cuentas para
 * quedarse con una es traer la libreta entera de la plataforma cada vez que
 * alguien agenda una cita.
 *
 * ── ⚠️ Y NO SALE DEL SERVIDOR ───────────────────────────────────────────────
 * Ninguno de los tres llamadores lo devuelve al navegador. Va de aqui al
 * `attendees` del evento y se acaba ahi.
 */
import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * `medico_invalido` es que el perfil no existe o no es de esa clinica.
 * `sin_correo` es casi inalcanzable —todo usuario de Spinus nace de un alta con
 * correo— y se contempla porque el `null` esta en el tipo que devuelve Auth.
 */
export type CorreoMedico =
  | { readonly ok: true;  readonly correo: string }
  | { readonly ok: false; readonly motivo: 'medico_invalido' | 'sin_correo' }

/**
 * ⚠️ LA COMPROBACION DE CLINICA NO ES DECORATIVA. El cliente admin esquiva la
 * RLS, asi que el perfil se comprueba por `id` Y por `clinica_id` ANTES de
 * pedirle el correo a Auth (pendiente prioritario de `CLAUDE.md`). En los tres
 * llamadores el `medicoId` sale de una fila que ya venia filtrada, pero esta
 * funcion no puede depender de eso: el dia que alguien la llame con un id de
 * otro sitio, esta linea es lo unico que impide sacar el correo de un usuario de
 * otra clinica.
 */
export async function correoDelMedico(
  admin: ReturnType<typeof createAdminClient>,
  medicoId: string,
  clinicaId: string,
): Promise<CorreoMedico> {
  const { data: perfil } = await admin
    .from('profiles')
    .select('id')
    .eq('id', medicoId)
    .eq('clinica_id', clinicaId)
    .maybeSingle<{ id: string }>()

  if (!perfil) return { ok: false, motivo: 'medico_invalido' }

  const { data, error } = await admin.auth.admin.getUserById(medicoId)
  const correo = data?.user?.email?.trim().toLowerCase() ?? ''

  if (error || correo === '') return { ok: false, motivo: 'sin_correo' }
  return { ok: true, correo }
}
