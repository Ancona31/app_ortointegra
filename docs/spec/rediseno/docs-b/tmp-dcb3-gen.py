# Generador de las tres vistas del taller de documentos, parte 2 (Suplementación, Internamiento, Escrito médico).
# Uso: python3 tmp-dcb-gen.py   -> vista-5-suplementacion.html, vista-6-internamiento.html, vista-7-escrito.html
import os, json
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8):
    return '<svg aria-hidden="true" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (s, s, w, d)

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
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    basura='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    buscar='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    # Iconos por tipo de documento: copiados tal cual de doc-color/color-documentos.html
    receta='<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    lab='<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>',
    imagen='<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
    sup='<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>',
    inter='<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>',
    escrito='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    consent='<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    honor='<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
    # Formato del editor
    negrita='<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    cursiva='<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    subr='<path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/>',
    vin='<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    numer='<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    a_left='<path d="M4 6h16M4 12h10M4 18h13"/>', a_center='<path d="M4 6h16M7 12h10M5.5 18h13"/>',
    a_right='<path d="M4 6h16M10 12h10M7 18h13"/>', a_justify='<path d="M4 6h16M4 12h16M4 18h16"/>',
    cita='<path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 4.5M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 4.5"/>',
    sep='<path d="M5 12h14"/>',
    quitar='<path d="M4 7V4h16v3M5 20h6M13 4 8 20M15 15l5 5M20 15l-5 5"/>',
    parr='<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
    h2='<path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>',
    h3='<path d="M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17 17.5c2 1.5 4 .3 4-1.500a2 2 0 0 0-2-2"/>',
)
I.update(
    plantilla='<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    marcador='<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/>',
    ajustes='<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    borrador='<path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8L12.2 4a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.800L12 20"/><path d="m7.500 9.500 7 7"/>',
    ojo='<path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    correo='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.500 7 8.500 6 8.500-6"/>',
    compartir='<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    descargar='<path d="M12 3v12M8 11l4 4 4-4M5 20h14"/>',
)
FLECHA = ic(I['sig'], 14, 2.4)
MAS_I = ic(I['plus'], 18, 2.4)
def mi(k, s=20, w=1.8):
    return '<span class="QQ-mi">' + ic(I[k], s, w) + '</span>'
def alerta(pan, etq, tono, ico, cuerpo, botones):
    """Alerta de confirmación, patrón único (CALMA §13): icono en círculo de 48, título centrado, mensaje, dos botones parejos."""
    return ('<div tabindex="-1" class="QQ-pan QQ-alerta" data-pan="%s" role="alertdialog" aria-modal="true" aria-label="%s">'
            '<span class="QQ-al-i QQ-i-%s" aria-hidden="true">%s</span>%s<div class="QQ-al-p%s">%s</div></div>') % (pan, etq, tono, ic(I[ico], 28, 1.8), cuerpo, '', botones)
PALOMA = ic(I['ok'], 18, 2.4)
TIPOS = [('receta', 'Receta', 'receta'), ('lab', 'Laboratorio', 'laboratorio'), ('imagen', 'Imagenología', 'imagen'), ('sup', 'Suplementación', 'suplementacion'),
         ('inter', 'Internamiento', 'internamiento'), ('escrito', 'Escrito médico', 'escrito'), ('consent', 'Consentimiento', 'consentimiento'), ('honor', 'Honorarios / Cotización', 'honorarios')]

# ---------- Navegación al día (CALMA §28; copiada de entrega/cromo/tmp-base.py y tmp-v1.py; activo = Documentos) ----------
I.update(
    ayuda='<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    arriba='<path d="m18 15-6-6-6 6"/>',
    flecha='<path d="M5 12h14M12 5l7 7-7 7"/>',
    firma='<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/>',
    cedula='<path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="5" cy="14" r="3"/><path d="M7 16.5 8 22l-3-1-3 1 1-5.5"/>',
    foto='<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
)
BDG = '<span class="QQ-bdg" aria-hidden="true">3</span>'

def aviso(vp, donde, pleg=False):
    """A0·11 · Aviso de perfil «N datos pendientes» (AvisoPerfilSidebar.tsx:122-124, 153, 232). Solo médico."""
    cid = 'QQ-ap-%s-%s' % (vp, donde)
    filas = ''.join('<a href="#" class="QQ-p QQ-ap-l">%s<span>%s</span></a>' % (ic(I[k], 18, 1.9), t)
                    for k, t in (('firma', 'Documentos sin firma'), ('cedula', 'Sin cédula de especialidad'), ('foto', 'Clínica sin logo')))
    return ('<div class="QQ-ap%s" role="status" aria-live="polite"><button type="button" class="QQ-p QQ-ap-cab" aria-expanded="%s" aria-controls="%s">'
            '<span class="QQ-ap-pt" aria-hidden="true"></span><span class="QQ-ap-t">3 datos pendientes</span>%s</button>'
            '<div class="QQ-ap-c" id="%s"><span class="QQ-ap-sep" aria-hidden="true"></span>%s<a href="#" class="QQ-p QQ-ap-b">Completar ahora%s</a></div></div>'
            ) % (' QQ-pleg' if pleg else '', 'false' if pleg else 'true', cid, ic(I['arriba'], 18, 2.2, ) .replace('<svg', '<svg class="QQ-ap-ch"', 1), cid, filas, ic(I['flecha'], 16, 2.2))

def riel():
    def b(k, t, act=False):
        return '<a href="#" class="QQ-p QQ-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="QQ-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente') + b('agenda', 'Agenda') + b('docs', 'Documentos', True)
            + '<button type="button" class="QQ-p QQ-rb" aria-label="Más, 3 datos pendientes" aria-haspopup="dialog" data-abre="mas">' + ic(I['mas'], 22, 3) + BDG + '</button><span class="QQ-flex"></span>'
            '<button type="button" class="QQ-p QQ-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lat_cont(vp, donde, cerrar=False):
    def a(k, t, act=False):
        return '<a href="#" class="QQ-p QQ-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    x = ('<button type="button" class="QQ-p QQ-ib QQ-cierra QQ-lat-x" aria-label="Cerrar menú">' + ic(I['x'], 20, 2) + '</button>') if cerrar else ''
    clogo = ('<span class="QQ-clogo" role="img" aria-label="Logo de Clínica Semilla A"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
             'stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5-2.2-7-5.6-7-10V5.5L12 3l7 2.5V11c0 4.4-2.5 7.8-7 10z"/><path d="M12 8v7M8.5 11.5h7"/></svg></span>')
    return ('<div class="QQ-lat-cab"><span class="QQ-logo">' + ic(I['logo'], 24) + '<span class="QQ-logo-n">Spinus</span></span><span class="QQ-flex"></span><span class="QQ-plan">Plan VIP</span>' + x + '</div>'
            '<button type="button" class="QQ-p QQ-cons-b">' + clogo + '<span class="QQ-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="QQ-lista">' + a('inicio', 'Inicio') + a('pac', 'Expediente') + a('agenda', 'Agenda') + a('docs', 'Documentos', True) + a('admin', 'Administración') + '</div><span class="QQ-flex"></span>'
            + aviso(vp, donde, pleg=(vp == 'ih')) +
            '<div class="QQ-lat-pie"><a href="#" class="QQ-p QQ-li QQ-yo">' + ic(I['perfil'], 20) + '<span><span>Dr. Admin Semilla</span><small class="QQ-esp">Ortopedia y Traumatología</small><small>Mi perfil · Ajustes</small></span></a>'
            '<a href="#" class="QQ-p QQ-ay" aria-label="Ayuda">' + ic(I['ayuda'], 20) + '</a></div>')

def lateral(vp):
    return '<nav class="QQ-lat" aria-label="Navegación principal">' + lat_cont(vp, 'lat') + '</nav>'

def encabezado():
    return ('<header class="QQ-enc"><button type="button" class="QQ-p QQ-menu-b" aria-label="Menú, 3 datos pendientes" aria-haspopup="dialog" data-abre="cajon">' + ic(I['menu'], 22, 2) + BDG + '</button><span class="QQ-enc-t">Documentos</span><span class="QQ-flex"></span>'
            '<button type="button" class="QQ-p QQ-av QQ-av-g" aria-label="Mi perfil">AS</button></header>')

def fundido():
    """Duo abierto en vertical (CALMA §19, §23.9): encabezado fundido con «Mostrar barra lateral», la pista de cinco píldoras y el avatar."""
    def p(t, act=False):
        return '<a href="#" class="QQ-p QQ-pi"%s>%s</a>' % (' aria-current="page"' if act else '', t)
    return ('<!-- Duo abierto vertical: «Mostrar barra lateral» abre el cajón (con el aviso de datos pendientes); «Más» abre el menú «Más»; el avatar, Mi perfil -->\n'
            '<header class="QQ-fun"><button type="button" class="QQ-p QQ-fun-b" aria-label="Mostrar barra lateral, 3 datos pendientes" aria-haspopup="dialog" data-abre="cajon">' + ic(I['barra'], 20) + BDG + '</button>'
            '<nav class="QQ-pista" aria-label="Secciones">' + p('Inicio') + p('Expediente') + p('Agenda') + p('Documentos', True)
            + '<button type="button" class="QQ-p QQ-pi" aria-haspopup="dialog" data-abre="mas">Más</button></nav>'
            '<button type="button" class="QQ-p QQ-av QQ-av-g" aria-label="Mi perfil">AS</button></header>')

def capas_nav(vp):
    """Menú «Más» (ext, iv) como tarjeta centrada y cajón (tel, iv) desde la izquierda: CALMA §26, §28."""
    out = ''
    if vp in ('ext', 'iv'):
        o = lambda k, t: '<a href="#" class="QQ-p QQ-mr">' + mi(k) + '<span class="QQ-flex">' + t + '</span>' + FLECHA + '</a>'
        out += ('<!-- Menú «Más» (CALMA §28): aviso, Consultorio activo, Administración, Mi perfil, Ayuda -->\n'
                '<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu QQ-m-mas" data-pan="mas" role="dialog" aria-modal="true" aria-label="Más"><span class="QQ-asa" aria-hidden="true"></span>'
                '<div class="QQ-hj-cab"><h2>Más</h2><button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="Cerrar">' + ic(I['x'], 20, 2) + '</button></div>'
                '<div class="QQ-hj-c">' + aviso(vp, 'mas') +
                '<button type="button" class="QQ-p QQ-mr">' + mi('selector') + '<span class="QQ-flex">Consultorio activo</span><span class="QQ-mr-v">Centro</span>' + FLECHA + '</button>'
                + o('admin', 'Administración') + o('perfil', 'Mi perfil') + o('ayuda', 'Ayuda') + '</div></div>\n')
    if vp in ('tel', 'iv'):
        out += ('<!-- Cajón (A0·13): la barra lateral completa desde la izquierda -->\n'
                '<nav tabindex="-1" class="QQ-pan QQ-cajon" data-pan="cajon" aria-label="Menú">' + lat_cont(vp, 'cajon', cerrar=True) + '</nav>\n')
    return out

# ---------- Piezas del chasis ----------
def cabecera(v):
    return ("""<!-- A7-1 · Cabecera del chasis: «‹ Documentos» y, a su derecha, «Cambiar» (tonal pequeño, el mismo sitio en los ocho formularios y los cuatro marcos) + «···»;
     debajo, icono del tipo en su color (nivel 4, cuadro de 32) + título solo; una línea del paciente.
     A7-5 · ?tipo= abre este formulario; ?dx= precarga el diagnóstico; ?borrador= y ?doc= no tienen señal propia aquí. A7-16/17 · cargador y error del
     formulario («No se pudo cargar el formulario») y plan bloqueado -> /billing: estados de sistema, no dibujados (misma silueta: cabecera + una superficie). -->
<header class="QQ-top">
  <div class="QQ-top-f"><a href="#" class="QQ-p QQ-volver">""" + ic(I['volver'], 14, 2.6) + """Documentos</a><span class="QQ-flex"></span>
    <button type="button" class="QQ-p QQ-mini QQ-tonal QQ-b-cambiar" aria-haspopup="dialog">Cambiar</button>
    <button type="button" class="QQ-p QQ-ib QQ-mas-b" aria-label="Más opciones" aria-haspopup="menu">""" + ic(I['mas'], 22, 3) + """</button></div>
  <div class="QQ-tit"><span class="QQ-tico">""" + ic(I[v['ico']], 20) + """</span><h1>""" + v['nombre'] + """</h1></div>
  <p class="QQ-sub QQ-num"><span>Paciente Prueba 01 · 73 años</span><span class="QQ-etq QQ-e-mal QQ-urg-c" hidden>""" + ic(I['aviso'], 14, 2) + """Urgente</span></p>
</header>
<!-- A7-6 · Plantillas: UNA fila discreta al inicio (igual que en la parte 1), con su icono de color. Abre la hoja con las guardadas, «Vaciar formulario» y «— Sin plantilla —»; al aplicar, una línea con «Deshacer». -->
<section class="QQ-g QQ-g-pl"><div class="QQ-s"><button type="button" class="QQ-p QQ-r QQ-nav QQ-b-pl" aria-haspopup="dialog">""" + mi('plantilla', 18) + """<span>Plantilla</span><span class="QQ-nav-v"></span>""" + FLECHA + """</button></div>
  <p class="QQ-linea QQ-av-pl" aria-live="polite" hidden><span class="QQ-flex QQ-av-pl-t"></span><button type="button" class="QQ-p QQ-txt QQ-b-deshacer">Deshacer</button></p></section>""")

def barra():
    return ("""<!-- Barra de acción, alineada a los bordes de la columna: a la izquierda «Guardar como plantilla» como botón quieto (A7-7) y a la derecha el único primario, «Imprimir» (A7-12).
     Encima, solo cuando toca: aviso de perfil incompleto (A7-11), error de guardado y faltantes con enlaces a cada campo. -->
<div class="QQ-barra"><div class="QQ-barra-in">
  <p class="QQ-linea QQ-perfil" hidden>""" + ic(I['aviso'], 16, 2) + """<span class="QQ-flex">Completa tu perfil para que el documento salga con tu encabezado.</span><a href="#" class="QQ-p QQ-txt">Ir a mi perfil</a></p>
  <p class="QQ-falta" role="status" aria-live="polite" hidden></p>
  <p class="QQ-linea QQ-est" role="status" aria-live="polite" hidden><span class="QQ-giro" aria-hidden="true"></span><span class="QQ-est-t"></span></p>
  <div class="QQ-barra-f"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-b-plant" aria-disabled="true"><span class="QQ-solo-ancho">Guardar como plantilla</span><span class="QQ-solo-tel">Plantilla</span></button>
    <button type="button" class="QQ-p QQ-prim QQ-b-imp"><span class="QQ-giro" aria-hidden="true" hidden></span><span class="QQ-b-imp-t">Imprimir</span></button></div>
</div></div>""")

def capas_comunes(v, vp):
    asa = '<span class="QQ-asa" aria-hidden="true"></span>'
    X = '<button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="%s">' + ic(I['x'], 20, 2) + '</button>'
    rej = ''.join('<button type="button" class="QQ-p QQ-z" data-t="%s" data-n="%s" style="--c:var(--d-%s)"%s><span class="QQ-z-i">%s</span><span class="QQ-z-n">%s</span></button>'
                  % (k, n, tok, ' aria-current="true"' if k == v['ico'] else '', ic(I[k], 20), n) for k, n, tok in TIPOS)
    salida = ('<li><button type="button" class="QQ-p QQ-mr QQ-g-desc">' + mi('descargar') + '<span class="QQ-flex">Descargar</span>' + FLECHA + '</button></li>')
    return ("""<!-- Capas (CALMA §13). Velo con desenfoque, uno solo. En teléfono, hoja desde abajo; en Duo abierto y computadora, modal CENTRADO en el área de contenido.
     Dentro de una capa las acciones son botones (principal relleno, secundario tonal o quieto); las filas pulsables siguen siendo filas.
     Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir. En la app será un
     resorte (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<!-- «···»: plantillas (A7-6, A7-9), cada opción con su icono de color. En computadora el menú nace de su botón. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu" data-pan="menu" role="menu" aria-label="Más opciones">""" + asa + """
  <div class="QQ-hj-cab"><h2>Más opciones</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="gpl">""" + mi('marcador') + """<span class="QQ-flex">Guardar como plantilla</span></button>
    <button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="gest">""" + mi('ajustes') + """<span class="QQ-flex">Gestionar plantillas</span></button>
    <button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="vac">""" + mi('borrador') + """<span class="QQ-flex">Vaciar formulario</span></button></div>
</div>
<!-- A7-2/3 · «Cambiar»: la rejilla de nivel 4 con los ocho tipos (2 columnas en teléfono, 4 en Duo abierto y computadora). Cada celda: icono en su cuadro tintado
     arriba y el nombre debajo, que parte en dos líneas si hace falta. Teclado: flechas, Inicio, Fin y Esc, como el tablist de hoy. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-ancha" data-pan="tipo" role="dialog" aria-modal="true" aria-label="Tipo de documento">""" + asa + """
  <div class="QQ-hj-cab"><h2>Tipo de documento</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><div class="QQ-rej" role="tablist" aria-label="Tipo de documento">""" + rej + """</div></div>
</div>
<!-- A7-4 · Confirmación si el formulario ya tiene datos. Botones parejos lado a lado, «Cancelar | Cambiar» (CALMA §20);
     el nombre completo va en el título y en el aria-label. Igual la del tope: «Cancelar | Gestionar». -->
""" + alerta('cambiar', '¿Cambiar a Receta?', 'mal', 'aviso',
             '<h2 class="QQ-cam-t">¿Cambiar a Receta?</h2><p>Se descarta ' + v['def'] + ' que estás llenando. No se puede deshacer.</p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-bt QQ-rojo-s QQ-cam-ok" aria-label="Cambiar a Receta">Cambiar</button>') + """
<!-- A7-6/10 · Aplicar una plantilla: lista con palomita. Estados: con plantillas, sin plantillas, error con «Reintentar»; el esqueleto de carga son tres filas grises (no dibujado). -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="usar" role="dialog" aria-modal="true" aria-label="Plantilla">""" + asa + """
  <div class="QQ-hj-cab"><h2>Plantilla</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><div class="QQ-pl-con"><div class="QQ-pl-l" role="radiogroup" aria-label="Plantilla"></div>
      <button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-pl-vaciar" role="radio" aria-checked="false"><span class="QQ-flex">Vaciar formulario</span>""" + PALOMA + """</button>
      <button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-pl-nada" role="radio" aria-checked="true"><span class="QQ-flex">— Sin plantilla —</span>""" + PALOMA + """</button></div>
    <div class="QQ-pl-sin" hidden><p class="QQ-mr-t" style="padding:8px 0 4px"><span style="font-size:16px;line-height:22px;font-weight:600">Sin plantillas de """ + v['etq'] + """</span>
      <span class="QQ-mr-s">Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.</span></p></div>
    <div class="QQ-pl-err" hidden><p class="QQ-fila" style="padding:8px 0"><span class="QQ-flex QQ-nota">No se pudieron cargar tus plantillas.</span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-pl-reint">Reintentar</button></p></div></div>
  <div class="QQ-hj-p QQ-pl-pie"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-pl-gest">Gestionar plantillas</button></div>
</div>
<!-- A7-7 · «Guardar como plantilla»: nombre; Enter confirma; avisa de nombre duplicado -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="guardar" data-foco="1" role="dialog" aria-modal="true" aria-label="Guardar como plantilla">""" + asa + """
  <div class="QQ-hj-cab"><h2>Guardar como plantilla</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><p class="QQ-hj-sub">Se guarda todo menos los datos del paciente.</p>
    <label class="QQ-f" style="padding-top:0"><span>Nombre</span><input type="text" class="QQ-fin QQ-gp-in" placeholder="Prequirúrgico" autocomplete="off"></label>
    <p class="QQ-nota QQ-n-mal QQ-gp-dup" style="padding-top:8px" hidden>Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.</p></div>
  <div class="QQ-hj-p"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-gp-ok" disabled>Guardar</button></div>
</div>
<!-- A7-8 · Tope de 10 plantillas -->
""" + alerta('tope', 'Ya tienes 10 plantillas de ' + v['etq'], 'ag', 'aviso',
             '<h2>Ya tienes 10 plantillas de ' + v['etq'] + '</h2><p>Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-tope-ok" aria-label="Gestionar plantillas">Gestionar</button>') + """
<!-- A7-9/10 · Gestionar: cada plantilla es una fila; su «···» despliega tres botones pequeños: Renombrar (en línea: Enter guarda, Esc cancela), Sobrescribir y Eliminar (con confirmación).
     Reintento por operación en una línea arriba. La X es «Volver al formulario» (también Esc). -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-alta" data-pan="gest" role="dialog" aria-modal="true" aria-label="Plantillas de """ + v['etq'] + """">""" + asa + """
  <div class="QQ-hj-cab"><h2>Plantillas de """ + v['etq'] + """</h2><span class="QQ-nota QQ-num QQ-gs-n">3 / 10</span>""" + X % 'Volver al formulario' + """</div>
  <div class="QQ-hj-c"><p class="QQ-fila QQ-gs-oper" style="padding:0 0 8px" hidden><span class="QQ-flex QQ-nota QQ-n-mal QQ-gs-oper-t"></span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-gs-reint">Reintentar</button></p>
    <p class="QQ-hj-sub QQ-gs-vac" hidden>El formulario no tiene nada que una plantilla guarde: no hay con qué sobrescribir.</p>
    <ul class="QQ-gs-l"></ul>
    <div class="QQ-gs-sin" hidden><p class="QQ-mr-t" style="padding:8px 0 12px"><span style="font-size:16px;line-height:22px;font-weight:600">Todavía no tienes plantillas de """ + v['etq'] + """</span>
      <span class="QQ-mr-s">Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.</span></p>
      <button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra QQ-ancho">Volver al formulario</button></div>
    <div class="QQ-gs-err" hidden><p class="QQ-fila" style="padding:8px 0"><span class="QQ-flex QQ-nota">No se pudieron cargar tus plantillas.</span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-pl-reint">Reintentar</button></p></div></div>
</div>
""" + alerta('conf', 'Confirmar', 'mal', 'basura',
             '<h2 class="QQ-cf-t"></h2><p class="QQ-cf-p"></p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cf-no">Cancelar</button><button type="button" class="QQ-p QQ-bt QQ-rojo-s QQ-cf-ok"></button>') + """
<!-- A7-13/14/15 · Modal posterior: lista de filas pulsables con su icono. «Visualizar» abre el PDF; correo con la dirección de la ficha o «Usar otro correo solo para este envío»
     (confirmación explícita de la dirección escrita a mano y oferta de guardarla en la ficha); «Descargar» en todos los marcos (CALMA §23.2). -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="gen" data-paso="listo" data-ok="1" role="dialog" aria-modal="true" aria-label=\"""" + v['tgen'] + """\">""" + asa + """
  <div class="QQ-ok-cab"><span class="QQ-ok-i" aria-hidden="true"><span class="QQ-ok-si">""" + ic(I['ok'], 22, 2.4) + """</span><span class="QQ-ok-no">""" + ic(I['aviso'], 22, 2) + """</span></span>
    <div class="QQ-flex"><h2 class="QQ-ok-t">""" + v['tgen'] + """</h2><p class="QQ-ok-s QQ-g-si">Ya puedes abrirlo para revisarlo o imprimirlo.</p></div></div>
  <div class="QQ-hj-c"><p class="QQ-nota QQ-just QQ-g-no" hidden>El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente.</p>
    <ul class="QQ-g-lista"><li><button type="button" class="QQ-p QQ-mr QQ-g-ver">""" + mi('ojo') + """<span class="QQ-flex">Visualizar</span>""" + FLECHA + """</button></li>
      <li><button type="button" class="QQ-p QQ-mr QQ-g-correo">""" + mi('correo') + """<span class="QQ-mr-t"><span class="QQ-g-correo-t">Enviar por correo</span><span class="QQ-mr-s QQ-g-dest">Se enviará a paciente01@semilla.spinus.test</span><span class="QQ-g-noexp" hidden><span class="QQ-etq QQ-e-ag">No quedó en el expediente</span></span></span>""" + FLECHA + """</button></li>
      """ + salida + """</ul>
    <button type="button" class="QQ-p QQ-bt QQ-tonal QQ-ancho QQ-g-otro">Usar otro correo solo para este envío</button>
    <div class="QQ-g-pide" hidden><label class="QQ-f"><span>Correo solo para este envío (la ficha no se toca):</span><input type="email" inputmode="email" class="QQ-fin QQ-g-in" placeholder="nombre@correo.com" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
      <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-canc">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-g-enviar" disabled>Enviar por correo</button></p></div>
    <div class="QQ-g-conf" hidden><p class="QQ-nota" style="padding-top:10px">Va a enviar el documento a esta dirección escrita a mano:</p><p class="QQ-dir QQ-g-dir"></p>
      <p class="QQ-nota QQ-just">Compruébala letra por letra. El archivo lleva datos clínicos dentro y un correo enviado no se puede recuperar.</p>
      <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-corr">Corregir</button><button type="button" class="QQ-p QQ-prim QQ-g-si-env">Sí, enviar ahí</button></p></div>
    <div class="QQ-g-hecho" hidden><p class="QQ-nota QQ-just" style="padding-top:10px" aria-live="polite">Enviado a <span class="QQ-g-a"></span> con el PDF adjunto. Si no aparece, pídele que revise su carpeta de <b>spam o correo no deseado</b>.</p>
      <div class="QQ-g-ofrece" hidden><p class="QQ-nota" style="padding-top:10px">¿Guardas <b class="QQ-g-a2"></b> en la ficha del paciente para la próxima vez?</p>
        <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-nog">No, gracias</button><button type="button" class="QQ-p QQ-bt QQ-tonal QQ-g-ficha">Guardar en la ficha</button></p></div>
      <p class="QQ-nota QQ-g-fichaok" style="padding-top:8px" hidden>Guardado en la ficha del paciente.</p></div></div>
  <div class="QQ-hj-p"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cerrar</button></div>
</div>
<!-- Lista de opciones con palomita: sustituye a los <select> nativos. En computadora es un menú que nace de su fila, sin velo (CALMA §21) -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu" data-pan="ops" role="dialog" aria-modal="true" aria-label="Opciones">""" + asa + """
  <div class="QQ-hj-cab"><h2 class="QQ-ops-t"></h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c QQ-ops-l" role="radiogroup"></div>
</div>""")

TOAST = '<div class="QQ-toast" role="status" aria-live="polite"><span></span></div>'

# ---------- Filas ----------
def campo(k, et, ph='', req=False, hint='', val='', extra=''):
    return ('<label class="QQ-r%s" data-c="%s"><span class="QQ-l">%s%s%s</span><input type="text" class="QQ-in" data-k="%s" value="%s" placeholder="%s" autocomplete="off"%s%s></label>'
            % (' QQ-ch' if hint else '', k, et, '&nbsp;<b aria-hidden="true">*</b>' if req else '', '<i>%s</i>' % hint if hint else '', k, val, ph, ' aria-required="true"' if req else '', extra))

def area(k, et, ph, oculta=False, cls=''):
    if oculta:   # la etiqueta ya es el título del grupo (hoy es sr-only)
        return '<label class="QQ-r" data-c="%s"><textarea class="QQ-ta QQ-sin-l %s" data-k="%s" rows="2" placeholder="%s" aria-label="%s"></textarea></label>' % (k, cls, k, ph, et)
    return '<label class="QQ-r" data-c="%s"><span class="QQ-l">%s</span><textarea class="QQ-ta %s" data-k="%s" rows="2" placeholder="%s"></textarea></label>' % (k, et, cls, k, ph)

def elegir(k, et, ops):
    return ('<button type="button" class="QQ-p QQ-r QQ-sel" data-k="%s" data-tit="%s" data-ops="%s" aria-haspopup="dialog"><span class="QQ-l">%s</span><span class="QQ-flex QQ-v QQ-nada">Seleccionar…</span>%s</button>'
            % (k, et, '|'.join(ops), et, ic(I['selector'], 16, 2)))

def grupo(tit, cuerpo, n='', cls='', com=''):
    t = '<h2 class="QQ-g-t">%s%s</h2>' % (tit, '<span class="QQ-g-n %s"></span>' % n if n else '') if tit else ''
    return '%s<section class="QQ-g%s">%s<div class="QQ-s">%s</div></section>' % (com, ' ' + cls if cls else '', t, cuerpo)

# ================= Vista 5 · Suplementación =================
def cuerpo5(vp):
    return (grupo('Datos del paciente',
                  campo('fecha', 'Fecha', val='19 nov 2026') + campo('paciente', 'Paciente', 'Nombre completo', True, 'De la ficha · editable', 'Paciente Prueba 01')
                  + campo('diag', 'Diagnóstico', 'Diagnóstico principal', False, 'Del diagnóstico de la consulta', 'Lumbago')
                  + campo('peso', 'Peso (kg)', 'Ej: 75', True, 'Calcula las dosis por peso', extra=' inputmode="decimal"'),
                  com='<!-- A7-21 · Datos del paciente: fecha (selector nativo de fecha), paciente y diagnóstico rellenados y editables, peso obligatorio que calcula las dosis -->\n')
            + '<p class="QQ-linea QQ-recalc" role="status" aria-live="polite" hidden></p>\n'
            + grupo('Suplementos', '<ul class="QQ-lst QQ-sup-l"></ul><button type="button" class="QQ-p QQ-r QQ-add QQ-b-cat" data-c="sup" aria-haspopup="dialog">' + MAS_I + '<span class="QQ-flex">Agregar suplemento</span><span class="QQ-add-n QQ-num QQ-sup-n"></span><span class="QQ-fle">' + FLECHA + '</span></button>', '',
                    com='<!-- A7-21 · Suplementos elegidos como filas (nombre, dosis, marca · nota). Tocar la fila abre su hoja (dosis editable, marca, nota / justificación, beneficio);\n     la × la quita. La última fila («+ Agregar suplemento · N de 9», texto aprobado §20) abre el catálogo de nueve con palomitas. -->\n')
            + grupo('Notas y control', area('notas', 'Notas adicionales', 'Indicaciones generales…') + campo('control', 'Cita de control', 'Ej: En 3 meses con nuevos laboratorios')))

def capas5(vp):
    asa = '<span class="QQ-asa" aria-hidden="true"></span>'
    return ("""<!-- Catálogo de suplementos: nueve filas con palomita; nombre, dosis de referencia por kilo y beneficio clínico (acotado, con «Ver completo»). Sin buscador: hoy no existe. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-alta" data-pan="cat" role="dialog" aria-modal="true" aria-label="Suplementos">""" + asa + """
  <div class="QQ-hj-cab"><h2>Suplementos</h2><span class="QQ-nota QQ-num QQ-sup-n"></span>""" + '<button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="Cerrar">' + ic(I['x'], 20, 2) + '</button>' + """</div>
  <div class="QQ-hj-c"><ul class="QQ-cat-l"></ul></div>
</div>
<!-- Hoja de un suplemento elegido: los tres campos de hoy (Dosis, Marca comercial, Nota / justificación). Se quita con la × de su fila o desmarcándolo en el catálogo, como hoy al desactivar su tarjeta. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-media" data-pan="sup" role="dialog" aria-modal="true" aria-label="Suplemento">""" + asa + """
  <div class="QQ-hj-cab"><h2 class="QQ-se-t"></h2>""" + '<button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="Cerrar">' + ic(I['x'], 20, 2) + '</button>' + """</div>
  <div class="QQ-hj-c"><p class="QQ-hj-sub QQ-num QQ-se-ref" style="padding-bottom:4px"></p><p class="QQ-nota QQ-just QQ-se-ben"></p>
    <label class="QQ-f"><span>Dosis</span><input type="text" class="QQ-fin QQ-se-dosis" autocomplete="off"></label>
    <label class="QQ-f"><span>Marca comercial</span><input type="text" class="QQ-fin QQ-se-marca" placeholder="Ej: Nordic Naturals" autocomplete="off"></label>
    <label class="QQ-f"><span>Nota / justificación</span><input type="text" class="QQ-fin QQ-se-just" placeholder="Ej: Vitamina D 18 ng/mL en laboratorio" autocomplete="off"></label></div>
</div>""")

CSS5 = '''
.QQ{--dc:var(--d-suplementacion)}
.QQ .QQ-sr{min-height:60px;padding-right:4px}
.QQ .QQ-sr-b{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;padding:10px 4px 10px 16px;text-align:left}
.QQ .QQ-sr-n{font-size:16px;line-height:22px;font-weight:600}
.QQ .QQ-sr-d{font-size:15px;line-height:20px;font-variant-numeric:tabular-nums}
.QQ .QQ-sr-d.QQ-nada{color:var(--tinta3)}
.QQ .QQ-sr-m{font-size:13px;line-height:18px;color:var(--tinta2)}
.QQ .QQ-recalc{margin-top:8px;padding:0 16px}
.QQ .QQ-cat-l>li{position:relative;padding-bottom:10px}
.QQ .QQ-cat-l>li+li{box-shadow:inset 0 1px 0 var(--linea)}
.QQ .QQ-cat{align-items:flex-start;padding:10px 0 0;min-height:52px;font-weight:400!important}
.QQ .QQ-cat>svg{margin-top:4px}
.QQ .QQ-cat-n{font-size:16px;line-height:22px;font-weight:600}
.QQ .QQ-cat-ben{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;margin-top:2px;font-size:13px;line-height:18px;color:var(--tinta2)}
.QQ .QQ-cat-l>li.QQ-todo .QQ-cat-ben{-webkit-line-clamp:unset}
.QQ .QQ-vermas{position:relative;min-height:18px;padding:0;margin-top:2px;font-size:13px;line-height:18px}
.QQ .QQ-vermas::after{content:"";position:absolute;inset:-13px -8px}
.QQ[data-vp="ih"] .QQ-sr,.QQ[data-vp="esc"] .QQ-sr{min-height:56px;padding-right:8px}
.QQ[data-vp="ih"] .QQ-sr-b,.QQ[data-vp="esc"] .QQ-sr-b{padding:8px 4px 8px 20px}
.QQ[data-vp="ih"] .QQ-sr-n,.QQ[data-vp="esc"] .QQ-sr-n{font-size:15px;line-height:20px}
.QQ[data-vp="ih"] .QQ-sr-d,.QQ[data-vp="esc"] .QQ-sr-d{font-size:14px}
.QQ[data-vp="ih"] .QQ-cat-n,.QQ[data-vp="esc"] .QQ-cat-n{font-size:15px;line-height:20px}
.QQ[data-vp="ih"] .QQ-vermas::after,.QQ[data-vp="esc"] .QQ-vermas::after{inset:-9px -8px}
'''
IV5 = '''
.QQ[data-vp="iv"] .QQ-vermas::after{inset:-13px -8px}
'''

# ================= Vista 6 · Internamiento =================
TIPOS_INT = ['Cirugía electiva', 'Cirugía de urgencia', 'Procedimiento diagnóstico', 'Tratamiento médico', 'Rehabilitación']
ASA = ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V', 'ASA E (Emergencia)']
REQS = ['Sangre y hemoderivados', 'Unidad de Cuidados Intensivos (UCI)', 'Material de osteosíntesis', 'Implante especial', 'Ayuno preoperatorio', 'Profilaxis antibiótica', 'Tromboprofilaxis']

def cuerpo6(vp):
    reqs = ''.join('<button type="button" class="QQ-p QQ-r QQ-ck QQ-req" aria-pressed="false" data-v="%s"><span class="QQ-flex">%s</span>%s</button>' % (r, r, PALOMA) for r in REQS)
    def plegable(k, tit, cuerpo):
        return ('<section class="QQ-g QQ-junto"><div class="QQ-s"><button type="button" class="QQ-p QQ-r QQ-pl" data-pl="%s" aria-expanded="false" aria-controls="QQ-%s-%s"><span class="QQ-flex">%s</span>'
                '<span class="QQ-pl-r" data-res="%s"></span>%s</button><div class="QQ-cuerpo" id="QQ-%s-%s" hidden>%s</div></div></section>') % (k, k, vp, tit, k, FLECHA, k, vp, cuerpo)
    return (grupo('Datos generales',
                  campo('fecha', 'Fecha', val='19 nov 2026') + campo('paciente', 'Paciente', 'Nombre completo', True, val='Paciente Prueba 01')
                  + elegir('tipo', 'Tipo de internamiento', TIPOS_INT) + campo('ingreso', 'Fecha propuesta de ingreso', 'dd/mm/aaaa', True)
                  + campo('dias', 'Días estimados', 'Ej: 3-5 días') + elegir('asa', 'Clasificación ASA', ASA)
                  + campo('lugar', 'Hospital / lugar de internamiento', 'Ej: Hospital Ángeles Lomas', True)
                  + '<button type="button" class="QQ-p QQ-r QQ-sw QQ-urg" role="switch" aria-checked="false"><span class="QQ-flex">Marcar como URGENTE</span><span class="QQ-sw-p"></span></button>',
                  com='<!-- A7-22 · Datos generales: fecha, paciente, tipo (lista), fecha propuesta de ingreso (obligatoria), días estimados (texto libre), ASA (lista), hospital y «Marcar como URGENTE».\n     El folio INT-AAAA-NNNN lo lleva la fila y NO se muestra ni se captura aquí (DOCUMENTOS_RANURAS_MUERTAS §2): solo aparece en el aviso de guardado. -->\n')
            + grupo('Diagnósticos', campo('dx', 'Diagnóstico principal', 'Diagnóstico principal de ingreso', True, val='Gonalgia') + '<ul class="QQ-lst QQ-sec-l"></ul>'
                    '<button type="button" class="QQ-p QQ-r QQ-add QQ-b-sec" aria-label="Agregar diagnóstico secundario">' + MAS_I + 'Agregar</button>')
            + grupo('Procedimiento', area('proc', 'Procedimiento / cirugía solicitada', 'Ej: Artrodesis posterolateral L4-L5 con tornillos pediculares e injerto óseo autólogo…', True))
            + grupo('Requerimientos especiales', reqs + campo('reqOtro', 'Otro requerimiento', 'El que no esté en la lista'),
                    com='<!-- Requerimientos: siete filas con palomita a la derecha (no una pared de chips) + «Otro requerimiento» -->\n')
            + grupo('Justificación clínica', area('just', 'Justificación clínica', 'Evolución del padecimiento, hallazgos, fracaso del tratamiento conservador…', True))
            + '\n<!-- Las dos secciones largas nacen plegadas, al final, como hoy. Plegar resume: «Editada», «2 grupos · 3 renglones». -->\n'
            + plegable('instr', 'Instrucciones al paciente', '<label class="QQ-r"><textarea class="QQ-ta QQ-sin-l" data-k="instr" rows="6" aria-label="Instrucciones al paciente"></textarea></label>')
            + plegable('piso', 'Indicaciones de ingreso a piso',
                       '<div class="QQ-chips" role="group"></div>'
                       '<div class="QQ-nuevo" hidden><input type="text" class="QQ-fin QQ-nuevo-in" placeholder="Nombre del grupo" aria-label="Nombre del grupo" autocomplete="off">'
                       '<button type="button" class="QQ-p QQ-ib QQ-ten QQ-nuevo-x" aria-label="Cancelar grupo nuevo">' + ic(I['x'], 18, 2) + '</button><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-nuevo-ok">Añadir</button></div>'
                       '<p class="QQ-vacia QQ-piso-0">Elige un grupo para empezar. La numeración y los guiones los pone el documento.</p><div class="QQ-grupos"></div>'))

CSS6 = '''
.QQ{--dc:var(--d-internamiento)}
.QQ .QQ-chips{display:flex;flex-wrap:wrap;gap:8px;padding:4px 16px 12px}
.QQ .QQ-chipb{position:relative;display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 14px;border-radius:999px;background:var(--sup2);color:var(--tinta);font-size:14px;line-height:18px;white-space:nowrap}
.QQ .QQ-chipb::after{content:"";position:absolute;inset:-4px 0}
.QQ .QQ-chipb[aria-pressed="true"]{background:var(--tonal);color:var(--tonal-tinta);font-weight:600}
.QQ .QQ-chipb.QQ-otro{background:none;color:var(--enlace);font-weight:600;padding:0 8px}
.QQ .QQ-nuevo{display:flex;align-items:center;gap:4px;padding:0 8px 12px 16px}
.QQ .QQ-nuevo .QQ-fin{flex:1}
.QQ .QQ-grupos{position:relative}
.QQ .QQ-gb{position:relative}
.QQ .QQ-gb::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--linea)}
.QQ .QQ-gb-c{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 4px 0 16px;font-size:13px;line-height:18px;color:var(--tinta2)}
.QQ .QQ-gb-c b{font-size:15px;line-height:20px;font-weight:600;color:var(--tinta)}
.QQ .QQ-gb .QQ-rl{min-height:48px}
.QQ .QQ-gb .QQ-rl .QQ-in{height:48px;padding-top:12px;padding-bottom:12px}
.QQ .QQ-gb .QQ-add{min-height:48px;font-size:15px}
.QQ .QQ-gb-c+.QQ-r::before{content:none}
/* Etiquetas largas («Hospital / lugar de internamiento», «Fecha propuesta de ingreso»): en este formulario la columna de etiquetas mide 260 en vez de 208,
   así ninguna parte en dos renglones y todos los valores siguen alineados en una sola vertical */
.QQ[data-vp="ih"] .QQ-in,.QQ[data-vp="esc"] .QQ-in,.QQ[data-vp="ih"] .QQ-sel,.QQ[data-vp="esc"] .QQ-sel{padding-left:264px}
.QQ[data-vp="ih"] .QQ-rl .QQ-in,.QQ[data-vp="esc"] .QQ-rl .QQ-in{padding-left:20px}
.QQ[data-vp="ih"] .QQ-chips,.QQ[data-vp="esc"] .QQ-chips{padding:4px 20px 12px}
.QQ[data-vp="ih"] .QQ-chipb,.QQ[data-vp="esc"] .QQ-chipb{height:32px;font-size:13px}
.QQ[data-vp="ih"] .QQ-chipb::after,.QQ[data-vp="esc"] .QQ-chipb::after{inset:-2px 0}
.QQ[data-vp="ih"] .QQ-nuevo,.QQ[data-vp="esc"] .QQ-nuevo{padding:0 12px 12px 20px}
.QQ[data-vp="ih"] .QQ-gb-c,.QQ[data-vp="esc"] .QQ-gb-c{min-height:48px;padding:0 8px 0 20px}
.QQ[data-vp="ih"] .QQ-gb .QQ-rl,.QQ[data-vp="esc"] .QQ-gb .QQ-rl{min-height:44px}
.QQ[data-vp="ih"] .QQ-gb .QQ-rl .QQ-in,.QQ[data-vp="esc"] .QQ-gb .QQ-rl .QQ-in{height:44px;padding-top:10px;padding-bottom:10px}
.QQ[data-vp="ih"] .QQ-gb .QQ-add,.QQ[data-vp="esc"] .QQ-gb .QQ-add{min-height:40px;font-size:14px}
'''
IV6 = '''
/* Duo vertical: columna de etiquetas de 188 como en docs-a; las largas («Hospital / lugar de internamiento») parten en dos renglones */
.QQ[data-vp="iv"] .QQ-in,.QQ[data-vp="iv"] .QQ-sel{padding-left:208px}
.QQ[data-vp="iv"] .QQ-rl .QQ-in{padding-left:20px}
.QQ[data-vp="iv"] .QQ-r:not(:has(.QQ-ta))>.QQ-l{display:block;top:50%;bottom:auto;right:auto;width:172px;transform:translateY(-50%);white-space:normal;line-height:16px}
.QQ[data-vp="iv"] .QQ-chipb{height:36px;font-size:14px}
.QQ[data-vp="iv"] .QQ-chipb::after{inset:-4px 0}
.QQ[data-vp="iv"] .QQ-gb .QQ-add{min-height:44px}
'''

# ================= Vista 7 · Escrito médico =================
def cuerpo7(vp):
    def fb(k, nom, ico, cls=''):
        return '<button type="button" class="QQ-p QQ-fb-b%s" data-f="%s" aria-label="%s" aria-pressed="false">%s</button>' % (' ' + cls if cls else '', k, nom, ic(I[ico], 18, 2))
    barra_f = ('<div class="QQ-fb" role="group" aria-label="Formato del escrito">'
               '<button type="button" class="QQ-p QQ-fb-b QQ-fb-bl" data-m="bloque" aria-haspopup="menu" aria-label="Bloque: Normal"><span class="QQ-fb-bi">' + ic(I['parr'], 18, 2) + '</span><span class="QQ-fb-bn">Normal</span>' + ic(I['abajo'], 13, 2.2) + '</button>'
               + fb('bold', 'Negrita', 'negrita') + fb('italic', 'Cursiva', 'cursiva') + fb('ul', 'Viñetas', 'vin') + fb('ol', 'Numerada', 'numer') + fb('underline', 'Subrayado', 'subr', 'QQ-solo-ancho')
               + '<button type="button" class="QQ-p QQ-fb-b QQ-fb-al QQ-solo-ancho" data-m="alin" aria-haspopup="menu" aria-label="Alineación: Justificado"><span class="QQ-fb-ali">' + ic(I['a_justify'], 18, 2) + '</span></button>'
               + fb('quote', 'Cita', 'cita', 'QQ-solo-ancho') + fb('hr', 'Separador', 'sep', 'QQ-solo-ancho') + fb('clear', 'Quitar formato', 'quitar', 'QQ-solo-ancho')
               + '<span class="QQ-flex"></span><button type="button" class="QQ-p QQ-fb-b QQ-fb-mas QQ-solo-tel" data-m="masf" aria-haspopup="menu" aria-label="Más opciones de formato">' + ic(I['mas'], 20, 3) + '</button></div>')
    return ('''<!-- A7-23 · Datos del documento: una fila-resumen (como «Signos vitales» en la nueva nota) que abre los cuatro campos de hoy en una hoja:
     Fecha, Paciente (opcional), Título del documento y Título del pie (con «Usar el título»). Ninguno es obligatorio; el único obligatorio es el cuerpo. -->
<section class="QQ-g"><div class="QQ-s"><button type="button" class="QQ-p QQ-r QQ-dat" aria-haspopup="dialog"><span class="QQ-l">Datos del documento</span><span class="QQ-flex QQ-dat-v"></span>''' + FLECHA + '''</button></div></section>
<!-- LA cosa importante: la hoja para escribir. Barra de formato fina pegada al borde superior, iconos tenues de un solo color; activo en --tonal.
     Teléfono: caben enteros, sin desplazar ni cortar, el bloque y los cuatro de primer nivel de hoy (negrita, cursiva, viñetas, numerada); a la derecha, separado por una
     línea, «···» abre la hoja con los demás, con su nombre escrito: Subrayado, Alineación (abre su lista), Cita, Separador y Quitar formato. Mismo reparto por niveles que hoy.
     Ancho: los diez controles a la vista y sin «···» (igual que hoy a partir de 760 px). No hay deshacer/rehacer: tampoco hoy.
     El texto se ve JUSTIFICADO por defecto (CALMA §12); si el médico elige otra alineación, se respeta la suya. -->
<section class="QQ-g QQ-g-hoja"><h2 class="QQ-g-t">Cuerpo del escrito<span class="QQ-g-n QQ-bloques">Vacío</span></h2>
  <div class="QQ-s QQ-papel" data-c="cuerpo">''' + barra_f + '''
    <div class="QQ-ed" lang="es" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Cuerpo del escrito" data-ph="Redacta aquí el contenido del documento..." spellcheck="false"></div></div>
</section>''')

def capas7(vp):
    asa = '<span class="QQ-asa" aria-hidden="true"></span>'
    X = '<button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="Cerrar">' + ic(I['x'], 20, 2) + '</button>'
    def mr(attr, ico, nom, chk=True):
        return ('<button type="button" class="QQ-p QQ-mr%s" role="%s" %s%s>%s<span class="QQ-flex">%s</span>%s</button>'
                % (' QQ-ck2' if chk else '', 'menuitemradio' if chk else 'menuitem', attr, ' aria-checked="false"' if chk else '', '<span class="QQ-mi">' + ic(I[ico], 20, 2) + '</span>', nom, PALOMA if chk else ''))
    return ('''<div tabindex="-1" class="QQ-pan QQ-hoja QQ-media" data-pan="datos" role="dialog" aria-modal="true" aria-label="Datos del documento">''' + asa + '''
  <div class="QQ-hj-cab"><h2>Datos del documento</h2>''' + X + '''</div>
  <div class="QQ-hj-c">
    <label class="QQ-f" style="padding-top:0"><span>Fecha</span><input type="text" class="QQ-fin" data-k="fecha" value="19 nov 2026" autocomplete="off"></label>
    <label class="QQ-f"><span>Paciente <i class="QQ-opc">opcional</i></span><input type="text" class="QQ-fin" data-k="paciente" value="Paciente Prueba 01" placeholder="Sin paciente" autocomplete="off"></label>
    <p class="QQ-nota QQ-h-pac" style="padding-top:4px" hidden>Se puede emitir sin paciente</p>
    <label class="QQ-f"><span>Título del documento</span><input type="text" class="QQ-fin" data-k="titulo" placeholder="Sin título" autocomplete="off"></label>
    <p class="QQ-nota QQ-h-tit" style="padding-top:4px"></p>
    <div class="QQ-f"><span class="QQ-pie-l"><label for="QQ-pie-''' + vp + '''">Título del pie</label><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-usar" hidden>Usar el título</button></span>
      <input type="text" class="QQ-fin" id="QQ-pie-''' + vp + '''" data-k="pie" placeholder="Sin título" autocomplete="off"></div>
    <p class="QQ-nota" style="padding-top:4px">Se imprime en el pie de cada página. Por defecto copia el título; en cuanto lo editas, deja de seguirlo.</p></div>
</div>
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu QQ-m-izq" data-pan="bloque" role="menu" aria-label="Bloque">''' + asa + '''
  <div class="QQ-hj-cab"><h2>Bloque</h2>''' + X + '''</div>
  <div class="QQ-hj-c">''' + mr('data-bl="p"', 'parr', 'Normal') + mr('data-bl="h2"', 'h2', 'Título') + mr('data-bl="h3"', 'h3', 'Subtítulo') + '''</div>
</div>
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu QQ-m-izq" data-pan="alin" role="menu" aria-label="Alineación">''' + asa + '''
  <div class="QQ-hj-cab"><h2>Alineación</h2>''' + X + '''</div>
  <div class="QQ-hj-c">''' + mr('data-al="left"', 'a_left', 'Izquierda') + mr('data-al="center"', 'a_center', 'Centro') + mr('data-al="right"', 'a_right', 'Derecha') + mr('data-al="justify"', 'a_justify', 'Justificado') + '''</div>
</div>
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu" data-pan="masf" role="menu" aria-label="Más opciones de formato">''' + asa + '''
  <div class="QQ-hj-cab"><h2>Más opciones de formato</h2>''' + X + '''</div>
  <div class="QQ-hj-c">''' + mr('data-f="underline"', 'subr', 'Subrayado')
            + '<button type="button" class="QQ-p QQ-mr" role="menuitem" data-m="alin" aria-haspopup="menu"><span class="QQ-mi">' + ic(I['a_justify'], 20, 2) + '</span><span class="QQ-flex">Alineación</span><span class="QQ-mr-v QQ-al-v">Justificado</span>' + FLECHA + '</button>'
            + mr('data-f="quote"', 'cita', 'Cita') + mr('data-f="hr"', 'sep', 'Separador', False) + mr('data-f="clear"', 'quitar', 'Quitar formato', False) + '''</div>
</div>''')

CSS7 = '''
.QQ{--dc:var(--d-escrito)}
.QQ .QQ-dat{padding:30px 12px 10px 16px;gap:8px;font-size:16px;line-height:24px}
.QQ .QQ-dat>svg{color:var(--tinta3);margin-top:-18px}
.QQ .QQ-dat-v{overflow-wrap:anywhere}  /* el resumen parte en renglones en vez de cortarse (PIEZAS §13) */
.QQ .QQ-g-hoja{flex:1 0 auto;display:flex;flex-direction:column}
.QQ .QQ-papel{flex:1 0 auto;display:flex;flex-direction:column;min-height:260px}
.QQ .QQ-g-hoja:has(.QQ-mala) .QQ-bloques{color:var(--mal-tinta);font-weight:600}
.QQ .QQ-papel:has(.QQ-ed:focus-visible){outline:2px solid var(--enlace);outline-offset:0}
.QQ .QQ-fb{flex:none;position:sticky;top:0;z-index:2;display:flex;align-items:center;height:44px;padding:0 4px;border-bottom:1px solid var(--linea);background:var(--sup);border-radius:16px 16px 0 0}
.QQ .QQ-fb-b{position:relative;flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;gap:2px;color:var(--tinta2)}
.QQ .QQ-fb-b::before{content:"";position:absolute;inset:6px;border-radius:8px}
.QQ .QQ-fb-b[aria-pressed="true"]::before{background:var(--tonal)}
.QQ .QQ-fb-b[aria-pressed="true"]{color:var(--tonal-tinta)}
.QQ .QQ-fb-b>*{position:relative}
.QQ .QQ-fb-bi,.QQ .QQ-fb-ali{display:flex}
.QQ .QQ-fb-bl{width:52px}
.QQ .QQ-fb-bl>svg{color:var(--tinta3)}
.QQ .QQ-fb-bn{display:none;font-size:14px;line-height:18px}
.QQ .QQ-fb-mas{box-shadow:-1px 0 0 var(--linea)}
.QQ .QQ-ed{flex:1 0 auto;min-height:200px;padding:14px 16px 20px;font-size:17px;line-height:26px;outline:0;overflow-wrap:anywhere;border-radius:0 0 16px 16px}
/* El escrito se ve justificado por defecto (CALMA §12); la alineación que elija el médico va en línea y manda. Títulos y listas no se justifican. */
.QQ .QQ-ed{text-align:justify;-webkit-hyphens:auto;hyphens:auto}
.QQ .QQ-ed h2,.QQ .QQ-ed h3,.QQ .QQ-ed li{text-align:left;-webkit-hyphens:manual;hyphens:manual}
.QQ .QQ-ed h2,.QQ .QQ-ed h3{color:var(--tinta)}
.QQ .QQ-ed:empty::before{content:attr(data-ph);color:var(--tinta3);pointer-events:none}
.QQ .QQ-ed:empty{text-align:left}
.QQ .QQ-ed p,.QQ .QQ-ed div{margin:0 0 10px}
.QQ .QQ-ed h2{margin:14px 0 6px;font-size:20px;line-height:26px;font-weight:700}
.QQ .QQ-ed h3{margin:12px 0 4px;font-size:17px;line-height:24px;font-weight:700}
.QQ .QQ-ed>:first-child{margin-top:0}
.QQ .QQ-ed ul,.QQ .QQ-ed ol{margin:0 0 10px;padding-left:24px}
.QQ .QQ-ed ul{list-style:disc}
.QQ .QQ-ed ol{list-style:decimal}
.QQ .QQ-ed blockquote{margin:0 0 10px;padding-left:16px;border-left:3px solid var(--borde);font-style:italic;color:var(--tinta2)}
.QQ .QQ-ed hr{border:0;border-top:1px solid var(--borde);margin:14px 0}
.QQ .QQ-opc{font-style:normal;color:var(--tinta3)}
.QQ .QQ-pie-l{display:flex;align-items:center;justify-content:space-between;min-height:32px}
.QQ .QQ-pie-l .QQ-txt{position:relative;min-height:18px;padding:0;font-size:13px;line-height:18px}
.QQ .QQ-pie-l .QQ-txt::after{content:"";position:absolute;inset:-13px -8px}
.QQ[data-vp="ih"] .QQ-dat,.QQ[data-vp="esc"] .QQ-dat{padding:12px 14px 12px 208px;font-size:15px}
.QQ[data-vp="ih"] .QQ-dat>svg,.QQ[data-vp="esc"] .QQ-dat>svg{margin-top:0}
.QQ[data-vp="ih"] .QQ-g-hoja,.QQ[data-vp="esc"] .QQ-g-hoja{margin-top:20px}
.QQ[data-vp="ih"] .QQ-fb,.QQ[data-vp="esc"] .QQ-fb{height:44px;padding:0 10px;gap:0}
.QQ[data-vp="ih"] .QQ-fb-b,.QQ[data-vp="esc"] .QQ-fb-b{width:36px;height:36px}
.QQ[data-vp="ih"] .QQ-fb-b::before,.QQ[data-vp="esc"] .QQ-fb-b::before{inset:2px}
.QQ[data-vp="esc"] .QQ-fb-b:hover::before{background:var(--fondo)}
.QQ[data-vp="esc"] .QQ-fb-b[aria-pressed="true"]:hover::before{background:var(--tonal)}
.QQ[data-vp="ih"] .QQ-fb-bl,.QQ[data-vp="esc"] .QQ-fb-bl{width:auto;padding:0 8px 0 10px;gap:6px;margin-right:6px}
.QQ[data-vp="ih"] .QQ-fb-bi,.QQ[data-vp="esc"] .QQ-fb-bi{display:none}
.QQ[data-vp="ih"] .QQ-fb-bn,.QQ[data-vp="esc"] .QQ-fb-bn{display:block;min-width:62px;text-align:left;color:var(--tinta)}
.QQ[data-vp="ih"] .QQ-ed,.QQ[data-vp="esc"] .QQ-ed{padding:18px 24px 28px;font-size:16px;border-radius:0 0 18px 18px}
.QQ[data-vp="esc"] .QQ-papel{min-height:360px}
.QQ[data-vp="ih"] .QQ-pie-l .QQ-txt::after,.QQ[data-vp="esc"] .QQ-pie-l .QQ-txt::after{inset:-9px -8px}
'''
IV7 = '''
/* Duo vertical: la hoja de escritura ocupa todo el alto libre y la barra de formato completa (diez controles) va a la vista, con áreas de 44 */
.QQ[data-vp="iv"] .QQ-fb{height:52px;padding:0 8px}
.QQ[data-vp="iv"] .QQ-fb-b{width:44px;height:44px}
.QQ[data-vp="iv"] .QQ-fb-b::before{inset:4px}
.QQ[data-vp="iv"] .QQ-fb-bl{width:auto}
.QQ[data-vp="iv"] .QQ-papel{min-height:360px}
.QQ[data-vp="iv"] .QQ-pie-l .QQ-txt::after{inset:-13px -8px}
'''

VISTAS = [
    dict(pref='db5', arch='vista-5-suplementacion.html', ico='sup', nombre='Suplementación', etq='suplementación', **{'def': 'el plan de suplementación'}, tgen='Plan de suplementación generado',
         cuerpo=cuerpo5, capas=capas5, css=CSS5, iv=IV5,
         cfg=dict(tipo='sup', toastGen='Generando plan de suplementación...', toastOk='Plan de suplementación guardado · SUP-2026-0007', plantillas=['Posoperatorio de columna', 'Osteopenia', 'Sarcopenia']),
         desc='Plan de suplementación | Los suplementos elegidos son ahora una lista corta de filas (nombre, dosis, marca) y el catálogo de nueve se abre aparte con palomitas; las tarjetas con borde, las cabeceras en mayúsculas y los dos botones grandes del pie desaparecen'),
    dict(pref='db6', arch='vista-6-internamiento.html', ico='inter', nombre='Internamiento', etq='internamiento', **{'def': 'la solicitud de internamiento'}, tgen='Solicitud de internamiento generada',
         cuerpo=cuerpo6, capas=lambda vp: '', css=CSS6, iv=IV6,
         cfg=dict(tipo='inter', toastGen='Generando solicitud de internamiento...', toastOk='Solicitud de internamiento guardada · INT-2026-0004', plantillas=['Prequirúrgico', 'Artroscopia de rodilla', 'Columna lumbar']),
         desc='Solicitud de internamiento | Los mismos campos, en el mismo orden, como grupos de filas sin cajas ni bordes: las listas se eligen con palomita, los requerimientos dejan de ser una pared de chips y las dos secciones largas siguen plegadas al final con su resumen'),
    dict(pref='db7', arch='vista-7-escrito.html', ico='escrito', nombre='Escrito médico', etq='escrito médico', **{'def': 'el escrito médico'}, tgen='Escrito médico generado',
         cuerpo=cuerpo7, capas=capas7, css=CSS7, iv=IV7,
         cfg=dict(tipo='escrito', toastGen='Generando escrito médico...', toastOk='Escrito guardado', plantillas=['Constancia de atención', 'Justificante de reposo', 'Resumen clínico']),
         desc='Escrito médico | La hoja para escribir ocupa la pantalla: los cuatro datos del documento se resumen en una fila que se abre al tocarla y la barra de formato es una línea fina de iconos tenues, con las mismas opciones de hoy'),
]

def marco(v, vp):
    form = '<div class="QQ-form">\n' + cabecera(v) + '\n' + v['cuerpo'](vp) + '\n</div>'
    col = '<div class="QQ-col"><main class="QQ-cont">\n' + form + '\n</main>\n' + barra() + TOAST + '</div>'
    nav = {'ext': riel, 'tel': encabezado, 'ih': lambda: lateral('ih'), 'iv': fundido, 'esc': lambda: lateral('esc')}[vp]()
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    capas = '<div class="QQ-capa" lang="es" aria-hidden="true"><div class="QQ-velo"></div>\n' + capas_comunes(v, vp) + '\n' + v['capas'](vp) + '\n' + capas_nav(vp) + '</div>'
    return '<div class="marco QQ" data-vp="%s">\n<div class="QQ-app">\n%s\n</div>\n%s\n</div>\n' % (vp, app, capas)

css = open(os.path.join(L, 'tmp-dcb3-estilo.css')).read()
js = open(os.path.join(L, 'tmp-dcb3-guion.js')).read()
import re
def con_iv(t):
    """El Duo vertical toma la composición del Duo abierto (CALMA §19): cada selector de `ih` se duplica para `iv`;
    lo que en `iv` debe ser táctil (44) o distinto se corrige después, en el bloque IV del final."""
    def sel(mt):
        t = mt.group(1); k = t.rfind('*/') + 2 if '*/' in t else 0   # los comentarios previos no se tocan
        pre, t = t[:k], t[k:]
        partes = t.split(',')
        extra = [p.replace('[data-vp="ih"]', '[data-vp="iv"]') for p in partes if '[data-vp="ih"]' in p]
        return pre + ','.join(partes + extra) + '{'
    return re.sub(r'([^{}]+)\{', lambda mt: sel(mt) if '[data-vp="ih"]' in mt.group(1) else mt.group(0), t)
i = css.index('/* ================= TERCERA REVISIÓN')
base_css, iv_css = css[:i], css[i:]
for v in VISTAS:
    out = ('<!-- NOMBRE: ' + v['desc'] + ' -->\n<style>\n' + con_iv(base_css + v['css']) + iv_css + v['iv'] + '</style>\n' + ''.join(marco(v, vp) for vp in ('ext', 'tel', 'ih', 'iv', 'esc'))
           + '<script>\n' + js.replace('__CFG__', json.dumps(v['cfg'], ensure_ascii=False)) + '</script>\n')
    out = out.replace('QQ', v['pref'])
    open(os.path.join(L, v['arch']), 'w').write(out)
    print(v['arch'], len(out))
