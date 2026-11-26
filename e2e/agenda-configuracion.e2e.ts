import { test, expect, type Page } from '@playwright/test'
import {
  CORREO, SESION, enContextoNuevo, interruptorAgenda, irAAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal, tituloUnico,
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
 * Tanda J (J5): la pantalla es la de las maquetas. Quien tiene algo pendiente
 * entra al funnel de primera vez, así que las pruebas de las pestañas dejan
 * antes al médico sin pendientes (`sinPendientesAgenda`); los ajustes se
 * guardan SOLOS («Guardado»), sin botón; «Archivar» es «Quitar».
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
  await expect(page.getByRole('heading', { name: /^(Configuración de la agenda|¿Cuándo das consulta\?)$/ })).toHaveCount(0)
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
    // I5 (punto 15): la configuración es la primera opción del menú del engrane.
    await page.getByRole('button', { name: 'Opciones de la agenda' }).click()
    await page.getByRole('menuitem', { name: 'Configuración de la agenda' }).click()
    await page.waitForURL(`**${RUTA}`)
    // J5: con algo pendiente abre el funnel de primera vez; sin nada, las pestañas. K3: el primer paso del
    // administrador es «Horario de la clínica».
    await expect(page.getByRole('heading', { name: /^(Configuración de la agenda|¿Cuándo das consulta\?|Horario de la clínica)$/ })).toBeVisible()
  })

  /* T3 · punto 5: con la v2 el engrane es SÓLO icono a cualquier ancho (también
     a `2xl`, donde apagada se ve «Horario»); en el teléfono, 44 px de toque.
     I5 (punto 15): el engrane es ahora el menú «Opciones de la agenda» y
     «Configuración de la agenda» es su primera opción. */
  test('el engrane es sólo icono, abre el menú con «Configuración de la agenda» y no dice «Horario»', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1700, height: 900 })
    await irAAgenda(page)
    const engrane = page.getByRole('button', { name: 'Opciones de la agenda' })
    await expect(engrane).toHaveAttribute('title', 'Opciones de la agenda')
    await expect(engrane).toHaveAttribute('aria-haspopup', 'menu')
    await expect(engrane).toHaveText('')
    await engrane.click()
    await expect(page.getByRole('menu', { name: 'Opciones de la agenda' }).getByRole('menuitem').first()).toHaveText('Configuración de la agenda')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Configurar horario de consulta' })).toHaveCount(0)

    const ctx = await browser.newContext({
      storageState: SESION.adminA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      locale: 'es-MX', timezoneId: 'America/Merida',
    })
    try {
      const movil = await ctx.newPage()
      await irAAgenda(movil)
      const engraneMovil = movil.getByRole('button', { name: 'Opciones de la agenda' })
      await expect(engraneMovil).toHaveText('')
      const caja = await engraneMovil.boundingBox()
      // Redondeado: el navegador da 43.99999… por subpíxeles.
      expect(Math.round(Math.min(caja?.width ?? 0, caja?.height ?? 0))).toBeGreaterThanOrEqual(44)
    } finally {
      await ctx.close()
    }
  })

  test('el administrador edita los ajustes: se guardan solos, persisten y quedan en audit_log', async ({ page }) => {
    const deshacer = sinPendientesAgenda(CORREO.adminA)
    // El recordatorio encendido (como postgres, antes de `desde`): sólo así sale su campo de horas.
    sqlLocal(`update public.agenda_ajustes set recordatorio_encendido = true
               where clinica_id = (select id from public.clinicas where nombre = :'clinica')`, { clinica: CLINICA_A })
    try {
      const desde = sqlLocal('select now()')
      await page.goto(RUTA)
      await pestanaConfig(page, 'Avisos')
      const guardado = page.waitForResponse(r => r.url().includes(API_AJUSTES) && r.request().method() === 'PUT')
      const recordatorio = page.getByLabel('Mandarlo')
      await recordatorio.fill('12')
      await recordatorio.blur()
      expect((await guardado).status()).toBe(200)
      await expect(page.locator('[data-aviso-config]')).toHaveText('Guardado')
      const vigencia = page.getByLabel('Un enlace de una vez deja de servir a los')
      await vigencia.fill('14')
      await vigencia.blur()
      await expect.poll(() => ajustesA()).toBe('12|2|60|14|true')

      await page.reload()
      await pestanaConfig(page, 'Avisos')
      await expect(page.getByLabel('Mandarlo')).toHaveValue('12')
      await expect(page.getByLabel('Un enlace de una vez deja de servir a los')).toHaveValue('14')

      /* Una fila por guardado (dos: el campo del recordatorio y el de la vigencia), de `log_tabla_change` (disparador
         `audit_agenda_ajustes`), con el uuid del administrador: la de `interruptorAgenda` es de `system`. */
      const filas = sqlLocal(`select count(*) from public.audit_log
         where tabla = 'agenda_ajustes' and accion = 'UPDATE' and created_at >= :'desde'::timestamptz
           and registro_id = (select a.id from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id where c.nombre = :'clinica')
           and user_id = (select id::text from auth.users where email = :'correo')`,
      { desde, clinica: CLINICA_A, correo: CORREO.adminA })
      expect(Number(filas)).toBe(2)
    } finally {
      sqlLocal(`update public.agenda_ajustes set recordatorio_encendido = false
                 where clinica_id = (select id from public.clinicas where nombre = :'clinica')`, { clinica: CLINICA_A })
      deshacer()
    }
  })

  test('un ajuste fuera de rango da error y no se guarda', async ({ page }) => {
    const deshacer = sinPendientesAgenda(CORREO.adminA)
    try {
      await page.goto(RUTA)
      await pestanaConfig(page, 'Avisos')
      let enviados = 0
      page.on('request', r => { if (r.url().includes(API_AJUSTES) && r.method() === 'PUT') enviados += 1 })
      const horas = page.getByLabel('No pueden apartar si faltan menos de')
      await horas.fill('73')
      await horas.blur()
      await expect(page.getByRole('alert').filter({ hasText: 'Anticipación mínima' }))
        .toHaveText('Anticipación mínima para reservar por enlace: de 0 a 72 horas')
      expect(enviados).toBe(0)
    } finally {
      deshacer()
    }

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
      await p.getByRole('button', { name: 'Opciones de la agenda' }).click()
      await p.getByRole('menuitem', { name: 'Configuración de la agenda' }).click()
      await p.waitForURL(`**${RUTA}`)
      await pestanaConfig(p, 'Avisos')
      await expect(p.getByLabel('Pueden ver horarios de los próximos')).toBeDisabled()
      await expect(p.getByLabel('Pueden ver horarios de los próximos')).toHaveValue('60')
      await expect(p.locator('#config-panel-avisos').getByText('Solo el médico administrador puede cambiar estas opciones.')).toBeVisible()
      await pestanaConfig(p, 'Tipos de cita')
      await expect(p.getByRole('button', { name: 'Agregar tipo de cita' })).toHaveCount(0)
      await pestanaConfig(p, 'Cuándo dan consulta')
      const consultorio = p.getByRole('group', { name: CONSULTORIO_INVITADO })
      await expect(consultorio).toBeVisible()
      await expect(consultorio.getByRole('button')).toHaveCount(0)
      expect((await p.request.put(API_AJUSTES, { data: { ...FABRICA, recordatorio_horas: 1 } })).status()).toBe(403)
    })
    expect(ajustesA()).toBe('24|2|60|7|true')
  })

  test('el administrador crea y archiva (quita) un tipo de cita', async ({ page }) => {
    const nombre = tituloUnico('Tipo e2e')
    const deshacer = sinPendientesAgenda(CORREO.adminA)
    try {
      await page.goto(RUTA)
      await pestanaConfig(page, 'Tu consulta')
      const tipos = page.getByRole('tabpanel', { name: 'Tu consulta' })
      await tipos.getByRole('button', { name: 'Agregar tipo de cita' }).click()
      await tipos.getByLabel('Nombre').fill(nombre)
      await tipos.getByLabel('Duración (min)').fill('45')
      await tipos.getByLabel('Para').selectOption({ label: 'Toda la clínica' })
      await tipos.getByRole('button', { name: 'Agregar', exact: true }).click()
      await expect(page.locator('[data-aviso-config]')).toHaveText('Guardado')
      const fila = tipos.getByRole('group', { name: nombre })
      await expect(fila).toContainText('45 minutos')
      await expect(fila).toContainText('Toda la clínica')

      await fila.getByRole('button', { name: `Quitar ${nombre}` }).click()
      // «Archivado» es ahora «Quitados (N)», plegado: se abre y ahí está, con «Reactivar».
      await tipos.getByText(/^Quitados \(\d+\)$/).click()
      await expect(fila.getByRole('button', { name: `Reactivar ${nombre}` })).toBeVisible()
      expect(sqlLocal(`select activo || '|' || duracion_min from public.tipos_cita where nombre = :'n'`, { n: nombre })).toBe('false|45')
    } finally {
      sqlLocal(`delete from public.tipos_cita where nombre = :'n'`, { n: nombre })
      deshacer()
    }
  })

  test('un médico edita la disponibilidad de su consultorio', async ({ browser }) => {
    const deshacer = sinPendientesAgenda(CORREO.medicoA)
    const antes = sqlLocal(`select json_build_object('h', horario, 'p', horario_propio)::text from public.consultorios where nombre = :'n'`,
      { n: CONSULTORIO_INVITADO })
    try {
      sqlLocal(`update public.consultorios set horario_propio = false where nombre = :'n'`, { n: CONSULTORIO_INVITADO })
      await enContextoNuevo(browser, SESION.medicoA, async (p) => {
        await p.goto(RUTA)
        await pestanaConfig(p, 'Cuándo das consulta')
        const consultorio = p.getByRole('group', { name: CONSULTORIO_INVITADO })
        await expect(consultorio).toContainText('Igual que la clínica')
        await consultorio.getByRole('button', { name: `Cambiar horario de ${CONSULTORIO_INVITADO}` }).click()
        const dialogo = p.getByRole('dialog', { name: `Horario en ${CONSULTORIO_INVITADO}` })
        await dialogo.getByRole('button', { name: 'Otro horario' }).click()
        await dialogo.getByRole('group', { name: 'Lunes' }).getByLabel('Sales').fill('12:00')
        const guardado = p.waitForResponse(r => r.url().includes('/api/consultorios/') && r.request().method() === 'PATCH')
        await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
        expect((await guardado).status()).toBe(200)
        await expect(p.locator('[data-aviso-config]')).toHaveText('Guardado')
        await expect(consultorio).toContainText('Horario propio')
        await expect(consultorio).toContainText('Lun · 8:00 – 12:00')
      })
      expect(sqlLocal(`select horario_propio || '|' || (horario -> 'lunes' ->> 'fin') from public.consultorios where nombre = :'n'`,
        { n: CONSULTORIO_INVITADO })).toBe('true|12:00')
    } finally {
      sqlLocal(`update public.consultorios set horario_propio = (:'a'::jsonb ->> 'p')::boolean, horario = :'a'::jsonb -> 'h'
                 where nombre = :'n'`, { n: CONSULTORIO_INVITADO, a: antes })
      deshacer()
    }
  })
})
