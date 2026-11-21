# Agenda · Configuración (/agenda/configuracion). Uso: python3 tmp-ac-gen.py  → vista-1…5-*.html
# Reutiliza la navegación y las piezas de agenda-base (tmp-gen.py hasta «LA BARRA», tmp-nav.css, tmp-estilo.css) SIN escribir nada allí.
import os, json
L = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(os.path.dirname(L), 'agenda-base')
_src = open(f'{B}/tmp-gen.py').read()
_src = _src[:_src.index('CSS = open(')]  # hasta las piezas (barra, rejilla, menú de opciones); sin escribir nada en agenda-base
_g = {'__file__': f'{B}/tmp-gen.py'}
exec(compile(_src, 'agenda-base/tmp-gen.py', 'exec'), _g)
ic, I, riel, lateral, encabezado, enc_iv = _g['ic'], _g['I'], _g['riel'], _g['lateral'], _g['encabezado'], _g['enc_iv']
barra, rejilla, menu_opciones, HOY = _g['barra'], _g['rejilla'], _g['menu_opciones'], _g['HOY']
VPS = ('ext', 'tel', 'ih', 'iv', 'esc')

I.update(
    edificio='<path d="M4 21V6.5L12 3l8 3.5V21"/><path d="M9 21v-4h6v4M8.5 9h.01M12 9h.01M15.5 9h.01M8.5 13h.01M12 13h.01M15.5 13h.01M2.5 21h19"/>',
    pin='<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    copiar='<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    tri='<path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
    boleto='<path d="M3.5 8.5V6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2a3.5 3.5 0 0 0 0 7v2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2a3.5 3.5 0 0 0 0-7z"/><path d="M14 5v2.5M14 11v2M14 16.5V19"/>',
    estet='<path d="M5 3.5V8a4.5 4.5 0 0 0 9 0V3.5M9.5 12.5V15a5 5 0 0 0 10 0v-1.5"/><circle cx="19.5" cy="11.5" r="2"/>',
    lista='<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
    bloq='<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    reinicia='<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/>',
)
CHEV = ic(I['sig'], 18, 2).replace('aria-hidden', 'class="ac-chev" aria-hidden')
ABAJO = ic(I['abajo'], 16, 2.2)

def at(ver=None, si=None, no=None, extra=''):
    s = ''
    if ver: s += f' data-ver="{ver}"'
    if si: s += f' data-si="{si}"'
    if no: s += f' data-no="{no}"'
    return s + extra

# ------------------------------------------------------------------ PIEZAS ------------------------------------------------------------------
def grupo(tit, icono, cuerpo, pie='', der='', aria=None, **a):
    p = f'<p class="ac-pie">{pie}</p>' if pie else ''
    return (f'<section class="ac-g" aria-label="{aria or tit}"{at(**a)}>'
            f'<div class="ac-gt"><span class="ac-gtt">{ic(I[icono], 16, 2)}<h3>{tit}</h3></span>{der}</div>'
            f'<div class="ac-tar">{cuerpo}</div>{p}</section>')

def tarjeta(cuerpo, **a):
    return f'<div class="ac-tar"{at(**a)}>{cuerpo}</div>'

def dia(l, v, **a):
    return f'<div class="ac-f"{at(**a)}><span class="ac-fl">{l}</span><span class="ac-fv ag0-num">{v}</span></div>'

def apilado(l, v, **a):
    return f'<div class="ac-f ac-ap"{at(**a)}><span class="ac-fl">{l}</span><span class="ac-fv">{v}</span></div>'

def acc(t, cls='', chev=True, extra='', icono=None, **a):
    i = ic(I[icono], 18, 2.2) if icono else ''
    return f'<button type="button" class="ag0-p ac-acc {cls}"{extra}{at(**a)}>{i}<span>{t}</span>{CHEV if chev else ""}</button>'

def txt(t, extra='', rojo=False, **a):
    return f'<button type="button" class="ag0-p ac-txt{" ac-rojo" if rojo else ""}"{extra}{at(**a)}>{t}</button>'

COLOR_TIPO = {'Primera vez': ('indigo', 'Índigo'), 'Curación': ('oliva', 'Oliva'), 'Revisión de estudios': ('bronce', 'Bronce'), 'Consulta': (None, 'Sin color')}
def punto(t):
    # CALMA §29.10: cada tipo de cita enseña su color (COLORES_EVENTO) a la izquierda del nombre; sin color, un aro vacío
    k, nom = COLOR_TIPO[t]
    est = f' style="--pc:var(--cal-ev-{k})"' if k else ''
    return f'<span class="ac-pto{"" if k else " ac-pto-no"}" role="img" aria-label="{"Sin color" if not k else "Color: " + nom}"{est}></span>'

def fila(t, sub='', acciones='', cls='', l1extra='', color=False, **a):
    s = f'<small>{sub}</small>' if sub else ''
    la = f'<span class="ac-la">{acciones}</span>' if acciones else ''
    return f'<div class="ac-li{" ac-lect" if not acciones else ""} {cls}" role="group" aria-label="{t}"{at(**a)}><span class="ac-lt"><span class="ac-l1">{punto(t) if color else ""}<b>{t}</b>{l1extra}</span>{s}</span>{la}</div>'

def swf(t, ayuda, on, t_off=None, extra='', est=None, **a):
    tt = f'<b data-on="{t}" data-off="{t_off}">{t if on else t_off}</b>' if t_off else f'<b>{t}</b>'
    e = f' data-est="{est}"' if est else ''
    ay = f'<small>{ayuda}</small>' if ayuda else ''
    return (f'<button type="button" role="switch" aria-checked="{"true" if on else "false"}" class="ag0-p ac-swf"{e}{extra}{at(**a)}>'
            f'<span class="ac-lt">{tt}{ay}</span><span class="ag0-sw" aria-hidden="true"></span></button>')

def nota(t, **a):
    return f'<p class="ac-nota" data-solo-admin{at(**a)}>{ic(I["info"], 16, 2)}<span>{t}</span></p>'

def ambar(t, **a):
    return f'<div class="ag0-aviso ag0-av-g ac-vis" role="note"{at(**a)}>{ic(I["tri"], 16, 2)}<p>{t}</p></div>'

def chip(t, k, icono=None, **a):
    i = ic(I[icono], 14, 2.2) if icono else ''
    return f'<span class="ac-chip ac-c-{k}"{at(**a)}>{i}{t}</span>'

def err(t, **a):
    return f'<p class="ac-err" role="alert"{at(**a)}>{ic(I["tri"], 16, 2)}<span>{t}</span></p>'

def seleccion(ops, val, cls='', extra=''):
    o = ''.join(f'<option{" selected" if x == val else ""}>{x}</option>' for x in ops)
    return f'<span class="ac-sel {cls}"><select class="ac-in"{extra}>{o}</select>{ABAJO}</span>'

def seg(ops, elegida, n=None, extra='', dis=False):
    b = ''.join(f'<button type="button" class="ag0-p" aria-pressed="{"true" if v == elegida else "false"}" data-v="{v}"{" disabled" if dis else ""}>{t}</button>' for v, t in ops)
    return f'<div class="ac-seg" style="--n:{n or len(ops)}" role="group"{extra}>{b}</div>'

TABS = [('enlace', 'Tu enlace', 'Enlaces', '3-enlace'), ('horario', 'Cuándo das consulta', 'Cuándo dan consulta', '1-horario'),
        ('consulta', 'Tu consulta', 'Tipos de cita', '2-consulta'), ('avisos', 'Avisos', None, '4-avisos'), ('mas', 'Más opciones', None, '5-mas')]

def cabecera(activa):
    tabs = ''
    for k, t, ts, opk in TABS:
        sel = k == activa
        nom = f'<span data-ver="adm inv">{t}</span><span data-ver="sec">{ts}</span>' if ts else t
        tabs += (f'<button type="button" role="tab" class="ag0-p ac-tab" aria-selected="{"true" if sel else "false"}" tabindex="{0 if sel else -1}"'
                 f'{"" if sel else f" data-ir=\"{opk} config-{k}\""}>{nom}</button>')
    return f'''<header class="ac-cab">
    <a href="#" class="ag0-p ac-volver">{ic(I["ant"], 16, 2.2)}Agenda</a>
    <h1 class="ac-h1">Configuración de la agenda</h1>
    <p class="ac-sub">Esto es lo que elegiste al empezar. Cambia lo que quieras: se guarda solo.</p>
    <!-- Pestañas en TEXTO en todos los marcos (hoy, en el teléfono, solo iconos con el nombre debajo). Patrón APG: flechas, Inicio, Fin.
         En la maqueta, cada pestaña lleva a la vista de esa sección más abajo en esta página. -->
    <div class="ac-tabs" role="tablist" aria-label="Secciones de la configuración">{tabs}</div>
  </header>'''

def marco(n, vp, contenido, capas=''):
    cont = (f'<main class="ac-cont" aria-label="Configuración de la agenda">\n<div class="ac-col">\n{contenido}\n</div>\n</main>')
    if vp == 'ext': app = cont + riel()
    elif vp == 'tel': app = encabezado() + cont
    elif vp == 'iv': app = enc_iv() + cont
    elif vp == 'ih': app = cont + lateral()
    else: app = lateral() + cont
    avisos = '<div class="ac-avisos" role="status" aria-live="polite"></div>'
    return (f'<div class="marco ac ag0 ac-v{n}" data-vp="{vp}" data-rol="adm" lang="es">\n<div class="ag0-app ac-app-cfg">\n{app}\n</div>\n'
            f'{agenda_real(vp)}\n{avisos}\n{capas}\n</div>')

def agenda_real(vp):
    # «‹ Agenda» y «Agenda» de la navegación vuelven a la AGENDA REAL: la vista Día de agenda-base (barra de cuatro vistas + rejilla),
    # copiada con sus piezas .ag0. Su «Opciones de la agenda» › «Configuración de la agenda» trae de vuelta aquí.
    b, flota = barra(vp, 'dia')
    cont = f'<main class="ag0-cont" aria-label="Agenda">{b}{rejilla(vp, [HOY], scroll=12)}{flota}</main>'
    if vp == 'ext': app = cont + riel()
    elif vp == 'tel': app = encabezado() + cont
    elif vp == 'iv': app = enc_iv() + cont
    elif vp == 'ih': app = cont + lateral()
    else: app = lateral() + cont
    return f'<div class="ag0-app ac-app-ag" hidden>\n{app}\n</div>\n{menu_opciones(vp)}'

def capa(key, titulo, cuerpo, pie, ancho='ac-w520', sub='', aria=None):
    s = f'<p class="ac-cjsub">{sub}</p>' if sub else ''
    return f'''<div class="ag0-capa" data-capa="{key}" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj {ancho}" role="dialog" aria-modal="true" aria-label="{aria or titulo}"><span class="ag0-asa" aria-hidden="true"></span>
    <div class="ag0-cjc"><h2>{titulo}</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>{s}
    <div class="ag0-cj-in ac-cjb">{cuerpo}</div>
    <div class="ac-cjp">{pie}</div>
  </div>
</div>'''

def alerta(key, icono, tono, titulo, texto, sec, prim, prim_cls='ac-prim', extra_cuerpo='', prim_extra='', ancho='ac-alerta', rol='alertdialog'):
    return f'''<div class="ag0-capa ac-capa-al" data-capa="{key}" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj {ancho}" role="{rol}" aria-modal="true" aria-label="{titulo}">
    <div class="ac-al"><span class="ac-aic ac-aic-{tono}">{ic(I[icono], 28, 2)}</span><h2 class="ac-atit">{titulo}</h2>{f'<p class="ac-atx">{texto}</p>' if texto else ''}{extra_cuerpo}
      <div class="ac-abt"><button type="button" class="ag0-p ac-quieto" data-cierra="1">{sec}</button><button type="button" class="ag0-p {prim_cls}"{prim_extra}>{prim}</button></div></div>
  </div>
</div>'''

def intro(t, h2, **a):
    return f'<h2 class="ac-sr"{at(**a)}>{h2}</h2><p class="ac-intro"{at(**a)}>{t}</p>'

# ------------------------------------------------------------------ SEMILLA ------------------------------------------------------------------
DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
CLINICA = {d: (True, '08:00', '18:00') for d in DIAS[:5]}; CLINICA['Sábado'] = (True, '08:00', '13:00'); CLINICA['Domingo'] = (False, '08:00', '18:00')
NORTE = {d: (d in ('Martes', 'Jueves'), '16:00', '20:00') for d in DIAS}
TXT_CLINICA = 'Lun a vie 8:00 – 18:00 · Sáb 8:00 – 13:00'
HUSOS = ['Baja California — Tijuana, Ensenada, Mexicali (UTC-8)', 'Sinaloa, BCS y Nayarit interior — Mazatlán, La Paz, Los Cabos, Tepic (UTC-7)',
         'Sonora — Hermosillo, Ciudad Obregón (UTC-7)', 'Centro — CDMX, Jalisco, Edomex, Puebla, Veracruz, Oaxaca y mayoría (UTC-6)',
         'Yucatán — Mérida, Valladolid (UTC-6)', 'Nuevo León, Coahuila y Tamaulipas interior — Monterrey, Saltillo (UTC-6)',
         'Tamaulipas frontera — Matamoros, Reynosa, Nuevo Laredo (UTC-6)', 'Chihuahua — capital y zona centro (UTC-6)', 'Chihuahua — Ojinaga (UTC-6)',
         'Chihuahua — Ciudad Juárez (UTC-6)', 'Nayarit — Bahía de Banderas, Punta Mita (UTC-6)', 'Quintana Roo — Cancún, Playa, Tulum (UTC-5)']
HUSO = 'Yucatán — Mérida, Valladolid (UTC-6)'
HUSO_HTML = 'Yucatán — Mérida, Valladolid <span class="ac-nw">(UTC-6)</span>'
TODOS = 'adm inv sec'

# ================================================================== VISTA 1 · CUÁNDO DAS CONSULTA ==================================================================
def editor(h, k):
    # En la app son <input type="time"> (24 h con es-MX); en la maqueta, texto «HH:MM» para que Chromium en inglés no pinte «04:00 PM».
    filas = ''
    for d in DIAS:
        on, e, s = h[d]
        filas += (f'<div class="ac-dr" role="group" aria-label="{d}" data-on="{"1" if on else "0"}">'
                  f'<button type="button" role="switch" aria-checked="{"true" if on else "false"}" aria-label="{d}" class="ag0-p ac-dsw"><span class="ag0-sw" aria-hidden="true"></span></button>'
                  f'<span class="ac-dn">{d}</span>'
                  f'<span class="ac-dh"><label>Entras<input type="text" inputmode="numeric" maxlength="5" class="ac-in" data-e value="{e}" aria-label="{d}, entras"></label><label>Sales<input type="text" inputmode="numeric" maxlength="5" class="ac-in" data-s value="{s}" aria-label="{d}, sales"></label></span>'
                  f'<span class="ac-dsin">Sin consulta</span>'
                  f'{err("Sales antes de entrar: cambia una de las dos horas.").replace("<p ", "<p hidden ", 1)}</div>')
    return f'<div class="ac-ed">{filas}</div>{err("Prende al menos un día.").replace("<p ", "<p hidden data-ninguno ", 1)}'

def dialogo_horario(key, nombre, modo, h, clinica=False):
    if clinica:
        cuerpo = (f'<div data-bloque="propio">{editor(CLINICA, key)}</div>'
                  f'<label class="ac-campo">Huso horario de la clínica{seleccion(HUSOS, HUSO, extra=" style=\"width:100%\"").replace("ac-sel ", "ac-sel ac-ancho ")}</label>'
                  '<p class="ac-ayuda">Cambia el horario de todos los consultorios que dicen «Igual que la clínica». El huso de cada consultorio no cambia. Las citas que ya están apartadas no se mueven.</p>')
        tit = 'Horario de la clínica'
    else:
        cuerpo = (seg([('clinica', 'Igual que la clínica'), ('propio', 'Otro horario')], modo, extra=' data-modos aria-label="Horario"').replace('data-v="clinica"', 'data-v="clinica" data-modo="clinica"').replace('data-v="propio"', 'data-v="propio" data-modo="propio"')
                  + f'<p class="ac-modo" data-bloque="clinica"{"" if modo == "clinica" else " hidden"}>Aquí darás consulta en el horario de la clínica: <strong>{TXT_CLINICA}</strong>. Si la clínica cambia su horario, el tuyo cambia también.</p>'
                  + f'<div data-bloque="propio"{"" if modo == "propio" else " hidden"}>{editor(h, key)}</div>'
                  + '<p class="ac-ayuda">Las citas que ya tienes apartadas no se mueven.</p>')
        tit = f'Horario en {nombre}'
    cuerpo += err('No se pudo guardar el horario', si='errdlg')
    pie = '<button type="button" class="ag0-p ac-quieto" data-cierra="1">Cancelar</button><button type="button" class="ag0-p ac-prim" data-guarda>Guardar horario</button>'
    return capa(key, tit, cuerpo, pie)

CONS = [  # clave, nombre, dueño (rol que lo administra), quién lo ve como ajeno, modo, líneas
    ('centro', 'Centro', 'adm', 'Dr. Admin Semilla', 'clinica', [('Lun a vie', '8:00 – 18:00'), ('Sáb', '8:00 – 13:00')]),
    ('norte', 'Hosp Norte', 'adm', 'Dr. Admin Semilla', 'propio', [('Mar, Jue', '16:00 – 20:00')]),
    ('rehab', 'Rehab', 'inv', 'Dra. Invitada Semilla', 'clinica', [('Lun a vie', '8:00 – 18:00'), ('Sáb', '8:00 – 13:00')]),
]

def vista1(vp):
    clin = (dia('Lun a vie', '8:00 – 18:00', no='errcfg') + dia('Sáb', '8:00 – 13:00', no='errcfg')
            + '<p class="ac-vacio" data-si="errcfg">No se pudo cargar. Recarga la página.</p>'
            + apilado('Huso horario', HUSO_HTML)
            + f'<div class="ac-sinlinea" data-ver="inv" style="padding:0">{nota("Solo el médico administrador puede cambiar estas opciones.").replace("<p ", "<p style=\"margin:4px 16px 14px\" ", 1)}</div>'
            + acc('Cambiar horario', extra=' data-abre="h-clinica" aria-haspopup="dialog" aria-label="Cambiar horario de la clínica"', ver='adm', no='errcfg'))
    # «Lo usan los consultorios…» va de pie del grupo (hoy, última línea de la tarjeta)
    c = intro('Tus pacientes solo pueden pedir cita en estos días y horas.', 'Cuándo das consulta')
    c += nota('Cada médico cambia el horario de sus consultorios.', ver='sec')
    c += '<div class="ac-panel">'
    c += grupo('Horario de la clínica', 'edificio', clin, pie='Lo usan los consultorios que dicen «Igual que la clínica».')
    c += '<p class="ac-intro" data-si="errcfg">No se pudieron cargar los consultorios. Recarga la página.</p>'
    c += '<p class="ac-intro" data-si="sincons" data-no="errcfg">Aún no hay consultorios activos.</p>'
    for k, nom, dueno, quien, modo, lineas in CONS:
        otros = ' '.join(r for r in ('adm', 'inv', 'sec') if r != dueno)
        der = (f'<span class="ac-gtc">{chip("Por revisar", "ag", "reloj", si="revisar") if k == "norte" else ""}'
               f'{chip("Horario propio", "ton") if modo == "propio" else chip("Igual que la clínica", "neu")}</span>')
        cuerpo = f'<div class="ac-quien"{at(ver=otros)}>{ic(I["medico"], 16, 2)}<span>{quien}</span></div>'
        cuerpo += ''.join(dia(a, b) for a, b in lineas)
        if k == 'norte':
            cuerpo += acc('Confirmar horario', chev=False, extra=' data-guarda data-tras="-revisar"', ver=dueno, si='revisar', icono='palomita')
        cuerpo += acc('Cambiar horario', extra=f' data-abre="h-{k}" aria-haspopup="dialog" aria-label="Cambiar horario de {nom}"', ver=dueno)
        c += grupo(nom, 'pin', cuerpo, der=der, no='errcfg sincons')
    c += '<p class="ac-pie" data-ver="adm inv">Agrega más consultorios en tu <a href="#" class="ac-enl">perfil</a>.</p>'
    c += '</div>'
    capas = (dialogo_horario('h-clinica', '', 'propio', CLINICA, clinica=True)
             + dialogo_horario('h-centro', 'Centro', 'clinica', CLINICA) + dialogo_horario('h-norte', 'Hosp Norte', 'propio', NORTE)
             + dialogo_horario('h-rehab', 'Rehab', 'clinica', CLINICA))
    return cabecera('horario') + c, capas

FICHA1 = '''<h3>Especificación · Cuándo das consulta</h3>
<p>Pantalla de ajustes, no de calendario: el patrón aprobado de Mi perfil (pestañas de texto, grupos con rótulo de color e icono fuera de UNA superficie, datos como filas de lista, acciones como fila azul). <b>Escala táctil en todo lo táctil</b>: hoy la configuración usa la escala de computadora (40 px, 13 px) desde 640 px y en el Duo abierto TODOS sus controles miden menos de 44.</p>
<table><thead><tr><th></th><th>ext 466</th><th>tel 393</th><th>ih 951</th><th>iv 669</th><th>esc 1280</th></tr></thead><tbody>
<tr><th>Columna</th><td>294 (riel a la derecha)</td><td>361</td><td>601 (sin control fijo en la bisagra)</td><td>600 centrada</td><td>680 centrada en el área</td></tr>
<tr><th>Título</th><td colspan="2">26/800, 2 líneas en ext</td><td colspan="3">32/800</td></tr>
<tr><th>Pestañas</th><td colspan="2">texto 14, pista deslizable con borde fundido, 44 alto</td><td>40 alto, hueco 24</td><td>44 alto, hueco 28</td><td>40 alto, hueco 28</td></tr>
<tr><th>Filas</th><td colspan="2">días 48 · apilada 56 · fila-acción 48</td><td>44–52, rótulo a la izquierda (168)</td><td>48–52</td><td>44–52, rótulo a la izquierda</td></tr>
<tr><th>Diálogo de horario</th><td>tarjeta 310 centrada</td><td>hoja inferior arrastrable</td><td colspan="3">modal 520 centrado en el área de contenido; pie a la derecha (centrado en iv)</td></tr>
</tbody></table>
<h4>Contenido y textos</h4>
<ul><li>Rótulo «Horario de la clínica» (icono edificio) con sus líneas (días · horas, en dos columnas: días en --tinta, horas tabulares en --tinta2), «Huso horario» y, de pie, «Lo usan los consultorios que dicen «Igual que la clínica».». «Cambiar horario» (aria «Cambiar horario de la clínica») SOLO para quien administra.</li>
<li>Un grupo por consultorio con su nombre como rótulo (icono de lugar) y la etiqueta «Igual que la clínica» (neutra) u «Horario propio» (tonal); «Por revisar» ámbar con reloj + fila «Confirmar horario» cuando nadie lo ha confirmado. El de otro médico lleva su nombre y no tiene acciones.</li>
<li>«Agrega más consultorios en tu perfil.» (solo médicos). Sin consultorios: «Aún no hay consultorios activos.». Fallo: «No se pudieron cargar los consultorios. Recarga la página.» y, en la tarjeta de la clínica, «No se pudo cargar. Recarga la página.». Carga: «Cargando los consultorios…» / «…» (estado de sistema, no dibujado).</li></ul>
<h4>Permisos</h4>
<ul><li><b>Administrador</b>: cambia la clínica y sus consultorios. <b>Médico invitado</b>: la clínica sin botón y, dentro de su tarjeta, la nota «Solo el médico administrador puede cambiar estas opciones.»; cambia solo sus consultorios. <b>Secretaria</b>: pestaña «Cuándo dan consulta», nota «Cada médico cambia el horario de sus consultorios.» al inicio y todo en lectura.</li></ul>
<h4>Diálogo «Horario en {consultorio}» / «Horario de la clínica»</h4>
<ul><li>Segmentado «Igual que la clínica | Otro horario» (solo consultorio). Igual: «Aquí darás consulta en el horario de la clínica: <b>…</b>. Si la clínica cambia su horario, el tuyo cambia también.» en caja tonal.</li>
<li>Un día por fila: interruptor (área 44 / 36) · nombre · «Entras» y «Sales» (campos de hora tabulares) o «Sin consulta». En teléfono las horas bajan a una segunda línea alineada con el nombre. <b>Un solo turno por día</b> (es lo que guarda el modelo). <b>Prender un día copia las horas del día prendido anterior</b> (es la única «copia» que existe hoy; no hay «copiar a otros días»).</li>
<li>Validación en vivo: «Sales antes de entrar: cambia una de las dos horas.» bajo el día; «Prende al menos un día.»; «Guardar horario» se apaga mientras no se pueda. Clínica: además «Huso horario de la clínica» (12 zonas de México) y su nota. Error del servidor dentro del diálogo, que sigue abierto.</li>
<li>Cierra con ✕, «Cancelar», Esc, velo o (iPhone) arrastrando la hoja hacia abajo: 1:1 con el dedo, rubber-band hacia arriba (.55), al soltar proyección de inercia (d .998): si pasa la mitad o la velocidad supera 600 px/s, sale; si no, vuelve con resorte.</li></ul>
<h4>Guardado</h4><p>Se guarda al pulsar «Guardar horario» o «Confirmar horario»: aviso breve «Guardado» (palomita verde, 4 s) arriba en el área de contenido; si el servidor dice que no, el mismo aviso en rojo con el motivo («No se pudo guardar el horario», 8 s, role=alert). Duración DECIDIDA por el dueño (CALMA §29.11): «Guardado» 4 s como todo aviso de éxito (hoy 1,8 s; el error, hoy 6 s, va a 8 s del catálogo).</p>
<h4>Movimiento y accesibilidad</h4><p>Capas: velo con desenfoque (blur 10 + saturate 140) que funde; la tarjeta entra con resorte (amortiguación 1, respuesta .35 s) desde escala .96, sale en 200 ms por el mismo camino. Foco al primer control, Esc cierra y devuelve el foco. Movimiento reducido: solo fundido. Transparencia reducida: velo opaco sin desenfoque.</p>'''

TIRA_ROL = [('médico administrador', 'rol:adm', True), ('médico invitado', 'rol:inv', False), ('secretaria', 'rol:sec', False)]
TIRA_AVISOS = lambda e: [('aviso «Guardado»', 'aviso:ok|Guardado'), ('aviso de error', f'aviso:error|{e}'), ('cerrar capa', 'cerrar')]
TIRA1 = TIRA_ROL + ['|', ('consultorio por revisar', 'est:revisar', False), ('sin consultorios', 'est:sincons', False), ('fallo al cargar', 'est:errcfg', False), '|',
                    ('horario de la clínica', 'capa:h-clinica'), ('horario de Centro (igual)', 'capa:h-centro'), ('horario de Hosp Norte (propio)', 'capa:h-norte'),
                    ('error al guardar en el diálogo', 'capa:h-norte|errdlg'), '|'] + TIRA_AVISOS('No se pudo guardar el horario')

# ================================================================== VISTA 2 · TU CONSULTA ==================================================================
DUR = [(15, '15 min'), (20, '20 min'), (30, '30 min'), (45, '45 min'), (60, '60 min')]

def form_tipo(boton, para=True, nombre='', dur='45', **a):
    campos = (f'<label class="ac-campo">Nombre<input class="ac-in" maxlength="60" value="{nombre}"></label>'
              f'<label class="ac-campo">Duración (min)<input class="ac-in ac-num" type="number" inputmode="numeric" min="5" max="600" step="5" value="{dur}" style="width:100%;text-align:left"></label>'
              f'<label class="ac-campo">Color{seleccion(["Sin color", "Índigo", "Magenta", "Carmín", "Oliva", "Bronce", "Grafito"], "Sin color")}</label>')
    if para:
        campos += f'<label class="ac-campo" data-ver="adm">Para{seleccion(["Toda la clínica", "Dr. Admin Semilla", "Dra. Invitada Semilla"], "Toda la clínica")}</label>'
    estado = a.pop('estado')
    return (f'<div class="ac-bq"{at(**a)}><div class="ac-campos">{campos}</div>'
            f'<div class="ac-bts"><button type="button" class="ag0-p ac-prim" data-guarda data-tras="-{estado}">{boton}</button>'
            f'<button type="button" class="ag0-p ac-quieto" data-alterna="-{estado}">Cancelar</button></div></div>')

def vista2(vp):
    c = intro('Tu consulta dura <strong data-dur>30 minutos</strong>. Con esto sabemos cuántas citas caben en tu día.', 'Tu consulta', ver='adm', no='errtipos sindur')
    c += intro('Tu consulta dura <strong data-dur>45 minutos</strong>. Con esto sabemos cuántas citas caben en tu día.', 'Tu consulta', ver='inv', no='errtipos sindur')
    c += intro('Aún no elegiste cuánto dura tu consulta. Con esto sabemos cuántas citas caben en tu día.', 'Tu consulta', ver='adm inv', si='sindur', no='errtipos')
    c += intro('La duración de la consulta de cada médico y los demás tipos de cita de la clínica.', 'Tipos de cita', ver='sec')
    c += nota('Cada médico cambia sus tipos de cita.', ver='sec')
    c += '<p class="ac-intro" data-si="errtipos">No se pudieron leer los tipos de cita. Recarga la página.</p>'
    c += '<div class="ac-panel" data-no="errtipos">'
    # Duración: segmentado que se guarda al pulsar + «Otra duración»
    for rol, val in (('adm', 30), ('inv', 45)):
        otra = (f'<div class="ac-bq" data-si="otra"><label class="ac-frase" style="padding:0;min-height:44px"><span>Mi consulta dura</span><span class="ac-cv">'
                f'<input class="ac-in ac-num" type="number" inputmode="numeric" min="5" max="600" step="5" value="{val}" aria-label="Minutos">minutos</span></label>'
                f'<div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-guarda data-tras="-otra">Guardar</button><button type="button" class="ag0-p ac-txt" data-alterna="-otra">Cancelar</button></div></div>')
        cuerpo = (f'<div class="ac-bq">{seg([(str(v), t) for v, t in DUR], "" if False else str(val), extra=" data-guarda aria-label=\"Duración de tu consulta\"")}</div>'
                  + otra + acc('Otra duración', chev=False, extra=' data-alterna="otra"', no='otra'))
        c += f'<div class="ac-tar" data-ver="{rol}">{cuerpo}</div>'
    # En cada consultorio (solo con duración propia)
    def otra_cons(nom, est):
        ops = seg([('30', '30 min'), ('45', '45 min'), ('60', '1 hora'), ('otra', 'Otra')], '45', extra=f' data-otra aria-label="¿Cuánto dura la consulta en {nom}?"')
        return (f'<div class="ac-bq" data-si="{est}"><span class="ac-campo">¿Cuánto dura la consulta en {nom}?</span>{ops}'
                f'<label class="ac-frase" data-otra-campo hidden style="padding:0;min-height:44px"><span class="ac-cv"><input class="ac-in ac-num" type="number" inputmode="numeric" min="5" max="600" step="5" aria-label="Minutos">minutos</span></label>'
                f'{err("Elige una duración", si="errdur")}'
                f'<div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-guarda data-texto="Duración del consultorio guardada" data-tras="-{est}">Guardar</button>'
                f'<button type="button" class="ag0-p ac-txt" data-alterna="-{est}">Cancelar</button></div></div>')
    cada_adm = (fila('Centro', '', txt('Otra duración en este consultorio', extra=' data-alterna="oc-centro"'), no='oc-centro', cls='ac-envuelve')
                + otra_cons('Centro', 'oc-centro')
                + fila('Hosp Norte', 'Aquí la consulta dura <strong class="ag0-num">45 min</strong> (en los demás, 30 min)', no='oc-norte',
                       acciones=txt('Cambiar', extra=' data-alterna="oc-norte"') + txt('Usar la general', extra=' data-guarda data-texto="Ahora usa tu duración general"'), cls='ac-envuelve')
                + otra_cons('Hosp Norte', 'oc-norte'))
    cada_inv = (fila('Rehab', '', txt('Otra duración en este consultorio', extra=' data-alterna="oc-rehab"'), no='oc-rehab', cls='ac-envuelve') + otra_cons('Rehab', 'oc-rehab'))
    pie_cons = 'Si en algún consultorio tu consulta dura distinto, cámbiala solo ahí.'
    c += grupo('En cada consultorio', 'pin', cada_adm, pie=pie_cons, ver='adm', no='sindur')
    c += grupo('En cada consultorio', 'pin', cada_inv, pie=pie_cons, ver='inv', no='sindur')
    # Otros tipos de cita
    ed = lambda n: txt('Editar', extra=f' data-alterna="ed-{n}" aria-label="Editar {n}"')
    qu = lambda n: txt('Quitar', extra=f' data-quita aria-label="Quitar {n}"', rojo=True)
    otros_adm = (fila('Primera vez', color=True, sub='60 minutos', acciones=ed('Primera vez') + qu('Primera vez'), no='ed-Primera vez')
                 + form_tipo('Guardar', para=False, nombre='Primera vez', dur='60', estado='ed-Primera vez', si='ed-Primera vez')
                 + fila('Curación', color=True, sub='20 minutos · Toda la clínica', acciones=ed('Curación') + qu('Curación'))
                 + fila('Consulta', color=True, sub='45 minutos · Duración de la consulta · Dra. Invitada Semilla', acciones=ed('Consulta') + qu('Consulta'), cls='ac-envuelve')
                 + acc('Agregar tipo de cita', chev=False, icono='plus', extra=' data-alterna="agregar"', no='agregar')
                 + form_tipo('Agregar', estado='agregar', si='agregar')
                 + acc('Quitados (1)', cls='ac-gris', extra=' data-plega="q-adm" aria-expanded="false"')
                 + f'<div data-plegado="q-adm" hidden class="ac-sinlinea">{fila("Revisión de estudios", "15 minutos", color=True, acciones= txt("Reactivar", extra=" data-guarda aria-label=\"Reactivar Revisión de estudios\""))}</div>')
    otros_inv = (fila('Primera vez', color=True, sub='60 minutos', acciones=ed('Primera vez') + qu('Primera vez'))
                 + acc('Agregar tipo de cita', chev=False, icono='plus', extra=' data-alterna="agregar"', no='agregar')
                 + form_tipo('Agregar', para=False, estado='agregar', si='agregar')
                 + nota('Solo el médico administrador puede cambiar estas opciones.')
                 + fila('Consulta', color=True, sub='30 minutos · Duración de la consulta · Dr. Admin Semilla', cls='ac-sinlinea')
                 + fila('Consulta', color=True, sub='45 minutos · Duración de la consulta · Dr. Admin Semilla')
                 + fila('Curación', color=True, sub='20 minutos · Toda la clínica'))
    otros_sec = (fila('Consulta', color=True, sub='30 minutos · Duración de la consulta · Dr. Admin Semilla')
                 + fila('Consulta', color=True, sub='45 minutos · Duración de la consulta · Dr. Admin Semilla')
                 + fila('Consulta', color=True, sub='45 minutos · Duración de la consulta · Dra. Invitada Semilla')
                 + fila('Primera vez', color=True, sub='60 minutos · Dr. Admin Semilla')
                 + fila('Curación', color=True, sub='20 minutos · Toda la clínica'))
    pie_o = 'Si también das citas de otra duración, como primera vez o curación, agrégalas. El paciente elige cuál al apartar.'
    c += grupo('Otros tipos de cita', 'lista', otros_adm, pie=pie_o, ver='adm')
    c += grupo('Otros tipos de cita', 'lista', otros_inv, pie=pie_o, ver='inv')
    c += grupo('Otros tipos de cita', 'lista', otros_sec, pie=pie_o, ver='sec')
    c += '</div>'
    return cabecera('consulta') + c, ''

FICHA2 = '''<h3>Especificación · Tu consulta / Tipos de cita</h3>
<p>La duración es LA decisión de esta pestaña: va primero, sin rótulo, con la frase de hoy encima («Tu consulta dura <b>30 minutos</b>. Con esto sabemos cuántas citas caben en tu día.») y un segmentado de cinco (15 · 20 · 30 · 45 · 60 min) que <b>se guarda al pulsar</b> (aviso «Guardado»). Hoy son cinco botones de 52 px con borde en dos filas.</p>
<table><thead><tr><th></th><th>ext / tel</th><th>ih / esc</th><th>iv</th></tr></thead><tbody>
<tr><th>Segmentado</th><td>38 alto (área 44), 14/600</td><td>32 alto (área 36), 13/600</td><td>38 (44)</td></tr>
<tr><th>Formulario de tipo</th><td>campos apilados, 44 alto, letra 16</td><td>dos columnas, 36 alto</td><td>dos columnas, 44 alto, letra 16</td></tr>
<tr><th>Filas de tipo</th><td colspan="3">título 15/600 + «60 minutos · ámbito» 13 --tinta2; «Editar» (azul) y «Quitar» (rojo) como acciones de texto; en teléfono, si el ámbito es largo, las acciones bajan a su línea</td></tr>
</tbody></table>
<h4>Funciones (todas las de hoy)</h4>
<ul><li>«Otra duración» → «Mi consulta dura [ ] minutos» con «Guardar» y «Cancelar» (5–600, de 5 en 5).</li>
<li>«En cada consultorio» (solo con duración ya elegida): «Otra duración en este consultorio» → «¿Cuánto dura la consulta en Centro?» con 30 min · 45 min · 1 hora · Otra (campo de minutos), «Guardar», «Cancelar», error «Elige una duración». Con duración propia: «Aquí la consulta dura <b>45 min</b> (en los demás, 30 min)» + «Cambiar» y «Usar la general». Avisos de hoy: «Duración del consultorio guardada», «Ahora usa tu duración general».</li>
<li>Cada tipo enseña su COLOR (CALMA §29.10): punto de 12 px a la izquierda del nombre con el tono de evento (<code>--cal-ev-*</code>, con su oscuro), <code>role=img</code> y <code>aria-label</code> «Color: Índigo»; sin color, aro vacío «Sin color». El formulario conserva el selector «Color» de hoy.</li>
<li>«Otros tipos de cita»: «Editar» abre el formulario en su sitio (Nombre, Duración (min), Color; «Guardar», «Cancelar»); «Quitar» lo pasa a «Quitados (N)», que se despliega y ofrece «Reactivar»; «Agregar tipo de cita» → Nombre, Duración (min), Color, Para (solo quien administra: «Toda la clínica» o un médico), «Agregar», «Cancelar».</li>
<li>Sin duración: «Aún no elegiste cuánto dura tu consulta. …» y no sale «En cada consultorio». Fallo: «No se pudieron leer los tipos de cita. Recarga la página.».</li></ul>
<h4>Permisos</h4><ul><li><b>Administrador</b>: cambia todos los tipos. <b>Médico invitado</b>: sus tipos primero, luego la nota «Solo el médico administrador puede cambiar estas opciones.» y los de los demás sin acciones. <b>Secretaria</b>: título «Tipos de cita», la frase «La duración de la consulta de cada médico y los demás tipos de cita de la clínica.», la nota «Cada médico cambia sus tipos de cita.» y todo en lectura.</li></ul>
<h4>Botones</h4><p>El formulario abierto lleva el único botón relleno de la pantalla («Agregar» / «Guardar»); «Guardar» de las duraciones es tonal. Errores del servidor: aviso rojo con el motivo («No se pudo guardar la duración», «No se pudo guardar el tipo de cita»).</p>'''

TIRA2 = TIRA_ROL + ['|', ('sin duración elegida', 'est:sindur', False), ('fallo al leer', 'est:errtipos', False), ('otra duración abierta', 'est:otra', False),
                    ('agregar tipo abierto', 'est:agregar', False), ('editar «Primera vez»', 'est:ed-Primera vez', False), ('otra duración en Centro', 'est:oc-centro', False),
                    ('falta elegir duración', 'est:errdur', False), '|'] + TIRA_AVISOS('No se pudo guardar el tipo de cita')

# ================================================================== VISTA 3 · TU ENLACE ==================================================================
URL_FIJO = 'https://semilla.spinus.test/reservar/Hz3vQp9LmT2xWc7RbN4kYa'
URL_UNA = 'https://semilla.spinus.test/reservar/Wm5tPq2ZrX8vLc3NbK7dHe'
URL_OTRO = 'https://semilla.spinus.test/reservar/Ys6nBd4QkR1uVe8JmT3pXo'
MSJ_REVOCAR = ('¿Apagarlo?', 'El enlace dejará de funcionar para siempre, también para quien ya lo tenga. Las citas que ya se reservaron con él no cambian.')
MSJ_REGENERAR = ('¿Cambiarlo?', 'Se crea un enlace nuevo y el anterior deja de funcionar: quien lo tenga guardado ya no podrá apartar con él.')

def bloque_medico(nombre, key, rol_contesta):
    """BloqueEnlacesMedico: la ficha de un médico (la ven el administrador y la secretaria)."""
    falta = (f'<div class="ac-bq" data-si="completar-{key}"><div class="ag0-aviso ag0-av-g ac-vis" role="note" aria-label="Falta para que el enlace abra" style="flex-direction:column;align-items:stretch;gap:8px">'
             f'<p style="font-weight:600">Para que el enlace abra, falta:</p><p>La duración de la consulta.</p>'
             f'<div data-ver="{rol_contesta}" style="display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:10px;background:var(--sup);color:var(--tinta)">'
             f'<span class="ac-campo">¿Cuánto dura su consulta?</span>{seg([("30", "30 min"), ("45", "45 min"), ("60", "1 hora"), ("otra", "Otra")], "", extra=" data-otra aria-label=\"¿Cuánto dura su consulta?\"")}'
             f'<label class="ac-frase" data-otra-campo hidden style="padding:0;min-height:44px"><span class="ac-cv"><input class="ac-in ac-num" type="number" min="5" max="600" step="5" aria-label="Minutos">minutos</span></label>'
             f'<div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-guarda data-texto="Duración de la consulta guardada" data-tras="-completar-{key} -motivos-{key}">Guardar</button></div></div>'
             f'<p data-ver="sec">El médico la contesta en su configuración.</p></div></div>')
    avl = f'<p class="ac-avl" data-si="motivos-{key}">{ic(I["tri"], 16, 2)}<span>No abrirá: falta la duración de la consulta del médico.</span></p>'
    chip_fijo = chip('Activo', 'ok', 'palomita', no=f'motivos-{key}') + chip('No abrirá', 'ag', 'tri', si=f'motivos-{key}')
    mas = (f'<button type="button" class="ag0-p ac-ico" aria-label="Más acciones del enlace fijo de {nombre}" aria-haspopup="menu" data-abre="menu-{key}">{ic(I["mas"], 20, 3)}</button>')
    fijo = (f'<div class="ac-li ac-envuelve" role="group" aria-label="Enlace fijo de {nombre}" data-no="sinfijo-{key}"><span class="ac-lt"><span class="ac-l1"><b>Enlace fijo</b>{chip_fijo}</span>'
            f'<small>desde el 3 nov 2026, 10:15</small>{avl}</span>'
            f'<span class="ac-la">{txt("Completar", extra=f" data-alterna=\"completar-{key}\" aria-label=\"Completar Enlace fijo\"", si=f"motivos-{key}")}'
            f'{txt("Mostrar enlace", extra=f" data-alterna=\"mostrado-{key}\" aria-label=\"Mostrar Enlace fijo\"", no=f"mostrado-{key}")}{mas}</span></div>'
            f'<div class="ac-bq ac-sinlinea" data-si="mostrado-{key}" data-no="sinfijo-{key}" style="flex-direction:row;align-items:center;padding-top:0">'
            f'<input class="ac-in" readonly value="{URL_OTRO}" aria-label="Dirección de Enlace fijo" style="flex:1">'
            f'<button type="button" class="ag0-p ac-ton" data-copia><span>Copiar</span></button></div>')
    sinfijo = (f'<div class="ac-bq" data-si="sinfijo-{key}"><p class="ac-ayuda">Aún no hay enlace fijo: se comparte una vez y sirve siempre.</p>'
               f'<div class="ac-bts">{txt("Ver qué falta", extra=f" data-alterna=\"completar-{key}\"", si=f"motivos-{key}")}'
               f'<button type="button" class="ag0-p ac-ton" data-guarda data-tras="-sinfijo-{key}">Crear enlace fijo</button></div></div>')
    unico = fila('Un solo uso · Paciente Prueba 12', 'caduca el 24 nov 2026, 09:00',
                 txt('Mostrar enlace', extra=f' data-alterna="mostradou-{key}" aria-label="Mostrar Un solo uso · Paciente Prueba 12"', no=f'mostradou-{key}') + txt('Revocar', extra=' data-abre="al-revocar" aria-haspopup="dialog" aria-label="Revocar Un solo uso · Paciente Prueba 12"', rojo=True),
                 l1extra=chip('Sin usar', 'ok', 'palomita', no=f'motivos-{key}') + chip('No abrirá', 'ag', 'tri', si=f'motivos-{key}'), cls='ac-envuelve')
    unico += (f'<div class="ac-bq ac-sinlinea" data-si="mostradou-{key}" style="flex-direction:row;align-items:center;padding-top:0">'
              f'<input class="ac-in" readonly value="https://semilla.spinus.test/reservar/Pk8sLw3TnV6qRc1ZyH5mBa" aria-label="Dirección de Un solo uso · Paciente Prueba 12" style="flex:1">'
              f'<button type="button" class="ag0-p ac-ton" data-copia><span>Copiar</span></button></div>')
    form = (f'<div class="ac-bq"><div class="ac-campos">'
            f'<label class="ac-campo">Etiqueta (opcional)<input class="ac-in" maxlength="60" placeholder="Para uso interno"></label>'
            f'<label class="ac-campo">Correo del paciente (opcional)<input class="ac-in" type="email" autocomplete="off" maxlength="254"></label></div>'
            f'<div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-guarda data-dis="sinsecreto">Emitir enlace de un solo uso</button></div>'
            f'<p class="ac-ayuda">Uno de un solo uso vale 7 días y una sola reserva.</p>'
            f'<p class="ac-ayuda">El comprobante y los avisos de la cita irán sólo a este correo; sin él, no se manda ninguno.</p></div>')
    return grupo(nombre, 'medico', falta + fijo + sinfijo + unico + form)

def menu_fijo(vp, key, nombre):
    sep = '<div class="ag0-sep" role="separator"></div>'
    ops = (f'<button type="button" class="ag0-p ag0-op" role="menuitem" data-abre="al-cambiar">{ic(I["convertir"], 20, 2)}<span>Regenerar</span></button>{sep}'
           f'<button type="button" class="ag0-p ag0-op ag0-op-mal" role="menuitem" data-abre="al-revocar">{ic(I["papelera"], 20, 2)}<span>Revocar</span></button>')
    anc = ' ag0-anc' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    cab = '' if vp == 'esc' else f'<div class="ag0-cjc"><h2>Enlace fijo</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>'
    w = '' if vp in ('esc', 'tel', 'ext') else ' style="width:340px"'
    return f'''<div class="ag0-capa{velo}" data-capa="menu-{key}" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj{anc}"{w} role="menu" aria-label="Más acciones del enlace fijo de {nombre}"><span class="ag0-asa" aria-hidden="true"></span>{cab}<div class="ag0-cj-in">{ops}</div></div>
</div>'''

def vista3(vp):
    c = intro('Quien lo abra puede apartar cita en tus horas libres. Es el mismo para todos.', 'Tu enlace', ver='adm inv')
    c += intro('Cada médico tiene el suyo. Quien lo abra puede apartar cita en sus horas libres.', 'Enlaces de los médicos', ver='sec')
    c += '<p class="ac-intro" data-si="errlista">No se pudieron leer los enlaces. Recarga la página.</p>'
    c += ambar('La reserva por enlace no está configurada en este servidor: no se pueden crear enlaces.', si='sinsecreto', no='errlista')
    c += ambar('Ningún enlace abre todavía: el aviso de privacidad de la reserva está pendiente de revisión.', si='pendiente', no='sinsecreto errlista')
    c += ambar('No abrirá: falta la duración de la consulta del médico.', ver='adm inv', si='motivos', no='errlista')
    c += '<div class="ac-panel" data-no="errlista">'
    # Tu enlace (fijo)
    fijo = (swf('Prendido: tus pacientes pueden apartar con él', '', True, t_off='Apagado: nadie puede apartar con él', est='apagado', extra=' data-dis="sinsecreto"')
            + f'<div class="ac-dir" data-no="apagado">{URL_FIJO.replace('/', '/<wbr>').replace('/<wbr>/<wbr>', '//<wbr>')}</div>'
            + f'<div class="ac-bq" data-no="apagado"><div class="ac-bts"><button type="button" class="ag0-p ac-prim" data-copia>{ic(I["copiar"], 18, 2)}<span>Copiar enlace</span></button>'
            + f'<a href="#" class="ag0-p ac-ton">{ic(I["whatsapp"], 18, 2)}Mandar por WhatsApp</a></div></div>')
    c += grupo('Tu enlace', 'enlace', fijo, pie='', ver='adm inv')
    c += '<p class="ac-pie" data-ver="adm inv" data-si="apagado" data-enlace-pausado style="margin-top:-16px">Al prenderlo vuelve a servir la misma dirección que ya compartiste.</p>'
    # Enlaces de una vez
    crear = (f'<div class="ac-bq" data-si="crear" data-no="creado"><div class="ac-campos">'
             f'<label class="ac-campo">¿Para quién es? (solo lo ves tú)<input class="ac-in" maxlength="60" placeholder="Ej.: Sra. López, revisión"></label>'
             f'<label class="ac-campo">Correo del paciente (opcional)<input class="ac-in" type="email" autocomplete="off" maxlength="254"></label></div>'
             f'<p class="ac-ayuda">El comprobante y los avisos de la cita irán sólo a este correo; sin él, no se manda ninguno.</p>'
             f'{err("No se pudo crear el enlace", si="errcrear")}'
             f'<div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-alterna="creado">Crear enlace de una vez</button>'
             f'<button type="button" class="ag0-p ac-txt" data-alterna="-crear">Cancelar</button></div></div>')
    creado = (f'<div class="ac-dir" data-si="creado" data-enlace-una-vez>{URL_UNA.replace('/', '/<wbr>').replace('/<wbr>/<wbr>', '//<wbr>')}</div>'
              f'<div class="ac-bq" data-si="creado"><div class="ac-bts"><button type="button" class="ag0-p ac-ton" data-copia aria-label="Copiar el enlace de una vez">{ic(I["copiar"], 18, 2)}<span>Copiar</span></button></div></div>')
    unicos = fila('Paciente Prueba 26', 'Sin usar · deja de servir el 27 nov',
                  txt('Copiar', extra=' data-copia aria-label="Copiar el enlace de Paciente Prueba 26"') + txt('Apagar', extra=' data-abre="al-apagar" aria-haspopup="dialog" aria-label="Apagar el enlace de Paciente Prueba 26"', rojo=True), cls='ac-envuelve')
    c += grupo('Enlaces de una vez', 'boleto',
               creado + crear + unicos
               + acc('Crear uno', chev=False, icono='plus', extra=' data-alterna="crear" data-dis="sinsecreto"', no='crear creado')
               + acc('Crear otro', chev=False, icono='plus', extra=' data-alterna="-creado"', si='creado'),
               pie='Para un solo paciente. Sirve para una cita y deja de funcionar en 7 días.', ver='adm inv')
    # ¿Tu enlace llegó a quien no debía?
    c += tarjeta('<div class="ac-bq"><span class="ac-bq-t">¿Tu enlace llegó a quien no debía?</span><p class="ac-ayuda">Cámbialo por uno nuevo. El de antes deja de servir y tendrás que volver a compartirlo.</p></div>'
                 + acc('Cambiar por uno nuevo', cls='ac-rojo', chev=False, extra=' data-abre="al-cambiar" aria-haspopup="dialog"'), ver='adm inv')
    # Los de los demás médicos
    c += f'<div data-ver="sec">{bloque_medico("Dr. Admin Semilla", "adm", "adm")}</div>'
    c += (f'<div data-ver="adm sec" style="display:flex;flex-direction:column;gap:12px">'
          f'<button type="button" class="ag0-p ac-txt" style="align-self:flex-start;margin-left:8px" data-plega="otros" aria-expanded="false">{CHEV.replace("ac-chev", "ac-chev ac-chevp")}Enlaces de los demás médicos (1)</button>'
          f'<div data-plegado="otros" hidden>{bloque_medico("Dra. Invitada Semilla", "inv", "adm")}</div></div>')
    c += '</div>'
    capas = (alerta('al-apagar', 'papelera', 'mal', MSJ_REVOCAR[0], MSJ_REVOCAR[1], 'Cancelar', 'Aceptar', 'ac-pel', prim_extra=' data-guarda')
             + alerta('al-revocar', 'papelera', 'mal', MSJ_REVOCAR[0], MSJ_REVOCAR[1], 'Cancelar', 'Aceptar', 'ac-pel', prim_extra=' data-guarda')
             + alerta('al-cambiar', 'convertir', 'ag', MSJ_REGENERAR[0], MSJ_REGENERAR[1], 'Cancelar', 'Aceptar', 'ac-prim', prim_extra=' data-guarda')
             + menu_fijo(vp, 'adm', 'Dr. Admin Semilla') + menu_fijo(vp, 'inv', 'Dra. Invitada Semilla'))
    return cabecera('enlace') + c, capas

FICHA3 = '''<h3>Especificación · Tu enlace / Enlaces</h3>
<p>LA acción de la pantalla es copiar el enlace: «Copiar enlace» es el único botón relleno; «Mandar por WhatsApp» es tonal. La dirección va en letra de máquina, sin caja dentro de la caja.</p>
<table><thead><tr><th>Bloque</th><th>Qué lleva (textos de hoy)</th></tr></thead><tbody>
<tr><th>Avisos ámbar arriba</th><td>«Ningún enlace abre todavía: el aviso de privacidad de la reserva está pendiente de revisión.» (hoy SIEMPRE en producción: la reserva no abre mientras el aviso tenga la marca de pendiente) · «La reserva por enlace no está configurada en este servidor: no se pueden crear enlaces.» · el motivo de su propio enlace («No abrirá: …» / «Abrirá sin horarios: …»). Pieza <code>.ag0-aviso</code> de las piezas base.</td></tr>
<tr><th>Tu enlace</th><td>Fila-interruptor con el estado como título: «Prendido: tus pacientes pueden apartar con él» / «Apagado: nadie puede apartar con él». Apagar PAUSA (sin confirmación); de pie, «Al prenderlo vuelve a servir la misma dirección que ya compartiste.». Prendido: dirección, «Copiar enlace» → «Copiado» (o «No se pudo copiar»), «Mandar por WhatsApp». «Cargando la dirección…» mientras llega el código (sistema).</td></tr>
<tr><th>Enlaces de una vez</th><td>De pie, «Para un solo paciente. Sirve para una cita y deja de funcionar en 7 días.». Fila «Crear uno» (con +) → «¿Para quién es? (solo lo ves tú)», «Correo del paciente (opcional)», su ayuda, «Crear enlace de una vez» («Creando…»), «Cancelar». Creado: dirección + «Copiar», y la fila pasa a «Crear otro». Lista: nombre · «Sin usar · deja de servir el 27 nov» · «Copiar» · «Apagar» (rojo) → alerta.</td></tr>
<tr><th>¿Tu enlace llegó a quien no debía?</th><td>Frase + «Cambiar por uno nuevo» (fila roja) → alerta. Solo si hay enlace fijo.</td></tr>
<tr><th>Enlaces de los demás médicos (N)</th><td>Plegado (administrador y secretaria). Por médico: «Enlace fijo» · «desde el 3 nov 2026, 10:15» · etiqueta Activo / No abrirá · aviso «No abrirá: …» · «Completar» (abre «Para que el enlace abra, falta:» con «¿Cuánto dura su consulta?»; a la secretaria «El médico la contesta en su configuración.») · «Mostrar enlace» (→ dirección + «Copiar») · «···» con «Regenerar» y «Revocar» (rojo). Un solo uso: «Mostrar enlace», «Revocar». Sin fijo: «Aún no hay enlace fijo: se comparte una vez y sirve siempre.» + «Ver qué falta» + «Crear enlace fijo». Formulario: «Etiqueta (opcional)», «Correo del paciente (opcional)», «Emitir enlace de un solo uso» y sus dos ayudas. La secretaria ve abierta la ficha de los administradores.</td></tr>
</tbody></table>
<h4>Alertas (ConfirmModal de hoy)</h4><p>Mismo texto, repartido en el patrón único: la pregunta final como título («¿Apagarlo?», «¿Cambiarlo?») y el resto como mensaje; «Cancelar» (quieto) · «Aceptar» (rojo suave al apagar/revocar, azul al cambiar). 320 en iPhone (centrada, no hoja), 310 en Duo cerrado, 340 en ancho; icono 28 en círculo de 48. Hoy: tarjeta blanca fija sin título, sin variante oscura.</p>
<h4>Menú «···»</h4><p>En computadora nace de su botón sin velo (288); en Duo y teléfono, tarjeta centrada con velo / hoja con asa. Opciones 48 (40 en computadora), icono 20 en --enlace, destructiva roja tras una línea.</p>
<h4>Permisos</h4><ul><li><b>Administrador</b>: su enlace + los de los demás plegados. <b>Médico invitado</b>: solo el suyo. <b>Secretaria</b>: no tiene enlace propio; título «Enlaces de los médicos» y frase «Cada médico tiene el suyo. Quien lo abra puede apartar cita en sus horas libres.».</li></ul>
<h4>Guardado</h4><p>Todo se guarda al momento con aviso «Guardado»; errores de hoy: «No se pudo crear el enlace», «No se pudo apagar el enlace», «No se pudo prender el enlace», «No se pudo leer el enlace», «Esta opción todavía no está disponible en este servidor».</p>'''

TIRA3 = TIRA_ROL + ['|', ('aviso de privacidad pendiente', 'est:pendiente', True), ('reserva sin configurar', 'est:sinsecreto', False), ('mi enlace no abrirá', 'est:motivos', False),
                    ('fallo al leer', 'est:errlista', False), ('enlace apagado', 'est:apagado', False), ('crear de una vez', 'est:crear', False),
                    ('de una vez creado', 'est:creado', False), ('error al crear', 'est:errcrear', False), '|',
                    ('demás médicos: no abrirá', 'est:motivos-inv', False), ('…y «Completar»', 'est:completar-inv', False), ('…enlace mostrado', 'est:mostrado-inv', False), ('…sin enlace fijo', 'est:sinfijo-inv', False), '|',
                    ('alerta «¿Apagarlo?»', 'capa:al-apagar'), ('alerta «¿Cambiarlo?»', 'capa:al-cambiar'), ('menú «···» (demás médicos)', 'capa:menu-inv'), '|'] + TIRA_AVISOS('No se pudo crear el enlace')

# ================================================================== VISTA 4 · AVISOS ==================================================================
def vista4(vp):
    c = intro('Prende o apaga cada uno. El cambio cuenta desde ahora.', 'Avisos por correo')
    c += nota('Solo el médico administrador puede cambiar estas opciones.', ver='inv sec')
    c += '<div class="ac-panel">'
    nd = '<span data-si="nodisp"> No disponible en este servidor.</span>'
    rec_opts = ['2 horas', '12 horas', '1 día (24 horas)', '2 días (48 horas)']
    cuerpo = ''
    for rol, dis in (('adm', ''), ('inv sec', ' disabled')):
        cuerpo += swf('Recordarle su cita al paciente', 'Le llega un correo antes de su cita. Solo a pacientes que tengan correo.' + nd, True, est='recapagado',
                      extra=dis + (' data-dis="nodisp"' if not dis else ''), ver=rol)
        cuerpo += (f'<label class="ac-frase ac-dep ac-sinlinea"{at(ver=rol, no="recapagado nodisp")}><span>Mandarlo</span><span class="ac-cv">'
                   f'{seleccion(rec_opts, "1 día (24 horas)", extra=" data-guarda-sel" + dis)}antes de la cita</span></label>')
    cuerpo += swf('Avisarme cuando alguien aparte cita', 'Te llega un correo cada vez que un paciente aparta o cambia su cita con tu enlace.' + nd, False, extra=' data-dis="nodisp"', ver='adm')
    cuerpo += swf('Avisar a la clínica cuando alguien aparte cita', 'A quien administra la clínica le llega un correo cada vez que un paciente aparta o cambia su cita con un enlace.' + nd, False, extra=' disabled', ver='inv sec')
    c += grupo('Avisos por correo', 'correo', cuerpo)
    plazos = ''
    for rol, dis in (('adm', ''), ('inv sec', ' disabled')):
        for antes, despues, v, mn, mx, nom, uni in (('Pueden ver horarios de los próximos', 'días', 60, 1, 365, 'Hasta cuándo se puede reservar', 'días adelante'),
                                                   ('No pueden apartar si faltan menos de', 'horas', 2, 0, 72, 'Anticipación mínima para reservar por enlace', 'horas'),
                                                   ('Un enlace de una vez deja de servir a los', 'días', 7, 1, 30, 'Vigencia del enlace de un solo uso', 'días')):
            plazos += (f'<label class="ac-frase"{at(ver=rol, no="sinplazos")}><span>{antes}</span><span class="ac-cv"><input class="ac-in ac-num" type="number" inputmode="numeric" min="{mn}" max="{mx}" value="{v}"'
                       f' data-plazo data-nombre="{nom}" data-unidad="{uni}"{dis}>{despues}</span></label>')
    plazos += '<div class="ac-bq" data-plazo-err hidden><p class="ac-err" role="alert">' + ic(I['tri'], 16, 2) + '<span></span></p></div>'
    plazos += '<div class="ac-bq" data-si="invalido" data-no="sinplazos">' + err('Hasta cuándo se puede reservar: de 1 a 365 días adelante') + '</div>'
    plazos += '<p class="ac-vacio" data-si="sinplazos">No se pudieron leer los plazos de la clínica. Recarga la página.</p>'
    c += grupo('Hasta cuándo pueden apartar', 'calreloj', plazos, pie='Esto cambia para todos los médicos de la clínica.')
    c += '</div>'
    return cabecera('avisos') + c, ''

FICHA4 = '''<h3>Especificación · Avisos</h3>
<p>Dos grupos: «Avisos por correo» (el título del panel de hoy, como rótulo con icono de sobre) con dos filas-interruptor, y «Hasta cuándo pueden apartar» con los tres plazos como frases con su número. La fila entera conmuta (área 44+); el dibujo es el interruptor de las piezas base (40×24). <b>Hoy no hay avisos por WhatsApp en la configuración</b>: WhatsApp solo aparece en «Mandar por WhatsApp» del enlace y en la confirmación de la cita (fuera de esta pantalla).</p>
<table><thead><tr><th>Fila</th><th>Textos de hoy</th><th>Comportamiento</th></tr></thead><tbody>
<tr><th>Recordatorio</th><td>«Recordarle su cita al paciente» · «Le llega un correo antes de su cita. Solo a pacientes que tengan correo.» · «Mandarlo [2 horas · 12 horas · 1 día (24 horas) · 2 días (48 horas)] antes de la cita»</td><td>Se guarda al pulsar (optimista; si el servidor dice que no, vuelve y sale el error). El selector, al cambiar. Un valor que no es de los cuatro (p. ej. 6 horas) entra como opción más.</td></tr>
<tr><th>Aviso a la clínica</th><td>Administrador: «Avisarme cuando alguien aparte cita» · «Te llega un correo cada vez que un paciente aparta o cambia su cita con tu enlace.». Los demás: «Avisar a la clínica cuando alguien aparte cita» · «A quien administra la clínica le llega un correo cada vez que un paciente aparta o cambia su cita con un enlace.»</td><td>Igual. Sin la columna en la base: «No disponible en este servidor.» y apagado.</td></tr>
<tr><th>Plazos</th><td>«Pueden ver horarios de los próximos [60] días» · «No pueden apartar si faltan menos de [2] horas» · «Un enlace de una vez deja de servir a los [7] días» · pie «Esto cambia para todos los médicos de la clínica.»</td><td>Se guardan juntos al salir del campo o 700 ms después de la última tecla, un envío a la vez. Validación en vivo con el texto del esquema («Hasta cuándo se puede reservar: de 1 a 365 días adelante», «…: escribe un número»). Fallo de lectura: «No se pudieron leer los plazos de la clínica. Recarga la página.».</td></tr>
</tbody></table>
<h4>Por marco</h4><p>Teléfono: frase arriba y número + unidad a la derecha (si no cabe, baja); campo de 76×44 con letra 16. Ancho: misma fila, campo 76×36 (letra 15). Interruptor siempre a la derecha, alineado con el título.</p>
<h4>Permisos</h4><p>Solo quien administra la clínica cambia esto: médico invitado y secretaria ven la nota «Solo el médico administrador puede cambiar estas opciones.» AL PRINCIPIO (como hoy) y todo deshabilitado con su valor vigente (no escondido).</p>
<h4>Guardado</h4><p>Aviso breve «Guardado» / rojo con el motivo («No se pudo guardar el aviso», «No se pudieron guardar los ajustes», «Esta opción todavía no está disponible en este servidor»).</p>'''

TIRA4 = TIRA_ROL + ['|', ('recordatorio apagado', 'est:recapagado', False), ('no disponible en este servidor', 'est:nodisp', False), ('plazo inválido', 'est:invalido', False),
                    ('plazos sin leer', 'est:sinplazos', False), '|'] + TIRA_AVISOS('No se pudieron guardar los ajustes')

# ================================================================== VISTA 5 · MÁS OPCIONES ==================================================================
def vista5(vp):
    contactos = ''
    for nom, tel, cor, mot in (('Paciente Prueba 14', '999 000 0014', 'paciente14@semilla.spinus.test', '2 cancelaciones · 1 inasistencia · se levanta solo el 19 feb 2027'),
                               ('Paciente Prueba 21', '999 000 0021', '', 'Bloqueado a mano')):
        datos = ' · '.join(x for x in (tel, cor) if x)
        sub = (f'<span data-ver="adm inv">{datos}</span><span data-ver="sec">{datos} · Dr. Admin Semilla</span><br>{mot}')
        contactos += fila(nom, sub, txt('Desbloquear', extra=f' data-quita aria-label="Desbloquear a {nom}"'), no='vacia errbloq', cls='ac-envuelve')
    contactos += '<p class="ac-vacio" data-si="vacia" data-no="errbloq">Nadie está bloqueado.</p>'
    contactos += '<p class="ac-vacio" data-si="errbloq">No se pudo leer la lista. Recarga la página.</p>'
    ahora = '<span data-no="vacia errbloq">2</span><span data-si="vacia" data-no="errbloq">ninguno</span><span data-si="errbloq">no se pudo leer</span>'
    bloq = (f'<button type="button" class="ag0-p ac-nav" data-plega="bloq" aria-expanded="false">{ic(I["bloq"], 22, 2)}<span class="ac-lt"><b>Personas bloqueadas</b>'
            f'<small>Teléfonos o correos que no pueden apartar cita con tu enlace. Ahora: {ahora}.</small></span>{CHEV}</button>'
            f'<div data-plegado="bloq" hidden class="ac-sinlinea">{contactos}</div>')
    emp = (f'<button type="button" class="ag0-p ac-nav ac-rojo" data-abre="restablecer" aria-haspopup="dialog" data-ver="adm">{ic(I["reinicia"], 22, 2)}<span class="ac-lt"><b>Empezar de nuevo</b>'
           f'<small>Regresa todo a como venía y vuelve a hacer las 3 preguntas. Tus citas no se borran.</small></span>{CHEV}</button>')
    emp_no = (f'<div data-ver="inv sec" data-empezar-sin-permiso>{nota("Solo el médico administrador puede cambiar estas opciones.").replace("<p ", "<p style=\"margin:12px 16px 0\" ", 1)}'
              f'<div class="ac-nav ac-quieta">{ic(I["reinicia"], 22, 2)}<span class="ac-lt"><b>Empezar de nuevo</b>'
              f'<small>Regresa todo a como venía y vuelve a hacer las 3 preguntas. Tus citas no se borran.</small></span></div></div>')
    c = '<h2 class="ac-sr">Más opciones</h2><div class="ac-panel">' + tarjeta(bloq + emp + emp_no) + '</div>'
    lst = ''.join(f'<li>{x}</li>' for x in ('El horario de cada consultorio vuelve al de partida: el horario de la clínica, copiado a cada consultorio.',
                                             'La duración de la consulta y los tipos de cita se archivan.',
                                             'Los plazos vuelven a sus valores de fábrica y el recordatorio por correo se apaga.',
                                             'Los enlaces de reserva se revocan.'))
    extra = (f'<ul class="ac-alst">{lst}</ul><p class="ac-amal">Los enlaces que ya compartiste con pacientes dejarán de funcionar.</p>'
             f'<p class="ac-atx">Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>'
             f'<label class="ac-campo">Para confirmar, escribe RESTABLECER<input class="ac-in ac-palabra" data-palabra autocomplete="off" spellcheck="false"></label>'
             f'{err("No se pudo restablecer la configuración", si="errrest")}')
    capas = alerta('restablecer', 'reinicia', 'mal', '¿Restablecer la configuración de la agenda?', '', 'Cancelar', 'Restablecer', 'ac-pel',
                   extra_cuerpo=extra, prim_extra=' data-rest disabled', ancho='ac-alerta ac-w440')
    return cabecera('mas') + c, capas

FICHA5 = '''<h3>Especificación · Más opciones</h3>
<p>Hoy esta pestaña tiene exactamente dos cosas y aquí siguen siendo dos filas de navegación en una sola tarjeta: «Personas bloqueadas» (despliega la lista en su sitio; flecha que gira) y «Empezar de nuevo» (rojo, abre la confirmación). Icono de 22 a la izquierda (azul / rojo), título 15/600, ayuda 13 --tinta2, «›» tenue. 64 px en teléfono, 60 en ancho.</p>
<h4>Qué NO vive aquí (comprobado en el código)</h4><ul><li><b>Google Calendar</b>: la conexión vive en Mi perfil → pestaña «Google Calendar» (ya aprobada en <code>perfil/</code>). La configuración de la agenda no la toca.</li>
<li><b>Encender la agenda v2</b>: no tiene control en pantalla; <code>agenda_v2_encendida</code> solo se cambia desde el editor SQL (el esquema de ajustes la rechaza). Apagada, esta página da 404.</li>
<li>«Esta computadora» se fue al engrane de la agenda (Opciones de la agenda).</li></ul>
<h4>Personas bloqueadas</h4><p>Ayuda «Teléfonos o correos que no pueden apartar cita con tu enlace. Ahora: 2.» («…», «ninguno», «no se pudo leer»). Cada contacto: nombre (o «Sin nombre»), teléfono · correo (· médico, para quien gestiona a todos), motivo («2 cancelaciones · 1 inasistencia · se levanta solo el 19 feb 2027» / «Bloqueado a mano») y «Desbloquear» → aviso «Guardado» o «No se pudo desbloquear». Vacía: «Nadie está bloqueado.». Fallo: «No se pudo leer la lista. Recarga la página.».</p>
<h4>Empezar de nuevo (solo quien administra)</h4><p>Alerta de patrón único, en modal de 440 (310 en Duo cerrado, hoja en iPhone no: tarjeta centrada) porque lleva campo: icono de reinicio en círculo rojo, «¿Restablecer la configuración de la agenda?», las cuatro consecuencias en lista, en rojo «Los enlaces que ya compartiste con pacientes dejarán de funcionar.», «Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.», «Para confirmar, escribe RESTABLECER» y el campo. «Restablecer» (rojo suave) solo se enciende con la palabra exacta; «Restableciendo…»; error en su sitio. Al terminar lleva al asistente de primera vez (ver «Asistente de primera vez» en esta misma página: Entrada y Paso 1).</p>
<h4>Permisos</h4><p>Médico invitado y secretaria: «Empezar de nuevo» sin flecha ni toque, en gris, con la nota «Solo el médico administrador puede cambiar estas opciones.» encima (no al principio de la pestaña, porque «Personas bloqueadas» sí la gestionan).</p>'''

TIRA5 = TIRA_ROL + ['|', ('lista vacía', 'est:vacia', False), ('lista sin leer', 'est:errbloq', False), '|',
                    ('«Empezar de nuevo»', 'capa:restablecer'), ('…con error', 'capa:restablecer|errrest'), '|'] + TIRA_AVISOS('No se pudo desbloquear')

# ------------------------------------------------------------------ SALIDA ------------------------------------------------------------------
CSS = open(f'{B}/tmp-nav.css').read() + '\n' + open(f'{B}/tmp-estilo.css').read().replace('(muestra; la completa la hace otro agente)', '(muestra)') + '\n' + open(f'{L}/tmp-ac-estilo.css').read()
JS = open(f'{L}/tmp-ac-guion.js').read()

VISTAS = [
    (1, 'horario', 'Agenda · Cuándo das consulta', 'Ajustes con el patrón de Mi perfil: pestañas de texto también en el teléfono, la clínica y cada consultorio como grupo con rótulo de color, «Cambiar horario» como fila azul, escala táctil en el Duo (hoy controles de 40 px y letra de 13) y el diálogo de días con validación en vivo', vista1, FICHA1, TIRA1, []),
    (2, 'consulta', 'Agenda · Tu consulta', 'La duración primero, en un segmentado que se guarda al pulsar; consultorios y tipos de cita como listas con acciones de texto; formularios en su sitio; los quitados plegados', vista2, FICHA2, TIRA2, []),
    (3, 'enlace', 'Agenda · Tu enlace', 'Copiar el enlace es la acción: único botón relleno; interruptor con el estado como título; enlaces de una vez y de los demás médicos como listas; alertas con el patrón único (la pregunta de hoy como título)', vista3, FICHA3, TIRA3, ['pendiente']),
    (4, 'avisos', 'Agenda · Avisos', 'Dos grupos limpios: interruptores en fila (toda la fila conmuta) y los plazos como frases con su número; nota de permisos al principio y todo en lectura para quien no administra', vista4, FICHA4, TIRA4, []),
    (5, 'mas', 'Agenda · Más opciones', 'Dos filas de navegación en una tarjeta («Personas bloqueadas» se despliega en su sitio; «Empezar de nuevo» en rojo) y la confirmación RESTABLECER como alerta del catálogo', vista5, FICHA5, TIRA5, []),
]

for n, nom, titulo, desc, fn, ficha, tira, est in VISTAS:
    marcos = []
    for vp in VPS:
        cont, capas = fn(vp)
        marcos.append(marco(n, vp, cont, capas))
    cfg = json.dumps({'v': n, 'ficha': ficha, 'tira': tira, 'est': est}, ensure_ascii=False)
    out = (f'<!-- NOMBRE: {titulo} | {desc} -->\n<style>\n{CSS}</style>\n'
           f'<!-- Estados de sistema no dibujados: «Cargando…» de la página entera (ConfiguracionAgenda.tsx:462) y los «…» / «Cargando…» de cada lista mientras llegan los datos. -->\n'
           + '\n'.join(marcos) + f'\n<script>\n(function(CFG){{\n{JS}\n}})({cfg});\n</script>\n')
    p = f'{L}/vista-{n}-{nom}.html'
    open(p, 'w').write(out)
    print(p, len(out))
