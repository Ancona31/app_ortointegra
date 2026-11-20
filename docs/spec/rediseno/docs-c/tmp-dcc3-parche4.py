# CUARTA PASADA (CALMA §23, puntos 1, 2, 9; iguales a docs-a: icono de capas en «Plantilla», «Imprimir sin firma» en ih). Uso único. Copia previa en tmp-v3/.
import os
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b):
    p = os.path.join(L, f); t = open(p).read(); assert a in t, 'NO ENCONTRADO %s: %s' % (f, a[:80]); open(p, 'w').write(t.replace(a, b, 1))
G = 'tmp-dcc-gen.py'
# 1 · barra del pie en ancho: secundario a la izquierda, principal a la derecha
sub(G, """        fila = ('<button type="button" class="PX-p PX-prim PX-b-firmar PX-otra-acc" data-solo="a">Firmar</button><button type="button" class="PX-p PX-prim PX-b-imp" data-solo="b">Imprimir</button>'
                '<button type="button" class="PX-p PX-qui PX-b-sinfirma" data-solo="a">' + ('Imprimir sin firma' if vp in ('iv', 'esc') else 'Sin firma') + '</button>')""",
    """        fila = ('<button type="button" class="PX-p PX-qui PX-b-sinfirma" data-solo="a">Imprimir sin firma</button>'
                '<button type="button" class="PX-p PX-prim PX-b-firmar PX-otra-acc" data-solo="a">Firmar</button><button type="button" class="PX-p PX-prim PX-b-imp" data-solo="b">Imprimir</button>')""")
sub(G, """        fila = '<button type="button" class="PX-p PX-prim PX-b-imp">Imprimir</button><button type="button" class="PX-p PX-qui PX-b-gpl PX-otra-acc">Guardar como plantilla</button>'""",
    """        fila = '<button type="button" class="PX-p PX-qui PX-b-gpl PX-otra-acc">Guardar como plantilla</button><button type="button" class="PX-p PX-prim PX-b-imp">Imprimir</button>'""")
# 2 · «Descargar» en todos los marcos
sub(G, "comp = 'Descargar' if vp in ('ih', 'iv', 'esc') else 'Compartir'", "comp = 'Descargar'")
sub('tmp-dcc-chasis.js', "A.toast(ancho?'Maqueta: aquí se descarga el PDF':'Maqueta: aquí se abre la hoja de compartir del sistema')", "A.toast('Maqueta: aquí se descarga el PDF')")
# 9 · quinta píldora «Más» en la pista de iv
sub(G, "p('Documentos', True) + '</nav>'", "p('Documentos', True) + p('Más') + '</nav>'")
# icono de la fila «Plantilla»: capas apiladas, como docs-a
sub(G, "    barra='<rect", "    capas='<path d=\"m12 3 9 5-9 5-9-5 9-5Z\"/><path d=\"m3 13 9 5 9-5\"/>',\n    barra='<rect")
sub(G, "fi('plant', 18) + '<span class=\"PX-flex\">Plantilla</span>", "fi('capas', 18) + '<span class=\"PX-flex\">Plantilla</span>")
print('ok')
