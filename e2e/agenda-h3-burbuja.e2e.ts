import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja, clicEnFranja, elegirPaciente } from './interaccionesAyudas'

/**
 * H3 · Puntos 11 a 14 de Angel (escritorio, interruptor encendido).
 *
 *   · 11: «Registrar «…»» de la burbuja en verde (`--ag-success-text`), con
 *     contraste AA contra el fondo pintado, en claro y en oscuro.
 *   · 12: tras registrar el paciente (y tras cancelar el registro), la burbuja
 *     sigue abierta con su horario, aunque el clic sobre el botón del modal sea
 *     DOBLE: el segundo clic, que cae ya sobre la rejilla, no la cierra ni abre
 *     otra (la causa, en `useEscudoTrasRegistro` de `BurbujaAlta.tsx`).
 *   · 13: el registro rápido pide «Teléfono celular o WhatsApp» (opcional, con
 *     el formato y la validación de la ficha) y lo guarda en `pacientes.telefono`;
 *     la leyenda va debajo del correo y el teléfono. Con la v2 apagada, el
 *     registro rápido del formulario completo sigue sin teléfono.
 *   · 14: «Añadir observaciones» (plegado) en la burbuja; lo escrito se guarda
 *     en `appointments.notes` y pasa al formulario completo con «Más opciones».
 *     Que NO viajan a Google (S1) lo prueba `agenda-google-dos-sentidos`.
 *
 * Todo en la SEMANA +3 (como `agenda-t1-burbuja`), miércoles.
 *
 * MUTACIONES (cada una pone en rojo su prueba):
 *   · 11: quitar el `color` de `.ag-opcion--registrar` en `globals.css` (y, para el
 *     fondo de la señalada, quitar su `background`).
 *   · 12: en `BurbujaAlta`, que `escudo.activar` no haga nada (el comportamiento
 *     de antes: el segundo clic cierra la burbuja y abre otra vacía).
 *   · 13: en `QuickPatientModal`, no mandar `telefono` en el cuerpo; y, para la
 *     prueba de la v2 apagada, `conTelefono={true}` en `AppointmentModal`.
 *   · 14: en `datosDeAltaRapida`, volver a `notes: null`; y en
 *     `aperturaDesdeBurbuja`, no pasar `notas`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const MIERCOLES = diaDeLaSemana(3, 2)
const NUEVO = { nombre: 'Zoila', apellidos: 'Burbujah Tres' }

test.afterEach(() => {
  sqlLocal(`
    delete from public.paciente_medico where paciente_id in (select id from public.pacientes where apellidos = :'ap');
    delete from public.pacientes where apellidos = :'ap';`, { ap: NUEVO.apellidos })
  interruptorAgenda('A', false)
})

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${MIERCOLES}"]`)).toBeVisible()
}

/** La burbuja del miércoles 14:30 con «Registrar «…»» a la vista. */
async function burbujaConRegistrar(page: Page): Promise<{ b: Locator; registrar: Locator }> {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, MIERCOLES, '14:30')
  const b = burbuja(page)
  await b.getByRole('combobox', { name: 'Paciente' }).fill(`${NUEVO.nombre} ${NUEVO.apellidos}`)
  const registrar = b.getByRole('option', { name: /Registrar «Zoila Burbujah Tres»/ })
  await expect(registrar).toBeVisible()
  return { b, registrar }
}

/**
 * Color y contraste WCAG de cada línea de `el` contra su fondo efectivo
 * (componiendo transparencias hacia arriba). Copia del de `reserva-g1-diseno`,
 * acotada a un elemento.
 */
async function coloresYContraste(el: Locator): Promise<{ color: string; token: string; ratio: number }[]> {
  return el.evaluate((raiz) => {
    const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!lienzo) throw new Error('sin canvas')
    const rgba = (c: string): number[] => {
      lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = '#000'; lienzo.fillStyle = c; lienzo.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0, a = 0] = lienzo.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const sobre = (arriba: number[], abajo: number[]) => [0, 1, 2].map(i => (arriba[i] ?? 0) * (arriba[3] ?? 1) + (abajo[i] ?? 0) * (1 - (arriba[3] ?? 1)))
    const fondo = (e: Element | null): number[] => {
      if (!e) return [255, 255, 255]
      const c = rgba(getComputedStyle(e).backgroundColor)
      return (c[3] ?? 0) >= 1 ? c.slice(0, 3) : sobre(c, fondo(e.parentElement))
    }
    const lum = (c: number[]) => { const [r = 0, g = 0, b = 0] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const token = getComputedStyle(raiz).getPropertyValue('--ag-success-text').trim()
    return Array.from(raiz.querySelectorAll('span')).map((s) => {
      const bg = fondo(s)
      const fg = sobre(rgba(getComputedStyle(s).color), bg)
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      return { color: getComputedStyle(s).color, token: `rgb(${rgba(token).slice(0, 3).join(', ')})`, ratio: ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05) }
    })
  })
}

for (const tema of ['claro', 'oscuro'] as const) {
  test(`punto 11: «Registrar «…»» va en el verde de la agenda, con contraste AA (${tema}, en reposo y señalada)`, async ({ page }) => {
    if (tema === 'oscuro') await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch { /* privado */ } })
    interruptorAgenda('A', true)
    const { b, registrar } = await burbujaConRegistrar(page)
    if (tema === 'oscuro') await expect(page.locator('html')).toHaveClass(/dark/)
    const enReposo = await coloresYContraste(registrar)
    expect(enReposo).toHaveLength(2)
    for (const l of enReposo) {
      expect(l.color).toBe(l.token)
      expect(l.ratio).toBeGreaterThanOrEqual(4.5)
    }
    // Señalada con el teclado (la última opción): fondo verde claro, sigue AA.
    await b.getByRole('combobox', { name: 'Paciente' }).press('ArrowUp')
    await expect(registrar).toHaveAttribute('aria-selected', 'true')
    // El fondo de la señalada es el verde de la agenda (no el azulado genérico de `.ag-opcion`).
    await expect.poll(() => registrar.evaluate((li) => {
      const muestra = document.createElement('i')
      muestra.style.backgroundColor = 'var(--ag-success-bg)'
      li.appendChild(muestra)
      const esperado = getComputedStyle(muestra).backgroundColor
      muestra.remove()
      return getComputedStyle(li).backgroundColor === esperado
    })).toBe(true)
    for (const l of await coloresYContraste(registrar)) expect(l.ratio).toBeGreaterThanOrEqual(4.5)
  })
}

/**
 * Clic en el centro de `boton` y, en cuanto se va el modal, otro clic en el mismo sitio (el doble clic).
 * La caja se mide con la entrada del modal (`animate-modal-enter`) ya terminada: medida a mitad,
 * el punto caía unos píxeles a la izquierda, fuera de la burbuja, y el segundo clic iba a la
 * rejilla; con el modal quieto cae DENTRO de la burbuja, que es donde lo da quien hace doble clic
 * (cierre de la tanda M: de ahí que la prueba fallara unas veces sí y otras no).
 */
async function dobleClicQueCierraElModal(page: Page, boton: Locator): Promise<void> {
  await boton.evaluate((el) => Promise.all((el.closest('div.fixed')?.getAnimations({ subtree: true }) ?? [])
    .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)).then(() => undefined))
  const caja = await boton.boundingBox()
  if (!caja) throw new Error('sin botón')
  const x = caja.x + caja.width / 2
  const y = caja.y + caja.height / 2
  await page.mouse.click(x, y)
  await expect(page.getByRole('heading', { name: 'Registrar paciente' })).toHaveCount(0)
  await page.mouse.click(x, y)
}

test('punto 12: tras registrar con doble clic, la burbuja sigue abierta con su horario, el paciente elegido y el foco en Guardar', async ({ page }) => {
  interruptorAgenda('A', true)
  const { b, registrar } = await burbujaConRegistrar(page)
  const titulo = await b.getByRole('heading').innerText()
  await registrar.click()
  const qpm = page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
  await qpm.getByRole('checkbox').check()
  await dobleClicQueCierraElModal(page, qpm.getByRole('button', { name: 'Crear y continuar' }))
  await page.waitForTimeout(800)
  await expect(burbuja(page)).toHaveCount(1)
  await expect(b.getByRole('heading')).toHaveText(titulo)
  await expect(b.getByRole('combobox', { name: 'Paciente' })).toHaveValue('Zoila Burbujah Tres')
  await expect(b.getByRole('button', { name: 'Guardar', exact: true })).toBeFocused()
  expect(sqlLocal(`select count(*) from public.pacientes where apellidos = :'ap'`, { ap: NUEVO.apellidos })).toBe('1')
})

test('punto 12: al cancelar el registro (también con doble clic), la burbuja sigue abierta con su horario y lo escrito', async ({ page }) => {
  interruptorAgenda('A', true)
  const { b, registrar } = await burbujaConRegistrar(page)
  const titulo = await b.getByRole('heading').innerText()
  await registrar.click()
  const qpm = page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
  await dobleClicQueCierraElModal(page, qpm.getByRole('button', { name: 'Cancelar' }))
  await page.waitForTimeout(800)
  await expect(burbuja(page)).toHaveCount(1)
  await expect(b.getByRole('heading')).toHaveText(titulo)
  await expect(b.getByRole('combobox', { name: 'Paciente' })).toHaveValue('Zoila Burbujah Tres')
  await expect(b.getByRole('combobox', { name: 'Paciente' })).toBeFocused()
  expect(sqlLocal(`select count(*) from public.pacientes where apellidos = :'ap'`, { ap: NUEVO.apellidos })).toBe('0')
  // Pasado el escudo, tocar fuera vuelve a cerrar la burbuja (como antes).
  await page.mouse.click(5, 5)
  await expect(burbuja(page)).toHaveCount(0)
})

const LEYENDA = 'Sin teléfono ni correo no se podrán enviar confirmaciones ni recordatorios de cita.'

test('punto 13: el registro rápido pide teléfono (opcional, validado) y lo guarda en la ficha; la leyenda va debajo de correo y teléfono', async ({ page }) => {
  interruptorAgenda('A', true)
  const { b, registrar } = await burbujaConRegistrar(page)
  await registrar.click()
  const qpm = page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
  const tel = qpm.getByLabel('Teléfono celular o WhatsApp')
  const leyenda = qpm.getByText(LEYENDA)
  await expect(tel).toBeVisible()
  await expect(leyenda).toBeVisible()
  // Debajo de los dos campos: el correo, luego el teléfono, luego la leyenda.
  const [yCorreo, yTel, yLeyenda] = await Promise.all([qpm.locator('input[type="email"]'), tel, leyenda].map(async l => (await l.boundingBox())?.y ?? -1))
  expect(yCorreo < yTel && yTel < yLeyenda).toBe(true)
  await qpm.getByRole('checkbox').check()
  // Un teléfono incompleto no deja crear (la regla de la ficha: 10 dígitos).
  await tel.fill('99912')
  await qpm.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(qpm.getByText('El teléfono debe tener 10 dígitos').first()).toBeVisible()
  expect(sqlLocal(`select count(*) from public.pacientes where apellidos = :'ap'`, { ap: NUEVO.apellidos })).toBe('0')
  await tel.fill('9991234567')
  await expect(tel).toHaveValue('999 123 4567')
  await qpm.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Registrar paciente' })).toHaveCount(0)
  await expect(b.getByRole('combobox', { name: 'Paciente' })).toHaveValue('Zoila Burbujah Tres')
  expect(sqlLocal(`select telefono || '|' || coalesce(email, '') || '|' || consentimiento_otorgado from public.pacientes where apellidos = :'ap'`,
    { ap: NUEVO.apellidos })).toBe('999 123 4567||true')
})

test('punto 13: con la v2 apagada, el registro rápido del formulario completo sigue sin teléfono ni leyenda', async ({ page }) => {
  interruptorAgenda('A', false)
  await page.goto('/agenda')
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
  await page.getByRole('button', { name: 'Agendar' }).first().click()
  const buscar = page.getByPlaceholder('Buscar paciente por nombre o apellido...')
  await buscar.fill(`${NUEVO.nombre} ${NUEVO.apellidos}`)
  await page.getByText(`Registrar "${NUEVO.nombre} ${NUEVO.apellidos}"`).click()
  const qpm = page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
  await expect(qpm.locator('input[type="email"]')).toBeVisible()
  await expect(qpm.getByLabel('Teléfono celular o WhatsApp')).toHaveCount(0)
  await expect(qpm.getByText(LEYENDA)).toHaveCount(0)
})

const OBS = 'Trae estudios de laboratorio previos (H3)'

function borrarCitasConObs(): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.cita_confirmaciones where appointment_id in (select id from public.appointments where notes = :'obs');
    delete from public.appointments where notes = :'obs'; commit;`, { obs: OBS })
}

test('punto 14: las observaciones de la burbuja son discretas, opcionales y se guardan en la cita', async ({ page }) => {
  interruptorAgenda('A', true)
  borrarCitasConObs()
  try {
    await abrirAgendaV2(page)
    await aLaSemanaMasTres(page)
    await clicEnFranja(page, MIERCOLES, '15:30')
    const b = burbuja(page)
    // Plegadas: sólo el enlace, sin área de texto.
    const enlace = b.getByRole('button', { name: 'Añadir observaciones' })
    await expect(enlace).toHaveAttribute('aria-expanded', 'false')
    await expect(b.getByRole('textbox', { name: 'Observaciones' })).toHaveCount(0)
    await elegirPaciente(b, 'Prueba 21')
    await enlace.click()
    const area = b.getByRole('textbox', { name: 'Observaciones' })
    await expect(area).toBeFocused()
    await area.fill(OBS)
    const post = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/appointments') && r.status() === 200)
    await b.getByRole('button', { name: 'Guardar', exact: true }).click()
    const aviso = page.getByRole('dialog', { name: /Se empalma/ })
    await expect(aviso.or(b.getByText('Cita agendada', { exact: true })).first()).toBeVisible()
    if (await aviso.count()) await aviso.getByRole('button', { name: 'Aceptar' }).click()
    const id = ((await (await post).json()) as { appointment: { id: string } }).appointment.id
    expect(sqlLocal(`select notes from public.appointments where id = :'id'`, { id })).toBe(OBS)
  } finally {
    borrarCitasConObs()
  }
})

test('punto 14: «Más opciones» lleva las observaciones de la burbuja a las «Notas» del formulario completo', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, MIERCOLES, '15:30')
  const b = burbuja(page)
  await b.getByRole('button', { name: 'Añadir observaciones' }).click()
  await b.getByRole('textbox', { name: 'Observaciones' }).fill(OBS)
  await b.getByRole('button', { name: 'Más opciones' }).click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
  await expect(modal.getByPlaceholder('Instrucciones, observaciones...')).toHaveValue(OBS)
})
