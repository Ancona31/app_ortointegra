import { AlertTriangle } from 'lucide-react'
import type { ReactElement } from 'react'
import PlaceholderSection from '@/components/super-admin/PlaceholderSection'

export default function AlertasPage(): ReactElement {
  return (
    <PlaceholderSection
      title="Alertas"
      subtitle="Suscripciones por vencer, pagos fallidos, retención"
      icon={AlertTriangle}
      description="Esta sección incluirá alertas activas (vencimientos, pagos fallidos, usuarios inactivos, intentos de login excesivos, clínicas sin admin) y métricas de retención. En desarrollo."
    />
  )
}
