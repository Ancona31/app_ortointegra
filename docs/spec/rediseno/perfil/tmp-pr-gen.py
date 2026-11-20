# Generador de vista-perfil.html (los cuatro marcos comparten piezas). Uso: python3 tmp-pr-gen.py
import os
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
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    palomita='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    pin='<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.400-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.4"/>',
    imagen='<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="m5 18 5-4.500 3.500 3 2.500-2 3.500 3.500"/>',
    subir='<path d="M12 15.500V4.500M7.500 8.500 12 4l4.500 4.500M4.500 15.500v3a1.500 1.500 0 0 0 1.500 1.500h12a1.500 1.500 0 0 0 1.500-1.500v-3"/>',
    pluma='<path d="M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17z"/><path d="m14.500 7.500 3 3"/>',
    goma='<path d="M8.500 19.500 3.800 14.800a1.500 1.500 0 0 1 0-2.100l8.400-8.400a1.500 1.500 0 0 1 2.100 0l5 5a1.500 1.500 0 0 1 0 2.100l-8.100 8.100zM8.500 19.500H20M8 8.500l7 7"/>',
    basura='<path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l.8 12a1.500 1.500 0 0 0 1.500 1.500h6.400a1.500 1.500 0 0 0 1.500-1.500l.8-12M10 11v6M14 11v6"/>',
    refresca='<path d="M20 12a8 8 0 1 1-2.600-5.900M20 4.500V9h-4.500"/>',
    salir='<path d="M14.500 4.500H18a1.500 1.500 0 0 1 1.500 1.500v12a1.500 1.500 0 0 1-1.500 1.500h-3.500M10.500 16l4-4-4-4M14.500 12h-10"/>',
    entrar='<path d="M9.500 4.500H6A1.500 1.500 0 0 0 4.500 6v12A1.500 1.500 0 0 0 6 19.500h3.500M13.500 16l4-4-4-4M17.500 12h-10"/>',
    luna='<path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z"/>',
    escudo='<path d="M12 3.500 5 6v5.500c0 4.300 2.900 7.400 7 9 4.100-1.600 7-4.700 7-9V6z"/><path d="m9.300 12 1.900 1.900 3.600-3.800"/>',
    externo='<path d="M13.500 5H19v5.500M19 5l-8 8M10 6.500H6.500A1.500 1.500 0 0 0 5 8v9.500A1.500 1.500 0 0 0 6.500 19H16a1.500 1.500 0 0 0 1.500-1.500V14"/>',
    info='<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.700v.1"/>',
    alerta='<path d="M12 4 2.800 19.500h18.400zM12 10v4.500M12 17.200v.1"/>',
    lateral='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    engrane='<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>',
    sinred='<path d="M3 3l18 18M8.500 16a5 5 0 0 1 7 0M5.300 12.500a9 9 0 0 1 3.200-2M18.700 12.500a9 9 0 0 0-4.900-2.400M2.500 9a14 14 0 0 1 3.300-2.300M21.500 9a14 14 0 0 0-10.700-3.900M12 19.500v.1"/>',
)
import re
for k in I:
    I[k] = re.sub(r'(\.\d)00', r'\1', I[k])

def marca(s=24):
    return f'<span class="pr-logo">{ic(I["logo"], s, 1.8)}<span class="pr-logo-n">Spinus</span></span>'

PLAN = '<span class="pr-plan">Plan VIP</span>'
MI = '<span class="pr-a">AS</span><span class="pr-i">IS</span>'

# ---------- Navegación (copiada del referente; activo: «Más» en el riel, «Mi perfil · Ajustes» al pie de la barra lateral) ----------
def riel():
    def b(k, t):
        return f'<a href="#" class="pr-p pr-rb" aria-label="{t}">{ic(I[k], 22)}</a>'
    return f'''<!-- A0 · navegación. Riel a la derecha, fundido con la franja del sistema. «Mi perfil» vive en «Más». -->
<nav class="pr-riel" aria-label="Navegación principal">
  {b("inicio","Inicio")}{b("pac","Expediente")}{b("agenda","Agenda")}{b("docs","Documentos")}<a href="#" class="pr-p pr-rb" aria-label="Más: Mi perfil" aria-current="page">{ic(I["mas"], 22, 3)}</a>
  <span class="pr-flex"></span>
  <button type="button" class="pr-p pr-mas" aria-label="Nueva consulta">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lateral():
    def a(k, t):
        return f'<a href="#" class="pr-p pr-li">{ic(I[k], 20)}{t}</a>'
    return f'''<!-- A0 · navegación (barra lateral). Activo: «Mi perfil · Ajustes», al pie. -->
<nav class="pr-lat" aria-label="Navegación principal">
  <div class="pr-lat-cab">{marca(24)}{PLAN}</div>
  <button type="button" class="pr-p pr-cons-b"><span class="pr-av">{MI}</span><span class="pr-cons-t"><span>Consultorio</span><b>Centro</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="pr-lista">{a("inicio","Inicio")}{a("pac","Expediente")}{a("agenda","Agenda")}{a("docs","Documentos")}{a("admin","Administración")}</div>
  <span class="pr-flex"></span>
  <div class="pr-lat-pie"><a href="#" class="pr-p pr-li pr-yo" aria-current="page">{ic(I["perfil"], 20)}<span><span class="pr-a">Dr. Admin Semilla</span><span class="pr-i">Dra. Invitada Semilla</span><small>Mi perfil · Ajustes</small></span></a></div>
</nav>'''

def encabezado():
    return f'''<!-- A0 · navegación. Encabezado fundido con la barra de estado. «Mi perfil» se abre desde el menú o el avatar. -->
<header class="pr-enc">
  <button type="button" class="pr-p pr-menu" aria-label="Menú">{ic(I["menu"], 22, 2)}</button>
  <span class="pr-enc-t">Cuenta</span>
  <span class="pr-flex"></span>
  <button type="button" class="pr-p pr-av pr-av-g" aria-label="Mi perfil" aria-current="page">{MI}</button>
</header>'''

def encabezado_v():
    pil = ''.join(f'<a href="#" class="pr-p pr-pil">{t}</a>' for t in ('Inicio', 'Expediente', 'Agenda', 'Documentos'))
    # CALMA §23.9: quinta píldora «Más» (abre el mismo menú que el «···» del riel). En Mi perfil va marcado el avatar, no «Más».
    pil += '<button type="button" class="pr-p pr-pil" aria-haspopup="menu">Más</button>'
    return f'''<!-- A0 · navegación de Duo abierto vertical: encabezado fundido con pista de secciones (CALMA §19). Mi perfil se abre desde el avatar
     o desde «Mostrar barra lateral»; ninguna píldora va activa (tampoco «Más»): lo marcado es el avatar. -->
<header class="pr-encv">
  <button type="button" class="pr-p pr-encv-b" aria-label="Mostrar barra lateral">{ic(I["lateral"], 20)}</button>
  <nav class="pr-pista" aria-label="Secciones">{pil}</nav>
  <button type="button" class="pr-p pr-av pr-av-g pr-av-act" aria-label="Mi perfil" aria-current="page">{MI}</button>
</header>'''

def grupo(tit, icono, cuerpo, pie='', der='', cls='', tcls='', aria=None):
    p = f'<p class="pr-pieg">{pie}</p>' if pie else ''
    return f'''<section class="pr-gr{" " + cls if cls else ""}" aria-label="{aria or tit}">
      <div class="pr-gt"><span class="pr-gtt">{ic(I[icono], 16, 2)}<h2>{tit}</h2></span>{der}</div>
      <div class="pr-tar{" " + tcls if tcls else ""}">{cuerpo}</div>{p}
    </section>'''

# ---------- Piezas ----------
def f(et, ctrl, req=False, cls='', extra=''):
    r = '<i aria-hidden="true"> *</i>' if req else ''
    return f'<label class="pr-f{" " + cls if cls else ""}"><span>{et}{r}</span>{ctrl}{extra}</label>'

def inp(k, s, val='', ph='', tipo='text', extra=''):
    return f'<input type="{tipo}" class="pr-in" data-k="{k}" data-s="{s}" value="{val}" placeholder="{ph}" autocomplete="off"{extra}>'

def sel(k, s, ops, val, extra=''):
    o = ''.join(f'<option{" selected" if x == val else ""}>{x}</option>' for x in ops)
    return f'<span class="pr-sel"><select class="pr-in" data-k="{k}" data-s="{s}"{extra}>{o}</select>{ic(I["abajo"], 16, 2.2)}</span>'

ESP = ['Medicina General', 'Medicina Familiar', 'Medicina Interna', 'Cirugía General', 'Ortopedia y Traumatología', 'Cirugía de Columna',
       'Neurocirugía', 'Pediatría', 'Medicina de Rehabilitación', 'Reumatología', 'Anestesiología', 'Medicina de Urgencias']
ZONAS = ['Baja California — Tijuana, Ensenada, Mexicali (UTC-8)', 'Sinaloa, BCS y Nayarit interior — Mazatlán, La Paz, Los Cabos, Tepic (UTC-7)',
         'Sonora — Hermosillo, Ciudad Obregón (UTC-7)', 'Centro — CDMX, Jalisco, Edomex, Puebla, Veracruz, Oaxaca y mayoría (UTC-6)',
         'Yucatán — Mérida, Valladolid (UTC-6)', 'Nuevo León, Coahuila y Tamaulipas interior — Monterrey, Saltillo (UTC-6)',
         'Tamaulipas frontera — Matamoros, Reynosa, Nuevo Laredo (UTC-6)', 'Chihuahua — capital y zona centro (UTC-6)', 'Chihuahua — Ojinaga (UTC-6)',
         'Chihuahua — Ciudad Juárez (UTC-6)', 'Nayarit — Bahía de Banderas, Punta Mita (UTC-6)', 'Quintana Roo — Cancún, Playa, Tulum (UTC-5)']
PALETAS = [('Spinus® (defecto)', '#1a3a5c', '#1e5fa8'), ('Verde médico', '#134e4a', '#0d9488'), ('Morado', '#3b0764', '#7c3aed'),
           ('Rojo burdeos', '#7f1d1d', '#dc2626'), ('Café cálido', '#451a03', '#b45309'), ('Pizarra oscuro', '#0f172a', '#475569')]
CONS = [('c1', 'Centro', 'Calle Ficticia 1, Centro, Mérida', '999 000 0001', True),
        ('c2', 'Hosp Norte', 'Avenida Ficticia 2, Norte, Mérida', '999 000 0002', False),
        ('c3', 'Rehab', 'Calle Ficticia 3, Poniente, Mérida', '999 000 0003', False)]
DP, CL, AP = 'Datos profesionales', 'Nombre de la clínica', 'Apariencia'

def cab(vp):
    return f'''<header class="pr-cab">
    <!-- Función 1: título de la pantalla. (El esqueleto de carga y la pantalla «No se pudieron cargar tus datos. Revisa tu conexión e inténtalo de nuevo.» + «Reintentar»
         son estados de sistema: se conservan tal cual, no se dibujan aquí.) -->
    <div class="pr-tit"><h1>Mi perfil</h1><p class="pr-sec"><span class="pr-a">Dr. Admin Semilla · administras Clínica Semilla A</span><span class="pr-i">Dra. Invitada Semilla · médica invitada en Clínica Semilla A</span></p></div>
    <!-- Control SOLO de la maqueta -->
    <div class="pr-maq"><button type="button" class="pr-p pr-demo pr-demo-rol" aria-pressed="false">Maqueta: ver como médico invitado</button></div>
  </header>'''

def tabs():
    return '''<!-- Función 3: pestañas Datos · Consultorios · Google Calendar. Texto con subrayado, fijas al desplazar. La pestaña activa sigue viviendo en la URL (?tab=),
       que es por donde llegan los enlaces de la agenda y del menú; ?gcal_error= abre Google Calendar. -->
  <div class="pr-tabs" role="tablist" aria-label="Secciones de Mi perfil">
    <button type="button" role="tab" class="pr-p pr-tab" data-tab="datos" aria-selected="true">Datos</button>
    <button type="button" role="tab" class="pr-p pr-tab" data-tab="cons" aria-selected="false">Consultorios</button>
    <button type="button" role="tab" class="pr-p pr-tab" data-tab="google" aria-selected="false">Google Calendar</button>
  </div>'''

def identidad():
    return f'''<section class="pr-tar pr-id" aria-label="Así apareces en tus documentos">
      <!-- Función 2: tarjeta de identidad (solo lectura): logo de la clínica, nombre, especialidad, cédulas, firma («Sin firma») y colores. Se actualiza al escribir. -->
      <div class="pr-idc">
        <span class="pr-logo-c pr-vac" data-h="logo" aria-hidden="true">{ic(I["imagen"], 22)}{ic(I["logo"], 30, 1.6, " hidden")}</span>
        <div class="pr-idn"><b data-h="nombre">Dr. Admin Semilla</b><span class="pr-sub" data-h="esp">Ortopedia y Traumatología</span></div>
      </div>
      <p class="pr-ceds pr-num" data-h="ceds"><span>Céd. profesional <b>00000001</b></span></p>
      <div class="pr-id2">
        <div class="pr-idb"><span class="pr-rot">Firma en documentos</span><div class="pr-fbox" data-h="firma">Sin firma</div><span class="pr-nota">Se imprime sobre la línea punteada de cada PDF.</span></div>
        <div class="pr-idb"><span class="pr-rot">Colores</span><div class="pr-cols"><span class="pr-mu" aria-hidden="true"><span></span><span></span></span><b data-h="paleta">Spinus® (defecto)</b></div><span class="pr-nota">Son el acento de la app y de los documentos que emites.</span></div>
      </div>
    </section>'''

def papel():
    return f'''<div class="pr-f pr-a">
        <span>Vista previa del encabezado en PDF</span>
        <!-- Es papel: blanco también en modo oscuro (correcto). La «mesa» gris lo enmarca para que se entienda que es una hoja. -->
        <div class="pr-mesa" role="img" aria-label="Vista previa del encabezado de tus PDF sobre papel blanco">
          <div class="pr-papel">
            <div class="pr-pcab"><span class="pr-plogo" data-h="plogo" hidden>{ic(I["logo"], 30, 1.6)}</span>
              <div class="pr-pn"><b data-h="nombre">Dr. Admin Semilla</b><span data-h="esp">Ortopedia y Traumatología</span><small data-h="pceds">• Céd. Prof. 00000001</small></div></div>
            <div class="pr-pl"></div>
            <div class="pr-pt"><i></i><i></i><i></i></div>
          </div>
        </div>
        <span class="pr-ay">Así sale impreso: siempre sobre papel blanco.</span>
      </div>'''

def datos_prof():
    return grupo('Datos profesionales', 'perfil', f'''
      <!-- Función 4: tratamiento, nombre(s), apellido paterno, apellido materno. Cada campo es una fila de la lista (sin caja gris por campo). -->
      <div class="pr-g pr-nombre">
        {f("Título", sel("titulo", DP, ["Dr.", "Dra."], "Dr."))}
        {f("Nombre(s)", inp("nombres", DP, "Admin", "Ej: Juan Carlos"), True)}
        {f("Apellido paterno", inp("paterno", DP, "Semilla", "Ej: García"), True, "pr-ap")}
        {f("Apellido materno", inp("materno", DP, "", "Opcional"), False, "pr-ap")}
      </div>
      <!-- Función 6: cédulas con validación en vivo («Solo números» / «La cédula debe tener 7 u 8 dígitos») bajo el campo -->
      <div class="pr-g pr-ced">
        {f("Cédula profesional", inp("ced", DP, "00000001", "Ej: 87654321", extra=' inputmode="numeric" maxlength="8"'), extra='<span class="pr-err" hidden></span>')}
        {f("Cédula de especialidad", inp("cedesp", DP, "", "Ej: 3890214", extra=' inputmode="numeric" maxlength="8"'), extra='<span class="pr-err" hidden></span>')}
      </div>
      <!-- Función 5: especialidad con selector; «Agregar especialidad» abre una segunda, escrita a mano (con sugerencias), que se puede quitar -->
      <div class="pr-f"><span>Especialidad</span>
        {sel("esp", DP, ESP, "Ortopedia y Traumatología", ' aria-label="Especialidad"')}
        <div class="pr-esp2w" hidden>
          <div class="pr-esp2"><input type="text" class="pr-in" data-k="esp2" data-s="{DP}" value="" placeholder="Escribe tu segunda especialidad" aria-label="Segunda especialidad" autocomplete="off"><button type="button" class="pr-p pr-ib pr-esp-q" aria-label="Quitar la segunda especialidad">{ic(I["x"], 18, 2)}</button></div>
          <span class="pr-ay">Escribe la tuya si no está en la lista</span>
        </div>
        <button type="button" class="pr-p pr-txt pr-esp-a" style="align-self:flex-start">{ic(I["plus"], 16, 2.4)}Agregar especialidad</button>
      </div>
      {f("Universidad / Institución", inp("uni", DP, "", "Ej: Universidad Nacional Autónoma de México"))}''',
      'Aparecen en las recetas, solicitudes y documentos que emites.', tcls='pr-filas')

def firma():
    return grupo('Firma autógrafa', 'pluma', f'''
      <!-- Función 8: subir imagen (JPG, PNG, WEBP hasta 10 MB) o dibujar con dedo o ratón; limpiar; vista previa sobre blanco y sobre oscuro; «Aceptar firma»;
           «Cambiar firma»; eliminar. En la maqueta, «Toca para seleccionar…» no abre el selector de archivos: pasa a la vista previa con una firma de muestra.
           El lienzo SÍ dibuja de verdad. Estados de sistema: «Procesando imagen…», «Procesando…», «Guardando…». -->
      <div class="pr-firma" data-f="subir">
        <div class="pr-seg pr-fcap" role="group" aria-label="Cómo capturar la firma">
          <button type="button" class="pr-p" data-modo="subir" aria-pressed="true">{ic(I["subir"], 16, 2)}Subir imagen</button>
          <button type="button" class="pr-p" data-modo="dibujar" aria-pressed="false">{ic(I["pluma"], 16, 2)}Dibujar firma</button>
        </div>
        <button type="button" class="pr-p pr-zona pr-fs">{ic(I["subir"], 24, 1.8)}<b>Toca para seleccionar foto de tu firma</b><small>JPG, PNG, WEBP · Máx. 10 MB · Se procesará automáticamente</small></button>
        <div class="pr-fd pr-lienzo"><canvas width="600" height="264" aria-label="Lienzo para dibujar tu firma"></canvas><p>Firma aquí con el dedo o mouse</p></div>
        <div class="pr-fd pr-fila-b"><button type="button" class="pr-p pr-txt pr-f-lim" disabled>{ic(I["goma"], 16, 2)}Limpiar</button><button type="button" class="pr-p pr-tonal pr-f-proc" aria-disabled="true">Guardar firma{ic(I["sig"], 14, 2.4)}</button></div>
        <div class="pr-fp pr-prev">
          <figure><figcaption>Sobre fondo blanco</figcaption><div class="pr-pv"><img alt="Vista previa de la firma sobre fondo blanco" data-h="fimg"></div></figure>
          <figure><figcaption>Sobre fondo oscuro</figcaption><div class="pr-pv pr-osc"><img alt="Vista previa de la firma sobre fondo oscuro" data-h="fimg"></div></figure>
        </div>
        <div class="pr-fp pr-par2"><button type="button" class="pr-p pr-quieto pr-f-otra">{ic(I["refresca"], 16, 2)}Subir otra</button><button type="button" class="pr-p pr-tonal pr-f-ok">{ic(I["palomita"], 16, 2.4)}Aceptar firma</button></div>
        <div class="pr-fg pr-guard">
          <div class="pr-pv"><img alt="Firma guardada" data-h="fimg"></div>
          <div class="pr-btns"><button type="button" class="pr-p pr-tonal pr-f-cambia">Cambiar firma</button><button type="button" class="pr-p pr-txt pr-rojo pr-f-elim">{ic(I["basura"], 16, 2)}Eliminar</button></div>
        </div>
        <p class="pr-nota">La firma se guarda en cuanto la capturas: no depende del botón de guardar.</p>
      </div>''', 'Aparece encima de la línea punteada en todos los documentos PDF.', aria='Firma')

def clinica(vp):
    pals = ''.join(f'<button type="button" class="pr-p pr-pal" aria-pressed="{"true" if i == 0 else "false"}" data-a="{a}" data-b="{b}" style="--a:{a};--b:{b}"><span class="pr-pal-m" aria-hidden="true"><span></span><span></span></span><span>{n}</span>{ic(I["palomita"], 14, 3)}</button>' for i, (n, a, b) in enumerate(PALETAS))
    return grupo('<span class="pr-a">Marca de la clínica</span><span class="pr-i">Clínica</span>', 'imagen', f'''
      <!-- Función 7: nombre de la clínica. Editable solo para quien administra; el resto lo ve en lectura con la nota. -->
      <div class="pr-f pr-a"><span>Nombre de la clínica<i aria-hidden="true"> *</i></span>
        <input type="text" class="pr-in" data-k="clinica" data-s="{CL}" value="Clínica Semilla A" placeholder="Ej: Clínica Ortointegra" maxlength="120" aria-label="Nombre de la clínica" autocomplete="off">
        <span class="pr-err pr-err-cl" hidden>El nombre de la clínica no puede quedar vacío.</span>
        <span class="pr-ay">Es el nombre de la clínica, distinto al de cada consultorio.</span>
      </div>
      <div class="pr-f pr-i"><span>Nombre de la clínica</span><div class="pr-lect">Clínica Semilla A</div>
        <span class="pr-ay">Es el nombre de la clínica, distinto al de cada consultorio. Sólo quien administra la clínica puede cambiarlo.</span></div>
      <!-- Función 9 (solo admin): logo. Subir / cambiar; «Descartar selección» solo sobre un archivo elegido sin guardar. Se sube al pulsar «Guardar».
           Conserva data-onboard="subir-logo": es el ancla del asistente de bienvenida. En la maqueta no se abre el selector de archivos: se usa un logo de muestra. -->
      <div class="pr-sep pr-a">
        <h3 class="pr-st">Logo</h3>
        <div class="pr-logo-f">
          <span class="pr-logo-g" data-h="logog" aria-hidden="true">{ic(I["subir"], 22)}{ic(I["logo"], 44, 1.4, " hidden")}</span>
          <div class="pr-logo-a">
            <div class="pr-btns"><button type="button" class="pr-p pr-tonal pr-logo-b" data-onboard="subir-logo">Subir logo</button><button type="button" class="pr-p pr-quieto pr-logo-q" hidden>{ic(I["x"], 16, 2)}Descartar selección</button></div>
            <span class="pr-ay">PNG, JPG, SVG · se optimiza a máx. 150 KB</span>
          </div>
        </div>
      </div>
      <!-- Función 10 (solo admin): paleta. Seis combinaciones + dos colores libres (primario y secundario). Estos dos colores tiñen toda la app y los PDF.
           En la maqueta la vista previa usa variables locales (--pr-p / --pr-s); NO toca los tokens de la app. -->
      <div class="pr-sep pr-a">
        <h3 class="pr-st">Paleta de colores</h3>
        <div class="pr-pals" role="group" aria-label="Paleta de colores">{pals}</div>
        <div class="pr-g">
          <div class="pr-f"><span>Color primario</span><div class="pr-color"><input type="color" value="#1a3a5c" data-c="p" aria-label="Color primario"><i class="pr-ip"></i><span data-h="hexp">#1a3a5c</span></div></div>
          <div class="pr-f"><span>Color secundario</span><div class="pr-color"><input type="color" value="#1e5fa8" data-c="s" aria-label="Color secundario"><i class="pr-is"></i><span data-h="hexs">#1e5fa8</span></div></div>
        </div>
        <div class="pr-f"><span>Vista previa en la app</span>
          <div class="pr-vapp" aria-hidden="true">
            <div class="pr-vnav"><span>{ic(I["inicio"], 14, 2)}Inicio</span><span>{ic(I["pac"], 14, 2)}Pacientes</span></div>
            <div class="pr-vder"><span class="pr-vbtn">{ic(I["palomita"], 14, 2.6)}Guardar</span><span class="pr-ay">El menú usa el primario; los botones, el secundario.</span></div>
          </div>
        </div>
        {papel() if vp != "esc" else ""}
      </div>''', '<span class="pr-a">Nombre, logo y colores. Los ve todo el equipo y salen en los documentos.</span>', tcls='pr-filas', aria='Clínica')

def fila_res(i, n, d, t, df):
    chip = '<span class="pr-chip pr-c-conf pr-c-plano pr-cdef"' + ('' if df else ' hidden') + '>Predeterminado</span>'
    return f'<li data-id="{i}"><span class="pr-pin">{ic(I["pin"], 18)}</span><div class="pr-ct"><div class="pr-cn"><b data-c="n">{n}</b>{chip}</div><span class="pr-cd pr-num" data-c="l">{d} · {t} · UTC-6</span></div></li>'

def resumen():
    return f'''<!-- Función 11: resumen de consultorios y de Google Calendar dentro de Datos, con enlaces a sus pestañas -->
    {grupo('Mis consultorios', 'pin', f"""
      <ul class="pr-res pr-cnovacio">{"".join(fila_res(*c) for c in CONS)}</ul>
      <!-- Con más de 3, debajo va el enlace «Ver N consultorios más» (misma pestaña). -->
      <p class="pr-nota pr-cvacio">No tienes consultorios activos. <a href="#" class="pr-p pr-txt pr-ir" data-ir="cons" style="display:inline-flex">Agrega el primero</a></p>""",
      '<span class="pr-num"><span data-h="cuenta">3</span> de 10 activos</span>',
      der=f'<a href="#" class="pr-p pr-txt pr-ir pr-cnovacio" data-ir="cons">Gestionar los <span data-h="cuenta">3</span>{ic(I["sig"], 13, 2.4)}</a>',
      aria='Mis consultorios (resumen)')}
    <section class="pr-tar pr-gres" aria-label="Google Calendar (resumen)">
      <span class="pr-gic">{ic(I["agenda"], 22)}</span>
      <div class="pr-th"><h2>Google Calendar</h2><p class="pr-sub"><span class="pr-a">Tus citas se sincronizan a un calendario que Spinus crea en tu cuenta.</span><span class="pr-i">La gestiona quien administra la clínica: es una para todo el equipo.</span></p></div>
      <div class="pr-gfin"><span class="pr-a">{gchips()}</span><a href="#" class="pr-p pr-txt pr-ir" data-ir="google">Abrir{ic(I["sig"], 13, 2.4)}</a></div>
    </section>'''

def gchips():
    return '<span class="pr-chip pr-c-neutro pr-goff">Sin conectar</span><span class="pr-chip pr-c-aten pr-gon">Conectado</span><span class="pr-chip pr-c-ag pr-gerr">Sin respuesta</span>'

def fila_cons(i, n, d, t, df):
    return f'''<li data-id="{i}" data-n="{n}" data-d="{d}" data-t="{t}" data-z="4"{" data-def" if df else ""}>
          <div class="pr-ci"><span class="pr-pin">{ic(I["pin"], 18)}</span>
            <div class="pr-ct"><div class="pr-cn"><b data-c="n">{n}</b><span class="pr-chip pr-c-conf pr-c-plano pr-cdef"{"" if df else " hidden"}>Predeterminado</span></div>
              <span class="pr-cd" data-c="d">{d}</span><span class="pr-cd pr-num" data-c="t">{t} · UTC-6</span></div></div>
          <div class="pr-cacc">
            <button type="button" class="pr-p pr-txt pr-c-def"{" hidden" if df else ""}>Hacer predeterminado</button>
            <button type="button" class="pr-p pr-txt pr-c-ed">{ic(I["pluma"], 15, 2)}Editar</button>
            <button type="button" class="pr-p pr-txt pr-rojo pr-c-el"{" disabled" if df else ""}>{ic(I["basura"], 15, 2)}Eliminar</button>
          </div>
          <p class="pr-cmot"{"" if df else " hidden"}>{ic(I["info"], 14, 2)}<span>Marca otro consultorio como predeterminado antes de borrar este.</span></p>
        </li>'''

NOTA_CONS = 'El consultorio predeterminado no se puede eliminar sin marcar otro antes. La zona horaria de cada consultorio es la que usan la agenda y los documentos que se emiten ahí.'
NOTA_G = 'Al desconectar, las citas dejan de escribirse en Google. Las que ya se crearon se quedan en tu calendario.'

def consultorios(vp):
    nota = '' if vp == 'esc' else f'<p class="pr-nota pr-suelta">{NOTA_CONS}</p>'
    return f'''<!-- Control SOLO de la maqueta -->
    <div class="pr-maq"><button type="button" class="pr-p pr-demo pr-demo-cl">Maqueta: cambiar lista (ahora: con consultorios)</button></div>
    <!-- Función 13: lista, «Agregar consultorio» (deshabilitado al llegar al tope de 10), vacío «No tienes consultorios activos». Estado de sistema: esqueleto de 3 filas. -->
    {grupo('Mis consultorios', 'pin', f"""
      <p class="pr-aviso pr-ctope">{ic(I["info"], 16, 2)}<span>Has llegado al máximo de 10 consultorios activos. Para crear otro, elimina uno antes.</span></p>
      <!-- Función 14: insignia «Predeterminado», «Hacer predeterminado», «Editar» (abre la MISMA hoja que «Agregar»).
           Función 15: «Eliminar»; cuando no se puede, el botón queda deshabilitado y el motivo se LEE debajo (antes solo vivía en el title). -->
      <ul class="pr-lc pr-cnovacio">
        {"".join(fila_cons(*c) for c in CONS)}
        <li class="pr-ctope"><p class="pr-nota">Maqueta: aquí seguirían los otros 7 consultorios.</p></li>
      </ul>
      <div class="pr-vacio pr-cvacio">{ic(I["pin"], 22)}<b>No tienes consultorios activos.</b><button type="button" class="pr-p pr-tonal pr-c-add">{ic(I["plus"], 18, 2.4)}Agregar el primero</button></div>""",
      '<span class="pr-num"><span data-h="cuenta">3</span> de 10 activos · el predeterminado es el que se abre al iniciar sesión.</span>',
      der=f'<button type="button" class="pr-p pr-tonal pr-c-add" aria-label="Agregar consultorio">{ic(I["plus"], 16, 2.4)}Agregar</button>')}
    {nota}'''

AVISO_G = 'No se pudo conectar: en la pantalla de Google quedó sin marcar el permiso para crear y administrar su propio calendario. Spinus guarda tus citas en un calendario aparte que él mismo crea, así que sin ese permiso no puede sincronizar nada. Vuelve a intentarlo y deja la casilla marcada.'

def google(vp):
    nota = '' if vp == 'esc' else f'<p class="pr-nota pr-suelta pr-a pr-gon">{NOTA_G}</p>'
    return f'''<!-- Control SOLO de la maqueta: no se simula ninguna conexión real -->
    <div class="pr-maq pr-a"><button type="button" class="pr-p pr-demo pr-demo-g">Maqueta: cambiar estado (ahora: sin conectar)</button></div>
    <!-- Función 16: conectar, estado y cuenta, «Recrear calendario» (con confirmación), «Desconectar»; para no admin, solo el mensaje.
         Estado de sistema «comprobando»: el chip es un esqueleto y no se enseñan acciones. -->
    <section class="pr-tar pr-a" aria-label="Google Calendar">
      <div class="pr-tcab" style="align-items:center"><span class="pr-gic">{ic(I["agenda"], 22)}</span>
        <div class="pr-th"><div class="pr-ghl"><h2>Google Calendar</h2>{gchips()}</div><p class="pr-sub"><span class="pr-goff">Conecta una cuenta para sincronizar tus citas.</span><span class="pr-gon">Sincronización activa: las citas se crean automáticamente.</span><span class="pr-gerr">No se pudo comprobar la conexión.</span></p></div></div>
      <div class="pr-gerr pr-vacio">{ic(I["sinred"], 22)}<span>Google no respondió. Tu conexión sigue guardada; no hace falta que la rehagas.</span><button type="button" class="pr-p pr-tonal pr-g-reint">{ic(I["refresca"], 16, 2)}Reintentar</button></div>
      <div class="pr-gnoerr">
        <div class="pr-dato"><span class="pr-sub">Calendario</span><b><span class="pr-goff">—</span><span class="pr-gon">Spinus - Dr. Admin Semilla</span></b></div>
        <div class="pr-dato"><span class="pr-sub">Cuenta de Google</span><b><span class="pr-goff">—</span><span class="pr-gon">admin@semilla.spinus.test</span></b></div>
        <p class="pr-nota">Puede ser una cuenta distinta a la que usas para entrar en Spinus.</p>
      </div>
      <p class="pr-bloque pr-goff">Al conectar una cuenta de Google, Spinus creará en ella un calendario propio llamado <b>Spinus - Dr. Admin Semilla</b> y escribirá ahí tus citas automáticamente. Puede ser una cuenta distinta a la que usas para entrar en Spinus.</p>
      <p class="pr-bloque pr-gon">Tus citas se sincronizan al calendario <b>Spinus - Dr. Admin Semilla</b> de <b>admin@semilla.spinus.test</b>. No lo borres <b>ni lo quites de tu lista de calendarios</b>: si desaparece de tu lista, Spinus sigue escribiendo en él y tú dejas de verlo. Si ya te pasó, usa «Recrear calendario».</p>
      <!-- Función 17: ?gcal_error= muestra aquí, dentro de la tarjeta y sin quitar «Conectar», el motivo del fallo (6 textos; se dibuja «permiso_calendario»). -->
      <p class="pr-aviso pr-mal pr-gav" role="alert">{ic(I["alerta"], 16, 2)}<span>{AVISO_G}</span></p>
      <!-- «Conectar» lleva a Google en la app; en la maqueta solo muestra el estado de pulsación. -->
      <div class="pr-btns pr-apila pr-goff"><button type="button" class="pr-p pr-prim pr-g-con">{ic(I["entrar"], 18, 2)}Conectar</button></div>
      <div class="pr-btns pr-apila pr-gon"><button type="button" class="pr-p pr-tonal pr-g-rec">{ic(I["refresca"], 16, 2)}Recrear calendario</button><button type="button" class="pr-p pr-pel pr-g-des">{ic(I["salir"], 16, 2)}Desconectar</button></div>
    </section>
    {nota}
    <section class="pr-tar pr-i" aria-label="Google Calendar">
      <div class="pr-tcab" style="align-items:center"><span class="pr-gic">{ic(I["agenda"], 22)}</span>
        <div class="pr-th"><h2>Google Calendar</h2><p class="pr-sub">La conexión es una por clínica y da servicio a todo el equipo.</p></div></div>
      <p class="pr-bloque">La gestiona quien administra la clínica: es una para todo el equipo, así que tus citas se sincronizan sin que tengas que conectar nada.</p>
    </section>'''

def ajustes():
    filas = f"""<ul class="pr-aj">
        <!-- A0-9: Modo claro / oscuro. En la maqueta el interruptor solo cambia su propio estado; el tema se prueba con los botones «Claro / Oscuro» de la página. -->
        <li><button type="button" role="switch" aria-checked="false" class="pr-ajf pr-sw-b">{ic(I["luna"], 20)}<span class="pr-flex">Modo oscuro</span><span class="pr-sw" aria-hidden="true"></span></button></li>
        <!-- A0-12: Aviso de Privacidad (pestaña nueva) -->
        <li><a href="#" class="pr-p pr-ajf">{ic(I["escudo"], 20)}<span class="pr-flex">Aviso de privacidad<small>Se abre en una pestaña nueva</small></span>{ic(I["externo"], 18, 1.8, ' style="color:var(--tinta3)"')}</a></li>
        <!-- A0-10: Cerrar sesión -->
        <li><button type="button" class="pr-p pr-ajf pr-rojo">{ic(I["salir"], 20)}<span class="pr-flex">Cerrar sesión</span></button></li>
      </ul>"""
    return f'''<!-- Grupo «Ajustes» APROBADO por el dueño (CALMA §23.11): Modo oscuro, Aviso de privacidad y Cerrar sesión también aquí. -->
    {grupo('Ajustes', 'engrane', filas, cls='pr-ajs', tcls='pr-ajt')}'''

def lado():
    return f'''<aside class="pr-lado">
      <div class="pr-panel" data-panel="datos">
        {identidad()}
        <section class="pr-tar pr-a" aria-label="Vista previa del encabezado en PDF">{papel()}</section>
      </div>
      <div class="pr-panel" data-panel="cons" hidden><section class="pr-tar"><div class="pr-th"><h2>Cómo funcionan</h2></div><p class="pr-nota">{NOTA_CONS}</p></section></div>
      <div class="pr-panel" data-panel="google" hidden><section class="pr-tar pr-a pr-gon"><div class="pr-th"><h2>Al desconectar</h2></div><p class="pr-nota">{NOTA_G}</p></section>
        <section class="pr-tar"><div class="pr-th"><h2>Una conexión por clínica</h2></div><p class="pr-nota">La conexión es una por clínica y da servicio a todo el equipo.</p></section></div>
    </aside>'''

def cont(vp):
    return f'''<main class="pr-cont">
  {cab(vp)}
  {tabs()}
  <div class="pr-cuerpo">
   <div class="pr-col">
    <div class="pr-panel" data-panel="datos" role="tabpanel" aria-label="Datos">
    {identidad() if vp != "esc" else ""}
    {datos_prof()}
    {firma()}
    {clinica(vp)}
    {resumen()}
    </div>
    <div class="pr-panel" data-panel="cons" role="tabpanel" aria-label="Consultorios" hidden>
    {consultorios(vp)}
    </div>
    <div class="pr-panel" data-panel="google" role="tabpanel" aria-label="Google Calendar" hidden>
    {google(vp)}
    </div>
    {ajustes()}
   </div>
   {lado() if vp == "esc" else ""}
  </div>
  <!-- Función 18: el asistente de bienvenida (OnboardingGuide) sigue montado en esta pantalla como capa flotante global; su ancla data-onboard="subir-logo" se conserva en el botón del logo. -->
</main>'''

def barra():
    return f'''<!-- Función 12: barra de guardado fija. Solo aparece si hay cambios (entra y sale deslizándose). Dice en qué secciones hay cambios.
     «Guardar» es el único primario de la pantalla. Avisos al guardar (arriba, centrados): «Cambios guardados correctamente»; guardado parcial:
     «Se guardó parte de los cambios. NO se pudo guardar …; lo demás sí quedó guardado.»; fallo total: «No se pudo guardar …». Mientras guarda: «Guardando…» / «Subiendo logo…».
     Respeta el indicador inferior (--ib) y en Duo cerrado termina antes del riel. -->
<div class="pr-barra" role="region" aria-label="Cambios sin guardar">
  <div class="pr-bm"><b class="pr-bt">Tienes cambios sin guardar.</b><span>La firma se guarda sola al capturarla: «Descartar» no la revierte.</span></div>
  <div class="pr-bb"><button type="button" class="pr-p pr-quieto pr-b-desc">Descartar</button><button type="button" class="pr-p pr-prim pr-b-guar">{ic(I["palomita"], 18, 2.4)}Guardar</button></div>
</div>'''

def capas(vp):
    zs = ''.join(f'<option value="{i}"{" selected" if i == 4 else ""}>{z}</option>' for i, z in enumerate(ZONAS))
    return f'''<div class="pr-toast" role="status" aria-live="polite"><span></span></div>
<!-- HOJA ÚNICA de consultorio: la misma para «Agregar» y «Editar» (hoy uno es modal y el otro formulario en línea). Hoja desde abajo en teléfono; modal centrado en ancho
     (en Duo abierto, sobre la mitad izquierda). Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y salir.
     En la app será un resorte (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<div class="pr-capa" data-capa="cons" aria-hidden="true">
  <div class="pr-velo"></div>
  <form class="pr-hoja" role="dialog" aria-modal="true" aria-label="Agregar consultorio" novalidate>
    <span class="pr-asa" aria-hidden="true"></span>
    <div class="pr-hjcab"><h2 class="pr-hj-t">Agregar consultorio</h2><button type="button" class="pr-p pr-ib pr-cierra" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
    <div class="pr-filas pr-hfil">
    <label class="pr-f"><span>Nombre del consultorio<i aria-hidden="true"> *</i></span><input type="text" class="pr-in pr-h-n" placeholder="Ej: Consultorio Centro" autocomplete="off"></label>
    <label class="pr-f pr-h-cw" hidden><span>Nombre corto<i aria-hidden="true"> *</i></span><input type="text" class="pr-in pr-h-c" maxlength="12" placeholder="Ej: Centro" autocomplete="off"><span class="pr-ay">Máx. 12 caracteres. Es el que se ve en el menú y en la agenda.</span></label>
    <label class="pr-f"><span>Dirección<i aria-hidden="true"> *</i></span><input type="text" class="pr-in pr-h-d" placeholder="Ej: Calle 60 #400, Mérida, Yucatán" autocomplete="off"></label>
    <label class="pr-f"><span>Teléfono</span><input type="tel" class="pr-in pr-h-t pr-num" placeholder="Ej: 999 123 4567" autocomplete="off"></label>
    <div class="pr-f"><span>Zona horaria<i aria-hidden="true"> *</i></span>
      <div class="pr-chips" role="group" aria-label="Zonas frecuentes"><button type="button" class="pr-p pr-zc pr-toq" data-z="3">Centro (UTC-6)</button><button type="button" class="pr-p pr-zc pr-toq" data-z="11">Cancún (UTC-5)</button><button type="button" class="pr-p pr-zc pr-toq" data-z="0">Tijuana (UTC-8)</button></div>
      <span class="pr-sel"><select class="pr-in pr-h-z" aria-label="Zona horaria"><option value="">— Selecciona tu zona —</option>{zs}</select>{ic(I["abajo"], 16, 2.2)}</span></div>
    </div>
    <!-- Errores del servidor («No se pudo actualizar el consultorio.», «Error de red. Verifica tu conexión.») se muestran aquí, sobre los botones. -->
    <div class="pr-hbt"><button type="button" class="pr-p pr-quieto pr-cierra">Cancelar</button>
      <!-- Dentro del diálogo modal este es el botón de confirmación; la pantalla de fondo queda velada. -->
      <button type="submit" class="pr-p pr-prim pr-h-ok" aria-disabled="true">Guardar consultorio</button></div>
  </form>
</div>
<!-- ALERTA: borrar consultorio (irreversible). Función 15: ofrece «Editar en lugar». -->
<div class="pr-capa" data-capa="borrar" aria-hidden="true">
  <div class="pr-velo"></div>
  <div class="pr-alerta" role="alertdialog" aria-modal="true" aria-label="Borrar consultorio">
    <!-- Hoy son tres acciones con rótulos de dos palabras: van apiladas a todo el ancho, la principal arriba (CALMA §13). -->
    <span class="pr-aic pr-aic-mal" aria-hidden="true">{ic(I["basura"], 28, 1.9)}</span>
    <h2 class="pr-atit">Borrar consultorio</h2>
    <p class="pr-atx pr-atc">¿Estás seguro de que quieres borrar este consultorio?</p>
    <div class="pr-bloque pr-abloq"><b class="pr-b-n">Hosp Norte</b><span class="pr-b-d">Avenida Ficticia 2, Norte, Mérida</span><span class="pr-b-t pr-num">999 000 0002</span></div>
    <p class="pr-atx">Las citas y consultas pasadas se conservan, pero el consultorio ya no estará disponible para nuevas citas. Esta acción no es reversible desde la app.</p>
    <div class="pr-abt pr-apil"><button type="button" class="pr-p pr-pel pr-b-si">Sí, borrar</button><button type="button" class="pr-p pr-tonal pr-b-ed">Editar en lugar</button><button type="button" class="pr-p pr-quieto pr-cierra">Cancelar</button></div>
  </div>
</div>
<!-- ALERTA: recrear calendario de Google (borra el calendario actual y sus eventos). -->
<div class="pr-capa" data-capa="recrear" aria-hidden="true">
  <div class="pr-velo"></div>
  <div class="pr-alerta" role="alertdialog" aria-modal="true" aria-label="Recrear calendario">
    <span class="pr-aic pr-aic-av" aria-hidden="true">{ic(I["alerta"], 28, 1.9)}</span>
    <h2 class="pr-atit">Recrear calendario</h2>
    <p class="pr-atx pr-atc">Se creará un calendario de Spinus nuevo en tu cuenta de Google.</p>
    <p class="pr-aviso pr-mal pr-atx">SE BORRA EL CALENDARIO ACTUAL Y TODOS LOS EVENTOS QUE CONTENGA. Tus citas de Spinus NO se borran, pero las que ya existían dejarán de aparecer en Google: sólo se sincronizarán de aquí en adelante.</p>
    <p class="pr-atx pr-atc">¿Continuar?</p>
    <!-- Dos botones parejos, lado a lado: secundario a la izquierda, principal a la derecha -->
    <div class="pr-abt pr-par"><button type="button" class="pr-p pr-quieto pr-cierra">Cancelar</button><button type="button" class="pr-p pr-pel pr-r-si">Sí, recrear</button></div>
  </div>
</div>'''

def con_iv(css):
    # Pasada de unificación: toda regla escrita para Duo abierto horizontal se copia también para el vertical (data-vp="iv");
    # lo que en iv debe ser distinto (táctil ≥ 44, encabezado, capas) se reescribe en tmp-pr-u8.css, que va después.
    def sel(m):
        partes, prof, cur = [], 0, ''
        for ch in m.group(1):
            prof += ch == '(' ; prof -= ch == ')'
            if ch == ',' and prof == 0: partes.append(cur); cur = ''
            else: cur += ch
        partes.append(cur)
        extra = [x.replace('[data-vp="ih"]', '[data-vp="iv"]') for x in partes if '[data-vp="ih"]' in x]
        return ','.join(partes + extra) + '{' + m.group(2) + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', sel, css)

BASE = ''.join(l for l in open(f'{L}/tmp-pr-base.css') if 'vbus' not in l and 'vform' not in l)
seen = set(); BASE = '\n'.join(l for l in BASE.split('\n') if not (l in seen or seen.add(l))) + '\n'
CSS = con_iv(BASE + open(f'{L}/tmp-pr-estilo.css').read()) + open(f'{L}/tmp-pr-u8.css').read()
JS = open(f'{L}/tmp-pr-guion.js').read()

def marco(vp):
    if vp == 'ext':
        app = cont(vp) + riel()
    elif vp == 'tel':
        app = encabezado() + cont(vp)
    elif vp == 'ih':
        app = cont(vp) + lateral()
    elif vp == 'iv':
        app = encabezado_v() + cont(vp)
    else:
        app = lateral() + cont(vp)
    return f'<div class="marco pr" lang="es" data-vp="{vp}" data-tab="datos" data-g="off" data-cl="n">\n<div class="pr-app">\n{app}\n</div>\n{barra()}\n{capas(vp)}\n</div>'

out = ('<!-- NOMBRE: Mi perfil | Pasada de unificación: grupos con rótulo de color y campos como filas de lista, columna y apoyo centrados en computadora, quinto marco (Duo abierto vertical), alertas con el patrón único y controles de maqueta fuera del teléfono -->\n'
       '<style>\n' + CSS + '</style>\n' + '\n'.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '\n<script>\n' + JS + '</script>\n')
open(f'{L}/vista-perfil.html', 'w').write(out)
print(len(out))
