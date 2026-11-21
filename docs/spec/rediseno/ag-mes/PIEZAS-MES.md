# Agenda · piezas del Mes (fase 2)

Complemento de `agenda-base/PIEZAS.md`. Las piezas base (`.ag0-*`: barra, capas, burbuja, fila de lista, chip «todo el día», tokens `--cal-*`) se usan **tal cual**; lo nuevo lleva el prefijo `.am-`. **No hay tokens nuevos**: el Mes se pinta solo con `--cal-*` y los del kit, así que el oscuro sale solo.

- Marco: `class="marco ag0 am ag0-vmN"` (la base actúa en `.ag0`, el Mes en `.am`).
- Regenerar: `sh S/entrega/ag-mes/tmp-build.sh` (ejecuta las funciones de `agenda-base/tmp-gen.py` sin escribir nada allí, genera `vista-1-mes.html` y `vista-2-mas.html`, ensambla y deja `tmp-ver.html`). Capturas y medición: `node S/tools/tmp-am-cap.js` (`VP`, `T`, `OP`, `EST=1`, `MIDE=1`).
- Semilla: la semana 16–22 es la de la base, salvo HOY (jueves 19), aligerado a una carga realista (5 citas + evento de todo el día + bloqueo; 8 con la reserva por enlace); el resto del mes (26 oct – 6 dic) se rellena con el mismo criterio (pasado: atendidas con alguna cancelada / no asistió; futuro: agendadas y confirmadas; juntas los lunes; domingos vacíos) y se añaden los casos que faltaban: evento de varios días (Congreso de ortopedia, 2–4 nov), bloqueo con hora (10 nov), Google por asignar (25 nov), reserva por enlace (26 nov).

## 1. El chip de mes — `.am-ch`

La hermana de una línea del bloque `.ag0-b`. Un solo marcado; el marco decide qué se ve.

```html
<button class="ag0-p am-ch ag0-b--conf [ag0-b--pasado] [ag0-b--lig]" data-cita="…" aria-haspopup="dialog"
        aria-label="Paciente Prueba 22, 10:00 a 10:45, Confirmada, Reservó por enlace">
  <span class="am-ch-i">[icono de estado 12, trazo 2,4]</span>
  <span class="am-ch-h">10:00</span>
  <span class="am-ch-n [am-tach]">Paciente P.</span>
  <span class="am-ch-m">[G 12][enlace 12][carpeta punteada 12]</span>
</button>
```

- **Color**: las clases de estado de la base (`ag0-b--ag/conf/aten/canc/noas`, `ag0-b--ev` + `--b-ev`, `ag0-b--evn`) ponen `--b-fondo` (relleno), `--b-barra` (barra izquierda de 3 px como sombra interior) y `--b-tinta` (icono y hora). Pasado: relleno al 55 % y nombre en `--tinta2` (`ag0-b--pasado`). Por ligar: contorno discontinuo (`ag0-b--lig`). Cancelada: nombre tachado (`am-tach`).
- **Tipografía**: todo 12/16 600; la hora tabular en `--b-tinta` (en un evento, `--tinta2`); el nombre en `--tinta` con «…». **Nada por debajo de 12.**
- **Nombre**: el corto de la base (`corto()`: primer nombre + inicial; un evento conserva su título).
- **Radio 6**, relleno 0·6·0·7, hueco 4 entre piezas.
- **Respuesta**: `:active` escala .97 y relleno 6 % más oscuro; abierto (`aria-expanded="true"`): doble anillo `--sup` + `--cal-sel`.

| | Duo abierto h (`ih`) | Duo abierto v (`iv`) | Computadora (`esc`) |
|---|---|---|---|
| Columna | ≈ 86 px | ≈ 88 px | ≈ 140 px |
| Alto dibujado | 22 | 34 (dos renglones de 16) | 22 |
| Área de toque | 36 (`::after` 7 arriba y abajo) | 44 (`::after` 5) | 36 (`::after` 7) |
| Se ve | icono + hora | icono + hora / nombre corto | icono + hora + nombre corto + marcas |

Variantes:
- **Bloqueo con hora** `.am-ch.am-ch-bq`: rayado entero (`--cal-bloqueo-fondo` + raya 135° de 1,5 cada 9), candado 12, hora y «Bloqueado · motivo» en `--cal-bloqueo-tinta`. En Mes no hay horario que recortar: rayado entero, como hoy. Abre la edición del bloqueo.
- **Todo el día** `.am-ch.am-ch-todo` (evento con `ag0-b--ev`, bloqueo con `am-ch-bq`): icono del tipo + título, sin hora. **Varios días**: un solo chip `.am-ch--span` con `--span:N` que cruza sus N días (ancho = N columnas); los días siguientes guardan el renglón con `.am-ch-ph` invisible; cada lunes se repite. Si el título no cabe, se recorta **por palabras** con «…» al final (nunca a media palabra; el título entero va en `aria-label`).
- **Estirar** (eventResize, solo eventos de todo el día en Mes): asas `.am-asa` de 4×12 en `--b-barra` en los dos extremos (al pasar el ratón; táctil tras mantener pulsado); estirando `.am-ch-est`: contorno discontinuo + `--sombra-capa`, día destino con anillo `--cal-sel`. Sin confirmación; si toca un bloqueo, toast «Este horario está bloqueado…» y vuelve.
- **Arrastrando**: el original queda como fantasma (`am-fant`: contorno discontinuo de la barra, sin contenido); una copia `.am-arr` sigue al dedo con escala 1,03 y `--sombra-capa`; la celda destino lleva `.am-c-obj` (anillo interior de 2 `--cal-sel` y tinte 7 %). Al llegar: `.am-llega` (destello del anillo, 700 ms; sustituye a `dropGlow`).

## 2. La celda de mes — `.am-c`

```html
<div class="am-c am-wdN [am-c-hoy] [am-c-otro] [am-c-sin] [am-c-fin]" role="gridcell" data-o="24">
  <div class="am-ct"><button class="ag0-p am-n" aria-label="Ir al jueves 19 de noviembre">19</button></div>
  <div class="am-l"> …K líneas (.am-ch / .am-mas)… </div>
</div>
```

- **Número** `.am-n`: 13/600 tabular, 22 de alto (24 en `iv`), arriba a la izquierda; lleva al Día (navLinks de hoy). Área 36 (44 en `iv`).
- **Hoy**: celda en `--cal-hoy`; número blanco en círculo `--cal-hoy-num`; cabecera del día de la semana en `--enlace`.
- **Otro mes**: número en `--tinta3`, fondo `--fondo` al 55 % sobre `--sup`; sus citas se ven igual.
- **Fin de semana**: cabecera en `--tinta3`. **Día sin horario** (domingo): celda entera en `--cal-fuera`, como la columna sin consulta de la rejilla.
- **Hueco**: tocar la celda fuera de un chip abre el alta sin hora (en v2, la burbuja de alta «Nueva cita · vie 27»). Se marca la celda con contorno discontinuo `--cal-hueco` y tinte 6 %, y en la fila del número el fantasma `.am-fan` (el de `.ag0-hueco`: discontinuo, relleno 8 %, «+ Nueva cita · vie 27» 12/600 `--enlace`); si el texto no cabe (Duo h) queda solo «+» con `aria-label` «Nueva cita · vie 27». No tapa ninguna cita. Solo en `ih`, `iv`, `esc`.
- **Líneas**: 1 px `--cal-linea` entre columnas y entre semanas; sin borde exterior (la tarjeta `--sup` sin borde ni sombra, radio 16/18/20).
- **Seis semanas** que se reparten el alto (`grid-template-rows: repeat(6, minmax(fila mínima, 1fr))`); si un aviso de página roba alto, las semanas no se aplastan: la rejilla se desplaza por dentro. Fila mínima: 104 (`esc`, `iv`) · 78 (`ih`).
- **Compactar** («Ocultar los días de la semana sin actividad»): la clase `am-comp` en el marco pasa a 6 columnas y oculta `.am-wd6`; sale el aviso «Vista compacta: domingo oculto» + «Mostrar todos los días».

### Regla de cuántos caben

K = líneas por día: **3 en `esc`, 2 en `ih` y `iv`** (K = 4 en `esc` no cabe sin bajar de 12 px ni de 36 de toque: pediría 126 px por semana y la tarjeta da 104). Orden: todo el día primero, luego por hora (citas, eventos y bloqueos con hora).

- Si el día tiene **≤ K** cosas, se ven todas.
- Si tiene **más de K**, se ven **K − 1** y la última línea es **«+N más»** (`.am-mas`: 12/600 `--enlace`, mismo alto y área que un chip; `aria-label` «Mostrar N eventos más», el `moreLinkHint` de hoy). Nunca se gasta una línea en «+1 más» si cabía la cita.

## 3. Mes de teléfono (`ext`, `tel`) — `.am-mini` + `.am-pd`

Hoy (< 1024 px) el Mes es modo punto + panel del día (`VISTAS_FC_MOVIL`, `PanelDelDia.tsx`). Se conserva, redibujado:

- **Mini-rejilla** `.am-mini`: tarjeta `--sup` radio 16; cabecera «L M X J V S D» 12/600; **seis filas fijas** (no cambia de alto al navegar); días de otros meses en blanco. En `ext` la tarjeta sangra 10/12 px (como la tira de la Semana A) para que la celda llegue a 45 px.
- **Día** `.am-d` (botón entero: punto y «+N» incluidos, como hoy con `pointer-events:none`): 45×44 (`ext`) · 51×46 (`tel`); número 15/600 en círculo de 28; hoy relleno `--cal-hoy-num`; **día elegido**: `--fondo` + anillo interior 2 `--cal-sel` (hoy = relleno, elegido = contorno, como hoy).
- **Puntos** `.am-pt` (máx. 3, luego «+N» 12/600 `--tinta2`): 6 px (5 en `ext`) en `--b-barra` del estado; **redondo = cita, cuadrado = evento, cuadrado hueco = bloqueo, G de 10 = Google por asignar** (la forma sobrevive a la ceguera al color).
- **Panel** `.am-pd` («Citas del día seleccionado»): tarjeta `--sup` bajo la mini-rejilla; cabecera pegajosa con «Jue 19 de nov · hoy» 15/700, debajo el conteo 13 `--tinta2` («11 cit · 1 ev», «sin citas») y a la derecha «Ver día ›» 15/600 `--enlace` (área 44). Filas = las de la Semana A de la base (`.ag0-lf`): hora inicio/fin, barra del estado, nombre 15/600, segunda línea 13 (duración, origen, sin expediente, observaciones) y estado en círculo; «Todo el día» con el chip `.ag0-tc`; bloqueo con barra rayada y candado. Vacío: «Sin citas este día».
- Mini-rejilla y panel se desplazan juntos (`.am-desl`); la barra queda fija. En `tel` el panel deja 72 px para la píldora «Agendar».

## 4. Capa «+N más» — `[data-capa="mas"]`

- `esc`: menú anclado SOBRE la celda (sin velo, `transform-origin` arriba a la izquierda, metido en el área de contenido), 340 px, radio 16.
- `ih`, `iv`: tarjeta centrada del catálogo con velo desenfocado, 380 px.
- `ext`, `tel`: no hay capa; «+N» elige el día y el panel ya trae la lista.
- Cabecera: el título es el enlace al Día (`.am-mt`: «Jueves 19 de noviembre» 17/700 + chevron 18 `--enlace`, `aria-label` «Ir al jueves 19 de noviembre») y ✕. Cuerpo desplazable: todo el día y después todas las filas `.ag0-lf` (abren la burbuja).

## 5. Otras piezas usadas en el Mes

- **Alerta de mover** (ConfirmModal): la de ag-form, variante `mov-dia` («¿Es correcto?», «Cancelar» / «Mover»). «Cancelar», el velo y Escape devuelven la cita a su sitio.
- **Aviso emergente** `.am-toast` (toast.error de hoy): arriba y centrado en el área de contenido, `--sup` + `--sombra-capa`, icono en `--mal-tinta`, 14/600; 3,2 s.
- **Barra de carga** `.am-cargab`: 2 px `--accion` pegada arriba del área de contenido, indeterminada; lo de debajo al 55 %. Movimiento reducido: barra fija al 50 %.
- **Avisos de página** (`.ag0-aviso`): error, Google, «Faltan citas por mostrar.» + «Ver por semana» (solo Mes), vacío «Ningún evento de Dr. Admin Semilla en noviembre» (sin botón: en Mes no se ofrece «Ver todos los médicos») y vista compacta.
- **Filtro de médico abierto** (computadora): la lista de ag-herr (`data-capa="medico"`), anclada sin velo; «Todos los médicos — el mes se ve por médico» **apagada, no escondida** (`aria-disabled`, `--tinta3`). En táctiles, lo mismo dentro de «Opciones de la agenda» › Médico.
- **Tarjeta al pasar** («Pop-up de eventos», solo computadora): la burbuja de ag-burbuja, anclada a la cita, a los 500 ms de posar el ratón.

## 6. Movimiento

Capas: las del catálogo de la base (resorte amortiguación 1, respuesta .35 s escrito con `linear()`; salida 200 ms). Arrastre: la copia sigue al puntero 1:1 respetando el punto donde se agarró (umbral 8 px); si no se puede soltar, vuelve a su sitio con resorte desde donde está. Salto al Día: fundido + 10 px con resorte. Panel del teléfono al cambiar de día: fundido + 6 px. Movimiento reducido: fundidos cortos sin escala ni desplazamiento. Transparencia reducida: velo opaco sin desenfoque (base).

## 7. Integración (kit/INTEGRACION.md)

El Mes no dibuja capas propias para lo que ya existe en otra carpeta: usa la **misma capa de integración que Día y 3 días** (`agenda-base/tmp-vistas.py`, sección INTEGRACIÓN: `piezas_reales`, `_barra_int`, `ICSS`, `IJS`, `ABJS`), ejecutada al generar, así que cada regeneración hereda la versión actual de ag-burbuja, ag-form, ag-ligado, ag-herr y cromo. El marco lleva `ab ab-vI{n} af al ah cr4` además de `ag0 am`.

- Los chips, las filas y «+N más» llevan `data-ir="b:{id}"`: los abre el guion de ag-burbuja. Las citas del mes que no son de la semana de muestra llevan su burbuja generada con las mismas funciones (`AB.burbuja`, y `_ligar_tpl` para las por ligar).
- Bloqueos: `data-ir="d-bloqueo"` → «Bloquear horario» en edición (ag-form).
- Hueco: la celda recibe `data-cita="mes"` (el ancla de la plantilla `alta-mes` de ag-burbuja) y se dispara `alta-mes`; el título se pone al día pulsado.
- Arrastrar a domingo: la variante `mov-dia` de las alertas de ag-form, con la hora de la cita.
- Lo que solo es de la maqueta (Día fuera de la semana de muestra, meses sin dibujar, pantallas fuera de la agenda) se dice en la tira, FUERA del marco (`.am-nota`).
