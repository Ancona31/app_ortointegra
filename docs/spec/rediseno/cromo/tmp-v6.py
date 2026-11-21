# Vista 6 · Cerrar sesión: reposo, mientras cierra, aviso de revocación no confirmada y confirmación (propuesta). Uso: python3 tmp-v6.py
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())
P = 'cr6'
I.update(xcirc='<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>')
REVOC = ('Sesión cerrada en este navegador, pero el servidor no confirmó la revocación: puede seguir abierta en otros dispositivos. '
         'Cambia la contraseña para cerrarlas todas.')

def contenido(vp):
    return f'''<main class="§-cont">
  <div class="§-top"><h1 class="§-h1">Mi perfil</h1></div>
  <!-- Fondo: Mi perfil (tanda4 vista 1) reducido a su grupo «Ajustes», que es donde el médico cierra sesión. La secretaria tiene las mismas
       tres filas en su menú «Ajustes» (vista 5) y el comportamiento es idéntico. -->
  <section class="§-tj" aria-hidden="true"><h2 class="§-tt">Datos profesionales</h2><div class="§-fl"><span class="§-fl-t"><span class="§-br" style="width:50%"></span><span class="§-br §-br2" style="width:70%"></span></span></div><div class="§-fl"><span class="§-fl-t"><span class="§-br" style="width:40%"></span><span class="§-br §-br2" style="width:60%"></span></span></div></section>
  <section class="§-ajs" aria-label="Ajustes"><h2 class="§-ajt">{ic(I["ajustes"], 18)}Ajustes</h2>
    <div class="§-ajc">
      <button type="button" role="switch" aria-checked="false" class="§-p §-ajf">{ic(I["luna"], 20)}<span>Modo oscuro</span><span class="§-sw" aria-hidden="true"></span></button>
      <a href="#" class="§-p §-ajf">{ic(I["escudo"], 20)}<span>Aviso de Privacidad</span>{ic(I["externo"], 16, 2)}</a>
      <!-- A0·10 · Cerrar sesión (Sidebar.tsx:423-488): registra la salida en audit_log (con await) y luego cierra; navega a /login. -->
      <button type="button" class="§-p §-ajf §-salir"><span class="§-ic-s">{ic(I["salir"], 20)}</span><span class="§-gira" aria-hidden="true"></span><span>Cerrar sesión</span></button>
    </div>
  </section>
</main>'''

def capas(vp):
    return f'''<div class="§-capa" aria-hidden="true"><div class="§-velo"></div>
  <!-- PROPUESTA, NO EXISTE HOY: confirmación antes de cerrar sesión. Hoy el botón cierra directamente. Solo textos que ya existen. -->
  <div class="§-alw"><div class="§-al" role="alertdialog" aria-modal="true" aria-labelledby="§-cs-{vp}">
    <span class="§-al-ic">{ic(I["salir"], 28, 1.8)}</span><h2 class="§-al-t" id="§-cs-{vp}">Cerrar sesión</h2>
    <div class="§-al-b"><button type="button" class="§-p §-ton §-no">Cancelar</button><button type="button" class="§-p §-dest §-si">Cerrar sesión</button></div>
  </div></div>
</div>
<!-- Aviso de error (Sidebar.tsx:483) arriba y centrado en el área de contenido, con el patrón de pub-capas vista 5. -->
<div class="§-zona" aria-live="assertive"><div class="§-tst" role="alert">{ic(I["xcirc"], 20, 2)}<p class="§-tst-t" lang="es">{REVOC}</p>
  <button type="button" class="§-p §-tst-x" aria-label="Cerrar aviso">{ic(I["x"], 18, 2)}</button></div></div>'''

def marco(vp):
    c = contenido(vp)
    if vp == 'ext':
        app = c + riel('')
    elif vp == 'tel':
        app = encabezado('Mi perfil') + c
    elif vp == 'iv':
        app = enc_iv('') + c
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("")}\n</nav>'.replace('class="§-p §-li §-yo §-m"', 'class="§-p §-li §-yo §-m" aria-current="page"')
        app = (c + latn) if vp == 'ih' else (latn + c)
    app = app.replace(' data-abre="mas"', '').replace(' data-abre="cajon"', '')
    return f'<div class="marco §" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capas(vp)}\n</div>'

CSS = '''
.§ .§-env .§-av.§-m,.§ .§-enc .§-av.§-m{box-shadow:0 0 0 3px var(--accion)}
.§ .§-lat-pie .§-yo[aria-current="page"]{background:var(--accion);color:#fff}
.§ .§-lat-pie .§-yo[aria-current="page"] small{color:#fff!important;opacity:.85}
.§[data-vp="esc"] .§-cont,.§[data-vp="ih"] .§-cont,.§[data-vp="iv"] .§-cont{align-items:center}
.§[data-vp="esc"] .§-cont>*,.§[data-vp="ih"] .§-cont>*,.§[data-vp="iv"] .§-cont>*{width:100%;max-width:640px}
.§ .§-ajs{display:flex;flex-direction:column;gap:8px}
.§ .§-ajt{display:flex;align-items:center;gap:6px;padding:0 4px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--enlace)}
.§ .§-ajc{background:var(--sup);border-radius:16px;padding:4px 16px}
.§[data-vp="ih"] .§-ajc,.§[data-vp="iv"] .§-ajc,.§[data-vp="esc"] .§-ajc{border-radius:18px;padding:4px 20px}
.§ .§-ajf{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:52px;font-size:15px;line-height:20px;color:var(--tinta);text-align:left}
.§[data-vp="esc"] .§-ajf,.§[data-vp="ih"] .§-ajf{min-height:48px}
.§ .§-ajf+.§-ajf{border-top:1px solid var(--linea)}
.§ .§-ajf>span:not(.§-sw):not(.§-ic-s):not(.§-gira){flex:1}
.§ .§-ajf>svg:first-child,.§ .§-ajf>svg:last-child{color:var(--tinta2)}
.§ .§-sw{width:44px;height:26px;flex:none;border-radius:999px;background:var(--sup2);position:relative}
.§ .§-sw::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.§ .§-salir,.§ .§-salir .§-ic-s{color:var(--mal-tinta)}
.§ .§-ic-s{display:flex}
/* Mientras cierra: el giro ocupa el sitio del icono; las tres filas quedan inertes. Sin texto nuevo. */
.§ .§-gira{display:none;width:20px;height:20px;flex:none;border-radius:999px;border:2.2px solid color-mix(in srgb,var(--mal-tinta) 25%,transparent);border-top-color:var(--mal-tinta);animation:§-gira .8s linear infinite}
@keyframes §-gira{to{transform:rotate(360deg)}}
.§.§-cerrando .§-gira{display:block}
.§.§-cerrando .§-ic-s{display:none}
.§.§-cerrando .§-ajf:not(.§-salir){opacity:.45}
.§.§-cerrando .§-ajc{pointer-events:none}
/* ---- Confirmación (propuesta) ---- */
.§ .§-alw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-alw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="tel"] .§-alw{padding:calc(var(--it) + 64px) 16px calc(var(--ib) + 16px)}
.§[data-vp="ih"] .§-alw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="iv"] .§-alw{padding:calc(var(--it) + 58px) 24px 24px}
.§[data-vp="esc"] .§-alw{padding:32px 24px 32px calc(248px + 24px)}
.§ .§-al{pointer-events:auto;width:320px;max-width:100%;padding:24px;border-radius:20px;background:var(--sup);color:var(--tinta);box-shadow:var(--sombra-capa);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:scale(.96);transition:opacity 180ms ease-out,transform 300ms RES_OUT}
.§[data-vp="ih"] .§-al,.§[data-vp="iv"] .§-al,.§[data-vp="esc"] .§-al{width:340px}
.§ .§-capa.§-on .§-al{opacity:1;transform:none;transition:opacity 220ms ease-out,transform 480ms RES_IN}
.§ .§-al-ic{width:48px;height:48px;border-radius:999px;background:var(--mal-fondo);color:var(--mal-tinta);display:flex;align-items:center;justify-content:center}
.§ .§-al-t{margin-top:14px;font-size:17px;line-height:22px;font-weight:700}
.§ .§-al-b{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.§ .§-ton,.§ .§-dest{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 12px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600;white-space:nowrap}
.§[data-vp="ih"] .§-ton,.§[data-vp="ih"] .§-dest,.§[data-vp="esc"] .§-ton,.§[data-vp="esc"] .§-dest{min-height:40px;font-size:14px}
.§ .§-ton{background:var(--tonal);color:var(--tonal-tinta)}
.§ .§-dest{background:var(--mal-fondo);color:var(--mal-tinta)}
/* ---- Aviso de error ---- */
.§ .§-zona{position:absolute;z-index:40;pointer-events:none;top:12px;left:0;right:calc(56px + var(--ir));display:flex;justify-content:center;padding:0 12px}
.§[data-vp="tel"] .§-zona{top:calc(var(--it) + 76px);right:0}
.§[data-vp="ih"] .§-zona{top:16px;right:calc(218px + var(--ir))}
.§[data-vp="iv"] .§-zona{top:calc(var(--it) + 74px);right:0;padding:0 24px}
.§[data-vp="esc"] .§-zona{top:20px;left:248px;right:0;padding:0 24px}
.§ .§-tst{pointer-events:none;display:flex;align-items:flex-start;gap:10px;max-width:460px;padding:12px 4px 12px 14px;border-radius:16px;background:var(--sup);color:var(--tinta);box-shadow:var(--sombra-capa),inset 3px 0 0 var(--mal-tinta);font-size:14px;line-height:20px;opacity:0;transform:translateY(-12px);transition:opacity 200ms ease-out,transform 300ms RES_OUT}
.§ .§-tst>svg{color:var(--mal-tinta);margin-top:0}
.§ .§-tst-t{flex:1;min-width:0}
.§ .§-tst-x{width:44px;height:44px;flex:none;margin:-12px 0;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--tinta2)}
.§[data-vp="ih"] .§-tst-x,.§[data-vp="esc"] .§-tst-x{width:36px;height:36px;margin:-8px 0}
.§.§-error .§-tst{pointer-events:auto;opacity:1;transform:none;transition:opacity 240ms ease-out,transform 480ms RES_IN}
@media (prefers-reduced-motion:reduce){.§ .§-al,.§ .§-tst{transform:none!important;transition:opacity 200ms ease}.§ .§-gira{animation-duration:2.4s}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var conf=false;
MS.forEach(function(m){var c=m.querySelector('.'+cls('capa')),sal=m.querySelector('.'+cls('salir'));
  m.cerrar=function(revoca){m.classList.remove(cls('error'));m.classList.add(cls('cerrando'));sal.setAttribute('aria-busy','true');
    /* En la app: await audit-login → signOut() → limpiezas → router.push('/login'). Aquí se simula la espera. */
    setTimeout(function(){m.classList.remove(cls('cerrando'));sal.removeAttribute('aria-busy');if(!revoca)m.classList.add(cls('error'))},1600)};
  sal.addEventListener('click',function(){if(conf){c.classList.add(cls('on'));c.setAttribute('aria-hidden','false');m.querySelector('.'+cls('si')).focus({preventScroll:true})}else m.cerrar(false)});
  function cierra(){c.classList.remove(cls('on'));c.setAttribute('aria-hidden','true');sal.focus({preventScroll:true})}
  m.querySelector('.'+cls('no')).addEventListener('click',cierra);c.querySelector('.'+cls('velo')).addEventListener('click',cierra);
  m.querySelector('.'+cls('si')).addEventListener('click',function(){c.classList.remove(cls('on'));c.setAttribute('aria-hidden','true');m.cerrar(false)});
  m.querySelector('.'+cls('tst-x')).addEventListener('click',function(){m.classList.remove(cls('error'))});
  m.querySelector('[role="switch"]').addEventListener('click',function(e){var b=e.currentTarget;b.setAttribute('aria-checked',String(b.getAttribute('aria-checked')!=='true'))});
  m.addEventListener('keydown',function(e){if(e.key==='Escape'&&c.classList.contains(cls('on'))){e.preventDefault();cierra()}});
});
var T=tira([[['reposo','Reposo'],['cerrando','Mientras cierra'],['error','Revocación no confirmada']],[['conf','Propuesta: confirmar antes de cerrar',false]]],function(k,x){
  MS.forEach(function(m){m.classList.remove(cls('cerrando'),cls('error'));var c=m.querySelector('.'+cls('capa'));c.classList.remove(cls('on'))});
  if(k==='cerrando')MS.forEach(function(m){m.classList.add(cls('cerrando'))});
  if(k==='error')MS.forEach(function(m){m.classList.add(cls('error'))});
  if(k==='conf'){conf=!conf;x.setAttribute('aria-pressed',String(conf));if(conf)MS.forEach(function(m){var c=m.querySelector('.'+cls('capa'));c.classList.add(cls('on'));c.setAttribute('aria-hidden','false')})}});
'''

FICHA = ficha(P, 'Cerrar sesión', [
    ('Qué es', '«Cerrar sesión» (<code>Sidebar.tsx:804-808, 423-488</code>). Médico: en Mi perfil → Ajustes (aprobado, §23.11). Secretaria: en su menú «Ajustes» (vista 5, CALMA §28).'),
    ('Qué pasa hoy', '1) Registra la salida en <code>audit_log</code> (<code>POST /api/auth/audit-login</code>, con <code>await</code>); 2) <code>signOut()</code> borra siempre cookies y almacenamiento local; 3) vacía cachés (perfil cifrado, Google, citas, semillas); 4) si el servidor de Auth no confirmó la revocación, aviso de error; 5) navega a <code>/login</code>. No hay confirmación previa ni indicador de espera.'),
    ('Mientras cierra', 'La fila queda inerte y su icono se cambia por un giro del mismo rojo (<code>aria-busy="true"</code>); las otras dos filas bajan a 45 % de opacidad. Sin texto nuevo. Hoy no hay nada: si el registro de auditoría tarda, el botón no responde a la vista.'),
    ('Aviso de revocación', 'Texto exacto: «' + REVOC + '» (<code>:483</code>). Aviso de error del patrón de <code>pub-capas</code> 5: arriba y centrado en el área de contenido, icono y filo en <code>--mal-tinta</code>, texto 14/20 (sin justificar: en 300 px abría ríos), botón de cerrar de 44 (36 en ancho), <code>role="alert"</code>. No dice «inténtalo de nuevo» a propósito (un segundo intento devolvería éxito sin revocar nada, <code>:471-476</code>).'),
    ('Defecto conocido y propuesta', 'Hoy ese aviso «puede alcanzar a verse solo un instante»: la navegación a <code>/login</code> desmonta el proveedor de avisos (<code>:477-481</code>). Propuesta: que no caduque a los 4 s y que viaje a <code>/login</code>, porque pide una acción (cambiar la contraseña). Es cambio de funcionamiento, no de diseño.'),
    ('Confirmación (PROPUESTA)', 'No existe hoy. Si el dueño la quiere: alerta del catálogo con icono rojo suave, título «Cerrar sesión» y dos botones parejos «Cancelar» (tonal) / «Cerrar sesión» (destructivo suave). Solo textos que ya existen. Se activa en la tira; por defecto la maqueta se comporta como hoy.'),
    ('Movimiento', 'Aviso: baja 12 px y funde con resorte (amortiguación 1, respuesta .35 s), sube al cerrarlo. Alerta: escala .96→1 desde el centro. Giro: 0,8 s por vuelta (más lento con reduced-motion, sin desaparecer: comunica espera).'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '6-sesion', 'Cerrar sesión',
       'Hoy el botón no da señal mientras cierra y el aviso de que la sesión pudo quedar abierta en otros dispositivos se ve un instante; aquí la fila muestra la espera, el aviso usa el patrón de error del catálogo con su texto exacto, y la confirmación previa queda como propuesta',
       CSS, marcos, JS, {'p': P}, FICHA)
