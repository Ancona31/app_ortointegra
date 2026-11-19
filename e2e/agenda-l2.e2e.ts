import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda L, agente L2, puntos 9, 11 y 12 de Angel. Semana +8 (nadie más la usa).
 *   · 9: «Eliminar cita» en la burbuja de una CANCELADA: pregunta; «Cancelar» no hace nada;
 *     «Aceptar» la quita de la agenda (también en la pantalla de OTRA persona, en tiempo real)
 *     SIN borrarla: queda cancelada y cerrada sin sustituta, y en audit_log.
 *   · 11: en computadora, el botón «Leyenda de estados» a la izquierda de Mes/Semana/Día abre
 *     la leyenda de siempre (la del engrane, que sigue ahí); Escape la cierra y devuelve el foco.
 *     En el teléfono, como estaba (sin botón).
 *   · 12: la burbuja con la escala de la página de reserva (título 18, hora 15, texto 14) y las
 *     áreas de toque de 44 px o más.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `quitarCancelada` sin el `fetch` → «Eliminar cita» (la base no la cierra);
 *   · sin `leyenda=` en `AgendaCliente` → «el botón de la leyenda»;
 *   · `.ag-burbuja-titulo` de vuelta a 21px → «la escala de la reserva».
 *   · integración L: `.ag-burbuja-estado` de vuelta a 700, o `.ag-burbuja-ayuda` a 13px → la misma prueba.
 */
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const MARTES = diaDeLaSemana(8, 1)
const creadas: string[] = []

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterAll(() => {
  try {
    if (creadas.length) {
      sqlLocal(`begin; set local session_replication_role = replica;
        delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]); commit;`, { ids: creadas.join(',') })
    }
  } finally { interruptorAgenda('A', false) }
})

function cita(hora: string, apellidos: string, estado: string): string {
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
           consultorio_nombre, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz, :'ini'::timestamptz + interval '45 min', :'st',
           co.nombre, :'tz', 'spinus', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = :'ap'
     where co.nombre = 'Consultorio Centro (ficticio)' returning id`, { ini: fechaHoraLocalAInstante(MARTES, hora, TZ), st: estado, ap: apellidos, tz: TZ })
  creadas.push(id)
  return id
}

async function aLaSemana(page: Page): Promise<void> {
  await abrirAgendaV2(page)
  const asistencia = page.getByRole('dialog', { name: '¿Asistió el paciente?' })
  if (await asistencia.isVisible().catch(() => false)) await asistencia.getByRole('button', { name: 'Decidir después' }).click()
  for (let i = 0; i < 8; i++) await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
}

function cajaDe(page: Page, texto: string): Locator {
  return (test.info().project.name === 'telefono' ? page.locator('.fc-list-event', { hasText: texto }) : page.locator('.fc-timegrid-event', { hasText: texto })).first()
}

async function abrir(page: Page, texto: string): Promise<Locator> {
  const c = cajaDe(page, texto)
  await c.scrollIntoViewIfNeeded()
  await c.click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  return t
}

test('Eliminar cita: pregunta, «Cancelar» no hace nada; «Aceptar» la quita de la agenda (también de otra pantalla) sin borrarla', async ({ page, browser }) => {
  test.skip(test.info().project.name !== 'escritorio', 'el tiempo real y la base se miran una vez; el teléfono usa la misma acción')
  const id = cita('10:00', 'Prueba 07', 'cancelled')
  const otra = await browser.newContext({ storageState: SESION.secretariaA })
  try {
    const vecina = await otra.newPage()
    await aLaSemana(vecina)
    await expect(cajaDe(vecina, 'Prueba 07')).toBeVisible()
    await aLaSemana(page)
    let t = await abrir(page, 'Prueba 07')
    await t.getByRole('button', { name: 'Eliminar cita', exact: true }).click()
    const texto = '¿Eliminar la cita cancelada de Paciente Prueba 07? Sale de la agenda y no se puede deshacer; queda guardada en el historial.'
    let aviso = page.getByRole('dialog', { name: texto })
    await expect(aviso).toBeVisible()
    await aviso.getByRole('button', { name: 'Cancelar' }).click()
    await expect(aviso).toHaveCount(0)
    expect(sqlLocal(`select (cerrada_en is null)::text from public.appointments where id = :'id'`, { id })).toBe('true')
    await expect(cajaDe(page, 'Prueba 07')).toBeVisible()

    t = await abrir(page, 'Prueba 07')
    await t.getByRole('button', { name: 'Eliminar cita', exact: true }).click()
    aviso = page.getByRole('dialog', { name: texto })
    const post = page.waitForResponse(r => r.url().endsWith(`/api/appointments/${id}/quitar`) && r.request().method() === 'POST')
    await aviso.getByRole('button', { name: 'Aceptar' }).click()
    expect((await post).status()).toBe(200)
    await expect(cajaDe(page, 'Prueba 07')).toHaveCount(0)
    await expect(cajaDe(vecina, 'Prueba 07')).toHaveCount(0)
    // En la base: sigue, cancelada, cerrada SIN sustituta; y en la auditoría, a nombre de quien pulsó.
    await expect.poll(() => sqlLocal(`select status || '|' || (cerrada_en is not null)::text || '|' || coalesce(sustituida_por::text, 'sin')
                                        from public.appointments where id = :'id'`, { id })).toBe('cancelled|true|sin')
    expect(sqlLocal(`select count(*) from public.audit_log a join auth.users u on u.id::text = a.user_id
                      where a.registro_id = :'id' and a.accion = 'cita_quitada_de_agenda' and u.email = 'admin.a@semilla.spinus.test'`, { id })).toBe('1')
    await page.reload()
    await aLaSemana(page)
    await expect(cajaDe(page, 'Prueba 07')).toHaveCount(0)
  } finally { await otra.close() }
})

test('el botón de la leyenda: a la izquierda de las vistas, abre la leyenda de siempre; Escape la cierra y devuelve el foco', async ({ page }) => {
  await abrirAgendaV2(page)
  const boton = page.getByRole('button', { name: 'Leyenda de estados', exact: true })
  if (test.info().project.name === 'telefono') {
    await expect(boton).toHaveCount(0)
    return
  }
  await expect(boton).toBeVisible()
  const [b, vistas] = await Promise.all([boton.boundingBox(), page.getByRole('tablist', { name: 'Vista del calendario' }).boundingBox()])
  expect(b && vistas && b.x + b.width <= vistas.x).toBe(true)
  await boton.click()
  const capa = page.locator('[data-capa-leyenda]')
  await expect(capa).toBeVisible()
  await expect(capa).toContainText('Agendada')
  await expect(capa).toContainText('Bloqueo')
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(capa).toHaveCount(0)
  await expect(boton).toBeFocused()
  // En el engrane sigue también.
  await page.locator('[data-engrane-agenda]').first().click()
  await page.locator('[data-opcion="leyenda"]').click()
  await expect(capa).toBeVisible()
})

test('con la v2 apagada no hay botón de la leyenda', async ({ page }) => {
  interruptorAgenda('A', false)
  await page.goto('/agenda')
  await page.locator('.fc-timegrid-slot, .fc-list-day, .fc-list-empty').first().waitFor()
  await expect(page.locator('.agenda-raiz')).not.toHaveAttribute('data-agenda-v2', 'encendida')
  await expect(page.getByRole('button', { name: 'Leyenda de estados', exact: true })).toHaveCount(0)
})

test('la burbuja con la escala de la reserva: título 18, hora 15, texto 14; toques de 44 px o más', async ({ page }) => {
  cita('12:00', 'Prueba 08', 'scheduled')
  cita('14:00', 'Prueba 09', 'cancelled')
  await aLaSemana(page)
  const t = await abrir(page, 'Prueba 08')
  // La burbuja entra con `scale(.97)`: se mide quieta.
  await t.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
  const px = (sel: string): Promise<string> => t.locator(sel).first().evaluate(el => getComputedStyle(el).fontSize)
  expect(await px('.ag-burbuja-titulo')).toBe('18px')
  expect(await px('.ag-burbuja-hora')).toBe('15px')
  expect(await px('.ag-burbuja-dia')).toBe('14px')
  expect(await px('.ag-burbuja-medico')).toBe('14px')
  // Integración L: la píldora, con la tabla de L3 (`.rp-op__dur`: 13 · 600).
  expect(await t.locator('.ag-burbuja-estado').first().evaluate(el => getComputedStyle(el).fontWeight)).toBe('600')
  const altos = await t.locator('button').evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null)
    .map(e => Math.round(Math.min(e.getBoundingClientRect().height, e.getBoundingClientRect().width))))
  expect(Math.min(...altos)).toBeGreaterThanOrEqual(44)
  // Integración L: la ayuda bajo el botón ancho (la de una cancelada) es `.rp-pie small`, 13,5 px.
  await page.keyboard.press('Escape')
  await expect(t).toHaveCount(0)
  const c = await abrir(page, 'Prueba 09')
  await expect(c.locator('.ag-burbuja-ayuda')).toHaveText('Esta cita se canceló. Su horario quedó libre.')
  expect(await c.locator('.ag-burbuja-ayuda').evaluate(el => getComputedStyle(el).fontSize)).toBe('13.5px')
})
