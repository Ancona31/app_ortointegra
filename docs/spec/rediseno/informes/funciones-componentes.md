# Spinus · Inventario funcional y de componentes para el rediseño estético

Rama auditada: copia de `feature/agenda-v2` en `scratchpad/app`. Trabajo de solo lectura.

## Cómo leer este informe

- **[V] VERIFICADO**: lo leí en el código (handler, rótulo, condición o clase). La ruta de archivo va entre paréntesis; todas son relativas a `src/`.
- **[I] INFERIDO**: deducido de rótulos, nombres de props o estructura sin leer el cuerpo completo del componente. Hay que confirmarlo antes de darlo por cerrado.
- **⚠️**: función poco visible que un rediseño puede perder (menú de tres puntos, solo hover, atajo, parámetro de URL, estado raro, diferencia por rol).
- Roles: **médico admin** (`role=medico` + `es_admin_de_clinica`), **médico invitado** (médico sin admin), **secretaria** (rótulo en UI: «Asistente»). `super_admin` se redirige fuera de `(app)`.
- Límite de la auditoría: la agenda (≈60 componentes, 2 416 líneas de cliente) y los 8 formularios de documentos (≈8 000 líneas) se inventariaron por extracción de rótulos, handlers y condiciones, no línea a línea. Sus listas son la parte con más [I].

---

# PARTE A — Inventario funcional por pantalla

## A0 · Cromo global de `(app)` (aparece en todas las pantallas autenticadas)

Archivos: `app/(app)/layout.tsx`, `components/layout/Sidebar.tsx`, `components/CommandPalette.tsx`, `components/sidebar/*`, `components/billing/*`, `components/onboarding/*`, `components/ui/{Toast,OfflineAlert,OnboardingGuide}.tsx`.

1. [V] Cabecera del menú lateral: logo de la clínica (o `/logo.png`), nombre de clínica o del médico, subtítulo (especialidad, o «Asistente Médico/a» para secretaria).
2. [V] ⚠️ Selector de **consultorio activo** (`sidebar/ConsultorioActivoSelector.tsx`): desplegable con la lista, enlace a `/perfil`, modal de confirmación «Cambiar consultorio activo → Sí, cambiar», toast informativo, Esc cierra.
3. [V] Navegación de médico: Dashboard · Pacientes ▸ (Expediente, Suplementación) · Agenda · Calculadoras · Documentos ▸ (8 tipos) · Administración ▸ (Estadísticas; + «Usuarios de la clínica» y «Facturación» solo si administra) · Mi perfil · Ayuda.
4. [V] ⚠️ Navegación de secretaria: solo Dashboard · Pacientes ▸ (Expediente, Nuevo paciente) · Agenda. No tiene entrada a Mi perfil ni a Ayuda.
5. [V] Grupos plegables con chevron; se abren solos cuando la ruta activa cae dentro; estado activo de hoja y de grupo.
6. [V] ⚠️ Documentos ▸ tipo: si hay un paciente abierto en la ruta va directo a `/expediente/{id}/documentos?tipo=…`; si no, abre `ConsultaRapidaModal` titulado con el tipo para elegir o crear paciente («Crear y continuar»).
7. [V] ⚠️ Con plan bloqueado, los hijos bloqueados y los 8 tipos de documento abren `BloqueoFeatureModal` en vez de navegar.
8. [V] ⚠️ «Plegar menú / Desplegar menú»: solo en `/agenda`, solo ≥ lg, persistido en `localStorage`. Plegada, cada entrada conserva `title` y `aria-label`.
9. [V] Conmutador Modo claro / Modo oscuro.
10. [V] Cerrar sesión (toast de error largo si el servidor no confirma la revocación).
11. [V] ⚠️ `AvisoPerfilSidebar` (solo `role=medico`): avisos «Documentos sin firma», «Sin cédula de especialidad», «Clínica sin logo», desplegable, enlace «Completar ahora» → `/perfil`.
12. [V] Enlace «Aviso de Privacidad» (pestaña nueva).
13. [V] Móvil: botón hamburguesa flotante, fondo oscuro que cierra al tocar, cajón lateral. El dashboard y la agenda móvil traen su propia hamburguesa dentro de su barra.
14. [V] ⚠️ Paleta de comandos (`Ctrl/⌘+K`): busca paciente por nombre o documento por folio; ↑↓ navega, Enter abre, Esc cierra; pie con leyenda de teclas.
15. [V] ⚠️ Paleta → «Crear registro para "texto"»: registro rápido (Nombre*, Apellidos, Fecha de nacimiento*, casilla de aviso de privacidad*), con aviso de duplicado y sus salidas.
16. [V] `SuscripcionBanner` (solo con plan bloqueado): franja superior con «Reactivar suscripción» → `/billing`.
17. [V] `BloqueoFeatureModal`: «Función no disponible · Suscripción terminada». Admin ve «Reactivar suscripción»; no admin ve «pídele a tu administrador…».
18. [V] `OfflineAlert`: capa «Sin conexión · Esperando reconexión…».
19. [V] `GateOnboarding` → `OnboardingModal`: asistente por pasos (Tu nombre, Datos, Cédulas, Clínica, Consultorio, Logo, Firma), «Paso requerido», Continuar / Finalizar. Los pasos dependen de rol y de lo que falte.
20. [V] ⚠️ `OnboardingGuide` (montado en dashboard y perfil): asistente flotante con tips por pantalla, Activar/Silenciar voz, Minimizar, «No mostrar más», Siguiente tip / Entendido. Se ancla con `data-onboard` a: `nuevo-paciente`, `nuevo-paciente-exp`, `nueva-cita`, `nueva-cita-movil`, `cita-creada`, `panel-documentos`, `subir-logo`. Si el rediseño quita esos atributos, el tour deja de señalar.
21. [V] Toasts (4 tipos; abajo a la derecha; 4 s, 8 s los de advertencia).
22. [V] `ErrorBoundary` de página: «Algo salió mal…». [I] con botón de reintento.
23. [V] Esqueletos de carga por ruta (`loading.tsx` en `(app)`, agenda, documentos, expediente, expediente/[id], nueva-nota) y transición de página.

**23 funciones.**

---

## A1 · `(launcher)/inicio`

Archivos: `app/(launcher)/inicio/page.tsx`, `app/(launcher)/layout.tsx`, `components/launcher/{ConsultaRapidaModal,ParticleCanvas,TemaLauncher}.tsx`. Pantalla fuera del layout de `(app)`: no tiene menú lateral ni paleta de comandos.

1. [V] Logo y marca Spinus®.
2. [V] Chip con el nombre del plan (si no es gratuito).
3. [V] Enlace «Actualizar» → `/pricing` (solo plan gratuito).
4. [V] ⚠️ Icono de perfil → `/perfil` (única salida a perfil; es un icono de 18 px con relleno de 8 px ≈ 34 px).
5. [V] Fecha completa de hoy.
6. [V] Saludo por franja horaria + primer nombre.
7. [V] Frase motivacional del día (rota por día del año).
8. [V] Tarjeta «Consulta rápida» → abre `ConsultaRapidaModal` (con plan bloqueado abre el modal de bloqueo).
9. [V] Tarjeta «Documento rápido» → `/documentos` (interceptada si plan bloqueado).
10. [V] Tarjeta «Dashboard» → `/dashboard`.
11. [V] Contador «Hoy tienes N citas».
12. [V] Contador «N consultas esta semana».
13. [V] Estado cargando: spinner a pantalla completa.
14. [V] `OnboardingModal` si el perfil está incompleto.
15. [V] Fondo animado de partículas, en variante clara y oscura. El tema se lee pero aquí no hay conmutador.
16. [V] `SuscripcionBanner` en la parte superior.
17. [V] Sin sesión → redirige a `/login`.

`ConsultaRapidaModal` (también lo usan el dashboard y el menú lateral):

18. [V] Búsqueda de paciente por nombre; ↑↓ / Enter / Esc; clic en resultado → navega al destino ([I] por defecto, nueva nota).
19. [V] «Crear registro» → formulario rápido: Nombre*, Apellidos, Fecha de nacimiento (muestra la edad calculada), casilla de privacidad*; botón «Crear e iniciar consulta» o el rótulo que pase el llamador.
20. [V] ⚠️ Aviso de duplicado con tres variantes: ya es tu paciente (ir); está en la clínica pero no es tuyo (vincular); mismos datos (es el mismo / es otra persona, crear de todos modos / cancelar).
21. [V] Flecha «volver» del formulario a la búsqueda; errores de formulario y de vinculación en línea.

**21 funciones.**

---

## A2 · `(app)/dashboard`

Archivos: `app/(app)/dashboard/{page,AsistenteDashboard,StatusChip}.tsx`, `components/dashboard/*`.

### Médico

1. [V] Barra móvil propia: botón menú (44 px), título, avatar con iniciales.
2. [V] Etiqueta del consultorio activo sobre el saludo.
3. [V] Saludo con primer nombre.
4. [V] ⚠️ «Buscar paciente o folio»: es un botón con aspecto de campo que abre la paleta; muestra el atajo en `<kbd>`.
5. [V] «Nueva consulta» → `ConsultaRapidaModal`.
6. [V] «Nuevo documento» → `ConsultaRapidaModal` con destino `/expediente/{id}/documentos`.
7. [V] «Nuevo paciente» → `/pacientes/nuevo` (ancla del tour).
8. [V] «Expedientes» → `/expediente`.
9. [V] Próximas citas: leyenda de 5 estados (Agendada, Confirmada, Cancelada, No asistió, Atendida).
10. [V] Próximas citas: fila con fecha y hora, avatar de iniciales, nombre, médico, chip de estado; la cita en curso va resaltada.
11. [V] ⚠️ Marcas de fila: icono «Aún no tiene expediente» (con `title`) y marca de reserva por enlace.
12. [V] ⚠️ «Iniciar consulta» → `/expediente/{id}/nueva-nota?cita=…`; además cambia el consultorio activo al de la cita.
13. [V] ⚠️ Botón-icono «Expediente» por fila (34 px; oculto por debajo de 380 px de ancho).
14. [V] ⚠️ Cita sin paciente: «Ligar e iniciar consulta» abre `VentanaLigarCita` (solo `role=medico` con consultorio); si no puede, «Ver en la agenda». Incluye «No es una cita».
15. [V] Enlace «Ver agenda» en el encabezado; pie «No hay más citas próximas. Ver agenda →».
16. [V] Estados de Próximas citas: esqueleto, error con «Reintentar», vacío «No hay citas agendadas. Abrir agenda →».
17. [V] Tarjeta Hoy: día de la semana, número, mes y año, conteo «N citas · N eventos», tira de la semana con hoy marcado, botón «Abrir agenda» (40 px).
18. [V] ⚠️ Atendidos recientemente: tarjetas (carrusel horizontal con snap en móvil, rejilla en escritorio) con enlace al expediente, tiempo relativo, detalle y chips «Receta» y «Nota»; «Ver todos →»; vacío con enlace a crear paciente; error con «Reintentar».
19. [V] Documentos recientes: botón «Nuevo documento» (44 px), lista con tipo en su color, paciente y tiempo → abre `/expediente/{id}?tab=documentos&documento={id}`; vacío; error con «Reintentar».
20. [V] `DashboardSkeleton` mientras carga el perfil; refresco automático al volver a la pestaña.

### Secretaria (`AsistenteDashboard`)

21. [V] Misma barra móvil, nombre de la clínica y saludo.
22. [V] Buscador (abre la paleta).
23. [V] «Agendar cita» → `/agenda`.
24. [V] «Nuevo paciente» → `/pacientes/nuevo`.
25. [V] Próximas citas de toda la clínica, con acción «Ver cita» → `/agenda` (sin iniciar consulta ni expediente).
26. [V] Tarjeta Hoy con conteos de toda la clínica.
27. [V] Últimos pacientes, con chip «Agendar» → `/agenda?cita=nueva&paciente={id}`.
28. [V] Hoy en consultorio (conteos), con error y «Reintentar».

**28 funciones** (20 médico + 8 secretaria). Nota: `SecretariaDashboard.tsx` y `SeguimientosWidget.tsx` existen pero no los monta nadie [I: no aparecen importados].

---

## A3 · `(app)/expediente` (lista de pacientes)

Archivos: `app/(app)/expediente/page.tsx`, `components/expediente/{TablaPacientesExpediente,SheetFiltrosExpediente,KebabAccionesPaciente,ChipMedico}.tsx`.

1. [V] Título y botón «Nuevo paciente» (interceptado si plan bloqueado).
2. [V] Búsqueda por nombre o apellido con espera de 300 ms.
3. [V] Escritorio: filtro Médico (select).
4. [V] Escritorio: filtros «Ingreso desde / hasta» (fecha).
5. [V] Escritorio: «Ordenar por» con 6 criterios (Apellido, Nombre, Expediente, F. nacimiento, F. ingreso, Médico).
6. [V] ⚠️ Botón de dirección asc/desc (solo icono, con `title`).
7. [V] ⚠️ Cabeceras de tabla ordenables (Paciente, Edad, Expediente, Fecha de ingreso): es un segundo camino para ordenar.
8. [V] Tabla de escritorio: avatar, nombre (enlace), sexo, edad, expediente, fecha de ingreso, chips de médicos.
9. [V] ⚠️ Chips de médicos con «+N» y `title` con los nombres ocultos.
10. [V] ⚠️ Menú ⋮ por fila: «Ir a expediente» y «Editar paciente».
11. [V] Móvil: tarjetas con toda la tarjeta pulsable y línea «Ordenado por X · Asc./Desc.».
12. [V] ⚠️ Móvil: botón «Filtrar y ordenar» con punto indicador de filtros activos → hoja inferior con Médico, fechas, Ordenar por, Dirección, «Limpiar», «Ver resultados»; cierra con Esc o tocando fuera.
13. [V] «Cargar más» (paginación acumulativa) y total.
14. [V] Estados: esqueleto, error con «Reintentar», vacío «No se encontraron pacientes» con enlace a crear.
15. [V] ⚠️ Médico invitado: desaparece «Todos los médicos» y el filtro arranca en él mismo.
16. [V] ⚠️ Secretaria: nombres sin enlace y sin menú ⋮ (`/expediente/[id]` la redirige a la lista).

**16 funciones.**

---

## A4 · `(app)/pacientes/nuevo`

Archivo: `app/(app)/pacientes/nuevo/page.tsx` (+ `layout.tsx`).

1. [V] Enlace de vuelta «Pacientes» y título.
2. [V] Aviso «El número de expediente se genera automáticamente al guardar».
3. [V] Asignación: «Médico responsable*» (select). [I] solo se muestra a secretaria y a quien administra.
4. [V] Nombre(s)*, Apellidos*.
5. [V] Fecha de nacimiento, o «Edad (opcional)» como alternativa.
6. [V] Sexo* (Masculino, Femenino, Otro).
7. [V] ⚠️ Sección plegable «Datos adicionales» (cerrada por defecto).
8. [V] Contacto: Teléfono (formateo automático), Email (nota «Necesario para enviar documentos»), Dirección.
9. [V] Antropometría: Peso, Talla (cm o m), IMC calculado.
10. [V] Antecedentes: 6 áreas de texto (alergias, no patológicos, patológicos, quirúrgicos, familiares, medicamentos actuales).
11. [V] ⚠️ Aviso de duplicado: «Ir a su expediente», «Es el mismo paciente» (vincula), «Es otra persona, crear de todos modos», cancelar.
12. [V] Casilla de consentimiento de privacidad* con enlace al aviso.
13. [V] «Cancelar» y «Registrar e ir al expediente» (estado Guardando…).
14. [V] ⚠️ Secretaria: al guardar vuelve a `/expediente`, no al expediente del paciente.
15. [V] ⚠️ Plan bloqueado: el layout redirige a `/billing`.

**15 funciones.**

---

## A5 · `(app)/expediente/[id]` (expediente del paciente)

Archivos: `app/(app)/expediente/[id]/{page,layout}.tsx`, `components/expediente/*`, `components/labs/*`.

### Cabecera y marco

1. [V] «← Volver a pacientes».
2. [V] Avatar, nombre y línea de identificación (edad · sexo · fecha de nacimiento · Exp. · teléfono).
3. [V] «Editar» → `/expediente/{id}/editar`.
4. [V] ⚠️ «Exportar expediente»: genera el PDF y deja un enlace para abrirlo más un botón «Descartar el expediente generado».
5. [V] «Nuevo documento» → `/expediente/{id}/documentos`.
6. [V] «Nueva consulta» → `/expediente/{id}/nueva-nota`.
7. [V] 4 pestañas con conteo: Resumen · Consultas · Documentos · Mediciones y archivos (desplazables en móvil).
8. [V] ⚠️ La pestaña y la selección viven en la URL: `?tab=`, `?consulta=`, `?documento=`. De eso dependen los enlaces del dashboard y de la línea de tiempo.
9. [V] ⚠️ «Eliminar paciente»: enlace gris de 12 px al pie → modal «Eliminar expediente · Esta acción no se puede deshacer».
10. [V] Estados: «Cargando expediente…», «Paciente no encontrado», y en el layout «No pudimos verificar tus permisos» con enlace a la lista.
11. [V] ⚠️ Las acciones 3–6 y 9 solo aparecen con `isDoctor`; la secretaria no entra a esta ruta.

### Pestaña Resumen

12. [V] Ficha clínica: último diagnóstico, «Última consulta», «Próxima cita» (o enlace «Agendar» → `/agenda`).
13. [V] Banda de Alergias (rojo fijo, no se atenúa en oscuro).
14. [V] Antecedentes (5 apartados) o «Capturar antecedentes» → editar.
15. [V] ⚠️ Antropometría (peso, talla, IMC con icono «Campo calculado» y `title`) o «Capturar peso y talla».
16. [V] Últimos analitos con enlace a la pestaña de mediciones; error propio.
17. [V] Archivos clínicos con «Ver los N archivos».
18. [V] Línea de tiempo «Actividad clínica» con filtro segmentado Todo / Consultas / Documentos / Mediciones.
19. [V] Entradas de la línea: «Leer nota» (salta a Consultas con esa nota), documento (salta a Documentos), medición (salta a Mediciones).
20. [V] Línea vacía: «Expediente recién creado» + botón de nueva consulta (42 px); cargando y error con reintento.

### Pestaña Consultas

21. [V] Carril de consultas (fecha · diagnóstico), selección sincronizada con la URL.
22. [V] ⚠️ Colapsar / expandir el carril (botón solo icono).
23. [V] Móvil: alterna lista ↔ detalle.
24. [V] Visor de nota: insignia «Nota sellada», cuerpo con signos vitales.
25. [V] «Imprimir» (Generando…) y, una vez generado, enlace para abrir el PDF.
26. [V] «Abrir nota completa» → `/expediente/{id}/consulta/{consultaId}`.
27. [V] Vacío: «La nota de cada consulta aparecerá aquí…» + CTA; error con reintento.

### Pestaña Documentos

28. [V] Carril de documentos con filtro por tipo (select con conteos); «Sin documentos de este tipo».
29. [V] Móvil: alterna lista ↔ detalle.
30. [V] Visor de documento: chip «Urgente»; en borrador, «El folio se asigna al emitirse».
31. [V] ⚠️ «Descargar PDF» con tres estados (preparando, listo, fallido → «toca para reintentar»).
32. [V] ⚠️ «Compartir» (hoja nativa del móvil), con motivo de bloqueo en el `title`.
33. [V] «Enviar al paciente» por correo.
34. [V] ⚠️ Modal «El correo no coincide» → «Enviar de todos modos» / Cancelar.
35. [V] «Regenerar PDF».
36. [V] ⚠️ Menú «Más acciones» (⋯) donde caen las acciones que no caben.
37. [V] «Eliminar documento» / «Cancelar borrador» → modal de confirmación.
38. [V] ⚠️ «Seguir editándolo» (solo borrador de consentimiento) → `…/documentos?tipo=consentimiento&doc={id}`.
39. [V] Aviso en línea con «Cerrar»; vacío «Este paciente todavía no tiene documentos · Crear documento».
40. [V] Enlace desde un documento a la pestaña de archivos (`onIrAArchivos`).

### Pestaña Mediciones y archivos

41. [V] Lista de analitos con último valor y flecha de tendencia; «primera» si solo hay uno.
42. [V] «+ Medición» → `ModalAgregarMedicion`.
43. [V] Modal: autocompletar del catálogo (↑↓ Enter Esc) o modo «Analito personalizado» (nombre, unidad, categoría) con «Volver al catálogo».
44. [V] Modal: valor (dos campos para presión arterial), fecha, hora, notas.
45. [V] Detalle del analito: encabezado, chip «Custom», «Primera medición registrada».
46. [V] Filtro segmentado de cuántas mediciones ver (3 / 5 / 10 / Todas; las opciones dependen del total).
47. [V] Gráfica con bandas de referencia; «No hay mediciones en este rango · Ver todas».
48. [V] Leyenda de bandas (Normal / Atención / Fuera de rango) o «no tiene rangos de referencia definidos».
49. [V] ⚠️ Tabla de mediciones: expandir, notas truncadas con `title`, eliminar (botón de 28 px) con modal de confirmación.
50. [V] Vacío: «Sin mediciones registradas…».
51. [V] ⚠️ Archivos: zona para arrastrar y soltar, que también abre el selector con un clic.
52. [V] ⚠️ «Subir» deshabilitado sin clínica, con el motivo en `title`.
53. [V] `ModalSubirDocumento`: varios archivos (PDF, JPG, PNG, DICOM), quitar archivo, tipo, fecha del estudio, descripción.
54. [V] Filtro segmentado por formato: Todos / Imagen / PDF / DICOM; «Sin archivos de este formato».
55. [V] Tarjeta de archivo → vista previa (PDF en iframe, imagen, DICOM con Cornerstone) con «Descargar»; formatos sin vista previa avisan.
56. [V] ⚠️ Eliminar archivo (botón de 28 px sobre la tarjeta) → modal de confirmación; toasts de éxito.

**56 funciones.**

---

## A6 · `(app)/expediente/[id]/consulta/[consultaId]`

1. [V] Volver al expediente; título «Nota de Consulta»; paciente y fecha.
2. [V] Insignias: «Nota manual» o generada con IA, y «Nota sellada».
3. [V] «Imprimir» (Generando…) y luego «Abrir PDF».
4. [V] Cuerpo de la nota (mismo `CuerpoNota` del visor).
5. [I] Lista de addendums ya guardados.
6. [V] ⚠️ «Agregar nota aclaratoria (addendum)»: área de texto, aviso de inmutabilidad, Cancelar / «Guardar addendum».
7. [V] Banner de error; estados «Cargando…» y «Consulta no encontrada».

**7 funciones.** La nota no se edita ni se borra (regla del proyecto): el rediseño no debe añadir esos botones.

---

## A7 · `(app)/expediente/[id]/documentos` (y el mismo taller dentro de nueva-nota y de `/documentos`)

Archivos: `app/(app)/expediente/[id]/documentos/page.tsx`, `components/documentos/*`.

### Marco común

1. [V] Volver al expediente y título.
2. [V] Selector de tipo: rejilla de 8 tarjetas con color propio por tipo (Receta, Laboratorio, Imagenología, Suplementación, Internamiento, Escrito médico, Consentimiento, Honorarios / Cotización).
3. [V] ⚠️ El selector es un `tablist` con teclado (flechas, Home, End, Esc) y se pliega a una tarjeta «Documento ▾» al elegir.
4. [V] ⚠️ Modal «¿Cambiar a X?» si el formulario actual ya tiene datos.
5. [V] ⚠️ Parámetros de URL: `?tipo=`, `?dx=` (diagnóstico inicial), `?borrador=`, `?doc=`.
6. [V] Plantillas: select para aplicar una y «Deshacer».
7. [V] «Guardar como plantilla» (diálogo de nombre; Enter confirma; avisa de nombre duplicado); deshabilitado con motivo en `title` si no hay contenido.
8. [V] ⚠️ Tope de 10 plantillas → diálogo con «Gestionar plantillas».
9. [V] Panel «Gestionar»: renombrar en línea (Enter / Esc), Sobrescribir, Eliminar (con confirmación), reintento por operación, Esc o «Volver al formulario».
10. [V] Estados de plantillas: esqueleto, vacío con explicación, error con «Reintentar».
11. [V] Aviso de perfil incompleto con «Ir a mi perfil».
12. [V] Pie: «Imprimir» con estados «Generando PDF…» y «Cargando tu perfil…».
13. [V] `ModalDocumentoGenerado`: abrir el PDF, Descargar, Compartir, Cerrar.
14. [V] ⚠️ Enviar por correo desde el modal: usa el correo de la ficha, o «Usar otro correo solo para este envío», con confirmación explícita de la dirección escrita a mano («Sí, enviar ahí») y oferta de «Guardar en la ficha».
15. [V] ⚠️ Banner «No quedó en el expediente» cuando el guardado falló pero el PDF existe.
16. [V] Cargador y error del formulario dinámico («No se pudo cargar el formulario»).
17. [V] ⚠️ Plan bloqueado: el layout redirige a `/billing`.

### Lo propio de cada formulario ([V] rótulos; [I] el detalle de cada control)

18. Receta: datos del paciente (rellenados de la ficha, editables), diagnóstico, medicamentos con autocompletar del catálogo (nombre, presentación, vía, indicaciones), añadir/quitar, recomendaciones.
19. Laboratorio: chips de «Estudios frecuentes», lista de estudios (Agregar / eliminar), indicaciones.
20. Imagenología: «Marcar como urgente», bloques de estudio (tipo con combo escribible, región, proyecciones, indicación clínica), agregar/eliminar.
21. Suplementación: peso («Calcula las dosis por peso»), tarjetas de suplemento activables (dosis, marca, justificación), notas y cita de control.
22. Internamiento: tipo, días estimados, ASA, hospital, «Marcar como URGENTE», diagnóstico principal y secundarios, procedimiento, requerimientos especiales (+ otro), justificación, secciones plegables «Instrucciones al paciente» e «Indicaciones de ingreso a piso» (grupos y renglones editables).
23. Escrito médico: se puede emitir sin paciente; título, título del pie, editor de texto enriquecido (bloque, negrita/cursiva, listas, alineación, menú «Más opciones de formato»); único obligatorio: el cuerpo.
24. Consentimiento: conmutador Consentimiento | Denegación, lugar, edad, procedimiento, «El paciente no puede firmar», testigos 1 y 2, uso de fotografías; acciones «Guardar borrador», «Imprimir sin firma», eliminar borrador.
25. ⚠️ Consentimiento → firmado electrónico (`FirmadoConsentimiento`): pantalla completa, firma con el dedo por firmante, «Rehacer», progreso, «¿Sellar y firmar?», «¿Salir del firmado?»; captura de identificación con recorte (`CapturaIdentificacion`).
26. Honorarios: conmutador Recibo | Cotización, folio, vigencia, interruptor «Seguro de gastos médicos» (aseguradora u «Otra», póliza, cobertura), líneas (concepto, origen, precio) con validación, total, anticipo, saldo, forma de pago, divisa, notas.

**26 funciones.** El flag `usa_documentos_v2` existe en tipos pero su migración está sin aplicar: hoy no cambia nada en pantalla [V: `lib/mobileShare.ts:105`]. `components/taller-v2/*` es un taller interno de hojas PDF, fuera de las pantallas en alcance.

---

## A8 · `(app)/expediente/[id]/editar`

1. [V] Volver «Expediente» y título «Editar paciente».
2. [V] Sección Datos personales: nombre*, apellidos*, fecha de nacimiento (con nota), sexo, N° de expediente.
3. [V] Sección Antropometría: peso, talla, IMC calculado.
4. [V] Sección Contacto: teléfono (formateo), email, dirección; error de validación en línea para teléfono y email.
5. [V] Sección Antecedentes: 6 áreas de texto.
6. [V] «Cancelar» (enlace) y «Guardar cambios» (Guardando…).

**6 funciones.**

## A9 · `(app)/expediente/[id]/estado` y A10 · `/laboratorios`

1. [V] ⚠️ `/estado` redirige a `/expediente/{id}`.
2. [V] ⚠️ `/laboratorios` redirige a `/expediente/{id}?tab=mediciones`.

**2 funciones** (son redirecciones; no tienen interfaz propia, pero hay enlaces viejos que dependen de ellas).

---

## A11 · `(app)/expediente/[id]/nueva-nota`

Archivo: `app/(app)/expediente/[id]/nueva-nota/page.tsx` (1 959 líneas) + `SignosVitalesCard`, `DiagnosticosEditor`, formularios de documentos.

1. [V] Migas de pan (único uso de `Breadcrumbs`), flecha de vuelta y título «Nueva Nota Médica».
2. [V] ⚠️ «Atendiendo en: {consultorio}». Sin consultorio activo, guardar queda deshabilitado.
3. [V] ⚠️ Banner «Borrador restaurado — continúa donde lo dejaste» con «Descartar»; autoguardado en `secureStorage` con indicador «Borrador guardado».
4. [V] Signos vitales: PA sistólica/diastólica, FC, FR, Temp., SpO₂; aviso de valor fuera de rango (icono con `title`).
5. [V] Modo IA: «Cuéntame la consulta» (área de texto grande).
6. [V] ⚠️ Botón de micrófono deshabilitado: «Dictado por voz — próximamente».
7. [V] «Generar con Spinus» (Redactando nota médica…).
8. [V] «Prefiero escribirla yo» → modo manual; y el camino de vuelta al modo IA.
9. [V] Modo manual: Motivo de consulta*, Exploración física, Auxiliares diagnósticos, Diagnósticos (editor con CIE-10, agregar/eliminar), Análisis clínico, Plan de tratamiento.
10. [V] Modo manual: «Previsualizar nota».
11. [V] Modal «Spinus está redactando tu nota» (espera).
12. [V] ⚠️ Modal de entrevista «Spinus necesita más información»: bloques de preguntas con opciones y respuesta libre; Anterior / Siguiente / «Enviar respuestas» / Cancelar; y la salida de generar sin responder.
13. [V] Modal de revisión «Tu nota está lista»: vista previa ↔ «Editar».
14. [V] Revisión: medicamentos detectados, cada uno con «Quitar».
15. [V] Revisión: Diagnósticos y Seguimiento (Pronóstico, Próxima cita).
16. [V] ⚠️ Revisión: regenerar; si hay ediciones pide «Perderás tus cambios — ¿Continuar?» / «Conservar».
17. [V] Modal «Ajusta el contexto» («La nota se generará de nuevo»; «Tu nota actual se conserva hasta que la nueva esté lista»).
18. [V] Modal de confirmación: «Volver a revisar» / «Guardar nota».
19. [V] Modal de éxito «Nota guardada · Quedó sellada en el expediente»: crear receta, ir a documentos, abrir PDF, «Imprimir nota», ir al expediente, cerrar.
20. [V] Tarjeta «Nota lista» plegable, con «Revisar» y «Empezar de nuevo» (confirmación «Sí, empezar de nuevo» / «Conservar»).
21. [V] Panel lateral fijo «Contexto del paciente»: edad, sexo, alergias, último diagnóstico, último tratamiento; «Primera consulta del paciente».
22. [V] Panel de documentos antes de guardar: aviso «Guarda la nota para poder generar documentos desde aquí» + «Revisar y guardar».
23. [V] Panel de documentos después de guardar: selector de tipo y los 8 formularios en línea, precargados con paciente, diagnósticos y medicamentos de la nota.
24. [V] ⚠️ «Concluir consulta»: si hay un documento empezado y sin imprimir abre «¿Concluir la consulta?» → «Seguir llenando» / «Concluir de todos modos».
25. [V] ⚠️ `?cita={uuid}` liga la nota a la cita de la agenda.
26. [V] Esqueleto de carga propio; plan bloqueado → `/billing`.

**26 funciones.**

---

## A12 · `(app)/agenda`

Archivos: `app/(app)/agenda/*`, `components/agenda/*`, `lib/agenda/*`. **Flag `agenda_v2_encendida`** (por clínica): las funciones marcadas «v2» solo existen con el flag; con él apagado rigen las «v1».

### Barra de escritorio

1. [V] Título «Agenda» con resumen de conteo en `title`.
2. [I] Navegación de periodo de FullCalendar (anterior, siguiente, hoy) y título del rango.
3. [V] Selector de vista (`tablist`): Mes / Semana / Día; hay además vista de 3 días (tableta) y vistas de lista (móvil).
4. [V] ⚠️ «Compactar» (botón de estado): oculta días y horas sin consulta.
5. [V] ⚠️ «Densidad compacta» (48 px por hora).
6. [V] Filtro por médico (select; «Todos los médicos», con restricción en vista Mes).
7. [V] v1: botón «Horario» → `HorarioModal` (solo quien administra).
8. [V] v2: engrane → `/agenda/configuracion` (para todos).
9. [V] v2 ⚠️: selector de fecha «Ir a una fecha» (mini-mes en capa).
10. [V] v2 ⚠️: «Buscar citas de un paciente» → resultados → «Ver sus citas».
11. [V] v2 ⚠️: campana «Por confirmar y avisos».
12. [V] v2 ⚠️: menú del engrane: Configuración de la agenda, Compactar, Densidad compacta, Atajos de teclado, Leyenda de estados.
13. [V] Leyenda de estados (fila fija en v1; capa en v2).
14. [V] «Agendar» (+) con `title` «Nueva cita o evento — el tipo se elige arriba del modal»; precarga al pasar el ratón o enfocar.
15. [V] v2: «Bloquear horario» → `ModalBloqueo`.

### Móvil

16. [V] Banda superior propia: hamburguesa, título, vistas Mes / Semana / Día.
17. [V] Flechas «Periodo anterior / siguiente».
18. [V] Filtros de banda: médico, compactar, engrane; en v2 también buscar y campana.
19. [V] Barra inferior fija «Agendar».
20. [V] ⚠️ Deslizar horizontalmente para cambiar de periodo (`useDeslizarPeriodo`).
21. [V] Vista Día en lista con cabecera de día propia y filas con detalle.

### Rejilla del calendario

22. [V] Clic o arrastre sobre un hueco → crear (v2: `BurbujaAlta`; v1: `AppointmentModal`).
23. [V] ⚠️ Arrastrar una cita para moverla y estirarla para cambiar su duración, con confirmación.
24. [V] Clic en una cita → v2: `BurbujaCita`; v1: modal de edición.
25. [V] ⚠️ El número del día es un enlace a la vista Día.
26. [V] «+N más» cuando no caben (3 en mes, 2 en semana/día).
27. [V] Línea de «ahora».
28. [V] v2 ⚠️: tarjeta de lectura al pasar el ratón sobre una cita (`useTarjetaAlPasar`, `TarjetaLectura`).
29. [V] Eventos de Google Calendar, de solo lectura, con marca de origen.
30. [V] Chips de mes, marcas de cita (sin expediente, reserva por enlace) y contenido adaptado a la altura del evento.
31. [V] v2: bloqueos de horario visibles en la rejilla; [I] leyenda de husos cuando hay consultorios en zonas distintas.
32. [V] Estado «sin eventos» en vistas de lista; esqueleto de carga de la página.

### Panel lateral del día

33. [V] v2: mini-mes navegable.
34. [V] Resumen del día con desglose por estado; mensajes «Elige un médico para ver las horas y los huecos» y «Sin horario de consulta este día».
35. [V] ⚠️ Huecos disponibles: cada hueco es pulsable («Agendar a las HH:MM»); «No cabe un turno entero en este hueco».
36. [V] Citas del día seleccionado, «Ver día ›», «Sin citas este día».

### Avisos de la página

37. [V] «No se pudo cargar la agenda», «Faltan citas por mostrar».
38. [V] «No se pudo sincronizar con Google Calendar» + «Revisar conexión».
39. [V] Aviso de vista compacta con «Mostrar todos los días / Mostrar rejilla completa».
40. [V] Toasts: horario bloqueado, bloqueo quitado, horario actualizado, cancelación hecha por el paciente, paciente no encontrado.

### Burbuja de cita (v2)

41. [V] Cabecera con franja de color de estado, hora y duración, ⋯ «Más opciones» y Cerrar.
42. [V] Acción principal según estado: Iniciar consulta / Ver la consulta / Reagendar / Darle otra cita / Ligar expediente e iniciar.
43. [V] ⚠️ Submenú Confirmar: Enviar por WhatsApp, Enviar por correo, Marcar como confirmada.
44. [V] Resto de acciones (según estado y permisos): Reagendar, Reasignar el horario, Cancelar cita, Editar, No asistió, Convertir en cita, Eliminar evento, Eliminar cita, No es una cita.
45. [V] ⚠️ Panel «Más»: Recordatorio por WhatsApp, Recordatorio por correo, consultorio y teléfono.
46. [V] ⚠️ Navegación con flechas dentro de la burbuja; mensajes de resultado de cada envío.
47. [V] Reserva por enlace sin ligar: «Por ligar · Reservó por enlace», historial, «Bloquear / Desbloquear contacto».
48. [V] `PanelReagendar`: consultorio, día y hora nuevos → «Revisar cambio» → «Sí, reagendar y avisar» / Corregir.
49. [V] `ConvertirEnCita`: consultorio, tipo, paciente; «Registrar paciente nuevo».
50. [V] `PanelLigarCita` / `VentanaLigarCita`: buscar paciente existente o registrar; «Ligar e iniciar consulta»; «Ver la cita».

### Alta y edición

51. [V] `BurbujaAlta` (v2): buscar paciente, «Crear paciente nuevo y continuar», médico, campo opcional, «Más opciones» (abre el modal completo), Guardar; acuse «Cita agendada · Listo».
52. [V] `AppointmentModal`: conmutador Cita | Evento.
53. [V] Evento: título, selector de icono y selector de color.
54. [V] Cita: buscar paciente, crear paciente nuevo (`QuickPatientModal`), quitar paciente (con sus variantes «…y cancelar / eliminar la cita»).
55. [V] «Todo el día», fecha de inicio y fin, hora.
56. [V] Tipo de cita, Duración (15 min … 2 h), Estado, Médico, Consultorio («Sin asignar»), Notas.
57. [V] ⚠️ Botones del pie: Cancelar cita / Eliminar cita o evento (icono con `title`), «Iniciar consulta» (si la cita no tiene paciente, primero se liga), Guardar.
58. [V] v2: avisos de empalme con otra cita y con un bloqueo antes de guardar.
59. [V] `ModalInvitacionCita` tras agendar: «Enviar invitación» por correo, «Guardar en la ficha», «No invitar a nadie».
60. [V] v2: `PreguntaAsistencia` «¿Asistió el paciente?»: Sí asistió / No asistió / Decidir después (incluye el aviso «Más de 48 horas y sin nota clínica»).
61. [V] `ModalBloqueo`: desde/hasta (fecha y hora), médico, motivo, Guardar; «Quitar bloqueo» → «Sí, quitar».
62. [V] `HorarioModal` (v1): horario por día, «Sin consulta», «Guardar horario».
63. [V] `ConfirmModal` genérico para mover, cancelar y eliminar.

### Campana (v2)

64. [V] Citas de mañana sin confirmar: WhatsApp, correo, «Marcar como confirmada»; «Sin teléfono válido ni correo».
65. [V] «Reservas por enlace empalmadas con Google».
66. [V] Avisos de la clínica: abrir, «No es una cita», «Marcar todos como revisados»; vacíos «No hay citas de mañana sin confirmar» y «No hay avisos sin revisar».

### Teclado, enlaces y permisos

67. [V] v2 ⚠️: atajos de una tecla: T hoy · J/N siguiente · K/P anterior · D día · S semana · M mes · C agendar · / buscar · ? ayuda. No se disparan al escribir en un campo ni con un diálogo abierto.
68. [V] v2 ⚠️: diálogo «Atajos de teclado» con casilla «Usar atajos de una tecla» (persistido).
69. [V] ⚠️ Enlaces profundos: `/agenda?cita={uuid}` abre esa cita; `/agenda?cita=nueva&paciente={id}` abre el alta con el paciente puesto.
70. [V] Actualización en tiempo real de la rejilla (`useTiempoRealAgenda`).
71. [V] ⚠️ Roles: el médico invitado ve solo su agenda; médico admin y secretaria ven todas y tienen el filtro. [I] «Iniciar consulta» y «Ver expediente» dependen de `puedeIniciarConsulta` / `puedeVerExpediente` (no para secretaria).
72. [V] ⚠️ Plan bloqueado: crear, agendar desde hueco y abrir el alta abren el modal de bloqueo.

**72 funciones.**

---

## A13 · `(app)/agenda/configuracion` (solo con agenda v2; apagada devuelve estado «apagado»)

Archivos: `app/(app)/agenda/configuracion/page.tsx`, `components/agenda/configuracion/*`.

1. [V] Estado «Cargando…».
2. [V] ⚠️ Asistente de **primera vez** (`PrimeraVez`): pasos Horario de la clínica (solo quien administra) → ¿Cuándo das consulta? → ¿Cuánto dura tu consulta? → ¿Mandamos avisos por correo?; Atrás, Continuar, Terminar, «Terminar después» (recuerda el paso).
3. [V] Cierre de primera vez: «Tu agenda ya está lista», «Tu enlace para pacientes» con copiar, resumen de lo elegido con «Cambiar» por fila, «¿Es para un solo paciente?», «Ir a mi agenda».
4. [V] Vista normal con pestañas: Tu enlace / Enlaces · Cuándo das consulta · Tu consulta / Tipos de cita · Avisos · Más opciones (los rótulos cambian si se administra la clínica).
5. [V] Enlace: enlace fijo con Copiar («Copiado» / «No se pudo copiar»), estado Activo / Apagado, «Apagar» / prender.
6. [V] ⚠️ Enlace: «¿Tu enlace llegó a quien no debía? · Cambiar por uno nuevo» (regenerar) y Revocar.
7. [V] Enlaces de una vez: crear («¿Para quién es?», correo opcional), listar, Mostrar enlace, Regenerar, Revocar.
8. [V] ⚠️ «Para que el enlace abra, falta:» con enlaces a Mi perfil, a la disponibilidad y a la duración.
9. [V] Admin: enlaces de los demás médicos.
10. [V] Horario de la clínica: diálogo con editor por día (interruptor, Entras / Sales, validaciones «Sales antes de entrar», «Prende al menos un día»), selector de huso horario.
11. [V] Cuándo das consulta, por consultorio: «Igual que la clínica» u «Horario propio», «Cambiar horario», «Confirmar horario», marca «Por revisar», «Sin días de consulta».
12. [V] Duración de la consulta: 30 / 45 min / 1 hora / Otra; por consultorio «Cambiar» / «Usar la general».
13. [V] Tipos de cita: crear (nombre, duración, color o «Sin color», ámbito «Toda la clínica» o un médico), Editar, Archivar / Reactivar, Quitar.
14. [V] Avisos: interruptor «Recordatorio automático por correo» y cuándo mandarlo; interruptor «Avisar por correo de cada reserva»; «Hasta cuándo pueden apartar»; «No disponible todavía en este servidor».
15. [V] ⚠️ Los cambios se guardan solos, con aviso «Guardado»; los de alcance clínica avisan «Esto cambia para todos los médicos».
16. [V] Más opciones: «Personas bloqueadas» con «Desbloquear»; «Nadie está bloqueado».
17. [V] ⚠️ «Empezar de nuevo / Restablecer configuración»: diálogo que exige escribir una palabra para confirmar.
18. [V] ⚠️ Permisos finos (`puedeAdministrar`, `puedeEditar`, `puedeCrearTipos`, `puedeEmitir`): hay controles que solo ve quien administra; «No hay más opciones para tu cuenta» para el resto.
19. [V] Errores de lectura por bloque: «No se pudieron leer… Recarga la página».
20. [I] Existe una segunda composición (`ConfiguracionCalendario` con menú lateral de secciones: Primeros pasos, Horario y disponibilidad, Duración y tipos, Enlaces de reserva, Plazos y recordatorios, Contactos bloqueados, Restablecer). No confirmé cuál de las dos monta hoy `ConfiguracionAgenda`; vi importadas `PestanasConfiguracion` y `PrimeraVez`.

**20 funciones.**

---

## A14 · `(app)/documentos` (documento rápido, sin pasar por el expediente)

1. [V] Título y subtítulo.
2. [V] Paso 1: buscar paciente por nombre o apellido; elegir de la lista.
3. [V] «Crear nuevo paciente y continuar» → `QuickPatientModal`.
4. [V] `QuickPatientModal`: médico (si aplica), nombre, apellidos, fecha de nacimiento o edad, teléfono (con aviso «Sin teléfono ni correo no se podrán enviar confirmaciones»), correo, casilla de privacidad, aviso de duplicado con sus salidas.
5. [V] Tarjeta «Paciente seleccionado» con botón para cambiarlo.
6. [V] Paso 2: selector de tipo y el formulario correspondiente (todo A7).
7. [V] ⚠️ `?tipo=` preselecciona el tipo.
8. [V] Esqueleto de carga propio; plan bloqueado → `/billing`.

**8 funciones** (más las 26 de A7, que se montan aquí).

## A15 · `(app)/suplementacion`

1. [V] Página de consulta: «Stack de suplementación osteomuscular», tarjetas por suplemento con «Indicado cuando:».
2. [V] Bloque «Notas clínicas clave».

**2 funciones** (solo lectura; no tiene acciones).

---

## A16 · `(app)/perfil`

Archivos: `app/(app)/perfil/page.tsx` (1 442 líneas), `components/perfil/*`, `components/consultorios/*`.

1. [V] Título y esqueleto de carga.
2. [V] Tarjeta de identidad: vista de la firma («Sin firma») y de los colores.
3. [V] Pestañas: Datos · Consultorios · Google Calendar; ⚠️ `?tab=` las abre desde fuera (lo usan los enlaces de la agenda y del menú).
4. [V] Datos profesionales: tratamiento, nombre(s), apellido paterno, materno, universidad.
5. [V] Especialidades: selector, segunda especialidad escrita a mano, «Agregar especialidad», quitar.
6. [V] Cédula profesional y de especialidad con validación.
7. [V] ⚠️ Nombre de la clínica: editable solo para quien administra; el resto lo ve en lectura con la nota «Sólo quien administra la clínica puede cambiarlo».
8. [V] Firma autógrafa: subir imagen (JPG, PNG, WEBP hasta 10 MB) o dibujar con dedo o ratón; limpiar; vista previa sobre fondo blanco y oscuro; «Aceptar firma»; «Cambiar firma»; eliminar.
9. [V] ⚠️ Logo (solo admin): subir, quitar; se optimiza a 150 KB; es ancla del tour.
10. [V] ⚠️ Paleta de colores (solo admin): combinaciones predefinidas y dos selectores de color libres (primario y secundario), con vista previa del encabezado de los PDF. Estos dos colores tiñen toda la app.
11. [V] Resumen de consultorios y de Google Calendar dentro de Datos, con enlaces a sus pestañas.
12. [V] ⚠️ Barra de guardado: «Descartar» y «Guardar», activos solo si hay cambios; mensajes de guardado parcial.
13. [V] Consultorios: lista, «Agregar consultorio» (deshabilitado al llegar al tope), vacío «No tienes consultorios activos».
14. [V] Consultorio: insignia «Predeterminado», «Hacer predeterminado», «Editar» (nombre, nombre corto de 12 caracteres, dirección, teléfono, zona horaria con chips y select).
15. [V] ⚠️ «Eliminar» consultorio: deshabilitado con el motivo en `title`; el modal ofrece «Editar en lugar».
16. [V] Google Calendar: conectar, estado y cuenta, «Recrear calendario» (con confirmación), «Desconectar»; para no admin, solo mensaje.
17. [V] ⚠️ `?gcal_error=` muestra el error de la conexión con Google.
18. [V] Asistente de bienvenida (`OnboardingGuide`) montado aquí.

**18 funciones.**

---

## A17 · `(app)/estadisticas`

1. [V] Título y botón «Actualizar».
2. [V] Consultas por mes (últimos 6 meses).
3. [V] Top 10 diagnósticos.
4. [V] Top 10 medicamentos recetados.
5. [V] Distribución por sexo (con total de pacientes).
6. [V] Distribución por grupo de edad.
7. [V] Estados: esqueleto, «Error cargando estadísticas», «Sin datos suficientes aún» por bloque.
8. [V] ⚠️ Secretaria: redirige a `/dashboard`.

**8 funciones.**

## A18 · `(app)/admin/usuarios`

1. [V] ⚠️ Solo para quien administra; el resto va a `/dashboard`.
2. [V] «Invitar» abre el formulario: rol (Asistente o Médico), correo, nota según rol, Cancelar / «Enviar invitación».
3. [V] Contadores Médicos y Asistentes usados / tope del plan.
4. [V] Lista «Tu equipo» con insignia «Invitación enviada» para pendientes.
5. [V] ⚠️ «Reenviar invitación» (botón-icono con `title`).
6. [V] ⚠️ «Cancelar invitación / Eliminar usuario» (botón-icono con `title`) → modal de confirmación con texto distinto para pendiente y para activo.
7. [V] ⚠️ Modal «No se puede dar de baja» (médico con pacientes) con correo de soporte.
8. [V] Toasts de éxito, advertencia (el correo no salió) y error.

**8 funciones.**

## A19 · `(app)/billing`

1. [V] ⚠️ Solo para quien administra; el resto va a `/dashboard`.
2. [V] Banner «¡Suscripción activada!» al volver del pago (`?success=true&plan=`).
3. [V] Banner «Pago pendiente» con botón al portal de pago.
4. [V] Tarjeta del plan: nombre, chip de estado (Plan gratuito, Prueba gratuita, Activo, Pago pendiente, Cancelado), precio mensual, fechas.
5. [V] Variante «Plan VIP · Acceso completo».
6. [V] «Gestionar» → portal de Stripe; «Actualizar plan» → `/pricing`.
7. [V] Uso actual: barras de Médicos, Asistentes y Pacientes contra el límite.
8. [V] Lista «Incluido en tu plan» / «Acceso VIP — todo incluido».
9. [V] Esqueleto de carga.

**9 funciones.**

## A20 · `(app)/ayuda`

1. [V] Título «Centro de ayuda».
2. [V] 6 guías rápidas (registrar paciente, nota con IA, receta, cita, DICOM, enviar por email).
3. [V] ⚠️ «Volver a ver el tutorial paso a paso» (borra `spinus_onboarding` y relanza el asistente).
4. [V] Tabla de atajos de teclado (Ctrl+K, Esc, ↑↓, Enter).
5. [V] Preguntas frecuentes en acordeón (8).
6. [V] Seguridad y privacidad (3 sellos) con enlace a `/privacy`.
7. [V] «Contactar soporte» (mailto).

**7 funciones.** Ojo: la tabla de atajos no incluye los de la agenda v2.

---

## A21 · `(offline)/offline-mode` (búnker)

1. [V] Estados de entrada: «Sesión no detectada» (ir a iniciar sesión), «Perfil no disponible», «Navegación privada detectada», «Entorno seguro activado».
2. [V] Barra de estado: icono de red, «N pendientes / Sin pendientes».
3. [V] «Sincronizar» (solo con red y pendientes).
4. [V] ⚠️ «Salir»: deshabilitado si no hay red y hay pendientes.
5. [V] Resumen de sincronización descartable.
6. [V] ⚠️ «Pacientes encontrados en el sistema»: por cada coincidencia, vincular o crear nuevo; confirmar solo cuando todas están decididas.
7. [V] Pestañas: Paciente · Nota · Documentos · Cola (N).
8. [V] Paciente: nombre*, apellidos*, fecha de nacimiento*, sexo, teléfono, email; «Guardado en búnker».
9. [V] Nota manual: paciente*, motivo*, exploración, auxiliares, diagnósticos*, análisis, plan*, pronóstico; «Nota guardada en búnker»; vacío «Primero registra un paciente».
10. [V] Documentos: elegir paciente, rejilla de 8 tipos, formulario; con uno abierto, tira compacta de tipos (iconos con `title`) y botón para volver.
11. [V] Cola: listas de pacientes y documentos con insignia Pendiente / Sincronizado / Error; vacíos.
12. [V] ⚠️ «Limpiar sincronizados» y «Vaciar búnker» (este último sin confirmación en el código que vi).
13. [V] Modal «Red disponible»: «Sincronizar ahora» / «Seguir trabajando».
14. [V] Modal de salida con pendientes: sincronizar y salir / «Salir sin sincronizar».

**14 funciones.**

## A22 · `(offline)/offline-setup`

1. [V] Lista de pasos con estado (service worker → sesión → perfil → listo) y spinner en el paso actual.
2. [V] Redirección automática a `/offline-mode` al terminar.
3. [V] «Continuar de todos modos» si algo falla.

**3 funciones.**

### Total Parte A

| Pantalla | Funciones |
|---|---|
| A0 Cromo global | 23 |
| A1 Inicio | 21 |
| A2 Dashboard | 28 |
| A3 Expediente (lista) | 16 |
| A4 Paciente nuevo | 15 |
| A5 Expediente del paciente | 56 |
| A6 Consulta | 7 |
| A7 Documentos del paciente (taller) | 26 |
| A8 Editar paciente | 6 |
| A9–A10 Estado / Laboratorios | 2 |
| A11 Nueva nota | 26 |
| A12 Agenda | 72 |
| A13 Configuración de agenda | 20 |
| A14 Documentos (rápido) | 8 |
| A15 Suplementación | 2 |
| A16 Perfil | 18 |
| A17 Estadísticas | 8 |
| A18 Usuarios | 8 |
| A19 Facturación | 9 |
| A20 Ayuda | 7 |
| A21 Offline-mode | 14 |
| A22 Offline-setup | 3 |
| **Total** | **395** |

---

# PARTE B — Inventario de componentes de UI

Conteos hechos con `grep` sobre `app/(app)`, `app/(launcher)`, `app/(offline)` y `components/`, excluyendo dicom, calculadoras, super-admin, landing, legal, agenda pública y taller-v2. Son apariciones de la clase o etiqueta, no instancias renderizadas.

## B0 · El hallazgo que ordena todo: conviven tres sistemas de estilo

| Sistema | Dónde vive | Apariciones | Pantallas |
|---|---|---|---|
| **`sp-*`** (tokens y clases en `app/spinus-tokens.css`, 2 813 líneas; nació del «funnel de nota») | `var(--sp-…)` 1 921 usos en 66 archivos | el más nuevo | dashboard, expediente/[id], nueva-nota, perfil, formularios de documentos, labs |
| **`ag-*`** (agenda, en `app/globals.css`) | `var(--ag-…)` 781 usos en 69 archivos | propio de la agenda | agenda, configuración, menú lateral |
| **Tailwind a mano** (`slate-*` + hex entre corchetes) | `slate-*` 823 usos en 61 archivos; hex en línea 398 usos en 38 archivos | el más viejo | inicio, lista de expediente, paciente nuevo, editar, consulta, documentos (rápido), estadísticas, usuarios, facturación, ayuda, offline, paleta de comandos, modales de paciente rápido |

Desglose por pantalla (apariciones de `sp` / `ag` / `slate` / hex): inicio 0/0/26/15 · dashboard 66/1/0/0 · expediente lista 0/0/20/56 · paciente nuevo 0/0/16/24 · expediente/[id] 22/0/2/0 · consulta 6/0/17/20 · editar 0/0/8/12 · nueva-nota 261/0/30/4 · agenda 0/29/1/0 · documentos rápido 1/0/12/25 · perfil 115/0/7/4 · estadísticas 0/0/4/12 · usuarios 2/0/24/37 · facturación 0/0/24/12 · ayuda 8/0/25/9 · offline-mode 0/0/69/0.

Consecuencia para el modo oscuro: `dark:` aparece solo 13 veces. El oscuro funciona por tokens, así que las pantallas del tercer grupo (hex fijos como `#1a3a5c`, `#1d1d1f`, `bg-white`) no lo siguen [I: no lo probé en navegador]. Tampoco siguen el color de marca que el médico elige en su perfil, porque llevan `#1e5fa8` escrito.

## B1 · Botones

**Compartido:** clase `.sp-btn` + variantes (`spinus-tokens.css:867-951`). No hay componente `<Button>`; todo son clases sobre `<button>`, `<a>` o `<Link>`. Hay 548 `<button>` en 155 archivos.

| Variante | Alto real | Usos / archivos |
|---|---|---|
| `sp-btn--primary` | `min-height: 44px`, relleno 13×26 | 66 / 21 |
| `sp-btn--primary-block` (CTA ancho completo) | relleno 16 → ≈ 52 px | 7 / 3 |
| `sp-btn--secondary` | 44 px | 23 / 14 |
| `sp-btn--tertiary` | 44 px | 8 / 2 |
| `sp-btn--ghost` | 44 px | 23 / 7 |
| `sp-btn--compact` | **34 px** (`min-height: 34px`) | 24 / 13 |
| `sp-btn--reward` (solo sombra) | 44 px | 2 / 2 |
| `.ag-capa-boton` / `--principal` (agenda) | **36 px** | 21 / 7 |
| `.ag-boton-icono` | **38 px** | agenda |
| `.ag-burbuja-pie-boton` | 52 px | burbuja |
| `.sp-doc-iconbtn` (quitar renglón) | 44 px | formularios |

**Repetido a mano (duplicación):**

- Botón primario con hex: `bg-[#1e5fa8] … rounded-xl text-sm` aparece 42 veces en 22 archivos y `bg-[#1a3a5c]` 26 veces en 14. Ejemplos: `expediente/page.tsx:227` (`py-2`, ≈ 36 px), `admin/usuarios/page.tsx:212` (`px-4 py-2`, ≈ 36 px) y `:279` (`py-2.5`, ≈ 40 px), `ConsultaRapidaModal.tsx:521`.
- Botón secundario «con borde», escrito con clases sueltas en vez de `sp-btn--secondary`: `dashboard/page.tsx:177` y `:194`.
- Geometría forzada por `style` encima de `sp-btn--primary`: `GEOMETRIA_ACCION` (34 px, `ProximasCitas.tsx:119`), `TarjetaHoy.tsx:136` (40 px), `DocumentosRecientes.tsx:89` (44 px), `LineaTiempoClinica.tsx:274` (42 px). Cuatro altos distintos para el mismo botón.
- Botones-icono: cada pantalla trae el suyo (`p-1.5`, `p-2`, `w-7 h-7`, `h-[32px] w-[32px]`, `w-[34px] h-[34px]`, `h-9`).

## B2 · Controles por debajo de 44 px (alto real)

El sistema declara `--sp-tap: 44px` como «área táctil mínima — nunca menor» (`spinus-tokens.css:459`). Esto queda por debajo [V salvo donde se indica]:

| Control | Alto | Archivo |
|---|---|---|
| Cerrar de `ModalShell` (X) | 28 px | `ui/ModalShell.tsx:271` |
| Eliminar archivo en tarjeta de labs | 28 px | `labs/CardDocumento.tsx:92,136` |
| Eliminar medición | 28 px | `labs/TablaMediciones.tsx:161` |
| Menú ⋮ de la lista de pacientes | ≈ 28 px [I: icono + `p-1.5`] | `expediente/KebabAccionesPaciente.tsx:70` |
| Selector segmentado (cada opción) | ≈ 31 px [I: `py-[6px]` + texto 12,5 px] | `ui/SelectorSegmentado.tsx:88` |
| Acciones del documento (descargar, compartir, enviar, regenerar, ⋯) | 32 px | `expediente/AccionesDocumento.tsx:85` |
| Acciones de fila en Próximas citas e icono «Expediente» | 34 px | `dashboard/ProximasCitas.tsx:119`, `dashboard/page.tsx:324` |
| `sp-btn--compact` (24 usos) | 34 px | tokens |
| Acciones de consultorio (predeterminado, editar, eliminar) | 34 px en escritorio, 44 en táctil [I: `h-[34px]` + `min-h-[var(--sp-tap)]`] | `perfil/PanelConsultorios.tsx:277` |
| Icono de perfil del inicio | ≈ 34 px | `(launcher)/inicio/page.tsx:254` |
| Hijos del menú lateral | ≈ 34 px [I: `py-2` + 12 px] | `layout/Sidebar.tsx:730` |
| Botón hamburguesa flotante | ≈ 36 px [I: `p-2` + icono 20] | `layout/Sidebar.tsx:563` |
| Campos y botones de las capas de la agenda | 36 px | `globals.css:6059,6122,6574` |
| Controles de la barra de la agenda (vistas, Compactar, Densidad, filtro, engrane, Agendar) | 36 px (`h-9`) | `agenda/CabeceraEscritorio.tsx:140-402` |
| «Nuevo paciente» de la lista | ≈ 36 px | `expediente/page.tsx:227` |
| Botón-icono de la agenda | 38 px | `globals.css:6695` |
| Entradas del menú lateral y opciones de menú de la agenda | ≈ 40 px | `Sidebar.tsx:687`, `globals.css:6728` |
| Campos de filtro de la lista de pacientes | ≈ 40 px [I: `py-2.5` + `text-sm`] | `expediente/page.tsx:244-295` |
| «Abrir agenda» de la tarjeta Hoy | 40 px | `dashboard/TarjetaHoy.tsx:136` |

Sí cumplen 44 px o más: `sp-btn` normales, las cuatro acciones de la cabecera del paciente (`CabeceraPaciente.tsx:28`, su propia `GEOMETRIA_ACCION` a 44 px; ojo, es una constante homónima de la del dashboard, que vale 34), `sp-input`, `sp-chip`, `sp-doc-iconbtn`, el botón de menú del dashboard (44), el buscador y los botones de la primera banda del dashboard (48–50), las vistas de la banda móvil de la agenda (44), el pie de la burbuja (52).

## B3 · Campos (texto, select, fecha, hora, casilla, interruptor)

- **Compartido:** `.sp-input` / `.sp-textarea` (44 px mínimo; 123 usos en 18 archivos), `.sp-doc-field` (etiqueta + campo; 61 usos en 8 archivos, solo formularios de documentos), `.sp-label-field`, `.ag-capa-campo` (36 px, agenda), `configuracion/CampoAjuste.tsx`.
- **A mano:** 199 `<input>` en 56 archivos, 50 `<select>` en 33, 31 `<textarea>` en 15. El patrón `bg-white border border-slate-200 rounded-xl text-sm` se repite en `expediente/page.tsx`, `pacientes/nuevo`, `editar`, `QuickPatientModal`, `ConsultaRapidaModal`, `CommandPalette`, `offline-mode`, `admin/usuarios`.
- **Fecha y hora:** siempre nativos (`type="date"` 33 usos en 20 archivos; `type="time"` 12 en 7). No hay selector propio, salvo `agenda/MiniMes.tsx` para navegar.
- **Select:** nativo en todas partes. Combos propios: `documentos/ComboEscribible.tsx`, `ui/CIE10Combobox.tsx`, `labs/AutocompleteAnalito.tsx`, `AutocompleteMedicamento.tsx`, `ui/EspecialidadSelector.tsx`. Son cinco autocompletados con la misma mecánica (↑↓ Enter Esc) escritos por separado.
- **Interruptor:** `agenda/configuracion/Interruptor.tsx` (compartido solo dentro de configuración) y `.sp-doc-switch` (honorarios). El resto son casillas nativas.
- **Segmentado:** `ui/SelectorSegmentado.tsx` (3 usos: línea de tiempo, formato de archivos, mediciones) frente a `.sp-doc-segmented` (consentimiento, honorarios), el conmutador Cita | Evento del modal de cita y las vistas Mes/Semana/Día de la agenda: cuatro implementaciones.
- **Búsqueda de paciente:** cinco veces escrita (`CommandPalette`, `ConsultaRapidaModal`, `documentos/page.tsx`, `AppointmentModal`, `BurbujaAlta` / `PanelLigarCita`).
- **Alta rápida de paciente con aviso de duplicado:** cuatro veces (`CommandPalette`, `ConsultaRapidaModal`, `QuickPatientModal`, `pacientes/nuevo`), con los mismos tres botones de salida.

## B4 · Tarjetas

- **Compartido:** `.sp-card` (+ `--hero`, `--anchor`, `sp-card-inner`; 53 usos en 18 archivos), `.sp-doc-card`, `.sp-tile`, `configuracion/TarjetaSeccion.tsx`.
- **A mano:** `bg-white rounded-xl|2xl border …` 47 veces en 19 archivos (estadísticas `SectionCard` local, usuarios, facturación, ayuda, lista de expediente, offline). El «chasis» del dashboard (`Chasis` en `TarjetaHoy.tsx` y otro en `ProximasCitas.tsx`) está definido dos veces con el mismo nombre.

## B5 · Píldoras y chips de estado

- **Compartido:** `.sp-chip` (11 usos / 6 archivos), `.sp-badge` (+ `--warn`, `--danger`, `--inline`, `--deferred`; 22 / 9).
- **Estado de cita:** tres implementaciones: `dashboard/StatusChip.tsx` (2 usos), la leyenda del dashboard (`ProximasCitas.tsx:159-175`) y `agenda/LeyendaEstados` + `DesgloseEstados` con tokens `--ag-status-*`.
- **A mano:** `ESTADO_CONFIG` en facturación (`bg-emerald-100 text-emerald-700`…), `STATUS_BADGE` en offline, insignias «Nota sellada» / «Nota manual» en dos sitios (`VisorNota` usa `Insignia`; `consulta/[consultaId]` las escribe con clases), chip de médico (`ChipMedico.tsx`), chips de acción del dashboard (`piezasBanda2.tsx: ChipAccion`).

## B6 · Pestañas

No hay componente compartido. 10 `tablist` en 9 archivos, cada uno con su marcado: `PestanasExpediente`, `PestanasPerfil`, `PestanasConfiguracion` + `MenuConfiguracion`, `SelectorTipoDocumento`, vistas de la agenda (escritorio y banda móvil), pestañas del búnker (botones sin `role`), conmutador Cita | Evento. `PestanasExpediente` y `PestanasPerfil` son casi idénticas (subrayado de 2,5 px en el color primario).

## B7 · Tablas y listas

- Solo 5 `<table>`: lista de pacientes (`TablaPacientesExpediente`, con cabeceras ordenables), mediciones (`TablaMediciones`), y tres menores.
- El resto son listas de filas hechas con `div`: `.sp-row`, `.sp-doc-listrow`, filas del dashboard, `agenda/FilaLista*`, `FilaDelPanel`, `.sp-tpl-item`.
- Patrón «carril + visor» (lista a la izquierda, detalle a la derecha, alternancia en móvil): duplicado entre `CarrilConsultas` y `CarrilDocumentos`.

## B8 · Avatares

Sin componente. Iniciales en círculo o cuadrado redondeado escritas en 6 sitios con tres paletas: `dashboard/paletaAvatar.ts` (`PALETA_AVATAR`, tokens `--sp-avatar-*`, 10 pares medidos), `AVATAR_COLORS` (lista de pacientes, clases Tailwind) y `COLOR_AVATAR` (cabecera del paciente). Tamaños: 34, 36 y 40 px.

## B9 · Modales y hojas

- **Compartido:** `ui/ModalShell.tsx` — props `title`, `subtitle`, `icon`, `headerRight`, `footer`, `maxWidth`, `elevated` (z-60), `hideClose`, `fullscreenMobile`, y `spinusGeometry` con cuatro geometrías: `work` (724 px, arriba), `decide` (620), `done` (600), `wait` (560). Sin `spinusGeometry` usa el estilo viejo (cristal, cabecera de 14 px). Esc cierra. 24 usos en 19 archivos. Deuda conocida: sin trampa de foco.
- **Compartido en agenda:** `hooks/useDialogoModal.ts` (16 archivos) + `agenda/CapaBarra.tsx` (capas ancladas a un botón) + `agenda/ConfirmModal.tsx` (8 usos).
- **A mano (`fixed inset-0`, 17 archivos):** eliminar paciente (`expediente/[id]/page.tsx:233`), confirmación y bloqueo de baja en usuarios, los dos modales del búnker, `OfflineAlert`, `QuickPatientModal`, `CommandPalette`, `ConsultaRapidaModal`, y los de agenda (`AppointmentModal`, `HorarioModal`, `ModalBloqueo`, `ModalInvitacionCita`, `DialogoHorario`, `ConfirmacionRestablecer`).
- **Confirmaciones:** no hay `window.confirm` en ningún sitio (bien), pero la confirmación destructiva está hecha de cuatro maneras: `ModalShell` con pie, `ConfirmModal` de agenda, modal a mano, y confirmación en línea (nueva-nota «Sí, empezar de nuevo / Conservar»).
- **Hoja inferior:** una sola de verdad, `expediente/SheetFiltrosExpediente.tsx`. Los modales a mano se pegan abajo en móvil con `items-end sm:items-center`. La burbuja de cita tiene su propia presentación móvil [I].
- **Pantalla completa:** `FirmadoConsentimiento` y `ModalShell fullscreenMobile`.

## B10 · Toasts

`ui/Toast.tsx`, único y compartido: 4 tipos, abajo a la derecha, 4 s (8 s advertencia), colores Tailwind fijos (`bg-emerald-50`…) fuera de tokens. `useToast()` en 34 archivos. La agenda tiene además su aviso propio («aviso flotante») que se apaga con v2.

## B11 · Tooltips

No existe componente. Todo es `title=` nativo: 100 usos en 54 archivos. En táctil no se ven, así que la información que solo vive ahí se pierde en el teléfono: motivo de un botón deshabilitado (eliminar consultorio, subir archivo, guardar plantilla), nombre de botones-icono, médicos ocultos tras «+N», notas truncadas, estado de un signo vital. Única excepción: la tarjeta de lectura de la agenda al pasar el ratón.

## B12 · Menús desplegables

Sin componente común. Implementaciones: `KebabAccionesPaciente` (⋮), `AccionesDocumento` «Más acciones», `ConsultorioActivoSelector`, `MenuEngraneAgenda` (el único con `role="menu"` y teclado completo), `EditorEscrito` (menús de bloque y «más»), panel «Más» de la burbuja.

## B13 · Esqueletos y cargadores

- **Compartido:** `ui/Skeleton.tsx` exporta `Skeleton`, `PatientRowSkeleton`, `PatientListSkeleton`, `DashboardSkeleton`, `PerfilSkeleton`, `BillingSkeleton`, `ListSkeleton` (10 importadores).
- **Junto al componente:** cada bloque del dashboard exporta su `…Cargando` (`ProximasCitasCargando`, `TarjetaHoyCargando`, `AtendidosCargando`, `DocumentosCargando`…), `.sp-tpl-skeleton`.
- **A mano:** `animate-pulse` / `.skeleton` 37 veces en 18 archivos.
- **Spinners:** `<Loader2 className="animate-spin">` 68 veces en 32 archivos frente a `.sp-spinner` 16 en 6. Los textos «Cargando…», «Guardando…», «Generando…» están escritos en cada botón.

## B14 · Estados vacíos y de error

Sin componente común. Variantes: `dashboard/piezasBanda2.tsx: AvisoColumna` (icono + mensaje + Reintentar o enlace; el más reutilizable), `.sp-doc-empty`, `.sp-tpl-empty`, `agenda/renderSinEventos`, y bloques a mano en lista de pacientes, labs, expediente y búnker. El patrón «error + Reintentar» está escrito al menos 9 veces.

## B15 · Banners y avisos

- **Compartido:** `.sp-banner` (+ `--warn`, `--danger`, `--info`; 118 usos en 14 archivos, sobre todo formularios), `.sp-callout`.
- **Propios:** `billing/SuscripcionBanner`, `agenda/AvisosAgenda`, `configuracion/AvisoGuardado`, `sidebar/AvisoPerfilSidebar`, banner «Borrador restaurado», bloque ámbar de duplicado (repetido 4 veces), banners de facturación con clases Tailwind.

## B16 · Otros

- `ui/Portal.tsx` (26 usos), `layout/Breadcrumbs.tsx` (1 uso), `layout/PageTransition.tsx`, `documentos/SeccionPlegable.tsx` (plegable; hay otros dos plegables a mano: «Datos adicionales» de paciente nuevo y las preguntas frecuentes de ayuda).
- Iconos: `lucide-react` en toda la app, con iconos propios en la burbuja de la agenda (`IconoDelEvento`, `IconoPuntos`…).

### Los más duplicados (para priorizar)

1. Botón primario (clase `sp-btn` vs 68 botones con hex a mano vs `ag-capa-boton`, con altos de 34 a 52 px).
2. Campo de texto / select (`sp-input` vs `border-slate-200 rounded-xl` a mano vs `ag-capa-campo`).
3. Modal (`ModalShell` en 19 archivos vs 15 modales a mano vs el sistema de capas de la agenda).
4. Búsqueda de paciente (5) y alta rápida con duplicado (4).
5. Pestañas (≥ 7 implementaciones) y control segmentado (4).
6. Chip de estado de cita (3) y avatar de iniciales (3 paletas).
7. Estado «error + Reintentar» (≥ 9) y spinner en botón (68).
8. Autocompletado (5) y menú desplegable (6).

---

# PARTE C — Documentos de diseño que ya existen

### `SPEC_DISENO.md` (593 líneas)
Especificación del **papel**, no de la pantalla: el «chasis» de los PDF (hoja 612 × 792 pt, retícula de 12 columnas, tipografías y versalitas, color y derivación del acento, panel circular de identidad, membrete, riel de identificación, tabla, bloque de firmas, QR y folio, marca de estado). La Parte A está completa y verificada contra el archivo de diseño; la B se declara «no extraída» aquí y continúa en el documento siguiente. Vigente para los PDF. Para el rediseño de la app importa por una decisión: el acento del documento se deriva por algoritmo del color del médico. No aplica a geometría de pantalla.

### `SPEC_DISENO_PARTE_B.md` (2 434 líneas)
Ficha por cada uno de los 8 formatos impresos (título exacto, orden de bloques, ranuras, cadenas literales, valores propios). Recoge dos decisiones cerradas: en la receta la vía no oral se destaca en negativo y la oral va en texto plano; la firma manuscrita tiene dos tramos (77 pt hasta 2 firmas, 28 pt de 3 a 6) y en el consentimiento el médico firma a mano. Vigente para PDF. El rediseño de pantalla no debe cambiar los nombres ni el orden de los campos de los formularios, porque alimentan estas ranuras.

### `PROPUESTA_DISENO_DOCUMENTOS.md` (1 638 líneas)
El documento de diseño de pantalla más importante que ya existe: presentación de los 8 formularios. Define el sistema de plantillas (selector, guardar, panel de gestión, tope de 10), el modal posterior a imprimir (con invariantes «no tocar» en §2.0), y §3 «Acabado»: rejillas por consulta de contenedor y no por viewport, migración de 74 hex a tokens, **«El control. Una sola altura: 44 px»** (§3.A.1), un solo patrón de cabecera de sección, de card plegable, de lista de ítems, de validación y de barra de acciones, literales exactos de copy, y la barra de tipos como matriz fija 3×3 con color de identidad por tipo. Está implementado (las clases `sp-doc-*`, `sp-tpl-*` existen y se usan). Hay que respetarlo: es la referencia de lo que el resto de la app todavía no cumple. §3.A.10 y §6 listan lo que dejó abierto.

### `RESUMEN_DASHBOARD.md` (208 líneas)
Describe un «dashboard del paciente» en `/expediente/[id]/estado` con `DashboardCard`, `DashboardHero` y cards plegables. **Obsoleto en lo estructural:** esa ruta hoy solo redirige al expediente y la carpeta `components/expediente/dashboard/` ya no existe; su contenido pasó a la pestaña Resumen (`FichaClinica`). `CLAUDE.md` todavía lo cita como lectura obligatoria. Lo único rescatable son sus criterios de estilo («iOS-strict»): duraciones de 200–300 ms, espaciado en múltiplos de 4, radio de 16 px, sombras leves, CSS puro sin librería de animación. Conviene revisarlos contra los tokens `--sp-*` antes de darlos por vigentes.

### `design/agenda/design_handoff_agenda/` (README + prototipo HTML/JSX)
Entrega original del rediseño de la agenda: vistas Mes · Semana · Día · Recurso, tarjetas de cita con estado por color, eventos de Google de solo lectura, arrastrar para reagendar, panel de detalle, claro y oscuro. La regla que sigue viva y que el rediseño general debe heredar: **la app no tiene un azul fijo**; todo el cromo se deriva de los dos colores que el médico elige (`--cp` oscuro, `--cs` brillante) y no se escribe ningún hex de marca. Parcialmente superado: proponía sustituir FullCalendar y una vista «Recurso»; lo que se construyó sigue sobre FullCalendar y sin esa vista (ver `docs/spec/SPEC_AGENDA.md`).

### `design/casos-clinicos/`
Prototipo de una función distinta («Crea tu caso clínico»: lista, editor, anotaciones, exportación) con su propio `spinus.css` y capturas. No corresponde a ninguna pantalla en alcance; sirve solo como referencia de lenguaje visual.

### `docs/spec/SPEC_AGENDA.md` (1 165 líneas)
La especificación estética vigente de la agenda sobre FullCalendar 6.1.20 con plugins gratuitos: tokens `--ag-*`, tipografía, anatomía de la tarjeta de evento, los cinco estados (ámbar agendada, azul confirmada, verde atendida…), color e icono de eventos propios, eventos de Google, las tres vistas, compactar y panel lateral, banda azul del header móvil, estados vacíos y de carga, accesibilidad visual, conmutador Cita | Evento. Implementada y en uso. Si el rediseño unifica sistemas, esta es la mitad «agenda» que hay que reconciliar con `--sp-*`.

### `docs/spec/MODO_OSCURO_APP.md` (421) y `MODO_OSCURO_AGENDA.md` (130)
Criterio y valores del modo oscuro. App: superficie de card `#1E1E1E` sobre lienzo `#121212`; fórmula para lo que depende del color del médico y tabla de hex medidos para las nueve familias fijas, con contrastes validados por pares. Agenda: veinte valores de estado medidos. Decisiones que no se reabren: la banda de alergias no se atenúa; `--sp-on-primary` es blanco fijo; el cromo de marca (menú lateral, banda móvil) ya está resuelto con `--ag-navy`; los pares de avatar están medidos. Principio rector: **«el modo oscuro es una sustitución de color, nunca un rediseño»**. Cualquier color nuevo del rediseño necesita su par oscuro medido.

### `docs/spec/CONTRASTE_Y_MOVIMIENTO_AGENDA.md` (281)
Dos reglas: la hora de un evento genérico va en tinta neutra, nunca en el color del evento; y la escala de movimiento (tres duraciones, tres curvas), qué se anima y qué no, y `prefers-reduced-motion`. Vigente; es el mejor candidato a convertirse en la escala de movimiento de toda la app.

### `docs/spec/RIESGOS_AGENDA.md` (336)
18 puntos donde el CSS pelea con FullCalendar, ordenados por coste (`min-width: 0` en el contenedor, `height: 'auto'`, eventos concurrentes, `mask-image` con prefijo, `env(safe-area-inset-*)`, `<option>` blancas sobre blanco…). Lectura obligada antes de tocar la piel de la agenda.

### `docs/spec/*.dc.html`, `rediseno-paginas-agenda.html`, `export-movil/`, `docs/mockups/*.png`
Maquetas de referencia: `Burbuja.dc.html` (burbuja de cita), `Configuracion.dc.html` y `Main.dc.html` («Configura tu agenda»), `rediseno-paginas-agenda.html`, tres exportaciones móviles (Día en lista, Semana en lista, Mes) y siete capturas (`dia`, `semana`, `mes`, `mobile`, `mobile-obscuro`, `obscuro`, `obscuro2`). No las abrí una por una [I: su vigencia frente al código]; son la fuente visual de la agenda v2 y de su configuración.

### Otros documentos de diseño que conviene conocer (no pedidos, encontrados)
`app/spinus-tokens.css` (cabecera: «Sistema de diseño — Funnel de Nota Médica, extraído 1:1 de los mockups M1–M10») es de hecho el sistema de diseño de la app. También `BLUEPRINT_FUNNEL_NOTA.md` y `NOTA_IA_PROMPT_DISEÑO.md` (flujo de la nota), `DOCUMENTOS_SPEC.md` y las `GUIA_FORM_*.md` (formularios), `mejora_agendaV2.md` y `GUIA_PRUEBAS_AGENDA_V2.md` (agenda v2; la guía de pruebas es en la práctica una lista de verificación funcional de 6 684 líneas). `MODO_OSCURO_APP.md` cita un `SPEC_EXPEDIENTE_PACIENTE.md` que no está en el repo.

---

## Anexo — Las ⚠️ que más riesgo corren en un rediseño

1. **Estado en la URL**: `?tab=`, `?consulta=`, `?documento=` (expediente); `?tipo=`, `?dx=`, `?borrador=`, `?doc=` (documentos); `?cita=` (agenda y nueva nota); `?cita=nueva&paciente=`; `?tab=` y `?gcal_error=` (perfil); `?success=&plan=` (facturación). Los enlaces entre pantallas dependen de ellos.
2. **Anclas `data-onboard`** del asistente de bienvenida (7 valores).
3. **Atajos**: `Ctrl/⌘+K` global; nueve atajos de una tecla en la agenda v2; teclado dentro del selector de tipo de documento, la burbuja y el menú del engrane.
4. **Gestos**: arrastrar y estirar citas; deslizar para cambiar de periodo; arrastrar y soltar archivos; firmar con el dedo; carrusel con snap en el dashboard.
5. **Solo hover / solo `title`**: tarjeta de lectura de la agenda; motivos de botones deshabilitados; nombres de botones-icono; médicos tras «+N».
6. **Menús de tres puntos**: fila de paciente (⋮), «Más acciones» del documento, «Más opciones» de la cita, menú del engrane.
7. **Acciones casi invisibles**: «Eliminar paciente» (enlace gris de 12 px), dirección de orden (icono), colapsar carril, «Usar otro correo solo para este envío», «Terminar después», «Vaciar búnker».
8. **Diferencias por rol**: la secretaria no entra al expediente del paciente, no tiene perfil ni ayuda en el menú, y tiene su propio dashboard; el médico invitado no ve «Todos los médicos», ni logo/paleta/nombre de clínica, ni usuarios/facturación; controles de configuración de agenda según cuatro permisos.
9. **Plan bloqueado**: banner, modal de bloqueo desde menú/inicio/agenda/lista, y redirección a `/billing` en paciente nuevo, nueva nota y documentos.
10. **Flag agenda v2**: 27 de las 72 funciones de la agenda solo existen encendido y 2 solo apagado (botón «Horario» + `HorarioModal`, fila fija de leyenda). El rediseño tiene que cubrir las dos ramas o decidir explícitamente que v1 se retira.
11. **Reglas de dominio que la interfaz no debe contradecir**: notas selladas (solo addendum), consentimiento de privacidad obligatorio al crear paciente, confirmación explícita antes de enviar a un correo escrito a mano.
