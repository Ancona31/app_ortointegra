'use client'

import { useState, useRef } from 'react'
import { Download, Send, RotateCw, Share2, Trash2, Pencil, Loader2, MoreHorizontal } from 'lucide-react'
import CapaMenu, { type OpcionMenu } from '@/components/ui/CapaMenu'

/**
 * Las acciones del visor de documentos. Aplica el §6.0 del
 * `PARCHE_ACCIONES_VISOR_DOCUMENTOS.md`, que sustituye al reparto del §6.
 *
 * REDISEÑO B7 (CALMA §2, §11; maqueta `final-expediente`): a la vista, el
 * PRINCIPAL en tonal —la descarga, salvo en un consentimiento en borrador,
 * donde lo es «Seguir editándolo» y la descarga cede a icono— y «Enviar al
 * paciente» como texto; Compartir, Regenerar PDF y Eliminar van al «···»
 * («Más acciones», `CapaMenu`) en todos los formatos, con su motivo como
 * segunda línea cuando están bloqueadas.
 *
 * ⚠️ SU RÓTULO VISIBLE ES «PDF», NO «Descargar PDF». El nombre completo de la
 * acción sigue vivo en el `title` y en el `aria-label`, así que lo que se
 * recorta es el ancho y no el significado.
 *
 * ⚠️ UN SOLO BOTÓN CON RÓTULO POR DOCUMENTO. Si añades otro, la fila deja de
 * caber y el título empieza a truncarse, que es justo lo que el parche prohíbe.
 *
 * ⚠️ EL ANCHO DEL GRUPO ES CONSTANTE: un botón con rótulo más tres cuadrados.
 * Por eso el rótulo de la descarga NO cambia entre sus tres estados —los
 * distingue el glifo— y la cabecera no salta al resolverse la firma de la url.
 *
 */

export type EstadoDescarga = 'preparando' | 'listo' | 'fallido'

/** Una acción bloqueada conserva su sitio y explica por qué. */
export interface Accion {
  /** `null` = no aplica a este documento y NO SE DIBUJA. */
  onClick: (() => void) | null
  /** Motivo del bloqueo. Con motivo, se dibuja inactiva. */
  bloqueo?: string
  ocupada?: boolean
}

/**
 * Compartir con la hoja del sistema. Es una `Accion` con un añadido: el archivo
 * no está en memoria —el PDF vive en Storage— y `navigator.share` no admite un
 * `await` por delante, así que hay que traerlo ANTES del clic.
 */
export interface AccionCompartir extends Accion {
  /**
   * Empieza a traer el PDF. Se llama con las señales que PRECEDEN al clic: el
   * puntero entrando, el foco del teclado y la apertura del menú en móvil. Es
   * idempotente — se puede llamar de sobra sin coste.
   */
  onPreparar: () => void
}

export interface AccionesProps {
  descarga: {
    estado: EstadoDescarga
    href: string | null
    onReintentar: () => void
    /** Se llama al pulsar la descarga, para dejar constancia de que el documento
     *  salió. No debe bloquear nada: el ancla navega igual. */
    onDescargar: () => void
  }
  /** `onClick: null` cuando el navegador no comparte archivos: no se dibuja. */
  compartir: AccionCompartir
  enviar: Accion
  regenerar: Accion
  eliminar: Accion & { rotulo: string }
  /** Solo consentimientos en borrador; en cualquier otro documento, `null`. */
  seguirEditando: (() => void) | null
}

const ROTULO = {
  descargar: 'Descargar PDF',
  compartir: 'Compartir',
  enviar: 'Enviar al paciente',
  regenerar: 'Regenerar PDF',
  editar: 'Seguir editándolo',
} as const

/** Una opción del «···»: bloqueada se ve inactiva y explica por qué. */
function opcionDe(id: string, texto: string, icono: React.ReactNode, accion: Accion, peligro = false): OpcionMenu[] {
  if (!accion.onClick) return []
  const onClick = accion.onClick
  return [{
    id, texto, icono: accion.ocupada ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icono,
    detalle: accion.bloqueo, peligro, deshabilitada: !!accion.bloqueo || accion.ocupada, alElegir: onClick,
  }]
}

/**
 * ⚠️ EL RÓTULO VISIBLE ES «PDF», PERO EL RÓTULO REAL SIGUE SIENDO «Descargar
 * PDF»: es el que va al `title` y al `aria-label`. Y NO CAMBIA ENTRE ESTADOS:
 * los distingue el glifo —flecha, reloj girando, aspa—; «preparando» vive sólo
 * en el tooltip y «fallido» además en la línea de aviso.
 */
function BotonDescarga({ descarga, conRotulo }: { descarga: AccionesProps['descarga']; conRotulo: boolean }) {
  const bloqueo =
    descarga.estado === 'preparando' ? 'Preparando descarga…'
    : descarga.estado === 'fallido' ? 'No se pudo preparar la descarga'
    : undefined
  const titulo = bloqueo ? `${ROTULO.descargar} · ${bloqueo}` : ROTULO.descargar
  const clase = conRotulo ? 'k-b k-b-tonal' : 'k-b k-b-icono'
  if (descarga.estado === 'listo' && descarga.href) {
    /* ⚠️ LA CONSTANCIA VA EN `onClick` Y NO PUEDE CONVERTIRSE EN UN `await`: el
       handler sólo dispara la auditoría y la navegación del ancla sigue en el
       mismo gesto. */
    return (
      <a href={descarga.href} onClick={descarga.onDescargar} title={titulo} aria-label={titulo} className={clase}>
        <Download size={conRotulo ? 16 : 20} aria-hidden="true" />{conRotulo && 'PDF'}
      </a>
    )
  }
  const fallido = descarga.estado === 'fallido'
  const nombre = fallido ? `${titulo} · toca para reintentar` : titulo
  return (
    <button type="button" disabled={!fallido} onClick={fallido ? descarga.onReintentar : undefined} title={nombre} aria-label={nombre} className={clase}>
      {fallido
        ? <RotateCw size={conRotulo ? 16 : 20} aria-hidden="true" />
        : <Loader2 size={conRotulo ? 16 : 20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {conRotulo && 'PDF'}
    </button>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function AccionesDocumento(p: AccionesProps) {
  const { descarga, compartir, enviar, regenerar, eliminar, seguirEditando } = p
  const [menu, setMenu] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)

  /* El principal es «Seguir editándolo» cuando existe; si no, la descarga. */
  const editandoEsPrincipal = seguirEditando !== null

  const opciones: OpcionMenu[] = [
    ...opcionDe('compartir', ROTULO.compartir, <Share2 aria-hidden="true" />, compartir),
    ...opcionDe('regenerar', ROTULO.regenerar, <RotateCw aria-hidden="true" />, regenerar),
    ...opcionDe('eliminar', eliminar.rotulo, <Trash2 aria-hidden="true" />, eliminar, true),
  ]

  /* La línea de aviso: solo existe cuando hay al menos un bloqueo. */
  const avisos = [
    descarga.estado === 'fallido' ? `${ROTULO.descargar} · No se pudo preparar la descarga` : '',
    compartir.onClick && compartir.bloqueo ? `${ROTULO.compartir} · ${compartir.bloqueo}` : '',
    enviar.onClick && enviar.bloqueo ? `${ROTULO.enviar} · ${enviar.bloqueo}` : '',
    regenerar.onClick && regenerar.bloqueo ? `${ROTULO.regenerar} · ${regenerar.bloqueo}` : '',
  ].filter(Boolean)

  const enviarBloqueado = !!enviar.bloqueo || !!enviar.ocupada

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {editandoEsPrincipal && (
          <button type="button" onClick={seguirEditando} title={ROTULO.editar} className="k-b k-b-tonal">
            <Pencil size={16} aria-hidden="true" /> {ROTULO.editar}
          </button>
        )}
        <BotonDescarga descarga={descarga} conRotulo={!editandoEsPrincipal} />
        {enviar.onClick && (
          <button
            type="button"
            onClick={enviarBloqueado ? undefined : enviar.onClick}
            disabled={enviarBloqueado}
            title={enviar.bloqueo ? `${ROTULO.enviar} · ${enviar.bloqueo}` : ROTULO.enviar}
            className="k-b k-b-texto"
          >
            {enviar.ocupada ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            {ROTULO.enviar}
          </button>
        )}
        {opciones.length > 0 && (
          <button
            ref={ancla}
            type="button"
            /* Abrir el menú PRECEDE a elegir: es el momento de adelantar el PDF
               de compartir (en táctil no hay hover). */
            onClick={() => { if (!menu) compartir.onPreparar(); setMenu(v => !v) }}
            onPointerEnter={compartir.onPreparar}
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menu}
            className="k-b k-b-icono ml-auto"
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
        )}
      </div>
      <CapaMenu abierto={menu} alCerrar={() => setMenu(false)} ancla={ancla} titulo="Más acciones" opciones={opciones} />

      {avisos.length > 0 && (
        <p className="w-full text-[13px] leading-[18px] text-aviso-tinta">
          {avisos.join(' · ')}
        </p>
      )}
    </>
  )
}
