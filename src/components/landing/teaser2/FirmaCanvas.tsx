'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { DUR, EASE } from '@/components/landing/motion/tokens'

/**
 * Firma del Teaser 2 (§5.7, fase B). Este archivo tiene DOS piezas y ninguna
 * es un canvas incrustado en la receta, pese al nombre del archivo:
 *
 *   · `ModalFirma` (export por defecto) — el lienzo grande a pantalla completa.
 *     Lo abre el botón de la COLUMNA DE CONTROLES en `SeccionReceta.tsx`, que
 *     es también quien guarda la firma aceptada.
 *   · `TrazoFirma` — repinta una firma ya aceptada dentro de la caja que le
 *     toque. Es lo que `RecetaPapel.tsx` pone sobre la línea de firma, y es de
 *     SOLO LECTURA: la hoja muestra el resultado, no se dibuja en ella.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ LA FIRMA NUNCA SALE DE ESTE ÁRBOL. NO LO "MEJORES".
 * ═══════════════════════════════════════════════════════════════════════════
 * Es la regla 5 permanente de CLAUDE.md y la ficha §5.7 la repite. En concreto,
 * está PROHIBIDO añadir aquí o en cualquier consumidor:
 *   · `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` o cualquier llamada de
 *     red con el trazo, aunque sea "solo para guardar el borrador";
 *   · `toDataURL` / `toBlob` / `getImageData` — no aparecen NI UNA VEZ en este
 *     archivo, y esa ausencia es deliberada (ver el apartado siguiente);
 *   · Supabase, localStorage, sessionStorage, IndexedDB o cookies;
 *   · analítica del gesto (que también es el trazo).
 * El trazo vive en la memoria de la pestaña y muere al recargar. Un visitante
 * que dibuja su firma real en una landing tiene que poder confiar en eso, y es
 * además lo único coherente con lo que la propia página promete en Seguridad.
 * Si una tanda futura necesita persistirla, eso ya no es este componente: es el
 * producto, detrás del registro.
 *
 * ⚠️ POR QUÉ EL TRAZO SON PUNTOS Y NO UNA IMAGEN. Pasar la firma del lienzo
 * grande a la receta pedía mover píxeles entre dos canvas, y la vía obvia
 * —`toDataURL` en uno, `<img>` en el otro— fabrica exactamente el objeto que la
 * regla 5 teme: una cadena autocontenida con la firma dentro, trivial de
 * mandar a cualquier sitio en un refactor descuidado. Aquí NO existe esa
 * cadena: lo que cruza es un array de puntos normalizados en estado de React, y
 * cada destino lo REPINTA. De paso sale gratis lo que una imagen no daba: el
 * trazo se redibuja nítido a cualquier tamaño y a cualquier densidad.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Punto NORMALIZADO: `x` e `y` van de 0 a 1 sobre la caja donde se trazó. */
interface Punto { x: number; y: number }
type Trazo = readonly Punto[]

export interface Firma {
  readonly trazos: readonly Trazo[]
  /**
   * `ancho / alto` de la caja donde se trazó. Sin este dato la normalización a
   * 0–1 pierde la forma del gesto: el lienzo grande es casi 2.5:1 y la línea de
   * firma de la hoja es ~4.6:1, así que repintar "a caja llena" en los dos
   * sitios daría dos firmas distintas. Con la proporción, cada destino
   * reconstruye una caja de la MISMA forma y la centra.
   */
  readonly relacion: number
}

/**
 * Grosor de la pluma como fracción del ancho de la caja donde se pinta. Es EL
 * MISMO número en el lienzo grande y en la receta, así que la vista previa del
 * modal es literalmente el resultado: al encogerse la firma, la pluma se encoge
 * con ella. Calibrado sobre el destino —la caja de firma de la hoja mide ~160px
 * de ancho y ahí 0.0085 da ~1.4px, el trazo a mano alzada que la receta pedía—.
 */
const GROSOR = 0.0085

/** La caja de un canvas en CSS px, con su contexto ya escalado por densidad. */
interface Lienzo {
  ctx: CanvasRenderingContext2D
  ancho: number
  alto: number
}

/**
 * Ajusta el buffer del canvas a su tamaño real en CSS px × densidad de pantalla
 * y devuelve el contexto listo para trazar, junto con la caja medida.
 *
 * ⚠️ ESTA FUNCIÓN ES LA QUE NO CORRÍA, Y ERA LA CAUSA RAÍZ DE LOS TRES FALLOS
 * DE LA PRIMERA VERSIÓN (trazo desfasado, firma que no llegaba a la receta,
 * aspecto de "lienzo pequeño ampliado"). Se llamaba desde un `useEffect` del
 * modal, y el modal colgaba de `components/ui/Portal`, que devuelve `null` en
 * su primer render y monta los hijos en el segundo: cuando el efecto corría, el
 * canvas todavía no existía y el efecto salía sin hacer nada. El buffer se
 * quedaba en el 300×150 por defecto de HTML mientras el CSS lo estiraba a
 * ~700×250 —de ahí que el trazo cayera a ~2.3× de donde estaba el cursor— y el
 * ancho de referencia se quedaba en su semilla, con lo que los puntos se
 * guardaban en px crudos y al repintarlos caían a decenas de miles de px del
 * origen. Por eso ahora esto lo llama un CALLBACK REF, que corre en el momento
 * exacto en que el elemento se adjunta al DOM, y no un efecto que dependa del
 * orden de montaje de un ancestro.
 *
 * Escribir `width`/`height` RESETEA el contexto entero, así que la transformada
 * y los remates se ponen DESPUÉS. Se usa `setTransform` y no `scale` a
 * propósito: es idempotente, y esto se vuelve a llamar en cada cambio de tamaño.
 */
function prepararLienzo(canvas: HTMLCanvasElement): Lienzo | null {
  const caja = canvas.getBoundingClientRect()
  if (caja.width < 1 || caja.height < 1) return null
  const densidad = window.devicePixelRatio || 1
  canvas.width = Math.round(caja.width * densidad)
  canvas.height = Math.round(caja.height * densidad)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(densidad, 0, 0, densidad, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return { ctx, ancho: caja.width, alto: caja.height }
}

/** Caja de destino en CSS px sobre la que se desnormalizan los puntos. */
interface Destino { x: number; y: number; ancho: number; alto: number }

/** Desnormaliza y traza. Es el único sitio donde los 0–1 se vuelven píxeles. */
function trazar(ctx: CanvasRenderingContext2D, trazos: readonly Trazo[], destino: Destino, tinta: string): void {
  ctx.strokeStyle = tinta
  ctx.lineWidth = Math.max(1, destino.ancho * GROSOR)
  for (const trazo of trazos) {
    ctx.beginPath()
    trazo.forEach((p, i) => {
      const x = destino.x + p.x * destino.ancho
      const y = destino.y + p.y * destino.alto
      /* El `lineTo` corre también para i=0: un toque suelto es un punto, y con
         `lineCap: round` un segmento de longitud cero se pinta como tal. */
      if (i === 0) ctx.moveTo(x, y)
      ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
}

/**
 * Repinta una firma dentro de `canvas`: reconstruye una caja con la proporción
 * original, la mete entera en el destino y la centra. Lo que sobra queda en
 * blanco a los lados. Estirar para llenar convertiría la firma en otra firma.
 */
function pintarFirma(canvas: HTMLCanvasElement, firma: Firma, tinta: string): void {
  const lienzo = prepararLienzo(canvas)
  if (!lienzo) return
  const ancho = Math.min(lienzo.ancho, lienzo.alto * firma.relacion)
  const alto = ancho / firma.relacion
  trazar(
    lienzo.ctx,
    firma.trazos,
    { x: (lienzo.ancho - ancho) / 2, y: (lienzo.alto - alto) / 2, ancho, alto },
    tinta,
  )
}

/**
 * La firma ya aceptada, repintada dentro de la caja que le toque. Solo lectura:
 * ni un handler de puntero. La hoja MUESTRA la firma, no se firma en ella.
 */
export function TrazoFirma({
  firma, tinta, className,
}: { firma: Firma; tinta: string; className?: string }): React.JSX.Element {
  const lienzo = useRef<HTMLCanvasElement | null>(null)

  /* Mismo motivo que en el modal: el dimensionado NO puede depender de que un
     efecto corra después de que el elemento exista. Aquí el callback ref pinta
     en cuanto hay elemento, y el efecto de abajo solo añade el observador. */
  const montar = useCallback((canvas: HTMLCanvasElement | null): void => {
    lienzo.current = canvas
  }, [])

  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas) return
    pintarFirma(canvas, firma, tinta)
    /* La hoja escala con el ancho de su contenedor (`--rx-u` en `cqw`), así que
       cambiar el ancho de la ventana cambia esta caja y el buffer se queda
       viejo: la firma saldría borrosa y desplazada. Repintar desde los puntos es
       LOSSLESS —no hay bitmap que perder—, así que se repinta y ya.

       ⚠️ ES UN LISTENER DE `resize` Y NO UN `ResizeObserver`, A PROPÓSITO. El
       observador sería lo idiomático, pero su callback ESCRIBE EN EL ELEMENTO
       OBSERVADO (`prepararLienzo` fija `canvas.width/height`), que es la receta
       exacta del bucle observar→mutar→observar; y esta hoja es un
       `@container` cuyo tamaño depende de la maqueta, o sea justo donde ese
       bucle se realimenta. El único origen real de un cambio de tamaño aquí es
       que cambie el viewport, y eso `resize` lo da sin posibilidad de
       realimentación: redimensionar un buffer de canvas no dispara `resize`. */
    const alRedimensionar = (): void => pintarFirma(canvas, firma, tinta)
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [firma, tinta])

  /* `aria-hidden`: quien necesita saber que hay firma lo lee en el botón de los
     controles, que cambia de rótulo. Un `role="img"` aquí sería ruido dentro de
     una réplica de documento que ya es decorativa. */
  return <canvas ref={montar} aria-hidden className={`block h-full w-full ${className ?? ''}`} />
}

interface ModalFirmaProps {
  /** Color de la tinta. Lo fija la hoja, no el visitante. */
  tinta: string
  onCerrar: () => void
  onAceptar: (firma: Firma) => void
}

/**
 * El lienzo grande, superpuesto a la página. Canvas PROPIO, dimensionado a su
 * caja real: no es una vista ampliada de nada.
 *
 * ⚠️ `createPortal` DIRECTO Y NO `components/ui/Portal`. Ese componente difiere
 * el montaje de sus hijos un render (devuelve `null` hasta que su efecto pone
 * `mounted`), y ese diferido es exactamente lo que rompió la primera versión
 * —ver el aviso de `prepararLienzo`—. Aquí no hace falta: este modal solo se
 * renderiza cuando el visitante ya pulsó un botón, o sea siempre en cliente y
 * siempre con `document` disponible, así que no hay riesgo de SSR que cubrir.
 *
 * ⚠️ SIN `AnimatePresence`, Y ES UNA DECISIÓN. Tres razones, en orden de peso:
 *   1 · Una salida animada obliga a mantener montado el subárbol DESPUÉS de que
 *       el visitante lo haya cerrado, o sea a mantener vivo el lienzo con su
 *       trazo mientras el modal se desvanece, y a atar el descarte del borrador
 *       a un callback de animación. Para un control cuyo contrato entero es "el
 *       trazo muere al cerrar", desmontar en el mismo cuadro no es una
 *       simplificación: es la implementación honesta.
 *   2 · `AnimatePresence` reintroduce medición —conserva el nodo saliente para
 *       poder animarlo—, y §4.3 mantiene la landing lejos de eso.
 *   3 · Registro: esto es un CONTROL, no uno de los cuatro escenarios de §4.1.
 *       Le toca el registro Linear, y ahí una entrada de 240ms basta.
 * La entrada es un fundido de montaje con `DUR.base` / `EASE.out`, y anima SOLO
 * `opacity` (regla 2 de la landing). Ni un número fuera de tokens.
 */
export default function ModalFirma({ tinta, onCerrar, onAceptar }: ModalFirmaProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement | null>(null)
  const tituloId = useId()

  /* El borrador vive en refs y no en estado: se escribe en cada `pointermove` y
     eso son decenas de eventos por segundo (§4.3·2). Lo único que sube a estado
     es el booleano "¿hay algo dibujado?", que cambia dos veces por firma y
     gobierna si "Borrar" y "Aceptar" están disponibles. */
  const trazos = useRef<Punto[][]>([])
  const actual = useRef<Punto[] | null>(null)
  /** Caja del lienzo en CSS px. La escribe el callback ref, nunca un efecto. */
  const medida = useRef({ ancho: 0, alto: 0 })
  /** Origen del lienzo en coordenadas de viewport, fijado al empezar el trazo. */
  const origen = useRef({ x: 0, y: 0 })
  const [hayTrazo, setHayTrazo] = useState(false)

  /* `onCerrar` por ref, como en `ModalShell`: si entrara en las dependencias del
     efecto de foco, un cambio de identidad del handler lo re-ejecutaría y el
     foco saltaría al panel a media firma. */
  const cerrarRef = useRef(onCerrar)
  useEffect(() => { cerrarRef.current = onCerrar }, [onCerrar])

  /** Dimensiona el buffer en cuanto el elemento existe. Ver `prepararLienzo`. */
  const montarLienzo = useCallback((canvas: HTMLCanvasElement | null): void => {
    lienzo.current = canvas
    if (!canvas) return
    const listo = prepararLienzo(canvas)
    if (listo) medida.current = { ancho: listo.ancho, alto: listo.alto }
  }, [])

  /* Si la ventana cambia de tamaño con el modal abierto, el buffer se queda
     viejo y el trazo volvería a caer desfasado. Se redimensiona y se REPINTA lo
     que ya hubiera: los puntos están normalizados, así que no se pierde nada.
     Mismo motivo que en `TrazoFirma` para usar `resize` y no `ResizeObserver`:
     el callback escribe en el elemento que observaría. */
  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas) return
    const alRedimensionar = (): void => {
      const listo = prepararLienzo(canvas)
      if (!listo) return
      medida.current = { ancho: listo.ancho, alto: listo.alto }
      trazar(listo.ctx, trazos.current, { x: 0, y: 0, ancho: listo.ancho, alto: listo.alto }, tinta)
    }
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [tinta])

  /* ── Bloqueo del scroll de fondo ──
     Es obligatorio y no es cosmético: el modal tapa el Teaser 2, que es una
     escena ANCLADA AL SCROLL. Sin bloqueo, la rueda sobre el telón desarma la
     receta por detrás y al cerrar el visitante vuelve a otro punto de la
     coreografía. Se compensa el ancho de la barra con `padding-right` para que
     la página no salte 15px al abrir: el nav es `sticky`, o sea que va en el
     flujo del body, así que se desplaza con él y la compensación lo alcanza.
     `html` no declara `overflow`, así que el del `body` propaga al viewport. */
  useEffect(() => {
    const barra = window.innerWidth - document.documentElement.clientWidth
    const overflowPrevio = document.body.style.overflow
    const paddingPrevio = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (barra > 0) document.body.style.paddingRight = `${barra}px`
    return () => {
      document.body.style.overflow = overflowPrevio
      document.body.style.paddingRight = paddingPrevio
    }
  }, [])

  /* ── Foco atrapado + Escape ──
     El foco entra en el panel (que es `tabIndex={-1}`, para que el lector de
     pantalla anuncie el diálogo y su título) y el Tab circula entre sus botones
     habilitados. El RETORNO del foco al botón que abrió no se hace aquí sino en
     `SeccionReceta`, que es quien tiene su ref: hacerlo en la limpieza de este
     efecto obligaría a adivinar el origen con `document.activeElement`, y eso
     falla si algo más movió el foco entretanto. */
  useEffect(() => {
    const dialogo = panel.current
    if (!dialogo) return
    dialogo.focus({ preventScroll: true })

    function alPulsar(e: KeyboardEvent): void {
      if (!dialogo) return
      if (e.key === 'Escape') { cerrarRef.current(); return }
      if (e.key !== 'Tab') return
      const focos = dialogo.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (focos.length === 0) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || activo === dialogo)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [])

  function pluma(): CanvasRenderingContext2D | null {
    const ctx = lienzo.current?.getContext('2d') ?? null
    if (ctx) {
      ctx.strokeStyle = tinta
      ctx.lineWidth = Math.max(1, medida.current.ancho * GROSOR)
    }
    return ctx
  }

  /** Posición del puntero en CSS px del lienzo. El origen se mide UNA vez, al
   *  empezar el trazo: con el puntero capturado y el fondo bloqueado el lienzo
   *  no se mueve, así que medirlo en cada `pointermove` sería forzar un reflujo
   *  por evento a cambio de nada. */
  function punto(e: React.PointerEvent<HTMLCanvasElement>): Punto {
    return { x: e.clientX - origen.current.x, y: e.clientY - origen.current.y }
  }

  /** De CSS px del lienzo a 0–1. Es el único sitio donde se normaliza. */
  function normalizar(p: Punto): Punto {
    return { x: p.x / medida.current.ancho, y: p.y / medida.current.alto }
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>): void {
    /* Captura del puntero: el trazo sigue vivo aunque el dedo o el cursor se
       salgan de la caja, y el `pointerup` llega igual. Sin esto, salirse por el
       borde deja el trazo abierto y la siguiente entrada dibuja una recta desde
       el punto de salida. */
    e.currentTarget.setPointerCapture(e.pointerId)
    const caja = e.currentTarget.getBoundingClientRect()
    origen.current = { x: caja.left, y: caja.top }
    const ctx = pluma()
    if (!ctx || medida.current.ancho < 1) return
    const p = punto(e)
    actual.current = [normalizar(p)]
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    /* Un punto suelto también es tinta: un toque corto debe dejar marca. */
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hayTrazo) setHayTrazo(true)
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>): void {
    const trazo = actual.current
    if (!trazo) return
    const ctx = pluma()
    if (!ctx) return
    const p = punto(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    trazo.push(normalizar(p))
  }

  /**
   * Cierra el trazo. Lo llaman `pointerup` Y `pointercancel`, y los dos hacen lo
   * mismo A PROPÓSITO: si el gesto se cancela a media firma, lo trazado hasta
   * ahí es tinta que el visitante ya vio en pantalla: descartarlo sería borrarle
   * algo delante de los ojos. Sin tratar `pointercancel` el trazo quedaría
   * abierto y el siguiente contacto dibujaría una recta desde donde se cortó.
   *
   * La captura se suelta explícitamente. El navegador la libera solo al terminar
   * el puntero, así que esto es higiene, no necesidad — pero deja el estado del
   * elemento sin depender de esa implicitud. `hasPointerCapture` antes de soltar
   * porque `releasePointerCapture` con un `pointerId` que ya no está capturado
   * lanza `NotFoundError`, y eso sí rompería el gesto siguiente.
   */
  function terminar(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (actual.current) trazos.current.push(actual.current)
    actual.current = null
  }

  function borrar(): void {
    const canvas = lienzo.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    /* `clearRect` en coordenadas del BUFFER, no en CSS px: el contexto arrastra
       la escala por densidad, así que se deshace aquí y se repone. */
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    trazos.current = []
    actual.current = null
    setHayTrazo(false)
  }

  function aceptar(): void {
    if (!hayTrazo || medida.current.alto < 1) return
    onAceptar({
      trazos: trazos.current,
      relacion: medida.current.ancho / medida.current.alto,
    })
  }

  return createPortal(
    /* z-[100]: por encima del nav, que es `sticky z-50`. */
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : DUR.base, ease: EASE.out }}
    >
      {/* Telón. Cierra SIN aplicar, igual que Escape. Es un `div` y no un botón
          a propósito: duplicaría "Cancelar" en el recorrido de teclado sin
          añadir nada, y con el foco atrapado el teclado ya tiene salida. */}
      <div
        aria-hidden
        onClick={onCerrar}
        className="absolute inset-0 bg-[rgb(10_20_32/0.72)] backdrop-blur-sm"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-[760px] overflow-y-auto overscroll-contain rounded-2xl bg-[var(--lp-surface)] p-5 shadow-[0_32px_80px_rgb(0_0_0/0.45)] outline-none sm:p-7"
      >
        <h2 id={tituloId} className="text-[19px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--lp-ink-900)]">
          Dibuja tu firma
        </h2>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--lp-ink-500)]">
          Con el dedo o con el ratón, con todo el espacio. No sale de esta pestaña: no se guarda ni se envía a ningún lado.
        </p>

        <div className="relative mt-5 overflow-hidden rounded-xl border border-[var(--lp-border)] bg-[var(--lp-surface-sunken)]">
          {/* Línea de base, para que el trazo tenga dónde apoyarse igual que en
              la receta. Va DETRÁS del canvas y no dibujada dentro de él: así
              "Borrar" no tiene que repintarla. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-[26%] border-t border-dashed border-[var(--lp-border-strong)]"
          />
          {/* La proporción no tiene que coincidir con la de la línea de firma de
              la hoja: los puntos van normalizados y `Firma.relacion` viaja con
              ellos, así que el destino reconstruye la forma sin deformarla. Lo
              que manda aquí es que quepa un gesto de brazo: 5:2, con suelo de
              150px para que en un teléfono siga siendo dibujable. */}
          <canvas
            ref={montarLienzo}
            /* ⚠️⚠️ `touchAction` VA EN LÍNEA Y NO COMO CLASE `touch-none`. NO LO
               "LIMPIES" MOVIÉNDOLO A UNA UTILIDAD DE TAILWIND: ya estuvo así y
               era un bug de producción — en móvil el trazo se cortaba a medio
               gesto y en escritorio no pasaba nada.

               Causa: `globals.css:248` declara `* { touch-action: manipulation }`
               FUERA de toda capa, y `@import "tailwindcss"` mete TODAS las
               utilidades dentro de `@layer utilities`. En la cascada, lo no
               capado gana a lo capado sin importar la especificidad, así que
               `.touch-none` (0,1,0) perdía contra `*` (0,0,0). Medido en el
               navegador: con la clase puesta, el `touch-action` computado del
               canvas era `manipulation`. Un estilo en línea sí gana a una regla
               de autor sin `!important`, y por eso vive aquí.

               Y por qué rompía justo así: `manipulation` solo desactiva el
               doble-tap-zoom, SIGUE PERMITIENDO EL PANEO. El navegador dejaba
               pasar el `pointerdown` y los primeros `pointermove`, decidía que
               el arrastre era un scroll, se quedaba con el puntero y emitía
               `pointercancel`. `setPointerCapture` no protege de esto: la
               captura evita que el evento cambie de destino, no que el gesto
               nativo reclame el puntero. Y no se veía en escritorio porque
               `touch-action` no gobierna el ratón. */
            style={{ touchAction: 'none' }}
            className="relative block aspect-[5/2] max-h-[300px] min-h-[150px] w-full cursor-crosshair"
            onPointerDown={empezar}
            onPointerMove={seguir}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            /* El canvas no es accesible por teclado y no debe fingir que lo es:
               no hay firma que trazar sin puntero. Se anuncia como imagen con su
               descripción, y la alternativa real —"o sube una foto de tu firma"—
               está en el copy de la sección, que sí es alcanzable. */
            role="img"
            aria-label="Área para dibujar tu firma con el dedo o el ratón"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={borrar}
            disabled={!hayTrazo}
            className="text-[14px] font-semibold leading-none text-[var(--lp-ink-500)] transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-ink-900)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--lp-ink-500)]"
          >
            Borrar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-[var(--lp-border)] px-4 py-2.5 text-[14px] font-semibold leading-none text-[var(--lp-ink-700)] transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-hover-surface)]"
            >
              Cancelar
            </button>
            {/* ⚠️ `--lp-accent` (#1e5fa8) es el azul brillante; `--lp-navy`
                (#1a3a5c) el oscuro. Trampa de nombres, regla 4. */}
            <button
              type="button"
              onClick={aceptar}
              disabled={!hayTrazo}
              className="rounded-xl bg-[var(--lp-accent)] px-5 py-2.5 text-[14px] font-semibold leading-none text-white transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-navy)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--lp-accent)]"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
