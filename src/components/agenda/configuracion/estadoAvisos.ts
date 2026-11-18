'use client'

/**
 * El estado de «Avisos por correo» (tanda J, J5): el paso 3 del funnel y la
 * pestaña «Avisos» enseñan lo mismo, y el cierre del funnel lo resume. Lo
 * guarda UNA vez `ConfiguracionAgenda`, que monta lo uno o lo otro.
 *
 * SE GUARDA SOLO, con las rutas de siempre (`/api/me/ajustes-agenda`: sólo
 * quien administra, Zod estricto, auditado por disparador):
 *   · los dos interruptores, al pulsarlos (PATCH, una clave);
 *   · los cuatro plazos, juntos (PUT exige los cuatro): el selector al
 *     cambiar; los números al salir del campo o 700 ms después de la última
 *     tecla.
 * SIN CARRERAS: un solo PUT en vuelo; lo que se cambia mientras tanto se manda
 * al volver, y sólo lo último. Un interruptor no se pulsa otra vez hasta que
 * contesta el anterior. Si el servidor dice que no, el control vuelve a lo
 * último que SÍ se guardó y sale el error.
 *
 * Nombre distinto de cualquier componente de la carpeta (regla de mayúsculas).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ajustesDesdeFormulario, type AjustesAgenda, type CampoAjusteAgenda } from '@/lib/agenda/ajustesAgenda'
import { guardarAjustes, guardarInterruptor, type Interruptor } from '@/components/agenda/configuracion/accionesConfig'

export type Avisar = (r: { ok: true } | { ok: false; motivo: string }) => void
type Textos = Record<CampoAjusteAgenda, string>

const aTextos = (a: AjustesAgenda): Textos => ({
  recordatorio_horas: String(a.recordatorio_horas), anticipacion_min_horas: String(a.anticipacion_min_horas),
  horizonte_dias: String(a.horizonte_dias), vigencia_enlace_unico_dias: String(a.vigencia_enlace_unico_dias),
})

export interface Inicial { ajustes: AjustesAgenda | null; recordatorio: boolean | null; correoClinica: boolean | null }

export interface EstadoAvisos {
  textos: Textos | null
  /** El error de validación de los plazos (antes de mandar), o `null`. */
  invalido: string | null
  recordatorio: boolean | null
  correoClinica: boolean | null
  ocupado: Interruptor | null
  /** Lo último que confirmó el servidor (para el resumen del cierre). */
  guardados: AjustesAgenda | null
  escribir: (campo: CampoAjusteAgenda, valor: string, ahora?: boolean) => void
  soltar: () => void
  cambiarInterruptor: (clave: Interruptor) => void
}

/** Los plazos: lo escrito, lo guardado y el envío en serie. */
function usePlazos(inicial: AjustesAgenda | null, avisar: Avisar) {
  const [textos, setTextos] = useState<Textos | null>(inicial ? aTextos(inicial) : null)
  const [guardados, setGuardados] = useState<AjustesAgenda | null>(inicial)
  const [invalido, setInvalido] = useState<string | null>(null)
  const enVuelo = useRef(false)
  const pendiente = useRef<AjustesAgenda | null>(null)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimo = useRef<Textos | null>(textos)
  const confirmados = useRef<AjustesAgenda | null>(inicial)
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])

  /* Un PUT a la vez: lo que llega mientras tanto espera, y sólo vale lo último. */
  const enviar = useCallback(async (a: AjustesAgenda): Promise<void> => {
    if (enVuelo.current) { pendiente.current = a; return }
    enVuelo.current = true
    /* Cada respuesta buena se da por guardada AL MOMENTO: si la siguiente falla, se vuelve a ésta, no a la de antes. */
    const mandar = async (x: AjustesAgenda) => {
      const r = await guardarAjustes(x)
      if (r.ok) { confirmados.current = r.valor; setGuardados(r.valor) }
      return r
    }
    let r = await mandar(a)
    for (let siguiente = pendiente.current; siguiente; siguiente = pendiente.current) {
      pendiente.current = null
      r = await mandar(siguiente)
    }
    enVuelo.current = false
    if (r.ok) {
      avisar({ ok: true })
      return
    }
    const g = confirmados.current
    if (g) { ultimo.current = aTextos(g); setTextos(aTextos(g)) }
    avisar(r)
  }, [avisar])

  const mandarLoEscrito = useCallback((): void => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null }
    const t = ultimo.current
    if (!t) return
    const r = ajustesDesdeFormulario(t)
    setInvalido(r.ok ? null : r.error)
    if (r.ok) void enviar(r.ajustes)
  }, [enviar])

  const escribir = useCallback((campo: CampoAjusteAgenda, valor: string, ahora = false): void => {
    if (!ultimo.current) return
    const t = { ...ultimo.current, [campo]: valor }
    ultimo.current = t
    setTextos(t)
    if (reloj.current) clearTimeout(reloj.current)
    if (ahora) mandarLoEscrito()
    else reloj.current = setTimeout(mandarLoEscrito, 700)
  }, [mandarLoEscrito])

  /* Al salir del campo: sólo si queda algo por mandar. */
  const soltar = useCallback((): void => { if (reloj.current) mandarLoEscrito() }, [mandarLoEscrito])
  return { textos, guardados, invalido, escribir, soltar }
}

/** Los dos interruptores: al pulsar, optimista; si el servidor dice que no, vuelve. */
function useInterruptores(inicial: Inicial, avisar: Avisar) {
  const [valores, setValores] = useState({ recordatorio_encendido: inicial.recordatorio, correo_reserva_clinica: inicial.correoClinica })
  const [ocupado, setOcupado] = useState<Interruptor | null>(null)
  const cambiarInterruptor = useCallback((clave: Interruptor): void => {
    const antes = valores[clave]
    if (antes === null || ocupado) return
    setValores(v => ({ ...v, [clave]: !antes }))
    setOcupado(clave)
    void guardarInterruptor(clave, !antes).then(r => {
      setOcupado(null)
      setValores(v => ({ ...v, [clave]: r.ok ? r.valor : antes }))
      avisar(r.ok ? { ok: true } : r)
    })
  }, [valores, ocupado, avisar])
  return { recordatorio: valores.recordatorio_encendido, correoClinica: valores.correo_reserva_clinica, ocupado, cambiarInterruptor }
}

export function useAvisos(inicial: Inicial, avisar: Avisar): EstadoAvisos {
  const plazos = usePlazos(inicial.ajustes, avisar)
  const interruptores = useInterruptores(inicial, avisar)
  return { ...plazos, ...interruptores }
}
