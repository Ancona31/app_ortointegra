import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja } from './interaccionesAyudas'

/**
 * Tanda M (M3, punto 6 de Angel) · El rayado de un bloqueo se dibuja sólo
 * sobre el horario activo, no sobre el gris de fuera de horario. Es sólo
 * dibujo: la franja de FullCalendar sigue cubriendo el bloqueo entero, y
 * pulsar en su parte gris abre su edición (no la burbuja de cita). Los tres
 * casos: todo el día, de horas, y un día sin horario definido (rayado entero,
 * como antes). Se comprueba contra el gris QUE PINTA FullCalendar en la misma
 * columna (`.fc-non-business`), no contra horas escritas aquí: el recorte y el
 * gris salen de la misma `businessHours`.
 *
 * Semana +6 de la clínica A, con el administrador (su consultorio activo,
 * Centro, abre de 08 a 14 de lunes a viernes y no abre en domingo).
 *
 * MUTACIONES (comprobadas en rojo, notas_m3.md):
 *   · sin la regla `:has([data-rayado="recortado"])` (CSS compilado) → la
 *     franja entera sigue rayada encima del gris → «todo el día…» y «de horas…»;
 *   · `fijarRayadoBloqueos` sin llamar (rayado entero, lo de antes) → «todo el
 *     día…» y «de horas…»;
 *   · sin horario → `[]` en vez de `null` en `tramosDelRayado` → «sin horario…».
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const MOTIVO = 'Rayado M3'
const VIERNES = diaDeLaSemana(6, 4)
const MIERCOLES = diaDeLaSemana(6, 2)
const DOMINGO = diaDeLaSemana(6, 6)

function limpiar(): void {
  sqlLocal(`delete from public.agenda_bloqueos b using public.clinicas c
    where c.id = b.clinica_id and c.nombre = 'Clínica Semilla A' and b.motivo = :'m';`, { m: MOTIVO })
}

function bloquear(desde: string, hasta: string, todoElDia: boolean): void {
  sqlLocal(`insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo)
    select c.id, p.id, :'desde'::timestamp at time zone 'America/Merida', :'hasta'::timestamp at time zone 'America/Merida',
           :'todo'::boolean, 'America/Merida', :'m'
      from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id
     where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test';`,
  { desde, hasta, todo: String(todoElDia), m: MOTIVO })
}

test.beforeAll(() => {
  limpiar()
  interruptorAgenda('A', true)
  bloquear(`${VIERNES} 00:00`, `${diaDeLaSemana(6, 5)} 00:00`, true)
  bloquear(`${MIERCOLES} 12:00`, `${MIERCOLES} 18:30`, false)
  bloquear(`${DOMINGO} 00:00`, `${diaDeLaSemana(7, 0)} 00:00`, true)
})
test.afterAll(() => { limpiar(); interruptorAgenda('A', false) })

async function aLaSemanaMasSeis(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1400 })
  await abrirAgendaV2(page)
  for (let i = 0; i < 6; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${VIERNES}"]`)).toBeVisible()
}

function franja(page: Page, dia: string): Locator {
  return page.locator(`.fc-timegrid-col[data-date="${dia}"] .fc-bg-event.ag-bloqueo`)
}

interface Medidas {
  franja: { top: number; bottom: number }
  fondoPropio: string
  trozos: { top: number; bottom: number }[]
  grises: { top: number; bottom: number }[]
}

/** La franja, sus trozos rayados y el gris de la columna, en píxeles de página. */
async function medir(page: Page, dia: string): Promise<Medidas> {
  return franja(page, dia).evaluate((el, d) => {
    const caja = (e: Element) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } }
    const col = document.querySelector(`.fc-timegrid-col[data-date="${d}"]`)
    return {
      franja: caja(el),
      fondoPropio: getComputedStyle(el).backgroundImage,
      trozos: [...el.querySelectorAll('.ag-bloqueo-tramo')].map(caja),
      grises: [...(col?.querySelectorAll('.fc-non-business') ?? [])].map(caja),
    }
  }, dia)
}

/** Cada renglón de la franja está o rayado o gris, nunca los dos (±1 px en los bordes). */
function comprobarReparto(m: Medidas): void {
  expect(m.trozos.length, 'hay trozos rayados').toBeGreaterThan(0)
  expect(m.fondoPropio, 'la franja ya no se raya entera').toBe('none')
  for (let y = Math.ceil(m.franja.top) + 1; y < m.franja.bottom - 1; y += 3) {
    const rayado = m.trozos.some(t => y > t.top + 1 && y < t.bottom - 1)
    const gris = m.grises.some(g => y > g.top + 1 && y < g.bottom - 1)
    expect(rayado && gris, `rayado sobre gris en y=${y}`).toBe(false)
    const enBorde = [...m.trozos, ...m.grises].some(c => Math.abs(y - c.top) <= 1 || Math.abs(y - c.bottom) <= 1)
    if (!enBorde) expect(rayado || gris, `ni rayado ni gris en y=${y}`).toBe(true)
  }
}

/** Pulsa la franja en un renglón gris: abre la edición del bloqueo, no la burbuja. */
async function pulsarEnGris(page: Page, dia: string, m: Medidas): Promise<void> {
  const g = m.grises.find(x => x.bottom > m.franja.top + 10 && x.top < m.franja.bottom - 10)
  expect(g, 'la franja cruza el gris').toBeTruthy()
  if (!g) return
  const y = (Math.max(g.top, m.franja.top) + Math.min(g.bottom, m.franja.bottom)) / 2
  const col = await page.locator(`.fc-timegrid-col[data-date="${dia}"]`).boundingBox()
  await page.mouse.click((col?.x ?? 0) + (col?.width ?? 0) / 2 + 20, y)
  const modal = page.locator('[data-modal-bloqueo]')
  await expect(modal).toContainText('Bloqueo de horario')
  await expect(burbuja(page)).toHaveCount(0)
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(modal).toBeHidden()
}

test('todo el día: rayado sólo en horario; la franja sigue entera y responde en el gris', async ({ page }) => {
  await aLaSemanaMasSeis(page)
  await expect(franja(page, VIERNES).locator('.ag-bloqueo-tramo').first()).toBeAttached()
  const m = await medir(page, VIERNES)
  comprobarReparto(m)
  // La franja cubre la columna entera, gris incluido.
  const col = await page.locator(`.fc-timegrid-col[data-date="${VIERNES}"] .fc-timegrid-col-frame`).boundingBox()
  expect(Math.abs(m.franja.top - (col?.y ?? 0))).toBeLessThan(2)
  await pulsarEnGris(page, VIERNES, m)
})

test('de horas: 12:00–18:30 cruza el cierre; rayado sólo hasta el cierre, y responde en el gris', async ({ page }) => {
  await aLaSemanaMasSeis(page)
  await expect(franja(page, MIERCOLES).locator('.ag-bloqueo-tramo').first()).toBeAttached()
  const m = await medir(page, MIERCOLES)
  comprobarReparto(m)
  await pulsarEnGris(page, MIERCOLES, m)
})

test('sin horario definido ese día (domingo, todo gris): rayado entero, como antes', async ({ page }) => {
  await aLaSemanaMasSeis(page)
  const f = franja(page, DOMINGO)
  await expect(f).toBeVisible()
  await expect(f.locator('.ag-bloqueo-rotulo')).toBeVisible()
  const m = await medir(page, DOMINGO)
  expect(m.trozos).toHaveLength(0)
  expect(m.fondoPropio).toContain('repeating-linear-gradient')
  await expect(f.locator('[data-rayado]')).toHaveCount(0)
})
