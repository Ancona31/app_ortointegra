import { test, expect, type Locator, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { SESION, CORREO, interruptorAgenda, pestanaConfig, soloEscritorio, sqlLocal, tituloUnico, toastConTexto } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { contarCorreos, esperarCorreo } from './mailpit'
import {
  api, cerrarEscenario, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, turnosLibres, verificarCorreo,
  type Escenario, type Turno,
} from './reservaPublicaAyudas'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'

/**
 * I5 · la barra de la agenda v2, la campana y los «Avisos» (puntos 13 a 20 de
 * Angel), con el interruptor encendido en la Clínica Semilla A:
 *   13-15. una sola fila (desde 1280 px): sin conteo ni «Compactar», atajos,
 *       «Ir a una fecha» ni fila de leyenda sueltos; la fecha es el botón del
 *       minicalendario; el engrane es un menú (APG) con las cinco opciones;
 *   16-18. la campana con punto rojo y dos pestañas, también en el teléfono y
 *       la tableta; en «Por confirmar», WhatsApp y correo en columnas fijas y
 *       el estado en UNA línea debajo de la fila;
 *   19. «Avisos»: reserva por enlace, cancelación y reagendado del paciente
 *       (por sus rutas de verdad), con aviso emergente, conservados hasta
 *       revisarlos y llevando a su cita (también `/agenda?cita=<id>`). Los de
 *       Google (evento por asignar y empalme) los produce el Google falso en
 *       `reserva-google.e2e.ts`;
 *   20. el correo a la clínica por cada reserva: apagado no sale; encendido,
 *       sale a los administradores sin nada clínico (Mailpit).
 *
 * MUTACIONES que lo ponen en rojo (comprobadas, cada prueba sola contra su
 * build): sin la regla de una fila de 1280 px (Agendar baja de fila); el menú
 * sin `aria-checked`; Escape sin devolver el foco; el conteo visible en la
 * banda v2 (teléfono y tableta); `CampanaAgenda` sin el punto rojo; las
 * columnas de WhatsApp y correo a `auto` (punto 17); la ruta de «Por
 * confirmar» sin avisos; pulsar un aviso sin abrir su cita; `revisar` sin el
 * PATCH (el aviso sigue sin revisar); `avisarReservaAClinica` sin mirar la
 * opción; la barra v2 con el interruptor apagado. Ojo: quitar SÓLO el
 * `nowrap` no la pone en rojo a 1280 en una semana corta (el filtro a 96 px ya
 * cabe); el `nowrap` es la red de un periodo largo.
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const ENLACE_CONF = /\/confirmar\/([A-Za-z0-9_-]{22})(?=[\s"<]|$)/

let e: Escenario
let desde = ''
let libres: Turno[] = []
let siguiente = 0
const citasPersonal: string[] = []
const pacientes: string[] = []

function turno(): Turno {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana elegida')
  return t
}

test.beforeAll(async () => {
  e = prepararEscenario()
  desde = marcaE2e()
  // Dentro de 6 semanas: lejos de los turnos de las e2e de D10 y de E.
  libres = await turnosLibres(e, emitirEnlace(e, 'unico').codigo, 42)
})

test.afterAll(() => {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _c on commit drop as select unnest(string_to_array(:'citas', ','))::uuid as id;
    delete from public.audit_log where registro_id in (select id from _c)
       or registro_id in (select id from public.cita_confirmaciones where appointment_id in (select id from _c));
    delete from public.cita_correos where appointment_id in (select id from _c);
    delete from public.cita_confirmaciones where appointment_id in (select id from _c);
    delete from public.avisos_clinica where cita_id in (select id from _c);
    delete from public.appointments where id in (select id from _c);
    delete from public.pacientes where id = any(string_to_array(:'pacientes', ',')::uuid[]);
    update public.agenda_ajustes set correo_reserva_clinica = false where clinica_id = ${CL};
    commit;`, { citas: citasPersonal.join(',') || '00000000-0000-0000-0000-000000000000', pacientes: pacientes.join(',') })
  limpiarReservasE2e(desde)
  cerrarEscenario()
})

/* ── Ayudas ─────────────────────────────────────────────────────────────── */

/** Una cita de MAÑANA del administrador en Centro con su paciente y su enlace de confirmación (copia de la de H4). */
function citaDeManana(hora: string, titulo: string, tel: string | null, correo: string | null, whatsappEn: string | null): string {
  const enlace = randomUUID()
  const codigo = codigoDeConfirmacion(enlace)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  const salida = sqlLocal(`
    with p as (insert into public.pacientes (clinica_id, nombre, apellidos, telefono, email)
               values (${CL}, :'titulo', 'I5', nullif(:'tel', ''), nullif(:'correo', '')) returning id),
         co as (select id, medico_id, nombre, timezone from public.consultorios
                 where clinica_id = ${CL} and nombre = 'Consultorio Centro (ficticio)'),
         d as (select (((now() at time zone :'tz')::date + 1) + :'hora'::time) at time zone :'tz' as t),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time,
                                                status, all_day, consultorio_nombre, consultorio_timezone, origen, whatsapp_reminder_sent_at)
               select ${CL}, (select id from p), co.medico_id, co.id, :'titulo', d.t, d.t + interval '30 min',
                      'scheduled', false, co.nombre, co.timezone, 'spinus', nullif(:'wa', '')::timestamptz from co, d returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', ${CL}, a.id, :'hash', a.paciente_id from a
    returning appointment_id || '|' || paciente_id;`,
  { titulo, tel: tel ?? '', correo: correo ?? '', tz: TZ, hora, enlace, hash: hashDeCodigo(codigo), wa: whatsappEn ?? '' })
  const [cita = '', paciente = ''] = salida.split('|')
  citasPersonal.push(cita)
  pacientes.push(paciente)
  return cita
}

/** Reserva con el enlace fijo (código al correo, como el paciente) y, con `origen`, como reagendado. */
async function reservarFijo(fijo: string, p: ReturnType<typeof personaNueva>, origen?: string): Promise<{ id: string; codigo: string }> {
  const ficha = await verificarCorreo(fijo, p.correo)
  const previos = await contarCorreos(p.correo, 'Tu cita con')
  const ctx = await api(ipAlAzar())
  try {
    const r = await ctx.post(`/api/reservar/${fijo}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio: turno().inicio, nombre: p.nombre, telefono: p.telefono,
      correo: p.correo, acepta_aviso: true, client_id: randomUUID(), ficha, ...(origen ? { origen } : {}),
    } })
    expect(r.status()).toBe(201)
  } finally {
    await ctx.dispose()
  }
  const comprobante = await esperarCorreo(p.correo, 'Tu cita con', previos)
  const codigo = ENLACE_CONF.exec(comprobante.texto)?.[1] ?? ''
  const id = sqlLocal(`select id from public.appointments where reserva_correo = :'c' order by created_at desc limit 1`, { c: p.correo })
  return { id, codigo }
}

/** Cancela como el paciente, por su enlace de confirmación (el POST del formulario). */
async function cancelarComoPaciente(codigo: string): Promise<void> {
  const ctx = await api(ipAlAzar())
  try {
    const r = await ctx.post(`/api/confirmar/${codigo}`, { form: { accion: 'cancelar' }, headers: { origin: 'http://localhost:3001' }, maxRedirects: 0 })
    expect(r.status()).toBe(303)
  } finally {
    await ctx.dispose()
  }
}

const campana = (page: Page): Locator => page.locator('[data-campana]').first()
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'Por confirmar y avisos' })
const aviso = (page: Page, tipo: string, cita: string): Locator => page.locator(`[data-aviso-tipo="${tipo}"][data-aviso-cita="${cita}"]`)

async function abrirAvisos(page: Page): Promise<void> {
  await campana(page).click()
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('tab', { name: /^Avisos/ }).click()
  await expect(panel(page).getByRole('tab', { name: /^Avisos/ })).toHaveAttribute('aria-selected', 'true')
}

function revisado(tipo: string, cita: string): string {
  return sqlLocal(`select coalesce(bool_and(revisado_en is not null)::text, 'sin') from public.avisos_clinica where tipo = :'t' and cita_id = :'c'`, { t: tipo, c: cita })
}

/* ── 13 a 15: la barra de escritorio ───────────────────────────────────── */

test('13-15 escritorio a 1280: una fila; la fecha abre el minicalendario; el engrane es un menú con sus cinco opciones', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrirAgendaV2(page)
  const fecha = page.locator('[data-selector-fecha]')
  await expect(fecha).toBeVisible()
  // Lo que salió de la barra.
  for (const fuera of ['.ag-controles-conteo', '.agenda-fc .ag-leyenda']) await expect(page.locator(fuera)).toHaveCount(0)
  for (const nombre of [/^Compactar/, /^Ocultar los días/, /^Densidad compacta$/, /^Atajos de teclado$/, /^Configuración de la agenda$/]) {
    await expect(page.getByRole('button', { name: nombre })).toHaveCount(0)
  }
  await expect(page.locator('.fc-toolbar-title')).toBeHidden()
  await expect(fecha).toContainText((await page.locator('.fc-toolbar-title').textContent())?.trim() ?? '—')
  // Una sola fila: ‹, la fecha, las vistas, la campana, el engrane y «Agendar» a la misma altura.
  const centros = await Promise.all(['.fc-prev-button', '[data-selector-fecha]', '.ag-controles [role="tablist"]', '[data-campana]',
    '[data-engrane-agenda]', '[data-onboard="nueva-cita"]'].map(async s => {
    const b = await page.locator(s).first().boundingBox()
    return b ? b.y + b.height / 2 : -1
  }))
  for (const c of centros) expect(Math.abs(c - centros[0])).toBeLessThan(4)

  // La fecha es el botón del minicalendario (APG: Escape lo cierra y el foco vuelve).
  await fecha.click()
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toHaveCount(0)
  await expect(fecha).toBeFocused()

  // El engrane, por teclado.
  const engrane = page.getByRole('button', { name: 'Opciones de la agenda' })
  await engrane.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Opciones de la agenda' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Configuración de la agenda' })).toBeFocused()
  await expect(menu.getByRole('menuitem')).toHaveText(['Configuración de la agenda', 'Atajos de teclado', 'Leyenda de estados'])
  const compactar = menu.getByRole('menuitemcheckbox', { name: /^Compactar la rejilla/ })
  await page.keyboard.press('ArrowDown')
  await expect(compactar).toBeFocused()
  const antes = await compactar.getAttribute('aria-checked')
  await page.keyboard.press('Space')
  await expect(compactar).toHaveAttribute('aria-checked', antes === 'true' ? 'false' : 'true')
  await expect(menu).toBeVisible() // una preferencia no cierra el menú
  await page.keyboard.press('Space') // y se deja como estaba
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Densidad compacta' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(engrane).toBeFocused()
  // Tab también cierra, y el foco vuelve al engrane (el menú vive en un Portal al final de la página).
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(engrane).toBeFocused()

  // «Leyenda de estados» y «Atajos de teclado» abren lo suyo.
  await engrane.click()
  await menu.getByRole('menuitem', { name: 'Leyenda de estados' }).click()
  const leyenda = page.getByRole('dialog', { name: 'Leyenda de estados' })
  await expect(leyenda).toContainText('Confirmada')
  await page.keyboard.press('Escape')
  await expect(leyenda).toHaveCount(0)
  await engrane.click()
  // Anuncia su tecla, como el botón de la barra al que sustituye (no se pierde `aria-keyshortcuts`).
  await expect(menu.getByRole('menuitem', { name: 'Atajos de teclado' })).toHaveAttribute('aria-keyshortcuts', '?')
  await menu.getByRole('menuitem', { name: 'Atajos de teclado' }).click()
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible()
  await page.keyboard.press('Escape')
  // «Configuración de la agenda» lleva a su pantalla.
  await engrane.click()
  await menu.getByRole('menuitem', { name: 'Configuración de la agenda' }).click()
  await page.waitForURL('**/agenda/configuracion')
})

/* ── 13, 15 y 18: teléfono y tableta ───────────────────────────────────── */

for (const [nombre, ancho, alto] of [['teléfono', 390, 844], ['tableta', 820, 1180]] as const) {
  test(`13, 15 y 18 · ${nombre}: sin conteo; la campana con sus dos pestañas y el engrane con su menú`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await abrirAgendaV2(page)
    const banda = page.locator('.ag-banda-movil')
    await expect(banda.locator('.ag-banda-movil-sub')).toHaveCount(0)
    await expect(banda.getByRole('button', { name: /^Compactar|^Ocultar los días/ })).toHaveCount(0)
    await expect(page.locator('.ag-leyenda')).toHaveCount(0)
    await banda.locator('[data-campana]').click()
    await expect(panel(page).getByRole('tab', { name: /^Por confirmar · \d+$/ })).toHaveAttribute('aria-selected', 'true')
    await panel(page).getByRole('tab', { name: /^Avisos · \d+$/ }).click()
    await expect(panel(page).locator('[data-pestana-avisos]')).toBeVisible()
    await expect(panel(page).locator('[data-pestana-por-confirmar]')).toBeHidden()
    const caja = await panel(page).boundingBox()
    expect(caja && caja.x >= 0 && caja.x + caja.width <= ancho).toBe(true) // dentro de la pantalla
    await page.keyboard.press('Escape')
    await banda.getByRole('button', { name: 'Opciones de la agenda' }).click()
    const menu = page.getByRole('menu', { name: 'Opciones de la agenda' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Configuración de la agenda', 'Leyenda de estados'])
  })
}

/* ── 16 y 17: la campana y las filas de «Por confirmar» ────────────────── */

test('16-17: punto rojo con pendientes; WhatsApp y correo en el mismo sitio en todas las filas; el estado en una línea debajo', async ({ page }) => {
  const ambos = citaDeManana('06:00', tituloUnico('I5 Ambos'), '9990000151', 'i5.ambos@semilla.spinus.test', new Date().toISOString())
  const correo = citaDeManana('06:15', tituloUnico('I5 Correo'), null, 'i5.correo@semilla.spinus.test', null)
  await abrirAgendaV2(page)
  await expect(campana(page).locator('[data-punto-rojo]')).toBeVisible()
  await campana(page).click()
  const filaA = page.locator(`[data-fila-por-confirmar="${ambos}"]`)
  const filaC = page.locator(`[data-fila-por-confirmar="${correo}"]`)
  await expect(filaA).toBeVisible()
  const caja = async (l: Locator) => {
    const b = await l.boundingBox()
    if (!b) throw new Error('sin caja')
    return b
  }
  // Las dos celdas existen en las dos filas y caen en la misma columna, del mismo tamaño.
  for (const celda of ['.ag-pc-celda--whatsapp', '.ag-pc-celda--correo']) {
    const [a, c] = [await caja(filaA.locator(celda)), await caja(filaC.locator(celda))]
    expect(Math.abs(a.x - c.x)).toBeLessThan(1)
    expect(Math.abs(a.width - c.width)).toBeLessThan(1)
  }
  const [mailA, mailC] = [await caja(filaA.getByRole('button', { name: 'Enviar confirmación por correo' })),
    await caja(filaC.getByRole('button', { name: 'Enviar confirmación por correo' }))]
  expect([Math.abs(mailA.x - mailC.x) < 1, Math.abs(mailA.width - mailC.width) < 1]).toEqual([true, true])
  // El estado: una sola línea, DEBAJO de la fila de botones, con lo de los dos.
  const estado = filaA.locator('[data-estado-fila]')
  await expect(estado).toHaveText(/^WhatsApp abierto \d\d:\d\d$/)
  await filaA.getByRole('button', { name: 'Enviar confirmación por correo' }).click()
  await expect(estado).toHaveText(/^WhatsApp abierto \d\d:\d\d · Correo enviado \d\d:\d\d$/)
  // Medido DESPUÉS del clic (el panel puede desplazarse al enfocar el botón).
  const [e1, boton] = [await caja(estado), await caja(filaA.getByRole('button', { name: 'Enviar confirmación por correo' }))]
  expect(e1.y).toBeGreaterThanOrEqual(boton.y + boton.height - 1)
  expect(e1.height).toBeLessThan(22) // una línea
  await expect(filaA.locator('[data-whatsapp-cita] p, [data-correo-cita] p')).toHaveCount(0) // nada debajo de cada botón
})

/* ── 19: los avisos ────────────────────────────────────────────────────── */

test('19: reserva, cancelación y reagendado del paciente → avisos con aviso emergente; se conservan hasta revisarlos; llevan a su cita', async ({ page }) => {
  await abrirAgendaV2(page)
  const fijo = emitirEnlace(e, 'fijo').codigo
  const p = personaNueva()

  // Reserva por enlace, con la agenda abierta: aviso emergente (sin el nombre) y el aviso en la campana.
  const primera = await reservarFijo(fijo, p)
  await expect(toastConTexto(page, 'Nueva reserva por enlace para el')).toBeVisible({ timeout: 15000 })
  await expect(campana(page).locator('[data-punto-rojo]')).toBeVisible()
  await abrirAvisos(page)
  await expect(aviso(page, 'reserva_enlace', primera.id)).toContainText(`${p.nombre} reservó por enlace`)
  await page.keyboard.press('Escape')

  // Cancela el paciente por su enlace: su aviso (el emergente de E8 no se duplica: uno solo).
  await cancelarComoPaciente(primera.codigo)
  await abrirAvisos(page)
  await expect(aviso(page, 'cancelacion_paciente', primera.id)).toBeVisible({ timeout: 15000 })
  await page.keyboard.press('Escape')

  // Reagenda con el mismo enlace: la cita nueva avisa como «reagendó», no como reserva nueva.
  const nueva = await reservarFijo(fijo, { ...personaNueva(), telefono: p.telefono, nombre: p.nombre }, primera.codigo)
  await expect(toastConTexto(page, 'Un paciente reagendó su cita')).toBeVisible({ timeout: 15000 })
  await abrirAvisos(page)
  await expect(aviso(page, 'reagendado_paciente', nueva.id)).toContainText(`${p.nombre} reagendó su cita`)
  await expect(aviso(page, 'reserva_enlace', nueva.id)).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Se conservan: recargar no los quita.
  await abrirAgendaV2(page)
  await abrirAvisos(page)
  for (const [t, c] of [['reserva_enlace', primera.id], ['cancelacion_paciente', primera.id], ['reagendado_paciente', nueva.id]]) {
    await expect(aviso(page, t, c)).toBeVisible()
    expect(revisado(t, c)).toBe('false')
  }
  await page.keyboard.press('Escape')

  // Un fallo pasajero del servidor llega como «no disponible»: la campana conserva la última lista buena.
  await page.route('**/api/agenda/por-confirmar', async r => {
    const real: Record<string, unknown> = await (await r.fetch()).json()
    await r.fulfill({ json: { ...real, avisos: [], avisos_disponibles: false } })
  })
  await abrirAvisos(page) // abrir la campana vuelve a pedir la lista
  await expect(aviso(page, 'reserva_enlace', primera.id)).toBeVisible()
  await expect(panel(page).getByRole('tab', { name: /^Avisos · [1-9]/ })).toBeVisible()
  await page.unroute('**/api/agenda/por-confirmar')
  await page.keyboard.press('Escape')

  // Si la base no apunta la revisión, el aviso vuelve a salir (nadie lo da por atendido sin estarlo).
  await page.route('**/api/avisos', r => r.request().method() === 'PATCH' ? r.fulfill({ status: 500, json: { error: 'error' } }) : r.fallback())
  await abrirAvisos(page)
  await aviso(page, 'reserva_enlace', primera.id).click()
  await expect(tarjetaLectura(page)).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')
  await abrirAvisos(page)
  await expect(aviso(page, 'reserva_enlace', primera.id)).toBeVisible()
  expect(revisado('reserva_enlace', primera.id)).toBe('false')
  await page.unroute('**/api/avisos')
  await page.keyboard.press('Escape')

  // Pulsar uno: se revisa y lleva a su cita. Tanda J (punto 7): la reagendada sigue POR LIGAR y es del
  // médico que mira, así que lleva a la ventana «Ligar e iniciar consulta» (antes, la tarjeta). La de
  // `primera`, cancelada, sigue llevando a la tarjeta (arriba).
  await abrirAvisos(page)
  await aviso(page, 'reagendado_paciente', nueva.id).click()
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Ligar e iniciar consulta' })).toBeVisible({ timeout: 10000 })
  await expect.poll(() => revisado('reagendado_paciente', nueva.id)).toBe('true')
  await page.keyboard.press('Escape')
  await abrirAgendaV2(page)
  await abrirAvisos(page)
  await expect(aviso(page, 'reagendado_paciente', nueva.id)).toHaveCount(0)
  await expect(aviso(page, 'reserva_enlace', primera.id)).toBeVisible()

  // Desde otra página: `/agenda?cita=<id>` abre la cita y se retira el parámetro.
  await page.goto(`/agenda?cita=${primera.id}`)
  await expect(tarjetaLectura(page)).toBeVisible({ timeout: 15000 })
  await expect(page).toHaveURL(/\/agenda$/)
  // Un error al leerla no se confunde con «no existe».
  await page.route(`**/rest/v1/appointments?*id=eq.${primera.id}*`, r => r.fulfill({ status: 500, json: { message: 'e2e' } }))
  await page.goto(`/agenda?cita=${primera.id}`)
  await expect(toastConTexto(page, 'No se pudo abrir esa cita.')).toBeVisible({ timeout: 15000 })
  await page.unroute(`**/rest/v1/appointments?*id=eq.${primera.id}*`)

  // La API sólo revisa los avisos que se le nombran: no hay «todos los de la clínica».
  expect((await page.request.patch('/api/avisos', { data: { todos: true } })).status()).toBe(400)
})

/* ── 20: el correo a la clínica ────────────────────────────────────────── */

test('20: el correo a la clínica por cada reserva: apagado de fábrica no sale; encendido sale a los administradores, sin nada clínico', async ({ page }) => {
  const admin = CORREO.adminA
  sqlLocal(`update public.agenda_ajustes set correo_reserva_clinica = false where clinica_id = ${CL}`)
  const fijo = emitirEnlace(e, 'fijo').codigo
  const previos = await contarCorreos(admin, 'Reserva nueva')
  await reservarFijo(fijo, personaNueva()) // espera al comprobante: el `after()` ya corrió
  expect(await contarCorreos(admin, 'Reserva nueva')).toBe(previos)

  // Se enciende desde la configuración, con su línea de explicación.
  await page.goto('/agenda/configuracion')
  await pestanaConfig(page, 'Plazos y recordatorios')
  const interruptor = page.getByRole('switch', { name: 'Avisar por correo de cada reserva' })
  await expect(interruptor).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText(/reciben un correo cada vez que un paciente reserva o reagenda por enlace/)).toBeVisible()
  await interruptor.click()
  await expect(interruptor).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => sqlLocal(`select correo_reserva_clinica from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('t')

  const p = personaNueva()
  await reservarFijo(fijo, p)
  const c = await esperarCorreo(admin, 'Reserva nueva', previos, 15000)
  expect(c.asunto).toContain(p.nombre)
  for (const parte of [c.texto, c.html]) {
    expect(parte).toContain(p.nombre)
    expect(parte).not.toContain(p.telefono)
    expect(parte).not.toContain(p.correo)
    expect(parte).not.toContain(e.tipoNombre) // nada clínico: ni el tipo de cita
  }
})

/* Integración I (I2 + I5): una reserva con el enlace de UN SOLO USO y SIN
   correo no lleva comprobante (I2), pero la clínica se entera igual (I5).
   MUTACIÓN: volver al `if (b.correo === null) return` de I2 antes del aviso,
   en `programarDespues` de `api/reservar/[codigo]` → rojo. */
test('20 · el único sin correo también avisa a la clínica, aunque no haya correo del paciente', async () => {
  const admin = CORREO.adminA
  sqlLocal(`update public.agenda_ajustes set correo_reserva_clinica = true where clinica_id = ${CL}`)
  const unico = emitirEnlace(e, 'unico').codigo
  const p = personaNueva()
  const previos = await contarCorreos(admin, 'Reserva nueva')
  const ctx = await api(ipAlAzar())
  try {
    const r = await ctx.post(`/api/reservar/${unico}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio: turno().inicio, nombre: p.nombre, telefono: p.telefono,
      acepta_aviso: true, client_id: randomUUID(),
    } })
    expect(r.status()).toBe(201)
  } finally {
    await ctx.dispose()
  }
  const c = await esperarCorreo(admin, 'Reserva nueva', previos, 15000)
  expect(c.asunto).toContain(p.nombre)
  expect(c.texto).not.toContain(p.telefono)
  expect(sqlLocal(`select reserva_correo is null from public.appointments where reserva_nombre = :'n'`, { n: p.nombre })).toBe('t')
})

/* ── Apagada: lo de siempre ────────────────────────────────────────────── */

test('apagada: la barra de siempre (conteo, Compactar, leyenda), sin campana ni engrane de menú', async ({ page }) => {
  interruptorAgenda('A', false)
  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/agenda')
    await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
    await expect(page.locator('.ag-controles-conteo')).toHaveCount(1)
    await expect(page.locator('.agenda-fc .ag-leyenda')).toBeVisible()
    await expect(page.locator('[data-campana], [data-engrane-agenda]')).toHaveCount(0)
    await expect(page.locator('.fc-toolbar-title')).toBeVisible()
  } finally {
    interruptorAgenda('A', true)
  }
})
