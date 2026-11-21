/**
 * Avatar.tsx — círculo con las iniciales de una persona (CALMA §3 y §11).
 *
 * Primitiva del rediseño (B2). Dibuja `.k-avatar` de `sistema.css` y le pone
 * uno de los pares de `PALETA_AVATAR`, que vive AQUÍ desde B2:
 * `components/dashboard/paletaAvatar.ts` quedó como reexportación para no
 * tocar a sus cuatro consumidores (`CabeceraPaciente`, `UltimosPacientes`,
 * `ProximasCitas`, `AtendidosRecientemente`).
 *
 * ⚠️ SON DIEZ PARES Y NO LOS SEIS DEL PLAN. El PLAN (§3, B2) habla de «6
 * pares», que es lo que dibujan las maquetas; la app tiene diez (`--sp-avatar-*`
 * con su oscuro) y la rotación del dashboard DEPENDE de que sean más de ocho:
 * `ARRANQUE_AVATAR` da dos ventanas de cuatro sin solaparse. Bajarlos a seis
 * cambiaría colores de pantallas que B2 no toca. Se decide al migrar el
 * dashboard (B5), no aquí.
 *
 * Es decorativo: el nombre va siempre al lado, así que el círculo lleva
 * `aria-hidden`. Sin `'use client'`: se puede pintar desde un componente de
 * servidor.
 */
import type { CSSProperties, ReactElement } from 'react'

/**
 * Los diez pares de la familia `--sp-avatar-*`, en el orden de la familia.
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

export type ParAvatar = (typeof PALETA_AVATAR)[number]

/** El par que toca a la posición `indice` de una lista que arranca en `arranque`. */
export function colorAvatar(indice: number, arranque = 0): ParAvatar {
  const n = PALETA_AVATAR.length
  return PALETA_AVATAR[(((arranque + indice) % n) + n) % n]
}

/** Iniciales de nombre y apellidos («Paciente Prueba» → «PP»); «?» si no hay nada. */
export function inicialesDe(nombre: string, apellidos = ''): string {
  const ini = `${nombre.trim()[0] ?? ''}${apellidos.trim()[0] ?? ''}`.toUpperCase()
  return ini || '?'
}

export interface AvatarProps {
  /** Lo que se escribe dentro: iniciales o un número (CALMA: en la semilla, «01»). */
  texto: string
  /** Posición en su lista; con `arranque`, elige el par de `PALETA_AVATAR`. */
  indice?: number
  arranque?: number
  /** `neutro`: `--sup2` con `--tinta2`, para listas largas (CALMA §3). */
  neutro?: boolean
  /** 36 por defecto; 32 en `ext` si hace falta; 44 en cabeceras. */
  tam?: 32 | 36 | 44
  className?: string
}

export default function Avatar({ texto, indice = 0, arranque = 0, neutro = false, tam = 36, className }: AvatarProps): ReactElement {
  const par = colorAvatar(indice, arranque)
  const estilo: CSSProperties | undefined = neutro ? undefined : { background: par.bg, color: par.ink }
  const clases = ['k-avatar', tam === 36 ? '' : `k-avatar-${tam}`, className ?? ''].filter(Boolean).join(' ')
  return <span className={clases} style={estilo} aria-hidden="true">{texto}</span>
}
