# Tipografía de Apple y su traducción a la web

Fecha de consulta: 2026-11-19. Investigación en fuentes primarias; no se tocó ningún repositorio.

## 0. Cómo se obtuvo y qué NO se pudo abrir

| Fuente | Estado |
|---|---|
| HIG de Apple (`developer.apple.com`) | **Abierta.** Leída por su endpoint JSON oficial (`/tutorials/data/design/human-interface-guidelines/<página>.json`); las tablas de abajo están copiadas de ahí, no de memoria. |
| Página de fuentes y licencia (`developer.apple.com/fonts/`) | **Abierta.** |
| Charla WWDC 2020 «The details of UI typography» (transcripción) | **Abierta.** |
| Notas de versión de Safari 26 a 27.2 (`developer.apple.com/documentation/safari-release-notes`) | **Abiertas.** La 27.3 beta devolvió 404 en el endpoint JSON: no revisada. |
| MDN (contenido y tablas de compatibilidad) | **Abierta vía GitHub** (`mdn/content`, `mdn/browser-compat-data`); `developer.mozilla.org` está bloqueado en esta sesión. |
| Borradores CSS del W3C | **Abiertos vía GitHub** (`w3c/csswg-drafts`); `w3.org` y `drafts.csswg.org` bloqueados. |
| Código fuente de WebKit | **Abierto vía GitHub** (`WebKit/WebKit`, rama `main`). |
| **Blog de WebKit (`webkit.org`)** | **BLOQUEADO.** El proxy de la sesión rechaza el host (403 en CONNECT / ENOTFOUND). No pude abrir ni `webkit.org/blog/18486/…` (Safari 27.1) ni `webkit.org/blog/3709/…` (fuente del sistema). Todo lo que depende del texto del blog va marcado **NO VERIFICADO**. Para verificarlo hay que permitir `webkit.org` en la red de la sesión. |
| `learn.microsoft.com`, `developer.android.com`, `m3.material.io`, `web.archive.org` | Bloqueados. La guía de tipografía de Windows se leyó desde su repositorio (`MicrosoftDocs/windows-dev-docs`). Android/Material: sin fuente primaria. |

Vigencia de las páginas de la HIG (campo `alert-date` de cada una):
Typography — última modificación **16/12/2025** («Added emphasized weights to the Dynamic Type style specifications for each platform»). Accessibility — 09/06/2025. Buttons — 16/12/2025. Layout — 09/09/2026. Designing for iPhone Duo — página nueva del 09/09/2026.

---

## 1. HIG › Typography

Fuente de toda la sección: https://developer.apple.com/design/human-interface-guidelines/typography

### 1.1 Tipografías del sistema

- «San Francisco (SF) is a sans serif typeface family that includes the SF Pro, SF Compact, SF Arabic, SF Armenian, SF Georgian, SF Hebrew, and SF Mono variants.»
- Variantes redondeadas de SF Pro y SF Compact (y de las extensiones de escritura).
- «New York (NY) is a serif typeface family designed to work well by itself and alongside the SF fonts.»
- Por plataforma: «SF Pro is the system font in iOS and iPadOS. iOS and iPadOS apps can also use NY.» / «SF Pro is the system font in macOS. NY is available for Mac apps built with Mac Catalyst. **macOS doesn't support Dynamic Type.**» / watchOS usa SF Compact.
- Formato variable y tamaño óptico dinámico: «On all platforms, the system fonts support dynamic optical sizes, which merge discrete optical sizes (like Text and Display) and weights into a single, continuous design».
- Pesos: «prefer Regular, Medium, Semibold, or Bold font weights, and avoid Ultralight, Thin, and Light font weights, which can be difficult to see, especially when text is small.»
- No incrustar: «don't embed system fonts in your app or game.»
- Descripción en https://developer.apple.com/fonts/: SF Pro «features nine weights, variable optical sizes for optimal legibility, four widths, and includes a rounded variant»; SF Mono «features six weights»; New York «features six weights».

### 1.2 Tamaño por defecto y mínimo (tabla tal cual)

| Platform | Default size | Minimum size |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

Texto que la acompaña: «Follow the recommended default and minimum text sizes for each platform — for both custom and system fonts». Y: «If you use a custom font with a thin weight, aim for larger than the recommended sizes».

### 1.3 iOS/iPadOS — estilos de texto en «Large (default)» (tabla tal cual)

| Style | Weight | Size (points) | Leading (points) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

Nota al pie de Apple: «Point size based on image resolution of 144 ppi for @2x and 216 ppi for @3x designs.»
La HIG escribe «Subhead» en las tablas de iOS y «Subheadline» en la de macOS; es el mismo estilo.

Cómo escala Dynamic Type (filas copiadas de las 12 tablas de la HIG; sólo tres estilos por brevedad):

| Tamaño | Large Title | Body | Caption 2 |
|---|---|---|---|
| xSmall | 31/38 | 14/19 | 11/13 |
| Small | 32/39 | 15/20 | 11/13 |
| Medium | 33/40 | 16/21 | 11/13 |
| **Large (default)** | 34/41 | 17/22 | 11/13 |
| xLarge | 36/43 | 19/24 | 13/18 |
| xxLarge | 38/46 | 21/26 | 15/20 |
| xxxLarge | 40/48 | 23/29 | 17/22 |
| AX1 | 44/52 | 28/34 | 20/25 |
| AX2 | 48/57 | 33/40 | 24/30 |
| AX3 | 52/61 | 40/48 | 29/35 |
| AX4 | 56/66 | 47/56 | 34/41 |
| AX5 | 60/70 | 53/62 | 40/48 |

Dos lecturas útiles para la web: (a) el Body va de 14 a 53 pt, es decir **de 0,82× a 3,1×** sobre el valor por defecto; (b) el escalado **no es lineal**: los títulos crecen mucho menos que el cuerpo, y Caption 2 nunca baja de 11 pt (el mínimo de la plataforma).

### 1.4 macOS — estilos integrados (tabla tal cual)

| Text style | Weight | Size (points) | Line height (points) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 26 | 32 | Bold |
| Title 1 | Regular | 22 | 26 | Bold |
| Title 2 | Regular | 17 | 22 | Bold |
| Title 3 | Regular | 15 | 20 | Semibold |
| Headline | Bold | 13 | 16 | Heavy |
| Body | Regular | 13 | 16 | Semibold |
| Callout | Regular | 12 | 15 | Semibold |
| Subheadline | Regular | 11 | 14 | Semibold |
| Footnote | Regular | 10 | 13 | Semibold |
| Caption 1 | Regular | 10 | 13 | Medium |
| Caption 2 | Medium | 10 | 13 | Semibold |

Nota al pie: «Point size based on image resolution of 72 ppi for @1x and 144 ppi for @2x designs.»

### 1.5 Otras reglas de la página que afectan al diseño

- «Minimize the number of typefaces you use, even in a highly customized interface.»
- «Consider using the built-in text styles.»
- Con tres o más líneas de texto, evitar el interlineado apretado: «If you need to display three or more lines of text, avoid tight leading even in areas where height is limited.»
- No todo debe crecer igual: «When someone chooses a larger text size, they typically want to make the content they care about easier to read; they don't always want to increase the size of every word on the screen.»
- A tamaños grandes: no truncar, apilar en vez de poner en línea, reducir columnas, y agrandar los iconos con significado.

---

## 2. Tracking y tamaño óptico

### 2.1 Tabla de tracking de SF Pro (iOS, iPadOS, visionOS) — tal cual en la HIG

Fuente: https://developer.apple.com/design/human-interface-guidelines/typography#Tracking-values

| Size (points) | Tracking (1/1000 em) | Tracking (points) |
|---|---|---|
| 6 | +41 | +0.24 |
| 7 | +34 | +0.23 |
| 8 | +26 | +0.21 |
| 9 | +19 | +0.17 |
| 10 | +12 | +0.12 |
| 11 | +6 | +0.06 |
| 12 | 0 | 0.0 |
| 13 | -6 | -0.08 |
| 14 | -11 | -0.15 |
| 15 | -16 | -0.23 |
| 16 | -20 | -0.31 |
| 17 | -26 | -0.43 |
| 18 | -25 | -0.44 |
| 19 | -24 | -0.45 |
| 20 | -23 | -0.45 |
| 21 | -18 | -0.36 |
| 22 | -12 | -0.26 |
| 23 | -4 | -0.10 |
| 24 | +3 | +0.07 |
| 25 | +6 | +0.15 |
| 26 | +8 | +0.22 |
| 27 | +11 | +0.29 |
| 28 | +14 | +0.38 |
| 29 | +14 | +0.40 |
| 30 | +14 | +0.40 |
| 31 | +13 | +0.39 |
| 32 | +13 | +0.41 |
| 33 | +12 | +0.40 |
| 34 | +12 | +0.40 |
| 35 | +11 | +0.38 |
| 36 | +10 | +0.37 |
| 37 | +10 | +0.36 |
| 38 | +10 | +0.37 |
| 39 | +10 | +0.38 |
| 40 | +10 | +0.37 |
| 41 | +9 | +0.36 |
| 42 | +9 | +0.37 |
| 43 | +9 | +0.38 |
| 44 | +8 | +0.37 |
| 45 | +8 | +0.35 |
| 46 | +8 | +0.36 |
| 47 | +8 | +0.37 |
| 48 | +8 | +0.35 |
| 49 | +7 | +0.33 |
| 50 | +7 | +0.34 |
| 51 | +7 | +0.35 |
| 52 | +6 | +0.33 |
| 53 | +6 | +0.31 |
| 54 | +6 | +0.32 |
| 56 | +6 | +0.30 |
| 58 | +5 | +0.28 |
| 60 | +4 | +0.26 |
| 62 | +4 | +0.24 |
| 64 | +4 | +0.22 |
| 66 | +3 | +0.19 |
| 68 | +2 | +0.17 |
| 70 | +2 | +0.14 |
| 72 | +2 | +0.14 |
| 76 | +1 | +0.07 |
| 80 | 0 | 0 |
| 84 | 0 | 0 |
| 88 | 0 | 0 |
| 92 | 0 | 0 |
| 96 | 0 | 0 |

Nota al pie de Apple: «Not all apps express tracking values as 1/1000 em. Point size based on image resolution of 144 ppi for @2x and 216 ppi for @3x designs.»

La tabla de **macOS** es idéntica salvo dos celdas de la última columna, que en la página aparecen intercambiadas (52 pt: +0.31 en macOS frente a +0.33 en iOS; 53 pt: +0.33 frente a +0.31). La columna en 1/1000 em coincide en todas las filas. La HIG publica además tablas propias para SF Pro Rounded, New York, SF Compact y SF Compact Rounded (no copiadas aquí).

Valores para los once estilos de iOS en Large (leídos de la tabla anterior):

| Estilo | pt | Tracking (1/1000 em) | `letter-spacing` equivalente |
|---|---|---|---|
| Large Title | 34 | +12 | 0.012em |
| Title 1 | 28 | +14 | 0.014em |
| Title 2 | 22 | -12 | -0.012em |
| Title 3 | 20 | -23 | -0.023em |
| Headline / Body | 17 | -26 | -0.026em |
| Callout | 16 | -20 | -0.020em |
| Subhead | 15 | -16 | -0.016em |
| Footnote | 13 | -6 | -0.006em |
| Caption 1 | 12 | 0 | 0 |
| Caption 2 | 11 | +6 | 0.006em |

La columna `letter-spacing` es una conversión mía (1/1000 em ÷ 1000), no una cifra de Apple.

### 2.2 Para qué sirve la tabla, según Apple

HIG: «**If necessary, adjust tracking in interface mockups.** In a running app, the system font dynamically adjusts tracking at every point size. To produce an accurate interface mockup of an interface that uses the variable system fonts, you don't have to choose a discrete optical size at certain point sizes, but you might need to adjust the tracking.»

Es decir: la tabla es para **maquetas**. En ejecución lo aplica el sistema. Consecuencia: estos valores son propios del dibujo de SF Pro; **no deben aplicarse a otra fuente** (Segoe, Roboto, Inter), cuyo espaciado nativo es distinto.

### 2.3 Text → Display

Fuente: transcripción de WWDC 2020, sesión 10175, https://developer.apple.com/videos/play/wwdc2020/10175/

- Histórico: «We designed SF Text for small sizes below 20 points and SF Display for 20 points and above. These variants are what we call optical sizes.»
- Vigente desde que SF Pro es variable: «This year, with SF Pro becoming a variable font, there is no hard break around 20 points anymore and **the design now transitions from Text to Display between 17 and 28 points**.»
- Por eso se rehízo la tabla: «you'll need to apply a new set of tracking values between 17 and 28 points.»
- Relación con CSS, dicha por Apple en la misma charla: tracking «is somewhat synonymous with letter-spacing, as in CSS».

Se ve en la tabla: el mínimo está en 17 pt (-26) y el tracking vuelve a positivo en 24 pt.

---

## 3. Licencia y uso de la fuente del sistema en la web

### 3.1 ¿Se puede servir SF Pro como webfont? No.

Fuente: texto de licencia mostrado en https://developer.apple.com/fonts/ («Apple San Francisco Font License Agreement», pie EA1370/EA1371, fechado 2/24/2016 en la propia página).

- Nota inicial: «THE APPLE SAN FRANCISCO FONT IS TO BE USED SOLELY FOR CREATING MOCK-UPS OF USER INTERFACES TO BE USED IN SOFTWARE PRODUCTS RUNNING ON APPLE'S iOS, OS X OR tvOS OPERATING SYSTEMS, AS APPLICABLE.»
- §2.A: «you may use the Apple Font solely for creating mock-ups of user interfaces to be used in software products running on Apple's iOS, OS X or tvOS operating systems».
- §2.B: «**You may not embed the Apple Font in any software programs or other products.** Except as expressly provided for herein, **you may not use the Apple Font to, create, develop, display or otherwise distribute any documentation, artwork, website content or any other work product.**»
- §2.B: «you may not make the Apple Font available over a network where it could be run or used by multiple computers at the same time. You may not rent, lease, lend, trade, transfer, sell, sublicense or otherwise redistribute the Apple Font in any unauthorized way.»

Conclusión: un `@font-face` que sirva SF Pro desde nuestro dominio queda prohibido por tres cláusulas a la vez (incrustar, «website content», disponible en red). Además la licencia ni siquiera cubre maquetas de software para sistemas que no sean de Apple (§2.B, primera frase).

Salvedad: el texto de la página es el de 2016. No descargué los `.dmg` para comprobar si la licencia incluida en el instalador actual difiere; **NO VERIFICADO** que sea palabra por palabra la misma. No conozco ninguna versión que autorice el uso como webfont.

### 3.2 Forma correcta: pedir la fuente del sistema, no nombrarla

**El texto del blog de WebKit no se pudo abrir (host bloqueado). Lo que sigue se apoya en otras fuentes primarias.**

- Apple, WWDC 2020 sesión 10175 (transcripción): «A few years ago, WebKit introduced the -apple-system font family so that you can use it to use San Francisco font in CSS. This has been widely adopted. **Now the -apple prefixed version has a standard name: system-ui.** And earlier this year, we're bringing a new set of CSS font family names, like ui-rounded, ui-serif and ui-monospace to Apple platforms.» — https://developer.apple.com/videos/play/wwdc2020/10175/
- Código de WebKit (`Source/WebCore/platform/graphics/cocoa/SystemFontDatabaseCoreText.cpp`, rama `main`): `-apple-system`, `-apple-system-font`, `system-ui` y `ui-sans-serif` se tratan como **la misma** familia; `ui-serif`, `ui-monospace` y `ui-rounded` tienen cada una su rama. — https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/cocoa/SystemFontDatabaseCoreText.cpp
- Especificación CSS Fonts 4, `system-ui`: «This generic font family lets text render with the default user interface font […] on the platform on which the UA is running. […] The purpose of system-ui is to allow web content to integrate with the look and feel of the native OS. This is useful for hybrid, web or cross-platform applications.» Y sobre `ui-sans-serif` / `ui-rounded`: «is not expected to map to any font on platforms without an appropriate system font.» — https://github.com/w3c/csswg-drafts/blob/main/css-fonts-4/Overview.bs (publicado en https://www.w3.org/TR/css-fonts-4/)
- Compatibilidad (MDN browser-compat-data, `css.properties.font-family`): — https://github.com/mdn/browser-compat-data/blob/main/css/properties/font-family.json

| Palabra clave | Safari / iOS | Chrome | Firefox |
|---|---|---|---|
| `system-ui` | 11 | 56 | 92 |
| `ui-sans-serif` | 13.1 | No | No |
| `ui-serif` | 13.1 | No | No |
| `ui-monospace` | 13.1 | No | No |
| `ui-rounded` | 13.1 | No | No |

Lectura práctica: `system-ui` es lo único portable. `ui-rounded`, `ui-serif` (New York) y `ui-monospace` (SF Mono) **sólo funcionan en Safari**; en Chrome y Firefox hay que poner un respaldo detrás.

- Blog de WebKit, «Using the System Font in Web Content» (https://webkit.org/blog/3709/using-the-system-font-in-web-content/): **NO VERIFICADO** — no pude abrirlo. Sólo vi fragmentos de buscador, que coinciden en que recomienda `-apple-system` y desaconseja llegar a la fuente por otros medios (nombres con punto inicial). No lo cito textualmente por no haberlo leído.
- Blog de WebKit sobre Safari 13.1 (introducción de `ui-*`): **NO VERIFICADO**, mismo motivo. La versión 13.1 sí está confirmada por MDN (tabla anterior).

---

## 4. Qué ve cada usuario con `font-family: system-ui`

| Sistema | Fuente resultante | Verificación |
|---|---|---|
| iOS / iPadOS / macOS (Safari y cualquier navegador sobre WebKit) | SF Pro, con tamaño óptico y tracking del sistema | **Verificado**: HIG («SF Pro is the system font in iOS and iPadOS» / «in macOS») + código de WebKit, que resuelve `system-ui` con `kCTFontUIFontSystem`. |
| Windows 11 | La fuente de interfaz del sistema. Microsoft: «Segoe UI Variable is the new system font for Windows» | **Parcial.** La guía de Microsoft dice también: «When using HTML, optical scaling is also automatic, but **you will need to specify the Segoe UI Variable font in CSS**». O sea que Microsoft no da por hecho que el HTML reciba Segoe UI Variable sin nombrarla. Si `system-ui` en Chrome/Edge entrega «Segoe UI» clásica o la Variable: **NO VERIFICADO**. — https://github.com/MicrosoftDocs/windows-dev-docs/blob/docs/hub/apps/design/signature-experiences/typography.md |
| Android | Roboto en Android de serie; los fabricantes pueden sustituirla | **NO VERIFICADO** en fuente primaria (developer.android.com y m3.material.io bloqueados). |
| Linux | La fuente de interfaz configurada en el escritorio (varía por distribución) | **NO VERIFICADO.** |

Advertencia de MDN sobre `system-ui` (verificada): «`system-ui` is intended to make UI elements look like native apps, and not for typesetting large paragraphs of text. It may cause the displayed typeface to be undesirable for some users—for example, the default Windows CJK font may render Latin scripts poorly […] Some operating systems do not allow customizing `system-ui`, while browsers generally allow customizing the `sans-serif` font family.» — https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/properties/font-family/index.md

### 4.1 Diferencias de métricas

Lo que pude **medir** (leyendo las tablas `OS/2`, `hhea` y `hmtx` de los archivos de fuente abiertos en https://github.com/google/fonts, con fontTools; estilo Regular por defecto):

| Fuente | Altura x / em | Altura de mayúscula / em | Ascendente / descendente (hhea, UPM 2048) | Avance medio por carácter* |
|---|---|---|---|---|
| Roboto | 0,528 | 0,711 | 1900 / -500 | 0,464 em |
| Inter | 0,546 | 0,728 | 1984 / -494 | 0,494 em |

\* Sobre una frase clínica de prueba de 100 caracteres en español con cifras. Con esa muestra Inter ocupa **~6 % más de ancho** que Roboto al mismo `font-size`.

Lo que **no** pude medir: SF Pro (su licencia limita el uso a maquetas y no descargué el archivo) y Segoe UI / Segoe UI Variable (no son abiertas). Cualquier cifra de altura x o anchura de esas dos sería de memoria: **NO VERIFICADO**. Lo único verificable es cualitativo y sale de las propias fuentes citadas: cada una trae su espaciado nativo, y SF Pro además lo corrige por tamaño con la tabla de §2, cosa que las otras no hacen igual.

Qué prever en cualquier caso:

1. **Ancho de línea distinto por sistema**: botones, pestañas, celdas de tabla y etiquetas truncadas no medirán lo mismo en iPhone, Windows y Android. Diferencias de un dígito porcentual bastan para que una etiqueta parta en dos líneas.
2. **Altura de línea distinta** si se deja `line-height: normal`, porque sale de las métricas verticales de cada fuente. Se neutraliza fijando `line-height` explícito (los leading de §1.3 sirven de referencia: 22/17 ≈ 1,29 para Body).
3. **Pesos disponibles distintos**: SF Pro tiene nueve pesos; la guía de Windows lista Light 300, Semilight 350, Regular 400, Semibold 600 y Bold 700 para Segoe UI Variable (sin 500). Un `font-weight: 500` («Medium», recomendado por la HIG) no tiene equivalente exacto ahí.
4. **Tracking**: no trasladar los valores de SF Pro a otra fuente (§2.2).

Cómo se mitiga — hay dos caminos y son excluyentes:

- **A. Pila del sistema** (`system-ui` primero). Es lo que Apple describe y lo que integra con cada sistema; cero bytes de fuente. Coste: el diseño tiene que tolerar las diferencias de arriba (nada de anchos fijos, `line-height` explícito, probar en Windows y Android). Es coherente con lo que la HIG pide de todos modos para Dynamic Type.
- **B. Una fuente web neutra fija** (p. ej. Inter, licencia OFL) para todos los sistemas. Da métricas idénticas en todas partes y un único juego de pesos; a cambio la app deja de usar la fuente de Apple en iPhone —que es justo lo que la HIG recomienda— y hay que descargar la fuente.
- Variante intermedia: `system-ui` en plataformas Apple y fuente web en el resto. Técnicamente posible, pero mantiene dos juegos de métricas; no la encontré recomendada en ninguna fuente primaria.

Los descriptores `size-adjust`, `ascent-override` y `descent-override` de `@font-face` existen para acercar las métricas de una fuente de respaldo a las de la principal; no comprobé su compatibilidad en esta sesión (**NO VERIFICADO**).

---

## 5. Dynamic Type en la web

Punto de partida, verificado en la HIG: Dynamic Type existe en iOS, iPadOS, tvOS, visionOS y watchOS; «macOS doesn't support Dynamic Type». Y en Accessibility: «Ideally, give people the option to enlarge text by at least 200 percent». — https://developer.apple.com/design/human-interface-guidelines/accessibility

### 5.1 Estado de cada mecanismo en Safari

| Mecanismo | Safari / iOS hoy | Fuente |
|---|---|---|
| `font: -apple-system-body` (y `-headline`, `-subheadline`, `-footnote`, `-caption1`, `-caption2`, `-title1`…`-title4`, `-title0`, `-short-*`, `-tall-body`) | **Existe, sólo en WebKit de Apple.** Las palabras clave están en `CSSValueKeywords.in` con `enable-if=WTF_PLATFORM_COCOA`, y el código las resuelve con los estilos de texto de CoreText (`kCTUIFontTextStyleBody`, etc.), que son los que siguen Dynamic Type. No es estándar: Chrome y Firefox lo ignoran. | https://github.com/WebKit/WebKit/blob/main/Source/WebCore/css/CSSValueKeywords.in · https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/cocoa/SystemFontDatabaseCoreText.cpp |
| `-webkit-text-size-adjust` | **Soportado con prefijo en Safari de iOS** desde la 1; **no** en Safari de escritorio. | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-size-adjust.json |
| `text-size-adjust` (sin prefijo) | **No soportado en Safari.** Chrome 54; Firefox no. | misma fuente |
| `env(preferred-text-scale)` | **No soportado en Safari.** Chrome 138. | https://github.com/mdn/browser-compat-data/blob/main/css/types/env.json |
| `<meta name="text-scale" content="scale">` | **No soportado en Safari.** Chrome 146. En el código de WebKit existe el interruptor `CSSTextScaleMetaEnabled` («Enable parsing of the text-scale meta element, defined in CSS Fonts 5»), estado `testable`, **valor por defecto `false`**. | https://github.com/mdn/browser-compat-data/blob/main/html/elements/meta.json · https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml |

Comprobación adicional: en las notas de versión de Safari 26, 26.1–26.6, 27, 27.1 y 27.2 **no aparece** ni `text-scale` ni `preferred-text-scale` ni `text-size-adjust`. — https://developer.apple.com/documentation/safari-release-notes

### 5.2 Qué es cada cosa (para no confundirlas)

- **`-webkit-text-size-adjust` no es Dynamic Type.** Controla el algoritmo de «inflado» de texto del navegador móvil. MDN: «controls the text inflation algorithm used on some smartphones and tablets»; y: «on a properly designed responsive site the `text-size-adjust` behavior is not needed». Documentación de Apple (archivo): «On iPad, the default value for -webkit-text-size-adjust is none. On all other devices, the default value is auto.» — https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/properties/text-size-adjust/index.md · https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
  El uso habitual de `-webkit-text-size-adjust: 100%` es impedir que iOS infle el texto al girar a horizontal; que ese sea su efecto exacto en Safari actual: **NO VERIFICADO** en fuente primaria en esta sesión.
- **`env(preferred-text-scale)` y `<meta name="text-scale">` son el camino estándar** (CSS Fonts 5 / CSS Environment Variables). La especificación define que con `content="scale"` el tamaño `medium` pasa a ser 16px × el factor de escala del usuario, incorporando la preferencia del sistema operativo. MDN recomienda la etiqueta `<meta>` frente al `env()` y avisa de no combinarlos: «this will result in text scaling being applied twice». — https://github.com/w3c/csswg-drafts/blob/main/css-fonts-5/Overview.bs · https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/values/env/index.md
  En Safari, hoy, ninguno de los dos funciona. En Chrome de Android sí.
- **`font: -apple-system-body` es el único mecanismo que hoy conecta una web con Dynamic Type en iOS.** El patrón conocido es aplicarlo al elemento raíz y dimensionar todo lo demás en `rem`, de modo que el 17 pt del Body se convierta en la unidad base. Que el blog de WebKit lo describa así: **NO VERIFICADO** (blog bloqueado); la existencia y el enlace con los estilos de texto del sistema sí están verificados en el código. Dos consecuencias a prever: toda la escala crece de forma **lineal** con `rem` (los títulos crecerán más que en una app nativa, §1.3), y en los tamaños AX el Body llega a 53 pt, así que el diseño debe aguantar ~3×.

### 5.3 Lo que sí es seguro en todos los navegadores

Dimensionar el texto en `rem`/`em` en lugar de `px` y no fijar `font-size` en píxeles en la raíz: así se respeta el tamaño que el usuario haya configurado en el navegador, y el día que Safari active `text-scale` la app lo heredará sin cambios. Esto es deducción mía a partir de la especificación citada, no una frase de Apple.

---

## 6. Área táctil mínima y texto legible

### 6.1 Área táctil

HIG › Accessibility (https://developer.apple.com/design/human-interface-guidelines/accessibility): «Offer sufficiently sized controls. Controls that are too small are hard for many people to interact with and select. Strive to meet the recommended minimum control size for each platform».

| Platform | Default control size | Minimum control size |
|---|---|---|
| iOS, iPadOS | 44x44 pt | 28x28 pt |
| macOS | 28x28 pt | 20x20 pt |
| visionOS | 60x60 pt | 28x28 pt |
| watchOS | 44x44 pt | 28x28 pt |

(La tabla tiene además una fila de tvOS que no copié.)

HIG › Buttons (https://developer.apple.com/design/human-interface-guidelines/buttons): «As a general rule, a button needs a hit region of at least 44x44 pt — in visionOS, 60x60 pt — to ensure that people can select it easily, whether they use a fingertip, a pointer, their eyes, or a remote.»

**Matiz importante de la HIG vigente:** 44×44 pt es el tamaño **por defecto** y la regla general para la región de toque de un botón; la página de accesibilidad admite un **mínimo de 28×28 pt** en iOS. Para una app clínica conviene diseñar a 44 y tratar 28 como suelo excepcional.

### 6.2 Texto legible

- Tamaños: tabla de §1.2 (iOS 17 pt por defecto, 11 pt mínimo; macOS 13 pt y 10 pt).
- Ampliación: «give people the option to enlarge text by at least 200 percent».
- Contraste (valores WCAG AA que usa el Accessibility Inspector de Apple, tabla tal cual):

| Text size | Text weight | Minimum contrast ratio |
|---|---|---|
| Up to 17 pts | All | 4.5:1 |
| 18 pts | All | 3:1 |
| All | Bold | 3:1 |

- Pesos: evitar Ultralight, Thin y Light (§1.1).

Equivalencia pt → CSS: ASUMIENDO que con `<meta name="viewport" content="width=device-width">` un punto de iOS equivale a un píxel CSS (es la convención de la plataforma; no la verifiqué en fuente primaria en esta sesión), los valores se trasladan 1:1: Body 17px, mínimo 11px, objetivo táctil 44×44px.

---

## 7. iPhone Duo (plegable)

### 7.1 Fuentes oficiales encontradas

**Sí hay fuente oficial de Apple.** La HIG tiene una página propia, nueva del 09/09/2026: https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo — y guía para desarrolladores en https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo

Resumen de la página de la HIG (citas literales):

- Hardware: «iPhone Duo has two displays, each with its own front-facing camera. A hinge in the center lets people open and close the device».
- Sigue siendo iPhone: «keep in mind that you're still designing for iPhone, and Designing for iOS patterns and best practices still apply.»
- Dos anchos, no un diseño por postura: «A compact width layout for the outer display and a regular width layout for the inner display give you the fundamentals for every pose. Don't reinvent your app when it resizes».
- Regla central: «Use size classes, layout margins, and safe area insets to lay out controls and content. **Avoid fixed widths and display-specific dependencies.**»
- Pantalla exterior más ancha y baja: «Because the outer display is wider and shorter than the display on other iPhone devices, the system moves controls to the side to preserve vertical space for content». Las barras de herramientas, de pestañas y de navegación pasan al lateral; la excepción es la pantalla interior en vertical.
- **Asimetría de las áreas seguras:** «Because controls sit along one edge, the space for content is asymmetrical. Use safe areas to make sure controls don't cover your content, including controls on the opposite edge».
- Regiones reservadas, además de las áreas seguras habituales: la cámara frontal exterior (siempre presente, se expande en la Dynamic Island), la cámara interior (sólo cuando está activa) y **la región de pliegue**: «When the device is partially open, the folding region divides the inner display into multiple usable regions, excluding the region at the center as the display folds.»
- Al plegar: «In a grid-style layout, prefer an even number of columns so content divides cleanly.» y «Avoid extreme layout changes as people fold the device.»
- Consistencia: «Keep functionality and the state of elements the same between displays.»
- Botones: «Keep text-based buttons to a minimum. Labels that include text stay in a horizontal bar, so prefer a symbol wherever one works.»

**Tipografía:** la página **no contiene ninguna recomendación tipográfica específica** para el Duo (ni tamaños, ni estilos, ni tracking). La única mención al tamaño del texto es para juegos: «When resizing, keep text and control sizes as consistent as possible.» La página de Typography de la HIG no menciona el Duo ni los plegables (comprobado: cero coincidencias), y las de Layout y Accessibility tampoco. Se deduce que rigen las tablas de iOS de §1 sin cambios; es deducción, Apple no lo dice expresamente.

Las medidas concretas de márgenes y áreas seguras no están en la página: remite a Apple Design Resources (https://developer.apple.com/design/resources/), que no abrí.

### 7.2 Web: lo que dice Apple en las notas de Safari 27.1

Fuente: https://developer.apple.com/documentation/safari-release-notes/safari-27_1-release-notes («Safari 27.1 is available for iOS 27.1»). Las notas hablan de «a foldable device»; no nombran el modelo.

- PDF: «Added support for automatically showing PDFs as two pages side by side when a foldable device is partially folded into a book pose».
- «Added support for the **Device Posture API behind a feature flag**, so websites can respond when a device is folded. `navigator.devicePosture.type` returns `continuous` or `folded`». Media query `device-posture`.
- «Added support for the **Viewport Segments API behind a feature flag**, so websites can lay out content around a fold between the separate areas of the screen.» Media queries `horizontal-viewport-segments` y `vertical-viewport-segments`; variables `env()` `viewport-segment-width`, `-height`, `-top`, `-right`, `-bottom`, `-left`, con índices horizontal y vertical.

MDN lo confirma: en Safari de iOS constan como 27.1 **con indicador de función (flag)**, y en Safari de escritorio como no soportadas. — https://github.com/mdn/browser-compat-data/blob/main/css/types/env.json · https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/media.json
En el código de WebKit, `DevicePostureAPIEnabled` y `ViewportSegmentsAPIEnabled` tienen `defaultValue: false`. — https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml

**Consecuencia para la PWA:** hoy un usuario normal de iPhone Duo **no** tiene activas estas dos API, así que no se puede diseñar contando con ellas. Lo que sí funciona es lo de siempre: diseño fluido y `env(safe-area-inset-*)` (soportado desde Safari 11), tratando **cada lado por separado**, porque en este dispositivo los márgenes no son simétricos.

### 7.3 Lo que NO pude verificar

- **El artículo del blog de WebKit sobre Safari 27.1 (https://webkit.org/blog/18486/webkit-features-for-safari-27-1/) no se pudo abrir.** No sé qué dice de primera mano.
- Cobertura de prensa que dice resumirlo (fuentes secundarias, **NO VERIFICADO**): que las páginas se muestran entre 382 y 951 píxeles CSS de ancho según la postura; que Xcode 27.1 simula el dispositivo en Device Hub; y que en la pantalla exterior Safari 27.1 deja fuera del contenido web la franja de los controles laterales, rellenándola con el color de fondo de la página, cosa que Apple estaría estudiando cambiar. — https://ppc.land/safari-27-1-on-iphone-duo-runs-web-pages-from-382-to-951-pixels-wide/ · https://9to5mac.com/2026/10/23/apple-exploring-fix-for-safaris-cramped-layout-on-the-iphone-duos-outer-display/
  Si la cifra de 382–951 px fuera cierta, la misma PWA tendría que funcionar desde ancho de teléfono hasta ancho de tableta en un solo dispositivo; conviene confirmarlo en el blog antes de fijar puntos de corte.
- Cómo se comporta una PWA **instalada** (pantalla de inicio) en el Duo respecto a los controles laterales: no encontré fuente oficial.

---

## 8. Recomendación

**La recomendación de Apple en una frase:** usar la fuente del sistema con sus estilos de texto integrados —sin incrustarla—, respetar los tamaños por defecto y mínimo de cada plataforma (17/11 pt en iOS, 13/10 pt en macOS) y dejar que el texto escale con la preferencia del usuario.

Traducción a esta PWA, con lo verificado:

1. **Fuente:** `font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Nunca SF Pro por `@font-face` (prohibido por licencia, §3.1). `ui-rounded`, `ui-serif` y `ui-monospace` sólo si se acepta que fuera de Safari cae al respaldo.
2. **Escala:** tomar la tabla de iOS «Large» (§1.3) como escala base en `rem`, con `line-height` explícito a partir de los leading. No bajar de 11px.
3. **Tracking:** no escribir `letter-spacing` con los valores de SF Pro si se usa `system-ui`: en dispositivos Apple lo hace el sistema y en los demás la fuente es otra. La tabla de §2 sólo sirve para maquetas.
4. **Tamaño de texto del usuario:** todo en `rem`. El enlace con Dynamic Type en iOS pasa hoy por `font: -apple-system-body` (sólo WebKit); `env(preferred-text-scale)` y `<meta name="text-scale">` aún no existen en Safari.
5. **Tacto:** 44×44px por defecto; 28×28px es el suelo que admite la HIG.
6. **Plegable:** nada de anchos fijos y `env(safe-area-inset-*)` lado por lado. Las API de pliegue en Safari siguen tras un indicador de función.

Decisión abierta que no resuelve ninguna fuente: fuente del sistema (camino A de §4.1, el de Apple) frente a fuente web única (camino B, métricas idénticas en Windows y Android). Depende de cuánto pese la uniformidad entre sistemas frente al aspecto nativo en iPhone.

Pendiente de verificación si se permite `webkit.org`: el texto de los dos artículos del blog (§3.2 y §7.3) y el comportamiento descrito para `font: -apple-system-body` (§5.2).
