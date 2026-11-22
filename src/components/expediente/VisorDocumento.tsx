'use client'

import { useEffect, useRef } from 'react'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import type { Documento } from '@/types'
import { metaDe, tituloDe, folioVisible } from '@/lib/documentos/familias'
import CuerpoDocumento from './CuerpoDocumento'
import AccionesDocumento, { type AccionesProps } from './AccionesDocumento'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'

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
    <div className="flex flex-col overflow-visible rounded-[var(--r-tarjeta)] bg-sup ih:rounded-[var(--r-tarjeta-ancha)] iv:rounded-[var(--r-tarjeta-ancha)] esc:rounded-[var(--r-tarjeta-ancha)]">
      {/* ── Cabecera (rediseño B7): el icono del tipo en su color y el título
          en una línea para él solo (nunca se comprime ni se trunca); debajo la
          fecha, el folio y como mucho dos etiquetas; y las acciones. La línea
          de aviso de `AccionesDocumento` llega en el mismo fragmento y cae
          sola a su renglón. Separada del cuerpo por una línea fina. */}
      <div className="flex flex-col gap-2 border-b border-linea px-4 pb-3 pt-4 ih:px-5 iv:px-5 esc:px-6 esc:pt-5">
        <h2 className="flex items-start gap-2 text-[20px] font-bold leading-[26px] text-tinta">
          <IconoTipoDocumento tipo={doc.tipo} className="mt-[3px]" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{titulo}</span>
        </h2>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="k-num text-[13px] leading-[18px] text-tinta2">{fechaCorta(doc.created_at)}</p>
          {/* Sin folio no se dibuja NADA: ni rótulo, ni guion, ni «sin folio».
              En escrito médico y en internamiento es lo normal, no una carencia. */}
          {folio && <p className="k-num text-[13px] leading-[18px] text-tinta2">· {folio}</p>}
          {chipEstado && <span className={esBorrador ? 'k-etq k-etq-aviso' : 'k-etq k-etq-ok'}>{chipEstado}</span>}
          {urgente && <span className="k-etq k-etq-mal">Urgente</span>}
        </div>
        {esBorrador && <p className="text-[13px] leading-[18px] text-tinta2">El folio se asigna al emitirse</p>}

        <AccionesDocumento {...acciones} />
      </div>

      {/* El cuerpo es ahora el scroller. `rounded-b` porque la tarjeta ya no
          recorta: sin él, el contenido largo pasaría por encima de la esquina
          redondeada de abajo. Un contenedor de scroll sí recorta lo SUYO, así
          que su propio radio basta. */}
      <div
        ref={caja}
        className="max-h-[470px] overflow-y-auto overflow-x-hidden rounded-b-[inherit] px-4 py-4 ih:px-5 iv:px-5 esc:max-h-[550px] esc:px-6 esc:py-5"
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
