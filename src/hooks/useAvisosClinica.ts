'use client'

/**
 * src/hooks/useAvisosClinica.ts — el estado de los «Avisos» de la clínica
 * (tanda I, punto 19 de Angel) para quien los pinte: la lista sin revisar,
 * marcarlos revisados y el aviso emergente breve de los recién llegados.
 *
 * ⚠️ PIEZA PENSADA PARA MOVERSE A TODA LA APP (abstracción autorizada por
 * Angel en el encargo de I5): no sabe de la agenda.
 *   · CONTROLADO (`datos` definido): la agenda le pasa los avisos que ya
 *     viajaron en la respuesta de «Por confirmar» y el gancho NO pide nada.
 *   · LIBRE (`datos` undefined): otra página; pide `GET /api/avisos` en tiempo
 *     ocioso al montarse y en cada `recargar()`.
 *
 * Revisar es optimista: el aviso sale de la lista al pulsarlo y el PATCH va
 * detrás; si falla, vuelve en la siguiente recarga (la base es la verdad).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import { useToast } from '@/components/ui/Toast'
import {
  avisosParaEmergente, leerRespuestaAvisos, textoEmergente,
  type AvisoClinica, type RespuestaAvisos, type TipoAviso,
} from '@/lib/avisos/avisosClinica'

export interface OpcionesAvisos {
  /** Avisos ya traídos por otra respuesta (modo controlado); null = aún no llegan. */
  datos?: RespuestaAvisos | null
  /** Tipos que lanzan aviso emergente al llegar (recientes, una vez por pestaña). */
  emergentes?: readonly TipoAviso[]
}

export interface EstadoAvisos {
  /** null = aún no se sabe (la primera traída no llegó). */
  avisos: AvisoClinica[] | null
  /** false = la base no tiene la tabla: quien pinta vuelve a lo de antes. */
  disponible: boolean
  revisar: (ids: string[]) => void
  revisarTodos: () => void
  recargar: () => void
}

async function pedirAvisos(): Promise<RespuestaAvisos | null> {
  try {
    const res = await fetch('/api/avisos')
    return res.ok ? leerRespuestaAvisos(await res.json()) : null
  } catch {
    return null
  }
}

/** El PATCH de revisar. `false` si la base no lo apuntó (red, 4xx o 5xx): quien llama deshace lo optimista. */
async function enviarRevision(ids: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/avisos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Los ids revisados en esta pestaña se ocultan aunque una respuesta en vuelo aún los traiga. */
function sinRevisados(r: RespuestaAvisos | null, revisados: ReadonlySet<string>): AvisoClinica[] | null {
  return r ? r.avisos.filter(a => !revisados.has(a.id)) : null
}

export function useAvisosClinica({ datos, emergentes = [] }: OpcionesAvisos = {}): EstadoAvisos {
  const controlado = datos !== undefined
  const [propios, setPropios] = useState<RespuestaAvisos | null>(null)
  const [revisados, setRevisados] = useState<ReadonlySet<string>>(() => new Set())
  const recibida = controlado ? datos : propios
  /* Un fallo pasajero del servidor llega como «no disponible», igual que una
     base sin la tabla: tras una lista buena se conserva la última buena, para
     que la campana no salte a la vista de antes ni cambie su cuenta. */
  const [ultimaBuena, setUltimaBuena] = useState<RespuestaAvisos | null>(null)
  if (recibida?.disponible && recibida !== ultimaBuena) setUltimaBuena(recibida)
  const fuente = recibida?.disponible ? recibida : (ultimaBuena ?? recibida)

  const recargar = useCallback((): void => {
    if (controlado) return
    void pedirAvisos().then(r => { if (r) setPropios(r) })
  }, [controlado])

  useEffect(() => {
    if (controlado) return
    const idle = enOcioso(recargar)
    return () => cancelarOcioso(idle)
  }, [controlado, recargar])

  useEmergentes(fuente, emergentes)

  /* Optimista: se oculta al momento; si la base no lo apunta, vuelve a salir
     (un aviso que se cree atendido y no lo está es justo lo que no puede pasar). */
  const revisar = useCallback((ids: string[]): void => {
    if (ids.length === 0) return
    setRevisados(prev => new Set([...prev, ...ids]))
    void enviarRevision(ids).then(ok => {
      if (!ok) setRevisados(prev => new Set([...prev].filter(id => !ids.includes(id))))
    })
  }, [])

  const avisos = useMemo(() => sinRevisados(fuente, revisados), [fuente, revisados])

  /** «Marcar todos»: SÓLO los que están a la vista; lo que llegó después o quedó fuera del tope sigue sin revisar. */
  const revisarTodos = useCallback((): void => {
    revisar(avisos?.map(a => a.id) ?? [])
  }, [avisos, revisar])

  return { avisos, disponible: fuente?.disponible ?? false, revisar, revisarTodos, recargar }
}

/**
 * El aviso emergente breve de lo que llega CON LA PÁGINA ABIERTA (punto 19),
 * con los avisos de siempre (`useToast`). La primera lista sólo se apunta: lo
 * que ya estaba al abrir se ve en la campana (punto rojo), no salta encima.
 */
function useEmergentes(fuente: RespuestaAvisos | null, tipos: readonly TipoAviso[]): void {
  const toast = useToast()
  const vistos = useRef(new Set<string>())
  const primera = useRef(true)
  const tiposRef = useRef(tipos)
  useEffect(() => { tiposRef.current = tipos }, [tipos])
  useEffect(() => {
    if (!fuente?.disponible) return
    const nuevos = avisosParaEmergente(fuente.avisos, vistos.current, Date.now(), tiposRef.current)
    if (primera.current) { primera.current = false; return }
    for (const a of nuevos) toast.info(textoEmergente(a))
  }, [fuente, toast])
}
