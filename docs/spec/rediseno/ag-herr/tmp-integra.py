# Integración (kit/INTEGRACION.md): las piezas REALES de las carpetas hermanas dentro de los marcos de ag-herr.
# Se ejecutan sus generadores SOLO hasta antes de su escritura (no se escribe nada fuera de ag-herr) y se copia su marcado y su CSS.
#   burbuja de cita, burbuja de alta, alertas, registro, alta de teléfono → ../ag-burbuja (prefijo .ab)
#   formulario de cita/evento, bloquear horario, convertir en cita, alertas del formulario → ../ag-form (prefijo .af)
#   burbuja de cita por ligar / Google por asignar y ventana «Ligar paciente e iniciar consulta» → ../ag-ligado (prefijo .al)
import os, re
SIB = os.path.normpath(os.path.join(AQUI, '..'))

def _ns(path, corte):
    src = open(path).read()
    src = src[:src.index(corte)]
    N = {'__file__': path, '__name__': 'pieza'}
    exec(compile(src, path, 'exec'), N)
    return N

AB = _ns(f'{SIB}/ag-burbuja/tmp-ab.py', 'def vista4(vp):')
AL = _ns(f'{SIB}/ag-ligado/tmp-al-gen.py', "exec(open(os.path.join(AQUI, 'tmp-al-vistas.py')).read())")
AF = _ns(f'{SIB}/ag-form/tmp-af-gen.py', "exec(open(A + '/tmp-af-vistas.py').read())")
_v = open(f'{SIB}/ag-form/tmp-af-vistas.py').read()
exec(compile(_v[:_v.index("salida(1, '1-cita'")], 'af-vistas', 'exec'), AF)

CSS_INT = (open(f'{SIB}/ag-burbuja/tmp-ab.css').read() + '\n' + open(f'{SIB}/ag-ligado/tmp-al.css').read() + '\n'
           + AF['CSS_AF'] + '\n' + '\n'.join(v for k, v in AF.items() if k.startswith('CSS_') and k not in ('CSS_AF', 'CSS_BASE') and isinstance(v, str)))
TOASTS = AB['TOASTS']

_TPL = re.compile(r'<template\b[^>]*>.*?</template>', re.S)
def _sin_reparto(h):
    """Quita las plantillas de reparto («Reservado a otro agente»): sus caminos van a la pieza real."""
    return _TPL.sub(lambda m: '' if ('ab-mi-q' in m.group(0) or 'otro agente' in m.group(0)) else m.group(0), h)

def _ligar_tpl(c):
    """Burbuja de la cita por ligar / Google por asignar (ag-ligado), con el formato de plantilla de ag-burbuja."""
    c = dict(c)
    if c['id'] == 'j8': c.update(correo='paciente26@semilla.spinus.test')
    h = AL['burbuja']('b:' + c['id'], c)
    return h.replace(f'<template data-bu="b:{c["id"]}">', f'<template data-t="b:{c["id"]}" data-capa="bu" data-ancla="{c["id"]}" data-cls="" data-titulo="{c["nom"]}">', 1)

_PLANT = None
def plantillas_piezas():
    """Las plantillas (burbujas, alta, alertas, registro) no dependen del marco salvo el alta de teléfono (fs): van UNA vez por vista,
    en el primer marco, y el guion las busca allí (así la página no repite 5 veces lo mismo)."""
    global _PLANT
    if _PLANT is not None: return _PLANT
    def de(vp):
        caps = AB['capas'](vp); alta = AB['vista3'](vp)[1]
        return alta[len(caps):] if alta.startswith(caps) else ''
    t = AB['plantillas_burbuja']() + AB['reasignar_tpl']() + de('esc')
    t += ''.join(m.group(0) for m in _TPL.finditer(de('ext')) if re.search(r'data-t="fs', m.group(0)))
    t = _sin_reparto(t)
    _ids = {'b:' + c['id'] for c in CITAS} | {'b:td1'}
    def _vale(k):
        return k in _ids or k.startswith(('al-', 'alta', 'acuse', 'registro', 'fs')) or k in ('reasignar', 'inv-eligiendo')
    t = _TPL.sub(lambda m: m.group(0) if _vale(re.search(r'data-t="([^"]*)"', m.group(0)).group(1)) else '', t)
    t += ''.join(_ligar_tpl(c) for c in CITAS if c['id'] in AB['LIGAR'])
    _PLANT = f'<div class="ah-plant" hidden>{t}</div>'
    return _PLANT

def piezas(n, vp):
    caps = AB['capas'](vp)
    t = plantillas_piezas() if vp == 'ext' else ''
    lig = AL['capa_ligar'](vp).replace('19:00 – 19:30', '14:00 – 14:30')
    lig = re.sub(r'<!--.*?-->\n?', '', lig, flags=re.S)
    uid = f'ah{n}{vp}'
    form = [(m, AF['form_cita'](m, uid + m)) for m in ('crear', 'lleno', 'editar', 'conf', 'reserva', 'google')]
    form += [('evento', AF['form_evento']('evento', uid + 'ev')), ('evedit', AF['form_evento']('evedit', uid + 'ee'))]
    sub = lambda m: 'En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.'
    toast = (f'<div class="af-toast" role="status" aria-live="polite"><span class="af-ti af-i-ok">{AF["ii"]("check", 16, 2.4)}</span><span class="af-tt"></span>'
             f'<button type="button" class="af-p af-x" data-toastx="1" aria-label="Cerrar aviso">{AF["ic"](AF["I"]["x"], 18, 2)}</button></div>')
    af = ('<div class="af-velo" data-cierra="1"></div>'
          + AF['capa']('form', 'af-w520', form, aria='Cita')
          + AF['capa']('bq', 'af-w440', [(m, AF['form_bloqueo'](m, uid + m)) for m in ('bq', 'bqedit')], icono='candado', sub_fn=sub, aria='Bloquear horario')
          + AF['capa_reg'](uid) + AF['capa_conv'](uid) + AF['alertas_form']() + toast)
    return caps + t + lig + af

# Motor del formulario: el guion de ag-form, acotado a sus capas (.af-capa) y sin su tira de maqueta
_j = open(f'{SIB}/ag-form/tmp-af-guion.js').read()
_j = _j[:_j.index("var tira = document.createElement('div'); tira.className = 'af-tira'")]
_a = "var t = e.target.closest('button,a,.af-velo'); if (!t || !m.contains(t)) return;"
assert _a in _j
_j = _j.replace(_a, _a + " if (!t.closest('.af-capa,.af-velo,.af-toast')) return;")
_j = _j.replace("function irALigar(m, tipo) {", "function irALigar(m, tipo) {\n  if (m._ligar) { cierraTodo(m); m._ligar(tipo); return; }", 1)
JS_AF = _j + "\nmarcos.forEach(function (m) { liga(m); m._afAbre = function (k, v) { abre(m, k, v); }; m._afCierra = function () { cierraTodo(m); }; });\n"
