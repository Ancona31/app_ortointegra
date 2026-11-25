/**
 * src/lib/agenda/nombresTarjeta.ts
 *
 * F1.7 · El nombre corto de una tarjeta estrecha de la rejilla: primer nombre
 * más la inicial del primer apellido («Hugo I.», decisión 10). Lo monta la
 * tarjeta junto al nombre entero y `globals.css` elige uno u otro con una
 * consulta de contenedor (`@container`, ≤ 96 px): sin observador nuevo y sin
 * render de más. Antes, dos citas simultáneas con «Todos» se quedaban en
 * «08:00 H.» y el nombre no se leía.
 */

/* Partículas que NO son el apellido: «de la Cruz» abrevia a «C.», no a «d.». */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'van', 'von', 'di'])

function palabras(texto: string): string[] {
  return texto.trim().split(/\s+/).filter(Boolean)
}

/** La inicial en mayúscula de la primera palabra que no es partícula, o `null`. */
function inicialDeApellido(resto: readonly string[]): string | null {
  const apellido = resto.find(p => !PARTICULAS.has(p.toLocaleLowerCase('es')))
  const primera = apellido ? Array.from(apellido)[0] : undefined
  return primera ? `${primera.toLocaleUpperCase('es')}.` : null
}

/** «Hugo» + «Interián Pérez» → «Hugo I.». Sin apellidos, el primer nombre a secas. */
export function nombreCortoPaciente(nombre: string, apellidos: string): string {
  const [primero, ...otrosNombres] = palabras(nombre)
  const inicial = inicialDeApellido(palabras(apellidos))
  if (!primero) return inicial ?? ''
  if (inicial) return `${primero} ${inicial}`
  // Sin apellidos registrados, el segundo nombre hace de apellido si lo hay.
  const deRespaldo = inicialDeApellido(otrosNombres)
  return deRespaldo ? `${primero} ${deRespaldo}` : primero
}

/** Para un nombre en un solo texto (la cita por ligar trae `reserva_nombre`). */
export function nombreCortoDeTexto(texto: string): string {
  const [primero, ...resto] = palabras(texto)
  if (!primero) return ''
  const inicial = inicialDeApellido(resto)
  return inicial ? `${primero} ${inicial}` : primero
}
