import { test, expect, type Browser, type Page } from '@playwright/test'
import { CORREO, SESION, enContextoNuevo, interruptorAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal } from './ayudas'

/**
 * Tanda H, agente H2 — la configuración de la agenda (puntos 5 a 10 de Angel):
 *   · 5  pestañas accesibles; abre en «Primeros pasos» mientras falte algo y,
 *        si no, en la primera; en el teléfono la fila se desplaza de lado;
 *   · 6  los enlaces de los médicos invitados, plegados; el del administrador
 *        primero;
 *   · 7  todo botón de la configuración con borde y fondo visibles EN REPOSO,
 *        en claro y en oscuro (estilos computados; borde ≥ 3:1);
 *   · 8  «Plazos y recordatorios» (hoy «Avisos»): una línea por ajuste;
 *   · 9  el interruptor del recordatorio (apagado de fábrica; sólo el
 *        administrador). La tarea programada con él apagado/encendido está en
 *        `recordatorios.e2e.ts`;
 *   · 10 «Restablecer configuración de la agenda»: sólo el administrador, con
 *        la palabra escrita; deja «Primeros pasos» en 1 de 3 (duración y enlace
 *        pendientes; el horario de cada consultorio vuelve al de partida de la
 *        v2: el de la clínica copiado como suyo, integración de la tanda H) y
 *        no toca citas.
 * Cada prueba devuelve la clínica A como estaba (la semilla la recrea igual
 * al empezar cada corrida).
 *
 * Tanda J (J5, puntos 13 y 14): la pantalla es la de las maquetas. Lo que
 * falta ya no es una pestaña «Primeros pasos» sino el FUNNEL de primera vez
 * (las pruebas de pestañas dejan antes al médico sin pendientes); las cinco
 * pestañas son «Tu enlace», «Cuándo das consulta», «Tu consulta», «Avisos» y
 * «Más opciones»; los ajustes se guardan solos («Guardado»); «Restablecer» es
 * «Empezar de nuevo», en «Más opciones», y deja al médico en el funnel. El
 * punto 7 (botones con borde) cede ante la sección F: la maqueta dibuja
 * algunos botones como texto —«Cambiar», «Otra duración», «Editar», «Quitar»,
 * «Agregar tipo de cita»—, que se miden aparte (`botonesDeTexto`).
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

const adminSinPendientes = () => sinPendientesAgenda(CORREO.adminA)

/* ── Punto 5 · pestañas ─────────────────────────────────────────────── */

test('5 · con algo pendiente abre el funnel de primera vez, sin pestañas', async ({ page }) => {
  await page.goto(RUTA)
  // K3 (punto 12): quien administra empieza en el horario de la clínica, «Paso 1 de 4».
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()
  await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Secciones de la configuración' })).toHaveCount(0)
})

test('5 · sin nada pendiente: pestañas con su rol, abre en la primera, flechas e Inicio/Fin', async ({ page }) => {
  const deshacer = adminSinPendientes()
  try {
    await page.goto(RUTA)
    const lista = page.getByRole('tablist', { name: 'Secciones de la configuración' })
    const primera = lista.getByRole('tab', { name: 'Tu enlace' })
    await expect(primera).toHaveAttribute('aria-selected', 'true')
    await expect(lista.getByRole('tab', { name: /Primeros pasos/ })).toHaveCount(0)
    await expect(page.getByRole('tabpanel', { name: 'Tu enlace' })).toBeVisible()
    // Una sola pestaña en el orden de tabulación; las demás, -1.
    await expect(lista.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
    // Sólo se ve un panel: «Avisos por correo» está, pero escondido.
    await expect(page.getByRole('heading', { name: 'Avisos por correo' })).toBeHidden()
    await primera.focus()
    await page.keyboard.press('ArrowRight')
    const horario = lista.getByRole('tab', { name: 'Cuándo das consulta' })
    await expect(horario).toHaveAttribute('aria-selected', 'true')
    await expect(horario).toBeFocused()
    await expect(page.getByRole('tabpanel', { name: 'Cuándo das consulta' })).toBeVisible()
    await page.keyboard.press('End')
    await expect(lista.getByRole('tab', { name: 'Más opciones' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(primera).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(lista.getByRole('tab', { name: 'Más opciones' })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(primera).toBeFocused()
  } finally {
    deshacer()
  }
})

/* K3 (punto 13): en el teléfono las pestañas son iconos y CABEN: ya no se desplazan de lado (detalle en agenda-k3-configuracion). */
test('5 · en el teléfono la fila de pestañas cabe en una sola fila, sin desplazarse ni envolver', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: SESION.adminA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Merida' })
  const deshacer = adminSinPendientes()
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
    expect(m).toEqual({ desborda: false, overflow: 'auto', filas: 1, pagina: true })
    // Elegir la última la trae a la vista.
    await lista.getByRole('tab', { name: 'Más opciones' }).click()
    await expect(lista.getByRole('tab', { name: 'Más opciones' })).toBeInViewport()
  } finally {
    deshacer()
    await ctx.close()
  }
})

/* ── Punto 6 · enlaces de los invitados, plegados ───────────────────── */

test('6 · el administrador ve primero el suyo; los de los invitados, plegados hasta pulsar (también la secretaria)', async ({ page, browser }) => {
  const deshacer = adminSinPendientes()
  try {
    await page.goto(RUTA)
    const seccion = page.getByRole('tabpanel', { name: 'Tu enlace' })
    // El suyo, arriba y sin ficha: el interruptor y su dirección (J5, maqueta).
    await expect(seccion.getByRole('heading', { name: 'Tu enlace', level: 2 })).toBeVisible()
    await expect(seccion.getByRole('switch', { name: /^Prendido/ })).toBeVisible()
    const titulos = seccion.getByRole('heading', { level: 4 })
    await expect(titulos).toHaveCount(0)
    const plegado = seccion.getByRole('button', { name: 'Enlaces de los demás médicos (1)' })
    await expect(plegado).toHaveAttribute('aria-expanded', 'false')
    await plegado.click()
    await expect(plegado).toHaveAttribute('aria-expanded', 'true')
    await expect(titulos).toHaveText([/Invitada Semilla Dos/])
  } finally {
    deshacer()
  }
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await p.goto(RUTA)
    const s = p.getByRole('tabpanel', { name: 'Enlaces' })
    await expect(s.getByRole('heading', { level: 4 })).toHaveText(['Dr. Admin Semilla Uno'])
    await expect(s.getByRole('button', { name: 'Enlaces de los demás médicos (1)' })).toHaveAttribute('aria-expanded', 'false')
  })
})

/* ── Punto 7 · botones en reposo ────────────────────────────────────── */

/* J5 (sección F): la maqueta dibuja como TEXTO azul o rojo algunos botones. Ésos se aceptan sin borde
   sólo si su nombre está en esta lista y su letra se lee (≥ 4,5:1); cualquier otro botón sin borde
   sigue siendo un fallo. Las pestañas son subrayadas (maqueta) y los interruptores, una pista rellena o con borde
   (≥ 3:1 contra el fondo, WCAG 1.4.11). */
const BOTONES_DE_TEXTO = /^(Cambiar|Otra duración|Editar .+|Quitar .+|Reactivar .+|Agregar tipo de cita|Apagar el enlace de .+|Desbloquear a .+|Enlaces de los demás médicos \(\d+\)|Personas bloqueadas.*|Empezar de nuevo.*|Cancelar|Guardar)$/

/** Cada botón VISIBLE de la pantalla: borde ≥ 1 px con ≥ 3:1 contra el fondo que lo rodea, y fondo propio
    (o, si es de texto, su nombre y su contraste; ver arriba). */
async function botonesEnReposo(page: Page): Promise<string[]> {
  const { malos, deTexto } = await page.evaluate(() => {
    // `color-mix()` se serializa como `color(srgb r g b)` con canales de 0 a 1, no `rgb()` de 0 a 255.
    const rgb = (c: string) => { const v = (c.match(/[\d.]+/g) ?? []).map(Number); return c.startsWith('color(srgb') ? v.map((x, i) => (i < 3 ? x * 255 : x)) : v }
    const lum = ([r = 0, g = 0, b = 0]: number[]) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const contraste = (a: string, b: string) => { const [l1 = 0, l2 = 0] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05) }
    const opaco = (c: string) => { const v = rgb(c); return c !== 'transparent' && (v.length < 4 || (v[3] ?? 1) > 0) }
    const fondo = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (opaco(c)) return c }
      return 'rgb(255, 255, 255)'
    }
    const malos: string[] = []
    const deTexto: string[] = []
    const main = document.querySelector('main') ?? document.body
    for (const b of Array.from(main.querySelectorAll<HTMLElement>('button, a[class*="h-9"], a[class*="h-8"]'))) {
      if (b.offsetParent === null || b.closest('[role="dialog"], [role="alertdialog"]') || b.getAttribute('role') === 'tab') continue
      const cs = getComputedStyle(b)
      const alrededor = fondo(b.parentElement)
      const nombre = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 40)
      if (b.getAttribute('role') === 'switch') {
        // La pista se distingue por su relleno o por su borde (como el resto de botones).
        const borde = parseFloat(cs.borderTopWidth) >= 1 ? contraste(cs.borderTopColor, alrededor) : 0
        if (contraste(cs.backgroundColor, alrededor) < 3 && borde < 3) malos.push(`${nombre}: pista ${contraste(cs.backgroundColor, alrededor).toFixed(2)}:1`)
        continue
      }
      if (parseFloat(cs.borderTopWidth) < 1 && !opaco(cs.backgroundColor)) {
        deTexto.push(nombre)
        if (contraste(cs.color, alrededor) < 4.5) malos.push(`${nombre}: letra ${contraste(cs.color, alrededor).toFixed(2)}:1`)
        continue
      }
      if (parseFloat(cs.borderTopWidth) < 1) { if (!opaco(cs.backgroundColor) || contraste(cs.backgroundColor, alrededor) < 3) malos.push(`${nombre}: sin borde`) }
      else if (contraste(cs.borderTopColor, alrededor) < 3 && contraste(cs.backgroundColor, alrededor) < 3) {
        malos.push(`${nombre}: borde ${contraste(cs.borderTopColor, alrededor).toFixed(2)}:1`)
      }
      if (!opaco(cs.backgroundColor)) malos.push(`${nombre}: sin fondo`)
    }
    return { malos, deTexto }
  })
  return [...malos, ...deTexto.filter(n => !BOTONES_DE_TEXTO.test(n)).map(n => `${n}: sin borde (no es de los de texto de la maqueta)`)]
}

async function revisarTodasLasPestanas(p: Page): Promise<string[]> {
  const malos: string[] = []
  const pestanas = p.getByRole('tablist', { name: 'Secciones de la configuración' }).getByRole('tab')
  // `count()` no espera: sin esto, con la página aún en «Cargando…», el bucle no daría ni una vuelta.
  await expect(pestanas).toHaveCount(5)
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
    for (const [sesion, correo] of [[SESION.adminA, CORREO.adminA], [SESION.medicoA, CORREO.medicoA]] as const) {
      const deshacer = sinPendientesAgenda(correo)
      try {
        await enTema(browser, oscuro, sesion, async (p) => {
          await p.goto(RUTA)
          if (oscuro) await expect(p.locator('html')).toHaveClass(/dark/)
          expect(await revisarTodasLasPestanas(p)).toEqual([])
        })
      } finally {
        deshacer()
      }
    }
  })
}

/* ── Punto 8 · una línea por ajuste ─────────────────────────────────── */

/* J5: en la maqueta cada plazo ES su frase («Pueden ver horarios de los próximos [60] días»), y el
   recordatorio dice que es un correo al paciente. */
test('8 · «Avisos» dice en una línea qué hace cada ajuste; el recordatorio es un correo al paciente', async ({ page }) => {
  const deshacer = adminSinPendientes()
  try {
    await page.goto(RUTA)
    await pestanaConfig(page, 'Avisos')
    const panel = page.getByRole('tabpanel', { name: 'Avisos' })
    for (const frase of ['Pueden ver horarios de los próximos', 'No pueden apartar si faltan menos de', 'Un enlace de una vez deja de servir a los']) {
      await expect(panel.getByLabel(frase)).toHaveCount(1)
    }
    await expect(panel).toContainText('Le llega un correo antes de su cita. Solo a pacientes que tengan correo.')
  } finally {
    deshacer()
  }
})

/* ── Punto 9 · el interruptor del recordatorio ──────────────────────── */

test('9 · el recordatorio viene APAGADO; el administrador lo enciende (queda en la base y en audit_log)', async ({ page }) => {
  const deshacer = adminSinPendientes()
  try {
    const desde = sqlLocal('select now()')
    await page.goto(RUTA)
    await pestanaConfig(page, 'Avisos')
    const interruptor = page.getByRole('switch', { name: 'Recordarle su cita al paciente' })
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await interruptor.click()
    await expect(page.locator('[data-aviso-config]')).toHaveText('Guardado')
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    // Encendido, dice cuándo sale: 24 horas antes (el de fábrica).
    await expect(page.getByRole('combobox')).toHaveValue('24')
    expect(sqlLocal(`select recordatorio_encendido from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('t')
    expect(sqlLocal(`select count(*) from public.audit_log where tabla = 'agenda_ajustes' and accion = 'UPDATE' and created_at >= :'d'::timestamptz
                       and user_id = (select id::text from auth.users where email = :'c')`, { d: desde, c: CORREO.adminA })).toBe('1')
    await page.reload()
    await pestanaConfig(page, 'Avisos')
    await expect(page.getByRole('switch', { name: 'Recordarle su cita al paciente' })).toHaveAttribute('aria-checked', 'true')
  } finally {
    deshacer()
  }
})

test('9 · la invitada y la secretaria no lo pueden cambiar (deshabilitado y 403)', async ({ browser }) => {
  const deshacer = sinPendientesAgenda(CORREO.medicoA)
  try {
    for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
      await enContextoNuevo(browser, sesion, async (p) => {
        await p.goto(RUTA)
        await pestanaConfig(p, 'Avisos')
        await expect(p.getByRole('switch', { name: 'Recordarle su cita al paciente' })).toBeDisabled()
        await expect(p.getByText('Estos avisos los cambia quien administra la clínica.')).toBeVisible()
        // El aviso a la clínica no le llega a ella: no se lo dice como si sí (J5).
        await expect(p.getByRole('switch', { name: 'Avisar a la clínica cuando alguien aparte cita' })).toBeDisabled()
        await expect(p.getByText('Te llega un correo cada vez que un paciente aparta')).toHaveCount(0)
        expect((await p.request.patch('/api/me/ajustes-agenda', { data: { recordatorio_encendido: true } })).status()).toBe(403)
      })
    }
  } finally {
    deshacer()
  }
  expect(sqlLocal(`select recordatorio_encendido from public.agenda_ajustes where clinica_id = ${CL}`)).toBe('f')
})

/* ── Punto 10 · restablecer la configuración («Empezar de nuevo», J5) ─ */

test('10 · la invitada y la secretaria no ven «Empezar de nuevo» y la ruta les da 403', async ({ browser }) => {
  const deshacer = sinPendientesAgenda(CORREO.medicoA)
  try {
    for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
      await enContextoNuevo(browser, sesion, async (p) => {
        await p.goto(RUTA)
        await pestanaConfig(p, 'Más opciones')
        await expect(p.getByRole('tabpanel', { name: 'Más opciones' })).toContainText('Personas bloqueadas')
        await expect(p.getByRole('button', { name: /Empezar de nuevo/ })).toHaveCount(0)
        expect((await p.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).toBe(403)
      })
    }
  } finally {
    deshacer()
  }
})

/* Tanda I (punto 3): tras restablecer, el horario de partida queda «por revisar» (0 de 3), no hecho.
   MUTACIÓN: quitar `horario_revisado_en = NULL` de agenda_restablecer_configuracion() → rojo («hecho»). */
test('10 · el administrador «Empieza de nuevo» con la palabra escrita: vuelve al funnel (horario por revisar), el horario de partida, citas intactas', async ({ page }) => {
  const foto = guardarConfig()
  const deshacer = adminSinPendientes()
  const citas = () => sqlLocal(`select md5(string_agg(a::text, '|' order by a.id)) from public.appointments a where a.clinica_id = ${CL}`)
  const antes = citas()
  try {
    await page.goto(RUTA)
    await pestanaConfig(page, 'Más opciones')
    await page.getByRole('button', { name: /Empezar de nuevo/ }).click()
    const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer la configuración de la agenda?' })
    await expect(dialogo).toContainText('Los enlaces que ya compartiste con pacientes dejarán de funcionar.')
    await expect(dialogo).toContainText('Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.')
    const boton = dialogo.getByRole('button', { name: 'Restablecer', exact: true })
    await expect(boton).toBeDisabled()
    await dialogo.getByLabel(/Para confirmar, escribe/).fill('restablecer')
    await expect(boton).toBeDisabled()
    await dialogo.getByLabel(/Para confirmar, escribe/).fill('RESTABLECER')
    await boton.click()
    // Lo que antes era «Primeros pasos» en 0 de 3: el funnel desde su primer paso.
    await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible() // K3: primero el de la clínica
    await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
    expect(sqlLocal(`select count(*) from public.consultorios where clinica_id = ${CL} and horario_revisado_en is not null`)).toBe('0')
    expect(sqlLocal(`select count(*) from public.tipos_cita where clinica_id = ${CL} and activo`)).toBe('0')
    expect(sqlLocal(`select count(*) from public.reserva_enlaces where clinica_id = ${CL} and revocado_en is null`)).toBe('0')
    /* El horario de partida de la v2: el de la clínica, COPIADO a cada consultorio y como propio (la herencia de G4). */
    expect(sqlLocal(`select bool_and(k.horario_propio and k.horario = c.horario_consulta)::text
                       from public.consultorios k join public.clinicas c on c.id = k.clinica_id where k.clinica_id = ${CL}`)).toBe('true')
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
