'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, Send, RotateCw, Share2, Trash2, Pencil, Loader2, MoreHorizontal } from 'lucide-react'

/**
 * Las acciones del visor de documentos. Aplica el §6.0 del
 * `PARCHE_ACCIONES_VISOR_DOCUMENTOS.md`, que sustituye al reparto del §6.
 *
 * ⚠️ ESCRITORIO: CUATRO BOTONES VISIBLES, SIN MENÚ. Nada queda escondido. Solo
 * el botón PRINCIPAL lleva icono + rótulo; los otros tres van cuadrados y solo
 * con icono, con tooltip y etiqueta accesible. El principal es la descarga —la
 * acción más frecuente con diferencia— salvo en un consentimiento en borrador,
 * donde lo es «Seguir editándolo» y la descarga cede a icono.
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
 * ⚠️ MÓVIL: EL MENÚ SE QUEDA. Principal y descarga visibles; las otras tres en
 * el desbordamiento, cada una con icono y rótulo, y su motivo como línea de
 * apoyo cuando están bloqueadas — en el menú sí hay sitio para texto.
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

/* Geometría del §15 con el añadido del parche: el de rótulo 32 px de alto con
   12 px laterales; los de icono 32×32 con radio 8 y glifo de 15. */
const ALTO = 'h-[32px]'
const CUADRADO = `${ALTO} w-[32px] shrink-0 inline-flex items-center justify-center rounded-[var(--sp-r-btn-sm)] border transition-colors`
const CON_ROTULO = `${ALTO} shrink-0 inline-flex items-center gap-[var(--sp-1-5)] rounded-[var(--sp-r-btn-sm)] border px-[12px] text-[length:var(--sp-fs-hint)] font-semibold transition-colors`

const NEUTRO = { borderColor: 'var(--sp-line-control)', background: 'var(--sp-surface)', color: 'var(--sp-ink-700)' }
const ACENTO = { borderColor: 'var(--sp-primary-border)', background: 'var(--sp-surface)', color: 'var(--sp-primary-text)' }
/* Inactivo: tinta terciaria sobre la misma superficie y contorno atenuado. El
   §13 exige que un control inactivo se pueda leer — de ahí `ink-350` y no un
   gris más bajo. */
const INACTIVO = { borderColor: 'var(--sp-line-soft)', background: 'var(--sp-surface)', color: 'var(--sp-ink-350)' }
const DESTRUCTIVO = { borderColor: 'var(--sp-danger-border)', background: 'var(--sp-surface)', color: 'var(--sp-danger)' }

function BotonIcono({ rotulo, icono: Icono, accion, estilo, onPreparar }: {
  rotulo: string
  icono: typeof Download
  accion: Accion
  estilo: React.CSSProperties
  /**
   * Trabajo que hay que adelantar al clic. Va en las tres señales que lo
   * preceden —puntero, foco y `pointerdown`— y NO en `onClick`: para cuando el
   * clic llega ya es tarde para esperar a una descarga.
   *
   * `pointerdown` es la red de seguridad del teclado táctil y del clic sin
   * hover; llega unos milisegundos antes que el clic, que no bastan para la
   * descarga, pero dejan el trabajo empezado para el segundo intento.
   */
  onPreparar?: () => void
}) {
  if (!accion.onClick) return null
  const bloqueada = !!accion.bloqueo
  const titulo = bloqueada ? `${rotulo} · ${accion.bloqueo}` : rotulo
  return (
    <button
      type="button"
      onClick={bloqueada || accion.ocupada ? undefined : accion.onClick}
      onPointerEnter={onPreparar}
      onPointerDown={onPreparar}
      onFocus={onPreparar}
      disabled={bloqueada || accion.ocupada}
      title={titulo}
      aria-label={titulo}
      className={CUADRADO}
      style={bloqueada ? INACTIVO : estilo}
    >
      {accion.ocupada ? <Loader2 size={15} className="animate-spin" /> : <Icono size={15} />}
    </button>
  )
}

/* ── Menú de desbordamiento (solo móvil) ────────────────────────────────── */

function Menu({ acciones, onAbrir }: {
  acciones: { rotulo: string; icono: typeof Download; accion: Accion; destructiva?: boolean }[]
  /** Abrir el menú es el gesto que PRECEDE a elegir una de sus acciones, así que
   *  es el momento de adelantar lo que alguna necesite tener listo. En móvil es
   *  el equivalente al hover que aquí no existe. */
  onAbrir?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const vivas = acciones.filter(a => a.accion.onClick)
  if (vivas.length === 0) return null

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { if (!abierto) onAbrir?.(); setAbierto(v => !v) }}
        aria-expanded={abierto}
        aria-label="Más acciones"
        className={CUADRADO}
        style={NEUTRO}
      >
        <MoreHorizontal size={15} />
      </button>
      {abierto && (
        <div
          role="menu"
          /* `max-w` como red: el panel se ancla al borde derecho de la fila y
             240 px caben incluso en la tarjeta de un teléfono de 320, pero un
             ancho fijo no debería depender de esa cuenta. Si algún día la
             tarjeta fuera más angosta, el panel encoge en vez de salirse. */
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-[240px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] shadow-[var(--sp-shadow-raised)]"
        >
          {vivas.map(({ rotulo, icono: Icono, accion, destructiva }) => {
            const bloqueada = !!accion.bloqueo
            return (
              <button
                key={rotulo}
                type="button"
                role="menuitem"
                disabled={bloqueada || accion.ocupada}
                onClick={() => { setAbierto(false); accion.onClick?.() }}
                className="flex w-full items-start gap-[var(--sp-2-5)] px-[var(--sp-3-5)] py-[var(--sp-2-5)] text-left transition-colors disabled:cursor-not-allowed"
                style={{ color: bloqueada ? 'var(--sp-ink-350)' : destructiva ? 'var(--sp-danger)' : 'var(--sp-ink-700)' }}
              >
                <span className="pt-[2px]">
                  {accion.ocupada ? <Loader2 size={15} className="animate-spin" /> : <Icono size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:var(--sp-fs-body-sm)] font-semibold">{rotulo}</span>
                  {/* En el menú sí hay sitio para el motivo como línea de apoyo. */}
                  {bloqueada && (
                    <span className="block text-[length:var(--sp-fs-legal)] leading-snug text-[var(--sp-ink-350)]">
                      {accion.bloqueo}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function AccionesDocumento(p: AccionesProps) {
  const { descarga, compartir, enviar, regenerar, eliminar, seguirEditando } = p

  /* El principal es «Seguir editándolo» cuando existe; si no, la descarga. Solo
     uno de los dos lleva rótulo. */
  const editandoEsPrincipal = seguirEditando !== null

  const descargaBloqueada =
    descarga.estado === 'preparando' ? 'Preparando descarga…'
    : descarga.estado === 'fallido' ? 'No se pudo preparar la descarga'
    : undefined

  /**
   * ⚠️ EL RÓTULO VISIBLE ES «PDF», PERO EL RÓTULO REAL SIGUE SIENDO «Descargar
   * PDF»: es el que va al `title` y al `aria-label`, así que ni el lector de
   * pantalla ni el tooltip pierden la acción. Lo que se recorta es el ancho, no
   * el significado.
   *
   * ⚠️ Y EL RÓTULO NO CAMBIA ENTRE ESTADOS, que es lo que mantiene constante el
   * ancho del grupo (§6.0 punto 4): con «Preparando descarga…» dentro del botón,
   * la fila crecía y encogía en cada documento que se abre. Los tres estados se
   * distinguen por el GLIFO —flecha, reloj girando, aspa— y sus palabras viven
   * donde sí caben:
   *   · preparando → solo en el tooltip. Dura un segundo y es transitorio:
   *     sacarlo a la línea de aviso haría saltar la cabecera cada vez.
   *   · fallido → en el tooltip Y en la línea de aviso del pie, que persiste
   *     hasta que se reintente o se cambie de documento. Ahí sí hay sitio para
   *     la frase entera.
   */
  const botonDescarga = (conRotulo: boolean) => {
    const titulo = descargaBloqueada ? `${ROTULO.descargar} · ${descargaBloqueada}` : ROTULO.descargar
    if (descarga.estado === 'listo' && descarga.href) {
      return (
        <a
          href={descarga.href}
          /* ⚠️ LA CONSTANCIA VA EN `onClick` Y NO PUEDE CONVERTIRSE EN UN `await`.
             Aquí no se auditaba nada, y era el agujero grande del registro: éste
             es el botón por el que el médico descarga a diario desde el
             expediente, mientras que el único sitio que sí auditaba —el repuesto
             del modal de documento generado— sólo se pinta donde NO hay hoja de
             compartir, o sea nunca en un teléfono. El `audit_log` recogía
             Firefox de escritorio y se perdía lo demás.
             El handler sólo dispara la petición y devuelve; la navegación del
             ancla sigue su curso en el mismo gesto. */
          onClick={descarga.onDescargar}
          title={titulo}
          aria-label={titulo}
          className={conRotulo ? CON_ROTULO : CUADRADO}
          style={ACENTO}
        >
          <Download size={15} />{conRotulo && 'PDF'}
        </a>
      )
    }
    const fallido = descarga.estado === 'fallido'
    return (
      <button
        type="button"
        disabled={!fallido}
        onClick={fallido ? descarga.onReintentar : undefined}
        title={fallido ? `${titulo} · toca para reintentar` : titulo}
        aria-label={fallido ? `${titulo} · toca para reintentar` : titulo}
        className={conRotulo ? CON_ROTULO : CUADRADO}
        style={INACTIVO}
      >
        {fallido
          ? <RotateCw size={15} />
          : <Loader2 size={15} className="animate-spin" />}
        {conRotulo && 'PDF'}
      </button>
    )
  }

  /* La línea de aviso: solo existe cuando hay al menos un bloqueo, y crece el
     bloque de cabecera hacia abajo, nunca la fila de controles. */
  const avisos = [
    descarga.estado === 'fallido' ? `${ROTULO.descargar} · ${descargaBloqueada}` : '',
    compartir.onClick && compartir.bloqueo ? `${ROTULO.compartir} · ${compartir.bloqueo}` : '',
    enviar.onClick && enviar.bloqueo ? `${ROTULO.enviar} · ${enviar.bloqueo}` : '',
    regenerar.onClick && regenerar.bloqueo ? `${ROTULO.regenerar} · ${regenerar.bloqueo}` : '',
  ].filter(Boolean)

  return (
    <>
      <div className="flex shrink-0 items-center gap-[var(--sp-2)]">
        {editandoEsPrincipal && (
          <button
            type="button"
            onClick={seguirEditando}
            title={ROTULO.editar}
            className={CON_ROTULO}
            style={ACENTO}
          >
            <Pencil size={15} /> {ROTULO.editar}
          </button>
        )}

        {botonDescarga(!editandoEsPrincipal)}

        {/* Los restantes: visibles en escritorio, dentro del menú en móvil.
            ⚠️ COMPARTIR AÑADE UN CUARTO CUADRADO A LA FILA, y el §6.0 fijaba
            «un botón con rótulo más TRES cuadrados». El invariante que protege
            ese punto es que el ancho no cambie ENTRE ESTADOS del mismo
            documento, para que la cabecera no salte al resolverse la firma —y
            eso se conserva: la presencia de compartir la decide el NAVEGADOR,
            una vez, no el documento ni su estado. Donde no hay hoja de
            compartir —todo escritorio Linux y Firefox— la fila sigue midiendo
            exactamente lo que medía.
            Sin rótulo, como los demás cuadrados: el único con rótulo sigue
            siendo uno, que es la otra mitad de aquel punto. */}
        <div className="hidden items-center gap-[var(--sp-2)] lg:flex">
          <BotonIcono rotulo={ROTULO.compartir} icono={Share2} accion={compartir} estilo={NEUTRO} onPreparar={compartir.onPreparar} />
          <BotonIcono rotulo={ROTULO.enviar} icono={Send} accion={enviar} estilo={NEUTRO} />
          <BotonIcono rotulo={ROTULO.regenerar} icono={RotateCw} accion={regenerar} estilo={NEUTRO} />
          <BotonIcono rotulo={eliminar.rotulo} icono={Trash2} accion={eliminar} estilo={DESTRUCTIVO} />
        </div>
        <div className="lg:hidden">
          <Menu
            onAbrir={compartir.onPreparar}
            acciones={[
              { rotulo: ROTULO.compartir, icono: Share2, accion: compartir },
              { rotulo: ROTULO.enviar, icono: Send, accion: enviar },
              { rotulo: ROTULO.regenerar, icono: RotateCw, accion: regenerar },
              { rotulo: eliminar.rotulo, icono: Trash2, accion: eliminar, destructiva: true },
            ]}
          />
        </div>
      </div>

      {avisos.length > 0 && (
        <p className="order-last w-full border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-2)] text-[11.5px] text-[var(--sp-warn)]">
          {avisos.join(' · ')}
        </p>
      )}
    </>
  )
}
