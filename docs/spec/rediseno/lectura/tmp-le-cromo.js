(function(){
  /* Cromo global (CALMA §28): «Más» (riel de Duo cerrado y píldora de Duo vertical) abre una tarjeta centrada con velo; el aviso «N datos pendientes» se pliega desde su cabecera. */
  document.querySelectorAll('.PFX.marco').forEach(function(m){
    var c=m.querySelector('.PFX-capa-m'),o=null;
    function cierra(){c.classList.remove('PFX-on');c.setAttribute('aria-hidden','true');if(o&&o.offsetParent)o.focus({preventScroll:true})}
    if(c){c.querySelector('.PFX-velo').addEventListener('click',cierra);
      c.querySelectorAll('.PFX-mo,.PFX-ap-l,.PFX-ap-b').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();cierra()})});
      m.addEventListener('keydown',function(e){if(e.key==='Escape'&&c.classList.contains('PFX-on')){e.preventDefault();cierra()}});
      m.querySelectorAll('[data-abre-mas]').forEach(function(b){b.addEventListener('click',function(){o=b;c.classList.add('PFX-on');c.setAttribute('aria-hidden','false');
        var f=c.querySelector('.PFX-ap-cab,.PFX-mo');if(f)f.focus({preventScroll:true})})})}
    m.querySelectorAll('.PFX-ap-cab').forEach(function(b){b.addEventListener('click',function(){
      var a=b.closest('.PFX-ap'),pl=a.classList.toggle('PFX-pleg');b.setAttribute('aria-expanded',String(!pl))})});
  });
})();
