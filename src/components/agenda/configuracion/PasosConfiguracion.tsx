'use client'

/**
 * «Primeros pasos» (tanda T2, punto 7; rehecho en G2, puntos 5, 7 y 8 de
 * Angel): tres pasos en este orden —(1) el horario de cada consultorio, (2) la
 * duración de la consulta, (3) el enlace de reserva— con su avance (barra y
 * «N de 3 listos»), para el médico que mira la pantalla. No es un asistente:
 * es una tarjeta que se ve mientras falte algo y desaparece al completarse.
 *
 * ⚠️ EL ESTADO SE CALCULA DE LOS DATOS, NO SE GUARDA: los dos primeros pasos
 * salen de `preparacion` (la regla con la que la página pública decide si un
 * enlace abre: `motivosApertura`) y el tercero de los enlaces vigentes.
 *
 * G2 · «Tipo de cita» deja de ser un requisito visible: el paso 2 PREGUNTA la
 * duración ahí mismo (`DuracionConsulta`) y crea por dentro el tipo principal.
 * Crear el enlace nunca deja un callejón sin salida: si falta algo, «Crear
 * enlace» lo pide en la misma tarjeta (la duración se contesta ahí y el enlace
 * se crea a continuación; el horario lleva a su sección o al perfil). Se puede
 * crear igualmente, como en T2: el aviso dice que no abrirá, no lo impide.
 *
 * Sólo para médicos (dueño o invitado): la secretaria no tiene enlace propio.
 */
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import DuracionConsulta from '@/components/agenda/configuracion/DuracionConsulta'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAJA_AVISO } from '@/components/agenda/configuracion/clasesConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import type { ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import type { MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import { useToast } from '@/components/ui/Toast'
import { DIAS } from '@/lib/agenda/horarioAgenda'
import type { Consultorio } from '@/types'

export type ClavePaso = 'horario' | 'duracion' | 'enlace'
export interface Paso { clave: ClavePaso; titulo: string; hecho: boolean }

/** Lo que `pasosDe` necesita de un consultorio para saber si su horario se configuró alguna vez. */
type ConsultorioPaso = Pick<Consultorio, 'medico_id' | 'activo' | 'horario' | 'horario_propio'>

/**
 * ¿Este consultorio está como NACE, sin que nadie haya tocado su horario?
 * (tanda H, punto 10): sin horario propio y con su `horario` de columna todo
 * cerrado —el DEFAULT de la tabla, que es justo lo que deja «Restablecer
 * configuración»—. Un consultorio así hereda el de la clínica (la agenda no se
 * queda en gris), pero su médico nunca dijo qué días atiende: el paso 1 queda
 * pendiente. Uno que se creó con su horario, o que tiene horario propio, no.
 */
function horarioSinTocar(c: ConsultorioPaso): boolean {
  return c.horario_propio !== true && !DIAS.some(d => c.horario?.[d.key]?.activo === true)
}

/**
 * Los tres pasos de `medicoId`, o `null` si no hay datos para decidir.
 * `consultorios` (los del agregado de configuración): si alguno ACTIVO de este
 * médico está sin tocar, el paso del horario queda pendiente aunque abra con
 * el de la clínica. Sin ellos (`null`), la regla de antes.
 */
export function pasosDe(lista: ListaEnlaces, medicoId: string, consultorios: readonly ConsultorioPaso[] | null = null): Paso[] | null {
  const motivos = lista.preparacion?.[medicoId]
  if (!motivos) return null
  const sinTocar = (consultorios ?? []).some(c => c.medico_id === medicoId && c.activo !== false && horarioSinTocar(c))
  return [
    { clave: 'horario', titulo: 'Horario de cada consultorio', hecho: !motivos.includes('sin_consultorio') && !motivos.includes('sin_disponibilidad') && !sinTocar },
    { clave: 'duracion', titulo: 'Duración de la consulta', hecho: !motivos.includes('sin_tipos') },
    { clave: 'enlace', titulo: 'Enlace de reserva', hecho: lista.enlaces.some(e => e.medico_id === medicoId) },
  ]
}

interface Props {
  pasos: Paso[]
  motivos: readonly MotivoApertura[]
  medicoId: string
  /** Una línea por paso hecho: los consultorios y sus días, la duración. */
  resumen: Partial<Record<ClavePaso, string>>
  /** Sin `RESERVA_SECRETO` no se emiten enlaces. */
  puedeEmitir: boolean
  /** Tras cualquier cambio: releer tipos y enlaces. */
  alCambiar: () => void
}

async function crearEnlaceFijo(medicoId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/agenda/enlaces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clase: 'fijo', medico_id: medicoId }),
    })
    return res.ok ? null : await leerMotivoError(res, 'No se pudo crear el enlace')
  } catch {
    return 'No se pudo crear el enlace'
  }
}

const AYUDA: Record<ClavePaso, string> = {
  horario: 'Qué días y horas atiendes en cada consultorio.',
  duracion: 'Con ella se cuentan los horarios que ofrece tu enlace.',
  enlace: 'Para que tus pacientes agenden por su cuenta.',
}

/** Un paso: el círculo (número o palomita), el título con su línea y la acción a la derecha. */
function FilaPaso({ paso, n, detalle, accion, children }: { paso: Paso; n: number; detalle: string; accion?: ReactNode; children?: ReactNode }) {
  return (
    <li aria-label={`${paso.titulo}: ${paso.hecho ? 'hecho' : 'pendiente'}`} className="flex flex-col gap-[var(--ag-3)]">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-[var(--ag-3)] gap-y-[var(--ag-2)] sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]">
        <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full border-2 text-xs font-bold ${paso.hecho
          ? 'border-[var(--ag-success-text)] bg-[var(--ag-success-text)] text-white'
          : 'border-[var(--ag-border-card)] bg-[var(--ag-surface)] text-[var(--ag-muted)]'}`}>
          {paso.hecho ? <Check size={14} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ag-text)]">{paso.titulo}</p>
          <p className="text-sm text-[var(--ag-muted)]">{detalle}</p>
        </div>
        {accion && <div className="col-start-2 flex flex-wrap gap-[var(--ag-2)] sm:col-start-3">{accion}</div>}
      </div>
      {children}
    </li>
  )
}

/** Lo que falta para que el enlace abra, pedido ahí mismo (punto 8). */
function FaltaAntesDelEnlace(p: { motivos: readonly MotivoApertura[]; medicoId: string; alResolverDuracion: () => void; crearIgual: () => void; ocupado: boolean }) {
  const falta = (m: MotivoApertura) => p.motivos.includes(m)
  return (
    <div role="note" aria-label="Falta para crear el enlace" className={`${CAJA_AVISO} ml-0 flex flex-col gap-[var(--ag-3)] sm:ml-9`}>
      <p className="font-medium">Para que tu enlace abra, falta:</p>
      {falta('sin_consultorio') && <p>Un consultorio activo. <Link href="/perfil" className="font-medium underline underline-offset-2">Darlo de alta en Mi perfil</Link></p>}
      {falta('sin_disponibilidad') && <p>Algún día abierto. <a href="#config-disponibilidad" className="font-medium underline underline-offset-2">Abrir el horario de tu consultorio</a></p>}
      {falta('sin_tipos') && (
        <div className="rounded-[var(--ag-r-btn)] bg-[var(--ag-surface)] p-[var(--ag-3)] text-[var(--ag-text)]">
          <DuracionConsulta medicoId={p.medicoId} pregunta="¿Cuánto dura tu consulta?" textoBoton="Guardar y crear el enlace"
            onHecho={p.alResolverDuracion} />
        </div>
      )}
      <button type="button" className={`${BOTON_SECUNDARIO} w-fit`} disabled={p.ocupado} onClick={p.crearIgual}>
        Crear el enlace igualmente
      </button>
    </div>
  )
}

export default function PasosConfiguracion({ pasos, motivos, medicoId, resumen, puedeEmitir, alCambiar }: Props) {
  const toast = useToast()
  const [pidiendo, setPidiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const hechos = pasos.filter(p => p.hecho).length
  const faltaAntes = pasos.some(p => p.clave !== 'enlace' && !p.hecho)

  async function crear(): Promise<void> {
    setOcupado(true)
    const motivo = await crearEnlaceFijo(medicoId)
    setOcupado(false)
    if (motivo) { toast.error(motivo); return }
    toast.success('Enlace fijo creado')
    setPidiendo(false)
    alCambiar()
  }
  const alDuracion = (encadenar: boolean) => { toast.success('Duración de la consulta guardada'); if (encadenar) void crear(); else alCambiar() }
  const accionDe = (p: Paso): ReactNode => accionDelPaso(p, { motivos, puedeEmitir, ocupado, pedir: () => (faltaAntes ? setPidiendo(true) : void crear()) })

  return (
    <section aria-labelledby="config-pasos" id="primeros-pasos"
      className="scroll-mt-[var(--ag-6)] rounded-[var(--ag-r-card)] border border-[var(--ag-border-card)] bg-[var(--ag-primary-bg-faint)] p-[var(--ag-5)] flex flex-col gap-[var(--ag-4)]">
      <div className="flex items-baseline justify-between gap-[var(--ag-3)]">
        <h2 id="config-pasos" className="text-base font-semibold text-[var(--ag-text)]">Primeros pasos</h2>
        <span className="text-sm text-[var(--ag-muted)] tabular-nums">{hechos} de {pasos.length} listos</span>
      </div>
      <div role="progressbar" aria-label="Avance de los primeros pasos" aria-valuemin={0} aria-valuemax={pasos.length} aria-valuenow={hechos}
        className="h-1.5 overflow-hidden rounded-full bg-[var(--ag-surface)]">
        <div className="h-full origin-left rounded-full bg-[var(--ag-brand-secondary)]" style={{ transform: `scaleX(${hechos / pasos.length})` }} />
      </div>
      <ol className="flex flex-col gap-[var(--ag-4)]">
        {pasos.map((p, i) => (
          <FilaPaso key={p.clave} paso={p} n={i + 1} detalle={p.hecho ? resumen[p.clave] ?? 'Listo' : AYUDA[p.clave]} accion={accionDe(p)}>
            {/* Con «Crear enlace» abierto la pregunta va ahí (una sola vez en la tarjeta). */}
            {p.clave === 'duracion' && !p.hecho && !pidiendo && (
              <div className="ml-0 rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[var(--ag-3)] sm:ml-9">
                <DuracionConsulta medicoId={medicoId} pregunta="¿Cuánto dura tu consulta?" onHecho={() => alDuracion(false)} />
              </div>
            )}
            {p.clave === 'enlace' && pidiendo && !p.hecho && (
              <FaltaAntesDelEnlace motivos={motivos} medicoId={medicoId} ocupado={ocupado}
                alResolverDuracion={() => alDuracion(true)} crearIgual={() => void crear()} />
            )}
          </FilaPaso>
        ))}
      </ol>
    </section>
  )
}

/** La acción de la derecha de cada paso. */
function accionDelPaso(p: Paso, o: { motivos: readonly MotivoApertura[]; puedeEmitir: boolean; ocupado: boolean; pedir: () => void }): ReactNode {
  if (p.clave === 'horario') {
    if (!p.hecho && o.motivos.includes('sin_consultorio')) return <Link href="/perfil" className={BOTON_PRIMARIO}>Dar de alta</Link>
    return <a href="#config-disponibilidad" className={p.hecho ? BOTON_SECUNDARIO : BOTON_PRIMARIO}>{p.hecho ? 'Revisar' : 'Abrir horario'}</a>
  }
  if (p.clave === 'duracion') return p.hecho ? <a href="#config-tipos" className={BOTON_SECUNDARIO}>Revisar</a> : null
  if (p.hecho) return <a href="#config-enlaces" className={BOTON_SECUNDARIO}>Revisar</a>
  if (!o.puedeEmitir) return null
  return <button type="button" className={BOTON_PRIMARIO} disabled={o.ocupado} onClick={o.pedir}>Crear enlace</button>
}
