'use client'

/**
 * Las piezas de una cita en el dashboard (rediseño B5, CALMA §24 y maqueta
 * `dashboard-final`): el chip de fecha, las marcas de origen, la pieza principal
 * («Lo que sigue»), la fila pulsable de «Después» y la hoja de acciones.
 *
 * ⚠️ COMO `ProximasCitas`, ESTE ARCHIVO NO CONOCE NINGUNA URL CLÍNICA. Las
 * acciones de expediente y nota las pinta quien llama (`acciones`, `ligar`); aquí
 * sólo se colocan. La garantía de la vista de la secretaria sigue siendo
 * estructural: un `grep` de `expediente` aquí debe dar cero.
 */
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import IconoEstadoCita from '@/components/ui/IconoEstadoCita'
import MarcaOrigen from '@/components/ui/MarcaOrigen'
import { ETIQUETA_SIN_EXPEDIENTE, IconoSinExpediente } from '@/components/agenda/MarcasCita'
import { esPorAsignar, marcasDeCita, STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { chipFechaCita, cuandoCita, partesCitaHora } from '@/app/(app)/dashboard/utils'
import type { Cita } from './ProximasCitas'

/** Tarjeta del dashboard: `--sup`, sin borde ni sombra (CALMA §3), radio 16 (20 en ancho). */
export const TARJETA = 'rounded-[16px] bg-sup p-4 text-tinta ih:rounded-[20px] ih:p-5 iv:rounded-[20px] iv:p-5 esc:rounded-[20px] esc:p-5'

/**
 * El estado que pinta el dashboard. Las consultas sólo dejan pasar agendadas y
 * confirmadas; cualquier otro valor sale como «Agendada», igual que hacía
 * `StatusChip` (su catch-all).
 */
export function estadoDe(status: string): Status {
  return status === 'confirmed' ? 'confirmed' : 'scheduled'
}

/** Una por ligar se nombra con lo que dio quien reservó; una «por asignar» de Google, con su título. */
export function nombreDeCita(cita: Cita): string {
  return cita.pacientes
    ? `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`
    : (cita.reserva_canal && cita.reserva_nombre) || cita.title
}

/** «Reservó por enlace · Sin expediente»: lo que dicen las marcas, para el nombre accesible de la fila. */
function textoMarcas(cita: Cita): string {
  const m = marcasDeCita(cita)
  return [
    m.enlace ? 'Reservó por enlace' : '',
    esPorAsignar(cita) ? 'Agendada desde Google Calendar' : '',
    m.sinExpediente ? ETIQUETA_SIN_EXPEDIENTE : '',
  ].filter(Boolean).map(t => ` · ${t}`).join('')
}

/** El chip de fecha: mes en `--mes` (11 px, la única excepción de la escala) y día. */
export function FechaChip({ inicio }: { inicio: string }): ReactElement {
  const { mes, dia } = chipFechaCita(inicio)
  return (
    <span aria-hidden="true" className="flex h-[50px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-fondo leading-none">
      <span className="text-[11px] font-bold uppercase tracking-[.4px] text-mes">{mes}</span>
      <span className="k-num mt-[4px] text-[20px] font-bold text-tinta">{dia}</span>
    </span>
  )
}

/**
 * Las marcas de procedencia (CALMA §24.5, §28): el eslabón con «Por enlace»
 * (largo: «Reservó por enlace»), Google Calendar en una «por asignar» y
 * «Sin expediente» (hoy el expediente tachado con su nombre accesible). Sin la
 * v2 las columnas no llegan y no hay ninguna, como antes.
 */
export function MarcasCita({ cita, largo = false }: { cita: Cita; largo?: boolean }): ReactElement | null {
  const m = marcasDeCita(cita)
  const google = esPorAsignar(cita)
  if (!m.enlace && !m.sinExpediente && !google) return null
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {m.enlace && <span data-marca-enlace className="inline-flex"><MarcaOrigen origen="enlace" corto={!largo} /></span>}
      {google && <span data-marca-google className="inline-flex"><MarcaOrigen origen="google" corto={!largo} /></span>}
      {m.sinExpediente && (
        <span role="img" aria-label={m.historial ? `${ETIQUETA_SIN_EXPEDIENTE}. ${m.historial}` : ETIQUETA_SIN_EXPEDIENTE}
          title="Aún no tiene expediente" className="k-origen" data-marca-sin-expediente>
          <IconoSinExpediente size={14} /><span aria-hidden="true">{ETIQUETA_SIN_EXPEDIENTE}</span>
        </span>
      )}
    </span>
  )
}

/** Hora y, en la vista de toda la clínica, el médico: «18:30 · Dr. Admin Semilla». */
function LineaHora({ cita }: { cita: Cita }): ReactElement {
  const { hora } = partesCitaHora(cita.start_time)
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] leading-[18px] text-tinta2">
      <span className="k-num">{hora}</span>
      {/* En teléfono el médico baja a su propia línea, sin el punto. */}
      {cita.medico && (
        <span className="min-w-0 truncate ext:basis-full tel:basis-full">
          <span className="ext:hidden tel:hidden">· </span>{componerNombreMedicoCompleto(cita.medico)}
        </span>
      )}
    </span>
  )
}

/**
 * La pieza principal (CALMA §24.3): la cita EN CURSO o, si no hay, la siguiente.
 * Conserva su acción directa («Iniciar consulta», o la de una cita sin
 * expediente), que pinta quien llama en `acciones`.
 */
export function PiezaPrincipal({ cita, enCurso, acciones, className = '' }: {
  cita: Cita; enCurso: boolean; acciones: ReactNode; className?: string
}): ReactElement {
  return (
    <section aria-label="Lo que sigue" data-cita-fila className={`${TARJETA} ${className}`}>
      {enCurso && (
        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase leading-4 tracking-[.4px] text-enlace">
          <span aria-hidden="true" className="size-2 rounded-full bg-accion" />En curso
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-[240px] items-start gap-3">
          <FechaChip inicio={cita.start_time} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-[20px] font-bold leading-[26px] text-tinta [overflow-wrap:anywhere]">{nombreDeCita(cita)}</p>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <LineaHora cita={cita} />
              <IconoEstadoCita estado={estadoDe(cita.status)} texto="siempre" compacto />
            </span>
            <MarcasCita cita={cita} />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 ih:w-auto iv:w-auto esc:w-auto">{acciones}</div>
      </div>
    </section>
  )
}

/** El cuerpo de una fila de lista: chip, nombre, hora (y médico), marcas y estado. */
function CuerpoFila({ cita }: { cita: Cita }): ReactElement {
  return (
    <>
      <FechaChip inicio={cita.start_time} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-5 text-tinta [overflow-wrap:anywhere]">{nombreDeCita(cita)}</span>
        <LineaHora cita={cita} />
        <MarcasCita cita={cita} />
      </span>
      {/* En `iv` la columna es estrecha: sólo el icono, el nombre del estado
          queda para el lector de pantalla (como en ext/tel). */}
      <IconoEstadoCita estado={estadoDe(cita.status)} className="iv:[&_.k-est-t]:sr-only" />
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tinta3" />
    </>
  )
}

const FILA = 'k-pulsable flex w-full min-h-[64px] items-center gap-3 py-3 text-left ext:gap-2 iv:gap-2'

/** El nombre accesible de una fila: «Paciente, Hoy 18:30, Confirmada · Reservó por enlace». */
function etiquetaFila(cita: Cita): string {
  const { dia, hora } = partesCitaHora(cita.start_time)
  return `${nombreDeCita(cita)}, ${dia} ${hora}, ${STATUS_CONFIG[estadoDe(cita.status)].label}${textoMarcas(cita)}`
}

/** Fila de «Después» (médico): entera pulsable, abre la hoja de acciones (CALMA §24.1–§24.2). */
export function FilaCita({ cita, alAbrir }: { cita: Cita; alAbrir: (c: Cita) => void }): ReactElement {
  return (
    <li data-cita-fila>
      <button type="button" data-abre-hoja aria-haspopup="dialog" onClick={() => alAbrir(cita)}
        aria-label={`${etiquetaFila(cita)}. Acciones de la cita`} className={FILA}>
        <CuerpoFila cita={cita} />
      </button>
    </li>
  )
}

/**
 * Fila de la vista de toda la clínica (secretaria): entera es «Ver cita», que
 * navega a la agenda SIN parámetros, como el botón de antes. En una «por
 * asignar», «¿No es una cita?» va fuera del enlace, en la misma fila.
 */
export function FilaCitaClinica({ cita, enCurso, extra }: { cita: Cita; enCurso: boolean; extra?: ReactNode }): ReactElement {
  const etiqueta = cita.paciente_id
    ? `Ver la cita de ${cita.pacientes ? `${cita.pacientes.nombre} ${cita.pacientes.apellidos}` : cita.title} en la agenda`
    : `Ver «${cita.reserva_nombre ?? cita.title}» en la agenda`
  return (
    <li data-cita-fila className="flex flex-col">
      <Link href="/agenda" prefetch={enCurso ? undefined : false} aria-label={etiqueta} className={FILA}>
        <CuerpoFila cita={cita} />
      </Link>
      {extra && <div className="-mt-1 flex justify-end pb-2">{extra}</div>}
    </li>
  )
}

const ESTADOS: Status[] = ['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended']

/**
 * «Estados»: la leyenda de los cinco estados de `appointments_status_check`,
 * plegada tras un botón (antes una fila fija, sólo en `lg`). Desplegable
 * anclado al botón, sin velo; se cierra al tocar fuera o con Esc.
 */
export function BotonEstados(): ReactElement {
  const [abierta, setAbierta] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!abierta) return
    const fuera = (e: PointerEvent): void => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAbierta(false)
    }
    const tecla = (e: KeyboardEvent): void => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierta])
  return (
    <div ref={raiz} className="relative">
      <button type="button" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta(a => !a)}
        className="k-b k-b-texto text-[13px] text-tinta2 ext:px-0.5">
        Estados <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>
      <ul id={id} hidden={!abierta} aria-label="Leyenda de estados"
        className="absolute right-0 top-full z-10 mt-1 flex w-max flex-col gap-2 rounded-[14px] bg-sup p-3 shadow-[var(--sombra-capa)]">
        {ESTADOS.map(e => <li key={e}><IconoEstadoCita estado={e} texto="siempre" compacto /></li>)}
      </ul>
    </div>
  )
}

/**
 * La hoja de acciones de la cita (CALMA §24.2): hoja inferior en `tel`, tarjeta
 * centrada en el resto (ModalShell). Cabecera con nombre, cuándo y médico;
 * estado y origen con texto; debajo, las acciones que pinta quien llama.
 * Tocar una acción (enlace o botón) cierra la hoja, salvo lo que vaya dentro de
 * `[data-no-cierra]` («¿No es una cita?», que la cierra él al terminar).
 */
export function HojaCita({ cita, abierta, alCerrar, children }: {
  cita: Cita | null; abierta: boolean; alCerrar: () => void; children: ReactNode
}): ReactElement | null {
  if (!cita) return null
  const medico = cita.medico ? ` · ${componerNombreMedicoCompleto(cita.medico)}` : ''
  const historial = marcasDeCita(cita).historial
  const alPulsar = (e: MouseEvent<HTMLDivElement>): void => {
    if (!(e.target instanceof Element)) return
    if (e.target.closest('[data-no-cierra]')) return
    if (e.target.closest('a, button')) alCerrar()
  }
  return (
    <ModalShell open={abierta} onClose={alCerrar} title={nombreDeCita(cita)}
      subtitle={`${cuandoCita(cita.start_time, cita.end_time)}${medico}`} maxWidth="max-w-[400px]">
      <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <IconoEstadoCita estado={estadoDe(cita.status)} texto="siempre" compacto />
          <MarcasCita cita={cita} largo />
        </div>
        {historial && <p className="text-[13px] leading-[18px] text-tinta2">{historial}</p>}
        <div onClick={alPulsar} className="flex flex-col">{children}</div>
      </div>
    </ModalShell>
  )
}
