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
| Contador | `.sp-badge` a la derecha. ≥380: `Firmante {n} de {N}` / `{N} de {N} resueltos`. **XS: `{n}/{N}` y `{N}/{N}`** — con el texto largo, el título se trunca a 358 px |

### 3.2 · Progreso

`.sp-progress` — etiqueta `FIRMANTES` `--sp-fs-badge` 12 / `--sp-fw-bold` / `--sp-ink-350`;
pista `flex:1` con **un segmento por firmante real** de 7 px (6 px en XS), `gap: 6px`,
radio 4 px. Hechos y actual: `--sp-primary`. Pendientes: `--sp-primary-track`.

**Tantos segmentos como firmantes pida el flujo**, que son entre 1 y 4 (§4).

Decía «cuatro siempre», y eso valía cuando se podía omitir DENTRO del flujo: omitir
resolvía un paso sin eliminarlo, y un progreso que encogiera a media firma habría mentido
sobre cuánto quedaba. Ahora quiénes firman se decide ANTES de entrar, con los nombres, así
que la cuenta no puede cambiar en marcha — y enseñar cuatro cuando solo se piden dos sería
la mentira contraria.

---

## 4 · Quiénes firman, y en qué orden

> **El flujo pide firma únicamente a los firmantes cuyo NOMBRE está lleno.** Una firma sin
> nombre no acredita a nadie, y el papel acabaría con un trazo que no se puede atribuir.

Por eso **no hay botón de omitir**: dejar el nombre vacío ya es la forma de omitir a
alguien, y dos maneras de decir lo mismo es una de más. Quien no tiene nombre no aparece
en el flujo, ni en el progreso, ni en el resumen.

| Orden | Firmante | Entra cuando |
|---|---|---|
| 1 | **Paciente** | **Siempre.** Su nombre es obligatorio en el formulario |
| 2 | **Familiar o responsable** | Si tiene nombre. **Obligatorio** si el paciente no puede firmar |
| 3 | **Testigo 1** | Si tiene nombre |
| 4 | **Testigo 2** | Si tiene nombre |

**El mínimo real es UN firmante: el paciente.** Un consentimiento firmado solo por él —sin
familiar y sin testigos— es válido y se emite igual.

**El paciente es la excepción y no se toca.** Entra aunque no vaya a firmar, porque su
ausencia del papel no es «no está» sino «no pudo firmar», que es un hecho distinto y hay
que registrarlo. Eso se declara con la casilla de §5.3.

Tras cada firma capturada: **pregunta de foto**. Solo a quien firmó.

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
| Trazo | Negro literal, `stroke-linecap: round`. **Este grosor es solo el de la pantalla; el impreso se declara aparte: §5.5.3** | — |

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

### 5.3 · «No puede firmar» — vive en el FORMULARIO, no aquí

`.sp-check` — 22×22, radio `--sp-r-checkbox` 6, borde `--sp-bw-accent` 1.5
`--sp-line-strong`, marcada `--sp-primary`. Contenedor `min-height: 44px`.
Literal: `El paciente no puede firmar`.

**Va en el formulario, bajo el campo del familiar responsable**, no en el paso de captura.
Dos razones, y la primera es de flujo:

- **Marcarla vuelve obligatorio el NOMBRE del familiar**, porque pasa a ser quien
  consiente. Ese nombre hay que reclamarlo **antes** de iniciar el firmado: descubrirlo a
  media captura deja al médico rellenando la ficha con el paciente y el dispositivo
  delante, o con una firma ya capturada que habría que tirar al salir.
- Es un **hecho clínico que el médico ya conoce** antes de entregar el dispositivo
  —inconsciencia, minoría de edad, imposibilidad física—, no algo que se averigüe al ver
  el lienzo.

Va pegada al campo que vuelve obligatorio, no con las autorizaciones: la relación entre la
casilla y el asterisco de arriba tiene que verse de un vistazo. En **denegación** no se
muestra — esa hoja no tiene flujo de firmado.

En el paso del paciente, con la casilla marcada:
- El lienzo pasa a `opacity: .45` — **se apaga, no se borra**: se ve que dejó de aplicar.
- Aparece `.sp-banner--warn` haciéndolo constar y diciendo cómo revertirlo (salir y
  desmarcar), y el primario dice `Continuar sin firma del paciente`.

### 5.4 · Omitir — RETIRADO

**No existe.** Lo sustituye no llenar el nombre (§4).

Existió como `.sp-btn--ghost` bajo las acciones, en familiar y los dos testigos. Se retiró
al decidir que solo firma quien tiene nombre: con esa regla, omitir pasaba a ser una
segunda forma de decir exactamente lo mismo, y además la única que dejaba pasar una firma
en blanco atribuida a un nombre escrito.

El paciente nunca lo tuvo, y sigue sin tenerlo: su ausencia se declara con la casilla de
§5.3, que dice algo distinto.

### 5.5 · Cómo se captura y qué se guarda

**El trazo se guarda como IMAGEN, no como lista de puntos.** La migración
`20260813_firmas_documento.sql` ya lo impone:
`trazo ~ '^data:image/(png|jpeg);base64,' AND length(trazo) BETWEEN 100 AND 300000`.

Dos razones, y ninguna es de comodidad:

- **La firma del médico ya es una imagen** —un archivo del bucket `firmas-medicos`— y es la
  que lleva peso legal en todo lo que se emite hoy. Con puntos, el mismo papel llevaría dos
  tipos de firma con dos tratamientos distintos, sin ganar nada.
- **Lo que se coteja es la FORMA del trazo** contra la de la identificación anexa, y una
  imagen a resolución suficiente la muestra igual de bien. Los puntos solo aportarían la
  dinámica —velocidad, presión, orden—, y eso es firma biométrica: otra liga.

#### 5.5.1 · La celda impresa, de donde salen todos los números

De `ConsentimientoInformadoPdf.tsx`: página LETTER (612 pt) con `paddingHorizontal: 50`
→ 512 pt de contenido; `FirmaBox` al **48 %** → **245,76 pt**, con **48 pt** de alto libre
sobre la línea de firma.

| Magnitud | Valor |
|---|---|
| Celda impresa | 245,76 × 48 pt = **86,7 × 16,9 mm** |
| Proporción de la celda | **5,12 : 1** |
| Milímetro por punto | 0,352778 |

**Si `FirmaBox` cambia de tamaño, esta sección entera hay que rehacerla** — y los DOS ejes
cuentan: de los 245,76 pt salen los 1024 px canónicos y de los 48 pt salen los 200, que son
los que de verdad gobiernan el grosor impreso (§5.5.4).

#### 5.5.2 · Los DOS espacios, y cuál de ellos se imprime

> ⚠ **Reescrita el 2026-08-12.** La versión anterior de §5.5.2 y §5.5.3 declaraba el grosor
> en píxeles del mapa de bits de captura y afirmaba que así el milímetro impreso quedaba
> constante. **Era falso**, y la medición sobre PDF reales lo destapó: el mismo código daba
> 1,264 mm en un iPad y 0,262 mm en un Samsung, y ni siquiera el mismo valor para dos
> personas firmando en el mismo aparato. La causa está en §5.5.4.

Hay **dos espacios con dos grosores**, y confundirlos fue el defecto:

| | Tamaño | Trazo | Para qué |
|---|---|---|---|
| **Captura** | 1024 px de ancho × `round(1024 × alto_css ÷ ancho_css)` | **7 px** | Lo que el paciente ve mientras firma. **No se imprime** |
| **Canónico** | **1024 × 200 px** | **6 px** | La celda impresa a 300 dpi. **Es lo único que sale en el papel** |

**La captura sigue siendo 1024 px de ancho, fija y explícitamente NO `devicePixelRatio`**:
el teléfono suele traer dpr 3 y el iPad dpr 2, así que atar el mapa de bits al dispositivo
produciría dos archivos distintos, con distinto detalle y distinto peso, del mismo gesto.
Las coordenadas del puntero se multiplican por `1024 ÷ ancho_css`. Formato **PNG con alfa**:
no JPEG, porque la firma se apoya sobre la línea impresa.

**El canónico sale de la celda a 300 dpi, y por sus DOS ejes:**

```
ancho   245,76 pt ÷ 72 × 300 dpi = 1024 px
alto     48,00 pt ÷ 72 × 300 dpi =  200 px
```

El alto es el que manda, por lo que explica §5.5.4. Y no es un número nuevo en el proyecto:
**`FirmaCaptura.tsx` normaliza la rúbrica del médico a ese mismo alto de 200 px desde
siempre**, y por eso su rúbrica es lo único del documento que imprime igual en todas partes.
Esto le da a la firma capturada la normalización que la del médico ya tenía.

#### 5.5.3 · Grosor: 6 px canónicos = 0,508 mm impresos

`6 ÷ 300 dpi × 25,4 = **0,508 mm**`, y no depende de nada más.

**De dónde sale el 6.** De medir la rúbrica del médico, que es el patrón que el lector tiene
al lado en la misma hoja: **6,08 px** en su espacio de 200 px de alto, o sea 0,515 mm
impresos. La diferencia con estos 6 px es del 1,4 %, invisible.

**No sale de los «0,6 mm» que declaraba la versión anterior.** Aquel número se calculó
suponiendo que la firma cruzaba los 86,7 mm de la celda —«1024 px ↔ 86,7 mm, luego 1 px =
0,0847 mm»— y el recorte de §5.5.4 garantiza que no los cruce nunca: las firmas reales
imprimen entre 13 y 54 mm de ancho. Sobre una firma de 29 mm, 0,66 mm de trazo se leen como
un rotulador.

**Y la frase «varía en pantalla para no variar en el papel» decía exactamente lo contrario
de la verdad.** Con el recorte más `contain`, la relación grosor/firma del papel **es
idéntica** a la de la pantalla: el papel reproduce fielmente lo que se ve. Por eso el
grosor de captura de §5.5.2 ya solo gobierna la pantalla.

Consecuencia aceptada: el trazo en pantalla no pesa exactamente lo que pesará en el papel,
y la diferencia cambia con el aparato. Es preferible a la alternativa —adaptar el grosor en
vivo al alto que lleve la firma—, que haría que el trazo cambiara de grueso mientras el
paciente lo está dibujando.

#### 5.5.4 · El recorte a la tinta, y por qué obliga a un espacio canónico

El lienzo en pantalla va de **1,33 : 1** (XS) a **2,7 : 1** (788). La celda impresa es
**5,12 : 1**. Si la imagen entera se metiera en la celda respetando su proporción, mandaría
el alto: aterrizaría a 48 pt de alto y entre 64 y 130 pt de ancho —el 26–53 % de la celda—.

**Así que la exportación recorta a la caja envolvente de la tinta**, y además es lo natural:
en papel una firma ocupa lo que ocupa, no lo que medía el lienzo donde se trazó.

> ⚠ **Y eso deja la colocación LIMITADA POR EL ALTO, que es de donde salía el defecto.**
> Toda firma recortada tiene proporción menor que 5,12, así que `objectFit: contain` la
> ajusta por el alto y de ahí sale, exacta:
>
> ```
> dpi impresos = 1,5 × (alto de la tinta en píxeles)
> grosor       = trazo_px ÷ dpi
> ```
>
> Con el trazo declarado en el espacio de captura, el grosor impreso pasaba a depender de
> cuántos píxeles de alto ocupara cada firma — que cambia con la proporción del lienzo de
> cada aparato y con cómo firme cada persona. Verificado contra los cuatro casos medidos:
> tinta de 180 px → 270 dpi; de 178 → 267; de 411 → 617; de 623 → 934.

**La salida es redibujar, no reescalar.** Reescalar el recorte a un alto fijo no arregla
nada: mueve el trazo y la firma en la misma proporción, así que el alto se cancela y el
grosor relativo queda igual. Y además interpolar no crea detalle.

**La exportación conserva las muestras del puntero y las REDIBUJA en el canónico**, con un
`contain` de la tinta en 1024 × 200. La imagen sale **o exactamente 1024 de ancho o
exactamente 200 de alto**, así que `FirmaBox` la coloca siempre a 300 dpi:

| Caso | Manda | Resultado | dpi |
|---|---|---|---|
| Firma normal (proporción < 5,12) | el alto | alto = 200 | `200 ÷ (48÷72)` = **300** |
| Firma muy plana (proporción > 5,12) | el ancho | ancho = 1024 | `1024 ÷ (245,76÷72)` = **300** |

Un solo `min` cubre los dos extremos, sin ramas. Redibujar además **esquiva la
interpolación**: la firma se rasteriza de nuevo a 300 dpi desde las muestras, con su
precisión subpíxel intacta.

| Parte | Valor |
|---|---|
| Recorte | caja envolvente del recorrido del puntero |
| Margen | `GROSOR_CANONICO / 2 + 2 px`, para que el remate redondo no salga cortado |
| Muestras | filtradas a **0,6 px canónicos** de distancia mínima — ver abajo |
| Lienzo sin tinta | no se exporta: sin trazo no hay firma, y quien no firmó no tiene fila |

**El umbral de distancia mínima.** El lápiz del iPad muestrea unas 240 veces por segundo y
el navegador entrega todas esas muestras en `getCoalescedEvents`. Firmando despacio, dos
muestras caen a menos de un píxel y cada una dibuja un segmento con sus remates redondos
sobre el anterior. La tinta es opaca, así que el interior no engorda —pero el borde
suavizado sí, hasta saturar—. Medido componiendo trazos uno a uno: 7,64 px con muestras a
6,5 px de paso, 8,00 px a 0,25 px. Un **+4,7 %** que aparece solo en el aparato que más
muestrea. 0,6 px es la décima parte del trazo; la curva más fina de una firma mide unos
4 px canónicos, muy por encima.

> ⚠ **Las muestras son TRANSITORIAS y no contradicen §5.5.** Lo que se GUARDA sigue siendo
> una imagen: viven en memoria mientras dura la captura y mueren con el paso. La decisión de
> §5.5 es sobre qué se almacena y con qué se coteja, no sobre cómo se rasteriza.

#### 5.5.5 · El presupuesto son 300 000 CARACTERES, no 300 KB

`length()` mide caracteres del data-URL, no bytes de imagen. Base64 son 4 caracteres por
cada 3 bytes, y el prefijo `data:image/png;base64,` son 22 caracteres:

`(300 000 − 22) × ¾ = 224 983 bytes ≈ **219 KiB** de PNG como máximo.`

**Con el canónico acotado en 1024 × 200, es inalcanzable.** Medido sobre PNG con trazo real:
una firma normal ocupa unos **7 100 caracteres** y una densísima **16 600** — el 2 % y el
6 % del tope.

**El respaldo de reexportar a 768 px se RETIRÓ.** Antes, pasarse del presupuesto disparaba
una segunda exportación más pequeña; con el canónico eso no puede ocurrir, y un camino
muerto que nadie recorre solo sugiere un riesgo que ya no existe. La comprobación de
longitud se conserva como **guardia de fallo ruidoso**: si alguna vez se rebasara, algo
estaría muy mal y degradar la firma en silencio no lo arreglaría.

#### 5.5.6 · Y lo que la base ya impone

`length(trazo) BETWEEN 100 AND 300000` también tiene suelo: **100 caracteres**. Un data-URL
de menos de 100 no es un trazo, es un lienzo en blanco exportado por error. Y `webp` o `svg`
NO entran en el patrón: entrarían en la fila y el documento fallaría al renderizar.

### 5.6 · Orientación, y por qué el trazo no se gira

**El área de captura va a pantalla completa en móvil.** Es el mismo criterio del modo
entero (§2) y por la misma razón: es el único momento en que el dispositivo cambia de
manos, así que tapar el resto de la aplicación es una función, no un efecto colateral —el
paciente no debe poder llegar al expediente.

| Regla | Valor |
|---|---|
| Aviso de girar | En vertical, y **NO BLOQUEA**: el área está activa detrás y se puede firmar igual |
| Al girar | El área se rehace y el aviso desaparece solo |
| En tablet | **No aparece nunca** |
| Forzar la rotación | **No se intenta.** `screen.orientation.lock()` exige pantalla completa real y en iOS no está disponible |

**El trazo NO se gira para aprovechar la pantalla vertical.** Una firma es memoria muscular:
firmar de lado obliga a girar la muñeca y produce un trazo que no se parece al de la
identificación anexa, que es contra lo que hay que poder cotejarla. Se pierde ancho útil;
se conserva lo único que hace que la firma sirva.

> ⚠ **El área solo se rehace mientras esté VACÍA.** Con tinta dentro, girar no rehace nada:
> se conserva el mapa de bits y su proporción. Es consecuencia directa de guardar imagen y
> no puntos —sin los puntos no hay nada que volver a dibujar en una caja de otra
> proporción—, así que rehacer con tinta dentro solo podría deformar la firma o perderla.
> Rehacer estando vacía es gratis; con tinta dentro, nunca.

---

## 6 · Foto de identificación

> ### ⚠ Actualización 2026-08-12 — captura NATIVA. §6.2 y §6.3 describen un sistema retirado
>
> La captura con `getUserMedia` —el visor de §6.2, el marco en vivo, el selector
> de cámaras y la rama de permiso denegado de §6.3— **se retiró**: en iPad y
> Android `getUserMedia` rechazaba con `NotAllowedError` sin llegar a enseñar el
> diálogo de permiso, a través de cinco intentos de corrección de la política de
> permisos. La sustituye, auditada y verificada en dispositivo:
>
> - **Campo de archivo nativo con dos entradas**: `Tomar foto` (con
>   `capture="environment"`, abre la cámara del sistema) y `Elegir archivo`
>   (sin él, abre el selector). Dos porque `capture` fuerza la cámara y suprime
>   la galería, y la galería es aceptable (§6.3). No pasa por `getUserMedia` ni
>   por `Permissions-Policy`, y verificado: no deja copia en la galería del
>   dispositivo.
> - **Recorte posterior** (react-easy-crop) con la proporción fija de la caja
>   del anexo —228 × 144—, arrastrando y con zoom sobre la imagen quieta. Lo que
>   encierra el rectángulo es lo que se sube: la mesa y los dedos no salen del
>   dispositivo. Con aviso en pantalla si el recorte queda por debajo de los
>   950 px que la caja impresa necesita a 300 dpi.
>
> **Desviación declarada y aceptada:** la cámara EN VIVO de escritorio se
> pierde — `capture` se ignora ahí y los dos botones abren el selector de
> archivo. Una cámara web apuntando a la mesa nunca fue buen instrumento para
> una credencial; el caso principal es el móvil, como declara §10.
>
> Siguen vigentes de esta sección: la pregunta de §6.1 tras confirmar cada
> firma, que `Sin foto` es una respuesta y no una cancelación, y que **la foto
> no bloquea en ninguna de sus ramas**.

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

Título propio: `Revisión antes de sellar`. Badge: `{N} de {N} resueltos`.
Subtítulo: `Revisa antes de imprimir. Puedes rehacer cualquier firma.`

Una fila `.sp-row` **por firmante del flujo** (radio `--sp-r-field-sm` 9, padding 12/14):
icobox de 34–38 px con `Check` `--sp-success` sobre `--sp-success-bg-alt` si firmó, o
guion `--sp-ink-icon` sobre `--sp-surface-muted` si no; nombre en 14.5/700; estado
en `.sp-hint`; botón `Rehacer` `.sp-btn--compact` 44 px.

Estados de la línea: `Firmó · con foto de identificación` · `Firmó · sin foto` ·
`No pudo firmar`.

**`Omitido` ya no existe** como estado, y quien no firma tampoco aparece en la lista: sin
nombre no entró al flujo, así que no hay nada que resolver ni que enseñar. La única línea
sin firma posible es la del paciente que no pudo firmar.

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
- `Familiar responsable · Ana Zamora` / `Firmó el 9 de agosto de 2026, 12:44:51 · sin foto`

**Solo los firmantes del flujo**: quien no tenía nombre no firmó, no tiene fila en
`firmas_documento` y no aparece aquí. La única línea sin hora es la del paciente que no
pudo firmar.

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
`Documento sellado el 09/08/2026 12:47:19 · 2 firmantes previstos, 1 firmó, 1 no firmó`
`Huella SHA-256 · 3f9a…8c41 · verificable en el expediente electrónico`

**«Previstos» son los que PIDIÓ el flujo, no cuatro fijos**: en un consentimiento sin
testigos son dos, y en el mínimo —solo el paciente— es uno. El número no se puede deducir
de las firmas guardadas, así que viaja desde el modo de firmado hasta la lámina.
Singular y plural se resuelven en las tres cifras: `1 firmante previsto, 1 firmó, 0 no
firmaron` es lo que sale en el caso mínimo, y `1 firmantes previstos` en un documento
legal se lee como un descuido.

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
- **Solo firma quien tiene nombre** — una firma sin nombre no acredita a nadie, y el papel acabaría con un trazo que no se puede atribuir.
- **Sin botón de omitir** — dejar el nombre vacío ya es la forma de omitir, y dos maneras de decir lo mismo es una de más.
- **Un segmento de progreso por firmante real** — la cuenta se fija antes de entrar y ya no puede encoger a media firma, así que enseñar cuatro cuando se piden dos sería la mentira contraria.
- **El paciente entra aunque no vaya a firmar** — su ausencia no es «no está» sino «no pudo firmar», y eso hay que registrarlo.
- **La casilla de «no puede firmar» vive en el formulario** — vuelve obligatorio el nombre del familiar, y ese nombre hay que reclamarlo antes de entrar, no con el paciente delante.
- **La foto después de la firma** — preguntar por la identificación de quien aún no firmó es preguntar dos veces.
- **El trazo se guarda como imagen y no como puntos** — la firma del médico ya es una imagen, y lo que se coteja es la forma; los puntos solo aportarían dinámica, que es firma biométrica.
- **1024 px de ancho fijos, y no `devicePixelRatio`** — atar el mapa de bits al dispositivo es lo que hace que el móvil y el iPad guarden firmas distintas del mismo gesto.
- **El grosor impreso se declara en el espacio canónico, no en el de captura** — el recorte deja la colocación limitada por el alto, así que un grosor declarado en píxeles de captura acaba dependiendo de cuánto ocupara cada firma: 4,8× de dispersión medida entre dos aparatos, y ni siquiera constante entre dos personas del mismo.
- **La exportación redibuja, no reescala** — reescalar mueve el trazo y la firma en la misma proporción, así que el alto se cancela y el grosor relativo queda igual; redibujar desde las muestras además no interpola.
- **La exportación recorta a la tinta** — sin recorte la imagen entra por el alto de la celda y la firma aterriza en el 26–53 % de ella; y en papel una firma ocupa lo que ocupa.
- **El aviso de girar no bloquea** — el área está activa detrás; un aviso que impide firmar convierte una molestia en una firma perdida.
- **El trazo no se gira** — firmar de lado obliga a girar la muñeca y el trazo deja de parecerse al de la identificación anexa.
- **«No puede firmar» apaga el lienzo en vez de ocultarlo** — se ve que dejó de aplicar.
- **El asterisco del familiar aparece al marcar la casilla** — es la única casilla del formulario que cambia la validación de otro campo, y esa relación se ve porque están pegados.
- **Marco con la proporción del anexo** — lo encuadrado es lo impreso, sin recortes posteriores.
- **La foto nunca bloquea** — es cotejo, no prueba de presencia.
- **El primario dice «sellar»** — un botón que dice imprimir no comunica un punto de no retorno.
- **Los sellos se ven al consultar, no al firmar** — al firmar estorban; después son la evidencia.
- **Borrador por paciente y por médico** — dos médicos de la misma cuenta no se pisan.

---

## 12 · NO DEFINIDO

| Ref | Qué falta |
|---|---|
| §5.5 · §5.6 | **La guía visual de la captura**, pedida en paralelo y todavía no escrita. Lo de §5.5 y §5.6 son las reglas que ya están decididas —qué se guarda, a qué resolución, con qué grosor y qué pasa al girar—; el cromo del lienzo sigue siendo el de §5.1 hasta que llegue. |
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
