import { test, expect, type Page } from '@playwright/test'
import { SESION, arrastrarEventoPorMinutos, diaDeLaSemana, interruptorAgenda, modalCita, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, burbuja, clicEnFranja, elegirPaciente, tarjetaLectura } from './interaccionesAyudas'

/**
 * El BLOQUEO DE HORARIO en la agenda, de punta a punta en la UI (K1, tanda K,
 * sección A; reescrito en la tanda L por L1). La base y el enlace de reserva
 * los prueban `supabase/pruebas-sql/k1_bloqueos.sql`, `l1_bloqueo_total.sql`,
 * `scripts/reserva-carrera.sh` y `reserva-seg1.e2e.ts`; «Reagendar»,
 * `agenda-eleccion-i2.e2e.ts`.
 *
 *   · L1 punto 8: se crea con el candado junto a la campana (no con el enlace
 *     de la burbuja; la posición «Bloqueo» del alta volvió con M3, punto 5,
 *     y la prueba `agenda-m3-alta-bloqueo.e2e.ts`); franja rayada con el motivo.
 *   · L1 punto 6: el bloqueo es TOTAL. La burbuja, el formulario completo y el
 *     arrastre no guardan nada dentro y dicen «Este horario está bloqueado.
 *     Quita el bloqueo para agendar aquí.»; el servidor responde 409 con ese
 *     texto aunque la pantalla no lo viera.
 *   · L1 punto 7: pulsar en CUALQUIER parte de la franja (no sólo el rótulo)
 *     abre la edición con sus datos; una cita encima abre la suya.
 *   · K punto 5: editar el bloqueo con una cita dentro no la toca y avisa.
 *   · Con la v2 apagada: ni candado ni franja.
 *
 * Todo en la SEMANA +3, jueves, de la clínica A (sin citas sembradas).
 *
 * MUTACIONES (cada una pone en rojo su prueba; notas_l1.md):
 *   · candado: no pintar `BotonBloquearHorario` en `campanaV2`.
 *   · burbuja: en `guardarAltaRapida`, volver a la pregunta de K1 (`confirmar`).
 *   · formulario: `enBloqueo` siempre `false` en `AppointmentModal`.
 *   · arrastre: en `vetadoPorBloqueo`, `return false` (sin veto, el servidor da
 *     409 y la cita vuelve, pero la prueba exige que no haya PUT).
 *   · clic: en `alPulsarHueco`, sin `bloqueoDelGesto` (abre la burbuja).
 *   · servidor: en el PUT, sin el veto (la base lo rechaza, 500 sin la rama).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const JUEVES = diaDeLaSemana(3, 3)
const TEXTO = 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.'
const MOTIVO = 'Congreso L1'

/* Integración K: sin `reserva_canal is null`, borraba también las reservas por enlace que `reserva-google`
   deja en ese día (no las limpia, a propósito) y la FK RESTRICT de `reserva_enlaces.usado_cita_id` lo
   abortaba. Este archivo no crea reservas: sólo borra lo suyo. */
function limpiar(): void {
  sqlLocal(`
    delete from public.agenda_bloqueos b using public.clinicas c
      where c.id = b.clinica_id and c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date;
    delete from public.appointments a using public.clinicas c
      where c.id = a.clinica_id and c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date
        and a.reserva_canal is null;`, { dia: JUEVES })
}

test.beforeAll(() => { limpiar(); interruptorAgenda('A', true) })
test.afterAll(() => { limpiar(); interruptorAgenda('A', false); interruptorAgenda('B', false) })

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${JUEVES}"]`)).toBeVisible()
}

/** Hoy, en el huso de la semilla (el de los navegadores de las pruebas). */
function hoyEnMerida(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida' }).format(new Date())
}

function franja(page: Page) {
  return page.locator(`.fc-timegrid-col[data-date="${JUEVES}"] .fc-bg-event.ag-bloqueo`)
}

function filasBloqueo(): string {
  return sqlLocal(`select coalesce(motivo, '-') || '|' || case when todo_el_dia then 't' else 'f' end from public.agenda_bloqueos b join public.clinicas c on c.id = b.clinica_id
    where c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date order by inicio;`, { dia: JUEVES }).trim()
}

/** Las citas y eventos de ese jueves, «HH:MI-HH:MI» ordenados (como `postgres`: lo que de verdad quedó). */
function filasDelDia(): string {
  return sqlLocal(`select coalesce(string_agg(to_char(a.start_time at time zone 'America/Merida', 'HH24:MI') || '-'
      || to_char(a.end_time at time zone 'America/Merida', 'HH24:MI'), ',' order by a.start_time), '')
    from public.appointments a join public.clinicas c on c.id = a.clinica_id
    where c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date and a.reserva_canal is null;`, { dia: JUEVES }).trim()
}

/** El bloqueo de la prueba 8 (15:00–17:00, `MOTIVO`), sólo si no está: para correr una prueba sola. */
function asegurarBloqueo(): void {
  sqlLocal(`
    insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo)
    select c.id, p.id, (:'dia' || ' 15:00')::timestamp at time zone 'America/Merida', (:'dia' || ' 17:00')::timestamp at time zone 'America/Merida',
           false, 'America/Merida', :'m'
      from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id
     where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test'
       and not exists (select 1 from public.agenda_bloqueos b where b.clinica_id = c.id and b.motivo = :'m'
                         and (b.inicio at time zone 'America/Merida')::date = :'dia'::date);`, { dia: JUEVES, m: MOTIVO })
}

/** Una cita del administrador de A ese jueves, sembrada como `postgres` (el disparador lo deja). Devuelve su id. */
function sembrarCita(desde: string, hasta: string): string {
  return sqlLocal(`
    insert into public.appointments (clinica_id, created_by, medico_id, paciente_id, title, start_time, end_time, status,
      consultorio_id, consultorio_nombre, consultorio_timezone)
    select c.id, p.id, p.id, pa.id, pa.nombre || ' ' || pa.apellidos,
           (:'dia' || ' ' || :'desde')::timestamp at time zone 'America/Merida', (:'dia' || ' ' || :'hasta')::timestamp at time zone 'America/Merida',
           'scheduled', co.id, co.nombre, co.timezone
      from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id
      join public.consultorios co on co.medico_id = p.id and co.nombre like 'Consultorio Centro%'
      join lateral (select * from public.pacientes x where x.clinica_id = c.id and x.apellidos like '%Prueba 11%' limit 1) pa on true
     where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test'
    returning id;`, { dia: JUEVES, desde, hasta }).split('\n')[0]
}

test('8 · el candado junto a la campana crea; franja rayada con el motivo, en la base y auditada', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  const candado = page.getByRole('button', { name: 'Bloquear horario', exact: true })
  await expect(candado).toHaveCount(1)
  // Hermano de la campana, a su derecha, en la misma barra.
  expect(await candado.evaluate(b => b.previousElementSibling?.hasAttribute('data-campana') ?? false)).toBe(true)
  // El enlace de la burbuja no vuelve. (La posición «Bloqueo» del alta, sí: M3, punto 5 —`agenda-m3-alta-bloqueo.e2e.ts`.)
  await clicEnFranja(page, JUEVES, '10:00')
  await expect(burbuja(page)).toBeVisible()
  await expect(burbuja(page).getByText('Bloquear este horario')).toHaveCount(0)
  await burbuja(page).getByRole('button', { name: 'Cerrar' }).click()

  await candado.click()
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloquear horario')
  await expect(m).toContainText('En este periodo no se agenda ni se mueve nada')
  // Abre en HOY y, sin hora, con «Días completos» (lo de siempre del modal); aquí se quiere un tramo.
  await expect(m.getByLabel('Fecha de inicio')).toHaveValue(hoyEnMerida())
  await expect(m.locator('[data-bloqueo-todo-el-dia]')).toBeChecked()
  await m.locator('[data-bloqueo-todo-el-dia]').uncheck()
  await m.getByLabel('Fecha de inicio').fill(JUEVES)
  await m.getByLabel('Fecha de fin').fill(JUEVES)
  await m.getByLabel('Hora de inicio').fill('15:00')
  await m.getByLabel('Hora de fin').fill('17:00')
  await m.getByLabel('Motivo').fill(MOTIVO)
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(m).toBeHidden()
  await expect(franja(page)).toHaveCount(1)
  await expect(franja(page)).toContainText(`Bloqueado · ${MOTIVO}`)
  /* M3 (punto 6): en horario, el rayado lo pintan los trozos `.ag-bloqueo-tramo` de la franja. */
  const fondo = await franja(page).evaluate(e => getComputedStyle(e.querySelector('.ag-bloqueo-tramo') ?? e).backgroundImage)
  expect(fondo).toContain('repeating-linear-gradient')
  expect(filasBloqueo()).toBe(`${MOTIVO}|f`)
  /* Integración M: por el id del bloqueo que acaba de nacer (el `beforeAll` borra los de ese día), no por una
     ventana de 2 minutos que veía las filas de una corrida anterior. La auditoría no se borra nunca. */
  expect(sqlLocal(`select count(*) from public.audit_log l join public.agenda_bloqueos b on b.id = l.registro_id
      join public.clinicas c on c.id = b.clinica_id
    where l.tabla = 'agenda_bloqueos' and l.accion = 'INSERT' and c.nombre = 'Clínica Semilla A' and b.motivo = :'m'
      and (b.inicio at time zone 'America/Merida')::date = :'dia'::date;`, { m: MOTIVO, dia: JUEVES }).trim()).toBe('1')
})

test('7 · pulsar en cualquier parte de la franja abre su edición con los datos, no la burbuja', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '16:30') // lejos del rótulo, que está arriba
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloqueo de horario')
  await expect(m.getByLabel('Hora de inicio')).toHaveValue('15:00')
  await expect(m.getByLabel('Hora de fin')).toHaveValue('17:00')
  await expect(m.getByLabel('Motivo')).toHaveValue(MOTIVO)
  await expect(m.getByRole('button', { name: 'Quitar bloqueo' })).toBeVisible()
  await expect(burbuja(page)).toHaveCount(0)
  await m.getByRole('button', { name: 'Cancelar' }).click()
  await expect(m).toBeHidden()
  await expect(burbuja(page)).toHaveCount(0)
})

test('6 · la burbuja no guarda dentro: el mensaje, sin pregunta y sin alta', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '13:00')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 11')
  await b.getByLabel('Inicio').fill('15:30')
  await b.getByRole('button', { name: 'Guardar' }).click()
  await expect(b.getByRole('alert')).toHaveText(TEXTO)
  await expect(page.getByRole('dialog', { name: /de todos modos/ })).toHaveCount(0)
  expect(filasDelDia()).toBe('')
})

test('6 · el formulario completo tampoco: lo dice y «Guardar» no se deja pulsar', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  const m = modalCita(page, 'Nueva cita')
  await expect(m).toBeVisible()
  await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill('Prueba 11')
  await page.getByRole('button', { name: /Paciente Prueba 11/ }).click()
  await m.locator('input[type="date"]').first().fill(JUEVES)
  await m.locator('input[type="time"]').nth(0).fill('16:00')
  await m.locator('input[type="date"]').nth(1).fill(JUEVES)
  await m.locator('input[type="time"]').nth(1).fill('16:30')
  await expect(m.getByRole('alert').filter({ hasText: TEXTO })).toBeVisible()
  await expect(m.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  // Fuera del bloqueo, se deja (control).
  await m.locator('input[type="time"]').nth(0).fill('13:00')
  await m.locator('input[type="time"]').nth(1).fill('13:30')
  await expect(m.getByRole('alert').filter({ hasText: TEXTO })).toHaveCount(0)
  await expect(m.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  await m.getByRole('button', { name: 'Cancelar' }).click()
  expect(filasDelDia()).toBe('')
})

test('6 · arrastrar una cita al bloqueo la devuelve con el mensaje, sin PUT; el servidor dice lo mismo', async ({ page }) => {
  /* Autónoma (AG-DT-200 se mide con `--repeat-each=20 -g arrastrar`): siembra el
     bloqueo si no está y borra su cita al final. */
  asegurarBloqueo()
  const id = sembrarCita('13:00', '14:00')
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  const cita = page.locator('.fc-event', { has: page.locator(`[data-cita-id="${id}"]`) })
  await expect(cita).toBeVisible()
  let puts = 0
  page.on('request', r => { if (r.method() === 'PUT' && r.url().includes(`/api/appointments/${id}`)) puts++ })
  /* AG-DT-200: se coge la tarjeta a un cuarto de su alto, lejos de una raya de franja. */
  await arrastrarEventoPorMinutos(page, cita, 150, 0.25)
  await expect(page.getByText(TEXTO)).toBeVisible()
  await expect(cita).toContainText('13:00')
  expect(puts).toBe(0)
  expect(filasDelDia()).toBe('13:00-14:00')
  // El servidor, sin la pantalla (lo que no está pintado): 409 con el mismo texto, y nada escrito.
  const r = await page.request.put(`/api/appointments/${id}`, { data: {
    start_time: sqlLocal(`select ((:'dia' || ' 15:30')::timestamp at time zone 'America/Merida')`, { dia: JUEVES }),
    end_time: sqlLocal(`select ((:'dia' || ' 16:30')::timestamp at time zone 'America/Merida')`, { dia: JUEVES }),
  } })
  expect(r.status()).toBe(409)
  expect(await r.json()).toEqual({ error: 'horario_bloqueado', message: TEXTO })
  expect(filasDelDia()).toBe('13:00-14:00')
  sqlLocal(`delete from public.appointments where id = :'id'`, { id })
})

test('7 y 5 · una cita encima abre la suya; editar el bloqueo no la toca y avisa cuántas hay', async ({ page }) => {
  const id = sembrarCita('16:00', '16:30')
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  const cita = page.locator('.fc-event', { has: page.locator(`[data-cita-id="${id}"]`) })
  await cita.click()
  await expect(tarjetaLectura(page)).toBeVisible()
  await expect(page.locator('[data-modal-bloqueo]')).toHaveCount(0)
  // Lo que ya estaba dentro se queda y se edita: sin el aviso y con «Guardar» (L1, sin mover nada).
  await tarjetaLectura(page).getByRole('button', { name: 'Editar', exact: true }).click()
  const editar = modalCita(page, 'Editar cita')
  await expect(editar).toBeVisible()
  await expect(editar.locator('[data-aviso-bloqueado]')).toHaveCount(0)
  await expect(editar.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  await editar.locator('input[type="time"]').nth(0).fill('15:30')
  await expect(editar.locator('[data-aviso-bloqueado]')).toHaveText(TEXTO)
  await editar.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(editar).toHaveCount(0)
  await clicEnFranja(page, JUEVES, '15:00')
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloqueo de horario')
  await m.getByLabel('Motivo').fill('Junta L1')
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Hay 1 cita en este horario. Se queda como está.')).toBeVisible()
  await expect(franja(page)).toContainText('Bloqueado · Junta L1')
  expect(filasDelDia()).toBe('16:00-16:30')
})

test('7 · quitar desde la franja: se va la franja y la fila', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '16:30')
  const m = page.locator('[data-modal-bloqueo]')
  await m.getByRole('button', { name: 'Quitar bloqueo' }).click()
  await m.getByRole('button', { name: 'Sí, quitar' }).click()
  await expect(franja(page)).toHaveCount(0)
  expect(filasBloqueo()).toBe('')
})

test('8 y 7 · días completos con el candado: franja en la columna; pulsarla abre la edición de días', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await page.getByRole('button', { name: 'Bloquear horario', exact: true }).click()
  const m = page.locator('[data-modal-bloqueo]')
  await m.locator('[data-bloqueo-todo-el-dia]').check()
  await m.getByLabel('Fecha de inicio').fill(JUEVES)
  await m.getByLabel('Fecha de fin').fill(JUEVES)
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(m).toBeHidden()
  await expect(franja(page)).toHaveCount(1)
  expect(filasBloqueo()).toBe('-|t')
  await clicEnFranja(page, JUEVES, '11:00')
  await expect(m.locator('[data-bloqueo-todo-el-dia]')).toBeChecked()
  await expect(m.getByLabel('Fecha de inicio')).toHaveValue(JUEVES)
  await expect(burbuja(page)).toHaveCount(0)
  await m.getByRole('button', { name: 'Cancelar' }).click()
})

test('v2 apagada: ni candado ni franja', async ({ page }) => {
  interruptorAgenda('A', false)
  try {
    await abrirAgendaApagada(page)
    await aLaSemanaMasTres(page)
    await expect(page.locator('.fc-event.ag-bloqueo, .fc-bg-event.ag-bloqueo')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Bloquear horario', exact: true })).toHaveCount(0)
  } finally {
    interruptorAgenda('A', true)
  }
})
