'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { Calendar } from 'lucide-react'
import {
  type Tramo, HUECO_MINIMO, etiquetaDeRango, etiquetaDeDuracion, medianocheDe, relojDeMinutos,
  type ResumenDia, huecosDelPanel,
} from '@/lib/agenda/huecosAgenda'
import type { Turno } from '@/lib/agenda/turnosAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'

/**
 * H4 (punto 20 de Angel) · Partir cada hueco en los turnos de la rejilla fija
 * del médico en ese consultorio (la MISMA del enlace de reserva, G2:
 * `turnosEnTramo` → `turnosDelDia`), con su duración de la consulta allí
 * (`tiposDelConsultorio` vía `duracionDeConsulta`). Lo da `useAjusteTurno`
 * con el consultorio de un clic: un médico a la vista y UN consultorio en la
 * rejilla. `delHueco` devuelve `null` sin rejilla clara (varios consultorios,
 * sin duración conocida): entonces el hueco es el de hoy, un solo botón. Los
 * tipos llegan como promesa (los lee la página en el servidor) y se guardan
 * en el estado de ESTA tarjeta: mientras no llegan, el hueco de hoy; al
 * llegar, se vuelve a pintar la tarjeta, no la agenda.
 */
export interface TurnosHuecos {
  delHueco: (desde: Date, hasta: Date, tipos: readonly TipoCita[]) => Turno[] | null
  /** La duración de la consulta de esa rejilla: con ella, el hueco mínimo es esa duración y no `HUECO_MINIMO`. */
  duracion: (tipos: readonly TipoCita[]) => number | null
  tipos: Promise<TipoCita[] | null> | undefined
}

/** Un turno en minutos del día del DISPOSITIVO, la misma aritmética que `abrirHueco`. */
function tramoDelTurno(t: Turno, base: number): Tramo {
  return { desde: Math.round((Date.parse(t.inicio) - base) / 60_000), hasta: Math.round((Date.parse(t.fin) - base) / 60_000) }
}

/** Los tipos de cita para los turnos, en el estado de la tarjeta (llegan una vez). */
function useTiposDelPanel(tipos: Promise<TipoCita[] | null> | undefined): TipoCita[] | null {
  const [lista, setLista] = useState<TipoCita[] | null>(null)
  useEffect(() => {
    let vivo = true
    void tipos?.then(t => { if (vivo) setLista(t) })
    return () => { vivo = false }
  }, [tipos])
  return lista
}

/** Un hueco partido en turnos: el tramo de cabecera y un botón por turno, que abre el alta a esa hora exacta. */
function HuecoEnTurnos({ h, turnos, base, onHueco }: { h: Tramo; turnos: Turno[]; base: number; onHueco: (t: Tramo, esTurno?: boolean) => void }): ReactElement {
  return (
    <div className="ag-hueco-grupo" role="group" aria-label={`Hueco ${etiquetaDeRango(h)}`} data-hueco-turnos>
      <p className="ag-hueco-cab">
        <span className="ag-hueco-rango">{etiquetaDeRango(h)}</span>
        <span className="ag-hueco-dur">{etiquetaDeDuracion(h.hasta - h.desde)}</span>
      </p>
      {turnos.length > 0 ? (
        <div className="ag-turnos">
          {turnos.map(t => {
            const tramo = tramoDelTurno(t, base)
            const hora = relojDeMinutos(tramo.desde)
            return (
              <button key={t.inicio} type="button" className="ag-turno" data-turno={hora}
                aria-label={`Agendar a las ${hora} (${etiquetaDeDuracion(tramo.hasta - tramo.desde)})`} onClick={() => onHueco(tramo, true)}>
                {hora}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="ag-turnos-vacio">No cabe un turno entero en este hueco.</p>
      )}
    </div>
  )
}

/* La tarjeta NO se oculta cuando no hay huecos, y es deliberado (§8.4): una
   card que desaparece se lee como un fallo de carga. Lo que cambia es el
   contenido, y el texto dice cuál de los dos motivos es. */
/* ⚠️⚠️ CON LA TRAÍDA RECORTADA NO SE PINTA NINGÚN HUECO, Y ESTO ES EL ARREGLO,
   NO UNA CAUTELA DE MÁS. Un hueco de aquí NO es un dato: es un BOTÓN que llama a
   `abrirHueco` → `api.select()` → el alta. Calculado sobre un día al que le
   faltan citas, el complemento de la ocupación incluye las horas de las citas
   que no llegaron, así que el panel ofrecía —comprobado el 2026-08-30 sobre el
   lunes 24— un hueco de 11:00 a 20:00 con una paciente dentro de 11:00 a 12:00.
   Pulsarlo abría el alta encima de ella. Es el daño exacto del que avisa la
   banda roja, servido por la tarjeta de al lado.

   ⚠️ Y NO VALE PINTARLOS «SÓLO INFORMATIVOS», sin `onClick`. Se verían igual que
   los de siempre, en el mismo sitio y con la misma forma, y el médico que ya
   sabe que ahí se pulsa no lee la diferencia: se convierte en un botón que no
   responde, que es peor que uno que responde mal. O son huecos de verdad o no
   hay huecos.

   La tarjeta NO desaparece, por la misma razón que ya está escrita abajo: una
   card que se va se lee como un fallo de carga. Lo que cambia es el contenido, y
   toma el MISMO camino visual que el consultorio cerrado. */
export function CardHuecos(
  { resumen, onHueco, incompleto, turnos }: {
    resumen: ResumenDia | null
    onHueco: (t: Tramo, esTurno?: boolean) => void
    /** La traída vino recortada: no hay huecos que ofrecer, sólo el motivo. */
    incompleto: boolean
    /** H4 (punto 20): sólo con la v2. Sin él, o sin rejilla clara, el hueco de siempre. */
    turnos?: TurnosHuecos
  },
): ReactElement {
  const tipos = useTiposDelPanel(turnos?.tipos)
  const jornada = resumen?.jornada ?? null
  /* H4 · Con la duración de la consulta conocida, un tramo libre de esa
     duración ya es hueco (uno de 45 min con consulta de 45 ofrece su turno). */
  const duracion = turnos && tipos ? turnos.duracion(tipos) : null
  const minimo = duracion ?? HUECO_MINIMO
  const huecos = incompleto || !resumen ? [] : huecosDelPanel(resumen, duracion)
  const base = resumen ? medianocheDe(resumen.dia).getTime() : 0
  const enTurnos = (h: Tramo): Turno[] | null => (turnos && tipos
    ? turnos.delHueco(new Date(base + h.desde * 60_000), new Date(base + h.hasta * 60_000), tipos)
    : null)
  return (
    <section className="ag-panelcard" aria-label="Huecos disponibles">
      <h2 className="ag-panelcard-tit">Huecos disponibles</h2>
      {huecos.length > 0 ? (
        <div className="ag-huecos">
          {huecos.map(h => {
            const lista = enTurnos(h)
            return lista
              ? <HuecoEnTurnos key={`${h.desde}-${h.hasta}`} h={h} turnos={lista} base={base} onHueco={onHueco} />
              : <BotonHueco key={`${h.desde}-${h.hasta}`} h={h} onHueco={onHueco} />
          })}
        </div>
      ) : (
        <p className="ag-panelcard-vacio">
          <Calendar size={22} aria-hidden />
          {/* El recorte manda sobre los otros dos motivos: mientras falten
              citas no se sabe si el día está completo ni si queda algo libre,
              así que ninguna de las dos frases de abajo sería cierta. */}
          {incompleto
            ? 'Faltan citas por cargar · No se pueden calcular los huecos de este día'
            : jornada
              ? `Día completo · No queda ningún tramo de ${etiquetaDeDuracion(minimo)} libre entre ${etiquetaDeRango(jornada)}`
              : 'Consultorio cerrado · No hay horario de consulta este día'}
        </p>
      )}
    </section>
  )
}

/** El hueco de siempre: un botón con el tramo y su duración, que abre el alta al principio del tramo. */
function BotonHueco({ h, onHueco }: { h: Tramo; onHueco: (t: Tramo) => void }): ReactElement {
  return (
    <button
      type="button"
      className="ag-hueco"
      onClick={() => onHueco(h)}
    >
      <span className="ag-hueco-rango">{etiquetaDeRango(h)}</span>
      <span className="ag-hueco-dur">{etiquetaDeDuracion(h.hasta - h.desde)}</span>
    </button>
  )
}
