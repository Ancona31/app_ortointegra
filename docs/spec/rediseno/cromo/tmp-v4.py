# Vista 4 · Suscripción terminada: banner global (SuscripcionBanner) y modal de bloqueo (BloqueoFeatureModal). Uso: python3 tmp-v4.py
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())

P = 'cr4'
I.update(alerta='<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>')

def banner():
    return f'''<!-- A0·16 · Banner de suscripción (SuscripcionBanner.tsx:35-63; montado en (app)/layout.tsx:172 dentro del área segura). Solo con plan
     bloqueado (cancelada, sin VIP, más de 5 pacientes); lo ven TODOS los roles. Queda fijo arriba del área de contenido mientras ésta se desplaza;
     nunca bajo la franja ni detrás de la navegación. Mismo dibujo que en Facturación (tanda4 vista 3). -->
  <div class="§-ban" role="status"><span class="§-ban-ic">{ic(I["alerta"], 20, 2)}</span>
    <p class="§-ban-t">Tu suscripción terminó. Tienes acceso a tus datos pero no puedes crear nuevos pacientes, consultas ni documentos.</p>
    <a href="#" class="§-p §-ban-b">Reactivar suscripción</a></div>'''

def modal(vp):
    return f'''<!-- A0·17 · BloqueoFeatureModal: lo abre cualquier acción de crear con el plan bloqueado (useInterceptIfBlocked) y, en el menú, «Nuevo paciente»
     de la secretaria y los ocho tipos de documento. Alerta del catálogo (§13/§25), icono ámbar de aviso. Con el administrador, «Reactivar suscripción»
     (rótulo largo de hoy) apila los botones con el principal arriba (§23.3); sin administrar, solo «Cerrar» y la línea extra. -->
<div class="§-alw"><div class="§-al" role="alertdialog" aria-modal="true" aria-labelledby="§-bl-t-{vp}" aria-describedby="§-bl-m-{vp}">
  <span class="§-al-ic">{ic(I["alerta"], 28, 1.8)}</span>
  <h2 class="§-al-t" id="§-bl-t-{vp}">Función no disponible</h2>
  <p class="§-al-sub">Suscripción terminada</p>
  <div class="§-al-m" id="§-bl-m-{vp}" lang="es"><p>Esta es una característica disponible para suscripciones activas. Tu cuenta excedió el límite del plan gratuito.</p>
    <p class="§-noadm">Pídele a tu administrador que reactive la suscripción para recuperar el acceso completo.</p></div>
  <div class="§-al-b"><button type="button" class="§-p §-prim §-adm §-cierra-bl">Reactivar suscripción</button><button type="button" class="§-p §-ton §-cierra-bl">Cerrar</button></div>
</div></div>'''

def accion():
    return ('<!-- Acción de crear de la pantalla de fondo: con el plan bloqueado no navega, abre el modal. -->'
            f'<div class="§-acc"><button type="button" class="§-p §-tonb §-abre-bl">{ic(I["plus"], 18, 2.2)}<span class="§-m">Nueva consulta</span><span class="§-s">Nuevo paciente</span></button></div>')

def marco(vp):
    f = fondo(vp).replace('<div class="§-top">', banner() + '\n  <div class="§-top">', 1)
    if vp != 'ext':
        f = f.replace('</h1></div>', '</h1></div>\n  ' + accion(), 1)
    if vp == 'ext':
        app = f + riel('inicio').replace('class="§-p §-masb', 'class="§-p §-abre-bl §-masb')
    elif vp == 'tel':
        app = encabezado('Inicio') + f
    elif vp == 'iv':
        app = enc_iv('Inicio') + f
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("inicio")}\n</nav>'
        app = (f + latn) if vp == 'ih' else (latn + f)
    app = app.replace(' data-abre="mas"', '').replace(' data-abre="cajon"', '')
    capa = f'<div class="§-capa" aria-hidden="true">\n  <div class="§-velo"></div>\n{modal(vp)}\n</div>'
    return f'<div class="marco § §-admin" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capa}\n</div>'

CSS = '''
/* ---- Banner ---- */
.§ .§-cont{padding-top:0!important}
.§ .§-ban{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;margin:0 -4px;padding:12px 12px 12px 14px;border-radius:0 0 16px 16px;background:var(--ag-fondo);color:var(--tinta);box-shadow:0 0 0 12px var(--fondo)}
.§[data-vp="ih"] .§-ban,.§[data-vp="iv"] .§-ban,.§[data-vp="esc"] .§-ban{flex-wrap:nowrap;padding:12px 12px 12px 16px;border-radius:0 0 18px 18px;margin:0}
.§[data-vp="ext"] .§-ban,.§[data-vp="tel"] .§-ban{margin-top:12px;border-radius:16px}
.§ .§-ban+.§-top{margin-top:4px}
.§ .§-ban-ic{width:32px;height:32px;flex:none;border-radius:999px;background:color-mix(in srgb,var(--ag-punto) 20%,transparent);color:var(--ag-tinta);display:flex;align-items:center;justify-content:center;align-self:flex-start}
.§ .§-ban-t{flex:1 1 0;min-width:0;font-size:14px;line-height:20px;text-align:justify;hyphens:auto}
.§ .§-ban-b{position:relative;flex:none;display:flex;align-items:center;justify-content:center;height:36px;padding:0 14px;border-radius:10px;background:var(--ag-tinta);color:var(--ag-fondo);font-size:14px;line-height:18px;font-weight:600;white-space:nowrap}
.§ .§-ban-b::after{content:"";position:absolute;inset:-4px 0}
.§[data-vp="ext"] .§-ban-t,.§[data-vp="tel"] .§-ban-t{flex:1 1 calc(100% - 50px)}
.§[data-vp="ext"] .§-ban-b,.§[data-vp="tel"] .§-ban-b{margin-left:44px}
.§[data-vp="ih"] .§-ban-b::after,.§[data-vp="esc"] .§-ban-b::after{display:none}
/* ---- Acción de crear del fondo ---- */
.§ .§-acc{display:flex}
.§ .§-tonb{position:relative;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:12px;background:var(--tonal);color:var(--tonal-tinta);font-size:15px;line-height:20px;font-weight:600}
.§ .§-tonb::after{content:"";position:absolute;inset:-2px 0}
.§[data-vp="ih"] .§-tonb,.§[data-vp="esc"] .§-tonb{height:36px;font-size:14px}
/* ---- Modal de bloqueo (alerta del catálogo) ---- */
.§ .§-alw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-alw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="tel"] .§-alw{padding:calc(var(--it) + 64px) 16px calc(var(--ib) + 16px)}
.§[data-vp="ih"] .§-alw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="iv"] .§-alw{padding:calc(var(--it) + 58px) 24px 24px}
.§[data-vp="esc"] .§-alw{padding:32px 24px 32px calc(248px + 24px)}
.§ .§-al{pointer-events:auto;width:320px;max-width:100%;padding:24px;border-radius:20px;background:var(--sup);color:var(--tinta);box-shadow:var(--sombra-capa);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:scale(.96);transition:opacity 180ms ease-out,transform 300ms RES_OUT}
.§[data-vp="ih"] .§-al,.§[data-vp="iv"] .§-al,.§[data-vp="esc"] .§-al{width:340px}
.§ .§-capa.§-on .§-al{opacity:1;transform:none;transition:opacity 220ms ease-out,transform 480ms RES_IN}
.§ .§-al-ic{width:48px;height:48px;border-radius:999px;background:var(--ag-fondo);color:var(--ag-tinta);display:flex;align-items:center;justify-content:center}
.§ .§-al-t{margin-top:14px;font-size:17px;line-height:22px;font-weight:700}
.§ .§-al-sub{margin-top:2px;font-size:13px;line-height:18px;font-weight:600;color:var(--ag-tinta)}
.§ .§-al-m{margin-top:10px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:20px;color:var(--tinta2);text-align:justify;hyphens:auto}
.§ .§-al-b{margin-top:20px;display:flex;flex-direction:column;gap:8px;width:100%}
.§ .§-ton,.§ .§-prim{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600}
.§[data-vp="ih"] .§-ton,.§[data-vp="ih"] .§-prim,.§[data-vp="esc"] .§-ton,.§[data-vp="esc"] .§-prim{min-height:40px;font-size:14px}
.§ .§-ton{background:var(--tonal);color:var(--tonal-tinta)}
.§ .§-prim{background:var(--accion);color:#fff}
.§.§-admin .§-noadm,.§:not(.§-admin) .§-adm{display:none}
@media (prefers-reduced-motion:reduce){.§ .§-al{transform:none!important;transition:opacity 200ms ease}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var st={admin:true,sec:false};
function aplica(){MS.forEach(function(m){m.classList.toggle(cls('admin'),st.admin&&!st.sec);m.classList.toggle(cls('sec'),st.sec)})}
MS.forEach(function(m){var c=m.querySelector('.'+cls('capa')),orig=null;
  m.abreBl=function(o){orig=o||null;c.classList.add(cls('on'));c.setAttribute('aria-hidden','false');var b=c.querySelector('.'+cls('al-b')+' button:not([style*="none"])');
    var vis=[].slice.call(c.querySelectorAll('.'+cls('al-b')+' button')).filter(function(x){return getComputedStyle(x).display!=='none'})[0];if(vis)vis.focus({preventScroll:true})};
  function cierra(){c.classList.remove(cls('on'));c.setAttribute('aria-hidden','true');if(orig&&orig.offsetParent)orig.focus({preventScroll:true})}
  m.querySelectorAll('.'+cls('abre-bl')).forEach(function(b){b.addEventListener('click',function(){m.abreBl(b)})});
  m.querySelectorAll('.'+cls('cierra-bl')).forEach(function(b){b.addEventListener('click',cierra)});
  c.querySelector('.'+cls('velo')).addEventListener('click',cierra);
  m.addEventListener('keydown',function(e){if(e.key==='Escape'&&c.classList.contains(cls('on'))){e.preventDefault();cierra()}});
});
var T=tira([[['adm','Administrador',true],['inv','Médico invitado',false],['sec','Secretaria',false]],[['abre','Abrir el bloqueo']]],function(k){
  if(k==='abre'){MS.forEach(function(m){m.abreBl()});return}
  st.admin=k==='adm';st.sec=k==='sec';aplica();
  T.querySelectorAll('button[aria-pressed]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.k===k))})});
aplica();
'''

FICHA = ficha(P, 'Suscripción terminada', [
    ('Qué es', 'Dos piezas globales del cobro: el banner <code>SuscripcionBanner</code> (fijo arriba en todas las pantallas de la app) y el modal <code>BloqueoFeatureModal</code> (sale en lugar de navegar cuando se intenta crear algo).'),
    ('Cuándo', 'Solo con plan bloqueado: suscripción cancelada, sin VIP y más de 5 pacientes activos (<code>lib/subscription.ts</code>). Las clínicas gratuitas de buena fe (≤ 5 pacientes) no ven nada. Lo resuelve el servidor en <code>(app)/layout.tsx</code>.'),
    ('A quién', 'El banner, a todos los roles. El modal cambia por permiso: quien administra la clínica (médico admin) ve «Reactivar suscripción»; el médico invitado y la secretaria ven en su lugar «Pídele a tu administrador…» y solo «Cerrar».'),
    ('Banner · medidas', 'Fondo <code>--ag-fondo</code> (el mismo ámbar del sistema que el aviso de perfil), icono de aviso en círculo de 32, texto 14/20 justificado, botón «Reactivar suscripción» de 36 (área 44 en táctiles) con fondo <code>--ag-tinta</code>. En ancho, una fila pegada al borde superior del área de contenido; en teléfono y Duo cerrado, tarjeta con el botón bajo el texto. Fijo (sticky) mientras el contenido se desplaza; nunca bajo la franja ni la barra de estado (hoy lo protege el relleno de área segura de <code>layout.tsx:172</code>).'),
    ('Modal · medidas', 'Alerta del catálogo: 320 (teléfono, Duo cerrado) / 340 (resto), radio 20, relleno 24, icono ámbar 28 en círculo de 48, título 17/700, subtítulo «Suscripción terminada» 13/600 en <code>--ag-tinta</code>, mensaje 14/20 justificado. Botones apilados a todo el ancho (el rótulo «Reactivar suscripción» es largo, §23.3): principal arriba, «Cerrar» tonal debajo. Sin administrar: solo «Cerrar».'),
    ('Textos (exactos de hoy)', '«Tu suscripción terminó. Tienes acceso a tus datos pero no puedes crear nuevos pacientes, consultas ni documentos.», «Reactivar suscripción» (<code>SuscripcionBanner.tsx:50-58</code>); «Función no disponible», «Suscripción terminada», «Esta es una característica disponible para suscripciones activas. Tu cuenta excedió el límite del plan gratuito.», «Pídele a tu administrador que reactive la suscripción para recuperar el acceso completo.», «Cerrar», «Reactivar suscripción» (<code>BloqueoFeatureModal.tsx:92-127</code>).'),
    ('Comportamiento', 'Banner → <code>/billing</code>. Modal: «Reactivar suscripción» cierra y va a <code>/billing</code>; «Cerrar», Esc o tocar fuera cierran y el foco vuelve a la acción que lo abrió.'),
    ('Accesibilidad', 'Banner <code>role="status"</code>; modal <code>alertdialog</code> con título y mensaje enlazados y foco en el primer botón.'),
    ('Movimiento', 'El banner no se anima (aparece con la página). Modal: escala .96→1 desde el centro con resorte (amortiguación 1, respuesta .35 s); salida más rápida. Reduced motion: fundido de 200 ms. Reduced transparency: velo opaco.'),
    ('Respecto a hoy', 'Hoy el banner usa los ámbar de Tailwind y en escritorio se desplaza con un margen fijo; el modal es un <code>ModalShell</code> con botones de texto gris. Aquí ambos usan los tokens y el patrón de alerta del sistema.'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '4-suscripcion', 'Suscripción terminada (banner y bloqueo)',
       'El banner de suscripción solo estaba dibujado dentro de Facturación y el modal de bloqueo en ninguna parte; aquí el banner queda fijo arriba del área de contenido en los cinco marcos y para todos los roles, y el bloqueo usa la alerta del catálogo con su variante para quien no administra',
       CSS, marcos, JS, {'p': P}, FICHA)
