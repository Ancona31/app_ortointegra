# Vistas de la Fase 1 (lo ejecuta tmp-gen.py con sus funciones ya cargadas).
import json, copy

def salida(v, archivo, nombre, desc, marcos_html, ficha='', tira=None, **extra):
    cfg = dict(v=v, ficha=ficha, tira=tira or []); cfg.update(extra)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}</style>\n' + '\n'.join(marcos_html)
           + f'\n<script>\n(function(CFG){{\n{JS}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = f'{L}/vista-{archivo}.html'
    open(p, 'w').write(out); print(p, len(out))

# Ancho real de columna (px) por marco: Día y Semana (en teléfono, la Semana de 7 columnas es la versión B)
ANCHO_DIA = {'ext': 251, 'tel': 317, 'ih': 549, 'iv': 569, 'esc': 928}
ANCHO_SEM = {'ext': 36, 'tel': 45, 'ih': 78, 'iv': 81, 'esc': 132}

def muestra(c, w, titulo, sub='', extra_cls='', fuera=False, alto=None, contenido=None, aria=''):
    dur = c['b'] - c['a']
    hh_ = alto if alto is not None else dur
    blk = contenido if contenido is not None else bloque(c, extra_cls, estilo=f'top:1px;height:calc(var(--cal-h) * {dur:.4f} - 2px)', aria_extra=aria)
    t = f'<b>{titulo}</b>' + (f'<br>{sub}' if sub else '')
    return f'<div class="ag0-m"><span class="ag0-m-t">{t}</span><div class="ag0-m-c{" ag0-m-f" if fuera else ""}" style="--w:{w}px;--hh:{hh_:.4f}">{blk}</div></div>'

def S(**k):
    base = dict(id='mx', d=3, a=17, b=17.5, nom='Paciente Prueba 07', e='conf', tipo='cita', cons='Centro', tel='999 000 0007', obs='Gonalgia, primera vez', ori='enlace', sx=False, evc=None, evi=None)
    base.update(k); return base

# =========================================================== VISTA 1 · EL BLOQUE ===========================================================
def lamina_bloque(vp):
    wd, ws = ANCHO_DIA[vp], ANCHO_SEM[vp]
    tel = vp in ('ext', 'tel')
    tam = [(0.25, '15 min', '1 línea'), (0.5, '30 min', '2 líneas'), (0.75, '45 min', '3 líneas'), (1, '60 min', '4 líneas'), (1.5, '90 min', '5 o más')]
    dia = ''.join(muestra(S(a=17, b=17 + d), wd, t, s) for d, t, s in tam)
    sem = ''.join(muestra(S(a=17, b=17 + d), ws, t) for d, t, s in tam)
    semtxt = ('Semana en 7 columnas de teléfono (versión B, 36–45 px): solo color e icono.' if tel else f'Ancho real de una columna de Semana: {ws} px.')
    estados = [('ag', 'Agendada'), ('conf', 'Confirmada'), ('aten', 'Atendida'), ('canc', 'Cancelada'), ('noas', 'No asistió')]
    est_d = ''.join(muestra(S(e=k, ori='', obs=None, nom=f'Paciente Prueba {10 + i:02d}', tel=f'999 000 00{10 + i}', a=10, b=10.5), wd, t) for i, (k, t) in enumerate(estados))
    est_s = ''.join(muestra(S(e=k, ori='', obs=None, nom=f'Paciente Prueba {10 + i:02d}', a=10, b=10.75), ws, t) for i, (k, t) in enumerate(estados))
    # Tipos
    bq = (f'<button type="button" class="ag0-bq" aria-label="Bloqueado · Congreso, 18:00 a 20:00. Editar bloqueo" style="top:0;height:100%">'
          f'<span class="ag0-bq-r" style="top:0;height:50%"></span><span class="ag0-bq-t">{ic(I["candado"], 12, 2.2)}<span>Bloqueado · Congreso</span></span></button>'
          f'<span class="ag0-fuera" style="top:50%;bottom:0;opacity:1"></span>')
    def tipos(w, d):
        return (muestra(S(a=10, b=10 + d, ori='', obs=None), w, 'Cita', 'con expediente')
                + muestra(dict(S(a=14, b=14 + d), nom='Junta de servicio', tipo='ev', evc='indigo', evi='junta', tel=None, ori='', obs=None, e='ag'), w, 'Evento', 'color e icono elegidos')
                + muestra(dict(S(a=13.5, b=13.5 + d), nom='Pendiente administrativo', tipo='evn', evi='evento', tel=None, ori='', obs=None, e='ag'), w, 'Evento sin color', 'toma el color de su estado')
                + muestra(dict(S(a=18.5, b=18.5 + d), nom='Revisión de estudios', tipo='gl', ori='google', sx=True, tel=None, obs=None, e='ag', cons=None), w, 'Google por asignar', 'sin expediente')
                + muestra(dict(S(a=14, b=14 + d), nom='Paciente Prueba 26', ori='enlace', sx=True, tel='999 000 0026', obs=None, e='ag'), w, 'Reserva por ligar', 'por enlace, sin expediente')
                + muestra(S(a=18, b=20), w, 'Bloqueo', 'rayado solo hasta las 19:00 (fin de horario)', contenido=bq))
    todo = (f'<div class="ag0-m"><span class="ag0-m-t"><b>Todo el día</b></span><div style="display:flex;flex-direction:column;gap:6px;width:{min(wd, 320)}px">'
            + chip_todo(('ev', 'carmin', 'urgencias', 'Guardia')) + chip_todo(('bq', None, 'candado', 'Bloqueado · Vacaciones')) + '</div></div>')
    if tel:
        tipos_h = f'<div class="ag0-fl">{tipos(wd, .5)}{todo}</div>'
    else:
        tipos_h = f'<p>En columna de Día (30 min):</p><div class="ag0-fl">{tipos(wd, .5)}{todo}</div><p>En columna de Semana (60 min):</p><div class="ag0-ms">{tipos(ws, 1)}</div>'
    # Variantes
    wv = wd if tel else ws
    wdia_tz = wd if tel else min(wd, 420)
    dv = .75
    sol = (bloque(S(a=18.5, b=19, nom='Paciente Prueba 12', obs=None, sol='A'), estilo='top:1px;height:calc(var(--cal-h) * .5 - 2px)')
           + bloque(dict(S(a=18.5, b=19), nom='Revisión de estudios', tipo='gl', ori='google', sx=True, tel=None, obs=None, e='ag', cons=None, sol='B'), estilo='top:1px;height:calc(var(--cal-h) * .5 - 2px)'))
    arr = (bloque(S(a=10, b=10.75, obs=None, ori=''), 'ag0-b--fant', estilo='top:1px;height:calc(var(--cal-h) * .75 - 2px)')
           + bloque(S(a=10.25, b=11, obs=None, ori=''), 'ag0-b--arr', estilo='top:calc(var(--cal-h) * .25 + 1px);height:calc(var(--cal-h) * .75 - 2px);transform:translate(0,0) scale(1.03)', aria_extra='arrastrando a 10:15'))
    est_ = (bloque(S(a=10, b=10.75, obs=None, ori=''), 'ag0-b--fant', estilo='top:1px;height:calc(var(--cal-h) * .75 - 2px)')
            + bloque(S(a=10, b=11.25, obs=None, ori=''), 'ag0-b--est', estilo='top:1px;height:calc(var(--cal-h) * 1.25 - 2px)', aria_extra='estirando hasta 11:15'))
    curso = (bloque(S(a=17, b=17.5, e='ag', curso=True), estilo='top:1px;height:calc(var(--cal-h) * .5 - 2px)')
             + '<span class="ag0-ahora" style="top:calc(var(--cal-h) * .1667)" aria-hidden="true"></span>')
    var = (muestra(S(a=10, b=10 + dv, obs=None), wv, 'Seleccionado', 'su burbuja está abierta', 'ag0-b--sel')
           + muestra(S(a=10, b=10 + dv, obs=None), wv, 'Pulsado', 'al apoyar el dedo', 'ag0-b--puls')
           + muestra(S(a=10, b=10.75), wv, 'Arrastrando', 'fantasma en su sitio', alto=1.1, contenido=arr)
           + muestra(S(a=10, b=11.25), wv, 'Estirando', 'asa abajo; hora de fin en vivo', alto=1.3, contenido=est_)
           + muestra(S(a=18.5, b=19), wv, 'Solapado', 'dos a la misma hora', contenido=sol)
           + muestra(S(a=13, b=13.5, e='canc', nom='Paciente Prueba 08', ori='', obs=None), wv, 'Cancelada', 'tachada; el horario queda libre')
           + muestra(dict(S(a=9, b=9 + dv, e='aten', nom='Paciente Prueba 04', ori='', obs=None), pasado=True), wv, 'Pasado', 'se aclara, sigue legible')
           + muestra(S(a=17, b=17.5), wv, 'En curso', 'contorno y hora actual', contenido=curso)
           + muestra(dict(S(a=10, b=10 + dv, obs=None), med='AS'), wv, 'Todos los médicos', 'iniciales del médico')
           + muestra(dict(S(a=10, b=10 + dv, obs=None), tz='11:00 hora Quintana Roo'), wdia_tz, 'Otro huso', 'hora del consultorio (solo en Día)'))
    var_h = f'<div class="{"ag0-fl" if tel else "ag0-ms"}">{var}</div>'
    return f'''<main class="ag0-cont ag0-desp">
  <header class="ag0-cab"><h1>El bloque de cita</h1><p>Medidas reales de este dispositivo · {80} px por hora</p></header>
  <section class="ag0-sec"><h2 class="ag0-rot">Tamaños · columna de Día</h2><p>Ancho real: {wd} px. Lo que no cabe se queda en la burbuja.</p><div class="ag0-tar"><div class="ag0-fl">{dia}</div></div></section>
  <section class="ag0-sec"><h2 class="ag0-rot">Tamaños · columna de Semana</h2><p>{semtxt}</p><div class="ag0-tar"><div class="ag0-ms">{sem}</div></div></section>
  <section class="ag0-sec"><h2 class="ag0-rot">Estados</h2><div class="ag0-tar"><div class="ag0-fl">{est_d}</div>{"" if tel else f'<div class="ag0-ms" style="margin-top:20px">{est_s}</div>'}</div></section>
  <section class="ag0-sec"><h2 class="ag0-rot">Tipos</h2><div class="ag0-tar" style="display:flex;flex-direction:column;gap:12px">{tipos_h}</div></section>
  <section class="ag0-sec"><h2 class="ag0-rot">Variantes</h2><div class="ag0-tar">{var_h}</div></section>
</main>'''

FICHA_1 = '''<h3>Especificación · el bloque de cita (<code>.ag0-b</code>)</h3>
<p>Un solo marcado para todos los tamaños. La <b>duración</b> pone la clase (<code>.ag0-d15</code> ≤ 22 min · <code>d30</code> ≤ 37 · <code>d45</code> ≤ 52 · <code>d60</code> ≤ 82 · <code>d90</code> más) y el <b>ancho de la columna</b> decide con una consulta de contenedor (el bloque es <code>container-type: inline-size</code>). Ningún texto baja de 12 px: si no cabe, se omite.</p>
<h4>La regla: qué se muestra en cada tamaño</h4>
<table><thead><tr><th>Duración (alto a 80 px/h)</th><th>Columna estrecha (Semana, 60–199 px)</th><th>Columna media y ancha (Día, ≥ 200 px)</th></tr></thead><tbody>
<tr><th>15 min · 18 px · 1 línea</th><td>icono de estado + nombre (con «…»)</td><td>nombre · hora inicio–fin … estado en texto (en media, solo icono)</td></tr>
<tr><th>30 min · 38 px · 2 líneas</th><td>icono + nombre en 2 líneas + marcas de origen (G, enlace, sin expediente)</td><td>nombre + estado (círculo + texto) / hora · origen · sin expediente · consultorio · teléfono</td></tr>
<tr><th>45 min · 58 px · 3 líneas</th><td>+ hora inicio–fin</td><td>+ observaciones (1 línea)</td></tr>
<tr><th>60 min · 78 px · 4 líneas</th><td>+ consultorio</td><td>igual que 45</td></tr>
<tr><th>90 min o más</th><td>+ observaciones (2 líneas)</td><td>+ observaciones (2 líneas)</td></tr>
<tr><th>Columna mínima (&lt; 60 px)</th><td colspan="2">solo el color y el icono de estado (rejilla de 7 columnas en teléfono, versión B)</td></tr>
</tbody></table>
<p><b>Lo que se omite primero</b>, en este orden: observaciones → teléfono → consultorio → hora → marcas de origen → se acorta el nombre. <b>Nunca</b> se omiten el icono de estado (el color nunca es la única señal) ni el nombre. En la fila ancha la segunda línea se escribe en ese mismo orden de prioridad, así que si se corta con «…», se pierde lo menos importante.</p>
<h4>Medidas</h4>
<table><tbody>
<tr><th>Caja</th><td>radio 8 · barra izquierda 3 px (sombra interior, no borde) · 2 px de aire con la línea de la columna a la izquierda, 3 a la derecha · 1 px arriba y abajo (2 px entre citas seguidas)</td></tr>
<tr><th>Relleno interior</th><td>estrecha 2·5·2·8 · ancha 3·6·3·10 · 15 min 1·5·0·8</td></tr>
<tr><th>Tipografía</th><td>nombre 13/16 600 (ancha: 14/18 600) · hora 12/16 600 tabular en la tinta del estado · resto 12/16 400 en --tinta2 · estado 12/16 600 · icono de estado 13 px (trazo 2.4) · círculo de estado 18 px en la ancha</td></tr>
<tr><th>Toque</th><td>todo el bloque · el de 15 min amplía su área a 44 (13 px arriba y abajo, 9 en computadora) y queda encima de sus vecinos, que conservan su centro · respuesta al apoyar: escala .97 y relleno 10 % más oscuro</td></tr>
</tbody></table>
<h4>Variantes</h4>
<ul><li><b>Por ligar</b> (reserva por enlace o evento de Google por asignar): contorno discontinuo de 1,5 px en el color del estado — discontinuo = «sin expediente», igual que el icono de carpeta punteada.</li>
<li><b>Evento</b>: su icono en lugar del de estado y la hora en neutro (como hoy). Con color elegido, relleno = color al 12 %.</li>
<li><b>Pasado</b>: relleno al 55 % y nombre en --tinta2. <b>Cancelada</b>: nombre tachado en --tinta2. <b>En curso</b>: contorno de 1,5 px en el color del estado + «En curso» en la fila ancha + la línea de la hora actual.</li>
<li><b>Seleccionado</b>: doble anillo (2 px --sup + 2 px --accion). <b>Arrastrando</b>: se levanta (escala 1,03 + sombra de capa) y deja un fantasma discontinuo. <b>Estirando</b>: asa de 22×4 abajo y fin en vivo. <b>Solapado</b>: lado a lado, mitad y mitad.</li></ul>'''

# =========================================================== VISTA 2 · LA REJILLA ===========================================================
def pantalla(vp, cuerpo, vista='dia', extra_capas=''):
    b, flota = barra(vp, vista)
    return f'<main class="ag0-cont">{b}{cuerpo}{flota}</main>'

def vista2(vp):
    tel = vp in ('ext', 'tel')
    dia = rejilla(vp, [HOY], scroll=12)
    sem = rejilla(vp, list(range(7)), scroll=12, minimo=tel)
    md = 'dia' if tel else 'semana'
    def caja(k, h):
        on = k == md
        return f'<div data-modo="{k}" class="ag0-modo{" ag0-modo-on" if on else ""}" style="flex:1;min-height:0;flex-direction:column;display:{"flex" if on else "none"}">{h}</div>'
    return pantalla(vp, caja('dia', dia) + caja('semana', sem), 'dia' if tel else 'semana')

FICHA_2 = '''<h3>Especificación · la rejilla horaria (<code>.ag0-cal</code>)</h3>
<table><thead><tr><th>Pieza</th><th>Clase</th><th>Medida y color</th></tr></thead><tbody>
<tr><th>Tarjeta</th><td><code>.ag0-cal</code></td><td>--sup, sin borde ni sombra; radio 16 (teléfono) · 18 (Duo abierto) · 20 (computadora). Cabecera y «Todo el día» fijas; el cuerpo se desplaza.</td></tr>
<tr><th>Alto de hora</th><td><code>--cal-h</code></td><td>80 px en los cinco marcos (15 min = 18 px de bloque). «Densidad compacta» (engrane, computadora): 48 px; ahí el bloque de 15 min solo enseña color.</td></tr>
<tr><th>Columna de horas</th><td><code>.ag0-horas</code> · <code>--cal-hw</code></td><td>44 (teléfono) · 52 (Duo abierto) · 56 (computadora). Etiquetas 12/16 tabulares en --tinta2, centradas en su línea, alineadas a la derecha a 5–6 px.</td></tr>
<tr><th>Líneas</th><td><code>.ag0-col</code></td><td>1 px --cal-linea cada hora (fondo repetido) y entre columnas. Sin media hora: la precisión la da el bloque.</td></tr>
<tr><th>Cabecera de día</th><td><code>.ag0-dia</code></td><td>botón (abre ese Día): «Jue» 12/600 --tinta2 + número 17/600; hoy, número en círculo de 28 --cal-hoy-num con blanco. Alto 44 (40 en ancho).</td></tr>
<tr><th>Hoy</th><td><code>.ag0-col-hoy</code></td><td>la columna lleva --cal-hoy (acción al 5 %).</td></tr>
<tr><th>Fuera de horario</th><td><code>.ag0-fuera</code></td><td>banda --cal-fuera (= --fondo) bajo las líneas; un día sin consulta va entero así.</td></tr>
<tr><th>Hora actual</th><td><code>.ag0-ahora</code></td><td>2 px --cal-ahora con punto de 10 en hoy; 1 px al 35 % en los demás días; píldora 20 de alto, 12/700 tabular, en la columna de horas (la etiqueta de la hora que tapa se omite).</td></tr>
<tr><th>Bloqueo</th><td><code>.ag0-bq</code></td><td>franja pulsable (abre su edición) de todo el bloqueo; el rayado (135°, 1,5 px cada 9 px, --cal-bloqueo-raya) SOLO dentro del horario; rótulo «Bloqueado · motivo» 12/600 sobre --sup con candado.</td></tr>
<tr><th>Todo el día</th><td><code>.ag0-todo</code> · <code>.ag0-tc</code></td><td>fila de 34 px mín.; chips de 24, radio 7, 12/600, barra de 3 px; el bloqueo de todo el día va rayado entero.</td></tr>
<tr><th>Hueco libre</th><td><code>.ag0-hueco</code></td><td>tocar un hueco dibuja la cita nueva en su franja de 30 min: contorno discontinuo --cal-hueco, relleno al 8 %, «10:30 – 11:00» 12/600. Abre la burbuja de alta (ver «La burbuja de alta» en la página Cita; en la vista Día de esta página ya está cableada). <b>Solo en Duo abierto y computadora</b>: en teléfono hoy no existe (se usa «Agendar») y la maqueta no lo dibuja.</td></tr>
</tbody></table>
<p>En Duo abierto horizontal la rejilla es contenido y cruza la bisagra; las columnas miden 78 px.</p>'''

# =========================================================== VISTA 3 · LA BARRA ===========================================================
def vista3(vp):
    return pantalla(vp, rejilla(vp, [HOY], scroll=12))

FICHA_3 = '''<h3>Especificación · la barra de la agenda (<code>.ag0-barra</code>)</h3>
<p>Dos filas en todos los marcos, nunca más: <b>fila 1</b> = el periodo (título que abre «Ir a una fecha») y las acciones; <b>fila 2</b> = moverse en el tiempo (‹ Hoy ›) y elegir la vista. Lo que no cabe se agrupa en <b>«Opciones de la agenda»</b> (el «···» de los táctiles), que en computadora es el engrane de hoy con las mismas opciones.</p>
<table><thead><tr><th>Control de hoy</th><th>Duo cerrado</th><th>iPhone</th><th>Duo abierto (h)</th><th>Duo abierto (v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Fecha con selector</th><td colspan="5">visible: título del periodo (20/700 teléfono · 26/800 Duo h · 28/800 Duo v · 32/800 computadora)</td></tr>
<tr><th>‹ Hoy ›</th><td colspan="2">‹ › junto al periodo (fila 1); «Hoy» en la fila 2</td><td colspan="3">visible (fila 2)</td></tr>
<tr><th>Mes | Semana | 3 días | Día</th><td colspan="5">visible, cuatro segmentos con su rótulo entero (CALMA §29.1); en teléfono el conmutador se estira en la fila 2 junto a «Hoy»</td></tr>
<tr><th>Campana con contador</th><td colspan="5">visible</td></tr>
<tr><th>Agendar</th><td>«+» del riel</td><td>píldora flotante al pie</td><td>visible (primario)</td><td>visible (primario)</td><td>visible (primario)</td></tr>
<tr><th>Buscar</th><td>en «···»</td><td>en «···»</td><td>visible</td><td>visible</td><td>visible</td></tr>
<tr><th>Médico</th><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>visible</td></tr>
<tr><th>Bloquear horario</th><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>visible (candado)</td></tr>
<tr><th>Engrane (Configuración, Compactar, Pop-up, Leyenda)</th><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>en «···»</td><td>engrane (+ Densidad y Atajos, solo computadora como hoy)</td></tr>
<tr><th>Leyenda ⓘ suelta</th><td colspan="5">se retira el botón; la leyenda sigue en el menú (ya estaba también ahí)</td></tr>
</tbody></table>
<p><b>Por qué así:</b> lo que se usa en cada visita (cambiar de día, de vista, volver a hoy, agendar y ver pendientes con su número) nunca se esconde; lo ocasional (buscar, filtrar médico, bloquear, preferencias) baja un nivel. En computadora hay sitio y todo queda a la vista. En Duo abierto horizontal la fila se parte en la bisagra: «quién/cuándo» a la izquierda (≤ 431 px) y acciones a la derecha (x ≥ 496).</p>
<p><b>Capas:</b> «···» y «Ir a una fecha» son tarjeta centrada con velo en Duo cerrado y Duo abierto, hoja inferior en iPhone y menú anclado sin velo en computadora (CALMA §25–§27). Medidas: segmentado 3 px de pista, segmentos 38 de alto (30 en ancho), 14/600 (13 en ancho); iconos de 20 en --tinta2 con área 44 (36 en Duo h y computadora); «Hoy» texto 15/600 --enlace; contador 18 de alto, 12/700, --mes.</p>'''

# =========================================================== VISTA 4 · DÍA ===========================================================
def avisos():
    # AvisosAgenda.tsx: textos exactos. Se ven con la tira de maqueta.
    tri = '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>'
    return (f'<div class="ag0-aviso ag0-av-e" role="alert">{ic(tri, 16, 2)}<p><b>No se pudo cargar la agenda.</b> Lo que se ve puede estar incompleto o desactualizado.</p><button type="button" class="ag0-p">Reintentar</button></div>'
            f'<div class="ag0-aviso ag0-av-g" role="status">{gcal(16)}<p><b>No se pudo sincronizar con Google Calendar.</b> Tus citas se muestran normal; faltan los eventos del calendario.</p><button type="button" class="ag0-p">Revisar conexión</button></div>'
            f'<div class="ag0-aviso ag0-av-c" role="status">{ic(I["compactar"], 16, 2)}<p><b>Vista compacta:</b> horas fuera de horario recortadas</p><button type="button" class="ag0-p">Mostrar rejilla completa</button></div>')

def panel_dia():
    """Panel del Día (PanelDia.tsx: CardResumen + CardHuecos + MiniMes). Solo computadora (hoy ≥ 1024, vista Día)."""
    def tiles(c, e, o, l):
        return (f'<div class="ag0-tiles"><div class="ag0-tile"><b>{c}</b><span>citas</span></div><div class="ag0-tile"><b>{e}</b><span>eventos</span></div>'
                f'<div class="ag0-tile"><b>{o}</b><span>h ocupadas</span></div><div class="ag0-tile ag0-tile-p"><b>{l}</b><span>h libres</span></div></div>')
    des = [('ag', '3 agendadas'), ('conf', '2 confirmadas'), ('canc', '1 cancelada'), ('noas', '1 no asistió'), ('aten', '5 atendidas')]
    desg = '<ul class="ag0-des" aria-label="Por estado">' + ''.join(f'<li>{est(k, texto=False)}<span>{t}</span></li>' for k, t in des) + '</ul>'
    todo = '<p class="ag0-pnota">1 evento de todo el día, que no ocupa horas.</p>'
    res_n = f'<section class="ag0-pc ag0-pvn" aria-label="Resumen · Dr. Admin Semilla"><h2 class="ag0-pc-t">Resumen · Dr. Admin Semilla</h2>{tiles(12, 2, "6:35", "5:25")}{desg}{todo}</section>'
    res_m = f'<section class="ag0-pc ag0-pvm" aria-label="Resumen del día"><h2 class="ag0-pc-t">Resumen del día</h2>{tiles(19, 2, "—", "—")}<p class="ag0-pnota">Elige un médico para ver las horas y los huecos.</p></section>'
    res_h = f'<section class="ag0-pc ag0-pvh" aria-label="Resumen · Dr. Admin Semilla"><h2 class="ag0-pc-t">Resumen · Dr. Admin Semilla</h2>{tiles(0, 0, "—", "—")}<p class="ag0-pnota">Sin horario de consulta este día.</p></section>'
    turno = lambda h: f'<button type="button" class="ag0-p ag0-turno" data-ir="alta-{h.replace(":", "")}" aria-label="Agendar a las {h} (30 min)">{ic(I["plus"], 14, 2.4)}{h}</button>'
    hue_n = (f'<section class="ag0-pc ag0-pvn" aria-label="Huecos disponibles"><h2 class="ag0-pc-t">Huecos disponibles</h2>'
             f'<div class="ag0-hg" role="group" aria-label="Hueco 17:45 – 18:20"><p class="ag0-hgc"><b>17:45 – 18:20</b><span>35 min</span></p><p class="ag0-pnota">No cabe un turno entero en este hueco.</p></div>'
             f'<div class="ag0-hg" role="group" aria-label="Hueco 18:50 – 20:00"><p class="ag0-hgc"><b>18:50 – 20:00</b><span>70 min</span></p><div class="ag0-turnos">{turno("19:00")}{turno("19:30")}</div></div></section>')
    hue_h = (f'<section class="ag0-pc ag0-pvh" aria-label="Huecos disponibles"><h2 class="ag0-pc-t">Huecos disponibles</h2>'
             f'<p class="ag0-pvacio">{ic(I["agenda"], 22)}Consultorio cerrado · No hay horario de consulta este día</p></section>')
    # Sin médico elegido la tarjeta de huecos no sale (PanelDia.tsx: «unMedico &&»)
    nums = ''
    for n in (26, 27, 28, 29, 30, 31):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de octubre">{n}</button>'
    for n in range(1, 31):
        a2 = ' aria-current="date" aria-selected="true"' if n == 19 else ''
        nums += f'<button type="button" class="ag0-p" data-n="{n}"{a2} aria-label="{n} de noviembre de 2026">{n}</button>'
    for n in range(1, 7):
        nums += f'<button type="button" class="ag0-p ag0-fuera-m" aria-label="{n} de diciembre">{n}</button>'
    mm = (f'<section class="ag0-pc" aria-label="Calendario del mes"><div class="ag0-mm ag0-mmp"><div class="ag0-mm-c"><b>Noviembre de 2026</b>'
          f'<button type="button" class="ag0-p ag0-ic" aria-label="Mes anterior">{ic(I["ant"], 20, 2.2)}</button><button type="button" class="ag0-p ag0-ic" aria-label="Mes siguiente">{ic(I["sig"], 20, 2.2)}</button></div>'
          f'<div class="ag0-mm-g">{"".join(f"<span>{x}</span>" for x in "LMXJVSD")}{nums}</div></div></section>')
    return f'<aside class="ag0-pd" aria-label="Panel del día">{res_n}{res_m}{res_h}{hue_n}{hue_h}{mm}</aside>'

def vista4(vp):
    tpl = ''.join(burbuja(c) for c in CITAS if c['d'] == HOY)
    capas = menu_opciones(vp) + capa_fecha(vp) + capa_burbuja()
    b, flota = barra(vp, 'dia')
    rj = rejilla(vp, [HOY], scroll=12)
    if vp == 'esc':
        cuerpo = f'<div class="ag0-diap">{rj}{panel_dia()}</div>'
    else:
        cuerpo = rj
    return f'<main class="ag0-cont">{b}{avisos()}{cuerpo}{flota}</main>', capas + tpl

FICHA_4 = '''<h3>Especificación · Vista Día</h3>
<p>Composición: navegación del dispositivo («Agenda» marcada) → barra (dos filas) → tarjeta de la rejilla que ocupa el resto y se desplaza por dentro. Abre a las 12:00 para que se vea la tarde con la hora actual (17:10). Toca cualquier bloque: abre la burbuja como capa del catálogo con el contenido y las acciones de hoy (BurbujaCita.tsx / accionesTarjeta.ts). El bloqueo abre su edición (no se dibuja aquí). Toca un hueco para ver el fantasma de la cita nueva.</p>
<p><b>Panel del día (solo computadora, como hoy: <code>panelDelDia</code> a ≥ 1024 en Día).</b> Columna de 300 px a la derecha de la rejilla, que se desplaza sola. Tres tarjetas --sup de radio 20:</p>
<ul><li><b>Resumen</b> («Resumen · Dr. …» con médico filtrado, «Resumen del día» sin él): mosaicos citas / eventos / h ocupadas / h libres (22/700 tabular sobre --fondo; «h libres» en --enlace), desglose por estado con el icono en círculo en vez del punto, y las notas de hoy: «1 evento de todo el día, que no ocupa horas.», «Elige un médico para ver las horas y los huecos.» (las horas pasan a «—»), «Sin horario de consulta este día.».</li>
<li><b>Huecos disponibles</b> (no sale con «Todos los médicos»): por hueco, rango 15/600 y duración 13; turnos como píldoras tonales de 36 «+ 19:00» (aria «Agendar a las 19:00 (30 min)»); sin turno entero, «No cabe un turno entero en este hueco.»; sin horario, «Consultorio cerrado · No hay horario de consulta este día».</li>
<li><b>Mini mes</b> navegable («Mes anterior» / «Mes siguiente»); hoy en --enlace, el día a la vista relleno. Elegir un día lleva la vista Día a ese día.</li></ul>
<p>«Citas del día seleccionado» / «Ver día ›» / «Sin citas este día» (PanelDelDia.tsx) NO está en el panel de Día en el código: lo monta el Mes de teléfono: está en la vista Mes de esta misma página.</p>
<p>A 1024 de ventana (776 de contenido) la barra sigue en dos filas: el título baja de 32 a 26 (consulta de contenedor) y la rejilla queda en 412 px, con los bloques en su forma media.</p>
<p>La burbuja es MUESTRA (otro agente la completa): cabecera con estado (icono + texto), ⋮ «Más opciones de la cita» y ✕; nombre; procedencia; hora y médico; «Observaciones:» si hay; principal según estado; el resto de acciones como filas de menú y la destructiva en rojo al final. Las tres acciones con icono de hoy pasan de botones con fondo a filas (CALMA §2, §11).</p>'''

# =========================================================== VISTA 5 · SEMANA EN PANTALLA PEQUEÑA ===========================================================
def lista_semana(vp):
    tira_d = ''
    for i, (c3, n, largo) in enumerate(DIAS):
        k = [c for c in CITAS if c['d'] == i]
        pts = ''.join('<i></i>' for _ in range(min(3, len(k))))
        cur = ' aria-current="date"' if i == HOY else ''
        sel = 'true' if i == HOY else 'false'
        tira_d += f'<button type="button" class="ag0-p ag0-td" role="tab" aria-selected="{sel}" data-d="{i}"{cur} aria-label="{largo} {n}, {len(k)} en la agenda"><span class="ag0-tl">{c3[0]}</span><b>{n}</b><span class="ag0-tpt">{pts}</span></button>'
    filas = ''
    for i, (c3, n, largo) in enumerate(DIAS):
        hoy = ' ag0-ld-hoy' if i == HOY else ''
        k = sorted([c for c in CITAS if c['d'] == i], key=lambda c: c['a'])
        nk = sum(1 for c in k if c['tipo'] == 'cita' or c['tipo'] == 'gl')
        ne = sum(1 for c in k if c['tipo'] in ('ev', 'evn'))
        filas += f'<h3 class="ag0-ld{hoy}" data-ld="{i}">{largo} {n}{" · hoy" if i == HOY else ""}<small>{nk} cit · {ne} ev</small></h3>'
        for t in TODO.get(i, []):
            filas += f'<div class="ag0-lf" style="min-height:44px">{"<span class=ag0-lh>Todo el día</span>"}<span style="flex:1;display:flex">{chip_todo(t)}</span></div>'
        if not k and not TODO.get(i):
            filas += '<p class="ag0-lvac">Sin citas este día</p>'
        for c in k:
            ev = c['tipo'] in ('ev', 'evn')
            cl = f'ag0-b--ev" style="--b-ev:var(--cal-ev-{c["evc"]})' if c['tipo'] == 'ev' else f'ag0-b--{c["e"]}'
            ico = ic(I[c['evi']], 14, 2.2) if ev else ic(I[EST[c['e']][1]], 14, 2.4)
            l2 = [f'{round((c["b"] - c["a"]) * 60)} min']
            corto = vp == 'ext'  # filas estrechas: textos cortos aprobados (CALMA §28)
            if c['ori'] == 'enlace': l2.append(f'<span>{ic(I["enlace"], 14, 2)}{"Por enlace" if corto else "Reservó por enlace"}</span>')
            if c['ori'] == 'google': l2.append(f'<span>{gcal(14)}{"Desde Google Calendar" if corto else "Agendada desde Google Calendar"}</span>')
            if c['sx']: l2.append(f'<span>{sinexp(14)}Sin expediente</span>')
            if c['obs'] and not c['sx']: l2.append(c['obs'])
            derecha = '' if ev else est(c['e'], texto=False)
            canc = ' ag0-lf--canc' if c['e'] == 'canc' else ''
            filas += (f'<button type="button" class="ag0-p ag0-lf {cl}{canc}" data-cita="{c["id"]}" aria-label="{c["nom"]}, {hm(c["a"])} a {hm(c["b"])}, {"Evento" if ev else EST[c["e"]][0]}">'
                      f'<span class="ag0-lh">{hm(c["a"])}<small>{hm(c["b"])}</small></span><span class="ag0-lb" aria-hidden="true"></span>'
                      f'<span class="ag0-lc"><span class="ag0-ln">{c["nom"]}</span><span class="ag0-l2">{"<span>·</span>".join(l2) if False else " · ".join(l2)}</span></span>{derecha}{ic(I["sig"], 16, 2.2)}</button>')
    return f'<nav class="ag0-tira-d" role="tablist" aria-label="Días de la semana">{tira_d}</nav><div class="ag0-sl">{filas}</div>'

def vista5(vp):
    b, flota = barra(vp, 'semana')
    if vp in ('ext', 'tel'):
        a = f'<main class="ag0-cont">{b}{lista_semana(vp)}{flota}</main>'
        bmar = marco('5', vp, f'<main class="ag0-cont">{b}{rejilla(vp, list(range(7)), scroll=12, minimo=True)}{flota}</main>')
        bmar = bmar.replace('class="marco ag0 ag0-v5"', 'class="marco ag0 ag0-v5 ag0-gemelo"', 1)
        return a, f'<template class="ag0-tplB" data-rotulo="Versión B · rejilla de 7 columnas compacta">{bmar}</template>'
    return f'<main class="ag0-cont">{b}{rejilla(vp, list(range(7)), scroll=12)}</main>', ''

FICHA_5 = '''<h3>Especificación · Semana en pantalla pequeña</h3>
<p>En Duo cerrado e iPhone se ven las dos versiones lado a lado: a la izquierda el marco de la página (<b>versión A, recomendada y ya aceptada</b>), a la derecha la <b>versión B</b>. En Duo abierto y computadora, solo la rejilla de siete columnas.</p>
<table><thead><tr><th></th><th>A · lista por día con tira de fechas</th><th>B · rejilla de 7 columnas compacta</th></tr></thead><tbody>
<tr><th>Qué se lee</th><td>nombre completo, hora, duración, origen, estado (icono)</td><td>solo color e icono de estado por bloque (columnas de 36–45 px); el nombre exige tocar</td></tr>
<tr><th>Toque</th><td>filas de 56+ px a todo el ancho; tira de días de 44+ de ancho</td><td>cabeceras de día y bloques de 36–45 px de ancho: <b>por debajo de 44</b></td></tr>
<tr><th>Para qué sirve</th><td>«¿a quién veo y cuándo?»</td><td>«¿qué días están llenos?» de un vistazo</td></tr>
</tbody></table>
<p>A: tira de fechas (7 botones; hoy en círculo --cal-hoy-num, día elegido sobre --fondo, hasta 3 puntos de ocupación) que lleva a su día; lista con cabecera de día fija («JUEVES 19 · HOY» en --enlace; conteo «N cit · N ev» como en el Mes de hoy), filas con hora inicio/fin 13/600 tabular, barra de 3 px del color del estado, nombre 15/600, segunda línea 13 --tinta2 (duración · origen · sin expediente · observaciones) y el estado como icono en círculo. Los eventos de todo el día van primero; los días sin nada dicen «Sin citas este día» (texto de hoy).</p>'''

# =========================================================== VISTA 6 · COLOR ===========================================================
FILAS6 = [
    # (token base, nombre, uso, muestra, pares de contraste, sale de, sustituye a)
    ('ag', 'Agendada', 'estado', 'cita', [('--cal-ag-tinta', '--cal-ag-fondo', 4.5, 'hora'), ('--tinta', '--cal-ag-fondo', 4.5, 'nombre'), ('--cal-ag-barra', '--sup', 3, 'barra')], '--ag-fondo · --ag-punto · --ag-tinta', '--ag-status-scheduled-* (bg, border, dot, text)'),
    ('conf', 'Confirmada', 'estado', 'cita', [('--cal-conf-tinta', '--cal-conf-fondo', 4.5, 'hora'), ('--tinta', '--cal-conf-fondo', 4.5, 'nombre'), ('--cal-conf-barra', '--sup', 3, 'barra')], '--tonal · --accion · --tonal-tinta', '--ag-status-confirmed-*'),
    ('aten', 'Atendida', 'estado', 'cita', [('--cal-aten-tinta', '--cal-aten-fondo', 4.5, 'hora'), ('--tinta', '--cal-aten-fondo', 4.5, 'nombre'), ('--cal-aten-barra', '--sup', 3, 'barra')], '--ok-fondo · --ok-tinta', '--ag-status-attended-*, --ag-success-*'),
    ('canc', 'Cancelada', 'estado', 'cita', [('--cal-canc-tinta', '--cal-canc-fondo', 4.5, 'hora'), ('--tinta2', '--cal-canc-fondo', 4.5, 'nombre tachado'), ('--cal-canc-barra', '--sup', 3, 'barra')], '--mal-fondo · --mal-tinta', '--ag-status-cancelled-*'),
    ('noas', 'No asistió', 'estado', 'cita', [('--cal-noas-tinta', '--cal-noas-fondo', 4.5, 'hora'), ('--tinta', '--cal-noas-fondo', 4.5, 'nombre'), ('--cal-noas-barra', '--sup', 3, 'barra')], '--sup2 · --tinta3 · --tinta2', '--ag-status-no_show-*'),
    ('ev', 'Evento (6 colores del usuario)', 'tipo', 'evento', [('--tinta', '--b-fondo', 4.5, 'título'), ('--tinta2', '--b-fondo', 4.5, 'hora'), ('--b-ev', '--sup', 3, 'barra')], 'literales (los de hoy) · relleno = color al 12 % sobre --sup', '--ag-evento-indigo/magenta/carmin/oliva/bronce/grafito'),
    ('gl', 'Google por asignar / reserva por ligar', 'tipo', 'google', [('--cal-ag-tinta', '--cal-ag-fondo', 4.5, 'hora'), ('--cal-ag-barra', '--sup', 3, 'contorno')], 'el estado + contorno discontinuo; G multicolor de Google', '--ag-gcal-* (text, border, accent, bg1, bg2)'),
    ('bq', 'Bloqueo', 'tipo', 'bloqueo', [('--cal-bloqueo-tinta', '--sup', 4.5, 'rótulo'), ('--cal-bloqueo-raya', '--sup', 1.3, 'raya')], '--tinta2 al 5 % (fondo) y al 20 % (raya)', 'rayado de .ag-bloqueo-tramo (--ag-ink-600 al 6 % / 16 %)'),
    ('fuera', 'Fuera de horario', 'rejilla', 'fuera', [('--tinta2', '--cal-fuera', 4.5, 'hora')], '--fondo', '--ag-offhours-bg, --fc-non-business-color'),
    ('hoy', 'Hoy', 'rejilla', 'hoy', [('--sobre-blanco', '--cal-hoy-num', 4.5, 'número'), ('--enlace', '--sup', 4.5, 'día')], '--accion (número) · --accion al 5 % (columna)', '--ag-today-bg, --ag-today-ring'),
    ('ahora', 'Hora actual', 'rejilla', 'ahora', [('--sup', '--cal-ahora', 4.5, 'píldora'), ('--cal-ahora', '--sup', 3, 'línea')], '--mes', '--ag-now-line, --ag-now-pill-bg'),
    ('linea', 'Líneas y horas', 'rejilla', 'linea', [('--tinta2', '--sup', 4.5, 'etiqueta')], '--linea · --tinta2', '--ag-hour-line, --ag-col-line, --ag-hairline, --ag-faint'),
    ('hueco', 'Hueco pulsado / selección', 'rejilla', 'hueco', [('--enlace', '--sup', 4.5, 'texto'), ('--cal-sel', '--sup', 3, 'anillo')], '--accion · --enlace', '--ag-brand-secondary, --ag-primary-bg-faint'),
]

def muestra6(k, fz):
    # Muestra dentro de un ámbito forzado claro u oscuro
    if k == 'cita':
        return ''
    return ''

def celda6(fila, fz):
    base, nombre, uso, tipo, pares, de, sust = fila
    if tipo == 'cita':
        c = S(e=base, a=10, b=10.5, ori='', obs=None, nom='Paciente Prueba 07')
        m = f'<div class="ag0-m-c" style="--w:150px;--hh:.5;border:0">{bloque(c, estilo="top:1px;height:calc(var(--cal-h) * .5 - 2px)")}</div>'
    elif tipo == 'evento':
        cols = ''.join(f'<span title="" style="width:20px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--cal-ev-{x}) 12%,var(--sup));box-shadow:inset 3px 0 0 var(--cal-ev-{x})" aria-label="{x}" role="img"></span>' for x in ('indigo', 'magenta', 'carmin', 'oliva', 'bronce', 'grafito'))
        c = dict(S(a=14, b=14.5), nom='Junta de servicio', tipo='ev', evc='indigo', evi='junta', tel=None, ori='', obs=None, e='ag')
        m = f'<div style="display:flex;flex-direction:column;gap:6px"><div class="ag0-m-c" style="--w:150px;--hh:.5;border:0">{bloque(c, estilo="top:1px;height:calc(var(--cal-h) * .5 - 2px)")}</div><div style="display:flex;gap:4px">{cols}</div></div>'
    elif tipo == 'google':
        c = dict(S(a=18.5, b=19), nom='Revisión de estudios', tipo='gl', ori='google', sx=True, tel=None, obs=None, e='ag', cons=None)
        m = f'<div class="ag0-m-c" style="--w:150px;--hh:.5;border:0">{bloque(c, estilo="top:1px;height:calc(var(--cal-h) * .5 - 2px)")}</div>'
    elif tipo == 'bloqueo':
        m = (f'<div class="ag0-m-c" style="--w:150px;--hh:.5;border:0"><span class="ag0-bq" style="top:0;height:100%"><span class="ag0-bq-r" style="top:0;height:100%"></span>'
             f'<span class="ag0-bq-t">{ic(I["candado"], 12, 2.2)}<span>Bloqueado</span></span></span></div>')
    elif tipo == 'fuera':
        m = '<div class="ag0-m-c ag0-m-f" style="--w:150px;--hh:.5;border:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--tinta2)">07:00</div>'
    elif tipo == 'hoy':
        m = '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:8px;background:var(--cal-hoy)"><span class="ag0-dia" aria-current="date" style="min-height:36px"><span>Jue</span><b>19</b></span></div>'
    elif tipo == 'ahora':
        m = '<div style="position:relative;width:150px;height:24px"><span class="ag0-ahora-p" style="left:0;right:auto;top:12px">17:10</span><span class="ag0-ahora" style="left:52px;top:12px"></span></div>'
    elif tipo == 'linea':
        m = '<div class="ag0-m-c" style="--w:150px;--hh:.5;border:0;font-size:12px;line-height:16px;color:var(--tinta2);padding:2px 6px">08:00</div>'
    else:
        m = f'<div class="ag0-m-c" style="--w:150px;--hh:.5;border:0"><span class="ag0-hueco ag0-on" style="top:1px;height:calc(var(--cal-h) * .5 - 2px)">{ic(I["plus"], 12, 2.4)}<span>10:30 – 11:00</span></span></div>'
    crs = ''.join(f'<span class="ag0-crf"><span>{t}</span><output class="ag0-cr" data-fg="{a}" data-bg="{b}" data-min="{mn}">—</output></span>' for a, b, mn, t in pares)
    ev = ' style="--b-ev:var(--cal-ev-indigo);--b-fondo:color-mix(in srgb,var(--cal-ev-indigo) 12%,var(--sup))"' if tipo == 'evento' else ''
    sob = ' style="--sobre-blanco:#fff"' if tipo == 'hoy' else ''
    return f'<div class="ag0-fz {fz} ag0-c6"{ev}{sob}>{m}<span class="ag0-crs">{crs}</span></div>'

def vista6(vp):
    filas = ''
    for f in FILAS6:
        base, nombre, uso, tipo, pares, de, sust = f
        tok = {'ag': '--cal-ag-*', 'conf': '--cal-conf-*', 'aten': '--cal-aten-*', 'canc': '--cal-canc-*', 'noas': '--cal-noas-*', 'ev': '--cal-ev-{color}',
               'gl': '(estado) + discontinuo', 'bq': '--cal-bloqueo-*', 'fuera': '--cal-fuera', 'hoy': '--cal-hoy · --cal-hoy-num', 'ahora': '--cal-ahora',
               'linea': '--cal-linea', 'hueco': '--cal-hueco · --cal-sel'}[base]
        filas += (f'<li class="ag0-t6"><div class="ag0-t6-n"><b>{nombre}</b><code>{tok}</code><span>{uso}</span></div>'
                  f'<div class="ag0-t6-m"><span class="ag0-t6-r">Claro</span>{celda6(f, "ag0-fz-c")}</div>'
                  f'<div class="ag0-t6-m"><span class="ag0-t6-r">Oscuro</span>{celda6(f, "ag0-fz-o")}</div>'
                  f'<div class="ag0-t6-d"><span><b>Sale de</b> {de}</span><span><b>Sustituye a</b> {sust}</span></div></li>')
    estilo6 = '''<style>
.ag0 .ag0-t6l{display:flex;flex-direction:column}
.ag0 .ag0-t6{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 12px;padding:14px 0;border-top:1px solid var(--linea)}
.ag0 .ag0-t6:first-child{border-top:0}
.ag0 .ag0-t6-n{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.ag0 .ag0-t6-n b{font-size:15px;line-height:20px;font-weight:600}
.ag0 .ag0-t6-n code{font:12px/16px ui-monospace,Menlo,monospace;color:var(--tinta2)}
.ag0 .ag0-t6-n span{font-size:12px;line-height:16px;color:var(--tinta2)}
.ag0 .ag0-t6-m{display:flex;flex-direction:column;gap:4px;min-width:0}
.ag0 .ag0-t6-r{font-size:12px;line-height:16px;font-weight:600;color:var(--tinta2)}
.ag0 .ag0-c6{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;background:var(--sup);min-width:0;box-shadow:inset 0 0 0 1px var(--linea)}
.ag0 .ag0-c6 .ag0-m-c{max-width:100%}
.ag0 .ag0-crs{display:flex;flex-direction:column;gap:2px}
.ag0 .ag0-crf{display:flex;flex-wrap:wrap;justify-content:space-between;column-gap:8px;font-size:12px;line-height:16px;color:var(--tinta2)}
.ag0 .ag0-cr{font-weight:600;color:var(--ok-tinta);font-variant-numeric:tabular-nums;white-space:nowrap}
.ag0 .ag0-cr.ag0-cr-mal{color:var(--mal-tinta)}
.ag0 .ag0-t6-d{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:16px;color:var(--tinta2)}
.ag0 .ag0-t6-d b{color:var(--tinta);font-weight:600}
.ag0[data-vp="ih"] .ag0-t6,.ag0[data-vp="iv"] .ag0-t6{grid-template-columns:150px minmax(0,1fr) minmax(0,1fr)}
.ag0[data-vp="esc"] .ag0-t6{grid-template-columns:180px 200px 200px minmax(0,1fr);align-items:start}
.ag0[data-vp="ih"] .ag0-t6-n,.ag0[data-vp="iv"] .ag0-t6-n,.ag0[data-vp="esc"] .ag0-t6-n{grid-column:1;flex-direction:column;gap:2px}
.ag0[data-vp="esc"] .ag0-t6-d{grid-column:4}
</style>'''
    return f'''<main class="ag0-cont ag0-desp">
  <header class="ag0-cab"><h1>Color de la agenda</h1><p>Tokens --cal-* en claro y oscuro, con el contraste medido en vivo</p></header>
  <section class="ag0-sec"><h2 class="ag0-rot">Por estado y por tipo</h2><p>Texto ≥ 4,5:1 · gráficos (barra, línea) ≥ 3:1. La raya del bloqueo es textura, no información (su rótulo sí cumple).</p>
  <div class="ag0-tar"><ul class="ag0-t6l">{filas}</ul></div></section>
</main>''', estilo6

FICHA_6 = '''<h3>Especificación · correspondencia de color</h3>
<p>De los <b>131</b> tokens <code>--ag-*</code> de hoy, la agenda nueva necesita <b>23</b> propios (<code>--cal-*</code>: 15 de estado, 6 de color de evento y bloqueo/fuera/hoy/hora actual/línea/hueco/selección, que casi todos son alias del kit). El resto se sustituye por tokens del kit y desaparece. Nombres sin choque con <code>--ag-fondo/--ag-tinta/--ag-punto</code> del kit.</p>
<table><thead><tr><th>Familia de hoy (n.º)</th><th>Pasa a</th></tr></thead><tbody>
<tr><th>Superficies: bg-app, bg-main, grid-col, surface, modal-bg, input-bg, month-cell (≈ 9)</th><td>--fondo · --sup (un solo oscuro, el del kit; adiós al #1E1E1E de .bg-white)</td></tr>
<tr><th>Hundidas: surface-sunken, control-bg, chip-bg, segment-bg (≈ 6)</th><td>--sup2</td></tr>
<tr><th>Tintes azules: primary-bg-faint, patient-card-bg, today-bg, modal-icon-bg (≈ 6)</th><td>--tonal · --cal-hoy</td></tr>
<tr><th>Tintas: ink, text, ink-600, muted, muted2, faint (6)</th><td>--tinta · --tinta2 · --tinta3 (cuatro grises → dos)</td></tr>
<tr><th>Bordes y líneas: border-card, input-border, hairline, hour-line, col-line (≈ 8)</th><td>--linea (las tarjetas y campos van sin borde)</td></tr>
<tr><th>Marca: brand-primary, brand-secondary, brand-legible, navy (≈ 6)</th><td>--navy · --accion · --enlace (sin degradado en «Agendar»)</td></tr>
<tr><th>Estados: status-*-bg/-border/-dot/-text (20)</th><td>--cal-{ag,conf,aten,canc,noas}-{fondo,barra,tinta} (15) — el borde desaparece</td></tr>
<tr><th>Avisos y éxito: aviso-*, success-*, error-* (≈ 8)</th><td>--ag-* · --ok-* · --mal-* del kit</td></tr>
<tr><th>Google: gcal-text/-border/-accent/-bg1/-bg2 (5)</th><td>ninguno: el evento de Google usa el color de su estado + la G multicolor</td></tr>
<tr><th>Eventos: evento-indigo…grafito (6)</th><td>--cal-ev-* (mismos valores, claro y oscuro)</td></tr>
<tr><th>Hora actual: now-line, now-pill-bg (2)</th><td>--cal-ahora (= --mes)</td></tr>
<tr><th>Velos y sombras: modal-overlay, shadow-card/-pop/-elevada, .ag-capa-velo literal (≈ 5)</th><td>--velo + desenfoque · --sombra-capa (solo capas)</td></tr>
<tr><th>Espaciado, radios, duraciones, curvas (≈ 30)</th><td>escala del kit (4·8·12·16…; radios 8/12/16/20; resortes)</td></tr>
</tbody></table>
<p>El contraste de la tabla se calcula en la página con los colores ya resueltos (incluidas las mezclas <code>color-mix</code>) y compuestos sobre --sup. Los dos ámbitos «Claro» y «Oscuro» repiten los tokens del kit para verse a la vez; en la app los <code>--cal-*</code> viven en <code>:root</code> junto a los del kit y solo los 6 de evento necesitan valor de oscuro.</p>'''

# =========================================================== ESCRITURA ===========================================================
salida('1', '1-bloque', 'Agenda · El bloque de cita',
       'La pieza que más se repite: un solo bloque que decide qué enseña según su alto y su ancho, sin bajar nunca de 12 px; color por estado e icono del dashboard',
       [marco('1', vp, lamina_bloque(vp)) for vp in VPS], FICHA_1, [['Cerrar todo', 'cerrar']])

salida('2', '2-rejilla', 'Agenda · La rejilla horaria',
       'Rejilla calmada sobre una sola superficie: horas a 12 px, fuera de horario como banda gris, bloqueo rayado solo dentro del horario, hora actual en rojo, hoy en azul y el hueco que se toca para agendar',
       [marco('2', vp, vista2(vp)) for vp in VPS], FICHA_2,
       [['Día', 'modo:dia', False], ['Semana', 'modo:semana', False], '|', ['Hueco pulsado', 'hueco'], ['Densidad compacta', 'clase:ag0-densa-m', False], ['Cerrar', 'cerrar']], huecoDia=3, huecoHora=19.2)

salida('3', '3-barra', 'Agenda · La barra',
       'Todos los controles de hoy en dos filas en cualquier dispositivo: periodo y acciones arriba, ‹ Hoy › y Mes | Semana | Día abajo; lo ocasional agrupado en «Opciones de la agenda»',
       [marco('3', vp, vista3(vp), menu_opciones(vp) + capa_fecha(vp)) for vp in VPS], FICHA_3,
       [['menú abierto', 'menu'], ['Ir a una fecha', 'fecha'], ['Cerrar', 'cerrar']], titulos=TIT)

v4 = {vp: vista4(vp) for vp in VPS}
salida('4', '4-dia', 'Agenda · Vista Día',
       'El día de hoy con las piezas nuevas: la cita en curso marcada por la hora actual, cancelada, evento, bloqueo, reserva por ligar y un evento de Google por asignar solapado; tocar un bloque abre la burbuja del catálogo',
       [marco('4', vp, v4[vp][0], v4[vp][1]) for vp in VPS], FICHA_4,
       [['burbuja en curso (07)', 'bu:j10'], ['confirmada (10)', 'bu:j11'], ['cancelada (08)', 'bu:j6'], ['evento', 'bu:j7'], ['Google por asignar', 'bu:j13'], ['reserva por ligar (26)', 'bu:j8'], ['atendida (09)', 'bu:j9'], ['no asistió (05)', 'bu:j2'], '|', ['opciones', 'menu'], ['hueco pulsado', 'hueco'], '|', ['panel sin médico elegido', 'clase:ag0-sinmed', False], ['panel sin horario', 'clase:ag0-sinhor', False], ['día 24 elegido en el mini-mes', 'clase:ag0-mmsel', False], '|', ['aviso de error', 'clase:ag0-ave', False], ['aviso de Google', 'clase:ag0-avg', False], ['aviso de vista compacta', 'clase:ag0-avc', False], ['Cerrar', 'cerrar']], huecoDia=3, huecoHora=19.2)

v5 = {vp: vista5(vp) for vp in VPS}
m5 = []
for vp in VPS:
    a, tpl = v5[vp]
    m = marco('5', vp, a)
    if tpl:
        m = m[:m.rindex('</div>')] + tpl + '\n</div>'
    m5.append(m)
salida('5', '5-semana-chica', 'Agenda · Semana en pantalla pequeña',
       'En Duo cerrado e iPhone, a la izquierda la lista por día con tira de fechas (A, la recomendada) y a la derecha la rejilla de 7 columnas compacta (B) para comparar; en Duo abierto y computadora, la rejilla de siete columnas',
       m5, FICHA_5, [['Cerrar', 'cerrar']], gemelo=True)

m6 = []
for vp in VPS:
    cont, est6 = vista6(vp)
    m6.append(marco('6', vp, cont))
est6 = vista6('esc')[1]
salida('6', '6-color', 'Agenda · Color',
       'Los 131 colores propios de la agenda se reducen a 23 tokens --cal-* que salen del kit: un solo oscuro, contraste medido y la correspondencia por familias',
       m6, FICHA_6, [])
# El estilo de la tabla de color va en el mismo <style>: se inserta tras el CSS común
p = f'{L}/vista-6-color.html'; t = open(p).read(); t = t.replace('</style>\n', '\n' + est6.replace('<style>', '').replace('</style>', '') + '</style>\n', 1); open(p, 'w').write(t)

# =========================================================== VISTA 7 · 3 DÍAS ===========================================================
ANCHO_TRES = {'ext': 84, 'tel': 105, 'ih': 183, 'iv': 189, 'esc': 309}
def vista7(vp):
    tpl = ''.join(burbuja(c) for c in CITAS if c['d'] in (3, 4, 5))
    capas = menu_opciones(vp) + capa_fecha(vp) + capa_burbuja()
    b, flota = barra(vp, 'tres')
    return f'<main class="ag0-cont">{b}{rejilla(vp, [3, 4, 5], scroll=12)}{flota}</main>', capas + tpl

FICHA_7 = """<h3>Especificación · 3 días (CALMA §29.1)</h3>
<p>Rejilla horaria de tres columnas (hoy + dos) en los cinco marcos, con las mismas piezas que Día y Semana: <code>rejilla(vp, [3, 4, 5])</code>. Es la cuarta vista del conmutador (Mes · Semana · 3 días · Día), siempre disponible. Título del periodo: «19 – 21 nov 2026» en ancho y «19 – 21 de noviembre» en teléfono.</p>
<table><thead><tr><th></th><th>Duo cerrado</th><th>iPhone</th><th>Duo abierto (h)</th><th>Duo abierto (v)</th><th>Computadora</th></tr></thead><tbody>
<tr><th>Ancho de columna</th><td>84 px</td><td>105 px</td><td>183 px</td><td>189 px</td><td>309 px</td></tr>
<tr><th>Forma del bloque</th><td>muy estrecha (icono + hora / nombre corto)</td><td>estrecha</td><td colspan="2">estrecha (sin llegar a la media de 200)</td><td>media (fila con estado en icono)</td></tr>
<tr><th>Hueco para agendar</th><td colspan="2">no (no existe en teléfono)</td><td colspan="3">sí</td></tr>
</tbody></table>
<p>En computadora NO lleva el panel del Día: hoy el panel solo sale en la vista Día (<code>panelDelDia</code> exige <code>timeGridDay</code>).</p>"""
v7 = {vp: vista7(vp) for vp in VPS}
salida('7', '7-tres-dias', 'Agenda · 3 días',
       'La cuarta vista, ahora en todos los dispositivos: hoy y los dos días siguientes como rejilla horaria de tres columnas, con los mismos bloques, bloqueos, hora actual y burbuja',
       [marco('7', vp, v7[vp][0], v7[vp][1]) for vp in VPS], FICHA_7,
       [['burbuja en curso (07)', 'bu:j10'], ['hueco pulsado', 'hueco'], ['Cerrar', 'cerrar']], huecoDia=4, huecoHora=14.2)

# =========================================================== INTEGRACIÓN (kit/INTEGRACION.md) ===========================================================
# Día (vista 4) y 3 días (vista 7) son las vistas publicadas en la página Calendario. Cada control lleva a su PIEZA REAL,
# copiada de la carpeta que la hizo (sus generadores se ejecutan solo hasta antes de su escritura; aquí no se escribe nada fuera):
#   burbuja de cita, burbuja de alta, alertas, avisos breves, tarjeta al pasar → ../ag-burbuja (.ab, y su guion)
#   formulario de cita/evento, bloquear horario, convertir en cita → ../ag-form (.af)
#   burbuja por ligar / Google por asignar y ventana de ligar → ../ag-ligado (.al, y su guion, que extiende el de esta base)
#   opciones, buscar, campana, médico, leyenda, atajos, huecos (Duo abierto) → ../ag-herr (.ah)
#   cajón, «Más» y selector de consultorio → ../cromo (prefijo cr4)
import re as _re
SIB = os.path.normpath(L + '/..')
def _ns(path, corte, extra=None):
    src = open(path).read()
    src = src[:src.index(corte)]
    N = {'__file__': path, '__name__': 'pieza'}
    if extra: N.update(extra)
    exec(compile(src, path, 'exec'), N)
    return N

AB = _ns(f'{SIB}/ag-burbuja/tmp-ab.py', 'def vista4(vp):')
AL = _ns(f'{SIB}/ag-ligado/tmp-al-gen.py', "exec(open(os.path.join(AQUI, 'tmp-al-vistas.py')).read())")
AF = _ns(f'{SIB}/ag-form/tmp-af-gen.py', "exec(open(A + '/tmp-af-vistas.py').read())")
_v = open(f'{SIB}/ag-form/tmp-af-vistas.py').read()
exec(compile(_v[:_v.index("salida(1, '1-cita'")], 'af-vistas', 'exec'), AF)
AH = _ns(f'{SIB}/ag-herr/tmp-gen-ah.py', "salida(1, '1-buscar'")
CR = _ns(f'{SIB}/cromo/tmp-v2.py', "FICHA = ficha(P")
CR1 = _ns(f'{SIB}/cromo/tmp-v1.py', "CSS = '''")
_c1 = open(f'{SIB}/cromo/tmp-v1.py').read(); CR1_CSS = _c1[_c1.index("CSS = '''") + 9:_c1.index("'''", _c1.index("CSS = '''") + 9)]
CRP = 'cr4'
def _cr(h): return h.replace('§', CRP)

def _tpl_sin_reparto(h):
    return _re.sub(r'<template\b[^>]*>.*?</template>', lambda m: '' if ('ab-mi-q' in m.group(0) or 'otro agente' in m.group(0) or 'hueco documentado' in m.group(0)) else m.group(0), h, flags=_re.S)

# Acciones de las filas de menú copiadas sin destino propio → el mismo destino que en la burbuja de ag-burbuja
_ACC = {'Editar': 'd-editar', 'Reagendar': 'd-reagendar', 'Convertir en cita': 'd-convertir', 'Cancelar cita': 'al-cancelar', 'Eliminar evento': 'al-eliminar-ev',
        'No asistió': 'al-noasistio', 'Marcar como confirmada': 't-confirmada', 'Enviar por WhatsApp': 'm-wa', 'Enviar por correo': 'm-correo'}
def _cablea(h):
    def f(m):
        abre, cuerpo = m.group(1), m.group(2)
        txt = _re.sub(r'<small>.*?</small>', '', cuerpo, flags=_re.S)
        txt = _re.sub(r'<[^>]+>', '', txt).strip()
        if 'data-ir' in abre or 'data-al' in abre or 'data-sub' in abre or txt not in _ACC: return m.group(0)
        return abre.replace('<button ', f'<button data-ir="{_ACC[txt]}" ', 1) + cuerpo + '</button>'
    h = _re.sub(r'(<button [^>]*class="ag0-p ag0-op[^"]*"[^>]*>)((?:(?!</button>).)*?)</button>', f, h, flags=_re.S)
    return h.replace('aria-label="Más opciones de la cita" aria-haspopup="dialog">', 'aria-label="Más opciones de la cita" aria-haspopup="dialog" data-ir="d-editar">')

def _ligar_tpl(c):
    c = dict(c)
    if c['id'] == 'j8': c.update(correo='paciente26@semilla.spinus.test')
    h = AL['burbuja']('b:' + c['id'], c)
    h = h.replace(f'<template data-bu="b:{c["id"]}">', f'<template data-t="b:{c["id"]}" data-capa="bu" data-ancla="{c["id"]}" data-cls="" data-titulo="{c["nom"]}">', 1)
    return _cablea(h)

def _menu_ah(vp, dia):
    h = AH['menu_ah'](vp)
    if not dia: h = h.replace('class="ag0-p ag0-op ah-solodia"', 'hidden class="ag0-p ag0-op ah-solodia"')
    return h.replace('data-sw="1">' + ic(I['cursor'], 20, 2), 'data-sw="1" data-popup="1">' + ic(I['cursor'], 20, 2))

def _cromo(vp):
    cajon = mas = ''
    if vp in ('tel', 'iv'):
        cajon = f'<nav class="§-cajon §-nav" aria-label="Menú">{CR1["lateral"]("agenda", CR1["aviso"](vp, "cajon"), cerrar=True)}</nav>'
    if vp in ('ext', 'iv'):
        mas = CR1['menu_mas'](vp).replace('class="§-p §-mo §-m">' + ic(I["selector"], 20, 2), 'class="§-p §-mo §-abre-ls §-m">' + ic(I["selector"], 20, 2))
    h = (f'<div class="§-capa" aria-hidden="true"><div class="§-velo"></div>{cajon}{mas}{CR["lista_cons"](vp)}{CR["alerta"]().replace("VP", vp)}</div>{CR["aviso_breve"]()}')
    return _cr(_re.sub(r'<!--.*?-->', '', h, flags=_re.S))

def piezas_reales(vp, n, dia):
    tel = vp in ('ext', 'tel')
    caps = AB['capas'](vp)
    t = AB['plantillas_burbuja']() + AB['reasignar_tpl']()
    if not tel:
        alta = AB['vista3'](vp)[1]
        t += alta[len(caps):] if alta.startswith(caps) else ''
    else:
        t += AB['alertas']()
    t = _cablea(_tpl_sin_reparto(t))
    t += ''.join(_ligar_tpl(c) for c in CITAS if c['id'] in AB['LIGAR'])
    lig = _re.sub(r'<!--.*?-->\n?', '', AL['capa_ligar'](vp), flags=_re.S).replace('19:00 – 19:30', '14:00 – 14:30')
    uid = f'b{n}{vp}'
    form = [(m, AF['form_cita'](m, uid)) for m in ('crear', 'lleno', 'editar', 'conf', 'reserva', 'google')]
    form += [('evento', AF['form_evento']('evento', uid)), ('evedit', AF['form_evento']('evedit', uid))]
    sub = lambda m: 'En este periodo no se agenda ni se mueve nada, y el enlace de reserva no ofrece turnos.'
    af = ('<div class="af-velo" data-cierra="1"></div>' + AF['capa']('form', 'af-w520', form, aria='Cita')
          + AF['capa']('bq', 'af-w440', [(m, AF['form_bloqueo'](m, uid)) for m in ('bq', 'bqedit')], icono='candado', sub_fn=sub, aria='Bloquear horario')
          + AF['capa_reg'](uid) + AF['capa_conv'](uid) + AF['alertas_form']())
    ah = (_menu_ah(vp, dia) + AH['medicos_lb'](vp) + (AH['huecos_capa'](vp) if vp in ('ih', 'iv') else '') + AH['capa_leyenda'](vp) + AH['capa_atajos'](vp)
          + AH['buscador'](vp, n) + AH['campana'](vp))
    hid = '<button type="button" hidden data-ir="tira-hueco"></button><button type="button" hidden data-ir="cerrar"></button>'
    return caps + t + lig + af + ah + capa_fecha(vp) + _cromo(vp) + hid + AL['toast']()

def _barra_int(h):
    R = [('class="ag0-p ag0-ic" aria-label="Buscar citas de un paciente">', 'class="ag0-p ag0-ic" data-abre="buscar" aria-haspopup="dialog" aria-label="Buscar citas de un paciente">'),
         ('aria-label="Por confirmar (2) y avisos (1): 3 pendientes" aria-haspopup="dialog">', 'aria-label="Por confirmar (2) y avisos (1): 3 pendientes" aria-haspopup="dialog" data-abre="campana" data-campana="1">'),
         ('class="ag0-p ag0-ic" aria-label="Bloquear horario">', 'class="ag0-p ag0-ic" data-bloquear="1" aria-label="Bloquear horario">'),
         ('<button type="button" class="ag0-p ag0-med" ', '<button type="button" class="ag0-p ag0-med" data-abre="medico" '),
         ('aria-label="Curso de actualización, todo el día, evento"', 'aria-label="Curso de actualización, todo el día, evento" data-cita="td1"'),
         ('<button type="button" class="ag0-p ag0-menu" aria-label="Menú, 3 datos pendientes">', '<button type="button" class="ag0-p ag0-menu" data-cromo="cajon" aria-label="Menú, 3 datos pendientes">'),
         ('<button type="button" class="ag0-p ag0-envb" aria-label="Mostrar barra lateral, 3 datos pendientes">', '<button type="button" class="ag0-p ag0-envb" data-cromo="cajon" aria-label="Mostrar barra lateral, 3 datos pendientes">'),
         ('<a href="#" class="ag0-p ag0-rb" aria-label="Más, 3 datos pendientes">', '<a href="#" class="ag0-p ag0-rb" data-cromo="mas" aria-label="Más, 3 datos pendientes">'),
         ('<a href="#" class="ag0-p ag0-pv">Más</a>', '<a href="#" class="ag0-p ag0-pv" data-cromo="mas">Más</a>'),
         ('<button type="button" class="ag0-p ag0-cons-b">', '<button type="button" class="ag0-p ag0-cons-b" data-cromo="lista" aria-haspopup="menu">'),
         ]
    for a, b in R: h = h.replace(a, b)
    return h

ICSS = (open(f'{SIB}/ag-burbuja/tmp-ab.css').read() + '\n' + open(f'{SIB}/ag-ligado/tmp-al.css').read() + '\n' + AF['CSS_AF'] + '\n'
        + '\n'.join(v for k, v in AF.items() if k.startswith('CSS_') and k not in ('CSS_AF', 'CSS_BASE') and isinstance(v, str)) + '\n'
        + open(f'{SIB}/ag-herr/tmp-ah.css').read() + '\n' + _cr(CR['CSS_NAV'] + CR1_CSS + CR['CSS']) + '\n' + open(f'{L}/tmp-integra.css').read())
ICSS = _re.sub(r'/\*(?:(?!\*/).)*?(?:agente|[Rr]eservad|[Hh]ueco documentado)(?:(?!\*/).)*?\*/', '', ICSS, flags=_re.S)
IJS = open(f'{SIB}/ag-ligado/tmp-al.js').read() + '\n' + open(f'{L}/tmp-integra.js').read()
ABJS = _re.sub(r'/\*(?:(?!\*/).)*?agente(?:(?!\*/).)*?\*/', '', AB['JS'], flags=_re.S)
EST_I = dict(AB['EST_COMUN']); EST_I.update(AB['EST_3'])
EST_I.update({'agendar': dict(t=[]), 'nav': dict(t=[]), 'tira-hueco': dict(t=['alta'], hueco=[3, 19, 19.5]),
              'alta-1900': dict(t=['alta'], hueco=[3, 19, 19.5]), 'alta-1930': dict(t=['alta'], hueco=[3, 19.5, 20])})

def salida_int(v, archivo, nombre, desc, marcos_html, ficha, tira, **extra):
    cfg = dict(v=v, ficha=ficha, tira=tira); cfg.update(extra)
    cab = dict(v='I' + v, tira=[], estados=EST_I, dias=AB['DIA_CORTO'], horario=HORARIO, saltos={}, alta=True, hover=True)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS}\n{ICSS}</style>\n' + '\n'.join(marcos_html)
           + f'\n<script>\n(function(CFG){{\n{JS}\n{IJS}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>'
           + f'\n<script>\n(function(CFG){{\n{ABJS}\n}})({json.dumps(cab, ensure_ascii=False)});\n</script>\n')
    p = f'{L}/vista-{archivo}.html'
    open(p, 'w').write(out); print(p, len(out))

def marco_int(v, vp, cont, capas):
    h = marco(v, vp, cont, capas)
    h = h.replace(f'class="marco ag0 ag0-v{v}"', f'class="marco ag0 ag0-v{v} ab ab-vI{v} af al ah {CRP}"', 1)
    return _barra_int(h)

def vista4_int(vp):
    b, flota = barra(vp, 'dia')
    rj = rejilla(vp, [HOY], scroll=12)
    cuerpo = f'<div class="ag0-diap">{rj}{panel_dia()}</div>' if vp == 'esc' else rj
    return f'<main class="ag0-cont">{b}{avisos()}{cuerpo}{flota}</main>', piezas_reales(vp, 4, True)

def vista7_int(vp):
    b, flota = barra(vp, 'tres')
    return f'<main class="ag0-cont">{b}{rejilla(vp, [3, 4, 5], scroll=12)}{flota}</main>', piezas_reales(vp, 7, False)

FICHA_4I = FICHA_4.replace('<p>La burbuja es MUESTRA', '<p class="ag0-x-old">La burbuja es MUESTRA')
FICHA_4I = FICHA_4I[:FICHA_4I.index('<p class="ag0-x-old">')] + '''<h4>A dónde lleva cada control</h4>
<p>Todo control abre su pieza real, copiada de su carpeta. Las piezas son la burbuja, la burbuja de alta, las alertas y los avisos breves de «Cita»; el formulario de cita, evento y bloqueo y «Convertir en cita»; la ventana «Ligar paciente e iniciar consulta»; Opciones, Buscar, Campana, Médico, Leyenda, Atajos y Huecos (en Duo abierto) de «Herramientas»; y el cajón, «Más» y el selector de consultorio de la navegación. «Iniciar consulta», «Ver la consulta», «Configuración de la agenda», «Revisar conexión», «Completar ahora», «Gestionar consultorios →», las secciones de la navegación y «Mi perfil» salen de la agenda a otra pantalla (ver las páginas Nota, Expediente, Herramientas y configuración y Cuenta): aquí cierran lo abierto.</p>'''
FICHA_7I = FICHA_7 + '<p>Los controles llevan a las mismas piezas reales que la vista Día. «Huecos disponibles» no se ofrece en 3 días: hoy solo existe en Día.</p>'

salida_int('4', '4-dia', 'Agenda · Vista Día',
           'El día de hoy con las piezas nuevas: la cita en curso marcada por la hora actual, cancelada, evento, bloqueo, reserva por ligar y un evento de Google por asignar solapado; cada bloque y cada botón abre su pieza real (burbuja, formulario, ligado, herramientas)',
           [marco_int('4', vp, *vista4_int(vp)) for vp in VPS], FICHA_4I,
           [['burbuja en curso (07)', 'bu:j10'], ['confirmada (10)', 'bu:j11'], ['cancelada (08)', 'bu:j6'], ['evento', 'bu:j7'], ['Google por asignar', 'bu:j13'], ['reserva por ligar (26)', 'bu:j8'], ['atendida (09)', 'bu:j9'], ['no asistió (05)', 'bu:j2'], '|', ['opciones', 'menu'], ['hueco pulsado', 'hueco'], '|', ['panel sin médico elegido', 'clase:ag0-sinmed', False], ['panel sin horario', 'clase:ag0-sinhor', False], ['día 24 elegido en el mini-mes', 'clase:ag0-mmsel', False], '|', ['aviso de error', 'clase:ag0-ave', False], ['aviso de Google', 'clase:ag0-avg', False], ['aviso de vista compacta', 'clase:ag0-avc', False], ['Cerrar', 'cerrar']], huecoDia=3, huecoHora=19.2)
salida_int('7', '7-tres-dias', 'Agenda · 3 días',
           'La cuarta vista, ahora en todos los dispositivos: hoy y los dos días siguientes como rejilla horaria de tres columnas, con los mismos bloques, bloqueos, hora actual y las mismas piezas reales al tocar',
           [marco_int('7', vp, *vista7_int(vp)) for vp in VPS], FICHA_7I,
           [['burbuja en curso (07)', 'bu:j10'], ['hueco pulsado', 'hueco'], ['Cerrar', 'cerrar']], huecoDia=4, huecoHora=14.2)
