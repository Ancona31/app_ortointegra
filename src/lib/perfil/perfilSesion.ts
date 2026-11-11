/**
 * El perfil de la sesión tal como lo pide el SERVIDOR para sembrarlo en el
 * cliente (A1.2): `(app)/layout.tsx` lo lee una vez y se lo pasa a
 * `AuthProvider`, que lo siembra en `useProfile` antes de pintar a nadie. Así
 * la agenda —y todo lo demás— no espera a un `getUser()` + `profiles` desde el
 * navegador antes de su primera petición.
 *
 * ⚠️ MÓDULO NEUTRO, SIN `'use client'`, Y ASÍ TIENE QUE SEGUIR. Lo importan
 * `(app)/layout.tsx` y `lib/subscription.ts`, que son de servidor. El único
 * enlace con `hooks/useProfile.ts` es un `import type`, que desaparece al
 * compilar y no arrastra el árbol de cliente.
 */
import { z } from 'zod'
import type { Profile } from '@/hooks/useProfile'

/**
 * Las columnas de `profiles` que se piden en el servidor: los 12 campos de
 * `Profile` (`hooks/useProfile.ts`).
 *
 * ⚠️⚠️ LA USAN LOS DOS `select` DE PERF-DT-1 —`(app)/layout.tsx` y la rama que
 * consulta de `getSubscriptionState`— Y TIENE QUE SER LA MISMA CADENA EN LOS
 * DOS. Next desduplica los `fetch` idénticos de un render por URL, y Supabase
 * mete el `select` en la URL: con la misma cadena, los layouts anidados que
 * llaman a `getSubscriptionState` sin perfil comparten UN viaje con el padre;
 * con otra —o con las mismas columnas en otro orden— pagan uno cada uno, sin
 * error y sin test que falle. Por eso es UNA constante y no dos listas.
 *
 * ⚠️ Incluye `role`, `clinica_id` y `es_admin_de_clinica`: son las tres que
 * `getSubscriptionState` exige (`perfilCompleto`). Quitar cualquiera apaga el
 * cobro en silencio; el razonamiento está allí.
 */
export const COLUMNAS_PERFIL_SESION =
  'id, role, clinica_id, cedula_profesional, cedula_especialidad, especialidad, titulo, universidad, es_admin_de_clinica, nombres, apellido_paterno, apellido_materno'

const textoONulo = z.string().nullable()

/* `z.object` DESCARTA las claves no declaradas: al cliente sólo viajan estos
   12 campos aunque algún día el `select` pidiera más. */
const esquemaPerfilSesion = z.object({
  id: z.string(),
  role: z.enum(['super_admin', 'medico', 'secretaria']),
  clinica_id: textoONulo,
  cedula_profesional: textoONulo,
  cedula_especialidad: textoONulo,
  especialidad: textoONulo,
  titulo: textoONulo,
  universidad: textoONulo,
  es_admin_de_clinica: z.boolean(),
  nombres: textoONulo,
  apellido_paterno: textoONulo,
  apellido_materno: textoONulo,
})

/**
 * La fila de `profiles` → `Profile`, o `null` si no cuadra.
 *
 * ⚠️ `null` NO ES UN ERROR: ES «NO SEMBRAR». Un rol fuera de la lista, una
 * columna que falte o un tipo raro dejan al cliente en el camino de siempre
 * (`useProfile` lo pide él). Equivocarse hacia aquí cuesta una petición;
 * sembrar un perfil malformado costaría decidir con él toda la sesión.
 */
export function analizarPerfilSesion(fila: unknown): Profile | null {
  const resultado = esquemaPerfilSesion.safeParse(fila)
  return resultado.success ? resultado.data : null
}
