import { test, expect } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'

/**
 * F3.6 · Buscar las citas de un paciente (bloque F, detrás del interruptor).
 *
 * Botón con lupa en la barra (y `/`), primero pacientes y después sus citas
 * (desde hace 30 días hasta dentro de un año, 20 como mucho); elegir una cita
 * lleva a su día en la vista Día y abre su tarjeta de lectura.
 *
 * ⚠️ EL INVITADO NO VE CITAS DE OTRO MÉDICO, Y LO GARANTIZA LA RLS
 * (`appointments_select`: su médico, el admin de la clínica o la secretaria),
 * NO un filtro del buscador. Aquí se comprueba en la respuesta de PostgREST:
 * con la sesión del médico invitado, toda fila que vuelve es suya, aunque el
 * paciente tenga citas del administrador en la misma ventana (lo asegura la
 * consulta de arriba como `postgres`, para que la prueba no pase en vacío).
 * Comprobado también a mano en la base local (2026-11-12): 85 citas de otro
 * médico sobre esos pacientes, 0 visibles como invitado.
 *
 * MUTACIONES: añadir `.or('medico_id.neq.…')` o cualquier consulta con cliente
 * de servicio en `buscarCitasPaciente.ts` → la prueba del invitado se pone en
 * rojo; quitar el `agendaV2` del botón → «apagado» lo ve.
 */
/* Escritorio, salvo el bloque «teléfono» (la lupa de la banda azul). */
test.beforeEach(({}, info) => {
  const delTelefono = info.titlePath.includes('teléfono')
  test.skip(info.project.name !== (delTelefono ? 'telefono' : 'escritorio'), delTelefono ? 'banda del teléfono' : 'barra de escritorio')
})

test.afterEach(() => { interruptorAgenda('A', false) })

/** Un paciente del invitado con citas SUYAS y TAMBIÉN del administrador en la ventana de búsqueda. */
function pacienteCompartido(): { apellidos: string; invitado: string } {
  const [apellidos, invitado] = sqlLocal(`
    with inv as (select p.id from auth.users u join public.profiles p on p.id = u.id where u.email = :'correo')
    select pa.apellidos, (select id from inv)
      from public.pacientes pa
     where exists (select 1 from public.paciente_medico pm where pm.paciente_id = pa.id and pm.medico_id = (select id from inv))
       and exists (select 1 from public.appointments a where a.paciente_id = pa.id and a.medico_id <> (select id from inv)
                     and a.start_time > now() - interval '29 days' and a.start_time < now() + interval '364 days')
       and exists (select 1 from public.appointments a where a.paciente_id = pa.id and a.medico_id = (select id from inv)
                     and a.start_time > now() - interval '29 days' and a.start_time < now() + interval '364 days')
     order by pa.apellidos limit 1`, { correo: CORREO.medicoA }).split('|')
  if (!apellidos) throw new Error('pacienteCompartido: la semilla no tiene un paciente con citas de los dos médicos')
  return { apellidos, invitado }
}

test.describe('administrador', () => {
  test.use({ storageState: SESION.adminA })

  test('apagado: no hay botón de búsqueda y `/` no hace nada', async ({ page }) => {
    await abrirAgendaApagada(page)
    await expect(page.getByRole('button', { name: 'Buscar citas de un paciente' })).toHaveCount(0)
    await page.keyboard.press('/')
    await expect(page.getByRole('dialog', { name: 'Buscar citas' })).toHaveCount(0)
  })

  test('encendido: paciente → sus citas → Día de esa cita con su tarjeta abierta', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    const boton = page.getByRole('button', { name: 'Buscar citas de un paciente' })
    await expect(boton).toHaveAttribute('aria-keyshortcuts', '/')
    await boton.click()
    const dialogo = page.getByRole('dialog', { name: 'Buscar citas' })
    const campo = dialogo.getByRole('combobox')
    await expect(campo).toBeFocused()
    await campo.fill('Prueba 07')
    await expect(dialogo.getByRole('option').first()).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(campo).toHaveAttribute('aria-activedescendant', /.+/)
    await page.keyboard.press('Enter')
    const cita = dialogo.getByRole('option').first()
    await expect(cita).toBeVisible()
    await cita.click()
    await expect(dialogo).toHaveCount(0)
    await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
    await expect(tarjetaLectura(page)).toHaveAccessibleName('Paciente Prueba 07')
  })

  test('encendido: `/` abre el buscador; Escape limpia y un segundo Escape lo cierra', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await page.keyboard.press('/')
    const dialogo = page.getByRole('dialog', { name: 'Buscar citas' })
    const campo = dialogo.getByRole('combobox')
    await expect(campo).toBeFocused()
    await campo.fill('Prueba')
    await page.keyboard.press('Escape')
    await expect(campo).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
  })
})

test.describe('médico invitado', () => {
  test.use({ storageState: SESION.medicoA })

  test('encendido: las citas que devuelve la búsqueda son sólo suyas (RLS)', async ({ page }) => {
    interruptorAgenda('A', true)
    const { apellidos, invitado } = pacienteCompartido()
    await abrirAgendaV2(page)
    await page.getByRole('button', { name: 'Buscar citas de un paciente' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Buscar citas' })
    await dialogo.getByRole('combobox').fill(apellidos)
    const respuesta = page.waitForResponse(r => r.url().includes('/rest/v1/appointments') && r.url().includes('paciente_id=eq.'))
    await dialogo.getByRole('option', { name: new RegExp(apellidos) }).first().click()
    const filas = await (await respuesta).json() as { medico_id: string }[]
    expect(filas.length).toBeGreaterThan(0)
    expect(filas.every(f => f.medico_id === invitado)).toBe(true)
  })
})

/* Cierre de F · en el teléfono la lupa va en la ranura `buscar` de la banda,
   delante del filtro, a 44 px; ni el minicalendario (decisión 21) ni el botón
   de la ayuda. MUTACIÓN: quitar el `buscar=` de `<BandaMovil>` → rojo. */
test.describe('teléfono', () => {
  test.use({ storageState: SESION.adminA })

  test('apagado: la banda no tiene lupa', async ({ page }) => {
    await abrirAgendaApagada(page)
    await expect(page.locator('.ag-banda-movil')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buscar citas de un paciente' })).toHaveCount(0)
  })

  test('encendido: la lupa de la banda (44 px) abre el buscador dentro de la pantalla', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    const banda = page.locator('.ag-banda-movil')
    const boton = banda.getByRole('button', { name: 'Buscar citas de un paciente' })
    const caja = await boton.boundingBox()
    expect(caja?.width).toBeGreaterThanOrEqual(44)
    expect(caja?.height).toBeGreaterThanOrEqual(44)
    await expect(banda.getByRole('button', { name: 'Ir a una fecha' })).toHaveCount(0)
    await expect(banda.getByRole('button', { name: 'Atajos de teclado' })).toHaveCount(0)
    await boton.click()
    const dialogo = page.getByRole('dialog', { name: 'Buscar citas' })
    await expect(dialogo.getByRole('combobox')).toBeFocused()
    const d = await dialogo.boundingBox()
    const ancho = page.viewportSize()?.width ?? 0
    expect(d && d.x >= 0 && d.x + d.width <= ancho).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await expect(boton).toBeFocused()
  })
})
