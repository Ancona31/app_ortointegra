'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ImagePlus, PenLine } from 'lucide-react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { DUR, EASE, OFFSETS, RECETA } from '@/components/landing/motion/tokens'
import ModalFirma, { type Firma } from '@/components/landing/teaser2/FirmaCanvas'
import RecetaPapel, { TINTA_FIRMA } from '@/components/landing/teaser2/RecetaPapel'
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
/**
 * Tipos de imagen que acepta el slot del logo.
 *
 * ⚠️ SVG ESTÁ EXCLUIDO A PROPÓSITO Y NO SE REABRE. Un SVG es un documento XML
 * que puede llevar `<script>` y manejadores de evento dentro; pintarlo en la
 * página es ejecutarlo. PNG/JPG/WebP se decodifican como píxeles y no tienen
 * esa superficie. Aquí ni siquiera hay servidor al que subirlo —el archivo no
 * sale de la pestaña—, pero el riesgo es en el navegador del visitante, que es
 * precisamente donde se abriría.
 *
 * El `accept` del input es UNA PISTA PARA EL SELECTOR, no una barrera: el
 * visitante puede elegir "todos los archivos". La comprobación real es la de
 * `alElegirLogo`.
 */
const TIPOS_LOGO: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

/** 2 MB. Un logo de membrete razonable pesa dos órdenes de magnitud menos; el
 *  tope existe para que arrastrar un RAW de 40 MB no congele la pestaña. */
const MAX_LOGO = 2 * 1024 * 1024

export default function SeccionReceta() {
  const ancla = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [paleta, setPaleta] = useState<PaletaReceta>(PALETAS[0])
  const [paso, setPaso] = useState(0)

  /* La firma vive AQUÍ y no en la hoja: el disparador está en la columna de
     controles y el destino en la columna del documento, así que el estado tiene
     que estar en el ancestro común. `RecetaPapel` la recibe y la repinta; el
     modal se la devuelve al aceptar. Son puntos normalizados, nunca una imagen
     — ver el aviso de `FirmaCanvas.tsx`, la firma no toca la red ni el disco. */
  const [firma, setFirma] = useState<Firma | null>(null)
  const [firmando, setFirmando] = useState(false)
  const disparador = useRef<HTMLButtonElement>(null)

  /* El foco vuelve al botón que abrió, y se devuelve ANTES de desmontar el
     modal: si se dejara al desmontaje, el navegador lo manda al `body` y quien
     navega con teclado reaparece al principio de la página.
     `preventScroll` NO es opcional aquí: enfocar arrastra el elemento a la
     vista, y esta escena está ANCLADA AL SCROLL —cualquier scroll que no venga
     del visitante mueve el ensamblaje de la receta por su cuenta—. Encima
     `globals.css:233` pone `scroll-behavior: smooth`, así que el salto sería
     además animado y bien visible. */
  const cerrarFirma = useCallback((): void => {
    setFirmando(false)
    disparador.current?.focus({ preventScroll: true })
  }, [])

  function aplicarFirma(nueva: Firma): void {
    setFirma(nueva)
    cerrarFirma()
  }

  /* ═══ LOGO DEL MEMBRETE ═══════════════════════════════════════════════════
     ⚠️⚠️ LA IMAGEN NUNCA SALE DE LA PESTAÑA. MISMA REGLA QUE LA FIRMA.
     Está PROHIBIDO añadir aquí o en cualquier consumidor: `fetch`,
     `XMLHttpRequest`, `sendBeacon` o cualquier subida; Supabase o cualquier
     bucket; localStorage, sessionStorage, IndexedDB o cookies; y leer el
     archivo a base64 para "guardarlo". Lo único que existe es un object URL
     —una referencia local al `File` que ya está en memoria— que se pinta como
     `background-image` y muere al recargar. El visitante que prueba el teaser
     con el logo real de su consultorio tiene que poder confiar en eso, y es lo
     único coherente con lo que la página promete en Seguridad. Si una tanda
     futura necesita persistirlo, eso es el producto, detrás del registro. */
  const [logo, setLogo] = useState<string | null>(null)
  const [errorLogo, setErrorLogo] = useState<string | null>(null)
  const idLogo = useId()
  /* El object URL vivo, en un ref y no en estado: hay que revocarlo desde sitios
     donde leer el estado daría un valor viejo (el propio reemplazo) y desde la
     limpieza de desmontaje, que con `[]` solo ve el primer render. */
  const urlLogo = useRef<string | null>(null)

  /* Revocar es OBLIGATORIO: cada `createObjectURL` ancla el `File` entero en
     memoria hasta que se suelta, así que sin esto cambiar de logo diez veces
     deja diez imágenes retenidas. Va con `[]` —solo desmontaje— y NO con
     `[logo]`: en desarrollo React monta, limpia y vuelve a montar los efectos,
     y con `[logo]` esa limpieza revocaría el URL recién creado dejando el slot
     roto solo en dev. Los reemplazos los revocan los dos handlers de abajo. */
  useEffect(() => () => {
    if (urlLogo.current) URL.revokeObjectURL(urlLogo.current)
  }, [])

  function alElegirLogo(e: React.ChangeEvent<HTMLInputElement>): void {
    const archivo = e.target.files?.[0]
    /* El value se limpia SIEMPRE y antes de cualquier return: sin esto, quitar
       el logo y volver a elegir EL MISMO archivo no dispara `change` —el value
       no cambió— y el control parece muerto. */
    e.target.value = ''
    if (!archivo) return
    if (!TIPOS_LOGO.includes(archivo.type)) {
      setErrorLogo('Ese formato no se admite. Sube un PNG, un JPG o un WebP.')
      return
    }
    if (archivo.size > MAX_LOGO) {
      setErrorLogo('La imagen pesa más de 2 MB. Prueba con una versión más ligera.')
      return
    }
    if (urlLogo.current) URL.revokeObjectURL(urlLogo.current)
    const url = URL.createObjectURL(archivo)
    urlLogo.current = url
    setLogo(url)
    setErrorLogo(null)
  }

  function quitarLogo(): void {
    if (urlLogo.current) URL.revokeObjectURL(urlLogo.current)
    urlLogo.current = null
    setLogo(null)
    setErrorLogo(null)
  }

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
              <RecetaPapel progreso={avance} paleta={paleta} firma={firma} logo={logo} />
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
                {/* El copy anterior decía "Dibújala aquí, sobre la receta" y
                    describía un canvas incrustado en la hoja que ya no existe:
                    era demasiado pequeño para trazar nada reconocible. Ahora se
                    dibuja en un lienzo grande y la hoja MUESTRA el resultado. */}
                <p className="mt-2 text-[15px] leading-[1.5] text-[var(--lp-ink-inverse-50)]">
                  Dibújala en grande y aparece en la receta — o sube una foto de tu firma.
                </p>
                {/* ═══ LOS DOS CONTROLES REALES DEL TEASER, EN UNA SOLA FILA ═══
                    Van juntos porque son la misma promesa —"este documento es
                    tuyo"— y porque compartir fila cuesta CERO altura frente a
                    apilarlos, dentro de un `sticky h-dvh` con el presupuesto de
                    arriba. Viven fuera de toda `Capa` animada, así que nunca son
                    un destino de tabulador invisible durante el ensamblaje.

                    ⚠️ JERARQUÍA DELIBERADA: la firma es PRIMARIA (relleno blanco
                    sólido) y el logo SECUNDARIO (contorno). Si los dos fueran
                    sólidos volveríamos al problema que esta tanda corrige — un
                    control principal que no se distingue de lo que tiene al
                    lado. */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {/* ── PRIMARIO · firma ──
                      Relleno blanco sobre navy: el mismo recurso del CTA final
                      (`SeccionCTA.tsx:181`), ya probado en la página.

                      ⚠️ EL PROBLEMA QUE ESTO ARREGLA NO ERA EL TEXTO, ERA LA
                      SUPERFICIE, y conviene tener los números antes de "suavizarlo":
                      el relleno anterior (blanco al 5% sobre navy, #26445f) medía
                      1.15:1 contra el fondo y su borde `--lp-border-inverse`
                      (blanco 30%, #59718a) medía 2.30:1 — POR DEBAJO del 3:1 que
                      WCAG 1.4.11 exige al contorno de un control. O sea que no
                      era solo que se perdiera: no era conforme. Ahora el relleno
                      da 11.64:1 contra el fondo y el texto `--lp-navy` sobre
                      blanco da 11.64:1 (AAA), 10.63:1 en hover sobre
                      `--lp-hover-surface`.

                      ⚠️ NI EL PADDING NI LA ALTURA SUBEN, y es intencional: con
                      `leading-none` la caja pasa de `1+10+13+10+1 = 35px` a
                      `10+15+10 = 35px` — el borde que se va paga el tipo que
                      crece. El `py-3.5` del CTA costaría +16px y el presupuesto
                      de altura de arriba no lo tiene. El icono va a 14px y no a
                      16 por lo mismo: a 16 el line box sube a 16 y la caja a 36. */}
                  <button
                    ref={disparador}
                    type="button"
                    onClick={() => setFirmando(true)}
                    aria-haspopup="dialog"
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--lp-ink-inverse)] px-5 py-2.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-navy)] shadow-lg transition-all duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-hover-surface)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-ink-inverse)]"
                  >
                    <PenLine className="w-3.5 h-3.5" aria-hidden />
                    {firma ? 'Cambiar mi firma' : 'Dibujar mi firma'}
                  </button>

                  {/* ── SECUNDARIO · logo ──
                      Input real + `<label>` con estilo de botón, y NO un botón
                      que dispare `input.click()`: así el control sigue siendo un
                      input de archivo nativo, alcanzable con Tab y anunciado por
                      el lector de pantalla con el texto del label. `sr-only` y no
                      `hidden`/`display:none` — esto último lo sacaría del orden
                      de tabulación. El anillo de foco se pinta sobre el label vía
                      `peer-focus-visible`, porque el que recibe el foco es el
                      input, que es invisible.

                      ⚠️ El contorno usa `--lp-ink-inverse` (blanco puro, 11.64:1)
                      y no `--lp-border-inverse` (blanco 30%, 2.30:1) por lo dicho
                      arriba: un contorno de control por debajo de 3:1 no es
                      conforme. Es 2px más alto que el primario por el borde; la
                      fila mide 37px. */}
                  <input
                    id={idLogo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={alElegirLogo}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={idLogo}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--lp-ink-inverse)] bg-[var(--lp-surface-inverse-10)] px-4 py-2.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-surface-inverse-5)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--lp-ink-inverse)]"
                  >
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden />
                    {logo ? 'Cambiar mi logo' : 'Subir mi logo'}
                  </label>

                  {logo ? (
                    <button
                      type="button"
                      onClick={quitarLogo}
                      className="text-[14px] font-semibold leading-none text-[var(--lp-ink-inverse-70)] underline underline-offset-4 transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-ink-inverse)]"
                    >
                      Quitar logo
                    </button>
                  ) : null}
                </div>

                {/* Solo aparece si el archivo se rechaza, así que su altura no
                    entra en el presupuesto del estado normal. Va en blanco pleno
                    y no en un rojo: la escala `--lp-*` no tiene token de error y
                    la regla de esta tanda prohíbe hex nuevos. */}
                {errorLogo ? (
                  <p role="alert" className="mt-3 text-[13px] leading-[1.45] text-[var(--lp-ink-inverse)]">
                    {errorLogo}
                  </p>
                ) : null}
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
                {/* Aquí decía "Personalízalo con tu logo — disponible al
                    registrarte". Se retira: el logo YA se puede poner aquí
                    mismo, y prometer para después algo que el visitante acaba de
                    hacer es peor que no decir nada. */}
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

      {/* El modal se monta solo cuando hace falta y se porta a `document.body`
          por su cuenta: aquí dentro estaría atrapado por el `overflow-hidden`
          de la hoja y por los `transform` que `motion` escribe en las capas. */}
      {firmando ? (
        <ModalFirma tinta={TINTA_FIRMA} onCerrar={cerrarFirma} onAceptar={aplicarFirma} />
      ) : null}
    </section>
  )
}
