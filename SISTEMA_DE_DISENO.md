# Sistema de diseño de Spinus

> Documento único y fuente de verdad del diseño de la app. **Describe lo que ya existe en el código; no inventa,
> no propone rediseños y no cambia nada visual.** Si algo no consta aquí, no está decidido: se pregunta o se
> propone añadirlo al sistema antes de usarlo (sección 0).

## Índice

0. [Cómo usar este documento](#0-cómo-usar-este-documento)
1. [Mapa rápido](#1-mapa-rápido)
2. [Tokens](#2-tokens)
3. [Formatos de pantalla](#3-formatos-de-pantalla)
4. [Claro y oscuro](#4-claro-y-oscuro)
5. [Catálogo de piezas](#5-catálogo-de-piezas)
6. [Accesibilidad](#6-accesibilidad)
7. [Lo prohibido](#7-lo-prohibido)
8. [Deuda conocida](#8-deuda-conocida)
9. [Documentos anteriores](#9-documentos-anteriores)
10. [Sin comprobar](#10-sin-comprobar)

**Leyenda de rutas** (se escriben enteras la primera vez y abreviadas después):
`SC` = `src/app/sistema.css` · `GC` = `src/app/globals.css` · `ST` = `src/app/spinus-tokens.css` ·
`FP` = `src/lib/formatoPantalla.ts` · `TP` = `src/components/layout/ThemeProvider.tsx` ·
`AP` = `src/components/agendaPublica/agendaPublica.css` · `PC` = `src/lib/correo/plantillaCita.ts` ·
`CMP` = `src/components` · `AGC` = `src/components/agenda/configuracion` ·
`CALMA` = `docs/spec/rediseno/kit/CALMA.md` · `BRIEF` = `docs/spec/rediseno/kit/BRIEF.md` ·
`PIEZAS` = `docs/spec/rediseno/agenda-base/PIEZAS.md` · `PLAN` = `docs/spec/rediseno/PLAN.md` ·
`REGISTRO` = `docs/spec/rediseno/IMPLEMENTACION-REGISTRO.md`. Formato de cita: `archivo:línea`.

---

## 0. Cómo usar este documento

* **Es la fuente de verdad del diseño.** Todo cambio visual sale de aquí: color, letra, medidas, formatos, piezas,
  movimiento, accesibilidad.
* **Antes de escribir interfaz, lee la sección que toque.** Si falta una pieza o un token, **se propone añadirlo al
  sistema ANTES de usarlo** (y este documento se actualiza en el mismo commit). No se inventa diseño en la pantalla.
* **Ante conflicto entre este documento y el código, manda el código y se corrige el documento.** Los números de
  línea son de la fecha de abajo y se mueven: busca el símbolo si la línea ya no coincide.
* Una regla vive en un solo sitio; las demás secciones remiten a él.
* Lo que aquí figura como **Deuda** (sección 8) no se corrige sin orden explícita. Lo no comprobado está en la
  sección 10 y no se da por cierto.
* **Fecha y base:** 2026-11-25, rama `feature/sistema-de-diseno`, nacida de `main` en el commit `148de519`.
* Los contrastes marcados *(calc.)* están calculados con la fórmula WCAG a partir de los hex del código; ninguna
  prueba del repo los mide.

---

## 1. Mapa rápido

### 1.1 Los tres CSS y su orden

`GC:1-5` importa, en este orden, `tailwindcss` → `./spinus-tokens.css` → `./sistema.css`, y después
`@plugin "@tailwindcss/typography"` (`GC:6`). `src/app/layout.tsx:2` importa solo `./globals.css`. El orden existe
porque los alias neutros de `ST` apuntan a tokens que se declaran en `SC` (`GC:3-4`).

| Archivo | Qué contiene |
|---|---|
| `SC` (895 líneas) | **El sistema del rediseño.** `:root` 40-150 (neutros, marca, semánticos, sombras, color de documento, insets, radios, z-index, movimiento); `html.dark` 153-192; familia `--cal-*` 213-259; `@theme inline` 266-299 (utilidades de color de Tailwind); variantes por formato 307-311; roles tipográficos `.k-t-*` 317-325; `--k-toque` 357-358; primitivas `.k-*` 360-583; capas 591-857; rejilla `.k-az` 859-895. |
| `ST` (3509 líneas) | **Heredado.** Familia `--sp-*` en `:root` 7-485 (primario ligado a la marca, semánticos, tipo de documento, avatares, neutros, radios, espaciado, sombras, tipografía, movimiento); `html.dark` 499-708; marca en oscuro con `@supports` 763-829; clases `.sp-*` (botones, chips, tarjetas, formularios de documentos) desde 859. |
| `GC` (9764 líneas) | `:root` 27-880 con `--background/--foreground/--azul-*` (28-33), familia `--ag-*` (40-612) y `--lp-*` (619-841); `body` 915; letra base 933-936; franja `body::before` 1012-1018; cromo de navegación `--cromo-*` 2171-2255 y `.nav-*` 2257-2700; piel de la agenda `.ag-*`/`.agenda-*`/`.fc-*` (~1700-9700, bloque B13 desde 6496); `html.dark` de la agenda 8437-8760; hoja de traducción oscura 9214. |

Hojas fuera de esos tres: `AP` (páginas públicas de la agenda, prefijo `rp-`, solo tokens `--ag-*`; `AP:1-34`) y el
CSS en línea de `PC` (correos, hex literales copiados de tokens; `PC:52-64`).

### 1.2 Qué familia de tokens usa cada zona

| Zona | Familia | Evidencia |
|---|---|---|
| App autenticada rediseñada (`src/app/(app)`, `CMP/ui`, `CMP/layout`) | **Neutros del kit** (`--sup`, `--tinta*`, `--linea`, `--borde`, `--enlace`, `--accion`, `--navy`, `--tonal*`, `--ok/mal/aviso-*`) por utilidades de Tailwind (`bg-sup`, `text-tinta2`) y primitivas `k-*` | `SC:266-299` crea las utilidades; en `src/app/(app)` hay unas 369 apariciones de clases `k-*` (grep) |
| Expediente y formularios de documentos | Mezcla: clases `.sp-*` re-pieladas al kit + `--sp-*` (alias del kit) + `k-*` | `ST:231-236`; `ST:871-880` |
| Agenda v2 encendida | Kit + `--cal-*` (estados, rejilla) + `--ag-*` residuales | `SC:34-37`, `SC:201-212` |
| Agenda v2 apagada | `--ag-*` (incluye `--ag-status-*`) | `SC:207-210` |
| Configuración de la agenda | Kit puro, «Ningún `--ag-*`» | `AGC/estilosConfig.ts:1-26` |
| Páginas públicas `/reservar` y `/confirmar` | Solo `--ag-*`, redeclarados en claro | `AP:1-34`, `AP:38-83` |
| Landing y `/login` | `--lp-*` (con `--sp-dur-*` para movimiento); Inter | `GC:650-660`, `GC:672-841`; `src/lib/fonts.ts` |
| Correos de la agenda | Hex literales copiados de `--ag-*` | `PC:52-64` |
| Lanzador `/inicio` | Ninguna familia (Tailwind `slate-*` y hex literales) | `GC:1020-1024`; ver Deuda |
| Super-admin | Tailwind `slate-*`/`red-*`, sin tokens | `CMP/super-admin/**`; ver «Sin comprobar» |

### 1.3 Regla práctica

> **Para código nuevo en la app autenticada: tokens neutros del kit (`SC`) + primitivas `k-*`.
> `--sp-*` y `--ag-*` son heredados (alias del kit o propios de una zona).**

Dónde lo dicen el código y los documentos (única base de esta afirmación):

* Los neutros `--sp-*` «pasan a ser alias de los del kit» (`ST:231-236`; `PLAN:129-147`, §2.1); «B15: se borran los
  tokens y clases con 0 consumidores y los alias de compatibilidad» (`PLAN:146`). B15 se ejecutó solo en parte: se
  borraron clases `.sp-*` sin consumidor y se conservaron los alias `--sp-*` y `--radius-*` (`REGISTRO:933-952`).
* La agenda de la app «se pinta con `--cal-*` y el kit; los `--ag-*` siguen en `globals.css`» (`SC:34-37`).
* La configuración de la agenda va con «los TOKENS Y LAS PRIMITIVAS DEL KIT»; «Ningún `--ag-*`»
  (`AGC/estilosConfig.ts:1-26`).
* Las capas de la agenda viven en `body` y leen **solo tokens del kit**; «Ningún token nuevo»
  (`docs/spec/rediseno/b13/capas.md:8-9`).
* Zonas con familia propia que **no se mezclan**: landing (`--lp-*`, `GC:650-660`), páginas públicas y correos
  (`--ag-*` redeclarados en claro, `AP:38-83`, `PC:36-37`).
* Excepción visible: el lanzador `/inicio` «no es del rediseño todavía» (`GC:1020-1024`) y se deja fuera por decisión
  del dueño (B14; `REGISTRO:1181-1183`).

---

## 2. Tokens

### 2.1 Color

#### 2.1.1 Neutros y marca del kit (`SC`)

Claro en `SC:40-95`, oscuro en `html.dark` `SC:153-191`. Todos tienen utilidad de Tailwind con prefijo `color-`
(`SC:266-299`), salvo `--nav-velo`, `--nav-avatar`, `--d-mezcla`, las sombras, `--velo` y `--cal-*`.

| Token | Claro | Oscuro | Uso (según comentarios del código) | Línea (claro / oscuro) |
|---|---|---|---|---|
| `--fondo` | `#F2F4F8` | `#0C1420` | fondo de página con navegación (`GC:943`) | `SC:42` / `SC:154` |
| `--sup` | `#FFFFFF` | `#16223A` | superficie de tarjeta y modal | `SC:43` / `SC:155` |
| `--sup2` | `#E6EAF1` | `#1F2E4A` | relleno de campo y de botón quieto; pista del segmentado | `SC:44` / `SC:156` |
| `--tonal` | `#E3EBF8` | `#223A66` | botón tonal; fila activa | `SC:45` / `SC:157` |
| `--tonal-tinta` | `#1F3F7A` | `#C3D6F8` | texto sobre `--tonal` | `SC:46` / `SC:158` |
| `--tinta` | `#14213D` | `#E8EDF7` | texto principal | `SC:47` / `SC:159` |
| `--tinta2` | `#5B6478` | `#A3AEC4` | texto secundario | `SC:48` / `SC:160` |
| `--tinta3` | `#8A93A6` | `#7C89A3` | terciario: placeholder (`SC:424`), chevron de fila (`SC:466`), barra «no asistió» (`SC:227`) | `SC:49` / `SC:161` |
| `--linea` | `#EDF0F5` | `#24324C` | separador de fila | `SC:50` / `SC:162` |
| `--borde` | `#DDE3EE` | `#2C3D5C` | borde de chip y de pestañas, asa de hoja | `SC:51` / `SC:163` |
| `--navy` | `#1B2B4A` | `#101B30` | navegación (riel, barra, encabezado) | `SC:54` / `SC:164` |
| `--accion` | `#2F5AA8` | `#3B6FC9` | relleno del botón primario | `SC:55` / `SC:165` |
| `--sobre-accion` | `#FFFFFF` | `#FFFFFF` | texto sobre `--accion` | `SC:56` / `SC:166` |
| `--enlace` | `#2F5AA8` | `#8FB2F0` | texto de enlace y anillo de foco | `SC:57` / `SC:167` |
| `--nav-tinta` | `#DCE4F2` | no se redeclara | texto sobre navy | `SC:60` |
| `--nav-tinta2` | `#AFC0DE` | no se redeclara | texto secundario sobre navy | `SC:61` |
| `--nav-velo` | `rgba(255,255,255,.08)` | no se redeclara | fondo translúcido sobre navy | `SC:62` |
| `--nav-avatar` | `#DCE6F7` | no se redeclara | avatar sobre navy | `SC:63` |
| `--mes` | `#B42318` | `#F2877C` | mes del chip de fecha; línea «ahora» (`--cal-ahora`, `SC:243`) | `SC:66` / `SC:168` |
| `--aviso-fondo` / `-tinta` / `-punto` | `#FDF0E1` / `#9A4A06` / `#D97706` | `#3E2A10` / `#F2BE7C` / `#E0963A` | aviso; también «Agendada» | `SC:67-69` / `SC:169-171` |
| `--ok-fondo` / `--ok-tinta` | `#E3F3EA` / `#1B6B43` | `#143526` / `#8FD9B0` | éxito; «Atendida» | `SC:70-71` / `SC:172-173` |
| `--mal-fondo` / `--mal-tinta` | `#FBE4E1` / `#B42318` | `#45191A` / `#F5A39B` | error, destructivo; «Cancelada» | `SC:72-73` / `SC:174-175` |

* `--aviso-*` sustituye a los `--ag-fondo/-tinta/-punto` del kit original (tabla de equivalencias `SC:24-32`).
* Contrastes *(calc.)*, claro: `--tinta`/`--sup` 15,97; `--tinta2`/`--sup` 5,93; `--tinta2`/`--sup2` 4,92;
  `--enlace`/`--sup` 6,67; blanco/`--accion` 6,67; `--tonal-tinta`/`--tonal` 8,54; `--aviso-tinta`/`--aviso-fondo`
  5,58; `--ok-tinta`/`--ok-fondo` 5,66; `--mal-tinta`/`--mal-fondo` 5,41. **Por debajo de 4,5:1:** `--tinta3`/`--sup`
  3,09 y `--tinta3`/`--sup2` 2,56 (ver Deuda). Oscuro: `--tinta`/`--sup` 13,51; `--tinta2`/`--sup` 7,11;
  `--enlace`/`--sup` 7,40; blanco/`--accion` 4,88; `--tinta3`/`--sup` 4,50; `--tinta3`/`--sup2` 3,85.
* `--borde`/`--sup` (1,29) y `--linea`/`--sup` (1,14) *(calc.)* son separadores decorativos, no bordes de control.

> ### ⚠️ ADVERTENCIA — LA TRAMPA DE NOMBRES `--cp` / `--cs` / `--sp-primary`
>
> **`--cp` (`#1a3a5c`) es el navy OSCURO y `--cs` (`#1e5fa8`) es el azul BRILLANTE. `--sp-primary` apunta a
> `--cs`, no a `--cp`.** Está invertido respecto a lo intuitivo: **verifica el token antes de usarlo; no deduzcas por
> el nombre** (`CLAUDE.md`, «Landing pública», regla 4; `AP:9-10`).
>
> | Token | Valor | Evidencia |
> |---|---|---|
> | `--cp` | `#1a3a5c` (navy oscuro) por omisión | `src/hooks/useClinica.ts:64`; `src/app/(app)/perfil/page.tsx:71`; `TP` (`MARCA_DE_FABRICA`) |
> | `--cs` | `#1e5fa8` (azul brillante) por omisión | `src/hooks/useClinica.ts:65`; `perfil/page.tsx:71` |
> | `--sp-primary` | `var(--cs, #1e5fa8)` → el azul **brillante** | `ST:14` |
> | `--sp-primary-hover` | `var(--cp, #1a3a5c)` → el navy | `ST:15` |
> | `--ag-brand-primary` / `-secondary` | `var(--cp, #1a3a5c)` / `var(--cs, #1e5fa8)` | `GC:73-74` |
> | `--azul-oscuro` / `--azul-medio` | `#1a3a5c` / `#1e5fa8` | `GC:30-31` |
> | `--lp-navy` / `--lp-accent` | `#1a3a5c` / `#1e5fa8` | `GC:677-678` |
>
> **Ojo adicional:** en la app rediseñada con la marca de fábrica, el azul del botón primario **no** es `#1e5fa8`
> sino `--accion` `#2F5AA8` (`SC:55`; con la paleta de fábrica `cssMarcaDerivada` devuelve cadena vacía y mandan los
> valores del kit, `TP:105-109`). `#1e5fa8` solo aparece como `--sp-primary`, `--ag-brand-secondary`, `--lp-accent`,
> el estado «confirmed» legado y los correos.

#### 2.1.2 Marca por clínica y `ThemeProvider`

* `ThemeProvider` (solo `(app)`: `src/app/(app)/layout.tsx:158`) inyecta `--cp` y `--cs` en `:root` (`TP:177-178`).
  Valores por omisión `#1a3a5c` y `#1e5fa8` (`src/hooks/useClinica.ts:64-65`).
* Seis paletas elegibles (`src/app/(app)/perfil/page.tsx:70-77`), `primario / secundario`: Spinus (defecto)
  `#1a3a5c / #1e5fa8`; Verde médico `#134e4a / #0d9488`; Morado `#3b0764 / #7c3aed`; Rojo burdeos `#7f1d1d / #dc2626`;
  Café cálido `#451a03 / #b45309`; Pizarra oscuro `#0f172a / #475569`.
* Con cualquier paleta distinta de la de fábrica, `TP:110-137` redeclara `--navy`, `--accion`, `--enlace`, `--tonal` y
  `--tonal-tinta` desde `--cp`/`--cs` (OKLCH/HSL con `@supports`; claro `min(l, 0.52)`; oscuro luminosidad `0.55`;
  navy `hsl(from var(--cp) h s 20%)` claro y `12.5%` oscuro). **Nadie más los redeclara** (`SC:19-22`).
* `TP` inyecta además `--radius-sm: 10px`, `--radius-md: 14px`, `--radius-lg: 20px` (`TP:203-205`): están **muertos** y
  por eso `@theme` no declara radios (`SC:263-265`).

#### 2.1.3 Estados de cita

**Agenda v2 (rediseño): `--cal-*`** (`SC:213-249`; casi todos son mezclas del kit, por lo que el oscuro sale solo).

| Estado | `-fondo` | `-barra` | `-tinta` | Línea |
|---|---|---|---|---|
| Agendada (`--cal-ag-`) | `color-mix(--aviso-fondo 78%, --sup)` | `--aviso-punto` | `--aviso-tinta` | `SC:214-216` |
| Confirmada (`--cal-conf-`) | `color-mix(--tonal 78%, --sup)` | `--accion` | `--tonal-tinta` | `SC:217-219` |
| Atendida (`--cal-aten-`) | `color-mix(--ok-fondo 78%, --sup)` | `color-mix(--ok-tinta 82%, --sup)` | `--ok-tinta` | `SC:220-222` |
| Cancelada (`--cal-canc-`) | `color-mix(--mal-fondo 55%, --sup)` | `--mal-tinta` | `--mal-tinta` | `SC:223-225` |
| No asistió (`--cal-noas-`) | `color-mix(--sup2 70%, --sup)` | `--tinta3` | `--tinta2` | `SC:226-228` |

* Otros: `--cal-bloqueo-fondo/-raya/-tinta` (`--tinta2` al 5 % / 20 % / sólido), `--cal-fuera: var(--fondo)`,
  `--cal-linea: var(--linea)`, `--cal-hoy` (`--accion` al 5 %), `--cal-hoy-num`/`--cal-hueco`/`--cal-sel:
  var(--accion)`, `--cal-ahora: var(--mes)` (`SC:236-245`).
* Colores de evento elegidos por el usuario (`SC:230-235`; oscuro `SC:253-258`): indigo `#3730a3`/`#818cf8`, magenta
  `#a21caf`/`#e879f9`, carmin `#9d174d`/`#f391ca`, oliva `#4d7c0f`/`#a3e635`, bronce `#78350f`/`#c98a4b`, grafito
  `#1f2937`/`#7f96b8`.
* **Uso en un bloque de cita** (`SC:201-206`): `--b-fondo` relleno; `--b-barra` barra izquierda de 3 px (gráfico ≥
  3:1); `--b-tinta` hora e icono (texto ≥ 4,5:1); el nombre **siempre** en `--tinta` (`--tinta2` si está pasada o
  cancelada).
* Iconografía de estado: `.k-est-ag|conf|canc|noas|aten`, círculo de 26 px con icono de 15 y texto 12/600
  (`SC:540-556`); el texto solo se ve en `ih/iv/esc` (`SC:557-560`). Un estado nunca se indica solo por color
  (`SC:540-542`; `CALMA:164`).

**Legado `--ag-status-*`** (agenda con v2 apagada, dashboard y páginas públicas; `SC:207-210`; claro `GC:474-496`,
oscuro `GC:8590-8601`):

| Estado | punto / texto | fondo / borde | punto / texto (oscuro) |
|---|---|---|---|
| scheduled | `#d97706` / `#b45309` | `#fef6e7` / `#f4dfae` | `#fbbf24` / `#fcd34d` |
| confirmed | `#1e5fa8` / `#1e5fa8` | `#eaf1f9` / `#c7dcef` | `#6b9bff` / `#a9c8ff` |
| cancelled | `#c0392b` / `#c0392b` | `#fdf2f2` / `#f3c9c9` | `#ef4444` / `#fca5a5` |
| attended | `#16a34a` / `#0f7a52` | `#e9f7ef` / `#cfe6d6` | `#34d399` / `#7eecb4` |

Éxito y aviso de la agenda (`GC:514-516`, `GC:523-525`): `--ag-success-text/-bg/-border` `#157e3c/#e7f6ec/#bfe6cb`;
`--ag-aviso-text/-bg/-border` `#92400e/#fff7e8/#f2d9a6`. Google (`GC:587-591`): `--ag-gcal-text/-border/-accent/-bg1/-bg2`
`#6d4ec0/#ddd0f5/#7c5cdb/#f3eefc/#efe9fb`; con la v2 «lo de Google no es morado» (`CLAUDE.md`, tanda J).

#### 2.1.4 Color por tipo de documento `--d-*` (`SC:87-95`, oscuro `SC:182-190`)

| Tipo | Claro | Oscuro |
|---|---|---|
| receta | `#1d4ed8` | `#4899fb` |
| laboratorio | `#047857` | `#00b781` |
| imagen | `#7c3aed` | `#a17efe` |
| suplementación | `#92400e` | `#e7ad00` |
| internamiento | `#be123c` | `#fd5d79` |
| escrito | `#155e75` | `#00cee9` |
| consentimiento | `#3730a3` | `#9fabff` |
| honorarios | `#c2410c` | `#ee7d00` |

`--d-mezcla` vale 12 % (claro) y 18 % (oscuro). Duplican en valor a `--sp-doc-*` (`ST:141-148`, oscuro `ST:668-681`).
**Regla:** solo en el icono de una lista (20 px sin fondo) o en la rejilla de elegir tipo (cuadro de 32, radio 9);
«fuera de esos dos usos el color de documento no se usa» (`SC:562-566`; `CALMA:59-63`).

#### 2.1.5 Sombras, velo y navegación

| Token | Claro | Oscuro | Línea |
|---|---|---|---|
| `--sombra-nav-der` | `-8px 0 28px rgba(20,33,61,.14)` | `-8px 0 28px rgba(0,0,0,.4)` | `SC:76` / `SC:176` |
| `--sombra-nav-izq` | `8px 0 28px rgba(20,33,61,.14)` | `8px 0 28px rgba(0,0,0,.4)` | `SC:77` / `SC:177` |
| `--sombra-nav-sup` | `0 8px 24px rgba(20,33,61,.14)` | `0 8px 24px rgba(0,0,0,.4)` | `SC:78` / `SC:178` |
| `--sombra-capa` | `0 18px 48px rgba(20,33,61,.22)` | `0 18px 48px rgba(0,0,0,.55)` | `SC:79` / `SC:179` |
| `--sombra-accion` | `0 4px 12px rgba(47,90,168,.28)` | `0 4px 12px rgba(0,0,0,.35)` | `SC:80` / `SC:180` |
| `--velo` | `rgba(10,18,32,.45)` | `rgba(0,0,0,.35)` | `SC:81` / `SC:181` |
| `--velo-filtro` | `blur(10px) saturate(140%)` | igual | `SC:84` |

Con `prefers-reduced-transparency: reduce` el velo pasa a `.72` / `.7` y `--velo-filtro: none` (`SC:196-199`); `.k-velo`
se vuelve opaco con `--navy` (`SC:846-849`).

* `--navy` pinta el riel (`GC:2354-2361`), el cajón y la barra (`GC:2387-2396`) y el encabezado fundido
  (`GC:2267-2273`). El elemento activo usa `--accion` (`GC:2292`, `2374`, `2446`, `2492`); el distintivo ámbar usa `--aviso-punto`
  con texto `--navy` (`GC:2327-2332`).
* Franja de la barra de estado `body::before` (`GC:1012-1018`): `--ag-navy` por omisión; `--navy` dentro de la app con
  barra (`GC:1025`); `--ag-navy` con la banda de la agenda delante (`GC:1026`), salvo con la v2 encendida, donde vuelve
  a `--navy` (`GC:6834`). `theme-color` del `viewport`: `#163250` claro / `#2f4f73` oscuro (`src/app/layout.tsx:65-68`);
  `TP:36-52` lo reescribe leyendo el color pintado de `body::before`.

#### 2.1.6 Familias heredadas (no para código nuevo; ver 1.3)

* **`--sp-*`** (`ST`): primario ligado a la marca (`ST:14-31`; `--sp-primary` = `--cs`); semánticos de éxito `#16a34a`,
  advertencia `#b45309`, peligro `#c0392b` con sus fondos y bordes (`ST:81-125`; oscuros `ST:598-616`); alergia fija
  `--sp-alergia-bg #c0392b` / `-ink #ffffff` que **no** se redeclara en oscuro a propósito (`ST:116-125`); diez pares de
  avatar `--sp-avatar-N-bg/-ink` (`ST:209-226`; oscuros `ST:630-639`); semáforo de vitales (`ST:105-107`, `ST:694-696`);
  neutros `--sp-ink-*`/`--sp-line-*`/`--sp-surface*`, los principales alias del kit (`ST:239-245`, `278-280`, `284`, `300`,
  `303`) y varios literales que siguen siéndolo (`ST:253-273`; `--sp-line-control #6f8eb6` a 3:1).
* **`--ag-*`** (`GC:40-612`, oscuro `GC:8437-8760`; ~160 tokens): superficies (`--ag-bg-app #eef1f5`, `--ag-surface #ffffff`),
  tinta (`--ag-ink #15243e`, `--ag-ink-600 #52627a`, `--ag-muted #7c8aa0`), cromo (`--ag-navy` `#163250` de respaldo,
  `GC:134`, `GC:899-903`), «hoy/ahora» (`GC:175-185`), controles de la configuración (`--ag-control-*`, `GC:607-610`),
  sombras (`GC:197-202`). En oscuro apuntan al kit (`GC:8472-8477`).
* **`--lp-*`** (landing; `GC:672-841`): tintas `--lp-ink-900 #14345c`, `-700 #3b4a5c`, `-500 #5a6b81`; marca `--lp-navy
  #1a3a5c`, `--lp-accent #1e5fa8`; superficies `--lp-surface #ffffff`, `--lp-surface-alt #f5f8fc`; bordes `--lp-border
  #e6ebf2`, `--lp-border-control #7d8ea3` (3,35:1 sobre blanco, `GC:757`). **No se redeclaran bajo `html.dark`, nunca**
  (`GC:650-660`).

### 2.2 Tipografía

#### 2.2.1 Familias

| Familia | Dónde | Evidencia |
|---|---|---|
| `system-ui, -apple-system, sans-serif` | `body` de toda la app y de las páginas públicas | `GC:915-918` |
| Inter (`next/font/google`, variable `--lp-font`) | **solo** landing y `/login`; utilidad `font-lp` | `src/lib/fonts.ts`; `GC:23-25`. No se monta en el layout raíz |
| Pila del cliente de correo; cifras con `MONO` | correos | `PC:165` |

`--fuente` (`SC:97`) se declara pero no tiene consumidores (ver Deuda).

#### 2.2.2 La escala del kit

**12 · 13 · 14 · 15 · 16 · 17 · 20 · 26 · 32.** La prueba `src/lib/tests/configuracionEscala.test.ts:90` lee todos los
`font-size: Npx` de `SC` y exige exactamente esa lista; `:80-86` obliga a los archivos de `/agenda/configuracion` a usar
solo tamaños de la escala.

| Rol (clase) | Tamaño / interlineado | Peso | Otros | Línea |
|---|---|---|---|---|
| `.k-t-pantalla` | 26/32 (`ih`, `iv`, `esc`: 32/38) | 800 | `letter-spacing: -0.6px` | `SC:317-318` |
| `.k-t-seccion` | 20/26 | 700 | | `SC:319` |
| `.k-t-tarjeta` | 17/22 | 700 | | `SC:320` |
| `.k-t-fila` | 15/20 | 600 | | `SC:321` |
| `.k-t-sec` | 13/18 | 400 | `--tinta2` | `SC:322` |
| `.k-t-rotulo` | 12/16 | 600 | `letter-spacing .3px`, mayúsculas, `--tinta2` | `SC:323` |
| `.k-t-chip` | 12/16 | 600 | | `SC:324` |
| `.k-num` | — | — | `font-variant-numeric: tabular-nums` | `SC:325` |
| Cuerpo (con `data-formato`) | 15, interlineado `calc(20/15)` | — | | `GC:933-936` |
| Campos en `ext`/`tel` | 16 (evita el zoom de iOS) | — | `.k-campo`: 16/20, 15 en `ih`/`esc` | `GC:948-956`; `SC:421,423` |
| `.k-etiqueta` | 13/18 | 600 | `--tinta2` | `SC:417` |
| `.k-campo-ayuda` / `.k-campo-error` | 13/18 | 400 / 600 | | `SC:436-437` |
| `.k-b` | 15/20 (`ih`/`esc`: 14) | 600 | | `SC:373`, `SC:386` |
| `.k-b-tonal`, `.k-b-texto` | 14 | 600 | | `SC:389`, `SC:393` |
| `.k-fila-n` / `-s` / `-der` | 15/20, 13/18, 13/18 | 600 / 400 / 400 | | `SC:463-465` |
| `.k-etq` | 12/16 | 600 | | `SC:474` |
| `.k-tab` | 14/18 (`ext`: 13) | 400; activa 600 | | `SC:494`, `SC:497` |
| `.k-seg-op` | 13/18 | 400; activa 600 | | `SC:517` |
| `.k-avatar` | 13/16 (32 px: 12; 44 px: 15) | 600 | | `SC:535`, `SC:537-538` |
| `.k-est` / `.k-origen` | 12/16 / 13/18 | 600 | | `SC:543`, `SC:580` |
| Capa `.k-capa-tit` / `-sub` | 17/22 / 13/18 | 700 / 400 | | `SC:714-715` |
| Alerta `.k-al-tit` / `-sub` / `-t` | 17/22 / 13/18 / 14/20 | 700 / 400 / 400 | `-t` justificado, última línea centrada | `SC:735-737` |
| Menú `.k-menu-t` / `.k-menu-op` | 17/22 (700) / 15/20 (14 en `pop`) | | | `SC:750`, `SC:755`, `SC:789` |
| Rejilla `.k-az` | 14/18; línea plegada 12/16 + 15/20 (600) | | | `SC:871`, `SC:890-891` |

* **Pesos** (`CALMA:32`): 400 texto corriente y valores; 600 título de una fila o nombre de un campo importante; 700
  títulos de tarjeta y de sección; 800 **solo** el título de pantalla. Más de tres cosas en 700+ en una pantalla es
  «sobra negrita».
* **Letra mínima: 12 px.** «Nada por debajo de 12 px» (`SC:315`); `CALMA:33` (que manda sobre `BRIEF`, `CALMA:1`):
  «nada por debajo de 12 px salvo el mes del chip de fecha». **Única excepción:** el mes del chip de fecha a 11 px
  (`CMP/dashboard/PiezasCita.tsx:55`, comentario «la única excepción de la escala»; `text-[11px]` en `:60`). Si no cabe,
  no se encoge la letra: se quitan cosas o se reordena (`CALMA:33`).
* Rótulos en mayúsculas: con moderación, uno por tarjeta como mucho (`CALMA:34`).
* **Escala heredada `--sp-fs-*`** (`ST:394-448`; sigue en formularios de documentos y expediente): 34, 30, 27, 26, 20,
  19, 18, 17, 16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12, 11 (`--sp-fs-legal`), 10.5 (`--sp-fs-tile`), 25
  (`--sp-fs-patient`, `ST:428`). Las fracciones y los dos tamaños < 12 **no** son parte de la escala del kit (ver Deuda).

### 2.3 Espacio

* El kit **no declara tokens de espaciado**; usa la escala de Tailwind. Intención: «rejilla de 4 (4·8·12·16·20·24·32).
  Margen de página 16 en teléfono, 24 en `ih`/`esc`» (`BRIEF:27`).
* Margen de página (`.app-contenido`, especificidad cero): `padding: calc(var(--it) + var(--cromo-enc) + 16px)
  calc(16px + var(--ir)) calc(var(--ib) + 24px) calc(16px + var(--il))` (`GC:2232-2234`); desde 600 px, 24 lateral
  (`GC:2236`); desde 1024 px, `calc(var(--it) + 32px) 32px calc(var(--ib) + 32px)` (`GC:2239`); `ext`: `calc(var(--it) +
  16px) 16px calc(var(--ib) + 24px)` (`GC:2242`); `ih`: igual con 24 lateral (`GC:2243`).
* Heredados: `--sp-1` 4px … `--sp-12` 48px (`ST:338-342`) y aplicaciones fijas `--sp-pad-card 18px 20px`, `--sp-gap-*`
  (`ST:345-364`); `--ag-1` 4px … `--ag-8` 32px, sin `--ag-7` a propósito (`GC:268-278`, `GC:261`).

### 2.4 Radios

| Token | Valor | Uso | Línea |
|---|---|---|---|
| `--r-control` | 12px | botones y campos | `SC:106` |
| `--r-tarjeta` | 16px | tarjeta en teléfono | `SC:107` |
| `--r-tarjeta-ancha` | 20px | tarjeta en `ih`/`iv`/`esc`; alertas | `SC:108` |
| `--r-nav` | 26px | navegación, solo del lado del contenido (`GC:2272`, `2359`, `2393`) | `SC:109` |
| `--r-pildora` | 999px | píldoras | `SC:110` |

Literales frecuentes dentro de `SC`: menú 18 (`SC:749`), menú desplegable 14 (`SC:779`), hoja de `tel` `22px 22px 0 0`
(`SC:808`), etiqueta 8 (`SC:473`), segmentado 10 y opción 7 (`SC:513`, `SC:516`), celda de rejilla de documento 14
(`SC:870`). Heredados: `--sp-r-*` (`ST:319-333`) y `--ag-r-*` (`GC:301-319`).

### 2.5 Sombras y elevación

**Sin sombras en tarjetas ni botones. Sombra solo en capas y en la navegación** (`CALMA:28`). En el código:
`.k-tarjeta` sin sombra (`SC:440`), el primario sin sombra (`SC:362`, `SC:388`), `.k-capa-panel` con `--sombra-capa`
(`SC:700`), navegación con `--sombra-nav-*` (`GC:2272`, `2359`, `2393`, `2419`), acción «+» del riel con `--sombra-accion`
(`GC:2378`). `.sp-btn--primary` fija `box-shadow: none` (`ST:896`). La familia `--sp-shadow-*` (`ST:369-378`) es heredada.

### 2.6 Alturas de control y `--k-toque`

* **`--k-toque: 44px`** por omisión y **`36px` en `ih` y `esc`** (`SC:357-358`; usa `:root[…]` y no `:where()` porque con
  especificidad 0 perdería, `SC:355-356`). Es el **área** pulsable: el dibujo puede ser menor; el área llega a `--k-toque`
  con un `::after` centrado de `max(100%, var(--k-toque))` (`SC:344-349`, `SC:378-381`). Por eso una pieza pulsable del kit
  no lleva `overflow: hidden` ni `flex: 1 1 0`, y entre dos pulsables quedan 8 px (`SC:344-349`; `PIEZAS` §13).
* Mínimo de área: 44×44 en `ext`/`tel`/`iv`; 36 en `ih`/`esc` (`BRIEF:30`; `CALMA:13`).

| Pieza | Táctil (`ext`/`tel`/`iv`) | `ih`/`esc` | Línea |
|---|---|---|---|
| `.k-b` | 40 · 15 px | 36 · 14 px, `padding 0 14px` | `SC:372`, `SC:386` |
| `.k-b-tonal` | 36 | 32 | `SC:389-390` |
| `.k-b-texto` | 36 | 32 | `SC:393-394` |
| `.k-b-icono` | `--k-toque` × `--k-toque`, glifo 20 | ídem | `SC:395-398` |
| `.k-b-capa` | 44 | 40 | `SC:400-401` |
| `.k-campo` | 44 | 40 | `SC:419`, `SC:423` |
| `.k-fila` | `min-height` 56 | 52 | `SC:453`, `SC:458` |
| `.k-tab` | 44 (`min-width` 44) | 40 | `SC:493`, `SC:498` |
| `.k-seg` | pista 32, opciones ≥ 44 de ancho | ídem | `SC:513-516` |
| `.k-etq` | 24 | 24 | `SC:472` |
| `.k-avatar` | 36 (32 / 44 por tamaño) | ídem | `SC:533`, `SC:537-538` |
| Opción de menú | 44 (48 en `tel`/`iv`) | 44 (38 en `pop`) | `SC:753`, `SC:758`, `SC:789` |

* **Configuración de la agenda:** dos escalas **por formato, no por ancho**: táctil 44 y computadora 36 (campos 40),
  siempre como variantes `ih:` y `esc:` a la vez; ningún tamaño con `sm:`/`md:`/`lg:` (`AGC/estilosConfig.ts:1-26`;
  prueba `configuracionEscala.test.ts:7-12`).
* Heredado: `--sp-tap: 44px` (`ST:467`); `.sp-btn` `min-height: var(--sp-tap)` (`ST:881-883`).

### 2.7 Capas (z-index)

`SC:112-131`: `--z-nav 40` (cromo; 41 el cajón), `--z-franja 45` (franja del sistema y capas `.ag-*` de la agenda),
`--z-capa 50`, `--z-menu 60`, `--z-paleta 9998`, `--z-sin-conexion 9999`, `--z-aviso 10000`. Fuera de la escala, a
propósito, la guía `OnboardingGuide` (10001/10002; pieza hoy sin uso, ver Deuda). Los números 50-70 siguen escritos a
mano en muchos sitios (`z-50`, `z-[60]`, `z-[70]`); `SC` solo los nombra (`SC:112-124`). Un aviso `info` no intercepta
toques con una capa del catálogo abierta (`SC:132-135`, `SC:851-854`).

### 2.8 Movimiento

| Familia | Tokens | Línea |
|---|---|---|
| **Kit** | `--dur-toque 100ms`, `--dur-entra 360ms`, `--dur-sale 240ms`; `--resorte-entra` y `--resorte-sale` (`linear(0, 0.04, 0.131, … 1)`, misma forma; solo cambia la duración) | `SC:145-149` |
| Agenda | `--ag-dur-micro: var(--dur-toque)` (100 ms); `--ag-dur-base: 180ms` (**no** pasa a 240 por una carrera con el FLIP); `--ag-dur-lento: var(--dur-entra)` (360 ms); `--ag-ease-out: var(--resorte-entra)`, `--ag-ease-in: var(--resorte-sale)`, `--ag-ease: cubic-bezier(.4,0,.2,1)` | `GC:228-240` |
| Heredado `--sp-dur-*` | `micro 120ms`, `fast 180ms`, `base 240ms`, `slide 320ms`, `enter 280ms`, `check 520ms`, `spin 900ms` | `ST:474-480` |
| Heredado `--sp-ease-*` | `out (.2,0,0,1)`, `in (.4,0,1,1)`, `inout (.4,0,.2,1)`, `spring (.34,1.32,.64,1)` | `ST:481-484` |
| Landing | `--lp-dur-section 420ms`, `--lp-dur-cine 900ms`, `--lp-ease-cine cubic-bezier(.65,0,.35,1)`, `--lp-dur-glint 3s`; espejo en TS `src/components/landing/motion/tokens.ts` | `GC:619-649` |
| Páginas públicas | redeclaran `--ag-dur-micro 120ms`, `-base 180ms`, `-lento 240ms`, `--ag-ease-out cubic-bezier(0,0,.2,1)`, `--ag-ease-in cubic-bezier(.4,0,1,1)` (juego distinto a propósito, `GC:222-223`) | `AP:79-83` |

**Reglas** (cada una vive aquí; las demás secciones remiten):

1. **Solo `transform` y `opacity`.** Fuentes: `SC:624` (capas), `GC:2192` (cromo), `GC:225-226` (agenda: «nunca
   `height`, `top` ni `width`»), `CLAUDE.md` «Landing pública» regla 2. Diferencia con la regla literal: el verificador de
   la agenda (`PROPIEDADES_PERMITIDAS`, `src/lib/agenda/movimientoAgenda.ts:191-197`) permite además `background-color`,
   `color`, `border-color` y sus variantes por lado, porque solo repintan.
2. **Tope de la agenda: 400 ms** (`TOPE_MOVIMIENTO_MS`, `movimientoAgenda.ts:49`). Excepciones nominales: `ag-barra-carga`
   y `spin` (`movimientoAgenda.ts:181`). La entrada con resorte de 360 ms cumple.
3. Las capas entran con `@starting-style` y salen con la misma transición hacia `data-fase="sale"`; se pueden invertir a
   medio camino (`SC:624-628`).
4. Respuesta al toque: `.k-pulsable:active { transform: scale(.97) }` con `transition: transform var(--dur-toque)
   ease-out` (`SC:328-329`); misma regla en `.k-b`, `.k-seg-op`, `.k-az`, `.sp-btn`, `.sp-chip` (`SC:383`, `SC:525`,
   `SC:876`; `ST:891`). Las filas pulsables usan opacidad `.7`, no escala (`SC:460`).
5. Cromo: nada infinito (`GC:2192`). Bucles declarados: `ag-barra-carga` 1,1 s (`GC:1825`), `skeleton-pulso` 1,4 s
   (`GC:1049-1062`), `rp-late` 1,2 s en páginas públicas (`AP:227-229`), `lp-borde-destello` 3 s.
6. La librería `motion` se usa solo donde hay gesto con velocidad (hoja de `tel`, cajón de `tel`/`iv`; `PLAN:213-214`) y
   en la landing. La landing no admite otras dependencias de movimiento (`CLAUDE.md`, «Landing pública», regla 7).

**`prefers-reduced-motion`** (se implementa junto a cada animación, nunca como parche final; `CLAUDE.md`, regla 3 de la
landing):

| Alcance | Cómo | Línea |
|---|---|---|
| Kit (capas, botones) | sin escala al pulsar; capas pasan a fundido corto de 200 ms (entrada) / 150 ms (salida), sin `transform` | `SC:332-334`, `SC:586-589`, `SC:832-841` |
| Cromo (⌘K, capas «Más») | fundido de 120 / 90 ms; cajón de `tel`/`iv`/`ext` a `opacity` 120 ms | `GC:2759-2761`, `GC:2770-2780` |
| Agenda (FullCalendar y capas) | escotilla única `animation-duration: .01ms !important; transition-duration: .01ms !important; animation-iteration-count: 1 !important` (`.01ms` y no `none`, para que `animationend`/`transitionend` sigan disparando) | `GC:4311-4344` |
| Animaciones por WAAPI (FLIP, fundido) | no las alcanza CSS: miran `prefiereMenosMovimiento()` | `GC:4330-4333`; `movimientoAgenda.ts` |
| Barra de carga de la agenda | regla propia | `GC:1849-1853` |
| Genérico | `[class*="animate-"]:not(.animate-spin) { animation: none !important }` | `GC:9052-9055` |
| Skeleton | `animation: none` | `GC:1063-1065` |
| Scroll suave | solo con `no-preference` | `GC:911-913` |
| Landing | `[data-lp-reveal]` en estado final, `[data-lp-espera]` visible, `[data-lp-paso]` oculto | `GC:9052-9140` |
| Páginas públicas | animaciones dentro de `@media (prefers-reduced-motion: no-preference)` | `AP:151-153`, `AP:227-229`, `AP:292-294` |

Con `prefers-reduced-transparency: reduce` ver 2.1.5.

---

## 3. Formatos de pantalla

Cinco formatos, decididos por el ancho de la ventana y por si el sistema tapa un borde lateral (la franja del iPhone
Duo). Función pura en `FP:54-97`; tabla de cabecera `FP:3-10`; constantes `FP:55-59`.

| Formato | Condición | Dispositivo | Navegación | Toque (`--k-toque`) | Particularidades |
|---|---|---|---|---|---|
| `ext` | franja lateral y ancho < 700 | Duo cerrado | **Riel** `.nav-riel` fijo a la derecha (`--cromo-riel` 60) con «···» y «+» (`GC:2354-2358`); la barra es cajón | 44 | Toda capa es tarjeta centrada (310 como mucho), nunca hoja (`SC:799`; `CALMA` §26); encabezado oculto (`GC:2310`) |
| `tel` | sin franja lateral y ancho < 600 | Teléfono vertical | Encabezado fundido `.nav-encabezado` (título + botón de menú de 44) y cajón `min(300px, 100vw − 56px)` (`GC:2267-2273`, `GC:2388-2389`) | 44 | Hoja inferior arrastrable con asa, `22px 22px 0 0` (`SC:805-815`); campos a 16 px |
| `ih` | franja lateral y 700 ≤ ancho < 1024 | Duo abierto horizontal | **Barra lateral** a la derecha, `--cromo-barra-ih` 216, radio `26px 0 0 26px` (`GC:2414-2424`); encabezado y cajón ocultos | **36** | Bisagra (3.3); se trata como computadora para el toque aunque sea táctil |
| `iv` | sin franja lateral y 600 ≤ ancho < 1024 | Duo abierto vertical | Encabezado fundido con 5 píldoras de 40 (`.nav-pista`, visible desde 600 px, `GC:2284`, `GC:2305`) y cajón con el botón de menú | 44 | Sin franja abajo; composición de `ih` (no «teléfono estirado», `CALMA:113-117`) |
| `esc` | ancho ≥ 1024 | Computadora | **Barra lateral** izquierda `--cromo-barra` 248 (64 plegada, solo en agenda; `GC:2196`, `GC:2212`) (`GC:2407-2412`) | **36** | Títulos de pantalla a 32 px; capas centradas en el área de contenido |

Anchos de alerta por formato: 320 (`tel`), 310 (`ext`), 340 (`ih`/`iv`/`esc`) (`SC:727-729`); medidas de modal 440/480/520
(`CALMA` §25). Sin `data-formato` (páginas públicas y lanzador) las reglas base son las de `tel` y las de `esc` van en
`min-width: 1024px` (`GC:2177-2180`).

### 3.1 Detección

* **Franja lateral** = inset lateral > 0 **o** deducida de `window.screen`: `screen.width − innerWidth` o
  `screen.height − innerWidth` dentro de `[60, 120]` (`FRANJA_MIN 60`, `FRANJA_MAX 120`, `FP:71-79`), solo por debajo
  de 1024 y con la pantalla en vertical (`screen.width < screen.height`). Deducida y sin inset, el borde se da por la
  derecha (`FP:81-89`). Prioridad del borde: derecha, izquierda, deducida, arriba, ninguno.
* **Quién lo escribe:** `SCRIPT_SONDA_FORMATO` (cadena en línea, `FP:139-154`) que `CMP/layout/ScriptTema.tsx:45-51`
  concatena tras el script de tema. Solo lo montan `(app)` (`src/app/(app)/layout.tsx:150`) y `(launcher)`
  (`src/app/(launcher)/layout.tsx:20`); las páginas públicas **no** tienen `data-formato`. Relee en `resize`,
  `orientationchange`, `pageshow` y el primer `requestAnimationFrame`, y emite `spinus:formato` (`FP:61`, `FP:151-153`).
* **Atributos:** `data-formato` ∈ `ext|tel|ih|iv|esc` y `data-borde-sistema` ∈ `derecha|izquierda|arriba|ninguno`
  (`FP:47-52`). Lectores: `leerFormato()`, `leerBordeSistema()`, `alCambiarFormato()` (`FP:107-130`).
* La clasificación está **duplicada** (función `clasificarFormato` y la cadena de la sonda); `formatoPantalla.test.ts`
  ejecuta la sonda contra la tabla (`FP:35-39`).
* **Hidratación:** ningún componente decide su marcado por el formato en el primer render; se aplica **por CSS**
  (`SC:305-306`; `FP:41-44`). Si JS lo necesita, lo lee tras montar.
* Variantes de Tailwind `ext:`, `tel:`, `ih:`, `iv:`, `esc:` (`SC:307-311`); sin `data-formato` no casan nunca
  (`SC:303-304`).
* Dimensiones de referencia de las maquetas (no están en el código): `ext` 466×678 con franja de 84 a la derecha y 34
  abajo; `tel` 393×852; `ih` 951×669 con franja de 84 a la derecha; `iv` 669×951 con franja solo arriba; `esc` 1280×800
  (`BRIEF:38-41`; `CALMA:113-114`). En el aparato real `ext` mide ~382 de 466 y `ih` ~867 de 951 (`FP:15-18`).

### 3.2 Variables de cromo y de franja

| Variable | Valor | Línea |
|---|---|---|
| `--it/--ir/--ib/--il` | `env(safe-area-inset-top/right/bottom/left, 0px)`; en `calc()` siempre, **nunca un número** (`viewportFit: 'cover'`: `src/app/layout.tsx:85`) | `SC:100-103` |
| `--cromo-barra` | `248px` (`esc`); `64px` con `#barra-lateral[data-plegada="true"]` desde 1024 | `GC:2196`, `GC:2210-2212` |
| `--cromo-barra-ih` | `216px` | `GC:2197` |
| `--cromo-riel` | `60px` | `GC:2198` |
| `--cromo-enc` | `64px` (encabezado fundido, sin franja) | `GC:2199` |
| Sin `#barra-lateral` (lanzador) | los cuatro `--cromo-*` a `0px` | `GC:2214-2216` |
| `--cromo-izq` / `--cromo-der` | `0px`; `esc`: `--cromo-izq = --cromo-barra`; `ext`: `--cromo-der = riel + --ir`; `ih`: `--cromo-der = --cromo-barra-ih + --ir`; con franja a la izquierda se espejan | `GC:2250-2255` |
| `--fijo-izq` / `--fijo-der` | `0px`; en `ext`/`ih` con barra = `--cromo-izq` / `--cromo-der` | `GC:2693-2694` |
| `--capa-arr/-der/-abj/-izq`, `--capa-aviso-arr` | por formato (`ext` margen 8, `ih` 24, `iv` 24, `esc` 32, resto 16) | `SC:630-672` |

Las `--cromo-*` son «la única fuente» de las medidas de navegación para todo lo colocado en el área de contenido (capas,
aviso, alerta sin conexión, paleta ⌘K; `GC:2201-2209`, `SC:606-612`). Las capas reciben su relleno de `--capa-*`.

### 3.3 Regla del borde derecho en `ext`/`ih`

**En `ext`/`ih` nada con `position: fixed` toca el borde de la franja salvo el cromo** (`GC:2677-2692`). Razón: con la
franja a un lado, iOS la deja fuera del viewport y la rellena con un color muestreado de la página; un `fixed` que toque
ese borde manda (con el riel navy pegado la franja sale navy; un velo `inset: 0` con desenfoque la volvía blanca).

* Implementación: en `ext`/`ih` con `#barra-lateral`, `.k-capa`, `.nav-capa`, `.nav-paleta`, `.nav-cajon-velo`,
  `.ag-capa-velo`, `.ag-hoja` y `.fixed.inset-0` reciben `left: var(--fijo-izq); right: var(--fijo-der)`
  (`GC:2695-2698`) y su relleno descuenta lo que ya no cubren (`GC:2699-2704`); en `ext` la holgura de la tarjeta de 310
  cede hasta 8 px (`GC:2705-2711`). Con una capa modal abierta, el riel (`ext`) o la barra (`ih`) pasan a
  `pointer-events: none` (`GC:2713-2716`).
* Excepción nombrada: `.sp-firma-modo` tapa la pantalla entera a propósito (`GC:2690-2692`).
* Prueba: `e2e/rediseno-formatos.e2e.ts:202` («con «Más», alerta, ⌘K y consulta rápida abiertos, sólo el cromo toca el
  borde derecho»).

### 3.4 La bisagra de `ih`

* El brief original prohibía cualquier control **fijo** entre x = 455 y x = 496 (`BRIEF:40`). **`CALMA` §18 lo cambia
  solo para las capas** (`CALMA:110-111`; `CALMA:87`): modales, alertas, hojas y menús centrados en `ih` van centrados en
  el área de contenido «sin ninguna maniobra para esquivar x 455–496», con los mismos anchos que en `esc`, «aunque crucen»
  el pliegue (`SC:615` lo repite).
* Lo que sigue vigente y vigilado: `e2e/rediseno-formatos.e2e.ts:109-111` falla si un control **fijo** cae en x 455-496
  en `ih`. En CSS no existe ninguna regla que mencione la bisagra (solo el comentario `SC:615`). Lo que se desplaza sí
  puede pasar (`BRIEF:40`).

### 3.5 Contenedor por formato

`ext` e `ih`: `.agenda-raiz { height: calc(100dvh - 40px - var(--it) - var(--ib)) }` (`GC:2258`). La columna de horas de la
agenda `--cal-hw` vale 44 (`ext`, `tel`), 52 (`ih`, `iv`) y 56 (`esc`) (`SC:248-251`; hoy sin consumidores, ver Deuda).
Celdas del mes `min-height` 104 (78 en `ih`) (`GC:6644-6645`).

---

## 4. Claro y oscuro

* **Mecanismo: la clase `dark` en `<html>`, no `prefers-color-scheme`** (`SC:15-17`; decisión del dueño, `CALMA` §31.3).
  El tema vive en `localStorage.theme`; `ScriptTema` lo aplica antes del primer pintado con
  `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
  (`CMP/layout/ScriptTema.tsx:43`). `ThemeProvider.toggle` escribe `localStorage`, conmuta la clase (`TP:161-173`) y
  reescribe `<meta name="theme-color">` (`TP:36-52`).
* **Alcance por estructura:** el script se monta solo en los layouts que montan el proveedor de tema, `(app)` y
  `(launcher)`; **no** en el layout raíz (`ScriptTema.tsx:1-27`, donde se documenta el error de ponerlo en la raíz).
* `html.dark` declara `color-scheme: dark` (`SC:191`). **Un solo oscuro, navy** (`SC:153-192`; `PLAN:163-171`). La hoja de
  traducción de clases Tailwind/hex a tokens vive en `TP` (bloque `html.dark`, desde ~`TP:210`) y en la «Ampliación» de
  `GC:9214`.
* **Marca en oscuro:** `--sp-primary` → `oklch(from var(--cs) 0.55 c h)`, `--sp-primary-text/-ink` → `0.70`, hover `0.49`,
  active `0.43` (`ST:763-810`); `--accion` oscuro de la marca de clínica `0.55` y `--navy` oscuro `hsl(from var(--cp) h s
  12.5%)` (`TP:131-135`, `TP:132`). Respaldo sin sintaxis de color relativa: bloque `html.dark` de `ST:499-708`.
* **Zonas SIEMPRE en claro (y por qué):**

| Zona | Mecanismo | Línea |
|---|---|---|
| Páginas públicas de la agenda (`/reservar`, `/confirmar`) | sin `prefers-color-scheme`; `html:has(.rp){color-scheme:light}` y `body:has(.rp){color-scheme:light}`; `body:has(.rp)` redeclara en claro cada `--ag-*` que usa y que `html.dark` cambia; exportan `viewport = { colorScheme: 'light', themeColor: '#163250' }`. Razón: no montan `ScriptTema`, pero `html.dark` puede quedar colgada si el médico llega desde la app sin recargar (`AP:19-28`). Vigilado token a token por `agendaPublicaTokens.test.ts` | `AP:36`, `AP:38-83`; `src/app/reservar/[codigo]/page.tsx:41`; `src/app/confirmar/[codigo]/page.tsx:61` |
| Correos de la agenda | `<meta name="color-scheme" content="light">`, `supported-color-schemes`, `:root{color-scheme:light}`; sin `prefers-color-scheme` | `PC:36-37`, `PC:256-259` |
| Landing | `--lp-*` no se redeclara bajo `html.dark`, nunca; la clase `dark` puede quedar colgada al salir de `(app)` | `GC:650-660` |
| Páginas sin tema (`/pricing`, `/register`, contraseña, legales) | fijan su fondo claro a mano y no reciben `html.dark` | `ScriptTema.tsx:1-27` |

---

## 5. Catálogo de piezas

**Cómo leer esta sección.** Cada ficha da: pieza · `archivo:línea` · qué es y cuándo se usa · cuándo NO (solo si el propio
código o los documentos lo dicen, con su fuente) · accesibilidad. Los conteos de consumidores son de archivos con coincidencia
de texto (grep); no son contractuales. «**Vigente**» se escribe solo cuando el código o un documento lo señala; si no hay
evidencia, la ficha dice «sin pieza única: ver Deuda».

**Antes de crear una pieza nueva:** confirma que ninguna de esta sección sirve. Crear una nueva, o un factory/contexto/hook
genérico, exige OK explícito (`CLAUDE.md`, Protocolo 4); la duplicación es preferible a una abstracción especulativa.

### 5.1 Botones y acciones

**Familia `.k-b` (vigente: el kit; `CALMA` §2, `SC:361-369`).** Cuatro niveles, «usa el más bajo que sirva». Primario «UNO
por pantalla, sin sombra» (`SC:362`); tonal «como mucho uno junto al primario» (`SC:363`); texto «el nivel por defecto»
(`SC:364`); icono «lleva `aria-label` siempre» (`SC:365-366`). Si hay más de dos acciones, la tercera va a «···»
(`CALMA:19`). Dentro de una capa las acciones son botones, nunca texto suelto (`CALMA` §13).

| Clase (se suma a `.k-b`, `SC:370-377`) | Aspecto | Línea |
|---|---|---|
| `k-b-prim` | relleno `--accion`, texto `--sobre-accion`, sin sombra | `SC:388` |
| `k-b-tonal` | `--tonal`/`--tonal-tinta`, 36 px (32 en `ih`/`esc`) | `SC:389-390` |
| `k-b-quieto` | `--sup2`/`--tinta` | `SC:391` |
| `k-b-mal` | `--mal-fondo`/`--mal-tinta` (destructivo) | `SC:392` |
| `k-b-texto` | color `--enlace`, hover subrayado | `SC:393-394`, `SC:408` |
| `k-b-icono` | `--k-toque`², glifo 20 en `--tinta2` | `SC:395-398`, `SC:409` |
| `k-b-capa` | alto 44 (40 en `ih`/`esc`): botón dentro de una capa | `SC:400-401` |

* A11y: `:focus-visible` contorno 3 px `--enlace`, offset 2 (`SC:384`); `:disabled`/`aria-disabled="true"` opacidad `.45`
  (`SC:385`); área de toque por `::after`. El nombre accesible lo pone quien la usa.
* Cuándo NO: el botón no lleva `flex: 1 1 0` ni `overflow: hidden` (`SC:344-349`; `PIEZAS` §13.3).
* `.k-pulsable` (`SC:328-329`): solo la respuesta al toque; sin escala con movimiento reducido (`SC:332-334`).

**Cadenas de la configuración de la agenda** (`AGC/estilosConfig.ts`; son cadenas de clases, no componentes): `BOTON_AZUL`
(`:81`, «el ÚNICO botón relleno de la pantalla», `:79-80`), `BOTON_BLANCO` (`:84`), `BOTON_CHICO` (`:88`), `BOTON_TEXTO`
(`:91`), `BOTON_TEXTO_ROJO` (`:94`), `CAMPO_NUEVO` (`:97`), `SELECTOR` (`:100`), `opcion(elegida)` (`:109-113`). Ver 5.3
para tarjetas y filas de esa hoja.

**`Interruptor`** — `AGC/Interruptor.tsx:34`. `role="switch"` + `aria-checked`, pista 52×30, bola de 24, área de toque 46;
nombre por `etiquetadoPor` o `etiqueta` (`:10-11`); encendido `--accion`, apagado `--tinta3` al 38 % sobre `--sup2`
(`:19-24`). Consumidores: `EditorDias`, `PestanaEnlace`, `BloquesAvisos`, `MenuEngraneAgenda`. **Sin pieza única:** otros
`role="switch"` escritos a mano (ver Deuda).

**`BotonNoEsCita`** — `CMP/agenda/BotonNoEsCita.tsx:36`. «¿No es una cita?»; un clic, sin confirmación; error debajo con
`role="alert"`. Solo para filas «por asignar» (`esPorAsignar`, `:11-14`); se monta en el formulario, «Próximas citas» y el
aviso de la campana. **`BotonBloquearHorario`** — `CMP/agenda/BotonBloquearHorario.tsx:23`: candado de la barra de la v2;
va en el chunk de la barra, nunca importado en estático desde `AgendaCliente` (`CLAUDE.md`, tanda L).

### 5.2 Campos y formularios

**`.k-campo-g` / `.k-etiqueta` / `.k-campo` / ayuda / error** (`SC:416-437`; vigente: el kit).

* Grupo en columna con 4 px de hueco (`SC:416`); etiqueta **encima**, 13/18 600 `--tinta2` (`SC:417`); campo de 44 px (40 y
  15 px en `ih`/`esc`), relleno `--sup2`, **sin borde**, radio `--r-control`, letra 16/20 (`SC:418-423`); `textarea.k-campo`
  alto mínimo 120 (`SC:434`); `.k-campo-ayuda` 13/18 `--tinta2`; `.k-campo-error` 13/18 600 `--mal-tinta` (`SC:436-437`).
* A11y: foco = contorno 2 px `--enlace` (`SC:425`); `aria-invalid="true"` = contorno 2 px `--mal-tinta` (`SC:426`). El
  `label htmlFor`/`id` y el enlace del mensaje de error los pone quien la usa (ejemplo: `CMP/ui/QuickPatientModal.tsx:31`,
  `useId`).
* Regla: letra 16 en táctil «evita el zoom de iOS» (`SC:414-415`). `.k-placeholder` usa `--tinta3` (ver Deuda).
* `.k-campo-sin-caja` (`SC:427-433`): campo sin caja dentro de una fila (pacientes, perfil, consultorios). En oscuro, la
  hoja `html.dark input` (con `!important`, sin capa) le pone caja `--sup2`; hay que dejar la clase dentro de `@layer`
  (`SC:428-431`).

**Piezas de campo con su propia pieza:**

| Pieza | Archivo:línea | Qué es / cuándo | A11y |
|---|---|---|---|
| `ComboEscribible` | `CMP/documentos/ComboEscribible.tsx` (se viste con `sp-input`, `:157`) | desplegable escribible con sugerencias; «patrón de referencia del sistema» (`:9-10`) | `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-invalid` (`:142-148`); lista `role="listbox"`, opciones `role="option"` + `aria-selected` (`:166-179`) |
| `CIE10Combobox` | `CMP/ui/CIE10Combobox.tsx:27` | autocompletado CIE-10 (≥ 3 caracteres, debounce 300 ms, ↑↓/Enter/Esc; `:17-24`); 1 consumidor | sin comprobar (ver sección 10) |
| `EspecialidadSelector` | `CMP/ui/EspecialidadSelector.tsx:33` | hasta dos especialidades: la primera en desplegable cerrado, la segunda `ComboEscribible` (`:11-23`); 2 consumidores | las del combo |
| Rejilla «Tipo de documento» | `SC:858-895`; la dibuja `CMP/documentos/SelectorTipoDocumento.tsx` | celdas `.k-az` `--sup`, radio 14, `min-height` 84 (88 con contenedor ≥ 520 px), 2 columnas, 4 desde 520 px; el tipo actual con `inset 0 0 0 2px --accion` (`SC:877`); línea plegada `.k-az-linea` (`SC:883-893`) | `role="tablist"` + `aria-label="Tipo de documento"`, celdas `role="tab"` + `aria-selected` + `aria-controls` (`:250-262`), panel `role="tabpanel"` (`:297`) |

**Campo heredado `.sp-input`/`.sp-textarea`** (`ST:1030`, `ST:1048`): mismo relleno y foco que `.k-campo`, con borde de 1 px
transparente; lo usan `ComboEscribible`, `EspecialidadSelector` y los formularios de documentos. **Sin pieza única de campo**
(ver Deuda).

### 5.3 Tarjetas, filas y listas

* **`.k-tarjeta` / `.k-lista`** — `SC:439-444`, `SC:450-451`. Fondo `--sup`, radio `--r-tarjeta` (`--r-tarjeta-ancha` en
  `ih`/`iv`/`esc`), `padding: 16px` (20 en ancho), **sin borde ni sombra**. `.k-tarjeta.k-lista` pone el relleno en las
  filas. 25 archivos con `k-tarjeta`, 22 con `k-lista`. Regla: «sin sombras en tarjetas ni botones» y «nada de caja dentro
  de caja»; los datos de una tarjeta van como lista «rótulo — valor» con `--linea` (`CALMA` §3, `CALMA:28`).
* **`.k-fila`** — `SC:452-466`. `min-height` 56 (52 en `ih`/`esc`), `gap 12`. Si es `a`/`button` es pulsable y responde con
  **opacidad `.7`, no escala** (`SC:459-460`). Subpiezas `.k-fila-t`, `-n`, `-s`, `-der`, `-chev` (chevron 16 px `--tinta3`).
  Regla: «la fila entera es pulsable y termina en `›`» (`SC:447`); **no lleva botón propio** salvo que tenga dos destinos
  distintos (`CALMA:20`). 7 archivos.
* **Piezas de cita del dashboard** — `CMP/dashboard/PiezasCita.tsx`: `TARJETA` (`:27`, `rounded-[16px] bg-sup p-4`, 20/`p-5`
  en `ih`/`iv`/`esc`), `FechaChip` (`:56`, chip 52×50, `aria-hidden`), `MarcasCita` (`:72`), `PiezaPrincipal` (`:111`,
  `<section aria-label="Lo que sigue">`), `FilaCita` (`:174`), `FilaCitaClinica` (`:190`), `BotonEstados` (`:211`),
  `HojaCita` (`:246`, `ModalShell`). Regla del archivo (`:9-12`): no conoce ninguna URL clínica («un `grep` de
  `expediente` aquí debe dar cero»). Consumidor único: `ProximasCitas.tsx`.
* **Piezas de las tarjetas del dashboard** — `CMP/dashboard/piezasBanda2.tsx`: `CabeceraTarjeta` (`:76`, `<h2>` 17/700 +
  enlace `k-b-texto`), `ChipAccion` (`:47`), `AvisoTarjeta` (`:94`). Otras tarjetas: `TarjetaHoy`, `HoyEnConsultorio`,
  `AtendidosRecientemente`, `DocumentosRecientes`, `UltimosPacientes`, `BuscadorPaciente` (`ALTO_CONTROL = 'h-11 ih:h-10
  esc:h-10'`, `:11`).
* **Tarjetas y superficies de la configuración de la agenda** — `AGC/estilosConfig.ts`: `TARJETA` (`:33`), `SUPERFICIE`
  (`:36`), `LISTA` (`:45`), `BLOQUE` (`:51`), `ROTULO` (`:54`, 13/700 mayúsculas `text-enlace`), `PIE` (`:57`), `FILA`
  (`:60`, `min-h-[48px]`), `FILA_ACCION` (`:66`), `CAJA_AVISO` (`:106`), `AVISO_SOLO_ADMIN` (`:133`), textos fijos
  `SOLO_ADMIN` (`:125`), `SOLO_ADMIN_HORARIO` (`:128`), `SOLO_ADMIN_TIPOS` (`:129`).
* **Sin pieza única de tarjeta:** además de `.k-tarjeta` existen `.sp-card` (`ST:992`), `TARJETA` de `PiezasCita`, `TARJETA`/
  `SUPERFICIE` de `estilosConfig` y el contenedor de `EstadoVacio` (ver Deuda).

### 5.4 Etiquetas, píldoras y estados

| Pieza | Archivo:línea | Qué es / cuándo | Reglas y a11y |
|---|---|---|---|
| `.k-etq` (+ `-ok`, `-mal`, `-aviso`, `-tonal`) | `SC:468-481` | etiqueta de estado: alto 24, `padding 0 8px`, radio 8, 12/16 600, icono de 14; neutra `--sup2`/`--tinta2`. 26 archivos | «Como mucho dos juntas» (`SC:469-470`); píldoras con fondo **solo** para estado que cambia una decisión; contadores, códigos, tipos y fechas van como texto plano en `--tinta2`; máximo un chip por fila (`CALMA` §3). Alergias: etiqueta icono + texto `--mal-tinta` sobre `--mal-fondo`, no bloque sólido (`CALMA:25`) |
| `IconoEstadoCita` | `CMP/ui/IconoEstadoCita.tsx:69` (+ `.k-est*`, `SC:540-560`) | círculo de 26 px (24 `compacto`) con icono de 15 y texto 12/600. Props `estado`, `texto?: 'ancho' \| 'siempre' \| 'nunca'` (defecto `'ancho'`), `compacto?`, `className?` (`:61-67`). El texto sale de `STATUS_CONFIG` (`src/lib/agenda/tarjetasAgenda.ts`) | `texto="nunca"` → `role="img"` + `aria-label` (`:78`); `'ancho'`: texto visible solo en `ih`/`iv`/`esc`, en `ext`/`tel` queda para el lector (`SC:557-560`). 7 consumidores |
| `IconoTipoDocumento` | `CMP/ui/IconoTipoDocumento.tsx:62` (+ `.k-doc*`, `SC:562-577`) | props `tipo`, `nivel?: 'lista' \| 'rejilla'`, `className?`; acepta el tipo de la base o la clave corta (`:26-40`); desconocido = `otro` gris | decorativo (`aria-hidden`, `:67`): el nombre va al lado. **Color de documento solo en esos dos niveles** (2.1.4) |
| `MarcaOrigen` | `CMP/ui/MarcaOrigen.tsx:68` (+ `.k-origen`, `SC:579-582`) | `origen: 'enlace' \| 'google'`, `corto?`, `soloIcono?`. Exporta `IconoGoogleCalendar` (`:45`, `size?`): el ÚNICO icono de Google fuera de «Continuar con Google» del login y el registro (corrección 6); sin `size` lo mide `.k-origen svg`. Textos «Reservó por enlace» / «Agendada desde Google Calendar» (`:27-30`). Lo usa `PiezasCita.tsx:78` | `soloIcono` → `role="img"` + `aria-label` (`:63`) |
| `MarcasCita`, `MarcaOrigenGoogle` | `CMP/agenda/MarcasCita.tsx:60`, `MarcaOrigenGoogle.tsx:32` | marcas de procedencia de la agenda (expediente tachado, eslabón, icono de Google Calendar; la «G» se retiró en la corrección 6 y queda solo en el login y el registro, `/google/boton-g.svg`). Solo con v2 (`:19-21`); `MarcaOrigenGoogle` se ve solo dentro de `.agenda-raiz[data-agenda-v2="encendida"]` por CSS | `decorativa` → `aria-hidden`; si no, `role="img"` + `aria-label` |
| Distintivos de navegación | `.nav-distintivo` (`GC:2327`), `.nav-distintivo--avisos` (`GC:2351`); `RielNavegacion.tsx:78`, `EncabezadoFundido.tsx:86`, `CampanaAvisos.tsx:112` | número ámbar sobre «···» o el botón de menú; rojo en la campana | el número va en el `aria-label` (`nombreBotonMas`, `RielNavegacion.tsx:53-56`; `etiquetaCampanaGlobal`, `CampanaAvisos.tsx:45`) |

**Marcas de procedencia: sin pieza única** (tres sitios y dos `IconoEnlace`; ver Deuda).

### 5.5 Pestañas y segmentados

* **`.k-tabs` / `.k-tab`** — `SC:483-507`. Subrayado inferior `inset 0 -1px --borde`, desplazamiento horizontal si no caben
  (nunca encoge la letra, `SC:488-489`); pestaña 44 (40 en `ih`/`esc`), 14/18 (13 en `ext`), activa 600 con barra de 2 px
  `--accion`; activa por `aria-selected="true"` **o** `aria-current="page"` (`SC:505-506`); `data-t` reserva el ancho de la
  negrita (`SC:500`). **No hay componente genérico** (`CMP/perfil/PestanasPerfil.tsx:14` dice que «una base genérica» no
  se hizo a propósito): tres pestañas escriben su marcado con la clase: `CMP/expediente/PestanasExpediente.tsx:50`,
  `CMP/perfil/PestanasPerfil.tsx:51` y `AGC/PestanasConfiguracion.tsx:91`. Patrón APG completo solo en la última
  (`role="tab"`, `aria-selected`, `aria-controls`, `tabIndex` itinerante, `onKeyDown`, `:91-97`; paneles `role="tabpanel"`
  `:109`). **Sin pieza única de pestañas.**
* **`SelectorSegmentado`** — `CMP/ui/SelectorSegmentado.tsx:28` (+ `.k-seg`, `SC:509-527`). Props `opciones`
  (`{ valor, rotulo }`), `valor`, `onChange`, `etiqueta`, `className?`. Pista `--sup2` de 32 px, opción activa blanca
  (`--sup`) 600. A11y: `role="group"` + `aria-label` y `aria-pressed` (`:39`, `:44`). **Cuándo NO** (`:7-18`): no sustituye a
  `.sp-doc-segmented`, que es un **campo** de formulario (activa rellena); éste es cromo de vista. Sin pastilla deslizante
  (no se anima `left`/`width`). 3 consumidores (`LineaTiempoClinica`, `SeccionDocumentosLabs`, `FiltroMediciones`) y 5
  archivos con `.k-seg` a mano (ver Deuda).

### 5.6 Capas

**Dos familias conviven:** `.k-capa*` (`SC:674`; la usan `ModalShell`, `CapaMenu`, `QuickPatientModal`,
`ConsultaRapidaModal` y la alerta de `ConfirmModal`) y `.ag-capa*`/`.ag-hoja` (`GC:7242`, `GC:7334`; ~19 archivos de
agenda y avisos). **Un solo velo a la vez:** el velo de una `.k-capa` abierta sobre otra se hace transparente
(`SC:693-695`). Medidas comunes de `CALMA` §25.

**Esqueleto `.k-capa`** (`SC:674-696`): `position: fixed; inset: 0` con relleno por formato (`--capa-*`); `.k-velo`
(`SC:683-689`, el único velo con desenfoque); `.k-capa-panel` (`SC:697-708`, radio `--r-tarjeta-ancha`, `--sombra-capa`).
Atributos: `data-fase` = `abierta | sale`; `data-modo` = `hoja | completa | pop | arriba`; `data-variante` = `alerta`
(`SC:598-602`). Subpiezas: `.k-capa-asa` (`SC:711`), `-cab` (`:712`), `-tit/-sub` (`:713-715`), `-ico`, `-acc`, `-cuerpo`
(`:718`, el scroll interno), `-pie` (`:719`). Reglas escritas: la tarjeta va centrada en el **área de contenido** (`SC:604-622`);
en `ext` ninguna capa es hoja inferior (`SC:799`); la hoja arrastrable es solo de `tel` (`SC:805-815`); `.k-capa` va **sin
`@layer`** a propósito y sin `z-index` ni `max-width` en la base (`SC:619-622`).

| Pieza | Archivo:línea | Qué es y cuándo | Cuándo NO / reglas | A11y |
|---|---|---|---|---|
| **`ModalShell`** (modal y alerta; **vigente** para ambos: es la base de la alerta del catálogo, `CALMA:84-88`) | `CMP/ui/ModalShell.tsx:336` | Props (`:246-286`): `open`, `onClose`, `title`, `subtitle?`, `icon?`, `iconBg?`, `headerRight?`, `maxWidth?`, `elevated?`, `hideClose?`, `footer?`, `fullscreenMobile?`, `spinusGeometry?`, `variante?: 'alerta'`, `tono?: 'confirmar' \| 'destruir' \| 'avisar'`, `apilada?`, `rol?`, `cierraConVelo?` (defecto `true`). Modo alerta (`CuerpoAlerta`, `:318`): icono 28 en círculo de 48, título centrado, mensaje justificado. 40 archivos | `cierraConVelo={false}` **en toda capa con campos editables** (decisión del dueño, `:273-284`). La alerta: el velo NO cierra, Esc sí (`:19-26`, `:383`); `autoFocus` en el principal, o en «Cancelar» si destruye | `role` `dialog`/`alertdialog` + `aria-modal` + `aria-labelledby` + `tabIndex={-1}` (`:386-392`); foco atrapado y Escape (`teclaDelModal` `:188`, `useFocoDelModal` `:211`; solo cierra el modal más interno); bloqueo de scroll del `body`; foco vuelve al disparador; `inert` mientras sale (`:381`); hoja de `tel` con `useArrastreHoja` (`:155`) |
| **`ConfirmModal`** | `CMP/agenda/ConfirmModal.tsx:91` | con `verbo` → `AlertaCatalogo` (`:62`): la alerta del catálogo con título partido (`partirPregunta`, `:47`); principal rojo (`k-b-mal`) si `icono` es `cancelar`/`eliminar`, si no `k-b-prim`; `autoFocus` en el secundario (`:79`). Sin `verbo` → `ConfirmacionClasica` (`:96`) | **Con la v2, toda confirmación es la alerta del catálogo con su VERBO** (`CLAUDE.md`, B13; `CALMA` §29.3-§29.4: «Volver» si cancela algo, verbo concreto en el principal). «Aceptar» solo con la v2 apagada | `role="dialog"` + `aria-modal` + `aria-labelledby` + `useDialogoModal` (`:62-74`) |
| **`CapaMenu`** | `CMP/ui/CapaMenu.tsx:132` | «···», orden, filtros y selectores: lo que se usa poco (`:14`). API (`:20-58`): `abierto`, `alCerrar`, `ancla`, `titulo`, `opciones` (`{ id, texto, icono?, detalle?, peligro?, marcada?, deshabilitada?, alElegir }`), `seleccion?`. Por formato: `esc` desplegable anclado sin velo; `ext`/`ih`/`iv` tarjeta de 280 con velo; `tel` hoja corta (`:66-70`). `peligro` va al final, en rojo (`:155-157`). 5 consumidores | **«Más» del cromo NO usa `CapaMenu`** (lleva tarjeta ámbar, filas que despliegan, enlaces reales: `layout/MenuMas.tsx:13-21`) | `role="menu"` + `aria-label`, `menuitem`/`menuitemradio` + `aria-checked`, `role="separator"`; ↑ ↓ Inicio Fin; Enter/Espacio elige; Esc y Tab cierran y devuelven el foco (`:77-117`, `:177`). El disparador (del consumidor) lleva `aria-haspopup="menu"`, `aria-expanded`, `aria-label` (`:30-32`) |
| `QuickPatientModal` | `CMP/ui/QuickPatientModal.tsx:47` | alta rápida de paciente; monta su propia `.k-capa` (`:243`, `data-modo="hoja"`, `z-[70]`) con la alerta «Paciente duplicado» (`k-al-pila`); el velo NO cierra (`:245-246`); sin salida animada a propósito (`:233-236`). 5 consumidores | — | botón «Cerrar» con `aria-label` (`:300`); en el marcado leído **no hay** `role="dialog"`, `aria-modal`, foco atrapado ni Escape (ver Deuda) |
| `ConsultaRapidaModal` | `CMP/launcher/ConsultaRapidaModal.tsx` | buscador/registro rápido, `.k-capa` con `data-modo="arriba"` (`SC:793-796`); lo monta `Sidebar` | — | `role="dialog"`, `aria-modal`, `aria-label` (`:292-293`); Escape (`:134`) y Tab atrapado (`:73`) |
| `OfflineAlert` | `CMP/ui/OfflineAlert.tsx:77` | «Sin conexión»: alerta sin botones ni descarte; aparece tras 4 s sin red y se va sola. 1 consumidor | excepción aprobada del patrón de alerta (`:17-19`) | `role="alertdialog"`, `aria-modal`, `aria-labelledby`/`-describedby` (`:97-100`) |
| `useDialogoModal` | `src/hooks/useDialogoModal.ts:99` | devuelve `{ montarPanel, alPulsarTecla }` (`:164`): foco inicial, foco devuelto al cerrar, Escape, Tab atrapado con `focusablesDelPanel` (solo `tabIndex >= 0`). 15 archivos de agenda/avisos | **no bloquea el scroll del body** (`:38-43`); «ES LA TERCERA COPIA DE ESTA LÓGICA… SE SABE Y ES DELIBERADO» (`:20-32`) | foco y teclado |
| `Portal` | `CMP/ui/Portal.tsx:6` | monta `children` en `document.body` tras el primer render. 21 archivos | `CapaMenu` no lo usa a propósito (usa `createPortal`, `CapaMenu.tsx:164-178`) | — |
| `CapaBarra` | `CMP/agenda/CapaBarra.tsx:63` | capa que cuelga de un botón de la barra de la agenda v2 (campana, engrane, leyenda), en `Portal`, `.ag-capa` + `.ag-capa-barra-velo`. Solo en `esc` se coloca bajo el botón con su borde derecho (`colocarBajo`, `:7-26`); en los demás formatos es tarjeta centrada u hoja por CSS (`GC:8410-8423`). 3 consumidores | no cierra por fuera si hay otro diálogo modal abierto (`:76`) | `role={rol}`, `aria-label`, `aria-modal` si `dialog`, `tabIndex={-1}` (`:91`) |
| Capas de la agenda ligadas a una cita | `TarjetaLectura` (`CMP/agenda/TarjetaLectura.tsx`), `BurbujaCita` (`:375`), `BurbujaAlta`, `VentanaLigarCita` (`:291`), `CapaMasEventos`, `MenuEngraneAgenda`, `HerramientasV2`, `ModalBloqueo`, `HorarioModal`, `AppointmentModal`, `ModalInvitacionCita`, `ConvertirEnCita`, `AyudaAtajos` | la tarjeta de lectura pone el diálogo y el sitio y pinta `BurbujaCita`; qué acción va dónde lo decide `burbujaDeTarjeta`/`disposicionDeTarjeta` (`accionesTarjeta.ts`); no metas reglas de acción en la burbuja (`CLAUDE.md`, K5). `VentanaLigarCita` va **siempre** con `next/dynamic` | La tarjeta al pasar el ratón **no** es modal ni toca el foco: sin `aria-modal` ni `useDialogoModal` (`CLAUDE.md`, T1-T3) | `role="dialog"` (`TarjetaLectura.tsx:274`; `VentanaLigarCita.tsx:317`); acciones de la burbuja en `role="toolbar"` con foco itinerante |

**Qué capa para qué** (solo lo que dicen `CALMA` y el código): confirmación o alerta → alerta del catálogo (`ModalShell
variante="alerta"` o `ConfirmModal` con `verbo`); lo poco frecuente («···», filtros, orden) → `CapaMenu`; formulario modal →
`ModalShell` con `cierraConVelo={false}` si tiene campos editables. **Sin pieza única de alerta ni de menú** (hay variantes
paralelas; ver Deuda).

### 5.7 Navegación

Todo el cromo lo compone `CMP/layout/Sidebar.tsx:589` y se lo pasa por props a piezas presentacionales; se pinta siempre y el
CSS (`.nav-*`) esconde lo que no toca por formato (`RielNavegacion.tsx:14-17`: el formato no existe en el servidor).

| Pieza | Archivo:línea | Qué es | A11y |
|---|---|---|---|
| `Sidebar` | `CMP/layout/Sidebar.tsx:589`; `entradasNav` `:103` | monta encabezado, riel, velo del cajón, `<aside id="barra-lateral" class="nav-barra">`, `MenuMas` y `ConsultaRapidaModal`. Entradas por rol: Inicio `/dashboard`, Expediente, Agenda; médico además Documentos y Administración | `<nav aria-label="Navegación principal">` (`:254`), `aria-current="page"`; plegada → `aria-label` + `title` (`:263`); Escape cierra el cajón (`:217`) |
| `RielNavegacion` | `CMP/layout/RielNavegacion.tsx:58` | riel navy de `ext`: iconos de 22, «···» Más y «+» del rol («Nueva consulta» / «Agendar cita», `Sidebar.tsx:615-617`) | cada enlace `aria-label` + `aria-current`; «Más» `aria-haspopup="dialog"` + `aria-expanded` |
| `EncabezadoFundido` | `CMP/layout/EncabezadoFundido.tsx:75` | banda navy de `tel`/`iv` (menú, título o píldoras, campana, avatar) | botón «Abrir menú» con `aria-expanded` + `aria-controls="barra-lateral"` (`:76-77`; el nombre es el mismo en `iv`, `:20-23`); `<nav aria-label="Secciones">` (`:54`) |
| Barra lateral / cajón | `Sidebar.tsx:629-646`, `BotonPlegar` `:401` (clave `spinus.barra.plegada` `:153`) | `ih`/`esc`: barra fija (plegable solo en agenda); `tel`/`iv`/`ext`: cajón | «Cerrar menú», «Plegar menú»/«Desplegar menú» con `aria-expanded` (`:245`, `:404-405`) |
| `MenuMas` | `CMP/layout/MenuMas.tsx:54` | tarjeta «Más» con velo, centrada en el área de contenido; se monta solo abierta o saliendo | `role="dialog"`, `aria-modal`, `aria-labelledby`, Esc cierra y el foco vuelve (`:39-52`). Sin trampa de Tab (ver Deuda) |
| `CommandPalette` | `CMP/CommandPalette.tsx:63` | paleta ⌘K / Ctrl+K: busca paciente por nombre o documento por folio y registra paciente; clases `.nav-paleta*` | `role="dialog"`, `aria-modal`, `aria-label` (`:256`); input con `aria-label` (`:350`); Escape (`:94`); ↑↓ (`:179`). Sin trampa de Tab |
| `ScriptTema` / `ThemeProvider` | `CMP/layout/ScriptTema.tsx:45`; `CMP/layout/ThemeProvider.tsx:140` | script de tema y proveedor de marca. «ESTO NO VA EN EL LAYOUT RAÍZ» (`ScriptTema.tsx:11-12`); solo `(app)` y `(launcher)` | — |
| `PageTransition` | `CMP/layout/PageTransition.tsx:5` | `div key={pathname} class="animate-page-enter"` | — |

Regla: «Abrir menú» es el nombre del botón en `tel` e `iv` porque las e2e y la banda de la agenda lo usan
(`EncabezadoFundido.tsx:20-23`). El acento «+» del riel: «si la navegación ya ofrece esa acción en ese marco, no la repitas
en el contenido» (`CALMA:10`). **Sin pieza única de menú desplegado** (cuatro implementaciones; ver Deuda).

### 5.8 Avisos y notificaciones

* **Emergentes (`Toast`)** — `CMP/ui/Toast.tsx`. Pieza propia, sin librería externa. `ToastProvider` (`:51`) y `useToast()`
  (`:201`) devuelven `{ success, error, info, warning }(msg: string)`. Duraciones: `success` 4000, `info` 4000, `error` 8000,
  `warning` 8000 ms (`:21`); salida 240 ms. Caja de máx. 400 px, radio 14, `--sombra-capa`; icono en círculo de 28 con tinta
  semántica del kit (`TINTA_ICONO`, `:34-39`; «info» usa `--sup2`/`--tinta2`, no `--tonal`, para no heredar la marca,
  `:28-33`). Posición: arriba y centrada en el área de contenido (`ZonaAvisos`, `:96`; `--capa-aviso-arr`, `--capa-izq`,
  `--capa-der`), el más nuevo arriba, `z-[var(--z-aviso)]` = 10000. Montaje: `(app)/layout.tsx:157`, `(launcher)/layout.tsx:21` y
  `super-admin/dashboard/layout.tsx:37`. 38 archivos lo importan. A11y: zona `aria-live="polite"` (`:99`); cada aviso
  `role="status"` (éxito, info) o `role="alert"` (error, advertencia) (`:163`); botón `aria-label="Cerrar aviso"`; el reloj se
  pausa con puntero o foco dentro (`:113`); Esc cierra el aviso con foco (`:168`). Entrada/salida por `@starting-style`,
  solo `translate` y `opacity`.
* **Campana global** — `CMP/avisos/CampanaGlobal.tsx:24` + `CampanaAvisos.tsx:78`. La monta `(app)/layout.tsx:213` solo con la
  v2 encendida; en `/agenda` no se pinta (`:26-27`, para no repetir burbujas). El botón (`Bell` 20) va por portal a las ranuras
  `[data-ranura-campana]` de la navegación (`Sidebar.tsx:240`, `EncabezadoFundido.tsx:88`, `RielNavegacion.tsx:72`). Contador
  `textoContador` (`:51`): «9+» con más de 9. Relee cada `SONDEO_MS = 120_000` con la pestaña visible (`:39`). Panel
  `PanelAvisos` (`:127`) sobre `CapaBarra`. A11y: `aria-label={etiquetaCampanaGlobal(…)}` con el número en el nombre,
  `aria-haspopup="dialog"`, `aria-expanded` (`:104-105`).
* **Campana de la agenda** — `CMP/agenda/CampanaAgenda.tsx:124`: burbuja roja numérica (`.ag-campana-punto`,
  `data-punto-rojo`, `:160`) = por confirmar + avisos; panel con dos pestañas «Por confirmar» y «Avisos» (`role="tablist"`
  `:254`, `role="tab"` `:248`, `role="tabpanel"` `:201`; flechas, Inicio, Fin). `aria-label` con el número exacto
  (`etiquetaCampana`, `:72`). 1 consumidor: `AgendaCliente`.
* **`ListaAvisos`** (`CMP/avisos/ListaAvisos.tsx:85`) e **`InterruptorMisAvisos`** (`InterruptorMisAvisos.tsx:40`,
  `role="radiogroup"` `aria-label="Qué avisos ver"`, `:44`). Vacío «No hay avisos sin revisar.» con `data-avisos-vacio`
  (`:98`). Para mostrarlos en otra página: `useAvisosClinica()` + `<ListaAvisos>` sin `alAbrir` (`CLAUDE.md`, tanda I).

### 5.9 Carga, vacío y error

| Pieza | Archivo:línea | Qué es y cuándo | Reglas y a11y |
|---|---|---|---|
| `EstadoVacio` | `CMP/ui/EstadoVacio.tsx:58` | props `icono`, `titulo`, `descripcion?`, `accion?`, `variante?: 'pagina' \| 'seccion'`. `pagina`: tarjeta `--sup`, icono 24 en círculo tonal de 48, `<h2>` 17/22 700, línea 14/20 `--tinta2`, acción tonal; `seccion`: sin caja, una línea. Entra subiendo 8 px con `--resorte-entra` (`:43-48`). 8 archivos | la acción es **TONAL a propósito** (el único relleno de la pantalla es el de su cabecera); no mueve el foco; la pantalla pone `aria-live="polite"` si quiere anunciar (`:12-18`) |
| `EstadoError` | `CMP/ui/EstadoError.tsx:37` | props `mensaje`, `titulo?`, `alReintentar?`, `etiquetaReintentar?`, `variante?: 'pagina' \| 'tarjeta'`, `children?`. `pagina`: centrado, icono en círculo `--mal-fondo` de 48, `<h2>` 17/700; «Reintentar» tonal. 10 archivos | **NO ES PARA EL ERROR AL GUARDAR** (ése es una línea junto a la barra del pie del formulario, `:19-20`); `role="alert"`, no mueve el foco (`:18`) |
| `Skeleton` y huesos | `CMP/ui/Skeleton.tsx:13` (clase `.skeleton`, `GC:1046-1065`); `DashboardSkeleton` `:71`, `ExpedientePacienteSkeleton` `:169`, `PerfilSkeleton` `:205`, `BillingSkeleton` `:246` | fondo `--sup2`, pulso de `opacity` 1,4 s, quieto con movimiento reducido (`GC:1049-1065`). Cada hueso replica el layout de su pantalla: «NO ES UNA CAJA GRIS CUALQUIERA» (`:47`). `loading.tsx` de ruta en 7 rutas (`app/(app)/loading.tsx:1-20`: se pinta dentro del layout, no repetir su padding) | `Skeleton` es `aria-hidden="true"`; «quien lo contiene declara `aria-busy`» (`:9-12`); `app/(app)/loading.tsx` usa `role="status"` + `aria-label="Cargando"`. **No le cambies el nombre a `.skeleton`** (`GC:1046-1048`) |
| `ErrorBoundary` | `CMP/ErrorBoundary.tsx:14` | pinta `EstadoError titulo="Algo salió mal"` con «Reintentar» y «Volver al inicio» (`:34-41`); montado en `(app)/layout.tsx:200` y `expediente/[id]/layout.tsx` | — |
| Error global | `src/app/global-error.tsx` | carga Sentry por `import()` dinámico a propósito | no existen `error.tsx` por ruta ni `not-found.tsx` en `src/app` (búsqueda por nombre) |
| Spinner | `Loader2` de lucide con `animate-spin` (`OfflineAlert.tsx:121`, `CommandPalette.tsx:342`); heredado `.sp-spinner` (`ST:1176`) | — | el genérico `[class*="animate-"]:not(.animate-spin)` respeta el giro (`GC:9052-9055`) |

Error de campo: `.k-campo-error` + `aria-invalid` (5.2). Aviso de página ámbar: `CAJA_AVISO` (`AGC/estilosConfig.ts:106`);
errores de ventanas de la agenda: `.ag-capa-error` con `role="alert"` (`VentanaLigarCita.tsx:262,266`).

### 5.10 Avatares e iconos

* **`Avatar`** — `CMP/ui/Avatar.tsx:106` (+ `.k-avatar`, `SC:529-538`). Círculo 36 (32 y 44 por `tam`), iniciales 13/600 (12 y
  15). Props (`:93-104`): `texto`, `indice?`, `arranque?`, `neutro?` (`--sup2`/`--tinta2`, «para listas largas»), `tam?: 32 | 36
  | 44`, `className?`. Color: `PALETA_AVATAR` (`:43`, diez pares `--sp-avatar-N-bg/-ink`), `colorAvatar` (`:82`), `inicialesDe`
  (`:88`), `ARRANQUE_AVATAR` (`:74`, ventanas disjuntas para las dos regiones del dashboard). **Decorativo:** `aria-hidden="true"`
  (`:110`), «el nombre va siempre al lado» (`:15-16`). Regla (`CALMA:27`): uno por paciente como mucho, 32-36 px; en listas largas
  `--sup2`. **Excepción aceptada, «no es un defecto»** (`:37-42`): la paleta de `/expediente` (`AVATAR_COLORS`) no se unifica. 6
  consumidores.
* **Iconos:** `lucide-react ^1.6.0` (`package.json:49`; 204 archivos). Sin otra librería de iconos. Tamaños en uso por
  `size={N}`: 16 (217 usos), 14, 20, 18, 15, 17, 13, 12. Convenciones del código: navegación 20 (barra) y 22 (riel,
  `RielNavegacion.tsx:67`); «+» del riel 24; icono de alerta 28 (`SC:732`); estado vacío 24/20; botón icono 20 (`SC:398`);
  icono de etiqueta 14 (`SC:476`). Regla (`CALMA:26`): iconos solo donde ayudan a reconocer (navegación, tipo de documento,
  acción de icono), en un solo color `--tinta2` y sin cuadritos de fondo de colores. SVG propios (no lucide): `IconoEstadoCita`,
  `IconoTipoDocumento` (trazo 1,8, copiados de la maqueta, `:6-8`), `MarcaOrigen` (con `IconoGoogleCalendar`), `MarcasCita`,
  `LogoWhatsApp` (`CMP/agenda/BotonWhatsAppCita.tsx:58`), logo de
  `CabeceraBarra` (`Sidebar.tsx:233`).

### 5.11 Piezas propias de la agenda (resumen)

Las capas están en 5.6 y las campanas en 5.8. Además: `LeyendaEstados` (`CMP/agenda/LeyendaEstados.tsx`; con la v2 la puerta
es «Leyenda de estados» del menú del engrane), `AvisosAgenda`, filas (`FilaLista`, `FilaListaDetalle`, `FilaDelPanel`,
`MonthChip`, `BandaChip`, `GoogleEventCard`), barra y banda (`Banda`, `BandaMovil`, `NavegacionBandaMovil`,
`FiltrosBandaMovil`, `BarraAgendarMovil`, `CabeceraEscritorio`, `CabeceraDiaLista`, `PanelDelDia`, `TiraSemana`, `MiniMes`,
`CardResumen`, `CardHuecos`, `TileResumen`, `DesgloseEstados`; solo se listan por existir, detalle sin comprobar) y la
configuración (`ConfiguracionAgenda` monta `PrimeraVez` o `PestanasConfiguracion`; `PestanaConsulta/Horario/Enlace/MasOpciones`,
`DialogoHorario`, `ConfirmacionRestablecer`, etc.). Reglas de la agenda que **no** se repiten aquí viven en `CLAUDE.md`
(secciones «Agenda v2» y «B13»); el piel B13 está en `docs/spec/rediseno/b13/*.md` y `PIEZAS`.

### 5.12 Piezas heredadas `.sp-*` (`ST`)

Siguen vivas **re-pieladas al kit** en B2: cambian color, radio, sombra y respuesta al toque, **no** alto, relleno, letra ni
ancho de borde, «porque 31 archivos sin migrar dependen de esas medidas» (`ST:871-880`). Sus consumidores de nivel pieza son
los formularios de documentos (`CMP/documentos/*`), `CMP/expediente/VisorNota.tsx`, `nueva-nota/page.tsx`, `EspecialidadSelector`
y `ModalShell` (por `sp-icobox`, con `spinusGeometry`, `ModalShell.tsx:296`).

| Clase | Línea | Qué es | Equivalente del kit (colores iguales, medidas distintas; `ST:871-880`) |
|---|---|---|---|
| `.sp-btn` + `--primary`, `--secondary`, `--compact`, `--ghost` | `ST:881`, `893`, `903`, `927`, `936` | botón con `min-height: var(--sp-tap)` (44); `--primary` fondo `--accion` sin sombra | `k-b-prim`, `k-b-quieto`, `k-b-tonal` (`--compact` mide 34, `ST:931`), `k-b-texto` |
| `.sp-input`, `.sp-textarea` | `ST:1030`, `1048` | campo con relleno `--sup2`, foco `--enlace` | `.k-campo` |
| `.sp-card` | `ST:992` | tarjeta `--sup` sin sombra | `.k-tarjeta` |
| `.sp-banner` (+ `--warn/--danger/--info`) | `ST:1093-1104` | aviso en línea con `--aviso-*`, `--mal-*`, `--tonal` | sin equivalente único |
| `.sp-chip`, `.sp-badge`, `.sp-icobox`, `.sp-spinner`, `.sp-check`, `.sp-link-alt`, rótulos `.sp-label*`/`.sp-hint`/`.sp-title-*` | `ST:956`, `1080`, `1013`, `1176`, `1277`, `943`, `859-869` | piezas de formulario | `.k-etq` solapa con chip/badge |
| `.sp-doc-*` | `ST:1300` en adelante | armazón de los ocho formularios de documentos (consultas de contenedor `docform`); `.sp-doc-actions > .sp-btn` 44 y 36 en `ih`/`esc` (`ST:2139-2140`) | — |
| `.sp-doc-segmented` | `ST:1784` | **campo** segmentado de formulario (activa rellena) | `SelectorSegmentado` es cromo de vista (5.5) |
| `sp-rx-*`, `sp-lab-*`, `sp-img-*`, `sp-int-*`, `sp-hon-*`, `sp-tpl-*`, `sp-esc-*` | `ST:2364-3433` | familias propias de cada formulario | — |

`ST:1-4` se presenta como «SISTEMA DE DISEÑO — Funnel de Nota Médica … extraído 1:1 de los mockups M1–M10»: es el sistema
**anterior**; este documento lo reemplaza como fuente de consulta (sección 9).

---

## 6. Accesibilidad

### 6.1 Contraste

* **Texto ≥ 4,5:1; gráfico y borde de control ≥ 3:1** (WCAG 1.4.11). Aparece como regla explícita en: `PIEZAS` §1 (barra de
  bloque ≥ 3:1; hora e icono ≥ 4,5:1), `GC:603-606` (borde de los botones de la configuración ≥ 3:1), `ST:253-273`
  (`--sp-line-control` a 3:1), `GC:757-758` (landing), `PC:251` (pie del correo ≥ 4,5:1).
* Lo verifican: `e2e/agenda-h2-configuracion.e2e.ts:183-214` (pista y borde de interruptores ≥ 3:1; letra de botones ≥ 4,5:1;
  deshabilitado ≥ 3:1) y `src/lib/tests/plantillaCita.test.ts:172-183` (pie del correo). El pie va en `--ag-ink-600` `#52627a`
  (5,47:1 sobre `#eef1f5`): no lo bajes a `--ag-muted` (3,09:1; `CLAUDE.md`, tanda M).
* Medidos en comentarios del código: `--sp-primary` en oscuro (`0.55`): blanco encima 4,59-5,51:1 y 3,03-3,63:1 contra la
  tarjeta en las seis paletas (`ST:765-767`); avatares 4,54-5,34:1 claro y 4,63-6,05:1 oscuro (`ST:191-193`); `--ag-muted` sobre
  tinte de evento 2,91:1 claro (por eso existe `--ag-ink-600`, `GC:60-67`).
* Los pares del kit que quedan **por debajo de 4,5:1** están en la Deuda (`--tinta3`).

### 6.2 Foco visible

| Dónde | Regla | Línea |
|---|---|---|
| Primitivas del kit (botón, fila, pestaña, segmentado, menú, rejilla de documento) | `:focus-visible { outline: 3px solid var(--enlace) }`, `outline-offset` 2 / −3 / 1 según la pieza | `SC:384`, `461`, `507`, `527`, `760`, `878`, `888` |
| Campo del kit | `outline: 2px solid var(--enlace)`; inválido `2px solid var(--mal-tinta)` | `SC:425-426` |
| `.sp-btn`, `.sp-chip` | `3px solid var(--enlace)`, offset 2 | `ST:892`, `ST:969` |
| Agenda v2 (capas, burbuja, formulario) | `3px solid var(--enlace)`; campos 2 px | `GC:7302`, `7497`, `7694`, `7753`, `7773`, `7425`, `7838`, `7874`, `7940`, `8400` |
| Tira de días de la semana | `2px solid var(--cal-sel)`, offset −2 | `GC:6557` |
| Paleta ⌘K | `2px solid var(--enlace)` | `GC:2727`, `GC:2756` |
| Landing | `outline: 2px solid var(--lp-focus)`, offset 2, especificidad cero; sobre navy se redefine `--lp-focus` a `--lp-ink-inverse` | `GC:869-873` |

`BRIEF:31` pide `3px var(--enlace)` y, sobre navy, `var(--nav-tinta)`; el anillo del riel, la barra y las píldoras de
navegación no se encontró (sección 10). No hay regla global `:focus-visible` fuera de la landing; `GC:7267` y `GC:7352`
anulan el contorno de `.ag-capa` y `.ag-hoja` (contenedores con `tabindex`).

### 6.3 Objetivos táctiles y zoom

44 px en `ext`/`tel`/`iv` y 36 px en `ih`/`esc` (`--k-toque`, 2.6); el área se logra con `::after` sin agrandar el dibujo.
Campos a 16 px en `ext`/`tel` para evitar el zoom de iOS (`GC:948-956`). `touch-action: manipulation` global (`GC:1029-1031`).

### 6.4 Roles y patrones ya usados

* **Capas:** `role="dialog"` (o `alertdialog` en la alerta), `aria-modal="true"`, `aria-labelledby`/`aria-label`,
  `tabIndex={-1}`, `lang="es"`, `inert` + `aria-hidden` mientras sale (`CMP/ui/ModalShell.tsx:380-391`).
* **Menú:** `role="menu"` + `menuitem`/`menuitemradio` + `aria-checked` (`CapaMenu.tsx:108-117`, `:177`). **Navegación:**
  `aria-label` + `aria-current="page"` (`RielNavegacion.tsx:65`).
* **Pestañas:** patrón APG (`role="tab"`, `aria-selected`, `aria-controls`, ids `config-tab-*`/`config-panel-*`, flechas;
  `AGC/PestanasConfiguracion.tsx:96`); `.k-tab` se estiliza por `aria-selected`/`aria-current` (`SC:505`). **Segmentado:**
  `aria-pressed`/`aria-checked`/`aria-selected` (`SC:526`).
* **Botón de icono: `aria-label` obligatorio** (`SC:365-367`; `CALMA:18`). **Estado de cita:** en `ext`/`tel` el texto queda
  solo para el lector (`SC:557-560`); un estado nunca solo por color (`SC:540-542`; `CALMA:164`).
* **Avisos:** zona `aria-live="polite"`; `role="status"`/`role="alert"` (5.8). **Errores de campo:** `aria-invalid` (5.2).
* **Citas con la v2:** ninguna lleva `title`; su caja lleva `role="group"` y `aria-label` (`CLAUDE.md`, tanda G).
* **Interruptor:** `role="switch"` + `aria-checked` (`AGC/Interruptor.tsx:34`).

### 6.5 Movimiento reducido

Ver 2.8 (tabla de `prefers-reduced-motion`). Transparencia reducida: 2.1.5.

---

## 7. Lo prohibido

Solo reglas que constan en el código, en `CLAUDE.md` o en `CALMA`. Cada punto cita su fuente.

1. **Colores o tamaños escritos a mano en lugar de tokens.** Las capas de la agenda leen solo tokens del kit
   (`docs/spec/rediseno/b13/capas.md:8-9`); la configuración usa «los tokens y las primitivas del kit», sin `--ag-*`
   (`AGC/estilosConfig.ts:1-26`); la landing no usa hex literales ni valores de movimiento fuera de `--sp-dur-*`/`--sp-ease-*`/
   `--lp-*` (`CLAUDE.md`, «Landing pública», regla 1; `GC:650-660`).
2. **Letra por debajo de 12 px**, salvo el mes del chip de fecha (`SC:315`; `CALMA:33`; `configuracionEscala.test.ts:90`).
3. **Animar otra cosa que `transform` y `opacity`** (nunca `width`, `height`, `top`, `left`): `SC:624`, `GC:2192`,
   `GC:225-226`, `CLAUDE.md`, «Landing pública», regla 2. Ninguna animación de la agenda pasa de 400 ms
   (`movimientoAgenda.ts:49`).
4. **Un `useReducedMotion`/`prefers-reduced-motion` como parche final:** se escribe junto a cada animación
   (`CLAUDE.md`, «Landing pública», regla 3).
5. **Piezas duplicadas o abstracciones nuevas sin aprobación:** nada de factories, providers, contextos genéricos, hooks
   reutilizables ni capas de abstracción sin OK explícito; la duplicación es preferible a una abstracción especulativa
   (`CLAUDE.md`, Protocolo 4).
6. **Más de un botón primario por pantalla; sombra en tarjetas o botones; dos píldoras de estado juntas** (`SC:362`;
   `CALMA:28`; `SC:469-470`).
7. **Botón de icono sin `aria-label`** (`SC:365-366`).
8. **Color de documento (`--d-*`) fuera del icono de lista y de la rejilla de tipo** (`SC:562-566`; `CALMA:63`).
9. **`title` en las citas con la v2** (`CLAUDE.md`, tanda G): la caja lleva `role="group"` y `aria-label`.
10. **Tokens `--sp-*` del producto en la landing** y redeclarar `--lp-*` bajo `html.dark` (`GC:650-660`). La landing no
    admite dependencias nuevas de movimiento más allá de `motion` (`CLAUDE.md`, regla 7).
11. **`prefers-color-scheme` en las páginas públicas de la agenda y en los correos:** van siempre en claro
    (`AP:19-28`, `AP:36`; `PC:36-37`; `CLAUDE.md`, tanda H).
12. **Usar `--cp`/`--cs`/`--sp-primary` deduciendo por el nombre** (regla 4 de la landing, `CLAUDE.md`; recuadro 2.1.1).
13. **Un `position: fixed` que toque el borde de la franja en `ext`/`ih`** salvo el cromo (`GC:2677-2692`).
14. **Hoja inferior en `ext`:** ninguna capa lo es (`SC:799`; `CALMA` §26). **Velo apilado:** un solo velo a la vez
    (`SC:693-695`; `CALMA` §13).
15. **`cierraConVelo` activo en una capa con campos editables** (`CMP/ui/ModalShell.tsx:273-284`, decisión del dueño). En
    la alerta, el velo no cierra (`:19-26`).
16. **Pasar un número a `--it/--ir/--ib/--il`:** siempre `env(safe-area-inset-*)` en `calc()` (`SC:99`; `BRIEF:37`).
17. **Decidir el marcado por formato en el primer render:** el formato se aplica por CSS (`SC:305-306`; `FP:41-44`).
18. **«Aceptar» como botón de confirmación con la v2:** toda confirmación lleva su verbo (`CLAUDE.md`, B13; `CALMA` §29.3-§29.4).
19. **Reglas de acción dentro de `BurbujaCita` o botones de acción nuevos en un componente de la tarjeta:** la regla vive en
    `disposicionDeTarjeta` (`CLAUDE.md`, tandas G y K5).
20. **Animar `left`/`width` en el segmentado** y unificarlo con `.sp-doc-segmented` (`SelectorSegmentado.tsx:7-18`).
21. **Importar en estático los chunks de la barra v2 (`CampanaAgenda`, menú del engrane, candado) desde `AgendaCliente`,
    o pasarlos a `dynamic()`:** se cargan con `import()` solo con la v2 encendida (`CLAUDE.md`, tandas J1 y L).
22. **Montar `ScriptTema` en el layout raíz** (`ScriptTema.tsx:11-12`).
23. **Cargar Inter fuera de la landing y `/login`** (`src/lib/fonts.ts`).
24. **Reintroducir variantes viejas de los textos unificados.** Los vigentes son «Agendada desde Google Calendar»,
    «Reservó por enlace», «Ligar paciente e iniciar consulta» y «¿No es una cita?» (`CLAUDE.md`, B13 §28).

---

## 8. Deuda conocida

Lo que **hoy no cumple el sistema**. Solo se lista. **NADA de esto se corrige en este encargo ni sin orden explícita**; el
documento solo lo registra.

### 8.1 Letra por debajo de 12 px (regla `SC:315`; `CALMA:33`)

* **Cromo global:** `.nav-distintivo--avisos` a **11 px** en `GC:2351` (la regla hermana `.nav-distintivo`, `GC:2327-2332`,
  respeta los 12).
* **`GC` (agenda, legado y superficies compartidas):** `11px` en `GC:3143`, `3201`, `3549`, `4599`, `4965`, `5116`, `5301`,
  `5623`, `6085`, `8281`, `9501`; `11.5px` en `4104`, `6323`, `6471`; `10.5px` en `4578`, `4681`, `4704`, `4912`, `5584`,
  `6194`, `6310`, `6354`, `6423`, `8066`; `10px` en `5242`, `5938`; `9.5px` en `4671`; `9px` en `4609`, `4660`, `4939`, `5371`.
* **`ST`:** `--sp-fs-legal: 11px` (`ST:415`), `--sp-fs-tile: 10.5px` (`ST:416`), `.sp-legal` (`ST:869`), `ST:2004`;
  `font-size: 11.5px` en `ST:1676`. Fracciones fuera de la escala del kit: `--sp-fs-btn-md 15.5`, `-body 14.5`, `-meta 13.5`,
  `-hint 12.5` (`ST:405-411`).
* **`AP` (páginas públicas):** `.rp-pasos li` 11px (`AP:134`), `.rp-etiqueta` 11px (`AP:160`), `.rp-dia small` 10.5px (`AP:201`).
* **TSX con `text-[Npx]` < 12 (134 apariciones en `src`, sin pruebas):** `CMP/agenda/AppointmentModal.tsx` (líneas 1145,
  1233, 1255, 1284, 1320, 1328, 1332, 1438, 1442, 1458, 1587, 1603, 1617), `CMP/agenda/BloqueReservaPorLigar.tsx:104,107,113,114,131`,
  `AGC/FilaDisponibilidad.tsx:64` (directorio vigilado por `configuracionEscala.test.ts`, que no incluye este archivo en su lista
  `MONTADOS`), `CMP/ui/OnboardingGuide.tsx:276,624,647,710`, `CMP/agenda/{PanelLigarCita,HorarioModal,ModalInvitacionCita,LeyendaEstados}.tsx`,
  `CMP/dashboard/PiezasCita.tsx` (la excepción permitida), `CMP/dicom/*`, `CMP/calculadoras/*`, `CMP/taller-v2/TallerV2.tsx`,
  `CMP/SeguimientosWidget.tsx`, `CMP/super-admin/**` y `src/app/super-admin/**`, `src/app/(launcher)/inicio/page.tsx`.
* **Contradicción documental:** `BRIEF:24` dice «mínimo absoluto 11»; manda `CALMA:33` (12).

### 8.2 Contraste

* **`--tinta3`** (`#8A93A6` / `#7C89A3`) se usa como texto en `.k-campo::placeholder` (`SC:424`), `.k-campo:disabled` (`SC:433`) y
  chevron de fila (`SC:466`): 3,09:1 sobre `--sup` y 2,56:1 sobre `--sup2` en claro; 3,85:1 sobre `--sup2` en oscuro *(calc.)*.
* `--nav-tinta*`, `--nav-velo` y `--nav-avatar` no se redeclaran en `html.dark` (`SC:153-192`): ver sección 10.

### 8.3 Lista de avisos de la campana global en `ih`

La lista de avisos de la campana global, en `ih`, abre **centrada** en el área de contenido (tarjeta de 400 px,
`GC:8410-8416`) y **cruza la bisagra**: medido el 2026-11-25 con el Duo abierto emulado (951×669, franja derecha de 84),
el panel ocupa x 126–526 y la bisagra está en x 455–496. `colocarBajo` no coloca fuera de `esc`
(`CMP/agenda/CapaBarra.tsx:25-33`; `CMP/avisos/CampanaAvisos.tsx:128`), y solo en `esc` hay una regla propia que la ancla a la
barra (`GC:2347`). **Matiz:** `CALMA:87` y `CALMA:110-111` aceptan que las capas centradas en `ih` crucen el pliegue; la
prueba solo vigila controles fijos (`rediseno-formatos.e2e.ts:109-111`). No se midió en aparato (sección 10).

### 8.4 Piezas duplicadas o solapadas (descripción, sin juicio)

1. **Foco atrapado/Escape escrito varias veces:** `ModalShell.tsx:188-234`, `src/hooks/useDialogoModal.ts:99-164`,
   `CMP/agenda/ModalInvitacionCita.tsx:31,159-170`, `CMP/launcher/ConsultaRapidaModal.tsx:73`. Los comentarios lo reconocen
   (`ModalShell.tsx:40-44`; `useDialogoModal.ts:20-32`). Diferencias: `focusablesDelPanel` exige `tabIndex >= 0` y `focusablesDe`
   no; `ModalShell` bloquea el scroll del `body` y `useDialogoModal` no (`useDialogoModal.ts:38-49`).
2. **Capas con y sin trampa de Tab / rol:** sin Tab atrapado: `MenuMas`, `CommandPalette`, `OfflineAlert` (grep de `'Tab'` = 0);
   sin `role`, `aria-modal`, Escape ni Tab en el marcado leído: `QuickPatientModal.tsx:243-248`.
3. **`colocar`/`colocarBajo` escrito varias veces:** `CMP/agenda/BurbujaAlta.tsx:130`, `HerramientasV2.tsx:86`,
   `TarjetaLectura.tsx:83` (las tres copias de AG-DT-38), `CapaBarra.tsx:25` (`colocarBajo`) y `CapaMenu.tsx:72`; parte compartida
   en `src/lib/agenda/posicionCapa.ts:103,155`.
4. **Alertas de varias maneras:** `ModalShell variante="alerta"` (`:318`; el velo no cierra), `ConfirmModal` con verbo
   (`ConfirmModal.tsx:62`; **el velo sí cierra**, `:71`; `z-[60]`), `ConfirmacionClasica` (`:96`; Tailwind literal), la alerta de
   `QuickPatientModal` (`z-[70]`), `OfflineAlert` (excepción aprobada). **Sin pieza única de alerta.**
5. **Menús (cuatro implementaciones de «lista de acciones desplegada»):** `CapaMenu`, `MenuMas`, `MenuEngraneAgenda`,
   `MenuAjustes` (`Sidebar.tsx:325`). **Sin pieza única de menú.**
6. **Dos familias de capa** (`.k-capa*` frente a `.ag-capa*`/`.ag-hoja`) y avisos que usan clases `ag-aviso-fila`,
   `ag-campana-pestanas`, `ag-capa-cerrar` fuera de la agenda (`CampanaAvisos.tsx:132`, `InterruptorMisAvisos.tsx:50`).
7. **Vacío/error/carga repetidos:** `EstadoVacio`/`EstadoError` frente a `AvisoTarjeta` (`piezasBanda2.tsx:94`) y `AvisoLista`
   (`ProximasCitas.tsx:162`); `Chasis` es un nombre repetido para dos funciones (`ProximasCitas.tsx:146`, `TarjetaHoy.tsx:102`);
   huesos de carga por tarjeta además de `Skeleton`.
8. **Marcas de procedencia en tres sitios:** `ui/MarcaOrigen.tsx:60`, `agenda/MarcasCita.tsx:60` + `MarcaOrigenGoogle.tsx:27` y
   `dashboard/PiezasCita.tsx:72` (otro componente también llamado `MarcasCita`); dos `IconoEnlace` (`MarcaOrigen.tsx:32`,
   `MarcasCita.tsx:39`); textos distintos («Agendada por enlace», «Agendada en Google»).
9. ~~**`GoogleGIcon` dos veces:** `CMP/agenda/GoogleGIcon.tsx:10` y `CMP/perfil/piezasDatos.tsx:42`.~~ Sin objeto desde
   la corrección 6 (orden de Angel): las dos «G» se sustituyeron por `IconoGoogleCalendar` y se borraron.
10. **Segmentado y pestañas sin pieza única:** `.k-seg` a mano en 5 archivos (`AGC/DialogoHorario.tsx`,
    `CMP/documentos/EditorEscrito.tsx`, `CMP/perfil/FirmaCaptura.tsx`, `expediente/[id]/editar/page.tsx`, `pacientes/nuevo/page.tsx`);
    `.k-tab` a mano en tres componentes (solo `PestanasConfiguracion` implementa flechas y `tabIndex` itinerante); tablist
    aparte en `CampanaAgenda.tsx:254` y `SelectorTipoDocumento.tsx:250`.
11. **Interruptores `role="switch"` escritos a mano:** `InterruptorCorreoClinica.tsx:67`, `InterruptorRecordatorio.tsx:74` (copias
    deliberadas, `InterruptorCorreoClinica.tsx:11-13`), `AppointmentModal.tsx:1508`, `AyudaAtajos.tsx:68`, `perfil/page.tsx:1418`.
12. **Tarjeta definida varias veces:** `.k-tarjeta`, `.sp-card`, `TARJETA` de `PiezasCita.tsx:27`, `TARJETA`/`SUPERFICIE` de
    `estilosConfig.ts:33,36`, y el contenedor de `EstadoVacio.tsx:72`.
13. **Campo:** `.k-campo` frente a `.sp-input`/`.sp-textarea` (`ST:1030`). **Botón:** `.k-b` frente a `.sp-btn` (`ST:881`).
14. **Avatar:** `Avatar` frente a `AVATAR_COLORS` de `/expediente` (excepción aceptada), `.nav-avatar`, `.nav-paleta-avatar` y
    `k-avatar` a mano (`ConsultaRapidaModal.tsx:359`, `TablaPacientesExpediente.tsx:118`).
15. **Confirmación nativa fuera del kit:** `alert(` en `src/app/(app)/billing/page.tsx:97,102,105` y `src/app/pricing/page.tsx:47`.

### 8.5 Piezas y tokens muertos o sin consumidores

* **`OnboardingGuide`** (`CMP/ui/OnboardingGuide.tsx:287`): sin importaciones; solo la nombran comentarios de
  `src/app/(app)/perfil/page.tsx:1304`, `src/app/(app)/dashboard/page.tsx:103` y `dashboard/AsistenteDashboard.tsx:71`, que
  conservan sus anclas `data-onboard`.
* `PatientListSkeleton` (`Skeleton.tsx:34`), `PatientRowSkeleton` (`:18`), `ListSkeleton` (`:266`); `EncabezadoColumna`
  (`piezasBanda2.tsx:21`) y `AvisoColumna` (`:116`); `ConfiguracionCalendario` y `MenuConfiguracion` (sin montar,
  AG-DT-162; `clasesConfig.ts` la sigue usando código vivo).
* **Tokens sin consumidores:** `--cal-h` y `--cal-hw` (`SC:247-251`; solo comentarios, p. ej. `GC:6845`; el alto de hora real es
  `--ag-slot-h` 36/42/48 px, `GC:4091-4093`, y el paso a 80 px se probó y se revirtió, AG-DT-281), `--fuente` (`SC:97`),
  `.k-t-chip` (`SC:324`). Clases `.sp-*` sin uso literal: `.sp-callout`, `.sp-grid-2-1`, `.sp-push-backward`, `.sp-label-eyebrow`,
  `.sp-legal`, `.sp-note` (`REGISTRO:945-949`). `TP:203-205` inyecta `--radius-sm/md/lg` muertos (`SC:263-265`).

### 8.6 Zonas sin tokens

* **Lanzador `/inicio`** (`src/app/(launcher)`): Tailwind `slate-*` y hex literales (`text-[#1e5fa8]`, `text-[#1a3a5c]`), 0 usos
  de `var(--…)`; no monta `ThemeProvider` (`src/app/(launcher)/layout.tsx:2,20`). Documentado como «no es del rediseño todavía»
  (`GC:1020-1024`; `REGISTRO:1181-1183`).
* Correos de la agenda (hex copiados de tokens, AG-DT-47: `PC:52-64`) y super-admin (Tailwind sin tokens).

### 8.7 Comentarios y documentos desactualizados

* `CLAUDE.md` dice que `globals.css:822` ya tiene el bloque de `prefers-reduced-motion`; hoy el de la agenda está en
  `GC:4311-4344` y el de la landing en `GC:9052-9140`. `GC:11` dice «body, línea ~118»; el `body` está en `GC:915`.
* `SC:8-13` dice que el archivo «NO PINTA NADA POR SÍ SOLO» y `SC:340-343` que las clases `.k-*` «NADIE LAS USA TODAVÍA»; hoy
  `src/app/(app)` tiene unas 369 apariciones de `k-*` y `--k-toque` se usa en decenas de sitios.
* El ítem 2 de «Deuda técnica conocida» de `CLAUDE.md` («`ModalShell` sin focus trap») ya no coincide con el código
  (`ModalShell.tsx:188-234`).
* `MarcaOrigen.tsx:10-12` («Mientras tanto nadie la usa») ya no es cierto (`PiezasCita.tsx:78`).
* `BRIEF:24`: «mínimo absoluto 11» y «cuerpo 15 (14 en `esc`)»; el código fija 15/20 para todo `html[data-formato] body`
  (`GC:933-936`).
* `PIEZAS:30` y `SC:246-248` declaran `--cal-h: 80px`; el alto real es `--ag-slot-h` (arriba).
* `ST:667` y `ST:760` calculan contrastes sobre `--sp-surface (#1e1e1e)`; hoy en oscuro es `var(--sup)` = `#16223A`
  (`SC:155`). `ST:15` etc. conservan los números del gris viejo.
* `AP:33-34` dice «`--ag-dur-*` (≤ 240 ms)»; `AP:79-83` declara 120/180/240 y `GC:228-236` usa 100/180/360 con tope 400.
* `docs/spec/rediseno/ESTADO.md` remite a `kit/INTEGRACION.md` y `kit/AGENDA-FASE2.md`, que **no existen** en el repo (`kit/`
  tiene `BRIEF.md`, `CALMA.md`, `IMPLEMENTACION.md`, `base.css`). `CLAUDE.md` remite a `PLAN_LANDING_SPINUS.md`, que tampoco
  está en el repo: la landing se documenta en `SPINUS_LANDING_MAESTRO.md`, que lo sustituye.
* La regla tachada de `CLAUDE.md` sobre `clasesConfig.ts`/`--ag-control-*` fue sustituida por `estilosConfig.ts`; los tokens
  `--ag-control-*` siguen en `GC:607-610`.

### 8.8 Riesgos de plataforma sin verificar

La detección del Duo por `window.screen` (`FP:71-79`) no está verificada en el aparato (`FP:25-28`; `REGISTRO:1189-1191`).
Safari < 17.2 no entiende `linear()`: la capa aparece sin animación pero funciona (`SC:143-144`).

---

## 9. Documentos anteriores

Criterio: **este documento reemplaza como FUENTE DE CONSULTA** a los que describen tokens, piezas o reglas generales de la
interfaz. Los registros de implementación, planes e historia **siguen vigentes como historia**. Las maquetas HTML siguen siendo la
referencia visual de cada pantalla (nota: las maquetas completas `vista-*.html` pesan ~60 MB y **no están en esta rama**; viven en
la rama de respaldo `claude/cool-babbage-nn7p37`, `docs/spec/rediseno/README.md`). Ningún documento se borra ni se edita.

| Documento | Estado | Por qué |
|---|---|---|
| `SPEC_DISENO.md`, `SPEC_DISENO_PARTE_B.md` (raíz) | **Fuera de alcance** | Describen el sistema de **documentos PDF** (página 612 × 792 pt, los 8 formatos); no son diseño de la interfaz en pantalla (`SPEC_DISENO.md:1-9`; `SPEC_DISENO_PARTE_B.md:1-9`). Siguen siendo su fuente |
| `DOCUMENTOS_SPEC.md`, `PROPUESTA_DISENO_DOCUMENTOS.md` (raíz) | **Fuera de alcance / sigue vigente como detalle** | PDF de documentos (`DOCUMENTOS_SPEC.md:1`) y propuesta de los 8 formularios (`sp-doc-*`, `PROPUESTA_DISENO_DOCUMENTOS.md:1-5`); los valores que entraron al código viven en `ST`, descrito aquí en 5.12 |
| `docs/spec/rediseno/kit/CALMA.md` | **Sigue vigente** como fuente de las reglas y decisiones del dueño (§1-§31) | Este documento la cita y no la duplica; «donde choquen, manda este documento sobre `BRIEF`» (`CALMA:1`). Ante conflicto con el código, manda el código |
| `docs/spec/rediseno/kit/BRIEF.md` | **Reemplazado** para consulta de tokens, escala y medidas | Es el encargo de las maquetas y por debajo de `CALMA`; lleva valores superados («mínimo 11», «cuerpo 14 en `esc`», `BRIEF:24`). Queda como historia |
| `docs/spec/rediseno/kit/IMPLEMENTACION.md`, `kit/base.css` | **Sigue vigente como historia** | Reglas para los agentes que implementaron el rediseño (rutas de sesión ya inexistentes) y origen de los tokens de las maquetas (`SC:2-4`) |
| `docs/spec/rediseno/PLAN.md` | **Sigue vigente como historia** | Plan aprobado (diagnóstico, §2 estrategia, bloques B0-B15); su §2.1 es la razón de los alias `--sp-*` (1.3) |
| `docs/spec/rediseno/IMPLEMENTACION-REGISTRO.md`, `ESTADO.md`, `README.md`, `INTEGRACION-AGENDA.md` | **Sigue vigente como historia** | Registros de la ejecución y de decisiones; `README.md` indexa la carpeta; `ESTADO.md` remite a archivos que no existen (8.7) |
| `docs/spec/rediseno/agenda-base/PIEZAS.md`, `ag-mes/PIEZAS-MES.md` | **Sigue vigente como detalle** de las piezas de la agenda y referencia de la maqueta | Su tabla de `--cal-*` coincide con `SC:213-249`, **salvo** `--cal-h` (8.5). Este documento solo resume la agenda (5.11) |
| `docs/spec/rediseno/b13/{capas,configuracion,vistas}.md` | **Sigue vigente como detalle e historia** | Cómo está hecho cada tramo de B13 y por qué; sus reglas «que un editor no debe romper» están también en `CLAUDE.md` |
| `docs/spec/rediseno/informes/*.md` (11 auditorías) | **Sigue vigente como historia** | Auditorías de partida sobre el commit `951e31b3`; los números ya cambiaron |
| `docs/spec/rediseno/tools/*.js` | **Fuera de alcance** | Scripts de captura y medición |
| `docs/spec/SPEC_AGENDA.md` | **Sigue vigente como detalle** de la agenda con la v2 apagada y las páginas públicas | Valores `--ag-*` y ganchos de FullCalendar; esa familia sigue viva (`SC:207-210`). Para la agenda v2 manda `PIEZAS` y este documento |
| `docs/spec/MODO_OSCURO_APP.md` | **Reemplazado** para valores; su criterio de derivación de la marca sigue como historia | Se compone sobre `#1E1E1E` (`MODO_OSCURO_APP.md:7-9`); el oscuro vigente es el navy del kit (`SC:153-192`; `PLAN:163-171`). La fórmula de marca vive en `ST:763-829` y `TP:110-137` |
| `docs/spec/MODO_OSCURO_AGENDA.md` | **Reemplazado** para valores | Veinte valores medidos sobre `#1E1E1E`; en oscuro los `--ag-*` apuntan hoy al kit (`GC:8472-8477`) |
| `docs/spec/CONTRASTE_Y_MOVIMIENTO_AGENDA.md` | **Sigue vigente como detalle** (regla de la hora de un evento genérico en tinta neutra); la parte de movimiento está **reemplazada** por 2.8 | Los tokens de movimiento hoy son `GC:228-240` y el tope 400 ms |
| `docs/spec/RIESGOS_AGENDA.md` | **Sigue vigente como detalle** | Riesgos de implementación de FullCalendar, no son tokens |
| `docs/spec/avisos-globales/*.md` | **Fuera de alcance** | Reglas funcionales de los avisos globales; las piezas están en 5.8 |
| `SPINUS_LANDING_MAESTRO.md` | **Sigue vigente** para la landing | Dice que «consolida y SUSTITUYE a PLAN_LANDING_SPINUS.md v1» (`:1-4`); la landing es una zona con familia propia (1.2) |
| `LABS_REDISEÑO_*.md`, `NOTA_IA_*.md`, `GUIA_FORM*.md`, `DOCUMENTOS_*` restantes | **Fuera de alcance** | Flujos, prompts de IA y guías de formularios; sin tokens ni piezas generales (no revisados a fondo, sección 10) |
| Maquetas: `docs/spec/{Main,Configuracion,Burbuja}.dc.html`, `rediseno-paginas-agenda.html`, `correo-*.html`, `export-movil/*`, `docs/mockups/*.png` | **Sigue vigente como referencia visual** | Referencia de cada pantalla; los correos salen de `correo-*.html` (`CLAUDE.md`, tanda M) |

---

## 10. Sin comprobar

Lo que **no** se pudo verificar y por tanto no figura como cierto en el cuerpo.

**Dispositivo y plataforma**
* La detección del Duo por `screen.width/height` no se verificó en el aparato (`FP:25-28`; `REGISTRO:1189-1191`).
* Las dimensiones de dispositivo de 3.1 provienen de documentos de maqueta (`BRIEF`, `CALMA`), no de código.
* `--k-toque` y el `::after` de `.k-b`: se comprobó la regla, no se midieron cajas en navegador.
* Si la lista de avisos de la campana global realmente cruza la bisagra en `ih` (8.3): no se midió en aparato.

**Tokens y contraste**
* Los valores de oscuro de `--nav-tinta`, `--nav-tinta2`, `--nav-velo` y `--nav-avatar`: no se redeclaran en `html.dark`
  (`SC:153-192`); no se sabe si es intencional.
* Contrastes oscuros de `--ag-status-*` y de `--cal-*` (mezclas con `color-mix`): no se calcularon.
* Si los contrastes de comentarios de `ST` medidos contra `#1e1e1e` (`ST:667`, `ST:760`, `ST:131-139`) siguen cumpliendo sobre el
  navy actual.
* La resolución real de las fórmulas `hsl(from …)` / `oklch(from …)` por paleta: no se calcularon los hex.

**Foco y accesibilidad**
* Qué anillo de foco pintan riel, barra y píldoras de navegación (no se halló regla en `GC` ni en `RielNavegacion.tsx`/`Sidebar.tsx`).
* A11y no leída línea por línea: `CIE10Combobox` (el grep no halló `role`/`aria-*`), `PestanasAdministracion`, `AppointmentModal`,
  `HorarioModal`, `ModalBloqueo`, `ConvertirEnCita`, `ModalInvitacionCita`, `PreguntaAsistencia`, `BloqueoFeatureModal`,
  `AddConsultorioModal`, `DeleteConsultorioModal`, `ModalSubirDocumento`, `ModalPreviewDocumento`, `ModalAgregarMedicion`.

**Alcance del inventario**
* Cuántas de las reglas `font-size` < 12 px del legado de la agenda (`GC:3143-9501`) quedan anuladas con la v2 encendida (B13
  reescribe la piel sobre otro bloque de selectores).
* Estado de diseño de `super-admin`, `/pricing`, `/register`, `/privacidad`, `/terms`: no se leyeron.
* No se inventariaron `CMP/agendaPublica/*`, `landing/*`, `super-admin/*`, `calculadoras/*`, `dicom/*`, `taller-v2/*`, `legal/*`,
  `billing/*` (salvo lo citado), `labs/*` (salvo lo citado), `onboarding/*`, ni las piezas internas de `src/app/(app)/**/page.tsx`
  (p. ej. `perfil/page.tsx`). `BotonMantener`, `CampoSugerido`, `BuscadorMedicamento` y demás de `documentos/*` no se leyeron.
* Del grupo de piezas de la agenda de 5.11 solo se confirmó que existen.
* Conteos de consumidores: coincidencias de texto; `k-campo` puede estar subcontado y no se resolvieron todas las clases por
  plantilla dinámica. «385 nombres» de `.sp-*` es el recuento de `grep -o` en `ST` (incluye selectores compuestos y comentarios).
* No se comprobó si Next sirve su 404 por omisión sin `not-found.tsx` personalizado.
* Líneas aproximadas: en `Sidebar` («Barra lateral / cajón») y en las ranuras de campana (`Sidebar.tsx:240`,
  `EncabezadoFundido.tsx:88`) se derivaron del orden del archivo, no se re-verificaron una a una.

**Documentación**
* De `docs/spec/rediseno/ESTADO.md`, `informes/*.md`, `SPEC_DISENO*.md`, `DOCUMENTOS_*`, `LABS_REDISEÑO_*`, `NOTA_IA_*` y `GUIA_FORM*`
  solo se leyeron la cabecera y el índice (9). De `CALMA` se leyeron §1-§4, §9, §13, §18, §25-§26, §29 y de `PIEZAS` §1 y §13.
