# Generador de las tres vistas de lectura (estadísticas, ayuda, suplementación). Uso: python3 tmp-le-gen.py
import os, html
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8, extra=''):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}>{d}</svg>'

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
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    nuevo='<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    refrescar='<path d="M20 11a8 8 0 0 0-14.3-4.2L4 9"/><path d="M4 4.5V9h4.5M4 13a8 8 0 0 0 14.3 4.2L20 15"/><path d="M20 19.500V15h-4.5"/>',
    alerta='<path d="M12 4 2.8 19.5h18.400z"/><path d="M12 10v4.500M12 17.200h.010"/>',
    sindatos='<path d="M4 20V5M4 20h16"/><path d="M8 16v-3M12 16v-6M16 16v-2" stroke-dasharray="2 2.6"/>',
    correo='<rect x="3" y="5.500" width="18" height="13.500" rx="2.500"/><path d="m3.500 7.500 8.500 6 8.500-6"/>',
    externo='<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    repetir='<path d="M4 12a8 8 0 1 0 2.600-5.900L4 8.500"/><path d="M4 4v4.500h4.500"/>',
    receta='<rect x="2.500" y="8.200" width="19" height="7.600" rx="3.800" transform="rotate(-45 12 12)"/><path d="m9 9 6 6"/>',
    nota='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m12 11 .900 2.100L15 14l-2.100.900L12 17l-.900-2.100L9 14l2.100-.900z"/>',
    lateral='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    tendencia='<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    esteto='<path d="M5 3H4v6a5 5 0 0 0 10 0V3h-1"/><path d="M9 14v1a6 6 0 0 0 11 0v-3"/><circle cx="20" cy="10" r="2"/>',
    p_alta='<path d="m6 11 6-6 6 6M6 18l6-6 6 6"/>',
    p_media='<path d="m6 15 6-6 6 6"/>',
    p_baja='<path d="M12 6v12M6 12h12"/>',
    monitor='<rect x="3" y="4.500" width="18" height="12" rx="2"/><path d="M8.500 20h7M12 16.500V20M9 10.500l2 2 4-4"/>',
)

AVISO = '<!-- Capas globales no dibujadas aquí porque no cambian en esta pantalla (se definen en el dashboard de referencia): hoja «Nueva consulta» del «+», menú «Más», selector de consultorio, avisos emergentes arriba y centrados. -->'

def riel(P, act):
    def b(k, t, w=1.8):
        a = ' aria-current="page"' if act == k else ''
        return f'<a href="#" class="{P}-p {P}-rb" aria-label="{t}"{a}>{ic(I[k], 22, 3 if k == "mas" else 1.8)}</a>'
    return f'''<!-- Navegación (A0·3): riel a la derecha, fundido con la franja del sistema. Copiado del dashboard de referencia. -->
<nav class="{P}-riel" aria-label="Navegación principal">
  {b("inicio","Inicio")}{b("pac","Expediente")}{b("agenda","Agenda")}{b("docs","Documentos")}{b("mas","Más")}
  <span class="{P}-flex"></span>
  <button type="button" class="{P}-p {P}-mas" aria-label="Nueva consulta">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lateral(P, act):
    def a(k, t):
        c = ' aria-current="page"' if act == k else ''
        return f'<a href="#" class="{P}-p {P}-li"{c}>{ic(I[k], 20)}{t}</a>'
    return f'''<!-- Navegación (A0·3): barra lateral. Copiada del dashboard de referencia. -->
<nav class="{P}-lat" aria-label="Navegación principal">
  <div class="{P}-lat-cab"><span class="{P}-logo">{ic(I["logo"], 24, 1.8)}<span class="{P}-logo-n">Spinus</span></span><span class="{P}-plan">Plan VIP</span></div>
  <button type="button" class="{P}-p {P}-cons-b"><span class="{P}-av">AS</span><span class="{P}-cons-t"><span>Consultorio</span><b>Centro</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="{P}-lista">{a("inicio","Inicio")}{a("pac","Expediente")}{a("agenda","Agenda")}{a("docs","Documentos")}{a("admin","Administración")}</div>
  <span class="{P}-flex"></span>
  <div class="{P}-lat-pie"><a href="#" class="{P}-p {P}-li {P}-yo">{ic(I["perfil"], 20)}<span>Dr. Admin Semilla<small>Mi perfil · Ajustes</small></span></a></div>
</nav>'''

def encabezado(P, tit):
    return f'''<!-- Navegación (A0·13): encabezado fundido con la barra de estado. Copiado del dashboard de referencia. -->
<header class="{P}-enc">
  <button type="button" class="{P}-p {P}-menu" aria-label="Menú">{ic(I["menu"], 22, 2)}</button>
  <span class="{P}-enc-t">{tit}</span>
  <span class="{P}-flex"></span>
  <button type="button" class="{P}-p {P}-av {P}-av-g" aria-label="Mi perfil">AS</button>
</header>'''

def vertical(P, act):
    def a(k, t):
        c = ' aria-current="page"' if act == k else ''
        return f'<a href="#" class="{P}-p {P}-pil"{c}>{t}</a>'
    return f'''<!-- Navegación de Duo abierto vertical (CALMA §19): encabezado fundido con la barra de estado. Administración, Mi perfil y Ayuda se alcanzan desde «Mostrar barra lateral» o desde el avatar. -->
<header class="{P}-ivn">
  <button type="button" class="{P}-p {P}-ivb" aria-label="Mostrar barra lateral">{ic(I["lateral"], 20)}</button>
  <!-- CALMA §23.9: quinta píldora «Más»; abre el mismo menú que el «···» del riel de Duo cerrado (menú no dibujado aquí). Marcada en Estadísticas y Centro de ayuda. -->
  <nav class="{P}-pista" aria-label="Secciones">{a("inicio","Inicio")}{a("pac","Expediente")}{a("agenda","Agenda")}{a("docs","Documentos")}{a("mas","Más")}</nav>
  <button type="button" class="{P}-p {P}-av {P}-av-g" aria-label="Mi perfil">AS</button>
</header>'''

def marco(P, vp, cuerpo, act_riel, act_lat, tit_enc):
    main = f'<main class="{P}-cont"><div class="{P}-in">\n{cuerpo}\n</div></main>'
    if vp == 'ext':
        app = main + riel(P, act_riel)
    elif vp == 'tel':
        app = encabezado(P, tit_enc) + main
    elif vp == 'ih':
        app = main + lateral(P, act_lat)
    elif vp == 'iv':
        app = vertical(P, act_riel) + main
    else:
        app = lateral(P, act_lat) + main
    return f'<div class="marco {P}" data-vp="{vp}">\n<div class="{P}-app">\n{app}\n</div>\n{AVISO}\n</div>'

def escribe(n, P, nombre, frase, css, cuerpo_fn, js, act_riel, act_lat, tit_enc):
    base = open(f'{L}/tmp-le-base.css').read().replace('PFX', P)
    out = (f'<!-- NOMBRE: {nombre} | {frase} -->\n<style>\n{base}\n{css}</style>\n'
           + '\n'.join(marco(P, v, cuerpo_fn(v), act_riel, act_lat, tit_enc) for v in ('ext', 'tel', 'ih', 'iv', 'esc'))
           + f'\n<script>\n{js}</script>\n')
    open(f'{L}/vista-{n}.html', 'w').write(out)
    print(n, len(out))

# =====================================================================================================
# 1 · ESTADÍSTICAS
# =====================================================================================================
MESES = ['jun', 'jul', 'ago', 'sep', 'oct', 'nov']
MESL = ['junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre']

def linea(vals, ticks):
    top = ticks[-1]
    n = len(vals)
    xs = [(i + .5) / n * 100 for i in range(n)]
    ys = [100 - v / top * 100 for v in vals]
    d = f'M{xs[0]:.2f},{ys[0]:.2f}'
    for i in range(1, n):
        mx = (xs[i - 1] + xs[i]) / 2
        d += f' C{mx:.2f},{ys[i-1]:.2f} {mx:.2f},{ys[i]:.2f} {xs[i]:.2f},{ys[i]:.2f}'
    area = d + f' L{xs[-1]:.2f},100 L{xs[0]:.2f},100 Z'
    gr = ''.join(f'<line class="es-gr{" es-gr0" if t == 0 else ""}" x1="0" x2="100" y1="{100 - t / top * 100:.2f}" y2="{100 - t / top * 100:.2f}"/>' for t in ticks)
    ey = ''.join(f'<span class="es-y" style="top:{100 - t / top * 100:.2f}%">{t}</span>' for t in ticks)
    pts = ''
    for i in range(n):
        u = ' es-ult' if i == n - 1 else ''
        pts += f'<span class="es-pt{u}" style="left:{xs[i]:.2f}%;top:{ys[i]:.2f}%"></span><span class="es-v{u}" style="left:{xs[i]:.2f}%;top:{ys[i]:.2f}%">{vals[i]}</span>'
    ex = ''.join(f'<span{" class=es-ult" if i == n - 1 else ""}>{m}</span>' for i, m in enumerate(MESES))
    desc = 'Consultas por mes: ' + ', '.join(f'{MESL[i]} {vals[i]}' for i in range(n))
    return f'''<!-- Gráfica de línea dibujada a mano: el SVG solo lleva geometría (se estira sin deformar el trazo) y los rótulos son texto real, así nunca bajan de 11 px.
           Cada punto lleva su valor a la vista: sustituye al cuadro que hoy solo aparece al pasar el ratón. -->
      <div class="es-plot" role="img" aria-label="{desc}">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{gr}<path class="es-area" d="{area}"/><path class="es-lin" d="{d}"/></svg>
        {ey}{pts}
      </div>
      <div class="es-x" aria-hidden="true">{ex}</div>'''

def rank(datos, unidad):
    mx = max(v for _, v in datos)
    its = ''.join(f'''<li class="es-rk"><span class="es-rk-n">{html.escape(n)}</span><span class="es-rk-v">{v}</span><svg aria-hidden="true" width="100%" height="8"><rect class="es-bt" width="100%" height="8" rx="4"/><rect class="es-bv" width="{v / mx * 100:.1f}%" height="8" rx="4"/></svg></li>''' for n, v in datos)
    return f'<ol class="es-rank" aria-label="De mayor a menor, en {unidad}">{its}</ol>'

def dona(datos):
    tot = sum(v for _, v in datos)
    C = 2 * 3.14159265 * 50
    acc = 0
    seg = ''
    for i, (n, v) in enumerate(datos):
        ln = v / tot * C
        g = 3 if len([1 for _, x in datos if x]) > 1 else 0
        if v:
            seg += f'<circle class="es-s{i+1}" cx="66" cy="66" r="50" stroke-dasharray="{max(ln - g, 1):.2f} {C - max(ln - g, 1):.2f}" stroke-dashoffset="{-acc:.2f}"/>'
        acc += ln
    ley = ''.join(f'<li><span class="es-pto es-p{i+1}"></span><span class="es-ley-n">{n}</span><span class="es-ley-v">{v} · {round(v / tot * 100)}%</span></li>' for i, (n, v) in enumerate(datos))
    return f'''<div class="es-sexo">
        <svg class="es-dona" width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="{tot} pacientes en total"><g transform="rotate(-90 66 66)" fill="none" stroke-width="16">{seg}</g><text class="es-dn" x="66" y="68" text-anchor="middle">{tot}</text><text class="es-dl" x="66" y="85" text-anchor="middle">pacientes</text></svg>
        <ul class="es-ley">{ley}</ul>
      </div>'''

def edades(datos):
    mx = max(v for _, v in datos) or 1
    cols = ''.join(f'<li><span class="es-cv">{v}</span><svg aria-hidden="true" width="100%" height="{max(round(v / mx * 104), 2)}"><rect class="es-bv" width="100%" height="{max(round(v / mx * 104), 2) + 8}" rx="6"/></svg></li>' for _, v in datos)
    labs = ''.join(f'<span>{r}</span>' for r, _ in datos)
    desc = 'Pacientes por grupo de edad: ' + ', '.join(f'{r} años {v}' for r, v in datos)
    return f'''<div class="es-edad" role="img" aria-label="{desc}"><ol class="es-cols">{cols}</ol><div class="es-cx" aria-hidden="true">{labs}</div></div>'''

VACIO = f'<p class="es-vacio">{ic(I["sindatos"], 28, 1.8)}Sin datos suficientes aún</p>'

def tar(ico, tit, sub, cuerpo, ancha=False, dato=''):
    # Título de tarjeta 17/700 con el icono de la app (20 px, color de acción, sin cuadro de fondo)
    sb = f'<p class="es-sub2">{sub}</p>' if sub else ''
    return f'''<section class="es-tar{" es-ancha" if ancha else ""}" aria-label="{tit}">
      <div class="es-tcab"><span class="es-ti">{ic(I[ico], 20)}</span><div class="es-th"><h2>{tit}</h2>{sb}</div>{dato}</div>
      {cuerpo}
    </section>'''

DX = [('Lumbago', 42), ('Gonalgia', 35), ('Cervicalgia', 28), ('Esguince de tobillo', 24), ('Síndrome del manguito rotador', 19),
      ('Fascitis plantar', 15), ('Tendinitis rotuliana', 12), ('Epicondilitis lateral', 9), ('Fractura de radio distal', 6), ('Hallux valgus', 4)]
RX = [('Paracetamol 500 mg', 31), ('Ibuprofeno 400 mg', 27), ('Naproxeno 250 mg', 22), ('Celecoxib 200 mg', 18), ('Diclofenaco gel 1%', 16),
      ('Meloxicam 15 mg', 13), ('Tramadol / paracetamol', 9), ('Pregabalina 75 mg', 7), ('Complejo B', 5), ('Omeprazol 20 mg', 4)]
SX = [('Femenino', 71), ('Masculino', 52), ('Sin especificar', 3)]
ED = [('0–17', 8), ('18–29', 19), ('30–44', 34), ('45–59', 38), ('60–74', 21), ('75+', 6)]

def rejilla(cl, cons, ticks, dx, rx, sx, ed):
    tot = sum(v for _, v in sx)
    dato = f'<p class="es-dato"><b>{cons[-1]}</b><span>en noviembre</span></p>'
    return f'''<div class="es-grid {cl}">
    <!-- A17·2: consultas por mes, últimos 6 meses -->
    {tar("tendencia", "Consultas por mes", "Últimos 6 meses", linea(cons, ticks), True, dato)}
    <!-- Los títulos de tarjeta son los de hoy; los de «Consultas por mes — últimos 6 meses» y «Distribución por sexo — N pacientes» se parten en título + línea secundaria, sin cambiar el texto. -->
    <!-- A17·3: top 10 diagnósticos. Barras horizontales de alto fijo (8 px): con un solo diagnóstico se ve una fila, no un bloque gigante. -->
    {tar("esteto", "Top 10 diagnósticos", "", rank(dx, "consultas") if dx else VACIO)}
    <!-- A17·4: top 10 medicamentos recetados -->
    {tar("receta", "Top 10 medicamentos recetados", "", rank(rx, "recetas") if rx else VACIO)}
    <!-- A17·5: distribución por sexo, con el total de pacientes -->
    {tar("pac", "Distribución por sexo", f"{tot} pacientes", dona(sx))}
    <!-- A17·6: distribución por grupo de edad -->
    {tar("pac", "Distribución por grupo de edad", "", edades(ed))}
  </div>'''

def es_cuerpo(vp):
    return f'''<!-- A17·8: la secretaria no ve esta pantalla; al entrar se le redirige a /dashboard (sin cambio). -->
  <!-- Pestañas de Administración, bajo el encabezado y sobre el título -->
  <nav class="es-tabs" aria-label="Administración">
    <a href="#" class="es-p es-tab" aria-current="page" data-t="Estadísticas">Estadísticas</a>
    <a href="#" class="es-p es-tab" data-t="Usuarios">Usuarios</a>
    <a href="#" class="es-p es-tab" data-t="Facturación">Facturación</a>
  </nav>
  <header class="es-cab es-cab-a">
    <h1>Estadísticas clínicas</h1>
    <!-- Hoy es el rótulo «Clínica» sobre el título; se conserva el texto tal cual como línea secundaria. -->
    <p class="es-sub">Clínica</p>
    <!-- A17·1: «Actualizar». Botón tonal (esta pantalla no tiene acción primaria). Mientras recarga: deshabilitado y con el icono girando, como hoy (el texto no cambia). -->
    <button type="button" class="es-p es-ton es-act">{ic(I["refrescar"], 18, 2)}<span class="es-act-t">Actualizar</span></button>
  </header>
  <!-- A17·7 (estado de sistema, no dibujado): durante la primera carga se muestra el esqueleto: cinco tarjetas con el mismo contorno que las de abajo, en gris --sup2. -->
  {rejilla("es-d1", [22, 27, 24, 31, 35, 38], [0, 10, 20, 30, 40], DX, RX, SX, ED)}
  <!-- A17·7: «Sin datos suficientes aún» por bloque, y cómo se ve la clínica recién abierta (un diagnóstico, 3 consultas) -->
  {rejilla("es-d2", [0, 0, 0, 1, 1, 1], [0, 1, 2, 3, 4], [('Lumbago no especificado', 3)], [], [('Femenino', 14), ('Masculino', 12), ('Sin especificar', 0)], [('0–17', 1), ('18–29', 4), ('30–44', 9), ('45–59', 7), ('60–74', 4), ('75+', 1)])}
  <!-- A17·7: error de carga. Texto exacto de hoy. -->
  <section class="es-tar es-err es-d3" role="alert">
    <span class="es-err-i">{ic(I["alerta"], 24, 2)}</span>
    <p class="es-err-t">Error cargando estadísticas.</p>
    <!-- A17·7: «Reintentar», aprobado por el dueño (CALMA §23.12). Recarga como «Actualizar». -->
    <button type="button" class="es-p es-ton es-reint">{ic(I["refrescar"], 18, 2)}Reintentar</button>
  </section>'''

ES_CSS = open(f'{L}/tmp-le-es.css').read()
ES_JS = '''(function(){
  var ms=document.querySelectorAll('.es.marco');if(!ms.length)return;
  // Controles de maqueta: UNA tira fuera del marco, en la cabecera de la sección (CALMA §7); controla los cinco marcos.
  var tira=document.createElement('div');tira.className='es-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  tira.innerHTML='<button type="button" class="es-demo-poco" aria-pressed="false">Maqueta: pocos datos</button><button type="button" class="es-demo-err" aria-pressed="false">Maqueta: error</button>';
  var op=ms[0].closest('.op');if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else ms[0].parentNode.insertBefore(tira,ms[0]);
  var bp=tira.querySelector('.es-demo-poco'),be=tira.querySelector('.es-demo-err');
  function pon(k){ms.forEach(function(m){m.classList.toggle('es-v-poco',k==='poco');m.classList.toggle('es-v-err',k==='err')});
    bp.setAttribute('aria-pressed',String(k==='poco'));be.setAttribute('aria-pressed',String(k==='err'))}
  bp.addEventListener('click',function(){pon(ms[0].classList.contains('es-v-poco')?'':'poco')});
  be.addEventListener('click',function(){pon(ms[0].classList.contains('es-v-err')?'':'err')});
  ms.forEach(function(m){
    var act=m.querySelector('.es-act'),t=null;
    function carga(){if(t)return;act.setAttribute('aria-disabled','true');m.classList.add('es-carga');
      t=setTimeout(function(){t=null;act.setAttribute('aria-disabled','false');m.classList.remove('es-carga');
        if(m.classList.contains('es-v-err'))pon('')},700)}
    act.addEventListener('click',carga);m.querySelector('.es-reint').addEventListener('click',carga);
    m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
  });
})();
'''

# =====================================================================================================
# 2 · AYUDA  (los textos de guías, atajos, preguntas y sellos se copian tal cual de la app)
# =====================================================================================================
GUIAS = [
    ('nuevo', 'Registrar un paciente', ['Ve a Pacientes → Nuevo paciente', 'Llena nombre, teléfono y datos básicos', 'Haz clic en "Guardar" — el expediente se crea automáticamente']),
    ('nota', 'Crear una nota médica con IA', ['Abre el expediente del paciente → "Nueva nota"', 'Llena motivo de consulta y exploración física', 'Haz clic en "Generar con IA" — revisa, edita y guarda', 'Se desbloquean los documentos: receta, laboratorio, imagen, etc.']),
    ('receta', 'Generar una receta', ['Desde la nota médica guardada, haz clic en el icono de Receta', 'Agrega medicamentos con el buscador inteligente', 'Haz clic en "Imprimir Receta" — se genera el PDF con QR']),
    ('agenda', 'Agendar una cita', ['Ve a Agenda → haz clic en el horario deseado', 'Selecciona el paciente y tipo de consulta', 'Guarda — la cita aparece en tu Google Calendar automáticamente']),
    ('monitor', 'Ver estudios DICOM', ['Abre el expediente del paciente → pestaña "Imagen"', 'Arrastra tu archivo DICOM o haz clic para subirlo', 'El visor se abre directamente en el navegador — sin software externo']),
    ('correo', 'Enviar documentos por email', ['Genera cualquier documento (receta, solicitud, nota)', 'En la vista del documento, haz clic en "Enviar por email"', 'El paciente recibe el PDF adjunto en su correo']),
]
ATAJOS = [(['Ctrl', 'K'], 'Búsqueda global de pacientes'), (['Esc'], 'Cerrar modal, menú o panel abierto'),
          (['↑', '↓'], 'Navegar resultados de búsqueda'), (['Enter'], 'Abrir paciente seleccionado o confirmar acción')]
FAQS = [
    ('¿Mis datos están seguros?', 'Sí. La información viaja cifrada con TLS y la base de datos está cifrada en reposo a nivel de proveedor. Row Level Security (RLS) los separa dentro de la propia base: cada médico ve solo a sus pacientes y, en cuentas de clínica, el administrador ve los expedientes de todo su equipo. La estructura del expediente sigue la NOM-004-SSA3 y el tratamiento de datos se rige por la LFPDPPP vigente; el obligado por esas normas eres tú, y Spinus te da la estructura para cumplirlas.'),
    ('¿Cómo conecto Google Calendar?', 'Ve a Agenda y haz clic en el botón "Conectar Google Calendar". Se abrirá una ventana de Google donde autorizas el acceso. Una vez conectado, tus citas se sincronizan con tu calendario de Google.'),
    ('¿Puedo usar Spinus desde mi celular?', 'Sí. La app se adapta a cualquier pantalla y funciona en cualquier navegador — solo abre spinus.com.mx desde tu celular o tablet. No necesitas descargar nada de una tienda de apps.'),
    ('¿Cómo cambio de plan?', 'Ve a Mi perfil → Facturación → "Gestionar suscripción". Desde ahí puedes subir o bajar de plan, actualizar tu método de pago o cancelar.'),
    ('¿Qué pasa si cancelo mi suscripción?', 'Tu cuenta pasa al plan gratuito al final del periodo pagado. Conservas el acceso: puedes consultar, editar y descargar todo lo que ya tienes. Lo que se bloquea es crear pacientes, consultas y documentos nuevos.'),
    ('¿La IA reemplaza mi criterio médico?', 'No. La inteligencia artificial es una herramienta de apoyo. Genera borradores de notas y analiza laboratorios, pero tú siempre validas, editas y firmas. El juicio clínico final es tuyo.'),
    ('¿Cómo verifico una receta con QR?', 'Cada receta generada incluye un código QR único. Al escanearlo, se abre una página pública que muestra los datos de la receta para que la farmacia o el paciente puedan verificar su autenticidad.'),
    ('¿Puedo agregar asistentes médicos a mi cuenta?', 'Sí. Desde Administración → Usuarios puedes crear cuentas con rol "Asistente Médico/a". Ven la lista de pacientes y la agenda —crean, mueven y cancelan citas—, pero no acceden a notas clínicas ni a documentos médicos.'),
]
SELLOS = [('Cifrado AES-256-GCM', 'Datos cifrados en tránsito y en reposo'), ('NOM-004-SSA3', 'Expediente clínico conforme a normativa'), ('LFPDPPP', 'Protección de datos personales')]

def ay_cuerpo(vp):
    e = html.escape
    guias = ''.join(f'''<li class="ay-tar ay-guia">
        <h3><span class="ay-gi">{ic(I[k], 20)}</span>{e(t)}</h3>
        <ol class="ay-pasos">{"".join(f'<li><span class="ay-n" aria-hidden="true">{i+1}</span><span>{e(s)}</span></li>' for i, s in enumerate(ps))}</ol>
      </li>''' for k, t, ps in GUIAS)
    atajos = ''.join(f'<li><span>{e(d)}</span><span class="ay-teclas">{"".join(f"<kbd>{k}</kbd>" for k in ks)}</span></li>' for ks, d in ATAJOS)
    faqs = ''.join(f'''<li>
        <h3><button type="button" class="ay-p ay-q" aria-expanded="false" aria-controls="ay-{vp}-f{i}"><span>{e(q)}</span>{ic(I["abajo"], 18, 2.2)}</button></h3>
        <p class="ay-r" id="ay-{vp}-f{i}" lang="es" hidden>{e(a)}</p>
      </li>''' for i, (q, a) in enumerate(FAQS))
    sellos = ''.join(f'<li><b>{e(l)}</b><span>{e(d)}</span></li>' for l, d in SELLOS)
    return f'''<header class="ay-cab">
    <!-- A20·1 -->
    <h1>Centro de ayuda</h1>
    <p class="ay-sub">Todo lo que necesitas para sacarle el máximo a Spinus</p>
  </header>
  <div class="ay-lay">
    <div class="ay-col">
      <!-- A20·2: seis guías rápidas. La numeración se conserva porque son pasos en orden. Texto copiado tal cual de la app. -->
      <section class="ay-sec ay-o1" aria-label="Guías rápidas">
        <h2>Guías rápidas</h2>
        <ul class="ay-guias">{guias}</ul>
      </section>
      <!-- A20·5: preguntas frecuentes (8). Se abren con un fundido corto (opacidad + transform), ya no animando la altura. -->
      <section class="ay-sec ay-o4" aria-label="Preguntas frecuentes">
        <h2>Preguntas frecuentes</h2>
        <ul class="ay-tar ay-faq">{faqs}</ul>
      </section>
      <!-- A20·7: «Contactar soporte» (mailto:soporte…?subject=Soporte Spinus). Único botón primario de la pantalla. -->
      <section class="ay-tar ay-sop ay-o6" aria-label="Soporte">
        <div class="ay-sop-t"><h2>¿No encontraste lo que buscabas?</h2>
        <p>Escríbenos y te responderemos lo antes posible.</p></div>
        <a href="#" class="ay-p ay-prim">{ic(I["correo"], 18, 2)}Contactar soporte</a>
      </section>
    </div>
    <div class="ay-lado">
      <!-- A20·3: «Volver a ver el tutorial paso a paso»: borra spinus_onboarding y relanza el asistente (sin cambio de comportamiento). Tonal: el primario de la pantalla es «Contactar soporte». -->
      <button type="button" class="ay-p ay-ton ay-tut ay-o2">{ic(I["repetir"], 18, 2)}<span>Volver a ver el tutorial paso a paso</span></button>
      <!-- A20·4: atajos de teclado -->
      <section class="ay-sec ay-o3" aria-label="Atajos de teclado">
        <h2>Atajos de teclado</h2>
        <ul class="ay-tar ay-atajos">{atajos}</ul>
      </section>
      <!-- A20·6: seguridad y privacidad (3 sellos) con enlace a /privacy (pestaña nueva) -->
      <section class="ay-sec ay-o5" aria-label="Seguridad y privacidad">
        <h2>Seguridad y privacidad</h2>
        <div class="ay-tar ay-seg">
          <ul class="ay-sellos">{sellos}</ul>
          <p class="ay-priv">Para más detalles, consulta nuestro <a href="#" class="ay-p ay-enl">Aviso de Privacidad{ic(I["externo"], 14, 2)}</a></p>
        </div>
      </section>
    </div>
  </div>'''

AY_CSS = open(f'{L}/tmp-le-ay.css').read()
AY_JS = '''(function(){
  document.querySelectorAll('.ay.marco').forEach(function(m){
    m.querySelectorAll('.ay-q').forEach(function(b){b.addEventListener('click',function(){
      var ab=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!ab));
      m.querySelector('[id="'+b.getAttribute('aria-controls')+'"]').hidden=ab})});
    m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
  });
})();
'''

# =====================================================================================================
# 3 · SUPLEMENTACIÓN  (contenido copiado tal cual; solo lectura)
# =====================================================================================================
SUP = [
    ('Vitamina D3 + K2', 'Mineralización ósea y prevención de calcificación de tejidos blandos', ['Vitamina D < 40 ng/mL'], 'alta'),
    ('Omega-3 EPA/DHA', 'Resolución de inflamación crónica y viscosidad sinovial', ['PCR-us > 1.0 mg/L', 'Triglicéridos > 100 mg/dL'], 'alta'),
    ('Magnesio Glicinato / ZMA', '+ 300 reacciones enzimáticas, relajante muscular, formación ósea', ['Insulina > 8 uIU/mL (resistencia insulina)'], 'media'),
    ('Colágeno Hidrolizado + Vit C', 'Síntesis de matriz extracelular en cartílago y discos', ['HbA1c > 5.3%', 'diagnóstico articular'], 'media'),
    ('Creatina Monohidratada', 'Hidratación celular y prevención de atrofia en rehabilitación', ['Post-operatorio / rehabilitación activa'], 'alta'),
    ('Ashwagandha KSM-66', 'Reduce cortisol por dolor crónico, mejora tolerancia al esfuerzo', ['Dolor crónico > 3 meses'], 'baja'),
    ('HMB', 'Previene degradación muscular en reposo/inmovilización', ['Inmovilización / reposo prolongado'], 'alta'),
]
PRI = dict(alta='Alta prioridad', media='Media', baja='Complementario')
NOTAS = [
    ('Albúmina baja', 'Riesgo de infección quirúrgica y no-unión ósea — optimizar antes de cualquier procedimiento'),
    ('TSH fuera del rango óptimo (1.0–2.5)', 'Investigar hipotiroidismo subclínico como causa de síntomas osteomusculares'),
    ('Cistatina C > 0.9', 'Función renal comprometida — precaución con AINEs prolongados'),
    ('Insulina > 8 + HbA1c > 5.3%', 'Resistencia a insulina activa — glicación de colágeno comprometida'),
]

def su_cuerpo(vp):
    e = html.escape
    def crit(cs):
        return ''.join(f'<li>{"<span class=su-o>o</span>" if i else ""}<span class="su-cr">{e(c)}</span></li>' for i, c in enumerate(cs))
    tarjetas = ''.join(f'''<li class="su-tar">
        <div class="su-tc"><h2>{e(n)}</h2><span class="su-chip su-c-{p}">{ic(I["p_"+p], 14, 2.2)}{PRI[p]}</span></div>
        <p class="su-fn">{e(fn)}</p>
        <div class="su-ind"><span class="su-et">Indicado cuando:</span><ul class="su-crit">{crit(cs)}</ul></div>
      </li>''' for n, fn, cs, p in SUP)
    notas = ''.join(f'<li><b>{e(t)}</b><span>{e(d)}</span></li>' for t, d in NOTAS)
    return f'''<header class="su-cab">
    <h1>Protocolo de suplementación</h1>
    <p class="su-sub">Stack de suplementación osteomuscular — enfoque en densidad mineral, inflamación y tejidos blandos</p>
  </header>
  <!-- A15·1: tarjetas por suplemento, en el mismo orden que hoy. Solo lectura: no hay acciones. -->
  <ul class="su-grid">
    {tarjetas}
    <!-- A15·2: «Notas clínicas clave» -->
    <li class="su-tar su-notas">
      <h2>Notas clínicas clave</h2>
      <ul class="su-nl">{notas}</ul>
    </li>
  </ul>'''

SU_CSS = open(f'{L}/tmp-le-su.css').read()
SU_JS = '''(function(){
  document.querySelectorAll('.su.marco').forEach(function(m){
    m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
  });
})();
'''

escribe('1-estadisticas', 'es', 'Estadísticas',
        'Las gráficas se redibujan con los colores del sistema: cada valor a la vista, barras de alto fijo que no se inflan con un solo dato, ejes legibles y modo oscuro correcto',
        ES_CSS, es_cuerpo, ES_JS, 'mas', 'admin', 'Administración')
escribe('2-ayuda', 'ay', 'Centro de ayuda',
        'Una columna de lectura cómoda con pasos numerados, preguntas que se abren sin saltos y el contacto de soporte como única acción destacada',
        AY_CSS, ay_cuerpo, AY_JS, 'mas', None, 'Ayuda')
escribe('3-suplementacion', 'su', 'Protocolo de suplementación',
        'Tarjetas limpias con la prioridad en un chip, los criterios «Indicado cuando» separados y las notas clínicas como aviso; dos columnas en pantallas anchas',
        SU_CSS, su_cuerpo, SU_JS, 'pac', 'pac', 'Expediente')
