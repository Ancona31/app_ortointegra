(function(){
  var marcos=[].slice.call(document.querySelectorAll('.nc2.marco'));if(!marcos.length)return;
  var api=[];
  marcos.forEach(function(m){
    var capa=m.querySelector('.nc2-capa'),hoja=m.querySelector('.nc2-hoja'),ta=m.querySelector('.nc2-ta'),ferr=m.querySelector('.nc2-ferr'),
        guarda=m.querySelector('.nc2-guarda'),seq=m.querySelector('.nc2-seq'),cnt=m.querySelector('.nc2-cnt'),err=m.querySelector('.nc2-err'),
        imp=m.querySelector('.nc2-imp'),impT=m.querySelector('.nc2-imp-t'),giro=m.querySelector('.nc2-giro'),pdf=m.querySelector('.nc2-pdf'),
        cont=m.querySelector('.nc2-cont'),origen=null,reloj=0,candado=m.querySelector('.nc2-etq-s svg').outerHTML;
    m.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});

    /* Imprimir (botón tonal con impresora): «Imprimir» → «Generando...» → el botón se sustituye por el enlace «Abrir PDF», como hoy. */
    function estado(e){imp.hidden=e==='pdf';pdf.hidden=e!=='pdf';giro.hidden=e!=='gen';
      impT.textContent=e==='gen'?'Generando...':'Imprimir';imp.setAttribute('aria-disabled',String(e==='gen'));imp.dataset.est=e}
    imp.addEventListener('click',function(){
      if(imp.dataset.est==='gen')return;
      err.hidden=true;estado('gen');clearTimeout(reloj);reloj=setTimeout(function(){estado('pdf')},1600)});

    /* Nueva nota aclaratoria: hoja / modal */
    function abre(e){origen=e.currentTarget;ta.value='';ferr.hidden=true;capa.classList.add('nc2-on');capa.setAttribute('aria-hidden','false');ta.focus({preventScroll:true})}
    function cierra(){capa.classList.remove('nc2-on');capa.setAttribute('aria-hidden','true');if(origen&&origen.offsetParent)origen.focus({preventScroll:true})}
    m.querySelector('.nc2-abre').addEventListener('click',abre);
    m.querySelector('.nc2-cierra').addEventListener('click',cierra);
    m.querySelector('.nc2-velo').addEventListener('click',cierra);
    m.addEventListener('keydown',function(e){if(e.key==='Escape'&&capa.classList.contains('nc2-on')){e.preventDefault();cierra()}});
    ta.addEventListener('input',function(){ferr.hidden=true});
    hoja.addEventListener('submit',function(e){e.preventDefault();
      if(guarda.getAttribute('aria-disabled')==='true')return;
      var t=ta.value.trim();if(!t){ferr.hidden=false;ta.focus({preventScroll:true});return}
      guarda.setAttribute('aria-disabled','true');guarda.textContent='Guardando...';
      setTimeout(function(){
        var li=document.createElement('li');li.className='nc2-ad nc2-nueva';
        li.innerHTML='<div class="nc2-ad-c"><p class="nc2-ad-m"><b>Dr. Admin Semilla</b><span class="nc2-num">19/11/2026 10:42</span></p><span class="nc2-etq nc2-etq-ok nc2-etq-s">'+candado+'Sellado</span></div><p class="nc2-ad-t"></p>';
        li.querySelector('.nc2-ad-t').textContent=t;seq.appendChild(li);cnt.textContent=seq.children.length;
        guarda.setAttribute('aria-disabled','false');guarda.textContent='Guardar addendum';
        /* El PDF ya generado no lleva este addendum: el enlace vuelve a «Imprimir» (como hoy). */
        clearTimeout(reloj);estado('listo');cierra();cont.scrollTop=cont.scrollHeight;
      },700)});

    api.push({
      ia:function(s){m.classList.toggle('nc2-ia',s)},
      err:function(s){err.hidden=!s;if(s){clearTimeout(reloj);estado('listo');cont.scrollTop=0}},
      nf:function(s){m.classList.toggle('nc2-nf-on',s);cont.scrollTop=0}
    });
  });

  /* Controles de maqueta: una sola tira, fuera de los marcos, que gobierna los cuatro a la vez. */
  var tira=document.createElement('div');tira.className='nc2-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  tira.innerHTML='<span>Maqueta</span>';
  [['ia','Nota con IA'],['err','Error de PDF'],['nf','Consulta no encontrada']].forEach(function(d){
    var b=document.createElement('button');b.type='button';b.textContent=d[1];b.setAttribute('aria-pressed','false');
    b.addEventListener('click',function(){var s=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(s));api.forEach(function(a){a[d[0]](s)})});
    tira.appendChild(b)});
  var msg=document.createElement('span');msg.className='nc2-tira-msg';msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');tira.appendChild(msg);
  var op=marcos[0].closest('.op'),cab=op&&op.querySelector('header');
  if(cab)cab.appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
})();
