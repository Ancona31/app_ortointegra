import { test, expect } from '@playwright/test'
import { irAAgenda, interruptorAgenda, enContextoNuevo, SESION } from './ayudas'

/**
 * El interruptor de la agenda v2 (plan del bloque B §1, paso B1) llega del
 * servidor al cliente, por clínica, y arranca apagado. Hoy nada visible
 * depende de él: se comprueba en `data-agenda-v2` de `.agenda-raiz`, que es lo
 * único que lo refleja hasta que los pasos siguientes lo usen.
 *
 * Lo enciende y lo apaga como `postgres` (`interruptorAgenda`), igual que
 * Angel desde el editor SQL. Lo deja apagado al terminar pase lo que pase, y
 * `global-setup.ts` los apaga todos al empezar.
 */
test.use({ storageState: SESION.adminA })

test.afterEach(() => {
  interruptorAgenda('A', false)
})

test('apagado por omisión; encendido sólo para la clínica que lo tiene encendido', async ({ page, browser }) => {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')

  interruptorAgenda('A', true)

  // Contexto nuevo: lo que cuenta es lo que lee el servidor al pintar la página.
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'encendida')
  })
  // La secretaria de la misma clínica lo ve igual: es por clínica, no por usuario.
  await enContextoNuevo(browser, SESION.secretariaA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'encendida')
  })
  // La clínica B no tiene fila: sigue apagada.
  await enContextoNuevo(browser, SESION.adminB, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
  })

  interruptorAgenda('A', false)
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
  })
})
