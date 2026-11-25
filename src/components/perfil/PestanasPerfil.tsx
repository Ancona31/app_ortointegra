'use client'

/**
 * La barra de pestañas de Mi perfil (región 1 del spec).
 *
 * ⚠️ ES EL PATRÓN DE `PestanasExpediente`, NO UNA COPIA CASUAL. Mismo subrayado
 * de 2.5 px, mismo filete como sombra INTERIOR del contenedor, mismo
 * desplazamiento sólo en móvil. El mockup pedía píldoras sobre superficie
 * hundida; se descartaron para que las dos pantallas del mismo rediseño
 * —expediente y perfil— no naveguen de dos maneras distintas. Si cambias el
 * aspecto de una, mira la otra.
 *
 * ⚠️ NO SE IMPORTA `PestanasExpediente` NI SE FACTORIZA UNA BASE COMÚN. Sus
 * claves, su `aria-label` y su insignia de conteo son suyos; una base genérica
 * para dos consumidores es la abstracción prematura que el proyecto prohíbe.
 * La duplicación es de estilos, y es deliberada.
 *
 * ⚠️ LA PESTAÑA ACTIVA VIVE EN LA URL (`?tab=`), NO EN UN `useState`. Es lo que
 * la hace sobrevivir a una recarga y enlazable. Ojo: `/perfil` YA recibe
 * `?gcal_error=` desde los seis redirects de Google, así que los dos parámetros
 * comparten querystring — por eso quien cambia de pestaña reescribe la URL
 * entera con `URL`, conservando lo demás, en vez de construirla de cero.
 */

export const PESTANAS_PERFIL = [
  { clave: 'datos',        rotulo: 'Datos' },
  { clave: 'consultorios', rotulo: 'Consultorios' },
  /* Se llama por el nombre del servicio y no «Integraciones» (spec §Región 1):
     muchos usuarios no reconocen esa palabra. */
  { clave: 'google',       rotulo: 'Google Calendar' },
] as const

export type ClavePestanaPerfil = (typeof PESTANAS_PERFIL)[number]['clave']

/** La de entrada, y la respuesta para cualquier `?tab=` que no exista. */
export const PESTANA_PERFIL_POR_DEFECTO: ClavePestanaPerfil = 'datos'

export function esPestanaPerfilValida(valor: string | null): valor is ClavePestanaPerfil {
  return PESTANAS_PERFIL.some(p => p.clave === valor)
}

export default function PestanasPerfil({ activa, onCambiar }: {
  activa: ClavePestanaPerfil
  onCambiar: (clave: ClavePestanaPerfil) => void
}) {
  return (
    /* Rediseño B10: la fila de pestañas del kit (`.k-tabs`/`.k-tab`, CALMA §6),
       la misma de Administración y del expediente. `data-t` reserva el ancho de
       la negrita para que la fila no salte al cambiar de pestaña. Se desplaza en
       horizontal si no cabe (nunca encoge la letra). */
    <div role="tablist" aria-label="Secciones de Mi perfil" className="k-tabs">
      {PESTANAS_PERFIL.map(p => (
        <button
          key={p.clave}
          type="button"
          role="tab"
          aria-selected={p.clave === activa}
          data-t={p.rotulo}
          onClick={() => onCambiar(p.clave)}
          className="k-tab"
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  )
}
