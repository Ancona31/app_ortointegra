import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, soloEscritorio, sqlLocal, enContextoNuevo } from './ayudas'
import { bloquearContactoE2e, crearCitaPorLigar, aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'

/**
 * Bloque D · gestión de la reserva por enlace desde la clínica (lo que quedó
 * pendiente de D1 y D2), en `/agenda/configuracion`:
 *
 *   · apagado: las cuatro rutas de gestión dan 404 y la pantalla no existe;
 *   · encendido, administrador: crea el enlace fijo de un médico, lo vuelve a
 *     mostrar, lo regenera (el viejo queda revocado) y lo revoca; emite uno de
 *     un solo uso con la vigencia del ajuste (7 días) y lo revoca;
 *   · médico invitado: sólo ve y gestiona lo suyo (403 para otro médico);
 *   · contactos bloqueados: aparecen en la lista y se desbloquean a mano.
 *
 * ⚠️ NECESITA `RESERVA_SECRETO` en el servidor que sirve las pruebas: sin él
 * el alta contesta 503 (se comprueba aparte, en Vitest, que nada se escribe).
 * Lo que se crea se borra al terminar (`limpiarReservasE2e`, ver su nota).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

/** Lo creado desde aquí es de este archivo: lo único que limpia (`limpiarReservasE2e`). Los
    enlaces vigentes de antes (p. ej. uno hecho a mano) se aparcan y se devuelven al terminar. */
let desde = ''
let aparcados: string[] = []
test.beforeAll(() => { aparcados = aparcarEnlacesVigentes(); desde = marcaE2e() })
test.afterAll(() => {
  try { limpiarReservasE2e(desde) } finally { devolverEnlaces(aparcados) }
})

const RUTA = '/agenda/configuracion'

function idDe(correo: string): string {
  return sqlLocal(`select id from auth.users where email = :'c'`, { c: correo })
}
/** Los enlaces del médico creados en este archivo (los de antes, p. ej. hechos a mano, no cuentan). */
function enlacesDe(medicoId: string): string[] {
  return sqlLocal(`select clase || ':' || (revocado_en is null)::text || ':' || coalesce(vigencia_dias::text, '-')
                     from public.reserva_enlaces where medico_id = :'m' and created_at >= :'d'::timestamptz order by created_at`,
  { m: medicoId, d: desde }).split('\n').filter(Boolean)
}
async function abrir(page: Page): Promise<void> {
  await page.goto(RUTA)
  await expect(page.getByRole('heading', { name: 'Enlaces de reserva' })).toBeVisible()
}

test.afterEach(() => {
  limpiarReservasE2e(desde)
  interruptorAgenda('A', false)
})

test('con el interruptor apagado, las rutas de gestión dan 404', async ({ page }) => {
  const cita = '00000000-0000-4000-8000-000000000001'
  expect((await page.request.get('/api/agenda/enlaces')).status()).toBe(404)
  expect((await page.request.post('/api/agenda/enlaces', { data: { clase: 'fijo', medico_id: idDe(CORREO.adminA) } })).status()).toBe(404)
  expect((await page.request.patch(`/api/agenda/enlaces/${cita}`, { data: { accion: 'revocar' } })).status()).toBe(404)
  expect((await page.request.get('/api/agenda/reservas/contactos')).status()).toBe(404)
  expect((await page.request.get(`/api/agenda/reservas/historial?cita=${cita}`)).status()).toBe(404)
  expect(sqlLocal(`select count(*) from public.reserva_enlaces
                     where clinica_id in (select id from public.clinicas where nombre = 'Clínica Semilla A')
                       and created_at >= :'d'::timestamptz`, { d: desde })).toBe('0')
})

test('el administrador crea, muestra, regenera y revoca el enlace fijo de un médico', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrir(page)
  /* El administrador ve un bloque por médico (él y el invitado); se usa el primero. */
  await page.getByRole('button', { name: 'Crear enlace fijo' }).first().click()
  const direccion = page.getByRole('textbox', { name: 'Dirección de Enlace fijo' })
  await expect(direccion).toHaveValue(/\/reservar\/[A-Za-z0-9_-]{22}$/)
  const primera = await direccion.inputValue()

  await page.reload()
  await page.getByRole('button', { name: 'Mostrar Enlace fijo' }).first().click()
  await expect(page.getByRole('textbox', { name: 'Dirección de Enlace fijo' }).first()).toHaveValue(primera)

  await page.getByRole('button', { name: 'Regenerar Enlace fijo' }).first().click()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(page.getByRole('textbox', { name: 'Dirección de Enlace fijo' }).first()).not.toHaveValue(primera)
  const todos = [...enlacesDe(idDe(CORREO.medicoA)), ...enlacesDe(idDe(CORREO.adminA))]
  expect(todos.filter(e => e.startsWith('fijo:'))).toEqual(expect.arrayContaining(['fijo:false:-', 'fijo:true:-']))

  await page.getByRole('button', { name: 'Revocar Enlace fijo' }).first().click()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(page.getByText('Enlace revocado')).toBeVisible()
  expect(todos.length).toBe(2)
})

test('un enlace de un solo uso nace con la vigencia del ajuste y se revoca', async ({ page }) => {
  interruptorAgenda('A', true)
  const res = await page.request.post('/api/agenda/enlaces', { data: { clase: 'unico', medico_id: idDe(CORREO.adminA), etiqueta: 'Sra. Prueba' } })
  expect(res.status()).toBe(201)
  const { enlace, codigo } = await res.json() as { enlace: { id: string; vigencia_dias: number; caduca_en: string }; codigo: string }
  expect(codigo).toMatch(/^[A-Za-z0-9_-]{22}$/)
  expect(enlace.vigencia_dias).toBe(7)
  const dias = (new Date(enlace.caduca_en).getTime() - Date.now()) / 86_400_000
  expect(dias).toBeGreaterThan(6.9)
  expect(dias).toBeLessThan(7.1)
  /* Un cuerpo con la vigencia o la clínica se rechaza: las pone la base. */
  expect((await page.request.post('/api/agenda/enlaces', { data: { clase: 'unico', medico_id: idDe(CORREO.adminA), vigencia_dias: 30 } })).status()).toBe(400)

  await abrir(page)
  await expect(page.getByText('Un solo uso · Sra. Prueba')).toBeVisible()
  expect((await page.request.get(`/api/agenda/enlaces/${enlace.id}`)).ok()).toBeTruthy()
  expect((await page.request.patch(`/api/agenda/enlaces/${enlace.id}`, { data: { accion: 'revocar' } })).ok()).toBeTruthy()
  expect((await page.request.get(`/api/agenda/enlaces/${enlace.id}`)).status()).toBe(410)
  expect((await page.request.patch(`/api/agenda/enlaces/${enlace.id}`, { data: { accion: 'revocar' } })).status()).toBe(404)
})

test('el médico invitado sólo gestiona sus enlaces', async ({ browser }) => {
  interruptorAgenda('A', true)
  await enContextoNuevo(browser, SESION.medicoA, async (page) => {
    const propio = await page.request.post('/api/agenda/enlaces', { data: { clase: 'unico', medico_id: idDe(CORREO.medicoA) } })
    expect(propio.status()).toBe(201)
    const ajeno = await page.request.post('/api/agenda/enlaces', { data: { clase: 'fijo', medico_id: idDe(CORREO.adminA) } })
    expect(ajeno.status()).toBe(403)
    const lista = await (await page.request.get('/api/agenda/enlaces')).json() as { enlaces: { medico_id: string }[] }
    expect(lista.enlaces.every(e => e.medico_id === idDe(CORREO.medicoA))).toBe(true)
    await page.goto(RUTA)
    await expect(page.getByRole('heading', { name: 'Enlaces de reserva' })).toBeVisible()
    /* Acotado a la sección: «un solo uso» también sale en la de ajustes
       («Vigencia del enlace de un solo uso»). */
    await expect(page.getByRole('region', { name: 'Enlaces de reserva' }).getByText('Un solo uso', { exact: true })).toBeVisible()
  })
})

test('un contacto bloqueado sale en la lista y se desbloquea a mano', async ({ page }) => {
  interruptorAgenda('A', true)
  const inicio = new Date(Date.now() + 5 * 86_400_000)
  inicio.setUTCHours(16, 0, 0, 0)
  const c = crearCitaPorLigar({ correo: CORREO.medicoA, inicio: inicio.toISOString(), minutos: 30, nombre: 'Persona Bloqueada E2E', canal: 'fijo' })
  bloquearContactoE2e(c)
  await abrir(page)
  const fila = page.locator('li', { hasText: 'Persona Bloqueada E2E' })
  await expect(fila).toContainText('Bloqueado a mano')
  await fila.getByRole('button', { name: /Desbloquear/ }).click()
  await expect(page.getByText('No hay contactos bloqueados.')).toBeVisible()
  expect(sqlLocal(`select count(*) from public.reserva_contactos where medico_id = :'m' and perdonado_en is not null`, { m: c.medicoId })).toBe('2')
})
