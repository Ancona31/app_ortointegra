'use client'

import { useEffect, useRef } from 'react'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import type { Documento } from '@/types'
import { metaDe, tituloDe, folioVisible } from '@/lib/documentos/familias'
import CuerpoDocumento from './CuerpoDocumento'
import AccionesDocumento, { type AccionesProps } from './AccionesDocumento'

/**
 * El CHASIS del visor de documentos. Mismo criterio que el visor de nota, para
 * que expediente y documentos se lean igual.
 *
 * ⚠️ CONTENEDOR CON DESPLAZAMIENTO PROPIO, no una página que fluye: el
 * documento se recorre sin mover la página, ni la cabecera del paciente, ni las
 * pestañas. `max-h` y no `h`: si el documento es corto, el contenedor se ajusta
 * a su contenido y no deja aire al pie.
 *
 * ⚠️ AQUÍ EL TOPE VALE TAMBIÉN EN MÓVIL, como en la línea de tiempo del Resumen
 * y por el mismo motivo: un escrito médico no tiene tope de longitud, y sin
 * caja propia la pestaña entera se vuelve un desplazamiento sin fondo. Es la
 * misma excepción deliberada a «scroll interno solo en escritorio», ya
 * documentada en `LineaTiempoClinica`.
 *
 * ⚠️ DENTRO NO HAY MÁS TARJETAS: ésta es la superficie que sostiene la lectura.
 */

/** §15: medida de lectura ~620 px, centrada. El contenedor ocupa su columna; el texto no. */
const MEDIDA = 'mx-auto w-full max-w-[620px]'

function Chip({ children, tono }: { children: React.ReactNode; tono: 'aviso' | 'exito' | 'error' | 'tipo'; color?: string }) {
  const estilo =
    tono === 'aviso' ? { background: 'var(--sp-warn-bg)', color: 'var(--sp-warn)' }
    : tono === 'exito' ? { background: 'var(--sp-success-bg)', color: 'var(--sp-success-strong)' }
    : tono === 'error' ? { background: 'var(--sp-danger-bg)', color: 'var(--sp-danger)' }
    : { background: 'var(--sp-surface-muted)', color: 'var(--sp-ink-500)' }
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-[var(--sp-r-pill)] px-[8px] py-[3px] text-[length:var(--sp-fs-legal)] font-bold"
      style={estilo}
    >
      {children}
    </span>
  )
}

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return renderEnTZ(iso, 'd MMM yyyy', TZ_CLINICA).toLowerCase().replace(/\./g, '')
  } catch {
    return ''
  }
}

export default function VisorDocumento({ doc, acciones, onIrAArchivos }: {
  doc: Documento
  acciones: AccionesProps
  onIrAArchivos: () => void
}) {
  const caja = useRef<HTMLDivElement>(null)

  /* Al cambiar de documento el contenedor vuelve al inicio: si no, una receta
     corta se abre a media altura porque el escrito anterior estaba desplazado. */
  useEffect(() => { caja.current?.scrollTo({ top: 0 }) }, [doc.id])

  const contenido = (doc.contenido ?? {}) as Record<string, unknown>
  const meta = metaDe(doc.tipo)
  const titulo = tituloDe(doc.tipo, contenido)
  const folio = folioVisible(doc.tipo, contenido, doc.folio)
  const esBorrador = doc.estado === 'borrador'
  /* «Emitido con firma manual» NO se rotula: es casi todo el acervo y
     etiquetarlo sería ruido. Solo hablan el borrador y el firmado. */
  const chipEstado = esBorrador ? 'Borrador' : doc.estado === 'firmado' ? 'Firmado' : null
  /* Lo único del cuerpo que se promueve a la cabecera, porque cambia cómo se
     lee todo lo demás. Solo imagenología e internamiento lo tienen. */
  const urgente = contenido.urgente === true

  return (
    /* ⚠️ EL SCROLL VIVE EN EL CUERPO, NO EN LA TARJETA, Y ESO ES LO QUE IMPIDE
       QUE EL MENÚ DE ACCIONES SE CORTE. Aquí estaban `max-h` y `overflow-y-auto`,
       o sea que la tarjeta ERA el contenedor de scroll — y un contenedor de
       scroll recorta a sus descendientes en posición absoluta, que es lo que le
       pasaba al desplegable de «⋯»: se salía por el borde y se veía a medias.
       No bastaba con quitar `overflow-x-hidden`: en cuanto un eje deja de ser
       `visible`, el otro pasa a `auto` por su cuenta y sigue recortando. La
       única salida es que el scroll no esté aquí.
       Con la cabecera FUERA del scroller ya no hace falta que sea `sticky`: no
       hay nada que la pueda desplazar. */
    <div className="flex flex-col overflow-visible rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] shadow-[var(--sp-shadow-flat)]">
      {/* ── Cabecera fija y OPACA, EN DOS LÍNEAS ─────────────────────────
          Superficie sólida, por encima del contenido en apilamiento, esquinas
          al ras y sombra mínima al pie. Una cabecera fija translúcida deja ver
          el texto pasando por debajo: es un defecto, no un efecto.

          ⚠️ EL TÍTULO TIENE LA PRIMERA LÍNEA PARA ÉL SOLO. Compartiéndola con
          fecha y folio, el grupo de identidad competía por el ancho con el de
          acciones y el título era lo que cedía — justo lo que el §6.0 del parche
          prohíbe. Con la línea entera nunca se comprime ni se trunca, y el
          orden de sacrificio del parche (folio a la franja, luego fecha corta)
          deja de hacer falta.

          ⚠️ LA SEGUNDA LÍNEA ES UN `justify-between` CON ENVOLTURA, y las dos
          cosas importan: los metadatos a la izquierda, los cuatro botones a la
          derecha, y la línea de aviso de `AccionesDocumento` —que llega en el
          mismo fragmento con `w-full` y `order-last`— cae sola a un tercer
          renglón a ancho completo. Así el aviso hace crecer el BLOQUE de
          cabecera hacia abajo y nunca la fila de controles. */}
      <div className="relative z-10 flex flex-col gap-[var(--sp-2)] border-b border-[color:var(--sp-line-divider)] bg-[var(--sp-surface)] px-[var(--sp-4)] py-[var(--sp-3-5)] shadow-[var(--sp-shadow-flat)] lg:px-[26px]">
        <h2 className="text-[length:var(--sp-fs-vitals)] font-extrabold leading-tight text-[var(--sp-ink-800)]">
          {titulo}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-x-[var(--sp-2-5)] gap-y-[var(--sp-2)]">
          {/* ⚠️ `flex-1` NO ES DECORACIÓN: ES LO QUE MANTIENE LOS BOTONES A LA
              DERECHA. Aquí había `min-w-0` a secas, o sea `flex: 0 1 auto`, y
              con eso el tamaño con el que este grupo ENTRA EN EL REPARTO es su
              ancho de contenido — el `min-width: 0` solo le deja encoger DESPUÉS,
              cuando la línea ya está formada. Así que en cuanto fecha + folio
              medían lo suficiente, la fila decidía envolver, las acciones caían
              solas a un segundo renglón y `justify-between` las dejaba a la
              IZQUIERDA. Desde ahí el desplegable de «⋯», que se ancla a
              `right-0`, se abría hacia fuera de la tarjeta.
              `flex-1` es `flex: 1 1 0%`: este grupo entra al reparto midiendo
              CERO, así que nunca provoca la envoltura, se queda el espacio que
              sobre y su propio `flex-wrap` reparte fecha, folio y chips en dos
              renglones cuando hace falta. Cede el texto, no los botones — que es
              la regla, y aguanta cualquier metadato que se añada.
              La línea de aviso de `AccionesDocumento` sigue cayendo a su propio
              renglón: llega con `w-full`, que no cabe junto a nada. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[var(--sp-2-5)] gap-y-[var(--sp-1-5)]">
            <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">{fechaCorta(doc.created_at)}</p>
            {/* Sin folio no se dibuja NADA: ni rótulo, ni guion, ni «sin folio».
                En escrito médico y en internamiento es lo normal, no una carencia. */}
            {folio && (
              <p className="text-[length:var(--sp-fs-hint)] tabular-nums text-[var(--sp-ink-350)]">{folio}</p>
            )}
            {chipEstado && <Chip tono={esBorrador ? 'aviso' : 'exito'}>{chipEstado}</Chip>}
            {urgente && <Chip tono="error">Urgente</Chip>}
            {esBorrador && (
              <span className="text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">El folio se asigna al emitirse</span>
            )}
          </div>

          <AccionesDocumento {...acciones} />
        </div>
      </div>

      {/* El cuerpo es ahora el scroller. `rounded-b` porque la tarjeta ya no
          recorta: sin él, el contenido largo pasaría por encima de la esquina
          redondeada de abajo. Un contenedor de scroll sí recorta lo SUYO, así
          que su propio radio basta. */}
      <div
        ref={caja}
        className="max-h-[470px] overflow-y-auto overflow-x-hidden rounded-b-[var(--sp-r-card)] px-[var(--sp-4)] py-[var(--sp-4)] lg:max-h-[550px] lg:px-[26px] lg:py-[var(--sp-5)]"
      >
        {/* La tabla de importes es la excepción de anchura del §2 y por eso esa
            familia no se acota: el texto corrido nunca se pasa de la medida,
            pero una tabla de tres columnas en 620 px se estrangula. */}
        <div className={meta.familia === 'importes' ? 'w-full' : MEDIDA}>
          <CuerpoDocumento doc={doc} onIrAArchivos={onIrAArchivos} />
        </div>
      </div>
    </div>
  )
}
