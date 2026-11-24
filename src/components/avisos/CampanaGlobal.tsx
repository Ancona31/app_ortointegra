'use client'

/**
 * src/components/avisos/CampanaGlobal.tsx — la campana de «Avisos» en TODA la
 * app (bloque «avisos globales», 2026-11-24, decisión de Angel).
 *
 * La monta el layout de `(app)`, fuera de `<main>`: no se desmonta al navegar
 * y una navegación suave no pide nada. El layout sólo la monta con la agenda
 * v2 ENCENDIDA (falla cerrado: apagada, ni este componente ni su chunk).
 *
 * ⚠️ EN `/agenda` NO SE PINTA NI AVISA: ahí manda `CampanaAgenda`, que además
 * lleva «Por confirmar». Dos campanas vivas a la vez repetirían cada burbuja.
 * Sólo la ruta exacta: `/agenda/configuracion` no tiene campana propia.
 *
 * ⚠️ `ssr: false` Y AQUÍ, NO EN EL LAYOUT: `next/dynamic` sólo parte el chunk
 * desde un componente de cliente (`lazy-loading.md` de Next 16.2.1), y la
 * campana no pinta nada en el servidor (cuelga de ranuras del DOM).
 */
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const CampanaAvisos = dynamic(() => import('@/components/avisos/CampanaAvisos'), { ssr: false })

export default function CampanaGlobal() {
  const pathname = usePathname()
  if (pathname === '/agenda') return null
  return <CampanaAvisos />
}
