/**
 * Los cinco pares de la familia `--sp-avatar-*`, en el orden de la familia.
 *
 * Es una tabla y nada más: aquí no vive ninguna lógica de asignación. Quién se
 * lleva cada par lo decide su consumidor, con
 * `PALETA_AVATAR[(arranque + i) % PALETA_AVATAR.length]` — rotación por índice
 * de la lista, desplazada por región (ver `ARRANQUE_AVATAR` abajo). Eso es lo
 * que garantiza que las cuatro tarjetas de una región salgan de cuatro colores
 * distintos: con diez pares y cuatro puestos no hay repetición posible.
 *
 * ⚠️ LOS NOMBRES DE TOKEN VAN ESCRITOS ENTEROS, no interpolados
 * (`var(--sp-avatar-${n}-bg)`). Es la garantía que explica `StatusChip.tsx:19`:
 * un token que no exista no da error de compilación ni de runtime, deja el
 * elemento transparente y nadie se entera. Escritos así, un token fantasma se
 * encuentra buscándolo en `spinus-tokens.css`, y renombrar la familia rompe
 * aquí de forma localizable.
 *
 * ⚠️ NO ES LA PALETA DE `/expediente`. Aquella lista tiene la suya
 * (`AVATAR_COLORS`, clases de Tailwind, en `expediente/page.tsx` y en
 * `TablaPacientesExpediente.tsx`) y se queda como está: se estudió unificarlas y
 * se descartó. Un mismo paciente puede salir de colores distintos en las dos
 * pantallas, y es el estado aceptado, no un defecto por corregir.
 */
export const PALETA_AVATAR = [
  { bg: 'var(--sp-avatar-1-bg)', ink: 'var(--sp-avatar-1-ink)' },
  { bg: 'var(--sp-avatar-2-bg)', ink: 'var(--sp-avatar-2-ink)' },
  { bg: 'var(--sp-avatar-3-bg)', ink: 'var(--sp-avatar-3-ink)' },
  { bg: 'var(--sp-avatar-4-bg)', ink: 'var(--sp-avatar-4-ink)' },
  { bg: 'var(--sp-avatar-5-bg)', ink: 'var(--sp-avatar-5-ink)' },
  { bg: 'var(--sp-avatar-6-bg)', ink: 'var(--sp-avatar-6-ink)' },
  { bg: 'var(--sp-avatar-7-bg)', ink: 'var(--sp-avatar-7-ink)' },
  { bg: 'var(--sp-avatar-8-bg)', ink: 'var(--sp-avatar-8-ink)' },
  { bg: 'var(--sp-avatar-9-bg)', ink: 'var(--sp-avatar-9-ink)' },
  { bg: 'var(--sp-avatar-10-bg)', ink: 'var(--sp-avatar-10-ink)' },
] as const

/**
 * Dónde empieza a contar la rotación cada región.
 *
 * ⚠️ SIN ESTO LAS DOS REGIONES PINTAN LOS MISMOS CUATRO COLORES. La asignación
 * es por índice de la lista y las dos listas tienen como mucho cuatro
 * elementos, así que `i` sólo vale 0..3: sin desplazar el arranque, próximas
 * citas y atendidos recientemente salían con los pares 1-4 en el mismo orden,
 * uno encima del otro y a la vista al mismo tiempo. Con estos dos arranques las
 * ventanas son disjuntas —no comparten ni una posición— y entre las dos se ven
 * OCHO colores distintos.
 *
 * Por qué 0 y 4 y no otro par: de todos los arranques con ventanas disjuntas,
 * todos empatan en ΔE mínimo entre los ocho que se ven (12.2), así que se
 * eligen los que dejan la banda 1 EXACTAMENTE como estaba —los cuatro pares que
 * ya pintaba— y hacen que el cambio caiga entero en la banda 2, que es donde se
 * veía la repetición. Los pares 9 y 10 quedan en reserva: con dos ventanas de
 * cuatro sobre diez, dos sobran siempre.
 */
export const ARRANQUE_AVATAR = {
  proximasCitas: 0,
  atendidos: 4,
} as const
