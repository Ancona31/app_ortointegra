'use client'

import SeccionNav from '@/components/landing/sections/SeccionNav'
import SeccionHero from '@/components/landing/sections/SeccionHero'
import SeccionProblema from '@/components/landing/sections/SeccionProblema'
import SeccionFeatures from '@/components/landing/sections/SeccionFeatures'
import SeccionIA from '@/components/landing/sections/SeccionIA'
import SeccionExpediente from '@/components/landing/sections/SeccionExpediente'
import SeccionPortabilidad from '@/components/landing/sections/SeccionPortabilidad'
import SeccionInterfaz from '@/components/landing/sections/SeccionInterfaz'
import SeccionHistoria from '@/components/landing/sections/SeccionHistoria'
import SeccionControl from '@/components/landing/sections/SeccionControl'
import SeccionSeguridad from '@/components/landing/sections/SeccionSeguridad'
import SeccionFAQ from '@/components/landing/sections/SeccionFAQ'
import SeccionCTA from '@/components/landing/sections/SeccionCTA'
import SeccionFooter from '@/components/landing/sections/SeccionFooter'

/* Sin `fontFamily` inline en el <main>: la familia la hereda de la utilidad
   `font-lp` del layout de este grupo (§3.2). Un inline aquí volvería a
   pisarla y el fallo se diagnosticaría como "Inter no cargó", que sería
   falso. El `WebkitFontSmoothing` inline también salió: estaba declarado
   tres veces — globals.css `body` y el `antialiased` de layout.tsx:19. */
export default function HomePage() {
  return (
    <main className="min-h-screen relative">
      <SeccionNav />
      <SeccionHero />
      <SeccionProblema />
      <SeccionFeatures />
      <SeccionIA />
      <SeccionExpediente />
      <SeccionPortabilidad />
      <SeccionInterfaz />
      <SeccionHistoria />
      {/* ⚠️ EL ORDEN DE ESTE ARCHIVO NO ES EL DE LA TABLA DE §3.4, y esta
          sección lo hace visible. La tabla numera Seguridad=10 y Historia=11;
          aquí Historia va ANTES que Seguridad, así que "entre Seguridad e
          Historia" resuelve a este hueco, el único que las tiene por vecinas.
          Consecuencia: SeccionControl cierra la parte personal y ABRE el
          bloque de confianza, en vez de cerrarlo. La divergencia de orden es
          previa (también Portabilidad e Interfaz están intercambiadas
          respecto a §3.4·9 y §3.4·8) y no se resuelve aquí; si alguna tanda
          la reordena, esta sección debe viajar con Seguridad, no quedarse
          pegada a Historia. */}
      <SeccionControl />
      <SeccionSeguridad />
      {/* ⚠️ LA FAQ VA AQUÍ, PEGADA AL CIERRE, Y NO ES INDIFERENTE.
          Una FAQ es el último manejador de objeciones: su trabajo es despejar
          lo que frena el clic, justo antes de pedirlo. Ponerla más arriba
          interrumpe la demostración del producto (los teasers y el bento) con
          letra pequeña, y ponerla después del CTA la entierra donde nadie
          baja.
          Cuando F5 monte §12 (Precio + beta), esta sección NO se mueve: 12b
          queda entre el precio y el cierre, que es el orden canónico —
          "cuánto cuesta" → "sí, pero…" → "empieza". Su posición es estable en
          el código y en la tabla de §3.4, cosa que no puede decirse del resto
          del archivo (ver el aviso de arriba). */}
      <SeccionFAQ />
      <SeccionCTA />
      <SeccionFooter />
    </main>
  )
}
