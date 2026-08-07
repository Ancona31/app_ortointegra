# SPINUS — MÓDULO DE AUTENTICACIÓN · PLAN DEFINITIVO
## Versión 3.0 — CONSOLIDADO

**Fecha:** 7 de agosto de 2026
**Sustituye a:** AUTH_MAESTRO.md v1.0 y v2.0. Ambas quedan obsoletas.
**Regla de este documento:** cada punto está etiquetado **SE HACE** o **NO
SE HACE**. No existe "se evalúa después". Lo que no se hace, no se hace, y
está escrito por qué.

---

## 0 · CONTEXTO PARA QUIEN LEA ESTO

Spinus: SaaS de expediente clínico electrónico (PWA) para médicos privados
en México. Solo desarrollador: Dr. Ángel M. Ancona Pérez. Fase beta (~10
usuarios), pre-lanzamiento. Stack: Next.js 16.2.1, React 19, TypeScript,
Tailwind 4, Supabase **plan Pro**, Stripe, Vercel, Resend. Marco
regulatorio: NOM-024-SSA3-2012 y LFPDPPP.

**Metodología (obligatoria):** respuestas breves; un paso a la vez sin
avanzar sin confirmación de Angel; ningún código sin investigación
read-only → plan → auditoría independiente → aplicación → validación →
smoke → commit de Angel; Claude Code nunca hace commit/push/cambio de rama;
SQL de producción por protocolo D-T6 (SQL Editor, validando cada paso);
validación con `npm run build && npx tsc --noEmit && npx eslint .`.
Ante desacuerdo o dato faltante: **verificar antes de proponer.**

**Rama:** `feature/auth-a`.

---

## 1 · LA DECISIÓN DE FONDO

Supabase Auth (GoTrue) autentica a los médicos: contraseñas, tokens,
sesiones, recuperación. Eso no se toca ni se reimplementa — es su
infraestructura y es mejor que cualquier capa propia.

Las versiones 1 y 2 de este plan proponían construir un endpoint propio
(`/api/auth/login`) para que el limitador de intentos fuera imposible de
esquivar. **Descartado el 2026-08-07 por decisión de Angel**, con el
argumento correcto: poner una capa propia delante de un servicio de
autenticación robusto añade riesgo de romper el login por un escenario de
ataque improbable en este producto. Si el endpoint falla, nadie entra a
Spinus; el beneficio no compensa.

**Lo que sí se corrige es lo que es puerta propia**, no de Supabase: un
endpoint público que permite dejar a un médico fuera 15 minutos sin conocer
su contraseña. Eso no lo cubre Supabase porque es código de Spinus, y no
requiere habilidad para explotarlo.

**El perímetro contra ataque automatizado queda en Supabase**, con
configuración que hoy está apagada: límites nativos (30 intentos / 5 min
por IP, medidos 2026-08-05), CAPTCHA y rechazo de contraseñas filtradas.
Esas tres capas son lo que de verdad frena un ataque distribuido, y son
configuración, no código.

---

## 2 · CAPACIDADES DE SUPABASE — VERIFICADO EN EL PLAN PRO

Verificado contra el dashboard de producción y la documentación
(2026-08-05 y 2026-08-07). **No se planifica nada sobre capacidades no
verificadas.**

| Capacidad | Estado en tu plan | Hoy |
|---|---|---|
| MFA TOTP (app autenticadora) | ✅ Incluido, gratis | Encendido en el panel; falta la pantalla en la app |
| MFA por SMS | ⛔ Add-on de pago | Apagado — no se usa |
| Control de sesiones (caducidad, inactividad, sesión única) | ✅ Incluido | Sin configurar |
| CAPTCHA (bot protection) | ✅ Incluido | **Apagado** |
| Rechazo de contraseñas filtradas (HaveIBeenPwned) | ✅ Incluido | **Apagado** |
| Google OAuth | ✅ Incluido | Apagado |
| Vinculación automática de cuentas por email verificado | ✅ Por defecto | Activo por diseño de Supabase |
| Hooks: Send Email, Send SMS, Custom Access Token, Before User Created | ✅ Incluidos | Send Email en uso (Resend) |
| **Hook de intento de contraseña** | ⛔ **Teams/Enterprise ($599/mes)** | No disponible. Confirmado en el panel: "Team or Enterprise Plan required" |
| Límite de intentos **por cuenta** | ⛔ No existe de forma nativa | El límite nativo es por IP, no por cuenta |
| Bitácora de accesos a expedientes (NOM-024) | ⛔ No lo da ninguna plataforma | Es de la aplicación: `audit_log` de Spinus |

⚠️ **Matiz del control de sesiones:** las sesiones no se terminan de forma
proactiva al vencer; se limpian progresivamente hasta 24 h después. Si se
requiere cierre inmediato por inactividad, eso es trabajo del cliente.

---

## 3 · LO QUE SE HACE

Orden de ejecución. Los puntos 1 a 5 son **anteriores al lanzamiento**.

### 3.1 — Clave del limitador a `correo + IP` · SE HACE · PRE-LANZAMIENTO

**Problema que cierra:** hoy el contador de intentos cuelga solo del
correo. Cinco peticiones al endpoint público con el correo de un médico lo
dejan fuera 15 minutos, sin conocer su contraseña, y Spinus no ofrece
ninguna vía de desbloqueo.

**Cambio:** el identificador del contador pasa de `<email>` a
`<email>:<ip>`. La IP ya se lee en `route.ts:27` y se verificó en
producción (2026-08-05, tres sondas) que llega correcta y **no es
falsificable** en Vercel.

**Efecto:** el atacante llena su propio cubo, no el de la víctima. Y el
médico que se bloquea solo tiene salida real: cambiar de red (WiFi →
datos) le da un cubo limpio, cosa que hoy no existe.

**Costo declarado:** un atacante con muchas IPs distintas ya no choca
contra este muro. Contra eso están 3.2, 3.3 y el límite nativo de
Supabase. Es el intercambio correcto: el cubo por correo a secas nunca
frenó al atacante serio — ese habla directo con GoTrue y se salta la app —
y sí bloqueaba a la víctima.

**Alcance:** el identificador en `api/auth/rate-limit/route.ts`, y el
mapeo del error en `login/page.tsx`. No toca el flujo de sesión.
Verificación previa read-only obligatoria antes de escribir.

### 3.2 — CAPTCHA · SE HACE · PRE-LANZAMIENTO

Toggle en Authentication → Attack Protection (Cloudflare Turnstile, gratis)
+ widget en `/login` y `/register`. Lo aplica GoTrue **antes** de verificar
la contraseña, así que protege incluso a quien se salta la app: es la capa
efectiva contra ataque automatizado y distribuido.

Contingencia: es un toggle. Si bloquea a alguien legítimo, se apaga en
segundos desde el dashboard.

### 3.3 — Rechazo de contraseñas filtradas · SE HACE · PRE-LANZAMIENTO

Toggle en Attack Protection. Impide elegir contraseñas que aparecen en
listas de brechas conocidas. Actúa en alta y cambio de contraseña, no en
login: no afecta a nadie que ya esté dentro. Cero código, cero riesgo.

### 3.4 — Fix del logout que corrompe la bitácora · SE HACE · PRE-LANZAMIENTO

**No es seguridad, es cumplimiento.** `api/auth/audit-login/route.ts` llama
a `logLogin({success:true})` en `:28` **además** del `logAudit('logout')`
correcto de `:31`. Cada cierre de sesión escribe dos filas: un
`login_exitoso` falso y el `logout` real. 17 casos en 30 días.

La trazabilidad de accesos es exactamente lo que la NOM-024 puede exigir, y
hoy registra salidas como entradas. El literal `logout` ya existe: el fix
es retirar la llamada de más.

**Precede una auditoría del flujo de logout**, que nunca se ha revisado, e
incluye medir la latencia que Angel reporta (a veces hacen falta dos o tres
clics). Auditoría antes que fix.

### 3.5 — Control de sesiones · SE HACE · PRE-LANZAMIENTO

Ajustes de dashboard: caducidad por tiempo, cierre por inactividad y
decisión sobre sesión única por usuario. Valores a definir con criterio
clínico (una sesión de consultorio no es una de oficina). Cero código.
Tener presente el matiz de las 24 h de §2.

### 3.6 — Google OAuth · SE HACE · POST-LANZAMIENTO

Toggle + credenciales en Google Cloud Console + activar el botón que ya
existe inerte en `/login` con la pastilla «Próximamente». **No se rediseña
la pantalla.**

La vinculación de cuentas ya está resuelta: Supabase vincula
automáticamente identidades con el mismo correo verificado, que es
exactamente lo que Angel decidió el 2026-08-05. **Corrección a lo dicho
entonces:** el toggle "Allow manual linking" NO hace falta — ese sirve para
vincular correos *distintos*. Se deja apagado.

⚠️ Verificar antes de cerrar: hay reportes abiertos en Supabase (issues
#2085, #2472) sobre que al añadir contraseña a una cuenta creada con OAuth,
`auth.identities` no siempre refleja el proveedor `email`.

### 3.7 — MFA · SE HACE · POST-LANZAMIENTO

El motor ya está encendido y es gratis (TOTP habilitado en el panel;
"Limit duration of AAL1 sessions" ya activo). Falta solo la pantalla de
enrolamiento en la app y la política: opcional al inicio, evaluando
obligatorio para `admin_clinica`.

⚠️ Requisito de arranque: **Supabase no emite códigos de recuperación.** Su
recomendación es registrar un segundo factor TOTP de respaldo. El runbook
de "perdí el teléfono" debe existir **antes** de activar MFA para nadie.

### 3.8 — Higiene de datos del limitador · SE HACE · POST-LANZAMIENTO

`ip_rate_limits` guarda **correos en claro** en una columna llamada `ip`,
con limpieza perezosa: una clave que no recibe un segundo intento conserva
su fila para siempre. No hay purga programada. Son datos personales sin
política de retención, con LFPDPPP vigente y NOM-024 en curso.

Se resuelve con purga programada. Ojo: la tabla la comparte
`verificar-receta`, así que cualquier cambio los arrastra.

---

## 4 · LO QUE NO SE HACE

| Descartado | Razón |
|---|---|
| **Endpoint propio `/api/auth/login`** | Decisión de Angel, 2026-08-07. Poner una capa propia delante de un servicio de autenticación robusto añade riesgo de romper el login (si falla, nadie entra) por un escenario de ataque improbable en este producto. El perímetro queda en Supabase + §3.2 + §3.3 |
| **Hook de intento de contraseña** | Requiere Teams ($599/mes) frente a Pro ($25). Confirmado en el panel. Absurdo para ~10 usuarios |
| **Migrar a Clerk / Auth0** | Rompe las RLS de la Etapa 5 (todas cuelgan de `auth.uid()` de Supabase), añade costo por usuario y es un proyecto de semanas a poco del lanzamiento |
| **Las funciones SQL de A2** (`rate_limit_intento`, `rate_limit_reset`, `idx_ip_rate_limits_ruta_fecha`) | Se construyeron para el endpoint descartado. **Se eliminan con `DROP`** una vez confirmado que nada las llama — hoy nada las llama. No se dejan "por si acaso": código muerto en producción es deuda |
| **Límite por cuenta independiente de la IP** | No existe de forma nativa en Pro y su única vía era el endpoint descartado |
| **Refactor full-SSR de sesión** | Nunca fue necesario; existía solo como consecuencia del endpoint |
| **IP forwarding de GoTrue** | Solo hacía falta si el login pasaba por Vercel. Sin endpoint, el navegador habla directo con GoTrue y los límites se aplican por IP real del médico. Se deja apagado |
| **MFA por SMS** | Add-on de pago. TOTP cubre la necesidad |
| **Passkeys** | En beta. No se compromete la puerta de entrada de un expediente clínico a una función en beta |

---

## 5 · GATE DE LANZAMIENTO

**Antes de lanzar:** 3.1, 3.2, 3.3, 3.4 y 3.5.
**Después de lanzar, con fecha al cerrar el lanzamiento — no abierto:**
3.6, 3.7 y 3.8.

---

## 6 · PRUEBAS

**Para 3.1** (las dos que justifican el cambio):
1. Un tercero falla 5 veces con el correo de la víctima desde la IP A → la
   víctima entra normal desde la IP B. **Nadie queda bloqueado.**
2. El médico falla 5 veces desde su red → cambia a datos móviles → entra.

**Para 3.2:** login legítimo pasa el CAPTCHA; petición automatizada sin
token de CAPTCHA es rechazada por GoTrue.

**Para 3.4:** un logout escribe **una** fila `logout` y **ninguna**
`login_exitoso`.

**Regresión obligatoria en todos los casos:** el rediseño de `/login` no se
toca — doble clic, teclado, foco, contenedor de error, modo oscuro
colgado, logo, botón de Google inerte.

---

## 7 · REGISTRO DE ERRORES DE PLANEACIÓN (para no repetirlos)

1. **v1 diseñó una capa propia sin inventariar antes qué traía la
   plataforma.** El proyecto corre sobre Supabase desde el día uno.
2. **En A1 se pidieron tres datos concretos del dashboard en vez de
   revisar el menú completo.** "Auth Hooks" estaba a la vista.
3. **v2 se construyó sobre un hook sin leer primero su tabla de planes.**
   Requiere Teams.

Regla que queda: **antes de diseñar cualquier cosa, verificar qué de eso ya
existe en la plataforma contratada, y en qué plan.**
