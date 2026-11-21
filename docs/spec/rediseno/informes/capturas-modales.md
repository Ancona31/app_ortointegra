# Capturas de estados interactivos — Spinus (estado actual, tema claro)

Fecha de captura: 2026-11-19 · App compilada en `http://localhost:3000` · Usuario `admin.a@semilla.spinus.test` (clínica «Semilla A», datos ficticios).

- **Carpeta de capturas:** `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/cap-modales/` — 160 capturas de teléfono (`nombre@ext.png`, 466×678 pt, dsf 2, franja derecha 84 pt rayada y franja inferior 34 pt teñida) y 161 de escritorio (`nombre@d.png`, 1440×900).
- **Métricas por captura:** `cap-modales/metricas.json` (controles < 44 px, controles bajo la franja derecha, bajo el indicador inferior, capas `role=dialog/menu` con su rectángulo). Solo cuenta controles realmente alcanzables (los tapados por un modal no cuentan).
- **Hojas de contacto para revisar de un vistazo:** `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/hojas-modales/` (`h1a…h14.png`).
- **Guiones nuevos** (no se tocó `cap.js`): `tools/mlib.js` (biblioteca) y `tools/m1.js … m15.js`, `tools/x.js`, `tools/hoja.sh`.

Convenciones de la tabla: **T** = teléfono, **D** = escritorio. «Franja» = franja derecha de 84 pt. «<44» = controles de menos de 44 px en algún lado. Los archivos `…-completo` son de página entera; **en teléfono valen poco** porque quien se desplaza es `<main>` y no la ventana (ver «Posibles defectos funcionales» n.º 1).

## Hallazgos transversales (leer antes de la tabla)

1. **Hay al menos cinco familias distintas de capa**, cada una con su aspecto: (a) paleta/buscador que cae desde arriba, sin `role=dialog`; (b) `ModalShell` centrado (bloqueo, medición, subir archivo, consultorio, plantilla, cambio de consultorio, aviso fuera de horario); (c) alerta tipo iOS centrada con dos botones de texto (eliminar expediente, dar de baja usuario); (d) hoja inferior de la agenda (tarjeta de cita en T) y modal a pantalla completa de la agenda (nueva/editar cita en T); (e) capas ancladas de la agenda (campana, buscador, engrane, leyenda, ir a fecha) y menús flotantes (kebab de fila, «más formato»).
2. **Ningún modal respeta la franja derecha en teléfono.** Todos se centran o se estiran sobre el ancho total (466 pt), así que la **X de cerrar cae siempre bajo la franja** (x≈400–446) y casi siempre el botón primario también (Guardar, «Sí, cambiar», «Dar de baja», «Eliminar», «Guardar nota»). La página de fondo tampoco: los CTA a ancho completo y las pestañas terminan bajo la franja.
3. **El indicador inferior (34 pt) sí se respeta en la agenda** (pies de modal y barra «Agendar» quedan por encima) pero **no en el resto**: «Terminar/Atrás» del asistente, «Eliminar paciente», pie de varias páginas y el submenú «Confirmar» de la tarjeta de cita (su «Cancelar cita» queda cortado, y=675–727 de 678).
4. **Dos estilos de toast**: el general (píldora blanca con icono, arriba a la derecha — en T queda media bajo la franja y su X entera) y el de la agenda/configuración (píldora roja centrada abajo, sin X).
5. **Tamaños táctiles**: la agenda cumple 44 px casi en todo en T; el resto no: X de modal 28×28, botones de pie de `ModalShell` 36 px de alto, campos 38–42 px, menú lateral 40/34 px, kebab de fila 30×30, chips de filtro 31 px, enlaces de texto 17–24 px, signos vitales 23 px de alto, botón hamburguesa flotante 36×36.
6. **Validación**: conviven tres mecanismos — globo nativo del navegador en inglés («Please fill out this field», no personalizable), banda ámbar «Falta 1 campo: …» con enlace al campo (documentos) y botón primario simplemente apagado (agenda, plantilla, registro rápido).
7. Casi ninguna capa fuera de la agenda declara `role="dialog"` (paleta, nueva consulta, filtros, invitar, alertas): lo anoto por si el rediseño unifica el componente.

## Tabla estado → archivos → observaciones

### 1 · Navegación

| Estado | Archivos | Cómo se abre / de dónde entra / observaciones |
|---|---|---|
| Menú lateral abierto | `01-menu-abierto@ext`, `@d` (en D es fijo) | T: botón ☰ (44×44). Entra desde la izquierda, 256 pt, no ocupa toda la pantalla; fondo desenfocado. No toca la franja. **La lista de navegación se queda en ~83 pt de alto** (solo se ven Dashboard y medio Pacientes): la tarjeta ámbar «3 datos pendientes» desplegada se come el espacio. Ítems 40 px. |
| Menú con el aviso plegado | `01-menu-aviso-plegado@ext/@d` | Al plegar «3 datos pendientes» caben 5 ítems. «Aviso de Privacidad» y el aviso quedan pegados al indicador inferior. |
| Selector de consultorio | `01-selector-consultorio@ext/@d`, `01-selector-consultorio-aviso-plegado@ext/@d` | Clic en «CONSULTORIO ACTIVO». Desplegable blanco bajo el botón, superpuesto a la navegación. Opciones 36 px, «Gestionar consultorios» 32 px. |
| Confirmar cambio de consultorio | `01-cambio-consultorio-confirmar@ext/@d` | Al elegir otro consultorio: `ModalShell` centrado (434×186 en T). X 28×28 y «Sí, cambiar» bajo la franja. Botones 36 px. |
| Submenús Pacientes / Documentos / Administración | `01-submenu-pacientes`, `01-submenu-documentos`, `01-submenu-administracion`, `01-submenus-todos`, `01-submenus-todos-pagina`, `01-submenus-aviso-plegado` (todos `@ext/@d`) | Acordeón en línea. Subítems 211×34. En T, con el aviso desplegado, el submenú apenas se ve (hay que desplazar una ventana de 83 pt); en D con los tres abiertos la lista también necesita desplazamiento. |
| Paleta «Buscar paciente o folio» | `01-paleta-vacia`, `01-paleta-resultados`, `01-paleta-sin-resultados` (`@ext/@d`) | Botón del dashboard o Ctrl+K. Cae desde arriba (y≈106 en T), ancho total menos 16 pt; no es pantalla completa. X de 16×16 bajo la franja; la flecha de cada resultado también. Pie con atajos de teclado (inútil en teléfono). Sin resultados ofrece «Crear registro para: "…"». |

### 2 · Dashboard

| Estado | Archivos | Observaciones |
|---|---|---|
| «Nueva consulta» | `02-nueva-consulta-vacio`, `-resultados`, `-sin-resultados` (`@ext/@d`) | Mismo componente que la paleta (buscador de paciente). Elegir paciente navega a la nueva nota. Mismos problemas de franja. |
| «Nuevo documento» | `02-nuevo-documento-vacio`, `-resultados` (`@ext/@d`) | Igual, con rótulo «NUEVO DOCUMENTO». En D el botón vive en «Documentos recientes» (`02-documentos-recientes@d`). |
| Registro rápido de paciente | `02-registro-rapido@ext/@d` | Desde «Crear registro para…». Sustituye el contenido de la misma capa (flecha atrás 18×18, X 16×16). «Crear e iniciar consulta» apagado hasta marcar el aviso de privacidad; media bajo la franja. Campos 38 px. No se guardó. |
| Tarjeta «Próximas citas» | `02-proximas-citas@ext/@d` | «Iniciar» (62×34) y el icono de expediente (34×34) de cada fila quedan **enteros bajo la franja** en T; «Ver agenda →» también. En D: «Iniciar consulta» 118×34. |
| Iniciar consulta desde una cita | — | No hay modal: «Iniciar» es un enlace directo a la nueva nota. Desde la agenda, ver `03-cita-agendada`. |

### 3 · Agenda

| Estado | Archivos | Observaciones |
|---|---|---|
| Nueva cita vacía | `03-agendar-vacio@ext/@d` | Botón «Agendar» (T: barra fija inferior 434×56; D: cabecera). T: **pantalla completa** (466×678) con cabecera y pie fijos; D: centrado 560×828. X 44×44 bajo la franja; «Guardar» medio bajo la franja; pie por encima del indicador. Conmutador Cita/Evento 34 px. «Guardar» apagado hasta elegir paciente (no hay mensajes de error). |
| Buscando paciente / con paciente | `03-agendar-buscando-paciente`, `03-agendar-con-paciente`, `03-agendar-con-paciente-abajo` (`@ext/@d`) | Lista desplegable dentro del modal. Con paciente aparece «Expediente» en la cabecera y se autoselecciona consultorio. En D la X de quitar paciente mide 14×14. |
| Nuevo evento | `03-agendar-evento`, `03-agendar-evento-abajo` (`@ext/@d`) | Rejilla de 20 iconos (44×44 en T, 40×40 en D), colores, «Todo el día». La última columna de iconos cae bajo la franja. |
| Aviso fuera de horario | `03-hueco-burbuja-alta@d` | Solo D: al hacer clic en un hueco fuera del horario sale un confirm centrado («Vas a agendar a las 15:00… ¿Es correcto?»). No se aceptó. |
| Detalle de cita: agendada / confirmada / atendida / cancelada / evento | `03-cita-agendada`, `03-cita-confirmada`, `03-cita-atendida`, `03-cita-cancelada`, `03-cita-evento`, `03-cita-detalle` (`@ext/@d`) | T: **hoja inferior** a ancho total (alto 336–491) con borde superior del color del estado; D: tarjeta flotante 376 pt anclada a la cita. Todos los controles ≥44 px. ⋮ y X bajo la franja; el tercer botón de la fila (Editar / No asistió) también. Acciones según estado: Iniciar consulta · Confirmar · Reagendar · Editar · No asistió · Cancelar cita · Darle otra cita · Reasignar el horario · Eliminar · Ver la consulta. |
| Más opciones (⋮) | `03-cita-mas-opciones@ext/@d` | Menú flotante dentro de la tarjeta: observaciones, tipo de cita, Editar/No asistió, consultorio, teléfono. En T tapa el nombre del paciente y se sale bajo la franja. |
| Submenú «Confirmar» | `03-cita-submenu-confirmar@ext/@d` | Despliega WhatsApp / correo / «Marcar como confirmada» (no se pulsó ninguno). En T la hoja crece a 542 pt y **«Cancelar cita» queda cortado bajo el borde inferior**. |
| Reagendar / Editar cita | `03-cita-reagendar`, `03-cita-editar`, `03-cita-editar-abajo` (`@ext/@d`) | Ambos abren el mismo modal «Editar cita» (reagendar enfoca la fecha). Pantalla completa en T. Estado en 5 chips (el quinto bajo la franja). Pie: icono rojo de cancelar, icono de iniciar consulta, Cancelar, Guardar. «Agregar invitados» 42 px. No se guardó. |
| Campana | `03-campana`, `03-campana-avisos` (`@ext/@d`) | Capa anclada 400 pt con pestañas «Por confirmar · 4» / «Avisos · 0». En T se pega a la izquierda (x=8) y aun así los botones de WhatsApp y correo (38×38) quedan al borde de la franja; X 36×36. No se envió nada. |
| Candado / bloquear horario | `03-bloqueo@ext/@d` | `ModalShell` centrado (434×465 en T), fondo desenfocado. Todos sus controles <44 (campos 37–38, botones 36). |
| Buscador de citas | `03-buscador`, `03-buscador-resultados`, `03-buscador-vacio` (`@ext/@d`) | Capa anclada de 320 pt con lista de resultados. Sin texto de «sin resultados»: la lista simplemente no aparece. |
| Selector de médico | `03-selector-medico-foco@ext/@d` | Es un `<select>` nativo (opciones: Todos los médicos / Dr. Admin Semilla Uno / Dra. Invitada Semilla Dos). El desplegable nativo no sale en captura; solo el estado enfocado. En T el texto se corta («Dr. Admin Sen») y la flecha cae bajo la franja. |
| Vistas Mes / Semana / Día | `03-vista-mes`, `03-vista-semana`, `03-vista-dia`, `03-mes-dia-tocado@ext` | T: Mes = rejilla de puntos + lista del día debajo (columnas S y D bajo la franja); Semana = lista por día; Día = lista con píldora de estado (la píldora cae bajo la franja). D: rejilla horaria / mes con chips. |
| Engrane | `03-engrane@ext/@d` | Menú anclado (300 pt). T: 3 opciones; D: 6 (compactar rejilla, densidad, pop-up, atajos…). Filas 40 px. El interruptor cae bajo la franja. |
| Ir a una fecha / Leyenda (solo D) | `03-ir-a-fecha@d`, `03-leyenda@d` | Mini-calendario y leyenda de estados anclados a la cabecera. En T no existen como botones (la leyenda vive en el engrane). |
| Invitados de la cita | — | No capturado (ver lista). |

### 4 · Configuración de agenda (asistente de primera vez)

| Estado | Archivos | Observaciones |
|---|---|---|
| Paso 1 · Horario de la clínica | `04-config-paso1`, `04-config-paso1-completo` (`@ext/@d`) | Interruptores 52×30, horas con `input time` nativo, selector de huso. |
| Paso 2 · ¿Cuándo das consulta? | `04-config-paso2`, `-completo` | Tarjetas-radio por consultorio. |
| Paso 3 · Duración | `04-config-paso3`, `-completo` | Rejilla de 6 botones 121×56; la tercera columna bajo la franja. |
| Paso 4 · Avisos por correo | `04-config-paso4`, `-completo`, `04-config-paso4-pie` | Los dos interruptores y «Cambiar» **enteros bajo la franja**; «Atrás/Terminar» bajo el indicador inferior. No se pulsó «Terminar». |

**Cómo se avanzó sin guardar:** «Continuar» guarda en cada paso (`PUT /api/me/horario`, `PATCH /api/consultorios/:id`, `POST /api/agenda/tipos-cita`). Esas escrituras se interceptaron en el navegador (respuesta 200 falsa) y **no llegaron al servidor**; el asistente sigue intacto para el siguiente que entre.

### 5 · Lista de expedientes

| Estado | Archivos | Observaciones |
|---|---|---|
| Filtrar y ordenar | `05-lista-filtros@ext` | Solo T: **hoja inferior** (desde y≈115 hasta abajo) con médico, fechas, chips de orden y «Ver resultados». «Limpiar» 65×28 y X 28×28 bajo la franja. En D no hay hoja: los filtros están en línea en la cabecera. |
| Menú ⋮ de una fila | `05-lista-menu-fila@ext/@d` | Menú flotante con «Ir a expediente» y «Editar paciente» (36 px). Botón ⋮ de 30×30 y, en T, bajo la franja. |
| Búsqueda | `05-lista-busqueda-resultados`, `05-lista-busqueda-vacia` (`@ext/@d`) | Estado vacío: tarjeta con icono, «No se encontraron pacientes». |

### 6 · Expediente del paciente

| Estado | Archivos | Observaciones |
|---|---|---|
| Pestañas Resumen / Consultas / Documentos / Mediciones y archivos | `06-exp-pestana-resumen`, `-consultas`, `-documentos`, `-mediciones` (+ `-completo`) (`@ext/@d`) | En T la barra de pestañas se desplaza en horizontal («Mediciones y archivos» fuera de vista y bajo la franja). Documentos está vacío para este paciente (estado vacío con «Crear documento»). |
| Exportar | `06-exp-exportar@ext/@d` | **No es un menú**: el botón pasa a «Generando expediente…» y luego a «Abrir expediente» + X de descartar (28×28). |
| Nuevo documento | `06-exp-nuevo-documento@ext/@d` | Navega a la rejilla de 8 tipos (no es modal). |
| Selector de consulta | `06-exp-consultas-selector@ext/@d` | T: el encabezado «CONSULTA 1 DE 3» despliega la lista en línea con «Volver a la nota»; D: carril lateral que se expande. |
| Imprimir nota | `06-exp-consultas-imprimir@ext/@d` | Tampoco es menú: «Imprimir» genera el PDF y se convierte en «Abrir PDF». |
| Leer nota | `06-exp-leer-nota@ext/@d` | Lleva a la pestaña Consultas con la nota abierta. |
| Filtros de actividad | `06-exp-actividad-consultas`, `-documentos`, `-mediciones` (`@ext/@d`) | Selector segmentado (chips 31 px). |
| Agregar medición | `06-exp-modal-medicion@ext/@d` | `ModalShell` centrado (434×476 en T). X 28×28 bajo la franja; campos 38 px; botones 36 px. |
| Subir archivo | `06-exp-modal-subir-archivo@ext/@d` | `ModalShell` con zona de arrastre. «Subir 0 archivos» apagado y bajo la franja. |
| Eliminar paciente | `06-exp-eliminar-paciente@ext/@d` | Alerta centrada estilo iOS (Cancelar / Eliminar de 192×48). El texto dice «Se eliminarán **permanentemente**…». No se pulsó. |
| Editar paciente | `06-exp-editar@ext/@d` | Página aparte, no modal. |
| Panel/visor de documentos con contenido | — | No capturado (no hay documentos; ver lista). |

### 7 · Nota de consulta

| Estado | Archivos | Observaciones |
|---|---|---|
| Addendum abierto / escrito | `07-nota-addendum-abierto`, `07-nota-addendum-escrito` (`@ext/@d`) | Se despliega en línea al final de la nota. «Cancelar/Guardar addendum» 36 px; en T quedan bajo el pliegue. No se guardó. |
| Imprimir | `07-nota-imprimir@ext/@d` | No hay menú: el botón pasa a «Abrir PDF». En T el botón «Imprimir» **se sale por la derecha** (x=370, ancho 115) y cae bajo la franja; el título se parte en dos líneas. |

### 8 · Nueva nota médica

| Estado | Archivos | Observaciones |
|---|---|---|
| Modo IA | `08-nueva-nota-ia`, `-completo` (`@ext/@d`) | |
| Signos vitales enfocado / fuera de rango | `08-nueva-nota-signos-foco`, `08-nueva-nota-signos-fuera-de-rango` | Campos de 39–70×23 px (muy por debajo de 44). No se expanden al enfocar; el chip pasa de «Todo en rango» a «1 fuera de rango» en rojo. SpO₂ y el chip quedan bajo la franja. |
| Pie con «Generar con Spinus» | `08-nueva-nota-pie-generar`, `08-nueva-nota-dictado` | Botón 434×58, **no se pulsó**. Micrófono «próximamente» 33×23; «Prefiero escribirla yo» 137×23. |
| Modo manual | `08-nueva-nota-manual`, `-completo`, `08-nueva-nota-cie10-resultados` | Seis áreas de texto + buscador CIE-10. En mis capturas el desplegable del CIE-10 no llegó a mostrar opciones. |
| Previsualización | `08-nueva-nota-previsualizacion`, `-completo` (`@ext/@d`) | «Tu nota está lista»: T pantalla completa, D centrado 724×648. X 28×28, «Actualizar» y «Guardar nota» bajo la franja. **No se guardó.** |

### 9 · Documentos

| Estado | Archivos | Observaciones |
|---|---|---|
| Elegir paciente y rejilla | `09-documentos-buscar-paciente`, `09-documentos-rejilla` (`@ext/@d`) | Paso 1/Paso 2 en la misma página. Tarjetas de tipo 212×92; la columna derecha, bajo la franja. |
| Formulario de cada tipo | `09-doc-receta`, `09-doc-laboratorio`, `09-doc-imagenologia`, `09-doc-suplementacion`, `09-doc-internamiento`, `09-doc-escrito`, `09-doc-consentimiento`, `09-doc-honorarios` (+ `-completo`) (`@ext/@d`) | Todos: banda «DOCUMENTO · Cambiar», tarjeta «Sin plantillas», secciones y **pie fijo** con «Plantilla» + «Imprimir» (consentimiento: Plantilla / Firmar / Sin firma / Borrador en dos filas). En T el pie fijo se come ~110 pt (el doble en consentimiento) y «Imprimir/Firmar» quedan medio bajo la franja. |
| Cambiar tipo | `09-doc-cambiar-tipo@ext/@d` | Despliega la rejilla de 8 tipos en línea, encima del formulario. |
| Validación | `09-doc-receta-validacion`, `09-doc-laboratorio-validacion`, `09-doc-escrito-validacion`, `09-doc-honorarios-validacion`, `09-doc-consentimiento-firmar-validacion` (`@ext/@d`) | Al pulsar «Imprimir/Firmar» vacío: campos con borde ámbar y banda «Falta 1 campo: Estudios» con enlaces a los campos. Nada se guardó. |
| Variantes | `09-doc-honorarios-cotizacion`, `09-doc-consentimiento-denegacion`, `09-doc-consentimiento-seccion-abierta`, `09-doc-escrito-mas-formato@ext` | Recibo/Cotización, Consentimiento/Denegación (el pie pasa a un solo «Imprimir»), sección plegable abierta, y menú «…» del editor (solo T; en D la barra muestra todo). |
| Guardar como plantilla | `09-doc-plantilla-guardar@ext/@d` | `ModalShell` centrado; «Guardar» apagado sin nombre. No se guardó. |
| Final del formulario en teléfono | `09-doc-receta-final@ext` | Pantalla en blanco: ver defecto n.º 1. |
| Vista previa | — | **No existe** vista previa sin guardar: «Imprimir» sella y guarda el documento. |

### 10 · Nuevo paciente

| Estado | Archivos | Observaciones |
|---|---|---|
| Guardar vacío | `10-paciente-nuevo-validacion`, `-completo` (`@ext/@d`) | Solo validación nativa del navegador: globo «Please fill out this field» en inglés. Sin mensajes propios. |
| Con nombre, sin sexo | `10-paciente-nuevo-validacion-app`, `-completo` | Otro globo nativo («Please select an item in the list»). |
| Datos adicionales desplegados | `10-paciente-nuevo-datos-adicionales@ext/@d` | Acordeón con contacto, antropometría y antecedentes. |

### 11 · Perfil

| Estado | Archivos | Observaciones |
|---|---|---|
| Pestañas Datos / Consultorios / Google Calendar | `11-perfil-datos`, `11-perfil-consultorios`, `11-perfil-google` (+ `-completo`) (`@ext/@d`) | Google: tarjeta «Sin conectar» y botón «Conectar» (no se pulsó). En T los «Eliminar» de consultorio caen bajo la franja. |
| Agregar consultorio | `11-consultorio-agregar@ext/@d` | `ModalShell` centrado (434×487). Todo <44 (campos 38, chips de huso 30, botones 40). |
| Editar consultorio | `11-consultorio-editar`, `11-consultorio-editar-abajo` (`@ext/@d`) | **No es modal**: formulario en línea que sustituye a la fila. Incoherente con «Agregar». |
| Eliminar consultorio | `11-consultorio-eliminar@ext/@d` | `ModalShell` con tres botones apilados en T (Cancelar / Editar en lugar / Sí, borrar, 40–42 px). No se pulsó. |
| Firma | `11-perfil-firma-dibujar`, `11-perfil-firma-trazo` (`@ext/@d`) | Lienzo en línea (no modal). «Limpiar» 60×16; «Guardar firma →» 143×36 bajo la franja. El trazo no se guardó. |

### 12 · Usuarios

| Estado | Archivos | Observaciones |
|---|---|---|
| Invitar | `12-usuarios-invitar`, `12-usuarios-invitar-validacion` (`@ext/@d`) | Modal centrado (rol, correo, aviso ámbar de caducidad). X 28×28; campos 41–42. Validación del correo con globo nativo en inglés. No se envió. |
| Dar de baja | `12-usuarios-eliminar@ext/@d` | Alerta centrada estilo iOS (Volver / Dar de baja). El icono de papelera de la fila mide 28×28. No se pulsó. |

### 13 · Estados de sistema

| Estado | Archivos | Observaciones |
|---|---|---|
| Sin conexión | `13-sin-conexion-dashboard@ext/@d` | Tras ~4 s sin red: tarjeta **modal bloqueante** centrada «Sin conexión… Esperando reconexión…» con fondo desenfocado; no deja ningún control alcanzable. En T se centra sobre el ancho total, así que su borde derecho cae bajo la franja. |
| Conexión recuperada | `13-conexion-recuperada@ext/@d` | La tarjeta desaparece sin aviso. |
| Toast informativo | `13-toast-info-consultorio@ext/@d` | «Consultorio activo: Hosp Norte» (real; el consultorio activo vive en `sessionStorage` de mi navegador, no afecta a nadie). En T sale por encima del menú y su X (14×14) cae bajo la franja. |
| Toast de error | `13-toast-error-simulado@ext/@d` | «No se pudo guardar el aviso»: provocado respondiendo 500 en falso a un interruptor del asistente. Píldora roja centrada abajo. |
| Interruptor sin toast | `13-toast-exito-simulado@ext/@d` | Con respuesta 200 falsa el interruptor cambia pero no aparece toast de éxito a los 0,7 s. No logré un toast de éxito genuino sin guardar. |
| Pantalla de error | `13-error-boundary-respuesta-simulada@ext/@d` | «Algo salió mal · Reintentar · Volver al inicio». Provocada con una respuesta vacía falsa al guardar un addendum. Sustituye toda la página. |
| Estado vacío | `05-lista-busqueda-vacia`, `03-buscador-vacio`, `01-paleta-sin-resultados`, `06-exp-pestana-documentos`, `03-campana-avisos` | Cinco estados vacíos, cinco tratamientos distintos. |
| Esqueletos de carga | `13-esqueleto-dashboard`, `-expediente-lista`, `-expediente`, `-agenda`, `-agenda-config`, `-perfil`, `-usuarios`, `-nota` (`@ext/@d`) | Lecturas retrasadas 4 s. Solo la lista de expedientes y el perfil tienen esqueleto de verdad; expediente y nota muestran un texto «Cargando expediente…/Cargando…»; el dashboard y la agenda pintan su marco con huecos. |

## Lo que NO se pudo capturar y por qué

1. **Panel/visor de documentos con contenido, modal «documento generado», toast de éxito al emitir y acciones de un documento** (enviar por correo, descargar). No hay ningún documento en la base y crearlo exige guardar un registro inmutable; además cambiaría el dashboard y el expediente que otro agente está capturando «en reposo». Se puede hacer en cinco minutos cuando ese agente termine, si se acepta guardar un documento ficticio.
2. **Vista previa de documento sin guardar**: no existe en la app.
3. **«Agregar invitados» de una cita** (`ModalInvitacionCita`): el botón no respondió a mi clic automatizado dentro del modal de edición; no lo investigué más.
4. **Desplegables nativos** (`<select>` de médico, fecha y hora): los pinta el sistema, no salen en captura.
5. **Hoja de filtros de expedientes en escritorio**, **ir a fecha / leyenda en teléfono**, **menú «más formato» en escritorio**, **aviso fuera de horario en teléfono**: no existen en ese tamaño (indicado en la tabla).
6. **Menús de «Exportar» e «Imprimir»**: no son menús; son botones que cambian de estado.
7. **Modal de inicio de consulta desde una cita del dashboard**: no existe; es un enlace.
8. **Resultados del buscador CIE-10** y **archivo ya elegido en «Subir documento»**: mis intentos no llegaron a mostrarlos.
9. **Toast de éxito**: no conseguido sin guardar de verdad.
10. No se pulsó nada externo: generar con IA, extraer laboratorios, enviar correo/WhatsApp, conectar Google, pagos.

## Registros guardados en la base

**Ninguno creado, editado ni borrado por mí** (ningún paciente, cita, nota, addendum, documento, consultorio, usuario, plantilla, firma ni ajuste). Matices:

- **Exportar expediente** se pulsó una vez por tamaño (2 en total) sobre «Paciente Prueba 01» sin intercepción: genera el expediente en el navegador y es probable que haya dejado 2 filas de acceso/exportación en `audit_log`. Igual «Imprimir» de la nota (2 veces, genera el PDF).
- Navegar por expedientes escribe las entradas normales de `audit_log`. En los guiones con la red de seguridad activada (`m7`, `m9`, `m9b`, `m10`, `m11`, `m13`, `m14`) esos `POST /api/audit` se respondieron en falso y **no quedaron registrados** (unas 30 visitas de página sin su fila de auditoría).
- La agenda lanza sola `POST /api/google/sync` al cargar; en los guiones sin red de seguridad llegó al servidor (Google no está conectado).
- Escrituras interceptadas que **no** llegaron al servidor: `PUT /api/me/horario`, `PATCH /api/consultorios/:id` ×2, `POST /api/agenda/tipos-cita`, `PATCH /api/me/ajustes-agenda` ×2, `POST /api/consultas/:id/addendum`.
- En la lista de expedientes aparece un paciente «Hugo Interián Canché» (26 pacientes en total) que no sigue el patrón «Paciente Prueba NN». No lo creé yo; aviso por si no debería estar en los datos ficticios.
- No cerré sesión, no cambié contraseña, perfil ni tema guardado.

## Posibles defectos funcionales (no visuales; sin arreglar)

1. **Doble desplazamiento en teléfono: la ventana se desplaza sobre vacío.** En `/expediente/:id/documentos?tipo=receta` a 466×678, `<main>` es el contenedor que se desplaza (alto 678, contenido 1599) pero el documento también mide 1296 de alto, así que la ventana admite 618 pt de desplazamiento propio y al llegar abajo `<main>` entero sale de pantalla: queda la página en blanco con solo el botón ☰ (`09-doc-receta-final@ext`). Medido con `scrollY=618`, `main.getBoundingClientRect().top=-618`. No comprobé si un gesto táctil real llega a ese estado ni qué elemento provoca el desborde.
2. **El asistente de configuración de agenda no vuelve arriba al cambiar de paso en teléfono.** Los pasos 2, 3 y 4 aparecen con la cabecera «Paso N de 4» cortada (`04-config-paso2/3/4@ext`). El código llama a `window.scrollTo({ top: 0 })` (`PrimeraVez.tsx:239`), pero ahí quien está desplazado es `<main>`. Mismo origen que el n.º 1.
3. **«Cancelar cita», «No asistió» y «Marcar como confirmada» de la tarjeta de cita se ejecutan sin confirmación** (`InteraccionesV2.tsx:337-341` → `cambiarEstadoCita`). Verificado en el código, no pulsado. Puede ser decisión de diseño; lo anoto porque «Cancelar cita» está a un toque y, en teléfono, justo en el borde inferior.
4. **Menú lateral en teléfono de 678 pt de alto:** con «3 datos pendientes» desplegado la navegación queda en 83 pt; Agenda, Calculadoras, Documentos, Administración, Mi perfil y Ayuda solo se alcanzan desplazando esa franja mínima.
5. **Una respuesta inesperada al guardar un addendum tira la página entera** al error genérico. Lo provoqué con una respuesta `{}` falsa, así que no es reproducible en uso normal; indica que el formulario no tolera un cuerpo incompleto.
6. **El texto de «Eliminar expediente» promete borrado permanente** («Se eliminarán permanentemente todas las notas…»), cuando la regla del proyecto es borrado lógico con retención. No pulsé «Eliminar», así que no sé qué hace realmente; el texto y la regla no coinciden.
7. **Mensajes de validación en inglés** («Please fill out this field», «Please include an '@'…») en nuevo paciente e invitar usuario: son los globos nativos del navegador, sin mensaje propio en español.
