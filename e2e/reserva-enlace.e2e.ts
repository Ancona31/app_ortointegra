import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { interruptorAgenda, sqlLocal, soloEscritorio } from './ayudas'
import { desplazarFecha, hoyEnTZ } from '../src/lib/dates'
import { codigoDe, contarCorreos, esperarCorreo } from './mailpit'
import {
  aprobarAviso, api, cancelarCita, cerrarEscenario, citaDe, citasEnTurno, emitirEnlace, ipAlAzar, personaNueva,
  prepararEscenario, reservar, turnosLibres, verificarCorreo, type Escenario, type Turno,
} from './reservaPublicaAyudas'

/**
 * Reserva por enlace, de punta a punta (agenda D10, casos 1-3 y 5-8 de
 * plan_D.md). Sin sesión: la página y la API públicas contra :3001, el correo
 * capturado en Mailpit (EMAIL_TRANSPORT=captura) y la base local para
 * preparar y comprobar. El candado (caso 4) va en reserva-candado.e2e.ts.
 *
 * Requiere en .env.local: EMAIL_TRANSPORT=captura, RESERVA_SECRETO y
 * RESERVA_AVISO_BORRADOR_LOCAL=1 (el aviso es un borrador; la base exige
 * igualmente su hash aprobado, que aprueba `prepararEscenario`).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
// La página también sale con una IP inventada: sin ella, todas las corridas
// comparten la de localhost y se comen los límites por IP de la hora.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let libres: Turno[] = []
let siguiente = 0
const DENTRO_DE_UNA_SEMANA = desplazarFecha(hoyEnTZ('America/Merida'), { dias: 7 })
/** Un turno libre que ninguna otra prueba de este archivo usa. */
function turno(): string {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana elegida')
  return t.inicio
}

test.beforeAll(async () => {
  e = prepararEscenario()
  const { codigo } = emitirEnlace(e, 'unico')
  // Desde dentro de 3 semanas: la prueba de la página toma el primer turno de la
  // semana siguiente y no debe chocar con estos.
  libres = await turnosLibres(e, codigo, 21)
})
test.afterAll(() => { cerrarEscenario() })

test('flujo completo con el enlace fijo: código leído de Mailpit, reserva y comprobante sin datos clínicos', async ({ page }) => {
  const { codigo, id: enlaceId } = emitirEnlace(e, 'fijo')
  const p = personaNueva()
  await page.goto(`/reservar/${codigo}`)
  await expect(page.getByRole('heading', { name: /Reservar cita con/ })).toBeVisible()
  await page.getByLabel('Consultorio').selectOption(e.consultorioId)
  await page.getByLabel('Tipo de cita').selectOption(e.tipoId)
  await page.getByRole('button', { name: 'Semana siguiente' }).click()
  const boton = page.locator('button[data-inicio]').first()
  await expect(boton).toBeVisible()
  const inicio = await boton.getAttribute('data-inicio')
  await boton.click()
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByLabel('Correo electrónico').fill(p.correo)
  await expect(page.getByRole('button', { name: 'Enviar código a mi correo' })).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  const correoCodigo = await esperarCorreo(p.correo, 'Tu código para reservar')
  await page.getByLabel('Código').fill(codigoDe(correoCodigo.texto))
  await page.getByRole('button', { name: 'Verificar y reservar' }).click()
  await expect(page.getByText('Tu cita quedó agendada')).toBeVisible()

  const cita = citaDe(p.correo)
  expect(cita).toMatchObject({ status: 'scheduled', pacienteNulo: true, canal: 'fijo', title: p.nombre })
  expect(citasEnTurno(e, inicio ?? '')).toHaveLength(1)

  // El comprobante (D8), capturado: sin el tipo de cita, sin el teléfono de la persona, sin notas.
  const comprobante = await esperarCorreo(p.correo, 'Tu cita con')
  // E5: ahora lleva el enlace de confirmación de la cita, en vez de «comunícate con el consultorio».
  expect(comprobante.texto).toMatch(/\/confirmar\/[A-Za-z0-9_-]{22}(\s|$)/)
  for (const cuerpo of [comprobante.texto, comprobante.html, comprobante.asunto]) {
    expect(cuerpo).not.toContain(e.tipoNombre)
    expect(cuerpo).not.toContain(p.telefono)
    expect(cuerpo).not.toContain('Consulta:')
  }
  // Y el HTML de la página no llevó ids internos ni el horario crudo.
  const html = await page.content()
  for (const interno of [e.clinicaId, e.medicoId, enlaceId, 'horario_propio']) expect(html).not.toContain(interno)
})

test('dos reservas simultáneas al mismo turno: una 201, otra 409, y una sola cita', async () => {
  const a = emitirEnlace(e, 'unico')
  const b = emitirEnlace(e, 'unico')
  const inicio = turno()
  const [ra, rb] = await Promise.all([
    reservar(e, a.codigo, { inicio, persona: personaNueva() }),
    reservar(e, b.codigo, { inicio, persona: personaNueva() }),
  ])
  expect([ra.status, rb.status].sort()).toEqual([201, 409])
  expect([ra.cuerpo.error, rb.cuerpo.error]).toContain('turno_ocupado')
  expect(citasEnTurno(e, inicio)).toHaveLength(1)
})

test('el mismo envío repetido (mismo client_id) devuelve la misma cita', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const envio = { inicio: turno(), persona: personaNueva(), clientId: randomUUID() }
  expect((await reservar(e, codigo, envio)).status).toBe(201)
  expect((await reservar(e, codigo, envio)).status).toBe(200)
  expect(citasEnTurno(e, envio.inicio)).toHaveLength(1)
})

test('enlace único usado o caducado: «no disponible» en la página y 410 en la API', async ({ page }) => {
  const usado = emitirEnlace(e, 'unico')
  expect((await reservar(e, usado.codigo, { inicio: turno(), persona: personaNueva() })).status).toBe(201)
  const otra = await reservar(e, usado.codigo, { inicio: turno(), persona: personaNueva() })
  expect(otra).toMatchObject({ status: 410, cuerpo: { error: 'enlace_usado' } })
  await page.goto(`/reservar/${usado.codigo}`)
  await expect(page.getByText('Este enlace ya no está disponible')).toBeVisible()

  const viejo = emitirEnlace(e, 'unico')
  sqlLocal(`update public.reserva_enlaces set caduca_en = now() - interval '1 minute' where id = :'id';`, { id: viejo.id })
  await page.goto(`/reservar/${viejo.codigo}`)
  await expect(page.getByText('Este enlace ya no está disponible')).toBeVisible()
  const r = await reservar(e, viejo.codigo, { inicio: turno(), persona: personaNueva() })
  expect(r).toMatchObject({ status: 410, cuerpo: { error: 'enlace_caducado' } })
})

test('verificación: cinco códigos erróneos agotan; sin ficha no reserva; la ficha no sirve dos veces', async () => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const p = personaNueva()
  const ctx = await api()
  try {
    const previos = await contarCorreos(p.correo, 'Tu código para reservar')
    expect((await ctx.post(`/api/reservar/${codigo}/codigo`, { data: { correo: p.correo } })).status()).toBe(200)
    const bueno = codigoDe((await esperarCorreo(p.correo, 'Tu código para reservar', previos)).texto)
    const malo = bueno === '000000' ? '111111' : '000000'
    const estados: number[] = []
    for (let i = 0; i < 5; i++) {
      estados.push((await ctx.post(`/api/reservar/${codigo}/verificar`, { data: { correo: p.correo, codigo: malo } })).status())
    }
    expect(estados).toEqual([400, 400, 400, 400, 429])
    const tarde = await ctx.post(`/api/reservar/${codigo}/verificar`, { data: { correo: p.correo, codigo: bueno } })
    expect(tarde.status()).toBe(429)
  } finally {
    await ctx.dispose()
  }
  const sinFicha = await reservar(e, codigo, { inicio: turno(), persona: p })
  expect(sinFicha).toMatchObject({ status: 403, cuerpo: { error: 'correo_sin_verificar' } })

  const q = personaNueva()
  const ficha = await verificarCorreo(codigo, q.correo)
  expect((await reservar(e, codigo, { inicio: turno(), persona: q, ficha })).status).toBe(201)
  cancelarCita(citaDe(q.correo)?.id ?? '')
  const otraVez = await reservar(e, codigo, { inicio: turno(), persona: q, ficha })
  expect(otraVez).toMatchObject({ status: 403, cuerpo: { error: 'correo_sin_verificar' } })
})

test('interruptor apagado o aviso sin aprobar: el mismo 404 que un enlace inventado', async ({ page }) => {
  const { codigo } = emitirEnlace(e, 'unico')
  const inventado = 'AAAAAAAAAAAAAAAAAAAAAA'
  const ctx = await api()
  try {
    const turnos = `consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${DENTRO_DE_UNA_SEMANA}`
    const cuerpoInventado = await (await ctx.get(`/api/reservar/${inventado}/turnos?${turnos}`)).json()
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(200)

    interruptorAgenda('A', false)
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(404)
    const apagado = await ctx.get(`/api/reservar/${codigo}/turnos?${turnos}`)
    expect(apagado.status()).toBe(404)
    expect(await apagado.json()).toEqual(cuerpoInventado)
    expect((await reservar(e, codigo, { inicio: turno(), persona: personaNueva() })).status).toBe(404)
    interruptorAgenda('A', true)

    aprobarAviso(false)
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(404)
    expect((await ctx.get(`/api/reservar/${codigo}/turnos?${turnos}`)).status()).toBe(404)
  } finally {
    interruptorAgenda('A', true)
    aprobarAviso(true)
    await ctx.dispose()
  }
  expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(200)
})

test('datos expuestos: los turnos sólo llevan fecha, inicio y fin; un consultorio de otra clínica es 400', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const ctx = await api()
  try {
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${DENTRO_DE_UNA_SEMANA}`)
    const datos: Record<string, unknown> = await r.json()
    expect(Object.keys(datos)).toEqual(['dias'])
    const dias = Array.isArray(datos.dias) ? datos.dias : []
    for (const d of dias) {
      expect(Object.keys(d).sort()).toEqual(['fecha', 'turnos'])
      for (const t of d.turnos) expect(Object.keys(t).sort()).toEqual(['fin', 'inicio'])
    }
    const ajeno = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioOtraClinica}&tipo=${e.tipoId}&desde=${DENTRO_DE_UNA_SEMANA}`)
    expect(ajeno.status()).toBe(400)
    const extra = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${DENTRO_DE_UNA_SEMANA}&medico=x`)
    expect(extra.status()).toBe(400)
  } finally {
    await ctx.dispose()
  }
  const otra = await reservar(e, codigo, { inicio: turno(), persona: personaNueva() })
  expect(otra.status).toBe(201)
})

test('límite: el séptimo POST de reservar desde la misma IP en una hora da 429', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const ip = ipAlAzar()
  const estados: number[] = []
  for (let i = 0; i < 7; i++) {
    const ctx = await api(ip)   // contexto nuevo: dispositivo nuevo; la IP es la que se repite
    // Un inicio que no es turno (no alineado): consume el límite y sale 400 sin reservar.
    estados.push((await reservar(e, codigo, { inicio: '2031-01-07T15:07:00.000Z', persona: personaNueva() }, ctx)).status)
    await ctx.dispose()
  }
  expect(estados).toEqual([400, 400, 400, 400, 400, 400, 429])
})
