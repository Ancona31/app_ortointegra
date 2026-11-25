/**
 * src/lib/agenda/empalmesServidor.ts
 *
 * B7 · Alerta de empalme, la parte del SERVIDOR, que es la autoridad: lo
 * pintado en el navegador no ve otras semanas, médicos fuera del filtro, el
 * techo de 1000 filas ni lo que otra persona acaba de crear. Lo llaman el POST
 * y el PUT de `/api/appointments` con el interruptor encendido.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: los nombres que se
 * devuelven en el 409 son sólo los que la RLS de `appointments` ya deja ver a
 * quien pregunta (plan del bloque B §5.6). El `eq('clinica_id')` es explícito
 * aunque la RLS ya filtre (pendiente prioritario de `CLAUDE.md`).
 *
 * ⚠️ LAS REGLAS SON LAS DE `empalmesCita.ts` (P3): mismo médico, sin
 * `cancelled` ni `no_show`, sin todo el día, sin lo que vino de Google, solape
 * semiabierto.
 * Usa el índice `idx_appointments_clinica_medico_inicio`.
 *
 * Falla ABIERTO, al revés que el interruptor, y es a propósito: el aviso no
 * bloquea nada, así que si la consulta falla se guarda como hoy (sin aviso) en
 * vez de impedir guardar una cita.
 */
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { ESTADOS_SIN_EMPALME, type Empalme } from '@/lib/agenda/empalmesCita'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

/** Cuántas se piden: el aviso nombra 3 y cuenta el resto; 6 basta para «y N más». */
const TOPE_EMPALMES = 6

/** Cuántos ids aceptados admite el cuerpo; más es un cuerpo fabricado. */
export const TOPE_ACEPTADOS = 20

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `empalmes_aceptados` del cuerpo, validado: una lista de uuid de como mucho
 * `TOPE_ACEPTADOS`. Ausente = lista vacía. `null` = forma inválida (400).
 */
export function leerAceptados(valor: unknown): string[] | null {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor) || valor.length > TOPE_ACEPTADOS) return null
  const ids: string[] = []
  for (const v of valor) {
    if (typeof v !== 'string' || !UUID.test(v)) return null
    ids.push(v)
  }
  return ids
}

interface Busqueda {
  clinicaId: string
  medicoId: string
  inicio: string
  fin: string
  /** La propia cita (en una edición) y los empalmes que el usuario ya aceptó:
   *  quedan FUERA de la consulta, así el tope no esconde uno nuevo detrás de
   *  seis aceptados. Todos uuid validados (`leerAceptados`, `UUID_REGEX`). */
  excluirIds: readonly string[]
  /** El `client_id` del alta: un reintento no debe empalmarse consigo mismo. */
  excluirClientId?: string
}

interface FilaEmpalme { id: string; title: string | null; start_time: string; end_time: string }

/**
 * Las citas del mismo médico que se empalman con `[inicio, fin)` y que el
 * usuario aún no aceptó. Lista vacía = se guarda; si no, 409 `empalme`.
 */
export async function buscarEmpalmes(supabase: ClienteSesion, b: Busqueda): Promise<Empalme[]> {
  try {
    let q = supabase
      .from('appointments')
      .select('id, title, start_time, end_time')
      .eq('clinica_id', b.clinicaId)
      .eq('medico_id', b.medicoId)
      .lt('start_time', b.fin)
      .gt('end_time', b.inicio)
      .not('status', 'in', `(${ESTADOS_SIN_EMPALME.join(',')})`)
      .eq('all_day', false)
      .neq('origen', 'google')
      .order('start_time')
      .limit(TOPE_EMPALMES)
    const excluir = b.excluirIds.filter(id => UUID.test(id))
    if (excluir.length) q = q.not('id', 'in', `(${excluir.join(',')})`)
    if (b.excluirClientId && UUID.test(b.excluirClientId)) {
      q = q.or(`client_id.is.null,client_id.neq.${b.excluirClientId}`)
    }
    const { data, error } = await q
    if (error) {
      logger.warn('agenda', `empalmes sin comprobar (se guarda sin aviso): ${error.message}`)
      return []
    }
    const filas: FilaEmpalme[] = data ?? []
    return filas.map(f => ({ id: f.id, titulo: f.title ?? '', inicio: f.start_time, fin: f.end_time }))
  } catch (err: unknown) {
    logger.warn('agenda', `empalmes sin comprobar (se guarda sin aviso): ${err instanceof Error ? err.message : 'error'}`)
    return []
  }
}

/** Lo que decide la ruta: seguir, o contestar con este estado y este cuerpo. */
export type VeredictoEmpalme =
  | { ok: true }
  | { ok: false; status: 400 | 409; cuerpo: { error: string; message: string; empalmes?: Empalme[] } }

/**
 * La comprobación entera para el POST y el PUT, ya con el interruptor
 * ENCENDIDO (quien llama lo decide): valida `empalmes_aceptados` y busca los
 * que faltan por aceptar. 409 `empalme` sin escribir nada si queda alguno; el
 * usuario siempre puede aceptarlos y reenviar, así que no bloquea (§2).
 */
export async function comprobarEmpalmes(
  supabase: ClienteSesion,
  b: Omit<Busqueda, 'excluirIds'> & { excluirId?: string },
  aceptadosCrudos: unknown,
): Promise<VeredictoEmpalme> {
  const aceptados = leerAceptados(aceptadosCrudos)
  if (aceptados === null) {
    return { ok: false, status: 400, cuerpo: { error: 'empalmes_invalidos', message: `empalmes_aceptados debe ser una lista de hasta ${TOPE_ACEPTADOS} uuid.` } }
  }
  const excluirIds = b.excluirId ? [...aceptados, b.excluirId] : aceptados
  const empalmes = await buscarEmpalmes(supabase, { ...b, excluirIds })
  if (!empalmes.length) return { ok: true }
  return {
    ok: false,
    status: 409,
    cuerpo: { error: 'empalme', message: 'La cita se empalma con otra del mismo médico.', empalmes },
  }
}
