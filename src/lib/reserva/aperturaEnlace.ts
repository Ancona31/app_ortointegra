/**
 * src/lib/reserva/aperturaEnlace.ts
 *
 * ¿Va a abrir un enlace de reserva, y si no, por qué? (tanda T2, punto 8 de
 * Angel). UNA sola regla para los dos lados:
 *   · la página pública `/reservar/[codigo]` la usa para decidir «Este enlace
 *     ya no está disponible» (hacia el paciente el mensaje sigue genérico);
 *   · la pantalla de configuración la usa, con los MISMOS datos, para decirle
 *     a la clínica qué enlace no abrirá y por qué, y qué falta antes de crear
 *     uno (`GET /api/agenda/enlaces`, campo `preparacion`).
 *
 * Lo que la página decide ANTES de llegar aquí (que `reserva_contexto`
 * devuelva algo: enlace no revocado, interruptor, aviso aprobado, puerta S3,
 * médico en la clínica) vive en la base y en `abrirEnlace()`; la ruta de
 * gestión lo pregunta con esa misma función y lo resume en `no_abre`.
 *
 * ⚠️ MÓDULO PURO Y NEUTRO: sin `'use client'`, sin Supabase. Lo importan la
 * página pública (servidor), la ruta de gestión y la pantalla (cliente).
 *
 * ⚠️ `sin_disponibilidad` NO cierra la página: hoy un enlace sin ningún día
 * abierto abre y no ofrece turnos, y eso no cambia (la opción que menos
 * cambia; §6-bis de la tanda). Sólo se avisa a la clínica.
 */
import { horarioEfectivo, type ConsultorioDisponibilidad } from '@/lib/agenda/disponibilidad'
import { DIAS } from '@/lib/agenda/horarioAgenda'

/** Por qué un enlace no abrirá (o abrirá sin turnos), en el orden en que se dicen. */
export const MOTIVOS_APERTURA = [
  'enlace_usado', 'enlace_caducado', 'no_abre', 'sin_consultorio', 'sin_tipos', 'sin_disponibilidad',
] as const
export type MotivoApertura = (typeof MOTIVOS_APERTURA)[number]

/** Lo que la regla necesita: lo mismo que trae `reserva_contexto`. */
export interface DatosApertura {
  estado: 'vigente' | 'usado' | 'caducado'
  consultorios: readonly ConsultorioDisponibilidad[]
  tipos: number
  /** `clinicas.horario_consulta` crudo; `null` = la clínica no tiene (manda `HORARIO_DEFAULT`). */
  horarioClinica: unknown
}

/** ¿Algún día abierto en este consultorio? Mismo horario que usan los turnos (`reglasDe`). */
function abreAlgunDia(c: ConsultorioDisponibilidad, horarioClinica: unknown): boolean {
  const clinica = horarioClinica === null || horarioClinica === undefined
    ? null
    : horarioEfectivo({ horario: horarioClinica, horario_propio: true }, null)
  const h = horarioEfectivo(c, clinica)
  return DIAS.some(d => h[d.key].activo)
}

/** Todos los motivos que aplican; vacío = abre y ofrece turnos. */
export function motivosApertura(d: DatosApertura): MotivoApertura[] {
  const m: MotivoApertura[] = []
  if (d.estado === 'usado') m.push('enlace_usado')
  if (d.estado === 'caducado') m.push('enlace_caducado')
  if (d.consultorios.length === 0) m.push('sin_consultorio')
  if (d.tipos === 0) m.push('sin_tipos')
  if (d.consultorios.length > 0 && !d.consultorios.some(c => abreAlgunDia(c, d.horarioClinica))) m.push('sin_disponibilidad')
  return m
}

/** ¿Este motivo hace que la página diga «Este enlace ya no está disponible»? */
export function cierraLaPagina(m: MotivoApertura): boolean {
  return m !== 'sin_disponibilidad'
}

/**
 * La línea de aviso de un enlace para la clínica (nunca para el paciente), o
 * `null` si abre y ofrece turnos.
 */
export function avisoDeEnlace(motivos: readonly MotivoApertura[]): string | null {
  const cierran = motivos.filter(cierraLaPagina)
  if (cierran.length) return `No abrirá: ${cierran.map(m => TEXTO_MOTIVO[m]).join('; ')}.`
  if (motivos.includes('sin_disponibilidad')) return `Abrirá sin horarios: ${TEXTO_MOTIVO.sin_disponibilidad}.`
  return null
}

/** La frase de cada motivo para la clínica (nunca para el paciente). */
export const TEXTO_MOTIVO: Record<MotivoApertura, string> = {
  enlace_usado: 'ya se usó',
  enlace_caducado: 'ya caducó',
  no_abre: 'la clínica no puede recibir reservas ahora (aviso de privacidad sin aprobar o clínica sin acceso)',
  sin_consultorio: 'el médico no tiene un consultorio activo',
  sin_tipos: 'no hay un tipo de cita para este médico',
  sin_disponibilidad: 'ningún consultorio del médico tiene días abiertos',
}
