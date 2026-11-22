'use client'

/**
 * La barra de pestañas del expediente (región 2 del spec).
 *
 * ⚠️ LA PESTAÑA ACTIVA VIVE EN LA URL, NO EN UN `useState`. Es lo que la hace
 * sobrevivir a una recarga y enlazable, que es lo que el encargo pide. El
 * parámetro es `?tab=`, el mismo nombre que ya circulaba, pero AHORA SÍ LO LEE
 * ALGUIEN: antes existía en enlaces del dashboard y ninguna pantalla lo
 * consultaba, así que el chip «Nota» del dashboard abría el expediente sin más.
 * Si lo cambias de nombre, revisa esos enlaces.
 */

export const PESTANAS = [
  { clave: 'resumen',     rotulo: 'Resumen' },
  { clave: 'consultas',   rotulo: 'Consultas' },
  { clave: 'documentos',  rotulo: 'Documentos' },
  { clave: 'mediciones',  rotulo: 'Mediciones y archivos' },
] as const

export type ClavePestana = (typeof PESTANAS)[number]['clave']

/** La de entrada, y la respuesta para cualquier `?tab=` que no exista. */
export const PESTANA_POR_DEFECTO: ClavePestana = 'resumen'

export function esPestanaValida(valor: string | null): valor is ClavePestana {
  return PESTANAS.some(p => p.clave === valor)
}

export default function PestanasExpediente({ activa, conteos, onCambiar }: {
  activa: ClavePestana
  /* ⚠️ `undefined` NO ES CERO, y por eso el tipo lo admite: mientras el conteo
     no ha resuelto, la insignia no se dibuja. Pintar un 0 mientras carga dice
     que el paciente no tiene consultas, que es una afirmación y no un estado
     de espera. La cuarta pestaña no lleva conteo por decisión: contar analitos
     distintos no es un `count` barato. */
  conteos: Partial<Record<ClavePestana, number>>
  onCambiar: (clave: ClavePestana) => void
}) {
  return (
    /* Pestañas del kit (CALMA §6): subrayado de 2 en la activa, el conteo como
       número plano (`<i>`, sin píldora). Si no caben, `.k-tabs` las desplaza en
       horizontal; nunca encoge la letra.
       ⚠️ «MEDICIONES Y ARCHIVOS» SÓLO EN `esc`. En los formatos estrechos la
       cuarta pestaña se rotula «Mediciones» (maqueta `final-expediente`) y su
       nombre accesible sigue siendo el completo. Las dos variantes van con CSS,
       nunca con el formato leído en JS (hidratación). */
    <div role="tablist" aria-label="Secciones del expediente" className="k-tabs">
      {PESTANAS.map(p => {
        const esActiva = p.clave === activa
        const conteo = conteos[p.clave]
        const corto = p.clave === 'mediciones'
        return (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={esActiva}
            aria-label={corto ? p.rotulo : undefined}
            onClick={() => onCambiar(p.clave)}
            className="k-tab"
          >
            <span className="flex items-baseline gap-1">
              {corto ? (
                <>
                  <span className="esc:hidden">Mediciones</span>
                  <span className="hidden esc:inline">{p.rotulo}</span>
                </>
              ) : p.rotulo}
              {/* En ext no caben los cuatro rótulos con su número (maqueta): sin él. */}
              {conteo !== undefined && <i className="ext:hidden">{conteo}</i>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
