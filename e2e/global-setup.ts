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

/**
 * Espera a que Realtime purgue las suscripciones de las páginas que ya se
 * cerraron, ANTES de resembrar. Sin esto, dos corridas seguidas de la suite
 * dejan a la segunda sin tiempo real durante su primer minuto: es lo que
 * hacía fallar a ratos, juntas, las pruebas de `agenda-cache-rangos.e2e.ts`
 * que esperan un eco (`observarEcosRealtime`, 10 s sin llegar).
 *
 * La cadena, comprobada en el Realtime local (v2.130.0) y en su código:
 *  1. Al cerrarse una página, su fila de `realtime.subscription` NO se borra al
 *     momento: el SubscriptionManager la encola y vacía la cola cada 15 s. Al
 *     final de una corrida quedan hasta ~18 filas así.
 *  2. La resiembra borra ~376 citas. Un DELETE se entrega a TODAS las
 *     suscripciones de la tabla sin pasar por la RLS (`realtime.apply_rls`:
 *     `if not is_rls_enabled or action = 'DELETE'`), filas muertas incluidas,
 *     y el poller cuenta cada entrega contra `max_events_per_second` (100, en
 *     media de 60 s): 376 × 18 ≈ 6.800 → 113/s → `MessagePerSecondRateLimitReached`.
 *  3. Con el límite disparado el poller CONSUME los cambios y no los emite
 *     (`replication_poller.ex`, rama `triggered: true`) hasta que la media baja,
 *     hasta un minuto después: los ecos de ese minuto se pierden, no se retrasan.
 * Con la tabla vacía cuando se borra, cada DELETE cuenta cero.
 *
 * Si no se vacía en 20 s es que hay una agenda ABIERTA de verdad (una pestaña
 * de desarrollo): con una o dos la cuenta no llega al límite, así que se avisa
 * y se sigue.
 */
async function esperarSuscripcionesRealtimePurgadas(): Promise<void> {
  const contar = (): number => Number(execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-tAq',
    '-c', 'select count(*) from realtime.subscription'], { encoding: 'utf8' }).trim())
  const hasta = Date.now() + 20_000
  let quedan = contar()
  while (quedan > 0 && Date.now() < hasta) {
    await new Promise((r) => setTimeout(r, 500))
    quedan = contar()
  }
  if (quedan > 0) console.warn(`global-setup: ${quedan} suscripción(es) de Realtime siguen vivas; se resiembra igual.`)
}

/**
 * Apaga el interruptor de la agenda v2 (`agenda_ajustes.agenda_v2_encendida`)
 * en TODAS las clínicas de la base local, para que cada corrida empiece con la
 * agenda de siempre y sólo la prueba que lo pida lo encienda
 * (`interruptorAgenda` de `ayudas.ts`). Una corrida que abortó a medias pudo
 * dejar uno encendido, y las clínicas que no son de la semilla no se resiembran.
 *
 * Si la tabla todavía no existe (base local sin la migración B1), no hay ningún
 * interruptor que apagar: la agenda ya los trata a todos como apagados.
 */
function apagarInterruptoresAgenda(): void {
  execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-X', '-tAq',
    '-v', 'ON_ERROR_STOP=1', '-c',
    `do $$ begin
       if to_regclass('public.agenda_ajustes') is not null then
         update public.agenda_ajustes set agenda_v2_encendida = false where agenda_v2_encendida;
       end if;
     end $$`], { encoding: 'utf8' })
}

export default async function globalSetup(): Promise<void> {
  comprobarBuildFresco()
  apagarInterruptoresAgenda()
  await esperarSuscripcionesRealtimePurgadas()
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
