# Fichas «Especificación» y escritura de las dos vistas (lo ejecuta tmp-gen.py)
FICHA_1 = '''<h3>Especificación · Vista Mes</h3>
<p><b>Una pieza por tamaño.</b> En Duo abierto (h y v) y computadora, la <b>rejilla del mes</b>: seis semanas que se reparten el alto de la tarjeta (no se desplaza), siete columnas, número del día arriba a la izquierda y debajo hasta <b>K líneas</b>. En Duo cerrado e iPhone, el <b>Mes de teléfono de hoy</b> redibujado: mini-rejilla con puntos y debajo «Citas del día seleccionado» (PanelDelDia.tsx).</p>
<h4>Regla de cuántos caben</h4>
<table><thead><tr><th></th><th>Duo abierto h</th><th>Duo abierto v</th><th>Computadora</th><th>Duo cerrado · iPhone</th></tr></thead><tbody>
<tr><th>Columna</th><td>≈ 86 px</td><td>≈ 88 px</td><td>≈ 140 px</td><td>≈ 45 · 51 px</td></tr>
<tr><th>Líneas por día (K)</th><td>2 de 22 px</td><td>2 de 34 px</td><td>3 de 22 px (4 no cabe: pediría 126 px por semana y hay 104)</td><td>3 puntos</td></tr>
<tr><th>Qué dice una línea</th><td>icono de estado + hora</td><td>icono + hora / nombre corto (2 renglones)</td><td>icono + hora + nombre corto + marcas</td><td>punto del color del estado</td></tr>
<tr><th>Si hay más de K</th><td colspan="3">se ven K − 1 y la última línea dice «+N más» (N = lo que no se ve). Nunca se pierde una línea entera en «+1 más»: con K exactos se ven todos.</td><td>3 puntos y «+N» (texto de hoy, 12 px)</td></tr>
</tbody></table>
<p>Orden dentro del día: primero «todo el día» (eventos y bloqueos; el de varios días es UN chip que cruza sus días; si el título no cabe se recorta por palabras con «…» al final), luego por hora (citas, eventos con hora y bloqueos con hora). El nombre es el corto de la base («Paciente P.»; con nombres reales, «María G.»); el completo está en la burbuja y en «+N más».</p>
<h4>Celda</h4>
<table><tbody>
<tr><th>Hoy</th><td>celda en --cal-hoy (acción al 5 %) y número blanco en círculo --cal-hoy-num; la cabecera «Jue» en --enlace</td></tr>
<tr><th>Otro mes</th><td>número en --tinta3 sobre --fondo al 55 %; sus citas se ven igual (en teléfono, en blanco: showNonCurrentDates false)</td></tr>
<tr><th>Fin de semana</th><td>cabecera en --tinta3; el domingo (sin horario de consulta) va entero en --cal-fuera, como el día sin consulta de la rejilla</td></tr>
<tr><th>Bloqueo</th><td>chip rayado entero (en Mes no hay horario que recortar) con candado; el de todo el día sin hora. Tocarlo abre su edición</td></tr>
<tr><th>Google</th><td>el chip conserva su estado; la G de 12 px y la carpeta punteada van como marcas; contorno discontinuo = por ligar</td></tr>
<tr><th>Toque</th><td>chip, «+N más» y número: 22 px dibujados, 36 de área (::after 7 px arriba y abajo; en Duo v 34 → 44). Tocar el número lleva al Día (navLinks). Tocar el hueco de un día abre el alta sin hora: la celda se marca con contorno discontinuo y el fantasma «+ Nueva cita · vie 27» en la fila del número y se abre la burbuja de alta sin horas («Nueva cita · vie 27»), la de la página Cita · «Burbuja de alta», anclada a la celda en computadora y centrada en Duo; en domingo (sin consulta) se marca la celda y no se abre</td></tr>
<tr><th>Arrastrar</th><td>la cita se levanta (escala 1,03 + sombra de capa) y sigue al dedo; deja fantasma discontinuo; la celda destino lleva anillo --cal-sel. Al soltar conserva la hora. Sobre un día bloqueado vuelve a su sitio con el aviso «Este horario está bloqueado…»; en domingo pide confirmación con la alerta del catálogo (texto de avisosHorario.hora, botones de ConfirmModal «Cancelar» / «Aceptar»). Llega con un destello del anillo (sustituye a dropGlow).</td></tr>
<tr><th>Estirar (todo el día)</th><td>Existe hoy: <code>editable</code> + <code>eventResizableFromStart</code> (AgendaCliente.tsx:2053, 2060) y <code>handleEventResize</code> (guardadoCitas.ts:495-517). En Mes solo se estiran los eventos de todo el día (la rejilla de mes no estira citas con hora), por cualquiera de los dos extremos: asas de 4×12 en el color del evento (al pasar el ratón en computadora; en táctil tras mantener pulsado). Estirando: el chip cruza los días nuevos con contorno discontinuo y sombra de capa; el día destino lleva anillo --cal-sel. <b>Sin confirmación</b> (no pasa por avisos de horario); si toca un bloqueo vuelve y sale «Este horario está bloqueado. Quita el bloqueo para agendar aquí.» (vetadoPorBloqueo, guardadoCitas.ts:233-241); un evento de Google no se estira (:496).</td></tr>
</tbody></table>
<h4>Teléfono</h4>
<p>Mini-rejilla de 6 filas fijas (no cambia de alto al navegar); celdas de 45 × 44 (Duo cerrado, la tarjeta sangra 10 px como la tira de la Semana) y 51 × 46 (iPhone): número 15/600, hoy en círculo relleno, el día elegido con anillo --cal-sel sobre --fondo. Toda la celda es el botón (punto y «+N» incluidos): elige el día. Puntos de 6: redondo = cita, cuadrado = evento, cuadrado hueco = bloqueo, G = Google. Debajo, la tarjeta «Citas del día seleccionado» (se desplaza) con cabecera pegajosa «Jue 19 de nov · hoy» · «11 cit · 1 ev» · «Ver día ›» y filas de la Semana A (hora, barra del estado, nombre, segunda línea, estado en círculo). Vacío: «Sin citas este día».</p>
<h4>Estados</h4>
<p>Cargando: barra de 2 px --accion arriba y el mes al 55 % (la de la agenda de hoy, ya en el catálogo de carga). Vacío: «Ningún evento de Dr. Admin Semilla en noviembre», sin botón (en Mes no se ofrece «Ver todos los médicos»). «Todos los médicos — el mes se ve por médico»: opción apagada, no escondida, en el filtro (computadora) y en «Opciones de la agenda» › Médico (táctiles). «Ocultar los días de la semana sin actividad»: interruptor del menú; pliega las columnas y sale el aviso «Vista compacta: domingo oculto» + «Mostrar todos los días». Reserva por enlace: una cita más el jueves 19 («+5 más» pasa a «+6 más» en computadora), un punto más en teléfono y la campana de 3 a 4.</p>
<h4>A dónde lleva cada control</h4>
<p>Las capas son las mismas que usan Día y 3 días en esta página (copiadas de su carpeta al generar): burbuja de cita, burbuja de alta, alertas y avisos breves de la página Cita; formulario de cita, evento y bloqueo, «Convertir en cita» y las alertas de mover; la ventana «Ligar paciente e iniciar consulta»; Opciones, Buscar, Campana, Médico, Leyenda y Atajos de Herramientas; y el cajón, «Más» y el selector de consultorio de la navegación.</p>
<table><tbody>
<tr><th>Cita (chip, fila, «+N más»)</th><td>su burbuja; por ligar y Google por asignar, la de ligado («Ligar paciente e iniciar consulta», «¿No es una cita?»). Editar, lápiz y Reagendar → formulario; Confirmar → WhatsApp, correo, «Marcar como confirmada»; Cancelar cita, No asistió, Eliminar → sus alertas.</td></tr>
<tr><th>Evento de todo el día · bloqueo</th><td>su burbuja «todo el día» · «Bloquear horario» en edición.</td></tr>
<tr><th>Hueco de un día</th><td>burbuja de alta sin horas («Nueva cita · vie 27»): Paciente, «+ Añadir observaciones», «Más opciones» → formulario, «Guardar» → «Cita agendada».</td></tr>
<tr><th>Agendar · candado · buscar · campana · médico · opciones</th><td>formulario «Nueva cita» · «Bloquear horario» · sus capas de Herramientas («Todos los médicos — el mes se ve por médico» apagada).</td></tr>
<tr><th>Semana · 3 días · Día · «Ver por semana»</th><td>esa vista en esta misma página (desplazamiento + realce). El número del día y el título de «+N más» abren el Día aquí mismo.</td></tr>
<tr><th>Arrastrar a domingo</th><td>alerta «¿Es correcto?» del formulario: «Vas a moverlo a las 08:00 del domingo, y este consultorio no atiende los domingos.» con «Cancelar» (la cita vuelve) y «Mover».</td></tr>
<tr><th>Salen de la agenda</th><td>«Iniciar consulta», «Ver la consulta», «Configuración de la agenda», «Revisar conexión», «Completar ahora», las secciones de la navegación y «Mi perfil» llevan a otra pantalla (páginas Nota, Expediente, Herramientas y configuración, Cuenta). ‹ › y «Hoy» cambian de mes: aquí solo está noviembre.</td></tr>
</tbody></table>
<p><b>Movimiento.</b> Capas del catálogo con resorte (amortiguación 1, respuesta .35 s) y salida en 200 ms; la cita arrastrada sigue al dedo 1:1 y, si no se puede soltar, vuelve a su sitio con resorte desde donde está; salto al Día con fundido + 10 px. Movimiento reducido: fundidos cortos, sin escala ni desplazamiento; barra de carga fija al 50 %.</p>'''

FICHA_2 = '''<h3>Especificación · «+N más» y salto al Día</h3>
<p><b>Qué abre.</b> «+N más» abre el día entero (FullCalendar abre hoy su globo con los mismos chips): aquí, una capa del catálogo con la fecha como título y <b>todas</b> las citas en filas de la Semana A (hora inicio/fin, barra del estado, nombre completo, segunda línea con duración, origen y sin expediente, estado en círculo), primero lo de todo el día. Cada fila abre la burbuja real de la cita (página Cita · «Burbuja de cita»; las por ligar, la de «Ligar paciente»).</p>
<table><thead><tr><th></th><th>Duo abierto h · v</th><th>Computadora</th><th>Duo cerrado · iPhone</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada en el área de contenido, 380 px, con velo desenfocado</td><td>menú anclado SOBRE la celda (nace de ella, transform-origin arriba a la izquierda), 340 px, sin velo; se mete dentro del área de contenido</td><td>no hay capa: «+N» elige el día y el panel de abajo ya trae la lista entera (como hoy)</td></tr>
<tr><th>Alto</th><td colspan="2">hasta el alto del área menos 32; el cuerpo se desplaza y la cabecera queda</td><td>—</td></tr>
<tr><th>Cerrar</th><td colspan="2">✕, toque fuera, Escape. Devuelve el foco al «+N más»</td><td>—</td></tr>
</tbody></table>
<h4>Salto al Día</h4>
<p>El título de la capa es el enlace al Día (navLink de hoy, «Ir al jueves 19 de noviembre»): 17/700 con chevron › en --enlace. El número de cada celda hace lo mismo. En teléfono, «Ver día ›» del panel. El Día entra con fundido + 10 px hacia arriba y resorte (sin rebote); «Mes» en el segmentado vuelve. En la maqueta el Día está dibujado para la semana del 16 al 22 (la semilla de la base).</p>
<p><b>Teclado.</b> Tab recorre las filas; Enter abre la burbuja; Escape cierra. <b>Reduced motion:</b> fundido. <b>Reduced transparency:</b> velo opaco sin desenfoque.</p>'''

TIRA_1 = [['Cargando', 'clase:am-carga', False], ['Vacío', 'clase:am-vacio', False], ['«Todos los médicos»', 'am:todos'],
          ['Ocultar los días sin actividad', 'clase:am-comp', False], ['con reserva por enlace', 'clase:am-res', False], ['día seleccionado (vie 20)', 'am:sel:25'], '|',
          ['Opciones', 'menu'], ['Ir a una fecha', 'fecha'], ['burbuja de una cita', 'am:bu:v1'], ['hueco pulsado (vie 27)', 'am:hueco'],
          ['arrastrando', 'am:arr'], ['soltar en domingo 29', 'am:d29'], ['soltar sobre el bloqueo del 22', 'am:d22'], ['asas para estirar (todo el día)', 'clase:am-asa-on', False], ['estirando el congreso al jueves 5', 'clase:am-est', False], ['estirar el curso hasta el 22 (bloqueo)', 'am:est22'], ['tarjeta al pasar (computadora)', 'am:pasar'], '|',
          ['aviso de error', 'clase:ag0-ave', False], ['faltan citas', 'clase:am-avf', False], ['aviso de Google', 'clase:ag0-avg', False], ['leyenda de husos', 'clase:am-avh', False], ['Cerrar', 'cerrar']]
TIRA_2 = [['«+N más» del jueves 19', 'am:mas:24'], ['«+N más» del viernes 20', 'am:mas:25'], ['número 19 → Día', 'am:dia:24'], ['volver al Mes', 'am:mes'],
          ['con reserva por enlace', 'clase:am-res', False], ['Cerrar', 'cerrar']]

escribe('1-mes', 'm1', 'Agenda · Mes',
        'El mes con las piezas de la agenda: en ancho, rejilla de seis semanas con chips del mismo color e icono que el bloque, «+N más» cuando no caben y sin texto bajo 12 px; en teléfono, la mini-rejilla con puntos y la lista del día elegido de hoy, redibujadas',
        FICHA_1, TIRA_1)
escribe('2-mas', 'm2', 'Agenda · «+N más»',
        'Lo que no cabe en un día se abre entero en una capa del catálogo (anclada a la celda en computadora, centrada en Duo), con el título como salto al Día; en teléfono el «+N» elige el día y la lista ya está debajo',
        FICHA_2, TIRA_2)
