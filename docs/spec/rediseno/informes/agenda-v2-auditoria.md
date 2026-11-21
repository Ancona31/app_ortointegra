# Agenda v2 · auditoría de solo lectura para el rediseño

Código: rama `feature/agenda-v2`, commit **951e31b3** (clon de trabajo `S/app`, movido desde 63938e2 con `git fetch` del repo local; sin cambios en el repo). Las referencias `archivo:línea` son relativas a `S/app/src/` salvo que se diga otra cosa.
Capturas: `S/cap-agenda/` (296 PNG; `vista@dispositivo[-oscuro].png`), métricas por captura en `S/cap-agenda/metricas*.json`. Dispositivos: `tel` 393×852 (barra 59 arriba, 34 abajo) · `ext` 466×678 (franja derecha 84, abajo 34) · `iv` 669×951 (franja superior 82) · `ih` 951×669 (franja derecha 84) · `esc` 1280×800 · `esc14` 1440×900, y tiras de la barra a 1024/1180/1400/1600 (`barra-*`). La franja se emuló con `Emulation.setSafeAreaInsetsOverride` y se dibuja rayada en rojo sobre la captura.

**Cómo se levantó.** Supabase local 2.117.0 (Docker había caído; se relanzó `dockerd`), `db reset` (50 migraciones, incluidas las 2 nuevas `20261125170000_audit_log_sin_truncate` y `20261125180000_agenda_m_saludo_recordatorio`), semilla `scripts/agenda-semilla.ts`, fila `agenda_ajustes.agenda_v2_encendida=true` para Clínica Semilla A, `npm run build` (OK) y `next start`. Para poder ver estados que la semilla no trae añadí en la base LOCAL, con datos ficticios: un evento de Google «por asignar» («Revisión de estudios», hoy 18:30), la aprobación local del aviso de reserva (`reserva_avisos`, versión `reserva-2026-11-v1`) y, recorriendo la propia app, un enlace fijo, un enlace de una vez y una reserva por enlace de «Paciente Prueba 26» (hoy 14:00). El servidor se arrancó con `RESERVA_SECRETO` (64 hex ficticios) y `RESERVA_AVISO_BORRADOR_LOCAL=1` como variables de proceso: el `RESERVA_SECRETO` de `S/app/.env.local` mide 44 caracteres y la app exige 64 hex, así que sin eso la reserva por enlace dice «no está configurada en este servidor». El asistente de primera vez se completó (con la app) para ver las pestañas.

---

## 0. Resumen en una pantalla

1. **La agenda es hoy un cuarto sistema visual.** 131 tokens `--ag-*` propios (globals.css:24-600 y su oscuro en 6869-7197), radios 6/8/10/12/999, curvas Material (`cubic-bezier(.4,0,.2,1)`), texto de la rejilla a 9–11.5 px, y un oscuro que mezcla tres familias: la rejilla es `.bg-white` repintada a gris `#1E1E1E` por `ThemeProvider.tsx:178`, los paneles y la burbuja son navy `--ag-surface #1b2a40`, y el resto de la app rediseñada usa `--fondo #0C1420`/`--sup #16223A`.
2. **Texto < 12 px por todas partes en ancho**: en Semana a 1280, 69 de 123 textos visibles miden < 12 px; en Mes, 224 de 291. En el código: 33 reglas CSS de agenda < 12 px (mínimo 9 px: `.ag-tarjeta-chip`, `.ag-tarjeta-marca`, `.ag-gcal-badge`, `.ag-mes-badge`) y 43 usos `text-[10/11px]` en TSX (23 en `AppointmentModal`).
3. **Nada respeta la franja derecha.** No hay un solo `env(safe-area-inset-right)` en la app (`(app)/layout.tsx:217-220` lo deja fuera a propósito porque el manifiesto fija vertical, pero el Duo cerrado tiene la franja en vertical). En `ext` y en `ih`: «Hoy ›», el engrane, la ✕ y el ⋮ de la burbuja, el final de «Agendar», la hoja de la cita, los menús, la campana y el pie del formulario caen bajo la franja (hasta 20 controles en Mes).
4. **Ninguna respuesta al toque en la app de agenda**: 0 reglas `:active` en el CSS de agenda y 0 clases `active:` en sus TSX (la reserva pública sí tiene `scale(.98)`, agendaPublica.css:255). Animaciones con `@keyframes` y duraciones fijas (120/180/240 ms), no resortes; `prefers-reduced-motion` apaga todo a .01 ms en vez de cambiar a fundido; no existe `prefers-reduced-transparency` ni desenfoque en los velos.
5. **Capas**: en teléfono y en el Duo abierto (≤ 1023 px, incluido `ih` 951) la burbuja es una hoja inferior a todo el ancho (`.ag-hoja { inset-inline:0 }`, globals.css:5998), sin asa ni arrastre, que en `ih` mide 941 px y pasa bajo la franja; en `esc` es una capa de 360 px anclada a la cita. Los modales grandes (`AppointmentModal`) son pantalla completa en teléfono y modal de 560 px en ancho.
6. **Barra de escritorio (tanda M)**: dos filas de 1024 a 1359 px, una fila desde 1360, y de 1360 a 1439 «Agendar» queda solo «+» (36 px). En Día con panel a 1024 la barra se rompe en cuatro filas (~240 px de alto) y la fecha se corta («Viernes, 20 de n…»), `barra-dia@1024.png`.
7. **La configuración usa en «computadora» (≥ 640 px) una escala de 13 px y 40 px de alto** (estilosConfig.ts, tanda M). El Duo abierto (669 y 951) cae en esa escala aunque es táctil: en `iv` e `ih` el 100 % de los controles de la configuración mide < 44 px. En el teléfono, las pestañas son solo iconos.
8. **Cambios funcionales desde el informe anterior** (63938e2 → 951e31b3): el ⋮ de la burbuja ya no abre menú, abre el formulario completo (se fue el panel «Más» con recordatorios, consultorio y teléfono); nueva línea «Observaciones:» en la burbuja; posición «Bloqueo» en el conmutador del formulario; rayado de bloqueos recortado al horario; barra partida en dos ítems; escala nueva y avisos de permisos nuevos en la configuración; botón «Salir» en el comprobante público y nota verde «ya verificado».
9. **Dashboard**: desde 63938e2 no cambió ningún archivo de `app/(app)/dashboard` ni de `components/dashboard`, ni `BotonNoEsCita`, `VentanaLigarCita`, `PanelLigarCita`, `MarcasCita`, `tarjetasAgenda`. Nada nuevo contradice la maqueta de CALMA §24. Sí hay discrepancias de texto previas que la maqueta arrastra (ver §7).
10. **Deuda**: el árbol `ConfiguracionCalendario` (≈1 400 líneas) no lo monta nadie; la reserva por enlace no abre en producción mientras el aviso lleve «PENDIENTE DE REVISIÓN LEGAL»; textos de origen y de ligado distintos en cada sitio; `PanelLigarCita` dice «Reservó Revisión de estudios» con un evento de Google.

---

## 1. Inventario de pantallas y funciones

Leyenda: **[N]** nuevo desde el informe anterior · **[C]** cambió · **[=]** igual · **[I]** inferido (no leído línea a línea). Numeración propia; entre paréntesis el número del informe anterior (`A12.n`, `A13.n`, `A2.n`) cuando existe.

### 1.1 Página `/agenda` — estructura y estados
`app/(app)/agenda/page.tsx` (servidor: semilla de citas, flag por clínica) → `AgendaCliente.tsx` (2 428 líneas). Corte de diseño: `ANCHO_MOVIL = 1024` (AgendaCliente.tsx:239); tableta 768–1023 (`ANCHO_TABLETA`, lib/agenda/vistasAgenda.ts:70). Vistas por formato (vistasAgenda.ts:39-43): ancho Mes/Semana/Día = `dayGridMonth`/`timeGridWeek`/`timeGridDay`; teléfono `dayGridMonth`/`listWeek`/`listDay`; tableta `dayGridMonth`/`timeGridTresDias` («3 días», BandaMovil.tsx:135)/`timeGridDay`.

1. [=] Esqueleto de carga `app/(app)/agenda/loading.tsx:50` («Cargando agenda»). (A12.32)
2. [=] Tarjeta de la agenda `.agenda-fc bg-white rounded-2xl border border-slate-100 shadow-sm` (AgendaCliente.tsx:1774); atenuada a .55 al cargar (`ag-cargando`) o con error (`ag-desactualizada`).
3. [=] Avisos de página (`AvisosAgenda.tsx`): «No se pudo cargar la agenda.» (:122) con reintento; «Faltan citas por mostrar.» (:152); «No se pudo sincronizar con Google Calendar.» + «Revisar conexión» (:173-175); «Vista compacta:» + «Mostrar todos los días» / «Mostrar rejilla completa» (:218-227); leyenda de husos cuando hay consultorios en zonas distintas. (A12.37-39)
4. [=] Toasts de agenda (horario bloqueado AgendaCliente.tsx:2275, bloqueo quitado, horario actualizado, cancelación por el paciente, paciente no encontrado). (A12.40)
5. [=] Panel lateral de Día (solo ≥ 1024 en Día, `panelDelDia`, AgendaCliente.tsx:1099): «Resumen · Dr. …» con mosaicos «citas», «evento», «h ocupadas», «h libres» (CardResumen.tsx:54-55), desglose por estado, «Elige un médico para ver las horas y los huecos.» (:66), «Sin horario de consulta este día.» (:72); «Huecos disponibles» (CardHuecos.tsx:118-119) con botones de hora «Agendar a las HH:MM» (:62) y «No cabe un turno entero en este hueco.» (:69); mini-mes navegable «Mes anterior/siguiente» (MiniMes.tsx:73-76); «Citas del día seleccionado», «Ver día ›», «Sin citas este día» (PanelDelDia.tsx:43-50). (A12.33-36)
6. [=] Tiempo real de la rejilla (`useTiempoRealAgenda.ts`). En local el WebSocket de Realtime no conecta (contenedor no levantado); no se vio en vivo. (A12.70)

### 1.2 Barra de escritorio (≥ 1024) — `CabeceraEscritorio.tsx`
7. [C] **Partida en dos ítems con la v2** (CabeceraEscritorio.tsx:344-445): `nav` = ‹ › Hoy (barra nativa de FullCalendar) + «Ir a una fecha: …» (fecha con chevron, HerramientasV2.tsx:161-172) + botón ⓘ «Leyenda de estados» (MenuEngraneAgenda.tsx:206) + vistas Mes/Semana/Día (`tablist` «Vista del calendario», :151); `acciones` = filtro de médico + buscar + campana + candado + engrane + «Agendar». Disposiciones (globals.css, bloque tanda M): **dos filas de 1024 a 1359**; **una fila desde 1360**; 1360–1479 se aprieta (5 px de hueco, segmentos a 10 px de relleno); **1360–1439 «Agendar» se queda en «+» de 36 px** (nombre accesible «Agendar», CabeceraEscritorio.tsx:428-431). En Día con panel, siempre dos filas que además envuelven: a 1024 son cuatro filas visuales (`barra-dia@1024.png`). Medido: `nav` y `acciones` en la misma y = 9 a 1400/1600; a 1024/1180 `acciones` baja a y = 63. (A12.1-6, 14)
8. [C] Filtro por médico: ancho = el del nombre ELEGIDO (texto invisible `.ag-filtro-medida`, :376-385, hasta 240 px); «Todos los médicos» / «— el mes se ve por médico» (:287). (A12.6)
9. [=] «Densidad compacta» (`title` «Densidad compacta: 48 px por hora», :269) — con la v2 vive en el engrane. «Compactar» idem. (A12.4-5)
10. [=] «Agendar» (`title` «Nueva cita o evento — el tipo se elige arriba del modal», :427), degradado `--ag-brand-primary → --ag-brand-secondary`, precarga al pasar/enfocar. Abre `AppointmentModal` con la hora actual sin redondear (captura `agendar@esc.png`: 11:19). (A12.14)
11. [=] Candado «Bloquear horario» (BotonBloquearHorario.tsx:27) → `ModalBloqueo`. (A12.15)
12. [=] Buscar «Buscar citas de un paciente» (HerramientasV2.tsx:195; BuscadorCitas.tsx:135, «Resultados» :155, «Ver sus citas» :55). (A12.10)
13. [=] Campana «Por confirmar (N) y avisos (M): N pendientes» (CampanaAgenda.tsx:64-67, 131-141, punto rojo con número). (A12.11)
14. [=] Engrane «Opciones de la agenda» (MenuEngraneAgenda.tsx:89-114): «Configuración de la agenda», Compactar (texto según vista), «Densidad compacta», «Atajos de teclado» (con la tecla), «Leyenda de estados»; en teléfono además «Pop-up de eventos» con interruptor (:190) — en `ext` el menú muestra «Configuración de la agenda», «Pop-up de eventos», «Leyenda de estados». (A12.12)
15. [=] Leyenda de estados (capa, MenuEngraneAgenda.tsx:218-222): Agendada, Confirmada, Cancelada, No asistió, Atendida, Bloqueo, «Se agendó en Google», «Se agendó por enlace», «Sin expediente» (captura `leyenda@ext.png`). (A12.13)
16. [=] Atajos de una tecla (lib/agenda/atajosAgenda.ts:37-45): T hoy · J/N siguiente · K/P anterior · D/S/M vistas · C agendar · / buscar · ? ayuda; diálogo «Atajos de teclado» con casilla «Usar atajos de una tecla» (AyudaAtajos.tsx:57-74). Solo en ancho (en móvil `atajos={null}`, AgendaCliente.tsx:1458). (A12.67-68)

### 1.3 Banda móvil (< 1024) — `BandaMovil.tsx`
17. [=] Fila 1: «Abrir menú» (:114) · título del periodo (truncado con «…» en 393: «16 – 22 de…», «Novie… de 2026») · campana · candado · ‹ «Periodo anterior» · «Hoy» · › «Periodo siguiente» (NavegacionBandaMovil.tsx:27-34). (A12.16-18)
18. [=] Fila 2: vistas Mes / Semana / Día («3 días» en tableta), buscar, filtro de médico (`<select>` nativo, «Dr. A…» truncado en 393; se estira a ~350 px en `iv` y ~610 en `ih`), engrane. (A12.18)
19. [=] Barra fija inferior «+ Agendar» (BarraAgendarMovil.tsx:18-19) con `env(safe-area-inset-bottom)` (globals.css:2426). (A12.19)
20. [=] Deslizar horizontal para cambiar de periodo en las listas del teléfono (`useDeslizarPeriodo.ts`; umbral 64 px o 0,4 px/ms, eje decidido a 10 px, resistencia 0,6/0,2 — lib/agenda/gestoDeslizar.ts:25-78). (A12.20)
21. [=] Lista Día/Semana: cabecera de día «20 de noviembre · hoy / viernes» (CabeceraDiaLista), filas con hora, punto de estado, nombre, en Día además duración, observaciones y píldora de estado; vacío «Sin citas este día» (renderSinEventos.tsx:26). (A12.21)
22. [=] Mes en teléfono: celdas de 52 px (`--ag-mes-celda-movil`), puntos de color y «+N» a 10 px; debajo, la lista del día elegido «Vie 20 de nov · hoy · 9 cit · 1 ev» y «Ver día ›». (A12.26, 30)

### 1.4 Rejilla (Semana/Día/3 días)
23. [=] Clic/arrastre en hueco → alta (v2: `BurbujaAlta` en ancho; en teléfono no hay huecos en las listas, se usa «Agendar»). (A12.22)
24. [=] Arrastrar/estirar citas con confirmación (`ConfirmModal`). (A12.23)
25. [=] Clic en cita → `BurbujaCita`. Número de día enlaza a Día. «+N más». Línea de «ahora» con píldora roja «11:20» (`--ag-now-pill-bg`). (A12.24-27)
26. [=] Tarjeta de lectura al pasar el ratón («Pop-up de eventos», `useTarjetaAlPasar`/`TarjetaLectura.tsx:264`). (A12.28)
27. [=] Tarjetas de cita: glifo de estado (— ○ ● ✓ ✕) + hora + nombre; en Día, teléfono y consultorio; marcas `IconoSinExpediente`, `IconoEnlace`, G de Google (`MarcaOrigenGoogle`, «Agendada en Google», MarcaOrigenGoogle.tsx:23). Eventos con icono y 6 colores (`--ag-evento-*`). (A12.29-30)
28. [C] **Bloqueos: el rayado ahora solo cubre el horario activo** de cada columna (renderEventContent.tsx:215-268, `tramosDelRayado`, AgendaCliente.tsx:1412-1420); pulsar fuera de horario sigue abriendo su edición. Fuera de la rejilla (todo el día, Mes, lista) rayado entero. (A12.31)

### 1.5 Burbuja de cita (v2) — `BurbujaCita.tsx` + `lib/agenda/accionesTarjeta.ts`
Ancho: capa de **360 px** en ≥ 1024 (globals.css, bloque tanda M: nombre 16, hora 15, resto 13, píldora 12, botones 48 de alto y 13 px de letra, ✕ y ⋮ de 32); hoja inferior a todo el ancho por debajo de 1024.
29. [C] Cabecera: píldora de estado con punto (:153-155), **⋮ «Más opciones de la cita» que ahora abre directamente el formulario completo** (`aria-haspopup="dialog"`, :157-158; antes desplegaba un menú), ✕ «Cerrar». Nombre en h2 (tachado si cancelada). Botón «Sin expediente: este paciente aún no tiene expediente» con aviso «Aún no tiene expediente» solo al pasar/enfocar (:103-116). (A12.41)
30. [=] Procedencia: «Llegó de Google Calendar» (:127), «La apartó con tu enlace» / «La apartó con el enlace de reserva» (:133), historial del contacto. (A12.47 parcial)
31. [=] Bloque hora: reloj, «12:00 – 13:00 · 60 min», día largo, hora en el huso del consultorio si difiere; médico con iniciales (:174-198).
32. [N] **«Observaciones: …» en una línea con elipsis** (:202-210; texto entero en `title` y en el DOM).
33. [=] Botón ancho (principal) según estado (accionesTarjeta.ts:158-169): agendada/confirmada «Iniciar consulta»; atendida «Ver la consulta» (contorno); cancelada y no asistió «Darle otra cita»; por ligar / por asignar «Ligar expediente e iniciar» (:66) con ayuda «Primero buscas su expediente o le creas uno.» (:197); ayudas «Esta cita se canceló. Su horario quedó libre.», «El paciente no llegó a esta cita.». (A12.42)
34. [C] Rejilla de botones con icono (:204-217): agendada «Confirmar» (despliega) · «Reagendar» · «Editar»; confirmada «Reagendar» · «Editar» · «No asistió»; cancelada «Reasignar el horario»; evento «Editar» · «Convertir en cita». **«No asistió» ya no se ofrece en la agendada** (estaba en el menú ⋮; queda en el campo Estado del formulario). (A12.44)
35. [=] «Confirmar» despliega: «Enviar por WhatsApp», «Enviar por correo», «Marcar como confirmada» (:270-283). Mensajes de resultado bajo la barra. (A12.43)
36. [=] Pie: «No es una cita» (solo evento de Google por asignar) y «Cancelar cita» / «Eliminar evento» / «Eliminar cita» (cancelada) en rojo (:315-323). (A12.44)
37. [–] **Retirado: panel «Más»** (Observaciones, Tipo de cita, «No asistió», «Recordatorio por WhatsApp», «Recordatorio por correo», «Editar», Consultorio, Teléfono). Sus funciones siguen en el formulario completo: recordatorio «Enviar recordatorio» por WhatsApp/correo (AppointmentModal.tsx:1817-1828; BotonWhatsAppCita.tsx:152, BotonCorreoCita.tsx:85), tipo, consultorio y teléfono del paciente. (A12.45)
38. [=] Teclado: `role="toolbar"` con foco itinerante (flechas, Inicio, Fin); Escape cierra lo desplegado antes que la burbuja. (A12.46)
39. [=] Reserva por ligar: bloque «Por ligar · Reservó por enlace», «Se liga a un paciente al iniciar la consulta.», «Bloquear contacto / Desbloquear contacto» (BloqueReservaPorLigar.tsx:104-131) — en el formulario completo. (A12.47)

### 1.6 Flujo de ligado de paciente — `VentanaLigarCita.tsx` + `PanelLigarCita.tsx`
Se abre desde: botón ancho de la burbuja (por ligar/por asignar), aviso de la campana, fila del dashboard («Ligar e iniciar consulta»), «Iniciar consulta» del formulario sin paciente.
40. [=] Capa centrada `.ag-capa--centro` (360 px, con velo) titulada «Ligar e iniciar consulta» (:268) y ✕.
41. [=] Paso 1 «datos» (:164-195): pares «Evento/Nombre», «Teléfono», «Correo», «Día y hora», «Consultorio»; selector «Consultorio» si es por asignar y hay > 1; botones «Ligar e iniciar consulta» (principal), «¿No es una cita?» (solo por asignar), «Cancelar».
42. [=] Paso 2 «buscar» (PanelLigarCita.tsx:35-80): «Ligar a un paciente», «Reservó {nombre} ({tel · correo}). Elige su expediente o regístralo; después se abre la nota de la consulta.», campo «Buscar paciente existente…» precargado con el nombre, lista (nombre 14 px, teléfono 11 px), «Buscando…», «Sin coincidencias.», «+ Registrar paciente nuevo» (verde `emerald-700`), «Volver», spinner «Ligando», error en rojo 12 px.
43. [=] Alta rápida `QuickPatientModal` precargada (nombre, correo, teléfono); tras crear, liga y abre `/expediente/{id}/nueva-nota?cita=…`; si falla: «… El paciente ya quedó registrado: búscalo por su nombre.» (:224).
44. [=] Estados: «Cargando…», «No se pudo leer la cita. Vuelve a intentarlo.», motivos «Esta cita ya no está vigente.», «Sólo el médico de la cita puede ligarla e iniciar la consulta.», «El consultorio de esta cita no está entre los tuyos.», «Elige el consultorio antes de iniciar la consulta.» + «Ver la cita» (:100-105, 210, 254-262).

### 1.7 «¿No es una cita?»
45. [=] Botón `BotonNoEsCita.tsx` (texto `TEXTO_NO_ES_CITA = '¿No es una cita?'`, :26; `title` «Dejarlo como evento sin paciente: deja de pedir que se ligue», :50; un toque sin confirmación; error en `role=alert` rojo 12 px). Montado en: fila del dashboard, ventana de ligar, formulario completo y avisos de la campana (captura `campana-avisos@ext.png`). En la burbuja la misma acción se rotula **«No es una cita»** sin signos (accionesTarjeta.ts:65).

### 1.8 Campana «Por confirmar y avisos» — `CampanaAgenda.tsx`, `PanelPorConfirmar.tsx`, `avisos/ListaAvisos.tsx`
46. [=] Pestañas «Por confirmar · N» / «Avisos · M» (CampanaAgenda.tsx:225-233), ✕.
47. [=] Por confirmar: leyenda «Estos pacientes están pendientes de confirmar su cita. Envía un recordatorio.» (PanelPorConfirmar.tsx:141), filas con nombre, hora · consultorio, botones icono WhatsApp («Abrir WhatsApp», solo `title`) y correo; «Sin teléfono válido ni correo.» + «Marcar como confirmada» (:179-184); «Canceladas por el paciente (48 h)» (:109); «Reservas por enlace empalmadas con Google» «… · se empalma con un evento de Google» (:127-132); vacío «No hay citas de mañana sin confirmar.». (A12.64-65)
48. [=] Avisos: «Paciente Prueba 26 reservó por enlace», «Evento nuevo de Google por asignar: …», «Cita: Vie 20 de nov · 14:00 · hace 1 min», «¿No es una cita?», «Marcar todos como revisados» (ListaAvisos.tsx:93); vacío «No hay avisos sin revisar.». (A12.66)

### 1.9 Alta rápida (burbuja de alta) — `BurbujaAlta.tsx`
49. [C] Título «Nueva cita · sáb 21, 10:00–11:00»; «Paciente» con lista (`listbox` «Pacientes», :267) y opción «Registrar «texto»» / «Crear paciente nuevo y continuar» (:276-278); «Inicio»/«Fin» (`type=time`, paso 5 min); «Elige el médico…» (:311); «+ Añadir observaciones» → textarea «Opcional»; «Más opciones» (abre el formulario) y «Guardar»/«Guardando…». Acuse «Cita agendada» + nombre · fecha, «Listo», WhatsApp/correo/«Invitar por correo», «Más opciones» (:366-412). Cambio de comportamiento (no visual): escudo contra el doble clic del modal de alta encima de la burbuja (:195-205, `useEscudoTrasRegistro(..., { dentroDeDialogos: true })`). (A12.51)

### 1.10 Formulario completo — `AppointmentModal.tsx` (2 020 líneas)
50. [C] Cabecera con icono, «Nueva cita» / «Editar cita», botón «Expediente», ✕ (:1109). **Conmutador «Qué vas a crear»: Cita | Evento | Bloqueo** — «Bloqueo» es nuevo (M3 punto 5, :1189-1207, `data-alta-bloqueo`): cierra el modal y abre `ModalBloqueo` con la fecha y hora del formulario. Texto bajo el conmutador «Una cita va ligada a un paciente y a su expediente.». (A12.52)
51. [=] Evento: título (placeholder «Cirugía Sr. Pérez, Junta de personal, Bloqueo…», :1232), icono y color. Cita: «Buscar paciente por nombre o apellido...» (:1402), «Crear nuevo paciente y continuar» (:1449), tarjeta de paciente con quitar; aviso «Evento nuevo de Google, por asignar: se liga a un paciente al iniciar la consulta.» (:1382). (A12.53-54)
52. [=] «Todo el día», FECHA DE INICIO / HORA DE INICIO / FECHA DE FIN / HORA DE FIN, DURACIÓN 15 min · 30 min · 45 min · 1 hora · 1:30 h · 2 horas (:258-270), ESTADO (5 círculos de color), MÉDICO, CONSULTORIO («— Selecciona consultorio —», «Sin asignar», «Sin consultorios disponibles»), Tipo de cita, notas «Instrucciones, observaciones...». (A12.55-56)
53. [=] Pie: icono cancelar cita / eliminar (solo icono con `title`), icono «Iniciar consulta» (`title` «Iniciar consulta: primero se liga a un paciente», :1883-1913), «Cancelar», «Guardar»; WhatsApp/correo «Enviar confirmación»/«Enviar recordatorio» (:1817-1828). (A12.57)
54. [=] Avisos de empalme con cita y con bloqueo antes de guardar. (A12.58)
55. [=] `ModalInvitacionCita` tras agendar: «Lo agendado está guardado» (:391), correo «nombre@correo.com», «Enviar invitación»/«Enviando…» (:607), «Guardar en la ficha», «No invitar a nadie» (:547). (A12.59)
56. [=] `PreguntaAsistencia` «¿Asistió el paciente?» con «Sí asistió», «No asistió», «Decidir después», aviso «Más de 48 horas…», `aria-label` «Citas por cerrar» (:79-107). (A12.60)
57. [=] `ModalBloqueo`: Inicio/Desde, Fin/Hasta (incluido), Médico «Elige el médico», «Motivo (opcional)» «Vacaciones, congreso…», Guardar; «Quitar bloqueo» → «Sí, quitar» (:102-209); validaciones «Elige el médico.», «Pon las fechas.», «Pon las horas.», «El fin tiene que ser después del inicio.» (:81-85). (A12.61)
58. [=] `PanelReagendar`: «Consultorio nuevo», «Día nuevo», «Hora nueva», «Revisar cambio» → «Sí, reagendar y avisar» / «Corregir» (:149-195). `ConvertirEnCita`: «Convertir en cita», «Sin tipo», «Registrar paciente nuevo» (:93-148). `ConfirmModal` genérico; `HorarioModal` v1 «Horario de consulta», «Sin consulta». (A12.48-49, 62-63)

### 1.11 Enlaces profundos, permisos, plan
59. [=] `/agenda?cita={uuid}`, `/agenda?cita=nueva&paciente={id}`; invitado ve solo su agenda; plan bloqueado → modal de bloqueo. (A12.69, 71-72)

### 1.12 Google Calendar (lo visible en la agenda)
60. [=] Eventos de Google de solo lectura con G a color; evento de Google «por asignar» = cita por ligar (burbuja con «Llegó de Google Calendar», «Ligar expediente e iniciar», «No es una cita»). Aviso de sincronización fallida «Revisar conexión». Texto del origen en cuatro variantes: «Llegó de Google Calendar» (burbuja), «Agendada en Google» (marca), «Se agendó en Google» (leyenda), y la maqueta del dashboard «Agendada desde Google Calendar» (texto nuevo aprobado). La conexión con Google vive en Mi perfil (fuera de esta auditoría); en local no hay credenciales y no se pudo ver un evento de Google real.

### 1.13 Configuración `/agenda/configuracion` — `ConfiguracionAgenda.tsx` → `PrimeraVez` o `PestanasConfiguracion`
61. [=] Asistente de primera vez (`PrimeraVez.tsx`): «Paso N de 4 · menos de 2 minutos», etapas «Clínica · Horario · Consulta · Avisos» (sin «Clínica» si no administra, :70-71), «Terminar después» arriba a la derecha, «Atrás», «Continuar», «Terminar».
  - Paso Clínica «Horario de la clínica» (PasoClinica.tsx:20): interruptor por día, «Entras / Sales», «Sin consulta», selector de huso horario.
  - Paso Horario «¿Cuándo das consulta?» (PasoHorario.tsx:64-65) con «Igual que la clínica» u horario propio.
  - Paso Duración «¿Cuánto dura tu consulta?» 15/20/30/45/60 min/«Otra» y «En un día de 8:00 a 18:00 te caben 20 consultas de 30 minutos.» (PasoDuracion.tsx:37-61).
  - Paso Avisos «¿Mandamos avisos por correo?» (PrimeraVez.tsx:224-225).
  - [C] El aviso para quien no administra ahora va en caja propia (`AVISO_SOLO_ADMIN`) bajo el horario de la clínica (PasoHorario.tsx, tanda M punto 15). (A13.2)
62. [=] Cierre «Tu agenda ya está lista» (CierrePrimeraVez.tsx:103-113): «Tu enlace para pacientes» con copiar (o «Preparando tu enlace…», o el error «Esta opción todavía no está disponible en este servidor»), «Es el mismo para todos…», resumen con «Cambiar» por fila, «¿Es para un solo paciente?» (enlace de una vez), «Ir a mi agenda». (A13.3)
63. [C] Vista normal: «‹ Agenda», «Configuración de la agenda», «Esto es lo que elegiste al empezar. Cambia lo que quieras: se guarda solo.» Pestañas «Tu enlace / Enlaces», «Cuándo das consulta / Cuándo dan consulta», «Tu consulta / Tipos de cita», «Avisos», «Más opciones» (PestanasConfiguracion.tsx:64-70). **En el teléfono las pestañas son solo iconos** con el nombre debajo como título (:96-103, :125-128). (A13.4)
64. [=] Tu enlace: «Prendido: tus pacientes pueden apartar con él» / «Apagado: nadie puede apartar con él», dirección en monoespaciada, «Copiar enlace», «Mandar por WhatsApp», «Enlaces de una vez · Crear uno» → «¿Para quién es? (solo lo ves tú)», «Correo del paciente (opcional)», «Crear enlace de una vez», lista con «Copiar»/«Apagar»; «¿Tu enlace llegó a quien no debía? · Cambiar por uno nuevo»; «Enlaces de los demás médicos (N)»; sin secreto: «La reserva por enlace no está configurada en este servidor: no se pueden crear enlaces.» (PestanaEnlace.tsx:147). (A13.5-9)
65. [=] Cuándo das consulta: tarjeta «Horario de la clínica» (días, «Huso horario: Yucatán — Mérida, Valladolid (UTC-6)», «Lo usan los consultorios que dicen «Igual que la clínica».»), una tarjeta por consultorio con chip «Igual que la clínica»/«Horario propio» y «Cambiar horario» → `DialogoHorario` (680 px); «Agrega más consultorios en tu perfil.». (A13.10-11)
66. [C] Tu consulta / Tipos de cita: duración y tipos (crear, editar, archivar, «Quitados (N)»); **el invitado ve primero los suyos y, tras el aviso, los de los demás** sin poder cambiarlos; la secretaria ve «Cada médico cambia sus tipos de cita.» (PestanaConsulta.tsx, tanda M). (A13.12-13)
67. [C] Avisos: «Recordarle su cita al paciente», «Avisarme cuando alguien aparte cita» / «Avisar a la clínica…», «Hasta cuándo pueden apartar» con «Cambiar/Listo», «Esto cambia para todos los médicos de la clínica.», «No disponible en este servidor.» (BloquesAvisos.tsx:28-146); el aviso de solo-admin pasó al principio. (A13.14-15)
68. [C] Más opciones: «Personas bloqueadas» con «Desbloquear», «Nadie está bloqueado.», «Bloqueado a mano», «se levanta solo el …»; «Empezar de nuevo» → diálogo que exige escribir RESTABLECER (ConfirmacionRestablecer.tsx:20-39). **Quien no administra ahora ve «Empezar de nuevo» sin botón y con el aviso encima** (PestanaMasOpciones.tsx, tanda M). (A13.16-17)
69. [C] Textos de permisos: `SOLO_ADMIN` cambió a «Solo el médico administrador puede cambiar estas opciones.»; nuevos `SOLO_ADMIN_HORARIO` «Cada médico cambia el horario de sus consultorios.» y `SOLO_ADMIN_TIPOS`; caja azul clara en seminegrita `AVISO_SOLO_ADMIN` (estilosConfig.ts). (A13.18)
70. [C] **Escala de «computadora» desde `sm` (640 px)**: títulos de página 18, de panel 16, bloque 14/600, ayuda 13, botones/pestañas 13 px y 40 px de alto, campos 40 de alto con 16 px de letra, rellenos ×5/6 (estilosConfig.ts, cabecera). El teléfono no cambia (48/44 px). (A13 sin número)
71. [=] `ConfiguracionCalendario` (composición con menú lateral): **confirmado que no la monta nadie** (solo se importa su tipo; ver §8). (A13.20 pasa de [I] a verificado)

### 1.14 Reserva pública por enlace `/reservar/[codigo]`
Marco `components/agendaPublica/MarcoPublico.tsx` + `agendaPublica.css` (prefijo `.rp-`, también con tokens `--ag-*`).
72. [=] Cabecera navy «Spinus», avatar con iniciales del médico, nombre y especialidad; pasos «Lugar · Día y hora · Tus datos · Listo» (ReservaCliente.tsx:39-55).
73. [=] Lugar «¿Dónde quieres tu cita?», CONSULTORIO (radio con dirección), «Tipo de cita», «Elegir día y hora» / «Elige el tipo de cita para continuar» (:376-377).
74. [=] Turno «Elige día y hora»: semana con ‹ › («Semana anterior/siguiente»), tira de días con punto, «Buscando horarios…», MAÑANA / TARDE con horas, «Sin horarios», «No hay horarios libres esta semana.» + «Ver la semana siguiente», resumen «Viernes, 20 de noviembre · 14:30», «Volver»/«Continuar» (SelectorTurno.tsx:32-141).
75. [C] Datos: nombre, teléfono, correo (no en enlace de una vez), aviso de privacidad (FormularioDatos.tsx:57), «Enviar código a mi correo» o «Reservar cita»; código «Te enviamos un código de 6 dígitos a … Vence en 10 minutos.» (PasoCodigo.tsx:25). **Nuevo: la nota «ya verificado» va en verde con palomita y `role=status`** (ReservaCliente.tsx `NotaDelPaso`). (No se probó el paso de código: el correo sale por Resend y en local no hay clave real.)
76. [C] Listo «Tu cita quedó agendada», «Te enviamos el comprobante por correo.», Cuándo/Médico/Consultorio/Teléfono, «Para cambiar o cancelar, comunícate con el consultorio.» y **nuevo botón «Salir»** que borra lo guardado y cierra la pestaña o, si el navegador no lo deja, muestra «Ya puedes cerrar esta pestaña» (Comprobante.tsx:20-65).
77. [=] Enlace no disponible: «Este enlace ya no está disponible», «Para agendar, comunícate con el consultorio:», «Llamar al consultorio» (page.tsx:52-56); código inexistente → 404 genérico de Next en inglés («This page could not be found.»).

### 1.15 Correos (no visibles en la app, sí cambiaron)
78. [C] Plantillas HTML reescritas en la tanda M: `lib/correo/plantillaCita.ts` (+463/−), `lib/confirmacion/correosCita.ts`, `lib/reserva/correosReserva.ts`, `correoClinicaReserva.ts`; saludo por nombre en recordatorio y aviso de cambio (migración `cita_nombre_saludo`). Hay maquetas en `e2e/correos-agenda-maquetas.e2e.ts`. Quedan fuera del rediseño de pantalla pero usan otra paleta propia; conviene revisarlas aparte.

---

## 2. Tipografía

Familia: `system-ui, -apple-system, sans-serif` (globals.css:895) en toda la agenda; la reserva pública `var(--sp-font)` (el mismo valor, spinus-tokens.css:384) con `font-variant-numeric: tabular-nums` (agendaPublica.css:77). Monoespaciada solo en la dirección del enlace (`font-mono`, 2 usos). `tabular-nums` en 5 sitios de TSX y 14 reglas CSS de agenda; las horas de la rejilla y de las listas sí son tabulares, los conteos del panel también.

**Tamaños declarados** (conteo de apariciones):
| Origen | Tamaños (px → n.º) |
|---|---|
| CSS de agenda en `globals.css` (615 reglas) | 9→4 · 9.5→1 · 10→2 · 10.5→11 · 11→12 · 11.5→3 · 12→14 · 12.5→9 · 13→28 · 13.5→6 · 14→15 · 14.5→1 · 15→10 · 15.5→3 · 16→4 · 17→1 · 18→2 · 24→1 |
| `agendaPublica.css` | 10.5→1 · 11→2 · 13→5 · 13.5→3 · 14→9 · 15→3 · 16→4 · 18→2 · 20→1 · 24→2 · 28→1 |
| TSX de agenda, config y reserva (131 archivos) | 10→3 · 11→40 · 11.5→1 · 12→42 · 12.5→10 · 13→61 · 13.5→22 · 14→153 · 15→21 · 16→12 · 17→1 · 18→3 · 24→1 |

**Pesos**: CSS 400→1 · 500→12 · 600→36 · 700→45 · 800→3 · 900→1; TSX 400→2 · 500→31 · 600→79 · 700→68 · 800→2. Predominan 600/700: la negrita es el tono por defecto, no el acento (CALMA §4 pide 400 para el texto corriente).

Hay 20 tamaños distintos (con medios píxeles: 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5) frente a la escala del kit (26/32 · 20 · 17 · 15 · 13 · 12 · mínimo 11).

**Textos < 12 px — en el código**
- CSS (33 reglas): cabecera de columnas `.fc-col-header-cell-cushion` 11 (:2572), `.ag-dayhead-dow` 11 (:2632), horas del eje 11.5 (:3535) y 10 (:4668), `.ag-tarjeta-hora` 10.5 (:4002), `.ag-tarjeta-glifo` 11 (:4026), **`.ag-tarjeta-chip` 9** (:4034), **`.ag-tarjeta-marca` 9** (:4082), `.ag-tarjeta-tz` 9.5 (:4096), `.ag-tarjeta-desc` y `-pildora` 10.5 (:4106, :4122), `.ag-gcal-hora` 10.5 y **`.ag-gcal-badge` 9** (:4337, :4360), `.ag-banda-titulo` 11 (:4540), `.ag-mes` 11 y **`.ag-mes-badge` 9** (:4718, :4793), píldora de ahora 10.5 (:5002), «+N más» 11/10 (:5048, :5363), panel lateral `.ag-panelcard-tit` 10.5, `-nota` 11.5, `.ag-tile-l` 10.5, `.ag-hueco-dur` 10.5 (:5735-5848), `.ag-lectura-pildora` 10.5 (:6184), `.ag-burbuja-iniciales` 11 (:6358), mini-mes `th` 10.5 (:6529), punto de la campana 11 (:6734), rótulo de bloqueo 11 (:7847); reserva `.rp-pasos li` 11, `.rp-etiqueta` 11, `.rp-dia small` 10.5 (agendaPublica.css:124-191).
- TSX (43): `AppointmentModal.tsx` 23 veces `text-[11px]` (todas las etiquetas en MAYÚSCULAS de campo, teléfonos, ayudas) y 2 `text-[10px]` (:1319, :1429); `BloqueReservaPorLigar.tsx:104-131` (5, uno a 10 px); `LeyendaEstados.tsx:44-130` (7); `ModalBloqueo.tsx:102,195`; `PanelLigarCita.tsx:59` (teléfono); `PanelReagendar.tsx:49`; `ModalInvitacionCita.tsx:509`; `HorarioModal.tsx:158`; `FilaDisponibilidad.tsx:64`; `PrimeraVez.tsx:112`.

**Textos < 12 px — medidos en pantalla** (elementos de texto visibles con `font-size` < 12): Semana `esc` 69/123, Mes `esc` 224/291, Día `esc` 45/151, formulario `esc` 65/183; `ih` (3 días) 35/56; teléfono 1–2 por pantalla en listas y 14–26 en Mes y formulario; reserva 5–14 por paso; configuración 0 en teléfono y 3–7 en ancho.

Otras observaciones: rótulos de campo en MAYÚSCULAS a 11 px con tracking en el formulario completo («QUÉ VAS A CREAR», «PACIENTE *», «FECHA DE INICIO»…), contra la regla del kit (13/600 en minúsculas encima del campo). En la banda móvil el título del periodo se trunca con «…» en 393 y 466. `letter-spacing` fijo en 8 reglas de agenda, sin variar con el tamaño.

---

## 3. Color

**Tokens `--ag-*`**: 131 definidos (globals.css:24-600 claro; `html.dark` 6869-7197 oscuro; los 4 de `no_show` llevan guion bajo, :462-463/:7020-7021). 127 se usan. Los de espaciado (`--ag-1`…`--ag-8`), radios (`--ag-r-note` 6, `-btn-sm` 8, `-btn` 10, `-card` 12, `-pill` 999), duraciones y curvas no tienen oscuro (no lo necesitan). Sin oscuro propio por diseño: `--ag-brand-primary/secondary` (heredan `--cp`/`--cs` del usuario) y `--ag-segment-active-*`.

Más usados en TSX: `--ag-muted` 83, `--ag-text` 80, `--ag-ink` 53, `--ag-ink-600` 38, `--ag-border-card` 32, `--ag-muted2` 31, `--ag-input-border` 31, `--ag-brand-secondary` 30, `--ag-surface` 27, `--ag-brand-legible` 26.

**Correspondencia con `S/entrega/kit/base.css`** (valores claro → oscuro):
| `--ag-*` (claro / oscuro) | Kit | Nota |
|---|---|---|
| `bg-app` #eef1f5 / #0c1420 | `--fondo` #F2F4F8 / #0C1420 | casi igual; en oscuro idéntico |
| `bg-main` #fbfcfe / #0f1828, `grid-col` #fff / transparent | `--fondo` / `--sup` | la rejilla en oscuro no usa estos: es `.bg-white`→#1E1E1E |
| `surface`, `modal-bg`, `input-bg`, `month-cell` #fff / #1b2a40·#152135·#16233a·#141f33 | `--sup` #FFF / #16223A | cuatro superficies oscuras distintas donde el kit tiene una |
| `surface-sunken` #f7f9fb, `control-bg` #f3f6fa, `chip-bg`/`segment-bg` #eef1f6 | `--sup2` #E6EAF1 / #1F2E4A | el kit es claramente más oscuro; tres valores colapsan en uno |
| `primary-bg-faint` #f5f8fc, `patient-card-bg`/`today-bg`/`modal-icon-bg` #eff4f9, `status-confirmed-bg` #eaf1f9 | `--tonal` #E3EBF8 / #223A66 | |
| `ink` #15243e / #e8eef6 | `--tinta` #14213D / #E8EDF7 | casi idéntico |
| `text` #27364f / #cdd8e6 | `--tinta` | el kit no tiene un intermedio entre tinta y tinta2 |
| `ink-600` #52627a, `muted` #7c8aa0, `muted2` #9aa6b8, `faint` #aab4c4 | `--tinta2` #5B6478, `--tinta3` #8A93A6 | cuatro grises → dos |
| `border-card` #e7ecf3, `input-border` #e2e8f0, `hairline`/`hour-line` #eef1f6, `col-line` #f1f4f8 | `--borde` #DDE3EE, `--linea` #EDF0F5 | el kit quiere tarjetas sin borde y campos sin borde |
| `brand-secondary` `var(--cs,#1e5fa8)`, `brand-legible` | `--accion`/`--enlace` #2F5AA8 | la agenda sigue el color de marca de la clínica (`--cp/--cs`); el kit lo fija |
| `brand-primary` `var(--cp,#1a3a5c)`, `navy` #163250 | `--navy` #1B2B4A | «Agendar» es un degradado primary→secondary, el kit no usa degradados |
| `status-scheduled-*` bg #fef6e7 · text #b45309 · dot #d97706 | `--ag-fondo` #FDF0E1 · `--ag-tinta` #9A4A06 · `--ag-punto` #D97706 | mismo papel; ojo, el kit reutiliza el prefijo `--ag-` con otro significado («aviso»): **colisión de nombres** entre `--ag-fondo/--ag-tinta/--ag-punto` del kit y la familia `--ag-*` de la agenda |
| `status-confirmed-*` #eaf1f9 · #1e5fa8 | `--tonal` / `--tonal-tinta` #1F3F7A | |
| `status-attended-*` #e9f7ef · #0f7a52 · #16a34a, `success-*` | `--ok-fondo` #E3F3EA / `--ok-tinta` #1B6B43 | |
| `status-cancelled-*` #fdf2f2 · #c0392b | `--mal-fondo` #FBE4E1 / `--mal-tinta` #B42318 | |
| `status-no_show-*` #f4f6f8 · #5a6b81 | `--sup2` / `--tinta2` | |
| `aviso-*` #fff7e8 · #92400e | `--ag-fondo`/`--ag-tinta` del kit | |
| `gcal-*` violeta #7c5cdb…, `evento-*` (índigo, magenta, carmín, oliva, bronce, grafito) | — | sin equivalente en el kit; habría que decidir si sobreviven |
| `now-line` #ef4444, `now-pill-bg` #bc1010 | `--mal-tinta` / `--mes` #B42318 | |
| `modal-overlay` rgba(0,0,0,.40), `.ag-capa-velo` rgba(16,32,64,.28) literal | `--velo` rgba(10,18,32,.45) / rgba(0,0,0,.35) | el velo de las capas está en literal y sin variante oscura |
| `shadow-card`, `shadow-pop`, `shadow-elevada` | `--sombra-capa` | el kit prohíbe sombra en tarjetas; la agenda la pone en la tarjeta y en las citas |

**Literales en TSX** (fuera de tokens): hex `#1e5fa8`×7, `#1a4f8c`×4, `#1d1d1f`×4 y `#86868b`×3 (grises «de Apple» en `ConfirmModal.tsx:46-56`, `HorarioModal.tsx:118-198`, `ModalBloqueo.tsx:207-209`, `InterruptorRecordatorio.tsx:77`, `InterruptorCorreoClinica.tsx:70`, `clasesConfig.ts:19`), `#163250`, WhatsApp `#25d366` y los 4 de Google. Paleta Tailwind: `text-white` 21, `bg-white` 14, `border-slate-100` 10, `text-red-500/600` 14 (errores de `PanelLigarCita`, `BotonNoEsCita`, `AppointmentModal`…), `bg-black/40` 4, `emerald-*` 7 («Registrar paciente nuevo» en verde), `blue-*` 5, `slate-*` 8. Lista completa: `S/aud/agv2/literales.txt`. En CSS de agenda: 37 hex literales (`#fff`×13, `#1a3a5c`×4…).

**Qué pasa en oscuro** (capturas `*-oscuro.png`, tema por `localStorage.theme`, no sigue al sistema):
- La tarjeta de la agenda y los modales con `bg-white` (`ConfirmModal`, `ModalBloqueo`) se pintan **#1E1E1E gris neutro** por `ThemeProvider.tsx:178` (`html.dark .bg-white { … !important }`); todo el oscuro de la rejilla está calculado sobre ese gris (globals.css:6918-6928, 6998-7006). Los paneles laterales, la burbuja, la campana y la configuración usan navy `--ag-surface` #1b2a40. El fondo de página de la configuración es casi negro (#141414 aprox.) y la barra lateral es un azul más claro. Resultado: tres familias en la misma pantalla (`burbuja-cita@esc-oscuro.png`, `config-enlace@esc-oscuro.png`).
- Los literales `text-red-600`, `emerald-700`, `border-slate-100`, `#1d1d1f`, `#86868b` no cambian con el tema.
- `--ag-brand-primary/secondary` no tienen oscuro: «Agendar» y los botones primarios quedan iguales que en claro.
- El velo de las capas (`.ag-capa-velo` rgba(16,32,64,.28)) es el mismo en oscuro.

---

## 4. Movimiento y tacto

**Qué anima hoy** (todo con `@keyframes` y duraciones fijas `--ag-dur-micro` 120 ms · `-base` 180 · `-lento` 240; curvas `--ag-ease` `cubic-bezier(.4,0,.2,1)`, `-ease-out` `(0,0,.2,1)`, `-ease-in` `(.4,0,1,1)`, globals.css:216-222):
- Cambio de vista: `ag-vista` 180 ms ease-out (globals.css:3705).
- Cita nueva `ag-entra` / `ag-entra-opacidad`; cita que se va `ag-sale` 120 ms; pulso de cita cambiada por otro `ag-pulso` 240 ms (:3728-3856); `dropGlow 0.6s ease-out` al soltar (:4893).
- Avisos `ag-aviso-entra` 240 / `-sale` 180 (:3882-3886).
- Modales `ag-modal-entra` (opacidad + 6 px) 240 / `-sale` 180, velo idem (:3911-3933).
- Capa anclada `ag-capa-entra` (opacidad + `scale(.97)` desde el punto pulsado, `transform-origin` calculado por `posicionCapa`) 180 / `-sale` 120 (:5956-5982).
- Hoja inferior `ag-hoja-entra` (opacidad + 6 px, nunca desliza 100 %) 180 / `-sale` 120 (:5998-6017). Velo `ag-velo-entra` 180.
- Barra de carga `ag-barra-carga 1.1s linear infinite` (:1793, bucle); reserva: esqueleto `rp-late 1.2s … infinite alternate` (agendaPublica.css:218, bucle) y `rp-entra` por paso.
- Interruptores `transition-transform duration-200`; 27 `transition-colors`, 6 `transition-all` (`ModalInvitacionCita` 5, `CabeceraEscritorio` 1); 1 regla `transition: all 0.15s ease !important`.
- Gesto de deslizar periodo con seguimiento del dedo (resistencia 0,6) y vuelta en `--ag-dur-base` con WAAPI (`useDeslizarPeriodo.ts`), umbral por distancia o velocidad; al pasar, el desplazamiento se pone a 0 al instante y entra el fundido de vista (no hay traspaso de velocidad ni proyección).

**Lo que falta frente al skill**: ningún resorte; ninguna animación interrumpible desde el valor presente (las capas son `@keyframes` con `backwards/forwards`); la hoja no se arrastra (sin asa, sin `pointermove`; solo ✕, Escape o toque fuera); la salida es más rápida que la entrada (bien), pero no por el mismo camino en todas (la hoja sale 6 px, bien; el modal también). `prefers-reduced-motion` reduce todo a .01 ms (globals.css:3743-3776, 1823) en lugar de cambiar a fundido corto; no hay `prefers-reduced-transparency` ni `prefers-contrast`; no hay `backdrop-filter` en los velos de agenda (`ConfirmModal` y `ModalBloqueo` sí usan `backdrop-blur-sm` de Tailwind, inconsistentes).

**Respuesta al pulsar**: 0 reglas `:active` en el CSS de agenda y 0 `active:` en sus TSX; solo `:hover` (`--ag-btn-ghost-hover`, `hover:brightness-95`, `@media (hover:hover)` en 1 bloque). En el teléfono no hay ninguna señal al tocar salvo la nativa. La reserva pública sí: `transform: scale(.98)` en botones, horas y días (agendaPublica.css:255).

**Información solo en `title`** (invisible al tocar): 36 `title=` en TSX de agenda, 25 sin `aria-label` al lado; p. ej. el botón icono «Iniciar consulta: primero se liga a un paciente» del pie del formulario, los iconos de cancelar/eliminar del pie, «Abrir WhatsApp» en la campana, «Densidad compacta: 48 px por hora», el texto completo de las observaciones de la burbuja y el aviso «Aún no tiene expediente» (solo hover/foco).

**Áreas de toque < 44** (medidas en las capturas, controles visibles; en ancho la regla del kit es 36):
- Teléfono (`tel`/`ext`/`iv`) en listas: 0 de 13 — la banda y la barra cumplen. En Mes: **127 de 150** (celdas del mes y «+N»). Burbuja: 0–1 (la ✕ y el ⋮ de la hoja). Ventana de ligar: 3–5 («Volver», «Registrar paciente nuevo», ✕ de 36). Campana: 3–5. Engrane: 3. Formulario completo: 0. Reserva: 2 («Volver», radios) y 7 en `tel` turno (los días de la tira).
- `ih` (951, táctil): 10 de 26 en la rejilla; Mes 127/148; formulario 29/45.
- `esc` 1280: < 36 → 19 de 62 en Semana (citas, cabeceras de día, «Hoy»…), 174/199 en Mes, 61/106 con el mini-mes abierto (días de 32 px).
- Configuración: teléfono 1–4 por pestaña; **`iv` e `ih` 100 %** (10/10, 11/11, 16/16…) porque desde 640 px usa la escala de 40 px de computadora.

---

## 5. Layout por dispositivo

| | 393 `tel` | 466 `ext` (franja dcha.) | 669×951 `iv` | 951×669 `ih` (franja dcha.) | 1280 `esc` |
|---|---|---|---|---|---|
| Navegación | banda navy propia con hamburguesa (`.ag-banda-movil`, `env(top)` ✓, globals.css:2106) | igual | igual | igual (tableta: «3 días») | barra lateral 256 px + barra de la tarjeta |
| Vista Semana | lista `listWeek` | lista | lista estirada a 669 | rejilla de 3 días | rejilla 7 días |
| Título del periodo | truncado «16 – 22 de…» | en 2 líneas | entero | «20 – 22 nov» | «16 – 22 nov 2026» con chevron |
| Filtro de médico | «Dr. A…» (cortado) | «Dr. Admin Sen…» | `<select>` de ~350 px | `<select>` de ~610 px que llega a la franja | 140–240 px |
| «Agendar» | barra fija inferior con `env(bottom)` ✓ | barra fija que entra 68 px bajo la franja | barra fija | barra fija de 935 px bajo la franja | botón en la barra |
| Burbuja | hoja inferior | hoja a todo el ancho: ✕, ⋮, «No asistió», «Cancelar cita» bajo la franja | hoja de 669 | hoja de 941: ✕, ⋮ bajo la franja | capa de 360 anclada a la cita |
| Menús (engrane, campana, leyenda, ir a fecha) | capa anclada | capa anclada que entra en la franja (✕ de la leyenda y de la campana debajo) | anclada | anclada, ✕ bajo la franja | anclada, sin velo |
| Formulario completo | pantalla completa con `env(top)` ✓ | pantalla completa: «Expediente», ✕, la 5.ª celda de Estado y «Guardar» bajo la franja | pantalla completa | modal de 560 centrado en la VENTANA (x 196–756), no en el área útil; su pie roza el indicador inferior | modal de 560 px centrado |
| Ligar | capa centrada 360 | centrada en la ventana: la ✕ y el borde del selector entran en la franja | centrada | centrada en la ventana | centrada |
| Configuración | escala teléfono; pestañas solo icono; botón de menú flotante encima del encabezado del paso | contenido y «Continuar» bajo la franja | **escala de computadora (40 px, 13 px) siendo táctil** | idem + franja | columna de 860 px centrada |
| Reserva pública | columna; `env(top/bottom)` en cabecera y pie (agendaPublica.css:84, 259, 303) | 7.º día y «Continuar» bajo la franja | centrada | parte bajo la franja | columna de 560 centrada |

Detalles:
- **`env(safe-area-inset-*)` en la agenda**: solo `top` (banda móvil, cabecera de la reserva) y `bottom` (barra «Agendar», hoja, pie de la reserva). `right/left`: ninguno en todo `src` (`(app)/layout.tsx:217-220` lo deja fuera porque el manifiesto fija vertical). Controles en la franja por captura (`nFranja` en métricas): `ext` 5 en listas, 8–13 con capas abiertas, 14–15 en el formulario, **20 en Mes**; `ih` 6–13. Elementos `position:fixed/sticky` que entran en la franja: la banda y la barra «Agendar» (6 en `ext`).
- **Bisagra (`ih`, x 455–496)**: la barra «Agendar» fija y la hoja la cruzan; con CALMA §18 eso ya no es requisito para capas, pero la barra fija sí lo es para la navegación.
- **Desbordes horizontales**: ninguno de página (`pageOverflowX=false` en todas). Sí hay recortes por elipsis: nombres en las tarjetas de la Semana a 1280 («Paciente Prue…»), título de la banda, filtro, fecha del Día con panel a 1024.
- **Barra a distintos anchos** (`barra-semana@*.png`, `barra-dia@*.png`): 1024 y 1180 dos filas; 1400 una fila con «Agendar» = «+» de 36 px; 1600 una fila con texto; Día con panel a 1024: cuatro filas y fecha cortada.
- **Menú lateral en `ext`** (cromo global, `menu-lateral@ext.png`): el cajón muestra solo «Dashboard» y «Pacientes»; el resto de la navegación queda en un área desplazable de ~50 px entre la tarjeta del consultorio y el aviso amarillo de «3 datos pendientes».
- **Configuración en teléfono**: el botón de menú flotante (cromo global) se superpone a «Paso N de 4» al desplazar (`config-pv3@ext.png`).

---

## 6. Contra apple-design (los 8 principios)

Prioridad: **P1** bloquea el rediseño o afecta uso clínico · **P2** importante · **P3** pulido.

1. **Propósito** — Una pantalla de agenda debe contestar «¿qué tengo ahora y qué sigue?». Hoy en ancho compiten 12 controles en la barra, el panel de 4 mosaicos, huecos, mini-mes y la rejilla; la acción principal («Agendar») es un degradado que pelea con el chip rojo de la campana. **P2**: decidir la pieza dominante (la rejilla) y bajar de volumen el resto (mosaicos, mini-mes, leyenda ⓘ).
2. **Agencia** — Bien: «Pop-up de eventos» y atajos desconectables, deslizar con alternativa de flechas, confirmación solo en mover/cancelar/eliminar/restablecer. Mal: «¿No es una cita?» cambia el dato en un toque sin deshacer (decisión de producto, pero el skill pide deshacer fácil) **P2**; la hoja no se puede arrastrar para cerrarla **P2**; el ⋮ de la burbuja ahora abre un formulario entero en vez de un menú (el icono promete un menú) **P3**.
3. **Responsabilidad** — La reserva pública no abre en producción mientras el aviso tenga «PENDIENTE DE REVISIÓN LEGAL» (avisoReserva.ts:34, 88-94), correcto. Datos de contacto (teléfono) visibles en la tarjeta de Día y en el aviso de ligado; ok dentro de la clínica. El 404 de un enlace inválido sale en inglés **P3**.
4. **Familiaridad** — Inconsistencias que rompen la predicción: el mismo gesto se llama «Ligar expediente e iniciar» (burbuja), «Ligar e iniciar consulta» (ventana, dashboard) y, aprobado para el rediseño, «Ligar paciente e iniciar consulta»; «No es una cita» vs «¿No es una cita?»; el origen tiene 4 textos («Llegó de Google Calendar», «Agendada en Google», «Se agendó en Google», «Agendada desde Google Calendar»); la reserva 3 («La apartó con tu enlace», «Reservó por enlace», «Por enlace», «Se agendó por enlace»). **P1** para el rediseño (hay que fijar un texto por concepto). La ✕ cambia de sitio y tamaño entre capas (36, 32, 20).
5. **Flexibilidad** — **P1**: franja derecha sin respetar en `ext` e `ih`; escala de computadora aplicada a tabletas táctiles en la configuración; el Duo abierto vertical (669) recibe el teléfono estirado y el horizontal (951) una rejilla de 3 días con la hoja del teléfono a 941 px. **P2**: la barra de escritorio se apila en 4 filas en Día a 1024. Bien: tres formatos de vista según ancho y gesto de deslizar.
6. **Simplicidad** — Burbuja: bien reducida en la tanda M (principal + 3 + pie). Formulario completo: 11 grupos visibles, rótulos en mayúsculas de 11 px, seis duraciones en píldoras, cinco círculos de estado sin texto **P2**. Panel de Día con cuatro tarjetas a la vez **P3**.
7. **Oficio (craft)** — **P1**: texto de 9–11 px en la rejilla y en el formulario; tres familias de color en oscuro; 20 tamaños tipográficos con medios píxeles; sin respuesta al toque. **P2**: curvas Material y `@keyframes` no interrumpibles; `transition-all` en 6 sitios; velos sin desenfoque y distintos entre capas (`ag-capa-velo` literal, `bg-black/40 backdrop-blur-sm`, `--ag-modal-overlay`). **P3**: bucles infinitos de carga (`ag-barra-carga`, `rp-late`) sin alternativa en movimiento reducido en el esqueleto público.
8. **Deleite** — Lo hay donde la tanda M trabajó (burbuja de 360 con jerarquía clara, acuse «Cita agendada» con acciones de envío, comprobante con «Salir»). Se pierde en el oscuro mezclado y en la letra diminuta de la rejilla, que dan sensación de herramienta antigua junto al resto ya rediseñado. **P2**.

Tácticas del skill: *feedback* de 4 tipos — estado (barra de carga, «Guardando…»), finalización (acuse, toasts abajo a la derecha, CALMA los quiere arriba), aviso (empalmes, bloqueo), error (inline y `role=alert`) — presentes; *wayfinding* — en la configuración en teléfono las pestañas son iconos sin texto **P2**; *mapping* — el candado «Bloquear horario» no se distingue de un candado de privacidad sin rótulo **P3**.

---

## 7. Impacto en el dashboard (maqueta `S/entrega/dashboard-final/vista-dashboard.html`, CALMA §24)

- **Sin cambios desde 63938e2** en `app/(app)/dashboard/*`, `components/dashboard/*` (incluido `ProximasCitas.tsx`), `components/agenda/{BotonNoEsCita,VentanaLigarCita,PanelLigarCita,MarcasCita}.tsx`, `lib/agenda/{tarjetasAgenda,ligarCita}.ts`. Las referencias de línea que cita la maqueta (`page.tsx:270-301`, `ProximasCitas.tsx:247-262`, `BotonNoEsCita.tsx:25,37-58`) siguen valiendo.
- Dependencias del dashboard que sí cambiaron: `hooks/useEscudoTrasRegistro.ts` (solo comentario; el valor por omisión `dentroDeDialogos=false` que usa el dashboard no cambia) y `globals.css` (bloques de la burbuja y de la barra, que el dashboard no usa). **Nada nuevo contradice la maqueta.**
- La maqueta coincide con el código en lo esencial: la hoja de la cita no ofrece cambios de estado («El dashboard de hoy NO cambia estados»), principal «Iniciar consulta» / «Ligar … e iniciar consulta» / «Ver en la agenda», «¿No es una cita?» solo en Google por asignar.
- Discrepancias **anteriores** que conviene registrar (no las introdujo la tanda M):
  1. La maqueta da «Reservó por enlace» como «texto de hoy»; en la fila del dashboard el texto real es **«Por enlace»** (`ProximasCitas.tsx:59`, `TEXTO_ENLACE`); «Reservó por enlace» es el de la tarjeta de la agenda (`BloqueReservaPorLigar.tsx:108,114`).
  2. «Pendiente administrativo» de la semilla es un **evento propio de Spinus** (`origen='spinus'`, sin paciente, sin reserva): `esEventoGenerico` lo excluye de «Próximas citas» (`ProximasCitas.tsx:72,96`), así que nunca aparece ahí ni como «Sin expediente». La maqueta lo pinta como «Agendada desde Google Calendar · Sin expediente» siguiendo §24.7; en datos reales solo los eventos de Google por asignar entran.
  3. La maqueta dibuja «¿No es una cita?» en la hoja (5 marcos) aunque §24.7 lo reservaba para la tanda de agenda; el comportamiento coincide con el código, así que no es un error funcional, pero es una decisión que el dueño debe ver.
  4. Textos de origen: el código de agenda dice «Llegó de Google Calendar» / «Agendada en Google» / «Se agendó en Google»; la maqueta usa el aprobado «Agendada desde Google Calendar». Al implementar habrá que decidir si el texto nuevo sustituye también los de la agenda.
  5. Ligado: dashboard y ventana «Ligar e iniciar consulta», burbuja «Ligar expediente e iniciar», maqueta (aprobado) «Ligar paciente e iniciar consulta».
- Captura de referencia del dashboard real con una reserva por ligar: `S/cap-agenda/dashboard-proximas@{tel,ext,ih,esc}.png` (fila «Paciente Prueba 26 · Por enlace · Ligar e iniciar consulta»).

---

## 8. Problemas de funcionalidad o backend vistos de paso (deuda técnica, sin tocar)

1. **Composición de configuración muerta**: `ConfiguracionCalendario.tsx` y lo que solo él monta (`MenuConfiguracion`, `SeccionDisponibilidad`, `FilaDisponibilidad`, `SeccionAjustesReserva`, `SeccionContactosBloqueados`, `SeccionTiposCita`, `ZonaRestablecer`, `TarjetaSeccion`; ≈1 400 líneas) no se renderizan: solo se importa el tipo `ActualizarConfig` (FilaDisponibilidad.tsx:20, SeccionDisponibilidad.tsx:17). `SeccionEnlacesReserva` sigue viva parcialmente vía `EnlacesDeOtros` → `PestanaEnlace`. Riesgo: que el rediseño las tome por pantallas vivas.
2. **Reserva por enlace bloqueada en producción** mientras `AVISO_PLANTILLA` lleve `MARCA_PENDIENTE` (avisoReserva.ts:34, 88-94): todos los enlaces devuelven 404. Además exige `RESERVA_SECRETO` de 64 hex y una fila aprobada en `reserva_avisos` con el sha del texto. Es intencional, pero la configuración ofrece crear enlaces que no abrirán.
3. **`S/app/.env.local`**: `RESERVA_SECRETO` ficticio de 44 caracteres no válido para el formato que exige `secretos.ts:39-40` (64 hex) — la configuración local muestra «no está configurada en este servidor».
4. **Texto incorrecto en el ligado de un evento de Google**: `PanelLigarCita.tsx:41-44` dice «Reservó {título}» también para un evento de Google por asignar («Reservó Revisión de estudios»).
5. **Hora de «Agendar» sin redondear**: el alta desde el botón usa la hora actual exacta (11:19 → 12:19).
6. **404 de Next en inglés** para un código de reserva inválido.
7. **Oscuro dependiente de `.bg-white !important`** (ThemeProvider.tsx:178): cualquier cambio de superficie de la rejilla rompe los contrastes calculados en globals.css:6918-7006.
8. **Colisión de nombres de tokens**: el kit define `--ag-fondo/--ag-tinta/--ag-punto` (aviso) y la agenda usa el prefijo `--ag-*` para 131 tokens propios; al integrar el kit en la app hay que renombrar uno de los dos.
9. **Realtime local**: el WebSocket de Realtime falla en local (el contenedor no está entre los que levanta `supabase start` en este entorno); no se pudo probar la actualización en vivo.
10. Las 2 migraciones nuevas (`audit_log_sin_truncate`, `agenda_m_saludo_recordatorio`) constan como «PENDIENTE DE APLICAR» en producción en su cabecera; aplicadas solo en local.
11. 409 en la consola durante mis capturas de la configuración: los provocó mi guion al avanzar el asistente en cinco ventanas a la vez; no es un fallo de la app.

---

## Qué no se pudo verificar

- Paso de código por correo de la reserva con enlace fijo (Resend con clave ficticia) y el correo de comprobante.
- Eventos reales de Google Calendar y la conexión con Google (sin credenciales); solo se simuló un evento «por asignar» insertado en local.
- Tiempo real (Realtime no levantado).
- Vistas de médico invitado y de secretaria (todas las capturas son de `admin.a`).
- Arrastrar/estirar citas, `PreguntaAsistencia`, `ModalInvitacionCita`, `PanelReagendar`, `ConvertirEnCita` y `DialogoHorario`: inventariados por código, sin captura.
- El cierre del asistente de primera vez solo se capturó en `tel` (los demás marcos ya lo encontraron terminado).
- Las capturas de `ext/ih` emulan la franja con el override de CDP; el comportamiento real del Duo puede diferir.
