'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { NAV } from '@/components/landing/motion/tokens'

/* Nav — sticky necesita z alto para quedar sobre todo

   F1.3·b2: excepción 1 al borde 0.5px/#e6ebf2 — es chrome, no superficie.
   El `bg-white/80` + `backdrop-blur-xl` SÍ se quedan (§4.4): aquí el
   contenido pasa por debajo al hacer scroll, que es justo el caso que el
   blur resuelve. El Footer no, y por eso allí se quitó. No unificarlos. */
/* ⚠️ F1.3·e5 — el `bg-white/80` NO pasa a --lp-surface y es deliberado.
   --lp-surface es blanco OPACO; lo que sostiene el chrome aquí es la
   translucidez que alimenta al `backdrop-blur-xl`. Cablearlo a la variable con
   modificador de opacidad cambiaría el modo de mezcla por un color-mix en oklab
   para no ganar nada. El borde sí va a --lp-border.
   ⚠️ F2.a·a5 — ESE ARGUMENTO SIGUE VIGENTE, PERO LAS CLASES CAMBIARON DE
   ELEMENTO: `bg-white/80`, el blur y el borde ya no viven en el `<header>`,
   sino en la capa de fondo de abajo, que es la que anima su opacidad. La
   translucidez no se tocó — solo se movió. */

/* ═══ §4.4 · NAV LIGADO AL SCROLL (F2.a·a5) ═══
   Tres capas, un solo `useScroll` (§4.3·4). El progreso NO pasa por estado de
   React (§4.3·2): son `MotionValue` derivados con `useTransform`.

   ⚠️⚠️ NUNCA ENVUELVAS ESTE COMPONENTE EN UN `motion.div`. `(landing)/layout.tsx:50-52`
   lo advierte con nombre y apellido: un `transform`, un `will-change` o un
   `contain` en CUALQUIER ancestro rompe el `sticky top-0` — sin error de build,
   sin aviso de lint, y el síntoma (un nav que deja de pegarse) se diagnostica
   mal casi siempre. Y `motion` escribe `will-change` en cuanto anima algo.
   Por eso aquí NO anima el `<header>`: animan sus HIJOS. Un elemento sticky
   con transform propio seguiría siendo sticky, pero no hace falta gastarlo.

   ⚠️ EL BORDE SE MOVIÓ AL INTERIOR DE LA CAPA DE FONDO, así que el `<header>`
   pierde los 0.5px que el `border-b` le añadía a su caja. El hero arranca
   medio píxel más arriba. Es invisible y se anota solo porque en este proyecto
   las costuras se miden. */
export default function SeccionNav() {
  const { scrollY, scrollYProgress } = useScroll()

  /* Fondo: transparente arriba del todo → sólido en cuanto pasan 64px.
     Se anima OPACIDAD y no `background-color` porque §4.3·1 solo admite
     `transform` y `opacity` — un color de fondo animado repinta en cada
     cuadro. Por eso el fondo es una capa propia y no una clase del header. */
  const opacidadFondo = useTransform(scrollY, [0, NAV.umbral], [0, 1])
  const escalaLogo = useTransform(scrollY, [0, NAV.umbral], [1, NAV.escalaLogo])

  return (
    <header className="sticky top-0 z-50">
      {/* CAPA 1 — fondo. `absolute inset-0` resuelve contra el `<header>`, que
          por ser `sticky` ya es un elemento posicionado: no hace falta añadirle
          `relative` (y añadírselo sería redundante, no incorrecto).
          `data-lp-reveal` SÍ va aquí: bajo reduced-motion la regla de
          globals.css:922 lo deja en `opacity: 1`, o sea el nav sólido de
          siempre. Es exactamente el estado correcto — la legibilidad del chrome
          no es decorativa y no puede depender de una preferencia de
          movimiento. */}
      <motion.div
        aria-hidden
        data-lp-reveal=""
        className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b-[0.5px] border-[var(--lp-border)]"
        style={{ opacity: opacidadFondo }}
      />
      {/* `relative` obligatorio: sin él el contenido del nav queda POR DEBAJO
          de la capa de fondo, que es un hermano anterior en el orden de
          pintado. */}
      <nav className="relative mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
        {/* F1.3·c3 — `gap-2` (8), no gap-2.5: 10 no está en la escala. Mismo
            cambio en el lockup del Footer, que es el mismo lockup. */}
        {/* CAPA 2 — el lockup encoge. Escala el LOCKUP COMPLETO (isotipo +
            wordmark), no solo la imagen: escalando únicamente el isotipo, el
            `gap-2` se mantendría fijo mientras su vecino mengua y el conjunto
            se vería descuadrado. `origin-left` para que encoja hacia el borde
            de la página y no hacia su propio centro, que lo despegaría del
            margen.
            ⚠️ LA BARRA NO ENCOGE CON ÉL. La `h-14` es fija y no se anima:
            animar la altura es relayout (§4.3·1). Decisión consciente del PM
            (B5), no un pendiente — es menos de lo que hacen las referencias.
            `data-lp-reveal`: bajo reduced-motion `transform: none` deja el
            logo a tamaño completo, que es su estado de reposo arriba de la
            página. Correcto sin trabajo extra. */}
        <motion.div
          data-lp-reveal=""
          className="flex items-center gap-2 origin-left"
          style={{ scale: escalaLogo }}
        >
          {/* ⚠️ `sizes` Y `loading` NO SON OPCIONALES AQUÍ, y sin ellos esto era
              el peor elemento de la página en relación peso/píxel pintado.
              Sin `sizes`, `next/image` no sabe a qué tamaño se va a pintar y el
              navegador se llevaba el candidato de **1920px de ancho** del
              srcset — medido en el HTML del build— para un isotipo que ocupa
              37×36 CSS px. Con `sizes="40px"` elige de la escala pequeña
              (48/96px), que es lo que de verdad hace falta incluso a 3x.
              Y `loading="eager"`: estaba en `lazy` estando SOBRE EL PLIEGUE, o
              sea que el navegador lo aplazaba a propósito. No lleva `priority`
              a propósito: eso añadiría un `<link rel=preload>` que competiría
              con el de la captura del hero, que sí es el LCP.
              `width`/`height` se quedan en los 800×777 intrínsecos: son los que
              fijan la proporción, no el tamaño de descarga — de eso manda
              `sizes`. */}
          <Image
            src="/logo-spinus.png"
            alt="Spinus"
            width={800}
            height={777}
            sizes="40px"
            loading="eager"
            className="object-contain h-9 w-auto"
          />
          {/* ═══ EL WORDMARK NO TOMA ROL DE TEXTO (F1.3·d4) ═══
              Se queda en 17px. Es el pendiente que d1 dejó abierto y lo cierra
              el PM en d4: "Spinus" junto al isotipo no es texto de la landing,
              es la mitad tipográfica de un LOGOTIPO. Los roles de la tanda (d)
              —kicker, titular, bajada, cuerpo, H3, botón, caption— existen para
              que el texto tenga una escala común; una marca no participa de esa
              escala porque no se lee como texto, se reconoce como imagen.

              Consecuencia práctica: que estos 17px coincidan con el cuerpo
              (17px) es CASUALIDAD, no herencia. Si una tanda futura mueve el
              cuerpo, el wordmark NO se mueve con él. Y su `tracking-tight`
              (-0.025em) tampoco es el de ningún rol — es el ajuste del lockup.
              No lo barras. */}
          <span className="text-[17px] font-bold text-[var(--lp-ink-900)] tracking-tight">Spinus</span>
        </motion.div>
        {/* Jerarquía §7·0: el sólido es para el visitante nuevo ("Crear
            cuenta"), no para el que ya tiene cuenta. "Planes" se oculta en
            móvil; los otros dos no, para que el sólido visible ahí sea el
            correcto. */}
        {/* F1.3·c2 — los tres son CONTROLES: 12px (`rounded-xl`) los tres.
            "Crear cuenta" ya estaba bien; los dos links subieron desde
            rounded-lg (8px), que es el radio de los cuadros de icono de 32px,
            no el de un control. El hover de fondo hace visible el radio de los
            links, así que la diferencia se notaba al pasar el cursor. */}
        {/* ═══ ROL BOTÓN (F1.3·d4) ═══
            15px · tracking -0.01em · leading-none (§3.2). SIETE controles:
            los tres de este nav, los dos del hero y los dos de SeccionCTA.

            Los tres de aquí SUBEN de 13 a 15; los cuatro grandes ya estaban
            en 15 y solo reciben tracking y leading. Que el nav y los CTA
            grandes compartan tamaño es deliberado: lo que los distingue es el
            padding y el fondo, no la letra. Un control de 13px en la barra
            superior leía como caption con fondo, no como algo pulsable.

            ⚠️ `leading-none` (1.0) NO es capricho: en un control el alto lo
            fija el padding, y cualquier leading > 1 mete alto fantasma que
            descentra el texto respecto a la caja. Los siete son de una sola
            línea, así que 1.0 no puede partir nada. Si algún día un botón
            necesita dos líneas, ese botón sale del rol — no subas el leading
            de los siete.

            ⚠️ El rol NO define peso ni radio. Aquí conviven `font-medium`
            (los dos links) y `font-semibold` (el sólido), y el radio de 12px
            lo fijó c2. Nada de eso lo toca d4. */}
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="hidden sm:inline-flex text-[15px] font-medium text-[var(--lp-ink-700)] hover:text-[var(--lp-ink-900)] transition-colors duration-[var(--sp-dur-micro)] px-3 py-1.5 rounded-xl hover:bg-[var(--lp-hover-surface)] tracking-[-0.01em] leading-none"
          >
            Planes
          </Link>
          <Link
            href="/login"
            className="inline-flex text-[15px] font-medium text-[var(--lp-ink-700)] hover:text-[var(--lp-ink-900)] transition-colors duration-[var(--sp-dur-micro)] px-3 py-1.5 rounded-xl hover:bg-[var(--lp-hover-surface)] tracking-[-0.01em] leading-none"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-[15px] font-semibold text-[var(--lp-ink-inverse)] bg-gradient-to-r from-[var(--lp-navy)] to-[var(--lp-accent)] px-4 py-2 rounded-xl hover:shadow-[0_4px_24px_rgb(var(--lp-accent-rgb)/0.3)] active:scale-[0.97] transition-all duration-[var(--sp-dur-micro)] tracking-[-0.01em] leading-none"
          >
            Crear cuenta
          </Link>
        </div>
      </nav>

      {/* ═══ CAPA 3 — BARRA DE PROGRESO ═══
          `scaleX` sobre una barra de ancho completo, con `origin-left`. Es
          `transform`, así que cumple §4.3·1; animar `width` habría sido
          relayout en cada cuadro. Va después del `<nav>` para pintarse encima
          del borde de la capa de fondo.
          El alto sale de `NAV.altoBarra` por `style` y no de una clase: un
          `h-[2px]` sería un número suelto en el componente.

          ⚠️⚠️ ESTA CAPA NO LLEVA `data-lp-reveal`, Y ES EL ÚNICO SITIO DE LA
          LANDING DONDE ESE ATRIBUTO PRODUCIRÍA EL ESTADO EQUIVOCADO.
          La regla de `globals.css:922-926` fuerza `transform: none !important`
          porque asume que "estado final de un reveal" = sin transform. Para un
          fade o un desplazamiento eso es correcto. Para un `scaleX` de
          progreso significa `scaleX(1)`, o sea **barra llena y permanente**,
          que es la mentira exacta que una barra de progreso no puede contar:
          diría "has llegado al final" nada más cargar la página.
          Si añades el atributo aquí "por coherencia", rompes la barra. La
          coherencia del sistema está en el resto de capas, no en esta.

          ⚠️ Y POR ESO LA BARRA SIGUE VIVA BAJO reduced-motion — decisión
          razonada, no descuido. La preferencia existe para reducir movimiento
          que el usuario no provocó o que se mueve más de lo que él se mueve:
          parallax, autoplay, deslizamientos con inercia. Esta barra es un
          reflejo 1:1 de su propia acción, sin easing, sin retardo y sin
          recorrido propio — si el usuario no scrollea, no se mueve nada. Y es
          INFORMACIÓN: cuánto queda de página no está dicho en ningún otro
          sitio de la landing. Congelarla no reduciría movimiento, solo
          borraría el dato. Las otras dos capas sí se congelan, que es donde la
          preferencia sí tiene sentido.

          `aria-hidden` porque duplica visualmente lo que la barra de scroll
          nativa ya expone a la tecnología asistiva. Un `role="progressbar"`
          exigiría mantener `aria-valuenow`, y eso obliga a pasar el progreso
          por estado de React — justo lo que §4.3·2 prohíbe. */}
      <motion.div
        aria-hidden
        className="absolute bottom-0 inset-x-0 origin-left bg-[var(--lp-accent)]"
        style={{ height: NAV.altoBarra, scaleX: scrollYProgress }}
      />
    </header>
  )
}
