import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, enContextoNuevo, interruptorAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal } from './ayudas'

/**
 * Tanda K, agente K3 — la configuración de la agenda (puntos 11 a 14 de Angel):
 *   · 11 el horario de la clínica en su tarjeta, al INICIO de «Cuándo das consulta», con sus días y
 *        horas; «Cambiar horario» sólo para el médico administrador (y el PUT da 403 a los demás).
 *
 * Cada prueba deja la clínica A como estaba (`foto`/`devolver`, como postgres; copia de las de
 * `agenda-j5-configuracion`, que viven dentro de ese archivo).
 */
test.use({ storageState: SESION.adminA })

const RUTA = '/agenda/configuracion'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`

/** Lo que estas pruebas tocan, para devolverlo (como postgres). */
function foto(): string {
  return sqlLocal(`select json_build_object(
    'clinica', (select horario_consulta from public.clinicas where id = ${CL}))::text`)
}

function devolver(f: string): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    update public.clinicas set horario_consulta = :'f'::jsonb -> 'clinica' where id = ${CL};
    commit;`, { f })
}

let instantanea = ''
const limpiezas: (() => void)[] = []
test.beforeEach(() => { interruptorAgenda('A', true); instantanea = foto() })
test.afterEach(() => {
  for (const l of limpiezas.splice(0)) l()
  if (instantanea) devolver(instantanea)
  instantanea = ''
  interruptorAgenda('A', false)
})

/** Las tarjetas del panel «Cuándo das consulta» (la de la clínica y una por consultorio), en el orden del documento. */
const tarjetasDelPanel = (page: Page) => page.locator('#config-panel-horario [role="group"]')

/* ── 11 · la tarjeta del horario de la clínica ─────────────────────────── */

test.describe('escritorio', () => {
soloEscritorio()

test('11 · el horario de la clínica va primero, con sus días; sólo el administrador ve «Cambiar horario» y lo guarda; los demás lo ven sin botón y su PUT da 403', async ({ page, browser }) => {
  limpiezas.push(sinPendientesAgenda(CORREO.adminA), sinPendientesAgenda(CORREO.medicoA))
  await page.goto(RUTA)
  await pestanaConfig(page, 'Cuándo das consulta')
  const tarjeta = page.getByRole('group', { name: 'Horario de la clínica' })
  await expect(tarjetasDelPanel(page).first()).toHaveAccessibleName('Horario de la clínica')
  await expect(tarjeta).toContainText('Lun a vie · 8:00 – 18:00')
  await expect(tarjeta).toContainText('Sáb · 8:00 – 13:00')
  await tarjeta.getByRole('button', { name: 'Cambiar horario de la clínica' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Horario de la clínica' })
  await dialogo.getByRole('switch', { name: 'Sábado' }).click()
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(tarjeta).not.toContainText('Sáb')
  expect(sqlLocal(`select horario_consulta -> 'sabado' ->> 'activo' from public.clinicas where id = ${CL}`)).toBe('false')

  const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>
  for (const [sesion, pestana] of [[SESION.medicoA, 'Cuándo das consulta'], [SESION.secretariaA, 'Cuándo dan consulta']] as const) {
    await enContextoNuevo(browser, sesion, async (p) => {
      expect((await p.request.put('/api/me/horario', { data: { horario } })).status()).toBe(403)
      await p.goto(RUTA)
      await pestanaConfig(p, pestana)
      const suya = p.getByRole('group', { name: 'Horario de la clínica' })
      await expect(tarjetasDelPanel(p).first()).toHaveAccessibleName('Horario de la clínica')
      await expect(suya).toContainText('Lun a vie · 8:00 – 18:00')
      await expect(suya).toContainText('Lo cambia quien administra la clínica.')
      await expect(suya.getByRole('button')).toHaveCount(0)
    })
  }
})
})
