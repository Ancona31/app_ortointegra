import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import PageHeader from './PageHeader'

interface Props {
  title: string
  subtitle: string
  icon: LucideIcon
  description: string
}

export default function PlaceholderSection({
  title,
  subtitle,
  icon: Icon,
  description,
}: Props): ReactElement {
  return (
    <div className="px-6 sm:px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1e5fa8]/10 flex items-center justify-center text-[#1e5fa8] mb-4">
          <Icon size={22} />
        </div>
        <h2 className="text-[15px] font-semibold text-slate-100 mb-2">Próximamente</h2>
        <p className="text-[13px] text-slate-500 max-w-md">{description}</p>
      </div>
    </div>
  )
}
