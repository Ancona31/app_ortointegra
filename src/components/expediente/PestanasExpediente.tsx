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
    <div
      role="tablist"
      aria-label="Secciones del expediente"
      /* ⚠️ EL DESPLAZAMIENTO ES SÓLO DE MÓVIL (`max-lg:`), Y ANTES NO LO ERA.
         Con `overflow-x: auto` suelto salía una barra de scroll en escritorio
         con las cuatro pestañas cabiendo de sobra —ocupan ~560 px de los 960
         útiles—, y el motivo no era el ancho: cuando un eje del overflow es
         `visible` y el otro no, el `visible` COMPUTA A `auto`. O sea que
         `overflow-x: auto` traía de regalo `overflow-y: auto`, y el
         `margin-bottom: -1px` que llevaba cada pestaña la sacaba 1 px por
         debajo de la caja: 1 px de desbordamiento vertical, barra vertical en
         cuanto el sistema pinta barras clásicas, y la barra comiéndose ancho.
         Se arregla por los dos lados: aquí, no creando contenedor de scroll
         donde no hace falta; y abajo, quitando el margen negativo que lo
         provocaba.
         En móvil sí se desliza, y de ahí el relleno final que le deja aire al
         borde para no recortar la última pestaña.
         ⚠️ EL FILETE INFERIOR VA COMO SOMBRA INTERIOR, no como `border-b`. Es
         lo que permite que la pestaña activa apoye su subrayado encima sin
         necesitar el margen negativo: la sombra se pinta DENTRO de la caja, en
         el mismo borde donde termina la pestaña. */
      className="flex items-stretch gap-[var(--sp-1)] max-lg:overflow-x-auto pr-[var(--sp-4)] lg:pr-0"
      style={{ boxShadow: 'inset 0 -1px 0 var(--sp-line-card)' }}
    >
      {PESTANAS.map(p => {
        const esActiva = p.clave === activa
        const conteo = conteos[p.clave]
        return (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={esActiva}
            onClick={() => onCambiar(p.clave)}
            className="shrink-0 flex items-center gap-[var(--sp-2)] whitespace-nowrap px-[var(--sp-4)] py-[var(--sp-3)] text-[length:var(--sp-fs-body-sm)] transition-colors"
            style={{
              /* El subrayado de 2.5 px es el marcador de la activa. Va como
                 borde inferior para que se apoye en el filete de la barra, que
                 ahora es la sombra interior del contenedor: por eso ya NO lleva
                 `marginBottom: -1px`. Ese margen era el que desbordaba la caja
                 y sacaba la barra de scroll. No lo devuelvas. */
              borderBottom: `2.5px solid ${esActiva ? 'var(--sp-primary)' : 'transparent'}`,
              color: esActiva ? 'var(--sp-ink-800)' : 'var(--sp-ink-500)',
              fontWeight: esActiva ? 'var(--sp-fw-bold)' : 'var(--sp-fw-semi)',
            }}
          >
            {p.rotulo}
            {conteo !== undefined && (
              <span
                className="rounded-[var(--sp-r-pill)] px-[7px] py-px text-[length:var(--sp-fs-legal)] font-bold tabular-nums"
                style={esActiva
                  ? { background: 'var(--sp-primary-bg)', color: 'var(--sp-primary-ink)' }
                  : { background: 'var(--sp-surface-muted)', color: 'var(--sp-ink-500)' }}
              >
                {conteo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
