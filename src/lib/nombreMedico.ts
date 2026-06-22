/**
 * Composición del nombre del médico desde los campos estructurados de `profiles`.
 * Fuente de verdad: titulo + nombres + apellido_paterno + apellido_materno.
 * Sin fallback al campo legacy `nombre` (ver NOMBRES_PLAN.md, Fase 4).
 */
export interface CamposNombre {
  titulo?: string | null
  nombres?: string | null
  apellido_paterno?: string | null
  apellido_materno?: string | null
}

/** Nombre completo: titulo + nombres + apellido_paterno + apellido_materno. */
export function componerNombreMedicoCompleto(campos: CamposNombre): string {
  return [campos.titulo, campos.nombres, campos.apellido_paterno, campos.apellido_materno]
    .filter(Boolean)
    .join(' ')
}

/** Nombre corto: titulo + apellido_paterno. */
export function componerNombreMedicoCorto(campos: CamposNombre): string {
  return [campos.titulo, campos.apellido_paterno]
    .filter(Boolean)
    .join(' ')
}
