/**
 * La paleta de avatares vive en `components/ui/Avatar.tsx` desde el bloque B2
 * del rediseño (PLAN §3, «Avatar.tsx, que absorbe paletaAvatar.ts»). Este
 * archivo queda como reexportación para que sus cuatro consumidores
 * (`CabeceraPaciente`, `UltimosPacientes`, `ProximasCitas`,
 * `AtendidosRecientemente`) sigan importando de aquí sin cambio. La tabla, sus
 * avisos y el porqué de `ARRANQUE_AVATAR` están allí.
 *
 * Se borra cuando el último de los cuatro importe de `@/components/ui/Avatar`
 * (lo hacen sus bloques, B5 y B7; limpieza en B15, con grep).
 */
export { PALETA_AVATAR, ARRANQUE_AVATAR } from '@/components/ui/Avatar'
