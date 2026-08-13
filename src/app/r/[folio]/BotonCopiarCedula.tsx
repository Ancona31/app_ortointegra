'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Check, Copy, X } from 'lucide-react'

/* ═══ El único trozo de cliente de /r/[folio] ═══
   La página es un Server Component entero y se queda así: lee la base, compone
   y no hidrata nada. Copiar al portapapeles es lo único que no se puede hacer
   sin JavaScript, así que es lo único que se monta como cliente — este botón, y
   no la tarjeta ni la página que lo contienen.

   POR QUÉ HAY UN BOTÓN POR NÚMERO Y UN SOLO ENLACE PARA LOS DOS. El destino es
   el mismo buscador; lo que cambia entre una cédula y otra es el número que hay
   que pegar en él. El buscador de la SEP **no admite prellenado por URL**
   —comprobado en el portal, no hay parámetro de consulta que acepte—, así que
   copiar y pegar es el camino, y por eso el botón está donde está el dato.

   ⚠ NO LO CONVIERTAS EN UN ENLACE QUE «YA LLEVE» EL NÚMERO. Es lo primero que
   parece que falta y no existe: cualquier URL que se invente con la cédula
   dentro cae en el buscador vacío, y quien verifica cree que la búsqueda se hizo
   sola. */

interface Props {
  /** El número a copiar, tal cual se muestra. */
  readonly valor: string
  /** `Cédula profesional`. Va al `aria-label`: «Copiar cédula profesional». */
  readonly que: string
}

type Estado = 'listo' | 'copiado' | 'error'

/** Cuánto dura el acuse antes de volver al icono de copiar. */
const ACUSE_MS = 2000

export default function BotonCopiarCedula({ valor, que }: Props): ReactElement {
  const [estado, setEstado] = useState<Estado>('listo')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* El acuse se borra solo. Sin esto, un desmontaje entre el copiado y los dos
     segundos dejaría un setState sobre un componente que ya no está. */
  useEffect(() => {
    return () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current)
    }
  }, [])

  async function copiar(): Promise<void> {
    /* `navigator.clipboard` no existe en contexto inseguro ni en navegadores
       viejos, y `writeText` puede ser rechazado por permisos. Los dos desenlaces
       se tratan igual: el número sigue en pantalla y se puede seleccionar a
       mano, así que fallar aquí no rompe nada — pero decirlo evita que alguien
       pegue un portapapeles viejo creyendo que copió este. */
    let ok = false
    try {
      await navigator.clipboard.writeText(valor)
      ok = true
    } catch {
      ok = false
    }

    setEstado(ok ? 'copiado' : 'error')
    if (temporizador.current !== null) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setEstado('listo'), ACUSE_MS)
  }

  const etiqueta = estado === 'copiado'
    ? `${que} copiada`
    : estado === 'error'
      ? `No se pudo copiar la ${que.toLowerCase()}`
      : `Copiar ${que.toLowerCase()}`

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={etiqueta}
      title={etiqueta}
      className="inline-flex items-center align-middle ml-1 p-1 rounded text-slate-400
                 hover:text-slate-600 hover:bg-slate-100 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {estado === 'copiado' ? (
        <Check size={13} className="text-emerald-600" aria-hidden="true" />
      ) : estado === 'error' ? (
        <X size={13} className="text-amber-600" aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      {/* El acuse también por texto: un cambio de icono no lo anuncia un lector
          de pantalla, y esta página la usa gente comprobando un papel. */}
      <span aria-live="polite" className="sr-only">
        {estado === 'listo' ? '' : etiqueta}
      </span>
    </button>
  )
}
