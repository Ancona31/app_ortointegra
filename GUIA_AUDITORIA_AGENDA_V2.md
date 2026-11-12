# Guía corta — auditar la agenda v2 en local

Para Angel. Todo lo de aquí corre en tu máquina: base de Docker, Google
**falso**, correos capturados en Mailpit. Nada toca producción, Vercel ni una
cuenta real de Google. Contexto completo: `mejora_agendaV2.md` (§6-bis
decisiones, §7 lo que te toca, «Lo que no se pudo probar en local» al final)
y `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` (auditoría del conjunto de
migraciones).

## 1. Requisitos

| Qué | Versión | Nota |
|---|---|---|
| Docker | el de siempre | el stack `supabase_*_app_ortointegra` levantado |
| Supabase CLI | **2.117.0** | la 2.95.4 fijada en `CLAUDE.md` no lee `supabase/config.toml` (`local_smtp`); ver la nota de `LOCAL_DEV.md` §2. Aquí se usó la de fnm: `~/.local/share/fnm/node-versions/v24.19.0/installation/lib/node_modules/supabase/node_modules/@supabase/cli-linux-x64/bin/supabase` |
| Node | 24.x | probado con 24.15.0 |

Antes de nada, comprueba que todo apunta a la base local:
`grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local` debe dar `http://127.0.0.1:54321`,
y `supabase/.temp/` no debe tener `project-ref` (proyecto sin enlazar).

## 2. Base local desde cero, migraciones y semilla

Desde `~/proyectos/app_ortointegra-agenda` (rama `feature/agenda-v2`):

```bash
SB=<ruta de la CLI 2.117.0>
$SB db reset --local                 # borra la base LOCAL y aplica las 21 migraciones en orden (~50 s)
docker exec supabase_db_app_ortointegra psql -U postgres -Atc \
  "select count(*), max(version) from supabase_migrations.schema_migrations"   # → 21|20261116120000
npx tsx scripts/agenda-semilla.ts    # datos inventados (~2 s); su candado aborta si la URL no es local
```

- `--local` es obligatorio en la cabeza: nunca `--linked` ni `--db-url`.
- El aviso `no files matched pattern: supabase/seed.sql` es normal (no hay seed.sql).
- El reset **recrea los contenedores** con las imágenes que fija la 2.117.0
  (en el cierre: Postgres 17.6.1.167 en vez del 17.6.1.084 que corría, y otra
  storage-api).
- ⚠️ La base local es la misma para los dos worktrees. Este reset deja sólo las
  migraciones de esta rama: las tres `20261014*` de
  `feature/limites-ajustables` ya no están en la base. Para volver a tenerlas
  junto con las de la agenda, aplica el conjunto combinado (main + limites +
  agenda) con `--workdir` desde un directorio que tenga las 24 en
  `supabase/migrations/` (es lo que se hizo en la auditoría del conjunto,
  §4 de `AUDITORIA-CONJUNTO-AGENDA-V2.md`).

## 3. Variables de `.env.local` (sólo nombres; los valores ya están puestos)

| Variable | En local | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | la Supabase local | base |
| `EMAIL_TRANSPORT` | `captura` | todo correo de la agenda va a Mailpit; `resend` sólo vale con Supabase remota |
| `RESERVA_SECRETO` | cualquiera largo | deriva los códigos de enlace de reserva y de confirmación; rotarlo invalida todos los enlaces y el historial del candado |
| `RESERVA_AVISO_BORRADOR_LOCAL` | `1` | deja abrir el enlace de reserva con el aviso de privacidad SIN aprobar, sólo con Supabase local y fuera de Vercel |
| `CRON_SECRET` | cualquiera | autoriza `/api/cron/google-sync` y `/api/cron/recordatorios`; sin ella, 401 |
| `GOOGLE_TOKEN_SECRET` | la local | cifra los tokens; las e2e de Google la leen |
| `AGENDA_RSVP_GOOGLE` | sin poner | E9 apagado (sólo `encendido` lo enciende) |

⚠️ Seis rutas viejas (registro, reset-password, email-hook,
reenviar-confirmacion, enviar-documento, admin/invitar) llaman a Resend
directamente con `RESEND_API_KEY`: si la llave de `.env.local` es real, esas
rutas mandarían correo real. Ninguna prueba las dispara; no las uses a mano en
local (DEUDA_TECNICA.md, AG-DT-16).

## 4. Arrancar la app

```bash
npm run build && npx next start -p 3001     # lo que usan las e2e (globalSetup aborta si el build es más viejo que src/)
```

- **Google falso:** sólo existe dentro de las e2e que lo necesitan
  (`agenda-google-dos-sentidos`, `reserva-google`): cada una lo arranca en su
  proceso y levanta su propio `next dev --webpack -p 3002` con
  `GCAL_FALSO_URL`. El desvío no se abre nunca con `NODE_ENV=production` (o
  sea, nunca en `next start`) ni con una Supabase remota. Para verlo en el
  navegador: `npx playwright test e2e/reserva-google.e2e.ts --project=escritorio --headed`.
- **Mailpit** (correos capturados): http://127.0.0.1:54324
- **Studio** local: http://127.0.0.1:54323

## 5. Encender la agenda v2 en una clínica

Nace apagada. Sólo `postgres` puede encenderla (disparador
`trg_agenda_ajustes_proteger`):

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "
  insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida)
  select id, true from public.clinicas where nombre = 'Clínica Semilla A'
  on conflict (clinica_id) do update set agenda_v2_encendida = true;"
```

Apagar: lo mismo con `false`. Ojo: cada corrida de Playwright apaga todos los
interruptores al empezar (`globalSetup`) y resiembra.

Con v2 encendida aparecen: `/agenda/configuracion` (ajustes, tipos de cita,
disponibilidad, enlaces de reserva, contactos bloqueados), la burbuja y la
tarjeta, el aviso de empalme, «Por ligar», «Por confirmar», WhatsApp manual y
la sincronización de vuelta con Google. Rutas públicas nuevas (sin sesión):
`/reservar/{código}`, `/api/reservar/{código}`, `/confirmar/{código}` y
`/api/confirmar/{código}`; tareas: `/api/cron/google-sync` y
`/api/cron/recordatorios` (con `Authorization: Bearer $CRON_SECRET`).

## 6. Cuentas sembradas

Contraseña de todas: la constante `CONTRASENA` de `scripts/agenda-semilla.ts`
(ficticia, sólo local).

| Correo | Rol | Clínica |
|---|---|---|
| `admin.a@semilla.spinus.test` | médico administrador | Clínica Semilla A (VIP) |
| `medico.a@semilla.spinus.test` | médico invitado | Clínica Semilla A |
| `secretaria.a@semilla.spinus.test` | secretaria | Clínica Semilla A |
| `admin.b@semilla.spinus.test` | médico administrador | Clínica Semilla B (free virgen) |

Detalle de lo sembrado (≈350 citas en A, 17 en B, los cinco estados, citas
fuera de horario, eventos sin paciente): `scripts/agenda-semilla.md`.

## 7. Las pruebas

| Batería | Comando | En el cierre |
|---|---|---|
| Build | `npm run build` | limpio |
| Lint | `npm run lint` (no con Playwright corriendo) | 96 errores, los de `main` |
| Vitest | `npm run test` | 1684 en 112 archivos |
| SQL | `bash scripts/pruebas-sql.sh` | 17 archivos (cada uno en rollback) |
| Playwright | `npx playwright test` (con `next start` en :3001) | 244 pasan (escritorio 204, teléfono 37, tableta 3), ~8 min |
| Sólo un archivo | `npx playwright test e2e/reserva-enlace.e2e.ts --project=escritorio` | — |
| Carreras | `bash scripts/reserva-carrera.sh`, `bash scripts/confirmacion-carrera.sh` | en verde |

Las cifras exactas antes y después del reinicio desde cero están en
`mejora_agendaV2.md` §9, «Cierre del proyecto».

## 8. Capturas, vídeos y comparativa de F

Fuera de git (`e2e/resultados/` está en `.gitignore`), en este worktree:
`e2e/resultados/F/` — `antes/`, `despues/` (51 capturas), `despues/v2/` (82),
vídeos en `despues/video/` y `despues/v2/video/`, y la comparativa en
`e2e/resultados/F/comparativa/index.html` (ábrela en el navegador). Los planes
de diseño de cada bloque (`e2e/resultados/plan_C.md`, `plan_D.md`,
`plan_E.md`) también viven ahí, fuera de git.

## 9. Lo que NO se prueba aquí

Google real, texto legal, Vercel (variables, tareas programadas, Preview),
`select version()` de producción, rendimiento en un teléfono real… La lista
completa está al final de `mejora_agendaV2.md` («Lo que no se pudo probar en
local»), y tus pasos en §7.
