# Agenda · Mes (fase 2). Uso: python3 tmp-gen.py → vista-1-mes.html, vista-2-mas.html
# Reutiliza las piezas base SIN tocarlas: ejecuta la parte de funciones de agenda-base/tmp-gen.py (sin su escritura de vistas)
# y construye encima con el prefijo .am (marco = "marco ag0 am ag0-vmN").
import os, re, json, datetime as dt
AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(AQUI, '..', 'agenda-base')
src = open(os.path.join(BASE, 'tmp-gen.py')).read()
src = src[:src.index('import importlib.util')]
G = {'__file__': os.path.join(BASE, 'tmp-gen.py'), '__name__': 'base'}
exec(compile(src, 'agenda-base/tmp-gen.py', 'exec'), G)
for k in ('ic', 'I', 'EST', 'est', 'hm', 'gcal', 'sinexp', 'CITAS', 'TODO', 'BLOQUEOS', 'DIAS', 'HOY', 'chip_todo', 'riel', 'lateral',
          'encabezado', 'enc_iv', 'barra', 'capa_fecha', 'capa_burbuja', 'burbuja', 'rejilla', 'op', 'sw', 'VPS', 'corto'):
    globals()[k] = G[k]
CSS_BASE, JS_BASE = G['CSS'], G['JS']

# ------------------------------------------------------------------ FECHAS ------------------------------------------------------------------
D0 = dt.date(2026, 10, 26)          # lunes de la primera fila del mes
HOYF = dt.date(2026, 11, 19)        # jueves 19, hoy
SEM0 = 21                            # el lunes 16 es el día 21 de la rejilla del mes
NDIAS = 42
DL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
DC = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
DN = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MCORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
def F(o): return D0 + dt.timedelta(days=o)
def largo(o): f = F(o); return f'{DL[f.weekday()]} {f.day} de {MESES[f.month - 1]}'
def panel_t(o):  # PanelDelDia: «Vie 20 de nov · hoy» (captura de hoy)
    f = F(o); return f'{DC[f.weekday()]} {f.day} de {MCORTO[f.month - 1]}' + (' · hoy' if f == HOYF else '')
def alta_t(o):   # etiquetaBurbuja sin hora: «Nueva cita · vie 27»
    f = F(o); return f'Nueva cita · {DC[f.weekday()].lower().replace("á", "a").replace("é", "e")} {f.day}'
OFF_HOY = (HOYF - D0).days
def pasado(o, b): return o < OFF_HOY or (o == OFF_HOY and b <= G['AHORA'])

# La burbuja de la base dice el día con dia_largo(d) de la semana 16–22; aquí d ≥ 100 = día absoluto del mes
_dl = G['dia_largo']
G['dia_largo'] = lambda d: largo(d - 100) if d >= 100 else _dl(d)

# ------------------------------------------------------------------ SEMILLA DEL MES ------------------------------------------------------------------
# La semana 16–22 es la de la base (CITAS, TODO, BLOQUEOS); el resto del mes se rellena con el mismo criterio (datos ficticios).
H = lambda s: int(s[:2]) + int(s[3:]) / 60
def cita(o, a, b, n, e='ag', **k):
    c = dict(id=k.pop('id', f'c{o}-{a.replace(":", "")}'), o=o, d=100 + o, a=H(a), b=H(b), nom=n, e=e, tipo='cita', cons='Centro', tel=None, obs=None, ori='', sx=False, evc=None, evi=None)
    c.update(k)
    if c['tipo'] == 'cita' and c['tel'] is None and n.startswith('Paciente Prueba'): c['tel'] = '999 000 00' + n[-2:]
    c['pasado'] = pasado(o, c['b'])
    return c

HORAS = [('08:00', '08:30'), ('09:00', '09:30'), ('10:00', '10:45'), ('11:30', '12:00'), ('12:00', '13:00'), ('13:00', '13:15'), ('16:00', '16:45'), ('17:00', '17:30'), ('18:00', '18:30')]
ITEMS = {o: [] for o in range(NDIAS)}
TODOS = {o: [] for o in range(NDIAS)}      # todo el día: (tipo, color, icono, texto, pos) pos = 'solo'|'ini'|'med'|'fin'
for o in range(NDIAS):
    if SEM0 <= o < SEM0 + 7: continue
    wd = F(o).weekday()
    if wd == 6: continue
    n = 1 + (o * 5) % 2 if wd == 5 else 2 + (o * 7) % 5
    hs = [HORAS[(o * 3 + i * 4) % len(HORAS)] for i in range(n)]
    hs = sorted(set(hs), key=lambda x: x[0])
    if wd == 5: hs = [h for h in hs if h[0] < '13:00'] or [('10:00', '10:45')]
    for i, (a, b) in enumerate(hs):
        num = (o * 3 + i * 5) % 25 + 1
        if o < OFF_HOY:
            e = 'canc' if (o + i) % 7 == 3 else 'noas' if (o + i) % 11 == 5 else 'aten'
        else:
            e = 'conf' if (o + i) % 3 == 0 else 'ag'
        ITEMS[o].append(cita(o, a, b, f'Paciente Prueba {num:02d}', e))
    if wd == 0:
        ITEMS[o].append(cita(o, '14:00', '15:00', 'Junta de servicio', 'ag', tipo='ev', evc='indigo', evi='junta', tel=None))
# Semana de la base. HOY (jueves 19) se aligera para el Mes: la semilla de la base trae 13 citas, una carga de muestrario,
# no de un día real. Se quedan 5 + el evento de todo el día + el bloqueo (8 con la reserva por enlace). El salto al Día usa la misma.
KEEP19 = {'j3', 'j7', 'j8', 'j10', 'j12', 'j13'}
CITAS = [c for c in CITAS if c['d'] != 3 or c['id'] in KEEP19]
G['CITAS'] = CITAS
for c in CITAS:
    k = dict(c); o = SEM0 + c['d']; k['o'] = o; k['d'] = 100 + o
    if c['id'] == 'j8': k['rsv'] = True            # la reserva por enlace de la captura «con reserva»
    ITEMS[o].append(k)
for d, lst in TODO.items():
    for t in lst: TODOS[SEM0 + d].append(t + ('solo',))
# Extras para que el mes enseñe todos los casos
def bq(o, a, b, t): return dict(id=f'b{o}', o=o, a=H(a), b=H(b), nom=t, tipo='bq')
BQ = {SEM0 + b['d']: [dict(id=b['id'], o=SEM0 + b['d'], a=b['a'], b=b['b'], nom=b['t'], tipo='bq')] for b in BLOQUEOS}
BQ[(dt.date(2026, 11, 10) - D0).days] = [bq((dt.date(2026, 11, 10) - D0).days, '11:00', '12:00', 'Bloqueado · Trámite')]
for o, pos in ((7, 'ini'), (8, 'med'), (9, 'fin')):   # 2–4 de noviembre: evento de varios días
    TODOS[o].insert(0, ('ev', 'oliva', 'docencia', 'Congreso de ortopedia', pos, 3))
# Variante «estirando» (eventResize de un evento de todo el día): el congreso se alarga hasta el jueves 5
TODOS_E = {o: list(v) for o, v in TODOS.items()}
for o, pos in ((7, 'ini'), (8, 'med'), (9, 'med'), (10, 'fin')):
    TODOS_E[o] = [x for x in TODOS_E[o] if x[3] != 'Congreso de ortopedia']
    TODOS_E[o].insert(0, ('ev', 'oliva', 'docencia', 'Congreso de ortopedia', pos, 4, 'est'))
VARIA_E = (7, 9, 10)
o25 = (dt.date(2026, 11, 25) - D0).days
ITEMS[o25].append(cita(o25, '09:00', '09:30', 'Revisión de estudios', 'ag', tipo='gl', ori='google', sx=True, tel=None, cons=None, id='g25'))
o26 = (dt.date(2026, 11, 26) - D0).days
ITEMS[o26].append(cita(o26, '10:00', '10:30', 'Paciente Prueba 21', 'ag', ori='enlace', sx=True, id='e26'))
for o in ITEMS: ITEMS[o].sort(key=lambda c: c['a'])
TODAS = [c for o in ITEMS for c in ITEMS[o]]

def lista_dia(o, rsv=False, est=False):
    """Lo que hay en el día, en orden: todo el día, luego por hora (bloqueos con hora incluidos)."""
    t = [('todo', x) for x in (TODOS_E if est else TODOS)[o]]
    h = [('cita', c) for c in ITEMS[o] if rsv or not c.get('rsv')] + [('bq', b) for b in BQ.get(o, [])]
    h.sort(key=lambda x: x[1]['a'])
    return t + h
def tiene_rsv(o): return any(c.get('rsv') for c in ITEMS[o])
def conteo(o, rsv=False):  # frasearConteoBreve (lib/agenda/conteoAgenda.ts:285)
    ks = [c for c in ITEMS[o] if rsv or not c.get('rsv')]
    nc = sum(1 for c in ks if c['tipo'] in ('cita', 'gl')); ne = sum(1 for c in ks if c['tipo'] in ('ev', 'evn'))
    p = ([f'{nc} cit'] if nc else []) + ([f'{ne} ev'] if ne else [])
    return ' · '.join(p)

# ------------------------------------------------------------------ LA CELDA DE MES (.am-ch) ------------------------------------------------------------------
K_LINEAS = {'esc': 3, 'ih': 2, 'iv': 2}     # líneas por celda (ver PIEZAS-MES.md §3)
GLOBO = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>'
TRI = '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>'

def etiqueta(c):
    if c['tipo'] == 'bq': return f'{c["nom"]}, {hm(c["a"])} a {hm(c["b"])}. Editar bloqueo'
    p = [c['nom'], f'{hm(c["a"])} a {hm(c["b"])}', 'Evento' if c['tipo'] in ('ev', 'evn') else EST[c['e']][0]]
    if c['ori'] == 'enlace': p.append('Reservó por enlace')
    if c['ori'] == 'google': p.append('Agendada desde Google Calendar')
    if c['sx']: p.append('Sin expediente')
    return ', '.join(p)

def clases_estado(c):
    cl = []
    if c['tipo'] == 'ev': cl.append('ag0-b--ev')
    else:
        cl.append(f'ag0-b--{c["e"]}')
        if c['tipo'] == 'evn': cl.append('ag0-b--evn')
    if c.get('pasado'): cl.append('ag0-b--pasado')
    if c['sx']: cl.append('ag0-b--lig')
    return cl

def chip(kind, x, o, lunes=False):
    """Un renglón de la celda del mes. Todo el chip es el botón (abre la burbuja; el bloqueo, su edición)."""
    if kind == 'todo':
        tipo, col, i, txt, pos = x[:5]
        span = x[5] if len(x) > 5 else 1
        est = len(x) > 6
        cont = pos in ('med', 'fin') and not lunes
        if cont:   # los días siguientes solo guardan el renglón: el chip del primer día los cruza (usa el ancho de sus días)
            return '<span class="am-ch am-ch-ph" aria-hidden="true"></span>'
        cl = 'ag0-p am-ch am-ch-todo' + (' am-ch-bq' if tipo == 'bq' else ' ag0-b--ev') + ('' if pos == 'solo' else f' am-ch--ini am-ch--span') + (' am-ch-est' if est else '')
        st = f'--span:{span};' + ('' if tipo == 'bq' else f'--b-ev:var(--cal-ev-{col})')
        rango = (', del 2 al 5 de noviembre' if est else ', del 2 al 4 de noviembre') if pos != 'solo' else ''
        lab = f'{txt}, todo el día' + (', evento' if tipo == 'ev' else '. Editar bloqueo') + rango
        asas = '<span class="am-asa am-asa-i" aria-hidden="true"></span><span class="am-asa am-asa-f" aria-hidden="true"></span>' if tipo == 'ev' else ''
        cuerpo = f'<span class="am-ch-i">{ic(I[i], 12, 2.2)}</span><span class="am-ch-n am-ch-t" data-t="{txt}">{txt}</span>{asas}'
        dato = f' data-cita="td{o}-{txt[:6]}" data-ir="b:td{o}-{txt[:6]}" aria-haspopup="dialog"' if tipo == 'ev' else ' data-bloqueo="todo" data-ir="d-bloqueo"'
        return f'<button type="button" class="{cl}" style="{st}" aria-label="{lab}"{dato}>{cuerpo}</button>'
    c = x
    if kind == 'bq':
        return (f'<button type="button" class="ag0-p am-ch am-ch-bq" data-bloqueo="{c["id"]}" data-ir="d-bloqueo" aria-label="{etiqueta(c)}">'
                f'<span class="am-ch-i">{ic(I["candado"], 12, 2.2)}</span><span class="am-ch-h">{hm(c["a"])}</span><span class="am-ch-n">{c["nom"]}</span></button>')
    cl = ['ag0-p', 'am-ch'] + clases_estado(c) + (['am-rsv'] if c.get('rsv') else [])
    st = f' style="--b-ev:var(--cal-ev-{c["evc"]})"' if c['tipo'] == 'ev' else ''
    if c['tipo'] in ('ev', 'evn'): ico = f'<span class="am-ch-i am-ch-evi">{ic(I[c["evi"]], 12, 2.2)}</span>'
    else: ico = f'<span class="am-ch-i">{ic(I[EST[c["e"]][1]], 12, 2.4)}</span>'
    mar = ''
    if c['ori'] == 'google': mar += gcal(12)
    if c['ori'] == 'enlace': mar += ic(I['enlace'], 12, 2.2)
    if c['sx']: mar += sinexp(12)
    mar = f'<span class="am-ch-m">{mar}</span>' if mar else ''
    nom = c['nom'] if c['tipo'] in ('ev', 'evn', 'gl') else corto(c)
    tach = ' am-tach' if c['e'] == 'canc' and c['tipo'] == 'cita' else ''
    return (f'<button type="button" class="{" ".join(cl)}"{st} data-cita="{c["id"]}" data-bu="{c["id"]}" data-ir="b:{c["id"]}" aria-haspopup="dialog" aria-label="{etiqueta(c)}">'
            f'{ico}<span class="am-ch-h">{hm(c["a"])}</span><span class="am-ch-n{tach}">{nom}</span>{mar}</button>')

def linea_celda(o, vp, rsv, est=False):
    k = K_LINEAS[vp]
    items = lista_dia(o, rsv, est)
    lunes = F(o).weekday() == 0
    if len(items) <= k:
        vis, resto = items, 0
    else:
        vis, resto = items[:k - 1], len(items) - (k - 1)
    h = ''.join(chip(kd, x, o, lunes) for kd, x in vis)
    if resto:
        h += f'<button type="button" class="ag0-p am-mas" data-mas="{o}" aria-haspopup="dialog" aria-label="Mostrar {resto} eventos más">+{resto} más</button>'
    return h

def celda(o, vp):
    f = F(o); wd = f.weekday()
    cl = ['am-c', f'am-wd{wd}']
    if f.month != 11: cl.append('am-c-otro')
    if f == HOYF: cl.append('am-c-hoy')
    if wd == 6: cl.append('am-c-sin')        # domingo: sin horario de consulta
    if wd >= 5: cl.append('am-c-fin')
    cnt = conteo(o)
    cur = ' aria-current="date"' if f == HOYF else ''
    num = f'<button type="button" class="ag0-p am-n" data-dia="{o}"{cur} aria-label="Ir al {largo(o).lower()}">{f.day}</button>'
    if tiene_rsv(o):
        cuerpo = f'<div class="am-l am-v0">{linea_celda(o, vp, False)}</div><div class="am-l am-v1">{linea_celda(o, vp, True)}</div>'
    elif o in VARIA_E:
        cuerpo = f'<div class="am-l am-e0">{linea_celda(o, vp, False)}</div><div class="am-l am-e1">{linea_celda(o, vp, False, True)}</div>'
    else:
        cuerpo = f'<div class="am-l">{linea_celda(o, vp, False)}</div>'
    return (f'<div class="{" ".join(cl)}" data-o="{o}" role="gridcell" aria-label="{largo(o)}{", " + cnt if cnt else ""}. Toca un hueco libre para agendar">'
            f'<div class="am-ct">{num}</div>{cuerpo}</div>')

def mes_ancho(vp):
    nombres = DL if vp == 'esc' else DC
    cab = ''.join(f'<span class="am-sd am-wd{i}{" am-sd-hoy" if i == HOYF.weekday() else ""}" role="columnheader">{nombres[i]}</span>' for i in range(7))
    filas = ''
    for w in range(6):
        filas += '<div class="am-fila" role="row">' + ''.join(celda(w * 7 + i, vp) for i in range(7)) + '</div>'
    return (f'<section class="am-mes" aria-label="Noviembre de 2026" data-k="{K_LINEAS[vp]}">'
            f'<div class="am-fila am-cab" role="row">{cab}</div><div class="am-g" role="grid" aria-label="Noviembre de 2026">{filas}</div></section>')

# ------------------------------------------------------------------ MES DE TELÉFONO (mini-rejilla + panel del día) ------------------------------------------------------------------
def puntos(o, rsv):
    items = lista_dia(o, rsv)
    h = ''
    for kd, x in items[:3]:
        if kd == 'todo':
            tipo, col, i, txt, pos = x[:5]
            h += '<i class="am-pt am-pt-bq"></i>' if tipo == 'bq' else f'<i class="am-pt am-pt-ev ag0-b--ev" style="--b-ev:var(--cal-ev-{col})"></i>'
        elif kd == 'bq': h += '<i class="am-pt am-pt-bq"></i>'
        elif x['tipo'] == 'gl': h += f'<i class="am-pt am-pt-g">{gcal(10)}</i>'
        elif x['tipo'] == 'ev': h += f'<i class="am-pt am-pt-ev ag0-b--ev" style="--b-ev:var(--cal-ev-{x["evc"]})"></i>'
        elif x['tipo'] == 'evn': h += f'<i class="am-pt am-pt-ev ag0-b--{x["e"]}"></i>'
        else: h += f'<i class="am-pt ag0-b--{x["e"]}"></i>'
    if len(items) > 3: h += f'<span class="am-pmas">+{len(items) - 3}</span>'
    return h

def mini(vp):
    cab = ''.join(f'<span class="am-wd{i}">{DN[i]}</span>' for i in range(7))
    g = ''
    for o in range(NDIAS):
        f = F(o); wd = f.weekday()
        if f.month != 11:
            g += f'<span class="am-d am-d-otro am-wd{wd}" aria-hidden="true"></span>'; continue
        cl = ['ag0-p', 'am-d', f'am-wd{wd}'] + (['am-d-hoy'] if f == HOYF else []) + (['am-d-sin'] if wd == 6 else [])
        sel = 'true' if f == HOYF else 'false'
        cnt = conteo(o) or 'sin citas'
        cur = ' aria-current="date"' if f == HOYF else ''
        if tiene_rsv(o):
            pts = f'<span class="am-pts am-v0">{puntos(o, False)}</span><span class="am-pts am-v1">{puntos(o, True)}</span>'
        else:
            pts = f'<span class="am-pts">{puntos(o, False)}</span>'
        g += f'<button type="button" class="{" ".join(cl)}" role="gridcell" aria-selected="{sel}" data-o="{o}"{cur} aria-label="{largo(o)}, {cnt}"><b>{f.day}</b>{pts}</button>'
    return f'<section class="am-mini" aria-label="Noviembre de 2026"><div class="am-mini-s" aria-hidden="true">{cab}</div><div class="am-mini-g" role="grid" aria-label="Noviembre de 2026">{g}</div></section>'

def fila(kd, x, o_=0):
    """Fila de lista (la de la Semana A de la base, .ag0-lf): la usan el panel del día y la capa «+N más»."""
    if kd == 'todo':
        tipo, col, i, txt, pos = x[:5]
        ch = chip_todo((tipo, col, i, txt))
        ch = ch.replace('<button type="button" class="ag0-p ag0-tc', f'<button type="button" data-ir="b:td{o_}-{txt[:6]}" class="ag0-p ag0-tc' if tipo == 'ev' else '<button type="button" data-bloqueo="todo" data-ir="d-bloqueo" class="ag0-p ag0-tc', 1)
        return f'<div class="ag0-lf am-lf-todo"><span class="ag0-lh">Todo el día</span><span class="am-lf-tc">{ch}</span></div>'
    if kd == 'bq':
        c = x
        return (f'<button type="button" class="ag0-p ag0-lf am-lf-bq" data-bloqueo="{c["id"]}" data-ir="d-bloqueo" aria-label="{etiqueta(c)}">'
                f'<span class="ag0-lh">{hm(c["a"])}<small>{hm(c["b"])}</small></span><span class="ag0-lb am-lb-bq" aria-hidden="true"></span>'
                f'<span class="ag0-lc"><span class="ag0-ln">{c["nom"]}</span><span class="ag0-l2"><span>{ic(I["candado"], 14, 2)}{round((c["b"] - c["a"]) * 60)} min</span></span></span>{ic(I["sig"], 16, 2.2)}</button>')
    c = x; ev = c['tipo'] in ('ev', 'evn')
    cl = 'ag0-b--ev' if c['tipo'] == 'ev' else f'ag0-b--{c["e"]}'
    st = f' style="--b-ev:var(--cal-ev-{c["evc"]})"' if c['tipo'] == 'ev' else ''
    l2 = [f'<span>{round((c["b"] - c["a"]) * 60)} min</span>']
    if c['ori'] == 'enlace': l2.append(f'<span>{ic(I["enlace"], 14, 2)}Reservó por enlace</span>')
    if c['ori'] == 'google': l2.append(f'<span>{gcal(14)}Desde Google Calendar</span>')
    if c['sx']: l2.append(f'<span>{sinexp(14)}Sin expediente</span>')
    if c['obs'] and not c['sx']: l2.append(f'<span>{c["obs"]}</span>')
    der = (f'<span class="am-lf-evi">{ic(I[c["evi"]], 16, 2)}</span>' if ev else est(c['e'], texto=False))
    canc = ' ag0-lf--canc' if c['e'] == 'canc' and not ev else ''
    rsv = ' am-rsv' if c.get('rsv') else ''
    return (f'<button type="button" class="ag0-p ag0-lf {cl}{canc}{rsv}"{st} data-bu="{c["id"]}" data-ir="b:{c["id"]}" aria-haspopup="dialog" aria-label="{etiqueta(c)}">'
            f'<span class="ag0-lh">{hm(c["a"])}<small>{hm(c["b"])}</small></span><span class="ag0-lb" aria-hidden="true"></span>'
            f'<span class="ag0-lc"><span class="ag0-ln">{c["nom"]}</span><span class="ag0-l2">{"".join(l2)}</span></span>{der}{ic(I["sig"], 16, 2.2)}</button>')

def panel(o, rsv=False):
    """PanelDelDia.tsx: «Citas del día seleccionado», cabecera pegajosa con fecha · conteo · «Ver día ›»."""
    items = lista_dia(o, rsv)
    cnt = conteo(o, rsv) or 'sin citas'
    filas = ''.join(fila(kd, x, o) for kd, x in items) or '<p class="ag0-lvac">Sin citas este día</p>'
    return (f'<div class="am-pdh"><div class="am-pdt"><h2>{panel_t(o)}</h2><span class="am-pdn">{cnt}</span></div>'
            f'<button type="button" class="ag0-p am-vd" data-verdia="{o}">Ver día ›</button></div><div class="am-pdl">{filas}</div>')

def lista_mas(o, rsv=False):
    """Contenido de la capa «+N más»: el día entero, sin tope."""
    items = lista_dia(o, rsv)
    return ''.join(fila(kd, x, o) for kd, x in items)

# ------------------------------------------------------------------ BARRA, MENÚS, CAPAS ------------------------------------------------------------------
TITD = {'ancho': 'Jueves, 19 de noviembre de 2026', 'tel': 'Jue, 19 de noviembre'}
def barra_mes(vp, vista='mes', o=None):
    b, flota = barra(vp, vista)
    # Campana: 3 pendientes; con la reserva por enlace de la captura «con reserva», 4 (un aviso más)
    b = b.replace('<span class="ag0-cnt" aria-hidden="true">3</span>', '<span class="ag0-cnt am-v0" aria-hidden="true">3</span><span class="ag0-cnt am-v1" aria-hidden="true">4</span>')
    if vista == 'dia' and o is not None:
        f = F(o)
        b = b.replace(TITD['ancho'], f'{DL[f.weekday()]}, {f.day} de noviembre de 2026').replace(TITD['tel'], f'{DC[f.weekday()]}, {f.day} de noviembre')
    return b, flota

def menu_mes(vp):
    """«Opciones de la agenda» en Mes: igual que en Día/Semana, salvo que «Compactar» se llama como hoy en Mes
    (etiquetaCompactar: «Ocultar los días de la semana sin actividad»), no hay «Densidad compacta» (solo rejilla de horas)
    y en «Médico» la opción «Todos» está apagada con su texto de hoy (OPCION_TODOS(true))."""
    chev = ic(I['abajo'], 16, 2.4).replace('aria-hidden', 'class="ag0-chev" aria-hidden')
    medico = (f'<button type="button" class="ag0-p ag0-op" role="menuitem" aria-expanded="false" data-sub="med">{ic(I["medico"], 20, 2)}<span>Médico<small>Dr. Admin Semilla</small></span>{chev}</button>'
              f'<div class="ag0-sub" role="group" aria-label="Médico">'
              f'<button type="button" class="ag0-p ag0-op am-op-off" role="menuitemradio" aria-checked="false" aria-disabled="true"><span>Todos los médicos — el mes se ve por médico</span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="true"><span>Dr. Admin Semilla</span></button>'
              f'<button type="button" class="ag0-p ag0-op" role="menuitemradio" aria-checked="false"><span>Dra. Invitada Semilla</span></button></div>')
    sep = '<div class="ag0-sep" role="separator"></div>'
    comp = (f'<button type="button" class="ag0-p ag0-op" role="menuitemcheckbox" aria-checked="false" data-sw="1" data-comp="1">{ic(I["compactar"], 20, 2)}'
            f'<span>Ocultar los días de la semana sin actividad</span><span class="ag0-sw" aria-hidden="true"></span></button>')
    if vp == 'esc':
        cuerpo = (op('engrane', 'Configuración de la agenda') + sep + comp + sw('cursor', 'Pop-up de eventos', True)
                  + op('teclado', 'Atajos de teclado', '<kbd>?</kbd>') + sep + op('info', 'Leyenda de estados'))
    else:
        top = '' if vp in ('ih', 'iv') else op('lupa', 'Buscar citas de un paciente')
        cuerpo = (top + medico + op('candado', 'Bloquear horario') + sep + op('engrane', 'Configuración de la agenda')
                  + comp + sw('cursor', 'Pop-up de eventos', True) + sep + op('info', 'Leyenda de estados'))
    anc = ' ag0-anc' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    cab = '' if vp == 'esc' else f'<div class="ag0-cjc"><h2>Opciones de la agenda</h2><button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>'
    return (f'<div class="ag0-capa{velo}" data-capa="menu" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj{anc}" role="menu" aria-label="Opciones de la agenda"><span class="ag0-asa" aria-hidden="true"></span>{cab}<div class="ag0-cj-in">{cuerpo}</div></div></div>')

def capa_med():
    # Filtro de médico de computadora, abierto en Mes: «Todos» apagado, no escondido (FiltrosBandaMovil.tsx:23, CabeceraEscritorio.tsx:287)
    o = lambda t, s, off=False: (f'<button type="button" class="ag0-p ag0-op{" am-op-off" if off else ""}" role="option" aria-selected="{"true" if s else "false"}"'
                                 f'{" aria-disabled=\"true\"" if off else ""}><span>{t}</span>{ic(I["palomita"], 18, 2.4) if s else ""}</button>')
    return (f'<div class="ag0-capa ag0-sinvelo" data-capa="med" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj ag0-anc am-medcj" role="listbox" aria-label="Filtrar por médico"><div class="ag0-cj-in">'
            f'{o("Todos los médicos — el mes se ve por médico", False, True)}{o("Dr. Admin Semilla", True)}{o("Dra. Invitada Semilla", False)}</div></div></div>')

def capa_mas(vp):
    anc = ' ag0-anc am-anc' if vp == 'esc' else ''
    velo = ' ag0-sinvelo' if vp == 'esc' else ''
    return (f'<div class="ag0-capa{velo}" data-capa="mas" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            f'<div class="ag0-cj am-mcj{anc}" role="dialog" aria-label="Todo el día"><span class="ag0-asa" aria-hidden="true"></span>'
            f'<div class="am-mh"><button type="button" class="ag0-p am-mt" data-dia=""><span></span>{ic(I["sig"], 18, 2.4)}</button>'
            f'<button type="button" class="ag0-p ag0-x" data-cierra="1" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>'
            f'<div class="ag0-cj-in am-mb"></div></div></div>')

def capa_alerta():
    # ConfirmModal.tsx: solo el mensaje y «Cancelar» / «Aceptar» (sin título hoy). Pieza de alerta del catálogo (CALMA §13, §25).
    return (f'<div class="ag0-capa am-capa-al" data-capa="al" aria-hidden="true"><div class="ag0-velo" data-al="no"></div>'
            f'<div class="ag0-cj am-al" role="dialog" aria-modal="true" aria-label="Confirmar el cambio"><span class="am-al-i">{ic(TRI, 28, 2)}</span>'
            f'<p class="am-al-t" lang="es"></p><div class="am-al-b"><button type="button" class="ag0-p am-b am-b-q" data-al="no">Cancelar</button>'
            f'<button type="button" class="ag0-p am-b am-b-p" data-al="si">Aceptar</button></div></div></div>')

def capa_pasar():
    # «Pop-up de eventos» (TarjetaAlPasar: la misma burbuja, anclada a la cita, sin velo). Solo computadora.
    return ('<div class="ag0-capa ag0-sinvelo am-capa-pasar" data-capa="pasar" aria-hidden="true"><div class="ag0-velo" data-cierra="1"></div>'
            '<div class="ag0-cj ag0-anc am-pcj" role="dialog" aria-label="Cita"><div class="ag0-cj-in ag0-bu-h"></div></div></div>')

def avisos_mes():
    cal = ic(I['agenda'], 16, 2)
    return (f'<div class="ag0-aviso ag0-av-e" role="alert">{ic(TRI, 16, 2)}<p><b>No se pudo cargar la agenda.</b> Lo que se ve puede estar incompleto o desactualizado.</p><button type="button" class="ag0-p" data-amr="reintentar">Reintentar</button></div>'
            f'<div class="ag0-aviso am-av-f" role="alert">{ic(TRI, 16, 2)}<p><b>Faltan citas por mostrar.</b> Este periodo tiene más citas de las que caben en una carga; lo que ves está incompleto.</p><button type="button" class="ag0-p" data-amr="semana">Ver por semana</button></div>'
            f'<div class="ag0-aviso ag0-av-g" role="status">{gcal(16)}<p><b>No se pudo sincronizar con Google Calendar.</b> Tus citas se muestran normal; faltan los eventos del calendario.</p><button type="button" class="ag0-p" data-amr="perfil">Revisar conexión</button></div>'
            f'<div class="ag0-aviso am-av-v" role="status">{cal}<p>Ningún evento de Dr. Admin Semilla en noviembre</p></div>'
            f'<div class="ag0-aviso ag0-av-c am-av-h">{ic(GLOBO, 16, 2)}<p>Mostrando el horario de tu ubicación actual (UTC−6, Mérida)</p></div>'
            f'<div class="ag0-aviso ag0-av-c am-av-k" role="status">{ic(I["compactar"], 16, 2)}<p><b>Vista compacta:</b> domingo oculto</p><button type="button" class="ag0-p" data-comp-off="1">Mostrar todos los días</button></div>')

def toast():
    return f'<div class="am-toast" role="status" aria-live="polite">{ic(TRI, 18, 2)}<span>Este horario está bloqueado. Quita el bloqueo para agendar aquí.</span></div>'

# ------------------------------------------------------------------ MARCOS ------------------------------------------------------------------
TEL = ('ext', 'tel')
DIAS_DIA = list(range(SEM0, SEM0 + 7))       # el salto al Día está dibujado para la semana del 16 al 22 (la semilla de la base)

def modo_dia(vp, o):
    b, flota = barra_mes(vp, 'dia', o)
    return f'<div class="am-modo" data-modo="d{o}">{b}{rejilla(vp, [o - SEM0], scroll=12)}{flota}</div>'

def contenido(vp, n):
    b, flota = barra_mes(vp, 'mes')
    carga = '<div class="am-cargab" aria-hidden="true"><i></i></div>'
    if vp in TEL:
        cuerpo = f'<div class="am-desl">{mini(vp)}<section class="am-pd" aria-label="Citas del día seleccionado">{panel(OFF_HOY)}</section></div>'
    else:
        cuerpo = mes_ancho(vp)
    dias = ''.join(modo_dia(vp, o) for o in DIAS_DIA)
    return (f'<main class="ag0-cont am-cont" aria-busy="false">{carga}<div class="am-modo am-on" data-modo="mes">{b}{avisos_mes()}{cuerpo}{flota}</div>{dias}{toast()}</main>')

# ------------------------------------------------------------------ PIEZAS REALES (kit/INTEGRACION.md) ------------------------------------------------------------------
# La misma capa de integración que usan Día y 3 días en la página Calendario (agenda-base/tmp-vistas.py, sección INTEGRACIÓN):
# burbuja, alta, alertas y avisos (ag-burbuja, con su guion), formulario y bloqueo (ag-form), ligar (ag-ligado, con su guion),
# opciones, buscar, campana, médico, leyenda, atajos (ag-herr) y la navegación (cromo). Se ejecuta al generar: hereda su versión actual.
_vs = open(os.path.join(BASE, 'tmp-vistas.py')).read()
exec(compile(_vs[:_vs.index('# =========================================================== ESCRITURA')], 'agenda-base/tmp-vistas.py', 'exec'), G)
G.setdefault('FICHA_7', '')
_i = _vs.index('# =========================================================== INTEGRACIÓN'); _j = _vs.index('FICHA_4I = ', _i)
exec(compile(_vs[_i:_j], 'agenda-base/tmp-vistas.py (integración)', 'exec'), G)
AB, AH, AL = G['AB'], G['AH'], G['AL']
_dl_ab = AB['dia_largo']
AB['dia_largo'] = lambda d: largo(d - 100) if d >= 100 else _dl_ab(d)

def sufija(h, suf):
    """Ids únicos por marco y por vista (las piezas copiadas repiten sus ids en cada página)."""
    for i in sorted(set(re.findall(r'\bid="([^"]+)"', h)), key=len, reverse=True):
        h = re.sub(r'(\b(?:id|for|aria-controls|aria-labelledby|aria-describedby|aria-activedescendant)=")' + re.escape(i) + '"', r'\g<1>' + i + suf + '"', h)
    return h

def burbujas_mes():
    """Burbujas reales de las citas del mes que no son de la semana de muestra (las de la semana ya las trae la integración)."""
    tpl, h, ya = AB['tpl'], '', {c['id'] for c in AB['CITAS']}
    for c in TODAS:
        if c['id'] in ya: continue
        ya.add(c['id'])
        if c['sx']:
            x = G['_ligar_tpl'](dict(c, correo=None))
            h += x.replace('Jueves 19 de noviembre', largo(c['d'] - 100))
        else:
            h += tpl('b:' + c['id'], 'bu', AB['burbuja'](c), ancla=c['id'], titulo=c['nom'])
    for o, lst in TODOS.items():
        for x in lst:
            k = f'td{o}-{x[3][:6]}'
            if x[0] != 'ev' or k in ya: continue
            ya.add(k)
            td = dict(id=k, d=100 + o, a=0, b=24, nom=x[3], e='ag', tipo='ev', ori='', obs=None, tel=None, cons=None)
            h += tpl('b:' + k, 'bu', AB['burbuja'](td, todo=True), ancla=k, titulo=x[3])
    return G['_cablea'](h)

AF = G['AF']
# El aviso breve de ag-form (su guion lo usa al guardar), tal como lo monta su marco
AF_TOAST = (f'<div class="af-toast" role="status" aria-live="polite"><span class="af-ti af-i-ok">{AF["ii"]("check", 16, 2.4)}</span><span class="af-tt"></span>'
            f'<button type="button" class="af-p af-x" data-toastx="1" aria-label="Cerrar aviso">{ic(I["x"], 18, 2)}</button></div>')
def capas(n, vp):
    h = sufija(G['piezas_reales'](vp, n, False), f'-{n}')
    # En Mes no se puede estar en «Todos los médicos»: la opción se apaga, no se esconde (FiltrosBandaMovil.tsx:23)
    h = h.replace('role="option" aria-selected="false" data-med="todos"', 'role="option" aria-selected="false" aria-disabled="true" data-med="todos"')
    h = h.replace('role="menuitemradio" aria-checked="false" data-med="todos"', 'role="menuitemradio" aria-checked="false" aria-disabled="true" data-med="todos"')
    return capa_mas(vp) + h + AF_TOAST + burbujas_mes()

def marco_m(n, vp):
    cont = contenido(vp, n)
    if vp == 'ext': app = cont + riel()
    elif vp == 'tel': app = encabezado() + cont
    elif vp == 'iv': app = enc_iv() + cont
    elif vp == 'ih': app = cont + lateral()
    else: app = lateral() + cont
    h = (f'<div class="marco ag0 ag0-v{n} ab ab-vI{n} af al ah cr4 am ah-mes" data-vp="{vp}" lang="es">\n<div class="ag0-app">\n{app}\n</div>\n'
         f'{capas(n, vp)}\n</div>')
    return G['_barra_int'](h)

def plantillas(n):
    """Fuera de los marcos (se clonan al abrir): panel del día y lista «+N más» de cada día."""
    pd = ''
    for o in range(NDIAS):
        if F(o).month != 11: continue
        pd += f'<template data-pd="{o}">{panel(o)}</template>'
        if tiene_rsv(o): pd += f'<template data-pd="{o}r">{panel(o, True)}</template>'
    ms = ''
    for o in range(NDIAS):
        ms += f'<template data-ml="{o}" data-t="{largo(o)}">{lista_mas(o)}</template>'
        if tiene_rsv(o): ms += f'<template data-ml="{o}r" data-t="{largo(o)}">{lista_mas(o, True)}</template>'
    return f'<template class="am-tpl" data-v="{n}">{pd}{ms}</template>'

CSS_AM = open(os.path.join(AQUI, 'tmp-mes.css')).read()
JS_AM = open(os.path.join(AQUI, 'tmp-am.js')).read()

def escribe(arch, n, nombre, desc, ficha, tira, **extra):
    cfg = dict(v=n, ficha=ficha, tira=tira); cfg.update(extra)
    marcos = '\n'.join(marco_m(n, vp) for vp in VPS)
    cab = dict(v='I' + n, tira=[], estados=G['EST_I'], dias=AB['DIA_CORTO'], horario=G['HORARIO'], saltos={}, alta=True, hover=True)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS_BASE}\n{G["ICSS"]}\n{CSS_AM}</style>\n{marcos}\n{plantillas(n)}\n'
           f'<script>\n(function(CFG){{\n{JS_BASE}\n{G["IJS"]}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>'
           f'\n<script>\n(function(CFG){{\n{G["ABJS"]}\n}})({json.dumps(cab, ensure_ascii=False)});\n</script>'

           f'\n<script>\n(function(CFG){{\n{JS_AM}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = os.path.join(AQUI, f'vista-{arch}.html')
    open(p, 'w').write(out); print(p, len(out))

exec(open(os.path.join(AQUI, 'tmp-fichas.py')).read())
