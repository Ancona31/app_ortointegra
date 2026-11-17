import { test, expect, type Page } from '@playwright/test'
import { interruptorAgenda, sqlLocal } from './ayudas'
import { esperarCorreo } from './mailpit'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import { api, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario } from './reservaPublicaAyudas'

/**
 * Tanda H1 (2026-11-15): cuatro puntos de Angel sobre /reservar, /confirmar y
 * los correos, en TELÉFONO y en ESCRITORIO.
 *
 *   · Punto 2 · siempre en claro: ni el oscuro del sistema (`colorScheme:
 *     'dark'`) ni el guardado en la app (`html.dark`, que se queda puesta al
 *     llegar desde la app sin recargar) oscurecen estas páginas.
 *   · Punto 3 · el primer paso se llama «Lugar» y SIEMPRE sale, también con
 *     un solo consultorio (ya elegido, con su dirección); la dirección sigue a
 *     la vista hasta «Listo».
 *   · Punto 1 · «Volver» es un botón visible (con borde, en el pie) en cada
 *     paso después del primero, también en el del código, y al regresar se
 *     conserva todo: consultorio, tipo, día, hora, datos y correo. Si el
 *     horario ya no está, se avisa sin perder los datos.
 *   · Punto 4 · (actualizado en la tanda I, punto 2: el único ya no pide
 *     correo) no cambia nada: el correo sigue siendo obligatorio en el
 *     enlace fijo, y verificado con código. Ojo: HOY el enlace de un solo uso
 *     también pide un correo con forma (sin código); la prueba fija eso tal
 *     cual, no lo que Angel suponía («sin correo»).
 *
 * Las pruebas de los correos (sin oscuro, `color-scheme: light`) son de Vitest
 * (`plantillaCita.test.ts`). La seguridad, los límites, los turnos y la RPC no
 * cambian; los prueban reserva-enlace, reserva-seg1 y confirmacion-enlace.
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let desde = ''
let interruptorAntes = false
let confirmacion = ''

test.beforeAll(() => {
  interruptorAntes = sqlLocal(`select coalesce((select a.agenda_v2_encendida from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id
                                where c.nombre = 'Clínica Semilla A'), false)::text`) === 'true'
  desde = marcaE2e()
  e = prepararEscenario()
})
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId })
  interruptorAgenda('A', interruptorAntes)
})

/* ── Punto 2 · siempre en claro ───────────────────────────────────────────── */

/** Los colores que de verdad se pintan, y lo que el documento declara. */
async function pintado(page: Page): Promise<{ fondo: string; tarjeta: string; tinta: string; esquema: string; meta: string | null }> {
  return page.evaluate(() => {
    const tarjeta = document.querySelector('.rp-tarjeta')
    const titulo = document.querySelector('.rp-titulo, .rp-fecha')
    return {
      fondo: getComputedStyle(document.body).backgroundColor,
      tarjeta: tarjeta ? getComputedStyle(tarjeta).backgroundColor : '',
      tinta: titulo ? getComputedStyle(titulo).color : '',
      esquema: getComputedStyle(document.documentElement).colorScheme,
      meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null,
    }
  })
}

/** Lo que pinta el claro de fábrica: fondo #eef1f5, tarjeta blanca, tinta #15243e. */
const CLARO = { fondo: 'rgb(238, 241, 245)', tarjeta: 'rgb(255, 255, 255)', tinta: 'rgb(21, 36, 62)', esquema: 'light', meta: 'light' }

/** Un código de /confirmar de una cita reservada por el enlace único (el del comprobante). */
async function codigoDeConfirmacion(): Promise<string> {
  if (confirmacion) return confirmacion
  const { codigo } = emitirEnlace(e, 'unico')
  const [turno] = await turnosLibres(e, codigo, 14)
  const persona = personaNueva()
  expect((await reservar(e, codigo, { inicio: turno?.inicio ?? '', persona })).status).toBe(201)
  const c = await esperarCorreo(persona.correo, 'Tu cita con')
  confirmacion = /\/confirmar\/([A-Za-z0-9_-]{22})/.exec(c.texto)?.[1] ?? ''
  expect(confirmacion).not.toBe('')
  return confirmacion
}

for (const origen of ['el sistema en oscuro', 'el oscuro guardado en la app (html.dark)'] as const) {
  test(`punto 2: /reservar y /confirmar se ven en claro con ${origen}`, async ({ page }) => {
    const app = origen.includes('html.dark')
    await page.emulateMedia({ colorScheme: app ? 'light' : 'dark' })
    const ponerOscuroDeLaApp = async () => { if (app) await page.evaluate(() => document.documentElement.classList.add('dark')) }

    await page.goto(`/reservar/${emitirEnlace(e, 'unico').codigo}`)
    await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeVisible()
    await ponerOscuroDeLaApp()
    expect(await pintado(page)).toEqual(CLARO)

    await page.goto(`/confirmar/${await codigoDeConfirmacion()}`)
    await expect(page.getByRole('heading', { name: 'Tu cita' })).toBeVisible()
    await ponerOscuroDeLaApp()
    expect(await pintado(page)).toEqual(CLARO)
  })
}

/* ── Punto 3 · el primer paso es «Lugar», también con un solo consultorio ─── */

const pasos = (page: Page) => page.getByRole('list', { name: 'Pasos de la reserva' }).locator('li')
const pasoActual = (page: Page) => page.getByRole('list', { name: 'Pasos de la reserva' }).locator('li[aria-current="step"]')

/** La Dra. Invitada de la semilla (medico.a): UN solo consultorio, «Rehabilitación (ficticio)». */
function escenarioUnConsultorio(): Escenario & { direccion: string } {
  const fila = sqlLocal(`select p.id, k.id, coalesce(k.direccion, '') from public.profiles p join auth.users u on u.id = p.id
                           join public.consultorios k on k.medico_id = p.id and k.activo
                          where u.email = 'medico.a@semilla.spinus.test'`)
  const filas = fila.split('\n').filter(Boolean)
  expect(filas, 'la Dra. Invitada de la semilla tiene un solo consultorio activo').toHaveLength(1)
  const [medicoId = '', consultorioId = '', direccion = ''] = (filas[0] ?? '').split('|')
  return { ...e, medicoId, consultorioId, direccion }
}

/** Aparca los demás tipos activos de la clínica (para que sólo quede el del escenario) y devuelve cómo deshacerlo. */
function soloElTipoDelEscenario(): () => void {
  const aparcados = sqlLocal(`update public.tipos_cita set activo = false where clinica_id = :'c' and activo and id <> :'t' returning id`,
    { c: e.clinicaId, t: e.tipoId }).split('\n').filter(Boolean)
  return () => {
    if (aparcados.length) sqlLocal(`update public.tipos_cita set activo = true where id = any (string_to_array(:'ids', ',')::uuid[])`, { ids: aparcados.join(',') })
  }
}

test('punto 3: con varios consultorios el primer paso es «Lugar», con todos y su dirección', async ({ page }) => {
  await page.goto(`/reservar/${emitirEnlace(e, 'unico').codigo}`)
  await expect(pasos(page)).toHaveText(['Lugar', 'Día y hora', 'Tus datos', 'Listo'])
  await expect(pasoActual(page)).toHaveText('Lugar')
  const radios = page.getByRole('group', { name: 'Consultorio' }).getByRole('radio')
  expect(await radios.count()).toBeGreaterThan(1)
  await expect(page.locator(`label:has(input[name="consultorio"][value="${e.consultorioId}"])`))
    .toContainText(sqlLocal(`select direccion from public.consultorios where id = :'id'`, { id: e.consultorioId }))
})

test('punto 3: con UN consultorio, «Lugar» sale con él ya elegido y su dirección a la vista en todo el recorrido', async ({ page }) => {
  const uno = escenarioUnConsultorio()
  const devolver = soloElTipoDelEscenario()
  try {
    await page.goto(`/reservar/${emitirEnlace(uno, 'unico').codigo}`)
    // No se salta: arranca en «Lugar», con el único consultorio marcado y su dirección completa.
    await expect(pasoActual(page)).toHaveText('Lugar')
    const radio = page.getByRole('group', { name: 'Consultorio' }).getByRole('radio')
    await expect(radio).toHaveCount(1)
    await expect(radio).toBeChecked()
    await expect(page.locator(`label:has(input[name="consultorio"][value="${uno.consultorioId}"])`)).toContainText(uno.direccion)
    // Con un solo tipo no hay selector (integración G, punto 5) y se puede seguir.
    await expect(page.getByRole('group', { name: 'Tipo de cita' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Elegir día y hora' }).click()

    await expect(pasoActual(page)).toHaveText('Día y hora')
    await expect(page.locator('[data-direccion]')).toHaveText(uno.direccion)
    await page.locator('button[data-inicio]').first().click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(pasoActual(page)).toHaveText(/Tus datos/)
    await expect(page.locator('[data-direccion]')).toHaveText(uno.direccion)
    const p = personaNueva()
    await page.getByLabel('Nombre completo').fill(p.nombre)
    await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
    await page.getByLabel('Correo electrónico').fill(p.correo)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Reservar cita' }).click()
    await expect(page.getByRole('heading', { name: 'Tu cita quedó agendada' })).toBeVisible()
    await expect(page.locator('[data-direccion]')).toHaveText(uno.direccion)
  } finally {
    devolver()
  }
})

/* ── Punto 1 · «Volver» visible en cada paso después del primero, sin perder nada ─ */

const volver = (page: Page) => page.getByRole('button', { name: 'Volver', exact: true })
const titulo = (page: Page) => page.locator('[data-titulo-paso]')

/** Un botón de verdad, visible, con borde y en la pantalla (en el teléfono, en el pie pegado abajo). */
async function volverSeNota(page: Page): Promise<void> {
  await expect(volver(page)).toBeVisible()
  await expect(volver(page)).toBeInViewport()
  const borde = await volver(page).evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth))
  expect(borde).toBeGreaterThanOrEqual(1)
  const alto = await volver(page).evaluate(el => el.getBoundingClientRect().height)
  expect(alto).toBeGreaterThanOrEqual(44)
}

test('punto 1: «Volver» se ve en cada paso después del primero (también en el del código) y conserva todo', async ({ page }) => {
  const { codigo } = emitirEnlace(e, 'fijo')
  await page.goto(`/reservar/${codigo}`)
  await expect(volver(page)).toHaveCount(0) // en «Lugar» no hay a dónde volver
  await page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = page.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()

  // «Día y hora» → «Lugar»: consultorio y tipo siguen elegidos; el foco, en el título.
  await volverSeNota(page)
  await volver(page).click()
  await expect(pasoActual(page)).toHaveText('Lugar')
  await expect(titulo(page)).toBeFocused()
  await expect(page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`)).toBeChecked()
  if (await tipo.count()) await expect(tipo).toBeChecked()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()

  const hora = page.locator('button[data-inicio]').first()
  const inicio = await hora.getAttribute('data-inicio')
  await hora.click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // «Tus datos» → «Día y hora»: la hora sigue elegida y lo escrito (sin enviar) vuelve tal cual.
  const p = personaNueva()
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByLabel('Correo electrónico').fill(p.correo)
  await volverSeNota(page)
  await volver(page).click()
  await expect(pasoActual(page)).toHaveText(/Día y hora/)
  await expect(titulo(page)).toBeFocused()
  await expect(page.locator(`button[data-inicio="${inicio}"]`)).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByLabel('Nombre completo')).toHaveValue(p.nombre)
  await expect(page.getByLabel('Teléfono (10 dígitos)')).toHaveValue(p.telefono)
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(p.correo)

  // El código del correo → «Tus datos»: también con «Volver», y los datos intactos.
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Enviar código a mi correo' }).click()
  await expect(page.getByLabel('Código')).toBeVisible()
  await volverSeNota(page)
  await volver(page).click()
  await expect(pasoActual(page)).toHaveText(/Tus datos/)
  await expect(titulo(page)).toBeFocused()
  await expect(page.getByLabel('Nombre completo')).toHaveValue(p.nombre)
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(p.correo)
  // La casilla del aviso es el consentimiento: vuelve desmarcada y hay que darlo otra vez (D5).
  await expect(page.getByRole('checkbox')).not.toBeChecked()
})

/** Una semana fingida: mañana con 09:00 y 13:00 (o sólo 13:00), hora de Mérida. */
function semanaFingida(sin0900: boolean): { dias: { fecha: string; turnos: { inicio: string; fin: string }[] }[] } {
  const fecha = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Merida' })
  const t = (f: string, h: string) => ({ inicio: `${f}T${h}:00-06:00`, fin: `${f}T${h}:30-06:00` })
  return { dias: Array.from({ length: 7 }, (_, i) => {
    const f = fecha(i)
    return { fecha: f, turnos: i === 1 ? [...(sin0900 ? [] : [t(f, '09:00')]), t(f, '13:00')] : [] }
  }) }
}

test('punto 1: si al volver desde «Tus datos» el horario ya no está, se avisa y lo escrito se conserva', async ({ page }) => {
  let sin0900 = false
  await page.route('**/turnos?*', r => r.fulfill({ json: semanaFingida(sin0900) }))
  await page.goto(`/reservar/${emitirEnlace(e, 'unico').codigo}`)
  await page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = page.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
  await page.locator('button[data-inicio]').first().click() // las 09:00
  await page.getByRole('button', { name: 'Continuar' }).click()
  const p = personaNueva()
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Correo electrónico').fill(p.correo)

  sin0900 = true // mientras escribía, alguien tomó las 09:00
  await volver(page).click()
  await expect(page.locator('.rp-tarjeta').getByRole('alert')).toHaveText('Ese horario ya no está disponible. Elige otro.')
  await expect(page.locator('button[data-inicio]')).toHaveText(['13:00'])
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  await page.locator('button[data-inicio]').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByLabel('Nombre completo')).toHaveValue(p.nombre)
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(p.correo)
})

/* ── Punto 4 · el correo en el fijo (verificado) y, desde la tanda I (punto 2), opcional en el único ─ */

test('punto 4: el enlace fijo exige un correo VERIFICADO; el de un solo uso, desde I, ni correo ni código', async ({ page }) => {
  const sinCorreo = { ...personaNueva(), correo: '' }
  const fijo = emitirEnlace(e, 'fijo').codigo
  const unico = emitirEnlace(e, 'unico').codigo
  const [a, b] = await turnosLibres(e, unico, 28)
  // Fijo: sin correo no hay código ni reserva; con correo pero sin la ficha del código, 403.
  const ctx = await api()
  try {
    expect((await ctx.post(`/api/reservar/${fijo}/codigo`, { data: {} })).status()).toBe(400)
  } finally {
    await ctx.dispose()
  }
  expect(await reservar(e, fijo, { inicio: a?.inicio ?? '', persona: sinCorreo })).toMatchObject({ status: 400 })
  expect(await reservar(e, fijo, { inicio: a?.inicio ?? '', persona: personaNueva() }))
    .toMatchObject({ status: 403, cuerpo: { error: 'correo_sin_verificar' } })
  // Único: tanda I, punto 2 de Angel — basta el teléfono (antes de I, 400 sin correo).
  expect((await reservar(e, unico, { inicio: b?.inicio ?? '', persona: sinCorreo })).status).toBe(201)

  // En la página: obligatorio en el fijo (manda código); opcional en el único (reserva directo). Ver reserva-i2.
  for (const [codigo, boton, obligatorio] of [[fijo, 'Enviar código a mi correo', true],
    [emitirEnlace(e, 'unico').codigo, 'Reservar cita', false]] as const) {
    await page.goto(`/reservar/${codigo}`)
    await page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
    const tipo = page.locator(`input[name="tipo"][value="${e.tipoId}"]`)
    if (await tipo.count()) await tipo.check()
    await page.getByRole('button', { name: 'Elegir día y hora' }).click()
    await page.locator('button[data-inicio]').first().click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    const campo = page.getByLabel(/Correo electrónico/)
    if (obligatorio) await expect(campo).toHaveAttribute('required', '')
    else await expect(campo).not.toHaveAttribute('required', '')
    await expect(page.getByRole('button', { name: boton })).toBeVisible()
  }
})
