'use client'

import { useRef } from 'react'
import { Search, Zap, FolderOpen, QrCode, Layers } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Parallax from '@/components/landing/motion/Parallax'
import Reveal from '@/components/landing/motion/Reveal'
import Stagger, { VARIANTES_ITEM } from '@/components/landing/motion/Stagger'
import { DUR, EASE } from '@/components/landing/motion/tokens'

/* Section: Expediente electrónico
   Superficie BLANCA (§3.1). El `bg-white` va EXPLÍCITO, no por ausencia de
   clase: la alternancia es un sistema y debe leerse en el código.
   ⚠️ EL MOTIVO EXTRA QUE ESTE COMENTARIO DABA YA NO EXISTE. Decía que el
   blanco "protege al panel de la izquierda: su #f8fafc contra franja #f5f8fc
   daría 1.02:1 e invertido". Ese panel era el mini-mockup dibujado a mano, y
   murió al montar el Video 1 (LP-DT-13 cerrada). El video trae su propio
   fondo, así que la superficie de la sección ya no lo condiciona.
   La alternancia SÍ sigue mandando: Features (blanca) → IA (franja) → esta
   (blanca). No la toques por haber perdido el segundo argumento. */
export default function SeccionExpediente() {
  /* Un solo `useReducedMotion` para la sección, sin ramificar el render
     (§4.3·7). Ver `Reveal.tsx`. */
  const sinMovimiento = useReducedMotion()
  const transicionItem = sinMovimiento
    ? { duration: 0 }
    : { duration: DUR.section, ease: EASE.out }

  const video = useRef<HTMLVideoElement>(null)

  /* Al terminar vuelve al PRIMER fotograma y se queda ahí, parado. No es un
     bucle: `loop` sigue fuera y el elemento queda en pausa: rebobinar no
     reanuda.
     ⚠️ ESTO SUSTITUYE AL CONGELADO EN EL ÚLTIMO FOTOGRAMA, que se leía como
     que el video se había atascado. El precio está asumido y es real: en
     reposo se ve la LISTA DE PACIENTES, no el expediente abierto, así que la
     imagen fija que sustituye al mockup eliminado ya no es el final del
     recorrido sino su principio. Se acepta porque el fotograma inicial es la
     afordancia correcta para el clic de repetición —dice "esto empieza aquí"—
     mientras que un final congelado dice "esto ya pasó". */
  const alTerminar = (): void => {
    if (video.current) video.current.currentTime = 0
  }

  const repetir = (): void => {
    if (!video.current) return
    video.current.currentTime = 0
    void video.current.play()
  }

  return (
    <section className="bg-[var(--lp-surface)]">
      {/* ═══ EL SANGRADO IZQUIERDO SE RETIRÓ — NO LO REPONGAS ═══
          Existió durante una tanda y se quitó al ver el render. El motivo no es
          de gusto y conviene entenderlo antes de intentarlo otra vez:

          **EL BORDE IZQUIERDO ES EL BORDE DE LECTURA.** Las catorce secciones
          arrancan su contenido en la misma x, y esa columna invisible es lo
          que sostiene el ritmo de la página entera. Sangrar por la izquierda
          la rompe en un solo sitio, y el ojo lo lee como sección descuadrada
          antes de leerlo como recurso. El hero SÍ puede sangrar porque lo hace
          por la DERECHA, donde no hay nada que alinear.
          Corolario para futuras tandas: el sangrado es un recurso de borde
          derecho en esta landing. No es simétrico.

          ⚠️ Y CON ÉL SE VA EL `calc(100vw…)`, que era el único punto de esta
          sección donde el scroll horizontal era siquiera discutible. El
          contenedor vuelve a ser `mx-auto max-w-6xl px-4 sm:px-8`: ancho
          = min(1152, viewport), centrado, con el padding DENTRO de la caja.
          No puede exceder el viewport en ningún ancho, y ya no depende de si
          el navegador cuenta la barra de scroll dentro de `100vw`.

          El ancho que el sangrado daba se recupera por el REPARTO de la
          retícula, ver abajo. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* §3.4: dos columnas invertidas — medio a la izquierda, texto a la
            derecha. La inversión va con order-*, NO moviendo el JSX: en móvil
            (una columna) debe seguir leyéndose texto → medio.
            ⚠️ EL MOTIVO CAMBIÓ AL MONTAR EL VIDEO, EL ORDEN NO. Antes era
            "para no abrir la sección con una UI falsa (LP-DT-13)"; ya no hay
            UI falsa. El orden se mantiene porque en móvil el texto tiene que
            dar contexto ANTES de que aparezca un video que empieza a moverse
            solo — si abre el medio, el visitante ve movimiento sin saber de
            qué le están hablando. */}
        {/* F1.3·c3 — `lg:gap-24` (96), no gap-20: 80 no está en la escala de
            §3.3. Las tres secciones de dos columnas (esta, Interfaz e
            Historia) comparten el mismo par `gap-12 lg:gap-24`. */}
        {/* §5.6 · F2.a·a1 — EL `<Reveal>` ES LA RETÍCULA, no un envoltorio.
            Toma las clases del grid tal cual (7.1 de la auditoría de F2.a):
            así el `order-*` de las dos columnas sigue resolviendo contra un
            padre `grid` directo. Si esto se envolviera en vez de sustituirse,
            el grid pasaría a ser nieto y la inversión de columnas de §3.4·6
            se rompería sin error de build.
            §5.6 pide además `Parallax` en el título — eso es a4, y anida
            dentro de este reveal. Las 4 viñetas de :53 reciben su `Stagger`
            en a2, también anidado. */}
        {/* ═══ REPARTO 5:4 A FAVOR DEL VIDEO, Y `items-start` ═══
            Dos cambios sobre el par que esta sección compartía con Interfaz e
            Historia (`lg:grid-cols-2 … items-center`, F1.3·c3), los dos con
            motivo propio:

            · `lg:grid-cols-[5fr_4fr]` — recupera el ancho que daba el sangrado
              sin salirse del contenedor. A 1088 de contenido y 96 de hueco, el
              video pasa de 496 a **551px** y el texto queda en 441. No estrecha
              nada útil: la bajada ya está capada a `max-w-lg` (512px), así que
              441 solo le cambia dónde parte la línea. Retículas arbitrarias ya
              son práctica en esta landing — ver `SeccionControl.tsx:163`
              (`lg:grid-cols-[1fr_300px]`).
              Si alguna vez hace falta MÁS ancho, la palanca siguiente es el
              hueco (`lg:gap-24` → `gap-12` daría 578) y no el reparto: por
              debajo de 4fr el texto empieza a apelmazarse de verdad.

            · `items-start` en vez de `items-center` — ESTE es el desajuste que
              se veía. El video mide 351px de alto (551 ÷ 1.5667) y la columna
              de texto ronda los 530: centrados, el video flotaba ~90px por
              debajo del kicker y el bloque se leía torcido. Alineados por
              arriba, video y texto arrancan en la misma línea.
              Interfaz e Historia se quedan en `items-center` a propósito: allí
              las dos columnas tienen alturas parecidas y centrar es correcto.
              La divergencia es de esta sección, no del sistema.

            Por debajo de `lg` la retícula es de una columna, así que ninguno de
            los dos cambios toca el móvil. */}
        <Reveal className="grid lg:grid-cols-[5fr_4fr] gap-12 lg:gap-24 items-start">
          {/* ═══ §5.6 · F2.a·a4 — PARALLAX DE LA COLUMNA DE TEXTO ═══
              Se mueve la columna ENTERA contra la del mockup, que es el
              parallax de dos columnas de manual: la profundidad nace de que las
              dos mitades viajen a distinta velocidad. Un `Parallax` sobre el
              `<h2>` suelto era inviable —chocaba con su bajada, a `mt-6`— y
              mover el bloque de titular tampoco servía aquí: dejaba las viñetas
              (`mt-8` = 32px) en el camino. Con la columna entera no queda
              ningún hueco interno que violar.
              ⚠️ EL `Parallax` TOMA EL `order-*`, NO LO ENVUELVE, y aquí no es
              estilo sino obligación: `order` solo actúa sobre un hijo directo
              de la retícula. Envolviendo, la inversión de columnas de §3.4·6 se
              rompería en `lg` sin error de build. */}
          <Parallax className="order-1 lg:order-2">
            {/* F1.3·e3 — pastilla de kicker unificada: --lp-accent-bg / --lp-accent.
                Cambio de hex literal a variable; el color no se mueve. */}
            <div className="inline-flex items-center gap-2 bg-[var(--lp-accent-bg)] rounded-full px-3.5 py-1 mb-6">
              <FolderOpen className="w-3.5 h-3.5 text-[var(--lp-accent)]" />
              {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
              <span className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none">Expediente electrónico</span>
            </div>
            {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
                1.10. Ver SeccionFeatures.tsx. */}
            <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.03em] leading-[1.10]">
              El expediente que se adapta a tu ritmo,
              <br className="hidden sm:block" />
              <span className="text-[var(--lp-ink-500)]">no al revés</span>
            </h2>
            {/* F1.3·d3 — rol bajada: 19px · -0.01em · 1.55. Ver SeccionHero.tsx. */}
            <p className="mt-6 text-[19px] text-[var(--lp-ink-500)] max-w-lg tracking-[-0.01em] leading-[1.55]">
              Diseñado para que captures la información clínica en el menor número de clics posible. Notas médicas, laboratorios, imagen, recetas y consentimientos — todo vinculado al mismo paciente, accesible al instante.
            </p>
            {/* F1.3·e4 — LAS CUATRO VIÑETAS ERAN DE CUATRO COLORES distintos
                (amber-500, violet-500, sky-500, emerald-500). Pasan todas a
                --lp-accent por §3.1: los semánticos solo se usan cuando
                representan un dato real, y aquí no había dato — son cuatro
                elementos del mismo rango en una misma lista, y el color no los
                distinguía por nada. De paso cierra un hueco de contraste: los
                cuatro caían entre 2.04:1 y 4.21:1, todos por debajo del 3:1 de
                gráfico informativo salvo uno. En acento dan 6.45:1.
                NO CONFUNDIR con las 3 barras del timeline de abajo (:100-102),
                que sí son semánticas y sí sobreviven. */}
            {/* §5.6 · viñetas — `STAGGER.siblings` (70ms) por defecto: son
                cuatro hermanas del mismo rango, no una secuencia. Anida DENTRO
                del `<Reveal>` que a1 puso en la retícula, no lo sustituye: el
                reveal trae la columna entera y estas cuatro caen en cascada
                dentro. */}
            <Stagger className="mt-8 space-y-4">
              {[
                { icon: <Zap className="w-4 h-4 text-[var(--lp-accent)]" />, text: 'Nota médica que la IA estructura — tú validas y firmas' },
                { icon: <Search className="w-4 h-4 text-[var(--lp-accent)]" />, text: 'Búsqueda rápida — ⌘K / Ctrl+K, encuentra cualquier paciente al instante' },
                { icon: <Layers className="w-4 h-4 text-[var(--lp-accent)]" />, text: 'Guarda los cortes clave del estudio y ábrelos con el visor integrado' },
                { icon: <QrCode className="w-4 h-4 text-[var(--lp-accent)]" />, text: 'QR verificable en cada receta' },
              ].map((item) => (
                <motion.div
                  key={item.text}
                  data-lp-reveal=""
                  variants={VARIANTES_ITEM}
                  transition={transicionItem}
                  className="flex items-start gap-3"
                >
                  {/* `-mt-0.5` = −2px: alineación ÓPTICA del cuadro de icono
                      contra la primera línea de texto, no ritmo. Excluido de
                      §3.3 por decisión de PM (c1) y ratificado en c3. No lo
                      subas a 8 ni lo reportes como fuera de escala.

                      F1.3·d4 — CAMBIÓ DE SIGNO, y el motivo importa. Era
                      `mt-0.5` (+2px), calibrado cuando el texto iba a 14px con
                      `leading-relaxed` (lh 22.75). d3 lo pasó a 17px/1.65
                      (lh 28.05) y eso movió el centro de la primera línea 2.6px
                      hacia abajo, invalidando la calibración.

                      Medido a 390 y 1440 con el +2px puesto: el centro de la
                      primera línea quedaba 4.0px POR ENCIMA del centro del
                      cuadro, en las 7 filas de las dos secciones. Es decir el
                      +2px empujaba el icono en la dirección contraria a la que
                      corrige — con `mt-0` el desfase habría sido 2px, con +2px
                      fue 4.

                      Geometría: cuadro de 32 (centro en 16), primera línea de
                      28.05 (centro en 14.03) → el cuadro debe subir 1.97px.
                      −2px deja el desfase en 0.03px. Si una tanda futura toca
                      el tamaño o el leading del cuerpo, ESTE VALOR HAY QUE
                      RECALCULARLO: no es una constante, es función de
                      (alto de cuadro − line-height) / 2. */}
                  <div className="w-8 h-8 rounded-lg bg-[var(--lp-surface-sunken)] flex items-center justify-center flex-shrink-0 -mt-0.5">
                    {item.icon}
                  </div>
                  {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx. */}
                  <p className="text-[17px] text-[var(--lp-ink-700)] leading-[1.65]">{item.text}</p>
                </motion.div>
              ))}
            </Stagger>
          </Parallax>

          {/* ═══ VIDEO 1 (§6) — CIERRA LP-DT-13 ═══
              Aquí vivía el mini-mockup dibujado a mano: una tarjeta de paciente
              falsa con pestañas y timeline inventados. Con él se van sus 13
              nodos de contraste entre 2.51 y 2.63, sus cinco tamaños fuera de
              escala (10/11/12/13/14px) y los tres semánticos del timeline que
              e2 y e4 excluyeron por ser UI falsa. La landing ya no dibuja
              ninguna interfaz: §2·2 cumplida sin excepciones.

              ⚠️⚠️ ESTE VIDEO NO PUEDE PUBLICARSE TODAVÍA — VER LP-DT-32.
              El asset muestra «Spinus®» en el título de pestaña del navegador.
              §7·Global es tajante: la marca está EN TRÁMITE ante IMPI
              (exp. 3594483, sin registro concedido) y usar ® es INFRACCIÓN.
              Está montado para no dejar la sección coja, pero **esta rama no
              va a producción hasta que el asset se regenere**. No es un detalle
              cosmético y no se arregla desde el código de la landing.

              ⚠️ NO LLEVA MARCO DE VENTANA EN HTML, Y ES A PROPÓSITO.
              El encargo pedía envolverlo con el mismo cromo del hero y los
              tokens --lp-chrome-*, partiendo de que la grabación no traía
              cromo de navegador. **Sí lo trae**: el asset es una captura de
              PANTALLA, no de ventana — se ve el semáforo de macOS, la pestaña,
              los iconos de extensiones y hasta el fondo de escritorio alrededor.
              Añadir nuestro marco encima daría dos semáforos anidados, que es
              justo el "video incrustado" que §6 quiere evitar.
              Cuando llegue el asset regenerado (ventana limpia, sin escritorio
              y sin ®), el marco entra tal cual — es el mismo bloque del hero:
                <div className="rounded-2xl border-[0.5px] border-[var(--lp-border)]
                                bg-[var(--lp-surface)] shadow-sm overflow-hidden">
                  <div aria-hidden className="flex items-center gap-2 px-4 py-3
                                              border-b-[0.5px] border-[var(--lp-border)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-close)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-min)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-max)]" />
                  </div>
                  …el <video> aquí dentro…
                </div>

              ⚠️ SIN `aspect-[…]` NI NINGÚN NÚMERO DE PROPORCIÓN. Antes había
              un `aspect-[1692/1080]` y se retiró: no estaba causando el
              recorte —medido: el asset ES 1692×1080 en el `tkhd` del MP4 y en
              el EBML del WebM, y la clase compilaba— pero era una AFIRMACIÓN
              sobre el asset escrita en el componente. Si el video regenerado
              llega con otra proporción, esa clase forzaría una caja que no es
              la suya y el `object-fit: contain` que los navegadores aplican
              por defecto a `<video>` metería bandas.
              Ahora la caja la fija el propio medio: `w-full` más el
              `height: auto` del preflight, y el póster —mismas dimensiones—
              aporta la proporción intrínseca antes de que el video cargue, así
              que tampoco hay salto de layout. Un asset nuevo entra sin tocar
              una línea.

              ⚠️ EL RECORTE QUE SE VE NO PUEDE VENIR DE AQUÍ, y conviene tenerlo
              escrito para no volver a buscarlo en el CSS. Con la caja y el
              video en la misma proporción, NINGÚN `object-fit` recorta:
              `contain` y `cover` coinciden, y `fill` tampoco corta. Tampoco hay
              `object-cover` sobre este elemento. El único `overflow-hidden` es
              el del envoltorio, cuya altura ES la del video. Si tras ensanchar
              la columna sigue viéndose contenido cortado, está EN EL ASSET
              —encuadre de la grabación— y se corrige regrabando, no aquí.

              ⚠️ `preload="none"` + autoplay NO se contradicen: los navegadores
              gatean la reproducción automática de video mudo por visibilidad
              —Chrome y Safari no reproducen lo que está fuera de cuadro—, así
              que la descarga arranca cuando la sección entra en viewport. No
              hace falta IntersectionObserver, y por eso no hay uno.
              El póster sí carga de inmediato, pero son 113 KB y esta sección
              vive muy por debajo del pliegue: no toca el LCP.

              ⚠️ SIN `loop`, Y ESO ES LO QUE RESUELVE WCAG 2.2.2 SIN BOTÓN DE
              PAUSA. El video corre UNA vez al entrar en cuadro y se queda
              congelado en su último fotograma —el expediente abierto—, que es
              justo la imagen que sustituye al mockup eliminado. Sin bucle no
              hay movimiento automático continuo que parar, así que no hace
              falta `controls` y §6·4 sigue intacta.
              (Residual honesto, en LP-DT-33: el criterio 2.2.2 se dispara por
              DURACIÓN —más de 5s— y no por repetición, así que una pasada de
              15s todavía lo roza. Aceptado por el PM; las salidas limpias
              serían pausar bajo `prefers-reduced-motion` o recortar el asset
              a ≤5s.)

              ⚠️ SIN `controls` NI CROMO DE REPRODUCTOR (§6·4). */}
          {/* ═══ ACCESIBILIDAD — EL ÁREA DEL VIDEO ES UN `<button>` DE VERDAD ═══
              El `role="img"` + `aria-label` que llevaba el video ya no vale:
              un elemento con acción no es una imagen. Y no basta con un
              `onClick` sobre un `<div>`, que deja el control fuera del orden de
              tabulación y sin rol.

              Es un `<button>` NATIVO envolviendo al video, no un div con
              handlers, y eso resuelve de una vez tres cosas que habría que
              reimplementar a mano: entra en el orden de tabulación, responde a
              Enter y a Espacio sin un solo `onKeyDown`, y se anuncia como
              botón con el nombre de abajo.

              El `aria-label` describe LA ACCIÓN Y EL CONTENIDO en una sola
              frase, porque son una sola cosa para quien no ve la pantalla:
              qué se va a reproducir y que se puede repetir. El `<video>` va
              `aria-hidden` para que no se anuncie dos veces — su descripción
              ya vive en el nombre del botón.

              §6·4 se respeta entera: no hay icono de play, ni barra, ni cromo
              de reproductor. Lo único que se añade es un `cursor-pointer` y un
              anillo de foco, y el anillo NO es cromo de reproductor: es el
              indicador que WCAG 2.4.7 exige a cualquier control enfocable, y
              solo aparece con teclado (`focus-visible`).

              ⚠️ `-outline-offset-2` NEGATIVO, igual que en `SeccionFAQ.tsx:220`
              y por el mismo motivo: el `overflow-hidden` de este mismo elemento
              recortaría un anillo dibujado por fuera, y el usuario de teclado
              se quedaría sin ver dónde está. */}
          <button
            type="button"
            onClick={repetir}
            aria-label="Repetir el recorrido por Spinus: la lista de pacientes de la clínica, la búsqueda por nombre filtrando el listado, y el expediente de un paciente abriéndose con su historial."
            className="order-2 lg:order-1 block w-full cursor-pointer rounded-2xl overflow-hidden shadow-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
          >
            <video
              ref={video}
              aria-hidden
              onEnded={alTerminar}
              autoPlay
              muted
              playsInline
              preload="none"
              poster="/landing/expediente-demo-poster.jpg"
              className="block w-full"
            >
              <source src="/landing/expediente-demo.webm" type="video/webm" />
              <source src="/landing/expediente-demo.mp4" type="video/mp4" />
            </video>
          </button>
        </Reveal>
      </div>
    </section>
  )
}
