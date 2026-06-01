# Handoff: Rediseño de Agenda / Calendario clínico

## Resumen
Rediseño de la vista **Agenda** (gestión de citas clínicas) de la app médica
de expediente electrónico. Sustituye el calendario actual (FullCalendar) por
una interfaz propia, más legible y pulida, con:

- Vistas **Mes · Semana · Día · Recurso** (Recurso = una columna por médico).
- Tarjetas de cita ricas: paciente (avatar + nombre), médico, tipo de consulta,
  hora/duración y **estado** codificado por color.
- Diferenciación visual entre **citas de la clínica** (datos completos, editables)
  y **eventos sincronizados de Google Calendar** (solo título, bloqueados, solo lectura).
- **Arrastrar para reagendar** (snap a 15 min), **crear cita** al hacer clic en un hueco,
  **panel de detalle** y **modal Nueva/Editar cita**.
- **Modo claro y oscuro**.
- **Cromática heredada del usuario** (ver sección destacada más abajo).

## Sobre los archivos de este paquete
Los archivos incluidos son **referencias de diseño hechas en HTML/React (vía Babel
en el navegador)** — un prototipo que muestra el aspecto y comportamiento deseados,
**no código de producción para copiar tal cual**. La tarea es **recrear estos diseños
dentro del entorno del codebase real** (React, Vue, etc.) usando sus patrones,
componentes y librería de estilos ya establecidos. Si la app ya usa FullCalendar,
gran parte de esto puede lograrse con render personalizado de eventos + CSS de tema;
si se reemplaza, replicar la cuadrícula descrita aquí.

El prototipo es **alta fidelidad (hi-fi)**: colores, tipografía, espaciados e
interacciones son los finales. Recréalo con fidelidad usando las librerías del codebase.

## ▶ Cómo abrir el prototipo
Abrir `Agenda - Prototipo.html` en un navegador (no requiere servidor; usa CDNs).
- Cambiar **modo claro/oscuro**: botón inferior del sidebar ("Modo oscuro/claro").
- Cambiar de vista: Mes / Semana / Día / Recurso (arriba a la derecha).
- Clic en una cita → panel de detalle. Clic en un hueco → modal de creación.
- Arrastrar una cita verticalmente → reagenda; entre columnas → cambia día (Semana)
  o médico (Recurso).
- Para previsualizar **otra paleta de marca**, en consola: `window.BRAND =
  {primary:'#5c1a22', secondary:'#c0394a'}` y vuelve a renderizar (o cambia el
  default en `Agenda - Prototipo.html`).

---

## ⭐ CRÍTICO — Cromática heredada del usuario (no hardcodear)
La app **no tiene un azul fijo**. Cada usuario elige en **Mi perfil › Apariencia**
dos colores arbitrarios (cualquier hex del espectro): **color primario** y
**color secundario**. Todo el "cromo" de la Agenda debe **derivarse de esas dos
variables**. **No** debe haber selector de paleta dentro de la Agenda — solo
consume los colores heredados.

**Variables fuente** (provistas por el perfil; en el prototipo: `window.BRAND`):
- `--brand-primary`  (ej. `#1a3a5c`) — color oscuro/base.
- `--brand-secondary` (ej. `#1e5fa8`) — color de acento/brillante.

**Todo lo demás se calcula** a partir de ellas mezclando con negro/blanco/el otro
color. La función de mezcla (ver `theme.js`):
```js
mix(a, b, t)  // interpola el hex a→b en t∈[0,1]
```

**Derivados que usa el diseño** (de `theme.js → window.brand()`):
| Token            | Fórmula                                   | Uso |
|------------------|-------------------------------------------|-----|
| `btn` (gradiente)| `linear(180deg, mix(p, s, .55) → p)`      | Botones primarios: "Nueva cita", "Guardar", "Crear", pill de duración activa |
| `sidebar`        | `linear(184deg, mix(p,#000,.45) → p → mix(s,p,.15))` | Fondo del sidebar |
| `todayHead`      | `linear(180deg, p → mix(p, s, .5))`       | Cabecera de la columna del día actual |
| `ring`           | claro: `mix(s,#fff,.55)` / oscuro: `mix(s,#0f1828,.58)` | Borde interno de la columna "hoy" |
| `todayBg`        | claro: `mix(s,#fff,.93)` / oscuro: `mix(s,#0f1828,.88)` | Tinte de la columna "hoy" |
| `activeText`     | claro: `p` / oscuro: `mix(s,#fff,.58)`    | Texto del botón de vista activo |
| `solid`          | `p`                                       | Botón "Hoy", ítem de nav activo (texto) |

> En un codebase con CSS variables, expón `--brand-primary` y `--brand-secondary`
> y calcula los derivados con `color-mix()` de CSS (p. ej.
> `color-mix(in srgb, var(--brand-primary) 45%, black)`), o precalcula en JS al
> cargar el tema. El prototipo usa JS (`mix`) por simplicidad.

**Independientes de la marca (NO derivar de primary/secondary):**
- **Colores por médico** (cada médico tiene su color identitario; ver Doctores).
- **Colores de estado** (semánticos: confirmada=verde, cancelada=rojo, etc.).
- **Morado de Google Calendar** (identidad de Google).

Estos tres deben distinguirse SIEMPRE, sin importar la paleta de marca elegida.
(Nota: si la marca queda muy parecida a un color de médico, sigue siendo legible
porque conviven en zonas distintas; opcionalmente se podría auto-desplazar el tono
de médico para garantizar contraste, pero no es requerido.)

---

## Modo claro / oscuro
Toggle controlado por `window.__dark` (bool). En el prototipo persiste en
`localStorage('ag-dark')`. Todas las superficies tienen token claro y oscuro
(ver `theme.js → light` / `dark`). El modo oscuro **no es negro puro**: usa un
azul-pizarra profundo (`#0f1828` fondo, `#1b2a40` tarjetas).

---

## Layout general
```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │  PageHeader (título "Agenda" + leyenda médicos) │
│ 264px    ├───────────────────────────────────────────────┤
│ (gradient│  Toolbar (nav fecha · vistas · "Nueva cita")    │
│  marca)  │  + chips de filtro por médico                   │
│          ├───────────────────────────────────────────────┤
│          │  ColHeaders (días o médicos)                    │
│          │  TimeGrid (gutter de horas + columnas)          │
└──────────┴───────────────────────────────────────────────┘
```
- App: `display:flex; height:100vh`. Sidebar ancho fijo 264px; `main` flex:1,
  scroll vertical en el área de contenido.
- `main` padding horizontal de **30px** en header, toolbar y grid.

---

## Pantallas / Vistas

### Sidebar (común)
- Ancho 264px, fondo = `window.brand().sidebar`, `border-radius: 0 22px 22px 0`.
- Logo del consultorio (placeholder = ícono de columna en círculo de 78px; en
  producción usar el logo subido por el usuario), nombre y especialidad centrados.
- Nav: Dashboard, Pacientes (›), **Agenda (activo)**, Calculadoras, Documentos (›),
  Administración (›); separador; Mi perfil, Ayuda, Modo Offline (punto verde).
  Pie: **Modo oscuro/claro** (toggle), Cerrar sesión.
- Ítem activo: pastilla blanca, texto = `brand.primary`, sombra suave.
- Ítem inactivo: texto `rgba(233,240,250,.82)`, ícono 19px.

### Toolbar (común a Mes/Semana/Día/Recurso)
- Izquierda: botones ‹ › (38×38, borde `T.iconBtnBorder`), botón **Hoy**
  (fondo `brand.primary`, texto blanco), y la **etiqueta de rango/fecha** (18px/800).
- Derecha: segmented control de vistas (fondo `T.segBg`, activo `T.segActive` con
  texto `brand.activeText`), y botón **"+ Nueva cita"** (fondo `brand.btn`, blanco).
- Fila inferior: **chips de filtro por médico** (toggle on/off; on = borde+tinte del
  color del médico; off = atenuado .5) + texto de ayuda.

### Vista Semana
- `ColHeaders`: 7 columnas (Lun–Dom) + gutter de 64px a la izquierda.
  Cada cabecera: día (11px/700 mayúsculas) + fecha (18px/800). La de **hoy** lleva
  fondo `brand.todayHead` y texto blanco; fin de semana atenuado.
- `TimeGrid`: gutter con horas 07:00–20:00 (alto de hora = **58px**), 7 columnas
  con `gap:7px`. Líneas de hora = `T.line`. Columnas de fin de semana con trama
  diagonal sutil (`T.weekendHatch`). Columna "hoy" con `brand.todayBg` + ring
  `brand.ring`. **Línea de "ahora"** roja (`T.now`) con punto, a la hora actual.

### Vista Día
- Una sola columna a ancho completo (día seleccionado), mismas filas de hora.
- ‹ › navegan entre días (clamp Lun–Dom).

### Vista Recurso (por médico)
- Una columna por médico activo. Cabecera de columna: avatar + nombre + especialidad,
  fondo = tinte del médico (`docTok(doc).soft`), subrayado de 3px del color del médico.
- Al arrastrar una cita a otra columna → **reasigna el médico**.

### Vista Mes
- Rejilla 7×N (Lun–Dom). Celdas de `min-height:116px`. Día de hoy con círculo
  `brand.primary`. Cada celda lista hasta 3 citas (punto del color de médico/Google +
  hora + nombre) y "+N más". Clic en un día → abre Vista Día de ese día.

---

## Tarjeta de cita (EventCard, variante "clean")
Posición absoluta dentro de su columna: `top = (inicioMin − 07:00)/60 × 58px`,
`height = duración/60 × 58px` (mínimo 24px). Solapes se reparten en sub-columnas.

**Cita de clínica (`source:'clinic'`):**
- Fondo `T.card`, borde `1px T.cardBorder`, **borde izquierdo 3.5px = color del médico**,
  `border-radius:9px`, sombra `T.cardShadow`.
- Contenido según altura disponible:
  - **>56px**: fila hora (`HH:MM – HH:MM`, 10.5px, `T.muted`) + chip iniciales del
    médico (ej. "AN", fondo `docTok.soft`, texto `docTok.color`); nombre paciente
    (12px/700 `T.ink`); fila estado (punto `status.dot` + etiqueta corta `status.text`
    + "· tipo" `T.muted2`).
  - **38–56px**: hora compacta + nombre.
  - **<38px**: punto de estado + nombre.
- Cancelada: opacidad .62 + nombre tachado.

**Evento Google Calendar (`source:'gcal'`):**
- Fondo con trama diagonal en `external.bg`, borde **punteado** `external.border`,
  borde izq. 3px `external.dot` (morado). Muestra logo Google + 🔒 + hora + título.
- **No arrastrable** (solo lectura). Clic → panel de detalle en modo "externo".

---

## Panel de detalle (clic en una cita)
- Panel lateral derecho fijo, 360px, `background:T.panelBg`, entra deslizando.
- Banda superior con color del estado (o morado si es de Google): badge de estado,
  avatar grande (46px), nombre y tipo.
- Filas: Horario (`HH:MM – HH:MM · N min`), Médico, Tipo de consulta, Teléfono.
  (Google: muestra "Sincronizado desde Google Calendar · solo lectura".)
- Pie: "Expediente" + "Editar cita" (primario `brand.btn`). Google: "Abrir en Google".

## Modal Nueva / Editar cita
- Centrado, 480px, `background:T.panelBg`, `border-radius:22px`.
- Campos (en este orden):
  1. **Paciente** (req.): si vacío, input de búsqueda; si seleccionado, chip con
     avatar + nombre editable + teléfono.
  2. **Fecha y hora de inicio**: fecha (display) + `input[type=time]` step 900.
  3. **Duración**: pills 15/30/45/60/90/120 min (activa = `brand.primary`).
     Muestra "Termina a las HH:MM" calculado.
  4. **Estado**: rejilla 3×2 con los 6 estados (ver abajo), seleccionable.
  5. **Médico** (req.) y **Tipo de consulta**: selects.
  6. **Notas**: textarea.
- Pie: **Eliminar** (rojo, solo en edición) · **Cancelar** · **Crear cita / Guardar
  cambios** (primario `brand.btn`).

---

## Modelo de datos (ver `calendar-data.js`)

**Cita (appt):**
```
{ id, source: 'clinic' | 'gcal',
  day,            // índice 0..6 dentro de la semana (en prod: fecha/datetime real)
  start: 'HH:MM', dur: <minutos>,
  // si source === 'clinic':
  patient: '<nombre>', doctor: '<doctorId>', type: '<typeId>',
  status: '<statusId>', phone: '<tel>',
  // si source === 'gcal':
  title: '<título del evento>', phone? }
```

**Doctores** — color identitario propio (independiente de la marca):
| id | nombre | código | color | specialty |
|----|--------|--------|-------|-----------|
| ancona | Dr. Ángel M. Ancona Pérez | AN | `#2f6fed` (azul) | Cirugía de Columna |
| mendez | Dra. Sofía Méndez | SM | `#13a06a` (verde) | Traumatología |
(Estos son datos de demo. En oscuro se usan tonos más brillantes: ver `docDark` en `theme.js`.)

**Estados (status)** — semánticos. Cada uno tiene `dot`, `text`, `bg`, `border` en
claro (en `calendar-data.js`) y oscuro (en `theme.js → statusDark`):
| id | etiqueta | punto (claro) |
|----|----------|----------------|
| agendada | Agendada | `#2f6fed` |
| confirmada | Confirmada | `#16a34a` |
| en_espera | En sala de espera | `#ea8c0b` (pulsa) |
| atendida | Atendida | `#0d9488` |
| no_asistio | No asistió | `#64748b` |
| cancelada | Cancelada | `#dc2626` (tachado) |
> Los estados originales del modal eran Agendada/Confirmada/Cancelada/No asistió;
> se añadieron **En sala de espera** y **Atendida** para el flujo clínico completo.
> Confirmar con el equipo si se adoptan los seis.

**Tipos de consulta (ortopedia/columna):** primera, seguimiento, postquirúrgico,
control, infiltración, urgencia (cada uno con su ícono).

**Evento externo (Google):** `external` = `{ text:#6d4ec0, bg:#f3eefc, border:#ddd0f5,
dot:#7c5cdb }` (claro) y `extDark` (oscuro).

---

## Interacciones y comportamiento

- **Arrastrar para reagendar** (`TimeGrid`): pointer events. `pointerdown` en una
  cita inicia drag; `pointermove` calcula nuevo inicio = `origen + round(Δy/58 ×
  60/15) × 15` (snap 15 min), clamp dentro de 07:00–20:00; detecta columna bajo el
  cursor por bounding rects. Tooltip flotante muestra `inicio – fin (· columna)`.
  `pointerup`: si no hubo movimiento → abre detalle; si hubo → reagenda. Eventos de
  Google no arrastrables. Threshold de "movimiento": >4px.
- **Crear cita rápida**: clic en zona vacía de una columna calcula la hora por la Y
  (snap 15) y abre el modal con día/médico/hora precargados.
- **Filtros por médico**: ocultan/muestran sus citas (los de Google siempre visibles).
- **Editar/Eliminar/Crear**: mutan el arreglo de citas en estado.
- **Toast** de confirmación abajo-centro (2.2s) tras reagendar/guardar/eliminar/crear.
- **Animaciones**: panel/modal entran con `calPanelIn` (translate+fade .22s
  cubic-bezier(.2,.7,.3,1)); estado "en espera" pulsa (`calPulse`); transición de
  `top` .12s al soltar el drag.

## Manejo de estado (en el prototipo)
- `appts[]` (mutable), `view`, `selDay` (0..6), `activeDocs[]`, `detail` (cita o null),
  `draft` (cita en edición/creación o null), `toast`, `dark`.
- `window.BRAND` y `window.__dark` se leen en cada render para tematizar.

---

## Design tokens

**Tipografía:** `Plus Jakarta Sans` (400/500/600/700/800). Tamaños clave: H1 30/800,
etiqueta de fecha 18/800, cabecera de día 18/800, nombre de cita 12/700, hora 10.5/600,
etiquetas de campo 11/700 mayúsculas.

**Radios:** tarjetas 9–13px, botones/inputs 11–12px, paneles/modal 18–22px, chips 999px.

**Espaciado:** padding de zonas 30px (horizontal), gutter de horas 64px, alto de hora
58px, gap entre columnas 7px.

**Sombras:** tarjeta `0 1px 2px rgba(16,32,64,.05)` (claro) / `0 1px 3px rgba(0,0,0,.45)`
(oscuro); modal `0 30px 80px rgba(0,0,0,.5)`; panel `-18px 0 50px rgba(0,0,0,.32)`.

**Superficies (claro → oscuro):** ver `theme.js` (`light`/`dark`). Resumen:
- Fondo app `#eef1f5 → #0c1420`; main `#fbfcfe → #0f1828`.
- Tarjeta `#fff → #1b2a40`; borde `#e7ecf3 → #2a3b57`.
- Texto principal `#15243e → #e8eef6`; atenuado `#7c8aa0 → #8b9bb0`.
- Línea "ahora" `#ef4444 → #f87171`.

**Marca (default Spinus):** primario `#1a3a5c`, secundario `#1e5fa8`.
**Presets de referencia** (cada uno = primario / secundario): Verde médico
`#0f3a2c`/`#12a070`; Morado `#3a1d5c`/`#7c3aed`; Rojo burdeos `#5c1a22`/`#c0394a`;
Café cálido `#4a2f1a`/`#b9712e`; Pizarra oscuro `#1b2430`/`#5b6b82`. (Solo referencia;
el usuario puede elegir cualquier par de colores.)

## Assets
- **Iconos**: set propio SVG con `stroke` (estilo Lucide), en `calendar-ui.jsx`
  (`<Icon name=... />`). Reemplazables por la librería de iconos del codebase.
- **Logo del consultorio**: placeholder (ícono de columna). Usar el logo real subido
  por el usuario en Apariencia.
- **Avatares de paciente**: iniciales sobre círculo de color (sin imágenes externas).
- **Marca Google**: SVG multicolor inline (`<GoogleMark />`).
- **Fuente**: Plus Jakarta Sans (Google Fonts).

## Archivos en este paquete
| Archivo | Contenido |
|---------|-----------|
| `Agenda - Prototipo.html` | App completa: shell + estado + vista Mes + ensamblado. **Abrir este.** |
| `theme.js` | Tokens de tema (claro/oscuro), sistema de marca (`window.brand()`, `mix()`), tokens de estado/médico/externo. **Clave para la cromática heredada.** |
| `calendar-data.js` | Modelo de datos: médicos, estados, tipos, citas de ejemplo, helpers. |
| `calendar-ui.jsx` | Átomos: `Icon`, `GoogleMark`, `Avatar`, `StatusBadge`. |
| `calendar-week.jsx` | `EventCard` (tarjeta de cita, variante "clean" usada aquí). |
| `agenda-shell.jsx` | `Sidebar`, `PageHeader`. |
| `agenda-views.jsx` | `AgendaToolbar`, `TimeGrid` (cuadrícula + drag), `ColHeaders`, `dayHeader`. |
| `agenda-modal.jsx` | `DetailPanelX` (panel de detalle), `ApptModal` (nueva/editar). |

> Nota técnica: el prototipo usa React 18 + Babel en el navegador y un patrón de
> `window.*` para compartir componentes/tokens entre archivos `<script>`. Esto es
> solo para el prototipo; en producción usar imports/módulos normales del codebase.
