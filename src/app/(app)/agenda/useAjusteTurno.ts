'use client'

/**
 * src/app/(app)/agenda/useAjusteTurno.ts
 *
 * G2 (punto 9 de Angel): dentro de la agenda, el clic en un hueco, la burbuja
 * de alta rápida y el arrastre de una cita se AJUSTAN al turno más cercano de
 * la rejilla del médico en ese consultorio —apertura del día + múltiplos de su
 * duración de la consulta allí—, la misma rejilla que ofrece el enlace de
 * reserva (`turnosAgenda.ts`). No es una regla dura: la hora escrita a mano en
 * la burbuja o en el formulario se respeta (aquí sólo pasan los gestos).
 *
 * Devuelve `ajustar(instante, dónde?)`: el instante ajustado, o `null` = no se
 * ajusta y el gesto sigue con su hora. Sin ajuste (lo que menos cambia):
 *   · con la v2 apagada (ni siquiera se piden los tipos);
 *   · sin un consultorio CLARO: el de la cita al arrastrar (si está entre los
 *     que la agenda puede enseñar: los de `consultoriosAgendaServidor`, o los
 *     de la sesión mientras llegan); en un clic, el de la rejilla: con un
 *     médico a la vista, el ÚNICO de `consultoriosDeLaRejilla` (su consultorio
 *     activo, o el único que tiene). Con varios o con «Todos», no se ajusta;
 *   · sin duración conocida (`duracionDeConsulta`: sin principal y con más de
 *     un tipo, o ninguno), fuera de la jornada o con la lista sin llegar.
 *
 * Los tipos los lee la página en el SERVIDOR (`leerTiposAjuste` de
 * `agenda/page.tsx`: sesión y RLS, el invitado ve los de la clínica y los
 * suyos) y llegan como promesa, como la semilla; una vez por montaje. Antes se
 * pedían a `GET /api/agenda/tipos-cita` al montar: una validación más contra
 * Auth al abrir (integración G1–G4, presupuesto de A). Un fallo deja la agenda
 * sin ajuste, nunca la rompe.
 *
 * ⚠️ VAN A UNA REFERENCIA, NO A UN ESTADO: su llegada no debe pintar la agenda
 * otra vez. Con `useSWR` (la primera versión) el render de su llegada movía
 * las tarjetas a media medición (e2e `husos-dos-consultorios`, 43 px), y el
 * ajuste sólo se lee en el momento del gesto.
 *
 * H4 (punto 20) · La MISMA rejilla parte los huecos del panel de Día en turnos
 * (`turnosDelHueco`, con el consultorio de un clic). El panel no lee la
 * referencia al pintar: recibe la MISMA promesa (`tiposPanel`) y guarda la
 * lista en SU estado, así que su llegada vuelve a pintar el panel, no la agenda.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Horario } from '@/lib/configApp'
import { renderEnTZ } from '@/lib/dates'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import type { ConsultorioRejilla } from '@/lib/agenda/horarioRejilla'
import { ajustarATurno, turnosEnTramo, type Turno } from '@/lib/agenda/turnosAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { duracionDeConsulta } from '@/lib/agenda/tiposPorConsultorio'

/** Dónde cae el gesto: el médico y el consultorio de la cita que se arrastra. */
export type DondeTurno = { medicoId: string | null; consultorioId: string | null }
export type AjustarTurno = (instante: Date, donde?: DondeTurno) => Date | null
/** H4 · Los turnos de la rejilla que caben enteros en un hueco, o `null` = sin rejilla clara (el hueco, como hoy). */
export type TurnosDelHueco = (desde: Date, hasta: Date, tipos: readonly TipoCita[]) => Turno[] | null
/** H4 · La duración de la consulta de esa rejilla (el mínimo de un hueco del panel), o `null` sin rejilla clara. */
export type DuracionDelPanel = (tipos: readonly TipoCita[]) => number | null

interface Entrada {
  agendaV2: boolean
  /** Los consultorios que la agenda puede enseñar (los de la rejilla de G4). */
  consultorios: readonly ConsultorioRejilla[]
  /** `consultoriosDeLaRejilla(...)`: los que dibujan la rejilla ahora. */
  seleccion: readonly ConsultorioRejilla[]
  horarioClinica: Horario | null | undefined
  medicoMostrado: string | null
  /** Los tipos de cita activos de la clínica que la sesión ve (servidor), o `undefined`. */
  tipos: Promise<TipoCita[] | null> | undefined
}

/** El consultorio del gesto: el de la cita, o el de la rejilla en un clic. */
function consultorioDelGesto(e: Pick<Entrada, 'consultorios' | 'seleccion' | 'medicoMostrado'>, donde: DondeTurno | undefined): ConsultorioRejilla | null {
  if (donde) return e.consultorios.find(c => c.id === donde.consultorioId && c.medico_id === donde.medicoId) ?? null
  return e.medicoMostrado && e.seleccion.length === 1 ? e.seleccion[0] : null
}

/** La rejilla del gesto: zona, horario y duración de la consulta del médico en ese consultorio; `null` si no está clara. */
function rejillaDelGesto(e: Omit<Entrada, 'agendaV2' | 'tipos'>, lista: readonly TipoCita[], donde: DondeTurno | undefined) {
  const c = consultorioDelGesto(e, donde)
  /* Sin zona no hay rejilla clara (la columna es NOT NULL; un resto sin ella no se ajusta). */
  if (!c || c.activo === false || !c.timezone) return null
  const duracion = duracionDeConsulta(lista.filter(t => t.activo && (t.medico_id === null || t.medico_id === c.medico_id)), c.id)
  return duracion ? { tz: c.timezone, horario: horarioEfectivo(c, e.horarioClinica ?? null), duracionMin: duracion } : null
}

export function useAjusteTurno(e: Entrada): {
  ajustar: AjustarTurno; turnosDelHueco: TurnosDelHueco; duracionDelPanel: DuracionDelPanel
  tiposPanel: Promise<TipoCita[] | null> | undefined
} {
  const { agendaV2, consultorios, seleccion, horarioClinica, medicoMostrado, tipos } = e
  const tiposRef = useRef<TipoCita[] | null>(null)
  useEffect(() => {
    if (!agendaV2 || !tipos) return
    let vivo = true
    tipos.then(t => { if (vivo && t) tiposRef.current = t }, () => { /* sin ajuste */ })
    return () => { vivo = false }
  }, [agendaV2, tipos])
  /* H4 · Para el panel: la misma promesa, sin rechazo (un fallo = sin turnos).
     `Promise.resolve` y no `tipos.catch`: la de Flight (servidor → cliente) es
     un «thenable» cuyo `then` NO devuelve otra promesa, así que encadenar
     sobre ella da `undefined`; `Promise.resolve` la adopta en una de verdad. */
  const tiposPanel = useMemo(() => (agendaV2 && tipos ? Promise.resolve(tipos).catch(() => null) : undefined), [agendaV2, tipos])
  const ajustar = useCallback<AjustarTurno>((instante, donde) => {
    const lista = tiposRef.current
    if (!agendaV2 || !lista) return null
    const r = rejillaDelGesto({ consultorios, seleccion, horarioClinica, medicoMostrado }, lista, donde)
    return r ? ajustarATurno({ instante, ...r }) : null
  }, [agendaV2, consultorios, seleccion, horarioClinica, medicoMostrado])
  const turnosDelHueco = useCallback<TurnosDelHueco>((desde, hasta, lista) => {
    if (!agendaV2) return null
    const r = rejillaDelGesto({ consultorios, seleccion, horarioClinica, medicoMostrado }, lista, undefined)
    if (!r) return null
    const fecha = renderEnTZ(desde.toISOString(), 'yyyy-MM-dd', r.tz)
    return turnosEnTramo({ fecha, ...r }, desde.getTime(), hasta.getTime())
  }, [agendaV2, consultorios, seleccion, horarioClinica, medicoMostrado])
  const duracionDelPanel = useCallback<DuracionDelPanel>((lista) => (agendaV2
    ? rejillaDelGesto({ consultorios, seleccion, horarioClinica, medicoMostrado }, lista, undefined)?.duracionMin ?? null
    : null), [agendaV2, consultorios, seleccion, horarioClinica, medicoMostrado])
  return { ajustar, turnosDelHueco, duracionDelPanel, tiposPanel }
}
