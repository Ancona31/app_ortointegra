/**
 * correoConfirmacionRuta.test.ts — G3 (punto 14): `POST /api/agenda/correo`,
 * `enviarConfirmacionCita` y la regla `motivoSinCorreo`.
 *
 * `entradaGestion()` y el cliente de SESIÓN son dobles (como en
 * `whatsappRuta.test.ts`); el cliente de servicio, el enlace de E2 y el
 * transporte también. Se prueba: las puertas (401/403/404, cuerpo estricto,
 * la cita que la RLS no deja ver), que una cita cancelada, atendida, con
 * inasistencia, pasada, de todo el día o sin correo NO toma ningún envío,
 * que la toma va con la clínica de la SESIÓN y el tipo `confirmacion`, que
 * el correo va al destinatario DE LA BASE con su llave de idempotencia y sin
 * nada clínico, el cierre, la auditoría y las respuestas de «ya enviado».
 *
 * MUTACIONES (comprobadas en rojo): quitar la regla `motivoSinCorreo` de la
 * ruta → «cancelada… no toma»; mandar a `cuerpo.para` en vez de `r_para` (no
 * existe: la ruta no acepta destinatario) → cuerpo estricto; cambiar el tipo a
 * 'recordatorio' → «toma con la clínica de la sesión».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const h = vi.hoisted(() => ({
  entrada: 'ok' as 'ok' | 401 | 403 | 404,
  fila: null as Record<string, unknown> | null,
  envioPrevio: null as Record<string, unknown> | null,
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  toma: [] as Array<Record<string, unknown>>,
  errorToma: null as { code: string } | null,
  enlace: { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' } as { id: string; codigo: string; url: string } | null,
  correos: [] as Array<Record<string, unknown>>,
  envioOk: true,
  auditorias: [] as Array<Record<string, unknown>>,
}))

function cadena(tabla: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'in']) c[op] = () => c
  c.maybeSingle = async () => ({ data: tabla === 'cita_correos' ? h.envioPrevio : h.fila, error: null })
  return c
}

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => (h.entrada === 'ok'
    ? { ok: true, clinicaId: 'clinica-1', perfil: { id: 'perfil-1', role: 'secretaria', es_admin_de_clinica: false },
        supabase: { from: (t: string) => cadena(t) } }
    : { ok: false, respuesta: NextResponse.json({ error: 'x' }, { status: h.entrada }) }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpc.push({ fn, args })
      if (fn === 'cita_correo_tomar') return { data: h.errorToma ? null : h.toma, error: h.errorToma }
      if (fn === 'cita_correo_marcar') return { data: true, error: null }
      return { data: null, error: null }
    },
  }),
}))
vi.mock('@/lib/confirmacion/enlaceConfirmacion', () => ({ emitirEnlaceConfirmacion: async () => h.enlace }))
vi.mock('@/lib/correo/transporte', () => ({
  enviarCorreo: async (c: Record<string, unknown>) => { h.correos.push(c); return h.envioOk ? { ok: true, modo: 'captura' } : { ok: false, modo: 'resend', motivo: 'fallo' } },
}))
vi.mock('@/lib/audit', () => ({ logAudit: async (a: Record<string, unknown>) => { h.auditorias.push(a) } }))

const { POST } = await import('@/app/api/agenda/correo/route')
const { motivoSinCorreo, correoParaConfirmacion } = await import('@/lib/agenda/whatsappCita')

const CITA = '00000000-0000-4000-8000-0000000063a1'
const ENVIO = '00000000-0000-4000-8000-0000000063e1'
const FUTURO = new Date(Date.now() + 5 * 24 * 3_600_000).toISOString()

function cita(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: CITA, status: 'scheduled', start_time: FUTURO, all_day: false, paciente_id: 'p1', reserva_canal: null,
    reserva_correo: null, pacientes: { email: 'juana@prueba.local' }, ...extra }
}
const TOMA = {
  r_envio_id: ENVIO, r_para: 'juana@prueba.local', r_inicio: FUTURO, r_fin: FUTURO, r_zona: 'America/Merida', r_estado: 'scheduled',
  r_medico: { titulo: 'Dra.', nombres: 'Ana', apellido_paterno: 'Pérez', apellido_materno: null },
  r_consultorio: { nombre: 'Consultorio Centro', direccion: 'Calle Ficticia 1, Centro, Mérida', telefono: '9990000000' },
}

function post(cuerpo: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agenda/correo', { method: 'POST', body: JSON.stringify(cuerpo) })
}
const tomas = (): Array<Record<string, unknown>> => h.rpc.filter(r => r.fn === 'cita_correo_tomar').map(r => r.args)

beforeEach(() => {
  h.entrada = 'ok'
  h.fila = cita()
  h.envioPrevio = null
  h.rpc = []
  h.toma = [TOMA]
  h.errorToma = null
  h.enlace = { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' }
  h.correos = []
  h.envioOk = true
  h.auditorias = []
})

describe('motivoSinCorreo (la regla del botón y de la ruta)', () => {
  const base = { paciente_id: 'p1', reserva_canal: null, status: 'scheduled', all_day: false, start_time: FUTURO }
  it('con paciente con correo, agendada o confirmada y futura: se puede', () => {
    expect(motivoSinCorreo(base, 'a@b.c', Date.now())).toBeNull()
    expect(motivoSinCorreo({ ...base, status: 'confirmed' }, 'a@b.c', Date.now())).toBeNull()
  })
  it.each([
    [{ status: 'cancelled' }, 'cancelada'], [{ status: 'attended' }, 'atendida'], [{ status: 'no_show' }, 'no_asistio'],
    [{ all_day: true }, 'todo_el_dia'], [{ start_time: new Date(Date.now() - 1000).toISOString() }, 'pasada'],
    [{ paciente_id: null }, 'sin_paciente'],
  ] as const)('%o → %s', (extra, motivo) => {
    expect(motivoSinCorreo({ ...base, ...extra }, 'a@b.c', Date.now())).toBe(motivo)
  })
  it('sin correo (ni del paciente ni de la reserva; espacios cuentan como ninguno) → sin_correo', () => {
    expect(correoParaConfirmacion('  ', null)).toBeNull()
    expect(correoParaConfirmacion(null, ' r@b.c ')).toBe('r@b.c')
    expect(motivoSinCorreo(base, null, Date.now())).toBe('sin_correo')
  })
})

describe('POST /api/agenda/correo — puertas', () => {
  it.each([401, 403, 404] as const)('la entrada común responde %i (404 = interruptor apagado) y no toma nada', async (s) => {
    h.entrada = s
    expect((await POST(post({ cita_id: CITA }))).status).toBe(s)
    expect(tomas()).toEqual([])
  })

  it('cuerpo estricto: sin destinatario ni nada de más → 400', async () => {
    for (const malo of [{ cita_id: CITA, para: 'otro@x.y' }, { cita_id: 'no-uuid' }, {}]) {
      expect((await POST(post(malo))).status).toBe(400)
    }
    expect(tomas()).toEqual([])
  })

  it('la cita que la RLS no deja ver → 404', async () => {
    h.fila = null
    expect((await POST(post({ cita_id: CITA }))).status).toBe(404)
    expect(tomas()).toEqual([])
  })

  it('cancelada, atendida, no asistió, pasada, de todo el día o sin paciente → 409 con su motivo, y no toma ningún envío', async () => {
    for (const [extra, motivo] of [[{ status: 'cancelled' }, 'cancelada'], [{ status: 'attended' }, 'atendida'],
      [{ status: 'no_show' }, 'no_asistio'], [{ start_time: new Date(Date.now() - 60_000).toISOString() }, 'pasada'],
      [{ all_day: true }, 'todo_el_dia'], [{ paciente_id: null, pacientes: null }, 'sin_paciente']] as const) {
      h.fila = cita(extra)
      const res = await POST(post({ cita_id: CITA }))
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ error: 'no_aplica', motivo })
    }
    expect(tomas()).toEqual([])
  })

  it('sin correo → 422 sin tomar', async () => {
    h.fila = cita({ pacientes: { email: null } })
    expect((await POST(post({ cita_id: CITA }))).status).toBe(422)
    expect(tomas()).toEqual([])
  })
})

describe('POST /api/agenda/correo — envío', () => {
  it('toma con la clínica de la SESIÓN y el tipo confirmacion; manda al destinatario de la base, sin nada clínico; cierra y audita', async () => {
    const res = await POST(post({ cita_id: CITA }))
    expect(res.status).toBe(200)
    expect(tomas()).toEqual([expect.objectContaining({ p_clinica_id: 'clinica-1', p_cita_id: CITA, p_tipo: 'confirmacion' })])
    expect(h.correos).toHaveLength(1)
    const c = h.correos[0] as { para: string; asunto: string; texto: string; html: string; idempotencia: string; etiqueta: string }
    expect(c.para).toBe('juana@prueba.local')
    expect(c.idempotencia).toBe(`confirmacion/${ENVIO}`)
    expect(c.asunto).toMatch(/^Confirma tu cita del /)
    expect(c.texto).toContain('Dra. Ana Pérez')
    expect(c.texto).toContain('Consultorio Centro, Calle Ficticia 1, Centro, Mérida')
    expect(c.texto).toContain('https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv')
    // K2 (punto 8): «Confirmo» lleva ?paso=confirmar.
    expect(c.html).toContain('href="https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv?paso=confirmar"')
    expect(`${c.asunto} ${c.texto}`).not.toMatch(/Juana|juana@|diagn|motivo|nota/i)
    expect(h.rpc.find(r => r.fn === 'cita_correo_marcar')?.args).toMatchObject({ p_clinica_id: 'clinica-1', p_envio_id: ENVIO, p_estado: 'enviado' })
    expect(h.auditorias).toEqual([expect.objectContaining({ userId: 'perfil-1', accion: 'enviar_confirmacion_cita', registroId: CITA })])
    expect(JSON.stringify(h.auditorias)).not.toContain('@')
  })

  /* Tanda L (punto 15). MUTACIÓN (en rojo): la ruta sin pasar `{ nombre }` a `enviarConfirmacionCita`. */
  it('tanda L: saluda con el nombre del paciente ligado (sin apellidos) o, sin él, con el tecleado al reservar', async () => {
    h.fila = cita({ reserva_nombre: 'Juana Reserva', pacientes: { email: 'juana@prueba.local', nombre: 'Juana' } })
    expect((await POST(post({ cita_id: CITA }))).status).toBe(200)
    const a = h.correos[0] as { asunto: string; texto: string; html: string }
    expect(a.texto).toContain('Hola, Juana:')
    expect(a.html).toContain('Hola, Juana:')
    expect(a.asunto).not.toContain('Juana')
    h.correos = []
    h.fila = cita({ paciente_id: null, reserva_canal: 'fijo', reserva_correo: 'r@prueba.local', reserva_nombre: ' Rosa  Pech ', pacientes: null })
    expect((await POST(post({ cita_id: CITA }))).status).toBe(200)
    expect((h.correos[0] as { texto: string }).texto).toContain('Hola, Rosa Pech:')
    h.correos = []
    h.fila = cita({ reserva_nombre: null, pacientes: { email: 'juana@prueba.local', nombre: null } })
    expect((await POST(post({ cita_id: CITA }))).status).toBe(200)
    expect((h.correos[0] as { texto: string }).texto).not.toContain('Hola')
  })

  it('una cita confirmada: asunto sin «Confirma» y el enlace sólo para avisar que no asistirá', async () => {
    h.fila = cita({ status: 'confirmed' })
    h.toma = [{ ...TOMA, r_estado: 'confirmed' }]
    expect((await POST(post({ cita_id: CITA }))).status).toBe(200)
    const c = h.correos[0] as { asunto: string; texto: string }
    expect(c.asunto).toMatch(/^Tu cita del /)
    expect(c.texto).toContain('Avisar que no podré asistir')
  })

  it('la base no da el envío y ya salió para esa hora → 409 ya_enviado, sin mandar', async () => {
    h.toma = []
    h.envioPrevio = { estado: 'enviado', enviado_en: '2026-11-14T15:00:00.000Z' }
    const res = await POST(post({ cita_id: CITA }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'ya_enviado', enviado: '2026-11-14T15:00:00.000Z' })
    expect(h.correos).toEqual([])
    expect(h.auditorias).toEqual([])
  })

  it('la base no lo da por otra causa → 409 no_disponible; sin la migración (22023) → 503', async () => {
    h.toma = []
    expect((await POST(post({ cita_id: CITA }))).status).toBe(409)
    h.errorToma = { code: '22023' }
    const res = await POST(post({ cita_id: CITA }))
    expect(res.status).toBe(503)
    expect(h.correos).toEqual([])
  })

  it('sin enlace → 503 sin mandar (omitido); transporte caído → 502 (fallido, reintentable)', async () => {
    h.enlace = null
    expect((await POST(post({ cita_id: CITA }))).status).toBe(503)
    expect(h.correos).toEqual([])
    expect(h.rpc.find(r => r.fn === 'cita_correo_marcar')?.args).toMatchObject({ p_estado: 'omitido', p_motivo: 'sin_enlace' })
    h.rpc = []
    h.enlace = { id: 'e', codigo: 'c', url: 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv' }
    h.envioOk = false
    expect((await POST(post({ cita_id: CITA }))).status).toBe(502)
    expect(h.rpc.find(r => r.fn === 'cita_correo_marcar')?.args).toMatchObject({ p_estado: 'fallido', p_motivo: 'transporte' })
  })
})
