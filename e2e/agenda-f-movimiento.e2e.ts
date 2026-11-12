import { test, expect, request, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { irAAgenda, modalCita, soloEscritorio, SESION, DIA_LABORABLE_LIBRE, tituloUnico, toastConTexto } from './ayudas'
import { animacionesFueraDeRegla } from './movimientoAyudas'

/**
 * Bloque F, movimiento (F2.3-F2.8, diseño `plan_F.md` §2 y «Pruebas por paso»):
 *   · ningún `.ag-ev-nuevo` al abrir ni al navegar (no hay registro, no hay clase);
 *   · sí en el alta, y la tarjeta real que sustituye a la optimista no lo hereda;
 *   · `.ag-ev-remoto` en un INSERT ajeno que llega por tiempo real;
 *   · `.ag-ev-saliendo` en una baja, y después la tarjeta desaparece;
 *   · el fundido de navegación es sólo opacidad y sin traslación;
 *   · con movimiento reducido todo aparece y desaparece igual, sin WAAPI;
 *   · la regla de `getAnimations` (sólo `opacity`/`transform`, ≤ 240 ms) en cada
 *     momento animado.
 *
 * ⚠️ LAS CLASES VIVEN POCO (la salida, 120 ms; la entrada, ~600 ms), así que no
 * se esperan con `toHaveClass`: un observador instalado ANTES de cargar la
 * página (`REGISTRO`) anota cada `.fc-event` que llega a llevarlas, con su
 * texto, y cada `element.animate()` (WAAPI: fundido y FLIP). Es un `string` y
 * no una función porque el transpilador puede inyectar un `__name` que no
 * existe en la página (ver `e2e/movimientoAyudas.ts`).
 *
 * Sólo escritorio: usa el `<select>` de médico/consultorio del modal para los
 * ids del alta ajena, como `agenda-tiempo-real.e2e.ts`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const REGISTRO = `(() => {
  const vistos = new Map();
  const waapi = [];
  const MARCAS = ['ag-ev-nuevo', 'ag-ev-remoto', 'ag-ev-saliendo'];
  const anotar = (ev) => {
    for (const m of MARCAS) {
      if (!ev.classList.contains(m)) continue;
      const v = vistos.get(ev) || { marcas: new Set(), texto: '' };
      v.marcas.add(m);
      vistos.set(ev, v);
    }
  };
  const mirar = (nodo) => {
    if (!(nodo instanceof Element)) return;
    const raiz = nodo.closest('.fc-event');
    if (raiz) anotar(raiz);
    nodo.querySelectorAll('.fc-event').forEach(anotar);
  };
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'attributes') mirar(c.target);
      else c.addedNodes.forEach(mirar);
    }
    for (const [ev, v] of vistos) {
      const t = (ev.textContent || '').trim();
      if (t) v.texto = t;
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  const animar = Element.prototype.animate;
  Element.prototype.animate = function (fotogramas, opciones) {
    const props = [];
    for (const f of (Array.isArray(fotogramas) ? fotogramas : [fotogramas || {}])) {
      for (const k of Object.keys(f)) if (!['offset', 'easing', 'composite'].includes(k) && !props.includes(k)) props.push(k);
    }
    waapi.push({
      clases: typeof this.className === 'string' ? this.className : '',
      propiedades: props,
      duracion: typeof opciones === 'number' ? opciones : (opciones && opciones.duration) || 0,
    });
    return animar.call(this, fotogramas, opciones);
  };
  window.__agMovLeer = () => {
    const por = (m) => [...vistos.values()].filter(v => v.marcas.has(m)).map(v => v.texto);
    return { nuevo: por('ag-ev-nuevo'), remoto: por('ag-ev-remoto'), saliendo: por('ag-ev-saliendo'), waapi: waapi.slice() };
  };
  window.__agMovVaciar = () => { vistos.clear(); waapi.length = 0; };
})();`

interface Waapi { clases: string; propiedades: string[]; duracion: number }
interface Lectura { nuevo: string[]; remoto: string[]; saliendo: string[]; waapi: Waapi[] }

function esLectura(x: unknown): x is Lectura {
  if (typeof x !== 'object' || x === null) return false
  const listas = ['nuevo', 'remoto', 'saliendo', 'waapi'] as const
  return listas.every(k => k in x && Array.isArray(Reflect.get(x, k)))
}

async function leer(page: Page): Promise<Lectura> {
  const r: unknown = await page.evaluate('window.__agMovLeer()')
  if (!esLectura(r)) throw new Error('el registro de movimiento no está instalado')
  return r
}

async function vaciar(page: Page): Promise<void> {
  await page.evaluate('window.__agMovVaciar()')
}

async function abrir(page: Page): Promise<void> {
  await page.addInitScript({ content: REGISTRO })
  await irAAgenda(page)
}

/**
 * Espera a que termine la traída en curso. `aria-busy` sólo se enciende pasados
 * 150 ms (`UMBRAL_CARGA_MS`), así que primero se le da un momento para
 * encenderse —si la semana viene de la caché no se enciende nunca, y vale— y
 * después se espera a que se apague.
 */
async function esperarCarga(page: Page): Promise<void> {
  const tarjeta = page.locator('.agenda-fc')
  await expect(tarjeta).toHaveAttribute('aria-busy', 'true', { timeout: 400 }).catch(() => undefined)
  await expect(tarjeta).not.toHaveAttribute('aria-busy', 'true', { timeout: 15000 })
}

/** Un evento sin paciente por la UI. Devuelve su id y lo que incumplía la
 *  regla JUSTO al pulsar Guardar (salida del modal, entrada de la tarjeta). */
async function altaEvento(page: Page, titulo: string, hora: string): Promise<{ id: string; fueraDeRegla: string[] }> {
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_LIBRE)
  await page.locator('input[type="time"]').first().fill(hora)
  const resp = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const fueraDeRegla = await animacionesFueraDeRegla(page)
  const res = await resp
  expect(res.ok()).toBeTruthy()
  const json: unknown = await res.json()
  const id = typeof json === 'object' && json !== null ? Reflect.get(Reflect.get(json, 'appointment') ?? {}, 'id') : null
  if (typeof id !== 'string') throw new Error('el alta no devolvió id')
  return { id, fueraDeRegla }
}

test('abrir y navegar no ponen .ag-ev-nuevo; el fundido de fecha es sólo opacidad', async ({ page }) => {
  await abrir(page)
  await esperarCarga(page)
  expect((await leer(page)).nuevo).toEqual([])

  await vaciar(page)
  await page.locator('.fc-next-button').click()
  expect(await animacionesFueraDeRegla(page)).toEqual([])
  await esperarCarga(page)
  await page.locator('.fc-prev-button').click()
  await esperarCarga(page)

  const tras = await leer(page)
  expect(tras.nuevo).toEqual([])
  expect(tras.remoto).toEqual([])
  /* El fundido del armazón: WAAPI, sólo opacidad, en micro. Al menos el de
     la vuelta (la semana ya vista viene de la caché, sin atenuación encima). */
  const fundidos = tras.waapi.filter(w => w.clases.includes('fc-view-harness'))
  expect(fundidos.length).toBeGreaterThan(0)
  for (const f of fundidos) {
    expect(f.propiedades).toEqual(['opacity'])
    expect(f.duracion).toBeLessThanOrEqual(240)
  }
})

test('cambiar de vista anima la vista entera dentro de la regla, sin tarjetas nuevas', async ({ page }) => {
  await abrir(page)
  await esperarCarga(page)
  await vaciar(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  expect(await animacionesFueraDeRegla(page)).toEqual([])
  await esperarCarga(page)
  expect((await leer(page)).nuevo).toEqual([])
})

test('el alta entra con .ag-ev-nuevo y la tarjeta real no lo hereda', async ({ page }) => {
  await abrir(page)
  await esperarCarga(page)
  await vaciar(page)
  const titulo = tituloUnico('Evento F entrada')
  const { fueraDeRegla } = await altaEvento(page, titulo, '11:10')
  expect(fueraDeRegla).toEqual([])
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  const tarjeta = page.locator('.fc-event', { hasText: titulo })
  await expect(tarjeta).toHaveCount(1)
  await expect(tarjeta).not.toHaveClass(/ag-ev-nuevo/, { timeout: 2000 })
  const r = await leer(page)
  expect(r.nuevo.some(t => t.includes(titulo))).toBe(true)
  expect(r.remoto.some(t => t.includes(titulo))).toBe(false)
})

test('un INSERT ajeno por tiempo real entra con .ag-ev-remoto (el anillo)', async ({ page }) => {
  await abrir(page)
  await esperarCarga(page)

  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await page.getByRole('tab', { name: 'Evento' }).click()
  const medicoId = await dialogo.locator('select').nth(0).inputValue()
  const consultorioId = await dialogo.locator('select').nth(1).inputValue()
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
  await vaciar(page)

  const titulo = tituloUnico('Evento F remoto')
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: new Date(`${DIA_LABORABLE_LIBRE}T16:30:00`).toISOString(),
      end_time: new Date(`${DIA_LABORABLE_LIBRE}T16:50:00`).toISOString(),
      all_day: false, medico_id: medicoId, consultorio_id: consultorioId, client_id: randomUUID(),
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()

  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 10000 })
  expect(await animacionesFueraDeRegla(page)).toEqual([])
  await expect.poll(async () => (await leer(page)).remoto.some(t => t.includes(titulo))).toBe(true)
})

test('la baja pasa por .ag-ev-saliendo y después desaparece', async ({ page }) => {
  await abrir(page)
  await esperarCarga(page)
  const titulo = tituloUnico('Evento F salida')
  const { id } = await altaEvento(page, titulo, '12:30')
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })
  await vaciar(page)

  await page.locator('.fc-event', { hasText: titulo }).click()
  await expect(modalCita(page, 'Editar evento')).toBeVisible()
  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Eliminar evento', exact: true }).click()
  expect(await animacionesFueraDeRegla(page)).toEqual([])
  expect((await resp).ok()).toBeTruthy()
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(0)
  expect((await leer(page)).saliendo.some(t => t.includes(titulo))).toBe(true)
})

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' })

  test('todo aparece y desaparece igual, y nada se anima con WAAPI', async ({ page }) => {
    await abrir(page)
    await esperarCarga(page)
    await vaciar(page)

    await page.locator('.fc-next-button').click()
    await esperarCarga(page)
    await page.locator('.fc-prev-button').click()
    await esperarCarga(page)

    const titulo = tituloUnico('Evento F reducido')
    const { id } = await altaEvento(page, titulo, '13:40')
    const tarjeta = page.locator('.fc-event', { hasText: titulo })
    await expect(tarjeta).toHaveCount(1)
    /* `.01ms`: la entrada termina al instante y la tarjeta queda a opacidad plena. */
    await expect(tarjeta).toHaveCSS('opacity', '1')

    await tarjeta.click()
    await expect(modalCita(page, 'Editar evento')).toBeVisible()
    const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'DELETE')
    await page.getByRole('button', { name: 'Eliminar evento', exact: true }).click()
    expect((await resp).ok()).toBeTruthy()
    await expect(tarjeta).toHaveCount(0)
    await expect(modalCita(page, 'Editar evento')).toBeHidden()

    expect((await leer(page)).waapi).toEqual([])
  })
})
