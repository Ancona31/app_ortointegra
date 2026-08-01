'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { CHAT, DIST, DUR, EASE, SPRING, STAGGER } from '@/components/landing/motion/tokens'
import { PREGUNTAS_FAQ } from '@/components/landing/faq-contenido'

/* Section: Preguntas frecuentes — §7·12b · coreografía en §5.14
   Responde de frente las objeciones de un médico que evalúa Spinus, en
   PRIMERA PERSONA y firmada por el fundador (decisión de PM). El copy vive en
   `faq-contenido.ts`, con la verificación de cada claim: no lo dupliques aquí.

   ═══ ESQUELETO (§3.4·12b) ═══
   COLUMNA ESTRECHA CENTRADA con filas apiladas de ancho completo. Ninguna otra
   sección hace esto: las dobles columnas son asimétricas, las retículas son
   tarjetas en fila, Portabilidad es una tira de tres y 10b apila dos bloques
   con visual propio. Aquí no hay más que una conversación en vertical, que es
   justo la metáfora del patrón.

   ⚠️ SUPERFICIE BLANCA, Y LA ELECCIÓN ESTABA ACORRALADA — igual que en 10b.
   El sitio es entre Seguridad y el CTA, y el CTA no admite franja al lado: su
   lavado `color-mix(in srgb, #1e5fa8 4%, #fff)` resuelve a ≈#f6f9fc, a UN
   punto por canal de la franja #f5f8fc (`SeccionCTA.tsx:14`). Una FAQ en
   franja se fundiría con el cierre en una sola banda de ~1200px.
   ⚠️ ESTE COMENTARIO CITABA A SEGURIDAD COMO PRECEDENTE ("es exactamente el
   motivo por el que Seguridad se quedó en blanco") Y YA NO VALE. Seguridad
   pasó a franja en la resecuenciación de superficies del 2026-07-31,
   precisamente porque ESTA sección se metió en medio y dejó de ser vecina del
   CTA. El argumento del lavado sigue siendo válido, pero solo para quien tenga
   el CTA al lado — que ahora es la FAQ y ya no Seguridad. Sin punteros a
   líneas concretas de ese archivo: se desplazan en cada tanda y por eso los
   dos que había aquí apuntaban a sitios equivocados.
   El contraste lo pone el INTERIOR, no la sección: las filas del acordeón van
   rellenas de #f5f8fc, que es la misma resolución que el PM dio para 10b el
   2026-07-31 — contraste interno en vez de pelearse con la vecina. No la pases
   a franja sin mover el CTA.

   ⚠️ KICKER SIN PASTILLA, por el mismo motivo que en 10b: la sección de
   arriba (Seguridad) lleva la pastilla de acento
   (`--lp-accent-bg`/`--lp-accent`) y dos pastillas idénticas seguidas son
   repetición. Desde F1.3·e4 las cinco pastillas de la landing son idénticas,
   con lo que "dos seguidas" es literal, no aproximado. */

/* ⚠️ §12 SE REESCRIBIÓ PARA QUE ESTA SECCIÓN EXISTA — no la estás violando.
   La lista negra decía "texto letra-por-letra fuera del hero", y esa entrada
   ya estaba caducada antes de esta tanda: el hero (§5.1) no tiene typing y el
   Teaser 1 (§5.5) sí. La regla vigente es que el typing solo vale donde el
   ACTO DE ESCRIBIR ES EL MENSAJE — el Teaser 1 (la IA redacta la nota) y esta
   FAQ (el fundador contesta) —, nunca como adorno. */

/* Envolvente de opacidad del indicador, en fracciones de `CHAT.respuesta`.
   `times` de motion es normalizado (0–1) y `CHAT.*` está en segundos, así que
   se divide: escribir 0.1 y 0.9 a mano funcionaría solo mientras la duración
   valga exactamente 1s, y dejaría cuatro números sueltos que la regla 1 de
   CLAUDE.md no admite. Con esto, mover un token mueve la envolvente sola.
   El resultado con los valores de hoy: invisible hasta 0.10, dentro a 0.22,
   quieto hasta 0.88, fuera en 1.00. */
const T_ENTRA = CHAT.indicadorEntra / CHAT.respuesta
const T_DENTRO = (CHAT.indicadorEntra + DUR.micro) / CHAT.respuesta
const T_SALE = 1 - DUR.micro / CHAT.respuesta

interface ItemProps {
  pregunta: string
  respuesta: string
  /** Uno solo para toda la sección; ver el comentario de `SeccionFAQ`. */
  sinMovimiento: boolean
}

function ItemFAQ({ pregunta, respuesta, sinMovimiento }: ItemProps): React.JSX.Element {
  const idBase = useId()
  const idPregunta = `faq-p${idBase}`
  const idPanel = `faq-r${idBase}`

  const [abierto, setAbierto] = useState(false)
  /* Si ESTA apertura concreta lleva indicador + typing. Dos renders por
     apertura, no uno por cuadro: §4.3·2 prohíbe lo segundo, no lo primero. */
  const [conEscritura, setConEscritura] = useState(false)
  /* ⚠️ DECISIÓN: EL TYPING CORRE UNA SOLA VEZ POR ÍTEM, igual que el
     indicador. La alternativa era "un clic durante el typing lo completa", y
     se descartó con motivo: es una afordancia invisible —el clic que da un
     impaciente cae en el encabezado, que CIERRA— y una zona de clic sobre el
     cuerpo pelea con la selección de texto, que en una FAQ sí se usa. La
     fricción real es reabrir algo ya leído, y esto la elimina entera por el
     coste de un booleano. Y deja un escape que se descubre solo: cerrar y
     reabrir da el texto instantáneo. */
  const yaRespondida = useRef(false)

  const palabras = respuesta.split(' ')
  const total = palabras.length

  /* ⚠️ EL PROGRESO DEL TYPING NO PASA POR ESTADO DE REACT (§4.3·2). Es un
     MotionValue y la suscripción de abajo escribe al DOM. Con `useState` por
     palabra serían ~40 renders del subárbol por respuesta. */
  const progreso = useMotionValue(0)
  const cuerpoRef = useRef<HTMLParagraphElement>(null)
  /* Cuántas palabras están pintadas AHORA. Arranca en `total` porque el DOM
     sale del servidor con la respuesta ENTERA visible: ver `pintar`. */
  const pintadas = useRef(total)

  /* ⚠️ RELAYOUT CERO DURANTE EL TYPING, Y ESE ES TODO EL TRUCO.
     Las palabras se pintan TODAS desde el primer cuadro, cada una en su
     `<span>`, y lo que se revela es el COLOR (`transparent` → heredado). Las
     cajas de línea son definitivas desde el principio, así que el texto no
     refluye ni una vez mientras se escribe y el `scrollHeight` del documento
     no se mueve.
     La alternativa obvia —mutar `textContent`— recalcula el layout del
     párrafo en cada tick (~40 por respuesta) y, peor, deja media respuesta en
     el árbol de accesibilidad: un lector de pantalla que entre a mitad lee una
     frase cortada. Con spans, el texto completo está desde que abre.
     Por eso tampoco hay `aria-live`: anunciaría palabra por palabra.

     El estado inicial es SIN estilo inline, es decir VISIBLE. Es la dirección
     segura: sin JS —o antes de hidratar— la respuesta se lee entera. El
     blanqueado lo hace el handler del clic, que corre antes del repintado. */
  const pintar = useCallback((hasta: number) => {
    const cont = cuerpoRef.current
    if (!cont) return
    const spans = cont.children
    const fin = Math.max(0, Math.min(spans.length, hasta))
    const desde = pintadas.current
    if (fin === desde) return
    if (fin > desde) {
      for (let i = desde; i < fin; i++) (spans[i] as HTMLElement).style.color = ''
    } else {
      for (let i = desde - 1; i >= fin; i--) (spans[i] as HTMLElement).style.color = 'transparent'
    }
    pintadas.current = fin
  }, [])

  useEffect(() => progreso.on('change', (v) => pintar(Math.floor(v))), [progreso, pintar])

  useEffect(() => {
    if (!abierto || !conEscritura) return
    const controles = animate(progreso, total, {
      duration: total * CHAT.palabra,
      ease: 'linear',
      delay: CHAT.respuesta,
    })
    return () => controles.stop()
  }, [abierto, conEscritura, progreso, total])

  function alternar(): void {
    if (abierto) {
      /* FASE B — cerrar no es responder: sin indicador y sin typing. La
         respuesta queda ENTERA pintada aunque se cierre a media escritura,
         que es lo que hace instantánea la siguiente apertura. */
      progreso.jump(total)
      pintar(total)
      setConEscritura(false)
      setAbierto(false)
      return
    }
    const primera = !yaRespondida.current && !sinMovimiento
    if (primera) {
      yaRespondida.current = true
      /* Se blanquea AQUÍ, dentro del handler, y no en un efecto: el navegador
         todavía no ha pintado el panel abierto, así que no hay un cuadro con
         la respuesta entera colándose antes del typing. */
      progreso.jump(0)
      pintar(0)
    }
    setConEscritura(primera)
    setAbierto(true)
  }

  const instantaneo = { duration: 0 }

  return (
    /* ⚠️ `layout="position"` Y NO `layout` A SECAS. Verificado en el paquete
       embarcado, no de memoria (`motion-dom/dist/index.d.ts:887-889`): con
       "position" el TAMAÑO cambia de golpe y solo se anima la POSICIÓN. Es
       exactamente lo que pide la restricción del patrón —el bloque abre a su
       alto definitivo y el texto se revela dentro del espacio ya reservado— y
       resuelve tres problemas de una:
         · Cero `scale`, así que cero deformación del contenido. Motion solo
           corrige `borderRadius` y `boxShadow`
           (`motion-dom/.../scale-correction.mjs:6-16`); el texto se estira
           salvo que cada hijo sea a su vez nodo de proyección, y eso son 27
           nodos midiendo por clic para nada.
         · Evita el caso degenerado de escalar DESDE altura 0:
           `delta-calc.mjs:20-24` corrige el `scale` solo si sale NaN, y
           N/0 es Infinity, que no lo es. Un panel que se despliega desde 0
           con `layout` completo entra por ahí.
         · Los ítems de ABAJO sí necesitan animar: sin `layout` en cada uno se
           teletransportan a su nueva posición en el primer cuadro mientras el
           de arriba se abre, y eso se lee como bug. Por eso el prop va en
           TODOS los `<li>`, no solo en el que abre.
       Sigue cumpliendo §4.3·1: `buildProjectionTransform`
       (`motion-dom/.../projection/styles/transform.mjs`) solo emite
       `translate3d()` y `scale()`, jamás `width`/`height`. */
    <motion.li
      layout="position"
      transition={sinMovimiento ? instantaneo : SPRING.soft}
      data-lp-reveal=""
      variants={{
        oculto: { opacity: 0, y: DIST.reveal },
        visible: {
          opacity: 1,
          y: 0,
          transition: sinMovimiento ? instantaneo : { duration: DUR.base, ease: EASE.out },
        },
      }}
      className="overflow-hidden rounded-2xl border-[0.5px] border-[var(--lp-border)] bg-[var(--lp-surface-alt)]"
    >
      {/* El botón va DENTRO del h3: el encabezado da la estructura al lector
          de pantalla y el botón la interacción. Al revés (h3 dentro del
          botón) el rótulo del control se llena de ruido. */}
      <h3>
        <button
          type="button"
          id={idPregunta}
          aria-expanded={abierto}
          aria-controls={idPanel}
          onClick={alternar}
          /* ⚠️ `-outline-offset-2`: el `overflow-hidden` del `<li>` recortaría
             un foco dibujado por fuera. Con offset negativo se dibuja dentro y
             el usuario de teclado lo ve entero. */
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-6 text-left transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-surface)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lp-accent)]"
        >
          {/* F1.3·d4 — rol H3 de card: 19px · -0.015em · 1.30. */}
          <span className="text-[19px] font-semibold text-[var(--lp-ink-900)] tracking-[-0.015em] leading-[1.30]">
            {pregunta}
          </span>
          {/* §5.14 · capa 1 — el marcador. `aria-hidden` porque su estado ya
              lo dice `aria-expanded`; anunciarlo dos veces es ruido. */}
          <motion.span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lp-surface)] text-[var(--lp-accent)]"
            animate={{ rotate: abierto ? 45 : 0 }}
            transition={sinMovimiento ? instantaneo : { duration: DUR.base, ease: EASE.out }}
          >
            <Plus className="h-4 w-4" />
          </motion.span>
        </button>
      </h3>

      {/* `hidden` cerrado: saca el panel del flujo, del orden de tabulación y
          del árbol de accesibilidad de una vez. `inert` va igualmente — es
          redundante con `display:none` pero deja la intención escrita y
          protege si alguien cambia el colapso por una altura.
          El `animate` por nombre de variante es lo que impide que la entrada
          corra sola al montar: sin él, las capas de dentro se animarían
          invisibles en la carga de la página y llegarían gastadas al clic. */}
      <motion.div
        id={idPanel}
        role="region"
        aria-labelledby={idPregunta}
        inert={!abierto}
        initial={false}
        animate={abierto ? 'abierta' : 'cerrada'}
        className={abierto ? 'flex items-start gap-3 px-6 pb-6' : 'hidden'}
      >
        {/* §5.14 · capa 2 — avatar. SOLO opacity: el `scale` de la ficha
            original se retiró para bajar el presupuesto de capas, y no
            aportaba nada que el fade no diga ya.
            `alt=""` a propósito: quién responde lo dice el encabezado de la
            sección en texto, así que aquí la foto es decorativa y nombrarla
            otra vez solo alarga el recorrido del lector.
            256×256 (9 KB) en vez del retrato de 1745×2210 (382 KB) que usa
            SeccionHistoria: el recorte dedicado sale de ese mismo archivo,
            región x 255–1455 · y 0–1200, que centra la cara en el círculo.
            Con el original y `object-cover`, un círculo de 32px encuadraba la
            bata. */}
        <motion.div
          variants={{
            cerrada: { opacity: 0 },
            abierta: { opacity: 1, transition: sinMovimiento ? instantaneo : SPRING.snap },
          }}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-[0.5px] border-[var(--lp-border)]"
        >
          <Image
            src="/landing/dr-ancona-avatar.jpg"
            alt=""
            width={256}
            height={256}
            sizes="32px"
            className="h-full w-full object-cover"
          />
        </motion.div>

        <div className="relative min-w-0 flex-1">
          {/* §5.14 · capa 3 — indicador de escritura.
              ⚠️ VA EN `absolute` Y NO EN EL FLUJO. Si ocupara su propia línea,
              la burbuja aparecería debajo y el ítem crecería a mitad de la
              coreografía: justo el reflujo que todo el patrón evita. Flotando
              sobre la burbuja —que ya está en su sitio, solo que a opacity 0—
              el alto del panel es el definitivo desde el primer cuadro.
              `aria-hidden`: es decorativo y no puede retrasar contenido real.
              900ms, no 330: a 330 se lee como parpadeo, no como "está
              escribiendo" (ver el comentario de CHAT en tokens.ts). */}
          <motion.span
            aria-hidden
            variants={{
              cerrada: { opacity: 0 },
              abierta: conEscritura
                ? {
                    opacity: [0, 0, 1, 1, 0],
                    transition: {
                      duration: CHAT.respuesta,
                      times: [0, T_ENTRA, T_DENTRO, T_SALE, 1],
                      /* 'linear' no es un easing de §4.2 que se salte: es la
                         ausencia de easing. Con `times` explícitos, cualquier
                         curva desplazaría los keyframes del sitio calculado.
                         El maestro ya la usa así en §5.1 y §5.5. */
                      ease: 'linear',
                    },
                  }
                : { opacity: 0, transition: instantaneo },
            }}
            className="absolute left-0 top-0 flex items-center gap-1 rounded-2xl rounded-tl-sm border-[0.5px] border-[var(--lp-border)] bg-[var(--lp-surface)] px-4 py-3"
          >
            {[0, 1, 2].map((i) => (
              /* `repeat: 1` = dos ciclos = 900ms. FINITO: §12 prohíbe los
                 loops infinitos y un indicador de chat es donde más tienta
                 poner `repeat: Infinity`. */
              <motion.span
                key={i}
                variants={{
                  cerrada: { opacity: 0.35 },
                  abierta: conEscritura
                    ? {
                        opacity: [0.35, 1, 0.35],
                        transition: {
                          duration: CHAT.pulso,
                          repeat: 1,
                          ease: EASE.out,
                          delay: CHAT.indicadorEntra + i * CHAT.pulsoDesfase,
                        },
                      }
                    : { opacity: 0.35, transition: instantaneo },
                }}
                /* F1.3·e5 — era `bg-[#8a99ac]`. No se cambió por contraste (un
                   punto de 1.5px es decoración y no tiene umbral que cumplir)
                   sino por higiene: era el último hex de tinta suelto del
                   archivo. */
                className="block h-1.5 w-1.5 rounded-full bg-[var(--lp-ink-500)]"
              />
            ))}
          </motion.span>

          {/* §5.14 · capa 4 — la burbuja. Entra cuando el indicador se apaga.
              `y: 12` es vertical a propósito: una entrada lateral cerca del
              borde del viewport habría que medirla contra `scrollWidth`
              (lección de §5.10b), y aquí no hace falta porque no la hay. */}
          <motion.div
            variants={{
              cerrada: { opacity: 0, y: 12 },
              abierta: {
                opacity: 1,
                y: 0,
                transition: sinMovimiento
                  ? instantaneo
                  : { ...SPRING.soft, delay: conEscritura ? CHAT.respuesta : 0 },
              },
            }}
            className="rounded-2xl rounded-tl-sm border-[0.5px] border-[var(--lp-border)] bg-[var(--lp-surface)] px-4 py-3"
          >
            {/* F1.3·d3 — rol cuerpo: 17px · tracking normal · 1.65.
                ⚠️ EL ESPACIO VA DENTRO DEL SPAN, no entre spans sueltos: así
                el número de hijos de este `<p>` es exactamente el número de
                palabras y `pintar` puede indexarlos sin corregir. El salto de
                línea sigue funcionando igual — el espacio final de cada span
                es una oportunidad de corte como cualquier otra. */}
            <p ref={cuerpoRef} className="text-[17px] text-[var(--lp-ink-700)] leading-[1.65]">
              {palabras.map((palabra, i) => (
                <span key={i}>{i < total - 1 ? `${palabra} ` : palabra}</span>
              ))}
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.li>
  )
}

export default function SeccionFAQ() {
  /* Un solo `useReducedMotion` para toda la sección, bajado por prop. NO
     ramifica el render: el árbol de DOM es idéntico con y sin la preferencia
     (ramificarlo provoca hydration mismatch — ver `Reveal.tsx` y §4.3·7). Lo
     único que cambia son los valores de transición.
     ⚠️ Y HACE UNA COSA MÁS, que es la que pide la ficha: con la preferencia
     activa, `primera` en `alternar()` nunca es true, así que no hay indicador
     ni typing y la respuesta aparece completa al instante. Los dos son
     decorativos y no pueden retrasar contenido real. */
  const sinMovimiento = useReducedMotion() ?? false

  return (
    <section className="bg-[var(--lp-surface)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-2xl">
          {/* F1.3·c3 — `mb-12` (48). Ver SeccionSeguridad.tsx. */}
          <div className="mb-12">
            {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
            <p className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none">
              Preguntas frecuentes
            </p>
            {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em · 1.10. */}
            <h2 className="mt-4 text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.03em] leading-[1.10]">
              Lo que me preguntan antes de decidirse
            </h2>
            {/* F1.3·d4 — rol caption: 13px · 1.45. Ver SeccionFooter.tsx.
                Aquí vive la autoría, y por eso los avatares de abajo llevan
                `alt=""`: decir quién responde una vez basta, repetirlo nueve
                veces convierte la firma en ruido. */}
            <p className="mt-4 text-[13px] text-[var(--lp-ink-500)] leading-[1.45]">
              Respondo yo &mdash; Dr. &Aacute;ngel M. Ancona P&eacute;rez, cirujano de columna y
              autor de Spinus.
            </p>
          </div>

          {/* Entrada de la sección: stagger de 70ms con variantes padre→hijo.
              §4.4 prohíbe el componente `<Stagger>` aquí y no es capricho: ese
              envuelve cada hijo en un `motion.div` propio, y un `<div>` entre
              `<ul>` y `<li>` es HTML inválido — el lector de pantalla deja de
              anunciar "lista de 9 elementos".
              ⚠️ VARIOS ÍTEMS ABIERTOS A LA VEZ, no uno. Con acordeón exclusivo
              cada clic son DOS animaciones de layout (cerrar + abrir) más el
              reflujo de todo lo que hay entre ambos, y si el que se cierra
              está ARRIBA el contenido sube bajo el cursor y el usuario pierde
              el sitio. Así solo hay una animación por clic y todo lo de abajo
              baja, que es predecible y más barato. */}
          <motion.ul
            initial="oculto"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              oculto: {},
              visible: {
                transition: sinMovimiento
                  ? { staggerChildren: 0 }
                  : { staggerChildren: STAGGER.siblings },
              },
            }}
            className="flex flex-col gap-3"
          >
            {PREGUNTAS_FAQ.map((item) => (
              <ItemFAQ
                key={item.pregunta}
                pregunta={item.pregunta}
                respuesta={item.respuesta}
                sinMovimiento={sinMovimiento}
              />
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  )
}
