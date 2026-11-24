'use client'

/**
 * src/components/agenda/TiraSemana.tsx
 *
 * B13 · AG3 · La tira de fechas de la Semana del teléfono (versión A,
 * `agenda-base/PIEZAS.md` §6 y la maqueta `ag-semana`): siete botones encima de
 * la lista (`listWeek`), con la letra del día, el número (hoy en círculo) y
 * hasta tres puntos de lo que hay ese día. Tocar uno lleva la lista a ese día
 * (o al siguiente con filas): la MISMA ayuda que abre la lista en hoy
 * (`desplazarListaAHoy`). Sólo con la v2, en `ext`/`tel`; la monta
 * `AgendaCliente` dentro de la banda de avisos.
 *
 * ⚠️ LOS PUNTOS SE CUENTAN DEL DOM DE LA LISTA y no del `eventStore`: así
 * cuentan exactamente lo que la lista pinta (filtro de médico incluido) sin
 * añadir estado a la agenda. Un `MutationObserver` sobre el armazón y una
 * lectura por cuadro; nada de peticiones.
 */

import { useEffect, useState, type RefObject } from 'react'
import { desplazarListaAHoy, diaLocalISO } from '@/lib/agenda/listaHoy'

const LETRA = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' })
const NOMBRE = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
const MAX_PUNTOS = 3

/** Los siete días («AAAA-MM-DD») desde `desde`, en hora local. */
function diasDesde(desde: string): string[] {
  const [a, m, d] = desde.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => diaLocalISO(new Date(a, m - 1, d + i)))
}

/** Filas de evento bajo cada cabecera de día de la lista. */
export function contarFilasPorDia(lista: ParentNode): Record<string, number> {
  const cuenta: Record<string, number> = {}
  let dia = ''
  lista.querySelectorAll('tr.fc-list-day[data-date], tr.fc-list-event').forEach(fila => {
    if (fila.classList.contains('fc-list-day')) dia = fila.getAttribute('data-date') ?? ''
    else if (dia) cuenta[dia] = (cuenta[dia] ?? 0) + 1
  })
  return cuenta
}

/** La cuenta por día, viva mientras cambie la lista. Firma en cadena: no repinta si no cambió. */
function useCuentaDeLaLista(raizRef: RefObject<HTMLElement | null>): Record<string, number> {
  const [firma, setFirma] = useState('{}')
  useEffect(() => {
    const harness = raizRef.current?.querySelector('.fc-view-harness')
    if (!harness) return
    let cuadro = 0
    const leer = (): void => { cuadro = 0; setFirma(JSON.stringify(contarFilasPorDia(harness))) }
    const pedir = (): void => { if (!cuadro) cuadro = requestAnimationFrame(leer) }
    leer()
    const obs = new MutationObserver(pedir)
    obs.observe(harness, { childList: true, subtree: true })
    return () => { obs.disconnect(); if (cuadro) cancelAnimationFrame(cuadro) }
  }, [raizRef])
  return JSON.parse(firma) as Record<string, number>
}

export function TiraSemana({ desde, raizRef }: { desde: string; raizRef: RefObject<HTMLElement | null> }) {
  const hoy = diaLocalISO(new Date())
  const dias = diasDesde(desde)
  const cuenta = useCuentaDeLaLista(raizRef)
  const [elegido, setElegido] = useState<{ semana: string; dia: string } | null>(null)
  const activo = elegido?.semana === desde ? elegido.dia : (dias.includes(hoy) ? hoy : dias[0])
  function ir(dia: string): void {
    setElegido({ semana: desde, dia })
    const raiz = raizRef.current
    if (raiz) desplazarListaAHoy(raiz, dia)
  }
  return (
    <div className="ag-tira-semana" role="group" aria-label="Días de la semana">
      {dias.map(dia => {
        const [a, m, d] = dia.split('-').map(Number)
        const fecha = new Date(a, m - 1, d)
        const n = Math.min(cuenta[dia] ?? 0, MAX_PUNTOS)
        return (
          <button key={dia} type="button" className="ag-tira-dia" data-hoy={dia === hoy || undefined}
            aria-pressed={dia === activo} aria-current={dia === hoy ? 'date' : undefined}
            aria-label={NOMBRE.format(fecha)} onClick={() => ir(dia)}>
            <span className="ag-tira-letra" aria-hidden="true">{LETRA.format(fecha).toUpperCase()}</span>
            <span className="ag-tira-num" aria-hidden="true">{d}</span>
            <span className="ag-tira-puntos" aria-hidden="true">
              {Array.from({ length: n }, (_, i) => <i key={i} />)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
