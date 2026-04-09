import type { ReactElement, ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export default function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: ChartCardProps): ReactElement {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-slate-100">{title}</h3>
        {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p> : null}
      </div>
      <div className="w-full">{children}</div>
    </div>
  )
}
