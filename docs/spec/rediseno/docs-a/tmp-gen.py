# Generador de las cuatro vistas del taller de documentos (parte 1). Uso: python3 tmp-gen.py
# Un solo chasis (tmp-estilo.css + tmp-guion.js con el marcador ZQ) que se instancia con el prefijo de cada vista.
import os
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8, cls=''):
    return '<svg aria-hidden="true"%s width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (' class="%s"' % cls if cls else '', s, s, w, d)

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
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lupa='<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    capas='<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    marcador='<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/><path d="M12 7.5v5M9.5 10h5"/>',
    ajustes='<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    borrador='<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',
    ojo='<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    sobre='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
    compartir='<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    descargar='<path d="M12 3v12M8 11l4 4 4-4M5 20h14"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    cambio='<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
    bote='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    panel='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
)
FLECHA = ic(I['sig'], 14, 2.4)

# ---------- Cromo global (CALMA §28): piezas copiadas de entrega/dashboard-final/tmp-cromo.py (que las copió de entrega/cromo/vista-1) ----------
# Prefijo db- -> ZQ-; se quitan las variantes de la secretaria (ella no tiene «Documentos») y la marca db-m (solo médico).
import re as _re, importlib.util as _iu
_sp = _iu.spec_from_file_location('cromo', os.path.join(L, '..', 'dashboard-final', 'tmp-cromo.py')); CR = _iu.module_from_spec(_sp); _sp.loader.exec_module(CR)
def _cr(h):
    h = _re.sub(r'\s*<!-- Secretaria.*?</div>(?=\s*$)', '', h, flags=_re.S)
    h = _re.sub(r'<button type="button" class="db-p db-li db-yo db-s.*?</button>', '', h, flags=_re.S)
    return h.replace(' db-m"', '"').replace('db-', 'ZQ-')
AP0, MAS0, CLOGO, PIE = _cr(CR.AP), _cr(CR.MAS), _cr(CR.CLOGO), _cr(CR.PIE)
BDG = '<span class="ZQ-bdg" aria-hidden="true">3</span>'
def ap(vp, donde):
    # Aviso «N datos pendientes» (A0·11, solo médico). En ih va plegado de inicio para que el pie no baje a la franja.
    h = AP0.replace('VP-DONDE', vp + '-' + donde)
    if vp == 'ih' and donde == 'lat':
        h = h.replace('class="ZQ-ap"', 'class="ZQ-ap ZQ-pleg"').replace('aria-expanded="true"', 'aria-expanded="false"')
    return h
X = ic(I['x'], 20, 2)

# Los ocho tipos: mismo icono y mismo tono en toda la app (CALMA §9; iconos copiados de doc-color/color-documentos.html)
TIPOS = [
    ('receta', 'Receta', 'receta', 'la receta', '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>'),
    ('lab', 'Laboratorio', 'laboratorio', 'la solicitud de laboratorio', '<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>'),
    ('imagen', 'Imagenología', 'imagen', 'la solicitud de imagenología', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
    ('suplementacion', 'Suplementación', 'suplementacion', 'el plan de suplementación', '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>'),
    ('internamiento', 'Internamiento', 'internamiento', 'la solicitud de internamiento', '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>'),
    ('escrito', 'Escrito médico', 'escrito', 'el escrito médico', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    ('consentimiento', 'Consentimiento', 'consentimiento', 'el consentimiento', '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
    ('honorarios', 'Honorarios / Cotización', 'honorarios', 'la nota de honorarios', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>'),
]
TD = {t[0]: t for t in TIPOS}

def tic(k):
    t = TD[k]
    return '<span class="ZQ-tic" style="--dc:var(--d-%s)">%s</span>' % (t[2], ic(t[4], 20))

# ---------- Navegación: copiada del dashboard aprobado (activo = Documentos) ----------
def riel():
    def b(k, t, act=False):
        return '<a href="#" class="ZQ-p ZQ-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="ZQ-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente') + b('agenda', 'Agenda') + b('docs', 'Documentos', True)
            + '<button type="button" class="ZQ-p ZQ-rb" aria-label="Más" data-abre-mas>' + ic(I['mas'], 22, 3) + BDG + '</button><span class="ZQ-flex"></span>'
            '<button type="button" class="ZQ-p ZQ-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lateral(vp):
    def a(k, t, act=False):
        return '<a href="#" class="ZQ-p ZQ-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    return ('<nav class="ZQ-lat" aria-label="Navegación principal"><div class="ZQ-lat-cab"><span class="ZQ-logo">' + ic(I['logo'], 24) + '<span class="ZQ-logo-n">Spinus</span></span><span class="ZQ-plan">Plan VIP</span></div>'
            '<button type="button" class="ZQ-p ZQ-cons-b">' + CLOGO + '<span class="ZQ-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="ZQ-lista">' + a('inicio', 'Inicio') + a('pac', 'Expediente') + a('agenda', 'Agenda') + a('docs', 'Documentos', True) + a('admin', 'Administración') + '</div><span class="ZQ-flex"></span>'
            '<!-- Aviso «N datos pendientes» y pie de hoy (médico: «Mi perfil · Ajustes» + Ayuda), CALMA §28 -->' + ap(vp, 'lat') + PIE + '</nav>')

def encabezado():
    return ('<header class="ZQ-enc"><button type="button" class="ZQ-p ZQ-menu-b" aria-label="Menú">' + ic(I['menu'], 22, 2) + BDG + '</button><span class="ZQ-enc-t">Documentos</span><span class="ZQ-flex"></span>'
            '<button type="button" class="ZQ-p ZQ-av ZQ-av-g" aria-label="Mi perfil">AS</button></header>')

def encabezado_iv():
    def s(t, act=False):
        return '<a href="#" class="ZQ-p ZQ-env-s"%s>%s</a>' % (' aria-current="page"' if act else '', t)
    return ('<!-- iv · Encabezado fundido (CALMA §19). «Mostrar barra lateral» abre el menú completo (Administración, Mi perfil, Ayuda); «Más» abre el mismo menú que el «···» del riel de ext (CALMA §23.9); el avatar lleva a Mi perfil. -->'
            '<header class="ZQ-env"><button type="button" class="ZQ-p ZQ-env-lat" aria-label="Mostrar barra lateral">' + ic(I['panel'], 20, 1.8) + BDG + '</button>'
            '<nav class="ZQ-env-pis" aria-label="Secciones">' + s('Inicio') + s('Expediente') + s('Agenda') + s('Documentos', True) + '<button type="button" class="ZQ-p ZQ-env-s" data-abre-mas>Más</button></nav>'
            '<button type="button" class="ZQ-p ZQ-av ZQ-av-g" aria-label="Mi perfil">AS</button></header>')

# ---------- Piezas del chasis ----------
def campo(et, cls, ph='', val='', req=False, pista=''):
    r = '<i aria-hidden="true"> *</i><span class="ZQ-sr">obligatorio</span>' if req else ''
    p = '<span class="ZQ-pista">%s</span>' % pista if pista else ''
    return ('<label class="ZQ-r ZQ-f%s"><span class="ZQ-et">%s%s</span>%s<input type="text" class="ZQ-in ZQ-i-%s" autocomplete="off" placeholder="%s" value="%s"></label>'
            % (' ZQ-conp' if pista else '', et, r, p, cls, ph, val))

def cabecera(k):
    t = TD[k]
    return ('''<!-- CHASIS · Cabecera (≤ 110 px en teléfono): «‹ Documentos» + «Cambiar» (tonal pequeño, alto 32; en ext, botón de texto para que la primera pantalla quede con dos botones con fondo) + «···»; icono del tipo en nivel 4 pequeño + título 26/800, solo; una línea con el paciente.
     A7-1 volver · A7-3 «Cambiar» abre la rejilla de tipos · A14-5 el paciente elegido se cambia volviendo a «‹ Documentos» (allí está su fila con la «×»).
     Desde el expediente el enlace dice «‹ Paciente Prueba 01»; el formulario es el mismo. -->
<header class="ZQ-top">
  <div class="ZQ-top-f"><a href="#" class="ZQ-p ZQ-volver">''' + ic(I['volver'], 14, 2.6) + '''Documentos</a><span class="ZQ-flex"></span>
    <button type="button" class="ZQ-p ZQ-cambiar ZQ-b-tipo" aria-haspopup="dialog">Cambiar</button>
    <button type="button" class="ZQ-p ZQ-ib ZQ-b-menu" aria-label="Más opciones" aria-haspopup="menu">''' + ic(I['mas'], 22, 3) + '''</button></div>
  <div class="ZQ-tit">''' + tic(k) + '<h1>' + t[1] + '''</h1></div>
  <p class="ZQ-sub"><span>Paciente Prueba 01 · <span class="ZQ-num">73 años</span></span><span class="ZQ-etq ZQ-e-mal ZQ-urg" hidden>''' + ic(I['aviso'], 14, 2) + '''Urgente</span>''' + (('''
    <!-- CALMA §23.4 · Alergias del paciente: etiqueta roja en la MISMA línea que el nombre y la edad. En ext no cabe entera: icono + «Penicilina» (el aria-label lleva el texto completo).
         Sin alergias registradas no se dibuja nada (tira: «Sin alergias»). -->
    <span class="ZQ-etq ZQ-e-mal ZQ-alg" role="note" aria-label="Alergias: Penicilina">''' + ic(I['aviso'], 14, 2) + '''<span aria-hidden="true"><span class="ZQ-alg-r">Alergias: </span>Penicilina</span></span>''') if k == 'receta' else '') + '''</p>
</header>''')

def plantilla_fila():
    return ('''<!-- A7-6 · Plantillas: UNA fila discreta al inicio. Abre la hoja con «Vaciar formulario», «— Sin plantilla —» y las guardadas; al aplicar, una línea con «Deshacer».
     A7-10 · Mientras cargan, la fila muestra un trazo gris en el lugar del valor (esqueleto); si falla: «No se pudieron cargar tus plantillas.» + «Reintentar» dentro de la hoja. -->
<section class="ZQ-g ZQ-g-pl"><div class="ZQ-s"><button type="button" class="ZQ-p ZQ-nav ZQ-b-pl" aria-haspopup="dialog">''' + ic(I['capas'], 18, 1.8, 'ZQ-nav-i') + '''<span class="ZQ-nav-e">Plantilla</span><span class="ZQ-nav-v"></span>''' + FLECHA + '''</button></div>
  <p class="ZQ-linea ZQ-pl-aviso" aria-live="polite" hidden><span class="ZQ-flex"></span><button type="button" class="ZQ-p ZQ-txt ZQ-b-deshacer">Deshacer</button></p></section>''')

def datos(ph_dx, extra=''):
    return ('''<!-- Datos del paciente: llegan de la ficha y son editables. La fecha es un selector nativo de fecha (mín. 1900, máx. hoy + 1 año).
     Con ?dx= (desde la consulta) el diagnóstico llega lleno y su fila dice «Del diagnóstico de la consulta». -->
<section class="ZQ-g"><h2 class="ZQ-g-t">Datos del paciente</h2><div class="ZQ-s">
  ''' + campo('Fecha', 'fecha', '', '19/11/2026') + '''
  ''' + campo('Paciente', 'paciente', 'Nombre completo', 'Paciente Prueba 01', True, 'De la ficha · editable') + '''
  ''' + campo('Diagnóstico', 'dx', ph_dx) + extra + '''
</div></section>''')

def barra():
    return ('''<!-- CHASIS · Barra de acción: UN primario («Imprimir», rótulo de hoy) a la DERECHA y a su izquierda «Guardar como plantilla» como botón quieto (--sup2; en teléfono, «Plantilla», su rótulo corto de hoy).
     CALMA §23.1: en ih y esc el par va pegado a la derecha de la columna; en iv, centrado en la columna (≥ 96 px de los bordes del marco).
     A7-12 estados «Generando PDF…» y «Cargando tu perfil…» · A7-11 aviso de perfil incompleto · validación y error de guardado como una línea de texto sobre la barra. -->
<div class="ZQ-barra"><div class="ZQ-ancho">
  <p class="ZQ-aviso ZQ-av-perfil" hidden>Completa tu perfil para que el documento salga con tu encabezado. <button type="button" class="ZQ-enl">Ir a mi perfil</button></p>
  <p class="ZQ-aviso ZQ-mal ZQ-av-error" role="alert" hidden></p>
  <p class="ZQ-aviso ZQ-mal ZQ-av-falta" aria-live="polite" hidden></p>
  <div class="ZQ-barra-f"><button type="button" class="ZQ-p ZQ-quieto ZQ-b-gpl"><span class="ZQ-solo-tel">Plantilla</span><span class="ZQ-solo-anc">Guardar como plantilla</span></button>
    <button type="button" class="ZQ-p ZQ-prim ZQ-b-imp">Imprimir</button></div>
</div></div>''')

def hoja(nombre, titulo, cuerpo, pie='', cls='', cab_extra='', rol='dialog'):
    return ('<section class="ZQ-pan ZQ-hoja %s" data-capa="%s" role="%s" aria-modal="true" aria-label="%s" tabindex="-1"><span class="ZQ-asa"></span>'
            '<div class="ZQ-hj-cab"><h2>%s</h2>%s<button type="button" class="ZQ-p ZQ-ib ZQ-x" aria-label="Cerrar">%s</button></div>'
            '<div class="ZQ-hj-c">%s</div>%s</section>') % (cls, nombre, rol, titulo, titulo, cab_extra, X, cuerpo, ('<div class="ZQ-hj-p">%s</div>' % pie) if pie else '')

def capa_mas(vp):
    # Menú «Más» (CALMA §28): aviso, Consultorio activo, Administración, Mi perfil, Ayuda. Copiado del dashboard final.
    if vp not in ('ext', 'iv'):
        return ''
    return hoja('mas', 'Más', ap(vp, 'mas') + MAS0, cls='ZQ-masm')

def alerta(nombre, cuerpo):
    return '<section class="ZQ-pan ZQ-alerta" data-capa="%s" role="alertdialog" aria-modal="true" tabindex="-1">%s</section>' % (nombre, cuerpo)

def rejilla(sel=None):
    return ('<div class="ZQ-rej" role="tablist" aria-label="Tipo de documento">' + ''.join(
        '<button type="button" class="ZQ-p ZQ-z" role="tab" data-t="%s" aria-selected="%s"%s>%s<span>%s</span></button>'
        % (t[0], 'true' if t[0] == sel else 'false', '' if (t[0] == sel or (sel is None and n == 0)) else ' tabindex="-1"', tic(t[0]), t[1]) for n, t in enumerate(TIPOS)) + '</div>')

def capas_form(k, vp):
    t = TD[k]
    tel = vp in ('ext', 'tel')
    titulo_gen = {'receta': 'Receta generada', 'lab': 'Solicitud de laboratorio generada', 'imagen': 'Solicitud de imagenología generada'}[k]
    etq = {'receta': 'receta', 'lab': 'laboratorio', 'imagen': 'imagen'}[k]
    menu = hoja('menu', 'Más opciones', '''<!-- «···»: las acciones ocasionales del formulario, con sus rótulos de hoy -->
<button type="button" class="ZQ-p ZQ-mr ZQ-m-gpl" role="menuitem">''' + ic(I['marcador'], 20, 1.8, 'ZQ-mi') + '''<span class="ZQ-mr-t">Guardar como plantilla</span></button>
<button type="button" class="ZQ-p ZQ-mr ZQ-m-ges" role="menuitem">''' + ic(I['ajustes'], 20, 1.8, 'ZQ-mi') + '''<span class="ZQ-mr-t">Gestionar plantillas</span></button>
<button type="button" class="ZQ-p ZQ-mr ZQ-m-vac" role="menuitem">''' + ic(I['borrador'], 20, 1.8, 'ZQ-mi') + '''<span class="ZQ-mr-t">Vaciar formulario</span></button>''', cls='ZQ-menu', rol='menu')
    tipo = hoja('tipo', 'Tipo de documento', '''<!-- A7-2/3 · La rejilla de nivel 4 de los ocho tipos. Es un tablist: flechas, Inicio, Fin y Esc. El tipo actual va marcado. -->
''' + rejilla(k), cls='ZQ-ancha ZQ-rejilla')
    conf_tipo = alerta('conf-tipo', '''<!-- A7-4 · Confirmación previa si el formulario ya tiene datos -->
<span class="ZQ-al-i ZQ-e-mal">''' + ic(I['cambio'], 28, 1.8) + '''</span>
<h2 class="ZQ-ct-t">¿Cambiar a Laboratorio?</h2><p lang="es">Se descarta ''' + t[3] + ''' que estás llenando. No se puede deshacer.</p>
<!-- CALMA §20: el botón dice «Cambiar» (el título lleva el nombre completo del tipo) y queda parejo con «Cancelar» -->
<div class="ZQ-al-p"><button type="button" class="ZQ-p ZQ-quieto ZQ-cancelar">Cancelar</button><button type="button" class="ZQ-p ZQ-mal-b ZQ-ct-ok">Cambiar</button></div>''')
    plant = hoja('plantillas', 'Plantilla', '<div class="ZQ-pl-ops"></div>', cls='')
    guardar = hoja('guardar', 'Guardar como plantilla', '''<!-- A7-7 · Diálogo de nombre: Enter confirma; avisa de nombre duplicado; contador desde 30 de 40 caracteres -->
<p class="ZQ-hj-sub">Se guarda todo menos los datos del paciente.</p>
<label class="ZQ-campo"><span>Nombre<small class="ZQ-gp-n ZQ-num" hidden></small></span><input type="text" class="ZQ-cin ZQ-gp-in" maxlength="40" autocomplete="off" placeholder="Prequirúrgico"></label>
<p class="ZQ-hj-sub ZQ-mal ZQ-gp-dup" hidden>Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.</p>''',
                   '<button type="button" class="ZQ-p ZQ-quieto ZQ-cancelar">Cancelar</button><button type="button" class="ZQ-p ZQ-prim ZQ-gp-ok" disabled>Guardar</button>')
    tope = alerta('tope', '''<!-- A7-8 · Tope de 10 plantillas -->
<span class="ZQ-al-i ZQ-e-ag">''' + ic(I['aviso'], 28, 1.8) + '''</span>
<h2>Ya tienes 10 plantillas de ''' + etq + '''</h2><p lang="es">Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>
<div class="ZQ-al-p"><button type="button" class="ZQ-p ZQ-quieto ZQ-cancelar">Cancelar</button><button type="button" class="ZQ-p ZQ-prim ZQ-tope-ok" aria-label="Gestionar plantillas">Gestionar</button></div>''')
    gestionar = ('<section class="ZQ-pan ZQ-hoja ZQ-alta ZQ-ancha" data-capa="gestionar" role="dialog" aria-modal="true" aria-label="Plantillas de ' + etq + '" tabindex="-1"><span class="ZQ-asa"></span>'
                 '''<!-- A7-9 · Gestionar: cada plantilla es una fila; sus tres acciones (Renombrar, Sobrescribir, Eliminar) aparecen como tres botones pequeños al tocar «···» de la fila.
     Renombrar es en línea (Enter guarda, Esc cancela). Si una operación falla: «No se pudo renombrar «…».» + «Reintentar» en una línea sobre la lista. -->
<div class="ZQ-hj-cab"><button type="button" class="ZQ-p ZQ-ib ZQ-x" aria-label="Volver al formulario">''' + ic(I['volver'], 20, 2) + '''</button><h2>Plantillas de ''' + etq + '''</h2><span class="ZQ-cta ZQ-ges-n"></span></div>
<div class="ZQ-hj-c"><p class="ZQ-hj-sub ZQ-ges-info" hidden>El formulario no tiene nada que una plantilla guarde: no hay con qué sobrescribir.</p><ul class="ZQ-ges-l"></ul>
  <div class="ZQ-ges-vacio" hidden><p class="ZQ-ok-t" style="font-size:17px;line-height:22px">Todavía no tienes plantillas de ''' + etq + '''</p>
    <p class="ZQ-hj-sub" style="padding-top:4px">Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.</p>
    <button type="button" class="ZQ-p ZQ-tonal ZQ-x" style="margin:6px 0 8px">Volver al formulario</button></div></div></section>''')
    conf_pl = alerta('conf-pl', '<span class="ZQ-al-i ZQ-e-ag ZQ-cp-i1">' + ic(I['aviso'], 28, 1.8) + '</span><span class="ZQ-al-i ZQ-e-mal ZQ-cp-i2" hidden>' + ic(I['bote'], 28, 1.8) + '</span>'
                     '<h2 class="ZQ-cp-t"></h2><p class="ZQ-cp-p" lang="es"></p><div class="ZQ-al-p"><button type="button" class="ZQ-p ZQ-quieto ZQ-cp-no">Cancelar</button><button type="button" class="ZQ-p ZQ-prim ZQ-cp-ok"></button></div>')
    # CALMA §23.2 · «Descargar» en todos los marcos; nada de «Compartir»
    salida = '<a href="#" class="ZQ-p ZQ-mr ZQ-ln ZQ-g-desc">' + ic(I['descargar'], 20, 1.8, 'ZQ-mi') + '<span class="ZQ-mr-t">Descargar</span>' + FLECHA + '</a>'
    gen = ('<section class="ZQ-pan ZQ-hoja ZQ-ancha" data-capa="gen" role="dialog" aria-modal="true" aria-label="' + titulo_gen + '" tabindex="-1"><span class="ZQ-asa"></span>'
           '''<!-- A7-13/14/15 · Modal posterior: una lista de filas pulsables. «Visualizar» abre el PDF (enlace directo, sin asincronía); el visor imprime.
     La tercera fila es «Descargar» en todos los marcos (CALMA §23.2).
     Paciente sin correo en la ficha: abre ya en el paso de escribirlo («Este paciente no tiene correo en su ficha. Escríbelo aquí:»). -->
<div class="ZQ-hj-c" style="padding-top:12px"><div class="ZQ-gn-cab"><span class="ZQ-al-i ZQ-e-ok ZQ-gn-i1">''' + ic(I['ok'], 28, 2) + '''</span><span class="ZQ-al-i ZQ-e-ag ZQ-gn-i2" hidden>''' + ic(I['aviso'], 28, 1.8) + '''</span>
  <h2 class="ZQ-ok-t">''' + titulo_gen + '''</h2>
  <p class="ZQ-hj-sub ZQ-gn-ok">Ya puedes abrirlo para revisarlo o imprimirlo.</p>
  <p class="ZQ-hj-sub ZQ-mal ZQ-just ZQ-gn-no" lang="es" hidden>El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente.</p></div>
  <a href="#" class="ZQ-p ZQ-mr">''' + ic(I['ojo'], 20, 1.8, 'ZQ-mi') + '''<span class="ZQ-mr-t">Visualizar</span>''' + FLECHA + '''</a>
  <button type="button" class="ZQ-p ZQ-mr ZQ-gn-correo" data-paso="listo enviando enviado">''' + ic(I['sobre'], 20, 1.8, 'ZQ-mi') + '''<span class="ZQ-mr-t"><span class="ZQ-gn-ct">Enviar por correo</span><small class="ZQ-gn-dest">Se enviará a paciente01@semilla.spinus.test</small></span>''' + FLECHA + '''</button>
  <div class="ZQ-mr" data-paso="pidiendo" style="display:block;padding:12px 0 4px" hidden>
    <label class="ZQ-campo"><span>Correo solo para este envío (la ficha no se toca):</span><input type="email" inputmode="email" class="ZQ-cin ZQ-gn-in" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nombre@correo.com"></label>
    <div class="ZQ-par"><button type="button" class="ZQ-p ZQ-quieto ZQ-gn-cancel">Cancelar</button><button type="button" class="ZQ-p ZQ-prim ZQ-gn-enviar" disabled>Enviar por correo</button></div></div>
  <div class="ZQ-mr" data-paso="confirmando" style="display:block;padding:12px 0 4px" hidden>
    <p class="ZQ-hj-sub" style="padding-bottom:0">Va a enviar el documento a esta dirección escrita a mano:</p><p class="ZQ-dir"></p>
    <p class="ZQ-hj-sub">Compruébala letra por letra. El archivo lleva datos clínicos dentro y un correo enviado no se puede recuperar.</p>
    <div class="ZQ-par"><button type="button" class="ZQ-p ZQ-quieto ZQ-gn-corr">Corregir</button><button type="button" class="ZQ-p ZQ-prim ZQ-gn-si">Sí, enviar ahí</button></div></div>
  <button type="button" class="ZQ-p ZQ-tonal ZQ-ch ZQ-gn-otro" data-paso="listo" style="margin:0 0 12px 30px">Usar otro correo solo para este envío</button>
  ''' + salida + '''
  <div data-paso="enviado" style="padding-top:8px" hidden><p class="ZQ-hj-sub ZQ-gn-env" aria-live="polite"></p>
    <div class="ZQ-gn-ofr" hidden><p class="ZQ-hj-sub ZQ-gn-ofr-t" style="padding-bottom:0"></p>
      <div class="ZQ-par"><button type="button" class="ZQ-p ZQ-quieto ZQ-gn-nog">No, gracias</button><button type="button" class="ZQ-p ZQ-tonal ZQ-gn-fic">Guardar en la ficha</button></div></div>
    <p class="ZQ-hj-sub ZQ-gn-fok" aria-live="polite" hidden>Guardado en la ficha del paciente.</p></div>
</div><div class="ZQ-hj-p"><button type="button" class="ZQ-p ZQ-quieto ZQ-x">Cerrar</button></div></section>''')
    return ('<div class="ZQ-capa"><div class="ZQ-velo"></div>' + capa_mas(vp) + menu + tipo + conf_tipo + plant + guardar + tope + gestionar + conf_pl + gen + '</div>'
            '<div class="ZQ-toast" role="status" aria-live="polite"><span></span></div>')

# ---------- Formularios ----------
def form_receta():
    return (plantilla_fila() + '\n' + datos('Diagnóstico principal') + '''
<!-- A7-18 · Medicamentos: cada uno es un bloque de filas (nombre comercial con autocompletar del catálogo, presentación, vía, principio activo, indicaciones).
     «Agregar medicamento» va al pie de CADA bloque e inserta justo después de él (como hoy); el bote de cada bloque lo elimina (apagado si solo hay uno). El guion pinta los bloques. -->
<section class="ZQ-g"><h2 class="ZQ-g-t">Medicamentos</h2><div class="ZQ-pila ZQ-lst"></div></section>
<section class="ZQ-g"><h2 class="ZQ-g-t">Recomendaciones</h2><div class="ZQ-s"><label class="ZQ-r"><span class="ZQ-sr">Recomendaciones</span>
  <textarea class="ZQ-ta ZQ-sola ZQ-i-libre" placeholder="Indicaciones generales, cuidados, datos de alarma…"></textarea></label></div></section>''')

PRESET = ['Biometría Hemática', 'Glucosa', 'Urea', 'Creatinina', 'Examen General de Orina', 'TP', 'TPT', 'Perfil Tiroideo Completo', 'Urocultivo', 'Cultivo de Secreción']

def form_lab():
    cks = ''.join('<button type="button" class="ZQ-p ZQ-r ZQ-ck" aria-pressed="false" data-e="%s"><span class="ZQ-flex">%s</span>%s</button>' % (e, e, ic(I['ok'], 20, 2.2)) for e in PRESET)
    return (plantilla_fila() + '\n' + datos('Dx de envío') + '''
<!-- A7-19 · Estudios frecuentes: diez opciones = lista de filas con palomita (dos columnas en ancho), no una pared de chips. Tocar una la agrega o la quita de la solicitud. -->
<section class="ZQ-g"><h2 class="ZQ-g-t">Estudios frecuentes</h2><div class="ZQ-s ZQ-cks">''' + cks + '''</div></section>
<!-- Estudios solicitados: una fila por estudio (combo escribible sobre el catálogo; numeral desde dos), bote para eliminar y «Agregar» como última fila -->
<section class="ZQ-g"><h2 class="ZQ-g-t">Estudios solicitados</h2><div class="ZQ-s ZQ-lst"></div></section>
<section class="ZQ-g"><h2 class="ZQ-g-t">Indicaciones / Notas</h2><div class="ZQ-s"><label class="ZQ-r"><span class="ZQ-sr">Indicaciones / Notas</span>
  <textarea class="ZQ-ta ZQ-sola ZQ-i-libre" placeholder="Indicaciones especiales, ayuno requerido…"></textarea></label></div></section>''')

def form_imagen():
    urg = '''
  <!-- A7-20 · «Marcar como urgente»: interruptor; encendido, la etiqueta URGENTE (la misma que sale en el PDF) aparece junto al paciente en la cabecera -->
  <button type="button" class="ZQ-p ZQ-r ZQ-sw ZQ-b-urg" role="switch" aria-checked="false"><span class="ZQ-flex">Marcar como urgente</span><span class="ZQ-sw-p"></span></button>'''
    return (plantilla_fila() + '\n' + datos('Dx de envío', urg) + '''
<!-- A7-20 · Estudios de imagen: cada estudio es un bloque de cuatro filas (tipo con combo escribible, región, proyecciones, indicación clínica).
     Un bloque con tipo sin región (o al revés) bloquea la impresión y lo dice en su fila. «Agregar estudio» es la última fila. -->
<section class="ZQ-g"><h2 class="ZQ-g-t">Estudios de imagen</h2><div class="ZQ-pila ZQ-lst"></div></section>''')

FORMS = {'receta': form_receta, 'lab': form_lab, 'imagen': form_imagen}

def marco_form(k, vp):
    col = ('<div class="ZQ-col"><main class="ZQ-cont"><div class="ZQ-ancho">\n' + cabecera(k) + '\n' + FORMS[k]() + '\n</div></main>\n' + barra() + '</div>')
    nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'iv': encabezado_iv, 'esc': lateral}[vp](*((vp,) if vp in ('ih', 'esc') else ()))
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    return '<div class="marco ZQ" data-vp="%s" data-doc="%s">\n<div class="ZQ-app">\n%s\n</div>\n%s\n</div>\n' % (vp, k, app, capas_form(k, vp))

# ---------- Entrada /documentos ----------
def marco_entrada(vp):
    cuerpo = ('''<!-- A14-1 · Título y subtítulo. (Estado de sistema A14-8: esqueleto con la misma silueta —título, campo y dos filas—; plan bloqueado → /billing.) -->
<header class="ZQ-top"><p class="ZQ-ceja">Clínica</p><h1 class="ZQ-h1">Documentos</h1><p class="ZQ-sub">Genera e imprime documentos con tu membrete oficial</p></header>
<!-- A14-2 · Paso 1: la búsqueda es la protagonista. Desde 2 letras: «Buscando...» y hasta 8 resultados como filas.
     A14-3 · Sin resultados: fila «Registrar "texto" · Crear nuevo paciente y continuar» → alta rápida. -->
<section class="ZQ-g ZQ-paso1"><p class="ZQ-ceja">Paso 1</p><h2 class="ZQ-sec-t">Selecciona el paciente</h2>
  <label class="ZQ-busca">''' + ic(I['lupa'], 20, 2) + '''<input type="text" class="ZQ-e-in" autocomplete="off" placeholder="Buscar por nombre o apellido..." aria-label="Buscar por nombre o apellido"></label>
  <p class="ZQ-ayuda ZQ-e-ayuda">El documento se guardará en su expediente automáticamente.</p>
  <p class="ZQ-ayuda ZQ-e-busc" role="status" hidden>Buscando...</p>
  <div class="ZQ-s ZQ-res" hidden></div></section>
<!-- A14-5 · Paciente seleccionado, con «×» para cambiarlo. A14-6/7 · Paso 2: la rejilla de nivel 4 (con ?tipo= se entra directo al formulario de ese tipo). -->
<section class="ZQ-g ZQ-paso2" hidden><div class="ZQ-s"><div class="ZQ-fila"><span class="ZQ-pav ZQ-e-num">01</span><span class="ZQ-flex"><b class="ZQ-e-nom">Paciente Prueba 01</b><small>Paciente seleccionado</small></span>
  <button type="button" class="ZQ-p ZQ-ib ZQ-e-x" aria-label="Cambiar de paciente">''' + X + '''</button></div></div></section>
<section class="ZQ-g ZQ-paso2" hidden><p class="ZQ-ceja">Paso 2</p><h2 class="ZQ-sec-t">Tipo de documento</h2><div class="ZQ-s ZQ-rej-s">''' + rejilla() + '''</div></section>''')
    alta = hoja('alta', 'Registrar paciente', '''<!-- A14-4 · Alta rápida (QuickPatientModal). Para la secretaria añade «Médico responsable *»; ella no tiene «Documentos» en su menú, así que aquí no aplica. -->
<p class="ZQ-hj-sub ZQ-mal ZQ-al-err" role="alert" hidden></p>
<div class="ZQ-al-dup" hidden><p class="ZQ-hj-sub ZQ-just" lang="es" style="color:var(--ag-tinta)">Ya existe un paciente con los mismos datos: Paciente Prueba 07 (Exp. #EXP-2026-0007). ¿Es el mismo paciente o una persona distinta?</p>
  <p class="ZQ-hj-sub ZQ-just" lang="es" style="color:var(--ag-tinta)">Si es otra persona, se creará el registro de todos modos.</p>
  <div class="ZQ-pila-b"><button type="button" class="ZQ-p ZQ-tonal ZQ-al-mismo">Es el mismo paciente</button><button type="button" class="ZQ-p ZQ-quieto ZQ-al-otro">Es otra persona</button>
  <button type="button" class="ZQ-p ZQ-quieto ZQ-al-dupno">Cancelar</button></div></div>
<div class="ZQ-dos"><label class="ZQ-campo"><span>Nombre</span><input type="text" class="ZQ-cin ZQ-al-nom" autocomplete="off"></label>
  <label class="ZQ-campo"><span>Apellidos</span><input type="text" class="ZQ-cin ZQ-al-ape" autocomplete="off"></label></div>
<div class="ZQ-dos"><label class="ZQ-campo"><span>Fecha de nacimiento</span><input type="text" class="ZQ-cin ZQ-num" inputmode="numeric" placeholder="dd/mm/aaaa" autocomplete="off"></label>
  <label class="ZQ-campo"><span>Edad (opcional)</span><input type="text" class="ZQ-cin ZQ-num" inputmode="numeric" placeholder="Ej. 35" autocomplete="off"></label></div>
<p class="ZQ-hj-sub" style="margin-top:-2px">Si no conoces la fecha exacta, ingresa solo la edad</p>
<label class="ZQ-campo"><span>Correo</span><input type="email" class="ZQ-cin" placeholder="opcional" autocomplete="off"></label>
<p class="ZQ-hj-sub">El expediente completo se puede editar después desde Expediente.</p>
<button type="button" class="ZQ-p ZQ-casilla ZQ-al-priv" role="checkbox" aria-checked="false"><i>''' + ic(I['ok'], 16, 2.6) + '''</i><span>Paciente informado del <a href="#">aviso de privacidad</a></span></button>''',
                '<button type="button" class="ZQ-p ZQ-quieto ZQ-cancelar">Cancelar</button><button type="button" class="ZQ-p ZQ-prim ZQ-al-ok">Crear y continuar</button>', cls='ZQ-alta ZQ-ancha')
    col = '<div class="ZQ-col"><main class="ZQ-cont"><div class="ZQ-ancho">\n' + cuerpo + '\n</div></main></div>'
    nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'iv': encabezado_iv, 'esc': lateral}[vp](*((vp,) if vp in ('ih', 'esc') else ()))
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    capas = '<div class="ZQ-capa"><div class="ZQ-velo"></div>' + capa_mas(vp) + alta + '</div><div class="ZQ-toast" role="status" aria-live="polite"><span></span></div>'
    return '<div class="marco ZQ" data-vp="%s" data-doc="entrada">\n<div class="ZQ-app">\n%s\n</div>\n%s\n</div>\n' % (vp, app, capas)

css = open(os.path.join(L, 'tmp-estilo.css')).read()
js = open(os.path.join(L, 'tmp-guion.js')).read()
VISTAS = [
    ('vista-1-entrada.html', 'da1', 'entrada', 'Documentos · entrada | La página queda en lo esencial: un título, el buscador de paciente como protagonista y, al elegirlo, la rejilla de los ocho tipos con su color; se conservan los rótulos «Clínica», «Paso 1» y «Paso 2» como rótulos pequeños de color'),
    ('vista-2-receta.html', 'da2', 'receta', 'Receta | El mismo formulario, con los mismos campos, como grupos de filas tipo ajustes: cada medicamento es un bloque legible, las plantillas son una fila discreta y abajo queda un solo botón, «Imprimir»'),
    ('vista-3-laboratorio.html', 'da3', 'lab', 'Laboratorio | Los estudios frecuentes dejan de ser una pared de chips y pasan a ser una lista con palomitas; los estudios solicitados son filas sencillas con «Agregar» al final'),
    ('vista-4-imagenologia.html', 'da4', 'imagen', 'Imagenología | Cada estudio es un bloque de cuatro filas; «Marcar como urgente» es un interruptor y la etiqueta roja «Urgente» sube junto al nombre del paciente'),
]
for arch, pref, k, nom in VISTAS:
    marcos = ''.join((marco_entrada(v) if k == 'entrada' else marco_form(k, v)) for v in ('ext', 'tel', 'ih', 'iv', 'esc'))
    out = ('<!-- NOMBRE: ' + nom + ' -->\n'
           '<!-- Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1) al entrar y al salir; en la app será un resorte.\n'
           '     Estados de sistema no dibujados: cargador y error del formulario dinámico («Cargando formulario...», «No se pudo cargar el formulario · Verifica tu conexion e intenta de nuevo»);\n'
           '     plan bloqueado → /billing; parámetros ?tipo=, ?dx=, ?borrador=, ?doc= se conservan (no tienen señal visible). -->\n'
           '<style>\n' + css + '</style>\n' + marcos + '<script>\n' + js + '</script>\n').replace('ZQ', pref)
    open(os.path.join(L, arch), 'w').write(out)
    print(arch, len(out))
