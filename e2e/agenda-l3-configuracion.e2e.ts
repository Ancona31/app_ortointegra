import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, pestanaConfig, sinPendientesAgenda, sqlLocal } from './ayudas'
import { aprobarAviso, emitirEnlace } from './reservaPublicaAyudas'

/**
 * Tanda L, agente L3 — la configuración de la agenda (puntos 12, 16 y 17 de Angel):
 *   · 12 la letra de la página de configuración, sus pestañas y el funnel va en la ESCALA de la página de
 *        reserva por enlace (`agendaPublica.css`): ningún texto fuera de ella, el título de la página a
 *        18 px en el teléfono y 20 en la computadora, y toda área de toque de 44 px como mínimo;
 *   · 16 quien no administra la clínica ve, UNA vez en cada bloque que no puede cambiar, «Solo el
 *        administrador de la clínica puede cambiar estas opciones.»; el administrador, nunca;
 *   · 17 la secretaria ve las fichas de los médicos con el diseño nuevo (sin botones de 32/36 px) y sólo
 *        lo que su rol puede hacer; y NINGÚN permiso cambia: lo que hoy da 403/404 a la invitada y a la
 *        secretaria lo sigue dando.
 * Corre en los dos proyectos (teléfono y escritorio). Lo que crea lo deshace (`sinPendientesAgenda`).
 */

const RUTA = '/agenda/configuracion'
const LEYENDA = 'Solo el administrador de la clínica puede cambiar estas opciones.'
/** Los tamaños de letra de `agendaPublica.css` que usa la configuración (ver `notas_l3.md`, escala). */
const ESCALA = [11, 13, 13.5, 14, 15, 16, 18, 20]
const PESTANAS_MEDICO = ['Tu enlace', 'Cuándo das consulta', 'Tu consulta', 'Avisos', 'Más opciones']
const PESTANAS_SECRETARIA = ['Enlaces', 'Cuándo dan consulta', 'Tipos de cita', 'Avisos', 'Más opciones']
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const idDe = (correo: string) => sqlLocal(`select id from auth.users where email = :'c'`, { c: correo })

const limpiezas: (() => void)[] = []
// Con el aviso de privacidad sin aprobar, ningún enlace abre y «Completar» no sale (lo deja aprobado, como la semilla).
test.beforeEach(() => { interruptorAgenda('A', true); aprobarAviso(true) })
test.afterEach(() => { for (const l of limpiezas.splice(0)) l() })
test.afterAll(() => { interruptorAgenda('A', false) })

interface Medida { fuera: string[]; chicos: string[]; h1: number | null }

/**
 * Mide lo visible de `<main>`: los textos cuyo tamaño no está en la escala, los controles de menos de
 * 44 × 44 (salvo un enlace dentro de una frase) y el tamaño del `h1`. Los interruptores (52 × 30 a la
 * vista) cuentan por su área de toque: el punto 6 px por encima y por debajo sigue siendo el interruptor.
 */
async function medir(page: Page): Promise<Medida> {
  // Que termine la entrada del paso o de la pestaña: a media animación las cajas aún están escaladas.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))))
  return page.evaluate((escala) => {
    const fuera: string[] = []
    const chicos: string[] = []
    const texto = (el: Element) => (el.textContent ?? '').trim().slice(0, 40)
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden') continue
      const conTexto = [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())
      const fs = parseFloat(cs.fontSize)
      if (conTexto && !escala.includes(fs)) fuera.push(`${fs}px «${texto(el)}»`)
      if (el.matches('[role="switch"]')) {
        // Fuera de la ventana `elementFromPoint` no ve nada: a la vista primero.
        el.scrollIntoView({ block: 'center' })
        const v = el.getBoundingClientRect()
        const x = v.left + v.width / 2
        const toca = [v.top - 6, v.bottom + 6].every(y => document.elementFromPoint(x, y)?.closest('[role="switch"]') === el)
        if (!toca) chicos.push(`interruptor ${v.width}×${v.height}`)
      } else if (el.matches('button, a[href], select, textarea, input:not([type="radio"]):not([type="checkbox"]), [role="tab"]')
        && !(el.tagName === 'A' && cs.display === 'inline') && (r.height < 43.5 || r.width < 43.5)) {
        chicos.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)} «${texto(el) || el.getAttribute('aria-label')}»`)
      }
    }
    const h1 = document.querySelector('main h1')
    return { fuera, chicos, h1: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null }
  }, ESCALA)
}

async function medirTodo(page: Page, pestanas: readonly string[], proyecto: string): Promise<void> {
  await page.goto(RUTA)
  for (const nombre of pestanas) {
    await pestanaConfig(page, nombre)
    await page.waitForLoadState('networkidle')
    const plegado = page.locator('[role="tabpanel"]:visible button[aria-expanded="false"]')
    if (await plegado.count()) await plegado.first().click()
    const m = await medir(page)
    expect(m.fuera, `${nombre}: letra fuera de la escala`).toEqual([])
    expect(m.chicos, `${nombre}: áreas de toque de menos de 44 px`).toEqual([])
    expect(m.h1, `${nombre}: el título de la página`).toBe(proyecto === 'telefono' ? 18 : 20)
  }
}

/** El funnel de la invitada en el paso `paso` (lo que guarda «Terminar después»). */
async function funnelEn(page: Page, paso: number): Promise<void> {
  const id = idDe(CORREO.medicoA)
  // Sin `addInitScript`: volvería a escribirlo en cada navegación y el resto de la prueba no saldría del funnel.
  await page.goto(RUTA)
  await page.evaluate(([k, v]) => { window.localStorage.setItem(k, v) }, [`spinus-agenda-primera-vez:${id}`, String(paso)])
  await page.goto(RUTA)
  await expect(page.locator(`[data-primera-vez="${paso}"]`)).toBeVisible()
}

test.describe('el administrador', () => {
  test.use({ storageState: SESION.adminA })

  test('12 · las cinco pestañas en la escala de la reserva, con áreas de 44 px', async ({ page }, info) => {
    limpiezas.push(sinPendientesAgenda(CORREO.adminA))
    await medirTodo(page, PESTANAS_MEDICO, info.project.name)
  })

  test('16 · el administrador no ve la leyenda, ni en las pestañas ni en el funnel', async ({ page }) => {
    limpiezas.push(sinPendientesAgenda(CORREO.adminA))
    await page.goto(RUTA)
    await expect(page.getByRole('tablist', { name: 'Secciones de la configuración' })).toBeVisible()
    await expect(page.locator('[data-solo-admin]')).toHaveCount(0)
    await expect(page.getByText(LEYENDA)).toHaveCount(0)
    const id = idDe(CORREO.adminA)
    for (const paso of [0, 1, 3]) {
      await page.evaluate(([k, v]) => { window.localStorage.setItem(k, v) }, [`spinus-agenda-primera-vez:${id}`, String(paso)])
      await page.goto(RUTA)
      await expect(page.locator(`[data-primera-vez="${paso}"]`)).toBeVisible()
      await expect(page.locator('[data-solo-admin]')).toHaveCount(0)
    }
    await page.evaluate(k => window.localStorage.removeItem(k), `spinus-agenda-primera-vez:${id}`)
  })
})

test.describe('la invitada', () => {
  test.use({ storageState: SESION.medicoA })

  test('12 · las pestañas y los pasos del funnel en la escala de la reserva', async ({ page }, info) => {
    for (const paso of [1, 2, 3]) {
      await funnelEn(page, paso)
      const m = await medir(page)
      expect(m.fuera, `paso ${paso}`).toEqual([])
      expect(m.chicos, `paso ${paso}`).toEqual([])
      expect(m.h1, `paso ${paso}`).toBe(info.project.name === 'telefono' ? 18 : 20)
    }
    await page.evaluate(() => window.localStorage.clear())
    limpiezas.push(sinPendientesAgenda(CORREO.medicoA))
    await medirTodo(page, PESTANAS_MEDICO, info.project.name)
  })

  test('16 · la leyenda, una vez en el horario de la clínica y en los avisos; en el funnel, en el paso 1 y en el 3', async ({ page }) => {
    await funnelEn(page, 1)
    await expect(page.locator('[data-solo-admin]')).toHaveCount(1)
    await expect(page.locator('[data-solo-admin]')).toHaveText(new RegExp(`${LEYENDA.replace('.', '\\.')}$`))
    await funnelEn(page, 3)
    await expect(page.locator('[data-solo-admin]')).toHaveCount(1)
    await expect(page.locator('[data-solo-admin]')).toHaveText(LEYENDA)
    await page.evaluate(() => window.localStorage.clear())
    limpiezas.push(sinPendientesAgenda(CORREO.medicoA))
    await leyendaEnPestanas(page, 'Cuándo das consulta')
  })
})

/** En las pestañas: una leyenda en la tarjeta del horario de la clínica, una en «Avisos» y ninguna más. */
async function leyendaEnPestanas(page: Page, horario: string): Promise<void> {
  await page.goto(RUTA)
  await pestanaConfig(page, horario)
  await expect(page.locator('[data-horario-clinica] [data-solo-admin]')).toHaveText(LEYENDA)
  await pestanaConfig(page, 'Avisos')
  await expect(page.locator('#config-panel-avisos [data-solo-admin]')).toHaveText(LEYENDA)
  await expect(page.locator('[data-solo-admin]')).toHaveCount(2)
  await expect(page.getByText('Lo cambia quien administra la clínica.')).toHaveCount(0)
  await expect(page.getByText('Estos avisos los cambia quien administra la clínica.')).toHaveCount(0)
}

test.describe('la secretaria', () => {
  test.use({ storageState: SESION.secretariaA })

  test('17 · las mismas cinco pestañas, en la escala de la reserva y sin fichas de 32/36 px', async ({ page }, info) => {
    limpiezas.push(sinPendientesAgenda(CORREO.medicoA))
    await medirTodo(page, PESTANAS_SECRETARIA, info.project.name)
  })

  test('16 · la leyenda, una vez en el horario de la clínica y una en los avisos', async ({ page }) => {
    await leyendaEnPestanas(page, 'Cuándo dan consulta')
  })

  test('17 · «Completar» del enlace de la invitada no le ofrece contestar la duración (sólo el médico o el administrador)', async ({ page, browser }) => {
    // Con su código de verdad (como `agenda-configuracion-guiada` 8): con un hash cualquiera la ficha diría
    // «No abrirá» por no encontrarlo, no por la duración, y «Completar» no saldría.
    const clinicaId = sqlLocal(`select id from public.clinicas where nombre = 'Clínica Semilla A'`)
    const { id: enlace } = emitirEnlace({ clinicaId, medicoId: idDe(CORREO.medicoA), consultorioId: '', consultorioTelefono: null,
      consultorioOtraClinica: '', tipoId: '', tipoNombre: '' }, 'fijo')
    limpiezas.push(() => sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.reserva_enlaces where id = :'e'; commit;`, { e: enlace }))
    // Que a la invitada le falte la duración: sin tipos suyos y sin los de toda la clínica (los apaga y los
    // devuelve; en la base compartida otras pruebas dejan tipos de toda la clínica).
    const apagados = sqlLocal(`with x as (update public.tipos_cita set activo = false where clinica_id = :'cl' and activo
      and (medico_id is null or medico_id = :'m') returning id) select coalesce(string_agg(id::text, ','), '') from x`,
    { cl: clinicaId, m: idDe(CORREO.medicoA) })
    limpiezas.push(() => sqlLocal(`update public.tipos_cita set activo = true
      where id = any (string_to_array(nullif(:'ids', ''), ',')::uuid[])`, { ids: apagados }))
    const admin = await browser.newContext({ storageState: SESION.adminA })
    try {
      for (const [p, contesta] of [[page, false], [await admin.newPage(), true]] as const) {
        await p.goto(RUTA)
        await p.getByRole('button', { name: /Enlaces de los demás médicos/ }).click()
        await p.getByRole('button', { name: 'Completar Enlace fijo' }).last().click()
        const nota = p.getByRole('note', { name: 'Falta para que el enlace abra' })
        await expect(nota).toContainText('La duración de la consulta.')
        await expect(nota.getByText('¿Cuánto dura su consulta?')).toHaveCount(contesta ? 1 : 0)
        if (!contesta) await expect(nota).toContainText('El médico la contesta en su configuración.')
      }
    } finally {
      await admin.close()
    }
  })
})

/* ── 17 · ningún permiso cambia ─────────────────────────────────────────── */

type Peticion = { metodo: 'get' | 'put' | 'patch' | 'post'; url: string; cuerpo?: unknown }

/** Lo que hoy (`cf97bdb`) responde cada petición que la pantalla no ofrece a quien no administra. */
function peticiones(): { pet: Peticion; invitada: number; secretaria: number }[] {
  const admin = idDe(CORREO.adminA)
  const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as unknown
  const tipo = sqlLocal(`select id from public.tipos_cita where medico_id = :'a' and principal and activo limit 1`, { a: admin })
  const consultorio = sqlLocal(`select id from public.consultorios where medico_id = :'a' and activo limit 1`, { a: admin })
  const fijo = sqlLocal(`select id from public.reserva_enlaces where medico_id = :'a' and clase = 'fijo' and revocado_en is null limit 1`, { a: admin })
  const ajustes = JSON.parse(sqlLocal(`select row_to_json(j)::text from (select recordatorio_horas, anticipacion_min_horas, horizonte_dias,
    vigencia_enlace_unico_dias from public.agenda_ajustes where clinica_id = ${CL}) j`)) as unknown
  return [
    { pet: { metodo: 'put', url: '/api/me/horario', cuerpo: { horario } }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'put', url: '/api/me/ajustes-agenda', cuerpo: ajustes }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'patch', url: '/api/me/ajustes-agenda', cuerpo: { recordatorio_encendido: false } }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'post', url: '/api/agenda/restablecer', cuerpo: { confirmacion: 'RESTABLECER' } }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'post', url: '/api/agenda/tipos-cita', cuerpo: { nombre: 'L3', duracion_min: 30, medico_id: admin } }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'post', url: '/api/agenda/tipos-cita', cuerpo: { nombre: 'L3', duracion_min: 30, medico_id: null } }, invitada: 403, secretaria: 403 },
    { pet: { metodo: 'patch', url: `/api/agenda/tipos-cita/${tipo}`, cuerpo: { duracion_min: 45 } }, invitada: 404, secretaria: 403 },
    { pet: { metodo: 'patch', url: `/api/consultorios/${consultorio}`, cuerpo: { horario_revisado: true } }, invitada: 404, secretaria: 404 },
    { pet: { metodo: 'post', url: '/api/agenda/enlaces', cuerpo: { clase: 'fijo', medico_id: admin } }, invitada: 403, secretaria: 0 },
    { pet: { metodo: 'patch', url: `/api/agenda/enlaces/${fijo}`, cuerpo: { accion: 'pausar' } }, invitada: 404, secretaria: 0 },
    { pet: { metodo: 'get', url: `/api/agenda/enlaces/${fijo}` }, invitada: 404, secretaria: 0 },
  ]
}

test.describe('permisos', () => {
  test.use({ storageState: SESION.medicoA })

  test('17 · lo que hoy da 403/404 a la invitada y a la secretaria lo sigue dando (0 = la secretaria sí puede: no se prueba)', async ({ page, browser }, info) => {
    test.skip(info.project.name !== 'escritorio', 'las rutas no dependen del tamaño')
    const lista = peticiones()
    const secretaria = await browser.newContext({ storageState: SESION.secretariaA })
    try {
      for (const { pet, invitada, secretaria: s } of lista) {
        for (const [quien, req, esperado] of [['invitada', page.request, invitada], ['secretaria', secretaria.request, s]] as const) {
          if (esperado === 0) continue
          const r = await req.fetch(pet.url, { method: pet.metodo.toUpperCase(), data: pet.cuerpo })
          expect(r.status(), `${quien} ${pet.metodo.toUpperCase()} ${pet.url}`).toBe(esperado)
        }
      }
    } finally {
      await secretaria.close()
    }
  })
})
