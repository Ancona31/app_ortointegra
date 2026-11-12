import { test, expect, type Page } from '@playwright/test'
import { hoyEnTZ } from '../src/lib/dates'
import { irAAgenda, eventoConTexto, SESION, CORREO, DIA_LABORABLE_LIBRE, sqlLocal, selectFiltroMedico } from './ayudas'

/**
 * Bloque F §1 · pulido visual que sale directo, sin interruptor (diseño en
 * `e2e/resultados/plan_F.md`). Cada prueba nombra su punto de la auditoría.
 * La semilla (`scripts/agenda-semilla.ts`) tiene el domingo cerrado y los
 * pacientes con teléfono `99900…`; la cita de consulta de las 10:00 de admin.a
 * está todos los días laborables de la semana visible.
 */

test.use({ storageState: SESION.adminA })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function soloEn(proyecto: 'escritorio' | 'telefono'): void {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== proyecto, `sólo en ${proyecto}`) })
}

/** Semanas (lunes primero) que toca el mes de `iso` (AAAA-MM-DD). Aritmética UTC pura. */
function semanasDelMes(iso: string): number {
  const [a, m] = iso.split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1, 1))
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const desfase = (primero.getUTCDay() + 6) % 7
  return Math.ceil((desfase + dias) / 7)
}

test.describe('escritorio', () => {
  soloEn('escritorio')

  test('F1.4 · Día enseña teléfono y consultorio; Semana no', async ({ page }) => {
    await irAAgenda(page)
    const cita = eventoConTexto(page, 'Paciente')
    await expect(cita.locator('.ag-tarjeta-telefono')).toBeHidden()
    await expect(cita.locator('.ag-tarjeta-consultorio')).toBeHidden()
    await page.getByRole('tab', { name: 'Día' }).click()
    const enDia = page.locator('.fc-timeGridDay-view .fc-event', { hasText: 'Paciente' }).first()
    await expect(enDia.locator('.ag-tarjeta-telefono')).toBeVisible()
    await expect(enDia.locator('.ag-tarjeta-telefono')).toHaveText(/^99900\d{5}$/)
    await expect(enDia.locator('.ag-tarjeta-consultorio')).toBeVisible()
  })

  test('F1.4 · cada tarjeta de Semana y cada chip de Mes llevan data-cita-id con el id del evento', async ({ page }) => {
    await irAAgenda(page)
    const ids = await page.locator('.fc-timegrid-event .ag-tarjeta').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter(id => !UUID.test(id ?? '')), 'data-cita-id que no son uuid').toEqual([])
    await page.getByRole('tab', { name: 'Mes' }).click()
    // `evaluateAll` no espera: primero, que el mes haya pintado sus chips.
    await expect(page.locator('.fc-dayGridMonth-view .ag-mes').first()).toBeVisible()
    const mes = await page.locator('.fc-daygrid-event .ag-mes:not(.ag-mes--gcal)').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(mes.length).toBeGreaterThan(0)
    expect(mes.filter(id => !UUID.test(id ?? '')), 'data-cita-id del mes que no son uuid').toEqual([])
  })

  test('F1.8 · en Semana no se escribe el estado; queda el glifo, distinto para agendada y confirmada', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.fc-timeGridWeek-view .ag-tarjeta-desc-estado:visible')).toHaveCount(0)
    /* `innerText` y no `hasText`: éste lee también lo que está en `display: none`. */
    const textos = await page.locator('.fc-timeGridWeek-view .ag-tarjeta').evaluateAll(els => els.map(e => (e as HTMLElement).innerText))
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) expect(t).not.toMatch(/agendada|confirmada|atendida|no asistió|cancelada/i)
    const glifo = (estado: string) => page.locator(`.fc-timeGridWeek-view .ag-ev-status--${estado} .ag-tarjeta-glifo`)
    await expect(glifo('scheduled').first()).toHaveText('○')
    await expect(glifo('scheduled').first()).toBeVisible()
    await expect(glifo('confirmed').first()).toHaveText('●')
    const titulo = await eventoConTexto(page, 'Paciente').locator('.ag-tarjeta').getAttribute('title')
    expect(titulo).toMatch(/· (Agendada|Confirmada|Atendida|No asistió|Cancelada)$/)
    await page.getByRole('tab', { name: 'Día' }).click()
    await expect(page.locator('.fc-timeGridDay-view .ag-tarjeta-pildora').first()).toBeVisible()
  })

  test('F1.5 · con el domingo cerrado, «Compactar» abre encendido y la banda lo dice', async ({ page }) => {
    await irAAgenda(page)
    const boton = page.getByRole('button', { name: /Compactar la rejilla al horario de la clínica/ })
    await expect(boton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.fc-timegrid-col.fc-day-sun')).toHaveCount(0)
    await expect(page.locator('.ag-banda-compacta')).toContainText(/domingo/i)
    await boton.click()
    await expect(page.locator('.fc-timegrid-col.fc-day-sun')).toHaveCount(1)
  })

  test('F1.6 · el Mes de escritorio pinta sus semanas reales', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
    /* Con «Compactar» encendido (F1.5) FullCalendar recorta los días plegados de
       los bordes del mes antes de encajar a semanas: se apaga para contar. */
    const compactar = page.getByRole('button', { name: 'Ocultar los días de la semana sin actividad' })
    if (await compactar.getAttribute('aria-pressed') === 'true') await compactar.click()
    await expect(compactar).toHaveAttribute('aria-pressed', 'false')
    const filas = page.locator('.fc-daygrid-body tbody > tr')
    const hoy = hoyEnTZ('America/Merida')
    await expect(filas).toHaveCount(semanasDelMes(hoy))
    /* Y el mes siguiente: si los dos tuvieran seis semanas, la prueba no vería
       la diferencia con `fixedWeekCount` puesto. Entre dos meses seguidos al
       menos uno tiene cinco o menos. */
    await page.locator('.fc-next-button').click()
    const [a, m] = hoy.split('-').map(Number)
    const siguiente = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
    await expect(filas).toHaveCount(semanasDelMes(siguiente))
  })

  test('F1.10 · «Hoy» de escritorio deshabilitado no se atenúa', async ({ page }) => {
    await irAAgenda(page)
    const hoy = page.locator('.fc-today-button')
    await expect(hoy).toBeDisabled()
    expect(await hoy.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
    await page.locator('.fc-next-button').click()
    await expect(hoy).toBeEnabled()
    await hoy.click()
    await expect(hoy).toBeDisabled()
  })
})

test.describe('teléfono', () => {
  soloEn('telefono')

  async function controlesDeLaBanda(page: Page): Promise<{ w: number; h: number }[]> {
    return page.locator('.ag-banda-movil button, .ag-banda-movil select').evaluateAll(els =>
      els.filter(e => (e as HTMLElement).offsetParent !== null)
        .map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height } }))
  }

  test('F1.15 · la banda en dos filas: 130 px o menos, controles de 44 y nada envuelve a 360', async ({ page }) => {
    for (const ancho of [390, 360]) {
      await page.setViewportSize({ width: ancho, height: 844 })
      await irAAgenda(page)
      const banda = await page.locator('.ag-banda-movil').boundingBox()
      expect(banda?.height ?? 999).toBeLessThanOrEqual(130)
      for (const c of await controlesDeLaBanda(page)) {
        expect(c.h).toBeGreaterThanOrEqual(43.9) // subpíxel
        expect(c.w).toBeGreaterThanOrEqual(43.9)
      }
      for (const fila of ['.ag-banda-movil-fila', '.ag-banda-movil-filtros']) {
        expect((await page.locator(fila).boundingBox())?.height ?? 999).toBeLessThanOrEqual(46)
      }
      await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeAttached()
    }
  })

  test('F1.10 · «Hoy» del teléfono: deshabilitado en el rango de hoy y vuelve a él', async ({ page }) => {
    await irAAgenda(page)
    const hoy = page.locator('.ag-banda-movil').getByRole('button', { name: 'Hoy' })
    const fecha = page.locator('.ag-banda-movil-fecha')
    const inicial = await fecha.textContent()
    await expect(hoy).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Periodo siguiente' }).click()
    await expect(fecha).not.toHaveText(inicial ?? '')
    await expect(hoy).toHaveAttribute('aria-disabled', 'false')
    await hoy.click()
    await expect(fecha).toHaveText(inicial ?? '')
    await expect(hoy).toHaveAttribute('aria-disabled', 'true')
  })

  test('F1.14 · la lista de Día en dos líneas: cada fila con paciente mide 72 px o menos', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('tab', { name: 'Día' }).click()
    const filas = page.locator('.fc-listDay-view .fc-list-event', { hasText: 'Paciente' })
    await expect(filas.first()).toBeVisible()
    const altos = await filas.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
    for (const h of altos) expect(h).toBeLessThanOrEqual(72)
    const ids = await page.locator('.fc-listDay-view .fc-list-event:not(.ag-ev-gcal) .ag-listadia').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    for (const id of ids) expect(id ?? '').toMatch(UUID)
  })

  test('F1.4 · las filas de la lista de Semana llevan data-cita-id', async ({ page }) => {
    await irAAgenda(page)
    const ids = await page.locator('.fc-listWeek-view .fc-list-event:not(.ag-ev-gcal) .ag-listafila').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id ?? '').toMatch(UUID)
  })
})

/* ── Paso 2 · F1.1, F1.3, F1.7, F1.9, F1.12 ─────────────────────────────── */

/** Un evento o cita de un médico de la clínica A, insertado como `postgres`. Devuelve el id. */
function citaSql(correo: string, titulo: string, inicio: string, minutos: number, conPaciente: number | null = null): string {
  return sqlLocal(`
    insert into public.appointments (clinica_id, created_by, title, start_time, end_time, status, gcal_sync_status,
      medico_id, client_id, consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion,
      consultorio_telefono, consultorio_timezone, origen, icono, color, all_day, paciente_id)
    select p.clinica_id, p.id, :'titulo', :'inicio'::timestamptz, :'inicio'::timestamptz + make_interval(mins => :'min'::int),
           'scheduled', 'pending', p.id, gen_random_uuid()::text, c.id, c.nombre, c.nombre_corto, c.direccion,
           c.telefono, c.timezone, 'spinus',
           case when :'pac' = '' then 'junta' end, case when :'pac' = '' then 'indigo' end, false,
           case when :'pac' = '' then null else (select x.id from public.pacientes x where x.clinica_id = p.clinica_id
                                                   order by x.apellidos, x.nombre offset nullif(:'pac', '')::int limit 1) end
      from auth.users u join public.profiles p on p.id = u.id
      cross join lateral (select * from public.consultorios c where c.medico_id = p.id and c.activo limit 1) c
     where u.email = :'correo'
    returning id;`, { titulo, inicio, min: String(minutos), correo, pac: conPaciente === null ? '' : String(conPaciente) })
}

test.describe('escritorio · paso 2', () => {
  soloEn('escritorio')

  test('F1.1 · una sola barra: la nativa y los controles comparten fila, nada envuelve, la leyenda al pie', async ({ page }) => {
    for (const [ancho, alto] of [[1440, 900], [1280, 720], [1536, 900]] as const) {
      await page.setViewportSize({ width: ancho, height: alto })
      await irAAgenda(page)
      /* Los cuatro centros en UNA lectura del DOM: medidos por separado, la
         entrada de la página (que mueve el contenido unos píxeles) los pillaba
         en cuadros distintos. */
      const sels = ['.fc-prev-button', '[data-onboard="nueva-cita"]', '.agenda-fc .ag-controles [role="tablist"]', '.fc-today-button']
      await expect.poll(() => page.evaluate((ss) => {
        const cs = ss.map(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? r.top + r.height / 2 : NaN })
        return Math.max(...cs) - Math.min(...cs)
      }, sels)).toBeLessThanOrEqual(1)
      for (const sel of ['.agenda-fc .fc-header-toolbar', '.agenda-fc .ag-controles']) {
        expect((await page.locator(sel).boundingBox())?.height ?? 999).toBeLessThanOrEqual(61.5) // 60 + el borde
      }
      /* Las pestañas del segmentado miden 30 dentro de su pista de 36: se mide la pista. */
      const altos = await page.locator('.agenda-fc .ag-controles :is(button:not([role="tab"]), select, [role="tablist"]), .agenda-fc .fc-button').evaluateAll(els =>
        els.filter(e => (e as HTMLElement).offsetParent !== null).map(e => Math.round(e.getBoundingClientRect().height)))
      for (const h of altos) expect(h).toBe(36)
      const rejilla = await page.locator('.fc-view-harness').boundingBox()
      const leyenda = await page.locator('.agenda-fc .ag-leyenda').boundingBox()
      expect(leyenda?.y ?? 0).toBeGreaterThanOrEqual((rejilla?.y ?? 0) + (rejilla?.height ?? 0) - 1)
      await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeAttached()
    }
  })

  test('F1.1 · por debajo de 1280 px y en Día con panel, la nativa arriba y los controles en una fila debajo', async ({ page }) => {
    const filaUnica = async () => {
      const nativa = await page.locator('.agenda-fc .fc-header-toolbar').boundingBox()
      const controles = await page.locator('.agenda-fc .ag-controles').boundingBox()
      expect(controles?.y ?? 0).toBeGreaterThanOrEqual((nativa?.y ?? 0) + (nativa?.height ?? 0) - 1)
      const tops = await page.locator('.agenda-fc .ag-controles :is(button:not([role="tab"]), select, [role="tablist"])')
        .evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).map(e => Math.round(e.getBoundingClientRect().top)))
      expect(new Set(tops).size).toBe(1)
    }
    await page.setViewportSize({ width: 1180, height: 800 })
    await irAAgenda(page)
    await filaUnica()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('tab', { name: 'Día' }).click()
    await expect(page.locator('.ag-dia--con-panel')).toBeVisible()
    await filaUnica()
  })

  test('F1.3 · densidad compacta: 24 px por franja, se recuerda y la jornada cabe sin desplazar', async ({ page }) => {
    await irAAgenda(page)
    const boton = page.getByRole('button', { name: 'Densidad compacta' })
    await expect(boton).toHaveAttribute('aria-pressed', 'false')
    await boton.click()
    await expect(boton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-densidad', 'compacta')
    await page.reload()
    await page.locator('.fc-event').first().waitFor()
    await expect(page.getByRole('button', { name: 'Densidad compacta' })).toHaveAttribute('aria-pressed', 'true')
    // Con «Compactar» (abre encendido) la jornada entera cabe: el desplazador no desplaza.
    const sobra = await page.locator('.fc-timegrid-body').evaluate(el => {
      const sc = el.closest('.fc-scroller') as HTMLElement | null
      return sc ? sc.scrollHeight - sc.clientHeight : 999
    })
    expect(sobra).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Densidad compacta' }).click()
    await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-densidad', 'normal')
  })

  test('F1.3 · a 24 px por franja la cita de 60 min es «compact»: el piso se lee de la tarjeta', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const titulo = `Densidad F ${Date.now().toString(36)}`
    const ids = [
      citaSql(CORREO.adminA, titulo, `${DIA_LABORABLE_LIBRE}T16:00:00-06:00`, 60),
      // Una de noche estira la ventana: con tantas filas la rejilla no estira la franja de 24.
      citaSql(CORREO.adminA, `${titulo} noche`, `${DIA_LABORABLE_LIBRE}T22:00:00-06:00`, 60),
    ]
    try {
      await page.addInitScript(() => { try { localStorage.setItem('spinus.agenda.densidad', 'compacta') } catch { /* */ } })
      await irAAgenda(page)
      const compactar = page.getByRole('button', { name: /Compactar la rejilla al horario de la clínica/ })
      if (await compactar.getAttribute('aria-pressed') === 'true') await compactar.click()
      const franja = await page.locator('td.fc-timegrid-slot-lane').first().evaluate(e => e.getBoundingClientRect().height)
      expect(Math.abs(franja - 24)).toBeLessThanOrEqual(1)
      await expect(page.locator('.fc-timegrid-event', { hasText: titulo }).first().locator('.ag-tarjeta')).toHaveClass(/ag-tarjeta--compact/)
    } finally {
      sqlLocal(`delete from public.appointments where id = any(string_to_array(:'ids', ',')::uuid[]);`, { ids: ids.join(',') })
    }
  })

  test('F1.7 · dos citas simultáneas con «Todos»: mismo ancho y el nombre nunca queda en una inicial', async ({ page }) => {
    const inicio = `${DIA_LABORABLE_LIBRE}T07:00:00-06:00`
    const ids = [citaSql(CORREO.adminA, 'Simultánea F uno', inicio, 30, 0), citaSql(CORREO.medicoA, 'Simultánea F dos', inicio, 30, 1)]
    try {
      await irAAgenda(page)
      await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
      const tarjetas = page.locator(`.fc-timegrid-col[data-date="${DIA_LABORABLE_LIBRE}"] .fc-timegrid-event`)
        .filter({ has: page.locator('[data-cita-id]') })
        .filter({ has: page.locator(`.ag-tarjeta-hora-inicio`, { hasText: /^07:00$/ }) })
      await expect(tarjetas).toHaveCount(2)
      const anchos = await tarjetas.evaluateAll(els => els.map(e => e.getBoundingClientRect().width))
      expect(Math.abs(anchos[0] - anchos[1])).toBeLessThanOrEqual(1)
      const visibles = await tarjetas.locator('.ag-tarjeta-tit').evaluateAll(els => els.map(e => (e as HTMLElement).innerText.trim()))
      for (const v of visibles) expect(v).toMatch(/^\p{L}{2,}/u)
    } finally {
      sqlLocal(`delete from public.appointments where id = any(string_to_array(:'ids', ',')::uuid[]);`, { ids: ids.join(',') })
    }
  })

  test('F1.9 · el chip de iniciales sólo con «Todos»', async ({ page }) => {
    await irAAgenda(page)
    await selectFiltroMedico(page).selectOption({ label: 'Dr. Admin Semilla Uno' })
    await expect(page.locator('.fc-timegrid-event').first()).toBeVisible()
    await expect(page.locator('.ag-tarjeta-chip')).toHaveCount(0)
    await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
    await expect(page.locator('.ag-tarjeta-chip').first()).toBeAttached()
  })
})

test.describe('teléfono · paso 2', () => {
  soloEn('telefono')

  test('F1.12 · la lista de Semana abre con la cabecera de hoy en lo alto', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.fc-listWeek-view')).toBeVisible()
    const hoy = hoyEnTZ('America/Merida')
    await expect(page.locator('.fc-listWeek-view tr.fc-list-day[data-date]').first()).toBeAttached()
    /* La cabecera de hoy (o la del primer día posterior con citas) queda en lo
       alto del desplazador, salvo que la lista ya no dé para más (fondo). */
    await expect.poll(() => page.evaluate((iso) => {
      const sc = document.querySelector<HTMLElement>('.fc-listWeek-view .fc-scroller')
      const cab = Array.from(document.querySelectorAll<HTMLElement>('.fc-listWeek-view tr.fc-list-day[data-date]'))
        .find(c => (c.dataset.date ?? '') >= iso)
      if (!sc || !cab) return 'sin lista'
      const d = cab.getBoundingClientRect().top - sc.getBoundingClientRect().top
      const alFondo = sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1
      return Math.abs(d) <= 2 || (alFondo && d > 0 && sc.scrollTop > 0) ? 'en hoy' : `a ${Math.round(d)} px`
    }, hoy)).toBe('en hoy')
  })
})
