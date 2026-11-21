# Genera vista-1-nuevo.html (.fn) y vista-2-editar.html (.fe) desde UNA plantilla (reglas de CALMA):
# grupos = una superficie con titulo fuera; campos = filas separadas por linea fina.
import os
L = os.path.dirname(os.path.abspath(__file__))

def ic(d, s=20, w=1.8):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{d}</svg>'

I = dict(
    inicio='<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    pac='<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    agenda='<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    docs='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mas='<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    plus='<path d="M12 5v14M5 12h14"/>',
    menu='<path d="M4 7h16M4 12h16M4 17h16"/>',
    logo='<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M9.6 8h4.8M9 11h6M9 14h6M9.6 17h4.8"/>',
    updown='<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    admin='<path d="M5 20v-8M12 20V5M19 20v-9"/>',
    yo='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.2c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
    atras='<path d="m15 5-7 7 7 7"/>',
    chev='<path d="m6 9 6 6 6-6"/>',
    check='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    persona='<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.6 3.6-5.5 7-5.5s6.1 1.9 7 5.5"/>',
    medico='<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.3 0 2.5.3 3.5.9M18 14v6M15 17h6"/>',
    telefono='<path d="M5 4h3.2l1.6 4.2-2.1 1.5a12 12 0 0 0 6.6 6.6l1.5-2.1L20 15.8V19a1.5 1.5 0 0 1-1.6 1.5C10.5 20 4 13.5 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
    regla='<path d="M3 16.5 16.5 3 21 7.5 7.5 21z"/><path d="m7 12.5 2 2M10 9.500l2 2M13 6.500l2 2"/>',
    porta='<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.500V4a1.500 1.500 0 0 1 1.500-1.500h3A1.500 1.500 0 0 1 15 4v.500M9 11h6M9 15h4"/>',
    escudo='<path d="M12 3 5 5.800v5.700c0 4.300 2.900 7.700 7 9.500 4.100-1.800 7-5.200 7-9.500V5.800z"/><path d="m9 12 2.200 2.200L15.200 10"/>',
    aviso='<path d="M12 4 2.800 19.500h18.400z"/><path d="M12 10v4.500M12 17.200h.01"/>',
    lado='<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 4.5v15"/>',
    hash='<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    error='<circle cx="12" cy="12" r="9"/><path d="M12 7.500v5.500M12 16.300h.01"/>',
)

CSS = r'''
/* ===== Formulario de paciente (__TIT__), reglas de CALMA. Todos los selectores empiezan por .PFX ===== */
.PFX .PFX-app{display:flex;width:100%;height:100%}
.PFX[data-vp="tel"] .PFX-app{flex-direction:column}
.PFX button{border:0;margin:0;padding:0;background:none;color:inherit}
.PFX h1,.PFX h2,.PFX p{margin:0;padding:0}
.PFX svg{flex:none}
.PFX .PFX-flex{flex:1}
.PFX .PFX-num{font-variant-numeric:tabular-nums}
.PFX [hidden]{display:none!important}
/* Variantes de la maqueta: m = solo médico, s = solo secretaria */
.PFX:not(.PFX-sec) .PFX-s{display:none!important}
.PFX.PFX-sec .PFX-m{display:none!important}
.PFX .PFX-p{transition:transform 100ms ease-out}
.PFX .PFX-p:active{transform:scale(.97)}
.PFX .PFX-p:focus-visible{outline:3px solid var(--enlace);outline-offset:2px}
.PFX .PFX-riel .PFX-p:focus-visible,.PFX .PFX-lat .PFX-p:focus-visible,.PFX .PFX-enc .PFX-p:focus-visible{outline-color:var(--nav-tinta)}

/* ---- Navegación (copiada del dashboard: riel, encabezado fundido, barras laterales) ---- */
.PFX .PFX-riel{position:relative;z-index:1;flex:none;width:calc(56px + var(--ir));padding:16px calc(var(--ir) + 8px) calc(var(--ib) + 10px) 8px;background:var(--navy);border-radius:26px 0 0 26px;box-shadow:var(--sombra-nav-der);display:flex;flex-direction:column;align-items:center;gap:8px}
.PFX .PFX-rb{width:48px;height:48px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--nav-tinta)}
.PFX .PFX-rb[aria-current="page"]{background:var(--accion);color:#fff}
.PFX .PFX-mas{width:52px;height:52px;flex:none;border-radius:999px;background:#fff;color:var(--accion);display:flex;align-items:center;justify-content:center;box-shadow:var(--sombra-accion)}
.PFX .PFX-enc{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:12px;padding:calc(var(--it) + 8px) 16px 12px;background:var(--navy);border-radius:0 0 26px 26px;box-shadow:var(--sombra-nav-sup);color:#fff}
.PFX .PFX-menu{width:44px;height:44px;flex:none;border-radius:12px;background:var(--nav-velo);color:#fff;display:flex;align-items:center;justify-content:center}
.PFX .PFX-enc-t{font-size:17px;line-height:22px;font-weight:700;color:#fff}
.PFX .PFX-av{display:flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:999px;background:var(--nav-avatar);color:var(--navy);font-size:13px;font-weight:700}
.PFX .PFX-av.PFX-av-g{width:44px;height:44px}
.PFX .PFX-lat{position:relative;z-index:1;flex:none;display:flex;flex-direction:column;background:var(--navy);color:#fff}
.PFX[data-vp="ih"] .PFX-lat{width:calc(218px + var(--ir));padding:16px calc(var(--ir) + 10px) calc(var(--ib) + 10px) 12px;border-radius:26px 0 0 26px;box-shadow:var(--sombra-nav-der)}
.PFX[data-vp="esc"] .PFX-lat{width:248px;padding:16px 12px 14px;border-radius:0 26px 26px 0;box-shadow:var(--sombra-nav-izq)}
.PFX .PFX-lat-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:36px;padding:0 4px 0 8px}
.PFX .PFX-logo{display:inline-flex;align-items:center;gap:8px;color:#fff}
.PFX .PFX-logo-n{font-size:17px;line-height:22px;font-weight:700;letter-spacing:-.2px}
.PFX .PFX-plan-c{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:var(--nav-velo);color:var(--nav-tinta);font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.PFX .PFX-cons-b{margin-top:12px;display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 10px;border-radius:14px;background:var(--nav-velo);color:#fff;text-align:left}
.PFX .PFX-cons-b svg{color:var(--nav-tinta2)}
.PFX .PFX-cons-t{flex:1;min-width:0;display:flex;flex-direction:column}
.PFX .PFX-cons-t span{font-size:13px;line-height:16px;color:var(--nav-tinta2)}
.PFX .PFX-cons-t b{font-size:15px;line-height:19px;font-weight:600}
.PFX .PFX-lista{margin-top:14px;display:flex;flex-direction:column;gap:2px}
.PFX .PFX-li{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;border-radius:12px;color:var(--nav-tinta);font-size:15px;line-height:20px;font-weight:500}
.PFX[data-vp="esc"] .PFX-li{height:40px;font-size:14px}
.PFX .PFX-li[aria-current="page"]{background:var(--accion);color:#fff;font-weight:600}
.PFX .PFX-lat-pie{border-top:1px solid var(--nav-velo);padding-top:8px}
.PFX .PFX-lat .PFX-yo{height:48px}
.PFX .PFX-yo>span{display:flex;flex-direction:column;line-height:17px}
.PFX .PFX-yo small{font-size:12px;line-height:16px;color:var(--nav-tinta2)}
.PFX[data-vp="ih"].PFX-sec .PFX-cons-b .PFX-av{display:none}

/* ---- Columna: contenido que se desplaza + barra fija (teléfono) ---- */
.PFX .PFX-col{position:relative;flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.PFX .PFX-cont{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;padding:4px 16px 20px}
.PFX[data-vp="tel"] .PFX-cont{padding-top:10px}
.PFX[data-vp="ih"] .PFX-cont{padding:12px 24px calc(var(--ib) + 20px)}
.PFX[data-vp="esc"] .PFX-cont{padding:20px 24px 32px}
/* Columna de formulario: CENTRADA en el área de contenido (CALMA §14); cabecera y pie viven dentro, así que comparten sus bordes */
.PFX .PFX-form{display:flex;flex-direction:column;gap:24px}
.PFX[data-vp="ih"] .PFX-form,.PFX[data-vp="iv"] .PFX-form,.PFX[data-vp="esc"] .PFX-form{gap:28px;max-width:680px;margin:0 auto}
.PFX .PFX-grupos,.PFX .PFX-adic{display:flex;flex-direction:column;gap:24px}
.PFX[data-vp="ih"] .PFX-grupos,.PFX[data-vp="iv"] .PFX-grupos,.PFX[data-vp="esc"] .PFX-grupos,.PFX[data-vp="ih"] .PFX-adic,.PFX[data-vp="iv"] .PFX-adic,.PFX[data-vp="esc"] .PFX-adic{gap:28px}

/* ---- Cabecera compacta: volver + título ---- */
.PFX .PFX-cab{display:flex;flex-direction:column;margin-bottom:-4px}
.PFX .PFX-volver{align-self:flex-start;display:inline-flex;align-items:center;gap:2px;min-height:44px;margin-left:-4px;padding-right:8px;font-size:13px;line-height:18px;font-weight:600;color:var(--enlace);white-space:nowrap}
.PFX .PFX-cab h1{font-size:26px;line-height:31px;font-weight:800;letter-spacing:-.6px}
.PFX[data-vp="ih"] .PFX-volver,.PFX[data-vp="iv"] .PFX-volver,.PFX[data-vp="esc"] .PFX-volver{min-height:36px}
.PFX[data-vp="ih"] .PFX-cab h1,.PFX[data-vp="iv"] .PFX-cab h1,.PFX[data-vp="esc"] .PFX-cab h1{font-size:32px;line-height:38px}

/* ---- Grupo: título fuera, UNA superficie, filas con línea fina ---- */
.PFX .PFX-gr{display:flex;flex-direction:column;gap:8px}
.PFX .PFX-gt{display:flex;align-items:center;gap:6px;padding:0 16px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--enlace)}
.PFX .PFX-sup{background:var(--sup);border-radius:16px}
.PFX .PFX-pieg{padding:0 16px;font-size:13px;line-height:18px;color:var(--tinta2)}
.PFX[data-vp="ih"] .PFX-gt,.PFX[data-vp="iv"] .PFX-gt,.PFX[data-vp="esc"] .PFX-gt,.PFX[data-vp="ih"] .PFX-pieg,.PFX[data-vp="iv"] .PFX-pieg,.PFX[data-vp="esc"] .PFX-pieg{padding:0 20px}
/* Fila = campo. Teléfono: etiqueta arriba, valor debajo. Sin relleno por campo. */
.PFX .PFX-f{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:56px;padding:8px 16px;border-radius:14px;cursor:text}
.PFX .PFX-f:not(:first-child)::before{content:"";position:absolute;top:0;left:16px;right:16px;height:1px;background:var(--linea)}
.PFX .PFX-f:has(.PFX-in:focus-visible){outline:2px solid var(--enlace);outline-offset:-2px}
.PFX .PFX-l{font-size:13px;line-height:18px;color:var(--tinta2)}
.PFX .PFX-ast{color:var(--mal-tinta)}
.PFX .PFX-c{display:flex;flex-direction:column;min-width:0}
.PFX .PFX-v{display:flex;align-items:center;gap:8px;min-width:0}
.PFX .PFX-in{flex:1;display:block;min-width:0;width:100%;height:24px;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:var(--tinta);font:inherit;font-size:16px;line-height:24px;outline:none;-webkit-appearance:none;appearance:none;text-overflow:ellipsis}
.PFX .PFX-in::placeholder{color:var(--tinta3);opacity:1}
.PFX textarea.PFX-in{height:auto;min-height:24px;field-sizing:content;resize:none;scrollbar-width:none}
.PFX select.PFX-in{padding-right:24px;cursor:pointer}
.PFX .PFX-selv{position:relative}
.PFX .PFX-selv svg{position:absolute;right:0;top:4px;color:var(--tinta2);pointer-events:none}
.PFX .PFX-ro{font-size:16px;line-height:24px;color:var(--tinta2)}
.PFX .PFX-adj{flex:none;font-size:15px;line-height:24px;color:var(--tinta2);white-space:nowrap}
.PFX .PFX-tag{flex:none;align-self:flex-start;display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:8px;background:var(--tonal);color:var(--tonal-tinta);font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.PFX .PFX-tag:empty{display:none}
.PFX .PFX-v>.PFX-tag{align-self:center}
.PFX .PFX-ay{font-size:13px;line-height:18px;color:var(--tinta2);margin-top:2px}
.PFX .PFX-msg{display:none;font-size:13px;line-height:18px;color:var(--mal-tinta);margin-top:2px}
.PFX .PFX-err .PFX-msg{display:block}
/* Fecha de nacimiento: edad a la derecha y alternativa como acción de texto */
.PFX .PFX-nac .PFX-in{flex:0 1 140px}
.PFX .PFX-nac .PFX-v{justify-content:space-between}
.PFX .PFX-alt{position:absolute;top:0;right:0;height:56px;padding:8px 16px 0 12px;display:flex;align-items:flex-start;font-size:13px;line-height:18px;font-weight:600;color:var(--enlace);white-space:nowrap;border-radius:14px}
.PFX .PFX-alt:focus-visible{outline:3px solid var(--enlace);outline-offset:-3px}
/* Sexo: segmentado bajo */
.PFX .PFX-sexo{padding-bottom:12px;cursor:default}
.PFX .PFX-seg{display:flex;gap:2px;padding:2px;margin-top:4px;border-radius:9px;background:var(--sup2)}
.PFX .PFX-seg label{position:relative;flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;height:28px;border-radius:7px;font-size:13px;line-height:18px;color:var(--tinta2);white-space:nowrap;cursor:pointer}
.PFX .PFX-seg input{position:absolute;left:0;top:-8px;width:100%;height:calc(100% + 16px);margin:0;opacity:0;cursor:pointer}
.PFX .PFX-seg label:has(input:checked){background:var(--sup);color:var(--tinta);font-weight:600}
.PFX .PFX-seg label:has(input:focus-visible){outline:2px solid var(--enlace);outline-offset:1px}
/* «Datos adicionales»: fila que despliega */
.PFX .PFX-masb{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:10px 16px;border-radius:16px;text-align:left}
.PFX .PFX-masb-t{flex:1;min-width:0;display:flex;flex-direction:column}
.PFX .PFX-masb-t b{font-size:15px;line-height:20px;font-weight:600;color:var(--tinta)}
.PFX .PFX-masb-t span{font-size:13px;line-height:18px;color:var(--tinta2)}
.PFX .PFX-masb>svg{color:var(--tinta2);transition:transform 200ms ease-out}
.PFX .PFX-masb[aria-expanded="true"]>svg{transform:rotate(180deg)}
.PFX .PFX-masb:focus-visible{outline-offset:-3px}
/* Consentimiento */
.PFX .PFX-f.PFX-chk{flex-direction:row;justify-content:flex-start;align-items:center;gap:12px;cursor:pointer}
.PFX .PFX-chk>input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.PFX .PFX-cj{width:22px;height:22px;flex:none;border-radius:6px;border:1.5px solid var(--tinta3);display:flex;align-items:center;justify-content:center;color:#fff}
.PFX .PFX-cj svg{opacity:0}
.PFX .PFX-chk>input:checked~.PFX-cj{background:var(--accion);border-color:var(--accion)}
.PFX .PFX-chk>input:checked~.PFX-cj svg{opacity:1}
.PFX .PFX-f.PFX-chk:has(input:focus-visible){outline:2px solid var(--enlace);outline-offset:-2px}
.PFX .PFX-esc{width:32px;height:32px;flex:none;border-radius:9px;background:var(--tonal);color:var(--tonal-tinta);display:flex;align-items:center;justify-content:center}
.PFX .PFX-chk>.PFX-c{flex:1}
.PFX .PFX-f.PFX-chk{min-height:60px}
.PFX .PFX-chk-t{font-size:15px;line-height:20px;color:var(--tinta)}
.PFX .PFX-chk-t a{position:relative;z-index:1;color:var(--enlace);font-weight:600}
.PFX .PFX-chk-t a::after{content:"";position:absolute;left:-4px;right:-4px;top:-13px;bottom:-13px}

/* ---- Botones: un primario; lo demás, texto ---- */
.PFX .PFX-prim{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border-radius:12px;background:var(--accion);color:#fff;font-size:15px;line-height:20px;font-weight:600;white-space:nowrap}
.PFX .PFX-prim[aria-busy="true"]{opacity:.6}
.PFX .PFX-txt{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 10px;border-radius:10px;font-size:15px;line-height:20px;font-weight:600;color:var(--enlace);white-space:nowrap}
.PFX .PFX-quieto,.PFX .PFX-tonal{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600;white-space:nowrap}
.PFX .PFX-quieto{background:var(--sup2);color:var(--tinta)}
.PFX .PFX-tonal{background:var(--tonal);color:var(--tonal-tinta)}
/* Barra fija al pie (teléfono) */
.PFX .PFX-barra{flex:none;display:flex;flex-direction:column;gap:6px;padding:8px 16px calc(var(--ib) + 10px);background:var(--fondo)}
.PFX .PFX-barra-f{display:flex;align-items:center;gap:8px}
.PFX[data-vp="ext"] .PFX-barra .PFX-quieto{padding:0 12px}
.PFX[data-vp="ext"] .PFX-barra .PFX-quieto,.PFX[data-vp="ext"] .PFX-barra .PFX-prim{font-size:14px}
.PFX .PFX-barra .PFX-prim{flex:1;min-width:0;padding:0 8px}
.PFX[data-vp="ih"] .PFX-barra,.PFX[data-vp="iv"] .PFX-barra,.PFX[data-vp="esc"] .PFX-barra{display:none}
/* Pie del formulario (ancho) */
.PFX .PFX-pie{display:none;flex-direction:column;gap:8px}
.PFX[data-vp="ih"] .PFX-pie,.PFX[data-vp="iv"] .PFX-pie,.PFX[data-vp="esc"] .PFX-pie{display:flex}
.PFX .PFX-pie-f{display:flex;align-items:center;justify-content:flex-end;gap:8px}
/* Plan bloqueado (nota de maqueta) */
.PFX .PFX-bloq{display:none;max-width:680px;margin:0 auto;padding-top:24px;font-size:14px;line-height:20px;color:var(--tinta2)}
.PFX.PFX-plan .PFX-bloq{display:block}
.PFX.PFX-plan .PFX-form,.PFX.PFX-plan .PFX-barra{display:none}

/* ---- Ancho (Duo abierto y computadora): etiqueta a la izquierda, valor a la derecha ---- */
.PFX[data-vp="ih"] .PFX-f,.PFX[data-vp="iv"] .PFX-f,.PFX[data-vp="esc"] .PFX-f{display:grid;grid-template-columns:180px minmax(0,1fr);column-gap:16px;align-items:center;min-height:48px;padding:6px 20px}
.PFX[data-vp="ih"] .PFX-f:not(:first-child)::before,.PFX[data-vp="iv"] .PFX-f:not(:first-child)::before,.PFX[data-vp="esc"] .PFX-f:not(:first-child)::before{left:20px;right:20px}
.PFX[data-vp="ih"] .PFX-l,.PFX[data-vp="iv"] .PFX-l,.PFX[data-vp="esc"] .PFX-l{font-size:14px;line-height:20px}
.PFX[data-vp="ih"] .PFX-in,.PFX[data-vp="iv"] .PFX-in,.PFX[data-vp="esc"] .PFX-in,.PFX[data-vp="ih"] .PFX-ro,.PFX[data-vp="iv"] .PFX-ro,.PFX[data-vp="esc"] .PFX-ro{font-size:14px;line-height:20px}
.PFX[data-vp="ih"] .PFX-in,.PFX[data-vp="iv"] .PFX-in,.PFX[data-vp="esc"] .PFX-in{height:36px}
.PFX[data-vp="ih"] textarea.PFX-in,.PFX[data-vp="iv"] textarea.PFX-in,.PFX[data-vp="esc"] textarea.PFX-in{height:auto;min-height:36px;padding:8px 0}
.PFX[data-vp="ih"] .PFX-ta,.PFX[data-vp="iv"] .PFX-ta,.PFX[data-vp="esc"] .PFX-ta{align-items:start}
.PFX[data-vp="ih"] .PFX-ta .PFX-l,.PFX[data-vp="iv"] .PFX-ta .PFX-l,.PFX[data-vp="esc"] .PFX-ta .PFX-l{padding-top:8px}
.PFX[data-vp="ih"] .PFX-selv svg,.PFX[data-vp="iv"] .PFX-selv svg,.PFX[data-vp="esc"] .PFX-selv svg{top:10px}
.PFX[data-vp="ih"] .PFX-adj,.PFX[data-vp="iv"] .PFX-adj,.PFX[data-vp="esc"] .PFX-adj{font-size:14px;line-height:20px}
.PFX[data-vp="ih"] .PFX-ay,.PFX[data-vp="iv"] .PFX-ay,.PFX[data-vp="esc"] .PFX-ay,.PFX[data-vp="ih"] .PFX-msg,.PFX[data-vp="iv"] .PFX-msg,.PFX[data-vp="esc"] .PFX-msg{margin:0 0 6px}
.PFX[data-vp="ih"] .PFX-nac .PFX-in,.PFX[data-vp="iv"] .PFX-nac .PFX-in,.PFX[data-vp="esc"] .PFX-nac .PFX-in{flex:0 0 96px}
.PFX[data-vp="ih"] .PFX-nac .PFX-v,.PFX[data-vp="iv"] .PFX-nac .PFX-v,.PFX[data-vp="esc"] .PFX-nac .PFX-v{justify-content:flex-start;gap:12px}
.PFX[data-vp="ih"] .PFX-alt,.PFX[data-vp="iv"] .PFX-alt,.PFX[data-vp="esc"] .PFX-alt{position:static;height:36px;margin:0 -8px 0 auto;padding:0 8px;align-items:center;border-radius:10px}
.PFX[data-vp="ih"] .PFX-sexo,.PFX[data-vp="iv"] .PFX-sexo,.PFX[data-vp="esc"] .PFX-sexo{padding-bottom:6px}
.PFX[data-vp="ih"] .PFX-seg,.PFX[data-vp="iv"] .PFX-seg,.PFX[data-vp="esc"] .PFX-seg{margin:0;max-width:300px}
.PFX[data-vp="ih"] .PFX-seg label,.PFX[data-vp="iv"] .PFX-seg label,.PFX[data-vp="esc"] .PFX-seg label{height:26px}
.PFX[data-vp="ih"] .PFX-seg input,.PFX[data-vp="iv"] .PFX-seg input,.PFX[data-vp="esc"] .PFX-seg input{top:-5px;height:calc(100% + 10px)}
.PFX[data-vp="ih"] .PFX-f.PFX-chk,.PFX[data-vp="iv"] .PFX-f.PFX-chk,.PFX[data-vp="esc"] .PFX-f.PFX-chk{display:flex}
.PFX[data-vp="ih"] .PFX-chk-t,.PFX[data-vp="iv"] .PFX-chk-t,.PFX[data-vp="esc"] .PFX-chk-t{font-size:14px}
.PFX[data-vp="ih"] .PFX-chk .PFX-msg,.PFX[data-vp="iv"] .PFX-chk .PFX-msg,.PFX[data-vp="esc"] .PFX-chk .PFX-msg{margin:2px 0 0}
.PFX[data-vp="ih"] .PFX-chk-t a::after,.PFX[data-vp="iv"] .PFX-chk-t a::after,.PFX[data-vp="esc"] .PFX-chk-t a::after{top:-10px;bottom:-10px}
.PFX[data-vp="ih"] .PFX-masb,.PFX[data-vp="iv"] .PFX-masb,.PFX[data-vp="esc"] .PFX-masb{padding:10px 20px}
.PFX[data-vp="ih"] .PFX-masb-t b,.PFX[data-vp="iv"] .PFX-masb-t b,.PFX[data-vp="esc"] .PFX-masb-t b{font-size:14px}
.PFX[data-vp="ih"] .PFX-prim,.PFX[data-vp="iv"] .PFX-prim,.PFX[data-vp="esc"] .PFX-prim{height:36px;border-radius:10px;font-size:14px}
.PFX[data-vp="ih"] .PFX-txt,.PFX[data-vp="iv"] .PFX-txt,.PFX[data-vp="esc"] .PFX-txt{min-height:36px;font-size:14px}
.PFX[data-vp="ih"] .PFX-quieto,.PFX[data-vp="iv"] .PFX-quieto,.PFX[data-vp="esc"] .PFX-quieto,.PFX[data-vp="ih"] .PFX-tonal,.PFX[data-vp="iv"] .PFX-tonal,.PFX[data-vp="esc"] .PFX-tonal{height:36px;border-radius:10px;font-size:14px}
.PFX[data-vp="ih"] .PFX-f.PFX-chk,.PFX[data-vp="iv"] .PFX-f.PFX-chk,.PFX[data-vp="esc"] .PFX-f.PFX-chk{min-height:56px}

/* ---- Capa única (CALMA §13): alerta con icono en círculo tintado, título, mensaje y BOTONES. Hoja en teléfono; tarjeta centrada en el área de contenido en ancho ---- */
.PFX .PFX-capa{position:absolute;inset:0;z-index:20;visibility:hidden;transition:visibility 0s linear 320ms}
.PFX .PFX-capa.PFX-on{visibility:visible;transition-delay:0s}
.PFX .PFX-velo{position:absolute;inset:0;background:var(--velo);backdrop-filter:blur(10px) saturate(140%);-webkit-backdrop-filter:blur(10px) saturate(140%);opacity:0;transition:opacity 320ms cubic-bezier(.32,.72,0,1)}
.PFX .PFX-on .PFX-velo{opacity:1}
.PFX .PFX-hoja{position:absolute;left:0;right:var(--ir);bottom:0;background:var(--sup);border-radius:22px 22px 0 0;box-shadow:var(--sombra-capa);padding:0 20px calc(var(--ib) + 12px);display:flex;flex-direction:column;transform:translateY(100%);transition:transform 320ms cubic-bezier(.32,.72,0,1);outline:none}
.PFX .PFX-on .PFX-hoja{transform:none}
.PFX .PFX-asa{display:block;flex:none;width:36px;height:5px;border-radius:999px;background:var(--borde);margin:8px auto 16px}
.PFX .PFX-aic{align-self:center;flex:none;width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.PFX .PFX-aic-av{background:var(--ag-fondo);color:var(--ag-tinta)}
.PFX .PFX-aic-mal{background:var(--mal-fondo);color:var(--mal-tinta)}
.PFX .PFX-atit{font-size:17px;line-height:22px;font-weight:700;text-align:center;color:var(--tinta)}
.PFX .PFX-hjtx{margin-top:8px;font-size:14px;line-height:20px;color:var(--tinta2);text-align:justify;hyphens:auto;-webkit-hyphens:auto}
.PFX .PFX-hjtx.PFX-hjc{text-align:center;hyphens:manual;-webkit-hyphens:manual;text-wrap:balance}
.PFX .PFX-hjtx:empty{display:none}
.PFX .PFX-hjc .PFX-num{white-space:nowrap}
.PFX .PFX-abot{display:flex;flex-direction:column;gap:8px;margin-top:20px}
.PFX .PFX-abot .PFX-p{width:100%;min-width:0}
.PFX .PFX-capa:not(.PFX-kgen) .PFX-vgen,.PFX .PFX-capa:not(.PFX-kmio) .PFX-vmio,.PFX .PFX-capa:not(.PFX-ksrv) .PFX-vsrv,.PFX .PFX-capa.PFX-ksrv .PFX-vdup{display:none}
/* Ancho: centrada en horizontal y vertical dentro del área de contenido (sin la barra lateral) */
.PFX[data-vp="ih"] .PFX-capa,.PFX[data-vp="iv"] .PFX-capa,.PFX[data-vp="esc"] .PFX-capa{display:flex;align-items:center;justify-content:center}
.PFX[data-vp="esc"] .PFX-capa{padding-left:248px}
.PFX[data-vp="ih"] .PFX-capa{padding-right:calc(218px + var(--ir));padding-bottom:var(--ib)}
.PFX[data-vp="ih"] .PFX-hoja,.PFX[data-vp="iv"] .PFX-hoja,.PFX[data-vp="esc"] .PFX-hoja{position:relative;left:auto;right:auto;bottom:auto;flex:none;width:340px;border-radius:20px;padding:24px;opacity:0;transform:translateY(12px) scale(.97);transition:transform 320ms cubic-bezier(.32,.72,0,1),opacity 320ms cubic-bezier(.32,.72,0,1)}
.PFX[data-vp="ih"] .PFX-on .PFX-hoja,.PFX[data-vp="iv"] .PFX-on .PFX-hoja,.PFX[data-vp="esc"] .PFX-on .PFX-hoja{opacity:1;transform:none}
.PFX[data-vp="ih"] .PFX-asa,.PFX[data-vp="iv"] .PFX-asa,.PFX[data-vp="esc"] .PFX-asa{display:none}
.PFX[data-vp="ih"] .PFX-abot .PFX-p,.PFX[data-vp="iv"] .PFX-abot .PFX-p,.PFX[data-vp="esc"] .PFX-abot .PFX-p{height:40px;border-radius:12px}
@media (prefers-reduced-transparency:reduce){.PFX .PFX-velo{backdrop-filter:none;-webkit-backdrop-filter:none;background:linear-gradient(var(--velo),var(--velo)),var(--velo)}}

/* ---- Tercera revisión (CALMA §17-22) ---- */
/* Duo abierto vertical: encabezado fundido con pista de secciones (maqueta de referencia del dueño) */
.PFX[data-vp="iv"] .PFX-app{flex-direction:column}
.PFX .PFX-encv .PFX-p:focus-visible{outline-color:var(--nav-tinta)}
.PFX .PFX-encv{position:relative;z-index:1;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(var(--it) + 0px) 16px 14px;background:var(--navy);border-radius:0 0 26px 26px;box-shadow:var(--sombra-nav-sup)}
.PFX .PFX-lado{width:44px;height:44px;flex:none;border-radius:999px;background:var(--nav-velo);color:#fff;display:flex;align-items:center;justify-content:center}
.PFX .PFX-pista{display:flex;align-items:center;gap:2px;padding:4px;border-radius:26px;background:var(--nav-velo)}
.PFX .PFX-pi{position:relative;display:flex;align-items:center;height:40px;padding:0 14px;border-radius:20px;color:var(--nav-tinta);font-size:15px;line-height:20px;font-weight:500;white-space:nowrap}
.PFX .PFX-pi::after{content:"";position:absolute;inset:-2px 0}
.PFX .PFX-pi[aria-current="page"]{padding:0 16px;background:var(--accion);color:#fff;font-weight:600}
/* Duo abierto vertical: la composición de ancho en una columna de 600 centrada; táctil (áreas de 44, texto de campo a 16) */
.PFX[data-vp="iv"] .PFX-cont{padding:20px 24px calc(var(--ib) + 24px)}
.PFX[data-vp="iv"] .PFX-form{max-width:600px}
.PFX[data-vp="iv"] .PFX-volver{min-height:44px}
.PFX[data-vp="iv"] .PFX-f{grid-template-columns:176px minmax(0,1fr);min-height:52px;padding:4px 20px}
.PFX[data-vp="iv"] .PFX-l{font-size:15px}
.PFX[data-vp="iv"] .PFX-in,.PFX[data-vp="iv"] .PFX-ro{font-size:16px;line-height:24px}
.PFX[data-vp="iv"] .PFX-in{height:44px}
.PFX[data-vp="iv"] textarea.PFX-in{min-height:44px;padding:10px 0}
.PFX[data-vp="iv"] .PFX-ta .PFX-l{padding-top:12px}
.PFX[data-vp="iv"] .PFX-selv svg{top:14px}
.PFX[data-vp="iv"] .PFX-adj{font-size:16px}
.PFX[data-vp="iv"] .PFX-nac .PFX-in{flex:0 0 110px}
.PFX[data-vp="iv"] .PFX-alt{height:44px}
.PFX[data-vp="iv"] .PFX-sexo{padding-bottom:8px;padding-top:8px}
.PFX[data-vp="iv"] .PFX-seg label{height:34px;font-size:14px}
.PFX[data-vp="iv"] .PFX-seg input{top:-5px;height:calc(100% + 10px)}
.PFX[data-vp="iv"] .PFX-chk-t{font-size:15px}
.PFX[data-vp="iv"] .PFX-chk-t a::after{top:-13px;bottom:-13px}
.PFX[data-vp="iv"] .PFX-masb-t b{font-size:15px}
.PFX[data-vp="iv"] .PFX-prim,.PFX[data-vp="iv"] .PFX-quieto,.PFX[data-vp="iv"] .PFX-tonal{height:44px;border-radius:12px;font-size:15px}
.PFX[data-vp="iv"] .PFX-pie-f .PFX-p{min-width:104px}
/* CALMA §23.1: en iv el par va CENTRADO en la columna (el navegador flota controles en las esquinas inferiores) */
.PFX[data-vp="iv"] .PFX-pie-f{justify-content:center}
/* Capas (CALMA §18, §19, §21): alerta centrada en todos los marcos; 320 en teléfono, 340 en ancho; en ih, mismos anchos y botones que en computadora */
.PFX[data-vp="iv"] .PFX-capa{padding-top:var(--it);padding-bottom:var(--ib)}
.PFX[data-vp="iv"] .PFX-abot .PFX-p{height:44px}
.PFX[data-vp="ext"] .PFX-capa,.PFX[data-vp="tel"] .PFX-capa{display:flex;align-items:center;justify-content:center;padding:var(--it) var(--ir) var(--ib) 0}
.PFX[data-vp="ext"] .PFX-hoja,.PFX[data-vp="tel"] .PFX-hoja{position:relative;left:auto;right:auto;bottom:auto;flex:none;width:320px;border-radius:20px;padding:24px;opacity:0;transform:translateY(12px) scale(.97);transition:transform 320ms cubic-bezier(.32,.72,0,1),opacity 320ms cubic-bezier(.32,.72,0,1)}
.PFX[data-vp="ext"] .PFX-on .PFX-hoja,.PFX[data-vp="tel"] .PFX-on .PFX-hoja{opacity:1;transform:none}
.PFX[data-vp="ext"] .PFX-asa,.PFX[data-vp="tel"] .PFX-asa{display:none}
/* El folio no se parte por su guion al estrecharse la alerta */
/* Mensaje de duplicado: alineado a la izquierda, sin justificar, para que el folio entero no abra ríos */
.PFX .PFX-hjtx.PFX-vgen{text-align:left;hyphens:manual;-webkit-hyphens:manual}
.PFX .PFX-hjtx .PFX-num{white-space:nowrap}
/* Tres botones (duplicado, en sus dos variantes): principal y secundario lado a lado —secundario a la izquierda—, «Cancelar» quieto debajo (CALMA §13, §21) */
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-tonal{order:-1}
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-quieto{grid-column:1/-1}
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-prim,.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-tonal{height:auto;min-height:52px;padding:6px 10px;white-space:normal;text-align:center;line-height:18px;font-size:14px}
/* CALMA §23.3 y §23.7: en TODOS los marcos, los tres apilados a todo el ancho, principal arriba */
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot{display:flex;flex-direction:column}
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-tonal{order:0}
.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-prim,.PFX .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-tonal{height:44px;min-height:0;padding:0 12px;white-space:nowrap;line-height:20px}
.PFX[data-vp="ih"] .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-p,.PFX[data-vp="esc"] .PFX-capa:not(.PFX-ksrv) .PFX-abot .PFX-p{height:40px}

/* ---- Pasada final ---- */
/* Obligatorio vacío: la fila se marca en rojo (el texto lo pone hoy el navegador) */
.PFX .PFX-err .PFX-l{color:var(--mal-tinta)}
.PFX .PFX-err .PFX-msg:empty{display:none}
/* Aviso del número de expediente, como fila de lectura a todo el ancho */
.PFX .PFX-avn-t{display:flex;align-items:center;gap:8px;font-size:14px;line-height:20px;color:var(--tinta2)}
.PFX .PFX-avn-t svg{color:var(--enlace)}
.PFX[data-vp="ih"] .PFX-avn-t,.PFX[data-vp="iv"] .PFX-avn-t,.PFX[data-vp="esc"] .PFX-avn-t{grid-column:1/-1}
/* Duo cerrado (CALMA §26, PASADA-FINAL §3): alerta de 310 centrada en el área de contenido, sin riel ni franja */
.PFX[data-vp="ext"] .PFX-capa{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.PFX[data-vp="ext"] .PFX-hoja{width:310px;max-width:100%}
.PFX-tira p{flex-basis:100%;margin:2px 0 0;font-weight:400;color:var(--tinta2)}
.PFX button.PFX-pi{height:44px;margin:-2px 0}
.PFX button.PFX-pi::after{content:none}
/* ---- Tira de controles de la maqueta: vive FUERA del marco ---- */
.PFX-tira{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;font:600 12px/16px var(--fuente);color:var(--tinta2)}
.PFX-tira span{margin-right:2px;letter-spacing:.3px;text-transform:uppercase}
.PFX-tira button{height:28px;padding:0 10px;border:1px dashed var(--tinta3);border-radius:999px;background:transparent;color:var(--tinta2);font:inherit;cursor:pointer}
.PFX-tira button:hover{color:var(--tinta);border-color:var(--tinta2)}
.PFX-tira button[aria-pressed="true"]{background:var(--sup2);color:var(--tinta)}
.PFX-tira button:focus-visible{outline:3px solid var(--enlace);outline-offset:2px}

@media (prefers-reduced-motion:reduce){
.PFX .PFX-hoja,.PFX[data-vp="ih"] .PFX-hoja,.PFX[data-vp="iv"] .PFX-hoja,.PFX[data-vp="esc"] .PFX-hoja{transform:none;opacity:0;transition:opacity 200ms ease}
.PFX .PFX-on .PFX-hoja{opacity:1}
.PFX .PFX-velo{transition:opacity 200ms ease}
.PFX .PFX-capa{transition:visibility 0s linear 200ms}
.PFX .PFX-p,.PFX .PFX-masb>svg{transition:none}
}
'''

import importlib.util as _iu
_sp = _iu.spec_from_file_location('cromo_u2', '/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/tools/tmp-u2-cromo.py')
_CM = _iu.module_from_spec(_sp); _sp.loader.exec_module(_CM)
CR = _CM.piezas('PFX', 'PFX-menu')
AVS = '<button type="button" class="PFX-p PFX-av PFX-av-g PFX-m" aria-label="Mi perfil">AS</button><button type="button" class="PFX-p PFX-av PFX-av-g PFX-s" aria-label="Ajustes" data-abre-mas>SE</button>'

def riel():
    def rb(k, lab, cur=False, cls=''):
        return f'<a href="#" class="PFX-p PFX-rb{cls}" aria-label="{lab}"{" aria-current=\"page\"" if cur else ""}>{ic(I[k],22,3 if k=="mas" else 1.8)}</a>'
    return ('<nav class="PFX-riel" aria-label="Navegación principal">\n  ' + rb('inicio','Inicio') + rb('pac','Expediente',True) + rb('agenda','Agenda')
        + rb('docs','Documentos',cls=' PFX-m') + f'<button type="button" class="PFX-p PFX-rb" aria-label="Más" data-abre-mas>{ic(I["mas"],22,3)}{CR.BDG}</button>' + '\n  <span class="PFX-flex"></span>\n'
        + f'  <button type="button" class="PFX-p PFX-mas PFX-m" aria-label="Nueva consulta">{ic(I["plus"],26,2.4)}</button>\n'
        + f'  <button type="button" class="PFX-p PFX-mas PFX-s" aria-label="Agendar cita">{ic(I["plus"],26,2.4)}</button>\n</nav>')

def enc():
    return (f'<header class="PFX-enc">\n  <button type="button" class="PFX-p PFX-menu" aria-label="Menú">{ic(I["menu"],22,2)}{CR.BDG}</button>\n'
        '  <span class="PFX-enc-t">Expediente</span>\n  <span class="PFX-flex"></span>\n'
        f'  {AVS}\n</header>')

def encv():
    def pi(t, cur=False, cls=''):
        return f'<a href="#" class="PFX-p PFX-pi{cls}"{" aria-current=\"page\"" if cur else ""}>{t}</a>'
    return ('<!-- Duo abierto vertical (CALMA §19): encabezado fundido; «Mostrar barra lateral» abre el menú completo (Administración, Mi perfil, Ayuda); «Más» abre el mismo menú que el «···» del riel (CALMA §23.9). -->\n'
        f'<header class="PFX-encv">\n  <button type="button" class="PFX-p PFX-lado" aria-label="Mostrar barra lateral">{ic(I["lado"],20)}{CR.BDG}</button>\n'
        '  <nav class="PFX-pista" aria-label="Navegación principal">' + pi('Inicio') + pi('Expediente',True) + pi('Agenda') + pi('Documentos',cls=' PFX-m') + '<button type="button" class="PFX-p PFX-pi" aria-haspopup="dialog" data-abre-mas>Más</button></nav>\n'
        f'  {AVS}\n</header>')

def lat(vp):
    def li(k, t, cur=False, cls=''):
        return f'<a href="#" class="PFX-p PFX-li{cls}"{" aria-current=\"page\"" if cur else ""}>{ic(I[k])}{t}</a>'
    return ('<nav class="PFX-lat" aria-label="Navegación principal">\n'
        f'  <div class="PFX-lat-cab"><span class="PFX-logo">{ic(I["logo"],24)}<span class="PFX-logo-n">Spinus</span></span><span class="PFX-plan-c PFX-m">Plan VIP</span></div>\n'
        f'  <button type="button" class="PFX-p PFX-cons-b">{CR.CLOGO}<span class="PFX-cons-t"><span class="PFX-m">Consultorio</span><b class="PFX-m">Centro</b><span class="PFX-s">Clínica</span><b class="PFX-s">Clínica Semilla A</b></span>{ic(I["updown"],16,2)}</button>\n'
        '  <div class="PFX-lista">' + li('inicio','Inicio') + li('pac','Expediente',True) + li('agenda','Agenda') + li('docs','Documentos',cls=' PFX-m') + li('admin','Administración',cls=' PFX-m') + '</div>\n'
        '  <span class="PFX-flex"></span>\n'
        + '<!-- Aviso «N datos pendientes» (solo médico; plegado en Duo abierto) y pie de hoy: médico «Mi perfil · Ajustes» + Ayuda; secretaria «Ajustes». -->\n'
        + CR.ap(vp, 'lat') + '\n  ' + CR.PIE + '\n</nav>')

AST = ' <span class="PFX-ast" aria-hidden="true">*</span>'
def msg(t=''): return f'<span class="PFX-msg" role="alert">{t}</span>'

def fila(lab, name, ph='', val='', req=False, tipo='text', mode='', extra='', err=None, ay='', num=False):
    return (f'<label class="PFX-f" data-c="{name}"><span class="PFX-l">{lab}{AST if req else ""}</span><span class="PFX-c">'
        f'<span class="PFX-v"><input class="PFX-in{" PFX-num" if num else ""}" type="{tipo}" name="{name}" placeholder="{ph}" value="{val}"{" aria-required=\"true\"" if req else ""}{f" inputmode=\"{mode}\"" if mode else ""} autocomplete="off"{extra}></span>'
        f'{msg(err) if err is not None else ""}{f"<span class=\"PFX-ay\">{ay}</span>" if ay else ""}</span></label>')

def area(lab, name, ph, val=''):
    return (f'<label class="PFX-f PFX-ta" data-c="{name}"><span class="PFX-l">{lab}</span><span class="PFX-c">'
            f'<textarea class="PFX-in" name="{name}" rows="2" placeholder="{ph}">{val}</textarea></span></label>')

def grupo(tit, filas, cls='', ico='persona'):
    return f'<section class="PFX-gr{cls}"><h2 class="PFX-gt">{ic(I[ico],16,2)}{tit}</h2><div class="PFX-sup">' + ''.join(filas) + '</div></section>'

def vista(nuevo, vp):
    d = {} if nuevo else dict(nombre='Paciente', apellidos='Prueba 07', fecha='14/03/1983', sexo='F', exp='EXP-2026-0007', tel='999 000 0007',
        email='paciente.07@semilla.spinus.test', peso='68', talla='165', alergias='Penicilina',
        ant_patologicos='Hipertensión arterial en control', ant_quirurgicos='Artroscopia de rodilla derecha (2021)', medicamentos_actuales='Losartán 50 mg cada 24 h')
    g = lambda k: d.get(k, '')
    ej = '' if nuevo else 'Ej: '   # Editar antepone «Ej: » a sus ejemplos; se copian tal cual de cada pantalla
    o = []
    # --- Cabecera (A4.1 / A8.1) ---
    o.append(f'<header class="PFX-cab"><a href="#" class="PFX-p PFX-volver">{ic(I["atras"],16,2.2)}Expediente</a><h1>{"Nuevo paciente" if nuevo else "Editar paciente"}</h1></header>')
    o.append('<form class="PFX-grupos" novalidate>')
    # --- Asignación (A4.3): solo secretaria ---
    if nuevo:
        o.append('<!-- A4.3 Médico responsable: solo secretaria. Si la lista llega vacía, la línea de ayuda de la fila dice (texto de hoy): «No hay médicos disponibles. Si estás sin conexión, conéctate al menos una vez para sincronizar la lista.» -->')
        o.append(grupo('Asignación', [
            f'<label class="PFX-f" data-c="medico"><span class="PFX-l">Médico responsable{AST}</span><span class="PFX-c"><span class="PFX-v PFX-selv"><select class="PFX-in" name="medico" aria-required="true">'
            '<option value="">Seleccionar médico...</option><option>Dr. Admin Semilla — Ortopedia y Traumatología</option><option>Dra. Invitada Semilla — Ortopedia y Traumatología</option>'
            f'</select>{ic(I["chev"],16,2)}</span>{msg("Debes seleccionar un médico para asignar el paciente")}</span></label>'], ' PFX-s', 'medico'))
    # --- Datos del paciente (A4.2, 4, 5, 6 / A8.2) ---
    f = []
    f.append(fila('Nombre(s)', 'nombre', ej + 'Juan Carlos', g('nombre'), True, err=''))
    f.append(fila('Apellidos', 'apellidos', ej + 'García López', g('apellidos'), True, err=''))
    edadr = '<output class="PFX-adj PFX-num PFX-edadr" aria-live="polite"></output>'
    fin = f'<input class="PFX-in PFX-num PFX-fecha" type="text" name="fecha" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" value="{g("fecha")}" aria-label="Fecha de nacimiento" autocomplete="off">'
    if nuevo:
        f.append('<!-- A4.5 Como hoy (nuevo/page.tsx:276-289): «Fecha de nacimiento» y, como alternativa, «Edad (opcional)» con su ayuda. En la app la fecha es el selector nativo (type=date); aquí se dibuja como texto para que salga en español. -->'
            f'<label class="PFX-f PFX-nac" data-c="fecha"><span class="PFX-l">Fecha de nacimiento</span><span class="PFX-c"><span class="PFX-v">{fin}{edadr}</span>{msg()}</span></label>'
            '<label class="PFX-f" data-c="edad"><span class="PFX-l">Edad (opcional)</span><span class="PFX-c"><span class="PFX-v"><input class="PFX-in PFX-num PFX-edad" type="text" name="edad" inputmode="numeric" maxlength="3" placeholder="Ej. 35" autocomplete="off"></span>'
            '<span class="PFX-ay">Si no conoces la fecha exacta, ingresa solo la edad</span></span></label>')
    else:
        f.append('<!-- A8.2 Fecha de nacimiento con su nota (texto de hoy). Editar no ofrece «solo la edad»; no se inventa. -->'
            f'<label class="PFX-f PFX-nac" data-c="fecha"><span class="PFX-l">Fecha de nacimiento</span><span class="PFX-c"><span class="PFX-v">{fin}{edadr}</span>{msg()}'
            '<span class="PFX-ay">Recomendable para que la edad aparezca en recetas y documentos. Si se deja vacío, el campo edad quedará en blanco.</span></span></label>')
    def rad(v, t): return f'<label><input type="radio" name="PFX-sexo-{vp}" value="{v}"{" checked" if g("sexo")==v else ""}>{t}</label>'
    f.append(f'<div class="PFX-f PFX-sexo" data-c="sexo"><span class="PFX-l">Sexo{AST}</span><span class="PFX-c"><span class="PFX-seg" role="radiogroup" aria-label="Sexo" aria-required="true">'
             + rad('M','Masculino') + rad('F','Femenino') + rad('Otro','Otro') + f'</span>{msg()}</span></div>')
    if nuevo:
        f.append('<!-- A4.2 Aviso del número de expediente: fila de solo lectura, ya no un banner. -->'
                 f'<div class="PFX-f PFX-avn" style="cursor:default"><span class="PFX-avn-t">{ic(I["hash"],16,2)}El número de expediente se genera automáticamente al guardar</span></div>')
    else:
        f.append('<!-- A8.2 N° Expediente: campo EDITABLE, como hoy. -->' + fila('N° Expediente', 'numero_expediente', 'Ej: OI-2025-001', g('exp'), num=True))
    o.append(grupo('Datos del paciente' if nuevo else 'Datos personales', f))
    # --- Datos adicionales (A4.7): plegado por defecto en Nuevo ---
    if nuevo:
        o.append('<!-- A4.7 «Datos adicionales», cerrada por defecto; abre los tres grupos de abajo. El aviso de hoy sobre el correo queda como pie del grupo mientras está cerrada. -->'
            '<section class="PFX-gr"><div class="PFX-sup"><button type="button" class="PFX-p PFX-masb" aria-expanded="false"><span class="PFX-masb-t"><b>Datos adicionales</b>'
            '<span>Contacto, antropometría y antecedentes — puedes completarlos después</span></span>'
            f'{ic(I["chev"],20,2)}</button></div><p class="PFX-pieg PFX-pie-correo">Para poder enviarle documentos al paciente, agrega su email en los datos adicionales</p></section><div class="PFX-adic" hidden>')
    else:
        o.append('<div class="PFX-adic">')
    # Contacto (A4.8 / A8.4)
    o.append(grupo('Contacto', [
        fila('Teléfono', 'tel', ej + '999 123 4567', g('tel'), tipo='tel', mode='numeric', extra=' maxlength="12"', err='El teléfono debe tener 10 dígitos', num=True),
        fila('Email', 'email', 'paciente@email.com', g('email'), tipo='email', err='Correo electrónico no válido', ay='Necesario para enviar documentos' if nuevo else ''),
        fila('Dirección', 'direccion', 'Calle, colonia, ciudad', g('direccion'))], ico='telefono'))
    # Antropometría (A4.9 / A8.3)
    o.append(grupo('Antropometría', [
        fila('Peso (kg)', 'peso', '70', g('peso'), mode='decimal', num=True, extra=' data-k="peso"'),
        fila('Talla (cm o m)', 'talla', '170 ó 1.70', g('talla'), mode='decimal', num=True, extra=' data-k="talla"'),
        '<!-- IMC: como hoy, solo aparece cuando hay peso y talla. --><div class="PFX-f PFX-imc-f" style="cursor:default" hidden><span class="PFX-l">IMC calculado</span><span class="PFX-c"><output class="PFX-tag PFX-num PFX-imc" aria-live="polite"></output></span></div>'], ico='regla'))
    # Antecedentes (A4.10 / A8.5)
    o.append(grupo('Antecedentes', [area(a, k, ph, g(k)) for a, k, ph in [
        ('Alergias','alergias','Medicamentos, alimentos...'),
        ('Antecedentes personales no patológicos','ant_no_patologicos','Tabaquismo, alcoholismo, actividad física, alimentación...'),
        ('Antecedentes patológicos','ant_patologicos','DM2, HTA, hipotiroidismo...'),
        ('Antecedentes quirúrgicos','ant_quirurgicos','Cirugías previas...'),
        ('Antecedentes familiares','ant_familiares','Enfermedades relevantes en familia...'),
        ('Medicamentos actuales','medicamentos_actuales','Lista de medicamentos...')]], ico='porta'))
    o.append('</div>')
    # Consentimiento (A4.12): solo al crear
    if nuevo:
        o.append('<!-- A4.12 Consentimiento de privacidad: casilla, texto y enlace de hoy, tal cual. No se redacta texto legal. -->'
            f'<section class="PFX-gr"><div class="PFX-sup"><label class="PFX-f PFX-chk" data-c="priv"><input type="checkbox" name="priv" aria-required="true"><span class="PFX-esc">{ic(I["escudo"],18,1.8)}</span>'
            f'<span class="PFX-c"><span class="PFX-chk-t">Paciente informado del <a href="#">aviso de privacidad</a>{AST}</span>{msg("Debes marcar el consentimiento del aviso de privacidad")}</span><span class="PFX-cj">{ic(I["check"],14,3)}</span></label></div></section>')
    lab = 'Registrar e ir al expediente' if nuevo else 'Guardar cambios'
    o.append(f'<div class="PFX-pie"><div class="PFX-pie-f"><a href="#" class="PFX-p PFX-quieto">Cancelar</a>'
             f'<button type="submit" class="PFX-p PFX-prim PFX-envia">{lab}</button></div></div>')
    o.append('</form>')
    bloq = ''   # A4.15 Plan bloqueado: el layout redirige a /billing antes de pintar; la nota vive en la tira, fuera del marco
    barra = (f'<div class="PFX-barra"><div class="PFX-barra-f"><a href="#" class="PFX-p PFX-quieto">Cancelar</a>'
             f'<button type="button" class="PFX-p PFX-prim PFX-envia">{lab}</button></div></div>')
    col = f'<div class="PFX-col">\n<main class="PFX-cont"><div class="PFX-form">\n' + '\n'.join(o) + f'\n</div>{bloq}</main>\n{barra}\n</div>'
    # --- Capa única: alerta (CALMA §13). Duplicado solo en Nuevo; error del servidor en las dos. ---
    dup = dupb = ''
    if nuevo:
        dup = (f'<span class="PFX-aic PFX-aic-av PFX-vdup">{ic(I["aviso"],28,1.8)}</span><h2 class="PFX-atit PFX-vdup">Paciente duplicado</h2>'
            '<p class="PFX-hjtx PFX-vgen">Ya existe un paciente con los mismos datos: Paciente Prueba 07 (Exp. #<span class="PFX-num">EXP-2026-0007</span>). ¿Es el mismo paciente o una persona distinta? Si es otra persona, se creará el registro de todos modos.</p>'
            '<p class="PFX-hjtx PFX-hjc PFX-vmio">Este paciente ya está en tu lista de pacientes: Paciente Prueba 07 (Exp. #<span class="PFX-num">EXP-2026-0007</span>). Si es otra persona, se creará el registro de todos modos.</p>')
        dupb = ('<button type="button" class="PFX-p PFX-prim PFX-cierra PFX-vgen">Es el mismo paciente</button>'
            '<button type="button" class="PFX-p PFX-prim PFX-cierra PFX-vmio">Ir a su expediente</button>'
            '<button type="button" class="PFX-p PFX-tonal PFX-cierra PFX-vdup">Es otra persona</button>'
            '<button type="button" class="PFX-p PFX-quieto PFX-cierra PFX-vdup">Cancelar</button>')
    capa = ('\n<!-- A4.11 Posible duplicado (hoy: recuadro ámbar al pie del formulario) y error del servidor (hoy: recuadro rojo sin botón). Mensajes y rótulos de hoy tal cual, sin el emoji; los títulos «Paciente duplicado» y «No se pudo guardar» y el botón «Aceptar» están aprobados por el dueño (CALMA §20). Tercera variante de duplicado, para el médico invitado, mismo dibujo y este texto: «Este paciente ya está registrado en tu clínica, pero no aparece en tu lista porque aún no es tu paciente: Paciente Prueba 07 (Exp. #EXP-2026-0007). ¿Deseas vincularlo a tus pacientes?». Mientras vincula, el primario dice «Vinculando...»; si falla, sobre los botones y en --mal-tinta: «No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.». En Editar, si el servidor manda su propio mensaje, va bajo el título. Animación de maqueta: en la app será un resorte. -->\n'
        '<div class="PFX-capa" aria-hidden="true"><div class="PFX-velo"></div>'
        '<div class="PFX-hoja" role="alertdialog" aria-modal="true" aria-label="" tabindex="-1" lang="es"><span class="PFX-asa"></span>'
        + dup + f'<span class="PFX-aic PFX-aic-mal PFX-vsrv">{ic(I["error"],28,1.8)}</span><h2 class="PFX-atit PFX-vsrv">No se pudo guardar</h2>'
        '<p class="PFX-hjtx PFX-hjc PFX-vsrv PFX-srvt" role="alert"></p>'
        '<div class="PFX-abot">' + dupb + '<button type="button" class="PFX-p PFX-prim PFX-cierra PFX-vsrv">Aceptar</button></div></div></div>')
    if vp == 'ext': app = col + '\n' + riel()
    elif vp == 'tel': app = enc() + '\n' + col
    elif vp == 'ih': app = col + '\n' + lat(vp)
    elif vp == 'iv': app = encv() + '\n' + col
    else: app = lat(vp) + '\n' + col
    return f'<div class="marco PFX" data-vp="{vp}">\n<div class="PFX-app">\n{app}\n</div>{capa}\n{CR.capa_mas(vp)}\n</div>'

JS = r'''
<script>
/* Maqueta. En la app: la hoja con resorte (amortiguación 1, respuesta ~0.35 s) en lugar de la curva fija; «Guardando...» termina navegando
   (médico: al expediente del paciente; secretaria: a la lista, A4.14); la carga inicial de Editar es hoy un indicador centrado (se mantiene). */
(function(){
  var HOY=new Date(2026,10,19),NUEVO=__NUEVO__,ROT=NUEVO?'Registrar e ir al expediente':'Guardar cambios';
  var marcos=[].slice.call(document.querySelectorAll('.PFX.marco')),apis=[];
  marcos.forEach(function(m){
    var q=function(s){return m.querySelector(s)},qa=function(s){return [].slice.call(m.querySelectorAll(s))};
    var cont=q('.PFX-cont'),fecha=q('.PFX-fecha'),edadr=q('.PFX-edadr'),edad=q('.PFX-edad'),alt=q('.PFX-alt'),tel=q('[name=tel]'),email=q('[name=email]'),
        peso=q('[data-k=peso]'),talla=q('[data-k=talla]'),imc=q('.PFX-imc'),capa=q('.PFX-capa'),ocupado=false,t0=0;
    function c(n){return q('[data-c="'+n+'"]')}
    function err(n,on,t){var e=c(n);if(!e)return;e.classList.toggle('PFX-err',!!on);var i=e.querySelector('input:not([hidden]),select');if(i)i.setAttribute('aria-invalid',String(!!on));
      if(t)e.querySelector('.PFX-msg').textContent=t}
    function srv(t){if(t===null){cierra();return}q('.PFX-srvt').textContent=t;abre('srv')}
    qa('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
    /* El marco nunca se desplaza: solo el contenido */
    m.addEventListener('scroll',function(e){var t=e.target;if(t===m||/PFX-(app|capa|col)( |$)/.test(t.className)){t.scrollTop=0;t.scrollLeft=0}},true);
    /* Fecha con la edad calculada a la derecha */
    function anios(){var p=fecha.value.split('/');if(p.length!==3||p[2].length!==4)return null;var d=+p[0],mo=+p[1],y=+p[2];
      if(!(d>=1&&d<=31&&mo>=1&&mo<=12&&y>=1900))return null;var a=HOY.getFullYear()-y;if(HOY.getMonth()+1<mo||(HOY.getMonth()+1===mo&&HOY.getDate()<d))a--;return a>=0?a:null}
    function enEdad(){return false}
    function pintaEdad(){var a=anios();edadr.classList.toggle('PFX-tag',!enEdad());edadr.classList.toggle('PFX-adj',enEdad());edadr.textContent=enEdad()?(edad.value?'años':''):(a===null?'':a+(a===1?' año':' años'))}
    fecha.addEventListener('input',function(){var d=fecha.value.replace(/\D/g,'').slice(0,8);
      fecha.value=d.length>4?d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4):d.length>2?d.slice(0,2)+'/'+d.slice(2):d;pintaEdad();err('fecha',false)});
    function modo(){}
    if(edad)edad.addEventListener('input',function(){edad.value=edad.value.replace(/\D/g,'').slice(0,3)});
    pintaEdad();
    /* Teléfono con formato y validación en línea (igual que hoy) */
    function vTel(){var d=tel.value.replace(/\D/g,'');var mal=d.length>0&&d.length!==10;err('tel',mal);return !mal}
    function vMail(){var v=email.value.trim();var mal=!!v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);err('email',mal);return !mal}
    tel.addEventListener('input',function(){var d=tel.value.replace(/\D/g,'').slice(0,10);
      tel.value=d.length<=3?d:d.length<=6?d.slice(0,3)+' '+d.slice(3):d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6);vTel()});
    email.addEventListener('input',vMail);
    /* IMC: la fila aparece cuando hay peso y talla */
    function pintaImc(){var p=parseFloat(peso.value),t=parseFloat(talla.value);if(t>0&&t<=3)t=t*100;
      var ok=p>0&&t>0;imc.textContent=ok?(p/Math.pow(t/100,2)).toFixed(1)+' kg/m²':'';q('.PFX-imc-f').hidden=!ok}
    [peso,talla].forEach(function(i){i.addEventListener('input',function(){i.value=i.value.replace(/[^\d.]/g,'');pintaImc()})});pintaImc();
    /* Datos adicionales */
    var masb=q('.PFX-masb'),adic=q('.PFX-adic');
    function abreAdic(on){if(!masb)return;masb.setAttribute('aria-expanded',String(on));adic.hidden=!on;q('.PFX-pie-correo').hidden=on}
    if(masb)masb.addEventListener('click',function(){abreAdic(masb.getAttribute('aria-expanded')!=='true')});
    /* El error se quita al corregir */
    ['nombre','apellidos'].forEach(function(n){c(n).querySelector('input').addEventListener('input',function(){err(n,false)})});
    qa('.PFX-sexo input').forEach(function(r){r.addEventListener('change',function(){err('sexo',false)})});
    if(c('priv'))c('priv').querySelector('input').addEventListener('change',function(){err('priv',false)});
    if(c('medico'))c('medico').querySelector('select').addEventListener('change',function(){err('medico',false)});
    function rotula(t,busy){qa('.PFX-envia').forEach(function(b){b.textContent=t;if(busy)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy')})}
    /* Guardar: validación en línea, dentro de cada fila */
    function envia(){if(ocupado)return;var mal=[];
      function pide(n,falta){err(n,falta);if(falta)mal.push(n)}
      if(m.classList.contains('PFX-sec')&&c('medico'))pide('medico',!c('medico').querySelector('select').value);
      pide('nombre',!c('nombre').querySelector('input').value.trim());
      pide('apellidos',!c('apellidos').querySelector('input').value.trim());
      /* Fecha y edad: el selector nativo no deja fechas a medias y la app descarta en silencio una edad fuera de 0-120 (nuevo/page.tsx:124); no hay mensaje que dibujar */
      pide('sexo',!q('.PFX-sexo input:checked'));
      if(!vTel())mal.push('tel');if(!vMail())mal.push('email');
      if(c('priv'))pide('priv',!c('priv').querySelector('input').checked);
      if(mal.length){if(mal.indexOf('tel')>=0||mal.indexOf('email')>=0)abreAdic(true);
        var p=c(mal[0]),r=p.getBoundingClientRect(),rc=cont.getBoundingClientRect(),z=rc.width/cont.offsetWidth||1;
        cont.scrollTop+=(r.top-rc.top)/z-64;var i=p.querySelector('input:not([hidden]),select');if(i)i.focus({preventScroll:true});return}
      ocupado=true;rotula('Guardando...',true);
      t0=setTimeout(function(){ocupado=false;rotula(ROT,false)},1400)}
    q('form').addEventListener('submit',function(e){e.preventDefault();envia()});
    q('.PFX-barra .PFX-envia').addEventListener('click',envia);
    /* Hoja de duplicado */
    function abre(k){capa.classList.remove('PFX-kgen','PFX-kmio','PFX-ksrv');capa.classList.add('PFX-k'+k,'PFX-on');capa.setAttribute('aria-hidden','false');
      var h=q('.PFX-hoja');h.setAttribute('aria-label',k==='srv'?'No se pudo guardar':'Paciente duplicado');h.focus({preventScroll:true})}
    function cierra(){capa.classList.remove('PFX-on');capa.setAttribute('aria-hidden','true')}
    {qa('.PFX-cierra').forEach(function(b){b.addEventListener('click',cierra)});q('.PFX-velo').addEventListener('click',cierra);
      m.addEventListener('keydown',function(e){if(e.key==='Escape'&&capa.classList.contains('PFX-on')){e.preventDefault();cierra()}})}
    /* Estados de la maqueta: los pulsa la tira, que vive fuera del marco */
    function pon(n,v){var e=q('[name='+n+']');e.value=v;e.dispatchEvent(new Event('input'))}
    function limpia(){clearTimeout(t0);ocupado=false;rotula(ROT,false);cierra();m.classList.remove('PFX-sec','PFX-plan');
      qa('.PFX-err').forEach(function(e){e.classList.remove('PFX-err')});qa('[aria-invalid]').forEach(function(e){e.removeAttribute('aria-invalid')});
      q('form').reset();if(edad)modo(false);pintaEdad();pintaImc();abreAdic(false);cont.scrollTop=0}
    apis.push(function(d){limpia();
      if(d==='vacio'){if(!NUEVO){pon('nombre','');pon('tel','999 000')}envia();cont.scrollTop=0}
      else if(d==='datos'){pon('nombre','Paciente');pon('apellidos','Prueba 26');pon('fecha','05021990');q('.PFX-sexo input[value=M]').checked=true;
        abreAdic(true);pon('tel','9990000026');pon('email','paciente.26@semilla.spinus.test');pon('peso','70');pon('talla','1.70')}
      else if(d==='sec'){m.classList.add('PFX-sec')}
      else if(d==='dup'||d==='mio'){abre(d==='mio'?'mio':'gen')}
      else if(d==='srv'){srv(NUEVO?'Error de conexion. Verifica tu internet e intenta de nuevo.':'')}
      else if(d==='plan'){m.classList.add('PFX-plan')}
      else if(d==='guardando'){ocupado=true;rotula('Guardando...',true)}});
  });
  /* CALMA §7: una sola tira, fuera del teléfono, controla los cinco marcos */
  var T=NUEVO?[['ini','Inicial'],['datos','Con datos'],['vacio','Guardar vacío'],['sec','Secretaria'],['dup','Duplicado'],['mio','Duplicado: ya es tu paciente'],['srv','Error del servidor'],['guardando','Guardando']]
             :[['ini','Inicial'],['vacio','Guardar con errores'],['srv','Error del servidor'],['guardando','Guardando']];
  var tira=document.createElement('div');tira.className='PFX-tira';tira.setAttribute('role','group');tira.setAttribute('aria-label','Controles de la maqueta');
  tira.innerHTML='<span>Maqueta</span>'+T.map(function(t,i){return '<button type="button" data-d="'+t[0]+'" aria-pressed="'+(i===0)+'">'+t[1]+'</button>'}).join('')+(NUEVO?'<p>Con el plan bloqueado esta pantalla no llega a mostrarse: la app lleva directo a Facturación, igual que hoy.</p>':'');
  var op=marcos[0].closest('.op');
  if(op&&op.querySelector('header'))op.querySelector('header').appendChild(tira);else marcos[0].parentNode.insertBefore(tira,marcos[0]);
  tira.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    [].forEach.call(tira.querySelectorAll('button'),function(x){x.setAttribute('aria-pressed',String(x===b))});apis.forEach(function(f){f(b.dataset.d)})});
})();
</script>
'''

for P, nuevo, arch, nom, desc in [
    ('fn', True, 'vista-1-nuevo.html', 'Nuevo paciente', 'El formulario deja de ser una pila de cajas: cada grupo es una lista limpia de filas, con rótulos de color e icono por grupo, la columna centrada en computadora, los errores junto al campo y los avisos (duplicado, error al guardar) como alertas centradas con botones de verdad.'),
    ('fe', False, 'vista-2-editar.html', 'Editar paciente', 'Los mismos grupos, en el mismo orden y con el mismo dibujo que Nuevo paciente, con los datos precargados y la columna centrada en computadora; el número de expediente sigue siendo editable.'),
]:
    html = (f'<!-- NOMBRE: {nom} | {desc} -->\n<style>{CSS.replace("__TIT__", nom) + CR.CSS}</style>\n'
            + '\n'.join(vista(nuevo, vp) for vp in ('ext','tel','ih','iv','esc')) + JS.replace('__NUEVO__', 'true' if nuevo else 'false').replace('</script>', CR.js() + '</script>'))
    html = html.replace('PFX', P)
    open(os.path.join(L, arch), 'w').write(html)
    print(arch, len(html))
