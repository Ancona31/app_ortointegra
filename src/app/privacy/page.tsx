import type { Metadata } from 'next'
import AvisoPrivacidadContent from '@/components/legal/AvisoPrivacidadContent'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — Spinus®',
  description:
    'Aviso de privacidad integral de Spinus®, conforme a la LFPDPPP, NOM-004-SSA3-2012 y NOM-024-SSA3-2012.',
}

export default function PrivacyPage() {
  return <AvisoPrivacidadContent />
}
