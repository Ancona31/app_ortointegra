"""Diff de cuerpos de función A↔B. Lee dos JSON {firma: prosrc} y escribe:
- un informe con, por función, si el código sin comentarios es idéntico y,
  si no, el diff SIN comentarios (lo que cambia de verdad).
Quita comentarios «--» y /* */ respetando literales '…' y $tag$…$tag$ (un
cuerpo plpgsql no anida dólares del mismo tag), y colapsa espacios."""
import json, sys, re, difflib

def sin_comentarios(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if s.startswith('--', i):
            j = s.find('\n', i); i = n if j < 0 else j
            continue
        if s.startswith('/*', i):
            j = s.find('*/', i + 2); i = n if j < 0 else j + 2
            out.append(' ')
            continue
        if c == "'" :
            j = i + 1
            while j < n:
                if s[j] == "'" and j + 1 < n and s[j + 1] == "'":
                    j += 2; continue
                if s[j] == "'":
                    break
                j += 1
            out.append(s[i:j + 1]); i = j + 1
            continue
        m = re.match(r'\$[A-Za-z_]*\$', s[i:])
        if m:
            tag = m.group(0); j = s.find(tag, i + len(tag))
            j = n if j < 0 else j + len(tag)
            out.append(s[i:j]); i = j
            continue
        out.append(c); i += 1
    return ''.join(out)

def norm_lineas(s):
    t = sin_comentarios(s)
    ls = [re.sub(r'\s+', ' ', l).strip() for l in t.split('\n')]
    return [l for l in ls if l]

a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
out = open(sys.argv[3], 'w')
for k in sorted(set(a) & set(b)):
    if a[k] == b[k]:
        continue
    la, lb = norm_lineas(a[k]), norm_lineas(b[k])
    ident = la == lb
    out.write(f'\n######## {k}\n# código sin comentarios ni espacios: {"IDÉNTICO" if ident else "CAMBIA"}\n')
    if not ident:
        for x in difflib.unified_diff(la, lb, 'A', 'B', lineterm='', n=1):
            out.write(x + '\n')
    out.write('# --- diff textual completo (con comentarios)\n')
    for x in difflib.unified_diff(a[k].split('\n'), b[k].split('\n'), 'A', 'B', lineterm='', n=0):
        out.write('#   ' + x + '\n')
print('ok')
