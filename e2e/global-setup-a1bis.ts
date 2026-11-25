import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import setupNormal, { nombreSesion } from './global-setup'

/**
 * Setup de la medición A1-bis con VOLUMEN: siembra con `--volumen N`
 * (A1BIS_VOLUMEN) y abre sesión como `global-setup.ts`. Sin la variable,
 * delega en el setup normal.
 */
const USUARIOS = ['admin.a@semilla.spinus.test', 'medico.a@semilla.spinus.test', 'secretaria.a@semilla.spinus.test', 'admin.b@semilla.spinus.test']

/**
 * Tras insertar decenas de miles de citas, Realtime sigue recorriéndolas un
 * rato, y si una agenda se suscribe mientras tanto le llegan en tropel y su
 * cuenta dispara `MessagePerSecondRateLimitReached` (comprobado: con el límite
 * puesto, Realtime CONSUME los cambios sin emitirlos durante hasta 60 s, y las
 * mediciones de tiempo real esperan un eco que no llega). El slot de
 * replicación ya marca 0 de retraso en ese momento, así que no sirve de señal:
 * se espera una ventana entera del contador, 75 s.
 */
async function esperarColaRealtime(): Promise<void> {
  await new Promise(r => setTimeout(r, 75_000))
}

export default async function setup(): Promise<void> {
  if (process.env.A1BIS_SIN_SEMBRAR) return
  const n = process.env.A1BIS_VOLUMEN
  if (!n) return setupNormal()
  execFileSync('npx', ['tsx', 'scripts/agenda-semilla.ts', '--volumen', n], { stdio: 'inherit' })
  await esperarColaRealtime()
  const dir = path.resolve('e2e/.auth'); mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const email of USUARIOS) {
      const ctx = await browser.newContext({ baseURL: 'http://localhost:3001' })
      const page = await ctx.newPage()
      await page.goto('/login')
      await page.getByLabel('Correo electrónico', { exact: true }).fill(email)
      await page.getByLabel('Contraseña', { exact: true }).fill('Semilla-Agenda-2026')
      await page.getByRole('button', { name: 'Iniciar sesión' }).click()
      await page.waitForURL('**/inicio', { timeout: 20000 })
      await ctx.storageState({ path: path.join(dir, `${nombreSesion(email)}.json`) })
      await ctx.close()
    }
  } finally { await browser.close() }
}
