# Segunda revisión, ajuste: el nombre largo parte limpio («Honorarios /» + «Cotización») con un espacio duro antes de la barra. Uso único.
import os
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b):
    p = os.path.join(L, f); t = open(p).read(); assert a in t, a[:60]; open(p, 'w').write(t.replace(a, b, 1))
sub('tmp-dcc-gen.py', """<span class="PX-tile">' + ic(d, 20) + '</span><h1>' + nombre + '</h1></div>""", """<span class="PX-tile">' + ic(d, 20) + '</span><h1>' + nombre.replace(' / ', '&nbsp;/ ') + '</h1></div>""")
sub('tmp-dcc-gen.py', """% (n, ' aria-current="true"' if k == tipo else '', k, k, ic(d, 20), n) for k, n, d in TIPOS)""", """% (n, ' aria-current="true"' if k == tipo else '', k, k, ic(d, 20), n.replace(' / ', '&nbsp;/ ')) for k, n, d in TIPOS)""")
sub('tmp-dcc-chasis.js', "$$('.PX-ent').forEach(function(x){x.textContent=entrante})", "$$('.PX-ent').forEach(function(x){x.textContent=entrante.replace(' / ','\\u00a0/ ')})")
print('ok')
