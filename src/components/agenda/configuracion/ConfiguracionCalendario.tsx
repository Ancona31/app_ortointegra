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
 */
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
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

export default function ConfiguracionCalendario({ ajustes, tipos, puedeAdministrar, usuarioId, gestionaReservasDeTodos, esMedico }: Props) {
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="space-y-1">
        <Link href="/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ag-muted)] hover:text-[var(--ag-text)]">
          <ChevronLeft size={16} aria-hidden="true" /> Agenda
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--ag-text)]">Configuración del calendario</h1>
        {!puedeAdministrar && (
          <p className="text-sm text-[var(--ag-muted)]">
            El horario de la clínica, los ajustes y los tipos de cita los cambia quien administra la clínica; aquí los ves en solo lectura.
          </p>
        )}
      </header>
      <SeccionHorarioClinica fuente={fuente} puedeEditar={puedeAdministrar} actualizarConfig={actualizarConfig} />
      <SeccionAjustesReserva inicial={ajustes} puedeEditar={puedeAdministrar} />
      <SeccionDisponibilidad
        consultorios={config?.consultorios ?? null}
        fallo={fuente.estado === 'error'}
        horarioClinica={config?.horario ?? null}
        medicos={config?.medicos ?? []}
        usuarioId={usuarioId}
        actualizarConfig={actualizarConfig}
      />
      <SeccionTiposCita tipos={tipos} puedeEditar={puedeAdministrar} medicos={config?.medicos ?? []} />
      {(gestionaReservasDeTodos || esMedico) && (
        <>
          <SeccionEnlacesReserva medicos={config?.medicos ?? []} usuarioId={usuarioId}
            gestionaTodos={gestionaReservasDeTodos} vigenciaDias={ajustes?.vigencia_enlace_unico_dias ?? null} />
          <SeccionContactosBloqueados medicos={config?.medicos ?? []} gestionaTodos={gestionaReservasDeTodos} />
        </>
      )}
    </div>
  )
}
