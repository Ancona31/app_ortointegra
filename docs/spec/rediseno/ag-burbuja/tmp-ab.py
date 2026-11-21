# Agenda fase 2 · LA BURBUJA DE CITA y LA BURBUJA DE ALTA (prefijo .ab). Uso: python3 tmp-ab.py → vista-1…4.html
# Construye ENCIMA de las piezas base (S/entrega/agenda-base): carga sus funciones SIN ejecutar su escritura,
# copia su CSS (clases .ag0- intactas) y añade lo propio con prefijo .ab.
import os, json, re, html as H
L = os.path.dirname(os.path.abspath(__file__))
B = os.path.normpath(f'{L}/../agenda-base')
G = {'__file__': f'{B}/tmp-gen.py', '__name__': 'ag0'}
src = open(f'{B}/tmp-gen.py').read()
exec(compile(src[:src.index('import importlib.util')], f'{B}/tmp-gen.py', 'exec'), G)
src = open(f'{B}/tmp-vistas.py').read()
exec(compile(src[:src.index('# =========================================================== ESCRITURA')], f'{B}/tmp-vistas.py', 'exec'), G)
ic, I, est, hm, rejilla, barra, marco0, C = G['ic'], G['I'], G['est'], G['hm'], G['rejilla'], G['barra'], G['marco'], G['C']
CITAS, DIAS, HOY, gcal, menu_opciones = G['CITAS'], G['DIAS'], G['HOY'], G['gcal'], G['menu_opciones']
VPS = ('ext', 'tel', 'ih', 'iv', 'esc')
TACTIL = ('ext', 'tel', 'ih', 'iv')

I2 = dict(I)
I2.update(
    reasignar='<path d="M7 4 3 8l4 4"/><path d="M3 8h18"/><path d="m17 20 4-4-4-4"/><path d="M21 16H3"/>',
    usermas='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M19 8v6M16 11h6"/>',
    triangulo='<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    enviar='<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/>',
    ban='<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    usuario='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/>',
    pieza='<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6M12 9v6"/>',
)

# ------------------------------------------------------------------ SEMILLA AMPLIADA (datos ficticios) ------------------------------------------------------------------
# Lo que la base no trae y las variantes piden: un evento nacido en Google (convertible), una cita de otra médica,
# una cita pasada sin cerrar y un consultorio en otro huso. Todo ficticio.
def poner(id, **k):
    for c in CITAS:
        if c['id'] == id: c.update(k)
CITAS.append(C('g1', 2, '16:00', '17:00', 'Sesión clínica', 'ag', tipo='evn', evi='evento', ori='google', tel=None, pasado=True))
CITAS.append(C('o1', 4, '11:00', '11:30', 'Paciente Prueba 02', 'ag', med='IS'))
CITAS.append(C('p1', 1, '13:00', '13:30', 'Paciente Prueba 21', 'ag', pasado=True))
poner('v3', cons='Hosp Norte', tz='11:00 hora Quintana Roo')
poner('v4', obs='Esguince de tobillo derecho, control con radiografía y revisión del vendaje funcional')
POR_ID = {c['id']: c for c in CITAS}
DIA_CORTO = ['lun 16', 'mar 17', 'mié 18', 'jue 19', 'vie 20', 'sáb 21', 'dom 22']
DIA_TAR = ['Lun 16 nov', 'Mar 17 nov', 'Mié 18 nov', 'Jue 19 nov', 'Vie 20 nov', 'Sáb 21 nov', 'Dom 22 nov']

def dia_largo(d):
    return f'{DIAS[d][2]} {DIAS[d][1]} de noviembre'

def x_btn(extra=''):
    return f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar"{extra}>{ic(I["x"], 20, 2)}</button>'

def b(txt, k='qui', attrs='', icono=None):
    i = ic(I2[icono], 18, 2.2) if icono else ''
    return f'<button type="button" class="ag0-p ab-b ab-{k}"{attrs}>{i}{txt}</button>'

def fila(icono, txt, attrs='', cls=''):
    return f'<button type="button" class="ag0-p ag0-op {cls}" role="menuitem"{attrs}>{ic(I2[icono], 20, 2)}<span>{txt}</span></button>'

# ------------------------------------------------------------------ LA BURBUJA DE CITA ------------------------------------------------------------------
def burbuja(c, conf_abierto=False, msg=None, medico=('AS', 'Dr. Admin Semilla'), puede=True, destacar=False, todo=False,
            conv=False, wa=None, correo=None):
    """Contenido EXACTO de hoy: BurbujaCita.tsx + burbujaDeTarjeta (accionesTarjeta.ts:217-240), textos literales
    salvo los unificados de CALMA §28 (origen). wa/correo: si aplican (motivoSinWhatsApp/motivoSinCorreo: ni pasada,
    ni en curso, ni todo el día, con teléfono/correo); por omisión, solo si la cita aún no empieza."""
    e, tipo = c['e'], c['tipo']
    ev = tipo in ('ev', 'evn')
    futura = not c.get('pasado') and not c.get('curso')
    if wa is None: wa = futura and not ev
    if correo is None: correo = futura and not ev
    ed = 'd-editar-ev' if ev else ('d-editar-conf' if e == 'conf' else 'd-editar')
    mas = (f'<button type="button" class="ag0-p ag0-x" aria-label="Más opciones de la cita" aria-haspopup="dialog" data-ir="{ed}">'
           f'{ic(I["editar"], 20, 2)}</button>')  # CALMA §29.5: lápiz, aria-label de hoy
    # Decisión del dueño: sin lápiz en la cabecera; la fila «Editar» es el único acceso al formulario (misma acción que el ⋮ de hoy)
    cab = f'<div class="ag0-bu-c">{est(e)}<span class="ag0-flex"></span>{x_btn()}</div>'
    nom = f'<h2 class="ag0-bu-n{" ag0-tach" if e == "canc" else ""}">{c["nom"]}</h2>'
    ori = ''
    if c['ori'] == 'google': ori += f'<span class="ag0-marca">{gcal(14)}Agendada desde Google Calendar</span>'
    if c['ori'] == 'enlace': ori += f'<span class="ag0-marca">{ic(I["enlace"], 14, 2)}Reservó por enlace</span>'
    ori = f'<div class="ag0-bu-o">{ori}</div>' if ori else ''
    if todo:
        hora, mins = '00:00 – 00:00', 1440
    else:
        hora, mins = f'{hm(c["a"])} – {hm(c["b"])}', round((c['b'] - c['a']) * 60)
    tz = ''
    if c.get('tz'):
        a2, b2 = hm(c['a'] + 1), hm(c['b'] + 1)
        tz = f'<small class="ab-tz">{a2}–{b2} hora Quintana Roo</small>'
    obs = f'<p class="ag0-bu-obs" title="{H.escape(c["obs"])}"><b>Observaciones:</b> {c["obs"]}</p>' if c['obs'] else ''
    med = f'<div class="ag0-bu-f"><span class="ag0-av2">{medico[0]}</span><span>{medico[1]}</span></div>' if medico else ''
    det = (f'<div class="ag0-bu-d"><div class="ag0-bu-f">{ic(I["reloj"], 20, 2)}<span><span class="ag0-num">'
           f'<b style="font-weight:600">{hora}</b> · {mins} min</span><small>{dia_largo(c["d"])}</small>{tz}</span></div>{med}{obs}</div>')
    prin, ayuda, filas, pie = '', '', [], []
    def bp(icono, txt, ir, ton=False):
        return f'<button type="button" class="ag0-p ag0-bp{" ag0-bp-t" if ton else ""}" data-ir="{ir}">{ic(I2[icono], 18, 2)}{txt}</button>'
    if ev:
        filas = [('editar', 'Editar', ed)] + ([('usermas', 'Convertir en cita', 'd-convertir')] if conv else [])
        pie = [('papelera', 'Eliminar evento', 'al-eliminar-ev')]
    elif e == 'aten':
        prin = bp('docs', 'Ver la consulta', 'd-consulta', True)
        filas = [('editar', 'Editar', ed)]
    elif e == 'canc':
        prin = bp('reagendar', 'Darle otra cita', 'd-otra')
        ayuda = '<p class="ag0-bu-ay">Esta cita se canceló. Su horario quedó libre.</p>'
        filas = [('reasignar', 'Reasignar el horario', 'reasignar'), ('editar', 'Editar', ed)]
        pie = [('papelera', 'Eliminar cita', 'al-eliminar-cita')]
    elif e == 'noas':
        prin = bp('reagendar', 'Darle otra cita', 'd-otra')
        ayuda = '<p class="ag0-bu-ay">El paciente no llegó a esta cita.</p>'
        filas = [('editar', 'Editar', ed)]
    else:
        subida = []
        if destacar:
            prin = bp('reagendar', 'Reagendar', 'd-reagendar-enl' if c['ori'] == 'enlace' else 'd-reagendar')
            if puede: subida = [('iniciar', 'Iniciar consulta', 'd-nota')]
        elif puede:
            prin = bp('iniciar', 'Iniciar consulta', 'd-nota')
        rg = 'd-reagendar-enl' if c['ori'] == 'enlace' else 'd-reagendar'
        filas = subida + ([('confirmar', 'Confirmar', 'sub')] if e == 'ag' else []) + ([] if destacar else [('reagendar', 'Reagendar', rg)]) \
            + [('editar', 'Editar', ed)] + ([('noasistio', 'No asistió', 'al-noasistio')] if e == 'conf' else [])
        pie = [('x', 'Cancelar cita', 'al-cancelar')]
    lista = ''
    for icono, txt, ir in filas:
        if ir == 'sub':
            chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
            on = ' ag0-on' if conf_abierto else ''
            sub = ''
            if wa: sub += fila('whatsapp', 'Enviar por WhatsApp', ' data-ir="m-wa"')
            if correo: sub += fila('correo', 'Enviar por correo', ' data-ir="m-correo"')
            sub += fila('confirmar', 'Marcar como confirmada', ' data-ir="t-confirmada"')
            lista += (f'<button type="button" class="ag0-p ag0-op" aria-expanded="{"true" if conf_abierto else "false"}" data-sub="conf">'
                      f'{ic(I2[icono], 20, 2)}<span>Confirmar</span>{chev}</button>'
                      f'<div class="ag0-sub ab-sub{on}" role="group" aria-label="Confirmar la cita">{sub}</div>')
        else:
            lista += fila(icono, txt, f' data-ir="{ir}"')
    if msg:
        lista += f'<p class="ab-msg{" ab-msg-mal" if msg[1] else ""}"{" role=\"alert\"" if msg[1] else ""}>{msg[0]}</p>'
    if pie:
        lista += '<div class="ag0-sep" role="separator"></div>' + ''.join(fila(i, t, f' data-ir="{ir}"', 'ag0-op-mal') for i, t, ir in pie)
    lista = f'<div class="ag0-bu-l" role="toolbar" aria-label="Acciones de la cita" aria-orientation="vertical">{lista}</div>' if lista else '<span class="ab-fin"></span>'
    return f'<div class="ag0-bu" role="document">{cab}{nom}{ori}{det}{prin}{ayuda}{lista}</div>'

def tpl(key, capa, cuerpo, ancla=None, cls='', titulo=''):
    a = f' data-ancla="{ancla}"' if ancla else ''
    t = f' data-titulo="{H.escape(titulo)}"' if titulo else ''
    return f'<template data-t="{key}" data-capa="{capa}"{a} data-cls="{cls}"{t}>{cuerpo}</template>'

# ------------------------------------------------------------------ DESTINOS FUERA DE ESTA SECCIÓN (se resuelven con saltos) ------------------------------------------------------------------
def hueco_doc(titulo, texto, extra=''):
    return ''

DESTINOS = {k: ('', '') for k in ('d-editar', 'd-reagendar', 'd-otra', 'd-nota', 'd-consulta', 'd-convertir', 'd-form', 'd-form-editar', 'd-bloqueo', 'd-bloqueo-alta', 'd-ligar')}

def destinos():
    # Sin tarjetas de respaldo: el destino está en la página publicada (SALTOS) o el control no hace nada.
    return ''

# ------------------------------------------------------------------ ALERTAS (ConfirmModal: mensaje + «Cancelar» / «Aceptar») ------------------------------------------------------------------
def alerta(icono, tono, titulo, texto, botones, pila=False):
    t = f'<p class="ab-al-t">{texto}</p>' if texto else ''
    return (f'<div class="ab-al" role="alertdialog" aria-modal="true" aria-label="{H.escape(titulo)}"><span class="ab-al-i ab-i-{tono}">{ic(I2[icono], 28, 2)}</span>'
            f'<h2>{titulo}</h2>{t}<div class="ab-al-b{" ab-pila" if pila else ""}">{botones}</div></div>')

def alertas():
    # CALMA §29.3-4: principal con verbo concreto; «Volver» cuando la acción cancela algo, «Cancelar» en el resto
    can = b('Cancelar', 'qui', ' data-cierra="1"')
    vol = b('Volver', 'qui', ' data-cierra="1"')
    def ok(ir, k='mal', v='Aceptar'): return b(v, k, f' data-ir="{ir}"')
    out = ''
    out += tpl('al-cancelar', 'alerta', alerta('x', 'mal', '¿Cancelar la cita de Paciente Prueba 24?', 'El horario queda libre y la cita se queda en la agenda como cancelada.', vol + ok('t-cancelada', v='Cancelar cita')))
    out += tpl('al-noasistio', 'alerta', alerta('noasistio', 'ag', '¿Marcar que Paciente Prueba 12 no asistió?', 'La cita se queda en la agenda como «No asistió».', can + ok('t-noasistio', 'prim', 'No asistió')))
    out += tpl('al-eliminar-ev', 'alerta', alerta('papelera', 'mal', '¿Eliminar el evento «Junta de servicio»?', 'No se puede deshacer.', can + ok('t-eliminado', v='Eliminar evento')))
    out += tpl('al-eliminar-cita', 'alerta', alerta('papelera', 'mal', '¿Eliminar la cita cancelada de Paciente Prueba 08?', 'Sale de la agenda y no se puede deshacer; queda guardada en el historial.', can + ok('t-quitada', v='Eliminar cita')))
    out += tpl('al-fuera', 'alerta', alerta('triangulo', 'ag', '¿Es correcto?', 'Vas a agendar a las <span class="ag0-num" data-hh>20:00</span>, y esta clínica atiende de 08:00 a 20:00.', can + ok('alta-fuera', 'prim', 'Agendar')))
    out += tpl('al-domingo', 'alerta', alerta('triangulo', 'ag', '¿Es correcto?', 'Vas a agendar un domingo, y esta clínica no atiende domingos.', can + ok('alta-dom', 'prim', 'Agendar')))
    out += tpl('al-empalme', 'alerta', alerta('triangulo', 'ag', '¿Guardar de todos modos?', 'Se empalma con «Paciente Prueba 07» (17:00–17:30).', can + ok('acuse', 'prim', 'Guardar')))
    out += tpl('al-duplicado', 'alerta', alerta('usuario', 'ag', 'Paciente duplicado', 'Ya existe un paciente con los mismos datos: Paciente Prueba 24 (Exp. #EXP-2026-0024). ¿Es el mismo paciente o una persona distinta? Si es otra persona, se creará el registro de todos modos.',
               b('Es el mismo paciente', 'prim ab-pri', ' data-ir="alta-elegido"') + b('Es otra persona', 'ton', ' data-ir="alta-elegido"') + b('Cancelar', 'qui', ' data-cierra="1"'), pila=True))
    return out

# ------------------------------------------------------------------ MODALES DE LA VISTA 2 ------------------------------------------------------------------
def modal(icono, titulo, sub, cuerpo, pie, w='ab-w480'):
    s = f'<p>{sub}</p>' if sub else ''
    mi = f'<span class="ab-mi">{ic(I2[icono], 20, 2)}</span>' if icono else ''
    return f'<div class="ab-mo"><div class="ab-mc">{mi}<div><h2>{titulo}</h2>{s}</div>{x_btn()}</div><div class="ab-mb">{cuerpo}</div><div class="ab-mp">{pie}</div></div>'

def pregunta():
    filas = [('Paciente Prueba 20', 'Lun 16 nov · 09:00'), ('Paciente Prueba 21', 'Mar 17 nov · 13:00')]
    li = ''.join(f'<li class="ab-pa"><div class="ab-pa-t"><b>{n}</b><span class="ag0-num">{w}</span></div><div class="ab-pa-b">'
                 f'{b("Sí asistió", "ton", f" aria-label=\"Sí asistió: {n}, {w}\" data-ir=\"t-atendida\"")}'
                 f'{b("No asistió", "qui", f" aria-label=\"No asistió: {n}, {w}\" data-ir=\"t-noasistio-p\"")}</div></li>' for n, w in filas)
    return modal(None, '¿Asistió el paciente?', 'Más de 48 horas y sin nota clínica.', f'<ul class="ab-pal" aria-label="Citas por cerrar">{li}</ul>',
                 b('Decidir después', 'qui', ' data-cierra="1"'), 'ab-w480')

def invitacion(paso):
    intro = ('<p class="ab-txt">Quien invites queda añadido al evento en Google, y Google le manda la invitación por correo. No se ven el correo entre ellos, '
             'no pueden modificar nada y rechazar la invitación no cambia nada aquí. El médico asignado ya lo tiene en su calendario.</p>')
    casilla = ('<label class="ab-cas ab-cas-on"><span class="ab-cas-t"><b>Paciente Prueba 24</b><span>paciente24@semilla.spinus.test</span></span>'
               '<input type="checkbox" checked aria-label="Invitar a Paciente Prueba 24"></label>')
    otra = b('Invitar también a otra dirección', 'tx', ' data-ir="inv-otra"')
    campo = ('<label class="ab-campo"><span>Invitar a otra dirección (sólo para esta invitación)</span>'
             '<input class="ab-in" type="email" inputmode="email" placeholder="nombre@correo.com" value="familiar24@semilla.spinus.test"></label>')
    # Textos nuevos aprobados por el dueño: «No invitar» / «Invitar» (botones-desbordados.md)
    pie_e = b('No invitar', 'qui', ' data-cierra="1"') + b('Invitar', 'prim', ' data-ir="inv-enviado"', 'enviar')
    err = f'<p class="ab-err" role="alert">{ic(I2["triangulo"], 16, 2)}<span>No se pudo enviar la invitación.</span></p>'
    if paso == 'esperando':
        cu = ('<div class="ab-espera"><span class="ab-giro" aria-hidden="true"></span><p><b>Creando el evento en Google…</b></p></div>'
              '<p class="ab-txt">Ya está guardado en la agenda. Hay que esperar a que exista el evento en Google para poder invitar a alguien; suele tardar un par de segundos.</p>')
        return modal('correo', 'Invitar por correo', None, cu, b('No invitar', 'qui', ' data-cierra="1"'))
    if paso == 'sin':
        cu = (f'<p class="ab-avi">{ic(I2["triangulo"], 16, 2)}<span>El evento en Google no llegó a crearse, así que todavía no hay a qué invitar. '
              '<b>Lo agendado está guardado</b> y no se ha perdido nada. Vuelve a abrirlo en un rato y usa «Agregar invitados».</span></p>')
        return modal('correo', 'Invitar por correo', None, cu, b('Cerrar', 'qui', ' data-cierra="1"'))
    if paso == 'eligiendo':
        return modal('correo', 'Invitar por correo', None, intro + casilla + otra, pie_e)
    if paso == 'error':
        return modal('correo', 'Invitar por correo', None, intro + casilla + otra + err, pie_e)
    if paso == 'otra':
        return modal('correo', 'Invitar por correo', None, intro + casilla + campo, b('No invitar', 'qui', ' data-cierra="1"') + b('Invitar', 'prim', ' data-ir="inv-confirmando"', 'enviar'))
    if paso == 'confirmando':
        cu = ('<div class="ab-conf"><p>Vas a invitar a esta dirección escrita a mano</p><p class="ab-conf-d">familiar24@semilla.spinus.test</p>'
              '<p>Compruébala letra por letra. La invitación lleva el nombre completo del paciente en el título, y un correo enviado no se puede recuperar.</p></div>')
        return modal('correo', 'Invitar por correo', None, cu, b('Corregir', 'qui', ' data-ir="inv-otra"') + b('Sí, invitar ahí', 'prim', ' data-ir="inv-enviado"', 'enviar'))
    # enviado (con la dirección tecleada: ofrece guardarla en la ficha)
    cu = (f'<p class="ab-ok">{ic(I["palomita"], 16, 2.4)}<span>El paciente y la dirección que escribiste quedaron añadidos y Google les mandó la invitación por correo.</span></p>'
          '<p class="ab-txt">Google no confirma la entrega. Si alguien no la ve, pídele que revise su carpeta de <b>spam o correo no deseado</b>; puedes volver a invitarlo entrando de nuevo, no se duplica nada.</p>'
          '<div class="ab-guarda"><p>¿Guardas <b>familiar24@semilla.spinus.test</b> en la ficha de Paciente Prueba 24 para la próxima vez?</p>'
          f'<div class="ab-fila-b">{b("Guardar en la ficha", "ton", " data-ir=\"t-ficha\"")}{b("No, gracias", "tx", " data-ir=\"inv-enviado-sin\"")}</div></div>')
    if paso == 'enviado-sin':
        cu = cu[:cu.index('<div class="ab-guarda">')]
    return modal('correo', 'Invitar por correo', None, cu, b('Aceptar', 'prim', ' data-cierra="1"'))

# ------------------------------------------------------------------ LA BURBUJA DE ALTA (BurbujaAlta.tsx) ------------------------------------------------------------------
RES = [('20', '999 000 0020'), ('21', '999 000 0021'), ('22', '999 000 0022'), ('23', '999 000 0023'), ('24', '999 000 0024')]

def lista_pac(texto='Prueba 2', reg_txt=None, activa=None, buscando=False):
    li = ''
    if buscando:
        return f'<ul class="ab-lb" role="listbox" aria-label="Pacientes"><li class="ab-lb-b" role="status">Buscando...</li></ul>'
    for i, (n, t) in enumerate(RES):
        a = ' aria-selected="true"' if activa == i else ' aria-selected="false"'
        li += (f'<li role="option"{a} class="ab-op" data-ir="alta-elegido"><span class="ab-av">{n}</span><span class="ab-op-t"><b>Paciente Prueba {n}</b>'
               f'<span class="ag0-num">{t}</span></span></li>')
    rt = reg_txt or f'Registrar «{texto}»'
    li += (f'<li role="option" aria-selected="false" class="ab-op ab-op-reg" data-ir="registro"><span class="ab-av ab-av-mas">{ic(I["plus"], 16, 2.4)}</span>'
           f'<span class="ab-op-t"><b>{rt}</b><span>Crear paciente nuevo y continuar</span></span></li>')
    return f'<ul class="ab-lb" role="listbox" aria-label="Pacientes">{li}</ul>'

def alta(estado='vacio', titulo='Nueva cita · jue 19, 19:00–19:30', ini='19:00', fin='19:30', con_medico=False, error=None, obs=False):
    pac_val = 'Paciente Prueba 24' if estado in ('elegido', 'guardando') else ('Prueba 2' if estado in ('escribiendo', 'buscando') else '')
    exp = 'true' if estado in ('escribiendo', 'buscando') else 'false'
    campo = (f'<label class="ab-campo"><span>Paciente</span><input class="ab-in" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" placeholder="Buscar paciente por nombre o apellido..." '
             f'aria-expanded="{exp}" value="{pac_val}"></label>')
    lista = lista_pac(buscando=estado == 'buscando') if estado in ('escribiendo', 'buscando') else ''
    horas = (f'<div class="ab-dos"><label class="ab-campo"><span>Inicio</span><input class="ab-in ag0-num" type="text" inputmode="numeric" placeholder="hh:mm" value="{ini}" data-ini></label>'
             f'<label class="ab-campo"><span>Fin</span><input class="ab-in ag0-num" type="text" inputmode="numeric" placeholder="hh:mm" value="{fin}" data-fin></label></div>')
    med = ''
    if con_medico:
        med = ('<label class="ab-campo"><span>Médico</span><select class="ab-in ab-sel"><option value="">Elige el médico…</option>'
               '<option>Dr. Admin Semilla</option><option>Dra. Invitada Semilla</option></select></label>')
    if obs:
        ob = '<label class="ab-campo"><span>Observaciones</span><textarea class="ab-in ab-ta" rows="2" placeholder="Opcional"></textarea></label>'
    else:
        ob = f'<button type="button" class="ag0-p ab-b ab-tx ab-tx-d" aria-expanded="false" data-ir="alta-obs">{ic(I["plus"], 14, 2.4)}Añadir observaciones</button>'
    err = f'<p class="ab-err" role="alert">{ic(I2["triangulo"], 16, 2)}<span>{error}</span></p>' if error else ''
    guarda = 'Guardando…' if estado == 'guardando' else 'Guardar'
    dis = ' disabled aria-busy="true"' if estado == 'guardando' else ''
    ir_g = 'acuse' if estado in ('elegido',) else 'alta-err-pac'
    pie = (f'<div class="ab-ap">{b("Más opciones", "qui", " data-ir=\"d-form\"")}'
           f'<button type="button" class="ag0-p ab-b ab-prim" data-ir="{ir_g}"{dis}>{guarda}</button></div>')
    return (f'<div class="ab-alta" role="group" aria-label="Nueva cita"><div class="ag0-cjc"><h2 data-tit>{titulo}</h2>{x_btn()}</div>'
            f'<p class="ag0-sr" role="status"></p><div class="ab-ai">{campo}{lista}{horas}{med}{ob}{err}{pie}</div></div>')

def acuse(mensajes=False, invitar=True):
    m = ''
    if mensajes:
        m = '<p class="ab-msg ab-msg-a">Abierto en WhatsApp 17:12</p><p class="ab-msg ab-msg-a">Enviado por correo 17:12</p>'
    inv = fila('correo', 'Invitar por correo', ' data-ir="inv-eligiendo"') if invitar else ''
    return (f'<div class="ab-alta" role="group" aria-label="Cita agendada"><div class="ag0-cjc"><h2 data-tit>Nueva cita · jue 19, 19:00–19:30</h2>{x_btn()}</div>'
            f'<p class="ag0-sr" role="status">Cita agendada: Nueva cita · jue 19, 19:00–19:30</p>'
            f'<div class="ab-ai"><div class="ab-acuse"><span class="ab-acuse-i">{ic(I["palomita"], 18, 2.6)}</span><p><b>Cita agendada</b>'
            f'<span class="ag0-num">Paciente Prueba 24 · Jue 19 nov · 19:00 – 19:30</span></p></div>'
            f'{b("Listo", "prim ab-ancho", " data-cierra=\"1\"")}'
            f'<div class="ag0-bu-l ab-acl">{fila("whatsapp", "Enviar confirmación", " data-ir=\"m-wa\"")}{fila("correo", "Por correo", " data-ir=\"m-correo\"")}{inv}{m}</div>'
            f'{b("Más opciones", "tx ab-centro", " data-ir=\"d-form-editar\"")}</div></div>')

def registro(error=None):
    err = f'<p class="ab-err" role="alert">{ic(I2["triangulo"], 16, 2)}<span>{error}</span></p>' if error else ''
    nombre = '' if error == 'Nombre y apellidos son requeridos.' else 'Paciente'
    ap = '' if error == 'Nombre y apellidos son requeridos.' else 'Prueba 27'
    marcado = '' if error == 'Debes marcar el consentimiento del aviso de privacidad.' else ''
    cu = (f'{err}<div class="ab-dos"><label class="ab-campo"><span>Nombre</span><input class="ab-in" value="{nombre}"></label>'
          f'<label class="ab-campo"><span>Apellidos</span><input class="ab-in" value="{ap}"></label></div>'
          '<div class="ab-dos"><label class="ab-campo"><span>Fecha de nacimiento</span><input class="ab-in ag0-num" type="text" inputmode="numeric" placeholder="dd/mm/aaaa"></label>'
          '<label class="ab-campo"><span>Edad (opcional)</span><input class="ab-in" type="number" min="0" max="120" placeholder="Ej. 35"></label></div>'
          '<p class="ab-ayu">Si no conoces la fecha exacta, ingresa solo la edad</p>'
          '<label class="ab-campo"><span>Correo</span><input class="ab-in" type="email" placeholder="opcional"></label>'
          '<label class="ab-campo"><span>Teléfono celular o WhatsApp</span><input class="ab-in ag0-num" type="tel" placeholder="opcional · 999 123 4567"></label>'
          '<p class="ab-ayu">El expediente completo se puede editar después desde Pacientes.</p>'
          f'<label class="ab-priv"><span>Paciente informado del <a href="#" class="ab-a">aviso de privacidad</a></span><input type="checkbox"{marcado} aria-label="Paciente informado del aviso de privacidad"></label>')
    pie = b('Cancelar', 'qui', ' data-cierra="1"') + b('Crear y continuar', 'prim', ' data-ir="alta-elegido"')
    return modal('usuario', 'Registrar paciente', None, cu, pie, 'ab-w440')

# (Sin uso: en ext/tel «Agendar» salta al formulario completo publicado en la misma página.)
def form_tel(estado='vacio', tipo='cita'):
    def seg(k, txt, icono):
        s = 'true' if k == tipo else 'false'
        ir = {'cita': 'fs', 'evento': 'fs-evento', 'bloqueo': 'd-bloqueo-alta'}[k]
        return f'<button type="button" role="tab" class="ag0-p" aria-selected="{s}" data-ir="{ir}">{ic(I2[icono], 16, 2)}{txt}</button>'
    conm = (f'<div class="ab-campo"><span>Qué vas a crear</span><div class="ag0-seg ab-seg" role="tablist" aria-label="Tipo de lo que se va a crear">'
            f'{seg("cita", "Cita", "agenda")}{seg("evento", "Evento", "evento")}{seg("bloqueo", "Bloqueo", "ban")}</div></div>')
    if tipo == 'evento':
        ayuda = '<p class="ab-ayu">Un evento no lleva paciente ni expediente: cirugía, junta, congreso.</p>'
        resto = ''
        return _fs(conm + ayuda + resto, False)
    ayuda = '<p class="ab-ayu">Una cita va ligada a un paciente y a su expediente.</p>'
    if estado == 'elegido':
        pac = (f'<div class="ab-campo"><span>Paciente <i class="ab-req">*</i></span><div class="ab-pacc"><span class="ab-av">24</span><span class="ab-op-t"><b>Paciente Prueba 24</b>'
               f'<span class="ag0-num">999 000 0024</span></span><button type="button" class="ag0-p ag0-x" aria-label="Quitar paciente" data-ir="fs">{ic(I["x"], 18, 2)}</button></div></div>')
    else:
        val = 'Prueba 2' if estado == 'escribiendo' else ''
        pac = (f'<label class="ab-campo"><span>Paciente <i class="ab-req">*</i></span><input class="ab-in" placeholder="Buscar paciente por nombre o apellido..." value="{val}"></label>')
        if estado == 'escribiendo':
            pac += lista_pac(reg_txt='Registrar "Prueba 2"')
    resto = ''
    return _fs(conm + ayuda + pac + resto, estado == 'elegido')

def _fs(cuerpo, listo):
    dis = '' if listo else ' aria-disabled="true"'
    return (f'<div class="ab-fsw" role="dialog" aria-modal="true" aria-label="Nueva cita"><div class="ab-mc"><span class="ab-mi">{ic(I["agenda"], 20, 2)}</span><div><h2>Nueva cita</h2></div>{x_btn()}</div>'
            f'<div class="ab-mb">{cuerpo}</div><div class="ab-mp">{b("Cancelar", "qui", " data-cierra=\"1\"")}'
            f'<button type="button" class="ag0-p ab-b ab-prim"{dis} data-ir="{"t-agendada" if listo else "fs"}">Guardar</button></div></div>')

# ------------------------------------------------------------------ CONTENEDORES DE CAPA (piezas .ag0-capa de la base) ------------------------------------------------------------------
def capas(vp, menu=False):
    anc = ' ag0-anc' if vp == 'esc' else ''
    sv = ' ag0-sinvelo' if vp == 'esc' else ''
    def c(k, cls, velo=''):
        return (f'<div class="ag0-capa{velo}" data-capa="{k}" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
                f'<div class="ag0-cj {cls}" data-base="ag0-cj {cls}"><span class="ag0-asa" aria-hidden="true"></span><div class="ag0-cj-in ab-h"></div></div></div>')
    out = c('bu', 'ab-bucj' + anc, sv) + c('alta', 'ab-altacj' + anc, sv)
    if vp in ('ext', 'tel'): out += c('fs', 'ab-fscj')
    out += c('modal', 'ab-mocj') + c('alerta', 'ab-cjal')
    if menu: out += menu_opciones(vp).replace('Pop-up de eventos</span>', 'Pop-up de eventos</span>').replace('data-sw="1">' + ic(I['cursor'], 20, 2), 'data-sw="1" data-popup="1">' + ic(I['cursor'], 20, 2))
    return out + '<div class="ab-tsz" aria-live="polite"></div>'

def marco(v, vp, cont, extra):
    m = marco0('ab' + v, vp, cont, extra)
    return m.replace(f'class="marco ag0 ag0-vab{v}"', f'class="marco ab ag0 ab-v{v}"')

def fondo(vp, scroll=12.0, vista=None):
    """Pantalla de fondo: Día de hoy en teléfono; Semana (7 columnas) en Duo abierto y computadora."""
    if vista is None: vista = 'dia' if vp in ('ext', 'tel') else 'semana'
    bar, flota = barra(vp, vista)
    dias = [HOY] if vista == 'dia' else list(range(7))
    rj = rejilla(vp, dias, scroll=scroll)
    rj = rj.replace('aria-label="Curso de actualización, todo el día, evento"', 'aria-label="Curso de actualización, todo el día, evento" data-cita="td1"')
    return f'<main class="ag0-cont">{bar}{rj}{flota}</main>'

CSS = G['CSS'] + '\n' + open(f'{L}/tmp-ab.css').read()
JS = open(f'{L}/tmp-ab.js').read()

def salida(v, archivo, nombre, desc, marcos, ficha, tira, **extra):
    cfg = dict(v=v, ficha=ficha, tira=tira); cfg.update(extra)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = f'{L}/vista-{archivo}.html'
    open(p, 'w').write(out); print(p, len(out))

# ------------------------------------------------------------------ PLANTILLAS COMUNES DE LA BURBUJA ------------------------------------------------------------------
LIGAR = ('j8', 'j13', 'v2')

def plantillas_burbuja():
    t = ''
    for c in CITAS:
        if c['id'] in LIGAR:
            continue
        k = {}
        if c['id'] == 'o1': k = dict(medico=('IS', 'Dra. Invitada Semilla'), puede=False)
        if c['id'] == 'g1': k = dict(conv=True)
        t += tpl('b:' + c['id'], 'bu', burbuja(c, **k), ancla=c['id'], titulo=c['nom'])
    td = dict(id='td1', d=3, a=0, b=24, nom='Curso de actualización', e='ag', tipo='ev', ori='', obs=None, tel=None, cons=None)
    t += tpl('b:td1', 'bu', burbuja(td, todo=True), ancla='td1')
    # variantes de una misma cita
    v5 = POR_ID['v5']
    t += tpl('v5-abierto', 'bu', burbuja(v5, conf_abierto=True), ancla='v5')
    t += tpl('v5-wa', 'bu', burbuja(v5, conf_abierto=True, msg=('Abierto en WhatsApp 17:12', False)), ancla='v5')
    t += tpl('v5-correo', 'bu', burbuja(v5, conf_abierto=True, msg=('Enviado por correo 17:12', False)), ancla='v5')
    t += tpl('v5-error', 'bu', burbuja(v5, conf_abierto=True, msg=('No se pudo enviar el correo. Inténtalo de nuevo.', True)), ancla='v5')
    t += tpl('j10-abierto', 'bu', burbuja(POR_ID['j10'], conf_abierto=True), ancla='j10')
    t += tpl('p1-abierto', 'bu', burbuja(POR_ID['p1'], conf_abierto=True), ancla='p1')
    t += tpl('v1-destacar', 'bu', burbuja(POR_ID['v1'], destacar=True), ancla='v1')
    return t + destinos() + alertas()

def reasignar_tpl():
    # «Reasignar el horario»: la burbuja de alta en el hueco de la cancelada (13:00–13:15), sin paciente
    return tpl('reasignar', 'alta', alta(titulo='Nueva cita · jue 19, 13:00–13:15', ini='13:00', fin='13:15'), ancla='j6')

# =========================================================== VISTA 1 · LA BURBUJA ===========================================================
TOASTS = {
    't-cancelada': ['ok', 'Se canceló la cita'], 't-confirmada': ['ok', 'Estado cambiado a «Confirmada»'],
    't-noasistio': ['ok', 'Estado cambiado a «No asistió»'], 't-noasistio-p': ['ok', 'Estado cambiado a «No asistió»'],
    't-atendida': ['ok', 'Estado cambiado a «Atendida»'], 't-quitada': ['ok', 'Se quitó de la agenda'],
    't-eliminado': ['ok', 'Se eliminó de la agenda'], 't-agendada': ['ok', 'Se agendó correctamente'], 't-ficha': ['ok', 'Guardado en la ficha del paciente.'],
}
EST_COMUN = {k: dict(toast=[v]) for k, v in TOASTS.items()}
EST_COMUN.update({
    'm-wa': dict(t=['v5-wa'], cerrar=False), 'm-correo': dict(t=['v5-correo'], cerrar=False),
    'reasignar': dict(t=['reasignar']),
})
for k in DESTINOS: EST_COMUN[k] = dict(t=[k])
for k in ('al-cancelar', 'al-noasistio', 'al-eliminar-ev', 'al-eliminar-cita'): EST_COMUN[k] = dict(t=[k])
EST_COMUN['t-confirmada']['cerrar'] = True

def comunes(vp, alta_ya=False):
    """Todo lo que se puede alcanzar desde cualquier vista: burbujas, alertas, invitación, pregunta y la burbuja de alta."""
    t = plantillas_burbuja() + reasignar_tpl() + tpl('pregunta', 'modal', pregunta(), cls='ab-w480')
    for p in ('esperando', 'eligiendo', 'otra', 'confirmando', 'enviado', 'enviado-sin', 'sin', 'error'):
        t += tpl('inv-' + p, 'modal', invitacion(p), cls='ab-w480')
    if not alta_ya:
        t += plantillas_alta(vp)
    return t

def vista1(vp):
    return fondo(vp), capas(vp) + comunes(vp)

FICHA_1 = '''<h3>Especificación · la burbuja de la cita</h3>
<p><b>Qué es:</b> la tarjeta que abre tocar un bloque (BurbujaCita.tsx dentro de TarjetaLectura.tsx). Es una capa del catálogo con el contenido y las acciones EXACTAS de hoy (burbujaDeTarjeta, accionesTarjeta.ts:217-240). Lo que cambia es solo el dibujo: las tres acciones con fondo de hoy pasan a filas de menú con icono de color, la destructiva en rojo al final tras una línea (CALMA §28), y el estado es el icono en círculo del dashboard.</p>
<table><thead><tr><th></th><th>Duo cerrado</th><th>iPhone</th><th>Duo abierto (h / v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada en el área de contenido (310), con velo</td><td>hoja inferior con asa, arrastrable</td><td>tarjeta centrada (400), con velo</td><td>tarjeta de 360 ANCLADA al bloque, como hoy: a su derecha si cabe; si no, a la izquierda; si no, debajo o encima; nunca lo tapa pudiendo no taparlo (posicionCapa.ts). Sin velo: el toque fuera la cierra.</td></tr>
<tr><th>Nace de</th><td colspan="2">centro (escala .96 → 1 + fundido) · iPhone: borde inferior</td><td>centro</td><td>el bloque: <code>transform-origin</code> en el lado del bloque, a la altura del punto pulsado</td></tr>
<tr><th>Alto máx.</th><td>área − 32, cuerpo con desplazamiento interno</td><td>pantalla − barra de estado − 16</td><td>área − 32</td><td>ventana − 16 (posicionCapa: altoMaximo)</td></tr>
</tbody></table>
<h4>Contenido, en este orden</h4>
<ol><li>Cabecera: estado (icono en círculo + texto 12/600) y ✕ «Cerrar» (icono de 20, área 44; 36 en Duo h y computadora). Decisión del dueño: el ⋮ «Más opciones de la cita» de hoy sale de la cabecera; su acción (abrir el formulario completo) queda en la fila «Editar», que ahora llevan TODAS las burbujas, también atendida, cancelada y no asistió, donde hoy solo se llegaba por el ⋮.</li>
<li>Nombre 20/700 (tachado y en --tinta2 si está cancelada). Debajo, el origen con su marca: «Agendada desde Google Calendar» (G a color) o «Reservó por enlace» (textos unificados de CALMA §28; hoy «Llegó de Google Calendar» y «La apartó con tu enlace»).</li>
<li>Entre dos líneas: reloj + «16:00 – 17:00 · 60 min» (600 tabular) y el día largo; si el consultorio está en otro huso, «17:00–18:00 hora Quintana Roo»; médico con iniciales; «Observaciones:» en UNA línea con «…» (texto entero en el DOM y en <code>title</code>).</li>
<li>Botón principal según estado (44 de alto; 40 en Duo h y computadora): «Iniciar consulta» (agendada, confirmada, en curso, pasada; solo si quien mira es el médico de la cita), «Ver la consulta» en tonal (atendida), «Darle otra cita» (cancelada, no asistió) con su línea de ayuda.</li>
<li>Filas (48 de alto; 40 en computadora): agendada «Confirmar» ⌄ · «Reagendar» · «Editar»; confirmada «Reagendar» · «Editar» · «No asistió»; cancelada «Reasignar el horario» · «Editar»; atendida y no asistió «Editar»; evento «Editar» (+ «Convertir en cita» si nació en Google). «Confirmar» despliega «Enviar por WhatsApp», «Enviar por correo» y «Marcar como confirmada», cada una solo si aplica (ni pasada ni en curso para WhatsApp y correo). El mensaje de resultado («Abierto en WhatsApp 17:12», «Enviado por correo 17:12» o el error en rojo con <code>role=alert</code>) sale bajo lo desplegado.</li>
<li>Línea fina y la destructiva en --mal-tinta: «Cancelar cita», «Eliminar evento» o «Eliminar cita» (cancelada).</li></ol>
<h4>Comportamiento</h4>
<p><b>Resorte:</b> amortiguación 1, respuesta .35 s (aquí con <code>linear()</code>; en la app, resorte interrumpible de Motion). Salida 200 ms por el mismo camino. iPhone: la hoja se arrastra 1:1 desde el asa o la cabecera; al soltar se proyecta la inercia (deceleración .998): si pasa de la mitad o va a más de 600 px/s se cierra con la velocidad del dedo; si no, vuelve. Hacia arriba, rubber-band (.55). <b>Cierre:</b> ✕, Escape, toque fuera (en computadora, el toque sobre otro bloque abre ese). Una acción cierra la burbuja SIN salida animada: lo que abre (formulario, aviso) la tapa. <b>Foco y teclado:</b> diálogo modal nombrado por el paciente; foco en la primera acción; las acciones forman un <code>role=toolbar</code> con foco itinerante (flechas, Inicio, Fin; en lo desplegado, ↑/↓); Escape cierra primero lo desplegado y devuelve el foco a «Confirmar», y después la burbuja, devolviéndolo al bloque. <b>Movimiento reducido:</b> fundido de 200 ms sin escala ni desplazamiento. <b>Transparencia reducida:</b> velo opaco sin desenfoque.</p>
<h4>Variantes que no son burbuja</h4>
<p><b>Bloqueo:</b> hoy NO abre burbuja; abre su edición (ModalBloqueo). <b>Todo el día:</b> el chip abre la burbuja del evento; la hora sale «00:00 – 00:00 · 1440 min» porque la burbuja no distingue todo el día (ver informe). <b>Teléfono y consultorio:</b> ya no están en la burbuja desde la tanda M (se fueron con el panel «Más»); se ven en el bloque y en el formulario (⋮); lo que sí sale es la hora en el huso del consultorio. <b>Por ligar y Google por asignar:</b> tocar esos bloques lleva a su burbuja en la sección «Citas por ligar» de esta misma página. Si esa sección no está en la página, el toque no hace nada.</p>'''

TIRA_1 = [['agendada', 'b:v5'], ['confirmada · por enlace', 'b:j12'], ['en curso', 'b:j10'], ['atendida', 'b:j9'], ['cancelada', 'b:j6'], ['no asistió', 'b:j2'], '|',
          ['evento', 'b:j7'], ['evento con color', 'b:l4'], ['evento de Google', 'b:g1'], ['todo el día', 'b:td1'], ['bloqueo', 'b:bq1'], '|',
          ['con «Observaciones:»', 'b:v4'], ['consultorio en otro huso', 'b:v3'], ['de otro médico', 'b:o1'], ['pasada sin cerrar', 'b:p1'], ['origen Google', 'b:v1'], ['«Reagendar» destacado (desde un aviso)', 'v1-destacar'], '|',
          ['Confirmar desplegado', 'v5-abierto'], ['en curso: solo «Marcar»', 'j10-abierto'], ['enviado por WhatsApp', 'v5-wa'], ['enviado por correo', 'v5-correo'], ['error de envío', 'v5-error'], '|',
          ['por ligar (salta a su sección)', 'b:j8'], '|', ['Cerrar', 'cerrar']]

# =========================================================== VISTA 2 · PREGUNTAS Y CONFIRMACIONES ===========================================================
def vista2(vp):
    return fondo(vp), capas(vp) + comunes(vp)

FICHA_2 = '''<h3>Especificación · preguntas, confirmaciones y avisos breves</h3>
<p><b>Alerta de confirmación</b> (hoy <code>ConfirmModal</code>: solo el mensaje y «Cancelar» / «Aceptar»; CALMA §29.3-4: principal con verbo concreto y «Volver» al cancelar algo). Verbos: cancelar cita → «Volver» / «Cancelar cita»; no asistió → «Cancelar» / «No asistió»; eliminar evento → «Eliminar evento»; eliminar cita cancelada → «Eliminar cita»; fuera de horario y domingo → «Agendar»; empalme → «Guardar». Patrón único del catálogo: tarjeta centrada de 320 (teléfono) / 340 (ancho), radio 20, relleno 24, icono de 28 en círculo tintado de 48 (rojo para cancelar y eliminar, ámbar para «No asistió», fuera de horario y empalme), título 17/700 centrado, mensaje 14/20 justificado y dos botones del mismo ancho: «Cancelar» (quieto) a la izquierda, «Aceptar» a la derecha (rojo suave si destruye; relleno si no). Hoy la alerta no tiene título: el texto es EL MISMO, partido en dos — la pregunta arriba como título y el resto como mensaje. En iPhone también va centrada (no es hoja). Se abre desde las filas de la burbuja: «Cancelar cita», «No asistió», «Eliminar evento», «Eliminar cita» (pideConfirmacion). Foco en «Cancelar»; Escape y el velo = «Cancelar».</p>
<p><b>¿Asistió el paciente?</b> (PreguntaAsistencia.tsx). Sale sola al abrir la agenda si hay citas agendadas o confirmadas de hace más de 48 h sin nota. Modal de 480 (310 en Duo cerrado; hoja en iPhone) con «Más de 48 horas y sin nota clínica.», una fila por cita (nombre 15/600 + «Lun 16 nov · 09:00» 13 tabular) y dos botones por fila: «Sí asistió» (tonal) y «No asistió» (quieto); cada uno nombra en su <code>aria-label</code> a quién responde. Respondida, la fila sale y el foco va a «Decidir después». «Decidir después», ✕ y Escape cierran sin cambiar nada (vuelve a salir la próxima vez).</p>
<p><b>Invitar por correo</b> (ModalInvitacionCita.tsx): tras agendar con Google conectado. Modal de 480 con los botones nuevos aprobados «No invitar» / «Invitar» lado a lado: «Creando el evento en Google…» mientras espera (giro de 16 que en movimiento reducido es un punto fijo) → elegir (casilla del paciente con su correo; «Invitar también a otra dirección») → si la dirección se tecleó, el paso de comprobarla letra por letra («Corregir» / «Sí, invitar ahí») → acuse en verde con la pregunta de guardarla en la ficha («Guardar en la ficha» / «No, gracias») y «Aceptar». Sin evento: «Cerrar». Error en rojo con <code>role=alert</code>. Pie a la derecha (centrado en Duo abierto vertical), principal a la derecha.</p>
<p><b>Avisos breves</b> (patrón del catálogo, vista «Aviso breve»): arriba y centrados en el área de contenido, nunca bajo la franja; ancho hasta 400 (302 en Duo cerrado); radio 14; icono de 16 en círculo de 28; texto 14/20 600. Éxito e información 4 s; error 8 s. Entran desde arriba con resorte y salen por el mismo camino; el reloj se pausa con el puntero o el foco encima; ✕ «Cerrar aviso». Éxito <code>role=status</code>, error <code>role=alert</code>. Textos exactos de guardadoCitas.ts: «Se canceló la cita», «Estado cambiado a «Confirmada»», «Estado cambiado a «No asistió»», «Estado cambiado a «Atendida»», «Se quitó de la agenda», «Se eliminó de la agenda», «Se agendó correctamente», «Sincronizando con Google…», «Sin conexión con Google Calendar — se sincronizará pronto.», y los fallos «No se pudo cancelar», «No se pudo cambiar el estado», «No se pudo quitar de la agenda», «No se pudo eliminar».</p>'''

EST_2 = {
    'toast-err1': dict(toast=[['mal', 'No se pudo cancelar']]), 'toast-err2': dict(toast=[['mal', 'No se pudo cambiar el estado']]),
    'toast-err3': dict(toast=[['mal', 'No se pudo quitar de la agenda']]), 'toast-info': dict(toast=[['ton', 'Sincronizando con Google…']]),
    'toast-info2': dict(toast=[['ton', 'Sin conexión con Google Calendar — se sincronizará pronto.']]),
    'agendado': dict(t=['inv-esperando'], toast=[['ok', 'Se agendó correctamente'], ['ton', 'Sincronizando con Google…']]),
}
for p in ('esperando', 'eligiendo', 'otra', 'confirmando', 'enviado', 'enviado-sin', 'sin', 'error'):
    EST_2['inv-' + p] = dict(t=['inv-' + p])
EST_2['pregunta'] = dict(t=['pregunta'])

TIRA_2 = [['Cancelar cita', 'al-cancelar'], ['No asistió', 'al-noasistio'], ['Eliminar evento', 'al-eliminar-ev'], ['Eliminar cita (cancelada)', 'al-eliminar-cita'], '|',
          ['¿Asistió el paciente?', 'pregunta'], '|',
          ['tras agendar: avisos + «Creando el evento…»', 'agendado'], ['invitar: elegir', 'inv-eligiendo'], ['otra dirección', 'inv-otra'], ['comprobar dirección', 'inv-confirmando'],
          ['invitación enviada', 'inv-enviado'], ['sin evento de Google', 'inv-sin'], ['error al invitar', 'inv-error'], '|',
          ['aviso: cita cancelada', 't-cancelada'], ['aviso: confirmada', 't-confirmada'], ['aviso: no asistió', 't-noasistio'], ['aviso: atendida', 't-atendida'], ['aviso: quitada', 't-quitada'],
          ['aviso: eliminado', 't-eliminado'], ['aviso: sincronizando', 'toast-info'], ['aviso: sin conexión con Google', 'toast-info2'], ['aviso de error', 'toast-err1'], ['error de estado', 'toast-err2'], '|', ['Cerrar', 'cerrar']]

# =========================================================== VISTA 3 · LA BURBUJA DE ALTA ===========================================================
def vista3(vp):
    return fondo(vp, scroll=13), capas(vp) + plantillas_alta(vp) + comunes(vp, alta_ya=True)

def plantillas_alta(vp):
    tel = vp in ('ext', 'tel')
    t = ''
    if tel:
        return ''
        # En teléfono no se toca un hueco: «Agendar» (el «+» del riel o la píldora) abre el formulario completo.
        t += tpl('fs', 'fs', form_tel('vacio')) + tpl('fs-esc', 'fs', form_tel('escribiendo')) + tpl('fs-eleg', 'fs', form_tel('elegido'))
        t += tpl('fs-evento', 'fs', form_tel(tipo='evento'))
        for k in ('alta', 'alta-arr', 'alta-esc', 'alta-bus', 'alta-elegido', 'alta-med', 'alta-obs', 'alta-guardando', 'alta-mes', 'alta-fuera', 'alta-dom',
                  'alta-err-pac', 'alta-err-med', 'alta-err-cons', 'alta-err-horas', 'alta-err-fin'):
            base = {'alta-esc': 'fs-esc', 'alta-bus': 'fs-esc', 'alta-elegido': 'fs-eleg', 'alta-guardando': 'fs-eleg'}.get(k, 'fs')
            t += tpl(k, 'fs', form_tel({'fs-esc': 'escribiendo', 'fs-eleg': 'elegido'}.get(base, 'vacio')))
        t += tpl('acuse', 'fs', form_tel('elegido')) + tpl('acuse-msg', 'fs', form_tel('elegido'))
    else:
        A = dict(ancla='hueco')
        t += tpl('alta', 'alta', alta(), **A) + tpl('alta-arr', 'alta', alta(titulo='Nueva cita · jue 19, 19:00–20:00', fin='20:00'), **A)
        t += tpl('alta-esc', 'alta', alta('escribiendo'), **A) + tpl('alta-bus', 'alta', alta('buscando'), **A)
        t += tpl('alta-elegido', 'alta', alta('elegido'), **A) + tpl('alta-med', 'alta', alta('vacio', con_medico=True), **A)
        t += tpl('alta-obs', 'alta', alta('elegido', obs=True), **A) + tpl('alta-guardando', 'alta', alta('guardando'), **A)
        t += tpl('alta-mes', 'alta', alta(titulo='Nueva cita · jue 19', ini='', fin=''), ancla='mes')
        t += tpl('alta-fuera', 'alta', alta(titulo='Nueva cita · jue 19, 20:00–20:30', ini='20:00', fin='20:30'), **A)
        t += tpl('alta-dom', 'alta', alta(titulo='Nueva cita · dom 22, 10:00–10:30', ini='10:00', fin='10:30'), **A)
        for k, e in (('pac', 'Elige un paciente.'), ('med', 'Elige el médico.'), ('cons', 'El consultorio activo no es de este médico: usa «Más opciones».'),
                     ('horas', 'Escribe la hora de inicio y de fin.'), ('fin', 'La hora de fin tiene que ser posterior a la de inicio.')):
            kw = dict(error=e)
            if k == 'med': kw['con_medico'] = True
            if k == 'horas': kw.update(titulo='Nueva cita · jue 19', ini='', fin='')
            if k == 'fin': kw.update(estado='elegido', ini='19:30', fin='19:00', titulo='Nueva cita · jue 19, 19:30–19:00')
            if k == 'cons': kw['estado'] = 'elegido'
            t += tpl('alta-err-' + k, 'alta', alta(**kw), **A)
        t += tpl('acuse', 'alta', acuse(), **A) + tpl('acuse-msg', 'alta', acuse(mensajes=True), **A)
    t += tpl('registro', 'modal', registro(), cls='ab-w440')
    t += tpl('registro-e1', 'modal', registro('Nombre y apellidos son requeridos.'), cls='ab-w440')
    t += tpl('registro-e2', 'modal', registro('Debes marcar el consentimiento del aviso de privacidad.'), cls='ab-w440')
    return t

FICHA_3 = '''<h3>Especificación · la burbuja de alta (BurbujaAlta.tsx) y «Agendar»</h3>
<p><b>Dónde existe:</b> tocar o arrastrar un hueco de la rejilla, SOLO en Duo abierto y computadora (CALMA §28; en teléfono hoy no hay huecos). Al pulsar se dibuja el fantasma de la cita en su franja de 30 min (arrastrando, el tramo crece de 30 en 30; en Duo abierto, táctil, el arrastre exige mantener pulsado 1 s —longPressDelay por omisión de FullCalendar, CALMA §29.13—, un toque corto da 30 min) y la burbuja nace de él. Antes de abrirse, la agenda comprueba la suscripción y el horario: fuera de horario sale la alerta «Vas a agendar a las 20:00, y esta clínica atiende de 08:00 a 20:00. ¿Es correcto?» (en domingo, «Vas a agendar un domingo…»); un hueco dentro de un bloqueo abre la edición del bloqueo.</p>
<table><thead><tr><th></th><th>Duo abierto (h / v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta de 400 centrada con velo</td><td>tarjeta de 360 anclada al fantasma (a su derecha; si no cabe, a la izquierda), sin velo; toque fuera = cerrar</td></tr>
<tr><th>Campos</th><td colspan="2">alto 44 en táctiles con letra de 16 (40 / 15 en computadora), relleno --sup2, sin borde, contorno de 2 px --enlace al enfocar</td></tr></tbody></table>
<ol><li>Título «Nueva cita · jue 19, 19:00–19:30» (17/700, nombra el diálogo); desde una celda del Mes, «Nueva cita · jue 19» y horas en blanco. ✕.</li>
<li>«Paciente»: combobox con foco al abrir; a los 300 ms la lista (<code>listbox</code> «Pacientes») con avatar de número, nombre 15/600 y teléfono 13 tabular; mientras busca, «Buscando...»; la última opción siempre es «Registrar «Prueba 2»» / «Crear paciente nuevo y continuar», que abre «Registrar paciente» (el mismo QuickPatientModal del formulario: consentimiento obligatorio, duplicados) encima, con UN solo velo. Al crear, el paciente queda elegido y el foco en «Guardar».</li>
<li>«Inicio» y «Fin» (hora, pasos de 5 min; mover el inicio arrastra el fin con la misma duración). «Médico» con «Elige el médico…» solo con «Todos los médicos» y más de un médico.</li>
<li>«+ Añadir observaciones» (texto, discreto) → «Observaciones» con «Opcional».</li>
<li>Error en rojo con icono y <code>role=alert</code>, sobre el pie: «Elige un paciente.», «Elige el médico.», «El consultorio activo no es de este médico: usa «Más opciones».», «Escribe la hora de inicio y de fin.», «La hora de fin tiene que ser posterior a la de inicio.». Al guardar, el aviso de empalme «Se empalma con «Paciente Prueba 07» (17:00–17:30). ¿Guardar de todos modos?».</li>
<li>Pie: «Más opciones» (quieto, pasa TODO lo escrito al formulario completo, sección «Formulario de cita») y «Guardar» (principal, a la derecha; «Guardando…»).</li>
<li>Tras agendar la burbuja NO se cierra: ✓ «Cita agendada» + «Paciente Prueba 24 · Jue 19 nov · 19:00 – 19:30» (anunciado con <code>role=status</code>), «Listo» (principal, a todo el ancho, con el foco) y las filas «Enviar confirmación» (WhatsApp), «Por correo» e «Invitar por correo» (solo si habrá evento en Google y quien agenda puede invitar), cada una solo si aplica; sus mensajes debajo; «Más opciones» al pie como texto (edición de la cita creada).</li></ol>
<p><b>Duo cerrado e iPhone:</b> no hay hueco que tocar; «Agendar» (el «+» del riel en Duo cerrado, la píldora flotante en iPhone) abre el formulario completo: la maqueta salta a la sección «Formulario de cita» de esta página con el estado correspondiente abierto. «Agendar», «Más opciones», el lápiz, «Editar», «Reagendar», «Convertir en cita», «Bloqueo» y el bloqueo llevan igual a su pieza en esta misma página (desplazamiento + realce y su estado abierto). Si la sección destino no está en la página, el control no hace nada.</p>
<p><b>Movimiento:</b> el fantasma aparece con escala .96 → 1 en pointer-down; la burbuja crece desde él (resorte amortiguación 1, respuesta .35 s) y sale hacia él; «Más opciones» e «Invitar por correo» la cierran sin salida (lo nuevo la tapa). Movimiento reducido: fundido. Escape cierra; el foco vuelve a la rejilla. Tras cerrar «Registrar paciente», un escudo de 600 ms traga el segundo clic del doble clic (no visual).</p>'''

EST_3 = {k: dict(t=[k], hueco=True) for k in ('alta', 'alta-esc', 'alta-bus', 'alta-elegido', 'alta-med', 'alta-obs', 'alta-guardando',
                                              'alta-err-pac', 'alta-err-med', 'alta-err-cons', 'alta-err-horas', 'alta-err-fin', 'acuse', 'acuse-msg')}
EST_3['alta-arr'] = dict(t=['alta-arr'], hueco=[3, 19, 20])
EST_3['alta-mes'] = dict(t=['alta-mes'])
EST_3['alta-fuera'] = dict(t=['alta-fuera'], hueco=[3, 20, 20.5])
EST_3['alta-dom'] = dict(t=['alta-dom'], hueco=[6, 10, 10.5])
EST_3['fuera'] = dict(t=['al-fuera'], hueco=[3, 20, 20.5], soloAncho=True)
EST_3['domingo'] = dict(t=['al-domingo'], hueco=[6, 10, 10.5], soloAncho=True)
EST_3['empalme'] = dict(t=['alta-elegido', 'al-empalme'], hueco=True)
EST_3['registro'] = dict(t=['alta-esc', 'registro'], hueco=True)
EST_3['registro-e1'] = dict(t=['alta-esc', 'registro-e1'], hueco=True)
EST_3['registro-e2'] = dict(t=['alta-esc', 'registro-e2'], hueco=True)
EST_3['registro-dup'] = dict(t=['alta-esc', 'registro', 'al-duplicado'], hueco=True)
EST_3['inv-eligiendo'] = dict(t=['inv-eligiendo'])
EST_3['agendar'] = dict(t=['fs'], ancho=['d-form'])
EST_3['acuse']['telx'] = []; EST_3['acuse']['toastTel'] = [['ok', 'Se agendó correctamente']]
EST_3['acuse-msg']['telx'] = []; EST_3['acuse-msg']['toastTel'] = [['ok', 'Se agendó correctamente'], ['ton', 'Sincronizando con Google…']]
EST_3['fs'] = dict(t=['fs']); EST_3['fs-evento'] = dict(t=['fs-evento'])
EST_3['tel-esc'] = dict(t=['fs-esc'], ancho=['alta-esc'], hueco=True); EST_3['tel-eleg'] = dict(t=['fs-eleg'], ancho=['alta-elegido'], hueco=True)

TIRA_3 = [['tocar un hueco (19:00)', 'alta'], ['arrastrar 19:00–20:00', 'alta-arr'], ['desde el Mes (sin horas)', 'alta-mes'], '|',
          ['escribiendo: resultados', 'alta-esc'], ['buscando…', 'alta-bus'], ['paciente elegido', 'alta-elegido'], ['«Todos los médicos»: elegir médico', 'alta-med'],
          ['observaciones abiertas', 'alta-obs'], ['guardando', 'alta-guardando'], '|',
          ['error: paciente', 'alta-err-pac'], ['error: médico', 'alta-err-med'], ['error: consultorio', 'alta-err-cons'], ['error: horas', 'alta-err-horas'], ['error: fin', 'alta-err-fin'],
          ['antes de abrir: fuera de horario', 'fuera'], ['antes de abrir: domingo', 'domingo'], ['al guardar: empalme', 'empalme'], '|',
          ['registro rápido', 'registro'], ['registro: faltan datos', 'registro-e1'], ['registro: consentimiento', 'registro-e2'], ['registro: paciente duplicado', 'registro-dup'], '|',
          ['cita agendada', 'acuse'], ['agendada con mensajes', 'acuse-msg'], '|',
          ['«Agendar» (formulario en teléfono)', 'agendar'], ['formulario: buscando', 'tel-esc'], ['formulario: paciente elegido', 'tel-eleg'], ['formulario: Evento', 'fs-evento'], '|', ['Cerrar', 'cerrar']]

# =========================================================== VISTA 4 · LA TARJETA AL PASAR EL RATÓN ===========================================================
def vista4(vp):
    return fondo(vp, scroll=12), capas(vp, menu=True) + comunes(vp)

FICHA_4 = '''<h3>Especificación · la tarjeta al pasar el ratón («Pop-up de eventos»)</h3>
<p><b>Solo computadora con ratón</b> (<code>pointerType=mouse</code> y <code>(hover:hover) and (pointer:fine)</code>). En pantallas táctiles no existe: la burbuja sigue al toque (Duo cerrado, iPhone y Duo abierto lo muestran: el toque abre la burbuja normal). Pásale el ratón a un bloque de la computadora: tras <b>0,5 s de quietud</b> sobre él (cada movimiento reinicia la cuenta) se abre la MISMA burbuja, anclada al bloque. Se cierra <b>0,3 s</b> después de que el ratón sale del bloque y de la tarjeta (margen para cruzar los 8 px entre los dos). Nunca mientras se arrastra o se estira una cita; la cita pulsada no se vuelve a armar hasta salir de ella.</p>
<p><b>Diferencias con la de clic:</b> NO es modal (sin <code>aria-modal</code>, sin trampa de foco, no roba el foco ni lo devuelve); Escape la cierra desde cualquier sitio; un clic dentro que no caiga en un botón la <b>fija</b> (pasa a ser la de siempre, en su sitio y sin volver a entrar); clic en su bloque también la fija. Sin velo. Mismo dibujo: la única pista visual de que es «al pasar» es que no hay anillo de selección doble en el bloque hasta fijarla.</p>
<p><b>Interruptor:</b> «Pop-up de eventos» en «Opciones de la agenda» (engrane en computadora, «···» en táctiles), con interruptor de 40×24 a la derecha (<code>menuitemcheckbox</code>, no cierra el menú). Se guarda en este dispositivo. Apagado, pasar el ratón no abre nada.</p>
<p><b>Movimiento:</b> entra con fundido + escala .96 → 1 desde el lado del bloque (resorte amortiguación 1, respuesta .35 s); sale por el mismo camino en 200 ms. Movimiento reducido: fundido.</p>'''

EST_4 = {'paso': dict(t=['b:v5'], paso=True), 'fija': dict(t=['b:v5']), 'menu': dict(menu=True)}
TIRA_4 = [['al pasar sobre la cita (abierta 0,5 s después)', 'paso'], ['fijada con un clic', 'fija'], ['menú: «Pop-up de eventos»', 'menu'], ['interruptor apagado', 'tog:popup'], '|', ['Cerrar', 'cerrar']]

# Saltos a la pieza real en la misma página publicada (pub-ag-cita): sección (sufijos de data-op) + botón de su tira.
FC, FE, FR, FA, PL = ['form-cita', '1-cita'], ['form-evento-bloqueo', '2-evento-bloqueo'], ['form-reagendar', '3-reagendar'], ['form-confirmaciones', '4-confirmaciones'], ['ligado-por-ligar', '1-por-ligar']
SALTOS = {
    'd-editar': [FC, 'Editar cita agendada (07)'], 'd-editar-conf': [FC, 'Editar confirmada (10)'], 'd-editar-ev': [FE, 'Editar evento'],
    'd-reagendar': [FC, 'Editar cita agendada (07)'], 'd-reagendar-enl': [FR, 'Reagendar: datos'], 'd-otra': [FC, 'Nueva cita con paciente'],
    'd-convertir': [FR, 'abrir'], 'd-form': [FC, 'Nueva cita con paciente'], 'd-form-editar': [FC, 'Editar cita agendada (07)'],
    'd-bloqueo': [FE, 'Bloqueo de horario (editar)'], 'd-bloqueo-alta': [FE, 'Bloquear horario'],
    'b:j8': [PL, 'burbuja: reserva por enlace (26)'], 'b:v2': [PL, 'burbuja: reserva por enlace (26)'], 'b:j13': [PL, 'burbuja: Google por asignar'],
    'b:bq1': [FE, 'Bloqueo de horario (editar)'], 'b:bq2': [FE, 'Bloqueo de horario (editar)'],
    'agendar': [FC, 'Nueva cita'],
}
for k in ('fs', 'alta', 'alta-arr', 'alta-mes', 'alta-med', 'alta-obs', 'alta-err-pac', 'alta-err-med', 'alta-err-cons', 'alta-err-horas', 'alta-err-fin', 'alta-fuera', 'alta-dom', 'agendar'):
    SALTOS[k + '@tel'] = [FC, 'Nueva cita']
for k in ('fs-esc', 'tel-esc', 'alta-esc', 'alta-bus'): SALTOS[k + '@tel'] = [FC, 'buscando paciente']
for k in ('fs-eleg', 'tel-eleg', 'alta-elegido', 'alta-guardando'): SALTOS[k + '@tel'] = [FC, 'Nueva cita con paciente']
SALTOS['fs-evento'] = [FE, 'Nuevo evento']
for k in ('registro', 'registro-e1', 'registro-e2', 'registro-dup'): SALTOS[k + '@tel'] = [FC, 'Registrar paciente']
SALTOS['fuera@tel'] = [FA, 'fuera de horario']; SALTOS['domingo@tel'] = [FA, 'día sin consulta']; SALTOS['empalme@tel'] = [FA, 'empalme']
# «Iniciar consulta» y «Ver la consulta» salen de la agenda (nueva nota / expediente): cierran la burbuja
for k in ('d-nota', 'd-consulta'): EST_COMUN[k] = dict(t=[])

HORARIO = [list(G['HORARIO'][d]) if G['HORARIO'][d] else None for d in range(7)]
TODOS = dict(EST_COMUN); TODOS.update(EST_2); TODOS.update(EST_3); TODOS.update(EST_4)
COMUN = dict(dias=DIA_CORTO, horario=HORARIO, saltos=SALTOS)

salida('1', '1-burbuja', 'Agenda · La burbuja de la cita',
       'La burbuja de hoy, con las mismas acciones por estado, pasada al catálogo: filas de menú con icono de color en vez de tres botones con fondo, el estado con su icono en círculo, anclada al bloque en computadora, tarjeta centrada en Duo y hoja arrastrable en iPhone',
       [marco('1', vp, *vista1(vp)) for vp in VPS], FICHA_1, TIRA_1, estados=TODOS, **COMUN)
e2 = dict(EST_COMUN); e2.update(EST_2)
salida('2', '2-pregunta', 'Agenda · Preguntas y confirmaciones',
       'Lo que sale de la burbuja y de agendar: la confirmación de hoy («Cancelar» / «Aceptar») con la alerta única del catálogo, «¿Asistió el paciente?», la invitación por correo paso a paso y los avisos breves arriba, centrados en el área de contenido',
       [marco('2', vp, *vista2(vp)) for vp in VPS], FICHA_2, TIRA_2, estados=TODOS, **COMUN)
e3 = dict(EST_COMUN); e3.update(EST_3)
salida('3', '3-alta', 'Agenda · La burbuja de alta',
       'Tocar o arrastrar un hueco (Duo abierto y computadora) abre la burbuja de alta con paciente, horas y «Guardar», y tras agendar ofrece los envíos sin cerrarse; en teléfono «Agendar» abre el formulario, del que aquí se dibuja solo el alta',
       [marco('3', vp, *vista3(vp)) for vp in VPS], FICHA_3, TIRA_3, estados=TODOS, alta=True, **COMUN)
e4 = dict(EST_COMUN); e4.update(EST_4)
salida('4', '4-hover', 'Agenda · La tarjeta al pasar el ratón',
       'En computadora, dejar el ratón quieto medio segundo sobre una cita abre la misma burbuja sin robar el foco; un clic la fija; se apaga con «Pop-up de eventos» en Opciones de la agenda',
       [marco('4', vp, *vista4(vp)) for vp in VPS], FICHA_4, TIRA_4, estados=TODOS, hover=True, **COMUN)
