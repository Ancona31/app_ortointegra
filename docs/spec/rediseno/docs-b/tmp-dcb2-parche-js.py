# Parche de una sola vez sobre tmp-dcb2-guion.js (segunda revisión del dueño)
import os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-dcb2-guion.js')
s = open(P).read()
def cambia(viejo, nuevo, n=1):
    global s
    assert s.count(viejo) == n, (viejo[:70], s.count(viejo))
    s = s.replace(viejo, nuevo)
SVG = lambda d, t, w: '<svg aria-hidden="true" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (t, t, w, d)
cambia("  var marcos=[].slice.call(", "  var PLUS_SVG='" + SVG('<path d="M12 5v14M5 12h14"/>', 18, 2.4) + "';\n"
       "  var BAS28='" + SVG('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 28, 1.8) + "';\n"
       "  var AVI28='" + SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>', 28, 1.8) + "';\n  var marcos=[].slice.call(")
cambia("    var vp=m.dataset.vp,esc=vp==='esc';", "    var vp=m.dataset.vp,esc=vp==='esc',ancho=esc||vp==='ih';")
# Alertas: botones parejos lado a lado; si un rótulo no cabe, apilados a todo el ancho (principal arriba). Mensaje de una línea, centrado.
cambia("      var f=x.dataset.foco?x.querySelector('input,textarea'):x;f.focus({preventScroll:true})}",
       "      if(x.classList.contains('QQ-alerta')){var ap=x.querySelector('.QQ-al-p'),pp=x.querySelector('p');ap.classList.remove('QQ-apila');pp.classList.remove('QQ-una');\n"
       "        if([].some.call(ap.children,function(b){return b.scrollWidth>b.clientWidth+1}))ap.classList.add('QQ-apila');if(pp.offsetHeight<=22)pp.classList.add('QQ-una')}\n"
       "      var f=x.dataset.foco?x.querySelector('input,textarea'):x;f.focus({preventScroll:true})}")
cambia("c=esc?4:2,d=", "c=ancho?4:2,d=")
# Gestionar: acciones como botones
cambia("""<button type="button" class="QQ-p QQ-txt QQ-gs-ok">Guardar</button>""", """<button type="button" class="QQ-p QQ-prim QQ-gs-ok">Guardar</button>""")
cambia("""<button type="button" class="QQ-p QQ-txt" data-o="ren" """, """<button type="button" class="QQ-p QQ-mini QQ-tonal" data-o="ren" """)
cambia("""<button type="button" class="QQ-p QQ-txt" data-o="sob" """, """<button type="button" class="QQ-p QQ-mini QQ-tonal" data-o="sob" """)
cambia("""<button type="button" class="QQ-p QQ-txt QQ-rojo" data-o="eli" """, """<button type="button" class="QQ-p QQ-mini QQ-rojo-s" data-o="eli" """)
cambia("del('click','.QQ-pf-a .QQ-txt',", "del('click','.QQ-pf-a [data-o]',")
cambia("      $('.QQ-cf-ok').textContent=o==='eli'?'Eliminar':'Sobrescribir';abre('conf')});",
       "      var ci=$('.QQ-pan[data-pan=\"conf\"] .QQ-al-i');ci.className='QQ-al-i QQ-i-'+(o==='eli'?'mal':'ag');ci.innerHTML=o==='eli'?BAS28:AVI28;\n"
       "      var ck=$('.QQ-cf-ok');ck.className='QQ-p '+(o==='eli'?'QQ-bt QQ-rojo-s':'QQ-prim')+' QQ-cf-ok';ck.textContent=o==='eli'?'Eliminar':'Sobrescribir';abre('conf')});")
# Suplementación: catálogo sin buscador
cambia("""      function pintaCat(){var q=sinAc($('.QQ-cat-q').value.trim()),v=0;$$('.QQ-cat-l>li').forEach(function(li){var s=li.dataset.n,ok=!q||sinAc(s).indexOf(q)>=0;li.hidden=!ok;if(ok)v++;
          li.querySelector('.QQ-cat').setAttribute('aria-checked',String(st.sel.some(function(x){return x.n===s})))});$('.QQ-cat-0').hidden=v>0}""",
       """      function pintaCat(){$$('.QQ-cat-l>li').forEach(function(li){var s=li.dataset.n;
          li.querySelector('.QQ-cat').setAttribute('aria-checked',String(st.sel.some(function(x){return x.n===s})))})}""")
cambia("on('.QQ-b-cat','click',function(e){$('.QQ-cat-q').value='';pintaCat();abre(", "on('.QQ-b-cat','click',function(e){pintaCat();abre(")
cambia("      on('.QQ-cat-q','input',pintaCat);\n", "")
# Internamiento
cambia("""data-g="'+gi+'">Agregar renglón</button>""", """data-g="'+gi+'">'+PLUS_SVG+'Agregar renglón</button>""")
# Escrito: justificado por defecto; alineación dentro de «···» en teléfono
cambia("var bl=act&&nodo('h2')?'h2':act&&nodo('h3')?'h3':'p',al='left';for(var k in AL)if(k!=='left'&&q(AL[k][0]))al=k;",
       "var bl=act&&nodo('h2')?'h2':act&&nodo('h3')?'h3':'p',al='justify';for(var k in AL)if(q(AL[k][0]))al=k;")
cambia("        $$('[data-bl]').forEach(", "        $$('.QQ-al-v').forEach(function(v){v.textContent=AL[al][1];v.parentNode.querySelector('.QQ-mi').innerHTML=$('[data-al=\"'+al+'\"] .QQ-mi').innerHTML});\n        $$('[data-bl]').forEach(")
cambia("else if(f==='clear'){exe('removeFormat');exe('formatBlock','p');exe('justifyLeft')}",
       "else if(f==='clear'){exe('removeFormat');exe('formatBlock','p');var nb=nodo('p,div,li,blockquote');if(nb){nb.style.textAlign='';nb.removeAttribute('align');if(!nb.getAttribute('style'))nb.removeAttribute('style')}}")
cambia("      del('click','.QQ-pan .QQ-mr[data-f]',", "      del('click','.QQ-pan .QQ-mr[data-m]',function(e,b){abre(b.dataset.m)});\n      del('click','.QQ-pan .QQ-mr[data-f]',")
open(P, 'w').write(s); print('ok')
