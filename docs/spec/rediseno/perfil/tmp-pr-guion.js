(function(){
  var PERFIL={adm:{titulo:'Dr.',nombres:'Admin',paterno:'Semilla',materno:'',ced:'00000001',cedesp:'',esp:'Ortopedia y Traumatología',esp2:'',uni:'',clinica:'Clínica Semilla A'},
              inv:{titulo:'Dra.',nombres:'Invitada',paterno:'Semilla',materno:'',ced:'00000001',cedesp:'',esp:'Ortopedia y Traumatología',esp2:'',uni:'',clinica:'Clínica Semilla A'}};
  var G_EST=['off','on','err','aviso'],G_NOM={off:'sin conectar',on:'conectado',err:'sin respuesta de Google',aviso:'aviso de error al volver de Google'};
  var CL_EST=['n','vacio','tope'],CL_NOM={n:'con consultorios',vacio:'sin consultorios',tope:'tope de 10'};
  document.querySelectorAll('.pr.marco').forEach(function(m){
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var h=function(n){return $$('[data-h="'+n+'"]')},txt=function(n,t){h(n).forEach(function(e){e.textContent=t})};
    var cont=$('.pr-cont'),campos=$$('[data-k]'),K={};campos.forEach(function(c){K[c.dataset.k]=c});
    var esp2w=$('.pr-esp2w'),espA=$('.pr-esp-a'),col={p:'#1a3a5c',s:'#1e5fa8'},logo={pend:false,guard:false},base=null,nId=3;
    $$('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});

    /* ---- Aviso emergente ---- */
    var toastEl=$('.pr-toast'),tt=0;
    function toast(t,mal){toastEl.firstElementChild.textContent=t;toastEl.classList.toggle('pr-mal',!!mal);toastEl.classList.add('pr-on');
      clearTimeout(tt);tt=setTimeout(function(){toastEl.classList.remove('pr-on')},3600)}

    /* ---- Pestañas (en la app, ?tab= en la URL) ---- */
    function tab(k){m.dataset.tab=k;
      $$('.pr-tab').forEach(function(b){b.setAttribute('aria-selected',String(b.dataset.tab===k))});
      $$('.pr-panel').forEach(function(p){p.hidden=p.dataset.panel!==k});
      var cs=getComputedStyle(cont),tope=$('.pr-cab').offsetHeight+parseFloat(cs.paddingTop)+parseFloat(cs.rowGap||0);
      cont.scrollTop=Math.min(cont.scrollTop,tope)}
    $$('.pr-tab').forEach(function(b){b.addEventListener('click',function(){tab(b.dataset.tab)})});
    $$('.pr-ir').forEach(function(a){a.addEventListener('click',function(){tab(a.dataset.ir);cont.scrollTop=0})});

    /* ---- Datos: identidad viva, validación y barra de guardado ---- */
    function cedErr(v){return !v?'':!/^\d+$/.test(v)?'Solo números':(v.length<7||v.length>8)?'La cédula debe tener 7 u 8 dígitos':''}
    function foto(){var o={};campos.forEach(function(c){o[c.dataset.k]=c.value});if(esp2w.hidden)o.esp2='';o._e2=!esp2w.hidden;o._p=col.p;o._s=col.s;return o}
    function pintaColor(){m.style.setProperty('--pr-p',col.p);m.style.setProperty('--pr-s',col.s);txt('hexp',col.p);txt('hexs',col.s);
      $('[data-c="p"]').value=col.p;$('[data-c="s"]').value=col.s;var nom='Colores a medida';
      $$('.pr-pal').forEach(function(b){var on=b.dataset.a===col.p&&b.dataset.b===col.s;b.setAttribute('aria-pressed',String(on));if(on)nom=b.children[1].textContent});
      txt('paleta',nom)}
    function pintaLogo(){var hay=logo.pend||logo.guard;
      h('logo').forEach(function(e){e.classList.toggle('pr-vac',!hay);e.children[0].toggleAttribute('hidden',hay);e.children[1].toggleAttribute('hidden',!hay)});
      h('logog').forEach(function(e){e.classList.toggle('pr-hay',hay);e.children[0].toggleAttribute('hidden',hay);e.children[1].toggleAttribute('hidden',!hay)});
      h('plogo').forEach(function(e){e.hidden=!hay});
      $('.pr-logo-b').textContent=hay?'Cambiar logo':'Subir logo';$('.pr-logo-q').hidden=!logo.pend}
    function pinta(){var v=foto(),inv=m.classList.contains('pr-inv');
      txt('nombre',[v.titulo,v.nombres.trim(),v.paterno.trim(),v.materno.trim()].filter(Boolean).join(' ')||'Sin nombre');
      txt('esp',[v.esp,v.esp2.trim()].filter(Boolean).join(' · '));
      h('ceds').forEach(function(e){e.textContent='';[['Céd. profesional',v.ced],['Céd. especialidad',v.cedesp]].forEach(function(c){if(!c[1])return;
        var s=document.createElement('span'),b=document.createElement('b');s.textContent=c[0]+' ';b.textContent=c[1];s.appendChild(b);e.appendChild(s)});e.hidden=!e.children.length});
      txt('pceds',[v.ced&&'• Céd. Prof. '+v.ced,v.cedesp&&'• Céd. Esp. '+v.cedesp].filter(Boolean).join('   '));
      ['ced','cedesp'].forEach(function(k){var e=K[k].parentNode.querySelector('.pr-err'),t=cedErr(v[k]);e.textContent=t;e.hidden=!t});
      $('.pr-err-cl').hidden=!!v.clinica.trim();
      var suc=[];if(base){campos.forEach(function(c){var s=c.dataset.s;if(v[c.dataset.k]!==base[c.dataset.k]&&suc.indexOf(s)<0&&(!inv||s==='Datos profesionales'))suc.push(s)});
        if(!inv&&(v._p!==base._p||v._s!==base._s||logo.pend))suc.push('Apariencia')}
      m.classList.toggle('pr-sucio',suc.length>0);
      if(suc.length)$('.pr-bt').textContent='Tienes cambios sin guardar en '+(suc.length>1?suc.slice(0,-1).join(', ')+' y '+suc[suc.length-1]:suc[0])+'.'}
    function carga(p){campos.forEach(function(c){c.value=p[c.dataset.k]});esp2w.hidden=!p._e2&&!p.esp2;espA.hidden=!esp2w.hidden;
      if(p._p){col.p=p._p;col.s=p._s}pintaColor()}
    campos.forEach(function(c){c.addEventListener('input',function(){
      if(c.dataset.k==='ced'||c.dataset.k==='cedesp')c.value=c.value.replace(/\D/g,'').slice(0,8);pinta()});c.addEventListener('change',pinta)});
    espA.addEventListener('click',function(){esp2w.hidden=false;espA.hidden=true;K.esp2.focus({preventScroll:true});pinta()});
    $('.pr-esp-q').addEventListener('click',function(){K.esp2.value='';esp2w.hidden=true;espA.hidden=false;pinta()});
    $$('.pr-pal').forEach(function(b){b.addEventListener('click',function(){col.p=b.dataset.a;col.s=b.dataset.b;pintaColor();pinta()})});
    $$('.pr-color input').forEach(function(i){i.addEventListener('input',function(){col[i.dataset.c]=i.value.toLowerCase();pintaColor();pinta()})});
    $('.pr-logo-b').addEventListener('click',function(){logo.pend=true;pintaLogo();pinta()});
    $('.pr-logo-q').addEventListener('click',function(){logo.pend=false;pintaLogo();pinta()});
    $('.pr-b-desc').addEventListener('click',function(){logo.pend=false;carga(base);pintaLogo();pinta()});
    $('.pr-b-guar').addEventListener('click',function(){var v=foto(),inv=m.classList.contains('pr-inv'),e=cedErr(v.ced)||cedErr(v.cedesp);
      if(e)return toast(e,1);
      if(!v.nombres.trim()||!v.paterno.trim())return toast('El nombre y el apellido paterno son obligatorios',1);
      if(!inv&&!v.clinica.trim())return toast('El nombre de la clínica no puede quedar vacío',1);
      if(logo.pend){logo.pend=false;logo.guard=true}base=v;pintaLogo();pinta();toast('Cambios guardados correctamente')});

    /* ---- Maqueta: rol ---- */
    var dRol=$('.pr-demo-rol');
    dRol.addEventListener('click',function(){var inv=m.classList.toggle('pr-inv');dRol.setAttribute('aria-pressed',String(inv));
      dRol.textContent=inv?'Maqueta: volver a ver como quien administra':'Maqueta: ver como médico invitado';
      logo.pend=false;carga(PERFIL[inv?'inv':'adm']);base=foto();pintaLogo();pinta();cont.scrollTop=0});

    /* ---- Firma ---- */
    var fz=$('.pr-firma'),cv=fz.querySelector('canvas'),ctx=cv.getContext('2d'),lz=$('.pr-lienzo'),bLim=$('.pr-f-lim'),bProc=$('.pr-f-proc'),dib=false,hayTrazo=false,previa='';
    function tinta(){return getComputedStyle(m).getPropertyValue('--navy').trim()||'#1B2B4A'}
    function modo(k){fz.dataset.f=k;fz.querySelectorAll('.pr-seg button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.modo===k))})}
    function limpia(){ctx.clearRect(0,0,cv.width,cv.height);hayTrazo=false;lz.classList.remove('pr-trazo');bLim.disabled=true;bProc.setAttribute('aria-disabled','true')}
    function pos(e){var r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]}
    fz.querySelectorAll('.pr-seg button').forEach(function(b){b.addEventListener('click',function(){modo(b.dataset.modo)})});
    cv.addEventListener('pointerdown',function(e){e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}dib=true;var p=pos(e);
      ctx.strokeStyle=tinta();ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(p[0],p[1]);
      if(!hayTrazo){hayTrazo=true;lz.classList.add('pr-trazo');bLim.disabled=false;bProc.setAttribute('aria-disabled','false')}});
    cv.addEventListener('pointermove',function(e){if(!dib)return;var p=pos(e);ctx.lineTo(p[0],p[1]);ctx.stroke()});
    ['pointerup','pointercancel','pointerleave'].forEach(function(t){cv.addEventListener(t,function(){dib=false})});
    function aPrevia(src){previa=src;$$('.pr-fp img').forEach(function(i){i.src=src});fz.dataset.f='previa'}
    $('.pr-zona').addEventListener('click',function(){aPrevia('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 110"><path d="M20 72c18-42 30-52 34-30s-8 44 6 30 18-38 28-32-6 38 8 30 20-36 30-30-4 32 10 28 24-24 40-26 30 10 62 2M60 92c50-8 120-10 180-4" fill="none" stroke="'+tinta()+'" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'))});
    bLim.addEventListener('click',limpia);
    bProc.addEventListener('click',function(){if(hayTrazo)aPrevia(cv.toDataURL('image/png'))});
    $('.pr-f-otra').addEventListener('click',function(){limpia();modo('subir')});
    $('.pr-f-ok').addEventListener('click',function(){fz.querySelector('.pr-fg img').src=previa;fz.dataset.f='guardada';
      h('firma').forEach(function(e){e.classList.add('pr-hay');e.textContent='';var i=document.createElement('img');i.alt='Firma guardada';i.src=previa;e.appendChild(i)});toast('Firma guardada correctamente')});
    $('.pr-f-cambia').addEventListener('click',function(){limpia();modo('subir')});
    $('.pr-f-elim').addEventListener('click',function(){h('firma').forEach(function(e){e.classList.remove('pr-hay');e.textContent='Sin firma'});limpia();modo('subir');toast('Firma eliminada')});

    /* ---- Capas ---- */
    var abierta=null,origen=null;
    function abre(n,o,foco){if(abierta)cierra(true);abierta=m.querySelector('.pr-capa[data-capa="'+n+'"]');origen=o||document.activeElement;
      abierta.classList.add('pr-on');abierta.setAttribute('aria-hidden','false');var f=foco||abierta.querySelector('.pr-cierra');if(f)f.focus({preventScroll:true})}
    function cierra(sinFoco){if(!abierta)return;abierta.classList.remove('pr-on');abierta.setAttribute('aria-hidden','true');abierta=null;
      if(!sinFoco&&origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    $$('.pr-cierra').forEach(function(b){b.addEventListener('click',function(){cierra()})});
    $$('.pr-velo').forEach(function(v){v.addEventListener('click',function(){cierra()})});
    m.addEventListener('keydown',function(e){if(abierta&&e.key==='Escape'){e.preventDefault();cierra()}});

    /* ---- Consultorios ---- */
    var lista=$('.pr-lc'),res=$('.pr-res'),dCl=$('.pr-demo-cl'),hoja=$('.pr-hoja'),hN=$('.pr-h-n'),hC=$('.pr-h-c'),hCw=$('.pr-h-cw'),hD=$('.pr-h-d'),hT=$('.pr-h-t'),hZ=$('.pr-h-z'),hOk=$('.pr-h-ok'),editando=null,borrando=null;
    function filas(){return [].slice.call(lista.querySelectorAll('li[data-id]')).filter(function(l){return !l.hidden})}
    function utc(z){var o=hZ.querySelector('option[value="'+z+'"]'),r=o&&o.textContent.match(/UTC[+-]\d+/);return r?r[0]:''}
    function refresca(){var fs=filas(),n=fs.length,cl=m.dataset.cl;
      if(cl!=='tope'){cl=n?'n':'vacio';m.dataset.cl=cl}
      txt('cuenta',cl==='tope'?'10':String(n));dCl.textContent='Maqueta: cambiar lista (ahora: '+CL_NOM[cl]+')';
      $$('.pr-c-add').forEach(function(b){b.disabled=cl==='tope';b.style.opacity=cl==='tope'?'.45':''});
      [].slice.call(res.children).forEach(function(l){l.hidden=true});
      fs.forEach(function(l,i){var d=l.dataset,def=l.hasAttribute('data-def'),no=n===1||def,t=[d.t,utc(d.z)].filter(Boolean).join(' · ');
        l.querySelector('[data-c="n"]').textContent=d.n;l.querySelector('[data-c="d"]').textContent=d.d;l.querySelector('[data-c="t"]').textContent=t;
        l.querySelector('.pr-cdef').hidden=!def;l.querySelector('.pr-c-def').hidden=def;l.querySelector('.pr-c-el').disabled=no;
        var mo=l.querySelector('.pr-cmot');mo.hidden=!no;mo.lastElementChild.textContent=n===1?'No puedes borrar tu único consultorio. Crea otro primero.':'Marca otro consultorio como predeterminado antes de borrar este.';
        if(i>2)return;var r=res.querySelector('li[data-id="'+d.id+'"]');if(!r){r=res.children[0].cloneNode(true);r.dataset.id=d.id}res.appendChild(r);r.hidden=false;
        r.querySelector('[data-c="n"]').textContent=d.n;r.querySelector('[data-c="l"]').textContent=[d.d,t].join(' · ');r.querySelector('.pr-cdef').hidden=!def})}
    function valida(){var largo=hN.value.trim().length>12;hCw.hidden=!largo;
      var ok=hN.value.trim()&&hD.value.trim()&&hZ.value!==''&&(!largo||hC.value.trim());hOk.setAttribute('aria-disabled',String(!ok));
      hoja.querySelectorAll('.pr-zc').forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.z===hZ.value))});return !!ok}
    function abreHoja(li,o){editando=li;var t=li?'Editar consultorio':'Agregar consultorio';$('.pr-hj-t').textContent=t;hoja.setAttribute('aria-label',t);
      hN.value=li?li.dataset.n:'';hC.value=li?(li.dataset.c||''):'';hD.value=li?li.dataset.d:'';hT.value=li?li.dataset.t:'';hZ.value=li?li.dataset.z:'4';
      valida();hoja.scrollTop=0;abre('cons',o,hN)}
    [hN,hC,hD,hT,hZ].forEach(function(i){i.addEventListener('input',valida);i.addEventListener('change',valida)});
    hoja.querySelectorAll('.pr-zc').forEach(function(c){c.addEventListener('click',function(){hZ.value=c.dataset.z;valida()})});
    $$('.pr-c-add').forEach(function(b){b.addEventListener('click',function(){if(m.dataset.cl!=='tope')abreHoja(null,b)})});
    hoja.addEventListener('submit',function(e){e.preventDefault();if(!valida())return;var li=editando,nuevo=!li;
      if(nuevo){li=lista.querySelector('li[data-id]').cloneNode(true);li.hidden=false;li.removeAttribute('data-def');li.dataset.id='c'+(++nId);lista.insertBefore(li,lista.querySelector('.pr-ctope'));
        if(!filas().some(function(l){return l!==li&&l.hasAttribute('data-def')}))li.setAttribute('data-def','')}
      li.dataset.n=hN.value.trim();li.dataset.c=hC.value.trim();li.dataset.d=hD.value.trim();li.dataset.t=hT.value.trim();li.dataset.z=hZ.value;
      refresca();cierra();if(nuevo)toast('Consultorio creado.')});
    lista.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;var li=b.closest('li[data-id]');if(!li)return;
      if(b.classList.contains('pr-c-ed'))abreHoja(li,b);
      else if(b.classList.contains('pr-c-def')){filas().forEach(function(l){l.removeAttribute('data-def')});li.setAttribute('data-def','');refresca();toast('Consultorio predeterminado actualizado.')}
      else if(b.classList.contains('pr-c-el')){borrando=li;$$('.pr-b-n').forEach(function(x){x.textContent=li.dataset.n});$('.pr-b-d').textContent=li.dataset.d;$('.pr-b-t').textContent=li.dataset.t;abre('borrar',b)}});
    $('.pr-b-si').addEventListener('click',function(){cierra(true);if(borrando){borrando.remove();borrando=null;refresca();toast('Consultorio borrado.')}});
    $('.pr-b-ed').addEventListener('click',function(){var li=borrando;cierra(true);if(li)abreHoja(li,li.querySelector('.pr-c-ed'))});
    var ocultas=[];
    dCl.addEventListener('click',function(){var s=CL_EST[(CL_EST.indexOf(m.dataset.cl)+1)%3];
      if(s==='vacio'){ocultas=filas();ocultas.forEach(function(l){l.hidden=true})}else{ocultas.forEach(function(l){l.hidden=false});ocultas=[]}
      m.dataset.cl=s;refresca()});

    /* ---- Google Calendar (no se simula ninguna conexión real) ---- */
    var dG=$('.pr-demo-g');
    function g(s){m.dataset.g=s;dG.textContent='Maqueta: cambiar estado (ahora: '+G_NOM[s]+')'}
    dG.addEventListener('click',function(){g(G_EST[(G_EST.indexOf(m.dataset.g)+1)%4])});
    $('.pr-g-rec').addEventListener('click',function(e){abre('recrear',e.currentTarget)});
    $('.pr-r-si').addEventListener('click',function(){cierra();toast('Calendario recreado en tu cuenta de Google')});
    $('.pr-g-des').addEventListener('click',function(){g('off')});
    $('.pr-g-reint').addEventListener('click',function(){g('on')});

    /* ---- Ajustes (propuesta) ---- */
    $('.pr-sw-b').addEventListener('click',function(e){var b=e.currentTarget;b.setAttribute('aria-checked',String(b.getAttribute('aria-checked')!=='true'))});

    carga(PERFIL.adm);base=foto();pintaLogo();refresca();pinta();
  });
})();
/* Tira de controles de la maqueta (CALMA §7): vive FUERA del marco, en la cabecera de la sección, y mueve los cinco marcos a la vez.
   Reenvía el clic a los botones de maqueta de cada marco (que quedan ocultos) y, si el estado vive en otra pestaña, la abre antes. */
(function(){
  var ms=[].slice.call(document.querySelectorAll('.pr.marco'));if(!ms.length)return;
  var t=document.createElement('div');t.className='pr-tira';t.setAttribute('role','group');t.setAttribute('aria-label','Controles de la maqueta');
  t.innerHTML='<span>Maqueta</span>';
  var defs=[['.pr-demo-rol',null],['.pr-demo-cl','cons'],['.pr-demo-g','google']];
  function sync(){defs.forEach(function(d,i){var o=ms[0].querySelector(d[0]);bs[i].textContent=o.textContent.replace(/^Maqueta: /,'');
    var p=o.getAttribute('aria-pressed');if(p)bs[i].setAttribute('aria-pressed',p)})}
  var bs=defs.map(function(d){var b=document.createElement('button');b.type='button';t.appendChild(b);
    b.addEventListener('click',function(){ms.forEach(function(m){if(d[1]&&m.dataset.tab!==d[1])m.querySelector('.pr-tab[data-tab="'+d[1]+'"]').click();
      m.querySelector(d[0]).click()});sync()});return b});
  sync();var op=ms[0].closest('.op');if(op)op.querySelector('header').appendChild(t);else ms[0].parentNode.insertBefore(t,ms[0]);
})();
