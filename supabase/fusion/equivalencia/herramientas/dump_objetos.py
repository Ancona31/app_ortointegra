"""Método independiente del comparador: parte dos pg_dump --schema-only en
objetos por la cabecera «-- Name: …; Type: …; Schema: …; Owner: …» y compara
el TEXTO de cada objeto (incluye GRANT/REVOKE con el texto que pg_dump emite,
ACL de columnas, COMMENT, ALTER … OWNER, publicaciones, default privileges,
operadores, casts, etc.). Uso: python3 -I dump_objetos.py A.sql B.sql SALIDA.tsv"""
import re, sys, difflib, collections

CAB = re.compile(r'^-- (?:Data for )?Name: (.*?); Type: (.*?); Schema: (.*?); Owner: (.*?)$')

def partir(ruta):
    objs = collections.OrderedDict()
    clave, buf = ('__prologo__', '', '', ''), []
    with open(ruta, encoding='utf-8') as f:
        lineas = f.read().split('\n')
    i = 0
    while i < len(lineas):
        l = lineas[i]
        m = CAB.match(l)
        if m:
            # cierra el anterior (quita el «--» de arriba de la cabecera)
            while buf and buf[-1] in ('--', ''):
                buf.pop()
            objs.setdefault(clave, []).append('\n'.join(buf).strip('\n'))
            clave, buf = (m.group(2), m.group(3), m.group(1), m.group(4)), []
            i += 1
            if i < len(lineas) and lineas[i] == '--':
                i += 1
            continue
        buf.append(l)
        i += 1
    objs.setdefault(clave, []).append('\n'.join(buf).strip('\n'))
    return {k: '\n\n'.join(v) for k, v in objs.items()}

a, b = partir(sys.argv[1]), partir(sys.argv[2])
filas = []
for k in sorted(set(a) | set(b)):
    ta, tb = a.get(k), b.get(k)
    if ta == tb:
        continue
    estado = 'solo_a' if tb is None else 'solo_b' if ta is None else 'distinto'
    d = ''
    if estado == 'distinto':
        d = '\\n'.join(x for x in difflib.unified_diff(ta.split('\n'), tb.split('\n'), lineterm='', n=0)
                       if not x.startswith(('---', '+++')))
    filas.append((estado,) + k + (d[:4000],))
with open(sys.argv[3], 'w', encoding='utf-8') as f:
    f.write('estado\ttipo_pgdump\tesquema\tnombre\tdueño\tdiff\n')
    for r in filas:
        f.write('\t'.join(x.replace('\t', ' ') for x in r) + '\n')
print(f'objetos A={len(a)} B={len(b)} diferencias={len(filas)}')
for t, n in collections.Counter((r[0], r[1]) for r in filas).most_common():
    print(f'  {t[0]:9} {t[1]:22} {n}')
