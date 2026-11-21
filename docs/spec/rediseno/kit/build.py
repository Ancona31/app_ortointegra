import sys,os,re
L=os.path.dirname(os.path.abspath(__file__))
import glob
K=L
L=os.path.abspath(sys.argv[1])
TIT=sys.argv[2] if len(sys.argv)>2 else "Vistas Spinus"
only=sys.argv[3] if len(sys.argv)>3 else None
fs=sorted(glob.glob(f"{L}/vista-*.html"))
ops=[(os.path.basename(f)[6:-5],os.path.basename(f)[6:-5]) for f in fs]
if only: ops=[o for o in ops if o[0]==only]
names={"a":"","b":"","c":""}
frag=""
for k,n in ops:
    t=open(f"{L}/vista-{k}.html").read()
    m=re.search(r"<!--\s*NOMBRE:\s*(.*?)\s*\|\s*(.*?)\s*-->",t)
    nom,desc=(m.group(1),m.group(2)) if m else (n,"")
    frag+=f'<section class="op" data-op="{k}"><header><h2>{nom}</h2><p>{desc}</p></header><div class="esc"><div class="zoom">{t}</div></div></section>\n'
page=f'''<title>{TIT}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{open(f"{K}/base.css").read()}
html,body{{-webkit-text-size-adjust:100%;text-size-adjust:100%}}
body{{background:var(--fondo);color:var(--tinta);font:15px/1.45 var(--fuente)}}
.pg{{max-width:1360px;margin:0 auto;padding-block:24px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:24px}}
.pg>header h1{{margin:0 0 6px;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-.5px}}
.pg>header p{{margin:0;color:var(--tinta2);max-width:70ch}}
.ctl{{display:flex;flex-wrap:wrap;gap:10px;position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--fondo);padding:8px 0}}
.sg{{display:inline-flex;padding:3px;border-radius:12px;background:var(--sup2);gap:2px;flex-wrap:wrap}}
.sg button{{border:0;background:transparent;color:var(--tinta2);font:600 13px/1 var(--fuente);height:36px;padding:0 12px;border-radius:9px;cursor:pointer}}
.sg button[aria-pressed="true"]{{background:var(--sup);color:var(--tinta)}}
.sg button:focus-visible{{outline:3px solid var(--enlace);outline-offset:2px}}
.ops{{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}}
.op{{display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%}}
.op>header h2{{margin:0;font-size:17px;line-height:22px;font-weight:700}}
.op>header p{{margin:2px 0 0;color:var(--tinta2);font-size:13px;line-height:18px;max-width:52ch}}
.esc{{border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(20,33,61,.25);position:relative;max-width:100%}}
.zoom>.marco{{display:none}}
.frj{{position:absolute;pointer-events:none;z-index:50;background:repeating-linear-gradient(45deg,rgba(220,38,38,.26) 0 6px,rgba(220,38,38,.09) 6px 12px)}}
.frj.inf{{background:rgba(220,38,38,.12)}}
</style>
<div class="pg">
<header><h1>{TIT}</h1><p>Propuesta de rediseño. El contenido se desplaza dentro de cada pantalla. Los botones punteados son de la maqueta, no del producto. Datos ficticios.</p></header>
<div class="ctl">
<div class="sg" role="group" aria-label="Dispositivo" id="g-vp"><button type="button" data-v="ext">Duo cerrado</button><button type="button" data-v="tel">iPhone</button><button type="button" data-v="ih">Duo abierto</button><button type="button" data-v="iv">Duo abierto vertical</button><button type="button" data-v="esc">Computadora</button></div>
<div class="sg" role="group" aria-label="Tema" id="g-t"><button type="button" data-v="claro">Claro</button><button type="button" data-v="oscuro">Oscuro</button></div>
<div class="sg" role="group" aria-label="Franja del sistema" id="g-f"><button type="button" data-v="0">Sin marcar franja</button><button type="button" data-v="1">Marcar franja</button></div>
</div>
<div class="ops">{frag}</div>
</div>
<script>
(function(){{
var r=document.documentElement,st={{vp:'ext',t:null,f:'0'}};
var D={{ext:[466,678,0,84,34],tel:[393,852,59,0,34],ih:[951,669,0,84,34],iv:[669,951,82,0,0],esc:[1280,800,0,0,0]}};
function osc(){{if(r.classList.contains('oscuro'))return true;if(r.classList.contains('claro'))return false;if(r.dataset.theme)return r.dataset.theme==='dark';return matchMedia('(prefers-color-scheme: dark)').matches}}
function pinta(){{
  document.querySelectorAll('#g-vp button').forEach(function(b){{b.setAttribute('aria-pressed',String(b.dataset.v===st.vp))}});
  document.querySelectorAll('#g-t button').forEach(function(b){{b.setAttribute('aria-pressed',String((b.dataset.v==='oscuro')===osc()))}});
  document.querySelectorAll('#g-f button').forEach(function(b){{b.setAttribute('aria-pressed',String(b.dataset.v===st.f))}});
  var d=D[st.vp],n=document.querySelectorAll('.op').length,disp=document.querySelector('.ops').clientWidth;
  var cols=(st.vp==='esc'||st.vp==='ih'||st.vp==='iv')?1:Math.min(n,Math.max(1,Math.floor((disp+28)/(d[0]+28))));
  var z=Math.min(1,(st.vp==='esc'||st.vp==='ih'||st.vp==='iv')?disp/d[0]:(cols===1?disp/d[0]:1));
  document.querySelectorAll('.op').forEach(function(o){{
    var e=o.querySelector('.esc'),zm=o.querySelector('.zoom');
    zm.querySelectorAll(':scope>.marco').forEach(function(m){{m.style.display=m.dataset.vp===st.vp?'block':'none'}});
    zm.style.zoom=z;e.style.width=(d[0]*z)+'px';e.style.height=(d[1]*z)+'px';o.style.width=(d[0]*z)+'px';
    e.querySelectorAll('.frj').forEach(function(x){{x.remove()}});
    if(st.f==='1'){{var mk=function(c,s){{var x=document.createElement('div');x.className='frj '+c;x.style.cssText=s;e.appendChild(x)}};
      if(d[3])mk('','top:0;right:0;height:100%;width:'+d[3]*z+'px');if(d[2])mk('','top:0;left:0;width:100%;height:'+d[2]*z+'px');if(d[4])mk('inf','left:0;bottom:0;width:100%;height:'+d[4]*z+'px');}}
  }});
}}
document.querySelector('.ctl').addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;var g=b.parentNode.id;
  if(g==='g-vp')st.vp=b.dataset.v;else if(g==='g-f')st.f=b.dataset.v;else{{r.classList.remove('claro','oscuro');r.classList.add(b.dataset.v)}}pinta()}});
addEventListener('resize',pinta);pinta();
}})();
</script>
'''
out=f"{L}/pagina{'-'+only if only else ''}.html"
open(out,"w").write(page);print(out,len(page))
