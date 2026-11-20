# Auditoría de movimiento, gestos y respuesta al toque — Spinus (app autenticada)

Rama auditada: copia de `feature/agenda-v2` en `scratchpad/app`. Medida contra `.agents/skills/apple-design/SKILL.md` (origin/main).
Trabajo de solo lectura. Rutas relativas a la raíz de la copia.

**Alcance:** 456 archivos `.ts/.tsx` de `src/` (app autenticada: `(app)`, `(launcher)/inicio`, `components/*`, `hooks`, `lib`), más `src/app/globals.css` (7 740 líneas) y `src/app/spinus-tokens.css` (2 813).
**Excluido:** calculadoras, dicom, super-admin, `taller-v2` (es de super-admin), landing y páginas públicas, `agendaPublica`, `legal`, `lib/pdf`, `(offline)`, `api`, tests. Háptica fuera.

**Convención:** **[V]** = verificado leyendo el código o contando con grep/script. **[I]** = inferido (comportamiento en tiempo de ejecución no ejecutado, default de librería, o estimación). No se ejecutó la app ni se midió nada en navegador: todo lo que es «cómo se siente» es [I].

---

## 0. Titulares

1. **[V] La librería `motion` no se usa en la app autenticada. Cero imports.** Los 20 archivos que la importan son 19 de `components/landing/**` y `src/hooks/useTilt.ts`, cuyo único consumidor es `landing/sections/SeccionFeatures.tsx:9`. La agenda lo declara explícito: «`motion` no se usa (diseño F §2)» (`src/lib/agenda/flipTarjetas.ts:33`).
2. **[V] No hay un solo resorte en la app.** Todo es CSS `@keyframes`, `transition` y 4 llamadas a WAAPI (`element.animate`) con duración fija y cubic-bezier.
3. **[V] Feedback de pulsación casi inexistente.** 526 `<button>` + 91 `<Link>` en alcance; 18 utilidades `active:` en 9 archivos, y una sola regla `:active` en todo el CSS (`.sp-btn--primary:active`, `spinus-tokens.css:882`). Los ~250 selectores `.ag-*` de la agenda no tienen ningún `:active`.
4. **[V] Ninguna superficie se puede arrastrar para cerrar.** Ni modal, ni hoja, ni menú lateral. El único gesto con seguimiento continuo del dedo en toda la app es el deslizamiento de periodo de la agenda (detrás del interruptor `agendaV2`), y no entrega velocidad al soltar.
5. **[V] Hay tres sistemas de movimiento que no se hablan:** (a) clases `animate-*` legacy con la curva «iOS» `cubic-bezier(0.32,0.72,0,1)` y duraciones literales; (b) tokens `--sp-dur-*`/`--sp-ease-*` del sistema de diseño (formularios de documentos, funnel de nota); (c) tokens `--ag-dur-*`/`--ag-ease-*` de la agenda, con tope de 240 ms y prueba e2e propia. Más el default de Tailwind (150 ms) que es, por conteo, el más usado.
6. **[V] `prefers-reduced-transparency` y `prefers-contrast`: cero apariciones en todo `src/`.**

---

## 1. Inventario de animación

### 1.1 Tokens de duración y easing

**Escala `--sp-*`** — `src/app/spinus-tokens.css:466-476` [V]

| Token | Valor | Usos en CSS (`var(--…)`) | Usos en TSX en alcance |
|---|---|---|---|
| `--sp-dur-micro` | 120ms | 23 | 1 (`ui/SelectorSegmentado.tsx:70`) |
| `--sp-dur-fast` | 180ms | **0** | 0 |
| `--sp-dur-base` | 240ms | 1 | 1 (`(app)/perfil/page.tsx:1323`) |
| `--sp-dur-slide` | 320ms | 2 | 0 |
| `--sp-dur-enter` | 280ms («entrada del modal») | **0** | 0 |
| `--sp-dur-check` | 520ms | 2 | 0 |
| `--sp-dur-spin` | 900ms | 2 | 0 |
| `--sp-ease-out` | `cubic-bezier(.2,0,0,1)` | 25 | 2 |
| `--sp-ease-in` | `cubic-bezier(.4,0,1,1)` | **0** | 0 |
| `--sp-ease-inout` | `cubic-bezier(.4,0,.2,1)` | 3 | 0 |
| `--sp-ease-spring` | `cubic-bezier(.34,1.32,.64,1)` | 1 (`.sp-medal__core`) | 0 |

**Escala `--ag-*`** — `src/app/globals.css:216-222` [V]

| Token | Valor | Usos en CSS | Usos en TSX/TS en alcance |
|---|---|---|---|
| `--ag-dur-micro` | 120ms | 30 | 19 |
| `--ag-dur-base` | 180ms | 11 | 13 |
| `--ag-dur-lento` | 240ms | 4 | 3 |
| `--ag-ease-out` | `cubic-bezier(0,0,.2,1)` | 10 | 6 |
| `--ag-ease-in` | `cubic-bezier(.4,0,1,1)` | 6 | 2 |
| `--ag-ease` | `cubic-bezier(.4,0,.2,1)` | 28 | 4 |

**Extensión `--lp-*`** (`globals.css:601-614`): `--lp-dur-section`, `--lp-dur-cine`, `--lp-ease-cine`, `--lp-dur-glint`. **[V] Cero usos en la app** (0 en TSX en alcance; en CSS solo `--lp-dur-glint` en `.lp-borde-destello`, que es de landing).

**Respuesta a la pregunta «¿los tokens ya se usan en la app?»** [V]
- `--sp-dur-*`/`--sp-ease-*`: **sí, pero solo dentro de las clases `.sp-*`** de `spinus-tokens.css` (botones, inputs, chips, tarjetas de tipo de documento, secciones plegables). En TSX de la app solo hay 2 componentes que los nombran directamente. 3 de los 11 tokens no tienen ningún consumidor (`--sp-dur-fast`, `--sp-dur-enter`, `--sp-ease-in`).
- `--ag-*`: uso disciplinado y completo en la agenda, con lectura desde JS (`src/lib/agenda/movimientoAgenda.ts:68-93`) y regla probada en e2e («solo `opacity` y `transform`, nada por encima de 240 ms», `movimientoAgenda.ts:21-24`, `TOPE_MOVIMIENTO_MS = 240` en `:43`).
- `--lp-*`: no.
- Las dos escalas se solapan sin compartir nombres: `--sp-ease-in` ≡ `--ag-ease-in`; `--sp-ease-inout` ≡ `--ag-ease`; `--sp-ease-out` ≠ `--ag-ease-out`; 120/180/240 existen en ambas con nombres distintos (`sp-base`=240 vs `ag-base`=180).
- La curva más repetida en el código legacy, `cubic-bezier(0.32,0.72,0,1)`, **no es token**: 11 apariciones en `globals.css`, constante `IOS_EASING` redeclarada en 5 archivos (`documentos/DiagnosticosEditor.tsx:13`, `labs/ModalSubirDocumento.tsx:16`, `labs/TablaMediciones.tsx:11`, `labs/ModalAgregarMedicion.tsx:17`, `labs/AutocompleteAnalito.tsx:7`) y 4 utilidades arbitrarias de Tailwind.

### 1.2 `@keyframes` — `globals.css` (40) y `spinus-tokens.css` (6) [V]

Usos = referencias en TSX en alcance (clase o nombre). «Muerto» = sin regla CSS que lo aplique y sin referencia en `src/`.

**Legacy de toda la app**

| Keyframe (línea) | Anima | Clase / duración / easing | Dónde se usa | Usos |
|---|---|---|---|---|
| `shimmer` (972) | `background-position` ⚠ | `.skeleton` 1.4s ease-in-out ∞ (979) | `ui/Skeleton.tsx` y 17 archivos más | 38 refs / 18 archivos |
| `slideInRight` (984) | opacity + translateX 20px | `animate-[slideInRight_0.25s_ease-out]` | `ui/Toast.tsx:84` | 1 |
| `fadeInUp` (988) | opacity + translateY 8px | `.animate-fade-in-up` 0.2s ease-out both | — | **0 (muerta)** |
| `fadeIn` (997) | opacity + translateY 8px (no es un fundido puro) | `.animate-fade-in` 0.18s ease-out both | velos de `ModalShell.tsx:205`, `SheetFiltrosExpediente.tsx:147`, `admin/usuarios/page.tsx:221,316`, `expediente/[id]/page.tsx:233`, `documentos/SelectorTipoDocumento.tsx:257,285` | 10 |
| `avisoPulse` (1021) | opacity + scale | `.animate-aviso-pulse` 1.4s ease-in-out ∞ | `sidebar/AvisoPerfilSidebar.tsx:189` | 1 |
| `avisoHalo` (1027) | `box-shadow` ⚠ | `.animate-aviso-halo` 2.8s ease-out ∞ | `AvisoPerfilSidebar.tsx:158` | 1 |
| `avisoSheen` (1045) | translateX | `.animate-aviso-sheen` 3.6s ease-in-out ∞ | `AvisoPerfilSidebar.tsx:182` | 1 |
| `slideUp` (1065) | opacity + translateY 12px | `.animate-slide-up` 0.32s `(0.32,0.72,0,1)` both, `will-change: transform, opacity` | entrada de contenido de página en 11 páginas + panel de `CommandPalette.tsx:257` (con `animationDuration: 0.2s` en línea, `:258`) + diálogos caseros (`admin/usuarios/page.tsx:222,317`, `expediente/[id]/page.tsx:234`) | 20 / 12 archivos |
| `pageEnter` (1175) | opacity + translateY 6px | `.animate-page-enter` 0.24s `(0.32,0.72,0,1)` backwards | `layout/PageTransition.tsx:9` | 1 (envuelve todas las páginas de `(app)`) |
| `tabEnter` (1191) | opacity + translateX 8px | `.animate-tab-enter` 0.2s | — | **0 (muerta)** |
| `modalEnter` (1201) | opacity + scale .94 + translateY 8px | `.animate-modal-enter` 0.22s `(0.32,0.72,0,1)` both; `.animate-slide-up-modal` idéntica (1212, **0 usos**) | `ModalShell.tsx:248`, `QuickPatientModal.tsx:221`, `OfflineAlert.tsx:48`, `agenda/HorarioModal.tsx:110`, `agenda/ModalInvitacionCita.tsx:624` (+ 1 arbitraria `animate-[modalEnter_0.22s_…]`) | 6 + 1 |
| `slideUpSheet` (1217) | translateY 100%→0 | arbitraria 0.3s `(0.32,0.72,0,1)` | `expediente/SheetFiltrosExpediente.tsx:152` | 1 |
| `slideDownSheet` (1222) | translateY 0→100% | arbitraria 0.3s misma curva | `SheetFiltrosExpediente.tsx:151` | 1 |
| `fadeOut` (1227) | opacity | arbitraria 0.3s ease-out | `SheetFiltrosExpediente.tsx:147` | 1 |
| `launcherFadeIn` (4833) | opacity + translateY 16px | `.launcher-card-0/1/2` 0.5s con retraso 0.15/0.3/0.45s; `.launcher-greeting` 0.6s | `(launcher)/inicio/page.tsx` | 5 refs |
| `iconBounce` (4844) | scale 1→1.15 | `hover:animate-[iconBounce_0.5s_ease-in-out]` | `(launcher)/inicio/page.tsx:316,339,360` | 3 (solo hover) |
| `ledPulse` (4849) | `box-shadow` triple ⚠ | inline `animation: 'ledPulse 2s ease-in-out infinite'` | `ui/OnboardingGuide.tsx:566` | 1 |
| `docTitleIn` (4854) | opacity + translate + scale | — | — | **0 (muerto)** |
| `slideFromRight` / `slideFromLeft` (4859/4863) | opacity + translateX ±60px | `.animate-slide-from-right/left` 0.3s `(0.32,0.72,0,1)` both | `expediente/[id]/nueva-nota/page.tsx:103-104` | 1 + 1 |
| `alertGlow` (4880) | `color` ⚠ | `.animate-alert-glow` 2s ease-in-out ∞ | `nueva-nota/page.tsx:1384` | 1 |
| `dropGlow` (4888) | `box-shadow` ⚠ | `.fc-event-drop-success` 0.6s ease-out `!important` (4894) | `agenda/guardadoCitas.ts:490` (se quita con `setTimeout` 700 ms, `:491`) | 1 |

**Agenda (bloque F)** — todos en tokens `--ag-*`, todos opacity/transform

| Keyframe (línea) | Anima | Regla | Duración / easing |
|---|---|---|---|
| `ag-barra-carga` (1801) | translateX | `.ag-barra-carga::after` (1799) | 1.1s linear ∞ (literal a propósito) |
| `ag-entra` (3674) | opacity + translateY 4px | `.fc-event.ag-ev-nuevo` (3729) | base / ease-out |
| `ag-vista` (3701) | opacity + translateY 6px | `.ag-dia-aside` (3706) y vista | base / ease-out |
| `ag-entra-opacidad` (3795) | opacity | filas de lista y Mes (3800) | base / ease-out |
| `ag-pulso` (3819) | opacity | anillo de tiempo real `::after` (3842) | lento / ease, retraso base, 1 vez |
| `ag-sale` (3853) | opacity | `.fc-event.ag-ev-saliendo` (3857) | micro / ease-in |
| `ag-aviso-entra` / `-sale` (3875/3878) | opacity + 6px / opacity | `.ag-banda-compacta` (3883/3887) | lento ease-out / base ease-in |
| `ag-modal-entra` / `-sale` (3911/3914) | opacity + translateY 6px | `.ag-modal-panel` (3924/3930) | lento ease-out / base ease-in |
| `ag-modal-velo-entra` / `-sale` (3917/3920) | opacity | `.ag-modal-velo` (3927/3934) | lento / base |
| `ag-capa-entra` / `-sale` (5950/5951) | opacity + scale .97 | `.ag-capa` (5976/5983) | base ease-out / micro ease-in |
| `ag-hoja-entra` / `-sale` (5952/5953) | opacity + translateY 6px | `.ag-hoja` (6014/6018) | base / micro |
| `ag-velo-entra` (5954) | opacity | `.ag-capa-velo` (6027) | base; **sin keyframe de salida** |

Uso de las clases: `ag-capa` 94 refs / 17 archivos; `ag-modal-panel` 9 / 6; `ag-modal-velo` 7 / 5; `ag-capa-velo` 4 / 4; `ag-hoja` 1 archivo (`agenda/TarjetaLectura.tsx:247`); `ag-banda-compacta` 10 / 3.

**Sistema de diseño (`spinus-tokens.css:2385-2393`)**

| Keyframe | Anima | Regla | Usos |
|---|---|---|---|
| `sp-spin` | rotate | `.sp-spinner` (1191) `--sp-dur-spin` linear ∞ | 16 refs / 6 archivos |
| `sp-pop` | scale .6→1.04→1 + opacity (rebote scripteado) | `.sp-medal__core` (1044) `--sp-dur-check` `--sp-ease-spring` | 2 archivos |
| `sp-draw` | `stroke-dashoffset` ⚠ | `.sp-medal__core path` (1050) | idem |
| `sp-wave` | opacity | `.sp-dots span` (1199) 1.2s ∞ | 1 archivo |
| `sp-push-fwd` | opacity + translateX 24px | `.sp-push-forward` (2394) `--sp-dur-slide` `--sp-ease-inout` | `documentos/FirmadoConsentimiento.tsx:313`, `documentos/PlantillasDocumento.tsx:639` |
| `sp-push-back` | opacity + translateX −24px | `.sp-push-backward` (2395) | **0 (muerta)** |

Landing (fuera de alcance, solo constancia): `lp-giro-borde` (`globals.css:7309`).

**Utilidades `animate-*` de Tailwind en alcance** [V]: `animate-spin` 62 usos / 33 archivos; `animate-pulse` 3 (`SeguimientosWidget.tsx:49`, `admin/usuarios/page.tsx:189`, `expediente/page.tsx:37`); `animate-bounce` 1 (`ui/OnboardingGuide.tsx:275`). Además un `animation: 'pulse 1.5s ease-in-out infinite'` en línea (`nueva-nota/page.tsx:1378`) que depende de que Tailwind emita `@keyframes pulse` [I].

**Otras fuentes de animación** [V]: Recharts `animationDuration={400}` (`labs/GraficaAnalito.tsx:212`); lienzo de partículas con `requestAnimationFrame` (`launcher/ParticleCanvas.tsx:124`); `html { scroll-behavior: smooth }` (`globals.css:888`).

**WAAPI (`element.animate`) — 4 llamadas, todas en agenda** [V]
- `lib/agenda/flipTarjetas.ts:106,109` — FLIP de tarjeta movida por otro usuario / revertida: `translate(dx,dy)→none`, `--ag-dur-base`, `--ag-ease`; en listas solo fundido.
- `lib/agenda/movimientoAgenda.ts:143` — fundido de navegación del armazón, opacity .7→1, `--ag-dur-micro`, cancela el anterior por `id` (`:141`).
- `app/(app)/agenda/useDeslizarPeriodo.ts:68` — vuelta del deslizamiento, `translateX(desde)→none`, `--ag-dur-base`, `--ag-ease`.

### 1.3 `transition`

**En CSS** [V] — 39 declaraciones (20 agenda, 15 `.sp-*`, 2 otras, 2 landing).

| Duración | Conteo | | Easing | Conteo |
|---|---|---|---|---|
| `var(--ag-dur-micro)` | 27 | | `var(--ag-ease)` | 27 |
| `var(--sp-dur-micro)` | 23 | | `var(--sp-ease-out)` | 24 |
| `var(--ag-dur-base)` | 1 | | `ease-out` | 2 |
| `var(--sp-dur-base)` | 1 | | `var(--ag-ease-out)` | 1 |
| `180ms`, `120ms` (literal) | 1 + 1 (`.aviso-perfil-colapso`, 1054) | | `ease` | 1 |
| `0.15s` | 1 (`.fc .fc-button`, 1950) | | | |

Propiedades: `background-color` 15, `background` 11, `border-color` 11, `color` 7, `transform` 4, `box-shadow` 3, `opacity` 2, `grid-template-rows` 1, `all` 1.

**En TSX (utilidades Tailwind, alcance)** [V] — 86 archivos con alguna.

| Utilidad | Conteo | | `duration-*` | Conteo | | `ease-*` | Conteo |
|---|---|---|---|---|---|---|---|
| `transition-colors` | 206 | | `300` | 10 | | `ease-out` | 6 |
| `transition-all` | 62 | | `200` | 10 | | `ease-in-out` | 2 |
| `transition-transform` | 19 | | `[var(--ag-dur-micro)]` | 6 | | `ease-in` | 2 |
| `transition-opacity` | 10 | | `150` | 6 | | `[var(--sp-ease-out)]` | 2 |
| `transition-none` | 9 | | `500` | 1 | | `[var(--ag-ease)]` | 2 |
| `transition-[max-width]` | 1 | | `[240ms]`, `[120ms]` | 1 + 1 | | `[cubic-bezier(0.32,0.72,0,1)]` | 2 |
| `transition-[left,width]` | 1 | | `[var(--sp-dur-micro)]`, `[var(--sp-dur-base)]` | 1 + 1 | | `[cubic-bezier(.4,0,.2,1)]` | 1 |
| `transition` | 1 | | **sin clase de duración** | **≈270** | | **sin clase de easing** | **≈290** |

Lectura: de ~310 utilidades de transición solo 37 fijan duración y 17 fijan easing. El resto corre con el default de Tailwind (150 ms, `cubic-bezier(.4,0,.2,1)`) [I: default de Tailwind 4, no leído del build].

**En línea (`style`)** [V]: `agenda/AppointmentModal.tsx:1174` (tokens ag), `documentos/DiagnosticosEditor.tsx:46` (`all 200ms IOS_EASING`) y `:80`, `labs/AutocompleteAnalito.tsx:141` (`all 200ms`), `:148`, `:173` (`background 120ms`).

**Valores de duración distintos presentes en la app (literal o token):** 120, 150, 180, 200, 220, 240, 250, 280*, 300, 320, 400, 500, 520, 600, 900 ms + bucles de 1.1, 1.2, 1.4, 2, 2.8, 3.6 s. (*`--sp-dur-enter` declarado sin uso.)
**Curvas distintas:** 6 cubic-bezier (`(0.32,0.72,0,1)`, `(.2,0,0,1)`, `(0,0,.2,1)`, `(.4,0,.2,1)`, `(.4,0,1,1)`, `(.34,1.32,.64,1)`) + `ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`.

---

## 2. Uso de la librería `motion`

[V] `package.json:50` — `"motion": "^12.43.0"`.

| Archivo | API | Parámetros |
|---|---|---|
| `components/landing/motion/Reveal.tsx`, `Stagger.tsx`, `Parallax.tsx` | `motion.*`, `useReducedMotion`, `useScroll`, `useTransform` | landing |
| `components/landing/sections/Seccion*.tsx` (14) | `motion.*`, `useReducedMotion`, `useScroll`, `useTransform`, `animate`, `useMotionValue`, `useMotionValueEvent` | landing |
| `components/landing/teaser2/RecetaPapel.tsx`, `FirmaCanvas.tsx` | `motion.*`, `useTransform`, `useReducedMotion` | landing |
| `src/hooks/useTilt.ts:6-12` | `useMotionValue`, `useSpring`, `useTransform`, `useReducedMotion`, props `whileHover`/`whileTap` | resorte en forma **stiffness/damping** (`SPRING.snap` 300/30, `useTilt.ts:72`; `SPRING.soft` 120/20 citado en `:70`), no `bounce`/`duration`. Único consumidor: `landing/sections/SeccionFeatures.tsx` |

**En la app autenticada: 0 archivos.** No hay `AnimatePresence`, `layout`, `drag`, `useSpring` ni `animate()` de motion. [V]

Observación para el rediseño [V]: el único precedente de resortes del repo (landing) usa la tripleta física stiffness/damping, no la API `bounce`+`duration` que el skill propone como equivalente de damping/response (§4). No he abierto `components/landing/motion/tokens.ts` más allá de lo que `useTilt.ts` cita; el resto de los parámetros de landing queda fuera de alcance.

---

## 3. Propiedades animadas que NO son transform/opacity

[V] salvo donde se indique.

**Layout (provocan reflow)**
- `width` + `left`: `ui/SelectorSegmentado.tsx:70` — `transition-[left,width]` en la pastilla del control segmentado (120 ms).
- `max-width`: `ui/ModalShell.tsx:248` — `md:transition-[max-width] md:duration-[240ms]` (cambio de geometría del funnel de nota).
- `max-height`: `app/(app)/ayuda/page.tsx:145-146` — acordeón con `transition-all duration-300` y `maxHeight: 0 ↔ 300px` en línea.
- `grid-template-rows`: `globals.css:1054` `.aviso-perfil-colapso` (0fr ↔ 1fr, 180 ms), usado en `sidebar/AvisoPerfilSidebar.tsx:199`.
- `top`/`left`: FullCalendar anima el regreso del espejo del arrastre con `transition: top, left` en línea (documentado en `globals.css:3764-3768` y `AgendaCliente.tsx:2046-2050`, `dragRevertDuration={180}`). Es de la librería. [V el comentario y la prop; I el estilo en línea, no leído en el paquete]
- Sidebar plegada en escritorio: `aside[data-plegada]` cambia `width` 16rem→4rem y `margin-left` de `main` (`globals.css:2182-2189`) **sin transición**: corte seco. [V]

**Pintura (repaint, sin reflow)**
- `box-shadow`: keyframes `avisoHalo` (1027, bucle infinito), `ledPulse` (4849, bucle infinito, triple sombra), `dropGlow` (4888); transiciones `.sp-btn` (`spinus-tokens.css:872-874`), `.sp-input/.sp-textarea` (1063), `.ag-campana-pestana` (`globals.css:6665`).
- `background-position`: `shimmer` (972) — el esqueleto de carga de toda la app, en bucle.
- `color`: `alertGlow` (4880, bucle infinito).
- `stroke-dashoffset`: `sp-draw` (`spinus-tokens.css:2387`).
- `background`/`background-color`/`border-color`: 37 transiciones CSS + 206 `transition-colors` (hover y foco; aceptable según la propia regla de la agenda).

**`transition: all` (anima lo que cambie, incluido layout)**
- CSS: `globals.css:1950` — `.fc .fc-button { transition: all 0.15s ease !important }`.
- TSX: 62 `transition-all` en 27 archivos. Mayores: `ui/QuickPatientModal.tsx` (7), `(app)/expediente/page.tsx` (7), `ui/OnboardingGuide.tsx` (6), `layout/Sidebar.tsx` (5: `:687,708,730,800,805`), `agenda/ModalInvitacionCita.tsx` (5), `(app)/ayuda/page.tsx` (4).
- Con cambio de `box-shadow`/`transform` en hover bajo `transition-all`: `(launcher)/inicio/page.tsx:309,336,357`; `(app)/ayuda/page.tsx:179,207,288`; `expediente/CarrilConsultas.tsx:204`.
- En línea: `documentos/DiagnosticosEditor.tsx:46`, `labs/AutocompleteAnalito.tsx:141`.

---

## 4. Respuesta al toque

### 4.1 Estado de pulsación

[V] Global: `* { touch-action: manipulation; -webkit-tap-highlight-color: transparent }` (`globals.css:957-960`). Elimina el retraso de doble toque (bien, §1 del skill) **y también el único feedback nativo de pulsación del navegador en móvil**, sin sustituirlo.

[V] Reglas `:active` en CSS: **1** — `.sp-btn--primary:active` (`spinus-tokens.css:882`: fondo, `translateY(1px)`, sombra de pulsación). `.sp-btn--secondary`, `--ghost`, `--tertiary`, `--compact` solo tienen `:hover`. Ningún selector `.ag-*`, `.fc-*` ni `.sp-*` distinto tiene `:active`.

[V] Utilidades `active:` en TSX (alcance): **18** en 9 archivos de app (más `useTilt.ts:29`, que es un comentario):
`ui/OnboardingGuide.tsx:565,656,666,677,684`; `documentos/DiagnosticosEditor.tsx:67`; `labs/ModalSubirDocumento.tsx:284`, `TablaMediciones.tsx:94`, `ModalAgregarMedicion.tsx:195`, `GraficaAnalito.tsx:112`; `sidebar/AvisoPerfilSidebar.tsx:230`; `(launcher)/inicio/page.tsx:309,336,357`; `(app)/ayuda/page.tsx:207,288`; `(app)/pacientes/nuevo/page.tsx:493`. Valores: `scale-[0.98]` ×9, `scale-95` ×4, `scale-[0.97]` ×2, `translate-y-px` ×1 — tres escalas distintas para lo mismo.

**Cobertura aproximada** [V los conteos; I la proporción]
- Elementos pulsables: 526 `<button>` en 152 archivos + 91 `<Link>`; 555 `onClick`.
- Con feedback de pulsación: 17 elementos con `active:` + los botones `sp-btn--primary` (59 referencias a la clase, parte de ellas en ramas condicionales).
- **≈ 12 % con feedback, ≈ 88 % sin él.** De 152 archivos con botones, 9 tienen alguna utilidad `active:`.
- Sin ningún `active:` (número de pulsables por archivo): `nueva-nota/page.tsx` 42 (7 son primarios `sp-btn`), `agenda/AppointmentModal.tsx` 20, `documentos/PlantillasDocumento.tsx` 19, `CommandPalette.tsx` 12, `launcher/ConsultaRapidaModal.tsx` 12, `layout/Sidebar.tsx` 10 (toda la navegación principal), `agenda/ModalInvitacionCita.tsx` 10, `admin/usuarios/page.tsx` 10.
- Filas de lista, tarjetas de cita, pestañas (`expediente/PestanasExpediente.tsx:75`), opciones de menú (`.sp-ed-row`, `.ag-opcion`): solo `hover`. [V]

### 4.2 Hover-only

[V] 85 archivos con `hover:` (181 `hover:bg`, 67 `hover:text`, 25 `hover:underline`…). En táctil no hay estado equivalente. Tailwind 4 limita `hover:` a dispositivos con hover [I: default de Tailwind 4; no hay `@custom-variant hover` en `globals.css`], así que en teléfono la mayoría de los controles **no cambia en absoluto al tocarlos**.
[V] Solo dos sitios envuelven hover en `@media (hover: hover)` a mano: `globals.css:3616` (levantamiento de tarjeta de la agenda) y `spinus-tokens.css:1330` (tarjetas de tipo de documento).
[V] Animación disparada solo por hover: `hover:animate-[iconBounce…]` ×3, `hover:scale-[1.03]` ×3 (`(launcher)/inicio/page.tsx`), `hover:translate-x-1` (`dashboard/SecretariaDashboard.tsx:48`), `hover:-translate-y-0.5` (`ayuda/page.tsx:207,288`).

### 4.3 Momento del feedback

[V] No hay ningún manejador que dé feedback visual en `pointerdown`. Los `onPointerDown`/`onMouseDown` existentes son para otra cosa: cerrar al pulsar fuera (`BurbujaAlta.tsx:191`, `TarjetaLectura.tsx:150`, `CapaBarra.tsx:71`, `KebabAccionesPaciente.tsx:52`…), no robar el foco (`documentos/EditorEscrito.tsx:156-235`), elegir opción antes del blur (`AutocompleteMedicamento.tsx:84`, `ComboEscribible.tsx:179`), precargar (`expediente/AccionesDocumento.tsx:121` `onPreparar`).

### 4.4 Debounces, temporizadores y esperas en el camino de entrada

[V] 52 `setTimeout` en 39 archivos en alcance. Los que tocan la entrada del usuario:

| Qué | Espera | Dónde |
|---|---|---|
| Búsqueda de pacientes (red) | 300 ms | `agenda/BurbujaAlta.tsx:212-215`, `agenda/AppointmentModal.tsx:317-327`, `agenda/BuscadorCitas.tsx:65-73`, `agenda/VentanaLigarCita.tsx:143-145`, `(app)/documentos/page.tsx:70`, `(app)/expediente/page.tsx:118-121`, `ui/CIE10Combobox.tsx:75` |
| Búsqueda de la paleta / consulta rápida | 200 ms | `CommandPalette.tsx:162`, `launcher/ConsultaRapidaModal.tsx:135` |
| Foco del input al abrir | 50 ms | `CommandPalette.tsx:107`, `ConsultaRapidaModal.tsx:104` |
| Cierre de la hoja de filtros (espera a la animación) | 300 ms | `expediente/SheetFiltrosExpediente.tsx:71-75` |
| Cierre de capas de agenda (seguro si no llega `animationend`) | micro + 100 = 220 ms | `agenda/BurbujaAlta.tsx:154`, `agenda/TarjetaLectura.tsx:112` |
| Desmontaje del modal de cita tras cerrar | `--ag-dur-base` (180 ms; 0 con reduce) | `(app)/agenda/AgendaCliente.tsx:770-774` |
| Autocierre tras subir documento («breve delay visual») | 900 ms | `labs/ModalSubirDocumento.tsx:254-259` |
| Cierre de la guía de onboarding | 250 ms | `ui/OnboardingGuide.tsx:520-523` |
| Aparición de la guía | 1 500 ms | `ui/OnboardingGuide.tsx:400-415` |
| Escudo contra doble clic tras `QuickPatientModal` (se **tragan** clics a < 24 px durante la gracia) | 600 ms | `hooks/useEscudoTrasRegistro.ts:41-42` |
| Tarjeta de lectura al pasar el ratón (quietud) / margen al salir | 500 ms / 300 ms | `lib/agenda/tarjetaAlPasar.ts:32,34` |
| Atenuación de carga de la rejilla (umbral anti-parpadeo) | 150 ms | `AgendaCliente.tsx:214,469` |
| Guardado de ajustes mientras se escribe | 700 ms | `agenda/configuracion/estadoAvisos.ts:102` |
| Arrastre táctil de una cita: pulsación larga antes de poder mover | 1 000 ms | default de FullCalendar (`node_modules/@fullcalendar/core/internal-common.js`: `longPressDelay: 1000`), no sobreescrito en `src/` |

Búsquedas sin espera (locales): `AutocompleteMedicamento.tsx:30-37`, `labs/AutocompleteAnalito.tsx`. [V]
Las esperas de búsqueda en red son defendibles; las que el skill señalaría como latencia en el camino de entrada son las de **cierre** (el usuario pulsa y la superficie sigue ahí 180-300 ms sin aceptar entrada), el autocierre de 900 ms, el escudo de 600 ms y la pulsación larga de 1 s. [I: valoración]

---

## 5. Superficies que entran y salen

Leyenda: **Interr.** = ¿se puede interrumpir/invertir a mitad? **Arrastre** = ¿arrastrar para cerrar?

| Superficie | Entrada | Salida | ¿Mismo camino? | Interr. | Arrastre | Origen del transform | Scrim |
|---|---|---|---|---|---|---|---|
| **`ui/ModalShell.tsx`** (24 usos / 19 archivos) | panel `animate-modal-enter` (`:248`): opacity + scale .94 + translateY 8px, 220 ms; velo `animate-fade-in` (`:205`), que además sube 8 px | **ninguna**: `if (!open) return null` (`:189`) | No | No (keyframes; al cerrar desaparece) | No | por defecto (centro); no anclado al disparador | `bg-black/40 backdrop-blur-sm`, o `--sp-backdrop` en geometría funnel |
| Móvil `fullscreenMobile` del mismo | la misma animación de escala sobre un panel a pantalla completa (`:248`) | ninguna | No | No | No | centro | idem |
| `ui/QuickPatientModal.tsx:219-221` | `animate-modal-enter` | ninguna | No | No | No | centro | `backdrop-blur-sm` (`:220`) |
| `ui/OfflineAlert.tsx:47-48` | `animate-modal-enter` | ninguna | No | No | No | centro | `bg-black/50 backdrop-blur-sm` |
| Diálogos caseros: `admin/usuarios/page.tsx:221-222,316-317`, `expediente/[id]/page.tsx:233-234` | velo `animate-fade-in` + panel `animate-slide-up` (320 ms, 12 px); en `<sm` va pegado abajo (`items-end`) pero entra igual | ninguna | No | No | No | centro | `bg-black/40 backdrop-blur-sm` |
| **Modal de cita** `agenda/AppointmentModal.tsx:1027-1066` | `.ag-modal-panel`: opacity + translateY 6px, 240 ms ease-out; velo a la vez | con `agendaV2`: `data-estado="saliendo"`, 180 ms ease-in, `inert` mientras sale (`:1029`); sin el interruptor, desmontaje seco (`AgendaCliente.tsx:766-774`) | Sí (mismo eje, 6 px) | No (`inert` + keyframes; reabrir monta otro) | No | centro | `--ag-modal-overlay` + `backdrop-blur-sm` (`:1031`) |
| Otros modales de agenda: `ConfirmModal.tsx:25-47`, `ModalBloqueo.tsx:180-184`, `configuracion/DialogoHorario.tsx:67-70`, `configuracion/ConfirmacionRestablecer.tsx:63-67` | `.ag-modal-panel` + `.ag-modal-velo` | **ninguna** («SIN salida animada (decisión 17)», `ConfirmModal.tsx:26-30`) | No | No | No | centro | sí |
| `agenda/HorarioModal.tsx:87-110`, `agenda/ModalInvitacionCita.tsx:615-624` | `animate-modal-enter` (legacy, dentro de la agenda) | ninguna | No | No | No | centro | `bg-black/40 backdrop-blur-sm` |
| **Capas / popovers de agenda** `.ag-capa` (`BurbujaAlta`, `BurbujaCita`, `TarjetaLectura`, `HerramientasV2`, `CapaBarra`, `VentanaLigarCita`, `ConvertirEnCita`) | opacity + scale .97→1, 180 ms ease-out | inverso hacia el mismo punto, 120 ms ease-in, `pointer-events: none` (`globals.css:5982-5985`), desmontaje en `onAnimationEnd` con seguro de 220 ms | **Sí** | No (sin punteros al salir) | No | **anclado al punto pulsado**: `style.transformOrigin = p.origen` (`BurbujaAlta.tsx:121`, `TarjetaLectura.tsx:74`, `HerramientasV2.tsx:80`; `lib/agenda/posicionCapa.ts:16,49`); `CapaBarra.tsx:35` fijo `top right` | no (no bloqueante), salvo las centradas, que usan `.ag-capa-velo` |
| **Hoja inferior de agenda** `.ag-hoja` (`TarjetaLectura.tsx:247`, teléfono) | opacity + translateY **6 px** («nunca deslizándose al 100 %», `globals.css:5945-5946`) | inverso, 120 ms | Sí | No | **No** (sin asa, sin gesto) | — | `.ag-capa-velo` rgba(16,32,64,.28), **sin salida animada** (solo `ag-velo-entra`) |
| **Hoja inferior de expediente** `expediente/SheetFiltrosExpediente.tsx:143-155` | `slideUpSheet` translateY 100%→0, 300 ms `(0.32,0.72,0,1)`; velo `animate-fade-in` | `slideDownSheet` 0→100%, 300 ms, misma curva (no espejada); velo `fadeOut`; desmonta por `setTimeout(300)` (`:71`) | Sí (eje) | **No**: `if (cerrando) return` (`:68`); reabrir durante el cierre corta en seco (`:79-82`) | **No** | — | `bg-black/40 backdrop-blur-sm` |
| **Menú lateral móvil** `layout/Sidebar.tsx:603-613` | `transition-transform duration-300` (easing default), `-translate-x-full → 0` | la misma transición invertida | **Sí** | **Sí a medias**: es una transición CSS, así que al volver a pulsar parte del valor actual; pero con duración fija y sin heredar velocidad | **No** (ni arrastre desde el borde ni arrastre del panel; solo botón `:558-567` y toque en el velo `:571`) | — | `bg-black/40 backdrop-blur-sm` (`:571`), montado/desmontado **sin fundido** (`{mobileOpen && …}`) mientras el panel tarda 300 ms |
| Menús y desplegables fuera de la agenda: `expediente/KebabAccionesPaciente.tsx`, `expediente/AccionesDocumento.tsx:172`, `.sp-ed-menu` (`spinus-tokens.css:2091`), `ui/CIE10Combobox.tsx`, `documentos/ComboEscribible.tsx:160`, `AutocompleteMedicamento.tsx`, `ui/EspecialidadSelector.tsx` | **ninguna** (sin clase de animación ni transición) | ninguna | — | — | — | sin origen | no |
| `labs/AutocompleteAnalito.tsx:141-148` | `transition: all 200ms` / `opacity 200ms` en línea | idem | Sí | Sí (transición) | — | — | no |
| **Toasts** `ui/Toast.tsx:78-93` | `slideInRight` 250 ms ease-out, desde la derecha 20 px | **ninguna**: se filtra del array (`:26`, `:29`) | No | No | No (ni deslizar para descartar) | — | no |
| Avisos de agenda `.ag-banda-compacta` (`agenda/AvisosAgenda.tsx:69`) | opacity + 6 px, 240 ms | solo opacity, 180 ms (asimétrica a propósito, `globals.css:3864-3867`) | Parcial | No | No | — | no |
| **Transición de página** `layout/PageTransition.tsx:9` | `key={pathname}` → remonta; `pageEnter` opacity + translateY 6px, 240 ms `backwards` | **ninguna** (la página saliente se desmonta) | No | No | No (no hay gesto de «atrás») | — | — |
| **Paleta de comandos** `CommandPalette.tsx:249-259` | panel `animate-slide-up` acelerado a 0.2 s en línea; **velo sin animación** (`:254`) | ninguna (`if (!open) return null`, `:247`) | No | No | No | centro; no anclada | `bg-black/40 backdrop-blur-sm` |
| `launcher/ConsultaRapidaModal.tsx:243-246` | igual que la paleta | ninguna | No | No | No | centro | idem |
| Guía de onboarding `ui/OnboardingGuide.tsx:592-597` | `transition-all duration-300 (0.32,0.72,0,1)`: opacity + translateY 4 + scale .95 | misma transición invertida + `setTimeout(250)` | Sí | Sí (transición) | No | por defecto | no |
| Barra «hay cambios» de perfil `(app)/perfil/page.tsx:1323` | `transition-transform` `--sp-dur-base` `--sp-ease-out`, `translate-y-full → 0`, `motion-reduce:transition-none` | la misma | Sí | Sí (transición) | No | — | no |
| Pasos del funnel de nota `nueva-nota/page.tsx:103-104` | `slideFromRight` / `slideFromLeft` ±60 px, 300 ms (direccional según avance/retroceso) | ninguna (el paso saliente desaparece) | Solo la entrada | No | No | — | — |
| Modo firma `documentos/FirmadoConsentimiento.tsx:313`, plantillas `PlantillasDocumento.tsx:639` | `sp-push-forward` 24 px, 320 ms | ninguna (`sp-push-backward` existe y no se usa) | No | No | No | — | — |
| Pestañas del expediente `expediente/PestanasExpediente.tsx:75` | solo `transition-colors`; el contenido cambia en seco (`animate-tab-enter` existe sin uso) | — | — | — | — | — | — |

Resumen [V]: de ~20 familias de superficie, **tienen salida animada 5** (modal de cita con v2, capas `.ag-capa`, hoja `.ag-hoja`, hoja de filtros, avisos de agenda) más las 4 que son transición CSS reversible (menú lateral, guía, barra de perfil, autocompletado de analito). `ModalShell`, que es la superficie más usada, no tiene salida. **Ninguna es arrastrable. Ninguna usa resortes.** Solo las capas de la agenda anclan el `transform-origin` al disparador.

Restricción estructural que condiciona el rediseño [V]: `.animate-page-enter` envuelve todo `(app)` y un `transform` retenido en ese contenedor crea bloque contenedor para los `position: fixed` descendientes; ya rompió dos veces la agenda (medidas y coordenadas del arrastre de FullCalendar). Está documentado en `globals.css:1105-1173` y por eso la animación usa `backwards` y `will-change: opacity` (`:1184-1187`). Cualquier transición de página basada en `transform` persistente choca con esto.

---

## 6. Gestos existentes

| Gesto | Dónde | Seguimiento | Velocidad | Notas |
|---|---|---|---|---|
| **Deslizar para cambiar de día/semana** (listas del teléfono, solo con `agendaV2`) | `app/(app)/agenda/useDeslizarPeriodo.ts` + `lib/agenda/gestoDeslizar.ts`; cableado en `agenda/InteraccionesV2.tsx:578` | **Continuo** desde `pointermove` (`useDeslizarPeriodo.ts:84-91`), pero **no 1:1**: `resistencia()` multiplica por 0.6 hasta 64 px y por 0.2 después (`gestoDeslizar.ts:67-72`) | Se calcula **solo como umbral** (`UMBRAL_VELOCIDAD = 0.4 px/ms`, velocidad media desde el inicio, `gestoDeslizar.ts:77-78`); **no se entrega** a la animación | Histéresis de 10 px para decidir eje (`DECIDIR_EJE_PX`, `:25`) ✔; `touch-action: pan-y` (`globals.css:6544`) ✔; ignora 20 px de borde ✔. Sin `setPointerCapture` (oyentes en la raíz). Al confirmar, el desplazamiento se pone a 0 **de golpe** (`:97`) y entra un fundido de 120 ms; al cancelar vuelve con WAAPI de 180 ms (`:65-72`). No interrumpible. La decisión usa distancia **o** velocidad media, no el signo de la velocidad al soltar |
| Arrastrar / estirar citas | FullCalendar `@fullcalendar/interaction`; `AgendaCliente.tsx:2044-2051,2092-2104` | 1:1 con espejo, lo hace la librería [I] | No hay momentum; el regreso es `transition: top,left` de 180 ms | En táctil exige pulsación larga de 1 000 ms (default no sobreescrito). El resultado se confirma con `dropGlow` (box-shadow, 0.6 s) + toast. La app solo recibe eventos finales (`eventDrop`, `eventResize`) y `eventDragStart/Stop` |
| Seleccionar tramo en la rejilla | FullCalendar `selectable` + `selectMirror` (`AgendaCliente.tsx:2037-2039`) | de la librería [I] | — | Apagado en Mes móvil |
| Firma manuscrita | `documentos/FirmadoConsentimiento.tsx:671,744-746` (Pointer Events + `setPointerCapture` + `touchAction: 'none'`) | 1:1 (dibujo) ✔ | — | Único uso de `setPointerCapture` de la app |
| Firma manuscrita (perfil) | `perfil/FirmaCaptura.tsx:403-416` | 1:1 | — | Eventos `mouse*` + `touch*` duplicados, sin Pointer Events ni captura |
| Soltar archivos | `labs/ModalSubirDocumento.tsx:320-323`, `labs/SeccionDocumentosLabs.tsx:150-152` | Solo estado «arrastrando sí/no» | — | HTML5 drag-and-drop de escritorio |
| Tarjeta al pasar el ratón | `app/(app)/agenda/useTarjetaAlPasar.ts:82-83` | `pointermove` pasivo para detectar quietud | — | Solo ratón |

**No existen** [V, por búsqueda sin resultados en alcance]: arrastre para cerrar (modal/hoja/menú), deslizar desde el borde para abrir el menú, deslizar para descartar un toast, deslizar una fila para acciones, tirar para refrescar, carruseles, pellizco, proyección de momentum, rubber-banding en límites (lo más cercano es `resistencia()`, que es lineal a tramos y se aplica a todo el recorrido, no al exceso sobre un límite), historial de posición/velocidad. No hay ninguna librería de gestos ni de hojas (sin vaul, embla, cmdk, radix, headless en `package.json`).

---

## 7. Materiales

[V] `backdrop-filter` como propiedad CSS: **0 reglas** en las dos hojas. Todo es utilidad de Tailwind: 24 `backdrop-blur-*` en alcance.

| Uso | Dónde |
|---|---|
| **Velo desenfocado** `bg-black/40 backdrop-blur-sm` (14) | `ModalShell.tsx:205`, `QuickPatientModal.tsx:220`, `OfflineAlert.tsx:47` (`/50`), `agenda/ConfirmModal.tsx:31`, `ModalBloqueo.tsx:181`, `AppointmentModal.tsx:1031`, `HorarioModal.tsx:88`, `ModalInvitacionCita.tsx:616`, `CommandPalette.tsx:254`, `layout/Sidebar.tsx:571`, `launcher/ConsultaRapidaModal.tsx:246`, `expediente/SheetFiltrosExpediente.tsx:147`, `admin/usuarios/page.tsx:221,316`, `expediente/[id]/page.tsx:233` |
| **Panel «cristal»** `bg-[var(--sp-surface-glass)] backdrop-blur-xl` (6) | `ModalShell.tsx:248` (rama legacy; la rama funnel es `bg-white`), `OfflineAlert.tsx:48`, `ui/OnboardingGuide.tsx:598`, `admin/usuarios/page.tsx:222,317`, `expediente/[id]/page.tsx:234` |
| Tarjetas del launcher | `(launcher)/inicio/page.tsx:185,186,311` (`backdrop-blur-md`/`-sm`) |

Hallazgos:
- [V] `--sp-surface-glass` es `rgba(255,255,255,.95)` en claro y `rgba(30,30,30,.95)` en oscuro (`spinus-tokens.css:290,491`). Con 95 % de opacidad el `backdrop-blur-xl` del panel es **prácticamente invisible y se paga igual** [I: el coste y la visibilidad no se midieron].
- [V] **Translúcido apilado sobre translúcido:** en `ModalShell` el panel con blur-xl va encima de un velo con blur-sm; con `elevated` (`z-[60]`, `:191`) un segundo `ModalShell` apila velo+panel sobre velo+panel: hasta 4 capas con `backdrop-filter`. `QuickPatientModal` (`z-[70]`) se abre sobre el modal de cita (`useEscudoTrasRegistro.ts:11-21` lo describe), que ya tiene su velo desenfocado.
- [V] **No hay cromo translúcido.** Barra lateral opaca `--ag-navy` (`Sidebar.tsx:605-607`); cabeceras `sticky` opacas con borde de 1 px (`expediente/VisorNota.tsx:66`, `billing/SuscripcionBanner.tsx:42`); barra de perfil opaca (`perfil/page.tsx:1326`). Ningún contenido se desplaza por debajo de una capa de material; ningún efecto de borde de scroll.
- [V] El desenfoque se usa como **velo** (oscurecer + desenfocar el fondo), no como material de la superficie. La agenda ya fue en dirección contraria: `.ag-capa`/`.ag-hoja` son opacas (`background: var(--ag-surface)`, `globals.css:5970,6008`) y su velo no lleva blur (`:6023-6028`).
- [V] Ninguna superficie «materializa» (animar radio de blur + escala): el blur aparece y desaparece de golpe o con el fundido del velo.
- [V] Sin jerarquía de materiales: dos pesos (`sm` para velos, `xl` para paneles) y dos valores sueltos en el launcher.

---

## 8. Accesibilidad de movimiento

### 8.1 Bloques `prefers-reduced-motion` existentes [V]

| Bloque | Qué cubre |
|---|---|
| `globals.css:1057-1062` | `.animate-aviso-pulse/halo/sheen` y `.aviso-perfil-colapso` |
| `globals.css:1823-1828` | `.ag-barra-carga::after` (a `.01ms`, 1 iteración) |
| `globals.css:3616` (`no-preference`) | el levantamiento de tarjetas de agenda solo existe sin reduce |
| `globals.css:3743-3776` | toda la agenda: `.fc *`, `.agenda-fc *`, `.ag-dia-aside`, pseudos, `.fc-event`, `.ag-modal-panel/-velo`, `.ag-capa`, `.ag-hoja`, `.ag-capa-velo` → `animation-duration` y `transition-duration` a `.01ms !important` |
| `globals.css:7366-7369` | **global:** `[class*="animate-"]:not(.animate-spin) { animation: none !important }` (el resto del bloque, hasta ~7432, es landing) |
| `spinus-tokens.css:2399-2405` | **comentado** («Neutralizado: el repo ya lo cubre») |
| `spinus-tokens.css:2442` | `.sp-section__chev { transition: none }` |

En JS [V]: `prefiereMenosMovimiento()` (`lib/agenda/movimientoAgenda.ts:81-84`) protege las 3 animaciones WAAPI y las salidas de capas (`flipTarjetas.ts:97`, `movimientoAgenda.ts:136`, `useDeslizarPeriodo.ts:67`, `BurbujaAlta.tsx:158`, `TarjetaLectura.tsx:116`). `motion-reduce:` de Tailwind: 6 sitios (`SelectorSegmentado.tsx:70`, `perfil/page.tsx:1323`, `agenda/MenuEngraneAgenda.tsx:166,168` y 3 chevrones/interruptores de `agenda/configuracion/*`). `useReducedMotion` de motion: solo landing y `useTilt`.

### 8.2 Animaciones SIN cubrir [V]

El selector global solo alcanza clases cuyo nombre contiene `animate-`. Quedan fuera:
- **`.skeleton`** (shimmer infinito, 18 archivos): ningún bloque lo nombra.
- **`.launcher-card-0/1/2` y `.launcher-greeting`** (translateY 16 px, hasta 0.95 s con el retraso).
- **`.fc-event-drop-success`** (`dropGlow`, box-shadow): el bloque de agenda (`:3769-3775`) le pone `animation-duration: .01ms !important`, pero la regla propia (`:4894`) declara `animation: dropGlow 0.6s ease-out !important` MÁS ABAJO y con la misma especificidad, así que el atajo posterior gana y la animación sigue corriendo con reduce. [I: razonado por cascada, no ejecutado]
- **Todo `.sp-*` animado**: `.sp-spinner`, `.sp-dots`, `.sp-medal__core` (`sp-pop` con rebote), `sp-draw`, `.sp-push-forward` (24 px). El bloque que los cubría está comentado y el comentario que lo justifica es falso para estas clases.
- **Animaciones en línea**: `ledPulse` infinito (`OnboardingGuide.tsx:566`), `pulse` (`nueva-nota/page.tsx:1378`).
- **Todas las transiciones fuera de la agenda** (el selector global solo apaga `animation`, no `transition`): menú lateral móvil 300 ms de recorrido completo (`Sidebar.tsx:611`), guía de onboarding (`OnboardingGuide.tsx:592`), acordeón de ayuda (`ayuda/page.tsx:145`), `transition-[max-width]` de `ModalShell`, hover con `scale`/`translate` del launcher y de ayuda, las transiciones `transform` de `.sp-btn`.
- **`html { scroll-behavior: smooth }`** (`globals.css:888`) sin condición.
- **`launcher/ParticleCanvas.tsx`** (bucle rAF) y **Recharts** (`GraficaAnalito.tsx:212`): ninguna consulta de `matchMedia` en esos archivos.
- **`animate-spin`** queda excluido a propósito (`globals.css:7363-7365`): defendible.

Calidad de la degradación [V]: donde hay cobertura, es **apagado total** (`animation: none` / `.01ms`), no el «equivalente suave» que pide el skill (§14: sustituir deslizamientos por fundidos cortos). La agenda conserva lo informativo (la atenuación de carga y la pista de la barra, `globals.css:1829-1838`), pero ninguna superficie cambia un deslizamiento por un fundido. Bucles lentos cercanos al umbral que el skill desaconseja (~0.2 Hz): `avisoSheen` 3.6 s y `avisoHalo` 2.8 s (cubiertos por reduce), `ledPulse` 2 s y `alertGlow` 2 s.

### 8.3 Transparencia y contraste [V]

- `prefers-reduced-transparency`: **0 apariciones** en `src/`.
- `prefers-contrast`: **0**. `forced-colors`: **0**.
- `prefers-color-scheme`: solo en `layout.tsx:59-60` (theme-color) y comentarios; el tema lo gobierna `ThemeProvider` con clase `html.dark`. No he verificado si el cambio claro↔oscuro lleva transición [no auditado].

---

## 9. Brechas frente a apple-design, priorizadas

Sin propuesta de solución. Cada brecha indica el principio del skill y dónde está la evidencia.

### P0 — fundamento (afectan a toda la app)

1. **Sin feedback en la pulsación en ~88 % de los controles.** §1 Response («respond on pointer-down»), §10 Tap. Una regla `:active` en todo el CSS (`spinus-tokens.css:882`), 18 utilidades `active:`; la navegación principal (`Sidebar.tsx`), el modal de cita, la paleta y todos los `.ag-*` no tienen ninguna. Agravado por `-webkit-tap-highlight-color: transparent` global (`globals.css:959`) y por `hover:` como único estado en 85 archivos.
2. **Cero resortes; `motion` instalada y sin usar en la app.** §4 Behavior over animation. Todo es `@keyframes`/`transition`/WAAPI con duración fija (§1.2, §2). El único rebote es un cubic-bezier con sobreimpulso (`--sp-ease-spring`) y un keyframe scripteado (`sp-pop`).
3. **Nada es interrumpible ni reversible a mitad.** §3 Interruptibility («never lock out input during a transition»). Las salidas bloquean la entrada a propósito: `inert` (`AppointmentModal.tsx:1029`), `pointer-events: none` (`globals.css:5984,6019`), `if (cerrando) return` (`SheetFiltrosExpediente.tsx:68`). Las entradas son keyframes, que el skill desaconseja para lo que el usuario puede tocar.
4. **Ninguna superficie responde al arrastre.** §2 Direct manipulation, §5 Velocity handoff, §6 Momentum projection, §9 Rubber-banding. Ni hojas (`.ag-hoja`, `SheetFiltrosExpediente`), ni menú lateral, ni modales a pantalla completa en móvil, ni toasts. Es una PWA de uso en teléfono.
5. **`ModalShell` (24 usos) y casi todos los diálogos entran animados y salen en seco.** §7 Spatial consistency («enter and exit along the same path»). `ModalShell.tsx:189`; también `QuickPatientModal`, `OfflineAlert`, `ConfirmModal`, `ModalBloqueo`, `HorarioModal`, `ModalInvitacionCita`, `CommandPalette`, `ConsultaRapidaModal`, los 3 diálogos caseros, `Toast.tsx:26`.

### P1 — coherencia espacial y de sistema

6. **Tres escalas de movimiento + el default de Tailwind, sin fuente única.** §16.7 Craft («nothing is random — every timing value is a deliberate choice you can defend»), §16.4 Familiarity (lo que se parece debe comportarse igual). 15 duraciones y 6 curvas distintas (§1.3); `IOS_EASING` redeclarada en 5 archivos; ≈270 transiciones con duración implícita; `--sp-dur-enter` («entrada del modal») existe y el modal no lo usa; un mismo tipo de superficie (modal) entra de tres maneras según el módulo (`modalEnter` scale .94 / `ag-modal-entra` 6 px / `slideUp` 12 px), incluso dentro de la agenda (`HorarioModal` y `ModalInvitacionCita` usan la legacy).
7. **Superficies sin anclar a su origen.** §7 («anchor interactions to their source»). Solo `.ag-capa` fija `transform-origin` al disparador (`posicionCapa.ts`). `ModalShell`, la paleta, los menús kebab y los desplegables escalan desde el centro o aparecen sin relación espacial con lo que los abrió.
8. **Menús, desplegables y pestañas sin ninguna transición.** §1 (feedback continuo), §7, §8 Hint. `KebabAccionesPaciente`, `AccionesDocumento`, `.sp-ed-menu`, comboboxes, `PestanasExpediente`; plegado de la barra lateral en escritorio con cambio seco de `width` y `margin-left` (`globals.css:2182-2188`).
9. **Transición de página solo de entrada, y atada a una restricción frágil.** §7, §3. `PageTransition.tsx:9` remonta por `key`; no hay salida ni dirección (adelante/atrás se ven igual). El contenedor no admite `transform` retenido (`globals.css:1105-1173`).
10. **El único gesto continuo no hace entrega de velocidad ni es 1:1.** §2, §5, §6, y «decide reverse vs. commit con el signo de la velocidad». `useDeslizarPeriodo.ts:89-98`, `gestoDeslizar.ts:67-80`: atenuación 0.6/0.2 sobre todo el recorrido, corte a 0 al confirmar, velocidad media usada solo como umbral.
11. **Hoja del teléfono que no se comporta como hoja.** §2, §7, §12. `.ag-hoja` entra con 6 px y fundido por decisión explícita (`globals.css:5945-5946`), sin asa ni arrastre; su velo no tiene salida. `SheetFiltrosExpediente` sí desliza al 100 % pero con keyframes y bloqueo: dos hojas inferiores, dos comportamientos.
12. **Latencias evitables en el camino de entrada.** §1 («be vigilant about every latency»). Autocierre de 900 ms (`ModalSubirDocumento.tsx:254`), escudo de 600 ms que traga clics (`useEscudoTrasRegistro.ts:41`), superficies que siguen montadas y sordas 180-300 ms al cerrar, pulsación larga de 1 000 ms para mover una cita en táctil (default de FullCalendar), foco diferido 50 ms en la paleta.

### P2 — rendimiento de fotograma y materiales

13. **Propiedades de layout y pintura animadas.** §11 Frame-level smoothness («animate only transform and opacity»). `left`+`width` (`SelectorSegmentado.tsx:70`), `max-width` (`ModalShell.tsx:248`), `max-height` (`ayuda/page.tsx:145`), `grid-template-rows` (`globals.css:1054`), `box-shadow` en bucle (`avisoHalo`, `ledPulse`), `background-position` en bucle en todos los esqueletos (`shimmer`), 62 `transition-all` + `.fc .fc-button { transition: all }`.
14. **Translucidez usada como velo, no como material; y apilada.** §12 Materials («never stack a light translucent surface on another», «build nav/toolbars/sheets as translucent layers», «materialize, don't just fade», «scroll edge effects, not hard dividers»). Panel `blur-xl` al 95 % de opacidad sobre velo `blur-sm`, hasta 4 capas con modales apilados (`ModalShell.tsx:191,205,248`); ningún cromo translúcido; cabeceras sticky con borde de 1 px; criterio distinto entre agenda (opaco, velo sin blur) y resto.
15. **Velos que no acompañan a su superficie.** §12 («dim to focus»), §7. Velo del menú lateral montado/desmontado sin fundido mientras el panel tarda 300 ms (`Sidebar.tsx:570-572`); velo de la paleta sin animación (`CommandPalette.tsx:254`); `fadeIn` de los velos traslada 8 px además de fundir (`globals.css:997-1000`); `.ag-capa-velo` sin salida.
16. **Sin empuje de la capa inferior ni jerarquía entre capas apiladas.** §12 («push the background back/down», «for stacked sheets, progressively dim and push back each parent layer»). Los modales `elevated` solo suben el `z-index`.

### P3 — accesibilidad de movimiento

17. **`prefers-reduced-motion` incompleto y por nombre de clase.** §14. Sin cubrir: `.skeleton`, launcher, todo `.sp-*` animado (bloque comentado en `spinus-tokens.css:2399-2405`), animaciones en línea, todas las transiciones fuera de la agenda (incluido el recorrido completo del menú lateral), `scroll-behavior: smooth`, partículas, Recharts (§8.2).
18. **Reduce = apagar, no sustituir.** §14 («reduced motion doesn't mean no feedback — a gentler equivalent»). Donde hay cobertura se anula; ningún deslizamiento degrada a fundido.
19. **`prefers-reduced-transparency` y `prefers-contrast` ausentes.** §14. Cero apariciones, con 24 superficies con `backdrop-blur`.
20. **Bucles decorativos infinitos.** §14 (evitar oscilaciones lentas en bucle), §13.3 Utility. `avisoHalo` 2.8 s, `avisoSheen` 3.6 s, `avisoPulse`, `ledPulse` 2 s, `alertGlow` 2 s, `animate-bounce` de la guía.

### P4 — limpieza (no es brecha de principio, pero estorba al rediseño)

21. **Código de animación muerto** [V]: keyframes `docTitleIn`; clases `.animate-fade-in-up`, `.animate-tab-enter`, `.animate-slide-up-modal`, `.sp-push-backward`; tokens `--sp-dur-fast`, `--sp-dur-enter`, `--sp-ease-in`. `fadeInUp` y `fadeIn` son el mismo keyframe con dos nombres.
22. **Lógica de diálogo triplicada** [V]: foco/escape/trapo en `ModalShell.tsx`, `hooks/useDialogoModal.ts` y `agenda/ModalInvitacionCita.tsx` (lo declara `ModalShell.tsx:12-18`); cualquier cambio de comportamiento de entrada/salida habrá que hacerlo en cada familia.

---

## 10. Lo que ya está bien y conviene no perder

[V]
- La agenda tiene escala de tokens, tope de 240 ms, regla «solo opacity/transform» con prueba e2e, lectura de tokens desde JS, y guardas de reduce en WAAPI.
- `.ag-capa` entra y sale por el mismo camino y desde el punto pulsado: es el único componente que ya cumple §7.
- `touch-action: manipulation` global (sin retraso de 300 ms); `pan-y` en el deslizamiento; histéresis de 10 px antes de decidir eje (§10).
- Hover acotado a `@media (hover: hover)` en las tarjetas de agenda y de tipo de documento.
- FLIP para citas movidas por otro usuario (continuidad espacial sin que el usuario lo provoque).
- Áreas seguras (`env(safe-area-inset-*)`) ya resueltas en menú, toasts, modales a pantalla completa y hojas.

## 11. Límites de esta auditoría

- No se ejecutó la app: fluidez, caídas de fotogramas, coste real del blur y comportamiento exacto de FullCalendar en táctil son [I].
- Los conteos de «pulsables» son por coincidencia de texto (`<button`, `<Link`), no por árbol renderizado; componentes que envuelven botones cuentan una vez.
- No se auditó `components/landing/motion/tokens.ts` ni el resto de landing (fuera de alcance), ni `(offline)`.
- No se verificó si el cambio de tema claro/oscuro tiene transición.
