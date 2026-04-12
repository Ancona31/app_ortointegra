/**
 * storage-vault.ts — Blindaje de persistencia para la PWA Spinus
 *
 * Responsabilidades:
 *   1. Solicitar al navegador que los datos locales sean persistentes
 *      (navigator.storage.persist()) para evitar eviction bajo presión
 *      de memoria.
 *   2. Detectar si el navegador implementa la API de forma confiable
 *      (Safari la implementa pero no la honra — detectamos y avisamos).
 *   3. Reportar cuota y uso del origen para monitoreo en el hospital.
 *
 * Filosofía:
 *   - Módulo sin side effects al importar (todo lazy, SSR-safe).
 *   - Cero dependencias externas.
 *   - Tolerante a fallos: si la API no existe o falla, retorna estados
 *     informativos ('unsupported' / 'error') sin lanzar excepciones.
 */

export type PersistenceStatus =
  | 'granted'      // Browser confirmó persistencia real
  | 'denied'       // Browser rechazó la solicitud
  | 'unsupported'  // API no disponible (SSR, IE, browsers antiguos)
  | 'unreliable'   // API existe pero el browser miente (Safari)
  | 'error'        // Excepción inesperada al llamar la API

export interface StorageQuotaReport {
  /** Bytes totales usados por el origen (localStorage + IDB + Cache API + SW) */
  totalUsed: number
  /** Bytes totales disponibles para el origen */
  totalQuota: number
  /** Porcentaje usado (0-100) */
  percentUsed: number
  /** Bytes estimados solo de keys con prefijo spinus_sec_* (datos médicos cifrados) */
  secureStorageUsed: number
  /** false en Safari — la cuota reportada es orientativa, no garantizada */
  isReliable: boolean
}

/**
 * Detecta Safari (macOS/iOS) via user-agent.
 *
 * Safari implementa navigator.storage.persist() pero SIEMPRE retorna true
 * sin garantizar persistencia real. El browser evicta localStorage bajo
 * presión de memoria en iOS sin aviso. Esta es la única forma confiable
 * de detectar ese comportamiento — feature detection no lo expone.
 *
 * Acepto el user-agent sniffing aquí porque es el método menos malo
 * disponible. Documentado y aislado a esta función.
 */
function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // Safari incluye 'Safari' en UA pero NO 'Chrome' ni 'Chromium' ni 'Android'
  return /^((?!chrome|android|crios|fxios|chromium).)*safari/i.test(ua)
}

/**
 * Retorna true si el browser honra navigator.storage.persist() de forma
 * garantizada. Actualmente false solo en Safari.
 */
export function isPersistenceReliable(): boolean {
  if (typeof navigator === 'undefined') return true
  return !isSafariBrowser()
}

/**
 * Solicita persistencia real al browser. Idempotente: si ya fue granted,
 * retorna sin llamar la API. En Safari retorna 'unreliable' sin llamar.
 *
 * Retorna un status informativo; el caller decide si mostrar warning.
 */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  // SSR guard
  if (typeof navigator === 'undefined') return 'unsupported'

  // Feature detection
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
    return 'unsupported'
  }

  // Safari: la API existe pero no garantiza nada. No la llamamos para no
  // dar una falsa sensación de seguridad al resto del código.
  if (isSafariBrowser()) {
    return 'unreliable'
  }

  try {
    // Check previo: si ya fue granted en una sesión previa, no re-solicitar
    if (typeof navigator.storage.persisted === 'function') {
      const already = await navigator.storage.persisted()
      if (already) return 'granted'
    }

    const granted = await navigator.storage.persist()
    return granted ? 'granted' : 'denied'
  } catch {
    return 'error'
  }
}

/**
 * Verifica el estado actual de persistencia SIN re-solicitar.
 * Retorna false si la API no existe, si Safari (unreliable), o si el
 * browser reporta que no es persistente.
 */
export async function isStoragePersistent(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
    return false
  }
  // Safari: la API miente, forzamos false para que el banner aparezca
  if (isSafariBrowser()) return false

  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/**
 * Reporta uso y cuota de storage del origen, distinguiendo entre:
 *   - totalUsed: todo el origen (incluye SW cache de ~5-10MB)
 *   - secureStorageUsed: estimado de los datos médicos cifrados
 *
 * Útil para mostrar al usuario "datos médicos: 12MB / caché: 8MB".
 * Retorna null si la API de estimate no está disponible.
 */
export async function getStorageQuota(): Promise<StorageQuotaReport | null> {
  if (typeof navigator === 'undefined') return null
  if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    const totalUsed = estimate.usage ?? 0
    const totalQuota = estimate.quota ?? 0
    const percentUsed = totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0

    // Estimar uso de secureStorage iterando las keys con prefijo 'spinus_sec_'
    // (el prefijo real usado en src/lib/secureStorage.ts).
    let secureStorageUsed = 0
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !key.startsWith('spinus_sec_')) continue
          const value = localStorage.getItem(key)
          if (value == null) continue
          // UTF-16 en JS: aprox 2 bytes por char. Más el overhead de la key.
          secureStorageUsed += (key.length + value.length) * 2
        }
      } catch {
        // localStorage puede lanzar si el browser bloquea acceso — ignorar
      }
    }

    return {
      totalUsed,
      totalQuota,
      percentUsed,
      secureStorageUsed,
      isReliable: isPersistenceReliable(),
    }
  } catch {
    return null
  }
}
