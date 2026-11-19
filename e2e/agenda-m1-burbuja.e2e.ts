import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, sqlLocal } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda M, agente M1, puntos 1 y 4 de Angel. Semana +13 (nadie más la usa).
 *   · 1: en computadora (la capa, desde 1024 px) la burbuja vuelve a las medidas de la tarjeta de la
 *     tanda J sin perder el diseño de K5: ancho 360; nombre 16; hora 15; día, duración, médico,
 *     procedencia (y observaciones) 13; píldora 12; botón ancho y casillas de 13 px y 48 de alto,
 *     con el icono A LA IZQUIERDA; ✕ y ⋮ de 32; relleno 16; 12 entre bloques; el recuadro de la hora
 *     con 10. Medido en el navegador a 1920×1080 y 1366×768. El teléfono, como estaba (44 px).
 *   · 1: la burbuja nunca sale de la ventana: citas en las cuatro esquinas de la rejilla (lunes y
 *     domingo, primera y última media hora, pegadas arriba o abajo del desplazamiento), con
 *     «Confirmar» abierto, a 1920×1080, 1366×768, 1366×650 y 1024×600.
 *   · 4: los tres puntos abren el formulario completo («Editar cita»), sin menú; ahí está «No asistió»
 *     de la agendada (guardar manda PUT no_show). Las observaciones van en una línea recortada con
 *     «…», con el texto entero en `title`; sin ellas, no hay línea.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `.ag-capa.ag-burbuja { width: 400px }` → «las medidas de la tanda J»;
 *   · `.ag-burbuja-celda` sin `flex-direction: row` en computadora (el icono encima) → la misma;
 *   · `.ag-capa.ag-burbuja .ag-burbuja-info` con `padding: 14px 16px` → la misma;
 *   · el ⋮ de vuelta a desplegar (`alEditar` → nada) → «los tres puntos»;
 *   · `.ag-burbuja-obs` sin `white-space: nowrap` → «observaciones»;
 *   · `posicionCapa` sin acotar `top` a la ventana → «nunca sale de la ventana» (sale hasta 397 px
 *     por abajo en las citas de las 20:00).
 */
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const SEMANA = 13
const LUNES = diaDeLaSemana(SEMANA, 0)
const MARTES = diaDeLaSemana(SEMANA, 1)
const DOMINGO = diaDeLaSemana(SEMANA, 6)
const NOTA = 'Trae sus radiografías de rodilla y la receta anterior; pidió que se le llame antes por si se retrasa'
const creadas: string[] = []

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterAll(() => {
  try {
    /* Como `postgres` (la v2 veta el borrado de citas a todo otro rol). La auditoría NO se toca
       (reglas de la tanda M): sus filas se quedan. */
    if (creadas.length) {
      sqlLocal(`delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);`, { ids: creadas.join(',') })
    }
  } finally { interruptorAgenda('A', false) }
})

function cita(fecha: string, hora: string, apellidos: string, estado = 'scheduled', notas = NOTA): string {
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status, notes,
           consultorio_nombre, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz, :'ini'::timestamptz + interval '30 min',
           :'st', nullif(:'notas', ''), co.nombre, :'tz', 'spinus', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = :'ap'
     where co.nombre = 'Consultorio Centro (ficticio)' returning id`,
  { ini: fechaHoraLocalAInstante(fecha, hora, TZ), st: estado, ap: apellidos, tz: TZ, notas })
  creadas.push(id)
  return id
}

async function aLaSemana(page: Page): Promise<void> {
  await abrirAgendaV2(page)
  const asistencia = page.getByRole('dialog', { name: '¿Asistió el paciente?' })
  if (await asistencia.isVisible().catch(() => false)) await asistencia.getByRole('button', { name: 'Decidir después' }).click()
  for (let i = 0; i < SEMANA; i++) await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
}

/** Abre la burbuja de la cita; `borde` la pega arriba o abajo del desplazamiento de la rejilla. */
async function abrir(page: Page, texto: string, borde?: 'start' | 'end'): Promise<Locator> {
  const movil = test.info().project.name === 'telefono'
  const caja = (movil ? page.locator('.fc-list-event', { hasText: texto }) : page.locator('.fc-timegrid-event', { hasText: texto })).first()
  if (borde) await caja.evaluate((el, b) => el.scrollIntoView({ block: b }), borde)
  else await caja.scrollIntoViewIfNeeded()
  await caja.click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  // La burbuja entra con `scale(.97)` y la colocación sigue al alto: se mide quieta.
  await t.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.then(() => 1, () => 1))))
  await page.waitForTimeout(100)
  return t
}

/** Todo lo pedido, tomado del navegador en una pasada (px). */
async function medidas(t: Locator) {
  return t.evaluate(d => {
    const r = (s: string, raiz: Element = d): DOMRect => {
      const el = raiz.querySelector(s)
      if (!el) throw new Error(`falta ${s}`)
      return el.getBoundingClientRect()
    }
    const fs = (s: string): string => getComputedStyle(d.querySelector(s) as Element).fontSize
    const caja = d.getBoundingClientRect()
    const borde = parseFloat(getComputedStyle(d).borderLeftWidth)
    const dentro = { left: caja.left + borde, right: caja.right - borde, top: caja.top + borde, bottom: caja.bottom - borde }
    const celdas = [...d.querySelectorAll('.ag-burbuja-celda')].map(b => {
      const svg = (b.querySelector('svg') as Element).getBoundingClientRect()
      const rango = document.createRange()
      const texto = [...b.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).pop() as Node
      rango.selectNodeContents(texto)
      const txt = rango.getBoundingClientRect()
      const bb = b.getBoundingClientRect()
      return {
        alto: bb.height, letra: getComputedStyle(b).fontSize,
        iconoALaIzquierda: svg.right <= txt.left + 0.5 && Math.abs((svg.top + svg.bottom) / 2 - (txt.top + txt.bottom) / 2) < 3,
      }
    })
    const cta = r('.ag-burbuja-cta')
    const iconos = [...d.querySelectorAll('.ag-burbuja-icono')].map(b => { const x = b.getBoundingClientRect(); return [x.width, x.height] })
    return {
      ancho: caja.width,
      letra: {
        nombre: fs('.ag-burbuja-titulo'), hora: fs('.ag-burbuja-hora'), dia: fs('.ag-burbuja-dia'), duracion: fs('.ag-burbuja-duracion'),
        medico: fs('.ag-burbuja-medico'), procedencia: d.querySelector('.ag-burbuja-origen') ? fs('.ag-burbuja-origen') : '13px',
        obs: fs('.ag-burbuja-obs'), estado: fs('.ag-burbuja-estado'), cta: fs('.ag-burbuja-cta'), pie: fs('.ag-burbuja-pie-boton'),
      },
      ctaAlto: cta.height, celdas, iconos, pieAlto: r('.ag-burbuja-pie-boton').height,
      relleno: {
        arriba: r('.ag-burbuja-fila').top - r('.ag-burbuja-franja').bottom,
        izquierda: r('.ag-burbuja-estado').left - dentro.left,
        derecha: dentro.right - r('.ag-burbuja-botones').right,
        ctaIzq: cta.left - dentro.left, ctaDer: dentro.right - cta.right,
        pieAbajo: dentro.bottom - r('.ag-burbuja-pie').bottom,
      },
      entre: {
        cabInfo: r('.ag-burbuja-info').top - r('.ag-burbuja-cab').bottom,
        infoObs: r('.ag-burbuja-obs').top - r('.ag-burbuja-info').bottom,
        obsCta: r('.ag-burbuja-principal').top - r('.ag-burbuja-obs').bottom,
        ctaRejilla: r('.ag-burbuja-rejilla').top - r('.ag-burbuja-principal').bottom,
        rejillaPie: r('.ag-burbuja-pie').top - r('.ag-burbuja-rejilla').bottom,
      },
      info: {
        izq: r('.ag-burbuja-cuando').left - r('.ag-burbuja-info').left,
        arriba: r('.ag-burbuja-cuando').top - r('.ag-burbuja-info').top,
        abajo: r('.ag-burbuja-info').bottom - r('.ag-burbuja-medico').bottom,
      },
    }
  })
}

/* `expect.soft`: una corrida dice TODAS las medidas que no cuadran, no sólo la primera. */
const cerca = (v: number, esperado: number, nombre: string): void => { expect.soft(Math.abs(v - esperado), `${nombre}: ${v}`).toBeLessThan(0.6) }

for (const [ancho, alto] of [[1920, 1080], [1366, 768]] as const) {
  test(`computadora ${ancho}×${alto}: la burbuja con las medidas de la tanda J y el diseño de K5`, async ({ page }) => {
    test.skip(test.info().project.name !== 'escritorio', 'computadora')
    await page.setViewportSize({ width: ancho, height: alto })
    cita(MARTES, '10:00', 'Prueba 14')
    await aLaSemana(page)
    const m = await medidas(await abrir(page, 'Prueba 14'))
    cerca(m.ancho, 360, 'ancho')
    expect.soft(m.letra).toEqual({ nombre: '16px', hora: '15px', dia: '13px', duracion: '13px', medico: '13px', procedencia: '13px', obs: '13px',
      estado: '12px', cta: '13px', pie: '13px' })
    cerca(m.ctaAlto, 48, 'alto del botón ancho')
    cerca(m.pieAlto, 48, 'alto del pie')
    expect.soft(m.celdas.map(c => [Math.round(c.alto), c.letra, c.iconoALaIzquierda])).toEqual([[48, '13px', true], [48, '13px', true], [48, '13px', true]])
    expect.soft(m.iconos).toEqual([[32, 32], [32, 32]])
    for (const [k, v] of Object.entries(m.relleno)) cerca(v, k === 'pieAbajo' ? 0 : 16, `relleno ${k}`)
    for (const [k, v] of Object.entries(m.entre)) cerca(v, 12, `entre ${k}`)
    for (const [k, v] of Object.entries(m.info)) cerca(v, 10, `recuadro ${k}`)
  })
}

test('teléfono: la hoja como estaba (escala de L2) y toques de 44 px o más', async ({ page }) => {
  test.skip(test.info().project.name !== 'telefono', 'teléfono')
  cita(MARTES, '12:00', 'Prueba 15')
  await aLaSemana(page)
  const t = await abrir(page, 'Prueba 15')
  await expect(t).toHaveClass(/ag-hoja/)
  const px = (sel: string): Promise<string> => t.locator(sel).first().evaluate(el => getComputedStyle(el).fontSize)
  expect([await px('.ag-burbuja-titulo'), await px('.ag-burbuja-hora'), await px('.ag-burbuja-dia'), await px('.ag-burbuja-medico'),
    await px('.ag-burbuja-estado'), await px('.ag-burbuja-cta'), await px('.ag-burbuja-celda')]).toEqual(['18px', '15px', '14px', '14px', '13px', '16px', '14px'])
  const altos = await t.locator('button').evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null)
    .map(e => Math.round(Math.min(e.getBoundingClientRect().height, e.getBoundingClientRect().width))))
  expect(Math.min(...altos)).toBeGreaterThanOrEqual(44)
  // El icono sigue ENCIMA del texto en las casillas del teléfono.
  expect(await t.locator('.ag-burbuja-celda').first().evaluate(el => getComputedStyle(el).flexDirection)).toBe('column')
})

/** ¿Cabe en la parte visible de la ventana? Devuelve lo que sobra por cada lado (≥ 0 = dentro). */
async function holgura(t: Locator): Promise<Record<string, number>> {
  return t.evaluate(d => {
    const r = d.getBoundingClientRect()
    const v = window.visualViewport
    const [w, h] = v ? [v.width, v.height] : [innerWidth, innerHeight]
    return { izquierda: r.left, arriba: r.top, derecha: w - r.right, abajo: h - r.bottom }
  })
}

test('nunca sale de la ventana: las cuatro esquinas de la rejilla, con «Confirmar» abierto, en cuatro ventanas', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'computadora')
  test.setTimeout(180_000)
  const esquinas = [
    { fecha: LUNES, hora: '07:00', ap: 'Prueba 16', borde: 'start' as const },
    { fecha: LUNES, hora: '20:00', ap: 'Prueba 17', borde: 'end' as const },
    { fecha: DOMINGO, hora: '07:00', ap: 'Prueba 18', borde: 'start' as const },
    { fecha: DOMINGO, hora: '20:00', ap: 'Prueba 19', borde: 'end' as const },
  ]
  for (const e of esquinas) cita(e.fecha, e.hora, e.ap)
  await aLaSemana(page)
  const fuera: string[] = []
  for (const [w, h] of [[1920, 1080], [1366, 768], [1366, 650], [1024, 600]] as const) {
    await page.setViewportSize({ width: w, height: h })
    for (const e of esquinas) {
      const t = await abrir(page, e.ap, e.borde)
      for (const [fase, accion] of [['cerrada', null], ['con «Confirmar» abierto', 'Confirmar']] as const) {
        /* Si ya salió cerrada, su botón puede quedar fuera de alcance: se anota y no se intenta abrir. */
        if (accion && fuera.some(f => f.startsWith(`${w}×${h} ${e.ap} cerrada`))) continue
        if (accion) {
          await t.getByRole('button', { name: accion, exact: true }).click()
          await expect(t.getByRole('group', { name: 'Confirmar la cita' })).toBeVisible()
          await page.waitForTimeout(150)
        }
        const hol = await holgura(t)
        for (const [lado, v] of Object.entries(hol)) if (v < -0.5) fuera.push(`${w}×${h} ${e.ap} ${fase}: sale ${-v}px por ${lado}`)
      }
      await page.keyboard.press('Escape')
      /* Aquí se mide la colocación, no el botón: si la burbuja quedó fuera, «Cerrar» puede no ser
         alcanzable con un clic real; el evento basta para pasar a la siguiente esquina. */
      await t.getByRole('button', { name: 'Cerrar', exact: true }).dispatchEvent('click')
      await expect(t).toHaveCount(0)
    }
  }
  expect(fuera).toEqual([])
})

test('los tres puntos abren el formulario completo, sin menú (con «No asistió» de la agendada); las observaciones en una línea con su texto entero', async ({ page }) => {
  const larga = cita(MARTES, '14:00', 'Prueba 20')
  cita(MARTES, '16:00', 'Prueba 21', 'scheduled', '')
  await aLaSemana(page)
  let t = await abrir(page, 'Prueba 20')
  const obs = t.locator('[data-burbuja-obs]')
  await expect(obs).toHaveAttribute('title', NOTA)
  await expect(obs).toHaveText(`Observaciones: ${NOTA}`)
  const linea = await obs.evaluate(el => ({ alto: el.getBoundingClientRect().height, recortada: el.scrollWidth > el.clientWidth,
    letra: parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.6 }))
  expect(linea.recortada).toBe(true)
  expect(linea.alto).toBeLessThan(linea.letra * 1.5)
  expect(await obs.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis')
  // ⋮: un botón que abre «Editar cita» de esa cita, sin desplegar nada.
  const puntos = t.getByRole('button', { name: 'Más opciones de la cita', exact: true })
  await expect(puntos).not.toHaveAttribute('aria-expanded', /.*/)
  await puntos.click()
  await expect(t).toHaveCount(0)
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  await expect(modal.locator('textarea')).toHaveValue(NOTA)
  // «No asistió» de la agendada vive ahora en el formulario (el estado): guardar manda PUT no_show.
  await modal.getByRole('button', { name: 'No asistió', exact: true }).click()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${larga}`) && r.request().method() === 'PUT')
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click()
  expect((await put).request().postDataJSON()).toMatchObject({ status: 'no_show' })
  await expect.poll(() => sqlLocal(`select status from public.appointments where id = :'id'`, { id: larga })).toBe('no_show')
  // Sin observaciones, no hay línea.
  t = await abrir(page, 'Prueba 21')
  await expect(t.locator('[data-burbuja-obs]')).toHaveCount(0)
  await expect(t.getByRole('group', { name: 'Más opciones de la cita' })).toHaveCount(0)
})
