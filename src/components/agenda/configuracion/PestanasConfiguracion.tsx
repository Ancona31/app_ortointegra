'use client'

/**
 * La página de configuración de la agenda en cinco pestañas (tanda J, J5,
 * punto 14; maqueta `docs/spec/Configuracion.dc.html`): «Tu enlace»,
 * «Cuándo das consulta», «Tu consulta», «Avisos» y «Más opciones». Sustituye
 * a las ocho de la tanda H (`ConfiguracionCalendario`, que se queda en disco).
 *
 * «Se guarda sola»: cada pestaña guarda al cambiar, con las rutas de siempre,
 * y avisa con `avisar` → la píldora «Guardado» (`AvisoGuardado`) sólo si el
 * servidor dijo que sí; si no, la misma píldora en rojo con el motivo.
 *
 * Pestañas con el patrón de la APG (flechas, Inicio, Fin). Todos los paneles
 * se montan y sólo se ve el elegido: lo escrito no se pierde al cambiar.
 *
 * K3 (punto 13 de Angel): en el teléfono (< `sm`) cada pestaña es un icono de
 * `lucide-react` (la librería de la app) y las cinco reparten el ancho, sin
 * desplazamiento lateral; debajo, el nombre de la elegida como título. En
 * computadora, el texto de siempre. El nombre accesible es SIEMPRE el texto
 * (`aria-label`), así que las pruebas y el lector de pantalla no cambian.
 */
import Link from 'next/link'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Bell, CalendarClock, ChevronLeft, Ellipsis, Link2, Stethoscope, type LucideIcon } from 'lucide-react'
import AvisoGuardado, { type EstadoAviso } from '@/components/agenda/configuracion/AvisoGuardado'
import BloquesAvisos from '@/components/agenda/configuracion/BloquesAvisos'
import PestanaConsulta from '@/components/agenda/configuracion/PestanaConsulta'
import PestanaEnlace from '@/components/agenda/configuracion/PestanaEnlace'
import PestanaHorario from '@/components/agenda/configuracion/PestanaHorario'
import PestanaMasOpciones from '@/components/agenda/configuracion/PestanaMasOpciones'
import type { Avisar, EstadoAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import type { EstadoLista } from '@/components/agenda/configuracion/listaEnlaces'
import { PANEL, SUB_PANEL, TITULO_PANEL } from '@/components/agenda/configuracion/estilosConfig'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { ConfigApp, Horario, MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'

export interface DatosPestanas {
  lista: EstadoLista
  recargar: () => Promise<void>
  medicos: readonly MedicoConfig[]
  consultorios: readonly Consultorio[] | null
  falloConfig: boolean
  horarioClinica: Horario | null
  /** `clinicas.timezone` (K3, punto 12), o `null`. */
  husoClinica: string | null
  tipos: readonly TipoCita[] | null
  usuarioId: string
  esMedico: boolean
  gestionaTodos: boolean
  puedeAdministrar: boolean
  administradores: readonly string[]
  vigenciaDias: number | null
  avisos: EstadoAvisos
  aviso: EstadoAviso
  avisar: Avisar
  actualizarConfig: (cambio: (c: ConfigApp) => ConfigApp) => void
  /** Releer tipos (servidor) y enlaces. */
  alCambiarDatos: () => void
  alEmpezarDeNuevo: () => void
}

type Clave = 'enlace' | 'horario' | 'consulta' | 'avisos' | 'mas'

const PESTANAS: readonly { clave: Clave; texto: string; textoSinMedico?: string; icono: LucideIcon }[] = [
  { clave: 'enlace', texto: 'Tu enlace', textoSinMedico: 'Enlaces', icono: Link2 },
  { clave: 'horario', texto: 'Cuándo das consulta', textoSinMedico: 'Cuándo dan consulta', icono: CalendarClock },
  { clave: 'consulta', texto: 'Tu consulta', textoSinMedico: 'Tipos de cita', icono: Stethoscope },
  { clave: 'avisos', texto: 'Avisos', icono: Bell },
  { clave: 'mas', texto: 'Más opciones', icono: Ellipsis },
]

const nombreDe = (p: (typeof PESTANAS)[number], esMedico: boolean): string => (esMedico ? p.texto : p.textoSinMedico ?? p.texto)

const MOVER: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n, ArrowLeft: (i, n) => (i - 1 + n) % n, Home: () => 0, End: (_i, n) => n - 1,
}

function Pestanas({ activa, elegir, esMedico }: { activa: Clave; elegir: (c: Clave) => void; esMedico: boolean }) {
  const lista = useRef<HTMLDivElement | null>(null)
  function alTeclear(e: KeyboardEvent<HTMLDivElement>): void {
    const mover = MOVER[e.key]
    if (!mover) return
    e.preventDefault()
    const destino = PESTANAS[mover(PESTANAS.findIndex(p => p.clave === activa), PESTANAS.length)]
    if (!destino) return
    elegir(destino.clave)
    lista.current?.querySelector<HTMLElement>(`#config-tab-${destino.clave}`)?.focus()
  }
  return (
    <div ref={lista} role="tablist" aria-label="Secciones de la configuración" onKeyDown={alTeclear}
      className="-mb-[4px] flex gap-[4px] overflow-x-auto border-b border-[var(--ag-border-card)]">
      {PESTANAS.map(p => {
        const sel = p.clave === activa
        const nombre = nombreDe(p, esMedico)
        const Icono = p.icono
        return (
          <button key={p.clave} type="button" role="tab" id={`config-tab-${p.clave}`} aria-selected={sel} aria-controls={`config-panel-${p.clave}`}
            aria-label={nombre} tabIndex={sel ? 0 : -1} onClick={() => elegir(p.clave)}
            className={`flex min-h-[52px] min-w-[44px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap border-0 border-b-[3px] bg-transparent px-[8px] text-[16px] sm:flex-none sm:px-[16px] ${sel
              ? 'border-[var(--ag-brand-secondary)] font-bold text-[var(--ag-brand-legible)]' : 'border-transparent font-semibold text-[var(--ag-ink-600)]'}`}>
            <Icono size={22} aria-hidden="true" className="sm:hidden" />
            <span className="hidden sm:inline">{nombre}</span>
          </button>
        )
      })}
    </div>
  )
}

function Panel({ clave, activa, children }: { clave: Clave; activa: Clave; children: ReactNode }) {
  return (
    <section role="tabpanel" id={`config-panel-${clave}`} aria-labelledby={`config-tab-${clave}`} hidden={clave !== activa} tabIndex={0}
      className="rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ag-brand-secondary)]">
      {children}
    </section>
  )
}

export default function PestanasConfiguracion(d: DatosPestanas) {
  const [activa, setActiva] = useState<Clave>('enlace')
  const misConsultorios = (d.consultorios ?? []).filter(c => c.medico_id === d.usuarioId && c.activo !== false)
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-[24px] pb-[80px] pt-[8px]">
      <div className="flex flex-col gap-[6px]">
        <Link href="/agenda" className="inline-flex min-h-[44px] w-fit items-center gap-[6px] text-[15px] text-[var(--ag-ink-600)] no-underline">
          <ChevronLeft size={18} aria-hidden="true" /> Agenda
        </Link>
        <h1 className="m-0 text-[32px] font-bold leading-[1.2] text-[var(--ag-ink)]">Configuración de la agenda</h1>
        <p className="m-0 text-[17px] leading-[1.5] text-[var(--ag-ink-600)]">Esto es lo que elegiste al empezar. Cambia lo que quieras: se guarda solo.</p>
      </div>
      <div className="flex flex-col gap-[16px]">
        <Pestanas activa={activa} elegir={setActiva} esMedico={d.esMedico} />
        {/* El nombre de la elegida, sólo en el teléfono (allí las pestañas son iconos). Lo mismo que ya dice la pestaña: fuera del árbol accesible. */}
        <p aria-hidden="true" data-titulo-pestana className="m-0 text-[20px] font-bold leading-[1.3] text-[var(--ag-ink)] sm:hidden">
          {nombreDe(PESTANAS.find(p => p.clave === activa) ?? PESTANAS[0], d.esMedico)}
        </p>
      </div>
      <Panel clave="enlace" activa={activa}>
        <PestanaEnlace lista={d.lista} recargar={d.recargar} medicos={d.medicos} usuarioId={d.usuarioId} esMedico={d.esMedico}
          gestionaTodos={d.gestionaTodos} administradores={d.administradores} vigenciaDias={d.vigenciaDias} avisar={d.avisar} alCrearTipo={d.alCambiarDatos} />
      </Panel>
      <Panel clave="horario" activa={activa}>
        <PestanaHorario consultorios={d.consultorios?.filter(c => c.activo !== false) ?? null} fallo={d.falloConfig} horarioClinica={d.horarioClinica} husoClinica={d.husoClinica} medicos={d.medicos} usuarioId={d.usuarioId}
          esMedico={d.esMedico} puedeAdministrar={d.puedeAdministrar} actualizarConfig={d.actualizarConfig} avisar={d.avisar} alCambiar={d.alCambiarDatos} />
      </Panel>
      <Panel clave="consulta" activa={activa}>
        <PestanaConsulta tipos={d.tipos} usuarioId={d.usuarioId} esMedico={d.esMedico} puedeAdministrar={d.puedeAdministrar} medicos={d.medicos}
          misConsultorios={misConsultorios} avisar={d.avisar} alCambiar={d.alCambiarDatos} />
      </Panel>
      <Panel clave="avisos" activa={activa}>
        <div className={PANEL}>
          <div className="flex flex-col gap-[6px]">
            <h2 className={TITULO_PANEL}>Avisos por correo</h2>
            <p className={SUB_PANEL}>Prende o apaga cada uno. El cambio cuenta desde ahora.</p>
          </div>
          <BloquesAvisos estado={d.avisos} puedeEditar={d.puedeAdministrar} variante="config" />
        </div>
      </Panel>
      <Panel clave="mas" activa={activa}>
        <PestanaMasOpciones conEnlaces={d.esMedico || d.gestionaTodos} medicos={d.medicos} gestionaTodos={d.gestionaTodos}
          puedeAdministrar={d.puedeAdministrar} avisar={d.avisar} alEmpezarDeNuevo={d.alEmpezarDeNuevo} />
      </Panel>
      <AvisoGuardado aviso={d.aviso} />
    </div>
  )
}
