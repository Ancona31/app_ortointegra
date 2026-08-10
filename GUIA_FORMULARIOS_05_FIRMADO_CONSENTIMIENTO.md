# 05 · Firmado electrónico del consentimiento

Spec de implementación. **No está en la propuesta**: el flujo no existía cuando se escribió.
Solo aplica al formato `consentimiento`.

---

## 0 · Estados del documento

El consentimiento es el único de los ocho que cambia de estado en el tiempo.

| Estado | Cómo se llega | Editable | En la lista |
|---|---|---|---|
| Borrador | «Guardar borrador» | sí | badge `Borrador`, borde punteado |
| Emitido sin firma | «Imprimir sin firma» | no | como cualquier documento |
| Sellado | Flujo de firma + «Sellar e imprimir» | **no** | badge `Sellado` |

**Un borrador por paciente y por médico** (`user_id` + `paciente_id`). El borrador de un
colega de la misma cuenta no aparece en la lista del médico ni le bloquea empezar el suyo.
**No caducan.**

---

## 1 · Los tres botones al terminar el formulario

Sustituyen al primario único en `.sp-doc-actions`, solo en este formato.

| Botón | Clase | Orden ≥380 (izq→der) | Orden XS (arriba→abajo) |
|---|---|---|---|
| `Guardar borrador` | `.sp-btn--ghost`, `flex: 0 0 auto` | 1 | 3 |
| `Imprimir sin firma` | `.sp-btn--secondary`, `flex: 0 0 auto`, `white-space: nowrap` | 2 | 2 |
| `Iniciar firmado electrónico` | `.sp-btn--primary`, `flex: 1`, icono `PenLine` 18 px | 3 | 1 |

XS: `flex-direction: column-reverse`, los tres a `width: 100%`, 48 px de alto.
En un borrador retomado, el primario dice `Continuar firmado`.

**«Guardar como plantilla» no va aquí**: sube al selector, junto a «Gestionar»
(spec 02 §6). Cuatro botones en una fila son un tablero.

---

## 2 · Dónde vive el flujo

**Un modo a pantalla completa dentro de la misma ruta**, que sustituye el contenido de la
pantalla —cabecera de consulta incluida—, entra con `.sp-push-forward` y sale con una X.
El formulario sigue montado detrás con `display:none`.

- **No es ruta nueva:** obligaría a traspasar un formulario que puede no estar guardado.
- **No es modal flotante:** se acaba de retirar uno de esta pantalla, y un modal invita a
  cerrarse tocando fuera — con el dispositivo en manos del paciente, eso es perder firmas.
- **Ocultar el resto es una función:** es el único caso en que el dispositivo cambia de
  manos; el paciente no debe poder llegar al expediente ni al listado.

Salir con firmas capturadas pide confirmación; sin ninguna, sale directo. `Escape` = X.

---

## 3 · Cromo del modo

### 3.1 · Cabecera

| Parte | Valor |
|---|---|
| Alto | 56 px, `border-bottom: 1px solid var(--sp-line-divider)` |
| Salir | 44×44, radio `--sp-r-btn-sm` 8, `X` 20 px `--sp-ink-500`, `aria-label="Salir del firmado"` |
| Título | `.sp-title-card` 20/800/`--sp-ink-800` — `Firmado electrónico`. XS: 18 px |
| Contador | `.sp-badge` a la derecha. ≥380: `Firmante {n} de 4` / `4 de 4 resueltos`. **XS: `{n}/4` y `4/4`** — con el texto largo, el título se trunca a 358 px |

### 3.2 · Progreso

`.sp-progress` — etiqueta `FIRMANTES` `--sp-fs-badge` 12 / `--sp-fw-bold` / `--sp-ink-350`;
pista `flex:1` con 4 segmentos de 7 px (6 px en XS), `gap: 6px`, radio 4 px.
Hechos y actual: `--sp-primary`. Pendientes: `--sp-primary-track`.

**Cuatro segmentos siempre**, aunque se omitan firmantes: omitir resuelve un paso, no lo
elimina. Un progreso que encoge miente sobre cuánto queda.

---

## 4 · Orden del flujo

1. **Paciente** — con casilla «no puede firmar». Sin opción de omitir.
2. **Familiar o responsable** — con omitir, **salvo** si el paciente marcó «no puede
   firmar»: entonces es obligatorio y el botón de omitir no se renderiza.
3. **Testigo 1** — con omitir.
4. **Testigo 2** — con omitir.

Tras cada firma capturada: **pregunta de foto**. Solo a quien firmó — quien se omitió no
firmó, así que no hay identificación que capturar.

**La firma del médico no entra en el flujo:** se renderiza siempre desde su perfil.

---

## 5 · Captura de firma

### 5.1 · Lienzo

| Propiedad | Token | px |
|---|---|---|
| Alto | — | 240 en XS · **280** desde 380 |
| Fondo | `--sp-surface-sunken` | #fbfcfe |
| Borde | 1 px `--sp-line-input` | — |
| Radio | `--sp-r-input` | 14 |
| Línea de firma | 1 px dashed `--sp-line-dash`, a 34 px del borde inferior, con 20 px de margen lateral | — |
| Rol bajo la línea | `--sp-fs-legal` 11 / `--sp-fw-bold` / `--sp-ls-label-w` / `--sp-ink-300`, mayúsculas | — |
| Placeholder | `--sp-fs-body` 14.5 `--sp-ink-200`, centrado | — |
| Trazo | `--sp-ink-900`, 3 px, `stroke-linecap: round` | — |

El lienzo ocupa el ancho completo del contenedor en los cuatro anchos: cuanto más ancho,
más cómodo firmar.

Textos de rol: `PACIENTE` · `FAMILIAR RESPONSABLE` · `TESTIGO 1` · `TESTIGO 2`.

### 5.2 · Acciones

| Botón | Clase | Estado inicial |
|---|---|---|
| `Borrar y repetir` | `.sp-btn--secondary` 48 px, `flex: 0 0 auto`, `white-space: nowrap` | `disabled`, `opacity:.5` |
| `Confirmar firma` | `.sp-btn--primary` 48 px, `flex: 1` | `disabled`, fondo `#b6c6da` |

Al primer trazo se encienden los dos. Borrar limpia el lienzo entero: **no hay deshacer
parcial de trazos**, que en una firma no significa nada.
XS: `column-reverse`, los dos a `width:100%`.

### 5.3 · «No puede firmar»

`.sp-check` — 22×22, radio `--sp-r-checkbox` 6, borde `--sp-bw-accent` 1.5
`--sp-line-strong`, marcada `--sp-primary`. Contenedor `min-height: 44px`.
Literal: `El paciente no puede firmar`. **Solo existe en el paso del paciente.**

Al marcarla:
- El lienzo pasa a `opacity: .45` — **se apaga, no se borra**: se ve que dejó de aplicar.
- Aparece `.sp-banner--warn`:
  `Se pasa al familiar responsable, y ahí la firma deja de ser opcional: sin firma del paciente, la del familiar es obligatoria.`

Desmarcarla revierte las dos cosas.

### 5.4 · Omitir

`.sp-btn--ghost` 44 px, `align-self: flex-start`, `white-space: nowrap`, bajo las acciones.
Literal: `Omitir este firmante`.
Presente en familiar, testigo 1 y testigo 2. Ausente en el paciente, y ausente en el
familiar cuando el paciente marcó «no puede firmar».

Nunca a la altura del primario: es una salida legítima, pero no es lo que se espera.

---

## 6 · Foto de identificación

### 6.1 · La pregunta

Llega **después** de confirmar la firma, nunca antes.

| Parte | Valor |
|---|---|
| Card | `.sp-card` con `.sp-icobox` 44 px (`Camera` 22 px) + texto `.sp-body` |
| Texto | `Firma capturada. ¿Se anexa una foto de la identificación?` |
| Botones | `.sp-btn--secondary` `Sin foto` · `.sp-btn--primary` `Tomar foto` (escritorio: `Subir foto`) |

`Sin foto` es una respuesta, no una cancelación.

### 6.2 · Cámara

| Parte | Valor |
|---|---|
| Visor | Relación 3:4, fondo `--sp-bezel` #0f1e30, radio `--sp-r-card` 16 |
| Marco guía | `box-sizing: border-box`, ancho `min(contenedor − 80, 320)`, alto `ancho × 144 / 228`, borde 2 px `rgba(255,255,255,.5)`, radio 10 px, esquinas de 26 px con trazo de 3 px blanco |
| Proporción | **228 × 144 = 1,583** — la caja del anexo del PDF. Lo encuadrado es lo impreso |
| Pie del visor | `Encuadra la identificación dentro del marco · 228 × 144` |
| Disparador | 72×72, círculo, fondo `--sp-primary`, aro 4 px `--sp-line-input` |
| Laterales | `Cancelar` y `Galería`, `.sp-btn--ghost` 44 px |
| Permisos | Se piden **aquí**, con el contexto delante, no al abrir el flujo |

### 6.3 · Escritorio y permiso denegado

Sin cámara, o con permiso denegado: **selector de archivo con el mismo marco de recorte**,
dibujado a tamaño real (228 × 144, 1 px dashed `--sp-line-dash`, radio 10, fondo
`--sp-surface`) dentro de una zona `1px dashed --sp-line-dash`, radio 16, padding 28.

Texto: `Arrastra la foto de la identificación o elige un archivo. Se recorta a la proporción del anexo del PDF.`
Botón `.sp-btn--primary` `Elegir archivo` + `.sp-btn--ghost` `Sin foto`.

Si tampoco hay archivo, se sigue sin foto. **La foto no bloquea en ninguna de sus ramas.**
Subir desde galería es aceptable: la foto es una reproducción de la identificación para
cotejar la firma autógrafa impresa, no una prueba de presencia. La prueba de presencia es
la firma capturada.

---

## 7 · Resumen y sellado

### 7.1 · Resumen

Título propio: `Revisión antes de sellar`. Badge: `4 de 4 resueltos`.
Subtítulo: `Revisa antes de imprimir. Puedes rehacer cualquier firma.`

Una fila `.sp-row` por firmante (radio `--sp-r-field-sm` 9, padding 12/14):
icobox de 34–38 px con `Check` `--sp-success` sobre `--sp-success-bg-alt` si firmó, o
guion `--sp-ink-icon` sobre `--sp-surface-muted` si se omitió; nombre en 14.5/700; estado
en `.sp-hint`; botón `Rehacer` `.sp-btn--compact` 44 px.

Estados de la línea: `Firmó · con foto de identificación` · `Firmó · sin foto` ·
`Omitido` · `No pudo firmar`.
Sin nombre capturado, se muestra solo el rol.

`Rehacer` vuelve a ese firmante **sin deshacer los demás**.

Primario: `.sp-btn--primary-block` `Imprimir consentimiento`.

### 7.2 · Advertencia previa — el punto de no retorno

`ModalShell`, `--sp-modal-w-decide` 620 px.

| Parte | Contenido |
|---|---|
| Título | `¿Sellar y firmar el consentimiento?` |
| Cuerpo | `.sp-banner--danger`: `Al sellar, el documento queda firmado, se guarda en el expediente y se registra su huella. Después ya no se puede editar: ni el texto, ni las firmas, ni las fotos. Si algo está mal, corrígelo ahora.` |
| Botones | `.sp-btn--ghost` `Revisar otra vez` · `.sp-btn--primary` `Sellar e imprimir` |

El primario dice **sellar**, que es el acto; imprimir es lo que ocurre después.
El secundario nombra lo que pasa al pulsarlo, no dice «Cancelar».

Tras sellar: el documento se guarda solo, sale la notificación del sistema, y el modal
posterior (spec 03) muestra `guardadoEnExpediente = 'ok'` **sin acción de anexar**.

---

## 8 · Trazabilidad

Se guarda por **cada firma**: trazo · sello de tiempo del **dispositivo** (momento del
trazo) · sello del **servidor** al sincronizar, con la discrepancia registrada si la hay ·
quién firmó y en qué calidad · dispositivo · **huella del documento en ese instante**.
Del documento: quién lo creó, quién lo firmó, quién lo selló y quién ha accedido.

**El registro no se diseña aquí.** Lo visible es solo esto:

| Pantalla | Qué enseña |
|---|---|
| Capturar la firma | **Nada.** Ni hora ni dispositivo |
| Resumen previo | Solo el desenlace de cada firmante; todavía no hay sello |
| Consultar el documento sellado | Sello de tiempo por firma con segundos, calidad, si hay foto anexa, y la línea de sellado del documento |
| Lista de documentos | Badge `Sellado` y fecha. Los borradores, solo los propios |
| Registro de accesos | **Ninguna pantalla del médico** |

### 8.1 · Card de consulta

Card `.sp-card` sin un solo campo editable — lo sellado se lee, no se toca.
Cabecera con icobox del tipo + título + `.sp-badge` verde `Sellado` (icono `Lock` 13 px).
Una fila por firmante, separadas por `1px solid var(--sp-line-divider)`:

- `Paciente · Marisol Zamora` / `Firmó el 9 de agosto de 2026, 12:43:07 · con foto de identificación`
- `Testigo 1` / `Omitido`

Pie: `Sellado el {fecha}, {hh:mm:ss} · huella del documento registrada` en `.sp-hint`, y
`.sp-btn--primary-block` `Visualizar`.

Cada firma con **su** sello, no el del documento: se firmó en momentos distintos y esa
diferencia es parte de la evidencia.

### 8.2 · En el papel (propuesta, pendiente de visto bueno)

**Pie de cada celda de firma**, bajo la calidad del firmante, a 2 pt de ella:
7 pt, gris de cuerpo, formato `dd/mm/aaaa hh:mm:ss`.
`Firmado 09/08/2026 12:43:07 · con identificación anexa`
Coste vertical: 11 pt por celda → 22 pt en la hoja de firmas.

**Cierre de la última hoja firmada**, sobre filete gris, dos líneas de 7 pt:
`Documento sellado el 09/08/2026 12:47:19 · 4 firmantes previstos, 2 firmaron, 2 omitidos`
`Huella SHA-256 · 3f9a…8c41 · verificable en el expediente electrónico`

**Sin QR**: pertenece al sistema del enlace, que se decide aparte.

---

## 9 · Retomar un borrador

### 9.1 · En la lista

| Documento | Borde | Badge | Línea de estado |
|---|---|---|---|
| Sellado | 1 px `--sp-line-soft` | verde `Sellado` (`--sp-success-bg-alt` / `--sp-success-strong`) | `Emitido el {fecha} · firmado por {n}` |
| Borrador | **1 px dashed `--sp-line-dash`**, fondo `--sp-surface-sunken` | ámbar `Borrador` (`--sp-warn-bg-badge` / `--sp-warn`) | `Tu borrador · guardado el {fecha}, sin firmar` |

Tres señales, no una. El borrador **no ofrece «Visualizar»**: no hay PDF.

### 9.2 · Al abrirlo

La **misma pantalla del formulario**, no una vista aparte: editar y firmar son la misma
tarea sin terminar.

- Banner arriba: `.sp-banner--warn` —
  `Borrador guardado el {fecha}. Sigue editándolo o continúa con el firmado; nada se ha emitido todavía.`
- El formulario con todo lo que se llenó, editable.
- Los tres botones de §1, con el primario en `Continuar firmado`.

### 9.3 · Ya hay un borrador de este paciente

`ModalShell`, `--sp-modal-w-decide` 620 px, al pulsar «Consentimiento» en un paciente que
ya tiene borrador **propio**.

| Parte | Contenido |
|---|---|
| Título | `{Nombre} ya tiene un consentimiento a medias` |
| Cuerpo | `Solo puedes tener un borrador de consentimiento por paciente. Este es tuyo:` + fila punteada con **procedimiento** y `Guardado el {fecha} · sin firmar` + `.sp-hint`: `Si lo reemplazas, se pierde lo que tenía escrito. No se puede deshacer.` |
| Botones | `.sp-btn--ghost` `Reemplazarlo` · `.sp-btn--primary` `Retomar el borrador` |

Retomar es el primario: casi siempre es el mismo procedimiento y lo que el médico quiere es
seguir. Nombra el procedimiento, no solo la fecha: al no caducar, el diálogo puede aparecer
meses después.

---

## 10 · Anchos

| Contenedor | Cabecera | Lienzo | Acciones | Marco de foto |
|---|---|---|---|---|
| 358 | Título 18 px, badge `1/4` | 240 px | apiladas, primario arriba | 278 × 176 |
| 788 | Título 20 px, badge largo | 280 px | en fila, primario `flex:1` | 320 × 202 |
| 860 | igual | 280 px | igual | 320 × 202 |
| 896 | igual | 280 px | igual | 320 × 202 |

El móvil es el caso principal: es donde se firma con el dedo.

---

## 11 · Decisiones, una línea cada una

- **Modo a pantalla completa y no ruta ni modal** — hay que llevarse un formulario sin guardar, y un modal se cierra tocando fuera.
- **Cuatro segmentos de progreso siempre** — omitir resuelve un paso, no lo elimina.
- **La foto después de la firma** — preguntar por la identificación de quien aún no firmó es preguntar dos veces.
- **«No puede firmar» apaga el lienzo en vez de ocultarlo** — se ve que dejó de aplicar.
- **El aviso de que el familiar pasa a obligatorio sale al marcar la casilla** — es la única casilla que altera los pasos siguientes.
- **Marco con la proporción del anexo** — lo encuadrado es lo impreso, sin recortes posteriores.
- **La foto nunca bloquea** — es cotejo, no prueba de presencia.
- **El primario dice «sellar»** — un botón que dice imprimir no comunica un punto de no retorno.
- **Los sellos se ven al consultar, no al firmar** — al firmar estorban; después son la evidencia.
- **Borrador por paciente y por médico** — dos médicos de la misma cuenta no se pisan.

---

## 12 · NO DEFINIDO

| Ref | Qué falta |
|---|---|
| §8.2 | **Visto bueno a la ubicación y el formato de los sellos impresos**, antes de tocar la lámina. Y si la huella abreviada de 8 caracteres basta en papel o hay que imprimirla entera. |
| Legal | **Si el consentimiento anterior se marca como anulado.** Rehacer tras sellar no existe: se emite uno nuevo (regla de inmutabilidad de los ocho). Falta decidir si el primero se marca y el nuevo lo referencia, o si conviven sin marca y manda la fecha. Es decisión clínico-legal. Consecuencia: la lista necesitaría un tercer estado además de `Sellado` y `Borrador`. |


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
