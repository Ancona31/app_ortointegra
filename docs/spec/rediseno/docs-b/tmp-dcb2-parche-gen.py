# Parche de una sola vez: sustituye en tmp-dcb2-gen.py las piezas del chasis por las de la segunda revisión del dueño.
import os, re
L = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(L, 'tmp-dcb2-gen.py')
s = open(P).read()

def corta(s, ini, fin, nuevo):
    a = s.index(ini); b = s.index(fin, a)
    return s[:a] + nuevo + s[b:]

def cambia(s, viejo, nuevo, n=1):
    assert s.count(viejo) == n, (viejo, s.count(viejo))
    return s.replace(viejo, nuevo)

# ---- iconos nuevos ----
s = cambia(s, "FLECHA = ic(I['sig'], 14, 2.4)", r'''I.update(
    plantilla='<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    marcador='<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/>',
    ajustes='<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    borrador='<path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8L12.2 4a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.800L12 20"/><path d="m7.500 9.500 7 7"/>',
    ojo='<path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    correo='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.500 7 8.500 6 8.500-6"/>',
    compartir='<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    descargar='<path d="M12 3v12M8 11l4 4 4-4M5 20h14"/>',
)
FLECHA = ic(I['sig'], 14, 2.4)
MAS_I = ic(I['plus'], 18, 2.4)
def mi(k, s=20, w=1.8):
    return '<span class="QQ-mi">' + ic(I[k], s, w) + '</span>'
def alerta(pan, etq, tono, ico, cuerpo, botones):
    """Alerta de confirmación, patrón único (CALMA §13): icono en círculo de 48, título centrado, mensaje, dos botones parejos."""
    return ('<div tabindex="-1" class="QQ-pan QQ-alerta" data-pan="%s" role="alertdialog" aria-modal="true" aria-label="%s">'
            '<span class="QQ-al-i QQ-i-%s" aria-hidden="true">%s</span>%s<div class="QQ-al-p">%s</div></div>') % (pan, etq, tono, ic(I[ico], 28, 1.8), cuerpo, botones)''')

# ---- cabecera y barra ----
s = corta(s, "def cabecera(v):", "def capas_comunes(v, vp):", r'''def cabecera(v):
    return ("""<!-- A7-1 · Cabecera del chasis: «‹ Documentos» y, a su derecha, «Cambiar» (tonal pequeño, el mismo sitio en los ocho formularios y los cuatro marcos) + «···»;
     debajo, icono del tipo en su color (nivel 4, cuadro de 32) + título solo; una línea del paciente.
     A7-5 · ?tipo= abre este formulario; ?dx= precarga el diagnóstico; ?borrador= y ?doc= no tienen señal propia aquí. A7-16/17 · cargador y error del
     formulario («No se pudo cargar el formulario») y plan bloqueado -> /billing: estados de sistema, no dibujados (misma silueta: cabecera + una superficie). -->
<header class="QQ-top">
  <div class="QQ-top-f"><a href="#" class="QQ-p QQ-volver">""" + ic(I['volver'], 14, 2.6) + """Documentos</a><span class="QQ-flex"></span>
    <button type="button" class="QQ-p QQ-mini QQ-tonal QQ-b-cambiar" aria-haspopup="dialog">Cambiar</button>
    <button type="button" class="QQ-p QQ-ib QQ-mas-b" aria-label="Más opciones" aria-haspopup="menu">""" + ic(I['mas'], 22, 3) + """</button></div>
  <div class="QQ-tit"><span class="QQ-tico">""" + ic(I[v['ico']], 20) + """</span><h1>""" + v['nombre'] + """</h1></div>
  <p class="QQ-sub QQ-num"><span>Paciente Prueba 01 · 73 años</span><span class="QQ-etq QQ-e-mal QQ-urg-c" hidden>""" + ic(I['aviso'], 14, 2) + """Urgente</span></p>
</header>
<!-- A7-6 · Plantillas: UNA fila discreta al inicio (igual que en la parte 1), con su icono de color. Abre la hoja con las guardadas, «Vaciar formulario» y «— Sin plantilla —»; al aplicar, una línea con «Deshacer». -->
<section class="QQ-g QQ-g-pl"><div class="QQ-s"><button type="button" class="QQ-p QQ-r QQ-nav QQ-b-pl" aria-haspopup="dialog">""" + mi('plantilla', 18) + """<span>Plantilla</span><span class="QQ-nav-v"></span>""" + FLECHA + """</button></div>
  <p class="QQ-linea QQ-av-pl" aria-live="polite" hidden><span class="QQ-flex QQ-av-pl-t"></span><button type="button" class="QQ-p QQ-txt QQ-b-deshacer">Deshacer</button></p></section>""")

def barra():
    return ("""<!-- Barra de acción, alineada a los bordes de la columna: a la izquierda «Guardar como plantilla» como botón quieto (A7-7) y a la derecha el único primario, «Imprimir» (A7-12).
     Encima, solo cuando toca: aviso de perfil incompleto (A7-11), error de guardado y faltantes con enlaces a cada campo. -->
<div class="QQ-barra"><div class="QQ-barra-in">
  <p class="QQ-linea QQ-perfil" hidden>""" + ic(I['aviso'], 16, 2) + """<span class="QQ-flex">Completa tu perfil para que el documento salga con tu encabezado.</span><a href="#" class="QQ-p QQ-txt">Ir a mi perfil</a></p>
  <p class="QQ-falta" role="status" aria-live="polite" hidden></p>
  <div class="QQ-barra-f"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-b-plant" aria-disabled="true"><span class="QQ-solo-ancho">Guardar como plantilla</span><span class="QQ-solo-tel">Plantilla</span></button>
    <button type="button" class="QQ-p QQ-prim QQ-b-imp"><span class="QQ-giro" aria-hidden="true" hidden></span><span class="QQ-b-imp-t">Imprimir</span></button></div>
</div></div>""")

''')

# ---- capas comunes ----
s = corta(s, "def capas_comunes(v, vp):", "TOAST = ", r'''def capas_comunes(v, vp):
    asa = '<span class="QQ-asa" aria-hidden="true"></span>'
    X = '<button type="button" class="QQ-p QQ-ib QQ-cierra" aria-label="%s">' + ic(I['x'], 20, 2) + '</button>'
    rej = ''.join('<button type="button" class="QQ-p QQ-z" data-t="%s" data-n="%s" style="--c:var(--d-%s)"%s><span class="QQ-z-i">%s</span><span class="QQ-z-n">%s</span></button>'
                  % (k, n, tok, ' aria-current="true"' if k == v['ico'] else '', ic(I[k], 20), n) for k, n, tok in TIPOS)
    salida = ('<li><button type="button" class="QQ-p QQ-mr QQ-g-comp">' + mi('compartir') + '<span class="QQ-flex">Compartir</span>' + FLECHA + '</button></li>') if vp in ('ext', 'tel') else \
             ('<li><button type="button" class="QQ-p QQ-mr QQ-g-desc">' + mi('descargar') + '<span class="QQ-flex">Descargar</span>' + FLECHA + '</button></li>')
    return ("""<!-- Capas (CALMA §13). Velo con desenfoque, uno solo. En teléfono, hoja desde abajo; en Duo abierto y computadora, modal CENTRADO en el área de contenido.
     Dentro de una capa las acciones son botones (principal relleno, secundario tonal o quieto); las filas pulsables siguen siendo filas.
     Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir. En la app será un
     resorte (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<!-- «···»: plantillas (A7-6, A7-9), cada opción con su icono de color. En computadora el menú nace de su botón. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-menu" data-pan="menu" role="menu" aria-label="Más opciones">""" + asa + """
  <div class="QQ-hj-cab"><h2>Más opciones</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="gpl">""" + mi('marcador') + """<span class="QQ-flex">Guardar como plantilla</span></button>
    <button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="gest">""" + mi('ajustes') + """<span class="QQ-flex">Gestionar plantillas</span></button>
    <button type="button" class="QQ-p QQ-mr" role="menuitem" data-a="vac">""" + mi('borrador') + """<span class="QQ-flex">Vaciar formulario</span></button></div>
</div>
<!-- A7-2/3 · «Cambiar»: la rejilla de nivel 4 con los ocho tipos (2 columnas en teléfono, 4 en Duo abierto y computadora). Cada celda: icono en su cuadro tintado
     arriba y el nombre debajo, que parte en dos líneas si hace falta. Teclado: flechas, Inicio, Fin y Esc, como el tablist de hoy. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-ancha" data-pan="tipo" role="dialog" aria-modal="true" aria-label="Tipo de documento">""" + asa + """
  <div class="QQ-hj-cab"><h2>Tipo de documento</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><div class="QQ-rej" role="tablist" aria-label="Tipo de documento">""" + rej + """</div></div>
</div>
<!-- A7-4 · Confirmación si el formulario ya tiene datos. El rótulo de hoy («Cambiar a Receta») no cabe parejo junto a «Cancelar» en todos los tipos:
     cuando no cabe, los botones se apilan a todo el ancho, principal arriba (CALMA §13). -->
""" + alerta('cambiar', '¿Cambiar de tipo?', 'mal', 'aviso',
             '<h2 class="QQ-cam-t">¿Cambiar a Receta?</h2><p>Se descarta ' + v['def'] + ' que estás llenando. No se puede deshacer.</p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-bt QQ-rojo-s QQ-cam-ok">Cambiar a Receta</button>') + """
<!-- A7-6/10 · Aplicar una plantilla: lista con palomita. Estados: con plantillas, sin plantillas, error con «Reintentar»; el esqueleto de carga son tres filas grises (no dibujado). -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="usar" role="dialog" aria-modal="true" aria-label="Plantilla">""" + asa + """
  <div class="QQ-hj-cab"><h2>Plantilla</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><div class="QQ-pl-con"><div class="QQ-pl-l" role="radiogroup" aria-label="Plantilla"></div>
      <button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-pl-vaciar" role="radio" aria-checked="false"><span class="QQ-flex">Vaciar formulario</span>""" + PALOMA + """</button>
      <button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-pl-nada" role="radio" aria-checked="true"><span class="QQ-flex">— Sin plantilla —</span>""" + PALOMA + """</button></div>
    <div class="QQ-pl-sin" hidden><p class="QQ-mr-t" style="padding:8px 0 4px"><span style="font-size:16px;line-height:22px;font-weight:600">Sin plantillas de """ + v['etq'] + """</span>
      <span class="QQ-mr-s">Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.</span></p></div>
    <div class="QQ-pl-err" hidden><p class="QQ-fila" style="padding:8px 0"><span class="QQ-flex QQ-nota">No se pudieron cargar tus plantillas.</span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-pl-reint">Reintentar</button></p></div></div>
  <div class="QQ-hj-p QQ-pl-pie"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-pl-gest">Gestionar plantillas</button></div>
</div>
<!-- A7-7 · «Guardar como plantilla»: nombre; Enter confirma; avisa de nombre duplicado -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="guardar" data-foco="1" role="dialog" aria-modal="true" aria-label="Guardar como plantilla">""" + asa + """
  <div class="QQ-hj-cab"><h2>Guardar como plantilla</h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c"><p class="QQ-hj-sub">Se guarda todo menos los datos del paciente.</p>
    <label class="QQ-f" style="padding-top:0"><span>Nombre</span><input type="text" class="QQ-fin QQ-gp-in" placeholder="Prequirúrgico" autocomplete="off"></label>
    <p class="QQ-nota QQ-n-mal QQ-gp-dup" style="padding-top:8px" hidden>Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.</p></div>
  <div class="QQ-hj-p"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-gp-ok" disabled>Guardar</button></div>
</div>
<!-- A7-8 · Tope de 10 plantillas -->
""" + alerta('tope', 'Tope de plantillas', 'ag', 'aviso',
             '<h2>Ya tienes 10 plantillas de ' + v['etq'] + '</h2><p>Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-tope-ok">Gestionar plantillas</button>') + """
<!-- A7-9/10 · Gestionar: cada plantilla es una fila; su «···» despliega tres botones pequeños: Renombrar (en línea: Enter guarda, Esc cancela), Sobrescribir y Eliminar (con confirmación).
     Reintento por operación en una línea arriba. La X es «Volver al formulario» (también Esc). -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-alta" data-pan="gest" role="dialog" aria-modal="true" aria-label="Plantillas de """ + v['etq'] + """">""" + asa + """
  <div class="QQ-hj-cab"><h2>Plantillas de """ + v['etq'] + """</h2><span class="QQ-nota QQ-num QQ-gs-n">3 / 10</span>""" + X % 'Volver al formulario' + """</div>
  <div class="QQ-hj-c"><p class="QQ-fila QQ-gs-oper" style="padding:0 0 8px" hidden><span class="QQ-flex QQ-nota QQ-n-mal QQ-gs-oper-t"></span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-gs-reint">Reintentar</button></p>
    <p class="QQ-hj-sub QQ-gs-vac" hidden>El formulario no tiene nada que una plantilla guarde: no hay con qué sobrescribir.</p>
    <ul class="QQ-gs-l"></ul>
    <div class="QQ-gs-sin" hidden><p class="QQ-mr-t" style="padding:8px 0 12px"><span style="font-size:16px;line-height:22px;font-weight:600">Todavía no tienes plantillas de """ + v['etq'] + """</span>
      <span class="QQ-mr-s">Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.</span></p>
      <button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra QQ-ancho">Volver al formulario</button></div>
    <div class="QQ-gs-err" hidden><p class="QQ-fila" style="padding:8px 0"><span class="QQ-flex QQ-nota">No se pudieron cargar tus plantillas.</span><button type="button" class="QQ-p QQ-mini QQ-tonal QQ-pl-reint">Reintentar</button></p></div></div>
</div>
""" + alerta('conf', 'Confirmar', 'mal', 'basura',
             '<h2 class="QQ-cf-t"></h2><p class="QQ-cf-p"></p>',
             '<button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cf-no">Cancelar</button><button type="button" class="QQ-p QQ-bt QQ-rojo-s QQ-cf-ok"></button>') + """
<!-- A7-13/14/15 · Modal posterior: lista de filas pulsables con su icono. «Visualizar» abre el PDF; correo con la dirección de la ficha o «Usar otro correo solo para este envío»
     (confirmación explícita de la dirección escrita a mano y oferta de guardarla en la ficha); «Compartir» donde el equipo lo permite, «Descargar» donde no (igual que hoy). -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="gen" data-paso="listo" data-ok="1" role="dialog" aria-modal="true" aria-label=\"""" + v['tgen'] + """\">""" + asa + """
  <div class="QQ-ok-cab"><span class="QQ-ok-i" aria-hidden="true"><span class="QQ-ok-si">""" + ic(I['ok'], 22, 2.4) + """</span><span class="QQ-ok-no">""" + ic(I['aviso'], 22, 2) + """</span></span>
    <div class="QQ-flex"><h2 class="QQ-ok-t">""" + v['tgen'] + """</h2><p class="QQ-ok-s QQ-g-si">Ya puedes abrirlo para revisarlo o imprimirlo.</p></div></div>
  <div class="QQ-hj-c"><p class="QQ-nota QQ-just QQ-g-no" hidden>El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente.</p>
    <ul class="QQ-g-lista"><li><button type="button" class="QQ-p QQ-mr QQ-g-ver">""" + mi('ojo') + """<span class="QQ-flex">Visualizar</span>""" + FLECHA + """</button></li>
      <li><button type="button" class="QQ-p QQ-mr QQ-g-correo">""" + mi('correo') + """<span class="QQ-mr-t"><span class="QQ-g-correo-t">Enviar por correo</span><span class="QQ-mr-s QQ-g-dest">Se enviará a paciente01@semilla.spinus.test</span><span class="QQ-g-noexp" hidden><span class="QQ-etq QQ-e-ag">No quedó en el expediente</span></span></span>""" + FLECHA + """</button></li>
      """ + salida + """</ul>
    <button type="button" class="QQ-p QQ-bt QQ-tonal QQ-ancho QQ-g-otro">Usar otro correo solo para este envío</button>
    <div class="QQ-g-pide" hidden><label class="QQ-f"><span>Correo solo para este envío (la ficha no se toca):</span><input type="email" inputmode="email" class="QQ-fin QQ-g-in" placeholder="nombre@correo.com" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
      <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-canc">Cancelar</button><button type="button" class="QQ-p QQ-prim QQ-g-enviar" disabled>Enviar por correo</button></p></div>
    <div class="QQ-g-conf" hidden><p class="QQ-nota" style="padding-top:10px">Va a enviar el documento a esta dirección escrita a mano:</p><p class="QQ-dir QQ-g-dir"></p>
      <p class="QQ-nota QQ-just">Compruébala letra por letra. El archivo lleva datos clínicos dentro y un correo enviado no se puede recuperar.</p>
      <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-corr">Corregir</button><button type="button" class="QQ-p QQ-prim QQ-g-si-env">Sí, enviar ahí</button></p></div>
    <div class="QQ-g-hecho" hidden><p class="QQ-nota QQ-just" style="padding-top:10px" aria-live="polite">Enviado a <span class="QQ-g-a"></span> con el PDF adjunto. Si no aparece, pídele que revise su carpeta de <b>spam o correo no deseado</b>.</p>
      <div class="QQ-g-ofrece" hidden><p class="QQ-nota" style="padding-top:10px">¿Guardas <b class="QQ-g-a2"></b> en la ficha del paciente para la próxima vez?</p>
        <p class="QQ-fila QQ-par"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-g-nog">No, gracias</button><button type="button" class="QQ-p QQ-bt QQ-tonal QQ-g-ficha">Guardar en la ficha</button></p></div>
      <p class="QQ-nota QQ-g-fichaok" style="padding-top:8px" hidden>Guardado en la ficha del paciente.</p></div></div>
  <div class="QQ-hj-p"><button type="button" class="QQ-p QQ-bt QQ-quieto QQ-cierra">Cerrar</button></div>
</div>
<!-- Lista de opciones con palomita: sustituye a los <select> nativos -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="ops" role="dialog" aria-modal="true" aria-label="Opciones">""" + asa + """
  <div class="QQ-hj-cab"><h2 class="QQ-ops-t"></h2>""" + X % 'Cerrar' + """</div>
  <div class="QQ-hj-c QQ-ops-l" role="radiogroup"></div>
</div>""")

''')

# ---- Suplementación: fila que abre el catálogo y catálogo sin buscador ----
s = cambia(s, '''<button type="button" class="QQ-p QQ-r QQ-add QQ-b-cat" data-c="sup" aria-haspopup="dialog">Agregar suplemento</button>', 'QQ-sup-n',''',
           '''<button type="button" class="QQ-p QQ-r QQ-add QQ-b-cat" data-c="sup" aria-haspopup="dialog" aria-label="Suplementos: abrir el catálogo">\' + MAS_I + \'<span class="QQ-flex">Suplementos</span><span class="QQ-add-n QQ-num QQ-sup-n"></span><span class="QQ-fle">\' + FLECHA + \'</span></button>', '',''')
s = cambia(s, "la × la quita. «Agregar suplemento» abre el catálogo de nueve con palomitas.", "la × la quita. La última fila («+ Suplementos · N de 9», con los rótulos de hoy) abre el catálogo de nueve con palomitas.")
s = corta(s, "def capas5(vp):", "CSS5 = '''", r'''def capas5(vp):
    asa = '<span class="QQ-asa" aria-hidden="true"></span>'
    return ("""<!-- Catálogo de suplementos: nueve filas con palomita; nombre, dosis de referencia por kilo y beneficio clínico (acotado, con «Ver completo»). Sin buscador: hoy no existe. -->
<div tabindex="-1" class="QQ-pan QQ-hoja QQ-alta" data-pan="cat" role="dialog" aria-modal="true" aria-label="Suplementos">""" + asa + """
  <div class="QQ-hj-cab"><h2>Suplementos</h2><span class="QQ-nota QQ-num QQ-sup-n"></span><button type="button" class="QQ-p QQ-mini QQ-lleno QQ-cierra">Listo</button></div>
  <div class="QQ-hj-c"><ul class="QQ-cat-l"></ul></div>
</div>
<!-- Hoja de un suplemento elegido: los tres campos de hoy (Dosis, Marca comercial, Nota / justificación) -->
<div tabindex="-1" class="QQ-pan QQ-hoja" data-pan="sup" role="dialog" aria-modal="true" aria-label="Suplemento">""" + asa + """
  <div class="QQ-hj-cab"><h2 class="QQ-se-t"></h2><button type="button" class="QQ-p QQ-mini QQ-lleno QQ-cierra">Listo</button></div>
  <div class="QQ-hj-c"><p class="QQ-hj-sub QQ-num QQ-se-ref" style="padding-bottom:4px"></p><p class="QQ-nota QQ-just QQ-se-ben"></p>
    <label class="QQ-f"><span>Dosis</span><input type="text" class="QQ-fin QQ-se-dosis" autocomplete="off"></label>
    <label class="QQ-f"><span>Marca comercial</span><input type="text" class="QQ-fin QQ-se-marca" placeholder="Ej: Nordic Naturals" autocomplete="off"></label>
    <label class="QQ-f"><span>Nota / justificación</span><input type="text" class="QQ-fin QQ-se-just" placeholder="Ej: Vitamina D 18 ng/mL en laboratorio" autocomplete="off"></label></div>
  <div class="QQ-hj-p"><button type="button" class="QQ-p QQ-bt QQ-rojo-s QQ-se-quitar">Quitar</button></div>
</div>""")

''')
for viejo in ["\n.QQ .QQ-cat-b{flex:none;position:relative;margin:0 16px 4px}", "\n.QQ .QQ-cat-bi{position:absolute;left:12px;top:0;bottom:0;display:flex;align-items:center;color:var(--tinta3);pointer-events:none}",
              "\n.QQ .QQ-cat-q{padding-left:38px}", '\n.QQ[data-vp="ih"] .QQ-cat-b,.QQ[data-vp="esc"] .QQ-cat-b{margin:0 20px 4px}']:
    s = cambia(s, viejo, '')

# ---- Internamiento ----
s = cambia(s, '''aria-label="Agregar diagnóstico secundario">Agregar</button>')''', '''aria-label="Agregar diagnóstico secundario">' + MAS_I + 'Agregar</button>')''')
s = cambia(s, '''<button type="button" class="QQ-p QQ-txt QQ-nuevo-ok">Añadir</button>''', '''<button type="button" class="QQ-p QQ-mini QQ-tonal QQ-nuevo-ok">Añadir</button>''')
s = cambia(s, ".replace('class=\"QQ-r\"', 'class=\"QQ-r QQ-larga\"')", '', 2)
s = cambia(s, '''/* Etiquetas que no caben en 180 px a 13: parten en dos renglones en vez de montarse sobre el valor */
.QQ[data-vp="ih"] .QQ-larga .QQ-l,.QQ[data-vp="esc"] .QQ-larga .QQ-l{display:block;right:auto;width:176px;top:8px;line-height:16px;white-space:normal}''',
           '''/* Etiquetas largas («Hospital / lugar de internamiento», «Fecha propuesta de ingreso»): en este formulario la columna de etiquetas mide 260 en vez de 208,
   así ninguna parte en dos renglones y todos los valores siguen alineados en una sola vertical */
.QQ[data-vp="ih"] .QQ-in,.QQ[data-vp="esc"] .QQ-in,.QQ[data-vp="ih"] .QQ-sel,.QQ[data-vp="esc"] .QQ-sel{padding-left:264px}
.QQ[data-vp="ih"] .QQ-rl .QQ-in,.QQ[data-vp="esc"] .QQ-rl .QQ-in{padding-left:20px}''')

# ---- Escrito médico ----
s = corta(s, "    barra_f = (", "    return ('''<!-- A7-23", r'''    barra_f = ('<div class="QQ-fb" role="group" aria-label="Formato del escrito">'
               '<button type="button" class="QQ-p QQ-fb-b QQ-fb-bl" data-m="bloque" aria-haspopup="menu" aria-label="Bloque: Normal"><span class="QQ-fb-bi">' + ic(I['parr'], 18, 2) + '</span><span class="QQ-fb-bn">Normal</span>' + ic(I['abajo'], 13, 2.2) + '</button>'
               + fb('bold', 'Negrita', 'negrita') + fb('italic', 'Cursiva', 'cursiva') + fb('ul', 'Viñetas', 'vin') + fb('ol', 'Numerada', 'numer') + fb('underline', 'Subrayado', 'subr', 'QQ-solo-ancho')
               + '<button type="button" class="QQ-p QQ-fb-b QQ-fb-al QQ-solo-ancho" data-m="alin" aria-haspopup="menu" aria-label="Alineación: Justificado"><span class="QQ-fb-ali">' + ic(I['a_justify'], 18, 2) + '</span></button>'
               + fb('quote', 'Cita', 'cita', 'QQ-solo-ancho') + fb('hr', 'Separador', 'sep', 'QQ-solo-ancho') + fb('clear', 'Quitar formato', 'quitar', 'QQ-solo-ancho')
               + '<span class="QQ-flex"></span><button type="button" class="QQ-p QQ-fb-b QQ-fb-mas QQ-solo-tel" data-m="masf" aria-haspopup="menu" aria-label="Más opciones de formato">' + ic(I['mas'], 20, 3) + '</button></div>')
''')
s = cambia(s, '''     Teléfono: bloque, negrita, cursiva, viñetas, numerada, subrayado y alineación en una fila que se desplaza de lado; «···» fijo a la derecha con Cita, Separador y Quitar formato.
     Ancho: los diez controles a la vista y sin «···» (igual que hoy a partir de 760 px). No hay deshacer/rehacer: tampoco hoy. -->''',
           '''     Teléfono: caben enteros, sin desplazar ni cortar, el bloque y los cuatro de primer nivel de hoy (negrita, cursiva, viñetas, numerada); a la derecha, separado por una
     línea, «···» abre la hoja con los demás, con su nombre escrito: Subrayado, Alineación (abre su lista), Cita, Separador y Quitar formato. Mismo reparto por niveles que hoy.
     Ancho: los diez controles a la vista y sin «···» (igual que hoy a partir de 760 px). No hay deshacer/rehacer: tampoco hoy.
     El texto se ve JUSTIFICADO por defecto (CALMA §12); si el médico elige otra alineación, se respeta la suya. -->''')
s = cambia(s, '''<div class="QQ-ed" contenteditable="true"''', '''<div class="QQ-ed" lang="es" contenteditable="true"''')
s = cambia(s, '''<div class="QQ-hj-cab"><h2>Datos del documento</h2><button type="button" class="QQ-p QQ-txt QQ-cierra">Listo</button></div>''',
           '''<div class="QQ-hj-cab"><h2>Datos del documento</h2><button type="button" class="QQ-p QQ-mini QQ-lleno QQ-cierra">Listo</button></div>''')
s = cambia(s, '''<button type="button" class="QQ-p QQ-txt QQ-usar" hidden>Usar el título</button>''', '''<button type="button" class="QQ-p QQ-mini QQ-tonal QQ-usar" hidden>Usar el título</button>''')
s = cambia(s, '''  <div class="QQ-hj-c">\'\'\' + mr('data-f="quote"', 'cita', 'Cita') + mr('data-f="hr"', 'sep', 'Separador', False) + mr('data-f="clear"', 'quitar', 'Quitar formato', False) + \'\'\'</div>''',
           '''  <div class="QQ-hj-c">\'\'\' + mr('data-f="underline"', 'subr', 'Subrayado')
            + '<button type="button" class="QQ-p QQ-mr" role="menuitem" data-m="alin" aria-haspopup="menu"><span class="QQ-mi">' + ic(I['a_justify'], 20, 2) + '</span><span class="QQ-flex">Alineación</span><span class="QQ-mr-v QQ-al-v">Justificado</span>' + FLECHA + '</button>'
            + mr('data-f="quote"', 'cita', 'Cita') + mr('data-f="hr"', 'sep', 'Separador', False) + mr('data-f="clear"', 'quitar', 'Quitar formato', False) + \'\'\'</div>''')
s = cambia(s, "\n.QQ .QQ-mi{display:flex;color:var(--tinta2)}", "")
s = cambia(s, '<div class="QQ-capa" aria-hidden="true">', '<div class="QQ-capa" lang="es" aria-hidden="true">')
open(P, 'w').write(s)
print('ok', len(s))
