import { expect, type Locator, type Page } from '@playwright/test'
import { irAAgenda, sqlLocal } from './ayudas'

/**
 * Ayudas de las e2e de las interacciones v2 del bloque F (F3): la burbuja, la
 * tarjeta de lectura, el minicalendario, el buscador, los atajos y el gesto de
 * deslizar. Las usan los `agenda-f-*.e2e.ts` y, para pasar por la tarjeta, las
 * e2e de B–E que abren una cita con el interruptor encendido.
 *
 * ⚠️ CON EL INTERRUPTOR ENCENDIDO HAY QUE ESPERAR A `data-interacciones-v2`,
 * no sólo a `data-agenda-v2="encendida"`: las interacciones van en un chunk
 * que se monta en ocioso, y mientras no llega cada gesto abre el modal de
 * siempre. `abrirAgendaV2` espera a las dos.
 */

/** Abre /agenda con el interruptor ya encendido en la base y espera a las interacciones. */
export async function abrirAgendaV2(page: Page): Promise<void> {
  await irAAgenda(page)
  const raiz = page.locator('.agenda-raiz')
  await expect(raiz).toHaveAttribute('data-agenda-v2', 'encendida')
  await expect(raiz).toHaveAttribute('data-interacciones-v2', 'listas')
}

/** Abre /agenda con el interruptor apagado (el estado del `globalSetup`) y comprueba que no hay chunk. */
export async function abrirAgendaApagada(page: Page): Promise<void> {
  await irAAgenda(page)
  const raiz = page.locator('.agenda-raiz')
  await expect(raiz).toHaveAttribute('data-agenda-v2', 'apagada')
  await expect(raiz).not.toHaveAttribute('data-interacciones-v2', /.*/)
}

/** La burbuja de alta rápida: un diálogo «Nueva cita · mié 11, 10:00–11:00». */
export function burbuja(page: Page): Locator {
  return page.getByRole('dialog', { name: /^Nueva cita · / })
}

/** La tarjeta de lectura: el diálogo que lleva la barra «Acciones de la cita». */
export function tarjetaLectura(page: Page): Locator {
  return page.getByRole('dialog').filter({ has: page.getByRole('toolbar', { name: 'Acciones de la cita' }) })
}

/**
 * Con el interruptor encendido, un clic en una cita abre la TARJETA y la
 * edición está a un clic más, en «Editar». Las e2e de B–E que abrían el modal
 * con un clic pasan por aquí.
 */
export async function editarDesdeTarjeta(page: Page): Promise<void> {
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  await t.getByRole('button', { name: 'Editar', exact: true }).click()
}

/** El centro de la franja de media hora `hora` (`HH:MM`) del día `fecha`, ya a la vista. */
export async function puntoDeFranja(page: Page, fecha: string, hora: string): Promise<{ x: number; y: number }> {
  const fila = page.locator(`td.fc-timegrid-slot-lane[data-time="${hora}:00"]`)
  await fila.scrollIntoViewIfNeeded()
  const f = await fila.boundingBox()
  const c = await page.locator(`.fc-timegrid-col[data-date="${fecha}"]`).boundingBox()
  if (!f || !c) throw new Error(`puntoDeFranja: no se ve la franja ${fecha} ${hora}`)
  return { x: c.x + c.width / 2, y: f.y + f.height / 2 }
}

/** Un clic en una franja vacía de la rejilla. */
export async function clicEnFranja(page: Page, fecha: string, hora: string): Promise<void> {
  const p = await puntoDeFranja(page, fecha, hora)
  await page.mouse.click(p.x, p.y)
}

/**
 * Arrastra sobre la rejilla de la franja `desde` a la franja `hasta`, ambas
 * incluidas: de 10:00 a 11:00 marca 10:00–11:30.
 */
export async function arrastrarFranjas(page: Page, fecha: string, desde: string, hasta: string): Promise<void> {
  const a = await puntoDeFranja(page, fecha, desde)
  const b = await puntoDeFranja(page, fecha, hasta)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}

/** Elige un paciente en el combobox de la burbuja (o del buscador) por sus apellidos. */
export async function elegirPaciente(capa: Locator, apellidos: string): Promise<void> {
  await capa.getByRole('combobox').fill(apellidos)
  /* T1: la última opción de la burbuja es «Registrar «…»» con lo escrito, que
     también casa con el texto: se elige un paciente, nunca esa. */
  await capa.getByRole('option', { name: new RegExp(apellidos) }).filter({ hasNotText: 'Registrar' }).first().click()
}

/** Las peticiones de un método a `/api/appointments…`, contadas desde ahora. */
export function contarPeticiones(page: Page, metodo: string, fragmento = '/api/appointments'): { cuantas: () => number } {
  let n = 0
  page.on('request', r => { if (r.method() === metodo && r.url().includes(fragmento)) n++ })
  return { cuantas: () => n }
}

/**
 * Deja la clínica A «cancelada y sin VIP» (el bloqueo de la fase 8.2: tiene más
 * de 5 pacientes) y devuelve cómo volver a dejarla como estaba.
 */
export function bloquearSuscripcionA(): () => void {
  const clinica = { nombre: 'Clínica Semilla A' }
  const [estado, vip] = sqlLocal(`select suscripcion_estado, es_vip_grant from public.clinicas where nombre = :'nombre'`, clinica).split('|')
  sqlLocal(`update public.clinicas set suscripcion_estado = 'cancelado', es_vip_grant = false where nombre = :'nombre'`, clinica)
  return () => {
    sqlLocal(`update public.clinicas set suscripcion_estado = :'estado', es_vip_grant = :'vip'::boolean where nombre = :'nombre'`,
      { ...clinica, estado, vip: vip === 't' ? 'true' : 'false' })
  }
}
