# SPINUS — DOCUMENTO MAESTRO · Módulo de autenticación

**Versión:** 1.0 — consolida y SUSTITUYE a PLAN_LOGIN_SEGURO.md
**Fecha:** 3 de agosto de 2026
**Objetivo:** un módulo de auth propio de primer nivel sobre Supabase —
capacidad comparable a Clerk, sin costo por usuario, sin migrar identidad,
con las RLS de Etapa 5 intactas.

---

## 0 · PARA EL ASISTENTE QUE LEE ESTO

Este documento sustituye una sesión completa de planeación y una auditoría
de seguridad ya ejecutada. No necesitas contexto adicional para operar.
Léelo entero antes de proponer nada.

**Qué es Spinus:** SaaS de expediente clínico electrónico (PWA) para
médicos privados en México. Solo desarrollador: Dr. Ángel M. Ancona Pérez.
Fase beta, pre-lanzamiento. Stack: Next.js 16.2.1, React 19, Tailwind 4,
TypeScript 5, Supabase (Postgres+Auth+Storage+RLS), Stripe, Vercel, Resend.
Marco regulatorio en curso: NOM-024-SSA3-2012 (prioridad máxima
pre-lanzamiento) y LFPDPPP.

**Estado del que parte este proyecto:**
- El REDISEÑO VISUAL de /login está terminado y en producción (main
  b83cc49): sistema visual --lp-*, cerrojo de doble envío submitLockRef,
  accesibilidad completa. NO SE TOCA nada de eso salvo el interior de
  handleSubmit.
- Una AUDITORÍA de seguridad (2026-08-03) encontró que el limitador de
  intentos es decorativo y el flujo de auth tiene defectos estructurales.
  Resumen en §1. La auditoría completa vive en el historial de la sesión
  del 2026-08-03; sus referencias archivo:línea son de main b83cc49.
- Dos MEDICIONES en producción cierran incógnitas de diseño (§1.3).

**Metodología (obligatoria, idéntica al resto del repo):**
- Respuestas breves. Un paso a la vez; nada avanza sin confirmación de
  Angel.
- Ningún código sin: investigación read-only → plan → auditoría de ojos
  frescos → "sin bloqueantes" → aplicación → validación → smoke → commit
  de Angel.
- Claude Code NUNCA hace commit/push/cambio de rama. Angel commitea tras
  validar en dev server.
- SQL de producción: protocolo D-T6 — SQL Editor, una query a la vez,
  validar cada resultado, smoke después.
- Validación de código: `npm run build && npx tsc --noEmit && npx eslint .`
  (en Mac los tres; en WSL también corren los tres DENTRO de WSL —
  corregido 2026-08-01, ver SPINUS_LANDING_MAESTRO.md:35-47).
- ESLint acotado a archivos tocados cuando el número global esté
  contaminado por otras ramas. Ojo: login/page.tsx está FUERA del análisis
  del compilador de React por el try/finally del cerrojo (LP-DT-44) — un
  número que "mejora" ahí es cobertura perdida, no progreso.
- Ante desacuerdo o dato faltante: investigar antes de ceder o repetir la
  pregunta. Angel valora el desacuerdo fundamentado.

**Ramas:** una POR ETAPA (no una para todo el proyecto): auth-a, auth-b,
auth-c… Cada etapa cierra mergeando a main con su matriz de pruebas
completa. Un proyecto de semanas en una sola rama = divergencia
inmanejable con producción.

---

## 1 · BASE DE EVIDENCIA

### 1.1 Riesgos confirmados por auditoría (2026-08-03, refs de main b83cc49)

| # | Riesgo | Evidencia clave |
|---|---|---|
| R1 | Limitador opt-in del cliente: el chequeo vive en el navegador (login/page.tsx:177) y signInWithPassword va directo a GoTrue (:211). Omitir el fetch = sin límite. Dos escapes escritos: navigator.onLine (:173) y catch permisivo (:194) | Crítica |
| R2 | Bloqueo de cuenta ajena: /api/auth/rate-limit es público (middleware.ts:63), acepta email arbitrario (route.ts:26). 5 POST = víctima fuera 15 min. Sin vía de desbloqueo en el producto | Crítica |
| R3/(A) | Login exitoso no descuenta: inserta al RECIBIR (rateLimit.ts:88), nada borra al acertar. Confirmado en vivo: 3 logins exitosos → 0 filas borradas | Alta |
| R4 | Un reset que toque la clave login_ip da reset ilimitado del cubo de IP a quien tenga UNA credencial válida | Alta (condicional al diseño del fix) |
| R5 | Ceguera: "limitador muerto" y "nadie ataca" producen la misma señal (silencio). Severidad info, techo 20 filas, sin alertas, sin tests | Alta |
| R6/(B) | count(:75-81)→insert(:88) no atómicos. Acotado hoy; PELIGROSO en cuanto exista DELETE por éxito | Media→Alta |
| R7 | Correos en claro en columna `ip`, limpieza lazy por clave, sin cron: PII sin retención (LFPDPPP) | Media |
| R8 | Cubo IP subcuenta: si email bloquea, route.ts:46 corta antes de :52 | Media |
| R9 | email: toLowerCase sin trim, asimétrico entre endpoints. IP: **REFUTADO** (ver 1.3) | Media / refutado |
| R10 | audit_log contaminable: audit-login público acepta email del body en login_fallido | Baja-Media |
| R11 | Cero tests del limitador | Baja-Media |

Colaterales confirmados en mediciones: cada LOGOUT escribe `login_exitoso`
(logout→logLogin({success:true})→audit.ts:132) — trazabilidad NOM-024
corrupta, 17 casos en 30 días. `/api/health` fuera de publicApiPaths →
307 a /login: monitoreo externo ciego. Un correo mal tecleado abre su
propio cubo (no gasta el de la cuenta real).

### 1.2 Qué NO se debe tocar (de la auditoría)

1. `submitLockRef` y `disabled={loading}` de /login (capas del doble
   envío; se revisan solo tras cerrar el flujo nuevo, con plan propio).
2. RLS deny-all de ip_rate_limits (patrón stripe_webhook_events). Ninguna
   escritura/limpieza desde cliente: todo por service role en servidor.
3. El 200 deliberado de recovery (anti-enumeración de cuentas) y su
   tratamiento simétrico en forgot-password.
4. `checkIpRateLimit` + api/r/[folio] (verificar-receta): comparten tabla,
   no el problema. Cualquier cambio de esquema los arrastra → por eso este
   plan NO cambia el esquema.
5. `checkRateLimit` (IA, tabla rate_limits): fuera de este proyecto.
6. logAudit de acceso_denegado: regla de CLAUDE.md, no se quita audit de
   ninguna acción.
7. Las policies RESTRICTIVE de Etapa 5 y clinica_tiene_acceso().
8. src/lib/supabase/admin.ts (service role): único camino de escritura.

### 1.3 Mediciones en producción (2026-08-03)

- **x-forwarded-for NO falsificable en Vercel.** 3 sondas contra
  spinus.com.mx con cabeceras inyectadas: el servidor registró siempre la
  IP real. `route.ts:27 [0]` es CORRECTO; se documenta en comentario que
  NO se cambie a [-1] (con proxy delante, [-1] sí sería del atacante).
- **Cookie de sesión: escrita por el SDK 2.4–3.6 ms después de la
  respuesta del token, 3/3 corridas.** Suficiente para probar el ORDEN,
  insuficiente para anclar nada a esa carrera → audit-login descartado
  como anclaje del reset. El reset vive en el servidor que acaba de
  autenticar, donde la sesión está confirmada por construcción.
- Un login llama /auth/v1/token de GoTrue directo desde el navegador (el
  flujo que este proyecto elimina).

### 1.4 Hallazgos colaterales de A0 (2026-08-05) — DEUDA A REGISTRAR, NO ARREGLAR AQUÍ

Encontrados de paso al verificar D2. **Ninguno bloquea la Etapa A y
ninguno se toca en este proyecto** — quedan anotados para que existan por
escrito y no se "descubran" otra vez.

1. **`setAll` de `client.ts:51-57` descarta las `options` que le pasa el
   SDK.** El adaptador de `@supabase/ssr` construye cada cookie con sus
   opciones (`cookies.js:177-188`), incluido el **`maxAge: 0`** de las
   cookies que pide BORRAR (chunks stale, `cookies.js:163-167`). Nuestro
   `setAll` ignora ese tercer argumento y reescribe todo con la misma
   cadena fija: **una cookie que el SDK quiso expirar se reescribe con
   valor `""` en vez de morir.** El descarte de `maxAge`/`expires` es
   deliberado y está comentado (cookies de sesión que mueren al cerrar la
   pestaña); el efecto sobre el BORRADO no está declarado en ningún sitio.
2. **`logAudit` acepta `userAgent` y lo tira.** Está en la interfaz
   (`audit.ts:77`) pero el `insert` no lo mapea (`audit.ts:84-91`: solo
   `user_id, accion, tabla, registro_id, ip, descripcion`). Los tres
   call-sites de `audit-login/route.ts` (`:20, :23, :28`) lo pasan y se
   pierde. **Relevante para el `audit.ts` del módulo (§3):** si se quiere
   user-agent —y NOM-024 lo agradecería— no basta con pasarlo; falta la
   columna o el mapeo.
3. **`sessionStorage.spinus_active` es bandera muerta.** Se escribe
   (`login/page.tsx:235`, `auth/callback/page.tsx:18`) y se borra
   (`auth-context.tsx:181`, `super-admin/Sidebar.tsx:49`), pero **ninguna
   línea del repo la LEE** (verificado por grep). El comentario de
   `client.ts:32-34` afirma que `SessionGuard` la usa como detector de
   "tab nuevo" para el auto-logout al cerrar el navegador: **es falso**,
   `SessionGuard.tsx` no la menciona. O el auto-logout al cerrar navegador
   no existe, o vive en otro sitio — sin determinar. No tocar sin decidir
   cuál de las dos.
4. **LATENCIA PERCIBIDA EN LOGIN Y LOGOUT — observación de Angel,
   2026-08-05.** Textual: *el login y el logout se sienten lentos; a veces
   hacen falta dos o tres clics para que respondan.* **Sin causa
   confirmada.** No la explica ninguno de los defectos hallados en la
   auditoría: el limitador no bloquea hasta el 6.º intento, y la fila
   duplicada del logout no añade latencia perceptible. Hipótesis abiertas:
   encadenamiento de peticiones, arranque en frío de las rutas de API en
   Vercel, o algo no auditado en el flujo de logout.
   **Se MIDE en A3** (línea base en producción, previa al deploy, repetida
   en A4) **y se DIAGNOSTICA en Etapa D** (auditoría del flujo de logout).
   Queda anotada aquí para que no se pierda si alguien lee solo esta
   sección.

---

## 2 · DECISIONES DE ARQUITECTURA (aprobadas — no reabrir)

**D1 · Todo intento de auth del producto pasa por endpoints propios.**
El navegador deja de hablar con GoTrue para login/registro/recovery. El
servidor limita → autentica → resetea → audita → responde. R1 (producto)
muere por construcción.

**D2 · Entrega de sesión: tokens en el body + `setSession` en el
cliente.** El servidor valida credenciales con supabase-js puro (secret
API key, sin adaptador de cookies — ver §3.2 y el corolario de D7) y
devuelve `{ session }`; el cliente ejecuta
`supabase.auth.setSession(session)` y TODO lo demás queda idéntico:
AuthContext, SessionGuard, blindaje offline, secureStorage cifrado con
clave derivada de sesión, cookies de client.ts. Devolver tokens por HTTPS
es lo que GoTrue hace hoy; no es regresión. El modelo full-SSR de cookies
servidor es un refactor de sesión completo — otra época, no este proyecto.

✅ **VERIFICADO EN A0 (2026-08-05). Ya no es un supuesto bloqueante.** La
versión anterior de este párrafo anclaba D2 en que `setSession` disparase
el mismo `onAuthStateChange` que el login directo. **Esa razón era
incorrecta** — y conviene dejar escrito por qué, para que nadie construya
sobre la premisa equivocada:

1. **La sesión persiste en COOKIES, no en localStorage.** `client.ts:35`
   declara `auth.storage = window.localStorage`, pero `@supabase/ssr` 0.9
   lo PISA: `createBrowserClient.js:42` escribe `storage` DESPUÉS de
   `...options?.auth`, con el adaptador cookie-only de `cookies.js:120-213`
   ("It only works on the cookies abstraction", comentario de la propia
   librería). En `localStorage` solo vive `spinus_session_meta`, que
   escribe a mano el AuthProvider (`auth-context.tsx:78-84`) — metadata
   propia, no la sesión.
2. **Solo hay UN suscriptor de `onAuthStateChange` en todo el repo**
   (`src/app/auth/callback/page.tsx:33`, confirmación de cuenta por
   enlace) y **no participa en el login**. `AuthContext` no se suscribe:
   resuelve con `getSession()` al montar (`auth-context.tsx:197-208`).
3. **D2 se sostiene por el reload, no por el evento.** El login termina en
   `window.location.href` (`login/page.tsx:249`): recarga completa de
   documento → el AuthProvider se destruye y se remonta leyendo
   `getSession()`; `SessionGuard` consume `AuthContext`; `secureStorage`
   deriva su clave de `document.cookie` (`secureStorage.ts:47-56`). **Todo
   relee cookies tras el reload.** Y `setSession` escribe exactamente las
   mismas cookies por el mismo `setAll` de `client.ts:51-57`, porque ambas
   rutas terminan en `_saveSession` → `storage.setItem`
   (`GoTrueClient.js:1575` vs `:650`), las dos con `await`.

El evento `SIGNED_IN` se emite igual en ambas rutas
(`GoTrueClient.js:1576` vs `:651`), pero es irrelevante aquí: nadie lo
escucha en este camino.

**D3 · Clave del cubo de login: `email+IP`** (`auth:login_v2:<email>:<ip>`).
El atacante que quema 5 intentos con tu correo bloquea SU par, no a ti →
R2 muere. El médico bloqueado se desbloquea cambiando de red (WiFi→datos),
vía de escape que hoy no existe. Costo declarado: fuerza bruta distribuida
multi-IP ya no la frena este cubo — la frenan el cubo por IP (20/15min),
los límites nativos de GoTrue y el CAPTCHA (Etapa C). El cubo por email a
secas nunca frenó al atacante serio (va directo a GoTrue) y sí bloqueaba a
la víctima: intercambio correcto.

**D4 · Atomicidad en Postgres.** RPC SECURITY DEFINER con
pg_advisory_xact_lock por clave: chequeo+inserción en una operación,
reset por ruta exacta. Sin cambio de esquema (no arrastra
verificar-receta). REVOKE a `PUBLIC` + anon/authenticated **y GRANT
explícito a service_role** (ver el recuadro de privilegios de §3.1: revocar
solo a anon/authenticated deja el RPC abierto vía PUBLIC).

> ### ⚠️ D4 · DOS PRECISIONES DE LA AUDITORÍA DE A2 (2026-08-05). NO SON OPCIONALES.
>
> **1 · El RPC se consume con `.rpc(...).single()`. SIEMPRE.**
> `rate_limit_intento` es `RETURNS TABLE`, es decir **set-returning**:
> PostgREST la expone como recurso tipo tabla y devuelve **un array**, no un
> objeto.
>
> ```ts
> const { data } = await supabase.rpc('rate_limit_intento', {...})
> // data === [{ bloqueado: false, restantes: 4 }]   ← ARRAY
> // data.bloqueado === undefined → falsy → NUNCA bloquea a nadie
> ```
>
> Sin `.single()`, `data.bloqueado` es `undefined`, el `if` no entra nunca,
> **el limitador deja pasar el 100 % de los intentos y no lanza ningún
> error**. No hay excepción, no hay log `[AUTH]`, D6 no se entera: es
> fail-open silencioso y permanente, indistinguible de "nadie está
> atacando". La función devuelve siempre exactamente 1 fila, así que
> `.single()` no puede fallar por cardinalidad.
> (`rate_limit_reset` sí es escalar — `RETURNS int` → `data` es un número.)
>
> **2 · Se ramifica por `bloqueado`, JAMÁS por `restantes`.**
> `restantes = 0` con `bloqueado = false` es el **último intento
> permitido**, no un bloqueo. Con límite 5 la secuencia es
> `4, 3, 2, 1, 0` permitidos y el 6.º devuelve `(true, 0)`. Leer
> `restantes === 0` como "bloqueado" adelanta el bloqueo un intento y
> castiga al médico legítimo en su último tiro válido.
> ✅ **VERIFICADO EN PRODUCCIÓN (2026-08-05).** El smoke test con límite 3
> devolvió `(false,2) (false,1) (false,0)` y solo el 4.º dio `(true,0)`:
> el `(false,0)` del tercero es exactamente el caso que un `if (!restantes)`
> rompería.
>
> Ambas viven también como `COMMENT ON FUNCTION` en la base, para que
> sobrevivan a este documento. La fila 15 de §6-A es la única prueba de la
> matriz que detecta el fallo de `.single()`.

**D5 · El reset toca ÚNICAMENTE la ruta de email+IP.** Jamás
`auth:login_ip:*`, jamás rutas de recovery. R4 imposible por construcción:
la función recibe la ruta exacta y el servidor solo pasa esa.

**D6 · Fail-open declarado del limitador.** RPC caída → el intento procede
+ error ruidoso `[AUTH]` en logs. Fail-closed = nadie entra a Spinus
cuando Postgres estornuda; GoTrue mantiene sus propios límites detrás.
El fallo de autenticación NO es fail-open: ese error sí se devuelve.

**D7 · Perímetro honesto.** Nuestra API no puede impedir que un atacante
hable directo con GoTrue: la anon key es pública por diseño de Supabase.
El perímetro contra eso es de Supabase: límites nativos de /token +
CAPTCHA aplicado por GoTrue (Etapa C) + protección de contraseñas
filtradas (toggle Pro, movida a Etapa B — ver A1). Nuestro módulo protege
el flujo del producto y a los usuarios entre sí. Venderse otra cosa sería
seguridad falsa.

✅ **D7 CERRADO CON UN NÚMERO (A1, 2026-08-05).** El límite nativo de
sign-ups y sign-ins es **30 requests / 5 min por IP = 360/hora**. Existe,
luego D7 no es una excusa; pero **360 intentos/hora desde una IP no frenan
un ataque paciente contra una cuenta concreta**. Esa es la magnitud real
del perímetro que NO controlamos, y es la razón por la que el CAPTCHA de
Etapa C no es opcional-decorativo. Inventario completo en la viñeta A1.

> ### ⚠️ COROLARIO DE D7 (A1, 2026-08-05) · IP ADDRESS FORWARDING
>
> **Estado hoy: APAGADO.** Y hoy da igual: el navegador llama directo a
> GoTrue, así que los límites nativos se aplican por IP del médico.
>
> **La Etapa A invierte eso.** Cuando el login se mueva al servidor,
> TODOS los intentos llegarán a GoTrue desde infraestructura de Vercel:
> GoTrue verá **una sola IP para todos los usuarios** y el límite de
> 30/5min pasará a compartirse entre ellos. Varios médicos entrando a la
> vez podrían agotarlo entre sí y recibir **429 de GoTrue sin haber hecho
> nada malo**.
>
> **Encender el IP forwarding es REQUISITO DEL DEPLOY DE LA ETAPA A
> (A3).** No es una decisión abierta ni un toggle suelto que se pueda
> dejar para después.
>
> **Por qué ese momento exacto y no otro:**
> - **Ni antes:** hoy no hace nada —no hay servidor que reenvíe IP— y
>   dejaría un cabo suelto encendido sin función.
> - **Ni después:** dejaría un hueco en producción durante el cual todos
>   los usuarios comparten una única IP ante GoTrue.
> - Además, encenderlo **obliga a que el endpoint llame a GoTrue con
>   secret API keys**: el forwarding solo se acepta en llamadas
>   autenticadas, porque si cualquiera pudiera declarar su propia IP el
>   límite de GoTrue se evadiría trivialmente. Ese requisito nace en el
>   mismo deploy en que el endpoint empieza a hablar con GoTrue.
>
> **Consecuencia de diseño:** el endpoint debe contemplar desde el inicio
> la llamada a GoTrue con **secret API key + cabecera de IP real**. El
> cliente supabase-js del servidor **ya no es "anon key a secas"** — ver
> §3.2. Contingencia en §7·C10.

**D8 · Estructura de módulo, no de parche.** La lógica vive en
`src/lib/auth/` como funciones puras reutilizables; los endpoints son
consumidores delgados. Login es el primero; registro, recovery y MFA
consumen las mismas piezas.

**D9 · Despliegue en dos pasos por etapa.** Cada etapa deja el camino
viejo vivo un ciclo de observación (24–48 h de producción verificada)
antes del deploy de limpieza. Revertir el deploy 1 devuelve SIEMPRE un
flujo completo y funcional.

---

## 3 · ARQUITECTURA DEL MÓDULO

```
src/lib/auth/
  limiter.ts     — intentoRateLimit(clave, ruta, límite, ventana) → RPC
                   resetRateLimit(ruta exacta) → RPC
                   Claves tipadas: construcción centralizada de rutas
                   (login_v2, login_ip, recovery, registro) para que un
                   typo no invente un cubo nuevo.
  credentials.ts — verificar(email, password) → supabase-js puro server.
                   Normalización ÚNICA: trim().toLowerCase() (R9-email).
                   Mapa de errores GoTrue → {kind} discriminado.
  session.ts     — forma del payload {session} que viaja al cliente;
                   más adelante: revocación global, timeout inactividad.
  audit.ts       — wrappers sobre logAudit existente con user_id real y
                   acciones canónicas (login_exitoso, login_fallido,
                   acceso_denegado, logout). Corrige el vocabulario que
                   hoy permite que logout se registre como login.
  ip.ts          — extracción de IP: x-forwarded-for[0] + comentario de
                   la medición 2026-08-03 y la prohibición de [-1].

src/app/api/auth/
  login/route.ts     (Etapa A)
  registro/route.ts  (Etapa B — ya existe server-side; migra al módulo)
  recovery/route.ts  (Etapa B — absorbe forgot/reset + reenviar-conf.)
  mfa/*              (Etapa E)

supabase/migrations/
  20260803_auth_01_rate_limit_atomico.sql   (Etapa A)
  [Etapa F] retención/limpieza programada
```

> ### 🚫 PROHIBIDO CREAR `src/lib/auth/index.ts` (A0, 2026-08-05)
>
> **Ya existe `src/lib/auth.ts`** — 56 líneas, `requireSuperAdmin` /
> `requireAdmin`, con **14 importadores** que hacen
> `import { requireSuperAdmin } from '@/lib/auth'` (todos bajo
> `src/app/api/super-admin/`).
>
> Los imports profundos que plantea este documento
> (`@/lib/auth/limiter`, `@/lib/auth/credentials`, …) **conviven sin
> ambigüedad** con ese archivo: el fichero y el directorio pueden
> coexistir. Lo que rompe la convivencia es un `index.ts` dentro del
> directorio: entonces `@/lib/auth` pasa a tener dos candidatos
> (`auth.ts` y `auth/index.ts`). La resolución probablemente seguiría
> eligiendo el archivo, pero "probablemente" no es un criterio aceptable
> en el módulo de autenticación.
>
> **Descartado renombrar `auth.ts` → `auth/guards.ts`:** toca 15 archivos
> fuera del scope de esta etapa. No se hace aquí.

### 3.1 SQL de la Etapa A

> ⚠️ **EL SQL YA NO VIVE EN ESTE DOCUMENTO (auditoría de A2, 2026-08-05).**
> Fuente única y literal:
> **`supabase/migrations/20260805_auth_01_rate_limit_atomico.sql`**
> — el archivo ES el bloque que se ejecutó en producción, sin recortes, más
> el smoke test verificado al final.
> ✅ **APLICADO Y VERIFICADO EN PRODUCCIÓN EL 2026-08-05** (PostgreSQL 17.6;
> resultados en la viñeta A2 de §4).
> El borrador que ocupaba esta sección quedó **APLICABLE CON CORRECCIONES**;
> duplicarlo aquí sería garantizar que las dos copias divergan. Lo que sigue
> es el porqué de las correcciones, no el código.

**Qué hace:** `rate_limit_intento(p_clave, p_ruta, p_limite, p_ventana_min)`
(chequeo+inserción atómicos, D4) y `rate_limit_reset(p_ruta)` (vaciado del
cubo, D5), más el índice `idx_ip_rate_limits_ruta_fecha (ruta, created_at)`
para el predicado real del RPC.

**Por qué hace falta el índice.** El RPC filtra SOLO por `ruta`; el índice
existente `idx_ip_rate_limits_ip_ruta_fecha` tiene `ip` como PRIMERA
columna, así que NO sirve a un predicado sin `ip` → seq scan en las tres
operaciones (DELETE de vencidas, COUNT de la ventana, chequeo previo al
INSERT). ⚠️ **EL ÍNDICE VIEJO NO SE TOCA:** lo sigue usando `rateLimit.ts`,
que sí filtra por `(ip, ruta)` — `checkAuthRateLimit` y `checkIpRateLimit`,
esta última compartida con verificar-receta (no-tocar #4). El pre-flight y
el post-flight de la migración lo verifican antes y después.

> #### 🔴 PRIVILEGIOS — el borrador de esta sección estaba MAL. No lo copies.
>
> El `REVOKE EXECUTE … FROM anon, authenticated` que aquí figuraba
> **dejaba el RPC abierto**. Tres hechos que hay que tener juntos:
>
> 1. **Postgres concede `EXECUTE TO PUBLIC` por defecto** a toda función
>    nueva. Revocar solo a `anon`/`authenticated` **no sirve de nada**:
>    los dos siguen pudiendo ejecutar heredando de `PUBLIC`. **El REVOKE
>    debe incluir `PUBLIC`.**
> 2. **Falta el `GRANT EXECUTE … TO service_role`, y su ausencia es el
>    peor fallo del módulo.** Supabase concede EXECUTE *directo* a
>    `anon`/`authenticated`/`service_role` vía `ALTER DEFAULT PRIVILEGES`
>    (documentado en `20260524_..._ts1a.sql:12-13`), pero eso es una
>    **suposición sobre configuración externa, no una garantía**. Si no se
>    cumple, tras el `REVOKE … FROM PUBLIC` el service role se queda **sin
>    EXECUTE** → `42501 permission denied` → **D6 se lo traga** → el
>    limitador queda en **fail-open PERMANENTE Y SILENCIOSO**. Ni un error
>    visible, ni un 429 nunca más. Re-conceder explícitamente convierte una
>    suposición en un hecho, por una línea.
> 3. **`CREATE OR REPLACE` NO restablece privilegios** — preserva la ACL y
>    el owner. Lo que sí los restablece a los defaults (incluido
>    `EXECUTE TO PUBLIC`) es un **`DROP` + `CREATE`**. Contra ese escenario
>    la defensa no es más REVOKE, es el **POST-FLIGHT** de la migración:
>    aborta la transacción si `anon`/`authenticated` conservan EXECUTE o si
>    `service_role` no lo tiene.
>
> El mismo bloque de la migración asserta además `owner = postgres`, sin el
> cual `SECURITY DEFINER` **no** bypasea el RLS deny-all de
> `ip_rate_limits` (mismo razonamiento que `20260522_etapa5c:6`).

**Otras cinco correcciones que incorpora el archivo** (todas cerraban en
fail-open mudo o en un hueco de privilegios):

- `SET search_path = public, **pg_temp**` — con `pg_temp` sin listar,
  Postgres lo busca PRIMERO y una tabla temporal puede secuestrar el nombre
  `ip_rate_limits` dentro de un SECURITY DEFINER owned by `postgres`. Es
  además la convención vigente del repo (5.C, ts1a); el borrador usaba la
  forma vieja de `baseline/05_functions.sql`.
- **Guardas de NULL/rango** en `rate_limit_intento`. Sin ellas
  `make_interval(mins => NULL)` → NULL → `(0 >= NULL)` es NULL → el `IF` lo
  trata como FALSE → **inserta y devuelve `restantes` NULL, sin error**. El
  fail-open de D6 vive en el `try/catch` del servidor, no dentro del RPC.
- **`pg_advisory_xact_lock(1789, hashtext(ruta))`** en vez de la forma de
  un solo `bigint`: espacio de claves privado del módulo, aislado del
  espacio global que comparten extensiones y procesos del sistema. (Una
  colisión de `hashtext` entre dos rutas produce **solo contención, jamás
  cuentas erróneas**: todos los predicados de fila filtran por
  `ruta = p_ruta`, no por el hash.)
- **`rate_limit_reset` rechaza por excepción toda ruta que no sea
  `auth:login_v2:%`**, y toma el mismo lock. Así **D5 pasa a ser cierto por
  construcción y no por convención**: tal como estaba, dependía de que
  `limiter.ts` nunca se equivocara de cadena, y un typo habría vaciado en
  silencio el cubo equivocado. ✅ **Verificado en producción contra su
  vector real (2026-08-05):** `rate_limit_reset('auth:login_ip:1.2.3.4')`
  → `EXCEPTION P0001`. R4 imposible desde la base.
- **`NOTIFY pgrst, 'reload schema';`** — convención del repo en 8
  migraciones, y aquí **funcionalmente obligatoria**: sin recarga del
  esquema PostgREST devuelve `PGRST202`/404 al `.rpc()` → D6 lo atrapa →
  fail-open silencioso otra vez.

**Aditiva pura:** si nada la llama, nada cambia. **Rollback:** bloque DOWN
comentado al final del propio archivo (`DROP` ×2 + `DROP INDEX` + `NOTIFY`).
Ojo: los tres DROP bastan para el esquema, pero las filas escritas por el
RPC quedan huérfanas — nada las lee y nada las purga. El DELETE opcional
está comentado en el DOWN, sin ejecutar, porque CLAUDE.md prohíbe DELETE en
producción sin decisión explícita.

### 3.2 Contrato del endpoint de login (Etapa A)

> ⚠️ **ACTUALIZADO POR A1 (2026-08-05) — EL CLIENTE DEL SERVIDOR NO ES
> "ANON KEY A SECAS".** Con el IP forwarding encendido en A3 (corolario de
> D7), la llamada del paso 5 a GoTrue debe hacerse con **secret API key**
> y **reenviando la IP real del médico** en la cabecera correspondiente.
> Sin la key secreta GoTrue ignora el forwarding — solo lo acepta
> autenticado, porque de otro modo cualquiera declararía su IP y evadiría
> el límite. Sin el forwarding, los 30/5min de GoTrue se comparten entre
> todos nuestros usuarios (fila 13 de §6-A lo prueba).
>
> Implicación operativa: la secret key es un secreto de servidor más,
> nunca alcanzable desde el cliente. `credentials.ts` es su único
> consumidor.

```
POST /api/auth/login  { email, password }
 1. Validar body → normalizar email (credentials.ts)
 2. ip = ip.ts
 3. limiter: 'auth:login_ip:<ip>' (20/15min)
      bloqueado → audit acceso_denegado → 429 {kind:'limite-intentos'}
 4. limiter: 'auth:login_v2:<email>:<ip>' (5/15min)
      bloqueado → audit acceso_denegado → 429 {kind:'limite-intentos'}
    [orden IP→email cierra R8]
 5. credentials.verificar   [secret API key + cabecera de IP real → GoTrue]
      error credenciales → audit login_fallido → 401 {kind:'credenciales'}
      429 de GoTrue (over_request_rate_limit) → 502 {kind:'servicio-limite'}
        [NO confundir con nuestro 429: son cubos distintos — §6-A fila 14]
      error otro → audit + 502 {kind:'servicio'}
 6. éxito → limiter.reset('auth:login_v2:<email>:<ip>')   [D5]
          → audit login_exitoso (user.id real)
          → 200 { session }
 7. RPC en try/catch → fail-open D6 con log [AUTH]
```

> ### ⚠️ PASOS 3, 4 y 6 — CÓMO SE LEE EL RPC (auditoría A2, 2026-08-05)
>
> Las tres llamadas al limitador usan **`.rpc(...).single()`** y ramifican
> por **`bloqueado`**, nunca por `restantes`. El razonamiento completo y el
> modo de fallo están en el recuadro de **D4**; aquí basta con que no se
> escriba `data.bloqueado` sobre un array.
>
> **No metas los pasos 3 y 4 en una sola transacción de base de datos.** Tal
> como está el contrato son dos `.rpc()` secuenciales = dos transacciones =
> un advisory lock vivo a la vez, sin orden que respetar. Un RPC único que
> tomara los dos locks (`login_ip` y `login_v2`) introduciría **riesgo real
> de deadlock por orden de adquisición**. Está anotado también en el
> `COMMENT ON FUNCTION`.

> ### 🔶 PASO 3 — EL CUBO `auth:login_ip:<ip>` YA EXISTE. ES COMPARTIDO, A PROPÓSITO.
>
> `checkAuthRateLimit` construye `ruta = 'auth:' + action + ':' + identifier`
> (`rateLimit.ts:73`). Con `action='login_ip'` (`rate-limit/route.ts:52`)
> produce **`auth:login_ip:<ip>`, con límite 20/15min**: la **misma cadena y
> los mismos límites** que el paso 3 de este contrato. El cubo de email sí se
> aisló (`login_email` → `login_v2`); **el de IP no**. No es un descuido a
> corregir: es la decisión.
>
> **DECISIÓN: NO renombrar.** Aislarlo a `login_ip_v2` daría al atacante
> **20 (viejo) + 20 (nuevo) = 40 intentos por IP** durante las 24–48 h de
> convivencia de D9 — debilitar R8 justo en la ventana de mayor exposición
> es peor que la limitación que se acepta abajo. Compartir el cubo es además
> lo semánticamente correcto: es el mismo límite conceptual.
>
> **Lo que se paga, escrito para que nadie lo descubra depurando
> contadores:**
>
> 1. **Durante D9, la atomicidad de D4 es PARCIAL, no total.** Cubre el cubo
>    `login_v2` (escritor único: el RPC). **NO cubre `login_ip`**, porque el
>    camino viejo hace `count → insert` **sin tomar el advisory lock**: un
>    intento por la vía vieja se cuela exactamente en la ventana que el lock
>    pretende cerrar. Cualquier afirmación de atomicidad total sobre ese cubo
>    es falsa hasta que A5 retire la acción `login_email` del endpoint viejo.
> 2. **Doble conteo con bundles rancios.** Un cliente con JS cacheado que aún
>    llame a `/api/auth/rate-limit` quema una fila de ese cubo; el endpoint
>    nuevo quema otra. El médico agota los 20/15min antes de lo esperado.
>    Tráfico residual, pero real durante la ventana.
> 3. **El `DELETE` del RPC borra filas escritas por el código viejo** (filtra
>    solo por `ruta`). Es inocuo — solo elimina vencidas de la misma ventana
>    de 15 min — pero explica por qué las cuentas no cuadran si se comparan
>    los dos caminos.
>
> Las demás rutas **no** colisionan: `auth:login_email:<email>`,
> `auth:registro:<ip>`, `auth:recovery:<email>` y `verificar-receta` son
> escritas solo por la vía vieja, y `auth:login_v2:<email>:<ip>` solo por la
> nueva.

### 3.3 Cirugía en login/page.tsx (Etapa A)

Solo el interior de handleSubmit: fuera el fetch a rate-limit, sus dos
escapes y el signInWithPassword directo; dentro un fetch a
/api/auth/login con mapeo 429→'limite-intentos', 401→'credenciales',
red→mensaje de sin conexión (deja de ser bypass: sin red no hay login,
hoy tampoco — GoTrue necesita red). Éxito →
`await supabase.auth.setSession(data.session)` → **comprobar su retorno
(ver abajo)** → `window.location.href='/inicio'`. El signOut previo por
sesión residual se conserva. El fetch a audit-login del éxito se elimina
(el servidor ya auditó). submitLockRef, disabled, error persistente,
useId, aria, autoComplete: INTACTOS. Middleware: /api/auth/login entra en
la lista pública (una línea, inevitable).

> ### ⚠️ REQUISITO NUEVO (A0, 2026-08-05) — HAY QUE COMPROBAR EL RETORNO DE `setSession` ANTES DE NAVEGAR
>
> **Esto no existe hoy y no es opcional.** `setSession` NO es equivalente
> punto por punto a `signInWithPassword`: con el token vigente hace una
> llamada de red EXTRA que el login directo no hace —
> `await this._getUser(currentSession.access_token)` →
> `GET /auth/v1/user` (`GoTrueClient.js:1563`) — y la hace ANTES de
> persistir.
>
> Modo de fallo que esto introduce: nuestro endpoint responde 200 con la
> sesión, la red cae en ese intervalo (o el `offlineAwareFetch` de
> `client.ts:14-19` la rechaza de plano porque `navigator.onLine === false`),
> el `_getUser` falla y `_setSession` retorna
> `{ data: { session: null, user: null }, error }` (`GoTrueClient.js:1565`)
> **sin guardar ni notificar nada**. Resultado: credenciales correctas,
> sesión válida emitida, NADA persistido, y el usuario aterriza en /inicio
> sin cookie → rebote del middleware, indistinguible de un fallo de login.
>
> Hoy nadie inspecciona ese retorno porque `signInWithPassword` no tiene
> esta rama. **Regla: si `setSession` no devuelve sesión, mostrar error y
> NO navegar.** El `submitLockRef` debe liberarse en esa salida (es un
> fallo, no una navegación).

---

## 4 · ETAPAS

### ETAPA A · Cimiento — login server-side (cierra R1-producto, R2, R3/A, R4, R6/B, R8, R9-email; R5 parcial)

- **A0 · Puntos ciegos (read-only, BLOQUEANTE).** (a) mecánica exacta de
  sesión en client.ts/AuthContext: ¿setSession dispara el mismo flujo que
  el login directo? (b) qué hace SessionGuard al montar; (c) forma exacta
  de la lista pública del middleware; (d) firma real de logAudit y del
  error de GoTrue credenciales-vs-otros; (e) que no exista ya
  /api/auth/login; (f) inventario de TODOS los call-sites de
  signInWithPassword del repo.
  ✅ **CERRADA — ejecutada el 2026-08-05.** No hubo STOP: **D2 quedó
  VERIFICADO**, aunque por una razón distinta a la que se suponía (ver el
  bloque de D2). Los seis puntos se resolvieron y sus hallazgos ya están
  incorporados al documento: la mecánica real de sesión en **D2**; el
  requisito nuevo de comprobar el retorno de `setSession` en **§3.3**; la
  prohibición del `index.ts` en **§3**; y la deuda colateral en **§1.4**.
  (b) SessionGuard, (c) `publicApiPaths`, (d) firma de logAudit y forma
  del error de GoTrue, (e) `/api/auth/login` no existe y (f) un único
  call-site de `signInWithPassword` (`login/page.tsx:211`): sin sorpresas.
- **A1 · Inventario del perímetro Supabase (dashboard, sin código).**
  ✅ **CERRADA — medida el 2026-08-05** (dashboard de producción, proyecto
  ortointegra, plan **PRO**).

  **Límites nativos de Auth** (Authentication → Rate Limits):

  | Límite | Valor medido | Lectura |
  |---|---|---|
  | **Sign-ups y sign-ins** | **30 / 5 min por IP** (360/hora) | **El perímetro real contra fuerza bruta directa a GoTrue.** Cierra D7 con un número: existe, pero 360 intentos/hora desde una IP no frenan un ataque paciente contra una cuenta concreta |
  | Token refreshes | 150 / 5 min por IP (1800/hora) | Holgado. Un consultorio con varios médicos tras la misma IP no choca |
  | Token verifications | 30 / 5 min | — |
  | Anonymous | 30 / hora | — |
  | Emails | 2 / hora | — |
  | SMS | 30 / hora | — |

  **Attack Protection — las dos disponibles en PRO, las dos APAGADAS hoy:**
  - **CAPTCHA: apagado.** Toggle disponible; el selector de proveedor
    aparece al encenderlo. Sigue en **Etapa C**.
  - **Prevent use of leaked passwords: DISABLED.** Toggle disponible.
    ⚠️ **MOVIDA A ETAPA B.** Actúa solo en alta y cambio de contraseña,
    **NO en login**: no protege a quien ya tiene una contraseña
    comprometida, así que su sitio es el registro, no el perímetro de
    acceso. Es **el cambio más barato del proyecto**: un toggle, cero
    código, cero riesgo para usuarios actuales.

  **IP Address Forwarding: APAGADO.** Deja de ser inocuo en cuanto la
  Etapa A mueva el login al servidor → **requisito del deploy A3**, con su
  razonamiento completo en el corolario de D7 (§2) y su consecuencia de
  diseño en §3.2.
- **A2 · SQL** — archivo
  `supabase/migrations/20260805_auth_01_rate_limit_atomico.sql` (§3.1).
  Auditado el 2026-08-05: **APLICABLE CON CORRECCIONES**, correcciones
  incorporadas al archivo. Dictamen aceptado por Angel.
  ✅ **CERRADA — APLICADA Y VERIFICADA EN PRODUCCIÓN EL 2026-08-05.**
  El post-flight pasó (2 funciones `SECURITY DEFINER`, `owner=postgres`,
  `anon`/`authenticated` SIN execute, `service_role` CON execute, índice
  nuevo creado e `idx_ip_rate_limits_ip_ruta_fecha` intacto — no-tocar #4).

  **Smoke test en producción — resultado íntegro** (copia literal al final
  del archivo de migración):

  | Prueba | Resultado | Qué prueba |
  |---|---|---|
  | intentos 1/2/3 con límite 3 | `(false,2) (false,1) (false,0)` | Aritmética de la rama permitida. **`(false,0)` es el ÚLTIMO PERMITIDO, no un bloqueo** — confirma en producción la regla de D4 |
  | intento 4 | `(true,0)` | El corte cae en el 4.º, ni antes ni después |
  | `reset` → intento posterior | `3` → `(false,2)` | El cubo se vació de verdad; el reset no es cosmético (D5) |
  | `rate_limit_reset('auth:login_ip:1.2.3.4')` | **`EXCEPTION P0001`** | **D5 probado contra su vector real**: el cubo por IP es exactamente lo que R4 querría vaciar, y la función lo rechaza. Prueba más fuerte que la de `verificar-receta` que preveía el plan |
  | `EXPLAIN` del COUNT por `ruta` | **`Index Only Scan using idx_ip_rate_limits_ruta_fecha`** | Ni Seq Scan ni Index Scan: sirve el predicado sin tocar el heap. **Cierra la salvedad de abajo sobre el Seq Scan no concluyente** |
  | residuo | `0 filas` | El smoke test no dejó basura en `ip_rate_limits` |
  | versión | **PostgreSQL 17.6** | Cierra la única afirmación que la auditoría marcó como NO verificada contra esta instancia: `make_interval(mins => ...)` existe desde PG 9.4. Deja de ser un supuesto |

  **Lo que A2 NO cierra y sigue vivo para A3:** el consumo correcto del RPC
  (`.rpc(...).single()` y ramificar por `bloqueado` — D4) es **código, no
  SQL**. La base está verificada; que `limiter.ts` la lea bien lo prueba la
  **fila 15 de §6-A**, no este smoke test.

  > ### 🔴 PROTOCOLO DE APLICACIÓN — NO FUE QUERY POR QUERY. Así se hizo y así se repite.
  >
  > **UNA sola corrida transaccional del archivo COMPLETO en el SQL Editor.**
  > Nada de ejecutar las funciones en una pestaña y los `REVOKE` en otra.
  > Así se aplicó el 2026-08-05 y así debe repetirse en cualquier reaplicación.
  >
  > **Por qué:** entre el `CREATE` de las funciones y el `REVOKE` existe una
  > ventana en la que **`anon` tiene EXECUTE** sobre dos funciones
  > `SECURITY DEFINER`, owned by `postgres`, **sin ninguna comprobación de
  > identidad dentro**. La anon key es pública por diseño (D7). En esa
  > ventana, cualquiera puede:
  > - llamar `rate_limit_intento` 20 veces con
  >   `ruta='auth:login_ip:<IP de la víctima>'` → **denegación de servicio
  >   dirigida contra el login de un médico concreto**;
  > - llamar `rate_limit_reset` para vaciar su propio cubo → el limitador
  >   deja de existir para el atacante.
  >
  > Y si el `REVOKE` falla, se olvida, o el operador cierra la pestaña,
  > **esa ventana no se cierra nunca**. Por eso el archivo va envuelto en
  > `BEGIN; … COMMIT;` con pre-flight y post-flight: si el post-flight
  > detecta que `anon` conserva EXECUTE, o que `service_role` no lo tiene,
  > **la transacción hace ROLLBACK y no queda nada aplicado**. Todo o nada.

  **El smoke test va en corrida APARTE**, después del `COMMIT` (resultados
  arriba). ⚠️ Sobre el `EXPLAIN`: si en una reaplicación saliera **Seq
  Scan** con la tabla casi vacía, **NO sería concluyente** — el planificador
  prefiere seq scan en tablas pequeñas y eso no prueba que el índice esté
  mal; habría que repetirlo con datos suficientes o forzar con
  `SET enable_seqscan = off`. **No hizo falta el 2026-08-05: salió Index
  Only Scan directo.**

  **El REVOKE no se verifica a mano:** lo assertan las cuatro
  comprobaciones de `has_function_privilege` del post-flight (anon y
  authenticated SIN execute, service_role CON execute), más `owner=postgres`
  y la supervivencia del índice viejo (no-tocar #4). Todas pasaron.
- **A3 · Deploy 1.** Módulo lib/auth + endpoint + cirugía page.tsx +
  línea middleware. Matriz §6-A completa en PREVIEW antes de main.

  📏 **PASO PREVIO AL DEPLOY — LÍNEA BASE DE LATENCIA (2026-08-05).**
  Antes de desplegar el endpoint nuevo, medir en **PRODUCCIÓN** el login
  actual: tiempo desde el clic en «Iniciar sesión» hasta la llegada a
  `/inicio`, **y desglose por petición** — las cuatro que hay hoy: 2×
  `/api/auth/rate-limit`, 1× GoTrue `/auth/v1/token`, 1×
  `/api/auth/audit-login`. **Mínimo 3 mediciones**, anotando en cada una
  si la ruta venía **fría o caliente**.

  *Razón:* Angel reporta (2026-08-05) **latencia percibida en login y
  logout — a veces necesita dos o tres clics para que responda**. **No hay
  causa confirmada**, y ninguno de los defectos hallados en la auditoría
  la explica: el limitador no bloquea hasta el 6.º intento, y la fila
  duplicada del logout no añade latencia perceptible. Hipótesis abiertas:
  encadenamiento de peticiones, arranque en frío de las rutas de API en
  Vercel, o algo no auditado en el flujo de logout.

  El endpoint nuevo **colapsa 4 peticiones del navegador a 1**, así que
  PODRÍA mejorarlo — pero **sin línea base no habrá forma de saberlo, y
  tampoco de detectar una regresión**. Repetir la misma medición en **A4**
  y comparar.
  ⚠️ **REQUISITO NO NEGOCIABLE (A1, 2026-08-05): encender el IP Address
  Forwarding EN ESTE MISMO DEPLOY**, ni antes ni después (razonamiento en
  el corolario de D7). Implica que el endpoint llame a GoTrue con **secret
  API key + cabecera de IP real** desde su primera versión — no es un
  añadido posterior, es parte del diseño de `credentials.ts` (§3.2). Sin
  esto, GoTrue ve una sola IP para todos los médicos y el límite de
  30/5min se comparte entre ellos. Lo prueban las filas **13 y 14** de
  §6-A; el modo de fallo, §7·C10.
- **A4 · Observación 24–48 h** en prod: logs [AUTH], audit_log, filas de
  login_v2 reseteándose. Criterio: cero 429 sobre legítimos, cero
  login_fallido inexplicado.
- **A5 · Deploy 2.** Retirar la acción login_email del endpoint viejo
  (400) + comentario del [0] en su lectura de IP. El endpoint viejo sigue
  vivo para recovery hasta Etapa B.

### ETAPA B · Las otras tres puertas (cierra R2-recovery, R10; absorbe reenviar-confirmacion)

- register, forgot-password y reset-password migran al módulo con el
  mismo patrón (server-side, limitador atómico, clave email+IP donde
  aplique, audit con vocabulario canónico).
- Preservar EXACTO el 200 anti-enumeración de recovery (no-tocar #3).
- Al cierre: /api/auth/rate-limit se retira por completo; audit-login
  queda SOLO para logout (hasta D).
- `/api/health` entra aquí: es la misma lista pública del middleware que
  ya se está editando con pruebas. Una línea, matriz lo cubre.
- **Leaked password protection (HaveIBeenPwned) — toggle del plan Pro.
  MOVIDA DESDE ETAPA C por A1 (2026-08-05).** Razón del traslado: actúa
  en alta y cambio de contraseña, **NO en login** — no protege a quien ya
  tiene una contraseña comprometida, así que pertenece al registro y no
  al perímetro de acceso. Es el cambio más barato del proyecto: un
  toggle, cero código, cero riesgo para usuarios actuales. Decisión
  explícita de Angel antes de activarlo.

### ETAPA C · Perímetro Supabase (cierra R1-GoTrue; casi todo es toggle)

- CAPTCHA: Cloudflare Turnstile (gratis) activado en GoTrue → el propio
  Supabase lo exige en /token; widget en las 4 pantallas; nuestros
  endpoints reenvían el captchaToken. Contingencia: es un toggle —
  desactivable en dashboard en segundos si algo falla.
- ~~Leaked password protection (HaveIBeenPwned)~~ → **MOVIDA A ETAPA B**
  por A1 (2026-08-05): actúa en alta y cambio de contraseña, no en login.
- Ajuste de límites nativos de Auth con el inventario de A1 — que ya está
  medido: sign-ups/sign-ins **30/5min por IP**, el número que justifica
  este CAPTCHA. Ver la viñeta A1 para la tabla completa.
- Decisión explícita de Angel antes de activar cada uno.

### ETAPA D · Sesión e higiene NOM-024

- **AUDITORÍA DEL FLUJO DE LOGOUT — nunca se ha hecho.** Va PRIMERA
  dentro de D, antes que cualquier corrección. El logout es parte del
  módulo de auth y **jamás ha sido revisado**: lo único que se sabe de él
  es que escribe dos filas en `audit_log` (el `logLogin` de más en
  `audit-login/route.ts:28` además del `logAudit('logout')` correcto de
  `:31`). **No se ha auditado** qué hace antes de redirigir, si espera a
  que terminen sus peticiones, ni de dónde sale la latencia que Angel
  reporta (§1.4·4).
  **La auditoría PRECEDE al fix:** primero se entiende el flujo completo,
  después se corrige. Incluye **medir la latencia real del logout** con el
  mismo método de la línea base de A3.
- **Fix del logout que audita `login_exitoso`.** Prioridad alta dentro de
  D. **Precisado en A0 (2026-08-05): NO es un problema de vocabulario.**
  El literal `'logout'` ya existe en la unión `AuditAccion`
  (`audit.ts:34`) y ya se emite correctamente. El defecto es una llamada
  DE MÁS: la rama `action === 'logout'` de
  `src/app/api/auth/audit-login/route.ts` invoca `logLogin({success:true})`
  (`:28`) — que resuelve a `'login_exitoso'` por el ternario de
  `audit.ts:132` — **ADEMÁS** del `logAudit({accion:'logout'})` correcto
  (`:31`). Cada logout escribe DOS filas en `audit_log`, una de ellas
  falsa. **El fix es retirar la llamada de más (`:28`), no añadir
  vocabulario.** Verificar de paso que ningún consumidor de `audit_log`
  dependa del par de filas.
- Timeout de inactividad (15–20 min, estándar clínico; ya en la lista de
  la auditoría de abril).
- "Cerrar sesión en todos los dispositivos" (signOut scope global de
  GoTrue) — palanca operativa ante credencial comprometida.

### ETAPA E · MFA (post-lanzamiento)

- TOTP nativo de GoTrue (enroll/challenge/verify) + UI de enrolamiento +
  códigos de respaldo + política (opcional al inicio; evaluar obligatorio
  para admin_clinica). La criptografía y el servidor los pone Supabase;
  el trabajo es UI y flujo.

### ETAPA F · Operación y retención

- R7: limpieza programada de ip_rate_limits (pg_cron o job) + evaluación
  de hashear la clave de email (PII) — aquí SÍ se contempla
  verificar-receta explícitamente (no-tocar #4).

  > ### 📈 CRECIMIENTO NO ACOTADO — LA ETAPA A LO EMPEORA (auditoría A2, 2026-08-05)
  >
  > La limpieza de `ip_rate_limits` es **lazy y por clave**: `rate_limit_intento`
  > solo purga vencidas **de la ruta que está atendiendo en ese momento**. Un
  > cubo que no se vuelve a visitar **no se purga jamás**. Nada más borra esa
  > tabla.
  >
  > **D3 multiplica la cardinalidad.** Antes la clave era `email`: el cubo de
  > un médico se limpiaba solo, la siguiente vez que entraba. Ahora es
  > `email+IP` (`auth:login_v2:<email>:<ip>`), así que **un mismo médico con
  > WiFi de consultorio, datos móviles y red de casa deja tres cubos**, y cada
  > uno solo se limpia si vuelve a entrar **desde esa misma IP**. Con IPs
  > móviles rotativas (CGNAT) esa segunda visita no ocurre nunca: **filas
  > huérfanas permanentes, una por intento**.
  >
  > No es un bloqueante de A2 y **no se arregla ahí**: un `DELETE` más amplio
  > dentro del RPC arrastraría a `verificar-receta` (no-tocar #4). Es
  > exactamente el trabajo de esta etapa. El índice
  > `idx_ip_rate_limits_ruta_fecha (ruta, created_at)` que crea A2 **abarata
  > la purga programada**, que puede barrer por ruta y fecha.
  >
  > Doble motivo para calendarizarla, no dejarla abierta: `ruta` guarda
  > **correo + IP en claro** (y `ip` recibe `p_clave`), o sea dato personal
  > con retención indefinida bajo la LFPDPPP vigente. Ya ocurre hoy
  > (`checkAuthRateLimit` mete el email en la columna `ip`) — **no es una
  > regresión de la Etapa A**, pero la Etapa A multiplica el volumen.
- R5 completo: métrica de intentos/bloqueos, severidad real (hoy info),
  alerta activa. "Limitador muerto" debe sonar distinto de "nadie ataca".
- R11: tests del limitador (la matriz §6 como suite repetible).
- Runbooks: desbloqueo manual, rotación ante incidente.

---

## 5 · GATE DE LANZAMIENTO

**Bloqueante pre-lanzamiento: Etapas A y B, más el fix del logout (D
parcial).** Con eso: ningún flujo de auth es opt-in, nadie bloquea cuentas
ajenas, el presupuesto se devuelve al acertar, y el registro de accesos
dice la verdad — lo que NOM-024 puede preguntar.
**Fuertemente recomendado pre-lanzamiento: C** (son toggles + un widget;
costo bajo, cierra el vector GoTrue directo).
**Post-lanzamiento: E y F** — con F.retención calendarizada, no abierta,
por LFPDPPP.

---

## 6 · MATRIZ DE PRUEBAS

### 6-A (Etapa A — obligatoria en preview antes de merge; ★ se repite en prod)

| # | Prueba | Esperado |
|---|---|---|
| 1★ | Login correcto (cuenta real) | 200, /inicio, sesión viva tras refresh, expediente abre |
| 2★ | Reset por éxito | Fila login_v2:<email>:<ip> desaparece; la de login_ip NO |
| 3 | 5 malas + 6.ª correcta | 6.ª=429; misma cuenta desde OTRA red con la correcta = entra |
| 4 | curl directo al endpoint ×6 | 6.º=429 servido por servidor |
| 5 | R2: curl con email de víctima ×5 desde IP A; víctima desde IP B | Víctima entra; bloqueado el par (email, IP A) |
| 6 | 6 curl en paralelo (xargs -P6) sobre par virgen límite 5 | EXACTAMENTE 5 aceptados / 1 bloqueado |
| 7 | Offline (DevTools) | Mensaje claro; sin crash; sin bypass |
| 8 | Sesión residual / banner ámbar | Igual que hoy |
| 9 | Doble clic + doble submit sintético mismo tick | 1 entrada, 1 petición (regresión del cerrojo) |
| 10 | forgot-password completo | Recovery intacto (endpoint viejo vivo) |
| 11★ | Enter, foco, reduced-motion | Sin regresión del rediseño |
| 12 | RPC caída simulada | Login procede + error [AUTH] en logs (fail-open verificado) |
| 13 | Varios logins legítimos casi simultáneos contra el endpoint nuevo (≥6 en paralelo, cuentas DISTINTAS) | Todos pasan; **ninguno recibe 429 de GoTrue**. Verifica que el IP forwarding funciona |
| 14 | El `{kind}` distingue el 429 de GoTrue (`over_request_rate_limit`) del 429 de nuestro limitador | Mensajes distintos. Hoy los dos se verían iguales para el usuario y el mensaje sería engañoso |
| 15 | **El 6.º intento contra un par (email, IP) virgen recibe 429.** 5 fallidos + 1 más, secuenciales, misma cuenta y misma red | **429 en el 6.º, servido por nuestro endpoint.** Los 5 primeros: 401. La única prueba que detecta el fallo de `.single()` (D4) |

La 6 prueba (B); la 5 prueba R2; la 2 prueba (A)+R4; **la 13 prueba el IP
forwarding de A3 y la 14 que no mintamos sobre de quién es el 429**.
Ninguna la ve el build. Método de sondeo sin service role: `remaining` del endpoint
(filas = límite − 1 − remaining sobre clave virgen).

> **Por qué la 15 no es redundante con la 3, la 4 ni la 6** (auditoría A2,
> 2026-08-05). Sin ella, el modo de fallo de `.single()` —el RPC devuelve un
> **array**, `data.bloqueado` queda `undefined`, el limitador **no bloquea
> nunca y no lanza error** (ver D4)— **sería invisible para toda la matriz**:
> la 3 y la 4 podían darse por buenas leyendo solo el 429 final sin
> comprobar que llega en el 6.º y no antes; la 6 mide concurrencia, no el
> corte; la 12 verifica el fail-open **deseado** (RPC caída), que es
> exactamente el aspecto que tendría el fail-open **accidental**. La 15 es
> secuencial y cuenta intentos a propósito: es la que distingue "el
> limitador funciona" de "el limitador está muerto y nadie lo nota".

### 6-B/C/D/E — se redactan al abrir cada etapa, con el mismo estándar:
ambos lados (el legítimo entra / el atacante no), evidencia numérica,
preview antes de prod. C añade: captcha inválido → GoTrue rechaza aunque
nuestro endpoint deje pasar. D añade: el logout audita `logout` y solo
`logout`. E añade: enroll+challenge+respaldo+pérdida de dispositivo.

---

## 7 · CONTINGENCIAS

- **C1 · Falla en prod tras cualquier deploy 1.** Vercel promote del
  deployment anterior. Instantáneo. Funciona porque D9 garantiza el
  camino viejo vivo hasta el deploy de limpieza.
- **C2 · Login 200 pero rebota a /login.** setSession no dejó el estado
  que SessionGuard/middleware esperan. Riesgo #1 del proyecto: A0 lo
  verifica en código, prueba 1 en preview. Si aparece en prod → C1 y
  rediseño de entrega de sesión. PROHIBIDO parchear en caliente sobre
  main.
- **C3 · Migración SQL falla.** Aditiva: el código viejo no la llama.
  Rollback DROP ×2, cero rastro. El deploy no sale hasta que A2 esté
  verificada a mano.
- **C4 · Angel se bloquea probando.** Vía 1: cambiar de red (la clave
  incluye IP). Vía 2: 15 min. Vía 3 runbook:
  `DELETE FROM ip_rate_limits WHERE ruta = 'auth:login_v2:<email>:<ip>';`
  en SQL Editor. Documentado aquí para no improvisarlo a las 2 a.m.
- **C5 · La línea del middleware rompe rutas.** Preview la cubre (toda la
  matriz pasa por él). 307 inesperado en prod → C1. El diff es una línea
  en una lista: revisable a ojo.
- **C6 · Fail-open activándose en silencio.** Imposible por diseño: cada
  activación escribe [AUTH] error. A4/B observan logs a diario;
  frecuencia alta → investigar antes del deploy de limpieza.
- **C7 · Hallazgo a mitad de implementación que contradice el plan.** Se
  detiene y se reporta. Ningún "lo resolví sobre la marcha" en auth.
- **C8 · CAPTCHA (C) bloquea legítimos.** Es un toggle de dashboard:
  desactivar, investigar, reactivar. Por eso C va después de A/B: el
  módulo funciona con y sin él.
- **C9 · MFA (E): pérdida de dispositivo.** Códigos de respaldo desde el
  día uno + runbook de des-enrolamiento por service role con verificación
  de identidad definida ANTES de activar MFA para nadie.
- **C10 · El IP forwarding (A3) falla.** Es un toggle de dashboard: se
  apaga en segundos. El efecto de apagarlo es que GoTrue vuelve a ver una
  sola IP para todos los usuarios y el límite de 30/5min se comparte entre
  ellos — **degradación, no caída**: los logins siguen funcionando y solo
  se estrecha el margen bajo concurrencia alta. Señal de que está pasando:
  429 de GoTrue sobre médicos legítimos (fila 13 de §6-A, y el
  `{kind:'servicio-limite'}` de §3.2 lo hace distinguible en logs en vez
  de confundirse con nuestro propio limitador).

---

## 8 · FUERA DE SCOPE DE ESTE PROYECTO (con destino)

- checkRateLimit de IA (tabla rate_limits, plans.ts:71) → proyecto propio.
- Refactor full-SSR de sesión (cookies servidor, retirar localStorage) →
  evaluar post-E, si alguna vez.
- Login con Google (OAuth) → estaba en la lista de prioridades de abril;
  cuando toque, entra por el módulo (D8) como un endpoint más.
- El error react-hooks/set-state-in-effect latente en login/page.tsx
  (LP-DT-44): sigue vivo e invisible al lint; se ataca si algún día se
  reestructura el blindaje — no aquí.

---

## 9 · CRITERIO DE CIERRE POR ETAPA

Una etapa cierra cuando: (1) su matriz está completa con evidencia
numérica; (2) su ventana de observación en prod pasó sin anomalías;
(3) su deploy de limpieza está aplicado; (4) DEUDA_TECNICA.md refleja lo
cerrado y lo diferido; (5) este maestro se actualiza con la sección
"Estado" al día. El proyecto cierra cuando A–D están cerradas y E–F
calendarizadas.
