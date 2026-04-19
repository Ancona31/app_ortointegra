'use client'

import { useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

type DashboardCardProps = {
  icon: ElementType
  iconColor: string
  title: string
  summary: string
  children?: ReactNode
  defaultExpanded?: boolean
}

export default function DashboardCard({
  icon: Icon,
  iconColor,
  title,
  summary,
  children,
  defaultExpanded = false,
}: DashboardCardProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded)

  return (
    <div
      className="group bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 ease-out hover:border-slate-300 hover:shadow-sm"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconColor }}
        >
          <Icon size={16} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{summary}</div>
        </div>

        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform duration-200 ease-out shrink-0"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: expanded ? '1000px' : '0px' }}
        aria-hidden={!expanded}
      >
        {children ? (
          <div className="px-5 pb-5 pt-4 mt-1 border-t border-slate-100">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
