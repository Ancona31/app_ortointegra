# Sustituciones exactas sobre las fuentes. Uso: python3 tmp-dcc-parche.py
import os
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b, todas=False):
    p = os.path.join(L, f); t = open(p).read()
    if a not in t: print('NO ENCONTRADO', f, a[:70]); return
    open(p, 'w').write(t.replace(a, b) if todas else t.replace(a, b, 1))
sub('tmp-dcc-cons.js', "A.plantillas([]);$('.PX-mas-b').click()", "A.plantillas([]);$('.PX-pl-fila').click()")
sub('tmp-dcc-chasis.js', "if(a==='pl')abrePicker();else if(a==='gpl')guardarPl();", "if(a==='gpl')A.guardarPl();")
t = '../../tools/tmp-dcc-cap.js'
sub(t, "await q('.PX-mas-b').click(); await q('.PX-menu [data-a=\"pl\"]').click(); await cap('32-plantilla');", "await q('.PX-pl-fila').click(); await cap('32-plantilla');")
sub(t, "await T('Sin plantillas'); await q('.PX-menu [data-a=\"pl\"]').click(); await cap('37-sin-plantillas');", "await T('Sin plantillas'); await cap('37-sin-plantillas');")
print('ok')
