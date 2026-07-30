'use client'

import NeuralBackground from '@/components/ui/NeuralBackground'
import SeccionNav from '@/components/landing/sections/SeccionNav'
import SeccionHero from '@/components/landing/sections/SeccionHero'
import SeccionMockup from '@/components/landing/sections/SeccionMockup'
import SeccionFeatures from '@/components/landing/sections/SeccionFeatures'
import SeccionIA from '@/components/landing/sections/SeccionIA'
import SeccionExpediente from '@/components/landing/sections/SeccionExpediente'
import SeccionPortabilidad from '@/components/landing/sections/SeccionPortabilidad'
import SeccionInterfaz from '@/components/landing/sections/SeccionInterfaz'
import SeccionHistoria from '@/components/landing/sections/SeccionHistoria'
import SeccionCalculadora from '@/components/landing/sections/SeccionCalculadora'
import SeccionSeguridad from '@/components/landing/sections/SeccionSeguridad'
import SeccionCTA from '@/components/landing/sections/SeccionCTA'
import SeccionFooter from '@/components/landing/sections/SeccionFooter'

export default function HomePage() {
  return (
    <main className="min-h-screen relative" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* Fondo animado Neural Data Nexus — fixed z-0, detrás del contenido */}
      <NeuralBackground />

      {/* Wrapper de contenido — z-[1] para quedar sobre el canvas */}
      <div className="relative z-[1]">
        <SeccionNav />
        <SeccionHero />
        <SeccionMockup />
        <SeccionFeatures />
        <SeccionIA />
        <SeccionExpediente />
        <SeccionPortabilidad />
        <SeccionInterfaz />
        <SeccionHistoria />
        <SeccionCalculadora />
        <SeccionSeguridad />
        <SeccionCTA />
        <SeccionFooter />
      </div>{/* cierre wrapper z-[1] */}
    </main>
  )
}
