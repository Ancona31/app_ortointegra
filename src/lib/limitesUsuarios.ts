/**
 * Límites de médicos y secretarias de una clínica — las decisiones que toma la
 * app, sin red ni base.
 *
 * ⚠️ AQUÍ NO VIVE LA REGLA DEL LÍMITE EFECTIVO. Esa la calcula la base con
 * `public.limite_efectivo(max_*, ajuste_max_*, ajuste_*_hasta)` (contrato con
 * spinus-consola, CLAUDE.md), y la app la pide por RPC. Lo que entra aquí ya es
 * el número que devolvió la base; reimplementarlo en TypeScript es cómo la app
 * y la consola vuelven a decir cosas distintas sobre la misma clínica.
 *
 * ⚠️ LÍMITE 0 = NINGUNO (R6). Solo `null` es «sin límite». Nunca se pregunta por
 * la falsedad del número: en JavaScript `!0` es verdadero, y un `!limite` haría
 * ilimitada a la clínica que no puede tener ninguno.
 */

/** ¿Cabe uno más? `limite` es el límite efectivo; `null` = sin límite. */
export function puedeAgregar(usados: number, limite: number | null): boolean {
  if (limite === null) return true
  return usados < limite
}

/**
 * El mensaje de límite de siempre (el que daba `api/admin/invitar`), o null si
 * cabe uno más. Si ya hay MÁS usuarios que el límite —venció o bajó un ajuste—
 * se dice además que nadie pierde el acceso: el límite solo frena invitaciones.
 */
export function mensajeLimite(
  role: 'medico' | 'secretaria',
  usados: number,
  limite: number | null,
): string | null {
  if (puedeAgregar(usados, limite)) return null
  const base = role === 'medico'
    ? 'Has alcanzado el límite de médicos de tu plan'
    : 'Has alcanzado el límite de asistentes de tu plan'
  return limite !== null && usados > limite
    ? `${base}. Los usuarios que ya tienes conservan su acceso.`
    : base
}

/** Lo que pinta una tarjeta de uso de Facturación: «3/2», «0/0» o «3/∞». */
export interface TextoLimite {
  usado: string
  limite: string
  /** Línea «Límite ampliado…» bajo el contador, o null si no hay ajuste que suba el límite. */
  ampliado: string | null
}

const FECHA_MERIDA = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Merida',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * `efectivo` es lo que devolvió `limite_efectivo` y `base` la columna `max_*`.
 * Si el efectivo supera a la base es porque hay un ajuste vigente (la base ya
 * decidió la vigencia con su `now()`); `hasta` solo pone la fecha en el texto.
 */
export function textoLimite(
  usados: number,
  efectivo: number | null,
  base: number | null,
  hasta: string | null,
): TextoLimite {
  const ampliado = efectivo !== null && base !== null && efectivo > base
    ? `Límite ampliado: tu plan incluye ${base}; tienes ${efectivo} ${
        hasta ? `hasta el ${FECHA_MERIDA.format(new Date(hasta))}` : 'sin fecha de fin'
      }.`
    : null
  return {
    usado: String(usados),
    limite: efectivo === null ? '∞' : String(efectivo),
    ampliado,
  }
}
