# Vista 3 · Paleta de comandos / buscador global (CommandPalette). Uso: python3 tmp-v3.py
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())

P = 'cr3'
I.update(
    lupa='<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    volver='<path d="m15 6-6 6 6 6"/>',
    nuevo='<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6"/>',
    receta='<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    docx='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    aviso='<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    palomita='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
)
# Avatares: pasteles de la maqueta aprobada (dashboard-final, AV)
AV = [('#F1DCEC', '#7A2E6B'), ('#DCE8F6', '#24497A'), ('#DDEFE3', '#1F5A39'), ('#F6D8D1', '#8A2F1F'), ('#EBDCCB', '#5A3A1A'), ('#E4E0F5', '#463A86')]
PAC = [('01', '34 años', 'Femenino'), ('02', '41 años', 'Masculino'), ('03', '58 años', 'Femenino'), ('04', '27 años', 'Masculino'), ('05', '63 años', 'Femenino'), ('07', '54 años', 'Femenino')]

def campo(vp):
    kbd = '<kbd class="§-kbd" aria-hidden="true">⌘K</kbd>' if vp in ('ih', 'esc') else ''
    return (f'<!-- Origen de la capa: el campo del dashboard aprobado (función 4); en computadora también Ctrl/⌘+K desde cualquier pantalla. -->'
            f'<button type="button" class="§-p §-campo §-abre-pal">{ic(I["lupa"], 18, 2)}<span>Buscar paciente o folio</span>{kbd}</button>')

def res_pac():
    out = ''
    for i, (n, e, s) in enumerate(PAC):
        bg, fg = AV[i % len(AV)]
        out += (f'<li role="none" data-n="{n}"><button type="button" role="option" aria-selected="{str(i == 0).lower()}" class="§-p §-r">'
                f'<span class="§-avp" style="background:{bg};color:{fg}">{n}</span><span class="§-r-t"><span class="§-r-n">Paciente Prueba {n}</span>'
                f'<span class="§-r-s">{e} · {s} · EXP-2026-00{n}</span></span>{ic(I["sig"], 16, 2.2, MOF)}</button></li>')
    return out

def paleta(vp):
    tec = '<p class="§-tec"><kbd>↑↓</kbd> navegar <kbd>↵</kbd> abrir <kbd>Esc</kbd> cerrar</p>' if vp in ('ih', 'esc') else ''
    asa = '<span class="§-asa" aria-hidden="true"></span>' if vp == 'tel' else ''
    return f'''<!-- A0·14–15 · Paleta de comandos (CommandPalette.tsx). Un solo campo busca paciente por nombre o documento por folio: el modo lo decide
     la forma de lo escrito («RX-2026-0042» es folio). ↑↓ mueve, Enter abre, Esc cierra (también Ctrl/⌘+K, que alterna).
     Computadora y Duo abierto: tarjeta de 560/520 anclada arriba (los resultados cambian de alto y así no salta). Duo cerrado: tarjeta centrada (§26).
     iPhone: hoja alta desde abajo. -->
<div class="§-pw"><div class="§-pal" role="dialog" aria-modal="true" aria-label="Buscar paciente o folio">{asa}
  <div class="§-vb">
    <label class="§-bus">{ic(I["lupa"], 18, 2)}<input type="search" class="§-q" placeholder="Buscar paciente por nombre o documento por folio..." aria-label="Buscar paciente por nombre o documento por folio" autocomplete="off">
      <button type="button" class="§-p §-ib2 §-cierra-pal" aria-label="Cerrar">{ic(I["x"], 18, 2)}</button></label>
    <div class="§-cuerpo">
      <!-- Vacío: la pista de siempre -->
      <p class="§-pista2 §-e-vacia">Nombre del paciente, o folio del documento</p>
      <!-- Pacientes: avatar, nombre, edad · sexo · expediente -->
      <ul class="§-res §-e-res" role="listbox" aria-label="Pacientes">{res_pac()}</ul>
      <!-- Folio: un documento con su tipo (color de tipo, CALMA §9), paciente y fecha; abre los documentos de ese paciente -->
      <ul class="§-res §-e-folio" role="listbox" aria-label="Documento"><li role="none"><button type="button" role="option" aria-selected="true" class="§-p §-r">
        <span class="§-doc" style="color:var(--d-receta)">{ic(I["receta"], 20)}</span><span class="§-r-t"><span class="§-r-n"><span class="§-folio">RX-2026-0042</span> · Receta médica</span>
        <span class="§-r-s">Paciente Prueba 07 · 12 nov 2026</span></span>{ic(I["sig"], 16, 2.2, MOF)}</button></li></ul>
      <!-- Folio sin resultado: el vacío se desambigua (CommandPalette.tsx:375-389) -->
      <div class="§-nada §-e-sinfolio">{ic(I["docx"], 28, 1.6)}<p class="§-nada-t">Sin resultados para "RX-2026-0999"</p>
        <p class="§-nada-s">Ningún documento tuyo con ese folio. Los emitidos antes del folio correlativo no se encuentran por aquí.</p></div>
      <!-- Sin coincidencias suficientes: opción de registro rápido (≥ 2 caracteres, no folio, < 8 resultados) -->
      <ul class="§-res §-e-crear" role="listbox" aria-label="Crear"><li role="none"><button type="button" role="option" aria-selected="true" class="§-p §-r §-crear">
        <span class="§-avn">{ic(I["nuevo"], 20)}</span><span class="§-r-t"><span class="§-r-n">Crear registro para: <b class="§-cq">"Paciente Prueba 26"</b></span>
        <span class="§-r-s">Registro rápido — solo nombre, teléfono y motivo</span></span>{ic(I["sig"], 16, 2.2, MOF)}</button></li></ul>
    </div>
    {tec}
  </div>
  <form class="§-vf" novalidate>
    <div class="§-fcab"><button type="button" class="§-p §-ib2 §-volver" aria-label="Volver a la búsqueda">{ic(I["volver"], 20, 2.2)}</button>
      <div class="§-fcab-t"><h2>Registro rápido</h2><p>Puedes completar el expediente después</p></div>
      <button type="button" class="§-p §-ib2 §-cierra-pal" aria-label="Cerrar">{ic(I["x"], 18, 2)}</button></div>
    <div class="§-par"><label class="§-f"><span>Nombre *</span><input type="text" class="§-in" value="Paciente Prueba" autocomplete="off"></label>
      <label class="§-f"><span>Apellidos</span><input type="text" class="§-in" value="26" autocomplete="off"></label></div>
    <label class="§-f"><span>Fecha de nacimiento *</span><input type="date" class="§-in" value="1980-05-14" max="2026-11-19"></label>
    <!-- Texto de hoy, con la cita a la ley de 2010 abrogada (deuda ya anotada en ESTADO.md): se reproduce, no se corrige aquí. Casilla a la derecha (CALMA §20). -->
    <label class="§-chk"><span>El paciente ha leído y acepta el <a href="#" class="§-enl">Aviso de Privacidad</a> (LFPDPPP Art. 9) *</span><input type="checkbox" checked><span class="§-caja" aria-hidden="true">{ic(I["palomita"], 16, 3)}</span></label>
    <div class="§-pieh"><button type="button" class="§-p §-ton §-volver">Cancelar</button><button type="button" class="§-p §-prim §-crea">{ic(I["nuevo"], 18)}Crear e ir al expediente</button></div>
  </form>
</div></div>
<!-- Duplicado (CommandPalette.tsx:428-462) con la alerta del catálogo y el título aprobado «Paciente duplicado» (CALMA §20, §23.7):
     tres botones apilados, principal arriba. -->
<div class="§-alw"><div class="§-al" role="alertdialog" aria-modal="true" aria-labelledby="§-dup-VP">
  <span class="§-al-ic">{ic(I["aviso"], 28, 1.8)}</span><h2 class="§-al-t" id="§-dup-VP">Paciente duplicado</h2>
  <!-- Botón acortado a «Es otra persona» (texto nuevo aprobado, informes/botones-desbordados.md §5); la consecuencia pasa al cuerpo con las palabras de hoy. -->
  <p class="§-al-m">Este paciente ya está en tu lista de pacientes: <strong>Paciente Prueba 07</strong> (Exp. #EXP-2026-0007). Si es otra persona, se creará el registro de todos modos.</p>
  <div class="§-al-b"><button type="button" class="§-p §-prim §-dup-x">Ir a su expediente</button><button type="button" class="§-p §-ton §-dup-x">Es otra persona</button><button type="button" class="§-p §-quieto §-dup-c">Cancelar</button></div>
</div></div>'''

def marco(vp):
    f = fondo(vp).replace('</h1></div>', '</h1></div>\n  ' + campo(vp), 1)
    if vp == 'ext':
        app = f + riel('inicio')
    elif vp == 'tel':
        app = encabezado('Inicio') + f
    elif vp == 'iv':
        app = enc_iv('Inicio') + f
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("inicio")}\n</nav>'
        app = (f + latn) if vp == 'ih' else (latn + f)
    capa = f'<div class="§-capa" aria-hidden="true">\n  <div class="§-velo"></div>\n{paleta(vp).replace("VP", vp)}\n</div>'
    app = app.replace(' data-abre="mas"', '').replace(' data-abre="cajon"', '')  # el menú y «Más» se ven en las vistas 1 y 2
    return f'<div class="marco § §-e1" data-vp="{vp}">\n<div class="§-app">\n{app}\n</div>\n{capa}\n</div>'

MOF = ' class="§-mo-f"'

CSS = '''
.§ .§-campo{display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:0 12px;border-radius:12px;background:var(--sup2);color:var(--tinta2);font-size:16px;line-height:20px;text-align:left}
.§[data-vp="esc"] .§-campo,.§[data-vp="ih"] .§-campo{max-width:480px;font-size:15px}
.§ .§-campo>span{flex:1}
.§ .§-kbd{height:24px;padding:0 6px;border-radius:6px;background:var(--sup);color:var(--tinta2);font:600 12px/24px var(--fuente)}
/* ---- Paleta ---- */
.§ .§-pw{position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start;pointer-events:none}
.§[data-vp="esc"] .§-pw{padding:72px 24px 32px calc(248px + 24px)}
.§[data-vp="ih"] .§-pw{padding:40px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="iv"] .§-pw{padding:calc(var(--it) + 72px) 24px 24px}
.§[data-vp="ext"] .§-pw{align-items:center;padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="tel"] .§-pw{align-items:flex-end;padding:calc(var(--it) + 12px) 0 0}
.§ .§-pal{pointer-events:auto;position:relative;display:flex;flex-direction:column;width:560px;max-width:100%;max-height:100%;background:var(--sup);color:var(--tinta);border-radius:20px;box-shadow:var(--sombra-capa);overflow:hidden;opacity:0;transform:scale(.96);transform-origin:50% 0;transition:opacity 180ms ease-out,transform 320ms RES_OUT}
.§[data-vp="ih"] .§-pal,.§[data-vp="iv"] .§-pal{width:520px}
.§[data-vp="ext"] .§-pal{width:310px;transform-origin:50% 50%}
.§[data-vp="tel"] .§-pal{width:100%;height:100%;border-radius:22px 22px 0 0;opacity:1;transform:translateY(105%)}
.§ .§-capa.§-on .§-pal{opacity:1;transform:none;transition:opacity 220ms ease-out,transform 520ms RES_IN}
.§ .§-capa.§-dup .§-pal{opacity:0!important;transform:scale(.96)!important;pointer-events:none}
.§[data-vp="tel"] .§-capa.§-dup .§-pal{transform:translateY(105%)!important;opacity:1!important}
.§ .§-asa{display:block;flex:none;width:36px;height:5px;margin:8px auto 0;border-radius:999px;background:var(--borde)}
.§ .§-vb,.§ .§-vf{display:flex;flex-direction:column;min-height:0}
.§.§-e7 .§-vb,.§:not(.§-e7) .§-vf{display:none}
.§ .§-bus{flex:none;display:flex;align-items:center;gap:10px;margin:12px 12px 4px;height:48px;padding:0 4px 0 12px;border-radius:12px;background:var(--sup2);color:var(--tinta2)}
.§[data-vp="esc"] .§-bus,.§[data-vp="ih"] .§-bus{height:44px}
.§ .§-q{flex:1;min-width:0;align-self:stretch;border:0;background:none;outline:none;color:var(--tinta);font:16px/20px var(--fuente)}
.§[data-vp="esc"] .§-q,.§[data-vp="ih"] .§-q{font-size:15px}
.§ .§-q::placeholder{color:var(--tinta3)}
.§ .§-bus:focus-within{outline:2px solid var(--enlace)}
.§ .§-ib2{position:relative;width:44px;height:44px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--tinta2)}
.§[data-vp="esc"] .§-ib2,.§[data-vp="ih"] .§-ib2{width:36px;height:36px}
.§ .§-cuerpo{min-height:0;overflow-y:auto;scrollbar-width:none;padding:4px 8px 8px}
.§ .§-cuerpo>*{display:none}
.§.§-e1 .§-e-vacia,.§.§-e2 .§-e-res,.§.§-e3 .§-e-folio,.§.§-e4 .§-e-sinfolio,.§.§-e5 .§-e-res,.§.§-e5 .§-e-crear,.§.§-e6 .§-e-crear{display:block}
.§:not(.§-e5) .§-e-res li[data-n="07"],.§.§-e5 .§-e-res li:not([data-n="07"]){display:none}
.§ .§-pista2{padding:12px;font-size:14px;line-height:20px;color:var(--tinta2)}
.§ .§-r{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 12px;border-radius:12px;text-align:left;color:var(--tinta)}
.§[data-vp="esc"] .§-r,.§[data-vp="ih"] .§-r{min-height:52px}
.§ .§-r[aria-selected="true"]{background:var(--tonal)}
.§ .§-r>.§-mo-f{color:var(--tinta3)}
.§ .§-r-t{flex:1;min-width:0;display:flex;flex-direction:column}
.§ .§-r-n{font-size:15px;line-height:20px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.§ .§-r-s{font-size:13px;line-height:18px;color:var(--tinta2);font-variant-numeric:tabular-nums}
.§ .§-folio{font-variant-numeric:tabular-nums}
.§ .§-avp{width:36px;height:36px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:16px;font-weight:600;font-variant-numeric:tabular-nums}
.§ .§-doc,.§ .§-avn{width:36px;height:36px;flex:none;display:flex;align-items:center;justify-content:center}
.§ .§-avn{border-radius:999px;background:var(--ok-fondo);color:var(--ok-tinta)}
.§ .§-crear .§-r-n,.§ .§-e-folio .§-r-n{white-space:normal}
.§ .§-crear .§-r-n b{font-weight:700}
.§ .§-e-crear{margin-top:4px;border-top:1px solid var(--linea);padding-top:4px}
.§.§-e6 .§-e-crear{margin-top:0;border-top:0;padding-top:0}
.§ .§-nada{padding:24px 16px 20px;text-align:center;color:var(--tinta2)}
.§ .§-nada>svg{color:var(--tinta3);margin:0 auto 8px;display:block}
.§ .§-nada-t{font-size:15px;line-height:20px;font-weight:600;color:var(--tinta)}
.§ .§-nada-s{margin:6px auto 0;max-width:36ch;font-size:13px;line-height:18px}
.§ .§-tec{flex:none;display:flex;align-items:center;gap:6px;padding:10px 16px;border-top:1px solid var(--linea);font-size:12px;line-height:16px;color:var(--tinta2)}
.§ .§-tec kbd{padding:0 5px;border-radius:5px;background:var(--sup2);font:600 12px/18px var(--fuente);color:var(--tinta2)}
.§ .§-tec kbd:not(:first-child){margin-left:8px}
/* ---- Registro rápido ---- */
.§ .§-vf{gap:14px;padding:8px 16px 16px;overflow-y:auto;scrollbar-width:none}
.§[data-vp="tel"] .§-vf{padding-bottom:calc(var(--ib) + 16px)}
.§ .§-fcab{display:flex;align-items:center;gap:6px;margin:0 -8px}
.§ .§-fcab-t{flex:1;min-width:0}
.§ .§-fcab-t h2{font-size:17px;line-height:22px;font-weight:700}
.§ .§-fcab-t p{font-size:13px;line-height:18px;color:var(--tinta2)}
.§ .§-par{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.§[data-vp="ext"] .§-par{grid-template-columns:1fr}
.§ .§-f{display:flex;flex-direction:column;gap:6px}
.§ .§-f>span{font-size:13px;line-height:18px;font-weight:600;color:var(--tinta2)}
.§ .§-in{height:44px;padding:0 12px;border:0;border-radius:12px;background:var(--sup2);color:var(--tinta);font:16px/20px var(--fuente);outline:none;min-width:0;width:100%}
.§[data-vp="esc"] .§-in,.§[data-vp="ih"] .§-in{height:40px;font-size:15px}
.§ .§-in:focus{outline:2px solid var(--enlace)}
.§ .§-chk{position:relative;display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;line-height:20px;color:var(--tinta)}
.§ .§-chk>span:first-child{flex:1}
.§ .§-chk input{position:absolute;opacity:0;width:24px;height:24px;right:0}
.§ .§-caja{width:24px;height:24px;flex:none;border-radius:7px;background:var(--accion);color:#fff;display:flex;align-items:center;justify-content:center}
.§ .§-enl{position:relative;color:var(--enlace);font-weight:600}
.§ .§-enl::after{content:"";position:absolute;inset:-14px -2px}
.§ .§-pieh{display:flex;gap:8px;justify-content:flex-end}
.§ .§-pieh>*{min-width:104px}
.§[data-vp="ext"] .§-pieh,.§[data-vp="tel"] .§-pieh{flex-direction:column-reverse}
.§ .§-ton,.§ .§-prim,.§ .§-quieto{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 14px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600;text-align:center}
.§[data-vp="esc"] .§-ton,.§[data-vp="esc"] .§-prim,.§[data-vp="esc"] .§-quieto,.§[data-vp="ih"] .§-ton,.§[data-vp="ih"] .§-prim,.§[data-vp="ih"] .§-quieto{min-height:40px;font-size:14px}
.§ .§-ton{background:var(--tonal);color:var(--tonal-tinta)}
.§ .§-prim{background:var(--accion);color:#fff}
.§ .§-quieto{background:var(--sup2);color:var(--tinta)}
/* ---- Alerta de duplicado ---- */
.§ .§-alw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:none}
.§[data-vp="ext"] .§-alw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="ih"] .§-alw{padding:24px calc(218px + var(--ir) + 24px) calc(var(--ib) + 16px) 24px}
.§[data-vp="iv"] .§-alw{padding:calc(var(--it) + 58px) 24px 24px}
.§[data-vp="esc"] .§-alw{padding:32px 24px 32px calc(248px + 24px)}
.§ .§-al{pointer-events:auto;width:320px;max-width:100%;padding:24px;border-radius:20px;background:var(--sup);box-shadow:var(--sombra-capa);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:scale(.96);transition:opacity 180ms ease-out,transform 300ms RES_OUT}
.§[data-vp="ih"] .§-al,.§[data-vp="iv"] .§-al,.§[data-vp="esc"] .§-al{width:340px}
.§ .§-capa.§-dup .§-al{opacity:1;transform:none;transition:opacity 220ms ease-out,transform 480ms RES_IN}
.§ .§-capa:not(.§-dup) .§-alw{visibility:hidden}
.§ .§-al-ic{width:48px;height:48px;border-radius:999px;background:var(--ag-fondo);color:var(--ag-tinta);display:flex;align-items:center;justify-content:center}
.§ .§-al-t{margin-top:14px;font-size:17px;line-height:22px;font-weight:700}
.§ .§-al-m{margin-top:6px;font-size:14px;line-height:20px;color:var(--tinta2);text-align:justify;hyphens:auto}
.§ .§-al-m strong{color:var(--tinta);font-weight:600}
.§ .§-al-b{margin-top:20px;display:flex;flex-direction:column;gap:8px;width:100%}
@media (prefers-reduced-motion:reduce){.§ .§-pal,.§ .§-al{transform:none!important;transition:opacity 200ms ease}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var E={e1:'',e2:'Prueba 0',e3:'RX-2026-0042',e4:'RX-2026-0999',e5:'Paciente Prueba 07',e6:'Paciente Prueba 26',e7:'Paciente Prueba 26'},est='e1';
function pon(e,abre){est=e;MS.forEach(function(m){['e1','e2','e3','e4','e5','e6','e7'].forEach(function(x){m.classList.toggle(cls(x),x===e)});
  var q=m.querySelector('.'+cls('q'));q.value=E[e];var c=m.querySelector('.'+cls('capa'));c.classList.remove(cls('dup'));
  if(abre){c.classList.add(cls('on'));c.setAttribute('aria-hidden','false')}sel(m)})}
/* Solo una opción seleccionada: la primera visible. El texto de «Crear registro para» sigue a lo escrito. */
function sel(m){var q=m.querySelector('.'+cls('q')).value.trim();m.querySelectorAll('.'+cls('cq')).forEach(function(b){b.textContent='"'+q+'"'});
  var op=[].slice.call(m.querySelectorAll('.'+cls('r'))).filter(function(b){return b.offsetParent});
  m.querySelectorAll('.'+cls('r')).forEach(function(b){b.setAttribute('aria-selected','false')});if(op[0])op[0].setAttribute('aria-selected','true');
  var f=m.querySelectorAll('.'+cls('in'));if(f.length){f[1].value=est==='dup'?'07':'26'}}
function forma(v){v=v.trim();if(!v)return 'e1';if(/^[a-z]{2,3}-?\d{4}-?\d{1,5}$/i.test(v))return v.toUpperCase().indexOf('0042')>=0?'e3':'e4';
  return v.length<2?'e1':(/26$/.test(v)?'e6':(/prueba 07$/i.test(v)?'e5':'e2'))}
MS.forEach(function(m){var c=m.querySelector('.'+cls('capa')),q=m.querySelector('.'+cls('q')),orig=null;
  function abre(o){orig=o||null;pon('e1',true);setTimeout(function(){q.focus({preventScroll:true})},60)}
  function cierra(){c.classList.remove(cls('on'),cls('dup'));c.setAttribute('aria-hidden','true');if(orig&&orig.offsetParent)orig.focus({preventScroll:true})}
  m.abrePal=abre;
  m.querySelectorAll('.'+cls('abre-pal')).forEach(function(b){b.addEventListener('click',function(){abre(b)})});
  m.querySelectorAll('.'+cls('cierra-pal')).forEach(function(b){b.addEventListener('click',cierra)});
  c.querySelector('.'+cls('velo')).addEventListener('click',cierra);
  q.addEventListener('input',function(){var e=forma(q.value);est=e;['e1','e2','e3','e4','e5','e6'].forEach(function(x){m.classList.toggle(cls(x),x===e)});sel(m)});
  m.querySelectorAll('.'+cls('r')).forEach(function(b){b.addEventListener('click',function(){if(b.classList.contains(cls('crear')))pon('e7');else cierra()})});
  m.querySelectorAll('.'+cls('volver')).forEach(function(b){b.addEventListener('click',function(){pon('e6')})});
  m.querySelector('.'+cls('crea')).addEventListener('click',function(){c.classList.add(cls('dup'))});
  m.querySelectorAll('.'+cls('dup-x')).forEach(function(b){b.addEventListener('click',cierra)});
  m.querySelector('.'+cls('dup-c')).addEventListener('click',function(){c.classList.remove(cls('dup'))});
  /* ↑↓ mueven la selección entre las opciones visibles; Esc cierra */
  m.addEventListener('keydown',function(e){if(!c.classList.contains(cls('on')))return;
    if(e.key==='Escape'){e.preventDefault();if(c.classList.contains(cls('dup')))c.classList.remove(cls('dup'));else cierra();return}
    if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;e.preventDefault();
    var op=[].slice.call(m.querySelectorAll('.'+cls('r'))).filter(function(b){return b.offsetParent});var i=op.findIndex(function(b){return b.getAttribute('aria-selected')==='true'});
    op.forEach(function(b){b.setAttribute('aria-selected','false')});i=Math.max(0,Math.min(op.length-1,i+(e.key==='ArrowDown'?1:-1)));if(op[i])op[i].setAttribute('aria-selected','true')});
});
/* Ctrl/⌘+K abre o cierra la paleta del marco de computadora (como hoy, alterna) */
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='k'){var m=MS.filter(function(x){return x.offsetParent})[0];if(!m)return;e.preventDefault();
  var c=m.querySelector('.'+cls('capa'));if(c.classList.contains(cls('on'))){c.classList.remove(cls('on'));c.setAttribute('aria-hidden','true')}else m.abrePal()}});
tira([[['e1','Vacía'],['e2','Pacientes'],['e3','Folio'],['e4','Folio sin resultado'],['e5','Pacientes + crear'],['e6','Solo crear'],['e7','Registro rápido'],['dup','Duplicado']]],function(k){
  if(k==='dup'){pon('e7',true);est='dup';MS.forEach(function(m){sel(m)});MS.forEach(function(m){m.querySelector('.'+cls('capa')).classList.add(cls('dup'))});return}
  pon(k,true)});
'''

FICHA = ficha(P, 'Paleta de comandos (buscador global)', [
    ('Qué es', 'El buscador global de hoy (<code>CommandPalette.tsx</code>, montado en <code>(app)/layout.tsx:230</code>): busca paciente por nombre o documento por folio y, si no encuentra, ofrece un registro rápido. Es distinto del buscador de «Nueva consulta» del dashboard (<code>ConsultaRapidaModal</code>), que ya está maquetado.'),
    ('Cómo se abre', 'Ctrl/⌘+K desde cualquier pantalla (alterna); el campo «Buscar paciente o folio» del dashboard la abre sintetizando ese atajo (<code>dashboard/page.tsx:66</code>). En teléfono y Duo solo existe esa segunda vía. Esc cierra; tocar fuera cierra.'),
    ('A quién', 'Todos los roles. A la secretaria, abrir un resultado o crear la lleva a la lista <code>/expediente</code>, no al expediente del paciente.'),
    ('Capa por marco', 'Computadora: tarjeta de 560 anclada a 72 px del borde superior del área de contenido, centrada en horizontal (anclada y no centrada en vertical para que no salte al cambiar el número de resultados; propuesta, ver informe). Duo abierto (ambos): 520, anclada arriba. Duo cerrado: tarjeta centrada de 310 (§26). iPhone: hoja alta desde abajo con asa. Velo con desenfoque en todos.'),
    ('Estados', 'Vacía (pista «Nombre del paciente, o folio del documento»), pacientes, documento por folio, folio sin resultado, pacientes + «Crear registro para», solo «Crear registro para», registro rápido, duplicado. La forma de lo escrito decide el modo (folio o nombre).'),
    ('Medidas', 'Campo 48 (44 en ancho), relleno <code>--sup2</code>, texto 16 en teléfono. Filas 60 (52 en ancho) con avatar pastel de 36 y el número del paciente, nombre 15/600, línea «edad · sexo · expediente» 13 <code>--tinta2</code>; la seleccionada con fondo <code>--tonal</code>. Documento con el icono de su tipo en color (§9). Pie de teclas solo en Duo abierto horizontal y computadora (hoy sale también en teléfono, donde no sirve).'),
    ('Registro rápido', '«Registro rápido» / «Puedes completar el expediente después»; Nombre *, Apellidos, Fecha de nacimiento *, casilla a la derecha del texto (§20). «Cancelar» vuelve a la búsqueda; «Crear e ir al expediente» se habilita con nombre, fecha y casilla. Duplicado: alerta del catálogo «Paciente duplicado» con tres botones apilados (principal arriba).'),
    ('Textos', 'Todos los de hoy: placeholder, «Crear registro para: "…"», «Registro rápido — solo nombre, teléfono y motivo» (no coincide con el formulario: pide nombre y fecha; ver informe), «Sin resultados para "…"», «Ningún documento tuyo con ese folio…», «El paciente ha leído y acepta el Aviso de Privacidad (LFPDPPP Art. 9) *» (cita la ley abrogada; deuda ya anotada), «Crear e ir al expediente», «Ir a su expediente», «Es otra persona» (texto nuevo aprobado; hoy «Es otra persona, crear de todos modos»: la consecuencia pasa al cuerpo de la alerta, «Si es otra persona, se creará el registro de todos modos.»), «Cancelar».'),
    ('Accesibilidad', 'Capa <code>role="dialog"</code> con nombre (hoy no lo tiene); lista <code>listbox</code> con <code>aria-selected</code>; ↑↓ y Enter; foco al campo al abrir y de vuelta al origen al cerrar; botones de cerrar y volver con nombre (hoy sin nombre).'),
    ('Movimiento', 'Tarjeta: escala .96→1 desde su borde superior (desde el centro en Duo cerrado), resorte amortiguación 1, respuesta .35 s; hoja: sube del borde y se arrastra para cerrar. Salida más rápida por el mismo camino. Reduced motion: fundido de 200 ms. Reduced transparency: velo opaco.'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '3-paleta', 'Paleta de comandos (⌘K)',
       'Hoy cae desde arriba como una caja sin título ni papel de diálogo, con el pie de teclas también en teléfono; aquí es la misma tarjeta de capa del sistema, anclada arriba en ancho y hoja en iPhone, con avatares, el documento por folio con su color de tipo y el registro rápido con la alerta de duplicado del catálogo',
       CSS, marcos, JS, {'p': P}, FICHA)
