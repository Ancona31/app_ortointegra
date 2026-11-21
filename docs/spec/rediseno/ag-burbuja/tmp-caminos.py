# Recorre TODOS los destinos internos (data-ir, bloques, tira) de las cuatro vistas y dice adónde llevan, por marco.
import re, json, glob, html
res = {}
for f in sorted(glob.glob('vista-*.html')):
    t = open(f).read()
    cfg = json.loads(re.search(r'\}\)\((\{.*\})\);\s*</script>\s*$', t, re.S).group(1))
    E, SAL = cfg['estados'], cfg['saltos']
    for vp in ('ext', 'tel', 'ih', 'iv', 'esc'):
        m = re.search(r'<div class="marco ab ag0 ab-v\d" data-vp="%s".*?(?=<div class="marco ab ag0|<script>)' % vp, t, re.S).group(0)
        tpls = {k: c for k, c in re.findall(r'<template data-t="([^"]+)"[^>]*>(.*?)</template>', m, re.S)}
        claves = set(re.findall(r'data-ir="([^"]+)"', m)) | {'b:' + x for x in re.findall(r'data-cita="([^"]+)"', m)} | {x[1] for x in cfg['tira'] if x != '|'}
        if 'data-accion="agendar"' in m: claves.add('agendar')
        tels = vp in ('ext', 'tel')
        for k in sorted(claves):
            if k in ('cerrar', 'm-wa', 'm-correo') or k.startswith('tog:'): continue
            s = (tels and SAL.get(k + '@tel')) or SAL.get(k)
            if s: res.setdefault(('SALTO → %s · «%s»' % (s[0][0], s[1])), set()).add(f'{f[6:-5]}:{vp}:{k}'); continue
            e = E.get(k) or {'t': [k]}
            lst = e['telx'] if tels and 'telx' in e else ((None if tels else e.get('ancho')) or e.get('t') or [])
            if e.get('soloAncho') and tels: lst = ['fs']
            malos = [x for x in lst if x in tpls and 'ab-hd' in tpls[x]]
            falt = [x for x in lst if x not in tpls]
            if malos: res.setdefault('HUECO (mal)', set()).add(f'{f[6:-5]}:{vp}:{k}→{malos}')
            elif falt and not e.get('toast') and lst: res.setdefault('SIN DESTINO', set()).add(f'{f[6:-5]}:{vp}:{k}→{falt}')
            elif not lst: res.setdefault('cierra / aviso', set()).add(f'{f[6:-5]}:{vp}:{k}')
            else: res.setdefault('pieza propia', set()).add(f'{f[6:-5]}:{vp}:{k}')
for k, v in res.items():
    print(k, len(v)); [print('   ', x) for x in sorted(v)[:200] if k != 'pieza propia']
