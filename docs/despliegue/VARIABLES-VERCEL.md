# Variables de Vercel — despliegue 1 (agenda v2)

> Agente B7, 2026-11-23. Fuente: `supabase/produccion/plan/PLAN-DE-APLICACION.md`
> §6.2, **comprobada contra el código**. Sólo nombres y formatos: **ningún valor
> real** aquí ni en ningún archivo. Los valores se generan en la terminal de Angel
> y se pegan en Vercel → Project → Settings → Environment Variables, entornos
> **Production y Preview** (ver abajo), como «Sensitive» las secretas.
>
> **Cambio del agente BP (2026-11-23), por «base primero» (plan §6.1):** Angel
> probará la rama en los **previews**, que apuntan a la base de PRODUCCIÓN, con la
> v2 encendida en su clínica. Por eso **las nuevas van TAMBIÉN en Preview, y
> `RESERVA_SECRETO` con el MISMO valor en los dos entornos.** Por qué: el código
> de cada enlace de reserva y de confirmación es un HMAC derivado de
> `RESERVA_SECRETO` y **la base sólo guarda su sha256**
> (`src/lib/reserva/secretos.ts:1-26`); con otro secreto, un enlace emitido en un
> entorno da otro código en el otro y no abre, y los seudónimos del candado
> (incidencias, contactos bloqueados por teléfono o correo) tampoco casan, así
> que el historial de lo probado en los previews se pierde al pasar a producción.
> Las que no deben existir en Production **tampoco en Preview**. Riesgos de los
> previews contra producción: `VENTANA-BASE-PRIMERO.md` §3.
>
> **Resultado de la comprobación: el plan y el código COINCIDEN.** No hay ninguna
> variable que el código nuevo lea y el plan no liste, ni al revés.

## Cómo se comprobó [C]

1. `git grep -h -oE "process\.env\.[A-Z_0-9]+"` en `src/` de `main` y de `HEAD`
   (`01269a9b`), y la diferencia (`comm`): sólo en la rama, **`CRON_SECRET`,
   `GCAL_FALSO_URL`, `RESERVA_SECRETO`, `VERCEL_ENV`**; ninguna sólo en `main`.
2. Además, las que se leen como `env.X` de un objeto de entorno (`process.env`
   pasado como argumento: `decidirTransporte(env)`, `rsvpGoogleEncendido(env)`,
   `avisoPublicable(env)`): sólo en la rama, **`EMAIL_TRANSPORT`,
   `AGENDA_RSVP_GOOGLE`, `MAILPIT_URL`, `RESERVA_AVISO_BORRADOR_LOCAL`, `VERCEL`**.
3. Acceso con corchetes: el único `process.env[v]` es el de
   `src/app/api/google/connect/route.ts:44-45`, sobre `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI`, que ya usa `main`.
4. Fuera de `src/`: `git diff main...HEAD` no toca `next.config.ts`,
   `instrumentation-client.ts` ni `sentry*`; sí `.env.example` (documenta
   `EMAIL_TRANSPORT`, `MAILPIT_URL`, `RESERVA_SECRETO`, `CRON_SECRET`) y
   `vercel.json` (añade las dos tareas programadas).

Las nueve nuevas = las cuatro del plan §6.2 «nuevas» + las tres «no deben existir»
+ las dos que pone Vercel solo. Cuadra.

## 1. Nuevas que SÍ se ponen

| Nombre | ¿Nueva? | Formato y cómo generarla (sin valores) | Cuándo se pone | Qué pasa si falta | Origen en el código |
|---|---|---|---|---|---|
| **`CRON_SECRET`** | sí | cadena no vacía; se compara `Authorization` con `Bearer <CRON_SECRET>` en tiempo constante. Generar con `openssl rand -hex 32`. Secreta | **⚠️ ANTES de desplegar** el día del código (plan §4-bis C0 y §6.3): las dos tareas de `vercel.json` (`google-sync` cada 10 min, `recordatorios` cada 15) **nacen con el despliegue a producción**. En Preview no hace falta: Vercel no ejecuta tareas en los previews («Cron jobs run only on production deployments», *Managing Cron Jobs*, leída el 2026-11-23); ponerla no hace daño | `/api/cron/google-sync` y `/api/cron/recordatorios` responden **401** y no hacen nada; hay que ponerla y volver a desplegar | `src/lib/cronAutorizacion.ts:20-24`; rutas `src/app/api/cron/*/route.ts` |
| **`RESERVA_SECRETO`** | sí | hexadecimal, **≥ 64 caracteres y longitud par**, sólo `[0-9a-f]` (se recorta y pasa a minúsculas); si no cumple, cuenta como ausente. Generar con `openssl rand -hex 32` **una sola vez** y guardarla en el gestor de contraseñas. Secreta. **Rotarla invalida todos los enlaces y el historial del candado** | **en Preview ANTES de encender la v2 para los previews** (plan §4 paso 8) y en Production antes del despliegue del día del código, **con el MISMO valor** (arriba, por qué). Vercel sólo aplica una variable a los despliegues posteriores: tras ponerla, volver a desplegar el preview | falla cerrado: no se emiten enlaces de reserva ni de confirmación y el recordatorio no sale; con la v2 apagada no se nota | `src/lib/reserva/secretos.ts:38-42` |
| **`EMAIL_TRANSPORT`** | sí | el literal **`resend`**. Exige además `RESEND_API_KEY` y una `NEXT_PUBLIC_SUPABASE_URL` `https` remota; vacío o cualquier otro valor = apagado | Production: antes del despliegue del día del código. **Preview: decisión de Angel** — con `resend`, los correos de la agenda de un preview salen a pacientes reales y sus enlaces usan `NEXT_PUBLIC_APP_URL` de Preview (con el dominio de producción llevan a `main`, que no tiene `/confirmar`): `VENTANA-BASE-PRIMERO.md` §3 | apagado: los correos de la agenda no salen (nada falla). Las rutas viejas (registro, invitación…) siguen llamando a Resend directo y NO la leen (`.env.example`) | `src/lib/correo/transporte.ts:127-136` |

## 2. Nueva que se deja SIN DEFINIR

| Nombre | ¿Nueva? | Formato | Cuándo se pone | Qué pasa si estuviera |
|---|---|---|---|---|
| **`AGENDA_RSVP_GOOGLE`** | sí | sólo el literal exacto `encendido` la enciende; ausente, vacía o cualquier otro valor = apagada (`src/lib/gcalRsvp.ts:21-23`) | **NO en este despliegue, ni en Production ni en Preview.** `encendido` sólo después de probar Google real (RSVP) en la clínica de Angel (plan §6.2 y §13) | con `encendido`, confirmaría citas por la respuesta a la invitación de Google sin haberlo probado contra Google real |

## 3. Las que NO deben existir en producción (ni en Preview)

Con los previews contra la base de producción, esta tabla vale igual para el
entorno **Preview**.

| Nombre | Por qué no | Qué haría si estuviera (comprobado leyendo) |
|---|---|---|
| `GCAL_FALSO_URL` | apunta al Google falso de las e2e | nada: `rootUrlGoogleFalso()` la ignora con `NODE_ENV=production`, con `VERCEL_ENV=production`, si no es local y si la Supabase no es local (`src/lib/gcalFalso.ts:38-46`). Igual no se pone |
| `MAILPIT_URL` | buzón de pruebas local | sólo se lee con `EMAIL_TRANSPORT=captura` y sólo si es loopback (`src/lib/correo/transporte.ts:144-155`) |
| `RESERVA_AVISO_BORRADOR_LOCAL` | abre la reserva con el aviso PENDIENTE DE REVISIÓN LEGAL, sólo en local | nada en Vercel (`VERCEL=1`) ni con Supabase remota (`src/lib/reserva/avisoReserva.ts:88-93`). Igual no se pone |
| `EMAIL_TRANSPORT=captura` | manda los correos a Mailpit | los correos no saldrían a nadie de verdad |
| `AGENDA_RSVP_GOOGLE=encendido` | falta la prueba con Google real | ver §2 |

## 4. Las que pone Vercel solo (no se definen a mano)

| Nombre | Quién la lee | Para qué |
|---|---|---|
| `VERCEL` | `src/lib/reserva/avisoReserva.ts:91` | con `1`, la excepción local del aviso no existe |
| `VERCEL_ENV` | `src/lib/gcalFalso.ts:41` | con `production`, el Google falso no existe |
| `NODE_ENV` | varias (la pone el build) | — |

## 5. Las que ya usa `main` (siguen igual)

Que estén puestas es **[D]**: `main` funciona en producción. `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_HOOK_SECRET`,
**`NEXT_PUBLIC_APP_URL`** (los enlaces de los correos y de la reserva salen de aquí:
tiene que ser el dominio de producción), **`RESEND_API_KEY`** (la exige también
`EMAIL_TRANSPORT=resend`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_SECRET`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, las ocho `STRIPE_PRICE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH`,
`NEXT_PUBLIC_LOGIN_SERVIDOR`, `TZ`. [C: lista sacada con el `git grep` de arriba;
coincide con la del plan §6.2.]

## 6. Lo que el repo NO puede comprobar

- Que las variables estén puestas en el panel, ni con qué valor ni en qué entorno
  [D: hay que mirarlo en Vercel].
- ~~Que las previews no usen la agenda v2~~ *(sustituido el 2026-11-23: SÍ la
  usan, en la clínica de Angel; por eso las nuevas van también en Preview, con el
  mismo `RESERVA_SECRETO`).* Qué tiene hoy el entorno Preview (en particular
  `NEXT_PUBLIC_APP_URL`, `GOOGLE_TOKEN_SECRET` y la llave de servicio) [D: hay que
  mirarlo en el panel].
- Que Vercel mande `Authorization: Bearer <CRON_SECRET>` a las tareas (lo dice la
  documentación de Vercel Cron Jobs citada en `mejora_agendaV2.md`; no releída por
  este agente). Se verifica tras el despliegue: Schedules → Cron Jobs → View Logs,
  la primera invocación en 2xx.

## Nota sobre `maxDuration` (no es una variable, pero va en el mismo panel)

Plan §4 paso 4: Fluid Compute **activado** y ningún «Function Max Duration» de
proyecto menor que 300 s. En el código sólo tres rutas declaran `maxDuration`
[C, `git grep "maxDuration *="`]: `/api/cron/google-sync` 60,
`/api/cron/recordatorios` **120** (desde `24eb9910`) y `/api/google/sync` 30.
`supabase/produccion/ensayo/ORDEN-Y-REVERSA.md` §5.4 dice «los dos crons 60 s»:
es anterior a `24eb9910` y está desfasado en el de recordatorios.
