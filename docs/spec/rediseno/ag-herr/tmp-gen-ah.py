# Agenda · Herramientas de la barra (fase 2). Uso: python3 tmp-gen-ah.py → vista-1…5.html
# Construye ENCIMA de las piezas base aprobadas (copia congelada en tmp-base-*.{py,css}): misma barra, misma rejilla,
# mismas capas .ag0-capa. Lo nuevo lleva el prefijo .ah. Cada marco: class="marco ag0 ah ah-vN".
import os, json, html, re
AQUI = os.path.dirname(os.path.abspath(__file__))
exec(open(f'{AQUI}/tmp-base-gen.py').read())   # ic, I, gcal, sinexp, est, EST, CITAS, DIAS, HOY, barra, rejilla, marco, op, sw, capa_fecha, burbuja, capa_burbuja, TIT…
L = AQUI
exec(open(f'{L}/tmp-integra.py').read())   # piezas reales de ag-burbuja, ag-form y ag-ligado

I.update(
    panel_c='<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15.5 10l-2 2 2 2"/>',
    panel_a='<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M13.5 10l2 2-2 2"/>',
    tri='<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    hueco='<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/><path d="M3 3l3 3" stroke-dasharray="1 0"/>',
    chk='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    bandeja='<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>',
)
I['hueco'] = '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15h6M12 12v6"/>'

VPS = ('ext', 'tel', 'ih', 'iv', 'esc')
CSS = (open(f'{L}/tmp-base-nav.css').read() + '\n' + open(f'{L}/tmp-base-estilo.css').read() + '\n' + open(f'{L}/tmp-ah.css').read() + '\n' + CSS_INT)
CSS = re.sub(r'/\*.*?\*/', '', CSS, flags=re.S)   # sin comentarios: más ligero y sin notas de reparto
JS = open(f'{L}/tmp-ah.js').read() + '\n' + open(f'{L}/tmp-ah-integra.js').read()
X = lambda: f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>'
CHEV = ic(I['sig'], 16, 2.2)

def num(nom):
    return nom.split()[-1]

def pastel(nom):
    try: return f'ah-p{int(num(nom)) % 6}'
    except ValueError: return 'ah-p0'

def avn(nom):
    return f'<span class="ah-avn {pastel(nom)}" aria-hidden="true">{num(nom)}</span>'

# ------------------------------------------------------------------ PANEL DEL DÍA (copia de tmp-vistas.py: el fondo de computadora es el Día real) ------------------------------------------------------------------
def panel_dia():
    def tiles(c, e, o, l):
        return (f'<div class="ag0-tiles"><div class="ag0-tile"><b>{c}</b><span>citas</span></div><div class="ag0-tile"><b>{e}</b><span>eventos</span></div>'
                f'<div class="ag0-tile"><b>{o}</b><span>h ocupadas</span></div><div class="ag0-tile ag0-tile-p"><b>{l}</b><span>h libres</span></div></div>')
    des = [('ag', '3 agendadas'), ('conf', '2 confirmadas'), ('canc', '1 cancelada'), ('noas', '1 no asistió'), ('aten', '5 atendidas')]
    desg = '<ul class="ag0-des" aria-label="Por estado">' + ''.join(f'<li>{est(k, texto=False)}<span>{t}</span></li>' for k, t in des) + '</ul>'
    todo = '<p class="ag0-pnota">1 evento de todo el día, que no ocupa horas.</p>'
    res_n = f'<section class="ag0-pc ag0-pvn" aria-label="Resumen · Dr. Admin Semilla"><h2 class="ag0-pc-t">Resumen · Dr. Admin Semilla</h2>{tiles(12, 2, "6:35", "5:25")}{desg}{todo}</section>'
    res_m = f'<section class="ag0-pc ag0-pvm" aria-label="Resumen del día"><h2 class="ag0-pc-t">Resumen del día</h2>{tiles(19, 2, "—", "—")}<p class="ag0-pnota">Elige un médico para ver las horas y los huecos.</p></section>'
    res_h = f'<section class="ag0-pc ag0-pvh" aria-label="Resumen · Dr. Admin Semilla"><h2 class="ag0-pc-t">Resumen · Dr. Admin Semilla</h2>{tiles(0, 0, "—", "—")}<p class="ag0-pnota">Sin horario de consulta este día.</p></section>'
    hue_n, hue_h = huecos_piezas()
    hue_n = f'<section class="ag0-pc ag0-pvn" aria-label="Huecos disponibles"><h2 class="ag0-pc-t">Huecos disponibles</h2>{hue_n}</section>'
    hue_h = f'<section class="ag0-pc ag0-pvh" aria-label="Huecos disponibles"><h2 class="ag0-pc-t">Huecos disponibles</h2>{hue_h}</section>'
    nums = ''
    for n in (26, 27, 28, 29, 30, 31):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de octubre">{n}</button>'
    for n in range(1, 31):
        a2 = ' aria-current="date" aria-selected="true"' if n == 19 else ''
        nums += f'<button type="button" class="ag0-p" data-n="{n}"{a2} aria-label="{n} de noviembre de 2026">{n}</button>'
    for n in range(1, 7):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de diciembre">{n}</button>'
    mm = (f'<section class="ag0-pc" aria-label="Calendario del mes"><div class="ag0-mm ag0-mmp"><div class="ag0-mm-c"><b>Noviembre de 2026</b>'
          f'<button type="button" class="ag0-p ag0-ic" aria-label="Mes anterior">{ic(I["ant"], 20, 2.2)}</button><button type="button" class="ag0-p ag0-ic" aria-label="Mes siguiente">{ic(I["sig"], 20, 2.2)}</button></div>'
          f'<div class="ag0-mm-g">{"".join(f"<span>{x}</span>" for x in "LMXJVSD")}{nums}</div></div></section>')
    return f'<aside class="ag0-pd" aria-label="Panel del día">{res_n}{res_m}{res_h}{hue_n}{hue_h}{mm}</aside>'

def huecos_piezas():
    turno = lambda h: f'<button type="button" class="ag0-p ag0-turno" aria-label="Agendar a las {h} (30 min)">{ic(I["plus"], 14, 2.4)}{h}</button>'
    n = (f'<div class="ag0-hg" role="group" aria-label="Hueco 17:45 – 18:20"><p class="ag0-hgc"><b>17:45 – 18:20</b><span>35 min</span></p><p class="ag0-pnota">No cabe un turno entero en este hueco.</p></div>'
         f'<div class="ag0-hg" role="group" aria-label="Hueco 18:50 – 20:00"><p class="ag0-hgc"><b>18:50 – 20:00</b><span>70 min</span></p><div class="ag0-turnos">{turno("19:00")}{turno("19:30")}</div></div>')
    h = f'<p class="ag0-pvacio">{ic(I["agenda"], 22)}Consultorio cerrado · No hay horario de consulta este día</p>'
    return n, h

# ------------------------------------------------------------------ FONDO: la barra aprobada sobre el Día de hoy ------------------------------------------------------------------
def parchea_barra(b):
    b = b.replace('aria-label="Buscar citas de un paciente">', 'aria-label="Buscar citas de un paciente" data-abre="buscar" aria-haspopup="dialog" aria-expanded="false">')
    b = b.replace('aria-label="Por confirmar (2) y avisos (1): 3 pendientes" aria-haspopup="dialog">',
                  'aria-label="Por confirmar (2) y avisos (1): 3 pendientes" aria-haspopup="dialog" data-abre="campana" aria-expanded="false" data-campana="1">')
    b = b.replace('aria-label="Bloquear horario">', 'aria-label="Bloquear horario" data-bloquear="1">')
    b = b.replace('class="ag0-p ag0-med" aria-label', 'class="ag0-p ag0-med" data-abre="medico" aria-expanded="false" aria-label')
    b = b.replace('<span class="ag0-mt">Todos los médicos</span>', '<span class="ag0-mt"><span class="ah-lbt">Todos los médicos</span><span class="ah-lbm">Todos los médicos — el mes se ve por médico</span></span>')
    return b

def fondo(vp, dias=False):
    b, flota = barra(vp, 'dia')
    b = parchea_barra(b)
    if dias:
        rj = ''.join(f'<div class="ah-dv" data-dv="{d}" style="display:{"flex" if d == HOY else "none"}">{rejilla(vp, [d], scroll=12 if d == HOY else 8)}</div>' for d in range(7))
    else:
        rj = rejilla(vp, [HOY], scroll=12)
    rj = rj.replace('aria-label="Curso de actualización, todo el día, evento"', 'aria-label="Curso de actualización, todo el día, evento" data-cita="td1"')
    cuerpo = f'<div class="ag0-diap">{rj}{panel_dia()}</div>' if vp == 'esc' else rj
    return f'<main class="ag0-cont">{b}{cuerpo}{flota}</main>'

def lateral_ah(vp):
    """La barra lateral de la base; en computadora, con «Plegar menú» al pie (Sidebar.tsx, solo en la agenda y desde 1024)."""
    h = lateral()
    if vp == 'esc':
        pleg = (f'<button type="button" class="ag0-p ag0-li ah-pleg" data-plegar="1" aria-expanded="true">'
                f'<span class="ah-plg" style="display:contents">{ic(I["panel_c"], 20)}<span class="ah-lt">Plegar menú</span></span><span class="ah-desp" style="display:none"></span></button>')
        h = h.replace('<div class="ag0-lat-pie">', f'<div class="ag0-lat-pie">{pleg}')
    return h

def marco_ah(n, vp, contenido, capas=''):
    if vp == 'ext': app = contenido + riel()
    elif vp == 'tel': app = encabezado() + contenido
    elif vp == 'iv': app = enc_iv() + contenido
    elif vp == 'ih': app = contenido + lateral()
    else: app = lateral_ah(vp).replace('{V}', str(n)) + contenido
    # Lo que la barra abre está en TODAS las vistas (cada botón lleva a su pieza, no solo en la vista que la presenta)
    com = ''
    if 'data-capa="fecha"' not in capas: com += capa_fecha(vp)
    if 'data-capa="campana"' not in capas: com += campana(vp)
    if 'data-capa="buscar"' not in capas: com += buscador(vp, n)
    if 'data-capa="leyenda"' not in capas: com += capa_leyenda(vp)
    if 'data-capa="atajos"' not in capas: com += capa_atajos(vp)
    if 'data-capa="huecos"' not in capas: com += huecos_capa(vp)
    if 'data-tlp' not in capas: com += tlp(vp)
    capas = (capas + com).replace('ah-tpc-', f'ah-tpc{n}-').replace('ah-tav-', f'ah-tav{n}-').replace('ah-ppc-', f'ah-ppc{n}-').replace('ah-pav-', f'ah-pav{n}-')
    capas = capas + piezas(n, vp)
    return f'<div class="marco ag0 ah ah-v{n} ab al af af-vah{n}" data-vp="{vp}" lang="es">\n<div class="ag0-app">\n{app}\n</div>\n{capas}\n<div class="ah-toast" role="status" aria-live="polite"><i></i><span></span></div>\n</div>'

def capa(key, vp, titulo, cuerpo, ancho='', anc=False, anc_izq=False, rol='dialog', extra='', cab=True, cls='', cab_anc=False):
    """Una capa del catálogo con el marcado de la base (.ag0-capa > .ag0-velo + .ag0-cj).
    anc: en computadora nace de su botón y no lleva velo (menús y desplegables, CALMA §21)."""
    a = anc and vp == 'esc'
    cj = 'ag0-cj ah-col' + (' ag0-anc' if a else '') + (' ag0-anc-i' if a and anc_izq else '') + (f' {ancho}' if ancho else '') + (f' {cls}' if cls else '')
    velo = ' ag0-sinvelo' if a else ''
    cabh = f'<div class="ag0-cjc"><h2>{titulo}</h2>{X()}</div>' if cab and (not a or cab_anc) else ''
    modal = '' if a or rol != 'dialog' else ' aria-modal="true"'
    return (f'<div class="ag0-capa{velo}" data-capa="{key}" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="{cj}" role="{rol}"{modal} aria-label="{titulo}"{extra}><span class="ag0-asa" aria-hidden="true"></span>{cabh}{cuerpo}</div></div>')

def plantillas():
    return ''   # la burbuja, el alta, el formulario y el ligado llegan con piezas() (tmp-integra.py)

# ================================================================== VISTA 1 · BUSCAR ==================================================================
PACIENTES = [f'Paciente Prueba {i:02d}' for i in range(1, 26)]

def cita_row(c, primero=False):
    from datetime import date
    dd = date(2026, 11, 16 + c['d'])
    dsem = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'][dd.weekday()]
    f = f'{dsem}, {dd.day} nov 2026, {hm(c["a"])}'
    meta = f'{c["nom"]} · {EST[c["e"]][0]}'
    return (f'<button type="button" class="ag0-p ah-fr" role="option" aria-selected="false" data-salta="{c["id"]}" data-d="{c["d"]}" data-a="{c["a"]}" aria-label="{f}, {meta}">'
            f'{est(c["e"], texto=False, s=26)}<span class="ah-frc"><b class="ah-num">{f}</b><span>{meta}</span></span>{CHEV}</button>')

def buscador(vp, n):
    pac = ''
    for p in PACIENTES:
        pac += (f'<button type="button" class="ag0-p ah-fr" role="option" aria-selected="false" data-pac="{num(p)}" data-nom="{p.lower()}" aria-label="{p}, 999 000 00{num(p)}">'
                f'{avn(p)}<span class="ah-frc"><b>{p}</b><span class="ah-num">999 000 00{num(p)}</span></span>{CHEV}</button>')
    # Con la v2, también las citas por ligar cuyo nombre de reserva casa (buscarCitasPorLigar)
    lig = [c for c in CITAS if c['sx'] and c['tipo'] == 'cita']
    for c in lig:
        pac += cita_row(c).replace('class="ag0-p ah-fr"', f'class="ag0-p ah-fr" data-nom="{c["nom"].lower()}"', 1)
    listas = f'<div class="ah-res" role="listbox" aria-label="Resultados" data-de="q">{pac}</div>'
    for p in PACIENTES:
        ks = sorted([c for c in CITAS if c['nom'] == p and c['tipo'] == 'cita'], key=lambda c: (c['d'], c['a']))
        if ks:
            listas += f'<div class="ah-res" role="listbox" aria-label="Resultados" data-de="{num(p)}">' + ''.join(cita_row(c) for c in ks) + '</div>'
    campo = (f'<label class="ah-rot" for="ah-q{n}-{vp}">Buscar citas de un paciente</label>'
             f'<div class="ah-campo">{ic(I["lupa"], 18, 2)}<input id="ah-q{n}-{vp}" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Nombre del paciente" aria-label="Buscar citas de un paciente">'
             f'<button type="button" class="ag0-p ah-limpia" data-limpia="1" aria-label="Borrar búsqueda" tabindex="-1">{ic(I["x"], 16, 2.2)}</button></div>')
    volver = f'<button type="button" class="ag0-p ah-volver" data-volver="1">{ic(I["ant"], 16, 2.4)}<span>Paciente Prueba 07</span></button>'
    cuerpo = (f'<div class="ah-bus" data-paso="vacio">{volver}{campo}{listas}'
              f'<p class="ah-v2" role="status">Sin citas entre hace 30 días y dentro de un año.</p><div class="ah-vac ah-sinco" role="status"><i>{ic(I["lupa"], 24, 2)}</i>Sin coincidencias.</div><span class="ah-pie-esp"></span></div>')
    return capa('buscar', vp, 'Buscar citas de un paciente', cuerpo, ancho='ah-w360', anc=True, extra=' data-etq="Buscar citas"')

def menu_ah(vp):
    """«Opciones de la agenda». Computadora: el engrane de hoy. Táctiles: además buscar, médico, bloquear (y en Duo abierto
    «Huecos disponibles», NUEVO aprobado, solo en Día y con un médico elegido). Lo que hoy depende de la vista, igual."""
    chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
    medico = (f'<button type="button" class="ag0-p ag0-op" role="menuitem" aria-expanded="false" data-sub="med">{ic(I["medico"], 20, 2)}<span>Médico<small><span class="ah-medn">Dr. Admin Semilla</span><span class="ah-medt">Todos los médicos</span></small></span>{chev}</button>'
              f'<div class="ag0-sub" role="group" aria-label="Médico">'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="false" data-med="todos"><span><span class="ah-lbt">Todos los médicos</span><span class="ah-lbm">Todos los médicos — el mes se ve por médico</span></span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="true" data-med="as"><span>Dr. Admin Semilla</span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="false" data-med="is"><span>Dra. Invitada Semilla</span></button></div>')
    sep = '<div class="ag0-sep" role="separator"></div>'
    comp = (f'<button type="button" class="ag0-p ag0-op ah-nolista" role="menuitemcheckbox" aria-checked="false" data-sw="1" data-compactar="1">{ic(I["compactar"], 20, 2)}'
            f'<span><span class="ah-cg">Compactar la rejilla</span><span class="ah-cm">Ocultar los días de la semana sin actividad</span></span><span class="ag0-sw" aria-hidden="true"></span></button>')
    dens = sw('densidad', 'Densidad compacta').replace('class="ag0-p ag0-op"', 'class="ag0-p ag0-op ah-sinmes" data-densidad="1"', 1)
    pop = sw('cursor', 'Pop-up de eventos', True)
    cfg = op('engrane', 'Configuración de la agenda', attrs=' data-config="1"')
    ley = op('info', 'Leyenda de estados', attrs=' data-abre="leyenda" aria-haspopup="dialog"')
    if vp == 'esc':
        cuerpo = cfg + sep + comp + dens + pop + op('teclado', 'Atajos de teclado', '<kbd>?</kbd>', attrs=' data-abre="atajos" aria-haspopup="dialog" aria-keyshortcuts="?"') + sep + ley
    else:
        top = op('lupa', 'Buscar citas de un paciente', attrs=' data-abre="buscar" aria-haspopup="dialog"') if vp in ('ext', 'tel') else ''
        hue = op('hueco', 'Huecos disponibles', cls='ah-solodia', attrs=' data-abre="huecos" aria-haspopup="dialog"') if vp in ('ih', 'iv') else ''
        cuerpo = top + medico + hue + op('candado', 'Bloquear horario', attrs=' data-bloquear="1"') + sep + cfg + comp + pop + sep + ley
    a = vp == 'esc'
    cab = '' if a else f'<div class="ag0-cjc"><h2>Opciones de la agenda</h2>{X()}</div>'
    return (f'<div class="ag0-capa{" ag0-sinvelo" if a else ""}" data-capa="menu" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj{" ag0-anc" if a else ""}" role="menu" aria-label="Opciones de la agenda"><span class="ag0-asa" aria-hidden="true"></span>{cab}<div class="ag0-cj-in">{cuerpo}</div></div></div>')

def toque_campana_aria(n, m):
    t = n + m
    return f'Por confirmar ({n}) y avisos ({m}): {t} {"pendiente" if t == 1 else "pendientes"}'

FICHA_COMUN = '''<h4>Capa (catálogo §25–§28)</h4>
<table><thead><tr><th></th><th>Duo cerrado</th><th>iPhone</th><th>Duo abierto (h / v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Forma</th><td>tarjeta centrada en el área sin riel, 310 de ancho</td><td>hoja inferior con asa; se arrastra para cerrar</td><td>tarjeta centrada con velo, 400</td><td>%s</td></tr>
<tr><th>Entrada</th><td colspan="4">resorte sin rebote (amortiguación 1, respuesta .35 s, escrito con <code>linear()</code>): tarjeta escala .96→1 + fundido; hoja sube desde el borde; desplegable de computadora escala desde su botón (<code>transform-origin</code> en el botón). Salida por el mismo camino, más rápida (200 ms). Interrumpible: reabrir a mitad parte del valor presente.</td></tr>
<tr><th>Cierre</th><td colspan="4">✕ (44; 36 en Duo h y computadora) · tocar el velo o fuera · Escape · en iPhone, arrastrar la hoja hacia abajo (umbral 10 px, proyección de inercia: cierra si el destino proyectado pasa de la mitad; rubber-band hacia arriba). El foco vuelve al botón que la abrió.</td></tr>
<tr><th>Velo</th><td colspan="3"><code>--velo</code> + <code>blur(10px) saturate(140%%)</code></td><td>%s</td></tr>
<tr><th>Reducidos</th><td colspan="4">movimiento reducido → fundido de 200 ms sin escala ni desplazamiento (también el arrastre: la hoja se funde) · transparencia reducida → velo opaco sin desenfoque.</td></tr>
</tbody></table>'''

def ficha1():
    return ('''<h3>Especificación · Buscar en la agenda (<code>BuscadorCitas</code>)</h3>
<p><b>Dónde se abre:</b> la lupa de la barra en Duo abierto y computadora; en Duo cerrado e iPhone, «Buscar citas de un paciente» dentro de «Opciones de la agenda» (barra aprobada). Atajo <kbd>/</kbd> en computadora.</p>
<p><b>Dos pasos en el mismo campo (combobox):</b> 1) pacientes (avatar con su número, nombre 15/600, teléfono 13 tabular) y, con la v2, las citas por ligar cuyo nombre de reserva casa; 2) las citas del paciente elegido: icono de estado en círculo de 32 (el del dashboard), fecha y hora 15/600 tabular, «nombre · estado» 13. Encima, «‹ Paciente…» vuelve al paso 1. Sin citas: «Sin citas entre hace 30 días y dentro de un año.». Sin resultados en el paso 1: estado vacío del catálogo «Sin coincidencias.» (icono en círculo de 48 + texto 15, sin acción; CALMA §29.8).</p>
<p><b>Saltar a la cita:</b> elegir una cita cierra el buscador, lleva la agenda al Día de esa cita, la desplaza hasta su hora, la marca seleccionada (doble anillo) y abre su burbuja (la pieza de la burbuja de cita, igual que en la página Cita).</p>
<p><b>Teclado (como hoy):</b> el foco no sale del campo; ↑/↓ señalan una opción (fondo <code>--fondo</code>), Intro la elige, Escape limpia y un segundo Escape cierra. Campo 16 px en táctiles (sin zoom de Safari), relleno <code>--sup2</code>, contorno de 2 px <code>--enlace</code> al enfocar; filas de 58 (50 en computadora).</p>'''
            + FICHA_COMUN % ('desplegable de 360 que nace de la lupa, sin velo (no modal visualmente; sigue siendo <code>role=dialog</code>)', 'sin velo'))

def vista1(vp):
    capas = buscador(vp, 1) + menu_ah(vp) + medicos_lb(vp) + plantillas()
    return marco_ah(1, vp, fondo(vp, dias=True), capas)

# ================================================================== VISTA 2 · CAMPANA ==================================================================
PC = [dict(id='v1', nom='Paciente Prueba 15', h='08:00', wa=True, co=True), dict(id='v5', nom='Paciente Prueba 24', h='16:00', wa=True, co=False)]

def fila_pc(r, sinm=False):
    wa = (f'<button type="button" class="ag0-p ah-ib ah-ib-wa" data-wa="1" aria-label="Enviar recordatorio por WhatsApp"><i>{ic(I["whatsapp"], 18, 2)}</i></button>'
          if r['wa'] else '<span aria-hidden="true"></span>')
    co = (f'<button type="button" class="ag0-p ah-ib ah-ib-co" data-co="1" aria-label="Enviar confirmación por correo"><i>{ic(I["correo"], 18, 2)}</i></button>'
          if r['co'] else '<span aria-hidden="true"></span>')
    sm = (f'<div class="ah-pcs"><p>Sin teléfono válido ni correo.</p><button type="button" class="ag0-p ah-ton" data-marcar="1">{ic(I["chk"], 16, 2.4)}Marcar como confirmada</button></div>')
    return (f'<li class="ah-pcf{" ah-sinm" if sinm else ""}" data-pc="{r["id"]}">{avn(r["nom"])}<div class="ah-pcd"><b>{r["nom"]}</b><span>{r["h"]} · Centro</span></div>'
            f'{wa}{co}<p class="ah-pce" hidden></p>{sm}</li>')

AVISOS = [  # (tipo css, icono, texto, meta, cita, google)
    ('enl', 'enlace', 'Paciente Prueba 26 reservó por enlace', 'Cita: Jue 19 de nov · 14:00 · hace 3 h', 'j8', False, True),
    ('g', 'G', 'Evento nuevo de Google por asignar: Revisión de estudios', 'Cita: Jue 19 de nov · 18:20 · hace 22 min', 'j13', True, False),
    ('canc', 'x', 'Paciente Prueba 14 canceló su cita', 'Cita: Lun 16 de nov · 10:00 · hace 2 días', 'l2', False, False),
    ('reag', 'reagendar', 'Paciente Prueba 22 reagendó su cita', 'Cita: Vie 20 de nov · 10:00 · hace 1 h', 'v3', False, False),
    ('emp', 'tri', 'La reserva de Paciente Prueba 21 se empalma con un evento de Google', 'Cita: Vie 20 de nov · 09:00 · hace 5 h', 'v2', False, False),
    ('mov', 'G', 'Desde Google no se pueden mover las citas reservadas por enlace. Para cambiarla, usa Reagendar: se le avisará al paciente.', 'Cita: Vie 20 de nov · 09:00 · ahora', 'v2', False, False),
    ('conf', 'palomita', 'Paciente Prueba 01 confirmó su cita del sábado, 21 de noviembre a las 11:00', 'Cita: Sáb 21 de nov · 11:00 · hace 1 min', 's2', False, False),
]

def fila_aviso(a, i):
    t, icn, txt, meta, cid, goog, base = a
    glyph = gcal(18) if icn == 'G' else ic(I[icn], 16, 2.2)
    noes = (f'<div class="ah-noes"><button type="button" class="ag0-p ah-ton" data-noes="1">¿No es una cita?</button></div>' if goog else '')
    return (f'<li class="ah-avi{"" if base else " ah-avx"}" data-av="{i}"><button type="button" class="ag0-p ah-av" data-cita-av="{cid}">'
            f'<span class="ah-avt ah-t-{t}" aria-hidden="true">{glyph}</span><span class="ah-avc"><b>{txt}</b><span>{meta}</span></span>{CHEV}</button>{noes}</li>')

def campana(vp):
    tabs = (f'<div class="ah-tabs"><div role="tablist" aria-label="Por confirmar y avisos" style="display:contents">'
            f'<button type="button" role="tab" class="ag0-p ah-tab" id="ah-tpc-{vp}" aria-controls="ah-ppc-{vp}" aria-selected="true" data-tab="pc">Por confirmar<small>· <span data-n="pc">2</span></small></button>'
            f'<button type="button" role="tab" class="ag0-p ah-tab" id="ah-tav-{vp}" aria-controls="ah-pav-{vp}" aria-selected="false" tabindex="-1" data-tab="av">Avisos<small>· <span data-n="av">1</span></small></button></div>{X()}</div>')
    carga = '<div class="ah-carga ah-solocarga"><p>Cargando…</p><span></span><span></span></div>'
    vac_pc = f'<div class="ah-vac" data-vac="pc" hidden><i>{ic(I["confirmar"], 24, 2)}</i>No hay citas de mañana sin confirmar.</div>'
    vac_av = f'<div class="ah-vac ah-contabla" data-vac="av" hidden><i>{ic(I["campana"], 24, 2)}</i>No hay avisos sin revisar.</div>'
    pc = (f'<div class="ah-pan" role="tabpanel" id="ah-ppc-{vp}" aria-labelledby="ah-tpc-{vp}" data-pan="pc">{carga}'
          f'<p class="ah-ley" data-ley="1">Estos pacientes están pendientes de confirmar su cita. Envía un recordatorio.</p>'
          f'<ul class="ah-pcl">{"".join(fila_pc(r) for r in PC)}</ul>{vac_pc}</div>')
    sint = ('<div class="ah-sintabla" style="flex-direction:column">'
            '<section class="ah-secc"><h3>Canceladas por el paciente (48 h)</h3><ul><li><b>Paciente Prueba 14</b><span>lun 16 nov, 10:00</span></li></ul></section>'
            '<section class="ah-secc"><h3>Reservas por enlace empalmadas con Google</h3><ul><li><b>Paciente Prueba 21</b><span>vie 20 nov, 09:00 · se empalma con un evento de Google</span></li></ul></section></div>')
    av = (f'<div class="ah-pan" role="tabpanel" id="ah-pav-{vp}" aria-labelledby="ah-tav-{vp}" data-pan="av" hidden>{carga}'
          f'<ul class="ah-avl ah-contabla">{"".join(fila_aviso(a, i) for i, a in enumerate(AVISOS))}</ul>{vac_av}{sint}'
          f'<div class="ah-pie ah-contabla"><button type="button" class="ag0-p ah-ton" data-todos="1">Marcar todos como revisados</button></div></div>')
    cuerpo = f'{tabs}<div class="ah-cuerpo">{pc}{av}</div>'
    return capa('campana', vp, 'Por confirmar y avisos', cuerpo, ancho='ah-w380', anc=True, cab=False)

def ficha2():
    return ('''<h3>Especificación · Campana «Por confirmar y avisos» (<code>CampanaAgenda</code>, <code>PanelPorConfirmar</code>, <code>ListaAvisos</code>)</h3>
<p><b>Botón:</b> campana de 20 en <code>--tinta2</code> con el contador rojo (<code>--mes</code>, 18 de alto, 12/700; «9+» con más de 9; sin pendientes, nada). Su nombre accesible da el desglose: «Por confirmar (2) y avisos (1): 3 pendientes». Abrirla recarga la lista.</p>
<p><b>Pestañas</b> (APG Tabs, flechas ← →, Inicio, Fin): texto 14, la activa 600 con subrayado de 2 px <code>--accion</code>; el número va como texto plano «· 2» en <code>--tinta2</code>, sin píldora.</p>
<p><b>Por confirmar</b> (citas de mañana sin confirmar): la leyenda de hoy, justificada; filas de 62 (56 en ancho) con avatar numerado, nombre 15/600 y «08:00 · Centro» 13 tabular; a la derecha dos columnas FIJAS (la celda queda vacía si falta un medio, como hoy): WhatsApp en círculo verde suave (<code>--ok-fondo</code>/<code>--ok-tinta</code>), nombre accesible «Enviar recordatorio por WhatsApp»; correo en círculo azul suave, «Enviar confirmación por correo» (los nombres que hoy solo viven en <code>title</code> pasan a <code>aria-label</code>). Tras usarlos, UNA línea de estado bajo la fila: «WhatsApp abierto 17:10 · Correo enviado 17:10» (el correo queda deshabilitado). Sin medios: «Sin teléfono válido ni correo.» + botón tonal «Marcar como confirmada» (quita la fila).</p>
<p><b>Avisos:</b> cada tipo con su icono en círculo tintado (sustituye al punto azul, que solo decía «sin revisar» y todos lo están): reserva por enlace (eslabón, azul) · Google por asignar (G de Google) · canceló (✕, rojo) · reagendó (calendario con flecha, ámbar) · empalme (triángulo, ámbar) · movimiento rechazado en Google (G, texto largo de hoy) · confirmó (palomita, verde). Segunda línea «Cita: Jue 19 de nov · 14:00 · hace 3 h». Pulsar un aviso lo marca revisado y abre su cita: la burbuja, o la ventana «Ligar paciente e iniciar consulta» si es una reserva por enlace o un evento de Google por asignar (las piezas de la página Cita). En Google por asignar, «¿No es una cita?» (tonal) al lado de la fila, no dentro. Pie: «Marcar todos como revisados» (tonal, a la derecha).</p>
<p><b>Estados:</b> «Cargando…» (esqueleto estático, sin bucle) · vacíos «No hay citas de mañana sin confirmar.» / «No hay avisos sin revisar.» (icono en círculo de 48 + texto 15) · servidor sin la tabla de avisos: «Canceladas por el paciente (48 h)» y «Reservas por enlace empalmadas con Google». Avisos emergentes (toast arriba, centrado en el contenido) para reserva por enlace, reagendado, Google por asignar y confirmación del paciente.</p>'''
            + FICHA_COMUN % ('desplegable de 380 que nace de la campana, sin velo; <code>role=dialog</code> con foco atrapado', 'sin velo'))

def vista2(vp):
    capas = campana(vp) + menu_ah(vp) + medicos_lb(vp) + plantillas()
    return marco_ah(2, vp, fondo(vp), capas)

# ================================================================== VISTA 3 · OPCIONES ==================================================================
def medicos_lb(vp):
    if vp != 'esc': return ''
    def o(k, nom, ini, cls, sel=False):
        return (f'<button type="button" class="ag0-p ah-lbo" role="option" aria-selected="{"true" if sel else "false"}" data-med="{k}">'
                f'<span class="ah-chk">{ic(I["chk"], 18, 2.4)}</span><span class="ag0-ini {cls}">{ini}</span><span>{nom}</span></button>')
    cuerpo = ('<div class="ah-lb" role="listbox" aria-label="Médico">'
              + o('todos', '<span class="ah-lbt">Todos los médicos</span><span class="ah-lbm">Todos los médicos — el mes se ve por médico</span>', ic(I['pac'], 16, 2), 'ah-ini0')
              + o('as', 'Dr. Admin Semilla', 'AS', '', True) + o('is', 'Dra. Invitada Semilla', 'IS', 'ah-ini2') + '</div>')
    return capa('medico', vp, 'Médico', cuerpo, ancho='ah-w260', anc=True, anc_izq=True, rol='dialog', cab=False)

def huecos_capa(vp):
    if vp not in ('ih', 'iv'): return ''
    n, h = huecos_piezas()
    cuerpo = (f'<div class="ah-hue">'
              f'<div class="ag0-pvn" style="display:flex;flex-direction:column;gap:10px">{n}</div><div class="ag0-pvh">{h}</div></div>')
    return capa('huecos', vp, 'Huecos disponibles', cuerpo)

def tlp(vp):
    return '<div class="ah-tlp" role="dialog" aria-label="Cita" data-tlp="1"></div>' if vp == 'esc' else ''

def ficha3():
    return ('''<h3>Especificación · Opciones de la agenda (<code>MenuEngraneAgenda</code>) y selector de médico</h3>
<table><thead><tr><th>Opción (texto de hoy)</th><th>Duo cerrado · iPhone</th><th>Duo abierto (h / v)</th><th>Computadora</th><th>Condición de hoy</th></tr></thead><tbody>
<tr><th>Buscar citas de un paciente</th><td>sí (en la barra no cabe)</td><td>— (lupa en la barra)</td><td>— (lupa en la barra)</td><td></td></tr>
<tr><th>Médico (submenú con «Todos los médicos»)</th><td>sí</td><td>sí</td><td>— (píldora en la barra → lista)</td><td>en Mes, «Todos los médicos — el mes se ve por médico» y no se puede elegir</td></tr>
<tr><th><b>Huecos disponibles</b> · NUEVO aprobado</th><td>—</td><td>sí: abre la pieza <code>.ag0-hg</code> del panel en una tarjeta</td><td>— (está en el panel del Día)</td><td>solo en Día y con un médico elegido</td></tr>
<tr><th>Bloquear horario</th><td>sí</td><td>sí</td><td>— (candado en la barra)</td><td>abre «Bloquear horario» (el mismo modal de la página Cita)</td></tr>
<tr><th>Configuración de la agenda</th><td colspan="3">sí: lleva a la Configuración de la agenda (en esta página, la sección «Configuración · Horario»)</td><td>con la v2 la ve todo el que ve la agenda</td></tr>
<tr><th>Compactar (interruptor)</th><td colspan="3">«Compactar la rejilla» en Día, 3 días y Semana de rejilla (las tres son <code>timeGrid</code>); «Ocultar los días de la semana sin actividad» en Mes; no sale en las listas (Semana de teléfono)</td><td><code>aria-label</code> largo: «Compactar la rejilla al horario de los consultorios»</td></tr>
<tr><th>Densidad compacta (interruptor)</th><td>—</td><td>—</td><td>sí</td><td>solo computadora y vistas <code>timeGrid</code>: Día, 3 días y Semana (no en Mes)</td></tr>
<tr><th>Pop-up de eventos (interruptor)</th><td colspan="3">sí</td><td>en táctiles no cambia nada (la tarjeta sigue al toque), como hoy</td></tr>
<tr><th>Atajos de teclado <kbd>?</kbd></th><td>—</td><td>—</td><td>sí</td><td>no en móvil</td></tr>
<tr><th>Leyenda de estados</th><td colspan="3">sí (el botón ⓘ de la barra se retira, CALMA §28)</td><td></td></tr>
</tbody></table>
<p><b>Dibujo:</b> filas de 48 (40 en computadora), icono 20 en <code>--enlace</code>, texto 15 <code>--tinta</code>; interruptores 40×24 a la derecha (<code>menuitemcheckbox</code>: no cierran el menú, se ve el estado cambiar); separadores <code>--linea</code>. Teclado APG Menu Button: ↓/↑ abren y recorren en bucle, Inicio/Fin, Escape y Tab cierran devolviendo el foco al engrane.</p>
<p><b>Cuatro vistas (CALMA §29.1):</b> Mes · Semana · 3 días · Día en todos los marcos. «3 días» (<code>timeGridTresDias</code>) es rejilla: lleva Compactar con el texto de rejilla y, en computadora, Densidad. La barra de fondo es la base actual (conmutador de cuatro, <code>PIEZAS.md</code> §12): elegir «3 días» en el conmutador o en la tira marca su segmento y cambia el título a «19 – 21 nov 2026».</p>\n<p><b>Selector de médico (computadora):</b> la píldora de la barra abre una lista anclada (260, sin velo) con palomita en el elegido; «Todos los médicos» cambia la píldora y el panel del Día («Resumen del día», sin Huecos).</p>
<p><b>Tarjeta al pasar el ratón</b> («Pop-up de eventos» encendido, solo con puntero): tras 400 ms quieto sobre una cita, la burbuja aparece junto a ella sin velo y sin robar el foco (no modal); se va al salir; un clic dentro la fija como la burbuja de siempre; Escape la cierra.</p>'''
            + FICHA_COMUN % ('menú de 288 que nace del engrane, sin velo', 'sin velo (menús y listas)'))

def vista3(vp):
    capas = menu_ah(vp) + medicos_lb(vp) + huecos_capa(vp) + capa_leyenda(vp) + capa_atajos(vp) + buscador(vp, 3) + plantillas() + tlp(vp)
    return marco_ah(3, vp, fondo(vp), capas)

# ================================================================== VISTA 4 · FECHA, LEYENDA, ATAJOS ==================================================================
def capa_leyenda(vp):
    filas = ''
    for k in ('ag', 'conf', 'canc', 'noas', 'aten'):
        t, i = EST[k]
        filas += f'<li class="ah-lgf"><span class="ah-mues ag0-b--{k}" aria-hidden="true">{ic(I[i], 13, 2.4)}</span><span>{t}</span></li>'
    filas += '<li class="ah-lgs" role="separator"></li>'
    filas += f'<li class="ah-lgf"><span class="ah-mues ah-mues-bq" aria-hidden="true">{ic(I["candado"], 13, 2.2)}</span><span>Bloqueo</span></li>'
    filas += f'<li class="ah-lgf"><span class="ah-mues ah-mues-o" aria-hidden="true">{gcal(16)}</span><span>Agendada desde Google Calendar</span></li>'
    filas += f'<li class="ah-lgf"><span class="ah-mues ah-mues-o" aria-hidden="true">{ic(I["enlace"], 16, 2.2)}</span><span>Reservó por enlace</span></li>'
    filas += f'<li class="ah-lgf"><span class="ah-mues ah-mues-o" aria-hidden="true">{sinexp(16)}</span><span>Sin expediente</span></li>'
    cuerpo = f'<ul class="ah-lg">{filas}</ul>'
    return capa('leyenda', vp, 'Leyenda de estados', cuerpo, ancho='ah-w320', anc=True, cab_anc=True)

ATAJOS = [(['t'], 'Ir a hoy'), (['j', 'n'], 'Periodo siguiente'), (['k', 'p'], 'Periodo anterior'), (['d'], 'Vista Día'), (['s'], 'Vista Semana'),
          (['m'], 'Vista Mes'), (['c'], 'Agendar'), (['/'], 'Buscar citas de un paciente'), (['?'], 'Ver estos atajos')]

def capa_atajos(vp):
    if vp != 'esc': return ''
    dl = ''.join('<dt>' + ' o '.join(f'<kbd>{k}</kbd>' for k in ks) + f'</dt><dd>{d}</dd>' for ks, d in ATAJOS)
    sw_ = '<button type="button" class="ag0-p ah-atsw" role="switch" aria-checked="true" data-sw="1"><span>Usar atajos de una tecla</span><span class="ag0-sw" aria-hidden="true"></span></button>'
    return capa('atajos', vp, 'Atajos de teclado', f'<div class="ah-cuerpo"><dl class="ah-atl">{dl}</dl></div>{sw_}', cls='ah-at')

def ficha4():
    return ('''<h3>Especificación · Ir a una fecha, Leyenda de estados y Atajos de teclado</h3>
<p><b>Ir a una fecha</b> (<code>SelectorFecha</code> + <code>MiniMes</code>): el título del periodo ES el botón (con su flecha). Abre el mini mes de la base (320 en ancho): días de 40 (36 en computadora), hoy en <code>--enlace</code>, el día a la vista relleno <code>--cal-hoy-num</code>; «Mes anterior» / «Mes siguiente». Elegir un día cierra y lleva la agenda a ese día conservando la vista (el título cambia). Teclado APG Date Picker Dialog: el foco entra en el día activo, flechas por días y semanas, Escape devuelve el foco al título. Computadora: nace del título, sin velo.</p>
<p><b>Leyenda de estados</b> (<code>LeyendaEstados</code>): cada estado se explica con una MUESTRA del bloque real (relleno + barra de 3 px + icono de estado, 40×26) en vez del punto de 8 px de hoy, y su nombre a 15 (14 en computadora): Agendada, Confirmada, Cancelada, No asistió, Atendida; una línea; Bloqueo (el rayado de la rejilla); y los orígenes con los TEXTOS UNIFICADOS (CALMA §28): «Agendada desde Google Calendar» (sustituye a «Se agendó en Google»), «Reservó por enlace» (sustituye a «Se agendó por enlace») y «Sin expediente». Se abre desde «Opciones de la agenda» (el ⓘ de la barra se retira). Computadora: tarjeta de 320 que nace del engrane, sin velo.</p>
<p><b>Atajos de teclado</b> (<code>AyudaAtajos</code>, solo computadora; en táctiles no existe, como hoy): diálogo centrado de 400 con velo, título 17/700 y ✕; lista de pares tecla–acción (teclas de 28 en <code>--sup2</code>, monoespaciada 14/600; «o» entre dos teclas; acción 14); al pie, el interruptor «Usar atajos de una tecla» (WCAG 2.1.4), que recibe el foco al abrir. Se abre con <kbd>?</kbd> o desde el engrane.</p>'''
            + FICHA_COMUN % ('Ir a una fecha y Leyenda: desplegables sin velo que nacen de su botón; Atajos: diálogo centrado de 400 con velo', 'sin velo (los dos desplegables); con velo (Atajos)'))

def vista4(vp):
    capas = capa_fecha(vp) + menu_ah(vp) + medicos_lb(vp) + capa_leyenda(vp) + capa_atajos(vp) + buscador(vp, 4) + plantillas()
    return marco_ah(4, vp, fondo(vp), capas)

# ================================================================== VISTA 5 · HORARIO Y PLEGAR MENÚ ==================================================================
HOR = [('Lunes', True, '08:00', '19:00'), ('Martes', True, '08:00', '19:00'), ('Miércoles', True, '08:00', '19:00'), ('Jueves', True, '08:00', '20:00'),
       ('Viernes', True, '08:00', '19:00'), ('Sábado', True, '09:00', '14:00'), ('Domingo', False, '09:00', '14:00')]

def capa_horario(vp):
    filas = ''
    for i, (d, on, a, b) in enumerate(HOR):
        filas += (f'<div class="ah-hd{"" if on else " ah-off"}" data-hd="{i}">'
                  f'<button type="button" class="ag0-p ah-hds" role="switch"{" data-foco=1" if i == 0 else ""} aria-checked="{"true" if on else "false"}" aria-label="{d}"><span class="ag0-sw" aria-hidden="true"></span></button>'
                  f'<span><span class="ah-hdn">{d}</span><span class="ah-hdx">Sin consulta</span></span>'
                  f'<span class="ah-hdh"><input class="ah-hh" type="text" inputmode="numeric" value="{a}" aria-label="{d}, entrada"><span>–</span><input class="ah-hh" type="text" inputmode="numeric" value="{b}" aria-label="{d}, salida"></span></div>')
    cab = (f'<div class="ag0-cjc"><span class="ah-cico" aria-hidden="true">{ic(I["engrane"], 18, 1.8)}</span><h2 id="ah-ht-{vp}">Horario de consulta</h2>{X()}</div>')
    err = (f'<div class="ah-herr"><i>{ic(I["tri"], 24, 2)}</i><b id="ah-he-{vp}">No se pudo cargar el horario</b>'
           f'<p>Cierra y vuelve a abrir esta ventana. Si sigue igual, recarga la página.</p></div>')
    car = '<div class="ah-hcar" role="status" aria-label="Cargando"><span></span><span></span><span></span><span></span></div>'
    pie = (f'<div class="ah-mpie"><button type="button" class="ag0-p ah-b2" data-cierra="1">Cancelar</button>'
           f'<button type="button" class="ag0-p ah-b1" data-guardar="1">Guardar horario</button></div>')
    cuerpo = f'{cab}<div class="ah-cuerpo"><div class="ah-hor">{filas}</div>{err}{car}</div>{pie}'
    return capa('horario', vp, 'Horario de consulta', cuerpo, cab=False, cls='ah-modal')

def ficha5():
    return ('''<h3>Especificación · Horario de consulta (<code>HorarioModal</code>) y «Plegar menú»</h3>
<p><b>Cuándo sale el diálogo de horario:</b> con la agenda v2 encendida, «Configuración de la agenda» lleva a <code>/agenda/configuracion</code> y este diálogo NO se abre desde la agenda (<code>abrirConfiguracion</code>, AgendaCliente.tsx:592). Solo aparece con la v2 apagada (agenda v1, fuera de esta tanda) y desde <code>FilaDisponibilidad</code>, que hoy no monta nadie. Se dibuja para que, si sobrevive, use el mismo lenguaje.</p>
<p><b>Modal</b> 480 (Duo abierto) / 520 (computadora), 310 en Duo cerrado, hoja en iPhone: cabecera con el engrane en cuadro de 32, «Horario de consulta» 17/700 y ✕. Siete filas de 56 separadas por <code>--linea</code> (sin cajas azules): interruptor 40×24 (con nombre accesible: el día; hoy no tiene), el día 15/600 y, si está activo, entrada y salida en campos <code>--sup2</code> (en la app siguen siendo <code>type=time</code>, con su selector nativo) de 44 en táctiles y (36 en ancho) con texto 16/15 tabular; apagado, el día en <code>--tinta2</code> y «Sin consulta». Pie: «Cancelar» (quieto, <code>--sup2</code>) a la izquierda de «Guardar horario» (primario), pegados a la derecha; centrados en Duo vertical; mitad y mitad en teléfono. «Guardando...» deshabilita el principal; al terminar, aviso «Horario actualizado» (o «No se pudo guardar el horario»).</p>
<p><b>Estados:</b> cargando (esqueleto estático) · error: triángulo en círculo rojo suave de 48, «No se pudo cargar el horario» 17/700 y la frase de hoy; «Guardar horario» deshabilitado (no se puede guardar un horario inventado).</p>
<p><b>Plegar menú</b> (Sidebar.tsx: solo en <code>/agenda</code> y desde 1024 px, por eso solo en computadora): última fila de la barra lateral, «Plegar menú» con su icono, como las demás entradas. Plegada, la barra queda en 76 px con iconos (cada entrada conserva su <code>aria-label</code>) y la rejilla gana 172 px; «Desplegar menú» la devuelve. El cambio de ancho no se anima (sería layout): barra y contenido se funden en 160 ms y el contenido queda en su sitio nuevo. La preferencia se guarda en el navegador, como hoy.</p>'''
            + FICHA_COMUN % ('modal centrado de 520 con velo', 'con velo'))

def vista5(vp):
    capas = capa_horario(vp) + menu_ah(vp) + medicos_lb(vp) + plantillas()
    return marco_ah(5, vp, fondo(vp), capas)

# ================================================================== SALIDA ==================================================================
CITAS_JS = {c['id']: {'d': c['d'], 'a': c['a']} for c in CITAS}
TITDIA = {d: {'ancho': f'{DIAS[d][2]}, {DIAS[d][1]} de noviembre de 2026', 'tel': f'{DIAS[d][0]}, {DIAS[d][1]} de noviembre'} for d in range(7)}

def salida(n, archivo, nombre, desc, marcos_html, ficha, tira, **extra):
    tit = dict(TIT); tit['tres'] = {'ancho': '19 – 21 nov 2026', 'tel': '19 – 21 de noviembre'}
    cfg = dict(v=n, ficha=ficha, tira=tira, citas=CITAS_JS, titDia=TITDIA, titulos=tit, toasts=TOASTS, dias=AB['DIA_CORTO'], horario=[list(HORARIO[d]) if HORARIO[d] else None for d in range(7)]); cfg.update(extra)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}</style>\n' + '\n'.join(marcos_html)
           + f'\n<script>\n(function(CFG){{\n{JS}\n(function(CFG){{\n{JS_AF}\n}})({{v: "ah{n}"}});\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = f'{L}/vista-{archivo}.html'
    open(p, 'w').write(out); print(p, len(out))

COMUNES = ['|', ['Movimiento reducido', 'clase:ah-rm', False], ['Transparencia reducida', 'clase:ah-rt', False], ['Cerrar', 'cerrar']]

salida(1, '1-buscar', 'Agenda · Buscar en la agenda',
       'La lupa abre un buscador limpio: un solo campo, pacientes con su avatar y, al elegir uno, sus citas con el icono de estado; elegir una cita salta a su día y abre su burbuja',
       [vista1(vp) for vp in VPS], ficha1(),
       [['abrir buscador', 'abre:buscar'], ['resultados («Prueba 0»)', 'q:prueba 0'], ['cita por ligar («Prueba 2»)', 'q:prueba 2'], ['citas del paciente (22)', 'pac:22'],
        ['sin citas (02)', 'pac:02'], ['sin resultados', 'q:prueba 99'], ['saltar a la cita (vie 20)', 'salta:v3']] + COMUNES)

salida(2, '2-campana', 'Agenda · Campana «Por confirmar y avisos»',
       'La campana abre dos pestañas limpias: por confirmar con WhatsApp y correo en círculos de color con nombre, y avisos con un icono por tipo; vacíos, carga y avisos emergentes',
       [vista2(vp) for vp in VPS], ficha2(),
       [['abrir campana', 'abre:campana'], ['pestaña Avisos', 'tab:av'], ['todos los tipos de aviso', 'avtodos'], ['recordatorio enviado', 'enviado'], ['fila sin medios', 'sinmedios'],
        ['vacío', 'vacio'], ['cargando', 'clase:ah-cargando', False], ['sin tabla de avisos', 'clase:ah-avsin', False], ['aviso emergente', 'toast']] + COMUNES)

salida(3, '3-opciones', 'Agenda · Opciones de la agenda',
       'Un solo menú «Opciones de la agenda» por dispositivo con lo que hoy hay en el engrane y lo que no cabe en la barra; Huecos disponibles en Duo abierto; selector de médico y tarjeta al pasar el ratón en computadora',
       [vista3(vp) for vp in VPS], ficha3(),
       [['abrir opciones', 'abre:menu'], ['submenú Médico', 'sub'], ['Huecos disponibles (Duo abierto)', 'abre:huecos'], ['huecos sin horario', 'clase:ag0-sinhor', False], ['selector de médico (computadora)', 'abre:medico'],
        ['Todos los médicos', 'clase:ag0-sinmed', False], '|', ['vista Día', 'vista:dia', True], ['vista Semana', 'vista:semana', False], ['vista 3 días', 'vista:tres', False], ['vista Mes', 'vista:mes', False], '|',
        ['tarjeta al pasar el ratón (computadora)', 'tlp']] + COMUNES)

salida(4, '4-fecha-leyenda-atajos', 'Agenda · Ir a una fecha, leyenda y atajos',
       'El título es el selector de fecha; la leyenda explica cada estado con una muestra del bloque real y los textos de origen unificados; los atajos, en un diálogo limpio solo en computadora',
       [vista4(vp) for vp in VPS], ficha4(),
       [['Ir a una fecha', 'abre:fecha'], ['Leyenda de estados', 'abre:leyenda'], ['Atajos de teclado (computadora)', 'abre:atajos'], ['atajos apagados', 'atoff']] + COMUNES)

salida(5, '5-horario', 'Agenda · Horario de consulta y menú plegado',
       'El diálogo de horario con siete filas limpias, sin cajas de color y con su error y su carga; y en computadora la barra lateral plegada a iconos para dar más ancho a la rejilla',
       [vista5(vp) for vp in VPS], ficha5(),
       [['Horario de consulta', 'abre:horario'], ['cargando', 'clase:ah-hor-car', False], ['error al cargar', 'clase:ah-hor-err', False], ['guardando', 'guardando'], '|',
        ['menú plegado (computadora)', 'plegar']] + COMUNES)
