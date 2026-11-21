# Vista 5 · Cajón de navegación abierto (Sidebar.tsx en móvil) y barra lateral completa. Uso: python3 tmp-v5.py
import os, re
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, 'tmp-base.py')).read())
P = 'cr5'
_v1 = open(os.path.join(D, 'tmp-v1.py')).read()
exec(_v1[_v1.index('ICO = '):_v1.index('def capa(')])           # aviso() y menu_mas() de la vista 1, con este prefijo
CSS_AV = re.search(r"\nCSS = '''(.*?)\n'''", _v1, re.S).group(1)  # su CSS (tarjeta, distintivo)

def ajustes_capa(vp):
    return f'''<!-- «Ajustes» de la secretaria (CALMA §28): la abre su fila del pie (o su avatar en el encabezado). Computadora: menú que nace del pie,
     sin velo. iPhone: hoja sobre el cajón. Resto: tarjeta centrada. Mismas tres acciones que hoy tiene en el pie de la barra. -->
  <div class="§-ajw"><div class="§-aj" role="menu" aria-label="Ajustes">{'<span class="§-asa" aria-hidden="true"></span>' if vp == 'tel' else ''}
    <h2 class="§-mn-t">Ajustes</h2>{ajustes_items()}</div></div>'''

def capa(vp):
    cajon = ''
    if vp in ('tel', 'iv'):
        cajon = f'''<!-- El cajón (A0·13): navy, desde la izquierda, 300 de ancho en iPhone y 320 en Duo vertical. Se cierra con la X, tocando el velo, con Esc,
     al navegar o ARRASTRÁNDOLO a la izquierda (sigue al dedo 1:1; al soltar, cierra si pasó un tercio o si iba rápido; si no, vuelve con resorte). -->
<nav class="§-cajon §-nav" aria-label="Menú">
  {lateral("inicio", aviso(vp, "cajon"), cerrar=True)}
  </nav>'''
    mas = menu_mas(vp) if vp in ('ext', 'iv') else ''
    return f'<div class="§-capa" aria-hidden="true">\n  <div class="§-velo"></div>\n  {cajon}\n  {mas}\n  {ajustes_capa(vp)}\n</div>'

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
    # Plan: «Plan VIP» (chip) o, en plan gratuito, el enlace «Actualizar» a planes (comentario del dashboard aprobado: traído del lanzador)
    app = app.replace('<span class="§-plan">Plan VIP</span>', '<span class="§-plan §-pv1">Plan VIP</span><a href="#" class="§-p §-plan §-plan-act §-pv0">Actualizar</a>')
    return f'<div class="marco § §-n3" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capa(vp)}\n</div>'

CSS = CSS_AV + '''
/* ---- Plan ---- */
.§:not(.§-gratis) .§-pv0,.§.§-gratis .§-pv1{display:none!important}
.§ .§-plan-act{position:relative;background:var(--accion);color:#fff}
.§ .§-plan-act::after{content:"";position:absolute;inset:-10px -4px}
/* ---- Arrastre del cajón: mientras el dedo lo lleva, sin transición ---- */
.§ .§-cajon.§-arr{transition:none!important}
.§ .§-cajon{touch-action:pan-y}
/* ---- Ajustes (secretaria) ---- */
.§ .§-ajw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-ajw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="iv"] .§-ajw{padding:calc(var(--it) + 16px) 24px 24px}
.§[data-vp="ih"] .§-ajw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="tel"] .§-ajw{align-items:flex-end;padding:0}
.§[data-vp="esc"] .§-ajw{display:block;padding:0}
.§ .§-aj{pointer-events:auto;width:310px;max-width:100%;background:var(--sup);color:var(--tinta);border-radius:20px;box-shadow:var(--sombra-capa);padding:8px;opacity:0;transform:scale(.96);transition:opacity 200ms ease-out,transform 360ms RES_OUT}
.§[data-vp="ih"] .§-aj,.§[data-vp="iv"] .§-aj{width:340px}
.§[data-vp="tel"] .§-aj{width:100%;border-radius:22px 22px 0 0;padding:8px 12px calc(var(--ib) + 12px);opacity:1;transform:translateY(105%)}
.§[data-vp="esc"] .§-aj{position:absolute;left:12px;bottom:72px;width:224px;padding:6px;border-radius:14px;box-shadow:var(--sombra-capa),0 0 0 1px var(--linea);transform-origin:50% 100%}
.§ .§-capa[data-k~="aj"].§-on .§-aj{opacity:1;transform:none;transition:opacity 240ms ease-out,transform 520ms RES_IN}
.§ .§-capa:not([data-k~="aj"]) .§-ajw{visibility:hidden}
.§[data-vp="esc"] .§-capa[data-k="aj"] .§-velo{opacity:0}
.§ .§-asa{display:block;width:36px;height:5px;margin:0 auto 6px;border-radius:999px;background:var(--borde)}
.§ .§-salir{color:var(--mal-tinta)}
.§ .§-mo.§-salir>svg:first-child{color:var(--mal-tinta)}
.§ .§-aj .§-salir::before,.§ .§-mn .§-salir::before{left:12px!important}
@media (prefers-reduced-motion:reduce){.§ .§-aj{transform:none!important;transition:opacity 200ms ease}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var st={rol:'adm',gratis:false};
MS.forEach(function(m){var vp=m.dataset.vp,capa=m.querySelector('.'+cls('capa'));
  function k(){return (capa.dataset.k||'').split(' ').filter(Boolean)}
  function pon(l){capa.dataset.k=l.join(' ');var on=l.length>0;capa.classList.toggle(cls('on'),on);capa.setAttribute('aria-hidden',String(!on))}
  m.pon=pon;
  /* Ajustes de la secretaria: desde el pie del cajón/barra o desde el avatar */
  m.querySelectorAll('.'+cls('abre-aj')).forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();var l=k().filter(function(x){return x!=='mas'});
    if(vp==='ext'||vp==='iv'){l=l.filter(function(x){return x!=='cajon'})}l.push('aj');pon(l);var f=capa.querySelector('.'+cls('aj')+' .'+cls('mo'));if(f)f.focus({preventScroll:true})})});
  /* Modo oscuro / claro: en la maqueta solo cambia su rótulo; el tema se prueba con los botones de la página */
  m.querySelectorAll('.'+cls('tema')).forEach(function(b){b.addEventListener('click',function(){var s=b.querySelector('span');s.textContent=s.textContent==='Modo oscuro'?'Modo claro':'Modo oscuro'})});
  capa.querySelector('.'+cls('velo')).addEventListener('click',function(e){e.stopImmediatePropagation();var l=k();l.pop();pon(l)},true);
  capa.querySelector('.'+cls('ajw')).addEventListener('click',function(e){if(e.target===e.currentTarget){var l=k();l.pop();pon(l)}});
  m.addEventListener('keydown',function(e){if(e.key==='Escape'&&k().length){e.preventDefault();e.stopImmediatePropagation();var l=k();l.pop();pon(l)}},true);
  /* Arrastre para cerrar el cajón: sigue al dedo 1:1 (solo hacia la izquierda, con rubber-band hacia la derecha) y al soltar
     proyecta la inercia (v·0,2 s): cierra si la proyección pasa un tercio del ancho o si va a más de 500 px/s. */
  var cj=m.querySelector('.'+cls('cajon'));if(!cj)return;
  var x0=null,hist=[],w=0;
  cj.addEventListener('pointerdown',function(e){if(e.target.closest('a,button'))return;x0=e.clientX;hist=[[performance.now(),0]];w=cj.offsetWidth;cj.classList.add(cls('arr'));cj.setPointerCapture(e.pointerId)});
  cj.addEventListener('pointermove',function(e){if(x0===null)return;var z=m.getBoundingClientRect().width/m.offsetWidth,dx=(e.clientX-x0)/z;
    var t=dx<0?dx:dx*0.15;cj.style.transform='translateX('+t+'px)';hist.push([performance.now(),dx]);if(hist.length>6)hist.shift()});
  function suelta(){if(x0===null)return;var a=hist[0],b=hist[hist.length-1],dt=(b[0]-a[0])/1000,v=dt>0?(b[1]-a[1])/dt:0;x0=null;
    cj.classList.remove(cls('arr'));cj.style.transform='';if(b[1]+v*0.2<-w/3||v<-500){var l=k().filter(function(x){return x!=='cajon'});pon(l)}}
  cj.addEventListener('pointerup',suelta);cj.addEventListener('pointercancel',suelta);
});
function aplica(){MS.forEach(function(m){m.classList.toggle(cls('sec'),st.rol==='sec');m.classList.toggle(cls('gratis'),st.gratis);
  m.classList.toggle(cls('n0'),st.rol==='sec');m.classList.toggle(cls('n3'),st.rol!=='sec')})}
var T=tira([[['adm','Médico admin',true],['inv','Médico invitado',false],['sec','Secretaria',false]],[['gratis','Plan gratuito',false]],[['abre','Abrir el menú'],['cierra','Cerrar'],['aj','Ajustes (secretaria)']]],function(q,x){
  if(q==='adm'||q==='inv'||q==='sec'){st.rol=q;T.querySelectorAll('[data-k="adm"],[data-k="inv"],[data-k="sec"]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.k===q))})}
  else if(q==='gratis'){st.gratis=!st.gratis;x.setAttribute('aria-pressed',String(st.gratis))}
  else if(q==='abre'){MS.forEach(function(m){var v=m.dataset.vp;m.pon(v==='ext'?['mas']:(v==='tel'||v==='iv')?['cajon']:[])});return}
  else if(q==='cierra'){MS.forEach(function(m){m.pon([])});return}
  else if(q==='aj'){st.rol='sec';T.querySelectorAll('[data-k="adm"],[data-k="inv"],[data-k="sec"]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.k==='sec'))});aplica();
    MS.forEach(function(m){var v=m.dataset.vp;m.pon(v==='tel'?['cajon','aj']:['aj'])});return}
  aplica()});
/* El aviso se pliega igual que en la vista 1 (estado compartido por los cinco marcos) */
var pleg=false;MS.forEach(function(m){m.querySelectorAll('.'+cls('ap-cab')).forEach(function(b){b.addEventListener('click',function(){pleg=!pleg;
  MS.forEach(function(x){x.classList.toggle(cls('pleg'),pleg);x.querySelectorAll('.'+cls('ap-cab')).forEach(function(c){c.setAttribute('aria-expanded',String(!pleg))})})})})});
aplica();
/* Abierto de entrada en iPhone y Duo vertical (y «Más» en Duo cerrado) (es la pieza que se presenta) */
MS.forEach(function(m){var v=m.dataset.vp;if(v==='tel'||v==='iv')m.pon(['cajon']);if(v==='ext')m.pon(['mas'])});
'''

FICHA = ficha(P, 'Cajón y barra lateral', [
    ('Qué es', 'La navegación completa (<code>layout/Sidebar.tsx</code>): barra lateral fija en computadora (izquierda, 248) y Duo abierto horizontal (derecha, 218 + franja); cajón que se abre desde el botón de menú en iPhone y desde «Mostrar barra lateral» en Duo abierto vertical; en Duo cerrado, su equivalente es el menú «Más» del riel.'),
    ('Contenido, de arriba abajo', 'Glifo Spinus y chip del plan («Plan VIP»; en plan gratuito, enlace «Actualizar» a planes). Botón de consultorio con el LOGO DE LA CLÍNICA en círculo blanco de 36 (sin logo propio, el de Spinus, como hoy con <code>/logo.png</code>) y «Consultorio · Centro» (secretaria: «Clínica · Clínica Semilla A»), que abre el selector (vista 2). Secciones. Aviso de perfil (vista 1, solo médico). Pie: médico = nombre, especialidad (donde cabe; no en Duo abierto horizontal) y «Mi perfil · Ajustes», con el botón de Ayuda a la derecha; secretaria = su nombre y «Ajustes», que abre Modo oscuro, Aviso de Privacidad y Cerrar sesión.'),
    ('Entradas por rol', '<b>Médico admin:</b> Inicio · Expediente (Suplementación vive dentro, CALMA §28) · Agenda · Documentos (los ocho tipos, por la rejilla) · Administración (Estadísticas, Usuarios de la clínica, Facturación) · Mi perfil · Ayuda. <b>Médico invitado:</b> lo mismo; Administración solo enseña Estadísticas (las pestañas Usuarios y Facturación no se dibujan); la barra no cambia. <b>Secretaria:</b> Inicio · Expediente («Nuevo paciente» está en la lista y en su dashboard) · Agenda · Ajustes. Sin Documentos, Administración, Mi perfil ni Ayuda (como hoy).'),
    ('Menú «Más» (Duo cerrado y vertical)', 'Médico: aviso de perfil, Consultorio activo, Administración, Mi perfil, Ayuda (CALMA §28). Secretaria: sus Ajustes.'),
    ('Medidas', 'Cajón 300 (iPhone) / 320 (Duo vertical), radio 26 del lado del contenido, relleno 14, sombra de navegación; filas de sección 44; botón de consultorio 52; pie 48 (con especialidad, ~64); X de 44. En computadora las filas miden 40. Ajustes: menú de 224 que nace del pie sin velo en computadora, hoja en iPhone, tarjeta centrada de 310/340 en Duo.'),
    ('Apertura y cierre', 'Entra desde la izquierda con resorte (amortiguación 1, respuesta .35 s) y sale por el mismo camino (.25 s). Se cierra con la X, con Esc, tocando el velo, al navegar (cada enlace cierra, como hoy) o arrastrando a la izquierda: sigue al dedo 1:1, con resistencia (×0,15) hacia la derecha, y al soltar proyecta la inercia; cierra si pasa un tercio del ancho o va a más de 500 px/s, si no vuelve con resorte.'),
    ('Accesibilidad', '<code>nav</code> con nombre «Menú»; foco a la X al abrir y de vuelta al botón al cerrar; el distintivo del aviso entra en el nombre del botón («Menú, 3 datos pendientes»); Ajustes con <code>aria-haspopup="menu"</code>.'),
    ('Reduced motion / transparency', 'Cajón y menús por fundido de 200 ms, sin desplazamiento; el arrastre sigue funcionando. Velo opaco sin desenfoque.'),
    ('Fuera de esta vista', '«Plegar menú» de la agenda lo dibuja la tanda de herramientas de la agenda (CALMA §28).'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '5-cajon', 'Cajón y barra lateral',
       'Ninguna maqueta dibujaba el menú abierto; aquí el cajón de iPhone y Duo vertical y la barra lateral de ancho muestran todo lo que hay por rol, con el logo de la clínica de vuelta en el botón de consultorio, el aviso de perfil y, para la secretaria, sus «Ajustes»; se cierra también arrastrándolo',
       CSS, marcos, JS, {'p': P}, FICHA)
