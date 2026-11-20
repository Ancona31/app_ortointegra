(function(){
  var marcos=[].slice.call(document.querySelectorAll('.ec.marco'));
  if(!marcos.length)return;

  /* Tira de controles de la maqueta: fuera del marco, una sola para los cuatro (CALMA §7) */
  var tira=document.createElement('div'),bots={};tira.className='ec-tira';
  function pon(cl,on){marcos.forEach(function(m){m.classList.toggle(cl,on)});if(bots[cl])bots[cl].setAttribute('aria-pressed',String(on));
    /* Prueba de textos largos: cambia el nombre y las alergias en los cuatro marcos */
    if(cl==='ec-largos')marcos.forEach(function(m){
      [].forEach.call(m.querySelectorAll('.ec-pn'),function(x){x.textContent=on?'María Fernanda Hernández Villanueva':'Paciente Prueba 01'});
      [].forEach.call(m.querySelectorAll('.ec-pa'),function(x){x.textContent=on?'Alergias: Penicilina, sulfas, AINE':'Alergias: Penicilina'});
      [].forEach.call(m.querySelectorAll('.ec-pac'),function(x){x.textContent=on?'Penicilina, sulfas, AINE':'Penicilina'})})}
  [['ec-vacio','Maqueta: ver expediente recién creado'],['ec-sinalg','Maqueta: sin alergias'],['ec-sincl','Maqueta: sin clínica'],
   ['ec-correo','Maqueta: el correo no coincide'],['ec-falla','Maqueta: descarga fallida'],['ec-sinr','Maqueta: sin mediciones en el rango'],['ec-largos','Maqueta: nombre y alergias largos']].forEach(function(d){
    var b=document.createElement('button');b.type='button';b.textContent=d[1];b.setAttribute('aria-pressed','false');bots[d[0]]=b;
    b.addEventListener('click',function(){pon(d[0],b.getAttribute('aria-pressed')!=='true')});
    tira.appendChild(b)});
  var op=marcos[0].closest('.op');
  if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);

  marcos.forEach(function(m){
    var vp=m.dataset.vp,tel=vp==='ext'||vp==='tel',cont=m.querySelector('.ec-cont'),det=m.querySelector('.ec-det'),
        capaM=m.querySelector('[data-capa="menu"]'),capaA=m.querySelector('[data-capa="alerta"]'),aviso=m.querySelector('.ec-aviso'),
        origen=null,tAviso=null,alSi=null,archAct='0';
    function $$(s,r){return [].slice.call((r||m).querySelectorAll(s))}
    function capa(k){return m.querySelector('[data-capa="'+k+'"]')}
    m.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&m.contains(a))e.preventDefault()});

    /* Cabecera que se contrae (teléfono): solo alterna una clase; el CSS anima opacity/transform */
    if(tel){var h1=m.querySelector('.ec-id h1'),barra=m.querySelector('.ec-barra');
      cont.addEventListener('scroll',function(){m.classList.toggle('ec-min',cont.scrollTop>h1.offsetTop+h1.offsetHeight-barra.offsetHeight-4)},{passive:true})}

    /* Pestañas */
    function tab(k){
      $$('.ec-tab').forEach(function(t){t.setAttribute('aria-selected',String(t.dataset.tab===k))});
      $$('.ec-pan').forEach(function(p){p.hidden=p.dataset.pan!==k});
      m.classList.remove('ec-an-on');
      if(tel){var lim=m.querySelector('.ec-ancla').offsetTop-m.querySelector('.ec-barra').offsetHeight+8;cont.scrollTop=Math.min(cont.scrollTop,lim)}else cont.scrollTop=0;
    }
    $$('.ec-tab').forEach(function(t){t.addEventListener('click',function(){tab(t.dataset.tab)})});

    /* Lista → detalle (nota, documento, analito, archivo) */
    var ATR={con:'nota',doc:'docv',an:'anv',ar:'arv'};
    function marca(pan,at,id){$$('.ec-fila['+at+']',m.querySelector('[data-pan="'+pan+'"]')).forEach(function(f){
      if(f.getAttribute(at)===id)f.setAttribute('aria-current','true');else f.removeAttribute('aria-current')})}
    function abre(k,id){
      var sel='[data-'+ATR[k]+'="'+id+'"]';
      $$('.ec-avl').forEach(function(a){a.hidden=true});
      if(k==='doc')m.classList.toggle('ec-borr',id==='con');
      if(k==='ar')archAct=id;
      if(det){$$('.ec-art',det).forEach(function(a){a.hidden=!a.matches(sel)});
        det.dataset.k=k;det.querySelector('.ec-dsc').scrollTop=0;m.classList.add('ec-det-on');det.setAttribute('aria-hidden','false');return}
      if(k==='con'){$$('[data-nota]').forEach(function(a){a.hidden=!a.matches(sel)});marca('consultas','data-con',id)}
      else if(k==='doc'){$$('[data-docv]').forEach(function(a){a.hidden=!a.matches(sel)});marca('documentos','data-doc',id)}
      else if(k==='an'){$$('[data-anv]').forEach(function(a){a.hidden=!a.matches(sel)});m.classList.add('ec-an-on');cont.scrollTop=0}
      else{var c=capa('previa'),art=c.querySelector(sel);$$('[data-arv]',c).forEach(function(a){a.hidden=a!==art});
        c.querySelector('.ec-hcab h2').textContent=art.querySelector('h2').textContent;c.querySelector('.ec-hsub').textContent=art.querySelector('.ec-sub').textContent;
        c.querySelector('.ec-hoja').setAttribute('aria-label',art.querySelector('h2').textContent);abreCapa(c)}
    }
    function cierraDet(){m.classList.remove('ec-det-on');if(det)det.setAttribute('aria-hidden','true')}
    $$('.ec-fila[data-con],.ec-fila[data-doc]').forEach(function(f){f.addEventListener('click',function(){
      if(f.dataset.ir)tab(f.dataset.ir);
      if(f.dataset.con)abre('con',f.dataset.con);else abre('doc',f.dataset.doc)})});
    $$('[data-ir]').forEach(function(f){if(f.dataset.con||f.dataset.doc)return;f.addEventListener('click',function(){cierraDet();tab(f.dataset.ir)})});
    $$('[data-an]').forEach(function(f){f.addEventListener('click',function(){origen=f;abre('an',f.dataset.an)})});
    $$('[data-ar]').forEach(function(f){f.addEventListener('click',function(){origen=f;abre('ar',f.dataset.ar)})});
    $$('.ec-dvolver').forEach(function(b){b.addEventListener('click',cierraDet)});
    $$('.ec-anvolver').forEach(function(b){b.addEventListener('click',function(){m.classList.remove('ec-an-on')})});
    if(!det)m.classList.toggle('ec-borr',true); /* en ancho el primer documento abierto es el borrador */

    /* Imprimir → Generando… → Abrir PDF */
    $$('.ec-imp').forEach(function(b){b.addEventListener('click',function(){
      b.textContent='Generando…';b.setAttribute('aria-disabled','true');
      setTimeout(function(){b.hidden=true;b.textContent='Imprimir';b.removeAttribute('aria-disabled');b.parentNode.querySelector('.ec-pdf').hidden=false},900)})});

    /* Colapsar / expandir el carril de consultas (ancho) */
    $$('.ec-plega,.ec-mostrar').forEach(function(b){b.addEventListener('click',function(){b.closest('.ec-md').classList.toggle('ec-sinlista')})});

    /* Detalle del analito: cuántas mediciones ver */
    $$('.ec-lim').forEach(function(b){b.addEventListener('click',function(){
      var art=b.closest('.ec-anv'),n=+b.dataset.n;
      $$('.ec-lim',art).forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
      $$('.ec-graf',art).forEach(function(g){g.hidden=+g.dataset.n!==n});
      $$('.ec-reg[data-i]',art).forEach(function(r){r.hidden=+r.dataset.i>=n})})});
    $$('.ec-vertodas').forEach(function(b){b.addEventListener('click',function(){pon('ec-sinr',false)})});
    $$('.ec-reg-x').forEach(function(b){b.addEventListener('click',function(){var d=b.dataset.del.split('|');origen=b;
      alerta({h:'Eliminar medición',s:d[0],t:'¿Seguro que quieres eliminar esta medición de <b>'+d[0]+'</b> del <b>'+d[1]+'</b>?',si:'Eliminar',
        luego:function(){b.closest('.ec-reg').hidden=true;toast('Medición eliminada')}})})});

    /* Bloques plegables */
    $$('button.ec-plg').forEach(function(b){b.addEventListener('click',function(){
      var c=b.parentNode.classList.toggle('ec-cerr');b.setAttribute('aria-expanded',String(!c))})});

    /* Capas */
    function abreCapa(c){void c.offsetWidth;c.classList.add('ec-on');c.setAttribute('aria-hidden','false')}
    function cierra(c,sinFoco){c.classList.remove('ec-on');c.setAttribute('aria-hidden','true');if(!sinFoco&&origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    function menu(b){origen=b;var k=b.dataset.menu,mn;
      $$('.ec-menu',capaM).forEach(function(x){var s=x.dataset.m===k;x.classList.toggle('ec-act',s);if(s)mn=x});
      if(vp==='esc'){var z=m.getBoundingClientRect().width/m.offsetWidth,mr=m.getBoundingClientRect(),br=b.getBoundingClientRect();
        var der=(mr.right-br.right)/z,izq=(br.left-mr.left)/z,top=(br.bottom-mr.top)/z+4;
        if(izq<m.offsetWidth/2&&vp==='esc'&&b.classList.contains('ec-fil')){mn.style.left=izq+'px';mn.style.right='auto';mn.style.transformOrigin='top left'}
        else{mn.style.right=Math.max(8,der)+'px';mn.style.left='auto';mn.style.transformOrigin='top right'}
        mn.style.top=Math.max(8,Math.min(top,m.offsetHeight-mn.offsetHeight-12))+'px'}
      abreCapa(capaM)}
    $$('[data-menu]').forEach(function(b){b.addEventListener('click',function(){menu(b)})});
    $$('.ec-velo').forEach(function(v){v.addEventListener('click',function(){cierra(v.parentNode)})});
    $$('.ec-cierra').forEach(function(b){b.addEventListener('click',function(){cierra(b.closest('.ec-capa'))})});
    m.addEventListener('keydown',function(e){if(e.key!=='Escape')return;var ab=$$('.ec-capa.ec-on');
      if(capaA.classList.contains('ec-on'))cierra(capaA);else if(ab.length)cierra(ab[ab.length-1]);else cierraDet()});

    /* Alerta centrada: destructivas y «El correo no coincide» */
    function alerta(o){alSi=o.luego||null;
      capaA.querySelector('.ec-al-h').textContent=o.h;capaA.querySelector('.ec-al-s').textContent=o.s||'';capaA.querySelector('.ec-al-t').innerHTML=o.t||'';
      capaA.querySelector('.ec-al-si').textContent=o.si;
      /* Rótulo largo (más de dos palabras cortas): los dos botones se apilan a todo el ancho, el principal arriba */
      var a=capaA.querySelector('.ec-alerta');a.classList.toggle('ec-al-neutra',!!o.neutra);a.classList.toggle('ec-al-pila',o.si.length>10);
      capaA.querySelector('.ec-al-si').className='ec-p ec-bl ec-al-si '+(o.neutra?'ec-prim':'ec-bdes');a.setAttribute('aria-label',o.h);abreCapa(capaA)}
    $$('.ec-al-no').forEach(function(b){b.addEventListener('click',function(){cierra(capaA)})});
    $$('.ec-al-si').forEach(function(b){b.addEventListener('click',function(){cierra(capaA);if(alSi)alSi()})});

    /* Avisos: emergente (arriba) y en línea con «Cerrar» (visor de documento) */
    function toast(t){clearTimeout(tAviso);aviso.classList.remove('ec-listo');aviso.querySelector('.ec-av-t').textContent=t;aviso.classList.add('ec-on');
      tAviso=setTimeout(function(){aviso.classList.remove('ec-on')},2800)}
    function enLinea(t){$$('.ec-avl').forEach(function(a){a.querySelector('span').textContent=t;a.hidden=false})}
    $$('.ec-avl-x').forEach(function(b){b.addEventListener('click',function(){b.parentNode.hidden=true})});
    $$('.ec-aviso .ec-av-a,.ec-aviso .ec-desc').forEach(function(b){b.addEventListener('click',function(){aviso.classList.remove('ec-on')})});

    /* Acciones (menús y botones con data-a) */
    var ENVIADO='Documento enviado. Si el paciente no lo recibe, pídele que revise su carpeta de correo no deseado.';
    function accion(a){
      if(a==='eliminar')alerta({h:'Eliminar paciente',s:m.querySelector('.ec-pn').textContent,t:'Se eliminarán <b>permanentemente</b> todas las notas, laboratorios, documentos y datos personales del paciente.',si:'Eliminar'});
      else if(a==='eliminar-doc'){var bo=m.classList.contains('ec-borr');alerta({h:'¿Eliminar documento?',si:bo?'Cancelar borrador':'Eliminar documento',luego:cierraDet})}
      else if(a==='eliminar-arch'){var n=m.querySelector('[data-arv="'+archAct+'"] h2').textContent;
        alerta({h:'Eliminar archivo',s:n,t:'¿Seguro que quieres eliminar <b>'+n+'</b>?',si:'Eliminar',luego:function(){cierraDet();toast('Documento eliminado')}})}
      else if(a==='exportar'){clearTimeout(tAviso);aviso.classList.remove('ec-listo');aviso.querySelector('.ec-av-t').textContent='Generando expediente — 3 notas';aviso.classList.add('ec-on');
        tAviso=setTimeout(function(){aviso.querySelector('.ec-av-t').textContent='';aviso.classList.add('ec-listo')},1100)}
      else if(a==='enviar'){if(m.classList.contains('ec-correo'))alerta({h:'El correo no coincide',neutra:true,si:'Enviar de todos modos',
          t:'<dl class="ec-pares"><div><dt>Se enviará a</dt><dd>paciente01@semilla.spinus.test</dd></div><div><dt>Registrado en la ficha</dt><dd>p.prueba01@semilla.spinus.test</dd></div></dl>',
          luego:function(){enLinea(ENVIADO)}});else enLinea(ENVIADO)}
      else if(a==='regenerar')enLinea('El documento se regeneró y quedó guardado.');
      else if(a==='doc')hoja('nuevo');
    }
    $$('.ec-mi',capaM).forEach(function(b){b.addEventListener('click',function(){
      if(b.hasAttribute('data-b')&&m.classList.contains('ec-borr'))return;
      cierra(capaM,true);
      if(b.dataset.a)accion(b.dataset.a);
      else if(b.dataset.fil){var k=b.dataset.fil,n=0;$$('[data-fil]',capaM).forEach(function(x){x.setAttribute('aria-checked',String(x===b))});
        $$('.ec-dl li').forEach(function(li){li.hidden=k!=='todos'&&li.dataset.tipo!==k;if(!li.hidden)n++});
        $$('[data-menu="fdoc"] b').forEach(function(x){x.textContent=b.querySelector('span span').textContent});
        m.querySelector('.ec-cuenta').textContent=n+(n===1?' documento':' documentos');m.querySelector('.ec-sind').hidden=n>0}
      else if(b.dataset.fa){var f=b.dataset.fa,c=0;$$('[data-fa]',capaM).forEach(function(x){x.setAttribute('aria-checked',String(x===b))});
        $$('.ec-al li').forEach(function(li){li.hidden=f!=='todos'&&li.dataset.fmt!==f;if(!li.hidden)c++});
        $$('[data-menu="farch"] b').forEach(function(x){x.textContent=b.querySelector('span span').textContent});m.querySelector('.ec-sina').hidden=c>0}
    })});
    $$('[data-a]').forEach(function(b){if(b.closest('.ec-menu'))return;b.addEventListener('click',function(){
      var c=b.closest('.ec-capa');if(c)cierra(c,true);accion(b.dataset.a)})});
    $$('.ec-bdl').forEach(function(b){b.addEventListener('click',function(){if(m.classList.contains('ec-falla'))pon('ec-falla',false)})});

    /* Hojas (teléfono) / modales (ancho): Nuevo documento, Agregar medición, Subir documento clínico */
    function cuenta(h){var n=$$('.ec-arch',h).filter(function(li){return !li.hidden}).length;
      $$('.ec-cta-a',h).forEach(function(x){x.textContent=n});$$('.ec-cta-p',h).forEach(function(x){x.textContent=n===1?'archivo':'archivos'});
      var s=h.querySelector('.ec-sube');if(n)s.removeAttribute('aria-disabled');else s.setAttribute('aria-disabled','true');
      h.classList.toggle('ec-conarch',n>0)}
    function hoja(k){var c=capa(k),h=c.querySelector('.ec-hoja');
      h.classList.remove('ec-m-cus','ec-m-ta','ec-res','ec-conarch');
      $$('.ec-sug',h).forEach(function(s){s.hidden=true});$$('.ec-an-in',h).forEach(function(i){i.value=''});$$('.ec-uni-t',h).forEach(function(u){u.textContent='—'});
      if(k==='subir'){$$('.ec-arch',h).forEach(function(li){li.hidden=true});cuenta(h)}
      h.querySelector('.ec-hcu').scrollTop=0;abreCapa(c)}
    $$('[data-abre]').forEach(function(b){b.addEventListener('click',function(){
      if(b.classList.contains('ec-zonal')&&m.classList.contains('ec-sincl'))return;origen=b;hoja(b.dataset.abre)})});
    $$('.ec-az').forEach(function(a){a.addEventListener('click',function(){cierra(capa('nuevo'))})});
    $$('.ec-an-in').forEach(function(i){var s=i.closest('.ec-solo-cat').querySelector('.ec-sug');
      i.addEventListener('focus',function(){s.hidden=false});i.addEventListener('input',function(){s.hidden=false})});
    $$('.ec-sug-i').forEach(function(b){b.addEventListener('click',function(){var h=b.closest('.ec-hoja');
      h.querySelector('.ec-an-in').value=b.querySelector('span').textContent;h.querySelector('.ec-uni-t').textContent=b.dataset.u;
      h.classList.toggle('ec-m-ta',b.dataset.ta==='ta');b.parentNode.hidden=true})});
    $$('.ec-acustom').forEach(function(b){b.addEventListener('click',function(){var h=b.closest('.ec-hoja');h.classList.add('ec-m-cus');h.classList.remove('ec-m-ta');b.parentNode.hidden=true;h.querySelector('.ec-uni-t').textContent='—'})});
    $$('.ec-acat').forEach(function(b){b.addEventListener('click',function(){b.closest('.ec-hoja').classList.remove('ec-m-cus')})});
    $$('.ec-guarda').forEach(function(b){b.addEventListener('click',function(){cierra(b.closest('.ec-capa'));toast('Medición guardada')})});
    $$('.ec-zonah').forEach(function(b){b.addEventListener('click',function(){var h=b.closest('.ec-hoja');$$('.ec-arch',h).forEach(function(li){li.hidden=false});cuenta(h)})});
    $$('.ec-quita').forEach(function(b){b.addEventListener('click',function(){b.closest('.ec-arch').hidden=true;cuenta(b.closest('.ec-hoja'))})});
    $$('.ec-sube').forEach(function(b){b.addEventListener('click',function(){if(b.getAttribute('aria-disabled')==='true')return;b.closest('.ec-hoja').classList.add('ec-res')})});
  });
})();
