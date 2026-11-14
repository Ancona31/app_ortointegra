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
 *   · sin un consultorio CLARO: el de la cita al arrastrar (si quien mira lo
 *     ve: la RLS de `consultorios` sólo enseña los suyos, o todos a la
 *     secretaria); en un clic, el de la rejilla (`consultorioDeLaRejilla`: un
 *     médico a la vista y su consultorio activo o único);
 *   · sin duración conocida (`duracionDeConsulta`: sin principal y con más de
 *     un tipo, o ninguno), fuera de la jornada o con la lista sin llegar.
 *
 * Los tipos salen de `GET /api/agenda/tipos-cita` (sesión y RLS: el invitado
 * ve los de la clínica y los suyos), una vez por montaje; un fallo deja la
 * agenda sin ajuste, nunca la rompe.
 *
 * ⚠️ VAN A UNA REFERENCIA, NO A UN ESTADO: su llegada no debe pintar la agenda
 * otra vez. Con `useSWR` (la primera versión) el render de su llegada movía
 * las tarjetas a media medición (e2e `husos-dos-consultorios`, 43 px), y el
 * ajuste sólo se lee en el momento del gesto.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { Horario } from '@/lib/configApp'
import type { Consultorio } from '@/types'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import { consultorioDeLaRejilla } from '@/lib/agenda/horarioRejilla'
import { ajustarATurno } from '@/lib/agenda/turnosAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { duracionDeConsulta } from '@/lib/agenda/tiposPorConsultorio'

/** Dónde cae el gesto: el médico y el consultorio de la cita que se arrastra. */
export type DondeTurno = { medicoId: string | null; consultorioId: string | null }
export type AjustarTurno = (instante: Date, donde?: DondeTurno) => Date | null

interface Entrada {
  agendaV2: boolean
  consultorios: readonly Consultorio[] | undefined
  horarioClinica: Horario | null | undefined
  consultorioActivo: Consultorio | null
  medicoMostrado: string | null
}

async function leerTipos(url: string): Promise<TipoCita[]> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`tipos ${res.status}`)
  const j: { tipos?: TipoCita[] } = await res.json()
  return j.tipos ?? []
}

/** El consultorio del gesto: el de la cita, o el de la rejilla en un clic. */
function consultorioDelGesto(e: Entrada, donde: DondeTurno | undefined): Consultorio | null {
  const lista = e.consultorios ?? []
  if (donde) return lista.find(c => c.id === donde.consultorioId && c.medico_id === donde.medicoId) ?? null
  const c = consultorioDeLaRejilla({ consultorios: lista, consultorioActivo: e.consultorioActivo, medicoMostrado: e.medicoMostrado })
  return lista.find(x => x.id === c?.id) ?? null
}

export function useAjusteTurno(e: Entrada): AjustarTurno {
  const { agendaV2, consultorios, horarioClinica, consultorioActivo, medicoMostrado } = e
  const tiposRef = useRef<TipoCita[] | null>(null)
  useEffect(() => {
    if (!agendaV2) return
    let vivo = true
    leerTipos('/api/agenda/tipos-cita').then(t => { if (vivo) tiposRef.current = t }).catch(() => { /* sin ajuste */ })
    return () => { vivo = false }
  }, [agendaV2])
  return useCallback<AjustarTurno>((instante, donde) => {
    const tipos = tiposRef.current
    if (!agendaV2 || !tipos) return null
    const c = consultorioDelGesto({ agendaV2, consultorios, horarioClinica, consultorioActivo, medicoMostrado }, donde)
    if (!c || c.activo === false) return null
    const duracion = duracionDeConsulta(tipos.filter(t => t.activo && (t.medico_id === null || t.medico_id === c.medico_id)), c.id)
    if (!duracion) return null
    return ajustarATurno({ instante, tz: c.timezone, horario: horarioEfectivo(c, horarioClinica ?? null), duracionMin: duracion })
  }, [agendaV2, consultorios, horarioClinica, consultorioActivo, medicoMostrado])
}
