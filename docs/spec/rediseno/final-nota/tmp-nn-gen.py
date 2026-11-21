# Generador de vista-nota.html (Nueva nota médica, versión definitiva). Uso: python3 tmp-nn-gen.py
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
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    aviso='<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    basura='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    chispa='<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M19 15.5v4M17 17.5h4"/>',
    lapiz='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    candado='<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    ojo='<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    imprime='<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="9" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    carpeta='<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    paciente='<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.9-4 3.9-6 7.5-6s6.6 2 7.5 6"/>',
    rehacer='<path d="M4 5v5h5"/><path d="M5.2 15a7.5 7.5 0 1 0 1.3-7.6L4 10"/>',
    plantilla='<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/>',
    micro='<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    cambia='<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
    okc='<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16 9.7"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
)
FLECHA = ic(I['sig'], 14, 2.4)

# ---------- Navegación: copiada del dashboard aprobado (prefijo db -> nn; activo = Expediente, CALMA §20) ----------
def riel():
    def b(k, t, act=False):
        return '<a href="#" class="nn-p nn-rb" aria-label="%s"%s>%s</a>' % (t, ' aria-current="page"' if act else '', ic(I[k], 22))
    return ('<nav class="nn-riel" aria-label="Navegación principal">' + b('inicio', 'Inicio') + b('pac', 'Expediente', True) + b('agenda', 'Agenda') + b('docs', 'Documentos')
            + '<button type="button" class="nn-p nn-rb" aria-label="Más" data-abre-mas>' + ic(I['mas'], 22, 3) + CRO['BDG'] + '</button><span class="nn-flex"></span>'
            '<button type="button" class="nn-p nn-mas" aria-label="Nueva consulta">' + ic(I['plus'], 26, 2.4) + '</button></nav>')

def lateral(vp):
    def a(k, t, act=False):
        return '<a href="#" class="nn-p nn-li"%s>%s%s</a>' % (' aria-current="page"' if act else '', ic(I[k], 20), t)
    return ('<nav class="nn-lat" aria-label="Navegación principal"><div class="nn-lat-cab"><span class="nn-logo">' + ic(I['logo'], 24) + '<span class="nn-logo-n">Spinus</span></span><span class="nn-plan">Plan VIP</span></div>'
            '<button type="button" class="nn-p nn-cons-b">' + CRO['CLOGO'] + '<span class="nn-cons-t"><span>Consultorio</span><b>Centro</b></span>' + ic(I['selector'], 16, 2) + '</button>'
            '<div class="nn-lista">' + a('inicio', 'Inicio') + a('pac', 'Expediente', True) + a('agenda', 'Agenda') + a('docs', 'Documentos') + a('admin', 'Administración') + '</div><span class="nn-flex"></span>'
            
            + CRO['ap'](vp, 'lat') + CRO['PIE'] + '</nav>')

def encabezado():
    return ('<header class="nn-enc"><button type="button" class="nn-p nn-menu-b" aria-label="Menú">' + ic(I['menu'], 22, 2) + CRO['BDG'] + '</button><span class="nn-enc-t">Expediente</span><span class="nn-flex"></span>'
            '<button type="button" class="nn-p nn-av nn-av-g" aria-label="Mi perfil">AS</button></header>')

I['barra'] = '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>'
def fundido():
    pista = ''.join('<a href="#" class="nn-p nn-pl"%s>%s</a>' % (' aria-current="page"' if t == 'Expediente' else '', t) for t in ('Inicio', 'Expediente', 'Agenda', 'Documentos')) + '<button type="button" class="nn-p nn-pl" data-abre-mas>Más</button>'
    # CALMA §23.9 · «Más» abre el mismo menú que el «···» del riel de ext (tarjeta «Más» con velo, copiada del dashboard). Sigue marcado «Expediente».
    return ('<!-- Duo abierto vertical (CALMA §19): encabezado fundido con la pista de secciones. Administración, Mi perfil y Ayuda: desde «Mostrar barra lateral» o el avatar. -->\n'
            '<header class="nn-fun"><button type="button" class="nn-p nn-fun-b" aria-label="Mostrar barra lateral">' + CRO['BDG'] + ic(I['barra'], 20) + '</button>'
            '<nav class="nn-pista" aria-label="Navegación principal">' + pista + '</nav>'
            '<button type="button" class="nn-p nn-av nn-av-g" aria-label="Mi perfil">AS</button></header>')

import importlib.util as _iuc
_spc = _iuc.spec_from_file_location('u5cromo', '/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/tools/tmp-u5-cromo.py'); _CRM = _iuc.module_from_spec(_spc); _spc.loader.exec_module(_CRM)
CRO = _CRM.piezas('nn')

# Los ocho tipos: clave, nombre, token de color e icono (copiados de entrega/doc-color/color-documentos.html)
TIPOS = [
 ('receta', 'Receta', 'receta', '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>'),
 ('lab', 'Laboratorio', 'laboratorio', '<path d="M10 2v7.5L4.7 18.6A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.7-2.9L14 9.5V2"/><path d="M8.5 2h7M7 16h10"/>'),
 ('imagen', 'Imagenología', 'imagen', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
 ('sup', 'Suplementación', 'suplementacion', '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6"/>'),
 ('inter', 'Internamiento', 'internamiento', '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>'),
 ('escrito', 'Escrito médico', 'escrito', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
 ('consent', 'Consentimiento', 'consentimiento', '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
 ('honor', 'Honorarios / Cotización', 'honorarios', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>'),
]
ANTES = 'cap gen err rev regen'   # estados anteriores a guardar

# ---------- Piezas ----------
def cabecera(vp):
    esc = vp == 'esc'
    mas = '<button type="button" class="nn-p nn-ib nn-mas-b" data-en="' + ANTES + ' doc ver" aria-label="Más opciones" aria-haspopup="menu">' + ic(I['mas'], 22, 3) + '</button>'
    editar = '' if esc else '<button type="button" class="nn-p nn-txt nn-b-ed" data-en="rev"><span class="nn-ver0">Editar</span><span class="nn-ver1">Vista previa</span></button>'
    quien = '<span class="nn-num">73 años</span>' + (' · Femenino' if esc else '') + '<span class="nn-cons-si"> · Atendiendo en: Centro</span>'
    # En computadora el último diagnóstico es una segunda línea bajo el título; el contexto completo (F21) está en «···» en los cuatro marcos.
    ctx = ('<p class="nn-sub2" data-en="ok">Quedó sellada en el expediente.</p>'
           '<p class="nn-sub2" data-en="' + ANTES + '"><span class="nn-prim-no">Último diagnóstico: Lumbago no especificado</span>'
           '<span class="nn-prim-si">Primera consulta del paciente</span></p>') if esc else ''
    alg = '<span class="nn-alg">' + ic(I['aviso'], 14, 2) + 'Alergias: Penicilina</span>'
    # La etiqueta de alergias va en la línea secundaria, pegada a la identidad, en los cuatro marcos
    return ('''<!-- F1 · Cabecera mínima: «‹ Paciente», título y UNA línea (edad · consultorio). Sin migas de pan. «···» va arriba a la derecha en teléfono y junto al título en computadora.
     F2 · «Atendiendo en: Centro» va en esa línea. Sin consultorio activo la mención desaparece y «Guardar nota» queda deshabilitado, igual que hoy
          (hoy no existe ningún texto para ese estado; ese aviso queda fuera: no existe hoy).
     F25 · ?cita={uuid}: la nota queda ligada a la cita de la agenda y al guardar la marca como atendida; hoy no tiene señal visible y aquí tampoco (no se inventa).
     F26 · Esqueleto de carga (misma silueta: cabecera, fila de signos, superficie en blanco): estado de sistema, sin parte visual propia en esta vista.
           Plan bloqueado: lo resuelve layout.tsx con un redirect a /billing ANTES de pintar esta pantalla; aquí no hay estado que dibujar. -->
<header class="nn-top">
  <div class="nn-top-f"><a href="#" class="nn-p nn-volver" data-en="''' + ANTES + ''' ok">''' + ic(I['volver'], 14, 2.6) + '''<span class="nn-volver-t">Paciente Prueba 01</span></a>
    <button type="button" class="nn-p nn-volver nn-b-docs" data-en="doc ver">''' + ic(I['volver'], 14, 2.6) + '''Nota guardada</button><span class="nn-flex"></span>''' + editar + ('' if esc else mas) + '''</div>
  <div class="nn-h1f"><span class="nn-doc-ic" data-en="doc" aria-hidden="true"></span>
    <h1><span data-en="''' + ANTES + '''">Nueva nota</span><span data-en="ok">Nota guardada</span><span data-en="doc" class="nn-doc-n">Receta</span><span data-en="ver">Nota médica</span></h1>''' + (mas if esc else '') + '''</div>
  <p class="nn-sub"><span class="nn-quien">''' + quien + '''</span>''' + alg + '''</p>''' + ctx + '''
</header>
<!-- F3 · Borrador restaurado: una línea, con «Descartar» como acción de texto -->
<p class="nn-linea nn-borrador" data-en="cap"><span class="nn-flex">Borrador restaurado — continúa donde lo dejaste</span><button type="button" class="nn-p nn-txt nn-borr-x">Descartar</button></p>
<!-- F7/F11 · Error de generación: la descripción se conserva; una línea de error y, al pie, «Cerrar» y «Reintentar» (los dos botones que hoy tiene el modal).
     El texto depende de la causa (se copian del código): «Tu sesión expiró. Recarga la página e inicia sesión de nuevo.» · «Alcanzaste el límite de notas con IA por hoy. Intenta más tarde.» ·
     «La petición no es válida. Revisa el caso e intenta de nuevo.» · «El servicio de IA falló al generar la nota. Intenta de nuevo.» · «Sin conexión. Verifica tu internet e intenta de nuevo.» ·
     «La IA tardó demasiado en responder. Intenta de nuevo en unos segundos.» · «La IA no devolvió una nota válida. Intenta de nuevo.» -->
<p class="nn-linea nn-error" data-en="err" role="alert">''' + ic(I['aviso'], 16, 2) + '''<span class="nn-flex">No se pudo generar la nota. Intenta de nuevo o escríbela manualmente.</span></p>'''
            + ('' if esc else '''
<!-- F19 · Confirmación sobria de «Nota guardada» (ya no es un modal). «Ver nota» abre la nota sellada en lectura (teléfono y Duo abierto; en computadora la nota está a la vista). -->
<p class="nn-linea nn-nota-ok" data-en="ok">''' + ic(I['okc'], 18, 2) + '''<span>Quedó sellada en el expediente.</span></p>'''))

def vfila(en):
    return ('''<!-- F4 · Signos vitales: UNA fila; abre la hoja con los campos. Con valores, el resumen va en una segunda línea (teléfono) o en la misma fila (ancho);
     aguanta el caso largo «148/92 · 104 lpm · 22 rpm · 38.6 °C · 91 %» con su chip «5 fuera de rango». -->
<button type="button" class="nn-p nn-vfila" data-en="''' + en + '''" aria-haspopup="dialog">
  <span class="nn-fn">Signos vitales<span class="nn-chip nn-c-mal nn-vchip" hidden></span></span><span class="nn-vres nn-v1"></span>
  <span class="nn-vacc nn-v0">Sin capturar</span>''' + FLECHA + '''</button>
<span class="nn-sep" data-en="''' + en + '''"></span>''')

def escritura(en):
    return ('''<!-- F5 · El área de escritura: sin título, sin etiqueta, sin ayuda. F3 · «Borrador guardado» aparece al escribir. -->
<div class="nn-esc" data-en="''' + en + '''" data-solo="ia">
  <textarea class="nn-dict" aria-label="Descripción del caso" placeholder="Ej.: Paciente con dolor lumbar de 2 semanas tras cargar peso, sin irradiación, Lasègue negativo, fuerza y reflejos normales. Indico naproxeno 500 mg cada 12 h por 7 días, ejercicios de McKenzie, cita en 2 semanas."></textarea>
  <span class="nn-autog" hidden>Borrador guardado</span>
</div>''')

def manual(en):
    def f(cls, et, ph):
        return '<label class="nn-mf"><span>%s</span><textarea class="nn-mta %s" rows="3" placeholder="%s"></textarea></label>' % (et, cls, ph)
    return ('''<!-- F9 · Modo manual («Prefiero escribirla yo»): los mismos seis campos, con sus rótulos y ejemplos de hoy, como una hoja de escritura con líneas finas -->
<div class="nn-man" data-en="''' + en + '''" data-solo="man">
  ''' + f('nn-motivo', 'Motivo de consulta / Subjetivo *', 'Ej: Paciente refiere cuadro de 3 días de evolución con dolor en región lumbar derecha irradiado a miembro inferior...')
      + f('nn-m-exp', 'Exploración física / Objetivo *', 'Ej: TA 120/80 mmHg, FC 72 lpm, FR 16 rpm, T° 36.5°C. Paciente consciente, orientado, cooperador. Abdomen blando, no doloroso a la palpación...')
      + f('nn-m-aux', 'Auxiliares diagnósticos', 'Ej: BH con leucocitosis leve. Rx de tórax sin infiltrados. RMN columna lumbar: hernia discal L4-L5...') + '''
  <div class="nn-mf"><span>Diagnóstico(s) CIE-10 *</span>
    <ul class="nn-dx-l"></ul>
    <input type="text" class="nn-dx-in" autocomplete="off" placeholder="Buscar diagnóstico CIE-10 o escribir..." aria-label="Buscar diagnóstico CIE-10 o escribir">
    <ul class="nn-dx-res" hidden></ul>
    <button type="button" class="nn-p nn-txt nn-izqd nn-dx-mas">Agregar diagnóstico</button></div>
  ''' + f('nn-m-ana', 'Análisis clínico', 'Razonamiento clínico: correlación clínico-radiológica, evolución, consideraciones...')
      + f('nn-m-plan', 'Plan de tratamiento *', 'Ej: Reposo relativo. Fisioterapia 2 veces por semana por 6 semanas. Restricción de cargas. Control en 4 semanas. Signos de alarma: déficit neurológico progresivo...') + '''
  <span class="nn-autog" hidden>Borrador guardado</span>
</div>''')

def doc(en):
    return ('''<!-- F13 · La nota lista, como DOCUMENTO de lectura (sin tarjetas por sección). «Editar» la vuelve texto editable («Vista previa» regresa). Al guardar queda sellada y
     desaparece todo lo que sugiera edición. F14 · Medicamentos detectados con «Quitar». F15 · Diagnósticos y Seguimiento.
     Sin diagnóstico estructurado la lista dice «Sin diagnóstico estructurado — la nota se guardará sin código CIE-10.» (alcanzable: modo manual sin diagnósticos). -->
<article class="nn-doc" data-en="''' + en + '''" aria-label="Nota médica">
  <p class="nn-origen" data-en="rev regen"><span class="nn-tag nn-t-ton" data-solo="ia">''' + ic(I['chispa'], 14, 2) + '''Nota IA</span><span class="nn-tag nn-t-ton" data-solo="man">''' + ic(I['lapiz'], 14, 2) + '''Nota manual</span><span>Revísala antes de guardar</span></p>
  <p class="nn-origen" data-en="ok doc ver"><span class="nn-tag nn-t-ok">''' + ic(I['candado'], 14, 2) + '''Nota sellada</span></p>
  <!-- CALMA §12 · Secciones con rótulo de color, cuerpo justificado (lang="es" + hyphens:auto), diagnóstico destacado con su CIE-10 en etiqueta. El Plan es texto de la nota;
       los medicamentos salen UNA vez, en «Detecté estos medicamentos», bajo una línea, con «Quitar» (tercera revisión). -->
  <div class="nn-prosa nn-ver0" lang="es"></div>
  <textarea class="nn-nota-ta nn-ver1" aria-label="Texto de la nota" spellcheck="false"></textarea>
  <section class="nn-grp nn-meds" data-en="rev regen" data-solo="ia"><h3 class="nn-grp-t">Detecté estos medicamentos (precargarán tu receta):</h3>
    <ul class="nn-med-l"><li class="nn-dli"><span class="nn-flex">Naproxeno 500 mg</span><button type="button" class="nn-p nn-txt nn-quitar" aria-label="Quitar Naproxeno 500 mg">Quitar</button></li>
      <li class="nn-dli"><span class="nn-flex">Paracetamol 500 mg</span><button type="button" class="nn-p nn-txt nn-quitar" aria-label="Quitar Paracetamol 500 mg">Quitar</button></li></ul></section>
  <section class="nn-grp nn-grp-dx"><h3 class="nn-grp-t">Diagnósticos</h3>
    <ul class="nn-dxr"></ul></section>
  <section class="nn-grp"><h3 class="nn-grp-t">Seguimiento</h3>
    <dl class="nn-kv nn-kv2 nn-ver0"><div><dt>Pronóstico</dt><dd class="nn-pro-v">—</dd></div><div><dt>Próxima cita</dt><dd class="nn-cita-v">En 2 semanas</dd></div></dl>
    <div class="nn-seg-e nn-ver1"><label class="nn-f"><span>Pronóstico</span><input type="text" class="nn-in nn-pro" autocomplete="off" placeholder="Ej: Favorable a mediano plazo con tratamiento conservador..."></label>
      <label class="nn-f"><span>Próxima cita</span><input type="text" class="nn-in nn-cita" value="En 2 semanas" autocomplete="off" placeholder="Ej: En 4 semanas, 15 de abril 2026..."></label></div></section>
  <section class="nn-grp" data-en="ok doc ver"><h3 class="nn-grp-t">Signos vitales</h3><dl class="nn-kv nn-vres2"></dl></section>
  <!-- Bloque de firma sobrio (pedido por el dueño). Datos ficticios del médico de la sesión. -->
  <footer class="nn-firma"><b>Dr. Admin Semilla</b><span class="nn-num">Cédula Prof. 00000001</span><span class="nn-num">19 de noviembre de 2026</span></footer>
</article>''')

def rejilla():
    az = ''.join('<li><button type="button" class="nn-p nn-az nn-tipo" data-t="%s"><span class="nn-az-i" style="--c:var(--d-%s)">%s</span><span class="nn-az-n">%s%s</span></button></li>'
                 % (k, tok, ic(d, 20), n, '<small class="nn-cuenta">2 medicamentos</small>' if k == 'receta' else '') for k, n, tok, d in TIPOS)
    return ('''<!-- F23 · Después de guardar: los ocho tipos en la REJILLA de nivel 4 (CALMA §9): 2 columnas en teléfono, 4 en ancho. Cada azulejo abre su formulario.
     Un documento empezado y sin imprimir deja su azulejo contorneado. -->
<div class="nn-rej-h" data-en="ok"><ul class="nn-rej" aria-label="Tipo de documento">''' + az + '''</ul></div>''')

def acciones_ok(ver=True):
    return (('<button type="button" class="nn-p nn-ac nn-b-ver" data-en="ok">' + ic(I['ojo'], 20) + '<span>Ver nota</span>' + FLECHA + '</button>' if ver else '') +
            '<button type="button" class="nn-p nn-ac nn-ok-imp" data-en="ok">' + ic(I['imprime'], 20) + '<span class="nn-ok-imp-t">Imprimir nota</span>' + FLECHA + '</button>'
            '<a href="#" class="nn-p nn-ac nn-ok-exp" data-en="ok">' + ic(I['carpeta'], 20) + '<span>Ver expediente</span>' + FLECHA + '</a>')

def formulario():
    def fila(et, campo):
        return '<label class="nn-fila"><span>%s</span>%s</label>' % (et, campo)
    return ('''<!-- Formulario del documento elegido. Se dibuja COMPLETA la Receta, precargada con paciente, diagnóstico y los medicamentos que quedaron en la nota:
     campos como lista «rótulo — valor» con líneas finas, sin azulejos. Las ayudas de hoy («De la ficha · editable», «Del diagnóstico de la consulta», «Del catálogo · editable»,
     «Sugerencia del catálogo: …») y el aviso «Completa tu perfil para que el documento salga con tu encabezado.» + «Ir a mi perfil» están en la página Documentos. -->
<form class="nn-form" data-en="doc" novalidate>
  <div class="nn-df-rx">
    ''' + fila('Plantilla', '<span class="nn-selw"><select class="nn-sel" aria-label="Plantilla"><option>— Sin plantilla —</option><option>Vaciar formulario</option></select>' + ic(I['abajo'], 16, 2) + '</span>') + '''
    <section class="nn-grp"><h3 class="nn-grp-t">Datos del paciente</h3>
      <div class="nn-par">''' + fila('Fecha', '<input type="text" class="nn-fi nn-num" value="19/11/2026" inputmode="numeric" autocomplete="off">')
          + fila('Paciente *', '<input type="text" class="nn-fi" value="Paciente Prueba 01" placeholder="Nombre completo" autocomplete="off">') + '</div>'
          + fila('Diagnóstico', '<input type="text" class="nn-fi nn-rx-dx" value="M54.5 Lumbago no especificado" placeholder="Diagnóstico principal" autocomplete="off">') + '''</section>
    <div class="nn-rx-l"></div>
    <section class="nn-grp"><h3 class="nn-grp-t">Recomendaciones</h3>
      <textarea class="nn-mta nn-rx-rec" rows="2" aria-label="Recomendaciones" placeholder="Indicaciones generales, cuidados, datos de alarma…"></textarea></section>
  </div>
</form>''')

def botones(vp):
    """Acciones de pie: barra fija en teléfono y Duo abierto; pie de la columna de escritura en computadora. Un solo primario por estado."""
    esc, ih = vp == 'esc', vp in ('ih', 'iv')
    # Texto aprobado por el dueño (CALMA §20): «Generar con Spinus».
    gen = '<button type="button" class="nn-p nn-prim nn-b-gen" data-en="cap" data-solo="ia" disabled>Generar con Spinus</button>'
    prev = '<button type="button" class="nn-p nn-prim nn-b-prev" data-en="cap" data-solo="man" disabled>Previsualizar nota</button>'
    red = '<button type="button" class="nn-prim" data-en="gen regen" disabled><span class="nn-giro" aria-hidden="true"></span><span role="status">Redactando nota médica...</span></button>'
    rei = '<button type="button" class="nn-p nn-prim nn-b-rei" data-en="err">Reintentar</button>'
    cer = '<button type="button" class="nn-p nn-txt nn-ini nn-b-cer" data-en="err">Cerrar</button>'
    reg = ('<button type="button" class="nn-p nn-txt nn-ini nn-b-reg" data-en="rev" data-solo="ia">Regenerar</button>'
           '<button type="button" class="nn-p nn-txt nn-ini nn-b-volver" data-en="rev" data-solo="man">' + 'Actualizar' + '</button>')
    guardar = '<button type="button" class="nn-p nn-prim nn-b-guardar" data-en="rev">Guardar nota</button>'
    conc = '<button type="button" class="nn-p nn-prim nn-b-conc" data-en="ok">Concluir consulta</button>'
    imp = '<button type="button" class="nn-p nn-prim nn-b-imp" data-en="doc">Imprimir</button>'
    plant = '<button type="button" class="nn-p nn-txt nn-ini nn-b-plant" data-en="doc">Plantilla</button>'
    if esc:
        # F8 · En computadora el cambio de vía es una acción de texto junto al primario (y por eso NO se repite en «···»). Tras generar, «Guardar nota» sube a la zona de la nota.
        # CALMA §23.1 · secundario a la izquierda, principal a la DERECHA; el par pegado a la derecha de la columna
        return ('<div class="nn-pie"><span class="nn-ayuda" data-en="rev" data-solo="ia">Corrige o amplía el contexto; la nota se generará de nuevo.</span>' + cer
                + '<button type="button" class="nn-p nn-txt nn-a-man" data-en="cap" data-solo="ia">Prefiero escribirla yo</button>'
                  '<button type="button" class="nn-p nn-txt nn-a-ia" data-en="cap" data-solo="man">Usar IA</button>'
                + reg + plant + gen + prev + red + rei + conc + imp + '</div>')
    orden = (gen + prev + red + rei + guardar + conc + imp + cer + reg + plant) if False else (cer + reg + plant + gen + prev + red + rei + guardar + conc + imp)
    return ('<!-- Barra de acción: UN primario. Respeta el indicador inferior y termina antes del riel. -->\n<div class="nn-barra"><div class="nn-barra-f">' + orden + '</div></div>')

def capas(vp):
    asa = '<span class="nn-asa" aria-hidden="true"></span>'
    X = '<button type="button" class="nn-p nn-ib nn-cierra" aria-label="%s">' + ic(I['x'], 20, 2) + '</button>'
    def campo(k, lab):
        return '<span class="nn-vc"><input class="nn-vi" data-k="%s" type="text" inputmode="decimal" maxlength="5" autocomplete="off" placeholder="—" aria-label="%s"></span>' % (k, lab)
    def vr(t, campos, uni):
        return '<div class="nn-vr"><span class="nn-vr-t">%s<span class="nn-vmsg" hidden>Fuera de rango</span></span>%s<span class="nn-uni">%s</span></div>' % (t, campos, uni)
    def preg(q, ops):
        return ('<div class="nn-q"><p class="nn-q-t">%s</p>%s<input type="text" class="nn-in nn-q-in" placeholder="Escribe tu respuesta..." aria-label="%s: escribe tu respuesta" autocomplete="off"></div>'
                % (q, ''.join('<button type="button" class="nn-p nn-op" aria-pressed="false"><span class="nn-flex">%s</span>%s</button>' % (o, ic(I['ok'], 18, 2.4)) for o in ops), q))
    def mr(a, t, en, k, solo='', cls=''):
        return '<button type="button" class="nn-p nn-mr%s" role="menuitem" data-a="%s" data-en="%s"%s>%s<span class="nn-flex">%s</span></button>' % (cls, a, en, (' data-solo="%s"' % solo) if solo else '', ic(I[k], 20), t)
    return ('''<div class="nn-capa" aria-hidden="true"><div class="nn-velo"></div>
<!-- Capas. Animación de maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1), mismo camino al entrar y al salir. En la app será un
     resorte (amortiguación 1.0, respuesta ~0.3), interrumpible y arrastrable desde el asa. -->
<!-- «···»: lo ocasional. F21 contexto, F8 cambio de vía (solo teléfono y Duo abierto: en computadora ya está junto al primario), F20 «Empezar de nuevo»,
     F6 dictado (deshabilitado, como hoy), F22 documentos antes de guardar (con sus dos textos de hoy), plantillas e impresión dentro de un documento. -->
<div tabindex="-1" class="nn-pan nn-hoja nn-menu" data-pan="menu" role="menu" aria-label="Más opciones">''' + asa + '''
  <div class="nn-hj-cab"><h2>Más opciones</h2>''' + X % 'Cerrar' + '''</div>
  <div class="nn-hj-c">
    ''' + mr('pac', 'Contexto del paciente', ANTES, 'paciente') + mr('man', 'Prefiero escribirla yo', 'cap err', 'lapiz', 'ia', ' nn-solo-tel') + mr('ia', 'Usar IA', 'cap', 'chispa', 'man', ' nn-solo-tel')
        + mr('plantg', 'Gestionar plantillas', 'doc', 'plantilla') + mr('imp', 'Imprimir nota', 'doc ver', 'imprime') + mr('exp', 'Ver expediente', 'doc ver', 'carpeta') + '''
    <button type="button" class="nn-mr" role="menuitem" data-en="cap gen err" data-solo="ia" disabled>''' + ic(I['micro'], 20) + '''<span class="nn-flex">Dictado por voz — próximamente</span></button>
    <button type="button" class="nn-mr nn-mr2" role="menuitem" data-en="''' + ANTES + '''" disabled>''' + ic(I['docs'], 20) + '''<span class="nn-flex">Documentos del paciente<small data-en="cap gen err">Completa y genera la nota para activar este panel</small><small data-en="rev regen">Guarda la nota para poder generar documentos desde aquí</small></span></button>
    ''' + mr('nuevo', 'Empezar de nuevo', 'rev', 'rehacer', '', ' nn-mr-mal') + '''
  </div>
</div>
<!-- F4 · Signos vitales: cinco filas (rótulo a la izquierda, campo numérico a la derecha con su unidad). Opcionales. Rótulos de hoy: Presión arterial, FC, FR, Temp., SpO₂.
     Hoy hay además un estado intermedio «N a vigilar» y la insignia «Todo en rango»; se diseñan con el componente, aquí solo se dibuja «N fuera de rango».
     Al guardar: «Signos vitales: la frecuencia cardíaca (FC) es obligatoria y mayor que 0 si capturas algún signo vital.» y
     «Signos vitales: hay valores fuera del rango fisiológico posible. Corrígelos para guardar.» salen como línea de error, igual que la de generación. -->
<div tabindex="-1" class="nn-pan nn-hoja" data-pan="vit" role="dialog" aria-modal="true" aria-label="Signos vitales">''' + asa + '''
  <div class="nn-hj-cab"><h2>Signos vitales</h2>''' + X % 'Cerrar' + '''</div>
  <div class="nn-hj-c">''' + vr('Presión arterial', campo('sis', 'Presión arterial sistólica') + '<span class="nn-barra-d" aria-hidden="true">/</span>' + campo('dia', 'Presión arterial diastólica'), 'mmHg')
      + vr('FC', campo('fc', 'Frecuencia cardíaca'), 'lpm') + vr('FR', campo('fr', 'Frecuencia respiratoria'), 'rpm')
      + vr('Temp.', campo('temp', 'Temperatura'), '°C') + vr('SpO₂', campo('spo2', 'Saturación de oxígeno'), '%') + '''</div>
</div>
<!-- F21 · Contexto del paciente: pares rótulo — valor (edad, sexo, IMC, alergias, último diagnóstico, último tratamiento). -->
<div tabindex="-1" class="nn-pan nn-hoja" data-pan="pac" role="dialog" aria-modal="true" aria-label="Contexto del paciente">''' + asa + '''
  <div class="nn-hj-cab"><h2>Contexto del paciente</h2>''' + X % 'Cerrar' + '''</div>
  <div class="nn-hj-c"><dl class="nn-pares"><dt>Edad</dt><dd class="nn-num">73 años</dd><dt>Sexo</dt><dd>Femenino</dd><dt>IMC</dt><dd class="nn-num">24.8</dd><dt>Alergias</dt><dd>Penicilina</dd>
    <dt class="nn-prim-no">Último diagnóstico</dt><dd class="nn-prim-no">Lumbago no especificado</dd><dt class="nn-prim-no">Último tratamiento</dt><dd class="nn-prim-no">Naproxeno 500 mg<br>Paracetamol 500 mg</dd></dl>
    <p class="nn-ayuda nn-prim-si">Primera consulta del paciente</p></div>
</div>
<!-- F12 · Entrevista «Spinus necesita más información»: aparece tras «Generar con Spinus» cuando la descripción no alcanza (en la maqueta, desde la tira).
     Opciones como lista con palomita + respuesta libre; Anterior / Siguiente / «Enviar respuestas»; Cancelar es la X. No existe «generar sin responder» en el código.
     Errores de hoy dentro de la entrevista (línea de error sobre el pie): «Responde al menos una pregunta antes de enviar.» · «La IA no devolvió preguntas válidas. Intenta de nuevo.» -->
<div tabindex="-1" class="nn-pan nn-hoja nn-alta" data-pan="ent" role="dialog" aria-modal="true" aria-label="Spinus necesita más información">''' + asa + '''
  <div class="nn-hj-cab"><h2>Spinus necesita más información</h2>''' + X % 'Cancelar' + '''</div>
  <div class="nn-hj-c"><p class="nn-hj-sub">Responde para completar la nota · <span class="nn-ent-prog">Bloque 1 de 2</span><span class="nn-ent-falta"></span></p>
    <div class="nn-bloque" data-b="0"><h3 class="nn-bq-t">Características del dolor</h3>''' + preg('¿El dolor se irradia a alguna pierna?', ['No', 'Pierna derecha', 'Pierna izquierda', 'Ambas'])
      + preg('¿Qué intensidad refiere el paciente?', ['Leve', 'Moderada', 'Intensa']) + '''</div>
    <div class="nn-bloque" data-b="1" hidden><h3 class="nn-bq-t">Tratamiento y seguimiento</h3>''' + preg('¿Indicaste algún medicamento?', ['Sí', 'No'])
      + preg('¿Cuándo es la próxima cita?', ['En 1 semana', 'En 2 semanas', 'En 1 mes']) + '''</div></div>
  <div class="nn-hj-p"><button type="button" class="nn-p nn-ton nn-ent-ant" disabled>Anterior</button><span class="nn-flex"></span><button type="button" class="nn-p nn-prim nn-ent-sig" disabled>Siguiente</button></div>
</div>
<!-- F17 · «Ajusta el contexto» (teléfono y Duo abierto). En computadora no hace falta: la descripción sigue a la vista en la zona izquierda. -->
<div tabindex="-1" class="nn-pan nn-hoja" data-pan="ctx" role="dialog" aria-modal="true" aria-label="Ajusta el contexto">''' + asa + '''
  <div class="nn-hj-cab"><h2>Ajusta el contexto</h2>''' + X % 'Cancelar' + '''</div>
  <div class="nn-hj-c"><p class="nn-hj-sub">Corrige o amplía el contexto; la nota se generará de nuevo.</p>
    <textarea class="nn-ctx-ta" aria-label="Descripción del caso"></textarea>
    <p class="nn-hj-sub nn-hj-sub2">Tu nota actual se conserva hasta que la nueva esté lista.</p></div>
  <div class="nn-hj-p"><span class="nn-flex"></span><button type="button" class="nn-p nn-prim nn-ctx-ok">Regenerar nota</button></div>
</div>
<!-- ALERTAS · Patrón único (CALMA §13): icono en círculo tintado, título centrado, mensaje justificado y DOS botones parejos lado a lado
     (secundario a la izquierda, principal a la derecha). Si el rótulo de hoy es largo, los dos botones se apilan a todo el ancho con el principal arriba.
     F18 · Confirmación de guardado (irreversible), con el texto de hoy; el secundario dice «Revisar» (CALMA §15; hoy «Volver a revisar»). Si el guardado falla, la alerta sigue
     abierta con una línea de error: «No se pudo guardar la nota.» o «Error de conexion. Verifica tu internet e intenta de nuevo.» (así, sin acento, está hoy en el código). -->
<div tabindex="-1" class="nn-pan nn-alerta" data-pan="conf" role="alertdialog" aria-modal="true" aria-label="¿Guardar esta nota?">
  <span class="nn-al-ic nn-al-ton" aria-hidden="true">''' + ic(I['candado'], 28) + '''</span>
  <h2>¿Guardar esta nota?</h2><p class="nn-al-m" lang="es">Una vez guardada, no podrá modificarse por motivos de seguridad y cumplimiento normativo. Si necesitas hacer correcciones después, podrás agregar una nota aclaratoria (addendum).</p>
  <p class="nn-sinvit">''' + ic(I['aviso'], 14, 2) + '''<span>No capturaste signos vitales en esta nota.</span></p>
  <div class="nn-al-p"><button type="button" class="nn-p nn-bt nn-bt-ton nn-cierra">Revisar</button><button type="button" class="nn-p nn-bt nn-prim nn-conf-ok">Guardar nota</button></div>
</div>
<!-- F16 · Regenerar (o Actualizar, en manual) con ediciones a mano -->
<div tabindex="-1" class="nn-pan nn-alerta" data-pan="pisar" role="alertdialog" aria-modal="true" aria-label="Perderás tus cambios — ¿Continuar?">
  <span class="nn-al-ic nn-al-mal" aria-hidden="true">''' + ic(I['rehacer'], 28) + '''</span>
  <h2>Perderás tus cambios — ¿Continuar?</h2><p class="nn-al-m nn-al-c" data-solo="ia">Tienes cambios sin guardar. Regenerar con IA los perderá.</p>
  <div class="nn-al-p"><button type="button" class="nn-p nn-bt nn-bt-qui nn-cierra">Conservar</button><button type="button" class="nn-p nn-bt nn-mal nn-pisar-si"><span data-solo="ia">Sí, regenerar</span><span data-solo="man">Sí, actualizar</span></button></div>
</div>
<!-- F20 · Empezar de nuevo -->
<div tabindex="-1" class="nn-pan nn-alerta" data-pan="nuevo" role="alertdialog" aria-modal="true" aria-label="Empezar de nuevo">
  <span class="nn-al-ic nn-al-mal" aria-hidden="true">''' + ic(I['rehacer'], 28) + '''</span>
  <h2>Empezar de nuevo</h2><p class="nn-al-m nn-al-c" lang="es">Descartarás la nota generada. Tu dictado y los datos capturados se conservan.</p>
  <div class="nn-al-p nn-al-col"><button type="button" class="nn-p nn-bt nn-bt-qui nn-cierra">Conservar</button><button type="button" class="nn-p nn-bt nn-mal nn-nuevo-si">Sí, empezar de nuevo</button></div>
</div>
<!-- F23 · Cambiar de tipo con un documento empezado: confirmación previa, con el texto de hoy -->
<div tabindex="-1" class="nn-pan nn-alerta" data-pan="cambio" role="alertdialog" aria-modal="true" aria-label="¿Cambiar a Laboratorio?">
  <span class="nn-al-ic nn-al-mal" aria-hidden="true">''' + ic(I['cambia'], 28) + '''</span>
  <h2>¿Cambiar a <span class="nn-cb-a">Laboratorio</span>?</h2><p class="nn-al-m nn-al-c" lang="es">Se descarta <span class="nn-cb-de">la receta</span> que estás llenando. No se puede deshacer.</p>
  <div class="nn-al-p nn-al-col"><button type="button" class="nn-p nn-bt nn-bt-qui nn-cierra">Cancelar</button><button type="button" class="nn-p nn-bt nn-mal nn-cb-ok">Cambiar a&nbsp;<span class="nn-cb-a">Laboratorio</span></button></div>
</div>
<!-- F24 · «¿Concluir la consulta?» con un documento empezado y sin imprimir (texto de hoy). Es un aviso (ámbar), no una destrucción. -->
<div tabindex="-1" class="nn-pan nn-alerta" data-pan="conc" role="alertdialog" aria-modal="true" aria-label="¿Concluir la consulta?">
  <span class="nn-al-ic nn-al-ag" aria-hidden="true">''' + ic(I['aviso'], 28) + '''</span>
  <h2>¿Concluir la consulta?</h2><p class="nn-al-m" lang="es">Tienes <span class="nn-pend">una receta empezada</span> y sin imprimir. Si concluyes ahora, no se emite. Puedes concluir de todos modos: no todo lo que se empieza se entrega.</p>
  <div class="nn-al-p nn-al-col"><button type="button" class="nn-p nn-bt nn-bt-qui nn-cierra">Seguir llenando</button><button type="button" class="nn-p nn-bt nn-prim nn-conc-ok">Concluir de todos modos</button></div>
</div>
</div>''')

TOAST = '<div class="nn-toast" role="status" aria-live="polite"><span></span></div>'

def marco(vp):
    if vp == 'esc':
        vacio = ('''<!-- Antes de generar: casi en blanco. Una línea y la lista de secciones en texto tenue; sin barras-esqueleto. F7/F11 · mientras redacta, la línea cambia
     (hoy: modal «Spinus está redactando tu nota» · «Unos segundos…» con los pasos «Leyendo tu dictado», «Estructurando la nota», «Redactando la exploración»).
     «La nota aparecerá aquí» es un texto nuevo, pendiente de aprobar: hoy no existe porque la nota se revisa en un modal. -->
<div class="nn-vacio" data-en="cap gen err"><p class="nn-vacio-h"><span data-en="cap err">La nota aparecerá aquí</span><span class="nn-giro" data-en="gen" aria-hidden="true"></span><span data-en="gen">Spinus está redactando tu nota</span></p>
  <ul aria-hidden="true"><li>Subjetivo</li><li>Objetivo</li><li>Auxiliares diagnósticos</li><li>Diagnóstico</li><li>Análisis</li><li>Plan</li></ul></div>''')
        rcab = ('''<div class="nn-rcab"><span class="nn-flex"></span>
    <button type="button" class="nn-p nn-txt nn-b-ed" data-en="rev"><span class="nn-ver0">Editar</span><span class="nn-ver1">Vista previa</span></button>
    <button type="button" class="nn-p nn-prim nn-b-guardar" data-en="rev">Guardar nota</button>
    <!-- «Nota guardada» en computadora: las acciones de la nota van junto a la nota (aquí «Ver nota» no hace falta: la nota sellada está a la vista). -->
    <div class="nn-acc" data-en="ok" role="group" aria-label="Esta nota">''' + acciones_ok(False) + '''</div></div>''')
        col = ('<div class="nn-col"><main class="nn-cont"><div class="nn-dos">\n<div class="nn-izq">\n' + cabecera(vp) + '\n<section class="nn-card" data-en="' + ANTES + ' doc">\n' + vfila(ANTES) + '\n'
               + escritura(ANTES) + '\n' + manual('cap rev') + '\n' + formulario() + '\n</section>\n' + rejilla() + '\n' + botones(vp) + '\n</div>\n<div class="nn-der">\n' + rcab + '\n' + vacio + '\n'
               + doc('rev regen ok doc') + '\n</div>\n</div></main>' + TOAST + '</div>')
    else:
        iv = vp == 'iv'
        acc = ('<!-- F19 · «Esta nota»: fila única y pareja de tres acciones (botones tonales del mismo ancho, icono de color + rótulo). «Concluir consulta» queda como único primario al pie. -->\n'
               '<div class="nn-acc" data-en="ok" role="group" aria-label="Esta nota">' + acciones_ok(not iv) + '</div>')
        col = ('<div class="nn-col"><main class="nn-cont">\n' + cabecera(vp) + '\n<section class="nn-card" data-en="' + ANTES + ' doc ver' + (' ok' if iv else '') + '">\n' + vfila('cap gen err') + '\n' + escritura('cap gen err') + '\n' + manual('cap') + '\n'
               + doc('rev regen ver' + (' ok' if iv else '')) + '\n' + formulario() + '\n</section>\n' + acc + '\n' + rejilla() + '\n</main>\n' + botones(vp) + TOAST + '</div>')
    nav = {'ext': riel, 'tel': encabezado, 'ih': lambda: lateral('ih'), 'iv': fundido, 'esc': lambda: lateral('esc')}[vp]()
    app = (nav + '\n' + col) if vp in ('tel', 'iv', 'esc') else (col + '\n' + nav)
    return '<div class="marco nn" data-vp="%s" data-e="cap" data-modo="ia" lang="es">\n<div class="nn-app">\n%s\n</div>\n%s\n</div>\n' % (vp, app, capas(vp) + CRO['capa_mas'](vp))

import importlib.util as _u
_sp = _u.spec_from_file_location('u4iv', '/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/tools/tmp-u4-iv.py'); _m = _u.module_from_spec(_sp); _sp.loader.exec_module(_m)
css = _m.con_iv(open(os.path.join(L, 'tmp-nn-estilo.css')).read()) + CRO['css'] + open(os.path.join(L, 'tmp-nn-estilo4.css')).read()
js = open(os.path.join(L, 'tmp-nn-guion.js')).read() + CRO['js']
out = ('<!-- NOMBRE: Nueva nota médica | En la pantalla solo manda el texto que escribes: una superficie en blanco, los signos vitales en una fila y un único botón; al guardar, los ocho documentos se eligen en una rejilla con su color, y lo ocasional queda a un toque en «···» -->\n'
       '<!-- Textos: los rótulos y mensajes son los de hoy, copiados del código. Revisiones del dueño aplicadas (CALMA §11–22). Aprobados: título «Nueva nota», botón «Generar con Spinus», sección «Expediente».\n'
       '     Cinco marcos: ext, tel, ih, iv (Duo abierto vertical), esc. Validaciones de hoy que salen como línea de error (misma pieza que el error de generación):\n'
       '     «Describe el caso antes de generar.» · «Campos obligatorios: …» · «Describe el caso antes de guardar.» · «Genera la nota antes de guardar.» · «No se pudo generar el PDF. Intenta de nuevo.» -->\n'
       '<style>\n' + css + '</style>\n' + ''.join(marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')) + '<script>\n' + js + '</script>\n')
open(os.path.join(L, 'vista-nota.html'), 'w').write(out)
print(len(out))
