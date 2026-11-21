'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useClinica } from '@/hooks/useClinica'

type ThemeCtx = { dark: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} })
export const useTheme = () => useContext(Ctx)

/* LA BARRA DEL NAVEGADOR, SINCRONIZADA CON EL TEMA QUE EL MEDICO ELIGIO.
 *
 * ATENCION: EL <meta name="theme-color"> DE layout.tsx NO PUEDE HACER ESTO SOLO,
 * y por eso existe esta funcion. Aquel declara dos entradas con
 * `prefers-color-scheme`, que es la preferencia del SISTEMA; el tema de la app
 * lo decide la clase `dark` que leemos de localStorage. Un medico con el sistema
 * en claro y la app en oscuro veia la barra del navegador en el navy claro
 * mientras la pagina estaba en el oscuro. Reescribiendo el `content` de LAS DOS
 * entradas con el mismo valor, la que gane dice lo correcto sea cual sea la
 * preferencia del sistema.
 *
 * Y DE PASO LA BARRA PASA A SEGUIR A LA MARCA DE LA CLINICA, que el <meta>
 * tampoco podia: el navegador lo lee antes de que exista CSS. Aqui si hay CSS,
 * asi que el color sale de LA FRANJA PINTADA (`body::before`, globals.css):
 * `--navy` en toda la app y `--ag-navy` con la banda de la agenda movil delante
 * (rediseño, integracion B1–B4). Leerlo del pseudo-elemento y no de un token es
 * lo que garantiza que barra del navegador, franja y cromo sean UN color: la
 * decision de cual vive en un solo sitio, el CSS.
 *
 * POR QUE HACE FALTA EL LIENZO: el navy resuelve a `color(srgb ...)` o a
 * `oklch(...)` —usa sintaxis de color relativa—, y `theme-color` quiere un color
 * que el navegador acepte en un atributo. El lienzo lo normaliza a hex.
 * El centinela magenta detecta que el lienzo NO supo parsear el color: si eso
 * pasa, `fillStyle` se queda como estaba y salimos sin tocar nada, que es mejor
 * que pintar la barra de negro.
 */
function sincronizarBarraDelNavegador(): void {
  try {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    if (metas.length === 0) return

    const pintado = getComputedStyle(document.body, '::before').backgroundColor

    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 1
    const ctx = lienzo.getContext('2d')
    if (!ctx) return
    const CENTINELA = '#ff00ff'
    ctx.fillStyle = CENTINELA
    ctx.fillStyle = pintado
    if (ctx.fillStyle === CENTINELA) return
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

    metas.forEach(m => { m.content = hex })
  } catch {}
}

/* LA BANDA DE LA AGENDA MOVIL CAMBIA EL COLOR DE LA FRANJA (`body:has(.ag-banda-movil)`)
 * y se monta en un efecto de la agenda, cuando ya paso cualquier cambio de ruta:
 * por eso se observa el DOM y no `pathname`. El observador sólo mira si la banda
 * aparece o se va (una consulta por fotograma, como mucho) y sólo entonces
 * vuelve a sincronizar. */
function useFranjaSegunBanda(): void {
  useEffect(() => {
    let hayBanda = document.querySelector('.ag-banda-movil') !== null
    let pendiente = 0
    const revisar = () => {
      pendiente = 0
      const ahora = document.querySelector('.ag-banda-movil') !== null
      if (ahora === hayBanda) return
      hayBanda = ahora
      sincronizarBarraDelNavegador()
    }
    const observador = new MutationObserver(() => {
      if (!pendiente) pendiente = requestAnimationFrame(revisar)
    })
    observador.observe(document.body, { childList: true, subtree: true })
    return () => { observador.disconnect(); if (pendiente) cancelAnimationFrame(pendiente) }
  }, [])
}

/* LA MARCA DE LA CLINICA EN LOS TOKENS DEL REDISENO (B1, PLAN §2.2).
 *
 * `sistema.css` declara --navy, --accion, --enlace, --tonal y --tonal-tinta con
 * los valores del kit, que son los de la paleta de fabrica («Spinus (defecto)»,
 * #1a3a5c / #1e5fa8): con ella esto devuelve '' y manda el kit tal cual
 * (decision del dueno, CALMA §31.1). Con cualquiera de las otras cinco paletas
 * de /perfil, los cinco tokens se DERIVAN de --cp/--cs.
 *
 * ⚠️ PRIMERO EL RESPALDO SIN SINTAXIS DE COLOR RELATIVA, LUEGO LA FORMULA EN SU
 * @supports. Un custom property con `hsl(from …)` que el navegador no entiende
 * no se descarta: deja inválida la propiedad que lo consume (y el relleno
 * saldria transparente). Es el mismo patron que --sp-primary en
 * spinus-tokens.css.
 * ⚠️ --tonal y --tonal-tinta salen de --accion, no de --cs: asi en oscuro siguen
 * al relleno aclarado. Los avisos (Toast) NO usan --tonal, a proposito.
 * ⚠️ NO cambia lo guardado en la base ni los PDF: solo lo que se pinta.
 * ⚠️ LOS DOS TOPES ESTAN MEDIDOS (B1, seis paletas). Claro: --accion con la
 * claridad OKLCH topada en 0.52 (el mismo tope que --sp-brand-grad-to): sin el,
 * el blanco sobre «Verde medico» daba 3.74:1; con el, 5.10-7.58. Oscuro: 0.55,
 * blanco encima 4.53-5.51; el relleno contra --sup queda en 2.88-3.50 (Morado y
 * Burdeos por debajo de 3:1). Con 0.57 el relleno pasa de 3:1 pero el blanco
 * de «Verde» y «Pizarra» cae a 4.20/4.43: gana el texto, no lo subas. */
const MARCA_DE_FABRICA = { primario: '#1a3a5c', secundario: '#1e5fa8' } as const

export function cssMarcaDerivada(primario: string, secundario: string): string {
  if (primario.toLowerCase() === MARCA_DE_FABRICA.primario
    && secundario.toLowerCase() === MARCA_DE_FABRICA.secundario) return ''
  return `
    :root {
      --navy: var(--cp);
      --accion: var(--cs);
      --enlace: var(--cs);
      --tonal: color-mix(in srgb, var(--accion) 12%, var(--sup));
      --tonal-tinta: color-mix(in srgb, var(--accion) 70%, #000);
    }
    html.dark {
      --navy: color-mix(in srgb, var(--cp) 60%, #000);
      --accion: var(--cs);
      --enlace: color-mix(in srgb, var(--accion) 55%, #fff);
      --tonal: color-mix(in srgb, var(--accion) 35%, var(--sup));
      --tonal-tinta: color-mix(in srgb, var(--accion) 30%, #fff);
    }
    @supports (color: oklch(from red l c h)) {
      :root {
        --navy: hsl(from var(--cp) h s 20%);
        --accion: oklch(from var(--cs) min(l, 0.52) c h);
        --enlace: oklch(from var(--cs) min(l, 0.52) c h);
      }
      html.dark {
        --navy: hsl(from var(--cp) h s 12.5%);
        --accion: oklch(from var(--cs) 0.55 c h);
        --enlace: color-mix(in srgb, var(--accion) 55%, #fff);
      }
    }
  `
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorPrimario, colorSecundario } = useClinica()
  const [dark, setDark] = useState(false)
  useFranjaSegunBanda()

  /* ATENCION: LA CLASE `dark` YA LA PUSO EL SCRIPT DEL <head> DE layout.tsx, y
     este efecto NO es quien quita el destello. Lo que hace es poner el estado de
     React de acuerdo con el DOM —el interruptor del menu lo lee— y sincronizar
     la barra del navegador. El classList.add es idempotente y se queda como red
     por si alguien retira aquel script.
     `colorPrimario` esta en las dependencias porque llega por SWR: en el primer
     render todavia es el de fabrica, y sin esto la barra se quedaria con el navy
     por defecto hasta la siguiente recarga. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark') }
    } catch {}
    sincronizarBarraDelNavegador()
  }, [colorPrimario])

  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', next)
      } catch {}
      /* Despues de mover la clase, no antes: la sonda lee la franja del tema
         que acaba de quedar activo. */
      sincronizarBarraDelNavegador()
      return next
    })
  }, [])

  const css = `
    :root {
      --cp: ${colorPrimario};
      --cs: ${colorSecundario};

      /* ── Alias semánticos del color del usuario ── */
      --user-primary: var(--cp);
      --user-secondary: var(--cs);

      /* ── Derivados con opacidad (color-mix) ── */
      --user-primary-soft: color-mix(in srgb, var(--cp) 8%, transparent);
      --user-primary-medium: color-mix(in srgb, var(--cp) 22%, transparent);
      --user-primary-glow: color-mix(in srgb, var(--cp) 24%, transparent);

      /* ── Paleta semántica universal (fija, no depende del usuario) ── */
      --sem-consulta: #34c759;
      --sem-consulta-soft: rgba(52,199,89,0.12);
      --sem-documentos: #af52de;
      --sem-documentos-soft: rgba(175,82,222,0.12);
      --sem-agenda: #ff9500;
      --sem-agenda-soft: rgba(255,149,0,0.12);
      --sem-peligro: #ff3b30;
      --sem-peligro-soft: rgba(255,59,48,0.1);
      --sem-ok: #34c759;
      --sem-neutro: #8e8e93;
      --sem-neutro-soft: rgba(142,142,147,0.14);

      /* ── Tokens de radio ── */
      --radius-sm: 10px;
      --radius-md: 14px;
      --radius-lg: 20px;
    }

    /* ── Fondos ── */
    .bg-\\[\\#1e5fa8\\]               { background-color: var(--cs) !important; }
    .bg-\\[\\#1a3a5c\\]               { background-color: var(--cp) !important; }
    .hover\\:bg-\\[\\#1e5fa8\\]:hover { background-color: var(--cs) !important; }
    .hover\\:bg-\\[\\#1a3a5c\\]:hover { background-color: var(--cp) !important; }

    /* ── Texto ── */
    .text-\\[\\#1e5fa8\\]               { color: var(--cs) !important; }
    .text-\\[\\#1a3a5c\\]               { color: var(--cp) !important; }
    .hover\\:text-\\[\\#1e5fa8\\]:hover { color: var(--cs) !important; }
    .hover\\:text-\\[\\#1a3a5c\\]:hover { color: var(--cp) !important; }

    /* ── Bordes ── */
    .border-\\[\\#1e5fa8\\]           { border-color: var(--cs) !important; }
    .border-b-\\[\\#1e5fa8\\]         { border-bottom-color: var(--cs) !important; }
    .border-t-\\[\\#1e5fa8\\]         { border-top-color: var(--cs) !important; }
    .border-b-2.border-\\[\\#1e5fa8\\] { border-bottom-color: var(--cs) !important; }

    /* ── Focus rings ── */
    .focus\\:ring-\\[\\#1e5fa8\\]\\/30:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent) !important;
    }
    .focus\\:ring-2:focus {
      --tw-ring-color: color-mix(in srgb, var(--cs) 30%, transparent);
    }

    /* ── Misc ── */
    .accent-\\[\\#1e5fa8\\] { accent-color: var(--cs) !important; }
    .bg-\\[\\#e8f4fd\\] {
      background-color: color-mix(in srgb, var(--cs) 12%, white) !important;
    }

    /* ═══════════════════════════════════════════════
       MODO OSCURO — hoja de traducción, sobre el oscuro navy del kit
       (B1 del rediseño: antes era el gris de Material #121212/#1E1E1E…)
       Fondo:   var(--fondo)  (antes #121212, dp0)
       Card:    var(--sup)    (antes #1E1E1E, dp1)
       Campo:   var(--sup2)   (antes #242424, dp2)
       Hover:   --sup2 aclarado 8 % y 16 % (antes #2C2C2C y #383838)
       Texto primario:    rgba(255,255,255,0.87)
       Texto secundario:  rgba(255,255,255,0.60)
       Texto desactivado: rgba(255,255,255,0.38)
       Bordes/divisores:  rgba(255,255,255,0.12)
    ═══════════════════════════════════════════════ */

    /* ── Raíz ── */
    html.dark body {
      background-color: var(--fondo) !important;
      color: rgba(255,255,255,0.87) !important;
    }
    html.dark .min-h-full { background-color: var(--fondo) !important; }

    /* ── Superficies / cards ── */
    html.dark .bg-white          { background-color: var(--sup) !important; }
    html.dark .bg-slate-50       { background-color: var(--sup2) !important; }
    html.dark .bg-slate-100      { background-color: color-mix(in srgb, var(--sup2) 92%, #fff) !important; }
    html.dark .bg-slate-200      { background-color: color-mix(in srgb, var(--sup2) 84%, #fff) !important; }

    /* ── Bordes — muy sutiles, Material usa 12% blanco ── */
    html.dark .border-slate-200,
    html.dark .border-slate-200\\/80  { border-color: rgba(255,255,255,0.12) !important; }
    html.dark .border-slate-100       { border-color: rgba(255,255,255,0.08) !important; }
    html.dark .border-slate-300       { border-color: rgba(255,255,255,0.16) !important; }
    html.dark .divide-slate-100 > * + *,
    html.dark .divide-slate-200 > * + * { border-color: rgba(255,255,255,0.08) !important; }

    /* ── Texto ── */
    /* Texto oscuro macOS → blanco/87 */
    html.dark .text-\\[\\#1d1d1f\\]     { color: rgba(255,255,255,0.87) !important; }
    /* Texto secundario macOS → blanco/60 */
    html.dark .text-\\[\\#86868b\\]     { color: rgba(255,255,255,0.60) !important; }

    html.dark .text-slate-900    { color: rgba(255,255,255,0.87) !important; }
    html.dark .text-slate-800    { color: rgba(255,255,255,0.87) !important; }
    html.dark .text-slate-700    { color: rgba(255,255,255,0.75) !important; }
    html.dark .text-slate-600    { color: rgba(255,255,255,0.60) !important; }
    html.dark .text-slate-500    { color: rgba(255,255,255,0.50) !important; }
    html.dark .text-slate-400    { color: rgba(255,255,255,0.38) !important; }
    html.dark .text-slate-300    { color: rgba(255,255,255,0.28) !important; }

    /* ── Colores primarios desaturados en dark ── */
    /* Evita que el azul "vibre" sobre el fondo oscuro */
    html.dark .text-\\[\\#1e5fa8\\],
    html.dark .hover\\:text-\\[\\#1e5fa8\\]:hover { color: #60a5fa !important; }
    html.dark .text-\\[\\#1a3a5c\\],
    html.dark .hover\\:text-\\[\\#1a3a5c\\]:hover { color: #93c5fd !important; }
    html.dark .text-emerald-600   { color: #34d399 !important; }
    html.dark .text-red-600       { color: #f87171 !important; }
    html.dark .text-red-500       { color: #f87171 !important; }
    html.dark .text-amber-700     { color: #fbbf24 !important; }
    html.dark .text-blue-600      { color: #60a5fa !important; }

    /* ── Inputs / textareas / selects ── */
    html.dark input:not([type="color"]),
    html.dark textarea,
    html.dark select {
      background-color: var(--sup2) !important;
      color: rgba(255,255,255,0.87) !important;
      border-color: rgba(255,255,255,0.12) !important;
    }
    html.dark input::placeholder,
    html.dark textarea::placeholder { color: rgba(255,255,255,0.38) !important; }

    /* ── Hover states ── */
    html.dark .hover\\:bg-slate-50:hover,
    html.dark .hover\\:bg-slate-50\\/80:hover { background-color: color-mix(in srgb, var(--sup2) 92%, #fff) !important; }
    html.dark .hover\\:bg-slate-100:hover     { background-color: color-mix(in srgb, var(--sup2) 84%, #fff) !important; }

    /* ── Sombras — Material las elimina, usa elevación por color ── */
    html.dark .shadow-sm  { box-shadow: none !important; }
    html.dark .shadow-md  { box-shadow: none !important; }
    html.dark .shadow-xl  {
      box-shadow: 0 20px 40px rgba(0,0,0,0.8) !important;
    }

    /* ── Scrollbar ── */
    html.dark ::-webkit-scrollbar-track { background: var(--sup) !important; }
    html.dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16) !important; border-radius: 3px; }
    html.dark ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28) !important; }

    /* ── Prose (ReactMarkdown) ── */
    html.dark .prose p,
    html.dark .prose li     { color: rgba(255,255,255,0.75) !important; }
    html.dark .prose strong { color: rgba(255,255,255,0.87) !important; }
    html.dark .prose h1, html.dark .prose h2,
    html.dark .prose h3, html.dark .prose h4 { color: #93c5fd !important; }

    /* ATENCION: ESTA HOJA TIENE UNA SEGUNDA MITAD, Y VIVE EN app/globals.css
       (busca «AMPLIACION DE LA HOJA DE TRADUCCION»). Alli estan el escalon 100
       de cada color, la tinta de los escalones 700-900, las variantes de estado
       (disabled:, hover:, focus:) y la familia gray. Estan alla y no aqui
       porque no dependen de --cp / --cs y asi no se reconstruyen en cada
       render. Antes de anadir una regla, mira si le toca a este archivo o al
       otro — y NO la dupliques: este <style> se inserta despues, asi que a
       igualdad de peso gana el y la copia de alla quedaria muerta.
       ATENCION 2: este comentario NO puede llevar comillas invertidas. Todo el
       bloque es un template literal de JS y una comilla invertida lo cierra. */

    /* ── Badges de color — usar tint suave, no bloques sólidos oscuros ── */
    html.dark .bg-blue-50    { background-color: rgba(59,130,246,0.14)  !important; }
    html.dark .bg-emerald-50 { background-color: rgba(16,185,129,0.14)  !important; }
    html.dark .bg-red-50     { background-color: rgba(239,68,68,0.14)   !important; }
    html.dark .bg-amber-50   { background-color: rgba(245,158,11,0.14)  !important; }
    html.dark .bg-violet-50  { background-color: rgba(139,92,246,0.14)  !important; }
    html.dark .bg-indigo-50  { background-color: rgba(99,102,241,0.14)  !important; }
    html.dark .bg-teal-50    { background-color: rgba(20,184,166,0.14)  !important; }
    html.dark .bg-rose-50    { background-color: rgba(244,63,94,0.14)   !important; }
    html.dark .bg-orange-50  { background-color: rgba(249,115,22,0.14)  !important; }
    html.dark .bg-green-50   { background-color: rgba(34,197,94,0.14)   !important; }
    html.dark .bg-sky-50     { background-color: rgba(14,165,233,0.14)  !important; }

    /* Bordes de badges */
    html.dark .border-blue-100,
    html.dark .border-blue-200    { border-color: rgba(59,130,246,0.25)  !important; }
    html.dark .border-emerald-100,
    html.dark .border-emerald-200 { border-color: rgba(16,185,129,0.25)  !important; }
    html.dark .border-red-100,
    html.dark .border-red-200     { border-color: rgba(239,68,68,0.25)   !important; }
    html.dark .border-amber-100,
    html.dark .border-amber-200   { border-color: rgba(245,158,11,0.25)  !important; }

    /* Texto de badges — desaturado */
    html.dark .text-blue-600,
    html.dark .text-\\[\\#1a3a5c\\]   { color: #93c5fd !important; }
    html.dark .text-emerald-700      { color: #6ee7b7 !important; }
    html.dark .text-red-700          { color: #fca5a5 !important; }
    html.dark .text-amber-700        { color: #fcd34d !important; }
    html.dark .text-blue-400         { color: #7dd3fc !important; }

    /* ── Modales ── */
    html.dark .fixed.inset-0.bg-black\\/50 { background-color: rgba(0,0,0,0.8) !important; }

    /* ── Tabs ── */
    html.dark .border-b.border-slate-200 { border-color: rgba(255,255,255,0.12) !important; }

    /* ── Gradientes del header de tarjeta — se mantienen, son parte del branding ── */
    /* Los gradientes azules del header de TarjetaPaciente se ven bien en dark */
  ` + cssMarcaDerivada(colorPrimario, colorSecundario)

  // Memoizado: este provider re-renderiza cada vez que useClinica revalida,
  // y con el objeto literal arrastraba a todo (app) detras.
  const value = useMemo(() => ({ dark, toggle }), [dark, toggle])

  return (
    <Ctx.Provider value={value}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </Ctx.Provider>
  )
}
