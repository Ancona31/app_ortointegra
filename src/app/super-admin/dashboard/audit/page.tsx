import { ScrollText } from 'lucide-react'
import type { ReactElement } from 'react'
import PlaceholderSection from '@/components/super-admin/PlaceholderSection'

export default function AuditPage(): ReactElement {
  return (
    <PlaceholderSection
      title="Audit log"
      subtitle="Registro inmutable de acciones del sistema"
      icon={ScrollText}
      description="Esta sección mostrará el audit_log_view con filtros por usuario, acción, IP y rango de fechas, con paginación y exportación a CSV. Las acciones de super_admin del nuevo dashboard ya se están registrando. En desarrollo."
    />
  )
}
