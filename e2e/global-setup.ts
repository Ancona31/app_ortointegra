import { chromium } from '@playwright/test'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Setup global de las pruebas E2E: vuelve a sembrar la Supabase local
 * (scripts/agenda-semilla.ts, ver scripts/agenda-semilla.md) y abre sesión
 * por la UI de /login con cada usuario de la semilla, guardando su
 * `storageState` en `e2e/.auth/`. Las pruebas reutilizan esos archivos en vez
 * de iniciar sesión cada una.
 *
 * Usado tanto por `playwright.config.ts` como por
 * `playwright.medicion.config.ts` — por eso NO depende de nada del objeto
 * `FullConfig` (los dos apuntan al mismo servidor local).
 */
const BASE_URL = 'http://localhost:3001'
const CONTRASENA = 'Semilla-Agenda-2026'
const USUARIOS = [
  'admin.a@semilla.spinus.test',
  'medico.a@semilla.spinus.test',
  'secretaria.a@semilla.spinus.test',
  'admin.b@semilla.spinus.test',
] as const

/** admin.a -> admin-a (nombre de archivo de storageState) */
export function nombreSesion(email: string): string {
  return email.split('@')[0].replace('.', '-')
}

/**
 * GRAVE §2 de la revisión: nada impedía correr la suite entera contra un
 * `.next` viejo — `:3001` es `next start` sobre un build que alguien compiló
 * hace quién sabe cuánto, y las pruebas no lo arrancan ni lo detienen (ver la
 * cabecera de `playwright.config.ts`). Si `src/` tiene un archivo más nuevo
 * que `.next/BUILD_ID`, lo que se está probando no es el código que hay en
 * disco — aborta en vez de dar un verde que no significa nada.
 *
 * Comparar por `mtime` y no por commit de HEAD: el build no estampa ningún
 * hash (`BUILD_ID` aquí vale `dev-local`, no un sha) y `git` no sabe nada de
 * archivos sin commitear, que es exactamente el caso que más importa pescar
 * —código tocado a mano y todavía sin compilar—.
 */
function comprobarBuildFresco(): void {
  const buildId = path.resolve(process.cwd(), '.next/BUILD_ID')
  if (!existsSync(buildId)) {
    throw new Error(
      'No existe .next/BUILD_ID: compila con "npm run build" y levanta "next start" en :3001 antes de correr las pruebas E2E — ' +
      'no lo hacen por ti.',
    )
  }
  const masNuevos = spawnSync('find', ['src', '-type', 'f', '-newer', buildId], { cwd: process.cwd(), encoding: 'utf8' })
  if (masNuevos.status !== 0) {
    throw new Error(`comprobarBuildFresco: no se pudo comparar .next/BUILD_ID contra src/ (${masNuevos.stderr || 'sin detalle'}).`)
  }
  const archivos = masNuevos.stdout.split('\n').filter(Boolean)
  if (archivos.length) {
    throw new Error(
      `El build de :3001 (.next/BUILD_ID) es más viejo que ${archivos.length} archivo(s) de src/ (p. ej. "${archivos[0]}"). ` +
      'Recompila ("npm run build") y reinicia "next start" antes de volver a correr las pruebas: no se compilan solas.',
    )
  }
  // Que :3001 de verdad hable con la Supabase LOCAL (y no, por accidente, con
  // una de otro entorno) no se comprueba aparte: los usuarios de abajo sólo
  // existen tras `agenda-semilla.ts` contra la base local (su propio candado
  // aborta si `NEXT_PUBLIC_SUPABASE_URL` no es local), así que el login que
  // sigue —y que falla si no— YA es esa comprobación.
}

export default async function globalSetup(): Promise<void> {
  comprobarBuildFresco()
  execFileSync('npx', ['tsx', 'scripts/agenda-semilla.ts'], { stdio: 'inherit', cwd: process.cwd() })

  const dirAuth = path.resolve(process.cwd(), 'e2e/.auth')
  mkdirSync(dirAuth, { recursive: true })

  const browser = await chromium.launch()
  try {
    for (const email of USUARIOS) {
      const context = await browser.newContext({ baseURL: BASE_URL })
      const page = await context.newPage()
      await page.goto('/login')
      await page.getByLabel('Correo electrónico', { exact: true }).fill(email)
      await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA)
      await page.getByRole('button', { name: 'Iniciar sesión' }).click()
      await page.waitForURL('**/inicio', { timeout: 20000 })
      await context.storageState({ path: path.join(dirAuth, `${nombreSesion(email)}.json`) })
      await context.close()
    }
  } finally {
    await browser.close()
  }
}
