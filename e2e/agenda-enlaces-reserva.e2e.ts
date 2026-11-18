import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal, enContextoNuevo } from './ayudas'
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
 *
 * Tanda J (J5): la pantalla es la de las maquetas. El enlace fijo propio es el
 * interruptor de «Tu enlace» (prenderlo = crearlo; la dirección se enseña sola
 * = «Mostrar»; «Cambiar por uno nuevo» = «Regenerar»; apagarlo = «Revocar»);
 * los de una vez, «Enlaces de una vez»; los bloqueados, «Más opciones ›
 * Personas bloqueadas». Para ver las pestañas y no el funnel, el médico tiene
 * antes su duración y su horario confirmado (`sinPendientesAgenda`).
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
/** Tanda H, punto 5: la sección va en su pestaña. */
async function abrir(page: Page, pestana = 'Tu enlace'): Promise<void> {
  await page.goto(RUTA)
  await pestanaConfig(page, pestana)
  await expect(page.getByRole('tabpanel', { name: pestana })).toBeVisible()
}

/** Lo de `sinPendientesAgenda`, deshecho al terminar cada prueba. */
let deshacer: Array<() => void> = []
test.afterEach(() => {
  try { for (const d of deshacer) d() } finally {
    deshacer = []
    limpiarReservasE2e(desde)
    interruptorAgenda('A', false)
  }
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
  deshacer.push(sinPendientesAgenda(CORREO.adminA, { conEnlace: false }))
  await abrir(page)
  const panel = page.getByRole('tabpanel', { name: 'Tu enlace' })
  const direccion = panel.locator('[data-enlace-fijo]')
  /* Crear: prender el interruptor. */
  await panel.getByRole('switch', { name: /^Apagado/ }).click()
  await expect(direccion).toHaveText(/\/reservar\/[A-Za-z0-9_-]{22}$/)
  const primera = await direccion.textContent()

  /* Mostrar: al volver, la misma dirección, sin pedirla. */
  await abrir(page)
  await expect(direccion).toHaveText(primera ?? '')

  /* Regenerar: «Cambiar por uno nuevo», con confirmación. */
  await panel.getByRole('button', { name: 'Cambiar por uno nuevo' }).click()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(direccion).toHaveText(/\/reservar\/[A-Za-z0-9_-]{22}$/)
  await expect(direccion).not.toHaveText(primera ?? '')
  const todos = [...enlacesDe(idDe(CORREO.medicoA)), ...enlacesDe(idDe(CORREO.adminA))]
  expect(todos.filter(e => e.startsWith('fijo:'))).toEqual(expect.arrayContaining(['fijo:false:-', 'fijo:true:-']))

  /* Revocar: apagar el interruptor, con confirmación. */
  await panel.getByRole('switch', { name: /^Prendido/ }).click()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(panel.getByRole('switch', { name: /^Apagado/ })).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('[data-aviso-config]')).toHaveText('Guardado')
  expect(enlacesDe(idDe(CORREO.adminA))).toEqual(['fijo:false:-', 'fijo:false:-'])
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

  deshacer.push(sinPendientesAgenda(CORREO.adminA))
  await abrir(page)
  await expect(page.getByRole('group', { name: 'Sra. Prueba' })).toContainText('Sin usar · deja de servir el')
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
    deshacer.push(sinPendientesAgenda(CORREO.medicoA))
    await abrir(page)
    /* El suyo, sin etiqueta, en «Enlaces de una vez»; ni rastro de los de los demás. */
    const panel = page.getByRole('tabpanel', { name: 'Tu enlace' })
    await expect(panel.getByRole('group', { name: 'Sin nombre' })).toContainText('Sin usar')
    await expect(panel.getByRole('button', { name: /Enlaces de los demás médicos/ })).toHaveCount(0)
  })
})

test('un contacto bloqueado sale en la lista y se desbloquea a mano', async ({ page }) => {
  interruptorAgenda('A', true)
  const inicio = new Date(Date.now() + 5 * 86_400_000)
  inicio.setUTCHours(16, 0, 0, 0)
  const c = crearCitaPorLigar({ correo: CORREO.medicoA, inicio: inicio.toISOString(), minutos: 30, nombre: 'Persona Bloqueada E2E', canal: 'fijo' })
  bloquearContactoE2e(c)
  deshacer.push(sinPendientesAgenda(CORREO.adminA))
  await abrir(page, 'Más opciones')
  await page.getByRole('button', { name: /^Personas bloqueadas/ }).click()
  const fila = page.getByRole('tabpanel', { name: 'Más opciones' }).locator('div', { hasText: 'Persona Bloqueada E2E' }).last()
  await expect(fila).toContainText('Bloqueado a mano')
  await fila.getByRole('button', { name: /Desbloquear/ }).click()
  await expect(page.getByText('Nadie está bloqueado.')).toBeVisible()
  expect(sqlLocal(`select count(*) from public.reserva_contactos where medico_id = :'m' and perdonado_en is not null`, { m: c.medicoId })).toBe('2')
})
