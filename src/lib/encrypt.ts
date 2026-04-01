import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error('GOOGLE_TOKEN_SECRET debe ser una clave hex de 64 caracteres (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Cifra un string con AES-256-GCM.
 * Devuelve "iv:authTag:ciphertext" en hex.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Descifra un string cifrado con encrypt().
 * Devuelve null si el valor es nulo/vacío o si la clave no está configurada.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  // Si no tiene el formato esperado (valor legado no cifrado), devolver null
  const parts = ciphertext.split(':')
  if (parts.length !== 3) return null
  try {
    const key = getKey()
    const [ivHex, authTagHex, encHex] = parts
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
