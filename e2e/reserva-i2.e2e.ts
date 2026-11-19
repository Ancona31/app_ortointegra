import { test, expect, type Page } from '@playwright/test'
import { sqlLocal, interruptorAgenda } from './ayudas'
import { esperarCorreo } from './mailpit'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import {
  api, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario,
} from './reservaPublicaAyudas'

/**
 * Tanda I de la agenda v2, en la página pública de la reserva:
 *
 *   · Punto 2 · el enlace de UN SOLO USO no pide correo ni código: basta el
 *     teléfono; el correo queda opcional. Sin correo, ningún correo sale (ni
 *     comprobante) y la página no dice «Te enviamos el comprobante». El
 *     bloqueo MANUAL por teléfono sigue cortando el único. El fijo no cambia
 *     (`reserva-h1` punto 4, `reserva-seg1`, `reserva-candado`).
 *   · Punto 21 · los correos se presentan a nombre del MÉDICO: el nombre del
 *     remitente es el suyo (la dirección, la de siempre) y la cabecera lleva
 *     su nombre y el consultorio; «Enviado con Spinus» queda al pie.
 *
 * Mailpit es el buzón LOCAL (EMAIL_TRANSPORT=captura): ningún correo real.
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let desde = ''

test.beforeAll(() => {
  desde = marcaE2e()
  e = prepararEscenario()
})
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId })
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})

const MAILPIT = 'http://127.0.0.1:54324'

/** El remitente tal como lo guardó Mailpit (nombre y dirección). */
async function remitenteDe(id: string): Promise<{ nombre: string; direccion: string }> {
  const r = await fetch(`${MAILPIT}/api/v1/message/${id}`)
  const m: { From?: { Name?: string; Address?: string } } = await r.json()
  return { nombre: m.From?.Name ?? '', direccion: m.From?.Address ?? '' }
}

/** Del paso «Lugar» al de «Tus datos», con el primer turno libre. */
async function hastaTusDatos(page: Page, codigo: string): Promise<void> {
  await page.goto(`/reservar/${codigo}`)
  await page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = page.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
  await page.locator('button[data-inicio]').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()
}

const citaPorTelefono = (tel: string): string =>
  sqlLocal(`select coalesce(reserva_correo, '<sin correo>') || '|' || reserva_canal from public.appointments
             where reserva_telefono = :'tel' order by created_at desc limit 1`, { tel })

// Tanda J, punto 3: el único ya NO pide correo (antes, opcional); los correos van al que escribió la clínica.
test('punto 2 (J3): en el único no se pide correo ni código; se reserva sólo con el teléfono y no sale ningún correo', async ({ page }) => {
  const p = personaNueva()
  await hastaTusDatos(page, emitirEnlace(e, 'unico').codigo)
  await expect(page.getByLabel('Nombre completo')).toBeVisible()
  await expect(page.getByLabel(/Correo electrónico/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enviar código a mi correo' })).toHaveCount(0)
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cita quedó agendada' })).toBeVisible()
  await expect(page.getByText('Te enviamos el comprobante por correo.')).toHaveCount(0)
  expect(citaPorTelefono(p.telefono)).toBe('<sin correo>|unico')
})

test('punto 2 (J3): con el correo que escribió la clínica en el único, el comprobante llega ahí (la página no lo dice)', async ({ page }) => {
  const p = personaNueva()
  await hastaTusDatos(page, emitirEnlace(e, 'unico', p.correo).codigo)
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cita quedó agendada' })).toBeVisible()
  await expect(page.getByText('Te enviamos el comprobante por correo.')).toHaveCount(0)
  await esperarCorreo(p.correo, 'Tu cita con')
})

test('punto 2: el fijo sigue pidiendo correo, obligatorio y con código', async ({ page }) => {
  await hastaTusDatos(page, emitirEnlace(e, 'fijo').codigo)
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveAttribute('required', '')
  await expect(page.getByRole('button', { name: 'Enviar código a mi correo' })).toBeVisible()
})

test('punto 2: el bloqueo MANUAL por teléfono corta el único también sin correo; el mismo único sigue siendo de un uso', async () => {
  const p = { ...personaNueva(), correo: '' }
  const unico = emitirEnlace(e, 'unico').codigo
  const [a, b, c] = await turnosLibres(e, unico, 35)
  expect((await reservar(e, unico, { inicio: a?.inicio ?? '', persona: p })).status).toBe(201)
  expect(await reservar(e, unico, { inicio: b?.inicio ?? '', persona: personaNueva() }))
    .toMatchObject({ status: 410, cuerpo: { error: 'enlace_usado' } })
  // La clínica bloquea a mano ese teléfono (la clave de la cita que dejó).
  sqlLocal(`insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
            select clinica_id, medico_id, reserva_tel_hmac, 'telefono', now() from public.appointments
             where reserva_telefono = :'tel' order by created_at desc limit 1
            on conflict (clinica_id, medico_id, clave_hmac) do update set bloqueado_en = now(), perdonado_en = null`, { tel: p.telefono })
  expect(await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: c?.inicio ?? '', persona: p }))
    .toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
})

test('punto 2: sin correo nada intenta escribirle: ni comprobante ni recordatorio quedan registrados para esa cita', async () => {
  const p = { ...personaNueva(), correo: '' }
  const unico = emitirEnlace(e, 'unico').codigo
  const [a] = await turnosLibres(e, unico, 42)
  expect((await reservar(e, unico, { inicio: a?.inicio ?? '', persona: p })).status).toBe(201)
  const cita = sqlLocal(`select id from public.appointments where reserva_telefono = :'tel' order by created_at desc limit 1`, { tel: p.telefono })
  // El evento de Google y el comprobante corren después de responder (D8): se les da tiempo.
  await new Promise(r => setTimeout(r, 2000))
  expect(sqlLocal(`select count(*) from public.cita_correos where appointment_id = :'id'`, { id: cita })).toBe('0')
})

test('punto 21: código y comprobante a nombre del médico (remitente y cabecera); Spinus pequeño al pie', async () => {
  const p = personaNueva()
  // Código del fijo.
  const fijo = emitirEnlace(e, 'fijo').codigo
  const ctx = await api()
  try {
    expect((await ctx.post(`/api/reservar/${fijo}/codigo`, { data: { correo: p.correo, consultorio_id: e.consultorioId } })).status()).toBe(200)
  } finally {
    await ctx.dispose()
  }
  const codigo = await esperarCorreo(p.correo, 'Tu código para reservar')
  // Comprobante del único con el mismo correo.
  const unico = emitirEnlace(e, 'unico').codigo
  const [t] = await turnosLibres(e, unico, 49)
  expect((await reservar(e, unico, { inicio: t?.inicio ?? '', persona: p })).status).toBe(201)
  const comprobante = await esperarCorreo(p.correo, 'Tu cita con')
  const medico = comprobante.asunto.replace('Tu cita con ', '')
  for (const c of [codigo, comprobante]) {
    expect(await remitenteDe(c.id)).toEqual({ nombre: medico, direccion: 'noreply@mail.spinus.com.mx' })
    expect(c.texto.replace(/\r\n/g, '\n').startsWith(`${medico}\n`)).toBe(true) // Mailpit guarda CRLF
    expect(c.texto.trim().endsWith('Enviado con Spinus')).toBe(true)
    expect(c.html.replace(/<[^>]+>/g, '')).toContain('Enviado con Spinus') // M5: «Spinus» en negritas, como la maqueta
  }
})
