import { test, expect, request, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { soloEscritorio, sqlLocal } from './ayudas'
import { codigoDe, esperarCorreo } from './mailpit'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import {
  baseUrlPublica, cerrarEscenario, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, primerTurnoDeLaSemanaSiguiente,
  type Escenario,
} from './reservaPublicaAyudas'

/**
 * Agente S (orden de Angel, 2026-11-23): los topes por IP y dispositivo de
 * `POST /api/reservar/[codigo]` sólo cuentan con el enlace FIJO (IP 30 y
 * dispositivo 8 por hora; antes 6 y 4 para los dos). El ÚNICO vigente no
 * cuenta. Lo que no abre y el único no vigente cuentan en «sondeo» (los
 * mismos números); con el sondeo lleno, TODO código da 429 sin abrirse.
 *
 * Caso de Angel (reproducido en la base local antes del cambio): una reserva
 * con el fijo y, desde el MISMO navegador, dos únicos; el segundo único dio
 * «demasiados intentos, 56 minutos» (el dispositivo llevaba 4 POST: el fijo y
 * tres del primer único). Aquí: el fijo y cuatro únicos, todos por la página.
 *
 * Contra :3001, Mailpit y la base local. Sólo `escritorio`. Citas en la semana
 * siguiente (AG-DT-256); `limpiarReservasE2e` quita lo creado.
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()

let e: Escenario
let desde = ''
test.beforeAll(() => { desde = marcaE2e(); e = prepararEscenario() })
test.afterAll(() => { limpiarReservasE2e(desde); sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId }); cerrarEscenario() })

const listo = (p: Page) => p.getByRole('heading', { name: 'Tu cita quedó agendada' })

async function contexto(browser: Browser, ip: string): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ip }, locale: 'es-MX', timezoneId: 'America/Merida', baseURL: baseUrlPublica() })
}

/** De «Lugar» a «Tus datos» con el primer turno libre de la semana siguiente, y los datos escritos. */
async function hastaDatos(p: Page, codigo: string, persona: { nombre: string; telefono: string; correo?: string }): Promise<void> {
  await p.goto(`/reservar/${codigo}`)
  await p.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = p.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await p.getByRole('button', { name: 'Elegir día y hora' }).click()
  await primerTurnoDeLaSemanaSiguiente(p)
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByLabel('Nombre completo').fill(persona.nombre)
  await p.getByLabel('Teléfono (10 dígitos)').fill(persona.telefono)
  if (persona.correo) await p.getByLabel('Correo electrónico').fill(persona.correo)
  await p.getByRole('checkbox').check()
}

async function reservarConFijo(p: Page, codigo: string): Promise<void> {
  const persona = personaNueva()
  await hastaDatos(p, codigo, persona)
  await p.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await p.getByLabel('Código', { exact: true }).fill(codigoDe((await esperarCorreo(persona.correo, 'Tu código para reservar', 0)).texto))
  await p.getByRole('button', { name: 'Verificar y reservar' }).click()
  await expect(listo(p)).toBeVisible()
}

async function reservarConUnico(p: Page, codigo: string): Promise<void> {
  await hastaDatos(p, codigo, { ...personaNueva(), correo: undefined })
  await p.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(listo(p)).toBeVisible()
}

test('caso de Angel: tras reservar con el fijo, cuatro únicos seguidos desde el mismo navegador reservan todos', async ({ browser }) => {
  const ctx = await contexto(browser, ipAlAzar())
  const p = await ctx.newPage()
  await reservarConFijo(p, emitirEnlace(e, 'fijo').codigo)
  const disp = (await ctx.cookies()).find(c => c.name === 'sp_rdisp')?.value
  expect(disp, 'el navegador guarda su cookie de dispositivo').toMatch(/^[A-Za-z0-9_-]{32}$/)
  for (let i = 0; i < 4; i++) await reservarConUnico(p, emitirEnlace(e, 'unico').codigo)
  // El mismo dispositivo todo el tiempo (si cambiara, la prueba no probaría el tope por dispositivo).
  expect((await ctx.cookies()).find(c => c.name === 'sp_rdisp')?.value).toBe(disp)
  await ctx.close()
})

/** POST de reservar con un cuerpo vacío: cuenta los topes del fijo y sale 400 antes del tope por enlace. */
async function postVacio(codigo: string, ip: string, cookieDisp?: string): Promise<number> {
  const api = await request.newContext({ baseURL: baseUrlPublica() })
  try {
    const headers: Record<string, string> = { 'x-forwarded-for': ip, ...(cookieDisp ? { cookie: `sp_rdisp=${cookieDisp}` } : {}) }
    return (await api.post(`/api/reservar/${codigo}`, { data: {}, headers })).status()
  } finally {
    await api.dispose()
  }
}

test('el fijo sigue frenando: el POST 31 desde una IP y el 9 desde un dispositivo dan 429', async () => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const ip = ipAlAzar()
  const porIp: number[] = []
  for (let i = 0; i < 31; i++) porIp.push(await postVacio(codigo, ip))
  expect(porIp).toEqual([...Array<number>(30).fill(400), 429])
  // Desde otra IP y otro dispositivo el mismo fijo sigue abierto (no era su tope por enlace).
  expect(await postVacio(codigo, ipAlAzar())).toBe(400)

  const disp = randomBytes(24).toString('base64url')
  const porDisp: number[] = []
  for (let i = 0; i < 9; i++) porDisp.push(await postVacio(codigo, ipAlAzar(), disp))
  expect(porDisp).toEqual([...Array<number>(8).fill(400), 429])
})

test('sondeo: 30 códigos que no abren dan 404; el 31 da 429 también con un único válido (sin oráculo)', async () => {
  const ip = ipAlAzar()
  const estados: number[] = []
  for (let i = 0; i < 30; i++) estados.push(await postVacio(randomBytes(16).toString('base64url').slice(0, 22), ip))
  expect(estados).toEqual(Array<number>(30).fill(404))
  const { codigo } = emitirEnlace(e, 'unico')
  expect(await postVacio(codigo, ip)).toBe(429)
  // El mismo único, desde otra IP: abre (400 por el cuerpo vacío, sin contar nada).
  expect(await postVacio(codigo, ipAlAzar())).toBe(400)
})
