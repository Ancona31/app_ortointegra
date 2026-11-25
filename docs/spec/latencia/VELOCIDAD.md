# Bloque VELOCIDAD — lo aplicado y lo que se deja propuesto

Rama `feature/velocidad-navegacion`, 2026-11-24. Parte del informe
`docs/spec/latencia/INFORME.md` de la rama `claude/exciting-cray-bu5ojp`
(hecho sobre `4e9b2b29`), verificado contra `1d16ad0`. Los viajes están
**contados en el código, no medidos**: aquí no hay base local (sin Docker) y
los previews apuntan a producción.

## 1. Dashboard — aplicado

`src/components/dashboard/ProximasCitas.tsx`. El interruptor de la v2 vivía en
un `useRef` del componente: cada montaje pagaba `agenda_ajustes` →
`appointments` en serie.

| | Antes | Después |
|---|---|---|
| Primer montaje de la pestaña | 2 en serie | 2 en serie |
| Cada regreso al dashboard | 2 en serie | **1** |

El primero no baja porque la consulta **sí depende** del interruptor (columnas
y filtro). Las otras tres tarjetas ya iban en paralelo con ésta. Prueba:
`src/lib/tests/dashboardInterruptorV2.test.ts`.

No se hizo: guardar las citas para pintar lo último visto al volver (hoy salen
esqueletos). Son cuatro archivos (las cuatro tarjetas) y necesita plan previo.

## 2. Entrada a /agenda — aplicado, sólo el GET

`src/app/api/appointments/route.ts`, sólo `GET`.

| | Antes | Después |
|---|---|---|
| Saltos en serie dentro de la función | 3 (`getUser` → `profiles` → citas) | **2** (`profiles` → citas) |

Contra la tabla de «Autoridad de sesión»: es «dejar pasar», no un redirect;
lee con cliente de sesión y la barrera es la RLS; no usa cliente de servicio.
POST, PUT, DELETE y los layouts siguen con `getUser()`. Prueba:
`src/lib/tests/appointmentsGetAutoridad.test.ts` (incluye que el POST sigue
con `getUser()`).

**Lo que este cambio NO toca:** la primera pintura de la agenda sale de la
semilla de la página (`sesionServidor()`: `getUser` → `profiles` → citas, 3
saltos). `sesionServidor` la comparte el layout `(app)`, que redirige: no se
toca. El ahorro es en los cambios de semana, la vuelta a la agenda en menos de
30 s y toda traída que no acierte la semilla.

## 3. `prefetch={false}` del menú — NO se cambia

Es deliberado y la razón sigue vigente:

- `bbdb2475` y `19718594` (2026-08-31): los enlaces de la barra están a la
  vista desde el primer render y se precargaban todos a la vez; en Next 16 una
  precarga son de dos a cinco peticiones RSC, cada una una invocación de
  función con su paso por el middleware.
- `fcb21695` (2026-09-07): medido, 25 invocaciones por carga del dashboard, 23
  de ellas precargas.

Estado hoy (`Sidebar.tsx:106-116`): Inicio y Agenda **sí** precargan (modo
`auto`, hasta su `loading.tsx`); Expediente, Documentos y Administración, no.
Los dos destinos más usados ya están cubiertos.

**Alternativa más segura, sin aplicar:** precarga por intención en los tres
apagados, el patrón de la guía de Next 16.2.1
(`node_modules/next/dist/docs/01-app/02-guides/prefetching.md`,
«Hover-triggered prefetch»): `prefetch={activo ? null : false}` con
`onMouseEnter`. No suma ninguna petición a la carga; sólo precarga lo que el
cursor toca. Coste: los tres componentes que pintan el menú (`Sidebar`,
`RielNavegacion`, `EncabezadoFundido`) pasan a llevar estado por enlace, y en
táctil no hay cursor. Debe ir con una e2e que cuente las peticiones `_rsc` al
cargar (deben ser las mismas que hoy) y al pasar el cursor (una tanda, no un
bucle).

## 4. `getClaims()` del middleware saliendo a red — sin aplicar

`getClaims()` sólo verifica en local si el token es de firma asimétrica y trae
`kid` (`auth-js/GoTrueClient.js:2977-2985`). Si no, hace `GET /auth/v1/user`
en **cada** petición del sitio.

**Cómo saberlo sin tocar producción (Angel, en el panel):**

1. Supabase → Project Settings → **JWT Keys** (pestaña «JWT Signing Keys»). La
   llave marcada **Current** debe ser **ECC (P-256)** o RSA. Si dice **Legacy
   HS256 (Shared Secret)**, el middleware está saliendo a red siempre.
2. Segunda vía: Vercel → Observability → External APIs, filtrado por
   Middleware. Si aparece `/auth/v1/user`, está cayendo a red; si aparece
   `/.well-known/jwks.json` muy a menudo, es el JWKS frío.

**Arreglo según lo que salga:**

- **HS256:** se corrige en esa misma pantalla (rotar a una llave asimétrica).
  Cero líneas de código. Cierra las sesiones abiertas al revocar la vieja: se
  hace fuera de horario de consulta.
- **ES256 con JWKS frío** (una petición por isolate y cada 10 min): pasar la
  llave pública desde una variable de entorno,
  `getClaims(undefined, { jwks })`. `fetchJwk` mira primero las llaves
  suministradas (`GoTrueClient.js:2916`) y, si el `kid` no coincide tras una
  rotación, cae a la caché y a la red como hoy. ~6 líneas en
  `src/middleware.ts`, con `try/catch` al leer la variable.

No se aplicó aunque sin la variable sería inerte: no ahorra nada hasta que
exista la variable, toca el archivo más delicado del proyecto, y primero hay
que saber por el punto 2 de arriba si el JWKS frío cuesta algo.

## Verificación

- `npx vitest run`: 179 archivos, 2612 pruebas, en verde.
- `next build --webpack`: en verde (con variables de entorno ficticias; aquí
  no hay `.env.local`).
- `eslint`: los cuatro archivos tocados, limpios. El repo entero da 87 errores
  que ya estaban en `1d16ad0`.
- **Presupuesto de rendimiento (`e2e/medir-carga.e2e.ts`,
  `mejora_agendaV2.md` §A0): NO corrido.** Necesita la Supabase local y este
  entorno no tiene Docker en marcha.

## Visto de paso, sin tocar

- La consulta de «Próximas citas» lleva `new Date().toISOString()` en la URL
  (`ProximasCitas.tsx`, `consultaProximas`): el preflight CORS no se puede
  cachear y se paga en cada montaje. Redondear al minuto lo arreglaría.
- `GET /api/google/events`, `/api/avisos` y `/api/agenda/por-confirmar` abren
  cada una con su `getUser()` al entrar a la agenda. No se revisó si alguna
  admite `getClaims()`; las que usan cliente de servicio, no.
