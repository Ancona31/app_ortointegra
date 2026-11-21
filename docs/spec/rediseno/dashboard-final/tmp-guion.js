(function(){
  var HOY=new Date(2026,10,19),TIT={con:'Nueva consulta',doc:'Nuevo documento'};
  document.querySelectorAll('.db.marco').forEach(function(m){
    var capa=m.querySelector('.db-capa'),hoja=m.querySelector('.db-hoja'),vbus=m.querySelector('.db-vbus'),campo=m.querySelector('.db-busca'),
        filas=[].slice.call(m.querySelectorAll('.db-r')),nombre=m.querySelector('.db-nombre'),priv=m.querySelector('.db-priv'),
        envia=m.querySelector('.db-envia'),nac=m.querySelector('.db-nac'),edad=m.querySelector('.db-edad'),tit=m.querySelector('.db-hj-t'),
        cont=m.querySelector('.db-cont'),origen=null,act=-1;
    function visibles(){return filas.filter(function(b){return !b.parentNode.hidden})}
    function marca(i){var v=visibles();act=v.length?Math.max(-1,Math.min(i,v.length-1)):-1;
      filas.forEach(function(b){b.setAttribute('aria-selected','false')});if(act>=0)v[act].setAttribute('aria-selected','true')}
    function filtra(){var q=campo.value.trim().toLowerCase();
      filas.forEach(function(b){b.parentNode.hidden=!!q&&b.dataset.n.indexOf(q)<0});
      vbus.classList.toggle('db-vacia',!visibles().length);marca(q?0:-1)}
    function abre(e){origen=e.currentTarget;var t=TIT[origen.dataset.abre]||TIT.con;tit.textContent=t;hoja.setAttribute('aria-label',t);
      capa.classList.remove('db-form');campo.value='';filtra();
      capa.classList.add('db-on');capa.setAttribute('aria-hidden','false');campo.focus({preventScroll:true})}
    function cierra(){capa.classList.remove('db-on');capa.setAttribute('aria-hidden','true');
      if(origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    function valida(){envia.setAttribute('aria-disabled',String(!(nombre.value.trim()&&priv.checked)))}
    m.querySelectorAll('[data-abre]').forEach(function(b){b.addEventListener('click',abre)});
    m.querySelectorAll('.db-cierra').forEach(function(b){b.addEventListener('click',cierra)});
    m.querySelector('.db-velo').addEventListener('click',cierra);
    m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
    campo.addEventListener('input',filtra);
    filas.forEach(function(b){b.addEventListener('click',cierra)});
    m.addEventListener('keydown',function(e){
      if(!capa.classList.contains('db-on'))return;
      if(e.key==='Escape'){e.preventDefault();cierra();return}
      if(capa.classList.contains('db-form'))return;
      if(e.key==='ArrowDown'){e.preventDefault();marca(act+1)}
      else if(e.key==='ArrowUp'){e.preventDefault();marca(act<=0?0:act-1)}
      else if(e.key==='Enter'&&document.activeElement===campo&&act>=0){e.preventDefault();cierra()}
    });
    m.querySelector('.db-crear').addEventListener('click',function(){capa.classList.add('db-form');nombre.focus({preventScroll:true})});
    m.querySelectorAll('.db-volver,.db-cancela').forEach(function(b){b.addEventListener('click',function(){capa.classList.remove('db-form');campo.focus({preventScroll:true})})});
    nombre.addEventListener('input',valida);
    priv.addEventListener('change',valida);
    nac.addEventListener('input',function(){var p=nac.value.split('-'),ok=p.length===3&&+p[0]>1900;
      if(ok){var a=HOY.getFullYear()-p[0];if(HOY.getMonth()+1<+p[1]||(HOY.getMonth()+1===+p[1]&&HOY.getDate()<+p[2]))a--;ok=a>=0;if(ok)edad.textContent=a+(a===1?' año':' años')}
      if(!ok)edad.textContent='Se calcula sola';edad.classList.toggle('db-ok',ok)});
    m.querySelector('.db-vform').addEventListener('submit',function(e){e.preventDefault();if(envia.getAttribute('aria-disabled')!=='true')cierra()});
    /* Hoja de acciones de la cita (CALMA §24): se rellena con los datos de la fila tocada */
    var cc=m.querySelector('.db-capa-c'),hc=cc.querySelector('.db-hc'),q=function(c){return cc.querySelector(c)},orC=null;
    function abreCita(b){var d=b.dataset;orC=b;
      ['est','ori','sx','pa','lig'].forEach(function(k){cc.dataset[k]=d[k]});
      q('.db-hc-mes').textContent=d.mes;q('.db-hc-dia').textContent=d.dia;q('.db-hc-n').textContent=d.nom;
      q('.db-hc-cuando').textContent=d.cuando;q('.db-hc-med').textContent=d.med;hc.setAttribute('aria-label','Cita de '+d.nom);
      cc.classList.add('db-on');cc.setAttribute('aria-hidden','false');q('.db-hc-x').focus({preventScroll:true})}
    function cierraCita(){cc.classList.remove('db-on');cc.setAttribute('aria-hidden','true');
      if(orC&&orC.offsetParent)orC.focus({preventScroll:true})}
    m.querySelectorAll('.db-fbtn[data-nom]').forEach(function(b){b.addEventListener('click',function(){abreCita(b)})});
    m.abreCita=function(i,nolig){var b=m.querySelectorAll('.db-cols.db-m .db-fbtn[data-nom]')[i];if(!b)return;b.closest('li').hidden=false;
      b.dataset.lig=nolig?'0':'1';abreCita(b)};
    q('.db-velo').addEventListener('click',cierraCita);
    q('.db-hc-x').addEventListener('click',cierraCita);
    /* Iniciar, ligar, ver en la agenda y ver expediente navegan en la app; en la maqueta cierran la hoja */
    cc.querySelectorAll('.db-hc-prim,.db-hc-a').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();cierraCita()})});
    /* «¿No es una cita?»: un toque, sin confirmación; la fila sale de la lista (BotonNoEsCita.tsx:21,37-45) */
    q('.db-hc-noes').addEventListener('click',function(){var li=orC&&orC.closest('li');orC=null;cierraCita();if(li)li.hidden=true});
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&cc.classList.contains('db-on')){e.preventDefault();cierraCita()}});
    /* «Estados» (patrón de menús del catálogo): desplegable sin velo solo en computadora; en los demás, capa de leyenda */
    function capaSimple(c,orig){if(!c)return null;var o=null;
      function cierra(){c.classList.remove('db-on');c.setAttribute('aria-hidden','true');if(o&&o.offsetParent)o.focus({preventScroll:true})}
      c.querySelector('.db-velo').addEventListener('click',cierra);
      c.querySelectorAll('.db-hl-x').forEach(function(b){b.addEventListener('click',cierra)});
      m.addEventListener('keydown',function(e){if(e.key==='Escape'&&c.classList.contains('db-on')){e.preventDefault();cierra()}});
      return {abre:function(b){o=b;c.classList.add('db-on');c.setAttribute('aria-hidden','false');
        var f=c.querySelector('.db-hl-x,.db-mo,.db-ap-cab');if(f)f.focus({preventScroll:true})},cierra:cierra}}
    var capL=capaSimple(m.querySelector('.db-capa-l')),capM=capaSimple(m.querySelector('.db-capa-m'));
    m.querySelectorAll('.db-est-b').forEach(function(b){var l=b.nextElementSibling;
      if(!l){b.addEventListener('click',function(){capL.abre(b)});return}
      function pon(ab){b.setAttribute('aria-expanded',String(ab));l.classList.toggle('db-ley-on',ab)}
      b.addEventListener('click',function(e){e.stopPropagation();pon(b.getAttribute('aria-expanded')!=='true')});
      m.addEventListener('click',function(e){if(!b.contains(e.target))pon(false)});
      m.addEventListener('keydown',function(e){if(e.key==='Escape'&&b.getAttribute('aria-expanded')==='true'){pon(false);b.focus({preventScroll:true})}})});
    /* «Más» (riel de Duo cerrado, píldora de Duo vertical, avatar de la secretaria): tarjeta centrada con velo */
    if(capM)m.querySelectorAll('[data-abre-mas]').forEach(function(b){b.addEventListener('click',function(){capM.abre(b)})});
    /* Aviso «N datos pendientes»: se pliega y despliega desde su cabecera */
    m.querySelectorAll('.db-ap-cab').forEach(function(b){b.addEventListener('click',function(){
      var a=b.closest('.db-ap'),pl=a.classList.toggle('db-pleg');b.setAttribute('aria-expanded',String(!pl))})});
    /* Computadora: si saludo + fecha no caben en una fila, la fecha baja bajo el saludo (ver CSS «Saludo largo») */
    var top=m.querySelector('.db-top');
    m.ajustaSaludo=function(){if(m.dataset.vp!=='esc'||!m.offsetParent)return;top.classList.remove('db-apila');
      var cab=top.querySelector('.db-cab'),hoy=top.querySelector('.db-hoy'),h1=cab.querySelector('h1');
      if(hoy.offsetTop>=cab.offsetTop+cab.offsetHeight-4||hoy.scrollWidth>hoy.clientWidth+1||top.querySelector(".db-hoy-t").getBoundingClientRect().left<h1.getBoundingClientRect().right+12||h1.scrollWidth>h1.clientWidth+1||h1.offsetHeight>48)top.classList.add('db-apila')};
    if(window.ResizeObserver)new ResizeObserver(function(){m.ajustaSaludo()}).observe(cont);
  });
  /* Controles de maqueta FUERA del teléfono (CALMA §7): una sola tira controla los cinco marcos */
  var marcos=[].slice.call(document.querySelectorAll('.db.marco'));
  if(marcos.length){
    var tira=document.createElement('div');tira.className='db-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
    var B=[['sec','Maqueta: ver como secretaria',1],['cit','Maqueta: ver día sin citas',1],['h0','Maqueta: hoja con expediente'],
           ['h2','Maqueta: hoja sin expediente (enlace)'],['h3','Maqueta: hoja sin expediente (Google Calendar)'],
           ['h4','Maqueta: hoja sin poder ligar'],['nom','Maqueta: nombre largo · Admin']],CL={sec:'db-sec',cit:'db-sincitas'};
    var IDX={h0:1,h2:2,h3:3,h4:3},NOMS=['Admin','Fernando','Beneplácito','José de Jesús'],iN=0;
    B.forEach(function(x){var b=document.createElement('button');b.type='button';b.textContent=x[1];b.dataset.k=x[0];
      if(x[2])b.setAttribute('aria-pressed','false');tira.appendChild(b);
      b.addEventListener('click',function(){var k=x[0];
        if(k==='nom'){iN=(iN+1)%NOMS.length;b.textContent='Maqueta: nombre largo · '+NOMS[iN];
          document.querySelectorAll('.db.marco .db-nomsal').forEach(function(x){x.textContent=NOMS[iN]});
          marcos.forEach(function(m){m.ajustaSaludo()});return}
        if(CL[k]){var on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));
          marcos.forEach(function(m){m.classList.toggle(CL[k],on);m.ajustaSaludo()});return}
        /* La hoja es del médico en un día con citas: si la variante activa la oculta, se vuelve a la normal */
        tira.querySelectorAll('[aria-pressed="true"]').forEach(function(p){p.click()});
        var vis=marcos.filter(function(m){return m.offsetParent!==null});(vis.length?vis:marcos).forEach(function(m){m.abreCita(IDX[k],k==='h4')})})});
    var op=marcos[0].closest('.op'),h=op&&op.querySelector('header');
    if(h)h.appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
  }
})();
