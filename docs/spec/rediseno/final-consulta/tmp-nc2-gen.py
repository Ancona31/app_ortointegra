# Genera vista-consulta.html (Nota de consulta, reglas de CALMA). Uso: python3 tmp-nc2-gen.py
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

# ---------- A0 · Navegación: copiada del referente aprobado (activo = Pacientes) ----------
def riel():
    def b(k, t, act=False):
        return '<a href="#" class="nc2-p nc2-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="nc2-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Pacientes y expedientes', True) + b('agenda', 'Agenda') + b('docs', 'Documentos')
            + '<a href="#" class="nc2-p nc2-rb" aria-label="Más">' + ic(I['mas'], 22, 3) + '</a><span class="nc2-flex"></span>'
            '<button type="button" class="nc2-p nc2-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lateral():
    def a(k, t, act=False):
        return '<a href="#" class="nc2-p nc2-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    return ('<nav class="nc2-lat" aria-label="Navegación principal"><div class="nc2-lat-cab"><span class="nc2-logo">' + ic(I['logo'], 24) + '<span class="nc2-logo-n">Spinus</span></span><span class="nc2-plan">Plan VIP</span></div>'
            '<button type="button" class="nc2-p nc2-cons-b"><span class="nc2-av">AS</span><span class="nc2-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="nc2-lista">' + a('inicio', 'Inicio') + a('pac', 'Pacientes', True) + a('agenda', 'Agenda') + a('docs', 'Documentos') + a('admin', 'Administración') + '</div><span class="nc2-flex"></span>'
            '<div class="nc2-lat-pie"><a href="#" class="nc2-p nc2-li nc2-yo">' + ic(I['perfil'], 20) + '<span>Dr. Admin Semilla<small>Mi perfil · Ajustes</small></span></a></div></nav>')

def encabezado():
    return ('<header class="nc2-enc"><button type="button" class="nc2-p nc2-menu-b" aria-label="Menú">' + ic(I['menu'], 22, 2) + '</button><span class="nc2-enc-t">Pacientes</span><span class="nc2-flex"></span>'
            '<button type="button" class="nc2-p nc2-av nc2-av-g" aria-label="Mi perfil">AS</button></header>')

TOP = '''<!-- F1 · Volver al expediente (la flecha lleva el nombre del paciente), título y fecha · consultorio. Hoy no se muestra la hora: aquí tampoco.
     F2 · Origen («Nota manual» / «Nota IA») y estado («Nota sellada») como texto secundario, sin chips.
     F3 · «Imprimir» es una acción de TEXTO: «Imprimir» → «Generando...» → se sustituye por el enlace «Abrir PDF» (en la app, <a href=blob:> que abre el visor). -->
  <header class="nc2-top">
    <div class="nc2-top-f">
      <a href="#" class="nc2-p nc2-volver" aria-label="Volver al expediente de Paciente Prueba 01">''' + ic(I['volver'], 16, 2.4) + '''Paciente Prueba 01</a>
      <span class="nc2-flex"></span>
      <button type="button" class="nc2-p nc2-txt nc2-imp" data-est="listo" aria-disabled="false"><span class="nc2-giro" aria-hidden="true" hidden></span><span class="nc2-imp-t" aria-live="polite">Imprimir</span></button>
      <a href="#" class="nc2-p nc2-txt nc2-pdf" hidden>Abrir PDF</a>
    </div>
    <h1>Nota de Consulta</h1>
    <p class="nc2-sub"><span class="nc2-num">17 de noviembre de 2026 · Centro</span><span><span class="nc2-o-man">Nota manual</span><span class="nc2-o-ia">Nota IA</span> · Nota sellada</span></p>
  </header>
  <!-- F7 · Banner de error (el mismo texto de hoy). Se limpia al volver a pulsar «Imprimir». -->
  <p class="nc2-err" role="alert" hidden>No se pudo generar el PDF. Intenta de nuevo.</p>'''

def sec(t, cuerpo):
    return '<section class="nc2-sec"><h3>%s</h3>%s</section>' % (t, cuerpo)

NOTA = '''<!-- F4 · Cuerpo de la nota (el contenido de CuerpoNota): diagnósticos, signos vitales, próxima cita, las secciones que traiga el texto y el bloque del médico.
       Una sola superficie de lectura; sin numeración, sin cajas, una única línea (antes de la firma). No hay «editar» ni «borrar»: la nota está sellada. -->
  <article class="nc2-nota" aria-label="Nota de consulta, sellada">
    <ul class="nc2-dx" aria-label="Diagnósticos">
      <li>Lumbago no especificado<span class="nc2-cod">M54.5</span></li>
      <li>Otros trastornos especificados de los músculos<span class="nc2-cod">M62.8</span></li>
    </ul>
    <dl class="nc2-pares">
      <div><dt>Signos vitales</dt><dd aria-label="Tensión arterial 120/80 milímetros de mercurio, frecuencia cardiaca 72, frecuencia respiratoria 16, temperatura 36.5 grados, saturación 98 por ciento"><span class="nc2-nw">120/80 mmHg</span> <span class="nc2-pt">·</span> <span class="nc2-nw">72 lpm</span> <span class="nc2-pt">·</span> <span class="nc2-nw">16 rpm</span> <span class="nc2-pt">·</span> <span class="nc2-nw">36.5 °C</span> <span class="nc2-pt">·</span> <span class="nc2-nw">98 %</span></dd></div>
      <div><dt>Próxima cita</dt><dd>en 15 días</dd></div>
    </dl>
    ''' + sec('Subjetivo', '<p>Dolor lumbar de una semana de evolución, de inicio posterior a esfuerzo al cargar peso. Sin irradiación a miembros inferiores. Mejora parcialmente con el reposo.</p>') + '''
    ''' + sec('Objetivo', '<p>Marcha conservada. Contractura paravertebral lumbar bilateral, dolorosa a la palpación. Arcos de movilidad limitados por dolor en flexión.</p><p>Fuerza y sensibilidad conservadas en miembros inferiores. Reflejos osteotendinosos normales. Lasègue negativo derecho.</p>') + '''
    ''' + sec('Auxiliares diagnósticos', '<p>No se solicitaron.</p>') + '''
    ''' + sec('Análisis', '<p>Cuadro de características mecánicas, sin datos de compromiso neurológico. Contractura muscular paravertebral asociada.</p>') + '''
    ''' + sec('Diagnóstico', '<p>Lumbago mecánico agudo.</p>') + '''
    ''' + sec('Plan', '<ul><li>Reposo relativo por 3 días; evitar cargar peso.</li><li>Calor local 15 minutos, tres veces al día.</li><li>Ejercicios de estiramiento lumbar al ceder el dolor.</li></ul>'
              '<p class="nc2-st">Farmacológico:</p><ul><li>Paracetamol 500 mg, 1 tableta cada 8 horas por 5 días.</li><li>Naproxeno 250 mg, 1 tableta cada 12 horas por 5 días, con alimentos.</li><li>Metocarbamol 500 mg, 1 tableta cada 8 horas por 5 días.</li></ul>') + '''
    ''' + sec('Pronóstico', '<p>Bueno para la vida y la función.</p>') + '''
    <footer class="nc2-firma">
      <b>Dr. Admin Semilla</b>
      <span>Traumatología y Ortopedia</span>
      <span class="nc2-num">Cédula Prof. 00000001</span>
    </footer>
  </article>'''

ACL = '''<!-- F5 · Notas aclaratorias ya guardadas: secuencia fechada (firmante · dd/MM/yyyy HH:mm, como hoy), en orden cronológico ascendente. Tampoco se editan.
       F6 · «Agregar nota aclaratoria (addendum)» (rótulo de hoy) como acción de texto junto al título; abre la hoja / el modal.
       Sin aclaratorias, hoy no se pinta el título: quedaría solo la acción de texto. -->
  <section class="nc2-acl" aria-label="Notas aclaratorias">
    <div class="nc2-acl-cab"><h2>Notas aclaratorias<span class="nc2-cnt">1</span></h2><button type="button" class="nc2-p nc2-txt nc2-abre">Agregar nota aclaratoria (addendum)</button></div>
    <ol class="nc2-seq">
      <li class="nc2-ad"><p class="nc2-ad-m">Dr. Admin Semilla · 18/11/2026 09:14</p><p class="nc2-ad-t">En la exploración física debe decir «Lasègue negativo bilateral». El resto de la nota no cambia.</p></li>
    </ol>
  </section>'''

NF = '''<!-- F7 · «Consulta no encontrada»: hoy es solo ese texto, sin cabecera ni salida. «Cargando...» es un estado de sistema (el mismo texto centrado); no se dibuja. -->
  <p class="nc2-nf">Consulta no encontrada</p>'''

CAPA = '''<!-- F6 · Nueva nota aclaratoria: hoja en teléfono, modal en Duo abierto y computadora. Textos de hoy. El relleno de acción solo existe aquí dentro.
     Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir; en la app será un resorte
     (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<div class="nc2-capa" aria-hidden="true">
  <div class="nc2-velo"></div>
  <form class="nc2-hoja" role="dialog" aria-modal="true" aria-label="Nueva nota aclaratoria" novalidate>
    <span class="nc2-asa" aria-hidden="true"></span>
    <h2>Nueva nota aclaratoria</h2>
    <p class="nc2-aviso">Este addendum se adjuntará a la nota original y no podrá modificarse una vez guardado.</p>
    <textarea class="nc2-ta" aria-label="Nueva nota aclaratoria" placeholder="Escriba la aclaración, corrección o nota adicional..."></textarea>
    <p class="nc2-ferr" role="alert" hidden>El addendum no puede estar vacío</p>
    <div class="nc2-acc">
      <button type="button" class="nc2-p nc2-txt nc2-cierra">Cancelar</button>
      <button type="submit" class="nc2-p nc2-prim nc2-guarda" aria-disabled="false">Guardar addendum</button>
    </div>
  </form>
</div>'''

def marco(vp):
    col = '<div class="nc2-col"><main class="nc2-cont">\n<div class="nc2-pag">\n  ' + TOP + '\n  ' + NOTA + '\n  ' + ACL + '\n</div>\n  ' + NF + '\n</main></div>'
    nav = {'ext': riel, 'tel': encabezado, 'ih': lateral, 'esc': lateral}[vp]()
    app = (nav + '\n' + col) if vp in ('tel', 'esc') else (col + '\n' + nav)
    return '<div class="marco nc2" data-vp="%s">\n<div class="nc2-app">\n%s\n</div>\n%s\n</div>\n' % (vp, app, CAPA)

css = open(os.path.join(L, 'tmp-nc2-estilo.css')).read().replace('/*NAV*/', open(os.path.join(L, 'tmp-nc2-nav.css')).read())
js = open(os.path.join(L, 'tmp-nc2-guion.js')).read()
out = ('<!-- NOMBRE: Nota de consulta | La nota se lee como un documento limpio: una sola superficie de texto con aire, «Imprimir» como acción de texto en la cabecera y las notas aclaratorias debajo, fechadas y firmadas; sin chips, sin numeración y sin botones rellenos -->\n'
       '<style>\n' + css + '</style>\n' + ''.join(marco(v) for v in ('ext', 'tel', 'ih', 'esc')) + '<script>\n' + js + '</script>\n')
open(os.path.join(L, 'vista-consulta.html'), 'w').write(out)
print(len(out))
