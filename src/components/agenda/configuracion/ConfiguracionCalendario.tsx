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
 *
 * G2 (puntos 5, 7, 8, 10 y 20 de Angel; la maqueta): «Primeros pasos» con su
 * avance (horario de cada consultorio → duración de la consulta → enlace), un
 * menú de secciones (columna en escritorio, apilado arriba en el teléfono), y
 * SIN la sección «Horario de la clínica» ni su «Editar horario»: cada
 * consultorio tiene el suyo (la herencia única del de la clínica es de G4).
 * El enlace de reserva de cada médico se queda aquí (punto 20), no en el
 * perfil. Con la v2 apagada esta pantalla no existe (B4), así que la agenda
 * apagada sigue abriendo el `HorarioModal` de siempre desde su engrane.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { ChevronLeft } from 'lucide-react'
import { CLAVE_CONFIG, CONFIG_DEDUPE_MS, fetcherConfig, revalidarConfigAlMontar, type ConfigApp, type MedicoConfig } from '@/lib/configApp'
import type { AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { FuenteHorario } from '@/components/agenda/HorarioModal'
import MenuConfiguracion, { type EntradaMenu } from '@/components/agenda/configuracion/MenuConfiguracion'
import type { Consultorio } from '@/types'
import SeccionAjustesReserva from '@/components/agenda/configuracion/SeccionAjustesReserva'
import SeccionDisponibilidad from '@/components/agenda/configuracion/SeccionDisponibilidad'
import SeccionTiposCita from '@/components/agenda/configuracion/SeccionTiposCita'
import SeccionEnlacesReserva from '@/components/agenda/configuracion/SeccionEnlacesReserva'
import SeccionContactosBloqueados from '@/components/agenda/configuracion/SeccionContactosBloqueados'
import PasosConfiguracion, { pasosDe, type ClavePaso } from '@/components/agenda/configuracion/PasosConfiguracion'
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
 * La guía de la pantalla (puntos 7 y 8): la lista de enlaces, «Primeros pasos»
 * del médico que mira y qué hacer tras guardar una duración.
 */
function useGuiaEnlaces(o: { conEnlaces: boolean; esMedico: boolean; usuarioId: string }) {
  const { lista, recargar } = useListaEnlaces(o.conEnlaces)
  const router = useRouter()
  const [, startTransition] = useTransition()
  /* Tras guardar una duración o un tipo: los tipos vienen del servidor
     (`router.refresh()`) y la preparación de los enlaces, de la lista. */
  const alCrearTipo = useCallback(() => {
    startTransition(() => router.refresh())
    void recargar()
  }, [router, recargar])
  const listaBuena = lista && lista !== 'error' ? lista : null
  const pasos = o.esMedico && listaBuena ? pasosDe(listaBuena, o.usuarioId) : null
  const pendientes = pasos?.some(p => !p.hecho) ? pasos : null
  const motivos = listaBuena?.preparacion?.[o.usuarioId] ?? []
  return { lista, recargar, alCrearTipo, pendientes, motivos, puedeEmitir: listaBuena?.secreto ?? false }
}

/** La línea de cada paso hecho: tus consultorios, tu duración (o tus tipos), tu enlace. */
function resumenPasos(usuarioId: string, consultorios: readonly Consultorio[] | null, tipos: readonly TipoCita[] | null): Partial<Record<ClavePaso, string>> {
  const nombres = (consultorios ?? []).filter(c => c.medico_id === usuarioId && c.activo !== false).map(c => c.nombre)
  const aplican = (tipos ?? []).filter(t => t.activo && !t.consultorio_id && (t.medico_id === null || t.medico_id === usuarioId))
  const mia = aplican.find(t => t.principal && t.medico_id === usuarioId)
  return {
    horario: nombres.length ? nombres.join(' y ') : undefined,
    duracion: mia ? `${mia.duracion_min} min` : aplican.map(t => `${t.nombre} · ${t.duracion_min} min`).join(', ') || undefined,
    enlace: 'Creado',
  }
}

/** Las entradas del menú, en el orden de la página; sin las secciones que quien mira no tiene. */
function entradasMenu(pendientes: number | null, conEnlaces: boolean): EntradaMenu[] {
  return [
    ...(pendientes ? [{ destino: 'config-pasos', texto: 'Primeros pasos', nota: `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}` }] : []),
    { destino: 'config-disponibilidad', texto: 'Horario y disponibilidad' },
    { destino: 'config-tipos', texto: 'Duración y tipos de cita' },
    ...(conEnlaces ? [{ destino: 'config-enlaces', texto: 'Enlaces de reserva' }] : []),
    { destino: 'config-ajustes', texto: 'Plazos y recordatorios' },
    ...(conEnlaces ? [{ destino: 'config-bloqueados', texto: 'Contactos bloqueados' }] : []),
    { destino: 'config-dispositivo', texto: 'Este dispositivo' },
  ]
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
          ? 'Horario de cada consultorio, duración de la consulta y reserva por enlace.'
          : 'Los ajustes de la clínica y los cambios a los tipos de cita los hace quien administra la clínica; aquí los ves en solo lectura.'}
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

/** «Preferencias de este dispositivo». Integración T2+T3: en su tarjeta, para que el grupo siga la retícula de las demás. */
function GrupoDispositivo() {
  return (
    <Grupo titulo="Preferencias de este dispositivo" nota="Valen sólo en este navegador; no cambian nada para los demás.">
      <TarjetaSeccion id="config-dispositivo" titulo="Tarjeta de la cita">
        <PreferenciaTarjetaAlPasar />
      </TarjetaSeccion>
    </Grupo>
  )
}

/** «Reserva por enlace»: los enlaces de cada médico, los plazos y los contactos bloqueados. */
function GrupoReserva(p: {
  lista: EstadoLista; recargar: () => Promise<void>; medicos: MedicoConfig[]; usuarioId: string; ajustes: AjustesAgenda | null
  gestionaTodos: boolean; esMedico: boolean; puedeAdministrar: boolean; alCrearTipo: () => void; conPrimerosPasos: boolean
}) {
  const conEnlaces = p.gestionaTodos || p.esMedico
  return (
    <Grupo titulo="Reserva por enlace">
      {conEnlaces && (
        <SeccionEnlacesReserva lista={p.lista} recargar={p.recargar} medicos={p.medicos} usuarioId={p.usuarioId}
          gestionaTodos={p.gestionaTodos} vigenciaDias={p.ajustes?.vigencia_enlace_unico_dias ?? null}
          puedeCrearTipos={p.puedeAdministrar} alCrearTipo={p.alCrearTipo} conPrimerosPasos={p.conPrimerosPasos} />
      )}
      <SeccionAjustesReserva inicial={p.ajustes} puedeEditar={p.puedeAdministrar} />
      {conEnlaces && <SeccionContactosBloqueados medicos={p.medicos} gestionaTodos={p.gestionaTodos} />}
    </Grupo>
  )
}

export default function ConfiguracionCalendario({ ajustes, tipos, puedeAdministrar, usuarioId, gestionaReservasDeTodos, esMedico }: Props) {
  const { config, fuente, actualizarConfig } = useConfigAgregada()
  const conEnlaces = gestionaReservasDeTodos || esMedico
  const guia = useGuiaEnlaces({ conEnlaces, esMedico, usuarioId })
  const { lista, recargar, alCrearTipo, pendientes } = guia
  const alCambiar = conEnlaces ? () => void recargar() : undefined
  const medicos = config?.medicos ?? []
  const consultorios = config?.consultorios ?? null
  const faltan = pendientes ? pendientes.filter(p => !p.hecho).length : null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-[var(--ag-6)] pb-[var(--ag-8)]">
      <Encabezado puedeAdministrar={puedeAdministrar} />
      <div className="flex flex-col gap-[var(--ag-6)] lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start">
        <MenuConfiguracion entradas={entradasMenu(faltan, conEnlaces)} />
        <div className="flex min-w-0 flex-col gap-[var(--ag-6)]">
          {pendientes && (
            <PasosConfiguracion pasos={pendientes} motivos={guia.motivos} medicoId={usuarioId} puedeEmitir={guia.puedeEmitir}
              resumen={resumenPasos(usuarioId, consultorios, tipos)} alCambiar={alCrearTipo} />
          )}
          <Grupo titulo="Horario y disponibilidad">
            <SeccionDisponibilidad
              consultorios={consultorios}
              fallo={fuente.estado === 'error'}
              horarioClinica={config?.horario ?? null}
              medicos={medicos}
              usuarioId={usuarioId}
              actualizarConfig={actualizarConfig}
              alCambiar={alCambiar}
              tipos={tipos}
              alCambiarTipos={esMedico ? alCrearTipo : undefined}
            />
          </Grupo>
          <Grupo titulo="Citas">
            <SeccionTiposCita tipos={tipos} puedeEditar={puedeAdministrar} medicos={medicos} alCambiar={alCambiar}
              usuarioId={usuarioId} esMedico={esMedico} consultorios={consultorios}
              preguntarDuracion={!pendientes?.some(p => p.clave === 'duracion' && !p.hecho)} />
          </Grupo>
          <GrupoReserva lista={lista} recargar={recargar} medicos={medicos} usuarioId={usuarioId} ajustes={ajustes}
            gestionaTodos={gestionaReservasDeTodos} esMedico={esMedico} puedeAdministrar={puedeAdministrar}
            alCrearTipo={alCrearTipo} conPrimerosPasos={pendientes !== null} />
          <GrupoDispositivo />
        </div>
      </div>
    </div>
  )
}
