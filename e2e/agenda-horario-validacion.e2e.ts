import { test, expect } from '@playwright/test'
import { CORREO, SESION, enContextoNuevo, irAAgenda, soloEscritorio, sqlLocal, toastConTexto } from './ayudas'

/**
 * P8 (`mejora_agendaV2.md` §6-bis) · `PUT /api/me/horario` valida y audita,
 * FUERA del interruptor de la agenda v2 (aquí está apagado, como en
 * producción):
 *
 *   · un día activo con el cierre igual o antes que la apertura → 400 con el
 *     nombre del día, y el horario de la clínica no cambia;
 *   · el modal de la agenda enseña ese motivo en el aviso y no se cierra;
 *   · un guardado bueno deja una fila `horario_clinica_editado` sin
 *     `descripcion` (sólo el hecho);
 *   · la secretaria sigue recibiendo 403.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const CONFIG = '/api/me/config'
const RUTA = '/api/me/horario'
const CLINICA_A = 'Clínica Semilla A'

type Dia = { activo: boolean; inicio: string; fin: string }
type Horario = Record<string, Dia>

function horarioDeA(): string {
  return sqlLocal(`select horario_consulta::text from public.clinicas where nombre = :'n'`, { n: CLINICA_A })
}

test('fin igual o anterior al inicio en un día activo da 400 y no guarda', async ({ page }) => {
  const original: Horario = (await (await page.request.get(CONFIG)).json()).horario
  const antes = horarioDeA()
  for (const fin of [original.lunes.inicio, '00:00']) {
    const malo = { ...original, lunes: { ...original.lunes, activo: true, fin } }
    const r = await page.request.put(RUTA, { data: { horario: malo } })
    expect(r.status()).toBe(400)
    expect((await r.json()).error).toBe('Lunes: la hora de cierre tiene que ir después de la de apertura')
  }
  expect((await page.request.put(RUTA, { data: { horario: original, extra: 1 } })).status()).toBe(400)
  expect((await page.request.put(RUTA, { data: {} })).status()).toBe(400)
  expect(horarioDeA()).toBe(antes)
})

test('el modal enseña el motivo y se queda abierto', async ({ page }) => {
  const antes = horarioDeA()
  await irAAgenda(page)
  await page.getByRole('button', { name: 'Configurar horario de consulta' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Horario de consulta' })
  // El lunes de la semilla abre a las 08:00: cerrar a las 07:00 es cerrar antes de abrir.
  await dialogo.locator('input[type="time"]').nth(1).fill('07:00')
  const guardado = page.waitForResponse(r => r.url().includes(RUTA) && r.request().method() === 'PUT')
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
  expect((await guardado).status()).toBe(400)
  await expect(toastConTexto(page, 'Lunes: la hora de cierre tiene que ir después de la de apertura')).toBeVisible()
  await expect(dialogo).toBeVisible()
  expect(horarioDeA()).toBe(antes)
})

test('un guardado bueno queda en audit_log sin valores', async ({ page }) => {
  const original: Horario = (await (await page.request.get(CONFIG)).json()).horario
  const desde = sqlLocal('select now()')
  expect((await page.request.put(RUTA, { data: { horario: original } })).status()).toBe(200)
  const fila = sqlLocal(`select count(*) || '|' || count(descripcion) from public.audit_log
     where accion = 'horario_clinica_editado' and tabla = 'clinicas' and created_at >= :'desde'::timestamptz
       and registro_id = (select id from public.clinicas where nombre = :'n')
       and user_id = (select id::text from auth.users where email = :'correo')`,
  { desde, n: CLINICA_A, correo: CORREO.adminA })
  expect(fila).toBe('1|0')
})

test('la secretaria sigue sin poder guardarlo', async ({ browser, page }) => {
  const original: Horario = (await (await page.request.get(CONFIG)).json()).horario
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    expect((await p.request.put(RUTA, { data: { horario: original } })).status()).toBe(403)
  })
})
