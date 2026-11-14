'use client'

/**
 * src/components/agenda/configuracion/ConfiguracionCalendario.tsx
 *
 * La pantalla de configuración del calendario (plan del bloque B, paso B4):
 * horario de la clínica, ajustes de la reserva, disponibilidad por consultorio
 * y tipos de cita. La monta `(app)/agenda/configuracion/page.tsx` sólo con la
 * agenda v2 encendida.
 *
 * ⚠️ EL HORARIO, LOS CONSULTORIOS Y LOS MÉDICOS SALEN DEL AGREGADO DE
 * CONFIGURACIÓN (`CLAVE_CONFIG`), el mismo que lee la agenda, y no de una
 * lectura propia: al guardar aquí se escribe esa rebanada del caché, así que
 * al volver a `/agenda` la rejilla ya pinta el horario nuevo sin esperar a los
 * cinco minutos de `CONFIG_DEDUPE_MS`. Mismo patrón (`c ?? config`) que el
 * guardado del horario en `AgendaCliente`.
 *
 * Quién edita qué (P6 y P7): el administrador de la clínica, el horario, los
 * ajustes y los tipos; cada médico, la disponibilidad de SUS consultorios (la
 * RLS de `consultorios` sólo deja actualizar al dueño). Los demás lo ven en
 * solo lectura. Lo decide el servidor en cada ruta; aquí sólo se pinta.
 *
 * Tanda T2 (puntos 7 y 12): las secciones van en cuatro grupos —horario,
 * citas, reserva por enlace y este dispositivo— con la retícula `--ag-*`
 * (`TarjetaSeccion`), y arriba «Para empezar» mientras al médico le falte un
 * paso. La lista de enlaces se pide aquí una vez y la leen las dos.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { ChevronLeft } from 'lucide-react'
import { CLAVE_CONFIG, CONFIG_DEDUPE_MS, fetcherConfig, revalidarConfigAlMontar, type ConfigApp } from '@/lib/configApp'
import type { AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { FuenteHorario } from '@/components/agenda/HorarioModal'
import SeccionHorarioClinica from '@/components/agenda/configuracion/SeccionHorarioClinica'
import SeccionAjustesReserva from '@/components/agenda/configuracion/SeccionAjustesReserva'
import SeccionDisponibilidad from '@/components/agenda/configuracion/SeccionDisponibilidad'
import SeccionTiposCita from '@/components/agenda/configuracion/SeccionTiposCita'
import SeccionEnlacesReserva from '@/components/agenda/configuracion/SeccionEnlacesReserva'
import SeccionContactosBloqueados from '@/components/agenda/configuracion/SeccionContactosBloqueados'
import PasosConfiguracion, { pasosDe } from '@/components/agenda/configuracion/PasosConfiguracion'
import { cargarListaEnlaces, type EstadoLista } from '@/components/agenda/configuracion/listaEnlaces'
import PreferenciaTarjetaAlPasar from '@/components/agenda/configuracion/PreferenciaTarjetaAlPasar'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'

/** Reescribe la rebanada del agregado que acaba de guardarse, sin volver a pedirlo. */
export type ActualizarConfig = (cambio: (config: ConfigApp) => ConfigApp) => void

interface Props {
  /** `null` = la fila no cuadra: la sección lo dice y no deja guardar. */
  ajustes: AjustesAgenda | null
  /** `null` = no se pudieron leer. */
  tipos: TipoCita[] | null
  puedeAdministrar: boolean
  usuarioId: string
  /** Bloque D, lista A punto 16: administrador o secretaria gestionan los
   *  enlaces y los contactos de TODOS los médicos; un médico, los suyos. */
  gestionaReservasDeTodos: boolean
  /** Un médico (dueño o invitado) gestiona los suyos; la secretaria no tiene. */
  esMedico: boolean
}

/** Un grupo de secciones: su rótulo y, si hace falta, una línea que lo explica. */
function Grupo({ titulo, nota, children }: { titulo: string; nota?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--ag-3)]">
      <div className="flex flex-col gap-[var(--ag-1)] px-[var(--ag-1)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-muted)]">{titulo}</h2>
        {nota && <p className="text-sm text-[var(--ag-muted)]">{nota}</p>}
      </div>
      {children}
    </div>
  )
}

/** La lista de enlaces, pedida una vez para «Para empezar» y la sección de enlaces. */
function useListaEnlaces(activa: boolean): { lista: EstadoLista; recargar: () => Promise<void> } {
  const [lista, setLista] = useState<EstadoLista>(null)
  /* Una relectura en vuelo no escribe tras desmontar (p. ej. crear un enlace y volver a la agenda). */
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])
  const recargar = useCallback(async (): Promise<void> => {
    const l = await cargarListaEnlaces()
    if (montado.current) setLista(l)
  }, [])
  /* La primera carga con `.then`: el `setState` va en el callback, no en el cuerpo del efecto. */
  useEffect(() => {
    if (!activa) return
    let vivo = true
    void cargarListaEnlaces().then(l => { if (vivo) setLista(l) })
    return () => { vivo = false }
  }, [activa])
  return { lista, recargar }
}

/**
 * La guía de la pantalla (puntos 7 y 8): la lista de enlaces, «Para empezar»
 * del médico que mira y qué hacer tras crear el tipo por defecto.
 */
function useGuiaEnlaces(o: { conEnlaces: boolean; esMedico: boolean; usuarioId: string; puedeAdministrar: boolean }) {
  const { lista, recargar } = useListaEnlaces(o.conEnlaces)
  const router = useRouter()
  const [, startTransition] = useTransition()
  /* Tras crear el tipo por defecto desde un enlace: los tipos vienen del servidor
     (`router.refresh()`) y la preparación de los enlaces, de la lista. */
  const alCrearTipo = useCallback(() => {
    startTransition(() => router.refresh())
    void recargar()
  }, [router, recargar])
  const pasos = o.esMedico && lista && lista !== 'error' ? pasosDe(lista, o.usuarioId, o.puedeAdministrar) : null
  const pendientes = pasos?.some(p => !p.hecho) ? pasos : null
  return { lista, recargar, alCrearTipo, pendientes }
}

/** El encabezado: volver a la agenda, el título y para qué sirve la pantalla. */
function Encabezado({ puedeAdministrar }: { puedeAdministrar: boolean }) {
  return (
    <header className="flex flex-col gap-[var(--ag-1)]">
      <Link href="/agenda" className="inline-flex w-fit items-center gap-[var(--ag-1)] text-sm font-medium text-[var(--ag-muted)] hover:text-[var(--ag-text)]">
        <ChevronLeft size={16} aria-hidden="true" /> Agenda
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--ag-text)]">Configuración del calendario</h1>
      <p className="text-sm text-[var(--ag-muted)]">
        {puedeAdministrar
          ? 'Horario, tipos de cita y reserva por enlace de la clínica.'
          : 'El horario de la clínica, los ajustes y los tipos de cita los cambia quien administra la clínica; aquí los ves en solo lectura.'}
      </p>
    </header>
  )
}

/** El agregado de configuración (horario, consultorios, médicos) y cómo reescribir su rebanada. */
function useConfigAgregada() {
  const swr = useSWRConfig()
  const { data: config, error, mutate } = useSWR<ConfigApp>(
    CLAVE_CONFIG,
    fetcherConfig,
    { dedupingInterval: CONFIG_DEDUPE_MS, revalidateOnMount: revalidarConfigAlMontar(swr) },
  )
  const actualizarConfig = useCallback<ActualizarConfig>((cambio) => {
    void mutate((c) => {
      const base = c ?? config
      return base ? cambio(base) : base
    }, { revalidate: false })
  }, [mutate, config])
  /* Las mismas tres ramas que `fuenteHorario` de `AgendaCliente`, en el mismo
     orden: un dato bueno manda aunque haya un error encima. */
  const fuente = useMemo<FuenteHorario>(() => {
    if (config) return { estado: 'listo', horario: config.horario }
    if (error) return { estado: 'error' }
    return { estado: 'cargando' }
  }, [config, error])
  return { config, fuente, actualizarConfig }
}

export default function ConfiguracionCalendario({ ajustes, tipos, puedeAdministrar, usuarioId, gestionaReservasDeTodos, esMedico }: Props) {
  const { config, fuente, actualizarConfig } = useConfigAgregada()
  const conEnlaces = gestionaReservasDeTodos || esMedico
  const { lista, recargar, alCrearTipo, pendientes } = useGuiaEnlaces({ conEnlaces, esMedico, usuarioId, puedeAdministrar })
  const alCambiar = conEnlaces ? () => void recargar() : undefined
  const medicos = config?.medicos ?? []

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[var(--ag-6)] pb-[var(--ag-8)]">
      <Encabezado puedeAdministrar={puedeAdministrar} />
      {pendientes && <PasosConfiguracion pasos={pendientes} />}
      <Grupo titulo="Horario y disponibilidad"
        nota="El horario de la clínica es la plantilla; un consultorio con horario propio manda en su agenda y en su enlace de reserva.">
        <SeccionHorarioClinica fuente={fuente} puedeEditar={puedeAdministrar} actualizarConfig={actualizarConfig} />
        <SeccionDisponibilidad
          consultorios={config?.consultorios ?? null}
          fallo={fuente.estado === 'error'}
          horarioClinica={config?.horario ?? null}
          medicos={medicos}
          usuarioId={usuarioId}
          actualizarConfig={actualizarConfig}
          alCambiar={alCambiar}
        />
      </Grupo>
      <Grupo titulo="Citas">
        <SeccionTiposCita tipos={tipos} puedeEditar={puedeAdministrar} medicos={medicos} alCambiar={alCambiar} />
      </Grupo>
      <Grupo titulo="Reserva por enlace">
        {conEnlaces && (
          <SeccionEnlacesReserva lista={lista} recargar={recargar} medicos={medicos} usuarioId={usuarioId}
            gestionaTodos={gestionaReservasDeTodos} vigenciaDias={ajustes?.vigencia_enlace_unico_dias ?? null}
            puedeCrearTipos={puedeAdministrar} alCrearTipo={alCrearTipo} />
        )}
        <SeccionAjustesReserva inicial={ajustes} puedeEditar={puedeAdministrar} />
        {conEnlaces && <SeccionContactosBloqueados medicos={medicos} gestionaTodos={gestionaReservasDeTodos} />}
      </Grupo>
      <Grupo titulo="Preferencias de este dispositivo" nota="Valen sólo en este navegador; no cambian nada para los demás.">
        {/* Integración T2+T3: en su tarjeta, para que el grupo siga la retícula de las demás. */}
        <TarjetaSeccion id="config-dispositivo" titulo="Tarjeta de la cita">
          <PreferenciaTarjetaAlPasar />
        </TarjetaSeccion>
      </Grupo>
    </div>
  )
}
