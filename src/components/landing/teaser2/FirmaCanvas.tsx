'use client'

import { useEffect, useRef, useState } from 'react'

interface FirmaCanvasProps {
  /** Color de la tinta. Lo fija la hoja, no el visitante. */
  tinta: string
  className?: string
}

/**
 * Canvas de firma del Teaser 2 (§5.7, fase B). Vive DENTRO de la hoja, sobre la
 * línea de firma: lo que el visitante traza aparece en la receta misma, que es
 * lo que la ficha pide con "se entinta en la receta".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ LA FIRMA NUNCA SALE DE ESTE COMPONENTE. NO LO "MEJORES".
 * ═══════════════════════════════════════════════════════════════════════════
 * Es la regla 5 permanente de CLAUDE.md y la ficha §5.7 la repite. En concreto,
 * está PROHIBIDO añadir aquí o en cualquier consumidor:
 *   · `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` o cualquier llamada de
 *     red con el trazo, aunque sea "solo para guardar el borrador";
 *   · `toDataURL` / `toBlob` / `getImageData` fuera de este archivo — el canvas
 *     no se expone por ref hacia arriba, y por eso el componente no acepta un
 *     `ref` ni devuelve nada;
 *   · Supabase, localStorage, sessionStorage, IndexedDB o cookies;
 *   · analítica del gesto (que también es el trazo).
 * El trazo vive en la memoria de la pestaña y muere al recargar. Un visitante
 * que dibuja su firma real en una landing tiene que poder confiar en eso, y es
 * además lo único coherente con lo que la propia página promete en Seguridad.
 * Si una tanda futura necesita persistirla, eso ya no es este componente: es el
 * producto, detrás del registro.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No usa `motion`: no hay animación que coreografiar, hay un gesto que atender.
 */
export default function FirmaCanvas({ tinta, className }: FirmaCanvasProps): React.JSX.Element {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const trazando = useRef(false)
  const [hayTrazo, setHayTrazo] = useState(false)

  /* Ajuste del buffer al tamaño real en CSS px × densidad de pantalla. Sin
     esto, el canvas usa su tamaño por defecto (300×150) estirado por CSS y el
     trazo sale borroso y desplazado respecto al dedo.
     Solo al montar: un `ResizeObserver` re-escalaría el buffer y eso BORRA lo
     dibujado, así que al girar el teléfono con una firma hecha se perdería.
     El precio es que tras un giro el trazo queda estirado hasta que se borre;
     es el menor de los dos males y se prefiere conscientemente. */
  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas) return
    const caja = canvas.getBoundingClientRect()
    const densidad = window.devicePixelRatio || 1
    canvas.width = Math.round(caja.width * densidad)
    canvas.height = Math.round(caja.height * densidad)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(densidad, densidad)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function contexto(): CanvasRenderingContext2D | null {
    const ctx = lienzo.current?.getContext('2d') ?? null
    if (ctx) {
      ctx.strokeStyle = tinta
      /* 1.8px: una firma a mano alzada en una caja de ~200px. Más fino se
         rompe en las curvas rápidas; más grueso se lee como rotulador. */
      ctx.lineWidth = 1.8
    }
    return ctx
  }

  function punto(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const caja = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caja.left, y: e.clientY - caja.top }
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>): void {
    const ctx = contexto()
    if (!ctx) return
    /* Captura del puntero: el trazo sigue vivo aunque el dedo o el cursor se
       salgan de la caja, y el `pointerup` llega igual. Sin esto, salirse por el
       borde deja `trazando` en true y la siguiente entrada dibuja una recta
       desde el punto de salida. */
    e.currentTarget.setPointerCapture(e.pointerId)
    trazando.current = true
    const p = punto(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    /* Un punto suelto también es tinta: un toque corto debe dejar marca. */
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hayTrazo) setHayTrazo(true)
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!trazando.current) return
    const ctx = contexto()
    if (!ctx) return
    const p = punto(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function terminar(): void {
    trazando.current = false
  }

  function borrar(): void {
    const canvas = lienzo.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    /* `clearRect` en coordenadas del BUFFER, no en CSS px: el contexto arrastra
       el `scale(densidad)` del montaje, así que se deshace aquí y se repone. */
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHayTrazo(false)
  }

  return (
    <div className={className}>
      <canvas
        ref={lienzo}
        /* `touch-none` (touch-action: none) es OBLIGATORIO y no es cosmético:
           sin él, arrastrar el dedo sobre el canvas hace scroll de la página y
           firmar en móvil es imposible. Es también la razón de que la fase B
           empiece cuando el ensamblaje ha terminado — no se puede firmar
           mientras se scrollea (§5.7). */
        className="block w-full h-full touch-none cursor-crosshair"
        onPointerDown={empezar}
        onPointerMove={seguir}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        /* El canvas no es accesible por teclado y no debe fingir que lo es: no
           hay firma que trazar sin puntero. Se anuncia como imagen con su
           descripción, y la alternativa real —"o sube una foto de tu firma"—
           está en el copy de al lado, que sí es alcanzable. */
        role="img"
        aria-label="Área para dibujar tu firma con el dedo o el ratón"
      />
      {hayTrazo ? (
        <button
          type="button"
          onClick={borrar}
          className="absolute -bottom-5 right-0 text-[10px] font-semibold text-[var(--lp-ink-500)] hover:text-[var(--lp-ink-900)] transition-colors duration-[var(--sp-dur-micro)]"
        >
          Borrar
        </button>
      ) : null}
    </div>
  )
}
