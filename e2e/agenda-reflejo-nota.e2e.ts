import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * I1 · punto 4 de Angel: al concluir una consulta la cita no pasaba a
 * «Atendida» en la agenda hasta recargar.
 *
 * Causa: `POST /api/consultas` marca la cita `attended`, pero la nota se
 * escribe con la agenda DESMONTADA, y la caché de rangos (`cacheRangosCitas`,
 * A1.5, vive en el módulo y sobrevive al desmontaje) sólo se vaciaba con las
 * escrituras de la propia agenda o con un evento de su canal de Realtime, que
 * muere con ella. Al volver se servía la semana guardada, con la cita aún
 * «Agendada»; la semilla del servidor no lo arreglaba (si se vuelve en menos
 * de 30 s el router reutiliza el RSC viejo, y la de un RSC nuevo se descarta
 * porque la clave ya tiene entrada vigente).
 *
 * Arreglo: la nota guardada desde una cita vacía la caché al responder el
 * servidor, como ya hacía `ligarCita.ts` por el mismo motivo.
 *
 * Esta prueba quita el tiempo real de en medio A PROPÓSITO (descarta los
 * `postgres_changes` del socket): una escritura de la misma pestaña no puede
 * depender de que el eco llegue antes de que el médico vuelva a la agenda.
 * Sin ese filtro también la cubriría el canal que ahora sobrevive al
 * desmontaje (punto 5, `agenda-reflejo-enlace.e2e.ts`). Por eso la prueba
 * comprueba además que el filtro descartó de verdad el cambio: si el formato
 * del protocolo cambiara y no descartara nada, pasaría sin probar esto.
 *
 * ⚠️ NO SE CREA NINGUNA NOTA: el `POST /api/consultas` se responde aquí y lo
 * que el servidor haría con la cita (pasarla a `attended`) se hace por SQL.
 * Una nota clínica no se puede borrar y dejaría la siembra sin poder limpiar
 * la clínica (`exigirSinExpediente`). Lo que se prueba es la caché del
 * cliente, no la ruta, que ya cubre `agenda-ligar-consulta.e2e.ts`.
 *
 * MUTACIÓN (comprobada en rojo): quitar `vaciarCacheCitas()` del `guardar()`
 * de `nueva-nota/page.tsx`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const VIERNES = diaDeLaSemana(0, 4)
let citaId = ''

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterAll(() => {
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})
test.afterEach(() => {
  if (citaId) sqlLocal(`delete from public.appointments where id = :'id';`, { id: citaId })
  citaId = ''
})

/** Una cita agendada de admin.a para «Paciente Prueba 19», el viernes de esta semana. */
function citaAgendada(): { id: string; paciente: string } {
  const fila = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
           consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz, :'ini'::timestamptz + interval '30 min', 'scheduled',
           co.nombre, co.nombre_corto, co.direccion, co.telefono, :'tz', 'spinus', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = 'Prueba 19'
     where co.nombre = 'Consultorio Centro (ficticio)'
    returning id || '|' || paciente_id`, { ini: fechaHoraLocalAInstante(VIERNES, '12:00', TZ), tz: TZ })
  const [id = '', paciente = ''] = fila.split('|')
  return { id, paciente }
}

/** El estado que dice la tarjeta («… · Atendida»), del `title` o del `aria-label` de su caja. */
async function estadoEnTarjeta(page: Page, id: string): Promise<string> {
  const caja = page.locator(`.fc-timegrid-event [data-cita-id="${id}"]`)
  if (!(await caja.count())) return '(sin tarjeta)'
  const texto = (await caja.getAttribute('title')) ?? (await caja.getAttribute('aria-label')) ?? ''
  return texto.split(' · ')[1] ?? texto
}

/** El socket de Realtime sin los cambios de la tabla: todo lo demás pasa tal cual. */
async function sinCambiosDeRealtime(page: Page): Promise<() => number> {
  let descartados = 0
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, ws => {
    const servidor = ws.connectToServer()
    ws.onMessage(m => servidor.send(m))
    servidor.onMessage(m => {
      if (typeof m === 'string' && m.includes(',"postgres_changes",{"data"')) { descartados += 1; return }
      ws.send(m)
    })
  })
  return () => descartados
}

test('guardar la nota de una cita y volver por el menú: la tarjeta ya dice «Atendida», sin recargar', async ({ page }) => {
  const cita = citaAgendada()
  citaId = cita.id
  const descartados = await sinCambiosDeRealtime(page)
  let cuerpo: Record<string, unknown> = {}
  await page.route('**/api/consultas', async ruta => {
    if (ruta.request().method() !== 'POST') return ruta.continue()
    cuerpo = ruta.request().postDataJSON() as Record<string, unknown>
    sqlLocal(`update public.appointments set status = 'attended' where id = :'id';`, { id: cita.id })
    await ruta.fulfill({ status: 201, json: { ok: true } })
  })

  await abrirAgendaV2(page)
  const tarjeta = page.locator('.fc-timegrid-event', { has: page.locator(`[data-cita-id="${cita.id}"]`) })
  await tarjeta.scrollIntoViewIfNeeded()
  await expect.poll(() => estadoEnTarjeta(page, cita.id)).toBe('Agendada')
  await tarjeta.click({ position: { x: 8, y: 8 } })
  await tarjetaLectura(page).getByRole('button', { name: 'Iniciar consulta' }).click()
  await page.waitForURL(`**/expediente/${cita.paciente}/nueva-nota?cita=${cita.id}`)

  await page.getByRole('button', { name: /Prefiero escribirla yo/ }).click()
  await page.getByPlaceholder(/^Ej: Paciente refiere cuadro/).fill('Dolor lumbar de prueba e2e.')
  await page.getByPlaceholder(/^Ej: TA 120\/80/).fill('Exploración de prueba e2e.')
  await page.getByPlaceholder('Buscar diagnóstico CIE-10 o escribir...').fill('Lumbalgia de prueba')
  await page.getByPlaceholder(/^Ej: Reposo relativo/).fill('Plan de prueba e2e.')
  await page.getByRole('button', { name: /Previsualizar nota/ }).click()
  await page.getByRole('button', { name: /Guardar nota/ }).click()
  await page.getByRole('button', { name: /Guardar nota/ }).click()
  await expect(page.getByRole('heading', { level: 3, name: 'Nota guardada' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(cuerpo.appointment_id).toBe(cita.id)
  // El UPDATE de la cita sí salió por el socket, y el filtro se lo comió.
  await expect.poll(descartados, { timeout: 8000 }).toBeGreaterThan(0)

  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await page.waitForURL(/\/agenda$/)
  await expect.poll(() => estadoEnTarjeta(page, cita.id), { timeout: 8000 }).toBe('Atendida')
})
