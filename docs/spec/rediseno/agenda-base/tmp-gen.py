# Generador de las piezas base de la agenda (Fase 1). Uso: python3 tmp-gen.py  → vista-1…6.html
# Todas las vistas comparten CSS (tmp-nav.css + tmp-estilo.css) y JS (tmp-guion.js); cada marco lleva la clase ag0-vN.
import os, html
L = os.path.dirname(os.path.abspath(__file__))
VPS = ('ext', 'tel', 'ih', 'iv', 'esc')
TACTIL = ('ext', 'tel', 'ih', 'iv')

def ic(d, s=20, w=1.8, extra=''):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}>{d}</svg>'

FOLDER = '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'
I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    lupa='<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    perfil='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    ant='<path d="m15 6-6 6 6 6"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    campana='<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>',
    candado='<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    engrane='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    cursor='<path d="m4 4 7 17 2.5-7.5L21 11z"/>',
    compactar='<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>',
    densidad='<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M3.5 14h17"/>',
    teclado='<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    info='<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    reloj='<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    medico='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/>',
    reagendar='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15h6m-2-2 2 2-2 2"/>',
    editar='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    iniciar='<path d="M5 3.5V8a4.5 4.5 0 0 0 9 0V3.5M9.5 12.5V15a5 5 0 0 0 10 0v-1.5"/><circle cx="19.5" cy="11.5" r="2"/>',
    whatsapp='<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z"/><path d="M9 9.5c.3 2 2.5 4.3 4.5 4.8l1.2-1.1 1.8.9"/>',
    correo='<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    convertir='<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    papelera='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    junta='<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.6-.6 5.6.6 6.5 4"/>',
    urgencias='<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M12 9v7M8.5 12.5h7"/>',
    docencia='<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.3 3.5 2 5.5 2s4-.7 5.5-2V11"/>',
    evento='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6"/>',
    palomita='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    doble='<path d="m2.5 12.5 4 4L15 8"/><path d="m11.5 16 .5.5L21.5 8"/>',
    calreloj='<path d="M20 10.5V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5"/><path d="M4 10h16M8 3v4M16 3v4"/><circle cx="17" cy="17" r="4.5"/><path d="M17 15v2.2l1.5 1"/>',
    noasistio='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M4 4l16 16"/>',
    confirmar='<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8 5.2-5.6"/>',
    enlace='<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arriba='<path d="m18 15-6-6-6 6"/>',
    flecha='<path d="M5 12h14M12 5l7 7-7 7"/>',
    firma='<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/>',
    cedula='<path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="5" cy="14" r="3"/><path d="M7 16.5 8 22l-3-1-3 1 1-5.5"/>',
    imagen='<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    ayuda='<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/>',
    vertical='<circle cx="12" cy="5.5" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="12" cy="18.5" r=".6"/>',
)

def sinexp(s=12):
    return ic(FOLDER, s, 2, ' stroke-dasharray="2.6 2.6"')

def gcal(s=14):
    # Icono multicolor de Google Calendar (CALMA §24.5), el mismo dibujo que el dashboard.
    return (f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24">'
            '<rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#4285F4"/>'
            '<path d="M17 7h4.5v10H17z" fill="#FBBC04"/><path d="M7 17h10v4.5H7z" fill="#34A853"/>'
            '<path d="M2.5 17H7v4.5H6A3.5 3.5 0 0 1 2.5 18z" fill="#188038"/><path d="M17 17h4.5L17 21.5z" fill="#EA4335"/>'
            '<rect x="7" y="7" width="10" height="10" fill="#fff"/>'
            '<path d="M9.6 10.2h2.2l-1.2 1.4c.9 0 1.4.5 1.4 1.2s-.6 1.2-1.4 1.2c-.5 0-.9-.2-1.1-.5M13.6 10.6l1-.5v4.2" fill="none" stroke="#4285F4" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# Estados (CALMA §24.4 y §27): texto de hoy (STATUS_CONFIG, tarjetasAgenda.ts:315-321) + icono
EST = dict(ag=('Agendada', 'calreloj'), conf=('Confirmada', 'palomita'), aten=('Atendida', 'doble'),
           canc=('Cancelada', 'x'), noas=('No asistió', 'noasistio'))

def est(k, texto=True, s=26):
    t, i = EST[k]
    c = f'<i>{ic(I[i], 15 if s >= 24 else 12, 2.2)}</i>'
    if texto:
        return f'<span class="ag0-est ag0-e-{k}">{c}<span>{t}</span></span>'
    return f'<span class="ag0-est ag0-e-{k}" role="img" aria-label="{t}">{c}</span>'

def hm(x):
    h = int(x); m = round((x - h) * 60)
    return f'{h:02d}:{m:02d}'

def hh(s):
    a, b = s.split(':'); return int(a) + int(b) / 60

# ------------------------------------------------------------------ SEMILLA (datos ficticios) ------------------------------------------------------------------
# Semana del 16 al 22 de noviembre de 2026; hoy jueves 19, son las 17:10. Médico: Dr. Admin Semilla, consultorio Centro.
DIAS = [('Lun', 16, 'Lunes'), ('Mar', 17, 'Martes'), ('Mié', 18, 'Miércoles'), ('Jue', 19, 'Jueves'), ('Vie', 20, 'Viernes'), ('Sáb', 21, 'Sábado'), ('Dom', 22, 'Domingo')]
HOY = 3
AHORA = 17 + 10 / 60
T0, T1 = 7, 21
HORARIO = {0: (8, 19), 1: (8, 19), 2: (8, 19), 3: (8, 20), 4: (8, 19), 5: (9, 14), 6: None}

def C(id, d, a, b, nom, e='ag', **k):
    c = dict(id=id, d=d, a=hh(a), b=hh(b), nom=nom, e=e, tipo='cita', cons='Centro', tel=None, obs=None, ori='', sx=False, evc=None, evi=None)
    c.update(k)
    if c['tipo'] == 'cita' and c['tel'] is None and nom.startswith('Paciente Prueba'):
        c['tel'] = '999 000 00' + nom[-2:]
    return c

CITAS = [
    # Lunes 16
    C('l1', 0, '08:00', '08:30', 'Paciente Prueba 13', 'aten'), C('l2', 0, '10:00', '10:45', 'Paciente Prueba 14', 'canc'),
    C('l3', 0, '11:30', '12:00', 'Paciente Prueba 15', 'noas'), C('l4', 0, '14:00', '15:00', 'Junta de servicio', 'ag', tipo='ev', evc='indigo', evi='junta', tel=None),
    # Martes 17
    C('m1', 1, '08:00', '08:30', 'Paciente Prueba 16', 'aten'), C('m2', 1, '10:00', '10:45', 'Paciente Prueba 17', 'aten'),
    C('m3', 1, '11:30', '11:45', 'Paciente Prueba 18', 'aten'), C('m4', 1, '16:00', '17:30', 'Paciente Prueba 19', 'aten', obs='Revisión de estudios de imagen'),
    # Miércoles 18
    C('x1', 2, '10:00', '10:45', 'Paciente Prueba 20', 'aten'), C('x2', 2, '12:00', '12:30', 'Paciente Prueba 22', 'aten'),
    C('x3', 2, '13:00', '13:15', 'Paciente Prueba 23', 'canc'),
    # Jueves 19 (hoy) — la Vista Día de muestra
    C('j1', 3, '08:00', '08:30', 'Paciente Prueba 04', 'aten'), C('j2', 3, '09:00', '09:30', 'Paciente Prueba 05', 'noas'),
    C('j3', 3, '10:00', '10:45', 'Paciente Prueba 03', 'aten', obs='Lumbago, control'), C('j4', 3, '11:30', '11:50', 'Paciente Prueba 06', 'aten'),
    C('j5', 3, '12:00', '13:00', 'Paciente Prueba 11', 'aten'), C('j6', 3, '13:00', '13:15', 'Paciente Prueba 08', 'canc'),
    C('j7', 3, '13:30', '14:00', 'Pendiente administrativo', 'ag', tipo='evn', evi='evento', tel=None),
    C('j8', 3, '14:00', '14:30', 'Paciente Prueba 26', 'ag', ori='enlace', sx=True, tel='999 000 0026'),
    C('j9', 3, '16:00', '16:45', 'Paciente Prueba 09', 'aten'),
    C('j10', 3, '17:00', '17:30', 'Paciente Prueba 07', 'ag', curso=True, obs='Gonalgia, primera vez'),
    C('j11', 3, '17:30', '17:45', 'Paciente Prueba 10', 'conf', obs='Nota ficticia de seguimiento'),
    C('j12', 3, '18:20', '18:50', 'Paciente Prueba 12', 'conf', ori='enlace', sol='A'),
    C('j13', 3, '18:20', '18:50', 'Revisión de estudios', 'ag', tipo='gl', ori='google', sx=True, tel=None, sol='B', cons=None),
    # Viernes 20
    C('v1', 4, '08:00', '08:30', 'Paciente Prueba 15', 'ag', ori='google'), C('v2', 4, '09:00', '09:30', 'Paciente Prueba 21', 'ag', ori='enlace', sx=True),
    C('v3', 4, '10:00', '10:45', 'Paciente Prueba 22', 'conf'), C('v4', 4, '12:00', '13:00', 'Paciente Prueba 23', 'conf', obs='Esguince de tobillo'),
    C('v5', 4, '16:00', '17:00', 'Paciente Prueba 24', 'ag'),
    # Sábado 21
    C('s1', 5, '09:00', '09:30', 'Paciente Prueba 25', 'ag'), C('s2', 5, '11:00', '12:00', 'Paciente Prueba 01', 'conf'),
]
for c in CITAS:
    if c['d'] < HOY or (c['d'] == HOY and c['b'] <= AHORA):
        c['pasado'] = True
BLOQUEOS = [dict(id='bq1', d=3, a=14.5, b=15.5, t='Bloqueado · Comida'), dict(id='bq2', d=4, a=18, b=20, t='Bloqueado · Congreso')]
TODO = {2: [('ev', 'carmin', 'urgencias', 'Guardia')], 3: [('ev', 'indigo', 'docencia', 'Curso de actualización')], 6: [('bq', None, 'candado', 'Bloqueado · Vacaciones')]}

def dur_cls(c):
    m = (c['b'] - c['a']) * 60
    return 'ag0-d15' if m <= 22 else 'ag0-d30' if m <= 37 else 'ag0-d45' if m <= 52 else 'ag0-d60' if m <= 82 else 'ag0-d90'

def dia_largo(d):
    return f'{DIAS[d][2]} {DIAS[d][1]} de noviembre'

def corto(c):
    # nombreCortoPaciente / nombreCortoDeTexto (lib/agenda/nombresTarjeta.ts): primer nombre + inicial del apellido.
    # Un evento conserva su título entero (F1.7). Con la semilla todos salen «Paciente P.»; con nombres reales, «María G.».
    if c['tipo'] in ('ev', 'evn'):
        return c['nom']
    p = c['nom'].split()
    return p[0] + (' ' + p[1][0] + '.' if len(p) > 1 else '')

# ------------------------------------------------------------------ EL BLOQUE ------------------------------------------------------------------
def bloque(c, extra='', estilo=None, aria_extra=''):
    """El bloque de cita (.ag0-b). Un solo marcado para todos los tamaños; CSS decide qué se ve."""
    e, tipo = c['e'], c['tipo']
    cls = ['ag0-p', 'ag0-b', dur_cls(c)]
    st = ''
    if tipo == 'ev':
        cls.append('ag0-b--ev'); st = f'--b-ev:var(--cal-ev-{c["evc"]});'
    else:
        cls.append(f'ag0-b--{e}')
        if tipo == 'evn': cls.append('ag0-b--evn')
    if c.get('pasado'): cls.append('ag0-b--pasado')
    if c.get('curso'): cls.append('ag0-b--curso')
    if c['sx']: cls.append('ag0-b--lig')
    if c.get('sol'): cls.append('ag0-b--sol' + c['sol'])
    if extra: cls.append(extra)
    if estilo is None:
        estilo = f'top:calc(var(--cal-h) * {c["a"] - T0:.4f} + 1px);height:calc(var(--cal-h) * {c["b"] - c["a"]:.4f} - 2px)'
    if tipo in ('ev', 'evn'):
        ico = f'<span class="ag0-b-ico ag0-b-evi">{ic(I[c["evi"]], 13, 2.2)}</span>'
    else:
        ico = f'<span class="ag0-b-ico">{ic(I[EST[e][1]], 13, 2.4)}</span>'
    mar = ''
    if c['ori'] == 'google': mar += gcal(12)
    if c['ori'] == 'enlace': mar += ic(I['enlace'], 12, 2.2)
    if c['sx']: mar += sinexp(12)
    mar = f'<span class="ag0-b-mar">{mar}</span>' if mar else ''
    # Iniciales del médico: solo con «Todos los médicos» (doctorInitial, MemoizedEventContent)
    if c.get('med'): mar += f'<span class="ag0-b-med" aria-hidden="true">{c["med"]}</span>'
    hora = f'{hm(c["a"])} – {hm(c["b"])}'
    l2 = f'<span class="ag0-b-hora">{hora}</span>'
    if c.get('curso'): l2 += '<span class="ag0-b-curso">En curso</span>'
    if c['ori'] == 'enlace': l2 += f'<span class="ag0-b-ot">{ic(I["enlace"], 12, 2.2)}Reservó por enlace</span>'
    if c['ori'] == 'google': l2 += f'<span class="ag0-b-ot">{gcal(12)}Agendada desde Google Calendar</span>'
    if c['sx']: l2 += f'<span class="ag0-b-sx">{sinexp(12)}Sin expediente</span>'
    if c.get('tz'): l2 += f'<span class="ag0-b-tz">{c["tz"]}</span>'
    if c['cons']: l2 += f'<span class="ag0-b-cons">{c["cons"]}</span>'
    if c['tel']: l2 += f'<span class="ag0-b-tel ag0-num">{c["tel"]}</span>'
    obs = f'<span class="ag0-b-obs">{c["obs"]}</span>' if c['obs'] else ''
    chip = '' if tipo in ('ev', 'evn') else f'<span class="ag0-b-chip"><i>{ic(I[EST[e][1]], 12, 2.4)}</i><span>{EST[e][0]}</span></span>'
    partes = [c['nom'], f'{hm(c["a"])} a {hm(c["b"])}']
    if tipo in ('ev', 'evn'): partes.append('Evento')
    else: partes.append(EST[e][0])
    if c.get('curso'): partes.append('En curso')
    if c['ori'] == 'enlace': partes.append('Reservó por enlace')
    if c['ori'] == 'google': partes.append('Agendada desde Google Calendar')
    if c['sx']: partes.append('Sin expediente')
    if c.get('tz'): partes.append(c['tz'])
    if c.get('med'): partes.append('Dr. Admin Semilla')
    if aria_extra: partes.append(aria_extra)
    return (f'<button type="button" class="{" ".join(cls)}" style="{st}{estilo}" data-cita="{c["id"]}" aria-haspopup="dialog" aria-label="{", ".join(partes)}">'
            f'<span class="ag0-b-in"><span class="ag0-b-l1">{ico}<span class="ag0-b-hi">{hm(c["a"])}</span><span class="ag0-b-nom">{c["nom"]}</span><span class="ag0-b-nomc">{corto(c)}</span>{mar}</span>'
            f'<span class="ag0-b-l2">{l2}</span>{obs}{chip}</span><span class="ag0-b-asa" aria-hidden="true"></span></button>')

def chip_todo(t, minimo=False):
    k, col, i, txt = t
    if k == 'bq':
        return f'<button type="button" class="ag0-p ag0-tc ag0-tc--bq{" ag0-tc--min" if minimo else ""}" aria-label="{txt}, todo el día">{ic(I[i], 12, 2.2)}<span>{txt}</span></button>'
    return f'<button type="button" class="ag0-p ag0-tc ag0-b--ev{" ag0-tc--min" if minimo else ""}" style="--b-ev:var(--cal-ev-{col})" aria-haspopup="dialog" aria-label="{txt}, todo el día, evento">{ic(I[i], 12, 2.2)}<span>{txt}</span></button>'

# ------------------------------------------------------------------ LA REJILLA ------------------------------------------------------------------
def rejilla(vp, dias, scroll=12.0, minimo=False, densa=False, hueco_demo=None, con_bloques=True, todo=True, cid=''):
    """La rejilla horaria (.ag0-cal). dias = índices de DIAS. minimo = 7 columnas en teléfono (versión B)."""
    n = len(dias); nh = T1 - T0
    cab = '<span aria-hidden="true"></span>'
    for d in dias:
        cur = ' aria-current="date"' if d == HOY else ''
        sin = ' ag0-dia-sin' if HORARIO[d] is None else ''
        corto = DIAS[d][0][0] if minimo else DIAS[d][0]
        if n == 1:
            cab += f'<span class="ag0-dia{sin}"{cur}><span>{corto}</span><b>{DIAS[d][1]}</b></span>'
        elif minimo:
            cab += f'<button type="button" class="ag0-p ag0-dia{sin}" style="flex-direction:column;gap:0;padding:4px 0"{cur} aria-label="{dia_largo(d)}, ver el día"><span aria-hidden="true">{corto}</span><b>{DIAS[d][1]}</b></button>'
        else:
            cab += f'<button type="button" class="ag0-p ag0-dia{sin}"{cur} aria-label="{dia_largo(d)}, ver el día"><span aria-hidden="true">{corto}</span><b>{DIAS[d][1]}</b></button>'
    todo_h = ''
    if todo:
        todo_h = '<div class="ag0-fila ag0-todo" style="--n:%d"><span class="ag0-todo-r">%s</span>' % (n, 'Todo' if minimo else 'Todo el día')
        for d in dias:
            todo_h += '<div class="ag0-todo-c">' + ''.join(chip_todo(t, minimo) for t in TODO.get(d, [])) + '</div>'
        todo_h += '</div>'
    # columna de horas
    horas = ''
    for h in range(T0, T1 + 1):
        if HOY in dias and abs(h - AHORA) < 0.3:
            continue  # la píldora de la hora actual ocupa su sitio
        horas += f'<span class="ag0-hr" style="top:calc(var(--cal-h) * {h - T0})">{h:02d}:00</span>'
    if HOY in dias:
        horas += f'<span class="ag0-ahora-p" style="top:calc(var(--cal-h) * {AHORA - T0:.4f})" aria-label="Hora actual {hm(AHORA)}">{hm(AHORA)}</span>'
    cols = ''
    for d in dias:
        dentro = ''
        hor = HORARIO[d]
        if hor is None:
            dentro += f'<span class="ag0-fuera" style="top:0;height:100%"></span>'
        else:
            if hor[0] > T0: dentro += f'<span class="ag0-fuera" style="top:0;height:calc(var(--cal-h) * {hor[0] - T0})"></span>'
            if hor[1] < T1: dentro += f'<span class="ag0-fuera" style="top:calc(var(--cal-h) * {hor[1] - T0});bottom:0"></span>'
        if con_bloques:
            for b in BLOQUEOS:
                if b['d'] != d: continue
                tramos = ''
                if hor:
                    a, z = max(b['a'], hor[0]), min(b['b'], hor[1])
                    if z > a:
                        tramos = f'<span class="ag0-bq-r" style="top:calc(var(--cal-h) * {a - b["a"]:.4f});height:calc(var(--cal-h) * {z - a:.4f})"></span>'
                t = b['t'] if not minimo else ''
                rot = f'<span class="ag0-bq-t">{ic(I["candado"], 12, 2.2)}<span>{t}</span></span>' if not minimo else ''
                dentro += (f'<button type="button" class="ag0-bq" data-bloqueo="{b["id"]}" aria-label="{b["t"]}, {hm(b["a"])} a {hm(b["b"])}. Editar bloqueo" '
                           f'style="top:calc(var(--cal-h) * {b["a"] - T0:.4f});height:calc(var(--cal-h) * {b["b"] - b["a"]:.4f})">{tramos}{rot}</button>')
            for c in CITAS:
                if c['d'] == d:
                    dentro += bloque(c)
        if d == HOY:
            dentro += f'<span class="ag0-ahora" style="top:calc(var(--cal-h) * {AHORA - T0:.4f})" aria-hidden="true"></span>'
        elif HOY in dias:
            dentro += f'<span class="ag0-ahora-t" style="top:calc(var(--cal-h) * {AHORA - T0:.4f})" aria-hidden="true"></span>'
        if vp not in ('ext', 'tel'):  # en teléfono hoy no se agenda tocando un hueco (se usa «Agendar»)
            dentro += f'<span class="ag0-hueco" aria-hidden="true">{ic(I["plus"], 12, 2.4)}<span></span></span>'
        hoy = ' ag0-col-hoy' if d == HOY else ''
        tq = '' if vp in ('ext', 'tel') else '. Toca un hueco libre para agendar'
        sinh = ' ag0-col-sinh' if vp in ('ext', 'tel') else ''
        cols += f'<div class="ag0-col{hoy}{sinh}" data-dia="{d}" role="group" aria-label="{dia_largo(d)}{tq}">{dentro}</div>'
    clase = 'ag0-cal' + (' ag0-densa' if densa else '') + (' ag0-cal-min' if minimo else '') + (' ag0-cal-dia' if n == 1 else '')
    return f'''<section class="{clase}" aria-label="Rejilla de la agenda" data-scroll="{scroll}">
  <div class="ag0-fila ag0-dias" style="--n:{n}">{cab}</div>
  {todo_h}
  <div class="ag0-cuerpo"><div class="ag0-lienzo" style="--nh:{nh}"><div class="ag0-fila" style="--n:{n}">
    <div class="ag0-horas">{horas}</div>{cols}
  </div></div></div>
</section>'''

# ------------------------------------------------------------------ NAVEGACIÓN (copiada del dashboard aprobado, «Agenda» activa) ------------------------------------------------------------------
def riel(mas_agendar=True):
    def b(k, t, act=False):
        a = ' aria-current="page"' if act else ''
        return f'<a href="#" class="ag0-p ag0-rb" aria-label="{t}"{a}>{ic(I[k], 22)}</a>'
    mas = ('<!-- En la Agenda el «+» del riel es «Agendar» (contextual, como el de la secretaria en Inicio). DECISIÓN PARA EL DUEÑO: hoy en el teléfono «Agendar» es una barra fija a todo el ancho; en el Duo cerrado no cabe en la barra sin una tercera fila. -->'
           f'<button type="button" class="ag0-p ag0-mas" aria-label="Agendar" data-accion="agendar">{ic(I["plus"], 26, 2.4)}</button>')
    return f'''<nav class="ag0-riel" aria-label="Navegación principal">
  {b("inicio","Inicio")}{b("pac","Expediente")}{b("agenda","Agenda",True)}{b("docs","Documentos")}<a href="#" class="ag0-p ag0-rb" aria-label="Más, 3 datos pendientes">{ic(I["mas"], 22, 3)}<span class="ag0-bdg" aria-hidden="true">3</span></a>
  <span class="ag0-flex"></span>
  {mas}
</nav>'''

def aviso_perfil():
    # A0·11 · Aviso de perfil (AvisoPerfilSidebar.tsx), tal como quedó en cromo/vista-1-aviso-perfil.html. Solo role=medico.
    filas = ''.join(f'<a href="#" class="ag0-p ag0-ap-l">{ic(I[k], 18, 1.9)}<span>{t}</span></a>' for k, t in (('firma', 'Documentos sin firma'), ('cedula', 'Sin cédula de especialidad'), ('imagen', 'Clínica sin logo')))
    return (f'<div class="ag0-ap" role="status" aria-live="polite"><button type="button" class="ag0-p ag0-ap-cab" aria-expanded="true">'
            f'<span class="ag0-ap-pt" aria-hidden="true"></span><span class="ag0-ap-t">3 datos pendientes</span>{ic(I["arriba"], 18, 2.2).replace("aria-hidden", "class=\"ag0-ap-ch\" aria-hidden")}</button>'
            f'<div class="ag0-ap-c"><span class="ag0-ap-sep" aria-hidden="true"></span>{filas}<a href="#" class="ag0-p ag0-ap-b">Completar ahora{ic(I["flecha"], 16, 2.2)}</a></div></div>')

def lateral():
    def a(k, t, act=False):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="ag0-p ag0-li"{c}>{ic(I[k], 20)}{t}</a>'
    return f'''<nav class="ag0-lat" aria-label="Navegación principal">
  <div class="ag0-lat-cab"><span class="ag0-logo">{ic(I["logo"], 24)}<span class="ag0-logo-n">Spinus</span></span><span class="ag0-plan">Plan VIP</span></div>
  <button type="button" class="ag0-p ag0-cons-b"><span class="ag0-clogo" role="img" aria-label="Logo de Clínica Semilla A"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5-2.2-7-5.6-7-10V5.5L12 3l7 2.5V11c0 4.4-2.5 7.8-7 10z"/><path d="M12 8v7M8.5 11.5h7"/></svg></span><span class="ag0-cons-t"><span>Consultorio</span><b>Centro</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="ag0-lista">{a("inicio","Inicio")}{a("pac","Expediente")}{a("agenda","Agenda",True)}{a("docs","Documentos")}{a("admin","Administración")}</div>
  <span class="ag0-flex"></span>
  {aviso_perfil()}
  <div class="ag0-lat-pie"><a href="#" class="ag0-p ag0-li ag0-yo">{ic(I["perfil"], 20)}<span><span>Dr. Admin Semilla</span><small class="ag0-esp">Ortopedia y Traumatología</small><small>Mi perfil · Ajustes</small></span></a><a href="#" class="ag0-p ag0-ay" aria-label="Ayuda">{ic(I["ayuda"], 20)}</a></div>
</nav>'''

def encabezado():
    return f'''<header class="ag0-enc">
  <button type="button" class="ag0-p ag0-menu" aria-label="Menú, 3 datos pendientes">{ic(I["menu"], 22, 2)}<span class="ag0-bdg" aria-hidden="true">3</span></button>
  <span class="ag0-enc-t">Agenda</span><span class="ag0-flex"></span>
  <button type="button" class="ag0-p ag0-av ag0-av-g" aria-label="Mi perfil">AS</button>
</header>'''

def enc_iv():
    def p(t, act=False):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="ag0-p ag0-pv"{c}>{t}</a>'
    return f'''<header class="ag0-env">
  <button type="button" class="ag0-p ag0-envb" aria-label="Mostrar barra lateral, 3 datos pendientes">{ic(I["barra"], 20)}<span class="ag0-bdg" aria-hidden="true">3</span></button>
  <nav class="ag0-pista" aria-label="Secciones">{p("Inicio")}{p("Expediente")}{p("Agenda", True)}{p("Documentos")}{p("Más")}</nav>
  <button type="button" class="ag0-p ag0-av ag0-av-g" aria-label="Mi perfil">AS</button>
</header>'''

def marco(v, vp, contenido, capas=''):
    if vp == 'ext': app = contenido + riel()
    elif vp == 'tel': app = encabezado() + contenido
    elif vp == 'iv': app = enc_iv() + contenido
    elif vp == 'ih': app = contenido + lateral()
    else: app = lateral() + contenido
    if vp == 'ih':  # en Duo abierto horizontal el aviso de datos pendientes empieza plegado (como el dashboard): el pie cabe sobre la franja
        app = app.replace('class="ag0-p ag0-ap-cab" aria-expanded="true"', 'class="ag0-p ag0-ap-cab" aria-expanded="false"')
    pleg = ' data-pleg="1"' if vp == 'ih' else ''
    return f'<div class="marco ag0 ag0-v{v}" data-vp="{vp}"{pleg} lang="es">\n<div class="ag0-app">\n{app}\n</div>\n{capas}\n</div>'

# ------------------------------------------------------------------ LA BARRA ------------------------------------------------------------------
TIT = {'dia': {'ancho': 'Jueves, 19 de noviembre de 2026', 'tel': 'Jue, 19 de noviembre'},
       'semana': {'ancho': '16 – 22 nov 2026', 'tel': '16 – 22 de noviembre'},
       'tres': {'ancho': '19 – 21 nov 2026', 'tel': '19 – 21 de noviembre'},
       'mes': {'ancho': 'Noviembre de 2026', 'tel': 'Noviembre de 2026'}}

def barra(vp, vista='dia'):
    t = TIT[vista]['tel' if vp in ('ext', 'tel') else 'ancho']
    tit = f'<button type="button" class="ag0-p ag0-tit" data-abre="fecha" aria-haspopup="dialog" aria-label="Ir a una fecha: {t}"><span class="ag0-tit-w"><span class="ag0-tit-t">{" ".join(t.split()[:-1])} <span class="ag0-nw">{t.split()[-1]}{ic(I["abajo"], 16, 2.4)}</span></span></span></button>'
    ant = f'<button type="button" class="ag0-p ag0-ic" aria-label="Periodo anterior">{ic(I["ant"], 20, 2.2)}</button>'
    sig = f'<button type="button" class="ag0-p ag0-ic" aria-label="Periodo siguiente">{ic(I["sig"], 20, 2.2)}</button>'
    hoy = '<button type="button" class="ag0-p ag0-hoy">Hoy</button>'
    nav = f'<div class="ag0-nav" role="group" aria-label="Navegar por la agenda">{ant}{hoy}{sig}</div>'
    def tab(k, tx):
        s = 'true' if k == vista else 'false'
        return f'<button type="button" role="tab" class="ag0-p" aria-selected="{s}" data-vista="{k}">{tx}</button>'
    seg = f'<div class="ag0-seg" role="tablist" aria-label="Vista del calendario">{tab("mes","Mes")}{tab("semana","Semana")}{tab("tres","3 días")}{tab("dia","Día")}</div>'
    bus = f'<button type="button" class="ag0-p ag0-ic" aria-label="Buscar citas de un paciente">{ic(I["lupa"], 20, 2)}</button>'
    cam = f'<button type="button" class="ag0-p ag0-ic" aria-label="Por confirmar (2) y avisos (1): 3 pendientes" aria-haspopup="dialog">{ic(I["campana"], 20, 2)}<span class="ag0-cnt" aria-hidden="true">3</span></button>'
    blo = f'<button type="button" class="ag0-p ag0-ic" aria-label="Bloquear horario">{ic(I["candado"], 20, 2)}</button>'
    eng = f'<button type="button" class="ag0-p ag0-ic" data-abre="menu" aria-label="Opciones de la agenda" aria-haspopup="menu" aria-expanded="false">{ic(I["engrane"], 20, 1.8)}</button>'
    mas = f'<button type="button" class="ag0-p ag0-ic" data-abre="menu" aria-label="Opciones de la agenda" aria-haspopup="menu" aria-expanded="false">{ic(I["mas"], 22, 3)}</button>'
    med = f'<button type="button" class="ag0-p ag0-med" aria-label="Filtrar por médico: Dr. Admin Semilla" aria-haspopup="listbox"><span class="ag0-ini ag0-mn">AS</span><span class="ag0-mn">Dr. Admin Semilla</span><span class="ag0-mt">Todos los médicos</span>{ic(I["abajo"], 14, 2.4)}</button>'
    agd = f'<button type="button" class="ag0-p ag0-prim" data-accion="agendar">{ic(I["plus"], 18, 2.4)}Agendar</button>'
    if vp in ('ext', 'tel'):
        flota = '' if vp == 'ext' else f'<button type="button" class="ag0-p ag0-prim ag0-flota" data-accion="agendar">{ic(I["plus"], 18, 2.4)}Agendar</button>'
        return (f'<div class="ag0-barra" aria-label="Herramientas de la agenda" role="toolbar">'
                f'<div class="ag0-bf">{ant}{tit}{sig}<span class="ag0-flex"></span>{cam}{mas}</div>'
                f'<div class="ag0-bf">{hoy}{seg}</div></div>'), flota
    if vp == 'ih':
        return (f'<div class="ag0-barra" aria-label="Herramientas de la agenda" role="toolbar">'
                f'<div class="ag0-bf">{tit}</div><div class="ag0-bf ag0-bder">{agd}</div>'
                f'<div class="ag0-bf">{nav}<span style="width:8px"></span>{seg}</div><div class="ag0-bf ag0-bder">{bus}{cam}{mas}</div></div>'), ''
    if vp == 'iv':
        return (f'<div class="ag0-barra" aria-label="Herramientas de la agenda" role="toolbar">'
                f'<div class="ag0-bf">{tit}<span class="ag0-flex"></span>{agd}</div>'
                f'<div class="ag0-bf">{nav}<span style="width:8px"></span>{seg}<span class="ag0-flex"></span>{bus}{cam}{mas}</div></div>'), ''
    return (f'<div class="ag0-barra" aria-label="Herramientas de la agenda" role="toolbar">'
            f'<div class="ag0-bf">{tit}<span class="ag0-flex"></span>{bus}{cam}{blo}{eng}<span style="width:8px"></span>{agd}</div>'
            f'<div class="ag0-bf">{nav}<span class="ag0-flex"></span>{med}<span style="width:8px"></span>{seg}</div></div>'), ''

# ------------------------------------------------------------------ CAPAS ------------------------------------------------------------------
def op(i, t, extra='', cls='', attrs=''):
    return f'<button type="button" class="ag0-p ag0-op {cls}" role="menuitem"{attrs}>{ic(I[i], 20, 2) if i else ""}<span>{t}</span>{extra}</button>'

def sw(i, t, on=False):
    return f'<button type="button" class="ag0-p ag0-op" role="menuitemcheckbox" aria-checked="{"true" if on else "false"}" data-sw="1">{ic(I[i], 20, 2)}<span>{t}</span><span class="ag0-sw" aria-hidden="true"></span></button>'

def menu_opciones(vp):
    """Menú «Opciones de la agenda». En computadora es el del engrane (igual que hoy); en táctiles agrupa además
    buscar, médico y bloquear horario (lo que en computadora va visible en la barra)."""
    chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
    medico = (f'<button type="button" class="ag0-p ag0-op" role="menuitem" aria-expanded="false" data-sub="med">{ic(I["medico"], 20, 2)}<span>Médico<small>Dr. Admin Semilla</small></span>{chev}</button>'
              f'<div class="ag0-sub" role="group" aria-label="Médico">'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="false"><span>Todos los médicos</span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="true"><span>Dr. Admin Semilla</span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="false"><span>Dra. Invitada Semilla</span></button></div>')
    sep = '<div class="ag0-sep" role="separator"></div>'
    if vp == 'esc':
        cuerpo = (op('engrane', 'Configuración de la agenda') + sep + sw('compactar', 'Compactar la rejilla') + sw('densidad', 'Densidad compacta')
                  + sw('cursor', 'Pop-up de eventos', True) + op('teclado', 'Atajos de teclado', '<kbd>?</kbd>') + sep + op('info', 'Leyenda de estados'))
    else:
        top = '' if vp in ('ih', 'iv') else op('lupa', 'Buscar citas de un paciente')
        cuerpo = (top + medico + op('candado', 'Bloquear horario') + sep + op('engrane', 'Configuración de la agenda')
                  + sw('compactar', 'Compactar la rejilla') + sw('cursor', 'Pop-up de eventos', True) + sep + op('info', 'Leyenda de estados'))
    anc = ' ag0-anc' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    cab = '' if vp == 'esc' else f'<div class="ag0-cjc"><h2>Opciones de la agenda</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>'
    return f'''<div class="ag0-capa{velo}" data-capa="menu" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj{anc}" role="menu" aria-label="Opciones de la agenda"><span class="ag0-asa" aria-hidden="true"></span>{cab}<div class="ag0-cj-in">{cuerpo}</div></div>
</div>'''

def capa_fecha(vp):
    dias = ''.join(f'<span>{x}</span>' for x in 'LMMJVSD')
    nums = ''
    for n in (26, 27, 28, 29, 30, 31):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de octubre">{n}</button>'
    for n in range(1, 31):
        a = ''
        if n == 19: a = ' aria-current="date" aria-selected="true"'
        nums += f'<button type="button" class="ag0-p"{a} aria-label="{n} de noviembre">{n}</button>'
    for n in range(1, 7):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de diciembre">{n}</button>'
    anc = ' ag0-anc ag0-anc-i' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    return f'''<div class="ag0-capa{velo}" data-capa="fecha" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj{anc}" role="dialog" aria-label="Ir a una fecha" style="{"width:320px" if vp != "tel" else ""}"><span class="ag0-asa" aria-hidden="true"></span>
    <div class="ag0-cjc"><h2>Ir a una fecha</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
    <div class="ag0-mm"><div class="ag0-mm-c"><b>Noviembre de 2026</b><button type="button" class="ag0-p ag0-ic" aria-label="Mes anterior">{ic(I["ant"], 20, 2.2)}</button><button type="button" class="ag0-p ag0-ic" aria-label="Mes siguiente">{ic(I["sig"], 20, 2.2)}</button></div>
    <div class="ag0-mm-g">{dias}{nums}</div></div>
  </div>
</div>'''

def capa_burbuja():
    return '''<!-- Burbuja de la cita como capa del catálogo (CALMA §25–§27): tarjeta centrada en Duo cerrado, Duo abierto y computadora;
     hoja inferior en iPhone. MUESTRA: el contenido y las acciones son los de hoy (BurbujaCita.tsx + accionesTarjeta.ts, commit 951e31b3);
     la burbuja completa (Confirmar desplegado, mensajes de resultado, teclado) es de otro agente. -->
<div class="ag0-capa" data-capa="burbuja" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj" role="dialog" aria-modal="true" aria-label="Cita"><span class="ag0-asa" aria-hidden="true"></span><div class="ag0-cj-in ag0-bu-h"></div></div>
</div>'''

def burbuja(c):
    """Contenido EXACTO de hoy según accionesTarjeta.ts:158-240 y BurbujaCita.tsx (textos literales)."""
    e, tipo = c['e'], c['tipo']
    ev = tipo in ('ev', 'evn')
    ligar = c['sx']
    x = f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>'
    mas = f'<button type="button" class="ag0-p ag0-x" aria-label="Más opciones de la cita" aria-haspopup="dialog">{ic(I["editar"], 20, 2)}</button>'
    cab = f'<div class="ag0-bu-c">{est(e)}<span class="ag0-flex"></span>{mas}{x}</div>'
    nom = f'<h2 class="ag0-bu-n{" ag0-tach" if e == "canc" else ""}">{c["nom"]}</h2>'
    ori = ''
    if c['ori'] == 'google': ori += f'<span class="ag0-marca">{gcal(14)}Agendada desde Google Calendar</span>'
    if c['ori'] == 'enlace': ori += f'<span class="ag0-marca">{ic(I["enlace"], 14, 2)}Reservó por enlace</span>'
    if c['sx']: ori += f'<span class="ag0-marca" role="img" aria-label="Sin expediente: este paciente aún no tiene expediente">{sinexp(14)}Sin expediente</span>'
    ori = f'<div class="ag0-bu-o">{ori}</div>' if ori else ''
    mins = round((c['b'] - c['a']) * 60)
    obs = f'<p class="ag0-bu-obs"><b>Observaciones:</b> {c["obs"]}</p>' if c['obs'] else ''
    det = (f'<div class="ag0-bu-d"><div class="ag0-bu-f">{ic(I["reloj"], 20, 2)}<span><span class="ag0-num"><b style="font-weight:600">{hm(c["a"])} – {hm(c["b"])}</b> · {mins} min</span><small>{dia_largo(c["d"])}</small></span></div>'
           f'<div class="ag0-bu-f"><span class="ag0-av2">AS</span><span>Dr. Admin Semilla</span></div>{obs}</div>')
    # principal, ayuda, rejilla y pie
    prin, ayuda, filas, pie = '', '', [], []
    if ev:
        filas = [('editar', 'Editar')]; pie = [('papelera', 'Eliminar evento', True)]
    elif ligar:
        prin = f'<button type="button" class="ag0-p ag0-bp">{ic(I["enlace"], 18, 2)}Ligar paciente e iniciar consulta</button>'
        ayuda = '<p class="ag0-bu-ay">Primero buscas su expediente o le creas uno.</p>'
        filas = [('confirmar', 'Confirmar', 'sub'), ('reagendar', 'Reagendar'), ('editar', 'Editar')]
        if tipo == 'gl': pie.append(('', '¿No es una cita?', False))
        pie.append(('x', 'Cancelar cita', True))
    elif e == 'aten':
        prin = f'<button type="button" class="ag0-p ag0-bp ag0-bp-t">{ic(I["docs"], 18, 2)}Ver la consulta</button>'
    elif e == 'canc':
        prin = f'<button type="button" class="ag0-p ag0-bp">{ic(I["reagendar"], 18, 2)}Darle otra cita</button>'
        ayuda = '<p class="ag0-bu-ay">Esta cita se canceló. Su horario quedó libre.</p>'
        filas = [('convertir', 'Reasignar el horario')]; pie = [('papelera', 'Eliminar cita', True)]
    elif e == 'noas':
        prin = f'<button type="button" class="ag0-p ag0-bp">{ic(I["reagendar"], 18, 2)}Darle otra cita</button>'
        ayuda = '<p class="ag0-bu-ay">El paciente no llegó a esta cita.</p>'
    else:
        prin = f'<button type="button" class="ag0-p ag0-bp">{ic(I["iniciar"], 18, 2)}Iniciar consulta</button>'
        filas = ([('confirmar', 'Confirmar', 'sub')] if e == 'ag' else []) + [('reagendar', 'Reagendar'), ('editar', 'Editar')] + ([('noasistio', 'No asistió')] if e == 'conf' else [])
        pie = [('x', 'Cancelar cita', True)]
    lista = ''
    for f in filas:
        if len(f) == 3:
            chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
            lista += (f'<button type="button" class="ag0-p ag0-op" aria-expanded="false" data-sub="conf">{ic(I[f[0]], 20, 2)}<span>{f[1]}</span>{chev}</button>'
                      f'<div class="ag0-sub" role="group" aria-label="Confirmar">'
                      f'<button type="button" class="ag0-p ag0-op"><span>Enviar por WhatsApp</span></button>'
                      f'<button type="button" class="ag0-p ag0-op"><span>Enviar por correo</span></button>'
                      f'<button type="button" class="ag0-p ag0-op"><span>Marcar como confirmada</span></button></div>')
        else:
            lista += op(f[0], f[1])
    if pie:
        lista += '<div class="ag0-sep" role="separator"></div>'
        for i, t, mal in pie:
            lista += op(i, t, cls='ag0-op-mal' if mal else '') if i else f'<button type="button" class="ag0-p ag0-op"><span style="color:var(--enlace);font-weight:600">{t}</span></button>'
    lista = f'<div class="ag0-bu-l">{lista}</div>' if lista else ''
    return f'<template data-bu="{c["id"]}"><div class="ag0-bu">{cab}{nom}{ori}{det}{prin}{ayuda}{lista}</div></template>'

# ------------------------------------------------------------------ CSS / JS / salida ------------------------------------------------------------------
CSS = open(f'{L}/tmp-nav.css').read() + '\n' + open(f'{L}/tmp-estilo.css').read()
JS = open(f'{L}/tmp-guion.js').read()

def escribe(n, nombre, desc, marcos, ficha, tira):
    import json
    cfg = json.dumps({'v': n, 'ficha': ficha, 'tira': tira}, ensure_ascii=False)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS}\n}})({cfg});\n</script>\n')
    p = f'{L}/vista-{n}.html'
    open(p, 'w').write(out)
    print(p, len(out))

import importlib.util
spec = importlib.util.spec_from_file_location('vistas', f'{L}/tmp-vistas.py')
mod = importlib.util.module_from_spec(spec)
mod.__dict__.update({k: v for k, v in globals().items() if not k.startswith('__')})
spec.loader.exec_module(mod)
