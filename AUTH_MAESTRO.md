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

---

## 2 · DECISIONES DE ARQUITECTURA (aprobadas — no reabrir)

**D1 · Todo intento de auth del producto pasa por endpoints propios.**
El navegador deja de hablar con GoTrue para login/registro/recovery. El
servidor limita → autentica → resetea → audita → responde. R1 (producto)
muere por construcción.

**D2 · Entrega de sesión: tokens en el body + `setSession` en el
cliente.** El servidor valida credenciales con supabase-js puro (anon key,
sin adaptador de cookies) y devuelve `{ session }`; el cliente ejecuta
`supabase.auth.setSession(session)` y TODO lo demás queda idéntico:
AuthContext, SessionGuard, blindaje offline, secureStorage cifrado con
clave derivada de sesión, mirror engine, cookies de client.ts. Devolver
tokens por HTTPS es lo que GoTrue hace hoy; no es regresión. El modelo
full-SSR de cookies servidor es un refactor de sesión completo — otra
época, no este proyecto.
⚠️ Supuesto bloqueante a verificar en A0: que setSession dispare el mismo
onAuthStateChange que el login directo. Si no, SE DETIENE Y SE REDISEÑA.

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
verificar-receta). REVOKE a anon/authenticated: solo service role.

**D5 · El reset toca ÚNICAMENTE la ruta de email+IP.** Jamás
`auth:login_ip:*`, jamás rutas de recovery. R4 imposible por construcción:
la función recibe la ruta exacta y el servidor solo pasa esa.

**D6 · Fail-open declarado del limitador.** RPC caída → el intento procede
+ error ruidoso `[AUTH]` en logs. Fail-closed = nadie entra a Spinus
cuando Postgres estornuda; GoTrue mantiene sus propios límites detrás.
El fallo de autenticación NO es fail-open: ese error sí se devuelve.

**D7 · Perímetro honesto.** Nuestra API no puede impedir que un atacante
hable directo con GoTrue: la anon key es pública por diseño de Supabase.
El perímetro contra eso es de Supabase: límites nativos de /token
(inventariar en A1) + CAPTCHA aplicado por GoTrue (Etapa C) + protección
de contraseñas filtradas (toggle Pro). Nuestro módulo protege el flujo del
producto y a los usuarios entre sí. Venderse otra cosa sería seguridad
falsa.

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

### 3.1 SQL de la Etapa A

```sql
-- 20260803_auth_01_rate_limit_atomico.sql
CREATE OR REPLACE FUNCTION public.rate_limit_intento(
  p_clave text, p_ruta text, p_limite int, p_ventana_min int
) RETURNS TABLE (bloqueado boolean, restantes int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ruta));  -- serializa por clave
  DELETE FROM ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at < now() - make_interval(mins => p_ventana_min);
  SELECT count(*) INTO v_total FROM ip_rate_limits
   WHERE ruta = p_ruta
     AND created_at >= now() - make_interval(mins => p_ventana_min);
  IF v_total >= p_limite THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    INSERT INTO ip_rate_limits (ip, ruta) VALUES (p_clave, p_ruta);
    RETURN QUERY SELECT false, p_limite - v_total - 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rate_limit_reset(p_ruta text)
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH borradas AS (
    DELETE FROM ip_rate_limits WHERE ruta = p_ruta RETURNING 1
  ) SELECT count(*)::int FROM borradas;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_intento(text,text,int,int)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_reset(text)
  FROM anon, authenticated;
```
Aditiva pura: si nada la llama, nada cambia. Rollback = DROP ×2.

### 3.2 Contrato del endpoint de login (Etapa A)

```
POST /api/auth/login  { email, password }
 1. Validar body → normalizar email (credentials.ts)
 2. ip = ip.ts
 3. limiter: 'auth:login_ip:<ip>' (20/15min)
      bloqueado → audit acceso_denegado → 429 {kind:'limite-intentos'}
 4. limiter: 'auth:login_v2:<email>:<ip>' (5/15min)
      bloqueado → audit acceso_denegado → 429 {kind:'limite-intentos'}
    [orden IP→email cierra R8]
 5. credentials.verificar
      error credenciales → audit login_fallido → 401 {kind:'credenciales'}
      error otro → audit + 502 {kind:'servicio'}
 6. éxito → limiter.reset('auth:login_v2:<email>:<ip>')   [D5]
          → audit login_exitoso (user.id real)
          → 200 { session }
 7. RPC en try/catch → fail-open D6 con log [AUTH]
```

### 3.3 Cirugía en login/page.tsx (Etapa A)

Solo el interior de handleSubmit: fuera el fetch a rate-limit, sus dos
escapes y el signInWithPassword directo; dentro un fetch a
/api/auth/login con mapeo 429→'limite-intentos', 401→'credenciales',
red→mensaje de sin conexión (deja de ser bypass: sin red no hay login,
hoy tampoco — GoTrue necesita red). Éxito →
`await supabase.auth.setSession(data.session)` → mismo onAuthStateChange
de siempre → `window.location.href='/inicio'`. El signOut previo por
sesión residual se conserva. El fetch a audit-login del éxito se elimina
(el servidor ya auditó). submitLockRef, disabled, error persistente,
useId, aria, autoComplete: INTACTOS. Middleware: /api/auth/login entra en
la lista pública (una línea, inevitable).

---

## 4 · ETAPAS

### ETAPA A · Cimiento — login server-side (cierra R1-producto, R2, R3/A, R4, R6/B, R8, R9-email; R5 parcial)

- **A0 · Puntos ciegos (read-only, BLOQUEANTE).** (a) mecánica exacta de
  sesión en client.ts/AuthContext: ¿setSession dispara el mismo flujo que
  el login directo? (b) qué hace SessionGuard al montar; (c) forma exacta
  de la lista pública del middleware; (d) firma real de logAudit y del
  error de GoTrue credenciales-vs-otros; (e) que no exista ya
  /api/auth/login; (f) inventario de TODOS los call-sites de
  signInWithPassword del repo. Si (a) contradice D2 → STOP y rediseño.
- **A1 · Inventario del perímetro Supabase (dashboard, sin código).**
  Valores reales de los rate limits nativos de Auth; disponibilidad de
  CAPTCHA y leaked-password-protection en el plan actual. Insumo de C.
- **A2 · SQL** (§3.1) por D-T6. Verificación manual: 3 llamadas con
  límite 2 → tercera bloqueada; reset limpia; REVOKE niega a anon.
- **A3 · Deploy 1.** Módulo lib/auth + endpoint + cirugía page.tsx +
  línea middleware. Matriz §6-A completa en PREVIEW antes de main.
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

### ETAPA C · Perímetro Supabase (cierra R1-GoTrue; casi todo es toggle)

- CAPTCHA: Cloudflare Turnstile (gratis) activado en GoTrue → el propio
  Supabase lo exige en /token; widget en las 4 pantallas; nuestros
  endpoints reenvían el captchaToken. Contingencia: es un toggle —
  desactivable en dashboard en segundos si algo falla.
- Leaked password protection (HaveIBeenPwned): toggle del plan Pro.
- Ajuste de límites nativos de Auth con el inventario de A1.
- Decisión explícita de Angel antes de activar cada uno.

### ETAPA D · Sesión e higiene NOM-024

- **Fix del logout que audita `login_exitoso`** (vocabulario canónico de
  audit.ts; corrige trazabilidad NOM-024). Prioridad alta dentro de D.
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

La 6 prueba (B); la 5 prueba R2; la 2 prueba (A)+R4. Ninguna la ve el
build. Método de sondeo sin service role: `remaining` del endpoint
(filas = límite − 1 − remaining sobre clave virgen).

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
