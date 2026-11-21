# Agenda · Ligado y Google (fase 2). Uso: python3 tmp-al-gen.py  → vista-1…4.html en esta carpeta.
# Carga las piezas base SIN escribir nada en agenda-base: ejecuta tmp-gen.py y tmp-vistas.py hasta antes de su escritura.
import os, json, copy, html as H
AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(AQUI, '..', 'agenda-base')
NS = {'__file__': os.path.join(BASE, 'tmp-gen.py')}
src = open(os.path.join(BASE, 'tmp-gen.py')).read()
exec(src[:src.index('import importlib.util')], NS)
srcv = open(os.path.join(BASE, 'tmp-vistas.py')).read()
exec(srcv[:srcv.index('# =========================================================== ESCRITURA')], NS)
g = NS
ic, I, gcal, sinexp, est, hm, hh, C, EST = g['ic'], g['I'], g['gcal'], g['sinexp'], g['est'], g['hm'], g['hh'], g['C'], g['EST']
VPS = g['VPS']
L = AQUI

# ------------------------------------------------------------------ SEMILLA de esta tanda ------------------------------------------------------------------
# Igual que la base, con tres cambios para que se vea lo que toca aquí:
#  · la reserva por enlace de Paciente Prueba 26 pasa a las 19:00 (futura: así «Confirmar» ofrece WhatsApp y correo, como hoy con una cita futura);
#  · Paciente Prueba 09 (16:00, atendida) llegó de Google y ya tiene expediente (marca de origen en una cita normal);
#  · un evento de Google de SOLO LECTURA (isGcalBlock) a las 19:30 y otro de todo el día.
CITAS = copy.deepcopy(g['CITAS'])
for c in CITAS:
    c.pop('pasado', None)
    if c['id'] == 'j8':
        c.update(a=19.0, b=19.5, tel='999 000 0026', correo='paciente26@semilla.spinus.test')
    if c['id'] == 'j9':
        c.update(ori='google')
    if c['id'] == 'j13':
        c.update(a=hh('18:20'), b=hh('18:50'))
for c in CITAS:
    if c['d'] < g['HOY'] or (c['d'] == g['HOY'] and c['b'] <= g['AHORA']):
        c['pasado'] = True
g['CITAS'][:] = CITAS          # la rejilla y la lista de la base leen esta lista
CIT = {c['id']: c for c in CITAS}
GRO = dict(id='g1', d=3, a=19.5, b=20.5, nom='Junta del hospital')
GRO_TODO = 'Sesión del colegio médico'

# ------------------------------------------------------------------ utilidades ------------------------------------------------------------------
_N = [0]
def uid(p):
    _N[0] += 1
    return f'{p}{_N[0]}'
TRI = '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>'
SPIN = '<path d="M12 3a9 9 0 1 0 9 9"/>'

def marco(v, vp, contenido, capas=''):
    return g['marco'](v, vp, contenido, capas).replace('class="marco ag0 ', 'class="marco al ah ag0 ', 1)

def bloque_gro(c):
    """Evento de Google de SOLO LECTURA (GoogleEventCard.tsx): G + hora + «Evento» + título. No es botón: hoy no abre nada
    (altaCitas.ts:346, `abrirCita` devuelve antes) ni se arrastra (`editable:false`, cacheEventosGoogle.ts:189)."""
    est_ = f'top:calc(var(--cal-h) * {c["a"] - g["T0"]:.4f} + 1px);height:calc(var(--cal-h) * {c["b"] - c["a"]:.4f} - 2px)'
    dur = g['dur_cls'](dict(a=c['a'], b=c['b']))
    aria = f'{c["nom"]}, {hm(c["a"])} a {hm(c["b"])}, evento de Google Calendar, solo lectura'
    return (f'<div class="ag0-b {dur} al-gro" style="{est_}" role="img" aria-label="{aria}">'
            f'<span class="ag0-b-in"><span class="ag0-b-l1"><span class="ag0-b-ico al-gro-g">{gcal(13)}</span><span class="ag0-b-hi">{hm(c["a"])}</span>'
            f'<span class="ag0-b-nom">{c["nom"]}</span><span class="ag0-b-nomc">{c["nom"]}</span></span>'
            f'<span class="ag0-b-l2"><span class="ag0-b-hora">{hm(c["a"])} – {hm(c["b"])}</span><span class="ag0-b-cons al-gro-ev">Evento</span></span></span></div>')

def chip_gro(t):
    return f'<span class="ag0-tc al-tcg" role="img" aria-label="{t}, todo el día, evento de Google Calendar, solo lectura">{gcal(12)}<span>{t}</span></span>'

def rejilla(vp, scroll=13.2, gro=False, ev13=False):
    h = g['rejilla'](vp, [g['HOY']], scroll=scroll)
    if ev13:   # el mismo evento ya marcado como «no es una cita»: evento sin paciente, conserva su origen Google
        c = dict(CIT['j13'], id='ev13', tipo='evn', evi='evento', sx=False)
        b = g['bloque'](c)
        h = h.replace('<span class="ag0-ahora"', b + '<span class="ag0-ahora"', 1)
    if gro:
        h = h.replace('<span class="ag0-ahora"', bloque_gro(GRO) + '<span class="ag0-ahora"', 1)
        # todo el día: el chip de Google va en la columna de hoy, junto al curso
        i = h.find('Curso de actualización')
        j = h.find('</div>', i)
        h = h[:j] + chip_gro(GRO_TODO) + h[j:]
    return h

def pantalla(vp, cuerpo_dia, cuerpo_sem=None, avisos=''):
    b, flota = g['barra'](vp, 'dia')
    b = NS2['parchea_barra'](b)
    if cuerpo_sem is None:
        return f'<main class="ag0-cont">{b}{avisos}{cuerpo_dia}{flota}</main>'
    caja = lambda k, x, on: f'<div data-modo="{k}" class="ag0-modo{" ag0-modo-on" if on else ""}" style="flex:1;min-height:0;flex-direction:column;display:{"flex" if on else "none"}">{x}</div>'
    return f'<main class="ag0-cont">{b}{avisos}{caja("dia", cuerpo_dia, True)}{caja("semana", cuerpo_sem, False)}{flota}</main>'

def semana(vp):
    if vp in ('ext', 'tel'):
        return g['lista_semana'](vp)
    return g['rejilla'](vp, list(range(7)), scroll=13.2)

def op(i, t, cls='', attrs='', icono=None):
    ico = icono if icono is not None else (ic(I[i], 20, 2) if i else '')
    return f'<button type="button" class="ag0-p ag0-op {cls}" role="menuitem"{attrs}>{ico}<span>{t}</span></button>'

ICO_NOES = I['evento']     # «dejarlo como evento»: el calendario con punto, el mismo icono de evento de la agenda

# ------------------------------------------------------------------ BURBUJA (contenido EXACTO de hoy, textos unificados §28) ------------------------------------------------------------------
def burbuja(id_tpl, c, puede=True, noes_ir=False, medico=True):
    """BurbujaCita.tsx + accionesTarjeta.ts (burbujaDeTarjeta). c['tipo']: 'cita' (reserva por ligar) · 'gl' (Google por asignar) ·
    'evn' (evento: lo que queda tras «¿No es una cita?») · cita normal con ori google."""
    e, tipo = c['e'], c['tipo']
    lig = c['sx']
    ev = tipo in ('ev', 'evn')
    x = f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>'
    if ev: ired = 'form-evento-bloqueo|Editar evento'
    elif tipo == 'gl': ired = 'form-cita|Google por asignar'
    elif lig: ired = 'form-cita|Reserva por enlace sin expediente (21)'
    else: ired = 'form-cita|Editar cita agendada (07)'
    IR = lambda d: f' data-ir="{d}"'
    mas = f'<button type="button" class="ag0-p ag0-x" aria-label="Más opciones de la cita" aria-haspopup="dialog"{IR(ired)}>{ic(I["editar"], 20, 2)}</button>'
    cab = f'<div class="ag0-bu-c">{est(e)}<span class="ag0-flex"></span>{x}</div>'   # sin lápiz: «Editar» (fila) es el único acceso al formulario
    nom = f'<h2 class="ag0-bu-n">{c["nom"]}</h2>'
    ori = ''
    if c['ori'] == 'google': ori += f'<span class="ag0-marca">{gcal(14)}Agendada desde Google Calendar</span>'
    if c['ori'] == 'enlace': ori += f'<span class="ag0-marca">{ic(I["enlace"], 14, 2)}Reservó por enlace</span>'
    if lig: ori += f'<span class="ag0-marca al-sx" role="img" aria-label="Sin expediente: este paciente aún no tiene expediente">{sinexp(14)}Sin expediente</span>'
    hist = f'<p class="al-bu-hist">{c["hist"]}</p>' if c.get('hist') else ''
    ori = f'<div class="ag0-bu-o">{ori}</div>{hist}' if ori else ''
    mins = round((c['b'] - c['a']) * 60)
    med = '<div class="ag0-bu-f"><span class="ag0-av2">AS</span><span>Dr. Admin Semilla</span></div>' if medico else ''
    obs = f'<p class="ag0-bu-obs"><b>Observaciones:</b> {c["obs"]}</p>' if c.get('obs') else ''
    det = (f'<div class="ag0-bu-d"><div class="ag0-bu-f">{ic(I["reloj"], 20, 2)}<span><span class="ag0-num"><b style="font-weight:600">{hm(c["a"])} – {hm(c["b"])}</b> · {mins} min</span>'
           f'<small>Jueves 19 de noviembre</small></span></div>{med}{obs}</div>')
    prin = ayuda = ''
    filas = ''
    pie = []
    if ev:
        filas = op('editar', 'Editar', attrs=IR(ired)) + op('convertir', 'Convertir en cita', attrs=IR('form-reagendar|abrir'))
        pie = [op('papelera', 'Eliminar evento', 'ag0-op-mal', attrs=IR('burbuja-pregunta|Eliminar evento'))]
    elif e == 'aten':   # atendida: SOLO «Ver la consulta» (accionesTarjeta.ts:160)
        prin = f'<button type="button" class="ag0-p ag0-bp ag0-bp-t" data-al="dest-exp">{ic(I["docs"], 18, 2)}Ver la consulta</button>'
        filas = op('editar', 'Editar', attrs=IR(ired))   # hoy el ⋮ abre el formulario también en una atendida
    else:
        if puede:
            prin = f'<button type="button" class="ag0-p ag0-bp" data-al="{("ligar-g" if tipo == "gl" else "ligar-r") if lig else "iniciar"}">{ic(I["enlace"] if lig else I["iniciar"], 18, 2)}{"Ligar paciente e iniciar consulta" if lig else "Iniciar consulta"}</button>'
            if lig: ayuda = '<p class="ag0-bu-ay">Primero buscas su expediente o le creas uno.</p>'
        futura = not c.get('pasado')
        sub = ''
        if e == 'ag':
            if c.get('tel') and futura: sub += f'<button type="button" class="ag0-p ag0-op"{IR("burbuja-burbuja|enviado por WhatsApp")}><span>Enviar por WhatsApp</span></button>'
            if c.get('correo') and futura: sub += f'<button type="button" class="ag0-p ag0-op"{IR("burbuja-burbuja|enviado por correo")}><span>Enviar por correo</span></button>'
            sub += f'<button type="button" class="ag0-p ag0-op"{IR("burbuja-pregunta|aviso: confirmada")}><span>Marcar como confirmada</span></button>'
            chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
            filas += (f'<button type="button" class="ag0-p ag0-op" aria-expanded="false" data-sub="conf">{ic(I["confirmar"], 20, 2)}<span>Confirmar</span>{chev}</button>'
                      f'<div class="ag0-sub" role="group" aria-label="Confirmar la cita">{sub}</div>')
        filas += op('reagendar', 'Reagendar', attrs=IR('form-reagendar|formulario con elección' if c['ori'] == 'enlace' else ired)) + op('editar', 'Editar', attrs=IR(ired))
        if e == 'conf': filas += op('noasistio', 'No asistió', attrs=IR('burbuja-pregunta|No asistió'))
        if tipo == 'gl':
            pie.append(op('', '¿No es una cita?<small>Dejarlo como evento sin paciente: deja de pedir que se ligue</small>', 'al-noes', ' data-al="noes"', icono=ic(ICO_NOES, 20, 2)))
        pie.append(op('x', 'Cancelar cita', 'ag0-op-mal', attrs=IR('burbuja-pregunta|Cancelar cita')))
    lista = filas
    if pie: lista += '<div class="ag0-sep" role="separator"></div>' + ''.join(pie)
    return f'<template data-bu="{id_tpl}"><div class="ag0-bu">{cab}{nom}{ori}{det}{prin}{ayuda}<div class="ag0-bu-l">{lista}</div></div></template>'

def capa_burbuja():
    import re as _r
    return _r.sub(r'<!--.*?-->\n?', '<!-- Burbuja de la cita como capa del catálogo (CALMA §25–§27). La pieza completa está en «La burbuja de la cita», página Cita. -->\n', g['capa_burbuja'](), count=1, flags=_r.S)

# ------------------------------------------------------------------ BOTONES Y CAMPOS DE CAPA ------------------------------------------------------------------
def b(t, cls='al-qui', attrs='', ico=''):
    return f'<button type="button" class="ag0-p al-b {cls}"{attrs}>{ico}<span>{t}</span></button>'

def err(t, cls=''):
    return f'<p class="al-err {cls}" role="alert">{ic(TRI, 16, 2)}<span>{t}</span></p>'

def cab_capa(t, idt):
    return (f'<div class="ag0-cjc"><h2 id="{idt}">{t}</h2>'
            f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>')

# ------------------------------------------------------------------ VENTANA DE LIGAR (VentanaLigarCita + PanelLigarCita + QuickPatientModal) ------------------------------------------------------------------
NUM_PAC = {'02': ('#E8E1F7', '#5B3FA0'), '20': ('#DDF0E6', '#1E6B45'), '21': ('#FBE3D6', '#9A4A1C'), '22': ('#DCEAF8', '#1F4F86'), '23': ('#F7E0EA', '#8E2D57'), '24': ('#F4EBD3', '#7A5A12'), '25': ('#E8E1F7', '#5B3FA0')}

def av(n):
    f, t = NUM_PAC.get(n, ('#DCEAF8', '#1F4F86'))
    return f'<span class="al-av" style="background:{f};color:{t}" aria-hidden="true">{n}</span>'

def paso_datos(tipo, vp):
    """Paso 1 (VentanaLigarCita.tsx:168-197). tipo 'r' = reserva por enlace · 'g' = Google por asignar."""
    if tipo == 'r':
        filas = [('Nombre', 'Paciente Prueba 26'), ('Teléfono', '999 000 0026'), ('Correo', 'paciente26@semilla.spinus.test'),
                 ('Día y hora', 'Jue 19 nov · 19:00 – 19:30'), ('Consultorio', 'Centro')]
    else:
        filas = [('Evento', 'Revisión de estudios'), ('Día y hora', 'Jue 19 nov · 18:20 – 18:50')]
    dl = ''.join(f'<div><dt>{k}</dt><dd class="{"ag0-num" if k in ("Teléfono", "Día y hora") else ""}">{v}</dd></div>' for k, v in filas)
    sel = ''
    if tipo == 'g':
        sel = (f'<label class="al-campo"><span class="al-lab">Consultorio</span><span class="al-selw"><select class="al-in al-sel">'
               f'<option>Centro</option><option>Hosp Norte</option><option>Rehab</option></select>{ic(I["abajo"], 16, 2.4)}</span></label>')
    noes = ''
    nid = uid('al-nd-')
    if tipo == 'g':
        noes = (f'<span class="al-noesw"><button type="button" class="ag0-p al-tx al-noes-b" data-al="noes-v" '
                f'aria-describedby="{nid}">¿No es una cita?</button>'
                f'<span id="{nid}" class="al-noes-exp">Dejarlo como evento sin paciente: deja de pedir que se ligue</span>'
                f'{err("Este evento ya no está por asignar.", "al-noes-err")}</span>')
    pie = (f'<div class="al-pie al-pie-3">{noes}<span class="ag0-flex"></span>'
           f'{b("Cancelar", "al-qui", " data-cierra=1")}{b("Ligar paciente e iniciar consulta", "al-prim", " data-al=buscar", ic(I["enlace"], 18, 2))}</div>')
    return (f'<div class="al-paso" data-p="datos-{tipo}"><div class="al-cu"><dl class="al-dl">{dl}</dl>{sel}</div>{pie}</div>')

def resultados():
    out = ''
    for n in ('02', '20', '21', '22', '23', '24', '25'):
        out += (f'<li><button type="button" class="ag0-p al-fila" data-al="elegir">{av(n)}<span class="al-fc"><b>Paciente Prueba {n}</b>'
                f'<small class="ag0-num">999 000 00{n}</small></span>{ic(I["sig"], 16, 2.2)}</button></li>')
    return out

def paso_buscar(vp):
    """Paso 2 (PanelLigarCita.tsx:35-78). Estados por clase en el paso: al-q-sin (sin coincidencias, precargado), al-q-bus (buscando),
    al-q-res (resultados), al-q-lig (ligando), al-q-err (error al ligar), al-q-goo (texto de hoy con un evento de Google)."""
    txt_r = ('Reservó Paciente Prueba 26 <span class="ag0-num">(999 000 0026 · paciente26@semilla.spinus.test)</span>. '
             'Elige su expediente o regístralo; después se abre la nota de la consulta.')
    txt_g = 'Reservó Revisión de estudios. Elige su expediente o regístralo; después se abre la nota de la consulta.'
    spin = ic(SPIN, 18, 2.2).replace('aria-hidden="true"', 'class="al-spin" aria-hidden="true"')
    lista = (f'<ul class="al-res" aria-label="Pacientes">'
             f'<li class="al-msg al-m-bus">{spin}<span>Buscando…</span></li>'
             f'<li class="al-msg al-m-sin">{ic(I["lupa"], 18, 2)}<span>Sin coincidencias.</span></li>'
             f'{resultados()}</ul>')
    campo = (f'<label class="al-bus">{ic(I["lupa"], 18, 2)}<input class="al-in" type="search" value="Paciente Prueba 26" data-v1="Paciente Prueba 26" data-v2="Prueba 2" '
             f'aria-label="Buscar paciente existente" placeholder="Buscar paciente existente…"></label>')
    pie = (f'<div class="al-pie al-pie-2">'
           f'<span class="al-ligando" role="status" aria-label="Ligando">{spin}</span><span class="ag0-flex"></span>'
           f'{b("Volver", "al-qui", " data-al=datos")}{b("Registrar paciente nuevo", "al-ton", " data-al=registro", ic(I["plus"], 16, 2.4))}</div>')
    return (f'<div class="al-paso" data-p="buscar"><div class="al-cu"><section aria-label="Ligar a un paciente">'
            f'<h3 class="al-rot">Ligar a un paciente</h3><p class="al-txt al-t-r">{txt_r}</p><p class="al-txt al-t-g">{txt_g}</p>'
            f'{campo}{lista}{err("No se pudo ligar la cita al paciente. Vuelve a intentarlo.", "al-e-lig")}'
            f'{err("Elige el consultorio antes de iniciar la consulta.", "al-e-cons")}'
            f'{err("No se pudo ligar la cita al paciente. Vuelve a intentarlo. El paciente ya quedó registrado: búscalo por su nombre.", "al-e-tras")}</section></div>{pie}</div>')

def paso_registro(vp):
    """QuickPatientModal.tsx (alta rápida de siempre) precargada con nombre, apellidos, correo y teléfono de quien reservó."""
    def campo(lab, val='', ph='', tipo='text', ayuda='', cls=''):
        a = f'<span class="al-ay">{ayuda}</span>' if ayuda else ''
        return f'<label class="al-campo {cls}"><span class="al-lab">{lab}</span><input class="al-in" type="{tipo}" value="{val}" placeholder="{ph}">{a}</label>'
    spin = ic(SPIN, 18, 2.2).replace('aria-hidden="true"', 'class="al-spin" aria-hidden="true"')
    cu = (f'{err("Nombre y apellidos son requeridos.", "al-e-reg")}'
          f'<div class="al-g2">{campo("Nombre", "Paciente")}{campo("Apellidos", "Prueba 26")}</div>'
          f'<div class="al-g2">{campo("Fecha de nacimiento", "", "dd/mm/aaaa")}{campo("Edad (opcional)", "", "Ej. 35", "text", "Si no conoces la fecha exacta, ingresa solo la edad")}</div>'
          f'{campo("Correo", "paciente26@semilla.spinus.test", "opcional", "email")}'
          f'{campo("Teléfono celular o WhatsApp", "999 000 0026", "opcional · 999 123 4567", "tel")}'
          f'<p class="al-ay">El expediente completo se puede editar después desde Pacientes.</p>'
          f'<label class="al-chk"><span>Paciente informado del <a href="#" class="al-a">aviso de privacidad</a></span><input type="checkbox" checked><span class="al-caja" aria-hidden="true">{ic(I["palomita"], 14, 3)}</span></label>')
    pie = (f'<div class="al-pie al-pie-2"><span class="ag0-flex"></span>{b("Cancelar", "al-qui", " data-al=buscar")}'
           f'<button type="button" class="ag0-p al-b al-prim al-crear" data-al="crear"><span class="al-c1">Crear y continuar</span><span class="al-c2">{spin}Registrando...</span></button></div>')
    return f'<div class="al-paso" data-p="registro"><div class="al-cu">{cu}</div>{pie}</div>'

def paso_estado():
    """EstadoVentana (VentanaLigarCita.tsx:253-263): cargando, error de lectura o el motivo, con «Ver la cita» si se abrió desde la campana."""
    spin = ic(SPIN, 20, 2.2).replace('aria-hidden="true"', 'class="al-spin" aria-hidden="true"')
    motivos = [('leer', 'No se pudo leer la cita. Vuelve a intentarlo.'), ('vig', 'Esta cita ya no está vigente.'), ('pl', 'Esta cita ya no está por ligar.'),
               ('med', 'Sólo el médico de la cita puede ligarla e iniciar la consulta.'), ('cons', 'El consultorio de esta cita no está entre los tuyos.')]
    ms = ''.join(f'<div class="al-mot" data-m="{k}">{err(t)}</div>' for k, t in motivos)
    return (f'<div class="al-paso" data-p="estado"><div class="al-cu"><p class="al-cargando" role="status">{spin}<span>Cargando…</span></p>{ms}</div>'
            f'<div class="al-pie al-pie-2 al-pie-ver"><span class="ag0-flex"></span>{b("Ver la cita", "al-qui", " data-al=vercita")}</div></div>')

def capa_ligar(vp):
    idt = uid('al-lt-')
    return (f'<!-- Ventana de ligar como MODAL del catálogo (CALMA §25/§26): tarjeta centrada en Duo cerrado (310), Duo abierto y computadora (440); hoja inferior en iPhone.\n'
            f'     Hoy: capa centrada de 360 en la VENTANA (.ag-capa--centro), con velo literal sin desenfoque. Un solo velo: el alta rápida («Registrar paciente»)\n'
            f'     ocupa la MISMA tarjeta en vez de montarse encima (hoy QuickPatientModal abre un segundo modal con su propio velo). -->\n'
            f'<div class="ag0-capa al-capa" data-capa="ligar" data-paso="datos-r" aria-hidden="true">'
            f'<div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj al-mod" role="dialog" aria-modal="true" aria-labelledby="{idt}"><span class="ag0-asa" aria-hidden="true"></span>'
            f'<div class="al-cabs"><span class="al-h-l">{cab_capa("Ligar paciente e iniciar consulta", idt)}</span><span class="al-h-r">{cab_capa("Registrar paciente", idt + "r")}</span></div>'
            f'<div class="al-pasos">{paso_estado()}{paso_datos("r", vp)}{paso_datos("g", vp)}{paso_buscar(vp)}{paso_registro(vp)}</div></div></div>')

def capa_duplicado():
    """Duplicado del alta rápida: la alerta del catálogo «Paciente duplicado» (capas-a vista-1, variante de tres acciones, §23.7)."""
    ico = ic('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>', 28, 2)
    return (f'<div class="ag0-capa al-capa" data-capa="dup" aria-hidden="true"><div class="ag0-velo"></div>'
            f'<div class="ag0-cj al-al" role="alertdialog" aria-modal="true" aria-label="Paciente duplicado"><span class="al-al-i" aria-hidden="true">{ico}</span>'
            f'<h2>Paciente duplicado</h2><p class="al-al-t" lang="es">Ya existe un paciente con los mismos datos: Paciente Prueba 26 (Exp. #<span class="ag0-num">EXP-2026-0026</span>). ¿Es el mismo paciente o una persona distinta? Si es otra persona, se creará el registro de todos modos.</p>'
            f'<div class="al-pila">{b("Es el mismo paciente", "al-prim", " data-al=elegir")}{b("Es otra persona", "al-ton", " data-al=elegir")}{b("Cancelar", "al-qui", " data-al=registro")}</div></div></div>')

def destino(vp):
    """A dónde lleva al terminar: /expediente/{id}/nueva-nota?cita=… (VentanaLigarCita.tsx:223-225), con el consultorio de la cita como activo."""
    nav = {'ext': g['riel'](), 'tel': g['encabezado'](), 'iv': g['enc_iv'](), 'ih': g['lateral'](), 'esc': g['lateral']()}[vp]
    nav = nav.replace(' aria-current="page"', '')
    nav = nav.replace('aria-label="Expediente">', 'aria-label="Expediente" aria-current="page">', 1)
    nav = nav.replace('class="ag0-p ag0-li">' + ic(I['pac'], 20) + 'Expediente', 'class="ag0-p ag0-li" aria-current="page">' + ic(I['pac'], 20) + 'Expediente', 1)
    nav = nav.replace('<a href="#" class="ag0-p ag0-pv">Expediente</a>', '<a href="#" class="ag0-p ag0-pv" aria-current="page">Expediente</a>')
    nav = nav.replace('<span class="ag0-enc-t">Agenda</span>', '<span class="ag0-enc-t">Expediente</span>')
    nota = (f'<main class="al-dc" data-d="nota"><a href="#" class="ag0-p al-volver">{ic(I["ant"], 16, 2.4)}Paciente Prueba 26</a><h1 class="al-h1">Nueva nota</h1>'
            f'<p class="al-sub ag0-num">Jue 19 nov 2026 · Centro</p>'
            f'<section class="al-tar" lang="es"><p class="al-rot">Nota</p><p class="al-tt">Nota de evolución ficticia de la semilla. Dolor lumbar mecánico de dos semanas de evolución, '
            f'sin irradiación ni datos de alarma; la exploración no muestra déficit neurológico y la movilidad está limitada por dolor en la flexión.</p>'
            f'<p class="al-rot">Plan</p><p class="al-tt">Plan ficticio: analgesia, higiene de columna y revisión en dos semanas.</p></section></main>')
    expd = (f'<main class="al-dc" data-d="exp"><a href="#" class="ag0-p al-volver">{ic(I["ant"], 16, 2.4)}Expediente</a><h1 class="al-h1">Paciente Prueba 09</h1>'
            f'<p class="al-sub ag0-num">EXP-2026-0009 · 999 000 0009</p>'
            f'<section class="al-tar" lang="es"><p class="al-rot">Consulta · Jue 19 nov 2026, 16:00</p><p class="al-tt">Nota de evolución ficticia de la semilla. Gonalgia mecánica, control; '
            f'exploración sin derrame y arcos completos.</p></section></main>')
    perf = (f'<main class="al-dc" data-d="perfil"><h1 class="al-h1">Mi perfil</h1><p class="al-sub">Datos · Consultorios · <b>Google Calendar</b></p>'
            f'<section class="al-tar" aria-label="Google Calendar"><p class="al-rot">Google Calendar</p><p class="al-tt">No se pudo comprobar la conexión.</p>'
            f'{err("Google no respondió. Tu conexión sigue guardada; no hace falta que la rehagas.")}'
            f'<div><button type="button" class="ag0-p al-b al-ton" data-al="reint">Reintentar</button></div></section></main>')
    cont = nota + expd + perf
    app = (cont + nav) if vp in ('ext', 'ih') else (nav + cont)
    return f'<div class="al-dest" aria-hidden="true"><div class="ag0-app">{app}</div></div>'

# ------------------------------------------------------------------ BLOQUE DE LA RESERVA EN EL FORMULARIO (BloqueReservaPorLigar.tsx / AppointmentModal.tsx:1380-1395) ------------------------------------------------------------------
def capa_form(vp):
    marcas = (f'<div class="ag0-bu-o"><span class="ag0-marca al-sx">{sinexp(14)}Sin expediente</span>'
              f'<span class="ag0-marca">{ic(I["enlace"], 14, 2)}Reservó por enlace</span></div>')
    reserva = (f'<div class="al-brl al-f-r">{marcas}<p class="al-brl-n">Paciente Prueba 26</p>'
               f'<p class="al-brl-c ag0-num">999 000 0026 · paciente26@semilla.spinus.test</p>'
               f'<p class="al-brl-h al-h-snap">Al reservar traía 1 cancelación o inasistencia</p>'
               f'<p class="al-brl-h al-h-vivo">Con este médico: 1 cancelación</p>'
               f'<p class="al-brl-bq">Bloqueado para reservar por el enlace hasta el 3 dic 2026</p>'
               f'<button type="button" class="ag0-p al-tx al-bq-on" data-al="f-bloq">Bloquear contacto</button>'
               f'<button type="button" class="ag0-p al-tx al-bq-off" data-al="f-desb">Desbloquear contacto</button>'
               f'{err("No se pudo bloquear el contacto.", "al-f-err")}'
               f'<p class="al-brl-pie">Se liga a un paciente al iniciar la consulta.</p></div>')
    google = (f'<div class="al-brl al-f-g"><div class="ag0-bu-o"><span class="ag0-marca">{gcal(14)}Agendada desde Google Calendar</span>'
              f'<span class="ag0-marca al-sx">{sinexp(14)}Sin expediente</span></div>'
              f'<p class="al-brl-pie al-brl-g">Evento nuevo de Google, por asignar: se liga a un paciente al iniciar la consulta.</p>'
              f'<span class="al-noesw al-noes-f"><button type="button" class="ag0-p al-tx" >¿No es una cita?</button><span class="al-noes-exp">Dejarlo como evento sin paciente: deja de pedir que se ligue</span></span></div>')
    idt = uid('al-ft-')
    return (f'<!-- Fragmento del FORMULARIO COMPLETO (AppointmentModal, otro agente): solo el bloque que ocupa el sitio del campo «Paciente» mientras la cita\n'
            f'     no tiene paciente. Reserva por enlace → BloqueReservaPorLigar; evento de Google por asignar → la línea de AppointmentModal.tsx:1382 + «¿No es una cita?». -->\n'
            f'<div class="ag0-capa al-capa" data-capa="form" data-f="r" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj al-mod al-form" role="dialog" aria-modal="true" aria-labelledby="{idt}"><span class="ag0-asa" aria-hidden="true"></span>{cab_capa("Editar cita", idt)}'
            f'<div class="ag0-cj-in"><div class="al-cu"><p class="al-lab">Paciente</p>{reserva}{google}'
            f'<div class="al-maq">Resto del formulario completo (fecha, hora, estado, médico, consultorio, tipo, notas, pie): otro agente.</div></div></div></div></div>')

# ------------------------------------------------------------------ AVISO BREVE (toast, catálogo capas-b vista-1) ------------------------------------------------------------------
def toast():
    return (f'<div class="al-toast" role="alert" aria-live="assertive"><span class="al-toast-i">{ic(TRI, 18, 2)}</span><span class="al-toast-t">No puedes cambiar este evento.</span></div>')

# ------------------------------------------------------------------ CSS y JS propios ------------------------------------------------------------------
HERR = os.path.join(AQUI, '..', 'ag-herr')
NS2 = {}
if globals().get('__name__') != 'pieza':   # ag-herr importa este generador como «pieza»: sin esta guarda, recursión
    NS2 = {'__file__': os.path.join(HERR, 'tmp-gen-ah.py'), '__name__': 'herr'}
    _s2 = open(os.path.join(HERR, 'tmp-gen-ah.py')).read()
    exec(_s2[:_s2.index('# ================================================================== SALIDA')], NS2)
import re as _re
def herr(vp, n):
    h = (NS2['menu_ah'](vp) + g['capa_fecha'](vp) + NS2['buscador'](vp, n) + NS2['campana'](vp) + NS2['capa_leyenda'](vp)
         + NS2['capa_atajos'](vp) + NS2['medicos_lb'](vp) + NS2['huecos_capa'](vp))
    h = _re.sub(r'(id|for|aria-controls|aria-labelledby)="ah-', lambda m: f'{m.group(1)}="al{n}-ah-', h)
    return h
CSS_AH = open(os.path.join(HERR, 'tmp-ah.css')).read()
CSS_AL = open(os.path.join(AQUI, 'tmp-al.css')).read()
JS_AL = open(os.path.join(AQUI, 'tmp-al.js')).read()
CSS_BASE = g['CSS']
JS_BASE = g['JS']

def salida(n, archivo, nombre, desc, marcos, ficha, tira, **extra):
    cfg = dict(v=f'al{n}', ficha=ficha, tira=tira); cfg.update(extra)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS_BASE}\n{CSS_AH}\n{CSS_AL}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS_BASE}\n{JS_AL}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = os.path.join(L, f'vista-{archivo}.html')
    open(p, 'w').write(out); print(p, len(out))

exec(open(os.path.join(AQUI, 'tmp-al-vistas.py')).read())
