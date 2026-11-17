/**
 * noEsCitaRuta.test.ts — I3 (punto 10): `POST /api/appointments/[id]/no-es-cita`.
 *
 * `entradaGestion()` y el cliente de SESIÓN son dobles (como en
 * `correoConfirmacionRuta.test.ts`). Se prueba: las puertas (401/404 de la
 * entrada, id sin forma, la cita que la RLS no deja ver, 503 sin la columna),
 * el ROL en el servidor (un médico no gestiona la cita de otro: 403 y no
 * escribe), que sólo una fila «por asignar» sin paciente ni reserva pasa (con
 * paciente, por ligar o evento de Spinus: 409; ya «evento»: 200 sin escribir),
 * que la escritura es SÓLO `google_asignacion = 'evento'` condicionada a que
 * siga por asignar y sin paciente (sin `updated_at`), y la auditoría.
 *
 * MUTACIONES (comprobadas en rojo): quitar `puedeGestionarDelMedico` de la ruta
 * → «un médico no marca la cita de otro»; quitar el `.eq('google_asignacion',
 * 'por_asignar')` de la escritura → «escribe sólo…»; quitar el `logAudit` →
 * «audita».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const h = vi.hoisted(() => ({
  entrada: 'ok' as 'ok' | 401 | 404,
  perfil: { id: 'medico-1', role: 'medico', es_admin_de_clinica: false } as Record<string, unknown>,
  fila: null as Record<string, unknown> | null,
  errorLectura: null as { code: string } | null,
  escrituras: [] as Array<{ valores: Record<string, unknown>; filtros: Array<[string, string, unknown]> }>,
  filasEscritas: 1,
  auditorias: [] as Array<Record<string, unknown>>,
}))

function cadena(): Record<string, unknown> {
  const filtros: Array<[string, string, unknown]> = []
  let valores: Record<string, unknown> | null = null
  const c: Record<string, unknown> = {}
  c.select = () => {
    if (valores) {
      h.escrituras.push({ valores, filtros })
      return Promise.resolve({ data: Array.from({ length: h.filasEscritas }, () => ({ id: 'x' })), error: null })
    }
    return c
  }
  c.update = (v: Record<string, unknown>) => { valores = v; return c }
  c.eq = (k: string, v: unknown) => { filtros.push(['eq', k, v]); return c }
  c.is = (k: string, v: unknown) => { filtros.push(['is', k, v]); return c }
  c.maybeSingle = async () => ({ data: h.errorLectura ? null : h.fila, error: h.errorLectura })
  return c
}

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => (h.entrada === 'ok'
    ? { ok: true, clinicaId: 'clinica-1', perfil: h.perfil, supabase: { from: () => cadena() } }
    : { ok: false, respuesta: NextResponse.json({ error: 'x' }, { status: h.entrada }) }),
}))
vi.mock('@/lib/audit', () => ({ logAudit: async (a: Record<string, unknown>) => { h.auditorias.push(a) } }))

const { POST } = await import('@/app/api/appointments/[id]/no-es-cita/route')

const CITA = '00000000-0000-4000-8000-0000000013d1'
const llamar = (id = CITA) => POST(new Request(`http://localhost/api/appointments/${id}/no-es-cita`, { method: 'POST' }),
  { params: Promise.resolve({ id }) })

function fila(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { medico_id: 'medico-1', paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar', ...extra }
}

beforeEach(() => {
  h.entrada = 'ok'
  h.perfil = { id: 'medico-1', role: 'medico', es_admin_de_clinica: false }
  h.fila = fila()
  h.errorLectura = null
  h.escrituras = []
  h.filasEscritas = 1
  h.auditorias = []
})

describe('POST /api/appointments/[id]/no-es-cita', () => {
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

  it('un médico no marca la cita de otro médico (403 y no escribe); administrador y secretaria, sí', async () => {
    h.fila = fila({ medico_id: 'otro-medico' })
    expect((await llamar()).status).toBe(403)
    expect(h.escrituras).toHaveLength(0)
    h.perfil = { id: 'secre-1', role: 'secretaria', es_admin_de_clinica: false }
    expect((await llamar()).status).toBe(200)
    h.perfil = { id: 'admin-1', role: 'medico', es_admin_de_clinica: true }
    expect((await llamar()).status).toBe(200)
  })

  it('sólo una «por asignar» sin paciente ni reserva: con paciente, por ligar o de Spinus, 409 sin escribir', async () => {
    for (const extra of [{ paciente_id: 'p1' }, { reserva_canal: 'fijo' }, { google_asignacion: null }]) {
      h.fila = fila(extra)
      const r = await llamar()
      expect(r.status).toBe(409)
      expect(await r.json()).toEqual({ error: 'no_aplica' })
    }
    expect(h.escrituras).toHaveLength(0)
  })

  it('ya era evento: 200 sin escribir ni auditar (dos clics desde dos sitios)', async () => {
    h.fila = fila({ google_asignacion: 'evento' })
    expect((await llamar()).status).toBe(200)
    expect(h.escrituras).toHaveLength(0)
    expect(h.auditorias).toHaveLength(0)
  })

  it('escribe sólo google_asignacion = evento, condicionado a que siga por asignar y sin paciente', async () => {
    const r = await llamar()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ evento: true })
    expect(h.escrituras).toHaveLength(1)
    expect(h.escrituras[0]?.valores).toEqual({ google_asignacion: 'evento' })
    expect(h.escrituras[0]?.filtros).toEqual(expect.arrayContaining([
      ['eq', 'id', CITA], ['eq', 'clinica_id', 'clinica-1'], ['eq', 'google_asignacion', 'por_asignar'], ['is', 'paciente_id', null],
    ]))
  })

  it('si entre medias dejó de estar por asignar (0 filas), 409 y sin auditoría', async () => {
    h.filasEscritas = 0
    expect((await llamar()).status).toBe(409)
    expect(h.auditorias).toHaveLength(0)
  })

  it('audita cita_no_es_cita con la clínica y el NOMBRE del campo, a nombre de quien pulsó', async () => {
    await llamar()
    expect(h.auditorias).toEqual([expect.objectContaining({
      userId: 'medico-1', accion: 'cita_no_es_cita', tabla: 'appointments', registroId: CITA,
      descripcion: JSON.stringify({ clinica: 'clinica-1', campos: ['google_asignacion'] }),
    })])
  })
})
