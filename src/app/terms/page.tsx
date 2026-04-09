import type { Metadata } from 'next'
import TerminosContent from '@/components/legal/TerminosContent'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Spinus®',
  description:
    'Términos y condiciones de uso de la plataforma Spinus®, expedientes clínicos electrónicos con asistencia de IA.',
}

export default function TermsPage() {
  return <TerminosContent />
}
