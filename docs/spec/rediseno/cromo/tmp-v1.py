# Vista 1 · Aviso de perfil (AvisoPerfilSidebar). Uso: python3 tmp-v1.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())

P = 'cr1'
ICO = dict(firma='firma', cedula='cedula', logo='imagen')
MOT = [('firma', 'Documentos sin firma'), ('cedula', 'Sin cédula de especialidad'), ('logo', 'Clínica sin logo')]

def aviso(vp, donde):
    cid = f'{P}-av-{vp}-{donde}'
    filas = ''.join(f'<a href="#" class="§-p §-ap-l" data-k="{k}">{ic(I[ICO[k]], 18, 1.9)}<span>{t}</span></a>' for k, t in MOT)
    return f'''<!-- A0·11 · Aviso de perfil (AvisoPerfilSidebar.tsx). Solo role=medico; sin pendientes no se dibuja. Los tres motivos y «Completar ahora» van a /perfil
       y cierran el cajón o el menú. El título sale del código: `${{n}} dato${{n > 1 ? 's' : ''}} pendiente${{n > 1 ? 's' : ''}}` (línea 153). -->
  <div class="§-ap §-m" role="status" aria-live="polite">
    <button type="button" class="§-p §-ap-cab" aria-expanded="true" aria-controls="{cid}">
      <span class="§-ap-pt" aria-hidden="true"></span><span class="§-ap-t">3 datos pendientes</span>{ic(I["arriba"], 18, 2.2, ' class="§-ap-ch"')}
    </button>
    <div class="§-ap-c" id="{cid}">
      <span class="§-ap-sep" aria-hidden="true"></span>
      {filas}
      <a href="#" class="§-p §-ap-b">Completar ahora{ic(I["flecha"], 16, 2.2)}</a>
    </div>
  </div>'''

def menu_mas(vp):
    # «Más» del riel (ext) y de la pista (iv): CALMA §23.9. Lo que el BRIEF manda a «Más»: Administración, Mi perfil y Ayuda.
    o = lambda k, t: f'<a href="#" class="§-p §-mo §-m">{ic(I[k], 20)}<span>{t}</span>{ic(I["sig"], 16, 2.2, " class=\"§-mo-f\"")}</a>'
    return f'''<div class="§-mnw"><div class="§-mn" role="dialog" aria-modal="true" aria-label="Más">
    <h2 class="§-mn-t">Más</h2>
    <!-- La tarjeta del aviso encabeza el menú «Más»: en Duo cerrado no hay barra lateral donde vivir. -->
    {aviso(vp, "mas")}
    <!-- Selector de consultorio activo (A0·2): en Duo cerrado no hay barra lateral, así que vive aquí; solo médico con 2 o más consultorios. Ver vista 2. -->
    <button type="button" class="§-p §-mo §-m">{ic(I["selector"], 20, 2)}<span>Consultorio activo</span><span class="§-mo-v">Centro</span>{ic(I["sig"], 16, 2.2, ' class="§-mo-f"')}</button>
    {o("admin", "Administración")}{o("perfil", "Mi perfil")}{o("ayuda", "Ayuda")}
    <!-- Secretaria (CALMA §28): sin Mi perfil; en «Más» encuentra sus «Ajustes» -->
    <div class="§-s">{ajustes_items()}</div>
  </div></div>'''

def capa(vp):
    if vp in ('ih', 'esc'):
        return ''
    cajon = ''
    if vp in ('tel', 'iv'):
        cajon = f'''<nav class="§-cajon §-nav" aria-label="Menú">
  {lateral("inicio", aviso(vp, "cajon"), cerrar=True)}
  </nav>'''
    mas = menu_mas(vp) if vp in ('ext', 'iv') else ''
    return f'''<!-- Capa del marco (CALMA §25/§26): {"cajón desde la izquierda (botón de menú) y " if cajon else ""}{"menú «Más» como tarjeta centrada" if mas else ""}. Un solo velo. -->
<div class="§-capa" aria-hidden="true">
  <div class="§-velo"></div>
  {cajon}
  {mas}
</div>'''

def marco(vp):
    if vp == 'ext':
        app = fondo(vp) + riel('inicio', badge=True)
    elif vp == 'tel':
        app = encabezado('Inicio', badge=True) + fondo(vp)
    elif vp == 'iv':
        app = enc_iv('Inicio', badge=True) + fondo(vp)
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("inicio", aviso(vp, "lat"))}\n</nav>'
        app = (fondo(vp) + latn) if vp == 'ih' else (latn + fondo(vp))
    return f'<div class="marco § §-n3" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capa(vp)}\n</div>'

CSS = '''
/* ===== Aviso de perfil: tarjeta ámbar del sistema (--ag-*), sin degradado ni brillo ===== */
.§ .§-ap{border-radius:14px;background:var(--ag-fondo);color:var(--tinta);margin:0 0 10px}
.§ .§-mn .§-ap{margin:2px 0 8px}
.§.§-n0 .§-ap{display:none}
.§ .§-ap-cab{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 10px 8px 12px;border-radius:14px;text-align:left;color:var(--ag-tinta)}
.§[data-vp="ih"] .§-lat .§-ap-cab,.§[data-vp="esc"] .§-ap-cab{min-height:40px;padding:6px 10px 6px 12px}
.§ .§-ap-cab:focus-visible{outline:3px solid var(--enlace);outline-offset:2px}
.§ .§-ap-pt{position:relative;width:22px;height:22px;flex:none;border-radius:7px;background:color-mix(in srgb,var(--ag-punto) 22%,transparent)}
.§ .§-ap-pt::before,.§ .§-ap-pt::after{content:"";position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:999px;background:var(--ag-punto)}
/* Señal viva discreta: un latido del punto (anillo que crece y se desvanece) durante 1,1 s de cada 3,2 s. Solo transform y opacity. */
.§ .§-ap-pt::after{animation:§-latido 3.2s cubic-bezier(.2,.6,.3,1) infinite}
@keyframes §-latido{0%{transform:scale(1);opacity:.65}34%{transform:scale(2.7);opacity:0}100%{transform:scale(2.7);opacity:0}}
.§ .§-ap-t{flex:1;min-width:0;font-size:15px;line-height:20px;font-weight:700;font-variant-numeric:tabular-nums}
.§ .§-ap-ch{transition:transform 240ms cubic-bezier(.32,.72,0,1)}
.§.§-pleg .§-ap-ch{transform:rotate(180deg)}
.§ .§-ap-c{display:flex;flex-direction:column;padding:0 12px 12px;transition:opacity 180ms ease-out,transform 180ms ease-out}
.§.§-pleg .§-ap-c{display:none}
.§.§-sal .§-ap-c,.§.§-ent .§-ap-c{opacity:0;transform:translateY(-4px)}
.§ .§-ap-sep{display:block;height:1px;margin:0 0 2px;background:color-mix(in srgb,var(--ag-tinta) 22%,transparent)}
.§ .§-ap-l{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:12px 2px;border-radius:8px;font-size:14px;line-height:20px;font-weight:600;color:var(--tinta)}
.§ .§-ap-l svg{margin-top:1px;color:var(--ag-tinta)}
.§[data-vp="ih"] .§-lat .§-ap-l,.§[data-vp="esc"] .§-ap-l{min-height:36px;padding:8px 2px}
.§.§-n2 .§-ap-l[data-k="cedula"],.§.§-n1 .§-ap-l[data-k="cedula"],.§.§-n1 .§-ap-l[data-k="logo"]{display:none}
.§ .§-ap-b{position:relative;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:6px;height:40px;border-radius:10px;background:var(--ag-tinta);color:var(--ag-fondo);font-size:14px;line-height:18px;font-weight:600}
.§ .§-ap-b::after{content:"";position:absolute;inset:-2px 0}
.§[data-vp="ih"] .§-lat .§-ap-b,.§[data-vp="esc"] .§-ap-b{height:36px}
.§[data-vp="ih"] .§-lat .§-ap-b::after,.§[data-vp="esc"] .§-ap-b::after{display:none}
/* Distintivo ámbar con el número, sobre el botón que lleva a la tarjeta (menú en iPhone, barra lateral en Duo vertical, «Más» en Duo cerrado) */
.§ .§-envb .§-bdg{top:0;right:-5px}
/* Duo abierto horizontal: la tarjeta cabe entera junto a las cinco secciones (sin desplazar la barra) */
.§[data-vp="ih"] .§-lat .§-lista{margin-top:12px}
.§[data-vp="ih"] .§-lat .§-ap{margin:0 -10px 8px -4px}
.§[data-vp="ih"] .§-lat .§-ap-cab{padding:6px 8px;gap:8px}
.§[data-vp="ih"] .§-lat .§-ap-t{font-size:14px;line-height:18px}
.§[data-vp="ih"] .§-lat .§-ap-c{padding:0 10px 10px}
.§[data-vp="ih"] .§-lat .§-ap-l{gap:8px}
.§[data-vp="ih"] .§-lat .§-cons-b{margin-top:8px}
.§[data-vp="ih"] .§-lat .§-ap-c{padding-bottom:10px}
.§[data-vp="ih"] .§-lat .§-ap-sep{margin:0}
.§[data-vp="ih"] .§-lat .§-ap-b{margin-top:4px}
.§[data-vp="ih"] .§-lat .§-yo{min-height:44px;padding-top:0;padding-bottom:0}
.§ .§-bdg{position:absolute;top:-3px;right:-3px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:var(--ag-punto);color:var(--navy);border:2px solid var(--navy);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:16px;font-weight:700;font-variant-numeric:tabular-nums;pointer-events:none}
.§ .§-rb .§-bdg{top:2px;right:2px}
.§.§-n0 .§-bdg,.§.§-sec .§-bdg{display:none}
@media (prefers-reduced-motion:reduce){
  .§ .§-ap-pt::after{animation:none;opacity:0}
  .§ .§-ap-c,.§ .§-ap-ch{transition:none}
}
'''

JS = r'''
var st={n:3,pleg:false,sec:false},TXT={3:'3 datos pendientes',2:'2 datos pendientes',1:'1 dato pendiente',0:''};
function aplica(){MS.forEach(function(m){
  m.classList.remove(cls('n3'),cls('n2'),cls('n1'),cls('n0'));m.classList.add(cls('n'+st.n));
  m.classList.toggle(cls('pleg'),st.pleg);m.classList.toggle(cls('sec'),st.sec);
  m.querySelectorAll('.'+cls('ap-t')).forEach(function(t){t.textContent=TXT[st.n]});
  m.querySelectorAll('.'+cls('ap-cab')).forEach(function(b){b.setAttribute('aria-expanded',String(!st.pleg))});
  m.querySelectorAll('.'+cls('bdg')).forEach(function(b){b.textContent=st.n;var p=b.parentNode,base=p.dataset.rot;
    p.setAttribute('aria-label',(st.n&&!st.sec)?base+', '+TXT[st.n]:base)});
})}
/* Plegar/desplegar: el contenido se funde y sube 4 px; el alto cambia sin animar (solo transform/opacity). El estado es uno para los
   cinco marcos: hace de la memoria por navegador (localStorage «spinus.profileBanner.collapsed»). */
function alterna(){if(!st.pleg){MS.forEach(function(m){m.classList.add(cls('sal'))});
    setTimeout(function(){st.pleg=true;MS.forEach(function(m){m.classList.remove(cls('sal'))});aplica();sinc()},180)}
  else{st.pleg=false;MS.forEach(function(m){m.classList.add(cls('ent'))});aplica();sinc();
    requestAnimationFrame(function(){requestAnimationFrame(function(){MS.forEach(function(m){m.classList.remove(cls('ent'))})})})}}
MS.forEach(function(m){m.querySelectorAll('.'+cls('ap-cab')).forEach(function(b){b.addEventListener('click',alterna)})});
var T=tira([[['n3','3 datos',true],['n2','2 datos',false],['n1','1 dato',false],['n0','Sin pendientes',false]],[['pleg','Plegado',false]],[['sec','Secretaria',false]],[['abre','Abrir menú (teléfonos)']]],
  function(k){if(k==='pleg'){alterna();return}
    if(k==='sec'){st.sec=!st.sec}
    else if(k==='abre'){MS.forEach(function(m){var v=m.dataset.vp;if(v==='ext')m.abre('mas');else if(v==='tel'||v==='iv')m.abre('cajon')});return}
    else{var n=+k.slice(1);
      /* §8 del código: un pendiente nuevo reabre la tarjeta aunque estuviera plegada */
      if(n>st.n)st.pleg=false;st.n=n}
    aplica();sinc()});
function sinc(){T.querySelectorAll('button').forEach(function(b){var k=b.dataset.k;if(!b.hasAttribute('aria-pressed'))return;
  b.setAttribute('aria-pressed',String(k==='pleg'?st.pleg:k==='sec'?st.sec:('n'+st.n)===k))})}
aplica();
'''

FICHA = ficha(P, 'Aviso de perfil', [
    ('Qué es', 'El aviso de perfil incompleto de hoy (<code>AvisoPerfilSidebar.tsx</code>, montado en <code>Sidebar.tsx:827</code>). Le dice al médico que le faltan datos para que sus documentos salgan conforme: firma, cédula de especialidad (solo si no es medicina general) y logo de la clínica. Lo decide el servidor (<code>/api/me/estado-perfil</code>); esto es solo pintura.'),
    ('A quién', 'Solo <code>role = medico</code> (admin o invitado). La secretaria y el super_admin no lo ven. Sin pendientes no se dibuja nada: ni tarjeta ni distintivo. Desaparece solo al completar el último dato.'),
    ('Dónde vive', '<b>Computadora y Duo abierto horizontal:</b> dentro de la barra lateral, siempre a la vista, entre la lista de secciones y «Mi perfil · Ajustes» (los cuatro destinos son Mi perfil). <b>iPhone y Duo abierto vertical:</b> distintivo ámbar con el número sobre el botón que abre el menú (en iPhone, el menú; en Duo vertical, «Mostrar barra lateral»); la tarjeta va dentro del cajón, en el mismo sitio que en la barra lateral. <b>Duo cerrado:</b> distintivo sobre «Más» del riel; la tarjeta encabeza el menú «Más» (tarjeta centrada, CALMA §26). En Duo vertical el menú «Más» también la lleva.'),
    ('Medidas', 'Tarjeta: radio 14, fondo <code>--ag-fondo</code>, relleno 12, separación 10 sobre el pie. Cabecera 44 de alto (40 en barra lateral de Duo abierto y computadora): punto ámbar en cuadro de 22 (radio 7), título 15/700 <code>--ag-tinta</code>, chevron 18. Motivos: fila 44 (36 en ancho), icono 18 <code>--ag-tinta</code> + texto 14/600 <code>--tinta</code>; si no cabe, parte en dos líneas (nunca se recorta). «Completar ahora»: 40 de alto con área 44 (36 en ancho), radio 10, fondo <code>--ag-tinta</code>, texto <code>--ag-fondo</code> 14/600, flecha 16. Distintivo: 22 de alto, mínimo 22 de ancho, fondo <code>--ag-punto</code>, número <code>--navy</code> 12/700 tabular, aro de 2 en <code>--navy</code>.'),
    ('Textos (exactos de hoy)', '«3 datos pendientes» / «2 datos pendientes» / «1 dato pendiente» (<code>AvisoPerfilSidebar.tsx:153</code>), «Documentos sin firma», «Sin cédula de especialidad», «Clínica sin logo» (líneas 122–124), «Completar ahora» (232). Sin texto nuevo.'),
    ('Plegado y memoria', 'Toda la cabecera pliega y despliega (<code>aria-expanded</code>, <code>aria-controls</code>). Plegada queda solo la cabecera con el número. Se recuerda por navegador en <code>localStorage["spinus.profileBanner.collapsed"]</code> = {colapsado, claves}; nace desplegada (servidor, privado o valor corrupto) y se reabre sola si aparece un pendiente que no existía cuando se plegó. El distintivo sigue mientras haya pendientes, plegada o no.'),
    ('Destinos', 'Los tres motivos y «Completar ahora» llevan a <code>/perfil</code> (pestaña Datos, donde viven los tres) y cierran el cajón o el menú.'),
    ('Accesibilidad', 'La tarjeta es <code>role="status"</code> con <code>aria-live="polite"</code>. El distintivo es <code>aria-hidden</code> y su información entra en el nombre del botón: «Menú, 3 datos pendientes», «Más, 1 dato pendiente». Contraste ≥ 4,5 : 1 en claro y oscuro (título <code>--ag-tinta</code> sobre <code>--ag-fondo</code>; número <code>--navy</code> sobre <code>--ag-punto</code>). Foco visible de 3 px.'),
    ('Movimiento', 'Única animación perpetua: el latido del punto (anillo que crece de 1 a 2,7 y se desvanece en 1,1 s, reposo hasta 3,2 s). Al plegar, el contenido se funde y sube 4 px en 180 ms y luego el alto cambia sin animar; al desplegar, el camino inverso. Cajón: entra desde la izquierda con resorte (amortiguación 1, respuesta .35 s) y sale por el mismo camino más rápido (.25 s); en la app, además, se cierra arrastrándolo a la izquierda con proyección de inercia. «Más»: escala .96→1 y fundido desde el centro. Todo interrumpible.'),
    ('Reduced motion / transparency', 'Movimiento reducido: el punto queda fijo (sin latido); cajón y menú por fundido de 200 ms sin desplazamiento; plegado sin transición. Transparencia reducida: velo opaco sin desenfoque.'),
    ('Respecto a hoy', 'Fuera el degradado amarillo, la sombra ámbar, el halo y el brillo que barre la tarjeta: es el mismo ámbar de «pendiente» del sistema y una sola señal viva. En teléfono ya no hay que abrir el menú para enterarse: el distintivo está en la barra de siempre. En el cajón ya no empuja las secciones fuera de la vista (hoy, desplegado en un teléfono de 678 de alto, les deja 83 px y hay que desplazar para llegar a Agenda o Mi perfil).'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '1-aviso-perfil', 'Aviso de perfil («N datos pendientes»)',
       'Hoy es una tarjeta amarilla con degradado, halo y brillo animado al pie del menú, y en teléfono solo se ve abriendo el menú; aquí usa el ámbar del sistema con un solo latido, vive en la barra lateral en ancho y, en teléfono y Duo, un distintivo con el número sobre el botón del menú avisa sin abrirlo',
       CSS, marcos, JS, {'p': P}, FICHA)
