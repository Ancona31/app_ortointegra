# Encargo común: maqueta de una pantalla de Spinus rediseñada

Eres diseñador de interfaz. Vas a construir la maqueta HTML, estática y navegable, del rediseño de UNA pantalla (o un grupo pequeño de pantallas hermanas) de Spinus, una PWA médica instalada en iPhone y usada también en computadora. No es código de la app. El rediseño es SOLO ESTÉTICO: visuales, layout y movimiento. No se quita ni se inventa funcionalidad.

`S` = `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad`

## Reglas duras
- No toques ningún repositorio. Escribe solo dentro de TU carpeta de entrega (te la indica tu encargo particular) y, para guiones de Playwright, en `S/tools/` con el prefijo que se te asigna. No edites nada de `S/entrega/kit/` ni de otras carpetas de entrega.
- Datos ficticios únicamente: médico «Dr. Admin Semilla», médica «Dra. Invitada Semilla», secretaria «Secretaria Semilla», clínica «Clínica Semilla A», consultorios «Centro», «Hosp Norte» y «Rehab», pacientes «Paciente Prueba 01…25» (en avatares pon el número, no «PP»), expedientes `EXP-2026-00NN`, cédula `00000001`, teléfonos `999 000 00NN`, correos `…@semilla.spinus.test`. Diagnósticos genéricos de ortopedia («Lumbago», «Gonalgia», «Esguince de tobillo»). Hoy es jueves 19 de noviembre de 2026. Nada que parezca un paciente real.
- Sin dependencias, sin fuentes web, sin imágenes externas. Iconos SVG en línea (trazo 1.8–2, `stroke="currentColor"`). Logo: glifo provisional sencillo.
- Español de México. Sin emojis.
- REGLA DE ORO: no se pierde ninguna función. Tu encargo particular te dice qué sección del inventario funcional te toca; cada función numerada de esa sección debe estar dibujada o ser alcanzable en tu maqueta (o, si es un estado de sistema como «cargando», quedar anotada en un comentario HTML). Si crees que una función sobra, NO la quites: dibújala y dímelo en el resumen.
- No inventes funciones nuevas. Si una mejora exige algo que la app no hace hoy, no la dibujes: propónla en el resumen.

## Lee antes de empezar
1. El skill de diseño que manda: `git -C /home/user/app_ortointegra show origin/main:.agents/skills/apple-design/SKILL.md` (entero).
2. EL REFERENTE DE ESTILO, ya aprobado por el dueño: el dashboard elegido, `S/entrega/dashboard/opcion-b.html`. Tu pantalla debe parecer hermana suya: misma navegación, mismas tarjetas, mismos botones, mismos chips, misma tipografía. COPIA de ahí tal cual el marcado y el CSS de la navegación (riel, encabezado fundido, barra lateral derecha, barra lateral izquierda) y de los componentes que reutilices (campo de búsqueda, botón primario/tonal/quieto, chip de estado, chip de fecha, fila de lista, avatar, hoja y modal del buscador), cambiando el prefijo de clase `.db` por el tuyo y el elemento activo de la navegación por el que corresponda a tu pantalla. No rediseñes la navegación.
3. Los tokens: `S/entrega/kit/base.css`. Úsalos SIEMPRE. Colores literales solo `#fff` sobre navy/acción y pasteles de avatar. No definas tokens de color nuevos: así el oscuro funciona solo.
4. El inventario funcional: `S/informes/funciones-componentes.md` — la sección que te indique tu encargo, más «A0 · Cromo global» y el «Anexo — Las ⚠️ que más riesgo corren».
5. Cómo es la pantalla HOY (capturas; ábrelas con Read): tu encargo te lista los archivos. Están en `S/cap/` (teléfono claro: `nombre@ext.png` 466×678, `@iv` 669×951, `@ih` 951×669), `S/cap-oscuro/`, `S/cap-escritorio/` (`nombre@d-claro.png`, `@d-oscuro.png`, y `-2` desplazada) y `S/cap-modales/` (estados interactivos: `NN-…@ext.png` y `@d.png`; su índice comentado está en `S/informes/capturas-modales.md`).
6. Si necesitas ver el código real de la pantalla para entender una función (solo lectura): `S/app/src/…` (copia de la rama `feature/agenda-v2`).

## Sistema visual (obligatorio)
- Tipografía: fuente del sistema (viene en `.marco`). Roles: título de pantalla 26 px en `ext` y `tel` / 32 px en `ih` y `esc`, peso 800, letter-spacing −0.6px; sección 20/700; título de tarjeta 17/700; fila 15/600; cuerpo 15 (14 en `esc`); secundario 13 en `var(--tinta2)`; rótulo en mayúsculas 12/600 +0.3px; chip 12/600; mínimo absoluto 11. Texto de campos 16 px en `ext`/`tel`. Números tabulares en horas, fechas, folios y tablas. Etiqueta de campo: 13/600 en `var(--tinta2)`, encima del campo, en minúsculas con mayúscula inicial.
- Color: fondo `--fondo`; tarjetas `--sup` SIN borde ni sombra; campos con relleno `--sup2` y sin borde (contorno de 2px `var(--enlace)` al enfocar); botón tonal `--tonal` con texto `--tonal-tinta`; primario `--accion` con texto blanco y `--sombra-accion`; destructivo `--mal-fondo` con `--mal-tinta`; navegación `--navy` opaco. UN solo botón primario por pantalla. Chips de estado de cita: Agendada `--ag-fondo`/`--ag-tinta`/`--ag-punto`; Confirmada `--tonal`/`--tonal-tinta`; Atendida `--ok-fondo`/`--ok-tinta`; Cancelada `--mal-fondo`/`--mal-tinta`; No asistió `--sup2`/`--tinta2`. Éxito `--ok-*`, error `--mal-*`, aviso `--ag-*`.
- Radios: 12 botones y campos; 16 tarjetas en teléfono, 18–20 en `ih` y `esc`; 26 la navegación (solo del lado del contenido); 999 píldoras.
- Espacio: rejilla de 4 (4·8·12·16·20·24·32). Margen de página 16 en teléfono, 24 en `ih`/`esc`. Entre tarjetas 12 en teléfono, 14–16 en lo demás.
- Ancho de contenido en `esc`: el contenido empieza siempre en el mismo borde (24 px a la derecha de la barra lateral) y no supera ~1000 px de ancho útil; formularios y lectura, columna de 640–720 px alineada a ese mismo borde izquierdo (NO centrada: hoy cada pantalla empieza en un x distinto y el título salta al navegar).
- Encabezado de pantalla, igual en todas: (opcional) enlace de volver «‹ Sección» en 13/600 `var(--enlace)` → título de pantalla → (opcional) una línea secundaria. Acciones de la pantalla a la derecha del título en `ih`/`esc`; debajo, o en una barra de acción fija al pie, en `ext`/`tel`. Sin migas de pan.
- Áreas de toque: mínimo 44×44 en `ext`/`tel` (una píldora puede dibujarse de 36 de alto si su área real llega a 44 con `::after`); 36 mínimo en `ih`/`esc`.
- Respuesta al toque: todo lo pulsable con `:active{transform:scale(.97)}` y `transition: transform 100ms ease-out`; foco visible (`:focus-visible`, contorno 3px `var(--enlace)`; sobre navy, `var(--nav-tinta)`).
- Movimiento: solo `transform` y `opacity`; entrada y salida por el mismo camino; sin bucles decorativos; respeta `prefers-reduced-motion`.
- Nada de información que solo viva en `title` (invisible al tocar): icono + texto corto.
- Jerarquía: lo más importante es lo más evidente; el camino común primero, lo avanzado un nivel más abajo; acciones destructivas discretas pero encontrables, nunca como primario.

## Navegación y franja del sistema (obligatorio; cópiala del referente)
`base.css` define cuatro marcos con variables que hacen de `env(safe-area-inset-*)`: `--it`, `--ir`, `--ib`, `--il`. Úsalas siempre en `calc()`; nunca escribas 84 o 34 fijos.
- `data-vp="ext"` — iPhone Duo cerrado, 466×678; franja de 84 a la derecha (`--ir`), indicador de 34 abajo (`--ib`). RIEL a la derecha (Inicio, Pacientes, Agenda, Documentos, Más, y el «+» de Nueva consulta abajo). Sin encabezado con hamburguesa.
- `data-vp="tel"` — iPhone normal vertical, 393×852; barra de estado arriba (`--it`). ENCABEZADO FUNDIDO navy con botón de menú, título de la sección y avatar.
- `data-vp="ih"` — Duo abierto horizontal, 951×669; franja de 84 a la derecha. BARRA LATERAL A LA DERECHA. Ningún control FIJO entre x=455 y x=496 (bisagra); lo que se desplaza sí puede pasar.
- `data-vp="esc"` — computadora, 1280×800. BARRA LATERAL A LA IZQUIERDA de 248 px.
Elemento activo de la navegación según la sección: Pacientes para todo lo de expedientes y pacientes; Documentos; Administración (Estadísticas, Usuarios, Facturación); Mi perfil y Ayuda viven en «Más» (riel), en el menú (encabezado) o al pie de la barra lateral.
Desplazamiento: la navegación queda fija y el contenido se desplaza DENTRO del marco (`overflow-y:auto`, `padding-bottom: calc(var(--ib) + 16px)`). Las barras de acción fijas al pie respetan `--ib` y, en `ext`, terminan antes del riel. Las capas (hojas, modales, menús, avisos) van en posición absoluta dentro de `.marco`, nunca `position: fixed`, y respetan los cuatro insets.

## Capas (misma regla para toda la app)
- Hoja: en `ext`/`tel` sube desde abajo con asa, velo `var(--velo)`, esquinas superiores de 22; en `ih`/`esc` es un modal centrado en el contenido (en `ih`, sobre la mitad izquierda, x < 455). Para tareas cortas: filtros, selección, alta rápida, confirmaciones con formulario.
- Pantalla completa (teléfono) / modal ancho (computadora): formularios largos.
- Alerta centrada con velo: SOLO acciones destructivas o irreversibles; botón destructivo + «Cancelar».
- Menú: nace del botón que lo abre (`transform-origin` hacia el botón); para «tres puntos» y similares. En `ext`/`tel` puede ser una hoja corta de acciones.
- Aviso emergente (toast): arriba, centrado en el contenido, nunca abajo a la derecha.
- Animación de maqueta: `transform`/`opacity`, ~320 ms `cubic-bezier(.32,.72,0,1)` al entrar y al salir (en la app será un resorte; anótalo en un comentario).

## Formato de entrega (estricto; el ensamblador depende de él)
Tu encargo particular te dice cuántos archivos `vista-<nombre>.html` entregar y con qué prefijo de clase. Cada archivo contiene, en este orden y SIN `<html>`, `<head>`, `<body>` ni `<title>`:
1. Primera línea: `<!-- NOMBRE: <nombre de la pantalla> | <una frase que explique al dueño qué cambió respecto a hoy> -->`
2. Un `<style>` donde TODOS los selectores empiezan por tu prefijo de clase. Nada global, ni `:root`, ni `body`, ni `.marco` a secas.
3. Cuatro marcos hermanos en este orden: `<div class="marco PREFIJO" data-vp="ext">…</div>`, luego `tel`, `ih`, `esc`. Sin `display` propio en el marco (el ensamblador alterna `style.display` entre `block` y `none`; si necesitas flex, pon un contenedor interior que ocupe todo el marco).
4. Un `<script>` en IIFE que solo actúe dentro de `document.querySelectorAll('.PREFIJO.marco')`. Sin ids repetidos entre marcos ni entre archivos.
Estados alternos (vacío, error, otro rol, pestañas, capas abiertas) deben ser alcanzables de verdad: pestañas y botones reales cuando existen en el producto; cuando no hay forma natural de llegar (p. ej. «lista vacía», «ver como secretaria»), un botón punteado de maqueta rotulado «Maqueta: …», colocado ARRIBA del contenido, no al final.

## Comprueba tu trabajo antes de entregar (obligatorio)
- Ensambla: `python3 S/entrega/kit/build.py <tu carpeta> "<título>"` genera `<tu carpeta>/pagina.html` (un fragmento con todas tus vistas). Para verlo, envuélvelo en `tmp-ver.html` con `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` + el contenido.
- Con Playwright (ya instalado; NO instales nada; ejecuta node desde `S/tools/`) abre la página a 1440×1000 y, para CADA vista, CADA dispositivo y CADA tema (botones de la página: «Duo cerrado», «iPhone», «Duo abierto», «Computadora»; «Claro», «Oscuro»; «Marcar franja»), captura: la primera pantalla, el contenido desplazado, y cada estado alterno y capa. Guarda en `<tu carpeta>/tmp-cap/` y MIRA con Read: todas las de `ext` y `esc` en claro, las primeras pantallas de `ext` y `esc` en oscuro, y al menos la primera pantalla de `tel` e `ih`.
- Corrige hasta que: no haya texto cortado ni solapado; nada pulsable ni legible quede dentro de la franja ni sobre el indicador inferior; el oscuro sea legible; las cuatro composiciones sean la misma idea adaptada; en `esc` no haya media pantalla vacía ni controles estirados a 1000 px.
- Mide con un guion: ningún control visible con área menor de 44×44 en `ext`/`tel` ni menor de 36 en `ih`/`esc`; ningún texto con `font-size` menor de 11; ningún control fijo en x 455–496 en `ih`; 0 errores de consola.
- Repasa la lista numerada de funciones de tu sección del inventario, una por una, y anota dónde quedó cada una.

## Qué me devuelves
Un resumen de máximo 35 líneas: qué cambió respecto a hoy y por qué es mejor (concreto); cómo se adapta a cada marco; la tabla función → dónde quedó (puede ser compacta por rangos, pero sin omitir ninguna); estados y capas dibujados; qué comprobaste de verdad (capturas vistas, mediciones); defectos funcionales o de contenido que hayas notado en la app actual (solo repórtalos); y, con franqueza, lo que no quedó bien o no alcanzaste a hacer.
