import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E de la agenda (A0, red de seguridad antes de optimizar).
 * Servidor de PRODUCCIÓN ya levantado en :3001 (`next start` sobre el `.next`
 * existente) — este archivo NO lo arranca ni lo detiene.
 *
 * `testMatch` usa `*.e2e.ts` a propósito: Vitest (`vitest.config.ts`) recoge
 * `*.test.ts`/`*.spec.ts`, así que esta extensión evita que una corrida pise
 * a la otra.
 *
 * El proyecto de medición de carga (`medicion`, A0/A1) vive en
 * `playwright.medicion.config.ts`, deliberadamente separado: así
 * `npx playwright test` (este archivo) nunca lo ejecuta por accidente.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  testIgnore: '**/medir-carga.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    locale: 'es-MX',
    timezoneId: 'America/Merida',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'telefono',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    /* F1.16 · La tableta vertical (768–1023 px): Semana en rejilla de tres
       días. Sólo corre sus propios archivos; el resto de la suite ya cubre
       escritorio y teléfono, y sus pruebas no saben de este tercer formato.
       T1: también la colocación de la burbuja y la tarjeta (punto 3). */
    {
      name: 'tableta',
      testMatch: ['**/agenda-f-tableta.e2e.ts', '**/agenda-t1-capas.e2e.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
