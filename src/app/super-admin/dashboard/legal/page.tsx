import { Scale } from 'lucide-react'
import type { ReactElement } from 'react'
import PlaceholderSection from '@/components/super-admin/PlaceholderSection'

export default function LegalPage(): ReactElement {
  return (
    <PlaceholderSection
      title="Legal / ARCO"
      subtitle="Solicitudes ARCO, consentimientos, anonimización"
      icon={Scale}
      description="Esta sección mostrará solicitudes ARCO pendientes/completadas, pacientes anonimizados y barra de progreso de consentimientos otorgados. En desarrollo."
    />
  )
}
