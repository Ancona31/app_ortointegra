# Vista 7 · Asistente de perfil (GateOnboarding → OnboardingModal). Uso: python3 tmp-v7.py
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp-base.py')).read())
P = 'cr7'
I.update(
    atras='<path d="m15 6-6 6 6 6"/>', check='<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    salvavidas='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3"/>',
    subir='<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', borrar='<path d="M20 20H9L4 15l9-9 7 7-6 6"/><path d="m7.5 11.5 6 6"/>',
    hospital='<path d="M4 21V8l8-5 8 5v13H4z"/><path d="M12 9v6M9 12h6"/>', ok2='<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8 5.2-5.6"/>',
)

def campo(rot, req=False, opc=False, ph='', val='', tipo='text', cl='', ayuda=''):
    r = ' <span class="§-req">*</span>' if req else (' <span class="§-opc">(opcional)</span>' if opc else '')
    v = f' value="{val}"' if val else ''
    return f'<label class="§-f{cl}"><span class="§-fl2">{rot}{r}</span><input type="{tipo}" class="§-in" placeholder="{ph}"{v} autocomplete="off">{f'<span class="§-ayuda">{ayuda}</span>' if ayuda else ''}</label>'

def sel(rot, opciones, req=True, cl=''):
    o = ''.join(f'<option{" selected" if i == 0 else ""}>{x}</option>' for i, x in enumerate(opciones))
    return f'<label class="§-f{cl}"><span class="§-fl2">{rot}{" <span class=" + chr(34) + "§-req" + chr(34) + ">*</span>" if req else ""}</span><select class="§-in §-sel">{o}</select></label>'

def pasos():
    ok = lambda titulo, texto: f'<div class="§-hecho">{ic(I["ok2"], 28, 1.8)}<p class="§-hecho-t">{titulo}</p><p class="§-hecho-s">{texto}</p></div>'
    return f'''
    <!-- Paso «Tu nombre» (solo secretaria; si está, es el único): OnboardingModal.tsx:629-660 -->
    <section class="§-st" data-p="nombre"><p class="§-intro">Así te verá el resto del equipo en la clínica.</p>
      {campo("Nombre(s)", True, ph="Ej: María", val="Secretaria")}
      <div class="§-par">{campo("Apellido paterno", True, ph="Ej: González", val="Semilla")}{campo("Apellido materno", ph="Ej: López")}</div></section>
    <!-- Paso «Datos»: título Dr./Dra., nombre, apellidos, especialidad (con «Agregar especialidad») y universidad -->
    <section class="§-st" data-p="datos"><p class="§-intro">¿Cómo aparecerás en tus documentos médicos?</p>
      <div class="§-par §-par-t">{sel("Título", ["Dr.", "Dra."])}{campo("Nombre(s)", True, ph="Ej: Juan", val="Admin")}</div>
      <div class="§-par">{campo("Apellido paterno", True, ph="Ej: García", val="Semilla")}{campo("Apellido materno", ph="Ej: López")}</div>
      <div class="§-f"><span class="§-fl2">Especialidad <span class="§-req">*</span></span><select class="§-in §-sel"><option>Ortopedia y Traumatología</option><option>Selecciona especialidad</option></select>
        <button type="button" class="§-p §-tx">{ic(I["plus"], 16, 2.2)}Agregar especialidad</button></div>
      {campo("Universidad / Institución", opc=True, ph="Ej: UNAM, IPN, UAG…")}</section>
    <!-- Paso «Cédulas» -->
    <section class="§-st" data-p="cedulas"><p class="§-intro">Tus cédulas aparecerán al pie de cada documento oficial.</p>
      {campo("Cédula profesional", True, ph="7 u 8 dígitos", val="00000001")}
      {campo("Cédula de especialidad", opc=True, ph="7 u 8 dígitos", ayuda="Déjala vacía si ejerces como médico general.")}
      <p class="§-nota">Las cédulas son datos que amparan legalmente tus documentos médicos bajo la NOM-004-SSA3-2012.</p></section>
    <!-- Paso «Clínica», cara del DUEÑO: formulario (crea la clínica con POST /api/me/clinica). Al volver, «ya está creada». -->
    <section class="§-st" data-p="clinica"><div class="§-nueva"><p class="§-intro">Tu clínica es la cuenta: el contenedor de tus pacientes, tus documentos y, si algún día lo necesitas, tu equipo. El consultorio —el lugar físico donde atiendes— lo configuras en el paso siguiente.</p>
      {campo("Nombre de la clínica", True, ph="Ej: Clínica Ortointegra", val="Clínica Semilla A", ayuda="Si trabajas por tu cuenta, pon tu nombre o el de tu práctica. Aparece en el encabezado de tus documentos y puedes cambiarlo luego en Mi Perfil.")}</div>
      {ok("Clínica Semilla A ya está creada", "Volviste a este paso, pero la clínica ya existe y no hace falta crearla otra vez. Para cambiarle el nombre, entra a Mi Perfil.")}
      <!-- Cara del INVITADO sin clínica: panel de soporte, sin formulario y sin «Continuar» (solo «Atrás») -->
      <div class="§-sop"><span class="§-sop-ic">{ic(I["salvavidas"], 24, 1.8)}</span><p class="§-hecho-t">Tu cuenta no está asociada a ninguna clínica</p>
        <p class="§-hecho-s">Los médicos invitados no pueden crear una clínica: quien administra la tuya debe volver a añadirte.</p>
        <p class="§-hecho-s">Escríbenos y lo resolvemos contigo —no es algo que puedas arreglar desde aquí.</p>
        <a href="#" class="§-p §-ton2">Escribir a soporte</a></div></section>
    <!-- Paso «Consultorio». «Nombre corto» solo aparece si el nombre pasa de 12 caracteres -->
    <section class="§-st" data-p="consultorio"><div class="§-nueva"><p class="§-intro">El consultorio es el lugar físico donde atiendes. Su dirección y su zona horaria mandan en tus documentos y en tu agenda.</p>
      {campo("Nombre del consultorio", True, ph="Ej: Consultorio Centro", val="Hospital Norte")}
      {campo("Nombre corto (máx. 12 caracteres)", True, ph="Ej: Centro", val="Hosp Norte", ayuda="Se muestra en el sidebar y en agenda cuando el nombre completo es muy largo.")}
      {campo("Dirección", True, ph="Ej: Calle 60 #400, Mérida, Yucatán", val="Calle Semilla 100, Centro")}
      {campo("Teléfono", opc=True, ph="Ej: 999 123 4567", val="999 000 0001", tipo="tel")}
      <div class="§-f"><span class="§-fl2">Zona horaria <span class="§-req">*</span></span>
        <div class="§-chips" role="radiogroup" aria-label="Zona horaria"><button type="button" role="radio" aria-checked="true" class="§-p §-chip">Centro (UTC-6)</button><button type="button" role="radio" aria-checked="false" class="§-p §-chip">Cancún (UTC-5)</button><button type="button" role="radio" aria-checked="false" class="§-p §-chip">Tijuana (UTC-8)</button></div>
        <select class="§-in §-sel" aria-label="Zona horaria"><option>Centro — CDMX, Jalisco, Edomex, Puebla, Veracruz, Oaxaca y mayoría (UTC-6)</option><option>Yucatán — Mérida, Valladolid (UTC-6)</option><option>Baja California — Tijuana, Ensenada, Mexicali (UTC-8)</option></select></div></div>
      {ok("Hospital Norte ya está creado", "Volviste a este paso, pero el consultorio ya existe y no hace falta crearlo otra vez. Para cambiarle la dirección, el teléfono o la zona horaria, entra a Mi Perfil → Mis consultorios.")}</section>
    <!-- Paso «Logo» (omitible; solo quien será dueño y no tiene logo). Hoy el recuadro lleva un emoji 🏥; aquí, icono SVG (BRIEF: sin emojis). -->
    <section class="§-st" data-p="logo"><p class="§-intro">El logo de tu clínica aparece en el encabezado de todos los documentos.</p>
      <label class="§-p §-drop"><input type="file" class="§-oculto" accept="image/png,image/jpeg,image/webp,image/svg+xml"><span class="§-drop-ic">{ic(I["hospital"], 24, 1.8)}</span>
        <span class="§-drop-t">Haz clic para subir el logo</span><span class="§-drop-s">PNG, JPG, WEBP o SVG · Máximo 500 KB</span></label>
      <div class="§-prev">{logo_clinica()}<button type="button" class="§-p §-tx §-rojo">Quitar logo</button></div></section>
    <!-- Paso «Firma» (omitible; solo médico sin firma): FirmaCaptura con sus dos modos; nace en «Subir imagen» -->
    <section class="§-st" data-p="firma"><p class="§-intro">Tu firma autógrafa aparece sobre la línea de firma en todos tus documentos PDF.</p>
      <div class="§-seg" role="tablist" aria-label="Modo de captura"><button type="button" role="tab" aria-selected="true" class="§-p §-sg" data-m="subir">{ic(I["subir"], 16, 2)}Subir imagen</button><button type="button" role="tab" aria-selected="false" class="§-p §-sg" data-m="dibujar">{ic(I["firma"], 16, 2)}Dibujar firma</button></div>
      <label class="§-p §-drop §-m-subir"><input type="file" class="§-oculto" accept="image/*"><span class="§-drop-ic">{ic(I["subir"], 24, 1.8)}</span>
        <span class="§-drop-t">Toca para seleccionar foto de tu firma</span><span class="§-drop-s">JPG, PNG, WEBP · Máx. 10 MB · Se procesará automáticamente</span></label>
      <div class="§-m-dibujar"><div class="§-lienzo"><span>Firma aquí con el dedo o mouse</span></div>
        <div class="§-lz-acc"><button type="button" class="§-p §-tx §-gris">{ic(I["borrar"], 16, 2)}Limpiar</button><button type="button" class="§-p §-ton2">Guardar firma →</button></div></div>
      <p class="§-nota">Si la omites, tus recetas y escritos saldrán <strong>sin firma</strong>: con la línea y tus datos, pero sin el trazo. Puedes capturarla más tarde en Mi Perfil. Para terminar <strong>con</strong> firma, pulsa «Aceptar firma» aquí arriba y espera a que confirme; para terminar <strong>sin</strong> ella, usa «Omitir por ahora».</p></section>'''

def modal(vp):
    return f'''<!-- A0·19 · Asistente de perfil (OnboardingModal.tsx). BLOQUEANTE: sin X, Esc no cierra, nadie lo cierra tocando fuera; solo «Finalizar».
     Lo monta GateOnboarding (layout de (app)) ante una lectura afirmativa del gate; con el plan bloqueado no se monta.
     Forma: modal del catálogo de 520 en Duo abierto y computadora; tarjeta centrada de 310 en Duo cerrado (§26); en iPhone, PANTALLA COMPLETA:
     es un formulario largo con teclado y no se puede descartar, así que una hoja con asa prometería un gesto (arrastrar para cerrar) que no existe. -->
<div class="§-mw"><div class="§-md" role="dialog" aria-modal="true" aria-labelledby="§-mt-{vp}" aria-describedby="§-ms-{vp}">
  <header class="§-mcab"><h2 class="§-mt" id="§-mt-{vp}"><span class="§-m">Configura tu perfil</span><span class="§-s">Te damos la bienvenida</span></h2>
    <p class="§-ms" id="§-ms-{vp}"><span class="§-m">Necesario para registrar pacientes y emitir documentos</span><span class="§-s">Solo falta saber cómo te llamas</span></p>
    <!-- Progreso: indicador, NO navegación (los círculos no se pulsan: cada paso escribe al avanzar) -->
    <ol class="§-prog" aria-label="Progreso"></ol><p class="§-pnx" aria-hidden="true"></p></header>
  <div class="§-mcu" lang="es">{pasos()}</div>
  <footer class="§-mpie"><button type="button" class="§-p §-ton2 §-atras">{ic(I["atras"], 16, 2.2)}Atrás</button><span class="§-flex"></span>
    <span class="§-reqt">Paso requerido</span><button type="button" class="§-p §-ton2 §-omitir">Omitir por ahora</button>
    <button type="button" class="§-p §-prim §-sigue"><span class="§-gira" aria-hidden="true"></span><span class="§-sigue-t">Continuar</span></button></footer>
</div></div>'''

def marco(vp):
    if vp == 'ext':
        app = fondo(vp) + riel('inicio')
    elif vp == 'tel':
        app = encabezado('Inicio') + fondo(vp)
    elif vp == 'iv':
        app = enc_iv('Inicio') + fondo(vp)
    else:
        latn = f'<nav class="§-lat" aria-label="Navegación principal">\n  {lateral("inicio")}\n</nav>'
        app = (fondo(vp) + latn) if vp == 'ih' else (latn + fondo(vp))
    app = app.replace(' data-abre="mas"', '').replace(' data-abre="cajon"', '')
    return f'<div class="marco §" data-vp="{vp}">\n<div class="§-app" inert>\n{app}\n</div>\n<div class="§-capa §-on"><div class="§-velo"></div>\n{modal(vp)}\n</div>\n</div>'

CSS = '''
.§ .§-capa{visibility:visible}
.§.§-fin .§-capa{visibility:hidden;transition:visibility 0s linear 360ms}
.§.§-fin .§-velo{opacity:0}
.§.§-fin .§-app{pointer-events:auto}
/* ---- Contenedor ---- */
.§ .§-mw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px}
.§[data-vp="ext"] .§-mw{padding:16px calc(56px + var(--ir) + 8px) calc(var(--ib) + 16px) 8px}
.§[data-vp="ih"] .§-mw{padding:20px calc(218px + var(--ir) + 24px) calc(var(--ib) + 12px) 24px}
.§[data-vp="iv"] .§-mw{padding:calc(var(--it) + 24px) 24px 24px}
.§[data-vp="esc"] .§-mw{padding:32px 24px 32px calc(248px + 24px)}
.§[data-vp="tel"] .§-mw{padding:0}
.§ .§-md{display:flex;flex-direction:column;width:520px;max-width:100%;max-height:100%;background:var(--sup);color:var(--tinta);border-radius:20px;box-shadow:var(--sombra-capa);overflow:hidden;transition:opacity 200ms ease-out,transform 360ms RES_OUT}
.§[data-vp="ext"] .§-md{width:310px}
.§[data-vp="tel"] .§-md{width:100%;height:100%;border-radius:0;box-shadow:none}
.§.§-fin .§-md{opacity:0;transform:scale(.96)}
.§[data-vp="tel"].§-fin .§-md{opacity:1;transform:translateY(105%)}
.§ .§-mcab{flex:none;padding:20px 24px 14px;border-bottom:1px solid var(--linea)}
.§[data-vp="ext"] .§-mcab{padding:16px 16px 12px}
.§[data-vp="tel"] .§-mcab{padding:calc(var(--it) + 12px) 16px 12px}
.§ .§-mt{font-size:20px;line-height:26px;font-weight:700}
.§[data-vp="ext"] .§-mt{font-size:17px;line-height:22px}
.§[data-vp="tel"] .§-mt{font-size:26px;line-height:32px;font-weight:800;letter-spacing:-.6px}
.§ .§-ms{margin-top:2px;font-size:13px;line-height:18px;color:var(--tinta2)}
/* Progreso: círculos de 24; el actual con su nombre; los hechos en verde con palomita */
.§ .§-prog{display:flex;align-items:center;gap:6px;margin:14px 0 0;padding:0;list-style:none}
.§ .§-prog li{display:flex;align-items:center;gap:6px;flex:none}
.§ .§-prog li.§-act{flex:0 1 auto;min-width:0}
.§ .§-prog .§-ln{flex:1 1 8px;min-width:6px;height:2px;border-radius:1px;background:var(--sup2)}
.§ .§-prog .§-ln.§-ok{background:var(--ok-tinta)}
.§ .§-pc{width:24px;height:24px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--sup2);color:var(--tinta2);font-size:12px;line-height:16px;font-weight:700;font-variant-numeric:tabular-nums}
.§ .§-act .§-pc{background:var(--accion);color:#fff}
.§ .§-hecha .§-pc{background:var(--ok-fondo);color:var(--ok-tinta)}
.§ .§-pnx{display:none;margin-top:6px;font-size:13px;line-height:18px;font-weight:700;color:var(--enlace)}
.§[data-vp="ext"] .§-pnx{display:block}
.§[data-vp="ext"] .§-pn{display:none}
.§ .§-nueva{display:flex;flex-direction:column;gap:14px}
.§[data-vp="ext"] .§-mpie .§-flex{display:none}
.§[data-vp="ext"] .§-mpie .§-atras{flex:none}
.§ .§-pn{font-size:13px;line-height:18px;font-weight:700;color:var(--tinta);white-space:nowrap}
/* ---- Cuerpo ---- */
.§ .§-mcu{flex:1 1 auto;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--borde) transparent;padding:18px 24px 20px}
.§[data-vp="ext"] .§-mcu{padding:14px 16px 16px}
.§[data-vp="tel"] .§-mcu{padding:18px 16px 20px}
.§ .§-st{display:none;flex-direction:column;gap:14px}
.§ .§-st.§-vis{display:flex}
.§ .§-intro{font-size:15px;line-height:22px;color:var(--tinta);text-align:justify;hyphens:auto}
.§ .§-f{display:flex;flex-direction:column;gap:6px;min-width:0}
.§ .§-fl2{font-size:13px;line-height:18px;font-weight:600;color:var(--tinta2)}
.§ .§-req{color:var(--mal-tinta)}
.§ .§-opc{font-weight:400;color:var(--tinta3)}
.§ .§-in{height:44px;width:100%;min-width:0;padding:0 12px;border:0;border-radius:12px;background:var(--sup2);color:var(--tinta);font:16px/20px var(--fuente);outline:none}
.§[data-vp="esc"] .§-in,.§[data-vp="ih"] .§-in{height:40px;font-size:15px}
.§ .§-in:focus{outline:2px solid var(--enlace)}
.§ .§-in::placeholder{color:var(--tinta3)}
.§ .§-sel{appearance:none;-webkit-appearance:none;padding-right:34px;text-overflow:ellipsis;background-image:linear-gradient(45deg,transparent 50%,var(--tinta2) 50%),linear-gradient(135deg,var(--tinta2) 50%,transparent 50%);background-position:calc(100% - 18px) 52%,calc(100% - 13px) 52%;background-size:5px 5px;background-repeat:no-repeat}
.§ .§-par{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.§ .§-par-t{grid-template-columns:96px 1fr}
.§[data-vp="ext"] .§-par:not(.§-par-t){grid-template-columns:1fr}
.§ .§-ayuda{font-size:13px;line-height:18px;color:var(--tinta2)}
.§ .§-nota{padding:12px 14px;border-radius:12px;background:var(--fondo);font-size:13px;line-height:19px;color:var(--tinta2);text-align:justify;hyphens:auto}
.§ .§-nota strong{color:var(--tinta);font-weight:600}
.§ .§-tx{position:relative;align-self:flex-start;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px;font-size:15px;line-height:20px;font-weight:600;color:var(--enlace)}
.§[data-vp="esc"] .§-tx,.§[data-vp="ih"] .§-tx{min-height:36px;font-size:14px}
.§ .§-rojo{color:var(--mal-tinta)}
.§ .§-gris{color:var(--tinta2)}
.§ .§-chips{display:flex;flex-wrap:wrap;gap:8px}
.§ .§-chip{position:relative;height:36px;padding:0 14px;border-radius:999px;background:var(--sup2);color:var(--tinta);font-size:14px;line-height:18px;font-weight:600}
.§ .§-chip::after{content:"";position:absolute;inset:-4px 0}
.§[data-vp="esc"] .§-chip::after,.§[data-vp="ih"] .§-chip::after{display:none}
.§ .§-chip[aria-checked="true"]{background:var(--accion);color:#fff}
/* Hechos al volver y panel de soporte */
.§ .§-hecho,.§ .§-sop{display:none;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:16px 8px}
.§ .§-hecho>svg{color:var(--ok-tinta)}
.§ .§-hecho-t{font-size:17px;line-height:22px;font-weight:700}
.§ .§-hecho-s{font-size:14px;line-height:20px;color:var(--tinta2);text-align:justify;hyphens:auto;max-width:42ch}
.§ .§-sop-ic{width:48px;height:48px;border-radius:999px;background:var(--tonal);color:var(--tonal-tinta);display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.§ .§-sop .§-ton2{margin-top:10px}
.§.§-creada .§-st[data-p="clinica"] .§-nueva,.§.§-creada .§-st[data-p="consultorio"] .§-nueva{display:none}
.§.§-creada .§-hecho{display:flex}
.§.§-invitado .§-st[data-p="clinica"] .§-nueva,.§.§-invitado .§-st[data-p="clinica"] .§-hecho{display:none!important}
.§.§-invitado .§-st[data-p="clinica"] .§-sop{display:flex}
/* Logo y firma */
.§ .§-oculto{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.§ .§-drop{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:148px;padding:20px;border-radius:16px;background:var(--fondo);border:2px dashed var(--borde);text-align:center;cursor:pointer}
.§ .§-drop-ic{width:48px;height:48px;border-radius:999px;background:var(--tonal);color:var(--tonal-tinta);display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.§ .§-drop-t{font-size:15px;line-height:20px;font-weight:600;color:var(--tinta)}
.§ .§-drop-s{font-size:13px;line-height:18px;color:var(--tinta2)}
.§ .§-prev{display:none;flex-direction:column;align-items:center;gap:8px;padding:20px;border-radius:16px;background:var(--fondo)}
.§ .§-prev .§-clogo{width:96px;height:96px;box-shadow:0 0 0 1px var(--linea)}
.§ .§-prev .§-clogo svg{width:56px;height:56px}
.§ .§-prev .§-tx{align-self:center}
.§.§-conlogo .§-st[data-p="logo"] .§-drop{display:none}
.§.§-conlogo .§-prev{display:flex}
.§ .§-seg{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;border-radius:12px;background:var(--sup2)}
.§ .§-sg{display:flex;align-items:center;justify-content:center;gap:6px;height:38px;border-radius:9px;font-size:14px;line-height:18px;font-weight:600;color:var(--tinta2);position:relative}
.§ .§-sg::after{content:"";position:absolute;inset:-3px 0}
.§[data-vp="esc"] .§-sg::after,.§[data-vp="ih"] .§-sg::after{display:none}
.§ .§-sg[aria-selected="true"]{background:var(--sup);color:var(--tinta);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.§ .§-m-dibujar{display:none;flex-direction:column;gap:8px}
.§.§-dibujar .§-m-dibujar{display:flex}
.§.§-dibujar .§-m-subir{display:none}
.§ .§-lienzo{aspect-ratio:600/220;border-radius:14px;background:#fff;border:2px dashed var(--borde);display:flex;align-items:center;justify-content:center;color:#8A93A6;font-size:14px;line-height:20px}
.§ .§-lz-acc{display:flex;align-items:center;justify-content:space-between}
/* ---- Pie ---- */
.§ .§-mpie{flex:none;display:flex;align-items:center;gap:8px;padding:12px 24px;border-top:1px solid var(--linea)}
.§[data-vp="ext"] .§-mpie{flex-wrap:wrap;padding:10px 12px 12px}
.§[data-vp="tel"] .§-mpie{padding:12px 16px calc(var(--ib) + 12px)}
.§[data-vp="iv"] .§-mpie{justify-content:center}
.§[data-vp="iv"] .§-mpie .§-flex{flex:0 0 24px}
.§ .§-ton2,.§ .§-prim{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;border-radius:12px;font-size:15px;line-height:20px;font-weight:600;white-space:nowrap}
.§[data-vp="esc"] .§-ton2,.§[data-vp="esc"] .§-prim,.§[data-vp="ih"] .§-ton2,.§[data-vp="ih"] .§-prim{min-height:40px;font-size:14px}
.§ .§-mpie .§-prim,.§ .§-mpie .§-omitir{min-width:104px}
.§ .§-ton2{background:var(--tonal);color:var(--tonal-tinta)}
.§ .§-prim{background:var(--accion);color:#fff}
.§ .§-atras{padding:0 14px 0 10px}
.§ .§-reqt{font-size:13px;line-height:18px;color:var(--tinta2)}
.§[data-vp="ext"] .§-reqt{display:none}
.§[data-vp="ext"] .§-mpie .§-prim{flex:1}
.§.§-primero .§-atras{visibility:hidden}
.§.§-omitible .§-reqt,.§:not(.§-omitible) .§-omitir{display:none}
.§.§-soporte .§-sigue,.§.§-soporte .§-reqt,.§.§-soporte .§-omitir{display:none}
.§ .§-gira{display:none;width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:§-gira .8s linear infinite}
@keyframes §-gira{to{transform:rotate(360deg)}}
.§.§-guardando .§-gira{display:block}
.§.§-guardando .§-sigue{opacity:.85;pointer-events:none}
.§ .§-sigue[aria-disabled="true"]{opacity:.45}
@media (prefers-reduced-motion:reduce){.§ .§-md{transition:opacity 200ms ease;transform:none!important}.§ .§-gira{animation-duration:2.4s}}
'''.replace('RES_IN', RES_IN).replace('RES_OUT', RES_OUT)

JS = r'''
var ET={nombre:'Tu nombre',datos:'Datos',cedulas:'Cédulas',clinica:'Clínica',consultorio:'Consultorio',logo:'Logo',firma:'Firma'};
var RUTAS={duen:['datos','cedulas','clinica','consultorio','logo','firma'],sec:['nombre'],inv:['datos','cedulas','clinica','consultorio','firma']};
var st={ruta:'duen',i:0,creada:false,conlogo:false,guardando:false,dibujar:false,fin:false};
function pinta(){var r=RUTAS[st.ruta],p=r[st.i],ult=st.i===r.length-1;
  MS.forEach(function(m){
    m.classList.toggle(cls('sec'),st.ruta==='sec');m.classList.toggle(cls('invitado'),st.ruta==='inv');m.classList.toggle(cls('creada'),st.creada);
    m.classList.toggle(cls('conlogo'),st.conlogo);m.classList.toggle(cls('guardando'),st.guardando);m.classList.toggle(cls('dibujar'),st.dibujar);
    m.classList.toggle(cls('primero'),st.i===0);m.classList.toggle(cls('omitible'),p==='logo'||p==='firma');m.classList.toggle(cls('soporte'),st.ruta==='inv'&&p==='clinica');
    m.classList.toggle(cls('fin'),st.fin);
    m.querySelectorAll('.'+cls('st')).forEach(function(s){s.classList.toggle(cls('vis'),s.dataset.p===p)});
    var ol=m.querySelector('.'+cls('prog'));ol.innerHTML='';
    r.forEach(function(x,j){var li=document.createElement('li');li.className=j<st.i?cls('hecha'):j===st.i?cls('act'):'';
      li.innerHTML='<span class="'+cls('pc')+'">'+(j<st.i?'<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>':(j+1))+'</span>'+(j===st.i?'<span class="'+cls('pn')+'">'+ET[x]+'</span>':'');
      li.setAttribute('aria-label','Paso '+(j+1)+' de '+r.length+': '+ET[x]+(j<st.i?', hecho':j===st.i?', actual':''));if(j===st.i)li.setAttribute('aria-current','step');
      ol.appendChild(li);if(j<r.length-1){var ln=document.createElement('li');ln.className=cls('ln')+(j<st.i?' '+cls('ok'):'');ln.setAttribute('aria-hidden','true');ol.appendChild(ln)}});
    m.querySelector('.'+cls('pnx')).textContent=ET[p];
    var t=m.querySelector('.'+cls('sigue-t'));t.textContent=st.guardando?'Guardando…':(ult?'Finalizar':'Continuar');
    /* Firma: hoy «Finalizar» queda deshabilitado hasta aceptar una firma (o se usa «Omitir por ahora») */
    m.querySelector('.'+cls('sigue')).setAttribute('aria-disabled',String(p==='firma'));
    m.querySelectorAll('.'+cls('sg')).forEach(function(b){b.setAttribute('aria-selected',String((b.dataset.m==='dibujar')===st.dibujar))});
    m.querySelector('.'+cls('mcu')).scrollTop=0});
  sinc()}
function avanza(){var r=RUTAS[st.ruta];if(st.i>=r.length-1){st.fin=true;pinta();return}st.guardando=true;pinta();
  setTimeout(function(){st.guardando=false;st.i++;pinta()},500)}
MS.forEach(function(m){
  m.querySelector('.'+cls('sigue')).addEventListener('click',function(e){if(e.currentTarget.getAttribute('aria-disabled')==='true')return;avanza()});
  m.querySelector('.'+cls('omitir')).addEventListener('click',function(){var r=RUTAS[st.ruta];if(st.i>=r.length-1){st.fin=true;pinta()}else{st.i++;pinta()}});
  m.querySelector('.'+cls('atras')).addEventListener('click',function(){if(st.i>0){st.i--;st.creada=true;pinta()}});
  m.querySelectorAll('.'+cls('sg')).forEach(function(b){b.addEventListener('click',function(){st.dibujar=b.dataset.m==='dibujar';pinta()})});
  m.querySelectorAll('.'+cls('chip')).forEach(function(b){b.addEventListener('click',function(){b.parentNode.querySelectorAll('[role="radio"]').forEach(function(x){x.setAttribute('aria-checked',String(x===b))})})});
  /* Bloqueante: Esc no hace nada (onClose no-op en el código) */
  m.addEventListener('keydown',function(e){if(e.key==='Escape')e.preventDefault()});
});
var T;
function sinc(){if(!T)return;var r=RUTAS[st.ruta];T.querySelectorAll('button').forEach(function(b){var k=b.dataset.k;
  if(k.indexOf('p:')===0)b.setAttribute('aria-pressed',String(!st.fin&&r[st.i]===k.slice(2)&&(k!=='p:nombre'||st.ruta==='sec')));
  if(k==='inv')b.setAttribute('aria-pressed',String(st.ruta==='inv'));if(k==='creada')b.setAttribute('aria-pressed',String(st.creada));
  if(k==='conlogo')b.setAttribute('aria-pressed',String(st.conlogo));if(k==='dibujar')b.setAttribute('aria-pressed',String(st.dibujar))})}
T=tira([[['p:nombre','Tu nombre (secretaria)',false],['p:datos','Datos',true],['p:cedulas','Cédulas',false],['p:clinica','Clínica',false],['p:consultorio','Consultorio',false],['p:logo','Logo',false],['p:firma','Firma',false]],
  [['inv','Invitado sin clínica',false],['creada','Ya creada (al volver)',false],['conlogo','Logo elegido',false],['dibujar','Firma: dibujar',false],['guarda','Guardando…']],[['reabre','Volver a abrir']]],function(k){
  st.fin=false;st.guardando=false;
  if(k.indexOf('p:')===0){var p=k.slice(2);if(p==='nombre'){st.ruta='sec'}else if(st.ruta==='sec'){st.ruta='duen'}
    var r=RUTAS[st.ruta],j=r.indexOf(p);if(j<0){st.ruta='duen';r=RUTAS.duen;j=r.indexOf(p)}st.i=j}
  else if(k==='inv'){st.ruta=st.ruta==='inv'?'duen':'inv';st.i=2}
  else if(k==='creada'){st.creada=!st.creada}
  else if(k==='conlogo'){st.conlogo=!st.conlogo}
  else if(k==='dibujar'){st.dibujar=!st.dibujar}
  else if(k==='guarda'){st.guardando=true}
  else if(k==='reabre'){st.i=0}
  pinta()});
pinta();
'''

FICHA = ficha(P, 'Asistente de perfil', [
    ('Qué es', 'El asistente que pide lo mínimo para trabajar (<code>onboarding/GateOnboarding.tsx</code> → <code>OnboardingModal.tsx</code>). Lo monta el layout de <code>(app)</code> cuando el criterio del servidor dice que el perfil no está completo; con el plan bloqueado no se monta.'),
    ('Pasos (los decide el servidor)', '<b>Médico que crea su clínica:</b> Datos · Cédulas · Clínica · Consultorio · Logo · Firma (6). <b>Médico invitado:</b> sin Logo; si se quedó sin clínica, el paso Clínica es un panel de soporte sin «Continuar». <b>Secretaria:</b> solo «Tu nombre». Logo y Firma solo se enseñan a quien no los tiene. Los siete con sus textos y campos exactos, en la tira.'),
    ('Forma por marco', 'Modal del catálogo de 520 centrado en el área de contenido (Duo abierto y computadora; el pie de Duo vertical, centrado, §23.1); tarjeta centrada de 310 con desplazamiento interno en Duo cerrado (§26). <b>iPhone: pantalla completa.</b> Justificación: es un formulario de hasta seis campos con teclado en pantalla y NO se puede descartar; una hoja con asa promete arrastrar para cerrar, y aquí no hay cierre. La navegación de fondo queda inerte.'),
    ('Cabecera', 'Título «Configura tu perfil» (secretaria: «Te damos la bienvenida»), subtítulo «Necesario para registrar pacientes y emitir documentos» («Solo falta saber cómo te llamas»), y el progreso: círculos de 24 numerados, el actual en <code>--accion</code> con su nombre, los hechos en verde con palomita, unidos por una línea. Es indicador, no navegación (no se pulsa: cada paso escribe al avanzar).'),
    ('Pie', '«Atrás» (tonal, desde el segundo paso; al volver, Clínica y Consultorio enseñan «… ya está creada/o»). A la derecha: «Paso requerido» (texto) o «Omitir por ahora» (tonal, solo Logo y Firma) y el principal «Continuar» / «Finalizar» / «Guardando…» con giro. En Firma el principal espera a «Aceptar firma» (o se omite). Sin X; Esc y tocar fuera no hacen nada.'),
    ('Campos y textos', 'Todos los de hoy, con sus marcadores de ejemplo: «Así te verá el resto del equipo en la clínica.», «¿Cómo aparecerás en tus documentos médicos?», Título (Dr./Dra.), Nombre(s), Apellido paterno, Apellido materno, Especialidad + «Agregar especialidad», Universidad / Institución (opcional); cédulas con «Déjala vacía si ejerces como médico general.» y la nota de la NOM-004-SSA3-2012; clínica, consultorio (nombre corto solo si el nombre pasa de 12), zona horaria con tres atajos y la lista completa; logo «Haz clic para subir el logo» / «PNG, JPG, WEBP o SVG · Máximo 500 KB» / «Quitar logo»; firma «Subir imagen» / «Dibujar firma», «Firma aquí con el dedo o mouse», «Limpiar», «Guardar firma →» y el aviso de omitirla. Cambios: el emoji 🏥 del logo pasa a icono (BRIEF: sin emojis). Errores: hoy son avisos breves («El nombre es obligatorio», …), patrón de <code>pub-capas</code> 5.'),
    ('Accesibilidad', '<code>role="dialog"</code> con título y subtítulo enlazados; progreso como lista con «Paso N de M: …» y <code>aria-current="step"</code>; etiquetas visibles encima de cada campo; obligatorios con asterisco y texto; el fondo con <code>inert</code>.'),
    ('Movimiento', 'Entra con escala .96→1 y fundido (resorte, amortiguación 1, respuesta .35 s); en iPhone sube desde abajo. Entre pasos, el cuerpo cambia sin desplazamiento lateral (cada paso guarda en el servidor; un deslizamiento sugeriría poder volver deslizando). «Finalizar» lo retira por el mismo camino. Reduced motion: fundidos.'),
])

marcos = [marco(v) for v in ('ext', 'tel', 'ih', 'iv', 'esc')]
salida(P, '7-asistente-perfil', 'Asistente de perfil',
       'Hoy es un ModalShell genérico con un stepper de puntos y botones grises; aquí es el modal del catálogo (pantalla completa en iPhone, porque no se puede cerrar) con progreso nombrado, los campos como en los formularios aprobados y los siete pasos con sus textos de hoy',
       CSS, marcos, JS, {'p': P}, FICHA)
