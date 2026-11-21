# Agenda · asistente de primera vez (fase 2). Uso: python3 tmp-ap-gen.py → vista-0…6.html
# Construye ENCIMA de las piezas base (agenda-base, copiadas aquí como tmp-ap-base*): navegación, barra, rejilla y capas
# con su clase ag0- intacta; lo nuevo lleva el prefijo .ap.
import os, json, html
L = os.path.dirname(os.path.abspath(__file__))

# --- piezas base: se ejecuta la parte de definiciones del generador de agenda-base (sin escribir nada) ---
_src = open(f'{L}/tmp-ap-base.py').read()
_src = _src[:_src.index('# ------------------------------------------------------------------ CSS / JS / salida')]
exec(_src)
CSS_BASE = open(f'{L}/tmp-ap-base-nav.css').read() + '\n' + open(f'{L}/tmp-ap-base-estilo.css').read()
CSS_AP = open(f'{L}/tmp-ap-estilo.css').read()
JS_AP = open(f'{L}/tmp-ap-guion.js').read()

J = dict(
    copiar='<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    ok='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    xc='<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    tri='<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    estrella='<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    edificio='<path d="M4 20.5V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14.5M15 10h3a2 2 0 0 1 2 2v8.5M2.5 20.5h19M8 8h3M8 12h3M8 16h3"/>',
    globo='<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    persona='<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/>',
    lista='<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    cal='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    info='<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    abajo='<path d="m6 9 6 6 6-6"/>',
    ant='<path d="m15 6-6 6 6 6"/>',
)
def jc(k, s=20, w=1.9): return ic(J[k], s, w)

ADMIN_ETAPAS = ['Clínica', 'Horario', 'Consulta', 'Avisos']
DIAS7 = [('lunes', 'Lunes', '08:00', '18:00', True), ('martes', 'Martes', '08:00', '18:00', True), ('miercoles', 'Miércoles', '08:00', '18:00', True),
         ('jueves', 'Jueves', '08:00', '18:00', True), ('viernes', 'Viernes', '08:00', '18:00', True), ('sabado', 'Sábado', '08:00', '13:00', True),
         ('domingo', 'Domingo', '08:00', '18:00', False)]
HOR_CLINICA = 'Lun a vie 8:00 – 18:00 · Sáb 8:00 – 13:00'
HUSO = 'Yucatán — Mérida, Valladolid (UTC-6)'
ZONAS = ['Baja California — Tijuana, Ensenada, Mexicali (UTC-8)', 'Sinaloa, BCS y Nayarit interior — Mazatlán, La Paz, Los Cabos, Tepic (UTC-7)',
         'Sonora — Hermosillo, Ciudad Obregón (UTC-7)', 'Centro — CDMX, Jalisco, Edomex, Puebla, Veracruz, Oaxaca y mayoría (UTC-6)',
         HUSO, 'Nuevo León, Coahuila y Tamaulipas interior — Monterrey, Saltillo (UTC-6)', 'Cancún (UTC-5)']
URL = 'https://spinus.app/reservar/K7Q2-M9XD'
URL1 = 'https://spinus.app/reservar/P4WN-8TRC'

def apsw(on, aria=None, lab=None, extra=''):
    a = f' aria-labelledby="{lab}"' if lab else f' aria-label="{aria}"'
    return f'<button type="button" role="switch" class="ag0-p ap-sw" aria-checked="{"true" if on else "false"}"{a}{extra}></button>'

def err(t, cls=''):
    return f'<p class="ap-err {cls}" role="alert">{jc("xc", 16, 2)}<span>{t}</span></p>'

# ---------------------------------------------------------------- piezas del asistente ----------------------------------------------------------------
def editor_dias(uid, instruccion=False, ninguno=False):
    """EditorDias.tsx: una fila por día (interruptor, Entras/Sales o «Sin consulta»)."""
    filas = ''
    for k, n, a, b, on in DIAS7:
        on = on and not ninguno
        filas += (f'<div class="ap-dia" role="group" aria-label="{n}" data-on="{1 if on else 0}" data-dia="{k}">'
                  f'<div class="ap-dia-l1">{apsw(on, n, extra=" data-ap=\"dia\"")}<span class="ap-dia-n">{n}</span><span class="ap-sin">Sin consulta</span></div>'
                  f'<div class="ap-dia-h"><span class="ap-hl">Entras<button type="button" class="ag0-p ap-hora" aria-label="Entras el {n.lower()}: {a}">{a}</button></span>'
                  f'<span class="ap-hl">Sales<button type="button" class="ag0-p ap-hora ap-hfin" aria-label="Sales el {n.lower()}: {b}">{b}</button></span></div>'
                  f'{err("Sales antes de entrar: cambia una de las dos horas.", "ap-dia-err")}</div>')
    ins = '<p class="ap-ins">Prende los días que vienes y pon a qué hora entras y sales.</p>' if instruccion else ''
    return f'<div class="ap-dias" data-uid="{uid}">{ins}{filas}{err("Prende al menos un día.", "ap-ninguno")}</div>'

def grupo(tit, icono, cuerpo, pie='', cls='', aria=None):
    t = f'<h2 class="ap-gt">{jc(icono, 16, 2.1)}<span>{tit}</span></h2>' if tit else ''
    p = f'<p class="ap-pieg">{pie}</p>' if pie else ''
    return f'<section class="ap-g {cls}" aria-label="{aria or tit}">{t}<div class="ap-tar">{cuerpo}</div>{p}</section>'

def titulo(t, sub, n):
    return f'<div class="ap-tit"><h1 tabindex="-1" id="ap-h-{n}">{t}</h1><p>{sub}</p></div>'

def paso0():
    cuerpo = editor_dias('cl')
    huso = ('<label class="ap-campo"><span class="ap-sr">Huso horario de la clínica</span><span class="ap-selw"><select class="ap-sel">'
            + ''.join(f'<option{" selected" if z == HUSO else ""}>{z}</option>' for z in ZONAS) + f'</select>{jc("abajo", 18, 2.2)}</span></label>')
    return (titulo('Horario de la clínica', 'Este horario se usará de fábrica en todos los consultorios que se creen. También puedes cambiar el horario y la ubicación de cada consultorio.', 0)
            + grupo('', '', cuerpo, cls='ap-g-dias', aria='Días y horas de la clínica')
            + grupo('Huso horario de la clínica', 'globo', huso))

def consultorio(nombre, uid):
    def rad(modo, t, sub, on):
        return (f'<button type="button" class="ag0-p ap-rad" role="radio" aria-checked="{"true" if on else "false"}" data-modo="{modo}">'
                f'<span class="ap-radc" aria-hidden="true"></span><span class="ap-radt"><b>{t}</b><span>{sub}</span></span></button>')
    cuerpo = (f'<div role="radiogroup" aria-label="Horario de {nombre}" class="ap-rads">{rad("clinica", "Igual que la clínica", HOR_CLINICA, True)}'
              f'{rad("propio", "Otro horario", "Tú eliges qué días vienes y a qué hora", False)}</div>'
              f'<div class="ap-propio">{editor_dias(uid, instruccion=True)}</div>')
    return grupo(nombre, 'edificio', cuerpo, cls='ap-g-cons', aria=nombre).replace('class="ap-g ap-g-cons"', f'class="ap-g ap-g-cons" data-cons="{uid}"')

def paso1():
    return (titulo('¿Cuándo das consulta?', 'Tus pacientes solo podrán pedir cita en estos días y horas.', 1)
            + consultorio('Centro', 'centro') + consultorio('Hosp Norte', 'norte')
            + f'<div class="ap-inv"><p class="ap-ayu">El horario de la clínica es {HOR_CLINICA}.</p>'
            f'<p class="ap-solo" data-solo-admin>{jc("info", 18, 2)}<span>Solo el médico administrador puede cambiar estas opciones.</span></p></div>')

def paso2():
    ops = ''.join(f'<button type="button" class="ag0-p ap-op" aria-pressed="{"true" if d == 30 else "false"}" data-min="{d}">{d} min</button>' for d in (15, 20, 30, 45, 60))
    ops += '<button type="button" class="ag0-p ap-op" aria-pressed="false" data-min="otra">Otra</button>'
    otra = ('<label class="ap-otra">Mi consulta dura <input class="ap-num" type="number" inputmode="numeric" min="5" max="240" step="5" value="25" aria-label="Minutos"> minutos</label>')
    cabe = (f'<p class="ap-cabe">{jc("cal", 20, 1.9)}<span>En un día de 8:00 a 18:00 te caben <b class="ap-cuantas">20 consultas</b> de <span class="ap-mins">30</span> minutos.</span></p>')
    return (titulo('¿Cuánto dura tu consulta?', 'Con esto sabemos cuántas citas caben en tu día.', 2)
            + grupo('', '', f'<div class="ap-dur" role="group" aria-label="Duración de la consulta">{ops}</div>{otra}{cabe}', cls='ap-g-dur', aria='Duración de la consulta',
                    pie='Si en algún consultorio dura distinto, lo cambias después en Configuración.'))

def paso3():
    nd = ' <span class="ap-nd">No disponible en este servidor.</span>'
    rec = (f'<div class="ap-f ap-f-rec"><div class="ap-ft"><div class="ap-ftt"><b id="ap-r-t">Recordarle su cita al paciente</b>'
           f'<span class="ap-et ap-et-ok">{jc("estrella", 14, 2.1)}Recomendado</span></div>'
           f'<p>Le llega un correo antes de su cita para que no se le olvide. Solo a pacientes que tengan correo.{nd}</p></div>{apsw(True, lab="ap-r-t", extra=" data-ap=\"rec\"")}</div>'
           '<div class="ap-f ap-f-mandar"><label class="ap-mandar">Mandarlo <span class="ap-selw ap-selc"><select class="ap-sel">'
           '<option>2 horas</option><option>12 horas</option><option selected>1 día (24 horas)</option><option>2 días (48 horas)</option></select>'
           f'{jc("abajo", 18, 2.2)}</span> antes de la cita</label></div>')
    cli = (f'<div class="ap-f"><div class="ap-ft"><div class="ap-ftt"><b id="ap-c-t"><span class="ap-adm">Avisarme cuando alguien aparte cita</span><span class="ap-noadm">Avisar a la clínica cuando alguien aparte cita</span></b></div>'
           f'<p><span class="ap-adm">Te llega un correo cada vez que un paciente aparta o cambia su cita con tu enlace.</span>'
           f'<span class="ap-noadm">A quien administra la clínica le llega un correo cada vez que un paciente aparta o cambia su cita con un enlace.</span>{nd}</p></div>'
           f'{apsw(True, lab="ap-c-t", extra=" data-ap=\"cli\"")}</div>')
    pla = ('<div class="ap-f ap-f-pla"><div class="ap-ft"><div class="ap-ftt"><b>Hasta cuándo pueden apartar</b></div>'
           '<p>Pueden apartar cita para los próximos <b class="ap-fuerte"><span class="ap-v-hz">60</span> días</b>. La cita más pronto que pueden tomar es dentro de <b class="ap-fuerte"><span class="ap-v-an">2</span> horas</b>.</p></div>'
           '<button type="button" class="ag0-p ap-ton ap-cambiar" aria-expanded="false" data-ap="plazos">Cambiar</button></div>'
           '<div class="ap-plazos">'
           '<label class="ap-pl">Pueden ver horarios de los próximos <input class="ap-num ap-in-hz" type="number" inputmode="numeric" min="1" max="365" value="60"> días</label>'
           '<label class="ap-pl">No pueden apartar si faltan menos de <input class="ap-num" type="number" inputmode="numeric" min="0" max="72" value="2"> horas</label>'
           + err('Hasta cuándo se puede reservar: de 1 a 365 días adelante', 'ap-pl-err') +
           '<p class="ap-ayu">Esto cambia para todos los médicos de la clínica.</p></div>')
    solo = f'<p class="ap-solo ap-noadm-b" data-solo-admin>{jc("info", 18, 2)}<span>Solo el médico administrador puede cambiar estas opciones.</span></p>'
    return (titulo('¿Mandamos avisos por correo?', 'Ya dejamos lo más útil listo. Puedes cambiarlo cuando quieras.', 3)
            + solo + grupo('', '', rec + cli + pla, cls='ap-g-av', aria='Avisos por correo'))

def cierre():
    av = f'<p class="ap-nota" role="note">{jc("tri", 16, 2.1)}<span>No abrirá: la clínica no puede recibir reservas ahora (aviso de privacidad sin aprobar o clínica sin acceso).</span></p>'
    enlace = (av +
              '<div class="ap-dir ap-e-carga">Preparando tu enlace…</div>'
              + err('Esta opción todavía no está disponible en este servidor', 'ap-e-err ap-e-err1')
              + err('Tu enlace está apagado. Préndelo en «Tu enlace» y volverá a servir la misma dirección.', 'ap-e-err ap-e-err2')
              + f'<div class="ap-e-listo"><div class="ap-dir" data-enlace-fijo>{URL}</div><div class="ap-acc">'
              f'<button type="button" class="ag0-p ap-ton" data-ap="copiar">{jc("copiar", 18, 2)}<span>Copiar enlace</span></button>'
              f'<a href="#" class="ag0-p ap-txt">{ic(I["whatsapp"], 18, 2)}<span>Mandar por WhatsApp</span></a></div></div>'
              '<p class="ap-ayu">Es el mismo para todos. Ponlo en tu WhatsApp, tu Instagram o tu tarjeta.</p>')
    una = ('<p class="ap-ayu ap-una-ayu">Crea un enlace de una vez: sirve para una sola cita y deja de funcionar en 7 días.</p>'
           '<div class="ap-una-f"><label class="ap-campo"><span>¿Para quién es? (solo lo ves tú)</span><input class="ap-in" type="text" maxlength="60" placeholder="Ej.: Sra. López, revisión"></label>'
           '<label class="ap-campo"><span>Correo del paciente (opcional)</span><input class="ap-in" type="email" autocomplete="off" maxlength="254"></label>'
           '<p class="ap-ayu">El comprobante y los avisos de la cita irán sólo a este correo; sin él, no se manda ninguno.</p>'
           f'<div class="ap-acc"><button type="button" class="ag0-p ap-ton" data-ap="crear">{ic(I["enlace"], 18, 2)}<span>Crear enlace de una vez</span></button></div></div>'
           f'<div class="ap-una-ok"><div class="ap-dir" data-enlace-una-vez>{URL1}</div><div class="ap-acc"><button type="button" class="ag0-p ap-txt" aria-label="Copiar el enlace de una vez" data-ap="copiar1">{jc("copiar", 18, 2)}<span>Copiar</span></button></div></div>')
    def fila(t, cuerpo, n, cls=''):
        return (f'<div class="ap-f ap-rs {cls}"><div class="ap-ft"><span class="ap-rst">{t}</span>{cuerpo}</div>'
                f'<button type="button" class="ag0-p ap-txt" aria-label="Cambiar: {t}" data-ir="{n}">Cambiar</button></div>')
    res = (fila('Horario de la clínica', f'<span class="ap-rsv">{HOR_CLINICA}</span><span class="ap-rss">Huso horario: {HUSO}</span>', 0, 'ap-adm-f')
           + fila('Cuándo das consulta', f'<span class="ap-rsv"><b>Centro:</b> {HOR_CLINICA}</span><span class="ap-rsv"><b>Hosp Norte:</b> <span class="ap-rs-norte">{HOR_CLINICA}</span></span>', 1)
           + fila('Cuánto dura tu consulta', '<span class="ap-rsv"><span class="ap-rs-min">30</span> minutos</span>', 2)
           + fila('Avisos por correo', '<span class="ap-rsv ap-rs-av">Recordatorio al paciente 1 día antes · te avisamos de cada cita nueva</span>', 3))
    hero = (f'<div class="ap-hero"><span class="ap-hero-i" aria-hidden="true">{ic(J["ok"], 28, 2.6)}</span>'
            '<h1 tabindex="-1" id="ap-h-4">Tu agenda ya está lista</h1><p>Comparte tu enlace. Quien lo abra puede apartar cita en tus horas libres, sin llamarte.</p></div>')
    return (hero + grupo('Tu enlace para pacientes', 'enlace' if 'enlace' in J else 'lista', enlace, cls='ap-g-enl')
            + grupo('¿Es para un solo paciente?', 'persona', una, cls='ap-g-una')
            + grupo('', '', res, cls='ap-g-res', aria='Lo que elegiste'))
J['enlace'] = I['enlace']

def avance():
    seg = ''.join(f'<li data-i="{i}"><span class="ap-bar" aria-hidden="true"><i></i></span><span class="ap-et-n">{e}</span></li>' for i, e in enumerate(ADMIN_ETAPAS))
    return (f'<div class="ap-av" aria-label="Avance"><p class="ap-av-t"><span class="ap-av-n">Paso 1 de 4</span> · menos de 2 minutos</p>'
            f'<ol class="ap-av-l">{seg}</ol></div>')

def funnel(paso):
    pasos = [paso0(), paso1(), paso2(), paso3(), cierre()]
    sec = ''.join(f'<section class="ap-paso" data-paso="{i}" aria-labelledby="ap-h-{i}"{"" if i == paso else " hidden"}>{p}</section>' for i, p in enumerate(pasos))
    top = (f'<div class="ap-top"><div class="ap-col"><div class="ap-cab"><a href="#" class="ag0-p ap-volver" data-ap="agenda">{ic(I["ant"], 18, 2.4)}<span>Agenda</span></a>'
           f'<button type="button" class="ag0-p ap-txt ap-despues" data-ap="despues">Terminar después</button></div>{avance()}</div></div>')
    pie = (f'<div class="ap-pie"><div class="ap-col"><div class="ap-guarda">{err("No se pudo guardar el horario de la clínica", "ap-gerr")}</div><div class="ap-pie-in">'
           '<button type="button" class="ag0-p ap-sec" data-ap="atras">Atrás</button><span class="ap-flex"></span>'
           '<button type="button" class="ag0-p ap-prim" data-ap="sig"><span>Continuar</span></button>'
           '<a href="#" class="ag0-p ap-prim ap-ir" data-ap="agenda">Ir a mi agenda</a></div></div></div>')
    toast = (f'<div class="ap-avisos" aria-live="polite"><div class="ap-toast" role="alert" hidden><span class="ap-toast-i" aria-hidden="true">{ic(I["x"], 16, 2.4)}</span>'
             f'<span class="ap-toast-t">No se pudo guardar el aviso</span><button type="button" class="ag0-p ap-toast-x" aria-label="Cerrar aviso">{ic(I["x"], 16, 2.2)}</button></div></div>')
    return (f'<main class="ap-main" data-paso="{paso}" lang="es">{top}<div class="ap-desp"><div class="ap-col"><div class="ap-pasos">{sec}</div>'
            '</div></div>' + pie + toast + '</main>')

def agenda(vp, vacia=False):
    if not vacia:
        b, flota = barra(vp, 'dia')
        return f'<main class="ag0-cont ap-agenda">{b}{rejilla(vp, [HOY], scroll=12, con_bloques=False, todo=False)}{flota}</main>'
    # CALMA §29.12: la agenda vacía (Semana) ofrece «Configuración de la agenda» como acción secundaria junto a «Agendar».
    b, flota = barra(vp, 'semana')
    dias = [HOY] if vp in ('ext', 'tel') else list(range(7))
    banda = (f'<div class="ap-vac" role="status">{ic(I["agenda"], 16, 2)}<p>Sin citas esta semana</p>'
             f'<span class="ap-vac-acc"><button type="button" class="ag0-p ap-vac-b" data-accion="agendar">Agendar</button>'
             f'<button type="button" class="ag0-p ap-vac-b ap-vac-cfg" data-ap="config">{ic(I["engrane"], 16, 1.9)}<span>Configuración de la agenda</span></button></span></div>')
    return f'<main class="ag0-cont ap-agenda">{b}{banda}{rejilla(vp, dias, scroll=12, con_bloques=False, todo=False)}{flota}</main>'

def marco_ap(n, vp, paso, con_agenda=False, ini='funnel'):
    if con_agenda:
        cont = (f'<div class="ap-pant" data-ver="{ini}"><div class="ap-scr ap-scr-ag"{" hidden" if ini != "agenda" else ""}>{agenda(vp, n == "0")}</div>'
                f'<div class="ap-scr ap-scr-fn"{" hidden" if ini != "funnel" else ""}>{funnel(paso)}</div></div>')
        capas = menu_opciones(vp)
    else:
        cont = f'<div class="ap-pant" data-ver="funnel"><div class="ap-scr ap-scr-fn">{funnel(paso)}</div></div>'
        capas = ''
    out = marco(n, vp, cont, capas).replace(f'class="marco ag0 ag0-v{n}"', f'class="marco ag0 ap ap-v{n}"', 1)
    for k in ('ap-h-', 'ap-r-t', 'ap-c-t'):
        out = out.replace(k, f'ap{n}{vp}-' + k[3:])
    return out

FICHA_COMUN = open(f'{L}/tmp-ap-fichas.html').read().split('<!--==-->')
FICHAS = {k: v for k, v in (x.split('<!--:-->', 1) for x in FICHA_COMUN if '<!--:-->' in x)}

VISTAS = [
    ('0', '0-entrada', 'Entrar al asistente', 'Se llega desde el engrane «Configuración de la agenda» (en táctiles, dentro de «Opciones de la agenda») y, decisión del dueño, desde la agenda vacía junto a «Agendar»: la configuración se abre sola en el asistente si falta algo; aquí la entrada empuja la pantalla desde la derecha con resorte y vuelve por el mismo camino', 0, True, 'agenda',
     [['abrir «Opciones de la agenda»', 'menu'], ['tocar «Configuración de la agenda»', 'entrar'], ['volver a la agenda', 'salir'], '|', ['reentrada tras «Terminar después» (paso 2)', 'reentra'], ['tras «Empezar de nuevo»', 'denuevo'], '|', ['Cerrar capa', 'cerrar']]),
    ('1', '1-paso1', 'Paso 1 · Horario de la clínica', 'Las siete filas de días pasan de cajas grises con bordes a una lista limpia con interruptores; el avance queda fijo arriba con «Terminar después», y «Continuar» vive en una barra fija al pie que ya no hay que buscar desplazando (solo para quien administra)', 0, True, 'funnel',
     [['Martes sale antes de entrar', 'e:reves', False], ['ningún día prendido', 'e:ninguno', False], ['Guardando…', 'e:guardando', False], ['no se pudo guardar', 'e:gerr', False], '|', ['desplazar hasta el pie', 'abajo']]),
    ('2', '2-paso2', 'Paso 2 · ¿Cuándo das consulta?', 'Cada consultorio es un grupo con su rótulo de color y dos opciones de radio en filas; «Otro horario» despliega el mismo editor de días dentro del grupo. Para quien no administra es el «Paso 1 de 3» con el aviso en caja tonal', 1, True, 'funnel',
     [['Hosp Norte con «Otro horario»', 'e:propio', False], ['«Otro horario» sin días', 'e:propio0', False], ['médico que no administra', 'e:noadm', False], ['Guardando…', 'e:guardando', False], ['no se pudo guardar', 'e:gerr', False]]),
    ('3', '3-paso3', 'Paso 3 · ¿Cuánto dura tu consulta?', 'Seis opciones parejas en rejilla (la elegida en tonal con anillo, sin bordes grises), la cuenta de consultas que caben como fila con icono y la nota al pie del grupo', 2, True, 'funnel',
     [['«Otra» (25 min)', 'e:otra', False], ['«Otra» vacía', 'e:otra0', False], ['Guardando…', 'e:guardando', False], ['no se pudo guardar', 'e:gerr', False], ['médico que no administra', 'e:noadm', False]]),
    ('4', '4-paso4', 'Paso 4 · ¿Mandamos avisos por correo?', 'Las tres tarjetas sueltas pasan a un grupo de filas con interruptor (estilo Ajustes); «Recomendado» es una etiqueta verde con icono y «Cambiar» abre los plazos dentro de su fila', 3, True, 'funnel',
     [['plazos abiertos', 'e:plazos', False], ['plazo inválido', 'e:plinv', False], ['recordatorio apagado', 'e:recoff', False], ['no disponible en el servidor', 'e:nd', False], ['médico que no administra', 'e:noadm', False], ['no se pudo guardar un aviso', 'toast']]),
    ('5', '5-cierre', 'Cierre · Tu agenda ya está lista', 'Hoy solo se capturó en iPhone: aquí en los cinco marcos. El enlace es el grupo protagonista con «Copiar enlace» tonal; el enlace de una vez y el resumen con «Cambiar» por fila quedan debajo, e «Ir a mi agenda» es el único botón principal, en la barra del pie', 4, True, 'funnel',
     [['Preparando tu enlace…', 'e:carga', False], ['enlace que no abrirá', 'e:nota', False], ['no disponible en el servidor', 'e:err1', False], ['enlace apagado', 'e:err2', False], ['Copiado', 'e:copiado', False], '|', ['Creando…', 'e:creando', False], ['enlace de una vez creado', 'e:unaok', False], ['médico que no administra', 'e:noadm', False]]),
    ('6', '6-salida', 'Salir a medias', 'Dos salidas, como hoy: «‹ Agenda» se va sin guardar el paso en que estás; «Terminar después» guarda ese paso (si es válido), recuerda dónde ibas y vuelve a la agenda. La salida retrocede por el mismo camino por el que se entró', 1, True, 'funnel',
     [['tocar «‹ Agenda»', 'salir'], ['tocar «Terminar después»', 'despues'], ['volver a entrar', 'reentra'], '|', ['no se pudo guardar al terminar después', 'e:gerr', False]]),
]

def escribe(n, archivo, nombre, desc, paso, con_ag, ini, tira):
    marcos = [marco_ap(n, vp, paso, con_ag, ini) for vp in VPS]
    cfg = dict(v=n, titulos=TIT, paso=paso, ficha=FICHAS.get(archivo, '') + FICHAS.get('comun', ''), tira=tira, agenda=con_ag)
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{CSS_BASE}\n{CSS_AP}</style>\n' + '\n'.join(marcos)
           + f'\n<script>\n(function(CFG){{\n{JS_AP}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    p = f'{L}/vista-{archivo}.html'
    open(p, 'w').write(out)
    print(p, len(out))

for v in VISTAS:
    escribe(*v)
