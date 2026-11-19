/**
 * quitarCanceladaRuta.test.ts — tanda L, punto 9: `POST /api/appointments/[id]/quitar`
 * («Eliminar cita» de una CANCELADA: la cierra sin sustituta; no la borra).
 *
 * `entradaGestion()`, el cliente de SESIÓN y el de SERVICIO son dobles (como en
 * `noEsCitaRuta.test.ts`). Se prueba: las puertas (401/404 de la entrada, id sin
 * forma, la cita que la RLS no deja ver, 503 sin la columna), el ROL en el servidor
 * (un médico no quita la cita de otro: 403 y no escribe), que sólo una cancelada
 * pasa (agendada: 409; ya cerrada: 200 sin escribir), que la escritura es SÓLO
 * `cerrada_en`, con el cliente de servicio FILTRADO por clínica, id y «cancelada y
 * abierta», que nunca se borra, que sin la migración (42501) es 409, y la auditoría.
 *
 * MUTACIONES (comprobadas en rojo): quitar `puedeGestionarDelMedico` → «un médico
 * no quita…»; quitar `.eq('clinica_id', clinicaId)` de `cerrar` → «escribe sólo
 * cerrada_en…»; quitar el `logAudit` → «audita».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const h = vi.hoisted(() => ({
  entrada: 'ok' as 'ok' | 401 | 404,
  perfil: { id: 'medico-1', role: 'medico', es_admin_de_clinica: false } as Record<string, unknown>,
  fila: null as Record<string, unknown> | null,
  errorLectura: null as { code: string } | null,
  errorEscritura: null as { code: string } | null,
  escrituras: [] as Array<{ cliente: string; valores: Record<string, unknown>; filtros: Array<[string, string, unknown]> }>,
  borrados: 0,
  filasEscritas: 1,
  auditorias: [] as Array<Record<string, unknown>>,
}))

function cadena(cliente: string): Record<string, unknown> {
  const filtros: Array<[string, string, unknown]> = []
  let valores: Record<string, unknown> | null = null
  const c: Record<string, unknown> = {}
  c.select = () => {
    if (valores) {
      h.escrituras.push({ cliente, valores, filtros })
      return Promise.resolve(h.errorEscritura
        ? { data: null, error: h.errorEscritura }
        : { data: Array.from({ length: h.filasEscritas }, () => ({ id: 'x' })), error: null })
    }
    return c
  }
  c.update = (v: Record<string, unknown>) => { valores = v; return c }
  c.delete = () => { h.borrados++; return c }
  c.eq = (k: string, v: unknown) => { filtros.push(['eq', k, v]); return c }
  c.is = (k: string, v: unknown) => { filtros.push(['is', k, v]); return c }
  c.maybeSingle = async () => ({ data: h.errorLectura ? null : h.fila, error: h.errorLectura })
  return c
}

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => (h.entrada === 'ok'
    ? { ok: true, clinicaId: 'clinica-1', perfil: h.perfil, supabase: { from: () => cadena('sesion') } }
    : { ok: false, respuesta: NextResponse.json({ error: 'x' }, { status: h.entrada }) }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => cadena('servicio') }) }))
vi.mock('@/lib/audit', () => ({ logAudit: async (a: Record<string, unknown>) => { h.auditorias.push(a) } }))

const { POST } = await import('@/app/api/appointments/[id]/quitar/route')

const CITA = '00000000-0000-4000-8000-0000000b2d01'
const llamar = (id = CITA) => POST(new Request(`http://localhost/api/appointments/${id}/quitar`, { method: 'POST' }),
  { params: Promise.resolve({ id }) })

function fila(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { medico_id: 'medico-1', status: 'cancelled', cerrada_en: null, ...extra }
}

beforeEach(() => {
  h.entrada = 'ok'
  h.perfil = { id: 'medico-1', role: 'medico', es_admin_de_clinica: false }
  h.fila = fila()
  h.errorLectura = null
  h.errorEscritura = null
  h.escrituras = []
  h.borrados = 0
  h.filasEscritas = 1
  h.auditorias = []
})

describe('POST /api/appointments/[id]/quitar', () => {
  it('las puertas de la entrada (sesión, interruptor) mandan', async () => {
    h.entrada = 401
    expect((await llamar()).status).toBe(401)
    h.entrada = 404
    expect((await llamar()).status).toBe(404)
    expect(h.escrituras).toHaveLength(0)
  })

  it('id sin forma: 400; la cita que la RLS no enseña: 404; sin la columna: 503', async () => {
    expect((await llamar('no-es-uuid')).status).toBe(400)
    h.fila = null
    expect((await llamar()).status).toBe(404)
    h.errorLectura = { code: '42703' }
    expect((await llamar()).status).toBe(503)
    expect(h.escrituras).toHaveLength(0)
  })

  it('un médico no quita la cita de otro médico (403 y no escribe); administrador y secretaria, sí', async () => {
    h.fila = fila({ medico_id: 'otro-medico' })
    expect((await llamar()).status).toBe(403)
    expect(h.escrituras).toHaveLength(0)
    h.perfil = { id: 'secre-1', role: 'secretaria', es_admin_de_clinica: false }
    expect((await llamar()).status).toBe(200)
    h.perfil = { id: 'admin-1', role: 'medico', es_admin_de_clinica: true }
    expect((await llamar()).status).toBe(200)
  })

  it('sólo una cancelada: agendada, confirmada, atendida o no asistió, 409 sin escribir', async () => {
    for (const status of ['scheduled', 'confirmed', 'attended', 'no_show']) {
      h.fila = fila({ status })
      const r = await llamar()
      expect(r.status).toBe(409)
      expect(await r.json()).toEqual({ error: 'no_aplica' })
    }
    expect(h.escrituras).toHaveLength(0)
  })

  it('ya cerrada: 200 sin escribir ni auditar (dos clics desde dos sitios)', async () => {
    h.fila = fila({ cerrada_en: '2026-11-18T10:00:00.000Z' })
    expect((await llamar()).status).toBe(200)
    expect(h.escrituras).toHaveLength(0)
    expect(h.auditorias).toHaveLength(0)
  })

  it('escribe sólo cerrada_en, con el cliente de servicio filtrado por clínica, id y «cancelada y abierta»; nunca borra', async () => {
    const r = await llamar()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ quitada: true })
    expect(h.escrituras).toHaveLength(1)
    expect(h.escrituras[0]?.cliente).toBe('servicio')
    expect(Object.keys(h.escrituras[0]?.valores ?? {})).toEqual(['cerrada_en'])
    expect(h.escrituras[0]?.filtros).toEqual(expect.arrayContaining([
      ['eq', 'id', CITA], ['eq', 'clinica_id', 'clinica-1'], ['eq', 'status', 'cancelled'], ['is', 'cerrada_en', null],
    ]))
    expect(h.borrados).toBe(0)
  })

  it('sin la migración (42501 del disparador): 409 y sin auditoría', async () => {
    h.errorEscritura = { code: '42501' }
    expect((await llamar()).status).toBe(409)
    expect(h.auditorias).toHaveLength(0)
  })

  it('si entre medias dejó de estar cancelada (0 filas y sigue abierta), 409 y sin auditoría', async () => {
    h.filasEscritas = 0
    expect((await llamar()).status).toBe(409)
    expect(h.auditorias).toHaveLength(0)
  })

  it('audita cita_quitada_de_agenda con la clínica y el NOMBRE del campo, a nombre de quien pulsó', async () => {
    await llamar()
    expect(h.auditorias).toEqual([expect.objectContaining({
      userId: 'medico-1', accion: 'cita_quitada_de_agenda', tabla: 'appointments', registroId: CITA,
      descripcion: JSON.stringify({ clinica: 'clinica-1', campos: ['cerrada_en'] }),
    })])
  })
})
