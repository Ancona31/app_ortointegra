'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { DUR, EASE, OFFSETS, RECETA } from '@/components/landing/motion/tokens'
import RecetaPapel from '@/components/landing/teaser2/RecetaPapel'
import { FORMATOS, PALETAS, type PaletaReceta } from '@/components/landing/teaser2/receta-demo'

/* ═══ §5.7 · TEASER 2 — ESCENARIO ANCLADO QUE ENTREGA EL CONTROL (F3) ═══
   Es el único elemento interactivo real de la landing: el visitante firma con
   el dedo, cambia el color del membrete y escanea el QR con su propio teléfono.
   Registro Apple (§4.1): un foco, tramos largos, ligado al scroll.

   ⚠️ LA SUPERFICIE ES NAVY, Y NO ES UN CAPRICHO — ES LA ÚNICA QUE CONSERVA LA
   ALTERNANCIA. La sección entra entre Expediente (`--lp-surface`, blanco) y
   Portabilidad (`--lp-surface-alt`), y las dos opciones obvias chocan: en
   blanco repite la superficie de la que viene, y en `alt` repite la de la que
   sigue. Con navy la cadena queda blanco → navy → alt, sin dos superficies
   iguales seguidas. Y hay razón de diseño, no solo de aritmética: lo que se
   enseña es una HOJA DE PAPEL BLANCA, y sobre un fondo oscuro se lee como un
   documento sobre una mesa —bordes, sombra y el foco único que pide §4.1—
   mientras los controles de al lado se leen como lo que son, controles y no
   documento. §3.4 ya tiene precedente de franja navy a ancho completo (fila 4,
   bloque IA) y no es contigua, así que ningún esqueleto se repite seguido.

   ⚠️ EL ANCLAJE EXISTE DE `lg` PARA ARRIBA, NO DE `sm`. Debajo no hay 260vh ni
   `sticky`: el ensamblaje avanza por TOQUE en 5 pasos (§5.7). La diferencia se
   resuelve en CLASES y en un `ref`, NUNCA ramificando el render (§4.3·7) — el
   árbol es idéntico en servidor y cliente y lo único que cambia es quién
   escribe el progreso.

   ⚠️ EL CORTE ES `lg` Y NO `sm` POR UNA MEDICIÓN, aunque §5.2 defina "móvil"
   como el estado previo a `sm`. La retícula de esta escena pasa a UNA columna
   por debajo de `lg`, y ahí la hoja (hasta 673px de alto) y los controles
   (~600px) se apilan: 1 300px de contenido dentro de un `sticky h-dvh` que como
   mucho mide el alto del viewport. En una tablet vertical, anclar significaría
   servir la mitad de la escena fuera de cuadro y sin forma de alcanzarla. El
   anclaje solo tiene sentido donde existen las dos columnas, y eso es `lg`.
   El conductor del progreso usa EL MISMO umbral: si se separan, el visitante
   se queda en una escena que no avanza ni con scroll ni con el dedo. */
export default function SeccionReceta() {
  const ancla = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [paleta, setPaleta] = useState<PaletaReceta>(PALETAS[0])
  const [paso, setPaso] = useState(0)

  /* UN SOLO valor de avance para toda la escena (§4.3·4): las quince capas de
     la hoja derivan de él con `useTransform`. NUNCA pasa por estado de React
     (§4.3·2) — `setPaso` de abajo se dispara cinco veces en toda la vida de la
     página, no una vez por cuadro. */
  const avance = useMotionValue(0)
  const { scrollYProgress } = useScroll({ target: ancla, offset: [...OFFSETS.anclado] })

  /* Quién manda: el scroll (escritorio) o el dedo (móvil). Va en un `ref` y se
     resuelve DESPUÉS de montar, así que no toca el primer render y no puede
     provocar hydration mismatch. Se mantiene al vuelo con `change` para que
     girar la tablet no deje la escena con el conductor equivocado. */
  const mandaElScroll = useRef(false)
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 64rem)')
    mandaElScroll.current = consulta.matches
    const alCambiar = (e: MediaQueryListEvent): void => { mandaElScroll.current = e.matches }
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (mandaElScroll.current) avance.set(v)
  })

  /* Los 5 pasos táctiles recorren los MISMOS tramos que el scroll: cada toque
     lleva el avance al final de un beat. No es una versión reducida de la
     coreografía, es la misma con otro conductor. */
  function siguientePaso(): void {
    const i = Math.min(paso, RECETA.pasos.length - 1)
    void animate(avance, RECETA.pasos[i], reducedMotion ? { duration: 0 } : { duration: DUR.section, ease: EASE.out })
    setPaso(i + 1)
  }

  return (
    <section className="bg-[var(--lp-navy)]">
      {/* 260vh es el alto de §5.7 y va como clase, no como token: es geometría
          de maqueta, del mismo tipo que los `py-*` de §3.3, y `tokens.ts` es el
          espejo de los valores que consume `motion`. */}
      <div ref={ancla} className="lg:h-[260vh]">
        {/* `h-dvh` y no `h-screen` (§4.3·10). El `sticky` solo existe de `lg`
            para arriba: debajo, el bloque fluye y lo gobiernan los toques. */}
        <div className="lg:sticky lg:top-0 lg:h-dvh flex items-center">
          {/* ═══ EL JSX VA EN ORDEN DE LECTURA MÓVIL, LA MAQUETA DE ESCRITORIO
                  SE ARMA CON COLOCACIÓN — la lección de a4 en Expediente ═══
              En una columna se lee kicker → titular → bajada → HOJA →
              controles: el visitante tiene que saber qué está mirando ANTES de
              que aparezca un documento que se arma solo. Es literalmente el
              mismo argumento que `SeccionExpediente.tsx:77` da para el video.

              ⚠️ AQUÍ NO BASTA `order-*`, Y NO ES POR GUSTO. Con tres hijos en
              dos columnas, `order` solo reordena la secuencia y el
              auto-emplazamiento los reparte 1→(f1,c1), 2→(f1,c2), 3→(f2,c1):
              los controles caerían bajo la hoja. Hace falta colocación
              explícita (`col-start` / `row-start`). El principio de a4 se
              respeta igual y es el que importa: **el DOM queda en orden de
              lectura y es la maqueta la que se mueve**, nunca al revés.

              ⚠️ LAS FILAS SON `[1fr_auto_auto_1fr]` PARA QUE EL BLOQUE DERECHO
              SIGA CENTRADO. Con dos filas (`auto_1fr`) el encabezado se pega
              al techo de la hoja y en pantallas altas deja un hueco muerto
              abajo; las dos filas `1fr` de los extremos se reparten el
              sobrante y el par encabezado+controles queda centrado contra la
              hoja, que es como se veía antes de esta corrección. */}
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-16 lg:py-10 grid lg:grid-cols-[6fr_5fr] lg:grid-rows-[1fr_auto_auto_1fr] gap-x-10 lg:gap-x-14">

            {/* ═══ ENCABEZADO — primero en móvil, columna derecha en lg ═══ */}
            <div className="lg:col-start-2 lg:row-start-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-ink-inverse-70)]">
                Receta con QR verificable
              </p>
              {/* ⚠️ EL TITULAR NO USA EL clamp DE 46px DE LOS DEMÁS h2 Y LA
                  COLUMNA VA APRETADA A PROPÓSITO. Esta es la única sección que
                  vive dentro de un `sticky h-dvh`: lo que no quepa en el alto
                  del viewport no se puede alcanzar scrolleando, porque el
                  scroll está gobernando el ensamblaje. Medido con la retícula
                  de `lg` (columna de ~436px a 1024 de ancho), encabezado y
                  controles suman ~600px; con el `py-10` de la escena eso deja
                  fondo hasta un viewport de 700px de alto. Cada línea de copy
                  que se añada sale de ese presupuesto — no es una sección
                  normal. */}
              <h2 className="mt-3 text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] leading-[1.08] text-[var(--lp-ink-inverse)]">
                Membretada, firmada
                <br className="hidden sm:block" /> y verificable
              </h2>
              <p className="mt-4 text-[19px] tracking-[-0.01em] leading-[1.55] text-[var(--lp-ink-inverse-70)]">
                Se arma con lo que escribiste en la consulta. El membrete, el folio y el QR salen solos.
              </p>
            </div>

            {/* ═══ EL DOCUMENTO (§3.4 fila 7) ═══
                El ancho de la hoja lo manda el ALTO disponible, no el ancho de
                la columna: una hoja carta es 612×792, así que a 74dvh de alto
                le tocan 74dvh × 612/792 de ancho. Sin esto, en una pantalla
                apaisada la hoja se sale por abajo del `h-dvh` y el pie —QR y
                firma, o sea la mitad interactiva— queda fuera de cuadro. */}
            <div className="mt-8 lg:mt-0 mx-auto w-full max-w-[520px] lg:max-w-[min(520px,calc(74dvh*612/792))] lg:col-start-1 lg:row-start-1 lg:row-span-4 lg:self-center">
              <RecetaPapel progreso={avance} paleta={paleta} />
              {/* Botón de paso — SOLO móvil, y desaparece al completar. Bajo
                  `prefers-reduced-motion` lo esconde `globals.css`: ahí la hoja
                  ya se sirve armada y este control no gobernaría nada. */}
              {paso < RECETA.pasos.length ? (
                <button
                  type="button"
                  data-lp-paso=""
                  onClick={siguientePaso}
                  className="lg:hidden mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lp-surface-inverse-10)] border border-[var(--lp-border-inverse)] px-7 py-3.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] active:scale-[0.97] transition-transform duration-[var(--sp-dur-micro)]"
                >
                  Armar la receta · paso {paso + 1} de {RECETA.pasos.length}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* ═══ LOS CONTROLES — al final en móvil, bajo el encabezado en lg ═══ */}
            <div className="mt-10 lg:mt-8 lg:col-start-2 lg:row-start-3">
              {/* ── Firma ── */}
              <div>
                <p className="text-[17px] font-semibold leading-[1.5] text-[var(--lp-ink-inverse)]">
                  Configura tu firma una vez. Se estampa sola en todos tus documentos.
                </p>
                <p className="mt-2 text-[15px] leading-[1.5] text-[var(--lp-ink-inverse-50)]">
                  Dibújala aquí, sobre la receta — o sube una foto de tu firma.
                </p>
              </div>

              {/* ── Color del membrete ── */}
              <div className="mt-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--lp-ink-inverse-70)]">
                  Color del membrete
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {PALETAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaleta(p)}
                      aria-pressed={p.id === paleta.id}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold leading-none transition-colors duration-[var(--sp-dur-micro)] ${
                        p.id === paleta.id
                          ? 'border-[var(--lp-ink-inverse)] text-[var(--lp-ink-inverse)] bg-[var(--lp-surface-inverse-10)]'
                          : 'border-[var(--lp-border-inverse)] text-[var(--lp-ink-inverse-70)] hover:bg-[var(--lp-surface-inverse-5)]'
                      }`}
                    >
                      {/* Dos mitades: el navy manda en las barras y el acento en
                          los detalles, que es exactamente lo que re-tiñen. */}
                      <span
                        aria-hidden
                        className="w-5 h-5 rounded-full overflow-hidden flex"
                        style={{ boxShadow: '0 0 0 1px rgb(255 255 255 / .25)' }}
                      >
                        <span className="w-1/2 h-full" style={{ background: p.navy }} />
                        <span className="w-1/2 h-full" style={{ background: p.acento }} />
                      </span>
                      {p.nombre}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-[1.45] text-[var(--lp-ink-inverse-50)]">
                  Personalízalo con tu logo — disponible al registrarte.
                </p>
              </div>

              {/* ── Los otros 7 formatos ── */}
              <div className="mt-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--lp-ink-inverse-70)]">
                  y estos 7 más
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {FORMATOS.map((formato) => (
                    <li
                      key={formato}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--lp-border-inverse)] bg-[var(--lp-surface-inverse-5)] px-2.5 py-1.5 text-[12px] leading-none text-[var(--lp-ink-inverse-70)]"
                    >
                      {/* Miniatura: una hoja con su franja de membrete. Estática
                          (§5.7) y `aria-hidden` — el nombre de al lado ya dice
                          qué es, y un icono repetido siete veces solo añadiría
                          ruido a un lector de pantalla. */}
                      <span aria-hidden className="w-3 h-4 rounded-[2px] bg-[var(--lp-ink-inverse)] opacity-80 flex flex-col overflow-hidden">
                        <span className="h-[3px] w-full" style={{ background: paleta.navy }} />
                      </span>
                      {formato}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA sembrado en línea, sin bloque (§3.4). */}
              <Link
                href="/register"
                className="group mt-6 inline-flex items-center gap-2 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] underline underline-offset-4 decoration-[var(--lp-border-inverse)] hover:decoration-[var(--lp-ink-inverse)] transition-colors duration-[var(--sp-dur-micro)]"
              >
                Empieza gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-[var(--sp-dur-micro)]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
