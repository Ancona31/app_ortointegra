'use client'

/**
 * La configuración de la agenda de la tanda J (J5, puntos 13 a 17 de Angel):
 * el funnel de primera vez (`PrimeraVez`, maqueta `Main.dc.html`) o las cinco
 * pestañas (`PestanasConfiguracion`, maqueta `Configuracion.dc.html`). La
 * monta `(app)/agenda/configuracion/page.tsx`, que sólo existe con la agenda
 * v2 encendida (apagada: 404 y el engrane abre el `HorarioModal` de siempre).
 * Sustituye a `ConfiguracionCalendario`, que se queda en disco sin montar.
 *
 * Qué se ve lo decide `vistaInicial` UNA vez, cuando llegan los datos, y no
 * cambia al guardar (si no, el funnel saltaría a las pestañas en cuanto el
 * último paso quedase hecho, antes del cierre).
 *
 * ⚠️ EL HORARIO, LOS CONSULTORIOS Y LOS MÉDICOS SALEN DEL AGREGADO DE
 * CONFIGURACIÓN (`CLAVE_CONFIG`), el mismo que lee la agenda, y al guardar se
 * reescribe esa rebanada: al volver a `/agenda` la rejilla ya pinta lo nuevo.
 * Copia de `useConfigAgregada` y `useListaEnlaces` de `ConfiguracionCalendario`
 * (la pantalla vieja no se toca).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import AvisoGuardado, { useAvisoGuardado } from '@/components/agenda/configuracion/AvisoGuardado'
import PestanasConfiguracion from '@/components/agenda/configuracion/PestanasConfiguracion'
import PrimeraVez from '@/components/agenda/configuracion/PrimeraVez'
import { pasosDe } from '@/components/agenda/configuracion/PasosConfiguracion'
import { cargarListaEnlaces, type EstadoLista } from '@/components/agenda/configuracion/listaEnlaces'
import { useAvisos } from '@/components/agenda/configuracion/estadoAvisos'
import { esPrimeraVez, olvidarPaso, pasoGuardado, vistaInicial, type PasoPrimeraVez } from '@/lib/agenda/primeraVez'
import { horarioEfectivo } from '@/lib/agenda/disponibilidad'
import { CLAVE_CONFIG, CONFIG_DEDUPE_MS, fetcherConfig, revalidarConfigAlMontar, type ConfigApp } from '@/lib/configApp'
import { FABRICA_AJUSTES_AGENDA, type AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import type { TipoCita } from '@/lib/agenda/tiposCita'

interface Props {
  ajustes: AjustesAgenda | null
  recordatorio: boolean | null
  correoClinica: boolean | null
  administradores: readonly string[]
  tipos: TipoCita[] | null
  puedeAdministrar: boolean
  usuarioId: string
  gestionaReservasDeTodos: boolean
  esMedico: boolean
}

function useConfigAgregada() {
  const swr = useSWRConfig()
  const { data: config, error, mutate } = useSWR<ConfigApp>(CLAVE_CONFIG, fetcherConfig,
    { dedupingInterval: CONFIG_DEDUPE_MS, revalidateOnMount: revalidarConfigAlMontar(swr) })
  const actualizarConfig = useCallback((cambio: (c: ConfigApp) => ConfigApp) => {
    void mutate(c => { const base = c ?? config; return base ? cambio(base) : base }, { revalidate: false })
  }, [mutate, config])
  return { config, fallo: !config && Boolean(error), actualizarConfig }
}

function useListaEnlaces(activa: boolean): { lista: EstadoLista; recargar: () => Promise<void> } {
  const [lista, setLista] = useState<EstadoLista>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])
  const recargar = useCallback(async (): Promise<void> => {
    const l = await cargarListaEnlaces()
    if (montado.current) setLista(l)
  }, [])
  useEffect(() => {
    if (!activa) return
    let vivo = true
    void cargarListaEnlaces().then(l => { if (vivo) setLista(l) })
    return () => { vivo = false }
  }, [activa])
  return { lista, recargar }
}

type Vista = 'cargando' | 'pestanas' | { paso: PasoPrimeraVez }

/** Qué se ve, decidido una vez con los datos (patrón «estado derivado» de React: setState durante el render). */
function useVista(o: { esMedico: boolean; usuarioId: string; config: ConfigApp | undefined; fallo: boolean; lista: EstadoLista }): Vista {
  const [fijada, setFijada] = useState<Vista>('cargando')
  if (fijada !== 'cargando') return fijada
  const suyos = o.config?.consultorios.filter(c => c.medico_id === o.usuarioId && c.activo !== false) ?? null
  const lista = o.lista && o.lista !== 'error' ? o.lista : null
  const pasos = o.lista === null ? undefined : lista ? pasosDe(lista, o.usuarioId, suyos) : null
  /* Sin el secreto de la reserva no se puede crear el enlace: ese paso no cuenta (si no, el funnel no acabaría nunca). */
  const cuentan = pasos && lista && !lista.secreto ? pasos.filter(x => x.clave !== 'enlace') : pasos
  const v = o.esMedico && !suyos && !o.fallo ? 'cargando'
    : vistaInicial({ esMedico: o.esMedico, conConsultorio: (suyos?.length ?? 0) > 0, pasos: cuentan, guardado: o.esMedico ? pasoGuardado(o.usuarioId) : null,
      primeraVez: cuentan ? esPrimeraVez(cuentan, suyos ?? []) : false })
  if (v !== 'cargando') setFijada(v)
  return v
}

export default function ConfiguracionAgenda(props: Props) {
  const { config, fallo, actualizarConfig } = useConfigAgregada()
  const conEnlaces = props.gestionaReservasDeTodos || props.esMedico
  const { lista, recargar } = useListaEnlaces(conEnlaces)
  const { aviso, avisar } = useAvisoGuardado()
  const avisos = useAvisos({ ajustes: props.ajustes, recordatorio: props.recordatorio, correoClinica: props.correoClinica }, avisar)
  const vista = useVista({ esMedico: props.esMedico, usuarioId: props.usuarioId, config, fallo, lista })
  const router = useRouter()
  const [, startTransition] = useTransition()
  const alCambiarDatos = useCallback(() => { startTransition(() => router.refresh()); void recargar() }, [router, recargar])
  /* «Empezar de nuevo»: se relee TODO desde cero, con la pantalla entera; el funnel sale porque todo queda pendiente. */
  const alEmpezarDeNuevo = useCallback(() => { olvidarPaso(props.usuarioId); window.location.assign('/agenda/configuracion') }, [props.usuarioId])
  const vigencia = avisos.guardados?.vigencia_enlace_unico_dias ?? props.ajustes?.vigencia_enlace_unico_dias ?? null

  if (vista === 'cargando') return <p className="mx-auto max-w-[760px] pt-[24px] text-[15px] text-[var(--ag-ink-600)]">Cargando…</p>
  if (vista !== 'pestanas' && config) {
    const suyos = config.consultorios.filter(c => c.medico_id === props.usuarioId && c.activo !== false)
    const listaBuena = lista && lista !== 'error' ? lista : null
    return (
      <>
        <PrimeraVez usuarioId={props.usuarioId} consultorios={suyos} horarioClinica={horarioEfectivo(null, config.horario)} tipos={props.tipos}
          motivos={listaBuena?.preparacion?.[props.usuarioId] ?? []} avisos={avisos} puedeAdministrar={props.puedeAdministrar}
          vigenciaDias={vigencia ?? FABRICA_AJUSTES_AGENDA.vigencia_enlace_unico_dias} pasoInicial={vista.paso}
          actualizarConfig={actualizarConfig} alCambiarDatos={alCambiarDatos} />
        <AvisoGuardado aviso={aviso?.tipo === 'error' ? aviso : null} />
      </>
    )
  }
  return (
    <PestanasConfiguracion lista={lista} recargar={recargar} medicos={config?.medicos ?? []} consultorios={config?.consultorios ?? null}
      falloConfig={fallo} horarioClinica={config ? horarioEfectivo(null, config.horario) : null} tipos={props.tipos} usuarioId={props.usuarioId} esMedico={props.esMedico}
      gestionaTodos={props.gestionaReservasDeTodos} puedeAdministrar={props.puedeAdministrar} administradores={props.administradores}
      vigenciaDias={vigencia} avisos={avisos} aviso={aviso} avisar={avisar} actualizarConfig={actualizarConfig}
      alCambiarDatos={alCambiarDatos} alEmpezarDeNuevo={alEmpezarDeNuevo} />
  )
}
