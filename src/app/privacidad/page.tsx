import type { Metadata } from 'next'
import AvisoPrivacidadContent from '@/components/legal/AvisoPrivacidadContent'

export const metadata: Metadata = {
  title: 'Aviso de privacidad — Spinus',
  description: 'Aviso de privacidad integral de Spinus para sus usuarios: profesionales de la salud, personal de consultorios y clínicas, y visitantes.',
}

export default function PrivacidadPage() {
  return <AvisoPrivacidadContent />
}
