/**
 * La clave SWR del estado de perfil, en un solo sitio.
 *
 * MÓDULO NEUTRO —sin `'use client'`, sin React—, mismo papel que `CLAVE_CONFIG`
 * en `src/lib/configApp.ts`.
 *
 * ⚠️ POR QUÉ UNA CONSTANTE Y NO LA CADENA SUELTA EN CADA SITIO. La comparten
 * cinco puntos: los dos que LEEN (`GateOnboarding` y el aviso del sidebar, que
 * al compartir clave comparten también la petición) y los que ESCRIBEN algo que
 * el aviso evalúa y tienen que invalidarla. Una cadena mal tecleada en
 * cualquiera de ellos no rompe nada de forma visible: simplemente el aviso se
 * queda rancio, que es justo el defecto que esto viene a cerrar.
 */
export const CLAVE_ESTADO_PERFIL = '/api/me/estado-perfil'
