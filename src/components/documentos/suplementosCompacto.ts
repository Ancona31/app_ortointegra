/**
 * Lógica pura del plan de suplementación compacto (un suplemento abierto, los
 * demás plegados; maqueta `suplementos.html`, aprobada). Sin React: lo prueba
 * `src/lib/tests/suplementosCompacto.test.ts`.
 *
 * ⚠️ NO CONOCE EL CATÁLOGO NI CALCULA DOSIS: los nueve suplementos y
 * `calcularDosis`/`dosisEnCapsulas`/`dosisParaForm` siguen en
 * `PlanSuplementacionForm.tsx`, intactos. Aquí sólo se decide qué se busca,
 * qué se puede elegir, qué dice la línea plegada y qué fila sobra.
 */
import { sinAcentos } from '@/components/documentos/recetaCompacta'

/**
 * Índices del catálogo cuyo nombre contiene lo escrito, sin acentos ni
 * mayúsculas, en el orden del catálogo. Sin texto: los nueve (son pocos y el
 * buscador los enseña al enfocarse).
 */
export function buscarSuplementos(texto: string, nombres: readonly string[]): number[] {
  const q = sinAcentos(texto.trim())
  return nombres.flatMap((n, i) => (q === '' || sinAcentos(n).includes(q) ? [i] : []))
}

/**
 * La opción activa del buscador tras moverse `paso` (+1 ↓, −1 ↑) en círculo,
 * saltando las ya elegidas. `desde` −1 = ninguna todavía. Sin ninguna elegible,
 * −1: Enter no hace nada.
 */
export function moverActiva(
  desde: number, paso: 1 | -1, total: number, elegible: (posicion: number) => boolean,
): number {
  if (total === 0) return -1
  let i = desde
  for (let n = 0; n < total; n++) {
    i = desde < 0 && n === 0 ? (paso === 1 ? 0 : total - 1) : (i + paso + total) % total
    if (elegible(i)) return i
  }
  return -1
}

/** Segundo renglón de la línea plegada: dosis y justificación, o «Sin dosis». */
export function resumenSuplemento(dosis: string, justificacion: string): string {
  return [dosis.trim(), justificacion.trim()].filter(Boolean).join(' · ') || 'Sin dosis'
}

/** Peso con el que se calcula: el número que hoy lee el formulario (`parseFloat`). */
export function pesoNumerico(pesoKg: string): number {
  const n = parseFloat(pesoKg)
  return n > 0 ? n : 0
}

/**
 * La fila que se quita al plegar o al abrir otra: la abierta si sigue sin
 * suplemento elegido y NO es la única. Devuelve su clave o `null`.
 */
export function filaQueSobra(
  filas: readonly { clave: number; nombre: string }[], abierta: number | null,
): number | null {
  if (abierta === null || filas.length < 2) return null
  const f = filas.find(x => x.clave === abierta)
  return f && f.nombre === '' ? abierta : null
}

/** Texto de la referencia bajo la dosis: «Calculada/Sugerida para 78 kg: …». */
export function textoCalculo(editada: boolean, pesoKg: number, sugerida: string, porKg: string): string {
  return `${editada ? 'Sugerida' : 'Calculada'} para ${pesoKg} kg: ${sugerida} (${porKg})`
}
