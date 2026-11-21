# PLAN DE IMPLEMENTACIÓN — Rediseño estético de Spinus

**Para:** revisión del dueño antes de tocar código.
**Punto de partida:** punta de `feature/agenda-v2`, commit `951e31b3`. Lo revisé en el clon `S/app`, donde también medí los números.
**Referencias:** `docs/spec/rediseno/` (rama `claude/cool-babbage-nn7p37`), CALMA §1–§30, BRIEF, PIEZAS, PIEZAS-MES e informes.
**Convención de marcas:** **[medido]** = lo conté yo con grep/wc sobre el clon. **[informe]** = viene de `S/informes/`. **ASUMIENDO QUE…** = no lo pude verificar en el código ni en un dispositivo.

---

## 0. Resumen ejecutivo

- **Bloques:** 16, de B0 a B15. La agenda (B13) va al final y se parte en 11 sub-bloques (AG0–AG10).
- **Parada temprana obligatoria:** después de B0–B4 (cimientos, primitivas, capas y navegación). El dueño prueba en su iPhone Duo real (push 1).
- **Paralelismo:**
  - B0–B4 los hace un solo agente, en serie. Ahí están los cuellos de botella.
  - Tras la parada hay dos oleadas de pantallas con hasta **4 agentes a la vez**, cada uno en su propio worktree y con archivos disjuntos.
  - La agenda admite hasta **3 agentes** (vistas, capas, configuración), con integración en serie y la batería e2e completa tras cada integración.
- **Despliegues en el mejor caso:** 4.
  1. Parada temprana.
  2. Pantallas no-agenda.
  3. Agenda.
  4. Retirada del lanzador + limpieza = QA final.

  Son 3 si el dueño acepta revisar juntos la agenda y la limpieza. A eso se suman los pushes de corrección de QA, uno por ronda.
- **Riesgo dominante:** la agenda. Tiene 584 `test()` e2e en 105 archivos que buscan por rol, texto y clases de FullCalendar/`.ag-*`. Tres cambios aprobados rompen pruebas a propósito, y cada uno va con su prueba actualizada:
  - cuatro vistas, con «3 días» siempre disponible;
  - Día en teléfono como rejilla;
  - verbos en lugar de «Aceptar».

---

## 1. Diagnóstico técnico del punto de partida

### 1.1 Sistemas de color que conviven

| Sistema | Dónde | Tamaño | Uso en alcance |
|---|---|---|---|
| `--sp-*` | `src/app/spinus-tokens.css` (2 813 líneas [medido]) | 235 tokens [informe] | 1 921 `var(--sp-` en 66 TSX [medido]: expediente, dashboard, perfil, labs, documentos, nota |
| `--ag-*` | `src/app/globals.css` (7 873 líneas [medido]): `:root` desde la l.24, `html.dark` desde la l.6869 | 131 tokens [informe] | 788 `var(--ag-` en 69 TSX [medido]: agenda, `Sidebar` (`--ag-navy*`), dashboard (estados) y **páginas públicas** (`agendaPublica.css`, 174 usos [informe]) |
| Literales Tailwind | TSX | 1 391 clases de paleta en 77 archivos; 398 hex entre corchetes [medido] | listado de expedientes, paciente nuevo, usuarios, facturación, ayuda, paleta ⌘K, modales de `ui/` |
| `--cp`/`--cs` | `components/layout/ThemeProvider.tsx` (inyecta `<style>`) | 2 | Marca por clínica: 6 paletas en `app/(app)/perfil/page.tsx:65-70` [medido] |
| Muertos | `--sem-*`, `--user-*`, `--radius-*` (ThemeProvider), `--azul-*` | 23 | 0 usos [informe] |

Los tokens del kit (`--fondo`, `--sup`, `--tinta`, `--accion`, `--navy`, `--ok-*`, `--mal-*`, `--velo`, `--it/--ir/--ib/--il`…) **no existen hoy**: tienen 0 definiciones y 0 usos [medido]. No chocan con nada.

**Colisión de nombres:** el kit define `--ag-fondo`, `--ag-tinta` y `--ag-punto` (ámbar de «Agendada»/aviso), y ese prefijo es el de la familia de la agenda. Además la prueba `agendaPublicaTokens.test.ts` recorre con la expresión `--ag-[\w-]+` los bloques `:root {` y `html.dark {` de `globals.css`.

### 1.2 Tipografía

- La fuente del sistema ya está (`globals.css:892-895`).
- Inter solo en landing y `/login`. No hay escala `--text-*` propia en Tailwind.
- `--sp-fs-*` existe (25 tokens), pero el grueso son clases sueltas.
- La agenda baja hasta 9 px: 33 reglas CSS por debajo de 12 px y 43 `text-[10/11px]` en TSX [informe].

### 1.3 Dónde viven el layout y la navegación

- `src/app/(app)/layout.tsx` (247 líneas). Contiene el guarda `getUser()` y el contenedor `flex h-screen` → `<main class="lg:ml-64 overflow-y-auto">`, que es el **único scroll**.
- El relleno `pt-[calc(4rem+env(top))]…` está replicado a mano en la agenda: `AgendaCliente.tsx:1508` y `globals.css:1509-1512`.
- `src/components/layout/Sidebar.tsx` (897 líneas):
  - cajón izquierdo de 256 px y botón `.menu-flotante`;
  - `handleLogout` con registro NOM-024;
  - plegado solo en `/agenda`.
- Hay 4 encabezados móviles distintos [informe]:
  - el botón flotante;
  - `.dash-barra-movil`, en tres copias (`dashboard/page.tsx`, `AsistenteDashboard.tsx`, `ui/Skeleton.tsx`);
  - `BandaMovil` de la agenda;
  - la barra de `/inicio`.

  Se cosen entre sí con `body:has(...)`.
- Corte único a 1024 px escrito a mano: `Sidebar.tsx:381`, `AgendaCliente.tsx:239` (`ANCHO_MOVIL`), `lib/agenda/vistasAgenda.ts:70` (`ANCHO_TABLETA = 768`) y varias media queries de `globals.css`.
- **Insets laterales:** 0 usos de `env(safe-area-inset-left|right)`; solo hay una mención en un comentario [medido]. Los insets top/bottom aparecen 25 y 20 veces.
- **Manifest:** es una ruta, `src/app/manifest.json/route.ts`, con `orientation: 'portrait-primary'`, `start_url: '/inicio'`, `theme_color: '#1a3a5c'` [medido]. **No hay `public/manifest*`.**

### 1.4 Cómo se aplica el oscuro

- Clase `dark` en `<html>`, escrita antes del pintado por `components/layout/ScriptTema.tsx` desde `localStorage.theme`.
- **No sigue al sistema.** Interruptor en `Sidebar`. 0 clases `dark:` [informe].
- Cuatro capas y dos paletas [informe]:
  - (A) hoja de traducción con `!important`: `ThemeProvider.tsx:155-299` más «Ampliación» en `globals.css:7576+` (175 selectores `html.dark .x` en globals [medido]), en gris Material #121212/#1E1E1E;
  - (B) `--sp-*` oscuros, la misma gris;
  - (C) `--ag-*` oscuros en navy #0c1420/#1b2a40;
  - (D) `/inicio`, que pinta por JS.
- La agenda en oscuro mezcla las tres.

### 1.5 Qué usa `motion`

- `motion@^12.43.0` está en `package.json`.
- 20 imports, todos de `components/landing/**` y de `hooks/useTilt.ts`. **0 en la app** [medido].
- Ningún resorte. 40 `@keyframes` en globals y 6 en spinus-tokens [medido]. Solo 34 `active:` en todo TSX [medido].
- La agenda tiene una regla probada: solo `opacity`/`transform` y **≤ 240 ms** (`src/lib/agenda/movimientoAgenda.ts`, `REGLA_AGENDA`). La comprueban `movimientoAgenda.test.ts` y 3 e2e vía `e2e/movimientoAyudas.ts`.
- Choca con el catálogo aprobado: resorte de entrada con respuesta de 0,36 s.

### 1.6 Pruebas que tocan la interfaz [medido]

- **e2e:** 105 `*.e2e.ts` con 584 `test()`. Selectores: 1 152 `getByRole`, 133 `getByText`, 108 `getByLabel`, 9 `getByTestId`, **559 localizadores por clase** (`.fc-event` 134, `.fc-next-button` 52, `.fc-timegrid-col` 50, `.agenda-raiz` 38, `.ag-tarjeta-hora-rango` 22, `.ag-banda-movil` 12…).
- **Proyectos e2e:** `escritorio` 1440×900, `telefono` 390×844 táctil y `tableta` 820×1180 (solo `agenda-f-tableta` y `agenda-t1-capas`). Servidor `next start` en :3001, Supabase local y semilla `scripts/agenda-semilla.ts`.
- **Fuera de la agenda casi no hay e2e de interfaz:**
  - `/dashboard` lo visitan 3 archivos (`agenda-i3-por-asignar`, `agenda-j3-ligar-ventana`, `agenda-k5-marcas`);
  - la barra lateral la prueba `agenda-f-barra` (`aside#barra-lateral`, que espera **256 px** y 64 plegada; «Plegar menú», `aria-controls`, grupo «Documentos»);
  - los avisos se leen por texto (`ayudas.ts:197`, «sin `role`»).
- **Unitarias:** 162 archivos, unas 2 039 llamadas `it/test` más 50 `.each`. Entre ellas:
  - 8 `.test.tsx` que renderizan marcado: `origenGoogle`, `herramientasV2` (afirma clases de la banda), `avisosClinica`, `marcasProcedencia`, `avisosAgenda`, `capasAgenda`, `burbujaCita`, `ranurasCabecera`;
  - 4 que leen CSS o fuentes:
    - `agendaPublicaTokens` (los `--ag-*` de `:root`/`html.dark` frente a `agendaPublica.css`);
    - `origenGoogle` (un bloque literal de globals);
    - `marcasProcedencia`;
    - `configuracionEscala` (los tamaños de letra de 28 archivos de la configuración tienen que estar en la escala de la reserva pública).
- **Textos que cambian con decisión aprobada** (conteo por archivo):
  - «Aceptar» del `ConfirmModal` de agenda → verbos: **37 apariciones en 18 e2e**;
  - «Ligar e iniciar consulta»: 3 e2e, 7 fuentes;
  - «No es una cita» sin signos: 3 e2e, 3 unitarias, 15 fuentes;
  - variantes de origen («Llegó de Google Calendar», «Agendada en Google», «Se agendó en Google», «La apartó con…», «Agendada/Se agendó por enlace»): 1–2 e2e y 1–2 unitarias cada una.
- El CSS principal compilado del clon pesa **331 KB sin comprimir** (`.next/static/css/0285e10d….css`) [medido]: es la línea base de tamaño.

### 1.7 Otros hechos que condicionan el plan [medido]

- `ModalShell` lo nombran unos 31 archivos; `useToast`, 40; Skeleton y `.skeleton`, 29.
- `SelectorTipoDocumento` lo usan 7 sitios: Sidebar, LineaTiempo, CarrilDocumentos, DocumentosRecientes, `/documentos`, nueva-nota y documentos del paciente.
- `QuickPatientModal`, 5: 4 de agenda y `/documentos`. `ConsultaRapidaModal` vive en `components/launcher/` pero lo usan Sidebar y dashboard, **así que no se borra con el lanzador**.
- `title=` aparece 185 veces en `components` y `app`. `Toast.tsx` no tiene `role` y queda abajo a la derecha.
- Agenda: `AgendaCliente.tsx` 2 428 líneas, `components/agenda` 98 TSX / 16 089 líneas, `AppointmentModal.tsx` 2 020, `lib/agenda` 67 archivos.
- `/inicio` aparece en `middleware.ts:367`, `login/layout.tsx:134`, `login/page.tsx` (5 sitios), `auth/callback/page.tsx:29`, `ErrorBoundary.tsx:73`, `global-error.tsx:74`, `(offline)/offline-mode/page.tsx:256,749` y el manifest.
- El skill `apple-design` está en `origin/main` y **no** en `feature/agenda-v2`. El repo local es *shallow*, así que no pude medir cuánto divergen las dos ramas: ASUMIENDO QUE `feature/agenda-v2` todavía no está integrada en `main`.

---

## 2. Estrategia de migración

### 2.1 Tokens nuevos sin romper lo no migrado (capa de compatibilidad, en este orden)

1. **Archivo nuevo `src/app/sistema.css`**, importado en `globals.css` justo después de `spinus-tokens.css`. Contiene, copiado de `kit/base.css` y adaptado:
   - Tokens claros en `:root` y oscuros en `html.dark` (no `prefers-color-scheme`; ver pregunta 3).
   - Renombre de las tres colisiones: `--ag-fondo/--ag-tinta/--ag-punto` → `--aviso-fondo/--aviso-tinta/--aviso-punto`. La tabla de equivalencias va en la cabecera del archivo, porque quien copie CSS de las maquetas tiene que aplicarla.
   - Insets: `--it: env(safe-area-inset-top, 0px)` y lo mismo para `--ir`, `--ib`, `--il`. Así el CSS de las maquetas, escrito con `var(--ir)`, sirve tal cual y nunca hay 84 o 34 fijos.
   - Escalas nuevas:
     - tipografía por rol: `.k-t-pantalla`, `.k-t-seccion`, `.k-t-tarjeta`, `.k-t-fila`, `.k-t-sec`, `.k-t-rotulo`, `.k-t-chip`, `.k-num` (números tabulares);
     - radios 12/16/20/26/999;
     - z-index por capa;
     - movimiento (§2.7).
   - `@theme inline` de Tailwind 4 con `--color-fondo: var(--fondo)` y demás. Así las pantallas migradas escriben `bg-sup text-tinta2 border-linea` en su propio TSX, sin tocar las hojas globales.
   - `@custom-variant` `ext:`, `tel:`, `ih:`, `iv:`, `esc:` sobre `[data-formato=…]` (§2.5).
2. **Compatibilidad hacia atrás:** en `spinus-tokens.css`, los `--sp-*` *neutros* (superficies, tintas, líneas, `--sp-app-bg`) pasan a ser alias de los del kit, en claro y en oscuro. Lo no migrado se acerca al aspecto nuevo sin tocar sus archivos. Los `--sp-primary*` siguen en `--cs`, con la marca de la clínica.
3. **Pantalla por pantalla:**
   - cada bloque reescribe su marcado con tokens y utilidades del kit y **elimina** los literales Tailwind de sus archivos;
   - no borra reglas `.sp-*` compartidas: las reglas que dejan de usarse se borran en la limpieza (B15), con grep de usos.
4. **Limpieza final (B15):** se borran los tokens y clases con 0 consumidores y los alias de compatibilidad.

### 2.2 Las 6 paletas por clínica

La maqueta fija navy #1B2B4A y acción #2F5AA8; la app deja elegir 6 paletas. **No se pierde la función.** En `ThemeProvider.tsx`, donde hoy se inyectan `--cp/--cs`:

- **Paleta de fábrica** (`#1a3a5c`/`#1e5fa8`, la que guarda la base): se inyectan los valores del kit en `--navy`, `--accion`, `--enlace`, `--tonal` y `--tonal-tinta` (y los oscuros del kit).
- **Las otras cinco:** las mismas variables se derivan de `--cp/--cs` con las fórmulas que ya usa la app:
  - `--navy: hsl(from var(--cp) h s 20%)`;
  - `--accion: var(--cs)`;
  - en oscuro, `oklch(from var(--cs) .55 c h)`;
  - `--tonal: color-mix(in srgb, var(--accion) 12%, var(--sup))`.
- Lo guardado en la base y los PDF no cambian.
- Los avisos (Toast) **no** usan `--tonal`, porque hoy se evita a propósito que «info» siga la marca (`Toast.tsx:39-51`). Usan los semánticos fijos `--ok-*`, `--mal-*`, `--aviso-*` y un informativo neutro.

→ Ver pregunta 1.

### 2.3 Unificar el oscuro (un solo oscuro, el del kit)

En B1, sin tocar pantallas:

- (a) Los hex base de la hoja de traducción A (#121212, #1E1E1E, #242424, #2C2C2C, #383838) en `ThemeProvider.tsx` y en la «Ampliación» de `globals.css` pasan a `var(--fondo)`, `var(--sup)`, `var(--sup2)`… Las tintas blancas con alfa se mantienen.
- (b) Los `--sp-*` oscuros neutros apuntan al kit.
- (c) `sincronizarBarraDelNavegador`, `body::before` y el `themeColor` de `app/layout.tsx` pasan de `--ag-navy` a `--navy`.

Con eso toda la app queda en navy de inmediato y las pantallas no migradas se ven coherentes. El lanzador (capa D) no se toca: se retira en B14.

### 2.4 Los `--ag-*` de la agenda

- **No se tocan antes de B13.** Las páginas públicas (`/reservar`, `/confirmar`, fuera de alcance) dependen de ellos, y `agendaPublicaTokens.test.ts` exige que todo `--ag-*` que cambie en `html.dark` lo redeclare la hoja pública con su valor claro.
- En AG0 se crea la familia `--cal-*` de PIEZAS.md §1 en `sistema.css` (alias del kit más 6 literales de evento, con su oscuro). La piel de la agenda en la app se reescribe sobre `--cal-*` y el kit.
- Los `--ag-*` sobreviven en `globals.css` mientras los use `agendaPublica.css`. En B15 se borran solo los que no tengan ningún consumidor (grep en `src/`), y `agendaPublicaTokens` tiene que seguir en verde.
- Las clases `.ag-*`, `.agenda-*` y `.fc-*` **conservan su nombre**: hay 559 localizadores e2e por clase. Se reescribe su CSS, no su identidad.

### 2.5 Formatos de pantalla y sonda de franjas

`ScriptTema.tsx` es hoy el script en línea que corre antes del primer pintado y que montan `(app)` y `(launcher)`. Se amplía con una sonda de unas 30 líneas de cadena:

- Un `div` fijo con `padding: env(safe-area-inset-*)`. Se leen los cuatro valores con `getComputedStyle` y se escribe en `<html>`:
  - `data-borde-sistema` = `derecha` | `izquierda` | `arriba` | `ninguno`;
  - `data-formato`, según esta tabla:

| `data-formato` | Condición | Navegación |
|---|---|---|
| `ext` | borde lateral y ancho < 700 | riel |
| `ih` | borde lateral y 700 ≤ ancho < 1024 | barra lateral del lado de la franja |
| `tel` | sin borde lateral y ancho < 600 | encabezado fundido |
| `iv` | sin borde lateral y 600–1023 | encabezado fundido con 5 píldoras |
| `esc` | ≥ 1024 | barra izquierda de 248 |

- Se recalcula en `resize` y `orientationchange` (abrir o cerrar el Duo) y se emite un evento `spinus:formato`.
- **Reglas de hidratación:**
  - `<html>` ya lleva `suppressHydrationWarning`; se actualiza el comentario de `app/layout.tsx:83-89`, porque deja de ser «el único atributo».
  - **Ningún componente decide su marcado por el formato en el primer render.** El formato se aplica con CSS (variantes `ext:`…). Si JS lo necesita (agenda, hoja arrastrable de `tel`), lo lee tras montar, con una utilidad pura en `src/lib/formatoPantalla.ts` (archivo nuevo, ≥ 2 consumidores) y valor de servidor «desconocido».
- Con la franja a la izquierda (Duo girado 180°), la navegación lateral se espeja usando propiedades lógicas y la variable de lado. ASUMIENDO QUE el Duo puede presentar la franja a la izquierda: hay que comprobarlo en la parada.
- **Dónde vive el CSS de cada cosa:**
  - Las pantallas usan utilidades en su TSX.
  - Las primitivas y capas van en `sistema.css`.
  - La agenda va en sus secciones de `globals.css`. No se mueve a otro archivo: `origenGoogle.test.tsx` y `agendaPublicaTokens.test.ts` leen `globals.css` literalmente.

### 2.6 Movimiento

- **Tokens** en `sistema.css`:
  - `--resorte-entra`: `linear()` equivalente a amortiguación 1 y respuesta 0,36 s;
  - `--resorte-sale`: 0,24 s;
  - `--dur-entra: 360ms` y `--dur-sale: 240ms`.
- **Capas:** transiciones CSS de `transform`/`opacity` con `@starting-style` para la entrada. Una transición se invierte desde el valor presente, así que se puede interrumpir sin JS.
- **`motion`** (ya instalada; sin dependencias nuevas) solo donde hay gesto con velocidad: la hoja inferior de `tel` (arrastrar para cerrar, proyección de inercia, rubber-band) y el cajón de `tel`/`iv`.
- **Respuesta al toque:** `.k-pulsable` con `:active { transform: scale(.97) }` y 100 ms.
- **Movimiento reducido:** fundido corto en lugar de desplazamiento (no «apagar»).
- **Transparencia reducida:** velo opaco sin desenfoque.
- La agenda migra a estos tokens en AG0. La regla `REGLA_AGENDA` sube su tope de 240 ms al del catálogo (unos 400 ms) con su prueba unitaria actualizada. Es consecuencia directa de §25, pero hay que confirmarlo: ver pregunta 4.

### 2.7 Reglas de trabajo para los agentes (de CLAUDE.md y AGENTS.md)

- Rama `feature/rediseno-estetico`, desde `951e31b3`. Una sub-rama `feature/rediseno-<bloque>` por agente, en su worktree. El orquestador integra en local; **sin PR**.
- **La aprobación de este plan cuenta como el OK de los protocolos 1, 3 y 4 solo para lo que aquí se lista:**
  - los archivos nuevos (`sistema.css`, `lib/formatoPantalla.ts`, primitivas de `components/ui/`, piezas de navegación, scripts de verificación);
  - las abstracciones nombradas (primitivas y capas del catálogo, cada una con ≥ 3 consumidores reales).

  Cualquier archivo fuera de la lista de su bloque obliga a parar y preguntar.
- **Por cambio:** funciones de ≤ 50 líneas; `npm run build` tras cada cambio (es Webpack); `npm run lint` si toca tipos. Si el build falla, no se sigue. Reporte de fin de tarea de 5 líneas (P8).
- **No se tocan:** `src/lib/anonimizar.ts`, RLS/migraciones, audit log (`handleLogout` conserva el `await` a `/api/auth/audit-login`), filtros de Sentry, middleware y guardas (salvo B14, con la regla de autoridad), Service Workers y `(offline)/*` (P6).
- **Borrar** solo tras `grep -rn` y reportarlo (P2).
- **Textos:** los de hoy, salvo la lista aprobada (CALMA §15, §20, §23, §28–§30 y ESTADO). Cada texto que cambia va con su prueba unitaria o e2e actualizada **en el mismo commit**.
- Cada agente entrega la tabla «ítem del inventario → dónde está / FALTA» (§28) de su sección de `funciones-componentes.md`.

---

## 3. Bloques de implementación

**Verificación común a todos los bloques (V-común):**

1. `npm run build`; `npm run lint`; `npm test` (vitest completo).
2. e2e de los archivos del bloque: `npx playwright test e2e/<archivos> --project=escritorio --project=telefono`, contra `next start -p 3001`, con Supabase local reseteado y la semilla.
3. Capturas Playwright del bloque en los cinco tamaños, claro y oscuro, comparadas con Read contra las vistas de la maqueta (`docs/spec/rediseno/<carpeta>/vista-*.html` ensambladas con `kit/build.py`):
   - `ext` 466×678 con inset derecho 84 / inferior 34;
   - `tel` 393×852 con superior 59 / inferior 34;
   - `ih` 951×669 con derecho 84 / inferior 34;
   - `iv` 669×951 con superior 82;
   - `esc` 1280×800.

   Las franjas se emulan con CDP `Emulation.setSafeAreaInsetsOverride`, como en la auditoría.
4. `chk-app.js` (B0) sin hallazgos (a)–(f). Además: áreas ≥ 44 en táctil y ≥ 36 en `ih`/`esc`; texto ≥ 12; nada pulsable bajo las franjas; 0 errores de consola.

### B0 · Preparación y herramientas (sin cambio visual)

- **Objetivo:** dejar la rama lista, la línea base medida y la deuda anotada.
- **Archivos:**
  - `git checkout origin/claude/cool-babbage-nn7p37 -- docs/spec/rediseno` (maquetas, kit, informes, `tools/chk-botones.js`);
  - `git checkout origin/main -- .agents/skills/apple-design`;
  - `DEUDA_TECNICA.md`: entradas de §7.2;
  - nuevos `docs/spec/rediseno/tools/cap-app.js` (capturas de rutas en los cinco formatos con franjas por CDP) y `docs/spec/rediseno/tools/chk-app.js` (adapta `MEDIR` de `chk-botones.js` a una página real: el «marco» es el `body`, más el criterio de franja);
  - `docs/spec/rediseno/IMPLEMENTACION.md` (registro de bloques).

  Unos 6 archivos.
- **No toca:** `src/`.
- **Dependencias:** ninguna. **Riesgo:** bajo.
- **Pruebas:** ninguna se rompe.
- **Verificación:** build, lint, `npm test` y **e2e completa en verde como línea base**, anotando las que fallen por hora o día (ESTADO cita unas 13). Capturas «antes» de todas las rutas en alcance.
- **Terminado cuando:** hay línea base registrada en `IMPLEMENTACION.md`. **Paralelo:** no.

### B1 · Cimientos: tokens, tipografía, oscuro, sonda, manifest, movimiento base

- **Objetivo:** §2.1–§2.6 sin rediseñar ninguna pantalla.
- **Archivos** (unos 8):
  - nuevo `src/app/sistema.css`;
  - `src/app/globals.css`: un `@import`, `body` a 15/20, `html{scroll-behavior:smooth}` solo con `no-preference`, `body::before` → `--navy`, la «Ampliación» oscura re-apuntada;
  - `src/app/spinus-tokens.css`: alias neutros claro y oscuro (bloques `:root` y `html.dark`);
  - `src/components/layout/ThemeProvider.tsx`: marca y derivadas, hex de la hoja A → tokens, la sonda de color lee `--navy`;
  - `src/components/layout/ScriptTema.tsx`: sonda y `data-formato`;
  - `src/app/layout.tsx`: `themeColor` del kit y comentario de `suppressHydrationWarning`;
  - `src/app/manifest.json/route.ts`: sin `orientation`, `theme_color #1B2B4A`, `background_color #F2F4F8` (`start_url` se queda hasta B14);
  - nuevo `src/lib/formatoPantalla.ts`.

  Otras reglas globales que entran aquí:
  - campos con letra de 16 px en `ext`/`tel` (evita el zoom de iOS);
  - `-webkit-text-size-adjust: 100%`;
  - `prefers-reduced-transparency`.
- **No toca:** pantallas, `--ag-*` (claro ni oscuro), `agendaPublica.css`, guardas.
- **Dependencias:** B0.
- **Riesgo:** medio. Es un cambio global de color en oscuro y toca ThemeProvider, que lleva `!important` y es la mitad de la hoja A.
- **Pruebas en riesgo:**
  - `agendaPublicaTokens` (se cuida no tocando `--ag-*`);
  - e2e que lean colores: ninguna conocida.

  e2e completa, porque es un cambio global.
- **Verificación:**
  - V-común con capturas «antes y después» de 10 rutas representativas, en claro y oscuro;
  - medir con la sonda los cinco formatos emulados (atributo correcto, cambio al redimensionar);
  - comprobar las 6 paletas en `/perfil`;
  - comprobar que el CSS compilado no crece más de unos 15 KB.
- **Terminado cuando:** el oscuro es navy en toda la app sin texto ilegible en las capturas, `data-formato` es correcto en los cinco formatos y las pruebas siguen en verde.
- **Paralelo:** no. Es cuello de botella.

### B2 · Primitivas compartidas

- **Objetivo:** construir una vez las piezas base del kit.
  - **CSS en `sistema.css`:** botón de 4 niveles (`.k-b-prim`, `.k-b-tonal`, `.k-b-texto`, `.k-b-icono`, con área real de 44/36 por `::after`, regla 13 de PIEZAS: 8 px por lado y nada de `flex:1 1 0`); campo (`.k-campo`: relleno `--sup2`, sin borde, foco de 2 px); etiqueta del campo; fila de lista (56–60 / 48–52, con «›»); etiqueta de estado (`.k-etq` y variantes ok/mal/aviso/tonal); pestañas; segmentado; tarjeta.
  - **Componentes pequeños** (≥ 3 consumidores cada uno) en `src/components/ui/`:
    - `IconoEstadoCita.tsx` (5 estados, §24.4; dashboard y agenda);
    - `IconoTipoDocumento.tsx` (8 tipos con su `--d-*`, §9; listas, rejilla y línea de tiempo);
    - `MarcaOrigen.tsx` (Google y enlace);
    - `Avatar.tsx`, que absorbe `components/dashboard/paletaAvatar.ts`: 6 pares, 4 consumidores.
  - **Re-piel de `.sp-btn*`, `.sp-input`, `.sp-chip`, `.sp-badge`, `.sp-banner`, `.sp-card`** (secciones 1–10 de `spinus-tokens.css`, l.834–1155): solo color, radio y respuesta al toque. **Sin cambiar medidas**, para no desajustar lo no migrado.
- **Archivos:** `sistema.css`, `spinus-tokens.css` (l.834–1155), 4 nuevos en `ui/`, `paletaAvatar.ts`. Unos 7.
- **No toca:** pantallas (las adoptan sus bloques), `ui/SelectorSegmentado.tsx` (se rehace en su bloque de uso, labs).
- **Dependencias:** B1. **Riesgo:** bajo-medio (la re-piel de `.sp-btn` se ve en 21 archivos).
- **Pruebas:** ninguna conocida.
- **Verificación:** V-común sobre una página de muestra temporal **fuera de `src/app`** (Storybook no hay) o sobre `/perfil` y nueva nota (que usan `.sp-btn`).
- **Terminado cuando:** cada primitiva cuadra con `dashboard-final` y `capas-a` en los cinco formatos.
- **Paralelo:** no. Lo comparten todos.

### B3 · Capas del catálogo (alerta, modal, hoja, menú, aviso, vacío, error, carga) con su movimiento

- **Objetivo:** implementar `capas-a`/`capas-b` y CALMA §13, §18, §21, §25 y §26.
  - **`ui/ModalShell.tsx`, re-hecho por dentro con la misma API** (`title`, `footer`, `elevated`, `fullscreenMobile`, `spinusGeometry`; foco atrapado y Esc). Añade:
    - variante `alerta` (patrón único: icono en círculo de 48, título centrado, dos botones parejos y apilado si no caben);
    - presentación por formato: tarjeta centrada en el área de contenido en `ext`/`ih`/`iv`/`esc` y hoja arrastrable en `tel` (con `motion`);
    - salida animada por el mismo camino.
  - **Velo único** `--velo` con `blur(10px) saturate(140%)` y `-webkit-`. Un segundo velo hermano se vuelve transparente por CSS (`.k-velo ~ .k-velo`), sin contexto nuevo.
  - **Menú** `ui/CapaMenu.tsx` (nuevo): anclado y sin velo en `esc`, tarjeta en `ih`/`iv`/`ext`, hoja en `tel`. Consumidores: kebab de paciente, acciones de documento, selector de consultorio y «Más».
  - **`ui/Toast.tsx`:** arriba y centrado en el contenido; `role="status"` (éxito, info) o `role="alert"` (error); 4 s, y 8 s solo advertencia; cierre con `aria-label`; insets; salida.
  - **Vacío y error:** piezas `ui/EstadoVacio.tsx` y `ui/EstadoError.tsx` (≥ 9 copias de «error + Reintentar» [informe]) y `ErrorBoundary.tsx` con su aspecto.
  - **Carga:** `ui/Skeleton.tsx` con pulso de opacidad en lugar de `background-position`; respeta movimiento reducido. **Se quita de aquí la copia de `.dash-barra-movil`**, en coordinación con B4.
  - **Capas compartidas por varias pantallas:**
    - `ui/OfflineAlert.tsx`;
    - `documentos/SelectorTipoDocumento.tsx` (rejilla §21, 7 consumidores);
    - `ui/QuickPatientModal.tsx` (alta rápida + «Paciente duplicado»);
    - `billing/BloqueoFeatureModal.tsx`;
    - `launcher/ConsultaRapidaModal.tsx`.
- **Archivos:** unos 12, más 3 nuevos. Los ~31 consumidores de `ModalShell` no se tocan.
- **No toca:** las capas propias de la agenda (`.ag-capa`, `ConfirmModal`…, que van en B13) ni `CommandPalette` (B4).
- **Dependencias:** B2.
- **Riesgo:** **medio-alto**. `ModalShell` tiene unos 31 consumidores y `QuickPatientModal` entra en flujos e2e de la agenda (ligar, alta en la burbuja, convertir).
- **Pruebas en riesgo:**
  - e2e de agenda que abren `QuickPatientModal` o `PreguntaAsistencia` (`ModalShell`): `agenda-j3-ligar-ventana`, `agenda-ligar-consulta`, `agenda-convertir-google`, `agenda-m1-burbuja`, `agenda-t1-burbuja`;
  - lecturas de toast por texto (`ayudas.ts`): siguen valiendo, solo cambia la posición;
  - `getByRole('alert'|'status')` podría encontrar ahora un toast además del elemento buscado. Hay que revisar los 15 + 8 usos.

  Se cuidan conservando roles, nombres y textos exactos.
- **Verificación:** V-común, y además abrir y cerrar cada capa a mitad de animación (que se interrumpe y se invierte), con `prefers-reduced-motion` y `-transparency` emulados, en `ext`/`tel`/`esc`.
- **Terminado cuando:** las 8 piezas cuadran con `capas-a`/`capas-b` y las e2e listadas están en verde.
- **Paralelo:** no, porque es cuello de botella. Excepción: Toast, Skeleton y Vacío/Error son archivos disjuntos de `ModalShell` y los puede hacer un segundo agente en paralelo.

### B4 · Navegación por dispositivo

- **Objetivo:** el cromo de `cromo/` y del dashboard aprobado:
  - riel derecho en `ext` (Inicio, Expediente, Agenda, Documentos, «···» y «+»);
  - encabezado fundido en `tel`; encabezado fundido con 5 píldoras en `iv`;
  - barra lateral derecha en `ih`; barra izquierda de 248 en `esc`;
  - cajón en `tel`/`iv` con arrastre; «Más» en `ext`/`iv`;
  - aviso «N datos pendientes»: tarjeta ámbar o distintivo según el formato, **sin las animaciones infinitas**;
  - selector de consultorio con el logo de la clínica;
  - paleta ⌘K anclada arriba, con `role="dialog"`, `aria-modal` y nombres accesibles;
  - «Ajustes» de la secretaria;
  - banner de suscripción con insets;
  - nombre de sección «Expediente» (§20); chip del plan traído del lanzador; plegar menú en `esc` dentro de la agenda.
- **Archivos:**
  - `components/layout/Sidebar.tsx`: conserva datos, `handleLogout` y limpieza de cachés; pinta las cuatro presentaciones;
  - piezas presentacionales nuevas que reciben props, sin contextos ni lógica nueva: `layout/RielNavegacion.tsx`, `layout/EncabezadoFundido.tsx`, `layout/MenuMas.tsx`;
  - `app/(app)/layout.tsx`: solo JSX del contenedor (`h-dvh`, relleno por formato con los insets, sin `lg:ml-64`). **El guarda no se toca**;
  - `contexts/MenuMovilContext.tsx`: solo comentario, el booleano no cambia;
  - `sidebar/AvisoPerfilSidebar.tsx`, `sidebar/ConsultorioActivoSelector.tsx`, `CommandPalette.tsx`, `billing/SuscripcionBanner.tsx`;
  - las 2 copias restantes de `.dash-barra-movil` (`dashboard/page.tsx:98-114` y `dashboard/AsistenteDashboard.tsx:62-77`: solo esas líneas);
  - `globals.css`: reglas de cromo l.901–954, 2175–2220, `body:has()`;
  - pestañas de Administración (§30.2): nuevo `components/admin/PestanasAdministracion.tsx` y su cabecera en `estadisticas/page.tsx`, `admin/usuarios/page.tsx` y `billing/page.tsx` (solo la cabecera);
  - acceso a Suplementación desde `/expediente` (solo un enlace en la cabecera de `expediente/page.tsx`, para no perder la función al quitar el grupo «Pacientes»).

  Unos 15 archivos.
- **No toca:**
  - el cuerpo de las pantallas;
  - la banda de la agenda: en `tel`/`ext` se mantiene el criterio de hoy (`body:has(.ag-banda-movil)` esconde el encabezado global), y en `ih` se esconde por CSS la hamburguesa de la banda hasta B13;
  - `/inicio`.
- **Dependencias:** B3 (cajón, «Más» y menús son capas).
- **Riesgo:** **alto**. `Sidebar` (897 líneas) concentra cierre de sesión con auditoría, permisos por rol, bloqueo por plan y plegado; el layout es el archivo más delicado de la app; y el relleno está acoplado a la agenda (`AgendaCliente.tsx:1508`, `globals.css:1509-1512`). Si hay que cambiar el relleno vertical, se cambia en los tres sitios en el mismo commit, siguiendo sus comentarios.
- **Pruebas en riesgo:**
  - `agenda-f-barra.e2e.ts`: espera 256 → **248**, y «pulsar un grupo plegado lo despliega» (grupo «Documentos») deja de existir con la navegación plana aprobada. Se reescribe con los mismos `aria-controls="barra-lateral"`, «Plegar menú» y «Desplegar menú»;
  - e2e de `telefono` que usan «Abrir menú» de la banda: siguen;
  - `herramientasV2.test.tsx:54`: clases de la banda, sin cambio.
- **Verificación:** V-común en `/dashboard`, `/expediente`, `/agenda`, `/perfil` y `/estadisticas`, con los tres roles (admin, médico invitado, secretaria) y con la suscripción bloqueada. Además, una **e2e nueva** `e2e/rediseno-formatos.e2e.ts` con dos proyectos nuevos en `playwright.config.ts`, `duo-cerrado` (466×678) y `duo-abierto` (951×669), con franjas por CDP. Comprueba: riel o barra visibles, ningún control interactivo bajo la franja y, en `ih`, ningún control fijo entre x 455 y 496.
- **Terminado cuando:** las capturas de los cinco formatos cuadran con `cromo/` y `dashboard-final`, la tabla A0 (23 ítems) no tiene ningún FALTA y la e2e completa está en verde.
- **Paralelo:** no.

### ⛔ PARADA TEMPRANA (push 1)

El dueño instala o reinstala la PWA. ASUMIENDO QUE iOS guarda `orientation` y `start_url` al instalar, así que hace falta reinstalar para ver la orientación libre.

**Lista de comprobación en el Duo real:**

1. Cerrado: riel, nada bajo la franja.
2. Abierto en horizontal: barra derecha.
3. Abierto en vertical: píldoras, sin franja inferior.
4. Girar y abrir/cerrar con la app abierta.
5. Oscuro y claro.
6. Una alerta, una hoja y un menú en cada formato.
7. Cajón y «Más».
8. Avisos.
9. Rendimiento del desenfoque.
10. La agenda todavía sin migrar, avisado de antemano.

Lo que salga se corrige antes de seguir.

### B5 · Dashboard (médico y secretaria)

- **Objetivo:** `dashboard-final` más §24:
  - fila de cita entera pulsable que abre la hoja de acciones de la cita (capa del catálogo), con los estados y textos de hoy;
  - estado con `IconoEstadoCita`;
  - origen con `MarcaOrigen` y los textos aprobados;
  - «Ligar paciente e iniciar consulta» con eslabón en las etiquetas **propias del dashboard** (`dashboard/page.tsx:279,285`, `ProximasCitas.tsx:59`);
  - se quita «Tus pacientes te esperan»;
  - botones cortos en `ext` (§17).
- **Archivos:** `app/(app)/dashboard/*` (4 archivos, 681 líneas) y `components/dashboard/*` (8 archivos, 1 907 líneas). Unos 12.
- **No toca:** `agenda/VentanaLigarCita.tsx`. Su título «Ligar e iniciar consulta» se cambia en AG7, junto con sus pruebas.
- **Dependencias:** parada superada.
- **Riesgo:** medio (3 e2e entran al dashboard).
- **Pruebas en riesgo:** `agenda-i3-por-asignar`, `agenda-j3-ligar-ventana` y `agenda-k5-marcas` (textos de fila y botón). Se actualizan con los textos aprobados.
- **Verificación:** V-común contra `dashboard-final`, para médico y secretaria.
- **Terminado cuando:** las 28 funciones de A2 tienen su sitio.
- **Paralelo:** con B6, B9 y B10.

### B6 · Lista de pacientes, nuevo paciente, editar paciente y alta

- **Objetivo:** `final-lista` y `final-form`:
  - título «Expediente»;
  - «Filtros» (§30.3) con `SheetFiltrosExpediente` como hoja del catálogo;
  - edad bajo el nombre en `iv`;
  - consentimiento a la derecha;
  - «Paciente duplicado».
- **Archivos:**
  - `app/(app)/expediente/page.tsx` (472) y `expediente/loading.tsx`;
  - `components/expediente/TablaPacientesExpediente.tsx` y `SheetFiltrosExpediente.tsx`;
  - `app/(app)/pacientes/nuevo/page.tsx` (501);
  - `app/(app)/expediente/[id]/editar/page.tsx` (236).

  Unos 6.
- **No toca:** el expediente del paciente.
- **Dependencias:** parada. **Riesgo:** bajo-medio.
- **Pruebas:** ninguna e2e. Unitarias de validación de formularios, si las hay, sin cambios de texto.
- **Verificación:** V-común contra `final-lista` y `final-form`.
- **Terminado cuando:** A3, A4 y A8 están completos.
- **Paralelo:** con B5, B9 y B10.

### B7 · Expediente del paciente (y laboratorios)

- **Objetivo:** `final-expediente`:
  - cabecera compacta con la etiqueta de alergias;
  - «···» «Acciones del paciente» en `esc` (§30.5);
  - «Eliminar paciente» (§15) con alerta destructiva;
  - pestañas; plegables con resúmenes (§30.4); «N documentos»;
  - iconos de tipo con color en listas y archivos clínicos (§11);
  - mediciones con los encabezados aprobados;
  - notas de medición sin truncar con el resto en `title` (arreglo de front).
- **Archivos:**
  - `app/(app)/expediente/[id]/page.tsx`, `[id]/loading.tsx`, `estado/page.tsx`, `laboratorios/page.tsx`;
  - en `components/expediente/*`, todos salvo `TablaPacientes`, `SheetFiltros`, `CuerpoNota` y `VisorNota` (que van a B8);
  - `components/labs/*` (14 archivos);
  - `ui/SelectorSegmentado.tsx`.

  Unos 30.
- **Dependencias:** B6 (navegación de ida y vuelta).
- **Riesgo:** medio (archivos grandes, estado en la URL: `?tab=`, `?consulta=`, `?documento=`).
- **Pruebas:** ninguna e2e directa.
- **Verificación:** V-común contra `final-expediente`, y además los enlaces profundos con `?tab=`.
- **Terminado cuando:** las 56 funciones de A5 más A9–A10 están completas.
- **Paralelo:** con B10 y B11 (segunda oleada).

### B8 · Nueva nota y nota de consulta

- **Objetivo:** `final-nota` y `final-consulta`:
  - título «Nueva nota» y botón «Generar con Spinus» (§20);
  - «Revisar» (§15);
  - regreso «‹ Paciente Prueba 01» (§23.8), y se quita el único uso de `Breadcrumbs`;
  - «La nota aparecerá aquí» en `esc` (§30.7);
  - tras guardar: «Imprimir nota» → «Abrir PDF» y «Ver expediente», **sin «Ver nota»** (§30.1);
  - rejilla de tipos, ya hecha en B3;
  - texto justificado con `hyphens`.
- **Archivos:**
  - `app/(app)/expediente/[id]/nueva-nota/page.tsx` (1 959) y su `loading.tsx`;
  - `consulta/[consultaId]/page.tsx` (306);
  - `components/expediente/CuerpoNota.tsx` y `VisorNota.tsx`;
  - `spinus-tokens.css` §11–§15 (progreso, pasos, edición, signo vital, rejilla SOAP; l.1155–1255);
  - `layout/Breadcrumbs.tsx`, que queda sin uso y se borra en B15 tras grep.

  Unos 6.
- **No toca:** `src/lib/anonimizar.ts` ni las rutas de IA. Las notas selladas siguen inmutables (solo addendum).
- **Dependencias:** B7 (en serie, mismo agente). **Riesgo:** medio (archivo de 1 959 líneas con estados del embudo).
- **Pruebas:** unitarias del embudo si leen textos («Volver a revisar» aparece en 1 fuente).
- **Verificación:** V-común contra `final-nota` y `final-consulta`, recorriendo todos los estados del embudo.
- **Terminado cuando:** A6 y A11 están completos.
- **Paralelo:** con B10 y B11.

### B9 · Documentos (entrada y 8 formularios)

- **Objetivo:** `docs-a`, `docs-b` y `docs-c`:
  - `/documentos` (buscador → rejilla);
  - taller del paciente; 8 formularios; plantillas; firmado del consentimiento; modal posterior;
  - **un solo mensaje de error al guardar** (hoy son banda + aviso) con la alerta «No se pudo guardar» / «Aceptar» (§20);
  - «Descargar» tras generar (§23.2);
  - alergia en la cabecera de la receta (§23.4).
- **Archivos:**
  - `app/(app)/documentos/*` (3);
  - `app/(app)/expediente/[id]/documentos/page.tsx`;
  - `components/documentos/*` (19 archivos, sin `SelectorTipoDocumento`);
  - `spinus-tokens.css` §17–final (`.sp-doc*`, `.sp-tpl*`, `.sp-ed*`, `.sp-firma*`; l.1271–2813).

  Unos 24.
- **No toca:**
  - nombres y orden de los campos (alimentan las ranuras del PDF, `SPEC_DISENO_PARTE_B.md`);
  - `src/lib/pdf`;
  - la sanitización HTML hacia Puppeteer.
- **Dependencias:** parada.
- **Riesgo:** **medio-alto**. Es el área más grande (11 607 líneas); las consultas de contenedor `docform` y `docstudy` están en uso; la firma con el dedo usa `fixed`.
- **Pruebas:** unitarias de documentos (las que existan), sin cambios de texto salvo el error único.
- **Verificación:** V-común contra `docs-a/b/c`, generando los 8 PDF de prueba en local con la semilla.
- **Terminado cuando:** A7 y A14 están completos.
- **Paralelo:** con B5, B6 y B10. Puede alargarse hasta la segunda oleada sin pisar a B8, porque las secciones de `spinus-tokens.css` son disjuntas.

### B10 · Cuenta y administración

- **Objetivo:** `perfil`, `admin` y `lectura`:
  - Mi perfil con el grupo «Ajustes» (§23.11);
  - «Editar consultorio» (§30.6);
  - las 6 paletas con vista previa (ver §2.2);
  - Google Calendar; firma;
  - Usuarios con «Todavía no hay nadie en tu equipo»;
  - Facturación con «funciones» y «Prueba» (§23.10);
  - asistente de perfil (`cromo/7`).
- **Archivos:**
  - `app/(app)/perfil/page.tsx` (1 442) y `components/perfil/*` (6);
  - `components/consultorios/*` (2);
  - `components/onboarding/*` (2);
  - `app/(app)/admin/usuarios/page.tsx` y `app/(app)/billing/page.tsx` (cuerpo; la cabecera es de B4);
  - `components/billing/SubscriptionGateProvider.tsx`, sin cambios de lógica.

  Unos 13.
- **No toca:** Stripe, la lógica de suscripción, `/pricing`.
- **Dependencias:** parada.
- **Riesgo:** medio (la barra de guardado de perfil es `fixed` con `lg:left-64`; tiene que respetar la navegación de cada formato).
- **Pruebas:** ninguna e2e.
- **Verificación:** V-común contra `perfil` y `admin`, con roles admin e invitado.
- **Terminado cuando:** A16, A18 y A19 están completos y el asistente está entero (7 pasos).
- **Paralelo:** con B5, B6, B9, y en la segunda oleada con B7.

### B11 · Ayuda, estadísticas, suplementación

- **Objetivo:** `lectura` y `tanda4`. Estadísticas con «Reintentar» en el error (§23.12). Suplementación con «Agregar suplemento» (§20). Acordeón de ayuda sin animar `max-height` (arreglo: solo `transform`/`opacity`).
- **Archivos:** `ayuda/page.tsx`, `estadisticas/page.tsx` (cuerpo), `suplementacion/page.tsx`. 3.
- **Dependencias:** B4 (cabecera de pestañas). **Riesgo:** bajo.
- **Pruebas:** ninguna.
- **Verificación:** V-común.
- **Terminado cuando:** A15, A17 y A20 están completos.
- **Paralelo:** con B7, B8, B9 y B10.

### B12 · Integración de pantallas (push 2)

- **Objetivo:** pasada de integración del orquestador (`kit/INTEGRACION.md`). Sin restos de reparto ni archivos fuera de su lista. Comprobación cruzada de navegación entre pantallas. `chk-app.js` sobre todas las rutas.
- **Verificación:** e2e completa, `npm test`, y capturas de todas las rutas en los cinco formatos, claro y oscuro.
- **Terminado cuando:** todo está en verde y se hace el push 2. El dueño puede mirar el preview; no es una parada obligatoria.

### B13 · Agenda (último bloque, el de más riesgo), en sub-bloques

**Reglas propias de la agenda:**

- No cambian clases `.fc-*`, `.ag-*`, `.agenda-*`, roles, `aria-label`, `data-*` ni textos, **salvo** la lista aprobada: §28 (textos unificados), §29.3–§29.4 («Volver» y verbos), §29.8 («Sin coincidencias.»), §29.9 («Fecha y hora», «Detalles»), «Invitar» / «No invitar», «Es otra persona» con su mensaje, y los `aria-label` aprobados (§30.8).
- Antes de tocar CSS de FullCalendar se lee `docs/spec/RIESGOS_AGENDA.md` (18 puntos).
- La agenda v1 (bandera apagada) no se rediseña, pero tiene que seguir funcionando. Tras cada sub-bloque se pasa una vuelta con la bandera apagada (`agenda-interruptor.e2e.ts`).
- Tras cada sub-bloque: unitarias completas, las e2e del sub-bloque, y **la e2e completa de agenda tras cada integración en la rama común**.

**Sub-bloques:**

| Sub | Objetivo | Archivos principales | e2e más expuestas (orientativo, por nombre; confirmar con grep) | Riesgo |
|---|---|---|---|---|
| **AG0** Tokens y movimiento | `--cal-*` (PIEZAS §1) en `sistema.css`; `--ag-dur-*` → tokens de resorte; `REGLA_AGENDA` con el tope nuevo y su prueba; velo de agenda con desenfoque y transparencia reducida | `sistema.css`, `globals.css` (bloques de movimiento l.3743–3934, 5920–6030), `lib/agenda/movimientoAgenda.ts` y su test | `agenda-f-movimiento`, `agenda-k-salida-modal`, `agenda-t1-capas` | medio |
| **AG1** Piezas base | Bloque de cita (regla de contenido por duración y ancho con consultas de contenedor, nada < 12 px) **dentro de `renderEventContent`/`MemoizedEventContent` y conservando sus clases**; rejilla (80 px/h, `--cal-hw`, fuera de horario, rayado, línea de ahora); barra en 2 filas por formato (PIEZAS §4); avisos de página; panel del día en `esc`; conmutador de 4 | `renderEventContent.tsx`, `MemoizedEventContent.tsx`, `renderNowIndicator.tsx`, `CabeceraEscritorio.tsx`, `BandaMovil.tsx`, `NavegacionBandaMovil.tsx`, `FiltrosBandaMovil.tsx`, `BarraAgendarMovil.tsx`, `AvisosAgenda.tsx`, `PanelDelDia.tsx`, `CardResumen.tsx`, `CardHuecos.tsx`, `MiniMes.tsx`, `TileResumen.tsx`, `DesgloseEstados.tsx`, `FilaDelPanel.tsx`, `IconoDelEvento.tsx`, `MarcasCita.tsx`, `agenda/loading.tsx`, `AgendaCliente.tsx` (solo el JSX del contenedor y la altura), `globals.css` l.1484–3600 y 5517–5920 | `agenda-vistas`, `agenda-movil`, `agenda-m3-barra`, `agenda-i5-barra-avisos`, `agenda-avisos`, `agenda-f-pulido`, `agenda-f-simetria`, `agenda-m3-rayado`, `agenda-k1-bloqueos*`, `agenda-todo-el-dia`, `agenda-panel-dia`, `agenda-f-minimes`, `agenda-h4-huecos-turnos`, `agenda-f-tarjeta`, `agenda-k5-marcas`, `agenda-g4-*`, `agenda-k4-*`; unitarias `ranurasCabecera`, `herramientasV2`, `marcasProcedencia`, `origenGoogle`, `avisosAgenda` | **alto** |
| **AG2** Día y 3 días | **Cambio de comportamiento aprobado:** `FORMATOS_DE_VISTA` pasa a 4 filas (Mes, Semana, 3 días, Día); «3 días» siempre en rejilla y en todos los formatos (§29.1); Día en `tel`/`ext` como rejilla (§28) sin hueco para agendar; formato desde `lib/formatoPantalla.ts` en lugar de `innerWidth` (media query y estado de React tienen que cruzar en el mismo píxel, `globals.css:5224`); arrastre táctil con pulsación larga como hoy (§29.13) | `lib/agenda/vistasAgenda.ts` y sus pruebas, `opcionesCalendario.ts`, `AgendaCliente.tsx` (efecto de formato) | `agenda-vistas`, `agenda-f-tableta` (**se reescribe**: en `iv` Semana tiene 7 columnas y «3 días» es aparte), `agenda-movil` (listDay → rejilla), `agenda-arrastre`, `agenda-candado-gesto`, `agenda-f-deslizar`, `agenda-cache-rangos` | **alto** |
| **AG3** Semana | Lista por día con tira de fechas en `ext`/`tel` (versión A, `listWeek`); 7 columnas en `ih`/`iv`/`esc` | `FilaLista.tsx`, `FilaListaDetalle.tsx`, `CabeceraDiaLista.tsx`, `renderSinEventos.tsx`, `globals.css` l.2756–3520 | `agenda-movil`, `agenda-vistas`, `agenda-f-deslizar` | medio-alto |
| **AG4** Mes | PIEZAS-MES (chip `.am-ch` sobre `dayGridMonth`, celda, cuántos caben, «+N», panel del día del teléfono) | `MonthChip.tsx`, `globals.css` l.5200–5517 | `agenda-vistas`, `agenda-movil`, `agenda-filtro` | medio |
| **AG5** Burbuja y alta | Burbuja como capa del catálogo (tarjeta en `ext`/`ih`/`iv`/`esc`, hoja en `tel`); acciones como filas de menú con la destructiva al final; lápiz en «Más opciones de la cita» (§29.5); motivos visibles sin `title` (§29.7); `BurbujaAlta`; `TarjetaLectura`; `ConfirmModal` con título, mensaje y **verbo** (§29.4, la prop se pasa desde `guardadoCitas.ts` y `altaCitas.ts`); `PreguntaAsistencia`; `PanelReagendar`; `ConvertirEnCita` | `BurbujaCita.tsx`, `BurbujaAlta.tsx`, `TarjetaLectura.tsx`, `InteraccionesV2.tsx` (solo presentación), `ConfirmModal.tsx`, `PreguntaAsistencia.tsx`, `PanelReagendar.tsx`, `ConvertirEnCita.tsx`, `lib/agenda/accionesTarjeta.ts` (textos), `guardadoCitas.ts`, `altaCitas.ts` (rótulos), `globals.css` l.5920–6860 | `agenda-f-burbuja`, `agenda-h3/k5/m1/t1-burbuja`, `agenda-t1-capas`, `agenda-f-pasar-raton`, `agenda-f-tarjeta-al-pasar`, `agenda-reabrir-desplegables`, `agenda-empalme`, `agenda-arrastre` (**«Aceptar» → verbo: 37 apariciones en 18 e2e**); unitarias `burbujaCita`, `capasAgenda`, `accionesTarjeta` | **alto** |
| **AG6** Formulario | `AppointmentModal` en el catálogo (pantalla completa en `tel`, modal en el resto); grupos «Fecha y hora» y «Detalles»; **confirmación al cancelar o eliminar** (§29.2) con «Volver» (§29.3); `ModalBloqueo` (verbos «Quitar bloqueo»…); `ModalInvitacionCita` («Invitar» / «No invitar», arreglo de «Enviar invitación» que no cabe en `ext`); recordatorios; `BloqueReservaPorLigar` | `AppointmentModal.tsx` (2 020; 59 `max-md`), `ModalBloqueo.tsx`, `ModalInvitacionCita.tsx`, `BotonWhatsAppCita.tsx`, `BotonCorreoCita.tsx`, `BloqueReservaPorLigar.tsx` | `agenda-citas`, `agenda-cancelar`, `agenda-modal-diferido`, `agenda-m3-alta-bloqueo`, `agenda-l1-bloqueo-telefono`, `agenda-g3-*`, `agenda-iniciar-consulta`, `agenda-tipos-cita`, `recordatorios`, `whatsapp-manual` | **alto** |
| **AG7** Ligado y Google | `VentanaLigarCita` (título «Ligar paciente e iniciar consulta» con eslabón), `PanelLigarCita` («Sin coincidencias.»), `BotonNoEsCita` (explicación visible), eventos de Google y origen unificado (§28) | `VentanaLigarCita.tsx`, `PanelLigarCita.tsx`, `BotonNoEsCita.tsx`, `GoogleEventCard.tsx`, `GoogleGIcon.tsx`, `MarcaOrigenGoogle.tsx`, `LeyendaEstados.tsx` (textos) | `agenda-j3-ligar-ventana`, `agenda-ligar-consulta`, `agenda-por-ligar`, `agenda-i3-por-asignar`, `agenda-convertir-google`, `agenda-google-dos-sentidos`, `agenda-reflejo-*`, `agenda-k1-bloqueos-google`, `reserva-google`; unitarias `origenGoogle`, `marcasProcedencia` | medio-alto |
| **AG8** Herramientas | Opciones de la agenda (engrane y «···» por formato, PIEZAS §4), buscar, campana, médico, leyenda (sale de la barra, §28), atajos, huecos en `ih`/`iv` (§28), ir a una fecha, **plegar menú** (en `Sidebar.tsx`, coordinado: su único dueño en ese momento) | `HerramientasV2.tsx`, `MenuEngraneAgenda.tsx`, `CampanaAgenda.tsx`, `PanelPorConfirmar.tsx`, `avisos/ListaAvisos.tsx`, `BuscadorCitas.tsx`, `AyudaAtajos.tsx`, `CapaBarra.tsx`, `BotonBloquearHorario.tsx`, `Sidebar.tsx` (plegado) | `agenda-j1-engrane`, `agenda-f-buscador`, `agenda-t1-busqueda`, `agenda-l5-campana`, `agenda-h4-por-confirmar`, `agenda-f-atajos`, `agenda-filtro`, `agenda-secretaria`, `agenda-f-barra`, `agenda-k4-leyenda-husos`; unitarias `herramientasV2`, `avisosClinica` | medio-alto |
| **AG9** Configuración | `ag-config`: pestañas, escala táctil en `iv`/`ih` (hoy el 100 % de sus controles mide < 44 px), color del tipo de cita en la fila (§29.10), «Guardado» 4 s (§29.11), `AvisoGuardado` centrado con insets | `components/agenda/configuracion/*` (montados según `configuracionEscala.test.ts`), `app/(app)/agenda/configuracion/page.tsx` | `agenda-configuracion*`, `agenda-h2/j5/k3/l3/m2-configuracion`, `agenda-config-sembrada`, `agenda-horario-validacion`, `agenda-g4-herencia-horario`, `agenda-enlaces-reserva`, `agenda-g2-turnos`, `agenda-eleccion-i2`; **`configuracionEscala.test.ts` se actualiza a la escala del kit** (ya no se lee de la reserva) | medio |
| **AG10** Primera vez | `ag-pv`: asistente, **arreglo del scroll al cambiar de paso** (`PrimeraVez.tsx:239`, `window.scrollTo` no mueve `<main>`: se desplaza el contenedor real o el encabezado del paso con `scrollIntoView`), agenda vacía con enlace a «Configuración de la agenda» (§29.12) | `PrimeraVez.tsx`, `PasoClinica.tsx`, `PasoHorario.tsx`, `PasoDuracion.tsx`, `CierrePrimeraVez.tsx`, `renderSinEventos.tsx` (enlace) | `agenda-configuracion-guiada`, `agenda-semilla` | bajo-medio |

**Dependencias:** AG0 → AG1. Luego vistas (AG2 → AG3 → AG4) ∥ capas (AG5 → AG6 → AG7 → AG8) ∥ configuración (AG9 → AG10).

**Partición de `globals.css`:**

- vistas: l.1484–5517;
- capas: l.5920–6860;
- oscuro de agenda (l.6869–7197): lo edita **solo AG0 y, al final, el orquestador**.

`AgendaCliente.tsx` es de AG1/AG2. Los agentes de capas no lo tocan; si necesitan un cambio, lo piden.

**Verificación:**

- V-común contra `agenda-base`, `ag-semana`, `ag-mes`, `ag-burbuja`, `ag-form`, `ag-ligado`, `ag-herr`, `ag-config` y `ag-pv`, en los cinco formatos, claro y oscuro.
- Comprobar que `reserva-*` y `confirmacion-*` (páginas públicas) siguen en verde y no cambian de aspecto.
- Repasar la lista de `GUIA_PRUEBAS_AGENDA_V2.md` en las funciones tocadas.

**Terminado cuando:**

- las 72 funciones de A12 y las 20 de A13 tienen su sitio;
- la e2e completa está en verde (salvo las conocidas por hora, ya anotadas);
- 0 texto < 12 (excepción: el mes del chip de fecha a 11);
- se hace el push 3.

### B14 · Retirada del lanzador `/inicio`

- **Objetivo:** que nadie aterrice en `/inicio`, **sin tocar la autoridad de las guardas**.
- **Archivos:**
  - `app/(launcher)/inicio/page.tsx` → `redirect('/dashboard')` de servidor;
  - `app/(launcher)/inicio/layout.tsx` se queda como guarda con `getUser()` (sin usuario → `/login`; la secretaria ya iba a `/dashboard`);
  - `manifest.json/route.ts`: `start_url: '/dashboard'`;
  - `login/layout.tsx:134`: `redirect('/dashboard')`, con la misma autoridad `getUser()` que el destino `(app)/layout.tsx`;
  - `login/page.tsx`: los 5 destinos de cliente → `/dashboard`;
  - `auth/callback/page.tsx:29`;
  - `ErrorBoundary.tsx:73` y `global-error.tsx:74` → `/dashboard`.
- **No se tocan:**
  - `middleware.ts`: su `/` → `/inicio` (excepción tolerada) sigue siendo válido, porque `/inicio` redirige con `getUser()`;
  - `(offline)/offline-mode` (P6): su `/inicio` sigue funcionando por la redirección.
- **Borrados** tras grep (P2): `launcher/TemaLauncher.tsx`, `launcher/ParticleCanvas.tsx`, el `OnboardingModal` montado en `/inicio` (`GateOnboarding` ya lo cubre en `(app)`). **`launcher/ConsultaRapidaModal.tsx` se queda.**
- **Antes de borrar:** la tabla A1 (21 funciones) con su sitio nuevo: insignia y «Actualizar» en la barra (B4); citas de hoy en el dashboard; consulta y documento rápidos.
- **Riesgo:** medio, porque son redirecciones de sesión. Mitigación: comprobar a mano el ciclo cerrar sesión → `/login` → entrar → `/dashboard`, con sesión revocada y JWT todavía válido (el escenario del bucle documentado en CLAUDE.md). Mirar en la red que no haya ráfagas `?_rsc`.
- **Pruebas:** `middlewareRutasPublicas.test.ts` (lista `/inicio` como protegida: sigue siendo cierto); e2e `global-setup` (entra por `/login`).
- **Paralelo:** no.

### B15 · Limpieza final y QA (push 4)

- **Objetivo:** quitar lo viejo sin consumidores y dejar la documentación al día.
- **Qué se borra o cambia:**
  - tokens `--sem-*`, `--user-*`, `--radius-*` y `--azul-*`;
  - `--sp-*` y `.sp-*` con 0 usos;
  - `--ag-*` con 0 consumidores, **conservando los de `agendaPublica.css`**;
  - keyframes muertos: `fadeInUp`, `tabEnter`, `slide-up-modal`, `docTitleIn`, los del lanzador, `ledPulse` si `OnboardingGuide` sigue sin montarse (ver deuda);
  - reglas de la hoja de traducción A cuyas clases ya no aparecen en ningún TSX vivo. **Se conservan** las que usen calculadoras, dicom y super-admin (siguen existiendo);
  - los alias de compatibilidad de §2.1, si ya nadie los lee;
  - `Breadcrumbs.tsx`.
- **Documentos:** se actualizan `docs/spec/MODO_OSCURO_APP.md`, `MODO_OSCURO_AGENDA.md`, `SPEC_AGENDA.md` y `CONTRASTE_Y_MOVIMIENTO_AGENDA.md` (se marcan como sustituidos por `docs/spec/rediseno/`). En `CLAUDE.md` solo se *propone* el cambio al dueño.
- **Método:** script de grep de usos por token o clase; Protocolo 2 por cada borrado de más de 50 líneas.
- **Riesgo:** medio (borrar CSS que alguien usaba con un nombre dinámico: `--ag-status-${estado}`, `--sp-doc-${tipo}`, `--ag-evento-${color}`). Mitigación: buscar también los prefijos dinámicos.
- **Verificación:**
  - e2e completa y unitarias;
  - capturas finales de todas las rutas;
  - CSS compilado ≤ la línea base de 331 KB (objetivo: menos);
  - `chk-app.js` en cero.
- **Terminado cuando:** se hace el push 4 → QA del dueño en el preview (base real, pacientes de prueba). Las rondas de corrección van en un push cada una → merge local por el dueño.

---

## 4. Mapa de paralelismo

| Fase | Bloques | Agentes en paralelo | Notas |
|---|---|---|---|
| Cimientos | B0 → B1 → B2 → B3 → B4 | 1 (2 solo dentro de B3: Toast, Skeleton y Vacío/Error frente a `ModalShell`) | Aquí están casi todos los cuellos de botella |
| Parada | push 1 | — | |
| Oleada 1 | B5, B6, B9, B10 | **4** | Archivos disjuntos (listas por bloque arriba) |
| Oleada 2 | B7 → B8 (mismo agente), B11, resto de B9/B10 | 3–4 | B8 depende de B7 |
| Integración | B12 | 1 (orquestador) | push 2 |
| Agenda | AG0 → AG1, luego {AG2–AG4} ∥ {AG5–AG8} ∥ {AG9–AG10} | **3** | Integración en serie con la e2e de agenda tras cada una; push 3 |
| Final | B14 → B15 | 1 | push 4 |

**Archivos cuello de botella y quién es su dueño:**

| Archivo | Dueño | Regla |
|---|---|---|
| `src/app/globals.css` | B1 y B4 (cromo); AG0 (movimiento y oscuro de agenda); vistas (l.1484–5517); capas de agenda (l.5920–6860); B15 | Las pantallas no-agenda **no lo tocan** |
| `src/app/spinus-tokens.css` | B1 (bloques de tokens); B2 (§1–§10); B8 (§11–§15); B9 (§17–final) | Secciones disjuntas, sin solapes de líneas |
| `src/app/sistema.css` | B1, B2 y B3 (en serie); AG0 (`--cal-*`) | Las pantallas no lo editan: piden la primitiva |
| `src/app/(app)/layout.tsx` | B4 | Nadie más. El guarda no se toca nunca |
| `src/components/layout/Sidebar.tsx` | B4; AG8 (solo el plegado) | En serie |
| `ThemeProvider.tsx`, `ScriptTema.tsx`, manifest | B1 (y B14 el `start_url`) | — |
| `ui/ModalShell.tsx`, `ui/Toast.tsx`, `ui/Skeleton.tsx`, `ui/QuickPatientModal.tsx`, `documentos/SelectorTipoDocumento.tsx` | B3 | Después, solo arreglos pedidos al orquestador |
| `app/(app)/agenda/AgendaCliente.tsx` | B4 (solo altura del contenedor); AG1/AG2 | En serie |
| `playwright.config.ts` | B4 (proyectos nuevos) | — |

**Procedimiento:** cada agente trabaja en su worktree (`feature/rediseno-<bloque>`) y entrega su diff. El orquestador integra en la rama común, en serie, y vuelve a pasar build, lint, unitarias y la e2e de lo tocado.

---

## 5. Plan de pushes y paradas del dueño

| Push | Cuándo | Qué revisa el dueño |
|---|---|---|
| 1 | Tras B0–B4 | **PARADA TEMPRANA obligatoria** en el iPhone Duo real (lista de §3, B4) |
| 2 | Tras B12 (pantallas no-agenda) | Opcional: un vistazo en el preview |
| 3 | Tras B13 (agenda) | Opcional; recomendado por el riesgo |
| 4 | Tras B14 y B15 | **QA final** en el preview (base real, pacientes de prueba con consentimiento) |
| +n | Una por ronda de correcciones del QA | — |

- **Mejor caso:** 4 despliegues.
- **Mínimo:** 3, juntando el 3 y el 4, si el dueño acepta revisar agenda, retirada y limpieza de una vez.
- Nunca se empuja un bloque a medias. Las pruebas en preview solo se piden en las paradas.

---

## 6. Riesgos principales y mitigación

1. **e2e de la agenda (584 `test()` en 105 archivos).**
   - Se conservan clases, roles, nombres y `aria-*`.
   - Los cambios aprobados que rompen pruebas a propósito, cada uno con su actualización en el mismo commit:
     - «Aceptar» → verbos (37 apariciones en 18 archivos);
     - 4 vistas y «3 días» (`agenda-f-tableta`, `agenda-vistas`);
     - Día en teléfono como rejilla (`agenda-movil`);
     - textos unificados (unos 21 archivos entre fuentes y pruebas);
     - 256 → 248 y la navegación plana (`agenda-f-barra`).
   - La línea base de B0 separa los fallos previos por hora o día (unos 13). Se corre en una franja horaria estable o con la hora fijada por el propio helper, si existe.
2. **FullCalendar y sus estilos.**
   - Reglas `.fc` con `!important`, estilos en línea de la librería, `--ag-slot-h` por alto de ventana frente a los 80 px/h del kit, `min-width:0`, `mask-image`, `<option>` blancas sobre blanco, y el pixel en que coinciden media query y estado de React.
   - Mitigación: leer `docs/spec/RIESGOS_AGENDA.md`; no sustituir el DOM de FullCalendar (el «bloque» de la maqueta va **dentro** del contenido del evento); `e2e/ayudas.ts` ya mide los px/min del DOM; capturas por vista y formato.
3. **Hidratación y SSR con la sonda.**
   - La sonda solo escribe atributos en `<html>`, que tiene `suppressHydrationWarning`.
   - Ningún componente cambia su marcado por el formato en el primer render; JS lo lee tras montar.
   - El script va sin `async`/`defer`, como `ScriptTema`, así que no hay destello.
   - Riesgo residual: lectura de `env()` a 0 en el primer instante del arranque standalone de iOS. Mitigación: volver a leer en `pageshow`/`resize` y en el primer `requestAnimationFrame`. ASUMIENDO QUE iOS informa los insets del Duo en la PWA; se comprueba en la parada.
4. **Rendimiento de `backdrop-filter`.**
   - Un solo velo con desenfoque. Nunca desenfoque sobre superficies que se desplazan ni en cromo fijo, y nunca se anima el radio del desenfoque: solo la opacidad del velo.
   - `will-change` solo durante la animación.
   - Se mide en el Duo en la parada. Plan B ya escrito: velo sin desenfoque en `ext`/`tel` si cae de 60 fps.
5. **Safari e iOS.**
   - `linear()` desde Safari 17.2 y `@starting-style` desde 17.5. Sin soporte, la capa aparece sin animación pero funciona.
   - `-webkit-backdrop-filter`.
   - Campos de 16 px (zoom); `text-size-adjust`; `dvh`.
   - `position:fixed` dentro de ancestros con `transform` (la trampa de `animate-slide-up` y `PageTransition`): toda capa va por `ui/Portal.tsx`.
   - La orientación libre del manifest puede exigir reinstalar la PWA (ASUMIENDO).
6. **Movimiento y transparencia reducidos.**
   - Fundido corto en lugar de desplazamiento. Se arregla la cascada de `.fc-event-drop-success`, que hoy ignora el movimiento reducido [informe].
   - ASUMIENDO QUE `prefers-reduced-transparency` no está en todos los navegadores: sin soporte simplemente no aplica, y el velo sigue siendo legible.
7. **Tamaño del CSS.**
   - Línea base de 331 KB. Durante la migración conviven lo viejo y lo nuevo (+5–10 % esperado).
   - Las pantallas usan utilidades de Tailwind, que se deduplican.
   - B15 lo deja por debajo de la línea base. Se mide en cada push.
8. **Marca por clínica.** Una paleta derivada puede dar contrastes bajos (tonal sobre tonal). Se miden los contrastes AA de las 6 paletas en claro y oscuro en B1.
9. **Teléfono normal en horizontal** (franjas laterales de 59, alto de 393). Cae en `ih`. Se revisa en el QA; ver pregunta 5.
10. **Agenda v1 (bandera apagada).** Comparte CSS con la v2. Se pasa `agenda-interruptor.e2e.ts` tras cada sub-bloque, y no se rediseña.

---

## 7. Arreglos de front incluidos y deuda que NO se toca

### 7.1 Arreglos de front incluidos (se corrigen y se reportan)

- `PrimeraVez.tsx:239`: el paso nuevo no vuelve arriba porque `window.scrollTo` no mueve `<main>` (AG10).
- Avisos: `role="status"`/`"alert"`, arriba y centrados, insets, cierre con nombre accesible, duraciones uniformes, «Guardado» 4 s (B3, AG9).
- Error al guardar duplicado (banda + aviso) en los 8 formularios: queda un solo mensaje (B9).
- Confirmación al cancelar o eliminar una cita o evento desde el formulario, con «Volver» (AG6).
- Paleta ⌘K: `role="dialog"`, `aria-modal` y nombres accesibles (B4). El texto de la promesa y la cita legal no se tocan (ver deuda).
- Botón de menú sin `aria-label`/`aria-expanded`; botones de icono sin nombre: se aplican los `aria-label` aprobados en §30.8 (todos los bloques).
- Información que solo vive en `title` (185 apariciones): icono y texto visible donde la maqueta lo dibuja (§29.7), y en las notas de medición de labs (B7).
- `ModalShell` y los diálogos sin salida animada; velos que se desplazan 8 px; animaciones de `left`/`width`, `max-height`, `grid-template-rows`, `box-shadow` y `background-position`; 62 `transition-all`; bucles infinitos del aviso de perfil (B3, B4, B11).
- Movimiento reducido sin cubrir: `.skeleton`, `.sp-*` animados, `scroll-behavior: smooth`, `.fc-event-drop-success` (B1, B3, AG0).
- Controles bajo las franjas (franja lateral sin inset en toda la app) y `AvisoGuardado` sin inset (B1, B4, AG9).
- Tokens usados pero no definidos: `--sp-text-strong`, `--sp-text-muted`, `--color-success` (B15, o el bloque que los consuma).
- Texto terciario por debajo de AA (`slate-400`, `--sp-ink-350`, `--ag-muted`, `#86868b`): lo resuelve la paleta del kit.
- «Enviar invitación» que no cabe en `ext` y demás hallazgos reales de `botones-desbordados.md` (AG1, AG6, B6).

### 7.2 Deuda que NO se toca (se anota en `DEUDA_TECNICA.md` en B0)

- «Eliminar expediente» promete borrado permanente frente a borrado lógico. Solo se aplica el nombre aprobado «Eliminar paciente».
- El saludo usa la primera palabra del nombre.
- Estirar un evento guarda sin preguntar.
- «Terminar después» con un paso inválido no guarda y no lo dice.
- Código muerto: `ConfiguracionCalendario` (≈1 400 líneas) y `OnboardingGuide` (717, sin consumidores). `HorarioModal` no se abre con la v2. Borrarlos requiere el OK del dueño.
- Enlaces de reserva que dan 404 en producción por el aviso legal pendiente.
- «Reservó Revisión de estudios» (`PanelLigarCita.tsx:41`); «Agendar» con la hora sin redondear; código de reserva inválido que muestra 404 en inglés.
- Burbuja de un evento de todo el día con «00:00 – 00:00 · 1440 min». Sin verificar: si se confirma en vivo, se anota.
- `FaltaParaEnlace.tsx:57` apunta a `#config-disponibilidad`, que ya no existe; la secretaria ve filas de duración sin saber de qué consultorio son.
- Paleta ⌘K: promete «solo nombre, teléfono y motivo» y cita «LFPDPPP Art. 9» (también en otro comentario).
- El aviso de revocación al cerrar sesión se pierde al navegar (`Sidebar.tsx:477-481`).
- Marcadores de campo con nombres reales («Ej: Clínica Ortointegra», universidad real).
- Validaciones con globos nativos en inglés; «conexion», «bunker», «Escrito medico» sin acentos.
- `CLAUDE.md` desactualizado (el focus trap de `ModalShell` ya existe; `RESUMEN_DASHBOARD` está obsoleto).
- Ayuda: sello «AES-256-GCM», guía DICOM, «Mi perfil → Facturación», atajos sin los de agenda v2, guías desfasadas.
- Plan gratuito «0/0» asistentes; «Reactivar suscripción» lleva a la misma página.
- Fecha ficticia del 1 de enero para pacientes con solo la edad; «Desconectar» Google y «Eliminar» firma sin confirmación.
- «Documento eliminado» al borrar un archivo; la fila de envío muestra el correo anterior; `?cita=` sin señal visible.
- Unas 13 e2e dependen de la hora o del día.
- Módulo `(offline)` / búnker: queda fuera del rediseño por el Protocolo 6. ASUMIENDO QUE el dueño no lo quiere ahora.

---

## 8. Preguntas abiertas que bloquean

1. **Paletas por clínica (bloquea B1):** ¿de acuerdo con que «Spinus (defecto)» pase a verse con los colores del kit (#1B2B4A / #2F5AA8) y que las otras cinco paletas deriven navy, acción y tonal de sus dos colores? Los PDF y la base no cambian.
2. **Calculadoras (bloquea B4):** la navegación nueva no tiene entrada a Calculadoras. ¿Quedan accesibles solo por URL hasta que se eliminen, o se deja una fila temporal en «Más» y en la barra?
3. **Oscuro (bloquea B1):** hoy solo se activa con el interruptor y se guarda por dispositivo; las maquetas siguen al sistema. ¿Se mantiene como hoy (recomendado: es solo estético) o pasa a seguir al sistema mientras no se elija otra cosa?
4. **Movimiento de la agenda (bloquea AG0):** el catálogo aprobado pide resortes de 0,36 s y la regla probada de la agenda lo limita a 240 ms. ¿Se sube el tope de esa regla (y su prueba) a unos 400 ms?
5. **Integración de ramas (no bloquea el inicio; sí el merge):** ¿`feature/agenda-v2` se integra en `main` antes del rediseño, o se fusionan juntas al final? `main` trae, por ejemplo, el skill `apple-design`, que esta rama no tiene. Y, de paso: un iPhone normal en horizontal se mostraría con la composición de Duo abierto horizontal. ¿Vale así?

---

