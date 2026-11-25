import { test, expect, type Page } from '@playwright/test'
import { arrastrarEventoPorMinutos, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal, SESION } from './ayudas'

/**
 * Punto 19 de Angel · un médico (admin.a, dispositivo en Mérida, UTC-6) con un
 * consultorio en Tijuana (UTC-8 en noviembre, UTC-7 con horario de verano) que
 * atiende de 09:00 a 11:00 HORA DE TIJUANA, elegido como consultorio activo.
 *
 *   · la etiqueta de huso de la rejilla se conserva: la cita de las 09:00 de
 *     Tijuana sale a las 11:00 con «09:00 hora Baja California»;
 *   · el gris se calcula en la hora del consultorio y se pinta en la del
 *     dispositivo: blanco de 11:00 a 13:00 de Mérida (09–11 de Tijuana);
 *   · el aviso de fuera de horario se compara en la hora del consultorio: mover
 *     la cita una hora (10:00 de Tijuana) NO avisa; dos horas (11:00, ya
 *     cerrado) sí, con la hora y la zona del consultorio. Pulsar las 11:30 de
 *     Mérida (09:30 de Tijuana) para agendar tampoco avisa.
 *
 * Lo que crea (consultorio y cita) se borra al terminar como `postgres`; el
 * interruptor vuelve a como estaba.
 */
soloEscritorio()
test.describe.configure({ mode: 'serial' })
test.use({ storageState: SESION.adminA, timezoneId: 'America/Merida' })

const TIJUANA = 'America/Tijuana'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const DIA = diaDeLaSemana(1, 1) // martes de la semana que viene
const HORARIO = JSON.stringify(Object.fromEntries(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
  .map(d => [d, { activo: true, inicio: '09:00', fin: '11:00' }])))

let consultorioId = ''
let citaId = ''
let v2Antes = ''
let inicioIso = ''
const horaEn = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso))

test.beforeAll(() => {
  v2Antes = sqlLocal(`select coalesce((select agenda_v2_encendida::text from public.agenda_ajustes where clinica_id = ${CL}), 'sin')`)
  interruptorAgenda('A', true)
  const fila = sqlLocal(`
    with m as (select p.id from public.profiles p join auth.users u on u.id = p.id where u.email = 'admin.a@semilla.spinus.test'),
         k as (insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
               select ${CL}, m.id, 'Consultorio Tijuana (e2e G4)', 'Tijuana', 'Av. Revolución 1', :'tz', :'h'::jsonb, true from m returning id, medico_id),
         p as (select x.id from public.pacientes x where x.clinica_id = ${CL} and x.medico_id = (select id from m) and x.activo
               order by x.created_at limit 1),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
                                                 all_day, consultorio_timezone, consultorio_nombre, consultorio_direccion)
               select ${CL}, (select id from p), k.medico_id, k.id, 'Cita husos G4',
                      (:'dia' || ' 09:00')::timestamp at time zone :'tz', (:'dia' || ' 09:30')::timestamp at time zone :'tz',
                      'scheduled', false, :'tz', 'Consultorio Tijuana (e2e G4)', 'Av. Revolución 1' from k
               returning id, start_time)
    select (select id from k), (select id from a), to_char((select start_time from a) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');`,
  { tz: TIJUANA, h: HORARIO, dia: DIA })
  ;[consultorioId = '', citaId = '', inicioIso = ''] = fila.split('|')
})

test.afterAll(() => {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    delete from public.appointments where id = :'a'::uuid;
    delete from public.consultorios where id = :'k'::uuid;
    commit;`, { a: citaId, k: consultorioId })
  if (v2Antes === 'sin') sqlLocal(`delete from public.agenda_ajustes where clinica_id = ${CL}`)
  else sqlLocal(`update public.agenda_ajustes set agenda_v2_encendida = ${v2Antes} where clinica_id = ${CL}`)
})

async function abrirEnLaSemanaDeLaCita(page: Page): Promise<void> {
  await page.addInitScript(id => { try { sessionStorage.setItem('consultorio_activo_id', id) } catch { /* privado */ } }, consultorioId)
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="encendida"]')).toBeAttached({ timeout: 15000 })
  for (let i = 0; i < 3 && !(await page.locator(`.fc-timegrid-col[data-date="${DIA}"]`).count()); i++) {
    await page.locator('.fc-next-button').click()
  }
  await expect(page.locator(`.fc-timegrid-col[data-date="${DIA}"]`)).toBeVisible()
}

/** Los tramos blancos (no grises) de la columna `fecha`, dentro de lo que pinta la rejilla. */
async function blancos(page: Page, fecha: string): Promise<string[]> {
  return page.evaluate((f) => {
    const lanes = Array.from(document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane[data-time]'))
    const y0 = lanes[0].getBoundingClientRect().top
    const [h0, m0] = (lanes[0].dataset.time ?? '00:00').split(':').map(Number)
    const pxMin = lanes[0].getBoundingClientRect().height / 30
    const yFin = lanes[lanes.length - 1].getBoundingClientRect().bottom
    const reloj = (y: number) => {
      const min = Math.round((h0 * 60 + m0 + (y - y0) / pxMin) / 15) * 15
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    }
    const grises = Array.from(document.querySelectorAll<HTMLElement>(`.fc-timegrid-col[data-date="${f}"] .fc-non-business`))
      .map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top)
    const salida: string[] = []
    let y = y0
    for (const g of grises) {
      if (g.top - y > 2) salida.push(`${reloj(y)}-${reloj(g.top)}`)
      y = Math.max(y, g.bottom)
    }
    if (yFin - y > 2) salida.push(`${reloj(y)}-${reloj(yFin)}`)
    return salida
  }, fecha)
}

test('la etiqueta de huso se conserva y el gris es el horario de Tijuana en la hora del dispositivo', async ({ page }) => {
  await abrirEnLaSemanaDeLaCita(page)
  const tarjeta = page.locator('.fc-timegrid-event', { hasText: 'hora Baja California' })
  await expect(tarjeta).toContainText(`${horaEn(inicioIso, TIJUANA)} hora Baja California`)
  await expect(tarjeta).toContainText(horaEn(inicioIso, 'America/Merida'))
  const abre = horaEn(inicioIso, 'America/Merida')
  const cierra = horaEn(new Date(Date.parse(inicioIso) + 2 * 3600_000).toISOString(), 'America/Merida')
  await expect.poll(() => blancos(page, DIA)).toEqual([`${abre}-${cierra}`])
})

test('el aviso de fuera de horario se mide en la hora de Tijuana: +1 h no avisa, +2 h sí', async ({ page }) => {
  await abrirEnLaSemanaDeLaCita(page)
  const tarjeta = page.locator('.fc-timegrid-event', { hasText: 'hora Baja California' })
  await expect(tarjeta).toBeVisible()
  await arrastrarEventoPorMinutos(page, tarjeta, 120)
  const dialogo = page.getByRole('dialog').filter({ hasText: 'Vas a moverlo a las' })
  await expect(dialogo).toContainText('Vas a moverlo a las 11:00 hora Baja California, y este consultorio atiende de 09:00 a 11:00')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialogo).toBeHidden()

  await arrastrarEventoPorMinutos(page, page.locator('.fc-timegrid-event', { hasText: 'hora Baja California' }), 60)
  await expect(page.locator('.fc-timegrid-event', { hasText: '10:00 hora Baja California' })).toBeVisible()
  await expect(page.getByRole('dialog').filter({ hasText: 'Vas a moverlo a las' })).toHaveCount(0)
  /* Si cae encima de otra cita de admin.a, el aviso de empalme (no el de horario) se acepta. */
  const empalme = page.getByRole('dialog').filter({ hasText: 'Se empalma' })
  if (await empalme.waitFor({ timeout: 2000 }).then(() => true, () => false)) {
    await empalme.getByRole('button', { name: 'Guardar' }).click()
  }
  await expect.poll(() => sqlLocal(`select to_char(start_time at time zone :'tz', 'HH24:MI') from public.appointments where id = :'a'`,
    { tz: TIJUANA, a: citaId })).toBe('10:00')
})

test('pulsar las 11:30 de Mérida (09:30 de Tijuana) para agendar no avisa', async ({ page }) => {
  await abrirEnLaSemanaDeLaCita(page)
  const otraFecha = diaDeLaSemana(1, 3) // jueves, sin la cita de la prueba
  await page.locator('td.fc-timegrid-slot-lane[data-time="11:30:00"]').scrollIntoViewIfNeeded()
  const caja = await page.evaluate((f) => {
    const col = document.querySelector<HTMLElement>(`.fc-timegrid-col[data-date="${f}"]`)?.getBoundingClientRect()
    const l = document.querySelector<HTMLElement>('td.fc-timegrid-slot-lane[data-time="11:30:00"]')?.getBoundingClientRect()
    return col && l ? { x: col.left + col.width / 2, y: l.top + l.height / 2 } : null
  }, otraFecha)
  if (!caja) throw new Error('no se encontró la celda de las 11:30')
  await page.mouse.click(caja.x, caja.y)
  await expect(page.getByRole('dialog', { name: /Nueva cita/ })).toBeVisible()
  await expect(page.getByRole('dialog').filter({ hasText: 'Vas a agendar a las' })).toHaveCount(0)
  await page.keyboard.press('Escape')
})
