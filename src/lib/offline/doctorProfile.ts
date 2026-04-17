/**
 * Pre-fetching de perfil del médico para el módulo Offline-Mode.
 *
 * Persiste nombre, cédulas, especialidad, logo y firma en Base64
 * en localStorage como spinus_doctor_profile. El generador de PDF
 * del offline-mode lee estos datos sin peticiones de red.
 *
 * AISLADO del AuthContext: solo lee/escribe localStorage.
 * La sincronización la disparan useMedicoInfo (onSuccess) y perfil/page (handleSubmit).
 */

const PROFILE_KEY = 'spinus_doctor_profile'

export interface DoctorProfile {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  universidad: string
  direccion_consultorio: string
  telefono_consultorio: string
  color_primario: string
  color_secundario: string
  logo_base64: string | null
  firma_base64: string | null
  clinica_nombre: string | null
  updated_at: string
}

/**
 * Lee el perfil del médico desde localStorage.
 * Retorna null si nunca se sincronizó.
 */
export function getDoctorProfile(): DoctorProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DoctorProfile
  } catch {
    return null
  }
}

/**
 * Convierte una URL de imagen a Base64 data URL.
 * Retorna null si falla (red caída, CORS, URL inválida).
 */
async function urlToBase64(url: string | null | undefined): Promise<string | null> {
  if (!url || !url.startsWith('https://')) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Sincroniza el perfil del médico a localStorage.
 * Descarga logo y firma como Base64 para uso offline.
 *
 * Llamar desde:
 *   - useMedicoInfo onSuccess (cada fetch exitoso)
 *   - perfil/page handleSubmit (después de guardar cambios)
 */
export async function syncDoctorProfile(medico: {
  nombre?: string | null
  especialidad?: string | null
  cedula_profesional?: string | null
  cedula_especialidad?: string | null
  universidad?: string | null
  direccion_consultorio?: string | null
  telefono_consultorio?: string | null
  color_primario?: string | null
  color_secundario?: string | null
  logo_url?: string | null
  firma_url?: string | null
  clinica_nombre?: string | null
}): Promise<void> {
  try {
    // Leer perfil existente para preservar Base64 si las URLs no cambiaron
    const existing = getDoctorProfile()

    // Descargar logo y firma como Base64 (en paralelo)
    const [logo_base64, firma_base64] = await Promise.all([
      medico.logo_url && medico.logo_url !== existing?.logo_base64?.slice(0, 50)
        ? urlToBase64(medico.logo_url)
        : Promise.resolve(existing?.logo_base64 ?? null),
      medico.firma_url && medico.firma_url !== existing?.firma_base64?.slice(0, 50)
        ? urlToBase64(medico.firma_url)
        : Promise.resolve(existing?.firma_base64 ?? null),
    ])

    const profile: DoctorProfile = {
      nombre: medico.nombre ?? '',
      especialidad: medico.especialidad ?? '',
      cedula_profesional: medico.cedula_profesional ?? '',
      cedula_especialidad: medico.cedula_especialidad ?? '',
      universidad: medico.universidad ?? '',
      direccion_consultorio: medico.direccion_consultorio ?? '',
      telefono_consultorio: medico.telefono_consultorio ?? '',
      color_primario: medico.color_primario ?? '#1a3a5c',
      color_secundario: medico.color_secundario ?? '#1e5fa8',
      logo_base64,
      firma_base64,
      clinica_nombre: medico.clinica_nombre ?? null,
      updated_at: new Date().toISOString(),
    }

    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Silencioso — la sincronización del perfil es best-effort
  }
}
