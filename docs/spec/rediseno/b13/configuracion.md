# B13 · línea CONFIGURACIÓN — AG9 (configuración de la agenda) y AG10 (primera vez)

Maquetas: `S/entrega/ag-config` (cinco pestañas) y `S/entrega/ag-pv` (asistente). Capturas antes/después:
`S/b13/configuracion/antes/` y `.../despues/` (admin, médico invitado, secretaria y primera vez; 5 formatos ×
claro/oscuro). Resultados: `S/b13/configuracion/RESULTADOS.md`.

## AG9 · Configuración de la agenda (`/agenda/configuracion`, v2)

**Cómo está hecho.** Nada de `--ag-*` en la página (vive fuera de `.agenda-raiz`): tokens y primitivas del kit
(`.k-b`, `.k-campo`, `.k-tabs`/`.k-tab`, `.k-seg`, `.k-etq`, `.k-t-pantalla`, `.k-etiqueta`) y utilidades con
variantes de formato. Las clases por papel viven en `estilosConfig.ts` (`TARJETA`, `SUPERFICIE`, `LISTA`, `BLOQUE`,
`ROTULO`, `PIE`, `FILA`, `FILA_ACCION`, `FILA_GRIS`, `BOTON_*`, `CAMPO_NUEVO`, `SELECTOR`, `CAJA_AVISO`,
`AVISO_SOLO_ADMIN` + `AVISO_EN_LISTA`). Bloque nuevo `B13 · AG9/AG10 · CONFIGURACIÓN…` en `globals.css` (antes de
«AMPLIACIÓN DE LA HOJA DE TRADUCCIÓN»): `.agc-lista` (superficie con separadores con sangría), `.agc-tabs` (pista
deslizable con borde fundido en `ext`/`tel`), `select.agc-select` (flecha), `.agc-num`, `.agc-aviso` (entrada de
«Guardado») y `.agc-vacio-config` (AG10).

* Patrón de Mi perfil: cada pestaña = frase arriba + grupos (rótulo 13/700 mayúsculas `--enlace` con icono FUERA de
  una superficie `--sup`, filas, pie de ayuda 13). El `h2` de cada pestaña queda `sr-only` (lo dice la pestaña).
* Pestañas: texto SIEMPRE (antes iconos en el teléfono); en `ext`/`tel` pista que se desliza y la elegida se trae a
  la vista. Nombre accesible igual.
* Escala táctil por FORMATO: táctil (`ext`/`tel`/`iv`) 44, computadora (`ih`/`esc`) 36 (campos 40). Antes salía
  la de computadora desde 640 px (`sm:`) y en `iv` 6–15 controles por pestaña medían < 44 (capturas `antes`).
* §29.10: cada tipo de cita lleva su punto de color de 12 (`--cal-ev-*`, con su oscuro), `role="img"` y nombre
  «Color: Índigo» / «Sin color» (aro vacío).
* §29.11: `AvisoGuardado` = aviso breve del catálogo (tarjeta `--sup`, icono en círculo `--ok-*`/`--mal-*`), arriba
  y centrado en el área de contenido con los bordes de las capas (`--capa-izq/-der`, `--capa-aviso-arr`): no toca
  el borde derecho en `ext`/`ih`. Éxito 4 s, error 8 s (antes 1,8 y 6). `data-aviso-config` y textos iguales.
* `DialogoHorario` y `ConfirmacionRestablecer` → `ModalShell` (catálogo; el diálogo no se cierra con el velo; la
  confirmación es la alerta de patrón único, tono destruir, con «RESTABLECER» escrito como antes).
* Interruptor: el mismo dibujo 52×30 con colores del kit (encendido `--accion`; apagado con borde `--tinta3`,
  ≥ 3:1), área 46 en táctil y 40 en `ih`/`esc`.
* Reglas que no cambian: guardado solo y serializado (mismas rutas y `estadoAvisos`), `SOLO_ADMIN` /
  `SOLO_ADMIN_HORARIO` / `SOLO_ADMIN_TIPOS` por rol en los mismos sitios (siguen siendo el 2.º hijo del panel donde
  van al inicio), enlaces fijo/único y pausar vs revocar, «Empezar de nuevo» con RESTABLECER, `esPrimeraVez`.

Archivos: `estilosConfig.ts`, `PestanasConfiguracion`, `PestanaEnlace`, `PestanaHorario`, `PestanaConsulta`,
`PestanaMasOpciones`, `BloquesAvisos`, `AvisoGuardado`, `DialogoHorario`, `EditorDias`, `Interruptor`,
`SelectorHuso`, `FormTipoCita`, `DuracionConsulta`, `DuracionEnConsultorio`, `CrearEnlaceUnaVez`, `EnlacesDeOtros`,
`BloqueEnlacesMedico`, `FilaEnlaceReserva`, `FaltaParaEnlace`, `ConfirmacionRestablecer` (todos en
`src/components/agenda/configuracion/`), `src/app/globals.css` (sólo el bloque nuevo). Ninguno de `src/lib/agenda`.
`ConfiguracionCalendario.tsx` (vieja, sin montar) no se tocó; `ZonaRestablecer`/`FilaDisponibilidad` (de la vieja)
siguen importando lo que importaban.

## AG10 · Primera vez

* Asistente con el kit: «‹ Agenda» / «Terminar después» en texto azul, avance de barras de 4 px con su etapa a 12
  (antes 11: bajo el mínimo), cada paso en grupos (consultorios como rótulo + radios en fila; días en una superficie;
  duraciones en rejilla de 3; avisos en una sola superficie), pie «Atrás» (quieto) + «Continuar» (relleno; a todo
  el ancho en el teléfono). Cierre: palomita `--ok-*`, «Tu enlace para pacientes», «¿Es para un solo paciente?» y el
  resumen como filas con «Cambiar»; «Ir a mi agenda» relleno.
* ARREGLO del scroll: `irA` ya no llama a `window.scrollTo` (no movía `<main>`); `useArribaAlCambiarDePaso` hace
  `scrollIntoView` del principio del asistente al cambiar de paso (no en el primer pintado).
* DEFECTO «falta la duración de la consulta» en el cierre: REPRODUCIDO en la base con una e2e que retrasa 6 s la
  2.ª `GET /api/agenda/enlaces` (la que sale al continuar el horario, aún sin duración): llegaba después de las
  nuevas y la pisaba («No abrirá: falta la duración de la consulta del médico.»). Corregido en el cliente:
  `useListaEnlaces` (`ConfiguracionAgenda.tsx`) numera cada petición y sólo aplica la última. Sin tocar `src/app/api/`.
* §29.12: la lista vacía de la agenda (`renderSinEventos.tsx`, cambio mínimo; el resto del archivo es de VISTAS)
  añade un enlace «Configuración de la agenda» tras el texto de siempre; nace oculto y sólo lo muestra la raíz v2
  (`.agc-vacio-config`), así la función sigue sin saber del interruptor y conserva su identidad estable.

## Pruebas actualizadas (y por qué)

* `src/lib/tests/configuracionEscala.test.ts`: escala del KIT leída de `sistema.css` (12,13,14,15,16,17,20,26,32);
  sin `sm:/md:` en tamaños; controles 44 en táctil y ≥ 36 en `ih`+`esc` (siempre las dos); botones de
  `estilosConfig` con las dos escalas; interruptor 46/40; el bloque CSS no escribe letra. (90 casos; antes 117.)
* `agenda-l3-configuracion` 12/17: escala del kit, h1 26/32, toque 44/36.
* `agenda-m2-configuracion` 2: medidas nuevas (h1 32/26, rótulo 13, pestaña 40/44 a 14, «Agenda» 36/44, fila-acción
  44·14 / 48·15; interruptor igual).
* `agenda-k3-configuracion` 13 (teléfono): pestañas de TEXTO en pista deslizable (antes iconos), sin
  `data-titulo-pestana`.
* `agenda-h2-configuracion` 5 (teléfono): una fila que SE DESLIZA (antes «cabe sin desplazarse»).
* `agenda-h2-configuracion` 7: la regla «borde y fondo en reposo» (tanda H, punto 7, y su lista de botones de
  texto de J5) se sustituye por la de los cuatro niveles del kit: todo botón se LEE (letra ≥ 4,5:1 contra su relleno
  o su entorno); interruptores ≥ 3:1. ⚠️ Esto contradice la línea de CLAUDE.md «Los botones de la configuración
  llevan borde y fondo en reposo»: lo manda la maqueta aprobada (`ag-config`); que el orquestador actualice CLAUDE.md.
* `agenda-configuracion-guiada`: dos pruebas nuevas (respuesta atrasada de la lista; vuelta arriba al cambiar de
  paso), las dos ROJAS en la base y verdes con el cambio.

## Diferencias con las maquetas

* Interruptor 52×30 (la de `ag-config` dibuja 40×24 y la de `ag-pv` 51×31): se conserva el de la app.
* La fila-interruptor no conmuta entera: conmuta el interruptor (área 46/40); el texto sólo lo nombra.
* Enlaces de los demás médicos: «Regenerar» y «Revocar» como texto en la fila, sin menú «···».
* «Empezar de nuevo»: alerta de 340 (la del catálogo), no modal de 440.
* El asistente no lleva cabecera y pie fijos con el centro desplazable: la página entera se desplaza.
* El aviso «Sin citas esta semana» con enlace en la rejilla (vista 0 de `ag-pv`) es un aviso de página de la línea de
  VISTAS/AG1: aquí sólo va el enlace de la LISTA vacía. Petición a VISTAS: el mismo enlace en el aviso de semana vacía.

## Verificación (comprobado)

* tsc limpio; eslint 87 errores / 61 avisos (= tope); Vitest 2591/2591 sin TZ, `TZ=UTC` y `TZ=America/Hermosillo`.
* `npm run build` exit 0.
* e2e de la línea (17 archivos, escritorio + teléfono, contra :3004): 128 en verde, 3 en rojo en la 1.ª vuelta
  (`agenda-g2-turnos` 147 y 169, y h2 5, ésta por la presentación nueva, ya actualizada); repetidos h2 + g2: 15/15
  en verde (g2 147 es de las conocidas de la base; 169, arrastre, intermitente). `agenda-interruptor` y la vuelta con
  la v2 apagada de `agenda-configuracion` en verde.
* Capturas después: 190 (4 vistas × 5 formatos × 2 temas); 0 errores de consola, 0 textos < 12, 0 fijos al borde en
  `ext`/`ih`; único «pequeño» medido, el dibujo del interruptor (52×30, área 46/40 por `::before`).

## Peticiones a otras líneas / pendientes

* CLAUDE.md (orquestador): actualizar las reglas de la configuración que el rediseño cambia (escala de la reserva →
  kit; «botones con borde en reposo» → niveles del kit; «La configuración va en pestañas… iconos» en teléfono).
* `IMPLEMENTACION-REGISTRO.md`: copiar este resumen al integrar.
