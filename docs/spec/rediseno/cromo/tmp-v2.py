# Vista 2 · Selector de consultorio activo (ConsultorioActivoSelector). Uso: python3 tmp-v2.py
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())

P = 'cr2'
I.update(
    check='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info='<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    edificio='<path d="M4 21V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M14 10h5a1 1 0 0 1 1 1v10M3 21h18M8 9h2M8 13h2M8 17h2"/>',
)
CK = ' class="§-co-ck"'
MOF = ' class="§-mo-f"'
CONS = ['Centro', 'Hosp Norte', 'Rehab']

def lista_cons(vp):
    filas = ''.join(f'<button type="button" class="§-p §-co" data-c="{c}" role="menuitemradio" aria-checked="{str(c == "Centro").lower()}"><span>{c}</span>{ic(I["check"], 20, 2.2, CK)}</button>' for c in CONS)
    asa = '<span class="§-asa" aria-hidden="true"></span>' if vp == 'tel' else ''
    tit = '' if vp == 'esc' else '<h2 class="§-mn-t">Consultorio activo</h2>'
    return f'''<!-- A0·2 · Lista de consultorios (ConsultorioActivoSelector.tsx:105-131): palomita en el activo; elegir el activo solo cierra;
       elegir otro abre la confirmación. «Gestionar consultorios →» lleva a /perfil y cierra el menú. Esc y tocar fuera cierran.
       Computadora: desplegable que nace del botón, sin velo (§21). iPhone: hoja inferior sobre el cajón. Resto: tarjeta centrada con velo (§25/§26). -->
  <div class="§-lw"><div class="§-ls" role="menu" aria-label="Consultorio activo">{asa}{tit}{filas}
    <a href="#" class="§-p §-gest">Gestionar consultorios →</a></div></div>'''

def alerta():
    return f'''<!-- Confirmación (ConsultorioActivoSelector.tsx:137-164) con el patrón único de alerta (CALMA §13, §25): icono tonal, título centrado,
       dos botones del mismo ancho, secundario a la izquierda. Textos exactos de hoy. -->
  <div class="§-alw"><div class="§-al" role="alertdialog" aria-modal="true" aria-labelledby="§-al-t-VP" aria-describedby="§-al-m-VP">
    <span class="§-al-ic" aria-hidden="true">{ic(I["edificio"], 28, 1.8)}</span>
    <h2 class="§-al-t" id="§-al-t-VP">Cambiar consultorio activo</h2>
    <p class="§-al-m" id="§-al-m-VP">¿Cambiar a <strong class="§-al-n">Hosp Norte</strong>?</p>
    <div class="§-al-b"><button type="button" class="§-p §-ton §-al-no">Cancelar</button><button type="button" class="§-p §-prim §-al-si">Sí, cambiar</button></div>
  </div></div>'''

def aviso_breve():
    return f'''<!-- Aviso breve (pub-capas vista 5): «Consultorio activo: X» (ConsultorioActivoSelector.tsx:79), arriba y centrado en el área de contenido. -->
<div class="§-zona" aria-live="polite"><div class="§-tst" role="status">{ic(I["info"], 20, 2)}<span class="§-tst-t">Consultorio activo: Hosp Norte</span>
  <button type="button" class="§-p §-tst-x" aria-label="Cerrar aviso">{ic(I["x"], 18, 2)}</button></div></div>'''

def menu_mas(vp):
    o = lambda k, t: f'<a href="#" class="§-p §-mo §-m">{ic(I[k], 20)}<span>{t}</span>{ic(I["sig"], 16, 2.2, MOF)}</a>'
    return f'''<div class="§-mnw"><div class="§-mn" role="dialog" aria-modal="true" aria-label="Más">
    <h2 class="§-mn-t">Más</h2>
    <!-- Duo cerrado: el selector vive en «Más» (no hay barra lateral). El aviso de perfil va encima (vista 1); aquí se omite. -->
    <button type="button" class="§-p §-mo §-abre-ls §-m">{ic(I["selector"], 20, 2)}<span>Consultorio activo</span><span class="§-mo-v §-cons-n">Centro</span>{ic(I["sig"], 16, 2.2, ' class="§-mo-f"')}</button>
    {o("admin", "Administración")}{o("perfil", "Mi perfil")}{o("ayuda", "Ayuda")}
    <!-- Secretaria (CALMA §28): sin Mi perfil; en «Más» encuentra sus «Ajustes» -->
    <div class="§-s">{ajustes_items()}</div>
  </div></div>'''

def capa(vp):
    cajon = ''
    if vp in ('tel', 'iv'):
        cajon = f'<nav class="§-cajon §-nav" aria-label="Menú">\n  {lateral("inicio", "", cerrar=True)}\n  </nav>'
    mas = menu_mas(vp) if vp in ('ext', 'iv') else ''
    return f'''<div class="§-capa" aria-hidden="true">
  <div class="§-velo"></div>
  {cajon}
  {mas}
  {lista_cons(vp)}
  {alerta().replace("VP", vp)}
</div>
{aviso_breve()}'''

def marco(vp):
    if vp == 'ext':
        app = fondo(vp) + riel('inicio')
    elif vp == 'tel':
        app = encabezado('Inicio') + fondo(vp)
    elif vp == 'iv':
        app = enc_iv('Inicio') + fondo(vp)
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("inicio")}\n</nav>'
        app = (fondo(vp) + latn) if vp == 'ih' else (latn + fondo(vp))
    return f'<div class="marco §" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capa(vp)}\n</div>'

CSS = '''
.§ .§-cons-b{position:relative}
.§ .§-cons-b[aria-expanded="true"]{background:color-mix(in srgb,#fff 14%,transparent)}
/* ---- Lista de consultorios ---- */
.§ .§-lw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-lw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="iv"] .§-lw{padding:calc(var(--it) + 16px) 24px 24px}
.§[data-vp="ih"] .§-lw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="tel"] .§-lw{align-items:flex-end;padding:0}
.§[data-vp="esc"] .§-lw{display:block;padding:0}
.§ .§-ls{pointer-events:auto;display:flex;flex-direction:column;width:310px;max-width:100%;background:var(--sup);color:var(--tinta);border-radius:20px;box-shadow:var(--sombra-capa);padding:8px;opacity:0;transform:scale(.96);transition:opacity 200ms ease-out,transform 360ms RES_OUT}
.§[data-vp="ih"] .§-ls,.§[data-vp="iv"] .§-ls{width:340px}
.§[data-vp="tel"] .§-ls{width:100%;border-radius:22px 22px 0 0;padding:8px 12px calc(var(--ib) + 12px);opacity:1;transform:translateY(105%)}
.§[data-vp="esc"] .§-ls{position:absolute;left:12px;top:120px;width:224px;padding:6px;border-radius:14px;box-shadow:var(--sombra-capa),0 0 0 1px var(--linea);transform-origin:50% 0;transform:scale(.96) translateY(-4px)}
.§ .§-capa[data-k~="lista"].§-on .§-ls{opacity:1;transform:none;transition:opacity 240ms ease-out,transform 520ms RES_IN}
.§ .§-capa:not([data-k~="lista"]) .§-lw{visibility:hidden}
.§ .§-asa{display:block;width:36px;height:5px;margin:0 auto 6px;border-radius:999px;background:var(--borde)}
.§ .§-co{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 12px;border-radius:12px;font-size:15px;line-height:20px;color:var(--tinta);text-align:left}
.§[data-vp="esc"] .§-co{min-height:40px;font-size:14px;padding:0 10px}
.§ .§-co+.§-co{box-shadow:inset 0 1px 0 var(--linea)}
.§ .§-co>span{flex:1}
.§ .§-co-ck{color:var(--enlace);visibility:hidden}
.§ .§-co[aria-checked="true"] .§-co-ck{visibility:visible}
.§ .§-co[aria-checked="true"]>span{font-weight:600}
.§ .§-gest{display:flex;align-items:center;min-height:48px;margin-top:4px;padding:0 12px;border-top:1px solid var(--linea);font-size:15px;line-height:20px;font-weight:600;color:var(--enlace)}
.§[data-vp="esc"] .§-gest{min-height:40px;font-size:14px;padding:0 10px}
/* En computadora el desplegable no lleva velo (§21) */
.§[data-vp="esc"] .§-capa[data-k="lista"] .§-velo{opacity:0}
/* ---- Alerta ---- */
.§ .§-alw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-alw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="tel"] .§-alw{padding:calc(var(--it) + 64px) 16px calc(var(--ib) + 16px)}
.§[data-vp="iv"] .§-alw{padding:calc(var(--it) + 58px) 24px 24px}
.§[data-vp="ih"] .§-alw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="esc"] .§-alw{padding:32px 24px 32px calc(248px + 24px)}
.§ .§-al{pointer-events:auto;width:320px;max-width:100%;padding:24px;border-radius:20px;background:var(--sup);color:var(--tinta);box-shadow:var(--sombra-capa);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:scale(.96);transition:opacity 180ms ease-out,transform 300ms RES_OUT}
.§[data-vp="ih"] .§-al,.§[data-vp="iv"] .§-al,.§[data-vp="esc"] .§-al{width:340px}
.§ .§-capa[data-k~="alerta"].§-on .§-al{opacity:1;transform:none;transition:opacity 220ms ease-out,transform 480ms RES_IN}
.§ .§-capa:not([data-k~="alerta"]) .§-alw{visibility:hidden}
/* Un solo velo: con la alerta abierta, el cajón y la lista se retiran por su camino y vuelven al cancelar */
.§ .§-capa[data-k~="alerta"] .§-ls,.§ .§-capa[data-k~="alerta"] .§-mn{opacity:0!important;pointer-events:none}
.§ .§-capa[data-k~="alerta"] .§-cajon{transform:translateX(-106%)!important}
.§[data-vp="tel"] .§-capa[data-k~="alerta"] .§-ls{transform:translateY(105%)!important}
.§ .§-al-ic{width:48px;height:48px;border-radius:999px;background:var(--tonal);color:var(--tonal-tinta);display:flex;align-items:center;justify-content:center}
.§ .§-al-t{margin-top:14px;font-size:17px;line-height:22px;font-weight:700}
.§ .§-al-m{margin-top:6px;font-size:14px;line-height:20px;color:var(--tinta2)}
.§ .§-al-m strong{color:var(--tinta);font-weight:600}
.§ .§-al-b{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.§ .§-ton,.§ .§-prim{display:flex;align-items:center;justify-content:center;height:44px;padding:0 12px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600;white-space:nowrap}
.§[data-vp="ih"] .§-ton,.§[data-vp="ih"] .§-prim,.§[data-vp="esc"] .§-ton,.§[data-vp="esc"] .§-prim{height:40px;font-size:14px}
.§ .§-ton{background:var(--tonal);color:var(--tonal-tinta)}
.§ .§-prim{background:var(--accion);color:#fff}
/* ---- Aviso breve, arriba y centrado en el área de contenido ---- */
.§ .§-zona{position:absolute;z-index:40;pointer-events:none;top:12px;left:0;right:calc(56px + var(--ir));display:flex;justify-content:center;padding:0 12px}
.§[data-vp="tel"] .§-zona{top:calc(var(--it) + 76px);right:0}
.§[data-vp="ih"] .§-zona{top:16px;right:calc(218px + var(--ir))}
.§[data-vp="iv"] .§-zona{top:calc(var(--it) + 74px);right:0;padding:0 24px}
.§[data-vp="esc"] .§-zona{top:20px;left:248px;right:0;padding:0 24px}
.§ .§-tst{pointer-events:none;display:flex;align-items:center;gap:10px;max-width:420px;min-height:48px;padding:4px 4px 4px 14px;border-radius:16px;background:var(--sup);color:var(--tinta);box-shadow:var(--sombra-capa);font-size:14px;line-height:20px;opacity:0;transform:translateY(-12px);transition:opacity 200ms ease-out,transform 300ms RES_OUT}
.§ .§-tst>svg{color:var(--enlace)}
.§ .§-tst-t{flex:1;min-width:0}
.§ .§-tst-x{width:44px;height:44px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--tinta2)}
.§[data-vp="ih"] .§-tst-x,.§[data-vp="esc"] .§-tst-x{width:36px;height:36px}
.§.§-toast .§-tst{pointer-events:auto;opacity:1;transform:none;transition:opacity 240ms ease-out,transform 480ms RES_IN}
@media (prefers-reduced-motion:reduce){
  .§ .§-ls,.§ .§-al,.§ .§-tst,.§ .§-capa[data-k~="lista"].§-on .§-ls{transform:none!important;transition:opacity 200ms ease}
}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var act='Centro',pend=null,tt=null;
MS.forEach(function(m){
  var capa=m.querySelector('.'+cls('capa')),vp=m.dataset.vp,btns=m.querySelectorAll('.'+cls('cons-b')+',.'+cls('abre-ls'));
  function k(){return (capa.dataset.k||'').split(' ').filter(Boolean)}
  function pon(l){capa.dataset.k=l.join(' ');var on=l.length>0;capa.classList.toggle(cls('on'),on);capa.setAttribute('aria-hidden',String(!on));
    btns.forEach(function(b){if(b.classList.contains(cls('cons-b')))b.setAttribute('aria-expanded',String(l.indexOf('lista')>=0))})}
  m.abreLista=function(){var l=k().filter(function(x){return x!=='alerta'&&x!=='mas'});
    if(vp==='tel'&&l.indexOf('cajon')<0)l.push('cajon');if(vp==='iv'&&l.indexOf('cajon')<0)l.push('cajon');
    if(vp==='ext')l=[];l.push('lista');pon(l);var f=capa.querySelector('.'+cls('co')+'[aria-checked="true"]');if(f)f.focus({preventScroll:true})};
  m.alerta=function(c){pend=c;m.querySelector('.'+cls('al-n')).textContent=c;var l=k();if(l.indexOf('alerta')<0)l.push('alerta');pon(l);
    m.querySelector('.'+cls('al-si')).focus({preventScroll:true})};
  m.cierraTodo=function(){pon([])};
  btns.forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();m.abreLista()})});
  m.querySelectorAll('.'+cls('co')).forEach(function(b){b.addEventListener('click',function(){
    if(b.dataset.c===act){/* el activo solo cierra (:69-72) */var l=k().filter(function(x){return x!=='lista'});pon(vp==='esc'?[]:l);return}
    m.alerta(b.dataset.c)})});
  m.querySelector('.'+cls('al-no')).addEventListener('click',function(){pon(k().filter(function(x){return x!=='alerta'}))});
  m.querySelector('.'+cls('al-si')).addEventListener('click',function(){confirma(pend)});
  m.querySelector('.'+cls('gest')).addEventListener('click',function(){pon([])});
  m.querySelector('.'+cls('tst-x')).addEventListener('click',function(){MS.forEach(function(x){x.classList.remove(cls('toast'))})});
  /* Tocar fuera / Esc: cierra la capa de más arriba (alerta → lista → cajón) */
  capa.querySelector('.'+cls('velo')).addEventListener('click',function(e){e.stopImmediatePropagation();var l=k();l.pop();pon(l)},true);
  capa.querySelector('.'+cls('lw')).addEventListener('click',function(e){if(e.target===e.currentTarget){var l=k();l.pop();pon(l)}});
  m.addEventListener('keydown',function(e){if(e.key==='Escape'&&k().length){e.preventDefault();e.stopImmediatePropagation();var l=k();l.pop();pon(l)}},true);
});
function confirma(c){act=c;MS.forEach(function(m){
  m.querySelectorAll('.'+cls('co')).forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.c===c))});
  m.querySelectorAll('.'+cls('cons-t')+' b.'+cls('m')+',.'+cls('cons-n')).forEach(function(n){n.textContent=c});
  m.querySelectorAll('.'+cls('rot')+' .'+cls('m')).forEach(function(n){n.textContent=c});
  m.querySelector('.'+cls('tst-t')).textContent='Consultorio activo: '+c;m.cierraTodo();m.classList.add(cls('toast'))});
  clearTimeout(tt);tt=setTimeout(function(){MS.forEach(function(m){m.classList.remove(cls('toast'))})},4000)}
tira([[['lista','Abrir el selector'],['alerta','Confirmación'],['aviso','Aviso «Consultorio activo»']],[['reset','Volver a «Centro»']]],function(q){
  MS.forEach(function(m){if(q==='lista')m.abreLista();else if(q==='alerta'){m.abreLista();m.alerta('Hosp Norte')}});
  if(q==='aviso'){confirma('Hosp Norte');clearTimeout(tt)}
  if(q==='reset'){confirma('Centro');clearTimeout(tt);MS.forEach(function(m){m.classList.remove(cls('toast'))})}});
'''

FICHA = ficha(P, 'Selector de consultorio activo', [
    ('Qué es', 'El selector de consultorio activo de hoy (<code>sidebar/ConsultorioActivoSelector.tsx</code>): elige en qué consultorio trabaja el médico; la agenda y los documentos toman ese dato.'),
    ('A quién', 'Solo médico con dos o más consultorios (<code>:62-64</code>). Con uno solo, el botón no se dibuja. La secretaria ve el nombre de la clínica en el mismo sitio (decisión del dashboard aprobado), sin desplegable.'),
    ('Dónde vive', '<b>Computadora / Duo abierto horizontal:</b> el botón «Consultorio · Centro» bajo el logo de la barra lateral. <b>iPhone / Duo abierto vertical:</b> el mismo botón dentro del cajón. <b>Duo cerrado:</b> fila «Consultorio activo · Centro» del menú «Más» (no hay barra lateral).'),
    ('Capas', 'Lista: desplegable de 224 que nace del botón y sin velo en computadora (§21); hoja inferior sobre el cajón en iPhone; tarjeta centrada con velo en Duo (310 en cerrado, 340 en abierto). Filas de 48 (40 en computadora), palomita en el activo, «Gestionar consultorios →» al pie en <code>--enlace</code>. Confirmación: alerta del patrón único, 320/340, icono tonal en círculo de 48, «Cancelar» (tonal) a la izquierda y «Sí, cambiar» (primario) a la derecha, 44 de alto (40 en ancho). Aviso: arriba y centrado en el área de contenido, 4 s.'),
    ('Comportamiento', 'Elegir el activo solo cierra. Elegir otro abre la confirmación; «Sí, cambiar» cambia, cierra todo y avisa «Consultorio activo: X»; «Cancelar» vuelve a la lista. Esc o tocar fuera cierra la capa de más arriba. «Gestionar consultorios →» va a Mi perfil y cierra el menú.'),
    ('Textos (exactos de hoy)', '«Consultorio activo» (<code>:93</code>), «Gestionar consultorios →» (<code>:130</code>), «Cambiar consultorio activo», «¿Cambiar a <b>X</b>?», «Cancelar», «Sí, cambiar» (<code>:140-161</code>), «Consultorio activo: X» (<code>:79</code>). El título de la hoja y de la tarjeta reutiliza «Consultorio activo».'),
    ('Accesibilidad', 'Botón con <code>aria-expanded</code>; lista con <code>role="menu"</code> y opciones <code>menuitemradio</code> con <code>aria-checked</code>; la alerta es <code>alertdialog</code> con título y mensaje enlazados y el foco en «Sí, cambiar»; al cerrar, el foco vuelve al botón.'),
    ('Movimiento', 'Desplegable: escala .96→1 desde el borde del botón. Hoja: sube del borde con resorte (amortiguación 1, respuesta .35 s) y se arrastra hacia abajo para cerrarla. Tarjeta y alerta: escala .96→1 desde el centro. Salida por el mismo camino, más rápida. Reduced motion: fundidos de 200 ms. Reduced transparency: velo opaco.'),
    ('Respecto a hoy', 'Hoy el desplegable es blanco sobre el navy en todos los modos, sus opciones miden 36 y el enlace 32, y la confirmación es un modal genérico con la X bajo la franja. En Duo cerrado no había ningún acceso visible en las maquetas.'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '2-consultorio', 'Selector de consultorio activo',
       'Hoy es un desplegable blanco dentro del menú lateral y un modal genérico; aquí la lista nace del botón en computadora, sube como hoja en iPhone y es tarjeta centrada en Duo (en Duo cerrado se abre desde «Más»), y la confirmación usa la alerta única',
       CSS, marcos, JS, {'p': P}, FICHA)
