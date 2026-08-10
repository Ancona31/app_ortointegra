# 04 · Selector de tipo de documento

Spec de implementación. **Sustituye a §3.D de la propuesta** (barra 3×3), que decae entera.
Común a los 8 formatos.

---

## 0 · Cambio de estructura del que parte este spec

El modal flotante de la pantalla de nota guardada se elimina: el formulario se despliega en
la propia pantalla, debajo de «Concluir consulta».

- **Tres montajes pasan a dos**, los dos a anchura completa.
- El peor caso de la auditoría —panel de 720 × 605— **deja de existir**. El peor caso
  vuelve a ser el móvil a 390.
- Decaen: la barra 3×3 y su colapso, la cabecera `sticky` del panel de plantillas
  (§3 del spec 02), y los hallazgos G-08, G-09 y E-03.
- Se conservan: los ocho colores de tipo, el panel de plantillas en sitio (con razón nueva)
  y la barra de acciones `sticky`.

| Montaje | Cromo encima del selector |
|---|---|
| 1 · Pantalla de nota guardada | Card de nota guardada + botón «Concluir consulta» |
| 2 · Ruta standalone | Cabecera «Documentos» + paciente |

---

## 1 · Rejilla de tarjetas

```css
.sp-doc-typecards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2-5);                 /* 10px */
}
@container docform (min-width: 600px) {
  .sp-doc-typecards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-gap-tiles);         /* 12px */
  }
}
```

Un solo umbral: **4 columnas desde 600 px de contenedor, 2 por debajo.** Ocho se divide en
4 y en 2, así que ninguna fila queda a medias en ningún ancho.

| Contenedor | Columnas | Ancho de tarjeta | Alto de la rejilla |
|---|---|---|---|
| 358 | 2 | 174 | 4 filas × 92 + 3 × 10 = **398** |
| 788 | 4 | 188 | 2 filas × 104 + 12 = **220** |
| 860 | 4 | 206 | **220** |
| 896 | 4 | 215 | **220** |

---

## 2 · Tarjeta

```css
.sp-doc-typecard {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--sp-2-5);                 /* 10px */
  min-height: 104px;                  /* 92px en 2 columnas */
  padding: 18px 12px;                 /* 14px 10px en 2 columnas */
  border-radius: var(--sp-r-card);    /* 16px */
  text-align: center;
  transition: background var(--sp-dur-micro) var(--sp-ease-out),
              border-color var(--sp-dur-micro) var(--sp-ease-out);
}
```

| Parte | ≥600 | <600 |
|---|---|---|
| Icono | 24 px | 22 px |
| Etiqueta | `--sp-fs-body-sm` 14 px / `--sp-fw-semi` / `line-height: 1.25`, máx. 2 líneas | 13 px |
| Área táctil menor | — | 174 × 92, muy por encima de `--sp-tap` |

### 2.1 · Estados

| Estado | Fondo | Borde | Etiqueta |
|---|---|---|---|
| Reposo | `--sp-surface` | 1 px `--sp-line-card` + `--sp-shadow-flat` | `--sp-ink-700` / 600 |
| Hover | `color-mix(in srgb, var(--doc-color) 6%, #fff)` | 1 px `color-mix(… 30%, #fff)` | `--sp-ink-800` / 600 |
| Seleccionada | `color-mix(… 12%, #fff)` | **1.5 px** `--doc-color` | `color-mix(in srgb, var(--doc-color) 40%, var(--sp-ink-700))` / **700** |
| Foco de teclado | el que tenga | el que tenga | + `box-shadow: 0 0 0 4px color-mix(… 18%, transparent)` |

El icono lleva el color del tipo **al 100 % en los cuatro estados**. La selección se
comunica con peso, fondo y filete, no con la aparición del color.

**Ninguna superficie del tipo es relleno sólido** — máximo un lavado al 12 % con filete de
1.5 px. El acento del médico sí se pinta en sólido (primario, chip activo, badge). Es lo
que impide confundir una tarjeta con un control de la app aunque los dos hex coincidan.

---

## 3 · Los ocho tipos

Orden fijo, leído en filas. Posición constante en todos los anchos.

| # | `tipo_documento` | Etiqueta (completa en los cuatro anchos) | Icono lucide | Token | Valor | Sobre `--sp-surface` | `html.dark` |
|---|---|---|---|---|---|---|---|
| 1 | `receta` | Receta | `Pill` | `--sp-doc-receta` | `#1d4ed8` (blue-700) | 7,0:1 | `#99afed` |
| 2 | `laboratorio` | Laboratorio | `FlaskConical` | `--sp-doc-laboratorio` | `#047857` (emerald-700) | 5,3:1 | `#8ec2b3` |
| 3 | `imagen` | Imagen | `ScanLine` | `--sp-doc-imagen` | `#7c3aed` (violet-**600**) | 6,4:1 | `#c4a6f7` |
| 4 | `suplementacion` | Suplementación | `ClipboardList` | `--sp-doc-suplementacion` | `#92400e` (amber-**800**) | 7,4:1 | `#cea993` |
| 5 | `internamiento` | Internamiento | `BedDouble` | `--sp-doc-internamiento` | `#be123c` (rose-700) | 6,4:1 | `#e294a7` |
| 6 | `escrito` | Escrito médico | `PenLine` | `--sp-doc-escrito` | `#155e75` (**cyan-800**) | 6,6:1 | `#96b7c1` |
| 7 | `consentimiento` | Consentimiento | `ShieldCheck` | `--sp-doc-consentimiento` | `#3730a3` (indigo-**800**) | 9,5:1 | `#a5a2d6` |
| 8 | `honorarios` | Honorarios / Cotización | `Receipt` | `--sp-doc-honorarios` | `#c2410c` (orange-700) | 5,4:1 | `#e4aa92` |

Los ocho se declaran como tokens en `:root`, nunca como literales en el componente.
Valor en oscuro: `color-mix(in srgb, var(--sp-doc-X) 45%, #fff)` — el mismo 45 % que el
sistema usa para `--sp-primary-text`.

### 3.1 · Los tres ajustes sobre las clases de Tailwind actuales

| Tipo | Antes | Ahora | Por qué |
|---|---|---|---|
| Escrito médico | teal-700 `#0f766e` | cyan-800 `#155e75` | Con emerald simulaba el mismo color en deuteranopia y con la misma claridad (L\* 43 vs 44): era el mismo tile dos veces. El cian se separa por el canal azul, que el deuteranope conserva |
| Imagen | violet-700 | violet-600 | Violeta e índigo colapsan a azul con 1 punto de L\* entre ellos |
| Consentimiento | indigo-700 | indigo-800 | Separados en direcciones opuestas quedan a 13 puntos de L\* |
| Suplementación | amber-700 `#b45309` | amber-800 `#92400e` | amber-700 **es exactamente `--sp-warn`**: dos significados con el mismo hex en pantallas donde conviven la barra y un banner de faltantes |

**El acento del médico es un selector libre, no un catálogo.** Puede coincidir con
`--sp-doc-receta` y se acepta: la distinción entre tipos la garantizan icono y etiqueta, no
el color. Misma regla que hace que el impreso sobreviva a una fotocopia.

---

## 4 · Línea plegada

Con tipo elegido, las ocho tarjetas se pliegan a una línea. Sin tipo elegido no existe.

```css
.sp-doc-typecollapsed {
  display: flex; align-items: center; gap: var(--sp-3);
  width: 100%;
  min-height: 52px;
  padding: 0 14px;
  border-radius: var(--sp-r-card);    /* 16px */
}
```

| Parte | Valor |
|---|---|
| Fondo / borde / texto | Los del estado seleccionado: 12 % / 1.5 px `--doc-color` / mezcla al 40 % |
| Icono | 22 px, color del tipo |
| Eyebrow | `DOCUMENTO` — `--sp-fs-legal` 11 px / `--sp-fw-bold` / `--sp-ls-label-w` / `--sp-ink-350` / mayúsculas |
| Nombre | `--sp-fs-body` 14.5 / `--sp-fw-bold`, ellipsis |
| Derecha | `Cambiar` `--sp-fs-meta` 13.5 / `--sp-fw-semi` / `--sp-ink-500` + `ChevronDown` 18 px `--sp-ink-icon` |
| a11y | La línea entera es el `<button>`, `aria-expanded="false"` |
| Animación | 240 ms (`--sp-dur-base`, `--sp-ease-inout`) **solo cuando pliega/despliega el médico** |

Ahorro: **398 → 52 px = 346 px devueltos** en móvil; 220 → 52 = 168 px en el resto.

### 4.1 · Presupuesto móvil (criterio de aceptación)

Pantalla de 358 × 700 (iPhone a 390 menos cromo del navegador), montaje 1:

| Con las ocho | Con la línea |
|---|---|
| Card de nota guardada 151 + 18 + tarjetas 398 + 18 = **585 px consumidos**; el primer campo del formulario queda fuera de pantalla | 151 + 18 + 52 + 18 = **239 px**; entran la card de plantilla entera y los dos primeros campos |

---

## 5 · Pliegue automático, sin salto

**Disparo:** listener `focusin` en el contenedor del formulario. Cubre el toque, el
tabulador y el foco que da el navegador al aparecer el teclado. Solo actúa si las tarjetas
están abiertas.

**Compensación:**

1. Medir `h1 = rejilla.offsetHeight`.
2. Plegar.
3. En el **mismo fotograma** (`useLayoutEffect`, nunca `useEffect`): `scrollTop -= (h1 - h2)`.

`useEffect` deja pintar el estado intermedio y el salto se ve.

**Sin animación cuando es automático.** Animar 346 px de alto arrastra el campo bajo el
dedo durante 240 ms, que es justo lo que se evita.

**Dónde no se puede compensar del todo:** si `scrollTop < delta`, el contenido sube lo que
falte (máximo `delta − scrollTop`). Ocurre solo cuando las tarjetas estaban a la vista, así
que el médico ve desaparecer lo que desaparece. Es el único caso y es el aceptable.

**Verificación:** con `scrollTop = 400` y las ocho abiertas, el input «Paciente» está a
531 px del borde superior. Tras plegar y compensar (`scrollTop = 54`), sigue a 531 px.

---

## 6 · Reapertura y cambio de tipo

| Caso | Comportamiento |
|---|---|
| Abrir | Las ocho aparecen encima del formulario, en las mismas posiciones, con la activa marcada. **Abrir no toca el formulario**: sigue montado con todo lo escrito |
| Volver a plegar | Pulsar la tarjeta activa, o `Escape` |
| Elegir el mismo tipo | Pliega, nada más |
| Elegir otro tipo, formulario vacío | Se cambia **sin preguntar** |
| Elegir otro tipo, con datos | **Confirmación previa**, no Deshacer |
| Tras imprimir | La línea se queda plegada; desplegarlas solas devolvería los 398 px que se acaban de quitar |

### 6.1 · Diálogo de cambio de tipo

`ModalShell`, `--sp-modal-w-decide` 620 px. Umbral: `esFormularioVacio()`.

| Parte | Contenido |
|---|---|
| Título | `¿Cambiar a {Tipo}?` |
| Cuerpo | `.sp-banner--danger`: `Se descarta la {documento} que estás llenando: {recuento}. No se puede deshacer.` |
| Botones | `.sp-btn--ghost` `Cancelar` · `.sp-btn--primary` `Cambiar a {Tipo}` |

Ejemplo de recuento: `3 estudios y las indicaciones`.
**Por qué previa y no Deshacer:** aplicar plantilla sustituye contenido dentro del mismo
formulario y el error se ve al instante; cambiar de tipo hace desaparecer el formulario
entero, y un aviso posterior es una franja pequeña que se pierde, sobre todo en móvil.

### 6.2 · Diálogo de concluir consulta

Mismo shell y mismo umbral. **Avisa, no bloquea.**

| Parte | Contenido |
|---|---|
| Título | `¿Concluir la consulta?` |
| Cuerpo | `.sp-body`: `Tienes una {documento} empezada y sin imprimir. Si concluyes ahora, no se emite. Puedes concluir de todos modos: no todo lo que se empieza se entrega.` |
| Botones | `.sp-btn--ghost` `Seguir llenando` · `.sp-btn--primary` `Concluir de todos modos` |

Nombra el documento pendiente, nunca «tienes cambios sin guardar».

---

## 7 · Accesibilidad

- Contenedor `role="tablist"` con `aria-label="Tipo de documento"`.
- Cada tarjeta `role="tab"` con `aria-selected` y `aria-controls` al formulario, que es
  `role="tabpanel"` con `tabindex="-1"`.
- Flechas: **← → dentro de la fila, ↑ ↓ entre filas**; `Home` / `End` al primero / último.
  Es una rejilla: las cuatro flechas deben funcionar.
- Al elegir tipo, el foco pasa al **primer campo editable vacío** del formulario desplegado
  (G-10). Hoy se queda en el icono de la barra.

---

## 8 · Decisiones, una línea cada una

- **Tarjetas y no chips** — ocho se reparte en 4 y en 2 sin dejar filas cojas; la fila de chips dejaba el noveno medio tapado.
- **Un solo umbral (600 px)** — dos disposiciones bastan; más umbrales es más superficie que mantener.
- **Etiquetas completas en móvil** — la tarjeta admite dos líneas, así que «Honorarios / Cotización» no se acorta.
- **Plegar en vez de vista lite** — un solo diseño, sirve igual en escritorio, y no hay que decidir a partir de qué ancho cambia la vista.
- **Pliegue automático al enfocar** — reabrir para mirar no debe obligar a cerrar a mano.
- **Compensación de scroll en el mismo fotograma** — sin ella, el campo recién tocado se va de debajo del dedo.
- **Color como identidad permanente** — si solo apareciera al seleccionar, cuando lo ves ya has llegado.

---

## 9 · NO DEFINIDO

| Ref | Qué falta |
|---|---|
| Montaje 1 | **El ancho real de la pantalla de nota guardada.** Los valores de §1 son los de la página de expediente (358 / 788 / 860 / 896). Si esa pantalla usa otro contenedor o otro máximo, cambia el ancho de tarjeta a 1440, no la disposición. |
| §3 | **Modo oscuro sin verificar.** Los ocho tienen su valor en `html.dark`, pero el fondo del estado seleccionado mezcla contra `#fff`: en oscuro debe mezclarse contra la superficie. Falta una pasada visual cuando el modo oscuro entre en alcance. |


---

## Anexo · Radio de control (cambio de sistema, 2026-08-09)

Aplica a los nueve formularios y a toda la app. **Los contenedores no bajan.**

| Token | Antes | Ahora | Rol |
|---|---|---|---|
| `--sp-r-input` | 14 | **12** | textarea grande |
| `--sp-r-cta` | 14 | **12** | primario a ancho completo |
| `--sp-r-btn` | 12 | **10** | botón |
| `--sp-r-field` | 12 | **10** | input, select, textarea, banner |
| `--sp-r-field-sm` | 11 | **9** | fila e input compactos |
| `--sp-r-btn-sm` | 10 | **8** | botón compacto e icono-botón |
| `--sp-r-card` | 16 | 16 | sin cambio |
| `--sp-r-modal` | 20 | 20 | sin cambio |
| `--sp-r-pill` | 999 | 999 | es una forma, no un radio |

- Un escalón por token: la jerarquía de la escala no se altera.
- La diferencia entre la curva del contenedor y la del control pasa de 4 px a 6 px; es lo que se lee como más limpio.
- Por debajo de 10 px el control entra en el terreno de `--sp-r-note` (8 px), que es para texto embebido.
- **Revisar tras el cambio** los tres sitios donde el radio convive con un borde de 1,5 px: input en foco, tarjeta de tipo seleccionada y card protagonista.
