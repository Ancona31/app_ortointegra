# Piezas comunes de la carpeta «cromo»: iconos, navegación aprobada (copiada del dashboard final) y fondo simplificado.
# Cada vista tiene su prefijo (cr1, cr2…); el CSS común se escribe con «§» y se sustituye por el prefijo.
import os, json
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
    ayuda='<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/>',
    selector='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    x='<path d="M6 6l12 12M18 6 6 18"/>',
    sig='<path d="m9 6 6 6-6 6"/>',
    arriba='<path d="m18 15-6-6-6 6"/>',
    barra='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    luna='<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    escudo='<path d="M12 21c-4.5-2.2-7-5.6-7-10V5.5L12 3l7 2.5V11c0 4.4-2.5 7.8-7 10z"/>',
    externo='<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    salir='<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    ajustes='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    # Iconos de AvisoPerfilSidebar.tsx:5 (lucide PenLine, FileBadge, ImageIcon, ArrowRight)
    firma='<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/>',
    cedula='<path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="5" cy="14" r="3"/><path d="M7 16.5 8 22l-3-1-3 1 1-5.5"/>',
    imagen='<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    flecha='<path d="M5 12h14M12 5l7 7-7 7"/>',
)

# Resortes de la maqueta (CALMA §25): amortiguación 1.0. Entrada respuesta .35 s (520 ms hasta asentarse); salida .25 s (360 ms).
RES_IN = 'linear(0,0.0803,0.2398,0.4083,0.5568,0.6769,0.769,0.8374,0.8869,0.9221,0.9468,0.9639,0.9756,0.9836,0.9891,0.9927,0.9952,0.9968,0.9979,0.9986,1)'
RES_OUT = 'linear(0,0.123,0.3397,0.54,0.6943,0.8032,0.8762,0.9234,0.9533,0.9718,0.9831,0.99,0.9941,0.9965,0.998,1)'

def marca(s=24):
    return f'<span class="§-logo">{ic(I["logo"], s, 1.8)}<span class="§-logo-n">Spinus</span></span>'

def plan():
    return '<span class="§-plan">Plan VIP</span>'

# ---------------- Navegación aprobada (dashboard-final/tmp-gen.py: riel, lateral, encabezado, enc_iv) ----------------
def riel(act='inicio', badge=False):
    def b(k, t, cl='', extra=''):
        a = ' aria-current="page"' if k == act else ''
        return f'<a href="#" class="§-p §-rb{cl}" aria-label="{t}"{a}{extra}>{ic(I[k], 22)}</a>'
    bd = '<span class="§-bdg" aria-hidden="true">3</span>' if badge else ''
    mas = (f'<button type="button" class="§-p §-rb" aria-label="Más" data-abre="mas" data-rot="Más">{ic(I["mas"], 22, 3)}{bd}</button>')
    return f'''<!-- Navegación (A0·3) de Duo cerrado: riel a la derecha, fundido con la franja. Copiado del dashboard aprobado. -->
<nav class="§-riel §-nav" aria-label="Navegación principal">
  {b("inicio","Inicio")}{b("pac","Expediente")}{b("agenda","Agenda")}{b("docs","Documentos",cl=" §-m")}{mas}
  <span class="§-flex"></span>
  <button type="button" class="§-p §-masb §-m" aria-label="Nueva consulta">{ic(I["plus"], 26, 2.4)}</button>
  <button type="button" class="§-p §-masb §-s" aria-label="Agendar cita">{ic(I["plus"], 26, 2.4)}</button>
</nav>'''

def lista(act='inicio'):
    def a(k, t, cl=''):
        c = ' aria-current="page"' if k == act else ''
        return f'<a href="#" class="§-p §-li{cl}"{c}>{ic(I[k], 20)}{t}</a>'
    return f'<div class="§-lista">{a("inicio","Inicio")}{a("pac","Expediente")}{a("agenda","Agenda")}{a("docs","Documentos",cl=" §-m")}{a("admin","Administración",cl=" §-m")}</div>'

def logo_clinica():
    # Logo de la clínica (CALMA §28). Hoy: logoUrl de la clínica o, sin él, /logo.png (Sidebar.tsx:621-628). Aquí, un logo ficticio
    # de «Clínica Semilla A» dibujado en SVG; sin logo propio se pinta el glifo de Spinus en el mismo círculo.
    return ('<span class="§-clogo" role="img" aria-label="Logo de Clínica Semilla A"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5-2.2-7-5.6-7-10V5.5L12 3l7 2.5V11c0 4.4-2.5 7.8-7 10z"/>'
            '<path d="M12 8v7M8.5 11.5h7"/></svg></span>')

def cons():
    return (f'<button type="button" class="§-p §-cons-b">{logo_clinica()}'
            f'<span class="§-cons-t"><span class="§-m">Consultorio</span><b class="§-m">Centro</b><span class="§-s">Clínica</span><b class="§-s">Clínica Semilla A</b></span>{ic(I["selector"], 16, 2)}</button>')

def pie():
    # Médico: su nombre, la especialidad donde cabe (CALMA §28; no en Duo abierto horizontal) y «Mi perfil · Ajustes»; a su derecha, Ayuda.
    # Secretaria: sin Mi perfil (Sidebar.tsx:203-216); su fila abre «Ajustes» (Modo oscuro, Aviso de Privacidad, Cerrar sesión).
    return (f'<div class="§-lat-pie"><a href="#" class="§-p §-li §-yo §-m">{ic(I["perfil"], 20)}<span><span>Dr. Admin Semilla</span>'
            f'<small class="§-esp">Ortopedia y Traumatología</small><small>Mi perfil · Ajustes</small></span></a>'
            f'<a href="#" class="§-p §-ib §-ay §-m" aria-label="Ayuda">{ic(I["ayuda"], 20)}</a>'
            f'<button type="button" class="§-p §-li §-yo §-s §-abre-aj" aria-haspopup="menu">{ic(I["ajustes"], 20)}<span><span>Secretaria Semilla</span><small>Ajustes</small></span></button></div>')

def ajustes_items():
    # «Ajustes» de la secretaria: lo mismo que hoy tiene en el pie de la barra (Sidebar.tsx:799-808, 871-874)
    return (f'<button type="button" class="§-p §-mo §-tema">{ic(I["luna"], 20)}<span>Modo oscuro</span></button>'
            f'<a href="#" class="§-p §-mo">{ic(I["escudo"], 20)}<span>Aviso de Privacidad</span>{ic(I["externo"], 16, 2, " class=" + chr(34) + "§-mo-f" + chr(34))}</a>'
            f'<button type="button" class="§-p §-mo §-salir">{ic(I["salir"], 20)}<span>Cerrar sesión</span></button>')

def lateral(act='inicio', medio='', cerrar=False):
    x = f'<button type="button" class="§-p §-ib §-cierra" aria-label="Cerrar menú">{ic(I["x"], 20, 2)}</button>' if cerrar else ''
    return f'''<div class="§-lat-cab">{marca(24)}<span class="§-flex"></span>{plan()}{x}</div>
  {cons()}
  {lista(act)}
  <span class="§-flex"></span>
  {medio}
  {pie()}'''

def encabezado(titulo='Inicio', badge=False):
    bd = '<span class="§-bdg" aria-hidden="true">3</span>' if badge else ''
    return f'''<!-- Navegación (A0·13) de iPhone: encabezado fundido con la barra de estado. Copiado del dashboard aprobado. -->
<header class="§-enc §-nav">
  <button type="button" class="§-p §-menu" aria-label="Menú" data-abre="cajon" data-rot="Menú">{ic(I["menu"], 22, 2)}{bd}</button>
  <span class="§-enc-t">{titulo}</span>
  <span class="§-flex"></span>
  <button type="button" class="§-p §-av §-av-g §-m" aria-label="Mi perfil">AS</button><button type="button" class="§-p §-av §-av-g §-s §-abre-aj" aria-label="Ajustes">SE</button>
</header>'''

def enc_iv(act='Inicio', badge=False):
    bd = '<span class="§-bdg" aria-hidden="true">3</span>' if badge else ''
    def p(t, cl='', extra=''):
        c = ' aria-current="page"' if t == act else ''
        tag = 'button type="button"' if extra else 'a href="#"'
        cierre = 'button' if extra else 'a'
        return f'<{tag} class="§-p §-pv{cl}"{c}{extra}>{t}</{cierre}>'
    return f'''<!-- Navegación de Duo abierto vertical (CALMA §19, §23.9): encabezado fundido, pista de cinco píldoras. Copiado del dashboard aprobado. -->
<header class="§-env §-nav">
  <button type="button" class="§-p §-envb" aria-label="Mostrar barra lateral" data-abre="cajon" data-rot="Mostrar barra lateral">{ic(I["barra"], 20)}{bd}</button>
  <nav class="§-pista" aria-label="Secciones">{p("Inicio")}{p("Expediente")}{p("Agenda")}{p("Documentos", cl=" §-m")}{p("Más", extra=' data-abre="mas"')}</nav>
  <button type="button" class="§-p §-av §-av-g §-m" aria-label="Mi perfil">AS</button><button type="button" class="§-p §-av §-av-g §-s §-abre-aj" aria-label="Ajustes">SE</button>
</header>'''

# ---------------- Fondo de pantalla simplificado (el dashboard, reducido a sus bloques) ----------------
def fila_fondo():
    return '<div class="§-fl"><span class="§-bx"></span><span class="§-fl-t"><span class="§-br" style="width:62%"></span><span class="§-br §-br2" style="width:40%"></span></span></div>'

def fondo(vp):
    tarj = lambda t, n: f'<section class="§-tj" aria-hidden="true"><h2 class="§-tt">{t}</h2>{"".join(fila_fondo() for _ in range(n))}</section>'
    return f'''<main class="§-cont">
  <!-- Fondo simplificado: el dashboard reducido a sus bloques, para que la pieza global se lea sobre una pantalla real. -->
  <div class="§-top"><p class="§-rot"><span class="§-m">Centro</span><span class="§-s">Clínica Semilla A</span></p>
  <h1 class="§-h1">Buenas tardes, <span class="§-m">Admin</span><span class="§-s">Secretaria</span></h1></div>
  <div class="§-cols">{tarj("Después", 5)}{tarj("Atendidos recientemente", 3)}{tarj("Documentos recientes", 2)}{tarj("Esta semana", 3)}</div>
</main>'''

CSS_NAV = '''
.§ .§-app{display:flex;width:100%;height:100%}
.§[data-vp="tel"] .§-app,.§[data-vp="iv"] .§-app{flex-direction:column}
.§ button{border:0;margin:0;padding:0;background:none;color:inherit}
.§ h1,.§ h2,.§ h3,.§ p,.§ ul{margin:0;padding:0}
.§ ul{list-style:none}
.§ svg{flex:none}
.§ .§-flex{flex:1}
/* Variantes por rol: m = médico, s = secretaria */
.§:not(.§-sec) .§-s{display:none!important}
.§.§-sec .§-m{display:none!important}
/* Respuesta al toque y foco */
.§ .§-p{transition:transform 100ms ease-out}
.§ .§-p:active{transform:scale(.97)}
.§ .§-p:focus-visible{outline:3px solid var(--enlace);outline-offset:2px}
.§ .§-nav .§-p:focus-visible,.§ .§-lat .§-p:focus-visible{outline-color:var(--nav-tinta)}
/* ---- Fondo simplificado ---- */
.§ .§-cont{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:16px;padding:16px 14px calc(var(--ib) + 16px) 16px}
.§ .§-cont>*{flex:none}
.§[data-vp="tel"] .§-cont{padding:18px 16px calc(var(--ib) + 16px)}
.§[data-vp="ih"] .§-cont{padding:20px 24px calc(var(--ib) + 16px)}
.§[data-vp="iv"] .§-cont{padding:22px 24px 20px}
.§[data-vp="esc"] .§-cont{padding:28px 24px 24px}
.§ .§-top{display:flex;flex-direction:column;gap:4px}
.§ .§-rot{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;color:var(--tinta2)}
.§ .§-h1{font-size:26px;line-height:32px;font-weight:800;letter-spacing:-.6px}
.§[data-vp="ih"] .§-h1,.§[data-vp="iv"] .§-h1,.§[data-vp="esc"] .§-h1{font-size:32px;line-height:38px}
.§ .§-cols{display:flex;flex-direction:column;gap:12px}
.§[data-vp="ih"] .§-cols,.§[data-vp="iv"] .§-cols,.§[data-vp="esc"] .§-cols{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;align-items:start}
.§[data-vp="ih"] .§-cols>:first-child,.§[data-vp="iv"] .§-cols>:first-child,.§[data-vp="esc"] .§-cols>:first-child{grid-row:1/3}
.§ .§-tj{background:var(--sup);border-radius:16px;padding:14px 16px 8px}
.§[data-vp="ih"] .§-tj,.§[data-vp="iv"] .§-tj,.§[data-vp="esc"] .§-tj{border-radius:18px;padding:16px 20px 8px}
.§ .§-tt{font-size:17px;line-height:22px;font-weight:700;margin-bottom:4px}
.§ .§-fl{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--linea)}
.§ .§-tt+.§-fl{border-top:0}
.§ .§-bx{width:44px;height:44px;flex:none;border-radius:12px;background:var(--fondo)}
.§ .§-fl-t{flex:1;display:flex;flex-direction:column;gap:8px}
.§ .§-br{display:block;height:10px;border-radius:5px;background:var(--sup2)}
.§ .§-br2{height:8px;opacity:.7}
/* ---- Riel (Duo cerrado) ---- */
.§ .§-riel{position:relative;z-index:1;flex:none;width:calc(56px + var(--ir));padding:16px calc(var(--ir) + 8px) calc(var(--ib) + 10px) 8px;background:var(--navy);border-radius:26px 0 0 26px;box-shadow:var(--sombra-nav-der);display:flex;flex-direction:column;align-items:center;gap:8px}
.§ .§-rb{position:relative;width:48px;height:48px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--nav-tinta)}
.§ .§-rb[aria-current="page"]{background:var(--accion);color:#fff}
.§ .§-masb{width:52px;height:52px;flex:none;border-radius:999px;background:#fff;color:var(--accion);display:flex;align-items:center;justify-content:center;box-shadow:var(--sombra-accion)}
/* ---- Encabezado fundido (iPhone) ---- */
.§ .§-enc{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:12px;padding:calc(var(--it) + 8px) 16px 12px;background:var(--navy);border-radius:0 0 26px 26px;box-shadow:var(--sombra-nav-sup);color:#fff}
.§ .§-menu{position:relative;width:44px;height:44px;flex:none;border-radius:12px;background:var(--nav-velo);color:#fff;display:flex;align-items:center;justify-content:center}
.§ .§-enc-t{font-size:17px;line-height:22px;font-weight:700;color:#fff}
.§ .§-av{display:flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:999px;background:var(--nav-avatar);color:var(--navy);font-size:13px;font-weight:700}
.§ .§-av.§-av-g{width:44px;height:44px}
/* ---- Encabezado de Duo abierto vertical ---- */
.§ .§-env{position:relative;z-index:1;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:var(--it) 16px 14px;background:var(--navy);border-radius:0 0 26px 26px;box-shadow:var(--sombra-nav-sup);color:#fff}
.§ .§-envb{position:relative;width:44px;height:44px;flex:none;border-radius:999px;background:var(--nav-velo);color:#fff;display:flex;align-items:center;justify-content:center}
.§ .§-pista{display:flex;align-items:center;gap:2px;padding:4px;border-radius:26px;background:var(--nav-velo)}
.§ .§-pv{display:flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;color:var(--nav-tinta);font-size:15px;line-height:20px;font-weight:500;white-space:nowrap;position:relative}
.§ .§-pv::after{content:"";position:absolute;inset:-2px 0}
.§ .§-pv[aria-current="page"]{padding:0 16px;background:var(--accion);color:#fff;font-weight:600}
/* ---- Barra lateral (Duo abierto horizontal a la derecha; computadora a la izquierda) y cajón ---- */
.§ .§-lat{position:relative;z-index:1;flex:none;display:flex;flex-direction:column;background:var(--navy);color:#fff}
.§[data-vp="ih"] .§-lat{width:calc(218px + var(--ir));padding:16px calc(var(--ir) + 10px) calc(var(--ib) + 10px) 12px;border-radius:26px 0 0 26px;box-shadow:var(--sombra-nav-der)}
.§[data-vp="esc"] .§-lat{width:248px;padding:16px 12px 14px;border-radius:0 26px 26px 0;box-shadow:var(--sombra-nav-izq)}
.§ .§-lat-cab{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 4px 0 8px}
.§ .§-logo{display:inline-flex;align-items:center;gap:8px;color:#fff}
.§ .§-logo-n{font-size:17px;line-height:22px;font-weight:700;letter-spacing:-.2px}
.§ .§-plan{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:var(--nav-velo);color:var(--nav-tinta);font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.§ .§-cons-b{margin-top:12px;display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 10px;border-radius:14px;background:var(--nav-velo);color:#fff;text-align:left}
.§ .§-cons-b>svg{color:var(--nav-tinta2)}
.§ .§-clogo{width:36px;height:36px;flex:none;border-radius:999px;background:#fff;color:var(--accion);display:flex;align-items:center;justify-content:center}
.§ .§-cons-t{flex:1;min-width:0;display:flex;flex-direction:column}
.§ .§-cons-t span{font-size:13px;line-height:16px;color:var(--nav-tinta2)}
.§ .§-cons-t b{font-size:15px;line-height:19px;font-weight:600}
.§ .§-lista{margin-top:14px;display:flex;flex-direction:column;gap:2px}
.§ .§-li{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;border-radius:12px;color:var(--nav-tinta);font-size:15px;line-height:20px;font-weight:500}
.§[data-vp="esc"] .§-li{height:40px;font-size:14px}
.§ .§-li[aria-current="page"]{background:var(--accion);color:#fff;font-weight:600}
.§ .§-lat-pie{border-top:1px solid var(--nav-velo);padding-top:8px;display:flex;align-items:center;gap:4px}
.§ .§-lat-pie .§-yo{flex:1;min-width:0;text-align:left}
.§ .§-lat-pie .§-ib{color:var(--nav-tinta2)}
.§[data-vp="ih"] .§-esp{display:none}
/* Duo abierto horizontal: la barra mide 218; el pie suelta el icono para que nombre y «Ayuda» quepan en una línea */
.§[data-vp="ih"] .§-lat .§-lat-pie .§-yo{padding:0 8px}
.§[data-vp="ih"] .§-lat .§-lat-pie .§-yo>svg{display:none}
.§[data-vp="ih"] .§-lat .§-lat-pie .§-ib{width:36px;height:36px}
.§ .§-esp{color:var(--nav-tinta)!important}
.§ .§-yo{min-height:48px;height:auto;padding-top:6px;padding-bottom:6px}
.§ .§-yo>span{display:flex;flex-direction:column;line-height:17px}
.§ .§-yo small{font-size:12px;line-height:16px;color:var(--nav-tinta2)}
.§ .§-ib{position:relative;width:44px;height:44px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--nav-tinta)}
/* ---- Capas (CALMA §25/§26): un velo por marco; cajón desde la izquierda en iPhone y Duo vertical; tarjeta centrada en lo demás ---- */
.§ .§-capa{position:absolute;inset:0;z-index:20;visibility:hidden;transition:visibility 0s linear 360ms}
.§ .§-capa.§-on{visibility:visible;transition:none}
.§ .§-velo{position:absolute;inset:0;background:var(--velo);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);opacity:0;transition:opacity 240ms ease-out}
.§ .§-on .§-velo{opacity:1;transition:opacity 320ms ease-out}
.§ .§-cajon{position:absolute;left:0;top:0;bottom:0;width:300px;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none;padding:calc(var(--it) + 12px) 14px calc(var(--ib) + 12px) 14px;background:var(--navy);color:#fff;border-radius:0 26px 26px 0;box-shadow:var(--sombra-nav-izq);transform:translateX(-106%);transition:transform 360ms RES_OUT}
.§[data-vp="iv"] .§-cajon{width:320px}
.§ .§-capa[data-k~="cajon"].§-on .§-cajon{transform:none;transition:transform 520ms RES_IN}
.§ .§-cajon .§-lat-cab{padding-right:0}
.§ .§-mnw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-mnw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="iv"] .§-mnw{padding:calc(var(--it) + 16px) 24px 24px}
.§[data-vp="ih"] .§-mnw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="esc"] .§-mnw{padding:32px 24px 32px calc(248px + 24px)}
.§ .§-mn{pointer-events:auto;width:310px;max-width:100%;max-height:100%;overflow-y:auto;scrollbar-width:none;background:var(--sup);color:var(--tinta);border-radius:20px;box-shadow:var(--sombra-capa);padding:8px;opacity:0;transform:scale(.96);transition:opacity 200ms ease-out,transform 360ms RES_OUT}
.§[data-vp="iv"] .§-mn,.§[data-vp="ih"] .§-mn,.§[data-vp="esc"] .§-mn{width:340px}
.§ .§-capa[data-k~="mas"].§-on .§-mn{opacity:1;transform:none;transition:opacity 240ms ease-out,transform 520ms RES_IN}
.§ .§-capa:not([data-k~="mas"]) .§-mnw{display:none}
.§ .§-capa:not([data-k~="cajon"]) .§-cajon{display:none}
.§ .§-mn-t{padding:8px 12px 6px;font-size:17px;line-height:22px;font-weight:700}
.§ .§-mo{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 12px;border-radius:12px;font-size:15px;line-height:20px;color:var(--tinta);text-align:left}
.§ .§-mo{position:relative}
.§ .§-mo+.§-mo::before{content:"";position:absolute;left:44px;right:12px;top:0;height:1px;background:var(--linea)}
.§ .§-mo>svg:first-child{color:var(--enlace)}
.§ .§-mo>.§-mo-f{margin-left:auto;color:var(--tinta3)}
.§ .§-mo-v{margin-left:auto;font-size:15px;color:var(--tinta2)}
.§ .§-mo-v+.§-mo-f{margin-left:4px}
@media (prefers-reduced-transparency:reduce){
  .§ .§-velo{-webkit-backdrop-filter:none;backdrop-filter:none;background:color-mix(in srgb,var(--navy) 55%,var(--fondo))}
}
@media (prefers-reduced-motion:reduce){
  .§ .§-cajon,.§ .§-capa[data-k~="cajon"].§-on .§-cajon{transform:none;opacity:0;transition:opacity 200ms ease}
  .§ .§-capa[data-k~="cajon"].§-on .§-cajon{opacity:1}
  .§ .§-mn,.§ .§-capa[data-k~="mas"].§-on .§-mn{transform:none;transition:opacity 200ms ease}
  .§ .§-p{transition:none}
}
/* ---- Tira de maqueta (CALMA §7) y ficha «Especificación» (fuera del marco) ---- */
.§-tira{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.§-tira .§-sep{width:1px;height:20px;background:var(--borde)}
.§-tira button{position:relative;height:28px;padding:0 10px;border-radius:999px;border:1px dashed var(--tinta3);background:none;color:var(--tinta2);font:600 12px/16px var(--fuente);white-space:nowrap;cursor:pointer;transition:transform 100ms ease-out}
.§-tira button::after{content:"";position:absolute;inset:-4px 0}
.§-tira button:active{transform:scale(.97)}
.§-tira button:focus-visible{outline:3px solid var(--enlace);outline-offset:2px}
.§-tira button[aria-pressed="true"]{border-style:solid;background:var(--sup2);color:var(--tinta)}
.§-ficha{margin-top:6px;background:var(--sup);border-radius:18px;padding:16px 20px;color:var(--tinta);font:14px/20px var(--fuente);max-width:100%}
.§-ficha h3{margin:0 0 8px;font-size:17px;line-height:22px;font-weight:700}
.§-ficha dl{margin:0;display:grid;grid-template-columns:minmax(0,170px) minmax(0,1fr);gap:0 16px}
.§-ficha dt{padding:8px 0;border-top:1px solid var(--linea);font-size:13px;line-height:18px;font-weight:600;color:var(--tinta2)}
.§-ficha dd{margin:0;padding:8px 0;border-top:1px solid var(--linea);font-size:14px;line-height:20px;overflow-wrap:anywhere}
.§-ficha dt:first-of-type,.§-ficha dt:first-of-type+dd{border-top:0}
.§-ficha code{font:12px/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--tinta2)}
@media (max-width:620px){.§-ficha dl{grid-template-columns:1fr}.§-ficha dd{border-top:0;padding-top:0}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

# JS común: capas (abrir/cerrar, foco, Esc), tira y ficha. Recibe el prefijo y un objeto de vista con estado y aplicar().
JS_BASE = r'''
var P=CFG.p,MS=[].slice.call(document.querySelectorAll('.'+P+'.marco'));
function cls(n){return P+'-'+n}
MS.forEach(function(m){
  var capa=m.querySelector('.'+cls('capa')),orig=null;
  m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();if(capa&&capa.classList.contains(cls('on'))&&a.closest('.'+cls('capa')))cierra()})});
  function abre(k,o){if(!capa)return;orig=o||null;capa.dataset.k=k;capa.classList.add(cls('on'));capa.setAttribute('aria-hidden','false');
    var pan=capa.querySelector(k==='cajon'?'.'+cls('cajon'):'.'+cls('mn'));var f=pan&&pan.querySelector('button,a');if(f)f.focus({preventScroll:true})}
  function cierra(){if(!capa)return;capa.classList.remove(cls('on'));capa.setAttribute('aria-hidden','true');if(orig&&orig.offsetParent)orig.focus({preventScroll:true})}
  m.abre=abre;m.cierra=cierra;
  m.querySelectorAll('[data-abre]').forEach(function(b){b.addEventListener('click',function(){abre(b.dataset.abre,b)})});
  if(capa){capa.querySelector('.'+cls('velo')).addEventListener('click',cierra);
    capa.querySelectorAll('.'+cls('cierra')).forEach(function(b){b.addEventListener('click',cierra)});}
  m.addEventListener('keydown',function(e){if(e.key==='Escape'&&capa&&capa.classList.contains(cls('on'))){e.preventDefault();cierra()}});
});
function tira(grupos,alPulsar){var d=document.createElement('div');d.className=cls('tira');d.setAttribute('role','group');d.setAttribute('aria-label','Controles de la maqueta');
  grupos.forEach(function(g,i){if(i){var s=document.createElement('span');s.className=cls('sep');d.appendChild(s)}
    g.forEach(function(b){var x=document.createElement('button');x.type='button';x.textContent=b[1];x.dataset.k=b[0];if(b[2]!=null)x.setAttribute('aria-pressed',String(b[2]));
      x.addEventListener('click',function(){alPulsar(b[0],x,d)});d.appendChild(x)})});
  var op=MS[0].closest('.op'),h=op&&op.querySelector('header');if(h)h.appendChild(d);else MS[0].parentNode.insertBefore(d,MS[0]);
  var tp=document.querySelector('template.'+cls('ficha-tpl'));if(tp){var f=tp.content.firstElementChild.cloneNode(true);if(op)op.appendChild(f);else MS[MS.length-1].after(f)}
  return d}
'''

def ficha(p, titulo, filas):
    dl = ''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in filas)
    return f'<template class="{p}-ficha-tpl"><section class="{p}-ficha" lang="es" aria-label="Especificación: {titulo}"><h3>Especificación · {titulo}</h3><dl>{dl}</dl></section></template>'

def salida(p, archivo, nombre, desc, css, marcos, js, cfg, fich=''):
    out = (f'<!-- NOMBRE: {nombre} | {desc} -->\n<style>\n{(CSS_NAV + css).replace("§", p)}</style>\n'
           + '\n'.join(m.replace('§', p) for m in marcos) + '\n' + fich +
           f'\n<script>\n(function(CFG){{\n{JS_BASE}\n{js}\n}})({json.dumps(cfg, ensure_ascii=False)});\n</script>\n')
    open(f'{L}/vista-{archivo}.html', 'w').write(out)
    print(archivo, len(out))
