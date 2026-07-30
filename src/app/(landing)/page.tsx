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
import SeccionSeguridad from '@/components/landing/sections/SeccionSeguridad'
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
      <SeccionSeguridad />
      <SeccionCTA />
      <SeccionFooter />
    </main>
  )
}
