# Genera vista-consulta.html (Nota de consulta, reglas de CALMA). Uso: python3 tmp-nc3-gen.py
import os
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8):
    return '<svg aria-hidden="true" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (s, s, w, d)

I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    perfil='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
)

# ---------- A0 · Navegación: copiada del referente aprobado (activo = Expediente, CALMA §20) ----------
def riel():
    def b(k, t, act=False):
        return '<a href="#" class="nc2-p nc2-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="nc2-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente', True) + b('agenda', 'Agenda') + b('docs', 'Documentos')
            + '<a href="#" class="nc2-p nc2-rb" aria-label="Más">' + ic(I['mas'], 22, 3) + '</a><span class="nc2-flex"></span>'
            '<button type="button" class="nc2-p nc2-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lateral():
    def a(k, t, act=False):
        return '<a href="#" class="nc2-p nc2-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    return ('<nav class="nc2-lat" aria-label="Navegación principal"><div class="nc2-lat-cab"><span class="nc2-logo">' + ic(I['logo'], 24) + '<span class="nc2-logo-n">Spinus</span></span><span class="nc2-plan">Plan VIP</span></div>'
            '<button type="button" class="nc2-p nc2-cons-b"><span class="nc2-av">AS</span><span class="nc2-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="nc2-lista">' + a('inicio', 'Inicio') + a('pac', 'Expediente', True) + a('agenda', 'Agenda') + a('docs', 'Documentos') + a('admin', 'Administración') + '</div><span class="nc2-flex"></span>'
            '<div class="nc2-lat-pie"><a href="#" class="nc2-p nc2-li nc2-yo">' + ic(I['perfil'], 20) + '<span>Dr. Admin Semilla<small>Mi perfil · Ajustes</small></span></a></div></nav>')

def encabezado():
    return ('<header class="nc2-enc"><button type="button" class="nc2-p nc2-menu-b" aria-label="Menú">' + ic(I['menu'], 22, 2) + '</button><span class="nc2-enc-t">Expediente</span><span class="nc2-flex"></span>'
            '<button type="button" class="nc2-p nc2-av nc2-av-g" aria-label="Mi perfil">AS</button></header>')

def fundido():
    pista = ''.join('<a href="#" class="nc2-p nc2-pl"%s>%s</a>' % (' aria-current="page"' if t == 'Expediente' else '', t) for t in ('Inicio', 'Expediente', 'Agenda', 'Documentos', 'Más'))
    # CALMA §23.9 · «Más» abre el mismo menú que el «···» del riel de ext (en esta maqueta, igual que el del riel, no se dibuja). Sigue marcado «Expediente».
    return ('<!-- Duo abierto vertical (CALMA §19): encabezado fundido con la pista de secciones. Administración, Mi perfil y Ayuda: desde «Mostrar barra lateral» o el avatar. -->\n'
            '<header class="nc2-fun"><button type="button" class="nc2-p nc2-fun-b" aria-label="Mostrar barra lateral">' + ic('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>', 20) + '</button>'
            '<nav class="nc2-pista" aria-label="Navegación principal">' + pista + '</nav>'
            '<button type="button" class="nc2-p nc2-av nc2-av-g" aria-label="Mi perfil">AS</button></header>')

I.update(
    lapiz='<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
    destello='<path d="M11 3.5 12.8 9a2 2 0 0 0 1.3 1.3l5.4 1.7-5.4 1.8a2 2 0 0 0-1.3 1.3L11 20.5l-1.8-5.4a2 2 0 0 0-1.3-1.3L2.5 12l5.4-1.7A2 2 0 0 0 9.2 9z"/><path d="M19 3v4M17 5h4"/>',
    candado='<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    impresora='<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14.5h10v6H7z"/>',
    ojo='<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
)

TOP = """<!-- F1 · Volver al expediente (la flecha lleva el nombre del paciente), título y fecha.
     F2 · Etiquetas bajo el título, con color suave e icono (CALMA §11): origen «Nota manual» (lápiz) o «Nota IA» (destello) en tonal; «Nota sellada» (candado) en verde suave.
     F3 · «Imprimir» es un botón tonal pequeño con impresora: «Imprimir» → «Generando...» (con giro) → se sustituye por el enlace «Abrir PDF» (ojo; en la app, <a href=blob:> que abre el visor). -->
  <header class="nc2-top">
    <div class="nc2-top-f">
      <a href="#" class="nc2-p nc2-volver" aria-label="Volver al expediente de Paciente Prueba 01">""" + ic(I['volver'], 16, 2.4) + """<span class="nc2-volver-t">Paciente Prueba 01</span></a>
      <span class="nc2-flex"></span>
      <button type="button" class="nc2-p nc2-ton nc2-imp" data-est="listo" aria-disabled="false"><span class="nc2-imp-i">""" + ic(I['impresora'], 16, 1.9) + """</span><span class="nc2-giro" aria-hidden="true" hidden></span><span class="nc2-imp-t" aria-live="polite">Imprimir</span></button>
      <a href="#" class="nc2-p nc2-ton nc2-pdf" hidden>""" + ic(I['ojo'], 16, 1.9) + """Abrir PDF</a>
    </div>
    <h1>Nota de Consulta</h1>
    <p class="nc2-sub nc2-num">17 de noviembre de 2026</p>
    <p class="nc2-etqs"><span class="nc2-etq nc2-o-man">""" + ic(I['lapiz'], 14, 2) + """Nota manual</span><span class="nc2-etq nc2-o-ia">""" + ic(I['destello'], 14, 2) + """Nota IA</span><span class="nc2-etq nc2-etq-ok">""" + ic(I['candado'], 14, 2) + """Nota sellada</span></p>
  </header>
  <!-- F7 · Banner de error (el mismo texto de hoy). Se limpia al volver a pulsar «Imprimir». -->
  <p class="nc2-err" role="alert" hidden>No se pudo generar el PDF. Intenta de nuevo.</p>"""

def sec(t, sub, cuerpo):
    return '<section class="nc2-sec"><div class="nc2-sec-c"><h3>%s</h3>%s</div>%s</section>' % (t, '<span>%s</span>' % sub if sub else '', cuerpo)

def par(r, v, u=''):
    return '<div><dt>%s</dt><dd>%s%s</dd></div>' % (r, v, ' <span>%s</span>' % u if u else '')

def med(n, p):
    return '<li><b>%s</b><span>%s</span></li>' % (n, p)

NOTA = """<!-- F4 · Cuerpo de la nota (el contenido de CuerpoNota), con jerarquía (CALMA §12): diagnósticos 17/700 con su CIE-10 en etiqueta tonal; signos vitales, próxima cita y consultorio
       como pares rótulo/valor (rótulos de hoy: TA, FC, FR, Temp., SpO₂, «Próxima cita», «Atendido en»); secciones con título de color y el subtítulo que hoy da SUBTITULO_SECCION;
       cuerpo justificado con partición silábica (lang="es"); medicamentos como lista; bloque del médico. No hay «editar» ni «borrar»: la nota está sellada. -->
  <article class="nc2-nota" lang="es" aria-label="Nota de consulta, sellada">
    <ul class="nc2-dx" aria-label="Diagnósticos">
      <li><span>Lumbago no especificado</span> <span class="nc2-cod">M54.5</span></li>
      <li><span>Otros trastornos especificados de los músculos</span> <span class="nc2-cod">M62.8</span></li>
    </ul>
    <div class="nc2-datos">
      <p class="nc2-rot">Signos vitales</p>
      <dl class="nc2-pares nc2-vit">""" + par('TA', '120/80', 'mmHg') + par('FC', '72', 'lpm') + par('FR', '16', 'rpm') + par('Temp.', '36.5', '°C') + par('SpO₂', '98', '%') + """</dl>
      <dl class="nc2-pares">""" + par('Próxima cita', 'en 15 días') + par('Atendido en', 'Centro') + """</dl>
    </div>
    """ + sec('Subjetivo', 'Motivo y síntomas', '<p>Dolor lumbar de una semana de evolución, de inicio posterior a esfuerzo al cargar peso. Sin irradiación a miembros inferiores. Mejora parcialmente con el reposo.</p>') + """
    """ + sec('Objetivo', 'Exploración física', '<p>Marcha conservada. Contractura paravertebral lumbar bilateral, dolorosa a la palpación. Arcos de movilidad limitados por dolor en flexión.</p><p>Fuerza y sensibilidad conservadas en miembros inferiores. Reflejos osteotendinosos normales. Lasègue negativo derecho.</p>') + """
    """ + sec('Auxiliares diagnósticos', 'Estudios', '<p>No se solicitaron.</p>') + """
    """ + sec('Análisis', 'Impresión dx', '<p>Cuadro de características mecánicas, sin datos de compromiso neurológico. Contractura muscular paravertebral asociada.</p>') + """
    """ + sec('Diagnóstico', '', '<p>Lumbago mecánico agudo.</p>') + """
    """ + sec('Plan', 'Tratamiento', '<ul class="nc2-items"><li>Reposo relativo por 3 días; evitar cargar peso.</li><li>Calor local 15 minutos, tres veces al día.</li><li>Ejercicios de estiramiento lumbar al ceder el dolor.</li></ul>'
              '<p class="nc2-st">Farmacológico:</p><ul class="nc2-meds">' + med('Paracetamol 500 mg', '1 tableta cada 8 horas por 5 días.') + med('Naproxeno 250 mg', '1 tableta cada 12 horas por 5 días, con alimentos.') + med('Metocarbamol 500 mg', '1 tableta cada 8 horas por 5 días.') + '</ul>') + """
    """ + sec('Pronóstico', 'Evolución esperada', '<p>Bueno para la vida y la función.</p>') + """
    <footer class="nc2-firma">
      <b>Dr. Admin Semilla</b>
      <span>Traumatología y Ortopedia</span>
      <span class="nc2-num">Cédula Prof. 00000001</span>
    </footer>
  </article>"""

def acl_item(quien, cuando, texto):
    return ('<li class="nc2-ad"><div class="nc2-ad-c"><p class="nc2-ad-m"><b>%s</b><span class="nc2-num">%s</span></p>'
            '<span class="nc2-etq nc2-etq-ok nc2-etq-s">%sSellado</span></div><p class="nc2-ad-t">%s</p></li>') % (quien, cuando, ic(I['candado'], 12, 2.2), texto)

ACL = """<!-- F5 · Notas aclaratorias ya guardadas: firmante y fecha (dd/MM/yyyy HH:mm, como hoy), la etiqueta «Sellado» de hoy (ahora verde suave con candado) y el texto justificado; orden cronológico ascendente.
       F6 · «Agregar nota aclaratoria (addendum)» (rótulo de hoy) como botón tonal pequeño junto al título; abre la hoja / el modal.
       Sin aclaratorias, hoy no se pinta el título: quedaría solo el botón. -->
  <section class="nc2-acl" aria-label="Notas aclaratorias">
    <div class="nc2-acl-cab"><h2>Notas aclaratorias<span class="nc2-cnt">1</span></h2><button type="button" class="nc2-p nc2-ton nc2-abre">""" + ic(I['plus'], 16, 2.2) + """Agregar nota aclaratoria (addendum)</button></div>
    <ol class="nc2-seq" lang="es">
      """ + acl_item('Dr. Admin Semilla', '18/11/2026 09:14', 'En la exploración física debe decir «Lasègue negativo bilateral». El resto de la nota no cambia y se mantiene el plan de tratamiento indicado en la consulta.') + """
    </ol>
  </section>"""

NF = """<!-- F7 · «Consulta no encontrada»: hoy es solo ese texto, sin cabecera ni salida. «Cargando...» es un estado de sistema (el mismo texto centrado); no se dibuja. -->
  <p class="nc2-nf">Consulta no encontrada</p>"""

CAPA = """<!-- F6 · Nueva nota aclaratoria (CALMA §13): hoja desde abajo en teléfono; en Duo abierto y computadora, modal CENTRADO en el área de contenido. Velo desenfocado, uno solo.
     Dos botones de verdad: «Cancelar» (quieto) y «Guardar addendum» (relleno). Textos de hoy.
     Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir; en la app será un resorte
     (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<div class="nc2-capa" aria-hidden="true">
  <div class="nc2-velo"></div>
  <div class="nc2-area">
  <form class="nc2-hoja" role="dialog" aria-modal="true" aria-label="Nueva nota aclaratoria" novalidate>
    <span class="nc2-asa" aria-hidden="true"></span>
    <h2>Nueva nota aclaratoria</h2>
    <p class="nc2-aviso" lang="es">Este addendum se adjuntará a la nota original y no podrá modificarse una vez guardado.</p>
    <textarea class="nc2-ta" aria-label="Nueva nota aclaratoria" placeholder="Escriba la aclaración, corrección o nota adicional..."></textarea>
    <p class="nc2-ferr" role="alert" hidden>El addendum no puede estar vacío</p>
    <div class="nc2-acc">
      <button type="button" class="nc2-p nc2-bot nc2-quieto nc2-cierra">Cancelar</button>
      <button type="submit" class="nc2-p nc2-bot nc2-prim nc2-guarda" aria-disabled="false">Guardar addendum</button>
    </div>
  </form>
  </div>
</div>"""

def marco(vp):
    col = '<div class="nc2-col"><main class="nc2-cont">\n<div class="nc2-pag">\n  ' + TOP + '\n  ' + NOTA + '\n  ' + ACL + '\n</div>\n  ' + NF + '\n</main></div>'
    nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'iv': fundido, 'esc': lateral}[vp]()
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    return '<div class="marco nc2" data-vp="%s">\n<div class="nc2-app">\n%s\n</div>\n%s\n</div>\n' % (vp, app, CAPA)

import importlib.util as _u
_sp = _u.spec_from_file_location('u4iv', '/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/tools/tmp-u4-iv.py'); _m = _u.module_from_spec(_sp); _sp.loader.exec_module(_m)
# Tercera revisión: el estilo de ih se extiende a iv en la misma regla; lo propio de la tercera revisión, en tmp-nc3-estilo3.css
css = _m.con_iv(open(os.path.join(L, 'tmp-nc3-estilo.css')).read().replace('/*NAV*/', open(os.path.join(L, 'tmp-nc2-nav.css')).read()) + open(os.path.join(L, 'tmp-nc3-estilo3.css')).read())
js = open(os.path.join(L, 'tmp-nc3-guion.js')).read()
out = ('<!-- NOMBRE: Nota de consulta | La nota se lee como un documento con jerarquía: diagnósticos destacados con su CIE-10, signos vitales rotulados, secciones con título de color y texto justificado; «Nota manual/IA» y «Nota sellada» vuelven como etiquetas de color con icono, «Imprimir» es un botón tonal con impresora y cada nota aclaratoria lleva su «Sellado» -->\n'
       '<style>\n' + css + '</style>\n' + ''.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '<script>\n' + js + '</script>\n')
open(os.path.join(L, 'vista-consulta.html'), 'w').write(out)
print(len(out))
