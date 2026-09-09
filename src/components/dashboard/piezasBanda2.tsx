'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/**
 * Las tres piezas que comparten las DOS columnas de la banda 2.
 *
 * ⚠️ EL ENCABEZADO ES COMPARTIDO A PROPÓSITO, y no por ahorrar ocho líneas. La
 * adenda §4 pide que los dos encabezados —«Atendidos recientemente» y
 * «Documentos»— tengan el MISMO nivel tipográfico y la MISMA altura fija de
 * 32 px, para que sus líneas base coincidan aunque uno lleve enlace y el otro
 * no; y §3 lo pone como criterio de aceptación. Con dos copias eso se cumple
 * hasta el primer retoque en una de ellas. Con una, no se puede romper por un
 * lado solo.
 */

/** Los 32 px de alto fijo del encabezado. Es el número del criterio. */
const ALTO_ENCABEZADO = 'h-8'

export function EncabezadoColumna({ titulo, enlace }: {
  titulo: string
  enlace?: { href: string; texto: string }
}) {
  return (
    <div className={`${ALTO_ENCABEZADO} flex items-center justify-between gap-[var(--sp-2-5)]`}>
      <h2 className="min-w-0 truncate text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">{titulo}</h2>
      {enlace && (
        <Link
          href={enlace.href}
          /* Sin precarga, como todo enlace nuevo del rediseño. */
          prefetch={false}
          className="shrink-0 whitespace-nowrap text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-primary)] hover:underline"
        >
          {enlace.texto}
        </Link>
      )}
    </div>
  )
}

/** Chip de acceso rápido al pie de una tarjeta de paciente. Siempre CREA. */
export function ChipAccion({ href, icono: Icono, texto }: {
  href: string
  icono: LucideIcon
  texto: string
}) {
  return (
    <Link
      href={href}
      /* ⚠️ SIN PRECARGA, Y NO ES NEGOCIABLE AQUÍ. Cuatro tarjetas por dos chips
         son ocho enlaces, más los cuatro de las tarjetas: doce. Cada `<Link>`
         con precarga cuesta 2 peticiones RSC y 2 invocaciones de lambda por
         carga del dashboard, se pulse o no (medido en producción). Son
         exactamente los que apagó `fcb2169`; encender uno revierte esa medida. */
      prefetch={false}
      className="inline-flex items-center gap-[var(--sp-1-5)] rounded-[var(--sp-r-btn-sm)] border border-[color:var(--sp-line-input)] bg-[var(--sp-surface)] px-[10px] py-[5px] text-[length:var(--sp-fs-legal)] font-semibold text-[var(--sp-ink-600)] transition-colors hover:bg-[var(--sp-surface-muted)] hover:text-[var(--sp-primary)]"
    >
      <Icono size={13} /> {texto}
    </Link>
  )
}

/**
 * El bloque de vacío y el de error de una columna: mismo cuerpo, distinto pie.
 * Se comparte porque las dos columnas tienen los dos estados y la adenda las
 * quiere leyendo igual; que una diga el fallo con una caja y la otra con un
 * renglón sería ruido.
 */
export function AvisoColumna({ icono: Icono, mensaje, onReintentar, enlace }: {
  icono: LucideIcon
  mensaje: string
  onReintentar?: () => void
  enlace?: { href: string; texto: string }
}) {
  return (
    <div className="mt-[var(--sp-gap-tiles)] flex flex-col items-center gap-[var(--sp-2-5)] rounded-[14px] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-pad-row-x)] py-[var(--sp-7)]">
      <Icono size={20} className="text-[var(--sp-ink-150)]" />
      <p className="text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="inline-flex items-center gap-[var(--sp-2)] min-h-[var(--sp-tap)] px-5 rounded-[var(--sp-r-btn)] border border-[color:var(--sp-line-input)] bg-[var(--sp-surface)] text-[length:var(--sp-fs-btn-sm)] font-semibold text-[var(--sp-ink-700)] transition-colors hover:bg-[var(--sp-surface-muted)]"
        >
          Reintentar
        </button>
      )}
      {enlace && (
        <Link href={enlace.href} prefetch={false} className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-primary)] hover:underline">
          {enlace.texto}
        </Link>
      )}
    </div>
  )
}
