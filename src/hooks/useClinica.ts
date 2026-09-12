'use client'

import useSWR from 'swr'
import { secureStorage } from '@/lib/secureStorage'
import {
  CACHE_CLINICA,
  CLAVE_CONFIG,
  CONFIG_DEDUPE_MS,
  esErrorDeSesion,
  fetcherConfig,
  type ClinicaConfig,
  type ConfigApp,
  type ErrorConfig,
} from '@/lib/configApp'

/** Re-exportado desde su nuevo sitio: el tipo se movió, el import no cambia. */
export type { ClinicaConfig }

const CACHE_KEY = CACHE_CLINICA

export function useClinica() {
  // La clave ya no es `/api/me/clinica` sino el agregado de configuración,
  // que trae la clínica junto con consultorios, horario y médicos en una
  // sola petición. Lo que este hook devuelve no cambia (ver src/lib/configApp.ts).
  const { data, error } = useSWR<ConfigApp>(
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
  const { data: fallback } = useSWR<ClinicaConfig>(
    !data && error && !esErrorDeSesion(error) ? `${CACHE_KEY}_fallback` : null,
    async () => {
      const cached = await secureStorage.get<ClinicaConfig>(CACHE_KEY)
      if (!cached) throw new Error('Sin cache offline')
      return cached
    },
    { revalidateOnFocus: false },
  )

  const clinica = data?.clinica ?? fallback ?? null

  return {
    clinica,
    colorPrimario:   clinica?.color_primario   ?? '#1a3a5c',
    colorSecundario: clinica?.color_secundario ?? '#1e5fa8',
    nombreDisplay:   clinica?.nombre_display   ?? null,
    subtitulo:       clinica?.subtitulo        ?? null,
    logoUrl:         clinica?.logo_url         ?? null,
    isOfflineData:   !data?.clinica && !!fallback,
    /* ⚠️ AÑADIDO PARA DESATASCAR EL «TODAVÍA NO SÉ», QUE ES LO QUE
       `clinica: null` NO PUEDE DECIR: vale null mientras carga Y cuando falló.
       A quien solo pinta la marca le da igual —cae a los colores por defecto de
       arriba y ya—, pero quien tome una DECISIÓN con estos datos necesita saber
       cuándo dejar de esperar: sin esto, esperar a que resuelva es esperar para
       siempre si el agregado devolvió 500. Es el mismo defecto que se corrigió
       en el modal de horario, y la misma lección: un estado de fallo
       indistinguible de uno legítimo acaba en un dato inventado tratado como
       real.
       Es el `error` de SWR tal cual, el mismo que ya se usaba arriba para
       decidir el respaldo sin conexión. `undefined` mientras no haya fallo.

       ⚠️ ÚSALO EN UN «O», NUNCA A SOLAS. `error` NO es el discriminador entre
       «no sé» y «falló»: SWR CONSERVA `data` cuando falla una REVALIDACIÓN
       posterior, así que `error` definido y una `clinica` perfectamente buena
       conviven —y `isOfflineData` sigue en `false`, porque `data` existe—.
       Escribir `if (error) → no me fío de clinica` tira datos válidos por un
       fallo que ya pasó. La forma correcta es la que usa el dashboard:
       `clinica !== null || error !== undefined` para decidir que ESTO YA
       RESOLVIÓ, y leer `clinica` aparte.
       ⚠️ Y NO ES «no hay clínica»: para eso el agregado responde 403 y ESO
       también llega aquí como error (ver `esErrorDeSesion` en configApp.ts). */
    error: error as ErrorConfig | undefined,
  }
}
