  /* ===== Consentimiento informado · denegación · firmado electrónico ===== */
  var SEC=__SEC__,FLECHA=__FLECHA__,OKM=__OKM__,ICQ=__ICQ__;
  var ORDEN=['preoperatorio','beneficios','anestesia','descripcion','riesgosComunes','riesgosEspecificos','alternativas'],OBL=['descripcion','riesgosEspecificos'];
  var NOMSEC={descripcion:'Descripción del procedimiento',riesgosEspecificos:'Riesgos específicos'};
  var ROLES=[['paciente','Paciente','PACIENTE'],['familiar','Familiar o responsable','FAMILIAR RESPONSABLE'],['testigo_1','Testigo 1','TESTIGO 1'],['testigo_2','Testigo 2','TESTIGO 2']];
  var INI={fecha:'19/11/2026',lugar:'',paciente:'Paciente Prueba 01',edad:'73 años',diagnostico:'',procedimiento:'',familiar:'',testigo1:'',testigo2:''};
  /* Las dos secciones que nacen vacías las redacta el médico; aquí van marcadores, no texto clínico ni legal inventado */
  var MARCA={descripcion:'Infiltración intraarticular de rodilla derecha con técnica estéril, por vía anterolateral.',riesgosEspecificos:'Dolor transitorio en el sitio de punción, derrame articular reactivo y, de forma excepcional, artritis séptica.'};
  var marcos=[].slice.call(document.querySelectorAll('.PX.marco')),apis=[];
  marcos.forEach(function(m){
    var intentado=false,borrador=false,transf=null,tImp=0;
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var A=chasis(m,{plantillas:[['Artroscopia de rodilla','Actualizada el 3 de noviembre'],['Infiltración','Actualizada el 21 de octubre']],correo:'paciente01@semilla.spinus.test',OK:OKM,FLECHA:FLECHA,
      vacio:vacio,foto:foto,revela:revela,
      vaciar:function(dePlantilla){if(dePlantilla){pon({lugar:'',procedimiento:''});secs({});transf=null;pres('.PX-k-fotos',false);refresca()}else reinicia()},
      aplicar:function(n){pon({lugar:'Mérida, Yuc.',procedimiento:n});secs(MARCA);transf=null;refresca()},
      accion:function(a){if(a==='borr')guardaBorrador()},
      alAbrirMenu:function(){var b=$('.PX-menu [data-a="borr"]');b.setAttribute('aria-disabled',String(vacio()));b.dataset.motivo='Escribe algo antes de guardarlo como borrador.';
        var g=$('.PX-menu [data-a="gpl"]');g.setAttribute('aria-disabled',String(vacio()));g.dataset.motivo='Llena algún campo de los que la plantilla guarda para poder guardarla.';
        [b,g].forEach(function(x){x.style.color=x.getAttribute('aria-disabled')==='true'?'var(--tinta3)':''})},
      trasEmitir:reinicia});
    var on=A.on;
    function inp(k){return $('.PX-in[data-k="'+k+'"]')}
    function v(k){return inp(k).value.trim()}
    function pon(o){for(var k in o)inp(k).value=o[k]}
    function pres(s,val){var b=$(s);if(val===undefined)return b.getAttribute('aria-pressed')==='true';b.setAttribute('aria-pressed',String(val))}
    function ta(k){return $('.PX-ta[data-s="'+k+'"]')}
    function secs(o){ORDEN.forEach(function(k){ta(k).value=o[k]!==undefined?o[k]:SEC[k]});A.creceTodo()}
    function den(){return m.dataset.v==='b'}
    function vacio(){return (v('paciente')===''||v('paciente')===INI.paciente)&&(v('edad')===''||v('edad')===INI.edad)&&!v('diagnostico')&&!v('lugar')&&!v('procedimiento')&&!v('familiar')&&!v('testigo1')&&!v('testigo2')
      &&transf===null&&!pres('.PX-k-fotos')&&!pres('.PX-k-nofirma')&&ORDEN.every(function(k){return ta(k).value===SEC[k]})}
    function foto(){var s={c:{},s:{},t:transf,f:pres('.PX-k-fotos'),n:pres('.PX-k-nofirma')};for(var k in INI)s.c[k]=inp(k).value;ORDEN.forEach(function(k){s.s[k]=ta(k).value});return s}
    function revela(s){pon(s.c);secs(s.s);transf=s.t;pres('.PX-k-fotos',s.f);pres('.PX-k-nofirma',s.n);refresca()}

    /* ---- Validación: los obligatorios de hoy, en su orden de lectura ---- */
    function faltantes(){var f=[],d=den();function campo(k,n){f.push({clave:k,nombre:n,ir:function(){A.irA(inp(k))}})}
      if(!v('fecha'))campo('fecha','Fecha');if(!v('lugar'))campo('lugar','Lugar');if(!v('paciente'))campo('paciente','Paciente');if(!v('edad'))campo('edad','Edad del paciente');
      if(!d&&!v('diagnostico'))campo('diagnostico','Diagnóstico');if(!v('procedimiento'))campo('procedimiento','Procedimiento');
      if(!v('familiar')&&(d||pres('.PX-k-nofirma')))campo('familiar','Familiar responsable o representante legal');
      if(!d&&transf===null)f.push({clave:'transfusion',nombre:'Autorización de transfusión',ir:function(){A.irA($('[data-seg="transfusion"] button'))}});
      if(!d)OBL.forEach(function(k){if(!ta(k).value.trim())f.push({clave:'sec-'+k,nombre:NOMSEC[k],ir:function(){A.irA($('[data-sec="'+k+'"] .PX-sec'))}})});
      return f}
    function refresca(){var d=den(),nf=pres('.PX-k-nofirma'),f=faltantes(),cl=f.map(function(x){return x.clave});
      $$('[data-seg="var"] button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.val===m.dataset.v))});
      $$('[data-seg="transfusion"] button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.val===transf))});
      $('[data-row="diagnostico"] .PX-req').hidden=d;$('[data-row="familiar"] .PX-req').hidden=!(d||nf);
      var n=$('.PX-nofirma-n');n.hidden=!nf;n.textContent=d?'El familiar responsable firma en su lugar, y así lo dirá el documento.':'El familiar responsable firma en su lugar: su nombre pasa a ser obligatorio.';
      ORDEN.forEach(function(k){var val=ta(k).value,ob=OBL.indexOf(k)>=0,t=val===SEC[k]?(ob?'Obligatoria':''):(val.trim()===''&&ob?'Obligatoria':'Editada');
        var w=$('[data-sec="'+k+'"]'),sr=w.querySelector('.PX-sr');sr.className='PX-sr'+(t?' PX-eq PX-eq-'+(t==='Editada'?'ton':'ag'):'');sr.innerHTML=t?(t==='Editada'?ICQ.ed:ICQ.ob)+t:'';w.classList.toggle('PX-falta',intentado&&cl.indexOf('sec-'+k)>=0)});
      $$('.PX-f[data-row],.PX-ck[data-row]').forEach(function(r){r.classList.toggle('PX-falta',intentado&&cl.indexOf(r.dataset.row)>=0)});
      A.faltan(intentado?f:[],3);
      /* Lo conservado al pasar a denegación */
      var c=[],ed=ORDEN.filter(function(k){return ta(k).value!==SEC[k]}).length;
      if(d){if(ed)c.push((ed===1?'1 sección clínica':ed+' secciones clínicas')+' editada'+(ed===1?'':'s'));if(transf!==null)c.push('transfusión ('+(transf==='si'?'Sí':'No')+')');
        if(pres('.PX-k-fotos'))c.push('uso de fotografías (autorizado)');var t=[v('testigo1'),v('testigo2')].filter(function(x){return x});if(t.length)c.push('testigos ('+t.join(', ')+')')}
      var l=$('.PX-cons-l');l.hidden=!c.length;l.firstChild.textContent='Se conserva escrito, pero no sale en la denegación: '+c.join(' · ')+'.';
      $('.PX-borr-l').hidden=!borrador||d;
      $$('.PX-b-firmar').forEach(function(b){b.textContent=A.esc?(borrador?'Continuar firmado':'Iniciar firmado electrónico'):(borrador?'Continuar':'Firmar')})}
    function reinicia(){clearTimeout(tImp);intentado=false;borrador=false;transf=null;m.dataset.v='a';pon(INI);secs({});pres('.PX-k-fotos',false);pres('.PX-k-nofirma',false);
      $$('.PX-sec').forEach(function(b){b.setAttribute('aria-expanded','false');b.nextElementSibling.hidden=true});A.sinAviso();A.cont.scrollTop=0;refresca()}
    function llena(){reinicia();pon({lugar:'Mérida, Yuc.',diagnostico:'Gonalgia derecha',procedimiento:'Infiltración de rodilla',familiar:'Familiar de Prueba 01',testigo1:'Secretaria Semilla',testigo2:'Dra. Invitada Semilla'});
      secs(MARCA);transf='si';pres('.PX-k-fotos',true);refresca()}

    m.addEventListener('input',function(e){if(e.target.closest('.PX-form'))refresca()});
    on('[data-seg="var"] button','click',function(e){m.dataset.v=e.currentTarget.dataset.val;refresca()});
    on('[data-seg="transfusion"] button','click',function(e){transf=e.currentTarget.dataset.val;refresca()});
    on('.PX-k-fotos,.PX-k-nofirma','click',function(e){var b=e.currentTarget;b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));refresca()});
    on('.PX-sec','click',function(e){var b=e.currentTarget,ab=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!ab));b.nextElementSibling.hidden=ab;if(!ab)A.crece(b.nextElementSibling.querySelector('textarea'))});

    /* ---- Acciones de la barra ---- */
    function valida(){intentado=true;var f=faltantes();refresca();if(f.length){f[0].ir();return false}return true}
    function guardaBorrador(){borrador=true;refresca();A.toast('Borrador guardado. No se ha emitido nada todavía.')}
    function imprime(b,titulo,aviso){if(!valida())return;var t=b.textContent;b.disabled=true;b.parentNode.classList.add('PX-ocup');b.innerHTML='<span class="PX-giro" aria-hidden="true"></span>Generando PDF…';
      tImp=setTimeout(function(){b.disabled=false;b.parentNode.classList.remove('PX-ocup');b.textContent=t;A.generado(titulo,true,aviso)},RM?0:900)}
    on('.PX-b-sinfirma','click',function(e){imprime(e.currentTarget,'Consentimiento generado','Consentimiento guardado · CI-2026-0007')});
    on('.PX-b-imp','click',function(e){imprime(e.currentTarget,'Denegación generada','Denegación guardada · DEN-2026-0002')});
    on('.PX-b-firmar','click',function(){if(valida())abreFirma()});   /* en la app, antes de abrir el firmado se guarda el borrador */
    on('.PX-prev-si','click',function(){A.cierraTodo();llena();borrador=true;refresca()});
    on('.PX-prev-no','click',function(){A.cierraTodo();A.toast('Borrador anterior eliminado')});

    /* ---- Firmado electrónico ---- */
    var fi=$('.PX-firma'),lienzo=$('.PX-lienzo'),papel=$('.PX-papel'),ctx=null,firmantes=[],paso=0,des={},tinta=false,pend=null,fase='',giro=0,dib=false,ult=null,tSel=0;
    function nombres(){return {paciente:v('paciente'),familiar:v('familiar'),testigo_1:v('testigo1'),testigo_2:v('testigo2')}}
    function apagado(){return paso<firmantes.length&&firmantes[paso][0]==='paciente'&&pres('.PX-k-nofirma')}
    function prepara(){var w=lienzo.offsetWidth,al=lienzo.offsetHeight;if(!w)return;lienzo.width=w*2;lienzo.height=al*2;ctx=lienzo.getContext('2d');ctx.lineWidth=4.5;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.strokeStyle=getComputedStyle(papel).color;tinta=false}
    function botones(){var ap=apagado();$('.PX-ph').hidden=tinta||ap;$('.PX-fi-borra').disabled=!tinta||ap;$('.PX-fi-borra').hidden=ap;var ok=$('.PX-fi-ok');ok.disabled=!tinta&&!ap;ok.textContent=ap?'Continuar sin firma del paciente':'Confirmar firma'}
    function pintaFirma(){var enRes=paso>=firmantes.length,n=nombres(),tot=firmantes.length,res=firmantes.filter(function(r){return des[r[0]]}).length;
      $('.PX-fi-t').textContent=enRes?'Revisión antes de sellar':'Firmado electrónico';
      $('.PX-fi-n').textContent=A.ancho?(enRes?res+' de '+tot+' resueltos':'Firmante '+(paso+1)+' de '+tot):(enRes?res+'/'+tot:(paso+1)+'/'+tot);
      $('.PX-prog-t').innerHTML=firmantes.map(function(r,i){return '<i'+(i<paso?' class="PX-hecho"':i===paso?' class="PX-ahora"':'')+'></i>'}).join('');
      $('.PX-paso').hidden=enRes;$('.PX-resumen').hidden=!enRes;$('.PX-fi-c').scrollTop=0;
      if(enRes){$('.PX-res-l').innerHTML=firmantes.map(function(r){var d=des[r[0]],e=!d?'Pendiente':d.tipo==='firmo'?(d.foto?'Firmó · con foto de identificación':'Firmó · sin foto'):'No pudo firmar';
          return '<li class="PX-res-f"><span class="PX-ct">'+h(n[r[0]]||r[1])+'<small>'+e+'</small></span><button type="button" class="PX-p PX-qui PX-ch" data-rol="'+r[0]+'">Rehacer</button></li>'}).join('');return}
      var r=firmantes[paso],ap=apagado();$('.PX-fi-nom').textContent=n[r[0]]||r[1];$('.PX-fi-rol').textContent=r[1];$('.PX-rolp').textContent=r[2];
      $('.PX-fi-firma').hidden=fase!=='';$('.PX-fi-id').hidden=fase!=='id';$('.PX-fi-rec').hidden=fase!=='rec';
      papel.classList.toggle('PX-off',ap);$('.PX-fi-av').hidden=!ap;
      if(fase===''){prepara();botones()}
      if(fase==='rec'){$('.PX-rec-img').style.transform='rotate('+giro+'deg)';var b=$('.PX-rec-ok');b.disabled=false;b.textContent='Usar esta foto'}}
    function abreFirma(){var n=nombres();firmantes=ROLES.filter(function(r){return r[0]==='paciente'||n[r[0]]});paso=0;des={};pend=null;fase='';
      fi.classList.add('PX-fon');fi.setAttribute('aria-hidden','false');pintaFirma();$('.PX-fi').focus({preventScroll:true})}
    function cierraFirma(){clearTimeout(tSel);fi.classList.remove('PX-fon');fi.setAttribute('aria-hidden','true');var b=$('.PX-res-ok');b.disabled=false;b.textContent='Imprimir consentimiento'}
    function resuelve(rol,d){des[rol]=d;pend=null;fase='';var i=-1;firmantes.some(function(r,j){if(!des[r[0]]){i=j;return true}});paso=i<0?firmantes.length:i;pintaFirma()}
    function hayFirmas(){return !!pend||firmantes.some(function(r){return des[r[0]]&&des[r[0]].tipo==='firmo'})}
    function salir(){if($('.PX-res-ok').disabled)return;if(hayFirmas())A.abre('salir',$('.PX-fi-x'));else cierraFirma()}
    /* El trazo: puntero capturado dentro del lienzo; coordenadas en el espacio del bitmap (inmune al zoom de la página) */
    function pt(e){var r=lienzo.getBoundingClientRect();return [(e.clientX-r.left)*(lienzo.width/r.width),(e.clientY-r.top)*(lienzo.height/r.height)]}
    lienzo.addEventListener('pointerdown',function(e){if(apagado()||!ctx)return;e.preventDefault();lienzo.setPointerCapture(e.pointerId);dib=true;ult=pt(e);
      ctx.beginPath();ctx.moveTo(ult[0],ult[1]);ctx.lineTo(ult[0]+.1,ult[1]);ctx.stroke();if(!tinta){tinta=true;botones()}});
    lienzo.addEventListener('pointermove',function(e){if(!dib)return;var evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
      evs.forEach(function(q){var p=pt(q);ctx.beginPath();ctx.moveTo(ult[0],ult[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();ult=p})});
    function suelta(){dib=false;ult=null}
    lienzo.addEventListener('pointerup',suelta);lienzo.addEventListener('pointercancel',suelta);
    on('.PX-fi-borra','click',function(){prepara();botones()});
    on('.PX-fi-ok','click',function(){var r=firmantes[paso];if(apagado()){resuelve(r[0],{tipo:'no_pudo'});return}pend=r[0];fase='id';pintaFirma()});
    on('.PX-id-sin','click',function(){resuelve(pend,{tipo:'firmo',foto:false})});
    on('.PX-id-foto','click',function(){giro=0;fase='rec';pintaFirma()});   /* en la app abre la cámara o el selector de archivos del sistema */
    on('.PX-rec-v','click',function(){fase='id';pintaFirma()});
    on('.PX-rec-g','click',function(){giro+=90;$('.PX-rec-img').style.transform='rotate('+giro+'deg)'});
    on('.PX-rec-ok','click',function(e){var b=e.currentTarget;b.disabled=true;b.innerHTML='<span class="PX-giro" aria-hidden="true"></span>Guardando…';tSel=setTimeout(function(){resuelve(pend,{tipo:'firmo',foto:true})},RM?0:700)});
    $('.PX-res-l').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||$('.PX-res-ok').disabled)return;delete des[b.dataset.rol];fase='';firmantes.some(function(r,j){if(r[0]===b.dataset.rol){paso=j;return true}});pintaFirma()});
    on('.PX-res-ok','click',function(e){A.abre('sellar',e.currentTarget)});
    on('.PX-sellar-ok','click',function(){A.cierraTodo();var b=$('.PX-res-ok');b.disabled=true;b.innerHTML='<span class="PX-giro" aria-hidden="true"></span>Sellando…';
      tSel=setTimeout(function(){cierraFirma();A.generado('Consentimiento generado',true,'Consentimiento sellado · CI-2026-0007')},RM?0:900)});
    on('.PX-fi-x','click',salir);on('.PX-salir-si','click',function(){A.cierraTodo();cierraFirma()});
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&!A.abierta()&&fi.classList.contains('PX-fon'))salir()});

    /* ---- Estados de la maqueta (la tira vive fuera del marco) ---- */
    function base(){$('.PX-capa').classList.remove('PX-fijo');A.cierraTodo();cierraFirma();A.perfil(false)}
    function todos(foto){firmantes.forEach(function(r){des[r[0]]=r[0]==='paciente'&&pres('.PX-k-nofirma')?{tipo:'no_pudo'}:{tipo:'firmo',foto:foto&&r[0]!=='testigo_2'}});paso=firmantes.length;pintaFirma()}
    apis.push(function(d){base();
      if(d==='vacio'){A.plantillas([['Artroscopia de rodilla','Actualizada el 3 de noviembre'],['Infiltración','Actualizada el 21 de octubre']]);reinicia()}
      else if(d==='lleno')llena();
      else if(d==='valid'){reinicia();intentado=true;refresca();A.cont.scrollTop=0}
      else if(d==='sec'){reinicia();$('[data-sec="preoperatorio"] .PX-sec').click();A.irA($('[data-sec="preoperatorio"]'))}
      else if(d==='den'){llena();m.dataset.v='b';refresca()}
      else if(d==='borr'){llena();borrador=true;refresca()}
      else if(d==='prev'){reinicia();A.abre('prev')}
      else if(d==='nofirma'){llena();pres('.PX-k-nofirma',true);refresca();A.irA($('[data-row="familiar"]'))}
      else if(d==='firma'){llena();abreFirma()}
      else if(d==='firma-nf'){llena();pres('.PX-k-nofirma',true);refresca();abreFirma()}
      else if(d==='id'){llena();abreFirma();pend='paciente';fase='id';pintaFirma()}
      else if(d==='rec'){llena();abreFirma();pend='paciente';fase='rec';giro=0;pintaFirma()}
      else if(d==='rev'){llena();abreFirma();todos(true)}
      else if(d==='gen'){llena();A.generado('Consentimiento generado',true)}
      else if(d==='nog'){llena();A.generado('Consentimiento generado',false)}
      else if(d==='perfil'){reinicia();A.perfil(true);A.cont.scrollTop=A.cont.scrollHeight}
      else if(d==='sinpl'){reinicia();A.plantillas([]);$('.PX-pl-fila').click()}
      else if(d==='tope'){llena();var l=[];for(var i=1;i<=10;i++)l.push(['Plantilla de prueba '+(i<10?'0':'')+i,'Actualizada el '+i+' de noviembre']);A.plantillas(l)}
    });
    reinicia();
  });
  if(marcos.length)tira('PX',marcos,apis,[['vacio','Vacío'],['lleno','Lleno'],['valid','Validación'],['sec','Sección abierta'],['den','Denegación'],['nofirma','Paciente no puede firmar'],['borr','Borrador retomado'],['prev','Borrador previo'],
    ['firma','Firmado'],['firma-nf','Firmado sin paciente'],['id','Identificación'],['rec','Recorte'],['rev','Revisión antes de sellar'],['gen','Documento generado'],['nog','No quedó en el expediente'],['perfil','Perfil incompleto'],['sinpl','Sin plantillas'],['tope','10 plantillas']]);
