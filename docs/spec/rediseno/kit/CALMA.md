# Reglas de calma (enmienda al BRIEF.md; donde choquen, MANDA ESTE DOCUMENTO)

El dueño revisó las maquetas de expediente y de nueva nota y las rechazó con estas palabras: «muy cargado», «mucha fricción», «demasiado ruido visual», «demasiadas cosas para ver y muy amontonadas, no se entiende», «da la impresión de algo sucio, poco pulcro», «botones muy grandes». En cambio le gustaron el dashboard (`S/entrega/dashboard-final/vista-dashboard.html`) y las pantallas de cuenta. Tu trabajo es demostrar que la misma pantalla, con las mismas funciones, puede verse LIMPIA. El criterio de éxito es la primera impresión: serenidad, aire, una sola cosa importante por pantalla.

Las maquetas rechazadas fallaron porque interpretaron «no se pierde ninguna función» como «todo a la vista», «44 px de área» como «botones rellenos de 44 px», e «icono + texto» como «todo rotulado y con fondo». Estas reglas corrigen eso.

## 1. Una sola cosa importante por pantalla
- Decide cuál es LA información o LA acción de cada pantalla y dale todo el peso. Lo demás baja de volumen o baja un nivel (menú, hoja, sección plegada).
- «Ninguna función se pierde» significa que sigue ALCANZABLE en uno o dos toques, no que esté visible. El camino común a la vista; lo ocasional (editar, exportar, eliminar, filtros finos, datos secundarios) detrás de «Más», de una fila plegable o de una hoja.
- Un solo botón relleno de color de acción por pantalla. Si la navegación ya ofrece esa acción en ese marco, no la repitas en el contenido.

## 2. Botones: el área de toque no es el dibujo
- El ÁREA sensible sigue siendo ≥ 44×44 en `ext`/`tel` y ≥ 36 en `ih`/`esc` (con `::after` o padding transparente). El DIBUJO es más pequeño y más ligero.
- Jerarquía de cuatro niveles; usa el más bajo que sirva:
  1. Primario (uno por pantalla): relleno `--accion`, alto dibujado 40 en teléfono y 34–36 en ancho, ancho según su texto (NO a todo el ancho, salvo en una barra fija al pie de un formulario), SIN sombra.
  2. Tonal: `--tonal`/`--tonal-tinta`, alto 36 / 32. Como mucho uno junto al primario.
  3. Texto: solo texto en `--enlace`, peso 600, sin fondo ni borde. Es el nivel por defecto para acciones secundarias.
  4. Icono: glifo de 20 px en `--tinta2`, sin fondo (fondo solo al pulsar). Para acciones universales (más «···», editar, cerrar, volver). Lleva `aria-label`; no necesita rótulo visible.
- Nada de filas de tres o cuatro botones con icono y fondo. Si hay más de dos acciones, la tercera en adelante va a «···».
- Las filas de una lista son pulsables enteras y terminan en una flecha «›» tenue. NO llevan botón propio («Ver», «Leer nota», «Iniciar»…), salvo que la fila tenga dos destinos distintos de verdad.

## 3. Menos tinta
- Píldoras y chips con fondo SOLO para estado que cambia una decisión (estado de cita, «Fuera de rango», «Borrador»). Contadores, códigos (CIE-10, folios), tipos y fechas van como texto plano en `--tinta2`. Máximo un chip por fila.
- Nada de caja dentro de caja: dentro de una tarjeta no hay mosaicos, azulejos ni sub-tarjetas con fondo. Los datos van como lista de pares «rótulo — valor» separados por una línea fina `--linea`, o como texto.
- Las alertas clínicas (alergias) NO son un bloque de color sólido. Son una etiqueta: icono de aviso + texto en `--mal-tinta` sobre `--mal-fondo`, radio 8, alto ~26, pegada a la identidad del paciente y visible en todas las pestañas.
- Iconos: solo donde ayudan a reconocer (navegación, tipo de documento, acción de icono). No pongas icono delante de cada rótulo, botón o dato. Todos en un solo color (`--tinta2`), sin cuadritos de fondo de colores.
- Avatares: uno por paciente como mucho, pequeño (32–36). En listas largas puedes prescindir del color pastel y usar `--sup2` con texto `--tinta2`.
- Sin sombras en tarjetas ni botones. Sombra solo en capas (hojas, modales, menús) y en la navegación.
- Líneas: separadores `--linea` de 1 px entre filas; sin bordes alrededor de tarjetas; sin subrayados decorativos.

## 4. Tipografía con jerarquía de verdad
- Pesos: 400 para todo el texto corriente y los valores; 600 solo para el título de una fila o el nombre de un campo importante; 700 para títulos de tarjeta y de sección; 800 SOLO para el título de pantalla. Si en una pantalla hay más de tres cosas en 700+, sobra negrita.
- Tamaños del sistema (BRIEF.md) sin excepciones hacia abajo: nada por debajo de 12 px salvo el mes del chip de fecha. Si no cabe, no encojas la letra: quita cosas o reordena.
- Rótulos en mayúsculas: con moderación; uno por tarjeta como mucho. No conviertas cada etiqueta en mayúsculas.
- Texto de ayuda: una línea, solo donde evita un error. Fuera las explicaciones de lo evidente.

## 5. Aire
- Entre grupos: 24–28 px en teléfono, 28–32 en ancho. Dentro de un grupo: 12–16.
- Filas de lista: 56–60 px de alto en teléfono con dos líneas (título + secundaria); 48–52 en ancho. Relleno de tarjeta 16 (teléfono) / 20 (ancho).
- El contenido no toca los bordes de su tarjeta ni se pega a la franja o al riel: margen de página 16 en teléfono.
- La primera pantalla debe poder leerse de un vistazo: como guía, no más de 5–7 elementos distintos visibles antes de desplazar en `ext`.

## 6. Cabeceras compactas
- La cabecera de una pantalla (volver, título, acciones) ocupa como mucho ~110 px en `ext`/`tel` antes de que empiece el contenido o las pestañas. Sin botones grandes dentro de la cabecera.
- Enlace de volver: solo la flecha «‹» y el nombre de la sección en 13/600 `--enlace`; a su derecha, en la misma fila, las acciones de icono.
- Pestañas: texto 13–14, peso 600 la activa y 400 las demás, subrayado de 2 px en la activa, repartidas a lo ancho con aire; el contador, si se muestra, como número plano en `--tinta2` (sin píldora). Nunca a 12 px ni apretadas.

## 7. Controles de maqueta FUERA del teléfono
Los botones «Maqueta: …» ya no van dentro del marco. En tu `<script>`, al iniciar, crea una tira de controles y muévela a la cabecera de tu sección en la página: `marco.closest('.op').querySelector('header').appendChild(tira)` (si `.op` no existe —cuando pruebas el archivo suelto— déjala antes del primer marco). Una sola tira controla los cuatro marcos a la vez. Estílala con tu prefijo (píldoras punteadas pequeñas); sus selectores no pueden depender de `.marco`.

## 8. Lo que NO cambia
- Tokens de `S/entrega/kit/base.css`, navegación (riel, encabezado fundido, barras laterales), franja del sistema, capas, formato de entrega y comprobaciones del BRIEF.md siguen vigentes.
- El oscuro debe quedar igual de limpio.
- Ninguna función desaparece: al final debes poder decir dónde quedó cada una.

## Comprobación adicional (obligatoria): la prueba del vistazo
Después de construir, mira tu captura de la primera pantalla de `ext` y de `esc` durante unos segundos y responde con franqueza en tu resumen: ¿qué es lo primero que se ve?, ¿cuántos elementos compiten por la atención?, ¿hay algo que parezca amontonado? Cuenta en `ext` (primera pantalla, sin desplazar): botones con fondo, chips con fondo, iconos, y textos en peso ≥ 700. Objetivo: ≤ 1 botón relleno de acción, ≤ 2 botones con fondo en total, ≤ 3 chips, ≤ 3 textos en 700+. Si no cumples, sigue quitando.

## 9. Color por tipo de documento (decisión del dueño, posterior a las reglas de arriba)
El dueño asocia cada tipo de documento a un color para reconocerlo de memoria sin leer. Ese color SE CONSERVA; es la única excepción a «iconos de un solo color». Los ocho tonos ya están en `base.css` como `--d-receta`, `--d-laboratorio`, `--d-imagen` (Imagenología), `--d-suplementacion`, `--d-internamiento`, `--d-escrito` (Escrito médico), `--d-consentimiento`, `--d-honorarios` (con sus valores de oscuro). Siempre el mismo tono y el mismo icono por tipo, en toda la app. Iconos (trazo 1.8, 24×24): cópialos tal cual de `S/entrega/doc-color/color-documentos.html`.
- EN LISTAS de documentos ya existentes o de tipos en fila (documentos del paciente, documentos recientes, actividad clínica cuando la entrada es un documento): «nivel 3» = el icono del tipo, de 20 px, pintado con su `--d-*`, SIN fondo, a la izquierda del nombre. El nombre sigue en `--tinta`.
- EN LA REJILLA PARA ELEGIR QUÉ DOCUMENTO CREAR (aparece en tres sitios: `/documentos` tras elegir paciente, «Nuevo documento» dentro del expediente, y después de guardar una nota): «nivel 4» = azulejos `--sup` de radio 14 en rejilla de 4 columnas en ancho y 2 en teléfono, cada uno con el icono de 20 px en su `--d-*` dentro de un cuadro de 32 px y radio 9 con fondo `color-mix(in srgb, var(--d-X) var(--d-mezcla), var(--sup))`, y debajo el nombre en 14/400 `--tinta`. Toda la celda es pulsable (alto ≥ 76). Elegir qué crear = rejilla; ver lo ya creado = lista. No sustituyas la rejilla por una lista.
- Fuera de esos dos usos, el color de documento no se usa (ni en títulos, ni en botones, ni en bordes).

## 10. Textos del producto
No cambies rótulos, nombres de botones ni mensajes que existen hoy en la app (aunque te parezcan mejorables o estén en inglés): cópialos del código o de la maqueta anterior tal cual. Si crees que un texto debe cambiar, propónlo en tu resumen. Tampoco añadas avisos, botones ni textos de ayuda que hoy no existan; propónlos.

# SEGUNDA REVISIÓN DEL DUEÑO — secciones 11 a 16 (MANDAN sobre las secciones 1 a 10 donde choquen)

El dueño aprobó la dirección limpia, pero al ver las pantallas completas dijo: «no me gusta que todo salga en texto plano», «puro texto negro con poca jerarquía marcada, no parece de Apple», «poca jerarquía», «antes teníamos avatares; no eran útiles pero hacían más amigable la lista», «el menú de 3 puntos todo en negro», «algunos modales no tienen botones, se ve texto plano donde debería haber un botón». Nos pasamos de limpios. El objetivo ahora es LIMPIO CON CARÁCTER: el mismo aire y el mismo orden, pero con acentos de color sutiles, iconos y jerarquía clara. No vuelvas al ruido de antes (cajas dentro de cajas, filas de botones, negrita en todo): añade carácter con poco.

## 11. Carácter: color e iconos sutiles (corrige §3)
- Estados y sellos SÍ llevan color e icono, en versión suave: etiqueta de alto ~24, radio 8, icono de 14 + texto 12/600, fondo tintado muy claro y tinta del mismo tono. Usa los pares de `base.css`: `--tonal`/`--tonal-tinta` (informativo: «Nota manual», «Nota IA»), `--ok-fondo`/`--ok-tinta` (firme/positivo: «Nota sellada», «Atendida», «Sellado»), `--ag-fondo`/`--ag-tinta` (pendiente/aviso: «Borrador», «Agendada»), `--mal-fondo`/`--mal-tinta` (alerta: alergias, «Urgente», «Fuera de rango»). Como mucho dos etiquetas juntas.
- Avatares: VUELVEN en listas de personas y en la identidad del paciente. Círculo de 36 (32 en `ext` si hace falta) con iniciales o número en 13/600, sobre un pastel suave con tinta del mismo tono (usa 6 pares pastel repartidos por paciente; son los únicos literales de color permitidos además de `#fff`). Dan calidez a la lista.
- Menús («···», hojas de acciones, popovers): cada opción lleva su icono de 18–20 a la izquierda. Los iconos de las acciones normales van en `--accion` (o `--enlace` en oscuro), no en negro; el texto en `--tinta`. La acción destructiva lleva icono y texto en `--mal-tinta`, separada por una línea.
- Iconos de tipo con color (regla §9) también para ARCHIVOS CLÍNICOS: cada tipo de archivo lleva su icono de 20 px en color, sin fondo, igual que los documentos. Mira en el código (`S/app/src/components/labs/`, tipos de archivo) qué tipos existen y si ya tienen color; si no, usa `--d-imagen` para estudios de imagen, `--d-laboratorio` para resultados de laboratorio, `--d-escrito` para informes/otros documentos, y `--tinta2` para «Otro».
- Acciones de texto: en `--enlace` y peso 600, como hasta ahora; pero cuando una acción es la importante de una tarjeta o sección, puede ser un botón tonal pequeño (alto 32–36) en lugar de texto.

## 12. Jerarquía tipográfica con color (corrige §4)
- Un documento o una nota NO es un bloque de texto negro. Dale estructura al estilo de las apps de Apple (Notas, Salud): títulos de sección como rótulo en `--accion` (o `--enlace` en oscuro), 13/700, en mayúsculas con letter-spacing .4px, con 20–24 px de aire encima; cuerpo en 15/22 `--tinta`; datos secundarios en `--tinta2`. Diagnósticos destacados (17/700) con su código CIE-10 en una etiqueta tonal pequeña. Datos clave (signos vitales, próxima cita) como pares con el rótulo en `--tinta2` 12 y el valor en 15/600.
- En listas: el título de la fila en 15/600 `--tinta`; la línea secundaria en 13 `--tinta2`; el dato de la derecha en 13 `--tinta2` o, si es el que ordena la lista, en 13/600 `--tinta`. Los títulos de sección de una pantalla en 17/700.
- Texto corrido de notas y de mensajes de modal: JUSTIFICADO (`text-align: justify; hyphens: auto;` y `lang="es"` en el contenedor, para que la justificación no abra ríos de espacio). Títulos, rótulos, listas cortas y filas no se justifican.

## 13. Modales, alertas y hojas (corrige §2 para las capas)
- Dentro de una capa, las acciones son BOTONES de verdad, nunca texto suelto: el principal relleno (`--accion`, o `--mal-tinta` sobre blanco/relleno rojo suave si es destructivo) y el secundario TONAL (`--tonal`/`--tonal-tinta`) o quieto con fondo `--sup2`. Alto dibujado 44 en teléfono, 36–40 en ancho.
- Alerta de confirmación (patrón único en toda la app): tarjeta centrada de 300–340 px, radio 20, relleno 24; arriba un icono de 28 en un círculo tintado de 48 (tonal para confirmar, rojo suave para destruir, ámbar para avisar); título 17/700 CENTRADO; mensaje 14/20 `--tinta2` justificado o centrado si es de una sola línea; y abajo DOS botones del mismo ancho, lado a lado, centrados (secundario a la izquierda, principal a la derecha), con rótulos cortos de una o dos palabras para que queden parejos. Si un rótulo de hoy es largo, parte en dos líneas la alerta apilando los botones a todo el ancho (principal arriba).
- Posición: en `esc` toda capa va CENTRADA en el área de contenido (la zona a la derecha de la barra lateral), en horizontal y en vertical. En `ih` también va centrada en el área de contenido (la zona a la izquierda de la barra lateral derecha), aunque cruce la bisagra: para capas transitorias el dueño prefiere que se vean centradas a que queden en una esquina; procura que sus botones no caigan justo en x 455–496. En `ext`/`tel`, hoja desde abajo (o alerta centrada en el contenido, sin entrar en la franja).
- Velo con DESENFOQUE (el dueño lo quiere de vuelta): detrás de toda capa, `background: var(--velo); backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%);`. Un solo velo a la vez (nunca apilado). Con `@media (prefers-reduced-transparency: reduce)` quita el desenfoque y sube la opacidad. Al entrar, el velo funde opacidad; la capa sube/escala por su camino.
- Rejillas dentro de capas (p. ej. la de tipos de documento): ningún texto puede salirse de su celda. Nombres largos («Honorarios / Cotización», «Consentimiento», «Suplementación») parten en dos líneas centradas o alineadas a la izquierda dentro de la celda (alto de celda ≥ 84), con `overflow-wrap: anywhere` como último recurso; comprueba las ocho celdas en los cuatro marcos.

## 14. Computadora: columnas centradas
- Los formularios y las pantallas de lectura ya NO se alinean al borde izquierdo dejando una banda vacía a la derecha. En `esc`, la columna de formulario o de lectura (640–720 px) va CENTRADA en el área de contenido, con su cabecera (volver, título, acciones) alineada a los bordes de esa misma columna. Las pantallas de lista, tabla o varias columnas siguen ocupando el ancho disponible desde el borde común.

## 15. Textos decididos por el dueño
- La lista de pacientes se titula «Expediente».
- La acción destructiva del expediente se llama «Eliminar paciente» (en el menú y en el título de su alerta).
- En el modal de guardar nota, el botón secundario dice «Revisar» (hoy «Volver a revisar»), para que los dos botones queden parejos.
- Lo demás sigue la regla §10 (textos de hoy; proponer cambios aparte).

## 16. Prueba del vistazo, recalibrada
Los topes de §«Comprobación adicional» cambian: ≤ 1 botón relleno de acción y ≤ 2 botones con fondo siguen; chips/etiquetas con color ≤ 4; textos en 700+ ≤ 4; los avatares y los iconos de tipo con color no cuentan como ruido. La pregunta ya no es solo «¿hay algo amontonado?» sino también «¿se ve plano, todo del mismo gris/negro?». Si la respuesta a la segunda es sí, falta carácter.

# TERCERA REVISIÓN DEL DUEÑO — secciones 17 a 22 (MANDAN sobre todo lo anterior donde choquen)

El dueño aprobó la segunda revisión («las correcciones salieron bien»). Esta tercera es una pasada de UNIFICACIÓN: no rediseñes nada aprobado; aplica solo lo que sigue, con el mismo lenguaje.

## 17. Duo cerrado (`ext`): botones de acción cortos
«Los botones de nuevo paciente, nueva consulta, nuevo documento ocupan demasiado espacio» en `ext`. SOLO en `ext`, esos botones se rotulan con «+» y una palabra: «+ Paciente», «+ Consulta», «+ Documento» (icono «+» de 16 y el sustantivo; `aria-label` con el rótulo completo de hoy). Compactos: alto dibujado 36–40, ancho según su texto. En `tel`, `ih`, `iv` y `esc` conservan su rótulo completo. Aplica en toda pantalla donde aparezcan (lista de pacientes, expediente, dashboard, tarjetas de documentos).

## 18. La bisagra ya no condiciona las capas
El dueño: «por mí que se quede en el centro, no importa el pliegue». Modales, alertas, hojas y menús centrados en `ih` van CENTRADOS en el área de contenido sin ninguna maniobra para esquivar x 455–496: sin huecos entre columnas, sin botones corridos a la izquierda, sin anchos reducidos por ese motivo. Usa en `ih` los mismos anchos y la misma disposición de botones que en `esc`. (La cabecera de página que separa «quién» a la izquierda y «acciones» a la derecha del pliegue se queda: eso gustó.)

## 19. Quinto marco: Duo abierto en VERTICAL (`data-vp="iv"`)
`base.css` ya define `.marco[data-vp="iv"]`: 669×951, barra de estado arriba (`--it` = 82) y SIN franja abajo (`--ib` = 0, corregido por el usuario: en vertical solo hay franja superior, en web y en PWA); sin franja lateral. Cada vista entrega ahora CINCO marcos, en este orden: `ext`, `tel`, `ih`, `iv`, `esc`.
- Navegación de `iv` = ENCABEZADO FUNDIDO como en la maqueta de referencia del dueño (`/root/.claude/uploads/c6f872cd-9586-537f-8cbb-7c91e620cbb1/f47e202d-maqueta-interior-vertical.html`, léela): banda `--navy` desde el borde superior, `padding: calc(var(--it) + 0px) 16px 14px`, `border-radius: 0 0 26px 26px`, `box-shadow: var(--sombra-nav-sup)`. Dentro, en una fila: a la izquierda un botón redondo de 44 «Mostrar barra lateral» (`background: var(--nav-velo)`, icono blanco) que abre el menú completo; al centro, una pista redondeada (`background: var(--nav-velo)`, radio 26, relleno 4) con las secciones como píldoras de 40 de alto: «Inicio», «Expediente», «Agenda», «Documentos» (la activa con fondo `--accion` y texto blanco 15/600; las demás `--nav-tinta` 15/500); a la derecha, el avatar de 44. Administración, Mi perfil y Ayuda se alcanzan desde el botón de la izquierda o el avatar.
- Contenido de `iv`: margen de página 24, 621 px útiles. NO es el teléfono estirado: usa la composición de `ih` (dos columnas donde `ih` las tenga; lista + detalle si caben ≥ 280 px por panel; formularios y lectura en columna de 560–600 centrada). Títulos de pantalla a 32 px. Áreas de toque ≥ 44 (es táctil). Capas: modales y alertas centrados en el marco, con los anchos de `ih`; nada de hojas desde abajo salvo que la capa sea un formulario largo.
- La primera pantalla de `iv` tiene 951 de alto: aprovéchala; no dejes la mitad inferior vacía si hay contenido que mostrar.

## 20. Textos aprobados por el dueño (sustituyen a lo que hubiera)
- Navegación: la sección se llama «Expediente» en TODAS partes (barra lateral, `aria-label` del riel, título del encabezado fundido de `tel`, píldora de `iv`), igual que el título de la lista. Ya no aparece «Pacientes» como nombre de sección. Los enlaces de volver dicen «‹ Expediente».
- Nueva nota: el título de pantalla es «Nueva nota» y el botón principal «Generar con Spinus».
- Suplementación: la fila que abre el catálogo dice «Agregar suplemento».
- Alertas: los botones «Cambiar a X» y «Gestionar plantillas» se acortan a «Cambiar» y «Gestionar» para que queden parejos lado a lado (el título de la alerta conserva el nombre completo). Títulos y botones nuevos aprobados: «Paciente duplicado», «No se pudo guardar», «Aceptar».
- La frase del día («Tus pacientes te esperan») SE QUITA de toda la app.
- La casilla del consentimiento de privacidad a la derecha de su texto: aprobada.
- Texto JUSTIFICADO: se queda en todos los marcos, también en `ext` y en los mensajes de alerta (el dueño lo prefiere así). Mantén `hyphens:auto` y `lang="es"`.

## 21. Detalles a igualar entre pantallas
- Menús desplegables («···», orden, filtros, selects) en `esc`: nacen de su botón y NO llevan velo ni desenfoque. El velo desenfocado es solo para modales, alertas y hojas. En `ih`/`iv`, el «···» puede ser tarjeta centrada con velo.
- Rejilla de tipos de documento, idéntica en toda la app: título «Tipo de documento»; hoja con fondo `--sup`; celdas con fondo `--sup2`, radio 14, alto mínimo 84 (88 en ancho), icono en cuadro tintado de 32 arriba y nombre 14/18 debajo; la celda del tipo actual con contorno de 2 px `--accion`; 2 columnas en `ext`/`tel`, 4 en `ih`/`iv`/`esc`.
- Alertas: 320 de ancho en `ext`/`tel`, 340 en `ih`/`iv`/`esc`; dos botones lado a lado.
- Pie de hoja/modal en `ih`/`iv`/`esc`: botones a la derecha, ancho mínimo 104.

## 22. Comprobación de esta pasada
Captura y MIRA con Read, por cada vista: la primera pantalla de los CINCO marcos en claro (sobre todo `iv`, que es nuevo, y `ext`, por los botones cortos), una capa en `ih` y otra en `iv`, y la primera pantalla de `ext` y `esc` en oscuro. Mide como siempre (áreas de toque, texto mínimo, franja/barra de estado, solapes, centrado de capas, 0 errores de consola) incluyendo `iv`. En tu resumen di con franqueza qué quedó flojo en `iv`.

## 23. Cuarta pasada (pasada corta) — decisiones aprobadas por el usuario el 20-nov
Aplica SOLO lo que toque a tus vistas. No rehagas nada más. Los textos nuevos de esta sección están aprobados.

1. **Barra del pie de formularios (`ih`, `iv`, `esc`):** secundario a la izquierda del principal, principal a la DERECHA. En `ih` y `esc` el par va pegado a la derecha de la columna. En `iv` el par va CENTRADO en la columna (mismo orden: secundario, principal), porque en modo web el navegador flota controles en las dos esquinas inferiores; ninguna acción del pie de `iv` a menos de 96 px de los bordes laterales del marco.
2. **Tras generar un documento:** «Descargar» en todos los marcos. Nada de «Compartir».
3. **Alertas con rótulos largos:** rótulos completos de hoy, botones apilados (principal arriba). No acortar.
4. **Receta:** la alergia del paciente aparece en la cabecera (etiqueta roja con icono «Alergias: Penicilina», bajo el nombre y la edad). Sin alergias registradas no se dibuja nada.
5. **Lista de pacientes en `iv`:** la edad baja bajo el nombre («61 años · Femenino»), se quita la columna Edad.
6. **Tabla de mediciones:** encabezados «Analito · Último valor · Estado · Fecha» aprobados.
7. **Aviso de duplicado en `ext`:** tres botones apilados, principal arriba.
8. **Regreso desde una nota (nueva nota y nota de consulta):** «‹ Paciente Prueba 01» (el nombre del paciente), no «‹ Expediente».
9. **Quinta píldora «Más» en `iv`, EN TODAS LAS VISTAS:** la pista queda «Inicio · Expediente · Agenda · Documentos · Más», mismo dibujo. «Más» abre el mismo menú que el «···» del riel de `ext`. Va marcada en Estadísticas, Usuarios, Facturación y Centro de ayuda. En Mi perfil sigue marcado el avatar. La pista sigue centrada; si no cabe con el botón de barra lateral y el avatar, reduce el padding horizontal de las píldoras (mínimo 12), no la letra.
10. **Facturación:** «funciones» en vez de «features», «Prueba» en vez de «Trial».
11. **Mi perfil:** el grupo «Ajustes» queda aprobado; quita la etiqueta «Propuesta sin decidir».
12. **Estadísticas:** botón «Reintentar» en el estado de error, aprobado.
13. **Dashboard:** la semana en tarjeta se queda solo en `iv`.
14. **Velo oscuro:** `base.css` ya lleva `--velo: rgba(0,0,0,.35)` en oscuro. No lo redefinas.
15. **`iv` no tiene franja inferior** (`--ib:0`): nada de 34 fijos.

Comprobación: reensambla con el `base.css` actual, captura y MIRA con Read lo que cambiaste en cada marco afectado (claro) y uno en oscuro; mide solapes y áreas de toque como en §22. Informe breve: qué cambió, qué no quedó bien, archivos.

## 24. Citas en el dashboard — decisiones del usuario (20-nov)
Aplica a las filas de cita del dashboard («Después» y equivalentes) en los cinco marcos.

1. **La fila entera es pulsable** (área ≥ 56 de alto, feedback en pointer-down). Desaparecen de la fila el botón «Iniciar», el botón de carpeta y el menú «Estados» de la cabecera de la lista. El nombre ya nunca se trunca por culpa de botones.
2. **Al tocar la fila se abre la hoja de acciones de la cita** (hoja inferior en `ext`/`tel`; tarjeta centrada 340–440 con velo en `ih`/`iv`/`esc`), con cabecera (nombre, fecha y hora, médico, estado con texto, origen) y acciones con icono: «Iniciar consulta» (principal, botón de verdad), «Ver expediente», y los cambios de estado que hoy ofrece el menú «Estados» con sus textos EXACTOS de hoy (míralos en el código del clon `S/app` y en `S/informes/funciones-componentes.md`; no inventes estados ni textos). La acción destructiva/cancelación al final, en rojo.
3. **La tarjeta de la cita próxima/en curso (arriba) conserva su botón «Iniciar» directo.**
4. **Estado como icono en círculo de color** (círculo 24–28 con icono 14–16, tinte del color + icono en color pleno, `aria-label` con el nombre del estado). En `ext` y `tel` solo el icono; en `ih`, `iv` y `esc` icono + texto. Propuesta de iconos: Confirmada = palomita, azul (`--accion`); Agendada = calendario con reloj, ámbar (`--ag-*`); Cancelada = tache, rojo (`--mal-*`); No asistió = persona con raya, gris; Atendida = doble palomita, verde (`--ok-*`). Usa solo los estados que existan hoy en el código.
5. **Origen de la cita** (línea secundaria, icono + texto): «Reservó por enlace» (texto de hoy, icono de enlace) y «Agendada desde Google Calendar» con el icono multicolor de Google Calendar a 14–16 px (en `ext`, si no cabe, «Desde Google Calendar»). TEXTO NUEVO aprobado.
6. **Cita sin expediente** (solo ocurre con esos dos orígenes): la fila muestra «Sin expediente»; en la hoja la acción principal es «Ligar paciente e iniciar consulta» en vez de «Iniciar consulta», y «Ver expediente» no aparece. No dibujes el flujo de ligado: es de la rama de agenda y aún no está cerrado; el botón solo se dibuja.
7. **Reservado para la tanda de agenda (NO dibujar ahora):** los eventos de Google que no son cita llevarán un botón «¿No es una cita?»; el caso «Pendiente administrativo · Sin paciente ligado» se trata en la maqueta como una cita sin expediente más, sin inventar nada.

## 25. Capas compartidas — catálogo (tanda nueva)
Objetivo: UNA definición de cada pieza que hoy cada pantalla dibuja a su manera, para que quien implemente la construya una vez. No se inventan piezas ni textos: cada ejemplo sale de una capa que ya existe en las maquetas aprobadas (`pub-*`, `tanda4`, `dashboard-final`) o en el código (`S/informes/funciones-componentes.md`, `S/informes/capturas-modales.md`, `S/informes/movimiento.md`). Si dos maquetas difieren, gana la regla de §13, §18, §21, §23; anota la diferencia en el informe.

Cada pieza se entrega como una vista (`vista-N-nombre.html`) con los CINCO marcos, sobre un fondo de pantalla real simplificado, con: botón de maqueta para abrir/cerrar (la animación es parte de la entrega), variantes, y debajo del marco una ficha breve «Especificación» (medidas por marco, resorte, cómo se cierra, velo sí/no, orden de botones, foco y teclado, reduced-motion y reduced-transparency).

Movimiento (del skill apple-design, `/home/user/app_ortointegra/.agents/skills/apple-design/SKILL.md`, léelo entero): respuesta en pointer-down; resortes (sin rebote por defecto: amortiguación 1.0, respuesta .3–.4 s; .8 solo tras un gesto con velocidad); toda animación interrumpible y reversible a medio camino; solo `transform` y `opacity`; las capas nacen de su origen (el menú de su botón, la hoja del borde inferior, la alerta del centro con escala .96→1); salida más rápida que la entrada; hojas arrastrables hacia abajo con proyección de inercia y rubber-band arriba; `prefers-reduced-motion` → fundido corto sin desplazamiento; `prefers-reduced-transparency` → velo opaco sin desenfoque. En la maqueta, implementa los resortes con `linear()` de CSS o con WAAPI; sin librerías.

Medidas comunes ya decididas: alerta 320 (`ext`/`tel`) y 340 (`ih`/`iv`/`esc`), centrada, icono 28 en círculo 48, título centrado, botones lado a lado salvo rótulos largos (apilados, principal arriba); modal 440/480/520 centrado entre franjas; hoja inferior en `ext`/`tel` (dentro del área de contenido, nunca bajo el riel) y tarjeta centrada en `ih`/`iv`/`esc`; menús sin velo en `esc`, tarjeta centrada con velo en `ih`/`iv`, hoja en `ext`/`tel`; velo `--velo` con `backdrop-filter: blur(10px) saturate(140%)`; pies con botones a la derecha (centrados en `iv`).

## 26. Capas en Duo cerrado (`ext`) — decisión del usuario (21-nov)
En `ext` NINGUNA capa es hoja inferior: modales, hojas (acciones de cita, rejilla «Tipo de documento», listas para elegir) y menús son TARJETA CENTRADA en el área de contenido (sin riel ni franja), con velo, igual que en `ih`/`iv`: nacen del centro (escala .96→1 + fundido), ancho máx. 310 con margen de 8, alto máx. el del área menos 32 con desplazamiento interno y pie fijo. Sin asa ni arrastre para cerrar. La hoja inferior arrastrable queda SOLO para `tel`. Motivo: en `ext` la hoja pegada abajo a la izquierda, junto al riel, se ve mal. Esto manda sobre §24.2 y §25 y sobre lo dibujado en las páginas anteriores.
Además `base.css` fija `text-size-adjust:100%` (Safari de iPhone inflaba algunos textos dentro de los marcos escalados).

## 27. Agenda v2 — criterios (aprobados por el usuario, 21-nov)
- Solo visual: tipografía, iconografía, color, layout, transiciones. NINGUNA función se quita ni cambia. Inventario de referencia: `S/informes/agenda-v2-auditoria.md` (commit 951e31b3) y capturas en `S/cap-agenda/`. Todo lo que hoy se puede hacer debe poder hacerse en la maqueta; textos EXACTOS de hoy (propuestas aparte).
- Libertad de layout igual que en el resto de la app, sin afectar funcionalidad.
- El estándar estético es el de las páginas aprobadas (`dashboard-final`, `pub-pacientes`, `pub-nota`, `pub-documentos`, `tanda4`, `pub-capas`): ni plano (plasta de texto negro) ni saturado (color y letra grande por todos lados). Color con significado; iconos de color; etiquetas con icono; jerarquía con rótulos. La primera pasada «calma» se quedó plana: no repetirlo.
- Se CONSERVAN, redibujados con el sistema nuevo, los gráficos propios de la agenda que comunican algo: color por estado de cita, rayado de bloqueos (solo sobre horario de consulta), línea de la hora actual, fuera de horario, marcas de origen (enlace, Google), eventos frente a citas, «todo el día».
- Tipografía: la escala del kit; ningún texto <12 px (el mes del chip de fecha a 11 es la única excepción existente). La densidad se resuelve decidiendo QUÉ muestra cada tamaño de bloque (lo demás va a la burbuja), no encogiendo la letra.
- Estados de cita: los iconos en círculo de §24.4 (Agendada calendario-reloj ámbar, Confirmada palomita azul, Cancelada tache rojo, No asistió persona tachada gris, Atendida doble palomita verde), los mismos del dashboard.
- Colores: los 131 `--ag-*` de hoy se sustituyen por tokens del kit + un juego pequeño de tokens de agenda (por estado y por tipo: cita, evento, bloqueo, Google), en claro y oscuro (un solo oscuro, el del kit). Ojo: el kit ya define `--ag-fondo/--ag-tinta/--ag-punto` con otro significado (ámbar de «agendada»); nombra los nuevos sin chocar.
- Navegación por dispositivo como el resto: riel derecho en `ext`, encabezado fundido en `tel` e `iv` (píldora «Agenda» marcada, cinco píldoras), barra lateral derecha en `ih`, izquierda 248 en `esc`. Nada bajo franjas. La barra de herramientas de la agenda (fecha, anterior/siguiente, Hoy, vistas Mes|Semana|Día, médico, buscar, campana, bloquear, engrane, «Agendar») se resuelve por tamaño SIN cuatro filas: lo secundario se agrupa.
- Semana en `ext` y `tel`: lista por día con tira de fechas (decidido); rejilla de siete columnas en `ih`, `iv`, `esc`.
- Capas: las del catálogo (§25, §26): en `ext` tarjeta centrada, en `tel` hoja inferior, en `ih`/`iv`/`esc` tarjeta centrada; menús sin velo solo en `esc`. La burbuja de cita es una capa del catálogo, no una hoja a todo el ancho.
- Movimiento: resortes interrumpibles, respuesta en pointer-down, solo transform/opacity (§25).
- Fuera: páginas públicas de reserva (`/reservar`, `/confirmar`), agenda v1.
- Reservado/pendiente de QA del usuario: si el QA de la tanda M cambia comportamiento, se retoca.

## 28. Decisiones del 21-nov (agenda fase 1 y cromo global) — aprobadas
Agenda:
- «Agendar»: píldora flotante en `tel` (sin tapar contenido), «+» del riel en `ext`, botón en la barra en el resto.
- Día en `tel` es rejilla. Tocar un hueco para agendar NO existe en `ext`/`tel` (sí en `ih`/`iv`/`esc`).
- Burbuja: acciones como filas de menú (destructiva roja al final).
- Semana en `ext`/`tel`: lista por día con tira de fechas (versión A). En `ih` hay que dibujar las DOS (7 días y «3 días» como hoy) para que el dueño elija.
- El botón ⓘ de leyenda sale de la barra; la leyenda se abre desde el menú de opciones.
- Panel del Día (Resumen, Huecos disponibles, mini-mes) en `esc`, obligatorio. NUEVO aprobado: «Huecos disponibles» también en `ih`/`iv` como opción de «Opciones de la agenda» (solo en Día y con médico elegido) que abre la misma pieza en una tarjeta del catálogo.
- TEXTOS UNIFICADOS (aprobados, sustituyen a las variantes de hoy en todas partes): origen Google → «Agendada desde Google Calendar» (corto: «Desde Google Calendar»); reserva por enlace → «Reservó por enlace» (corto en filas estrechas: «Por enlace»); ligado → «Ligar paciente e iniciar consulta»; «¿No es una cita?» (con signos) siempre.
Cromo global (ver `S/entrega/cromo/` y `S/informes/cromo-global-faltantes.md`):
- Aviso «N datos pendientes»: tarjeta ámbar en la barra lateral (`esc`, `ih`); distintivo ámbar con número sobre «···» del riel (`ext`) o sobre el botón de menú (`tel`, `iv`) + tarjeta dentro del menú/cajón. Solo médico.
- Menú «Más» (`ext` e `iv`): aviso, Consultorio activo, Administración, Mi perfil, Ayuda. Suplementación sigue dentro de Expediente.
- Secretaria: no tiene «Mi perfil»; tiene «Ajustes» con Modo oscuro, Aviso de Privacidad y Cerrar sesión.
- El logo de la clínica vuelve, en el botón de consultorio de la navegación.
- Paleta ⌘K anclada arriba en ancho.
REGLA DE PROCESO (obligatoria desde hoy): todo agente entrega una tabla «ítem del inventario → dónde está en la maqueta / reservado a quién / FALTA». Nada del inventario puede quedar en FALTA sin decirlo arriba del informe.

## 29. Decisiones del dueño sobre la agenda (21-nov, tras la fase 2) — aprobadas
1. **Cuatro vistas en TODOS los marcos: Mes · Semana · 3 días · Día.** «3 días» deja de ser un sustituto de Semana en ancho de tableta y pasa a ser una vista más, siempre disponible (la vista ya existe en el código). Semana sigue como está decidido (lista por día en `ext`/`tel`, siete columnas en `ih`/`iv`/`esc`); «3 días» es SIEMPRE rejilla horaria de tres columnas (hoy + dos), también en `ext` y `tel`. El conmutador de la barra pasa a cuatro opciones; si no caben los rótulos en `ext`/`tel`, resuélvelo sin letra <12 (rótulos cortos con `aria-label` completo, o el conmutador en su propia fila), sin esconder ninguna vista en un menú.
2. Cancelar o eliminar una cita/evento desde el formulario PIDE CONFIRMACIÓN (alerta destructiva del catálogo).
3. En la alerta de cancelar cita, el botón de arrepentirse dice «Volver» (no «Cancelar»).
4. Confirmaciones de la agenda: la pregunta como título, el resto como mensaje, y el botón principal con verbo concreto («Mover», «Guardar», «Cancelar cita», «Quitar bloqueo»…) en vez de «Aceptar»; el secundario «Volver» cuando la acción es cancelar algo, «Cancelar» en el resto.
5. El botón de la burbuja que abre el formulario completo lleva icono de LÁPIZ (no ⋮), `aria-label` de hoy.
6. El botón «Ligar paciente e iniciar consulta» lleva icono de ESLABÓN en la agenda y en el dashboard.
7. Los motivos que hoy solo viven en `title` se muestran a la vista: explicación de «¿No es una cita?» bajo el botón, «Primero se liga a un paciente», por qué «Cita» está apagada con Todo el día.
8. Buscador de la agenda sin resultados: «Sin coincidencias.»
9. Rótulos de grupo del formulario «Fecha y hora» y «Detalles»: aprobados.
10. Configuración › Tu consulta: cada tipo de cita muestra su color en la fila.
11. «Guardado»: 4 s, como el resto de avisos de éxito.
12. La agenda vacía ofrece un enlace a «Configuración de la agenda».
13. Arrastrar en táctil exige mantener pulsado, con el tiempo de hoy.
14. Cerrar sesión NO pide confirmación (se queda como hoy).
