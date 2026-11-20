  /* ===== Chasis común del taller: capas, menú «···», cambio de tipo, plantillas, documento generado, faltantes =====
     Maqueta: nada sale de la página. «Generando PDF…», «Enviando…» y «Guardando…» son temporizadores. */
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function chasis(m,cfg){
    var vp=m.dataset.vp,esc=vp==='esc',ancho=esc||vp==='ih';
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var on=function(s,ev,f){$$(s).forEach(function(e){e.addEventListener(ev,f)})};
    var cont=$('.PX-cont'),capa=$('.PX-capa'),pan=null,origen=null,previa=null,tToast=0;
    var A={$:$,$$:$$,on:on,vp:vp,esc:esc,ancho:ancho,cont:cont};

    A.toast=function(t){var x=$('.PX-toast');x.firstChild.textContent=t;x.classList.add('PX-on');clearTimeout(tToast);tToast=setTimeout(function(){x.classList.remove('PX-on')},2800)};
    /* ---- Capas. `vuelve`: al cerrar una alerta abierta desde una hoja, regresa a esa hoja ---- */
    A.abre=function(p,desde,vuelve){if(desde)origen=desde;previa=vuelve||null;pan=p;var x=$('.PX-pan[data-pan="'+p+'"]');
      $$('.PX-pan').forEach(function(y){y.classList.toggle('PX-act',y===x)});
      capa.classList.toggle('PX-sinvelo',p==='menu'&&esc);capa.classList.add('PX-on');capa.setAttribute('aria-hidden','false');
      if(p==='menu'&&esc){var b=$('.PX-mas-b').getBoundingClientRect(),r=m.getBoundingClientRect(),z=r.width/m.offsetWidth||1;  /* el menú nace de su botón */
        x.style.top=((b.bottom-r.top)/z+4)+'px';x.style.left=((b.right-r.left)/z-264)+'px'}
      var f=x.querySelector('[data-foco]')||x;f.focus({preventScroll:true})};
    A.cierra=function(){if(!pan)return;var v=previa;previa=null;if(v){A.abre(v);return}
      pan=null;capa.classList.remove('PX-on');capa.setAttribute('aria-hidden','true');$$('.PX-pan').forEach(function(y){y.classList.remove('PX-act')});
      if(origen&&origen.offsetParent)origen.focus({preventScroll:true})};
    A.cierraTodo=function(){previa=null;A.cierra()};
    A.abierta=function(){return pan};
    /* El marco nunca se desplaza: si el navegador lo mueve al enfocar algo dentro de una capa, se devuelve a su sitio */
    m.addEventListener('scroll',function(e){var t=e.target;if(t===m||/PX-(app|capa|col|firma)( |$)/.test(t.className)){t.scrollTop=0;t.scrollLeft=0}},true);
    on('.PX-cierra','click',A.cierra);$('.PX-velo').addEventListener('click',function(){if(!capa.classList.contains('PX-fijo'))A.cierra()});
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&pan){e.stopPropagation();A.cierra()}});
    on('a[href="#"]','click',function(e){e.preventDefault()});
    /* Áreas de texto que crecen con su contenido */
    A.crece=function(t){t.style.height='auto';if(t.scrollHeight)t.style.height=t.scrollHeight+'px'};
    on('.PX-ta','input',function(e){A.crece(e.currentTarget)});
    A.creceTodo=function(){$$('.PX-ta').forEach(A.crece)};

    /* ---- «···» ---- */
    $('.PX-mas-b').addEventListener('click',function(e){cfg.alAbrirMenu&&cfg.alAbrirMenu();A.abre('menu',e.currentTarget)});
    on('.PX-menu [data-a]','click',function(e){var a=e.currentTarget.dataset.a;
      if(e.currentTarget.getAttribute('aria-disabled')==='true'){A.cierraTodo();A.toast(e.currentTarget.dataset.motivo);return}
      A.cierraTodo();if(a==='gpl')A.guardarPl();else if(a==='gest')abreGest();else cfg.accion&&cfg.accion(a)});

    /* ---- Cambiar de tipo: rejilla de nivel 4; con datos empezados, la confirmación de hoy ---- */
    var entrante='';
    on('.PX-camb','click',function(e){A.abre('tipo',e.currentTarget)});
    on('.PX-az','click',function(e){var b=e.currentTarget;if(b.getAttribute('aria-current')==='true'){A.cierraTodo();return}
      entrante=b.dataset.n;if(cfg.vacio()){A.cierraTodo();A.toast('Maqueta: aquí se abre el formulario de '+entrante)}
      else{$$('.PX-ent').forEach(function(x){x.textContent=entrante});A.abre('camb',null,'tipo')}});
    on('.PX-camb-ok','click',function(){A.cierraTodo();cfg.vaciar();A.toast('Maqueta: aquí se abre el formulario de '+entrante)});

    /* ---- Plantillas ---- */
    var PL=cfg.plantillas.slice(),sel='',deshacer=null,TOPE=10;
    function pintaPl(){var n=PL.length;
      $$('.PX-pl-n').forEach(function(x){x.textContent=n>=TOPE?TOPE+' de '+TOPE+' · el máximo':n+' de '+TOPE+' guardadas';x.hidden=!n});
      $$('.PX-pl-cta').forEach(function(x){x.textContent=n+' / '+TOPE});
      $('.PX-pick-l').innerHTML=n?['__v','',].concat(PL.map(function(p){return p[0]})).map(function(k){var t=k==='__v'?'Vaciar formulario':k===''?'— Sin plantilla —':k,dis=k==='__v'&&cfg.vacio();
        return '<li><button type="button" class="PX-p PX-mr" data-n="'+h(k)+'" aria-pressed="'+(k===sel)+'"'+(dis?' disabled':'')+'><span class="PX-flex">'+h(t)+'</span>'+cfg.OK+'</button></li>'}).join(''):'';
      $$('.PX-pl-sel').forEach(function(x){x.textContent=sel||'— Sin plantilla —'});
      $('.PX-pick-vacio').hidden=!!n;$('.PX-pick-pie').hidden=!n;
      $('.PX-gest-l').innerHTML=PL.map(function(p,i){return '<li class="PX-pl" data-i="'+i+'"><button type="button" class="PX-p PX-mr PX-pl-b" aria-expanded="false"><span class="PX-ct">'+h(p[0])+'<small>'+h(p[1])+'</small></span>'+cfg.FLECHA+'</button>'
        +'<div class="PX-pl-acc" hidden><button type="button" class="PX-p PX-txt" data-o="ren">Renombrar</button><button type="button" class="PX-p PX-txt" data-o="sob">Sobrescribir</button><button type="button" class="PX-p PX-txt" data-o="eli">Eliminar</button></div>'
        +'<div class="PX-pl-ed" hidden><input type="text" class="PX-campo" maxlength="40" aria-label="Nuevo nombre de '+h(p[0])+'"><button type="button" class="PX-p PX-txt" data-o="can">Cancelar</button></div><p class="PX-nota PX-pl-dup" hidden>Ya tienes una con ese nombre.</p></li>'}).join('');
      $('.PX-gest-vacio').hidden=!!n}
    function abrePicker(){pintaPl();A.abre('pick',$('.PX-pl-fila'))}
    on('.PX-pl-fila','click',abrePicker);
    function abreGest(){pintaPl();A.abre('gest',$('.PX-mas-b'))}
    function guardarPl(){if(PL.length>=TOPE){A.abre('tope',$('.PX-mas-b'));return}var i=$('.PX-gpl-in');i.value='';$('.PX-gpl-dup').hidden=true;A.abre('gpl',$('.PX-mas-b'))}
    A.guardarPl=function(desde){if(cfg.vacio()){A.toast('Llena algún campo de los que la plantilla guarda para poder guardarla.');return}guardarPl()};
    A.plantillas=function(l){PL=l.slice();sel='';pintaPl()};
    function aviso(t){$$('.PX-pl-av').forEach(function(x){x.hidden=!t;if(t)x.querySelector('span').textContent=t})}
    $('.PX-pick-l').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;var k=b.dataset.n;A.cierraTodo();if(k===sel&&k!=='__v')return;
      deshacer={s:cfg.foto(),sel:sel};
      if(k==='__v'){cfg.vaciar(true);sel='';aviso('Se vació el formulario. Los datos del paciente no cambiaron.')}
      else if(k===''){sel='';deshacer=null;aviso('')}
      else{cfg.aplicar(k);sel=k;aviso('Se aplicó «'+k+'». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.')}
      pintaPl();cont.scrollTop=0});
    on('.PX-pl-des','click',function(){if(deshacer){cfg.revela(deshacer.s);sel=deshacer.sel;deshacer=null}aviso('');pintaPl()});
    A.sinAviso=function(){aviso('');deshacer=null;sel='';pintaPl()};
    on('.PX-pick-gest','click',function(){A.cierraTodo();abreGest()});
    function dup(n,salvo){n=n.trim().toLowerCase();return PL.some(function(p,i){return i!==salvo&&p[0].toLowerCase()===n})}
    $('.PX-gpl-in').addEventListener('input',function(e){$('.PX-gpl-dup').hidden=!dup(e.target.value,-1)});
    function gplOk(){var n=$('.PX-gpl-in').value.trim();if(!n||dup(n,-1))return;PL.push([n,'Actualizada el 19 de noviembre']);pintaPl();A.cierraTodo();A.toast('Plantilla «'+n+'» guardada')}
    on('.PX-gpl-ok','click',gplOk);$('.PX-gpl-in').addEventListener('keydown',function(e){if(e.key==='Enter')gplOk()});
    on('.PX-tope-ok','click',function(){A.cierraTodo();abreGest()});
    var conf=null;
    $('.PX-gest-l').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var li=b.closest('.PX-pl'),i=+li.dataset.i,o=b.dataset.o;
      if(b.classList.contains('PX-pl-b')){var ab=b.getAttribute('aria-expanded')==='true';$$('.PX-pl-b').forEach(function(x){x.setAttribute('aria-expanded','false');x.parentNode.querySelector('.PX-pl-acc').hidden=true});
        b.setAttribute('aria-expanded',String(!ab));li.querySelector('.PX-pl-acc').hidden=ab;return}
      if(o==='ren'){li.querySelector('.PX-pl-acc').hidden=true;li.querySelector('.PX-pl-ed').hidden=false;var inp=li.querySelector('input');inp.value=PL[i][0];inp.focus({preventScroll:true});inp.select()}
      else if(o==='can'){pintaPl()}
      else if(o==='sob'&&cfg.vacio()){A.toast('El formulario no tiene nada que una plantilla guarde: no hay con qué sobrescribir.')}
      else if(o==='sob'||o==='eli'){conf={o:o,i:i};$$('.PX-cpl-n').forEach(function(x){x.textContent=PL[i][0]});A.abre(o==='eli'?'pl-eli':'pl-sob',null,'gest')}});
    $('.PX-gest-l').addEventListener('keydown',function(e){if(e.target.tagName!=='INPUT')return;var li=e.target.closest('.PX-pl'),i=+li.dataset.i;
      if(e.key==='Escape'){e.stopPropagation();pintaPl()}
      else if(e.key==='Enter'){var n=e.target.value.trim();if(!n)return;if(dup(n,i)){li.querySelector('.PX-pl-dup').hidden=false;return}PL[i][0]=n;pintaPl()}});
    $('.PX-gest-l').addEventListener('input',function(e){var li=e.target.closest('.PX-pl');li.querySelector('.PX-pl-dup').hidden=!dup(e.target.value,+li.dataset.i)});
    on('.PX-cpl-ok','click',function(){if(!conf)return;if(conf.o==='eli'){PL.splice(conf.i,1)}else{PL[conf.i][1]='Actualizada el 19 de noviembre'}conf=null;pintaPl();A.cierra()});

    /* ---- Documento generado (el «modal posterior» de hoy) ---- */
    var CORREO=cfg.correo,tEnv=0;
    function genPaso(p){$$('.PX-gen [data-gp]').forEach(function(x){x.hidden=x.dataset.gp.split(' ').indexOf(p)<0})}
    A.generado=function(titulo,guardado,toastTxt){clearTimeout(tEnv);$('.PX-gen-t').textContent=titulo;$('.PX-gen').classList.toggle('PX-nog',!guardado);
      $('.PX-gen-s').hidden=!guardado;$('.PX-gen-w').hidden=guardado;var b=$('.PX-gen-mail');b.disabled=!guardado;b.querySelector('small').textContent=guardado?'Se enviará a '+CORREO:'No quedó en el expediente';
      b.querySelector('.PX-mr-s').textContent='';$('.PX-gen-otro').hidden=!guardado;$('.PX-gen-otro').disabled=false;$('.PX-gen-in').value='';$('.PX-gen-env').disabled=true;genPaso('listo');
      capa.classList.add('PX-fijo');A.abre('gen');if(toastTxt)A.toast(toastTxt)};
    function enviar(a,escrito){var b=$('.PX-gen-mail');genPaso('listo');b.disabled=true;$('.PX-gen-otro').disabled=true;b.querySelector('.PX-mr-s').textContent='Enviando…';
      tEnv=setTimeout(function(){b.querySelector('.PX-mr-s').textContent='Enviado';$$('.PX-gen-a').forEach(function(x){x.textContent=a});$('.PX-gen-of').hidden=!escrito;$('.PX-gen-g').hidden=true;genPaso('enviado')},RM?0:900)}
    on('.PX-gen-ver','click',function(){A.toast('Maqueta: aquí se abre el PDF en otra pestaña')});
    on('.PX-gen-comp','click',function(){A.toast(ancho?'Maqueta: aquí se descarga el PDF':'Maqueta: aquí se abre la hoja de compartir del sistema')});
    on('.PX-gen-mail','click',function(){enviar(CORREO,false)});
    on('.PX-gen-otro','click',function(){genPaso('pidiendo');$('.PX-gen-in').focus({preventScroll:true})});
    $('.PX-gen-in').addEventListener('input',function(e){$('.PX-gen-env').disabled=!/^\S+@\S+\.\S+$/.test(e.target.value.trim())});
    on('.PX-gen-can','click',function(){$('.PX-gen-in').value='';$('.PX-gen-env').disabled=true;genPaso('listo')});
    on('.PX-gen-env','click',function(){$('.PX-gen-dir').textContent=$('.PX-gen-in').value.trim();genPaso('confirmando')});
    on('.PX-gen-corr','click',function(){genPaso('pidiendo')});
    on('.PX-gen-si','click',function(){enviar($('.PX-gen-in').value.trim(),true)});
    on('.PX-gen-guarda','click',function(){$('.PX-gen-of').hidden=true;$('.PX-gen-g').hidden=false});
    on('.PX-gen-no','click',function(){$('.PX-gen-of').hidden=true});
    on('.PX-gen-cerrar','click',function(){clearTimeout(tEnv);capa.classList.remove('PX-fijo');A.cierraTodo();cfg.trasEmitir()});

    /* ---- Faltantes: la línea de hoy («Faltan N campos: A · B · C y N más»); cada nombre lleva a su campo ---- */
    A.faltan=function(l,tope){var n=l.length,t='';
      if(n){t=(n===1?'Falta 1 campo':'Faltan '+n+' campos')+': '+l.slice(0,tope||n).map(function(f,i){return (i?' · ':'')+'<button type="button" class="PX-p" data-i="'+i+'">'+h(f.nombre)+'</button>'}).join('')+(tope&&n>tope?' y '+(n-tope)+' más':'')}
      $$('.PX-faltan').forEach(function(x){x.innerHTML=t;x.hidden=!n});A._f=l};
    on('.PX-faltan','click',function(e){var b=e.target.closest('button');if(b&&A._f[+b.dataset.i])A._f[+b.dataset.i].ir()});
    A.irA=function(el){if(!el)return;var r=el.getBoundingClientRect(),c=cont.getBoundingClientRect(),z=c.width/cont.offsetWidth||1;cont.scrollTop+=(r.top-c.top)/z-90;var f=el.matches('input,textarea,select,button')?el:el.querySelector('input,textarea,select,button');if(f)f.focus({preventScroll:true})};
    A.perfil=function(v){$$('.PX-perfil').forEach(function(x){x.hidden=!v})};
    pintaPl();
    return A;
  }
  function tira(px,marcos,apis,T){
    /* Tira de controles de la maqueta: una sola, fuera del teléfono, gobierna los cuatro marcos a la vez (CALMA §7). */
    var t=document.createElement('div');t.className=px+'-tira';t.setAttribute('role','group');t.setAttribute('aria-label','Controles de la maqueta');
    t.innerHTML='<span>Maqueta</span>'+T.map(function(x){return '<button type="button" data-d="'+x[0]+'">'+x[1]+'</button>'}).join('');
    var op=marcos[0].closest('.op');
    if(op&&op.querySelector('header'))op.querySelector('header').appendChild(t);else marcos[0].parentNode.insertBefore(t,marcos[0]);
    t.addEventListener('click',function(e){var b=e.target.closest('button');if(b)apis.forEach(function(f){f(b.dataset.d)})});
  }
