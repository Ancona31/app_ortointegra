/**
 * src/lib/agenda/disponibilidad.ts
 *
 * La disponibilidad de un médico en un consultorio (plan del bloque B, paso
 * B5): qué horario manda para ese consultorio, el suyo o el de la clínica.
 * Lo leerán el cálculo de turnos del servidor (B8 y la reserva por enlace, D)
 * y la pantalla de configuración (B4).
 *
 * ⚠️ MÓDULO PURO: sin `'use client'`, sin Supabase, sin tipos de FullCalendar.
 *
 * ⚠️⚠️ LA REJILLA NO LEE ESTO. El gris de fuera de horario, «Compactar», los
 * avisos de fuera de horario y el panel del día siguen gobernados por
 * `clinicas.horario_consulta` (decisión P6). Esto sólo decide qué turnos se
 * pueden OFRECER; cambiar la rejilla para que lo use es otra decisión.
 *
 * El convenio de `consultorios.horario_propio` (migración
 * `20261112140000_agenda_b5_horario_propio.sql`, y su COMMENT ON COLUMN):
 *   - `false` o ausente → manda el horario de la clínica, que es lo de hoy;
 *   - `true` → manda `consultorios.horario`. Con todos los días inactivos el
 *     consultorio está CERRADO: no hereda. Por eso es una bandera explícita y
 *     no «si no hay días activos, hereda».
 */
import { z } from 'zod'
import type { DiaSemana, Horario, HorarioDia } from '@/lib/configApp'
import { DIAS, HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { horarioSchema } from '@/lib/consultorios/schemas'

const DIAS_SEMANA: readonly DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Lo que `horarioEfectivo` necesita de un consultorio. `horario_propio` falta si la migración no está. */
export interface ConsultorioDisponibilidad {
  horario: unknown
  horario_propio?: boolean | null
}

/** Un día abierto de verdad: activo, con horas `HH:MM` y el cierre después de la apertura. */
const DiaAbiertoSchema = z.object({
  activo: z.literal(true),
  inicio: z.string().regex(HHMM),
  fin: z.string().regex(HHMM),
}).refine(d => d.inicio < d.fin)

const HorarioCrudoSchema = z.record(z.string(), z.unknown())

/**
 * Normaliza un horario a la forma de 7 días: cada día que no esté abierto de
 * verdad (falta, mal formado, o con fin ≤ inicio) queda CERRADO. Falla
 * cerrado: un día dudoso no ofrece turnos.
 */
function normalizarHorario(h: unknown): Horario {
  const crudo = HorarioCrudoSchema.safeParse(h)
  const fuente: Record<string, unknown> = crudo.success ? crudo.data : {}
  const dia = (k: DiaSemana): HorarioDia => {
    const r = DiaAbiertoSchema.safeParse(fuente[k])
    return r.success
      ? { activo: true, inicio: r.data.inicio, fin: r.data.fin }
      : { activo: false, inicio: HORARIO_DEFAULT[k].inicio, fin: HORARIO_DEFAULT[k].fin }
  }
  return {
    lunes: dia('lunes'), martes: dia('martes'), miercoles: dia('miercoles'), jueves: dia('jueves'),
    viernes: dia('viernes'), sabado: dia('sabado'), domingo: dia('domingo'),
  }
}

/**
 * El horario que manda para ofrecer turnos en este consultorio.
 *
 * - Sin consultorio, o con `horario_propio` distinto de `true`: el de la
 *   clínica. Si la clínica no tiene (`null`), `HORARIO_DEFAULT`, igual que la
 *   rejilla (`AgendaCliente.tsx`: `config?.horario ?? HORARIO_DEFAULT`).
 * - Con `horario_propio === true`: el del consultorio, tal cual, aunque esté
 *   todo cerrado.
 *
 * En los dos casos los días mal formados o con fin ≤ inicio salen cerrados:
 * ni `PUT /api/me/horario` ni el `horarioSchema` de consultorios lo
 * impidieron hasta hoy.
 */
export function horarioEfectivo(
  consultorio: ConsultorioDisponibilidad | null | undefined,
  horarioClinica: Horario | null | undefined,
): Horario {
  if (consultorio?.horario_propio === true) return normalizarHorario(consultorio.horario)
  return normalizarHorario(horarioClinica ?? HORARIO_DEFAULT)
}

/**
 * ¿Todos los días activos cierran después de abrir? Es la validación que
 * `PATCH /api/consultorios/[id]` aplica con la agenda v2 encendida. Los días
 * inactivos no se miran: sus horas son sólo lo que el formulario recuerda.
 */
export function horarioEnOrden(h: Horario): boolean {
  return DIAS_SEMANA.every(dia => !h[dia].activo || h[dia].inicio < h[dia].fin)
}

/**
 * El horario de la clínica tal como lo acepta `PUT /api/me/horario` (P8): la
 * forma de `horarioSchema` (los siete días, `HH:MM`) y, en cada día activo, el
 * cierre después de la apertura. Un aviso por día que falle, con su nombre,
 * para que el toast diga cuál. Las horas de los días inactivos sólo se
 * comprueban de forma, igual que `horarioEnOrden`.
 */
export const HorarioEnOrdenSchema = horarioSchema.superRefine((h, ctx) => {
  for (const { key, label } of DIAS) {
    if (h[key].activo && h[key].inicio >= h[key].fin) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${label}: la hora de cierre tiene que ir después de la de apertura`,
      })
    }
  }
})
