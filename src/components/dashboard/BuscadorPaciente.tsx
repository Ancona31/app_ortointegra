import { Search } from 'lucide-react'

/**
 * La altura de los cuatro controles de la cabecera del dashboard, en un solo
 * sitio. La consume este componente y, importándola, los tres botones de
 * `src/app/(app)/dashboard/page.tsx`.
 *
 * ⚠️ VIVE AQUÍ Y NO EN LA PÁGINA porque el esqueleto de carga
 * (`components/ui/Skeleton.tsx`) también monta esta búsqueda, y una constante
 * declarada en una ruta no se puede importar desde un componente. La adenda §1
 * pide que los cuatro midan EXACTAMENTE lo mismo; si cada uno trae la suya,
 * basta un retoque para desalinearlos y nadie se entera. Los 48 de móvil cubren
 * además el mínimo táctil de `--sp-tap`. No la inlines.
 */
export const ALTO_CONTROL = 'h-12 lg:h-[50px]'

/**
 * El campo de búsqueda de la cabecera del dashboard.
 *
 * Lo montan los dos estados de la pantalla —la cabecera real y su esqueleto de
 * carga— y en los dos va vivo: no depende del perfil, así que no hay motivo
 * para inutilizarlo justo cuando la pantalla está tardando.
 *
 * No abre nada por su cuenta: recibe el manejador. En el dashboard, ése
 * sintetiza el Ctrl+K que escucha `CommandPalette`, de modo que el panel de
 * resultados sigue siendo el de siempre y no se toca. El rótulo del atajo es el
 * que esta pantalla ya publicaba.
 */
export default function BuscadorPaciente({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`${ALTO_CONTROL} order-1 flex items-center gap-[var(--sp-3)] px-4 text-left rounded-[var(--sp-r-btn)] border-[1.5px] border-[color:var(--sp-line-input)] bg-[var(--sp-surface)] transition-colors hover:border-[color:var(--sp-primary)] lg:flex-1 lg:min-w-[240px]`}
    >
      <Search size={17} className="shrink-0 text-[var(--sp-ink-350)]" />
      <span className="flex-1 min-w-0 truncate text-[length:var(--sp-fs-btn-sm)] text-[var(--sp-ink-300)]">
        Buscar paciente o folio
      </span>
      <kbd className="shrink-0 rounded-[var(--sp-r-btn-sm)] border border-[color:var(--sp-line-chip)] bg-[var(--sp-surface-muted)] px-2 py-1 font-mono text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
        Ctrl K
      </kbd>
    </button>
  )
}
