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

export default function HomePage() {
  return (
    <main className="min-h-screen relative" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
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
