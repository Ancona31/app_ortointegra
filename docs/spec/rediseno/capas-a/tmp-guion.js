(function(){
  /* Capas con resorte de verdad (CALMA §25, skill apple-design §3–§9).
     - Cada capa tiene un progreso p (0 cerrada · 1 abierta) que sigue a su objetivo con un resorte (masa 1, rigidez (2π/respuesta)²,
       amortiguación 4π·ζ/respuesta), integrado fotograma a fotograma. Cambiar el objetivo a medio camino NO reinicia nada: el resorte
       parte del valor y la velocidad que hay en pantalla, así que abrir y cerrar a mitad no salta.
     - Entrada ζ 1.0 / 0.36 s; salida ζ 1.0 / 0.24 s (más rápida); tras soltar un arrastre ζ 0.8 / 0.30 s si el gesto llevaba
       velocidad (> 300 px/s), si no ζ 1.0. Solo se escriben transform y opacity.
     - Hojas (solo iPhone, CALMA §26): arrastre 1:1 con umbral de 10 px, rubber-band hacia arriba, proyección de inercia
       (deceleración 0.998) para decidir si cierra, y la velocidad del dedo pasa al resorte.
     - Movimiento reducido: sin desplazamiento ni escala; fundido lineal de 200 ms (150 al salir).
     En la app: el mismo modelo con un resorte de librería (p. ej. Motion, bounce 0, duration .36). */
  var CFG=__CFG__;
  var marcos=[].slice.call(document.querySelectorAll('.PX.marco'));
  if(!marcos.length)return;
  var mqM=matchMedia('(prefers-reduced-motion: reduce)');
  var G={v:CFG.def,rm:false,rt:false,lento:false};
  function RM(){return G.rm||mqM.matches}
  var mqT=matchMedia('(prefers-reduced-transparency: reduce)');function RT(){return G.rt||mqT.matches}
  /* Transparencia reducida: velo OPACO. Oscuro: --navy al 100 %; claro: el color sólido equivalente al velo sobre el fondo (--navy 45 % + --fondo). */
  function oscuro(m){var c=getComputedStyle(m).backgroundColor.match(/[\d.]+/g)||[255,255,255];return (+c[0]*.2126+ +c[1]*.7152+ +c[2]*.0722)<128}
  function cl(x,a,b){return x<a?a:x>b?b:x}
  function rubber(o,d){var c=.55;return o*d*c/(d+c*Math.abs(o))}
  var API=marcos.map(controla);

  function controla(m){
    var vp=m.dataset.vp,tel=vp==='ext'||vp==='tel',app=m.querySelector('.PX-app'),velo=m.querySelector('.PX-velo');
    var L={},raf=0,last=0;
    function z(){return m.getBoundingClientRect().width/m.offsetWidth||1}
    [].forEach.call(m.querySelectorAll('.PX-capa'),function(c){
      var k=c.dataset.k,modo=k==='alerta'?'centro':k==='hoja'?(vp==='tel'?'hoja':'centro'):(vp==='tel'?'hoja':vp==='esc'?'pop':'centro'); /* CALMA §26: en ext todo es tarjeta centrada; la hoja inferior arrastrable solo en tel */
      c.dataset.modo=modo;c.setAttribute('aria-hidden','true');c.inert=true;
      var l=L[c.dataset.c]={key:c.dataset.c,c:c,card:c.querySelector('.PX-card'),modo:modo,p:0,v:0,t:0,on:false,H:300,off:0,resp:.36,zeta:1,op:null,drag:false};
      if(modo==='hoja')arrastre(l);
    });
    function pinta(l){
      var p=l.p,tr='',op=1,rm=RM();
      if(l.modo==='hoja'){
        if(rm){op=cl(p,0,1);tr='translate3d(0,'+l.off.toFixed(2)+'px,0)'}
        else tr='translate3d(0,'+((1-p)*l.H).toFixed(2)+'px,0)';
      }else if(l.modo==='centro'){
        if(rm)op=cl(p,0,1);else{op=cl(p*1.25,0,1);tr='scale('+(.96+.04*cl(p,0,1.1)).toFixed(4)+')'}
      }else{
        if(rm)op=cl(p,0,1);else{op=cl(p*1.4,0,1);tr='scale('+(.9+.1*cl(p,0,1.1)).toFixed(4)+')'}
      }
      l.card.style.transform=tr;l.card.style.opacity=op.toFixed(3);
    }
    function pintaVelo(){var o=0;for(var k in L){var l=L[k];if(l.on&&l.modo!=='pop')o=Math.max(o,cl(l.p,0,1))}
      velo.style.opacity=o.toFixed(3);velo.style.background=RT()?(oscuro(m)?'var(--navy)':'color-mix(in srgb,var(--navy) 45%,var(--fondo))'):'';velo.style.visibility=o>.001?'visible':'hidden'}
    function paso(now){
      raf=0;var dt=last?Math.min(.034,(now-last)/1000):0;last=now;if(G.lento)dt/=4;
      var vivo=false,rm=RM();
      for(var k in L){var l=L[k];if(!l.on||l.drag)continue;
        if(rm){var r=dt/(l.t>l.p?.2:.15);l.p=l.t>l.p?Math.min(l.t,l.p+r):Math.max(l.t,l.p-r);l.v=0;
          if(l.t===1&&l.off)l.off=Math.abs(l.off)<.5?0:l.off*Math.max(0,1-dt*14)}
        else{var K=Math.pow(2*Math.PI/l.resp,2),C=4*Math.PI*l.zeta/l.resp,n=Math.max(1,Math.ceil(dt*240)),h=dt/n;
          for(var i=0;i<n;i++){var a=-K*(l.p-l.t)-C*l.v;l.v+=a*h;l.p+=l.v*h}}
        if(Math.abs(l.p-l.t)<.0005&&Math.abs(l.v)<.005&&!(rm&&l.t===1&&l.off)){l.p=l.t;l.v=0;if(l.t===0){oculta(l);continue}}
        else vivo=true;
        pinta(l);
      }
      pintaVelo();
      if(vivo)raf=requestAnimationFrame(paso);else last=0;
    }
    function corre(){if(!raf){last=0;raf=requestAnimationFrame(paso)}}
    function oculta(l){l.on=false;l.off=0;l.c.classList.remove('PX-vis');l.c.inert=true;l.card.style.transform='';l.card.style.opacity='0'}
    function abiertaTop(){var r=null;for(var k in L)if(L[k].on&&L[k].t===1)r=L[k];return r}
    function coloca(l){var b=l.op;if(!b||!b.getBoundingClientRect)return;
      var r=b.getBoundingClientRect(),mr=m.getBoundingClientRect(),Z=z(),bx=(r.left-mr.left)/Z,by=(r.top-mr.top)/Z,bw=r.width/Z,bh=r.height/Z;
      var w=l.card.offsetWidth,h=l.card.offsetHeight,left=Math.max(248+12,Math.min(bx+bw-w,m.offsetWidth-w-12)),top=by+bh+4,arr=top+h>m.offsetHeight-12;
      if(arr)top=Math.max(12,by-h-4);
      l.card.style.left=left+'px';l.card.style.top=top+'px';
      l.card.style.transformOrigin=cl(bx+bw/2-left,0,w).toFixed(0)+'px '+(arr?'100%':'0')}
    function abre(k,op){var l=L[k];if(!l)return;
      for(var j in L)if(j!==k&&L[j].on&&L[j].t===1)cierra(j,true);
      if(op)l.op=op;
      if(CFG.alAbrir)CFG.alAbrir(m,k,l.op);
      if(!l.on){l.on=true;l.p=Math.max(l.p,0);l.c.classList.add('PX-vis')}
      l.c.inert=false;l.c.setAttribute('aria-hidden','false');
      if(l.modo==='pop')coloca(l);
      l.H=Math.max(120,l.card.offsetHeight-80);
      if(l.p===0)pinta(l);
      l.t=1;l.resp=l.modo==='pop'?.28:.36;l.zeta=1;
      if(l.modo!=='pop')app.inert=true;
      if(l.op&&l.op.setAttribute)l.op.setAttribute('aria-expanded','true');
      var f=l.card.querySelector('[data-foco]')||l.card.querySelector('button:not([disabled]),a[href],textarea,input');
      if(f)f.focus({preventScroll:true});else l.card.focus({preventScroll:true});
      corre()}
    function cierra(k,sinFoco){var l=L[k];if(!l||!l.on||l.t===0)return;
      l.t=0;l.resp=l.modo==='pop'?.2:.24;l.zeta=1;l.c.setAttribute('aria-hidden','true');
      var otro=false;for(var j in L)if(j!==k&&L[j].on&&L[j].t===1&&L[j].modo!=='pop')otro=true;
      if(!otro)app.inert=false;
      if(l.op&&l.op.setAttribute)l.op.setAttribute('aria-expanded','false');
      if(!sinFoco&&l.op&&l.op.isConnected&&l.op.offsetParent)l.op.focus({preventScroll:true});
      corre()}
    function cierraTodo(){for(var k in L)cierra(k,true)}

    /* ---- Arrastre de hojas: 1:1 con el dedo, rubber-band arriba, proyección de inercia y velocidad al resorte ---- */
    function arrastre(l){
      var card=l.card,d=null,anula=false;
      card.addEventListener('pointerdown',function(e){
        if(!l.on||e.button>0||e.target.closest('input,textarea,select'))return;
        var sc=e.target.closest('.PX-hcu');if(sc&&sc.scrollTop>0)return;
        d={id:e.pointerId,y0:e.clientY,x0:e.clientX,act:false,h:[[e.timeStamp,e.clientY]]}});
      card.addEventListener('pointermove',function(e){
        if(!d||e.pointerId!==d.id)return;var Z=z(),dy=(e.clientY-d.y0)/Z,dx=(e.clientX-d.x0)/Z;
        if(!d.act){
          if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){d=null;return}
          if(dy<10)return;
          d.act=true;d.y0=e.clientY;dy=0;try{card.setPointerCapture(e.pointerId)}catch(_){}
          l.drag=true;l.v=0;if(l.t!==1){l.t=1;l.c.setAttribute('aria-hidden','false');app.inert=true}
          d.base=RM()?l.off:(1-l.p)*l.H;l.H=Math.max(120,card.offsetHeight-80)}
        var y=d.base+dy;if(y<0)y=-rubber(-y,80);
        if(RM())l.off=y;else l.p=1-y/l.H;
        d.h.push([e.timeStamp,e.clientY]);if(d.h.length>6)d.h.shift();
        pinta(l);pintaVelo();e.preventDefault()});
      function suelta(e){if(!d||e.pointerId!==d.id)return;var dd=d;d=null;if(!dd.act)return;
        l.drag=false;anula=true;setTimeout(function(){anula=false},0);
        var Z=z(),h=dd.h,a=h[0],b=h[h.length-1],vy=(b[1]-a[1])/Z/Math.max(.016,(b[0]-a[0])/1000);
        if(e.timeStamp-b[0]>90)vy=0;
        var y=RM()?l.off:(1-l.p)*l.H,proy=y+vy/1000*.998/(1-.998);
        if(proy>l.H*.5)cierra(l.key);else l.t=1;
        l.v=RM()?0:-vy/l.H;l.zeta=Math.abs(vy)>300?.8:1;l.resp=.3;corre()}
      card.addEventListener('pointerup',suelta);card.addEventListener('pointercancel',suelta);
      card.addEventListener('click',function(e){if(anula){e.preventDefault();e.stopPropagation()}},true);
    }

    /* ---- Eventos ---- */
    m.addEventListener('click',function(e){
      var t=e.target.closest('a[href="#"]');if(t)e.preventDefault();
      if((t=e.target.closest('[data-abre]'))&&!t.closest('.PX-capa')){var k=t.dataset.abre==='@'?G.v:t.dataset.abre,l=L[k];
        if(l&&l.on&&l.t===1&&l.modo==='pop'){cierra(k);return}abre(k,t);return}
      var capa=e.target.closest('.PX-capa');
      if(capa){
        if(CFG.enCapa&&CFG.enCapa(m,capa.dataset.c,e,function(){cierra(capa.dataset.c)}))return;
        if(e.target.closest('[data-cierra]'))cierra(capa.dataset.c);return}
      if(e.target===velo){var top=abiertaTop();if(top&&top.c.dataset.velo!=='no')cierra(top.key)}
    });
    m.addEventListener('pointerdown',function(e){for(var k in L){var l=L[k];
      if(l.modo==='pop'&&l.on&&l.t===1&&!l.card.contains(e.target)&&!(l.op&&l.op.contains(e.target)))cierra(k,true)}},true);
    m.addEventListener('scroll',function(){for(var k in L)if(L[k].modo==='pop')cierra(k,true)},true);
    m.addEventListener('keydown',function(e){var top=abiertaTop();if(!top)return;
      if(e.key==='Escape'){e.preventDefault();cierra(top.key);return}
      if(/^Arrow|^Home$|^End$/.test(e.key)){var its=[].slice.call(top.card.querySelectorAll('[role^="menuitem"],[role="radio"],.PX-az')),i=its.indexOf(document.activeElement);
        if(!its.length||i<0&&!/Down|Right/.test(e.key))return;
        var cols=top.card.querySelector('.PX-rej')?(tel?2:4):1,n=its.length,j=i;
        if(e.key==='Home')j=0;else if(e.key==='End')j=n-1;
        else if(e.key==='ArrowDown')j=i<0?0:Math.min(n-1,i+cols);else if(e.key==='ArrowUp')j=Math.max(0,i-cols);
        else if(e.key==='ArrowRight')j=cols>1?Math.min(n-1,i+1):i;else if(e.key==='ArrowLeft')j=cols>1?Math.max(0,i-1):i;
        e.preventDefault();its[j].focus({preventScroll:true})}});

    function ponVar(v){cierraTodo();
      [].forEach.call(m.querySelectorAll('.PX-fondo'),function(f){f.hidden=(' '+f.dataset.vs+' ').indexOf(' '+v+' ')<0;
        if(!f.hidden){var nv=f.dataset.nav;[].forEach.call(m.querySelectorAll('[data-n]'),function(a){if(a.dataset.n===nv)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
          var tt=m.querySelector('.PX-enc-t');if(tt)tt.textContent=f.dataset.tt}});
      var c=m.querySelector('.PX-cont');if(c)c.scrollTop=0}
    function abreVar(){var f=[].filter.call(m.querySelectorAll('.PX-fondo'),function(x){return !x.hidden})[0];if(!f)return;
      var o=f.querySelector('[data-abre="'+G.v+'"]')||f.querySelector('[data-abre="@"]');abre(G.v,o)}
    function repinta(){for(var k in L)if(L[k].on){if(!RM())L[k].off=0;pinta(L[k])}pintaVelo()}
    m.PX_capa=function(k){return L[k]};
    return {m:m,ponVar:ponVar,abreVar:abreVar,cierra:function(){var t=abiertaTop();if(t)cierra(t.key)},repinta:repinta};
  }

  /* ---- Tira de maqueta (fuera del marco) y ficha «Especificación» bajo el marco ---- */
  var tira=document.createElement('div');tira.className='PX-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  function bt(t,a,pr){var b=document.createElement('button');b.type='button';b.textContent=t;b.dataset.a=a;if(pr!==undefined)b.setAttribute('aria-pressed',String(pr));tira.appendChild(b);return b}
  function sep(){var s=document.createElement('span');s.className='PX-tsep';s.setAttribute('aria-hidden','true');tira.appendChild(s)}
  CFG.vars.forEach(function(x){bt('Maqueta: '+x[1],'v:'+x[0],x[0]===G.v)});sep();
  bt('Abrir','abrir');bt('Cerrar','cerrar');sep();
  bt('Movimiento reducido','rm',false);bt('Transparencia reducida','rt',false);bt('Cámara lenta ×4','lento',false);
  var ficha=document.createElement('section');ficha.className='PX-ficha';ficha.setAttribute('aria-label','Especificación');ficha.setAttribute('lang','es');ficha.innerHTML=CFG.ficha;
  var op=marcos[0].closest('.op');
  if(op){op.querySelector('header').appendChild(tira);op.appendChild(ficha)}
  else{marcos[0].parentNode.insertBefore(tira,marcos[0]);marcos[marcos.length-1].parentNode.appendChild(ficha)}
  function marca(){[].forEach.call(tira.querySelectorAll('button[aria-pressed]'),function(b){var a=b.dataset.a;
    b.setAttribute('aria-pressed',String(a.indexOf('v:')===0?a.slice(2)===G.v:!!G[a]))})}
  tira.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var a=b.dataset.a;
    if(a.indexOf('v:')===0){G.v=a.slice(2);API.forEach(function(x){x.ponVar(G.v)})}
    else if(a==='abrir')API.forEach(function(x){if(x.m.offsetParent!==null||x.m.style.display!=='none')x.abreVar()});
    else if(a==='cerrar')API.forEach(function(x){x.cierra()});
    else{G[a]=!G[a];marcos.forEach(function(m){m.classList.toggle('PX-'+a,G[a])});API.forEach(function(x){x.repinta()})}
    marca()});
  API.forEach(function(x){x.ponVar(G.v)});marca();
  new MutationObserver(function(){API.forEach(function(x){x.repinta()})}).observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){API.forEach(function(x){x.repinta()})});
})();
