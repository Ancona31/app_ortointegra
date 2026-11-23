# Integración rediseño + agenda v2 — registro de la revisión visual

Rama `feature/integracion-rediseno-agenda` (fusión `dce3863d` de
`feature/rediseno-estetico` `14df1305` con `feature/agenda-v2-produccion`
`4708f1db`). Sólo presentación: ni lógica, ni rutas, ni datos.

Capturas (fuera del repo, en el scratchpad de la sesión, `S/integracion/`):
`antes-apagada/`, `antes-encendida/`, `antes-encendida2/`, `antes-publico/`,
`antes-config/`, `antes-extras/` (antes) y `despues-encendida/`,
`despues-apagada3/` (después). Herramienta: `S/integracion/cap-agenda.js`
(los cinco formatos con el viewport real del Duo: `ext` 382×678 con `screen`
466×678, `ih` 867×669 con `screen` 669×951; claro y oscuro; mide lo fijo que
toca el borde derecho, desbordes, controles bajo el cromo y errores de consola).

## Archivos de la agenda tocados

| Archivo | Qué | Por qué | Antes → después |
|---|---|---|---|
| `src/app/globals.css` (bloque `.ag-capa`) | En `ext`/`ih` con navegación, `.ag-capa` acota su `max-width` al área de contenido (`100vw − --fijo-izq − --fijo-der − 2·--ag-2`) y `.ag-capa--centro` se centra en esa área | La campana, el buscador y la ventana «Ligar e iniciar consulta» medían 320/360 px contra la ventana entera y se metían bajo el riel (hasta x 365 con el riel en 322) | `antes-encendida2/campana@ext-claro.png`, `antes-extras/ligar-dash@ext-claro.png` → `despues-encendida/campana@ext-oscuro.png`, `despues-encendida/ligar-dash@ext-claro.png` |
| `src/app/globals.css` (banda móvil) | En `ext` y SÓLO con filtro de médico, la segunda fila de la banda se parte: el conmutador Mes/Semana/Día ocupa su fila y buscador, filtro y engrane bajan a la siguiente, con el filtro a lo ancho | Con el riel la banda mide 322: el desplegable quedaba en 26 px con la v2 (encima del engrane, solapado 18 px) y en 50 sin ella, ilegible (anotado en el registro de B13) | `antes-encendida/agenda@ext-claro.png` → `despues-encendida/agenda@ext-claro.png` |
| `src/components/agenda/HorarioModal.tsx` | Fila de horas con `flex-wrap`, cada hora `min-w-[8rem]`; sin sangría de 52 px y cuerpo a 16 px por lado bajo 640 | El rediseño pone los campos a 16 px en teléfono (zoom de Safari): las horas se salían de la tarjeta en `tel` y `ext` (v2 apagada). Ahora caben en una fila en `tel`/`iv` y se apilan en `ext` | `antes-apagada/horario@ext-claro.png`, `horario@tel-oscuro.png` → `despues-apagada3/horario@ext-claro.png`, `horario@tel-oscuro.png` |

## Pruebas e2e tocadas

| Archivo | Qué |
|---|---|
| `e2e/agenda-j3-ligar-ventana.e2e.ts` «punto 7 · escudo» | llega a «Ligar» con `accionesDe` (navegación del dashboard del rediseño B5: una fila de «Después» abre hoja) |
| `e2e/agenda-f-pulido.e2e.ts` F1.7 | las dos simultáneas con paciente, en la semana siguiente (AG-DT-256: la guarda las señalaba de lunes a viernes) |

## Hallazgos NO corregidos

| Hallazgo | Por qué no | Propuesta |
|---|---|---|
| `ext`, v2: el buscador de citas se coloca A LA DERECHA de su botón (`posicionCapa` en la copia de `colocar` de `HerramientasV2.tsx`) con la ventana entera como límite: llega a x≈367, 45 px sobre el riel (`despues-encendida/buscador@ext-claro.png`). No toca el borde derecho | Es la regla de colocación (`colocar`, copiada en tres archivos, AG-DT-38) y `posicionCapa` está en `src/lib/agenda` (vedado) | pasar a `posicionCapa` la ventana menos el cromo (`--fijo-izq/--fijo-der` resueltos) en las tres copias de `colocar` y en `colocarBajo` de `CapaBarra` |
| `ext`, v2: la fecha de la primera fila de la banda queda en 0 px (seis botones de 44 en 322) | Rehacer la fila es rediseñar la banda; la fecha sigue en la cabecera de cada día de la lista | decidir con Angel qué control cede en `ext` (p. ej. «Hoy» al engrane) |
| `ext`: los cinco estados del formulario completo (`AppointmentModal`) quedan justos («Confirmada» toca los bordes de su botón) | Cosmético; cambiar la rejilla de estados toca una pieza con e2e de medidas | dos filas de estados bajo 360 px |
