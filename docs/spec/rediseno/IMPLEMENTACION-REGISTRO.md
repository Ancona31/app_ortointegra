# Registro de la implementación del rediseño estético

Rama `feature/rediseno-estetico`, creada desde `feature/agenda-v2` @ `951e31b3`.
Plan: `PLAN.md`. Reglas para quien implementa: `kit/IMPLEMENTACION.md`.

## Línea base (B0, 2026-11-21, sábado)

Medida sobre `951e31b3` sin ningún cambio en `src/`. Resultados literales; logs en
la carpeta temporal de la sesión, no en el repo.

### Entorno

| Cosa | Valor |
|---|---|
| Node | v22.23.5 (el contenedor; `.nvmrc` pide 24.15.0) |
| `npm ci` | `added 1098 packages`, exit 0 |
| Supabase CLI | `npx supabase@2.117.0` (`start`, `db reset --local`, exit 0) |
| Migraciones locales | `50\|20261125180000` |
| Semilla | `npx tsx scripts/agenda-semilla.ts`, exit 0 (A: 26 pacientes, B: 3) |
| Agenda v2 | encendida en «Clínica Semilla A» (`Clínica Semilla A\|t`, `Clínica Semilla B\|f`) |
| Playwright | 1.64.1. El contenedor trae Chromium r1243 y Playwright pide r1248 (la descarga falla): se apuntó `PLAYWRIGHT_BROWSERS_PATH` a una carpeta temporal con enlaces simbólicos `chromium-1248 → chromium-1243` (Chromium 157.0.8103.78). Sin tocar `/opt` ni el repo. |

### Build

`NODE_OPTIONS=--max-old-space-size=8192 npm run build` → **exit 0**.
`✓ Compiled successfully in 106s`, `✓ Generating static pages using 3 workers (98/98)`.
Avisos: los dos de Sentry de siempre (`disableLogger is deprecated`, «Could not
find a Next.js instrumentation file»).

**CSS compilado** (`.next/static/css/`):

| Archivo | Bytes | gzip |
|---|---|---|
| `0285e10d35babeb3.css` (principal) | **330 976** | 56 682 |
| `cd4760fdd8b44888.css` | 11 855 | |
| `0e2f2d2b1b5f5740.css` | 10 262 | |
| `09317c9104c25786.css` | 2 119 | |

### Lint

`npm run lint` → exit 1: **`✖ 164 problems (96 errors, 68 warnings)`**.
**Tope: ningún bloque puede superar 96 errores ni 68 avisos.**

Reparto: 77 archivos en `src/`, 9 en `design/` (maquetas `.jsx` versionadas: son
los 50 `react/jsx-no-undef`), 1 en `e2e/`. Por regla: 50 `react/jsx-no-undef`,
31 `no-unused-vars` (aviso), 14+5 de `react-hooks` (`renders`/`render`), 12
`no-console` (aviso), 12 `react/no-unescaped-entities`, 11 `jsx-a11y/alt-text`
(aviso), 9 `no-explicit-any`, 8 `no-img-element` (aviso), 4 `prefer-const`, 3
`exhaustive-deps` (aviso), 3 `no-unused-expressions` (aviso), 2
`no-require-imports`. Los 12 avisos de `no-console` son directivas
`eslint-disable` que ya no hacen falta. Con las herramientas de `tools/` ya en
el árbol, `npm run lint` vuelve a dar exactamente 96/68
(`npx eslint docs/spec/rediseno/tools` → 0).

### Unitarias

`npx vitest run` (sin TZ) → `Test Files 162 passed (162)`, `Tests 2363 passed (2363)`.
`TZ=UTC npx vitest run` → `Test Files 162 passed (162)`, `Tests 2363 passed (2363)`.

### e2e

`npx playwright test` (los tres proyectos de `playwright.config.ts`, contra
`next start -p 3001`), de 16:56 a 18:22 UTC del sábado 21-nov (10:56–12:22 en
Mérida). Total 1 124:

**`290 passed`, `180 failed`, `445 skipped`, `209 did not run` (1.4h)**.

**Esta corrida NO sirve como «todo en verde»**: tiene dos causas de entorno y una
de calendario que tapan casi todo. Clasificación de las 180 por su
`error-context.md`:

| Causa | Fallos | Qué es |
|---|---|---|
| Ventana «¿Asistió el paciente?» abierta en la agenda v2 | 75 (su encabezado está en el contexto del fallo) + 16 clics interceptados por un `div.fixed.inset-0.z-50` (ASUMIENDO QUE es la misma ventana) | **Depende del día** (AG-DT-256): de viernes a domingo, las citas que crean e2e anteriores en la semana visible cumplen las 48 h y la ventana tapa la rejilla. La corrida fue en sábado. |
| `Error: Falta RESERVA_SECRETO en .env.local` | 39 | **Entorno**: el `.env.local` de claves ficticias copiado del clon de diseño deja `RESERVA_SECRETO=` vacío. Todas las `reserva-*`, `confirmacion-*` y parte de `agenda-reflejo-enlace`. |
| `{"error":"sin_enlace"}` | 2 | `agenda-g3-correo`. ASUMIENDO QUE viene de lo mismo (enlace de reserva). |
| Otras sin clasificar | 48 | Muchas en archivos que también tienen fallos por la ventana (`agenda-f-tarjeta`, `agenda-i3`, `agenda-k5-marcas`, `agenda-por-ligar`, `agenda-j3`…), probablemente en cascada. Una se reproduce aislada: `agenda-cache-rangos.e2e.ts:154` («precarga en ocioso», `waitForResponse` 5 s), causa no investigada. |

Los 209 «did not run» son pruebas de bloques `serial` que se saltan tras un fallo
anterior del mismo bloque.

Antes de esta corrida hubo otra inválida, con el contenedor de Realtime parado
(el arranque inicial lo dejó fuera); se abortó y se rehízo con Realtime arriba.

**Para que la línea base sirva** (decisión del orquestador, no se hizo en B0):
poner un `RESERVA_SECRETO` ficticio en `.env.local`, aprobar el aviso de reserva
local (`GUIA_PRUEBAS_AGENDA_V2.md`, P7) y repetir la batería de lunes a jueves. Hasta
entonces, cada bloque compara **por archivo** contra esta corrida y contra la del
cierre de la tanda M (634 pasan, 0 fallan; AG-DT-255).

### Capturas «ANTES»

`tools/cap-app.js` y `tools/chk-app.js` sobre todas las rutas en alcance, en los
cinco formatos, claro y oscuro, guardadas fuera del repo. Con agenda v2 encendida,
semilla recién sembrada y una consulta ficticia insertada en local para «nota de
consulta» (borrada después; la semilla se niega a borrar pacientes con consultas).

Para repetirlas (con `next start -p 3001` arriba):

```bash
node docs/spec/rediseno/tools/cap-app.js <carpeta> --pid <paciente> --cid <consulta>
node docs/spec/rediseno/tools/chk-app.js --pid <paciente> --cid <consulta> --json <carpeta>/chk.json
```

25 rutas × 5 formatos × 2 temas = 250 capturas, 0 fallos, 0 errores de consola.
Observaciones:

* `/expediente/[id]/laboratorios` y `/expediente/[id]/estado` redirigen hoy a
  `?tab=mediciones` y al resumen: sus capturas repiten las de esas pestañas.
* En `ih` (951 px) la agenda no tiene vista «Semana»: ofrece Mes / 3 días / Día
  (la captura `agenda-semana@ih` es la vista por defecto, «3 días»).

`chk-app.js` (sólo lo visible en la ventana al cargar, sin desplazar). Suma de
hallazgos de las 25 rutas, claro + oscuro:

| Formato | (h) bajo franja | (i) toque < mínimo | (a) desborde | (c) solape | texto < 12 px | consola |
|---|---|---|---|---|---|---|
| `ext` (toque 44) | 194 | 162 | 4 | 0 | 240 | 0 |
| `tel` (toque 44) | 22 | 182 | 6 | 4 | 260 | 0 |
| `ih` (toque 36) | 152 | 112 | 10 | 0 | 382 | 0 |
| `iv` (toque 44) | 0 | 236 | 14 | 4 | 312 | 0 |
| `esc` (toque 36) | 0 | 438 | 14 | 4 | 1 128 | 0 |

(b), (d), (e) y (f): 0 en todas. Ninguna página desborda en horizontal. Lo de
`ext`/`ih` bajo la franja derecha es el hueco ya conocido: la app no usa
`env(safe-area-inset-left|right)` (PLAN §1.3).

## Bloques

| Bloque | Qué | Estado | Commits | Build | Lint (err/avisos) | Unitarias | e2e | Capturas |
|---|---|---|---|---|---|---|---|---|
| B0 | Preparación y línea base | hecho | | ok | 96/68 | 2363/2363 | ver arriba | ANTES |
| B1 | Cimientos: tokens, tipografía, oscuro, sonda, manifest, movimiento | | | | | | | |
| B2 | Primitivas compartidas | | | | | | | |
| B3 | Capas del catálogo | | | | | | | |
| B4 | Navegación por dispositivo | | | | | | | |
| — | ⛔ Parada temprana (push 1) | | | | | | | |
| B5 | Dashboard | | | | | | | |
| B6 | Pacientes: lista, nuevo, editar, alta | | | | | | | |
| B7 | Expediente y laboratorios | | | | | | | |
| B8 | Nueva nota y nota de consulta | | | | | | | |
| B9 | Documentos | | | | | | | |
| B10 | Cuenta y administración | | | | | | | |
| B11 | Ayuda, estadísticas, suplementación | | | | | | | |
| B12 | Integración de pantallas (push 2) | | | | | | | |
| B13 | Agenda (AG0–AG10) | | | | | | | |
| B14 | Retirada del lanzador `/inicio` | | | | | | | |
| B15 | Limpieza final y QA (push 4) | | | | | | | |
