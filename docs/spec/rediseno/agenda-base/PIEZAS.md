# Agenda · piezas base (Fase 1)

Piezas con las que se construyen Día, Semana, Mes, burbuja, formulario, herramientas y configuración. **Úsalas tal cual**: copia el marcado que genera `tmp-gen.py` y el CSS de `tmp-estilo.css` (+ `tmp-nav.css`, la navegación del dashboard renombrada). Si una pieza no te sirve, dilo en tu informe; no la reinterpretes en tu vista.

- Prefijo de clase: `.ag0-…`. En tu carpeta usa tu propio prefijo para lo nuevo, pero **copia las piezas con su clase `ag0-` intacta** (y el bloque de tokens), para que el código de la app las construya una vez.
- Datos: semana del 16 al 22 de noviembre de 2026; hoy jueves 19; son las 17:10; Dr. Admin Semilla, consultorio Centro. Semilla completa en `tmp-gen.py` (`CITAS`, `BLOQUEOS`, `TODO`, `HORARIO`).
- Regenerar: `sh S/entrega/agenda-base/tmp-build.sh` (genera `vista-*.html`, ensambla con `build.py` y deja `tmp-ver.html`). Capturas y medición: `node S/tools/tmp-ag0-cap.js` (variables `VP`, `T`, `OP`, `EST=1`, `MIDE=1`).

## 1. Tokens `--cal-*`

Viven en `.ag0.marco` (en la app, en `:root` junto al kit). Casi todos son mezclas o alias de tokens del kit, así que el oscuro sale solo; **solo los 6 colores de evento son literales y llevan valor de oscuro**.

| Token | Valor | Uso |
|---|---|---|
| `--cal-ag-fondo / -barra / -tinta` | `--ag-fondo` 78 % sobre `--sup` · `--ag-punto` · `--ag-tinta` | Agendada |
| `--cal-conf-…` | `--tonal` 78 % · `--accion` · `--tonal-tinta` | Confirmada |
| `--cal-aten-…` | `--ok-fondo` 78 % · `--ok-tinta` 82 % · `--ok-tinta` | Atendida |
| `--cal-canc-…` | `--mal-fondo` 55 % · `--mal-tinta` · `--mal-tinta` | Cancelada |
| `--cal-noas-…` | `--sup2` 70 % · `--tinta3` · `--tinta2` | No asistió |
| `--cal-ev-indigo…grafito` | `#3730a3 #a21caf #9d174d #4d7c0f #78350f #1f2937` / oscuro `#818cf8 #e879f9 #f391ca #a3e635 #c98a4b #7f96b8` | color que elige el usuario para un evento (`COLORES_EVENTO`) |
| `--cal-bloqueo-fondo / -raya / -tinta` | `--tinta2` al 5 % · al 20 % · `--tinta2` | bloqueo |
| `--cal-fuera` | `--fondo` | fuera de horario |
| `--cal-linea` | `--linea` | líneas de hora y de columna |
| `--cal-hoy` · `--cal-hoy-num` | `--accion` al 5 % · `--accion` | columna y número de hoy |
| `--cal-ahora` | `--mes` | hora actual |
| `--cal-hueco` · `--cal-sel` | `--accion` | hueco pulsado · anillo de selección |

Regla de uso en el bloque: `--b-fondo` = relleno, `--b-barra` = barra izquierda de 3 px (gráfico ≥ 3:1), `--b-tinta` = hora e icono de estado (texto ≥ 4,5:1). El nombre siempre en `--tinta` (en `--tinta2` si está pasado o cancelado). Contrastes medidos en `vista-6-color.html` (todos cumplen en claro y oscuro).

Medidas como variables: `--cal-h` (alto de hora) = **80 px en los cinco marcos**, 48 px con «Densidad compacta» (clase `ag0-densa-m` en el marco o `ag0-densa` en `.ag0-cal`); `--cal-hw` (columna de horas) = 44 `ext`/`tel` · 52 `ih`/`iv` · 56 `esc`.

## 2. El bloque — `.ag0-b`

Marcado único (función `bloque(c)` en `tmp-gen.py`). Todos los hijos se montan siempre; el CSS decide cuáles se ven:

```html
<button class="ag0-p ag0-b ag0-d30 ag0-b--conf [ag0-b--lig] [ag0-b--pasado] [ag0-b--curso] [ag0-b--solA|B]"
        style="top:calc(var(--cal-h) * 10.5 + 1px);height:calc(var(--cal-h) * .5 - 2px)" data-cita="…" aria-haspopup="dialog"
        aria-label="Paciente Prueba 07, 17:00 a 17:30, Confirmada, Reservó por enlace">
  <span class="ag0-b-in">
    <span class="ag0-b-l1"><span class="ag0-b-ico">[icono estado 13]</span><span class="ag0-b-nom">Nombre</span><span class="ag0-b-mar">[G][enlace][sin exp.]</span></span>
    <span class="ag0-b-l2"><span class="ag0-b-hora">17:00 – 17:30</span>[<span class="ag0-b-curso">En curso</span>]<span class="ag0-b-ot">Reservó por enlace</span><span class="ag0-b-sx">Sin expediente</span><span class="ag0-b-cons">Centro</span><span class="ag0-b-tel">999 000 0007</span></span>
    <span class="ag0-b-obs">Observaciones</span>
    <span class="ag0-b-chip"><i>[icono 12]</i><span>Confirmada</span></span>
  </span><span class="ag0-b-asa"></span>
</button>
```

- **Tipo / estado** (una clase): `ag0-b--ag`, `--conf`, `--aten`, `--canc`, `--noas`; evento con color: `ag0-b--ev` + `style="--b-ev:var(--cal-ev-indigo)"`; evento sin color: clase de su estado + `ag0-b--evn` (hora en neutro). En un evento, `.ag0-b-ico` lleva el icono del evento (clase extra `ag0-b-evi`) y no hay `.ag0-b-chip`.
- **Duración** (una clase): `ag0-d15` (≤ 22 min) · `ag0-d30` (≤ 37) · `ag0-d45` (≤ 52) · `ag0-d60` (≤ 82) · `ag0-d90` (más).
- **Ancho**: el bloque es `container-type: inline-size`; las reglas cambian a < 60 px (mínima), 60–199 (estrecha, Semana), 200–379 (media, Día en teléfono) y ≥ 380 (ancha).
- **Posición**: `top = (inicio − 7) × --cal-h + 1px`, `height = duración × --cal-h − 2px`; `left: 2px; right: 3px` (solapados: `ag0-b--solA` deja la mitad derecha, `--solB` la izquierda).

### La regla de contenido (qué se omite primero)

| Duración · alto | Estrecha (Semana) | Media y ancha (Día) |
|---|---|---|
| 15 min · 18 px · 1 línea | icono + nombre (…) | nombre · hora … estado en texto (media: icono delante, sin texto de estado). Lo que no cabe salta a una segunda línea oculta: primero se va el estado, luego la hora |
| 30 min · 38 px · 2 líneas | icono + nombre en 2 líneas + marcas de origen (iconos) | nombre + estado (círculo 18 + texto; media solo círculo) / hora · origen · sin expediente · consultorio · teléfono (media sin teléfono) |
| 45 min · 58 px · 3 | + hora inicio–fin | + observaciones en 1 línea |
| 60 min · 78 px · 4 | + consultorio | igual |
| 90+ min | + observaciones (2 líneas) | + observaciones (2 líneas) |
| columna < 60 px | solo color + icono de estado | — |

Orden de omisión: **observaciones → teléfono → consultorio → hora → marcas de origen → se acorta el nombre**. Nunca se omiten el icono de estado (el color nunca es la única señal) ni el nombre. La segunda línea ancha está escrita en ese orden: si se corta con «…», cae lo menos importante. **Nada por debajo de 12 px**: si no cabe, se omite.

Tipografía: nombre 13/16 600 (ancha 14/18 600) · hora 12/16 600 tabular en `--b-tinta` (en evento, `--tinta2`) · resto 12/16 400 `--tinta2` · estado 12/16 600 · icono de estado 13 px trazo 2,4 · círculo de estado 18 px. Radio 8 (6 en 15 min); barra izquierda 3 px como sombra interior. Relleno: estrecha 2·5·2·8, ancha 3·6·3·10.

### Variantes

Datos opcionales del bloque: `.ag0-b-med` (iniciales del médico, chip 18×16 12/700 sobre `--sup`, solo con «Todos los médicos», como `doctorInitial` de hoy; oculto en la columna mínima) y `.ag0-b-tz` («11:00 hora Quintana Roo», solo en media y ancha, justo detrás de la hora).

`ag0-b--lig` (por ligar: reserva por enlace o Google por asignar; contorno discontinuo 1,5 px = «sin expediente») · `ag0-b--pasado` (relleno al 55 %, nombre `--tinta2`) · `ag0-b--canc` (nombre tachado) · `ag0-b--curso` (contorno 1,5 px del estado + «En curso» en la fila ancha) · `ag0-b--sel` o `aria-expanded="true"` (doble anillo 2 `--sup` + 2 `--cal-sel`, asa visible) · `ag0-b--puls` / `:active` (escala .97, relleno 6 % más oscuro) · `ag0-b--arr` (escala 1,03 + `--sombra-capa`) con un `ag0-b--fant` en el sitio de origen · `ag0-b--est` (asa 22×4 abajo, hora de fin en vivo) · `ag0-b--solA/B`.

### Toque

Todo el bloque es el botón. En táctiles, el de 15 min amplía su área a 44 px (`::after` 13 px arriba y abajo; 9 en computadora) y queda encima de sus vecinos (`z-index:3`); el de 30 min, 3 px (44 en total). En la rejilla de 7 columnas de teléfono (versión B) los bloques miden 36–45 de ancho: por debajo de 44, es una de las razones de preferir la versión A.

## 3. La rejilla — `.ag0-cal`

Función `rejilla(vp, dias, scroll, minimo)`. Estructura: `.ag0-cal` > `.ag0-dias` (cabecera fija) > `.ag0-todo` (fila «Todo el día», fija) > `.ag0-cuerpo` (se desplaza) > `.ag0-lienzo` > `.ag0-fila` [`.ag0-horas` + `.ag0-col` × n]. Todas las filas son `display:grid; grid-template-columns: var(--cal-hw) repeat(var(--n), minmax(0,1fr))`.

| Pieza | Clase | Medida |
|---|---|---|
| Tarjeta | `.ag0-cal` | `--sup`, sin borde ni sombra, radio 16 / 18 (`ih`,`iv`) / 20 (`esc`); ocupa el resto de la pantalla |
| Cabecera de día | `.ag0-dia` | botón (abre ese Día) 44 alto (40 en `ih`/`esc`); «Jue» 12/600 `--tinta2` + número 17/600; hoy, número blanco en círculo 28 `--cal-hoy-num`. En Día es un `<span>` (no lleva a otro sitio) |
| Columna de horas | `.ag0-hr` | 12/16 tabular `--tinta2`, centrada en su línea, a 5–6 px del borde; se omite la que tapa la píldora de la hora actual |
| Columna de día | `.ag0-col` (+ `ag0-col-hoy`) | línea de 1 px cada hora (fondo repetido) y a la izquierda; sin medias horas. Pulsar en vacío → `.ag0-hueco` |
| Fuera de horario | `.ag0-fuera` | banda `--cal-fuera` (la línea de hora se repite encima); día sin consulta, entero |
| Bloqueo | `.ag0-bq` > `.ag0-bq-r` + `.ag0-bq-t` | botón de todo el bloqueo (abre su edición); rayado 135°, 1,5 px cada 9 px, SOLO en los tramos dentro de horario (`tramosDelRayado`); rótulo «Bloqueado · motivo» 12/600 sobre `--sup`, radio 6, alto 20, candado 12 |
| Hora actual | `.ag0-ahora` · `.ag0-ahora-t` · `.ag0-ahora-p` | 2 px `--cal-ahora` + punto 10 en hoy (debajo de los bloques); 1 px al 35 % en los demás días; píldora 20 alto, 12/700, `--sup` sobre `--cal-ahora` |
| Todo el día | `.ag0-todo` · `.ag0-tc` | fila mín. 34; chip 24 alto, radio 7, 12/600, barra 3 px; `ag0-tc--bq` rayado; `ag0-tc--min` solo icono |
| Hueco | `.ag0-hueco` | SOLO en `ih`, `iv`, `esc` (en teléfono hoy no existe: `rejilla()` no lo monta y la columna lleva `ag0-col-sinh`). Fantasma en la franja de 30 min pulsada: discontinuo 1,5 `--cal-hueco`, relleno 8 %, «10:30 – 11:00» 12/600 `--enlace` |

Desplazamiento inicial: `data-scroll="12"` (hora que queda arriba). Rango de la rejilla 07:00–21:00 (`T0`, `T1`; en la app sale del horario de los consultorios).

## 4. La barra — `.ag0-barra`

Función `barra(vp, vista)`. Siempre dos filas (`.ag0-bf`): **fila 1** = título del periodo (`.ag0-tit`, abre «Ir a una fecha») + acciones; **fila 2** = `.ag0-nav` (‹ «Hoy» ›) + `.ag0-seg` (Mes | Semana | 3 días | Día). En teléfono ‹ › suben a la fila 1, junto al periodo (`‹ periodo ›`), y la fila 2 es «Hoy» + el conmutador estirado.

| | ext | tel | ih | iv | esc |
|---|---|---|---|---|---|
| Fila 1 | ‹ título 17/700 › · campana · «···» | ‹ título 17/700 › · campana · «···» | título 26/800 (≤ 431 px) ‖ Agendar (x ≥ 496) | título 28/800 · Agendar | título 32/800 · buscar · campana · candado · engrane · Agendar |
| Fila 2 | Hoy · conmutador de cuatro estirado | Hoy · conmutador de cuatro estirado | ‹ Hoy › · segmentado ‖ buscar · campana · «···» | ‹ Hoy › · segmentado · buscar · campana · «···» | ‹ Hoy › · médico · segmentado |
| Agendar | «+» del riel | píldora flotante al pie | primario | primario | primario |
| En «Opciones de la agenda» | buscar, médico, bloquear, configuración, compactar, pop-up, leyenda | igual | médico, bloquear, configuración, compactar, pop-up, leyenda | igual | (engrane) configuración, compactar, densidad, pop-up, atajos, leyenda |

Medidas: icono `.ag0-ic` glifo 20 `--tinta2`, área 44 (36 en `ih`/`esc`), fondo `--sup2` solo al pulsar o abierto; contador `.ag0-cnt` 18 alto 12/700 sobre `--mes`; «Hoy» `.ag0-hoy` texto 15/600 (14 en ancho) `--enlace`; segmentado pista `--sup2` 3 px, segmento 38 alto (30 en `ih`/`esc`) 14/600 (13 en `ext` y ancho), elegido `--sup` + sombra 1 px; primario `.ag0-prim` 40 alto (36 en `ih`/`esc`) radio 12 15/600; selector de médico `.ag0-med` píldora 36 sobre `--sup` con iniciales 24.

## 5. Capas (catálogo §25–§27)

`.ag0-capa` (`data-capa`) > `.ag0-velo` + `.ag0-cj`. Tarjeta centrada en el área de contenido en `ext` (310), `ih`, `iv`, `esc` (400; 320 «Ir a una fecha»); hoja inferior con asa en `tel`; en `esc` los menús (`ag0-anc`, en una capa `ag0-sinvelo`) nacen de su botón sin velo. Velo `--velo` + `blur(10px) saturate(140%)`. Entrada: fundido + escala .96→1 con resorte (amortiguación 1, respuesta .35 s, escrito con `linear()`); salida 200 ms. Opciones de menú `.ag0-op` (48 alto, 40 en `esc`; icono 20 en `--enlace`, texto `--tinta`; destructiva `ag0-op-mal` al final tras `.ag0-sep`), interruptor `.ag0-sw`, desplegable `.ag0-sub`. Mini mes `.ag0-mm`.

La función `burbuja(c)` de la base es la forma mínima; en Día y 3 días se usa la burbuja real de `ag-burbuja` (ver §14).

## 6. Semana en teléfono

Versión A (recomendada): `.ag0-tira-d` (7 botones `.ag0-td`, hoy en círculo, elegido sobre `--fondo`, hasta 3 puntos) + `.ag0-sl` (lista con cabeceras de día fijas `.ag0-ld` y filas `.ag0-lf`: hora 13/600 · barra 3 px del estado · nombre 15/600 · segunda línea 13 `--tinta2` · estado en círculo 26). Versión B: la misma `.ag0-cal` con 7 columnas (`minimo=True`).

## 7. Navegación

Copiada del dashboard aprobado (`tmp-nav.css`): riel (`ext`), encabezado fundido (`tel`), pista de cinco píldoras (`iv`), barra lateral derecha (`ih`) e izquierda 248 (`esc`), con «Agenda» marcada.

## 8. Panel del día — `.ag0-pd` (solo computadora, Vista Día)

Hoy existe solo a ≥ 1024 px y en Día (`panelDelDia`, AgendaCliente.tsx:1099). No va en `ext`, `tel`, `ih` ni `iv`. Función `panel_dia()` en `tmp-vistas.py`.

- Composición: `.ag0-diap` = rejilla + panel en rejilla CSS `minmax(0,1fr) 300px`, hueco de 16. La barra va encima, a todo el ancho; el panel se desplaza por su cuenta.
- Tarjetas `.ag0-pc` (`--sup`, radio 20, relleno 14·16·16, separación 14) con rótulo `.ag0-pc-t` 13/700 en mayúsculas `--enlace`.
- **Resumen** (CardResumen.tsx): título «Resumen · Dr. …» con un médico filtrado, «Resumen del día» sin él. Mosaicos `.ag0-tile` 2×2 sobre `--fondo`, radio 12: número 22/700 tabular + etiqueta 13 `--tinta2` («cita/citas», «evento/eventos», «h ocupadas», «h libres»; esta última con el número en `--enlace`). Sin dato: «—». Desglose `.ag0-des`: icono de estado en círculo 24 + «3 agendadas» 14 (singular y plural de DesgloseEstados). Notas `.ag0-pnota` 13 `--tinta2`, con los textos exactos de hoy.
- **Huecos disponibles** (CardHuecos.tsx): no se monta con «Todos los médicos». `.ag0-hg` por hueco: rango 15/600 tabular y duración 13 («35 min», «2 h»). Turnos `.ag0-turno`: píldora tonal de 36 con «+» de 14 y la hora; `aria-label` «Agendar a las HH:MM (30 min)». Si no cabe un turno: «No cabe un turno entero en este hueco.». Si no hay huecos: `.ag0-pvacio` con icono de calendario y «Consultorio cerrado · No hay horario de consulta este día» (o «Día completo · …», «Faltan citas por cargar · …»).
- **Mini mes** (MiniMes.tsx): `.ag0-mm.ag0-mmp`, días de 36 de alto; hoy en `--enlace`, el día a la vista relleno `--cal-hoy-num`; «Mes anterior» / «Mes siguiente».
- Estados de maqueta: clases en el marco `ag0-sinmed`, `ag0-sinhor`, `ag0-mmsel` (variantes `.ag0-pvn` / `.ag0-pvm` / `.ag0-pvh`).
- A 1024 de ventana la barra conserva dos filas: `.ag0-cont` es contenedor y por debajo de 820 px el título de `esc` baja a 26/800.

## 9. Avisos de página — `.ag0-aviso`

Entre la barra y la rejilla, en todos los marcos. Alto mínimo 44, radio 12, icono 16 + texto 13 (la frase fuerte en 600) + acción de texto de 36 (área 44). Tonos: `ag0-av-e` error (`--mal-*`, «No se pudo cargar la agenda.» + «Reintentar»), `ag0-av-g` Google (`--ag-*`, «No se pudo sincronizar con Google Calendar.» + «Revisar conexión»), `ag0-av-c` vista compacta (`--sup`, «Vista compacta: horas fuera de horario recortadas» + «Mostrar rejilla completa»). En `ih` el aviso mide como mucho 431 px, para no cruzar la bisagra. Los demás avisos de AvisosAgenda.tsx («Faltan citas por mostrar.», vacío con «Ver todos los médicos» / «Agendar», leyenda de husos) usan la misma pieza.

## 10. Textos unificados (CALMA §28, aprobados)

Sustituyen a todas las variantes de hoy, en la agenda y fuera de ella. En las seis vistas ya están aplicados.

| Concepto | Variante de hoy (archivo:línea, `S/app/src/…`) | Texto nuevo |
|---|---|---|
| Origen Google | «Llegó de Google Calendar» (`components/agenda/BurbujaCita.tsx:127`) | **Agendada desde Google Calendar** |
| | «Agendada en Google» (`components/agenda/MarcaOrigenGoogle.tsx:23`, etiqueta accesible de la marca G) | **Agendada desde Google Calendar** |
| | «Se agendó en Google» (`components/agenda/LeyendaEstados.tsx:89`) | **Agendada desde Google Calendar** |
| | filas estrechas (Semana A en Duo cerrado, dashboard en Duo cerrado) | corto: **Desde Google Calendar** |
| Reserva por enlace | «La apartó con tu enlace» / «La apartó con el enlace de reserva» (`BurbujaCita.tsx:133`) | **Reservó por enlace** |
| | «Agendada por enlace» (`components/agenda/MarcasCita.tsx:24`, etiqueta accesible) | **Reservó por enlace** |
| | «Se agendó por enlace» (`LeyendaEstados.tsx:91`) | **Reservó por enlace** |
| | «Reservó por enlace» (`BloqueReservaPorLigar.tsx:108,114`) | sin cambio |
| | «Por enlace» (`components/dashboard/ProximasCitas.tsx:59`) | solo en filas estrechas: **Por enlace**; en el resto **Reservó por enlace** |
| Ligado | «Ligar expediente e iniciar» (`lib/agenda/accionesTarjeta.ts:66`, burbuja) | **Ligar paciente e iniciar consulta** |
| | «Ligar e iniciar consulta» (`components/agenda/VentanaLigarCita.tsx:191,268`; `app/(app)/dashboard/page.tsx:279,285`) | **Ligar paciente e iniciar consulta** |
| No es una cita | «No es una cita» (`accionesTarjeta.ts:65`, burbuja) | **¿No es una cita?** (con signos, como `BotonNoEsCita.tsx:26`) |

Dónde aparecen en las piezas: segunda línea del bloque ancho (`.ag0-b-ot`), etiqueta accesible del bloque, burbuja de muestra (procedencia, principal «Ligar paciente e iniciar consulta» y «¿No es una cita?» en el pie), filas de la Semana A (cortos en `ext`).

## 11. Cromo global en las vistas de agenda

Navegación igual que en `S/entrega/cromo/`:
- Aviso «3 datos pendientes» (`.ag0-ap`, solo médico): tarjeta ámbar plegable sobre el pie de la barra lateral (`esc`, `ih`); distintivo ámbar `.ag0-bdg` con el número sobre «···» del riel (`ext`), el botón de menú (`tel`) y «Mostrar barra lateral» (`iv`). CSS copiado de `cromo/tmp-v1.py` con el prefijo cambiado.
- Logo de la clínica (`.ag0-clogo`, círculo blanco de 34) en lugar de las iniciales en el botón de consultorio.

## 12. Conmutador de cuatro vistas y vista «3 días» (CALMA §29.1)

**Conmutador** `.ag0-seg` con cuatro `button[role=tab][data-vista]`: `mes` «Mes», `semana` «Semana», `tres` «3 días», `dia` «Día». Rótulos enteros en todos los marcos (ninguna vista escondida en un menú, nada por debajo de 12 px). Pista `--sup2` con 3 px de relleno; elegido `--sup` + sombra de 1 px.

| Marco | Conmutador (ancho × alto) | Segmentos (ancho) | Letra | Barra |
|---|---|---|---|---|
| ext | 244 × 44, estirado en la fila 2 junto a «Hoy» | 51 · 75 · 62 · 44 | 13/600 | 2 filas, 94 px |
| tel | 304 × 44, estirado | 66 · 90 · 77 · 59 | 13/600 | 2 filas, 94 px |
| ih | 237 × 36, a la izquierda de la bisagra (≤ 431 px con ‹ Hoy ›) | 49 · 73 · 60 · 44 | 13/600 | 2 filas, 86 px |
| iv | 254 × 44 | 53 · 79 · 65 · 46 | 14/600 | 2 filas, 94 px |
| esc | 260 × 36 | 55 · 79 · 66 · 48 | 13/600 | 2 filas, 84 px |

Segmentos de 38 de alto (30 en `ih`/`esc`) con área de 44 (36) mediante `::after`. Títulos del periodo: `TIT` en `tmp-gen.py` (`tres`: «19 – 21 nov 2026» en ancho y «19 – 21 de noviembre» en teléfono). La última palabra del título y su flecha van juntas (`.ag0-nw`).

**Vista 3 días** (`vista-7-tres-dias.html`): `rejilla(vp, [hoy, hoy+1, hoy+2])`, siempre rejilla horaria, también en teléfono. Mismas piezas y medidas que Día y Semana (80 px por hora, columna de horas 44/52/56).

| Marco | Ancho de columna | Forma del bloque |
|---|---|---|
| ext | 84 px | muy estrecha (icono + hora / nombre corto; nombre entero en dos líneas desde 45 min) |
| tel | 105 px | estrecha |
| ih | 183 px | estrecha |
| iv | 189 px | estrecha |
| esc | 309 px | media (fila con el estado en icono) |

El hueco para agendar existe en `ih`/`iv`/`esc` y no en teléfono. Sin panel del Día en `esc`: hoy el panel solo sale en la vista Día. En `ih` la cabecera del tercer día cruza la bisagra (columnas de 183 px), lo mismo que en la Semana.

**Iconos de §29.5–6:** «Ligar paciente e iniciar consulta» lleva el eslabón (`I["enlace"]`); el botón de la burbuja que abre el formulario lleva el lápiz (`I["editar"]`), con su `aria-label` de hoy, «Más opciones de la cita».

## 13. Regla de botones (informe `S/informes/botones-desbordados.md` §3)

1. **8 px libres por lado:** el ancho natural del botón (rótulo en una línea + icono + hueco + relleno) ≤ ancho asignado − 16.
2. **Dos botones lado a lado solo si el más largo cabe en su mitad** (`max(natural) ≤ (interior − hueco) / 2`; en el modal de `ext`, 134 px). Si no cabe, ancho por contenido (`flex: auto`) cuando `suma(naturales) + hueco ≤ interior`. Si tampoco, apilados, con el primario arriba y a todo el ancho.
3. **Nada de `flex: 1 1 0`** en controles con texto que compitan con un espaciador o con otro control de texto. Los segmentados usan `flex: none` y celdas de ≥ 44 px por contenido. (Excepción ya medida: el conmutador de cuatro de `ext`/`tel` se estira, `flex: 1 1 auto`, y cada segmento conserva su ancho natural.)
4. **Iconos de cola (⌄, ↓, ›) dentro del flujo del texto,** nunca como pieza aparte en un botón que pueda encogerse. En la agenda: el título del periodo envuelve la última palabra y su chevrón en `.ag0-nw` (`white-space: nowrap`). En `ext`/`tel` el botón `.ag0-tit` ocupa todo el ancho libre entre ‹ y › y parte en dos líneas limpias.
5. **Listas en columna flex con desplazamiento:** filas con `flex-shrink: 0`.
6. Antes de publicar: `node S/tools/chk-botones.js <pagina.html> --vp …` con cero hallazgos (a)–(f), salvo excepciones de diseño. En la agenda, las excepciones son los nombres de los bloques y chips del calendario, con elipsis o *line-clamp* por la regla de §2.

## 14. Integración (kit/INTEGRACION.md): Día y 3 días con las piezas reales

`vista-4-dia.html` y `vista-7-tres-dias.html` son las que se publican en la página Calendario. Las genera el bloque «INTEGRACIÓN» al final de `tmp-vistas.py`: ejecuta los generadores hermanos solo hasta antes de su escritura y copia su marcado y su CSS. El marco lleva, además de `ag0 ag0-vN`, las clases `ab ab-vIN af al ah cr4`, para que apliquen las hojas de cada carpeta.

- **Burbuja, burbuja de alta, alertas, avisos breves y tarjeta al pasar:** `ag-burbuja`, con su propio guion (segundo `<script>`, `CFG.v = 'IN'`).
- **Formulario de cita y evento, bloquear horario, convertir en cita y registro en teléfono:** `ag-form`. Las capas `.af-capa` se abren desde `tmp-integra.js` (`AFMAP`: destino → capa y variante).
- **Burbuja por ligar / Google por asignar y ventana «Ligar paciente e iniciar consulta»:** `ag-ligado`. Su guion se pega dentro del de esta base, porque lo extiende.
- **Opciones, buscar, campana, médico, leyenda, atajos y huecos (Duo abierto):** `ag-herr`. Son capas `.ag0-capa` que se abren con `abre()` de esta base.
- **Cajón, «Más», selector de consultorio y su confirmación:** `cromo`, con el prefijo `cr4`.
- **Mes · Semana · 3 días · Día:** llevan a la sección de esa vista en la misma página, con desplazamiento y realce.
- **Lo que sale de la agenda** («Iniciar consulta», «Ver la consulta», «Configuración de la agenda», «Revisar conexión», «Completar ahora», las secciones de la navegación, «Mi perfil», «Ayuda») cierra lo abierto. Está documentado en la ficha.

Los textos de reparto («otro agente», «reservado», «hueco documentado») se quitan de las plantillas y de los comentarios copiados.
