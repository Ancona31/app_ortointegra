# Generador de vista-lista.html (lista de pacientes, versión en calma). Uso: python3 tmp-pl-gen.py
import os
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{d}</svg>'

I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    lupa='<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    perfil='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    lado='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    arr='<path d="M12 19V5M6 11l6-6 6 6"/>', aba='<path d="M12 5v14M6 13l6 6 6-6"/>',
    filtro='<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
    carpeta='<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    lapiz='<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    nuevo='<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.8-3.6 3.6-5.5 7-5.5 1.6 0 3 .4 4.2 1.2M18 13v6M15 16h6"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
)
INI = '<span class="pl-m pl-a">AS</span><span class="pl-i">IS</span><span class="pl-s">SE</span>'

# ---------- Navegación (copiada del referente; activo: Pacientes) ----------
def riel():
    def b(k, t, act=False, cl=''):
        a = ' aria-current="page"' if act else ''
        return f'<a href="#" class="pl-p pl-rb{cl}" aria-label="{t}"{a}>{ic(I[k], 22)}</a>'
    return f'''<!-- A0: navegación. Riel a la derecha, fundido con la franja. La secretaria solo ve Inicio, Pacientes y Agenda. -->
<nav class="pl-riel" aria-label="Navegación principal">
  {b("inicio","Inicio")}{b("pac","Expediente",True)}{b("agenda","Agenda")}{b("docs","Documentos",cl=" pl-m")}<a href="#" class="pl-p pl-rb pl-m" aria-label="Más">{ic(I["mas"], 22, 3)}</a>
  <span class="pl-flex"></span>
  <button type="button" class="pl-p pl-mas pl-m" aria-label="Nueva consulta">{ic(I["plus"], 26, 2.4)}</button>
  <button type="button" class="pl-p pl-mas pl-s" aria-label="Agendar cita">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lateral():
    def a(k, t, act=False, cl=''):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="pl-p pl-li{cl}"{c}>{ic(I[k], 20)}{t}</a>'
    return f'''<!-- A0: navegación (barra lateral) -->
<nav class="pl-lat" aria-label="Navegación principal">
  <div class="pl-lat-cab"><span class="pl-logo">{ic(I["logo"], 24, 1.8)}<span class="pl-logo-n">Spinus</span></span><span class="pl-plan pl-m">Plan VIP</span></div>
  <button type="button" class="pl-p pl-cons-b"><span class="pl-av">{INI}</span><span class="pl-cons-t"><span class="pl-m">Consultorio</span><b class="pl-m">Centro</b><span class="pl-s">Clínica</span><b class="pl-s">Clínica Semilla A</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="pl-lista">{a("inicio","Inicio")}{a("pac","Expediente",True)}{a("agenda","Agenda")}{a("docs","Documentos",cl=" pl-m")}{a("admin","Administración",cl=" pl-m pl-a")}</div>
  <span class="pl-flex"></span>
  <div class="pl-lat-pie"><a href="#" class="pl-p pl-li pl-yo">{ic(I["perfil"], 20)}<span><span class="pl-m pl-a">Dr. Admin Semilla</span><span class="pl-i">Dra. Invitada Semilla</span><span class="pl-s">Secretaria Semilla</span><small class="pl-m">Mi perfil · Ajustes</small><small class="pl-s">Asistente</small></span></a></div>
</nav>'''

def encabezado():
    return f'''<!-- A0: encabezado fundido con la barra de estado -->
<header class="pl-enc">
  <button type="button" class="pl-p pl-hamb" aria-label="Menú">{ic(I["menu"], 22, 2)}</button>
  <span class="pl-enc-t">Expediente</span>
  <span class="pl-flex"></span>
  <button type="button" class="pl-p pl-av pl-av-g" aria-label="Mi perfil">{INI}</button>
</header>'''

def encv():
    def a(t, act=False, cl=''):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="pl-p pl-pi{cl}"{c}>{t}</a>'
    return f'''<!-- A0 en Duo abierto vertical (CALMA §19): encabezado fundido con la barra de estado. A la izquierda «Mostrar barra lateral» abre el menú completo
     (Administración, Mi perfil, Ayuda); al centro las cuatro secciones y «Más» (el mismo menú que el «···» del riel; CALMA §23.9) como píldoras; a la derecha el avatar. La secretaria no ve Documentos. -->
<header class="pl-encv">
  <button type="button" class="pl-p pl-lado" aria-label="Mostrar barra lateral">{ic(I["lado"], 20)}</button>
  <nav class="pl-pista" aria-label="Navegación principal">{a("Inicio")}{a("Expediente",True)}{a("Agenda")}{a("Documentos",cl=" pl-m")}<a href="#" class="pl-p pl-pi pl-m" aria-haspopup="menu">Más</a></nav>
  <button type="button" class="pl-p pl-av pl-av-g" aria-label="Mi perfil">{INI}</button>
</header>'''

# ---------- Contenido ----------
def cont(vp):
    tel = vp in ('ext', 'tel')
    pop = 'dialog' if tel else 'menu'
    if tel:
        cuerpo = '''<!-- F11: filas de dos líneas y 60 de alto; la fila entera lleva al expediente. A la derecha, el dato del orden activo (fecha de ingreso o médico).
         F10: «···» tenue al final (área 44×44) → hoja corta con Médicos, Ingreso y las dos acciones de hoy.
         F16: la secretaria ve las filas sin enlace y sin «···», con los médicos en una tercera línea. -->
    <section class="pl-tar pl-cuerpo" aria-label="Pacientes">
      <ul class="pl-lst"></ul>
      <!-- F13: paginación acumulativa. Mientras carga, el rótulo pasa a «Cargando...» y se atenúa; si falla, el mensaje de error sale bajo la lista sin borrar lo cargado. -->
      <button type="button" class="pl-p pl-mas-b" hidden>Cargar más pacientes</button>
    </section>'''
    else:
        def hb(o, t):
            return f'<button type="button" class="pl-p pl-hb" data-o="{o}">{t}{ic(I["aba"], 14, 2)}</button>'
        def col(o, t):
            return f'<div role="columnheader" aria-sort="none">{hb(o, t)}</div>'
        # Duo abierto (horizontal y vertical, CALMA §23.5): la edad va bajo el nombre. En vertical, sin encabezado «Edad»: el orden por edad está en el menú «Ordenado por», así que su encabezado comparte celda con «Paciente»
        c1 = f'<div role="columnheader" class="pl-h2">{hb("ape","Paciente")}{hb("edad","Edad")}</div>' if vp == 'ih' else col("ape", "Paciente") if vp == 'iv' else col("ape", "Paciente") + col("edad", "Edad")
        cuerpo = f'''<!-- F7 y F8: tabla sin rayas; los encabezados ordenan (misma columna alterna la dirección; otra columna empieza en ascendente). La fila entera abre el expediente.
         F9: el «+N» es un botón de texto que abre la lista de médicos (hoy solo en title). F10: «···» tenue → «Ir a expediente» y «Editar paciente».
         F16: la secretaria ve los nombres sin enlace y sin «···». -->
    <section class="pl-tar pl-cuerpo" role="table" aria-label="Pacientes">
      <div role="rowgroup"><div class="pl-fr pl-th" role="row">{c1}{col("exp","Expediente")}{col("ing","Fecha de ingreso")}<div role="columnheader" class="pl-hn">Médicos</div><div role="columnheader" aria-label="Acciones" class="pl-m"></div></div></div>
      <div class="pl-tb pl-lst" role="rowgroup"></div>
      <!-- F13: paginación acumulativa («Cargando...» mientras carga). -->
      <button type="button" class="pl-p pl-mas-b" hidden>Cargar más pacientes</button>
    </section>'''
    # CALMA §17: en Duo cerrado, «+» y el sustantivo; el rótulo completo queda en aria-label
    prim = (f'<a href="#" class="pl-p pl-prim pl-prim-c" data-onboard="nuevo-paciente-exp" aria-label="Nuevo paciente">{ic(I["plus"], 16, 2.2)}Paciente</a>' if vp == 'ext'
            else '<a href="#" class="pl-p pl-prim" data-onboard="nuevo-paciente-exp">Nuevo paciente</a>')
    return f'''<main class="pl-cont"><div class="pl-col">
    <header class="pl-cab">
      <div class="pl-tit">
        <!-- Título decidido por el dueño (CALMA §15) -->
        <h1>Expediente</h1>
        <!-- F13: total (la app lo calcula en la carga inicial, sin búsqueda) -->
        <p class="pl-sub pl-total">25 pacientes registrados</p>
      </div>
      <!-- F1: «Nuevo paciente», único botón relleno de la pantalla, compacto. Conserva el ancla del asistente de bienvenida.
           Con el plan bloqueado no navega: abre el modal global «Función no disponible» (A0), que no cambia. -->
      {prim}
    </header>
    <div class="pl-herr">
      <!-- F2: búsqueda por nombre o apellido (en la app, con espera de 300 ms) -->
      <label class="pl-campo">{ic(I["lupa"], 18, 2)}<input type="search" class="pl-busca" placeholder="Buscar por nombre o apellido..." aria-label="Buscar por nombre o apellido" autocomplete="off"></label>
      <!-- F5, F6, F11, F12: una sola línea discreta. Teléfono: las dos acciones abren la hoja «Filtrar y ordenar».
           Ancho: «Filtros» abre un popover (F3, F4: Médico, Ingreso desde/hasta, de aplicación inmediata) y el orden abre un menú con los 6 criterios y la dirección. -->
      <div class="pl-linea">
        <button type="button" class="pl-p pl-txt pl-ord" aria-haspopup="{pop}"><span class="pl-ord-pre">Ordenado por</span><span class="pl-ord-v"></span></button>
        <span class="pl-flex"></span>
        <button type="button" class="pl-p pl-txt pl-fil" aria-haspopup="dialog">{ic(I["filtro"], 16, 2)}Filtros<span class="pl-punto" hidden></span></button>
      </div>
    </div>
    {cuerpo}
    <!-- F14: estados. Mientras carga la primera página: cinco filas fantasma (esqueleto) con la retícula de la lista. Textos idénticos a los de hoy; cada estado lleva un icono en círculo tintado y, si hay acción, un botón tonal. -->
    <section class="pl-est pl-e-vac" hidden>
      <span class="pl-eic pl-eic-q" aria-hidden="true">{ic(I["lupa"], 24, 1.8)}</span><span class="pl-eic pl-eic-n" aria-hidden="true">{ic(I["nuevo"], 24, 1.8)}</span>
      <h2>No se encontraron pacientes</h2>
      <p class="pl-e-vac-p"></p>
      <a href="#" class="pl-p pl-ton pl-e-nuevo">+ Nuevo paciente</a>
    </section>
    <section class="pl-est pl-e-err" hidden>
      <span class="pl-eic pl-eic-mal" aria-hidden="true">{ic(I["aviso"], 24, 1.8)}</span>
      <h2>No se pudo cargar la lista</h2>
      <p>No se pudo cargar la lista de pacientes</p>
      <button type="button" class="pl-p pl-ton pl-reintenta">Reintentar</button>
    </section>
  </div></main>'''

# ---------- Capas ----------
def capas(vp):
    if vp in ('ih', 'iv', 'esc'):
        return '''<!-- Menú de fila, lista de médicos, menú de orden y popover de filtros: un solo contenedor que nace del botón que lo abre, sin velo (CALMA §21).
     Se cierra con Esc, al tocar fuera o al desplazar. En Duo abierto ya no esquiva la bisagra (CALMA §18). -->
<div class="pl-menu"></div>'''
    ops = ''.join(f'<button type="button" class="pl-p pl-op" data-o="{v}" aria-pressed="false">{t}</button>'
                  for v, t in (('ape', 'Apellido'), ('nom', 'Nombre'), ('ing', 'Fecha de ingreso'), ('edad', 'Edad'), ('exp', 'N.º de expediente')))
    return f'''<!-- F12: hoja «Filtrar y ordenar». Trabaja sobre un borrador: solo «Ver resultados» aplica; la X, tocar fuera o Esc cierran sin aplicar.
     «Limpiar» devuelve el borrador a médico por defecto, sin fechas, Fecha de ingreso descendente. -->
<div class="pl-capa pl-c-fil" aria-hidden="true">
  <div class="pl-velo"></div>
  <div class="pl-hoja" role="dialog" aria-modal="true" aria-label="Filtrar y ordenar">
    <span class="pl-asa" aria-hidden="true"></span>
    <div class="pl-hjcab"><h2>Filtrar y ordenar</h2><button type="button" class="pl-p pl-ib pl-cierra" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
    <label class="pl-f" style="margin-top:4px"><span class="pl-et">Médico</span><span class="pl-sel"><select class="pl-in pl-h-med"></select>{ic(I["abajo"], 16, 2)}</span></label>
    <div class="pl-f" role="group" aria-label="Fecha de ingreso"><span class="pl-et">Fecha de ingreso</span>
      <div class="pl-par"><input type="date" class="pl-in pl-h-desde" aria-label="Ingreso desde"><input type="date" class="pl-in pl-h-hasta" aria-label="Ingreso hasta"></div></div>
    <div class="pl-g" role="group" aria-label="Ordenar por"><span class="pl-et">Ordenar por</span><div class="pl-ops">{ops}</div></div>
    <div class="pl-g" role="group" aria-label="Dirección"><span class="pl-et">Dirección</span>
      <div class="pl-ops"><button type="button" class="pl-p pl-op pl-sg" data-d="asc" aria-pressed="false">{ic(I["arr"], 14, 2)}Ascendente</button><button type="button" class="pl-p pl-op pl-sg" data-d="desc" aria-pressed="false">{ic(I["aba"], 14, 2)}Descendente</button></div></div>
    <!-- CALMA §13: botones de verdad, del mismo ancho; secundario tonal a la izquierda, principal a la derecha. -->
    <div class="pl-pie"><button type="button" class="pl-p pl-bton pl-limpiar">Limpiar</button><button type="button" class="pl-p pl-prim pl-aplica">Ver resultados</button></div>
  </div>
</div>
<!-- F10 en teléfono: «···» abre una hoja corta. Arriba, quién es y los dos datos que no caben en la fila (médicos e ingreso);
     abajo, exactamente las dos acciones de hoy. Se cierra tocando fuera o con Esc. -->
<div class="pl-capa pl-c-acc" aria-hidden="true">
  <div class="pl-velo"></div>
  <div class="pl-hoja" role="dialog" aria-modal="true" aria-label="Acciones del paciente">
    <span class="pl-asa" aria-hidden="true"></span>
    <div class="pl-quien"><span class="pl-pa pl-a-av" aria-hidden="true"></span><div><h2 class="pl-a-nom"></h2><p class="pl-a-meta"></p></div></div>
    <dl class="pl-pares"><div><dt>Médicos</dt><dd class="pl-a-med"></dd></div><div><dt>Ingreso</dt><dd class="pl-a-ing"></dd></div></dl>
    <div class="pl-accs"><a href="#" class="pl-p pl-mi pl-ac">{ic(I["carpeta"], 20)}<span>Ir a expediente</span></a><a href="#" class="pl-p pl-mi pl-ac">{ic(I["lapiz"], 20)}<span>Editar paciente</span></a></div>
  </div>
</div>'''

CSS = open(f'{L}/tmp-pl-estilo.css').read()
JS = open(f'{L}/tmp-pl-guion.js').read()

def marco(vp):
    if vp == 'ext':
        app = cont(vp) + riel()
    elif vp == 'tel':
        app = encabezado() + cont(vp)
    elif vp == 'ih':
        app = cont(vp) + lateral()
    elif vp == 'iv':
        app = encv() + cont(vp)
    else:
        app = lateral() + cont(vp)
    return f'<div class="marco pl" data-vp="{vp}">\n<div class="pl-app">\n{app}\n</div>\n{capas(vp)}\n</div>'

out = ('<!-- NOMBRE: Expediente (lista de pacientes) | Misma lista limpia, ahora con carácter: vuelven los avatares en pastel, el dato que ordena la lista resalta, orden y filtros van en azul con su icono, los menús llevan iconos de color y los estados vacíos tienen icono y botón -->\n'
       '<style>\n' + CSS + '</style>\n' + '\n'.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '\n<script>\n' + JS + '</script>\n')
open(f'{L}/vista-lista.html', 'w').write(out)
print(len(out))
