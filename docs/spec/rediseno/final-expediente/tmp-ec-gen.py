# Genera vista-expediente.html (expediente del paciente, versión en calma). Prefijo .ec. Uso: python3 tmp-ec-gen.py
import os
L = os.path.dirname(os.path.abspath(__file__))
# Cromo global al día (CALMA §28): aviso «N datos pendientes», logo de la clínica, pie «Mi perfil · Ajustes» + Ayuda y menú «Más».
# Se toma de entrega/dashboard-final/tmp-cromo.py (copiado a su vez de entrega/cromo) y se cambia el prefijo .db por .ec.
_cr = {}
exec(open(os.path.join(L, '..', 'dashboard-final', 'tmp-cromo.py')).read(), _cr)
def _ec(t): return t.replace('db-', 'ec-')
AP0, MAS0, CLOGO, PIE = _ec(_cr['AP']), _ec(_cr['MAS']), _ec(_cr['CLOGO']), _ec(_cr['PIE'])
BDG = '<span class="ec-bdg" aria-hidden="true">3</span>'
def ap(vp, donde):
    h = AP0.replace('VP-DONDE', f'{vp}-{donde}')
    if vp == 'ih' and donde == 'lat':   # Duo abierto: plegado de inicio para que el pie no baje a la franja
        h = h.replace('class="ec-ap ec-m"', 'class="ec-ap ec-m ec-pleg"').replace('aria-expanded="true"', 'aria-expanded="false"')
    return h

def ic(d, s=20, w=1.8, cl=''):
    c = f' class="{cl}"' if cl else ''
    return f'<svg{c} aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{d}</svg>'

P = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    doc='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    puntos='<path d="M5.5 12h.01M12 12h.01M18.5 12h.01"/>',
    mas='<path d="M12 5v14M5 12h14"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    updown='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    yo='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    izq='<path d="m15 6-6 6 6 6"/>',
    der='<path d="m9 6 6 6-6 6"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    alerta='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    candado='<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    panel='<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    basura='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    buscar='<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    consulta='<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
    pulso='<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    lapiz='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    ficha='<rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2"/><circle cx="12" cy="11.5" r="2"/><path d="M8.5 17.5c.6-1.6 1.9-2.4 3.5-2.4s2.9.8 3.5 2.4"/>',
    exportar='<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5"/>',
    docmas='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11.5v6M9 14.5h6"/>',
    enviar='<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    compartir='<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
    regen='<path d="M20 11a8 8 0 0 0-14.5-4.2L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 4.2L20 15.5M20 20v-4.5h-4.5"/>',
    abrir='<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    notamas='<path d="M4 6h16M4 11h10M4 16h7M18 13.5v6M15 16.5h6"/>',
    rejilla='<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    foto='<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 5 4.5"/>',
    archivador='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M10 5h1.5M10 8h1.5M10 11h1.5M10 14h1.5v3H10z"/>',
)
# Etiquetas de estado con color e icono (CALMA §11): icono de 14 + texto 12/600.
CHI = {'Borrador': 'lapiz', 'Urgente': 'alerta', 'Fuera de rango': 'alerta', 'Nota sellada': 'candado', 'Nota manual': 'lapiz', 'En rango': 'ok'}
def chip(k, t, cl=''):
    i = ic(P[CHI[t]], 14, 2.2) if t in CHI else ''
    return f'<span class="ec-chip ec-c-{k}{" " + cl if cl else ""}">{i}{t}</span>'
# Archivos clínicos (CALMA §11): como en la app (labs/CardDocumento.tsx), la TINTA sale del tipo (estudio de imagen / resultado de laboratorio)
# y el GLIFO del formato (imagen, PDF, DICOM). Solo existen esos dos tipos hoy.
def aic(nombre, tipo):
    g = 'foto' if nombre.lower().endswith(('jpg', 'jpeg', 'png')) else ('archivador' if nombre.lower().endswith('dcm') else 'doc')
    c = 'd-imagen' if tipo == 'Estudio de imagen' else 'd-laboratorio'
    return f'<span class="ec-di" style="color:var(--{c})" role="img" aria-label="{tipo}">{ic(P[g], 20, 1.8)}</span>'
# Color e icono por tipo de documento (CALMA §9). Iconos copiados tal cual de entrega/doc-color/color-documentos.html.
DI = dict(
    receta=('d-receta', 'Receta', '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>'),
    lab=('d-laboratorio', 'Laboratorio', '<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>'),
    imagen=('d-imagen', 'Imagenología', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
    suplementacion=('d-suplementacion', 'Suplementación', '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>'),
    internamiento=('d-internamiento', 'Internamiento', '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>'),
    escrito=('d-escrito', 'Escrito médico', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    consentimiento=('d-consentimiento', 'Consentimiento', '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
    honorarios=('d-honorarios', 'Honorarios / Cotización', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>'),
)
def dic(tipo):
    # Nivel 3: icono del tipo, 20 px, en su color, sin fondo.
    return f'<span class="ec-di" style="color:var(--{DI[tipo][0]})">{ic(DI[tipo][2], 20, 1.8)}</span>'
def nic(k):
    # Consulta y medición: glifo neutro para que la columna de la actividad quede alineada con los documentos.
    return f'<span class="ec-di ec-di-n" role="img" aria-label="{"Consulta" if k == "consulta" else "Medición"}">{ic(P[k], 20, 1.8)}</span>'
SIG = ic(P['der'], 16, 2, 'ec-sig')
ABAJO = ic(P['abajo'], 14, 2.2)
PUNTOS = ic(P['puntos'], 20, 3)

# ---------------- Navegación (copiada del referente; activo = Expediente, CALMA §20) ----------------
def riel():
    its = [('Inicio', 'inicio', 0), ('Expediente', 'pac', 1), ('Agenda', 'agenda', 0), ('Documentos', 'doc', 0)]
    h = ''.join(f'<a href="#" class="ec-p ec-rb" aria-label="{n}"{" aria-current=page" if a else ""}>{ic(P[i], 22)}</a>' for n, i, a in its)
    h += f'<button type="button" class="ec-p ec-rb" aria-label="Más" data-abre-mas>{ic(P["puntos"], 22, 3)}{BDG}</button>'
    return f'''<nav class="ec-riel" aria-label="Navegación principal">
  {h}
  <span class="ec-flex"></span>
  <!-- «+» global de Nueva consulta (Sidebar.tsx:123; abre el buscador de paciente del dashboard) -->
  <button type="button" class="ec-p ec-mas" aria-label="Nueva consulta">{ic(P["mas"], 26, 2.4)}</button>
</nav>'''

def enc():
    return f'''<header class="ec-enc">
  <!-- El cajón del menú (aviso, consultorio con su logo, Administración, Mi perfil, Ayuda) es el de entrega/cromo (vistas 1 y 5). -->
  <button type="button" class="ec-p ec-hamb" aria-label="Menú">{ic(P["menu"], 22, 2)}{BDG}</button>
  <span class="ec-enc-t">Expediente</span>
  <span class="ec-flex"></span>
  <button type="button" class="ec-p ec-av ec-av-g" aria-label="Mi perfil">AS</button>
</header>'''

def lat(vp):
    its = [('Inicio', 'inicio', 0), ('Expediente', 'pac', 1), ('Agenda', 'agenda', 0), ('Documentos', 'doc', 0), ('Administración', 'admin', 0)]
    h = ''.join(f'<a href="#" class="ec-p ec-li"{" aria-current=page" if a else ""}>{ic(P[i])}{n}</a>' for n, i, a in its)
    return f'''<nav class="ec-lat" aria-label="Navegación principal">
  <div class="ec-lat-cab"><span class="ec-logo">{ic(P["logo"], 24)}<span class="ec-logo-n">Spinus</span></span><span class="ec-plan">Plan VIP</span></div>
  <button type="button" class="ec-p ec-cons-b">{CLOGO}<span class="ec-cons-t"><span>Consultorio</span><b>Centro</b></span>{ic(P["updown"], 16, 2)}</button>
  <div class="ec-lista">{h}</div>
  <span class="ec-flex"></span>
  <!-- Aviso «N datos pendientes» (CALMA §28, solo médico) y pie de hoy: «Mi perfil · Ajustes» + Ayuda. -->
{ap(vp, "lat")}
  {PIE}
</nav>'''

def enc_iv():
    # Duo abierto en vertical (CALMA §19): encabezado fundido con la pista de secciones al centro, como la maqueta de referencia del dueño.
    # «Más» (CALMA §23.9) abre el mismo menú que el «···» del riel de ext; Mi perfil, desde el avatar.
    its = [('Inicio', 0), ('Expediente', 1), ('Agenda', 0), ('Documentos', 0)]
    h = ''.join(f'<a href="#" class="ec-p ec-pil"{" aria-current=page" if a else ""}>{n}</a>' for n, a in its) + '<button type="button" class="ec-p ec-pil" data-abre-mas>Más</button>'
    return f'''<header class="ec-enc ec-enc-iv">
  <button type="button" class="ec-p ec-hamb ec-lado" aria-label="Mostrar barra lateral">{ic(P["panel"], 20, 1.8)}{BDG}</button>
  <nav class="ec-pista" aria-label="Secciones">{h}</nav>
  <button type="button" class="ec-p ec-av ec-av-g" aria-label="Mi perfil">AS</button>
</header>'''

# ---------------- Datos ficticios ----------------
CONS = [
    dict(id='c1', f='17 nov 2026', fc='17 nov', h='11:26', dx='Lumbago no especificado', cie='M54.5',
         nota='Nota de evolución ficticia de la semilla. Dolor lumbar mecánico de dos semanas de evolución, sin irradiación.',
         plan='Plan ficticio: analgesia, higiene de columna y revisión en dos semanas.', sv=('128/82', '72', '16', '36.5', '98'), prox='23 nov 2026'),
    dict(id='c2', f='30 oct 2026', fc='30 oct', h='11:26', dx='Lumbago no especificado', cie='M54.5',
         nota='Nota de evolución ficticia de la semilla. Mejoría parcial con el tratamiento indicado.',
         plan='Plan ficticio: continuar analgesia, ejercicios de fortalecimiento y control en tres semanas.', sv=('130/84', '74', '16', '36.4', '97'), prox='17 nov 2026'),
    dict(id='c3', f='25 sep 2026', fc='25 sep', h='11:26', dx='Gonalgia derecha', cie='M25.5',
         nota='Nota de evolución ficticia de la semilla. Dolor en rodilla derecha tras caminata prolongada.',
         plan='Plan ficticio: reposo relativo, hielo local y valoración en cuatro semanas.', sv=('126/80', '70', '15', '36.6', '98'), prox='30 oct 2026'),
]
DOCS = [
    dict(id='con', tipo='consentimiento', corto='Consentimiento', titulo='Carta de consentimiento informado', ref='Infiltración', f='19 nov 2026', folio='', chip=('ag', 'Borrador')),
    dict(id='rec', tipo='receta', corto='Receta', titulo='Receta médica', ref='Lumbago', f='17 nov 2026', folio='RX-2026-0002'),
    dict(id='img', tipo='imagen', corto='Imagenología', titulo='Solicitud de imagenología', ref='Gonalgia', f='12 nov 2026', folio='IMG-2026-0001', chip=('mal', 'Urgente')),
    dict(id='lab', tipo='lab', corto='Laboratorio', titulo='Solicitud de laboratorio', ref='Gonalgia', f='30 oct 2026', folio='LAB-2026-0001'),
    dict(id='sub', tipo='lab', corto='Resultado de laboratorio', titulo='Resultado de laboratorio', ref='biometria-hematica.pdf', f='30 oct 2026', folio=''),
]
# El filtro lista los ocho tipos del catálogo, en orden fijo y con su conteo (como el <select> de hoy).
TIPOS = [('todos', 'Todos los tipos', 5), ('receta', 'Receta', 1), ('lab', 'Laboratorio', 2), ('imagen', 'Imagenología', 1), ('suplementacion', 'Suplementación', 0),
         ('internamiento', 'Internamiento', 0), ('escrito', 'Escrito médico', 0), ('consentimiento', 'Consentimiento', 1), ('honorarios', 'Honorarios / Cotización', 0)]
ANAL = [
    dict(id='glu', n='Glucosa en ayuno', v='96 mg/dL', f='12 nov 2026', fc='12 nov', d='↓ 4 mg/dL', t=('↓', 'bajó'),
         cat='Química', u='mg/dL', est=('ok', 'En rango'), delta='↓ -16 mg/dL (-14.3%)', ok=(70, 99), warn=(99, 125), esc=(60, 130),
         ley=['Normal: 70–99 mg/dL', 'Atención: 100–125 mg/dL', 'Fuera de rango: < 70 o > 125 mg/dL'],
         reg=[('12 nov 2026', '08:10', '96', 'En ayuno de 10 horas.'), ('30 oct 2026', '08:05', '100', ''), ('25 sep 2026', '07:50', '104', ''),
              ('14 ago 2026', '08:20', '99', ''), ('3 jul 2026', '08:00', '108', 'Refiere desvelo la noche previa.'), ('22 may 2026', '08:15', '112', '')]),
    dict(id='ta', n='Presión arterial', v='148/92 mmHg', f='25 sep 2026', fc='25 sep', d='↑ 18/8 mmHg', t=('↑', 'subió'), fuera=True,
         cat='Signos vitales', u='mmHg', est=('mal', 'Fuera de rango'), delta='↑ +18/8 mmHg', ok=(90, 129), warn=(129, 139), esc=(70, 160),
         ley=['Normal: ≤ 129 mmHg', 'Atención: 129–139 mmHg', 'Fuera de rango: > 139 mmHg'],
         reg=[('25 sep 2026', '11:20', '148/92', 'Tomada tras caminar al consultorio.'), ('14 ago 2026', '10:05', '130/84', '')]),
    dict(id='vd', n='Vitamina D (25-OH)', v='24 ng/mL', f='30 oct 2026', fc='30 oct', d='primera', fuera=True,
         cat='Vitaminas y minerales', u='ng/mL', est=('mal', 'Fuera de rango'), ok=(30, 60), warn=(30, 60), esc=(10, 60),
         ley=['Normal: ≥ 30 ng/mL', 'Fuera de rango: < 30 ng/mL'], reg=[('30 oct 2026', '08:05', '24', '')]),
    dict(id='hb', n='Hemoglobina', v='13.1 g/dL', f='30 oct 2026', fc='30 oct', d='primera',
         cat='Hematología', u='g/dL', custom=True, esc=(10, 16), ley=[], reg=[('30 oct 2026', '08:05', '13.1', '')]),
]
ARCH = [('radiografia-rodilla-ap.jpg', 'Estudio de imagen', '12 nov 2026', '1.8 MB', '12 de noviembre de 2026'), ('biometria-hematica.pdf', 'Resultado de laboratorio', '30 oct 2026', '248 KB', '30 de octubre de 2026')]
FUERA = chip('mal', 'Fuera de rango')
ALG = f'<p class="ec-alg">{ic(P["alerta"], 14, 2.2)}<span class="ec-pa">Alergias: Penicilina</span></p>'
AVN = '<span class="ec-avn" style="background:#F1DCEC;color:#7A2E6B" aria-hidden="true">01</span>'
# CabeceraPaciente.tsx:67-73: «Exp. {numero_expediente}»
LINEA = '<span class="ec-nw">73 años</span> · <span class="ec-nw">Femenino</span> · <span class="ec-nw ec-num">Exp. EXP-2026-0001</span>'

# Acciones del paciente (funciones 3–6; solo con isDoctor —función 11—: la secretaria no entra a esta ruta)
NC = '<a href="/expediente/01/nueva-nota" class="ec-p ec-prim">Nueva consulta</a>'
# «Nuevo documento» abre la rejilla de los ocho tipos (hoja en teléfono, modal en ancho); cada azulejo lleva a /expediente/01/documentos?tipo=…
ND = '<button type="button" class="ec-p ec-txt" data-abre="nuevo" aria-haspopup="dialog">Nuevo documento</button>'
MAS16 = ic(P['mas'], 16, 2.4)
# Duo cerrado (CALMA §17): «+» de 16 y una palabra; el aria-label conserva el rótulo completo de hoy.
NC_EXT = f'<a href="/expediente/01/nueva-nota" class="ec-p ec-prim ec-corta" aria-label="Nueva consulta">{MAS16}Consulta</a>'
ND_EXT = f'<button type="button" class="ec-p ec-txt ec-corta" data-abre="nuevo" aria-haspopup="dialog" aria-label="Nuevo documento">{MAS16}Documento</button>'
def mas_pac():
    return f'<button type="button" class="ec-p ec-ib" aria-label="Acciones del paciente" aria-haspopup="menu" data-menu="pac">{PUNTOS}</button>'

def pestanas(vp):
    # Funciones 7 y 8: cuatro pestañas; la pestaña vive en la URL (?tab=), cada una es un enlace real.
    # Marcos pequeños (ext y tel): pestañas de ICONO; la activa enseña icono + nombre en una píldora tonal. En ih y esc siguen siendo de texto.
    ICT = dict(resumen='ficha', consultas='consulta', documentos='doc', mediciones='pulso')
    chico = vp in ('ext', 'tel')
    def t(k, n, v1=None, v0=0, sel=False, largo=''):
        nom = f'<span class="ec-corto">{n}</span><span class="ec-largo">{largo}</span>' if largo else n
        cta = f'<i><span class="ec-v1">{v1}</span><span class="ec-v0">{v0}</span></i>' if v1 is not None else ''
        al = f' aria-label="{largo or n}"' if chico else ''
        g = ic(P[ICT[k]], 20, 1.8) if chico else ''
        return f'<a href="?tab={k}" role="tab" class="ec-p ec-tab" data-tab="{k}" data-t="{n}{" 0" if v1 is not None else ""}" data-tl="{largo or n}{" 0" if v1 is not None else ""}" aria-selected="{"true" if sel else "false"}"{al}><span class="ec-tb">{g}<span class="ec-tn">{nom}{cta}</span></span></a>'
    return f'''<div class="ec-tabs" role="tablist" aria-label="Secciones del expediente">
    {t("resumen", "Resumen", sel=True)}{t("consultas", "Consultas", 3)}{t("documentos", "Documentos", 5)}{t("mediciones", "Mediciones", largo="Mediciones y archivos")}
  </div>'''

# ---------------- Cabeceras ----------------
def cab_tel(vp):
    return f'''<!-- Fila 1 (se queda fija): volver + «···». Al desplazar, la identidad se va con el contenido y aquí aparece el nombre en 15/600
       (transición solo de opacity/transform; en la app, ligada al desplazamiento con un resorte crítico). -->
  <div class="ec-barra">
    <a href="/expediente" class="ec-p ec-volver" aria-label="Volver a Expediente">{ic(P["izq"], 16, 2.4)}<span>Expediente</span></a>
    <div class="ec-mini" aria-hidden="true"><b class="ec-pn">Paciente Prueba 01</b><p class="ec-alg">{ic(P["alerta"], 12, 2.4)}<span class="ec-pac">Penicilina</span></p></div>
    <span class="ec-flex"></span>
    {mas_pac()}
  </div>
  <!-- Fila 2: identidad (función 2). Teléfono y nacimiento bajan a la fila plegable «Datos del paciente» del Resumen. La alergia (función 13) es una etiqueta pegada al nombre. -->
  <div class="ec-id">
    {AVN}
    <div class="ec-idt"><h1 class="ec-pn">Paciente Prueba 01</h1><p class="ec-sub">{LINEA}</p>{ALG}</div>
  </div>
  <div class="ec-accs">{NC_EXT + ND_EXT if vp == "ext" else NC + ND}</div>
  <span class="ec-ancla" aria-hidden="true"></span>
  {pestanas(vp)}'''

def cab_ih(vp='ih'):
    return f'''<!-- Duo abierto: la bisagra (x 455–496) separa «quién» de «qué». A su izquierda, la identidad (volver, avatar, nombre, datos y alergias),
       con un ancho que termina en x=447; a su derecha (x ≥ 496), las acciones. El nombre se trunca con puntos suspensivos y la etiqueta de alergias
       parte en dos líneas: nunca se enciman. «Nuevo documento» vive en «···» en este marco. -->
  <header class="ec-cabih">
    <div class="ec-chq"><a href="/expediente" class="ec-p ec-ib ec-volver-i" aria-label="Volver a Expediente">{ic(P["izq"], 20, 2.2)}</a>
      {AVN}
      <div class="ec-idt"><h1 class="ec-pn">Paciente Prueba 01</h1><p class="ec-sub">{LINEA}</p>{ALG}</div></div>
    <div class="ec-cha">{NC}{mas_pac()}</div>
  </header>
  {pestanas(vp)}'''

def cab_iv():
    return f'''<!-- Duo abierto vertical (CALMA §19, cuarta pasada): primera fila, «‹ Expediente» a la izquierda y, a la derecha, «Nueva consulta» (único relleno),
       «Nuevo documento» y «···»; debajo, la identidad a todo el ancho (avatar, nombre 28/800; datos y alergias en una línea). Pestañas de texto completas. -->
  <header class="ec-cabiv">
    <div class="ec-civb"><a href="/expediente" class="ec-p ec-volver" aria-label="Volver a Expediente">{ic(P["izq"], 16, 2.4)}<span>Expediente</span></a>
      <span class="ec-flex"></span><div class="ec-civa">{NC}{ND}{mas_pac()}</div></div>
    <div class="ec-civ">
      {AVN}
      <div class="ec-idt"><h1 class="ec-pn">Paciente Prueba 01</h1><p class="ec-sub">{LINEA}</p>{ALG}</div>
    </div>
  </header>
  {pestanas('iv')}'''

def ficha(vp='esc'):
    return f'''<!-- FICHA DEL PACIENTE: fija, la misma en las cuatro pestañas. Sin fondo propio: descansa sobre el fondo de la página. -->
  <aside class="ec-ficha" aria-label="Paciente">
    <a href="/expediente" class="ec-p ec-volver" aria-label="Volver a Expediente">{ic(P["izq"], 16, 2.4)}<span>Expediente</span></a>
    {AVN}
    <h1 class="ec-pn">Paciente Prueba 01</h1>
    <p class="ec-sub">73 años · Femenino</p>
    {ALG}
    <dl class="ec-pares">
      <div><dt>Expediente</dt><dd class="ec-num">EXP-2026-0001</dd></div>
      <div><dt>Teléfono</dt><dd class="ec-num">999 000 0001</dd></div>
      <div><dt>Nacimiento</dt><dd class="ec-num">11 feb 1953</dd></div>
    </dl>
    {NC}
    <div class="ec-f-acc">{ND}<span class="ec-flex"></span><a href="/expediente/01/editar" class="ec-p ec-txt">Editar</a>{mas_pac()}</div>
    <!-- Antecedentes y antropometría son del paciente, no de una pestaña: viven aquí como filas plegables de una línea (y dejan de repetirse en el Resumen). -->
    <div class="ec-f-blq">{bloques_ficha()}</div>
  </aside>'''

# ---------------- Resumen ----------------
def fila_act(t, icono, titulo, sub, attrs, chip=''):
    return f'''<li data-t="{t}"><a href="#" class="ec-p ec-fila" {attrs}>{icono}<span class="ec-ft"><span class="ec-nom">{titulo}</span><span class="ec-l2"><span class="ec-sub ec-num">{sub}</span>{chip}</span></span>{SIG}</a></li>'''

def dx():
    return f'''<!-- Función 12: último diagnóstico + pares rótulo—valor (sin mosaicos). Estados no dibujados: esqueleto (tres barras var(--sup2)) y
         «No se pudo cargar el diagnóstico.» con «Reintentar» de texto, en este mismo hueco. -->
    <section class="ec-tar ec-dxc">
      <div><p class="ec-rot">Último diagnóstico</p>
        <div class="ec-dxl"><h2 class="ec-dx"><span class="ec-v1">Lumbago no especificado</span><span class="ec-v0">Sin diagnóstico registrado</span></h2><span class="ec-chip ec-c-ton ec-num ec-v1">CIE-10 M54.5</span></div></div>
      <dl class="ec-pares">
        <div><dt>Última consulta</dt><dd class="ec-num"><span class="ec-v1">17 nov 2026</span><span class="ec-v0">—</span></dd></div>
        <div><dt>Próxima cita</dt><dd class="ec-num"><span class="ec-v1">En 4 días</span><a href="/agenda" class="ec-p ec-txt ec-v0">Agendar</a></dd></div>
        <div><dt>Consultas</dt><dd class="ec-num"><span class="ec-v1">3</span><span class="ec-v0">0</span></dd></div>
      </dl>
    </section>'''

def actividad():
    c = lambda i: f'data-ir="consultas" data-con="{CONS[i]["id"]}"'
    d = lambda k: f'data-ir="documentos" data-doc="{k}"'
    filas = ''.join([
        fila_act('documento', dic('consentimiento'), 'Consentimiento', '19 nov · Infiltración', d('con'), chip('ag', 'Borrador')),
        fila_act('consulta', nic('consulta'), 'Lumbago no especificado', '17 nov · 11:26', c(0)),
        fila_act('documento', dic('receta'), 'Receta', '17 nov · RX-2026-0002', d('rec')),
        fila_act('medicion', nic('pulso'), 'Glucosa en ayuno <span class="ec-vl">96 mg/dL</span>', '12 nov', 'data-ir="mediciones"'),
        fila_act('documento', dic('imagen'), 'Imagenología', '12 nov · Gonalgia', d('img'), chip('mal', 'Urgente')),
        fila_act('consulta', nic('consulta'), 'Lumbago no especificado', '30 oct · 11:26', c(1)),
        fila_act('documento', dic('lab'), 'Laboratorio', '30 oct · LAB-2026-0001', d('lab')),
        fila_act('consulta', nic('consulta'), 'Gonalgia derecha', '25 sep · 11:26', c(2)),
        fila_act('medicion', nic('pulso'), 'Presión arterial <span class="ec-vl">148/92 mmHg</span>', '25 sep', 'data-ir="mediciones"', FUERA),
    ])
    return f'''<!-- Función 18 RETIRADA por decisión del dueño (segunda revisión): la actividad ya no lleva filtro Todo/Consultas/Documentos/Mediciones,
         porque las pestañas de arriba ya separan por tipo; se muestra TODO, de lo más reciente a lo más antiguo. Función 19: la fila entera lleva a su pestaña (la consulta abre esa nota;
         el documento, ese documento). Los documentos llevan el icono de su tipo en su color (nivel 3). Estados no dibujados: tres filas esqueleto de 60; «No se pudo cargar la actividad clínica.» + «Reintentar» de texto. -->
    <section class="ec-grupo ec-act" aria-label="Actividad clínica">
      <div class="ec-sh"><h2>Actividad clínica</h2></div>
      <div class="ec-tar">
        <ul class="ec-hl ec-v1">{filas}</ul>
        <!-- Función 20: línea vacía. El primario «Nueva consulta» ya está en la cabecera; aquí la acción es de texto. -->
        <div class="ec-vac ec-v0"><p class="ec-nom">Expediente recién creado</p>
          <p class="ec-sub">Aquí se irá formando la historia clínica del paciente: cada consulta, cada documento y cada medición aparecerán en esta línea, de la más reciente a la más antigua.</p>
          <a href="/expediente/01/nueva-nota" class="ec-p ec-txt">Iniciar primera consulta</a></div>
      </div>
    </section>'''

def bloque(vp, k, titulo, resumen, cuerpo, v1=False, ir=''):
    cl = ' ec-v1' if v1 else ''
    if vp == 'esc':
        return f'<section class="ec-blq{cl}" aria-label="{titulo}"><h2 class="ec-rot">{titulo}</h2><div class="ec-blq-c">{cuerpo}</div></section>'
    if ir:
        return f'''<section class="ec-blq{cl}"><a href="?tab={ir}" class="ec-p ec-plg" data-ir="{ir}"><b>{titulo}</b><span class="ec-sub ec-num">{resumen}</span>{SIG}</a></section>'''
    return f'''<section class="ec-blq ec-cerr{cl}"><button type="button" class="ec-p ec-plg" aria-expanded="false"><b>{titulo}</b><span class="ec-sub ec-num">{resumen}</span>{ic(P["abajo"], 16, 2)}</button>
        <div class="ec-blq-c">{cuerpo}</div></section>'''

def bloques(vp):
    ant = [('No patológicos', 'Sedentarismo. Tabaquismo negado.'), ('Patológicos', 'Hipertensión arterial en control.'), ('Quirúrgicos', 'Apendicectomía (1985).'),
           ('Familiares', 'Madre con osteoporosis.'), ('Medicamentos', 'Losartán 50 mg cada 24 h.')]
    a = f'''<!-- Función 14: antecedentes (5 apartados) o «Capturar antecedentes» → editar. -->
          <dl class="ec-pares ec-izq ec-v1">{''.join(f'<div><dt>{x}</dt><dd>{y}</dd></div>' for x, y in ant)}</dl>
          <a href="/expediente/01/editar" class="ec-p ec-txt ec-v0">Capturar antecedentes</a>'''
    b = '''<!-- Función 15: antropometría. «Calculado» va escrito (hoy solo vive en un title). -->
          <dl class="ec-pares ec-v1"><div><dt>Peso</dt><dd class="ec-num">68 kg</dd></div><div><dt>Talla</dt><dd class="ec-num">158 cm</dd></div>
            <div><dt>IMC<span class="ec-nota-s">Campo calculado</span></dt><dd class="ec-num">27.2 · Sobrepeso</dd></div></dl>
          <a href="/expediente/01/editar" class="ec-p ec-txt ec-v0">Capturar peso y talla</a>'''
    an = ''.join(f'<li><div class="ec-fila"><span class="ec-ft"><span class="ec-nom">{x["n"]}</span>{f"<span class=ec-l2>{FUERA}</span>" if x.get("fuera") else ""}</span><span class="ec-vd"><span class="ec-val ec-num">{x["v"]}</span><span class="ec-sub ec-num">{x["fc"]}</span></span></div></li>' for x in ANAL[:2])
    c = f'''<!-- Función 16: últimos analitos con enlace a la pestaña (sin analitos, el bloque no existe). Error propio: «No se pudieron cargar los analitos.» -->
          <ul>{an}</ul><a href="?tab=mediciones" class="ec-p ec-txt" data-ir="mediciones">Ver 4 analitos</a>'''
    ar = ''.join(f'<li><div class="ec-fila">{aic(n, t)}<span class="ec-ft"><span class="ec-nom">{n}</span><span class="ec-sub ec-num">{t} · {f}</span></span></div></li>' for n, t, f, p, fl in ARCH)
    d = f'''<!-- Función 17: archivos clínicos con «Ver los N archivos». -->
          <ul class="ec-v1">{ar}</ul><a href="?tab=mediciones" class="ec-p ec-txt ec-v1" data-ir="mediciones">Ver los 2 archivos clínicos</a>
          <p class="ec-sub ec-v0" style="padding:4px 0 10px">Sin archivos clínicos.</p>'''
    A = bloque(vp, 'ant', 'Antecedentes', '<span class="ec-v1">5 apartados</span><span class="ec-v0">Sin antecedentes registrados.</span>', a)
    B = bloque(vp, 'antro', 'Antropometría', '<span class="ec-v1">68 kg · 158 cm</span>', b)
    C = bloque(vp, 'anal', 'Últimos analitos', '4 analitos', c, v1=True)
    D = bloque(vp, 'arch', 'Archivos clínicos', '<span class="ec-v1">2 archivos</span><span class="ec-v0">Sin archivos clínicos.</span>', d, ir='' if vp == 'esc' else 'mediciones')
    if vp == 'ficha':
        return A + B
    if vp == 'esc':
        # Antecedentes y antropometría viven en la ficha fija de la izquierda (bloques_ficha); aquí quedan los dos bloques de datos.
        return f'<div class="ec-grupo ec-blqs"><div>{C}</div><div>{D}</div></div>'
    dp = '''<!-- Función 2 (resto): nacimiento y teléfono, que en teléfono no caben en la línea de identidad. -->
          <dl class="ec-pares"><div><dt>Nacimiento</dt><dd class="ec-num">11 feb 1953</dd></div><div><dt>Teléfono</dt><dd class="ec-num">999 000 0001</dd></div></dl>'''
    Z = bloque(vp, 'datos', 'Datos del paciente', '', dp)
    return f'<div class="ec-grupo"><div class="ec-tar ec-blqs">{Z}{A}{B}{C}{D}</div></div>'

def bloques_ficha():
    return bloques('ficha')

def resumen(vp):
    if vp in ('ih', 'iv'):
        cuerpo = f'<div class="ec-res2"><div>{dx()}{bloques(vp)}</div><div>{actividad()}</div></div>'
    else:
        cuerpo = dx() + actividad() + bloques(vp)
    return f'<div class="ec-pan" role="tabpanel" data-pan="resumen" aria-label="Resumen">{cuerpo}</div>'

# ---------------- Consultas ----------------
def firma():
    return '<div class="ec-firma"><b>Dr. Admin Semilla</b><p class="ec-sub">Traumatología y Ortopedia</p><p class="ec-sub ec-num">Cédula Prof. 00000001</p></div>'

def nota(c, vp, i):
    # CuerpoNota.tsx:159-163,224-228: rótulos TA, FC, FR, TEMP, SPO₂ y la unidad junto al valor
    sv = ''.join(f'<div><dt>{r}</dt><dd class="ec-num">{v} <small>{u}</small></dd></div>' for (r, u), v in zip([('TA', 'mmHg'), ('FC', 'lpm'), ('FR', 'rpm'), ('TEMP', '°C'), ('SPO₂', '%')], c['sv']))
    acc = '' if vp not in ('esc', 'iv') else f'''<div class="ec-dacc"><button type="button" class="ec-p ec-txt ec-imp">Imprimir</button><a href="#nota.pdf" class="ec-p ec-txt ec-pdf" hidden>Abrir PDF</a>
          <button type="button" class="ec-p ec-ib" aria-label="Más acciones" aria-haspopup="menu" data-menu="nota">{PUNTOS}</button></div>'''
    return f'''<article class="ec-nota ec-art" data-nota="{c["id"]}"{"" if i == 0 else " hidden"} aria-label="Nota del {c["f"]}">
        <!-- Función 24: visor de nota con jerarquía (CALMA §12): diagnóstico 17/700 con su CIE-10 en etiqueta tonal, «Nota manual» y «Nota sellada» como etiquetas con icono, rótulos de sección en color y texto corrido justificado. -->
        <header class="ec-dcab"><div><p class="ec-sub">Nota de Evolución Médica</p>
          <div class="ec-dxl"><h2 class="ec-dx">{c["dx"]}</h2><span class="ec-chip ec-c-ton ec-num">CIE-10 {c["cie"]}</span></div>
          <p class="ec-sub ec-meta ec-num"><span>{c["f"]} · {c["h"]} · Centro</span></p>
          <p class="ec-meta ec-ets">{chip('ton', 'Nota manual')}{chip('ok', 'Nota sellada')}</p></div>{acc}</header>
        <h3>Vitales</h3><dl class="ec-sv">{sv}</dl>
        <h3>Nota</h3><p class="ec-cu ec-just" lang="es">{c["nota"]}</p>
        <h3>Plan</h3><p class="ec-cu ec-just" lang="es">{c["plan"]}</p>
        <h3>Próxima cita</h3><p class="ec-cu ec-clave ec-num">{c["prox"]}</p>
        {firma()}
      </article>'''

def fila_con(c, i, vp):
    cur = ' aria-current="true"' if i == 0 and vp in ('esc', 'iv') else ''
    return f'<li><a href="?tab=consultas&amp;consulta={c["id"]}" class="ec-p ec-fila" data-con="{c["id"]}"{cur}><span class="ec-ft"><span class="ec-nom">{c["dx"]}</span><span class="ec-sub ec-num">{c["f"]} · {c["h"]} · Centro</span></span>{SIG}</a></li>'

VAC_CON = '''<!-- Función 27: vacío con su enlace. Error (no dibujado): «No se pudieron cargar las consultas.» + reintento de icono. -->
    <div class="ec-tar ec-v0"><div class="ec-vac"><p class="ec-sub">La nota de cada consulta aparecerá aquí en cuanto cierres la primera.</p>
      <a href="/expediente/01/nueva-nota" class="ec-p ec-txt">Iniciar primera consulta</a></div></div>'''

def consultas(vp):
    filas = ''.join(fila_con(c, i, vp) for i, c in enumerate(CONS))
    if vp not in ('esc', 'iv'):
        # Funciones 21 y 23: lista; al tocar, la nota entra a pantalla completa (capa .ec-det) y «‹ Consultas» regresa.
        cuerpo = f'<div class="ec-tar ec-v1"><ul>{filas}</ul></div>'
    else:
        # Función 22: colapsar / expandir el carril (botón de icono con aria-label; al colapsar, el mismo icono queda sobre la nota).
        cuerpo = f'''<div class="ec-md ec-v1">
      <div class="ec-tar ec-lst"><div class="ec-lcab"><span class="ec-sub">3 consultas</span><button type="button" class="ec-p ec-ib ec-plega" aria-label="Colapsar el carril de consultas">{ic(P["panel"], 18, 1.8)}</button></div><ul>{filas}</ul></div>
      <div class="ec-tar ec-vis"><button type="button" class="ec-p ec-ib ec-mostrar" aria-label="Expandir el carril de consultas">{ic(P["panel"], 18, 1.8)}</button>{''.join(nota(c, vp, i) for i, c in enumerate(CONS))}</div>
    </div>'''
    return f'<div class="ec-pan" role="tabpanel" data-pan="consultas" aria-label="Consultas" hidden>{cuerpo}{VAC_CON}</div>'

# ---------------- Documentos ----------------
def rx(items):
    return '<ol class="ec-rx">' + ''.join(f'<li><b>{a}</b>{f"<p class=ec-sub>{b}</p>" if b else ""}</li>' for a, b in items) + '</ol>'

def cuerpo_doc(d):
    k = d['id']
    par = lambda a, b: f'<dl class="ec-pares"><div><dt>Paciente</dt><dd>Paciente Prueba 01</dd></div><div><dt>{a}</dt><dd>{b}</dd></div></dl>'
    if k == 'rec':
        return par('Diagnóstico', 'Lumbago') + '<h3>Medicamentos</h3>' + rx([('Paracetamol, tabletas 500 mg', 'Vía oral · 1 tableta cada 8 horas por 5 días'), ('Diclofenaco, gel 1 %', 'Vía tópica · aplicar en zona lumbar cada 12 horas')]) + \
            '<h3>Recomendaciones generales</h3><p class="ec-cu ec-just" lang="es">Calor local 20 minutos, dos veces al día. Evitar cargar objetos pesados. Cita de control en 2 semanas.</p>' + firma()
    if k == 'lab':
        return par('Diagnóstico', 'Gonalgia') + '<h3>Estudios</h3>' + rx([('Biometría hemática completa', ''), ('Química sanguínea de 6 elementos', 'Indicación: ayuno de 8 horas'), ('Vitamina D (25-OH)', '')]) + firma()
    if k == 'img':
        return par('Diagnóstico', 'Gonalgia') + '<h3>Estudios</h3>' + rx([('Radiografía de rodilla derecha', 'Proyecciones AP y lateral · con apoyo')]) + firma()
    if k == 'con':
        return par('Procedimiento', 'Infiltración de rodilla') + '<h3>Riesgos y beneficios</h3><p class="ec-cu ec-just" lang="es">Borrador en captura: faltan las firmas del paciente y de los testigos.</p>' + firma()
    return '''<!-- Función 40: un archivo subido no tiene visor aquí; se enlaza a la pestaña de archivos (onIrAArchivos). Hoy solo llega aquí por enlace directo. -->
        <p class="ec-cu ec-just" lang="es" style="margin-top:14px">Este es un archivo clínico subido, no un documento que la app componga. Se lee y se gestiona en la pestaña «Mediciones y archivos».</p>
        <a href="?tab=mediciones" class="ec-p ec-txt" data-ir="mediciones" style="margin-left:-4px">Ir a Mediciones y archivos</a>'''

def acc_doc(d, vp):
    # Funciones 31–38. En ancho, UN tonal + UNA acción de texto + «···» (el primario de la pantalla es «Nueva consulta», en la ficha).
    if d['id'] == 'con':
        uno = '<a href="/expediente/01/documentos?tipo=consentimiento&amp;doc=con" class="ec-p ec-tonal">Seguir editándolo</a>'
        dos = ''
    else:
        uno = '<button type="button" class="ec-p ec-tonal ec-bdl">Descargar PDF</button>'
        dos = '<button type="button" class="ec-p ec-txt" data-a="enviar">Enviar al paciente</button><span class="ec-sub ec-si-falla">No se pudo preparar la descarga · toca para reintentar</span>' if vp in ('esc', 'iv') else ''
    return (f'<div class="ec-dacc"><button type="button" class="ec-p ec-ib" aria-label="Más acciones" aria-haspopup="menu" data-menu="doc">{PUNTOS}</button></div>'
            f'<div class="ec-dacc2">{uno}{dos}</div>')

def doc(d, vp, i):
    chip_ = chip(d["chip"][0], d["chip"][1]) if d.get('chip') else ''
    meta = d['f'] + (f' · {d["folio"]}' if d['folio'] else '')
    extra = '<span>El folio se asigna al emitirse</span>' if d['id'] == 'con' else ''
    acc = '' if vp not in ('esc', 'iv') else acc_doc(d, vp)
    return f'''<article class="ec-nota ec-art" data-docv="{d["id"]}"{"" if i == 0 else " hidden"} aria-label="{d["titulo"]}">
        <!-- Función 30: visor de documento; un solo chip («Urgente» o «Borrador»). El icono del tipo, en su color, encabeza el título (nivel 3). -->
        <header class="ec-dcab"><div><h2 class="ec-dt">{dic(d["tipo"])}<span>{d["titulo"]}</span></h2><p class="ec-sub ec-meta ec-num"><span>{meta}</span>{chip_}{extra}</p></div>{acc}</header>
        <div class="ec-dsep"></div>
        {cuerpo_doc(d)}
      </article>'''

def fila_doc(d, i, vp):
    cur = ' aria-current="true"' if i == 0 and vp in ('esc', 'iv') else ''
    chip_ = chip(d["chip"][0], d["chip"][1]) if d.get('chip') else ''
    return f'<li data-tipo="{d["tipo"]}"><a href="?tab=documentos&amp;documento={d["id"]}" class="ec-p ec-fila" data-doc="{d["id"]}"{cur}>{dic(d["tipo"])}<span class="ec-ft"><span class="ec-nom">{d["corto"]}</span><span class="ec-l2"><span class="ec-sub ec-num">{" ".join(d["f"].split()[:2])} · {d["ref"]}</span>{chip_}</span></span>{SIG}</a></li>'

def filtro(k, aria, rot='Todos'):
    return f'<button type="button" class="ec-p ec-txt ec-fil" aria-haspopup="menu" aria-label="{aria}" data-menu="{k}"><b>{rot}</b>{ABAJO}</button>'

VAC_DOC = '''<!-- Función 39: vacío con «Crear documento» (de texto; abre la misma rejilla de tipos). -->
    <div class="ec-tar ec-v0"><div class="ec-vac"><p class="ec-sub">Este paciente todavía no tiene documentos.</p><button type="button" class="ec-p ec-txt" data-abre="nuevo" aria-haspopup="dialog">Crear documento</button></div></div>'''
# Función 39: aviso en línea con «Cerrar» (resultado de enviar o de regenerar).
AVL = '<p class="ec-avl" role="status" hidden><span></span><button type="button" class="ec-p ec-txt ec-avl-x">Cerrar</button></p>'

def documentos(vp):
    filas = ''.join(fila_doc(d, i, vp) for i, d in enumerate(DOCS))
    cab = f'<div class="ec-lcab"><span class="ec-sub ec-cuenta">5 documentos</span>{filtro("fdoc", "Filtrar documentos por tipo", "Todos los tipos")}</div>'
    sin = '<p class="ec-sub ec-vac ec-sind" hidden>Sin documentos de este tipo.</p>'
    if vp not in ('esc', 'iv'):
        cuerpo = f'<div class="ec-v1">{cab}<div class="ec-tar"><ul class="ec-dl">{filas}</ul>{sin}</div></div>'
    else:
        cuerpo = f'''<div class="ec-md ec-v1">
      <div class="ec-tar ec-lst">{cab}<ul class="ec-dl">{filas}</ul>{sin}</div>
      <div class="ec-tar ec-vis">{AVL}{''.join(doc(d, vp, i) for i, d in enumerate(DOCS))}</div>
    </div>'''
    return f'''<div class="ec-pan" role="tabpanel" data-pan="documentos" aria-label="Documentos" hidden>
    <!-- Función 28: filtro por tipo como control discreto («Todos los tipos ⌄») que abre un menú con los ocho tipos y sus conteos.
         Cada fila lleva el icono de su tipo en su color (nivel 3). -->
    {cuerpo}{VAC_DOC}</div>'''

# ---------------- Mediciones y archivos ----------------
def grafica(x, n):
    # Gráfica sobria: bandas «Normal» y «Atención» muy rebajadas, una línea en var(--accion) y puntos. El SVG solo traza; ejes y fechas son HTML (no se deforman).
    regs = list(reversed(x['reg'][:n]))
    lo, hi = x['esc']
    y = lambda v: round(100 - (v - lo) / (hi - lo) * 100, 1)
    k = len(regs)
    xs = [50.0] if k == 1 else [round(4 + i * 92 / (k - 1), 1) for i in range(k)]
    vals = [[float(v) for v in r[2].split('/')] for r in regs]
    bandas = ''
    marcas = [lo, hi]
    if x.get('ok'):
        (o0, o1), (w0, w1) = x['ok'], x['warn']
        bandas = f'<rect class="ec-g-ag" x="0" width="100" y="{y(w1)}" height="{round(y(w0) - y(w1), 1)}"/><rect class="ec-g-ok" x="0" width="100" y="{y(o1)}" height="{round(y(o0) - y(o1), 1)}"/>'
        marcas = [o0, o1]
    lineas = ''.join(f'<polyline class="ec-g-l{" ec-g-l2" if j else ""}" points="{" ".join(f"{xs[i]},{y(v[j])}" for i, v in enumerate(vals))}"/>' for j in range(len(vals[0]))) if k > 1 else ''
    puntos = ''.join(f'<i class="ec-g-p{" ec-g-p2" if j else ""}" style="left:{xs[i]}%;top:{y(v[j])}%"></i>' for i, v in enumerate(vals) for j in range(len(v)))
    ejey = ''.join(f'<span style="top:{y(v)}%">{v}</span>' for v in marcas)
    ejex = ''.join(f'<span{" class=ec-g-xm" if k > 4 and 0 < i < k - 1 else ""} style="left:{xs[i]}%">{" ".join(r[0].split()[:2])}</span>' for i, r in enumerate(regs))
    return (f'<div class="ec-graf" data-n="{n}"{"" if n >= len(x["reg"]) else " hidden"} >'
            f'<div class="ec-g-y ec-num" aria-hidden="true">{ejey}</div><div class="ec-g-a"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{bandas}{lineas}</svg>{puntos}</div>'
            f'<div class="ec-g-x ec-num" aria-hidden="true">{ejex}</div></div>')

def analito_art(x):
    T = len(x['reg'])
    ops = [n for n in (3, 5, 10) if T > n]
    f0, h0, v0, _ = x['reg'][0]
    # Función 45: encabezado. Categoría, unidad y «Custom» van como texto plano (hoy son tres chips); el único chip es el estado.
    sub = f'{x["cat"]} · {x["u"]}' + (' · Custom' if x.get('custom') else '')
    var = f'<span class="ec-sub ec-num">{x["delta"]} desde el inicio</span>' if T > 1 else '<span class="ec-sub">Primera medición registrada</span>'
    # «En rango» va como texto; solo «Fuera de rango» (o «A vigilar») merece chip.
    est = '' if not x.get('est') else chip(x['est'][0], x['est'][1])
    # Función 46: cuántas mediciones ver. Las opciones dependen del total (con 6: 3 · 5 · Todas; con 3 o menos, el control no existe).
    seg = ''
    if ops:
        bs = ''.join(f'<button type="button" class="ec-p ec-sg ec-lim" data-n="{n}" aria-pressed="false">{n}</button>' for n in ops)
        seg = f'<div class="ec-seg ec-seg-lim" role="group" aria-label="Últimas mediciones">{bs}<button type="button" class="ec-p ec-sg ec-lim" data-n="{T}" aria-pressed="true">Todas</button></div>'
    grafs = ''.join(grafica(x, n) for n in ops + [T])
    # Función 48: leyenda de bandas, como texto con un punto de color; sin rangos, la frase de hoy.
    cl = ['ok', 'ag', 'mal'] if len(x['ley']) == 3 else ['ok', 'mal']
    ley = ('<ul class="ec-ley">' + ''.join(f'<li><i class="ec-ley-{c}" aria-hidden="true"></i>{l}</li>' for c, l in zip(cl, x['ley'])) + '</ul>') if x['ley'] else \
        '<p class="ec-sub ec-ley-0">Este analito no tiene rangos de referencia definidos.</p>'
    # Función 49: registros. La nota va entera en su línea (hoy se trunca a 50 caracteres y el resto vive en un title). Con más de 10 registros
    # aparece al pie «Ver todas (N)» / «Ver menos» (botón de texto; no se dibuja porque ningún analito de la semilla llega a 11).
    # Dos mediciones del mismo día muestran «↳ hora» en la segunda.
    regs = ''.join(f'''<li class="ec-reg" data-i="{i}"><span class="ec-reg-f ec-num">{f}, {h}</span><span class="ec-reg-v ec-num">{v} <small>{x["u"]}</small></span>
            <span class="ec-reg-n ec-sub{"" if nt else " ec-reg-n0"}">{nt or "—"}</span><button type="button" class="ec-p ec-ib ec-reg-x" aria-label="Eliminar medición" data-del="{x["n"]}|{f}, {h}">{ic(P["basura"], 18, 1.8)}</button></li>'''
                   for i, (f, h, v, nt) in enumerate(x['reg']))
    return f'''<article class="ec-nota ec-art ec-anv" data-anv="{x["id"]}" hidden aria-label="{x["n"]}">
        <header class="ec-an-cab"><div><h2>{x["n"]}</h2><p class="ec-sub">{sub}</p></div>
          <div class="ec-an-vv"><p class="ec-an-big ec-num">{v0} <small>{x["u"]}</small></p><p class="ec-sub ec-num">{f0}, {h0}</p></div></header>
        <div class="ec-an-l2">{var}{est}<span class="ec-flex"></span>{seg}</div>
        <div class="ec-no-sinr">{grafs}</div>
        <!-- Función 47: rango sin mediciones -->
        <div class="ec-vac ec-si-sinr"><p class="ec-nom">No hay mediciones en este rango</p><p class="ec-sub">Cambia el rango temporal para ver el histórico completo.</p>
          <button type="button" class="ec-p ec-txt ec-vertodas">Ver todas</button></div>
        {ley}
        <ul class="ec-regs ec-no-sinr"><li class="ec-reg ec-reg-h" aria-hidden="true"><span>Fecha y hora</span><span>Valor</span><span>Notas</span><span></span></li>{regs}</ul>
      </article>'''

def previa_svg(n):
    if n.endswith('jpg'):
        return '<svg viewBox="0 0 120 90" aria-hidden="true"><rect class="ec-pv-f" x="34" y="8" width="52" height="74" rx="4"/><path class="ec-pv-l" d="M54 16c-2 12-2 20 0 28m12-28c2 12 2 20 0 28M52 50c4 3 12 3 16 0M54 56c-2 8-2 14 0 20m12-20c2 8 2 14 0 20"/></svg>'
    return '<svg viewBox="0 0 120 90" aria-hidden="true"><rect class="ec-pv-h" x="32" y="6" width="56" height="78" rx="3"/><path class="ec-pv-l" d="M40 18h28M40 28h40M40 36h40M40 44h34M40 56h40M40 64h40M40 72h22"/></svg>'

def archivo_art(i, a):
    n, t, f, p, fl = a
    # Función 55: vista previa (PDF en iframe, imagen, DICOM con Cornerstone). Aquí, un boceto del archivo. Estados no dibujados: «Cargando documento…»,
    # «No se pudo generar el enlace al documento.» y, para otros formatos, «Formato sin vista previa inline. Usa Descargar para verlo.»
    return f'''<article class="ec-nota ec-art ec-arv" data-arv="{i}" hidden aria-label="{n}">
        <h2 class="ec-arch-n ec-dt">{aic(n, t)}<span>{n}</span></h2><p class="ec-sub ec-num">{t} · {fl}</p>
        <div class="ec-prev" role="img" aria-label="{n}">{previa_svg(n)}</div>
      </article>'''

def mediciones(vp):
    def fa(x):
        chip = f'<span class="ec-an-c">{FUERA}</span>' if x.get('fuera') else ''
        tend = f' <i class="ec-tend" role="img" aria-label="{x["t"][1]}">{x["t"][0]}</i>' if x.get('t') else ''
        dp = ' ec-an-p' if x['d'] == 'primera' else ''
        return (f'<li><a href="#" class="ec-p ec-an" data-an="{x["id"]}"><span class="ec-nom">{x["n"]}</span><span class="ec-val ec-num">{x["v"]}{tend}</span>'
                f'<span class="ec-an-m ec-num"><span class="ec-an-f"><span class="ec-corto">{x["fc"]}</span><span class="ec-largo">{x["f"]}</span></span><span class="ec-an-d{dp}">{x["d"]}</span></span>{chip}{SIG}</a></li>')
    fl = ''.join(f'<li data-fmt="{"imagen" if n.endswith("jpg") else "pdf"}"><a href="#" class="ec-p ec-fila" data-ar="{i}">{aic(n, t)}<span class="ec-ft"><span class="ec-nom">{n}</span><span class="ec-l2"><span class="ec-sub ec-num">{t} · <span class="ec-corto">{f[:6]}</span><span class="ec-largo">{f} · {p}</span></span></span></span>{SIG}</a></li>' for i, (n, t, f, p, fl_) in enumerate(ARCH))
    # Computadora: el detalle del analito entra en la propia pestaña (misma idea que el detalle a pantalla completa del teléfono) y «‹ Mediciones y archivos» regresa.
    sub = '' if vp not in ('esc', 'iv') else f'''<div class="ec-ansub">
      <button type="button" class="ec-p ec-volver ec-anvolver">{ic(P["izq"], 16, 2.4)}<span>Mediciones y archivos</span></button>
      <div class="ec-tar">{''.join(analito_art(x) for x in ANAL)}</div></div>'''
    mas = ic(P['mas'], 14, 2.4)
    return f'''<div class="ec-pan" role="tabpanel" data-pan="mediciones" aria-label="Mediciones y archivos" hidden>
    <!-- Función 41: analitos con último valor y tendencia («primera» si solo hay una medición). Función 42: «+ Medición» abre la hoja/modal «Agregar medición»
         (43–44). Tocar una fila abre el detalle del analito (45–49): pantalla completa en teléfono y Duo abierto, dentro de la pestaña en computadora. -->
    <div class="ec-anlista">
    <section class="ec-grupo">
      <div class="ec-sh"><h2>Mediciones longitudinales</h2></div>
      <div class="ec-lcab"><span class="ec-sub ec-num"><span class="ec-v1">Analitos rastreados · 4</span></span><button type="button" class="ec-p ec-tonal ec-masmed" data-abre="medicion" aria-haspopup="dialog">{mas}Medición</button></div>
      <div class="ec-tar ec-v1"><ul>
        {'<li class="ec-an-h" aria-hidden="true"><span>Analito</span><span>Último valor</span><span>Estado</span><span>Fecha</span></li>' if vp == 'iv' else ''}{''.join(fa(x) for x in ANAL)}</ul></div>
      <!-- Función 50: vacío -->
      <div class="ec-tar ec-v0"><div class="ec-vac"><p class="ec-sub">Sin mediciones registradas. Agrega el primer dato para empezar el seguimiento.</p></div></div>
    </section>
    <!-- Funciones 51–56: archivos clínicos. La zona punteada abre el selector con un toque y, en computadora, acepta arrastrar y soltar (se resalta con
         contorno de 2 px var(--enlace)); ambas llevan a «Subir documento clínico» (53). Sin clínica (52) la zona se atenúa y el motivo va escrito debajo.
         La fila abre la vista previa (55) con «Descargar»; «Eliminar archivo» (56) vive ahí, en «···» o al pie → alerta. -->
    <section class="ec-grupo">
      <div class="ec-sh"><h2>Archivos clínicos</h2></div>
      <div class="ec-lcab ec-v1"><span class="ec-sub ec-num">2 archivos</span>{filtro("farch", "Filtrar archivos por formato")}</div>
      <div class="ec-tar"><ul class="ec-al ec-v1">{fl}</ul><p class="ec-sub ec-vac ec-sina" hidden>Sin archivos de este formato.</p>
        <div class="ec-vac ec-v0"><p class="ec-sub" style="margin:0">Sin archivos clínicos. Sube resultados de laboratorio o estudios de imagen.</p></div>
        <button type="button" class="ec-p ec-zona ec-zonal" data-abre="subir" aria-haspopup="dialog">Arrastra archivos aquí o haz clic para subir</button>
        <p class="ec-sub ec-si-sincl ec-zona-m">Configura tu clínica antes de subir archivos</p></div>
    </section>
    </div>
    {sub}
  </div>'''

# ---------------- Capas ----------------
def mi(rot, attrs='', cl='', sub='', cta=None, radio=False, pre='', i=''):
    if i:
        pre = f'<span class="ec-mic">{ic(P[i], 20, 1.8)}</span>'
    r = ' role="menuitemradio"' if radio else ' role="menuitem"'
    s = f'<small>{sub}</small>' if sub else ''
    c = f'<i>{cta}</i>' if cta is not None else ''
    chk = ic(P['ok'], 18, 2.2, 'ec-chk') if radio else ''
    return f'<button type="button"{r} class="ec-p ec-mi {cl}" {attrs}>{pre}<span><span>{rot}</span>{s}</span>{c}{chk}</button>'

def campo(rot, ctl, cl=''):
    return f'<label class="ec-campo {cl}"><span>{rot}</span>{ctl}</label>'

def sel(ops, aria=''):
    a = f' aria-label="{aria}"' if aria else ''
    return f'<span class="ec-sel"><select class="ec-in"{a}>{"".join(f"<option>{o}</option>" for o in ops)}</select>{ic(P["abajo"], 16, 2)}</span>'

def hoja(k, titulo, subt, cuerpo, pie, cl=''):
    s = f'<p class="ec-sub ec-hsub">{subt}</p>' if subt else ''
    return f'''<div class="ec-capa" data-capa="{k}" aria-hidden="true">
  <div class="ec-velo"></div>
  <div class="ec-hoja {cl}" role="dialog" aria-modal="true" aria-label="{titulo}">
    <span class="ec-asa" aria-hidden="true"></span>
    <header class="ec-hcab"><div><h2>{titulo}</h2>{s}</div><button type="button" class="ec-p ec-ib ec-cierra" aria-label="Cerrar">{ic(P["x"], 20, 2)}</button></header>
    <div class="ec-hcu">{cuerpo}</div>
    {pie}
  </div>
</div>'''

CATS = ['Antropometría', 'Signos vitales', 'Hematología', 'Química', 'Hueso', 'Endocrino', 'Inmunología', 'Coagulación', 'Cardíaco', 'Marcadores tumorales', 'Vitaminas y minerales', 'Otros']

def hojas(vp):
    # --- Rejilla «Nuevo documento» (CALMA §9, nivel 4): ocho azulejos, 2 columnas en teléfono y 4 en ancho. ---
    az = ''.join(f'<a href="/expediente/01/documentos?tipo={k}" class="ec-p ec-az"><span class="ec-az-i" style="--c:var(--{v[0]})">{ic(v[2], 20, 1.8)}</span><span>{v[1]}</span></a>' for k, v in DI.items())
    nuevo = hoja('nuevo', 'Tipo de documento', '', f'<!-- Función 5: elegir qué documento crear. Cada azulejo abre su formulario en /expediente/01/documentos?tipo=… (otra pantalla). --><div class="ec-rej">{az}</div>', '', 'ec-hoja-rej')
    # --- Agregar medición (funciones 43 y 44) ---
    sug = [('Química', [('Glucosa en ayuno', 'mg/dL', ''), ('Hemoglobina glucosilada (HbA1c)', '%', '')]), ('Signos vitales', [('Presión arterial', 'mmHg', 'ta')]), ('Antropometría', [('Peso', 'kg', '')])]
    lista = ''.join(f'<p class="ec-sug-c">{c}</p>' + ''.join(f'<button type="button" class="ec-p ec-sug-i" data-u="{u}" data-ta="{ta}"><span>{n}</span><small>{u}</small></button>' for n, u, ta in its) for c, its in sug)
    med = f'''<!-- Función 43: autocompletar del catálogo (en la app: ↑ ↓ Enter Esc; sin coincidencias, «Sin resultados para “…”»). La lista se abre al enfocar el campo.
           «¿No encuentras el analito? Crear como custom» pasa al modo «Analito personalizado»; «Volver al catálogo» regresa. -->
      <div class="ec-solo-cat">{campo('Analito', f'<span class="ec-bus">{ic(P["buscar"], 18, 2)}<input class="ec-in ec-an-in" type="text" autocomplete="off" placeholder="Buscar analito (ej. HbA1c, creatinina, peso)..."></span>')}
        <div class="ec-sug" hidden>{lista}<button type="button" class="ec-p ec-sug-x ec-acustom">{ic(P["mas"], 18, 2.2)}<span>¿No encuentras el analito? Crear como custom</span></button></div></div>
      <div class="ec-solo-cus"><button type="button" class="ec-p ec-tonal ec-acat">{ic(P["izq"], 14, 2.4)}Volver al catálogo</button>{campo('Nombre del analito', '<input class="ec-in" type="text" maxlength="100" placeholder="Ej. Mi marcador personalizado">')}
        <div class="ec-dos">{campo('Unidad', '<input class="ec-in" type="text" maxlength="30" placeholder="mg/dL, UI/mL…">')}{campo('Categoría', sel(CATS[-1:] + CATS[:-1]))}</div></div>
      <!-- Función 44: valor (dos campos para presión arterial), fecha, hora y notas. Errores (no dibujados): una línea var(--mal-tinta) sobre el pie
           con «Selecciona un analito», «Datos inválidos» o «Error al guardar». -->
      <div class="ec-no-ta">{campo('Valor', '<span class="ec-uni"><input class="ec-in" type="text" inputmode="decimal" placeholder="0"><small class="ec-uni-t">—</small></span>')}</div>
      <div class="ec-dos ec-si-ta">{campo('TA sistólica (mmHg)', '<input class="ec-in" type="text" inputmode="decimal" placeholder="135">')}{campo('TA diastólica (mmHg)', '<input class="ec-in" type="text" inputmode="decimal" placeholder="85">')}</div>
      <div class="ec-dos">{campo('Fecha', '<input class="ec-in ec-num" type="text" inputmode="numeric" value="19/11/2026">')}{campo('Hora', '<input class="ec-in ec-num" type="text" inputmode="numeric" value="10:42">')}</div>
      {campo('Notas (opcional)', '<textarea class="ec-in ec-ta" rows="2" maxlength="500" placeholder="Contexto clínico breve…"></textarea>')}'''
    pie_med = '<footer class="ec-hpie"><button type="button" class="ec-p ec-bl ec-bq ec-cierra">Cancelar</button><button type="button" class="ec-p ec-bl ec-prim ec-guarda">Guardar</button></footer>'
    medicion = hoja('medicion', 'Agregar medición', '<span class="ec-solo-cat">Desde catálogo clínico</span><span class="ec-solo-cus">Analito personalizado</span>', med, pie_med)
    # --- Subir documento clínico (función 53) ---
    def arch(n, peso, tipo):
        tipos = ['Resultado de laboratorio', 'Estudio de imagen']
        return f'''<li class="ec-arch"><div class="ec-arch-c">{aic(n, tipos[tipo])}<span class="ec-ft"><span class="ec-nom">{n}</span><span class="ec-sub ec-num">{peso}</span></span>
            <button type="button" class="ec-p ec-ib ec-quita" aria-label="Quitar archivo">{ic(P["x"], 18, 2)}</button></div>
          <div class="ec-dos ec-dos-a">{campo('Tipo', sel(tipos[tipo:] + tipos[:tipo]))}{campo('Fecha del estudio', '<input class="ec-in ec-num" type="text" inputmode="numeric" value="19/11/2026">')}</div>
          {campo('Descripción (opcional)', '<input class="ec-in" type="text" placeholder="Ej. Biometría hemática de control">')}</li>'''
    sub = f'''<!-- Zona: un toque abre el selector del sistema (en la maqueta agrega dos archivos de ejemplo); en computadora también recibe lo que se arrastre.
           Errores por archivo (no dibujados): una línea var(--mal-tinta) bajo el nombre, p. ej. «Archivo demasiado grande. Máx 50MB.» -->
      <button type="button" class="ec-p ec-zona ec-zonah ec-no-res"><span>Arrastra archivos aquí o click para seleccionar</span><small>PDF, JPG, PNG, DCM · máx 50MB por archivo</small></button>
      <ul class="ec-archs ec-no-res">{arch('quimica-sanguinea.pdf', '312 KB', 0)}{arch('radiografia-lumbar-lateral.jpg', '2.1 MB', 1)}</ul>
      <p class="ec-res-t ec-si-res" role="status">{ic(P["ok"], 18, 2.2)}<span><span class="ec-cta-a">2</span> de <span class="ec-cta-a">2</span> archivos subidos</span></p>'''
    pie_sub = '<footer class="ec-hpie"><button type="button" class="ec-p ec-bl ec-bq ec-cierra"><span class="ec-no-res">Cancelar</span><span class="ec-si-res">Cerrar</span></button><button type="button" class="ec-p ec-bl ec-prim ec-sube ec-no-res" aria-disabled="true"><span>Subir <span class="ec-cta-a">0</span> <span class="ec-cta-p">archivos</span></span></button></footer>'
    subir = hoja('subir', 'Subir documento clínico', 'PDF, JPG, PNG o DICOM', sub, pie_sub)
    # --- Vista previa de archivo: en computadora es un modal ancho; en teléfono y Duo abierto entra a pantalla completa (ver detalle()). ---
    previa = ''
    if vp in ('esc', 'iv', 'ext'):
        pie_prev = '<footer class="ec-hpie ec-hpie3"><button type="button" class="ec-p ec-bl ec-bdes" data-a="eliminar-arch">Eliminar archivo</button><span class="ec-flex"></span><button type="button" class="ec-p ec-bl ec-bq ec-cierra">Cerrar</button><button type="button" class="ec-p ec-bl ec-prim">Descargar</button></footer>'
        previa = hoja('previa', ARCH[0][0], ARCH[0][4], ''.join(archivo_art(i, a) for i, a in enumerate(ARCH)), pie_prev, 'ec-hoja-ancha')
    return nuevo + medicion + subir + previa

def capas(vp):
    sep = '<span class="ec-msep" role="separator"></span>'
    asa = '<span class="ec-asa" aria-hidden="true"></span>'
    pac = ''
    if vp == 'ih':
        pac += mi('Nuevo documento', 'data-a="doc"', i='docmas')
    if vp != 'esc':
        pac += mi('Editar', 'data-a="editar"', i='lapiz')
    pac += mi('Exportar', 'data-a="exportar"', i='exportar') + sep + mi('Eliminar paciente', 'data-a="eliminar"', 'ec-mi-mal', i='basura')
    docm = ''
    if vp not in ('esc', 'iv'):
        docm += mi('Enviar al paciente', 'data-b data-a="enviar"', i='enviar', sub='<span class="ec-si-borr">Este documento es un borrador. Emítelo antes de enviarlo.</span>')
    docm += mi('Compartir', 'data-b data-a="compartir"', i='compartir', sub='<span class="ec-si-borr">No hay archivo que compartir; genera el PDF primero.</span>') + mi('Regenerar PDF', 'data-a="regenerar"', i='regen') + sep + \
        mi('<span class="ec-no-borr">Eliminar documento</span><span class="ec-si-borr">Cancelar borrador</span>', 'data-a="eliminar-doc"', 'ec-mi-mal', i='basura')
    fdoc = ''.join(mi(n, f'data-fil="{k}" aria-checked="{"true" if k == "todos" else "false"}"', cta=c, radio=True, pre=dic(k) if k in DI else f'<span class="ec-mic">{ic(P["rejilla"], 20, 1.8)}</span>') for k, n, c in TIPOS)
    farch = ''.join(mi(n, f'data-fa="{k}" aria-checked="{"true" if k == "todos" else "false"}"', radio=True, i=g) for k, n, g in [('todos', 'Todos', 'rejilla'), ('imagen', 'Imágenes', 'foto'), ('pdf', 'PDF', 'doc'), ('dicom', 'DICOM', 'archivador')])
    return f"""<!-- Menús: hoja corta de acciones en teléfono; en ancho nacen del botón que los abre. Cada opción lleva su icono (CALMA §11): en color de acción las normales,
     en rojo la destructiva; el filtro por tipo lleva el icono de color de cada documento. En Duo abierto el menú es una tarjeta centrada en el contenido.
     En la app la entrada y la salida serán un resorte (amortiguación 1.0, respuesta 0.3), interrumpible y arrastrable desde el asa. -->
<div class="ec-capa" data-capa="menu" aria-hidden="true">
  <div class="ec-velo"></div>
  <!-- Funciones 3, 4 y 9: Editar, Exportar y Eliminar paciente (separado y en rojo) -->
  <div class="ec-menu" role="menu" data-m="pac" aria-label="Acciones del paciente">{asa}{pac}</div>
  <!-- Función 26 (y «Añadir nota aclaratoria», que hoy solo ve el médico que firmó la nota) -->
  <div class="ec-menu" role="menu" data-m="nota" aria-label="Más acciones">{asa}{mi('Abrir nota completa', 'data-a="nota"', i='abrir')}{mi('Añadir nota aclaratoria', 'data-a="nota"', i='notamas')}</div>
  <!-- Funciones 32–37 (función 36: este menú). Las bloqueadas llevan el motivo escrito debajo, no en un title. «Compartir» abre la hoja nativa del sistema. -->
  <div class="ec-menu" role="menu" data-m="doc" aria-label="Más acciones">{asa}{docm}</div>
  <div class="ec-menu ec-menu-alto" role="menu" data-m="fdoc" aria-label="Filtrar documentos por tipo">{asa}{fdoc}</div>
  <!-- Función 54 -->
  <div class="ec-menu" role="menu" data-m="farch" aria-label="Filtrar archivos por formato">{asa}{farch}</div>
  <!-- Función 56 (teléfono y Duo abierto): «···» de la vista previa -->
  <div class="ec-menu" role="menu" data-m="arch" aria-label="Más acciones">{asa}{mi('Eliminar archivo', 'data-a="eliminar-arch"', 'ec-mi-mal', i='basura')}</div>
</div>
{hojas(vp)}
<!-- Alerta de confirmación (patrón único, CALMA §13): icono en círculo tintado, título centrado, mensaje y DOS botones de verdad del mismo ancho
     (secundario a la izquierda, principal a la derecha); si el rótulo de hoy es largo, se apilan a todo el ancho con el principal arriba.
     Alerta centrada: acciones destructivas (funciones 9, 37, 49 y 56) y «El correo no coincide» (34). El guion le pone título, cuerpo y botón.
     Estados no dibujados: «Eliminando…» en el botón y el error en una línea sobre los botones. -->
<div class="ec-capa" data-capa="alerta" aria-hidden="true">
  <div class="ec-velo"></div>
  <div class="ec-alerta" role="alertdialog" aria-modal="true" aria-label="Eliminar paciente">
    <span class="ec-al-i" aria-hidden="true">{ic(P["basura"], 28, 1.8, "ec-al-i1")}{ic(P["alerta"], 28, 1.8, "ec-al-i2")}</span>
    <h2 class="ec-al-h">Eliminar paciente</h2>
    <p class="ec-sub ec-al-s">Paciente Prueba 01</p>
    <div class="ec-al-t" lang="es"></div>
    <p class="ec-sub ec-al-n">Esta acción no se puede deshacer.</p>
    <div class="ec-al-b"><button type="button" class="ec-p ec-bl ec-bq ec-al-no">Cancelar</button><button type="button" class="ec-p ec-bl ec-bdes ec-al-si">Eliminar</button></div>
  </div>
</div>"""

def capa_mas(vp):
    if vp not in ('ext', 'iv'):
        return ''
    return f'''<!-- Menú «Más» (CALMA §28) como tarjeta centrada con velo, copiado de entrega/dashboard-final (que lo tomó de entrega/cromo). -->
<div class="ec-capa ec-capa-m" data-capa="mas" aria-hidden="true">
  <div class="ec-velo"></div>
  <div class="ec-mnw"><div class="ec-mn" role="dialog" aria-modal="true" aria-label="Más">
    <h2 class="ec-mn-t">Más</h2>
    {ap(vp, "mas")}
{MAS0}
  </div></div>
</div>'''

def detalle():
    # Teléfono y Duo abierto: el detalle (nota, documento, analito o archivo) ocupa la pantalla dentro del marco; sale por donde entró.
    return f"""<div class="ec-det" data-k="con" aria-hidden="true">
    <div class="ec-dbar">
      <button type="button" class="ec-p ec-volver ec-dvolver">{ic(P["izq"], 16, 2.4)}<span class="ec-k ec-k-con">Consultas</span><span class="ec-k ec-k-doc">Documentos</span><span class="ec-k ec-k-an ec-k-ar">Mediciones y archivos</span></button>
      <span class="ec-flex"></span>
      <!-- Función 25: «Imprimir» → «Generando…» → «Abrir PDF» -->
      <button type="button" class="ec-p ec-txt ec-imp ec-k ec-k-con">Imprimir</button><a href="#nota.pdf" class="ec-p ec-txt ec-pdf ec-k ec-k-con" hidden>Abrir PDF</a>
      <button type="button" class="ec-p ec-ib ec-k ec-k-con" aria-label="Más acciones" aria-haspopup="menu" data-menu="nota">{PUNTOS}</button>
      <button type="button" class="ec-p ec-ib ec-k ec-k-doc" aria-label="Más acciones" aria-haspopup="menu" data-menu="doc">{PUNTOS}</button>
      <button type="button" class="ec-p ec-txt ec-k ec-k-ar">Descargar</button>
      <button type="button" class="ec-p ec-ib ec-k ec-k-ar" aria-label="Más acciones" aria-haspopup="menu" data-menu="arch">{PUNTOS}</button>
    </div>
    <div class="ec-dsc">
      {AVL}
      {''.join(nota(c, 'ext', i) for i, c in enumerate(CONS))}
      {''.join(doc(d, 'ext', i) for i, d in enumerate(DOCS))}
      {''.join(analito_art(x) for x in ANAL)}
      {''.join(archivo_art(i, a) for i, a in enumerate(ARCH))}
    </div>
    <!-- Función 31: barra al pie con UN primario. A la izquierda solo se escribe cuando hay algo que decir: «Preparando descarga…» o
         «No se pudo preparar la descarga · toca para reintentar». En un borrador de consentimiento (función 38) el primario es «Seguir editándolo». -->
    <div class="ec-dpie ec-k ec-k-doc"><span class="ec-sub ec-flex"><span class="ec-si-falla">No se pudo preparar la descarga · toca para reintentar</span></span>
      <button type="button" class="ec-p ec-prim ec-no-borr ec-bdl">Descargar PDF</button>
      <a href="/expediente/01/documentos?tipo=consentimiento&amp;doc=con" class="ec-p ec-prim ec-si-borr">Seguir editándolo</a></div>
  </div>"""

AVISO = f'''<!-- Aviso emergente, arriba. Función 4: exportar deja «Abrir expediente» y una «×» para descartarlo (mientras genera: «Generando expediente — 3 notas»).
       Error (no dibujado): «No se pudo generar el expediente. Intenta de nuevo.» También lo usan los avisos breves («Medición guardada», «Documento eliminado»…). -->
  <div class="ec-aviso" role="status"><span class="ec-av-t">Generando expediente…</span><a href="#expediente.pdf" class="ec-p ec-txt ec-av-a">Abrir expediente</a><button type="button" class="ec-p ec-ib ec-desc" aria-label="Descartar el expediente generado">{ic(P["x"], 18, 2)}</button></div>'''

NOTAS = '''<!-- ESTADOS DE SISTEMA (función 10; no se dibujan):
     · «Cargando expediente…»: la ficha/cabecera muestra avatar y dos barras var(--sup2); las pestañas ya están pintadas; el contenido, tres bloques var(--sup) vacíos.
     · «Paciente no encontrado» y «No pudimos verificar tus permisos»: en el lugar del contenido, título 17/600, una línea 13 px y enlace de texto «‹ Expediente».
     Función 11: todas las acciones (Nueva consulta, Nuevo documento, Editar, Exportar, Eliminar paciente) solo existen con isDoctor.
     Función 8: pestaña y selección viven en la URL (?tab=, ?consulta=, ?documento=); pestañas y filas son enlaces reales con ese href. -->'''

def paneles(vp):
    return resumen(vp) + consultas(vp) + documentos(vp) + mediciones(vp)

def marco(vp):
    if vp in ('ext', 'tel'):
        main = f'''<div class="ec-main">
  <div class="ec-trab"><main class="ec-cont">
  {cab_tel(vp)}
  {paneles(vp)}
  </main></div>
  {detalle()}
  {AVISO}
</div>'''
    elif vp == 'ih':
        main = f'''<div class="ec-main">
  {cab_ih()}
  <div class="ec-trab"><main class="ec-cont">
  {paneles(vp)}
  </main></div>
  {detalle()}
  {AVISO}
</div>'''
    elif vp == 'iv':
        main = f'''<div class="ec-main">
  {cab_iv()}
  <div class="ec-trab"><main class="ec-cont">
  {paneles(vp)}
  </main></div>
  {AVISO}
</div>'''
    else:
        main = f'''<div class="ec-main">
  {ficha()}
  <div class="ec-trab">
  <!-- Área de trabajo: pestañas arriba (sin repetir el nombre) y solo el contenido se desplaza. -->
  {pestanas(vp)}
  <main class="ec-cont">
  {paneles(vp)}
  </main></div>
  {AVISO}
</div>'''
    antes = enc() if vp == 'tel' else (lat(vp) if vp == 'esc' else (enc_iv() if vp == 'iv' else ''))
    desp = riel() if vp == 'ext' else (lat(vp) if vp == 'ih' else '')
    return f'<div class="marco ec" data-vp="{vp}">\n{NOTAS if vp == "ext" else ""}\n<div class="ec-app">\n{antes}\n{main}\n{desp}\n</div>\n{capas(vp)}\n{capa_mas(vp)}\n</div>'

CSS = open(f'{L}/tmp-ec-estilo.css').read()
JS = open(f'{L}/tmp-ec-guion.js').read()
out = ('<!-- NOMBRE: Expediente del paciente | El mismo expediente limpio, ahora con carácter: avatar, etiquetas de estado con color e icono, pestañas de icono en el teléfono, notas con jerarquía y alertas con botones de verdad; ahora también en Duo abierto vertical -->\n'
       '<style>\n' + CSS + '</style>\n' + '\n'.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '\n<script>\n' + JS + '</script>\n')
open(f'{L}/vista-expediente.html', 'w').write(out)
print(len(out))
