'use client'

import useSWR from 'swr'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import type { EstadoPerfil } from '@/lib/perfil/gate'

/**
 * El gate de perfil en `(app)` — Bloque B5, cuarta parte.
 *
 * `OnboardingModal` solo se montaba en `(launcher)/inicio`, así que un médico
 * que entraba directo a /agenda o a un expediente no lo veía nunca: lo único
 * que lo frenaba era el rechazo de la RLS pintado de rojo dentro del
 * formulario, sin decirle qué le falta ni dónde arreglarlo.
 *
 * ⚠️ VA EN EL LAYOUT Y NO EN UNA COMPROBACIÓN DE SERVIDOR. `(app)/layout.tsx`
 * NO se re-ejecuta al navegar entre páginas (Partial Rendering —
 * node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350), así que
 * un `redirect` ahí solo actuaría en la carga inicial y en las recargas duras.
 * Este componente se aprovecha de lo mismo por el otro lado: montado en el
 * layout, SIGUE MONTADO al cambiar de página, así que su `useSWR` pide UNA vez
 * por carga dura y no una por página. Lo que queda son las revalidaciones que
 * el `SWRConfig` de `(app)` ya regula (foco con tope de 5 min, reconexión).
 *
 * ⚠️ LECTURA AFIRMATIVA, COMO EN /inicio: el modal que monta esto es
 * BLOQUEANTE. Se pregunta por `data?.gate` ANTES que por lo que dice, así que
 * un error, un 401 o una respuesta sin gate —«todavía no sé»— no encierran a
 * nadie. Es la misma distinción que traía el desaparecido
 * `PrimerConsultorioModal`, al que este componente sustituye: sin retirarlo,
 * los dos se disparaban a la vez ante un médico sin consultorios y se apilaban
 * dos diálogos bloqueantes, ninguno de los dos cerrable.
 *
 * El criterio NO se decide aquí: sale entero de `/api/me/estado-perfil`, que lo
 * calcula con `evaluarPerfil`. Este archivo solo elige DÓNDE se enseña.
 */

interface RespuestaEstado {
  gate?: EstadoPerfil
  role: string
  es_admin_de_clinica: boolean
  tieneFirma: boolean
  tieneLogo: boolean
}

async function fetcher(url: string): Promise<RespuestaEstado> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`estado-perfil: ${res.status}`)
  return res.json()
}

export default function GateOnboarding() {
  const { data, mutate } = useSWR<RespuestaEstado>('/api/me/estado-perfil', fetcher)

  if (!data?.gate || data.gate.completo) return null

  return (
    <OnboardingModal
      // Revalidar la clave y no un refetch a mano: si el gate ya está completo,
      // el `return null` de arriba desmonta el modal solo.
      onComplete={() => { void mutate() }}
      gate={data.gate}
      role={data.role}
      esAdminDeClinica={data.es_admin_de_clinica}
      tieneFirma={data.tieneFirma}
      tieneLogo={data.tieneLogo}
    />
  )
}
