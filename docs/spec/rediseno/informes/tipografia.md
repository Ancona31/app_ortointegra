# Auditoría de tipografía global — Spinus (rama `feature/agenda-v2`)

Fecha: 2026-11-19 · Solo lectura · Describe el estado actual; no propone rediseño.

Rutas relativas a `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/app`.

## 0. Método y alcance

**Dentro del conteo (474 archivos `.ts/.tsx`, 245 `.tsx`):** `src/app/(app)` salvo `calculadoras-clinicas` y `dicom`; `src/app/(launcher)`; `src/app/(offline)`; `src/components` salvo las carpetas excluidas; más las dos hojas `src/app/globals.css` (7740 líneas) y `src/app/spinus-tokens.css` (2813 líneas).

**Excluido (existe, no se contó):** `src/app/(app)/calculadoras-clinicas`, `src/app/(app)/dicom`, `src/lib/dicom`, `src/app/super-admin`, `src/app/(landing)`, `login`, `register`, `pricing`, `privacidad`, `privacy`, `terms`, `reservar`, `confirmar`, `r`, `demo`, `forgot-password`, `reset-password`, `invitacion`, `auth`, `api` (plantillas de correo), `src/lib/pdf`, y los componentes que solo sirven a esas rutas: `components/landing`, `agendaPublica`, `calculadoras`, `dicom`, `super-admin`, `taller-v2` (lo monta solo `super-admin/dashboard/taller-v2`), `legal`.

**Cómo se contó:** expresiones regulares sobre el texto de los archivos (clases Tailwind, `style={{…}}`, declaraciones CSS con los comentarios eliminados). Limitaciones:

- Un conteo es de **apariciones en el código**, no de elementos pintados. Una clase dentro de una constante compartida (p. ej. `TITULO_PASO`) cuenta 1 aunque se use en 6 sitios; una regla CSS cuenta 1 aunque vista cientos de nodos.
- Las clases construidas dinámicamente (plantillas con ternarios) se cuentan si el literal aparece, sin saber qué rama gana.
- El análisis por etiqueta de §7 (`<button>`, `<label>`…) falla con `className` multilínea o con `=>` dentro de la etiqueta; por eso los botones salen con 234 «sin className» que **no es un dato fiable**. Los títulos `<h1>` se revisaron uno a uno y sí son fiables.

Cada afirmación va marcada **[V]** verificado (archivo:línea o conteo) o **[I]** inferido.

---

## 1. Familias tipográficas

### 1.1 Qué se carga

| Familia | Mecanismo | Pesos | Dónde aplica | Evidencia |
|---|---|---|---|---|
| **Fuente de sistema** (`system-ui, -apple-system, sans-serif`) | CSS, sin descarga | los del sistema | **toda la app autenticada** | `src/app/globals.css:892-895` (`body`) [V] |
| **Inter** (variable, ejes `wght` + `opsz`, subsets `latin` y `latin-ext`, `display: swap`) | `next/font/google`, variable `--lp-font` | variable 100–900 | **solo landing y `/login`** (fuera de alcance) | `src/lib/fonts.ts:38-43`; consumidores `src/app/(landing)/layout.tsx:4` y `src/app/login/layout.tsx:4,137` [V] |
| Roboto, Archivo, IBM Plex Sans (`.ttf`) | archivos en `public/fonts/` | Regular/Medium/SemiBold/Bold/Italic | **solo PDF** (`src/lib/pdf/v2/fonts.ts`), no UI | `public/fonts/` (11 archivos) [V] |

- No hay ningún `@font-face` ni `<link>` a Google Fonts en la UI. La única coincidencia de `@font-face|fonts.googleapis` fuera de PDF es `src/app/api/email/enviar-documento/route.ts` (correo) y `src/app/login/layout.tsx` (comentario/Inter). [V]
- `src/app/layout.tsx` **no importa ninguna fuente**; el `<body>` solo lleva `min-h-full antialiased` (`layout.tsx:104`). El propio `src/lib/fonts.ts:14-17` documenta que Inter no se monta en el layout raíz a propósito. [V]
- No existe `tailwind.config.*`; Tailwind 4 se configura en CSS. El único `@theme` es `@theme inline { --font-lp: var(--lp-font), system-ui, -apple-system, sans-serif; }` (`globals.css:20-22`), que genera la utilidad `font-lp`. No se redefinen `--font-sans`, `--font-mono` ni la escala `--text-*` de Tailwind: valen los valores por defecto. [V]
- `@plugin "@tailwindcss/typography"` está cargado (`globals.css:3`); en alcance `prose` se usa en `src/app/(app)/expediente/[id]/nueva-nota/page.tsx:1255` (`prose prose-sm`). [V]

### 1.2 Pila efectiva

- **Body:** `system-ui, -apple-system, sans-serif` (`globals.css:895`), con `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility` (`globals.css:896-898`). [V]
- **Encabezados:** no hay ninguna regla `h1…h6` en las dos hojas; heredan la pila del body y el preflight de Tailwind les quita tamaño y peso propios. Todo encabezado se viste con clases en el sitio de uso. [V para la ausencia de reglas; I para el efecto del preflight]
- **FullCalendar:** repite la misma pila en `.fc` (`globals.css:1234`) con `font-size: 13px` base (`:1235`). [V]
- **Token `--sp-font`** (`spinus-tokens.css:384`) declara la misma pila, pero **no lo consume ninguna regla viva**: su único `var(--sp-font)` en esa hoja está dentro de un bloque comentado (`spinus-tokens.css:836-846`); el otro uso está en `components/agendaPublica/agendaPublica.css:77` (fuera de alcance). [V]
- En macOS/iOS esa pila resuelve a San Francisco; en Android a Roboto; en Windows a Segoe UI. La app no se ve con la misma letra en todas las plataformas. [I]

### 1.3 ¿Más de una familia en la app autenticada?

Sí, pero de forma puntual: una sola familia de texto (sistema) más dos excepciones.

- **Monoespaciada** — 14 apariciones de `font-mono` en alcance + 1 regla CSS [V]:
  - `src/components/CommandPalette.tsx:298,399,404-406` (folio y `<kbd>`)
  - `src/components/launcher/ConsultaRapidaModal.tsx:363-365` (`<kbd>`)
  - `src/components/dashboard/BuscadorPaciente.tsx:40` (`<kbd>`)
  - `src/components/agenda/configuracion/estilosConfig.ts:82` y `CrearEnlaceUnaVez.tsx:49` (URL de enlace, 15px)
  - `src/app/(app)/perfil/page.tsx:1222`
  - `src/app/(app)/expediente/[id]/nueva-nota/page.tsx:1253` (textarea de edición de la nota; el comentario de `:1248` dice «font-mono es deliberado»)
  - `globals.css:6486` — `.ag-atajos kbd { font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace }` (pila mono propia, distinta de la de Tailwind)
- **Serif** — 1 caso: `src/components/documentos/TipTapViewer.tsx:35` fuerza `fontFamily: 'Georgia, serif'` en línea; lo consume `src/components/expediente/CuerpoDocumento.tsx`. [V]
- No hay familia «display» separada de la de texto. [V]

---

## 2. Escala real de tamaños

### 2.1 Cuatro sistemas conviviendo

| Sistema | Apariciones | Unidad | Dónde vive |
|---|---|---|---|
| Clases Tailwind con nombre (`text-xs`…`text-5xl`) | 579 | rem | repartido; agenda 112, expediente (páginas) 72, offline 59, onboarding 44 |
| Tailwind arbitrario en px (`text-[13px]`) | 453 | px | **agenda 203**, labs 72, expediente (comp.) 31, ui 27 |
| Tokens `--sp-fs-*` desde TSX (`text-[length:var(--sp-fs-…)]`) | 248 | px | expediente (comp.) 130, dashboard 39+9, labs 31, perfil 29+6 |
| Clases de rol `.sp-title-* / .sp-label* / .sp-hint / .sp-body` | 231 | px (vía token) | **documentos 157**, expediente (páginas) 40, perfil 29 |
| `font-size` en `globals.css` | 123 declaraciones | px | 100 % agenda (`.ag-*`, `.agenda-fc`, `.fc`) |
| `font-size` en `spinus-tokens.css` | 72 declaraciones | px (57 por token, 15 literal) | clases `.sp-*` |
| `fontSize` en línea (`style`) | 33 | px / número | estadísticas 14 (gráficas), documentos 6 |

[V] todos los conteos.

Adopción por área (apariciones: nombre / px / token `--sp-fs` / clase `.sp-`) [V]:

| Área | nombre | px | token | clase sp |
|---|---|---|---|---|
| `components/agenda` | 112 | 203 | 0 | 0 |
| `components/expediente` | 22 | 31 | 130 | 0 |
| `app/(app)/expediente` | 72 | 22 | 3 | 40 |
| `components/documentos` | 2 | 0 | 0 | 157 |
| `components/labs` | 5 | 72 | 31 | 0 |
| `components/dashboard` | 0 | 4 | 39 | 0 |
| `components/perfil` | 10 | 5 | 29 | 17 |
| `app/(offline)` | 59 | 4 | 0 | 0 |
| `components/onboarding` | 44 | 3 | 0 | 0 |
| `components/ui` | 26 | 27 | 1 | 1 |
| `components/` raíz | 37 | 7 | 0 | 0 |
| `app/(app)/billing` | 26 | 2 | 0 | 0 |
| `app/(app)/pacientes` | 22 | 9 | 0 | 0 |
| `components/consultorios` | 21 | 1 | 0 | 0 |
| `app/(app)/admin` | 20 | 13 | 0 | 0 |
| `components/launcher` | 19 | 14 | 0 | 0 |
| `app/(app)/ayuda` | 15 | 5 | 0 | 0 |
| `app/(launcher)` | 14 | 2 | 0 | 0 |
| `app/(app)/documentos` | 11 | 6 | 0 | 0 |
| `app/(app)/dashboard` | 10 | 2 | 9 | 2 |
| `app/(app)/perfil` | 6 | 0 | 6 | 12 |
| resto (sidebar, layout, avisos, billing comp., estadísticas, suplementación) | 26 | 21 | 0 | 2 |

Lectura: la agenda no usa ni un token ni una clase `sp`; documentos usa casi solo clases `sp`; expediente/dashboard/perfil/labs usan tokens `sp` desde Tailwind; el resto (offline, onboarding, billing, pacientes, admin, ayuda, launcher, consultorios, modales de `ui`) sigue en Tailwind con nombre. [V]

### 2.2 Tabla tamaño → usos (todas las fuentes sumadas, resueltas a px)

Equivalencias usadas: `xs`=12, `sm`=14, `base`=16, `lg`=18, `xl`=20, `2xl`=24, `4xl`=36, `5xl`=48 (valores por defecto de Tailwind, con raíz de 16px); tokens `--sp-fs-*` según `spinus-tokens.css:387-421`.

| px | TW nombre (rem) | TW px | token sp (TSX) | en línea | globals.css | tokens.css | **Total** | Dónde se concentra |
|---|---|---|---|---|---|---|---|---|
| 9 | 0 | 2 | 0 | 0 | 4 | 0 | **6** | agenda: chips y sellos de tarjeta |
| 9.5 | 0 | 0 | 0 | 0 | 1 | 0 | **1** | agenda `.ag-tarjeta-tz` |
| 10 | 0 | 45 | 0 | 2 | 2 | 0 | **49** | labs, expediente, perfil, admin |
| 10.5 | 0 | 11 | 3 | 0 | 11 | 2 | **27** | agenda (CSS), expediente |
| 11 | 0 | 144 | 61 | 8 | 12 | 3 | **228** | agenda 40, expediente 36 (token), ui 21, labs 18 |
| 11.5 | 0 | 10 | 0 | 1 | 3 | 2 | **16** | labs, expediente |
| 12 | 163 | 53 | 3 | 9 | 14 | 6 | **248** | onboarding, expediente, agenda |
| 12.5 | 0 | 18 | 51 | 2 | 9 | 5 | **85** | expediente, labs (`--sp-fs-hint`) |
| 13 | 0 | 56 | 4 | 2 | 25 | 5 | **92** | agenda (CSS 23), labs 24 |
| 13.5 | 0 | 24 | 37 | 0 | 6 | 4 | **71** | agenda 22, expediente 23 |
| 14 | 373 | 43 | 36 | 4 | 15 | 14 | **485** | en todas partes; agenda 99+40 |
| 14.5 | 0 | 0 | 15 | 0 | 1 | 12 | **28** | cuerpo `.sp-*` (documentos, nota) |
| 15 | 0 | 22 | 13 | 4 | 10 | 4 | **53** | agenda |
| 15.5 | 0 | 3 | 1 | 0 | 3 | 1 | **8** | agenda, expediente |
| 16 | 13 | 9 | 3 | 0 | 3 | 1 | **29** | agenda, ayuda, admin |
| 17 | 0 | 2 | 0 | 1 | 1 | 2 | **6** | — |
| 18 | 17 | 3 | 13 | 0 | 2 | 2 | **37** | títulos de card/modal |
| 19 | 0 | 0 | 2 | 0 | 0 | 2 | **4** | título de modal `sp` |
| 20 | 5 | 1 | 0 | 0 | 0 | 4 | **10** | — |
| 22 | 0 | 5 | 0 | 0 | 0 | 0 | **5** | H1 de 5 páginas |
| 24 | 6 | 0 | 0 | 0 | 1 | 1 | **8** | — |
| 25 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | nombre del paciente |
| 26 | 0 | 0 | 3 | 0 | 0 | 0 | **3** | — |
| 27 | 0 | 0 | 0 | 0 | 0 | 1 | **1** | `.sp-title-state` |
| 30 | 0 | 0 | 2 | 0 | 0 | 1 | **3** | H1 dashboard/perfil/nueva nota |
| 32 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | labs |
| 36 / 48 | 2 | 0 | 0 | 0 | 0 | 0 | **2** | H1 de `/inicio` (`text-4xl sm:text-5xl`) |
| 38 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | dashboard |
| **Total** | **579** | **453** | **248** | **33** | **123** | **72** | **1508** | |

[V] Resultado: **29 tamaños distintos**, 13 de ellos entre 9 y 15.5 px en pasos de medio píxel (9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5).

### 2.3 Tamaños menores de 12 px

**327 apariciones** (21,7 % de 1508) en 6 tamaños: 9, 9.5, 10, 10.5, 11 y 11.5 px. [V]

| Origen | Apariciones < 12px |
|---|---|
| Tailwind arbitrario (`text-[11px]` 144, `text-[10px]` 45, `text-[10.5px]` 11, `text-[11.5px]` 10, `text-[9px]` 2) | 212 |
| Tokens `--sp-fs-legal` (11px, 61) y `--sp-fs-tile` (10.5px, 3) desde TSX | 64 |
| `globals.css` (agenda) | 33 |
| `fontSize` en línea (gráficas de estadísticas y labs) | 11 |
| `spinus-tokens.css` | 7 |

Los más pequeños, todos en la agenda [V]:
- 9px: `.ag-tarjeta-chip` (`globals.css:4036`), `.ag-tarjeta-marca` (`:4087`), `.ag-gcal-badge` (`:4366`), `.ag-mes-badge` (`:4798`); más 2 `text-[9px]` en `components/layout` y `components/expediente`.
- 9.5px: `.ag-tarjeta-tz` (`:4098`).
- 10px: eje horario `.fc-timegrid-axis-cushion` (`:4669`), «+N más» del mes móvil (`:5365`).
- 10.5px: hora de la tarjeta de cita `.ag-tarjeta-hora` (`:4005`) y otras 10 reglas.

La propia escala de tokens incluye dos escalones bajo 12: `--sp-fs-legal: 11px` y `--sp-fs-tile: 10.5px` (`spinus-tokens.css:407-408`). El token de 11px es **el más usado de toda la escala `sp` desde TSX** (61 usos). [V]

---

## 3. Pesos

| Peso | Clases Tailwind (TSX) | `globals.css` | `spinus-tokens.css` (vía token) | En línea |
|---|---|---|---|---|
| 400 (`font-normal`) | 21 | 2 | 4 | — |
| 500 (`font-medium`) | 176 | 11 | 0 | — |
| 600 (`font-semibold`) | 338 | 38 | 13 | 2 |
| 700 (`font-bold`) | 215 | 45 | 14 | 4 |
| 800 (`font-extrabold`) | 32 | 3 | 9 | 1 |
| 900 (`font-black`) | 0 | 1 | 0 | — |
| **Total** | **782** | **100** | **40** | **7** |

[V]

- Cinco pesos en uso real (400–800) más un único 900 en la agenda. No hay `font-light` ni más ligeros.
- Los pesos por encima de regular (500–900) suman 761 de 782 clases: el texto con peso explícito es casi siempre enfatizado; 600 es el más frecuente.
- Tokens: `--sp-fw-black` vale **800**, no 900 (`spinus-tokens.css:440`) — el nombre no coincide con la convención de Tailwind, donde `black` es 900 y 800 es `extrabold`. `--sp-fw-medium` (500) está declarado y **no se usa ninguna vez**. [V]
- La agenda escribe los pesos como número crudo en CSS (100 declaraciones, 0 con token). [V]
- `font-extrabold` se concentra en expediente (17) y dashboard (6+4). [V]

---

## 4. Tracking y leading

### 4.1 Letter-spacing

| Valor | Apariciones | Dónde |
|---|---|---|
| `tracking-wide` (0.025em) | 53 | labs 14, ui 7, expediente 6+6, pacientes 5 |
| `tracking-[var(--sp-ls-label)]` (0.04em) | 31 | expediente 23, labs 7 |
| `tracking-[.06em]` | 22 | agenda (todas) |
| `tracking-wider` (0.05em) | ≥17 | `ui/QuickPatientModal` (etiquetas) |
| `tracking-tight` (−0.025em) | 9 | H1 de páginas |
| `tracking-[var(--sp-ls-label-w)]` (0.05em) | 4 | perfil |
| `tracking-normal` | 4 | expediente |
| `tracking-[0.3px]` | 2 | perfil (única vez en px) |
| `tracking-[0.04em]`, `[0.06em]`, `[0.12em]`, `[-0.04em]`, `[.02em]` | 2,1,1,1,1 | dashboard, sidebar |
| CSS `globals.css`: `.02em` ×4, `.06em`/`0.06em` ×3, `.04em` ×1 | 8 | agenda |
| CSS `spinus-tokens.css`: por token ×8, literal `.04em` y `.03em` | 10 | clases `.sp-*` |

[V] (el dato de `tracking-wider` sale del análisis de etiquetas `<label>`; el conteo global de `tracking-*` con nombre es 133 en total).

- El tracking **no varía de forma continua con el tamaño**. Hay dos usos: positivo fijo para rótulos en mayúsculas (0.025–0.12em, seis valores distintos para el mismo rol) y negativo para títulos grandes (`tracking-tight` o `--sp-ls-tight: -0.02em`). El texto de cuerpo (12–16px) no lleva tracking en ningún sitio. [V]
- La escala `sp` sí documenta una relación tamaño→tracking en comentarios (`spinus-tokens.css:430-434`: −0.02em para ≥26px; 0.04em para mayúsculas de 12–13px; 0.05em para ≤11px; 0.06em caps; 0.08em eyebrow), pero es de cinco escalones por rol, no una curva. `--sp-ls-eyebrow` no se usa ninguna vez. [V]
- Para el mismo tratamiento (rótulo en mayúsculas de ~11px) la agenda usa `.06em`, los modales de `ui` `tracking-wider` (0.05em), expediente `--sp-ls-label` (0.04em) y labs/pacientes `tracking-wide` (0.025em). [V]

### 4.2 Line-height

| Valor | Apariciones | Dónde |
|---|---|---|
| `leading-relaxed` (1.625) | 43 | agenda 18, expediente 5, offline 4 |
| `leading-tight` (1.25) | 20 | expediente 7, launcher 3 |
| `leading-snug` (1.375) | 15 | expediente 9 |
| `leading-[1.5]` | 7 | agenda |
| `leading-[var(--sp-lh-note)]` (1.62) | 6 | expediente |
| `leading-[var(--sp-lh-snug)]` (1.45) | 4 | expediente |
| `leading-none` | 4 | — |
| `leading-[var(--sp-lh-body)]` (1.55) | 3 | — |
| `leading-[24px]` | 3 | dashboard (única vez en px) |
| `leading-[1.3]`, `leading-[1.45]` | 2, 1 | agenda, dashboard |
| CSS `globals.css`: 1.2 ×11, 1.3 ×5, 1.35 ×5, 1.4 ×4, 1 ×3, 1.25 ×3, 1.5 ×3, 1.45, 1.1, `16px` | 37 | agenda |
| CSS `spinus-tokens.css`: por token ×17, literal 1.6, 1.25, 1.7 | 20 | clases `.sp-*` |

[V]

- Solo **108 clases `leading-*`** frente a 1280 clases de tamaño en TSX: la gran mayoría del texto toma el interlineado que trae la propia utilidad de tamaño de Tailwind (`text-sm` → 1.4286, `text-xs` → 1.3333) o, con `text-[Npx]`, **el interlineado heredado** (el `normal` del body, ya que `body` no declara `line-height`). [V para los conteos y para la ausencia de `line-height` en `body`, `globals.css:892-899`; I para el valor efectivo]
- Consecuencia: dos textos de 14px pueden tener interlineado distinto según se escriban `text-sm` (1.43) o `text-[14px]` (heredado). La agenda usa las dos formas (99 `text-sm` y 40 `text-[14px]`). [V conteos; I efecto]
- Casi todos los valores son relativos (sin unidad); en px solo `leading-[24px]` ×3 y `line-height: 16px` ×1. [V]
- La escala `sp` sí liga interlineado y tamaño por rol (`spinus-tokens.css:423-428`: 1.2 títulos ≥26px, 1.3 títulos 16–20px, 1.45 campos, 1.55 cuerpo denso, 1.62 nota médica, 1.4 legal). `--sp-lh-tight`, `--sp-lh-title` y `--sp-lh-legal` solo se usan dentro de las clases `.sp-*`, nunca desde TSX. [V]

---

## 5. Tokens tipográficos existentes

### 5.1 Tailwind `@theme`

Uno solo: `--font-lp` (`globals.css:20-22`), para la landing. Sin escala de texto propia. [V]

### 5.2 Escala `--sp-*` (`src/app/spinus-tokens.css:381-440`)

Usos = `var(--token)` en `spinus-tokens.css` / en TSX dentro de alcance. Ninguno se usa en `globals.css` ni fuera de alcance. [V]

**Familia**

| Token | Valor | CSS | TSX |
|---|---|---|---|
| `--sp-font` | `system-ui, -apple-system, sans-serif` | 0 vivos (1 en bloque comentado) | 0 |

**Tamaños (24 tokens, 18 valores distintos)**

| Token | Valor | CSS | TSX | Total |
|---|---|---|---|---|
| `--sp-fs-h1` | 34px | 0 | 0 | **0** |
| `--sp-fs-page` | 30px | 1 | 2 | 3 |
| `--sp-fs-success` | 27px | 1 | 0 | 1 |
| `--sp-fs-confirm` | 26px | 0 | 3 | 3 |
| `--sp-fs-patient` | 25px | 0 | 1 | 1 |
| `--sp-fs-card` | 20px | 3 | 0 | 3 |
| `--sp-fs-modal` | 19px | 1 | 2 | 3 |
| `--sp-fs-vitals` | 18px | 1 | 13 | 14 |
| `--sp-fs-btn` | 17px | 1 | 0 | 1 |
| `--sp-fs-question` | 16px | 0 | 1 | 1 |
| `--sp-fs-body-lg` | 16px | 0 | 2 | 2 |
| `--sp-fs-btn-md` | 15.5px | 1 | 1 | 2 |
| `--sp-fs-btn-sm` | 15px | 2 | 14 | 16 |
| `--sp-fs-display-sm` | 15px | 0 | 3 | 3 |
| `--sp-fs-body` | 14.5px | 12 | 15 | 27 |
| `--sp-fs-body-sm` | 14px | 13 | 40 | 53 |
| `--sp-fs-chip` | 14px | 1 | 0 | 1 |
| `--sp-fs-meta` | 13.5px | 4 | 37 | 41 |
| `--sp-fs-label` | 13px | 3 | 4 | 7 |
| `--sp-fs-hint` | 12.5px | 3 | 52 | 55 |
| `--sp-fs-label-sm` | 12px | 2 | 3 | 5 |
| `--sp-fs-badge` | 12px | 3 | 0 | 3 |
| `--sp-fs-legal` | 11px | 3 | 61 | 64 |
| `--sp-fs-tile` | 10.5px | 1 | 3 | 4 |

- La hoja nombra los tokens **por rol, no por tamaño** («Nombre = rol, no tamaño», `spinus-tokens.css:386`), así que hay valores repetidos con nombre distinto: 16px (`question`, `body-lg`), 15px (`btn-sm`, `display-sm`), 14px (`body-sm`, `chip`), 12px (`label-sm`, `badge`). El comentario de `:410-419` lo declara intencionado. [V]
- En la práctica los tokens se usan **fuera de su rol**: `--sp-fs-legal` («microcopy legal») es el más usado (61 veces en TSX, sobre todo expediente y dashboard); `--sp-fs-btn-sm` («botón secundario») aparece 14 veces en `text-[…]` de componentes; `--sp-fs-vitals` («título de card secundaria») es el tamaño de título de sección de expediente, dashboard, perfil y labs. [V conteos; I que el uso no corresponde al rol nombrado]
- `--sp-fs-h1` no se usa. [V]
- Además de los tokens, `spinus-tokens.css` tiene 15 `font-size` literales en px (15, 12.5, 13, 11.5 ×2 cada uno; 10.5, 24, 16, 12, 19, 17, 20, 18) — p. ej. `.sp-ed-prose h1,h2 { font-size: 19px }` (`:2150`), `h3 { 17px }` (`:2151`). [V]

**Interlineado**

| Token | Valor | CSS | TSX |
|---|---|---|---|
| `--sp-lh-tight` | 1.2 | 2 | 0 |
| `--sp-lh-title` | 1.3 | 4 | 0 |
| `--sp-lh-legal` | 1.4 | 2 | 0 |
| `--sp-lh-snug` | 1.45 | 3 | 4 |
| `--sp-lh-body` | 1.55 | 4 | 3 |
| `--sp-lh-note` | 1.62 | 2 | 6 |

**Tracking**

| Token | Valor | CSS | TSX |
|---|---|---|---|
| `--sp-ls-tight` | −0.02em | 2 | 1 |
| `--sp-ls-label` | 0.04em | 2 | 31 |
| `--sp-ls-label-w` | 0.05em | 4 | 4 |
| `--sp-ls-caps` | 0.06em | 0 | 1 |
| `--sp-ls-eyebrow` | 0.08em | 0 | **0** |

**Pesos**

| Token | Valor | CSS | TSX |
|---|---|---|---|
| `--sp-fw-regular` | 400 | 4 | 0 |
| `--sp-fw-medium` | 500 | 0 | **0** |
| `--sp-fw-semi` | 600 | 13 | 4 |
| `--sp-fw-bold` | 700 | 14 | 5 |
| `--sp-fw-black` | 800 | 9 | 1 |

Desde TSX el peso casi nunca se pide por token (10 usos) sino con clases Tailwind (782). [V]

**Clases de rol** (`spinus-tokens.css:850-863`): `.sp-title-page` (30/800/1.2/−0.02em), `.sp-title-state` (27/800), `.sp-title-modal` (19/800/1.3), `.sp-sub-modal` (13.5/400), `.sp-title-card` (20/800/1.3), `.sp-title-sec` (14.5/700), `.sp-label` (13/700/0.04em/mayúsculas), `.sp-label-field` (12/700/0.04em/mayúsculas), `.sp-label-eyebrow` (12/700/0.05em/mayúsculas), `.sp-body` (14.5/1.45), `.sp-note` (14.5/1.62), `.sp-secondary` (14/1.55), `.sp-hint` (12.5/1.55), `.sp-legal` (11/1.4). Uso en alcance: `sp-label-field` 85, `sp-hint` 68, `sp-label` 44, `sp-body` 13, `sp-title-card` 8, `sp-title-sec` 4, `sp-title-state` 4, `sp-title-page` 4, `sp-title-modal` 1. Botones: `.sp-btn--primary` 15.5px/700, `--primary-block` 17px, `--secondary` y `--ghost` 15px/600, `--tertiary` 14px/600, `--compact` 13.5px/600 (`:876-940`). Campos: `.sp-input/.sp-textarea` 14.5px (`:1054-1060`). [V]

El bloque oscuro de esa hoja redefine color, nunca tamaño (`spinus-tokens.css:417`). [V]

### 5.3 Agenda (`--ag-*`)

- **No existe ningún token tipográfico `--ag-*`.** `grep "ag-fs|--ag-font|--ag-lh|--ag-fw" globals.css` → 0. Los `--ag-*` cuyo nombre contiene «text» (`--ag-text`, `--ag-chip-text`, `--ag-segment-text`, `--ag-success-text`, `--ag-aviso-text`, `--ag-gcal-text`…) son **colores**. [V]
- La agenda **sí tiene una escala distinta, pero sin nombrar**: valores px crudos en dos sitios:
  - `globals.css`: 123 `font-size` (13px ×25, 14 ×15, 12 ×13+1, 11 ×12, 10.5 ×11, 15 ×10, 12.5 ×9, 13.5 ×6, 9 ×4, 15.5 ×3, 11.5 ×3, 16 ×3, 18 ×2, 10 ×2, y 17, 9.5, 14.5, 24 una vez) — 18 tamaños.
  - `components/agenda/*.tsx`: 203 `text-[Npx]` (11px ×40, 14 ×40, 12 ×33, 13.5 ×22, 15 ×21, 13 ×20, 12.5 ×9, 16 ×9…) más 112 clases con nombre (`text-sm` ×99).
- Y un mini-sistema local de constantes de clase para la configuración de la agenda: `src/components/agenda/configuracion/estilosConfig.ts:42-48` (`TITULO_PASO` 18→20px/700, `SUB_PASO` 14px, `TITULO_PANEL` 16px/700, `ETIQUETA` 14px). [V]
- Diferencias de la escala agenda respecto a la `sp`: base de 13px (`.fc`, `globals.css:1235`) frente a 14–14.5px; baja hasta 9px (la `sp` no pasa de 10.5); no tiene títulos de página por encima de 20–24px; pesos 600/700 dominantes sin 800 en títulos. Comparten los medios píxeles 10.5, 12.5, 13.5, 15.5. [V]

---

## 6. Unidades y escalado

- **rem:** solo las 579 clases Tailwind con nombre (38 % de las 1508 apariciones de tamaño). **px:** el resto — 453 arbitrarias, 248 por token `sp` (los tokens están definidos en px), 195 declaraciones CSS, 33 en línea → **929 (62 %)**. [V]
- No hay ningún tamaño arbitrario en rem/em (`text-[…rem]` → 0) ni ningún `clamp()` tipográfico en alcance. [V]
- `html` no fija `font-size`; solo `scroll-behavior` y `-webkit-text-size-adjust: 100%` (`globals.css:887-890`). El viewport es el de Next más `viewportFit: 'cover'`; no hay `maximum-scale` ni `user-scalable=no` (`src/app/layout.tsx:23,66-83`), así que el zoom con pellizco no está bloqueado. [V]
- **¿Escalaría la UI si el usuario sube el tamaño de texto?** [I]
  - *Tamaño de fuente por defecto del navegador* (Chrome/Firefox de escritorio, Chrome Android): solo crece lo escrito en rem. Resultado parcial y desigual: offline, onboarding, billing, pacientes, admin y ayuda crecerían casi enteros; la agenda a medias (112 de 315 clases, y nada de sus 123 reglas CSS); expediente (componentes), dashboard, labs, perfil y documentos casi nada, porque van en px por token.
  - *Dynamic Type de iOS:* no se usa `font: -apple-system-body` ni ninguna fuente de sistema dinámica (`grep` sin resultados), así que la PWA instalada en iOS no sigue el ajuste de texto del sistema. [V la ausencia; I la consecuencia]
  - *Zoom de página* (Ctrl/Cmd +, pellizco): escala todo por igual, px incluidos.
- Los campos `.sp-input/.sp-textarea` miden 14.5px (`spinus-tokens.css:1060`); la agenda usa campos de 14–15px. [V] En iOS Safari los campos por debajo de 16px provocan zoom automático al enfocar. [I — comportamiento conocido del navegador, no comprobado aquí en dispositivo]

---

## 7. Inconsistencias concretas por rol

### 7.1 Título de página (`<h1>`) — 9 tratamientos distintos [V]

| Tratamiento | Páginas |
|---|---|
| **30px / 800** / tracking −0.02em (`.sp-title-page`) | `expediente/[id]/nueva-nota/page.tsx:1439`, `perfil/page.tsx:141` |
| **30px / 800** / `tracking-tight` (−0.025em), mismo tamaño escrito a mano con el token | `dashboard/page.tsx:119`, `dashboard/AsistenteDashboard.tsx:82` |
| **25px / 800** (`--sp-fs-patient`) | `components/expediente/CabeceraPaciente.tsx:114` |
| **24px / 700**, color `#1a3a5c` (`text-2xl font-bold`) | `expediente/[id]/consulta/[consultaId]/page.tsx:188`, `expediente/[id]/documentos/page.tsx:169`, `suplementacion/page.tsx:23` |
| **24px / 600** (`text-2xl font-semibold`) | `components/agenda/configuracion/ConfiguracionCalendario.tsx:204` |
| **22px / 700** / `tracking-tight`, color `#1d1d1f` | `admin/usuarios/page.tsx:207`, `documentos/page.tsx:111`, `billing/page.tsx:124`, `expediente/page.tsx:216`, `estadisticas/page.tsx:90` |
| **20px / 700** (`text-xl font-bold`) | `ayuda/page.tsx:164` |
| **18→20px / 700** (`TITULO_PASO`) | 6 pantallas de configuración de agenda (`estilosConfig.ts:42`) |
| **14px / 600** (`text-sm font-semibold`) | `expediente/[id]/editar/page.tsx:136`, `pacientes/nuevo/page.tsx:211` |
| 36→48px / 800 | `(launcher)/inicio/page.tsx:285` |
| 18px / 700 | `(offline)/offline-setup/page.tsx:128` |
| Sin título visible (`sr-only`); el título visual es la fecha a 15px/700 | Agenda: `CabeceraEscritorio.tsx:116`, `BandaMovil.tsx:112`; `.agenda-fc .fc-toolbar-title` `globals.css:2484-2486` |

El título de página va de 14 a 30 px dentro de la app autenticada, con pesos 600, 700 y 800 y tres colores escritos de forma distinta (`#1d1d1f`, `#1a3a5c`, tokens `--sp-ink-*`/`--ag-*`).

### 7.2 Título de tarjeta / sección (`<h2>`, 94 casos, 17 combinaciones) [V]

- `sp-label` (13px/700 mayúsculas) ×25 — documentos (`ConsentimientoInformadoForm.tsx:1377`)
- `text-lg font-bold` (18/700) ×8 — `ui/OfflineAlert.tsx:53`
- `text-sm font-semibold` (14/600) ×7 — `SeguimientosWidget.tsx:34`
- `text-[length:var(--sp-fs-vitals)] font-bold` (18/700) ×7 — `expediente/LineaTiempoClinica.tsx:367`
- mismo tamaño con `font-extrabold` (18/800) ×2 — `expediente/VisorNota.tsx:68`
- `text-base font-bold` (16/700) ×6 — `agenda/ModalBloqueo.tsx:185`
- `text-base font-semibold` (16/600) ×4 — `agenda/configuracion/PasosConfiguracion.tsx:183`
- `text-[16px] font-bold` ×3 — `agenda/configuracion/ConfirmacionRestablecer.tsx:68` (mismo 16px, escrito en px)
- `sp-title-card` (20/800) ×5 — `documentos/FirmadoConsentimiento.tsx:322`
- `text-[18px] font-extrabold` ×2 — `agenda/AppointmentModal.tsx:1086`
- `text-[15px] font-semibold` ×2 — `ui/QuickPatientModal.tsx:227`
- `text-[length:var(--sp-fs-modal)] font-bold` (19/700) — `perfil/PanelGoogleCalendar.tsx:234`; la clase `.sp-title-modal` define ese mismo título como 19/**800**.

Títulos de modal en concreto: 15/600 (`QuickPatientModal`), 16/700 (`ModalBloqueo`), 18/800 (`AppointmentModal`), 19/700 (`PanelGoogleCalendar`), 19/800 (`.sp-title-modal`).

### 7.3 Etiqueta de campo (`<label>`, 240 casos, 17 combinaciones) [V]

| Tratamiento | Casos | Ejemplo |
|---|---|---|
| 12px / 700 / mayúsculas / 0.04em (`sp-label-field`) | 74 | `documentos/ConsentimientoInformadoForm.tsx:1395` |
| 12px / 500 / sin mayúsculas, color `#86868b` (`labelCls`) | 26 | `pacientes/nuevo/page.tsx:26` |
| 12px / 600 / sin mayúsculas (`text-xs font-semibold`) | 22 | `consultorios/AddConsultorioModal.tsx:115` |
| 11px / 700 / mayúsculas / 0.06em | 18 | `agenda/AppointmentModal.tsx:1136`, `agenda/PanelReagendar.tsx:49` |
| 11px / 600 / mayúsculas / 0.05em (`tracking-wider`) | 17 | `ui/QuickPatientModal.tsx:34` |
| 11px / 600 / mayúsculas / 0.025em (`tracking-wide`) | 4 | `expediente/SheetFiltrosExpediente.tsx:180` |
| 11px / 500 / sin mayúsculas | 9 | `CommandPalette.tsx:482` |
| 14px / regular (`ETIQUETA`, `text-[14px]`) | 15 | `agenda/configuracion/estilosConfig.ts:48`, `EditorDias.tsx:56` |
| 13.5px / 600 | 4 | `agenda/configuracion/ConfirmacionRestablecer.tsx:75` |

Crear un paciente desde la página (`pacientes/nuevo`: 12/500, minúsculas) y desde el modal rápido (`QuickPatientModal`: 11/600, mayúsculas) usa etiquetas distintas para los mismos campos.

### 7.4 Botón [V parcial — ver limitación de §0]

- Sistema `sp`: primario 15.5px/700, primario de ancho completo 17px/700, secundario y ghost 15px/600, terciario 14px/600, compacto 13.5px/600 (`spinus-tokens.css:876-940`) — 56 botones lo usan, casi todos en documentos y perfil.
- Tailwind suelto: `text-sm font-semibold` (14/600) ×23, `text-sm font-medium` (14/500) ×18, `text-sm font-bold` (14/700) ×9, `text-[13px] font-medium` ×7 (`labs/ModalSubirDocumento.tsx:271`), `text-xs font-medium` ×4.
- Agenda: `h-10 … text-sm font-bold` (`PanelReagendar.tsx:50`); avisos `text-[12px] font-bold` (`avisos/ListaAvisos.tsx:25`); más ~30 botones con constantes `BOTON_*` de `estilosConfig.ts`.
- Mismo rol «botón de acción de un modal»: 14/500, 14/600, 14/700 y 15.5/700 según el modal.

### 7.5 Texto secundario / ayuda [V conteos]

Cinco tamaños para el mismo rol: `text-xs` 12px (163 usos), `--sp-fs-hint` 12.5px (52 + 68 de `.sp-hint`), `text-[11px]` (144), `--sp-fs-legal` 11px (61), `text-[12.5px]` (18). El subtítulo bajo el H1 es `text-sm` 14px en `admin`, `documentos`, `billing`, `ayuda` y en la configuración de agenda.

### 7.6 Cuerpo [V]

14px (`text-sm`, 373; `--sp-fs-body-sm`, 53) frente a 14.5px (`--sp-fs-body`, 27; campos y cuerpo de nota) frente a 13px (base de `.fc` y 56 `text-[13px]`, sobre todo labs y agenda). `text-base` (16px) solo aparece 13 veces.

### 7.7 Encabezado de tabla (`<th>`) [V]

`text-[length:var(--sp-fs-legal)] font-bold … tracking-[var(--sp-ls-label)]` (11/700/0.04em) en `expediente/CuerpoDocumento.tsx:487` frente a `text-[11px] font-semibold tracking-wide` (11/600/0.025em) en `expediente/TablaPacientesExpediente.tsx:49` — misma carpeta.

### 7.8 Mismo valor, tres formas de escribirlo [V]

- 14px: `text-sm` (373), `text-[14px]` (43), `text-[length:var(--sp-fs-body-sm)]` (36).
- 12px: `text-xs` (163), `text-[12px]` (53), `--sp-fs-label-sm`/`--sp-fs-badge`.
- 11px: `text-[11px]` (144) y `--sp-fs-legal` (61), ambas dentro de `components/expediente` y `components/labs`.
- 18px: `text-lg` (17), `text-[18px]` (3), `--sp-fs-vitals` (13).

### 7.9 Color de texto fuera de token (dato colateral) [V]

232 apariciones de `text-[#1d1d1f]` / `text-[#86868b]` en `src` (grises de la paleta de Apple, escritos como hex) conviven con `text-slate-*`, `--sp-ink-*` y `--ag-*`.

---

## 8. Rasgos tipográficos finos

| Rasgo | Estado | Evidencia |
|---|---|---|
| `tabular-nums` | **55 usos:** 43 clases Tailwind (expediente 19, dashboard 8, labs 7, agenda 5, admin 2) + 10 `font-variant-numeric: tabular-nums` en `globals.css` (agenda) + 2 en `spinus-tokens.css` | [V] |
| Otras `font-variant-numeric` (`lining-nums`, `slashed-zero`…) | 0 | [V] |
| `font-feature-settings` | 0 | [V] |
| `font-optical-sizing` | 0 declaraciones. En la app no aplica de forma explícita; con fuente de sistema queda en el `auto` del navegador. Inter (landing/login) carga el eje `opsz` y también lo deja en `auto` (`src/lib/fonts.ts:32-35,40`) | [V] |
| `text-wrap` / `text-balance` / `text-pretty` | **0** en la app autenticada (ni clases ni CSS) | [V] |
| Mayúsculas | 114 clases `uppercase` (expediente 32, agenda 22, labs 20, ui 7) + 12 `text-transform: uppercase` en `globals.css` + 5 en `spinus-tokens.css`. `normal-case` ×5, `capitalize` ×8 (+1 CSS), `lowercase` 1 CSS | [V] |
| Mayúsculas **con** tracking | Los rótulos en mayúsculas llevan tracking positivo en la mayoría de los casos revisados (ver §7.3), pero con 6 valores: 0.025, 0.04, 0.05, 0.06, 0.08 (sin uso) y 0.12em. En `globals.css` hay 12 `uppercase` y solo 8 `letter-spacing`, así que al menos 4 reglas de la agenda van en mayúsculas sin tracking | [V conteos; I el emparejamiento exacto] |
| `truncate` / `line-clamp` | `truncate` ×76, `line-clamp-2` ×5, `line-clamp-3` ×1, `whitespace-nowrap` ×53 | [V] |
| Cursiva | 8 clases `italic` + 2 `font-style: italic` en CSS | [V] |
| Suavizado | `antialiased` en `<body>` (`layout.tsx:104`) y además `-webkit-font-smoothing: antialiased` + `text-rendering: optimizeLegibility` en CSS (`globals.css:896-898`) — duplicado | [V] |

---

## 9. Resumen de hechos

1. Una sola familia en la app (fuente de sistema); Inter existe pero solo en landing y login. Excepciones: 14 `font-mono` + 1 pila mono en CSS, y 1 Georgia en línea.
2. 29 tamaños distintos, 1508 apariciones; 13 tamaños entre 9 y 15.5px en pasos de medio píxel.
3. 327 apariciones (21,7 %) por debajo de 12px; mínimo 9px en la agenda. El token `sp` más usado desde TSX es el de 11px.
4. Cuatro formas de fijar tamaño conviven: Tailwind con nombre (579), px arbitrario (453), token `sp` (248), clase de rol `sp` (231); cada área usa una distinta.
5. 62 % de los tamaños en px, 38 % en rem; ningún `clamp()` ni tamaño fluido.
6. Tokens tipográficos solo en `--sp-*` (24 tamaños, 6 interlineados, 5 trackings, 5 pesos). Sin uso: `--sp-fs-h1`, `--sp-fw-medium`, `--sp-ls-eyebrow`, `--sp-font`. La agenda no tiene ninguno: 123 `font-size` y 100 `font-weight` crudos en CSS.
7. Pesos: 600 (338) > 700 (215) > 500 (176) > 800 (32) > 400 (21). `--sp-fw-black` vale 800.
8. Título de página en 9 tratamientos (14–30px, pesos 600/700/800); etiqueta de campo en 9; título de modal en 5.
9. `text-wrap`, `font-feature-settings` y `font-optical-sizing`: 0 usos. `tabular-nums`: 55.
