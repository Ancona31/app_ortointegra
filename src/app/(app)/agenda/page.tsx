import AgendaCliente from './AgendaCliente'

/**
 * Server component mínimo. A1.4a sólo separa el cascarón de servidor del
 * cliente (`AgendaCliente.tsx`, antes este mismo archivo); todavía no pasa
 * datos — eso es A1.4c.
 *
 * Sin `<Suspense>`: `AgendaCliente` no usa `useSearchParams()` (lee
 * `window.location` a propósito, ver el comentario junto al `useEffect` del
 * enlace profundo en `AgendaCliente.tsx`), así que no hay nada que lo exija.
 */
export default function AgendaPage() {
  return <AgendaCliente />
}
