'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { secureStorage } from '@/lib/secureStorage'
import { Consultorio } from '@/types'
import {
  CACHE_CONSULTORIOS,
  CLAVE_CONFIG,
  CONFIG_DEDUPE_MS,
  esErrorDeSesion,
  fetcherConfig,
  type ConfigApp,
} from '@/lib/configApp'

const CACHE_KEY = CACHE_CONSULTORIOS

/** Lo que veía y devolvía el actualizador de `mutate` cuando la clave de este
 *  hook era `/api/consultorios`. Se conserva tal cual. */
type DatosConsultorios = { consultorios: Consultorio[] }
type ActualizadorConsultorios = (actual: DatosConsultorios | undefined) => DatosConsultorios

/**
 * Hook que devuelve la lista de consultorios activos del usuario autenticado.
 *
 * La clave ya no es `/api/consultorios` sino el agregado de configuración
 * (ver src/lib/configApp.ts): la misma petición trae clínica, consultorios,
 * horario y médicos, así que abrir cualquier página de (app) deja de disparar
 * cuatro llamadas paralelas. Lo que el hook devuelve NO cambia, `mutate`
 * incluido: sigue recibiendo y devolviendo `{ consultorios }`, aunque por
 * dentro escriba su rebanada del agregado.
 *
 * El endpoint solo devuelve consultorios activos (filtrado por backend);
 * los archivados no se exponen al usuario por diseño (R1).
 *
 * El consultorio default está garantizado a existir cuando consultorios.length >= 1
 * (triggers BD enforce_consultorio_default_insert + enforce_consultorio_default_existencia).
 * Para médicos recién registrados con 0 consultorios, consultorioDefault será null y el
 * modal de onboarding (Bloque F3-4) los bloqueará hasta crear el primero.
 */
export function useConsultorios() {
  const { data, error, isLoading, mutate: mutarConfig } = useSWR<ConfigApp>(
    CLAVE_CONFIG,
    fetcherConfig,
    {
      // revalidateOnFocus se hereda del <SWRConfig> de (app), ya con throttle.
      dedupingInterval: CONFIG_DEDUPE_MS,
    },
  )

  // Fallback offline. NO se activa ante 401/403: ver `esErrorDeSesion` en
  // src/lib/configApp.ts — el cache cifrado respalda una red caída, nunca una
  // sesión cerrada.
  const { data: fallback } = useSWR<Consultorio[]>(
    !data && error && !esErrorDeSesion(error) ? `${CACHE_KEY}_fallback` : null,
    async () => {
      const cached = await secureStorage.get<Consultorio[]>(CACHE_KEY)
      if (!cached) throw new Error('Sin cache offline')
      return cached
    },
    { revalidateOnFocus: false },
  )

  const consultorios = data?.consultorios ?? fallback ?? []

  const consultorioDefault = consultorios.find(c => c.es_default) ?? null

  /** Traduce entre el contrato de fuera (`{ consultorios }`) y el agregado. */
  const mutate = useCallback(
    async (actualizador?: ActualizadorConsultorios, opciones?: { revalidate?: boolean }) => {
      if (!actualizador) {
        await mutarConfig()
        return
      }
      await mutarConfig(
        (config) => config
          ? { ...config, ...actualizador({ consultorios: config.consultorios }) }
          : config,
        opciones,
      )
    },
    [mutarConfig],
  )

  return {
    consultorios,
    consultorioDefault,
    isLoading,
    mutate,
    isOfflineData: !data?.consultorios && !!fallback,
  }
}
