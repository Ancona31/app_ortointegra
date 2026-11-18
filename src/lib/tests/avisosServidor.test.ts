/**
 * avisosServidor.test.ts — `leerAvisosClinica` con un tipo de aviso que el
 * código no conoce (aviso de J3 a J4, tanda J). La migración que añade un tipo
 * puede llegar a la base antes que el código que lo pinta: el aviso de ese tipo
 * se salta, con un aviso en el log, y los demás se siguen viendo. Antes el
 * `z.enum` del esquema de la fila tiraba el `parse` entero y la campana se
 * quedaba vacía (`disponible: false`).
 *
 * MUTACIÓN (comprobada en rojo): volver a `z.array(FilaAviso).parse(data)` con
 * `tipo: z.enum(TIPOS_AVISO)`; la lectura devuelve `{ disponible: false, avisos: [] }`.
 */
import { describe, expect, it, vi } from 'vitest'
import { leerAvisosClinica } from '@/lib/avisos/avisosServidor'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import { logger } from '@/lib/logger'

const CLINICA = '00000000-0000-4000-8000-0000000000c1'
const cita = (id: string) => ({
  id, title: 'Paciente Semilla', start_time: '2026-11-20T16:00:00Z', end_time: '2026-11-20T16:30:00Z', status: 'scheduled',
  medico_id: null, paciente_id: null, reserva_nombre: null, consultorio_timezone: 'America/Merida', reserva_canal: 'unico', google_asignacion: null,
})

/** Lo mínimo del cliente de sesión que recorre `leerAvisosClinica`: dos cadenas, una por tabla.
 *  No filtra: el `.in('tipo', …)` de la consulta no llega aquí, así que se prueba la red de
 *  `conTipoConocido` (lo que pasa si el filtro faltara). */
function cliente(avisos: unknown[], citas: unknown[]): ClienteSesion {
  const resultado = (data: unknown[]) => Promise.resolve({ data, error: null })
  const deAvisos = { select: () => deAvisos, eq: () => deAvisos, is: () => deAvisos, in: () => deAvisos, order: () => deAvisos, limit: () => resultado(avisos) }
  const deCitas = { select: () => deCitas, eq: () => deCitas, in: () => resultado(citas) }
  const c = { from: (tabla: string) => (tabla === 'avisos_clinica' ? deAvisos : deCitas) }
  // Doble de prueba: el tipo entero del cliente de Supabase no se puede construir aquí.
  return c as unknown as ClienteSesion
}

describe('leerAvisosClinica con un tipo de aviso desconocido', () => {
  it('lo salta (con aviso en el log) y devuelve los demás', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const r = await leerAvisosClinica(cliente([
      { id: 'a1', tipo: 'tipo_de_otra_rama', cita_id: 'c1', creado_en: '2026-11-18T10:00:00Z' },
      { id: 'a2', tipo: 'reserva_enlace', cita_id: 'c2', creado_en: '2026-11-18T09:00:00Z' },
    ], [cita('c1'), cita('c2')]), CLINICA)
    expect(r.disponible).toBe(true)
    expect(r.avisos.map(a => a.id)).toEqual(['a2'])
    expect(warn).toHaveBeenCalledWith('avisos', expect.stringContaining('tipo_de_otra_rama'))
    warn.mockRestore()
  })
  it('el tipo de J4 es conocido', async () => {
    const r = await leerAvisosClinica(cliente([
      { id: 'a3', tipo: 'google_movimiento_rechazado', cita_id: 'c3', creado_en: '2026-11-18T10:00:00Z' },
    ], [cita('c3')]), CLINICA)
    expect(r.avisos.map(a => a.tipo)).toEqual(['google_movimiento_rechazado'])
  })
})
