import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { soloEscritorio, sqlLocal } from './ayudas'
import { codigoDe, contarCorreos, esperarCorreo } from './mailpit'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import { api, cerrarEscenario, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, type Escenario } from './reservaPublicaAyudas'
import { hmacRed } from '../src/lib/reserva/secretos'

/**
 * K2 · puntos 9 y 10 de Angel: el código del correo de la reserva por enlace
 * fijo. Contra :3001, Mailpit y la base local. Sólo `escritorio`.
 *
 * Punto 10, la causa (reproducida antes de tocar nada, con estos caminos): la
 * página no guardaba nada —recargar, ir atrás y adelante u otra pestaña
 * volvían a «Lugar»— y volver a «Tus datos» y avanzar pedía OTRO código. Cada
 * código gasta del tope de 3 por correo por hora (y de los de IP y
 * dispositivo) e invalida el anterior, que luego contaba como equivocado: de
 * ahí «Demasiados intentos». Y si la reserva fallaba DESPUÉS de verificar, el
 * reintento volvía a verificar el mismo código (ya de un uso) y salía «Pide un
 * código primero».
 *
 * MUTACIONES (comprobadas en rojo, una a una, con el servidor reconstruido):
 * sin guardar en `sessionStorage` (`guardar` vacío) → «recargar» y «atrás y
 * adelante»; `alEnviarDatos` sin `codigoPendiente` → «volver y avanzar»; sin
 * reusar la ficha en `verificarYReservar` → «la reserva falla después de
 * verificar»; sin leer `#codigo=` → las dos de «Continuar mi reserva».
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()

const ASUNTO = 'Tu código para reservar'
const BASE = 'http://localhost:3001'
let e: Escenario
let desde = ''
let fijo = ''
test.beforeAll(() => { desde = marcaE2e(); e = prepararEscenario(); fijo = emitirEnlace(e, 'fijo').codigo })
test.afterAll(() => { limpiarReservasE2e(desde); sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId }); cerrarEscenario() })

async function contexto(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() }, locale: 'es-MX', timezoneId: 'America/Merida', baseURL: BASE })
}
async function pagina(browser: Browser): Promise<Page> {
  return (await contexto(browser)).newPage()
}
const alerta = (p: Page) => p.locator('.rp-tarjeta').getByRole('alert')
const campoCodigo = (p: Page) => p.getByLabel('Código', { exact: true })
const listo = (p: Page) => p.getByRole('heading', { name: 'Tu cita quedó agendada' })

async function hastaDatos(p: Page): Promise<void> {
  await p.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = p.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await p.getByRole('button', { name: 'Elegir día y hora' }).click()
  await p.locator('button[data-inicio]').first().click()
  await p.getByRole('button', { name: 'Continuar' }).click()
}
async function llenar(p: Page, persona: { nombre: string; telefono: string; correo?: string }): Promise<void> {
  await p.getByLabel('Nombre completo').fill(persona.nombre)
  await p.getByLabel('Teléfono (10 dígitos)').fill(persona.telefono)
  if (persona.correo) await p.getByLabel('Correo electrónico').fill(persona.correo)
  await p.getByRole('checkbox').check()
}
/** De «Lugar» hasta el campo del código, con un correo nuevo. */
async function hastaCodigo(p: Page, persona: { nombre: string; telefono: string; correo: string }): Promise<void> {
  await p.goto(`/reservar/${fijo}`)
  await hastaDatos(p)
  await llenar(p, persona)
  await p.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await expect(campoCodigo(p)).toBeVisible()
}
async function verificar(p: Page, codigo?: string): Promise<void> {
  if (codigo) await campoCodigo(p).fill(codigo)
  await p.getByRole('button', { name: 'Verificar y reservar' }).click()
  await expect(p.getByRole('button', { name: 'Verificar y reservar' }).or(listo(p))).toBeEnabled()
}
async function codigoN(correo: string, previos: number): Promise<string> {
  return codigoDe((await esperarCorreo(correo, ASUNTO, previos)).texto)
}
/** Pasan 31 s para los 30 s entre códigos (la base cuenta desde `created_at` del último emitido). */
function pasan31s(): void {
  sqlLocal(`update public.reserva_verificaciones set created_at = created_at - interval '31 seconds' where created_at >= :'d'::timestamptz`, { d: desde })
}
/** Llena el tope de `accion` de ESTE dispositivo (la cookie `sp_rdisp`), como si hubiera probado mucho esta hora. */
async function topeDeDispositivo(p: Page, accion: 'codigo' | 'reservar', n: number): Promise<string> {
  const disp = (await p.context().cookies()).find(c => c.name === 'sp_rdisp')?.value ?? ''
  const llave = `reserva:${accion}:disp:${hmacRed('dispositivo', disp) ?? ''}`
  sqlLocal(`insert into public.ip_rate_limits (ip, ruta) select 'reserva', :'r' from generate_series(1, :'n'::int)`, { r: llave, n: String(n) })
  return llave
}

test('reenviar: cuenta regresiva de 30 s que da el servidor; dentro de ella no sale código ni se gasta el tope por correo', async ({ browser }) => {
  const p = await pagina(browser)
  await p.clock.install()
  const persona = personaNueva()
  await hastaCodigo(p, persona)
  const reenviar = p.getByRole('button', { name: /^Enviar otro código/ })
  await expect(reenviar).toHaveText(/^Enviar otro código en (30|29|28) s$/)
  await expect(reenviar).toBeDisabled()
  // El servidor lo impone (no sólo la página): otro pedido con la misma cookie, dentro de los 30 s.
  const r = await p.context().request.post(`/api/reservar/${fijo}/codigo`, { data: { correo: persona.correo } })
  expect(r.status()).toBe(429)
  const cuerpo: { error?: string; espera_s?: number } = await r.json()
  expect(cuerpo.error).toBe('espera_reenvio')
  expect(cuerpo.espera_s).toBeGreaterThan(0)
  expect(cuerpo.espera_s).toBeLessThanOrEqual(30)
  expect(r.headers()['retry-after']).toBe(String(cuerpo.espera_s))
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(1)
  // Pasados 30 s: el botón vuelve y otro código sale. El 429 de antes no gastó el tope de 3: caben dos más.
  for (const n of [2, 3]) {
    pasan31s()
    await p.clock.fastForward(31_000)
    await expect(reenviar).toHaveText('Enviar otro código')
    await reenviar.click()
    await expect(reenviar).toHaveText(/^Enviar otro código en \d+ s$/)
    await expect.poll(() => contarCorreos(persona.correo, ASUNTO)).toBe(n)
  }
  // El 4.º en la hora: el tope por correo, que no cambia. Va sin plazo: saldría de lo pedido en otros enlaces.
  pasan31s()
  await p.clock.fastForward(31_000)
  await reenviar.click()
  await expect(alerta(p)).toHaveText('Demasiados intentos. Espera un rato y vuelve a probar.')
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(3)
  await p.context().close()
})

test('tope del dispositivo: el mensaje dice cuánto falta, con lo que dijo el servidor', async ({ browser }) => {
  const p = await pagina(browser)
  await p.goto(`/reservar/${fijo}`)
  await hastaDatos(p)
  // La cookie del dispositivo la pone la ruta del código: un pedido sin correo (400) la deja y cuenta 1 de 5.
  expect((await p.context().request.post(`/api/reservar/${fijo}/codigo`, { data: {} })).status()).toBe(400)
  expect(await topeDeDispositivo(p, 'codigo', 4)).toMatch(/:disp:[0-9a-f]{64}$/)
  await llenar(p, personaNueva())
  await p.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await expect(alerta(p)).toHaveText('Demasiados intentos. Podrás volver a probar en 60 min.')
  await p.context().close()
})

test('volver y avanzar: no pide otro código; el del primer correo sirve', async ({ browser }) => {
  const p = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(p, persona)
  const primero = await codigoN(persona.correo, 0)
  // Ni siquiera lo pide (no sólo «el servidor lo frena»): ningún POST a /codigo al volver y avanzar.
  const pedidos: string[] = []
  p.on('request', x => { if (x.url().endsWith('/codigo')) pedidos.push(x.url()) })
  for (let i = 0; i < 3; i++) {
    await p.getByRole('button', { name: 'Volver', exact: true }).click()
    await p.getByRole('checkbox').check()
    await p.getByRole('button', { name: 'Enviar código a mi correo' }).click()
    await expect(campoCodigo(p)).toBeVisible()
  }
  expect(pedidos).toEqual([])
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(1)
  await verificar(p, primero)
  await expect(listo(p)).toBeVisible()
  await p.context().close()
})

test('recargar: vuelve al código sin pedir otro; guarda lo mínimo (sin nombre, teléfono ni código)', async ({ browser }) => {
  const p = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(p, persona)
  const primero = await codigoN(persona.correo, 0)
  const guardado = await p.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
  expect(guardado).toContain(persona.correo)
  for (const nunca of [persona.nombre, persona.telefono, primero]) expect(guardado).not.toContain(nunca)
  expect(await p.evaluate(() => localStorage.length)).toBe(0)
  await p.reload()
  await expect(campoCodigo(p)).toBeVisible()
  await expect(p.getByRole('button', { name: /^Enviar otro código en \d+ s$/ })).toBeDisabled()
  await campoCodigo(p).fill(primero)
  await p.getByRole('button', { name: 'Verificar y reservar' }).click()
  // Tras recargar no hay nombre ni teléfono guardados: se escriben otra vez y reserva con el correo ya verificado.
  await llenar(p, persona)
  await p.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(listo(p)).toBeVisible()
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(1)
  expect(await p.evaluate(() => sessionStorage.length)).toBe(0)
  await p.context().close()
})

test('atrás y adelante del navegador: vuelve al código', async ({ browser }) => {
  const p = await pagina(browser)
  const persona = personaNueva()
  await p.goto('/login')
  await hastaCodigo(p, persona)
  await p.goBack()
  await p.goForward()
  await expect(campoCodigo(p)).toBeVisible()
  await campoCodigo(p).fill(await codigoN(persona.correo, 0))
  await p.getByRole('button', { name: 'Verificar y reservar' }).click()
  await llenar(p, persona)
  await p.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(listo(p)).toBeVisible()
  await p.context().close()
})

test('otra pestaña: no invalida el código de la primera; el de un correo anterior no cuenta como equivocado', async ({ browser }) => {
  const a = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(a, persona)
  const primero = await codigoN(persona.correo, 0)
  // Pestaña nueva del mismo navegador: dentro de los 30 s no sale otro código; va a escribir el que ya llegó.
  const b = await a.context().newPage()
  await b.clock.install()
  await b.goto(`/reservar/${fijo}`)
  await hastaDatos(b)
  await llenar(b, persona)
  await b.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await expect(campoCodigo(b)).toBeVisible()
  await expect(alerta(b)).toHaveText(/^Espera \d+ s para pedir otro código\.$/)
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(1)
  // Pasados 30 s, B pide otro: el de A queda de un correo anterior. Escribirlo lo dice y NO suma equivocado.
  pasan31s()
  await b.clock.fastForward(31_000)
  const r = b.waitForResponse(x => x.url().endsWith('/codigo'))
  await b.getByRole('button', { name: 'Enviar otro código' }).click()
  expect((await r).status()).toBe(200)
  const segundo = await codigoN(persona.correo, 1)
  await verificar(a, primero)
  await expect(alerta(a)).toHaveText('Ese código es de un correo anterior. Escribe el del correo más reciente.')
  expect(sqlLocal(`select intentos from public.reserva_verificaciones where created_at >= :'d'::timestamptz order by created_at desc limit 1`, { d: desde })).toBe('0')
  await verificar(a, segundo)
  await expect(listo(a)).toBeVisible()
  await a.context().close()
})

test('pasar el tiempo: el código vence a los 10 min y se puede pedir otro', async ({ browser }) => {
  const p = await pagina(browser)
  await p.clock.install()
  const persona = personaNueva()
  await hastaCodigo(p, persona)
  const primero = await codigoN(persona.correo, 0)
  sqlLocal(`update public.reserva_verificaciones set caduca_en = now() - interval '1 second', created_at = created_at - interval '11 minutes'
             where created_at >= :'d'::timestamptz and verificado_en is null and caduca_en > now()`, { d: desde })
  await p.clock.fastForward(11 * 60_000)
  await verificar(p, primero)
  await expect(alerta(p)).toHaveText('El código venció. Pide otro.')
  await p.getByRole('button', { name: 'Enviar otro código' }).click()
  await verificar(p, await codigoN(persona.correo, 1))
  await expect(listo(p)).toBeVisible()
  await p.context().close()
})

test('la reserva falla después de verificar: reintentar no vuelve a verificar («Pide un código primero» ya no sale)', async ({ browser }) => {
  const p = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(p, persona)
  const codigo = await codigoN(persona.correo, 0)
  const llave = await topeDeDispositivo(p, 'reservar', 4)
  await verificar(p, codigo)
  await expect(alerta(p)).toHaveText('Demasiados intentos. Podrás volver a probar en 60 min.')
  sqlLocal(`delete from public.ip_rate_limits where ruta = :'r'`, { r: llave })
  const verificaciones: string[] = []
  p.on('request', x => { if (x.url().endsWith('/verificar')) verificaciones.push(x.url()) })
  await verificar(p)
  await expect(listo(p)).toBeVisible()
  expect(verificaciones).toEqual([])
  await p.context().close()
})

test('punto 9 · «Continuar mi reserva» con la pestaña abierta: el código ya puesto, sin reservar ni gastar nada al abrir', async ({ browser }) => {
  const a = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(a, persona)
  const correo = await esperarCorreo(persona.correo, ASUNTO)
  const codigo = codigoDe(correo.texto)
  const href = /href="([^"]*\/reservar\/[^"]*)"[^>]*>Continuar mi reserva</.exec(correo.html)?.[1]?.replace(/&amp;/g, '&') ?? ''
  expect(href).toMatch(new RegExp(`/reservar/${fijo}#codigo=${codigo}$`))
  expect(href).not.toContain('?')
  expect(correo.html).toContain(`>${codigo}<`) // el código sigue visible, por si prefiere teclearlo
  const b = await a.context().newPage()
  const llamadas: string[] = []
  b.on('request', x => { if (x.method() === 'POST') llamadas.push(x.url()) })
  await b.goto(href.replace(/^https?:\/\/[^/]+/, BASE))
  await expect(campoCodigo(b)).toHaveValue(codigo)
  expect(new URL(b.url()).hash).toBe('')
  expect(llamadas).toEqual([])
  // El código recién emitido (el último de la tabla) sigue sin verificar y sin intentos.
  expect(sqlLocal(`select (verificado_en is null) || '|' || intentos from public.reserva_verificaciones
                    where created_at >= :'d'::timestamptz order by created_at desc limit 1`, { d: desde })).toBe('true|0')
  // El traspaso entre pestañas no lleva nombre ni teléfono (revisión de seguridad): se escriben tras verificar.
  await b.getByRole('button', { name: 'Verificar y reservar' }).click()
  await expect(alerta(b)).toHaveText('Tu correo ya está verificado. Completa tus datos para reservar.')
  await llenar(b, persona)
  await b.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(listo(b)).toBeVisible()
  await a.context().close()
})

test('punto 9 · «Continuar mi reserva» sin la pestaña de antes: flujo normal y, al llegar al código, el del correo sin pedir otro', async ({ browser }) => {
  const a = await pagina(browser)
  const persona = personaNueva()
  await hastaCodigo(a, persona)
  const correo = await esperarCorreo(persona.correo, ASUNTO)
  const href = /href="([^"]*\/reservar\/[^"]*)"[^>]*>Continuar mi reserva</.exec(correo.html)?.[1]?.replace(/&amp;/g, '&') ?? ''
  await a.context().close()
  const b = await pagina(browser)
  await b.goto(href.replace(/^https?:\/\/[^/]+/, BASE))
  await hastaDatos(b)
  await llenar(b, persona)
  await b.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await expect(campoCodigo(b)).toHaveValue(codigoDe(correo.texto))
  expect(await contarCorreos(persona.correo, ASUNTO)).toBe(1)
  await verificar(b)
  await expect(listo(b)).toBeVisible()
  await b.context().close()
})

test('seguridad · los 30 s son por enlace: pedir en A no se ve desde B (revisión de seguridad)', async () => {
  const persona = personaNueva()
  const ctx = await api()
  try {
    expect((await ctx.post(`/api/reservar/${fijo}/codigo`, { data: { correo: persona.correo } })).status()).toBe(200)
    expect((await ctx.post(`/api/reservar/${fijo}/codigo`, { data: { correo: persona.correo } })).status()).toBe(429)
    const otro = emitirEnlace(e, 'fijo').codigo // revoca A: es OTRO enlace del mismo médico
    const r = await ctx.post(`/api/reservar/${otro}/codigo`, { data: { correo: persona.correo } })
    expect(r.status()).toBe(200)
    expect(r.headers()['retry-after']).toBeUndefined()
    fijo = otro
  } finally {
    await ctx.dispose()
  }
})
