(function(){
  var marcos=[].slice.call(document.querySelectorAll('.ZQ.marco'));if(!marcos.length)return;
  var KIND=marcos[0].dataset.doc;
  function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function svg(d,s,w){return '<svg aria-hidden="true" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'}
  var MASI=svg('<path d="M12 5v14M5 12h14"/>',16,2.4),
      I_CAP='<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',I_BOR='<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',I_SIN='<circle cx="12" cy="12" r="8.5"/><path d="m6 18 12-12"/>';
  function mi(d){return svg(d,20,1.8).replace('<svg','<svg class="ZQ-mi"')}
  /* Pasteles de avatar (CALMA §11): seis pares repartidos por paciente; únicos literales de color además de #fff */
  var PASTEL=[['#F1DCEC','#7A2E6B'],['#D7E8DC','#1F5A3A'],['#F6D8D1','#8A2F1F'],['#DCE6F7','#1F3F7A'],['#EBDCCB','#5A3A1A'],['#F5E3C8','#6B4A0E']];
  function past(n){var p=PASTEL[(parseInt(n,10)+5)%6];return 'background:'+p[0]+';color:'+p[1]}
  var BOTE=svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',20,1.8),
      PAL=svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>',20,2.2),FL=svg('<path d="m9 6 6 6-6 6"/>',14,2.4),
      SEL=svg('<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',16,2),MAS=svg('<path d="M6 12h.01M12 12h.01M18 12h.01"/>',22,3),EQ=svg('<path d="M6 6l12 12M18 6 6 18"/>',20,2);
  function norm(s){return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
  /* Caminos entre vistas de la MISMA página publicada (kit/INTEGRACION.md §3): desplazamiento hasta la vista del tipo y realce de su marco.
     Fuera de la página de Documentos (archivo suelto) la vista puede no existir: entonces no se mueve nada. */
  var VISTA={entrada:'1-entrada',receta:'2-receta',lab:'3-laboratorio',imagen:'4-imagenologia',suplementacion:'5-suplementacion',internamiento:'6-internamiento',escrito:'7-escrito',consentimiento:'8-consentimiento',honorarios:'9-honorarios'};
  function irA(k){var op=document.querySelector('.op[data-op="'+VISTA[k]+'"]');if(!op)return;var e=op.querySelector('.esc')||op;
    try{op.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}catch(x){op.scrollIntoView()}
    e.style.outline='3px solid var(--accion)';e.style.outlineOffset='4px';clearTimeout(e.__rz);e.__rz=setTimeout(function(){e.style.outline='';e.style.outlineOffset=''},1800)}
  var NOMBRE={receta:'Receta',lab:'Laboratorio',imagen:'Imagenología',suplementacion:'Suplementación',internamiento:'Internamiento',escrito:'Escrito médico',consentimiento:'Consentimiento',honorarios:'Honorarios / Cotización'};
  /* Catálogos de muestra (en la app: data/medicamentos.ts y lib/estudiosLab.ts) */
  var VIAS=['Oral','Tópica','Intramuscular','Intravenosa','Subcutánea','Sublingual','Oftálmica','Ótica','Nasal','Inhalatoria','Rectal','Transdérmica'];
  var CAT=[['Voltaren','Tabletas 50 mg','Diclofenaco sódico','1 tableta cada 8 hrs con alimentos por 5-7 días'],['Voltaren Retard','Tabletas 100 mg liberación prolongada','Diclofenaco sódico','1 tableta cada 24 hrs con alimentos'],
    ['Keral','Tabletas 25 mg','Dexketoprofeno trometamol','1 tableta cada 8 hrs con alimentos por 5-7 días'],['Keral','Solución inyectable 50 mg/2 ml','Dexketoprofeno trometamol','50 mg IM/IV cada 8-12 hrs, máximo 2 días'],
    ['Celebrex','Cápsulas 200 mg','Celecoxib','1 cápsula cada 12-24 hrs con alimentos'],['Arcoxia','Tabletas 90 mg','Etoricoxib','1 tableta cada 24 hrs con alimentos (máx 8 días en agudo)'],
    ['Tempra','Tabletas 500 mg','Paracetamol','1 tableta cada 8 hrs en caso de dolor'],['Flanax','Tabletas 550 mg','Naproxeno sódico','1 tableta cada 12 hrs con alimentos']];
  var LAB=['Biometría Hemática Completa (BHC)','Química Sanguínea 6 elementos','Química Sanguínea 27 elementos','Perfil Hepático','Perfil Renal','Perfil Lipídico Completo','Perfil Tiroideo Completo','Perfil Reumatológico','Panel de Coagulación','Velocidad de Sedimentación Globular (VSG)','Proteína C Reactiva','Ácido Úrico','Factor Reumatoide','Vitamina D (25-OH)','Glucosa','Hemoglobina Glucosilada (HbA1c)'];
  var TIMG=['Radiografía','Resonancia magnética simple','Resonancia magnética contrastada','Tomografía (TAC)','Ultrasonido','Densitometría ósea','Gammagrafía','Electromiografía (EMG)','Mielograma'];
  var CFG={
    receta:{etq:'receta',gen:'Generando receta...',ok:'Receta guardada · RX-2026-0042',bloque:'Medicamento',agregar:'Agregar medicamento',
      vacio:function(){return {nombre:'',pres:'',via:'Oral',pa:'',ind:'',sug:'',cat:false}},
      lleno:function(){return {dx:'Lumbago no especificado',lista:[{nombre:'Voltaren',pres:'Tabletas 50 mg',via:'Oral',pa:'Diclofenaco sódico',ind:'Tomar 1 tableta cada 8 hrs con alimentos por 7 días',sug:'1 tableta cada 8 hrs con alimentos por 5-7 días',cat:true},
        {nombre:'Tempra',pres:'Tabletas 500 mg',via:'Oral',pa:'Paracetamol',ind:'1 tableta cada 8 hrs en caso de dolor',sug:'',cat:false}],libre:'Reposo relativo por 3 días. Calor local 15 minutos, tres veces al día. Acudir a urgencias si hay pérdida de fuerza o de sensibilidad.'}},
      pl:[['Lumbalgia aguda','Actualizada el 12 de noviembre'],['Posquirúrgico de rodilla','Actualizada el 3 de noviembre'],['Esguince de tobillo','Actualizada el 21 de octubre']]},
    lab:{etq:'laboratorio',gen:'Generando solicitud de laboratorio...',ok:'Solicitud de laboratorio guardada · LAB-2026-0017',agregar:'Agregar',
      vacio:function(){return ''},
      lleno:function(){return {dx:'Gonalgia',lista:['Biometría Hemática','Glucosa','Creatinina','Velocidad de Sedimentación Globular (VSG)','Proteína C Reactiva'],libre:'Ayuno de 8 horas. Presentarse antes de las 9:00.'}},
      pl:[['Prequirúrgico','Actualizada el 10 de noviembre'],['Perfil reumatológico','Actualizada el 28 de octubre']]},
    imagen:{etq:'imagen',gen:'Generando solicitud de imagenología...',ok:'Solicitud de imagenología guardada · IMG-2026-0009',bloque:'Estudio',agregar:'Agregar estudio',
      vacio:function(){return {tipo:'',region:'',proy:'',ind:''}},
      lleno:function(){return {dx:'Lumbago no especificado',lista:[{tipo:'Radiografía',region:'Columna lumbar',proy:'AP y lateral',ind:'Descartar fractura vertebral'},{tipo:'Resonancia magnética simple',region:'Columna lumbosacra',proy:'',ind:'Valorar hernia discal L4-L5'}]}},
      pl:[['Columna lumbar','Actualizada el 14 de noviembre'],['Rodilla','Actualizada el 2 de noviembre']]}
  };

  /* ---------- Lo común a toda vista: capas y aviso ---------- */
  function base(m){
    var B={m:m,vp:m.dataset.vp};B.ancho=B.vp==='ih'||B.vp==='iv'||B.vp==='esc';
    B.$=function(s){return m.querySelector(s)};B.$$=function(s){return [].slice.call(m.querySelectorAll(s))};
    var capa=B.$('.ZQ-capa'),toast=B.$('.ZQ-toast'),tt=0,alCerrar=null;B.abierta=null;
    B.abrir=function(n,fin){B.$$('.ZQ-pan').forEach(function(p){p.classList.toggle('ZQ-act',p.dataset.capa===n)});
      capa.classList.add('ZQ-on');capa.classList.toggle('ZQ-sinvelo',n==='menu');B.abierta=n;alCerrar=fin||null;
      var p=B.$('.ZQ-pan.ZQ-act');if(p&&B.foco!==false)try{p.focus({preventScroll:true})}catch(e){}};
    B.cerrar=function(sinFin){B.$$('.ZQ-pan').forEach(function(p){p.classList.remove('ZQ-act')});capa.classList.remove('ZQ-on');B.abierta=null;var f=alCerrar;alCerrar=null;if(f&&!sinFin)f()};
    B.aviso=function(t,ms){toast.firstChild.textContent=t;toast.classList.add('ZQ-on');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('ZQ-on')},ms||2600)};
    B.$('.ZQ-velo').addEventListener('click',function(){B.cerrar()});
    B.$$('[data-abre-mas]').forEach(function(b){b.addEventListener('click',function(){B.abrir('mas')})});
    B.$$('.ZQ-ap-cab').forEach(function(b){b.addEventListener('click',function(){var a=b.closest('.ZQ-ap'),pl=a.classList.toggle('ZQ-pleg');b.setAttribute('aria-expanded',String(!pl))})});
    m.addEventListener('click',function(e){var a=e.target.closest('a[href="#"]');if(a)e.preventDefault();
      if(e.target.closest('.ZQ-x')||e.target.closest('.ZQ-cancelar'))B.cerrar()});
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&B.abierta){e.stopPropagation();B.cerrar()}});
    /* Rejilla de tipos: tablist con flechas, Inicio y Fin */
    B.$$('.ZQ-rej').forEach(function(r){r.addEventListener('keydown',function(e){var z=[].slice.call(r.querySelectorAll('.ZQ-z')),i=z.indexOf(document.activeElement),c=B.ancho?4:2,j=i;if(i<0)return;
      if(e.key==='ArrowRight')j=i+1;else if(e.key==='ArrowLeft')j=i-1;else if(e.key==='ArrowDown')j=i+c;else if(e.key==='ArrowUp')j=i-c;else if(e.key==='Home')j=0;else if(e.key==='End')j=z.length-1;else return;
      e.preventDefault();j=Math.max(0,Math.min(z.length-1,j));z.forEach(function(b,n){b.tabIndex=n===j?0:-1});z[j].focus()})});
    return B;
  }

  /* ---------- Vista de entrada: /documentos ---------- */
  function entrada(m){
    var B=base(m),$=B.$,inp=$('.ZQ-e-in'),res=$('.ZQ-res'),t=0;
    function pinta(q){var n=norm(q.trim()),f=[];for(var i=1;i<=25;i++){var nom='Paciente Prueba '+(i<10?'0':'')+i;if(norm(nom).indexOf(n)>=0)f.push(i)}
      f=f.slice(0,8);$('.ZQ-e-busc').hidden=true;res.hidden=false;
      res.innerHTML=f.length?f.map(function(i){var d=(i<10?'0':'')+i;return '<button type="button" class="ZQ-p ZQ-r ZQ-fila ZQ-e-op" data-n="'+d+'"><span class="ZQ-pav" style="'+past(d)+'">'+d+'</span><span class="ZQ-flex">Paciente Prueba '+d+'</span>'+FL+'</button>'}).join('')
        :'<button type="button" class="ZQ-p ZQ-r ZQ-fila ZQ-e-reg"><span class="ZQ-flex"><b>Registrar "'+h(q.trim())+'"</b><small>Crear nuevo paciente y continuar</small></span>'+FL+'</button>'}
    function busca(inmediato){var q=inp.value;clearTimeout(t);$('.ZQ-e-ayuda').hidden=q.trim().length>=2;
      if(q.trim().length<2){res.hidden=true;$('.ZQ-e-busc').hidden=true;return}
      if(inmediato)return pinta(q);res.hidden=true;$('.ZQ-e-busc').hidden=false;t=setTimeout(function(){pinta(q)},450)}
    function elegir(d,nom){$('.ZQ-e-num').textContent=d;$('.ZQ-e-num').style.cssText=past(d);$('.ZQ-e-nom').textContent=nom;B.$$('.ZQ-paso1').forEach(function(x){x.hidden=true});B.$$('.ZQ-paso2').forEach(function(x){x.hidden=false});inp.value='';res.hidden=true;$('.ZQ-cont').scrollTop=0}
    function limpiar(){B.$$('.ZQ-paso1').forEach(function(x){x.hidden=false});B.$$('.ZQ-paso2').forEach(function(x){x.hidden=true});$('.ZQ-e-ayuda').hidden=false}
    function alta(dup){$('.ZQ-al-nom').value=inp.value.trim()||'Paciente';$('.ZQ-al-ape').value=dup?'Prueba 07':'';$('.ZQ-al-dup').hidden=!dup;$('.ZQ-al-err').hidden=true;$('.ZQ-al-priv').setAttribute('aria-checked',dup?'true':'false');B.abrir('alta')}
    function crear(forzar){var e=$('.ZQ-al-err'),nom=$('.ZQ-al-nom').value.trim(),ape=$('.ZQ-al-ape').value.trim();
      if(!nom||!ape){e.textContent='Nombre y apellidos son requeridos.';e.hidden=false;return}
      if($('.ZQ-al-priv').getAttribute('aria-checked')!=='true'){e.textContent='Debes marcar el consentimiento del aviso de privacidad.';e.hidden=false;return}
      var b=$('.ZQ-al-ok');b.disabled=true;b.textContent='Registrando...';setTimeout(function(){b.disabled=false;b.textContent='Crear y continuar';B.cerrar();elegir('26',nom+' '+ape)},500)}
    inp.addEventListener('input',function(){busca(false)});
    m.addEventListener('click',function(e){var b;
      if((b=e.target.closest('.ZQ-e-op')))elegir(b.dataset.n,'Paciente Prueba '+b.dataset.n);
      else if(e.target.closest('.ZQ-e-reg'))alta(false);
      else if(e.target.closest('.ZQ-e-x'))limpiar();
      else if((b=e.target.closest('.ZQ-al-priv'))){if(!e.target.closest('a'))b.setAttribute('aria-checked',b.getAttribute('aria-checked')==='true'?'false':'true')}
      else if(e.target.closest('.ZQ-al-ok'))crear();
      else if(e.target.closest('.ZQ-al-mismo')){B.cerrar();elegir('07','Paciente Prueba 07')}
      else if(e.target.closest('.ZQ-al-otro')){$('.ZQ-al-dup').hidden=true;crear(true)}
      else if(e.target.closest('.ZQ-al-dupno'))$('.ZQ-al-dup').hidden=true;
      else if((b=e.target.closest('.ZQ-paso2 .ZQ-z')))irA(b.dataset.t)});
    return function(c){B.foco=false;B.cerrar(true);limpiar();inp.value='';busca(true);
      if(c==='res'){inp.value='prueba 1';busca(true)}
      else if(c==='nada'){inp.value='Paciente Nuevo';busca(true)}
      else if(c==='buscando'){inp.value='pru';$('.ZQ-e-ayuda').hidden=true;$('.ZQ-e-busc').hidden=false}
      else if(c==='alta'){inp.value='Paciente Nuevo';busca(true);alta(false)}
      else if(c==='dup'){inp.value='Paciente';busca(true);alta(true)}
      else if(c==='rejilla')elegir('01','Paciente Prueba 01')};
  }

  /* ---------- Formularios: Receta, Laboratorio, Imagenología ---------- */
  function formulario(m){
    var B=base(m),$=B.$,$$=B.$$,C=CFG[KIND],lst=$('.ZQ-lst');
    var S={lista:[C.vacio()],urg:false,intentado:false,pl:C.pl.map(function(p){return {n:p[0],f:p[1]}}),sel:'',previo:null,noG:false,exp:-1,ren:-1};
    var iP=$('.ZQ-i-paciente'),iD=$('.ZQ-i-dx'),iL=$('.ZQ-i-libre');
    function alto(t){t.style.height='auto';t.style.height=Math.max(t.scrollHeight,0)+'px'}
    /* --- pintar la lista repetible --- */
    function fila(et,k,i,val,ph,o){o=o||{};var req=o.req?'<i aria-hidden="true"> *</i>':'',mala=o.mala?' ZQ-mala':'';
      var cuerpo=o.sel?'<select class="ZQ-in" data-k="'+k+'" aria-label="'+et+'">'+VIAS.map(function(v){return '<option'+(v===val?' selected':'')+'>'+v+'</option>'}).join('')+'</select><span class="ZQ-sel-i">'+SEL+'</span>'
        :o.ta?'<textarea class="ZQ-ta" rows="1" data-k="'+k+'" aria-label="'+et+'" placeholder="'+h(ph)+'">'+h(val)+'</textarea>'
        :'<input type="text" class="ZQ-in'+(o.fuerte?' ZQ-fuerte':'')+'" data-k="'+k+'" aria-label="'+et+'" autocomplete="off" placeholder="'+h(ph)+'" value="'+h(val)+'"'+(o.combo?' role="combobox" aria-autocomplete="list" aria-expanded="false"':'')+(o.mala?' aria-invalid="true"':'')+'>';
      return '<div class="ZQ-r ZQ-f'+(o.ta?' ZQ-lg':'')+(o.pista?' ZQ-conp':'')+mala+'" data-f="'+k+'"><span class="ZQ-et">'+et+req+'</span>'+(o.pista?'<span class="ZQ-pista">'+o.pista+'</span>':'')+cuerpo
        +(o.combo?'<div class="ZQ-sug" role="listbox" hidden></div>':'')+(o.nota?'<p class="ZQ-nota">'+h(o.nota)+'</p>':'')+(o.err?'<p class="ZQ-err">'+o.err+'</p>':'')+'</div>'}
    function cab(i,sub,nombre){return '<div class="ZQ-bh"><span class="ZQ-etq ZQ-e-ton">'+C.bloque+' '+(i+1)+'</span><small class="ZQ-flex">'+h(sub||'')+'</small><button type="button" class="ZQ-p ZQ-ib ZQ-b-quitar" aria-label="Eliminar '+h(nombre||(C.bloque.toLowerCase()+' '+(i+1)))+'"'+(S.lista.length===1?' disabled':'')+'>'+BOTE+'</button></div>'}
    function estadoImg(e){var t=e.tipo.trim(),r=e.region.trim();return !t&&!r?'vacio':t&&r?'completo':t?'faltaRegion':'faltaTipo'}
    function pinta(){var V=S.intentado?faltas():{campos:{}},ult=S.lista.length-1,add='<button type="button" class="ZQ-p ZQ-r ZQ-ar ZQ-b-agregar">'+MASI+C.agregar+'</button>';
      if(KIND==='receta')lst.innerHTML=S.lista.map(function(x,i){return '<div class="ZQ-s ZQ-bl" data-i="'+i+'">'+cab(i,'',x.nombre.trim())
        +fila('Nombre comercial','nombre',i,x.nombre,'Ej: Voltaren',{req:1,combo:1,fuerte:1,mala:V.campos['nombre'+i]})+fila('Presentación','pres',i,x.pres,'Tabletas 50 mg')
        +fila('Vía de administración','via',i,x.via,'',{sel:1})+fila('Principio activo','pa',i,x.pa,'Diclofenaco sódico',{req:1,mala:V.campos['pa'+i],pista:x.cat?'Del catálogo · editable':''})
        +fila('Indicaciones','ind',i,x.ind,'Tomar 1 tableta cada 8 hrs con alimentos por 7 días',{ta:1,nota:x.sug?'Sugerencia del catálogo: '+x.sug:''})+add+'</div>'}).join('');
      else if(KIND==='imagen')lst.innerHTML=S.lista.map(function(x,i){var e=estadoImg(x),roto=S.intentado&&(e==='faltaRegion'||e==='faltaTipo');return '<div class="ZQ-s ZQ-bl" data-i="'+i+'">'+cab(i,x.region.trim())
        +fila('Tipo de estudio','tipo',i,x.tipo,'Seleccionar o escribir…',{req:1,combo:1,mala:(roto&&e==='faltaTipo')||V.campos['tipo'+i],err:roto&&e==='faltaTipo'?'Falta el tipo. Complétalo o borra el estudio.':''})
        +fila('Región anatómica','region',i,x.region,'Ej: Columna lumbar, rodilla der.',{req:1,mala:(roto&&e==='faltaRegion')||V.campos['region'+i],err:roto&&e==='faltaRegion'?'Falta la región. Complétala o borra el estudio.':''})
        +fila('Proyecciones','proy',i,x.proy,'AP, lateral…')+fila('Indicación clínica específica','ind',i,x.ind,'Ej: Descartar fractura vertebral')+(i===ult?add:'')+'</div>'}).join('');
      else{var num=S.lista.length>=2;lst.innerHTML=(S.lista.length?S.lista.map(function(x,i){return '<div class="ZQ-r ZQ-lr'+(V.campos.estudios?' ZQ-mala':'')+'" data-i="'+i+'">'+(num?'<span class="ZQ-n">'+(i+1)+'.</span>':'')
        +'<div class="ZQ-cb"><textarea rows="1" class="ZQ-in" data-k="est" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="Estudio '+(i+1)+'" autocomplete="off" placeholder="Nombre del estudio"'+(V.campos.estudios?' aria-invalid="true"':'')+'>'+h(x)+'</textarea><div class="ZQ-sug" role="listbox" hidden></div></div>'
        +'<button type="button" class="ZQ-p ZQ-ib ZQ-b-quitar" aria-label="Eliminar '+h(x.trim()||('estudio '+(i+1)))+'"'+(S.lista.length===1?' disabled':'')+'>'+BOTE+'</button></div>'}).join(''):'<p class="ZQ-vacio">Sin estudios. Usa «Agregar».</p>')+add;
        $$('.ZQ-ck').forEach(function(b){b.setAttribute('aria-pressed',String(S.lista.indexOf(b.dataset.e)>=0))})}
      $$('.ZQ-lst textarea').forEach(alto);if(iL)alto(iL);
      var u=$('.ZQ-urg');if(u)u.hidden=!S.urg;var sw=$('.ZQ-b-urg');if(sw)sw.setAttribute('aria-checked',String(S.urg));
      plFila();barra()}
    /* --- predicados de hoy: vacío, faltantes --- */
    function conTexto(x){return KIND==='lab'?!!x.trim():KIND==='receta'?!!(x.nombre.trim()||x.pres.trim()||x.pa.trim()||x.ind.trim()):!!(x.tipo.trim()||x.region.trim()||x.proy.trim()||x.ind.trim())}
    function sinContenido(){return !S.lista.some(conTexto)&&!(iL&&iL.value.trim())&&!S.urg}
    function vacio(){return sinContenido()&&iP.value.trim()==='Paciente Prueba 01'&&!iD.value.trim()}
    function faltas(){var f=[],campos={},msg='';
      if(!iP.value.trim()){f.push(['paciente','Paciente']);campos.paciente=1}
      if(KIND==='receta'){var ok=S.lista.some(function(x){return x.nombre.trim()&&x.pa.trim()}),r=Math.max(0,S.lista.findIndex(conTexto));
        if(!ok){if(!S.lista[r].nombre.trim()){f.push(['nombre'+r,'Nombre comercial']);campos['nombre'+r]=1}if(!S.lista[r].pa.trim()){f.push(['pa'+r,'Principio activo']);campos['pa'+r]=1}}}
      else if(KIND==='lab'){if(S.lista.every(function(x){return !x.trim()})){f.push(['estudios','Estudios']);campos.estudios=1}}
      else{var e=S.lista.map(estadoImg),p=e.findIndex(function(s){return s==='faltaRegion'||s==='faltaTipo'});
        if(p>=0)return {f:[[e[p]==='faltaRegion'?'region'+p:'tipo'+p,'']],campos:campos,msg:'El estudio '+(p+1)+' tiene '+(e[p]==='faltaRegion'?'tipo sin región':'región sin tipo')+': complétalo o bórralo.'};
        if(e.indexOf('completo')<0){f.push(['tipo0','un estudio con tipo y región']);campos.tipo0=1;campos.region0=1}}
      return {f:f,campos:campos,msg:msg}}
    function irA(c){var el=c==='paciente'?iP:c==='estudios'?lst.querySelector('textarea'):lst.querySelector('[data-i="'+c.replace(/\D/g,'')+'"] [data-k="'+c.replace(/\d/g,'')+'"]');
      if(el){el.scrollIntoView({block:'center'});try{el.focus({preventScroll:true})}catch(e){}}}
    function barra(){var p=$('.ZQ-av-falta'),V=S.intentado?faltas():null;iP.closest('.ZQ-f').classList.toggle('ZQ-mala',!!(V&&V.campos.paciente));
      if(!V||!V.f.length){p.hidden=true}else{p.hidden=false;p.innerHTML=V.msg?h(V.msg):(V.f.length===1?'Falta 1 campo':'Faltan '+V.f.length+' campos')+': '+V.f.map(function(x){return '<button type="button" data-ir="'+x[0]+'">'+x[1]+'</button>'}).join(' · ')}
      $('.ZQ-b-gpl').setAttribute('aria-disabled',String(sinContenido()))}
    function imprimir(){var V=faltas();if(V.f.length){S.intentado=true;pinta();irA(V.f[0][0]);return}
      S.intentado=false;pinta();$('.ZQ-av-error').hidden=true;var b=$('.ZQ-b-imp');b.disabled=true;b.innerHTML='<span class="ZQ-giro" aria-hidden="true"></span>Generando PDF…';B.aviso(C.gen,900);
      setTimeout(function(){b.disabled=false;b.textContent='Imprimir';B.aviso(C.ok);generado(false)},950)}
    /* --- modal posterior --- */
    function paso(p){S.paso=p;$$('[data-capa="gen"] [data-paso]').forEach(function(x){x.hidden=x.dataset.paso.split(' ').indexOf(p)<0});
      var c=$('.ZQ-gn-correo'),ct=$('.ZQ-gn-ct'),d=$('.ZQ-gn-dest');c.disabled=S.noG||p==='enviando'||p==='enviado';
      ct.textContent=p==='enviando'?'Enviando…':p==='enviado'?'Enviado':'Enviar por correo';
      d.hidden=p!=='listo';d.textContent=S.noG?'No quedó en el expediente':'Se enviará a paciente01@semilla.spinus.test';
      $('.ZQ-gn-otro').hidden=p!=='listo'||S.noG}
    function generado(noG){S.noG=noG;$('.ZQ-gn-ok').hidden=noG;$('.ZQ-gn-no').hidden=!noG;$('.ZQ-gn-i1').hidden=noG;$('.ZQ-gn-i2').hidden=!noG;$('.ZQ-gn-in').value='';$('.ZQ-gn-enviar').disabled=true;$('.ZQ-gn-ofr').hidden=true;$('.ZQ-gn-fok').hidden=true;paso('listo');
      /* Cerrar el modal es el final del documento: el formulario se desmonta y se vuelve a la rejilla de tipos */
      B.abrir('gen',function(){estado('vacio');irA('entrada')})}
    function enviar(a){paso('enviando');setTimeout(function(){paso('enviado');$('.ZQ-gn-env').innerHTML='Enviado a '+h(a)+' con el PDF adjunto. Si no aparece, pídele que revise su carpeta de <b>spam o correo no deseado</b>.';
      var otra=a!=='paciente01@semilla.spinus.test';$('.ZQ-gn-ofr').hidden=!otra;$('.ZQ-gn-ofr-t').innerHTML='¿Guardas <b>'+h(a)+'</b> en la ficha del paciente para la próxima vez?'},600)}
    /* --- plantillas --- */
    function plFila(){$('.ZQ-b-pl').classList.toggle('ZQ-sv',!!S.plErr||!S.pl.length);var v=$('.ZQ-b-pl .ZQ-nav-v'),s=S.pl.filter(function(p){return p.n===S.sel})[0];v.textContent=S.plErr?'No se pudieron cargar tus plantillas.':!S.pl.length?'Sin plantillas de '+C.etq:s?s.n:'— Sin plantilla —'}
    function plHoja(){var c=$('.ZQ-pl-ops'),n=S.pl.length;
      if(S.plErr)c.innerHTML='<p class="ZQ-hj-sub">No se pudieron cargar tus plantillas.</p><button type="button" class="ZQ-p ZQ-tonal ZQ-pl-re" style="margin:2px 0 8px">Reintentar</button>';
      else if(!n)c.innerHTML='<p class="ZQ-ok-t" style="font-size:17px;line-height:22px;padding-top:0">Sin plantillas de '+C.etq+'</p><p class="ZQ-hj-sub" style="padding-top:4px">Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.</p>';
      else c.innerHTML='<button type="button" class="ZQ-p ZQ-mr ZQ-pl-op" data-v="__vaciar"'+(sinContenido()?' disabled':'')+'>'+mi(I_BOR)+'<span class="ZQ-mr-t">Vaciar formulario</span></button>'
        +[{n:''}].concat(S.pl).map(function(p){return '<button type="button" class="ZQ-p ZQ-mr ZQ-pl-op" data-v="'+h(p.n)+'" role="option" aria-selected="'+(p.n===S.sel)+'">'+mi(p.n?I_CAP:I_SIN)+'<span class="ZQ-mr-t">'+(p.n?h(p.n):'— Sin plantilla —')+'</span>'+(p.n===S.sel?PAL.replace('<svg','<svg class="ZQ-pal"'):'')+'</button>'}).join('')
        +'<p class="ZQ-linea" style="padding:12px 0 4px;box-shadow:inset 0 1px 0 var(--linea)"><span class="ZQ-flex ZQ-num">'+(n>=10?'10 de 10 · el máximo':n+' de 10 guardadas')+'</span><button type="button" class="ZQ-p ZQ-quieto ZQ-ch ZQ-pl-ges">Gestionar plantillas</button></p>';
      B.abrir('plantillas')}
    function foto(){return JSON.stringify({l:S.lista,u:S.urg,t:iL?iL.value:'',s:S.sel})}
    function repone(j){var o=JSON.parse(j);S.lista=o.l;S.urg=o.u;if(iL)iL.value=o.t;S.sel=o.s}
    function aplicar(v){S.previo=foto();var a=$('.ZQ-pl-aviso');
      if(v==='__vaciar'||v===''){if(v==='__vaciar'){S.lista=[C.vacio()];S.urg=false;if(iL)iL.value='';a.firstChild.textContent='Se vació el formulario. Los datos del paciente no cambiaron.';a.hidden=false}else a.hidden=true;S.sel=''}
      else{var L=C.lleno();S.lista=L.lista;if(iL)iL.value=L.libre||'';S.sel=v;a.firstChild.textContent='Se aplicó «'+v+'». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.';a.hidden=false}
      S.intentado=false;B.cerrar();pinta()}
    function gpl(){if(sinContenido()){B.aviso('Llena algún campo de los que la plantilla guarda para poder guardarla.',3600);return}
      if(S.pl.length>=10){B.abrir('tope');return}var i=$('.ZQ-gp-in');i.value='';gpVal();B.abrir('guardar');if(B.foco!==false)setTimeout(function(){i.focus()},60)}
    function gpVal(){var i=$('.ZQ-gp-in'),v=i.value.trim(),dup=S.pl.some(function(p){return norm(p.n)===norm(v)});$('.ZQ-gp-dup').hidden=!dup||!v;$('.ZQ-gp-ok').disabled=!v||dup;
      var n=$('.ZQ-gp-n');n.hidden=i.value.length<30;n.textContent=i.value.length+'/40'}
    function gpOk(){var b=$('.ZQ-gp-ok'),v=$('.ZQ-gp-in').value.trim();if(b.disabled)return;b.disabled=true;b.textContent='Guardando…';
      setTimeout(function(){b.textContent='Guardar';S.pl.push({n:v,f:'Actualizada el 19 de noviembre'});S.sel=v;B.cerrar();plFila();B.aviso('Plantilla «'+v+'» guardada')},450)}
    function gestionar(){var n=S.pl.length;$('.ZQ-ges-n').textContent=n+' / 10';$('.ZQ-ges-vacio').hidden=n>0;$('.ZQ-ges-info').hidden=!(sinContenido()&&n>0);
      $('.ZQ-ges-l').innerHTML=S.pl.map(function(p,i){
        if(S.ren===i)return '<li><div class="ZQ-pl-e"><input type="text" class="ZQ-cin ZQ-ren-in" maxlength="40" value="'+h(p.n)+'" aria-label="Nuevo nombre de '+h(p.n)+'"><button type="button" class="ZQ-p ZQ-ib ZQ-ren-no" aria-label="Cancelar">'+EQ+'</button><button type="button" class="ZQ-p ZQ-prim ZQ-ren-ok">Guardar</button></div><p class="ZQ-hj-sub ZQ-mal ZQ-ren-dup" hidden>Ya tienes una con ese nombre.</p></li>';
        return '<li data-i="'+i+'"><div class="ZQ-pl"><span class="ZQ-flex"><b>'+h(p.n)+'</b><small>'+p.f+'</small></span><button type="button" class="ZQ-p ZQ-ib ZQ-pl-mas" aria-label="Acciones de '+h(p.n)+'" aria-expanded="'+(S.exp===i)+'">'+MAS+'</button></div>'
          +(S.exp===i?'<div class="ZQ-pl-a"> <button type="button" class="ZQ-p ZQ-quieto ZQ-ch ZQ-a-ren" aria-label="Renombrar '+h(p.n)+'">Renombrar</button><button type="button" class="ZQ-p ZQ-quieto ZQ-ch ZQ-a-sob" aria-label="Sobrescribir '+h(p.n)+' con el formulario actual"'+(sinContenido()?' disabled':'')+'>Sobrescribir</button><button type="button" class="ZQ-p ZQ-mal-b ZQ-ch ZQ-a-eli" aria-label="Eliminar '+h(p.n)+'">Eliminar</button></div>':'')+'</li>'}).join('');
      if(B.abierta!=='gestionar')B.abrir('gestionar');var r=$('.ZQ-ren-in');if(r&&B.foco!==false)r.focus()}
    function renOk(){var i=$('.ZQ-ren-in'),v=i.value.trim(),dup=S.pl.some(function(p,n){return n!==S.ren&&norm(p.n)===norm(v)});if(!v)return;if(dup){$('.ZQ-ren-dup').hidden=false;return}
      if(S.sel===S.pl[S.ren].n)S.sel=v;S.pl[S.ren].n=v;S.ren=-1;gestionar();plFila()}
    function confPl(acc,i){var p=S.pl[i];S.conf={acc:acc,i:i};$('.ZQ-cp-t').textContent=(acc==='eliminar'?'¿Eliminar':'¿Sobrescribir')+' «'+p.n+'»?';
      $('.ZQ-cp-p').textContent=acc==='eliminar'?'Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.':'Se reemplaza el contenido guardado de «'+p.n+'» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.';
      var b=$('.ZQ-cp-ok');b.textContent=acc==='eliminar'?'Eliminar':'Sobrescribir';b.className='ZQ-p ZQ-cp-ok '+(acc==='eliminar'?'ZQ-mal-b':'ZQ-prim');$('.ZQ-cp-i1').hidden=acc==='eliminar';$('.ZQ-cp-i2').hidden=acc!=='eliminar';B.abrir('conf-pl')}
    /* --- combo escribible --- */
    function sugiere(inp){var caja=inp.parentNode.querySelector('.ZQ-sug'),k=inp.dataset.k,q=norm(inp.value.trim()),ops,min=k==='tipo'?0:2,pie=k==='tipo'?'Ninguno encaja: escribe el tipo y se usa tal cual.':'Ninguno encaja: escribe el nombre y se usa tal cual.';
      if(q.length<min){caja.hidden=true;inp.setAttribute('aria-expanded','false');return}
      if(k==='nombre')ops=CAT.filter(function(c){return norm(c.join(' · ')).indexOf(q)>=0}).map(function(c){return '<button type="button" role="option" data-c="'+CAT.indexOf(c)+'">'+h(c[0])+'<small>'+h(c[1])+' · '+h(c[2])+'</small></button>'});
      else ops=(k==='tipo'?TIMG:LAB).filter(function(c){return norm(c).indexOf(q)>=0&&norm(c)!==q}).slice(0,k==='tipo'?9:6).map(function(c){return '<button type="button" role="option" data-v="'+h(c)+'">'+h(c)+'</button>'});
      caja.innerHTML=ops.join('')+'<p>'+pie+'</p>';caja.hidden=false;inp.setAttribute('aria-expanded','true')}
    function cierraSug(){$$('.ZQ-sug').forEach(function(c){c.hidden=true})}
    /* --- eventos --- */
    lst.addEventListener('input',function(e){var el=e.target,k=el.dataset.k,bl=el.closest('[data-i]');if(!k||!bl)return;var i=+bl.dataset.i;
      if(KIND==='lab')S.lista[i]=el.value;else{S.lista[i][k]=el.value;if(k==='pa'&&S.lista[i].cat){S.lista[i].cat=false;var p=bl.querySelector('[data-f="pa"] .ZQ-pista');if(p)p.remove()}
        if(k==='region'){bl.querySelector('.ZQ-bh small').textContent=el.value.trim()}}
      if(el.tagName==='TEXTAREA')alto(el);if(el.getAttribute('role')==='combobox')sugiere(el);
      if(KIND==='lab')$$('.ZQ-ck').forEach(function(b){b.setAttribute('aria-pressed',String(S.lista.indexOf(b.dataset.e)>=0))});
      if(S.intentado){var V=faltas();$$('.ZQ-lst .ZQ-mala').forEach(function(x){var f=x.dataset.f,ii=x.closest('[data-i]').dataset.i;if(KIND==='lab'?!V.campos.estudios:(KIND==='receta'&&!V.campos[f+ii]))x.classList.remove('ZQ-mala')})}
      barra()});
    lst.addEventListener('change',function(e){var el=e.target,bl=el.closest('[data-i]');if(el.tagName==='SELECT'&&bl)S.lista[+bl.dataset.i][el.dataset.k]=el.value});
    lst.addEventListener('focusin',function(e){if(e.target.getAttribute('role')==='combobox'&&e.target.dataset.k==='tipo'&&!e.target.value)sugiere(e.target)});
    lst.addEventListener('focusout',function(){setTimeout(function(){if(!lst.contains(document.activeElement)||!document.activeElement.closest('.ZQ-sug'))cierraSug()},120)});
    lst.addEventListener('keydown',function(e){if(e.key==='Escape'){cierraSug()}if(e.key==='Enter'&&e.target.dataset.k==='est')e.preventDefault()});
    [iP,iD,iL].forEach(function(x){if(x)x.addEventListener('input',function(){if(x.tagName==='TEXTAREA')alto(x);barra()})});
    m.addEventListener('click',function(e){var b,t=e.target;
      if((b=t.closest('.ZQ-sug button'))){var bl=b.closest('[data-i]'),i=+bl.dataset.i;
        if(b.dataset.c!=null){var c=CAT[+b.dataset.c];S.lista[i].nombre=c[0];S.lista[i].pres=c[1];S.lista[i].pa=c[2];S.lista[i].sug=c[3];S.lista[i].cat=true}
        else if(KIND==='lab')S.lista[i]=b.dataset.v;else S.lista[i].tipo=b.dataset.v;pinta()}
      else if((b=t.closest('.ZQ-b-quitar'))){S.lista.splice(+b.closest('[data-i]').dataset.i,1);pinta()}
      else if((b=t.closest('.ZQ-b-agregar'))){var bq=b.closest('.ZQ-bl'),pos=KIND==='receta'&&bq?+bq.dataset.i+1:S.lista.length;S.lista.splice(pos,0,C.vacio());pinta();var u=lst.querySelectorAll('[data-i]');u=u[pos];var f=u&&u.querySelector('input,textarea');if(f&&B.foco!==false)f.focus()}
      else if((b=t.closest('.ZQ-ck'))){var n=S.lista.indexOf(b.dataset.e);if(n>=0)S.lista.splice(n,1);else{S.lista=S.lista.filter(function(x){return x.trim()});S.lista.push(b.dataset.e)}pinta()}
      else if(t.closest('.ZQ-b-urg')){S.urg=!S.urg;pinta()}
      else if(t.closest('.ZQ-b-imp'))imprimir();
      else if((b=t.closest('[data-ir]')))irA(b.dataset.ir);
      else if(t.closest('.ZQ-b-gpl')||t.closest('.ZQ-m-gpl')){B.cerrar(true);gpl()}
      else if(t.closest('.ZQ-b-menu')){$('.ZQ-m-gpl').setAttribute('aria-disabled',String(sinContenido()));$('.ZQ-m-vac').setAttribute('aria-disabled',String(sinContenido()));B.abrir('menu')}
      else if(t.closest('.ZQ-m-ges')||t.closest('.ZQ-pl-ges')||t.closest('.ZQ-tope-ok')){S.exp=-1;S.ren=-1;B.cerrar(true);gestionar()}
      else if(t.closest('.ZQ-m-vac')){B.cerrar(true);if(!sinContenido())aplicar('__vaciar')}
      else if(t.closest('.ZQ-b-pl'))plHoja();
      else if((b=t.closest('.ZQ-pl-op')))aplicar(b.dataset.v);
      else if(t.closest('.ZQ-pl-re')){S.plErr=false;plFila();plHoja()}
      else if(t.closest('.ZQ-b-deshacer')){if(S.previo)repone(S.previo);S.previo=null;$('.ZQ-pl-aviso').hidden=true;pinta()}
      else if(t.closest('.ZQ-gp-ok'))gpOk();
      else if((b=t.closest('.ZQ-pl-mas'))){var i2=+b.closest('li').dataset.i;S.exp=S.exp===i2?-1:i2;gestionar()}
      else if(t.closest('.ZQ-a-ren')){S.ren=S.exp;S.exp=-1;gestionar()}
      else if(t.closest('.ZQ-ren-no')){S.ren=-1;gestionar()}
      else if(t.closest('.ZQ-ren-ok'))renOk();
      else if(t.closest('.ZQ-a-sob'))confPl('sobrescribir',S.exp);
      else if(t.closest('.ZQ-a-eli'))confPl('eliminar',S.exp);
      else if(t.closest('.ZQ-cp-no')){S.exp=-1;B.cerrar(true);gestionar()}
      else if(t.closest('.ZQ-cp-ok')){var p=S.pl[S.conf.i];if(S.conf.acc==='eliminar'){S.pl.splice(S.conf.i,1);if(S.sel===p.n)S.sel=''}else p.f='Actualizada el 19 de noviembre';S.exp=-1;B.cerrar(true);gestionar();plFila()}
      else if(t.closest('.ZQ-b-tipo'))B.abrir('tipo');
      else if((b=t.closest('[data-capa="tipo"] .ZQ-z'))){if(b.dataset.t===KIND){B.cerrar();return}S.dest=b.dataset.t;
        if(vacio()){B.cerrar();irA(S.dest)}
        else{$('.ZQ-ct-t').textContent='¿Cambiar a '+NOMBRE[S.dest]+'?';$('.ZQ-ct-ok').textContent='Cambiar';$('.ZQ-ct-ok').setAttribute('aria-label','Cambiar a '+NOMBRE[S.dest]);B.abrir('conf-tipo')}}
      else if(t.closest('.ZQ-ct-ok')){B.cerrar();irA(S.dest)}
      else if(t.closest('.ZQ-volver'))irA('entrada');
      else if(t.closest('.ZQ-gn-correo'))enviar('paciente01@semilla.spinus.test');
      else if(t.closest('.ZQ-gn-otro')){paso('pidiendo');if(B.foco!==false)$('.ZQ-gn-in').focus()}
      else if(t.closest('.ZQ-gn-cancel'))paso('listo');
      else if(t.closest('.ZQ-gn-enviar')){$('.ZQ-dir').textContent=$('.ZQ-gn-in').value.trim();paso('confirmando')}
      else if(t.closest('.ZQ-gn-corr'))paso('pidiendo');
      else if(t.closest('.ZQ-gn-si'))enviar($('.ZQ-gn-in').value.trim());
      else if(t.closest('.ZQ-gn-fic')){$('.ZQ-gn-ofr').hidden=true;$('.ZQ-gn-fok').hidden=false}
      else if(t.closest('.ZQ-gn-nog'))$('.ZQ-gn-ofr').hidden=true;
});
    /* «Descargar» y «Visualizar» entregan el PDF al navegador; «Ir a mi perfil» navega a /perfil (otra página): sin efecto dentro de la maqueta. */
    m.addEventListener('input',function(e){if(e.target.classList.contains('ZQ-gp-in'))gpVal();if(e.target.classList.contains('ZQ-gn-in'))$('.ZQ-gn-enviar').disabled=!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.target.value.trim());
      if(e.target.classList.contains('ZQ-ren-in'))$('.ZQ-ren-dup').hidden=true});
    m.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.classList.contains('ZQ-gp-in'))gpOk();if(e.target.classList.contains('ZQ-ren-in')){if(e.key==='Enter')renOk();if(e.key==='Escape'){e.stopPropagation();S.ren=-1;gestionar()}}},true);
    /* --- estados de la maqueta (los pulsa la tira) --- */
    function estado(c){B.cerrar(true);S.intentado=false;S.urg=false;S.sel='';S.previo=null;S.plErr=false;S.exp=-1;S.ren=-1;S.pl=C.pl.map(function(p){return {n:p[0],f:p[1]}});S.lista=[C.vacio()];
      iP.value='Paciente Prueba 01';iD.value='';if(iL)iL.value='';$('.ZQ-pl-aviso').hidden=true;$('.ZQ-av-perfil').hidden=true;$('.ZQ-av-error').hidden=true;var b=$('.ZQ-b-imp');b.disabled=false;b.textContent='Imprimir';
      function llena(){var L=C.lleno();S.lista=L.lista;iD.value=L.dx;if(iL)iL.value=L.libre||'';if(KIND==='imagen')S.urg=true}
      if(c==='lleno')llena();
      else if(c==='valida'){if(KIND==='receta')S.lista=[{nombre:'Voltaren',pres:'',via:'Oral',pa:'',ind:'',sug:'',cat:false}];if(KIND==='imagen')S.lista=[{tipo:'Radiografía',region:'',proy:'',ind:''}];S.intentado=true}
      else if(c==='valida2'){iP.value='';S.intentado=true}
      else if(c==='aplicada'){S.sel=C.pl[0][0];llena();iD.value='';S.urg=false;var a=$('.ZQ-pl-aviso');a.firstChild.textContent='Se aplicó «'+S.sel+'». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.';a.hidden=false;S.previo=JSON.stringify({l:[C.vacio()],u:false,t:'',s:''})}
      else if(c==='sinpl')S.pl=[];
      else if(c==='plerr')S.plErr=true;
      else if(c==='perfil')$('.ZQ-av-perfil').hidden=false;
      else if(c==='cargando'){b.disabled=true;b.innerHTML='<span class="ZQ-giro" aria-hidden="true"></span>Cargando tu perfil…'}
      else if(c==='generando'){llena();b.disabled=true;b.innerHTML='<span class="ZQ-giro" aria-hidden="true"></span>Generando PDF…'}
      else if(c==='error'){llena();var er=$('.ZQ-av-error');er.textContent='No se pudo guardar '+(KIND==='receta'?'la receta':'la solicitud')+', así que no se generó el PDF. Intenta de nuevo.';er.hidden=false}
      pinta();$('.ZQ-cont').scrollTop=0;
      if(c==='elegir'){llena();pinta();plHoja()}
      else if(c==='elegir0'){S.pl=[];pinta();plHoja()}
      else if(c==='guardar'){llena();pinta();gpl();$('.ZQ-gp-in').value=C.pl[0][0];gpVal()}
      else if(c==='gestionar'){llena();pinta();S.exp=0;gestionar()}
      else if(c==='renombrar'){llena();pinta();S.ren=1;gestionar()}
      else if(c==='sobrescribir'){llena();pinta();S.exp=0;confPl('sobrescribir',0)}
      else if(c==='tope'){llena();pinta();B.abrir('tope')}
      else if(c==='tipo'){B.abrir('tipo')}
      else if(c==='conftipo'){llena();pinta();S.dest=KIND==='lab'?'receta':'lab';$('.ZQ-ct-t').textContent='¿Cambiar a '+NOMBRE[S.dest]+'?';$('.ZQ-ct-ok').textContent='Cambiar';$('.ZQ-ct-ok').setAttribute('aria-label','Cambiar a '+NOMBRE[S.dest]);B.abrir('conf-tipo')}
      else if(c==='menu'){llena();pinta();$('.ZQ-m-gpl').setAttribute('aria-disabled','false');$('.ZQ-m-vac').setAttribute('aria-disabled','false');B.abrir('menu')}
      else if(c==='gen'){llena();pinta();generado(false)}
      else if(c==='genno'){llena();pinta();generado(true)}
      else if(c==='otro'){llena();pinta();generado(false);paso('pidiendo');$('.ZQ-gn-in').value='familiar01@semilla.spinus.test';$('.ZQ-gn-enviar').disabled=false}
      else if(c==='confcorreo'){llena();pinta();generado(false);$('.ZQ-dir').textContent='familiar01@semilla.spinus.test';paso('confirmando')}
      else if(c==='enviado'){llena();pinta();generado(false);paso('enviado');$('.ZQ-gn-env').innerHTML='Enviado a familiar01@semilla.spinus.test con el PDF adjunto. Si no aparece, pídele que revise su carpeta de <b>spam o correo no deseado</b>.';$('.ZQ-gn-ofr').hidden=false;$('.ZQ-gn-ofr-t').innerHTML='¿Guardas <b>familiar01@semilla.spinus.test</b> en la ficha del paciente para la próxima vez?'}}
    pinta();
    return function(c){B.foco=false;estado(c)};
  }

  var apis=marcos.map(KIND==='entrada'?entrada:formulario);
  /* ---------- Tira de controles de la maqueta: fuera del marco, controla los cuatro a la vez ---------- */
  var T=KIND==='entrada'?[['ini','Buscar paciente'],['buscando','Buscando'],['res','Resultados'],['nada','Sin resultados'],['alta','Alta rápida'],['dup','Aviso de duplicado'],['rejilla','Paciente elegido · rejilla']]
    :[['vacio','Vacío'],['lleno','Lleno'],['valida','Validación'],['valida2','Validación · sin paciente'],['aplicada','Plantilla aplicada'],['elegir','Elegir plantilla'],['sinpl','Sin plantillas'],['elegir0','Sin plantillas · hoja'],['plerr','Plantillas con error'],
      ['guardar','Guardar plantilla'],['tope','Tope de 10'],['gestionar','Gestionar'],['renombrar','Renombrar'],['sobrescribir','Sobrescribir'],['menu','Menú ···'],['tipo','Cambiar tipo'],['conftipo','Cambiar con datos'],
      ['cargando','Cargando perfil'],['perfil','Perfil incompleto'],['generando','Generando PDF'],['error','Error al guardar'],['gen','Documento generado'],['genno','No quedó en el expediente'],['otro','Otro correo'],['confcorreo','Confirmar correo'],['enviado','Enviado']];
  var tira=document.createElement('div');tira.className='ZQ-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  tira.innerHTML='<span>Maqueta</span>'+T.map(function(t){return '<button type="button" data-d="'+t[0]+'">'+t[1]+'</button>'}).join('')
    /* CALMA §23.4: sin alergias registradas no se dibuja la etiqueta. Conmutador aparte: no lo reinician los demás estados. */
    +(KIND==='receta'?'<button type="button" data-alg="1" aria-pressed="false">Sin alergias</button>':'');
  var op=marcos[0].closest('.op');
  if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
  tira.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b.dataset.alg){var sin=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(sin));marcos.forEach(function(m){m.querySelectorAll('.ZQ-alg').forEach(function(x){x.hidden=sin})});return}
    apis.forEach(function(f){f(b.dataset.d)})});
})();
