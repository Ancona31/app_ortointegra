# Segunda revisión del dueño: sustituciones exactas sobre tmp-dcc-gen.py (capas con botones de verdad, alertas con el patrón único). Uso único.
import os
L = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(L, 'tmp-dcc-gen.py'); t = open(p).read()
def sub(a, b, n=1):
    global t
    assert t.count(a) >= 1, 'NO ENCONTRADO: ' + a[:80]
    t = t.replace(a, b) if n == 0 else t.replace(a, b, n)

# --- rejilla de tipos: icono arriba, nombre debajo en su propio span ---
sub(r"""%s</i>%s</button>'
                 % (n, ' aria-current="true"' if k == tipo else '', k, k, ic(d, 20), n) for k, n, d in TIPOS)""",
    r"""%s</i><span>%s</span></button>'
                 % (n, ' aria-current="true"' if k == tipo else '', k, k, ic(d, 20), n) for k, n, d in TIPOS)""")
# --- ¿Cambiar a X? ---
sub(r"""<div tabindex="-1" class="PX-pan PX-alerta" data-pan="camb" role="alertdialog" aria-modal="true" aria-label="¿Cambiar de documento?">
  <h2>¿Cambiar a <span class="PX-ent"></span>?</h2><p>Se descarta ''' + defi + ''' que estás llenando. No se puede deshacer.</p>
  <div class="PX-al-p PX-al-col"><button type="button" class="PX-p PX-txt PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-camb-ok">Cambiar a <span class="PX-ent"></span></button></div>
</div>""",
    r"""''' + alerta('camb', '¿Cambiar de documento?', 'mal', 'cambio', '¿Cambiar a <span class="PX-ent"></span>?', '<p>Se descarta ' + defi + ' que estás llenando. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-camb-ok">Cambiar a&nbsp;<span class="PX-ent"></span></button>') + '''""")
# --- hoja de plantillas ---
sub(r"""<span class="PX-mr-s PX-pl-n PX-flex"></span><button type="button" class="PX-p PX-txt PX-pick-gest">Gestionar plantillas</button>""",
    r"""<span class="PX-mr-s PX-pl-n PX-flex"></span><button type="button" class="PX-p PX-qui PX-pick-gest">Gestionar plantillas</button>""")
sub(r"""<div class="PX-hj-p"><span class="PX-flex"></span><button type="button" class="PX-p PX-txt PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-gpl-ok">Guardar</button></div>""",
    r"""<div class="PX-hj-p"><div class="PX-par"><button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-gpl-ok">Guardar</button></div></div>""")
sub(r"""<div tabindex="-1" class="PX-pan PX-alerta" data-pan="tope" role="alertdialog" aria-modal="true" aria-label="Ya tienes 10 plantillas">
  <h2>Ya tienes 10 plantillas de ''' + etiqueta + '''</h2><p>Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>
  <div class="PX-al-p"><button type="button" class="PX-p PX-txt PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-tope-ok">Gestionar plantillas</button></div>
</div>""",
    r"""''' + alerta('tope', 'Ya tienes 10 plantillas', 'ag', 'aviso', 'Ya tienes 10 plantillas de ' + etiqueta, '<p>Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-prim PX-tope-ok">Gestionar plantillas</button>') + '''""")
sub(r"""<button type="button" class="PX-p PX-txt PX-cierra" style="margin-left:-8px">Volver al formulario</button>""",
    r"""<button type="button" class="PX-p PX-qui PX-cierra">Volver al formulario</button>""")
sub(r"""<div tabindex="-1" class="PX-pan PX-alerta" data-pan="pl-eli" role="alertdialog" aria-modal="true" aria-label="¿Eliminar la plantilla?">
  <h2>¿Eliminar «<span class="PX-cpl-n"></span>»?</h2><p>Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.</p>
  <div class="PX-al-p"><button type="button" class="PX-p PX-txt PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Eliminar</button></div>
</div>
<div tabindex="-1" class="PX-pan PX-alerta" data-pan="pl-sob" role="alertdialog" aria-modal="true" aria-label="¿Sobrescribir la plantilla?">
  <h2>¿Sobrescribir «<span class="PX-cpl-n"></span>»?</h2><p>Se reemplaza el contenido guardado de «<span class="PX-cpl-n"></span>» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.</p>
  <div class="PX-al-p"><button type="button" class="PX-p PX-txt PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Sobrescribir</button></div>
</div>""",
    r"""''' + alerta('pl-eli', '¿Eliminar la plantilla?', 'mal', 'basura', '¿Eliminar «<span class="PX-cpl-n"></span>»?', '<p>Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Eliminar</button>') + '''
''' + alerta('pl-sob', '¿Sobrescribir la plantilla?', 'mal', 'sobre', '¿Sobrescribir «<span class="PX-cpl-n"></span>»?',
                 '<p>Se reemplaza el contenido guardado de «<span class="PX-cpl-n"></span>» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Cancelar</button><button type="button" class="PX-p PX-mal PX-cpl-ok">Sobrescribir</button>') + '''""")
# --- documento generado ---
sub(r"""<h2 class="PX-ok-t PX-gen-t"></h2>""", r"""<span class="PX-al-i PX-al-ok PX-gen-i">''' + ic(I['ok'], 28, 2) + '''</span><h2 class="PX-ok-t PX-gen-t"></h2>""")
sub(r"""<li><button type="button" class="PX-p PX-mr PX-gen-ver"><span class="PX-flex">Visualizar</span>""", r"""<li><button type="button" class="PX-p PX-mr PX-gen-ver">''' + fi('ojo') + '''<span class="PX-flex">Visualizar</span>""")
sub(r"""<li><button type="button" class="PX-p PX-mr PX-gen-mail"><span class="PX-ct">""", r"""<li><button type="button" class="PX-p PX-mr PX-gen-mail">''' + fi('correo') + '''<span class="PX-ct">""")
sub(r"""<li style="display:flex"><button type="button" class="PX-p PX-txt PX-gen-otro">Usar otro correo solo para este envío</button></li>""",
    r"""<li class="PX-gen-otro-f"><button type="button" class="PX-p PX-ton PX-ch PX-gen-otro">Usar otro correo solo para este envío</button></li>""")
sub(r"""<li><button type="button" class="PX-p PX-mr PX-gen-comp"><span class="PX-flex">''' + comp""", r"""<li><button type="button" class="PX-p PX-mr PX-gen-comp">''' + fi('descargar' if comp == 'Descargar' else 'compartir') + '''<span class="PX-flex">''' + comp""")
sub(r"""<div class="PX-barra-f"><button type="button" class="PX-p PX-txt PX-gen-can">Cancelar</button><span class="PX-flex"></span><button type="button" class="PX-p PX-prim PX-gen-env" disabled>Enviar por correo</button></div>""",
    r"""<div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-can">Cancelar</button><button type="button" class="PX-p PX-prim PX-gen-env" disabled>Enviar por correo</button></div>""")
sub(r"""<div class="PX-barra-f"><button type="button" class="PX-p PX-txt PX-gen-corr">Corregir</button><span class="PX-flex"></span><button type="button" class="PX-p PX-prim PX-gen-si">Sí, enviar ahí</button></div>""",
    r"""<div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-corr">Corregir</button><button type="button" class="PX-p PX-prim PX-gen-si">Sí, enviar ahí</button></div>""")
sub(r"""<div class="PX-barra-f"><button type="button" class="PX-p PX-txt PX-gen-no">No, gracias</button><span class="PX-flex"></span><button type="button" class="PX-p PX-prim PX-gen-guarda">Guardar en la ficha</button></div>""",
    r"""<div class="PX-par"><button type="button" class="PX-p PX-qui PX-gen-no">No, gracias</button><button type="button" class="PX-p PX-prim PX-gen-guarda">Guardar en la ficha</button></div>""")
sub(r"""<button type="button" class="PX-p PX-txt PX-centro PX-gen-cerrar">Cerrar</button>""", r"""<div class="PX-hj-p"><button type="button" class="PX-p PX-qui PX-gen-cerrar">Cerrar</button></div>""")
sub(r"""<div class="PX-bloque" data-gp="confirmando" hidden><p>""", r"""<div class="PX-bloque" data-gp="confirmando" lang="es" hidden><p>""")
# --- consentimiento: alertas propias ---
i0 = t.index("<div tabindex=\"-1\" class=\"PX-pan PX-alerta\" data-pan=\"prev\""); i1 = t.index("</div>''')\n    return capas_comunes(vp, 'consentimiento'")
nuevo = r"""''' + alerta('prev', 'Consentimiento a medias', 'ton', 'docs', 'Paciente Prueba 01 ya tiene un consentimiento a medias',
                 '<p>Solo puedes tener un borrador de consentimiento por paciente. Este es tuyo:</p><p class="PX-fuerte">Infiltración de rodilla</p><p class="PX-junto">Guardado el 17 de noviembre de 2026, 18:42 · sin firmar</p>'
                 '<p>Si lo reemplazas, se pierde lo que tenía escrito. No se puede deshacer.</p>',
                 '<button type="button" class="PX-p PX-qui PX-prev-no">Reemplazarlo</button><button type="button" class="PX-p PX-prim PX-prev-si">Retomar el borrador</button>') + '''
<!-- 25 · El punto de no retorno -->
''' + alerta('sellar', '¿Sellar y firmar el consentimiento?', 'ton', 'sello', '¿Sellar y firmar el consentimiento?',
                 '<p>Al sellar, el documento queda firmado, se guarda en el expediente y se registra su huella. Después ya no se puede editar: ni el texto, ni las firmas, ni las fotos. Si algo está mal, corrígelo ahora.</p>',
                 '<button type="button" class="PX-p PX-qui PX-cierra">Revisar otra vez</button><button type="button" class="PX-p PX-prim PX-sellar-ok">Sellar e imprimir</button>') + '''
''' + alerta('salir', '¿Salir del firmado?', 'ag', 'aviso', '¿Salir del firmado?',
                 '<p>Ya hay firmas capturadas y todavía no se han guardado. Si sales ahora se pierden y habrá que volver a pedirlas.</p>',
                 '<button type="button" class="PX-p PX-mal PX-salir-si">Salir y perder las firmas</button><button type="button" class="PX-p PX-prim PX-cierra">Seguir firmando</button>') + '''"""
t = t[:i0] + nuevo + t[i1 + len("</div>"):]
# --- menú con iconos de color ---
sub(r"""menu = (mr('borr', 'Guardar borrador', extra=' data-solo="a"') + mr('gpl', 'Guardar como plantilla') + mr('gest', 'Gestionar plantillas'))""",
    r"""menu = (mr('borr', 'Guardar borrador', extra=' data-solo="a"', icono='reloj') + mr('gpl', 'Guardar como plantilla', icono='marca') + mr('gest', 'Gestionar plantillas', icono='ajustes'))""")
sub(r"""mr('gpl', 'Guardar como plantilla') + mr('gest', 'Gestionar plantillas'), '')""", r"""mr('gpl', 'Guardar como plantilla', icono='marca') + mr('gest', 'Gestionar plantillas', icono='ajustes'), '')""")
# --- barras de acción: secundarios como botones quietos (H) ---
sub("PX-p PX-txt PX-b-sinfirma", "PX-p PX-qui PX-b-sinfirma", 0)
sub("PX-p PX-txt PX-b-gpl PX-otra-acc", "PX-p PX-qui PX-b-gpl PX-otra-acc", 0)
# --- firmado: botones de verdad, filas con icono ---
sub(r"""<button type="button" class="PX-p PX-ib PX-fi-x" aria-label="Salir del firmado">''' + ic(I['x'], 20, 2) + '''</button>""", r"""<button type="button" class="PX-p PX-ib PX-xc PX-fi-x" aria-label="Salir del firmado">''' + ic(I['x'], 16, 2.4) + '''</button>""")
sub(r"""<button type="button" class="PX-p PX-txt PX-fi-borra" disabled>Borrar y repetir</button><span class="PX-flex PX-solo-anc"></span>""", r"""<button type="button" class="PX-p PX-qui PX-ch PX-fi-borra" disabled>Borrar y repetir</button><span class="PX-flex PX-solo-esc"></span>""")
sub(r"""data-o="cam"><span class="PX-flex">Tomar foto</span>""", r"""data-o="cam">''' + fi('camara') + '''<span class="PX-flex">Tomar foto</span>""")
sub(r"""data-o="arch"><span class="PX-flex">Elegir archivo</span>""", r"""data-o="arch">''' + fi('carpeta') + '''<span class="PX-flex">Elegir archivo</span>""")
sub(r"""<button type="button" class="PX-p PX-mr PX-id-sin"><span class="PX-flex">Sin foto</span>""", r"""<button type="button" class="PX-p PX-mr PX-id-sin">''' + fi('sinfoto') + '''<span class="PX-flex">Sin foto</span>""")
sub(r"""<button type="button" class="PX-p PX-txt PX-rec-v">Volver</button><button type="button" class="PX-p PX-txt PX-rec-g">Girar</button><span class="PX-flex PX-solo-anc"></span>""",
    r"""<button type="button" class="PX-p PX-qui PX-rec-v">Volver</button><button type="button" class="PX-p PX-qui PX-rec-g">''' + ic(I['girar'], 16, 2) + '''Girar</button><span class="PX-flex PX-solo-esc"></span>""")
sub(r"""<div class="PX-fi-acc"><span class="PX-flex PX-solo-anc"></span><button type="button" class="PX-p PX-prim PX-res-ok">""", r"""<div class="PX-fi-acc"><span class="PX-flex PX-solo-esc"></span><button type="button" class="PX-p PX-prim PX-res-ok">""")
sub(r"""<p class="PX-fi-av" hidden>""", r"""<p class="PX-fi-av" lang="es" hidden>""")
# --- carácter (G): «Agregar» con «+»; borrador como etiqueta; textos justificables con lang ---
sub(r"""<button type="button" class="PX-p PX-add">Agregar</button>""", r"""<button type="button" class="PX-p PX-add">''' + ic(I['plus'], 18, 2.2) + '''Agregar</button>""")
sub(r"""<p class="PX-linea PX-borr-l" hidden><span class="PX-flex">Borrador guardado""", r"""<p class="PX-linea PX-borr-l" hidden><span class="PX-eq PX-eq-ag">''' + ic(I['reloj'], 14, 2) + '''Borrador</span><span class="PX-flex">Borrador guardado""")
sub(r"""<div class="PX-sec-c" role="region" aria-label="%s" hidden>""", r"""<div class="PX-sec-c" role="region" aria-label="%s" lang="es" hidden>""")
# --- iconos para JS ---
sub(r""".replace('__X__', json.dumps(""", r""".replace('__ICQ__', json.dumps({'ob': ic(I['aviso'], 14, 2), 'ed': ic(I['lapiz'], 14, 2)})).replace('__X__', json.dumps(""")
open(p, 'w').write(t)
print('ok')
