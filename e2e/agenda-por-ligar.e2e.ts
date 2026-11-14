import { test, expect, type Page } from '@playwright/test'
import {
  CORREO, SESION, DIA_LABORABLE_LIBRE, interruptorAgenda, irAAgenda, modalCita, soloEscritorio, sqlLocal, toastConTexto,
} from './ayudas'
import { editarDesdeTarjeta } from './interaccionesAyudas'
import { clicEnTarjeta, crearCitaPorLigar, aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e, type CitaPorLigar } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * D6 · La cita POR LIGAR en la agenda (reserva por enlace sin paciente):
 *
 *   · es una cita, no un evento: la tarjeta lleva «Por ligar · N» con la
 *     instantánea del historial, y el modal se abre como «Editar cita» con
 *     quién reservó y su historial EN VIVO;
 *   · bloquear y desbloquear el contacto desde el modal;
 *   · B3: se CANCELA, no se borra. El DELETE directo da 409 (antes, si gastó un
 *     enlace de un solo uso, 500 por la FK), y cancelarla deja su incidencia;
 *   · guardarla sin paciente conserva el título y no manda `paciente_id`;
 *   · con el interruptor APAGADO y una cita así que quedó de cuando estaba
 *     encendido, el DELETE tampoco da 500: 409 y no se borra.
 *
 * Las citas se preparan como `postgres` (`reservaAyudas.ts`): aquí se prueba lo
 * que la clínica hace con una reserva que ya llegó, no cómo llega (D5).
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

const TZ = 'America/Merida'
const NOMBRE = 'Reserva Por Ligar E2E'

test.afterEach(() => {
  limpiarReservasE2e(desde)
  interruptorAgenda('A', false)
})

function cita(hora: string, canal: 'fijo' | 'unico', historial = 0): CitaPorLigar {
  return crearCitaPorLigar({
    correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, hora, TZ), minutos: 30,
    nombre: NOMBRE, canal, historial,
  })
}
const tarjeta = (page: Page) => page.locator('.fc-event', { hasText: NOMBRE })
const estado = (id: string) => sqlLocal(`select coalesce((select status from public.appointments where id = :'id'), 'BORRADA')`, { id })

async function abrirAgendaV2(page: Page): Promise<void> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'encendida')
  /* F3: con v2 las interacciones van en un chunk diferido; un clic antes de que llegue abriría el modal directo. */
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
}

test('encendido: la tarjeta dice «Por ligar · 3» y el modal enseña quién reservó, con su historial en vivo', async ({ page }) => {
  interruptorAgenda('A', true)
  cita('17:00', 'fijo', 3)
  await abrirAgendaV2(page)
  await expect(tarjeta(page)).toHaveCount(1)
  await expect(tarjeta(page).locator('.ag-tarjeta-marca')).toHaveText(/Por ligar · 3/i)
  await expect(tarjeta(page)).not.toHaveClass(/ag-ev-evento/)
  /* La píldora no hace oscilar el tier de la tarjeta (su `ResizeObserver`).
     Primero se deja asentar la entrada de la rejilla: TODAS las tarjetas,
     con o sin píldora y con el interruptor apagado o encendido, bajan ~1 px en
     los primeros ~110 ms (medido el 2026-11-12). Después, en un segundo de
     cuadros la caja no cambia ni se vuelve a montar. */
  expect(await page.evaluate(async (n) => {
    const caja = () => [...document.querySelectorAll('.fc-event')].find(e => e.textContent?.includes(n))
    const rect = (el: Element) => { const b = el.getBoundingClientRect(); return `${b.x},${b.y},${b.width},${b.height}` }
    const cuadro = () => new Promise(r => requestAnimationFrame(r))
    let iguales = 0, previo = ''
    for (let i = 0; i < 120 && iguales < 10; i++) {
      await cuadro()
      const el = caja(); const r = el ? rect(el) : ''
      iguales = r === previo ? iguales + 1 : 0; previo = r
    }
    const primera = caja()
    const vistas = new Set<string>()
    for (let i = 0; i < 60; i++) {
      await cuadro()
      const el = caja()
      if (el !== primera || !el) return 'se volvió a montar'
      vistas.add(rect(el))
    }
    return vistas.size
  }, NOMBRE)).toBe(1)

  const historial = page.waitForResponse(r => r.url().includes('/api/agenda/reservas/historial'))
  await clicEnTarjeta(tarjeta(page))
  await editarDesdeTarjeta(page)
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  expect((await historial).ok()).toBeTruthy()
  await expect(modal.getByText('Reservó por enlace')).toBeVisible()
  await expect(modal.getByText('5512345678 · persona.e2e@ejemplo.test')).toBeVisible()
  await expect(modal.getByText('Sin cancelaciones ni inasistencias recientes con este médico')).toBeVisible()
  await expect(modal.getByPlaceholder('Buscar paciente por nombre o apellido...')).toHaveCount(0)
})

test('encendido: bloquear y desbloquear el contacto desde el modal', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', 'fijo')
  await abrirAgendaV2(page)
  await clicEnTarjeta(tarjeta(page))
  await editarDesdeTarjeta(page)
  const modal = modalCita(page, 'Editar cita')
  /* `exact`: sin él, 'Bloquear contacto' también casa con «Desbloquear
     contacto» (Playwright compara por subcadena sin distinguir mayúsculas), y
     la espera de abajo se cumplía ANTES de que el desbloqueo llegara a la
     base: la consulta siguiente leía 0. */
  await modal.getByRole('button', { name: 'Bloquear contacto', exact: true }).click()
  await expect(modal.getByText('Bloqueado a mano para reservar por el enlace')).toBeVisible()
  expect(sqlLocal(`select count(*) from public.reserva_contactos where medico_id = :'m' and bloqueado_en is not null`, { m: c.medicoId })).toBe('2')
  await modal.getByRole('button', { name: 'Desbloquear contacto', exact: true }).click()
  await expect(modal.getByRole('button', { name: 'Bloquear contacto', exact: true })).toBeVisible()
  expect(sqlLocal(`select count(*) from public.reserva_contactos where medico_id = :'m' and perdonado_en is not null`, { m: c.medicoId })).toBe('2')
})

test('encendido: una cita por ligar que gastó un enlace único se cancela; el DELETE directo da 409', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', 'unico')
  const res = await page.request.delete(`/api/appointments/${c.citaId}`)
  expect(res.status()).toBe(409)
  expect(await res.json()).toMatchObject({ error: 'cita_con_paciente' })
  expect(estado(c.citaId)).toBe('scheduled')

  await abrirAgendaV2(page)
  await clicEnTarjeta(tarjeta(page))
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar cita', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancelar cita', exact: true }).click()
  await expect(toastConTexto(page, 'Se canceló la cita')).toBeVisible()
  await expect.poll(() => estado(c.citaId)).toBe('cancelled')
  expect(sqlLocal(`select count(*) from public.reserva_incidencias where appointment_id = :'id' and tipo = 'cancelacion'`, { id: c.citaId })).toBe('1')
  await expect(tarjeta(page)).toHaveCount(1)
})

test('encendido: guardarla sin paciente conserva el título y no manda paciente_id', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', 'fijo')
  await abrirAgendaV2(page)
  await clicEnTarjeta(tarjeta(page))
  await editarDesdeTarjeta(page)
  const modal = modalCita(page, 'Editar cita')
  await modal.getByPlaceholder('Instrucciones, observaciones...').fill('Trae estudios')
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${c.citaId}`) && r.request().method() === 'PUT')
  await modal.getByRole('button', { name: 'Guardar' }).click()
  const res = await put
  expect(res.ok(), await res.text()).toBeTruthy()
  const cuerpo = res.request().postDataJSON() as Record<string, unknown>
  expect(cuerpo.title).toBe(NOMBRE)
  expect('paciente_id' in cuerpo).toBe(false)
  expect(sqlLocal(`select title || '|' || coalesce(paciente_id::text, '-') || '|' || notes from public.appointments where id = :'id'`, { id: c.citaId }))
    .toBe(`${NOMBRE}|-|Trae estudios`)
})

test('apagado: una cita por enlace que quedó de antes no se borra y el DELETE da 409, no 500', async ({ page }) => {
  const c = cita('17:00', 'unico')
  const res = await page.request.delete(`/api/appointments/${c.citaId}`)
  expect(res.status()).toBe(409)
  expect(estado(c.citaId)).toBe('scheduled')
  /* Las rutas de D siguen cerradas con el interruptor apagado. */
  expect((await page.request.get(`/api/agenda/reservas/historial?cita=${c.citaId}`)).status()).toBe(404)
})
