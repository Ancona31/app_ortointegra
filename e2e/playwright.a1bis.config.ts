import { defineConfig, devices } from '@playwright/test'

/**
 * Medición A1-bis (diagnóstico). Config APARTE, como `playwright.medicion.config.ts`:
 * los archivos van con `.medicion.ts` y no `.e2e.ts`, así que ni
 * `npx playwright test` (que sólo busca `.e2e.ts`) ni Vitest los recogen.
 *
 *   npx playwright test --config=e2e/playwright.a1bis.config.ts [medir-a1bis-sesion]
 *
 * `A1BIS_VOLUMEN=30000` siembra con volumen; `A1BIS_SIN_SEMBRAR=1` reutiliza la
 * base tal cual. Ver `global-setup-a1bis.ts`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['**/medir-a1bis*.medicion.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60 * 1000,
  reporter: [['list']],
  globalSetup: './global-setup-a1bis.ts',
  use: {
    baseURL: 'http://localhost:3001',
    locale: 'es-MX',
    timezoneId: 'America/Merida',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
})
