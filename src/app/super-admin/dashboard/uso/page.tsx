import { Activity } from 'lucide-react'
import type { ReactElement } from 'react'
import PlaceholderSection from '@/components/super-admin/PlaceholderSection'

export default function UsoPage(): ReactElement {
  return (
    <PlaceholderSection
      title="Uso de plataforma"
      subtitle="Funciones más usadas, horarios pico, top médicos"
      icon={Activity}
      description="Esta sección incluirá ranking de funciones, heatmap de horarios pico, top médicos por consultas, documentos por tipo y uso de IA detallado. En desarrollo."
    />
  )
}
