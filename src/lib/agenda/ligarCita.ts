/**
 * src/lib/agenda/ligarCita.ts
 *
 * D7 · Ligar una cita POR LIGAR a un paciente desde el modal de la cita, antes
 * de iniciar la consulta (§2: «Al iniciar la consulta el médico la liga a un
 * paciente existente o crea uno»). Es el `PUT /api/appointments/[id]` de
 * siempre con `{paciente_id, title, updated_at}`: el servidor comprueba que el
 * paciente sea de la clínica y lo vea quien liga, audita `cita_ligada` (sólo
 * nombres de campo) y, con Google conectado, el `after()` pasa el evento a
 * «Cita médica: <paciente>» con la descripción fija (S1: deja de enviarse como
 * evento sin paciente). Los datos de contacto de la reserva se quedan en la
 * cita (lista A, punto 9): este cuerpo no los toca.
 *
 * Sin `paciente_id` en la cita, `/api/consultas` no la marcaría `attended` al
 * guardar la nota (compara `paciente_id`); por eso se liga ANTES de navegar.
 *
 * ⚠️ MÓDULO DE CLIENTE (usa `fetch` relativo). Vacía la caché de rangos de
 * citas: la agenda se desmonta al navegar a la nota, su canal de tiempo real
 * con ella, y al volver pintaría la cita aún «por ligar» desde la caché.
 */
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'

export interface PacienteParaLigar { id: string; nombre: string; apellidos: string }

export type ResultadoLigar = { ok: true } | { ok: false; motivo: string }

const MOTIVO_POR_DEFECTO = 'No se pudo ligar la cita al paciente. Vuelve a intentarlo.'

export async function ligarCitaAPaciente(a: {
  citaId: string
  updatedAt: string | undefined
  paciente: PacienteParaLigar
}): Promise<ResultadoLigar> {
  try {
    const res = await fetch(`/api/appointments/${a.citaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paciente_id: a.paciente.id,
        title: `${a.paciente.nombre} ${a.paciente.apellidos}`,
        ...(a.updatedAt ? { updated_at: a.updatedAt } : {}),
      }),
    })
    if (res.ok) { vaciarCacheCitas(); return { ok: true } }
    const cuerpo: unknown = await res.json().catch(() => null)
    const motivo = cuerpo && typeof cuerpo === 'object'
      ? ('message' in cuerpo && typeof cuerpo.message === 'string' ? cuerpo.message
        : 'error' in cuerpo && typeof cuerpo.error === 'string' && res.status < 500 ? cuerpo.error : null)
      : null
    return { ok: false, motivo: motivo ?? MOTIVO_POR_DEFECTO }
  } catch {
    return { ok: false, motivo: MOTIVO_POR_DEFECTO }
  }
}
