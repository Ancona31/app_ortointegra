  /* ===== Honorarios / Cotización ===== */
  var FLECHA=__FLECHA__,OKM=__OKM__,XI=__X__;
  var ORIG=['Honorarios médicos','Hospital','Anestesiólogo','Material e implantes'],MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function red(n){return Math.round(n*100)/100}
  function fmt(n,d){return red(n).toLocaleString(d==='MXN'?'es-MX':'en-US',{style:'currency',currency:d})}
  function aImp(t){var l=String(t).replace(/[^0-9.,]/g,''),dec=/[.,](\d{1,2})$/.exec(l),ent=(dec?l.slice(0,dec.index):l).replace(/[.,]/g,''),n=parseFloat(dec?ent+'.'+dec[1]:ent);return isFinite(n)&&n>0?red(n):0}
  function num(n){return n?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}
  var marcos=[].slice.call(document.querySelectorAll('.PX.marco')),apis=[];
  marcos.forEach(function(m){
    var lineas=[],nid=1,divisa='MXN',anticipo=0,intentado=false,seguro=false,tImp=0,tSug=0;
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var A=chasis(m,{plantillas:[['Consulta de primera vez','Actualizada el 9 de noviembre'],['Artroscopia de rodilla','Actualizada el 28 de octubre']],correo:'paciente01@semilla.spinus.test',OK:OKM,FLECHA:FLECHA,
      vacio:vacio,foto:foto,revela:revela,
      vaciar:function(dePlantilla){if(dePlantilla){lineas=[nueva()];anticipo=0;$('.PX-ant').value='';inp('notas').value='';pintaLineas();refresca()}else reinicia()},
      aplicar:function(n){if(n==='Artroscopia de rodilla'){m.dataset.v='b';lineas=COT()}else{m.dataset.v='a';lineas=[nueva('Consulta de ortopedia','',1200)]}pintaLineas();refresca()},
      trasEmitir:reinicia});
    var on=A.on,caja=$('.PX-lineas');
    function inp(k){return $('[data-k="'+k+'"]')}
    function v(k){return inp(k).value.trim()}
    function cot(){return m.dataset.v==='b'}
    function nueva(c,o,p){return {id:nid++,c:c||'',o:o||'',p:p||0}}
    function COT(){return [nueva('Honorarios del cirujano','Honorarios médicos',45000),nueva('Honorarios del ayudante','Honorarios médicos',12000),nueva('Hospitalización, 1 noche','Hospital',38500),nueva('Anestesia','Anestesiólogo',14000),nueva('Anclas y suturas','Material e implantes',22300)]}
    function conTexto(l){return l.c.trim()!==''||l.o.trim()!==''||l.p>0}
    function emitible(l){return l.c.trim()!==''&&l.p>0}
    function vacio(){return (v('paciente')===''||v('paciente')==='Paciente Prueba 01')&&!v('notas')&&!lineas.some(conTexto)&&inp('formapago').value==='Efectivo'&&divisa==='MXN'&&inp('vigencia').value==='30'&&!anticipo&&!seguro}
    function foto(){return JSON.stringify({l:lineas,d:divisa,a:anticipo,s:seguro,v:m.dataset.v,n:inp('notas').value})}
    function revela(s){s=JSON.parse(s);lineas=s.l;divisa=s.d;anticipo=s.a;seguro=s.s;m.dataset.v=s.v;inp('notas').value=s.n;$('.PX-ant').value=num(anticipo);pintaLineas();refresca()}
    function pintaLineas(){caja.innerHTML=lineas.map(function(l,i){var n=l.c.trim()?'Eliminar '+l.c.trim():'Eliminar concepto '+(i+1);
      return '<div class="PX-r PX-cl" data-id="'+l.id+'"><div class="PX-cl-1"><input type="text" class="PX-cl-c" data-f="c" value="'+h(l.c)+'" placeholder="Ej: Consulta de ortopedia" aria-label="Concepto '+(i+1)+'" autocomplete="off">'
        +'<button type="button" class="PX-p PX-ib PX-cl-x" aria-label="'+h(n)+'"'+(lineas.length===1?' disabled':'')+'>'+XI+'</button></div>'
        +'<div class="PX-cl-2"><input type="text" class="PX-cl-o" data-solo="b" data-f="o" value="'+h(l.o)+'" placeholder="De quién es el cobro" aria-label="Origen del concepto '+(i+1)+'" autocomplete="off">'
        +'<span class="PX-cl-pl" data-solo="a">Precio (<span class="PX-div">'+divisa+'</span>)</span>'
        +'<span class="PX-cl-pw"><span class="PX-sim" aria-hidden="true">$</span><input type="text" class="PX-cl-p" data-f="p" inputmode="decimal" value="'+num(l.p)+'" placeholder="0.00" aria-label="Precio del concepto '+(i+1)+'" autocomplete="off"></span></div>'
        +'<div class="PX-cl-sug" hidden>'+ORIG.map(function(o){return '<button type="button" class="PX-p">'+o+'</button>'}).join('')+'<p>Ninguno encaja: escribe el origen y se usa tal cual.</p></div>'
        +'<p class="PX-err" hidden>El precio debe ser mayor a 0</p></div>'}).join('')}
    function linea(el){var id=+el.closest('.PX-cl').dataset.id,r=null;lineas.some(function(l){if(l.id===id){r=l;return true}});return r}
    function refresca(){var c=cot(),ok=lineas.filter(emitible),total=red(ok.reduce(function(s,l){return s+l.p},0)),f=[];
      $$('[data-seg="var"] button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.val===m.dataset.v))});
      $$('[data-seg="divisa"] button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.val===divisa))});
      $$('.PX-div').forEach(function(x){x.textContent=divisa});
      $$('.PX-cl').forEach(function(r){var l=linea(r);r.querySelector('.PX-err').hidden=!(l.c.trim()!==''&&l.p<=0)});
      /* Subtotales por origen (cotización) */
      var acc={},ord=[];ok.forEach(function(l){var k=l.o.trim()||'Sin origen';if(!(k in acc)){acc[k]=0;ord.push(k)}acc[k]=red(acc[k]+l.p)});
      $('.PX-subs').innerHTML=ord.map(function(k){return '<div class="PX-r PX-tot"><span class="PX-flex">Subtotal · '+h(k)+'</span><b>'+fmt(acc[k],divisa)+'</b></div>'}).join('');
      $$('.PX-t-total').forEach(function(x){x.textContent=fmt(total,divisa)});$('.PX-t-saldo').textContent=fmt(total-anticipo,divisa);$('.PX-ant-av').hidden=!(anticipo>total);
      var d=new Date(2026,10,19+(+inp('vigencia').value));$('.PX-vig-n').textContent=inp('vigencia').value+' días · hasta '+d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear();
      $('.PX-k-seguro').setAttribute('aria-checked',String(seguro));$('.PX-seguro').hidden=!seguro;$('.PX-otra').hidden=inp('aseguradora').value!=='__otra__';
      /* Lo conservado al pasar a cotización */
      var fp=inp('formapago').value,pe=c&&fp!=='Efectivo',ae=c&&anticipo>0,t=pe&&ae?'Forma de pago ('+fp+') y anticipo ('+fmt(anticipo,divisa)+') se conservan escritos, pero no salen en la cotización.'
        :pe?'La forma de pago ('+fp+') se conserva escrita, pero no sale en la cotización.':ae?'El anticipo ('+fmt(anticipo,divisa)+') se conserva escrito, pero no sale en la cotización.':'';
      var cl=$('.PX-cons-l');cl.hidden=!t;cl.firstChild.textContent=t;
      if(!v('paciente'))f.push({clave:'paciente',nombre:'Paciente',ir:function(){A.irA(inp('paciente'))}});
      if(!ok.length)f.push({clave:'conceptos',nombre:'Conceptos',ir:function(){A.irA($('.PX-cl-c'))}});
      var cls=f.map(function(x){return x.clave});$$('[data-row]').forEach(function(r){r.classList.toggle('PX-falta',intentado&&cls.indexOf(r.dataset.row)>=0)});
      caja.classList.toggle('PX-falta',intentado&&cls.indexOf('conceptos')>=0);
      A.faltan(intentado?f:[]);return f}
    function reinicia(){clearTimeout(tImp);$$('.PX-b-imp').forEach(function(b){b.disabled=false;b.textContent='Imprimir';b.parentNode.classList.remove('PX-ocup')});intentado=false;seguro=false;divisa='MXN';anticipo=0;m.dataset.v='a';lineas=[nueva()];
      inp('fecha').value='19/11/2026';inp('paciente').value='Paciente Prueba 01';inp('vigencia').value='30';inp('formapago').value='Efectivo';inp('notas').value='';inp('aseguradora').value='';
      ['aseg_otra','poliza','cobertura'].forEach(function(k){inp(k).value=''});$('.PX-ant').value='';A.sinAviso();pintaLineas();A.creceTodo();A.cont.scrollTop=0;refresca()}
    function recibo(){reinicia();lineas=[nueva('Consulta de ortopedia','',1200),nueva('Infiltración de rodilla','',2500)];anticipo=1000;$('.PX-ant').value=num(anticipo);inp('formapago').value='Transferencia bancaria';
      inp('notas').value='Incluye material de curación.';pintaLineas();A.creceTodo();refresca()}
    function cotiza(){reinicia();m.dataset.v='b';lineas=COT();inp('notas').value='Cotización sujeta a cambios según hallazgos transoperatorios.';pintaLineas();A.creceTodo();refresca()}

    caja.addEventListener('input',function(e){var l=linea(e.target),f=e.target.dataset.f;if(f==='p')l.p=aImp(e.target.value);else l[f]=e.target.value;
      if(f==='c'){var x=e.target.closest('.PX-cl').querySelector('.PX-cl-x');x.setAttribute('aria-label',l.c.trim()?'Eliminar '+l.c.trim():'Eliminar concepto')}refresca()});
    caja.addEventListener('focusout',function(e){var t=e.target;if(t.dataset.f==='p')t.value=num(linea(t).p);
      if(t.dataset.f==='o'){var s=t.closest('.PX-cl').querySelector('.PX-cl-sug');tSug=setTimeout(function(){s.hidden=true},160)}});
    caja.addEventListener('focusin',function(e){if(e.target.dataset.f==='o'){clearTimeout(tSug);$$('.PX-cl-sug').forEach(function(s){s.hidden=true});e.target.closest('.PX-cl').querySelector('.PX-cl-sug').hidden=false}});
    caja.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var r=b.closest('.PX-cl'),l=linea(b);
      if(b.classList.contains('PX-cl-x')){if(lineas.length>1){lineas.splice(lineas.indexOf(l),1);pintaLineas();refresca()}}
      else{clearTimeout(tSug);l.o=b.textContent;r.querySelector('.PX-cl-o').value=l.o;r.querySelector('.PX-cl-sug').hidden=true;refresca()}});
    on('.PX-add','click',function(){lineas.push(nueva());pintaLineas();refresca();var c=$$('.PX-cl-c');c[c.length-1].focus()});
    $('.PX-ant').addEventListener('input',function(e){anticipo=aImp(e.target.value);refresca()});
    $('.PX-ant').addEventListener('blur',function(e){e.target.value=num(anticipo)});
    m.addEventListener('input',function(e){if(e.target.closest('.PX-form')&&!e.target.closest('.PX-lineas'))refresca()});
    m.addEventListener('change',function(e){if(e.target.tagName==='SELECT')refresca()});
    on('[data-seg="var"] button','click',function(e){m.dataset.v=e.currentTarget.dataset.val;refresca()});
    on('[data-seg="divisa"] button','click',function(e){divisa=e.currentTarget.dataset.val;refresca()});
    on('.PX-k-seguro','click',function(){seguro=!seguro;if(!seguro){inp('aseguradora').value='';['aseg_otra','poliza','cobertura'].forEach(function(k){inp(k).value=''})}refresca()});
    on('.PX-b-gpl','click',function(e){A.guardarPl(e.currentTarget)});
    on('.PX-b-imp','click',function(e){intentado=true;var f=refresca();if(f.length){f[0].ir();return}var b=e.currentTarget,c=cot();b.disabled=true;b.parentNode.classList.add('PX-ocup');b.innerHTML='<span class="PX-giro" aria-hidden="true"></span>Generando PDF…';
      tImp=setTimeout(function(){b.disabled=false;b.parentNode.classList.remove('PX-ocup');b.textContent='Imprimir';A.generado(c?'Cotización generada':'Recibo generado',true,c?'Cotización guardada · COT-2026-0004':'Recibo guardado · NOH-2026-0012')},RM?0:900)});

    function base(){$('.PX-capa').classList.remove('PX-fijo');A.cierraTodo();A.perfil(false)}
    apis.push(function(d){base();
      if(d==='vacio')reinicia();
      else if(d==='recibo')recibo();
      else if(d==='cot')cotiza();
      else if(d==='seg'){cotiza();seguro=true;inp('aseguradora').value='GNP Seguros';inp('poliza').value='POL-000001';inp('cobertura').value='80%';refresca();A.irA($('.PX-k-seguro'))}
      else if(d==='otra'){cotiza();seguro=true;inp('aseguradora').value='__otra__';refresca();A.irA($('.PX-k-seguro'))}
      else if(d==='orig'){cotiza();lineas.push(nueva('Rehabilitación, 10 sesiones','',0));pintaLineas();refresca();var o=$$('.PX-cl-o');A.irA(o[o.length-1])}
      else if(d==='valid'){reinicia();inp('paciente').value='';intentado=true;refresca()}
      else if(d==='precio'){reinicia();lineas=[nueva('Consulta de ortopedia','',0)];pintaLineas();refresca()}
      else if(d==='ant'){recibo();anticipo=5000;$('.PX-ant').value=num(anticipo);refresca();A.irA($('.PX-ant'));$('.PX-ant').blur()}
      else if(d==='cons'){recibo();m.dataset.v='b';refresca();A.cont.scrollTop=A.cont.scrollHeight}
      else if(d==='usd'){cotiza();divisa='USD';refresca()}
      else if(d==='gen'){recibo();A.generado('Recibo generado',true)}
      else if(d==='nog'){recibo();A.generado('Recibo generado',false)}
      else if(d==='perfil'){reinicia();A.perfil(true);A.cont.scrollTop=A.cont.scrollHeight}
    });
    reinicia();
  });
  if(marcos.length)tira('PX',marcos,apis,[['vacio','Vacío'],['recibo','Recibo lleno'],['cot','Cotización llena'],['seg','Con seguro'],['otra','Otra aseguradora'],['orig','Origen: sugerencias'],['valid','Validación'],['precio','Precio inválido'],
    ['ant','Anticipo mayor al total'],['cons','Lo conservado'],['usd','En USD'],['gen','Documento generado'],['nog','No quedó en el expediente'],['perfil','Perfil incompleto']]);
