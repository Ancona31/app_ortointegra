# Agenda · Semana (prefijo .as). Uso: python3 tmp-as-gen.py  → vista-1…3.html
# Reutiliza las piezas base tal cual: ejecuta tmp-gen.py y tmp-vistas.py de agenda-base SIN su parte de escritura
# (no toca nada de esa carpeta) y construye encima. CSS = nav + estilo base + tmp-as-estilo.css; JS = guion base + tmp-as-guion.js.
import os, re, json, copy

AQ = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.abspath(os.path.join(AQ, '..', 'agenda-base'))
g = {'__file__': os.path.join(BASE, 'tmp-gen.py'), '__name__': 'agenda_base'}
src = open(os.path.join(BASE, 'tmp-gen.py')).read()
exec(compile(src[:src.index('import importlib.util')], 'tmp-gen.py', 'exec'), g)
vs = open(os.path.join(BASE, 'tmp-vistas.py')).read()
exec(compile(vs[:vs.index('# =========================================================== ESCRITURA')], 'tmp-vistas.py', 'exec'), g)

VPS, I, ic, hm, EST, DIAS, HOY = g['VPS'], g['I'], g['ic'], g['hm'], g['EST'], g['DIAS'], g['HOY']
# Piezas reales (INTEGRACION.md): se reutiliza la capa de integración de las piezas base (bloque «INTEGRACIÓN» de
# agenda-base/tmp-vistas.py), que copia en cada build la versión ACTUAL de ag-burbuja, ag-form, ag-ligado, ag-herr y cromo.
_i = vs.index('# =========================================================== INTEGRACIÓN')
exec(compile(vs[_i:vs.index('FICHA_4I =')], 'tmp-vistas.py (integración)', 'exec'), g)
AB = g['AB']
CSS = g['CSS'] + '\n' + g['ICSS'] + '\n' + open(os.path.join(AQ, 'tmp-as-estilo.css')).read()
JS = g['JS'] + '\n' + g['IJS'] + '\n' + open(os.path.join(AQ, 'tmp-as-guion.js')).read()

# ------------------------------------------------------------------ SEMILLA ------------------------------------------------------------------
# La de las piezas base (CITAS, BLOQUEOS, TODO, HORARIO) SIN CAMBIOS, más dos añadidos que esta vista necesita:
#  · miércoles 18: tres eventos de todo el día, para que salga «+1 más» (la banda de Semana tiene tope de 2, VISTAS_FC)
#  · seis citas de la Dra. Invitada Semilla, que solo se ven con «Todos los médicos»
CITAS0 = g['CITAS']
C = g['C']
EXTRA = [C('i1', 0, '09:00', '09:45', 'Paciente Prueba 02', 'conf'), C('i2', 1, '12:00', '12:30', 'Paciente Prueba 14', 'ag'),
         C('i3', 2, '16:00', '17:00', 'Paciente Prueba 17', 'conf'), C('i4', 3, '15:30', '16:00', 'Paciente Prueba 19', 'aten'),
         C('i5', 4, '11:00', '11:30', 'Paciente Prueba 18', 'ag'), C('i6', 5, '10:00', '10:30', 'Paciente Prueba 20', 'conf')]
for c in EXTRA:
    c['med'] = 'DI'; c['st'] = True
    if c['d'] < HOY or (c['d'] == HOY and c['b'] <= g['AHORA']): c['pasado'] = True
REMOTA = C('r1', 4, '14:00', '14:30', 'Paciente Prueba 16', 'ag')   # la crea otra persona (tira «otra persona cambió una cita»)
CITAS_G = [dict(c, med='AS') for c in CITAS0] + EXTRA + [dict(REMOTA, med='AS')]          # rejilla: iniciales siempre montadas, visibles solo con «Todos»
TODO_FULL = copy.deepcopy(g['TODO'])
TODO_FULL[2] = TODO_FULL[2] + [('ev', 'oliva', 'docencia', 'Sesión clínica'), ('ev', 'grafito', 'junta', 'Comité de calidad')]
TOPE = 2
NOM = [d[2] for d in DIAS]
NOMC = [d[0] for d in DIAS]

def mas_btn(d, n):
    return (f'<button type="button" class="ag0-p as-mas" data-abre="mas" aria-haspopup="dialog" '
            f'aria-label="{n} evento{"s" if n > 1 else ""} más de todo el día, {DIAS[d][2].lower()} {DIAS[d][1]}">+{n} más</button>')

def rejilla(vp, dias, scroll=12.0, t0=7, t1=21, minimo=False):
    """La rejilla base con la semilla de esta vista; t0/t1 recortan el rango (Compactar)."""
    g['T0'], g['T1'], g['CITAS'] = t0, t1, CITAS_G
    g['TODO'] = {d: v[:TOPE] if len(v) > TOPE else v for d, v in TODO_FULL.items()}
    h = g['rejilla'](vp, dias, scroll=scroll - (t0 - 7), minimo=minimo)
    g['T0'], g['T1'], g['CITAS'], g['TODO'] = 7, 21, CITAS0, TODO_FULL
    # «+N más» en la celda del día que pasa del tope
    partes = h.split('<div class="ag0-todo-c">')
    for i, d in enumerate(dias):
        n = len(TODO_FULL.get(d, [])) - TOPE
        if n > 0:
            partes[i + 1] = partes[i + 1].replace('</div>', mas_btn(d, n) + '</div>', 1)
    h = '<div class="ag0-todo-c">'.join(partes)
    for c in EXTRA:  # citas de la Dra. Invitada: solo con «Todos los médicos»
        h = re.sub(r'(<button type="button" class=")([^"]*)(" style="[^"]*" data-cita="%s")' % c['id'], r'\1\2 as-st\3', h)
    h = re.sub(r'(<button type="button" class=")([^"]*)(" style="[^"]*" data-cita="r1")', r'\1\2 as-rnueva\3', h)
    # la etiqueta de las 17:00 que tapa la píldora de la hora actual, para cuando la hora actual no se pinta (otra semana)
    if HOY in dias:
        h = h.replace('<div class="ag0-horas">', f'<div class="ag0-horas"><span class="ag0-hr as-hr17" style="top:calc(var(--cal-h) * {17 - t0})">17:00</span>', 1)
    return h

# ------------------------------------------------------------------ LISTA POR DÍA (versión A de la pieza base) ------------------------------------------------------------------
def lista(vp):
    """Copia de lista_semana() de la pieza base con: cabecera de día como enlace a Día (navLinks de hoy), citas de
    «Todos los médicos», tres eventos de todo el día el miércoles y el vacío de la semana entera."""
    sinexp, gcal, est, chip_todo = g['sinexp'], g['gcal'], g['est'], g['chip_todo']
    tira_d = ''
    for i, (c3, n, largo) in enumerate(DIAS):
        k = [c for c in CITAS0 if c['d'] == i]
        pts = ''.join('<i></i>' for _ in range(min(3, len(k) + len(TODO_FULL.get(i, [])))))
        cur = ' aria-current="date"' if i == HOY else ''
        tira_d += (f'<button type="button" class="ag0-p ag0-td" role="tab" aria-selected="{"true" if i == HOY else "false"}" data-d="{i}"{cur} '
                   f'aria-label="{largo} {n}, {len(k)} en la agenda"><span class="ag0-tl">{c3[0]}</span><b>{n}</b><span class="ag0-tpt">{pts}</span></button>')
    filas = ''
    for i, (c3, n, largo) in enumerate(DIAS):
        hoy = ' ag0-ld-hoy' if i == HOY else ''
        base = sorted([c for c in CITAS0 if c['d'] == i], key=lambda c: c['a'])
        todos = sorted(base + [c for c in EXTRA if c['d'] == i] + ([REMOTA] if REMOTA['d'] == i else []), key=lambda c: c['a'])
        cnt = lambda L: f'{sum(1 for c in L if c["tipo"] in ("cita", "gl") and c["id"] != "r1")} cit · {sum(1 for c in L if c["tipo"] in ("ev", "evn")) + len(TODO_FULL.get(i, []))} ev'
        filas += (f'<h3 class="ag0-ld{hoy}" data-ld="{i}"><button type="button" class="ag0-p as-ldb" data-d="{i}" aria-label="{largo} {n}, ver el día">{largo} {n}{" · hoy" if i == HOY else ""}</button>'
                  f'<small><span class="as-cnt-n">{cnt(base)}</span><span class="as-cnt-t">{cnt(todos)}</span></small></h3>')
        for t in TODO_FULL.get(i, []):
            filas += f'<div class="ag0-lf" style="min-height:44px"><span class="ag0-lh">Todo el día</span><span style="flex:1;display:flex">{chip_todo(t)}</span></div>'
        if not todos and not TODO_FULL.get(i):
            filas += '<p class="ag0-lvac">Sin citas este día</p>'
        for c in todos:
            ev = c['tipo'] in ('ev', 'evn')
            cl = f'ag0-b--ev" style="--b-ev:var(--cal-ev-{c["evc"]})' if c['tipo'] == 'ev' else f'ag0-b--{c["e"]}'
            l2 = [f'{round((c["b"] - c["a"]) * 60)} min']
            if c['ori'] == 'enlace': l2.append(f'<span>{ic(I["enlace"], 14, 2)}Reservó por enlace</span>')
            if c['ori'] == 'google': l2.append(f'<span>{gcal(14)}Desde Google Calendar</span>')
            if c['sx']: l2.append(f'<span>{sinexp(14)}Sin expediente</span>')
            if c['obs'] and not c['sx']: l2.append(c['obs'])
            derecha = '' if ev else est(c['e'], texto=False)
            extra = (' ag0-lf--canc' if c['e'] == 'canc' else '') + (' as-st' if c.get('st') else '') + (' as-rnueva' if c['id'] == 'r1' else '')
            filas += (f'<button type="button" class="ag0-p ag0-lf {cl}{extra}" data-cita="{c["id"]}" aria-haspopup="dialog" aria-label="{c["nom"]}, {hm(c["a"])} a {hm(c["b"])}, {"Evento" if ev else EST[c["e"]][0]}">'
                      f'<span class="ag0-lh">{hm(c["a"])}<small>{hm(c["b"])}</small></span><span class="ag0-lb" aria-hidden="true"></span>'
                      f'<span class="ag0-lc"><span class="ag0-ln">{c["nom"]}</span><span class="ag0-l2">{" · ".join(l2)}</span></span>{derecha}{ic(I["sig"], 16, 2.2)}</button>')
    vacia = f'<p class="as-lvacia">{ic(I["agenda"], 28, 1.8)}Sin citas esta semana</p>'
    return f'<nav class="ag0-tira-d" role="tablist" aria-label="Días de la semana">{tira_d}</nav><div class="ag0-sl">{filas}{vacia}</div>'

# ------------------------------------------------------------------ AVISOS, ESQUELETO Y CAPAS PROPIAS ------------------------------------------------------------------
TRI = '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>'

def avisos(vp, periodo='esta semana', rejilla_=True):
    gcal = g['gcal']
    h = (f'<div class="ag0-aviso ag0-av-e" role="alert">{ic(TRI, 16, 2)}<p><b>No se pudo cargar la agenda.</b> Lo que se ve puede estar incompleto o desactualizado.</p><button type="button" class="ag0-p" data-as="reintentar">Reintentar</button></div>'
         f'<div class="ag0-aviso as-av-f" role="alert">{ic(TRI, 16, 2)}<p><b>Faltan citas por mostrar.</b> Este periodo tiene más citas de las que caben en una carga; lo que ves está incompleto.</p></div>'
         f'<div class="ag0-aviso ag0-av-g" role="status">{gcal(16)}<p><b>No se pudo sincronizar con Google Calendar.</b> Tus citas se muestran normal; faltan los eventos del calendario.</p><button type="button" class="ag0-p">Revisar conexión</button></div>')
    globo = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
    h += f'<div class="ag0-aviso as-av-k as-av-h">{ic(globo, 16, 2)}<p>Mostrando el horario de tu ubicación actual (UTC−6, Ciudad de México)</p></div>'
    if rejilla_:  # el vacío de página no sale en las listas (tienen su propio vacío); el compacto solo en rejilla
        h += (f'<div class="ag0-aviso as-av-v" role="status">{ic(I["agenda"], 16, 2)}<p class="as-vf">Ningún evento de Dr. Admin Semilla {periodo}</p><p class="as-vt">Sin citas {periodo}</p>'
              f'<button type="button" class="ag0-p as-vf" data-as="vertodos">Ver todos los médicos</button><button type="button" class="ag0-p as-vt" data-accion="agendar">Agendar</button></div>')
    return h

def aviso_compacto():
    return (f'<div class="ag0-aviso as-av-k" role="status">{ic(I["compactar"], 16, 2)}<p><b>Vista compacta:</b> domingo oculto · horas fuera de horario recortadas</p>'
            f'<button type="button" class="ag0-p" data-as="completa">Mostrar rejilla completa</button></div>')

def H(w, h=12, r=6, st=''):
    return f'<i class="as-h" style="width:{w};height:{h}px;border-radius:{r}px;{st}"></i>'

def esqueleto(vp):
    tel = vp in ('ext', 'tel')
    ico = 44 if vp in ('ext', 'tel', 'iv') else 36
    circ = lambda: H(f'{ico - 14}px', ico - 14, 999)
    if tel:
        f1 = f'<div class="as-esq-f">{H("62%", 22, 7)}<span class="ag0-flex"></span>{circ()}{circ()}</div>'
        f2 = f'<div class="as-esq-f">{H("96px", 20, 7)}<span class="ag0-flex"></span>{H("150px", 36, 12)}</div>'
        td = ''.join(f'<span>{H("12px", 10)}{H("30px", 30, 999)}</span>' for _ in range(7))
        filas = ''
        for w in ('64%', '52%', '70%', '46%', '60%'):
            filas += f'<div class="as-esq-r">{H("40px", 14)}{H("3px", 38, 2)}<span>{H(w, 15)}{H("34%", 11)}</span>{H("26px", 26, 999)}</div>'
        cuerpo = f'<div class="as-esq-t">{td}</div><div class="as-esq-l">{H("44%", 13)}<span style="height:12px"></span>{filas}</div>'
    else:
        tit = {'ih': '58%', 'iv': '46%', 'esc': '30%'}[vp]
        f1 = f'<div class="as-esq-f">{H(tit, 28, 8)}<span class="ag0-flex"></span>{"" if vp == "ih" else circ() + circ()}{H("108px", 36, 12)}</div>'
        f2 = f'<div class="as-esq-f">{H("120px", 22, 7)}<span class="ag0-flex"></span>{H("220px", 32 if vp != "iv" else 40, 12)}</div>'
        dias = '<span></span>' + ''.join(f'<span style="display:flex;gap:6px;align-items:center">{H("22px", 10)}{H("20px", 16)}</span>' for _ in range(7))
        bl = {1: [(.3, .5)], 2: [(.5, .7), (2.6, .6)], 3: [(.1, .9), (1.4, .45), (2.6, 1)], 4: [(.2, 1.1), (2.3, .6)], 5: [(1, .5)], 6: [], 7: []}
        cols = '<span>' + ''.join(H('32px', 12, 6, f'top:{30 + 80 * k - 6}px') for k in range(6)) + '</span>'
        for c in range(1, 8):
            cols += '<span>' + ''.join(H('auto', round(80 * d) - 4, 8, f'top:{30 + round(80 * t)}px') for t, d in bl[c]) + '</span>'
        cuerpo = f'<div class="as-esq-c"><div class="as-esq-d">{dias}</div><div class="as-esq-g">{cols}</div></div>'
    return f'<div class="as-esq" role="status" aria-label="Cargando agenda">{f1}{f2}{cuerpo}</div>'

def capa_mas(vp):
    """«+N más»: el popover de FullCalendar (título dayPopoverFormat «18 de noviembre de 2026» + los eventos del día)."""
    anc = ' ag0-anc ag0-anc-i' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    chips = ''.join(g['chip_todo'](t) for t in TODO_FULL[2])
    return f'''<div class="ag0-capa{velo}" data-capa="mas" aria-hidden="true">
  <div class="ag0-velo" data-cierra="1"></div>
  <div class="ag0-cj as-pop{anc}" role="dialog" aria-label="18 de noviembre de 2026"><span class="ag0-asa" aria-hidden="true"></span>
    <div class="ag0-cjc"><h2>18 de noviembre de 2026</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
    <div class="as-pop-l">{chips}</div></div>
</div>'''

def capa_aviso(n, vp):
    """El aviso de confirmación de hoy (ConfirmModal): un mensaje y «Cancelar» / «Aceptar». Sin título: hoy no lo tiene."""
    i = f'as{n}-{vp}-al'
    return f'''<div class="ag0-capa" data-capa="aviso" aria-hidden="true">
  <div class="ag0-velo" data-al="no"></div>
  <div class="ag0-cj as-al" role="dialog" aria-modal="true" aria-labelledby="{i}">
    <span class="as-al-i" aria-hidden="true">{ic(TRI, 28, 2)}</span>
    <h2 class="as-al-h" id="{i}"></h2><p class="as-al-t"></p>
    <div class="as-al-b"><button type="button" class="ag0-p as-al-no" data-al="no">Cancelar</button><button type="button" class="ag0-p as-al-si" data-al="si">Aceptar</button></div>
  </div>
</div>'''

TOAST = (f'<div class="as-toast" role="status" aria-live="polite"><i aria-hidden="true"><span class="as-t-ok">{ic(I["palomita"], 14, 2.6)}</span>'
         f'<span class="as-t-mal">{ic(I["x"], 14, 2.6)}</span><span class="as-t-maq">{ic(I["info"], 14, 2.4)}</span></i><span class="as-t-txt"></span></div>')

TODO_IDS = {'Curso de actualización': ('td1', 3), 'Guardia': ('td2', 2), 'Sesión clínica': ('td3', 2), 'Comité de calidad': ('td4', 2)}
def plantillas_extra():
    """La burbuja REAL (ag-burbuja) para las citas y eventos que añade esta vista, con el formato de plantilla de su guion."""
    t = ''
    for c in EXTRA + [REMOTA]:
        k = dict(medico=('IS', 'Dra. Invitada Semilla'), puede=False) if c.get('st') else {}
        t += AB['tpl']('b:' + c['id'], 'bu', AB['burbuja'](c, **k), ancla=c['id'], titulo=c['nom'])
    for nom, (i, d) in TODO_IDS.items():
        if i == 'td1': continue
        td = dict(id=i, d=d, a=0, b=24, nom=nom, e='ag', tipo='ev', ori='', obs=None, tel=None, cons=None, sx=False)
        t += AB['tpl']('b:' + i, 'bu', AB['burbuja'](td, todo=True), ancla=i)
    return g['_cablea'](t)

def proxys():
    # la fila de la lista abre la burbuja de su cita: el guion de ag-burbuja escucha bloques .ag0-b[data-cita]
    ids = [c['id'] for c in CITAS0 + EXTRA + [REMOTA]]
    return '<span hidden class="as-px">' + ''.join(f'<button type="button" class="ag0-b" data-cita="{i}" tabindex="-1" aria-hidden="true"></button>' for i in ids) + '</span>'

def chips_con_cita(h):
    # los chips de todo el día abren su burbuja (hoy: la del evento); el bloqueo de todo el día abre su edición
    for nom, (i, d) in TODO_IDS.items():
        h = h.replace(f'aria-label="{nom}, todo el día, evento"', f'aria-label="{nom}, todo el día, evento" data-cita="{i}"')
    return h.replace('aria-label="Bloqueado · Vacaciones, todo el día"', 'aria-label="Bloqueado · Vacaciones, todo el día" data-bloqueo="bq3"')

def capas(n, vp):
    return g['piezas_reales'](vp, 'S' + n[-1], False) + plantillas_extra() + capa_mas(vp) + capa_aviso(n, vp) + TOAST + proxys()

def marco(n, vp, contenido, extra_cls=''):
    h = g['marco'](n, vp, contenido, capas(n, vp))
    h = h.replace(f'class="marco ag0 ag0-v{n}"', f'class="marco ag0 ag0-v{n} as ab ab-vI{n} af al ah cr4{extra_cls}"', 1)
    h = g['_barra_int'](chips_con_cita(h))
    if vp in ('ext', 'tel'):  # en la lista no hay rejilla: «Compactar» no se ofrece (vistaAdmiteCompactar, como hoy)
        h = re.sub(r'<button type="button" class="ag0-p ag0-op" role="menuitemcheckbox"[^>]*>(?:(?!</button>).)*Compactar la rejilla.*?</button>', '', h, flags=re.S)
    return h

def barra(vp, vista='semana', titulo=None, seg_semana=None):
    b, flota = g['barra'](vp, vista)
    if titulo:
        t0 = g['TIT'][vista]['tel' if vp in ('ext', 'tel') else 'ancho']
        b = b.replace(t0, titulo)
    if seg_semana:
        b = b.replace('data-vista="semana">Semana</button>', f'data-vista="semana">{seg_semana}</button>')
    return b, flota

def salida(n, archivo, nombre, desc, marcos, ficha, tira, **extra):
    cfg = dict(v=n, ficha=ficha, tira=tira); cfg.update(extra)
    cab = dict(v='I' + n, tira=[], estados=g['EST_I'], dias=AB['DIA_CORTO'], horario=g['HORARIO'], saltos={}, alta=True, hover=(n == 'as1'))
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>'
           + f'\n<script>\n(function(CFG){{\n{g["ABJS"]}\n}})({json.dumps(cab, ensure_ascii=False)});\n</script>\n')
    # comentarios heredados que hablan del reparto del trabajo: fuera (no son de esta vista)
    out = re.sub(r'/\*(?:(?!\*/).)*?agente(?:(?!\*/).)*?\*/', '', out, flags=re.S)
    out = re.sub(r'<!--(?!\s*NOMBRE)(?:(?!-->).)*?agente(?:(?!-->).)*?-->', '', out, flags=re.S)
    p = os.path.join(AQ, f'vista-{archivo}.html')
    open(p, 'w').write(out); print(p, len(out))

AS_CFG = dict(horario={str(k): (list(v) if v else None) for k, v in g['HORARIO'].items()}, t1=21,
              dia=[d[2].lower() for d in DIAS], plural=['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos'],
              nom=NOM, nomc=NOMC,
              remoto=dict(ico=ic(I['x'], 13, 2.4), chip=f'<i>{ic(I["x"], 12, 2.4)}</i><span>Cancelada</span>', est=g['est']('canc', texto=False)),
              est={k: dict(t=EST[k][0], ico=ic(I[EST[k][1]], 13, 2.4), chip=f'<i>{ic(I[EST[k][1]], 12, 2.4)}</i><span>{EST[k][0]}</span>', circ=g['est'](k, texto=False)) for k in EST})

def dia_tpl(vp, d):
    rj = rejilla(vp, [d], scroll=12)
    if vp == 'esc' and d == HOY:
        rj = f'<div class="ag0-diap">{rj}{g["panel_dia"]()}</div>'
    return f'<template data-as-dia="{d}">{rj}</template>'

# =========================================================== VISTA 1 · SEMANA ===========================================================
def vista1(vp):
    b, flota = barra(vp)
    if vp in ('ext', 'tel'):
        cuerpo = f'<div class="as-sem">{avisos(vp, rejilla_=False)}{lista(vp)}</div>'
        tpls = ''.join(dia_tpl(vp, d) for d in range(7))
        return f'<main class="ag0-cont">{esqueleto(vp)}{b}{cuerpo}<div class="as-dia"></div>{tpls}{flota}</main>'
    norm = f'<div class="as-m-norm">{rejilla(vp, list(range(7)), scroll=12)}</div>'
    comp = f'<div class="as-m-comp">{aviso_compacto()}{rejilla(vp, list(range(6)), scroll=12, t0=8, t1=20)}</div>'
    tpls = ''.join(dia_tpl(vp, d) for d in range(7))
    return f'<main class="ag0-cont">{esqueleto(vp)}{b}<div class="as-sem">{avisos(vp)}{norm}{comp}</div><div class="as-dia"></div>{tpls}{flota}</main>'

FICHA_1 = '''<h3>Especificación · Semana</h3>
<p><b>Qué es lo importante:</b> ver la semana entera de un vistazo y llegar a una cita en un toque. La barra, los bloques, la rejilla, los avisos, las capas y la navegación son las <b>piezas base aprobadas</b> (<code>.ag0-*</code>), sin reinterpretar; lo propio de esta vista lleva <code>.as-*</code>.</p>
<table><thead><tr><th></th><th>Duo cerrado · iPhone</th><th>Duo abierto (h y v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Composición</th><td>Barra (dos filas) → tira de fechas (7 botones, hoy en círculo, elegido sobre --fondo, puntos de ocupación) → lista por día con cabecera fija</td><td colspan="2">Barra → avisos → tarjeta de la rejilla de 7 columnas (78 px en Duo h, 81 en Duo v, 132 en computadora); se abre a las 12:00</td></tr>
<tr><th>Cabecera de día</th><td>«JUEVES 19 · HOY» es un enlace a ese Día (hoy <code>navLinks</code>); a su derecha «12 cit · 2 ev» como en el Mes</td><td colspan="2">botón «Jue 19» (abre ese Día); hoy en círculo --cal-hoy-num y columna --cal-hoy</td></tr>
<tr><th>Todo el día</th><td>filas «Todo el día» al principio de cada día, todas (la lista no tiene tope)</td><td colspan="2">fila fija con tope de 2 (el de hoy, <code>VISTAS_FC</code>) y «+1 más» en --enlace 12/600, que abre la lista del día</td></tr>
<tr><th>Agendar</th><td>«+» del riel · píldora flotante en iPhone</td><td colspan="2">primario en la barra</td></tr>
</tbody></table>
<h4>Semilla</h4>
<p>La de las piezas base, igual para todas las vistas de agenda: lunes y martes pasados (atendidas, cancelada, no asistió, evento «Junta de servicio»), miércoles con «Guardia» y otros dos eventos de todo el día (añadidos aquí para que se vea «+1 más»), <b>jueves 19 hoy</b> con 13 citas, solape a las 18:20 (cita por enlace + evento de Google por asignar) y bloqueo «Comida», viernes con bloqueo «Congreso» que sale del horario (el rayado se corta a las 19:00), sábado con horario corto (9–14) y <b>domingo sin horario ni citas</b> (solo «Bloqueado · Vacaciones» de todo el día). Con «Todos los médicos» se suman seis citas de la Dra. Invitada Semilla.</p>
<h4>Estados</h4>
<ul><li><b>Cargando:</b> esqueleto que replica la pantalla (barra, tira/rejilla y filas) en --sup2, sin brillo en bucle; <code>role="status"</code> «Cargando agenda» (loading.tsx).</li>
<li><b>Recargando:</b> la tarjeta se atenúa al 55 % como hoy (<code>ag-cargando</code>) y una raya de 3 px en --accion recorre su borde superior; con movimiento reducido la raya queda quieta. Con el aviso de error la tarjeta también queda al 55 % (<code>ag-desactualizada</code>).</li>
<li><b>Vacía:</b> en rejilla, aviso de página «Ningún evento de Dr. Admin Semilla esta semana» + «Ver todos los médicos»; con «Todos», «Sin citas esta semana» + «Agendar» (textos de AvisosAgenda.tsx). En la lista, su propio vacío «Sin citas esta semana» (renderSinEventos.tsx).</li>
<li><b>Todos los médicos:</b> el selector dice «Todos los médicos», aparecen las citas de la otra médica y cada bloque lleva las iniciales («AS», «DI»; <code>doctorInitial</code> de hoy). En la lista de teléfono hoy no hay iniciales (FilaLista no las recibe): no se añaden.</li>
<li><b>Compactar</b> (solo rejilla; en la lista hoy no se ofrece y se quita del menú): la rejilla se recorta a 08:00–20:00 y el domingo (sin horario) se pliega; aviso «Vista compacta: domingo oculto · horas fuera de horario recortadas» + «Mostrar rejilla completa» (avisoDeRecorte). ASUMIENDO que el bloqueo de todo el día no cuenta como actividad: si cuenta, el domingo no se plegaría.</li>
<li><b>Densidad compacta</b> (engrane de computadora): 48 px por hora; el bloque de 15 min solo enseña color.</li>
<li><b>Avisos de página:</b> error con «Reintentar» (vuelve a cargar la semana), «Faltan citas por mostrar.» (sin acción en Semana, como hoy), Google con «Revisar conexión», y la leyenda de husos «Mostrando el horario de tu ubicación actual (UTC−6, Ciudad de México)» (sin acción ni rol, solo describe). En Duo h no pasan de 431 px.</li></ul>
<h4>Tiempo real: otra persona cambió una cita (pieza común <code>ag0-remoto</code> / <code>ag0-saliendo</code>)</h4>
<p>Lo que hoy hace <code>useTiempoRealAgenda.ts</code> + <code>marcasMovimiento.ts</code>, redibujado. La tira lo reproduce sobre el viernes 20 (la lista baja a ese día):</p>
<ul><li><b>Nueva</b> (un INSERT de otra persona, o un UPDATE que trae a la vista una cita que no estaba pintada): el bloque entra (opacidad 0→1, 4 px y escala .97→1, resorte .46 s) y un <b>anillo</b> de 2 px en --enlace por dentro de la caja se enciende y se apaga UNA vez (opacidad 0→1→0, 560 ms, empieza a los 160 ms). Hoy: <code>ag-entra</code> 180 ms + <code>ag-pulso</code> 240 ms tras 180 ms. En lista, solo opacidad y el mismo anillo alrededor de la fila (un <code>&lt;tr&gt;</code> no se traslada hoy).</li>
<li><b>Movida</b> (UPDATE de una cita ya pintada): se <b>desliza</b> a su hora nueva desde la vieja (FLIP con resorte); sin anillo, como hoy (F2.6). Si cambia de columna, o en la lista, aparece en su sitio sin viaje.</li>
<li><b>Cancelada</b>: el bloque se queda y cambia de color de golpe (spec §8 de hoy: la cancelación no es una salida).</li>
<li><b>Eliminada</b> (DELETE): se funde a 0 en 120 ms con salida acelerada y se quita; sin escala (<code>ag-sale</code>).</li></ul>
<p>Con movimiento reducido: nada se traslada ni escala; solo queda el fundido del anillo (y el de la salida). Sin bucles.</p>
<h4>A dónde lleva cada control</h4>
<ul><li><b>Bloque, fila de la lista y chip de todo el día</b> → la burbuja de la cita (ver «Burbuja de la cita» en la página Cita; aquí va copiada con su contenido por estado). Dentro: «Editar», el lápiz «Más opciones de la cita», «Reagendar», «Darle otra cita» y «Convertir en cita» abren el formulario completo (ver «Formulario de cita», «Reagendar y Convertir en cita» en la página Cita; copiado aquí con su guion); «Confirmar» despliega sus envíos; «Cancelar cita», «No asistió», «Eliminar evento» y «Eliminar cita» piden su confirmación con verbo y cambian la cita en la rejilla con su aviso arriba; «Reasignar el horario» abre la burbuja de alta en ese hueco.</li>
<li><b>Hueco</b> (tocar o arrastrar, Duo abierto y computadora) → la burbuja de alta (página Cita); fuera de horario, antes «¿Es correcto?» con «Agendar». «Más opciones» de la alta → formulario.</li>
<li><b>Bloqueo</b> (franja o chip de todo el día) y «Bloquear horario» del menú → «Bloqueo de horario» / «Bloquear horario» (página Cita, «Evento y bloqueo»).</li>
<li><b>Agendar</b> (barra, «+» del riel, píldora de iPhone, aviso de vacío) → formulario «Nueva cita».</li>
<li><b>Barra:</b> ‹ Hoy › y deslizar cambian de semana (todas las semanas llevan semilla: las futuras agendadas o confirmadas, las pasadas atendidas); el número de día, la tira de fechas de la lista y «Día» abren el Día; «Mes» y «3 días» llevan a su vista en esta misma página (desplazamiento y realce); el título abre «Ir a una fecha», que lleva al Día elegido; en «Opciones», Compactar, Densidad, Pop-up y Médico actúan sobre la rejilla.</li>
<li><b>Sin parte visual aquí:</b> «Iniciar consulta» y «Ver la consulta» salen de la agenda (nueva nota y expediente): la burbuja se cierra. «Revisar conexión» lleva a Mi perfil. La navegación (riel, barra lateral, menú) lleva a otras secciones.</li></ul>'''

TIRA_1 = [['Cargando (esqueleto)', 'x:as-cargando', False], ['Recargando', 'x:as-recarga', False], ['Semana vacía', 'x:as-vacia', False],
          ['Todos los médicos', 'x:as-todos+ag0-sinmed', False], ['Compactar', 'x:as-compacta', False], ['Densidad compacta', 'x:ag0-densa-m', False], '|',
          ['aviso de error', 'x:ag0-ave', False], ['aviso «Faltan citas»', 'x:as-avf', False], ['aviso de Google', 'x:ag0-avg', False], ['leyenda de husos', 'x:as-avh', False], '|',
          ['otra persona cambió una cita · nueva', 'r:nueva'], ['· movida', 'r:movida'], ['· cancelada', 'r:cancelada'], ['· eliminada', 'r:eliminada'], '|',
          ['burbuja (07)', 'abu:j10'], ['«+1 más»', 'g:mas'], ['opciones', 'menu'], ['Ir a una fecha', 'fecha'], ['Cerrar', 'cerrar']]

# =========================================================== VISTA 3 · GESTOS ===========================================================
def vista3(vp):
    b, flota = barra(vp)
    if vp in ('ext', 'tel'):
        sem = f'<div class="as-sem">{lista(vp)}</div>'
    else:
        sem = f'<div class="as-sem">{avisos(vp)}{rejilla(vp, list(range(7)), scroll=12)}</div>'
    tpls = ''.join(dia_tpl(vp, d) for d in range(7))
    return f'<main class="ag0-cont">{b}{sem}<div class="as-dia"></div>{tpls}{flota}</main>'

FICHA_3 = '''<h3>Especificación · gestos de la Semana</h3>
<p>Todo se puede probar con el ratón (los marcos táctiles piden el toque sostenido, como el dedo). Las reglas al soltar son las de hoy (<code>guardadoCitas.ts</code>): primero los vetos, luego el aviso de horario y luego el de empalme, uno tras otro; si no hay nada que avisar, se guarda sin preguntar y sale el aviso emergente «Se movió en la agenda» con un halo verde en la cita (el «glow» de hoy).</p>
<table><thead><tr><th>Gesto</th><th>Dónde (hoy)</th><th>Antes → durante → después</th><th>Confirmación de hoy</th></tr></thead><tbody>
<tr><th>Arrastrar una cita a otro día u hora</th><td>Duo h, Duo v y computadora (rejilla). En el teléfono la Semana es lista: no hay arrastre</td><td>computadora: se levanta al moverse 8 px; táctil: toque sostenido (450 ms en la maqueta; FullCalendar trae 1 s por defecto). Se levanta (escala 1,03 + sombra de capa), deja el fantasma discontinuo en su sitio y cae en el turno de 15 min más cercano; la hora del bloque es la del destino</td><td>fuera de horario: «Vas a moverlo a las HH:MM, y este consultorio atiende de … a …. ¿Es correcto?» o «Terminaría a las …»; empalme: «Se empalma con «…» (…–…). ¿Guardar de todos modos?». Botones «Cancelar» · «Mover». «Cancelar», el velo o Escape la devuelven deslizándose (FLIP). Vetos sin pregunta, con aviso emergente rojo: horario bloqueado y cita reservada por enlace</td></tr>
<tr><th>Estirar para cambiar la duración</th><td>igual</td><td>asa de 22×4 en el borde inferior (en computadora aparece al pasar el ratón); fantasma de la duración anterior; la hora de fin cambia en vivo</td><td>«¿Es correcto?» con «Empezaría a las …» / «Terminaría a las …», y «¿Guardar de todos modos?» con el empalme; botones «Cancelar» · «Guardar»</td></tr>
<tr><th>Arrastrar en un hueco para crear</th><td>solo Duo h, Duo v y computadora (CALMA §28)</td><td>la franja crece de 30 en 30 min con «13:00 – 14:30» en vivo; al soltar queda marcada y se abre la burbuja de alta (página Cita)</td><td>ninguna (los avisos salen en el alta)</td></tr>
<tr><th>Deslizar para cambiar de semana</th><td>listas del teléfono (Duo cerrado, iPhone) y Duo vertical, que hoy recibe la lista. En Duo h hoy no existe: no se dibuja</td><td>la semana sigue al dedo con resistencia 0,6; pasa con 64 px o 0,4 px/ms; si pasa, sale por su lado y la otra entra con resorte; si no, vuelve con resorte desde donde esté (interrumpible)</td><td>ninguna. ‹ › siguen siendo la alternativa (WCAG 2.5.1)</td></tr>
<tr><th>Número de día → Día</th><td>todos</td><td>respuesta al apoyar (escala .97); la semana se funde y el Día entra con una escala corta desde el centro; el segmentado pasa a «Día» y el título al día largo. «Semana» vuelve</td><td>—</td></tr>
<tr><th>«+N más» en todo el día</th><td>rejilla (la lista no tiene tope)</td><td>abre la lista del día: tarjeta centrada con velo en Duo; menú anclado sin velo en computadora</td><td>—</td></tr>
</tbody></table>
<h4>Movimiento</h4>
<p>Resorte sin rebote (amortiguación 1, respuesta .35 s) escrito con <code>linear()</code> y WAAPI; solo <code>transform</code> y <code>opacity</code>; todo interrumpible desde el valor presente. Con movimiento reducido: sin desplazamientos, fundidos de 160 ms y la cita vuelve a su sitio sin viaje.</p>
<p>Todas las semanas tienen semilla (la de esta, con el estado que le toca a cada cita según caiga antes o después de hoy), así que el Día se abre con citas desde cualquier semana.</p>
<p>La tarjeta de lectura al pasar el ratón («Pop-up de eventos») es la burbuja anclada: ver «Tarjeta al pasar el ratón» en la página Cita.</p>'''

TIRA_3 = [['arrastrar · antes', 'g:arr-antes'], ['durante', 'g:arr-durante'], ['aviso de horario', 'g:arr-aviso'], ['después', 'g:arr-despues'], '|',
          ['estirar · durante', 'g:est-durante'], ['aviso de empalme', 'g:est-aviso'], ['después', 'g:est-despues'], '|',
          ['crear en hueco · durante', 'g:hue-durante'], ['después', 'g:hue-despues'], '|',
          ['deslizar · durante', 'g:des-durante'], ['después', 'g:des-despues'], '|',
          ['número de día · durante', 'g:dia-durante'], ['después (Día)', 'g:dia-despues'], '|', ['«+1 más»', 'g:mas'], ['Cerrar', 'cerrar']]

# =========================================================== ESCRITURA ===========================================================
salida('as1', '1-semana', 'Agenda · Semana',
       'La semana con las piezas aprobadas: lista por día con tira de fechas en Duo cerrado e iPhone y rejilla de siete columnas en Duo abierto y computadora, con todos sus estados (carga, recarga, vacía, todos los médicos, compactar, densidad y avisos)',
       [marco('as1', vp, vista1(vp), ' as-g') for vp in VPS], FICHA_1, TIRA_1, **{'as': dict(AS_CFG, gestos=True)})
salida('as3', '2-gestos', 'Agenda · Gestos de la Semana',
       'Arrastrar, estirar, crear en un hueco, deslizar de semana, ir al Día desde su número y «+N más», con las confirmaciones que pide hoy el código; se pueden probar con el ratón',
       [marco('as3', vp, vista3(vp), ' as-g') for vp in VPS], FICHA_3, TIRA_3, **{'as': dict(AS_CFG, gestos=True)})
