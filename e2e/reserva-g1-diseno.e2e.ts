import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { interruptorAgenda, sqlLocal } from './ayudas'
import { contarCorreos, esperarCorreo } from './mailpit'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import { aprobarAviso, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, type Escenario } from './reservaPublicaAyudas'
import { codigoDeEnlace, hashDeCodigo } from '../src/lib/reserva/secretos'

/**
 * Tanda G1 (2026-11-14): el diseño de /reservar/{código} y /confirmar/{código}
 * y de sus correos, en TELÉFONO y en ESCRITORIO. Lo que se mide es la
 * presentación; la lógica de turnos, límites y reserva no cambió y la prueban
 * reserva-enlace, reserva-seg1 y confirmacion-enlace.
 *
 *   · cuatro pasos visibles (el primero, «Lugar» desde la tanda H); «Tipo de cita» sólo con más de un tipo (punto 7);
 *   · el consultorio con su dirección COMPLETA al elegir, en el resumen de cada
 *     paso, en la pantalla final, en la confirmación y en el comprobante (2);
 *   · la tira de fechas con los días sin horario atenuados, y debajo sólo los
 *     del día elegido en Mañana y Tarde (1);
 *   · los estados: cargando, sin horarios, error, ocupado (409) y no disponible;
 *   · la fecha con la preposición en minúscula; contraste AA en claro y oscuro;
 *     retícula pareja y sin desplazamiento lateral; movimiento reducido.
 *
 * Los turnos de los estados se fingen con `page.route` (sólo la respuesta de
 * /turnos o del POST): así el estado sale siempre, sea el día que sea.
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let desde = ''
let segundoTipo = ''
let direccion = ''
let interruptorAntes = false
let codigoConfirmacion = ''

test.beforeAll(() => {
  interruptorAntes = sqlLocal(`select coalesce((select a.agenda_v2_encendida from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id
                                where c.nombre = 'Clínica Semilla A'), false)::text`) === 'true'
  desde = marcaE2e()
  e = prepararEscenario()
  segundoTipo = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo)
                          values (:'c', null, :'n', 45, true) returning id`, { c: e.clinicaId, n: `${e.tipoNombre} B` })
  direccion = sqlLocal(`select direccion from public.consultorios where id = :'id'`, { id: e.consultorioId })
})
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where id in (:'a', :'b')`, { a: e.tipoId, b: segundoTipo })
  interruptorAgenda('A', interruptorAntes)
})

/** Un enlace único caducado ayer (el «Este enlace ya no está disponible»). */
function unicoCaducado(): string {
  const id = randomUUID()
  const codigo = codigoDeEnlace(id) ?? ''
  sqlLocal(`insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
            values (:'id', :'c', :'m', 'unico', :'h', 7, now() - interval '1 day')`, { id, c: e.clinicaId, m: e.medicoId, h: hashDeCodigo(codigo) })
  return codigo
}

const pasoActual = (page: Page) => page.getByRole('list', { name: 'Pasos de la reserva' }).locator('li[aria-current="step"]')

/** Desde la carga hasta el paso 2 con el consultorio de la semilla. */
async function aDiaYHora(page: Page, codigo: string): Promise<void> {
  await page.goto(`/reservar/${codigo}`)
  await page.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  await page.locator(`input[name="tipo"][value="${e.tipoId}"]`).check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
}

/** Una semana fingida: hoy sin horario, mañana con 09:00 y 13:00, pasado con 10:00 (hora de Mérida, UTC−6). */
function semanaFingida(): { dias: { fecha: string; turnos: { inicio: string; fin: string }[] }[] } {
  const fecha = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Merida' })
  const t = (f: string, h: string) => ({ inicio: `${f}T${h}:00-06:00`, fin: `${f}T${h}:30-06:00` })
  return { dias: Array.from({ length: 7 }, (_, i) => {
    const f = fecha(i)
    return { fecha: f, turnos: i === 1 ? [t(f, '09:00'), t(f, '13:00')] : i === 2 ? [t(f, '10:00')] : [] }
  }) }
}

test('cuatro pasos, «Tipo de cita» con más de un tipo y la dirección completa en cada paso y al final', async ({ page }) => {
  const { codigo } = emitirEnlace(e, 'unico')
  await page.goto(`/reservar/${codigo}`)
  await expect(page.getByRole('list', { name: 'Pasos de la reserva' }).locator('li')).toHaveText(['Lugar', 'Día y hora', 'Tus datos', 'Listo'])
  await expect(pasoActual(page)).toHaveText('Lugar')
  await expect(page.getByRole('group', { name: 'Tipo de cita' })).toBeVisible()
  // Con varios tipos no hay ninguno elegido de antemano: hasta elegir, no se avanza.
  await expect(page.locator('input[name="tipo"]:checked')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeDisabled()
  await expect(page.locator(`label:has(input[name="consultorio"][value="${e.consultorioId}"])`)).toContainText(direccion)
  await page.locator(`input[name="tipo"][value="${e.tipoId}"]`).check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
  await expect(pasoActual(page)).toHaveText('Día y hora')
  await expect(page.locator('[data-direccion]')).toHaveText(direccion)
  await page.locator('button[data-inicio]').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(pasoActual(page)).toHaveText(/Tus datos/)
  await expect(page.locator('[data-direccion]')).toHaveText(direccion)
  const p = personaNueva()
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByLabel('Correo electrónico').fill(p.correo)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cita quedó agendada' })).toBeVisible()
  await expect(pasoActual(page)).toHaveText('Listo')
  await expect(page.locator('[data-direccion]')).toHaveText(direccion)
  // La pantalla final, como el comprobante: sin el tipo de cita (lista A, 10).
  await expect(page.getByRole('region', { name: 'Cita reservada' })).not.toContainText(e.tipoNombre)

  const c = await esperarCorreo(p.correo, 'Tu cita con')
  codigoConfirmacion = /\/confirmar\/([A-Za-z0-9_-]{22})/.exec(c.texto)?.[1] ?? ''
  expect(codigoConfirmacion).not.toBe('')
  for (const cuerpo of [c.texto, c.html.replace(/<[^>]+>/g, ' ')]) {
    expect(cuerpo).toContain('Spinus')
    expect(cuerpo).toContain(direccion)
    expect(cuerpo).not.toContain(e.tipoNombre)
  }
  expect(c.html).toMatch(/<td align="center" bgcolor="#1e5fa8"[^>]*><a href="http[^"]+\/confirmar\/[A-Za-z0-9_-]{22}"/)
  expect(c.html).not.toMatch(/<img/i)
})

test('con un solo tipo activo el bloque «Tipo de cita» no sale (punto 7)', async ({ page }) => {
  // Se aparcan los demás tipos activos de la clínica (otras pruebas o a mano) y se devuelven al final.
  const aparcados = sqlLocal(`update public.tipos_cita set activo = false where clinica_id = :'c' and activo and id <> :'t' returning id`,
    { c: e.clinicaId, t: e.tipoId }).split('\n').filter(Boolean)
  try {
    await page.goto(`/reservar/${emitirEnlace(e, 'unico').codigo}`)
    await expect(page.locator('input[name="consultorio"]').first()).toBeVisible()
    await expect(page.getByRole('group', { name: 'Tipo de cita' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeEnabled()
  } finally {
    if (aparcados.length) {
      sqlLocal(`update public.tipos_cita set activo = true where id = any (string_to_array(:'ids', ',')::uuid[])`, { ids: aparcados.join(',') })
    }
  }
})

test('la tira de fechas atenúa los días sin horario y debajo salen sólo los del día elegido, en Mañana y Tarde', async ({ page }) => {
  const semana = semanaFingida()
  await page.route('**/turnos?*', r => r.fulfill({ json: semana }))
  await aDiaYHora(page, emitirEnlace(e, 'unico').codigo)
  const [hoy, manana, pasado] = semana.dias
  const dia = (f?: string) => page.locator(`button[data-fecha="${f}"]`)
  await expect(dia(hoy?.fecha)).toBeDisabled()
  await expect(dia(hoy?.fecha)).toHaveAttribute('aria-label', /^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-z]+, sin horarios$/)
  await expect(dia(manana?.fecha)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Mañana' }).locator('button[data-inicio]')).toHaveText(['09:00'])
  await expect(page.getByRole('region', { name: 'Tarde' }).locator('button[data-inicio]')).toHaveText(['13:00'])
  await dia(pasado?.fecha).click()
  await expect(page.locator('button[data-inicio]')).toHaveText(['10:00'])
  await expect(page.getByRole('region', { name: 'Tarde' })).toContainText('Sin horarios')
  await page.locator('button[data-inicio]').click()
  await expect(page.locator('.rp-pie small')).toHaveText(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-z]+ · 10:00$/)
})

test('estados: cargando, sin horarios, error con «Reintentar» y enlace no disponible', async ({ page }) => {
  const codigo = emitirEnlace(e, 'unico').codigo
  let modo: 'colgar' | 'vacio' | 'error' | 'bien' = 'colgar'
  await page.route('**/turnos?*', r => {
    if (modo === 'colgar') return
    if (modo === 'error') return r.fulfill({ status: 500, json: { error: 'no_disponible' } })
    return r.fulfill({ json: modo === 'vacio' ? { dias: semanaFingida().dias.map(d => ({ ...d, turnos: [] })) } : semanaFingida() })
  })
  await aDiaYHora(page, codigo)
  await expect(page.locator('[aria-busy="true"]')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Buscando horarios…' })).toBeAttached()

  modo = 'vacio'
  await aDiaYHora(page, codigo)
  await expect(page.getByText('No hay horarios libres esta semana.')).toBeVisible()
  await expect(page.locator('button[data-fecha]:not([disabled])')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver la semana siguiente' })).toBeVisible()

  modo = 'error'
  await aDiaYHora(page, codigo)
  await expect(page.locator('.rp-tarjeta').getByRole('alert')).toHaveText('No se pudo completar. Intenta de nuevo.')
  modo = 'bien'
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.locator('button[data-inicio]').first()).toBeVisible()

  await page.goto(`/reservar/${unicoCaducado()}`)
  await expect(page.getByRole('heading', { name: 'Este enlace ya no está disponible' })).toBeVisible()
  await expect(page.locator('.rp-marca')).toContainText('Spinus')
})

test('ocupado (409): vuelve a «Día y hora» con el aviso y vuelve a pedir los turnos', async ({ page }) => {
  const codigo = emitirEnlace(e, 'unico').codigo
  let pedidos = 0
  page.on('request', r => { if (r.method() === 'GET' && r.url().includes('/turnos?')) pedidos++ })
  await page.route(`**/api/reservar/${codigo}`, r => r.request().method() === 'POST'
    ? r.fulfill({ status: 409, json: { error: 'turno_ocupado' } }) : r.continue())
  await aDiaYHora(page, codigo)
  await page.locator('button[data-inicio]').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  const p = personaNueva()
  await page.getByLabel('Nombre completo').fill(p.nombre)
  await page.getByLabel('Teléfono (10 dígitos)').fill(p.telefono)
  await page.getByLabel('Correo electrónico').fill(p.correo)
  await page.getByRole('checkbox').check()
  const antes = pedidos
  await page.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(page.locator('.rp-tarjeta').getByRole('alert')).toHaveText('Ese horario se acaba de ocupar. Elige otro.')
  await expect(pasoActual(page)).toHaveText(/Día y hora/)
  await expect.poll(() => pedidos).toBeGreaterThan(antes)
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled()
})

test('la confirmación: la fecha grande en minúscula, el consultorio con su dirección completa y nada clínico', async ({ page }) => {
  test.skip(!codigoConfirmacion, 'depende de la reserva de la primera prueba')
  await page.goto(`/confirmar/${codigoConfirmacion}`)
  await expect(page.getByRole('heading', { name: 'Tu cita' })).toBeVisible()
  await expect(page.locator('.rp-fecha')).toHaveText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\d{1,2} de [a-z]+ · \d\d:\d\d h/)
  await expect(page.locator('[data-direccion]')).toHaveText(direccion)
  await expect(page.locator('body')).not.toContainText('Ortopedia')
  await expect(page.locator('body')).not.toContainText(e.tipoNombre)
  await page.getByRole('link', { name: 'No podré asistir' }).click()
  await expect(page.getByRole('button', { name: 'Sí, cancelar mi cita' })).toHaveClass(/rp-btn--peligro/)
  await page.getByRole('link', { name: 'Volver' }).click()
  await page.getByRole('button', { name: 'Confirmo mi asistencia' }).click()
  await expect(page.getByRole('status')).toHaveText('Gracias. Tu asistencia quedó confirmada.')
  await expect(page.getByRole('status')).toHaveClass(/rp-nota--ok/)
})

test('el correo del código: marca, código en grande, sin imágenes', async ({ request }) => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const correo = `g1-codigo-${randomUUID().slice(0, 8)}@reserva.test`
  const previos = await contarCorreos(correo, 'Tu código para reservar')
  expect((await request.post(`/api/reservar/${codigo}/codigo`, { data: { correo } })).status()).toBe(200)
  const m = await esperarCorreo(correo, 'Tu código para reservar', previos)
  const cifra = /\b(\d{6})\b/.exec(m.texto)?.[1] ?? ''
  // Tanda I (I2, punto 21): el correo va a nombre del médico; «Spinus» queda al pie
  // («Enviado con Spinus»). Antes empezaba por «Spinus».
  expect(m.texto.startsWith('Spinus')).toBe(false)
  expect(m.texto.trim().endsWith('Enviado con Spinus')).toBe(true)
  expect(m.html).toMatch(new RegExp(`font:800 32px[^>]*>${cifra}<`))
  expect(m.html.replace(/<[^>]+>/g, ' ')).toContain('Spinus')
  expect(m.html).not.toMatch(/<img/i)
})

/* ── contraste, retícula y movimiento ─────────────────────────────────────── */

/** Contraste WCAG del texto visible de estas clases contra su fondo efectivo (componiendo transparencias). */
async function peoresContrastes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const SEL = '.rp-titulo, .rp-sub, .rp-etiqueta, .rp-resumen dt, .rp-resumen dd, .rp-pasos li, .rp-hora, .rp-dia:not(:disabled) small, '
      + '.rp-dia:not(:disabled) b, .rp-btn:not(:disabled), .rp-nota, .rp-vacio, .rp-op__txt b, .rp-op__txt span, .rp-medico__nombre, '
      + '.rp-medico__esp, .rp-marca, .rp-pie small, .rp-semana span, .rp-fecha, .rp-fecha small, .rp-enlace'
    const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!lienzo) return ['sin canvas']
    const rgba = (c: string): number[] => {
      lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = '#000'; lienzo.fillStyle = c; lienzo.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0, a = 0] = lienzo.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const sobre = (arriba: number[], abajo: number[]) => [0, 1, 2].map(i => (arriba[i] ?? 0) * (arriba[3] ?? 1) + (abajo[i] ?? 0) * (1 - (arriba[3] ?? 1)))
    const fondo = (el: Element | null): number[] => {
      if (!el) return [255, 255, 255]
      const c = rgba(getComputedStyle(el).backgroundColor)
      return (c[3] ?? 0) >= 1 ? c.slice(0, 3) : sobre(c, fondo(el.parentElement))
    }
    const lum = (c: number[]) => { const [r = 0, g = 0, b = 0] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const malos: string[] = []
    for (const el of Array.from(document.querySelectorAll(SEL))) {
      if (!(el instanceof HTMLElement) || !el.offsetParent || !el.innerText.trim()) continue
      const bg = fondo(el)
      const fg = sobre(rgba(getComputedStyle(el).color), bg)
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      const ratio = ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05)
      if (ratio < 4.5) malos.push(`${el.className} «${el.innerText.trim().slice(0, 30)}» ${ratio.toFixed(2)}`)
    }
    return malos
  })
}

for (const tema of ['light', 'dark'] as const) {
  test(`contraste AA en ${tema === 'light' ? 'claro' : 'oscuro'}: pasos 1 y 2, la confirmación y el no disponible`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema })
    await page.route('**/turnos?*', r => r.fulfill({ json: semanaFingida() }))
    const codigo = emitirEnlace(e, 'unico').codigo
    await page.goto(`/reservar/${codigo}`)
    await page.locator(`input[name="tipo"][value="${e.tipoId}"]`).check()
    expect(await peoresContrastes(page)).toEqual([])
    await page.getByRole('button', { name: 'Elegir día y hora' }).click()
    await page.locator('button[data-inicio]').first().click()
    expect(await peoresContrastes(page)).toEqual([])
    await page.goto(`/reservar/${unicoCaducado()}`)
    expect(await peoresContrastes(page)).toEqual([])
    if (codigoConfirmacion) {
      await page.goto(`/confirmar/${codigoConfirmacion}`)
      expect(await peoresContrastes(page)).toEqual([])
    }
  })
}

test('retícula pareja y sin desplazamiento lateral; la animación del paso respeta el movimiento reducido', async ({ page }) => {
  await page.route('**/turnos?*', r => r.fulfill({ json: semanaFingida() }))
  await aDiaYHora(page, emitirEnlace(e, 'unico').codigo)
  await expect(page.locator('button[data-inicio]').first()).toBeVisible()
  const medidas = await page.evaluate(() => {
    const anchos = (sel: string) => Array.from(document.querySelectorAll(sel)).map(x => Math.round(x.getBoundingClientRect().width))
    const t = document.querySelector('.rp-tarjeta')?.getBoundingClientRect()
    return {
      dias: anchos('.rp-dia'), pasos: anchos('.rp-pasos li'), horas: anchos('.rp-hora'),
      izquierda: Math.round(t?.left ?? -1), derecha: Math.round(window.innerWidth - (t?.right ?? 0)),
      lateral: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  for (const fila of [medidas.dias, medidas.pasos, medidas.horas]) expect(Math.max(...fila) - Math.min(...fila)).toBeLessThanOrEqual(1)
  expect(Math.abs(medidas.izquierda - medidas.derecha)).toBeLessThanOrEqual(1)
  expect(medidas.izquierda).toBeGreaterThanOrEqual(16)
  expect(medidas.lateral).toBe(0)

  const animacion = () => page.locator('.rp-paso').first().evaluate(el => {
    const s = getComputedStyle(el)
    return { nombre: s.animationName, duracion: parseFloat(s.animationDuration) * 1000 }
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const normal = await animacion()
  expect(normal.nombre).toBe('rp-entra')
  expect(normal.duracion).toBeLessThanOrEqual(240)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect((await animacion()).nombre).toBe('none')
})

test('apagado el aviso o el interruptor, la página sigue siendo el 404 de siempre', async ({ page }) => {
  const { codigo } = emitirEnlace(e, 'unico')
  interruptorAgenda('A', false)
  try {
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(404)
  } finally {
    interruptorAgenda('A', true)
    aprobarAviso(true)
  }
})
