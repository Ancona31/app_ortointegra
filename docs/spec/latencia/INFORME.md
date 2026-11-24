# Diagnóstico de latencia de navegación — Spinus®

Rama analizada: `origin/feature/integracion-rediseno-agenda` (4e9b2b29), leída en un worktree temporal ya borrado. Solo lectura: no se tocó el repo.
Rutas de archivo relativas a la raíz del repo; `auth-js` = `node_modules/@supabase/auth-js/dist/main` (v2.100.0); docs de Next = `node_modules/next/dist/docs/01-app`.

## 0. Conclusión en corto

**El código, contado viaje por viaje, no explica 2–3 s en caliente.** Las tres navegaciones tienen cadenas cortas (3–5 viajes en serie) y con supuestos normales salen en 0,4–0,9 s. Para llegar a 2–3 s tiene que haber 1–2 s que no están en el inventario: una función sin calentar, un salto mucho más lento de lo supuesto (Auth), o el middleware saliendo a red. Ninguna de esas tres cosas se puede afirmar ni descartar leyendo código; las tres se confirman sin que el dueño abra DevTools (§5).

Lo que sí es estructural y está comprobado:

- Toda navegación entre pantallas exige al menos una invocación de función en pdx1, aunque la página destino sea 100 % cliente (dashboard, expediente). La caché del router solo la evita 30 s.
- Todo punto de entrada de servidor abre con `getUser()` (red a Auth) en serie antes de la primera consulta.
- El dashboard y el expediente no guardan nada en cliente: cada montaje vuelve a pedir todo y pinta esqueletos.
- La prueba se hizo en un *preview* con un solo usuario, que es el peor caso posible para funciones calientes.

## 1. Lo común a las tres navegaciones

### 1.1 Middleware (`src/middleware.ts`) — corre en CADA petición que pase el matcher, incluidas `?_rsc=`, prefetch y `/api/*`

| Hecho | Evidencia |
|---|---|
| Una sola operación de sesión: `supabase.auth.getClaims()` | `src/middleware.ts:177` |
| No hace ninguna consulta a PostgREST | archivo entero |
| Estáticos fuera del matcher (svg, png, js, css, fuentes, audio…) | `src/middleware.ts:435` |
| `getClaims()` verifica en local con WebCrypto solo si `alg` no empieza por `HS`, hay `kid` y hay `crypto.subtle` | `auth-js/GoTrueClient.js:2962-2981` |
| Si no (HS256, sin `kid`, sin WebCrypto, o `kid` que no está en el JWKS) cae a `getUser(token)` = `GET /auth/v1/user` por red | `auth-js/GoTrueClient.js:2982-2986`, `:1438-1447` |
| La clave pública se cachea global por isolate, TTL 10 min; con caché fría hace `GET /auth/v1/.well-known/jwks.json` | `auth-js/GoTrueClient.js:42`, `:2914-2944`; `lib/constants.js:30` |
| Si al token le quedan < 90 s, `getSession()` refresca por red (`_callRefreshToken`) dentro del middleware | `auth-js/GoTrueClient.js:1380-1408`; `lib/constants.js:5-13` |

Viajes de red del middleware por petición:

- **Normal: 0.**
- **+1** (JWKS) la primera vez en cada isolate y cada 10 min.
- **+1** (refresh) una vez por hora y por petición concurrente.
- **+1 siempre** si el proyecto firmara con HS256.

**Dónde corre.** El archivo es `middleware.ts`, no `proxy.ts`, y no declara `runtime`, así que es Edge Runtime: «The `edge` runtime is NOT supported in `proxy`… If you want to continue using the `edge` runtime, keep using `middleware`» (`02-guides/upgrading/version-16.md:619`) y «Middleware defaults to run at the Edge Runtime, which can run closer to the client, separated from the app's region» (`03-api-reference/03-file-conventions/proxy.md:743`).

Consecuencia: el middleware no corre en pdx1 sino cerca del usuario. Cuando sale a red (JWKS, refresh, fallback) lo hace desde lejos de Oregon y normalmente con conexión TLS nueva. El propio repo midió 521 ms en `/privacidad` cuando aquí había `getUser()` (`src/middleware.ts:95-102`). Que en Vercel se ejecute en el borde más cercano a Mérida es un supuesto mío; la región exacta sale en los logs (§5).

**Cómo comprobar qué tipo de llave usa el proyecto** (cualquiera basta):

1. Panel de Supabase → Project Settings → JWT Keys: la llave «current» debe ser ECC P-256 o RSA, no «Legacy HS256 (shared secret)».
2. `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` debe devolver `keys` no vacío. Lo intenté desde este entorno y el proxy lo bloqueó: no está comprobado por mí.
3. La cabecera del access token debe traer `alg: ES256` (o RS256) y `kid`.
4. Sin tocar nada: Vercel → Observability → External APIs filtrado por Middleware. Si aparece `/auth/v1/user`, `getClaims()` está cayendo a red.

El comentario de `src/middleware.ts:108-116` dice que se verificó ES256 al escribirlo. Sigue siendo una condición externa que se apaga sola y en silencio.

### 1.2 Layout `(app)` — NO se re-ejecuta en estas navegaciones

`src/app/(app)/layout.tsx:52` (`sesionServidor()` = `getUser` → `profiles`) y `:120` (`Promise.all` de suscripción + config) solo corren en carga dura. En transición con `<Link>` el servidor renderiza desde el primer segmento que cambia: «shared layouts won't automatically be refetched on every navigation, only the page segment that changes» (`03-api-reference/05-config/01-next-config-js/staleTimes.md`). El perfil y la config llegan sembrados al cliente (`perfilInicial`, `fallback` de SWR), así que `useProfile` y `useConsultorios` no piden nada al montar (`src/hooks/useProfile.ts:142-143`).

### 1.3 Cachés y prefetch

- `staleTimes: { dynamic: 30, static: 180 }` (`next.config.ts`, bloque `experimental`). Todas las rutas de `(app)` son dinámicas: volver a una pantalla pasados 30 s vuelve a pedir su RSC al servidor.
- Menú lateral: Inicio y Agenda precargan en modo `auto` (hasta su `loading.tsx`); Expediente, Documentos y Administración van con `prefetch={false}` (`src/components/layout/Sidebar.tsx:107-115`, `:258`).
- Casi todos los enlaces internos llevan `prefetch={false}`: «Ver agenda →» del dashboard (`src/components/dashboard/ProximasCitas.tsx:136,155,425`, `TarjetaHoy.tsx:89`), los enlaces al expediente (`AtendidosRecientemente.tsx:143`, `src/app/(app)/dashboard/page.tsx:66`) y «volver» del expediente (`src/components/expediente/CabeceraPaciente.tsx:140`). Según la doc, sin prefetch «dynamic routes will wait for the server to render before navigating» (`02-guides/prefetching.md:318`): la pantalla anterior se queda quieta hasta el primer byte del servidor, sin esqueleto.
- No hay `router.refresh()` en estas rutas (solo en configuración de agenda y en el cierre de sesión). No hay `dynamic`/`revalidate` en las páginas. `cache: 'no-store'` solo en fetches de configuración.
- Caché de cliente por pantalla:
  - Agenda: sí, 120 s (`src/lib/agenda/cacheRangosCitas.ts:29`).
  - Dashboard: ninguna (`useState` + `useEffect`).
  - Expediente `[id]`: ninguna.

### 1.4 Preflight CORS navegador → Supabase (comprobado el mecanismo, no la cabecera)

Las consultas directas desde el navegador a `*.supabase.co` son cross-origin con `Authorization` y `apikey`, así que llevan preflight `OPTIONS`. El navegador lo cachea por URL completa. Hay dos casos donde la URL cambia siempre:

- La consulta de próximas citas mete `new Date().toISOString()` en la URL (`src/components/dashboard/ProximasCitas.tsx:83-90`): preflight en cada montaje.
- Las del expediente llevan el id del paciente: preflight en la primera visita a cada paciente.

Coste: +1 ida y vuelta por consulta afectada, en paralelo entre ellas. No pude leer el `Access-Control-Max-Age` que devuelve Supabase (proxy bloqueado); si fuera bajo o ausente, el preflight sería en todas las consultas.

## 2. Inventario por navegación

«Serie» = viajes que esperan uno al otro. B = navegador, E = edge (middleware), F = función pdx1.

### (a) Expediente de paciente → Dashboard

| # | Paso | Quién | Viajes en serie | Archivo:línea |
|---|---|---|---|---|
| 1 | Clic. Desde el menú hay esqueleto precargado; desde otros enlaces no | B | 0 | `Sidebar.tsx:107`, `src/app/(app)/loading.tsx` |
| 2 | `GET /dashboard?_rsc` → middleware `getClaims()` | E | 0 de red (1 si JWKS frío) | `src/middleware.ts:177` |
| 3 | Función: la página es `'use client'`, sin `await`; el layout no corre | F | 1 (B↔pdx1), 0 internos | `src/app/(app)/dashboard/page.tsx:1` |
| 4 | Montaje: perfil sembrado | B | 0 | `src/hooks/useProfile.ts:142` |
| 5a | Próximas citas: `agenda_ajustes` → después `appointments` (+ preflight) | B→Supabase | **2 en serie** (+1 preflight) | `ProximasCitas.tsx:348`, `:350` |
| 5b | Tarjeta Hoy: 2 conteos en paralelo | B→Supabase | 1 | `TarjetaHoy.tsx:199` |
| 5c | Atendidos: `consultas` + `pacientes!inner`, límite 30 | B→Supabase | 1 | `AtendidosRecientemente.tsx:74-80` |
| 5d | Documentos recientes | B→Supabase | 1 | `DocumentosRecientes.tsx:109-114` |
| 5e | `/api/me/config` solo si pasaron 5 min; no bloquea | B→F | (getUser → profiles → 3 en paralelo) | `src/lib/configApp.ts:29,171`; `src/lib/configAppServidor.ts:38` |

**Cadena crítica: 1 (RSC) + 2 (ajustes → citas) + 1 preflight = 3–4 idas y vueltas navegador↔Oregon.** 5a–5d van en paralelo entre sí. `v2Ref` es por montaje (`ProximasCitas.tsx:313`), así que `agenda_ajustes` se vuelve a leer en cada visita.

### (b) Cualquier pantalla → /agenda (v2 encendida)

| # | Paso | Quién | Viajes en serie | Archivo:línea |
|---|---|---|---|---|
| 1 | Clic; esqueleto propio si viene del menú | B | 0 | `src/app/(app)/agenda/loading.tsx` |
| 2 | `GET /agenda?_rsc` → middleware | E | 0 | `src/middleware.ts:177` |
| 3 | La página es síncrona: devuelve `AgendaCliente` con 5 promesas que llegan por streaming | F | 1 (B↔pdx1) | `src/app/(app)/agenda/page.tsx:170-179` |
| 3.1 | `sesionServidor()`: `getUser()` | F→Auth | 1 | `src/lib/supabase/sesionServidor.ts:41` |
| 3.2 | `profiles` | F→PostgREST | 1 | `sesionServidor.ts:43-47` |
| 3.3 | En paralelo: `appointments` (con `count: 'exact'` y 3 embeds), `agenda_bloqueos`, `agenda_ajustes` | F→PostgREST | 1 | `src/lib/agenda/consultaCitas.ts:122`; `page.tsx:72` |
| 3.4 | Tras el interruptor, en paralelo: `consultorios` (cliente de servicio, filtra `clinica_id`), `tipos_cita`, `appointments` de asistencia | F→PostgREST | 1 | `page.tsx:93,118,146` |
| 3.5 | Asistencia: `consultas` (cliente de servicio) | F→PostgREST | 1 | `src/lib/agenda/asistenciaServidor.ts:79` |
| 4 | Monta FullCalendar; la fuente de citas espera la semilla hasta 3 s | B | 0 | `src/app/(app)/agenda/useFuentesAgenda.ts:280`; `src/lib/agenda/semillaCitas.ts:133` |
| 5 | Solo si la semilla no trae la clave pedida: `GET /api/appointments` → middleware → `getUser` → `profiles` → citas ∥ bloqueos | B→E→F | **+1 vuelta completa con 3 internos** | `src/lib/agenda/traidaCitas.ts:46`; `src/app/api/appointments/route.ts:48-54,74` |
| 6 | Fuera del camino crítico: `/api/google/events` (getUser → profiles → conexión → Google → citas), `POST /api/google/sync` en ocioso, canal Realtime, `/api/avisos`, `/api/agenda/por-confirmar`, precarga de semanas vecinas | B→F | paralelo, cada uno con su `getUser` | `src/app/api/google/events/route.ts:76-120`; `AgendaCliente.tsx:926`; `useTiempoRealAgenda.ts:124` |

**Cadena crítica hasta ver citas: 1 vuelta B↔pdx1 con 3 saltos internos en serie** (getUser → profiles → citas). Hasta que la v2 queda asentada son 4 (interruptor → consultorios; `AgendaCliente.tsx:291-303`). Asistencia: 5.

Cuándo se alarga:

- Si la semilla no acierta la clave (otra vista, otro rango u otro filtro que el de `ventanaDeLaSemilla`), se paga la fila 5 después de esperar la semilla.
- Volver en < 30 s devuelve la semilla vieja ya usada y va directo a `/api/appointments` (`semillaCitas.ts:104-117`).
- Volver en < 120 s sin escrituras ni eventos de tiempo real sale de caché, sin red.
- Abrir la agenda dispara 5–7 invocaciones de función casi simultáneas, cada una con su `getUser()` a Auth.

### (c) Dashboard → Expediente de un paciente

| # | Paso | Quién | Viajes en serie | Archivo:línea |
|---|---|---|---|---|
| 1 | Clic con `prefetch={false}`: la pantalla anterior queda quieta hasta el primer byte | B | 0 | `AtendidosRecientemente.tsx:143`; `dashboard/page.tsx:66` |
| 2 | `GET /expediente/<id>?_rsc` → middleware | E | 0 | `src/middleware.ts:177` |
| 3.1 | Layout `expediente`: `getUser()` | F→Auth | 1 | `src/app/(app)/expediente/layout.tsx:30` |
| 3.2 | Layout `[id]`: `getUser()`, en paralelo con 3.1 | F→Auth | (mismo nivel) | `src/app/(app)/expediente/[id]/layout.tsx:37` |
| 3.3 | Layout `[id]`: `profiles.role` | F→PostgREST | 1 | `[id]/layout.tsx:47-51` |
| 4 | La página es `'use client'`; al montar lanza todo en paralelo: `pacientes`, `consultas`, `documentos`, 2 conteos, `appointments` (próxima cita) | B→Supabase | 1 (+1 preflight, URLs nuevas por paciente) | `src/app/(app)/expediente/[id]/page.tsx:115,117,139,159-160,170` |
| 5 | `POST /api/audit` (getUser → inserción); no bloquea | B→F | paralelo | `src/hooks/useAudit.ts:29`; `src/app/api/audit/route.ts:38` |

**Cadena crítica: 1 vuelta B↔pdx1 con 2 saltos internos (getUser → profiles) + 1–2 idas y vueltas B↔Supabase.**

Si los dos `getUser()` de 3.1 y 3.2 comparten viaje por la memoización de `fetch` no lo comprobé; el repo dice haber medido 4 viajes en total (`DEUDA_TECNICA.md`, PERF-DT-1).

## 3. Estimación de tiempos

Ningún número de esta tabla está medido contra producción; todos son supuestos míos de orden de magnitud.

| Símbolo | Qué es | Valor supuesto | De dónde sale |
|---|---|---|---|
| R | Ida y vuelta navegador (Mérida) ↔ Oregon, a Vercel pdx1 o a Supabase | 90–130 ms | Distancia; no medido |
| C | Conexión TLS nueva tras inactividad | +2 R ≈ +200 ms | TCP + TLS 1.3 |
| F | Sobrecoste de invocar una función caliente | 20–60 ms | Típico de Vercel; no medido |
| F❄ | Función fría (el bundle de `/api/appointments` importa `googleapis`) | 0,8–2,5 s | Supuesto |
| A | `getUser()` desde pdx1 a Auth | 30–100 ms | Misma región, pero Auth consulta la base; no medido |
| Q | Consulta PostgREST simple con RLS, tiempo de servidor | 20–60 ms | Volumen pequeño |
| P | Preflight | ≈ R | — |

| Navegación | Fórmula (comprobada en código) | Caliente | Con una función fría o conexiones nuevas |
|---|---|---|---|
| (a) → dashboard, hasta próximas citas | (R+F) + (R+Q) + P + (R+Q) | **0,45–0,75 s** | 1,5–3,5 s |
| (b) → agenda, hasta citas, semilla acierta | (R+F) + A + Q + Q + montaje de FullCalendar (150–400 ms, supuesto de CPU) | **0,35–0,8 s** | 1,3–3,3 s |
| (b) semilla no acierta | lo anterior + (R+F+A+2Q) | 0,55–1,2 s | hasta ~5 s (dos funciones distintas frías) |
| (c) → expediente, hasta cabecera del paciente | (R+F) + A + Q + P + (R+Q) | **0,4–0,7 s** | 1,4–3,2 s |

La columna «caliente» no llega a 2 s en ningún caso. Si el dueño ve 2–3 s de forma sistemática, sobra ≥ 1 s que tiene que venir de F❄, de un A o Q muy por encima de lo supuesto, o del middleware saliendo a red.

## 4. Sospechosos, por tiempo probable

### S1 — Funciones sin calentar: cada navegación necesita ≥ 1 invocación, y la prueba es en preview

- **Evidencia.** Todas las rutas son dinámicas y la caché del router dura 30 s, así que incluso las páginas 100 % cliente pagan una invocación por navegación (2a, 2c). La agenda dispara 5–7 rutas distintas (2b fila 6). El tráfico es mínimo (20 perfiles; en preview, un usuario). El bundle de servidor es pesado: `googleapis` entra en `/api/appointments` (`route.ts:2,5`).
- **Por qué daría 2–3 s.** Un arranque frío es del orden de 1–2,5 s y cae justo «al cambiar de pantalla». «Llevar rato navegando» no calienta las rutas que aún no se han tocado ni las que llevan minutos sin uso.
- **Supuesto sin verificar:** que Vercel empaqueta estas rutas en funciones distintas y que en preview no mantiene instancias calientes.
- **Arreglo.** Primero medir. Si se confirma:
  - Repetir la prueba contra el despliegue de producción: 0 líneas.
  - Subir `staleTimes.dynamic` de 30 a 180–300 (`next.config.ts`, 1 línea). Riesgo medio: el resultado del guarda de rol de `expediente/[id]/layout.tsx` se reutiliza más tiempo en cliente (la barrera real sigue siendo la RLS), y la agenda reutiliza semillas ya usadas y cae a `/api/appointments`, que para la agenda es neutro.
  - No propongo mover guardas al middleware: lo prohíbe «Autoridad de sesión».

### S2 — `getClaims()` del middleware saliendo a red desde el edge

- **Evidencia.** `auth-js/GoTrueClient.js:2975-2986` (fallback a `getUser` con HS256 o sin `kid`), `:2914-2930` (JWKS por isolate), `:1380-1408` (refresh). El middleware corre lejos de Oregon; el repo ya midió ~500 ms por petición cuando hacía red (`src/middleware.ts:95-102`).
- **Por qué daría 2–3 s.** Se pagaría a la cabeza de cada petición: RSC, cada `/api/*` y cada prefetch. Una navegación con RSC + API serían 2 × ~0,5 s. Con ES256 vigente solo queda el JWKS en isolates fríos, que con poco tráfico pueden ser casi todos.
- **Arreglo.**
  - Si es HS256 o falta `kid`: se corrige en el panel de Supabase, 0 líneas.
  - Si es el JWKS frío: pasar la clave pública a `getClaims(undefined, { jwks })` desde una variable de entorno. `fetchJwk` mira primero las claves suministradas (`GoTrueClient.js:2916-2919`) y, si el `kid` no coincide tras una rotación, cae a caché y red como hoy. 1 archivo, ~4 líneas. Riesgo bajo: la verificación sigue siendo criptográfica, con la misma autoridad que hoy.

### S3 — `getUser()` en serie a la cabeza de toda entrada de servidor

- **Evidencia.** `sesionServidor.ts:41`; `expediente/layout.tsx:30`; `[id]/layout.tsx:37`; `api/appointments/route.ts:48`; `api/me/config/route.ts:66`; `api/google/events/route.ts:76`; `api/audit/route.ts:38`. Auth corre en la instancia micro y consulta la base en cada llamada.
- **Por qué pesaría.** Con A normal son 30–100 ms por navegación. Si Auth tarda 300–500 ms, que desde código no se ve, es 1 s en la agenda (semilla + fallback) y se suma a todo lo demás.
- **Arreglo, solo si la medición lo señala.** `GET /api/appointments` es una lectura con cliente de sesión y RLS, no un redirect: la regla de CLAUDE.md permite `getClaims()` ahí («dejar pasar / no renderizar»). 1 archivo, ~8 líneas, solo la rama GET; el POST escribe y usa cliente de servicio, así que conserva `getUser()`. Riesgo bajo-medio: una sesión revocada seguiría leyendo sus propios datos hasta el `exp` del JWT, ventana que ya existe por PostgREST directo.
  - No tocar los layouts (`(app)`, `expediente/*`): redirigen y deben seguir con `getUser()`.
  - No tocar `sesionServidor` (lo comparte el layout).
  - No tocar ninguna ruta con `createAdminClient()`.

### S4 — Dashboard: cascada en cliente, sin caché, con preflight

- **Evidencia.** `ProximasCitas.tsx:348→350` (`agenda_ajustes` y luego `appointments`, en serie, en cada montaje); `:83-90` (URL con marca de tiempo, preflight siempre); las cuatro tarjetas con `useEffect` + `useState` sin caché.
- **Por qué pesa.** Es la cadena más larga de las tres en idas y vueltas transcontinentales (3–4 R). Volver al dashboard siempre enseña esqueletos, aunque se haya visto hace 10 s.
- **Arreglo.**
  - Recordar el interruptor v2 a nivel de módulo por `clinicaId` en vez de en `v2Ref`: 1 archivo, ~6 líneas, quita 1 R. Riesgo bajo: un cambio del interruptor se vería tras recargar.
  - Pasar las cuatro lecturas a SWR (ya está en el proyecto, con `keepPreviousData` en el layout) para pintar lo anterior mientras revalida: 4 archivos, ~15 líneas cada uno. Supera 3 archivos, así que requiere plan previo (Protocolo 3). Riesgo medio.

### S5 — Supabase micro / RLS / índices: improbable por volumen

- **Evidencia.**
  - Las policies llaman `get_clinica_id()`, `get_my_role()`, `soy_admin_de_clinica()` y `soy_medico_tratante(id)` sin `(select …)` (`supabase/migrations/20260912190416_remote_schema.sql:2784-2788`, `:2898-2904`, `:2957-2963`, `:3097-3103`, `:3162-3166`).
  - Son `LANGUAGE sql STABLE SECURITY DEFINER` con `SET search_path` (`:1494-1512`, `:2087-2114`), así que no se pueden insertar en línea y se evalúan por fila cuando no sirven de condición de índice.
  - `consultas_select` y `documentos_select` añaden un `EXISTS` sobre `pacientes`, que a su vez pasa su RLS.
  - Índices: `appointments` tiene `clinica_id`, `medico_id`, `start_time` y (migración f5b, `20261201170000…:467-469`) `(clinica_id, inicio)` y `(clinica_id, medico_id, inicio)`. No hay índice por `consultas.created_at` (lo ordena `AtendidosRecientemente`).
- **Criterio.** Con 247 citas y pocas consultas visibles, unas decenas de microsegundos por llamada y fila suman como mucho decenas de ms. No explica segundos. Ya está registrado como PERF-DT-4 en `DEUDA_TECNICA.md`.
- **No descartable desde código:** que la instancia micro esté saturada de CPU o memoria.
- **Arreglo.** Ninguno ahora. Si la medición lo señalara: envolver en `(select …)` vía migración, pasando por `supabase/AUDITORIA-MIGRACIONES.md`.

## 5. Cómo confirmarlo sin trabajo manual en el navegador

1. **Vercel → Observability, sin código**, sobre el despliegue de preview:
   - Functions: duración p75/p99 y arranques en frío por ruta (`/agenda`, `/dashboard`, `/expediente/[id]`, `/api/appointments`, `/api/google/events`) → S1.
   - Middleware: duración p75/p99. Si no es de un dígito de ms → S2.
   - External APIs: latencia de `…supabase.co/auth/v1/user` y `/rest/v1/*` desde funciones → S3 y S5. Si aparece `/auth/v1/user` o `jwks.json` llamado desde Middleware → S2.
   - Speed Insights no está instalado (`package.json` no trae `@vercel/speed-insights`): no hay datos de campo por ruta.
2. **Supabase → Logs (API Gateway y Auth) y Reports → API / Database**, sin código: tiempos por petición de `/auth/v1/user` y `/rest/v1/appointments`, y CPU/memoria de la instancia → S3 y S5.
3. **Una consulta de solo lectura en el SQL Editor** (S5, y de paso el coste de Auth en base):

   ```sql
   select calls,
          round(mean_exec_time::numeric, 2)  as media_ms,
          round(max_exec_time::numeric, 2)   as max_ms,
          round(total_exec_time::numeric)    as total_ms,
          rows,
          left(regexp_replace(query, '\s+', ' ', 'g'), 140) as consulta
   from extensions.pg_stat_statements
   where calls > 20
   order by mean_exec_time desc
   limit 30;
   ```

   Si ninguna consulta de `appointments`, `consultas`, `pacientes`, `profiles` o `auth.users` pasa de ~20 ms de media, la base y la RLS quedan descartadas.
4. **Si lo anterior no basta: un commit solo de preview** en una rama `feature/medicion-latencia` que no se fusiona, con registros de tiempo que se leen en Vercel Logs mientras el dueño usa la app con normalidad:
   - `src/middleware.ts`: ms de `getClaims()`, si es `_rsc` y `process.env.VERCEL_REGION`. Más de ~20 ms significa que salió a red.
   - `src/lib/supabase/sesionServidor.ts`: ms de `getUser` y de `profiles`.
   - `src/app/(app)/expediente/[id]/layout.tsx`: ídem.
   - `src/app/api/appointments/route.ts` (GET): ms de `getProfile` y de `consultaCitas`.

   Son 4 archivos y ~20 líneas, con cabecera `Server-Timing` opcional. Al ser más de 3 archivos requiere el visto bueno previo del Protocolo 3.

## 6. Tamaño y pintado

- **JS.** No hice build (no hay `.next` en el entorno): no hay tamaños medidos.
  - `AgendaCliente.tsx` importa FullCalendar de forma estática (core, react, daygrid, timegrid, list, interaction).
  - Modales y piezas v2 van con `dynamic()` (`AgendaCliente.tsx:116-149`).
  - El dashboard solo difiere `VentanaLigarCita`.
  - Los chunks van con hash e inmutables: tras la primera visita no se vuelven a descargar, así que no son la causa en pantallas ya visitadas. Sí cuesta CPU remontar FullCalendar en cada entrada (supuesto: 150–400 ms según equipo).
- **Pintado bloqueado.** Hay `loading.tsx` en `(app)`, `agenda`, `expediente` y `expediente/[id]`: no falta ninguno. El bloqueo real es el de §1.3: con `prefetch={false}` no hay esqueleto hasta el primer byte.
- **Cascadas tras hidratar.** Dashboard: `agenda_ajustes` → `appointments`. Agenda v2: interruptor → consultorios, en servidor por streaming, más la espera de los chunks v2 antes de dar el interruptor por leído (`AgendaCliente.tsx:291-303`).
- `PageTransition` anima solo opacidad durante 0,24 s (`src/app/globals.css:1194`): no retrasa datos.

## 7. Descartado, y con qué

| Cosa | Veredicto | Evidencia |
|---|---|---|
| Distancia función ↔ base | Descartado | Dato dado: pdx1 y us-west-2 |
| Layout `(app)` re-ejecutándose (getUser + suscripción + config) en cada navegación | Descartado | Renderizado parcial, doc de `staleTimes`; solo en carga dura |
| `router.refresh()` o `no-store` forzando recargas en estas rutas | Descartado | Búsqueda en `src`: solo en configuración de agenda y cierre de sesión |
| Google Calendar bloqueando las citas | Descartado | Fuente separada y en dos tiempos (`useFuentesAgenda.ts`, `gcalSource`) |
| Realtime bloqueando | Descartado | Solo suscribe un canal (`useTiempoRealAgenda.ts:124`) |
| Peso de JS en pantallas ya visitadas | Descartado como causa de red; CPU sin medir | Chunks con hash |
| RLS por fila / índices | Improbable; lo confirma la consulta de §5.3 | Volumen: 247 citas |
| Cómputo micro de Supabase (PostgREST y Auth) | No descartable desde código | §5.2 y §5.3 |
| Arranques en frío | No descartable desde código; es el primer sospechoso en preview | §5.1 |
| Fallback HS256 en middleware | No descartable desde código; el repo afirma ES256 en su día | §1.1, §5.1 |
