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
 * B13 · AG9 (rediseño, maqueta `ag-config`; sustituye a los iconos del teléfono de K3, punto 13): las pestañas
 * son SIEMPRE texto, las del kit (`.k-tabs`/`.k-tab`: 14, 600 la elegida, subrayado de `--accion`); en el
 * teléfono van en una pista que se desliza con el borde fundido (`.agc-tabs`, `globals.css`) y la elegida se
 * trae a la vista. El nombre accesible sigue siendo el texto (`aria-label`). La página es una columna de 680
 * centrada en computadora (600 en el Duo abierto en vertical), sobre el fondo, sin tarjeta que la envuelva.
 */
import Link from 'next/link'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import AvisoGuardado, { type EstadoAviso } from '@/components/agenda/configuracion/AvisoGuardado'
import BloquesAvisos from '@/components/agenda/configuracion/BloquesAvisos'
import PestanaConsulta from '@/components/agenda/configuracion/PestanaConsulta'
import PestanaEnlace from '@/components/agenda/configuracion/PestanaEnlace'
import PestanaHorario from '@/components/agenda/configuracion/PestanaHorario'
import PestanaMasOpciones from '@/components/agenda/configuracion/PestanaMasOpciones'
import type { Avisar, EstadoAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import type { EstadoLista } from '@/components/agenda/configuracion/listaEnlaces'
import { PANEL, SUB_PANEL, SUB_PASO, TITULO_PANEL, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
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

const PESTANAS: readonly { clave: Clave; texto: string; textoSinMedico?: string }[] = [
  { clave: 'enlace', texto: 'Tu enlace', textoSinMedico: 'Enlaces' },
  { clave: 'horario', texto: 'Cuándo das consulta', textoSinMedico: 'Cuándo dan consulta' },
  { clave: 'consulta', texto: 'Tu consulta', textoSinMedico: 'Tipos de cita' },
  { clave: 'avisos', texto: 'Avisos' },
  { clave: 'mas', texto: 'Más opciones' },
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
    <div ref={lista} role="tablist" aria-label="Secciones de la configuración" onKeyDown={alTeclear} className="k-tabs agc-tabs">
      {PESTANAS.map(p => {
        const sel = p.clave === activa
        const nombre = nombreDe(p, esMedico)
        return (
          <button key={p.clave} type="button" role="tab" id={`config-tab-${p.clave}`} aria-selected={sel} aria-controls={`config-panel-${p.clave}`}
            aria-label={nombre} tabIndex={sel ? 0 : -1} data-t={nombre} className="k-tab"
            onClick={e => { const b = e.currentTarget; elegir(p.clave); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }}>
            {nombre}
          </button>
        )
      })}
    </div>
  )
}

function Panel({ clave, activa, children }: { clave: Clave; activa: Clave; children: ReactNode }) {
  return (
    <section role="tabpanel" id={`config-panel-${clave}`} aria-labelledby={`config-tab-${clave}`} hidden={clave !== activa} tabIndex={0}
      className="rounded-[16px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-enlace">
      {children}
    </section>
  )
}

export default function PestanasConfiguracion(d: DatosPestanas) {
  const [activa, setActiva] = useState<Clave>('enlace')
  const misConsultorios = (d.consultorios ?? []).filter(c => c.medico_id === d.usuarioId && c.activo !== false)
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-[20px] pb-[56px] pt-[4px] ih:max-w-[601px] ih:gap-[24px] iv:max-w-[600px] iv:gap-[24px] esc:gap-[24px]">
      <div className="flex flex-col gap-[4px]">
        <Link href="/agenda" className="relative inline-flex h-[44px] w-fit items-center gap-[2px] -ml-[4px] pr-[4px] text-[13px] font-semibold leading-[18px] text-enlace no-underline ih:h-[36px] esc:h-[36px]">
          <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" /> Agenda
        </Link>
        <h1 className={TITULO_PASO}>Configuración de la agenda</h1>
        <p className={SUB_PASO}>Esto es lo que elegiste al empezar. Cambia lo que quieras: se guarda solo.</p>
      </div>
      <Pestanas activa={activa} elegir={setActiva} esMedico={d.esMedico} />
      <Panel clave="enlace" activa={activa}>
        <PestanaEnlace lista={d.lista} recargar={d.recargar} medicos={d.medicos} usuarioId={d.usuarioId} esMedico={d.esMedico}
          gestionaTodos={d.gestionaTodos} administradores={d.administradores} puedeAdministrar={d.puedeAdministrar} vigenciaDias={d.vigenciaDias}
          avisar={d.avisar} alCrearTipo={d.alCambiarDatos} />
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
