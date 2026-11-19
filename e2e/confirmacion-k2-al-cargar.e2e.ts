import { test, expect, type Browser, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { SESION, diaDeLaSemana, irAAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { api, cerrarEscenario, ipAlAzar, prepararEscenario, type Escenario } from './reservaPublicaAyudas'
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * K2 · punto 8 de Angel: abrir «Confirmo mi asistencia» del correo
 * (`/confirmar/<código>?paso=confirmar`) confirma SOLO, sin repetir el clic.
 * El GET sigue sin escribir: confirma la página con el POST del botón al
 * cargarse. Sin JavaScript queda el botón; un GET o HEAD (revisores de correo,
 * vistas previas) y un navegador automatizado no confirman; «No podré asistir»
 * sigue en dos pasos. Contra :3001 y la base local. Sólo `escritorio`.
 *
 * Playwright marca `navigator.webdriver = true` y la página no confirma así
 * (es la guarda contra los que abren enlaces con un navegador automatizado):
 * la persona se simula con `webdriver` en false.
 *
 * MUTACIONES (comprobadas en rojo con el servidor reconstruido): sin la guarda
 * de `navigator.webdriver` → «un navegador automatizado no confirma»; la
 * página sin `ConfirmarAlCargar` (el botón de siempre) → «confirma al cargar».
 *
 * Tanda L (punto 1 de Angel, AG-DT-175): la página ESPERA UN GESTO de la
 * persona (un clic o una tecla fuera de los controles) antes del POST. Un
 * gesto sobre «No podré asistir» (o sobre cualquier otro control) no confirma.
 * MUTACIONES (L4, en rojo): sin la espera del gesto (el POST al verse) → «no
 * hay POST hasta el gesto»; sin apartar los controles (`esControl` siempre
 * false) → «un gesto sobre “No podré asistir” no confirma».
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const BASE = 'http://localhost:3001'
const TITULO = 'Cita K2 al cargar'
let e: Escenario

test.beforeAll(() => { e = prepararEscenario() })
test.afterAll(() => {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _a on commit drop as select id from public.appointments where clinica_id = :'c' and title = :'t';
    delete from public.cita_confirmaciones where appointment_id in (select id from _a);
    delete from public.appointments where id in (select id from _a);
    commit;`, { c: e.clinicaId, t: TITULO })
  cerrarEscenario()
})

/** Una cita del personal (con paciente) el jueves de W+1 y su código de confirmación, por SQL. */
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
                      'scheduled', 'America/Merida', 'Consultorio K2', '9990001010' from p returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', :'clinica', a.id, :'hash', a.paciente_id from a returning appointment_id;`,
  { clinica: e.clinicaId, medico: e.medicoId, titulo: TITULO, inicio, enlace, hash: hashDeCodigo(codigo) })
  return { citaId, codigo }
}

function estado(citaId: string): string {
  return sqlLocal(`select a.status || '|' || coalesce(c.respuesta, '-') from public.appointments a
                     left join public.cita_confirmaciones c on c.appointment_id = a.id and c.revocado_en is null
                    where a.id = :'id';`, { id: citaId })
}

/** La persona que abre el correo: sin sesión, otra IP y, salvo que se diga, un navegador NO automatizado. */
async function paciente(browser: Browser, opciones: { js?: boolean; automatizado?: boolean } = {}): Promise<{ p: Page; posts: string[] }> {
  const ctx = await browser.newContext({ baseURL: BASE, javaScriptEnabled: opciones.js ?? true, extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })
  if (!opciones.automatizado) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  const p = await ctx.newPage()
  const posts: string[] = []
  p.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/confirmar/')) posts.push(r.url()) })
  return { p, posts }
}

/** El gesto de la persona: un clic en la fecha (texto, fuera de cualquier control). */
async function gesto(p: Page): Promise<void> {
  await p.locator('.rp-fecha').click()
}

async function estadoEnTarjeta(page: Page, id: string): Promise<string> {
  const caja = page.locator(`.fc-timegrid-event [data-cita-id="${id}"]`)
  if (!(await caja.count())) return '(sin tarjeta)'
  const texto = (await caja.getAttribute('title')) ?? (await caja.getAttribute('aria-label')) ?? ''
  return texto.split(' · ')[1] ?? texto
}

test('«Confirmo mi asistencia» del correo confirma al cargar: un POST, auditado, y la agenda abierta lo ve sin recargar', async ({ page, browser }) => {
  const { citaId, codigo } = citaDelPersonal('16:00')
  await irAAgenda(page)
  await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
  await expect.poll(() => estadoEnTarjeta(page, citaId)).toBe('Agendada')

  const { p, posts } = await paciente(browser)
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  // Tanda L (punto 1): abrirla no basta; sin un gesto de la persona no sale ningún POST.
  await p.waitForLoadState('networkidle')
  await p.waitForTimeout(1500)
  expect(posts).toEqual([])
  expect(estado(citaId)).toBe('scheduled|-')
  await gesto(p)
  await p.waitForURL(/\?r=confirmada$/)
  await expect(p.getByRole('status')).toHaveText('Gracias. Tu asistencia quedó confirmada.')
  expect(posts).toHaveLength(1)
  expect(estado(citaId)).toBe('confirmed|confirmo')
  const audit = sqlLocal(`select user_id || '|' || (descripcion::jsonb ->> 'via') || '|' || (descripcion::jsonb -> 'estado' ->> 'a')
                            from public.audit_log where registro_id = :'id' and accion = 'cita_editada';`, { id: citaId })
  expect(audit).toBe('system|enlace_paciente|confirmed')
  await expect.poll(() => estadoEnTarjeta(page, citaId), { timeout: 8000 }).toBe('Confirmada')
  // Volver a abrir el correo (o recargar): ya no se puede confirmar, así que no hay otro POST.
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await expect(p.getByText('Confirmo mi asistencia')).toHaveCount(0)
  await p.reload()
  expect(posts).toHaveLength(1)
  await p.context().close()
})

test('no confirman: GET ni HEAD de ?paso=confirmar, la página sin JavaScript ni un navegador automatizado', async ({ browser }) => {
  const { citaId, codigo } = citaDelPersonal('16:30')
  const ctx = await api()
  try {
    for (const ua of ['Mozilla/5.0', 'WhatsApp/2.23.20.0', 'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0)']) {
      const r = await ctx.get(`/confirmar/${codigo}?paso=confirmar`, { headers: { 'user-agent': ua } })
      expect(r.status()).toBe(200)
      expect(await r.text()).toContain('Confirmo mi asistencia')
    }
    expect((await ctx.head(`/confirmar/${codigo}?paso=confirmar`)).status()).toBe(200)
  } finally {
    await ctx.dispose()
  }
  const sinJs = await paciente(browser, { js: false })
  await sinJs.p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await expect(sinJs.p.getByRole('button', { name: 'Confirmo mi asistencia' })).toBeVisible()
  await sinJs.p.context().close()

  const robot = await paciente(browser, { automatizado: true })
  await robot.p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await robot.p.waitForLoadState('networkidle')
  await expect(robot.p.getByRole('button', { name: 'Confirmo mi asistencia' })).toBeVisible()
  expect(robot.posts).toEqual([])
  await robot.p.context().close()
  expect(estado(citaId)).toBe('scheduled|-')
})

test('sin JavaScript, el botón de siempre confirma', async ({ browser }) => {
  const { citaId, codigo } = citaDelPersonal('17:00')
  const { p } = await paciente(browser, { js: false })
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await p.getByRole('button', { name: 'Confirmo mi asistencia' }).click()
  await p.waitForURL(/\?r=confirmada$/)
  expect(estado(citaId)).toBe('confirmed|confirmo')
  await p.context().close()
})

test('si el POST falla, queda el botón de siempre; «No podré asistir» sigue en dos pasos', async ({ browser }) => {
  const { citaId, codigo } = citaDelPersonal('17:30')
  const { p, posts } = await paciente(browser)
  await p.route('**/api/confirmar/**', r => r.abort())
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await gesto(p)
  await expect.poll(() => posts.length).toBe(1)
  await expect(p.getByRole('button', { name: 'Confirmo mi asistencia' })).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(estado(citaId)).toBe('scheduled|-')
  await p.unroute('**/api/confirmar/**')
  await p.goto(`/confirmar/${codigo}?paso=cancelar`)
  await expect(p.getByRole('button', { name: 'Sí, cancelar mi cita' })).toBeVisible()
  await p.waitForLoadState('networkidle')
  expect(posts).toHaveLength(1)
  expect(estado(citaId)).toBe('scheduled|-')
  await p.context().close()
})

test('tanda L · un gesto sobre «No podré asistir» no confirma: ni con el ratón ni con el teclado', async ({ browser }) => {
  const { citaId, codigo } = citaDelPersonal('18:00')
  const { p, posts } = await paciente(browser)
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await p.waitForLoadState('networkidle')
  // Con el ratón: el clic va al enlace (el «¿Seguro?»), no a confirmar.
  await p.getByRole('link', { name: 'No podré asistir' }).click()
  await p.waitForURL(/\?paso=cancelar$/)
  await expect(p.getByRole('button', { name: 'Sí, cancelar mi cita' })).toBeVisible()
  // Con el teclado: Tab hasta el enlace y Enter. Tab sólo mueve el foco; Enter es del enlace.
  await p.goto(`/confirmar/${codigo}?paso=confirmar`)
  await p.waitForLoadState('networkidle')
  const enlace = p.getByRole('link', { name: 'No podré asistir' })
  for (let i = 0; i < 10 && !(await enlace.evaluate(el => el === document.activeElement)); i++) await p.keyboard.press('Tab')
  await expect(enlace).toBeFocused()
  await p.keyboard.press('Enter')
  await p.waitForURL(/\?paso=cancelar$/)
  await p.waitForLoadState('networkidle')
  expect(posts).toEqual([])
  expect(estado(citaId)).toBe('scheduled|-')
  await p.context().close()
})
