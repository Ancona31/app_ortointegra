'use client'

import Link from 'next/link'
import type { ElementType, MouseEvent } from 'react'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type ExpedienteCardProps = {
  label: string
  title: string
  subtitle?: string
  icon: ElementType
  iconColor: string
  variant?: 'default' | 'cta'
  onClick?: () => void
  href?: string
}

export default function ExpedienteCard({
  label,
  title,
  subtitle,
  icon: Icon,
  iconColor,
  variant = 'default',
  onClick,
  href,
}: ExpedienteCardProps) {
  const isCta = variant === 'cta'

  const containerClass = isCta
    ? 'group rounded-2xl p-[18px] flex flex-col min-h-[140px] cursor-pointer transition-all duration-200 border hover:shadow-md hover:-translate-y-[1px] text-left w-full'
    : 'group bg-white border border-slate-200 rounded-2xl p-[18px] flex flex-col min-h-[140px] cursor-pointer transition-all duration-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-[1px] text-left w-full'

  const containerStyle = isCta
    ? { background: 'var(--cp)', borderColor: 'var(--cp)', transitionTimingFunction: IOS_EASING }
    : { transitionTimingFunction: IOS_EASING }

  const iconWrapStyle = isCta
    ? { background: 'rgba(255,255,255,0.15)' }
    : { background: iconColor }

  const labelClass = isCta
    ? 'text-[10px] font-semibold uppercase tracking-wider mb-1 text-white/70'
    : 'text-[10px] font-semibold uppercase tracking-wider mb-1 text-slate-500'

  const titleClass = isCta
    ? 'text-[17px] font-semibold text-white mb-1'
    : 'text-[15px] font-semibold text-slate-900 mb-1'

  const subtitleClass = isCta
    ? 'text-[13px] leading-relaxed mt-auto text-white/80'
    : 'text-[13px] leading-relaxed mt-auto text-slate-500'

  // Hover CTA: swap var(--cp) -> var(--cs) inline (CSS vars no son sombreables con Tailwind hover:)
  const hoverProps = isCta
    ? {
        onMouseEnter: (e: MouseEvent<HTMLElement>) => {
          e.currentTarget.style.background = 'var(--cs)'
          e.currentTarget.style.borderColor = 'var(--cs)'
        },
        onMouseLeave: (e: MouseEvent<HTMLElement>) => {
          e.currentTarget.style.background = 'var(--cp)'
          e.currentTarget.style.borderColor = 'var(--cp)'
        },
      }
    : {}

  const inner = (
    <>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3"
        style={iconWrapStyle}
      >
        <Icon size={18} />
      </div>
      <div className={labelClass}>{label}</div>
      <div className={titleClass}>{title}</div>
      {subtitle && <div className={subtitleClass}>{subtitle}</div>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={containerClass} style={containerStyle} {...hoverProps}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={containerClass} style={containerStyle} {...hoverProps}>
        {inner}
      </button>
    )
  }
  return (
    <div className={containerClass} style={containerStyle} {...hoverProps}>
      {inner}
    </div>
  )
}
