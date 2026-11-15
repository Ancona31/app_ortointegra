import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, sqlLocal } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * G3 · puntos 15, 17 y 19 de la tanda de diseño (y el ajuste de Angel al 17:
 * «las acciones dependen del estado de la cita»), con la maqueta «Burbuja y
 * tarjeta» de referencia. Interruptor encendido, semana +4 (nadie más la usa).
 *
 *   · Agendada: «Iniciar consulta» a todo el ancho; «Confirmar» | «Reagendar»
 *     en dos columnas iguales; «Enviar confirmación» (WhatsApp) a todo el ancho
 *     en UNA línea; «Cancelar cita» aparte, al final. Todos del mismo alto,
 *     márgenes iguales a izquierda y derecha, sin «Editar» (el engrane
 *     «Configuración de la cita» de la cabecera abre el formulario).
 *   · Confirmada: «Reagendar» | «Enviar recordatorio» (en DOS líneas).
 *   · Atendida: SÓLO «Ver expediente». Cancelada / No asistió: SÓLO «Reagendar
 *     cita», que reabre la MISMA cita (estado «Agendada», fecha enfocada).
 *   · La píldora del estado en la línea del nombre; fecha y hora juntas.
 *   · El logo de WhatsApp es el de `BotonWhatsAppCita` (los mismos trazos).
 *   · 19: la etiqueta de la hora y región del consultorio cuando difieren.
 *   · 15: en el formulario, «Enviar confirmación» y «Enviar confirmación por
 *     correo» («… recordatorio …» si está confirmada).
 *   · 17.3: el servidor rechaza lo que no corresponde al estado (una atendida
 *     no se confirma, no se cancela ni se mueve; se puede corregir a Agendada).
 *
 * MUTACIONES (comprobadas en rojo): `disposicionDeTarjeta` con las acciones de
 * antes (sin estado) → «atendida», «cancelada», «agendada» (orden); quitar la
 * regla de la impar a todo el ancho (`claseDePieza`) → «agendada» (rejilla);
 * `dosLineas` siempre `false` → «confirmada»; quitar `enConsultorio` de
 * `Cuando` → «etiqueta de huso»; quitar `vetoPorEstado` de la ruta → «17.3»;
 * quitar `reabrir` del modal → «reagendar cita»;
 * `pideComprobarNota` siempre `false` → «nota ligada».
 */
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const MARTES = diaDeLaSemana(4, 1)
const MIERCOLES = diaDeLaSemana(4, 2)
const creadas: string[] = []
/* El logo de hoy (`LogoWhatsApp` de `BotonWhatsAppCita.tsx`): sus dos trazos, tal cual. */
const LOGO = [
  ['#25D366', 'M12 2.2a9.8 9.8 0 0 0-8.5 14.7L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2z'],
  ['#fff', 'M9.1 6.9c-.3-.6-.5-.6-.8-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.2 3.1 1.3 3.3c.2.2 2.3 3.6 5.6 4.9 2.8 1.1 3.3.9 3.9.8.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4l-2.1-1c-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-1-2.3z'],
]

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  if (creadas.length) {
    sqlLocal(`
      delete from public.cita_correos where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.cita_confirmaciones where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);`, { ids: creadas.join(',') })
    creadas.length = 0
  }
  interruptorAgenda('A', false)
})

/** Una cita de admin.a (Consultorio Centro) con su estado, por SQL; `tz` cambia la zona del consultorio. */
function cita(fecha: string, hora: string, apellidos: string, estado: string, tz = 'America/Merida'): { id: string; paciente: string } {
  const fila = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
           consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz, :'ini'::timestamptz + interval '60 min', :'st',
           co.nombre, co.nombre_corto, co.direccion, co.telefono, :'tz', 'spinus', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = :'ap'
     where co.nombre = 'Consultorio Centro (ficticio)'
    returning id || '|' || paciente_id`, { ini: fechaHoraLocalAInstante(fecha, hora, TZ), st: estado, ap: apellidos, tz })
  const [id = '', paciente = ''] = fila.split('|')
  creadas.push(id)
  return { id, paciente }
}

async function abrirTarjeta(page: Page, apellidos: string): Promise<Locator> {
  await abrirAgendaV2(page)
  for (let i = 0; i < 4; i++) await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
  const enRejilla = test.info().project.name === 'telefono'
    ? page.locator('.fc-list-event', { hasText: apellidos }).first()
    : page.locator('.fc-timegrid-event', { hasText: apellidos }).first()
  await enRejilla.scrollIntoViewIfNeeded()
  await enRejilla.click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  return t
}

/** Los rótulos de la barra, en su orden (el nombre accesible de cada control). */
async function acciones(t: Locator): Promise<string[]> {
  const barra = t.getByRole('toolbar', { name: 'Acciones de la cita' })
  return barra.locator('button, a[href]').evaluateAll(els => els.map(e => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()))
}

async function caja(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox()
  if (!b) throw new Error('sin caja')
  return b
}

test('agendada: orden, rejilla pareja (mismos anchos y altos), márgenes iguales, WhatsApp a todo el ancho en una línea, cancelar aparte', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  cita(MARTES, '09:00', 'Prueba 21', 'scheduled')
  const t = await abrirTarjeta(page, 'Prueba 21')
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Confirmar', 'Reagendar', 'Enviar confirmación', 'Cancelar cita'])
  await expect(t.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
  // Cabecera: el nombre y la píldora en la misma línea; engrane y ✕ arriba.
  const [nombre, pildora, engrane, cerrar] = await Promise.all([
    caja(t.getByRole('heading')), caja(t.locator('.ag-lectura-pildora').first()),
    caja(t.getByRole('button', { name: 'Configuración de la cita' })), caja(t.getByRole('button', { name: 'Cerrar' }))])
  expect(pildora.y).toBeLessThan(nombre.y + nombre.height)
  expect(pildora.x).toBeGreaterThan(nombre.x + nombre.width - 1)
  expect(Math.abs(engrane.y - cerrar.y)).toBeLessThan(1)
  await expect(t.locator('.ag-lectura-cuando')).toContainText(/^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d{1,2} \w+ · 09:00 – 10:00/)
  await expect(t.locator('.ag-lectura-datos')).toContainText('Médico')
  await expect(t.locator('.ag-lectura-datos')).toContainText('Consultorio Centro (ficticio)')
  // Rejilla pareja.
  const b = (n: string): Locator => t.getByRole('button', { name: n, exact: true })
  const [ini, con, rea, wa, can, dlg] = await Promise.all([caja(b('Iniciar consulta')), caja(b('Confirmar')), caja(b('Reagendar')),
    caja(b('Enviar confirmación')), caja(b('Cancelar cita')), caja(t)])
  expect(Math.abs(con.y - rea.y)).toBeLessThan(1)
  expect(Math.abs(con.width - rea.width)).toBeLessThan(1)
  for (const x of [con, rea, wa]) expect(Math.abs(x.height - ini.height)).toBeLessThan(1)
  expect(Math.abs(ini.width - (rea.x + rea.width - con.x))).toBeLessThan(1)
  expect(Math.abs(wa.width - ini.width)).toBeLessThan(1)
  expect(Math.abs((ini.x - dlg.x) - (dlg.x + dlg.width - (ini.x + ini.width)))).toBeLessThan(1.5)
  // WhatsApp a todo el ancho: en UNA línea.
  await expect(b('Enviar confirmación').locator('.ag-capa-dos-lineas')).toHaveCount(0)
  // Cancelar aparte, al final y centrado.
  expect(can.y).toBeGreaterThan(wa.y + wa.height)
  expect(Math.abs((can.x + can.width / 2) - (dlg.x + dlg.width / 2))).toBeLessThan(1.5)
  // El logo de WhatsApp de la app, tal cual.
  const trazos = await b('Enviar confirmación').locator('svg path').evaluateAll(ps => ps.map(p => [p.getAttribute('fill'), p.getAttribute('d')]))
  expect(trazos).toEqual(LOGO)
})

test('confirmada: «Reagendar» | «Enviar recordatorio» en dos líneas; cancelar aparte', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  cita(MARTES, '11:00', 'Prueba 22', 'confirmed')
  const t = await abrirTarjeta(page, 'Prueba 22')
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Reagendar', 'Enviar recordatorio', 'Cancelar cita'])
  const wa = t.getByRole('button', { name: 'Enviar recordatorio', exact: true })
  const [r, w] = [await caja(t.getByRole('button', { name: 'Reagendar', exact: true })), await caja(wa)]
  expect(Math.abs(r.y - w.y)).toBeLessThan(1)
  expect(Math.abs(r.width - w.width)).toBeLessThan(1)
  expect(Math.abs(r.height - w.height)).toBeLessThan(1)
  const [arriba, abajo] = await wa.locator('.ag-capa-dos-lineas > span').evaluateAll(ss => ss.map(s => s.getBoundingClientRect().top))
  expect(abajo).toBeGreaterThan((arriba ?? 0) + 5)
  await expect(wa.locator('.ag-capa-dos-lineas > span').first()).toHaveText('Enviar')
  await expect(wa.locator('.ag-capa-dos-lineas > span').last()).toHaveText('recordatorio')
})

test('atendida: ÚNICAMENTE «Ver expediente», que lleva al expediente', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { paciente } = cita(MARTES, '13:00', 'Prueba 23', 'attended')
  const t = await abrirTarjeta(page, 'Prueba 23')
  expect(await acciones(t)).toEqual(['Ver expediente'])
  await t.getByRole('button', { name: 'Ver expediente' }).click()
  await page.waitForURL(`**/expediente/${paciente}`)
})

test('cancelada y no asistió: ÚNICAMENTE «Reagendar cita», que reabre la MISMA cita como agendada en otra fecha', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { id } = cita(MARTES, '15:00', 'Prueba 24', 'cancelled')
  cita(MARTES, '16:30', 'Prueba 25', 'no_show')
  let t = await abrirTarjeta(page, 'Prueba 25')
  expect(await acciones(t)).toEqual(['Reagendar cita'])
  await page.keyboard.press('Escape')
  t = tarjetaLectura(page)
  await expect(t).toHaveCount(0)
  await page.locator('.fc-timegrid-event', { hasText: 'Prueba 24' }).first().click({ position: { x: 8, y: 8 } })
  await expect(t).toHaveAccessibleName('Paciente Prueba 24')
  await expect.poll(() => acciones(t)).toEqual(['Reagendar cita'])
  await t.getByRole('button', { name: 'Reagendar cita' }).click()
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  const fecha = modal.locator('input[type="date"]').first()
  await expect(fecha).toBeFocused()
  await fecha.fill(MIERCOLES)
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click()
  /* Si sale un aviso (empalme u horario), se acepta: aquí no se prueba. */
  const aviso = page.getByRole('dialog', { name: /Se empalma|fuera de/i })
  const res = await Promise.race([put, aviso.waitFor({ timeout: 4000 }).then(async () => {
    await aviso.getByRole('button', { name: 'Aceptar' }).click()
    return put
  }).catch(() => put)])
  expect(res.request().postDataJSON()).toMatchObject({ status: 'scheduled' })
  await expect.poll(() => sqlLocal(`select status || '|' || to_char(start_time at time zone 'America/Merida', 'YYYY-MM-DD') from public.appointments where id = :'id'`, { id }))
    .toBe(`scheduled|${MIERCOLES}`)
})

test('punto 19: la etiqueta de la hora y la región del consultorio, cuando difieren de las del dispositivo', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  cita(MARTES, '17:30', 'Prueba 20', 'scheduled', 'America/Tijuana')
  const t = await abrirTarjeta(page, 'Prueba 20')
  await expect(t.locator('.ag-lectura-huso')).toHaveText(/^\d\d:\d\d–\d\d:\d\d hora Baja California$/)
  await page.keyboard.press('Escape')
  cita(MIERCOLES, '09:00', 'Prueba 19', 'scheduled')
  await page.locator('.fc-timegrid-event', { hasText: 'Prueba 19' }).first().click({ position: { x: 8, y: 8 } })
  await expect(tarjetaLectura(page).locator('.ag-lectura-huso')).toHaveCount(0)
})

test('punto 15: el formulario ofrece «Enviar confirmación» y «Enviar confirmación por correo» (y «recordatorio» si ya se confirmó)', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  cita(MIERCOLES, '11:00', 'Prueba 18', 'scheduled')
  cita(MIERCOLES, '13:00', 'Prueba 17', 'confirmed')
  for (const [ap, palabra] of [['Prueba 18', 'confirmación'], ['Prueba 17', 'recordatorio']] as const) {
    const t = ap === 'Prueba 18' ? await abrirTarjeta(page, ap) : tarjetaLectura(page)
    if (ap === 'Prueba 17') await page.locator('.fc-timegrid-event', { hasText: ap }).first().click({ position: { x: 8, y: 8 } })
    await t.getByRole('button', { name: 'Configuración de la cita' }).click()
    const modal = modalCita(page, 'Editar cita')
    await expect(modal.getByRole('button', { name: `Enviar ${palabra}`, exact: true })).toBeVisible()
    await expect(modal.getByRole('button', { name: `Enviar ${palabra} por correo`, exact: true })).toBeVisible()
    await expect(modal.getByRole('button', { name: `Enviar ${palabra}`, exact: true }).locator('svg path[fill="#25D366"]')).toHaveCount(1)
    await modal.getByRole('button', { name: 'Cerrar' }).first().click()
    await expect(modal).toHaveCount(0)
  }
})

test('17.3: el servidor rechaza confirmar, cancelar o mover una atendida; corregirla a agendada, sí', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { id } = cita(MIERCOLES, '15:00', 'Prueba 16', 'attended')
  const put = (data: Record<string, unknown>) => page.request.put(`/api/appointments/${id}`, { data })
  const otraHora = fechaHoraLocalAInstante(MIERCOLES, '16:00', TZ)
  for (const cuerpo of [{ status: 'confirmed' }, { status: 'cancelled' },
    { start_time: otraHora, end_time: new Date(new Date(otraHora).getTime() + 3_600_000).toISOString() }]) {
    const r = await put(cuerpo)
    expect(r.status(), JSON.stringify(cuerpo)).toBe(409)
    expect(await r.json()).toMatchObject({ error: 'estado_no_admite' })
  }
  expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('attended')
  expect((await put({ status: 'scheduled' })).status()).toBe(200)
  expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('scheduled')
})

/* G3 · Decisión de Angel: una atendida CON nota clínica ligada no cambia de
   estado ni se borra, con la v2 encendida o apagada; sin nota, sí (la prueba de
   arriba). La nota de prueba se crea y se BORRA aquí como `postgres` (dato de
   prueba en la base local: la semilla se niega a borrar expediente).
   MUTACIÓN: `pideComprobarNota` siempre `false` → rojo. */
test('nota ligada: una atendida con nota no cambia de estado ni se borra, con o sin v2', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { id, paciente } = cita(MIERCOLES, '17:00', 'Prueba 14', 'attended')
  const medico = sqlLocal(`select medico_id from public.appointments where id = :'id'`, { id })
  const nota = sqlLocal(`insert into public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
    values (:'p', :'m', 'NOTA DE PRUEBA G3', 'manual', :'id') returning id`, { p: paciente, m: medico, id })
  try {
    for (const encendida of [true, false]) {
      interruptorAgenda('A', encendida)
      for (const estado of ['scheduled', 'no_show', 'cancelled', 'confirmed']) {
        const r = await page.request.put(`/api/appointments/${id}`, { data: { status: estado } })
        expect(r.status(), `${estado} con v2 ${encendida}`).toBe(409)
        expect(await r.json()).toMatchObject({ error: 'nota_ligada' })
      }
      const d = await page.request.delete(`/api/appointments/${id}`)
      expect(d.status()).toBe(409)
      expect(await d.json()).toMatchObject({ error: 'nota_ligada' })
      // Las notas y la hora sí se pueden tocar con la v2 apagada (como hoy): sólo el estado está cerrado.
      expect((await page.request.put(`/api/appointments/${id}`, { data: { notes: 'otra nota de agenda', status: 'attended' } })).status()).toBe(200)
    }
    expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('attended')
  } finally {
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.audit_log where registro_id = :'n'; delete from public.consultas where id = :'n'; commit;`, { n: nota })
  }
})

test('teléfono: la hoja lleva el mismo orden y el engrane', async ({ page }) => {
  test.skip(test.info().project.name !== 'telefono', 'teléfono')
  cita(MARTES, '09:00', 'Prueba 15', 'scheduled')
  const t = await abrirTarjeta(page, 'Prueba 15')
  await expect(t).toHaveClass(/ag-hoja/)
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Confirmar', 'Reagendar', 'Enviar confirmación', 'Cancelar cita'])
  const [ini, con] = [await caja(t.getByRole('button', { name: 'Iniciar consulta' })), await caja(t.getByRole('button', { name: 'Confirmar' }))]
  expect(ini.height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(ini.height - con.height)).toBeLessThan(1)
})
