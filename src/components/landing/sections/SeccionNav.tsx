'use client'

import Link from 'next/link'
import Image from 'next/image'

/* Nav — sticky necesita z alto para quedar sobre todo

   F1.3·b2: excepción 1 al borde 0.5px/#e6ebf2 — es chrome, no superficie.
   El `bg-white/80` + `backdrop-blur-xl` SÍ se quedan (§4.4): aquí el
   contenido pasa por debajo al hacer scroll, que es justo el caso que el
   blur resuelve. El Footer no, y por eso allí se quitó. No unificarlos. */
/* ⚠️ F1.3·e5 — el `bg-white/80` de abajo NO pasa a --lp-surface y es
   deliberado. --lp-surface es blanco OPACO; lo que sostiene el chrome aquí es
   la translucidez que alimenta al `backdrop-blur-xl`. Cablearlo a la variable
   con modificador de opacidad cambiaría el modo de mezcla por un color-mix en
   oklab para no ganar nada. El borde sí va a --lp-border. */
export default function SeccionNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b-[0.5px] border-[var(--lp-border)]">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
        {/* F1.3·c3 — `gap-2` (8), no gap-2.5: 10 no está en la escala. Mismo
            cambio en el lockup del Footer, que es el mismo lockup. */}
        <div className="flex items-center gap-2">
          <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-9 w-auto" />
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
        </div>
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
    </header>
  )
}
