# B13 · línea CAPAS (AG5 → AG8) — registro

Rama `feature/b13-capas`, desde `cbaaa1c1` (+ `ca1c2cf8` fusionado). Maquetas: `S/entrega/ag-burbuja`,
`ag-form`, `ag-ligado`, `ag-herr`. Capturas, registros de build/e2e y `RESULTADOS.md`: `S/b13/capas/`
(`antes/` = build limpio de `cbaaa1c1`; `despues/` = esta rama; 12 escenarios × 5 formatos × 2 temas).

## Cómo está hecho (léelo antes de tocar capas)

* **Las capas viven en `body`**: colores SÓLO con tokens del kit (`--sup`, `--sup2`, `--fondo`,
  `--tinta*`, `--linea`, `--enlace`, `--accion`, `--tonal*`, `--mal-*`, `--ok-*`). Los `--ag-*`
  re-apuntados de la raíz v2 (AG1) no llegan allí. Ningún token nuevo.
* **Piel genérica** (`globals.css`, «CAPAS E INTERACCIONES V2»): `.ag-capa` (anclada, radio 18, contorno
  1 px `--linea` + `--sombra-capa`, relleno 20), `.ag-capa--centro` (radio 20), `.ag-hoja` (radio 22 arriba),
  `.ag-capa-cab/-titulo` (17/700), `.ag-capa-cerrar` (44; 36 en `ih`/`esc`), `.ag-capa-campo` (rótulo
  13/600, campo `--sup2` sin borde, 44/16 táctil, 40/15 en `esc`), `.ag-capa-boton` (quieto `--sup2` /
  principal `--accion`, 44; 40 en `ih`/`esc`), `.ag-opciones` (recuadro `--fondo`), «Registrar…» en
  `--ok-*`. Con eso salen al kit, sin tocar su TSX, la burbuja de alta, «Convertir en cita», la ventana de
  ligar, el buscador, «Ir a una fecha», la campana, el engrane y la leyenda.
* **Dónde va cada capa** (CALMA §25–§28; sólo CSS, el JS no decide el marcado por formato):
  * burbuja de la cita (`TarjetaLectura`): `esc` anclada al bloque (`posicionCapa`); `ext` tarjeta
    centrada de 310 con velo; `ih`/`iv` tarjeta centrada de 400 con velo; `tel` hoja con asa que se
    arrastra para cerrar (`useArrastreHoja` del catálogo, desde el asa o la cabecera). `colocarHoja`
    sólo actúa en `tel` (`esTelefono()` lee `data-formato` tras montar);
  * capas de la barra (`CapaBarra`: campana, engrane, leyenda): `esc` cuelgan del botón sin velo; Duo
    tarjeta centrada con velo; `tel` hoja. `colocarBajo` sólo actúa en `esc`.
* **La ventana sin el cromo**: `ventanaParaCapas()` (`posicionCapa.ts`) = la parte visible menos
  `--fijo-izq/--fijo-der` medidos con una sonda (pueden ser `calc()`); la usan las TRES copias de
  `colocar` (`TarjetaLectura`, `BurbujaAlta`, `HerramientasV2`) y `colocarBajo` (AG-DT-38). El buscador
  ya no tapa el riel en `ext` (capturas: «CROMO 7» antes, 0 después).
* **La alerta de confirmación** (`ConfirmModal`) con `verbo` es la del catálogo (`.k-capa`/`.k-al`):
  pregunta como título y resto como mensaje (`partirPregunta`), icono en círculo (rojo al cancelar o
  eliminar, ámbar si no), secundario («Volver» al cancelar algo; «Cancelar» si no, con el foco) y
  principal con verbo. El nombre del diálogo sigue siendo el texto ENTERO (título + mensaje): los
  localizadores por nombre no cambian. Sin `verbo` es la de antes, letra por letra: la ve la agenda con
  la v2 APAGADA y la configuración (AG9). Los llamadores pasan el verbo SÓLO con la v2.

## AG5 · burbuja y alta
* `BurbujaCita`: estado = `IconoEstadoCita` (círculo 24 + texto 12/600); lápiz en «Más opciones de la
  cita» (§29.5, mismo `aria-label`, sigue sin menú) y ✕; nombre 20/700; origen «Agendada desde Google
  Calendar» / «Reservó por enlace» (§28; antes «Llegó de Google Calendar» / «La apartó con tu enlace»);
  detalles entre dos líneas con las observaciones dentro (una línea, `title` con el texto entero: §29.7
  no lo toca, lo pide la maqueta); principal 44 (40 `ih`/`esc`); acciones como FILAS DE MENÚ de borde a
  borde (48; 40 en `ih`/`esc`), «Confirmar» con chevrón y lo desplegado colgando de su fila; tras una
  línea, «¿No es una cita?» con su explicación a la vista y la destructiva en rojo al final. El
  `toolbar` pasa a `aria-orientation="vertical"` (arriba/abajo recorren; los lados siguen igual).
  Clases y orden de foco intactos (`.ag-burbuja-rejilla` = la lista, `.ag-burbuja-celda` = fila).
* `src/lib/agenda/accionesTarjeta.ts` (presentación): `rejillaDeBurbuja` añade la fila «Editar» a la
  cancelada, la atendida y la no asistida (decisión del dueño en la maqueta; la misma puerta que el
  lápiz, `alAccion('editar')`: no es acción nueva para el servidor).
* `ConfirmModal` con verbos (§29.3–§29.4): «Cancelar cita»/«Volver», «No asistió», «Eliminar evento»,
  «Eliminar cita»; «Mover» (arrastrar fuera de horario), «Guardar» (estirar fuera de horario, empalmes,
  burbuja de alta, formulario), «Agendar» (abrir un alta fuera de horario). Pasados desde
  `guardadoCitas.ts`, `altaCitas.ts`, `InteraccionesV2.tsx` y `AppointmentModal.tsx`.
* `PreguntaAsistencia`: botones del catálogo («Sí asistió» tonal, «No asistió» quieto), 480, textos 15/13.
* `PanelReagendar`: campos y botones del catálogo. `BurbujaAlta` y `ConvertirEnCita`: por la piel genérica.

## AG6 · formulario
* `AppointmentModal` (sólo con la v2, `data-form-v2`; sin tocar la lógica):
  * GRUPOS de la maqueta como tarjetas `--sup` de radio 16 sobre el cuerpo `--fondo`: cada rótulo
    (`.ag-form-grupo`, 12/700 en versalitas `--enlace` con su icono: Paciente, Evento, Fecha y hora,
    Detalles, Invitados, Avisar al paciente) abre la tarjeta que forman los bloques que le siguen (por
    CSS: `.ag-form-grupo + *` y `:has(+ .ag-form-grupo)`), con línea entre bloques. «Fecha y hora» y
    «Detalles» son los aprobados (§29.9); los otros cuatro son de la maqueta.
  * La «Duración» se movió (bloque entero, sin cambios) de detrás del «Tipo de cita» a delante: en la
    maqueta es de «Fecha y hora».
  * Rótulos 13 `--tinta2` (antes 11 en versalitas); campos y fichas `--sup2` sin borde, 44/16 en táctil y
    40/15 (fichas 36) en `ih`/`esc`; todo texto de 10–11 px del cuerpo sube a 12.
  * Fichas del kit (duración, tipo: `--sup2`; la elegida tonal con contorno `--enlace`); el ESTADO lleva su
    icono en círculo (`IconoEstadoCita`, decorativo: el nombre del botón sigue siendo el texto) y el elegido
    el contorno; en `ext` los pares fecha | hora van en una columna (en 310 no caben dos fechas).
  * La destructiva («Cancelar cita» / «Eliminar evento» / «Eliminar cita») baja a una FILA ROJA al final del
    cuerpo (`.ag-form-peligro`) que abre su alerta; el icono del pie queda sólo con la v2 apagada.
  * Pie: «Cancelar» quieto y «Guardar» primario, 44 (40 en `ih`/`esc`), mínimo 104.
  * Capa: tarjeta de 520 en `ih`/`iv`/`esc`, de 310 centrada en `ext` (antes pantalla completa), pantalla
    completa en `tel` (la de siempre por debajo de `md`).
  * «Enviar confirmación», «… por correo» (`BotonWhatsAppCita`, `BotonCorreoCita`) y «Agregar invitados»
    como filas de enlace; el rótulo repetido de dentro se quitó («Avisar al paciente») o quedó sólo para el
    lector («Invitados»). `BloqueReservaPorLigar` y los recordatorios entran por la piel común (12 mínimo).
* Cancelar o eliminar desde el pie PIDE CONFIRMACIÓN (§29.2) con «Volver» al cancelar; el texto es el de
  la burbuja (`textoDeConfirmacion`); para una cita sin paciente que se elimina, «¿Eliminar la cita
  «título»? No se puede deshacer.» (texto nuevo: no había alerta). Las alertas de la X del paciente, de
  horario y de empalme llevan su verbo.
* `ModalBloqueo`: tarjeta 440 (310 en `ext`), rótulos y campos del catálogo, pie «Cancelar» · «Guardar»;
  «Quitar bloqueo» (texto rojo) se convierte en su sitio en el botón rojo «Sí, quitar», como la maqueta y
  como hoy (en la primera entrega lo había pasado a una alerta con texto nuevo: se deshizo).
* `ModalInvitacionCita`: «No invitar» / «Invitar» (antes «No invitar a nadie» / «Enviar invitación»).
  Va también con la v2 apagada: el modal no sabe del interruptor y `AgendaCliente` no es de esta línea.

## AG7 · ligado y Google
* `ETIQUETA_ACCION`: «Ligar paciente e iniciar consulta» (antes «Ligar expediente e iniciar») y
  «¿No es una cita?» con signos (§28; antes «No es una cita» en la burbuja). Eslabón en la burbuja.
* `VentanaLigarCita`: título y botón «Ligar paciente e iniciar consulta» con eslabón; pie «Cancelar» +
  principal a la derecha; «¿No es una cita?» como acción de texto.
* `LeyendaEstados`: «Agendada desde Google Calendar» y «Reservó por enlace» (antes «Se agendó en Google» /
  «Se agendó por enlace»); pruebas `origenGoogle`, `marcasProcedencia`, `agenda-k5-marcas`, `reserva-google`.
* `BotonNoEsCita`: la explicación se ve bajo el botón y lo describe (`aria-describedby`; §29.7).

## AG5 (segunda vuelta) · la burbuja de alta
* `BurbujaAlta` (y las capas de `HerramientasV2`: buscador, «Ir a una fecha») sólo se anclan en `esc`; en
  `ext`/`ih`/`iv` van centradas con velo y en `tel` como hoja (`.ag-capa-barra` + `.ag-capa-barra-velo`).
  La guarda de formato va en las TRES copias de `colocar` (AG-DT-38).

## AG8 · herramientas
* `BuscadorCitas`: «Sin coincidencias.» cuando la búsqueda vuelve vacía (§29.8).
* Engrane: todas las filas con icono (la leyenda, `Info`). La leyenda ya se abre desde el engrane: retirar el
  botón de la barra no pierde la función.
* Campana, «Por confirmar», avisos y engrane con los tokens del kit (pestañas de borde a borde, botones
  de 44/40 en `--sup2`, filas del menú de 44; 38 anclado en `esc`).

## Pruebas actualizadas (presentación aprobada; ninguna saltada ni debilitada)
* Unitarias: `burbujaCita.test.tsx` («Editar» en todas, textos §28, explicación de «¿No es una cita?»),
  `accionesTarjeta.test.ts` (texto del ligado), nueva `confirmacionAgenda.test.tsx` (`partirPregunta`,
  verbo y «Volver», nombre entero; la clásica intacta).
* e2e «Aceptar» → verbo: `agenda-empalme`, `-f-burbuja`, `-h3-burbuja`, `-l2`, `-t1-capas`, `-f-tarjeta`,
  `-g3-tarjeta`, `-g4-husos`, `-t1-burbuja`, `-cancelar`, `-google-dos-sentidos`, `-eleccion-i2` (con el
  empalme acotado a su diálogo: «Guardar» también es el botón del formulario). Se quedan en «Aceptar» las
  que corren con la v2 apagada (`agenda-arrastre`, `agenda-citas`, `agenda-empalme:275`, que simula el
  cliente apagado) y las de configuración.
* Medidas: `agenda-m1-burbuja` (computadora) y `agenda-l2` (teléfono) a las de la maqueta; `agenda-g3-tarjeta`
  (filas en columna en vez de rejilla pareja; «Editar» en atendida/cancelada/no asistió); `agenda-h3-burbuja`
  (el verde de «Registrar» es `--ok-*`).
* Textos: `agenda-k5-burbuja`, `reserva-google` (origen), `agenda-i3-por-asignar`, `-google-dos-sentidos`,
  `-j3-ligar-ventana`, `-f-tarjeta`, `-i5-barra-avisos` (ligado, «¿No es una cita?»).
* Confirmación del formulario: `agenda-cancelar`, `agenda-por-ligar`; bloqueo: `agenda-k1-bloqueos`.

## Diferencias con las maquetas (pendientes, sabidas)
* La cabecera de la burbuja conserva el lápiz (§29.5 y el brief) además de la fila «Editar» (la ficha de
  la maqueta lo quitaba); así no se pierde ningún localizador ni regla de CLAUDE.md.
* La hoja de la burbuja en `tel` limita su alto al 80 % de lo visible (como antes), no a «pantalla −
  barra de estado − 16».
* AG6: las filas del formulario siguen con el rótulo ENCIMA del campo en todos los formatos (la maqueta
  pone en `ih`/`esc` el rótulo a la izquierda en una columna de 150 y fechas/horas como píldoras en línea):
  hacerlo pide reescribir el marcado de cada campo de un archivo de 2 000 líneas. «Iniciar consulta» y
  «Expediente» siguen en la cabecera y el pie (la maqueta los pone como filas del grupo Paciente). En `tel`
  el formulario es pantalla completa (encargo), no la hoja arrastrable de la ficha.
* AG8: «Huecos disponibles» en `ih`/`iv` NO hecho: la opción del engrane necesita los huecos y el médico
  elegido, que viven en `AgendaCliente` (línea de vistas); pide una prop nueva a `MenuEngraneAgenda`.
  La barra por formato de PIEZAS §4, aplazada por el coordinador. «Plegar menú» ya existía (B4).

## Rojos comprobados contra la base (`cbaaa1c1`, worktree aparte, mismo puerto y misma base de datos)
* `reserva-google:275` («GET de turnos…»): FALLA IGUAL en la base → preexistente, no es de esta línea.
* `agenda-google-dos-sentidos:458`: en la base FALLA y la guarda de asistencia la marca igual → preexistente.
* `agenda-convertir-google:90`: pasa en la base y en esta rama, y corrida SOLA no deja nada a la guarda en
  ninguna de las dos; la marca que salió en una tanda larga depende del orden de la corrida (siembra
  citas el jueves de la semana visible, `DIA_LABORABLE_LIBRE`).
* `agenda-f-movimiento:187` (y el mismo patrón en `agenda-cache-rangos`, `-candado-gesto`, `-tiempo-real`,
  `-reflejo-enlace`, `confirmacion-enlace`, `confirmacion-k2-al-cargar`, `recordatorios`,
  `reserva-k2-codigo`): `localhost:3001` escrito a mano; ahora usan la base URL de la corrida
  (`test.info().project.use.baseURL` o `E2E_BASE_URL`). Defecto de las pruebas, corregido.

## Peticiones a otras líneas
* **VISTAS (`AgendaCliente.tsx:1822`)**: quitar `leyenda={…BotonLeyendaAgenda…}` de la barra (§28: la
  leyenda sale de la barra y se abre desde las opciones). Al hacerlo, actualizar `ranurasCabecera.test.tsx`
  y las e2e que pulsan el botón «Leyenda de estados» de la barra (`agenda-i5-barra-avisos`, `-k5-marcas`).
* **VISTAS**: para «Huecos disponibles» en `ih`/`iv` (§28), pasar a `MenuEngraneAgenda` los huecos del día
  (lo que pinta `CardHuecos`) cuando la vista es Día y hay médico elegido; la capa la pongo yo.
* **CONFIGURACIÓN (AG9)**: sus `ConfirmModal` no pasan `verbo` y siguen con «Aceptar»; si se quieren con
  la alerta del catálogo, basta pasar `verbo` (y `secundario`/`icono`).
