/**
 * src/lib/agenda/noEsCita.ts
 *
 * I3 (punto 10 de Angel) · «¿No es una cita?» desde el navegador: el `POST
 * /api/appointments/[id]/no-es-cita`, que deja un evento de Google «por
 * asignar» como evento sin paciente para siempre. La regla y las puertas viven
 * en la ruta; esto sólo la llama y traduce la respuesta a una frase.
 *
 * Lo usan la tarjeta de la cita (`InteraccionesV2`), la fila de «Próximas
 * citas» y el formulario completo, por `BotonNoEsCita` o directamente; y el
 * aviso de la campana (agente I5), con el mismo botón.
 *
 * ⚠️ MÓDULO DE CLIENTE (usa `fetch` relativo). Vacía la caché de rangos de
 * citas, como `ligarCita.ts`: si se pulsa fuera de la agenda, al volver a ella
 * no debe pintarse la fila aún «por asignar» desde la caché.
 */
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'

export type ResultadoNoEsCita = { ok: true } | { ok: false; motivo: string }

const MOTIVO_POR_DEFECTO = 'No se pudo marcar como evento. Vuelve a intentarlo.'

const MOTIVOS: Record<number, string> = {
  403: 'No puedes cambiar este evento.',
  404: 'Ese evento ya no está en la agenda.',
  409: 'Este evento ya no está por asignar.',
}

export async function marcarNoEsCita(citaId: string): Promise<ResultadoNoEsCita> {
  try {
    const res = await fetch(`/api/appointments/${encodeURIComponent(citaId)}/no-es-cita`, { method: 'POST' })
    if (res.ok) { vaciarCacheCitas(); return { ok: true } }
    return { ok: false, motivo: MOTIVOS[res.status] ?? MOTIVO_POR_DEFECTO }
  } catch {
    return { ok: false, motivo: MOTIVO_POR_DEFECTO }
  }
}
