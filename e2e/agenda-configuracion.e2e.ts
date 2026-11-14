import { test, expect, type Page } from '@playwright/test'
import {
  CORREO, SESION, enContextoNuevo, interruptorAgenda, irAAgenda, soloEscritorio, sqlLocal, toastConTexto, tituloUnico,
} from './ayudas'

/**
 * B4 · La pantalla de configuración del calendario (`/agenda/configuracion`,
 * plan del bloque B), detrás del interruptor de la agenda v2:
 *
 *   · apagado: la ruta da la página de no encontrado, su API responde 404 y el
 *     engrane abre el modal de horario de siempre, sin ningún enlace a ella;
 *   · encendido: el engrane lleva a la pantalla; el administrador edita los
 *     ajustes, que persisten y dejan su fila en `audit_log`; la secretaria los
 *     ve en solo lectura y su PUT da 403; un ajuste fuera de rango da error; el
 *     administrador crea y archiva un tipo de cita; un médico edita la
 *     disponibilidad de su consultorio.
 *
 * ⚠️ EL 404 SE COMPRUEBA POR EL CONTENIDO, NO POR EL ESTADO HTTP. La ruta
 * cuelga de fronteras de `Suspense` (`loading.tsx`): si el cuerpo ya empezó a
 * salir cuando la página llama a `notFound()`, Next pinta la página de no
 * encontrado con estado 200 y `noindex` (ver la cabecera de `page.tsx`).
 *
 * Lo que se cambia aquí se restaura como `postgres` al terminar, pase lo que
 * pase. Los tipos de cita creados se BORRAN: `scripts/agenda-semilla.ts` no
 * limpia `tipos_cita`, y su FK RESTRICT a `clinicas` y a `profiles` impediría
 * volver a sembrar.
 */
soloEscritorio()

const RUTA = '/agenda/configuracion'
const API_AJUSTES = '/api/me/ajustes-agenda'
const CLINICA_A = 'Clínica Semilla A'
const FABRICA = { recordatorio_horas: 24, anticipacion_min_horas: 2, horizonte_dias: 60, vigencia_enlace_unico_dias: 7 }
const CONSULTORIO_INVITADO = 'Rehabilitación (ficticio)'

test.use({ storageState: SESION.adminA })

/** La página de no encontrado de Next, y nada de la pantalla. */
async function esperarNoEncontrada(page: Page): Promise<void> {
  const r = await page.goto(RUTA)
  expect([200, 404]).toContain(r?.status())
  await expect(page.getByText('This page could not be found')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Configuración del calendario' })).toHaveCount(0)
}

function restaurarAjustesA(): void {
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 24, anticipacion_min_horas = 2,
              horizonte_dias = 60, vigencia_enlace_unico_dias = 7
             where clinica_id = (select id from public.clinicas where nombre = :'clinica')`, { clinica: CLINICA_A })
}

function ajustesA(): string {
  return sqlLocal(`select recordatorio_horas || '|' || anticipacion_min_horas || '|' || horizonte_dias || '|'
                          || vigencia_enlace_unico_dias || '|' || agenda_v2_encendida
                     from public.agenda_ajustes
                    where clinica_id = (select id from public.clinicas where nombre = :'clinica')`, { clinica: CLINICA_A })
}

test.describe('con el interruptor apagado', () => {
  test('la ruta no existe, su API da 404 y el engrane abre el modal de siempre', async ({ page }) => {
    await esperarNoEncontrada(page)
    expect((await page.request.put(API_AJUSTES, { data: FABRICA })).status()).toBe(404)

    await irAAgenda(page)
    await expect(page.locator(`a[href="${RUTA}"]`)).toHaveCount(0)
    await page.getByRole('button', { name: 'Configurar horario de consulta' }).click()
    await expect(page.getByRole('dialog', { name: 'Horario de consulta' })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/agenda')
  })

  test('la secretaria no ve el engrane ni la ruta', async ({ browser }) => {
    await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
      await irAAgenda(p)
      await expect(p.getByRole('button', { name: 'Configurar horario de consulta' })).toHaveCount(0)
      await esperarNoEncontrada(p)
    })
  })
})

test.describe('con el interruptor encendido', () => {
  test.beforeEach(() => { interruptorAgenda('A', true) })
  test.afterEach(() => {
    restaurarAjustesA()
    interruptorAgenda('A', false)
  })

  test('el engrane lleva a la pantalla', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('button', { name: 'Configuración de la agenda' }).click()
    await page.waitForURL(`**${RUTA}`)
    await expect(page.getByRole('heading', { name: 'Configuración del calendario' })).toBeVisible()
  })

  /* T3 · punto 5: con la v2 el engrane es SÓLO icono a cualquier ancho (también
     a `2xl`, donde apagada se ve «Horario»), con nombre y `title` «Configuración
     de la agenda»; en el teléfono, el mismo nombre y 44 px de toque. */
  test('el engrane es sólo icono, se llama «Configuración de la agenda» y no dice «Horario»', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1700, height: 900 })
    await irAAgenda(page)
    const engrane = page.getByRole('button', { name: 'Configuración de la agenda' })
    await expect(engrane).toHaveAttribute('title', 'Configuración de la agenda')
    await expect(engrane).toHaveText('')
    await expect(page.getByRole('button', { name: 'Configurar horario de consulta' })).toHaveCount(0)

    const ctx = await browser.newContext({
      storageState: SESION.adminA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      locale: 'es-MX', timezoneId: 'America/Merida',
    })
    try {
      const movil = await ctx.newPage()
      await irAAgenda(movil)
      const engraneMovil = movil.getByRole('button', { name: 'Configuración de la agenda' })
      await expect(engraneMovil).toHaveText('')
      const caja = await engraneMovil.boundingBox()
      expect(Math.min(caja?.width ?? 0, caja?.height ?? 0)).toBeGreaterThanOrEqual(44)
    } finally {
      await ctx.close()
    }
  })

  test('el administrador edita los ajustes: persisten y quedan en audit_log', async ({ page }) => {
    const desde = sqlLocal('select now()')
    await page.goto(RUTA)
    await page.getByLabel('Recordatorio por correo').fill('12')
    await page.getByLabel('Vigencia del enlace de un solo uso').fill('14')
    const guardado = page.waitForResponse(r => r.url().includes(API_AJUSTES) && r.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Guardar ajustes' }).click()
    expect((await guardado).status()).toBe(200)
    await expect(toastConTexto(page, 'Ajustes guardados')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Recordatorio por correo')).toHaveValue('12')
    await expect(page.getByLabel('Vigencia del enlace de un solo uso')).toHaveValue('14')
    expect(ajustesA()).toBe('12|2|60|14|true')

    /* La fila es la de `log_tabla_change` (disparador `audit_agenda_ajustes`),
       con el uuid del administrador: la de `interruptorAgenda` es de `system`. */
    const filas = sqlLocal(`select count(*) from public.audit_log
       where tabla = 'agenda_ajustes' and accion = 'UPDATE' and created_at >= :'desde'::timestamptz
         and registro_id = (select a.id from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id where c.nombre = :'clinica')
         and user_id = (select id::text from auth.users where email = :'correo')`,
    { desde, clinica: CLINICA_A, correo: CORREO.adminA })
    expect(Number(filas)).toBe(1)
  })

  test('un ajuste fuera de rango da error y no se guarda', async ({ page }) => {
    await page.goto(RUTA)
    let enviados = 0
    page.on('request', r => { if (r.url().includes(API_AJUSTES)) enviados += 1 })
    await page.getByLabel('Recordatorio por correo').fill('73')
    await page.getByRole('button', { name: 'Guardar ajustes' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Recordatorio por correo' })).toHaveText('Recordatorio por correo: de 1 a 72 horas antes de la cita')
    expect(enviados).toBe(0)

    // El servidor dice lo mismo, y rechaza el interruptor y el candado.
    const fuera = await page.request.put(API_AJUSTES, { data: { ...FABRICA, horizonte_dias: 366 } })
    expect(fuera.status()).toBe(400)
    expect((await page.request.put(API_AJUSTES, { data: { ...FABRICA, agenda_v2_encendida: false } })).status()).toBe(400)
    expect((await page.request.put(API_AJUSTES, { data: { ...FABRICA, candado_citas_activas: 9 } })).status()).toBe(400)
    expect(ajustesA()).toBe('24|2|60|7|true')
  })

  test('la secretaria lo ve en solo lectura y su PUT da 403', async ({ browser }) => {
    await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
      await irAAgenda(p)
      await p.getByRole('button', { name: 'Configuración de la agenda' }).click()
      await p.waitForURL(`**${RUTA}`)
      await expect(p.getByLabel('Recordatorio por correo')).toBeDisabled()
      await expect(p.getByLabel('Recordatorio por correo')).toHaveValue('24')
      await expect(p.getByRole('button', { name: 'Guardar ajustes' })).toHaveCount(0)
      await expect(p.getByRole('button', { name: 'Editar horario' })).toHaveCount(0)
      await expect(p.getByRole('button', { name: 'Crear tipo' })).toHaveCount(0)
      const disponibilidad = p.getByRole('region', { name: 'Disponibilidad por consultorio' })
      await expect(disponibilidad.getByRole('listitem', { name: CONSULTORIO_INVITADO })).toBeVisible()
      await expect(disponibilidad.getByRole('button')).toHaveCount(0)
      expect((await p.request.put(API_AJUSTES, { data: { ...FABRICA, recordatorio_horas: 1 } })).status()).toBe(403)
    })
    expect(ajustesA()).toBe('24|2|60|7|true')
  })

  test('el administrador crea y archiva un tipo de cita', async ({ page }) => {
    const nombre = tituloUnico('Tipo e2e')
    try {
      await page.goto(RUTA)
      const tipos = page.getByRole('region', { name: 'Tipos de cita' })
      await tipos.getByLabel('Nombre').fill(nombre)
      await tipos.getByLabel('Duración (min)').fill('45')
      await tipos.getByRole('button', { name: 'Crear tipo' }).click()
      await expect(toastConTexto(page, 'Tipo de cita creado')).toBeVisible()
      const fila = tipos.getByRole('listitem').filter({ hasText: nombre })
      await expect(fila).toContainText('45 min')
      await expect(fila).toContainText('Toda la clínica')

      await fila.getByRole('button', { name: `Archivar ${nombre}` }).click()
      await expect(toastConTexto(page, 'Tipo de cita archivado')).toBeVisible()
      await expect(fila).toContainText('Archivado')
      expect(sqlLocal(`select activo || '|' || duracion_min from public.tipos_cita where nombre = :'n'`, { n: nombre })).toBe('false|45')
    } finally {
      sqlLocal(`delete from public.tipos_cita where nombre = :'n'`, { n: nombre })
    }
  })

  test('un médico edita la disponibilidad de su consultorio', async ({ browser }) => {
    try {
      await enContextoNuevo(browser, SESION.medicoA, async (p) => {
        await p.goto(RUTA)
        const consultorio = p.getByRole('region', { name: 'Disponibilidad por consultorio' })
          .getByRole('listitem', { name: CONSULTORIO_INVITADO })
        await expect(consultorio).toContainText('Usa el horario de la clínica')
        await consultorio.getByRole('button', { name: 'Usar horario propio' }).click()
        const dialogo = p.getByRole('dialog', { name: 'Horario de consulta' })
        await dialogo.locator('input[type="time"]').nth(1).fill('12:00')
        const guardado = p.waitForResponse(r => r.url().includes('/api/consultorios/') && r.request().method() === 'PATCH')
        await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
        expect((await guardado).status()).toBe(200)
        await expect(toastConTexto(p, 'Disponibilidad guardada')).toBeVisible()
        await expect(consultorio).toContainText('Horario propio')
        await expect(consultorio).toContainText('08:00 – 12:00')
      })
      expect(sqlLocal(`select horario_propio || '|' || (horario -> 'lunes' ->> 'fin') from public.consultorios where nombre = :'n'`,
        { n: CONSULTORIO_INVITADO })).toBe('true|12:00')
    } finally {
      sqlLocal(`update public.consultorios set horario_propio = false, horario = jsonb_set(horario, '{lunes,fin}', '"18:00"')
                 where nombre = :'n'`, { n: CONSULTORIO_INVITADO })
    }
  })
})
