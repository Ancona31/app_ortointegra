import { DollarSign } from 'lucide-react'
import type { ReactElement } from 'react'
import PlaceholderSection from '@/components/super-admin/PlaceholderSection'

export default function IngresosPage(): ReactElement {
  return (
    <PlaceholderSection
      title="Ingresos"
      subtitle="MRR, conversiones y transacciones recientes"
      icon={DollarSign}
      description="Esta sección incluirá MRR, clínicas en trial, conversión trial→pago, suscripciones que vencen y transacciones recientes de Stripe. En desarrollo."
    />
  )
}
