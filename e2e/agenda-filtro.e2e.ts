import { test, expect } from '@playwright/test'
import { irAAgenda, soloEscritorio, SESION, selectFiltroMedico } from './ayudas'

// El `<select>` sin nombre del toolbar de escritorio; en `telefono` el
// filtro es otro control (`getByLabel('Filtrar por médico')`, cubierto en
// `agenda-movil.e2e.ts`).
soloEscritorio()

test.describe('filtro de médico — admin.a', () => {
  test.use({ storageState: SESION.adminA })

  test('elegir un médico en Semana deja sólo sus citas', async ({ page }) => {
    await irAAgenda(page)
    const select = selectFiltroMedico(page)
    await expect(select).toBeVisible()

    await select.selectOption({ label: 'Dra. Invitada Semilla Dos' })
    await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
    // Ninguna tarjeta visible debe traer el chip de iniciales del admin (AS);
    // más simple y estable: comprobar que ya no aparece ningún evento propio
    // conocido del admin («Cirugía programada», sólo suya).
    await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)

    await select.selectOption({ label: 'Dr. Admin Semilla Uno' })
    await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' }).first()).toBeVisible()
  })

  test('en Mes se fuerza un médico y "Todos" está deshabilitado', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
    const select = selectFiltroMedico(page)
    const opcionTodos = select.locator('option', { hasText: 'Todos los médicos' })
    await expect(opcionTodos).toBeDisabled()
    await expect(select).not.toHaveValue('')
  })

  test('«Ver todos los médicos» de la banda vacía limpia el filtro de la petición', async ({ page }) => {
    // Defecto corregido tras A2.1: el botón llamaba a `setFiltroMedico('')` sin
    // pasar por `aplicarFiltro`, y `filtroSincronoRef` seguía en el médico
    // anterior, así que la traída salía filtrada. Hoy usa `aplicarFiltro`.

    // Se fuerza la banda vacía CON MUTACIÓN (barata, sólo en esta prueba): el
    // mock contesta vacío mientras la petición lleve `medico_id`, y deja
    // pasar la petición real (`route.continue()`) en cuanto no lo lleve — que
    // es justo la pregunta que esta prueba le hace al código.
    await page.route('**/api/appointments**', async route => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('medico_id')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ appointments: [], incompleta: false }) })
      } else {
        await route.continue()
      }
    })

    await page.goto('/agenda')
    const select = selectFiltroMedico(page)
    await expect(select.locator('option', { hasText: 'Dra. Invitada Semilla Dos' })).toHaveCount(1)
    await select.selectOption({ label: 'Dra. Invitada Semilla Dos' })
    await expect(page.getByRole('button', { name: 'Ver todos los médicos' })).toBeVisible({ timeout: 15000 })

    // «Todos» de esta semana no está en la caché de rangos (la semilla del
    // admin es con su propio filtro), así que tiene que salir una petición, y
    // sin `medico_id`.
    const siguientePeticion = page.waitForRequest(r => r.url().includes('/api/appointments?') && r.method() === 'GET', { timeout: 5000 })
    await page.getByRole('button', { name: 'Ver todos los médicos' }).click()
    const peticion = await siguientePeticion
    expect(new URL(peticion.url()).searchParams.get('medico_id')).toBeNull()
    await expect(select).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Ver todos los médicos' })).toHaveCount(0)
  })
})

test.describe('filtro de médico — médico invitado', () => {
  test.use({ storageState: SESION.medicoA })

  test('abre filtrado a sí mismo: no ve las citas ajenas, sí las propias', async ({ page }) => {
    // GRAVE §6: la versión anterior asumía que el `<select>` del filtro
    // SIEMPRE existe y, si no lo encontraba, salía con un `return` temprano
    // que dejaba la prueba sin comprobar nada. Comprobado contra el servidor
    // real: para la médica INVITADA el `<select>` NO se pinta — `/api/me/config`
    // lee `profiles` con el cliente de SESIÓN (route.ts), y la RLS de esa
    // tabla sólo le deja ver su propia fila, así que `medicos` le llega con
    // longitud 1 e `isSingleDoctor` sale `true` desde su punto de vista,
    // aunque la clínica tenga dos médicos. El arreglo no es fingir que el
    // `<select>` existe: es comprobar lo que de verdad importa —qué citas
    // se ven— sin depender de si el control está montado.
    await irAAgenda(page)

    // Ajenas: «Cirugía programada» y «Junta de servicio» son del admin
    // (`agenda-semilla.ts`: `evento('adminA', ...)`), nunca de la invitada.
    await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)
    await expect(page.locator('.fc-event', { hasText: 'Junta de servicio' })).toHaveCount(0)

    // Propia: «Comida» es de la invitada (`evento('invitadoA', ...)`, jueves
    // de esta semana) y entra en la vista Semana por defecto.
    await expect(page.locator('.fc-event', { hasText: 'Comida' })).toBeVisible()
  })
})
