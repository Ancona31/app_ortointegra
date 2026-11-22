import { Search } from 'lucide-react'

/**
 * La altura de los controles de la cabecera del dashboard, en un solo sitio.
 *
 * ⚠️ VIVE AQUÍ Y NO EN LA PÁGINA porque el esqueleto de carga
 * (`components/ui/Skeleton.tsx`) también la usa, y una constante declarada en
 * una ruta no se puede importar desde un componente. Rediseño B5: 44 en
 * táctil y 40 en `ih`/`esc` (CALMA §2, dibujo; el área táctil la cubre).
 */
export const ALTO_CONTROL = 'h-11 ih:h-10 esc:h-10'

/**
 * El campo de búsqueda de la cabecera del dashboard.
 *
 * Lo montan los dos estados de la pantalla —la cabecera real y su esqueleto de
 * carga— y en los dos va vivo: no depende del perfil, así que no hay motivo
 * para inutilizarlo justo cuando la pantalla está tardando.
 *
 * No abre nada por su cuenta: recibe el manejador. En el dashboard, ése
 * sintetiza el Ctrl+K que escucha `CommandPalette`, de modo que el panel de
 * resultados sigue siendo el de siempre y no se toca. La pista del atajo sólo
 * se ve en `ih` y `esc` (maqueta `dashboard-final`), donde hay teclado.
 */
export default function BuscadorPaciente({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`${ALTO_CONTROL} k-pulsable order-1 flex w-full items-center gap-3 rounded-[12px] bg-sup2 px-3.5 text-left transition-colors`}
    >
      <Search aria-hidden="true" className="size-[18px] shrink-0 text-tinta2" />
      <span className="min-w-0 flex-1 truncate text-[15px] text-tinta2 esc:text-[14px]">
        Buscar paciente o folio
      </span>
      <kbd className="hidden shrink-0 rounded-[6px] bg-sup px-1.5 py-0.5 font-sans text-[12px] font-semibold text-tinta2 ih:inline esc:inline">
        Ctrl K
      </kbd>
    </button>
  )
}
