# Auditoría de tokens de color, radios, sombras y espaciado — Spinus (rama `feature/agenda-v2`)

Fecha: 2026-11-19 · Solo lectura · Alcance: app autenticada (`src/app/(app)`, `src/app/(launcher)`, `src/components`, `src/hooks`, `src/lib`), **excluidos** calculadoras, dicom, super-admin, landing, agendaPublica, legal, `src/lib/pdf` y tests.

**Convención:** **[V]** = verificado leyendo o midiendo el código (se cita archivo:línea o el conteo sale de un barrido automático). **[I]** = inferido (no comprobado en navegador ni línea por línea). Los valores «resueltos» de `color-mix()`, `hsl(from…)` y `oklch(from…)` los calculé yo con la marca de fábrica (`--cp` #1a3a5c, `--cs` #1e5fa8); los de `oklch` son aproximados (±1 en un canal) — **[I]** en el último dígito.

Método de conteo: barrido con regex sobre 460 archivos `.ts/.tsx` en alcance (250 `.tsx`) más `globals.css` y `spinus-tokens.css`, con comentarios eliminados. «Usos» = apariciones de `var(--token` en todo `src/` (incluye CSS y fuera de alcance). No se ejecutó la app: nada de lo que sigue está comprobado visualmente.

---

## 0. Hallazgos principales

1. **Hay tres sistemas de color vivos a la vez, no uno** [V]:
   - **`--sp-*`** (`src/app/spinus-tokens.css`, 235 tokens, 2 659 usos): expediente, dashboard, perfil, labs, documentos, nota médica.
   - **`--ag-*`** (`src/app/globals.css:37-560`, 131 tokens, 1 673 usos): agenda; lo consumen además el Sidebar (`--ag-navy*`), el dashboard (estados de cita) y las páginas públicas de reserva.
   - **Literales Tailwind** (`bg-white`, `text-slate-*`, `text-[#86868b]`, `bg-[#1e5fa8]`…): 1 424 clases de paleta + 402 clases con hex arbitrario en 89 de los 250 `.tsx`. Pantallas enteras viven solo de esto: listado de expedientes, pacientes/nuevo, admin/usuarios, billing, documentos, CommandPalette, onboarding, modales de `ui/`.
2. **La trampa `--cp`/`--cs` está confirmada** [V]: `--cp` = #1a3a5c (navy oscuro, «primario» de la clínica) y `--cs` = #1e5fa8 (azul brillante). `--sp-primary: var(--cs, #1e5fa8)` (`spinus-tokens.css:14`) y `--sp-primary-hover: var(--cp, #1a3a5c)` (`:15`). En la agenda, `--ag-brand-primary: var(--cp…)` y `--ag-brand-secondary: var(--cs…)` (`globals.css:70-71`), y el color de acción real es el **secondary** (66 usos frente a 19).
3. **Los dos colores de marca no son constantes: los elige cada clínica** [V]. `ThemeProvider.tsx:97-100` inyecta `--cp`/`--cs` desde `useClinica` (`src/hooks/useClinica.ts:64-65`), y `/perfil` ofrece seis paletas (`src/app/(app)/perfil/page.tsx:65-70`: Spinus, Verde médico, Morado, Rojo burdeos, Café cálido, Pizarra). Además `ThemeProvider.tsx:~124-153` reescribe con `!important` las clases literales `bg-[#1e5fa8]`, `text-[#1a3a5c]`, etc. hacia `var(--cs)`/`var(--cp)`. Todo valor «azul» de esta auditoría es el de fábrica.
4. **El modo oscuro son cuatro mecanismos superpuestos con dos paletas distintas** [V]: gris neutro Material (#121212 / #1E1E1E) para literales y `--sp-*`; azul marino (#0c1420 / #1b2a40) para `--ag-*`; y `/inicio` pinta a mano con un booleano (#020617). Detalle en §2.
5. **Texto terciario por debajo de AA en los tres sistemas** [V, calculado]: `text-slate-400` sobre blanco 2.56:1 (119 usos), `--sp-ink-350` 2.90:1 (113 usos), `--ag-muted` 3.50:1 (117 usos), `text-[#86868b]` 3.62:1 (103 usos). §6.
6. **Hay tokens muertos** [V]: `--sem-*` (11), `--user-*` (5) y `--radius-sm/md/lg` (3) de `ThemeProvider.tsx:102-122`, y `--azul-*` (4) de `globals.css:27-30`, tienen **0 usos** vía `var()`.
7. **`SPEC_DISENO.md` y `SPEC_DISENO_PARTE_B.md` no describen la interfaz** [V]: son la especificación de los **documentos impresos** (página 612×792 pt; tinta #101010/#454545/#737373, reglas cálidas #D9D6D0/#EDEAE4, acento #1C3A5E — `SPEC_DISENO.md:156-168`). Su paleta es de papel y no se cruza con `--sp-*`/`--ag-*`. Lo único trasladable es la regla de derivar el acento por contraste (`:170-195`). Los documentos que sí rigen el color de pantalla son `docs/spec/MODO_OSCURO_APP.md` y `docs/spec/MODO_OSCURO_AGENDA.md`.

---

## 1. Inventario de variables CSS de color

### 1.1 Familias y a qué módulo pertenecen [V]

| Familia | Dónde se define | Nº tokens (todos los tipos) | Usos `var()` | Módulo / consumidores |
|---|---|---|---|---|
| `--cp`, `--cs` | `ThemeProvider.tsx:99-100` (inyectado en `<style>`, valor de la clínica); siempre consumidos con respaldo `var(--cp, #1a3a5c)` | 2 | 71 / 50 | Marca de la clínica. Base de `--sp-primary*`, `--ag-brand-*`, `--ag-navy`, y uso directo en TSX (Sidebar, perfil, botones). |
| `--background`, `--foreground` | `globals.css:25-26` | 2 | 1 / 1 | `body` (`globals.css:892-893`). **No se redefinen en oscuro**; el oscuro lo impone `html.dark body { … !important }` (`ThemeProvider.tsx:171-174`; `.bg-white` → #1E1E1E en `:178` — los comentarios del repo que citan `:117` están desfasados). |
| `--azul-*` | `globals.css:27-30` | 4 | **0** | Restos. Sin consumidores. |
| `--sp-*` | `spinus-tokens.css:7-478` (claro), `:487-697` y `@supports :753` (oscuro) | 235 (104 de color) | 2 659 | «Sistema de diseño Spinus», nacido del funnel de nota médica (`spinus-tokens.css:1-5`). Consumidores principales: `components/expediente` (780 `var()` en TSX), `components/dashboard` (289), `components/labs` (271), `components/perfil` (243), `app/(app)/dashboard` (102), `components/documentos` (64), y las clases `.sp-*` de la propia hoja (681). |
| `--ag-*` | `globals.css:37-560` (claro), `:6759-7060` y `@supports :7074` (oscuro) | 131 (98 de color) | 1 673 | Agenda (`components/agenda` 819 `var()` en TSX + 662 en `globals.css`). Fuera de la agenda: `Sidebar.tsx` (13, familia `--ag-navy*`), `dashboard/ProximasCitas.tsx` (5), `dashboard/StatusChip.tsx` (5), `avisos/ListaAvisos.tsx` (6), `dashboard/HoyEnConsultorio.tsx` (1), `ThemeProvider.tsx` (1, barra del navegador). Fuera de alcance: `agendaPublica.css` (174, las redeclara en `body:has(.rp)`), `reservar/*`, `confirmar/*`. |
| `--lp-*` | `globals.css` (~`:601-850`) | 42 (33 de color) | 379 | Landing pública. **Fuera de alcance**; no tiene variante oscura. Dos fugas mínimas hacia la app: `--lp-accent` (2 usos en alcance), `--lp-focus` (1). |
| `--fc-*` | `globals.css` (bloques `.fc{}`) | 9 | — | Variables nativas de FullCalendar, apuntadas a `--ag-*`. |
| `--sem-*`, `--user-*`, `--radius-*` | `ThemeProvider.tsx:102-122` | 19 | **0** | Muertos: declarados, nunca leídos con `var()`. Paleta tipo iOS (#34c759, #ff3b30, #ff9500, #af52de). |
| Locales de componente | TSX (`--doc-color`, `--hero`, `--marco`, `--primario`, `--tarjeta`…) | ~30 | bajo | Variables de ámbito local declaradas en `style={{}}`; no forman sistema. |

Observaciones [V]:
- **`--sp-*` y `--ag-*` no se referencian entre sí** en sus declaraciones: son dos escalas paralelas que comparten solo `--cp`/`--cs`. Muchos valores coinciden por copia, no por alias (p. ej. `--sp-danger` = `--ag-status-cancelled-text` = `--lp-danger` = #c0392b; `--sp-warn` = `--ag-status-scheduled-text` = #b45309; `--sp-line-divider` = `--ag-hairline` = #eef1f6).
- Tokens de color con **0 usos**: `--ag-grid-col`, `--ag-gcal-bg2`, `--sp-success-online`, `--sp-surface-slot`, `--sp-canvas-bg`, `--sp-line-frame`, y seis de los ocho `--sp-doc-*` por `var()` literal (se leen por nombre dinámico `--sp-doc-${tipo}`: 5 usos del prefijo — **[I]** que cubren los seis).
- Nombres dinámicos: `--ag-status-${estado}-…` (25 usos del prefijo), `--ag-evento-${color}` (16), `--sp-avatar-${n}-…`. El conteo por token individual de esas familias está infravalorado.
- Dos tokens **usados pero no definidos** [V]: `--sp-text-strong` (2 usos) y `--sp-text-muted` (1), además de `--color-success` (1). Resuelven a inválido salvo que lleven respaldo.

### 1.2 Tabla completa de tokens de color

Columnas: valor declarado en `:root`; hex resuelto con la marca de fábrica (`#rrggbb@a` = con alfa); valor en `html.dark` (incluye el bloque `@supports`); usos de `var(--token`. «— (no redefine)» = el token vale lo mismo en oscuro.

#### --c* / heredadas de raíz (marca del usuario y restos) — 8 tokens de color

| Token | Claro (declarado) | Claro resuelto | Oscuro (declarado) | Oscuro resuelto | Usos `var()` | Def. |
|---|---|---|---|---|---|---|
| `--background` | `#f8fafc` | #f8fafc | `— (no redefine)` | = | 1 | globals.css:25 |
| `--foreground` | `#1e293b` | #1e293b | `— (no redefine)` | = | 1 | globals.css:26 |
| `--azul-oscuro` | `#1a3a5c` | #1a3a5c | `— (no redefine)` | = | 0 | globals.css:27 |
| `--azul-medio` | `#1e5fa8` | #1e5fa8 | `— (no redefine)` | = | 0 | globals.css:28 |
| `--azul-claro` | `#4a9fd4` | #4a9fd4 | `— (no redefine)` | = | 0 | globals.css:29 |
| `--azul-suave` | `#e8f4fd` | #e8f4fd | `— (no redefine)` | = | 0 | globals.css:30 |
| `--cp` | `#1a3a5c` | #1a3a5c | `— (no redefine)` | = | 71 | ThemeProvider.tsx:99-100 |
| `--cs` | `#1e5fa8` | #1e5fa8 | `— (no redefine)` | = | 50 | ThemeProvider.tsx:99-100 |

#### --sp-* (sistema «Spinus»: nota médica, expediente, dashboard, perfil, labs, documentos) — 104 tokens de color

| Token | Claro (declarado) | Claro resuelto | Oscuro (declarado) | Oscuro resuelto | Usos `var()` | Def. |
|---|---|---|---|---|---|---|
| `--sp-primary` | `var(--cs, #1e5fa8)` | #1e5fa8 | `oklch(from var(--cs, #1e5fa8) 0.55 c h)` | #3373bd | 33 | spinus-tokens.css:14 |
| `--sp-primary-hover` | `var(--cp, #1a3a5c)` | #1a3a5c | `oklch(from var(--cs, #1e5fa8) 0.49 c h)` | #2061aa | 2 | spinus-tokens.css:15 |
| `--sp-primary-active` | `color-mix(in srgb, var(--sp-primary-hover) 85%, #000)` | #16314e | `oklch(from var(--cs, #1e5fa8) 0.43 c h)` | #074f96 | 1 | spinus-tokens.css:16 |
| `--sp-primary-ink` | `color-mix(in srgb, var(--cs, #1e5fa8) 40%, var(--sp-ink-700))` | #2f527a | `oklch(from var(--cs, #1e5fa8) 0.70 c h)` | #61a1ef | 7 | spinus-tokens.css:17 |
| `--sp-primary-bg` | `color-mix(in srgb, var(--cs, #1e5fa8) 12%, #fff)` | #e4ecf5 | `color-mix(in srgb, var(--cs, #1e5fa8) 14%, transparent)` | #1e5fa8@0.14 | 12 | spinus-tokens.css:18 |
| `--sp-primary-bg-soft` | `color-mix(in srgb, var(--cs, #1e5fa8) 8%, #fff)` | #edf2f8 | `color-mix(in srgb, var(--cs, #1e5fa8) 10%, transparent)` | #1e5fa8@0.10 | 6 | spinus-tokens.css:19 |
| `--sp-primary-bg-faint` | `color-mix(in srgb, var(--cs, #1e5fa8) 5%, #fff)` | #f4f7fb | `color-mix(in srgb, var(--cs, #1e5fa8) 7%, transparent)` | #1e5fa8@0.07 | 17 | spinus-tokens.css:20 |
| `--sp-primary-border` | `color-mix(in srgb, var(--cs, #1e5fa8) 18%, #fff)` | #d7e2ef | `color-mix(in srgb, var(--cs, #1e5fa8) 25%, transparent)` | #1e5fa8@0.25 | 14 | spinus-tokens.css:21 |
| `--sp-primary-track` | `color-mix(in srgb, var(--cs, #1e5fa8) 22%, #fff)` | #cedcec | `color-mix(in srgb, var(--cs, #1e5fa8) 25%, transparent)` | #1e5fa8@0.25 | 4 | spinus-tokens.css:22 |
| `--sp-on-primary` | `#ffffff` | #ffffff | `— (no redefine)` | = | 2 | spinus-tokens.css:29 |
| `--sp-primary-focus` | `color-mix(in srgb, var(--cs, #1e5fa8) 8%, transparent)` | #1e5fa8@0.08 | `color-mix(in srgb, var(--cs, #1e5fa8) 28%, transparent)` | #1e5fa8@0.28 | 1 | spinus-tokens.css:30 |
| `--sp-primary-text` | `var(--sp-primary)` | #1e5fa8 | `oklch(from var(--cs, #1e5fa8) 0.70 c h)` | #61a1ef | 50 | spinus-tokens.css:31 |
| `--sp-cifra-cierre` | `var(--cp, #1a3a5c)` | #1a3a5c | `var(--sp-primary-text)` | #61a1ef | 1 | spinus-tokens.css:49 |
| `--sp-brand-grad-from` | `var(--cp, #1a3a5c)` | #1a3a5c | `oklch(from var(--cp, #1a3a5c) 0.42 c h)` | #2f4f73 | 8 | spinus-tokens.css:60 |
| `--sp-brand-grad-to` | `oklch(from var(--cs, #1e5fa8) min(l, 0.52) c h)` | #1e5fa8 | `oklch(from var(--cs, #1e5fa8) 0.55 c h)` | #3373bd | 8 | spinus-tokens.css:68 |
| `--sp-success` | `#16a34a` | #16a34a | `#34d399` | #34d399 | 8 | spinus-tokens.css:81 |
| `--sp-success-dot` | `#22c55e` | #22c55e | `#34d399` | #34d399 | 5 | spinus-tokens.css:82 |
| `--sp-success-online` | `#34d399` | #34d399 | `— (no redefine)` | = | 0 | spinus-tokens.css:83 |
| `--sp-success-bg` | `#e9f7ef` | #e9f7ef | `rgba(16,185,129,.14)` | #10b981@0.14 | 10 | spinus-tokens.css:84 |
| `--sp-success-bg-alt` | `#e9f5ee` | #e9f5ee | `rgba(16,185,129,.14)` | #10b981@0.14 | 2 | spinus-tokens.css:85 |
| `--sp-success-border` | `#cfe6d6` | #cfe6d6 | `rgba(16,185,129,.25)` | #10b981@0.25 | 1 | spinus-tokens.css:86 |
| `--sp-success-strong` | `#0f7a52` | #0f7a52 | `#6ee7b7` | #6ee7b7 | 8 | spinus-tokens.css:87 |
| `--sp-success-card-brd` | `#bfe0cb` | #bfe0cb | `rgba(16,185,129,.25)` | #10b981@0.25 | 1 | spinus-tokens.css:88 |
| `--sp-warn` | `#b45309` | #b45309 | `#fcd34d` | #fcd34d | 20 | spinus-tokens.css:91 |
| `--sp-warn-strong` | `#d97706` | #d97706 | `#fbbf24` | #fbbf24 | 9 | spinus-tokens.css:92 |
| `--sp-warn-bg` | `#fef6e7` | #fef6e7 | `rgba(245,158,11,.14)` | #f59e0b@0.14 | 7 | spinus-tokens.css:93 |
| `--sp-warn-bg-badge` | `#fdecc8` | #fdecc8 | `rgba(245,158,11,.22)` | #f59e0b@0.22 | 4 | spinus-tokens.css:94 |
| `--sp-warn-border` | `#f4dfae` | #f4dfae | `rgba(245,158,11,.25)` | #f59e0b@0.25 | 2 | spinus-tokens.css:95 |
| `--sp-warn-dot` | `#f59e0b` | #f59e0b | `#fbbf24` | #fbbf24 | 5 | spinus-tokens.css:96 |
| `--sp-vital-ok` | `#17976a` | #17976a | `#34d399` | #34d399 | 3 | spinus-tokens.css:105 |
| `--sp-vital-ok-accent` | `#2fb488` | #2fb488 | `#34d399` | #34d399 | 1 | spinus-tokens.css:105 |
| `--sp-vital-watch` | `#c07d10` | #c07d10 | `#fcd34d` | #fcd34d | 2 | spinus-tokens.css:106 |
| `--sp-vital-watch-accent` | `#e6a521` | #e6a521 | `#fbbf24` | #fbbf24 | 1 | spinus-tokens.css:106 |
| `--sp-vital-out` | `#c62f3b` | #c62f3b | `#f87171` | #f87171 | 2 | spinus-tokens.css:107 |
| `--sp-vital-out-accent` | `#e5484d` | #e5484d | `#f87171` | #f87171 | 3 | spinus-tokens.css:107 |
| `--sp-danger` | `#c0392b` | #c0392b | `#f87171` | #f87171 | 67 | spinus-tokens.css:110 |
| `--sp-danger-strong` | `#a02525` | #a02525 | `#fca5a5` | #fca5a5 | 1 | spinus-tokens.css:111 |
| `--sp-danger-ink` | `#8c2f2f` | #8c2f2f | `#fca5a5` | #fca5a5 | 2 | spinus-tokens.css:112 |
| `--sp-danger-bg` | `#fdf2f2` | #fdf2f2 | `rgba(239,68,68,.14)` | #ef4444@0.14 | 18 | spinus-tokens.css:113 |
| `--sp-danger-border` | `#f3c9c9` | #f3c9c9 | `rgba(239,68,68,.25)` | #ef4444@0.25 | 6 | spinus-tokens.css:114 |
| `--sp-alergia-bg` | `#c0392b` | #c0392b | `— (no redefine)` | = | 1 | spinus-tokens.css:124 |
| `--sp-alergia-ink` | `#ffffff` | #ffffff | `— (no redefine)` | = | 1 | spinus-tokens.css:125 |
| `--sp-doc-receta` | `#1d4ed8` | #1d4ed8 | `#4899fb` | #4899fb | 0 | spinus-tokens.css:141 |
| `--sp-doc-laboratorio` | `#047857` | #047857 | `#00b781` | #00b781 | 1 | spinus-tokens.css:142 |
| `--sp-doc-imagen` | `#7c3aed` | #7c3aed | `#a17efe` | #a17efe | 1 | spinus-tokens.css:143 |
| `--sp-doc-suplementacion` | `#92400e` | #92400e | `#e7ad00` | #e7ad00 | 0 | spinus-tokens.css:144 |
| `--sp-doc-internamiento` | `#be123c` | #be123c | `#fd5d79` | #fd5d79 | 0 | spinus-tokens.css:145 |
| `--sp-doc-escrito` | `#155e75` | #155e75 | `#00cee9` | #00cee9 | 0 | spinus-tokens.css:146 |
| `--sp-doc-consentimiento` | `#3730a3` | #3730a3 | `#9fabff` | #9fabff | 0 | spinus-tokens.css:147 |
| `--sp-doc-honorarios` | `#c2410c` | #c2410c | `#ee7d00` | #ee7d00 | 0 | spinus-tokens.css:148 |
| `--sp-hito-medicion` | `#86198f` | #86198f | `#e360f7` | #e360f7 | 3 | spinus-tokens.css:166 |
| `--sp-avatar-1-bg` | `#d8a780` | #d8a780 | `#774b23` | #774b23 | 1 | spinus-tokens.css:209 |
| `--sp-avatar-1-ink` | `#5a3514` | #5a3514 | `#fac093` | #fac093 | 1 | spinus-tokens.css:209 |
| `--sp-avatar-2-bg` | `#e0e89e` | #e0e89e | `#343d02` | #343d02 | 1 | spinus-tokens.css:210 |
| `--sp-avatar-2-ink` | `#52600b` | #52600b | `#b7c26b` | #b7c26b | 1 | spinus-tokens.css:210 |
| `--sp-avatar-3-bg` | `#62e5df` | #62e5df | `#2a5d5a` | #2a5d5a | 1 | spinus-tokens.css:211 |
| `--sp-avatar-3-ink` | `#0b6652` | #0b6652 | `#96d8d4` | #96d8d4 | 1 | spinus-tokens.css:211 |
| `--sp-avatar-4-bg` | `#92b0f4` | #92b0f4 | `#0c396c` | #0c396c | 1 | spinus-tokens.css:212 |
| `--sp-avatar-4-ink` | `#4e2785` | #4e2785 | `#a1bbf9` | #a1bbf9 | 1 | spinus-tokens.css:212 |
| `--sp-avatar-5-bg` | `#e3b4cd` | #e3b4cd | `#673752` | #673752 | 1 | spinus-tokens.css:213 |
| `--sp-avatar-5-ink` | `#812960` | #812960 | `#ddaec7` | #ddaec7 | 1 | spinus-tokens.css:213 |
| `--sp-avatar-6-bg` | `#f8afa5` | #f8afa5 | `#652420` | #652420 | 1 | spinus-tokens.css:222 |
| `--sp-avatar-6-ink` | `#662c27` | #662c27 | `#e5afa7` | #e5afa7 | 1 | spinus-tokens.css:222 |
| `--sp-avatar-7-bg` | `#dbbe7a` | #dbbe7a | `#51452b` | #51452b | 1 | spinus-tokens.css:223 |
| `--sp-avatar-7-ink` | `#4b3c0d` | #4b3c0d | `#ccba93` | #ccba93 | 1 | spinus-tokens.css:223 |
| `--sp-avatar-8-bg` | `#87d19f` | #87d19f | `#233f2c` | #233f2c | 1 | spinus-tokens.css:224 |
| `--sp-avatar-8-ink` | `#0e4727` | #0e4727 | `#9cc5a8` | #9cc5a8 | 1 | spinus-tokens.css:224 |
| `--sp-avatar-9-bg` | `#abedfd` | #abedfd | `#003f4a` | #003f4a | 1 | spinus-tokens.css:225 |
| `--sp-avatar-9-ink` | `#006659` | #006659 | `#84c6d5` | #84c6d5 | 1 | spinus-tokens.css:225 |
| `--sp-avatar-10-bg` | `#bba6ea` | #bba6ea | `#4c4068` | #4c4068 | 1 | spinus-tokens.css:226 |
| `--sp-avatar-10-ink` | `#4d335f` | #4d335f | `#c2b5dd` | #c2b5dd | 1 | spinus-tokens.css:226 |
| `--sp-ink-900` | `#14345c` | #14345c | `rgba(255,255,255,.87)` | #ffffff@0.87 | 13 | spinus-tokens.css:231 |
| `--sp-ink-800` | `#173156` | #173156 | `rgba(255,255,255,.87)` | #ffffff@0.87 | 78 | spinus-tokens.css:232 |
| `--sp-ink-700` | `#3b4a5c` | #3b4a5c | `rgba(255,255,255,.75)` | #ffffff@0.75 | 58 | spinus-tokens.css:233 |
| `--sp-ink-600` | `#4b5b6e` | #4b5b6e | `rgba(255,255,255,.60)` | #ffffff@0.60 | 20 | spinus-tokens.css:234 |
| `--sp-ink-500` | `#5a6b81` | #5a6b81 | `rgba(255,255,255,.50)` | #ffffff@0.50 | 65 | spinus-tokens.css:235 |
| `--sp-ink-400` | `#6b7b8f` | #6b7b8f | `rgba(255,255,255,.50)` | #ffffff@0.50 | 6 | spinus-tokens.css:236 |
| `--sp-ink-350` | `#8a99ac` | #8a99ac | `rgba(255,255,255,.38)` | #ffffff@0.38 | 113 | spinus-tokens.css:237 |
| `--sp-ink-300` | `#9aa7b6` | #9aa7b6 | `rgba(255,255,255,.38)` | #ffffff@0.38 | 13 | spinus-tokens.css:238 |
| `--sp-ink-250` | `#94a3b8` | #94a3b8 | `rgba(255,255,255,.38)` | #ffffff@0.38 | 2 | spinus-tokens.css:239 |
| `--sp-ink-200` | `#aab6c4` | #aab6c4 | `rgba(255,255,255,.38)` | #ffffff@0.38 | 5 | spinus-tokens.css:240 |
| `--sp-ink-icon` | `#a3b1c4` | #a3b1c4 | `rgba(255,255,255,.38)` | #ffffff@0.38 | 17 | spinus-tokens.css:241 |
| `--sp-ink-150` | `#b7c2cf` | #b7c2cf | `rgba(255,255,255,.28)` | #ffffff@0.28 | 14 | spinus-tokens.css:242 |
| `--sp-ink-100` | `#c3ccd8` | #c3ccd8 | `rgba(255,255,255,.28)` | #ffffff@0.28 | 2 | spinus-tokens.css:243 |
| `--sp-line-control` | `#6f8eb6` | #6f8eb6 | `rgba(255,255,255,.35)` | #ffffff@0.35 | 15 | spinus-tokens.css:265 |
| `--sp-line-strong` | `#cbd5e1` | #cbd5e1 | `rgba(255,255,255,.16)` | #ffffff@0.16 | 3 | spinus-tokens.css:266 |
| `--sp-line-dash` | `#b9c4d2` | #b9c4d2 | `rgba(255,255,255,.16)` | #ffffff@0.16 | 14 | spinus-tokens.css:267 |
| `--sp-line-input` | `#d5deea` | #d5deea | `rgba(255,255,255,.12)` | #ffffff@0.12 | 4 | spinus-tokens.css:268 |
| `--sp-line-chip` | `#d7e0ec` | #d7e0ec | `rgba(255,255,255,.12)` | #ffffff@0.12 | 3 | spinus-tokens.css:269 |
| `--sp-line-soft` | `#e2e8f0` | #e2e8f0 | `rgba(255,255,255,.08)` | #ffffff@0.08 | 9 | spinus-tokens.css:270 |
| `--sp-line-card` | `#e6ebf2` | #e6ebf2 | `rgba(255,255,255,.12)` | #ffffff@0.12 | 73 | spinus-tokens.css:271 |
| `--sp-line-divider` | `#eef1f6` | #eef1f6 | `rgba(255,255,255,.08)` | #ffffff@0.08 | 50 | spinus-tokens.css:272 |
| `--sp-line-frame` | `#dbe3ee` | #dbe3ee | `rgba(255,255,255,.12)` | #ffffff@0.12 | 0 | spinus-tokens.css:273 |
| `--sp-line-capture` | `color-mix(in srgb, var(--cs, #1e5fa8) 20%, #fff)` | #d2dfee | `color-mix(in srgb, var(--cs, #1e5fa8) 30%, transparent)` | #1e5fa8@0.30 | 1 | spinus-tokens.css:274 |
| `--sp-surface` | `#ffffff` | #ffffff | `#1e1e1e` | #1e1e1e | 91 | spinus-tokens.css:276 |
| `--sp-surface-glass` | `rgba(255,255,255,.95)` | #ffffff@0.95 | `rgba(30,30,30,.95)` | #1e1e1e@0.95 | 6 | spinus-tokens.css:290 |
| `--sp-surface-sunken` | `#fbfcfe` | #fbfcfe | `#242424` | #242424 | 15 | spinus-tokens.css:291 |
| `--sp-surface-muted` | `#eef2f7` | #eef2f7 | `#2c2c2c` | #2c2c2c | 42 | spinus-tokens.css:292 |
| `--sp-surface-empty` | `#f1f4f8` | #f1f4f8 | `#242424` | #242424 | 2 | spinus-tokens.css:293 |
| `--sp-surface-slot` | `#f4f7fb` | #f4f7fb | `#242424` | #242424 | 0 | spinus-tokens.css:294 |
| `--sp-app-bg` | `#f5f8fc` | #f5f8fc | `#121212` | #121212 | 1 | spinus-tokens.css:295 |
| `--sp-canvas-bg` | `#e9edf3` | #e9edf3 | `— (no redefine)` | = | 0 | spinus-tokens.css:296 |
| `--sp-bezel` | `#0f1e30` | #0f1e30 | `— (no redefine)` | = | 1 | spinus-tokens.css:297 |
| `--sp-backdrop` | `rgba(15, 32, 56, .55)` | #0f2038@0.55 | `rgba(0,0,0,.8)` | #000000@0.80 | 1 | spinus-tokens.css:299 |

#### --ag-* (agenda; también Sidebar, dashboard y páginas públicas de reserva) — 98 tokens de color

| Token | Claro (declarado) | Claro resuelto | Oscuro (declarado) | Oscuro resuelto | Usos `var()` | Def. |
|---|---|---|---|---|---|---|
| `--ag-bg-app` | `#eef1f5` | #eef1f5 | `#0c1420` | #0c1420 | 10 | globals.css:37 |
| `--ag-bg-main` | `#fbfcfe` | #fbfcfe | `#0f1828` | #0f1828 | 1 | globals.css:38 |
| `--ag-surface` | `#ffffff` | #ffffff | `#1b2a40` | #1b2a40 | 70 | globals.css:39 |
| `--ag-grid-col` | `#ffffff` | #ffffff | `transparent` | #000000@0.00 | 0 | globals.css:40 |
| `--ag-border-card` | `#e7ecf3` | #e7ecf3 | `#2a3b57` | #2a3b57 | 66 | globals.css:42 |
| `--ag-hour-line` | `#eef1f6` | #eef1f6 | `rgba(255, 255, 255, .07)` | #ffffff@0.07 | 1 | globals.css:43 |
| `--ag-col-line` | `#f1f4f8` | #f1f4f8 | `rgba(255, 255, 255, .05)` | #ffffff@0.05 | 1 | globals.css:44 |
| `--ag-hairline` | `#eef1f6` | #eef1f6 | `rgba(255, 255, 255, .08)` | #ffffff@0.08 | 30 | globals.css:45 |
| `--ag-surface-sunken` | `#f7f9fb` | #f7f9fb | `#16233a` | #16233a | 19 | globals.css:53 |
| `--ag-line-dash` | `#c3ccd8` | #c3ccd8 | `rgba(255, 255, 255, .16)` | #ffffff@0.16 | 3 | globals.css:54 |
| `--ag-primary-bg-faint` | `#f5f8fc` | #f5f8fc | `rgba(91, 140, 255, .10)` | #5b8cff@0.10 | 16 | globals.css:55 |
| `--ag-ink` | `#15243e` | #15243e | `#e8eef6` | #e8eef6 | 97 | globals.css:57 |
| `--ag-text` | `#27364f` | #27364f | `#cdd8e6` | #cdd8e6 | 106 | globals.css:58 |
| `--ag-ink-600` | `#52627a` | #52627a | `#a8b4c2` | #a8b4c2 | 71 | globals.css:64 |
| `--ag-muted` | `#7c8aa0` | #7c8aa0 | `#8b9bb0` | #8b9bb0 | 117 | globals.css:65 |
| `--ag-muted2` | `#9aa6b8` | #9aa6b8 | `#6b7a90` | #6b7a90 | 34 | globals.css:66 |
| `--ag-faint` | `#aab4c4` | #aab4c4 | `#5d6b80` | #5d6b80 | 6 | globals.css:67 |
| `--ag-brand-primary` | `var(--cp, #1a3a5c)` | #1a3a5c | `— (no redefine)` | = | 19 | globals.css:70 |
| `--ag-brand-secondary` | `var(--cs, #1e5fa8)` | #1e5fa8 | `— (no redefine)` | = | 66 | globals.css:71 |
| `--ag-brand-legible` | `var(--ag-brand-secondary)` | #1e5fa8 | `color-mix(in srgb, var(--ag-brand-secondary) 55%, white)` | #83a7cf | 39 | globals.css:87 |
| `--ag-navy` | `hsl(from var(--cp, #1a3a5c) h s 20%)` | #163250 | `oklch(from var(--cp, #1a3a5c) 0.42 c h)` | #2f4f73 | 10 | globals.css:131 |
| `--ag-navy-ink` | `rgba(255,255,255,.55)` | #ffffff@0.55 | `rgba(255,255,255,.70)` | #ffffff@0.70 | 2 | globals.css:139 |
| `--ag-navy-ink-dim` | `rgba(255,255,255,.50)` | #ffffff@0.50 | `rgba(255,255,255,.65)` | #ffffff@0.65 | 4 | globals.css:140 |
| `--ag-navy-ink-strong` | `rgba(255,255,255,.80)` | #ffffff@0.80 | `rgba(255,255,255,.88)` | #ffffff@0.88 | 2 | globals.css:141 |
| `--ag-navy-ink-soft` | `rgba(255,255,255,.40)` | #ffffff@0.40 | `rgba(255,255,255,.52)` | #ffffff@0.52 | 2 | globals.css:142 |
| `--ag-navy-ink-activo` | `var(--cp, #1a3a5c)` | #1a3a5c | `rgba(255,255,255,.88)` | #ffffff@0.88 | 2 | globals.css:148 |
| `--ag-navy-logo-bg` | `#ffffff` | #ffffff | `— (no redefine)` | = | 2 | globals.css:167 |
| `--ag-now-line` | `#ef4444` | #ef4444 | `#f87171` | #f87171 | 1 | globals.css:172 |
| `--ag-now-pill-bg` | `#bc1010` | #bc1010 | `#d60b0b` | #d60b0b | 1 | globals.css:179 |
| `--ag-today-bg` | `#eff4f9` | #eff4f9 | `rgba(47, 111, 237, .10)` | #2f6fed@0.10 | 5 | globals.css:181 |
| `--ag-today-ring` | `#9ab7d8` | #9ab7d8 | `rgba(91, 140, 255, .30)` | #5b8cff@0.30 | 1 | globals.css:182 |
| `--ag-offhours-bg` | `rgba(120, 134, 158, .04)` | #78869e@0.04 | `rgba(0, 0, 0, .14)` | #000000@0.14 | 1 | globals.css:192 |
| `--ag-chip-bg` | `#eef1f6` | #eef1f6 | `#16233a` | #16233a | 4 | globals.css:201 |
| `--ag-chip-text` | `#7c8aa0` | #7c8aa0 | `#cdd8e6` | #cdd8e6 | 1 | globals.css:202 |
| `--ag-pulso` | `var(--ag-brand-secondary)` | #1e5fa8 | `#6b9bff` | #6b9bff | 1 | globals.css:235 |
| `--ag-month-cell` | `#ffffff` | #ffffff | `#141f33` | #141f33 | 1 | globals.css:322 |
| `--ag-month-weekend` | `#fafbfc` | #fafbfc | `#0e1828` | #0e1828 | 1 | globals.css:323 |
| `--ag-month-other-day` | `#f4f6f9` | #f4f6f9 | `#0c1422` | #0c1422 | 1 | globals.css:324 |
| `--ag-month-head` | `#f7f9fc` | #f7f9fc | `#101a2b` | #101a2b | 3 | globals.css:325 |
| `--ag-month-gap` | `#e7ecf3` | #e7ecf3 | `#22324c` | #22324c | 2 | globals.css:326 |
| `--ag-month-today-bg` | `color-mix(in srgb, var(--ag-brand-primary) 10%, white)` | #e8ebef | `color-mix(in srgb, var(--ag-brand-secondary) 12%, #0f1828)` | #112137 | 1 | globals.css:327 |
| `--ag-month-num` | `#64748b` | #64748b | `#8b9bb0` | #8b9bb0 | 1 | globals.css:328 |
| `--ag-month-more` | `var(--ag-brand-secondary)` | #1e5fa8 | `#8ab4f8` | #8ab4f8 | 1 | globals.css:338 |
| `--ag-month-today-ring` | `var(--ag-brand-secondary)` | #1e5fa8 | `#6b9bff` | #6b9bff | 5 | globals.css:339 |
| `--ag-segment-bg` | `#eef1f6` | #eef1f6 | `#16233a` | #16233a | 4 | globals.css:389 |
| `--ag-segment-active-bg` | `var(--ag-brand-secondary)` | #1e5fa8 | `— (no redefine)` | = | 2 | globals.css:390 |
| `--ag-segment-text` | `#7c8aa0` | #7c8aa0 | `#8b9bb0` | #8b9bb0 | 2 | globals.css:392 |
| `--ag-segment-active-text` | `#ffffff` | #ffffff | `— (no redefine)` | = | 7 | globals.css:393 |
| `--ag-status-scheduled-dot` | `#d97706` | #d97706 | `#fbbf24` | #fbbf24 | 5 | globals.css:456 |
| `--ag-status-scheduled-text` | `#b45309` | #b45309 | `#fcd34d` | #fcd34d | 3 | globals.css:456 |
| `--ag-status-scheduled-bg` | `#fef6e7` | #fef6e7 | `rgba(217, 119, 6, .18)` | #d97706@0.18 | 4 | globals.css:457 |
| `--ag-status-scheduled-border` | `#f4dfae` | #f4dfae | `rgba(251, 191, 36, .36)` | #fbbf24@0.36 | 2 | globals.css:457 |
| `--ag-status-confirmed-dot` | `#1e5fa8` | #1e5fa8 | `#6b9bff` | #6b9bff | 2 | globals.css:458 |
| `--ag-status-confirmed-text` | `#1e5fa8` | #1e5fa8 | `#a9c8ff` | #a9c8ff | 3 | globals.css:458 |
| `--ag-status-confirmed-bg` | `#eaf1f9` | #eaf1f9 | `rgba(30, 95, 168, .20)` | #1e5fa8@0.20 | 5 | globals.css:459 |
| `--ag-status-confirmed-border` | `#c7dcef` | #c7dcef | `rgba(107, 155, 255, .36)` | #6b9bff@0.36 | 2 | globals.css:459 |
| `--ag-status-cancelled-dot` | `#c0392b` | #c0392b | `#ef4444` | #ef4444 | 4 | globals.css:460 |
| `--ag-status-cancelled-text` | `#c0392b` | #c0392b | `#fca5a5` | #fca5a5 | 22 | globals.css:460 |
| `--ag-status-cancelled-bg` | `#fdf2f2` | #fdf2f2 | `rgba(192, 57, 43, .18)` | #c0392b@0.18 | 5 | globals.css:461 |
| `--ag-status-cancelled-border` | `#f3c9c9` | #f3c9c9 | `rgba(239, 68, 68, .36)` | #ef4444@0.36 | 6 | globals.css:461 |
| `--ag-status-no_show-dot` | `#64748b` | #64748b | `#9fb0c4` | #9fb0c4 | 2 | globals.css:462 |
| `--ag-status-no_show-text` | `#5a6b81` | #5a6b81 | `#c7d2e0` | #c7d2e0 | 2 | globals.css:462 |
| `--ag-status-no_show-bg` | `#f4f6f8` | #f4f6f8 | `rgba(120, 134, 158, .22)` | #78869e@0.22 | 3 | globals.css:463 |
| `--ag-status-no_show-border` | `#dfe5ec` | #dfe5ec | `rgba(148, 163, 184, .40)` | #94a3b8@0.40 | 3 | globals.css:463 |
| `--ag-status-attended-dot` | `#16a34a` | #16a34a | `#34d399` | #34d399 | 2 | globals.css:477 |
| `--ag-status-attended-text` | `#0f7a52` | #0f7a52 | `#7eecb4` | #7eecb4 | 1 | globals.css:477 |
| `--ag-status-attended-bg` | `#e9f7ef` | #e9f7ef | `rgba(22, 163, 74, .18)` | #16a34a@0.18 | 1 | globals.css:478 |
| `--ag-status-attended-border` | `#cfe6d6` | #cfe6d6 | `rgba(52, 211, 153, .34)` | #34d399@0.34 | 1 | globals.css:478 |
| `--ag-success-text` | `#157e3c` | #157e3c | `#7eecb4` | #7eecb4 | 12 | globals.css:496 |
| `--ag-success-bg` | `#e7f6ec` | #e7f6ec | `rgba(22, 163, 74, .18)` | #16a34a@0.18 | 9 | globals.css:497 |
| `--ag-success-border` | `#bfe6cb` | #bfe6cb | `rgba(52, 211, 153, .34)` | #34d399@0.34 | 6 | globals.css:498 |
| `--ag-aviso-text` | `#92400e` | #92400e | `#fcd38a` | #fcd38a | 11 | globals.css:505 |
| `--ag-aviso-bg` | `#fff7e8` | #fff7e8 | `rgba(217, 119, 6, .16)` | #d97706@0.16 | 8 | globals.css:506 |
| `--ag-aviso-border` | `#f2d9a6` | #f2d9a6 | `rgba(251, 191, 36, .34)` | #fbbf24@0.34 | 7 | globals.css:507 |
| `--ag-evento-indigo` | `#3730a3` | #3730a3 | `#818cf8` | #818cf8 | 1 | globals.css:561 |
| `--ag-evento-magenta` | `#a21caf` | #a21caf | `#e879f9` | #e879f9 | 1 | globals.css:562 |
| `--ag-evento-carmin` | `#9d174d` | #9d174d | `#f391ca` | #f391ca | 1 | globals.css:563 |
| `--ag-evento-oliva` | `#4d7c0f` | #4d7c0f | `#a3e635` | #a3e635 | 1 | globals.css:564 |
| `--ag-evento-bronce` | `#78350f` | #78350f | `#c98a4b` | #c98a4b | 1 | globals.css:565 |
| `--ag-evento-grafito` | `#1f2937` | #1f2937 | `#7f96b8` | #7f96b8 | 1 | globals.css:566 |
| `--ag-gcal-text` | `#6d4ec0` | #6d4ec0 | `#c4b5fd` | #c4b5fd | 8 | globals.css:569 |
| `--ag-gcal-border` | `#ddd0f5` | #ddd0f5 | `rgba(167, 139, 250, .36)` | #a78bfa@0.36 | 3 | globals.css:570 |
| `--ag-gcal-accent` | `#7c5cdb` | #7c5cdb | `#a78bfa` | #a78bfa | 4 | globals.css:571 |
| `--ag-gcal-bg1` | `#f3eefc` | #f3eefc | `rgba(124, 92, 219, .18)` | #7c5cdb@0.18 | 6 | globals.css:572 |
| `--ag-gcal-bg2` | `#efe9fb` | #efe9fb | `rgba(124, 92, 219, .12)` | #7c5cdb@0.12 | 0 | globals.css:573 |
| `--ag-modal-overlay` | `rgba(0, 0, 0, .40)` | #000000@0.40 | `rgba(2, 6, 14, .58)` | #02060e@0.58 | 3 | globals.css:577 |
| `--ag-modal-bg` | `#ffffff` | #ffffff | `#152135` | #152135 | 6 | globals.css:578 |
| `--ag-input-bg` | `#ffffff` | #ffffff | `#16233a` | #16233a | 21 | globals.css:579 |
| `--ag-input-border` | `#e2e8f0` | #e2e8f0 | `#2a3b57` | #2a3b57 | 39 | globals.css:580 |
| `--ag-input-focus-border` | `#93b4d8` | #93b4d8 | `#5b8cff` | #5b8cff | 14 | globals.css:582 |
| `--ag-modal-icon-bg` | `#eff4f9` | #eff4f9 | `#1f2f48` | #1f2f48 | 5 | globals.css:583 |
| `--ag-btn-ghost-hover` | `#f1f5f9` | #f1f5f9 | `#1f2f48` | #1f2f48 | 34 | globals.css:584 |
| `--ag-control-bg` | `#f3f6fa` | #f3f6fa | `#23344f` | #23344f | 6 | globals.css:589 |
| `--ag-control-bg-hover` | `#e6ebf2` | #e6ebf2 | `#2b3e5c` | #2b3e5c | 7 | globals.css:590 |
| `--ag-control-border` | `#76849a` | #76849a | `#7388a6` | #7388a6 | 13 | globals.css:591 |
| `--ag-control-primario-border` | `#1e5fa8` | #1e5fa8 | `#5b8fd6` | #5b8fd6 | 5 | globals.css:592 |
| `--ag-patient-card-bg` | `#eff4f9` | #eff4f9 | `rgba(47, 111, 237, .12)` | #2f6fed@0.12 | 4 | globals.css:593 |
| `--ag-patient-card-border` | `#c9dcfb` | #c9dcfb | `rgba(91, 140, 255, .36)` | #5b8cff@0.36 | 4 | globals.css:594 |

#### --lp-* (landing pública — fuera de alcance, se lista por completitud) — 33 tokens de color

| Token | Claro (declarado) | Claro resuelto | Oscuro (declarado) | Oscuro resuelto | Usos `var()` | Def. |
|---|---|---|---|---|---|---|
| `--lp-ink-900` | `#14345c` | #14345c | `— (no redefine)` | = | 32 | globals.css:654 |
| `--lp-ink-700` | `#3b4a5c` | #3b4a5c | `— (no redefine)` | = | 18 | globals.css:655 |
| `--lp-ink-500` | `#5a6b81` | #5a6b81 | `— (no redefine)` | = | 47 | globals.css:656 |
| `--lp-navy` | `#1a3a5c` | #1a3a5c | `— (no redefine)` | = | 15 | globals.css:659 |
| `--lp-accent` | `#1e5fa8` | #1e5fa8 | `— (no redefine)` | = | 65 | globals.css:660 |
| `--lp-accent-bg` | `#eff6ff` | #eff6ff | `— (no redefine)` | = | 8 | globals.css:667 |
| `--lp-surface` | `#ffffff` | #ffffff | `— (no redefine)` | = | 25 | globals.css:670 |
| `--lp-surface-alt` | `#f5f8fc` | #f5f8fc | `— (no redefine)` | = | 9 | globals.css:671 |
| `--lp-surface-sunken` | `#f8fafc` | #f8fafc | `— (no redefine)` | = | 4 | globals.css:672 |
| `--lp-wash` | `color-mix(in srgb, var(--lp-accent) 4%, #fff)` | #f6f9fc | `— (no redefine)` | = | 3 | globals.css:681 |
| `--lp-chrome-close` | `#ff5f57` | #ff5f57 | `— (no redefine)` | = | 2 | globals.css:693 |
| `--lp-chrome-min` | `#febc2e` | #febc2e | `— (no redefine)` | = | 2 | globals.css:694 |
| `--lp-chrome-max` | `#28c840` | #28c840 | `— (no redefine)` | = | 2 | globals.css:695 |
| `--lp-border` | `#e6ebf2` | #e6ebf2 | `— (no redefine)` | = | 33 | globals.css:697 |
| `--lp-border-strong` | `#cad5e2` | #cad5e2 | `— (no redefine)` | = | 2 | globals.css:698 |
| `--lp-border-inverse` | `rgb(255 255 255 / .30)` | #ffffff@0.30 | `— (no redefine)` | = | 4 | globals.css:699 |
| `--lp-border-control` | `#7d8ea3` | #7d8ea3 | `— (no redefine)` | = | 5 | globals.css:739 |
| `--lp-border-control-inverse` | `rgb(255 255 255 / .40)` | #ffffff@0.40 | `— (no redefine)` | = | 3 | globals.css:740 |
| `--lp-ink-inverse` | `#ffffff` | #ffffff | `— (no redefine)` | = | 42 | globals.css:743 |
| `--lp-ink-inverse-70` | `rgb(255 255 255 / .70)` | #ffffff@0.70 | `— (no redefine)` | = | 18 | globals.css:744 |
| `--lp-ink-inverse-50` | `rgb(255 255 255 / .50)` | #ffffff@0.50 | `— (no redefine)` | = | 1 | globals.css:755 |
| `--lp-surface-inverse-5` | `rgb(255 255 255 / .05)` | #ffffff@0.05 | `— (no redefine)` | = | 6 | globals.css:756 |
| `--lp-surface-inverse-10` | `rgb(255 255 255 / .10)` | #ffffff@0.10 | `— (no redefine)` | = | 8 | globals.css:757 |
| `--lp-danger` | `#c0392b` | #c0392b | `— (no redefine)` | = | 1 | globals.css:800 |
| `--lp-danger-ink` | `#8c2f2f` | #8c2f2f | `— (no redefine)` | = | 1 | globals.css:801 |
| `--lp-danger-bg` | `#fdf2f2` | #fdf2f2 | `— (no redefine)` | = | 1 | globals.css:802 |
| `--lp-danger-border` | `#f3c9c9` | #f3c9c9 | `— (no redefine)` | = | 1 | globals.css:803 |
| `--lp-warn` | `#b45309` | #b45309 | `— (no redefine)` | = | 1 | globals.css:805 |
| `--lp-warn-strong` | `#d97706` | #d97706 | `— (no redefine)` | = | 1 | globals.css:806 |
| `--lp-warn-bg` | `#fef6e7` | #fef6e7 | `— (no redefine)` | = | 1 | globals.css:807 |
| `--lp-warn-border` | `#f4dfae` | #f4dfae | `— (no redefine)` | = | 1 | globals.css:808 |
| `--lp-hover-surface` | `#f1f5f9` | #f1f5f9 | `— (no redefine)` | = | 4 | globals.css:811 |
| `--lp-focus` | `var(--lp-accent)` | #1e5fa8 | `— (no redefine)` | = | 2 | globals.css:823 |

### 1.3 Tokens que NO son de color (resumen)

| Grupo | `--sp-*` | `--ag-*` |
|---|---|---|
| Espaciado | `--sp-1`…`--sp-12` (20 escalones, 4–48 px, `spinus-tokens.css:330-…`) + alias semánticos `--sp-gap-*`, `--sp-pad-*` | `--ag-1`…`--ag-8` (11 escalones, 4–32 px, `globals.css:250-…`) |
| Radios | 15 tokens `--sp-r-*` (6–20 px + 999) | 5 tokens `--ag-r-*` (6, 8, 10, 12, 999) |
| Sombras | 9 `--sp-shadow-*` + `--sp-focus-ring` + `--sp-primary-shadow-press` | `--ag-shadow-card`, `--ag-shadow-pop`, `--ag-shadow-elevada` |
| Movimiento | `--sp-dur-*` (7), `--sp-ease-*` (4) | `--ag-dur-*` (3), `--ag-ease*` (3) |
| Tipografía | `--sp-fs-*` (25), `--sp-lh-*`, `--sp-ls-*`, `--sp-fw-*` | ninguno (tamaños en px literales) |
| Geometría | `--sp-tap` 44 px (43 usos), `--sp-ctrl-h-*`, `--sp-modal-w-*` (0 usos), `--sp-sidebar-w` (0 usos) | `--ag-rail-w`, `--ag-slot-h` |

---

## 2. Modo oscuro

### 2.1 Mecanismo [V]

- **Selector:** clase `dark` en `<html>` (`html.dark …`). No hay `data-theme`, ni `@custom-variant dark` de Tailwind, ni `@media (prefers-color-scheme)` en la app. La variante `dark:` de Tailwind **no se usa** (0 clases; las 4 coincidencias del barrido son `dark:` de objetos JS).
- **Dónde se decide:** el interruptor está en el menú lateral (`Sidebar.tsx:296`, botón en `:799-802`) y llama a `toggle()` de `ThemeProvider.tsx:79-92`. No sigue la preferencia del sistema: por defecto es claro.
- **Qué se persiste:** `localStorage['theme']` = `'dark'` | `'light'` (`ThemeProvider.tsx:83`). Nada en servidor ni en el perfil: es por navegador/dispositivo.
- **Antes del primer pintado:** `ScriptTema.tsx:38` (script en línea, sin `defer`) lee `localStorage` y añade la clase. Lo montan solo `(app)/layout.tsx:141` y `(launcher)/layout.tsx:20`; las rutas públicas no, a propósito (`ScriptTema.tsx:9-22`).
- **Barra del navegador:** `ThemeProvider.tsx:33-58` reescribe `<meta name="theme-color">` con `--ag-navy` resuelto; `layout.tsx:59-60` declara los valores estáticos #163250 / #2f4f73.
- **Fuga conocida [V por comentario, no reproducida]:** la clase `dark` no se retira al salir de `(app)` (nota en `landing/sections/SeccionProblema.tsx:64`).

### 2.2 Cuatro capas, dos paletas [V]

| Capa | Dónde | Cómo | Paleta oscura |
|---|---|---|---|
| A. Hoja de traducción de clases literales | `ThemeProvider.tsx:155-299` (inyectada como `<style>`) + «Ampliación» en `globals.css:7466-7684` | Reglas `html.dark .bg-white { … !important }` clase por clase. **325 selectores de clase** entre las dos mitades. También fuerza `input/textarea/select` (`ThemeProvider.tsx:218-225`) y anula `shadow-sm/md` (`:221-225`). | Material neutro: página #121212, card #1E1E1E, hundido #242424, elevado #2C2C2C, #383838; tinta blanco al 87/75/60/50/38/28 %. |
| B. Tokens `--sp-*` | `spinus-tokens.css:487-697` + `@supports` `:753-815` | Redefinición de custom properties. 107 tokens. Derivada explícitamente de la capa A («cada token cita su origen», `:480-486`). Marca: `oklch(from var(--cs) 0.55 c h)`. | La misma Material neutra (#121212 / #1e1e1e). |
| C. Tokens `--ag-*` | `globals.css:6759-7060` + `@supports` `:7074` | Redefinición de custom properties. 97 tokens. | **Azul marino**: `--ag-bg-app` #0c1420, `--ag-bg-main` #0f1828, `--ag-surface` #1b2a40, `--ag-border-card` #2a3b57, tinta #e8eef6 / #cdd8e6. |
| D. `/inicio` (launcher) | `launcher/TemaLauncher.tsx:63-68` y cada bloque de `(launcher)/inicio/page.tsx` | Booleano `dark` leído de la clase; cada componente elige color en JS. No monta la hoja A a propósito (`TemaLauncher.tsx:15-21`). | Propia: fondo #020617 (slate-950) y clases `bg-slate-900`, `border-slate-700/800`. |

Consecuencias verificadas en el propio código:
- **La agenda en oscuro mezcla las dos paletas.** Su tarjeta contenedora es un `.bg-white` que la capa A repinta a #1E1E1E; encima van popovers, inputs y chips en azul marino `--ag-surface` #1b2a40. Lo documentan `globals.css:6811-6817` y `:6890-6893` («todo esto se compone sobre #1E1E1E, no sobre --ag-bg-main»).
- **El orden de las dos mitades de la hoja A importa:** el `<style>` de ThemeProvider se inserta después de `globals.css`, así que a igual peso gana él (`ThemeProvider.tsx:252-261`, `globals.css:~7475-7480`).
- **Variantes Tailwind no heredan la traducción:** `hover:bg-slate-50`, `disabled:bg-slate-50`, `md:bg-white`, `bg-slate-50/80` son clases distintas y necesitan regla propia (`globals.css` «6 · variantes de estado»). Cualquier clase literal nueva que no esté en la lista queda sin oscuro.
- `--background`/`--foreground`, `--ag-brand-primary/secondary`, `--ag-segment-active-*`, `--sp-on-primary`, `--sp-bezel`, `--sp-alergia-*` y todos los radios/espaciados no cambian en oscuro (los tres primeros de marca, deliberado).

### 2.3 Qué proporción de la app lo respeta [V, barrido]

Por **archivo** (250 `.tsx` en alcance):

| Situación | Archivos | % |
|---|---|---|
| Sin color propio (ni literales ni `var()`) | 71 | 28 % |
| Solo tokens (`var(--…)`), cero literales | 90 | 36 % |
| Mixtos (tokens + literales) | 49 | 20 % |
| Solo literales, cero tokens | 40 | 16 % |

Por **uso** (excluido `ThemeProvider.tsx`, que es la propia hoja):

| Tipo de color | Usos | Con regla `html.dark` | Sin regla |
|---|---|---|---|
| `var(--token)` en TSX | 2 865 | sigue al token (salvo los que no redefinen) | — |
| Clases Tailwind de paleta (`bg-white`, `text-slate-500`, `bg-red-50`…) | 1 424 | 1 176 (83 %) | 248 (17 %) |
| Clases con color arbitrario (`text-[#86868b]`, `bg-[#1e5fa8]`…) | 402 | 216 (54 %) | 186 (46 %) |
| Hex literal fuera de clase (`style={{color:'#…'}}`, constantes JS, SVG) | 103 | 0 | 103 |
| `rgb()/rgba()` literal fuera de clase | 28 | 0 | 28 |

Lectura:
- De las 248 clases de paleta sin regla, ~150 son blanco/negro con o sin alfa sobre fondos de color (`text-white` 86, `bg-black/40` 12, `hover:text-white` 8, `bg-white/15` 7, `hover:bg-white/10` 7…), que **[I]** no necesitan cambiar. El resto real: `text-red-400` (12), `focus:ring-emerald-500/30` (8), `text-slate-100`, `bg-slate-900`, `border-slate-700/800` (launcher, capa D), rellenos sólidos `bg-red-600`/`bg-emerald-600`.
- De los 186 arbitrarios sin regla, los más repetidos: variantes con prefijo o tipo no cubierto de `#1e5fa8`/`#1a3a5c` (`ring-`, `from-`, `to-`, `focus:border-`, `group-hover:`), y `text-[#3d3d3f]` (18 usos, sin regla — reconocido en `layout/Breadcrumbs.tsx:51`).
- «Tiene regla» ≠ «pertenece a la paleta de tokens»: los literales traducidos aterrizan en Material neutro, coherentes con `--sp-*` pero no con `--ag-*`.
- En resumen **[I]**: ~95 % de los usos de color cambia de algún modo en oscuro; lo que no existe es una fuente única — el resultado depende de qué capa alcance a cada elemento.

Familias Tailwind usadas (clases de paleta, con ThemeProvider): slate 764 · white 250 · red 148 · amber 106 · emerald 82 · blue 48 · violet 22 · black 18 · teal 14 · rose 13 · sky 4 · gray 3 · indigo/orange/green 1.

Clases literales más usadas: `text-slate-400` 119 · `border-slate-200` 118 · `bg-white` 113 · `text-slate-500` 98 · `text-white` 94 · `bg-slate-50` 74 · `text-slate-700` 59 · `border-slate-100` 50 · `bg-slate-100` 48 · `text-slate-600` 47 · `text-red-500` 40.

Hex arbitrarios en clases: `#1e5fa8` 168 · `#86868b` 103 · `#1d1d1f` 47 · `#1a3a5c` 46 · `#3d3d3f` 18 · `#1a4f8c` 4 · `#0f2540` 3. (`#1d1d1f`/`#86868b` son los grises de texto de macOS: una **cuarta** escala de tinta, no azulada.)

### 2.4 Los 15 archivos con más literales [V]

Total = clases de paleta + clases arbitrarias + hex + rgb. Entre paréntesis, los que no tienen regla oscura.

| # | Archivo | Total | Paleta (sin regla) | Arbitrarias (sin regla) | Hex / rgb sueltos | `var()` |
|---|---|---|---|---|---|---|
| 1 | `src/app/(app)/expediente/page.tsx` | 104 | 48 (3) | 56 (23) | 0 | 0 |
| 2 | `src/app/(app)/admin/usuarios/page.tsx` | 92 | 49 (4) | 37 (10) | 6 | 2 |
| 3 | `src/components/launcher/ConsultaRapidaModal.tsx` | 90 | 75 (8) | 15 (13) | 0 | 0 |
| 4 | `src/components/CommandPalette.tsx` | 85 | 74 (9) | 11 (9) | 0 | 0 |
| 5 | `src/components/onboarding/OnboardingModal.tsx` | 85 | 84 (7) | 0 | 1 | 3 |
| 6 | `src/app/(app)/pacientes/nuevo/page.tsx` | 83 | 59 (7) | 24 (9) | 0 | 0 |
| 7 | `src/components/ui/QuickPatientModal.tsx` | 76 | 65 (16) | 11 (0) | 0 | 0 |
| 8 | `src/app/(app)/billing/page.tsx` | 66 | 54 (4) | 12 (7) | 0 | 0 |
| 9 | `src/app/(launcher)/inicio/page.tsx` | 66 | 47 (25) | 15 (6) | 4 | 0 |
| 10 | `src/components/taller-v2/TallerV2.tsx` | 60 | 54 (27) | 2 (2) | 4 | 0 |
| 11 | `src/components/expediente/SheetFiltrosExpediente.tsx` | 53 | 19 (3) | 34 (20) | 0 | 0 |
| 12 | `src/components/labs/ModalSubirDocumento.tsx` | 53 | 52 (1) | 0 | 1 | 1 |
| 13 | `src/components/labs/ModalAgregarMedicion.tsx` | 53 | 53 (3) | 0 | 0 | 18 |
| 14 | `src/app/(app)/ayuda/page.tsx` | 52 | 40 (6) | 9 (1) | 3 | 8 |
| 15 | `src/components/perfil/FirmaCaptura.tsx` | 52 | 31 (2) | 16 (9) | 5 | 0 |

(`ThemeProvider.tsx` encabezaría la lista con 147, pero es la hoja de traducción. Siguen: `documentos/page.tsx` 46, `expediente/[id]/consulta/[consultaId]/page.tsx` 44, `nueva-nota/page.tsx` 41, `estadisticas/page.tsx` 40 —21 hex de gráficas—.)

Por módulo (literales totales → `var()` en TSX): `app/(app)/expediente` 247 → 75 · `components/ui` 183 → 65 · `components/labs` 169 → 271 · `components/agenda` 112 → 819 · `components/expediente` 110 → 780 · `components/launcher` 99 → 1 · `app/(app)/admin` 92 → 2 · `CommandPalette` 85 → 0 · `components/onboarding` 85 → 3 · `app/(app)/pacientes` 83 → 0 · `app/(app)/billing` 66 → 0 · `(launcher)/inicio` 66 → 0 · `components/taller-v2` 62 → 0 · `components/perfil` 57 → 243 · `app/(app)/documentos` 48 → 0 · `components/dashboard` **0 → 289** · `app/(app)/dashboard` 20 → 102.

Literales dentro de las hojas CSS (fuera de las declaraciones de token y de la hoja de traducción): `globals.css` 62 hex + 46 `rgba()` en reglas (los más repetidos #fff 14, #f1f5f9 5, #1a3a5c 4); `spinus-tokens.css` 8 hex + 6 `rgba()`. La hoja de traducción en `globals.css` suma otros ~115 literales.

---

## 3. Colores semánticos de estado

### 3.1 Estados de cita [V]

Fuente única: `--ag-status-{estado}-{dot|text|bg|border}` (`globals.css:456-~480` claro, `:6904-~6918` oscuro).

| Estado | dot | text | bg | border | Oscuro (dot / text / bg) |
|---|---|---|---|---|---|
| Agendada (`scheduled`) | #d97706 | #b45309 | #fef6e7 | #f4dfae | #fbbf24 / #fcd34d / rgba(217,119,6,.18) |
| Confirmada (`confirmed`) | #1e5fa8 | #1e5fa8 | #eaf1f9 | #c7dcef | #6b9bff / #a9c8ff / rgba(30,95,168,.20) |
| Atendida (`attended`) | #16a34a | #0f7a52 | #e9f7ef | #cfe6d6 | #34d399 / #7eecb4 / rgba(22,163,74,.18) |
| Cancelada (`cancelled`) | #c0392b | #c0392b | #fdf2f2 | #f3c9c9 | #ef4444 / #fca5a5 / rgba(192,57,43,.18) |
| Inasistencia (`no_show`) | #64748b | #5a6b81 | #f4f6f8 | #dfe5ec | #9fb0c4 / #c7d2e0 / rgba(120,134,158,.22) |

- **Consistencia agenda ↔ dashboard: sí** [V]. El dashboard no redefine nada: `dashboard/ProximasCitas.tsx:158-174` (leyenda con los cinco `-dot`), `app/(app)/dashboard/StatusChip.tsx:35,47` (chips `confirmed`/`scheduled`) y `dashboard/HoyEnConsultorio.tsx:41` leen los mismos tokens.
- **Expediente:** no pinta estados de cita con color propio [V parcial]: `expediente/[id]/page.tsx:166-176` solo consulta la próxima cita (`scheduled`/`confirmed`); no encontré chips de estado ahí. `/inicio` filtra por estado pero no los colorea (`inicio/page.tsx:147`).
- «Confirmada» es un **literal** #1e5fa8, no `var(--cs)`: coincide con la marca de fábrica pero no sigue a una clínica con otra paleta (deliberado según `globals.css:~80-88`).
- Colores de evento (no estado): `--ag-evento-indigo/magenta/carmin/oliva/bronce/grafito` y Google Calendar `--ag-gcal-*` (violeta #6d4ec0 / #7c5cdb).

### 3.2 Éxito / aviso / error / info — **no es consistente entre módulos** [V]

| Rol | `--sp-*` (expediente, dashboard, perfil, labs) | `--ag-*` (agenda) | Literales Tailwind (ui/, modales, páginas viejas; Toast) | `--sem-*` (muerto) |
|---|---|---|---|---|
| Éxito — tinta | `--sp-success` #16a34a · `--sp-success-strong` #0f7a52 | `--ag-success-text` #157e3c (≠) · attended-text #0f7a52 | `text-emerald-600` #059669 (18), `-700`, `-800` (Toast) | #34c759 |
| Éxito — fondo / borde | #e9f7ef / #cfe6d6 | #e7f6ec / #bfe6cb (≠ por poco) | `bg-emerald-50` #ecfdf5 / `border-emerald-200` | — |
| Aviso — tinta | `--sp-warn` #b45309 · `--sp-warn-strong` #d97706 | `--ag-aviso-text` #92400e (≠) · scheduled-text #b45309 | `text-amber-700` #b45309 (15), `-800` #92400e (14), `-600` (12) | #ff9500 |
| Aviso — fondo / borde | #fef6e7 / #f4dfae | #fff7e8 / #f2d9a6 (≠ por poco) | `bg-amber-50` #fffbeb (21) / `border-amber-200` | — |
| Error — tinta | `--sp-danger` #c0392b (67 usos) · `-strong` #a02525 · `-ink` #8c2f2f | cancelled-text #c0392b (=) | `text-red-500` #ef4444 (40), `text-red-600` #dc2626 (24), `-700` (12), `-400` (12) | #ff3b30 |
| Error — fondo / borde | #fdf2f2 / #f3c9c9 | #fdf2f2 / #f3c9c9 (=) | `bg-red-50` #fef2f2 (26) / `border-red-200` (13) | — |
| Info | **no hay token**: se usa la marca (`--sp-primary-bg*`, `--sp-primary-text`) | **no hay token**: `--ag-primary-bg-faint`, `--ag-brand-legible` | `bg-blue-50 border-blue-200 text-blue-800` (Toast, `ui/Toast.tsx:53-58`) | — |

- **Error** es el único rol idéntico entre `--sp` y `--ag` (#c0392b, rojo ladrillo); los literales usan el rojo Tailwind (#ef4444/#dc2626), más saturado.
- **Éxito** tiene 4 verdes de tinta distintos (#16a34a, #0f7a52, #157e3c, #059669) y **aviso** 3 ámbar (#b45309, #92400e, #d97706).
- **Info** no existe como semántico tokenizado; en los módulos tokenizados es el color de marca (cambia con la clínica). El Toast usa azul Tailwind fijo **a propósito** para no depender de la marca (`ui/Toast.tsx:39-51`).
- Reparto de literales semánticos (clases `bg|text|border-{fam}-N`): rojo — agenda 16, dashboard 0, expediente+labs 33, muestra del resto (ui, onboarding, launcher, pacientes, admin, billing, CommandPalette) 61; ámbar — 0 / 0 / 8 / 60; esmeralda — 7 / 4 / 1 / 51; azul — 5 / 2 / 9 / 20.
- Semánticos clínicos propios de `--sp`: signos vitales `--sp-vital-ok/watch/out` (#17976a / #c07d10 / #c62f3b), alergia `--sp-alergia-bg` #c0392b, tipo de documento `--sp-doc-*` (8 colores), 10 pares de avatar.

---

## 4. Radios, sombras y espaciado

### 4.1 Radios — escala real [V]

**Tokens:** `--sp-r-*`: checkbox 6 · note 8 · btn-sm 8 · btn-xs 9 · field-sm 9 · btn 10 · field 10 · icon-md 11 · input 12 · cta 12 · card-inner 13 · icon-lg 15 · card 16 · modal 20 · pill 999. `--ag-r-*`: note 6 · btn-sm 8 · btn 10 · card 12 · pill 999.

**En TSX (756 clases `rounded-*` + 28 en línea):**

| Radio efectivo | Clases | Usos |
|---|---|---|
| 12 px | `rounded-xl` 254 · `rounded-[12px]` 14 · `--ag-r-card` 4 | **272** |
| 999 / full | `rounded-full` 103 · `--sp-r-pill` 36 · `--ag-r-pill` 1 | 140 |
| 8 px | `rounded-lg` 75 · `--sp-r-btn-sm` 20 · `rounded-[8px]` 8 · `--ag-r-btn-sm` 3 · `--sp-r-note` 1 | 107 |
| 16 px | `rounded-2xl` 55 · `--sp-r-card` 24 (+1 `rounded-b`) · `rounded-[16px]` 2 | 82 |
| 10 px | `rounded-[10px]` 23 · `--ag-r-btn` 16 · `--sp-r-btn` 14 · `--sp-r-field` 8 | 61 |
| 4 px | `rounded` 22 · `rounded-[4px]` 1 | 23 |
| 14 px | `rounded-[14px]` | 17 |
| 13 px | `--sp-r-card-inner` | 12 |
| 9 / 11 px | `rounded-[9px]` 4 · `--sp-r-field-sm` 3 · `--sp-r-icon-md` 7 | 14 |
| 6 px | `rounded-md` 6 · `rounded-[6px]` 1 · `--sp-r-checkbox` 1 | 8 |
| 24 px | `rounded-3xl` | 3 |
| otros | 22 px ×2 · 20 px ×2 (uno `--sp-r-modal`) · 18 px ×1 · 15 px ×1 · 7 px ×2 · 3 px ×1 · `rounded-none` 5 · `rounded-sm` 2 | 16 |

**En CSS:** `globals.css` 83 declaraciones, 48 con token `--ag-r-*` (btn 19, btn-sm 11, card 8, pill 7, note 4) y el resto literal (50 % ×9, 999px ×5, 6px ×5, 0 ×3, 3/2/5/8/10/12/18 px sueltos). `spinus-tokens.css` 51, de ellas 38 con `--sp-r-*`.

Lectura: **17 radios distintos en uso**. El dominante es 12 px (Tailwind `rounded-xl`, no tokenizado); la escala tokenizada (`rounded-[var(--…)]`) cubre ~165 de 756 clases (22 %). El radio de tarjeta difiere por sistema: `--sp-r-card` 16, `--ag-r-card` 12, y en pantallas literales conviven `rounded-xl` (12) y `rounded-2xl` (16).

### 4.2 Sombras [V]

**Tokens (claro → oscuro):**

| Token | Claro | Oscuro | Usos |
|---|---|---|---|
| `--sp-shadow-flat` | `0 1px 2px rgba(16,42,73,.04)` | `none` | 9 |
| `--sp-shadow-raised` | `0 6px 22px` marca 9 % | `none` | 5 |
| `--sp-shadow-raised-ok` | `0 6px 22px rgba(15,122,82,.10)` | `none` | 1 |
| `--sp-shadow-btn` / `-lg` / `-m` | `0 8px 20px` marca 28 % / `0 10px 24px` 30 % / `0 8px 18px` 28 % | `none` | 2 / 1 / 0 |
| `--sp-primary-shadow-press` | `0 4px 12px` marca 24 % | `none` | 1 |
| `--sp-shadow-modal` | `0 40px 90px rgba(10,25,45,.45)` | `0 20px 40px rgba(0,0,0,.8)` | 1 |
| `--sp-shadow-frame` | `0 30px 80px rgba(16,42,73,.16)` | `0 20px 40px rgba(0,0,0,.8)` | 0 |
| `--sp-focus-ring` | `0 0 0 4px var(--sp-primary-focus)` | (cambia el color) | 4 |
| `--ag-shadow-card` | `0 1px 2px rgba(16,32,64,.05)` | `0 1px 3px rgba(0,0,0,.45)` | 5 |
| `--ag-shadow-pop` | `0 12px 28px rgba(16,32,64,.14)` | `0 12px 28px rgba(0,0,0,.55)` | 7 |
| `--ag-shadow-elevada` | `0 0 0 1px rgba(16,32,64,.12), 0 6px 14px rgba(16,32,64,.16)` | anillo blanco 14 % + `0 6px 14px rgba(0,0,0,.55)` | 1 |

**Clases en TSX (118):** `shadow-sm` 61 · `shadow-lg` 14 · `shadow-2xl` 12 · `shadow-[var(--sp-shadow-flat)]` 7 · `shadow` 5 · `shadow-[var(--sp-shadow-raised)]` 3 · `shadow-xl` 2 · `shadow-[var(--ag-shadow-pop)]` 2 · `shadow-md` 1 · `shadow-[var(--sp-shadow-modal)]` 1 · **11 sombras arbitrarias únicas** (p. ej. `0_4px_20px_rgba(30,95,168,0.08)`, `0_12px_40px_rgba(26,58,92,0.3)`, `0_8px_40px_rgba(0,0,0,0.12)`, `0_8px_32px_rgba(212,175,55,0.08)`).
**En línea (TSX):** 18 declaraciones, 14 distintas (p. ej. `0 30px 80px rgba(16,32,64,.28)` ×2, `0 1px 2px rgba(16,42,67,.04), 0 12px 30px -22px rgba(16,42,67,.35)`).
**En CSS:** `globals.css` 33 declaraciones / 24 valores distintos (9 con token; el resto anillos `inset`, halos de animación y dos sombras de FullCalendar con `!important`); `spinus-tokens.css` 19 / 12 (literales repetidos: `0 12px 28px rgba(16,42,73,.14)` ×2).

Lectura: ~14 sombras tokenizadas + 6 niveles Tailwind + ~25 literales únicos. En oscuro `--sp-*` **elimina** las sombras (elevación por color, criterio Material) y la capa A anula `shadow-sm/md` y oscurece `shadow-xl` (`ThemeProvider.tsx:234-238`); `shadow-lg` y `shadow-2xl` (26 usos) quedan como en claro. `--ag-*` las conserva, más opacas.

### 4.3 Espaciado [V]

- **Sí hay escala tokenizada, y son dos idénticas en sus valores comunes:**
  - `--ag-1…--ag-8` (`globals.css:250-…`): 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32 px. 267 usos (más usados: `--ag-2` 56, `--ag-3` 52, `--ag-1` 42).
  - `--sp-1…--sp-12` (`spinus-tokens.css:330-…`): 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48 px. ~550 usos (`--sp-2` 103, `--sp-3` 102, `--sp-4` 87, `--sp-2-5` 76); cinco escalones con 0 usos (7-5, 8-5, 9, 11, 12). Más alias: `--sp-gap-tiles` 21, `--sp-gap-item` 21, `--sp-gap-band` 19, `--sp-gap-block` 18, `--sp-pad-row-x` 14.
- **¿Se usa `--ag-N` fuera de la agenda? No, dentro del alcance** [V]. En TSX solo `components/agenda` (86 `var(--ag-N)` + 28 `var(--ag-r-*)`); en `globals.css` las 124 apariciones están en selectores `.ag-*` / `.agenda-*` / `.fc`. El único consumidor externo es `agendaPublica.css` (fuera de alcance). Sidebar, dashboard y avisos toman de `--ag-*` colores, no espaciado.
- **`--sp-N` en TSX:** `components/expediente` 212 · `components/labs` 66 · `components/perfil` 63 · `components/dashboard` 59 · `app/(app)/perfil` 26 · `app/(app)/expediente` 11 · `app/(app)/dashboard` 8 · `components/documentos` 8 · `components/ui` 7. Cero en agenda.
- **Lo dominante sigue siendo la escala de Tailwind** (`p-4`, `gap-2`, `px-3`…): ~3 300 utilidades de padding/margen/gap en alcance (agenda 681, expediente 362+362, labs 234, ui 171, perfil 125+59, dashboard 110+65). Además, px literales en CSS: 131 declaraciones de padding/margin/gap en `globals.css`, 92 en `spinus-tokens.css`.

---

## 5. Comparación con la paleta de las maquetas

Distancia = ΔE*ab (CIE76) calculada por mí; <1 imperceptible, 1–2.5 apenas, 2.5–5 visible lado a lado, >5 claramente otro color. «Por rol» = el token que hoy cumple esa función; «por valor» = el más parecido aunque hoy sirva a otra cosa.

### 5.1 Tabla «se reutiliza / cambia / falta»

| Valor de maqueta | Token actual por ROL | Δ | Token más próximo por VALOR | Δ | Veredicto |
|---|---|---|---|---|---|
| Navy navegación **#1B2B4A** | `--ag-navy` #163250 (= `hsl(from --cp h s 20%)`, `globals.css:131,883`) | 4.6 | `--ag-ink` #15243e 4.6 · `--sp-ink-800` #173156 4.8 · `--cp` #1a3a5c 7.5 | — | **Cambia** (cercano). El actual es más verdoso/saturado y **deriva de la marca de la clínica**; el de la maqueta es fijo. |
| Azul acción **#2F5AA8** | `--sp-primary` / `--ag-brand-secondary` = `--cs` #1e5fa8 | 5.6 | el mismo | 5.6 | **Cambia** (cercano; el de la maqueta es más violáceo). Mismo matiz de variabilidad por clínica. |
| Fondo de página **#F2F4F8** | `--background` #f8fafc (body) 2.3 · `--sp-app-bg` #f5f8fc 1.4 · `--ag-bg-app` #eef1f5 1.2 | 1.2–2.3 | `--sp-surface-empty` / `--ag-col-line` #f1f4f8 | 0.4 | **Cambia** (leve). Hoy hay tres fondos de página distintos; el valor casi exacto existe pero en otro rol. |
| Texto principal **#14213D** | `--ag-ink` #15243e | 2.3 | el mismo | 2.3 | **Se reutiliza** en agenda. En `--sp` el equivalente es `--sp-ink-800` #173156 (Δ 9.2) y en literales `--foreground`/slate-800 #1e293b (Δ 8.3): **cambia**. |
| Texto secundario **#5B6478** | `--ag-ink-600` #52627a 3.5 · `--sp-ink-500` #5a6b81 3.7 | 3.5 | — | — | **Cambia** (cercano; más neutro). Literales: slate-500 #64748b (Δ 6.6), `#86868b` (Δ 16.8). |
| Tarjeta **#FFFFFF** | `--sp-surface`, `--ag-surface`, `bg-white` | 0 | — | 0 | **Se reutiliza.** |
| Campo de búsqueda **#E6EAF1** | `--sp-surface-muted` #eef2f7 2.9 · `--ag-control-bg` #f3f6fa 4.5 · `bg-slate-100` #f1f5f9 4.1 | 2.9 | `--ag-control-bg-hover` / `--sp-line-card` #e6ebf2 | 0.4 | **Cambia.** El valor exacto existe como *hover* de control y como *borde de card*. |
| Botón tonal fondo **#E3EBF8** | `--sp-primary-bg` #e4ecf5 (marca 12 % sobre blanco) | 2.1 | el mismo | 2.1 | **Se reutiliza** (casi). `--ag-status-confirmed-bg` #eaf1f9 Δ 3.3. |
| Botón tonal texto **#1F3F7A** | `--sp-primary-ink` #2f527a | 15.8 | `--sp-ink-900` #14345c | 13.1 | **Falta.** Ningún token a menos de Δ 13. |
| Separador **#EDF0F5** | `--sp-line-divider` / `--ag-hairline` #eef1f6 | 0.3 | el mismo | 0.3 | **Se reutiliza.** |
| Borde **#DDE3EE** | `--sp-line-card` #e6ebf2 3.5 · `--ag-border-card` #e7ecf3 3.8 · `border-slate-200` #e2e8f0 2.3 | 2.3–3.8 | `--sp-line-frame` #dbe3ee (0 usos) | 0.7 | **Cambia.** Los bordes de card actuales son más claros; el casi exacto existe sin consumidores. |
| Sobre navy, inactivo **#DCE4F2** | `--ag-navy-ink` = blanco 55 % → ≈#96a3b0 sobre #163250 | 24.1 | `--ag-navy-ink-strong` (blanco 80 % → ≈#d0d6dc) | 6.5 | **Cambia.** Hoy la tinta del menú es blanco con alfa (4 niveles), no un color opaco, y es bastante más apagada. |
| Sobre navy, secundario **#AFC0DE** | `--ag-navy-ink-dim` (50 % → ≈#8a98a8) / `-soft` (40 % → ≈#738496) | 16.8 / 23.6 | `--ag-navy-ink` (55 % → ≈#96a3b0) | 14.0 | **Cambia / falta** como opaco azulado. |
| Sobre navy, activo fondo **#2F5AA8** | hoy el activo es **`bg-white` con tinta `--ag-navy-ink-activo` (= `--cp`)** (`Sidebar.tsx:688,768`) | — | `--cs` #1e5fa8 | 5.6 | **Cambia** (patrón invertido: pastilla blanca en vez de pastilla azul). |
| Mes del chip de fecha **#B42318** | no existe ese elemento [I] | — | `--sp-danger` #c0392b 7.3 · `--ag-now-pill-bg` #bc1010 7.6 · `red-700` #b91c1c 3.5 | 7.3 | **Falta** (el más próximo es el rojo de error, más anaranjado). |
| Chip «Agendada» fondo **#FDF0E1** | `--ag-status-scheduled-bg` #fef6e7 | 2.5 | el mismo | 2.5 | **Cambia** (leve; maqueta más anaranjada). |
| Chip «Agendada» texto **#9A4A06** | `--ag-status-scheduled-text` #b45309 | 10.0 | `--ag-aviso-text` #92400e | 6.8 | **Cambia** (maqueta más oscura). |
| Chip «Agendada» punto **#D97706** | `--ag-status-scheduled-dot` #d97706 | 0 | = `--sp-warn-strong` | 0 | **Se reutiliza** (idéntico). |

| Geometría de maqueta | Estado actual | Veredicto |
|---|---|---|
| Tarjetas 16–20 px | `--sp-r-card` 16 (28 usos) y `--sp-r-modal` 20 (1) existen. `--ag-r-card` es 12. En literales: `rounded-xl` 12 px (254) domina sobre `rounded-2xl` 16 px (55). | **Se reutiliza** en `--sp`; **cambia** en agenda y en pantallas literales. |
| Botones/campos 12 px | `--sp-r-input` / `--sp-r-cta` 12 (3 usos). Los de uso real son 10 (`--sp-r-btn` 19, `--sp-r-field` 12, `--ag-r-btn` 47) y 8 (`--sp-r-btn-sm` 28, `rounded-lg` 75). En literales, `rounded-xl` (12) es habitual en botones e inputs [I]. | **Cambia** en lo tokenizado (10 → 12). |
| Píldoras 999 px | `--sp-r-pill`, `--ag-r-pill`, `rounded-full` | **Se reutiliza.** |
| Navegación 26 px | Ningún radio de 26. Lo más próximo: `rounded-3xl` 24 (3 usos), 22 px (2). El menú actual es una columna fija de borde a borde (`Sidebar.tsx:609`). | **Falta.** |
| Sombra nav `-8px 0 28px rgba(20,33,61,.14)` | Ninguna sombra horizontal. Más próxima: `--ag-shadow-pop` `0 12px 28px rgba(16,32,64,.14)` (mismo desenfoque y alfa, tinte casi igual, eje vertical). | **Falta** (parámetros casi presentes, desplazamiento distinto). |

Resumen: **se reutiliza** 6 (tarjeta, separador, punto Agendada, tonal fondo, texto principal —solo agenda—, píldoras) · **cambia** 13 · **falta** 5 (tinta del botón tonal, rojo del mes, tintas opacas sobre navy, radio 26, sombra lateral).

Notas [V]:
- La maqueta usa azules **fijos**; hoy navy y azul de acción son función de `--cp`/`--cs` por clínica (seis paletas). Cualquier equivalencia de esta tabla vale solo para la paleta «Spinus (defecto)».
- La maqueta no trae paleta oscura en los datos recibidos; no hay nada con qué comparar las capas de §2.

### 5.2 Anexo — vecino más próximo automático (solo tokens opacos en claro; no distingue rol)

| Maqueta | Valor | Token más próximo (claro) | Valor token | ΔE76 | Siguientes | Literal Tailwind más próximo |
|---|---|---|---|---|---|---|
| Azul marino navegación | #1B2B4A | `--sp-primary-active` | #16314e | 4.5 | `--ag-ink` #15243e (Δ4.6); `--ag-navy` #163250 (Δ4.6); `--sp-ink-800` #173156 (Δ4.8) | slate-800 #1e293b (Δ9.0) |
| Azul acción | #2F5AA8 | `--azul-medio` | #1e5fa8 | 5.6 | `--ag-brand-secondary` #1e5fa8 (Δ5.6); `--ag-brand-legible` #1e5fa8 (Δ5.6); `--ag-pulso` #1e5fa8 (Δ5.6) | slate-500 #64748b (Δ35.5) |
| Fondo de página | #F2F4F8 | `--ag-col-line` | #f1f4f8 | 0.4 | `--sp-surface-empty` #f1f4f8 (Δ0.4); `--ag-control-bg` #f3f6fa (Δ0.7); `--ag-btn-ghost-hover` #f1f5f9 (Δ0.7) | slate-100 #f1f5f9 (Δ0.7) |
| Texto principal | #14213D | `--ag-ink` | #15243e | 2.3 | `--sp-bezel` #0f1e30 (Δ7.6); `--sp-primary-active` #16314e (Δ8.1); `--foreground` #1e293b (Δ8.3) | slate-900 #0f172a (Δ7.7) |
| Texto secundario | #5B6478 | `--ag-ink-600` | #52627a | 3.5 | `--ag-status-no_show-text` #5a6b81 (Δ3.7); `--sp-ink-500` #5a6b81 (Δ3.7); `--sp-ink-600` #4b5b6e (Δ5.0) | slate-500 #64748b (Δ6.6) |
| Tarjeta | #FFFFFF | `--ag-surface` | #ffffff | 0.0 | `--ag-grid-col` #ffffff (Δ0.0); `--ag-navy-logo-bg` #ffffff (Δ0.0); `--ag-month-cell` #ffffff (Δ0.0) | slate-50 #f8fafc (Δ2.2) |
| Campo de búsqueda | #E6EAF1 | `--ag-control-bg-hover` | #e6ebf2 | 0.4 | `--sp-line-card` #e6ebf2 (Δ0.4); `--ag-border-card` #e7ecf3 (Δ0.7); `--ag-month-gap` #e7ecf3 (Δ0.7) | slate-200 #e2e8f0 (Δ1.2) |
| Botón tonal fondo | #E3EBF8 | `--sp-primary-bg` | #e4ecf5 | 2.2 | `--ag-input-border` #e2e8f0 (Δ2.8); `--sp-line-soft` #e2e8f0 (Δ2.8); `--sp-line-frame` #dbe3ee (Δ3.0) | slate-200 #e2e8f0 (Δ2.8) |
| Botón tonal texto | #1F3F7A | `--sp-ink-900` | #14345c | 13.1 | `--sp-ink-800` #173156 (Δ15.1); `--sp-brand-grad-to` #1e5fa8 (Δ15.2); `--azul-medio` #1e5fa8 (Δ15.2) | slate-700 #334155 (Δ25.4) |
| Separador | #EDF0F5 | `--ag-hour-line` | #eef1f6 | 0.3 | `--ag-hairline` #eef1f6 (Δ0.3); `--ag-chip-bg` #eef1f6 (Δ0.3); `--ag-segment-bg` #eef1f6 (Δ0.3) | slate-100 #f1f5f9 (Δ1.8) |
| Borde | #DDE3EE | `--sp-line-frame` | #dbe3ee | 0.7 | `--sp-line-chip` #d7e0ec (Δ1.7); `--ag-status-no_show-border` #dfe5ec (Δ2.2); `--sp-line-input` #d5deea (Δ2.3) | slate-200 #e2e8f0 (Δ2.3) |
| Sobre navy: texto inactivo | #DCE4F2 | `--sp-line-frame` | #dbe3ee | 1.6 | `--sp-primary-border` #d7e2ef (Δ1.6); `--sp-line-chip` #d7e0ec (Δ1.9); `--sp-line-input` #d5deea (Δ2.5) | slate-200 #e2e8f0 (Δ3.5) |
| Sobre navy: secundario | #AFC0DE | `--ag-today-ring` | #9ab7d8 | 5.7 | `--ag-input-focus-border` #93b4d8 (Δ7.9); `--sp-ink-icon` #a3b1c4 (Δ8.1); `--ag-faint` #aab4c4 (Δ8.8) | slate-400 #94a3b8 (Δ11.7) |
| Sobre navy: activo fondo | #2F5AA8 | `--azul-medio` | #1e5fa8 | 5.6 | `--ag-brand-secondary` #1e5fa8 (Δ5.6); `--ag-brand-legible` #1e5fa8 (Δ5.6); `--ag-pulso` #1e5fa8 (Δ5.6) | slate-500 #64748b (Δ35.5) |
| Mes del chip de fecha | #B42318 | `--ag-status-cancelled-dot` | #c0392b | 7.3 | `--ag-status-cancelled-text` #c0392b (Δ7.3); `--sp-danger` #c0392b (Δ7.3); `--sp-alergia-bg` #c0392b (Δ7.3) | red-700 #b91c1c (Δ3.5) |
| Chip Agendada fondo | #FDF0E1 | `--ag-status-scheduled-bg` | #fef6e7 | 2.5 | `--sp-warn-bg` #fef6e7 (Δ2.5); `--ag-aviso-bg` #fff7e8 (Δ2.8); `--ag-status-cancelled-bg` #fdf2f2 (Δ7.8) | amber-50 #fffbeb (Δ4.6) |
| Chip Agendada texto | #9A4A06 | `--ag-aviso-text` | #92400e | 6.8 | `--sp-doc-suplementacion` #92400e (Δ6.8); `--ag-status-scheduled-text` #b45309 (Δ10.0); `--sp-warn` #b45309 (Δ10.0) | amber-700 #b45309 (Δ10.0) |
| Chip Agendada punto | #D97706 | `--ag-status-scheduled-dot` | #d97706 | 0.0 | `--sp-warn-strong` #d97706 (Δ0.0); `--sp-vital-watch` #c07d10 (Δ14.7); `--sp-warn-dot` #f59e0b (Δ17.7) | amber-700 #b45309 (Δ17.9) |

---

## 6. Contraste WCAG 2.x

Razón calculada con la fórmula de luminancia relativa; tintas con alfa compuestas sobre su fondo. Umbrales: 4.5:1 texto normal (AA), 3:1 texto grande / gráficos. **[V]** el cálculo; **[I]** que cada par se dé realmente en pantalla (los fondos se asignaron por el uso declarado del token, no midiendo el DOM). En oscuro, los fondos con alfa se compusieron sobre #1e1e1e.


#### 6.1 Estado actual — modo claro

| Par | Texto | Fondo | Razón | ≥4.5 | ≥3 |
|---|---|---|---|---|---|
| body: texto base / fondo página | `--foreground` #1e293b | `--background` #f8fafc | 13.98 | sí | sí |
| body sobre tarjeta bg-white | `--foreground` #1e293b | `#ffffff` #ffffff | 14.63 | sí | sí |
| text-slate-900 / bg-white | `#0f172a` #0f172a | `#ffffff` #ffffff | 17.85 | sí | sí |
| text-slate-800 / bg-white | `#1e293b` #1e293b | `#ffffff` #ffffff | 14.63 | sí | sí |
| text-slate-700 | `#334155` #334155 | `#ffffff` #ffffff | 10.35 | sí | sí |
| text-slate-600 | `#475569` #475569 | `#ffffff` #ffffff | 7.58 | sí | sí |
| text-slate-500 / bg-white (98 usos) | `#64748b` #64748b | `#ffffff` #ffffff | 4.76 | sí | sí |
| text-slate-500 / página | `#64748b` #64748b | `#f8fafc` #f8fafc | 4.55 | sí | sí |
| text-slate-400 / bg-white (119 usos) | `#94a3b8` #94a3b8 | `#ffffff` #ffffff | 2.56 | **NO** | **NO** |
| text-slate-400 / página | `#94a3b8` #94a3b8 | `#f8fafc` #f8fafc | 2.45 | **NO** | **NO** |
| text-slate-300 (20 usos) | `#cbd5e1` #cbd5e1 | `#ffffff` #ffffff | 1.48 | **NO** | **NO** |
| text-[#1d1d1f] (47) | `#1d1d1f` #1d1d1f | `#ffffff` #ffffff | 16.83 | sí | sí |
| text-[#86868b] (103) | `#86868b` #86868b | `#ffffff` #ffffff | 3.62 | **NO** | sí |
| text-[#86868b] / página | `#86868b` #86868b | `#f8fafc` #f8fafc | 3.46 | **NO** | sí |
| text-[#3d3d3f] (18) | `#3d3d3f` #3d3d3f | `#ffffff` #ffffff | 10.84 | sí | sí |
| sp título | `--sp-ink-900` #14345c | `--sp-surface` #ffffff | 12.53 | sí | sí |
| sp ink-800 (78) | `--sp-ink-800` #173156 | `--sp-surface` #ffffff | 13.04 | sí | sí |
| sp ink-700 (58) | `--sp-ink-700` #3b4a5c | `--sp-surface` #ffffff | 9.05 | sí | sí |
|  | `--sp-ink-600` #4b5b6e | `--sp-surface` #ffffff | 6.95 | sí | sí |
| sp ink-500 (65) | `--sp-ink-500` #5a6b81 | `--sp-surface` #ffffff | 5.45 | sí | sí |
|  | `--sp-ink-500` #5a6b81 | `--sp-app-bg` #f5f8fc | 5.11 | sí | sí |
|  | `--sp-ink-400` #6b7b8f | `--sp-surface` #ffffff | 4.33 | **NO** | sí |
| sp ink-350 (113 usos) | `--sp-ink-350` #8a99ac | `--sp-surface` #ffffff | 2.90 | **NO** | **NO** |
|  | `--sp-ink-350` #8a99ac | `--sp-surface-muted` #eef2f7 | 2.58 | **NO** | **NO** |
|  | `--sp-ink-300` #9aa7b6 | `--sp-surface` #ffffff | 2.45 | **NO** | **NO** |
|  | `--sp-ink-250` #94a3b8 | `--sp-surface` #ffffff | 2.56 | **NO** | **NO** |
|  | `--sp-ink-200` #aab6c4 | `--sp-surface` #ffffff | 2.06 | **NO** | **NO** |
|  | `--sp-ink-150` #b7c2cf | `--sp-surface` #ffffff | 1.81 | **NO** | **NO** |
| enlace/acento como tinta | `--sp-primary-text` #1e5fa8 | `--sp-surface` #ffffff | 6.45 | sí | sí |
| chip primario | `--sp-primary-ink` #2f527a | `--sp-primary-bg` #e4ecf5 | 6.70 | sí | sí |
| botón primario sp | `--sp-on-primary` #ffffff | `--sp-primary` #1e5fa8 | 6.45 | sí | sí |
| botón primario hover | `--sp-on-primary` #ffffff | `--sp-primary-hover` #1a3a5c | 11.64 | sí | sí |
| blanco sobre --cp | `#ffffff` #ffffff | `--cp` #1a3a5c | 11.64 | sí | sí |
| éxito | `--sp-success-strong` #0f7a52 | `--sp-success-bg` #e9f7ef | 4.84 | sí | sí |
|  | `--sp-success` #16a34a | `--sp-surface` #ffffff | 3.30 | **NO** | sí |
| aviso | `--sp-warn` #b45309 | `--sp-warn-bg` #fef6e7 | 4.67 | sí | sí |
| warn-strong como tinta | `--sp-warn-strong` #d97706 | `--sp-surface` #ffffff | 3.19 | **NO** | sí |
| error | `--sp-danger` #c0392b | `--sp-danger-bg` #fdf2f2 | 4.96 | sí | sí |
|  | `--sp-danger` #c0392b | `--sp-surface` #ffffff | 5.44 | sí | sí |
| ag ink | `--ag-ink` #15243e | `--ag-surface` #ffffff | 15.51 | sí | sí |
| ag text (106) | `--ag-text` #27364f | `--ag-surface` #ffffff | 12.16 | sí | sí |
| ag ink-600 | `--ag-ink-600` #52627a | `--ag-surface` #ffffff | 6.20 | sí | sí |
| ag muted (117 usos) | `--ag-muted` #7c8aa0 | `--ag-surface` #ffffff | 3.50 | **NO** | sí |
|  | `--ag-muted` #7c8aa0 | `--ag-bg-app` #eef1f5 | 3.09 | **NO** | sí |
| ag muted2 (34) | `--ag-muted2` #9aa6b8 | `--ag-surface` #ffffff | 2.46 | **NO** | **NO** |
| ag faint | `--ag-faint` #aab4c4 | `--ag-surface` #ffffff | 2.09 | **NO** | **NO** |
|  | `--ag-brand-legible` #1e5fa8 | `--ag-surface` #ffffff | 6.45 | sí | sí |
| segmento activo | `--ag-segment-active-text` #ffffff | `--ag-segment-active-bg` #1e5fa8 | 6.45 | sí | sí |
| chip médico | `--ag-chip-text` #7c8aa0 | `--ag-chip-bg` #eef1f6 | 3.09 | **NO** | sí |
| Agendada | `--ag-status-scheduled-text` #b45309 | `--ag-status-scheduled-bg` #fef6e7 | 4.67 | sí | sí |
| Confirmada | `--ag-status-confirmed-text` #1e5fa8 | `--ag-status-confirmed-bg` #eaf1f9 | 5.66 | sí | sí |
| Atendida | `--ag-status-attended-text` #0f7a52 | `--ag-status-attended-bg` #e9f7ef | 4.84 | sí | sí |
| Cancelada | `--ag-status-cancelled-text` #c0392b | `--ag-status-cancelled-bg` #fdf2f2 | 4.96 | sí | sí |
| Inasistencia | `--ag-status-no_show-text` #5a6b81 | `--ag-status-no_show-bg` #f4f6f8 | 5.03 | sí | sí |
|  | `--ag-success-text` #157e3c | `--ag-success-bg` #e7f6ec | 4.60 | sí | sí |
|  | `--ag-aviso-text` #92400e | `--ag-aviso-bg` #fff7e8 | 6.66 | sí | sí |
|  | `--ag-gcal-text` #6d4ec0 | `--ag-gcal-bg1` #f3eefc | 5.27 | sí | sí |
| sidebar: item inactivo (.55) | `--ag-navy-ink` #ffffff@0.55 | `--ag-navy` #163250 | 5.07 | sí | sí |
| sidebar: subitem/pie (.50) | `--ag-navy-ink-dim` #ffffff@0.50 | `--ag-navy` #163250 | 4.47 | **NO** | sí |
| sidebar: subtítulo (.40) | `--ag-navy-ink-soft` #ffffff@0.40 | `--ag-navy` #163250 | 3.41 | **NO** | sí |
| sidebar: grupo abierto (.80) | `--ag-navy-ink-strong` #ffffff@0.80 | `--ag-navy` #163250 | 8.92 | sí | sí |
| sidebar: blanco | `#ffffff` #ffffff | `--ag-navy` #163250 | 13.06 | sí | sí |
| sidebar: item activo (tinta --cp sobre blanco) | `--ag-navy-ink-activo` #1a3a5c | `#ffffff` #ffffff | 11.64 | sí | sí |


#### 6.2 Estado actual — modo oscuro

| Par | Texto | Fondo | Razón | ≥4.5 | ≥3 |
|---|---|---|---|---|---|
| body | `rgba(255,255,255,0.87)` #ffffff@0.87 | `#121212` #121212 | 14.22 | sí | sí |
| slate-900/800 sobre card | `rgba(255,255,255,0.87)` #ffffff@0.87 | `#1e1e1e` #1e1e1e | 12.84 | sí | sí |
| slate-700 | `rgba(255,255,255,0.75)` #ffffff@0.75 | `#1e1e1e` #1e1e1e | 9.84 | sí | sí |
| slate-600 / #86868b | `rgba(255,255,255,0.60)` #ffffff@0.60 | `#1e1e1e` #1e1e1e | 6.77 | sí | sí |
| slate-500 | `rgba(255,255,255,0.50)` #ffffff@0.50 | `#1e1e1e` #1e1e1e | 5.12 | sí | sí |
| slate-400 (119 usos) | `rgba(255,255,255,0.38)` #ffffff@0.38 | `#1e1e1e` #1e1e1e | 3.54 | **NO** | sí |
| slate-300 | `rgba(255,255,255,0.28)` #ffffff@0.28 | `#1e1e1e` #1e1e1e | 2.53 | **NO** | **NO** |
|  | `--sp-ink-800` #ffffff@0.87 | `--sp-surface` #1e1e1e | 12.84 | sí | sí |
|  | `--sp-ink-500` #ffffff@0.50 | `--sp-surface` #1e1e1e | 5.12 | sí | sí |
| sp ink-350 (113) | `--sp-ink-350` #ffffff@0.38 | `--sp-surface` #1e1e1e | 3.54 | **NO** | sí |
|  | `--sp-ink-150` #ffffff@0.28 | `--sp-surface` #1e1e1e | 2.53 | **NO** | **NO** |
|  | `--sp-primary-text` #61a1ef | `--sp-surface` #1e1e1e | 6.24 | sí | sí |
| botón primario | `--sp-on-primary` #ffffff | `--sp-primary` #3373bd | 4.87 | sí | sí |
|  | `--sp-danger` #f87171 | `--sp-surface` #1e1e1e | 6.03 | sí | sí |
|  | `--sp-warn` #fcd34d | `--sp-surface` #1e1e1e | 11.56 | sí | sí |
|  | `--sp-success` #34d399 | `--sp-surface` #1e1e1e | 8.67 | sí | sí |
|  | `--ag-ink` #e8eef6 | `--ag-surface` #1b2a40 | 12.39 | sí | sí |
|  | `--ag-text` #cdd8e6 | `--ag-surface` #1b2a40 | 10.03 | sí | sí |
|  | `--ag-ink-600` #a8b4c2 | `--ag-surface` #1b2a40 | 6.87 | sí | sí |
| ag muted | `--ag-muted` #8b9bb0 | `--ag-surface` #1b2a40 | 5.11 | sí | sí |
| ag muted sobre card real (#1e1e1e) | `--ag-muted` #8b9bb0 | `#1e1e1e` #1e1e1e | 5.89 | sí | sí |
|  | `--ag-muted2` #6b7a90 | `--ag-surface` #1b2a40 | 3.31 | **NO** | sí |
|  | `--ag-muted2` #6b7a90 | `#1e1e1e` #1e1e1e | 3.82 | **NO** | sí |
|  | `--ag-faint` #5d6b80 | `--ag-surface` #1b2a40 | 2.67 | **NO** | **NO** |
|  | `--ag-brand-legible` #83a7cf | `--ag-surface` #1b2a40 | 5.79 | sí | sí |
| sidebar inactivo | `--ag-navy-ink` #ffffff@0.70 | `--ag-navy` #2f4f73 | 5.10 | sí | sí |
|  | `--ag-navy-ink-dim` #ffffff@0.65 | `--ag-navy` #2f4f73 | 4.64 | sí | sí |
|  | `--ag-navy-ink-soft` #ffffff@0.52 | `--ag-navy` #2f4f73 | 3.58 | **NO** | sí |
| sidebar activo: tinta sobre .bg-white→#1e1e1e | `--ag-navy-ink-activo` #ffffff@0.88 | `#1e1e1e` #1e1e1e | 13.11 | sí | sí |


#### 6.3 Maqueta de referencia

| Par | Texto | Fondo | Razón | ≥4.5 | ≥3 |
|---|---|---|---|---|---|
| texto principal / fondo | `#14213D` #14213d | `#F2F4F8` #f2f4f8 | 14.51 | sí | sí |
| texto principal / tarjeta | `#14213D` #14213d | `#FFFFFF` #ffffff | 15.97 | sí | sí |
| secundario / fondo | `#5B6478` #5b6478 | `#F2F4F8` #f2f4f8 | 5.39 | sí | sí |
| secundario / tarjeta | `#5B6478` #5b6478 | `#FFFFFF` #ffffff | 5.93 | sí | sí |
| secundario / campo de búsqueda | `#5B6478` #5b6478 | `#E6EAF1` #e6eaf1 | 4.92 | sí | sí |
| principal / campo de búsqueda | `#14213D` #14213d | `#E6EAF1` #e6eaf1 | 13.24 | sí | sí |
| botón tonal | `#1F3F7A` #1f3f7a | `#E3EBF8` #e3ebf8 | 8.54 | sí | sí |
| botón primario (blanco / azul acción) | `#FFFFFF` #ffffff | `#2F5AA8` #2f5aa8 | 6.67 | sí | sí |
| azul acción como tinta / tarjeta | `#2F5AA8` #2f5aa8 | `#FFFFFF` #ffffff | 6.67 | sí | sí |
| azul acción como tinta / fondo | `#2F5AA8` #2f5aa8 | `#F2F4F8` #f2f4f8 | 6.06 | sí | sí |
| navy: inactivo | `#DCE4F2` #dce4f2 | `#1B2B4A` #1b2b4a | 11.01 | sí | sí |
| navy: secundario | `#AFC0DE` #afc0de | `#1B2B4A` #1b2b4a | 7.66 | sí | sí |
| navy: blanco | `#FFFFFF` #ffffff | `#1B2B4A` #1b2b4a | 14.08 | sí | sí |
| navy: activo (blanco / #2F5AA8) | `#FFFFFF` #ffffff | `#2F5AA8` #2f5aa8 | 6.67 | sí | sí |
| mes del chip de fecha / tarjeta | `#B42318` #b42318 | `#FFFFFF` #ffffff | 6.57 | sí | sí |
| mes / fondo | `#B42318` #b42318 | `#F2F4F8` #f2f4f8 | 5.97 | sí | sí |
| chip Agendada | `#9A4A06` #9a4a06 | `#FDF0E1` #fdf0e1 | 5.58 | sí | sí |
| punto Agendada (gráfico, 3:1) | `#D97706` #d97706 | `#FDF0E1` #fdf0e1 | 2.84 | **NO** | **NO** |
| borde / tarjeta (no texto) | `#DDE3EE` #dde3ee | `#FFFFFF` #ffffff | 1.29 | **NO** | **NO** |
| borde / fondo | `#DDE3EE` #dde3ee | `#F2F4F8` #f2f4f8 | 1.17 | **NO** | **NO** |
| activo fondo vs navy (separación) | `#2F5AA8` #2f5aa8 | `#1B2B4A` #1b2b4a | 2.11 | **NO** | **NO** |
| tarjeta vs fondo (separación) | `#FFFFFF` #ffffff | `#F2F4F8` #f2f4f8 | 1.10 | **NO** | **NO** |

### 6.4 Pares que no llegan a 4.5:1

**Estado actual, claro:**
- `text-slate-400` sobre blanco **2.56** / sobre página 2.45 — 119 usos (ni 3:1).
- `text-slate-300` **1.48** — 20 usos.
- `text-[#86868b]` **3.62** / 3.46 — 103 usos.
- `--sp-ink-350` **2.90** (2.58 sobre `--sp-surface-muted`) — 113 usos; es el token de «etiquetas y meta» (`spinus-tokens.css:237`). También `--sp-ink-400` 4.33, `-300` 2.45, `-250` 2.56, `-200` 2.06, `-150` 1.81.
- `--ag-muted` **3.50** sobre card, 3.09 sobre `--ag-bg-app` — 117 usos. `--ag-muted2` 2.46 (34 usos), `--ag-faint` 2.09, chip médico (`--ag-chip-text`/`--ag-chip-bg`) 3.09.
- Semánticos usados como tinta sobre blanco: `--sp-success` #16a34a 3.30, `--sp-warn-strong` #d97706 3.19, `text-red-500` 3.76, `text-emerald-600` 3.77 (3.58 sobre `emerald-50`), `text-red-600` sobre `red-50` 4.41.
- Menú lateral: `--ag-navy-ink-dim` (subelementos y pie, 13 px) **4.47**; `--ag-navy-ink-soft` (subtítulo 11 px, pie 10 px) **3.41**.
- Pasan: todos los chips de estado de cita (4.67–5.66), botón primario (blanco/`--cs` 6.45), tintas principales y secundarias de los tres sistemas (≥5.45), aviso/éxito/error sobre su fondo en `--sp`/`--ag` (4.60–6.66).
- Gráficos (umbral 3:1): punto «Agendada» #d97706 sobre su fondo #fef6e7 = 2.97; `--sp-success` sobre `--sp-success-bg` 2.98; `--sp-success-dot` #22c55e sobre blanco 2.28.

**Estado actual, oscuro:**
- Blanco 38 % sobre #1e1e1e **3.54** (destino de `text-slate-400` y de `--sp-ink-350/300/250/200/icon`); blanco 28 % **2.53** (`text-slate-300`, `--sp-ink-150/100`).
- `--ag-muted2` 3.31 (3.82 sobre #1e1e1e); `--ag-faint` 2.67; `--ag-navy-ink-soft` 3.58.
- Pasan: botón primario 4.87 (justo), `--ag-muted` 5.11, tinta de marca 5.79–6.24.

**Maqueta:**
- **Todos los pares de texto pasan 4.5:1**; el más justo es texto secundario #5B6478 sobre el campo de búsqueda #E6EAF1 = **4.92** (5.39 sobre fondo, 5.93 sobre tarjeta).
- Sobre navy: inactivo 11.01, secundario 7.66, blanco sobre activo #2F5AA8 6.67. Botón tonal 8.54. Chip «Agendada» 5.58. Mes #B42318 6.57 / 5.97.
- No-texto por debajo de 3:1: punto «Agendada» sobre su chip **2.84** (hoy 2.97); pastilla activa #2F5AA8 contra el navy #1B2B4A **2.11**; tarjeta contra fondo 1.10 y borde contra tarjeta 1.29 (separaciones decorativas, sin requisito salvo que el borde sea el único indicador de un control).

Comparación directa: la maqueta no tiene equivalente a los grises terciarios de 2.5–3.6:1 que hoy suman ~470 usos (`text-slate-400`, `--sp-ink-350`, `--ag-muted`, `#86868b`); su tinta más clara sobre fondo claro es #5B6478.

---

## 7. Límites de esta auditoría

- No se abrió la app en navegador: ningún resultado es visual. Los contrastes asumen el fondo nominal de cada token.
- Los conteos salen de regex; clases construidas dinámicamente (`\`bg-${x}-50\``) y colores en objetos de configuración pueden quedar fuera o contarse como «hex suelto».
- Valores `oklch(from …)` resueltos con conversión propia (recorte de croma, no el mapeo de gama de CSS): ±1–2 por canal.
- Los números de línea de `globals.css` en los rangos largos son aproximados (`~`); los puntuales están comprobados.
- Scripts y datos intermedios: `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/aud/` (`vars.py`, `use.py`, `lit.py`, `rs.py`, `col.py`, `cmp.py`).
