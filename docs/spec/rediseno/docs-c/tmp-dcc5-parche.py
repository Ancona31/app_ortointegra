# PASADA FINAL (kit/PASADA-FINAL.md): navegación al día (CALMA §28), capas de Duo cerrado como tarjeta centrada (§26),
# textos sin marcadores de maqueta dentro del marco, cambio de tipo que lleva a la otra vista de la página. Uso único.
# Copias previas: *.v5.bak. Después: sh tmp-dcc-run.sh
import os, re
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b):
    p = os.path.join(L, f); t = open(p).read(); assert a in t, 'NO ENCONTRADO %s: %s' % (f, a[:90]); open(p, 'w').write(t.replace(a, b, 1))
G = 'tmp-dcc-gen.py'

# ---------- 1 · Navegación copiada del dashboard final (aviso de datos pendientes, logo de la clínica, «Más», pie con Ayuda) ----------
sub(G, "# ---------- Navegación: copiada del dashboard aprobado (activo = Documentos) ----------",
    """# ---------- Navegación: copiada del dashboard final (CALMA §28; activo = Documentos) ----------
import importlib.util as _iu
_sp = _iu.spec_from_file_location('cromo', os.path.join(L, 'tmp-dcc5-cromo.py')); CR = _iu.module_from_spec(_sp); _sp.loader.exec_module(CR)
def _px(h):
    \"\"\"Piezas del cromo con nuestro prefijo y solo la parte del médico (lo de secretaria, «db-s», fuera).\"\"\"
    h = re.sub(r'\\s*<!-- Secretaria.*?-->\\s*<div class="db-s">.*?</div>', '', h, flags=re.S)
    h = re.sub(r'<button type="button" class="db-p db-li db-yo db-s.*?</button>', '', h, flags=re.S)
    return h.replace(' db-m"', '"').replace(' db-m ', ' ').replace('db-', 'PX-')
BDG = '<span class="PX-bdg" aria-hidden="true">3</span>'
def ap(vp, donde):
    h = _px(CR.AP.replace('VP-DONDE', 'PX-' + vp + '-' + donde))
    if vp == 'ih' and donde == 'lat':   # Duo abierto horizontal: plegado de inicio, como en el dashboard
        h = h.replace('class="PX-ap"', 'class="PX-ap PX-pleg"').replace('aria-expanded="true"', 'aria-expanded="false"')
    return h
def mas_pan(vp):
    \"\"\"Menú «Más» (CALMA §28) del riel de Duo cerrado y de la píldora «Más» de Duo abierto vertical: tarjeta centrada con velo.\"\"\"
    if vp not in ('ext', 'iv'):
        return ''
    return ('<div tabindex="-1" class="PX-pan PX-hoja PX-mn" data-pan="mas" role="dialog" aria-modal="true" aria-label="Más">'
            '<div class="PX-hj-cab"><h2>Más</h2>' + X % 'Cerrar' + '</div><div class="PX-hj-c">' + ap(vp, 'mas') + _px(CR.MAS) + '</div></div>')""")
sub(G, """def riel():
    def b(k, t, act=False):
        return '<a href="#" class="PX-p PX-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="PX-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente') + b('agenda', 'Agenda') + b('docs', 'Documentos', True)
            + '<a href="#" class="PX-p PX-rb" aria-label="Más">' + ic(I['mas'], 22, 3) + '</a><span class="PX-flex"></span>'""",
    """def riel():
    def b(k, t, act=False):
        return '<a href="#" class="PX-p PX-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="PX-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente') + b('agenda', 'Agenda') + b('docs', 'Documentos', True)
            + '<button type="button" class="PX-p PX-rb" aria-label="Más" aria-haspopup="dialog" data-abre-mas>' + ic(I['mas'], 22, 3) + BDG + '</button><span class="PX-flex"></span>'""")
sub(G, """'<button type="button" class="PX-p PX-cons-b"><span class="PX-av">AS</span><span class="PX-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'""",
    """'<button type="button" class="PX-p PX-cons-b">' + _px(CR.CLOGO) + '<span class="PX-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'""")
sub(G, """'<div class="PX-lat-pie"><a href="#" class="PX-p PX-li PX-yo">' + ic(I['perfil'], 20) + '<span>Dr. Admin Semilla<small>Mi perfil · Ajustes</small></span></a></div></nav>')""",
    """+ ap(vp, 'lat') + _px(CR.PIE) + '</nav>')""")
sub(G, "def lateral():", "def lateral(vp):")
sub(G, "aria-label=\"Menú\">' + ic(I['menu'], 22, 2) + '</button>", "aria-label=\"Menú\">' + ic(I['menu'], 22, 2) + BDG + '</button>")
sub(G, "aria-label=\"Mostrar barra lateral\">' + ic(I['barra'], 20) + '</button>'", "aria-label=\"Mostrar barra lateral\">' + ic(I['barra'], 20) + BDG + '</button>'")
sub(G, "p('Documentos', True) + p('Más') + '</nav>'", "p('Documentos', True) + '<button type=\"button\" class=\"PX-p PX-pi\" aria-haspopup=\"dialog\" data-abre-mas>Más</button></nav>'")
sub(G, "nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'iv': encabezado_iv, 'esc': lateral}[vp]()",
    "nav = {'ext': riel, 'tel': encabezado, 'ih': lambda: lateral('ih'), 'iv': encabezado_iv, 'esc': lambda: lateral('esc')}[vp]()")
sub(G, "''' + propias + '\\n</div>')", "''' + propias + mas_pan(vp) + '\\n</div>')")
sub(G, "# Generador de las dos vistas", "import re\n# Generador de las dos vistas")
sub(G, "css = con_iv(lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')) + lee('tmp-dcc3-estilo.css')",
    "css = con_iv(lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')) + lee('tmp-dcc3-estilo.css') + lee('tmp-dcc5-estilo.css')")
# comentario del documento generado: Visualizar y Descargar no tienen parte visual en la maqueta
sub(G, "<!-- A13-A15 · Documento generado (el «modal posterior» de hoy), como lista de filas pulsables: Visualizar, Enviar por correo",
    "<!-- A13-A15 · Documento generado (el «modal posterior» de hoy), como lista de filas pulsables. «Visualizar» abre el PDF en otra pestaña y\n     «Descargar» lo baja con el nombre de archivo (anclas, sin parte visual en la maqueta). Enviar por correo")

# ---------- 2 · Guiones: nada de «Maqueta:» dentro del marco; «Más» y el aviso; cambio de tipo que lleva a la otra vista ----------
C = 'tmp-dcc-chasis.js'
sub(C, """      entrante=b.dataset.n;if(cfg.vacio()){A.cierraTodo();A.toast('Maqueta: aquí se abre el formulario de '+entrante)}""",
    """      entrante=b.dataset.n;if(cfg.vacio()){A.cierraTodo();irTipo(entrante)}""")
sub(C, """    on('.PX-camb-ok','click',function(){A.cierraTodo();cfg.vaciar();A.toast('Maqueta: aquí se abre el formulario de '+entrante)});""",
    """    on('.PX-camb-ok','click',function(){A.cierraTodo();cfg.vaciar();irTipo(entrante)});
    /* Elegir otro tipo abre su formulario. Consentimiento y Honorarios viven en esta página: se lleva a esa vista y se realza.
       Los otros seis tipos están en las páginas «Documentos 1» y «Documentos 2» (no se enlaza entre páginas). */
    function irTipo(n){var k={'Consentimiento':'8-','Honorarios / Cotización':'9-'}[n],op=k&&document.querySelector('.op[data-op^="'+k+'"]');if(!op)return;
      var e=op.querySelector('.esc')||op;e.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'});e.classList.add('PX-realce');setTimeout(function(){e.classList.remove('PX-realce')},1600)}
    /* Menú «Más» (riel de Duo cerrado, píldora de Duo abierto vertical) y aviso «N datos pendientes» plegable */
    on('[data-abre-mas]','click',function(e){A.abre('mas',e.currentTarget)});
    on('.PX-ap-cab','click',function(e){var a=e.currentTarget.closest('.PX-ap'),pl=a.classList.toggle('PX-pleg');e.currentTarget.setAttribute('aria-expanded',String(!pl))});""")
sub(C, "    on('.PX-gen-ver','click',function(){A.toast('Maqueta: aquí se abre el PDF en otra pestaña')});\n", "")
sub(C, "    on('.PX-gen-comp','click',function(){A.toast('Maqueta: aquí se descarga el PDF')});\n", "")
# datos de ejemplo del formulario lleno: texto del médico ficticio, sin corchetes de maqueta
sub('tmp-dcc-cons.js', "var MARCA={descripcion:'[Descripción del procedimiento, redactada por el médico]',riesgosEspecificos:'[Riesgos específicos del procedimiento, redactados por el médico]'};",
    "var MARCA={descripcion:'Infiltración intraarticular de rodilla derecha con técnica estéril, por vía anterolateral.',riesgosEspecificos:'Dolor transitorio en el sitio de punción, derrame articular reactivo y, de forma excepcional, artritis séptica.'};")
print('ok')
