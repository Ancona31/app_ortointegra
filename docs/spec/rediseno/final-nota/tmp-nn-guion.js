(function(){
  /* Maqueta: nada de esto llama a una IA. La nota es un texto fijo de ejemplo y «Redactando nota médica...» es un temporizador. */
  var EJ='Paciente con dolor lumbar de 2 semanas tras cargar peso, sin irradiación, Lasègue negativo, fuerza y reflejos normales. Indico naproxeno 500 mg cada 12 h por 7 días, paracetamol en caso de dolor, ejercicios de McKenzie, cita en 2 semanas.';
  var NOTA='[SUBJETIVO]: Paciente refiere dolor lumbar de 2 semanas de evolución, de inicio tras cargar peso. Niega irradiación a miembros inferiores.\n\n[OBJETIVO]: Marcha normal. Lasègue negativo bilateral. Fuerza 5/5 y reflejos osteotendinosos conservados.\n\n[AUXILIARES DIAGNÓSTICOS]: No se solicitaron.\n\n[DIAGNÓSTICO]: Lumbago no especificado.\n\n[ANÁLISIS]: Cuadro de características mecánicas, sin datos de alarma neurológica.\n\n[PLAN]: Naproxeno 500 mg cada 12 h por 7 días. Paracetamol 500 mg cada 8 h en caso de dolor. Ejercicios de McKenzie. Cita de control en 2 semanas.';
  var CIE=[['M54.5','Lumbago no especificado'],['M54.4','Lumbago con ciática'],['M25.5','Gonalgia'],['S93.4','Esguince de tobillo'],['M75.1','Síndrome del manguito rotador']];
  var RANGO={sis:[90,139],dia:[60,89],fc:[60,100],fr:[12,20],temp:[36,37.5],spo2:[95,100]};
  var NORMAL={sis:'120',dia:'80',fc:'72',fr:'16',temp:'36.5',spo2:'98'},LARGOS={sis:'148',dia:'92',fc:'104',fr:'22',temp:'38.6',spo2:'91'};
  /* nombre, «la receta» (al descartar), «una receta empezada» (al concluir): textos de SelectorTipoDocumento.tsx */
  var DOCS={receta:['Receta','la receta','una receta empezada'],lab:['Laboratorio','la solicitud de laboratorio','una solicitud de laboratorio empezada'],imagen:['Imagenología','la solicitud de imagenología','una solicitud de imagenología empezada'],
    sup:['Suplementación','el plan de suplementación','un plan de suplementación empezado'],inter:['Internamiento','la solicitud de internamiento','una solicitud de internamiento empezada'],escrito:['Escrito médico','el escrito médico','un escrito médico empezado'],
    consent:['Consentimiento','el consentimiento','un consentimiento empezado'],honor:['Honorarios / Cotización','la nota de honorarios','una nota de honorarios empezada']};
  var RX={'Naproxeno 500 mg':['Naproxeno','Tomar 1 tableta cada 12 hrs por 7 días'],'Paracetamol 500 mg':['Paracetamol','Tomar 1 tableta cada 8 hrs en caso de dolor']};
  var VIAS=['Oral','Tópica','Intramuscular','Intravenosa','Subcutánea','Sublingual','Oftálmica','Ótica','Nasal','Inhalatoria','Rectal','Transdérmica'];
  var SVG='<svg aria-hidden="true" width="W" height="W" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="G" stroke-linecap="round" stroke-linejoin="round">D</svg>';
  function ico(d,w,g){return SVG.replace(/W/g,w).replace('G',g).replace('D',d)}
  var BASURA=ico('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',20,1.8),EQUIS=ico('<path d="M6 6l12 12M18 6 6 18"/>',18,2),ABAJO=ico('<path d="m6 9 6 6 6-6"/>',16,2);
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function tit(s){s=s.toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1)}
  var marcos=[].slice.call(document.querySelectorAll('.nn.marco')),apis=[];
  marcos.forEach(function(m){
    var vp=m.dataset.vp,esc=vp==='esc';
    var $=function(s){return m.querySelector(s)},$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var on=function(s,ev,f){$$(s).forEach(function(e){e.addEventListener(ev,f)})};
    var cont=$('.nn-cont'),capa=$('.nn-capa'),dict=$('.nn-dict'),notaTa=$('.nn-nota-ta'),prosa=$('.nn-prosa'),ctxTa=$('.nn-ctx-ta'),motivo=$('.nn-motivo'),medL=$('.nn-med-l'),MED0=medL.innerHTML,rxL=$('.nn-rx-l'),dxR=$('.nn-dxr');
    var DX0='<li class="nn-dli"><span class="nn-flex">Lumbago no especificado</span><span class="nn-cod">M54.5</span></li>';
    var pan=null,origen=null,tGen=0,tToast=0,sucia=false,sinCons=false,docAb=null,pendiente=null,bloque=0;

    function ajusta(){if(!esc)return;var e=m.dataset.e;dict.style.height='';if(e==='rev'||e==='regen')dict.style.height=Math.min(dict.scrollHeight+2,420)+'px'}  /* tras generar, la descripción mide lo que su texto */
    /* Modo manual: cada campo mide lo que su texto (o lo que su ejemplo, mientras está vacío): ningún ejemplo queda cortado */
    function altoMan(){$$('.nn-man .nn-mta').forEach(function(a){if(!a.offsetParent)return;var v=a.value;a.style.height='0px';if(!v)a.value=a.placeholder;var al=a.scrollHeight;a.value=v;a.style.height=al+'px'})}
    function refresca(){var e=m.dataset.e,t=dict.value.trim();
      $$('.nn-b-gen').forEach(function(b){b.disabled=!t});
      $$('.nn-b-prev').forEach(function(b){b.disabled=!motivo.value.trim()});
      $$('.nn-b-guardar').forEach(function(b){b.disabled=sinCons});
      $$('.nn-autog').forEach(function(x){x.hidden=!(m.dataset.modo==='man'?motivo.value.trim():t)});
      dict.readOnly=e==='gen'||e==='regen';$('.nn-mas-b').disabled=e==='gen'||e==='regen';
      $$('.nn-tipo').forEach(function(b){if(b.dataset.t===docAb)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
      m.classList.toggle('nn-sincons',sinCons);ajusta();altoMan()}
    function estado(e){m.dataset.e=e;m.classList.remove('nn-ed');cont.scrollTop=0;$$('.nn-form,.nn-man,.nn-esc').forEach(function(x){x.scrollTop=0});refresca()}
    function toast(t){var g=document.querySelector('.nn-tira-msg');
      /* Pasada final: los avisos de maqueta no van dentro del marco; se escriben en la tira */
      if(g&&/^Maqueta: /.test(t)){g.textContent=t.replace(/^Maqueta: /,'');clearTimeout(tToast);tToast=setTimeout(function(){g.textContent=''},5000);return}
      var x=$('.nn-toast');x.firstChild.textContent=t;x.classList.add('nn-on');clearTimeout(tToast);tToast=setTimeout(function(){x.classList.remove('nn-on')},2600)}

    /* ---- Capas ---- */
    function abre(p,desde){if(desde)origen=desde;pan=p;var x=$('.nn-pan[data-pan="'+p+'"]');
      $$('.nn-pan').forEach(function(y){y.classList.toggle('nn-act',y===x)});
      capa.classList.toggle('nn-sinvelo',p==='menu'&&esc);capa.classList.add('nn-on');capa.setAttribute('aria-hidden','false');
      if(p==='menu'&&esc){var b=$('.nn-mas-b').getBoundingClientRect(),r=m.getBoundingClientRect(),z=r.width/m.offsetWidth||1;  /* el menú nace de su botón */
        x.style.top=((b.bottom-r.top)/z+4)+'px';x.style.left=((b.left-r.left)/z)+'px'}
      var f=(p==='vit'||p==='ctx')?x.querySelector('input,textarea'):x;f.focus({preventScroll:true})}  /* con campos, al primero; sin campos, a la capa (Tab entra a sus acciones) */
    function cierra(){if(!pan)return;pan=null;capa.classList.remove('nn-on');capa.setAttribute('aria-hidden','true');$$('.nn-pan').forEach(function(y){y.classList.remove('nn-act')});
      if(origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    /* El marco nunca se desplaza: si el navegador lo mueve al enfocar algo dentro de una capa, se devuelve a su sitio */
    m.addEventListener('scroll',function(e){var t=e.target;if(t===m||/nn-(app|capa|col)( |$)/.test(t.className)){t.scrollTop=0;t.scrollLeft=0}},true);
    on('.nn-cierra','click',cierra);$('.nn-velo').addEventListener('click',cierra);
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&pan)cierra()});
    on('a[href="#"]','click',function(e){e.preventDefault()});
    on('.nn-form','submit',function(e){e.preventDefault()});

    /* ---- Signos vitales ---- */
    function fuera(k,v){if(v==='')return false;var n=parseFloat(v.replace(',','.'));return isNaN(n)||n<RANGO[k][0]||n>RANGO[k][1]}
    function pintaVit(){var v={},p=[];$$('.nn-vi').forEach(function(i){v[i.dataset.k]=i.value.trim();i.classList.toggle('nn-mala',fuera(i.dataset.k,v[i.dataset.k]))});
      function val(k){return v[k]===''?'—':(fuera(k,v[k])?'<span class="nn-fuera">'+h(v[k])+'</span>':h(v[k]))}
      if(v.sis||v.dia)p.push('<span class="nn-nw">'+val('sis')+'/'+val('dia')+'</span>');
      [['fc',' lpm'],['fr',' rpm'],['temp',' °C'],['spo2',' %']].forEach(function(q){if(v[q[0]])p.push('<span class="nn-nw">'+val(q[0])+q[1]+'</span>')});
      m.classList.toggle('nn-convit',p.length>0);
      $$('.nn-vres').forEach(function(x){x.innerHTML=p.join(' · ')});var kv=[];if(v.sis||v.dia)kv.push(['Presión arterial',val('sis')+'/'+val('dia'),'mmHg']);
      [['fc','FC','lpm'],['fr','FR','rpm'],['temp','Temp.','°C'],['spo2','SpO₂','%']].forEach(function(q){if(v[q[0]])kv.push([q[1],val(q[0]),q[2]])});
      $('.nn-vres2').innerHTML=kv.length?kv.map(function(k){return '<div><dt>'+k[0]+'</dt><dd>'+k[1]+' <small>'+k[2]+'</small></dd></div>'}).join(''):'<div><dd class="nn-kv-no">Sin capturar</dd></div>';
      var n=0;$$('.nn-vr').forEach(function(r){var mal=!!r.querySelector('.nn-mala');if(mal)n++;r.querySelector('.nn-vmsg').hidden=!mal});  /* la presión arterial cuenta como un signo, igual que hoy */
      $$('.nn-vchip').forEach(function(x){x.hidden=!n;x.textContent=n+' fuera de rango'});
      $('.nn-sinvit').hidden=p.length>0}
    function ponVit(o){$$('.nn-vi').forEach(function(i){i.value=o[i.dataset.k]||''});pintaVit()}
    on('.nn-vi','input',pintaVit);
    on('.nn-vfila','click',function(e){abre('vit',e.currentTarget)});

    /* ---- Escritura ---- */
    dict.addEventListener('input',refresca);motivo.addEventListener('input',refresca);on('.nn-man .nn-mta','input',altoMan);
    function modo(x){m.dataset.modo=x;estado('cap')}
    on('.nn-a-man','click',function(){modo('man')});on('.nn-a-ia','click',function(){modo('ia')});
    on('.nn-borr-x','click',function(){dict.value='';ponVit({});m.classList.remove('nn-borr');refresca()});

    /* ---- Generar (maqueta) ---- */
    function pinta(){var t=notaTa.value,re=/\[([^\]]+)\]:?[ \t]*/g,p=[],k,ult=null;
      while((k=re.exec(t))){if(ult)ult.fin=k.index;ult={tit:k[1],ini:re.lastIndex,fin:t.length};p.push(ult)}
      var hayDx=false;
      prosa.innerHTML=p.length?p.map(function(s){var T=s.tit.toUpperCase(),x=t.slice(s.ini,s.fin).trim(),c;
        if(/^DIAGN/.test(T)){hayDx=true;c=dxDestacado(x)}else c='<p>'+h(x)+'</p>';  /* el Plan es texto: los medicamentos ya salen en «Detecté estos medicamentos» */
        return '<section class="nn-sec"><h3>'+h(tit(s.tit))+'</h3>'+c+'</section>'}).join(''):'<section class="nn-sec"><p>'+h(t.trim())+'</p></section>';
      m.classList.toggle('nn-dxen',hayDx);  /* con el diagnóstico destacado en la nota, la lista «Diagnósticos» solo hace falta al editar */
      $('.nn-pro-v').textContent=$('.nn-pro').value.trim()||'—';$('.nn-cita-v').textContent=$('.nn-cita').value.trim()||'—'}
    /* Diagnóstico destacado (17/700) con su CIE-10 en etiqueta: sale de los diagnósticos estructurados; sin ellos, del texto de la sección */
    function dxDestacado(x){var l=[].slice.call(dxR.querySelectorAll('li:not(.nn-dx-no)'));
      if(!l.length)return '<p class="nn-dxp">'+h(x)+'</p>'+(dxR.querySelector('.nn-dx-no')?'<p class="nn-dx-nota">'+h(dxR.querySelector('.nn-dx-no').textContent)+'</p>':'');
      return '<ul class="nn-dxs">'+l.map(function(li){var c=li.querySelector('.nn-cod');return '<li><span class="nn-dxn">'+h(li.querySelector('.nn-flex').textContent)+'</span>'+(c?'<span class="nn-cod">'+h(c.textContent)+'</span>':'')+'</li>'}).join('')+'</ul>'}
    function lista(t,dx){notaTa.value=t;dxR.innerHTML=dx;pinta();sucia=false;estado('rev')}
    function genera(){clearTimeout(tGen);var de=m.dataset.e;cierra();estado(de==='rev'?'regen':'gen');tGen=setTimeout(function(){lista(NOTA,DX0)},RM?700:1800)}
    on('.nn-b-gen,.nn-b-rei','click',genera);
    on('.nn-b-cer','click',function(){estado('cap')});
    function manualNota(){var g=function(c,v){return ($(c).value||'').trim()||v},dx=$$('.nn-dx-l .nn-flex').map(function(x){return x.textContent}).join('; ')||'Diagnóstico pendiente.';
      return '[SUBJETIVO]: '+g('.nn-motivo','')+'\n\n[OBJETIVO]: '+g('.nn-m-exp','Sin exploración física registrada.')+'\n\n[AUXILIARES DIAGNÓSTICOS]: '+g('.nn-m-aux','Estudios de gabinete y laboratorio pendientes.')+'\n\n[DIAGNÓSTICO]: '+dx+'\n\n[ANÁLISIS]: '+g('.nn-m-ana','Análisis clínico pendiente.')+'\n\n[PLAN]: '+g('.nn-m-plan','Plan de tratamiento pendiente.')}
    function manualDx(){var l=$$('.nn-dx-l .nn-dli').map(function(li){var c=li.querySelector('.nn-cod');return '<li class="nn-dli"><span class="nn-flex">'+h(li.querySelector('.nn-flex').textContent)+'</span>'+(c?'<span class="nn-cod">'+h(c.textContent)+'</span>':'')+'</li>'}).join('');
      return l||'<li class="nn-dli nn-dx-no">Sin diagnóstico estructurado — la nota se guardará sin código CIE-10.</li>'}
    function previa(){lista(manualNota(),manualDx())}
    on('.nn-b-prev','click',previa);
    on('.nn-b-volver','click',function(e){if(!esc)estado('cap');else if(sucia){origen=e.currentTarget;abre('pisar')}else previa()});

    /* ---- Revisión ---- */
    function crece(){notaTa.style.height='auto';notaTa.style.height=(notaTa.scrollHeight+2)+'px'}  /* el texto editable mide lo que su contenido: sin desplazamiento interno */
    on('.nn-b-ed','click',function(){var ed=m.classList.toggle('nn-ed');if(!ed)pinta();else{crece();notaTa.focus({preventScroll:true})}});
    notaTa.addEventListener('input',function(){sucia=true;crece()});on('.nn-pro,.nn-cita','input',function(){sucia=true});
    function cuenta(){var n=medL.children.length;$('.nn-meds').hidden=!n;$$('.nn-cuenta').forEach(function(x){x.hidden=!n;x.textContent=n+(n===1?' medicamento':' medicamentos')})}
    medL.addEventListener('click',function(e){var b=e.target.closest('.nn-quitar');if(b){b.closest('li').remove();cuenta()}});
    function regenera(){if(m.dataset.modo==='man')previa();else if(esc)genera();else{ctxTa.value=dict.value;abre('ctx')}}
    on('.nn-b-reg','click',function(e){origen=e.currentTarget;if(sucia)abre('pisar');else regenera()});
    on('.nn-pisar-si','click',function(){sucia=false;m.classList.remove('nn-ed');cierra();regenera()});
    on('.nn-ctx-ok','click',function(){dict.value=ctxTa.value;genera()});
    on('.nn-nuevo-si','click',function(){cierra();estado('cap')});
    on('.nn-b-guardar','click',function(e){if(m.classList.contains('nn-ed')){m.classList.remove('nn-ed');pinta()}abre('conf',e.currentTarget)});
    on('.nn-conf-ok','click',function(){origen=null;cierra();docAb=null;estado('ok')});

    /* ---- Después de guardar: rejilla de documentos, receta precargada ---- */
    function fila(et,campo){return '<label class="nn-fila"><span>'+et+'</span>'+campo+'</label>'}
    function rxBloque(nom,pa,ind){var d=document.createElement('section');d.className='nn-grp nn-rxb';
      d.innerHTML='<div class="nn-grp-f"><h3 class="nn-grp-t"></h3><button type="button" class="nn-p nn-ib nn-rx-x">'+BASURA+'</button></div>'
        +fila('Nombre comercial *','<input type="text" class="nn-fi nn-rx-nom" value="'+h(nom)+'" placeholder="Ej: Voltaren" autocomplete="off">')
        +'<div class="nn-par nn-par-m">'+fila('Presentación','<input type="text" class="nn-fi" placeholder="Tabletas 50 mg" autocomplete="off">')
        +fila('Vía de administración','<span class="nn-selw"><select class="nn-sel">'+VIAS.map(function(v){return '<option>'+v+'</option>'}).join('')+'</select>'+ABAJO+'</span>')+'</div>'
        +fila('Principio activo *','<input type="text" class="nn-fi" value="'+h(pa)+'" placeholder="Diclofenaco sódico" autocomplete="off">')
        +'<label class="nn-fila nn-fila-a"><span>Indicaciones</span><textarea class="nn-mta" rows="2" placeholder="Tomar 1 tableta cada 8 hrs con alimentos por 7 días">'+h(ind)+'</textarea></label>'
        +'<button type="button" class="nn-p nn-txt nn-izqd nn-rx-mas">Agregar medicamento</button>';
      return d}
    function rxNumera(){var b=[].slice.call(rxL.children);b.forEach(function(s,i){var n=s.querySelector('.nn-rx-nom').value.trim();s.querySelector('.nn-grp-t').textContent='Medicamento '+(i+1);
      var x=s.querySelector('.nn-rx-x');x.disabled=b.length===1;x.setAttribute('aria-label',n?'Eliminar '+n:'Eliminar medicamento '+(i+1))})}
    function rxArma(){rxL.innerHTML='';var ns=[].slice.call(medL.querySelectorAll('.nn-flex')).map(function(x){return x.textContent});
      if(m.dataset.modo==='man'||!ns.length)ns=[''];ns.forEach(function(n){var r=RX[n]||['',''];rxL.appendChild(rxBloque(n,r[0],r[1]))});
      $('.nn-rx-dx').value=[].slice.call(dxR.querySelectorAll('li:not(.nn-dx-no)')).map(function(li){var c=li.querySelector('.nn-cod');return (c?c.textContent+' ':'')+li.querySelector('.nn-flex').textContent}).join('; ');$('.nn-rx-rec').value='';rxNumera()}
    rxL.addEventListener('click',function(e){var a=e.target.closest('.nn-rx-mas'),x=e.target.closest('.nn-rx-x');
      if(a){var n=rxBloque('','','');rxL.insertBefore(n,a.closest('.nn-rxb').nextSibling);rxNumera();n.querySelector('input').focus()}
      else if(x&&!x.disabled){x.closest('.nn-rxb').remove();rxNumera()}});
    rxL.addEventListener('input',function(e){if(e.target.classList.contains('nn-rx-nom'))rxNumera()});
    function conDatos(){return docAb==='receta'}  /* maqueta: solo la Receta tiene formulario, y nace precargada */
    function abreDoc(t){cierra();if(t!==docAb){docAb=t;if(t==='receta')rxArma()}
      var tile=$('.nn-tipo[data-t="'+t+'"] .nn-az-i'),ic=$('.nn-doc-ic');ic.innerHTML=tile.innerHTML;ic.style.color=tile.style.getPropertyValue('--c');
      $$('.nn-doc-n').forEach(function(x){x.textContent=DOCS[t][0]});
      m.classList.toggle('nn-docotro',t!=='receta');estado('doc');
      if(t!=='receta')toast('Maqueta: el formulario completo de «'+DOCS[t][0]+'» está en la página Documentos; aquí se dibujan su cabecera y los datos del paciente precargados')}
    on('.nn-tipo','click',function(e){var t=e.currentTarget.dataset.t;
      if(docAb&&t!==docAb&&conDatos()){pendiente=t;$$('.nn-cb-a').forEach(function(x){x.textContent=DOCS[t][0]});$('.nn-cb-de').textContent=DOCS[docAb][1];
        $('.nn-pan[data-pan="cambio"]').setAttribute('aria-label','¿Cambiar a '+DOCS[t][0]+'?');abre('cambio',e.currentTarget)}
      else abreDoc(t)});
    on('.nn-cb-ok','click',function(){origen=null;docAb=null;abreDoc(pendiente)});
    function imprime(){var t=$('.nn-ok-imp-t');if(t.textContent==='Abrir PDF')toast('Maqueta: aquí se abre el PDF de la nota');else{t.textContent='Abrir PDF';toast('Maqueta: se genera el PDF de la nota')}}
    on('.nn-ok-imp','click',imprime);
    on('.nn-ok-exp','click',function(){toast('Maqueta: aquí vuelves al expediente')});
    on('.nn-b-docs','click',function(){if(!conDatos())docAb=null;estado('ok')});
    on('.nn-b-ver','click',function(){estado('ver')});
    on('.nn-b-imp','click',function(){toast('Maqueta: se imprime «'+DOCS[docAb][0]+'» y el formulario se cierra');docAb=null;estado('ok')});  /* hoy, al emitir, el formulario se desmonta */
    on('.nn-b-plant','click',function(){toast('Maqueta: aquí se guarda el formulario como plantilla')});
    function concluye(){cierra();toast('Maqueta: aquí vuelves al expediente')}
    on('.nn-b-conc','click',function(e){if(docAb&&conDatos()){$('.nn-pend').textContent=DOCS[docAb][2];abre('conc',e.currentTarget)}else concluye()});
    on('.nn-conc-ok','click',concluye);

    /* ---- Menú «···» ---- */
    on('.nn-mas-b','click',function(e){abre('menu',e.currentTarget)});
    on('.nn-mr[data-a]','click',function(e){var a=e.currentTarget.dataset.a,o=origen;cierra();
      if(a==='pac')abre('pac',o);else if(a==='man'||a==='ia')modo(a);else if(a==='nuevo')abre('nuevo',o);else if(a==='imp')imprime();else if(a==='plantg')toast('Maqueta: aquí se gestionan las plantillas');else toast('Maqueta: aquí vuelves al expediente')});

    /* ---- Modo manual: diagnósticos CIE-10 ---- */
    var dxIn=$('.nn-dx-in'),dxRes=$('.nn-dx-res'),dxL=$('.nn-dx-l');
    function dxAgrega(cod,nom){var li=document.createElement('li');li.className='nn-dli';
      li.innerHTML='<span class="nn-flex">'+h(nom)+'</span>'+(cod?'<span class="nn-cod">'+h(cod)+'</span>':'')+'<button type="button" class="nn-p nn-ib nn-dx-x" aria-label="Eliminar diagnóstico">'+EQUIS+'</button>';
      dxL.appendChild(li);dxIn.value='';dxRes.hidden=true;dxIn.placeholder='Diagnóstico adicional...'}
    dxIn.addEventListener('input',function(){var q=dxIn.value.trim().toLowerCase(),r=q?CIE.filter(function(c){return (c[0]+' '+c[1]).toLowerCase().indexOf(q)>=0}).slice(0,4):[];
      dxRes.innerHTML=r.map(function(c){return '<li><button type="button" class="nn-p nn-dx-op" data-c="'+c[0]+'"><span class="nn-flex">'+h(c[1])+'</span><span class="nn-cod">'+c[0]+'</span></button></li>'}).join('');dxRes.hidden=!r.length});
    function dxLibre(){if(dxIn.value.trim())dxAgrega('',dxIn.value.trim());else dxIn.focus()}
    dxIn.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();dxLibre()}});
    on('.nn-dx-mas','click',dxLibre);
    dxRes.addEventListener('click',function(e){var b=e.target.closest('.nn-dx-op');if(b)dxAgrega(b.dataset.c,b.firstChild.textContent)});
    dxL.addEventListener('click',function(e){var b=e.target.closest('.nn-dx-x');if(b){b.closest('li').remove();if(!dxL.children.length)dxIn.placeholder='Buscar diagnóstico CIE-10 o escribir...'}});

    /* ---- Entrevista ---- */
    var bloques=$$('.nn-bloque'),sig=$('.nn-ent-sig'),ant=$('.nn-ent-ant');
    function resp(q){return !!q.querySelector('.nn-op[aria-pressed="true"]')||!!q.querySelector('.nn-q-in').value.trim()}
    function ent(){bloques.forEach(function(b,i){b.hidden=i!==bloque});var qs=[].slice.call(bloques[bloque].querySelectorAll('.nn-q')),f=qs.filter(function(q){return !resp(q)}).length;
      $('.nn-ent-prog').textContent='Bloque '+(bloque+1)+' de '+bloques.length;$('.nn-ent-falta').textContent=f?' · Faltan '+f+' por responder':'';
      ant.disabled=bloque===0;sig.disabled=f>0;sig.textContent=bloque===bloques.length-1?'Enviar respuestas':'Siguiente'}
    on('.nn-op','click',function(e){var b=e.currentTarget,q=b.closest('.nn-q'),ya=b.getAttribute('aria-pressed')==='true';
      [].forEach.call(q.querySelectorAll('.nn-op'),function(o){o.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed',String(!ya));if(!ya)q.querySelector('.nn-q-in').value='';ent()});
    on('.nn-q-in','input',function(e){if(e.currentTarget.value.trim())[].forEach.call(e.currentTarget.closest('.nn-q').querySelectorAll('.nn-op'),function(o){o.setAttribute('aria-pressed','false')});ent()});
    ant.addEventListener('click',function(){bloque=Math.max(0,bloque-1);ent()});
    sig.addEventListener('click',function(){if(bloque<bloques.length-1){bloque++;ent();$('.nn-pan[data-pan="ent"] .nn-hj-c').scrollTop=0}else genera()});
    function entReinicia(){bloque=0;$$('.nn-op').forEach(function(o){o.setAttribute('aria-pressed','false')});$$('.nn-q-in').forEach(function(i){i.value=''});ent()}

    /* ---- Controles de la maqueta (los pulsa la tira, que vive fuera del marco) ---- */
    function base(){clearTimeout(tGen);cierra();origen=null;m.dataset.modo='ia';m.classList.remove('nn-borr','nn-prim1');sinCons=false;docAb=null;sucia=false;
      medL.innerHTML=MED0;cuenta();$('.nn-ok-imp-t').textContent='Imprimir nota';$('.nn-pro').value='';$('.nn-cita').value='En 2 semanas'}
    function conNota(){base();dict.value=EJ;if(!m.classList.contains('nn-convit'))ponVit(NORMAL);lista(NOTA,DX0)}
    apis.push(function(d){
      if(d==='vacia'){base();dict.value='';ponVit({});estado('cap')}
      else if(d==='ej'){base();dict.value=EJ;estado('cap')}
      else if(d==='vit'){ponVit(NORMAL)}
      else if(d==='fuera'){var o={};for(var k in NORMAL)o[k]=NORMAL[k];o.sis='168';ponVit(o)}
      else if(d==='largos'){ponVit(LARGOS)}
      else if(d==='gen'){base();dict.value=EJ;estado('gen')}
      else if(d==='err'){base();dict.value=EJ;estado('err')}
      else if(d==='ent'){base();dict.value=EJ;estado('cap');entReinicia();abre('ent')}
      else if(d==='rev'){conNota()}
      else if(d==='conf'){conNota();abre('conf')}
      else if(d==='ok'){conNota();estado('ok')}
      else if(d==='rx'){conNota();abreDoc('receta')}
      else if(d==='man'){base();modo('man')}
      else if(d==='borr'){base();dict.value=EJ;estado('cap');m.classList.add('nn-borr')}
      else if(d==='cons'){sinCons=!sinCons;refresca()}
      else if(d==='prim'){m.classList.toggle('nn-prim1')}
    });
    dxR.innerHTML=DX0;pintaVit();cuenta();ent();refresca();
  });

  /* Tira de controles de la maqueta: una sola, fuera del teléfono, gobierna los cuatro marcos a la vez (CALMA §7). */
  if(!marcos.length)return;
  var T=[['vacia','Vacía'],['ej','Llenar ejemplo'],['vit','Con signos'],['fuera','Signo fuera de rango'],['largos','Signos largos'],['gen','Redactando'],['err','Error al generar'],['ent','Entrevista'],['rev','Nota lista'],['conf','Confirmar'],
    ['ok','Nota guardada'],['rx','Receta'],['man','Modo manual'],['borr','Borrador restaurado'],['cons','Sin consultorio'],['prim','Primera consulta']];
  var tira=document.createElement('div');tira.className='nn-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  tira.innerHTML='<span>Maqueta</span>'+T.map(function(t){return '<button type="button" data-d="'+t[0]+'">'+t[1]+'</button>'}).join('')+'<span class="nn-tira-msg" role="status" aria-live="polite"></span>';
  var op=marcos[0].closest('.op');
  if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
  tira.addEventListener('click',function(e){var b=e.target.closest('button');if(b)apis.forEach(function(f){f(b.dataset.d)})});
})();
