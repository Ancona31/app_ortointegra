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
 *
 * Tanda H (puntos 5 a 10 de Angel): las secciones son PESTAÑAS
 * (`MenuConfiguracion`, patrón de la APG) y sólo se ve la elegida; abre en
 * «Primeros pasos» mientras falte algo y, si no, en la primera. Los enlaces
 * internos `#config-…` cambian de pestaña (`usePestana`). Al final, sólo para
 * quien administra, «Restablecer» (`ZonaRestablecer`, punto 10).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type MouseEvent, type ReactNode } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { ChevronLeft } from 'lucide-react'
import { CLAVE_CONFIG, CONFIG_DEDUPE_MS, fetcherConfig, revalidarConfigAlMontar, type ConfigApp, type MedicoConfig } from '@/lib/configApp'
import type { AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'
import type { FuenteHorario } from '@/components/agenda/HorarioModal'
import MenuConfiguracion, { idPanel, idPestana, type ClavePestana, type Pestana } from '@/components/agenda/configuracion/MenuConfiguracion'
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
import ZonaRestablecer from '@/components/agenda/configuracion/ZonaRestablecer'
import { TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'

/** Reescribe la rebanada del agregado que acaba de guardarse, sin volver a pedirlo. */
export type ActualizarConfig = (cambio: (config: ConfigApp) => ConfigApp) => void

interface Props {
  /** `null` = la fila no cuadra: la sección lo dice y no deja guardar. */
  ajustes: AjustesAgenda | null
  /** Tanda H, punto 9: el interruptor del recordatorio automático; `null` = no se pudo leer. */
  recordatorio: boolean | null
  /** Tanda H, punto 6: los médicos administradores (sus enlaces se ven abiertos). */
  administradores: readonly string[]
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
function useGuiaEnlaces(o: { conEnlaces: boolean; esMedico: boolean; usuarioId: string; consultorios: readonly Consultorio[] | null }) {
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
  const pasos = o.esMedico && listaBuena ? pasosDe(listaBuena, o.usuarioId, o.consultorios) : null
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

const DISPOSITIVO_NOTA = 'Valen sólo en este navegador; no cambian nada para los demás.'

/**
 * Las pestañas, en el orden de la página; sin las secciones que quien mira no
 * tiene (tanda H, punto 5). «Restablecer» (punto 10), al final y sólo para
 * quien administra la clínica.
 */
function pestanasDe(o: { faltan: number | null; conEnlaces: boolean; puedeAdministrar: boolean }): Pestana[] {
  return [
    ...(o.faltan ? [{ clave: 'pasos' as const, texto: 'Primeros pasos', nota: `${o.faltan} ${o.faltan === 1 ? 'pendiente' : 'pendientes'}` }] : []),
    { clave: 'horario', texto: 'Horario y disponibilidad' },
    { clave: 'tipos', texto: 'Duración y tipos de cita' },
    ...(o.conEnlaces ? [{ clave: 'enlaces' as const, texto: 'Enlaces de reserva' }] : []),
    { clave: 'plazos', texto: 'Plazos y recordatorios' },
    ...(o.conEnlaces ? [{ clave: 'bloqueados' as const, texto: 'Contactos bloqueados' }] : []),
    { clave: 'dispositivo', texto: 'Este dispositivo' },
    ...(o.puedeAdministrar ? [{ clave: 'restablecer' as const, texto: 'Restablecer' }] : []),
  ]
}

/** Los `#id` que las secciones usan para mandarse a otra (`href="#config-…"`) → la pestaña que lo tiene. */
const PESTANA_DE_ANCLA: Record<string, ClavePestana> = {
  'config-pasos': 'pasos', 'config-disponibilidad': 'horario', 'config-tipos': 'tipos', 'config-enlaces': 'enlaces',
  'config-ajustes': 'plazos', 'config-bloqueados': 'bloqueados', 'config-dispositivo': 'dispositivo',
  'config-restablecer': 'restablecer',
}

/**
 * Qué pestaña se ve (punto 5): la que eligió quien mira; si no, «Primeros
 * pasos» mientras falte algo y, si no, la primera. `null` mientras no se
 * puede decidir (al médico aún no le llega la lista de enlaces): así no se
 * enseña otra sección y salta a «Primeros pasos» un instante después.
 */
function usePestana(pestanas: readonly Pestana[], porDefecto: ClavePestana | null) {
  const [elegida, setElegida] = useState<ClavePestana | null>(null)
  const activa = elegida && pestanas.some(p => p.clave === elegida) ? elegida : porDefecto
  /* Un enlace interno («Abrir horario», «Revisar», «Ir a la disponibilidad»)
     cambia de pestaña en vez de saltar a un ancla que está escondida. */
  const alPulsar = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const ancla = e.target instanceof Element ? e.target.closest('a[href^="#config-"]') : null
    const destino = ancla ? PESTANA_DE_ANCLA[ancla.getAttribute('href')?.slice(1) ?? ''] : undefined
    if (!destino) return
    e.preventDefault()
    setElegida(destino)
    requestAnimationFrame(() => document.getElementById(idPanel(destino))?.focus())
  }, [])
  return { activa, elegir: setElegida, volverAlInicio: () => setElegida(null), alPulsar }
}

/** Un panel de pestaña. Todos se montan (no pierden lo escrito al cambiar); sólo se ve el elegido. */
function Panel({ clave, activa, children }: { clave: ClavePestana; activa: ClavePestana | null; children: ReactNode }) {
  return (
    <div role="tabpanel" id={idPanel(clave)} aria-labelledby={idPestana(clave)} hidden={activa !== clave} tabIndex={0}
      className="flex min-w-0 flex-col gap-[var(--ag-6)] rounded-[var(--ag-r-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ag-brand-secondary)]">
      {children}
    </div>
  )
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
  /* Tras restablecer la configuración (punto 10): los consultorios cambiaron en la base. */
  const revalidar = useCallback(() => { void mutate() }, [mutate])
  return { config, fuente, actualizarConfig, revalidar }
}

/** Lo que reparte la pantalla a los paneles de enlaces, plazos y contactos. */
interface DatosReserva {
  lista: EstadoLista; recargar: () => Promise<void>; medicos: MedicoConfig[]; usuarioId: string; ajustes: AjustesAgenda | null
  recordatorio: boolean | null; administradores: readonly string[]; gestionaTodos: boolean; puedeAdministrar: boolean
  alCrearTipo: () => void; conPrimerosPasos: boolean
}

/** Los paneles de la reserva por enlace: enlaces de cada médico, plazos y recordatorio, contactos bloqueados. */
function PanelesReserva({ d, activa, conEnlaces }: { d: DatosReserva; activa: ClavePestana | null; conEnlaces: boolean }) {
  return (
    <>
      {conEnlaces && (
        <Panel clave="enlaces" activa={activa}>
          <SeccionEnlacesReserva lista={d.lista} recargar={d.recargar} medicos={d.medicos} usuarioId={d.usuarioId}
            gestionaTodos={d.gestionaTodos} vigenciaDias={d.ajustes?.vigencia_enlace_unico_dias ?? null} administradores={d.administradores}
            puedeCrearTipos={d.puedeAdministrar} alCrearTipo={d.alCrearTipo} conPrimerosPasos={d.conPrimerosPasos} />
        </Panel>
      )}
      <Panel clave="plazos" activa={activa}>
        {/* La clave es lo que llegó del servidor: tras restablecer, la sección vuelve a nacer con los valores de fábrica. */}
        <SeccionAjustesReserva key={`${JSON.stringify(d.ajustes)}|${String(d.recordatorio)}`} inicial={d.ajustes}
          recordatorio={d.recordatorio} puedeEditar={d.puedeAdministrar} />
      </Panel>
      {conEnlaces && (
        <Panel clave="bloqueados" activa={activa}>
          <SeccionContactosBloqueados medicos={d.medicos} gestionaTodos={d.gestionaTodos} />
        </Panel>
      )}
    </>
  )
}

/** Tras restablecer (punto 10): todo se relee y la pantalla vuelve a abrir donde toca («Primeros pasos»). */
function useAlRestablecer(o: { revalidar: () => void; recargar: () => Promise<void>; volverAlInicio: () => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { revalidar, recargar, volverAlInicio } = o
  return useCallback(() => {
    revalidar()
    startTransition(() => router.refresh())
    void recargar()
    volverAlInicio()
  }, [revalidar, recargar, volverAlInicio, router])
}

export default function ConfiguracionCalendario(props: Props) {
  const { ajustes, tipos, puedeAdministrar, usuarioId, gestionaReservasDeTodos, esMedico } = props
  const { config, fuente, actualizarConfig, revalidar } = useConfigAgregada()
  const conEnlaces = gestionaReservasDeTodos || esMedico
  const medicos = config?.medicos ?? []
  const consultorios = config?.consultorios ?? null
  const guia = useGuiaEnlaces({ conEnlaces, esMedico, usuarioId, consultorios })
  const { lista, recargar, alCrearTipo, pendientes } = guia
  const alCambiar = conEnlaces ? () => void recargar() : undefined
  const faltan = pendientes ? pendientes.filter(p => !p.hecho).length : null
  const pestanas = pestanasDe({ faltan, conEnlaces, puedeAdministrar })
  const porDefecto = faltan ? 'pasos' : esMedico && lista === null ? null : pestanas[0]?.clave ?? null
  const { activa, elegir, volverAlInicio, alPulsar } = usePestana(pestanas, porDefecto)
  const alRestablecer = useAlRestablecer({ revalidar, recargar, volverAlInicio })
  const reserva: DatosReserva = { lista, recargar, medicos, usuarioId, ajustes, recordatorio: props.recordatorio,
    administradores: props.administradores, gestionaTodos: gestionaReservasDeTodos, puedeAdministrar, alCrearTipo,
    conPrimerosPasos: pendientes !== null }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-[var(--ag-6)] pb-[var(--ag-8)]">
      <Encabezado puedeAdministrar={puedeAdministrar} />
      <div onClick={alPulsar} className="flex flex-col gap-[var(--ag-5)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-[var(--ag-6)]">
        <MenuConfiguracion pestanas={pestanas} activa={activa} elegir={elegir} />
        <div className="min-w-0">
          {activa === null && <p className={TEXTO_SUAVE}>Cargando…</p>}
          {pendientes && (
            <Panel clave="pasos" activa={activa}>
              <PasosConfiguracion pasos={pendientes} motivos={guia.motivos} medicoId={usuarioId} puedeEmitir={guia.puedeEmitir}
                resumen={resumenPasos(usuarioId, consultorios, tipos)} alCambiar={alCrearTipo} />
            </Panel>
          )}
          <Panel clave="horario" activa={activa}>
            <SeccionDisponibilidad consultorios={consultorios} fallo={fuente.estado === 'error'} horarioClinica={config?.horario ?? null}
              medicos={medicos} usuarioId={usuarioId} actualizarConfig={actualizarConfig} alCambiar={alCambiar}
              tipos={tipos} alCambiarTipos={esMedico ? alCrearTipo : undefined} />
          </Panel>
          <Panel clave="tipos" activa={activa}>
            <SeccionTiposCita tipos={tipos} puedeEditar={puedeAdministrar} medicos={medicos} alCambiar={alCambiar}
              usuarioId={usuarioId} esMedico={esMedico} consultorios={consultorios}
              preguntarDuracion={!pendientes?.some(p => p.clave === 'duracion' && !p.hecho)} />
          </Panel>
          <PanelesReserva d={reserva} activa={activa} conEnlaces={conEnlaces} />
          <Panel clave="dispositivo" activa={activa}>
            <TarjetaSeccion id="config-dispositivo" titulo="Tarjeta de la cita" ayuda={DISPOSITIVO_NOTA}>
              <PreferenciaTarjetaAlPasar />
            </TarjetaSeccion>
          </Panel>
          {puedeAdministrar && (
            <Panel clave="restablecer" activa={activa}>
              <ZonaRestablecer alRestablecer={alRestablecer} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
