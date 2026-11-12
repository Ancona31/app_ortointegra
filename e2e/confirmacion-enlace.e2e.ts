import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { interruptorAgenda, sqlLocal, soloEscritorio } from './ayudas'
import { contarCorreos, esperarCorreo, type CorreoCapturado } from './mailpit'
import {
  api, cerrarEscenario, citaDe, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, verificarCorreo,
  type Escenario, type Turno,
} from './reservaPublicaAyudas'
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'

/**
 * Confirmación de asistencia por enlace, de punta a punta (agenda E10, lo de
 * E3, E5 y E6). Sin sesión: la página `/confirmar/<código>` y su POST contra
 * :3001, los correos capturados en Mailpit y la base local para preparar y
 * comprobar. Sólo `escritorio`.
 *
 * ⚠️ La prueba obligatoria es la primera: ABRIR EL ENLACE NO CAMBIA NADA. Los
 * filtros de correo y la vista previa de WhatsApp hacen GET (y algunos HEAD)
 * solos; si un GET escribiera, las citas se confirmarían o cancelarían sin que
 * nadie lo pidiera.
 *
 * Requiere en .env.local: EMAIL_TRANSPORT=captura, RESERVA_SECRETO y
 * RESERVA_AVISO_BORRADOR_LOCAL=1 (como las e2e de D10).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
// La página sale con una IP inventada por corrida: los límites por IP sobreviven a la siembra.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

const BASE_URL = 'http://localhost:3001'
const ENLACE_CONF = /\/confirmar\/([A-Za-z0-9_-]{22})(?=[\s"<]|$)/

let e: Escenario
let libres: Turno[] = []
let siguiente = 0
function turno(): Turno {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana elegida')
  return t
}

test.beforeAll(async () => {
  e = prepararEscenario()
  // Dentro de 5 semanas: lejos de los turnos que usan las e2e de D10.
  libres = await turnosLibres(e, emitirEnlace(e, 'unico').codigo, 35)
})
test.afterAll(() => {
  sqlLocal(`update public.clinicas set suspendida = false where id = :'c';`, { c: e.clinicaId })
  borrarCitasDelPersonal()
  cerrarEscenario()
})

/**
 * Las citas «del personal» que siembra este archivo llevan un paciente de la
 * semilla y caen HOY (la carrera a T−1h, la pasada): sin borrarlas, otra e2e
 * que busque la tarjeta de ese paciente en la agenda de hoy podría dar con
 * ellas. Se borran como postgres con replica (audit_log es inmutable), con su
 * enlace y su auditoría. Las reservas por enlace las limpia la siembra.
 */
function borrarCitasDelPersonal(): void {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _a on commit drop as
      select id from public.appointments where clinica_id = :'c' and title = 'TITULO SECRETO E10';
    delete from public.audit_log where registro_id in (select id from _a)
       or registro_id in (select id from public.cita_confirmaciones where appointment_id in (select id from _a));
    delete from public.cita_confirmaciones where appointment_id in (select id from _a);
    delete from public.appointments where id in (select id from _a);
    commit;`, { c: e.clinicaId })
}

/** El código de confirmación del comprobante más reciente para ese correo. */
async function codigoDelComprobante(correo: string, previos = 0): Promise<{ codigo: string; correo: CorreoCapturado }> {
  const c = await esperarCorreo(correo, 'Tu cita con', previos)
  const m = ENLACE_CONF.exec(c.texto)
  if (!m?.[1]) throw new Error('El comprobante no trae el enlace de confirmación')
  return { codigo: m[1], correo: c }
}

/** Reserva con un enlace único (sin código al correo) y devuelve la cita y su código de confirmación. */
async function reservarConEnlace(): Promise<{ citaId: string; codigo: string; turno: Turno; correo: CorreoCapturado; persona: ReturnType<typeof personaNueva> }> {
  const p = personaNueva()
  const t = turno()
  const r = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: t.inicio, persona: p })
  expect(r.status).toBe(201)
  const { codigo, correo } = await codigoDelComprobante(p.correo)
  return { citaId: citaDe(p.correo)?.id ?? '', codigo, turno: t, correo, persona: p }
}

/** Una cita del PERSONAL (con paciente) a `inicio` y su enlace de confirmación, sembrados por SQL. */
function citaDelPersonal(inicio: string, status = 'scheduled'): { citaId: string; codigo: string } {
  const enlace = randomUUID()
  const codigo = codigoDeConfirmacion(enlace)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  const citaId = sqlLocal(`
    with p as (select id from public.pacientes where clinica_id = :'clinica' order by created_at limit 1),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                               consultorio_timezone, consultorio_nombre, consultorio_telefono)
               select :'clinica', p.id, :'medico', 'TITULO SECRETO E10', :'inicio'::timestamptz, :'inicio'::timestamptz + interval '30 min',
                      :'status', 'America/Merida', 'Consultorio E10', '9990001010' from p returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', :'clinica', a.id, :'hash', a.paciente_id from a returning appointment_id;`,
  { clinica: e.clinicaId, medico: e.medicoId, inicio, status, enlace, hash: hashDeCodigo(codigo) })
  return { citaId, codigo }
}

function estado(citaId: string): string {
  return sqlLocal(`select a.status || '|' || coalesce(c.respuesta, '-') from public.appointments a
                     left join public.cita_confirmaciones c on c.appointment_id = a.id and c.revocado_en is null
                    where a.id = :'id';`, { id: citaId })
}

function filasDeAuditoria(citaId: string): string {
  return sqlLocal(`select count(*) from public.audit_log where registro_id = :'id'
                      or registro_id in (select id from public.cita_confirmaciones where appointment_id = :'id');`, { id: citaId })
}

/** El POST del formulario, como lo manda el navegador (mismo origen), sin seguir el 303. */
async function responder(codigo: string, accion: 'confirmar' | 'cancelar', ctx?: APIRequestContext): Promise<{ status: number; destino: string }> {
  const propio = ctx ?? await api()
  try {
    const r = await propio.post(`/api/confirmar/${codigo}`, { form: { accion }, headers: { origin: BASE_URL }, maxRedirects: 0 })
    return { status: r.status(), destino: r.headers()['location'] ?? '' }
  } finally {
    if (!ctx) await propio.dispose()
  }
}

/** Los POST que el navegador manda a la API de confirmación. */
function contarPosts(page: Page): string[] {
  const vistos: string[] = []
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/confirmar/')) vistos.push(r.url()) })
  return vistos
}

test('abrir el enlace NO cambia nada: GET, HEAD, vistas previas y el navegador sin pulsar; la API por GET es 405', async ({ page }) => {
  const { citaId, codigo, correo } = await reservarConEnlace()
  // El comprobante (E5) lleva el enlace y nada clínico ni el teléfono de la persona.
  expect(correo.texto).toContain('Para confirmar tu asistencia o avisar que no podrás ir')
  expect(correo.html).toMatch(/href="http[^"]+\/confirmar\/[A-Za-z0-9_-]{22}"/)
  for (const cuerpo of [correo.texto, correo.html]) {
    expect(cuerpo).not.toContain(e.tipoNombre)
    expect(cuerpo).not.toContain('Consulta:')
  }
  const auditoriaAntes = filasDeAuditoria(citaId)
  expect(estado(citaId)).toBe('scheduled|-')

  const ctx = await api()
  try {
    for (const ua of ['Mozilla/5.0', 'WhatsApp/2.23.20.0', 'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0)']) {
      const r = await ctx.get(`/confirmar/${codigo}`, { headers: { 'user-agent': ua } })
      expect(r.status()).toBe(200)
      expect(await r.text()).toContain('Confirmo mi asistencia')
    }
    expect((await ctx.head(`/confirmar/${codigo}`)).status()).toBe(200)
    expect((await ctx.get(`/confirmar/${codigo}?paso=cancelar`)).status()).toBe(200)
    expect((await ctx.get(`/confirmar/${codigo}?r=cancelada`)).status()).toBe(200)
    expect((await ctx.get(`/api/confirmar/${codigo}`)).status()).toBe(405)
    expect((await ctx.head(`/api/confirmar/${codigo}`)).status()).toBe(405)
  } finally {
    await ctx.dispose()
  }
  const posts = contarPosts(page)
  for (let i = 0; i < 2; i++) {
    await page.goto(`/confirmar/${codigo}`)
    await expect(page.getByRole('button', { name: 'Confirmo mi asistencia' })).toBeVisible()
  }
  await page.goto(`/confirmar/${codigo}?paso=cancelar`)
  await expect(page.getByRole('button', { name: 'Sí, cancelar mi cita' })).toBeVisible()
  // Lo que se pinta: lo mínimo, sin ids ni la clínica.
  const html = await page.content()
  for (const interno of [e.clinicaId, e.medicoId, citaId, e.tipoNombre]) expect(html).not.toContain(interno)

  expect(posts).toEqual([])
  expect(estado(citaId)).toBe('scheduled|-')
  expect(filasDeAuditoria(citaId)).toBe(auditoriaAntes)
})

test('confirmar: un POST con 303 a ?r=confirmada, auditado como del paciente; recargar no lo reenvía', async ({ page }) => {
  const { citaId, codigo } = await reservarConEnlace()
  const posts = contarPosts(page)
  const estados: number[] = []
  page.on('response', r => { if (r.url().includes('/api/confirmar/')) estados.push(r.status()) })
  await page.goto(`/confirmar/${codigo}`)
  await page.getByRole('button', { name: 'Confirmo mi asistencia' }).click()
  await page.waitForURL(/\?r=confirmada$/)
  await expect(page.getByRole('status')).toHaveText('Gracias. Tu asistencia quedó confirmada.')
  expect(estados).toEqual([303])
  expect(estado(citaId)).toBe('confirmed|confirmo')
  const audit = sqlLocal(`select user_id || '|' || (descripcion::jsonb ->> 'via') || '|' || (descripcion::jsonb -> 'estado' ->> 'a')
                            from public.audit_log where registro_id = :'id' and accion = 'cita_editada';`, { id: citaId })
  expect(audit).toBe('system|enlace_paciente|confirmed')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Confirmo mi asistencia' })).toHaveCount(0)
  expect(posts).toHaveLength(1)
})

test('no podré asistir: dos pasos (el segundo GET no escribe), la cita se cancela y el horario queda libre', async ({ page }) => {
  const { citaId, codigo, turno: t } = await reservarConEnlace()
  const ofrecidos = async (): Promise<string[]> => (await turnosLibres(e, emitirEnlace(e, 'unico').codigo, 35)).map(x => x.inicio)
  expect(await ofrecidos()).not.toContain(t.inicio)
  await page.goto(`/confirmar/${codigo}`)
  await page.getByRole('link', { name: 'No podré asistir' }).click()
  await page.waitForURL(/\?paso=cancelar$/)
  expect(estado(citaId)).toBe('scheduled|-')
  await page.getByRole('button', { name: 'Sí, cancelar mi cita' }).click()
  await page.waitForURL(/\?r=cancelada$/)
  expect(estado(citaId)).toBe('cancelled|cancelo')
  expect(await ofrecidos()).toContain(t.inicio)
  // Una cita por enlace cancelada es una incidencia del candado (D2).
  expect(sqlLocal(`select tipo from public.reserva_incidencias where appointment_id = :'id';`, { id: citaId })).toBe('cancelacion')
  // Ya cancelada: ni confirmar ni volver a cancelar.
  expect((await responder(codigo, 'confirmar')).destino).toContain('?r=ya_cancelada')
  expect(estado(citaId)).toBe('cancelled|cancelo')
})

test('la carrera a T−1h: la página ofrecía cancelar, el POST llega tarde y no cancela; confirmar todavía vale', async ({ page }) => {
  // 20 s de colchón para sembrar, abrir y pintar la página; luego se espera a pasar el corte.
  const corte = Date.now() + 20_000
  const inicio = new Date(corte + 60 * 60 * 1000).toISOString()
  const { citaId, codigo } = citaDelPersonal(inicio)
  await page.goto(`/confirmar/${codigo}?paso=cancelar`)
  const boton = page.getByRole('button', { name: 'Sí, cancelar mi cita' })
  await expect(boton).toBeVisible()
  await page.waitForTimeout(Math.max(0, corte - Date.now()) + 1500)
  await boton.click()
  await page.waitForURL(/\?r=fuera_de_plazo$/)
  await expect(page.getByRole('status')).toHaveText('Ya no es posible cancelar desde el enlace; comunícate al 9990001010.')
  expect(estado(citaId)).toBe('scheduled|-')
  await expect(page.getByRole('link', { name: 'No podré asistir' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirmo mi asistencia' }).click()
  await page.waitForURL(/\?r=confirmada$/)
  expect(estado(citaId)).toBe('confirmed|confirmo')
})

test('enlace caducado (cita pasada) o revocado: «ya pasó» sin botones; revocado, 404 en la página y en el POST', async ({ page }) => {
  const pasada = citaDelPersonal(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
  await page.goto(`/confirmar/${pasada.codigo}`)
  await expect(page.getByText('Esta cita ya pasó.')).toBeVisible()
  await expect(page.getByRole('button')).toHaveCount(0)
  expect((await responder(pasada.codigo, 'confirmar')).destino).toContain('?r=pasada')
  expect(estado(pasada.citaId)).toBe('scheduled|-')

  const viva = citaDelPersonal(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
  sqlLocal(`update public.cita_confirmaciones set revocado_en = now() where appointment_id = :'id';`, { id: viva.citaId })
  const r = await page.goto(`/confirmar/${viva.codigo}`)
  expect(r?.status()).toBe(404)
  expect((await responder(viva.codigo, 'cancelar')).status).toBe(404)
  expect(sqlLocal(`select status from public.appointments where id = :'id';`, { id: viva.citaId })).toBe('scheduled')
  // Y un código inventado da el mismo 404.
  expect((await page.goto(`/confirmar/${'A'.repeat(22)}`))?.status()).toBe(404)
})

test('clínica suspendida: no disponible (404 en la página y en el POST) y la cita no cambia; al levantarla, vuelve', async ({ page }) => {
  const { citaId, codigo } = citaDelPersonal(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
  sqlLocal(`update public.clinicas set suspendida = true where id = :'c';`, { c: e.clinicaId })
  try {
    expect((await page.goto(`/confirmar/${codigo}`))?.status()).toBe(404)
    expect((await responder(codigo, 'cancelar')).status).toBe(404)
    expect(estado(citaId)).toBe('scheduled|-')
  } finally {
    sqlLocal(`update public.clinicas set suspendida = false where id = :'c';`, { c: e.clinicaId })
  }
  expect((await page.goto(`/confirmar/${codigo}`))?.status()).toBe(200)
  // Con el interruptor apagado, también 404.
  interruptorAgenda('A', false)
  try {
    expect((await page.goto(`/confirmar/${codigo}`))?.status()).toBe(404)
  } finally {
    interruptorAgenda('A', true)
  }
})

/** Reserva con el fijo (código al correo) y, si hay `origen`, como reagendado. */
async function reservarFijo(fijo: string, telefono: string, origen?: string): Promise<{ status: number; error: unknown; correo: string }> {
  const p = { ...personaNueva(), telefono }
  const ficha = await verificarCorreo(fijo, p.correo)
  const ctx = await api(ipAlAzar())
  try {
    const r = await ctx.post(`/api/reservar/${fijo}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio: turno().inicio, nombre: p.nombre, telefono: p.telefono,
      correo: p.correo, acepta_aviso: true, client_id: randomUUID(), ficha, ...(origen ? { origen } : {}),
    } })
    const cuerpo: { error?: unknown } = await r.json().catch(() => ({}))
    return { status: r.status(), error: cuerpo.error, correo: p.correo }
  } finally {
    await ctx.dispose()
  }
}

test('reagendar desde «no podré asistir» con el enlace fijo, hasta el tope de 2', async ({ page }) => {
  const { codigo: fijo } = emitirEnlace(e, 'fijo')
  const telefono = personaNueva().telefono
  const primera = await reservarFijo(fijo, telefono)
  expect(primera.status).toBe(201)
  let codigo = (await codigoDelComprobante(primera.correo)).codigo

  for (const n of [1, 2]) {
    expect((await responder(codigo, 'cancelar')).destino).toContain('?r=cancelada')
    await page.goto(`/confirmar/${codigo}?r=cancelada`)
    const elegir = page.getByRole('link', { name: 'Elegir otro horario' })
    await expect(elegir).toHaveAttribute('href', `/reservar/${fijo}?origen=${codigo}`)
    if (n === 1) {
      await elegir.click()
      await expect(page.getByText(/^Estás reagendando tu cita del /)).toBeVisible()
    }
    const r = await reservarFijo(fijo, telefono, codigo)
    expect(r.status, `reagendado ${n}`).toBe(201)
    const nueva = citaDe(r.correo)
    expect(sqlLocal(`select a.reserva_reagendados || '|' || r.numero from public.appointments a
                       join public.cita_reagendos r on r.cita_nueva_id = a.id where a.id = :'id';`, { id: nueva?.id ?? '' })).toBe(`${n}|${n}`)
    // Ya reagendada: la página lo dice y un segundo envío no la reagenda otra vez.
    await page.goto(`/confirmar/${codigo}`)
    await expect(page.getByText('Ya elegiste otro horario para esta cita.')).toBeVisible()
    expect((await reservarFijo(fijo, telefono, codigo)).error).toBe('ya_reagendada')
    codigo = (await codigoDelComprobante(r.correo)).codigo
  }

  // La tercera: se cancela, pero ya no se ofrece reagendar; el POST con origen da el tope con el teléfono.
  expect((await responder(codigo, 'cancelar')).destino).toContain('?r=cancelada')
  await page.goto(`/confirmar/${codigo}`)
  await expect(page.getByRole('link', { name: 'Elegir otro horario' })).toHaveCount(0)
  await expect(page.getByText(/^Para agendar otra cita, comunícate/)).toBeVisible()
  const tope = await reservarFijo(fijo, telefono, codigo)
  expect({ status: tope.status, error: tope.error }).toEqual({ status: 403, error: 'tope_reagendados' })
})

test('lista A 4: una reserva dentro de la ventana recibe UN correo (el comprobante); la tarea de recordatorios, después, no manda otro', async () => {
  const cron = process.env.CRON_SECRET ?? ''
  test.skip(cron === '', 'Falta CRON_SECRET (sólo de prueba) en .env.local')
  // Ventana de 72 h para tener turnos dentro sin depender del día de la semana; se restablece al terminar.
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 72 where clinica_id = :'c';`, { c: e.clinicaId })
  try {
    const { codigo } = emitirEnlace(e, 'unico')
    const ahora = Date.now()
    const dentro = (await turnosLibres(e, codigo, 0))
      .find(t => Date.parse(t.inicio) > ahora + 3 * 3600_000 && Date.parse(t.inicio) < ahora + 70 * 3600_000)
    test.skip(!dentro, 'Sin turnos libres dentro de las próximas 70 h')
    const p = personaNueva()
    expect((await reservar(e, codigo, { inicio: dentro?.inicio ?? '', persona: p })).status).toBe(201)
    await codigoDelComprobante(p.correo)
    const citaId = citaDe(p.correo)?.id ?? ''
    expect(sqlLocal(`select tipo || ':' || estado from public.cita_correos where appointment_id = :'id';`, { id: citaId })).toBe('comprobante:enviado')

    const ctx = await api()
    try {
      for (let i = 0; i < 2; i++) {
        const r = await ctx.get('/api/cron/recordatorios', { headers: { authorization: `Bearer ${cron}` } })
        expect(r.status()).toBe(200)
      }
    } finally {
      await ctx.dispose()
    }
    await new Promise(r => setTimeout(r, 1500))
    expect(await contarCorreos(p.correo, 'Tu cita con')).toBe(1)
    expect(await contarCorreos(p.correo, 'Recordatorio')).toBe(0)
    expect(sqlLocal(`select count(*) from public.cita_correos where appointment_id = :'id' and tipo = 'recordatorio';`, { id: citaId })).toBe('0')
  } finally {
    sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 24 where clinica_id = :'c';`, { c: e.clinicaId })
  }
})
