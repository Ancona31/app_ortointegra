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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leerAvisosClinica, TOPE_AVISOS } from '@/lib/avisos/avisosServidor'
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
/** Las RPC que pidió la lectura, en orden. */
const llamadas: string[] = []

function cliente(avisos: unknown[], citas: unknown[], pendientes?: unknown[], masAntiguos?: boolean): ClienteSesion {
  const resultado = (data: unknown[]) => Promise.resolve({ data, error: null })
  const deAvisos = { select: () => deAvisos, eq: () => deAvisos, is: () => deAvisos, in: () => deAvisos, order: () => deAvisos, limit: () => resultado(avisos) }
  const deCitas = { select: () => deCitas, eq: () => deCitas, in: () => resultado(citas) }
  /* `pendientes` = lo que devuelve `avisos_pendientes` (la base CON M1); sin él, la función no existe
     (PGRST202) y la lectura cae a la de antes, por clínica. */
  const rpc = (nombre: string): Promise<{ data: unknown; error: { code: string } | null }> => {
    llamadas.push(nombre)
    /* `avisos_mas_antiguos` (M1): sin decir nada, la función no existe (PGRST202), como en la base de antes. */
    if (nombre === 'avisos_mas_antiguos') {
      return Promise.resolve(masAntiguos === undefined ? { data: null, error: { code: 'PGRST202' } } : { data: masAntiguos, error: null })
    }
    return Promise.resolve(pendientes ? { data: pendientes, error: null } : { data: null, error: { code: 'PGRST202' } })
  }
  const c = { rpc, from: (tabla: string) => (tabla === 'avisos_clinica' ? deAvisos : deCitas) }
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

/* Avisos globales, paso 3 · con M1 la lectura es `avisos_pendientes` (por usuario) y trae avisos sin
   cita. MUTACIÓN (comprobada en rojo): `armarAviso` exigiendo cita a todos (los sin cita no salían). */
describe('leerAvisosClinica con M1 (pendientes por usuario)', () => {
  it('usa avisos_pendientes; arma los de cita y los sin cita; el dirigido se marca', async () => {
    const r = await leerAvisosClinica(cliente([], [cita('c1')], [
      { id: 'a1', tipo: 'personal_agendo', cita_id: 'c1', creado_en: '2026-11-18T10:00:00Z', destinatario_id: 'u1', actor_id: null, medico_id: null, datos: null },
      { id: 'a2', tipo: 'reserva_frenada', cita_id: null, creado_en: '2026-11-18T09:00:00Z', destinatario_id: null, actor_id: null, medico_id: 'm1',
        datos: { nombre: 'Fulano', intentos: 2, telefono: 'no debe pasar' } },
      { id: 'a3', tipo: 'correo_fallido', cita_id: 'ya-no-existe', creado_en: '2026-11-18T08:00:00Z' },
    ]), CLINICA)
    expect(r.disponible).toBe(true)
    expect(r.avisos.map(a => `${a.id}:${a.tipo}:${a.dirigido}`)).toEqual(['a1:personal_agendo:true', 'a2:reserva_frenada:false'])
    const frenada = r.avisos[1]
    // De `datos` sólo pasa lo que el código pinta.
    expect(frenada.cita === null ? frenada.datos : null).toEqual({ nombre: 'Fulano', intentos: 2 })
  })
})

/* MUTACIONES (comprobadas en rojo): `mas_antiguos` sin mirar la respuesta de la base; sin mirar el tope;
   preguntando a la base aunque ya sobren filas. */
describe('leerAvisosClinica dice si hay avisos sin ver fuera de lo que trae', () => {
  beforeEach(() => { llamadas.length = 0 })
  const fila = (i: number) => ({ id: `a${i}`, tipo: 'reserva_frenada', cita_id: null, creado_en: '2026-11-18T10:00:00Z', medico_id: 'm1', datos: { nombre: `N${i}` } })
  it('la base dice que hay más atrás (ventana de 60 días o tope de 500)', async () => {
    expect((await leerAvisosClinica(cliente([], [], [fila(1)], true), CLINICA)).mas_antiguos).toBe(true)
    expect((await leerAvisosClinica(cliente([], [], [], true), CLINICA)).mas_antiguos).toBe(true)
    expect((await leerAvisosClinica(cliente([], [], [fila(1)], false), CLINICA)).mas_antiguos).toBe(false)
  })
  it('la base trae UNO MÁS del tope: hay más, se enseñan sólo los del tope y no se pregunta más', async () => {
    const sobran = Array.from({ length: TOPE_AVISOS + 1 }, (_, i) => fila(i))
    const r = await leerAvisosClinica(cliente([], [], sobran, false), CLINICA)
    expect([r.mas_antiguos, r.avisos.length]).toEqual([true, TOPE_AVISOS])
    expect(llamadas).not.toContain('avisos_mas_antiguos')
  })
  it('justo el tope: no sobra nada, y la base dice que no hay más atrás', async () => {
    const justas = Array.from({ length: TOPE_AVISOS }, (_, i) => fila(i))
    const r = await leerAvisosClinica(cliente([], [], justas, false), CLINICA)
    expect([r.mas_antiguos, r.avisos.length]).toEqual([false, TOPE_AVISOS])
    expect(llamadas).toContain('avisos_mas_antiguos')
  })
  it('sin la función (base sin M1), nada que decir y la lista sale igual', async () => {
    const r = await leerAvisosClinica(cliente([], [], [fila(1)]), CLINICA)
    expect([r.disponible, r.avisos.length, r.mas_antiguos]).toEqual([true, 1, false])
  })
})
