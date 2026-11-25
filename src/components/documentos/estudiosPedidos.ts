/**
 * Lógica pura de la solicitud de laboratorio (maqueta `laboratorio-rapido.html`,
 * aprobada por el dueño): un buscador que añade y queda listo para el
 * siguiente, lo pedido como fichas, frecuentes que se encienden y apagan y el
 * catálogo por categoría. Sin React: lo prueba
 * `src/lib/tests/estudiosPedidos.test.ts`.
 *
 * ⚠️ NO CAMBIA LO QUE SE GUARDA: `contenido.estudios` sigue siendo una lista de
 * cadenas, en el orden en que se pidieron. Aquí sólo se decide qué se añade,
 * qué se quita y qué se ofrece al buscar.
 */
import { ESTUDIOS_LAB } from '@/lib/estudiosLab'
import { sinAcentos } from '@/components/documentos/recetaCompacta'

/**
 * Las diez fichas de «Frecuentes»: el rótulo corto de siempre y el NOMBRE DEL
 * CATÁLOGO que piden (decisión del dueño: «unifica los duplicados»). Antes la
 * ficha pedía el rótulo mismo —«Biometría Hemática», «TP»— y el buscador
 * ofrecía el nombre largo, así que el mismo estudio podía ir dos veces con dos
 * nombres. La prueba exige que cada `estudio` exista literal en `ESTUDIOS_LAB`.
 *
 * Consecuencia aceptada: una plantilla o un borrador guardados con el texto
 * viejo («Biometría Hemática», «Glucosa», «TP»…) se siguen aplicando tal cual
 * —ese estudio va al papel con su nombre viejo—, pero su ficha de frecuente NO
 * se enciende, porque la ficha mira el nombre del catálogo. Ni el formulario ni
 * el panel de plantillas pueden suponer que un estudio guardado tiene ficha.
 */
export const FRECUENTES_LAB: readonly { rotulo: string; estudio: string }[] = [
  { rotulo: 'Biometría Hemática', estudio: 'Biometría Hemática Completa (BHC)' },
  { rotulo: 'Glucosa', estudio: 'Glucosa en ayuno' },
  { rotulo: 'Urea', estudio: 'Urea' },
  { rotulo: 'Creatinina', estudio: 'Creatinina' },
  { rotulo: 'Examen General de Orina', estudio: 'Examen General de Orina (EGO)' },
  { rotulo: 'TP', estudio: 'Tiempo de Protrombina (TP / INR)' },
  { rotulo: 'TPT', estudio: 'Tiempo de Tromboplastina Parcial Activada (TTPa)' },
  { rotulo: 'Perfil Tiroideo Completo', estudio: 'Perfil Tiroideo Completo' },
  { rotulo: 'Urocultivo', estudio: 'Urocultivo y Antibiograma' },
  { rotulo: 'Cultivo de Secreción', estudio: 'Cultivo de Secreción' },
]

/** Dos estudios son el mismo si sólo cambian acentos, mayúsculas o espacios de los bordes. */
export function mismoEstudio(a: string, b: string): boolean {
  return sinAcentos(a.trim()) === sinAcentos(b.trim())
}

export function estaPedido(pedidos: readonly string[], estudio: string): boolean {
  return pedidos.some(p => mismoEstudio(p, estudio))
}

/** Añade al final (orden de alta). Vacío o repetido: la misma lista, sin cambios. */
export function anadirEstudio(pedidos: readonly string[], estudio: string): readonly string[] {
  const limpio = estudio.trim()
  if (!limpio || estaPedido(pedidos, limpio)) return pedidos
  return [...pedidos, limpio]
}

export function quitarEstudio(pedidos: readonly string[], estudio: string): readonly string[] {
  return pedidos.filter(p => !mismoEstudio(p, estudio))
}

/** Lo que hacen una ficha de frecuente y una casilla del catálogo. */
export function alternarEstudio(pedidos: readonly string[], estudio: string): readonly string[] {
  return estaPedido(pedidos, estudio) ? quitarEstudio(pedidos, estudio) : anadirEstudio(pedidos, estudio)
}

/**
 * Coincidencias del catálogo para lo escrito: sin acentos ni mayúsculas, sin
 * los ya pedidos, primero las que coinciden más al principio (a igualdad, el
 * orden del catálogo). Menos de 2 letras: nada.
 */
export function buscarEstudios(
  texto: string, pedidos: readonly string[], catalogo: readonly string[] = ESTUDIOS_LAB, max = 8,
): string[] {
  const q = sinAcentos(texto.trim())
  if (q.length < 2) return []
  return catalogo
    .map((e, i) => ({ e, i, pos: sinAcentos(e).indexOf(q) }))
    .filter(x => x.pos >= 0 && !estaPedido(pedidos, x.e))
    .sort((a, b) => a.pos - b.pos || a.i - b.i)
    .slice(0, max)
    .map(x => x.e)
}

/** «n de total» de una categoría del catálogo. */
export function pedidosEn(pedidos: readonly string[], estudios: readonly string[]): number {
  return estudios.filter(e => estaPedido(pedidos, e)).length
}
