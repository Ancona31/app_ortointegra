# Segunda revisión: sustituciones exactas sobre los guiones y la hoja de estilo de la primera ronda. Uso único.
# No borra archivos: reescribe texto dentro de las fuentes tmp-dcc-* (la copia de la primera ronda está en tmp-v1/).
import os
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b, n=1):
    p = os.path.join(L, f); t = open(p).read()
    assert a in t, 'NO ENCONTRADO %s: %s' % (f, a[:80])
    open(p, 'w').write(t.replace(a, b) if n == 0 else t.replace(a, b, n))
# chasis: acciones de «Gestionar» como botones pequeños
sub('tmp-dcc-chasis.js', """<button type="button" class="PX-p PX-txt" data-o="ren">Renombrar</button><button type="button" class="PX-p PX-txt" data-o="sob">Sobrescribir</button><button type="button" class="PX-p PX-txt" data-o="eli">Eliminar</button>""",
    """<button type="button" class="PX-p PX-qui PX-ch" data-o="ren">Renombrar</button><button type="button" class="PX-p PX-qui PX-ch" data-o="sob">Sobrescribir</button><button type="button" class="PX-p PX-mal PX-ch" data-o="eli">Eliminar</button>""")
sub('tmp-dcc-chasis.js', """<button type="button" class="PX-p PX-txt" data-o="can">Cancelar</button>""", """<button type="button" class="PX-p PX-qui" data-o="can">Cancelar</button>""")
# consentimiento: estado de sección como etiqueta; indicador de pasos; «Rehacer» como botón
sub('tmp-dcc-cons.js', "var SEC=__SEC__,FLECHA=__FLECHA__,OKM=__OKM__;", "var SEC=__SEC__,FLECHA=__FLECHA__,OKM=__OKM__,ICQ=__ICQ__;")
sub('tmp-dcc-cons.js', """var w=$('[data-sec="'+k+'"]');w.querySelector('.PX-sr').textContent=t;w.classList.toggle('PX-falta',intentado&&cl.indexOf('sec-'+k)>=0)});""",
    """var w=$('[data-sec="'+k+'"]'),sr=w.querySelector('.PX-sr');sr.className='PX-sr'+(t?' PX-eq PX-eq-'+(t==='Editada'?'ton':'ag'):'');sr.innerHTML=t?(t==='Editada'?ICQ.ed:ICQ.ob)+t:'';w.classList.toggle('PX-falta',intentado&&cl.indexOf('sec-'+k)>=0)});""")
sub('tmp-dcc-cons.js', """return '<i'+(i<=paso?' class="PX-hecho"':'')+'></i>'""", """return '<i'+(i<paso?' class="PX-hecho"':i===paso?' class="PX-ahora"':'')+'></i>'""")
sub('tmp-dcc-cons.js', """<button type="button" class="PX-p PX-txt" data-rol="'+r[0]+'">Rehacer</button>""", """<button type="button" class="PX-p PX-qui PX-ch" data-rol="'+r[0]+'">Rehacer</button>""")
# honorarios: el total/saldo final con su divisa
sub('tmp-dcc-hon.js', """$$('.PX-t-total').forEach(function(x){x.textContent=fmt(total,divisa)});$('.PX-t-saldo').textContent=fmt(total-anticipo,divisa);""",
    """function fin(x,n){x.innerHTML=h(fmt(n,divisa))+(x.closest('.PX-final')?'<small>'+divisa+'</small>':'')}
      $$('.PX-t-total').forEach(function(x){fin(x,total)});fin($('.PX-t-saldo'),total-anticipo);""")
# generador: hoja de estilo de la segunda revisión al final; lang en el marco (para la justificación)
sub('tmp-dcc-gen.py', "css = lee('tmp-dcc-estilo.css') + lee(css_extra)", "css = lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')")
sub('tmp-dcc-gen.py', """'<div class="marco PX" data-vp="%s" data-v="a">""", """'<div class="marco PX" lang="es" data-vp="%s" data-v="a">""")
# estilo v1: se omiten las reglas viejas de posición de capas (esquina / mitad izquierda) y el patrón viejo de alerta
VIEJAS = [('tmp-dcc-estilo.css', ['.PX .PX-alerta{', '.PX[data-vp="ext"] .PX-alerta{', '.PX .PX-alerta.PX-act{', '.PX .PX-alerta h2{', '.PX .PX-alerta p{', '.PX .PX-alerta p.PX-fuerte{', '.PX .PX-al-p{', '.PX .PX-al-p .PX-prim{', '.PX .PX-al-col{',
        '.PX[data-vp="ih"] .PX-hoja{', '.PX[data-vp="ih"] .PX-hoja.PX-alta{', '.PX[data-vp="ih"] .PX-alerta{', '.PX[data-vp="esc"] .PX-hoja{', '.PX[data-vp="esc"] .PX-hoja.PX-alta{', '.PX[data-vp="esc"] .PX-hoja.PX-ancha{', '.PX[data-vp="esc"] .PX-alerta{',
        '  .PX .PX-alerta,.PX .PX-alerta.PX-act{', '.PX[data-vp="ih"] .PX-rej{', '.PX[data-vp="ih"] .PX-rej,.PX[data-vp="esc"] .PX-rej{', '.PX[data-vp="esc"] .PX-form{', '.PX[data-vp="esc"] .PX-barra{width', '.PX .PX-gen-otro{', '.PX .PX-centro{']),
    ('tmp-dcc-estilo-cons.css', ['.PX[data-vp="ih"] .PX-fi{', '.PX[data-vp="esc"] .PX-fi{', '.PX .PX-fi-acc .PX-txt:first-child{'])]
for f, pref in VIEJAS:
    p = os.path.join(L, f); ls = open(p).read().split('\n'); out = []; vistos = set()
    for l in ls:
        k = [x for x in pref if l.startswith(x)]
        if k:
            vistos.add(k[0]); continue
        out.append(l)
    falt = [x for x in pref if x not in vistos]
    assert not falt, falt
    open(p, 'w').write('\n'.join(out))
print('ok')
