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
| B1 | Cimientos: tokens, tipografía, oscuro, sonda, manifest, movimiento | hecho (con 1 desvío, abajo) | 97eba80a, 800f9221, d0857a1b, 8c153052 | ok | 96/68 | 2391/2391 (sin TZ y UTC) | 9 archivos de agenda = B0 por archivo | DESPUÉS |
| B2 | Primitivas compartidas | hecho | 174abbd8, fc054a4c, fb263d08 | ok | 96/68 | 2391/2391 (sin TZ y UTC) | no corridas (sin consumidores; cajas medidas) | muestra + 5 rutas |
| B3 | Capas del catálogo | B3a hecho (ModalShell, velo, CapaMenu y 4 capas compartidas); B3b hecho (Toast, Skeleton, EstadoVacio/EstadoError, ErrorBoundary, OfflineAlert) | B3a: e7b027ff, 66143a96, 68cf1fb9 · B3b: b7576882, 8fecf2af, 2f0b89dc, 79b69247, a9d253bf, e54bcdad | ok | 92/68 | 2391/2391 (sin TZ y UTC) | B3a: 5 archivos, 25/26 (el que falla = B0, ventana «¿Asistió?») · B3b: 29 pasan, 3 fallan (ver notas) | capas en 5 formatos × 2 temas |
| B4 | Navegación por dispositivo | hecho (con defectos que cerró la integración) | 1aa24407, 9c329f53, 884f3e5a, eef2cb16, 6f3bc6e0 | ok | ver integración | 2391/2391 | 35 pasan, 4 fallan (ver notas) | 3 roles × 5 formatos |
| — | Integración B1–B4 | hecho | ver «Integración B1–B4» | ok | 89/66 | 2391/2391 (sin TZ y UTC) | ver «Integración B1–B4» | 3 roles × 5 formatos × 2 temas |
| — | ⛔ Parada temprana (push 1) | | | | | | | |
| B5 | Dashboard | hecho | 3239f161 (fusión 1b604d62) | ver B12 | ver B12 | ver B12 | ver B12 | ver «B5–B11 · notas» |
| B6 | Pacientes: lista, nuevo, editar, alta | hecho | 278a5815, 2c0d70f2 (fusión e9848d9f) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B7 | Expediente y laboratorios | hecho | 837621ac, 454acc68 (fusión 1719a918, con B8) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B8 | Nueva nota y nota de consulta | hecho | 7b4ed2ff (fusión 1719a918, con B7) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B9 | Documentos | hecho en dos partes | parte 1: 796cd631, 0490d40a, e00eeb10, 181d9ec2, cdfe51bb (fusión 0d0c3a37) · parte 2 (B9b): 61566877, a45329fa, cbdff187, 6fa35647 (fusión 54e4856d) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B10 | Cuenta y administración | hecho | 7776920c, ff66a83e, d5b84ac4, 0f1299cc (fusión 2b2baf0d) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B11 | Ayuda, estadísticas, suplementación | hecho | 21b45d15, e8a78684, d930489e (fusión c8486fe3) | ver B12 | ver B12 | ver B12 | sin e2e propias | ver «B5–B11 · notas» |
| B12 | Integración de pantallas (push 2) | hecho (verificación tras el reinicio del contenedor) | 24ca09ba … a289ce13 y los de la verificación (ver «Integración de pantallas (B12) · notas») | ok | 87/61 | 2425/2425 (sin TZ y UTC) | ver notas | 3 roles × 5 formatos × 2 temas |
| B13 | Agenda (AG0–AG10) | fuera de este cierre: espera el aviso del dueño | | | | | | |
| B14 | Retirada del lanzador `/inicio` | fuera del proyecto (decisión del dueño) | | | | | | |
| — | Cierre de formularios (T1–T4) | hecho | 836d8990, a8ca4d36 · fead58a1, 8b175282 · 94adb879 · a0fc8193 | ok | 87/61 | 2575/2575 (sin TZ, UTC, Hermosillo) | 425/101/640 (ver notas) | 8 formularios + 3 vistas × 5 × 2 |
| B15 | Limpieza final y QA (push 4) | hecho salvo lo sacado del alcance | e0a37c85, 55cb2198, d2c9371e | ok | 87/61 | 2575/2575 | subconjunto igual que B12 | diff de píxeles contra antes de la limpieza |

### B1 · notas

* **CSS principal:** 339 203 bytes (B0: 330 976, +8 227). Ojo: la punta de B0
  con `docs/spec/rediseno` ya en el árbol compila a 334 401 (Tailwind escanea
  también las maquetas), así que lo atribuible a B1 son ~4,8 KB.
* **Desvío del plan (§2.3 c):** `body::before`, `sincronizarBarraDelNavegador` y
  el `themeColor` de `app/layout.tsx` se quedan en `--ag-navy`. La barra
  lateral, la banda de la agenda y la barra del dashboard pintan `--ag-navy`
  (intocable hasta B13); pasar sólo la franja a `--navy` dejaba en oscuro
  #101B30 sobre #2f4f73. Pasan los cuatro juntos al migrar el cromo (B4/B13).
  El manifiesto sí lleva `theme_color #1B2B4A`.
* **Letra base 15/20 y campos a 16 px** sólo con `html[data-formato]`, o sea en
  `(app)` y `(launcher)`: `/login`, `/`, `/register` y `/reservar/…` dan
  capturas idénticas antes/después (la landing difiere sólo en el píxel de su
  animación). Interlineado sin unidad (`calc(20 / 15)`), no `20px`.
* **Sonda** verificada con `Emulation.setSafeAreaInsetsOverride`: ext/derecha,
  tel/arriba, ih/derecha, iv/arriba, esc/ninguno y Duo girado → ext/izquierda;
  en vivo ext→ih→iv con su evento; 0 errores de consola (ni de hidratación).
* **Contrastes de las seis paletas** (sólo afectan a `--accion`/`--tonal`, que
  nadie consume aún): claro, blanco sobre acción 5,10–7,58; oscuro 4,53–5,51
  (Spinus 4,88); el relleno oscuro contra `--sup` queda en 2,88–3,50, por
  debajo de 3:1 sólo en Morado (2,88) y Burdeos (2,92). Subir a L 0,57 lo arregla pero baja el blanco de Verde y
  Pizarra a 4,20/4,43: se dejó en 0,55.
* Para `cap-app.js`, el `--pid` de B0 ya no existe: cada corrida e2e recrea la
  semilla. Pedir uno nuevo a la base antes de capturar.

### B2 · notas

* **CSS principal:** 350 877 bytes (B1: 339 203, +11 674; gzip 60 528).
* **Primitivas** en `sistema.css` (`@layer components`): `.k-b` + `.k-b-prim`,
  `-tonal`, `-texto`, `-icono`, `-quieto`, `-mal`, `-capa`; `.k-campo-g`,
  `.k-etiqueta`, `.k-campo`, `.k-campo-ayuda`, `.k-campo-error`; `.k-tarjeta`;
  `.k-lista`, `.k-fila` (`-t`, `-n`, `-s`, `-der`, `-chev`); `.k-etq` (`-ok`,
  `-mal`, `-aviso`, `-tonal`); `.k-tabs`/`.k-tab`; `.k-seg`/`.k-seg-op`;
  `.k-avatar` (`-32`, `-44`); `.k-est*`; `.k-doc*`; `.k-origen*`. Área real
  por `--k-toque` (44; 36 en `ih`/`esc`, en `:root[data-formato]`).
* **Componentes** en `components/ui/`: `Avatar`, `IconoEstadoCita`,
  `IconoTipoDocumento`, `MarcaOrigen`, sin consumidores. `paletaAvatar.ts` es
  ahora una reexportación de `Avatar.tsx`.
* **Desvío del plan:** la paleta de avatares sigue con DIEZ pares, no seis: la
  rotación del dashboard (`ARRANQUE_AVATAR` 0/4) necesita más de ocho. Se
  decide en B5.
* **Re-piel `.sp-*`:** los bordes de 1 px se quedan, transparentes; el foco
  del campo sigue engordando a 1,5 px. Cajas medidas antes/después en
  dashboard, expediente, nueva nota, receta y perfil, cinco formatos: 1 098
  cajas, 0 cambios de geometría (la única diferencia del dashboard es una cita
  que pasó a «en curso» entre las dos corridas: misma caja, otra clase).
* **Página de muestra** (fuera del repo, HTML con el CSS compilado y los
  componentes renderizados): áreas de toque ≥ 44 (36 en `ih`/`esc`) en todos
  los botones, filas, pestañas y segmentos; 0 textos < 12; 0 desbordes.
* **Visto, no tocado:** en oscuro varios campos y tarjetas de nueva nota y de
  la receta siguen con su borde, porque la hoja de traducción oscura de
  `ThemeProvider`/`globals.css` les pone el suyo; se va con cada pantalla.

### B3a · notas (capas: ModalShell, velo, CapaMenu y capas compartidas)

* **CSS principal:** 363 597 bytes (B2: 350 877, +12 720). Todo en `sistema.css`
  («CAPAS DEL CATÁLOGO» y «Rejilla Tipo de documento»); `globals.css` no se tocó.
* **Área de contenido** por formato con `--capa-arr/-der/-abj/-izq`, que leen los
  `--cromo-riel/-barra-ih/-barra` de B4 con respaldo 60/216/248. Si B4 pliega la
  barra de `esc`, tiene que bajar `--cromo-barra` para que las capas sigan
  centradas en el contenido.
* **ModalShell** misma API + `variante="alerta"`, `tono`, `apilada`, `rol`.
  Salida animada de 260 ms (inerte y sin clics mientras sale; el foco vuelve y el
  scroll se libera al EMPEZAR a salir). Hoja arrastrable sólo en `tel` (no con
  `hideClose` ni `fullscreenMobile`). El velo sigue cerrando los modales (como
  antes); la alerta no se cierra con el velo (capas-a, vista 1).
* **CapaMenu** (nuevo): API en su cabecera. Sin consumidores todavía (B4).
* **Comprobado con script** en una página temporal (no commiteada): foco dentro,
  Tab atrapado, Esc cierra, foco al disparador, cerrar a medio abrir (opacidad
  intermedia, invierte), inerte al salir, arrastre en `tel` (cierra / vuelve),
  movimiento reducido (sólo opacidad 200/150), transparencia reducida (velo
  opaco `--navy`, sin desenfoque). Nada interactivo bajo franjas ni texto < 12
  en las 10 capas × 5 formatos × 2 temas.
* **QuickPatientModal** sin salida animada a propósito (el escudo de doble clic
  cuenta con que desaparezca en el acto) y sin rol/Esc/trapo nuevos (no los
  tenía). Igual `ConsultaRapidaModal` (sin rol), que ahora va en portal.

### B3b · notas (aviso, esqueleto, vacío/error, ErrorBoundary, sin conexión)

Reconstruido del código y de `git log` en la integración (el agente de B3b no
pudo editar este archivo).

* **Toast** (`b7576882`, `e54bcdad`): misma API (`success/error/info/warning`)
  y mismos textos. Arriba y centrado en el área de contenido; `role="status"`
  (éxito, info) o `role="alert"` (error, advertencia) en CADA aviso; cierre
  «Cerrar aviso»; 4 s y 8 s la advertencia, con pausa al pasar o enfocar; Esc
  con el foco dentro; entra y sale por el mismo camino (`translate`/`opacity`
  con `@starting-style`), sólo fundido con movimiento reducido; el más nuevo
  arriba. Colores semánticos fijos del kit, «info» neutro (no sigue la marca).
  B3b lo colocó con medidas supuestas de B4; la integración lo pasó a las de
  verdad (abajo).
* **Esqueleto** (`8fecf2af`): `.skeleton` pasa de `background-position` en
  bucle a pulso de opacidad sobre `--sup2`, quieto con movimiento reducido;
  huesos `aria-hidden` y `aria-busy` en los contenedores. Dejó intacta su copia
  de `.dash-barra-movil`, que quitó la integración.
* **EstadoVacio / EstadoError** (`2f0b89dc`): piezas nuevas de dos niveles
  (página y sección), acción tonal, `role="alert"` en el error. Su único
  consumidor por ahora es `ErrorBoundary`; las adoptan los bloques de pantallas.
* **ErrorBoundary** (`79b69247`): centrado, sin tarjeta, con EstadoError;
  mismos textos, «Reintentar» tonal y «Volver al inicio» sigue siendo `<a>`
  (carga completa).
* **OfflineAlert** (`a9d253bf`): la alerta del patrón único con su excepción
  aprobada (sin botones, no se descarta, se va sola); velo del kit, tarjeta de
  320/310/340, `alertdialog` con el foco dentro y devuelto al irse; sigue
  esperando 4 s; sale animada al volver la red.
* e2e de B3b (con su propia configuración, fuera del repo): 29 pasan, 3 fallan,
  32 saltadas; uno de los fallos es `agenda-j5-configuracion` («crear otro sin
  recargar»). No se reclasificaron aquí: la batería de la integración (abajo)
  los cubre por archivo.

### B4 · notas (navegación por formato)

Reconstruido del código y de `git log` en la integración.

* **`Sidebar.tsx`** conserva datos, permisos por rol, bloqueo por plan y el
  cierre de sesión con su auditoría (`await` a `/api/auth/audit-login`) y la
  limpieza de cachés, y pinta cuatro presentaciones que elige CSS por
  `data-formato` (ninguna en JS en el primer render): `RielNavegacion` en ext
  (60 + franja), `EncabezadoFundido` en tel e iv (con cinco píldoras en iv),
  barra derecha de 216 en ih e izquierda de 248 en esc. En tel/iv/ext la misma
  `<aside id="barra-lateral">` es el cajón (arrastre y Esc). «Más» (ext, iv) es
  `MenuMas`.
* **Navegación plana** (aprobada): Inicio · Expediente · Agenda · Documentos ·
  Administración. Suplementación pasa a un enlace en la cabecera de
  `/expediente`; Estadísticas, Usuarios y Facturación son pestañas de
  Administración (`components/admin/PestanasAdministracion.tsx`, las dos
  últimas sólo para quien administra). «Dashboard» pasa a «Inicio» (e2e al
  día).
* Aviso de pendientes sin animaciones infinitas, con distintivo en «···» y en
  el botón de menú; selector de consultorio con el logo de la clínica; banner
  de suscripción como tarjeta dentro del contenido; ⌘K anclada arriba como
  `dialog` con nombre; plegar el menú en esc dentro de la agenda.
* Relleno del contenido por formato (`.app-contenido`) con su pareja de la
  agenda actualizada; `--cromo-*` en `globals.css`; franja (`body::before`) en
  `--navy` salvo con la banda de la agenda.
* e2e: `agenda-f-barra` 256 → 248 y sin el caso del grupo plegado (la
  navegación es plana); nueva `rediseno-formatos` con los proyectos
  `duo-cerrado` y `duo-abierto` (franjas por CDP); `E2E_BASE_URL` para otro
  puerto. Su corrida: 35 pasan, 4 fallan (`agenda-reflejo-enlace` punto 5 en
  los dos proyectos y `rediseno-formatos` en los dos del Duo; éste quedó
  corregido en `6f3bc6e0`, que cuenta sólo lo FIJO bajo la franja inferior).

### Integración B1–B4 · notas

* **Verde tras la fusión, sin tocar nada:** build exit 0, lint 89/66 (bajo el
  tope 96/68), vitest 163/2391 sin TZ y con `TZ=UTC`.
* **CapaMenu no absorbe los tres menús a mano de B4**, y queda escrito en cada
  archivo por qué: «Más» lleva la tarjeta ámbar, la fila de consultorio que
  despliega su lista y enlaces de verdad; el de ajustes, el Aviso de Privacidad
  en pestaña nueva y «Cerrar sesión» girando mientras se audita; el de
  consultorio mezcla opciones con palomita y el enlace «Gestionar consultorios
  →». CapaMenu sólo tiene opciones-botón (todo-radio o todo-opción) y cierra
  al elegir. Sigue sin consumidores (los tendrá en B7/B9).
* **Una sola fuente para las medidas del cromo.** Toast, OfflineAlert, capas
  (`--capa-*`, sin respaldos repetidos), «Más» y ⌘K leen las `--cromo-*`; la
  barra plegada de la agenda es `--cromo-barra: 64px` (barra, `<main>`, capas,
  aviso y ⌘K la siguen); sin navegación (`/inicio`) el cromo mide 0. El aviso
  baja hasta `--capa-aviso-arr` (bajo el encabezado en tel/iv). Lo que ocupa la
  navegación a cada lado es `--cromo-izq`/`--cromo-der` (márgenes de `<main>`,
  espejados). Medido: `--capa-izq/-der/-aviso-arr` correctos en los 5 formatos,
  en `/dashboard`, `/agenda`, `/agenda` plegada (esc: barra y `<main>` a 64) y
  `/inicio` (cromo 0).
* **Escala de z-index** documentada en `sistema.css`: cromo 40, franja y capas
  de la agenda 45 (sin tocar), capas 50–70, ⌘K y consulta rápida
  `--z-paleta` 9998, «Sin conexión» `--z-sin-conexion` 9999, aviso `--z-aviso`
  10000. Fuera de escala, a propósito: `OnboardingGuide` (10001/10002; hoy sin
  montar).
* **Franja, cromo y barra del navegador del mismo color.** Dentro de la app la
  franja es `--navy` (`body:has(#barra-lateral)`) y `--ag-navy` con la banda de
  la agenda móvil; `sincronizarBarraDelNavegador` lee el color del propio
  `body::before`, y un observador ligero resincroniza cuando la banda aparece o
  se va. Medido: `/dashboard` → #1b2b4a en franja y `theme-color`; `/agenda`
  móvil → `--ag-navy` y #163250; `/agenda` esc → `--navy`. Fuera de la app
  (`/login`, `/`, `/reservar`, `/confirmar`, `/inicio`) la franja vuelve a ser
  la de B0 (`--ag-navy`), y el `themeColor` estático sigue en sus valores de B0.
* **Defectos corregidos** (front, dentro de B1–B4): ver la lista del informe de
  la integración; los principales: barra de ih cortada con tres pendientes y
  pie con elipsis (ih y esc); «Guardar» de `/perfil` debajo del riel o de la
  barra de ih y de la franja (inalcanzable); alerta «Cambiar consultorio
  activo» con botones sin base `k-b`; velo de «Más»/cajón/⌘K sin desenfoque en
  Chrome (minificador); copia de `.dash-barra-movil` en el esqueleto.
* **Abierto, de pantallas (B6):** en ih `/expediente` desborda en horizontal
  dentro de `<main>` (813 en 651): filtros en una fila y tabla con mínimo,
  pensados para 867 de ancho (B0 no tenía barra en ih).
* **Agenda en ext (B13):** con el riel, la banda de la agenda tiene 322 px y el
  filtro de médico de su segunda fila queda en 50 px con la v2 apagada y 26
  con la v2 encendida (el rótulo no se lee; sigue abriéndose). No se toca hasta
  la agenda.
* **CSS principal:** 386 687 bytes, gzip 66 434 (tras la fusión, sin tocar:
  386 613; la integración suma 74).
* **e2e** (44 archivos de la lista de la integración, los cinco proyectos que
  les tocan, contra `next start -p 3001`, sábado 21-nov de 21:50 a 22:25 UTC):
  `121 passed`, `101 failed`, `192 skipped`, `131 did not run`. Contra B0 por
  caso: **ninguno que pasaba en B0 falla por el rediseño**. Los 13 que pasaban
  en B0 y fallaron:
  * 3 de `agenda-cancelar`: la ventana «¿Asistió el paciente?» (AG-DT-256; su
    texto «Más de 48 horas y sin nota clínica.» intercepta el clic). B0 corrió
    a las 10:56 de Mérida y ésta a las 15:50: más citas de la semilla cumplen
    las 48 h.
  * 8 en cascada de otra prueba: `agenda-f-burbuja` «con la suscripción
    bloqueada…» pone la Clínica A en `cancelado` sin VIP, se agota (la tapa la
    misma ventana) y su `finally` no llega a devolverla; desde ahí `agenda-f-
    movimiento` (4), `agenda-f-simetria` F1.17, `agenda-f-tarjeta` «apagado»,
    `agenda-f-pulido` F1.4 y `agenda-secretaria` ven «Función no disponible».
    Devuelta la clínica a `free` + VIP (como la deja la semilla) y repetidos,
    los ocho pasan.
  * `agenda-citas` «alta … eco propio»: el eco de Realtime no llegó en 10 s;
    sola, pasa.
  * `agenda-f-buscador` «médico invitado … RLS»: falla en su precondición SQL
    («la semilla no tiene un paciente con citas de los dos médicos», ventana de
    29 días sobre `now()`), antes de abrir ninguna página.
  * `rediseno-formatos` (nueva en B4) «⌘K…»: perdía la tecla si llegaba antes
    de hidratar, una de cada dos corridas; adaptada (reintenta mientras la
    paleta no está). Tres corridas seguidas de los dos proyectos del Duo: 11/11.
  Las `reserva-*` y `confirmacion-*` siguen fallando como en B0 (mismo caso por
  caso), ahora con `RESERVA_SECRETO` puesto: no se investigó más (fuera de
  alcance; el aviso de reserva local, P7, sigue sin aprobar).
* **Producción (agenda v2 apagada y sin migraciones):** recorrido con la v2
  apagada en la Clínica Semilla A, 17 rutas × 5 formatos × 2 temas, 0 errores
  de consola; la agenda v1 conserva su banda, su relleno y su «Abrir menú». Con
  las tablas y RPC de la v2 simuladas como ausentes en el navegador (404
  PGRST205/PGRST202), el dashboard y la agenda caen en apagado sin romper.

### Corrección de la sonda de formato en el Duo real · notas

* **Defecto (visto por Angel en su iPhone Duo, app instalada):** Duo cerrado
  salía como `tel` (encabezado con hamburguesa en vez del riel) y Duo abierto
  en horizontal como `iv` (píldoras en vez de la barra a la derecha). El
  vertical (franja arriba) estaba bien.
* **Causa:** la sonda decidía «franja lateral» sólo por
  `env(safe-area-inset-right/left) > 0`. Con la franja a un LADO, iOS la deja
  FUERA del viewport (también con `viewport-fit=cover`): los insets laterales
  valen 0 y la página mide la pantalla menos la franja (~382 de 466, ~867 de
  951). Las pruebas no lo veían porque emulaban el inset por CDP.
* **Arreglo** (`src/lib/formatoPantalla.ts`, sonda y `clasificarFormato`
  juntas): hay franja lateral con inset lateral > 0 **o** si
  `screen.width − innerWidth` o `screen.height − innerWidth` cae en [60, 120],
  sólo por debajo de 1024 y con la pantalla declarada en vertical
  (`screen.width < screen.height`, como la da iOS; deja fuera computadoras con
  la ventana estrecha y Android en horizontal). Deducida y sin inset, el borde
  vale `derecha`. El CSS no cambió: todo lo que toca la franja va con
  `var(--ir/--il)`, que con la franja fuera valen 0, y el riel y la barra quedan
  pegados al borde del viewport (capturas y e2e).
* **⚠️ ASUNCIÓN PENDIENTE DE CONFIRMAR EN EL APARATO:** que `screen.width/height`
  del Duo dan el tamaño total (466×678 cerrado, 669×951 abierto). Para
  comprobarlo, **línea de diagnóstico TEMPORAL** al pie de `/ayuda`
  (`src/app/(app)/ayuda/DiagnosticoFormato.tsx`): formato, borde, ventana,
  screen, los cuatro insets, `devicePixelRatio` y `standalone`. **Se retira en
  B15.**
* **Riesgo conocido:** Safari en horizontal SIN `viewport-fit=cover` (la app sí
  lo lleva) podría estrechar el viewport por las dos muescas (~2 × 59 = 118) y
  caer en el rango → `ih` en vez de `iv`. Con `cover` no ocurre (ancho 852 y
  diferencia 0). También un iPad con Stage Manager en una ventana 60–120 más
  estrecha que la pantalla.
* **e2e:** proyectos nuevos `duo-cerrado-real` (382×678, `screen` 466×678) y
  `duo-abierto-real` (867×669, `screen` 669×951), sin insets; la prueba
  comprueba además que el riel/la barra llegan al borde (de la franja o del
  viewport) con su ancho. La bisagra de `ih` (x 455–496) se mantiene: con la
  franja a la derecha y fuera, el viewport empieza en el x 0 de la pantalla.

### La franja del Duo real con capas abiertas · notas

* **Hecho observado en el aparato (iPhone Duo, iOS 26/27):** con la franja a
  un lado (`ext` y `ih`) iOS la deja fuera del viewport y la rellena con un
  color que muestrea de la página: el fondo de body/html, salvo que un
  `position: fixed` toque ese borde, que entonces manda. Con el riel navy
  pegado salía navy; al abrir «Más» o cualquier capa con velo
  `fixed; inset: 0` translúcido + desenfoque, salía clara.
* **⚠️ REGLA NUEVA (B5–B13 la respetan):** en `ext` e `ih` **nada fijo toca el
  borde del lado de la franja salvo el cromo navy opaco** (riel en `ext`, barra
  en `ih`, los dos a sangre de arriba abajo, sin transparencia ni desenfoque).
  Toda capa o velo nuevo a pantalla completa usa `.k-capa` (o lleva
  `fixed inset-0`) y la regla central de `globals.css` lo acaba en
  `--fijo-der`/`--fijo-izq` (= `--cromo-der`/`--cromo-izq` en `ext`/`ih` con
  navegación; 0 en el resto). Algo fijo que llegue al borde por otro camino
  (`inset-inline: 0`, `right: 0`, un `style` en línea) tiene que ir a esa
  regla. Lo vigila la e2e de `rediseno-formatos` («sólo el cromo toca el borde
  derecho»).
* **Cubierto por la regla central:** `.k-capa` (ModalShell —alertas,
  SelectorTipoDocumento, BloqueoFeatureModal—, CapaMenu, QuickPatientModal,
  ConsultaRapidaModal), `.nav-capa` («Más»), `.nav-paleta` (⌘K),
  `.nav-cajon-velo`, `.ag-capa-velo`, `.ag-hoja` y todo `.fixed.inset-0`
  (modales de la agenda, OfflineAlert, filtros del expediente, admin). El
  relleno de `.k-capa`, `.nav-capa` y `.nav-paleta` descuenta el cromo: la
  tarjeta queda donde estaba. OfflineAlert resta `--fijo-*` en su caja interior
  (único cambio fuera del CSS). El Toast nunca tocó el borde (`--capa-der`).
* **Fuera, a propósito:** `.sp-firma-modo` (la firma del paciente tapa la
  pantalla entera para que no alcance la navegación: es su función; con él
  abierto la franja será de su fondo). Las `.ag-capa` ancladas las coloca
  `posicionCapa` dentro de la ventana con margen: no tocan el borde, pero
  pueden caer encima del riel (B13).
* **Cromo inerte con una capa abierta:** `pointer-events: none` sobre el riel
  (`ext`) o la barra (`ih`) mientras hay una capa modal; sin opacidad. Tab:
  ModalShell (y CapaMenu) atrapan el foco; «Más» (`MenuMas`) y ⌘K **no** lo
  atrapan (ya era así detrás del velo): con Tab se puede llegar al cromo. No se
  añadió JS.
* **310 en `ext`:** el área mide 382 − 60 = 322 y con 8 por lado la tarjeta se
  quedaba en 306. El margen horizontal de las capas cede a 6 en `ext`
  (`--capa-holgura`, vuelve a 8 si el área crece); «Más» y la alerta miden 310
  y van centradas (e2e).
* En `tel`, `iv`, `esc`, sin formato y en el lanzador nada cambia (sonda de las
  capturas: en `tel`/`esc` las capas siguen a pantalla completa).

### B5–B11 · notas (oleada de pantallas)

Reconstruido en B12 del código y de `git log` (los informes de los agentes se
perdieron con el reinicio del contenedor). Las cifras de build, lint, unitarias
y e2e de cada bloque no se conservan: las válidas son las de B12, medidas sobre
la rama ya integrada.

* **B5 · Dashboard** (`3239f161`). Pieza principal «Lo que sigue» con la cita en
  curso o la siguiente; «Después» con filas enteras que abren la hoja de acciones
  de la cita (ModalShell); `IconoEstadoCita`, `MarcaOrigen`, «Sin expediente» a la
  vista; «Ligar paciente e iniciar consulta» con eslabón (sólo las etiquetas del
  dashboard; `VentanaLigarCita` queda para AG7); leyenda tras «Estados»; «Hoy»
  fundida en la cabecera (tira sólo en iv); secretaria con filas «Ver cita» y
  conteos como mosaicos. e2e `agenda-i3`, `agenda-j3`, `agenda-k5` al día con
  los rótulos nuevos.
  * **De la maqueta, NO dibujado (pide datos que no hay):** el avance «4 de 6»,
    «14 consultas esta semana», «Plan VIP», los conteos de sala y la marca de
    Google en las citas ya ligadas.
* **B6 · Pacientes** (`278a5815`, `2c0d70f2`). Título «Expediente»; buscador,
  «Ordenado por» (menú del catálogo) y «Filtros» (§30.3: hoja con borrador en
  ext/tel, capa de aplicación inmediata en ih/iv/esc); tabla en ih/iv/esc con la
  edad bajo el nombre en ih/iv, lista en ext/tel; cabe sin desplazamiento
  horizontal en ih (cierra el abierto de la integración B1–B4). Nuevo/editar:
  filas «rótulo — campo», «‹ Expediente», alerta «Paciente duplicado» de tres
  botones, consentimiento con la casilla a la derecha, pie fijo.
  * **Se aparta de la maqueta:** Sexo como segmentado con radios `required`;
    «Filtros» en esc como tarjeta con velo (no panel lateral); el error del
    formulario en línea dentro del pie.
* **B7 · Expediente y laboratorios** (`837621ac`, `454acc68`). En esc ficha a la
  izquierda y pestañas a la derecha; «···» «Acciones del paciente» con Editar,
  Exportar y «Eliminar paciente» en alerta destructiva; `.k-tabs` con conteo
  plano; resumen con plegables (§30.4); línea de tiempo con icono de tipo en
  color; analitos con los encabezados de §23.6; archivos clínicos como lista;
  `SelectorSegmentado` pasa a `.k-seg` (ya no anima `left/width`); gráfica en
  `--accion`.
  * **Se aparta de la maqueta:** las acciones del paciente van al «···» también
    fuera de esc; los signos vitales no se pliegan.
* **B8 · Nueva nota y nota de consulta** (`7b4ed2ff`). «‹ <paciente>» en vez de
  las migas (Breadcrumbs queda sin uso), título «Nueva nota», alergia como
  etiqueta, «La nota aparecerá aquí» en esc, «Revisar» y «Guardar nota» parejos;
  nota de consulta en columna centrada, «Nota manual/IA», «Nota sellada»,
  addendum con `.k-campo`, sigue inmutable. `CuerpoNota` justificado con
  `hyphens` y `lang="es"`.
* **B9 · Documentos**, parte 1 (`796cd631`, `0490d40a`, `e00eeb10`, `181d9ec2`,
  `cdfe51bb`) y parte 2 / B9b (`61566877`, `a45329fa`, `cbdff187`, `6fa35647`).
  `/documentos` en columna de 640; un solo mensaje al fallar el guardado (alerta
  «No se pudo guardar»/«Aceptar») en los 8 formularios; modal posterior con
  «Descargar» en todos los marcos; plantillas con alertas del catálogo; piel de
  §26 en los formularios (sólo CSS, nombres y orden de campos intactos); cabecera
  del formulario con el tipo y «Cambiar», «···» (CapaMenu) con borrador,
  plantillas y vaciar; firmado dentro de las franjas, lienzo siempre papel.
  * **Se aparta de la maqueta:** «Compartir» se queda donde el navegador lo
    admite (quitarlo pierde la hoja del sistema); la plantilla se elige con el
    desplegable nativo; la casilla «urgente» de las solicitudes se conserva; la
    cabecera de la entrada dice «Documentos».
* **B10 · Cuenta** (`7776920c`, `ff66a83e`, `d5b84ac4`, `0f1299cc`). Mi perfil
  con filas, identidad a la derecha en esc, paletas con vista previa, grupo
  «Ajustes» (Modo oscuro, Aviso de Privacidad; «Cerrar sesión» llegó en B12),
  «Editar consultorio» como capa; Usuarios con «Invitar», «Tu equipo» y el vacío
  «Todavía no hay nadie en tu equipo»; Facturación con barras de uso en `scaleX`
  y textos §23.10; asistente de perfil de 7 pasos. Sin cambios de Stripe.
* **B11 · Lectura** (`21b45d15`, `e8a78684`, `d930489e`). Estadísticas con
  `EstadoError` + «Reintentar» (arreglo: sin red se quedaba en el esqueleto);
  ayuda en columna de 680 + apoyo de 296 en esc, acordeón con `hidden` y
  `@starting-style` (ya no anima `max-height`); suplementación en rejilla de 2
  desde ih.
  * **Se aparta de la maqueta:** el orden de las columnas de ayuda; el Top 10
    de estadísticas en barras HTML (nombre y número a la vista) en vez de la
    gráfica.

### Integración de pantallas (B12) · notas

Hecha en tres tramos: dos agentes cerraron los pendientes de código (abajo) y el
contenedor se reinició a mitad de la verificación; la verificación se rehízo
entera sobre `a289ce13` y lo que siguió. Domingo 22-nov, 04:44–06:40 UTC
(sábado noche en Mérida).

* **Commits:** `24ca09ba` «Cerrar sesión» en Ajustes de Mi perfil (mismo
  `useCierreSesion`, exportado; engrane del médico → `/perfil#perfil-sec-ajustes`;
  la secretaria conserva el menú) · `4753b832` DashboardSkeleton con la retícula
  de B5 · `cb6ab549` `.k-campo-sin-caja` central, aviso «info» sin interceptar
  toques sobre capas, «‹ Expediente» parejo · `d3cfeec3` chip de médico a 12 px y
  «···» de la lista con área propia · `92dcea67` fondo `--fondo` con navegación ·
  `586b2829` «Paciente no encontrado» como EstadoVacio, chip elegido legible ·
  `2e2c4373` `E2E_SIN_SEMILLA=1` · `c5cd590f` «Agregar suplemento» abre el
  catálogo de nueve (sólo presentación: misma `toggleSup`, mismo contenido del
  PDF) · `27279f4e` rejilla «Tipo de documento» y cabecera del formulario en
  `@layer components` · `a289ce13` e2e del enlace profundo acotada al modal ·
  `51637321` la fila de pestañas de Administración no salta (esc/ih) ·
  `f0b9c5b3` los esqueletos de Administración llevan su fila de pestañas.
* **Verde:** `npm run build` exit 0; `tsc` exit 0; eslint del repo
  `✖ 148 problems (87 errors, 61 warnings)` (tope 89/66); vitest
  `163 passed / 2425 passed`, sin TZ y con `TZ=UTC`.
* **e2e** (los 105 archivos, todos los proyectos, en 6 tandas con la
  `global-setup` normal: resiembra por tanda): **427 passed, 100 failed, 639
  skipped/did not run** de 1 166 (B0: 290/180/654 de 1 124; los 42 nuevos son
  `rediseno-formatos` en los cuatro proyectos del Duo, todos verdes). Por caso
  contra B0: **ningún caso que pasaba falla por el rediseño.** 3 pasan→fallan:
  `agenda-cancelar` «encendido…», clic interceptado por «¿Asistió el paciente?»
  (AG-DT-256, la noche del sábado). 2 saltadas→fallan, de entorno:
  `whatsapp-manual` «la lista de mañana» y `agenda-eleccion-i2` «Reagendar con
  correo» (el `.env.local` no tiene `EMAIL_TRANSPORT=captura` ni
  `RESERVA_AVISO_BORRADOR_LOCAL=1`; repetidas solas, fallan igual). ~127
  fallaban o se saltaban en B0 y ahora pasan (la resiembra por tanda evita las
  cascadas). Los fallos que quedan son los de B0: la ventana «¿Asistió?»,
  `Falta RESERVA_SECRETO` de los ayudantes de e2e y `sin_enlace`.
* **Capturas** de 28 rutas (admin), 13 (médico) y 12 (secretaria) × 5 formatos
  (ext/ih con el viewport real) × 2 temas: 533, sin fallos. Sin desbordes
  horizontales (salvo `/calculadoras-clinicas` en ext, fuera del rediseño), nada
  fijo en el borde derecho en ext/ih, consola 0 con admin (con el médico: el 406
  de abrir un paciente ajeno —RLS— y el 403 de RED-DT-19). `chk-app.js`: consola
  0; bajo la franja ext 14 · tel 16 · ih 18 · iv 0 · esc 0 (B0 194/22/152/0/0);
  texto < 12 fuera de la agenda sólo el «NOV» del chip de fecha (excepción
  documentada). Las (a)/(i) de iv son las píldoras de B4 (40 px con `::after` de
  44: falso positivo de la herramienta).
* **Producción (v2 apagada):** dashboard y agenda v1, admin y secretaria, 5
  formatos: 0 errores, la agenda v1 con su barra, leyenda y «Plegar menú».
* **IA de nueva nota** (petición interceptada en el navegador, sin llamar al
  servicio): redactando, entrevista, «Tu nota está lista» y «Ajusta el
  contexto» bien en esc y tel.
* **Reglas que B13 debe respetar** (además de las de B1–B4):
  * El fondo de la app con navegación es `--fondo` (`body:has(#barra-lateral)`).
  * Campo sin caja en oscuro: `.k-campo-sin-caja`, nunca otra copia de
    `[html.dark_&&]:!bg-transparent`.
  * La rejilla de tipos y la cabecera del formulario viven en
    `@layer components`: una regla nueva que deba ganarles va en la misma capa
    con más especificidad, no sin capa.
  * Una pantalla con fila de pestañas compartida usa el MISMO contenedor en
    todas sus pestañas y también en su esqueleto (lo que varía es el ancho del
    contenido, no el de la fila).
  * «Cerrar sesión» sólo con `useCierreSesion`; nada de copiar su lógica.
  * Para correr e2e en la base compartida, `E2E_SIN_SEMILLA=1`.
* **Para B15:** `dashboard/StatusChip.tsx` (sin importadores);
  `fechaCitaCompacta` de `dashboard/utils.ts` (sólo la usan sus pruebas); la
  variante `layout="grid"` de `labs/CardDocumento.tsx` (sólo se usa `list`);
  `ayuda/DiagnosticoFormato.tsx` (temporal, ver la corrección de la sonda);
  `layout/Breadcrumbs.tsx` (sin uso desde B8); en `PlanSuplementacionForm` el
  comentario huérfano de `PropsTarjeta` y la rama de tarjeta sin elegir.
* **Visto y abierto (no se tocó):**
  * Nueva nota: la tira de signos vitales trunca sus rótulos en esc
    («PRESIÓN ARTER…», «TEM…») y en ext («PA · MM…»), y la tarjeta «Cuéntame la
    consulta» sigue en vez del campo único de la maqueta; los signos vitales no
    se pliegan.
  * `/expediente/[id]` carga con el texto «Cargando expediente...», sin
    esqueleto; «Paciente no encontrado» no ofrece «‹ Expediente».
  * Rótulos sobre el título distintos en pantallas hermanas: Estadísticas
    «Clínica», Usuarios «Admin», Facturación «Cuenta»; el de `/documentos` en
    `--enlace` y el resto en gris; «Nota de Consulta» con mayúscula frente a
    «Nueva nota». Son textos: los decide el dueño.
  * «‹ Expediente» desde documentos vuelve al Resumen, no a la pestaña
    Documentos; `/suplementacion` no tiene «‹ Expediente».
  * El enlace profundo `?documento=` no se probó: la semilla no tiene documentos.

### Receta compacta · notas (2026-11-22)

* **Qué es:** el formulario de receta de la maqueta aprobada por el dueño
  (`receta-compacta.html`): un medicamento abierto y los demás plegados a una
  línea (número, comercial, presentación · genérico, indicaciones recortadas,
  vía en color sin leyenda). Piezas: `LineaMedicamento`, `MedicamentoReceta`,
  `BuscadorMedicamento`, `SelectorVia` y la lógica pura `recetaCompacta.ts`
  (con `src/lib/tests/recetaCompacta.test.ts`); estilos en
  `spinus-tokens.css` §26.1 (`.sp-rx-*`, tokens `--via-iv-*` y `--via-sc-*`).
* **Cambios de COMPORTAMIENTO, todos por decisión del dueño** (excepción
  aprobada a «sólo estética»):
  * la vía nace vacía y es obligatoria (antes «Oral» por defecto); el catálogo
    la rellena cuando su presentación o su nombre la dicen
    (`MedicamentoDB.via`, 247 de 339 filas; las dudosas quedan sin vía, ver
    RED-DT-20);
  * un medicamento con algo escrito y a medias bloquea la impresión, se abre y
    se dice qué le falta (antes se descartaba en silencio);
  * aviso suave que NO bloquea si a las indicaciones les falta frecuencia o
    duración («Revisar» / «Imprimir así»; heurística `sinPauta`);
  * se pliega al tocar o enfocar fuera; vacío y no único, se quita;
  * «Agregar medicamento» es uno, al final, más Ctrl/⌘+Enter (antes uno por
    bloque); el nuevo va al final;
  * la «dosis sugerida» del catálogo es ficha insertable (antes una pista), y
    hay fichas de frases frecuentes;
  * una fila de plantilla SIN la clave `via_administracion` se aplica sin vía
    (antes se rellenaba «Oral»): no se inventa una vía; las plantillas
    guardadas por el formulario siempre la llevan.
* **Lo que NO cambia:** las claves de `contenido` y las seis de cada
  medicamento (comprobado sobre filas emitidas en local), el PDF, el flujo de
  imprimir/guardar/plantillas/descarga, la precarga desde la nota («Oral») y
  el búnker (sin red: el buscador es local).
* `ComboEscribible` filtra sin acentos (afecta a sus cuatro consumidores).
* Se retiró la ayuda «Del catálogo · editable» bajo el genérico (la maqueta no
  la lleva).
* Reglas para el siguiente: la lista del buscador va DENTRO del medicamento
  (no en portal) para que tocarla no cuente como «salir»; plegar con el
  puntero se hace al soltar y en `setTimeout`, nunca en `pointerdown`.

### Solicitud de laboratorio rápida · notas (2026-11-22)

* **Qué es:** la solicitud de laboratorio de la maqueta aprobada por el dueño
  (`laboratorio-rapido.html`): UN buscador (`BuscadorEstudio`) que añade con
  Enter y queda vacío y con el foco; lo pedido como fichas con ✕ y
  «Solicitados · N» (`FichasEstudios`: `PedidosLab`, `FrecuentesLab`); «Ver el
  catálogo por categoría» plegado con casillas y «n de total»
  (`CatalogoEstudios`); lógica pura en `estudiosPedidos.ts` (prueba
  `src/lib/tests/estudiosPedidos.test.ts`); estilos en `spinus-tokens.css`
  §26.2 (`.sp-lab-*`, reusa `.sp-rx-fi`, `.sp-rx-lista`, `.sp-rx-op`,
  `.sp-rx-campo`).
* `estudiosLab.ts` exporta `CATEGORIAS_LAB` (24 secciones) y `ESTUDIOS_LAB`
  se deriva de ella: mismo contenido y orden.
* **Cambios de COMPORTAMIENTO (excepción del dueño):** ya no hay renglones con
  combo ni «Agregar»; sin duplicados (sin acentos ni mayúsculas); las diez
  frecuentes piden el NOMBRE DEL CATÁLOGO («TP» → «Tiempo de Protrombina (TP /
  INR)»…). Una plantilla o borrador con el texto viejo se aplica tal cual y su
  ficha no se enciende (aceptado). Sin reordenar (el orden no importa).
* **Lo que NO cambia:** `contenido` (paciente, diagnostico, estudios como
  lista de cadenas, notas, fecha; comprobado en filas emitidas en local), el
  PDF, plantillas, validación «Falta 1 campo: Estudios» (ahora lleva el foco
  al buscador), error único y modal posterior. El búnker: todo local.
* Lo escrito en el buscador sin añadir no cuenta para «formulario vacío».
* Con 15 estudios el formulario NO cabe en 1280×800: la página desplaza 1392
  sobre 800 (sólo el formulario mide 1142). Lo que sobra es la columna de
  640 px, la cabecera y la tarjeta de plantillas, fuera de este formulario.
* **Densidad de ratón (`ih`/`esc`, 2026-11-22):** fichas de frecuentes y
  solicitados a 32 de dibujo y 13 de letra con huecos de 6 (área de 36 por
  `::after`, el ✕ de 28 con área de 36), relleno ceñido en datos, «Estudios»
  y notas, y los datos del paciente en filas de 36 (`.sp-lab-datos`). Con 15
  estudios a 1280×800 la página pasa de 1392 a 1192 (el formulario, de 1142 a
  942). `tel`/`ext`/`iv` sin cambios. Sigue sin caber: lo que queda es la
  cabecera, la tarjeta de plantillas y la columna de 640.

### Solicitud de imagen compacta · notas (2026-11-22)

* **Qué es:** la solicitud de imagenología de la maqueta aprobada por el
  dueño (`solicitud-imagen.html`), de la familia de la receta: un estudio
  abierto (`EditorEstudioImagen`) y los demás plegados a una línea
  (`LineaEstudioImagen`: etiqueta del tipo con color, región + lado en
  negrita, tipo completo, proyecciones · indicación, «Falta …» en rojo).
  Buscador único «tipo + región» (`BuscadorImagen`, sin acentos, puntúa el
  inicio de palabra: «rx col lum» → Columna lumbar). Catálogo tipado en
  `src/lib/estudiosImagen.ts` (11 tipos, 171 regiones, 75 con
  `verificar: true`, sin notas ni fuentes); lógica pura en
  `imagenCompuesta.ts` (pruebas `imagenCompuesta.test.ts` y
  `estudiosImagen.test.ts`); estilos en `spinus-tokens.css` §26.3
  (`.sp-img-*`, reusa `.sp-rx-*` y `--via-*`).
* **Cambios de COMPORTAMIENTO (excepción del dueño):** según tipo y región
  aparece sólo lo que aplica: lado obligatorio donde la región lo lleva;
  contraste obligatorio y sin valor por omisión en TC y RM (implícito en
  angio, con su nota); tipo de mastografía; proyecciones sólo en Rx y Mx
  (rutina premarcada, especiales y «Otra»). «Otro» = los cuatro campos libres
  de antes. Sin «Frecuentes»; la EMG, «Mielograma» y lo que no es imagen
  salen de la lista de tipos (quien los necesite, «Otro»). Un estudio a
  medias bloquea la impresión, se abre y el aviso dice qué falta (patrón de
  la receta). «Agregar estudio» es uno, al final, más Ctrl/⌘+Enter.
* **Composición:** las cuatro cadenas como `cadenas()` de la maqueta (tipo +
  contraste en minúscula, «Ultrasonido Doppler», «Gammagrafía»; proyecciones
  con «, » y « y »), salvo una decisión propia: el lado CONCUERDA con la
  región («Hombro derecho», «Ortejos izquierdos»; la maqueta escribía «Hombro
  derecha»). Fluoroscopía compone como la maqueta («Estudios contrastados
  (fluoroscopía)» · estudio), no como el `tipoEnPdf` del JSON.
* **Lo que NO cambia:** `contenido` (`paciente`, `diagnostico`, `estudios`
  de cuatro cadenas, `urgente`, `fecha`; comprobado en una fila emitida en
  local), el PDF, el búnker (todo local), las plantillas (mismas claves),
  «Marcar como urgente», el pie, el error único y el modal posterior.
* **Compatibilidad con lo guardado:** al aplicar una plantilla se intenta
  reconocer cada estudio, y sólo se acepta si al volver a componerse da
  EXACTAMENTE el mismo texto; si no, se abre en «Otro» con sus cuatro
  cadenas intactas. Riesgo aceptado: una plantilla vieja «Tomografía (TAC)»
  se reconoce y ahora pide el contraste antes de imprimir.

### Solicitud de internamiento compacta · notas (2026-11-22)

* **Qué:** maqueta aprobada `internamiento.html` llevada a la app
  (`5e2fe0c9`, `facbce2c`). Cinco secciones numeradas (`SeccionPaso.tsx`,
  controlada; `SeccionPlegable` sigue intacta para el consentimiento), UNA
  abierta y las demás en una línea con su resumen (verde completa; rojo
  «Falta …» tras intentar imprimir). Tab en el último control abre la
  siguiente con el foco en su primer campo; tocar o enfocar fuera pliega
  (la escucha de la receta, sin comerse el clic; capas con `role` fuera).
  Tipo y ASA en `OpcionesRapidas.tsx` (radiogroup, flechas mueven el foco,
  segundo toque deselecciona). Requerimientos en `MenuRequerimientos.tsx`
  (menú `role="menu"` con casillas y «Otro»; fichas sólo de lo elegido).
  `IndicacionesPiso.tsx` es ahora la hoja de órdenes (cuatro grupos fijos
  siempre; Enter, Tab, Retroceso, ↑/↓, pegar varias líneas, «Otro grupo» con
  nombre editable sin repetir). Lógica pura en `internamientoCompacto.ts`
  (pruebas `internamientoCompacto.test.ts`); estilos en `spinus-tokens.css`
  §26.4 (`.sp-int-*`, reusa `.sp-rx-campo/-rot/-fi/-ta/-par` de 26.1).
* **Lo que NO cambia:** las claves y tipos de `contenido` (comprobado en una
  fila emitida en local), `indicacionesPiso` (misma cadena para el PDF), las
  claves de la plantilla, los valores guardados de tipo y ASA, la validación
  (Paciente · Hospital · Diagnóstico principal · Fecha de ingreso; ahora abre
  la sección del faltante), «Marcar como URGENTE», la fecha del documento, el
  pie, el error único y el modal posterior.
* **Diferencias de forma guardada, menores:** un grupo fijo «encendido» y
  vacío ya no puede existir, así que ni se guarda en `indicacionesGrupos` ni
  en la plantilla; los renglones vacíos tampoco. «Otro» requerimiento sigue
  siendo UNA cadena: Enter en el campo la sustituye.
* **Medidas:** 1280×800 con todo lleno y plegado, sin desplazar
  (`scrollHeight` 800 = alto visible); con la sección de piso abierta (5
  grupos, 8 renglones), 1097.

### Recibo de honorarios y cotización compactos · notas (2026-11-22)

* **Qué:** maqueta aprobada `honorarios.html` llevada a la app (`0aca1319`,
  `a038130c`). Datos del documento en una fila (paciente, fecha y folio —que
  sigue siendo de la base, «Se asigna al emitir», con su nota de prefijo—);
  vigencia 15/30/60/90 como botones (sólo cotización). Un cobro por línea
  (número, concepto, origen sólo en cotización, precio a la derecha con cifras
  tabulares, ✕) con el teclado de la maqueta; la lógica en
  `honorariosLineas.ts` (pruebas `honorariosLineas.test.ts`). Totales siempre
  bajo las líneas. Seguro y notas sólo tras «＋» (o si ya traen datos). Forma
  de pago y divisa con `OpcionesRapidas` (`obligatoria`: siempre con valor,
  como su `<select>`). Origen y aseguradora con `CampoSugerido.tsx` (lista
  `role="listbox"` `absolute` bajo el campo, sin portal ni datalist; mismo
  componente en los cinco formatos: «Otra» es escribir el nombre). Estilos en
  `spinus-tokens.css` §26.5 (`.sp-hon-*`; reusa `.sp-rx-*` y `.sp-int-op`).
* **Lo que NO cambia:** `contenido` (mismas claves y tipos, comprobado en un
  recibo y una cotización emitidos en local), cálculos, `aImporte` y el
  formato de moneda, la validación (Paciente · Conceptos), «El precio debe ser
  mayor a 0», la franja de lo conservado, el aviso de anticipo mayor que el
  total, las plantillas (una plantilla de cotización con origen escrito a mano
  se aplica y se vuelve a guardar idéntica), el pie, el error único y el modal.
* **Decisiones:** el precio al salir del campo se ve como hoy (`String` del
  número: «85000», no «85,000.00» de la maqueta), porque el encargo pedía no
  tocar cómo se muestra; sin símbolo de moneda dentro del campo (la divisa va
  en la cabecera de la columna y en el nombre accesible). El origen heredado
  de una línea en blanco no cuenta como escrito. Bajo 380 de contenedor
  (`ext`/`tel`) la cotización pone el concepto en el primer renglón y el origen
  con el precio en el segundo; el recibo, concepto y precio en uno.
* **Medidas:** 1280×800, cotización con 6 conceptos y 5 subtotales: el
  contenido mide 1440 (no cabe sin desplazar; tampoco en la maqueta).

### Consentimiento informado: el embudo · notas (2026-11-22)

* **Qué:** maqueta aprobada `consentimiento.html` llevada a la app. Lógica pura
  en `consentimientoEmbudo.ts` (pruebas `consentimientoEmbudo.test.ts` y
  `consentimientoSinConexion.test.tsx`); estilos en `spinus-tokens.css` §26.6
  (`.sp-ci-*`, `.sp-mantener`, `.sp-firma-pac`/`--pac`, miniaturas
  `.sp-firma-fm`). Captura en cuatro bloques con `SeccionPaso` (ahora con
  `prefijo`), `OpcionesRapidas` para transfusión y «Quién firma», revisión en
  `RevisionConsentimiento.tsx`, gesto del médico en `BotonMantener.tsx`
  (1,2 s, teclado incluido). El firmado sigue en `FirmadoConsentimiento`
  (portal, lienzo, `touchAction`, orden y guardado intactos): modo paciente,
  «¿Trae su identificación oficial?» sólo con cámara, «Pase el dispositivo a…»,
  «Devuelva el dispositivo al médico», y el sellado con miniaturas.
  `ModalDocumentoGenerado` admite `correoPrimero` («Enviar copia al correo del
  paciente» primero, sólo tras sellar). Denegación en «···» («Emitir
  denegación…»; en el búnker, en la pantalla).
* **Comportamiento (cada uno en su commit):** B1 fecha del día de la firma y
  edad recalculada (`2e146dfd`), B2 texto de fotografías (`9103228e`), B3
  plantillas sin testigos (`c3f679b1`), B4 sin «Regenerar» en sellados y aviso
  honesto (`d682fe18`), B5 «Seguir editándolo» (`73b2273a`), B6 sin conexión
  (`6220db3f`). Estado de cada CI-DT en `DEUDA_CONSENTIMIENTO.md`.
* **Lo que NO cambia:** claves y tipos de `contenido` (comparado campo a campo
  con un sellado hecho con el código anterior: iguales salvo `timezone`, que es
  la del navegador de la prueba), validación (nueve / siete), huella, sello y su
  zona, el orden firmas → sellado → PDF con el cliente de sesión, la subida de
  la foto antes de la firma, la transfusión sin valor por defecto, PDF, RLS,
  `audit_log`, migraciones.
* **Defecto de front encontrado (no corregido fuera del consentimiento):** en el
  patrón «tocar fuera pliega» de internamiento, pulsar el TEXTO de una casilla
  `.sp-check` (p. ej. «Marcar como URGENTE») enfoca primero el panel del
  selector de tipo (`tabIndex=-1`) en el `pointerdown`, pliega la sección y la
  casilla no llega a marcarse; y pulsar «···» con una sección abierta puede
  cerrar el menú al reajustarse el desplazamiento. En el consentimiento se
  corrigió (`presionando`, `[aria-haspopup]`); internamiento queda pendiente.
* **Pendiente:** lista global de pendientes en `/documentos` (CI-DT-15, consulta
  nueva); `SeccionPlegable.tsx` quedó sin consumidores (no se borró).

### Escrito médico: la hoja · notas (2026-11-22)

* **Qué:** maqueta aprobada `escrito.html` llevada a la app (§26.7, `.sp-esc-*`).
  Hoja de alto medido (`--esc-alto`: área de contenido menos su relleno y el
  pie de acciones; con teclado, `visualViewport`), `sticky` y pegada arriba al
  entrar a escribir; SOLO `.sp-esc-cuerpo` se desplaza (medido en esc, iPad
  1024×768 y 768×1024, tel, ext-real e ih: `top` de título y barra iguales
  antes y después de desplazar). Datos en una línea («Paciente · fecha ·
  Cambiar»), título como título, «＋ Título del pie», contador de palabras y
  bloques. Barra nueva en `EditorEscrito.tsx` (kit `k-b-icono`/`k-seg`; reparto
  por el contenedor `escrito`: una fila ≥ 760, dos renglones 560–759, «⋯» < 560
  y sangrías al «⋯» < 400). En esc la columna del escrito crece a 880.
* **Pegado:** `src/lib/documentos/pegadoEscrito.ts` (pruebas
  `pegadoEscrito.test.ts`): Markdown en texto plano → formato real; tablas →
  renglones; h4–h6 → Subtítulo. Ctrl/⌘+Mayús+V sigue sin formato (comprobado
  con el portapapeles real).
* **PDF v2:** subtítulo 11/15 en tinta plena, sublistas, `start`, ítems de dos
  párrafos, cita con párrafos separados y marcas en títulos (`cuerpoEscrito.ts`
  + `formatos/EscritoMedico.tsx`). La negrita sigue en 500 (no hay cara más
  gruesa de la familia del cuerpo registrada). v1 y el camino legacy, intactos.
* **Visor:** `.tiptap-viewer` con la jerarquía del editor; `blockquote` y
  `start` en la lista blanca.
* **Sin uso tras el cambio (no se borró):** las reglas `.sp-ed-bar/-btn/-block/
  -select/-more/-n2/-n3/-m2/-m3` de `spinus-tokens.css`.

### Plan de suplementación compacto · notas (2026-11-22)

* **Qué:** maqueta aprobada `suplementos.html` (excepción aprobada: cambia la
  forma de capturar) con el patrón y las piezas de la receta (§26.1):
  `LineaSuplemento`, `SuplementoAbierto`, `BuscadorSuplemento` y la lógica pura
  `suplementosCompacto.ts` (`src/lib/tests/suplementosCompacto.test.ts`);
  estilos propios en §26.8 (`.sp-sup-*`) sobre `.sp-rx-*` y la fila de datos
  `.sp-hon-datos`.
* **Peso:** en la fila de datos, `type="number"` + `inputmode="decimal"`, área
  de escritura de 88 px (≥ 72) en los cinco formatos, número en negrita y «kg».
  Enter en el peso lleva al suplemento abierto.
* **Un abierto, los demás plegados** (nombre, marca, dosis · justificación;
  «Falta la dosis» en rojo). Buscador único sobre los nueve, sin acentos, ↓/↑
  saltando los ya elegidos (atenuados, «ya está en el plan»), Enter añade.
  Entra con `dosisParaForm` de hoy; el «para qué» (beneficio clínico) visible;
  «Calculada/Sugerida para N kg … · usar la sugerida».
* **Lo que NO cambia:** catálogo, textos, `calcularDosis`/`dosisEnCapsulas`/
  `dosisParaForm` (diff vacío contra HEAD), claves de `contenido`, PDF,
  plantillas (`editada` se sigue guardando como antes), validación (paciente,
  peso, ≥ 1 suplemento: la dosis vacía NO bloquea, como hoy). `cambiarPeso`
  ya recalculaba sólo las no tocadas (S-04): se conserva tal cual. Comprobado:
  a 60 kg las cinco dosis guardadas son las de las funciones de HEAD.
* **Vista secundaria:** el catálogo de nueve con su beneficio clínico y
  palomitas sigue como «Ver catálogo · n de 9».
* Notas y cita de control tras «＋ Notas» / «＋ Cita de control» (visibles si
  traen valor).

### Altura compartida de los formularios en `esc` · notas (2026-11-22)

* Con un formulario abierto la columna crece a 880 en `esc` (los dos
  anfitriones de documentos; la rejilla de tipos sigue en 640; `ih` no gana
  nada: su área es de ~650).
* §26.9: a ≥ 800 de contenedor y sólo en `esc`, los tres datos «rótulo — valor»
  de receta, laboratorio e imagen van en una fila de tres fichas.
* La tarjeta de plantillas VACÍA pasa a una línea en `ih`/`esc` («Sin
  plantillas de … · Guardar esta como plantilla», la misma acción del pie y del
  «···»); con plantillas ya era una línea con el desplegable. Táctil sin
  cambios (en la revisión cruzada se vio que `.k-b` ganaba en táctil y se
  arregló: `a0fc8193`).
* Alto de página a 1280×800 (scrollHeight del área; vista 800), antes →
  después: laboratorio 15 estudios 1192 → 1026; cotización 6 conceptos
  1392 → 1306; receta 6 plegados 1252 → 1138; imagen 4 estudios ~930 (874 con
  3) → 856; internamiento lleno y plegado 800 → 800 (cabe); suplementos 5
  992 → 976; consentimiento en captura 800 → 800 (cabe); escrito 1116 → 1100
  (hoja de alto medido). No caben: cotización (+506), receta (+338) y
  laboratorio (+226): es contenido (las líneas), no aire.

### «Plegado al salir» compartido · notas (2026-11-22)

* Defecto: pulsar el texto de una casilla (o un rótulo, o un párrafo) dentro
  de una sección abierta la plegaba sin marcarla. Causa: en el `pointerdown`
  sobre algo no enfocable el foco va al panel del selector (`tabIndex=-1`),
  fuera, y ese `focusin` plegaba; con el dedo, el foco se mueve en el
  `mousedown` emulado, DESPUÉS del `pointerup`. Arreglo en
  `salidaPlegable.ts`: mientras dura el gesto (hasta su `click`) el `focusin`
  no decide. Una sola escucha para receta, imagen, internamiento, suplementos y
  consentimiento (honorarios y laboratorio no pliegan al salir). Prueba
  unitaria `salidaPlegable.test.ts`; verificado en esc y tel (toque).

### Revisión cruzada de los ocho formularios · notas (2026-11-23)

* **Verde:** build exit 0; tsc exit 0; eslint del repo
  `✖ 148 problems (87 errors, 61 warnings)` (= tope); vitest
  `174 passed / 2575 passed` sin TZ, `TZ=UTC` y `TZ=America/Hermosillo`.
* **e2e** (los mismos 105 archivos y 6 tandas de B12, todos los proyectos,
  resiembra por tanda): **425 passed, 101 failed, 640 skipped** frente a
  427/100/639. Por caso, 4 pasaban y fallan, ninguno del rediseño:
  `agenda-reflejo-nota` (clic interceptado por «¿Asistió el paciente?»,
  AG-DT-256; repetida, falla igual) y `whatsapp-manual` «abrir el modal…»
  (la cita de prueba quedó en el pasado al cruzar la medianoche UTC; repetida,
  falla igual) — dependen de la hora; `agenda-cache-rangos` (eco de Realtime) y
  `agenda-t1-capas` [tableta] pasan al repetirlas. Al revés, `agenda-t1-capas`
  [telefono] (2) pasa ahora.
* **Capturas** de los 8 formularios llenos y con faltantes, `/documentos`,
  pestaña Documentos, rejilla de tipos y la rejilla tras guardar una nota
  (`/api/consultas` interceptado en el navegador: no escribe) en 5 formatos
  (ext/ih reales) × 2 temas: consola 0 (salvo `Bucket not found` del Storage
  local al imprimir), sin desbordes ni fijos en el borde.
* **Unificado:** toques de 44 en táctil en los datos de receta/laboratorio/
  imagen y en el título del escrito (medían 40–42); «Un estudio con tipo y
  región» con mayúscula como los demás faltantes.
* **PDF local de los 8 tipos** tras todos los cambios (receta, laboratorio,
  imagen, suplementación, internamiento, cotización, escrito y consentimiento
  en papel); sus filas de prueba se borraron después.
* **Visto y no unificado (decisiones de maqueta):** los datos del paciente van
  en filas «rótulo — valor» en receta/laboratorio/imagen y en campos-píldora en
  honorarios y suplementos; en `tel` el aviso de faltantes del escrito queda
  bajo la hoja (el foco va al cuerpo, que es el faltante).

### Limpieza final (B15) · notas (2026-11-23)

* **Borrado, con `grep -rn` en `src` y `e2e` antes (cero importaciones):**
  `ayuda/DiagnosticoFormato.tsx` y su uso; `dashboard/StatusChip.tsx`;
  `layout/Breadcrumbs.tsx`; `documentos/SeccionPlegable.tsx`;
  `dashboard/paletaAvatar.ts`; la variante «rejilla» de
  `labs/CardDocumento.tsx` (y la prop `layout`); los keyframes `aviso*` y sus
  clases de `globals.css`; 114 clases `.sp-*` de `spinus-tokens.css` que
  existían en B0 y el rediseño dejó sin consumidor, con sus 74 comentarios
  huérfanos. Subconjunto de e2e (`rediseno-formatos`, iniciar y ligar
  consulta) igual que B12; capturas idénticas píxel a píxel salvo el cambio
  intencionado de suplementos.
* **No se borró:** `fechaCitaCompacta` (la importa `husoCitas.test.ts`);
  `ConfiguracionCalendario.tsx` (agenda; exporta `ActualizarConfig`); 6 `.sp-*`
  ya muertas antes de B0 (`sp-callout`, `sp-grid-2-1`, `sp-label-eyebrow`,
  `sp-legal`, `sp-note`, `sp-push-backward`); `.sp-chip--selected`,
  `.sp-doc-actions--filas` y `.sp-section` dentro de `:not()` (quitarlas cambia
  la especificidad); los alias `--sp-*` y `--radius-*` (tokens, no clases);
  comentarios que aún nombran `StatusChip` en `globals.css`, `ui/Avatar.tsx` y
  `lib/agenda/tiposAgenda.ts` (piezas fuera de alcance).

### Correcciones de la auditoría final · notas (2026-11-23)

Sobre `0b1f32ad`, hallazgos de front de `AUDITORIA-FINAL` (medidos antes y
después con `elementFromPoint`, `scrollWidth` y contraste, en los cinco
formatos; franjas de `tel` emuladas por CDP):

* **H1 escrito:** la hoja resta también el relleno de abajo de `.app-contenido`
  y los avisos que la siguen, y re-mide al aparecer uno; el pie va por encima
  de la hoja (`z-index: 3` sólo en el escrito). «Imprimir» y «Plantilla»
  pulsables recién abierto y al fondo en los 5 formatos y en `tel` con y sin
  franjas (antes: tapados al abrir en todos, y al fondo en `tel` con franjas);
  el aviso de faltantes se ve.
* **H2 imagen:** en estrecho la falta larga baja de renglón (ext: desborde
  346 → 322; nombre 0 → 119 px; tel 17 → 119).
* **H3 `ih`:** `.nav-barra-medio` se ensancha 8 por lado (208 = tarjeta).
* **H4/H5 suplementos:** rótulo de la dosis a su medida (campo 126 → 192); el
  nombre sin detalle usa el renglón; el desplegable pasa bajo el pie (z 1).
* **H6:** pestañas del expediente en `ext` con hueco 4 (292 → 290 en 290).
* **H7:** «+ Documento» en `ext`: 14 px y columnas a su contenido (104 en 91 →
  94 en 103).
* **H8:** días de la semana y «—» de signos vacíos en `--tinta2` (2,80 → 5,39:1
  claro; 5,25 → 8,28 oscuro). `--tinta3` no cambia de valor.
* **H9:** avatar del encabezado con área de 44 (`::after`); «Actualizar» con
  área de `--k-toque`; filas de pendientes a 37 en `esc`. Las filas del cajón
  (`ext`/`tel`/`iv`) siguen en 33: fuera de lo pedido.
* **H13/H14:** e2e i3/k5 vuelven a comprobar «Sin expediente» por nombre
  accesible; comentarios de `Avatar.tsx` y `PiezasCita.tsx` corregidos.
* **H10/H11** a `DEUDA_TECNICA.md` (RED-DT-21, RED-DT-22). H12 sin tocar.

## Estado al cierre de pantallas y formularios

* **Hecho:** cimientos, primitivas, capas, navegación por formato (B1–B4);
  pantallas B5–B11 e integración B12; los ocho formularios de documentos con
  sus maquetas aprobadas (receta, laboratorio, imagen, internamiento,
  honorarios/cotización, consentimiento, escrito y suplementación); altura
  compartida en `esc`; plegado al salir compartido; limpieza B15.
* **Fuera por decisión del dueño:** la agenda (B13: espera su aviso); la
  retirada del lanzador `/inicio` (B14); el búnker sin conexión (código muerto
  para el dueño, ni probado ni revisado); la deuda del consentimiento
  (CI-DT-*) como proyecto aparte; las vías de medicamentos y las regiones de
  imagen «como están».
* **Riesgos abiertos:** la detección del Duo por `screen.width/height` sigue
  sin verificar en el aparato (se retiró la línea de diagnóstico de `/ayuda`
  sin lectura); la negrita del PDF del escrito sale en peso 500; las e2e que
  dependen de la hora («¿Asistió el paciente?», citas de «mañana») fallan de
  noche; el Storage local no tiene el cubo de PDF (`Bucket not found`), así que
  la descarga desde la lista no se probó en local. (El desplegable de
  suplementos ya no tapa el pie: corrección H5.)
