# Agenda · Formulario (fase 2). Uso: python3 tmp-af-gen.py → vista-1…4.html
# Reutiliza las piezas base de ../agenda-base (navegación, barra, rejilla, bloque, estados) SIN escribir nada allí:
# se ejecuta solo la parte de definiciones de su tmp-gen.py.
import os, re, json, html
A = os.path.dirname(os.path.abspath(__file__))
B = os.path.normpath(os.path.join(A, '..', 'agenda-base'))
_src = open(B + '/tmp-gen.py').read()
_src = _src[:_src.index('import importlib.util')]
G = {'__file__': B + '/tmp-gen.py', '__name__': 'ag0base'}
exec(compile(_src, B + '/tmp-gen.py', 'exec'), G)
ic, I, est, rejilla, barra, riel, lateral, encabezado, enc_iv, gcal, sinexp = (G[k] for k in ('ic', 'I', 'est', 'rejilla', 'barra', 'riel', 'lateral', 'encabezado', 'enc_iv', 'gcal', 'sinexp'))
HOY = G['HOY']
VPS = ('ext', 'tel', 'ih', 'iv', 'esc')
ANCHO = ('ih', 'iv', 'esc')

# ------------------------------------------------------------------ CSS: piezas base dentro de .af ------------------------------------------------------------------
def scope(css):
    css = re.sub(r'(?<![\w-])\.ag0-(tira|ficha|tsep|lado|gem|rotA)\b', r'.af .ag0-\1', css)
    css = re.sub(r'(?<![\w-])\.ag0(?=[\s\[\.:>#,{])', '.af.ag0', css)
    # el reinicio de elementos baja a especificidad de clase (:where) para que los botones de .af no pierdan su fondo
    css = re.sub(r'\.af\.ag0 (button|h1|h2|h3|p|ul|ol|dl|dd|svg)(?=[,{])', r'.af.ag0 :where(\1)', css)
    css = css.replace('(muestra; la completa la hace otro agente)', '(muestra)')
    return css
def scope_v(css, n):
    return re.sub(r'(?<![\w-])\.af(?=[\s.\[:])', f'.af.af-v{n}', css)
CSS_BASE = scope(G['CSS'])
CSS_AF = open(A + '/tmp-af-estilo.css').read()
JS = open(A + '/tmp-af-guion.js').read()

# ------------------------------------------------------------------ ICONOS propios ------------------------------------------------------------------
J = dict(I)
J.update(
    estet=I['iniciar'], exp=I['docs'], buscar=I['lupa'],
    calx='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4"/>',
    calmas='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    ban='<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    aviso='<path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17h.01"/>',
    ok='<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8 5.2-5.6"/>',
    detalles='<path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    avisar='<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    invitados=I['junta'], enviar='<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    persona=I['medico'], chev='<path d="m9 6 6 6-6 6"/>', check='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    cirugia='<path d="M4 20 14 10"/><path d="m14 10 5.2-5.2a2.1 2.1 0 0 1 3 3L17 13z"/>',
    instrumental='<path d="M14.7 6.3a4 4 0 0 0 5 5L11.5 19.5a2.1 2.1 0 0 1-3-3z"/><path d="M4 4l4.5 4.5"/>',
    internamiento='<path d="M3 6v14M3 16h18v4M21 16v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="12" r="2"/>',
    ronda='<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    columna='<rect x="8" y="2.5" width="8" height="4.5" rx="1.5"/><rect x="8" y="9.75" width="8" height="4.5" rx="1.5"/><rect x="8" y="17" width="8" height="4.5" rx="1.5"/>',
    ortopedia='<path d="M17 10c.7.7 2.3.6 3-.5a2 2 0 0 0-2.5-2.9 2 2 0 0 0-2.9-2.5c-1.1.7-1.2 2.3-.5 3L7 14.9c-.7-.7-2.3-.6-3 .5a2 2 0 0 0 2.5 2.9 2 2 0 0 0 2.9 2.5c1.1-.7 1.2-2.3.5-3z"/>',
    ultrasonido='<path d="M2.5 12c2-3 4-3 6 0s4 3 6 0 4-3 6.5 0"/><path d="M6 17.5c2-1.6 4-1.6 6 0M12 6.5c2 1.6 4 1.6 6 0"/>',
    rehabilitacion='<path d="M3 12h4l3-7.5 4 15 3-7.5h4"/>',
    laboratorio='<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
    vacuna='<path d="m17 3 4 4M19 5l-9.5 9.5M14 6.5l3.5 3.5M7.5 12.5l4 4M3 21l4-4M6.5 13.5l4 4"/>',
    videollamada='<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
    congreso='<rect x="3" y="4" width="18" height="11.5" rx="2"/><path d="M12 15.5V20M8 20h8"/>',
    viaje='<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 13h18"/>',
    comida='<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 6 0 8v10"/>',
    personal=I['medico'],
)
ICONOS_EVENTO = [('cirugia', 'Cirugía'), ('instrumental', 'Instrumental'), ('urgencias', 'Urgencias'), ('internamiento', 'Internamiento'), ('ronda', 'Ronda hospitalaria'),
                 ('columna', 'Columna'), ('ortopedia', 'Ortopedia'), ('imagen', 'Imagenología'), ('ultrasonido', 'Ultrasonido'), ('rehabilitacion', 'Rehabilitación'),
                 ('laboratorio', 'Laboratorio'), ('vacuna', 'Vacunación'), ('junta', 'Junta'), ('videollamada', 'Videollamada'), ('docencia', 'Docencia'),
                 ('congreso', 'Congreso'), ('viaje', 'Viaje'), ('comida', 'Comida'), ('personal', 'Personal'), ('bloqueo', 'Bloqueo de horario')]
J['bloqueo'] = J['ban']
COLORES = [('indigo', 'Índigo'), ('magenta', 'Magenta'), ('carmin', 'Carmín'), ('oliva', 'Oliva'), ('bronce', 'Bronce'), ('grafito', 'Grafito')]
AVC = {'07': 'var(--d-receta)', '10': 'var(--d-laboratorio)', '12': 'var(--d-imagen)', '21': 'var(--d-honorarios)', '01': 'var(--d-escrito)', '02': 'var(--d-consentimiento)', '03': 'var(--d-laboratorio)', '04': 'var(--d-internamiento)', '20': 'var(--d-suplementacion)', '22': 'var(--d-internamiento)'}

def esc_(t): return html.escape(t, quote=True)
def ii(k, s=20, w=2): return ic(J[k], s, w)

# ------------------------------------------------------------------ PIEZAS DE FORMULARIO ------------------------------------------------------------------
def ast(req): return ' <span class="af-ast" aria-hidden="true">*</span>' if req else ''
def gr(t, i, cuerpo, pie='', cls='', attrs=''):
    tit = f'<h3 class="af-gt">{ii(i, 16, 2.2)}{t}</h3>' if t else ''
    return f'<section class="af-gr {cls}"{attrs}>{tit}<div class="af-sup">{cuerpo}</div>{pie}</section>'
def fila(l, c, cls='', req=False, tag='label'):
    return f'<{tag} class="af-f {cls}"><span class="af-l">{l}{ast(req)}</span><span class="af-c">{c}</span></{tag}>'
def inp(v='', ph='', extra=''):
    return f'<input class="af-in" value="{esc_(v)}" placeholder="{esc_(ph)}"{extra}>'
def sel(opts, elegido=None, dis=False, lab=''):
    o = ''.join(f'<option{" selected" if x == elegido else ""}>{esc_(x)}</option>' for x in opts)
    d = ' disabled' if dis else ''
    return f'<span class="af-sel"><select class="af-in"{d} aria-label="{lab}">{o}</select>{ic(I["abajo"], 16, 2.2)}</span>'
def pil(v, lab, vacia=False, dis=False):
    d = ' disabled' if dis else ''
    return f'<button type="button" class="af-p af-pil{" af-pil-vacia" if vacia else ""}" aria-label="{lab}: {v}"{d}>{v}</button>'
def fecha(l, v, dis=False, vacia=False):
    return f'<div class="af-f af-fi{" af-dis" if dis else ""}"><span class="af-l">{l}</span><span class="af-c">{pil(v, l, vacia, dis)}</span></div>'
def ac(i, t, sub='', cls='', chev=True, attrs='', msg=''):
    s = f'<small>{sub}</small>' if sub else ''
    m = msg
    c = ic(J['chev'], 16, 2.2).replace('aria-hidden', 'class="af-chev" aria-hidden') if chev else ''
    return f'<button type="button" class="af-p af-ac {cls}"{attrs}>{ii(i, 20, 2)}<span>{t}{s}{m}</span>{c}</button>'
def av(n, s=''):
    return f'<span class="af-av {s}" style="--av:{AVC.get(n, "var(--d-escrito)")}" aria-hidden="true">{n}</span>'
def b(t, cls='af-qui', attrs=''):
    return f'<button type="button" class="af-p af-b {cls}"{attrs}>{t}</button>'
def x(lab='Cerrar'):
    return f'<button type="button" class="af-p af-x" data-cierra="1" aria-label="{lab}">{ic(I["x"], 20, 2)}</button>'
def err(t, cls=''):
    return f'<p class="af-err {cls}" role="alert">{ii("aviso", 16, 2.2)}<span>{t}</span></p>'
def pieg(t, cls=''):
    return f'<p class="af-pieg {cls}">{t}</p>'
def sw(on=False, lab='', dis=False):
    return f'<button type="button" class="af-p af-sw" role="switch" aria-checked="{"true" if on else "false"}" aria-label="{lab}"{" disabled" if dis else ""}></button>'

DURS = ['15 min', '30 min', '45 min', '1 hora', '1:30 h', '2 horas']
def duracion(elegida):
    ch = ''.join(f'<button type="button" class="af-p af-ch" role="radio" aria-checked="{"true" if d == elegida else "false"}">{d}</button>' for d in DURS)
    return f'<div class="af-f af-fw"><span class="af-l">Duración</span><div class="af-chs" role="radiogroup" aria-label="Duración">{ch}</div></div>'
TIPOS = [('Sin tipo', None, None), ('Primera vez', 'indigo', 45), ('Seguimiento', 'oliva', 30)]
def tipo_cita(elegido='Sin tipo', uid=''):
    ch = ''
    for n, c, d in TIPOS:
        pt = f'<span class="af-pt" style="background:var(--cal-ev-{c})" aria-hidden="true"></span>' if c else ''
        du = f'<small>· {d} min</small>' if d else ''
        ch += f'<button type="button" class="af-p af-ch" role="radio" aria-checked="{"true" if n == elegido else "false"}">{pt}{n}{du}</button>'
    return f'<div class="af-f af-fw"><span class="af-l" id="{uid}-tipo">Tipo de cita</span><div class="af-chs af-chs-l" role="radiogroup" aria-labelledby="{uid}-tipo">{ch}</div></div>'
EST_K = [('ag', 'Agendada'), ('conf', 'Confirmada'), ('canc', 'Cancelada'), ('noas', 'No asistió'), ('aten', 'Atendida')]
def estado(elegido, evento=False):
    ks = [k for k in EST_K if (not evento or k[0] in ('ag', 'canc'))]
    ch = ''.join(f'<button type="button" class="af-p af-es af-es-{k}" role="radio" aria-checked="{"true" if k == elegido else "false"}">{est(k)}</button>' for k, t in ks)
    return f'<div class="af-f af-fw"><span class="af-l">Estado</span><div class="af-ests{" af-ests-2" if evento else ""}" role="radiogroup" aria-label="Estado">{ch}</div></div>'
MEDICOS = ['Sin asignar', 'Dr. Admin Semilla', 'Dra. Invitada Semilla']
CONS = ['— Selecciona consultorio —', 'Centro (default)', 'Hosp Norte', 'Rehab']
def medico(dis=False, cls='af-x-med'):
    return fila('Médico', sel(MEDICOS, 'Dr. Admin Semilla', dis, 'Médico'), cls + (' af-dis' if dis else ''))
def consultorio(v='Centro (default)', dis=False):
    return fila('Consultorio', sel(CONS, v, dis, 'Consultorio'), 'af-dis' if dis else '', True)
def notas(v=''):
    return fila('Notas', f'<textarea class="af-in" rows="2" placeholder="Instrucciones, observaciones...">{esc_(v)}</textarea>', 'af-ta')

def selector(activo, uid, bloqueada_cita=False):
    def t(k, i, tx):
        sel_ = 'true' if k == activo else 'false'
        dis = ' disabled aria-describedby="' + uid + '-qvb"' if (k == 'cita' and bloqueada_cita) else ''
        extra = ' data-alta-bloqueo' if k == 'bloqueo' else ''
        return f'<button type="button" role="tab" class="af-p" aria-selected="{sel_}" data-tipo="{k}"{dis}{extra}>{ii(i, 16, 2.2)}{tx}</button>'
    ay = ('Un evento no lleva paciente ni expediente: cirugía, junta, congreso.' if activo == 'evento' else 'Una cita va ligada a un paciente y a su expediente.')
    if bloqueada_cita: ay += '<br><span class="af-ayb" id="' + uid + '-qvb">Un evento de todo el día no puede ser una cita.</span>'
    return (f'<div class="af-qv"><span class="af-l" id="{uid}-qv">Qué vas a crear</span>'
            f'<div class="af-seg" role="tablist" aria-label="Tipo de lo que se va a crear">{t("cita", "agenda", "Cita")}{t("evento", "calmas", "Evento")}{t("bloqueo", "ban", "Bloqueo")}</div>'
            f'<p class="af-ayq">{ay}</p></div>')

# ---- Paciente ----
RES = [('02', 'Paciente Prueba 02', '999 000 0002'), ('20', 'Paciente Prueba 20', '999 000 0020'), ('21', 'Paciente Prueba 21', '999 000 0021'), ('22', 'Paciente Prueba 22', '999 000 0022')]
def pac_buscar():
    filas = ''.join(f'<button type="button" class="af-p af-op" data-elige="pac">{av(n, "af-av-s")}<span class="af-pac-t"><span class="af-pac-n">{nom}</span><span class="af-pac-s">{tel}</span></span></button>' for n, nom, tel in RES)
    reg = (f'<button type="button" class="af-p af-op af-op-reg" data-abre="reg"><span class="af-av af-av-s" aria-hidden="true">{ic(I["plus"], 16, 2.4)}</span>'
           f'<span class="af-pac-t"><span class="af-pac-n">Registrar "<span class="af-eco">Paciente Prueba 2</span>"</span><span class="af-pac-s">Crear nuevo paciente y continuar</span></span></button>')
    return (f'<label class="af-bus">{ii("buscar", 20, 2)}<input class="af-in af-in-bus" value="" placeholder="Buscar paciente por nombre o apellido..." autocomplete="off"></label>'
            f'<div class="af-lista"><p class="af-busc af-x-busc">'
            f'<span class="af-gira" aria-hidden="true"></span>Buscando...</p><div class="af-x-res" style="display:contents">{filas}</div>{reg}</div>')
def pac_card(n, nom, tel, quitar):
    return (f'<div class="af-pac">{av(n)}<span class="af-pac-t"><span class="af-pac-n">{nom}</span><span class="af-pac-s">{tel}</span></span>'
            f'<button type="button" class="af-p af-x" data-quita="pac" aria-label="{quitar}">{ic(I["x"], 18, 2.2)}</button></div>')

def pie_cita(guardar_dis=False):
    d = ' disabled' if guardar_dis else ''
    return (f'{b("Cancelar", "af-qui", " data-cierra=\"1\"")}'
            f'<button type="button" class="af-p af-b af-prim af-guardar"{d}><span class="af-gtx">Guardar</span><span class="af-gira af-x-guard" aria-hidden="true"></span></button>')

def avisar(conf=False, abierto=''):
    wa = 'Enviar recordatorio' if conf else 'Enviar confirmación'
    co = 'Enviar recordatorio por correo' if conf else 'Enviar confirmación por correo'
    m_wa = f'<small class="af-x-wa0">{abierto}</small>' if abierto else ''
    cuerpo = (ac('whatsapp', f'<span class="af-x-wa-t">{wa}</span><span class="af-x-wa-p">Preparando…</span>', '', 'af-ac-ok af-wa', False,
                 msg=m_wa + '<small class="af-x-waok">Abierto en WhatsApp 17:12</small><small class="af-x-waerr af-msg-mal" role="alert">La cita no tiene teléfono.</small>')
              + ac('correo', f'<span class="af-x-co-t">{co}</span><span class="af-x-co-p">Enviando…</span>', '', 'af-co', False,
                   msg='<small class="af-x-cook">Enviado por correo 17:12</small><small class="af-x-coerr af-msg-mal" role="alert">El paciente no tiene correo registrado.</small>'))
    return gr('Avisar al paciente', 'avisar', cuerpo)
def invitados():
    cuerpo = ac('correo', 'Agregar invitados', '', 'af-inv', False, attrs=' data-abre="inv"')
    return gr('Invitados', 'invitados', cuerpo, pieg('Esta cita todavía no tiene evento en Google, así que no hay a qué invitar. Ocurre cuando la clínica no tiene Google Calendar conectado, o cuando su calendario aún no existe — quien administra lo crea al abrir la agenda.', 'af-x-sinev'))
def destructiva(t, i, t2, al='del-canc'):
    cuerpo = ac(i, f'<span class="af-x-del-t">{t}</span><span class="af-x-del-p"><span class="af-gira" aria-hidden="true" style="display:inline-block;vertical-align:-3px;margin-right:8px"></span>{t2}</span>', '', 'af-ac-mal', False, attrs=f' aria-label="{t}" data-al="{al}" aria-haspopup="dialog"')
    return f'<section class="af-gr"><div class="af-sup">{cuerpo}</div></section>'

def fechas(ini, hi, fin, hf, dur, dis_ini=False, sin_dur=False, todo=False):
    if todo:
        f_ = fecha('Primer día', ini) + fecha('Último día', fin)
    else:
        f_ = fecha('Fecha de inicio', ini, dis_ini) + fecha('Hora de inicio', hi, dis_ini) + fecha('Fecha de fin', fin) + fecha('Hora de fin', hf)
    e1 = err_html_todo() if todo else err('La hora de fin tiene que ir después de la de inicio.', 'af-x-err')
    e = e1 + err('Este horario está bloqueado. Quita el bloqueo para agendar aquí.', 'af-x-err')
    f_ += f'<div class="af-ferr af-x-err">{e}</div>'
    if not todo and not sin_dur: f_ += duracion(dur)
    return f_, ''
def err_html_todo(): return err('El último día no puede ir antes del primero.', 'af-x-err')

# ---- Cuerpos del formulario de cita (AppointmentModal) ----
def form_cita(m, uid):
    """m: crear | lleno | editar | conf | reserva | google. Devuelve (titulo, cuerpo, pie)."""
    G_ = []
    if m in ('crear', 'lleno'):
        G_.append(selector('cita', uid))
    # Paciente
    if m == 'crear':
        G_.append(gr('Paciente', 'persona', pac_buscar(), cls='af-pgc', attrs=' data-req="1"'))
    elif m == 'lleno':
        G_.append(gr('Paciente', 'persona', pac_card('07', 'Paciente Prueba 07', '999 000 0007', 'Quitar paciente')))
    elif m in ('editar', 'conf'):
        n, nom = ('07', 'Paciente Prueba 07') if m == 'editar' else ('10', 'Paciente Prueba 10')
        cu = pac_card(n, nom, f'999 000 00{n}', 'Quitar paciente y cancelar la cita') + ac('estet', 'Iniciar consulta', attrs=' aria-label="Iniciar consulta"') + ac('exp', 'Expediente')
        G_.append(gr('Paciente', 'persona', cu))
    elif m == 'reserva':
        res = (f'<div class="af-res"><div class="af-mrc"><span class="af-mr" role="img" aria-label="Sin expediente: este paciente aún no tiene expediente">{sinexp(14)}Sin expediente</span><span class="af-mr">{ii("enlace", 14, 2)}Reservó por enlace</span></div>'
               f'<span class="af-pac-n">Paciente Prueba 21</span><span class="af-pac-s">999 000 0021 · paciente21@semilla.spinus.test</span>'
               f'<span class="af-pac-s af-x-hist0">Sin cancelaciones ni inasistencias recientes con este médico</span>'
               f'<span class="af-pac-s af-x-hist1">Con este médico: 2 cancelaciones</span><span class="af-res-aviso af-x-hist1">Bloqueado para reservar por el enlace hasta el 3 dic 2026</span>'
               f'<span class="af-res-b"><span class="af-pac-s">Se liga a un paciente al iniciar la consulta.</span><button type="button" class="af-p af-tx" data-bloquea="1"><span class="af-x-hist0">Bloquear contacto</span><span class="af-x-hist1">Desbloquear contacto</span></button></span></div>')
        cu = res + ac('enlace', 'Iniciar consulta', 'Primero se liga a un paciente', attrs=' aria-label="Iniciar consulta: primero se liga a un paciente" data-ligar="reserva" aria-haspopup="dialog"')
        G_.append(gr('Paciente', 'persona', cu))
    elif m == 'google':
        cu = (f'<div class="af-cuad"><div class="af-cuad-f">{gcal(18)}<p>Evento nuevo de Google, por asignar: se liga a un paciente al iniciar la consulta.</p></div>'
              f'<button type="button" class="af-p af-b af-ton" data-noescita="1" aria-describedby="{uid}-noes">¿No es una cita?</button><p class="af-ayb" id="{uid}-noes">Dejarlo como evento sin paciente: deja de pedir que se ligue</p></div>'
              + ac('enlace', 'Iniciar consulta', 'Primero se liga a un paciente', attrs=' aria-label="Iniciar consulta: primero se liga a un paciente" data-ligar="google" aria-haspopup="dialog"'))
        G_.append(gr('Paciente', 'persona', cu))
    # Fecha y hora
    if m == 'crear' or m == 'lleno':
        f_, e = fechas('19/11/2026', '19:00', '19/11/2026', '20:00', '1 hora')
    elif m == 'editar':
        f_, e = fechas('19/11/2026', '17:00', '19/11/2026', '17:30', '30 min')
    elif m == 'conf':
        f_, e = fechas('19/11/2026', '17:30', '19/11/2026', '17:45', '15 min')
    elif m == 'reserva':
        f_, e = fechas('20/11/2026', '09:00', '20/11/2026', '09:30', '', dis_ini=True, sin_dur=True)
        f_ = (f'<div class="af-cuad af-elec"><p>El paciente eligió médico, consultorio, día y hora al reservar por enlace. Para cambiarlos usa «Reagendar», que le avisa; la duración sí puedes ajustarla.</p>'
              f'<button type="button" class="af-p af-b af-ton" data-reagendar="1">{ii("reagendar", 18, 2)}Reagendar</button></div>' + f_)
    else:
        f_, e = fechas('19/11/2026', '18:20', '19/11/2026', '18:50', '30 min')
    G_.append(gr('Fecha y hora', 'reloj', f_, e))
    # Detalles
    d = ''
    if m in ('lleno', 'editar', 'conf', 'reserva'):
        d += tipo_cita('Primera vez' if m == 'editar' else 'Sin tipo', uid + m)
    if m in ('editar', 'conf', 'reserva', 'google'):
        d += estado({'editar': 'ag', 'conf': 'conf', 'reserva': 'ag', 'google': 'ag'}[m])
    d += medico(dis=(m == 'reserva'))
    d += consultorio('— Selecciona consultorio —' if m == 'google' else 'Centro (default)', dis=(m == 'reserva'))
    d += notas({'editar': 'Gonalgia, primera vez', 'conf': 'Nota ficticia de seguimiento'}.get(m, ''))
    G_.append(gr('Detalles', 'detalles', d))
    if m in ('editar', 'conf', 'reserva'):
        G_.append(avisar(m == 'conf', 'Abierto en WhatsApp 16:40' if m == 'conf' else ''))
    if m in ('editar', 'conf', 'reserva', 'google'):
        G_.append(invitados())
        G_.append(destructiva('Cancelar cita', 'calx', 'Cancelando cita'))
    tit = 'Nueva cita' if m in ('crear', 'lleno') else 'Editar cita'
    return tit, f'<div class="af-grs">{"".join(G_)}</div>', pie_cita(m in ('crear', 'google'))

# ---- Evento genérico ----
def form_evento(m, uid):
    """m: evento | todo | banda | evedit"""
    G_ = []
    if m != 'evedit':
        G_.append(selector('evento', uid, bloqueada_cita=m in ('todo', 'banda')))
    ics = ''.join(f'<button type="button" class="af-p af-icb" aria-label="{t}" title="{t}" aria-pressed="{"true" if k == ("junta" if m != "evedit" else "docencia") else "false"}" data-uno="1">{ii(k, 20, 1.9)}</button>' for k, t in ICONOS_EVENTO)
    cols = ''.join(f'<button type="button" class="af-p af-cob" style="--co:var(--cal-ev-{k})" aria-label="{t}" title="{t}" aria-pressed="{"true" if k == ("indigo") else "false"}" data-uno="1"><i></i></button>' for k, t in COLORES)
    tit_v = {'evento': 'Junta de personal', 'todo': 'Congreso de ortopedia', 'banda': '', 'evedit': 'Curso de actualización'}[m]
    cu = (fila('Título', inp(tit_v, 'Cirugía Sr. Pérez, Junta de personal, Bloqueo…'), req=True)
          + f'<div class="af-f af-fw"><span class="af-l">Icono</span><div class="af-ics" role="group" aria-label="Icono">{ics}</div></div>'
          + f'<div class="af-f af-fw"><span class="af-l">Color</span><div class="af-cols" role="group" aria-label="Color">{cols}</div></div>')
    G_.append(gr('Evento', 'calmas', cu, pieg('Se verá tal cual en Google Calendar y en la invitación de quien asista.')))
    todo = m in ('todo', 'banda', 'evedit')
    sw_row = (f'<div class="af-f af-fi"><span class="af-l">Todo el día{"<small class=\"af-ban\"> · la banda sólo crea eventos de todo el día</small>" if m == "banda" else ""}</span>'
              f'<span class="af-c">{sw(todo, "Todo el día", m == "banda")}</span></div>')
    if m == 'evento':
        f_, e = fechas('19/11/2026', '19:00', '19/11/2026', '20:00', '1 hora')
    elif m == 'evedit':
        f_, e = fechas('19/11/2026', '', '19/11/2026', '', '', todo=True)
    else:
        f_, e = fechas('19/11/2026', '', '19/11/2026' if m == 'banda' else '21/11/2026', '', '', todo=True)
    if m == 'banda':
        pass
    G_.append(gr('Fecha y hora', 'reloj', sw_row + f_, e))
    d = (estado('ag', evento=True) if m == 'evedit' else '') + medico() + consultorio() + notas()
    G_.append(gr('Detalles', 'detalles', d))
    if m == 'evedit':
        G_.append(invitados())
        G_.append(destructiva('Eliminar evento', 'papelera', 'Eliminando evento', 'del-ev'))
    tit = 'Editar evento' if m == 'evedit' else 'Nuevo evento'
    return tit, f'<div class="af-grs">{"".join(G_)}</div>', pie_cita(m == 'banda')

# ---- Bloqueo (ModalBloqueo) ----
def form_bloqueo(m, uid):
    """m: bq | bqdias | bqedit"""
    dias = m == 'bqdias'
    edit = m == 'bqedit'
    cu = ''
    if not edit:
        cu += fila('Médico', sel(['Elige el médico', 'Dr. Admin Semilla', 'Dra. Invitada Semilla'], 'Dr. Admin Semilla', lab='Médico'), 'af-x-med')
    cu += f'<div class="af-f af-fi"><span class="af-l">Días completos</span><span class="af-c">{sw(dias, "Días completos")}</span></div>'
    if dias:
        cu += fecha('Desde', '20/11/2026') + fecha('Hasta (incluido)', '24/11/2026')
    else:
        a, b_ = ('19/11/2026', '19:00') if not edit else ('19/11/2026', '14:30')
        c, d_ = ('19/11/2026', '20:00') if not edit else ('19/11/2026', '15:30')
        cu += (f'<div class="af-f af-fi"><span class="af-l">Inicio</span><span class="af-c af-pils">{pil(a, "Fecha de inicio")}{pil(b_, "Hora de inicio")}</span></div>'
               f'<div class="af-f af-fi"><span class="af-l">Fin</span><span class="af-c af-pils">{pil(c, "Fecha de fin")}{pil(d_, "Hora de fin")}</span></div>')
    cu += fila('Motivo (opcional)', inp('Comida' if edit else '', 'Vacaciones, congreso…', ' maxlength="120" aria-label="Motivo"'))
    pie_g = pieg('Si la clínica usa Google Calendar, el motivo aparece allí. No escribas datos de pacientes.')
    errs = err('El fin tiene que ser después del inicio.', 'af-x-bqerr')
    cuerpo = f'<div class="af-grs">{gr("", "", cu, pie_g + errs)}</div>'
    quitar = ''
    if edit:
        quitar = (f'<span class="af-pie-iz"><button type="button" class="af-p af-tx af-tx-mal af-x-bq0" data-quitabq="1">Quitar bloqueo</button>'
                  f'<button type="button" class="af-p af-b af-malb af-x-bq1" data-quitabq="2">Sí, quitar</button></span>')
    pie = (quitar + b('Cancelar', 'af-qui', ' data-cierra="1"')
           + '<button type="button" class="af-p af-b af-prim af-guardabq"><span class="af-x-bqg0">Guardar</span><span class="af-x-bqg1">Guardando…</span></button>')
    tit = 'Bloqueo de horario' if edit else 'Bloquear horario'
    return tit, cuerpo, pie

# ---- Capa de formulario (tarjeta del catálogo): contiene varias variantes con data-m ----
def capa(key, ancho, variantes, icono='agenda', sub_fn=None, aria=''):
    """variantes: lista de (m, (titulo, cuerpo, pie)). Solo una visible (la tira o el guion alternan data-m)."""
    out = ''
    for i, (m, (t, cu, pie)) in enumerate(variantes):
        sub = sub_fn(m) if sub_fn else ''
        s = f'<p class="af-cab-s">{sub}</p>' if sub else ''
        out += (f'<div class="af-var" data-m="{m}"{"" if i == 0 else " hidden"} >'
                f'<header class="af-cab"><span class="af-cab-i" aria-hidden="true">{ii(icono, 18, 2)}</span><div class="af-cab-t"><h2 class="af-h">{t}</h2>{s}</div>{x()}</header>'
                f'<div class="af-cu" lang="es">{cu}</div><footer class="af-pie">{pie}</footer></div>')
    return (f'<div class="af-capa" data-capa="{key}" aria-hidden="true"><div class="af-cj {ancho}" role="dialog" aria-modal="true" aria-label="{aria}" tabindex="-1">'
            f'<span class="af-asa" aria-hidden="true"></span>{out}</div></div>')

def alerta(key, variantes):
    """variantes: (m, tono, icono, titulo, texto, sec, prim, prim_cls)"""
    out = ''
    for i, (m, tono, ico, tit, txt, sec, prim, pc) in enumerate(variantes):
        bs = (b(sec, 'af-qui', ' data-cierra="1"') if sec else '') + b(prim, pc, ' data-cierra="1"')
        out += (f'<div class="af-var" data-m="{m}"{"" if i == 0 else " hidden"}><span class="af-al-i af-i-{tono}" aria-hidden="true">{ii(ico, 28, 2)}</span>'
                f'<h2>{tit}</h2><p class="af-al-t" lang="es">{txt}</p><div class="af-al-b{"" if sec else " af-uno"}">{bs}</div></div>')
    return f'<div class="af-capa" data-capa="{key}" aria-hidden="true"><div class="af-cj af-al" role="alertdialog" aria-modal="true" tabindex="-1">{out}</div></div>'

# ------------------------------------------------------------------ PANTALLA DE FONDO Y MARCO ------------------------------------------------------------------
def fondo(vp):
    bar, flota = barra(vp, 'dia')
    return f'<main class="ag0-cont">{bar}{rejilla(vp, [HOY], scroll=14.5)}{flota}</main>'

def marco(n, vp, capas):
    main = fondo(vp)
    if vp == 'ext': app = main + riel()
    elif vp == 'tel': app = encabezado() + main
    elif vp == 'iv': app = enc_iv() + main
    elif vp == 'ih': app = main + lateral()
    else: app = lateral() + main
    toast = (f'<div class="af-toast" role="status" aria-live="polite"><span class="af-ti af-i-ok">{ii("check", 16, 2.4)}</span><span class="af-tt"></span>'
             f'<button type="button" class="af-p af-x" data-toastx="1" aria-label="Cerrar aviso">{ic(I["x"], 18, 2)}</button></div>')
    # El fondo es decorado (§25: «fondo de pantalla real simplificado»): inerte. La agenda real está en la página Calendario.
    return (f'<div class="marco af ag0 af-v{n}" data-vp="{vp}" lang="es">\n<div class="ag0-app" inert>\n{app}\n</div>\n'
            f'<div class="af-velo" data-cierra="1"></div>\n{capas}\n{toast}\n</div>')

def salida(n, archivo, nombre, desc, marcos, ficha, tira, css_extra='', **cfg):
    c = dict(v=str(n), ficha=ficha, tira=tira); c.update(cfg)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS_BASE}\n{CSS_AF}\n{scope_v(css_extra, n)}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS}\n}})({json.dumps(c, ensure_ascii=False)});\n</script>\n')
    p = f'{A}/vista-{archivo}.html'
    open(p, 'w').write(out); print(p, len(out))

exec(open(A + '/tmp-af-vistas.py').read())
