/** Validaciones reutilizables para formularios */

export function validarEmail(email: string): string | null {
  if (!email) return null // opcional
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(email)) return 'Correo electrónico no válido'
  return null
}

export function validarTelefono(tel: string): string | null {
  if (!tel) return null // opcional
  const soloDigitos = tel.replace(/[\s\-()]/g, '')
  if (!/^\d+$/.test(soloDigitos)) return 'Solo números'
  if (soloDigitos.length !== 10) return 'El teléfono debe tener 10 dígitos'
  return null
}

export function validarCedula(cedula: string): string | null {
  if (!cedula) return null // opcional
  if (!/^\d+$/.test(cedula)) return 'Solo números'
  if (cedula.length < 7 || cedula.length > 8) return 'La cédula debe tener 7 u 8 dígitos'
  return null
}

/** Formatea teléfono mientras se escribe: 999 123 4567 */
export function formatearTelefono(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
