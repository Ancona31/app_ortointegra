import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, sqlLocal } from './ayudas'
import { abrirAgendaV2, editarDesdeTarjeta, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * G3 · puntos 15, 17 y 19 de la tanda de diseño (y el ajuste de Angel al 17:
 * «las acciones dependen del estado de la cita»), con la maqueta «Burbuja y
 * tarjeta» de referencia. Interruptor encendido, semana +4 (nadie más la usa).
 *
 *   TANDA K, PUNTO 21: la tarjeta es ahora la burbuja de `docs/spec/Burbuja.dc.html`. Lo que
 *   esta prueba mira se conserva, en sus sitios nuevos:
 *   · Agendada: «Iniciar consulta» a todo el ancho; «Confirmar» | «Reagendar» | «Editar» en
 *     una rejilla pareja (mismos anchos y altos); «Cancelar cita» aparte, en el pie. Márgenes
 *     iguales. «Confirmar» abre «Enviar por WhatsApp» (el logo de la app), «Enviar por correo» y
 *     «Marcar como confirmada». Los tres puntos sustituyen al engrane.
 *   · Confirmada: «Reagendar» | «Editar» | «No asistió»; los recordatorios en los tres puntos.
 *   · Atendida: SÓLO «Ver la consulta». Cancelada: «Darle otra cita» y «Reasignar el horario»;
 *     no asistió: sólo «Darle otra cita», que abre el alta de una cita NUEVA (mismo paciente,
 *     médico y consultorio, fecha enfocada) y deja la original como estaba.
 *   · La píldora del estado arriba; la hora con su duración y el día, juntos.
 *   · 19: la etiqueta de la hora y región del consultorio cuando difieren.
 *   · 15: en el formulario, «Enviar confirmación» y «Enviar confirmación por
 *     correo» («… recordatorio …» si está confirmada).
 *   · 17.3: el servidor rechaza lo que no corresponde al estado (una atendida
 *     no se confirma, no se cancela ni se mueve; se puede corregir a Agendada).
 *
 * MUTACIONES (comprobadas en rojo): `disposicionDeTarjeta` con las acciones de
 * antes (sin estado) → «atendida», «cancelada», «agendada» (orden); la rejilla
 * sin `gridTemplateColumns` → «agendada» (rejilla pareja); `no-asistio` con
 * `'no_show'` cambiado por `'cancelled'` → «confirmada»; quitar `enConsultorio`
 * de `Info` → «etiqueta de huso»; sin el `else` que enfoca «Confirmar» al cerrar con Escape,
 * o `enColumna` siempre `false` → «agendada»; el panel de los tres puntos sin cerrarse al
 * recibir un mensaje (`alMensaje={setMensaje}`) → «confirmada»; quitar `vetoPorEstado` de la ruta → «17.3»;
 * volver a editar la misma cita en «Darle otra cita» → «crea una cita NUEVA»;
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
  /* Integración G1–G4 · la tarjeta entra con `ag-capa-entra` (`scale(.97)` →
     1, `--ag-dur-base`). Medir anchos con varias `boundingBox` a mitad de la
     entrada compara cuadros con escalas distintas (en la batería salió 1,46 px
     en «agendada»). Se mide cuando la entrada terminó. */
  await t.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.then(() => true, () => true))))
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

test('agendada: orden, rejilla pareja (mismos anchos y altos), márgenes iguales, «Confirmar» con sus tres opciones, cancelar en el pie', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  cita(MARTES, '09:00', 'Prueba 21', 'scheduled')
  const t = await abrirTarjeta(page, 'Prueba 21')
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Confirmar', 'Reagendar', 'Editar', 'Cancelar cita'])
  await expect(t.getByRole('button', { name: 'Configuración de la cita' })).toHaveCount(0)
  // Cabecera: la píldora arriba y el nombre debajo; los tres puntos y la ✕ en la línea de la píldora.
  const [nombre, pildora, puntos, cerrar] = await Promise.all([
    caja(t.getByRole('heading')), caja(t.locator('.ag-burbuja-estado')),
    caja(t.getByRole('button', { name: 'Más opciones de la cita' })), caja(t.getByRole('button', { name: 'Cerrar' }))])
  expect(pildora.y + pildora.height).toBeLessThanOrEqual(nombre.y + 1)
  expect(Math.abs(puntos.y - cerrar.y)).toBeLessThan(1)
  await expect(t.locator('.ag-burbuja-estado')).toHaveText('Agendada')
  await expect(t.locator('.ag-burbuja-hora')).toHaveText('09:00 – 10:00 · 60 min')
  await expect(t.locator('.ag-burbuja-dia')).toHaveText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo) \d{1,2} de \w+$/)
  await expect(t.locator('.ag-burbuja-medico')).toContainText('Dr.')
  // Rejilla pareja.
  const b = (n: string): Locator => t.getByRole('button', { name: n, exact: true })
  const [ini, con, rea, edi, can, dlg] = await Promise.all([caja(b('Iniciar consulta')), caja(b('Confirmar')), caja(b('Reagendar')),
    caja(b('Editar')), caja(b('Cancelar cita')), caja(t)])
  for (const x of [rea, edi]) {
    expect(Math.abs(x.y - con.y)).toBeLessThan(1)
    expect(Math.abs(x.width - con.width)).toBeLessThan(1)
    expect(Math.abs(x.height - con.height)).toBeLessThan(1)
  }
  expect(con.height).toBeGreaterThanOrEqual(68)
  expect(ini.height).toBeGreaterThanOrEqual(52)
  expect(Math.abs(ini.width - (edi.x + edi.width - con.x))).toBeLessThan(1)
  expect(Math.abs((ini.x - dlg.x) - (dlg.x + dlg.width - (ini.x + ini.width)))).toBeLessThan(1.5)
  // Cancelar en el pie: debajo de la rejilla, a todo el ancho de la burbuja.
  expect(can.y).toBeGreaterThan(con.y + con.height)
  expect(Math.abs(can.width - (dlg.width - 2))).toBeLessThan(2)
  // «Confirmar» abre sus tres opciones, en su orden; el WhatsApp con el logo de la app, tal cual.
  await b('Confirmar').click()
  await expect(b('Confirmar')).toHaveAttribute('aria-expanded', 'true')
  const opciones = t.getByRole('group', { name: 'Confirmar la cita' })
  await expect(opciones.getByRole('button')).toHaveText(['Enviar por WhatsApp', 'Enviar por correo', 'Marcar como confirmada'])
  const trazos = await b('Enviar por WhatsApp').locator('svg path').evaluateAll(ps => ps.map(p => [p.getAttribute('fill'), p.getAttribute('d')]))
  expect(trazos).toEqual(LOGO)
  // Las opciones son una columna: abajo y arriba las recorren.
  await b('Enviar por WhatsApp').focus()
  await page.keyboard.press('ArrowDown')
  await expect(b('Enviar por correo')).toBeFocused()
  // Escape cierra lo desplegado, no la burbuja, y el foco vuelve a «Confirmar».
  await page.keyboard.press('Escape')
  await expect(opciones).toHaveCount(0)
  await expect(t).toBeVisible()
  await expect(b('Confirmar')).toBeFocused()
  // Los tres puntos: observaciones, tipo, «No asistió» y, como dato, el consultorio.
  await b('Más opciones de la cita').click()
  const mas = t.getByRole('group', { name: 'Más opciones de la cita' })
  await expect(mas.getByRole('button')).toHaveText([/^Observaciones/, /^Tipo de cita/, 'No asistió'])
  await expect(mas).toContainText('Consultorio Centro (ficticio)')
})

/* Tanda K, punto 21: «No asistió» de la rejilla de la confirmada manda el mismo PUT parcial
   que «Marcar como confirmada», con `no_show`. MUTACIÓN: `'no_show'` → `'cancelled'` en
   `ejecutarAccion` → rojo. */
test('confirmada: Reagendar | Editar | No asistió, los recordatorios en los tres puntos, y «No asistió» manda PUT no_show', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { id } = cita(MARTES, '11:00', 'Prueba 22', 'confirmed')
  const t = await abrirTarjeta(page, 'Prueba 22')
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Reagendar', 'Editar', 'No asistió', 'Cancelar cita'])
  await t.getByRole('button', { name: 'Más opciones de la cita' }).click()
  const mas = t.getByRole('group', { name: 'Más opciones de la cita' })
  await expect(mas.getByRole('button', { name: 'Recordatorio por WhatsApp' })).toBeVisible()
  await expect(mas.getByRole('button', { name: 'Recordatorio por correo' })).toBeVisible()
  await expect(mas.getByRole('button', { name: 'No asistió' })).toHaveCount(0)
  // Lo que dice el envío no queda tapado: el panel se cierra y el mensaje sale bajo las casillas.
  await mas.getByRole('button', { name: 'Recordatorio por correo' }).click()
  await expect(mas).toHaveCount(0)
  await expect(t.locator('.ag-lectura-mensaje')).not.toBeEmpty()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await t.getByRole('toolbar').getByRole('button', { name: 'No asistió', exact: true }).click()
  expect((await put).request().postDataJSON()).toMatchObject({ status: 'no_show' })
  await expect.poll(() => sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('no_show')
})

test('atendida: ÚNICAMENTE «Ver la consulta», que lleva al expediente', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { paciente } = cita(MARTES, '13:00', 'Prueba 23', 'attended')
  const t = await abrirTarjeta(page, 'Prueba 23')
  expect(await acciones(t)).toEqual(['Ver la consulta'])
  await t.getByRole('button', { name: 'Ver la consulta' }).click()
  await page.waitForURL(`**/expediente/${paciente}`)
})

/* Decisión de Angel: «Reagendar cita» (tanda K: «Darle otra cita») CREA una cita nueva (mismo paciente,
   médico y consultorio) y deja la original como estaba: su estado, y con él lo
   que cuenta para el candado. MUTACIÓN: volver a abrir la edición de la misma
   cita (`setModal({ mode: 'edit', … })`) → rojo («Nueva cita» no aparece).
   Tanda I (punto 12): la cancelada ofrece además «Reasignar» (tanda K: «Reasignar el horario»), y al reagendarla
   queda CERRADA y ligada a la nueva (sin cambiar de estado); la no asistida, no. */
test('cancelada y no asistió: «Darle otra cita» (y «Reasignar el horario» la cancelada) crea una cita NUEVA; la original conserva su estado', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'escritorio')
  const { id, paciente } = cita(MARTES, '15:00', 'Prueba 24', 'cancelled')
  const { id: falta } = cita(MARTES, '16:30', 'Prueba 25', 'no_show')
  const original = (x: string): string => sqlLocal(`select status || '|' || start_time || '|' || updated_at from public.appointments where id = :'x'`, { x })
  const [antesCancelada, antesFalta] = [original(id), original(falta)]
  let t = await abrirTarjeta(page, 'Prueba 25')
  expect(await acciones(t)).toEqual(['Darle otra cita'])
  await expect(t).toContainText('El paciente no llegó a esta cita.')
  await page.keyboard.press('Escape')
  t = tarjetaLectura(page)
  await expect(t).toHaveCount(0)
  await page.locator('.fc-timegrid-event', { hasText: 'Prueba 24' }).first().click({ position: { x: 8, y: 8 } })
  await expect(t).toHaveAccessibleName('Paciente Prueba 24')
  await expect.poll(() => acciones(t)).toEqual(['Darle otra cita', 'Reasignar el horario'])
  await expect(t).toContainText('Esta cita se canceló. Su horario quedó libre.')
  await t.getByRole('button', { name: 'Darle otra cita' }).click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Paciente Prueba 24')
  const fecha = modal.locator('input[type="date"]').first()
  await expect(fecha).toBeFocused()
  await fecha.fill(MIERCOLES)
  const post = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST' && r.ok())
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click()
  /* Si sale un aviso (empalme u horario), se acepta: aquí no se prueba. */
  const aviso = page.getByRole('dialog', { name: /Se empalma|fuera de/i })
  const res = await Promise.race([post, aviso.waitFor({ timeout: 4000 }).then(async () => {
    await aviso.getByRole('button', { name: 'Aceptar' }).click()
    return post
  }).catch(() => post)])
  const enviado = res.request().postDataJSON() as Record<string, unknown>
  const [medico, consultorio] = sqlLocal(`select medico_id || '|' || consultorio_id from public.appointments where id = :'id'`, { id }).split('|')
  expect(enviado).toMatchObject({ paciente_id: paciente, medico_id: medico, consultorio_id: consultorio, status: 'scheduled' })
  const nueva = ((await res.json()) as { appointment: { id: string } }).appointment.id
  creadas.push(nueva)
  expect(nueva).not.toBe(id)
  expect(sqlLocal(`select to_char(start_time at time zone 'America/Merida', 'YYYY-MM-DD HH24:MI') || '|' || to_char(end_time at time zone 'America/Merida', 'HH24:MI')
                     from public.appointments where id = :'n'`, { n: nueva })).toBe(`${MIERCOLES} 15:00|16:00`)
  // La cancelada sigue cancelada, ahora cerrada y ligada a la nueva; la de «no asistió», intacta.
  expect(antesCancelada.startsWith('cancelled|')).toBe(true)
  expect(sqlLocal(`select status || '|' || (cerrada_en is not null) || '|' || sustituida_por from public.appointments where id = :'id'`, { id }))
    .toBe(`cancelled|true|${nueva}`)
  expect(original(falta)).toBe(antesFalta)
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
    await editarDesdeTarjeta(page)
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
      // Las notas sí se pueden tocar con la v2 apagada (como hoy); el estado no, y la hora tampoco (tanda I, punto 1).
      expect((await page.request.put(`/api/appointments/${id}`, { data: { notes: 'otra nota de agenda', status: 'attended' } })).status()).toBe(200)
    }
    expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('attended')
  } finally {
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.audit_log where registro_id = :'n'; delete from public.consultas where id = :'n'; commit;`, { n: nota })
  }
})

test('teléfono: la hoja lleva el mismo orden y los tres puntos', async ({ page }) => {
  test.skip(test.info().project.name !== 'telefono', 'teléfono')
  cita(MARTES, '09:00', 'Prueba 15', 'scheduled')
  const t = await abrirTarjeta(page, 'Prueba 15')
  await expect(t).toHaveClass(/ag-hoja/)
  expect(await acciones(t)).toEqual(['Iniciar consulta', 'Confirmar', 'Reagendar', 'Editar', 'Cancelar cita'])
  await expect(t.getByRole('button', { name: 'Más opciones de la cita' })).toBeVisible()
  const [ini, con] = [await caja(t.getByRole('button', { name: 'Iniciar consulta' })), await caja(t.getByRole('button', { name: 'Confirmar' }))]
  expect(ini.height).toBeGreaterThanOrEqual(44)
  expect(con.height).toBeGreaterThanOrEqual(44)
})
