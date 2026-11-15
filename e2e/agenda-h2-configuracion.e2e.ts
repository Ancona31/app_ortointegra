import { test, expect, type Browser, type Page } from '@playwright/test'
import { CORREO, SESION, enContextoNuevo, interruptorAgenda, pestanaConfig, soloEscritorio, sqlLocal, toastConTexto } from './ayudas'

/**
 * Tanda H, agente H2 — la configuración de la agenda (puntos 5 a 10 de Angel):
 *   · 5  pestañas accesibles; abre en «Primeros pasos» mientras falte algo y,
 *        si no, en la primera; en el teléfono la fila se desplaza de lado;
 *   · 6  los enlaces de los médicos invitados, plegados; el del administrador
 *        primero;
 *   · 7  todo botón de la configuración con borde y fondo visibles EN REPOSO,
 *        en claro y en oscuro (estilos computados; borde ≥ 3:1);
 *   · 8  «Plazos y recordatorios»: una línea por ajuste;
 *   · 9  el interruptor del recordatorio (apagado de fábrica; sólo el
 *        administrador). La tarea programada con él apagado/encendido está en
 *        `recordatorios.e2e.ts`;
 *   · 10 «Restablecer configuración de la agenda»: sólo el administrador, con
 *        la palabra escrita; deja «Primeros pasos» en 0 de 3 y no toca citas.
 * Cada prueba devuelve la clínica A como estaba (la semilla la recrea igual
 * al empezar cada corrida).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const RUTA = '/agenda/configuracion'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  sqlLocal(`update public.agenda_ajustes set recordatorio_encendido = false where clinica_id = ${CL}`)
  interruptorAgenda('A', false)
})

/** Foto de lo que el reinicio toca, para devolverlo como estaba (como postgres). */
function guardarConfig(): string {
  return sqlLocal(`select json_build_object(
    'tipos', (select coalesce(json_agg(id), '[]') from public.tipos_cita where clinica_id = ${CL} and activo),
    'enlaces', (select coalesce(json_agg(id), '[]') from public.reserva_enlaces where clinica_id = ${CL} and revocado_en is null),
    'cons', (select coalesce(json_agg(json_build_object('id', id, 'h', horario, 'p', horario_propio)), '[]') from public.consultorios where clinica_id = ${CL}),
    'aj', (select row_to_json(j) from (select recordatorio_horas, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias
             from public.agenda_ajustes where clinica_id = ${CL}) j))::text`)
}
function devolverConfig(foto: string): void {
  sqlLocal(`with f as (select :'foto'::jsonb as j)
    , t as (update public.tipos_cita set activo = true where id in (select jsonb_array_elements_text(j -> 'tipos')::uuid from f) returning 1)
    , e as (update public.reserva_enlaces set revocado_en = null, revocado_por = null
              where id in (select jsonb_array_elements_text(j -> 'enlaces')::uuid from f) returning 1)
    , c as (update public.consultorios k set horario = x.v -> 'h', horario_propio = (x.v ->> 'p')::boolean
              from (select jsonb_array_elements(j -> 'cons') v from f) x where k.id = (x.v ->> 'id')::uuid returning 1)
    update public.agenda_ajustes a set recordatorio_horas = (f.j -> 'aj' ->> 'recordatorio_horas')::int,
      anticipacion_min_horas = (f.j -> 'aj' ->> 'anticipacion_min_horas')::int, horizonte_dias = (f.j -> 'aj' ->> 'horizonte_dias')::int,
      vigencia_enlace_unico_dias = (f.j -> 'aj' ->> 'vigencia_enlace_unico_dias')::int
      from f where a.clinica_id = ${CL};`, { foto })
}

/** Deja al administrador sin nada pendiente: su duración y su enlace fijo (se borran al terminar). */
function adminSinPendientes(): () => void {
  const tipo = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
    select ${CL}, id, 'Consulta', 30, true from auth.users where email = :'c' returning id`, { c: CORREO.adminA })
  const enlace = sqlLocal(`insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
    select gen_random_uuid(), ${CL}, id, 'fijo', encode(sha256(gen_random_uuid()::text::bytea), 'hex') from auth.users where email = :'c' returning id`, { c: CORREO.adminA })
  return () => sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.reserva_enlaces where id = :'e'; delete from public.tipos_cita where id = :'t'; commit;`, { e: enlace, t: tipo })
}

/* ── Punto 5 · pestañas ─────────────────────────────────────────────── */

test('5 · pestañas con su rol, abre en «Primeros pasos» mientras falte algo, y flechas e Inicio/Fin', async ({ page }) => {
  await page.goto(RUTA)
  const lista = page.getByRole('tablist', { name: 'Secciones de la configuración' })
  const pasos = lista.getByRole('tab', { name: /^Primeros pasos.*pendiente/ })
  await expect(pasos).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: /Primeros pasos/ })).toBeVisible()
  // Una sola pestaña en el orden de tabulación; las demás, -1.
  await expect(lista.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
  // Sólo se ve un panel: «Plazos y recordatorios» está, pero escondido.
  await expect(page.getByRole('heading', { name: 'Plazos y recordatorios' })).toBeHidden()
  await pasos.focus()
  await page.keyboard.press('ArrowDown')
  const horario = lista.getByRole('tab', { name: 'Horario y disponibilidad' })
  await expect(horario).toHaveAttribute('aria-selected', 'true')
  await expect(horario).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Disponibilidad por consultorio' })).toBeVisible()
  await page.keyboard.press('End')
  await expect(lista.getByRole('tab', { name: 'Restablecer' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(pasos).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(lista.getByRole('tab', { name: 'Restablecer' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(pasos).toBeFocused()
  // «Abrir horario»/«Revisar» de un paso cambian de pestaña en vez de saltar a un ancla escondida.
  await page.getByRole('region', { name: 'Primeros pasos' }).getByRole('link', { name: 'Revisar' }).first().click()
  await expect(horario).toHaveAttribute('aria-selected', 'true')
})

test('5 · sin nada pendiente abre en la primera sección y no hay pestaña «Primeros pasos»', async ({ page }) => {
  const deshacer = adminSinPendientes()
  try {
    await page.goto(RUTA)
    await expect(page.getByRole('tab', { name: 'Horario y disponibilidad' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /Primeros pasos/ })).toHaveCount(0)
  } finally {
    deshacer()
  }
})

test('5 · en el teléfono la fila de pestañas se desplaza de lado, sin envolver', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: SESION.adminA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Merida' })
  try {
    const p = await ctx.newPage()
    await p.goto(RUTA)
    const lista = p.getByRole('tablist', { name: 'Secciones de la configuración' })
    await expect(lista.getByRole('tab').first()).toBeVisible()
    const m = await lista.evaluate(el => ({
      desborda: el.scrollWidth > el.clientWidth + 1, overflow: getComputedStyle(el).overflowX,
      filas: new Set(Array.from(el.children).map(c => Math.round(c.getBoundingClientRect().top))).size,
      pagina: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }))
    expect(m).toEqual({ desborda: true, overflow: 'auto', filas: 1, pagina: true })
    // Elegir la última la trae a la vista.
    await lista.getByRole('tab', { name: 'Restablecer' }).click()
    await expect(lista.getByRole('tab', { name: 'Restablecer' })).toBeInViewport()
  } finally {
    await ctx.close()
  }
})

/* ── Punto 6 · enlaces de los invitados, plegados ───────────────────── */

test('6 · el administrador ve primero el suyo; los de los invitados, plegados hasta pulsar (también la secretaria)', async ({ page, browser }) => {
  await page.goto(RUTA)
  await pestanaConfig(page, 'Enlaces de reserva')
  const seccion = page.getByRole('region', { name: 'Enlaces de reserva' })
  const titulos = seccion.getByRole('heading', { level: 4 })
  await expect(titulos).toHaveText(['Dr. Admin Semilla Uno (tú)'])
  const plegado = seccion.getByRole('button', { name: 'Enlaces de los demás médicos (1)' })
  await expect(plegado).toHaveAttribute('aria-expanded', 'false')
  await plegado.click()
  await expect(plegado).toHaveAttribute('aria-expanded', 'true')
  await expect(titulos).toHaveText(['Dr. Admin Semilla Uno (tú)', /Invitada Semilla Dos/])
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await p.goto(RUTA)
    await pestanaConfig(p, 'Enlaces de reserva')
    const s = p.getByRole('region', { name: 'Enlaces de reserva' })
    await expect(s.getByRole('heading', { level: 4 })).toHaveText(['Dr. Admin Semilla Uno'])
    await expect(s.getByRole('button', { name: 'Enlaces de los demás médicos (1)' })).toHaveAttribute('aria-expanded', 'false')
  })
})

/* ── Punto 7 · botones en reposo ────────────────────────────────────── */

/** Cada botón VISIBLE de la pantalla: borde ≥ 1 px con ≥ 3:1 contra el fondo que lo rodea, y fondo propio. */
async function botonesEnReposo(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
    const lum = ([r = 0, g = 0, b = 0]: number[]) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const opaco = (c: string) => { const v = rgb(c); return c !== 'transparent' && (v.length < 4 || (v[3] ?? 1) > 0) }
    const fondo = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (opaco(c)) return c }
      return 'rgb(255, 255, 255)'
    }
    const malos: string[] = []
    const main = document.querySelector('main') ?? document.body
    for (const b of Array.from(main.querySelectorAll<HTMLElement>('button, a[class*="h-9"], a[class*="h-8"]'))) {
      if (b.offsetParent === null || b.closest('[role="dialog"], [role="alertdialog"]')) continue
      const cs = getComputedStyle(b)
      const [l1, l2] = [lum(rgb(cs.borderTopColor)), lum(rgb(fondo(b.parentElement)))].sort((x, y) => y - x)
      const contraste = ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05)
      const nombre = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 40)
      if (parseFloat(cs.borderTopWidth) < 1) malos.push(`${nombre}: sin borde`)
      else if (contraste < 3) malos.push(`${nombre}: borde ${contraste.toFixed(2)}:1`)
      if (!opaco(cs.backgroundColor)) malos.push(`${nombre}: sin fondo`)
    }
    return malos
  })
}

async function revisarTodasLasPestanas(p: Page): Promise<string[]> {
  const malos: string[] = []
  const pestanas = p.getByRole('tablist', { name: 'Secciones de la configuración' }).getByRole('tab')
  for (let i = 0; i < await pestanas.count(); i++) {
    await pestanas.nth(i).click()
    await expect(p.getByText('Cargando', { exact: false })).toHaveCount(0)
    const desplegar = p.getByRole('button', { name: /Enlaces de los demás médicos/ })
    if (await desplegar.isVisible() && (await desplegar.getAttribute('aria-expanded')) === 'false') await desplegar.click()
    const nombre = await pestanas.nth(i).textContent()
    malos.push(...(await botonesEnReposo(p)).map(m => `${nombre} · ${m}`))
  }
  return malos
}

async function enTema(browser: Browser, oscuro: boolean, sesion: string, fn: (p: Page) => Promise<void>): Promise<void> {
  const ctx = await browser.newContext({ storageState: sesion, colorScheme: oscuro ? 'dark' : 'light', locale: 'es-MX', timezoneId: 'America/Merida' })
  if (oscuro) await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch { /* privado */ } })
  try { await fn(await ctx.newPage()) } finally { await ctx.close() }
}

for (const oscuro of [false, true]) {
  test(`7 · todos los botones se ven como botones en reposo (${oscuro ? 'oscuro' : 'claro'}), administrador e invitada`, async ({ browser }) => {
    for (const sesion of [SESION.adminA, SESION.medicoA]) {
      await enTema(browser, oscuro, sesion, async (p) => {
        await p.goto(RUTA)
        if (oscuro) await expect(p.locator('html')).toHaveClass(/dark/)
        expect(await revisarTodasLasPestanas(p)).toEqual([])
      })
    }
  })
}

/* ── Punto 8 · una línea por ajuste ─────────────────────────────────── */

test('8 · «Plazos y recordatorios» dice en una línea qué hace cada ajuste; el recordatorio es un correo al paciente', async ({ page }) => {
  await page.goto(RUTA)
  await pestanaConfig(page, 'Plazos y recordatorios')
  const lineas: Record<string, RegExp> = {
    'Recordatorio por correo': /correo que Spinus manda al paciente antes de su cita/,
    'Anticipación mínima para reservar por enlace': /mínimo que tiene que faltar para una cita/,
    'Hasta cuándo se puede reservar': /Hasta cuántos días adelante ve horarios un paciente/,
    'Vigencia del enlace de un solo uso': /Cuántos días sirve un enlace de un solo uso/,
  }
  for (const [campo, texto] of Object.entries(lineas)) {
    await expect(page.getByLabel(campo, { exact: true })).toHaveAccessibleDescription(texto)
  }
})

/* ── Punto 9 · el interruptor del recordatorio ──────────────────────── */

test('9 · el recordatorio viene APAGADO; el administrador lo enciende (queda en la base y en audit_log)', async ({ page }) => {
  const desde = sqlLocal('select now()')
  await page.goto(RUTA)
  await pestanaConfig(page, 'Plazos y recordatorios')
  const interruptor = page.getByRole('switch', { name: 'Recordatorio automático por correo' })
  await expect(interruptor).toHaveAttribute('aria-checked', 'false')
  await expect(interruptor).toHaveAccessibleDescription(/se enviará un correo a cada paciente con correo registrado, 24 horas antes de su cita/)
  await interruptor.click()
  await expect(toastConTexto(page, 'Recordatorio automático encendido')).toBeVisible()
  await expect(interruptor).toHaveAttribute('aria-checked', 'true')
  expect(sqlLocal(`select recordatorio_encendido from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('t')
  expect(sqlLocal(`select count(*) from public.audit_log where tabla = 'agenda_ajustes' and accion = 'UPDATE' and created_at >= :'d'::timestamptz
                     and user_id = (select id::text from auth.users where email = :'c')`, { d: desde, c: CORREO.adminA })).toBe('1')
  await page.reload()
  await pestanaConfig(page, 'Plazos y recordatorios')
  await expect(page.getByRole('switch', { name: 'Recordatorio automático por correo' })).toHaveAttribute('aria-checked', 'true')
})

test('9 · la invitada y la secretaria no lo pueden cambiar (deshabilitado y 403)', async ({ browser }) => {
  for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
    await enContextoNuevo(browser, sesion, async (p) => {
      await p.goto(RUTA)
      await pestanaConfig(p, 'Plazos y recordatorios')
      await expect(p.getByRole('switch', { name: 'Recordatorio automático por correo' })).toBeDisabled()
      expect((await p.request.patch('/api/me/ajustes-agenda', { data: { recordatorio_encendido: true } })).status()).toBe(403)
    })
  }
  expect(sqlLocal(`select recordatorio_encendido from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('f')
})

/* ── Punto 10 · restablecer la configuración ────────────────────────── */

test('10 · la invitada y la secretaria no ven «Restablecer» y la ruta les da 403', async ({ browser }) => {
  for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
    await enContextoNuevo(browser, sesion, async (p) => {
      await p.goto(RUTA)
      await expect(p.getByRole('tab').first()).toBeVisible()
      await expect(p.getByRole('tab', { name: 'Restablecer' })).toHaveCount(0)
      expect((await p.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).toBe(403)
    })
  }
})

test('10 · el administrador restablece con la palabra escrita: «Primeros pasos» en 0 de 3, citas intactas', async ({ page }) => {
  const foto = guardarConfig()
  const deshacer = adminSinPendientes()
  const citas = () => sqlLocal(`select md5(string_agg(a::text, '|' order by a.id)) from public.appointments a where a.clinica_id = ${CL}`)
  const antes = citas()
  try {
    await page.goto(RUTA)
    await pestanaConfig(page, 'Restablecer')
    await page.getByRole('button', { name: 'Restablecer configuración de la agenda' }).click()
    const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer la configuración de la agenda?' })
    await expect(dialogo).toContainText('Los enlaces que ya compartiste con pacientes dejarán de funcionar.')
    await expect(dialogo).toContainText('Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.')
    const boton = dialogo.getByRole('button', { name: 'Restablecer', exact: true })
    await expect(boton).toBeDisabled()
    await dialogo.getByLabel(/Para confirmar, escribe/).fill('restablecer')
    await expect(boton).toBeDisabled()
    await dialogo.getByLabel(/Para confirmar, escribe/).fill('RESTABLECER')
    await boton.click()
    await expect(toastConTexto(page, 'Configuración de la agenda restablecida')).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Primeros pasos.*3 pendientes/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Primeros pasos' })).toContainText('0 de 3 listos')
    await expect(page.getByRole('region', { name: 'Primeros pasos' }).getByRole('listitem').first()).toHaveAccessibleName('Horario de cada consultorio: pendiente')
    expect(sqlLocal(`select count(*) from public.tipos_cita where clinica_id = ${CL} and activo`)).toBe('0')
    expect(sqlLocal(`select count(*) from public.reserva_enlaces where clinica_id = ${CL} and revocado_en is null`)).toBe('0')
    expect(sqlLocal(`select bool_or(horario_propio)::text from public.consultorios where clinica_id = ${CL}`)).toBe('false')
    expect(sqlLocal(`select recordatorio_encendido || '|' || recordatorio_horas from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('false|24')
    expect(citas()).toBe(antes)
    expect(sqlLocal(`select count(*) from public.audit_log where accion = 'agenda_configuracion_restablecida'
                       and user_id = (select id::text from auth.users where email = :'c') and created_at > now() - interval '2 minutes'`,
    { c: CORREO.adminA })).toBe('1')
  } finally {
    deshacer()
    devolverConfig(foto)
  }
})
