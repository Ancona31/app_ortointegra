import re
# Generador de las dos vistas del Taller de documentos, parte 3 (Consentimiento .dc8 y Honorarios .dc9). Uso: python3 tmp-dcc-gen.py
# Las plantillas se escriben con el prefijo «PX» y el token de color «DTOK»; al final se sustituyen por los de cada vista.
import os, json
L = os.path.dirname(os.path.abspath(__file__))
SEC = json.load(open(os.path.join(L, 'tmp-dcc-secciones.json')))

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
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    # Segunda revisión: iconos de menús, filas de hoja y alertas
    plant='<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9h17M9 9v11.5"/>',
    reloj='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    marca='<path d="M6 4h12a1 1 0 0 1 1 1v15.5l-7-4.5-7 4.5V5a1 1 0 0 1 1-1z"/><path d="M12 8v5M9.5 10.5h5"/>',
    ajustes='<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    ojo='<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    correo='<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
    compartir='<path d="M12 15V3.5M8 7l4-4 4 4M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/>',
    descargar='<path d="M12 3.5V15M8 11l4 4 4-4M5 20h14"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    basura='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    sobre='<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    cambio='<path d="M7 4 3.5 7.5 7 11M3.5 7.5h17M17 13l3.5 3.5L17 20M20.5 16.5h-17"/>',
    sello='<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    camara='<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    carpeta='<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    sinfoto='<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    lapiz='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    girar='<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/>',
    capas='<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
)
# Iconos por tipo de documento: copiados tal cual de doc-color/color-documentos.html (CALMA §9)
TIPOS = [
    ('receta', 'Receta', '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>'),
    ('laboratorio', 'Laboratorio', '<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>'),
    ('imagen', 'Imagenología', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
    ('suplementacion', 'Suplementación', '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>'),
    ('internamiento', 'Internamiento', '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>'),
    ('escrito', 'Escrito médico', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    ('consentimiento', 'Consentimiento', '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
    ('honorarios', 'Honorarios / Cotización', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>'),
]
TIPO = {k: (n, d) for k, n, d in TIPOS}
FLECHA = ic(I['sig'], 14, 2.4)
OKM = ic(I['ok'], 18, 2.4).replace('<svg ', '<svg class="PX-okm" ')
ASA = '<span class="PX-asa" aria-hidden="true"></span>'
X = '<button type="button" class="PX-p PX-ib PX-xc PX-cierra" aria-label="%s">' + ic(I['x'], 16, 2.4) + '</button>'

def fi(k, s=20):
    """Icono de fila o de menú: en color de acción (CALMA §11)."""
    return ic(I[k], s).replace('<svg ', '<svg class="PX-fic" ')

def alerta(pan, aria, tono, icono, titulo, cuerpo, botones):
    """Alerta de confirmación, patrón único (CALMA §13): icono de 28 en círculo tintado de 48, título 17/700 centrado, mensaje 14/20 y
    dos botones parejos (secundario a la izquierda, principal a la derecha). Si un rótulo no cabe en media alerta, la pareja se apila sola
    a todo el ancho con el principal arriba (flex-wrap: wrap-reverse)."""
    return ('<div tabindex="-1" class="PX-pan PX-alerta" data-pan="%s" role="alertdialog" aria-modal="true" aria-label="%s">'
            '<span class="PX-al-i PX-al-%s">%s</span><h2>%s</h2><div class="PX-al-m" lang="es">%s</div><div class="PX-par">%s</div></div>'
            % (pan, aria, tono, ic(I[icono], 28, 1.8), titulo, cuerpo, botones))
TOAST = '<div class="PX-toast" role="status" aria-live="polite"><span></span></div>'

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

# ---------- Navegación: copiada del dashboard final (CALMA §28; activo = Documentos) ----------
import importlib.util as _iu
_sp = _iu.spec_from_file_location('cromo', os.path.join(L, 'tmp-dcc5-cromo.py')); CR = _iu.module_from_spec(_sp); _sp.loader.exec_module(CR)
def _px(h):
    """Piezas del cromo con nuestro prefijo y solo la parte del médico (lo de secretaria, «db-s», fuera)."""
    h = re.sub(r'\s*<!-- Secretaria.*?-->\s*<div class="db-s">.*?</div>', '', h, flags=re.S)
    h = re.sub(r'<button type="button" class="db-p db-li db-yo db-s.*?</button>', '', h, flags=re.S)
    return h.replace(' db-m"', '"').replace(' db-m ', ' ').replace('db-', 'PX-')
BDG = '<span class="PX-bdg" aria-hidden="true">3</span>'
def ap(vp, donde):
    h = _px(CR.AP.replace('VP-DONDE', 'PX-' + vp + '-' + donde))
    if vp == 'ih' and donde == 'lat':   # Duo abierto horizontal: plegado de inicio, como en el dashboard
        h = h.replace('class="PX-ap"', 'class="PX-ap PX-pleg"').replace('aria-expanded="true"', 'aria-expanded="false"')
    return h
def mas_pan(vp):
    """Menú «Más» (CALMA §28) del riel de Duo cerrado y de la píldora «Más» de Duo abierto vertical: tarjeta centrada con velo."""
    if vp not in ('ext', 'iv'):
        return ''
    return ('<div tabindex="-1" class="PX-pan PX-hoja PX-mn" data-pan="mas" role="dialog" aria-modal="true" aria-label="Más">'
            '<div class="PX-hj-cab"><h2>Más</h2>' + X % 'Cerrar' + '</div><div class="PX-hj-c">' + ap(vp, 'mas') + _px(CR.MAS) + '</div></div>')
def riel():
    def b(k, t, act=False):
        return '<a href="#" class="PX-p PX-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="PX-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente') + b('agenda', 'Agenda') + b('docs', 'Documentos', True)
            + '<button type="button" class="PX-p PX-rb" aria-label="Más" aria-haspopup="dialog" data-abre-mas>' + ic(I['mas'], 22, 3) + BDG + '</button><span class="PX-flex"></span>'
            '<button type="button" class="PX-p PX-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lateral(vp):
    def a(k, t, act=False):
        return '<a href="#" class="PX-p PX-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    return ('<nav class="PX-lat" aria-label="Navegación principal"><div class="PX-lat-cab"><span class="PX-logo">' + ic(I['logo'], 24) + '<span class="PX-logo-n">Spinus</span></span><span class="PX-plan">Plan VIP</span></div>'
            '<button type="button" class="PX-p PX-cons-b">' + _px(CR.CLOGO) + '<span class="PX-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="PX-lista">' + a('inicio', 'Inicio') + a('pac', 'Expediente') + a('agenda', 'Agenda') + a('docs', 'Documentos', True) + a('admin', 'Administración') + '</div><span class="PX-flex"></span>'
            + ap(vp, 'lat') + _px(CR.PIE) + '</nav>')

def encabezado():
    return ('<header class="PX-enc"><button type="button" class="PX-p PX-menu-b" aria-label="Menú">' + ic(I['menu'], 22, 2) + BDG + '</button><span class="PX-enc-t">Documentos</span><span class="PX-flex"></span>'
            '<button type="button" class="PX-p PX-av PX-av-g" aria-label="Mi perfil">AS</button></header>')

def encabezado_iv():
    """Duo abierto en vertical (CALMA §19): encabezado fundido con botón de barra lateral, pista de secciones y avatar.
    Administración, Mi perfil y Ayuda se alcanzan desde el botón de la izquierda (menú completo) o el avatar."""
    def p(t, act=False):
        return '<a href="#" class="PX-p PX-pi"%s>%s</a>' % (' aria-current="page"' if act else '', t)
    return ('<header class="PX-enc PX-enc-iv"><button type="button" class="PX-p PX-menu-b PX-lat-b" aria-label="Mostrar barra lateral">' + ic(I['barra'], 20) + BDG + '</button>'
            '<nav class="PX-pista" aria-label="Secciones">' + p('Inicio') + p('Expediente') + p('Agenda') + p('Documentos', True) + '<button type="button" class="PX-p PX-pi" aria-haspopup="dialog" data-abre-mas>Más</button></nav>'
            '<button type="button" class="PX-p PX-av PX-av-g" aria-label="Mi perfil">AS</button></header>')

# ---------- Piezas del chasis ----------
def cabecera(vp, tipo):
    """«‹ Documentos» + «···»; icono del tipo (nivel 4 pequeño) + título + «Cambiar»; una línea con el paciente.
    En teléfono «Cambiar» baja al extremo derecho de la línea del paciente: junto al título no cabe (ver resumen)."""
    nombre, d = TIPO[tipo]
    # Segunda revisión (F): «Cambiar» vive en UN solo sitio en los cuatro marcos: a la derecha de la fila de volver, antes de «···», como botón tonal pequeño.
    camb = '<button type="button" class="PX-p PX-ton PX-ch PX-camb" aria-haspopup="dialog">Cambiar</button>'
    return ('<header class="PX-top">\n  <div class="PX-top-f"><a href="#" class="PX-p PX-volver">' + ic(I['volver'], 14, 2.6) + 'Documentos</a><span class="PX-flex"></span>' + camb +
            '<button type="button" class="PX-p PX-ib PX-mas-b" aria-label="Más opciones" aria-haspopup="menu">' + ic(I['mas'], 22, 3) + '</button></div>\n'
            '  <div class="PX-tit"><span class="PX-tile">' + ic(d, 20) + '</span><h1>' + nombre.replace(' / ', '&nbsp;/ ') + '</h1></div>\n'
            '  <p class="PX-sub"><span class="PX-flex">Paciente Prueba 01 · <span class="PX-num">73 años</span></span></p>\n</header>\n'
            '<!-- Plantilla aplicada o formulario vaciado: una línea con «Deshacer» (mensajes de hoy) -->\n'
            '<p class="PX-linea PX-pl-av" hidden aria-live="polite"><span class="PX-flex"></span><button type="button" class="PX-p PX-txt PX-pl-des">Deshacer</button></p>\n'
            '<!-- A6 · Plantilla: una fila discreta al inicio; abre la hoja para aplicar una -->\n'
            '<section class="PX-g PX-plrow"><div class="PX-s"><button type="button" class="PX-p PX-mr PX-pl-fila" aria-haspopup="dialog">' + fi('capas', 18) + '<span class="PX-flex">Plantilla</span><span class="PX-mr-s PX-pl-sel">— Sin plantilla —</span>' + FLECHA + '</button></div></section>')

def campo(k, et, valor='', ph='', hint='', req=False, cls='', extra='', nota=''):
    """Fila de campo: etiqueta arriba y valor debajo en teléfono; etiqueta a la izquierda y valor a la derecha en ancho."""
    return ('<label class="PX-r PX-f%s" data-row="%s"><span class="PX-l"><span class="PX-ln">%s%s</span>%s</span>'
            '<input type="text" class="PX-in" data-k="%s" value="%s" placeholder="%s" autocomplete="off"%s>%s</label>'
            % (' ' + cls if cls else '', k, et, '<span class="PX-req"%s> *</span>' % ('' if req is True else ' hidden') if req is not None else '',
               '<span class="PX-h">%s</span>' % hint if hint else '', k, esc(valor), esc(ph), ' ' + extra if extra else '', nota))

def lista(k, et, ops, valor='', hint='', nota=''):
    o = ''.join('<option%s>%s</option>' % (' selected' if x == valor else '', x) if isinstance(x, str) else '<option value="%s"%s>%s</option>' % (x[0], ' selected' if x[0] == valor else '', x[1]) for x in ops)
    return ('<label class="PX-r PX-f" data-row="%s"><span class="PX-l"><span class="PX-ln">%s</span>%s</span><select class="PX-in" data-k="%s">%s</select>%s%s</label>'
            % (k, et, '<span class="PX-h">%s</span>' % hint if hint else '', k, o, ic(I['selector'], 16, 2).replace('<svg ', '<svg class="PX-chev" '), nota))

def area(k, et, ph=''):
    return ('<label class="PX-r PX-f" data-row="%s"><span class="PX-l"><span class="PX-ln">%s</span></span><textarea class="PX-ta" data-k="%s" rows="3" placeholder="%s"></textarea></label>' % (k, et, k, esc(ph)))

def seg(k, ops, aria, cls=''):
    return ('<div class="PX-seg%s" role="group" aria-label="%s" data-seg="%s">' % (' ' + cls if cls else '', aria, k)
            + ''.join('<button type="button" class="PX-p" data-val="%s" aria-pressed="%s">%s</button>' % (v, 'true' if on else 'false', t) for v, t, on in ops) + '</div>')

def mr(a, t, sub='', extra='', icono='plant'):
    return ('<button type="button" class="PX-p PX-mr" role="menuitem" data-a="%s"%s>%s<span class="PX-ct">%s%s</span></button>' % (a, extra, fi(icono), t, '<small>%s</small>' % sub if sub else ''))

def pie_lineas():
    return ('<!-- A11 · Perfil incompleto: una línea con su enlace (mensaje de hoy) -->\n'
            '<p class="PX-linea PX-linea-pie PX-perfil" hidden><span class="PX-flex">Completa tu perfil para que el documento salga con tu encabezado.</span><a href="#" class="PX-p PX-txt">Ir a mi perfil</a></p>')

def capas_comunes(vp, tipo, etiqueta, defi, filas_menu, propias):
    nombre = TIPO[tipo][0]
    az = ''.join('<button type="button" class="PX-p PX-az" data-n="%s"%s><i style="background:color-mix(in srgb,var(--d-%s) var(--d-mezcla),var(--sup2));color:var(--d-%s)">%s</i><span>%s</span></button>'
                 % (n, ' aria-current="true"' if k == tipo else '', k, k, ic(d, 20), n.replace(' / ', '&nbsp;/ ')) for k, n, d in TIPOS)
    comp = 'Descargar'
    return ('''<div class="PX-capa" aria-hidden="true"><div class="PX-velo"></div>
<!-- Capas. Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir. En la app será un
     resorte (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<!-- «···»: lo ocasional del formulario. A6-A9 plantillas (aplicar, guardar, gestionar). -->
<div tabindex="-1" class="PX-pan PX-hoja PX-menu" data-pan="menu" role="menu" aria-label="Más opciones">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Más opciones</h2>''' + X % 'Cerrar' + '''</div>
  <div class="PX-hj-c">''' + filas_menu + '''</div>
</div>
<!-- A2-A3 · Cambiar de tipo: la rejilla de nivel 4 (los ocho tipos con su color). El tipo actual va marcado.
     En la app es un tablist con teclado (flechas, Home, End, Esc); se conserva. A5 · ?tipo=, ?dx=, ?borrador=, ?doc= siguen igual. -->
<div tabindex="-1" class="PX-pan PX-hoja PX-ancha" data-pan="tipo" role="dialog" aria-modal="true" aria-label="Tipo de documento">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Tipo de documento</h2>''' + X % 'Cerrar' + '''</div>
  <div class="PX-hj-c"><div class="PX-rej">''' + az + '''</div></div>
</div>
<!-- A4 · «¿Cambiar a X?» cuando el formulario ya tiene datos -->
''' + alerta('camb', '¿Cambiar de documento?', 'mal', 'cambio', '¿Cambiar a <span class="PX-ent"></span>?', '<p>Se descarta ' + defi + ' que estás llenando. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-camb-ok">Cambiar</button>') + '''
<!-- A6 · Plantilla: aplicar una (o «Vaciar formulario» / «— Sin plantilla —»). A10 · sin plantillas: la explicación de hoy.
     Estados de sistema no dibujados: esqueleto de carga y «No se pudieron cargar tus plantillas.» con «Reintentar». -->
<div tabindex="-1" class="PX-pan PX-hoja" data-pan="pick" role="dialog" aria-modal="true" aria-label="Plantilla">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Plantilla</h2>''' + X % 'Cerrar' + '''</div>
  <div class="PX-hj-c"><ul class="PX-pick-l"></ul>
    <p class="PX-vacio PX-pick-vacio" hidden><b>Sin plantillas de ''' + etiqueta + '''</b>Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.</p></div>
  <div class="PX-hj-p PX-pick-pie"><span class="PX-mr-s PX-pl-n PX-flex"></span><button type="button" class="PX-p PX-qui PX-pick-gest">Gestionar plantillas</button></div>
</div>
<!-- A7 · Guardar como plantilla: nombre, Enter confirma, aviso de nombre duplicado -->
<div tabindex="-1" class="PX-pan PX-hoja" data-pan="gpl" role="dialog" aria-modal="true" aria-label="Guardar como plantilla">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Guardar como plantilla</h2>''' + X % 'Cancelar' + '''</div>
  <div class="PX-hj-c"><p class="PX-hj-sub">Se guarda todo menos los datos del paciente.</p>
    <label><span class="PX-et">Nombre</span><input type="text" class="PX-campo PX-gpl-in" data-foco maxlength="40" placeholder="Prequirúrgico" autocomplete="off"></label>
    <p class="PX-nota PX-gpl-dup" style="padding:8px 0 0;color:var(--ag-tinta)" hidden>Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.</p></div>
  <div class="PX-hj-p"><div class="PX-par"><button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-gpl-ok">Guardar</button></div></div>
</div>
<!-- A8 · Tope de 10 plantillas -->
''' + alerta('tope', 'Ya tienes 10 plantillas', 'ag', 'aviso', 'Ya tienes 10 plantillas de ' + etiqueta, '<p>Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-tope-ok" aria-label="Gestionar plantillas">Gestionar</button>') + '''
<!-- A9 · Gestionar: cada plantilla es una fila que se despliega en el sitio con Renombrar (en línea; Enter / Esc), Sobrescribir y Eliminar.
     La X es «Volver al formulario». Reintento por operación fallida («No se pudo renombrar «X».» + Reintentar): estado de sistema, no dibujado. -->
<div tabindex="-1" class="PX-pan PX-hoja PX-alta" data-pan="gest" role="dialog" aria-modal="true" aria-label="Plantillas de ''' + etiqueta + '''">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Plantillas de ''' + etiqueta + '''</h2><span class="PX-cta PX-pl-cta"></span>''' + X % 'Volver al formulario' + '''</div>
  <div class="PX-hj-c"><ul class="PX-gest-l"></ul>
    <div class="PX-gest-vacio" hidden><p class="PX-vacio"><b>Todavía no tienes plantillas de ''' + etiqueta + '''</b>Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.</p>
      <button type="button" class="PX-p PX-qui PX-cierra">Volver al formulario</button></div></div>
</div>
''' + alerta('pl-eli', '¿Eliminar la plantilla?', 'mal', 'basura', '¿Eliminar «<span class="PX-cpl-n"></span>»?', '<p>Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Eliminar</button>') + '''
''' + alerta('pl-sob', '¿Sobrescribir la plantilla?', 'mal', 'sobre', '¿Sobrescribir «<span class="PX-cpl-n"></span>»?',
                 '<p>Se reemplaza el contenido guardado de «<span class="PX-cpl-n"></span>» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Sobrescribir</button>') + '''
<!-- A13-A15 · Documento generado (el «modal posterior» de hoy), como lista de filas pulsables. «Visualizar» abre el PDF en otra pestaña y
     «Descargar» lo baja con el nombre de archivo (anclas, sin parte visual en la maqueta). Enviar por correo
     (a la dirección de la ficha, o «Usar otro correo solo para este envío» con confirmación explícita y oferta de guardarla), '''
            + comp + ''' y Cerrar.
     A15 · si el guardado falló pero el PDF existe: el aviso de hoy y el correo deshabilitado con «No quedó en el expediente».
     Paciente sin correo en la ficha: la hoja abre con la captura desplegada y la etiqueta «Este paciente no tiene correo en su ficha. Escríbelo aquí:».
     Errores de envío («No se pudo enviar el documento.», «No se pudo conectar…») van como texto en --mal-tinta bajo la lista. No dibujados. -->
<div tabindex="-1" class="PX-pan PX-hoja PX-gen" data-pan="gen" role="dialog" aria-modal="true" aria-label="Documento generado">''' + ASA + '''
  <span class="PX-al-i PX-al-ok PX-gen-i">''' + ic(I['ok'], 28, 2) + '''</span><h2 class="PX-ok-t PX-gen-t"></h2><p class="PX-ok-s PX-gen-s">Ya puedes abrirlo para revisarlo o imprimirlo.</p>
  <p class="PX-ok-s PX-avi PX-gen-w" hidden>El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente.</p>
  <div class="PX-hj-c"><ul data-gp="listo enviado">
    <li><button type="button" class="PX-p PX-mr PX-gen-ver">''' + fi('ojo') + '''<span class="PX-flex">Visualizar</span>''' + FLECHA + '''</button></li>
    <li><button type="button" class="PX-p PX-mr PX-gen-mail">''' + fi('correo') + '''<span class="PX-ct">Enviar por correo<small></small></span><span class="PX-mr-s"></span></button></li>
    <li class="PX-gen-otro-f"><button type="button" class="PX-p PX-ton PX-ch PX-gen-otro">Usar otro correo solo para este envío</button></li>
    <li><button type="button" class="PX-p PX-mr PX-gen-comp">''' + fi('descargar' if comp == 'Descargar' else 'compartir') + '''<span class="PX-flex">''' + comp + '''</span>''' + FLECHA + '''</button></li></ul>
    <div class="PX-bloque" data-gp="pidiendo" hidden><label><span class="PX-et">Correo solo para este envío (la ficha no se toca):</span>
      <input type="email" class="PX-campo PX-gen-in" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nombre@correo.com"></label>
      <div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-can">Cancelar</button><button type="button" class="PX-p PX-prim PX-gen-env" disabled>Enviar por correo</button></div></div>
    <div class="PX-bloque" data-gp="confirmando" lang="es" hidden><p>Va a enviar el documento a esta dirección escrita a mano:</p><p class="PX-dir PX-gen-dir"></p>
      <p>Compruébala letra por letra. El archivo lleva datos clínicos dentro y un correo enviado no se puede recuperar.</p>
      <div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-corr">Corregir</button><button type="button" class="PX-p PX-prim PX-gen-si">Sí, enviar ahí</button></div></div>
    <div class="PX-bloque" data-gp="enviado" hidden aria-live="polite"><p>Enviado a <span class="PX-gen-a"></span> con el PDF adjunto. Si no aparece, pídele que revise su carpeta de spam o correo no deseado.</p>
      <div class="PX-gen-of"><p style="margin-top:10px">¿Guardas <span class="PX-gen-a"></span> en la ficha del paciente para la próxima vez?</p>
        <div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-no">No, gracias</button><button type="button" class="PX-p PX-prim PX-gen-guarda">Guardar en la ficha</button></div></div>
      <p class="PX-gen-g" style="margin-top:10px" hidden>Guardado en la ficha del paciente.</p></div>
  </div>
  <div class="PX-hj-p"><button type="button" class="PX-p PX-qui PX-gen-cerrar">Cerrar</button></div>
</div>
''' + propias + mas_pan(vp) + '\n</div>')

def marco(vp, clase, tipo, cuerpo, barra, capas, extra=''):
    col = ('<div class="PX-col"><main class="PX-cont"><div class="PX-form">\n' + cabecera(vp, tipo) + '\n' + cuerpo + '\n</div></main>\n' + barra + TOAST + '</div>')
    nav = {'ext': riel, 'tel': encabezado, 'ih': lambda: lateral('ih'), 'iv': encabezado_iv, 'esc': lambda: lateral('esc')}[vp]()
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    return '<div class="marco PX" lang="es" data-vp="%s" data-v="a">\n<div class="PX-app">\n%s\n</div>\n%s\n%s\n</div>\n' % (vp, app, extra, capas)

# =====================================================================================================================
# VISTA 8 · CONSENTIMIENTO INFORMADO (con su variante de denegación y el firmado electrónico)
# =====================================================================================================================
LABELS = [('preoperatorio', '1 · Evaluación y decisión terapéutica', 'Describe los estudios realizados, el diagnóstico y el procedimiento recomendado.'),
          ('beneficios', '2 · Beneficios esperados', 'Explica los objetivos y resultados esperados del procedimiento.'),
          ('anestesia', '3 · Anestesia', 'Indica el tipo de anestesia prevista y quién informará al paciente.'),
          ('descripcion', '4 · Descripción del procedimiento', 'Detalla la técnica quirúrgica, vía de abordaje e implantes a utilizar.'),
          ('riesgosComunes', '5 · Riesgos comunes', 'Riesgos inherentes a cualquier procedimiento quirúrgico.'),
          ('riesgosEspecificos', '6 · Riesgos específicos', 'Riesgos propios de esta cirugía en particular.'),
          ('alternativas', '7 · Alternativas de tratamiento', 'Opciones disponibles en lugar del procedimiento propuesto.')]

def cons_cuerpo(vp):
    ancho = vp in ('ih', 'iv', 'esc')
    secs = ''.join('<div class="PX-r PX-secw" data-sec="%s"><button type="button" class="PX-p PX-sec" aria-expanded="false"><span class="PX-flex">%s</span><span class="PX-sr"></span>%s</button>'
                   '<div class="PX-sec-c" role="region" aria-label="%s" lang="es" hidden><p class="PX-nota">%s</p><textarea class="PX-ta" data-s="%s" rows="4" aria-label="%s">%s</textarea></div></div>'
                   % (k, t, FLECHA, t, hint, k, t, esc(SEC[k])) for k, t, hint in LABELS)
    pie = ''
    if False:
        pie = ('<div class="PX-pie"><p class="PX-faltan" hidden aria-live="polite"></p><div class="PX-barra-f">'
               '<button type="button" class="PX-p PX-prim PX-b-firmar PX-otra-acc" data-solo="a">Iniciar firmado electrónico</button>'
               '<button type="button" class="PX-p PX-prim PX-b-imp" data-solo="b">Imprimir</button>'
               '<button type="button" class="PX-p PX-qui PX-b-sinfirma" data-solo="a">Imprimir sin firma</button></div></div>')
    return ('''<!-- 24 · Borrador retomado (?borrador=): una línea; nada se ha emitido todavía -->
<p class="PX-linea PX-borr-l" hidden><span class="PX-eq PX-eq-ag">''' + ic(I['reloj'], 14, 2) + '''Borrador</span><span class="PX-flex">Borrador guardado el 17 de noviembre de 2026, 18:42. Sigue editándolo o continúa con el firmado; nada se ha emitido todavía.</span></p>
<!-- 24 · Conmutador Consentimiento | Denegación: dos documentos excluyentes en un formulario. Conmutar no borra nada. -->
''' + seg('var', [('a', 'Consentimiento', True), ('b', 'Denegación', False)], 'Tipo de documento', 'PX-var') + '''
<section class="PX-g"><h2 class="PX-gt">Datos de identificación</h2>
<div class="PX-s">
''' + campo('fecha', 'Fecha', '19/11/2026', 'dd/mm/aaaa', req=True, extra='inputmode="numeric"') + '''<!-- en la app, selector de fecha nativo (mín. 1900, máx. hoy) -->
''' + campo('lugar', 'Lugar', '', 'Ej: Monterrey, N.L.', req=True) + '''
''' + campo('paciente', 'Paciente', 'Paciente Prueba 01', 'Nombre completo', 'De la ficha · editable', req=True) + '''
''' + campo('edad', 'Edad del paciente', '73 años', 'Ej: 45 años', 'De la ficha · editable', req=True) + '''
''' + campo('diagnostico', 'Diagnóstico', '', 'Diagnóstico principal', req=True) + '''<!-- con ?dx=, la ayuda «Del diagnóstico de la consulta» ocupa el sitio de «De la ficha · editable» -->
''' + campo('procedimiento', 'Procedimiento', '', 'Ej: Artrodesis cervical anterior', req=True) + '''
''' + campo('familiar', 'Familiar responsable o representante legal', '', 'Nombre completo', req=False, cls='PX-apret' if vp == 'ext' else '') + '''
<!-- La casilla va pegada al campo que vuelve obligatorio -->
<div class="PX-r"><button type="button" class="PX-p PX-ck PX-k-nofirma" aria-pressed="false"><span class="PX-ct">El paciente no puede firmar</span><span class="PX-box">''' + ic(I['ok'], 14, 3) + '''</span></button>
  <p class="PX-nota PX-nofirma-n" hidden></p></div>
''' + campo('testigo1', 'Testigo 1', '', 'Nombre del testigo', req=None) + '''
''' + campo('testigo2', 'Testigo 2', '', 'Nombre del testigo', req=None) + '''
</div></section>
<!-- Las dos autorizaciones: no son identificación, son decisiones del paciente. Por eso van en su propia superficie, sin título (hoy: bajo un divisor). -->
<section class="PX-g PX-pegado" data-solo="a"><div class="PX-s">
<div class="PX-r PX-ck" data-row="transfusion"><span class="PX-ct">Autoriza transfusión de sangre</span>''' + seg('transfusion', [('si', 'Sí', False), ('no', 'No', False)], 'Autoriza transfusión de sangre') + '''</div>
<div class="PX-r"><button type="button" class="PX-p PX-ck PX-k-fotos" aria-pressed="false"><span class="PX-ct"><small>Uso de fotografías</small>Autoriza su uso con fines educativos y de publicación académica</span><span class="PX-box">''' + ic(I['ok'], 14, 3) + '''</span></button></div>
</div></section>
<!-- Las siete secciones de texto: filas con flecha que se despliegan en el sitio; todas plegadas al abrir. A la derecha, «Obligatoria» o «Editada».
     El texto por defecto es el del código, copiado tal cual; no se redacta ni se modifica texto legal. -->
<section class="PX-g PX-pegado" data-solo="a"><div class="PX-s">''' + secs + '''</div></section>
<!-- Denegación: lo que no sale en ella se conserva escrito y se declara aquí (mensaje de hoy) -->
<p class="PX-linea PX-linea-pie PX-cons-l" data-solo="b" hidden><span class="PX-flex"></span></p>
''' + pie_lineas() + pie)

def cons_barra(vp):
    if vp in ('ih', 'iv', 'esc'):
        fila = ('<button type="button" class="PX-p PX-qui PX-b-sinfirma" data-solo="a">Imprimir sin firma</button>'
                '<button type="button" class="PX-p PX-prim PX-b-firmar PX-otra-acc" data-solo="a">Firmar</button><button type="button" class="PX-p PX-prim PX-b-imp" data-solo="b">Imprimir</button>')
    else:
        fila = ('<button type="button" class="PX-p PX-qui PX-b-sinfirma" data-solo="a">Sin firma</button>'
                '<button type="button" class="PX-p PX-prim PX-b-firmar PX-otra-acc" data-solo="a">Firmar</button><button type="button" class="PX-p PX-prim PX-b-imp" data-solo="b">Imprimir</button>')
    return ('<!-- Barra de acción: UN primario (rótulo de hoy: «Firmar» en estrecho, «Iniciar firmado electrónico» en ancho; con borrador, «Continuar») y «Sin firma» como texto.\n'
            '     «Guardar borrador» y «Guardar como plantilla» viven en «···». En denegación, el único botón de hoy: «Imprimir». -->\n'
            '<div class="PX-barra"><p class="PX-faltan" hidden aria-live="polite"></p><div class="PX-barra-f">' + fila + '</div></div>')

def cons_firma():
    return ('''<!-- 25 · FIRMADO ELECTRÓNICO. Pantalla completa en teléfono; modal centrado en ancho (Duo abierto horizontal y vertical, computadora), con el papel amplio.
     Un firmante a la vez: quién firma (nombre y rol), el papel y dos acciones. Firman el paciente y, si tienen nombre en el formulario, el familiar y los testigos.
     El papel es blanco también en oscuro. La firma se dibuja con el puntero dentro del marco (setPointerCapture; touch-action:none en línea, como en la app).
     Errores de trazo de hoy, como texto bajo el papel: «El lienzo está vacío: no hay ningún trazo que guardar.» y
     «La firma pesa demasiado para guardarse. Bórrala y hazla con menos trazos.» (estados de sistema, no dibujados). -->
<section class="PX-firma" role="dialog" aria-modal="true" aria-label="Firmado electrónico" aria-hidden="true"><div class="PX-fi" tabindex="-1">
  <header class="PX-fi-cab"><button type="button" class="PX-p PX-ib PX-xc PX-fi-x" aria-label="Salir del firmado">''' + ic(I['x'], 16, 2.4) + '''</button>
    <h2 class="PX-fi-t">Firmado electrónico</h2><span class="PX-fi-n PX-num"></span></header>
  <div class="PX-prog"><span>Firmantes</span><div class="PX-prog-t"></div></div>
  <div class="PX-fi-c">
    <div class="PX-paso">
      <p class="PX-fi-de">Firma de</p><p class="PX-fi-nom"></p><p class="PX-fi-rol"></p>
      <div class="PX-fi-firma">
        <p class="PX-girar PX-solo-tel">Gira el dispositivo para tener más espacio. Puedes firmar así igualmente.</p>
        <div class="PX-papel"><canvas class="PX-lienzo" style="touch-action:none" aria-label="Lienzo de firma"></canvas>
          <p class="PX-ph">Firma aquí con el dedo</p><span class="PX-base" aria-hidden="true"></span><span class="PX-rolp"></span></div>
        <p class="PX-fi-av" lang="es" hidden>Declaraste que el paciente no puede firmar. Firma en su lugar el familiar responsable, que es quien consiente. Si el paciente sí puede firmar, sal y desmarca la casilla en el formulario.</p>
        <div class="PX-fi-acc"><button type="button" class="PX-p PX-qui PX-ch PX-fi-borra" disabled>Borrar y repetir</button><span class="PX-flex PX-solo-esc"></span>
          <button type="button" class="PX-p PX-prim PX-fi-ok" disabled>Confirmar firma</button></div>
      </div>
      <!-- Identificación: tres respuestas como lista de filas («Sin foto» es una respuesta, no una cancelación) -->
      <div class="PX-fi-id" hidden><p class="PX-fi-q">Firma capturada. ¿Se anexa una foto de la identificación?</p>
        <ul class="PX-s"><li><button type="button" class="PX-p PX-mr PX-id-foto" data-o="cam">''' + fi('camara') + '''<span class="PX-flex">Tomar foto</span>''' + FLECHA + '''</button></li>
          <li><button type="button" class="PX-p PX-mr PX-id-foto" data-o="arch">''' + fi('carpeta') + '''<span class="PX-flex">Elegir archivo</span>''' + FLECHA + '''</button></li>
          <li><button type="button" class="PX-p PX-mr PX-id-sin">''' + fi('sinfoto') + '''<span class="PX-flex">Sin foto</span>''' + FLECHA + '''</button></li></ul></div>
      <!-- Recorte de la identificación: arrastrar mueve, pellizco o rueda acercan (en la app); «Girar» endereza en pasos de 90°.
           Avisos de hoy no dibujados: «No se pudo leer esa imagen. Elige otro archivo o sigue sin foto.» y el de resolución baja. -->
      <div class="PX-fi-rec" hidden><div class="PX-rec"><div class="PX-rec-img"><i></i><i></i><i></i><b>IDENTIFICACIÓN DE MUESTRA</b></div><span class="PX-rec-m" aria-hidden="true"></span></div>
        <p class="PX-fi-ay">Ajusta la identificación al rectángulo. Solo se guarda lo de dentro.</p>
        <div class="PX-fi-acc"><button type="button" class="PX-p PX-qui PX-rec-v">Volver</button><button type="button" class="PX-p PX-qui PX-rec-g">''' + ic(I['girar'], 16, 2) + '''Girar</button><span class="PX-flex PX-solo-esc"></span>
          <button type="button" class="PX-p PX-prim PX-rec-ok">Usar esta foto</button></div></div>
    </div>
    <!-- Revisión antes de sellar: una fila por firmante con su desenlace y «Rehacer» -->
    <div class="PX-resumen" hidden><p class="PX-fi-ay">Revisa antes de imprimir. Puedes rehacer cualquier firma.</p>
      <ul class="PX-s PX-res-l"></ul>
      <div class="PX-fi-acc"><span class="PX-flex PX-solo-esc"></span><button type="button" class="PX-p PX-prim PX-res-ok">Imprimir consentimiento</button></div></div>
  </div>
</div></section>''')

def cons_capas(vp):
    menu = (mr('borr', 'Guardar borrador', extra=' data-solo="a"', icono='reloj') + mr('gpl', 'Guardar como plantilla', icono='marca') + mr('gest', 'Gestionar plantillas', icono='ajustes'))
    propias = ('''<!-- 24 · Ya hay un borrador propio de este paciente: retomarlo (primario) o reemplazarlo (elimina el anterior) -->
''' + alerta('prev', 'Consentimiento a medias', 'ton', 'docs', 'Paciente Prueba 01 ya tiene un consentimiento a medias',
                 '<p>Solo puedes tener un borrador de consentimiento por paciente. Este es tuyo:</p><p class="PX-fuerte">Infiltración de rodilla</p><p class="PX-junto">Guardado el 17 de noviembre de 2026, 18:42 · sin firmar</p>'
                 '<p>Si lo reemplazas, se pierde lo que tenía escrito. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-prev-no">Reemplazarlo</button><button type="button" class="PX-p PX-prim PX-prev-si">Retomar el borrador</button>') + '''
<!-- 25 · El punto de no retorno -->
''' + alerta('sellar', '¿Sellar y firmar el consentimiento?', 'ton', 'sello', '¿Sellar y firmar el consentimiento?',
                 '<p>Al sellar, el documento queda firmado, se guarda en el expediente y se registra su huella. Después ya no se puede editar: ni el texto, ni las firmas, ni las fotos. Si algo está mal, corrígelo ahora.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Revisar otra vez</button><button type="button" class="PX-p PX-prim PX-sellar-ok">Sellar e imprimir</button>') + '''
''' + alerta('salir', '¿Salir del firmado?', 'ag', 'aviso', '¿Salir del firmado?',
                 '<p>Ya hay firmas capturadas y todavía no se han guardado. Si sales ahora se pierden y habrá que volver a pedirlas.</p>',
                 '<button type="button" class="PX-p PX-mal PX-salir-si">Salir y perder las firmas</button><button type="button" class="PX-p PX-prim PX-cierra">Seguir firmando</button>') + '''''')
    return capas_comunes(vp, 'consentimiento', 'consentimiento', 'el consentimiento', menu, propias)

# =====================================================================================================================
# VISTA 9 · HONORARIOS / COTIZACIÓN
# =====================================================================================================================
ASEG = ['MetLife', 'GNP Seguros', 'AXA Seguros', 'Quálitas', 'Seguros Monterrey New York Life', 'Banorte Seguros', 'Mapfre', 'Inbursa', 'Zurich', 'Seguros Atlas', 'Allianz',
        'ABA Seguros (Chubb)', 'Afirme', 'Bupa', 'Plan Seguro', 'La Latinoamericana', 'General de Salud', 'Multiva', 'HDI Seguros', 'Pan-American México']

def hon_cuerpo(vp):
    pie = ''
    if False:
        pie = ('<div class="PX-pie"><p class="PX-faltan" hidden aria-live="polite"></p><div class="PX-barra-f">'
               '<button type="button" class="PX-p PX-prim PX-b-imp">Imprimir</button><button type="button" class="PX-p PX-qui PX-b-gpl PX-otra-acc">Guardar como plantilla</button></div></div>')
    cab = ('<div class="PX-cl-cab PX-solo-anc" aria-hidden="true"><span>Concepto</span><span data-solo="b">Origen</span><span class="PX-cl-cp">Precio (<span class="PX-div">MXN</span>)</span><span></span></div>')
    return ('''<!-- 26 · Conmutador Recibo | Cotización: dos documentos en un formulario (folios NOH y COT). Conmutar no borra nada. -->
''' + seg('var', [('a', 'Recibo', True), ('b', 'Cotización', False)], 'Tipo de documento', 'PX-var') + '''
<section class="PX-g"><h2 class="PX-gt">Datos del documento</h2>
<div class="PX-s">
''' + campo('fecha', 'Fecha', '19/11/2026', 'dd/mm/aaaa', req=None, extra='inputmode="numeric"') + '''<!-- en la app, selector de fecha nativo -->
''' + campo('paciente', 'Paciente', 'Paciente Prueba 01', 'Nombre completo', 'De la ficha · editable', req=True) + '''
''' + campo('folio', 'Folio', 'Se asigna al emitir', '', 'Lo genera la base · prefijo <span data-solo="a">NOH</span><span data-solo="b">COT</span>', req=None, extra='readonly') + '''
<div data-solo="b">''' + lista('vigencia', 'Vigencia', [('15', '15 días'), ('30', '30 días'), ('60', '60 días'), ('90', '90 días')], '30', nota='<p class="PX-nota PX-vig-n"></p>') + '''</div>
</div></section>
<!-- Solo en cotización. El interruptor de hoy; al encenderlo se despliegan sus tres campos en el sitio. -->
<section class="PX-g PX-pegado" data-solo="b"><div class="PX-s">
<div class="PX-r"><button type="button" class="PX-p PX-ck PX-k-seguro" role="switch" aria-checked="false" aria-label="Cotización con seguro de gastos médicos"><span class="PX-ct">Seguro de gastos médicos</span><span class="PX-sw"><i></i></span></button></div>
<div class="PX-seguro" hidden>
''' + lista('aseguradora', 'Aseguradora', [('', '— Elegir —')] + ASEG + [('__otra__', 'Otra')]) + '''
<div class="PX-otra" hidden>''' + campo('aseg_otra', 'Nombre de la aseguradora', '', 'Nombre de la aseguradora', req=None) + '''</div>
''' + campo('poliza', 'Número de póliza', '', 'Ej: POL-123456', req=None) + '''
''' + campo('cobertura', 'Cobertura', '', 'Ej: 80%', req=None) + '''
</div></div></section>
<!-- Conceptos: lista repetible dentro de la superficie. Importes alineados a la derecha en números tabulares. «Agregar» es la última fila;
     quitar es un icono tenue por fila (deshabilitado si solo queda una, como hoy). En cotización cada línea lleva su Origen (combo escribible). -->
<section class="PX-g"><h2 class="PX-gt" data-row="conceptos"><span class="PX-gtn">Conceptos<span class="PX-req"> *</span></span></h2>
<div class="PX-s">''' + cab + '''<div class="PX-lineas"></div>
<button type="button" class="PX-p PX-add">''' + ic(I['plus'], 18, 2.2) + '''Agregar</button></div></section>
<!-- Cierre: filas sobrias. Recibo: Total, Anticipo recibido (campo) y Saldo pendiente. Cotización: un subtotal por origen y Total cotizado. -->
<section class="PX-g PX-pegado"><div class="PX-s">
<div class="PX-subs" data-solo="b"></div>
<div class="PX-r PX-tot PX-final" data-solo="b"><span class="PX-flex">Total cotizado</span><b class="PX-t-total"></b></div>
<div class="PX-r PX-tot" data-solo="a"><span class="PX-flex">Total</span><b class="PX-t-total"></b></div>
<label class="PX-r PX-tot" data-solo="a"><span class="PX-flex">Anticipo recibido</span><span class="PX-sim">$</span><input type="text" class="PX-imp PX-ant" inputmode="decimal" autocomplete="off" placeholder="0.00"></label>
<div class="PX-r PX-tot PX-final" data-solo="a"><span class="PX-flex">Saldo pendiente</span><b class="PX-t-saldo"></b></div>
<p class="PX-aviso PX-ant-av" data-solo="a" hidden aria-live="polite">El anticipo supera el total. Revísalo antes de emitir.</p>
</div></section>
<section class="PX-g"><h2 class="PX-gt"><span data-solo="a">Pago</span><span data-solo="b">Condiciones</span></h2>
<div class="PX-s">
<div data-solo="a">''' + lista('formapago', 'Forma de pago', ['Efectivo', 'Transferencia bancaria', 'Tarjeta de crédito', 'Tarjeta de débito', 'Cheque'], 'Efectivo') + '''</div>
<div class="PX-r PX-ck"><span class="PX-ct">Divisa</span>''' + seg('divisa', [('MXN', 'MXN', True), ('USD', 'USD', False)], 'Divisa') + '''</div>
''' + area('notas', 'Notas y consideraciones', 'Observaciones adicionales, indicaciones especiales…') + '''
</div></section>
<!-- Cotización: forma de pago y anticipo escritos se conservan y se declaran aquí (mensajes de hoy) -->
<p class="PX-linea PX-linea-pie PX-cons-l" data-solo="b" hidden><span class="PX-flex"></span></p>
''' + pie_lineas() + pie)

def hon_barra(vp):
    if vp in ('ih', 'iv', 'esc'):
        fila = '<button type="button" class="PX-p PX-qui PX-b-gpl PX-otra-acc">Guardar como plantilla</button><button type="button" class="PX-p PX-prim PX-b-imp">Imprimir</button>'
    else:
        fila = '<button type="button" class="PX-p PX-qui PX-b-gpl PX-otra-acc">Plantilla</button><button type="button" class="PX-p PX-prim PX-b-imp">Imprimir</button>'
    return ('<!-- Barra de acción: UN primario («Imprimir», el rótulo de hoy en los ocho formatos) y «Guardar como plantilla» como texto -->\n'
            '<div class="PX-barra"><p class="PX-faltan" hidden aria-live="polite"></p><div class="PX-barra-f">' + fila + '</div></div>')

def hon_capas(vp):
    return capas_comunes(vp, 'honorarios', 'honorarios', 'la nota de honorarios', mr('gpl', 'Guardar como plantilla', icono='marca') + mr('gest', 'Gestionar plantillas', icono='ajustes'), '')

# ---------- Ensamblado ----------
def lee(n):
    return open(os.path.join(L, n)).read()

def con_iv(css):
    """Cada lista de selectores que nombra al Duo abierto horizontal gana su gemelo vertical: iv parte de la composición de ih (CALMA §19).
    Lo que en iv es distinto (navegación, toque de 44, anchos de capa) lo corrige tmp-dcc3-estilo.css, que va al final."""
    import re
    def f(m):
        pre = m.group(1); k = pre.rfind('*/') + 2 if '*/' in pre else 0
        cab, sel = pre[:k], pre[k:]
        if '[data-vp="ih"]' not in sel or sel.strip().startswith('@'):
            return m.group(0)
        partes = [s for s in sel.split(',')]
        extra = [s.replace('[data-vp="ih"]', '[data-vp="iv"]') for s in partes if '[data-vp="ih"]' in s]
        return cab + ','.join(partes + [e.strip() for e in extra]) + '{'
    return re.sub(r'([^{}]+)\{', f, css)

def vista(px, dtok, nombre, frase, notas, css_extra, js_extra, hacer):
    css = con_iv(lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')) + lee('tmp-dcc3-estilo.css') + lee('tmp-dcc5-estilo.css')
    js = '(function(){\n' + lee('tmp-dcc-chasis.js') + lee(js_extra) + '})();\n'
    cuerpo = ''.join(hacer(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc'))
    out = ('<!-- NOMBRE: ' + nombre + ' | ' + frase + ' -->\n' + notas + '<style>\n' + css + '</style>\n' + cuerpo + '<script>\n' + js + '</script>\n')
    out = out.replace('DTOK', dtok).replace('PX', px)
    out = out.replace('__FLECHA__', json.dumps(FLECHA.replace('PX', px))).replace('__OKM__', json.dumps(OKM.replace('PX', px))).replace('__SEC__', json.dumps(SEC, ensure_ascii=False)).replace('__ICQ__', json.dumps({'ob': ic(I['aviso'], 14, 2), 'ed': ic(I['lapiz'], 14, 2)})).replace('__X__', json.dumps(ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>', 20, 1.8)))
    return out

NOTAS = ('<!-- Estados de sistema no dibujados (comunes al taller): cargador y error del formulario dinámico («No se pudo cargar el formulario») [A16];\n'
         '     plan bloqueado -> /billing [A17]; el primario pasa por «Cargando tu perfil…» y «Generando PDF…» [A12] (este último sí se ve al imprimir);\n'
         '     si el guardado falla, el mensaje de error de hoy va como línea en --mal-tinta sobre la barra de acción. -->\n')

v8 = vista('dc8', '--d-consentimiento', 'Consentimiento informado',
           'El mismo formulario, en calma: los datos como una lista de filas, las siete secciones plegadas en una sola superficie, un único botón («Firmar») y lo ocasional en «···»; el firmado es una hoja de papel limpia, un firmante a la vez',
           NOTAS, 'tmp-dcc-estilo-cons.css', 'tmp-dcc-cons.js',
           lambda v: marco(v, 'dc8', 'consentimiento', cons_cuerpo(v), cons_barra(v), cons_capas(v), cons_firma()))
open(os.path.join(L, 'vista-8-consentimiento.html'), 'w').write(v8)
v9 = vista('dc9', '--d-honorarios', 'Honorarios / Cotización',
           'Recibo y cotización como una lista sobria: conceptos en filas con el importe alineado a la derecha, el cierre (total, anticipo, saldo o subtotales) en filas simples y un único botón («Imprimir»)',
           NOTAS, 'tmp-dcc-estilo-hon.css', 'tmp-dcc-hon.js',
           lambda v: marco(v, 'dc9', 'honorarios', hon_cuerpo(v), hon_barra(v), hon_capas(v)))
open(os.path.join(L, 'vista-9-honorarios.html'), 'w').write(v9)
print(len(v8), len(v9))
