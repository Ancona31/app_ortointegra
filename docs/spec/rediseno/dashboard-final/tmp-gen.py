# Generador de vista-dashboard.html (dashboard FINAL, «Lo que sigue»; los cuatro marcos comparten piezas). Uso: python3 tmp-gen.py
import os
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8, extra=''):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}>{d}</svg>'

FOLDER = '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'
I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    agendar='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    docmas='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11.5v6M9 14.5h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    lupa='<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    perfil='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    esteto='<path d="M5 3.5V8a4.5 4.5 0 0 0 9 0V3.5M9.5 12.5V15a5 5 0 0 0 10 0v-1.5"/><circle cx="19.5" cy="11.5" r="2"/>',
    nuevo='<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6"/>',
    sinpac='<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M16 15.5l4.5 4.5M20.5 15.5 16 20"/>',
    enlace='<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    folder=FOLDER,
    palomita='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    receta='<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    laboratorio='<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>',
    escrito='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    # CALMA §24.4: iconos de estado de cita
    doble='<path d="m2.5 12.5 4 4L15 8"/><path d="m11.5 16 .5.5L21.5 8"/>',
    calreloj='<path d="M20 10.5V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5"/><path d="M4 10h16M8 3v4M16 3v4"/><circle cx="17" cy="17" r="4.5"/><path d="M17 15v2.2l1.5 1"/>',
    noasistio='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M4 4l16 16"/>',
    confirmar='<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8 5.2-5.6"/>',
    cancelar='<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
)
SINEXP = ic(FOLDER, 14, 2, ' stroke-dasharray="2.6 2.6"')

def gcal(s=15):
    # Icono multicolor de Google Calendar (CALMA §24.5), dibujo propio simplificado, sin recursos externos.
    return (f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" class="db-gcal">'
            '<rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#4285F4"/>'
            '<path d="M17 7h4.5v10H17z" fill="#FBBC04"/><path d="M7 17h10v4.5H7z" fill="#34A853"/>'
            '<path d="M2.5 17H7v4.5H6A3.5 3.5 0 0 1 2.5 18z" fill="#188038"/><path d="M17 17h4.5L17 21.5z" fill="#EA4335"/>'
            '<rect x="7" y="7" width="10" height="10" fill="#fff"/>'
            '<path d="M9.6 10.2h2.2l-1.2 1.4c.9 0 1.4.5 1.4 1.2s-.6 1.2-1.4 1.2c-.5 0-.9-.2-1.1-.5M13.6 10.6l1-.5v4.2" fill="none" stroke="#4285F4" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# CALMA §24.4: estado como icono en círculo de color. Solo existen hoy en esta lista Agendada y Confirmada
# (StatusChip.tsx:23-26: las consultas filtran .in('status', ['scheduled','confirmed'])); los otros tres no llegan aquí.
EST = dict(ag=('Agendada', 'calreloj'), conf=('Confirmada', 'palomita'), canc=('Cancelada', 'x'), noas=('No asistió', 'noasistio'), aten=('Atendida', 'doble'))

def est(k, texto=True):
    t, i = EST[k]
    c = f'<span class="db-est-c">{ic(I[i], 15, 2.2)}</span>'
    if texto:
        return f'<span class="db-est db-est-{k}">{c}<span class="db-est-t">{t}</span></span>'
    return f'<span class="db-est db-est-{k}" role="img" aria-label="{t}">{c}</span>'

# CALMA §24.5: origen de la cita (texto de hoy «Reservó por enlace», BloqueReservaPorLigar.tsx:108; Google: texto nuevo aprobado)
def origen(o, corto=False):
    if o == 'enlace':
        return f'<span class="db-marca db-ori">{ic(I["enlace"], 14, 2)}Reservó por enlace</span>'
    if o == 'google':
        return f'<span class="db-marca db-ori">{gcal(15)}{"Desde Google Calendar" if corto else "Agendada desde Google Calendar"}</span>'
    return ''

def marca(s=24):
    return f'<span class="db-logo">{ic(I["logo"], s, 1.8)}<span class="db-logo-n">Spinus</span></span>'

PLAN = '''<!-- TRAÍDO DEL LANZADOR: chip del plan. En plan gratuito este mismo lugar lo ocupa el enlace «Actualizar» (a planes):
     <a href="#" class="db-p db-plan db-plan-act">Actualizar</a> -->
<span class="db-plan db-m">Plan VIP</span>'''

def fecha(mes, dia):
    return f'<div class="db-fecha" aria-hidden="true"><span class="db-mes">{mes}</span><span class="db-dia">{dia}</span></div>'

def cab(vp):
    av = '<span class="db-flex"></span><button type="button" class="db-p db-avn" aria-label="Mi perfil"><span class="db-m">AS</span><span class="db-s">SE</span></button>' if vp == 'ext' else ''
    plan = PLAN if vp in ('ext', 'tel', 'iv') else ''
    return f'''<header class="db-cab">
    <div class="db-sal">
      <!-- Función 2: consultorio activo junto al saludo (la secretaria ve el nombre de la clínica) -->
      <div class="db-sup"><span class="db-rot db-m">Centro</span><span class="db-rot db-s">Clínica Semilla A</span>{plan}{av}</div>
      <!-- Función 3: saludo con primer nombre -->
      <!-- Saludo: saludo() + primer nombre, profile.nombres.split(' ')[0] (dashboard/page.tsx:32-36,78,120; AsistenteDashboard.tsx:14-18,38,83).
           Nunca se trunca ni encoge: si no cabe, parte en dos líneas SOLO por la coma («Buenas tardes,» / nombre). -->
      <h1><span class="db-m"><span class="db-nw">Buenas tardes,</span> <span class="db-nw db-nomsal">Admin</span></span><span class="db-s"><span class="db-nw">Buenas tardes,</span> <span class="db-nw">Secretaria</span></span></h1>
      <!-- Frase del día («Tus pacientes te esperan») retirada de toda la app por decisión del dueño (CALMA §20). -->
    </div>
  </header>'''

def hoy():
    dias = [('L', 16), ('M', 17), ('M', 18), ('J', 19), ('V', 20), ('S', 21), ('D', 22)]
    nom = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
    CUR = ' aria-current="date"'
    sem = ''.join(
        f'<li{CUR if n == 19 else ""}><span class="db-sl" aria-hidden="true">{l}</span><span class="db-sn" aria-label="{nom[i]} {n}">{n}</span></li>'
        for i, (l, n) in enumerate(dias))
    return f'''<section class="db-hoy" aria-label="Hoy">
    <!-- Función 17: la tarjeta «Hoy» se funde con la cabecera: día de la semana, número, mes y año, conteo, tira de la semana y «Abrir agenda». Sin tarjeta propia. -->
    <div class="db-hoy-t">
      <span class="db-hoy-f">Jueves 19 de noviembre de 2026</span>
      <span class="db-hoy-c"><span class="db-m db-v1">6 citas · 1 evento</span><span class="db-m db-v0">0 citas · 0 eventos</span><span class="db-s">11 citas · 2 eventos<span class="db-ancho"> en la clínica</span></span></span>
    </div>
    <a href="#" class="db-p db-enl db-hoy-a">Abrir agenda{ic(I["sig"], 13, 2.4)}</a>
    <ol class="db-sem" aria-label="Esta semana">{sem}</ol>
  </section>'''

def hero():
    return f'''<section class="db-hero db-v1" aria-label="Lo que sigue">
    <!-- PIEZA PRINCIPAL. Funciones 10, 12 y 13 para la cita EN CURSO (o la siguiente): chip de fecha, paciente, hora, consultorio, médico, estado,
         el ÚNICO botón primario de la pantalla y el botón-icono de expediente. Lleva integrado el avance del día. -->
    <!-- ESTADOS DE SISTEMA de la pieza principal (no se dibujan; van EN ESTE MISMO HUECO, con la misma altura para que nada salte):
         · CARGANDO: la tarjeta conserva su tamaño; dentro, caja de fecha 52×50 y dos barras (60 % y 40 % de ancho, 12 px de alto, radio 6) en var(--sup2);
           el botón primario se dibuja como bloque var(--sup2) de 48 de alto. Entra y sale con fundido de 200 ms; sin brillo en bucle.
         · ERROR: mismo hueco; texto «No se pudo cargar tu siguiente cita.» (13, var(--tinta2)) y botón tonal «Reintentar» (clase db-sec2). -->
    <div class="db-hcab">
      <span class="db-encurso"><span class="db-pt"></span>En curso</span>
      <span class="db-avance">4 de 6 · siguiente a las <span class="db-num">18:30</span></span>
    </div>
    <div class="db-segs" role="img" aria-label="Avance del día: vas en la cita 4 de 6"><span class="db-h"></span><span class="db-h"></span><span class="db-h"></span><span class="db-a"></span><span></span><span></span></div>
    <div class="db-hfila">
      {fecha("NOV", 19)}
      <div class="db-quien">
        <span class="db-hnom">Paciente Prueba 07</span>
        <span class="db-det"><span class="db-nw"><span class="db-num">17:00</span> · Centro</span><span class="db-nw db-med">Dr. Admin Semilla</span>{est("ag")}</span>
      </div>
      <div class="db-haccs">
        <button type="button" class="db-p db-prim">{ic(I["esteto"], 18, 2)}Iniciar consulta</button>
        <button type="button" class="db-p db-ico db-ico-g" aria-label="Expediente de Paciente Prueba 07">{ic(FOLDER, 20)}</button>
      </div>
    </div>
  </section>
  <!-- VARIANTE «DÍA SIN CITAS» (función 16, estado vacío): la pieza principal no queda vacía. El primario pasa a ser «Nueva consulta»
       y se ofrece «Abrir agenda». La lista «Después» se retira y el botón tonal «Nueva consulta» también, para no repetirlo. -->
  <section class="db-hero db-v0" aria-label="Lo que sigue">
    <div class="db-hcab"><span class="db-encurso db-neutro">Hoy</span><span class="db-avance">No hay citas próximas</span></div>
    <div class="db-hfila">
      {fecha("NOV", 19)}
      <div class="db-quien">
        <span class="db-hnom">Sin citas hoy</span>
        <span class="db-det">Tu agenda está libre. Puedes atender sin cita.</span>
      </div>
      <div class="db-haccs">
        <button type="button" class="db-p db-prim" data-abre="con" aria-label="Nueva consulta">{ic(I["plus"], 18, 2.4)}<span class="db-rl">Nueva consulta</span><span class="db-rc">Consulta</span></button>
        <a href="#" class="db-p db-sec2">Abrir agenda</a>
      </div>
    </div>
  </section>'''

def campo(vp):
    kbd = '<kbd class="db-kbd" aria-hidden="true">⌘K</kbd>' if vp in ('ih', 'esc') else ''
    return f'''<!-- Función 4: «Buscar paciente o folio» abre el buscador global. La pista ⌘K solo en Duo abierto y computadora. -->
    <label class="db-campo">{ic(I["lupa"], 18, 2)}<input type="search" class="db-global" placeholder="Buscar paciente o folio" aria-label="Buscar paciente o folio" autocomplete="off">{kbd}</label>'''

def herr(vp):
    return f'''<div class="db-herr">
    {campo(vp)}
    <!-- Funciones 5–8: acciones secundarias. «Nueva consulta» es tonal: el primario de la pantalla es «Iniciar consulta».
         Duo cerrado: tres botones compactos («+ Documento», «+ Paciente», «Expedientes»); «Nueva consulta» es el «+» del riel. -->
    <nav class="db-acc" aria-label="Acciones">
      <button type="button" class="db-p db-ab db-ab-t db-a-con db-v1" data-abre="con">{ic(I["plus"], 18, 2.2)}Nueva consulta</button>
      <!-- Duo cerrado (CALMA §17): «+ Documento», «+ Paciente»; el aria-label conserva el rótulo completo -->
      <button type="button" class="db-p db-ab db-a-doc" data-abre="doc" aria-label="Nuevo documento"><span class="db-ic-l">{ic(I["docmas"], 18, 1.9)}</span><span class="db-ic-c">{ic(I["plus"], 16, 2.4)}</span><span class="db-rl">Nuevo documento</span><span class="db-rc">Documento</span></button>
      <a href="#" class="db-p db-ab db-a-pac" aria-label="Nuevo paciente"><span class="db-ic-l">{ic(I["nuevo"], 18, 1.9)}</span><span class="db-ic-c">{ic(I["plus"], 16, 2.4)}</span><span class="db-rl">Nuevo paciente</span><span class="db-rc">Paciente</span></a>
      <a href="#" class="db-p db-ab db-a-exp">{ic(FOLDER, 18, 1.9)}<span>Expedientes</span></a>
    </nav>
  </div>'''

def tcab(titulo, enlace='Ver agenda'):
    # Función 9: «Estados» es solo LEYENDA de los 5 estados (ProximasCitas.tsx:149-179, mismos textos y orden), ahora con los iconos en círculo.
    # Menú que nace del botón, sin velo (en todos los marcos); se cierra con Esc, al tocar fuera o con el mismo botón.
    ley = ''.join(f'<li>{est(k)}</li>' for k in ('ag', 'conf', 'canc', 'noas', 'aten'))
    return f'''<div class="db-tcab">
      <h2>{titulo}</h2>
      <div class="db-estw"><button type="button" class="db-p db-est-b" aria-expanded="false" aria-haspopup="true">Estados{ic(I["abajo"], 13, 2.4)}</button>
        <ul class="db-ley" aria-label="Estados de una cita">{ley}</ul></div>
      <!-- Función 15: «Ver agenda» -->
      <a href="#" class="db-p db-enl">{enlace}{ic(I["sig"], 13, 2.4)}</a>
    </div>'''

def fila(vp, mes, dia, nom, hora, fin, dlargo, med, estado, ori='', sinexp=False, sec=False):
    # CALMA §24: la fila ENTERA es pulsable (sin «Iniciar» ni carpeta). Médico: abre la hoja de acciones de la cita.
    # Secretaria: es el enlace «Ver cita» → /agenda de hoy (AsistenteDashboard.tsx:129-140), sin hoja.
    ancho = vp in ('ih', 'iv', 'esc')
    medl = f'<span class="db-fmed">{med}</span>'
    linea = f'<span class="db-linea"><span class="db-num db-nw">{hora}</span><span class="db-pto db-fmed1">{med}</span></span>'
    if vp == 'iv':   # columna estrecha: el estado (icono + texto) va en la línea de la hora y el médico baja
        linea = f'<span class="db-linea"><span class="db-num db-nw">{hora}</span>{est(estado)}</span><span class="db-linea">{medl}</span>'
    elif vp == 'ext' and sec:  # Duo cerrado, secretaria: el médico (que aquí distingue la cita) en su propia línea
        linea = f'<span class="db-linea"><span class="db-num db-nw">{hora}</span></span><span class="db-linea">{medl}</span>'
    sx = f'<span class="db-marca db-sx">{SINEXP}Sin expediente</span>' if sinexp else ''
    if vp == 'ext' and not sec:
        # Duo cerrado, médico: sin el nombre del médico en la fila (todas son suyas; la app solo lo pinta en la vista de la
        # clínica, ProximasCitas.tsx:609) — sigue en la hoja. «Sin expediente» sube a la línea de la hora.
        linea = f'<span class="db-linea"><span class="db-num db-nw">{hora}</span>{"<span class=db-pto2 aria-hidden=true>·</span>" + sx if sx else ""}</span>'
        sx = ''
    marcas = origen(ori, corto=(vp == 'ext'))
    if vp in ('ih', 'esc') and marcas and sx:
        marcas = f'<span class="db-marcas">{marcas}{sx}</span>'
    else:
        marcas = marcas + sx
    derecha = '' if vp == 'iv' else est(estado, texto=ancho)
    cuerpo = f'{fecha(mes, dia)}<span class="db-fc"><span class="db-nom">{nom}</span>{linea}{marcas}</span>{derecha}{ic(I["sig"], 16, 2.2)}'
    nest = EST[estado][0]
    extra = (' · ' + ('Reservó por enlace' if ori == 'enlace' else 'Agendada desde Google Calendar')) if ori else ''
    extra += ' · Sin expediente' if sinexp else ''
    if sec:
        return f'''<li class="db-fila"><a href="#" class="db-p db-fbtn" aria-label="Ver cita de {nom}, {hora}, {nest}{extra}">{cuerpo}</a></li>'''
    return f'''<li class="db-fila"><button type="button" class="db-p db-fbtn" aria-haspopup="dialog" aria-label="{nom}, {hora}, {nest}{extra}. Acciones de la cita"
        data-nom="{nom}" data-mes="{mes}" data-dia="{dia}" data-cuando="{dlargo} · {hora} – {fin}" data-med="{med} · Centro" data-est="{estado}" data-ori="{ori}" data-sx="{1 if sinexp else 0}" data-pa="{1 if (sinexp and ori == 'google') else 0}" data-lig="1">{cuerpo}</button></li>'''

def despues(vp):
    DR = 'Dr. Admin Semilla'
    J, V, L = 'Jue 19 nov', 'Vie 20 nov', 'Lun 23 nov'  # formato de cuandoDeTarjeta (accionesTarjeta.ts:332-348)
    return f'''<section class="db-tar db-desp db-v1" aria-label="Después">
    {tcab("Después")}
    <!-- Funciones 10–14 (CALMA §24). Semilla: un origen de cada tipo con expediente (12 por enlace, 15 desde Google Calendar)
         y uno de cada tipo sin expediente (21 por enlace; «Pendiente administrativo», evento de Google sin paciente ligado,
         que se trata como una cita sin expediente más, §24.7). Al tocar la fila se abre la hoja de acciones de la cita. -->
    <ul class="db-filas">
      {fila(vp, "NOV", 19, "Paciente Prueba 12", "18:30", "19:00", J, DR, "conf", "enlace")}
      {fila(vp, "NOV", 20, "Paciente Prueba 15", "08:00", "08:30", V, DR, "ag", "google")}
      {fila(vp, "NOV", 20, "Paciente Prueba 21", "09:00", "09:30", V, DR, "ag", "enlace", sinexp=True)}
      {fila(vp, "NOV", 23, "Pendiente administrativo", "10:00", "11:00", L, DR, "ag", "google", sinexp=True)}
    </ul>
    <p class="db-pie">No hay más citas próximas</p>
    <!-- ESTADOS DE SISTEMA de «Después» (función 16; no se dibujan). Van EN EL LUGAR DE <ul class="db-filas">, con la cabecera de la tarjeta en su sitio:
         · CARGANDO: tres filas esqueleto de la misma altura que una fila real (caja de fecha 52×50 + barra de 55 % y barra de 35 %, 12 px de alto,
           radio 6, todo en var(--sup2)); sin pie. Fundido de entrada y de salida de 200 ms (solo opacity); sin brillo en bucle.
         · ERROR: un bloque centrado, padding 20px 0:
             <div class="db-err"><p class="db-dsub">No se pudieron cargar las citas.</p>
               <button type="button" class="db-p db-pil db-toq">Reintentar</button></div>
           «Reintentar» es tonal (píldora de 36 con área de 44), nunca primario. «Ver agenda» sigue disponible en la cabecera.
         · VACÍO: es la variante «día sin citas» de arriba (la tarjeta se retira y la pieza principal ofrece «Abrir agenda»). -->
  </section>'''

AV = {'01': ('#F1DCEC', '#7A2E6B'), '03': ('#F1DCEC', '#7A2E6B'), '05': ('#F6D8D1', '#8A2F1F'), '07': ('#EBDCCB', '#5A3A1A'),
      '11': ('#D7E8DC', '#1F5A3A'), '12': ('#D7E8DC', '#1F5A3A'), '18': ('#DCE6F7', '#1F3F7A'), '23': ('#F6D8D1', '#8A2F1F'),
      '24': ('#EBDCCB', '#5A3A1A'), '25': ('#DCE6F7', '#1F3F7A'), '22': ('#F1DCEC', '#7A2E6B'), '20': ('#D7E8DC', '#1F5A3A')}

def av(n):
    bg, fg = AV[n]
    return f'<span class="db-avt" style="background:{bg};color:{fg}" aria-hidden="true">{n}</span>'

def atendidos():
    datos = [('03', 'Lumbago', 'hace 1 h'), ('11', 'Gonalgia', 'hace 3 h'), ('18', 'Cervicalgia', 'ayer'), ('05', 'Tendinitis', 'hace 2 días')]
    its = ''.join(f'''<li class="db-atc">
        <a href="#" class="db-p db-atq">{av(n)}<span class="db-doc-t"><span class="db-nom">Paciente Prueba {n}</span><span class="db-dsub">{d} · {t}</span></span></a>
        <div class="db-atb"><button type="button" class="db-p db-et" aria-label="Receta de Paciente Prueba {n}">{ic(I["receta"], 14, 2)}Receta</button><button type="button" class="db-p db-et" aria-label="Nota de Paciente Prueba {n}">{ic(I["docs"], 14, 2)}Nota</button></div>
      </li>''' for n, d, t in datos)
    return f'''<section class="db-at" aria-label="Atendidos recientemente">
    <!-- Función 18: atendidos recientemente (carrusel horizontal en teléfono) -->
    <div class="db-tcab">
      <div class="db-th"><h2>Atendidos recientemente</h2>
        <!-- TRAÍDO DEL LANZADOR: contador de consultas de la semana -->
        <p class="db-sub"><b class="db-num">14</b> consultas esta semana</p></div>
      <a href="#" class="db-p db-enl">Ver todos{ic(I["sig"], 13, 2.4)}</a>
    </div>
    <ul class="db-at-l">{its}</ul>
    <!-- ESTADOS DE SISTEMA (no se dibujan; van en el lugar de la lista): CARGANDO = dos tarjetas esqueleto del mismo tamaño;
         ERROR = «No se pudieron cargar los pacientes atendidos.» + píldora tonal «Reintentar»; VACÍO = «Aún no has atendido pacientes.» + enlace «Crear paciente». -->
  </section>'''

def documentos():
    # Nivel 3 (CALMA §9): icono del tipo de 20 px en su --d-*, sin fondo. «Constancia» es un Escrito médico.
    datos = [('Receta', '03', 'hace 1 h', 'receta'), ('Laboratorio', '11', 'hace 3 h', 'laboratorio'), ('Constancia', '18', 'ayer', 'escrito')]
    its = ''.join(f'''<li><a href="#" class="db-p db-doc"><span class="db-doc-i" style="color:var(--d-{k})">{ic(I[k], 20)}</span><span class="db-doc-t"><span class="db-nom">{t}</span><span class="db-dsub">Paciente Prueba {n} · {h}</span></span>{ic(I["sig"], 14, 2.4)}</a></li>''' for t, n, h, k in datos)
    return f'''<section class="db-tar db-docs" aria-label="Documentos recientes">
    <!-- Función 19: documentos recientes con su botón «Nuevo documento» -->
    <div class="db-tcab"><h2>Documentos recientes</h2><button type="button" class="db-p db-pil db-toq db-pil-n" data-abre="doc" aria-label="Nuevo documento">{ic(I["plus"], 16, 2.4)}<span>Nuevo</span></button></div>
    <ul class="db-docs-l">{its}</ul>
    <!-- ESTADOS DE SISTEMA (no se dibujan; van en el lugar de la lista, el botón «Nuevo» se queda): CARGANDO = tres renglones esqueleto de 56;
         ERROR = «No se pudieron cargar los documentos.» + píldora tonal «Reintentar»; VACÍO = «Aún no hay documentos.» -->
  </section>'''

def cuerpo_med(vp):
    return f'''<div class="db-cols db-m">
  {hero()}
  {herr(vp)}
  {despues(vp)}
  {atendidos()}
  {documentos()}
  </div>'''

def cuerpo_sec(vp):
    DR, DRA = 'Dr. Admin Semilla', 'Dra. Invitada Semilla'
    J, V = 'Jue 19 nov', 'Vie 20 nov'
    ult = [('24', 'Alta hace 20 min'), ('25', 'Alta hace 2 h'), ('22', 'Alta ayer'), ('20', 'Alta hace 3 días')]
    ults = ''.join(f'''<li class="db-ulr"><a href="#" class="db-p db-atq">{av(n)}<span class="db-doc-t"><span class="db-nom">Paciente Prueba {n}</span><span class="db-dsub">{t}</span></span></a><button type="button" class="db-p db-mini db-toq" aria-label="Agendar cita a Paciente Prueba {n}">Agendar</button></li>''' for n, t in ult)
    return f'''<!-- ===== VARIANTE DE SECRETARIA (8 funciones). Se ve con «Maqueta: ver como secretaria». Su navegación solo tiene Inicio, Expediente y Agenda. ===== -->
  <div class="db-cols db-s">
  <div class="db-herr">
    {campo(vp)}
    <nav class="db-acc db-acc-s" aria-label="Acciones">
      <!-- Para la secretaria el único primario es «Agendar cita» -->
      <button type="button" class="db-p db-prim db-prim-s">{ic(I["agendar"], 18, 2)}Agendar cita</button>
      <a href="#" class="db-p db-ab db-a-pac" aria-label="Nuevo paciente"><span class="db-ic-l">{ic(I["nuevo"], 18, 1.9)}</span><span class="db-ic-c">{ic(I["plus"], 16, 2.4)}</span><span class="db-rl">Nuevo paciente</span><span class="db-rc">Paciente</span></a>
    </nav>
  </div>
  <section class="db-tar db-cons" aria-label="Hoy en consultorio">
    <div class="db-tcab"><h2>Hoy en consultorio</h2></div>
    <ul class="db-stats">
      <li class="db-stat"><b class="db-num">1</b><span>En consulta</span></li>
      <li class="db-stat"><b class="db-num">2</b><span>En espera</span></li>
      <li class="db-stat"><b class="db-num">4</b><span>Por llegar</span></li>
      <li class="db-stat"><b class="db-num">4</b><span>Atendidas</span></li>
    </ul>
    <!-- ESTADOS DE SISTEMA (no se dibujan; en el lugar de los conteos): CARGANDO = cuatro cajas var(--fondo) sin número;
         ERROR = «No se pudieron cargar los conteos.» + píldora tonal «Reintentar». -->
  </section>
  <section class="db-tar db-desp" aria-label="Próximas citas de la clínica">
    {tcab("Próximas citas")}
    <ul class="db-filas">
      {fila(vp, "NOV", 19, "Paciente Prueba 07", "17:00", "17:30", J, DR, "ag", sec=True)}
      {fila(vp, "NOV", 19, "Paciente Prueba 12", "18:30", "19:00", J, DR, "conf", "enlace", sec=True)}
      {fila(vp, "NOV", 19, "Paciente Prueba 09", "18:45", "19:15", J, DRA, "ag", sec=True)}
      {fila(vp, "NOV", 20, "Paciente Prueba 15", "08:00", "08:30", V, DR, "ag", "google", sec=True)}
      {fila(vp, "NOV", 20, "Paciente Prueba 21", "09:00", "09:30", V, DRA, "conf", "enlace", sinexp=True, sec=True)}
    </ul>
    <p class="db-pie">No hay más citas próximas</p>
  </section>
  <section class="db-tar db-ult" aria-label="Últimos pacientes">
    <div class="db-tcab"><h2>Últimos pacientes</h2><a href="#" class="db-p db-enl">Ver todos{ic(I["sig"], 13, 2.4)}</a></div>
    <ul class="db-docs-l">{ults}</ul>
  </section>
  </div>'''

def cont(vp):
    return f'''<main class="db-cont">
  <!-- Controles de maqueta (CALMA §7): ya no van dentro del marco. El guion crea UNA tira fuera del teléfono, en la cabecera
       de la sección de la página, que controla los cinco marcos: ver como secretaria, día sin citas y la hoja de la cita en sus variantes. -->
  <!-- Función 20 (no se dibuja): mientras carga el perfil, toda esta columna se sustituye por el esqueleto de la pantalla
       (saludo como barra de 60 %, pieza principal y tarjetas como bloques var(--sup) del mismo tamaño); la navegación ya está pintada. -->
  <div class="db-top">
  {cab(vp)}
  {hoy()}
  </div>
  {cuerpo_med(vp)}
  {cuerpo_sec(vp)}
</main>'''

def riel():
    def b(k, t, act=False, cl=''):
        a = ' aria-current="page"' if act else ''
        return f'<a href="#" class="db-p db-rb{cl}" aria-label="{t}"{a}>{ic(I[k], 22)}</a>'
    return f'''<!-- Función 1: navegación. Riel a la derecha, fundido con la franja del sistema. -->
<nav class="db-riel" aria-label="Navegación principal">
  {b("inicio","Inicio",True)}{b("pac","Expediente")}{b("agenda","Agenda")}{b("docs","Documentos",cl=" db-m")}<a href="#" class="db-p db-rb db-m" aria-label="Más">{ic(I["mas"], 22, 3)}</a>
  <span class="db-flex"></span>
  <button type="button" class="db-p db-mas db-m" aria-label="Nueva consulta" data-abre="con">{ic(I["plus"], 26, 2.4)}</button>
  <button type="button" class="db-p db-mas db-s" aria-label="Agendar cita">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lateral():
    def a(k, t, act=False, cl=''):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="db-p db-li{cl}"{c}>{ic(I[k], 20)}{t}</a>'
    return f'''<!-- Función 1: navegación (barra lateral) -->
<nav class="db-lat" aria-label="Navegación principal">
  <div class="db-lat-cab">{marca(24)}{PLAN}</div>
  <button type="button" class="db-p db-cons-b"><span class="db-av"><span class="db-m">AS</span><span class="db-s">SE</span></span><span class="db-cons-t"><span class="db-m">Consultorio</span><b class="db-m">Centro</b><span class="db-s">Clínica</span><b class="db-s">Clínica Semilla A</b></span>{ic(I["selector"], 16, 2)}</button>
  <div class="db-lista">{a("inicio","Inicio",True)}{a("pac","Expediente")}{a("agenda","Agenda")}{a("docs","Documentos",cl=" db-m")}{a("admin","Administración",cl=" db-m")}</div>
  <span class="db-flex"></span>
  <div class="db-lat-pie"><a href="#" class="db-p db-li db-yo">{ic(I["perfil"], 20)}<span><span class="db-m">Dr. Admin Semilla</span><span class="db-s">Secretaria</span><small>Mi perfil · Ajustes</small></span></a></div>
</nav>'''

def encabezado():
    return f'''<!-- Función 1: navegación. Encabezado fundido con la barra de estado. -->
<header class="db-enc">
  <button type="button" class="db-p db-menu" aria-label="Menú">{ic(I["menu"], 22, 2)}</button>
  <span class="db-enc-t">Inicio</span>
  <span class="db-flex"></span>
  <button type="button" class="db-p db-av db-av-g" aria-label="Mi perfil"><span class="db-m">AS</span><span class="db-s">SE</span></button>
</header>'''

def enc_iv():
    def p(t, act=False, cl=''):
        c = ' aria-current="page"' if act else ''
        return f'<a href="#" class="db-p db-pv{cl}"{c}>{t}</a>'
    return f'''<!-- Función 1: navegación de Duo abierto vertical (CALMA §19): encabezado fundido con la barra de estado; secciones en una pista.
     Administración, Mi perfil y Ayuda: desde «Mostrar barra lateral» o el avatar.
     CALMA §23.9: quinta píldora «Más», sin marcar aquí; abre el mismo menú que el «···» del riel de Duo cerrado (menú no dibujado).
     Como en el riel, «Documentos» y «Más» no se dibujan para la secretaria. -->
<header class="db-env">
  <button type="button" class="db-p db-envb" aria-label="Mostrar barra lateral">{ic(I["barra"], 20)}</button>
  <nav class="db-pista" aria-label="Secciones">{p("Inicio", True)}{p("Expediente")}{p("Agenda")}{p("Documentos", cl=" db-m")}{p("Más", cl=" db-m")}</nav>
  <button type="button" class="db-p db-av db-av-g" aria-label="Mi perfil"><span class="db-m">AS</span><span class="db-s">SE</span></button>
</header>'''

RES = [("01", "Paciente Prueba 01", "34 años · Exp. 0001"), ("07", "Paciente Prueba 07", "54 años · Exp. 0007"),
       ("12", "Paciente Prueba 12", "61 años · Exp. 0012"), ("23", "Paciente Prueba 23", "28 años · Exp. 0023")]

def capa(vp):
    filas = ''.join(
        f'<li role="none"><button type="button" role="option" aria-selected="false" class="db-p db-r" data-n="{n.lower()}">{av(i)}<span class="db-doc-t"><span class="db-nom">{n}</span><span class="db-dsub">{d}</span></span>{ic(I["sig"], 14, 2.4)}</button></li>'
        for i, n, d in RES)
    tec = '<p class="db-tec">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>' if vp in ('ih', 'esc') else ''
    return f'''<!-- Buscador de paciente («Nueva consulta» / «Nuevo documento»; el título cambia). Animación de la maqueta: transform/opacity,
     320 ms cubic-bezier(.32,.72,0,1), el mismo camino para entrar y salir. En la app real será un resorte (amortiguación 1.0,
     respuesta ~0.3) interrumpible y arrastrable desde el asa; aquí basta la aproximación. -->
<div class="db-capa" aria-hidden="true">
  <div class="db-velo"></div>
  <div class="db-hoja" role="dialog" aria-modal="true" aria-label="Nueva consulta">
    <span class="db-asa" aria-hidden="true"></span>
    <div class="db-vbus">
      <div class="db-hjcab"><h2 class="db-hj-t">Nueva consulta</h2><button type="button" class="db-p db-ib db-cierra" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
      <label class="db-campo">{ic(I["lupa"], 18, 2)}<input type="search" class="db-busca" placeholder="Buscar paciente por nombre" aria-label="Buscar paciente por nombre" autocomplete="off"></label>
      <ul class="db-res" role="listbox" aria-label="Resultados">{filas}</ul>
      <p class="db-nada">Sin resultados. Puedes crear un registro nuevo.</p>
      <button type="button" class="db-p db-tonal db-crear">{ic(I["nuevo"], 18, 1.9)}Crear registro</button>
      {tec}
    </div>
    <form class="db-vform" novalidate>
      <div class="db-hjcab"><button type="button" class="db-p db-ib db-volver" aria-label="Volver a la búsqueda">{ic(I["volver"], 20, 2.2)}</button><h2>Crear registro</h2><button type="button" class="db-p db-ib db-cierra" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button></div>
      <div class="db-par">
        <label class="db-f"><span>Nombre *</span><input type="text" class="db-in db-nombre" autocomplete="off"></label>
        <label class="db-f"><span>Apellidos</span><input type="text" class="db-in" autocomplete="off"></label>
      </div>
      <div class="db-par">
        <label class="db-f"><span>Fecha de nacimiento</span><input type="date" class="db-in db-nac" max="2026-11-19"></label>
        <div class="db-f"><span>Edad</span><output class="db-edad">Se calcula sola</output></div>
      </div>
      <!-- Casilla a la derecha de su texto (CALMA §20) -->
      <label class="db-chk"><span>El paciente aceptó el aviso de privacidad *</span><input type="checkbox" class="db-priv"><span class="db-caja" aria-hidden="true">{ic(I["palomita"], 16, 3)}</span></label>
      <!-- Pie con botones de verdad (CALMA §13): «Cancelar» (tonal, vuelve a la búsqueda, como hoy) y el principal. -->
      <div class="db-pieh"><button type="button" class="db-p db-tonal db-cancela">Cancelar</button><button type="submit" class="db-p db-prim db-envia" aria-disabled="true">Crear e iniciar consulta</button></div>
    </form>
  </div>
</div>'''


def capa_cita(vp):
    # CALMA §24.2: hoja de acciones de la cita. Hoja inferior en Duo cerrado e iPhone; tarjeta centrada de 400 con velo en lo demás.
    # El guion la rellena con los datos de la fila tocada (data-*). Acciones y textos de hoy:
    #   «Iniciar consulta»  dashboard/page.tsx:316-337 (cambia el consultorio activo y va a /expediente/{id}/nueva-nota?cita=…)
    #   «Ver expediente»    dashboard/page.tsx:339-352 (botón-icono «Abrir expediente»; texto aprobado §24.2)
    #   «Ligar paciente e iniciar consulta» (§24.6; hoy «Ligar e iniciar consulta», dashboard/page.tsx:284-301 → VentanaLigarCita)
    #   «Ver en la agenda» y «¿No es una cita?» (ProximasCitas.tsx:246-264). Sin cambios de estado: el dashboard de hoy no los hace.
    return f'''<!-- Hoja de acciones de la cita (CALMA §24). Animación de maqueta: transform/opacity 320 ms cubic-bezier(.32,.72,0,1); en la app, resorte. -->
<div class="db-capa db-capa-c" aria-hidden="true">
  <div class="db-velo"></div>
  <div class="db-hoja db-hc" role="dialog" aria-modal="true" aria-label="Cita">
    <span class="db-asa" aria-hidden="true"></span>
    <div class="db-hc-cab">
      <div class="db-fecha" aria-hidden="true"><span class="db-mes db-hc-mes">NOV</span><span class="db-dia db-hc-dia">19</span></div>
      <div class="db-hc-q">
        <h2 class="db-hc-n">Paciente Prueba 12</h2>
        <p class="db-hc-d db-hc-cuando db-num">Jue 19 nov · 18:30 – 19:00</p>
        <p class="db-hc-d db-hc-med">Dr. Admin Semilla · Centro</p>
      </div>
      <button type="button" class="db-p db-ib db-hc-x" aria-label="Cerrar">{ic(I["x"], 20, 2)}</button>
    </div>
    <div class="db-hc-et">
      <span class="db-hc-est">{est("conf")}{est("ag")}</span>
      <span class="db-hc-ori">{origen("enlace")}{origen("google")}</span>
      <span class="db-marca db-sx db-hc-sx">{SINEXP}Sin expediente</span>
    </div>
    <!-- Principal (botón de verdad). Con expediente: «Iniciar consulta» (dashboard/page.tsx:316-337). Sin expediente: «Ligar paciente e
         iniciar consulta» (§24.6; hoy «Ligar e iniciar consulta», page.tsx:270-301 → VentanaLigarCita; solo se dibuja). Si el médico no
         puede ligar (no es médico, o sin el consultorio de la cita: page.tsx:272-275), en su lugar «Ver en la agenda» → /agenda
         (ProximasCitas.tsx:256-262). El dashboard de hoy NO cambia estados: la hoja no los ofrece. -->
    <button type="button" class="db-p db-prim db-hc-prim db-hc-ini">{ic(I["esteto"], 18, 2)}Iniciar consulta</button>
    <button type="button" class="db-p db-prim db-hc-prim db-hc-lig">{ic(I["enlace"], 18, 2)}Ligar paciente e iniciar consulta</button>
    <a href="#" class="db-p db-prim db-hc-prim db-hc-ag">{ic(I["agenda"], 18, 2)}Ver en la agenda</a>
    <!-- «¿No es una cita?» (BotonNoEsCita.tsx:25,37-58; ProximasCitas.tsx:247-255): SOLO en un evento de Google «por asignar» (sin paciente
         ni reserva por enlace). Un toque, SIN confirmación (BotonNoEsCita.tsx:21): lo deja como evento sin paciente y la fila sale de la lista.
         Si falla, el motivo se dice debajo en role="alert" (noEsCita.ts:21-27): «No se pudo marcar como evento. Vuelve a intentarlo.»,
         «No puedes cambiar este evento.», «Ese evento ya no está en la agenda.», «Este evento ya no está por asignar.» -->
    <button type="button" class="db-p db-hc-noes">¿No es una cita?</button>
    <ul class="db-hc-l">
      <li class="db-hc-iexp"><button type="button" class="db-p db-hc-a">{ic(FOLDER, 20)}<span>Ver expediente</span></button></li>
    </ul>
  </div>
</div>'''

CSS = open(f'{L}/tmp-estilo.css').read()
JS = open(f'{L}/tmp-guion.js').read()

def marco(vp):
    if vp == 'ext':
        app = cont(vp) + riel()
    elif vp == 'tel':
        app = encabezado() + cont(vp)
    elif vp == 'iv':
        app = enc_iv() + cont(vp)
    elif vp == 'ih':
        app = cont(vp) + lateral()
    else:
        app = lateral() + cont(vp)
    return f'<div class="marco db" data-vp="{vp}">\n<div class="db-app">\n{app}\n</div>\n{capa(vp)}\n{capa_cita(vp)}\n</div>'

out = ('<!-- NOMBRE: Dashboard | Ahora contesta «¿qué hago ahora?»: arriba, la cita en curso lista para iniciar con el avance del día; debajo, lo que viene después en filas que se tocan enteras y abren la hoja de acciones de la cita, y todo lo demás en segundo plano -->\n'
       '<style>\n' + CSS + '</style>\n' + '\n'.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '\n<script>\n' + JS + '</script>\n')
open(f'{L}/vista-dashboard.html', 'w').write(out)
print(len(out))
