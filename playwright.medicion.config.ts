import { defineConfig, devices } from '@playwright/test'

/**
 * Medición de carga de la agenda (A0, línea base; se repite igual en A1 para
 * comparar — ver `mejora_agendaV2.md` §5 Bloque A). Config APARTE de
 * `playwright.config.ts` a propósito: así `npx playwright test` (el comando
 * de siempre, con ese archivo) nunca ejecuta esta medición por accidente.
 * Se invoca explícitamente con:
 *
 *   npx playwright test --config=playwright.medicion.config.ts
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/medir-carga.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1000,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    locale: 'es-MX',
    timezoneId: 'America/Merida',
  },
  projects: [
    {
      name: 'medicion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
