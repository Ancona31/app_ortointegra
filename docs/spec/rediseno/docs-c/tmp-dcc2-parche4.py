# Segunda revisión, igualado con docs-a (medidas finales que dio el coordinador). Uso único; solo reescribe texto en tmp-dcc2-estilo.css.
import os
L = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(L, 'tmp-dcc2-estilo.css'); t = open(p).read()
def sub(a, b):
    global t
    assert a in t, a[:70]
    t = t.replace(a, b, 1)
# botones de capa y de barra en ancho: 36, 14/600, radio 10
sub('.PX[data-vp="esc"] .PX-firma .PX-prim{height:38px;padding:0 16px;border-radius:10px;font-size:14px}', '.PX[data-vp="esc"] .PX-firma .PX-prim{height:36px;padding:0 16px;border-radius:10px;font-size:14px}')
sub('.PX[data-vp="ih"] .PX-par>*,.PX[data-vp="esc"] .PX-par>*{height:auto;min-height:38px}', '.PX[data-vp="ih"] .PX-par>*,.PX[data-vp="esc"] .PX-par>*{height:auto;min-height:36px}')
sub('.PX[data-vp="ih"] .PX-barra .PX-qui{font-size:15px}', '.PX[data-vp="ih"] .PX-barra .PX-qui,.PX[data-vp="ih"] .PX-barra .PX-prim{font-size:14px}')
# cerrar de hoja: círculo de 32
sub('.PX .PX-xc::before{content:"";position:absolute;inset:7px;', '.PX .PX-xc::before{content:"";position:absolute;inset:6px;')
sub('.PX[data-vp="esc"] .PX-xc::before{inset:3px}', '.PX[data-vp="esc"] .PX-xc::before{inset:2px}')
# hojas en ancho: 440; rejilla de tipos 600 en ih; menú de ih, tarjeta de 320
sub('.PX[data-vp="ih"] .PX-hoja{width:448px;max-height:calc(100% - 80px)}', '.PX[data-vp="ih"] .PX-hoja{width:440px;max-height:calc(100% - 80px)}\n.PX[data-vp="ih"] .PX-hoja.PX-menu{width:320px}')
sub('.PX[data-vp="ih"] .PX-hoja.PX-ancha{width:608px}', '.PX[data-vp="ih"] .PX-hoja.PX-ancha{width:600px}')
# pie de hoja en ancho: a la derecha, ancho mínimo 104 (igual que docs-a; en ih el botón derecho puede caer en la bisagra)
sub('/* Duo abierto: la pareja de una hoja mide lo mismo que la de una alerta (252, centrada): así ningún botón cae en la bisagra (x 455–496) */\n.PX[data-vp="ih"] .PX-hoja .PX-par{max-width:252px;margin-left:auto;margin-right:auto}',
    '.PX[data-vp="ih"] .PX-hoja .PX-par{justify-content:flex-end}')
sub('.PX[data-vp="esc"] .PX-hoja .PX-par>*{flex:0 1 auto;min-width:112px}', '.PX[data-vp="ih"] .PX-hoja .PX-par>*,.PX[data-vp="esc"] .PX-hoja .PX-par>*{flex:0 1 auto;min-width:104px}')
sub('.PX[data-vp="ih"] .PX-gen .PX-hj-p,.PX[data-vp="esc"] .PX-gen .PX-hj-p{justify-content:center}', '.PX[data-vp="ih"] .PX-gen .PX-hj-p,.PX[data-vp="esc"] .PX-gen .PX-hj-p{justify-content:flex-end}')
sub('.PX[data-vp="esc"] .PX-gen .PX-hj-p .PX-qui{flex:none;min-width:160px}', '.PX[data-vp="esc"] .PX-gen .PX-hj-p .PX-qui{flex:none;min-width:104px}')
sub('.PX[data-vp="ih"] .PX-pick-pie{flex-direction:row-reverse}\n.PX[data-vp="ih"] .PX-pick-pie .PX-pl-n{text-align:right}\n', '')
sub('.PX[data-vp="ih"] .PX-pl-ed{flex-direction:row-reverse}\n', '')
# celda de la rejilla de tipos: alto mínimo 84 (88 en ancho), relleno 12
sub('min-width:0;min-height:100px;padding:12px;', 'min-width:0;min-height:84px;padding:12px;')
sub('.PX[data-vp="ih"] .PX-az{padding:12px 10px}', '.PX[data-vp="ih"] .PX-az,.PX[data-vp="esc"] .PX-az{min-height:88px}')
open(p, 'w').write(t)
print('ok')
