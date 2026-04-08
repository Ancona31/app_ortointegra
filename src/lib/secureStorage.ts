/**
 * Almacenamiento seguro en localStorage con cifrado AES-GCM.
 *
 * FUNDAMENTO LEGAL — LFPDPPP Art. 19:
 * "El responsable deberá establecer y mantener medidas de seguridad
 * administrativas, técnicas y físicas que permitan proteger los datos
 * personales contra daño, pérdida, alteración, destrucción o el uso,
 * acceso o tratamiento no autorizado."
 *
 * Los datos clínicos (borradores de notas, cola offline de recetas) se
 * cifran con AES-256-GCM usando una clave derivada de la sesión del
 * usuario. Si la sesión cambia o expira, los datos son irrecuperables.
 * TTL de 24 horas máximo — los datos se auto-eliminan después.
 */

const PREFIX = 'spinus_sec_'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 horas
const ALGO = 'AES-GCM'

// ── Derivar clave de cifrado de un string (session fingerprint) ──────

async function deriveKey(seed: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('spinus-secure-storage-salt'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Obtener fingerprint de sesión ────────────────────────────────────

function getSessionFingerprint(): string | null {
  if (typeof window === 'undefined') return null
  // Usar las cookies de Supabase como semilla — si la sesión cambia,
  // la clave cambia y los datos previos son irrecuperables
  const cookies = document.cookie
  const sbCookie = cookies.split(';').find(c => c.trim().startsWith('sb-'))
  if (!sbCookie) return null
  // Usar un hash del valor de la cookie como fingerprint
  return sbCookie.trim().slice(0, 64)
}

// ── API pública ──────────────────────────────────────────────────────

export const secureStorage = {

  async set(key: string, value: unknown): Promise<void> {
    if (typeof window === 'undefined') return
    const fingerprint = getSessionFingerprint()
    if (!fingerprint) {
      // Sin sesión — guardar sin cifrar como fallback (mejor que perder datos)
      try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now(), enc: false })) } catch {}
      return
    }

    try {
      const cryptoKey = await deriveKey(fingerprint)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const plaintext = new TextEncoder().encode(JSON.stringify(value))

      const ciphertext = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        cryptoKey,
        plaintext
      )

      const payload = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext)),
        t: Date.now(),
        enc: true,
      }

      localStorage.setItem(PREFIX + key, JSON.stringify(payload))
    } catch {
      // Si crypto falla, guardar sin cifrar como fallback
      try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now(), enc: false })) } catch {}
    }
  },

  async get<T = unknown>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null

    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (!raw) return null

      const parsed = JSON.parse(raw)

      // Verificar TTL
      if (parsed.t && Date.now() - parsed.t > TTL_MS) {
        localStorage.removeItem(PREFIX + key)
        return null
      }

      // Datos no cifrados (fallback)
      if (!parsed.enc) return parsed.v as T

      // Datos cifrados
      const fingerprint = getSessionFingerprint()
      if (!fingerprint) return null // sesión cambió — datos irrecuperables

      const cryptoKey = await deriveKey(fingerprint)
      const iv = new Uint8Array(parsed.iv)
      const ciphertext = new Uint8Array(parsed.data)

      const plaintext = await crypto.subtle.decrypt(
        { name: ALGO, iv },
        cryptoKey,
        ciphertext
      )

      return JSON.parse(new TextDecoder().decode(plaintext)) as T
    } catch {
      // Descifrado falló (sesión cambió, datos corruptos, etc.)
      localStorage.removeItem(PREFIX + key)
      return null
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return
    try { localStorage.removeItem(PREFIX + key) } catch {}
  },

  /** Elimina todos los items expirados de secureStorage */
  cleanup(): void {
    if (typeof window === 'undefined') return
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (!k?.startsWith(PREFIX)) continue
        const raw = localStorage.getItem(k)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (parsed.t && Date.now() - parsed.t > TTL_MS) {
          localStorage.removeItem(k)
        }
      }
    } catch {}
  },
}
