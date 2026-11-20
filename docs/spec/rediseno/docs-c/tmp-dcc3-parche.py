# TERCERA REVISIÓN (CALMA §17–§22): sustituciones exactas sobre el generador y el chasis. Uso único.
# Copia de la segunda ronda en tmp-v2/. Después: python3 tmp-dcc-gen.py && build.
import os
L = os.path.dirname(os.path.abspath(__file__))
def sub(f, a, b, n=1):
    p = os.path.join(L, f); t = open(p).read()
    assert a in t, 'NO ENCONTRADO %s: %s' % (f, a[:80])
    open(p, 'w').write(t.replace(a, b) if n == 0 else t.replace(a, b, n))
G = 'tmp-dcc-gen.py'
# --- §19 · quinto marco iv: icono de barra lateral y encabezado fundido con pista de secciones ---
sub(G, "    girar='<path d=\"M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5\"/>',\n)",
    "    girar='<path d=\"M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5\"/>',\n    barra='<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"15\" rx=\"3\"/><path d=\"M9.5 4.5v15\"/>',\n)")
sub(G, "# ---------- Piezas del chasis ----------",
    """def encabezado_iv():
    \"\"\"Duo abierto en vertical (CALMA §19): encabezado fundido con botón de barra lateral, pista de secciones y avatar.
    Administración, Mi perfil y Ayuda se alcanzan desde el botón de la izquierda (menú completo) o el avatar.\"\"\"
    def p(t, act=False):
        return '<a href="#" class="PX-p PX-pi"%s>%s</a>' % (' aria-current="page"' if act else '', t)
    return ('<header class="PX-enc PX-enc-iv"><button type="button" class="PX-p PX-menu-b PX-lat-b" aria-label="Mostrar barra lateral">' + ic(I['barra'], 20) + '</button>'
            '<nav class="PX-pista" aria-label="Secciones">' + p('Inicio') + p('Expediente') + p('Agenda') + p('Documentos', True) + '</nav>'
            '<button type="button" class="PX-p PX-av PX-av-g" aria-label="Mi perfil">AS</button></header>')

# ---------- Piezas del chasis ----------""")
sub(G, "nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'esc': lateral}[vp]()", "nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'iv': encabezado_iv, 'esc': lateral}[vp]()")
sub(G, "app = (nav + '\\n' + col) if vp in ('tel', 'esc') else (col + '\\n' + nav)", "app = (nav + '\\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\\n' + nav)")
sub(G, "cuerpo = ''.join(hacer(v) for v in ('ext', 'tel', 'ih', 'esc'))", "cuerpo = ''.join(hacer(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc'))")
sub(G, "comp = 'Descargar' if vp in ('ih', 'esc') else 'Compartir'", "comp = 'Descargar' if vp in ('ih', 'iv', 'esc') else 'Compartir'")
sub(G, "def cons_barra(vp):\n    if vp in ('ih', 'esc'):", "def cons_barra(vp):\n    if vp in ('ih', 'iv', 'esc'):")
sub(G, "('Imprimir sin firma' if vp == 'esc' else 'Sin firma')", "('Imprimir sin firma' if vp in ('iv', 'esc') else 'Sin firma')")
sub(G, "def hon_barra(vp):\n    if vp in ('ih', 'esc'):", "def hon_barra(vp):\n    if vp in ('ih', 'iv', 'esc'):")
sub(G, "def cons_cuerpo(vp):\n    ancho = vp in ('ih', 'esc')", "def cons_cuerpo(vp):\n    ancho = vp in ('ih', 'iv', 'esc')")
# Hoja de estilo: el marco iv hereda la composición de ih (cada selector de ih se duplica para iv) y después la tercera revisión
sub(G, "def vista(px, dtok, nombre, frase, notas, css_extra, js_extra, hacer):\n    css = lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')",
    """def con_iv(css):
    \"\"\"Cada lista de selectores que nombra al Duo abierto horizontal gana su gemelo vertical: iv parte de la composición de ih (CALMA §19).
    Lo que en iv es distinto (navegación, toque de 44, anchos de capa) lo corrige tmp-dcc3-estilo.css, que va al final.\"\"\"
    import re
    def f(m):
        pre = m.group(1); k = pre.rfind('*/') + 2 if '*/' in pre else 0
        cab, sel = pre[:k], pre[k:]
        if '[data-vp="ih"]' not in sel or sel.strip().startswith('@'):
            return m.group(0)
        partes = [s for s in sel.split(',')]
        extra = [s.replace('[data-vp="ih"]', '[data-vp="iv"]') for s in partes if '[data-vp="ih"]' in s]
        return cab + ','.join(partes + [e.strip() for e in extra]) + '{'
    return re.sub(r'([^{}]+)\\{', f, css)

def vista(px, dtok, nombre, frase, notas, css_extra, js_extra, hacer):
    css = con_iv(lee('tmp-dcc-estilo.css') + lee(css_extra) + lee('tmp-dcc2-estilo.css')) + lee('tmp-dcc3-estilo.css')""")
# --- §20 · «Expediente» en la navegación ---
sub(G, "b('pac', 'Pacientes y expedientes')", "b('pac', 'Expediente')")
sub(G, "a('pac', 'Pacientes')", "a('pac', 'Expediente')")
# --- §20 · alertas: «Cambiar» y «Gestionar» (el título conserva el nombre completo) ---
sub(G, """<button type="button" class="PX-p PX-mal PX-camb-ok"><span>Cambiar a <span class="PX-ent"></span></span></button>""", """<button type="button" class="PX-p PX-mal PX-camb-ok">Cambiar</button>""")
sub(G, """<button type="button" class="PX-p PX-prim PX-tope-ok">Gestionar plantillas</button>""", """<button type="button" class="PX-p PX-prim PX-tope-ok">Gestionar</button>""")
# --- §21 · rejilla de tipos: título «Tipo de documento», hoja --sup (sin PX-gris) ---
sub(G, """<div tabindex="-1" class="PX-pan PX-hoja PX-gris PX-ancha" data-pan="tipo" role="dialog" aria-modal="true" aria-label="Documento">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Documento</h2>""", """<div tabindex="-1" class="PX-pan PX-hoja PX-ancha" data-pan="tipo" role="dialog" aria-modal="true" aria-label="Tipo de documento">''' + ASA + '''
  <div class="PX-hj-cab"><h2>Tipo de documento</h2>""")
# comentario del firmado: ya no esquiva la bisagra
sub(G, "modal en ancho (en Duo abierto, sobre la mitad izquierda, sin cruzar la bisagra).", "modal centrado en ancho (Duo abierto horizontal y vertical, computadora), con el papel amplio.")
# --- chasis: iv es un marco ancho ---
sub('tmp-dcc-chasis.js', "var vp=m.dataset.vp,esc=vp==='esc',ancho=esc||vp==='ih';", "var vp=m.dataset.vp,esc=vp==='esc',ancho=esc||vp==='ih'||vp==='iv';")
sub('tmp-dcc-chasis.js', "gobierna los cuatro marcos a la vez", "gobierna los cinco marcos a la vez")
sub('tmp-dcc-estilo-cons.css', "/* Ancho: modal. En Duo abierto, sobre la mitad izquierda (x < 455): el lienzo no cruza la bisagra. */", "/* Ancho: modal centrado en el área de contenido (la bisagra ya no condiciona las capas, CALMA §18). */")
print('ok')
# --- Igualado con docs-a (mensaje del coordinador): cuadro del icono tintado sobre --sup2; «Gestionar» con aria-label completo ---
if __name__ == '__main__' and os.environ.get('IGUALA'):
    sub(G, "<i style=\"background:color-mix(in srgb,var(--d-%s) var(--d-mezcla),var(--sup));color:var(--d-%s)\">", "<i style=\"background:color-mix(in srgb,var(--d-%s) var(--d-mezcla),var(--sup2));color:var(--d-%s)\">")
    sub(G, """<button type="button" class="PX-p PX-prim PX-tope-ok">Gestionar</button>""", """<button type="button" class="PX-p PX-prim PX-tope-ok" aria-label="Gestionar plantillas">Gestionar</button>""")
    print('igualado')
