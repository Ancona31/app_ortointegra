(function(){
  /* Animación de la maqueta: transform/opacity, 320 ms cubic-bezier(.32,.72,0,1) (200 ms en menús), mismo camino al entrar y al salir.
     En la app real serán resortes interrumpibles (amortiguación 1.0, respuesta ~0.3) y las hojas se arrastran desde el asa. */
  function ic(d,s,w){return '<svg aria-hidden="true" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||1.8)+'" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'}
  var I={arr:'<path d="M12 19V5M6 11l6-6 6 6"/>',aba:'<path d="M12 5v14M6 13l6 6 6-6"/>',pts:'<path d="M5.5 12h.01M12 12h.01M18.5 12h.01"/>',
    ok:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',filtro:'<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
    carpeta:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',lapiz:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    ape:'<path d="M4 17 7.5 7 11 17M5.2 13.8h4.6M14 7h6l-6 10h6"/>',nom:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',exp:'<path d="M5 9h14M5 15h14M9.5 4 8 20M16 4l-1.5 16"/>',
    edad:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',ing:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    med:'<path d="M6 4v5a4 4 0 0 0 8 0V4M10 13v2.5a4.5 4.5 0 0 0 9 0V14"/><circle cx="19" cy="12" r="2"/>',abajo:'<path d="m6 9 6 6 6-6"/>'};
  var MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var MED={A:{c:'Dr. Semilla',l:'Dr. Admin Semilla',t:0},I:{c:'Dra. Semilla',l:'Dra. Invitada Semilla',t:4}};
  function av(p){return '<span class="pl-pa pl-t'+(p.n%6)+'" aria-hidden="true">'+(p.n<10?'0':'')+p.n+'</span>'}
  function mav(k){return '<span class="pl-ma pl-t'+MED[k].t+'" aria-hidden="true">'+k+'</span>'}
  var ORD={ape:'Apellido',nom:'Nombre',exp:'Expediente',edad:'Edad',ing:'Fecha de ingreso',med:'Médico'};
  var PAC=[];
  for(var n=25;n>=1;n--){var d=new Date(2026,10,19-(25-n)*3),nn=(n<10?'0':'')+n;
    PAC.push({n:n,nom:'Paciente Prueba '+nn,edad:19+3*(((19-n)%20+20)%20),sexo:n%2?'Femenino':'Masculino',sx:n%2?'F':'M',exp:'EXP-2026-00'+nn,
      med:n%3===0?['I','A']:(n%2?['I']:['A']),iso:d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2),
      ing:d.getDate()+' '+MES[d.getMonth()]+' '+d.getFullYear(),
      /* Duo cerrado: la fecha del año en curso va sin año para que el nombre no se corte; la fecha completa sigue en la hoja de la fila */
      ingC:d.getDate()+' '+MES[d.getMonth()]+(d.getFullYear()===2026?'':' '+d.getFullYear())})}
  var marcos=[].slice.call(document.querySelectorAll('.pl.marco')),varia=[];
  var V={rol:'adm',sinres:false,vacia:false,err:false};

  marcos.forEach(function(m){
    var vp=m.dataset.vp,tel=vp==='ext'||vp==='tel',q=function(s){return m.querySelector(s)},qq=function(s){return [].slice.call(m.querySelectorAll(s))};
    var st={q:'',ord:'ing',dir:'desc',med:'',desde:'',hasta:'',n:12,rol:'adm',vacia:false,err:false};
    var cont=q('.pl-cont'),cuerpo=q('.pl-cuerpo'),lst=q('.pl-lst'),mas=q('.pl-mas-b'),total=q('.pl-total'),busca=q('.pl-busca'),
        eVac=q('.pl-e-vac'),eVacP=q('.pl-e-vac-p'),eNue=q('.pl-e-nuevo'),eErr=q('.pl-e-err'),menu=q('.pl-menu'),bOrd=q('.pl-ord'),bFil=q('.pl-fil'),
        origen=null,capaOn=null,mOrigen=null,mTipo='',mvelo=q('.pl-mvelo'),cent=vp==='ih'||vp==='iv';
    function defMed(){return st.rol==='inv'?'I':''}
    function filtrado(){return st.med!==defMed()||st.desde!==''||st.hasta!==''}
    function lista(){
      if(st.vacia)return [];
      var t=st.q.trim().toLowerCase(),k=st.ord,s=st.dir==='asc'?1:-1;
      return PAC.filter(function(p){return !(t&&p.nom.toLowerCase().indexOf(t)<0)&&!(st.med&&p.med.indexOf(st.med)<0)&&!(st.desde&&p.iso<st.desde)&&!(st.hasta&&p.iso>st.hasta)})
        .sort(function(a,b){var x=k==='edad'?a.edad-b.edad:k==='ing'?(a.iso<b.iso?-1:a.iso>b.iso?1:0):k==='med'?MED[a.med[0]].l.localeCompare(MED[b.med[0]].l):a.n-b.n;return (x||a.n-b.n)*s})}
    function medCorto(p){var x=p.med.length-1;return MED[p.med[0]].c+(x?' +'+x:'')}
    function ok(k,t){return st.ord===k?'<span class="pl-ok">'+t+'</span>':t}
    function filaTel(p){
      var l2='<span class="pl-l2">'+ok('edad',p.edad+' años')+' · '+p.sx+' · '+ok('exp',p.exp)+'</span>',
          dato='<span class="pl-dato'+(st.ord==='ing'?' pl-ok':'')+'">'+(vp==='ext'?p.ingC:p.ing)+'</span>';
      if(st.rol==='sec')return '<li class="pl-fila pl-fs">'+av(p)+'<span class="pl-nl">'+p.nom+'</span>'+dato+l2+
        '<span class="pl-l3">'+p.med.map(function(k){return MED[k].l}).join(', ')+'</span></li>';
      return '<li class="pl-fila">'+av(p)+'<a href="#" class="pl-nl">'+p.nom+'</a>'+dato+l2+
        '<button type="button" class="pl-p pl-keb" data-n="'+p.n+'" aria-haspopup="dialog" aria-label="Acciones de '+p.nom+'">'+ic(I.pts,20,2.6)+'</button></li>'}
    function filaTab(p){
      var sec=st.rol==='sec',x=p.med.length-1,nom=sec?'<span class="pl-nl">'+p.nom+'</span>':'<a href="#" class="pl-nl">'+p.nom+'</a>',edad=p.edad+' años · '+p.sexo,
          c=function(k,t){return '<div class="pl-c'+(st.ord===k?' pl-ok':'')+'" role="cell">'+t+'</div>'};
      return '<div class="pl-fr" role="row"><div class="pl-cp" role="cell">'+av(p)+'<span class="pl-cpt">'+nom+(vp==='ih'||vp==='iv'?'<span class="pl-dsub">'+ok('edad',p.edad+' años')+' · '+p.sexo+'</span>':'')+'</span></div>'+
        (vp==='esc'?c('edad',edad):'')+c('exp',p.exp)+c('ing',p.ing)+
        '<div class="pl-cm" role="cell">'+mav(p.med[0])+'<span'+(st.ord==='med'?' class="pl-ok"':'')+'>'+MED[p.med[0]].c+'</span>'+
        (x?'<button type="button" class="pl-p pl-masn" data-n="'+p.n+'" aria-haspopup="true" aria-expanded="false" aria-label="Ver los '+p.med.length+' médicos de '+p.nom+'">+'+x+'</button>':'')+'</div>'+
        '<div role="cell">'+(sec?'':'<button type="button" class="pl-p pl-kt" data-n="'+p.n+'" aria-haspopup="menu" aria-expanded="false" aria-label="Acciones de '+p.nom+'">'+ic(I.pts,20,2.6)+'</button>')+'</div></div>'}
    function pinta(){
      cierraMenu(true);
      var l=lista(),ver=l.slice(0,st.n),hay=ver.length>0&&!st.err;
      lst.innerHTML=hay?ver.map(tel?filaTel:filaTab).join(''):'';
      cuerpo.hidden=!hay;mas.hidden=!(hay&&l.length>st.n);
      eErr.hidden=!st.err;eVac.hidden=st.err||l.length>0;
      /* Igual que hoy: con texto en la búsqueda, «Intenta con otro nombre»; sin él, «Registra tu primer paciente» y el enlace a crear */
      var conQ=st.q.trim()!=='';eVacP.textContent=conQ?'Intenta con otro nombre':'Registra tu primer paciente';eNue.hidden=conQ;q('.pl-eic-q').hidden=!conQ;q('.pl-eic-n').hidden=conQ;
      var tot=st.vacia?0:st.rol==='inv'?PAC.filter(function(p){return p.med.indexOf('I')>=0}).length:PAC.length;
      total.textContent=st.err?'':tot+(tot===1?' paciente registrado':' pacientes registrados');
      q('.pl-ord-v').innerHTML=ORD[st.ord]+ic(st.dir==='asc'?I.arr:I.aba,14,2);
      bOrd.setAttribute('aria-label',(vp==='ext'||vp==='iv'?'':tel?'Filtrar y ordenar. ':'Cambiar el orden. ')+'Ordenado por '+ORD[st.ord]+', '+(st.dir==='asc'?'ascendente':'descendente'));
      q('.pl-punto').hidden=!filtrado();
      bFil.setAttribute('aria-label',(tel?'Filtrar y ordenar':'Filtros')+(filtrado()?' (hay filtros activos)':''));
      qq('.pl-hb').forEach(function(b){var a=b.dataset.o===st.ord;b.classList.toggle('pl-act',a);b.querySelector('svg').outerHTML=ic(a&&st.dir==='asc'?I.arr:I.aba,14,2);
        if(b.parentNode.hasAttribute('aria-sort'))b.parentNode.setAttribute('aria-sort',a?(st.dir==='asc'?'ascending':'descending'):'none')});
    }
    /* Orden: misma columna alterna la dirección; otra columna arranca en ascendente (igual que hoy) */
    function ordena(k){st.dir=k===st.ord?(st.dir==='asc'?'desc':'asc'):'asc';st.ord=k;st.n=12;pinta()}

    /* ---- Menús y popovers (Duo abierto y computadora) ---- */
    function cierraMenu(sinFoco){if(!menu||!menu.classList.contains('pl-on'))return;menu.classList.remove('pl-on');if(mvelo)mvelo.classList.remove('pl-on');mTipo='';
      if(mOrigen){if(mOrigen.isConnected){mOrigen.setAttribute('aria-expanded','false');if(!sinFoco)mOrigen.focus({preventScroll:true})}mOrigen=null}}
    function abreMenu(b,html,rol,tipo,etq){
      if(mOrigen===b){cierraMenu();return}
      cierraMenu(true);menu.innerHTML=(cent&&tipo!=='fil'?'<div class="pl-mt">'+etq+'</div>':'')+html;menu.setAttribute('role',rol);menu.setAttribute('aria-label',etq);menu.classList.toggle('pl-pf',tipo==='fil');menu.classList.toggle('pl-cent',cent);
      var mr=m.getBoundingClientRect(),z=mr.width/m.offsetWidth,r=b.getBoundingClientRect(),cr=cont.getBoundingClientRect(),
          w=menu.offsetWidth,h=menu.offsetHeight,der=(r.right-mr.left)/z+(tipo==='fila'||tipo==='med'?0:8),top=(r.bottom-mr.top)/z+4,
          maxD=(cr.right-mr.left)/z-4,minI=(cr.left-mr.left)/z+8,izq=Math.min(der,maxD)-w;
      if(izq<minI)izq=minI;
      /* Duo abierto (horizontal y vertical): tarjeta centrada en el área de contenido, con velo (CALMA §25) */
      if(cent){var lat=m.querySelector('.pl-lat'),it=parseFloat(getComputedStyle(m).getPropertyValue('--it'))||0,ib=parseFloat(getComputedStyle(m).getPropertyValue('--ib'))||0,
        ax=m.offsetWidth-(lat?lat.offsetWidth:0);izq=(ax-w)/2;top=it+(m.offsetHeight-it-ib-h)/2;menu.style.left=izq+'px';menu.style.top=top+'px';menu.classList.remove('pl-arr');
        mvelo.classList.add('pl-on');menu.classList.add('pl-on');mOrigen=b;mTipo=tipo;b.setAttribute('aria-expanded','true');var f0=menu.querySelector('a,button,select');if(f0)f0.focus({preventScroll:true});return}
      var arr=top+h>m.offsetHeight-parseFloat(getComputedStyle(m).getPropertyValue('--ib'))-8;
      if(arr)top=(r.top-mr.top)/z-h-4;
      menu.classList.toggle('pl-arr',arr);menu.style.left=izq+'px';menu.style.top=top+'px';
      menu.classList.add('pl-on');mOrigen=b;mTipo=tipo;b.setAttribute('aria-expanded','true');
      var f=menu.querySelector('a,button,select');if(f)f.focus({preventScroll:true})}
    function pac(b){return PAC.filter(function(p){return p.n===+b.dataset.n})[0]}
    function optsMed(){return (st.rol==='inv'?'':'<option value="">Todos los médicos</option><option value="A">Dr. Admin Semilla</option>')+'<option value="I">Dra. Invitada Semilla</option>'}
    function mi(attr,t,on,g){return '<button type="button" class="pl-p pl-mi" role="menuitemradio" aria-checked="'+on+'" '+attr+'>'+ic(g,18)+'<span>'+t+'</span>'+ic(I.ok,16,2.2).replace('<svg','<svg class="pl-chk"')+'</button>'}
    function ordenHtml(){return ['ape','nom','exp','edad','ing','med'].map(function(k){return mi('data-mo="'+k+'"',ORD[k],k===st.ord,I[k])}).join('')+
      '<span class="pl-msep"></span>'+mi('data-md="asc"','Ascendente',st.dir==='asc',I.arr)+mi('data-md="desc"','Descendente',st.dir==='desc',I.aba)}
    function filtrosHtml(){return '<div class="pl-pf-t">'+ic(I.filtro,18,2)+'Filtros</div><label class="pl-f"><span class="pl-et">Médico</span><span class="pl-sel"><select class="pl-in pl-b-med">'+optsMed()+'</select>'+ic(I.abajo,16,2)+'</span></label>'+
      '<div class="pl-par"><label class="pl-f"><span class="pl-et">Ingreso desde</span><input type="date" class="pl-in pl-b-desde"></label>'+
      '<label class="pl-f"><span class="pl-et">hasta</span><input type="date" class="pl-in pl-b-hasta"></label></div>'}

    /* ---- Hojas (teléfono) ---- */
    function abre(capa,b){origen=b;capaOn=capa;capa.classList.add('pl-on');capa.setAttribute('aria-hidden','false');
      var f=capa.querySelector('.pl-cierra,.pl-ac');if(f)f.focus({preventScroll:true})}
    function cierra(){if(!capaOn)return;capaOn.classList.remove('pl-on');capaOn.setAttribute('aria-hidden','true');capaOn=null;
      if(origen&&origen.isConnected&&origen.offsetParent)origen.focus({preventScroll:true})}
    var cF=q('.pl-c-fil'),cA=q('.pl-c-acc'),b={};
    function pintaHoja(){
      q('.pl-h-med').innerHTML=optsMed();q('.pl-h-med').value=b.med;q('.pl-h-desde').value=b.desde;q('.pl-h-hasta').value=b.hasta;
      qq('.pl-op[data-o]').forEach(function(e){e.setAttribute('aria-pressed',String(e.dataset.o===b.ord))});
      qq('.pl-sg').forEach(function(e){e.setAttribute('aria-pressed',String(e.dataset.d===b.dir))})}

    m.addEventListener('click',function(e){
      var t=e.target.closest('a[href="#"]');if(t)e.preventDefault();
      if(menu&&menu.classList.contains('pl-on')&&!e.target.closest('.pl-menu')&&e.target.closest('button')!==mOrigen)cierraMenu(true);
      if((t=e.target.closest('.pl-menu .pl-mi'))){
        if(t.dataset.mo){var o1=mOrigen;st.dir=t.dataset.mo===st.ord?st.dir:'asc';st.ord=t.dataset.mo;st.n=12;cierraMenu(true);pinta();o1.focus({preventScroll:true});return}
        if(t.dataset.md){var o2=mOrigen;st.dir=t.dataset.md;st.n=12;cierraMenu(true);pinta();o2.focus({preventScroll:true});return}
        cierraMenu();return}
      if((t=e.target.closest('.pl-kt'))){abreMenu(t,'<a href="#" class="pl-p pl-mi" role="menuitem">'+ic(I.carpeta,18)+'<span>Ir a expediente</span></a><a href="#" class="pl-p pl-mi" role="menuitem">'+ic(I.lapiz,18)+'<span>Editar paciente</span></a>','menu','fila',cent?pac(t).nom:'Acciones del paciente');return}
      if((t=e.target.closest('.pl-masn'))){var p=pac(t);
        abreMenu(t,'<ul class="pl-pop-l">'+p.med.map(function(k){return '<li>'+mav(k)+MED[k].l+'</li>'}).join('')+'</ul>','group','med','Médicos');return}
      if((t=e.target.closest('.pl-keb'))){var p2=pac(t);
        q('.pl-a-nom').textContent=p2.nom;q('.pl-a-av').className='pl-pa pl-a-av pl-t'+(p2.n%6);q('.pl-a-av').textContent=(p2.n<10?'0':'')+p2.n;q('.pl-a-meta').textContent=p2.edad+' años · '+p2.sexo+' · '+p2.exp;
        q('.pl-a-med').textContent=p2.med.map(function(k){return MED[k].l}).join(', ');q('.pl-a-ing').textContent=p2.ing;
        cA.querySelector('.pl-hoja').setAttribute('aria-label','Acciones de '+p2.nom);abre(cA,t);return}
      if((t=e.target.closest('.pl-ord,.pl-fil'))){
        if(tel){b={med:st.med,desde:st.desde,hasta:st.hasta,ord:st.ord==='med'?'ing':st.ord,dir:st.dir};pintaHoja();abre(cF,t);return}
        if(t===bOrd){abreMenu(t,ordenHtml(),'menu','ord','Ordenar por');return}
        abreMenu(t,filtrosHtml(),'dialog','fil','Filtros');
        if(mOrigen===t){q('.pl-b-med').value=st.med;q('.pl-b-desde').value=st.desde;q('.pl-b-hasta').value=st.hasta}return}
      if(e.target.closest('.pl-cierra,.pl-velo,.pl-ac')){cierra();return}
      if((t=e.target.closest('.pl-sg'))){b.dir=t.dataset.d;pintaHoja();return}
      if((t=e.target.closest('.pl-op'))){b.ord=t.dataset.o;pintaHoja();return}
      if(e.target.closest('.pl-limpiar')){b={med:defMed(),desde:'',hasta:'',ord:'ing',dir:'desc'};pintaHoja();return}
      if(e.target.closest('.pl-aplica')){
        st.med=b.med;st.desde=b.desde;st.hasta=b.hasta;st.ord=b.ord;st.dir=b.dir;st.n=12;cierra();pinta();cont.scrollTop=0;return}
      if((t=e.target.closest('.pl-hb'))){ordena(t.dataset.o);return}
      if(e.target.closest('.pl-mas-b')){st.n+=12;pinta();return}
      if(e.target.closest('.pl-reintenta')){ponV('err',false);return}
    });
    /* Popover de filtros (ancho): aplicación inmediata, como los filtros en línea de hoy; el popover sigue abierto */
    function soloLista(){var mo=mOrigen,mt=mTipo;mOrigen=null;menu.classList.remove('pl-on');pinta();menu.classList.add('pl-on');mOrigen=mo;mTipo=mt}
    m.addEventListener('change',function(e){var t=e.target;
      if(t.classList.contains('pl-h-med'))b.med=t.value;
      else if(t.classList.contains('pl-h-desde'))b.desde=t.value;
      else if(t.classList.contains('pl-h-hasta'))b.hasta=t.value;
      else if(t.classList.contains('pl-b-med')){st.med=t.value;st.n=12;soloLista()}
      else if(t.classList.contains('pl-b-desde')){st.desde=t.value;st.n=12;soloLista()}
      else if(t.classList.contains('pl-b-hasta')){st.hasta=t.value;st.n=12;soloLista()}});
    /* La app espera 300 ms tras la última tecla antes de buscar; la maqueta filtra al momento */
    busca.addEventListener('input',function(){st.q=busca.value;st.n=12;pinta()});
    m.addEventListener('keydown',function(e){if(e.key!=='Escape')return;
      if(capaOn){e.preventDefault();cierra()}else if(menu&&menu.classList.contains('pl-on')){e.preventDefault();cierraMenu()}});
    cont.addEventListener('scroll',function(){if(!cent)cierraMenu(true)});
    varia.push(function(){
      cierra();
      if(st.rol!==V.rol){st.rol=V.rol;st.med=defMed();st.desde='';st.hasta='';st.n=12}
      st.vacia=V.vacia;st.err=V.err;
      if(V.sinres){st.q='Paciente 99';busca.value=st.q}else if(st.q==='Paciente 99'){st.q='';busca.value=''}
      m.classList.toggle('pl-sec',st.rol==='sec');m.classList.toggle('pl-inv',st.rol==='inv');
      pinta();cont.scrollTop=0});
    pinta();
  });

  /* Tira de controles de la maqueta: fuera del marco, una sola para los cinco (CALMA §7) */
  var tira=document.createElement('div');tira.className='pl-tira';
  var BOT=[['sec','Maqueta: secretaria'],['inv','Maqueta: médica invitada'],['sinres','Maqueta: sin resultados'],['vacia','Maqueta: clínica nueva'],['err','Maqueta: error']];
  function ponV(k,on){
    if(k==='sec'||k==='inv')V.rol=on?k:'adm';
    else{V.sinres=V.vacia=V.err=false;V[k]=on}
    [].forEach.call(tira.children,function(b){var c=b.dataset.k;b.setAttribute('aria-pressed',String(c===V.rol||V[c]===true))});
    varia.forEach(function(f){f()})}
  BOT.forEach(function(d){var b=document.createElement('button');b.type='button';b.dataset.k=d[0];b.textContent=d[1];b.setAttribute('aria-pressed','false');
    b.addEventListener('click',function(){ponV(d[0],b.getAttribute('aria-pressed')!=='true')});tira.appendChild(b)});
  if(marcos.length){var op=marcos[0].closest('.op');
    if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0])}
})();
