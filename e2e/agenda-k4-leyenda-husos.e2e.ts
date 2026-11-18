import { test, expect, type Page } from '@playwright/test'
import { interruptorAgenda, selectFiltroMedico, sqlLocal, SESION } from './ayudas'

/**
 * Tanda K, punto 15 de Angel · la leyenda «Mostrando el horario de tu ubicación
 * actual (UTC−6, Mérida)» sobre la agenda v2, tomada del dispositivo. Sólo sale
 * si la clínica tiene consultorios en más de un huso o si el dispositivo está
 * en un huso distinto al de los consultorios del médico que se ve
 * (`leyendaHusos.ts`). El dispositivo se cambia con `timezoneId`.
 *
 * Los consultorios de la Clínica Semilla A están todos en Mérida (lo comprueba
 * el `beforeAll`). Después se le da a admin.a uno en Sonora (America/Hermosillo,
 * UTC−7), que se borra al terminar como `postgres`. El interruptor vuelve a
 * como estaba.
 */
test.describe.configure({ mode: 'serial' })
test.use({ storageState: SESION.adminA })

const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
let v2Antes = ''
let sonora = ''

test.beforeAll(() => {
  v2Antes = sqlLocal(`select coalesce((select agenda_v2_encendida::text from public.agenda_ajustes where clinica_id = ${CL}), 'sin')`)
  interruptorAgenda('A', true)
  expect(sqlLocal(`select string_agg(distinct timezone, ',') from public.consultorios where clinica_id = ${CL} and activo`))
    .toBe('America/Merida')
})

test.afterAll(() => {
  try {
    if (sonora) {
      sqlLocal(`
        begin;
        set local session_replication_role = replica;
        delete from public.audit_log where registro_id = :'k'::uuid;
        delete from public.consultorios where id = :'k'::uuid;
        commit;`, { k: sonora })
    }
  } finally {
    if (v2Antes === 'sin') sqlLocal(`delete from public.agenda_ajustes where clinica_id = ${CL}`)
    else if (v2Antes) interruptorAgenda('A', v2Antes === 'true')
  }
})

const leyenda = (page: Page) => page.locator('[data-leyenda-husos]')

/**
 * Abre la agenda y espera a que la v2 termine de montar. Los consultorios llegan con la página (promesa de Flight) y
 * la capa de interacciones se monta en ocioso DESPUÉS; aun así, los casos «no sale» esperan medio segundo más antes
 * de contar cero, para no dar un verde por mirar demasiado pronto. Comprobado en rojo: con la leyenda comparando el
 * NOMBRE de la zona (mutante), «Ciudad de México» la saca y su prueba falla con esta misma espera.
 */
async function abrir(page: Page, v2 = true): Promise<void> {
  await page.goto('/agenda')
  await expect(page.locator(`[data-agenda-v2="${v2 ? 'encendida' : 'apagada'}"]`)).toBeAttached({ timeout: 15000 })
  if (v2) await page.locator('.agenda-raiz[data-interacciones-v2="listas"]').waitFor({ timeout: 15000 })
  else await page.locator('.fc-event').first().waitFor({ timeout: 15000 })
}
async function noSale(page: Page): Promise<void> {
  await page.waitForTimeout(500)
  await expect(leyenda(page)).toHaveCount(0)
}

test.describe('todos los consultorios en Mérida', () => {
  test.describe('dispositivo en Mérida', () => {
    test.use({ timezoneId: 'America/Merida' })
    test('no sale', async ({ page }) => {
      await abrir(page)
      await noSale(page)
    })
  })

  test.describe('dispositivo en Ciudad de México (otra zona, el mismo UTC−6)', () => {
    test.use({ timezoneId: 'America/Mexico_City' })
    test('no sale: cuenta el huso, no el nombre de la zona', async ({ page }) => {
      await abrir(page)
      await noSale(page)
    })
  })

  test.describe('dispositivo en Hermosillo (UTC−7)', () => {
    test.use({ timezoneId: 'America/Hermosillo' })
    test('sale, con el desfase y el lugar del dispositivo', async ({ page }) => {
      await abrir(page)
      await expect(leyenda(page)).toHaveText('Mostrando el horario de tu ubicación actual (UTC−7, Hermosillo)')
      await expect(leyenda(page)).toBeVisible()
    })
    test('con la v2 apagada no sale', async ({ page }) => {
      interruptorAgenda('A', false)
      try {
        await abrir(page, false)
        await noSale(page)
      } finally {
        interruptorAgenda('A', true)
      }
    })
  })
})

test.describe('admin.a con un consultorio en Sonora', () => {
  test.beforeAll(() => {
    sonora = sqlLocal(`
      insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
      select ${CL}, p.id, 'Sonora (e2e K4 leyenda)', 'Sonora K4L', 'Calle 1', 'America/Hermosillo', c.horario_consulta, false
        from public.profiles p join auth.users u on u.id = p.id, public.clinicas c
       where u.email = 'admin.a@semilla.spinus.test' and c.id = ${CL}
      returning id;`)
  })

  test.describe('dispositivo en Mérida', () => {
    test.use({ timezoneId: 'America/Merida' })
    test('sale «(UTC−6, Mérida)»; también viendo a la invitada, que sólo tiene Mérida', async ({ page }, testInfo) => {
      await abrir(page)
      await expect(leyenda(page)).toHaveText('Mostrando el horario de tu ubicación actual (UTC−6, Mérida)')
      await expect(leyenda(page)).toBeVisible()
      if (testInfo.project.name !== 'escritorio') return // el desplegable de médico es del escritorio
      await selectFiltroMedico(page).selectOption({ label: 'Dra. Invitada Semilla Dos' })
      await expect(leyenda(page)).toHaveText('Mostrando el horario de tu ubicación actual (UTC−6, Mérida)')
    })
  })
})
