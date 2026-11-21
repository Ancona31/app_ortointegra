# Generador de las cuatro vistas del catálogo de capas (CALMA §25). Uso: python3 tmp-gen.py
# Estilo y guion compartidos (tmp-estilo.css, tmp-guion.js) con el prefijo PX, que aquí se sustituye por ca1…ca4.
import os, json
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8, extra=''):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}>{d}</svg>'

I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    perfil='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    pts='<path d="M5.5 12h.01M12 12h.01M18.5 12h.01"/>',
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    basura='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    error='<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3h.01"/>',
    guardar='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m9 14.5 2.2 2.2 4-4.4"/>',
    persona2='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    enviar='<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    compartir='<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
    regen='<path d="M20 11a8 8 0 0 0-14.5-4.2L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 4.2L20 15.5M20 20v-4.5h-4.5"/>',
    folder='<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    esteto='<path d="M5 3.5V8a4.5 4.5 0 0 0 9 0V3.5M9.5 12.5V15a5 5 0 0 0 10 0v-1.5"/><circle cx="19.5" cy="11.5" r="2"/>',
    enlace='<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    capas='<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    descargar='<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    # orden (de la lista de pacientes aprobada)
    arr='<path d="M12 19V5M6 11l6-6 6 6"/>', aba='<path d="M12 5v14M6 13l6 6 6-6"/>',
    o_ape='<path d="M4 17 7.5 7 11 17M5.2 13.8h4.6M14 7h6l-6 10h6"/>', o_nom='<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    o_exp='<path d="M5 9h14M5 15h14M9.5 4 8 20M16 4l-1.5 16"/>', o_edad='<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    o_ing='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    o_med='<path d="M6 4v5a4 4 0 0 0 8 0V4M10 13v2.5a4.5 4.5 0 0 0 9 0V14"/><circle cx="19" cy="12" r="2"/>',
    # estados de cita (dashboard aprobado)
    palomita='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    doble='<path d="m2.5 12.5 4 4L15 8"/><path d="m11.5 16 .5.5L21.5 8"/>',
    calreloj='<path d="M20 10.5V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5"/><path d="M4 10h16M8 3v4M16 3v4"/><circle cx="17" cy="17" r="4.5"/><path d="M17 15v2.2l1.5 1"/>',
    noasistio='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M4 4l16 16"/>',
)
# Tipos de documento: tono e icono, tal cual doc-color (CALMA §9)
D = [('receta', 'Receta', '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>', 'receta'),
     ('lab', 'Laboratorio', '<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>', 'laboratorio'),
     ('imagen', 'Imagenología', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>', 'imagen'),
     ('suplementacion', 'Suplementación', '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>', 'suplementacion'),
     ('internamiento', 'Internamiento', '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>', 'internamiento'),
     ('escrito', 'Escrito médico', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'escrito'),
     ('consentimiento', 'Consentimiento', '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>', 'consentimiento'),
     ('honorarios', 'Honorarios / Cotización', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>', 'honorarios')]
DI = {k: (n, p, c) for k, n, p, c in D}
EST = dict(ag=('Agendada', 'calreloj'), conf=('Confirmada', 'palomita'), canc=('Cancelada', 'x'), noas=('No asistió', 'noasistio'), aten=('Atendida', 'doble'))
AV = {'01': ('#F1DCEC', '#7A2E6B'), '07': ('#EBDCCB', '#5A3A1A'), '12': ('#D7E8DC', '#1F5A3A'), '23': ('#F6D8D1', '#8A2F1F'),
      '25': ('#DCE6F7', '#1F3F7A'), '24': ('#EBDCCB', '#5A3A1A'), '22': ('#F1DCEC', '#7A2E6B')}

def av(n):
    bg, fg = AV[n]
    return f'<span class="PX-avt" style="background:{bg};color:{fg}" aria-hidden="true">{n}</span>'

def est(k, texto=True, s=15):
    t, i = EST[k]
    c = f'<span class="PX-est-c">{ic(I[i], s, 2.2)}</span>'
    if texto:
        return f'<span class="PX-est PX-est-{k}">{c}<span class="PX-est-t">{t}</span></span>'
    return f'<span class="PX-est PX-est-{k}" role="img" aria-label="{t}">{c}</span>'

def dico(k, s=20):
    n, p, c = DI[k]
    return f'<span class="PX-dico" style="--c:var(--d-{c})">{ic(p, s)}</span>'

# ---------- Navegación (del dashboard aprobado; el activo lo pone el guion según la pantalla de fondo) ----------
def riel():
    def b(k, t, n):
        return f'<a href="#" class="PX-p PX-rb" data-n="{n}" aria-label="{t}">{ic(I[k], 22)}</a>'
    return f'''<nav class="PX-riel" aria-label="Navegación principal">
  {b("inicio","Inicio","inicio")}{b("pac","Expediente","exp")}{b("agenda","Agenda","agenda")}{b("docs","Documentos","docs")}<a href="#" class="PX-p PX-rb" data-n="mas" aria-label="Más">{ic(I["mas"], 22, 3)}</a>
  <span class="PX-flex"></span>
  <button type="button" class="PX-p PX-mas" aria-label="Nueva consulta">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lateral():
    def a(k, t, n):
        return f'<a href="#" class="PX-p PX-li" data-n="{n}">{ic(I[k], 20)}{t}</a>'
    return f'''<nav class="PX-lat" aria-label="Navegación principal">
  <div class="PX-lat-cab"><span class="PX-logo">{ic(I["logo"], 24)}<span class="PX-logo-n">Spinus</span></span><span class="PX-plan">Plan VIP</span></div>
  <button type="button" class="PX-p PX-cons-b"><span class="PX-yo">AS</span><span class="PX-cons-t"><span>Consultorio</span><b>Centro</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="PX-lista">{a("inicio","Inicio","inicio")}{a("pac","Expediente","exp")}{a("agenda","Agenda","agenda")}{a("docs","Documentos","docs")}{a("admin","Administración","admin")}</div>
  <span class="PX-flex"></span>
  <div class="PX-lat-pie"><a href="#" class="PX-p PX-li PX-yo2">{ic(I["perfil"], 20)}<span><span>Dr. Admin Semilla</span><small>Mi perfil · Ajustes</small></span></a></div>
</nav>'''

def encabezado():
    return f'''<header class="PX-enc">
  <button type="button" class="PX-p PX-hamb" aria-label="Menú">{ic(I["menu"], 22, 2)}</button>
  <span class="PX-enc-t">Expediente</span><span class="PX-flex"></span>
  <button type="button" class="PX-p PX-yo" aria-label="Mi perfil">AS</button>
</header>'''

def enc_iv():
    def p(t, n):
        return f'<a href="#" class="PX-p PX-pv" data-n="{n}">{t}</a>'
    return f'''<header class="PX-env">
  <button type="button" class="PX-p PX-envb" aria-label="Mostrar barra lateral">{ic(I["barra"], 20)}</button>
  <nav class="PX-pista" aria-label="Secciones">{p("Inicio","inicio")}{p("Expediente","exp")}{p("Agenda","agenda")}{p("Documentos","docs")}{p("Más","mas")}</nav>
  <button type="button" class="PX-p PX-yo" aria-label="Mi perfil">AS</button>
</header>'''

def volver(t):
    return f'<div class="PX-cabf"><a href="#" class="PX-p PX-volver">{ic(I["volver"], 16, 2.2)}{t}</a></div>'

def fondo(vs, nav, tt, html):
    return f'<div class="PX-fondo" data-vs="{vs}" data-nav="{nav}" data-tt="{tt}" hidden>{html}</div>'

def marco(px, vp, fondos, capas):
    cont = f'<main class="PX-cont" lang="es">{fondos}</main>'
    if vp == 'ext':
        app = cont + riel()
    elif vp == 'tel':
        app = encabezado() + cont
    elif vp == 'iv':
        app = enc_iv() + cont
    elif vp == 'ih':
        app = cont + lateral()
    else:
        app = lateral() + cont
    return f'<div class="marco PX" data-vp="{vp}" lang="es">\n<div class="PX-app">{app}</div>\n<div class="PX-velo" aria-hidden="true"></div>\n{capas}\n</div>'

def cita_filas(abre):
    filas = [('12', '18:30', 'Paciente Prueba 12', 'Dr. Admin Semilla · Centro', 'conf', 'Jue 19 nov · 18:30 – 19:00'),
             ('23', '19:00', 'Paciente Prueba 23', 'Dr. Admin Semilla · Centro', 'ag', 'Jue 19 nov · 19:00 – 19:30'),
             ('07', '19:30', 'Paciente Prueba 07', 'Dra. Invitada Semilla · Rehab', 'conf', 'Jue 19 nov · 19:30 – 20:00')]
    out = ''
    for n, h, nom, med, e, cu in filas:
        a = f' data-abre="cita" data-nom="{nom}" data-cuando="{cu}" data-med="{med}" data-est="{e}"' if abre else ''
        out += f'<button type="button" class="PX-p PX-fila"{a}><span class="PX-hora">{h}</span><span class="PX-fila-t"><span class="PX-fila-n">{nom}</span><span class="PX-fila-s">{med}</span></span>{est(e, False)}{ic(I["sig"], 14, 2.4).replace("<svg", "<svg class=\"PX-chev\"", 1)}</button>'
    return out

CHEV = ic(I["sig"], 14, 2.4).replace('<svg', '<svg class="PX-chev"', 1)
NOTA_TXT = ('Nota de evolución ficticia de la semilla. Dolor lumbar mecánico de dos semanas de evolución, sin irradiación ni datos de alarma; '
            'la exploración no muestra déficit neurológico y la movilidad está limitada por dolor en la flexión.')
PLAN_TXT = 'Plan ficticio: analgesia, higiene de columna y revisión en dos semanas.'

# =========================== VISTA 1 · ALERTA ===========================
def v1():
    f_nota = fondo('conf largo', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Paciente Prueba 01")}<h1 class="PX-h1">Nueva nota</h1><p class="PX-sub PX-num">Jue 19 nov 2026 · Centro</p></header>
<section class="PX-tar PX-pad"><p class="PX-rot">Nota</p><p class="PX-txt">{NOTA_TXT}</p><p class="PX-rot">Plan</p><p class="PX-txt">{PLAN_TXT}</p></section>
<div class="PX-accs"><button type="button" class="PX-p PX-tx" data-abre="largo">Concluir consulta</button><button type="button" class="PX-p PX-b PX-prim" data-abre="conf">Guardar nota</button></div>''')
    f_exp = fondo('dest', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Expediente")}<div class="PX-quien">{av("01")}<div class="PX-cab"><h1 class="PX-h1">Paciente Prueba 01</h1><p class="PX-sub PX-num">73 años · Femenino · EXP-2026-0001</p></div></div></header>
<section class="PX-tar"><dl><div class="PX-par"><dt>Teléfono</dt><dd class="PX-num">999 000 0001</dd></div><div class="PX-par"><dt>Correo</dt><dd>paciente01@semilla.spinus.test</dd></div><div class="PX-par"><dt>Médico</dt><dd>Dr. Admin Semilla</dd></div></dl></section>
<!-- En el producto «Eliminar paciente» vive en el menú «···» del expediente (vista 4); aquí se dibuja como fila para abrir la alerta. -->
<section class="PX-tar"><button type="button" class="PX-p PX-fila PX-mal-t" data-abre="dest">{ic(I["basura"], 20)}<span class="PX-fila-t"><span class="PX-fila-n">Eliminar paciente</span></span></button></section>''')
    f_form = fondo('info tres', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Expediente")}<h1 class="PX-h1">Nuevo paciente</h1></header>
<section class="PX-tar PX-pad"><div class="PX-campos"><label class="PX-campo"><span>Nombre *</span><input class="PX-in" type="text" value="Paciente Prueba 07" autocomplete="off"></label>
<label class="PX-campo"><span>Fecha de nacimiento</span><input class="PX-in" type="text" value="14/03/1972" autocomplete="off"></label></div></section>
<div class="PX-accs"><button type="button" class="PX-p PX-b PX-prim" data-abre="@">Registrar e ir al expediente</button></div>''')
    fondos = f_nota + f_exp + f_form

    def alerta(c, aria, ico, cls_i, tit, txt, cls_t, botones, cls_b='', velo='no', foco=None):
        return f'''<div class="PX-capa" data-c="{c}" data-k="alerta" data-velo="{velo}">
  <div class="PX-card PX-al" role="alertdialog" aria-modal="true" aria-label="{aria}" tabindex="-1">
    <span class="PX-al-i {cls_i}" aria-hidden="true">{ic(I[ico], 28)}</span>
    <h2>{tit}</h2>{f'<p class="PX-al-t {cls_t}">{txt}</p>' if txt else ''}
    <div class="PX-al-b {cls_b}">{botones}</div>
  </div>
</div>'''
    B = lambda t, cl, foco=False: f'<button type="button" class="PX-p PX-b {cl}" data-cierra{" data-foco" if foco else ""}>{t}</button>'
    capas = (
        '<!-- Variante 1 · Confirmación simple (pub-nota «¿Guardar esta nota?»): icono tonal, dos botones del mismo ancho, secundario a la izquierda. -->\n'
        + alerta('conf', '¿Guardar esta nota?', 'guardar', 'PX-i-ton', '¿Guardar esta nota?',
                 'Una vez guardada, no podrá modificarse por motivos de seguridad y cumplimiento normativo. Si necesitas hacer correcciones después, podrás agregar una nota aclaratoria (addendum).', '',
                 B('Revisar', 'PX-qui') + B('Guardar nota', 'PX-prim PX-pri', True))
        + '\n<!-- Variante 2 · Destructiva (expediente «Eliminar paciente», §15): icono y botón en rojo suave; el foco entra en «Cancelar». -->\n'
        + alerta('dest', 'Eliminar paciente', 'basura', 'PX-i-mal', 'Eliminar paciente',
                 '<b>Paciente Prueba 01</b><br>Esta acción no se puede deshacer.', 'PX-cen',
                 B('Cancelar', 'PX-qui', True) + B('Eliminar', 'PX-mal PX-pri'))
        + '\n<!-- Variante 3 · Informativa, un botón (nuevo paciente «No se pudo guardar», §20). Texto de hoy, sin acento en «conexion» (CALMA §10). -->\n'
        + alerta('info', 'No se pudo guardar', 'error', 'PX-i-mal', 'No se pudo guardar',
                 'Error de conexion. Verifica tu internet e intenta de nuevo.', 'PX-cen',
                 B('Aceptar', 'PX-prim PX-pri', True), 'PX-uno')
        + '\n<!-- Variante 4 · Rótulos largos apilados (pub-nota «¿Concluir la consulta?», §23.3): principal arriba, rótulos completos de hoy. -->\n'
        + alerta('largo', '¿Concluir la consulta?', 'aviso', 'PX-i-ag', '¿Concluir la consulta?',
                 'Tienes <b>una receta empezada</b> y sin imprimir. Si concluyes ahora, no se emite. Puedes concluir de todos modos: no todo lo que se empieza se entrega.', '',
                 B('Seguir llenando', 'PX-qui', True) + B('Concluir de todos modos', 'PX-prim PX-pri'), 'PX-pila')
        + '\n<!-- Variante 5 · Tres acciones (nuevo paciente «Paciente duplicado», §23.7): apiladas, principal arriba, luego tonal y «Cancelar». -->\n'
        + alerta('tres', 'Paciente duplicado', 'aviso', 'PX-i-ag', 'Paciente duplicado',
                 'Ya existe un paciente con los mismos datos: Paciente Prueba 07 (Exp. #<span class="PX-num">EXP-2026-0007</span>). ¿Es el mismo paciente o una persona distinta?', 'PX-izq',
                 B('Es el mismo paciente', 'PX-prim PX-pri', True) + B('Es otra persona, crear de todos modos', 'PX-ton') + B('Cancelar', 'PX-qui'), 'PX-pila')
    )
    ficha = FICHA_COMUN_TOP + '''<h3>Especificación · Alerta</h3>
<p>Solo para lo destructivo, lo irreversible o un error que hay que leer. Nace del centro (escala .96 → 1 con fundido) y vuelve por el mismo camino.</p>
<table><thead><tr><th></th><th>ext</th><th>tel</th><th>ih</th><th>iv</th><th>esc</th></tr></thead><tbody>
<tr><th>Ancho</th><td>310 (margen 8 en el área de 326)</td><td>320</td><td>340</td><td>340</td><td>340</td></tr>
<tr><th>Centro</th><td>área de contenido: sin riel, franja ni indicador</td><td>entre barra de estado e indicador</td><td>área de contenido (cruza la bisagra)</td><td>bajo la barra de estado</td><td>a la derecha de la barra lateral</td></tr>
<tr><th>Botones</th><td>44</td><td>44</td><td>40</td><td>44</td><td>40</td></tr>
</tbody></table>
<dl>
<dt>Caja</dt><dd>Radio 20, relleno 24, sombra de capa. Icono 28 en círculo 48: tonal (confirmar), rojo suave (destruir, error), ámbar (avisar). Título 17/700 centrado; mensaje 14/20 en <b>--tinta2</b>, justificado con la última línea centrada (centrado si es una línea; a la izquierda si lleva un folio).</dd>
<dt>Botones</dt><dd>Dos del mismo ancho, lado a lado: secundario (quieto <b>--sup2</b>) a la izquierda, principal a la derecha (relleno <b>--accion</b>; destructivo <b>--mal-fondo</b>/<b>--mal-tinta</b>). Uno solo: a todo el ancho. Rótulos largos o tres acciones: apilados a todo el ancho, principal arriba, sin acortar (§23.3); el rótulo parte en dos líneas si no cabe.</dd>
<dt>Resorte</dt><dd>Entrada ζ 1.0, respuesta .36 s; salida ζ 1.0, .24 s. Interrumpible: «Cerrar» a medio abrir invierte desde la escala y opacidad que hay en pantalla.</dd>
<dt>Cierre</dt><dd>Solo con sus botones o Esc (= el secundario). Tocar el velo NO la cierra.</dd>
<dt>Velo</dt><dd>Sí: <b>--velo</b> + blur(10px) saturate(140%). Uno solo aunque se encadenen capas.</dd>
<dt>Foco y teclado</dt><dd>role="alertdialog", aria-modal; el foco entra en el principal, salvo en la destructiva (entra en «Cancelar»); la pantalla queda inerte (Tab no sale); Esc cierra; al cerrar vuelve al botón que la abrió.</dd>
<dt>Movimiento reducido</dt><dd>Sin escala: fundido lineal 200 ms al entrar, 150 al salir.</dd>
<dt>Transparencia reducida</dt><dd>Velo sin desenfoque y totalmente opaco: <b>--navy</b> al 100 % en oscuro; en claro, el color sólido equivalente (<b>--navy</b> 45 % sobre <b>--fondo</b>). No se adivina el fondo.</dd>
</dl>'''
    return ('Alerta', 'Una sola alerta para toda la app: icono en círculo tintado, título centrado y botones de verdad del mismo ancho, en cinco casos reales (confirmar, destruir, informar, rótulos largos y tres acciones).',
            fondos, capas, ficha, [['conf', 'Confirmación'], ['dest', 'Destructiva'], ['info', 'Informativa'], ['largo', 'Rótulos largos'], ['tres', 'Tres acciones']], 'conf', '')

FICHA_COMUN_TOP = ''

# =========================== VISTA 2 · MODAL ===========================
def v2():
    f_cons = fondo('add', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Paciente Prueba 01")}<h1 class="PX-h1">Nota de Evolución Médica</h1><p class="PX-sub PX-num">17 nov 2026 · 11:26 · Centro</p></header>
<section class="PX-tar PX-pad"><p class="PX-rot">Nota</p><p class="PX-txt">{NOTA_TXT}</p><p class="PX-rot">Plan</p><p class="PX-txt">{PLAN_TXT}</p></section>
<section class="PX-sec"><div class="PX-sec-c"><h2 class="PX-h2">Notas aclaratorias</h2><button type="button" class="PX-p PX-b PX-ton" data-abre="add">Agregar nota aclaratoria (addendum)</button></div></section>''')
    docs = ''.join(f'<button type="button" class="PX-p PX-fila" data-abre="pdf">{dico(k)}<span class="PX-fila-t"><span class="PX-fila-n">{n}</span><span class="PX-fila-s PX-num">{s}</span></span>{CHEV}</button>'
                   for k, n, s in (('receta', 'Receta', '17 nov 2026 · Dr. Admin Semilla'), ('lab', 'Laboratorio', '30 oct 2026 · Dr. Admin Semilla')))
    f_exp = fondo('largo pdf', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Expediente")}<div class="PX-quien">{av("01")}<div class="PX-cab"><h1 class="PX-h1">Paciente Prueba 01</h1><p class="PX-sub PX-num">73 años · Femenino · EXP-2026-0001</p></div></div></header>
<section class="PX-sec"><div class="PX-sec-c"><h2 class="PX-h2">Mediciones</h2><button type="button" class="PX-p PX-b PX-ton" data-abre="largo">Agregar medición</button></div>
<div class="PX-tar"><dl><div class="PX-par"><dt>Glucosa en ayuno</dt><dd class="PX-num">98 mg/dL</dd></div><div class="PX-par"><dt>Peso</dt><dd class="PX-num">68 kg</dd></div></dl></div></section>
<section class="PX-sec"><h2 class="PX-h2">Documentos</h2><div class="PX-tar">{docs}</div></section>''')
    fondos = f_cons + f_exp
    X = f'<button type="button" class="PX-p PX-ib" data-cierra aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>'
    sug = lambda c, items: f'<p class="PX-rot">{c}</p>' + ''.join(f'<button type="button" class="PX-p PX-mi" role="option" aria-selected="false"><span class="PX-mt">{n}<small>{u}</small></span></button>' for n, u in items)
    capas = f'''<!-- Variante 1 · Formulario corto: «Nueva nota aclaratoria» (consulta aprobada). Hoja en teléfono; modal 480 centrado en ancho.
     Sin «X»: el pie ya tiene «Cancelar». Validación al guardar vacío con el texto de hoy. No se cierra tocando el velo (no se pierde lo escrito). -->
<div class="PX-capa" data-c="add" data-k="hoja" data-velo="no">
  <form class="PX-card PX-w480" role="dialog" aria-modal="true" aria-label="Nueva nota aclaratoria" novalidate tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <header class="PX-hcab PX-sinx"><div><h2>Nueva nota aclaratoria</h2></div></header>
    <div class="PX-hcu" lang="es"><p class="PX-avis">Este addendum se adjuntará a la nota original y no podrá modificarse una vez guardado.</p>
      <textarea class="PX-in PX-ad-ta" aria-label="Nueva nota aclaratoria" placeholder="Escriba la aclaración, corrección o nota adicional..." data-foco></textarea>
      <p class="PX-ferr" role="alert" hidden>El addendum no puede estar vacío</p></div>
    <div class="PX-hpie PX-sinl"><button type="button" class="PX-p PX-b PX-qui" data-cierra>Cancelar</button><button type="submit" class="PX-p PX-b PX-prim PX-ad-ok">Guardar addendum</button></div>
  </form>
</div>
<!-- Variante 2 · Contenido largo con desplazamiento interno y pie fijo: «Agregar medición» (expediente aprobado), con el catálogo abierto.
     El cuerpo se desplaza; cabecera y pie quedan fijos (línea fina sobre el pie solo cuando hay desplazamiento). Modal 520 en ancho. -->
<div class="PX-capa" data-c="largo" data-k="hoja" data-velo="no">
  <div class="PX-card PX-w520" role="dialog" aria-modal="true" aria-label="Agregar medición" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <header class="PX-hcab"><div><h2>Agregar medición</h2><p class="PX-sub">Desde catálogo clínico</p></div>{X}</header>
    <div class="PX-hcu">
      <div class="PX-campos"><label class="PX-campo"><span>Analito</span><input class="PX-in" type="text" autocomplete="off" placeholder="Buscar analito (ej. HbA1c, creatinina, peso)..." data-foco></label></div>
      <div class="PX-sugl" role="listbox" aria-label="Catálogo clínico">{sug("Química", [("Glucosa en ayuno", "mg/dL"), ("Hemoglobina glucosilada (HbA1c)", "%")])}{sug("Signos vitales", [("Presión arterial", "mmHg")])}{sug("Antropometría", [("Peso", "kg")])}
        <button type="button" class="PX-p PX-mi"><span class="PX-mic">{ic(I["plus"], 18, 2.2)}</span><span class="PX-mt">¿No encuentras el analito? Crear como custom</span></button></div>
      <div class="PX-campos"><label class="PX-campo"><span>Valor</span><input class="PX-in" type="text" inputmode="decimal" autocomplete="off"></label>
        <label class="PX-campo"><span>Fecha</span><input class="PX-in PX-num" type="text" value="19/11/2026" autocomplete="off"></label>
        <label class="PX-campo"><span>Hora</span><input class="PX-in PX-num" type="text" value="10:30" autocomplete="off"></label>
        <label class="PX-campo"><span>Notas (opcional)</span><textarea class="PX-in" style="height:88px"></textarea></label></div>
    </div>
    <div class="PX-hpie"><button type="button" class="PX-p PX-b PX-qui" data-cierra>Cancelar</button><button type="button" class="PX-p PX-b PX-prim" data-cierra>Guardar</button></div>
  </div>
</div>
<!-- Variante 3 · Vista previa de PDF: hoja alta en teléfono (casi toda la pantalla), modal 520 en ancho. La página es papel: blanco en los dos temas.
     Pie con UN principal, «Descargar PDF» (rótulo de hoy en el visor del expediente; §23.2: nada de «Compartir»). -->
<div class="PX-capa" data-c="pdf" data-k="hoja">
  <div class="PX-card PX-w520" role="dialog" aria-modal="true" aria-label="Receta" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <header class="PX-hcab"><div><div class="PX-tit">{dico("receta")}<h2>Receta</h2></div><p class="PX-sub PX-num">Paciente Prueba 01 · 17 nov 2026</p></div>{X.replace("data-cierra", "data-cierra data-foco")}</header>
    <div class="PX-hcu"><div class="PX-pdfz">
      <article class="PX-pag" aria-label="Página 1 de la receta">
        <div class="PX-pag-c">{ic(I["logo"], 22)}<div><b>Dr. Admin Semilla</b><span class="PX-g2">Traumatología y Ortopedia · Cédula Prof. 00000001</span></div></div>
        <div class="PX-num"><b>Paciente:</b> Paciente Prueba 01 · 73 años<br><b>Fecha:</b> 17/11/2026 · <b>Dx:</b> Lumbago</div>
        <div class="PX-pag-rx">Rx</div>
        <ol><li><b>Paracetamol 500 mg</b> · tabletas<br><span class="PX-g2">1 tableta cada 8 horas por 5 días</span></li>
          <li><b>Diclofenaco gel 1 %</b> · tópico<br><span class="PX-g2">Aplicar en zona lumbar cada 12 horas</span></li></ol>
        <div><b>Recomendaciones</b><br><span class="PX-g2">Higiene de columna; acudir si aparece dolor irradiado.</span></div>
        <div class="PX-pag-f"><span></span>Dr. Admin Semilla</div>
      </article><p class="PX-pagn">Página 1 de 1</p></div></div>
    <div class="PX-hpie"><button type="button" class="PX-p PX-b PX-prim" data-cierra>{ic(I["descargar"], 18, 2)}Descargar PDF</button></div>
  </div>
</div>'''
    ficha = '''<h3>Especificación · Modal</h3>
<p>Para una tarea con formulario o lectura que no cabe en una alerta. En iPhone es hoja desde abajo; en Duo cerrado (CALMA §26) y en ancho, tarjeta centrada en el área de contenido, nacida del centro.</p>
<table><thead><tr><th></th><th>ext</th><th>tel</th><th>ih</th><th>iv</th><th>esc</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada en el área de contenido (§26)</td><td>hoja a todo el ancho</td><td colspan="3">tarjeta centrada, radio 20</td></tr>
<tr><th>Ancho</th><td>310 (margen 8)</td><td>393</td><td colspan="3">480 formulario corto · 520 contenido largo y PDF (440 queda para listas, vista 3)</td></tr>
<tr><th>Alto máx.</th><td>área − 32 (678 − 34 − 32)</td><td>hasta 16 bajo la barra de estado</td><td>669 − 34 − 48</td><td>951 − 82 − 48</td><td>800 − 64</td></tr>
<tr><th>Pie</th><td>botones según su texto, llenan el ancho</td><td>botones a partes iguales</td><td>a la derecha, mín. 104</td><td>centrado, mín. 104</td><td>a la derecha, mín. 104</td></tr>
<tr><th>Botones</th><td>44</td><td>44</td><td>40</td><td>44</td><td>40</td></tr>
</tbody></table>
<dl>
<dt>Estructura</dt><dd>Asa (solo hoja de iPhone) · cabecera fija (título 17/700, subtítulo 13, «×» de icono 44/36 si no hay «Cancelar») · cuerpo que se desplaza por dentro · pie fijo. La línea fina sobre el pie solo aparece si el cuerpo se desplaza.</dd>
<dt>Orden</dt><dd>Secundario (quieto) a la izquierda, principal a la derecha. Un solo principal.</dd>
<dt>Resorte</dt><dd>Hoja: sube del borde inferior, ζ 1.0 / .36 s; baja en .24 s. Tarjeta: escala .96 → 1. Interrumpible a medio camino. Arrastre hacia abajo solo en iPhone, como en la vista 3; en Duo cerrado no hay asa ni arrastre.</dd>
<dt>Cierre</dt><dd>«Cancelar»/«×», Esc, arrastre hacia abajo (iPhone). <b>Decisión aprobada:</b> los modales con formulario NO se cierran tocando el velo (no se pierde lo escrito); la vista previa sí se cierra con el velo.</dd>
<dt>Velo</dt><dd>Sí, con desenfoque; uno solo.</dd>
<dt>Foco y teclado</dt><dd>role="dialog", aria-modal; el foco entra en el primer campo (o en «×» en la vista previa); fondo inerte; Esc cierra; Enter en el pie envía; al cerrar vuelve al botón de origen. Error de validación en una línea role="alert" bajo el campo.</dd>
<dt>Movimiento reducido</dt><dd>Fundido 200/150 ms en su sitio, sin subir ni escalar.</dd>
<dt>Transparencia reducida</dt><dd>Velo sin desenfoque y totalmente opaco: <b>--navy</b> al 100 % en oscuro; en claro, color sólido equivalente (<b>--navy</b> 45 % sobre <b>--fondo</b>).</dd>
</dl>'''
    extra = '''c.enCapa=function(m,k,e,cierra){if(k!=='add')return false;var b=e.target.closest('.PX-ad-ok');if(!b)return false;e.preventDefault();
  var t=m.querySelector('.PX-ad-ta'),er=m.querySelector('.PX-capa[data-c="add"] .PX-ferr');
  if(!t.value.trim()){er.hidden=false;t.focus({preventScroll:true});return true}er.hidden=true;t.value='';cierra();return true};
c.alAbrir=function(m,k){if(k==='add'){m.querySelector('.PX-capa[data-c="add"] .PX-ferr').hidden=true}};'''
    return ('Modal', 'Un solo modal para toda la app: hoja desde abajo en teléfono y tarjeta centrada en ancho, con cabecera y pie fijos, cuerpo que se desplaza por dentro y el pie siempre con el principal a la derecha.',
            fondos, capas, ficha, [['add', 'Formulario corto'], ['largo', 'Contenido largo'], ['pdf', 'Vista previa de PDF']], 'add', extra)

# =========================== VISTA 3 · HOJA ===========================
def v3():
    f_dash = fondo('cita', 'inicio', 'Inicio', f'''<header class="PX-cab"><h1 class="PX-h1">Inicio</h1><p class="PX-sub PX-num">Jueves 19 de noviembre</p></header>
<section class="PX-sec"><div class="PX-sec-c"><h2 class="PX-h2">Después</h2></div><div class="PX-tar">{cita_filas(True)}</div></section>''')
    f_doc = fondo('rej pl', 'exp', 'Expediente', f'''<header class="PX-cab"><div class="PX-cabf"><a href="#" class="PX-p PX-volver">{ic(I["volver"], 16, 2.2)}Paciente Prueba 01</a><span class="PX-flex"></span><button type="button" class="PX-p PX-b PX-ton" data-abre="rej" aria-haspopup="dialog">Cambiar</button></div>
<div class="PX-tit" style="--c:var(--d-suplementacion)">{ic(DI["suplementacion"][1], 24)}<h1 class="PX-h1">Suplementación</h1></div><p class="PX-sub PX-num">Paciente Prueba 01 · 73 años</p></header>
<section class="PX-tar"><button type="button" class="PX-p PX-fila" data-abre="pl" aria-haspopup="dialog"><span class="PX-fila-t"><span class="PX-fila-n">Plantilla</span></span><span class="PX-der PX-pl-v">— Sin plantilla —</span>{CHEV}</button></section>
<section class="PX-sec"><h2 class="PX-h2">Datos del paciente</h2><div class="PX-tar"><dl><div class="PX-par"><dt>Fecha</dt><dd class="PX-num">19 nov 2026</dd></div><div class="PX-par"><dt>Paciente</dt><dd>Paciente Prueba 01</dd></div><div class="PX-par"><dt>Diagnóstico</dt><dd>Lumbago</dd></div></dl></div></section>''')
    fondos = f_dash + f_doc
    X = lambda extra='': f'<button type="button" class="PX-p PX-ib{extra}" data-cierra aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>'
    rej = ''.join(f'<a href="#" class="PX-p PX-az" data-cierra{" aria-current=\"true\"" if k == "suplementacion" else ""}><span class="PX-az-i" style="--c:var(--d-{c})">{ic(p)}</span><span>{n}</span></a>' for k, n, p, c in D)
    pls = ''.join(f'<button type="button" class="PX-p PX-mi" role="radio" aria-checked="false" data-pl="{n}"><span class="PX-mt">{n}</span>{ic(I["ok"], 18, 2.2).replace("<svg", "<svg class=\"PX-chk\"", 1)}</button>'
                  for n in ('Posoperatorio de columna', 'Osteopenia', 'Sarcopenia'))
    capas = f'''<!-- Variante 1 · Hoja de acciones de la cita (dashboard aprobado, §24.2). El guion la llena con la fila tocada.
     Acciones de hoy: «Iniciar consulta» (principal) y «Ver expediente». El dashboard de hoy no cambia estados: la hoja no los ofrece. -->
<div class="PX-capa" data-c="cita" data-k="hoja">
  <div class="PX-card PX-w400 PX-hc" role="dialog" aria-modal="true" aria-label="Cita de Paciente Prueba 12" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <div class="PX-hc-cab"><div class="PX-fecha" aria-hidden="true"><span class="PX-mes">NOV</span><span class="PX-dia">19</span></div>
      <div class="PX-hc-q"><h2 class="PX-hc-n">Paciente Prueba 12</h2><p class="PX-hc-d PX-num PX-hc-cu">Jue 19 nov · 18:30 – 19:00</p><p class="PX-hc-d PX-hc-me">Dr. Admin Semilla · Centro</p></div>
      {X(" PX-hc-x")}</div>
    <div class="PX-hc-et"><span class="PX-hc-e1">{est("conf")}</span><span class="PX-hc-e2" hidden>{est("ag")}</span><span class="PX-marca">{ic(I["enlace"], 14, 2)}Reservó por enlace</span></div>
    <button type="button" class="PX-p PX-b PX-prim" data-cierra data-foco>{ic(I["esteto"], 18, 2)}Iniciar consulta</button>
    <ul class="PX-hc-l"><li><button type="button" class="PX-p PX-hc-a" data-cierra>{ic(I["folder"], 20)}<span>Ver expediente</span></button></li></ul>
  </div>
</div>
<!-- Variante 2 · Rejilla «Tipo de documento» (§9, §21): 2 columnas en teléfono, 4 en ancho; la celda del tipo actual con contorno de 2 px. Modal 640 en ancho. -->
<div class="PX-capa" data-c="rej" data-k="hoja">
  <div class="PX-card PX-w640" role="dialog" aria-modal="true" aria-label="Tipo de documento" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <header class="PX-hcab"><div><h2>Tipo de documento</h2></div>{X()}</header>
    <div class="PX-hcu"><div class="PX-rej">{rej.replace('class="PX-p PX-az" data-cierra aria-current="true"', 'class="PX-p PX-az" data-cierra aria-current="true" data-foco')}</div></div>
  </div>
</div>
<!-- Variante 3 · Lista para elegir: «Plantilla» (documentos aprobados). Radio con palomita; al elegir se aplica y cierra. Pie con «Gestionar plantillas». Modal 440 en ancho. -->
<div class="PX-capa" data-c="pl" data-k="hoja">
  <div class="PX-card PX-w440 PX-pl" role="dialog" aria-modal="true" aria-label="Plantilla" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    <header class="PX-hcab"><div><h2>Plantilla</h2></div>{X()}</header>
    <div class="PX-hcu"><div role="radiogroup" aria-label="Plantilla">{pls}<span class="PX-msep" role="separator"></span>
      <button type="button" class="PX-p PX-mi" role="radio" aria-checked="false" data-pl="vaciar"><span class="PX-mt">Vaciar formulario</span>{ic(I["ok"], 18, 2.2).replace("<svg", "<svg class=\"PX-chk\"", 1)}</button>
      <button type="button" class="PX-p PX-mi" role="radio" aria-checked="true" data-pl="" data-foco><span class="PX-mt">— Sin plantilla —</span>{ic(I["ok"], 18, 2.2).replace("<svg", "<svg class=\"PX-chk\"", 1)}</button></div></div>
    <div class="PX-hpie"><button type="button" class="PX-p PX-b PX-qui" data-cierra>Gestionar plantillas</button></div>
  </div>
</div>'''
    ficha = '''<h3>Especificación · Hoja</h3>
<p>Tareas cortas: acciones de un elemento, elegir de una rejilla o de una lista. En iPhone sube del borde inferior y se arrastra; en Duo cerrado (CALMA §26) y en ancho es tarjeta centrada con velo, nacida del centro, sin asa ni arrastre.</p>
<table><thead><tr><th></th><th>ext</th><th>tel</th><th>ih</th><th>iv</th><th>esc</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada en el área de contenido, radio 20</td><td>hoja 393</td><td colspan="3">tarjeta centrada en el área de contenido, radio 20</td></tr>
<tr><th>Ancho</th><td>310 (margen 8); alto máx. área − 32, cuerpo con desplazamiento</td><td>todo el ancho</td><td colspan="3">cita 400 · plantillas 440 · rejilla 640</td></tr>
<tr><th>Rejilla</th><td colspan="2">2 columnas, celda ≥ 84</td><td colspan="3">4 columnas, celda ≥ 88</td></tr>
<tr><th>Filas</th><td>48</td><td>48</td><td>44</td><td>48</td><td>44</td></tr>
</tbody></table>
<dl>
<dt>Hoja (iPhone)</dt><dd>Radio superior 22, asa 36×5 en <b>--borde</b>, fondo <b>--sup</b>, relleno inferior <b>--ib</b> + 16. Alto según su contenido, como mucho hasta 16 px del borde superior; si no cabe, el cuerpo se desplaza.</dd>
<dt>Arrastre (solo iPhone)</dt><dd>Se toma de cualquier punto (no de un campo, ni del cuerpo si ya está desplazado). Umbral de 10 px; luego sigue al dedo 1:1 respetando el punto de agarre; hacia arriba, rubber-band (c = .55). Al soltar se proyecta la inercia (deceleración .998): si el punto proyectado pasa de la mitad, cierra; si no, vuelve. La velocidad del dedo pasa al resorte: ζ .8 / .30 s si el gesto llevaba más de 300 px/s, ζ 1.0 si no. Se puede volver a agarrar mientras baja.</dd>
<dt>Resorte</dt><dd>Entrada ζ 1.0 / .36 s; salida ζ 1.0 / .24 s; tarjeta (Duo cerrado y ancho): escala .96 → 1 con fundido.</dd>
<dt>Cierre</dt><dd>Arrastre (iPhone), «×», tocar el velo, Esc, o elegir una opción (rejilla, plantilla, acción).</dd>
<dt>Velo</dt><dd>Sí, con desenfoque, que sigue al dedo: su opacidad es el progreso de la hoja.</dd>
<dt>Foco y teclado</dt><dd>role="dialog"; el foco entra en la acción principal, en el tipo actual de la rejilla o en la opción marcada. Flechas: rejilla en 2/4 columnas, lista arriba/abajo; Inicio/Fin; Enter elige; Esc cierra y devuelve el foco.</dd>
<dt>Movimiento reducido</dt><dd>Fundido en su sitio. El arrastre sigue funcionando (es manipulación directa), pero al soltar la hoja se funde en vez de deslizar.</dd>
<dt>Transparencia reducida</dt><dd>Velo sin desenfoque y totalmente opaco: <b>--navy</b> al 100 % en oscuro; en claro, color sólido equivalente (<b>--navy</b> 45 % sobre <b>--fondo</b>).</dd>
</dl>'''
    extra = '''c.alAbrir=function(m,k,op){if(k!=='cita'||!op||!op.dataset.nom)return;var q=function(s){return m.querySelector('.PX-capa[data-c="cita"] '+s)};
  q('.PX-hc-n').textContent=op.dataset.nom;q('.PX-hc-cu').textContent=op.dataset.cuando;q('.PX-hc-me').textContent=op.dataset.med;
  q('.PX-hc-e1').hidden=op.dataset.est!=='conf';q('.PX-hc-e2').hidden=op.dataset.est!=='ag';q('.PX-card').setAttribute('aria-label','Cita de '+op.dataset.nom)};
c.enCapa=function(m,k,e,cierra){if(k!=='pl')return false;var b=e.target.closest('[data-pl]');if(!b)return false;
  [].forEach.call(m.querySelectorAll('[data-pl]'),function(x){x.setAttribute('aria-checked',String(x===b&&b.dataset.pl!=='vaciar'||b.dataset.pl==='vaciar'&&x.dataset.pl===''))});
  m.querySelector('.PX-pl-v').textContent=b.dataset.pl&&b.dataset.pl!=='vaciar'?b.dataset.pl:'— Sin plantilla —';cierra();return true};'''
    return ('Hoja', 'Una sola hoja para toda la app: sube del borde inferior en teléfono y se arrastra hacia abajo con inercia, y en ancho es una tarjeta centrada; aquí con la cita del dashboard, la rejilla de tipos y la lista de plantillas.',
            fondos, capas, ficha, [['cita', 'Acciones de la cita'], ['rej', 'Tipo de documento'], ['pl', 'Plantillas']], 'cita', extra)

# =========================== VISTA 4 · MENÚ ===========================
def v4():
    docs = ''.join(f'<div class="PX-fila-w"><button type="button" class="PX-p PX-fila">{dico(k)}<span class="PX-fila-t"><span class="PX-fila-n">{n}</span><span class="PX-fila-s PX-num">{s}</span></span></button>'
                   f'<button type="button" class="PX-p PX-ib" data-abre="fila" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones de {n}">{ic(I["pts"], 20, 3)}</button></div>'
                   for k, n, s in (('receta', 'Receta', '17 nov 2026 · Dr. Admin Semilla'), ('lab', 'Laboratorio', '30 oct 2026 · Dr. Admin Semilla'), ('escrito', 'Escrito médico', '12 oct 2026 · Dr. Admin Semilla')))
    f_docs = fondo('fila', 'exp', 'Expediente', f'''<header class="PX-cab">{volver("Expediente")}<div class="PX-quien">{av("01")}<div class="PX-cab"><h1 class="PX-h1">Paciente Prueba 01</h1><p class="PX-sub PX-num">73 años · Femenino · EXP-2026-0001</p></div></div></header>
<section class="PX-sec"><h2 class="PX-h2">Documentos</h2><div class="PX-tar">{docs}</div></section>''')
    pacs = ''.join(f'<button type="button" class="PX-p PX-fila">{av(n)}<span class="PX-fila-t"><span class="PX-fila-n">Paciente Prueba {n}</span><span class="PX-fila-s PX-num">EXP-2026-00{n}</span></span><span class="PX-der PX-num">{d}</span>{CHEV}</button>'
                   for n, d in (('25', '19 nov'), ('24', '16 nov'), ('23', '13 nov'), ('22', '10 nov')))
    f_lista = fondo('orden', 'exp', 'Expediente', f'''<header class="PX-cab"><h1 class="PX-h1">Expediente</h1></header>
<section class="PX-sec"><div class="PX-sec-c"><button type="button" class="PX-p PX-tx PX-ord" data-abre="orden" aria-haspopup="menu" aria-expanded="false"><span style="color:var(--tinta2);font-weight:400">Ordenado por</span><span class="PX-ord-v">Fecha de ingreso</span><span class="PX-ord-d">{ic(I["aba"], 14, 2)}</span></button></div><div class="PX-tar">{pacs}</div></section>''')
    f_dash = fondo('ley', 'inicio', 'Inicio', f'''<header class="PX-cab"><h1 class="PX-h1">Inicio</h1><p class="PX-sub PX-num">Jueves 19 de noviembre</p></header>
<section class="PX-sec"><div class="PX-sec-c"><h2 class="PX-h2">Después</h2><button type="button" class="PX-p PX-estb" data-abre="ley" aria-haspopup="true" aria-expanded="false">Estados{ic(I["abajo"], 13, 2.4)}</button></div><div class="PX-tar">{cita_filas(False)}</div></section>''')
    fondos = f_docs + f_lista + f_dash
    mi = lambda ico, t, extra='', cls='': f'<button type="button" class="PX-p PX-mi {cls}" role="menuitem" data-cierra{extra}><span class="PX-mic">{ic(I[ico], 20)}</span><span class="PX-mt">{t}</span></button>'
    chk = ic(I["ok"], 16, 2.2).replace('<svg', '<svg class="PX-chk"', 1)
    ORD = [('ape', 'Apellido'), ('nom', 'Nombre'), ('exp', 'Expediente'), ('edad', 'Edad'), ('ing', 'Fecha de ingreso'), ('med', 'Médico')]
    mr = lambda attr, t, on, ico: f'<button type="button" class="PX-p PX-mi" role="menuitemradio" aria-checked="{"true" if on else "false"}" {attr}><span class="PX-mic">{ic(I[ico], 20)}</span><span class="PX-mt">{t}</span>{chk}</button>'
    orden = ''.join(mr(f'data-mo="{k}"', t, k == 'ing', 'o_' + k) for k, t in ORD) + '<span class="PX-msep" role="separator"></span>' + mr('data-md="asc"', 'Ascendente', False, 'arr') + mr('data-md="desc"', 'Descendente', True, 'aba')
    ley = ''.join(f'<li>{est(k)}</li>' for k in ('ag', 'conf', 'canc', 'noas', 'aten'))
    capas = f'''<!-- Variante 1 · «···» de una fila de documento (expediente aprobado, funciones 32–37): iconos en --enlace, la destructiva separada y en rojo.
     Hoja corta en teléfono, tarjeta centrada con velo en Duo abierto, menú que nace del botón y sin velo en computadora (§21). -->
<div class="PX-capa" data-c="fila" data-k="menu">
  <div class="PX-card PX-mn" role="menu" aria-label="Más acciones" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span>
    {mi("enviar", "Enviar al paciente", " data-foco")}{mi("compartir", "Compartir")}{mi("regen", "Regenerar PDF")}<span class="PX-msep" role="separator"></span>{mi("basura", "Eliminar documento", "", "PX-mi-mal")}
  </div>
</div>
<!-- Variante 2 · Menú de orden con la selección actual (lista de pacientes aprobada): seis criterios y la dirección, palomita en lo activo.
     Elegir un criterio nuevo empieza ascendente; el mismo conserva la dirección. -->
<div class="PX-capa" data-c="orden" data-k="menu">
  <div class="PX-card PX-mn PX-word" role="menu" aria-label="Ordenar por" tabindex="-1">
    <span class="PX-asa" aria-hidden="true"></span><p class="PX-mn-t">Ordenar por</p>
    {orden.replace('aria-checked="true" data-mo="ing"', 'aria-checked="true" data-mo="ing" data-foco')}
  </div>
</div>
<!-- Variante 3 · Leyenda de solo lectura: «Estados» del dashboard (los cinco estados, mismos textos y orden). Sin acciones: se cierra fuera, con Esc o con su botón. -->
<div class="PX-capa" data-c="ley" data-k="menu">
  <div class="PX-card PX-mn PX-wley" role="dialog" aria-label="Estados de una cita" tabindex="-1" data-foco>
    <span class="PX-asa" aria-hidden="true"></span><p class="PX-mn-t">Estados</p>
    <ul class="PX-ley">{ley}</ul>
  </div>
</div>'''
    ficha = '''<h3>Especificación · Menú</h3>
<p>Para «···», orden, filtros y selects: nace de su botón. Lo que no cabe a la vista pero se usa poco.</p>
<table><thead><tr><th></th><th>ext</th><th>tel</th><th>ih</th><th>iv</th><th>esc</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada 280 en el área de contenido (§26)</td><td>hoja corta</td><td>tarjeta centrada 280</td><td>tarjeta centrada 280</td><td>desplegable bajo el botón, 248 (orden 232, leyenda 180)</td></tr>
<tr><th>Velo</th><td>sí</td><td>sí</td><td>sí</td><td>sí</td><td><b>no</b> (§21); contorno fino <b>--linea</b> + sombra de capa</td></tr>
<tr><th>Opción</th><td>44, 15 px</td><td>48, 15 px</td><td>44, 15 px</td><td>48, 15 px</td><td>38, 14 px</td></tr>
<tr><th>Origen</th><td>centro (.96 → 1)</td><td>borde inferior</td><td colspan="2">centro (.96 → 1)</td><td>el botón: transform-origin en su centro, escala .9 → 1; si no cabe abajo, se abre hacia arriba</td></tr>
</tbody></table>
<dl>
<dt>Opciones</dt><dd>Icono de 20 (18 en computadora) a la izquierda en <b>--enlace</b>; texto en <b>--tinta</b>. La destructiva al final, tras una línea, icono y texto en <b>--mal-tinta</b>. Selección actual: palomita a la derecha y texto en 600. La leyenda no tiene opciones: estados con su icono en círculo y su nombre.</dd>
<dt>Resorte</dt><dd>Desplegable: ζ 1.0 / .28 s al abrir, .20 al cerrar. Hoja y tarjeta: como en las vistas 2 y 3. Interrumpible: el mismo botón cierra a medio abrir sin salto.</dd>
<dt>Cierre</dt><dd>Elegir una opción, tocar fuera o el velo, desplazar el contenido (desplegable), Esc, o el mismo botón. En iPhone también arrastrando la hoja.</dd>
<dt>Foco y teclado</dt><dd>role="menu" con menuitem / menuitemradio; el botón lleva aria-haspopup y aria-expanded. El foco entra en la primera opción (en el orden, la marcada); ↑ ↓ Inicio Fin; Enter elige; Esc cierra y vuelve al botón.</dd>
<dt>Movimiento reducido</dt><dd>Fundido de 200/150 ms, sin escala.</dd>
<dt>Transparencia reducida</dt><dd>Velo sin desenfoque y totalmente opaco (donde hay velo): <b>--navy</b> al 100 % en oscuro; sólido equivalente en claro.</dd>
</dl>'''
    extra = '''var ORD={ape:'Apellido',nom:'Nombre',exp:'Expediente',edad:'Edad',ing:'Fecha de ingreso',med:'Médico'};
var IC={asc:'<path d="M12 19V5M6 11l6-6 6 6"/>',desc:'<path d="M12 5v14M6 13l6 6 6-6"/>'};
c.enCapa=function(m,k,e,cierra){if(k!=='orden')return false;var b=e.target.closest('[data-mo],[data-md]');if(!b)return false;
  var cur=m.querySelector('[data-mo][aria-checked="true"]'),dir=m.querySelector('[data-md][aria-checked="true"]');
  if(b.dataset.mo){if(b!==cur){[].forEach.call(m.querySelectorAll('[data-md]'),function(x){x.setAttribute('aria-checked',String(x.dataset.md==='asc'))})}
    [].forEach.call(m.querySelectorAll('[data-mo]'),function(x){x.setAttribute('aria-checked',String(x===b))})}
  else [].forEach.call(m.querySelectorAll('[data-md]'),function(x){x.setAttribute('aria-checked',String(x===b))});
  var o=m.querySelector('[data-mo][aria-checked="true"]').dataset.mo,d=m.querySelector('[data-md][aria-checked="true"]').dataset.md;
  m.querySelector('.PX-ord-v').textContent=ORD[o];
  m.querySelector('.PX-ord-d').innerHTML='<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[d]+'</svg>';
  m.querySelector('.PX-ord').setAttribute('aria-label','Cambiar el orden. Ordenado por '+ORD[o]+', '+(d==='asc'?'ascendente':'descendente'));
  cierra();return true};'''
    return ('Menú', 'Un solo menú para toda la app: hoja corta en teléfono, tarjeta centrada en Duo abierto y desplegable que nace de su botón, sin velo, en computadora; con iconos de color, la acción roja al final y la selección marcada.',
            fondos, capas, ficha, [['fila', '«···» de fila'], ['orden', 'Orden'], ['ley', 'Leyenda']], 'fila', extra)

CSS = open(f'{L}/tmp-estilo.css').read()
JS = open(f'{L}/tmp-guion.js').read()
for i, (fn, nombre) in enumerate(((v1, '1-alerta'), (v2, '2-modal'), (v3, '3-hoja'), (v4, '4-menu')), 1):
    tit, desc, fondos, capas, ficha, vars_, d, extra = fn()
    px = f'ca{i}'
    cfg = json.dumps({'vars': vars_, 'def': d, 'ficha': ficha}, ensure_ascii=False)
    js = JS.replace('__CFG__', '(function(){var c=' + cfg + ';' + extra + 'return c})()')
    marcos = '\n'.join(marco(px, vp, fondos, capas) for vp in ('ext', 'tel', 'ih', 'iv', 'esc'))
    out = (f'<!-- NOMBRE: Capas · {tit} | {desc} -->\n<style>\n{CSS}</style>\n{marcos}\n<script>\n{js}</script>\n').replace('PX', px)
    open(f'{L}/vista-{nombre}.html', 'w').write(out)
    print(nombre, len(out))
