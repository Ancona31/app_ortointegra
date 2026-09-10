# Modo oscuro · Aplicación Spinus

Criterio y valores para llevar la app al modo oscuro que la agenda ya tiene. Hermano de
`MODO_OSCURO_AGENDA.md`: aquel resuelve `--ag-*`, éste resuelve `--sp-*`. **La agenda no se
toca** — sus veinte valores de estado y sus seis de evento están medidos, en producción y
fuera del alcance de este documento.

Todo se compone sobre **`#1E1E1E`** (`--sp-surface` en oscuro), la superficie de card. Es el
caso conservador: sobre el lienzo de página (`#121212`) todos los contrastes de aquí suben.
**No es el azul oscuro de la agenda** (`--ag-bg-main`, `#0f1828`), que es otra superficie.

El criterio es **mixto**, que es lo que la agenda hace de hecho: **fórmula** para lo que
depende del color que el médico elige (`--cs`, `--cp`), porque es variable y no se puede
tabular; **tabla de hexes medidos** para las familias fijas.

---

## 1 El criterio de derivación

Es el de `MODO_OSCURO_AGENDA.md` §2, sin cambios. Se repite aquí porque este documento se
lee solo.

| Rol | Regla |
|---|---|
| `dot` (gráfico: punto, icono, filete, relleno) | Nivel **400** de la familia. Mínimo **3:1 contra su propio fondo** — es un gráfico, no texto. |
| `text` (tinta) | Un escalón más claro, nivel **300**. Da 7–9:1 sobre el `bg`. |
| `bg` (relleno tenue) | **El hex de modo CLARO al 18–22 %** sobre la superficie. |
| `border` | El `dot` al **34–40 %**. |

**Por qué el relleno parte del color del punto y no del fondo claro.** El `bg` de modo claro
es un tinte casi blanco (`#eff6ff`, `#ecfdf5`): al 20 % sobre negro no deja color, deja un
gris sucio. El hex saturado sí sobrevive a la mezcla, y además mantiene el tono reconocible
como el mismo estado en los dos temas. La regla dice «el hex claro», no «el `bg` claro»:
confundirlos es el error que produce el gris.

**Un token, varios roles.** Los `--sp-doc-*` no son cuatro tokens por familia como en la
agenda: son **uno solo** que hace de icono (gráfico, 3:1), de rótulo de 10 px (texto, 4.5:1)
y de relleno al 12 % con filete. Manda el rol más exigente, así que la tabla de §4 se mide
como **texto**.

---

## 2 Los dos listones

### 2.1 Contraste

**4.5:1 contra `#1E1E1E`** para todo token que pueda ser tinta. 3:1 para lo estrictamente
gráfico. Los valores de §4 se piden a **5.5:1** — un escalón por encima del mínimo, porque
son rótulos de 10–11 px y porque el margen es lo que permite mover un valor por par sin
volver a caer bajo el listón.

### 2.2 Suelo de croma — **el listón que faltaba**

La ausencia de este segundo listón es lo que produjo el lavado actual. La fórmula vigente
—`color-mix(… 45 %, #fff)`— optimizó contraste sin poner ningún límite al croma, y el
resultado pasa AA con holgura mientras el color desaparece.

**El número: `C ≥ 0.12` en OKLCH.**

**Por qué OKLCH y no la `S` de HSL.** La `S` de HSL se infla en los colores oscuros:
`#047857` mide S 93.5 y no es un verde vivo, es un verde oscuro. Como suelo aprobaría valores
muertos y rechazaría válidos. El croma de OKLCH es perceptual y no tiene ese sesgo. En §4 se
listan las dos: `S` hace evidente el colapso, `C` es la que manda.

**Por qué 0.12.** Sale de medir lo que ya está en producción y funciona contra lo que ya está
en producción y no funciona:

| Grupo | C mínimo | C mediano | C máximo |
|---|---|---|---|
| Agenda oscura, familias con color (13 tokens) | 0.085 | 0.156 | 0.208 |
| `--sp-doc-*` + `--sp-hito-*` oscuros de hoy (9 tokens) | 0.039 | 0.076 | 0.117 |

**Once de los trece de la agenda están en 0.130 o por encima; los nueve lavados están todos
en 0.117 o por debajo.** La frontera cae limpia en ese hueco, y 0.12 es el punto medio.

Los dos únicos valores de la agenda que quedan por debajo del suelo lo hacen por una razón
escrita: `status-confirmed-text` (0.085) es tinta secundaria dentro de una píldora que ya
lleva su `dot` al lado, y `evento-bronce` (0.111) **bajó de croma a propósito** para
separarse del ámbar de «agendada» (`globals.css`, nota junto al token). Los dos son
excepciones documentadas, no contraejemplos.

**Excepción explícita: los neutros por diseño.** El suelo se aplica a los tokens cuyo trabajo
es *identificar por color*. No se aplica a los que son neutros a propósito —
`--ag-status-no_show-dot` (C 0.035), `--ag-evento-grafito` (0.057)— ni al médico que elige
una paleta gris: «Pizarra oscuro» tiene C 0.037 y **la fórmula la conserva, no la inventa**.
Preservar el croma nunca significa añadirlo.

---

## 3 La marca — fórmula

`--cs` y `--cp` son un `<input type="color">`: la fórmula tiene que valer para cualquier hex,
no sólo para las seis paletas del selector. Las seis son el banco de pruebas.

### 3.1 Las dos fórmulas

```css
/* RELLENO de marca — botón primario, disco, pastilla activa */
--sp-primary:      oklch(from var(--cs, #1e5fa8) 0.55 c h);
/* TINTA de marca — rótulos, enlaces, cifras, filete de selección */
--sp-primary-text: oklch(from var(--cs, #1e5fa8) 0.70 c h);
--sp-primary-ink:  oklch(from var(--cs, #1e5fa8) 0.70 c h);
```

`c h` sin tocar: **el croma y el tono se conservan exactamente**, sólo se mueve la claridad.
Es la operación que `color-mix(…, #fff)` no sabe hacer.

**No sirve `hsl(from … h s L%)`,** aunque el proyecto ya la use para `--ag-navy`. La `L` de
HSL no sigue a la luminancia entre tonos distintos: la ventana útil para el relleno va de
`L 26–28` en «Verde médico» a `L 59–63` en «Morado». **No existe una `L` de HSL que sirva a
las seis.** En OKLCH sí, porque su `L` es claridad perceptual.

### 3.2 Validación en las seis paletas

Relleno a `0.55` — pide **≥3:1 contra la card** (que el botón tenga forma) y **≥4.5:1 del
blanco encima** (`--sp-on-primary`, que no se tematiza).
Tinta a `0.70` — pide **≥4.5:1 contra la card**.

| Paleta | `--cs` | S / C | Relleno `.55` | card | blanco | Tinta `.70` | contraste | S / C | Hoy (45 % blanco) | C |
|---|---|---|---|---|---|---|---|---|---|---|
| Spinus (defecto) | `#1e5fa8` | 69.7 / 0.134 | `#3373bd` | 3.44 | 4.85 | `#61a1ef` | 6.23 | 81.6 / 0.133 | `#9ab7d8` | 0.057 |
| Verde médico | `#0d9488` | 83.9 / 0.104 | `#008479` | 3.63 | **4.59** | `#40b3a6` | 6.52 | 47.3 / 0.104 | `#92cfc9` | 0.063 |
| Morado | `#7c3aed` | 83.3 / 0.247 | `#7e3df0` | **3.03** | 5.51 | `#a486ff` | 5.90 | 100.0 / 0.173 | `#c4a6f7` | 0.117 |
| Rojo burdeos | `#dc2626` | 72.2 / 0.215 | `#d2161c` | 3.07 | 5.42 | `#ff6459` | 5.73 | 100.0 / 0.191 | `#ef9d9d` | 0.098 |
| Café cálido | `#b45309` | 90.5 / 0.146 | `#b25105` | 3.23 | 5.16 | `#e58044` | 5.96 | 75.6 / 0.145 | `#ddb290` | 0.068 |
| Pizarra oscuro | `#475569` | 19.3 / 0.037 | `#647388` | 3.45 | 4.83 | `#90a0b6` | 6.26 | 20.7 / 0.037 | `#acb2bc` | 0.016 |

Las seis pasan los dos listones. **La tinta sube el croma entre 1.5 y 2.3 veces** frente a lo que
hay hoy (0.133 vs 0.057 en la paleta por defecto). El croma se conserva íntegro en el relleno; en
la tinta, «Morado» y «Rojo burdeos» pierden algo (0.247→0.173, 0.215→0.191) porque a `L 0.70`
el gamut sRGB ya no da más — es techo físico, no pérdida de la fórmula.

> ### ⚠️ LA VENTANA DEL RELLENO ES DE 0.008 Y NO ES HOLGURA, ES SUERTE
>
> Las ventanas por paleta son `[0.521, 0.569]` Spinus, `[0.507, 0.555]` Verde,
> `[0.547, 0.595]` Morado, `[0.545, 0.594]` Rojo, `[0.532, 0.580]` Café,
> `[0.519, 0.566]` Pizarra. **La intersección es `[0.547, 0.555]`.** Existe, pero cabe
> justa. Se cierra entera si alguna vez `--sp-on-primary` deja de ser blanco puro, si el
> listón del relleno sube de 3:1, o si se añade al selector una paleta más cromática que
> «Morado». Si eso pasa, la salida no es forzar la `L`: es partir el token en dos
> (`--sp-primary` para el relleno, y que la tinta de encima deje de ser blanca).

### 3.3 `--sp-primary` cambia de hex entre modos

**Sí, y es deliberado.** La agenda ya tomó esta decisión para su ámbito
(`MODO_OSCURO_AGENDA.md` §6: *«el azul primario sube de `#1e5fa8` a `#2f6fed` […] es el único
token de marca que cambia de hex entre modos»*). Aquí se extiende a `--sp-primary`, que hoy
**no se redefine en oscuro** y por eso vale `#1e5fa8` sobre `#1e1e1e`: **2.59:1**, por debajo
del listón gráfico, con el botón hundido en la card y los rótulos que usan este token como
tinta por debajo de AA.

Consecuencia que hay que asumir: el hex que el médico elige en `/perfil` **no es el que se
pinta en oscuro**. La vista previa de esa pantalla ya enseña el color sobre claro y sobre
oscuro (`perfil/page.tsx:1050`), así que el sitio donde explicarlo existe.

### 3.4 Hover y active — **decidido: oscurecen**

```css
--sp-primary-hover:  oklch(from var(--cs) 0.49 c h);
--sp-primary-active: oklch(from var(--cs) 0.43 c h);
```

**Ninguna de las dos direcciones cumple los dos listones**, así que se eligió cuál cede:

| Dirección | Blanco encima (mín. de las 6) | Contra la card (mín. de las 6) |
|---|---|---|
| Aclarar, `L 0.61` | **3.60** ✗ | 3.96 ✓ |
| Oscurecer, `L 0.50` | 5.74 ✓ | **2.43** ✗ |

Cede la **forma** y no la **información**: aclarar rompe la legibilidad del rótulo blanco;
oscurecer rompe el contorno del botón contra la card, y eso es tolerable porque durante el
hover el cursor ya está encima y el usuario sabe dónde está.

**El escalón es 0.06 y sale de medir.** El listón es ΔE2000 ≥ 5.31, que es el salto de
«Morado» en el esquema anterior — el más pequeño de los que ya se leían como hover. Con 0.06:
reposo→hover 6.15-7.13 y hover→active 5.70-6.36 en las seis paletas. Con 0.05 el primer
escalón cae a 5.17 en «Rojo burdeos» y «Café cálido», por debajo del listón.

Blanco encima, las seis: reposo 4.59-5.51 · hover 5.98-7.18 · active 7.79-9.28. Contra la
card, lo que cede: hover 2.32-2.79 · active 1.80-2.14. El `active` añade además
`translateY(1px)`, o sea que no depende sólo del color.

⚠️ Lo que sí queda descartado con número es el token de hoy, que **aclara con
`color-mix(--cs 88 %, #fff)`**: aclarar sin límite es la dirección que rompe el rótulo. Y el
comentario que justifica esa elección —«con `var(--cp)` el botón cae a 1.07–1.76:1»— medía
contra `--cp` crudo, que es un salto, no un escalón. Con `oklch(… 0.50 c h)` la caída es a
2.43:1, no a 1.07: **el argumento de aquel comentario ya no aplica a esta fórmula.**


### 3.5 El degradado de marca

```css
:root      { --sp-brand-grad-from: var(--cp);
             --sp-brand-grad-to:   oklch(from var(--cs) min(l, 0.52) c h); }
html.dark  { --sp-brand-grad-from: oklch(from var(--cp) 0.42 c h);
             --sp-brand-grad-to:   oklch(from var(--cs) 0.55 c h); }
```

Viste las cabeceras de card, los botones de recompensa y los medallones de icono. Existe
porque esos degradados iban escritos `from-[#1a3a5c] to-[#1e5fa8]`, congelados en dos
sentidos: no seguían al color que el médico elige —una clínica con paleta verde tenía
cabeceras azules— y no cambiaban con el tema, así que en oscuro el bloque quedaba a 1.5:1
contra la card y dejaba de leerse como bloque.

**Las dos claridades no son valores nuevos: son las dos que este documento ya fija.** `0.42`
es la del cromo de marca (`--ag-navy`, el menú y la franja) y `0.55` la del relleno de marca
(`--sp-primary`, §3.1). O sea que el degradado va **del tono del menú al del botón primario**,
que son los dos extremos que la app ya usa para «marca como superficie». Inventar un tercer
par de claridades para esto habría sido añadir una escala paralela sin necesidad.

En claro los dos extremos son `--cp` y `--cs` **a pelo**, sin fórmula: con la marca de
fábrica eso son exactamente los dos hex que estaban escritos, así que el tema claro no se
mueve para quien no ha cambiado su paleta.

| | Contra la card (oscuro) | Blanco encima (mín. de las 6) |
|---|---|---|
| Extremo oscuro `0.42` | 1.84 – 2.02 | 8.25 |
| Extremo claro `0.55` | 3.03 – 3.63 | **4.59** |

> ### ⚠️ EL EXTREMO CLARO LLEVA TOPE, Y ES POR EL RÓTULO BLANCO
>
> **El listón de estos bloques lo pone el blanco encima, no la separación contra la card:**
> siempre llevan rótulo blanco. En oscuro la claridad ya está pinchada en `0.55` y el mínimo
> de las seis paletas es 4.59:1, así que ahí no hace falta nada. En claro, con `--cs` a pelo,
> el extremo de «Verde médico» (`#0d9488`) dejaba el blanco en **3.74:1**, por debajo de AA.
>
> El tope `min(l, 0.52)` lo resuelve: **el mínimo de las seis sube de 3.74 a 5.23:1.**
>
> | Paleta | `--cs` | Blanco antes | Blanco con tope | ¿la toca? |
> |---|---|---|---|---|
> | Spinus (defecto) | `#1e5fa8` | 6.45 | **6.45** | no — su `l` es 0.485 |
> | Pizarra oscuro | `#475569` | 7.58 | **7.58** | no — su `l` es 0.446 |
> | Verde médico | `#0d9488` | **3.74** | **5.23** | sí |
> | Rojo burdeos | `#dc2626` | 4.83 | **6.16** | sí |
> | Café cálido | `#b45309` | 5.02 | **5.83** | sí |
> | Morado | `#7c3aed` | 5.70 | **6.29** | sí |
>
> **Con la marca de fábrica el tema claro no se mueve ni un píxel**, y no es una estimación:
> el ida y vuelta por OKLCH devuelve `#1e5fa8` exacto. Cuatro paletas pierden un punto de
> claridad y siguen siendo su color; a cambio el rótulo se lee en las seis. Un texto a 3.74:1
> en una cabecera no se lee.
>
> ⚠️⚠️ **ES LA ÚNICA FÓRMULA DEL SISTEMA QUE HACE ARITMÉTICA SOBRE UN CANAL**, y eso rompe la
> premisa de §7. Chromium anterior a la 121 resuelve la `l` de `oklch()` en escala 0-100 en
> vez de 0-1, así que allí `min(l, 0.52)` da siempre `0.52` y las seis paletas quedan
> pinchadas en esa claridad en vez de sólo las cuatro que lo necesitan. **Está medido y la
> degradación es benigna:** el mínimo de blanco encima sigue siendo 5.23:1 —el fallo da MÁS
> contraste, nunca menos— y lo único que cambia es que «Spinus» y «Pizarra» se aclaran un
> punto. La ventana afectada es Chrome 119-120.
>
> ⚠️ **No copies este `min()` a otro token dando por hecho que es inocuo.** Aquí lo es porque
> el peor caso mejora el contraste. En un token donde el fallo lo empeorase, habría que
> resolverlo de otra forma.

---

## 4 Las nueve familias fijas

Ocho tipos de documento (`--sp-doc-*`) y el hito de medición (`--sp-hito-medicion`). Son
literales y no `color-mix` sobre su propio token: eso sería referencia cíclica y la propiedad
quedaría inválida, no heredada.

Contraste medido sobre `#1E1E1E`. `S` es HSL, `C` es OKLCH.

| Familia | Claro | S / C | **Oscuro HOY** | S / C | **Oscuro NUEVO** | S / C | contraste |
|---|---|---|---|---|---|---|---|
| `doc-receta` | `#1d4ed8` | 76.3 / 0.217 | `#99afed` | 70.0 / 0.093 | **`#4899fb`** | 95.7 / 0.165 | 5.74 |
| `doc-laboratorio` | `#047857` | 93.5 / 0.105 | `#8ec2b3` | 29.9 / 0.059 | **`#00b781`** | 100.0 / 0.148 | 6.42 |
| `doc-imagen` | `#7c3aed` | 83.3 / 0.247 | `#c4a6f7` | 83.5 / 0.117 | **`#a17efe`** | 98.5 / 0.183 | 5.50 |
| `doc-suplementacion` | `#92400e` | 82.5 / 0.125 | `#cea993` | 37.6 / 0.053 | **`#e7ad00`** | 100.0 / 0.160 | 8.24 |
| `doc-internamiento` | `#be123c` | 82.7 / 0.198 | `#e294a7` | 57.4 / 0.097 | **`#fd5d79`** | 97.6 / 0.195 | 5.57 |
| `doc-escrito` | `#155e75` | 69.6 / 0.077 | `#96b7c1` | 25.7 / 0.039 | **`#00cee9`** | 100.0 / 0.136 | 8.74 |
| `doc-consentimiento` | `#3730a3` | 54.5 / 0.177 | `#a5a2d6` | 38.8 / 0.075 | **`#9fabff`** | 100.0 / 0.121 | 7.73 |
| `doc-honorarios` | `#c2410c` | 88.3 / 0.174 | `#e4aa92` | 60.3 / 0.076 | **`#ee7d00`** | 100.0 / 0.173 | 6.01 |
| `hito-medicion` | `#86198f` | 70.2 / 0.192 | `#c998cd` | 34.6 / 0.092 | **`#e360f7`** | 90.4 / 0.239 | 5.78 |

Los nueve de hoy caen bajo el suelo de croma; los nueve nuevos lo pasan. Ninguno baja de
5.50:1.

**De dónde salen.** Se toman **el tono y el croma del nivel 400** de la familia de Tailwind y
se ajusta sólo la claridad, dentro de la banda `L 0.68–0.78` de OKLCH, para resolver los
pares de §5. Donde el gamut sRGB no admite ese croma a la claridad elegida, se recorta al
máximo posible — es lo que deja a `consentimiento` en 0.121. Referencias: `receta` ≈ blue-400, `laboratorio` ≈ emerald-500,
`imagen` ≈ violet-400, `suplementacion` ≈ amber-500, `internamiento` ≈ rose-400,
`escrito` ≈ cyan-400, `consentimiento` ≈ indigo-300, `honorarios` ≈ orange-500,
`hito` ≈ fuchsia-400. Los que se apartan del 400 lo hacen por par, no por gusto.

⚠️ **`doc-consentimiento` queda en C 0.121, a una milésima del suelo.** No es holgura. Está ahí
porque es el que más se mueve para resolver el arco azul-violeta (§5) y a `L 0.765` el índigo
ya no da más croma. Si alguna vez se retoca, hay que volver a medir los dos pares que sostiene.

⚠️ **`doc-honorarios` es `#ee7d00`, no `#fe8600`.** El segundo es más vivo y colisiona con
`suplementacion` (13.3° / 1.23, falla los dos ejes). No lo «mejores» subiéndolo.

---

## 5 Validación por pares

Misma regla que la agenda: **ninguna pareja puede empatar a la vez en tono y en claridad.** El
umbral, calibrado contra los ocho casos que `MODO_OSCURO_AGENDA.md` §3 y §4 dan por aceptados
y rechazados: **Δ tono ≥ 30° (HSL) O razón de luminancia ≥ 1.40.** Basta uno de los dos.

> ### ⚠️ LA «RAZÓN DE LUMINANCIA» DE ESTA SECCIÓN **NO** ES EL CONTRASTE DE WCAG
>
> Son dos fórmulas distintas y se parecen lo bastante como para confundirlas:
>
> | | Fórmula | Dónde se usa |
> |---|---|---|
> | Razón de luminancia | `Y_alta / Y_baja` | **sólo aquí, en §5**, para separar dos colores entre sí |
> | Contraste WCAG | `(Y_alta + 0.05) / (Y_baja + 0.05)` | en §2.1, §3.2 y §4, contra el fondo |
>
> El `+ 0.05` de WCAG modela el reflejo ambiental de la pantalla y **comprime los valores
> bajos**. En el peor par de la tabla de abajo —`receta` contra `consentimiento`— la razón de
> luminancia da **1.40** y el contraste WCAG **1.35**: quien mida con la fórmula equivocada
> creerá que ese par incumple, y lo «arreglará» moviendo un valor que estaba bien.
>
> El umbral 1.40 **sólo tiene sentido con la primera**. No lo compares nunca con un 3:1 ni con
> un 4.5:1, que son cifras de la segunda y de otro problema: aquellas miden si algo *se lee*
> sobre su fondo, ésta si dos cosas *se distinguen* entre sí.

Los nueve valores de §4: **cero pares fallan.** Los cinco más apretados:

| Par | Δ tono | Razón de luminancia | Resuelve por |
|---|---|---|---|
| `receta` vs `consentimiento` | 19.7° | **1.40** | claridad, **justo en el listón** |
| `laboratorio` vs `escrito` | 24.7° | 1.41 | claridad |
| `suplementacion` vs `honorarios` | 13.4° | 1.43 | claridad |
| `imagen` vs `consentimiento` | 23.9° | 1.47 | claridad |
| `receta` vs `escrito` | 25.9° | 1.61 | claridad |

**El peor par queda exactamente en 1.40, sin holgura** — comparable al peor par vivo de la
agenda (`grafito` vs `no asistió`, 3.4° / 1.42). Cualquier retoque de `receta` o de
`consentimiento` tiene que volver a medir este par antes que nada.

**Por qué los cinco se resuelven por claridad y no por tono.** Tres de los ocho
formatos viven en el arco azul→violeta (`receta` blue, `consentimiento` indigo, `imagen`
violet) y dos en el arco verde→cian (`laboratorio`, `escrito`). En oscuro esos arcos se
comprimen y no hay tono que ganar: la única palanca es la claridad. Es el mismo problema que
el modo claro resolvió mandando `consentimiento` a indigo-**800** (muy oscuro) para separarlo
de violet-600; aquí se hace lo simétrico, mandándolo arriba.

⚠️ **Se probó dejar los nueve en el nivel 400 y no vale:** tres pares fallan
(`laboratorio`/`escrito` 26.4° / 1.08 · `receta`/`consentimiento` 23.4° / 1.22 ·
`imagen`/`consentimiento` 21.2° / 1.11). Y **no basta mover sólo `consentimiento`**: para
separarse de los otros dos necesitaría subir a ≥8.53:1, y a esa claridad el índigo cae por
debajo del suelo de croma; o bajar a ≤4.41:1, y ahí cae por debajo del listón de contraste.
Hay que mover los tres. No lo re-descubras.

**Nota sobre la paleta clara.** No se valida con esta regla y no pasa: `receta` vs `escrito`
mide 29.9° / 1.13 en claro. No es un defecto que arreglar — la paleta clara se validó por
separación en deuteranopia y en L\*, que es otro criterio, y está en producción. Se anota para
que nadie aplique esta regla hacia atrás.

**Fuera del conjunto de pares: el color del médico.** Un `--sp-doc-*` puede coincidir con
`--sp-primary` sin que se confundan; lo dice ya el comentario de la familia en
`spinus-tokens.css:96`. La distinción la dan el icono y la etiqueta, no el color.

---

## 6 Qué queda fuera

**No se tematiza, a propósito:**

- **`--sp-alergia-bg` / `--sp-alergia-ink`.** `SPEC_EXPEDIENTE_PACIENTE.md` §5 la nombra «la
  única pieza que no baja de intensidad, porque su función es alarmar». Blanco sobre
  `#c0392b` mide **5.44:1** en los dos temas; con `--sp-danger` (`#f87171` en oscuro) caería
  a **2.77:1**. La conclusión no cambia, pero los dos números que hoy están escritos en
  `spinus-tokens.css:79-88` —5.9:1 y 2.6:1— **no son los que salen al medir**. Corregirlos
  cuando se toque ese bloque.
- **`--sp-on-primary` (`#ffffff`).** Es la referencia contra la que se calibra el relleno en
  §3.2. Moverlo invalida esa tabla entera.
- **`--lp-*`.** Su razón de existir es ser inmunes a `html.dark`. No se tocan.
- **`/super-admin`.** Oscuro fijo por diseño (`bg-slate-950`), fuera del sistema de temas.

**Ya resuelto, no se re-deriva:**

- **El cromo de marca** — menú lateral, franja del sistema, banda móvil de la agenda y
  `themeColor`. Aquí decía que era idéntico en los dos temas y que su 1.43:1 contra `#121212`
  «se decide aparte»; **se decidió y está hecho**. `--ag-navy` se aclara en oscuro con
  `oklch(from var(--cp) 0.42 c h)` y las cuatro superficies salen del mismo token, así que no
  pueden divergir. Separación medida: 2.22:1 contra la página y 1.97:1 contra la card, en las
  seis paletas. La tinta del menú subió con él (`--ag-navy-ink*`). No lo re-abras.

- **Todos los `--ag-*`.** 82 contrapartes medidas y en producción.
- **`--sp-avatar-*`.** Diez pares opacos con ΔE2000 ≥ 23.2 y contraste 4.63–6.05:1 medidos.
  Son el ejemplo, no el problema.
- **`--sp-vital-*`.** Su espejo oscuro ya converge con la semántica genérica y usa los hexes
  vivos (`#34d399` / `#fcd34d` / `#f87171`).

**Lo que no cambia entre modos** — igual que `MODO_OSCURO_AGENDA.md` §7: formas, tamaños,
pesos, espaciados, radios, iconos y tipografía son idénticos. **El modo oscuro es una
sustitución de color, nunca un rediseño.**

---

## 7 Dependencia técnica y cómo se midió

Las fórmulas de §3 usan **sintaxis de color relativa** (`oklch(from …)`). **Confirmado y en
producción** — aquí decía «confirmar antes de implementar» y ya se hizo:

- Soporte completo desde **Chrome/Edge 131 · Safari 18.0 · Firefox 133**. Los tramos que
  caniuse marca «parcial» (Chrome 119-130, Safari 16.4-17.6) lo son por **unidades dentro de
  `calc()` sobre canales**; ninguna fórmula de este documento hace aritmética sobre canales,
  así que no les afecta.
- **La brecha real es Chrome/Edge 111-118**, y sólo ésa: por debajo de Chrome 111, Safari 16.4
  o Firefox 128 la app ya no funciona de todos modos, porque ése es el suelo de Tailwind 4.
  Esa ventana pesa muy por debajo del 1 % y no aparece desglosada en StatCounter.
- **Todas las fórmulas van dentro de un `@supports`**, con el valor anterior como respaldo
  fuera del bloque. Un navegador sin soporte ve exactamente lo que la app pintaba antes.
  ⚠️ El `@supports` no es opcional ni sustituible por declarar respaldo y fórmula seguidos:
  estos tokens son custom properties, así que un navegador sin soporte **no descarta** la
  declaración —la guarda— y el fallo salta al sustituir, dejando la propiedad que la consume
  inválida en tiempo de valor calculado. Eso computa a `unset`: la tinta heredaría y el
  relleno saldría transparente. Y una sustitución inválida **no vuelve** a la declaración
  anterior de la cascada.

Contraste: WCAG 2.x sobre luminancia relativa, contra `#1E1E1E`. Croma y claridad: OKLCH.
Δ tono y razón de luminancia de §5: HSL y luminancia relativa — las mismas dos métricas de
`MODO_OSCURO_AGENDA.md`, verificadas reproduciendo sus ocho números publicados (34.9/1.90 ·
31.4/1.51 · 23.7/1.33 · 33.1/1.16 · 15.0/1.33 · 13.3/1.86 · 30.0/1.36 · 3.4/1.42) con
coincidencia exacta.
