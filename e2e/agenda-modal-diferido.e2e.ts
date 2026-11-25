import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { irAAgenda, modalCita, soloEscritorio, SESION } from './ayudas'

/**
 * A2.6: `AppointmentModal` se carga en diferido (`next/dynamic`) y la agenda
 * precarga su chunk en tiempo ocioso tras montar — ver el comentario de
 * `precargarModalesAgenda` en `AgendaCliente.tsx`. Esta prueba comprueba la
 * promesa concreta del encargo: "la primera apertura no debe esperar a la
 * descarga".
 *
 * Sólo escritorio: usa el botón `[data-onboard="nueva-cita"]` del toolbar.
 */
soloEscritorio()

test.use({ storageState: SESION.adminA })

/**
 * Los archivos JS que el chunk de `AppointmentModal` necesita, leídos del
 * manifiesto que el propio `next build` escribe — NUNCA un hash a mano: la
 * prohibición del CLAUDE.md sobre hashes hardcodeados es para el Service
 * Worker del búnker, pero la razón de fondo (el hash cambia en cada deploy)
 * es la misma aquí, así que se lee en caliente igual.
 *
 * La clave del manifiesto es "<archivo de origen> -> <especificador del
 * import()>" — comprobado contra el `.next/react-loadable-manifest.json`
 * real de este build, no supuesto.
 */
function chunksDelModalCita(): string[] {
  const ruta = path.resolve(process.cwd(), '.next/react-loadable-manifest.json')
  const manifiesto = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, { files: string[] }>
  const clave = Object.keys(manifiesto).find(
    k => k.includes('AgendaCliente.tsx') && k.includes('@/components/agenda/AppointmentModal'),
  )
  if (!clave) {
    throw new Error(
      'No se encontró en .next/react-loadable-manifest.json la entrada del AppointmentModal dinámico de AgendaCliente — ' +
      '¿se compiló con "npm run build" después de A2.6, o cambió cómo Next nombra la clave?',
    )
  }
  return manifiesto[clave].files
}

test('Agendar no espera a la red: el chunk del modal ya llegó por la precarga en ocioso', async ({ page }) => {
  const archivos = chunksDelModalCita()

  // Retrasa SÓLO las respuestas de esos archivos 2 s — el resto de la página
  // (incluida la propia rejilla de la agenda) viaja a velocidad normal.
  for (const archivo of archivos) {
    await page.route(`**/_next/${archivo}`, async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })
  }

  // La respuesta del PRIMER archivo retrasado es la señal de que la
  // descarga —disparada por el ocioso tras montar, o por su respaldo de
  // `setTimeout`— ya salió y ya contestó. Esperar a esto Y NO a un
  // `waitForTimeout` a ciegas es lo que deja el reloj de abajo medir sólo el
  // clic, no la precarga.
  const esperaPrecarga = page.waitForResponse(
    res => archivos.some(a => res.url().endsWith(a)), { timeout: 10000 },
  )

  await irAAgenda(page)
  await esperaPrecarga

  const inicio = Date.now()
  await page.locator('[data-onboard="nueva-cita"]').click()
  await expect(modalCita(page, 'Nueva cita')).toBeVisible({ timeout: 1500 })
  const ms = Date.now() - inicio

  // Muy por debajo de los 2000 ms del retraso: si el modal hubiera tenido
  // que esperar la red retrasada OTRA VEZ al pulsar, esto habría tardado casi
  // 2 s en vez de los milisegundos que tarda React en montar un componente
  // ya cacheado por el runtime de `webpack`.
  expect(ms).toBeLessThan(1000)
})
