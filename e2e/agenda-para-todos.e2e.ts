import { test, expect } from '@playwright/test'
import { SESION, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Agenda para todos (M3, `20261206120000_agenda_para_todos.sql`) — la agenda
 * v2 encendida por omisión, vista desde el navegador (escritorio y teléfono):
 *   · una clínica SIN fila en `agenda_ajustes` ve la agenda v2 (antes, la de
 *     siempre): la app le pregunta a la base y la base dice «encendida»;
 *   · una fila que dice `false` la sigue apagando (es lo que escriben la
 *     semilla y `global-setup` para que las demás pruebas partan apagadas);
 *   · una fila en `true`, encendida, como siempre.
 *
 * MUTACIÓN (comprobada en rojo): `coalesce(…, false)` en
 * `public.agenda_v2_encendida(uuid)` (la función de antes de M3) → «sin fila…».
 */
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

/** La fila de la Clínica Semilla A, fuera (como postgres: nadie más puede borrarla). */
function quitarFila(): void {
  sqlLocal(`delete from public.agenda_ajustes
             where clinica_id = (select id from public.clinicas where nombre = 'Clínica Semilla A');`)
}

/* Deja la v2 APAGADA con fila explícita, como la encontró (regla de la tanda I). */
test.afterAll(() => { interruptorAgenda('A', false) })

test('sin fila en agenda_ajustes: la agenda es la v2', async ({ page }) => {
  quitarFila()
  await abrirAgendaV2(page)
})

test('una fila con false: la agenda es la de siempre', async ({ page }) => {
  interruptorAgenda('A', false)
  await abrirAgendaApagada(page)
})

test('una fila con true: la agenda es la v2', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
})

/* ── El alta de una clínica, con el flujo REAL (POST /api/me/clinica) ──────────────────────
   Un médico recién registrado, sin clínica, crea la suya desde la app. Con M3 la clínica nace
   con su fila de `agenda_ajustes` (encendida; recordatorio y correo a la clínica apagados). Y
   si el alta de esa fila FALLA, la clínica se crea igual: la agenda nunca impide registrarse.
   MUTACIÓN (comprobada en rojo): quitar el `EXCEPTION` de `agenda_ajustes_de_clinica_nueva()`
   → «si la fila de ajustes no se puede crear…» (la ruta contesta 500). */
test.describe('alta de clínica con el flujo real', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'escritorio', 'no depende del formato: una vez basta') })

  const CONTRASENA = 'Semilla-Agenda-2026'
  const correoDe = (n: string): string => `ap1-${n}@semilla.spinus.test`

  /** Un médico sin clínica, como lo deja el registro (usuario confirmado y su perfil de médico). */
  function crearMedicoSinClinica(n: string): void {
    borrarMedico(n)
    sqlLocal(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                                      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                                      confirmation_token, recovery_token, email_change, email_change_token_new)
              values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :'correo',
                      extensions.crypt(:'clave', extensions.gen_salt('bf')), now(),
                      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
              insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
              select gen_random_uuid(), u.id, u.id::text, json_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now()
                from auth.users u where u.email = :'correo';
              update public.profiles set role = 'medico' where id = (select id from auth.users where email = :'correo');`,
    { correo: correoDe(n), clave: CONTRASENA })
  }

  /** Lo que la prueba creó, fuera (como postgres): la fila de ajustes, la clínica vacía y el usuario. */
  function borrarMedico(n: string): void {
    sqlLocal(`do $$
      declare v_u uuid := (select id from auth.users where email = '${correoDe(n)}'); v_c uuid;
      begin
        if v_u is null then return; end if;
        select clinica_id into v_c from public.profiles where id = v_u;
        update public.profiles set clinica_id = null, es_admin_de_clinica = false where id = v_u;
        if v_c is not null then
          delete from public.agenda_ajustes where clinica_id = v_c;
          delete from public.clinicas where id = v_c;
        end if;
        delete from auth.users where id = v_u;
      end $$;`)
  }

  const filaDe = (n: string): string => sqlLocal(
    `select coalesce((select a.agenda_v2_encendida::text || '/' || a.recordatorio_encendido::text || '/' || a.correo_reserva_clinica::text
                        from public.agenda_ajustes a where a.clinica_id = p.clinica_id), 'sin fila') || '|' || (p.clinica_id is not null)::text
       from public.profiles p where p.id = (select id from auth.users where email = :'correo');`, { correo: correoDe(n) })

  async function entrar(page: import('@playwright/test').Page, n: string): Promise<void> {
    await page.goto('/login')
    await page.getByLabel('Correo electrónico', { exact: true }).fill(correoDe(n))
    await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 })
  }

  test.afterAll(() => {
    sqlLocal('alter table public.agenda_ajustes drop constraint if exists ap1_e2e_imposible;')
    borrarMedico('uno'); borrarMedico('dos')
  })

  test('la clínica nueva nace con su fila: v2 encendida, recordatorio y correo a la clínica apagados', async ({ page }) => {
    crearMedicoSinClinica('uno')
    await entrar(page, 'uno')
    const r = await page.request.post('/api/me/clinica', { data: { nombre: 'Clínica AP1 uno' } })
    expect(r.status()).toBe(201)
    expect(filaDe('uno')).toBe('true/false/false|true')
  })

  test('si la fila de ajustes no se puede crear, la clínica se crea igual', async ({ page }) => {
    crearMedicoSinClinica('dos')
    /* Un CHECK imposible para toda fila NUEVA (NOT VALID: no mira las que hay). */
    sqlLocal('alter table public.agenda_ajustes add constraint ap1_e2e_imposible check (false) not valid;')
    try {
      await entrar(page, 'dos')
      const r = await page.request.post('/api/me/clinica', { data: { nombre: 'Clínica AP1 dos' } })
      expect(r.status()).toBe(201)
      expect(filaDe('dos')).toBe('sin fila|true')
    } finally {
      sqlLocal('alter table public.agenda_ajustes drop constraint if exists ap1_e2e_imposible;')
    }
  })
})
