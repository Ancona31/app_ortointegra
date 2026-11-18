import { test, expect, type Browser, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { SESION, diaDeLaSemana, interruptorAgenda, irAAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { esperarCorreo } from './mailpit'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import {
  api, aprobarAviso, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, verificarCorreo, citaDe,
  type Escenario, type Turno,
} from './reservaPublicaAyudas'
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * I1 · puntos 5 y 6 de Angel: lo que cambia una cita DESDE FUERA de la agenda
 * —la reserva, la confirmación, la cancelación y el reagendado por enlace—
 * tiene que verse en la agenda sin recargar, esté abierta o se vuelva a ella.
 *
 * Punto 5, la causa: con la agenda MONTADA el `INSERT` sí llega por Realtime y
 * se pinta (comprobado en los marcos del socket: `phx_join` → «Subscribed to
 * PostgreSQL» → `postgres_changes` INSERT, en la misma semana, en otra, en el
 * teléfono y con Google conectado). Lo que fallaba es el camino de Angel:
 * los enlaces viven en Configuración (D0–D2), así que la reserva llega con la
 * agenda DESMONTADA. Su canal muere con ella, la caché de rangos no (vive en
 * el módulo, 2 min de vigencia) y al volver se servía la semana guardada, sin
 * la cita. La semilla del servidor no lo arreglaba: antes de 30 s el router
 * reutiliza el RSC viejo, y la de un RSC nuevo se descarta porque la clave ya
 * tiene entrada vigente. Mismo origen que el punto 4.
 *
 * Arreglo: el canal sobrevive al desmontaje mientras la caché pueda servirse
 * (`VIGENCIA_CITAS_MS`) y, sin agenda, cualquier cambio sólo vacía la caché.
 * Cero peticiones nuevas: si nada cambió, volver sigue sin pedir nada.
 *
 * Las citas están en la semana siguiente a la visible (W+1): la siembra del
 * servidor la cubre, así que también ella se servía de la caché al volver.
 *
 * MUTACIONES (comprobadas en rojo): quitar la cita de la caché sólo al
 * desmontar —`removeChannel` en la limpieza del efecto, como antes— → las dos
 * «al volver»; no reenviar el cambio a la agenda montada (`vivo.montaje`)
 * → las cuatro «con la agenda abierta».
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const BASE_URL = 'http://localhost:3001'
const ENLACE_CONF = /\/confirmar\/([A-Za-z0-9_-]{22})(?=[\s"<]|$)/
const TITULO = 'Cita I1 reflejo'

let e: Escenario
/* Lo que reservan estas pruebas (citas, enlaces, confirmaciones, reagendos) lo
   borra `limpiarReservasE2e` desde esta marca: sin eso, las reservas de W+1
   se acumulan entre corridas y se acaban los turnos libres. */
let desde = ''
let libres: Turno[] = []
let siguiente = 0
function turno(): Turno {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana siguiente')
  return t
}

test.beforeAll(async () => {
  desde = marcaE2e()
  e = prepararEscenario()
  // Desde el lunes de W+1: siete días, todos dentro de esa semana.
  const dias = Math.round((Date.parse(diaDeLaSemana(1, 0)) - Date.parse(new Date().toLocaleDateString('en-CA', { timeZone: TZ }))) / 86_400_000)
  libres = (await turnosLibres(e, emitirEnlace(e, 'unico').codigo, dias)).filter(t => enW1(t.inicio))
})
test.afterAll(() => {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _a on commit drop as select id from public.appointments where clinica_id = :'c' and title = :'t';
    delete from public.audit_log where registro_id in (select id from _a)
       or registro_id in (select id from public.cita_confirmaciones where appointment_id in (select id from _a));
    delete from public.cita_confirmaciones where appointment_id in (select id from _a);
    delete from public.appointments where id in (select id from _a);
    commit;`, { c: e.clinicaId, t: TITULO })
  limpiarReservasE2e(desde)
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
  aprobarAviso(true)
})

function enW1(inicio: string): boolean {
  const dia = new Date(inicio).toLocaleDateString('en-CA', { timeZone: TZ })
  return dia >= diaDeLaSemana(1, 0) && dia <= diaDeLaSemana(1, 6)
}

/** Una cita del personal (con paciente) en W+1 y su código de confirmación, por SQL. */
function citaDelPersonal(hora: string): { citaId: string; codigo: string } {
  const enlace = randomUUID()
  const codigo = codigoDeConfirmacion(enlace)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  const inicio = fechaHoraLocalAInstante(diaDeLaSemana(1, 3), hora, TZ)
  const citaId = sqlLocal(`
    with p as (select id from public.pacientes where clinica_id = :'clinica' and apellidos = 'Prueba 18'),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                               consultorio_timezone, consultorio_nombre, consultorio_telefono)
               select :'clinica', p.id, :'medico', :'titulo', :'inicio'::timestamptz, :'inicio'::timestamptz + interval '30 min',
                      'scheduled', 'America/Merida', 'Consultorio I1', '9990001010' from p returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', :'clinica', a.id, :'hash', a.paciente_id from a returning appointment_id;`,
  { clinica: e.clinicaId, medico: e.medicoId, titulo: TITULO, inicio, enlace, hash: hashDeCodigo(codigo) })
  return { citaId, codigo }
}

/** El POST del formulario de `/confirmar/<código>`, como lo manda el navegador. */
async function responder(codigo: string, accion: 'confirmar' | 'cancelar'): Promise<void> {
  const ctx = await api()
  try {
    const r = await ctx.post(`/api/confirmar/${codigo}`, { form: { accion }, headers: { origin: BASE_URL }, maxRedirects: 0 })
    expect(r.status(), `${accion} por enlace`).toBe(303)
  } finally {
    await ctx.dispose()
  }
}

/** Reserva con el enlace fijo (código al correo); con `origen`, como reagendado. Devuelve el correo. */
async function reservarFijo(fijo: string, telefono: string, origen?: string): Promise<string> {
  const p = { ...personaNueva(), telefono }
  const ficha = await verificarCorreo(fijo, p.correo)
  const ctx = await api(ipAlAzar())
  try {
    const r = await ctx.post(`/api/reservar/${fijo}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio: turno().inicio, nombre: p.nombre, telefono: p.telefono,
      correo: p.correo, acepta_aviso: true, client_id: randomUUID(), ficha, ...(origen ? { origen } : {}),
    } })
    expect(r.status(), origen ? 'reagendado' : 'reserva').toBe(201)
    return p.correo
  } finally {
    await ctx.dispose()
  }
}

async function codigoDelComprobante(correo: string): Promise<string> {
  const c = await esperarCorreo(correo, 'Tu cita con')
  const m = ENLACE_CONF.exec(c.texto)
  if (!m?.[1]) throw new Error('El comprobante no trae el enlace de confirmación')
  return m[1]
}

/** El estado que dice la tarjeta de esa cita («… · Confirmada»), o «(sin tarjeta)». */
async function estadoEnTarjeta(page: Page, id: string): Promise<string> {
  const caja = page.locator(`.fc-timegrid-event [data-cita-id="${id}"]`)
  if (!(await caja.count())) return '(sin tarjeta)'
  const texto = (await caja.getAttribute('title')) ?? (await caja.getAttribute('aria-label')) ?? ''
  return texto.split(' · ')[1] ?? texto
}

async function aW1(page: Page): Promise<void> {
  await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
  await expect(page.locator('.fc-timegrid-col[data-date="' + diaDeLaSemana(1, 0) + '"]')).toBeVisible()
}

/**
 * Deja W y W+1 en la caché con lo que hay ahora en la base: espera a que la
 * red se calme tras abrir y pasa por W+1 y de vuelta a W. Sin esto, lo que
 * pase al abrir decide si la caché está o no, y la prueba no probaría nada.
 */
async function prepararCache(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await aW1(page)
  await page.locator('.fc-prev-button, [aria-label="Periodo anterior"]').first().click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${diaDeLaSemana(0, 0)}"]`)).toBeVisible()
  await page.waitForLoadState('networkidle')
}

/**
 * Otra pestaña con la agenda abierta en W+1: el TESTIGO de que Realtime ya
 * repartió un cambio. Hace falta porque Realtime lee el WAL con retraso: un
 * cambio hecho justo antes de que la otra pestaña vuelva a la agenda puede
 * llegarle a su canal NUEVO, y entonces la prueba pasaría también sin el
 * arreglo. Esperando a que el testigo lo vea, el cambio ya no le llega a nadie
 * que se suscriba después.
 */
async function abrirTestigo(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: SESION.adminA, baseURL: test.info().project.use.baseURL })
  const testigo = await ctx.newPage()
  await irAAgenda(testigo)
  await aW1(testigo)
  return testigo
}

/** Sale de la agenda a `ir` (navegación de cliente), hace `cambio`, espera a que el testigo lo vea y vuelve por el menú, a W+1. */
async function fueraYVolver(page: Page, ir: 'configuracion' | 'dashboard', cambio: () => Promise<void>, visto: () => Promise<void>): Promise<void> {
  await irAAgenda(page)
  await prepararCache(page)
  if (ir === 'configuracion') {
    // Integración I (I5, punto 15): la configuración es la primera opción del menú del engrane.
    await page.getByRole('button', { name: 'Opciones de la agenda' }).first().click()
    await page.getByRole('menuitem', { name: 'Configuración de la agenda' }).click()
    await page.waitForURL('**/agenda/configuracion')
  } else {
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await page.waitForURL('**/dashboard')
  }
  /* La agenda ya desmontada: el cambio llega con la agenda FUERA de verdad,
     no en la rendija en que la URL ya cambió y ella aún no. */
  await expect(page.locator('.agenda-raiz')).toHaveCount(0)
  await cambio()
  await visto()
  await page.getByRole('link', { name: 'Agenda', exact: true }).first().click()
  await page.waitForURL(/\/agenda$/)
  await page.locator('.fc-event').first().waitFor()
  await aW1(page)
}

test('punto 5 · reserva por enlace con la agenda en Configuración: al volver, la cita está', async ({ page, browser }) => {
  const testigo = await abrirTestigo(browser)
  try {
    const p = personaNueva()
    await fueraYVolver(page, 'configuracion', async () => {
      const r = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno().inicio, persona: p })
      expect(r.status).toBe(201)
    }, () => expect(testigo.locator('.fc-timegrid-event', { hasText: p.nombre })).toBeVisible({ timeout: 8000 }))
    await expect(page.locator('.fc-timegrid-event', { hasText: p.nombre })).toBeVisible({ timeout: 5000 })
  } finally {
    await testigo.context().close()
  }
})

test('punto 6 · confirmar por enlace con la agenda en el dashboard: al volver, «Confirmada»', async ({ page, browser }) => {
  const testigo = await abrirTestigo(browser)
  try {
    const { citaId, codigo } = citaDelPersonal('16:00')
    // El alta por SQL también viaja por Realtime: que llegue antes de abrir la otra pestaña.
    await expect.poll(() => estadoEnTarjeta(testigo, citaId), { timeout: 8000 }).toBe('Agendada')
    await fueraYVolver(page, 'dashboard', () => responder(codigo, 'confirmar'),
      () => expect.poll(() => estadoEnTarjeta(testigo, citaId), { timeout: 8000 }).toBe('Confirmada'))
    await expect.poll(() => estadoEnTarjeta(page, citaId), { timeout: 5000 }).toBe('Confirmada')
  } finally {
    await testigo.context().close()
  }
})

test('punto 5 · reserva por enlace con la agenda abierta: aparece sin recargar', async ({ page }) => {
  await irAAgenda(page)
  await aW1(page)
  const p = personaNueva()
  const r = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno().inicio, persona: p })
  expect(r.status).toBe(201)
  await expect(page.locator('.fc-timegrid-event', { hasText: p.nombre })).toBeVisible({ timeout: 8000 })
})

test('punto 6 · confirmar y cancelar por enlace con la agenda abierta: la tarjeta cambia sin recargar', async ({ page }) => {
  const a = citaDelPersonal('17:00')
  const b = citaDelPersonal('17:30')
  await irAAgenda(page)
  await aW1(page)
  await expect.poll(() => estadoEnTarjeta(page, a.citaId)).toBe('Agendada')
  await responder(a.codigo, 'confirmar')
  await expect.poll(() => estadoEnTarjeta(page, a.citaId), { timeout: 8000 }).toBe('Confirmada')
  await responder(b.codigo, 'cancelar')
  await expect.poll(() => estadoEnTarjeta(page, b.citaId), { timeout: 8000 }).toBe('Cancelada')
})

test('punto 6 · reagendar por enlace con la agenda abierta: la vieja queda cancelada y la nueva aparece', async ({ page }) => {
  const { codigo: fijo } = emitirEnlace(e, 'fijo')
  const telefono = personaNueva().telefono
  const primera = await reservarFijo(fijo, telefono)
  const vieja = citaDe(primera)?.id ?? ''
  const codigo = await codigoDelComprobante(primera)
  await irAAgenda(page)
  await aW1(page)
  await expect.poll(() => estadoEnTarjeta(page, vieja)).toBe('Agendada')
  await responder(codigo, 'cancelar')
  const segunda = await reservarFijo(fijo, telefono, codigo)
  const nueva = citaDe(segunda)?.id ?? ''
  await expect.poll(() => estadoEnTarjeta(page, vieja), { timeout: 8000 }).toBe('Cancelada')
  await expect.poll(() => estadoEnTarjeta(page, nueva), { timeout: 8000 }).toBe('Agendada')
})
