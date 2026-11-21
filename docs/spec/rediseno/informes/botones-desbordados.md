# Botones que no caben — auditoría de las maquetas publicadas

Fecha: 21-nov-2026. Solo medición; no se tocó ninguna vista ni fuente.
Comprobador: `tools/chk-botones.js` (Playwright, Chromium, ventana 1500×900, `deviceScaleFactor 1`,
movimiento reducido, tema claro: el tema no cambia medidas). Recortes de cada hallazgo en
`informes/botones/` (el control va enmarcado con un trazo rosa discontinuo).

## Cobertura

| Página | Secciones | Botones de maqueta | Mediciones (estado × dispositivo) |
|---|---|---|---|
| pub-ag-cal | 6 | 82 | 415 |
| pub-ag-cita | 12 | 208 | 1045 |
| pub-ag-config | 17 | 157 | 790 |
| agenda-base | 7 | 30 | 155 |
| pub-capas | 8 | 66 | 335 |
| cromo | 7 | 47 | 240 |
| dashboard-final | 1 | 7 | 40 |
| pub-pacientes | 4 | 25 | 130 |
| pub-nota | 2 | 19 | 100 |
| pub-documentos | 9 | 157 | 790 |
| tanda4 | 6 | 15 | 80 |
| **Total** | **79** | **813** | **4120** |

«Botón de maqueta» = todo botón de la sección que está fuera del `.marco` (los «Maqueta: …» punteados y,
en las páginas que no usan ese prefijo, las tiras «Inicial / Con datos / Duplicado…»). Cada estado se mide
en los cinco dispositivos (ext, tel, ih, iv, esc) partiendo de una recarga limpia; cada hallazgo propio de
un estado se reconfirma en una recarga aislada pulsando solo ese botón.

Controles revisados dentro del marco visible: `button`, `[role=button|tab|menuitem*|radio|switch]`,
píldoras y etiquetas (clases `*-chip`, `*-pil`, `*-etq`, `*-tag`, `*-sello`) y celdas de segmentado.
Criterios: (a) `scrollWidth/scrollHeight` > caja + 1; (b) icono o texto (rects de `Range`) fuera del borde
interior > 1 px; (c) solape con un control hermano o primo, o contenido desbordado que invade al vecino;
(d) elipsis / line-clamp activos; (e) rótulo en ≥ 3 líneas, o en 2 dentro de un pie de modal/alerta;
(f) botón recortado por un contenedor sin desplazamiento. Aviso aparte (g): holgura lateral < 6 px.

## Resumen

- **462** hallazgos brutos (únicos por sección · dispositivo · control) en **92** grupos.
- Tras revisar los recortes: **6 grupos reales de «no cabe»**, **2 solapes menores de área táctil** y el
  resto descartado como diseño del calendario o como falso positivo (detalle en §5).
- El caso del dueño (**«Enviar invitación»**) aparece **solo en ext**, en los dos modales «Invitar por
  correo» (burbuja y formulario), en todos sus estados. Ningún otro dispositivo lo reproduce.
- El patrón dominante no es «texto largo», sino **anchos repartidos a partes iguales** (`flex: 1 1 0`)
  o **compartidos con un espaciador**, que dejan al control por debajo de su ancho natural sin que nada
  lo note.

## 1. Hallazgos reales, por página y por texto

| # | Página | Control (texto) | Dónde | Disp. | Estados | Fallo | Disponible → necesario | Recorte |
|---|---|---|---|---|---|---|---|---|
| 1 | pub-ag-cita | «Enviar invitación» | Modal «Invitar por correo»: sección *Preguntas y confirmaciones* (burbuja) y *Formulario de cita* | ext | «invitar: elegir», «otra dirección», «error al invitar»; «Invitar: elegir», «Invitar: otra dirección» | (b) icono 6 px fuera por la izquierda y texto 6 px por la derecha; (c) el avión se monta en «No invitar a nadie»; el texto se corta en el borde del modal | 134 px → 166 px (burbuja) / 176 px (formulario) | [ext-013](botones/pub-ag-cita-ext-013.png), [ext-016](botones/pub-ag-cita-ext-016.png) |
| 1b | pub-ag-cita | «No invitar a nadie» (vecino) | mismos modales | ext | mismos | (g) cabe, pero a **4 px** del borde (relleno 10–16 px): el siguiente en romperse | 134 px → 146 / 158 px de ancho natural | — |
| 2 | pub-ag-cita · pub-ag-cal · agenda-base | Título de fecha de la barra: «Jue, 19 de noviembre», «19 – 21 de noviembre», «16 – 22 de noviembre» | Barra superior de la agenda, en **las 12 secciones** de pub-ag-cita, 5 de pub-ag-cal y 5 de agenda-base | ext | inicial y prácticamente todos (68 estados) | (e) el título parte en 2 líneas y (b) el chevrón ⌄ queda 8 px fuera del botón; (c) invade 4 px el botón «Periodo siguiente» › | 100 px → 188–194 px en una línea | [cita-ext-001](botones/pub-ag-cita-ext-001.png), [base-ext-004](botones/agenda-base-ext-004.png), [cal-ext-002](botones/pub-ag-cal-ext-002.png) |
| 3 | pub-ag-config | Segmentado «Mes · **Semana** · Día» | Barra de la agenda de fondo en 7 secciones (Buscar, Campana, Opciones, Ir a una fecha, Horario, Entrar al asistente, Salir a medias) | ext, tel | inicial y todos (62 estados) | (b) «Semana» sobresale 13–15 px y (c) invade «Día» 11–13 px; (f) en tel «Día» queda cortado 12 px por el borde; en ext «Día» ni se ve | celda 44 px → 63–67 px; segmentado 81 px (ext) / 111 px (tel) → ≈ 165 px | [config-ext-001](botones/pub-ag-config-ext-001.png), [config-tel-016](botones/pub-ag-config-tel-016.png) |
| 4 | pub-ag-config | Fila de resultado «jue, 19 nov 2026, 14:00 · Paciente Prueba 26 · Agendada» | Buscar en la agenda → «cita por ligar («Prueba 2»)» | esc | 1 | (a)(b) la fila se comprime a 49 px; el subtítulo parte en 2 líneas y (c) se monta 3–4 px sobre la fila siguiente | alto 49 px → 53 px | [config-esc-022](botones/pub-ag-config-esc-022.png) |
| 5 | pub-ag-cita · cromo | «Es otra persona, crear de todos modos» | Alerta de duplicado: *Ligar paciente*, *Burbuja de alta* (cita); *Paleta de comandos* (cromo) | todos (cita); ext, tel, iv (cromo) | «paciente duplicado», «registro: paciente duplicado», «Duplicado» | (e) 2 líneas en el pie de la alerta, aunque ya está apilado a todo el ancho | 262–292 px → 311 px | [cita-ext-014](botones/pub-ag-cita-ext-014.png), [cromo-ext-001](botones/cromo-ext-001.png) |
| 6 | pub-pacientes | «Ordenado por **Fecha de ingreso**» ↓ | Lista de pacientes, línea de orden junto a «Filtros» | ext, iv | inicial y los 6 estados | (b) la flecha ↓ sale 13 px (ext) / 2 px (iv) hacia «Filtros» | 200 px → 213 px | [pac-ext-001](botones/pub-pacientes-ext-001.png) |
| 7 | pub-pacientes | «Usar solo la edad» ↔ etiqueta «36 años» | Nuevo paciente → «Con datos» | ext, tel | 1 | (c) el área táctil del enlace (44 px de alto) cubre 63×24 px de la etiqueta | — | [pac-ext-002](botones/pub-pacientes-ext-002.png) |
| 8 | pub-pacientes | «+1» ↔ «Acciones de Paciente Prueba N» (⋯) | Lista de pacientes, columna de médicos | iv | inicial, «médica invitada» | (c) las dos áreas táctiles se pisan 3 px | — | [pac-iv-007](botones/pub-pacientes-iv-007.png) |

## 2. Causa y propuesta por grupo

### 1 · «Enviar invitación» / «No invitar a nadie» (modal «Invitar por correo», ext)

**Causa.** Dos botones lado a lado con `flex: 1 1 0` (mitades iguales) en un pie de 310 px con 278 px
interiores: 134 px cada uno. «Enviar invitación» con avión necesita 166 px (burbuja, relleno 10) o 176 px
(formulario, relleno 16); el icono y el texto se salen 5–6 px por cada lado, y el avión se monta en el
botón vecino. «No invitar a nadie» cabe por 4 px. Juntos necesitan 146 + 166 + 10 = **322 px > 278**, así
que repartir por contenido tampoco basta. En tel, ih, iv y esc el modal es más ancho y no falla.

**Layout sin cambiar el texto:**
- Quitar el icono no basta (queda en 140 px, aún > 134).
- **Apilar en ext**: primario a todo el ancho arriba, «No invitar a nadie» debajo. Esto funciona y es
  el patrón que ya usa la alerta de duplicado.

**Texto compacto** (ancho natural medido en su contexto, burbuja / formulario):
- «Enviar invitación» → **«Invitar»** (92 / 102 px). Es la propuesta del dueño y cabe con 16 px de
  holgura incluso con el icono.
- «No invitar a nadie» → **«No invitar»** (90 / 102 px). Alternativas: «Ahora no» (86 / 98) y «Omitir» (64 / 76).

**Recomendado:** «No invitar» + «Invitar», lado a lado. Los dos caben en 134 px en todos los dispositivos
y el par es simétrico, así que se lee sin el título. Como red de seguridad, apilar en ext si algún día el
rótulo vuelve a pasar del máximo de la regla (§3).

### 2 · Título de fecha de la barra (ext, 22 secciones de 3 páginas)

**Causa.** La barra mide 296 px: ‹ + título + › + campana + «⋯». Las cuatro cajas de 44 px más los huecos
dejan **100 px** al título, y el título natural mide 188–194 px (17 px de cuerpo). El texto parte en dos
líneas, pero el chevrón ⌄ es una pieza aparte a la derecha y no se reparte: queda 8 px fuera y toca el ›.

**Layout sin cambiar el texto:** meter el chevrón *dentro* del texto, como glifo al final de la última
palabra, para que baje de línea con ella. Las dos líneas quedan dentro de la caja de 100 px. Otra salida
es mover la campana al menú «⋯» en ext, con lo que el título gana 48 px; así sigue sin caber en una línea,
pero el chevrón deja de salirse.

**Texto compacto para ext:**
- Día: «Jue, 19 de noviembre» → **«19 nov»** (76 px) o «Jue 19» (75 px). «Jue 19 nov» mide 109 px y
  no cabe.
- Rangos: «16 – 22 de noviembre» → «16–22 nov», que mide 105 px a 17 px de cuerpo y ≈ 93 px a 15 px.

**Recomendado:** el chevrón dentro del texto (lo arregla en todos los casos), más «19 nov» y «16–22 nov»
a 15 px solo en ext, para que el título quepa en una línea.

### 3 · Segmentado «Mes · Semana · Día» en la barra de pub-ag-config (ext, tel)

**Causa.** Es de layout, no de texto. En esa barra el espaciador `.ag0-flex` y el `.ag0-seg` tienen los
dos `flex: 1 1 0%`, así que se reparten el hueco a medias. El segmentado se queda con 81 px (ext) o
111 px (tel) para tres celdas de 44 px mínimo, y «Semana» (63–67 px) se sale sobre «Día». Cambiar el
texto a «Sem.» no lo arregla (3 × 44 = 138 > 81).

**Layout:**
- El segmentado con `flex: none` (ancho por contenido, ≈ 165 px) y el espaciador con lo que sobre. En
  tel caben 224 px; en ext caben 164 px, justo al límite.
- **Recomendado: usar la barra de pub-ag-cal**, donde el mismo segmentado va en su propia fila (244 px,
  con «Día · Semana · 3 días · Mes») y no falla en ningún dispositivo. La barra de pub-ag-config parece
  una versión anterior.

**Texto:** no hace falta. Si se quiere margen en ext, «Mes · Sem. · Día» cabe en ≈ 140 px.

### 4 · Fila de resultado del buscador (pub-ag-config, esc)

**Causa.** `.ah-res` es una columna flex con `max-height: 360px` y `overflow-y: auto`, y las filas
`.ah-fr` tienen `flex-shrink: 1`. Cuando la lista no cabe, en vez de desplazarse aplasta las filas por
debajo de su contenido (49 px para 53 px). En esc el panel mide 288 px, el subtítulo parte en dos líneas
y se monta sobre la fila siguiente.

**Layout (recomendado):** `.ah-fr { flex-shrink: 0 }`. La lista se desplaza en vez de comprimirse, y lo
mismo sirve para cualquier lista en columna flex con scroll.

**Texto (opcional):** subtítulo en una línea con elipsis solo en el nombre, p. ej. «P. Prueba 26 · Agendada».

### 5 · «Es otra persona, crear de todos modos» (alerta de duplicado)

**Causa.** El texto es largo para cualquier ancho de alerta: necesita 311 px y la alerta da 262–292 px
aun con los botones apilados a todo el ancho. Por eso sale en dos líneas en los cinco dispositivos.

**Layout:** no queda margen, porque ya está a todo el ancho.

**Texto:**
- **«Es otra persona»** (145 px). Recomendado: es simétrico con «Es el mismo paciente» y la consecuencia
  («se creará un expediente nuevo») va en el cuerpo de la alerta.
- Alternativas: «Crear de todos modos» (192) y «Es otra persona, crearla» (204).

### 6 · «Ordenado por Fecha de ingreso» (lista de pacientes, ext e iv)

**Causa.** Comparte la línea de 296 px con «Filtros» (68 px) y un hueco de 12 px, y se encoge hasta
200 px. Necesita 213 px, así que la flecha ↓ sale 13 px.

**Layout:**
- Dar `flex-shrink: 0` a «Filtros» no basta.
- Quitar el prefijo visual «Ordenado por» y dejarlo como `aria-label` sí basta.

**Texto:** **«Fecha de ingreso»** ↓ (124 px; recomendado), «Por ingreso» (88) o «Más recientes» (104),
este último si el orden es descendente.

### 7 y 8 · Solapes de área táctil (menores)

No son de «no cabe»: el contenido visible no se toca, pero las áreas de 44 px sí. Bastaría con 4–8 px
de separación vertical entre «Usar solo la edad» y la etiqueta «36 años». En iv, el «+1» y el «⋯» de
la fila se pisan 3 px, así que hace falta un hueco de 4 px entre ellos.

## 3. Regla general propuesta

1. **Ancho natural ≤ ancho asignado − 2 × 8 px.** El ancho natural es el del rótulo en una línea más el
   icono, el hueco y el relleno. Todo botón de acción debe tener al menos 8 px libres por lado. El
   aviso (g) del comprobador lo vigila con `--holgura 6`.
2. **Dos botones lado a lado solo si ambos caben en su mitad:** `max(natural) ≤ (interior − hueco) / 2`.
   Si no se cumple, el orden es:
   - primero, probar el ancho por contenido (`flex: auto`) cuando `suma(naturales) + hueco ≤ interior`.
     Así se arregla «Crear y continuar»;
   - si tampoco cabe, apilar en ese dispositivo (primario arriba, a todo el ancho).

   En el modal de ext (310 px de ancho, 278 de interior) la mitad es **134 px**.
3. **Largo máximo de rótulo (15 px semibold; se cuentan 8 px por carácter para ir sobrados).**
   - Pie de modal en **ext**, lado a lado: ≤ 12 caracteres sin icono, ≤ 9 con icono.
     «No invitar» y «Invitar» con avión entran; «Enviar invitación» con avión no.
   - Pie apilado en ext: ≤ 28 caracteres. «Es otra persona» entra; «Es otra persona, crear de todos
     modos» no.
   - En tel, ih, iv y esc los modales son más anchos y estos mismos límites dejan margen.
   - Lo que pase de 30 caracteres no es un rótulo, es una frase: va al cuerpo.
4. **Nada de `flex: 1 1 0` en controles con texto** que compitan con un espaciador o con otro control de
   texto distinto. Los segmentados usan `flex: none` y celdas de ≥ 44 px por contenido.
5. **Iconos de cola (⌄, ↓, ›) dentro del flujo del texto**, nunca como pieza aparte en un botón que pueda
   encogerse por debajo de su contenido.
6. **Listas en columna flex con desplazamiento:** filas con `flex-shrink: 0`.
7. Antes de publicar una maqueta, pasar `tools/chk-botones.js` por todos los estados y los cinco
   dispositivos. Cero hallazgos (a)–(f) fuera de la lista de excepciones de diseño.

## 4. Comprobador reutilizable — `tools/chk-botones.js`

```bash
cd <scratchpad>/tools
# Toda una página, todos los dispositivos y estados, con recortes y JSON:
node chk-botones.js ../entrega/pub-ag-cita/pagina.html --out ../informes/botones --json ../informes/botones/r.json
# Rápido: solo el estado inicial, un dispositivo, sin recortes, con aviso de holgura:
node chk-botones.js ../entrega/pub-ag-cita/pagina.html --vp ext --sin-estados --sin-recortes --holgura 6
# Solo algunas secciones (índices de section.op):
node chk-botones.js ../entrega/pub-ag-cita/pagina.html --vp ext --ops 1,4
```

**Opciones:**
- `--vp` (por defecto `ext,tel,ih,iv,esc`).
- `--espera` en ms tras pulsar (700 por defecto). Súbelo a 3000 si la sección anima con resortes que el
  movimiento reducido no corta: por eso salieron falsos los avisos apilados de pub-capas.
- `--holgura N` activa el aviso (g).

Sin `--json`, imprime una línea por hallazgo. La función de medición `MEDIR` se exporta
(`require('./chk-botones.js').MEDIR`) para usarla con `page.evaluate` en otros guiones.

**Cómo trabaja.**
- Carga la página con `setContent` (doctype y meta viewport), fija el dispositivo con
  `#g-vp button[data-v=…]` y mide el estado inicial.
- Después, por cada índice k recarga la página, pulsa el k-ésimo botón de maqueta de todas las secciones
  a la vez y mide.
- Cada hallazgo nuevo se reconfirma en una recarga aislada pulsando solo ese botón, para descartar
  contaminación entre secciones.
- Abre una pestaña nueva cada 6 recargas: con páginas de 9 MB el renderizador se queda sin memoria.

**Exclusiones.**
- No mide los controles de la tira de maqueta ni los de dispositivo y tema.
- Ignora los pseudoelementos y descendientes absolutos (áreas táctiles ampliadas, insignias) al medir
  `scrollWidth`.
- Los solapes entre cabeceras `sticky` apiladas no cuentan.
- Marca como `[calendario]` los bloques y celdas del calendario (`ag0-b`, `ag0-tc`, `ag0-bq`, `am-ch`,
  `am-d`).

Agrupación y anexo: `tools/tmp-bt-agrupa.js informes/botones` (escribe `grupos.json`) y
`tools/tmp-bt-anexo.js informes/botones/grupos.json`.

## 5. Descartados (revisados con recorte)

| Grupo | Por qué no cuenta |
|---|---|
| 68 grupos `[calendario]` en pub-ag-cal, agenda-base y pub-ag-cita | Títulos de bloque truncados con elipsis o line-clamp en columnas estrechas, y bloques que se solapan en «estirar · durante», «arrastrar», «aviso de empalme» y «· movida». Es el diseño del calendario: el empalme se dibuja a propósito. Queda la celda «25» del mes en ext, con un punto 2 px por debajo: despreciable. |
| «M 17» (pub-ag-cal, «deslizar · durante») | Captura a mitad del gesto de deslizar. |
| «Cerrar aviso» ×2 (pub-capas, «Cola de dos», todos los dispositivos) | Medido a 700 ms, a mitad de la animación FLIP de la cola, que el movimiento reducido no corta. Con `--espera 3000` no hay solape. |
| Avisos de la campana de 3–4 líneas (pub-ag-config) | Es el cuerpo del aviso (frase), no un rótulo. |
| «Datos del documento · 19 nov 2026 · Paciente…» (pub-documentos) | Resumen de datos en una fila desplegable, truncado con elipsis a propósito. |
| «Bloqueado…», «Curso…» (mes, todo el día) | La elipsis está escrita en el texto, por diseño. |

Falsos positivos encontrados al depurar y corregidos en el comprobador: cabeceras de día `sticky`
apiladas; pseudoelementos de área táctil ampliada; filas de menú con título y descripción (las líneas se
cuentan solo en el rótulo principal); iconos recortados por un contenedor intermedio; bloques del
calendario recortados por el desplazamiento de la rejilla.

## 6. Avisos de holgura (g < 6 px): candidatos a romperse con el próximo cambio de texto

Pasada aparte con `--holgura 6` sobre los mismos 4120 estados. El aviso solo cuenta en botones con caja
visible (fondo, borde o sombra); en los botones de texto («Filtros», «Quitar», «Ver día ›») el borde no
se ve y no importa. Todos estos caben **hoy**, pero un acento o una palabra más bastan para romperlos.

| Página | Control | Holgura | Disp. | Dónde / estados | Causa | Propuesta |
|---|---|---|---|---|---|---|
| dashboard-final | «Nuevo documento» | 3 px | ih, iv | Dashboard, inicial y 5 estados | 4 accesos rápidos a partes iguales (144 px); el más largo necesita 155 | Ancho por contenido (129 + 135 + 155 + 105 + 3 × 8 = 548 ≤ 601). Texto: «Documento» (106 px) |
| pub-ag-cita | «No invitar a nadie» | 4 px | ext | Modal «Invitar por correo» | ver grupo 1 | «No invitar» |
| pub-ag-cita | «Crear y continuar» | 4 px | ext | Burbuja de alta y Formulario de cita, «registro rápido», «faltan datos», «consentimiento», «paciente duplicado» | Pie de 278 px con «Cancelar» a partes iguales (134 + 134); necesita 146 px | **Layout (recomendado):** ancho por contenido, 85 + 146 + 10 = 241 ≤ 278. Texto: «Crear paciente» (127 px) |
| pub-pacientes | «Es otra persona, crear de todos modos» | 6 px | ext, tel | Nuevo paciente, «Duplicado» | Apilado a todo el ancho, en el límite | «Es otra persona» (grupo 5) |


## 7. Anexo — todos los grupos brutos

Generado desde `informes/botones/grupos.json`. Tipos: a = desborde por scroll, b = pieza fuera del borde,
c = solape o invasión, d = elipsis, e = líneas, f = recortado por el contenedor. La primera columna de
medida es el peor caso del grupo.

| # | Página | Control | Tipos | Dispositivos | Secciones | Estados (muestra) | Medida peor caso | Recorte |
|---|---|---|---|---|---|---|---|---|
| 1 | agenda-base | «Jue, 19 de noviembre» | abc | ext | La rejilla horaria / La barra / Vista Día | inicial, «Maqueta: Día», «Maqueta: Semana», «Maqueta: Hueco pulsado» … (+20) | b: sobresale icono r8; a: scrollW 108>100; c: su contenido invade «Periodo siguiente» 4px — ancho 100 px, necesita 110 px, 2 línea(s) | [agenda-base-ext-001.png](botones/agenda-base-ext-001.png) |
| 2 | agenda-base | «16 – 22 de noviembre» | abc | ext | Semana en pantalla pequeña / 3 días | inicial, «Maqueta: Cerrar», «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado» | b: sobresale icono r8; a: scrollW 108>100; c: su contenido invade «Periodo siguiente» 4px — ancho 100 px, necesita 110 px, 2 línea(s) | [agenda-base-ext-004.png](botones/agenda-base-ext-004.png) |
| 3 | agenda-base | [calendario] «Pendiente administrativo» | de | tel | 3 días | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» | d: line-clamp 50>34; e: 3 líneas — ancho 100 px, necesita 82 px, 3 línea(s) | [agenda-base-tel-013.png](botones/agenda-base-tel-013.png) |
| 4 | agenda-base | [calendario] «Curso de actualización» | d | ext, tel, ih, iv, esc | 3 días / La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+3) | d: elipsis 133>47 — ancho 77 px, necesita 77 px, 1 línea(s) | [agenda-base-ext-006.png](botones/agenda-base-ext-006.png) |
| 5 | agenda-base | [calendario] «Bloqueado · Comida» | d | ext, tel, ih, iv, esc | 3 días / La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+3) | d: elipsis 116>47 — ancho 83 px, necesita 63 px, 1 línea(s) | [agenda-base-ext-007.png](botones/agenda-base-ext-007.png) |
| 6 | agenda-base | [calendario] «13:30 Pendiente administrativo Centro» | d | ext, ih, iv | 3 días / La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+3) | d: elipsis 144>68 — ancho 78 px, necesita 38 px, 1 línea(s) | [agenda-base-ext-009.png](botones/agenda-base-ext-009.png) |
| 7 | agenda-base | [calendario] «Guardia» | d | ih | La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado», «Maqueta: Densidad compacta» … (+1) | d: elipsis 45>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [agenda-base-ih-016.png](botones/agenda-base-ih-016.png) |
| 8 | agenda-base | [calendario] «Bloqueado · Vacaciones» | d | ih, iv, esc | La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado», «Maqueta: Densidad compacta» … (+1) | d: elipsis 139>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [agenda-base-ih-018.png](botones/agenda-base-ih-018.png) |
| 9 | agenda-base | [calendario] «16:00 Paciente Prueba 19 Centro Revisión de estudios de imag» | d | ih, iv | La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado», «Maqueta: Densidad compacta» … (+1) | d: line-clamp 64>32 — ancho 72 px, necesita 59 px, 1 línea(s) | [agenda-base-ih-019.png](botones/agenda-base-ih-019.png) |
| 10 | agenda-base | [calendario] «12:00 Paciente P. Centro» | d | ih, esc | La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado», «Maqueta: Densidad compacta» … (+1) | d: elipsis 65>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [agenda-base-ih-020.png](botones/agenda-base-ih-020.png) |
| 11 | agenda-base | [calendario] «Bloqueado · Congreso» | d | ih, iv, esc | La rejilla horaria / Semana en pantalla pequeña | «Maqueta: Densidad compacta», inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado» … (+1) | d: elipsis 128>41 — ancho 77 px, necesita 57 px, 1 línea(s) | [agenda-base-ih-039.png](botones/agenda-base-ih-039.png) |
| 12 | agenda-base | [calendario] «17:00 Paciente Prueba 07 Centro Gonalgia, primera vez» | d | iv | El bloque de cita | inicial, «Maqueta: Cerrar todo» | d: line-clamp 48>32 — ancho 74 px, necesita 53 px, 1 línea(s) | [agenda-base-iv-041.png](botones/agenda-base-iv-041.png) |
| 13 | agenda-base | [calendario] «18:20 Revisión d.» | d | esc | La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: Semana», «Maqueta: Hueco pulsado», «Maqueta: Densidad compacta» … (+1) | d: elipsis 63>52 — ancho 62 px, necesita 0 px, 0 línea(s) | [agenda-base-esc-069.png](botones/agenda-base-esc-069.png) |
| 14 | agenda-base | [calendario] «Paciente P. Centro» | d | ext, ih, iv | 3 días / La rejilla horaria / Semana en pantalla pequeña / El bloque de cita | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+3) | d: elipsis 65>52 — ancho 78 px, necesita 38 px, 1 línea(s) | [agenda-base-ext-008.png](botones/agenda-base-ext-008.png) |
| 15 | agenda-base | [calendario] «Paciente Prueba 08» | d | tel, esc | 3 días / El bloque de cita / La rejilla horaria / Semana en pantalla pequeña | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+3) | d: elipsis 139>87 — ancho 100 px, necesita 87 px, 1 línea(s) | [agenda-base-tel-012.png](botones/agenda-base-tel-012.png) |
| 16 | agenda-base | [calendario] «Paciente Prueba 23, 13:00 a 13:15, Cancelada» | d | ih, iv, esc | La rejilla horaria | «Maqueta: Densidad compacta» | d: elipsis 65>46 — ancho 72 px, necesita 0 px, 0 línea(s) | [agenda-base-ih-036.png](botones/agenda-base-ih-036.png) |
| 17 | agenda-base | [calendario] «Paciente Prueba 10, 17:30 a 17:45, Confirmada» | d | ih, iv, esc | La rejilla horaria | «Maqueta: Densidad compacta» | d: elipsis 65>46 — ancho 72 px, necesita 0 px, 0 línea(s) | [agenda-base-ih-038.png](botones/agenda-base-ih-038.png) |
| 18 | agenda-base | [calendario] «Paciente Prueba 18, 11:30 a 11:45, Atendida» | d | iv, esc | La rejilla horaria | «Maqueta: Densidad compacta» | d: elipsis 65>49 — ancho 75 px, necesita 0 px, 0 línea(s) | [agenda-base-iv-056.png](botones/agenda-base-iv-056.png) |
| 19 | agenda-base | [calendario] «Paciente Prueba 19 16:00 – 17:30 Centro Revisión de estudios» | d | esc | La rejilla horaria | «Maqueta: Densidad compacta» | d: line-clamp 32>0 — ancho 127 px, necesita 111 px, 2 línea(s) | [agenda-base-esc-081.png](botones/agenda-base-esc-081.png) |
| 20 | cromo | «Es otra persona, crear de todos modos» | e | ext, tel, iv | Paleta de comandos (⌘K) | «Duplicado» | e: 2 líneas (pie de modal/alerta) — ancho 262 px, necesita 254 px, 2 línea(s) | [cromo-ext-001.png](botones/cromo-ext-001.png) |
| 21 | pub-ag-cal | «Jue, 19 de noviembre» | abc | ext | Vista Día / «+N más» | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: confirmada (10)», «Maqueta: cancelada (08)» … (+15) | b: sobresale icono r8; a: scrollW 108>100; c: su contenido invade «Periodo siguiente» 4px — ancho 100 px, necesita 110 px, 2 línea(s) | [pub-ag-cal-ext-001.png](botones/pub-ag-cal-ext-001.png) |
| 22 | pub-ag-cal | «19 – 21 de noviembre» | abc | ext | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+17) | b: sobresale icono r8; a: scrollW 108>100; c: su contenido invade «Periodo siguiente» 4px — ancho 100 px, necesita 110 px, 2 línea(s) | [pub-ag-cal-ext-002.png](botones/pub-ag-cal-ext-002.png) |
| 23 | pub-ag-cal | [calendario] «12:00 Paciente P. Centro» | cd | ih, esc | Semana / Gestos de la Semana | inicial, «Maqueta: Recargando», «Maqueta: Densidad compacta», «Maqueta: aviso de error» … (+21) | d: elipsis 65>53; c: se solapa con «Paciente Prueba 10 17:30 – 18:30 Centro» 63x11 — ancho 63 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-esc-150.png](botones/pub-ag-cal-esc-150.png) |
| 24 | pub-ag-cal | [calendario] «Paciente Prueba 10, 17:30 a 17:45, Confirmada, Dr. Admin Sem» | cd | ih, iv, esc | Gestos de la Semana / Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: Densidad compacta» | d: elipsis 65>46; c: se solapa con «17:30 Paciente Prueba 10 Centro» 72x18 — ancho 72 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-ih-051.png](botones/pub-ag-cal-ih-051.png) |
| 25 | pub-ag-cal | [calendario] «17:30 Paciente Prueba 10 Centro» | c | ih, iv | Gestos de la Semana / Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: después», «Maqueta: · movida» | c: se solapa con «Paciente Prueba 10, 17:30 a 17:45, Confi» 72x18; c: se solapa con «Paciente Prueba 12, 18:20 a 18:50, Confi» 36x11; c: se solapa con — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ih-052.png](botones/pub-ag-cal-ih-052.png) |
| 26 | pub-ag-cal | [calendario] «Paciente Prueba 12, 18:20 a 18:50, Confirmada, Reservó por e» | c | ih, iv | Gestos de la Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: después» | c: se solapa con «17:30 Paciente Prueba 10 Centro» 36x11 — ancho 36 px, necesita 13 px, 0 línea(s) | [pub-ag-cal-ih-053.png](botones/pub-ag-cal-ih-053.png) |
| 27 | pub-ag-cal | [calendario] «Revisión de estudios, 18:20 a 18:50, Agendada, Agendada desd» | c | ih, iv | Gestos de la Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: después» | c: se solapa con «17:30 Paciente Prueba 10 Centro» 35x11 — ancho 35 px, necesita 13 px, 0 línea(s) | [pub-ag-cal-ih-054.png](botones/pub-ag-cal-ih-054.png) |
| 28 | pub-ag-cal | [calendario] «10:00 Paciente Prueba 22» | c | ih, iv | Semana | «Maqueta: · movida» | c: se solapa con «10:30 Paciente Prueba 23 Centro» 72x18 — ancho 72 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-ih-066.png](botones/pub-ag-cal-ih-066.png) |
| 29 | pub-ag-cal | [calendario] «18:20 Revisión d.» | cd | esc | Gestos de la Semana / Semana | «Maqueta: arrastrar · antes», «Maqueta: durante», «Maqueta: aviso de horario», «Maqueta: después» … (+3) | d: elipsis 63>52; c: se solapa con «Paciente Prueba 10 17:30 – 18:30 Centro» 62x11 — ancho 62 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-esc-151.png](botones/pub-ag-cal-esc-151.png) |
| 30 | pub-ag-cal | [calendario] «Paciente Prueba 10 17:30 – 18:30 Centro» | c | esc | Gestos de la Semana / Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: después», «Maqueta: · movida» | c: se solapa con «Paciente Prueba 10, 17:30 a 17:45, Confi» 127x18; c: se solapa con «18:20 Paciente P. Centro» 63x11; c: se solapa con «18:20 Revisió — ancho 127 px, necesita 81 px, 2 línea(s) | [pub-ag-cal-esc-149.png](botones/pub-ag-cal-esc-149.png) |
| 31 | pub-ag-cal | [calendario] «Paciente Prueba 22 10:00 – 10:45» | c | esc | Semana | «Maqueta: · movida» | c: se solapa con «Paciente Prueba 23 10:30 – 11:30 Centro» 127x18 — ancho 127 px, necesita 81 px, 2 línea(s) | [pub-ag-cal-esc-168.png](botones/pub-ag-cal-esc-168.png) |
| 32 | pub-ag-cal | «M 17» | f | ext | Gestos de la Semana | «Maqueta: deslizar · durante» | f: recortado por contenedor 15px — ancho 45 px, necesita 21 px, 1 línea(s) | [pub-ag-cal-ext-014.png](botones/pub-ag-cal-ext-014.png) |
| 33 | pub-ag-cal | [calendario] «25» | ab | ext | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+22) | b: sobresale icono b2; a: scrollH 46>44 — ancho 45 px, necesita 19 px, 1 línea(s) | [pub-ag-cal-ext-009.png](botones/pub-ag-cal-ext-009.png) |
| 34 | pub-ag-cal | [calendario] «Bloqueado…» | ad | ih, iv | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+20) | a: scrollW 87>82 — ancho 82 px, necesita 87 px, 1 línea(s) | [pub-ag-cal-iv-084.png](botones/pub-ag-cal-iv-084.png) |
| 35 | pub-ag-cal | [calendario] «Pendiente administrativo» | de | tel | 3 días | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» | d: line-clamp 50>34; e: 3 líneas — ancho 100 px, necesita 82 px, 3 línea(s) | [pub-ag-cal-tel-018.png](botones/pub-ag-cal-tel-018.png) |
| 36 | pub-ag-cal | [calendario] «Curso de actualización» | d | ext, tel, ih, iv, esc | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+25) | d: elipsis 133>47 — ancho 77 px, necesita 77 px, 1 línea(s) | [pub-ag-cal-ext-003.png](botones/pub-ag-cal-ext-003.png) |
| 37 | pub-ag-cal | [calendario] «Bloqueado · Comida» | d | ext, tel, ih, iv, esc | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+21) | d: elipsis 116>47 — ancho 83 px, necesita 63 px, 1 línea(s) | [pub-ag-cal-ext-004.png](botones/pub-ag-cal-ext-004.png) |
| 38 | pub-ag-cal | [calendario] «13:30 Pendiente administrativo Centro» | d | ext, ih, iv | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+22) | d: elipsis 144>68 — ancho 78 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ext-006.png](botones/pub-ag-cal-ext-006.png) |
| 39 | pub-ag-cal | [calendario] «Guardia» | d | ih | Semana / Gestos de la Semana / Mes | inicial, «Maqueta: Recargando», «Maqueta: Todos los médicos», «Maqueta: Densidad compacta» … (+23) | d: elipsis 45>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cal-ih-021.png](botones/pub-ag-cal-ih-021.png) |
| 40 | pub-ag-cal | [calendario] «Sesión clínica» | d | ih, iv | Semana / Gestos de la Semana | inicial, «Maqueta: Recargando», «Maqueta: Todos los médicos», «Maqueta: Densidad compacta» … (+23) | d: elipsis 80>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cal-ih-022.png](botones/pub-ag-cal-ih-022.png) |
| 41 | pub-ag-cal | [calendario] «Bloqueado · Vacaciones» | d | ih, iv, esc | Semana / Gestos de la Semana | inicial, «Maqueta: Recargando», «Maqueta: Todos los médicos», «Maqueta: Densidad compacta» … (+22) | d: elipsis 139>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cal-ih-024.png](botones/pub-ag-cal-ih-024.png) |
| 42 | pub-ag-cal | [calendario] «16:00 Paciente Prueba 19 Centro Revisión de estudios de imag» | d | ih, iv | Gestos de la Semana / Semana | «Maqueta: arrastrar · antes», «Maqueta: durante», «Maqueta: aviso de horario», «Maqueta: después» … (+18) | d: line-clamp 64>32 — ancho 72 px, necesita 59 px, 1 línea(s) | [pub-ag-cal-ih-041.png](botones/pub-ag-cal-ih-041.png) |
| 43 | pub-ag-cal | [calendario] «Pendiente administrativo AS Centro» | d | ih, iv | Semana | «Maqueta: Todos los médicos» | d: elipsis 144>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ih-045.png](botones/pub-ag-cal-ih-045.png) |
| 44 | pub-ag-cal | [calendario] «Bloqueado · Congreso» | d | ih, iv, esc | Gestos de la Semana / Semana | «Maqueta: estirar · durante», «Maqueta: aviso de empalme», «Maqueta: después», «Maqueta: Densidad compacta» … (+3) | d: elipsis 128>41 — ancho 77 px, necesita 57 px, 1 línea(s) | [pub-ag-cal-ih-055.png](botones/pub-ag-cal-ih-055.png) |
| 45 | pub-ag-cal | [calendario] «Curso…» | d | ih | Mes | «Maqueta: asas para estirar (todo el día)» | d: elipsis 46>38 — ancho 79 px, necesita 79 px, 1 línea(s) | [pub-ag-cal-ih-069.png](botones/pub-ag-cal-ih-069.png) |
| 46 | pub-ag-cal | [calendario] «14:00 Junta de servicio» | d | esc | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+21) | d: elipsis 100>67 — ancho 135 px, necesita 135 px, 1 línea(s) | [pub-ag-cal-esc-120.png](botones/pub-ag-cal-esc-120.png) |
| 47 | pub-ag-cal | [calendario] «11:00 Bloqueado · Trámite» | d | esc | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+21) | d: elipsis 116>66 — ancho 134 px, necesita 134 px, 1 línea(s) | [pub-ag-cal-esc-121.png](botones/pub-ag-cal-esc-121.png) |
| 48 | pub-ag-cal | [calendario] «08:00 Paciente P.» | d | esc | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+21) | d: elipsis 65>50 — ancho 134 px, necesita 134 px, 1 línea(s) | [pub-ag-cal-esc-122.png](botones/pub-ag-cal-esc-122.png) |
| 49 | pub-ag-cal | [calendario] «09:00 Revisión de estudios» | d | esc | Mes / «+N más» | inicial, «Maqueta: Cargando», «Maqueta: «Todos los médicos»», «Maqueta: con reserva por enlace» … (+21) | d: elipsis 120>36 — ancho 134 px, necesita 134 px, 1 línea(s) | [pub-ag-cal-esc-124.png](botones/pub-ag-cal-esc-124.png) |
| 50 | pub-ag-cal | [calendario] «Pendiente administrativoAS» | d | esc | Semana | «Maqueta: Todos los médicos» | d: line-clamp 50>34 — ancho 127 px, necesita 90 px, 2 línea(s) | [pub-ag-cal-esc-137.png](botones/pub-ag-cal-esc-137.png) |
| 51 | pub-ag-cal | [calendario] «Paciente P. Centro» | d | ext, ih, iv | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+22) | d: elipsis 65>52 — ancho 78 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ext-005.png](botones/pub-ag-cal-ext-005.png) |
| 52 | pub-ag-cal | [calendario] «Paciente Prueba 08» | d | tel, esc | 3 días / Semana / Gestos de la Semana | inicial, «Maqueta: burbuja en curso (07)», «Maqueta: hueco pulsado», «Maqueta: Cerrar» … (+21) | d: elipsis 139>87 — ancho 100 px, necesita 87 px, 1 línea(s) | [pub-ag-cal-tel-017.png](botones/pub-ag-cal-tel-017.png) |
| 53 | pub-ag-cal | [calendario] «Paciente P. DI Centro» | d | ih | Semana | «Maqueta: Todos los médicos» | d: elipsis 65>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ih-043.png](botones/pub-ag-cal-ih-043.png) |
| 54 | pub-ag-cal | [calendario] «Paciente P. AS Centro» | d | ih | Semana | «Maqueta: Todos los médicos» | d: elipsis 65>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cal-ih-044.png](botones/pub-ag-cal-ih-044.png) |
| 55 | pub-ag-cal | [calendario] «Paciente Prueba 23, 13:00 a 13:15, Cancelada, Dr. Admin Semi» | d | ih, iv, esc | Semana | «Maqueta: Densidad compacta» | d: elipsis 65>46 — ancho 72 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-ih-057.png](botones/pub-ag-cal-ih-057.png) |
| 56 | pub-ag-cal | [calendario] «Paciente Prueba 19 AS Centro Revisión de estudios de imagen» | d | iv | Semana | «Maqueta: Todos los médicos» | d: line-clamp 48>32 — ancho 75 px, necesita 65 px, 1 línea(s) | [pub-ag-cal-iv-087.png](botones/pub-ag-cal-iv-087.png) |
| 57 | pub-ag-cal | [calendario] «Paciente Prueba 18, 11:30 a 11:45, Atendida, Dr. Admin Semil» | d | iv, esc | Semana | «Maqueta: Densidad compacta» | d: elipsis 65>49 — ancho 75 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-iv-099.png](botones/pub-ag-cal-iv-099.png) |
| 58 | pub-ag-cal | [calendario] «Paciente Prueba 23AS» | d | esc | Semana | «Maqueta: Todos los médicos» | d: elipsis 165>114 — ancho 127 px, necesita 114 px, 1 línea(s) | [pub-ag-cal-esc-135.png](botones/pub-ag-cal-esc-135.png) |
| 59 | pub-ag-cal | [calendario] «Paciente Prueba 26 AS» | d | esc | Semana | «Maqueta: Todos los médicos» | d: line-clamp 50>34 — ancho 127 px, necesita 96 px, 2 línea(s) | [pub-ag-cal-esc-138.png](botones/pub-ag-cal-esc-138.png) |
| 60 | pub-ag-cal | [calendario] «Paciente Prueba 19 16:00 – 17:30 Centro Revisión de estudios» | d | esc | Semana | «Maqueta: Densidad compacta» | d: line-clamp 32>0 — ancho 127 px, necesita 111 px, 2 línea(s) | [pub-ag-cal-esc-153.png](botones/pub-ag-cal-esc-153.png) |
| 61 | pub-ag-cal | [calendario] «Paciente Prueba 15, 08:00 a 08:30, Agendada, Agendada desde » | d | esc | Mes | «Maqueta: arrastrando» | d: elipsis 65>50 — ancho 134 px, necesita 0 px, 0 línea(s) | [pub-ag-cal-esc-166.png](botones/pub-ag-cal-esc-166.png) |
| 62 | pub-ag-cita | «Jue, 19 de noviembre» | abc | ext | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Formulario de c | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+184) | b: sobresale icono r8; a: scrollW 108>100; c: su contenido invade «Periodo siguiente» 4px — ancho 100 px, necesita 110 px, 2 línea(s) | [pub-ag-cita-ext-001.png](botones/pub-ag-cita-ext-001.png) |
| 63 | pub-ag-cita | «Enviar invitación» | ab | ext | Preguntas y confirmaciones / Formulario de cita | «Maqueta: invitar: elegir», «Maqueta: otra dirección», «Maqueta: error al invitar», «Maqueta: Invitar: elegir» … (+1) | b: sobresale icono+texto l5 r5; a: scrollW 139>134 — ancho 134 px, necesita 176 px, 1 línea(s) | [pub-ag-cita-ext-016.png](botones/pub-ag-cita-ext-016.png) |
| 64 | pub-ag-cita | «Es otra persona, crear de todos modos» | e | ext, tel, ih, iv, esc | Ligar paciente / La burbuja de alta | «Maqueta: paciente duplicado», «Maqueta: registro: paciente duplicado» | e: 2 líneas (pie de modal/alerta) — ancho 270 px, necesita 258 px, 2 línea(s) | [pub-ag-cita-ext-014.png](botones/pub-ag-cita-ext-014.png) |
| 65 | pub-ag-cita | [calendario] «Guardia» | d | ih | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 45>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cita-ih-018.png](botones/pub-ag-cita-ih-018.png) |
| 66 | pub-ag-cita | [calendario] «Curso de actualización» | d | ih, iv, esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 133>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cita-ih-019.png](botones/pub-ag-cita-ih-019.png) |
| 67 | pub-ag-cita | [calendario] «Bloqueado · Vacaciones» | d | ih, iv, esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 139>41 — ancho 71 px, necesita 71 px, 1 línea(s) | [pub-ag-cita-ih-020.png](botones/pub-ag-cita-ih-020.png) |
| 68 | pub-ag-cita | [calendario] «16:00 Paciente Prueba 19 Centro Revisión de estudios de imag» | d | ih, iv | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: line-clamp 64>32 — ancho 72 px, necesita 59 px, 1 línea(s) | [pub-ag-cita-ih-021.png](botones/pub-ag-cita-ih-021.png) |
| 69 | pub-ag-cita | [calendario] «13:00 Paciente P. Centro» | d | ih, esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 65>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cita-ih-022.png](botones/pub-ag-cita-ih-022.png) |
| 70 | pub-ag-cita | [calendario] «Bloqueado · Comida» | d | ih, iv, esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 116>41 — ancho 77 px, necesita 57 px, 1 línea(s) | [pub-ag-cita-ih-025.png](botones/pub-ag-cita-ih-025.png) |
| 71 | pub-ag-cita | [calendario] «13:30 Pendiente administrativo Centro» | d | ih, iv | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 144>62 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cita-ih-026.png](botones/pub-ag-cita-ih-026.png) |
| 72 | pub-ag-cita | [calendario] «Revisión de estudios 18:20 – 18:50 Agendada desde Google Cal» | d | ih, iv | ¿No es una cita? | «Maqueta: después (evento)», «Maqueta: burbuja del evento después» | d: elipsis 217>173 — ancho 270 px, necesita 254 px, 1 línea(s) | [pub-ag-cita-ih-069.png](botones/pub-ag-cita-ih-069.png) |
| 73 | pub-ag-cita | [calendario] «Bloqueado · Congreso» | d | iv, esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 128>44 — ancho 80 px, necesita 60 px, 1 línea(s) | [pub-ag-cita-iv-007.png](botones/pub-ag-cita-iv-007.png) |
| 74 | pub-ag-cita | [calendario] «18:20 Revisión d.» | d | esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+70) | d: elipsis 63>52 — ancho 62 px, necesita 0 px, 0 línea(s) | [pub-ag-cita-esc-045.png](botones/pub-ag-cita-esc-045.png) |
| 75 | pub-ag-cita | [calendario] «Paciente P. Centro» | d | ih, iv | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 65>46 — ancho 72 px, necesita 38 px, 1 línea(s) | [pub-ag-cita-ih-024.png](botones/pub-ag-cita-ih-024.png) |
| 76 | pub-ag-cita | [calendario] «Paciente Prueba 23» | d | esc | La burbuja de la cita / Preguntas y confirmaciones / La burbuja de alta / La tarjeta al pasar el ratón / Citas por ligar | inicial, «Maqueta: agendada», «Maqueta: confirmada · por enlace», «Maqueta: en curso» … (+75) | d: elipsis 138>114 — ancho 127 px, necesita 114 px, 1 línea(s) | [pub-ag-cita-esc-040.png](botones/pub-ag-cita-esc-040.png) |
| 77 | pub-ag-config | «jue, 19 nov 2026, 14:00 Paciente Prueba 26 · Agendada» | abc | esc | Buscar en la agenda | «Maqueta: cita por ligar («Prueba 2»)» | b: sobresale texto t4 b3; a: scrollH 53>49; c: su contenido invade «25 Paciente Prueba 25 999 000 0025» 174px — ancho 272 px, necesita 272 px, 1 línea(s) | [pub-ag-config-esc-022.png](botones/pub-ag-config-esc-022.png) |
| 78 | pub-ag-config | «Semana» | abc | ext, tel | Buscar en la agenda / Campana «Por confirmar y avisos» / Opciones de la agenda / Ir a una fecha, leyenda y atajos / Hora | inicial, «Maqueta: abrir buscador», «Maqueta: resultados («Prueba 0»)», «Maqueta: cita por ligar («Prueba 2»)» … (+40) | b: sobresale texto r15; a: scrollW 59>44; c: su contenido invade «Día» 13px — ancho 44 px, necesita 67 px, 1 línea(s) | [pub-ag-config-ext-001.png](botones/pub-ag-config-ext-001.png) |
| 79 | pub-ag-config | «Día» | f | tel | Entrar al asistente / Salir a medias | inicial, «Maqueta: abrir «Opciones de la agenda»», «Maqueta: volver a la agenda», «Maqueta: Cerrar capa» … (+2) | f: recortado por contenedor 12px — ancho 44 px, necesita 32 px, 1 línea(s) | [pub-ag-config-tel-016.png](botones/pub-ag-config-tel-016.png) |
| 80 | pub-ag-config | «Evento nuevo de Google por asignar: Revisión de estudios Cit» | e | ext, esc | Campana «Por confirmar y avisos» | «Maqueta: todos los tipos de aviso» | e: 3 líneas — ancho 278 px, necesita 271 px, 3 línea(s) | [pub-ag-config-ext-008.png](botones/pub-ag-config-ext-008.png) |
| 81 | pub-ag-config | «La reserva de Paciente Prueba 21 se empalma con un evento de» | e | ext, esc | Campana «Por confirmar y avisos» | «Maqueta: todos los tipos de aviso» | e: 3 líneas — ancho 278 px, necesita 270 px, 3 línea(s) | [pub-ag-config-ext-009.png](botones/pub-ag-config-ext-009.png) |
| 82 | pub-ag-config | «Desde Google no se pueden mover las citas reservadas por enl» | e | tel, ih, iv | Campana «Por confirmar y avisos» | «Maqueta: todos los tipos de aviso» | e: 4 líneas — ancho 361 px, necesita 354 px, 4 línea(s) | [pub-ag-config-tel-019.png](botones/pub-ag-config-tel-019.png) |
| 83 | pub-ag-config | [calendario] «Revisión de estudios 18:20 – 18:50 Agendada desde Google Cal» | d | esc | Horario de consulta y menú plegado | «Maqueta: menú plegado (computadora)» | d: elipsis 106>74 — ancho 388 px, necesita 372 px, 1 línea(s) | [pub-ag-config-esc-025.png](botones/pub-ag-config-esc-025.png) |
| 84 | pub-capas | «Cerrar aviso» | c | ext, tel, ih, iv, esc | Aviso breve | «Cola de dos» | c: se solapa con «Cerrar aviso» 44x17 — ancho 44 px, necesita 16 px, 0 línea(s) | [pub-capas-ext-001.png](botones/pub-capas-ext-001.png) |
| 85 | pub-documentos | «Datos del documento 19 nov 2026 · Paciente Prueba 01 · Sin t» | d | ext, tel | Escrito médico | inicial, «Inicial», «Generando PDF…», «Cargando tu perfil…» … (+7) | d: elipsis 330>244 — ancho 294 px, necesita 294 px, 1 línea(s) | [pub-documentos-ext-001.png](botones/pub-documentos-ext-001.png) |
| 86 | pub-documentos | «Datos del documento 19 nov 2026 · Paciente Prueba 01 · Const» | d | ext, tel, ih, iv, esc | Escrito médico | «Lleno», «Título del pie propio» | d: elipsis 503>244 — ancho 294 px, necesita 294 px, 1 línea(s) | [pub-documentos-ext-002.png](botones/pub-documentos-ext-002.png) |
| 87 | pub-documentos | «Datos del documento 19 nov 2026 · Sin paciente · Sin título» | d | ext | Escrito médico | «Sin paciente» | d: elipsis 279>244 — ancho 294 px, necesita 294 px, 1 línea(s) | [pub-documentos-ext-003.png](botones/pub-documentos-ext-003.png) |
| 88 | pub-pacientes | «36 años» | c | ext, tel | Nuevo paciente | «Con datos» | c: se solapa con «Usar solo la edad» 63x24 — ancho 63 px, necesita 63 px, 1 línea(s) | [pub-pacientes-ext-002.png](botones/pub-pacientes-ext-002.png) |
| 89 | pub-pacientes | «Usar solo la edad» | c | ext, tel | Nuevo paciente | «Con datos» | c: se solapa con «36 años» 63x24 — ancho 136 px, necesita 136 px, 1 línea(s) | [pub-pacientes-ext-003.png](botones/pub-pacientes-ext-003.png) |
| 90 | pub-pacientes | «+1» | c | iv | Expediente (lista de pacientes) | inicial, «Maqueta: médica invitada» | c: se solapa con «Acciones de Paciente Prueba 24» 3x44 — ancho 32 px, necesita 29 px, 1 línea(s) | [pub-pacientes-iv-007.png](botones/pub-pacientes-iv-007.png) |
| 91 | pub-pacientes | «Acciones de Paciente Prueba 24» | c | iv | Expediente (lista de pacientes) | inicial, «Maqueta: médica invitada» | c: se solapa con «+1» 3x44 — ancho 44 px, necesita 20 px, 0 línea(s) | [pub-pacientes-iv-008.png](botones/pub-pacientes-iv-008.png) |
| 92 | pub-pacientes | «Ordenado por Fecha de ingreso» | ab | ext, iv | Expediente (lista de pacientes) | inicial, «Maqueta: secretaria», «Maqueta: médica invitada», «Maqueta: sin resultados» … (+2) | b: sobresale icono r13; a: scrollW 213>200 — ancho 200 px, necesita 213 px, 1 línea(s) | [pub-pacientes-ext-001.png](botones/pub-pacientes-ext-001.png) |

