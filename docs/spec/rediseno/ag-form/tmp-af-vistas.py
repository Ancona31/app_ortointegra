# Vistas de «Agenda · Formulario» (lo ejecuta tmp-af-gen.py con sus funciones ya cargadas).

# ------------------------------------------------------------------ CSS de estados (clases en el marco que mueve la tira o el guion) ------------------------------------------------------------------
CSS_EST = '''
.af .af-x-err,.af .af-x-guard,.af .af-x-busc,.af .af-x-wa-p,.af .af-x-co-p,.af .af-x-waok,.af .af-x-waerr,.af .af-x-cook,.af .af-x-coerr,.af .af-x-sinev,.af .af-x-del-p,.af .af-x-hist1,.af .af-x-bq1,.af .af-x-bqg1,.af .af-x-bqerr{display:none}
.af.af-k-err .af-x-err,.af.af-k-bqerr .af-x-bqerr{display:flex}
.af.af-k-err .af-guardar{opacity:.45;pointer-events:none}
.af.af-k-guard .af-x-guard{display:block}.af.af-k-guard .af-gtx{display:none}.af.af-k-guard .af-guardar{pointer-events:none}
.af.af-k-unmed .af-x-med{display:none}
.af.af-k-buscando .af-pgc .af-lista{display:flex}.af.af-k-buscando .af-x-busc{display:flex}.af.af-k-buscando .af-x-res,.af.af-k-buscando .af-op-reg{display:none}
.af.af-k-avcur .af-x-wa-t,.af.af-k-avcur .af-x-co-t,.af.af-k-avcur .af-x-wa0{display:none}.af.af-k-avcur .af-x-wa-p,.af.af-k-avcur .af-x-co-p{display:inline}
.af.af-k-avcur .af-wa,.af.af-k-avcur .af-co{color:var(--tinta3);pointer-events:none}
.af.af-k-avok .af-x-waok,.af.af-k-avok .af-x-cook{display:block}.af.af-k-avok .af-x-wa0{display:none}.af.af-k-avok .af-co{color:var(--tinta3);pointer-events:none}
.af.af-k-averr .af-x-waerr,.af.af-k-averr .af-x-coerr{display:block}.af.af-k-averr .af-x-wa0{display:none}
.af.af-k-sinev .af-x-sinev{display:block}.af.af-k-sinev .af-inv{color:var(--tinta3)}.af.af-k-sinev .af-inv svg{color:var(--tinta3)}
.af.af-k-del .af-x-del-t{display:none}.af.af-k-del .af-x-del-p{display:inline}
.af.af-k-hist .af-x-hist0{display:none}.af.af-k-hist .af-x-hist1{display:block}.af.af-k-hist .af-tx .af-x-hist1{display:inline}
.af.af-k-bqq .af-x-bq0{display:none}.af.af-k-bqq .af-x-bq1{display:inline-flex}
.af.af-k-bqg .af-x-bqg0{display:none}.af.af-k-bqg .af-x-bqg1{display:inline}.af.af-k-bqg .af-guardabq{opacity:.7;pointer-events:none}
'''

# ================================================================== VISTA 1 · FORMULARIO DE CITA ==================================================================
def capa_reg(uid):
    cu = (fila('Nombre', inp('Paciente'), req=False) + fila('Apellidos', inp('Prueba 2'))
          + f'<div class="af-f"><span class="af-l">Fecha de nacimiento</span><span class="af-c">{pil("dd/mm/aaaa", "Fecha de nacimiento", True)}</span></div>' + fila('Edad (opcional)', inp('', 'Ej. 35', ' inputmode="numeric"')))
    g1 = gr('', '', cu, pieg('Si no conoces la fecha exacta, ingresa solo la edad'))
    cu2 = fila('Correo', inp('', 'opcional', ' type="email"')) + fila('Teléfono celular o WhatsApp', inp('', 'opcional · 999 123 4567', ' type="tel" inputmode="numeric"'))
    g2 = gr('', '', cu2, pieg('Sin teléfono ni correo no se podrán enviar confirmaciones ni recordatorios de cita.'))
    chk = (f'<label class="af-f af-fi"><span class="af-l">Paciente informado del <a href="#" class="af-enl">aviso de privacidad</a>{ast(True)}</span>'
           f'<span class="af-c"><input type="checkbox" class="af-chk"></span></label>')
    g3 = gr('', '', chk, pieg('El expediente completo se puede editar después desde Expediente.'))
    pie = b('Cancelar', 'af-qui', ' data-cierra="1"') + b('Crear y continuar', 'af-prim', ' data-al="dup"')
    return capa('reg', 'af-w440', [('reg', ('Registrar paciente', f'<div class="af-grs">{g1}{g2}{g3}</div>', pie))], icono='persona', aria='Registrar paciente')

def capa_inv(uid):
    """ModalInvitacionCita: pasos esperando, sin evento, eligiendo, confirmando, enviado (clases af-iv-* en el marco)."""
    esp = (f'<div class="af-ivp af-ivp-esp"><div class="af-cuad af-sup"><div class="af-cuad-f"><span class="af-gira" aria-hidden="true" style="color:var(--enlace)"></span>'
           f'<p style="color:var(--tinta);font-weight:600">Creando el evento en Google…</p></div><p>Ya está guardado en la agenda. Hay que esperar a que exista el evento en Google para poder invitar a alguien; suele tardar un par de segundos.</p></div></div>')
    sin = (f'<div class="af-ivp af-ivp-sin"><div class="af-aviso-q">{ii("aviso", 18, 2.2)}<span style="font-weight:400">El evento en Google no llegó a crearse, así que todavía no hay a qué invitar.'
           f'<b> Lo agendado está guardado</b> y no se ha perdido nada. Vuelve a abrirlo en un rato y usa «Agregar invitados».</span></div></div>')
    eli = (f'<div class="af-ivp af-ivp-eli af-grs"><p class="af-pieg" style="padding:0 4px">Quien invites queda añadido al evento en Google, y Google le manda la invitación por correo. No se ven el correo entre ellos, no pueden modificar nada y rechazar la invitación no cambia nada aquí. El médico asignado ya lo tiene en su calendario.</p>'
           + gr('', '', f'<label class="af-f af-fi af-ivc"><span class="af-pac-t"><span class="af-pac-n">Paciente Prueba 07</span><span class="af-pac-s">paciente07@semilla.spinus.test</span></span><span class="af-c"><input type="checkbox" class="af-chk" checked aria-label="Invitar al paciente"></span></label>'
                 + f'<button type="button" class="af-p af-ac af-ivx-otra-b" data-inv="otra">{ii("plus", 20, 2.2)}<span>Invitar también a otra dirección</span></button>'
                 + f'<label class="af-f af-ivx-otra-f"><span class="af-l">Invitar a otra dirección (sólo para esta invitación)</span><span class="af-c"><input class="af-in af-iv-in" type="email" value="hija.paciente07@semilla.spinus.test" placeholder="nombre@correo.com"></span></label>')
           + '</div>')
    conf = (f'<div class="af-ivp af-ivp-conf"><div class="af-cuad af-sup"><p style="color:var(--tinta);font-weight:600;text-align:left">Vas a invitar a esta dirección escrita a mano</p>'
            f'<p class="af-ivdir">hija.paciente07@semilla.spinus.test</p><p>Compruébala letra por letra. La invitación lleva el nombre completo del paciente en el título, y un correo enviado no se puede recuperar.</p></div></div>')
    ok = (f'<div class="af-ivp af-ivp-ok af-grs"><div class="af-aviso-q af-aviso-ok">{ii("ok", 18, 2.2)}<span class="af-ivok1">El paciente quedó añadido y Google le mandó la invitación por correo.</span>'
          f'<span class="af-ivok2">El paciente y la dirección que escribiste quedaron añadidos y Google les mandó la invitación por correo.</span></div>'
          f'<p class="af-pieg" style="padding:0 4px">Google no confirma la entrega. Si alguien no la ve, pídele que revise su carpeta de <b>spam o correo no deseado</b>; puedes volver a invitarlo entrando de nuevo, no se duplica nada.</p>'
          f'<div class="af-cuad af-sup af-ivfi"><p style="text-align:left">¿Guardas <b style="color:var(--tinta)">hija.paciente07@semilla.spinus.test</b> en la ficha de Paciente para la próxima vez?</p>'
          f'<div class="af-cuad-acc" style="justify-content:flex-start"><button type="button" class="af-p af-b af-ton" data-inv="ficha">Guardar en la ficha</button><button type="button" class="af-p af-tx" data-inv="nogracias">No, gracias</button></div></div>'
          f'<p class="af-pieg af-ivfi-ok" style="padding:0 4px;color:var(--ok-tinta);font-weight:600">Guardado en la ficha del paciente.</p></div>')
    pie = (f'<span class="af-ivb af-ivb-esp">{b("No invitar", "af-qui", " data-cierra=\"1\"")}</span>'
           f'<span class="af-ivb af-ivb-sin">{b("Cerrar", "af-qui", " data-cierra=\"1\"")}</span>'
           f'<span class="af-ivb af-ivb-eli">{b("No invitar", "af-qui", " data-cierra=\"1\"")}{b(ii("enviar", 16, 2.2) + "Invitar", "af-prim", " data-inv=\"enviar\"")}</span>'
           f'<span class="af-ivb af-ivb-conf">{b("Corregir", "af-qui", " data-inv=\"corregir\"")}{b(ii("enviar", 16, 2.2) + "Sí, invitar ahí", "af-prim", " data-inv=\"si\"")}</span>'
           f'<span class="af-ivb af-ivb-ok">{b("Aceptar", "af-prim", " data-cierra=\"1\"")}</span>')
    return capa('inv', 'af-w440', [('inv', ('Invitar por correo', esp + sin + eli + conf + ok, pie))], icono='correo', aria='Invitar por correo')

CSS_V1 = '''
.af .af-enl{color:var(--enlace);font-weight:600}
.af .af-chk{width:22px;height:22px;margin:0;accent-color:var(--accion);flex:none}
.af .af-ivc{min-height:60px}
.af .af-ivdir{font-size:17px!important;line-height:24px!important;font-weight:700;color:var(--tinta)!important;text-align:left!important;overflow-wrap:anywhere;letter-spacing:.2px}
.af .af-ivp,.af .af-ivb{display:none}
.af .af-ivb{gap:10px}
.af[data-vp="ext"] .af-ivb,.af[data-vp="tel"] .af-ivb{flex:1;min-width:0}
.af[data-vp="ext"] .af-ivb>.af-b,.af[data-vp="tel"] .af-ivb>.af-b{flex:1 1 0;min-width:0}
.af:not([class*="af-iv-"]) .af-ivp-eli,.af:not([class*="af-iv-"]) .af-ivb-eli{display:flex}
.af:not([class*="af-iv-"]) .af-ivp-eli{flex-direction:column}
.af.af-iv-esp .af-ivp-esp,.af.af-iv-sin .af-ivp-sin,.af.af-iv-conf .af-ivp-conf{display:block}
.af.af-iv-ok .af-ivp-ok,.af.af-iv-ok2 .af-ivp-ok{display:flex}
.af.af-iv-esp .af-ivb-esp,.af.af-iv-sin .af-ivb-sin,.af.af-iv-conf .af-ivb-conf,.af.af-iv-ok .af-ivb-ok,.af.af-iv-ok2 .af-ivb-ok{display:flex}
.af .af-ivx-otra-f{display:none}.af.af-ivx-otra .af-ivx-otra-f{display:flex}.af.af-ivx-otra .af-ivx-otra-b{display:none}
.af[data-vp="ih"].af-ivx-otra .af-ivx-otra-f,.af[data-vp="iv"].af-ivx-otra .af-ivx-otra-f,.af[data-vp="esc"].af-ivx-otra .af-ivx-otra-f{display:grid}
.af .af-ivok2,.af .af-ivfi,.af .af-ivfi-ok{display:none}
.af.af-iv-ok2 .af-ivok1{display:none}.af.af-iv-ok2 .af-ivok2{display:inline}.af.af-iv-ok2:not(.af-ivx-guardado):not(.af-ivx-nofi) .af-ivfi{display:flex}.af.af-iv-ok2.af-ivx-guardado .af-ivfi-ok{display:block}
.af[data-vp="iv"] .af-ivb{justify-content:center}
'''

def vista1(vp):
    uid = f'af1{vp}'
    vars_ = [(m, form_cita(m, uid)) for m in ('crear', 'lleno', 'editar', 'conf', 'reserva', 'google')] + [('evento', form_evento('evento', uid))]
    sub = lambda m: 'En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.'
    capas = (capa('form', 'af-w520', vars_, aria='Cita') + capa('bq', 'af-w440', [('bq', form_bloqueo('bq', uid))], icono='candado', sub_fn=sub, aria='Bloquear horario')
             + capa_reg(uid) + capa_inv(uid) + alertas_form())
    return marco(1, vp, capas)

FICHA_1 = '''<h3>Especificación · formulario completo de la cita (AppointmentModal)</h3>
<p><b>Qué cambió.</b> Hoy son 11 grupos de cajas con 23 rótulos en MAYÚSCULAS a 11 px. Ahora es el dibujo de los formularios aprobados: cuatro o cinco grupos con rótulo de color e icono (<b>Paciente</b>, <b>Fecha y hora</b>, <b>Detalles</b>, <b>Avisar al paciente</b>, <b>Invitados</b>) y, dentro, filas de lista. Las fechas y horas son píldoras (en la app, el <code>&lt;input type=date|time&gt;</code> de hoy con este dibujo); la duración, el tipo y el estado son fichas; la acción destructiva baja al final como fila roja (patrón de Calendario de iOS) y el pie queda con dos botones.</p>
<table><thead><tr><th></th><th>Duo cerrado</th><th>iPhone</th><th>Duo abierto (h · v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Capa</th><td>tarjeta centrada 310, alto máx. área − 16, cuerpo con desplazamiento y pie fijo</td><td>hoja inferior arrastrable (asa), alto máx. pantalla − barra − 16</td><td>tarjeta centrada 520 en el área de contenido (h cruza la bisagra, §18)</td><td>tarjeta centrada 520 en el área a la derecha de la barra lateral</td></tr>
<tr><th>Filas</th><td colspan="2">etiqueta 13 --tinta2 encima del valor 16; fechas, horas e interruptores en línea (etiqueta 15 a la izquierda, píldora a la derecha). Alto 52–58</td><td colspan="2">etiqueta a la izquierda (columna de 150) y valor a la derecha; 14 en h y computadora, 15/16 en v. Alto 46–52</td></tr>
<tr><th>Pie</th><td colspan="2">Cancelar (quieto) · Guardar (primario), a partes iguales, 44 de alto</td><td>a la derecha (h) · centrado (v), mín. 104</td><td>a la derecha, 40 de alto, mín. 104</td></tr>
<tr><th>Opciones</th><td colspan="2">duración en 3 × 2; estado en 3 + 2</td><td colspan="2">duración en una fila de 6; estado en una fila de 5</td></tr>
</tbody></table>
<h4>Qué hay en cada grupo (textos de hoy)</h4>
<ul><li><b>Qué vas a crear</b> (solo al crear): segmentado Cita | Evento | Bloqueo con icono; debajo «Una cita va ligada a un paciente y a su expediente.». «Bloqueo» cierra este formulario y abre «Bloquear horario» con la fecha y la hora puestas (vista 2).</li>
<li><b>Paciente</b>: buscador «Buscar paciente por nombre o apellido...»; al escribir, la lista aparece DENTRO del grupo (no como desplegable que se recorta): avatar, nombre y teléfono, «Buscando...», y al final «Registrar "…"» / «Crear nuevo paciente y continuar» en verde, que abre <b>Registrar paciente</b> (con «Teléfono celular o WhatsApp», como en la agenda v2). Elegido: avatar + nombre + teléfono (el «Teléfono» del panel «Más» retirado) y ✕ «Quitar paciente» (en edición: «Quitar paciente y cancelar la cita», que abre su alerta, vista 4). En edición, dos filas de acción: <b>Iniciar consulta</b> (hoy un icono del pie con <code>title</code>) y <b>Expediente</b> (hoy un botón de la cabecera). Reserva por enlace sin expediente: el bloque de hoy («Sin expediente», «Reservó por enlace», contacto, historial, «Bloquear contacto / Desbloquear contacto», «Se liga a un paciente al iniciar la consulta.») e «Iniciar consulta» con su motivo visible «Primero se liga a un paciente» (hoy solo en <code>title</code>). Evento de Google por asignar: el aviso de hoy con «¿No es una cita?».</li>
<li><b>Fecha y hora</b>: Fecha de inicio, Hora de inicio, Fecha de fin, Hora de fin y Duración (15 min · 30 min · 45 min · 1 hora · 1:30 h · 2 horas). Errores debajo del grupo, en rojo con icono: «La hora de fin tiene que ir después de la de inicio.» y «Este horario está bloqueado. Quita el bloqueo para agendar aquí.»; Guardar queda apagado. Reservada por enlace: el texto de la elección y «Reagendar» (vista 3) arriba, inicio apagado y sin duración.</li>
<li><b>Detalles</b>: Tipo de cita («Sin tipo», y los tipos con su punto de color y «· 45 min»), Estado (solo al editar: los cinco estados con el icono en círculo de §24.4; aquí vive «No asistió» de la cita agendada), Médico (oculto para el médico sin admin y en clínica de un médico: «Maqueta: un solo médico»), Consultorio * («— Selecciona consultorio —», «Sin asignar», «(default)»), Notas «Instrucciones, observaciones...» (las «Observaciones» del panel «Más»).</li>
<li><b>Avisar al paciente</b> (editar, agenda v2, con teléfono o correo): «Enviar confirmación» (WhatsApp) y «Enviar confirmación por correo»; ya confirmada, «Enviar recordatorio» y «Enviar recordatorio por correo» (los recordatorios del panel «Más»). Estados: «Preparando…», «Enviando…», «Abierto en WhatsApp 17:12», «Enviado por correo 17:12» y los motivos de error de hoy.</li>
<li><b>Invitados</b> (editar, con permiso): «Agregar invitados» → <b>Invitar por correo</b>; sin evento de Google, apagado con su motivo SIEMPRE visible.</li>
<li><b>Fila roja final</b>: «Cancelar cita» (v2; «Cancelando cita» con girador) o «Eliminar evento»/«Eliminar cita». Hoy es un icono solo con <code>title</code> en el pie y actúa sin preguntar; ahora abre la alerta destructiva (CALMA §29.2, vista 4). El «Iniciar consulta» que primero liga lleva el icono de eslabón (§29.6). Los motivos que vivían en <code>title</code> se leen a la vista (§29.7).</li></ul>
<p><b>Guardar</b>: el girador de hoy (sin texto, <code>aria-label</code> «Guardando») sustituye la palabra sin cambiar el ancho. Al guardar: aviso arriba «Se agendó correctamente» / «Cambios guardados» y, al crear con Google pendiente, <b>Invitar por correo</b> («Creando el evento en Google…» → elegir → confirmar dirección escrita a mano → acuse).</p>
<p><b>Movimiento</b>: la tarjeta nace del centro (escala .96→1 + fundido, resorte sin rebote, respuesta .35 s) y sale en 200 ms por el mismo camino; en iPhone la hoja sube del borde y se cierra arrastrándola (proyección de inercia, resistencia hacia arriba). Cambiar de capa (formulario → Registrar paciente, → Invitar) no apila velos: la de debajo se aparta y vuelve al cerrar. Movimiento reducido: fundido de 200 ms sin desplazamiento. Transparencia reducida: velo opaco sin desenfoque. <b>Foco</b>: al abrir, a la tarjeta (en la app, al primer campo: el buscador al crear, la fecha al llegar desde «Reagendar»); Esc o tocar el velo cierra la capa de arriba; la ✕ mide 44 (36 en ancho).</p>'''

TIRA_1 = ['Formulario', ['Nueva cita', 'abre:form:crear'], ['Nueva cita con paciente', 'abre:form:lleno'], ['Editar cita agendada (07)', 'abre:form:editar'], ['Editar confirmada (10)', 'abre:form:conf'],
          ['Reserva por enlace sin expediente (21)', 'abre:form:reserva'], ['Google por asignar', 'abre:form:google'], '|',
          'Estados', ['buscando paciente', 'clase:af-k-bsq', False], ['«Buscando...»', 'clase:af-k-buscando', False], ['errores de fecha', 'clase:af-k-err', False], ['Guardando', 'clase:af-k-guard', False],
          ['un solo médico', 'clase:af-k-unmed', False], ['avisos en curso', 'clase:af-k-avcur', False], ['avisos hechos', 'clase:af-k-avok', False], ['avisos con error', 'clase:af-k-averr', False],
          ['sin evento de Google', 'clase:af-k-sinev', False], ['cancelando', 'clase:af-k-del', False], ['contacto bloqueado', 'clase:af-k-hist', False], '|',
          'Capas', ['Registrar paciente', 'abre:reg:reg'], ['Paciente duplicado', 'dup:dup'], ['Invitar: esperando', 'iv:af-iv-esp'], ['Invitar: sin evento', 'iv:af-iv-sin'], ['Invitar: elegir', 'iv:'], ['Invitar: otra dirección', 'iv::af-ivx-otra'],
          ['Invitar: confirmar', 'iv:af-iv-conf'], ['Invitar: hecho', 'iv:af-iv-ok2'], ['aviso «Se agendó correctamente»', 'toast:ok:Se agendó correctamente'], ['Cerrar', 'cerrar']]

# ================================================================== ALERTAS (ConfirmModal) ==================================================================
def alertas_form():
    V_ = [
        ('qp-canc', 'mal', 'calx', '¿Deseas cancelarla?', 'Una cita con paciente no se elimina: quitar al paciente CANCELA la cita. Seguirá en la agenda como cancelada, y en el calendario de Google de quien esté invitado quedará marcada como cancelada.', 'Volver', 'Cancelar cita', 'af-malb'),
        ('qp-elim', 'mal', 'papelera', '¿Deseas continuar?', 'Quitar al paciente elimina la CITA COMPLETA, no sólo su nombre: desaparece de la agenda y también del calendario de Google de quien esté invitado, que recibirá el aviso de cancelación. No se puede deshacer — habría que agendarla de nuevo desde cero.', 'Cancelar', 'Eliminar cita', 'af-malb'),
        ('hor-ini', 'ag', 'reloj', '¿Es correcto?', 'Vas a agendar a las 20:30, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Guardar', 'af-prim'),
        ('hor-dia', 'ag', 'reloj', '¿Es correcto?', 'Vas a agendar a las 10:00 del domingo, y este consultorio no atiende los domingos.', 'Cancelar', 'Guardar', 'af-prim'),
        ('hor-fin', 'ag', 'reloj', '¿Es correcto?', 'Terminaría a las 20:30, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Guardar', 'af-prim'),
        ('hor-tz', 'ag', 'reloj', '¿Es correcto?', 'Vas a agendar a las 20:30 hora Quintana Roo, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Guardar', 'af-prim'),
        ('emp-1', 'ag', 'aviso', '¿Guardar de todos modos?', 'Se empalma con «Paciente Prueba 10» (17:30–17:45).', 'Cancelar', 'Guardar', 'af-prim'),
        ('emp-n', 'ag', 'aviso', '¿Guardar de todos modos?', 'Se empalma con estas citas del mismo médico: «Paciente Prueba 12» (18:20–18:50), «Revisión de estudios» (18:20–18:50).', 'Cancelar', 'Guardar', 'af-prim'),
        ('mov-hor', 'ag', 'reloj', '¿Es correcto?', 'Vas a moverlo a las 20:15, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Mover', 'af-prim'),
        ('mov-dia', 'ag', 'reloj', '¿Es correcto?', 'Vas a moverlo a las 10:00 del domingo, y este consultorio no atiende los domingos.', 'Cancelar', 'Mover', 'af-prim'),
        ('est-fin', 'ag', 'reloj', '¿Es correcto?', 'Terminaría a las 20:30, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Guardar', 'af-prim'),
        ('est-ini', 'ag', 'reloj', '¿Es correcto?', 'Empezaría a las 07:30, y este consultorio atiende de 08:00 a 20:00.', 'Cancelar', 'Guardar', 'af-prim'),
        ('del-canc', 'mal', 'calx', '¿Cancelar la cita de Paciente Prueba 07?', 'El horario queda libre y la cita se queda en la agenda como cancelada.', 'Volver', 'Cancelar cita', 'af-malb'),
        ('del-ev', 'mal', 'papelera', '¿Eliminar el evento «Curso de actualización»?', 'No se puede deshacer.', 'Cancelar', 'Eliminar evento', 'af-malb'),
        ('mov-emp', 'ag', 'aviso', '¿Guardar de todos modos?', 'Se empalma con «Paciente Prueba 12» (18:20–18:50).', 'Cancelar', 'Mover', 'af-prim'),
    ]
    dup = (f'<div class="af-var" data-m="dup" hidden><span class="af-al-i af-i-ag" aria-hidden="true">{ii("persona", 28, 2)}</span><h2>Paciente duplicado</h2>'
           f'<p class="af-al-t" lang="es">Ya existe un paciente con los mismos datos: <b>Paciente Prueba 22</b> <span class="af-num">(Exp. #EXP-2026-0022)</span>. ¿Es el mismo paciente o una persona distinta?</p>'
           f'<p class="af-al-t" lang="es">Si es otra persona, se creará el registro de todos modos.</p>'
           f'<div class="af-al-b af-uno">{b("Es el mismo paciente", "af-prim", " data-cierra=\"1\"")}{b("Es otra persona", "af-ton", " data-cierra=\"1\"")}{b("Cancelar", "af-qui", " data-cierra=\"1\"")}</div></div>')
    return alerta('al', V_).replace('</div></div>', dup + '</div></div>', 1) if False else alerta('al', V_)[:-12] + dup + '</div></div>'

# ================================================================== VISTA 2 · EVENTO Y BLOQUEO ==================================================================
def vista2(vp):
    uid = f'af2{vp}'
    vars_ = [(m, form_evento(m, uid)) for m in ('evento', 'todo', 'banda', 'evedit')] + [('crear', form_cita('crear', uid + 'c'))]
    bq = [(m, form_bloqueo(m, uid)) for m in ('bq', 'bqdias', 'bqedit')]
    sub = lambda m: 'En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.'
    capas = capa('form', 'af-w520', vars_, icono='calmas', aria='Evento') + capa('bq', 'af-w440', bq, icono='candado', sub_fn=sub, aria='Bloqueo de horario') + alertas_form()
    return marco(2, vp, capas)

FICHA_2 = '''<h3>Especificación · evento y bloqueo</h3>
<p><b>Selector «Qué vas a crear»</b> (solo al crear): segmentado de tres posiciones con icono (Cita · Evento · Bloqueo), 38 de alto (32 en h y computadora). Cita y Evento cambian el formulario en el sitio, sin cerrar la capa; <b>Bloqueo</b> no es un tipo de fila: cierra este formulario y abre «Bloquear horario» con la fecha, la hora y el médico de aquí (como hoy, <code>data-alta-bloqueo</code>). Con «Todo el día» encendido, «Cita» se apaga y su motivo se lee bajo el selector: «Un evento de todo el día no puede ser una cita.» (§29.7).</p>
<h4>Evento</h4>
<ul><li>Grupo <b>Evento</b>: Título * («Cirugía Sr. Pérez, Junta de personal, Bloqueo…») y su aviso «Se verá tal cual en Google Calendar y en la invitación de quien asista.»; <b>Icono</b>: los 20 de hoy en una rejilla de celdas de 44 (40 en ancho) con su nombre en <code>aria-label</code>; volver a tocar el elegido lo quita. <b>Color</b>: los 6 (Índigo, Magenta, Carmín, Oliva, Bronce, Grafito) como muestras de 44 con su tinte; el elegido lleva anillo de 2 px de su color.</li>
<li><b>Fecha y hora</b>: interruptor «Todo el día» arriba (porque cambia los campos: quita horas y duración y renombra a «Primer día» / «Último día»). Abierto desde la banda de todo el día: interruptor apagado y «· la banda sólo crea eventos de todo el día».</li>
<li><b>Detalles</b>: Estado (al editar, solo Agendada y Cancelada), Médico, Consultorio, Notas. Al editar: Invitados y la fila roja «Eliminar evento».</li></ul>
<h4>Bloqueo (ModalBloqueo)</h4>
<ul><li>Tarjeta 440 (310 en Duo cerrado; hoja en iPhone). Título «Bloquear horario» / «Bloqueo de horario» y, como subtítulo, «En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.».</li>
<li>Filas: Médico («Elige el médico»; no sale al editar ni a quien no elige médico), <b>Días completos</b> (hoy una casilla; aquí interruptor, mismo dato), Inicio y Fin con fecha y hora en dos píldoras; con días completos, «Desde» y «Hasta (incluido)». «Motivo (opcional)» «Vacaciones, congreso…» con su aviso «Si la clínica usa Google Calendar, el motivo aparece allí. No escribas datos de pacientes.». No existe «repetir»: no se dibuja.</li>
<li>Validaciones de hoy bajo el grupo, en rojo: «Elige el médico.», «Pon las fechas.», «Pon las horas.», «El fin tiene que ser después del inicio.», «El último día no puede ser antes del primero.», y los del servidor («No se pudo guardar el bloqueo», «Sin permisos», «No se pudo quitar el bloqueo»).</li>
<li>Pie: «Quitar bloqueo» (texto rojo, a la izquierda, solo al editar) → se convierte en el botón rojo «Sí, quitar» (la confirmación de hoy, en el mismo sitio); «Cancelar» · «Guardar» / «Guardando…». Al terminar, avisos «Horario bloqueado» (+ «Hay 1 cita en este horario. Se queda como está.» si pisa citas) y «Bloqueo quitado».</li></ul>'''

TIRA_2 = ['Evento', ['Nuevo evento', 'abre:form:evento'], ['todo el día', 'abre:form:todo'], ['desde la banda de todo el día', 'abre:form:banda'], ['Editar evento', 'abre:form:evedit'], ['Nueva cita', 'abre:form:crear'], '|',
          'Bloqueo', ['Bloquear horario', 'abre:bq:bq'], ['días completos', 'abre:bq:bqdias'], ['Bloqueo de horario (editar)', 'abre:bq:bqedit'], ['«Sí, quitar»', 'clase:af-k-bqq', False], ['error de validación', 'clase:af-k-bqerr', False], ['Guardando…', 'clase:af-k-bqg', False], ['un solo médico', 'clase:af-k-unmed', False], '|',
          'Avisos', ['«Horario bloqueado»', 'toast:ok:Horario bloqueado'], ['«Hay 1 cita…»', 'toast:info:Hay 1 cita en este horario. Se queda como está.'], ['«Bloqueo quitado»', 'toast:ok:Bloqueo quitado'], ['error', 'toast:mal:No se pudo guardar el bloqueo'], ['Cerrar', 'cerrar']]

# ================================================================== VISTA 3 · REAGENDAR Y CONVERTIR EN CITA ==================================================================
def panel_reag():
    campos = (fila('Consultorio nuevo', sel(['Centro', 'Hosp Norte', 'Rehab'], 'Centro', lab='Consultorio nuevo'), 'af-r-c')
              + f'<div class="af-f af-fi af-r-c"><span class="af-l">Día nuevo</span><span class="af-c">{pil("20/11/2026", "Día nuevo")}</span></div>'
              + f'<div class="af-f af-fi af-r-c"><span class="af-l">Hora nueva</span><span class="af-c">{pil("10:00", "Hora nueva")}</span></div>')
    datos_b = f'<div class="af-cuad af-r af-r-bd"><div class="af-cuad-acc">{b("Volver", "af-qui", " data-rg=\"volver\"")}{b("Revisar cambio", "af-ton", " data-rg=\"revisar\"")}</div></div>'
    preg = (f'<div class="af-cuad af-r af-r-q"><div class="af-aviso-q" role="alert">{ii("aviso", 18, 2.2)}<span class="af-r-q1">¿Reagendar la cita con estos datos? El paciente eligió los anteriores al reservar.</span>'
            f'<span class="af-r-q2">Se empalma con «Paciente Prueba 22» (10:00–10:45). ¿Reagendar de todos modos?</span></div>'
            f'<div class="af-cuad-acc">{b("Corregir", "af-qui", " data-rg=\"corregir\"")}'
            f'<button type="button" class="af-p af-b af-ton" data-rg="si"><span class="af-r-si">Sí, reagendar y avisar</span><span class="af-r-env">Reagendando…</span></button></div></div>')
    hecho = (f'<div class="af-cuad af-r af-r-h"><div class="af-aviso-q af-aviso-ok" role="status">{ii("ok", 18, 2.2)}<span class="af-r-h1">Listo: la cita se reagendó y le enviamos el correo con los datos nuevos.</span>'
             f'<span class="af-r-h2">La cita se reagendó. No tiene correo: avísale por WhatsApp.</span></div></div>'
             f'<button type="button" class="af-p af-ac af-ac-ok af-r af-r-wa">{ii("whatsapp", 20, 2)}<span>Enviar confirmación</span></button>'
             f'<div class="af-cuad af-r af-r-h"><div class="af-cuad-acc">{b("Cerrar", "af-qui", " data-rg=\"cerrar\"")}</div></div>')
    return gr('Reagendar', 'reagendar', f'<div class="af-r-camp">{campos}</div>' + datos_b + preg + hecho,
              pieg('Le enviaremos al paciente un correo con los datos nuevos y su enlace para confirmar o cancelar.', 'af-r af-r-n')
              + err('La hora nueva ya pasó.', 'af-r af-r-e'), cls='af-rg')

def form_reag(uid):
    G_ = []
    cu = (f'<div class="af-pac">{av("12")}<span class="af-pac-t"><span class="af-pac-n">Paciente Prueba 12</span><span class="af-pac-s">999 000 0012</span>'
          f'<span class="af-mr" style="margin-top:2px">{ii("enlace", 14, 2)}Reservó por enlace</span></span>'
          f'<button type="button" class="af-p af-x" data-quita="pac" aria-label="Quitar paciente y cancelar la cita">{ic(I["x"], 18, 2.2)}</button></div>'
          + ac('estet', 'Iniciar consulta', attrs=' aria-label="Iniciar consulta"') + ac('exp', 'Expediente'))
    G_.append(gr('Paciente', 'persona', cu))
    G_.append(panel_reag())
    f_, e = fechas('19/11/2026', '18:20', '19/11/2026', '18:50', '', dis_ini=True, sin_dur=True)
    f_ = (f'<div class="af-cuad af-elec"><p>El paciente eligió médico, consultorio, día y hora al reservar por enlace. Para cambiarlos usa «Reagendar», que le avisa; la duración sí puedes ajustarla.</p>'
          f'<button type="button" class="af-p af-b af-ton" data-reagendar="1">{ii("reagendar", 18, 2)}Reagendar</button></div>' + f_)
    G_.append(gr('Fecha y hora', 'reloj', f_, e))
    G_.append(gr('Detalles', 'detalles', tipo_cita('Seguimiento', uid) + estado('conf') + medico(dis=True) + consultorio(dis=True) + notas()))
    G_.append(avisar(True))
    G_.append(invitados())
    G_.append(destructiva('Cancelar cita', 'calx', 'Cancelando cita'))
    return 'Editar cita', f'<div class="af-grs">{"".join(G_)}</div>', pie_cita()

def capa_conv(uid):
    lista = ''.join(f'<button type="button" class="af-p af-op" data-cv="pac" role="option">{av(n, "af-av-s")}<span class="af-pac-t"><span class="af-pac-n">{nom}</span><span class="af-pac-s">{tel}</span></span></button>' for n, nom, tel in RES[:3])
    reg = (f'<button type="button" class="af-p af-op af-op-reg" role="option" data-abre="reg"><span class="af-av af-av-s" aria-hidden="true">{ic(I["plus"], 16, 2.4)}</span>'
           f'<span class="af-pac-t"><span class="af-pac-n">Registrar «Paciente Prueba 2»</span><span class="af-pac-s">Crear paciente nuevo y continuar</span></span></button>')
    pac = (f'<label class="af-f"><span class="af-l">Paciente</span><span class="af-c"><input class="af-in af-cv-in" role="combobox" aria-expanded="false" autocomplete="off" value="" placeholder="">'
           f'<span class="af-cv-ok">Paciente Prueba 03</span></span></label>'
           f'<div class="af-lista af-cv-l" role="listbox" aria-label="Pacientes">{lista}{reg}</div>'
           + ac('plus', 'Registrar paciente nuevo', '', '', False, attrs=' data-abre="reg"'))
    g1 = gr('', '', pac)
    g2 = gr('', '', fila('Consultorio', '<span class="af-sel"><select class="af-in" aria-label="Consultorio"><option class="af-cv-o0">Elige el consultorio…</option><option>Centro</option><option>Hosp Norte</option></select>' + ic(I["abajo"], 16, 2.2) + '</span>')
            + fila('Tipo de cita', sel(['Sin tipo', 'Primera vez', 'Seguimiento'], 'Sin tipo', lab='Tipo de cita')),
            pieg('En Google se verá con el nombre del paciente y su descripción dejará de sincronizarse; las notas del evento se quedan en Spinus.'))
    pie = b('Cancelar', 'af-qui', ' data-cierra="1"') + '<button type="button" class="af-p af-b af-prim af-cv-b" data-cierra="1">Convertir en cita</button>'
    return capa('conv', 'af-w440', [('cv', ('Convertir en cita', f'<div class="af-grs">{g1}{g2}</div>', pie))], icono='convertir',
                sub_fn=lambda m: '«Pendiente administrativo» · 13:30–14:00', aria='Convertir en cita')

CSS_V3 = '''
.af .af-rg{display:none}
.af[class*="af-rg-"] .af-rg{display:flex}
.af[class*="af-rg-"] .af-elec{display:none}
.af .af-r,.af .af-r-q2,.af .af-r-env,.af .af-r-h2{display:none}
.af.af-rg-datos .af-r-bd,.af.af-rg-error .af-r-bd,.af.af-rg-conf .af-r-q,.af.af-rg-env .af-r-q,.af.af-rg-emp .af-r-q,.af.af-rg-hecho .af-r-h,.af.af-rg-hechosin .af-r-h{display:flex}
.af.af-rg-datos .af-r-n,.af.af-rg-error .af-r-n,.af.af-rg-conf .af-r-n,.af.af-rg-env .af-r-n,.af.af-rg-emp .af-r-n{display:block}
.af.af-rg-error .af-r-e{display:flex}
.af.af-rg-hechosin .af-r-wa{display:flex}
.af.af-rg-emp .af-r-q1{display:none}.af.af-rg-emp .af-r-q2{display:inline}
.af.af-rg-env .af-r-si{display:none}.af.af-rg-env .af-r-env{display:inline}.af.af-rg-env [data-rg]{opacity:.45;pointer-events:none}
.af.af-rg-hecho .af-r-h1{display:inline}.af.af-rg-hechosin .af-r-h1{display:none}.af.af-rg-hechosin .af-r-h2{display:inline}
.af.af-rg-hecho .af-r-camp,.af.af-rg-hechosin .af-r-camp{display:none}
.af.af-rg-conf .af-r-c,.af.af-rg-env .af-r-c,.af.af-rg-emp .af-r-c{opacity:.5;pointer-events:none}
.af .af-r-c+.af-r-c::before{content:"";position:absolute;top:0;left:16px;right:16px;height:1px;background:var(--linea)}
.af .af-r-bd,.af .af-r-q,.af .af-r-h{padding-top:4px}
.af .af-cv-ok{display:none;font-size:16px;line-height:24px}
.af[data-vp="ih"] .af-cv-ok,.af[data-vp="esc"] .af-cv-ok{font-size:14px}
.af.af-cv-listo .af-cv-ok{display:block}.af.af-cv-listo .af-cv-in{display:none}
.af.af-cv-lista .af-cv-l{display:flex}
.af:not(.af-cv-listo) .af-cv-b{opacity:.45;pointer-events:none}
.af.af-cv-listo .af-cv-o0{display:none}
'''

def vista3(vp):
    uid = f'af3{vp}'
    capas = capa('form', 'af-w520', [('rg', form_reag(uid))], aria='Cita') + capa_conv(uid) + capa_reg(uid) + alertas_form()
    return marco(3, vp, capas)

FICHA_3 = '''<h3>Especificación · Reagendar y Convertir en cita</h3>
<h4>PanelReagendar (dentro del formulario de una cita reservada por enlace)</h4>
<p>Hoy sustituye a la caja de la elección; aquí entra como un grupo más, <b>Reagendar</b>, en el mismo sitio (encima de «Fecha y hora», que sigue debajo con el inicio apagado). Filas: «Consultorio nuevo», «Día nuevo», «Hora nueva»; nota «Le enviaremos al paciente un correo con los datos nuevos y su enlace para confirmar o cancelar.» (sin correo: «Esta cita no tiene correo: no se le avisará solo. Al terminar podrás mandarle un WhatsApp.»).</p>
<ul><li><b>Datos</b>: «Volver» (quieto) · «Revisar cambio» (tonal: el primario del pie sigue siendo «Guardar»). Errores de hoy en rojo: «Elige consultorio, día y hora.», «No cambiaste el consultorio, el día ni la hora.», «La hora nueva ya pasó.», «Este horario está bloqueado. Quita el bloqueo para agendar aquí.», «No se pudo reagendar la cita.»…</li>
<li><b>Revisar</b>: las filas se apagan y aparece el aviso ámbar «¿Reagendar la cita con estos datos? El paciente eligió los anteriores al reservar.» con «Corregir» · «Sí, reagendar y avisar» (→ «Reagendando…»). Con empalme, el mismo aviso con el texto de empalme terminado en «¿Reagendar de todos modos?».</li>
<li><b>Hecho</b>: acuse verde con el texto de hoy según el correo (enviado / sin correo / no salió) y, si no salió el correo, «Enviar confirmación» por WhatsApp; «Cerrar» cierra el formulario y recarga la agenda.</li></ul>
<h4>ConvertirEnCita (desde la burbuja de un evento)</h4>
<p>Tarjeta 440 (310 en Duo cerrado, hoja en iPhone) titulada «Convertir en cita», con «‹título›» · tramo como subtítulo. Paciente (combobox con la lista dentro: resultados, y «Registrar «…»» / «Crear paciente nuevo y continuar»), fila de acción «Registrar paciente nuevo» (hoy un botón verde aparte), Consultorio («Elige el consultorio…» / «Sin consultorios disponibles»), Tipo de cita («Sin tipo» y los del médico; solo si hay tipos) y la nota de Google. Pie: «Cancelar» · «Convertir en cita» (apagado hasta tener paciente y consultorio). Hoy el orden es principal primero; aquí, catálogo: secundario a la izquierda.</p>'''

TIRA_3 = ['Reagendar', ['formulario con elección', 'abre:form:rg'], ['Reagendar: datos', 'rg:af-rg-datos'], ['error', 'rg:af-rg-error'], ['revisar cambio', 'rg:af-rg-conf'], ['Reagendando…', 'rg:af-rg-env'],
          ['empalme', 'rg:af-rg-emp'], ['hecho (correo enviado)', 'rg:af-rg-hecho'], ['hecho (sin correo)', 'rg:af-rg-hechosin'], '|',
          'Convertir en cita', ['abrir', 'abre:conv:cv'], ['escribiendo paciente', 'clase:af-cv-lista', False], ['listo para convertir', 'clase:af-cv-listo', False], ['Cerrar', 'cerrar']]

# ================================================================== VISTA 4 · CONFIRMACIONES ==================================================================
def capa_asis(uid):
    filas = ''
    for nom, cuando in (('Paciente Prueba 18', 'Lun 16 nov · 09:00'), ('Paciente Prueba 20', 'Mar 17 nov · 12:30')):
        filas += (f'<li class="af-as"><span class="af-pac-t"><span class="af-pac-n">{nom}</span><span class="af-pac-s">{cuando}</span></span>'
                  f'<span class="af-as-b">{b("Sí asistió", "af-ton", f" aria-label=\"Sí asistió: {nom}, {cuando}\"")}{b("No asistió", "af-qui", f" aria-label=\"No asistió: {nom}, {cuando}\"")}</span></li>')
    cu = f'<div class="af-sup"><ul class="af-asl" aria-label="Citas por cerrar">{filas}</ul></div>'
    return capa('asis', 'af-w440', [('asis', ('¿Asistió el paciente?', cu, b('Decidir después', 'af-qui', ' data-cierra="1"')))], icono='confirmar',
                sub_fn=lambda m: 'Más de 48 horas y sin nota clínica.', aria='¿Asistió el paciente?')

CSS_V4 = '''
.af .af-asl{list-style:none;margin:0;padding:0}
.af .af-as{position:relative;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px}
.af[data-vp="ih"] .af-as,.af[data-vp="iv"] .af-as,.af[data-vp="esc"] .af-as{padding:10px 20px}
.af .af-as+.af-as::before{content:"";position:absolute;top:0;left:16px;right:16px;height:1px;background:var(--linea)}
.af .af-as-b{display:flex;gap:8px}
.af[data-vp="ext"] .af-as-b,.af[data-vp="tel"] .af-as-b{width:100%}
.af[data-vp="ext"] .af-as-b>.af-b,.af[data-vp="tel"] .af-as-b>.af-b{flex:1 1 0}
.af .af-as-b>.af-b{height:40px;font-size:14px;padding:0 14px}
.af .af-as-b>.af-b::after{content:"";position:absolute;inset:-2px 0}
.af[data-vp="ih"] .af-as-b>.af-b,.af[data-vp="esc"] .af-as-b>.af-b{height:36px}
.af .af-pie:has(>.af-b:only-child)>.af-b{flex:0 1 auto;min-width:160px}
.af[data-vp="ext"] .af-pie:has(>.af-b:only-child),.af[data-vp="tel"] .af-pie:has(>.af-b:only-child){justify-content:center}
'''

def vista4(vp):
    uid = f'af4{vp}'
    capas = capa('form', 'af-w520', [('editar', form_cita('editar', uid)), ('crear', form_cita('lleno', uid + 'n'))], aria='Cita') + alertas_form() + capa_asis(uid)
    return marco(4, vp, capas)

FICHA_4 = '''<h3>Especificación · confirmaciones (ConfirmModal) como alertas del catálogo</h3>
<p>Hoy <code>ConfirmModal</code> es un párrafo suelto y «Cancelar» · «Aceptar» alineados a la derecha. Aquí es la alerta única del catálogo: tarjeta 320 (340 en Duo abierto y computadora; 310 en Duo cerrado), radio 20, relleno 24; icono de 28 en círculo de 48 (rojo suave para destruir, ámbar para avisar); título 17/700 centrado; mensaje 14/20 --tinta2 justificado; dos botones del mismo ancho (secundario a la izquierda, principal a la derecha). <b>No se añade texto</b>: el título es la pregunta final del propio mensaje de hoy («¿Es correcto?», «¿Guardar de todos modos?», «¿Deseas cancelarla?», «¿Deseas continuar?») y el cuerpo es el resto, sin cambiar una palabra. El principal lleva el VERBO de la acción (CALMA §29.4: «Guardar», «Mover», «Cancelar cita», «Eliminar cita», «Eliminar evento») en vez de «Aceptar»; el secundario dice «Volver» cuando la acción es cancelar algo y «Cancelar» en el resto. Las destructivas van en rojo suave. La fila roja «Cancelar cita» / «Eliminar evento» del formulario ya NO actúa directa: abre su alerta (§29.2) con el texto de la burbuja.</p>
<table><thead><tr><th>De dónde nace</th><th>Mensaje (con datos de la semilla)</th><th>«Cancelar» hace</th></tr></thead><tbody>
<tr><th>✕ del paciente (editar, v2)</th><td>«Una cita con paciente no se elimina: quitar al paciente CANCELA la cita… ¿Deseas cancelarla?»</td><td>vuelve al formulario</td></tr>
<tr><th>✕ del paciente (sin v2)</th><td>«Quitar al paciente elimina la CITA COMPLETA… ¿Deseas continuar?»</td><td>vuelve al formulario</td></tr>
<tr><th>Guardar fuera de horario</th><td>«Vas a agendar a las HH:MM[ hora Región], y este consultorio atiende de A a B. ¿Es correcto?»; día cerrado: «… del domingo, y este consultorio no atiende los domingos.»; fin fuera: «Terminaría a las …». Sujeto «esta clínica» cuando no hay consultorio.</td><td>vuelve al formulario con la hora puesta</td></tr>
<tr><th>Guardar con empalme</th><td>«Se empalma con «…» (HH:MM–HH:MM). ¿Guardar de todos modos?»; varias: «Se empalma con estas citas del mismo médico: …» (hasta tres nombradas y «y N más»). Va DESPUÉS del de horario, nunca combinado.</td><td>vuelve al formulario; si fue un 409 del servidor, aviso «No se guardó: la agenda se quedó como estaba.»</td></tr>
<tr><th>Arrastrar una cita</th><td>«Vas a moverlo a las …, y este consultorio atiende de … ¿Es correcto?» (o día cerrado); después, el de empalme.</td><td>la cita vuelve a su sitio</td></tr>
<tr><th>Estirar una cita</th><td>«Terminaría a las …» (borde de abajo) / «Empezaría a las …» (borde de arriba); después, el de empalme.</td><td>la cita vuelve a su tamaño</td></tr>
</tbody></table>
<p>Lo que NO pregunta y se dice con un aviso arriba: soltar en un bloqueo («Este horario está bloqueado. Quita el bloqueo para agendar aquí.»), mover una cita reservada por enlace (su texto de «Reagendar»), soltar una cita en la banda de todo el día («Una cita no puede ser de todo el día.»), el éxito («Se movió en la agenda») y los fallos («Error de conexión — se devolvió a su horario original»). Las confirmaciones de la burbuja (cancelar, no asistió, eliminar) están en «Agenda · Preguntas y confirmaciones» (página Cita); las de configuración, en la página Herramientas y configuración.</p>
<p><b>¿Asistió el paciente?</b> (PreguntaAsistencia, al abrir la agenda con citas de hace más de 48 h sin nota): tarjeta 440 con subtítulo «Más de 48 horas y sin nota clínica.», lista «Citas por cerrar» con «Sí asistió» (tonal) · «No asistió» (quieto) por fila y pie «Decidir después».</p>
<p><b>Movimiento</b>: la alerta nace del centro (escala .96→1 + fundido); el formulario se queda detrás, atenuado y sin recibir toques (un solo velo). Foco: al principal no destructivo; en las destructivas, a «Cancelar». Esc = «Cancelar». Movimiento reducido: fundido.</p>'''

TIRA_4 = ['Desde el formulario', ['✕ paciente: cancela', 'al:qp-canc:editar'], ['✕ paciente: elimina', 'al:qp-elim:editar'], ['fuera de horario', 'al:hor-ini:crear'], ['día sin consulta', 'al:hor-dia:crear'],
          ['fin fuera de horario', 'al:hor-fin:crear'], ['otra zona horaria', 'al:hor-tz:crear'], ['empalme', 'al:emp-1:crear'], ['empalme con varias', 'al:emp-n:crear'], '|',
          'Arrastrar y estirar', ['mover fuera de horario', 'al:mov-hor'], ['mover a día sin consulta', 'al:mov-dia'], ['estirar el fin', 'al:est-fin'], ['estirar el inicio', 'al:est-ini'], ['empalme al soltar', 'al:mov-emp'], ['fila roja: cancelar cita', 'al:del-canc:editar'], '|',
          'Avisos', ['«Se movió en la agenda»', 'toast:ok:Se movió en la agenda'], ['en un bloqueo', 'toast:mal:Este horario está bloqueado. Quita el bloqueo para agendar aquí.'],
          ['reservada por enlace', 'toast:mal:El consultorio, el día y la hora de una cita reservada por enlace sólo se cambian con «Reagendar», que avisa al paciente.'],
          ['a todo el día', 'toast:info:Una cita no puede ser de todo el día.'], ['409 cancelado', 'toast:info:No se guardó: la agenda se quedó como estaba.'], '|',
          ['¿Asistió el paciente?', 'abre:asis:asis'], ['Cerrar', 'cerrar']]

# ================================================================== SALIDA ==================================================================
salida(1, '1-cita', 'Agenda · Formulario de cita',
       'El formulario completo de la cita (crear y editar) deja los 23 rótulos en mayúsculas de 11 px y pasa al dibujo de los formularios aprobados: grupos con rótulo de color e icono, campos como filas, estado con sus iconos, y la capa del catálogo en cada dispositivo',
       [vista1(vp) for vp in VPS], FICHA_1, TIRA_1, CSS_EST + CSS_V1, abre='form:editar')
salida(2, '2-evento-bloqueo', 'Agenda · Evento y bloqueo',
       'El selector Cita | Evento | Bloqueo, el formulario de evento (icono, color, todo el día) y «Bloquear horario» con su edición y su «Sí, quitar», con las mismas filas y la misma capa',
       [vista2(vp) for vp in VPS], FICHA_2, TIRA_2, CSS_EST + CSS_V1, abre='form:evento')
salida(3, '3-reagendar', 'Agenda · Reagendar y convertir en cita',
       'Reagendar una cita reservada por enlace como un grupo más del formulario, con su revisión y su acuse; y «Convertir en cita» como tarjeta del catálogo',
       [vista3(vp) for vp in VPS], FICHA_3, TIRA_3, CSS_EST + CSS_V1 + CSS_V3, abre='form:rg')
salida(4, '4-confirmaciones', 'Agenda · Confirmaciones',
       'Las confirmaciones que nacen del formulario y de arrastrar o estirar una cita dejan de ser un párrafo con dos botones y pasan a la alerta del catálogo, sin cambiar una palabra; más la pregunta de asistencia',
       [vista4(vp) for vp in VPS], FICHA_4, TIRA_4, CSS_EST + CSS_V1 + CSS_V4, abre='al:mov-hor')
