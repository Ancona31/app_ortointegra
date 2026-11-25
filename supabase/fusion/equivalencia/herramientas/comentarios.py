"""Diff por palabras de los COMMENT que cambian (de la TSV del comparador)."""
import sys, csv, difflib, json
csv.field_size_limit(10**9)
out = open(sys.argv[2], 'w')
for r in csv.DictReader(open(sys.argv[1]), delimiter='\t'):
    if r['tipo'] != 'comentario':
        continue
    a, b = r['valor_a'], r['valor_b']
    for v in ('a', 'b'):
        pass
    def txt(x):
        try:
            return json.loads(x).get('texto', x) if x.startswith('{') else x
        except Exception:
            return x
    a, b = txt(a), txt(b)
    wa, wb = a.split(), b.split()
    menos, mas = [], []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        if op in ('delete', 'replace'):
            menos.append(' '.join(wa[i1:i2]))
        if op in ('insert', 'replace'):
            mas.append(' '.join(wb[j1:j2]))
    out.write(f"### {r['estado']} {r['clave']}\n  − {' ┃ '.join(menos)}\n  + {' ┃ '.join(mas)}\n")
