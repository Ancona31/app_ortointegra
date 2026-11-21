(function(){
  /* Maqueta: nada se guarda ni se imprime. «Generando PDF…» es un temporizador y las plantillas son una lista en memoria. */
  var CFG=__CFG__;
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function sinAc(s){return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
  var X_SVG='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var OK_SVG='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var MAS_SVG='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h.01M12 12h.01M18 12h.01"/></svg>';
  var BAS_SVG='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  var PLUS_SVG='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  var BAS28='<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  var AVI28='<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/></svg>';
  var marcos=[].slice.call(document.querySelectorAll('.QQ.marco')),apis=[];
  marcos.forEach(function(m){
    var vp=m.dataset.vp,esc=vp==='esc',ancho=esc||vp==='ih'||vp==='iv';
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var on=function(s,ev,f){$$(s).forEach(function(e){e.addEventListener(ev,f)})};
    var del=function(ev,sel,f){m.addEventListener(ev,function(e){var t=e.target.closest?e.target.closest(sel):null;if(t&&m.contains(t))f(e,t)})};
    var cont=$('.QQ-cont'),capa=$('.QQ-capa'),pan=null,origen=null,tT=0,tI=0;
    var plant=[],plErr=false,selPl='',intentado=false,ocupado=false,foto=null,gsAb=-1,gsRen=-1,gsOper='',conf=null,st={},V={},api={};
    function plIni(){plant=CFG.plantillas.map(function(n,i){return {n:n,f:'Actualizada el '+(12-i*3)+' de noviembre'}});plErr=false;selPl=''}
    function zoom(){return m.getBoundingClientRect().width/m.offsetWidth||1}
    function toast(t){var x=$('.QQ-toast');x.firstChild.textContent=t;x.classList.add('QQ-on');clearTimeout(tT);tT=setTimeout(function(){x.classList.remove('QQ-on')},2600)}
    function crece(t){if(!t.offsetParent)return;t.style.height='auto';t.style.height=t.scrollHeight+'px'}
    function creceTodo(){$$('.QQ-ta').forEach(crece)}

    /* ---- Capas ---- */
    function abre(p,desde){if(desde)origen=desde;pan=p;var x=$('.QQ-pan[data-pan="'+p+'"]');
      $$('.QQ-pan').forEach(function(y){y.classList.toggle('QQ-act',y===x)});
      var menu=esc&&x.classList.contains('QQ-menu');
      capa.classList.toggle('QQ-sinvelo',menu);capa.classList.add('QQ-on');capa.setAttribute('aria-hidden','false');
      if(menu&&origen){var b=origen.getBoundingClientRect(),r=m.getBoundingClientRect(),z=zoom();  /* el menú nace de su botón */
        x.style.top=((b.bottom-r.top)/z+4)+'px';x.style.left=(x.classList.contains('QQ-m-izq')?(b.left-r.left)/z:(b.right-r.left)/z-248)+'px';
        if((b.bottom-r.top)/z+4+x.offsetHeight>m.offsetHeight-12){x.style.top=((b.top-r.top)/z-4-x.offsetHeight)+'px';x.style.transformOrigin='bottom '+(x.classList.contains('QQ-m-izq')?'left':'right')}else x.style.transformOrigin=''}  /* si no cabe abajo, sube */
      var f=x.dataset.foco?x.querySelector('input,textarea'):x;f.focus({preventScroll:true})}
    function cierra(){if(!pan)return;var era=pan;pan=null;capa.classList.remove('QQ-on');capa.setAttribute('aria-hidden','true');$$('.QQ-pan').forEach(function(y){y.classList.remove('QQ-act')});
      if(V.alCerrar)V.alCerrar(era);
      if(origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    m.addEventListener('scroll',function(e){var t=e.target;if(t===m||/QQ-(app|capa|col)( |$)/.test(t.className)){t.scrollTop=0;t.scrollLeft=0}},true);
    del('click','.QQ-cierra',function(){cierra()});
    /* Navegación (CALMA §28): «Más» y el cajón; el aviso de datos pendientes se pliega y despliega */
    del('click','[data-abre]',function(e,b){abre(b.dataset.abre,b)});
    del('click','.QQ-ap-cab',function(e,b){var ap=b.closest('.QQ-ap'),p=ap.classList.toggle('QQ-pleg');b.setAttribute('aria-expanded',String(!p))});
    del('click','.QQ-pan[data-pan="mas"] a, .QQ-cajon a',function(){cierra()});$('.QQ-velo').addEventListener('click',cierra);
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&pan){if(e.target.matches&&e.target.matches('.QQ-gs-in'))return;if(pan==='conf')abre('gest');else cierra()}});
    del('click','a[href="#"]',function(e){e.preventDefault()});

    /* ---- Campos ligados al estado (data-k) ---- */
    function pintaCampos(){$$('input[data-k],textarea[data-k]').forEach(function(i){if(i.value!==st[i.dataset.k])i.value=st[i.dataset.k]||''});
      $$('.QQ-sel').forEach(function(b){var v=st[b.dataset.k],s=b.querySelector('.QQ-v');s.textContent=v||'Seleccionar…';s.classList.toggle('QQ-nada',!v)});creceTodo()}
    del('input','input[data-k],textarea[data-k]',function(e,t){st[t.dataset.k]=t.value;if(t.tagName==='TEXTAREA')crece(t);if(V.cambio)V.cambio(t.dataset.k);refresca()});
    /* Los <select> de hoy: fila que abre una lista con palomita */
    del('click','.QQ-sel',function(e,b){var k=b.dataset.k;$('.QQ-ops-t').textContent=b.dataset.tit;
      $('.QQ-ops-l').innerHTML=['Seleccionar…'].concat(b.dataset.ops.split('|')).map(function(o,i){var v=i?o:'';
        return '<button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-op" role="radio" aria-checked="'+((st[k]||'')===v)+'" data-k="'+k+'" data-v="'+h(v)+'"><span class="QQ-flex">'+h(o)+'</span>'+OK_SVG+'</button>'}).join('');
      abre('ops',b)});
    del('click','.QQ-op',function(e,b){st[b.dataset.k]=b.dataset.v;cierra();pintaCampos();refresca()});

    /* ---- Validación: los mensajes de hoy, en una línea sobre la barra; cada nombre lleva a su campo ---- */
    function pintaFaltas(){var f=intentado?V.faltan():[],el=$('.QQ-falta');el.hidden=!f.length;
      $$('[data-c]').forEach(function(r){r.classList.toggle('QQ-mala',f.some(function(x){return x.c===r.dataset.c}))});
      if(!f.length)return;
      if(V.faltaTxt){el.textContent=V.faltaTxt;return}
      el.innerHTML=(f.length===1?'Falta 1 campo':'Faltan '+f.length+' campos')+': '+f.slice(0,3).map(function(x){return '<button type="button" class="QQ-p QQ-lnk" data-ir="'+x.c+'">'+x.n+'</button>'}).join(' · ')+(f.length>3?' y '+(f.length-3)+' más':'')}
    del('click','.QQ-lnk',function(e,b){var r=$('[data-c="'+b.dataset.ir+'"]');if(!r)return;
      cont.scrollTop=Math.max(0,(r.getBoundingClientRect().top-cont.getBoundingClientRect().top)/zoom()+cont.scrollTop-90);
      var f=r.matches('button')?r:r.querySelector('input,textarea,button,[contenteditable]');if(f)f.focus({preventScroll:true})});
    function refresca(){$('.QQ-nav-v').textContent=selPl||'— Sin plantilla —';$$('.QQ-b-plant').forEach(function(b){b.setAttribute('aria-disabled',String(V.vacio()))});if(intentado)pintaFaltas()}
    function pintaTodo(){pintaCampos();V.pinta();refresca();pintaFaltas()}

    /* ---- Imprimir (A7-12) y modal posterior (A7-13/14/15) ---- */
    function ponImp(t,giro){var fijo=vp==='ih';  /* Duo abierto horizontal: el botón no crece; el estado va en una línea sobre la barra */
      $$('.QQ-b-imp').forEach(function(b){b.disabled=!!giro;b.querySelector('.QQ-giro').hidden=!giro||fijo;b.querySelector('.QQ-b-imp-t').textContent=fijo?'Imprimir':t});
      var e=$('.QQ-est');if(e){e.hidden=!(fijo&&giro);$('.QQ-est-t').textContent=t}}
    on('.QQ-b-imp','click',function(e){if(ocupado)return;intentado=true;pintaFaltas();if(V.faltan().length)return;
      ocupado=true;origen=e.currentTarget;toast(CFG.toastGen);ponImp('Generando PDF…',true);
      clearTimeout(tI);tI=setTimeout(function(){ocupado=false;ponImp('Imprimir',false);toast(CFG.toastOk);genAbre(true)},RM?300:1100)});
    var gen=$('.QQ-pan[data-pan="gen"]'),FICHA='paciente01@semilla.spinus.test';
    function paso(p,a){gen.dataset.paso=p;var cap=p==='pidiendo'||p==='confirmando',ok=gen.dataset.ok!=='0';
      $('.QQ-g-lista').hidden=cap;$('.QQ-g-otro').hidden=cap||!ok||p!=='listo';$('.QQ-g-pide').hidden=p!=='pidiendo';$('.QQ-g-conf').hidden=p!=='confirmando';$('.QQ-g-hecho').hidden=p!=='enviado';
      $('.QQ-g-dest').hidden=!ok||p!=='listo';$('.QQ-g-noexp').hidden=ok;
      $('.QQ-g-correo').disabled=!ok||p==='enviando'||p==='enviado';$('.QQ-g-correo-t').textContent=p==='enviando'?'Enviando…':p==='enviado'?'Enviado':'Enviar por correo';
      if(p==='enviado'){$('.QQ-g-a').textContent=a;$('.QQ-g-a2').textContent=a;$('.QQ-g-ofrece').hidden=a===FICHA;$('.QQ-g-fichaok').hidden=true}}
    function genAbre(ok){gen.dataset.ok=ok?'1':'0';$('.QQ-g-si').hidden=!ok;$('.QQ-g-no').hidden=ok;$('.QQ-g-in').value='';$('.QQ-g-enviar').disabled=true;paso('listo');abre('gen')}
    function envia(a){paso('enviando');setTimeout(function(){paso('enviado',a)},RM?200:800)}
    on('.QQ-g-correo','click',function(){envia(FICHA)});
    on('.QQ-g-otro','click',function(){paso('pidiendo');$('.QQ-g-in').focus({preventScroll:true})});
    on('.QQ-g-in','input',function(e){$('.QQ-g-enviar').disabled=!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.target.value.trim())});
    on('.QQ-g-enviar','click',function(){$('.QQ-g-dir').textContent=$('.QQ-g-in').value.trim();paso('confirmando')});
    on('.QQ-g-canc','click',function(){paso('listo')});on('.QQ-g-corr','click',function(){paso('pidiendo')});
    on('.QQ-g-si-env','click',function(){envia($('.QQ-g-in').value.trim())});
    on('.QQ-g-ficha','click',function(){$('.QQ-g-ofrece').hidden=true;$('.QQ-g-fichaok').hidden=false});
    on('.QQ-g-nog','click',function(){$('.QQ-g-ofrece').hidden=true});
    /* «Visualizar» abre el PDF en una pestaña nueva y «Descargar» lo baja (enlaces del sistema, sin parte visual propia) */

    /* ---- «Cambiar» de tipo (A7-2/3/4) ---- */
    on('.QQ-b-cambiar','click',function(e){abre('tipo',e.currentTarget);var a=$('.QQ-z[aria-current]');if(a)a.focus({preventScroll:true})});
    function irTipo(n){cierra()}  /* en la app abre el formulario de ese tipo (página «Documentos 1» para los otros cinco) */
    var destino='';
    on('.QQ-z','click',function(e){var b=e.currentTarget;if(b.getAttribute('aria-current')){cierra();return}destino=b.dataset.n;
      if(V.vacio()){irTipo(destino);return}
      $('.QQ-cam-t').textContent='¿Cambiar a '+destino+'?';$('.QQ-pan[data-pan="cambiar"]').setAttribute('aria-label','¿Cambiar a '+destino+'?');$('.QQ-cam-ok').textContent='Cambiar';$('.QQ-cam-ok').setAttribute('aria-label','Cambiar a '+destino);abre('cambiar')});
    on('.QQ-cam-ok','click',function(){irTipo(destino)});
    $('.QQ-rej').addEventListener('keydown',function(e){var z=$$('.QQ-z'),i=z.indexOf(document.activeElement),c=ancho?4:2,d={ArrowRight:1,ArrowLeft:-1,ArrowDown:c,ArrowUp:-c}[e.key];
      if(e.key==='Home')i=0;else if(e.key==='End')i=z.length-1;else if(d&&i>=0)i=Math.max(0,Math.min(z.length-1,i+d));else return;e.preventDefault();z[i].focus({preventScroll:true})});

    /* ---- Plantillas (A7-6 a A7-10) ---- */
    function pintaPl(){var hay=plant.length>0&&!plErr;
      $('.QQ-pl-con').hidden=!hay;$('.QQ-pl-sin').hidden=plErr||plant.length>0;$('.QQ-pl-err').hidden=!plErr;$('.QQ-pl-pie').hidden=!hay;
      $('.QQ-pl-l').innerHTML=plant.map(function(p){return '<button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-pl-op" role="radio" aria-checked="'+(selPl===p.n)+'" data-n="'+h(p.n)+'"><span class="QQ-flex">'+h(p.n)+'</span>'+OK_SVG+'</button>'}).join('');
      $('.QQ-pl-nada').setAttribute('aria-checked',String(!selPl));$('.QQ-pl-vaciar').disabled=V.vacio();
      /* Gestionar */
      $('.QQ-gs-n').textContent=plant.length+' / 10';$('.QQ-gs-n').hidden=plErr;$('.QQ-gs-sin').hidden=plErr||plant.length>0;$('.QQ-gs-err').hidden=!plErr;
      $('.QQ-gs-vac').hidden=!(V.vacio()&&hay);$('.QQ-gs-oper').hidden=!gsOper;$('.QQ-gs-oper-t').textContent=gsOper;
      $('.QQ-gs-l').innerHTML=plErr?'':plant.map(function(p,i){
        if(i===gsRen)return '<li class="QQ-pf"><div class="QQ-fila" style="padding-top:0"><input type="text" class="QQ-fin QQ-flex QQ-gs-in" value="'+h(p.n)+'" aria-label="Nuevo nombre de '+h(p.n)+'" autocomplete="off">'
          +'<button type="button" class="QQ-p QQ-ib QQ-ten QQ-gs-x" aria-label="Cancelar">'+X_SVG+'</button><button type="button" class="QQ-p QQ-prim QQ-gs-ok">Guardar</button></div>'
          +'<p class="QQ-nota QQ-n-mal QQ-gs-dup" style="padding-top:6px" hidden>Ya tienes una con ese nombre.</p></li>';
        return '<li class="QQ-pf"><div class="QQ-pf-c"><span class="QQ-mr-t"><span>'+h(p.n)+'</span><span class="QQ-mr-s">'+p.f+'</span></span>'
          +'<button type="button" class="QQ-p QQ-ib QQ-gs-mas" data-i="'+i+'" aria-expanded="'+(i===gsAb)+'" aria-label="Acciones de '+h(p.n)+'">'+MAS_SVG+'</button></div>'
          +'<div class="QQ-pf-a"'+(i===gsAb?'':' hidden')+'><button type="button" class="QQ-p QQ-mini QQ-tonal" data-o="ren" data-i="'+i+'" aria-label="Renombrar '+h(p.n)+'">Renombrar</button>'
          +'<button type="button" class="QQ-p QQ-mini QQ-tonal" data-o="sob" data-i="'+i+'"'+(V.vacio()?' disabled':'')+' aria-label="Sobrescribir '+h(p.n)+' con el formulario actual">Sobrescribir</button>'
          +'<button type="button" class="QQ-p QQ-mini QQ-rojo-s" data-o="eli" data-i="'+i+'" aria-label="Eliminar '+h(p.n)+'">Eliminar</button></div></li>'}).join('')}
    function abreGest(d){gsAb=-1;gsRen=-1;pintaPl();abre('gest',d)}
    on('.QQ-mas-b','click',function(e){abre('menu',e.currentTarget)});
    del('click','.QQ-pan[data-pan="menu"] .QQ-mr',function(e,b){var o=$('.QQ-mas-b'),a=b.dataset.a;if(a==='gest'){abreGest(o);return}cierra();if(a==='gpl')guardarComo(o);else vaciar()});
    on('.QQ-b-pl','click',function(e){pintaPl();abre('usar',e.currentTarget)});
    on('.QQ-pl-gest','click',function(){abreGest()});on('.QQ-tope-ok','click',function(){abreGest()});
    del('click','.QQ-pl-reint',function(){plErr=false;pintaPl()});
    function aviso(t){foto=JSON.stringify({st:st,x:V.extra?V.extra():null,p:selPl});return function(){$('.QQ-av-pl-t').textContent=t;$('.QQ-av-pl').hidden=false;cont.scrollTop=0}}
    del('click','.QQ-pl-op',function(e,b){var n=b.dataset.n,f=aviso('Se aplicó «'+n+'». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.');selPl=n;V.aplica(n);cierra();pintaTodo();f()});
    function vaciar(){if(V.vacio())return;var f=aviso('Se vació el formulario. Los datos del paciente no cambiaron.');selPl='';V.vacia();pan&&cierra();pintaTodo();f()}
    on('.QQ-pl-vaciar','click',vaciar);
    on('.QQ-pl-nada','click',function(){selPl='';cierra();refresca()});
    on('.QQ-b-deshacer','click',function(){if(!foto)return;var o=JSON.parse(foto);st=o.st;if(V.ponExtra)V.ponExtra(o.x);selPl=o.p||'';foto=null;$('.QQ-av-pl').hidden=true;pintaTodo()});
    /* Guardar como plantilla: deshabilitado «con motivo» si no hay contenido (hoy el motivo solo vive en title; aquí se dice al tocar) */
    function guardarComo(d){if(V.vacio()){toast('Llena algún campo de los que la plantilla guarda para poder guardarla.');return}
      if(plant.length>=10){abre('tope',d);return}
      $('.QQ-gp-in').value='';$('.QQ-gp-ok').disabled=true;$('.QQ-gp-dup').hidden=true;abre('guardar',d)}
    on('.QQ-b-plant','click',function(e){guardarComo(e.currentTarget)});
    function dup(n,salvo){n=n.trim().toLowerCase();return plant.some(function(p,i){return i!==salvo&&p.n.toLowerCase()===n})}
    on('.QQ-gp-in','input',function(e){var v=e.target.value.trim();$('.QQ-gp-dup').hidden=!dup(v,-1);$('.QQ-gp-ok').disabled=!v});
    function guardaPl(){var v=$('.QQ-gp-in').value.trim();if(!v)return;if(dup(v,-1)){$('.QQ-gp-dup').hidden=false;return}
      plant.unshift({n:v,f:'Actualizada el 19 de noviembre'});cierra();toast('Plantilla «'+v+'» guardada')}
    on('.QQ-gp-ok','click',guardaPl);on('.QQ-gp-in','keydown',function(e){if(e.key==='Enter'){e.preventDefault();guardaPl()}});
    del('click','.QQ-gs-mas',function(e,b){var i=+b.dataset.i;gsAb=gsAb===i?-1:i;pintaPl();var n=$('.QQ-gs-mas[data-i="'+i+'"]');if(n)n.focus({preventScroll:true})});
    del('click','.QQ-pf-a [data-o]',function(e,b){var i=+b.dataset.i,p=plant[i],o=b.dataset.o;gsOper='';
      if(o==='ren'){gsRen=i;gsAb=-1;pintaPl();var x=$('.QQ-gs-in');x.focus({preventScroll:true});x.select();return}
      conf={o:o,i:i};$('.QQ-cf-t').textContent=(o==='eli'?'¿Eliminar':'¿Sobrescribir')+' «'+p.n+'»?';$('.QQ-pan[data-pan="conf"]').setAttribute('aria-label',$('.QQ-cf-t').textContent);
      $('.QQ-cf-p').textContent=o==='eli'?'Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.':'Se reemplaza el contenido guardado de «'+p.n+'» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.';
      var ci=$('.QQ-pan[data-pan="conf"] .QQ-al-i');ci.className='QQ-al-i QQ-i-'+(o==='eli'?'mal':'ag');ci.innerHTML=o==='eli'?BAS28:AVI28;
      var ck=$('.QQ-cf-ok');ck.className='QQ-p '+(o==='eli'?'QQ-bt QQ-rojo-s':'QQ-prim')+' QQ-cf-ok';ck.textContent=o==='eli'?'Eliminar':'Sobrescribir';abre('conf')});
    on('.QQ-cf-no','click',function(){abre('gest')});
    on('.QQ-cf-ok','click',function(){if(conf.o==='eli')plant.splice(conf.i,1);else plant[conf.i].f='Actualizada el 19 de noviembre';gsAb=-1;pintaPl();abre('gest')});
    function renOk(){var x=$('.QQ-gs-in');if(!x)return;var v=x.value.trim();if(!v)return;if(dup(v,gsRen)){$('.QQ-gs-dup').hidden=false;return}plant[gsRen].n=v;gsRen=-1;pintaPl()}
    del('click','.QQ-gs-ok',renOk);del('click','.QQ-gs-x',function(){gsRen=-1;pintaPl()});
    del('keydown','.QQ-gs-in',function(e){if(e.key==='Enter'){e.preventDefault();renOk()}else if(e.key==='Escape'){e.stopPropagation();gsRen=-1;pintaPl()}});
    on('.QQ-gs-reint','click',function(){gsOper='';pintaPl()});

    /* ================= Suplementación ================= */
    if(CFG.tipo==='sup')(function(){
      var SUP=[
        {n:'Vitamina D3',dd:'5,000 UI/día',k:'70–100 UI/kg/día',mn:70,mx:100,u:'UI',b:'Absorción de calcio y mineralización ósea. Con IMC elevado se requieren dosis de carga para saturar receptores. Clave para unión ósea en cirugía de columna y artroplastia.'},
        {n:'Vitamina K2 (MK-7)',dd:'100 mcg/día',k:'1.5–2 mcg/kg/día',mn:1.5,mx:2,u:'mcg',pt:'cápsula',pc:100,b:'Activa la osteocalcina y dirige el calcio al hueso. Evita calcificación de ligamentos y arterias. Sinergia indispensable con Vitamina D3.'},
        {n:'Omega-3 (EPA/DHA)',dd:'2–3 g/día con alimentos',k:'30–40 mg/kg/día',mn:30,mx:40,u:'mg',pt:'cápsula',pc:640,b:'A >3 g/día modula la cascada del ácido araquidónico. Reduce inflamación en entesis y discos intervertebrales. Alternativa coadyuvante a AINEs en radiculopatía crónica.'},
        {n:'Colágeno Hidrolizado + Vitamina C',dd:'10–15 g + 500 mg en ayunas',k:'0.10–0.15 g/kg/día',mn:.10,mx:.15,u:'g',pt:'cucharada',pc:5,pn:'+ 1 tableta de Vitamina C 1,000 mg — tomar en ayunas',b:'Aporta glicina y prolina para reparación de fascia y anillo fibroso del disco. Tomar en ayunas con vitamina C para máxima biodisponibilidad.'},
        {n:'Creatina Monohidratada',dd:'5 g/día',k:'0.07–0.10 g/kg/día',mn:.07,mx:.10,u:'g',pt:'scoop',pc:5,b:'Síntesis de ATP muscular y retención de nitrógeno. Previene sarcopenia y atrofia por desuso. Mejora potencia en rehabilitación incluso con déficit calórico.'},
        {n:'Magnesio Glicinato',dd:'300–400 mg/día',k:'4–6 mg/kg/día',mn:4,mx:6,u:'mg',pt:'cápsula',pc:500,b:'Relajación de musculatura paravertebral y cofactor en formación de matriz ósea. Alta biodisponibilidad sin efectos laxantes del óxido o citrato.'},
        {n:'Cúrcuma (Curcumina 95%)',dd:'500–1,000 mg/día',k:'8–10 mg/kg/día',mn:8,mx:10,u:'mg',pt:'cápsula',pc:500,b:'Inhibidor natural de NF-kB y COX-2. Reduce dolor articular crónico sin daño gástrico. Efecto comparable a dosis bajas de diclofenaco después de 4 semanas continuas.'},
        {n:'HMB (Beta-hidroxi-beta-metilbutirato)',dd:'3 g/día (3 tomas)',k:'30–40 mg/kg/día',mn:30,mx:40,u:'mg',pt:'cápsula',pc:1000,b:'Anticatabólico. Protege masa muscular en déficit calórico y periodos de estrés quirúrgico o posoperatorio.'},
        {n:'Ashwagandha KSM-66',dd:'1 cápsula al día',k:null,mn:0,mx:0,u:'mg',pt:'cápsula',pc:600,b:'Modulador de cortisol. Reduce gluconeogénesis inducida por estrés, protegiendo masa muscular. Indicado en pacientes con alta carga laboral o entrenamiento de alta intensidad.'}];
      var INI={fecha:'19 nov 2026',paciente:'Paciente Prueba 01',diag:'Lumbago',peso:'',sel:[],notas:'',control:''},ed=-1,pesoAnt='';
      function cat(n){for(var i=0;i<SUP.length;i++)if(SUP[i].n===n)return SUP[i]}
      function peso(){var n=parseFloat(String(st.peso).replace(',','.'));return n>0?n:0}
      /* Mismo cálculo que el formulario de hoy: cápsulas/cucharadas por la dosis mínima por kilo; sin presentación, rango en su unidad */
      function dosis(s,w){if(!s.mn)return s.dd;if(!(w>0))return '';
        if(s.pt){var n=Math.max(1,Math.round(s.mn*w/s.pc)),t=s.pt,l=n===1?t:t==='cucharada'?'cucharadas':t==='cápsula'?'cápsulas':t+'s';return n+' '+l+' al día'+(s.pn?' — '+s.pn:'')}
        var f=function(x){return x>=1000?Math.round(x).toLocaleString('es-MX'):x>=10?String(Math.round(x)):String(parseFloat(x.toFixed(1)))};return f(s.mn*w)+'–'+f(s.mx*w)+' '+s.u+'/día'}
      function nueva(n){return {n:n,dosis:dosis(cat(n),peso()),marca:'',just:'',ed:false}}
      function orden(){st.sel.sort(function(a,b){return SUP.indexOf(cat(a.n))-SUP.indexOf(cat(b.n))})}
      function pintaCat(){$$('.QQ-cat-l>li').forEach(function(li){var s=li.dataset.n;
          li.querySelector('.QQ-cat').setAttribute('aria-checked',String(st.sel.some(function(x){return x.n===s})))})}
      V.pinta=function(){$$('.QQ-sup-n').forEach(function(x){x.textContent=st.sel.length+' de '+SUP.length});
        $('.QQ-sup-l').innerHTML=st.sel.map(function(s,i){var m2=[s.marca.trim(),s.just.trim()].filter(Boolean).join(' · ');
          return '<li class="QQ-r QQ-sr"><button type="button" class="QQ-p QQ-sr-b" data-i="'+i+'" aria-haspopup="dialog"><span class="QQ-sr-n">'+h(s.n)+'</span>'
            +'<span class="QQ-sr-d'+(s.dosis?'':' QQ-nada')+'">'+h(s.dosis||'Escribe el peso y se calcula')+'</span>'+(m2?'<span class="QQ-sr-m">'+h(m2)+'</span>':'')+'</button>'
            +'<button type="button" class="QQ-p QQ-ib QQ-ten QQ-sr-x" data-i="'+i+'" aria-label="Quitar '+h(s.n)+'">'+X_SVG+'</button></li>'}).join('');
        pintaCat()};
      $('.QQ-cat-l').innerHTML=SUP.map(function(s){return '<li data-n="'+h(s.n)+'"><button type="button" class="QQ-p QQ-mr QQ-ck2 QQ-cat" role="checkbox" aria-checked="false"><span class="QQ-mr-t"><span class="QQ-cat-n">'+h(s.n)+'</span>'
        +'<span class="QQ-mr-s QQ-num">'+h(s.k||s.dd)+'</span><span class="QQ-cat-ben">'+h(s.b)+'</span></span>'+OK_SVG+'</button><button type="button" class="QQ-p QQ-txt QQ-vermas" hidden>Ver completo</button></li>'}).join('');
      on('.QQ-b-cat','click',function(e){pintaCat();abre('cat',e.currentTarget);
        $$('.QQ-cat-l>li').forEach(function(li){var b=li.querySelector('.QQ-cat-ben');if(!li.classList.contains('QQ-todo'))li.querySelector('.QQ-vermas').hidden=!(b.scrollHeight-b.clientHeight>1)})});
      del('click','.QQ-cat',function(e,b){var n=b.closest('li').dataset.n,i=-1;st.sel.forEach(function(x,j){if(x.n===n)i=j});if(i>=0)st.sel.splice(i,1);else{st.sel.push(nueva(n));orden()}V.pinta();refresca()});
      del('click','.QQ-vermas',function(e,b){var li=b.closest('li'),t=li.classList.toggle('QQ-todo');b.textContent=t?'Ver menos':'Ver completo'});
      del('click','.QQ-sr-x',function(e,b){st.sel.splice(+b.dataset.i,1);V.pinta();refresca();$('.QQ-b-cat').focus({preventScroll:true})});
      del('click','.QQ-sr-b',function(e,b){ed=+b.dataset.i;var s=st.sel[ed],c=cat(s.n);$('.QQ-se-t').textContent=s.n;$('.QQ-se-ref').textContent=c.k||c.dd;$('.QQ-se-ben').textContent=c.b;
        var d=$('.QQ-se-dosis');d.value=s.dosis;d.placeholder=peso()?'':'Escribe el peso y se calcula';$('.QQ-se-marca').value=s.marca;$('.QQ-se-just').value=s.just;abre('sup',b)});
      on('.QQ-se-dosis','input',function(e){if(st.sel[ed]){st.sel[ed].dosis=e.target.value;st.sel[ed].ed=true}});
      on('.QQ-se-marca','input',function(e){if(st.sel[ed])st.sel[ed].marca=e.target.value});on('.QQ-se-just','input',function(e){if(st.sel[ed])st.sel[ed].just=e.target.value});
      V.alCerrar=function(p){if(p==='sup'||p==='cat'){V.pinta();refresca()}};
      /* Recalcular al corregir el peso sin pisar lo escrito a mano (texto de hoy) */
      V.cambio=function(k){if(k!=='peso'||st.peso===pesoAnt)return;pesoAnt=st.peso;var r=0,c=0;st.sel.forEach(function(s){if(s.ed)c++;else{s.dosis=dosis(cat(s.n),peso());r++}});
        var el=$('.QQ-recalc');el.hidden=!st.sel.length;if(!st.sel.length)return;
        var t=r===1?'Se recalculó 1 dosis':'Se recalcularon '+r+' dosis';
        el.textContent=c===0?t+'.':r===0?(c===1?'No se recalculó ninguna dosis: la editaste a mano.':'No se recalculó ninguna dosis: editaste las '+c+'.'):c===1?t+'; 1 se conservó porque la editaste':t+'; '+c+' se conservaron porque las editaste';V.pinta()};
      V.vacio=function(){return !st.sel.length&&!st.notas.trim()&&!st.control.trim()};
      V.faltan=function(){var f=[];if(!st.paciente.trim())f.push({c:'paciente',n:'Paciente'});if(!peso())f.push({c:'peso',n:'Peso'});if(!st.sel.length)f.push({c:'sup',n:'Suplementos'});return f};
      function pon(o){st=JSON.parse(JSON.stringify(o));pesoAnt=st.peso;$('.QQ-recalc').hidden=true}
      V.limpia=function(){pon(INI)};
      V.llena=function(){pon(INI);st.peso='78';pesoAnt='78';st.sel=[nueva('Vitamina D3'),nueva('Omega-3 (EPA/DHA)'),nueva('Magnesio Glicinato')];st.sel[1].marca='Nordic Naturals';st.sel[2].just='Contractura paravertebral nocturna';
        st.notas='Tomar con alimentos. Suspender y avisar si hay molestias gástricas.';st.control='En 3 meses con nuevos laboratorios'};
      V.aplica=function(){st.sel=[nueva('Vitamina D3'),nueva('Vitamina K2 (MK-7)'),nueva('Colágeno Hidrolizado + Vitamina C')];st.notas='Iniciar dos semanas antes de la cirugía.';st.control='En 3 meses con nuevos laboratorios'};
      V.vacia=function(){st.sel=[];st.notas='';st.control=''};
      api.editada=function(){V.llena();st.sel[0].dosis='4,000 UI/día';st.sel[0].ed=true;pintaTodo();st.peso='85';pintaCampos();V.cambio('peso');cont.scrollTop=0};
      api.extras=[['Peso corregido (recálculo)','editada']];
    })();

    /* ================= Internamiento ================= */
    if(CFG.tipo==='inter')(function(){
      var DEF='• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).\n• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.\n• No traer objetos de valor, joyas ni alhajas.\n• Venir acompañado de un familiar mayor de edad responsable.\n• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.\n• Traer ropa cómoda y artículos de aseo personal para su estancia.';
      var FIJOS=['Dieta','Soluciones','Medicamentos','Cuidados de enfermería'],EJ={Dieta:'Ayuno estricto de 8 horas',Soluciones:'Solución Hartmann 1000 ml para 24 horas',Medicamentos:'Cefalotina 1 g IV una hora antes de la cirugía','Cuidados de enfermería':'Signos vitales cada 8 horas'};
      var INI={fecha:'19 nov 2026',paciente:'Paciente Prueba 01',tipo:'',ingreso:'',dias:'',asa:'',lugar:'',urgente:false,dx:'Gonalgia',sec:[],proc:'',req:[],reqOtro:'',just:'',instr:DEF,grupos:[]};
      var ab={instr:false,piso:false},nuevo=false;
      function ord(n){var i=FIJOS.indexOf(n);return i<0?FIJOS.length:i}
      function ordena(){st.grupos=st.grupos.map(function(g,i){return [g,i]}).sort(function(a,b){return ord(a[0].n)-ord(b[0].n)||a[1]-b[1]}).map(function(x){return x[0]})}
      function nren(){return st.grupos.reduce(function(a,g){return a+g.r.length},0)}
      function resumen(){var g=st.grupos.length,r=nren();
        $('[data-res="instr"]').textContent=st.instr!==DEF?'Editada':'';
        $('[data-res="piso"]').textContent=!g?'':g+(g===1?' grupo':' grupos')+(ab.piso?'':' · '+r+(r===1?' renglón':' renglones'))}
      function pintaSec(){$('.QQ-sec-l').innerHTML=st.sec.map(function(d,i){return '<li class="QQ-r QQ-rl"><input type="text" class="QQ-in QQ-sec-in" data-i="'+i+'" value="'+h(d)+'" placeholder="Secundario '+(i+1)+'" aria-label="Diagnóstico secundario '+(i+1)+'" autocomplete="off">'
        +'<button type="button" class="QQ-p QQ-ib QQ-ten QQ-sec-x" data-i="'+i+'" aria-label="'+(d.trim()?'Eliminar '+h(d.trim()):'Eliminar secundario '+(i+1))+'">'+X_SVG+'</button></li>'}).join('')}
      function pintaPiso(){var nom=st.grupos.map(function(g){return g.n}),prop=nom.filter(function(n){return ord(n)===FIJOS.length});
        $('.QQ-chips').innerHTML=FIJOS.concat(prop).map(function(n){return '<button type="button" class="QQ-p QQ-chipb QQ-grp" aria-pressed="'+(nom.indexOf(n)>=0)+'" data-n="'+h(n)+'">'+h(n)+'</button>'}).join('')
          +'<button type="button" class="QQ-p QQ-chipb QQ-otro QQ-grp-otro">Otro grupo</button>';
        $('.QQ-nuevo').hidden=!nuevo;$('.QQ-piso-0').hidden=st.grupos.length>0;
        $('.QQ-grupos').innerHTML=st.grupos.map(function(g,gi){return '<div class="QQ-gb"><div class="QQ-gb-c"><b>'+h(g.n)+'</b><span>· '+g.r.length+(g.r.length===1?' renglón':' renglones')+'</span><span class="QQ-flex"></span>'
          +'<button type="button" class="QQ-p QQ-ib QQ-ten QQ-gb-x" data-g="'+gi+'" aria-label="Eliminar grupo '+h(g.n)+'">'+BAS_SVG+'</button></div>'
          +g.r.map(function(r,ri){return '<div class="QQ-r QQ-rl"><input type="text" class="QQ-in QQ-ren-in" data-g="'+gi+'" data-r="'+ri+'" value="'+h(r)+'" placeholder="Ej: '+h(EJ[g.n]||'Una indicación por renglón')+'" aria-label="Renglón '+(ri+1)+' de '+h(g.n)+'" autocomplete="off">'
            +'<button type="button" class="QQ-p QQ-ib QQ-ten QQ-ren-x" data-g="'+gi+'" data-r="'+ri+'" aria-label="'+(r.trim()?'Eliminar '+h(r.trim()):'Eliminar renglón '+(ri+1))+'">'+X_SVG+'</button></div>'}).join('')
          +'<button type="button" class="QQ-p QQ-r QQ-add QQ-ren-mas" data-g="'+gi+'">'+PLUS_SVG+'Agregar renglón</button></div>'}).join('');resumen()}
      V.pinta=function(){pintaSec();pintaPiso();
        $$('.QQ-req').forEach(function(b){b.setAttribute('aria-pressed',String(st.req.indexOf(b.dataset.v)>=0))});
        $('.QQ-urg').setAttribute('aria-checked',String(st.urgente));$('.QQ-urg-c').hidden=!st.urgente;
        $$('.QQ-pl').forEach(function(b){var k=b.dataset.pl;b.setAttribute('aria-expanded',String(ab[k]));b.nextElementSibling.hidden=!ab[k]});resumen();creceTodo()};
      on('.QQ-pl','click',function(e){var k=e.currentTarget.dataset.pl;ab[k]=!ab[k];V.pinta()});
      on('.QQ-urg','click',function(){st.urgente=!st.urgente;V.pinta();refresca()});
      on('.QQ-req','click',function(e){var v=e.currentTarget.dataset.v,i=st.req.indexOf(v);if(i>=0)st.req.splice(i,1);else st.req.push(v);V.pinta();refresca()});
      on('.QQ-b-sec','click',function(){st.sec.push('');pintaSec();var a=$$('.QQ-sec-in');a[a.length-1].focus({preventScroll:true})});
      del('input','.QQ-sec-in',function(e,t){st.sec[+t.dataset.i]=t.value;refresca()});
      del('click','.QQ-sec-x',function(e,b){st.sec.splice(+b.dataset.i,1);pintaSec();refresca();$('.QQ-b-sec').focus({preventScroll:true})});
      del('click','.QQ-grp',function(e,b){var n=b.dataset.n,i=-1;st.grupos.forEach(function(g,j){if(g.n===n)i=j});if(i>=0)st.grupos.splice(i,1);else{st.grupos.push({n:n,r:['']});ordena()}pintaPiso();refresca()});
      del('click','.QQ-grp-otro',function(){nuevo=true;pintaPiso();var x=$('.QQ-nuevo-in');x.value='';x.focus({preventScroll:true})});
      function nuevoOk(){var n=$('.QQ-nuevo-in').value.trim();nuevo=false;if(n&&!st.grupos.some(function(g){return g.n.toLowerCase()===n.toLowerCase()})){st.grupos.push({n:n,r:['']});ordena()}pintaPiso();refresca()}
      on('.QQ-nuevo-ok','click',nuevoOk);on('.QQ-nuevo-x','click',function(){nuevo=false;pintaPiso()});
      on('.QQ-nuevo-in','keydown',function(e){if(e.key==='Enter'){e.preventDefault();nuevoOk()}else if(e.key==='Escape'){e.stopPropagation();nuevo=false;pintaPiso()}});
      del('input','.QQ-ren-in',function(e,t){st.grupos[+t.dataset.g].r[+t.dataset.r]=t.value;refresca()});
      del('click','.QQ-ren-x',function(e,b){st.grupos[+b.dataset.g].r.splice(+b.dataset.r,1);pintaPiso();refresca()});
      del('click','.QQ-ren-mas',function(e,b){var g=+b.dataset.g;st.grupos[g].r.push('');pintaPiso();var a=$$('.QQ-ren-in[data-g="'+g+'"]');a[a.length-1].focus({preventScroll:true})});
      del('click','.QQ-gb-x',function(e,b){st.grupos.splice(+b.dataset.g,1);pintaPiso();refresca()});
      V.cambio=function(k){if(k==='instr')resumen()};
      V.vacio=function(){return st.paciente===INI.paciente&&st.dx===INI.dx&&st.instr===DEF&&st.sec.every(function(d){return !d.trim()})&&!st.ingreso&&!st.tipo&&!st.dias.trim()&&!st.asa&&!st.lugar.trim()&&!st.urgente
        &&!st.proc.trim()&&!st.req.length&&!st.reqOtro.trim()&&!st.just.trim()&&!nren()};
      V.faltan=function(){var f=[];if(!st.paciente.trim())f.push({c:'paciente',n:'Paciente'});if(!st.lugar.trim())f.push({c:'lugar',n:'Hospital'});if(!st.dx.trim())f.push({c:'dx',n:'Diagnóstico principal'});
        if(!st.ingreso.trim())f.push({c:'ingreso',n:'Fecha de ingreso'});return f};
      V.extra=function(){return ab};V.ponExtra=function(){};
      V.limpia=function(){st=JSON.parse(JSON.stringify(INI));ab={instr:false,piso:false};nuevo=false};
      function comun(){st.tipo='Cirugía electiva';st.dias='1-2 días';st.asa='ASA II';st.proc='Artroscopia diagnóstica y terapéutica de rodilla derecha.';st.req=['Ayuno preoperatorio','Profilaxis antibiótica'];
        st.grupos=[{n:'Dieta',r:['Ayuno estricto de 8 horas']},{n:'Medicamentos',r:['Cefalotina 1 g IV una hora antes de la cirugía','Paracetamol 1 g IV cada 8 horas']}]}
      V.llena=function(){V.limpia();comun();st.ingreso='26 nov 2026';st.lugar='Hospital Semilla Norte';st.sec=['Lumbago'];st.just='Gonalgia de 6 meses de evolución sin respuesta a tratamiento conservador ni a rehabilitación.'};
      V.aplica=function(){comun()};
      V.vacia=function(){var p=st.paciente,d=st.dx,f=st.fecha;V.limpia();st.paciente=p;st.dx=d;st.fecha=f};
      api.sinDatos=function(){V.limpia();st.paciente='';st.dx='';intentado=true;pintaTodo();cont.scrollTop=0};
      api.abiertas=function(){V.llena();ab={instr:true,piso:true};pintaTodo();var p=$('.QQ-pl[data-pl="instr"]');cont.scrollTop=Math.max(0,(p.getBoundingClientRect().top-cont.getBoundingClientRect().top)/zoom()+cont.scrollTop-12)};
      api.urgente=function(){st.urgente=!st.urgente;pintaTodo()};
      api.extras=[['Validación (faltan 4)','sinDatos'],['Urgente','urgente'],['Secciones abiertas','abiertas']];
    })();

    /* ================= Escrito médico ================= */
    if(CFG.tipo==='escrito')(function(){
      var INI={fecha:'19 nov 2026',paciente:'Paciente Prueba 01',titulo:'',pie:'',eng:true},ed=$('.QQ-ed'),rango=null;
      var EJ='<p>A quien corresponda:</p><p>Por medio de la presente hago constar que <b>Paciente Prueba 01</b>, de 73 años, acudió a consulta de Ortopedia y Traumatología el 19 de noviembre de 2026 por <b>lumbago</b> de dos semanas de evolución.</p><h3>Indicaciones</h3><ul><li>Reposo relativo durante 5 días.</li><li>Evitar cargar objetos pesados.</li><li>Cita de control en 2 semanas.</li></ul><p>Se extiende la presente a petición del interesado, para los fines que convengan.</p>';
      var AL={left:['justifyLeft','Izquierda'],center:['justifyCenter','Centro'],right:['justifyRight','Derecha'],justify:['justifyFull','Justificado']},BL={p:'Normal',h2:'Título',h3:'Subtítulo'};
      function vacioEd(){return !ed.textContent.trim()&&!ed.querySelector('hr,li')}
      function nbl(){var n=0;[].forEach.call(ed.children,function(c){n+=/^(UL|OL)$/.test(c.tagName)?c.children.length:1});return n||(ed.textContent.trim()?1:0)}
      function dentro(){var s=getSelection();return s.rangeCount&&ed.contains(s.anchorNode)}
      function guarda(){if(dentro())rango=getSelection().getRangeAt(0).cloneRange()}
      function vuelve(){ed.focus({preventScroll:true});if(rango){var s=getSelection();s.removeAllRanges();s.addRange(rango)}}
      function nodo(tag){var s=getSelection();if(!s.rangeCount)return null;var n=s.anchorNode;n=n&&n.nodeType===3?n.parentNode:n;return n&&n.closest?n.closest(tag):null}
      function estado(){var e=vacioEd();if(e&&ed.innerHTML!=='')ed.innerHTML='';
        $('.QQ-bloques').textContent=e?'Vacío':nbl()+(nbl()===1?' bloque':' bloques');
        var act=dentro(),q=function(c){try{return act&&document.queryCommandState(c)}catch(x){return false}};
        var on_={bold:q('bold'),italic:q('italic'),underline:q('underline'),ul:q('insertUnorderedList'),ol:q('insertOrderedList'),quote:!!(act&&nodo('blockquote'))};
        $$('[data-f]').forEach(function(b){var k=b.dataset.f;if(k in on_){b.setAttribute(b.hasAttribute('aria-checked')?'aria-checked':'aria-pressed',String(!!on_[k]))}});
        var bl=act&&nodo('h2')?'h2':act&&nodo('h3')?'h3':'p',al=alAct();
        var bb=$('.QQ-fb-bl');bb.setAttribute('aria-label','Bloque: '+BL[bl]);bb.querySelector('.QQ-fb-bn').textContent=BL[bl];bb.querySelector('.QQ-fb-bi').innerHTML=$('[data-bl="'+bl+'"] .QQ-mi').innerHTML.replace(/width="20" height="20"/,'width="18" height="18"');
        var ba=$('.QQ-fb-al');ba.setAttribute('aria-label','Alineación: '+AL[al][1]);ba.querySelector('.QQ-fb-ali').innerHTML=$('[data-al="'+al+'"] .QQ-mi').innerHTML.replace(/width="20" height="20"/,'width="18" height="18"');
        $$('.QQ-al-v').forEach(function(v){v.textContent=AL[al][1];v.parentNode.querySelector('.QQ-mi').innerHTML=$('[data-al="'+al+'"] .QQ-mi').innerHTML});
        $$('[data-bl]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.bl===bl))});$$('[data-al]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.al===al))});
        refresca()}
      /* Alineación: la del bloque donde está el cursor. Sin elección del médico, el párrafo se ve justificado (CSS); la suya va en línea y manda. */
      function bloque(){var n=nodo('p,h2,h3,li,blockquote,div');return n&&n!==ed&&ed.contains(n)?n:null}
      function alAct(){var n=dentro()&&bloque();if(!n)return 'justify';var t=getComputedStyle(n).textAlign;return t==='center'||t==='right'||t==='justify'?t:t==='end'?'right':'left'}
      function exe(c,v){document.execCommand(c,false,v||null)}
      function formato(f){vuelve();
        if(f==='bold'||f==='italic'||f==='underline')exe(f);else if(f==='ul')exe('insertUnorderedList');else if(f==='ol')exe('insertOrderedList');
        else if(f==='quote')exe('formatBlock',nodo('blockquote')?'p':'blockquote');else if(f==='hr')exe('insertHorizontalRule');
        else if(f==='clear'){exe('removeFormat');exe('formatBlock','p');var nb=bloque();if(nb){nb.style.textAlign='';nb.removeAttribute('align');if(!nb.getAttribute('style'))nb.removeAttribute('style')}}
        guarda();estado()}
      try{document.execCommand('defaultParagraphSeparator',false,'p')}catch(x){}
      /* Los botones de la barra no roban el foco al texto */
      del('mousedown','.QQ-fb-b',function(e){guarda();e.preventDefault()});
      del('click','.QQ-fb-b[data-f]',function(e,b){formato(b.dataset.f)});
      del('click','.QQ-fb-b[data-m]',function(e,b){abre(b.dataset.m,b)});
      del('click','.QQ-pan .QQ-mr[data-m]',function(e,b){abre(b.dataset.m)});
      del('click','.QQ-pan .QQ-mr[data-f]',function(e,b){origen=null;cierra();formato(b.dataset.f)});
      del('click','[data-bl]',function(e,b){origen=null;cierra();vuelve();exe('formatBlock',b.dataset.bl);guarda();estado()});
      del('click','[data-al]',function(e,b){origen=null;cierra();vuelve();var n=bloque();if(n)n.style.textAlign=b.dataset.al;else exe(AL[b.dataset.al][0]);guarda();estado()});
      ed.addEventListener('input',estado);ed.addEventListener('keyup',estado);ed.addEventListener('mouseup',estado);ed.addEventListener('focus',estado);ed.addEventListener('blur',guarda);
      /* Datos del documento: una fila que resume y abre la hoja con los cuatro campos */
      on('.QQ-dat','click',function(e){abre('datos',e.currentTarget)});
      V.pinta=function(){$('.QQ-dat-v').textContent=[st.fecha,st.paciente.trim()||'Sin paciente',st.titulo.trim()||'Sin título'].join(' · ');
        $('.QQ-h-pac').hidden=!!st.paciente.trim();$('.QQ-usar').hidden=st.eng;
        $('.QQ-h-tit').textContent=st.titulo.trim()?'Encabeza el documento. Puede quedar vacío.':'Sin título, el documento arranca con el cuerpo bajo el filete del membrete.';estado()};
      /* El pie copia el título mientras nadie lo toque; al editarlo se desengancha y aparece «Usar el título» */
      V.cambio=function(k){if(k==='titulo'&&st.eng){st.pie=st.titulo;pintaCampos()}if(k==='pie'){st.eng=false}V.pinta()};
      on('.QQ-usar','click',function(){st.eng=true;st.pie=st.titulo;pintaCampos();V.pinta()});
      V.vacio=function(){return vacioEd()&&!st.titulo.trim()};
      V.faltaTxt='Falta el cuerpo del escrito. Es el único campo obligatorio.';
      V.faltan=function(){return vacioEd()?[{c:'cuerpo',n:'cuerpo'}]:[]};
      V.extra=function(){return ed.innerHTML};V.ponExtra=function(x){ed.innerHTML=x||''};
      V.limpia=function(){st=JSON.parse(JSON.stringify(INI));ed.innerHTML='';rango=null};
      V.llena=function(){V.limpia();st.titulo='Constancia de atención médica';st.pie=st.titulo;ed.innerHTML=EJ};
      V.aplica=function(n){st.titulo=n==='Justificante de reposo'?'Justificante de reposo':'Constancia de atención médica';if(st.eng)st.pie=st.titulo;ed.innerHTML=EJ};
      V.vacia=function(){st.titulo='';if(st.eng)st.pie='';ed.innerHTML=''};
      api.sinPac=function(){st.paciente='';pintaTodo();abre('datos',$('.QQ-dat'))};
      api.pieProp=function(){V.llena();st.titulo='Constancia de atención médica y valoración ortopédica para trámite escolar';st.pie='Constancia de atención médica';st.eng=false;pintaTodo();abre('datos',$('.QQ-dat'))};
      api.extras=[['Sin paciente','sinPac'],['Título del pie propio','pieProp']];
    })();

    /* ---- Estados de maqueta ---- */
    function reinicia(){clearTimeout(tI);ocupado=false;intentado=false;foto=null;gsOper='';pan&&cierra();plIni();ponImp('Imprimir',false);$('.QQ-av-pl').hidden=true;$('.QQ-perfil').hidden=true}
    api.ini=function(){reinicia();V.limpia();pintaTodo();cont.scrollTop=0};
    api.lleno=function(){reinicia();V.llena();pintaTodo();cont.scrollTop=0};
    api.perfil=function(){var p=$('.QQ-perfil');p.hidden=!p.hidden};
    api.cargaPerfil=function(){var b=$('.QQ-b-imp');if(b.disabled)ponImp('Imprimir',false);else ponImp('Cargando tu perfil…',true);};
    api.generando=function(){var b=$('.QQ-b-imp');if(b.disabled)ponImp('Imprimir',false);else ponImp('Generando PDF…',true);};
    api.generado=function(){genAbre(true)};api.noExp=function(){genAbre(false)};
    api.sinPl=function(){plant=[];plErr=false;pintaPl();abre('usar')};
    api.errPl=function(){plErr=true;pintaPl();abre('usar')};
    api.topePl=function(){plIni();for(var i=plant.length;i<10;i++)plant.push({n:'Plantilla '+(i+1),f:'Actualizada el 2 de octubre'});abre('tope')};
    api.errOper=function(){plIni();gsOper='No se pudo eliminar «'+plant[0].n+'».';abreGest()};
    apis.push(api);
    plIni();V.limpia();pintaTodo();
    new MutationObserver(creceTodo).observe(m,{attributes:true,attributeFilter:['style']});  /* al mostrarse el marco, las áreas de texto toman su alto */
  });

  /* Tira de controles de la maqueta: fuera del marco, una sola para los cuatro */
  var tira=document.createElement('div');tira.className='QQ-tira';tira.innerHTML='<span>Maqueta</span>';
  [['Inicial','ini'],['Lleno','lleno']].concat(apis[0].extras||[]).concat([['Generando PDF…','generando'],['Cargando tu perfil…','cargaPerfil'],['Perfil incompleto','perfil'],['Documento generado','generado'],['No quedó en el expediente','noExp'],
    ['Sin plantillas','sinPl'],['Error de plantillas','errPl'],['Tope de plantillas','topePl'],['Error en una plantilla','errOper']]).forEach(function(c){
    var b=document.createElement('button');b.type='button';b.textContent=c[0];b.addEventListener('click',function(){apis.forEach(function(a){if(a[c[1]])a[c[1]]()})});tira.appendChild(b)});
  var op=marcos[0].closest('.op');if(op)op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
})();
