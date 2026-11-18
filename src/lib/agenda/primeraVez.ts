/**
 * src/lib/agenda/primeraVez.ts
 *
 * Las reglas del funnel de primera vez de la configuración de la agenda
 * (tanda J, J5, punto 13 de Angel; maqueta `docs/spec/Main.dc.html`).
 *
 * ⚠️ «PRIMERA VEZ» SE CALCULA DE LOS DATOS (`esPrimeraVez`): el médico no
 * tiene duración propia, o NINGUNO de sus consultorios tiene el horario
 * confirmado. Así es como lo deja la semilla, la herencia de G4 y «Empezar de
 * nuevo» (que archiva duraciones, revoca enlaces y deja el horario «por
 * revisar»): el funnel sale «la primera vez y tras Empezar de nuevo» (punto
 * 13) y abre en el primer paso que falte según `pasosDe`. Lo que falte DESPUÉS
 * —un consultorio nuevo «por revisar», el enlace apagado a propósito— no lo
 * reabre: se arregla en las pestañas («Confirmar horario», el interruptor).
 *
 * Lo único que se GUARDA es el paso de «Terminar después», para volver al
 * mismo: en `localStorage` del navegador, por usuario (no es un dato de
 * paciente; sin él, el funnel abre en el primer paso pendiente). Decisión
 * anotada en las notas de J5 (a): es lo que menos cambia (sin migración).
 *
 * ⚠️ MÓDULO NEUTRO: sin `'use client'`. Lo de `localStorage` va en try/catch
 * y no hace nada fuera del navegador.
 */
import type { DiaSemana, Horario } from '@/lib/configApp'

/**
 * 0 = el horario de la clínica, SÓLO para el médico administrador (K3, punto 12: el primer paso);
 * 1 = el de cada consultorio; 2 = la duración; 3 = los avisos. Quien no administra empieza en el 1.
 */
export type PasoPrimeraVez = 0 | 1 | 2 | 3

/** Lo que hace falta de un paso de `pasosDe` (y, para quien administra, el de la clínica). */
interface PasoCalculado { clave: 'clinica' | 'horario' | 'duracion' | 'enlace'; hecho: boolean }

const ORDEN: Record<PasoCalculado['clave'], PasoPrimeraVez> = { clinica: 0, horario: 1, duracion: 2, enlace: 3 }

/**
 * El paso de la clínica, para añadirlo a los de `pasosDe` cuando quien entra administra (K3, punto 12).
 * Pendiente cuando lo está el horario de los consultorios (la primera vez y tras «Empezar de nuevo»):
 * el de la clínica es la base de «Igual que la clínica», así que se repasa antes. No depende de que la
 * clínica tenga huso: un administrador al que sólo le falta la duración abre en ella, como antes, y
 * el huso lo propone el paso (el del primer consultorio) cuando se pasa por él.
 */
export function pasoClinica(pasos: readonly PasoCalculado[]): PasoCalculado {
  return { clave: 'clinica', hecho: pasos.find(p => p.clave === 'horario')?.hecho === true }
}

/** «Paso N de M»: el número que se enseña y el total, según si el funnel lleva el paso de la clínica. */
export function numeroDePaso(paso: PasoPrimeraVez, conClinica: boolean): { n: number; de: number } {
  return conClinica ? { n: paso + 1, de: 4 } : { n: paso, de: 3 }
}

/** El primer paso que falta, o `null` si no falta ninguno. */
export function primerPendiente(pasos: readonly PasoCalculado[]): PasoPrimeraVez | null {
  const pendientes = pasos.filter(p => !p.hecho).map(p => ORDEN[p.clave]).sort()
  return pendientes[0] ?? null
}

/** ¿Es la primera vez? Ver la cabecera. `horario_revisado_en` ausente (sin la migración de I4) no cuenta como «por revisar». */
export function esPrimeraVez(pasos: readonly PasoCalculado[], consultorios: readonly { horario_revisado_en?: string | null }[]): boolean {
  const duracion = pasos.find(p => p.clave === 'duracion')
  return duracion?.hecho !== true || (consultorios.length > 0 && consultorios.every(c => c.horario_revisado_en === null))
}

/**
 * Qué enseña la página: el funnel (y en qué paso) o las pestañas.
 * `pasos === undefined`: todavía no se sabe (falta la lista de enlaces).
 * `pasos === null`: no se pudo calcular → pestañas (falla hacia lo que ya existe).
 * Sin consultorio activo el funnel no tiene qué preguntar: pestañas.
 */
export function vistaInicial(o: {
  esMedico: boolean; conConsultorio: boolean; pasos: readonly PasoCalculado[] | null | undefined; guardado: PasoPrimeraVez | null
  /** `esPrimeraVez`: si no, aunque falte algo, pestañas («Terminar después» manda igual). */
  primeraVez: boolean
}): 'cargando' | 'pestanas' | { paso: PasoPrimeraVez } {
  if (!o.esMedico || !o.conConsultorio) return 'pestanas'
  if (o.pasos === undefined) return 'cargando'
  if (o.pasos === null) return 'pestanas'
  if (o.guardado !== null) return { paso: o.guardado }
  if (!o.primeraVez) return 'pestanas'
  const paso = primerPendiente(o.pasos)
  return paso !== null ? { paso } : 'pestanas'
}

const clave = (usuarioId: string) => `spinus-agenda-primera-vez:${usuarioId}`

/** El paso guardado con «Terminar después», o `null`. */
export function pasoGuardado(usuarioId: string): PasoPrimeraVez | null {
  try {
    const v = typeof window === 'undefined' ? null : window.localStorage.getItem(clave(usuarioId))
    return v === '0' ? 0 : v === '1' ? 1 : v === '2' ? 2 : v === '3' ? 3 : null
  } catch {
    return null
  }
}

export function guardarPaso(usuarioId: string, paso: PasoPrimeraVez): void {
  try { window.localStorage.setItem(clave(usuarioId), String(paso)) } catch { /* modo privado: abre en el pendiente */ }
}

export function olvidarPaso(usuarioId: string): void {
  try { window.localStorage.removeItem(clave(usuarioId)) } catch { /* nada que olvidar */ }
}

/** Las cuatro de la maqueta. */
const RECORDATORIO = [
  { horas: 2, texto: '2 horas', corto: '2 horas' },
  { horas: 12, texto: '12 horas', corto: '12 horas' },
  { horas: 24, texto: '1 día (24 horas)', corto: '1 día' },
  { horas: 48, texto: '2 días (48 horas)', corto: '2 días' },
] as const

const horasEnTexto = (h: number) => `${h} ${h === 1 ? 'hora' : 'horas'}`

/**
 * Las opciones del selector «Mandarlo … antes de la cita». Punto 17 de Angel:
 * si la clínica ya tiene un valor que no es de las cuatro (p. ej. 6 horas), se
 * añade en su sitio para que el selector lo enseñe y no lo pise.
 */
export function opcionesRecordatorio(actual: number | null): { horas: number; texto: string }[] {
  const base = RECORDATORIO.map(o => ({ horas: o.horas as number, texto: o.texto as string }))
  if (actual === null || base.some(o => o.horas === actual)) return base
  return [...base, { horas: actual, texto: horasEnTexto(actual) }].sort((a, b) => a.horas - b.horas)
}

/** «1 día», «2 horas»… para el resumen del cierre. */
export function recordatorioCorto(horas: number): string {
  return RECORDATORIO.find(o => o.horas === horas)?.corto ?? horasEnTexto(horas)
}

/* ── Paso 1: «Igual que la clínica» u «Otro horario», por consultorio ─────── */

/** Lo que el paso 1 necesita de un consultorio. */
export interface ConsultorioPaso1 {
  horario: Horario
  horario_propio?: boolean
  horario_revisado_en?: string | null
}

export type ModoHorario = 'clinica' | 'propio'

const DIAS_ORDEN: readonly DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

/** ¿Los mismos días abiertos con las mismas horas? Las horas de un día cerrado no cuentan. */
export function mismoHorario(a: Horario, b: Horario): boolean {
  return DIAS_ORDEN.every(k => a[k].activo === b[k].activo && (!a[k].activo || (a[k].inicio === b[k].inicio && a[k].fin === b[k].fin)))
}

/**
 * Qué opción sale elegida. «Igual que la clínica» si hereda (`horario_propio`
 * no es `true`) o si su horario propio ES el de la clínica: lo que deja
 * «Empezar de nuevo» (el de la clínica copiado como propio, decisión de la
 * tanda H) se enseña como lo que es para el médico.
 */
export function modoInicial(c: ConsultorioPaso1, clinica: Horario): ModoHorario {
  return c.horario_propio !== true || mismoHorario(c.horario, clinica) ? 'clinica' : 'propio'
}

export type CambiosPaso1 = { horario_propio: boolean; horario: Horario } | { horario_revisado: true }

/**
 * Lo que «Continuar» manda por un consultorio (`PATCH /api/consultorios/[id]`),
 * o `null` si no hay nada que mandar (ya estaba así y ya revisado).
 *
 * «Igual que la clínica» manda también el horario de la clínica en la columna:
 * no cambia lo que vale (con `horario_propio:false` manda el de la clínica,
 * `horarioEfectivo`), pero un consultorio que nació con la columna cerrada deja
 * de contar como «sin tocar» en `pasosDe` y el paso queda hecho.
 */
export function cambiosPaso1(c: ConsultorioPaso1, modo: ModoHorario, propio: Horario, clinica: Horario): CambiosPaso1 | null {
  const yaRevisado = c.horario_revisado_en !== null
  if (modo === 'propio') {
    const igual = c.horario_propio === true && mismoHorario(c.horario, propio)
    return igual && yaRevisado ? null : { horario_propio: true, horario: propio }
  }
  const hereda = c.horario_propio !== true && DIAS_ORDEN.some(k => c.horario[k].activo)
  if (hereda) return yaRevisado ? null : { horario_revisado: true }
  return { horario_propio: false, horario: clinica }
}
