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
* `AppointmentModal` (sólo con la v2, `data-form-v2`): piel del catálogo por CSS (superficie `--sup`,
  radio 20, rótulos 13/600 sin versalitas —antes 11 px—, campos `--sup2` 44/16), rótulos de grupo
  «Fecha y hora» y «Detalles» (§29.9). Geometría del panel intacta.
* Cancelar o eliminar desde el pie PIDE CONFIRMACIÓN (§29.2) con «Volver» al cancelar; el texto es el de
  la burbuja (`textoDeConfirmacion`); para una cita sin paciente que se elimina, «¿Eliminar la cita
  «título»? No se puede deshacer.» (texto nuevo: no había alerta). Las alertas de la X del paciente, de
  horario y de empalme llevan su verbo.
* `ModalBloqueo`: piezas del catálogo y «Quitar bloqueo» con la alerta («¿Quitar el bloqueo de horario?
  Se vuelve a poder agendar en ese periodo.», texto nuevo; antes «Quitar bloqueo» → «Sí, quitar» en línea).
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

## AG8 · herramientas
* `BuscadorCitas`: «Sin coincidencias.» cuando la búsqueda vuelve vacía (§29.8).
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
* `BurbujaAlta` sigue anclada en `ih`/`iv` (la maqueta: tarjeta centrada con velo). Pendiente.
* La hoja de la burbuja en `tel` limita su alto al 80 % de lo visible (como antes), no a «pantalla −
  barra de estado − 16».
* AG6: el formulario no se rehízo pieza a pieza (recordatorios, `BloqueReservaPorLigar`, botones de
  WhatsApp/correo quedan con su CSS de siempre dentro de la piel nueva); no es pantalla completa en `tel`
  distinta de la de hoy (ya lo era por debajo de `md`).
* AG8 NO hecho: la barra por formato de PIEZAS §4 (título grande en `esc`; «···» y píldora flotante en
  teléfono), «Huecos disponibles» en `ih`/`iv` desde las opciones, iconos en todas las filas del engrane.
  «Plegar menú» ya existía (B4) y no se tocó.

## Peticiones a otras líneas
* **VISTAS (`AgendaCliente.tsx:1822`)**: quitar `leyenda={…BotonLeyendaAgenda…}` de la barra (§28: la
  leyenda sale de la barra y se abre desde las opciones). Al hacerlo, actualizar `ranurasCabecera.test.tsx`
  y las e2e que pulsan el botón «Leyenda de estados» de la barra (`agenda-i5-barra-avisos`, `-k5-marcas`).
* **CONFIGURACIÓN (AG9)**: sus `ConfirmModal` no pasan `verbo` y siguen con «Aceptar»; si se quieren con
  la alerta del catálogo, basta pasar `verbo` (y `secundario`/`icono`).
