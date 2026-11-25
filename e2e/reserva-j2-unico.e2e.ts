import { test, expect } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, sinPendientesAgenda, sqlLocal } from './ayudas'
import { contarCorreos, esperarCorreo } from './mailpit'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import {
  api, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario,
} from './reservaPublicaAyudas'

/**
 * Tanda J, J2 (punto 3 de Angel): el enlace de UN SOLO USO, con tope de
 * intentos y con el correo que escribió la clínica al emitirlo.
 *
 *   · el correo que teclea quien reserva NO cuenta: ni va a la cita ni recibe
 *     el comprobante; el de la clínica, sí (y sólo ése);
 *   · 5 intentos que llegan a la base: el 6.º, y la página, dicen «ya no está
 *     disponible» sin decir por qué (410 `enlace_no_disponible`);
 *   · un «bloqueado» agota el único en el acto: no deja probar otro teléfono;
 *   · la clínica escribe el correo al crear el enlace de una vez y no
 *     vuelve a salir hacia el navegador. Con la v2 la configuración es la de
 *     J5 («Tu enlace» › «Crear uno»); integración de la tanda J: el campo
 *     «Correo del paciente (opcional)» pasó a `CrearEnlaceUnaVez`.
 *     MUTACIÓN: no mandar `correo` en `emitirEnlace` (accionesConfig.ts) →
 *     rojo (el enlace queda sin correo).
 *
 * Es la comprobación de punta a punta. Las mutaciones de cada regla (el
 * correo tecleado en el único, el tope a 6, «bloqueado» sin agotar, el
 * client_id ajeno) se comprobaron en rojo en las pruebas que las aíslan:
 * `supabase/pruebas-sql/j2_unico_tope_correo.sql` y
 * `src/lib/tests/reservarSinCorreo.test.ts`.
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let desde = ''

test.beforeAll(() => {
  desde = marcaE2e()
  e = prepararEscenario()
})
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId })
  interruptorAgenda('A', false)
})

const citaPorTelefono = (tel: string): string =>
  sqlLocal(`select coalesce(reserva_correo, '<sin correo>') from public.appointments
             where reserva_telefono = :'tel' order by created_at desc limit 1`, { tel })
/** El comprobante y el evento de Google corren después de responder (D8): se les da tiempo. */
const despuesDeResponder = (): Promise<void> => new Promise(r => setTimeout(r, 2500))

test('el correo tecleado en un único no cuenta: sin correo de la clínica, la cita queda sin correo y no sale nada', async () => {
  const p = personaNueva()
  const unico = emitirEnlace(e, 'unico').codigo
  const [a] = await turnosLibres(e, unico, 30)
  expect((await reservar(e, unico, { inicio: a?.inicio ?? '', persona: p, soloTecleado: true })).status).toBe(201)
  expect(citaPorTelefono(p.telefono)).toBe('<sin correo>')
  await despuesDeResponder()
  expect(await contarCorreos(p.correo, 'Tu cita con')).toBe(0)
})

test('con el correo de la clínica en el único, el comprobante va ahí y NUNCA al tecleado', async () => {
  const p = personaNueva()
  const clinica = personaNueva().correo
  const unico = emitirEnlace(e, 'unico', clinica).codigo
  const [a] = await turnosLibres(e, unico, 31)
  expect((await reservar(e, unico, { inicio: a?.inicio ?? '', persona: p, soloTecleado: true })).status).toBe(201)
  expect(citaPorTelefono(p.telefono)).toBe(clinica)
  await esperarCorreo(clinica, 'Tu cita con')
  expect(await contarCorreos(p.correo, 'Tu cita con')).toBe(0)
})

test('tope: 5 intentos que llegan a la base; el 6.º y la página dicen «ya no está disponible», sin la causa', async ({ page }) => {
  const unico = emitirEnlace(e, 'unico').codigo
  const [a] = await turnosLibres(e, unico, 33)
  // El turno lo ocupa otra reserva: cada intento llega a la base y sale «ocupado» (409).
  expect((await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: a?.inicio ?? '', persona: { ...personaNueva(), correo: '' } })).status).toBe(201)
  for (let i = 1; i <= 5; i++) {
    expect((await reservar(e, unico, { inicio: a?.inicio ?? '', persona: { ...personaNueva(), correo: '' } })).status, `intento ${i}`).toBe(409)
  }
  expect(await reservar(e, unico, { inicio: a?.inicio ?? '', persona: { ...personaNueva(), correo: '' } }))
    .toEqual({ status: 410, cuerpo: { error: 'enlace_no_disponible' } })
  const ctx = await api()
  try {
    const r = await ctx.get(`/api/reservar/${unico}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}`)
    expect({ status: r.status(), cuerpo: await r.json() }).toEqual({ status: 410, cuerpo: { error: 'enlace_no_disponible' } })
  } finally {
    await ctx.dispose()
  }
  await page.goto(`/reservar/${unico}`)
  await expect(page.getByRole('heading', { name: 'Este enlace ya no está disponible' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/intento|bloque/i)
})

test('«bloqueado» agota el único en el acto: otro teléfono ya no se puede probar con él', async () => {
  const bloqueado = { ...personaNueva(), correo: '' }
  const unico = emitirEnlace(e, 'unico').codigo
  const [a, b] = await turnosLibres(e, unico, 35)
  expect((await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: a?.inicio ?? '', persona: bloqueado })).status).toBe(201)
  sqlLocal(`insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
            select clinica_id, medico_id, reserva_tel_hmac, 'telefono', now() from public.appointments
             where reserva_telefono = :'tel' order by created_at desc limit 1
            on conflict (clinica_id, medico_id, clave_hmac) do update set bloqueado_en = now(), perdonado_en = null`, { tel: bloqueado.telefono })
  expect(await reservar(e, unico, { inicio: b?.inicio ?? '', persona: bloqueado })).toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
  expect(await reservar(e, unico, { inicio: b?.inicio ?? '', persona: { ...personaNueva(), correo: '' } }))
    .toEqual({ status: 410, cuerpo: { error: 'enlace_no_disponible' } })
})

test.describe('emitir con el correo del paciente', () => {
  test.use({ storageState: SESION.adminA })
  test('la clínica escribe el correo al emitir el único; queda en el enlace y no vuelve al navegador', async ({ page }) => {
    const correo = personaNueva().correo
    // Sin nada pendiente: si no, la configuración abre el funnel de primera vez (J5).
    const deshacer = sinPendientesAgenda(CORREO.adminA)
    try {
      await page.goto('/agenda/configuracion')
      await page.getByRole('button', { name: 'Crear uno' }).click()
      // Por rol: la ficha plegada de «Enlaces de los demás médicos» lleva el mismo campo, oculto.
      await page.getByRole('textbox', { name: 'Correo del paciente (opcional)' }).fill(`  ${correo}  `)
      const respuesta = page.waitForResponse(x => x.url().endsWith('/api/agenda/enlaces') && x.request().method() === 'POST')
      await page.getByRole('button', { name: 'Crear enlace de una vez' }).click()
      const r = await respuesta
      expect(r.status()).toBe(201)
      expect(JSON.stringify(await r.json())).not.toContain(correo)
      await expect(page.locator('[data-enlace-una-vez]')).toHaveText(/\/reservar\/[A-Za-z0-9_-]{8,}$/)
    } finally {
      deshacer()
    }
    expect(sqlLocal(`select correo || '|' || (correo_hmac ~ '^[0-9a-f]{64}$')::text from public.reserva_enlaces
                      where clase = 'unico' and created_at >= :'d'::timestamptz order by created_at desc limit 1`, { d: desde }))
      .toBe(`${correo}|true`)
    const lista = await page.request.get('/api/agenda/enlaces')
    expect(await lista.text()).not.toContain(correo)
    // Un correo sin forma no emite (400) y no deja enlace.
    const mal = await page.request.post('/api/agenda/enlaces', {
      data: { clase: 'unico', medico_id: e.medicoId, correo: 'no-es-correo' },
    })
    expect(mal.status()).toBe(400)
  })
})
