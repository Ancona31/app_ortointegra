# Vistas de «Agenda · Ligado y Google». Lo ejecuta tmp-al-gen.py con sus funciones ya cargadas.
CIT['j8']['hist'] = 'Al reservar traía 1 cancelación o inasistencia.'
SCROLL = 14.5

def plantillas_dia(extra_ids=()):
    """Burbujas de esta pieza (j8, j13, j9 y el evento ev13) con su contenido exacto. Los demás bloques abren la burbuja de la página «Cita» (MAPA)."""
    ev = dict(CIT['j13'], id='ev13', tipo='evn', evi='evento', sx=False)
    return burbuja('j8', CIT['j8']) + burbuja('j13', CIT['j13'], noes_ir=True) + burbuja('j9', CIT['j9']) + burbuja('ev13', ev)

MAPA = {'j1': 'atendida', 'j3': 'atendida', 'j4': 'atendida', 'j5': 'atendida', 'j2': 'no asistió', 'j6': 'cancelada', 'j7': 'evento',
        'j10': 'en curso', 'j11': 'confirmada · por enlace', 'j12': 'confirmada · por enlace'}
MAPA = {k: ['burbuja-burbuja', e] for k, e in MAPA.items()}
MAPA['bq1'] = ['form-evento-bloqueo', 'Bloqueo de horario (editar)']
for c in CITAS:
    if c['id'] not in MAPA and c['id'] not in ('j8', 'j13', 'j9'):
        MAPA[c['id']] = ['burbuja-burbuja', {'aten': 'atendida', 'canc': 'cancelada', 'noas': 'no asistió', 'conf': 'confirmada · por enlace'}.get(c['e'], 'evento' if c['tipo'] in ('ev', 'evn') else 'agendada')]
EXTRA = dict(mapa=MAPA)

AVISO_G = (f'<div class="ag0-aviso ag0-av-g" role="status">{gcal(16)}<p><b>No se pudo sincronizar con Google Calendar.</b> '
           f'Tus citas se muestran normal; faltan los eventos del calendario.</p><a href="#" class="ag0-p al-avl" data-al="dest-perfil">Revisar conexión</a></div>')

TEXTOS = '''<h4>Textos unificados (CALMA §28) que esta vista aplica</h4>
<table><thead><tr><th>Variante de hoy</th><th>Dónde (S/app/src/…)</th><th>Pasa a</th></tr></thead><tbody>
<tr><td>«Ligar expediente e iniciar»</td><td>lib/agenda/accionesTarjeta.ts:66 (burbuja)</td><td rowspan="3"><b>Ligar paciente e iniciar consulta</b></td></tr>
<tr><td>«Ligar e iniciar consulta» (título y botón)</td><td>components/agenda/VentanaLigarCita.tsx:191 y :268</td></tr>
<tr><td>«Ligar e iniciar consulta» (fila del dashboard, aria y texto)</td><td>app/(app)/dashboard/page.tsx:279, :285</td></tr>
<tr><td>«No es una cita» (sin signos)</td><td>lib/agenda/accionesTarjeta.ts:65 (burbuja)</td><td><b>¿No es una cita?</b></td></tr>
<tr><td>«Llegó de Google Calendar»</td><td>components/agenda/BurbujaCita.tsx:127</td><td rowspan="3"><b>Agendada desde Google Calendar</b> (corto «Desde Google Calendar»)</td></tr>
<tr><td>«Agendada en Google» (nombre accesible de la G)</td><td>components/agenda/MarcaOrigenGoogle.tsx:23</td></tr>
<tr><td>«Se agendó en Google» (leyenda; la dibuja quien tenga la leyenda)</td><td>components/agenda/LeyendaEstados.tsx:89</td></tr>
<tr><td>«La apartó con tu enlace» / «La apartó con el enlace de reserva»</td><td>components/agenda/BurbujaCita.tsx:133</td><td rowspan="3"><b>Reservó por enlace</b> (corto «Por enlace» en filas estrechas)</td></tr>
<tr><td>«Agendada por enlace» (nombre accesible del eslabón)</td><td>components/agenda/MarcasCita.tsx:24</td></tr>
<tr><td>«Se agendó por enlace» (leyenda)</td><td>components/agenda/LeyendaEstados.tsx:91</td></tr>
</tbody></table>'''

MOV = '''<h4>Movimiento, foco y accesibilidad</h4>
<ul><li><b>Capas</b>: las del catálogo (CALMA §25–§27). Tarjeta centrada en el área de contenido en Duo cerrado (310), Duo abierto y computadora; hoja inferior con asa en iPhone. Velo <code>--velo</code> + <code>blur(10px) saturate(140%)</code>; un solo velo. Entrada: fundido + escala .96→1 con resorte (amortiguación 1, respuesta .35 s, escrito con <code>linear()</code>); la hoja de iPhone sube desde el borde; salida más corta (200 ms). Se cierran con ✕, Escape o tocando el velo; el foco vuelve al bloque o botón que la abrió.</li>
<li><b>Respuesta al toque</b>: todo lo pulsable escala a .97 en pointer-down (100 ms). Los bloques de Google de solo lectura NO responden (no son botones).</li>
<li><b><code>prefers-reduced-motion</code></b>: fundido corto sin desplazamiento ni escala. <b><code>prefers-reduced-transparency</code></b>: velo opaco sin desenfoque.</li></ul>'''

# =========================================================== VISTA 1 · POR LIGAR ===========================================================
def vista1(vp):
    cont = pantalla(vp, rejilla(vp, SCROLL, ev13=True), semana(vp))
    capas = capa_burbuja() + plantillas_dia() + burbuja('j13n', CIT['j13'], puede=False) + burbuja('j8n', CIT['j8'], puede=False) + capa_ligar(vp) + capa_duplicado() + destino(vp) + herr(vp, 1) + toast()
    return marco('al1', vp, cont, capas)

FICHA_1 = '''<h3>Especificación · citas por ligar en la agenda</h3>
<p><b>Qué es «por ligar»</b> (tarjetasAgenda.ts:63-86): una cita sin paciente que nació de una <b>reserva por enlace</b> (Paciente Prueba 26, hoy 19:00) o un <b>evento nuevo de Google «por asignar»</b> (Revisión de estudios, 18:20, solapado con Paciente Prueba 12). Las dos se dibujan con la pieza base <code>.ag0-b</code> + <code>ag0-b--lig</code>: color de su estado, <b>contorno discontinuo de 1,5 px</b> (discontinuo = sin expediente) y, en la línea ancha, «Reservó por enlace» o «Agendada desde Google Calendar» + «Sin expediente». En Semana estrecha quedan los iconos (eslabón o G de Google Calendar + carpeta punteada); en Semana de teléfono (lista A) la segunda línea dice «Por enlace» / «Desde Google Calendar» en Duo cerrado.</p>
<table><thead><tr><th>Burbuja</th><th>Contenido (BurbujaCita.tsx + accionesTarjeta.ts:119-240)</th></tr></thead><tbody>
<tr><th>Cabecera</th><td>estado con icono en círculo + texto · ✕. Sin lápiz: la fila «Editar» es el único acceso al formulario completo (decisión del dueño; hoy el ⋮ «Más opciones de la cita»)</td></tr>
<tr><th>Quién</th><td>nombre de quien reservó (<code>reserva_nombre</code>) o título del evento de Google; debajo, origen y «Sin expediente» (hoy un icono con aviso «Aún no tiene expediente» solo al pasar o enfocar: aquí el rótulo se ve siempre). Reserva: «Al reservar traía 1 cancelación o inasistencia.» si el contacto tenía historial.</td></tr>
<tr><th>Cuándo / quién atiende</th><td>«19:00 – 19:30 · 30 min», «Jueves 19 de noviembre», médico con iniciales (solo en clínicas con más de un médico)</td></tr>
<tr><th>Principal</th><td>«Ligar paciente e iniciar consulta» + «Primero buscas su expediente o le creas uno.» — SOLO si quien mira es el médico de la cita y su consultorio está entre los suyos (<code>puedeIniciarConsulta</code>, :281-286). Si no (secretaria, otro médico): no hay principal ni ayuda; la burbuja abre directamente con las filas (variante «sin poder ligar»).</td></tr>
<tr><th>Filas</th><td>«Confirmar» (despliega «Enviar por WhatsApp» y «Enviar por correo» si la cita es futura y hay teléfono/correo, y «Marcar como confirmada»), «Reagendar», «Editar». El evento de Google no trae teléfono ni correo: solo «Marcar como confirmada».</td></tr>
<tr><th>Al final</th><td>«¿No es una cita?» (solo evento de Google por asignar; icono de evento en --enlace; debajo, a la vista, «Dejarlo como evento sin paciente: deja de pedir que se ligue», §29.7) y «Cancelar cita» en rojo.</td></tr></tbody></table>
<p><b>Teléfono y correo</b>: la burbuja de hoy NO los enseña; están en el paso 1 de la ventana de ligar (vista 2) y en el bloque de la reserva del formulario completo (ver «Formulario de cita» en la página Cita). No se añaden a la burbuja.</p>
<p><b>Bloque de la reserva en el formulario</b> (BloqueReservaPorLigar.tsx; la pieza está en «Formulario de cita», página Cita): ocupa el sitio del campo «Paciente»: marcas «Sin expediente» y «Reservó por enlace», nombre, teléfono · correo, historial (instantánea «Al reservar traía…» mientras llega el vivo «Con este médico: 1 cancelación»; sin nada, «Sin historial al reservar» / «Sin cancelaciones ni inasistencias recientes con este médico»), «Bloquear contacto» / «Desbloquear contacto» (acción de texto; solo con agenda v2 y si puede gestionar), la línea roja «Bloqueado para reservar por el enlace hasta el …» o «Bloqueado a mano para reservar por el enlace», errores «No se pudo bloquear el contacto.», «No se pudo desbloquear el contacto.», «No se pudo guardar el cambio.», y «Se liga a un paciente al iniciar la consulta.». En un evento de Google por asignar, en su lugar: «Evento nuevo de Google, por asignar: se liga a un paciente al iniciar la consulta.» + «¿No es una cita?» (AppointmentModal.tsx:1380-1384).</p>
<h4>A dónde lleva cada control del marco</h4>
<p>«Editar» → «Formulario de cita» (reserva, Google por asignar o cita) o «Evento y bloqueo» (evento), en la página Cita. «Reagendar» → «Reagendar y convertir en cita» (reserva por enlace) o el formulario. «Confirmar» → «La burbuja de la cita» (enviado por WhatsApp / por correo) y «Preguntas y confirmaciones» (confirmada). «Cancelar cita», «No asistió», «Eliminar evento» → «Preguntas y confirmaciones». «Convertir en cita» → «Reagendar y convertir en cita». Los demás bloques de la rejilla abren su burbuja en «La burbuja de la cita»; el bloqueo, su edición en «Evento y bloqueo». «Agendar», el «+» del riel y el candado → formulario de cita nueva y «Bloquear horario». Tocar un hueco (Duo abierto y computadora) → «La burbuja de alta». Campana, buscar, «Opciones de la agenda», «Ir a una fecha», leyenda, atajos y médico: la pieza real de Herramientas, copiada en el marco. «Ver la consulta» abre el expediente del paciente y «Revisar conexión», la pestaña Google Calendar de Mi perfil (pantallas de destino resumidas dentro del marco). Sin pieza en esta página (son otras páginas de la app): los enlaces de la navegación y el botón de consultorio, «Configuración de la agenda», ‹ Hoy › y Mes / Semana / 3 días del conmutador (marcan su segmento; las vistas están en la página Calendario), y el enlace «aviso de privacidad» (abre la página pública en otra pestaña).</p>
<p><b>Coherencia con el dashboard aprobado</b> (CALMA §24): mismos textos, mismo principal y «¿No es una cita?» solo en Google por asignar. Diferencias: (1) en el dashboard «¿No es una cita?» es acción de texto bajo el principal; aquí es una fila del menú con icono, porque la burbuja de la agenda ya es una lista de filas (§28). (2) Sin poder ligar, el dashboard pone «Ver en la agenda» como principal; en la agenda ya estás ahí y hoy no hay sustituto: no se añade nada. (3) Icono del principal «Ligar…»: eslabón, igual que el dashboard (CALMA §29.6).</p>''' + TEXTOS + MOV

TIRA_1 = [['Día', 'modo:dia', True], ['Semana', 'modo:semana', False], '|',
          ['burbuja: reserva por enlace (26)', 'al:bu:j8'], ['burbuja: Google por asignar', 'al:bu:j13'],
          ['sin poder ligar: reserva', 'al:bu:j8n'], ['sin poder ligar: Google', 'al:bu:j13n'], '|',
          ['formulario: reserva por enlace', 'al:ir:form-cita:Reserva por enlace sin expediente (21)'], ['formulario: contacto bloqueado', 'al:ir:form-cita:contacto bloqueado'],
          ['formulario: Google por asignar', 'al:ir:form-cita:Google por asignar'], ['campana: avisos', 'al:campana'], '|', ['Cerrar', 'cerrar']]

# =========================================================== VISTA 2 · LIGAR ===========================================================
def vista2(vp):
    cont = pantalla(vp, rejilla(vp, SCROLL, ev13=True))
    capas = capa_burbuja() + plantillas_dia() + burbuja('j8n', CIT['j8'], puede=False) + capa_ligar(vp) + capa_duplicado() + destino(vp) + herr(vp, 2) + toast()
    return marco('al2', vp, cont, capas)

FICHA_2 = '''<h3>Especificación · ligar paciente e iniciar consulta</h3>
<p>Se abre desde el principal de la burbuja (vista 1), desde el aviso de la campana, desde la fila del dashboard y desde «Iniciar consulta» del formulario sin paciente. Es un <b>modal del catálogo</b>: 310 en Duo cerrado, 440 en Duo abierto y computadora, centrado en el área de contenido; hoja inferior en iPhone. El contenido cambia de paso dentro de la MISMA tarjeta (deslizamiento de 14 px + fundido, hacia la izquierda al avanzar y a la derecha con «Volver»); la tarjeta no se cierra entre pasos. Pulsa los botones de verdad: el flujo funciona de punta a punta.</p>
<ol><li><b>Datos</b> (VentanaLigarCita.tsx:168-197): pares rótulo — valor. Reserva: «Nombre», «Teléfono», «Correo», «Día y hora», «Consultorio». Google por asignar: «Evento», «Día y hora» y, si el médico tiene más de un consultorio, el selector «Consultorio» (parte del activo, si no del predeterminado). Pie: «Cancelar» + «Ligar paciente e iniciar consulta»; en Google, además «¿No es una cita?» como acción de texto a la izquierda (apilado bajo el principal en teléfono). Su explicación de hoy, antes solo en <code>title</code>, se ve bajo el botón: «Dejarlo como evento sin paciente: deja de pedir que se ligue» (CALMA §29.7).</li>
<li><b>Buscar</b> (PanelLigarCita.tsx): rótulo «Ligar a un paciente», «Reservó Paciente Prueba 26 (999 000 0026 · correo). Elige su expediente o regístralo; después se abre la nota de la consulta.», campo «Buscar paciente existente…» PRECARGADO con el nombre y enfocado, lista de pacientes (avatar, nombre 15/600, teléfono 13) — tocar una fila liga en ese momento —, «Buscando…» (espera de 300 ms, mínimo 2 letras), «Sin coincidencias.», pie «Volver» + «Registrar paciente nuevo» (tonal: hoy verde esmeralda fuera de la paleta), indicador «Ligando» y errores en línea («No se pudo ligar la cita al paciente. Vuelve a intentarlo.», «Elige el consultorio antes de iniciar la consulta.»). Mientras liga, nada se puede pulsar y la ventana no se cierra.</li>
<li><b>Registrar paciente</b> (QuickPatientModal.tsx, el alta de siempre): «Nombre» (Paciente), «Apellidos» (Prueba 26), «Fecha de nacimiento», «Edad (opcional)» con «Si no conoces la fecha exacta, ingresa solo la edad», «Correo» y «Teléfono celular o WhatsApp» precargados, «El expediente completo se puede editar después desde Pacientes.», casilla «Paciente informado del aviso de privacidad» (a la derecha, §20), «Cancelar» + «Crear y continuar» → «Registrando...» sin cambiar de ancho. Errores de hoy: «Nombre y apellidos son requeridos.», «Debes marcar el consentimiento del aviso de privacidad.», «Error al crear paciente», «Error de conexión. Intenta de nuevo.» (se muestra uno como ejemplo). Duplicado → la alerta «Paciente duplicado» con el texto aprobado y único de la app (cuerpo terminado en «Si es otra persona, se creará el registro de todos modos.») y tres botones apilados: «Es el mismo paciente», «Es otra persona», «Cancelar».</li>
<li><b>Al terminar</b>: liga, pone como activo el consultorio de la cita y abre <code>/expediente/{id}/nueva-nota?cita=…</code> («Nueva nota», regreso «‹ Paciente Prueba 26»). Si el alta salió bien pero el ligado falló: vuelve al paso 2 con «… El paciente ya quedó registrado: búscalo por su nombre.».</li>
<li><b>Estados sin pasos</b> (:253-263): «Cargando…» (indicador donde está la espera) y los motivos «No se pudo leer la cita. Vuelve a intentarlo.», «Esta cita ya no está vigente.», «Esta cita ya no está por ligar.», «Sólo el médico de la cita puede ligarla e iniciar la consulta.», «El consultorio de esta cita no está entre los tuyos.»; con «Ver la cita» solo si se abrió desde la campana.</li></ol>
<p><b>Un solo velo</b>: hoy el alta rápida se monta como un segundo modal encima de la ventana (dos velos, dos ✕). Aquí ocupa la misma tarjeta, con su título «Registrar paciente»; «Cancelar» vuelve al paso 2. Es solo visual: el alta y sus reglas no cambian.</p>
<p><b>Medidas</b>: cabecera 52 (título 17/700 + ✕ 44 / 36 en Duo h y computadora); cuerpo con desplazamiento propio y pie fijo; pares 15/20 con rótulo 13 en --tinta2 sobre líneas --linea; campo 44 (40 en ancho) sobre --sup2 con contorno de enfoque 2 px --enlace; botones 44 (40 en Duo h y computadora, mín. 104), principal a la derecha; en teléfono apilados con el principal arriba porque el rótulo es largo. Teclado: Tab recorre el modal sin salir; Escape cierra (menos mientras liga); el foco entra en el campo de búsqueda al llegar al paso 2.</p><p>A dónde lleva cada control del marco: ver la ficha de «Citas por ligar».</p>''' + TEXTOS + MOV

TIRA_2 = [['1 · datos (reserva)', 'al:p:datos-r:'], ['1 · datos (Google por asignar)', 'al:p:datos-g:'], ['cargando', 'al:p:estado:cargando'], '|',
          ['2 · buscando', 'al:p:buscar:bus'], ['2 · sin coincidencias (precargado)', 'al:p:buscar:sin'], ['2 · resultados', 'al:p:buscar:res'],
          ['2 · ligando', 'al:p:buscar:res+ligando'], ['2 · error al ligar', 'al:p:buscar:res+lig'], ['2 · falta consultorio', 'al:p:buscar:res+econs'],
          ['2 · evento de Google (texto de hoy)', 'al:p:buscar:sin+goo'], '|',
          ['registrar paciente nuevo', 'al:p:registro:'], ['registrando', 'al:p:registro:registrando'], ['registro: faltan datos', 'al:p:registro:ereg'],
          ['paciente duplicado', 'al:capa:dup::'], ['error tras registrar', 'al:p:buscar:sin+tras'], '|',
          ['no se pudo leer la cita', 'al:p:estado:m-leer'], ['ya no está vigente', 'al:p:estado:m-vig'], ['ya no está por ligar', 'al:p:estado:m-pl'],
          ['solo el médico de la cita', 'al:p:estado:m-med'], ['consultorio ajeno', 'al:p:estado:m-cons'], ['motivo + «Ver la cita» (campana)', 'al:p:estado:m-med+ver'], '|',
          ['al terminar: nueva nota', 'al:dest'], ['Cerrar', 'cerrar']]

# =========================================================== VISTA 3 · ¿NO ES UNA CITA? ===========================================================
def vista3(vp):
    cont = pantalla(vp, rejilla(vp, SCROLL, ev13=True))
    capas = capa_burbuja() + plantillas_dia() + burbuja('j8n', CIT['j8'], puede=False) + capa_ligar(vp) + capa_duplicado() + destino(vp) + herr(vp, 3) + toast()
    return marco('al3', vp, cont, capas)

FICHA_3 = '''<h3>Especificación · «¿No es una cita?»</h3>
<p><b>Qué hace</b> (noEsCita.ts, BotonNoEsCita.tsx): un solo toque, <b>sin confirmación</b> (decisión de Angel), deja un evento de Google «por asignar» como <b>evento sin paciente para siempre</b>: deja de pedir que se ligue. Solo existe en eventos de Google por asignar (nunca en reservas por enlace). Puertas: fila del menú de la burbuja, paso 1 de la ventana de ligar, formulario completo, fila del dashboard y aviso de la campana (la fila está en el dashboard aprobado; el aviso, en la campana de esta misma vista: «Maqueta: desde la campana»).</p>
<table><thead><tr><th>Desde</th><th>Al pulsar</th><th>Si falla</th></tr></thead><tbody>
<tr><th>Burbuja</th><td>la burbuja se cierra en el acto (sin salida animada, como hoy) y, con el 200, el bloque se repinta: pierde el contorno discontinuo y «Sin expediente», cambia el icono de estado por el de evento y conserva «Agendada desde Google Calendar». Aquí, fundido cruzado de 320 ms entre los dos dibujos.</td><td>aviso breve del catálogo, arriba en el área de contenido (hoy <code>toast.error</code> abajo a la derecha)</td></tr>
<tr><th>Ventana de ligar</th><td>el botón se desactiva mientras espera (<code>aria-busy</code>); con el 200 la ventana se cierra y el bloque se repinta igual</td><td>en línea, bajo el botón, con <code>role="alert"</code> (catálogo «Error»)</td></tr>
<tr><th>Formulario completo</th><td>el formulario se cierra</td><td>en línea, bajo el botón</td></tr>
<tr><th>Dashboard</th><td>la fila sale de «Próximas citas»</td><td>en línea, bajo el botón</td></tr></tbody></table>
<p><b>Mensajes</b> (noEsCita.ts:22-27, exactos): 403 «No puedes cambiar este evento.», 404 «Ese evento ya no está en la agenda.», 409 «Este evento ya no está por asignar.», cualquier otro fallo o sin red «No se pudo marcar como evento. Vuelve a intentarlo.». El aviso breve dura 8 s (error), se pausa al tocarlo y se descarta arrastrándolo (catálogo capas-b, vista 1).</p>
<p><b>Cómo queda el evento</b>: un evento sin paciente de Google. Su burbuja ya no tiene principal: «Editar», «Convertir en cita» (porque nació en Google, tiene hora, médico y está vigente; accionesTarjeta.ts:114-117) y, en rojo, «Eliminar evento». No hay «deshacer»: hoy la única vuelta es «Convertir en cita».</p><p>A dónde lleva cada control del marco: ver la ficha de «Citas por ligar».</p>''' + TEXTOS + MOV

TIRA_3 = [['burbuja: Google por asignar', 'al:bu:j13'], ['antes (por ligar)', 'al:hecho:0'], ['después (evento)', 'al:hecho:1'], ['burbuja del evento después', 'al:bu:ev13'], '|',
          ['error 403', 'al:toast:No puedes cambiar este evento.'], ['error 404', 'al:toast:Ese evento ya no está en la agenda.'],
          ['error 409', 'al:toast:Este evento ya no está por asignar.'], ['error de red', 'al:toast:No se pudo marcar como evento. Vuelve a intentarlo.'], '|',
          ['desde la ventana de ligar', 'al:p:datos-g:'], ['ventana: enviando', 'al:p:datos-g:noenv'], ['ventana: error', 'al:p:datos-g:noerr'],
          ['desde el formulario', 'al:ir:form-cita:Google por asignar'], ['desde la campana', 'al:campana'], '|', ['Cerrar', 'cerrar']]

# =========================================================== VISTA 4 · GOOGLE ===========================================================
def vista4(vp):
    cont = pantalla(vp, rejilla(vp, SCROLL, gro=True, ev13=True), avisos=AVISO_G)
    capas = capa_burbuja() + plantillas_dia() + burbuja('j8n', CIT['j8'], puede=False) + capa_ligar(vp) + capa_duplicado() + destino(vp) + herr(vp, 4) + toast()
    return marco('al4', vp, cont, capas)

FICHA_4 = '''<h3>Especificación · Google Calendar en la agenda</h3>
<table><thead><tr><th>Qué llega de Google</th><th>Cómo se ve</th><th>Qué hace al tocarlo</th></tr></thead><tbody>
<tr><th>Evento de solo lectura (<code>isGcalBlock</code>: está en el calendario de Spinus en Google y no es fila de la agenda) — «Junta del hospital», 19:30</th>
<td>Pieza nueva sobre la base: <code>.ag0-b.al-gro</code>. Relleno --sup con contorno de 1 px --borde y barra --tinta3: se lee «de fuera, no editable», sin parecer un estado (no usa el gris de «No asistió»). Icono de Google Calendar en lugar del icono de estado, título, y en la línea ancha «hora · Evento» (el rótulo «Evento» de hoy, GoogleEventCard.tsx:48). Sin estado, sin asa, sin arrastre. De todo el día: chip de 24 con el mismo dibujo («Sesión del colegio médico»).</td>
<td><b>Nada</b>: hoy no abre burbuja ni tarjeta al pasar el ratón (altaCitas.ts:346) ni se puede arrastrar (<code>editable:false</code>). Por eso no es botón ni escala al pulsarlo; su nombre accesible termina en «solo lectura».</td></tr>
<tr><th>Evento de Google «por asignar» (fila de la agenda) — «Revisión de estudios», 18:20</th><td>Una cita por ligar: color de su estado, contorno discontinuo, «Agendada desde Google Calendar · Sin expediente».</td><td>Su burbuja (vista 1) con «Ligar paciente e iniciar consulta» y «¿No es una cita?».</td></tr>
<tr><th>Cita que llegó de Google y ya tiene expediente — Paciente Prueba 09, 16:00 (atendida)</th><td>Cita normal con la marca de Google Calendar («Agendada desde Google Calendar» en la línea ancha; icono en Semana).</td><td>Su burbuja normal con «Agendada desde Google Calendar» bajo el nombre.</td></tr></tbody></table>
<p><b>Aviso de sincronización</b> (AvisosAgenda.tsx:166-175): la pieza base <code>.ag0-aviso.ag0-av-g</code> entre la barra y la rejilla, ámbar, con el icono de Google Calendar: «<b>No se pudo sincronizar con Google Calendar.</b> Tus citas se muestran normal; faltan los eventos del calendario.» + «Revisar conexión», que es un ENLACE a Mi perfil (donde se reconecta Google; a propósito sin «Reintentar»). Entra y sale por el mismo camino (fundido + 6 px). En Duo abierto horizontal mide como mucho 431 px (no cruza la bisagra).</p>
<p>La G a cuatro colores de hoy pasa a ser el icono de Google Calendar (el del dashboard aprobado, §24.5) en marca, burbuja, chip y aviso.</p><p>A dónde lleva cada control del marco: ver la ficha de «Citas por ligar».</p>''' + TEXTOS + MOV

TIRA_4 = [['aviso: no se pudo sincronizar', 'clase:ag0-avg', False], '|', ['burbuja: cita que llegó de Google (09)', 'al:bu:j9'], ['burbuja: Google por asignar', 'al:bu:j13'], '|', ['Cerrar', 'cerrar']]

# =========================================================== ESCRITURA ===========================================================
salida(1, '1-por-ligar', 'Agenda · Citas por ligar',
       'La reserva por enlace y el evento de Google por asignar se reconocen en la rejilla por el contorno discontinuo y abren una burbuja del catálogo con «Ligar paciente e iniciar consulta» y «¿No es una cita?» como filas; mismos textos en toda la app',
       [vista1(vp) for vp in VPS], FICHA_1, TIRA_1, **EXTRA)
salida(2, '2-ligar', 'Agenda · Ligar paciente',
       'La ventana de ligar pasa a ser un modal del catálogo: datos, buscar y registrar en la misma tarjeta con un solo velo, pie con el principal a la derecha y errores en línea; al terminar abre la nota',
       [vista2(vp) for vp in VPS], FICHA_2, TIRA_2, **EXTRA)
salida(3, '3-no-es-cita', 'Agenda · ¿No es una cita?',
       'Un toque sin confirmación que deja el evento de Google como evento: el bloque pierde el contorno discontinuo con un fundido y los fallos salen arriba (burbuja) o en línea (ventana)',
       [vista3(vp) for vp in VPS], FICHA_3, TIRA_3, **EXTRA)
salida(4, '4-google', 'Agenda · Google Calendar',
       'Los eventos de Google de solo lectura se ven de fuera y no responden al toque; el origen usa el icono de Google Calendar y un solo texto; el aviso de sincronización es la pieza de aviso de la base',
       [vista4(vp) for vp in VPS], FICHA_4, TIRA_4, **EXTRA)
