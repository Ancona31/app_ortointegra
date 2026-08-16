import { secureStorage } from '@/lib/secureStorage'
import { Consultorio } from '@/types'

/**
 * Configuración de la sesión: lo que la app necesita saber de la clínica del
 * médico y que cambia como mucho una vez al mes.
 *
 * Existe porque al abrir la agenda salían cuatro peticiones en paralelo
 * (`/api/me/clinica`, `/api/consultorios`, `/api/me/horario` y
 * `/api/clinica/medicos`) y en Vercel cada una levanta su propia instancia:
 * cada llamada paralela es una lotería de arranque en frío de ~3.5 s. Una
 * sola clave, un solo billete.
 *
 * Los cuatro endpoints individuales SIGUEN VIVOS y no se tocan: `perfil`,
 * `expediente`, `pacientes/nuevo` y `QuickPatientModal` los llaman con
 * `fetch` directo. Esto solo cubre a quien pasaba por `useClinica`,
 * `useConsultorios` o la agenda.
 */

export const CLAVE_CONFIG = '/api/me/config'

/**
 * Cinco minutos. Son datos de configuración y el `<SWRConfig>` de (app) ya
 * revalida al enfocar con ese mismo throttle, así que navegar entre páginas
 * —o volver a la pestaña— no vuelve a pedirlos. El valor anterior de los dos
 * hooks era 60 s.
 */
export const CONFIG_DEDUPE_MS = 300_000

/** Claves de `secureStorage` para el fallback offline de los dos hooks. */
export const CACHE_CLINICA = 'cache_clinica'
export const CACHE_CONSULTORIOS = 'cache_consultorios'

export type ClinicaConfig = {
  id: string
  nombre: string
  nombre_display: string | null
  subtitulo: string | null
  color_primario: string | null
  color_secundario: string | null
  logo_url: string | null
}

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type HorarioDia = { activo: boolean; inicio: string; fin: string }
/** `clinicas.horario_consulta`. Lo consume la agenda (businessHours). */
export type Horario = Record<DiaSemana, HorarioDia>

/**
 * El médico tal como lo necesita la agenda: nombre compuesto para el
 * dropdown e iniciales para el chip de las tarjetas. NO lleva `especialidad`
 * ni `es_admin_de_clinica`, que sí devuelve `/api/clinica/medicos` y que la
 * agenda nunca leyó.
 */
export type MedicoConfig = {
  id: string
  titulo: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
}

export type ConfigApp = {
  clinica: ClinicaConfig | null
  consultorios: Consultorio[]
  horario: Horario | null
  medicos: MedicoConfig[]
}

export const CONFIG_VACIA: ConfigApp = {
  clinica: null,
  consultorios: [],
  horario: null,
  medicos: [],
}

/**
 * Error del agregado con el código HTTP a cuestas. El código es lo que separa
 * «el servidor no me contestó» de «el servidor me contestó que no».
 */
export type ErrorConfig = Error & { status?: number }

/**
 * Fetcher único de la clave. La persistencia en `secureStorage` va aquí y no
 * en un `onSuccess` por hook a propósito: con varios hooks sobre la misma
 * clave, SWR solo ejecuta el fetcher —y el `onSuccess`— del que dispara la
 * revalidación, así que el cache del otro nunca llegaría a escribirse.
 */
export async function fetcherConfig(url: string): Promise<ConfigApp> {
  const r = await fetch(url)
  if (!r.ok) {
    const error: ErrorConfig = new Error('Error al cargar la configuración')
    error.status = r.status
    throw error
  }
  const data = (await r.json()) as ConfigApp
  if (data.clinica) secureStorage.set(CACHE_CLINICA, data.clinica).catch(() => {})
  if (data.consultorios) secureStorage.set(CACHE_CONSULTORIOS, data.consultorios).catch(() => {})
  return data
}

/**
 * ⚠ EL CACHE CIFRADO NO ES UN SUSTITUTO DE UNA SESIÓN CERRADA.
 *
 * `useClinica` y `useConsultorios` caen a `secureStorage` cuando el agregado
 * falla, y eso es correcto para trabajar sin red estando dentro. NO lo es ante
 * un 401 (no hay sesión) ni un 403 (no hay clínica): ahí el servidor sí sabe la
 * respuesta y la respuesta es que no hay nada que enseñar.
 *
 * El caso concreto que esto cierra: `signOut()` (auth-context.tsx:180) borra
 * cookies y `sessionStorage`, pero NO `secureStorage` — `cache_clinica` y
 * `cache_consultorios` sobreviven al cierre de sesión. Sin este predicado, un
 * médico que se loguea en una máquina que usó otro y recibe un 401 mientras su
 * sesión se asienta vería pintada la clínica del anterior. Fuga entre cuentas.
 */
export function esErrorDeSesion(error: unknown): boolean {
  const status = (error as ErrorConfig | undefined)?.status
  return status === 401 || status === 403
}
