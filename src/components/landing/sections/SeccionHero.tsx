'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { DUR, EASE, HERO, OFFSETS, SPRING } from '@/components/landing/motion/tokens'

/* Hero
   Lavado de --cs al 4% (§3.1, banda 3–5%) — sustituye al NeuralBackground.
   Hex literal, NO var(--cs): el provider que la define solo se monta en
   (app)/layout.tsx, así que en la landing pública var() nunca resolvería.
   OJO: var(--sp-*) SÍ resuelve aquí — sale del :root estático de
   spinus-tokens.css, que globals.css importa en el layout raíz. La trampa
   es solo con --cs/--cp. */
/* F1.3·b2 — la <section> va SIN `relative overflow-hidden`. Ambos existían
   SOLO para el orbe absoluto que b1 eliminó. El sangrado de la columna
   derecha en lg+ NO depende de ellos: lo produce la geometría del contenedor
   de abajo (`lg:max-w-none` + `lg:pr-0` + el pl calculado), que llega exacto
   al borde del viewport sin desbordarlo — no había nada que recortar. La
   sombra del marco sí se derrama por la derecha, pero `box-shadow` no entra
   en el área desbordable, así que no aparece scroll horizontal.
   ⚠️ Si alguna tanda futura vuelve a meter una capa `absolute` aquí, tendrá
   que reponer el `relative` — no lo des por presente. */
/* F1.3·e5 — el lavado de apertura sale de --lp-wash, que trae su propio
   fallback sólido (#f6f9fc) tras un @supports en globals.css. Aquí ya no se
   escribe el color-mix a mano: si se escribiera, un navegador sin color-mix se
   quedaría sin fondo y ningún fallback lo cubriría. El cierre (SeccionCTA.tsx)
   usa exactamente esta misma variable — son las dos únicas superficies lavadas
   de la landing y tienen que moverse juntas. */
/* ═══ §5.1 · EL HERO ES UN ESCENARIO (F2.b) ═══
   Registro Apple (§4.1): duraciones largas, `--lp-ease-cine`, un foco. El
   resto de la landing es tejido y NO se parece a esto.

   ⚠️⚠️ LA FICHA REPARTÍA EL ESCENARIO EN TRES FASES Y LA SEGUNDA NO ERA
   IMPLEMENTABLE. Pedía la ENTRADA de la captura ligada al scroll con
   `OFF_ENTRADA` sobre la propia captura. Medido con la geometría que este
   archivo ya documenta —marco de 464px a 1024 de viewport, ~720 a 1920, nav
   `sticky` de 56 por encima—, el borde superior de la captura arranca entre el
   26% y el 48% del viewport según el ancho. `OFF_ENTRADA` termina en
   `start 0.35`: el progreso vale 1 (o casi) EN EL PRIMER CUADRO y solo bajaría
   con scroll negativo, que no existe. **Esa entrada no la vería nadie nunca.**
   Por eso la entrada de la captura es de CARGA, como el resto de §5.1·A, y lo
   único ligado al scroll es la deriva. §5.1 del maestro ya está corregida.

   ⚠️ UN SOLO `useScroll` (§4.3·4) — `OFFSETS.salida` sobre la `<section>`. Las
   dos capas continuas (salida del texto y deriva de la captura) derivan de él
   con `useTransform`, y sus tramos NO se solapan con nada más: 0→1 y 0.30→1 son
   DOS capas simultáneas como mucho, que es el presupuesto que fija §5.1.
   El progreso NUNCA pasa por estado de React (§4.3·2).

   ⚠️ REDUCED MOTION NO RAMIFICA EL RENDER (§4.3·7), ni siquiera el rango de
   los `useTransform` — es la lección de a4. El árbol es idéntico siempre; la
   preferencia se resuelve en dos capas, igual que en `Reveal.tsx`: aquí
   poniendo la transición a 0, y en `globals.css` con `[data-lp-reveal]`, que
   desde esta tanda también neutraliza `filter` (por el blur del H1). */
export default function SeccionHero() {
  const seccionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  /* ⚠️⚠️ `salida` Y NO `travesia`, Y ESTO YA COSTÓ UNA REGRESIÓN (2026-08-01,
     el mismo día de F2.b). La travesía mide el recorrido del hero por el
     viewport entero, incluida la parte que este hero NUNCA hace: por estar
     pegado al techo del documento bajo un nav `sticky` de 56px, sale del primer
     cuadro con `(vh − 56) / (vh + altoHero)` ya recorrido — 0.51 a 1440×900,
     0.63 a 2560×1440 —, o sea por delante del tramo en el que arrancaba la
     salida. La página se servía con la columna de texto a `opacity` .92–.75:
     el H1 lavado hacia azul claro y el botón primario más claro que el mismo
     botón del nav, sin que ninguna clase de color hubiera cambiado.
     `OFFSETS.salida` ancla el 0 a la posición de reposo por construcción, y lo
     que cae por debajo lo clampa el propio `useScroll`. Subir el umbral NO era
     alternativa: la fracción ya recorrida crece con la altura del viewport. */
  const { scrollYProgress } = useScroll({ target: seccionRef, offset: [...OFFSETS.salida] })

  /* §5.1·C — el bloque de texto se va y se apaga mientras el hero cruza. Las
     dos capas salen del MISMO tramo, así que viajan juntas por definición. */
  const salidaY = useTransform(scrollYProgress, [HERO.tramo.salidaInicio, 1], [0, HERO.salidaY])
  const salidaOpacidad = useTransform(
    scrollYProgress,
    [HERO.tramo.salidaInicio, 1],
    [1, HERO.salidaOpacidad],
  )

  /* §5.1·B (deriva) — la captura sigue acercándose despacio cuando el texto ya
     se está yendo. `useTransform` clampa fuera del rango, así que por debajo de
     `derivaInicio` vale exactamente 1: el HTML del servidor sale sin transform
     y no hay salto al hidratar. El 0.30 es el 0.70 de la ficha traducido al
     tramo anclado — mismo punto de la página, ver `HERO.tramo`. */
  const derivaEscala = useTransform(scrollYProgress, [HERO.tramo.derivaInicio, 1], [1, HERO.deriva])

  /* Rama de reduced-motion de TODA la fase de carga. Es la de `Reveal.tsx`:
     la animación no corre y el estado final lo fuerza `[data-lp-reveal]`. */
  const sinMovimiento = { duration: 0, delay: 0 }

  return (
    <section ref={seccionRef} style={{ background: 'var(--lp-wash)' }}>
      {/* F1.3·b1: aquí vivía un orbe de 800×500 con blur-3xl y un degradado
          que pasaba por violet-500. Eliminado por dos motivos de §3.1: el
          violeta no representa ningún dato del producto (los semánticos solo
          se usan para datos reales), y blur-3xl sobre una capa de ese tamaño
          es el mismo coste de compositor móvil por el que se eliminó el
          glassmorphism. El lavado del `style` de arriba es TODA la decoración
          de fondo que esta sección debe tener. No reintroducir capas aquí. */}

      {/* ═══ RÉGIMEN DE ESPACIADO DE LA LANDING (F1.3·c1) ═══
          Esta nota vive aquí porque aquí vivía la afirmación que sustituye —
          decía "los 128/72 generales son F1.3", y el 72 NUNCA llegó a
          existir: no está en la escala de §3.3 (8·12·16·24·32·48·64·96·128)
          y en móvil habría dejado costuras de 72px, por debajo del mínimo
          de 96. Vale para las 12 secciones, no solo para esta.

          Padding de sección = `py-16 sm:py-24 lg:py-32` → 64 / 96 / 128.
          Tres peldaños, no dos: 64→128 directo duplicaba el padding en un
          solo breakpoint y dejaba la tablet vertical (640–1023px) con
          padding de escritorio sobre un ancho todavía estrecho.
          Costura normal resultante = 128 / 192 / 256.

          ⚠️ 256 NO ES UN VALOR DE LA ESCALA, y no hace falta que lo sea:
          una costura es la SUMA de dos paddings, no un token. Los tokens
          son los 128 de cada lado, y esos sí están en escala. No busques
          256 en §3.3 ni lo reportes como violación — tampoco el 192.

          ⚠️ §3.3 LEGISLA EL RITMO VERTICAL ENTRE BLOQUES, NO LA FORMA DE
          LOS CONTROLES. Quedan FUERA de la escala por decisión de PM en
          c1, y NO son deuda pendiente: `px-7 py-3.5` de los cuatro botones
          grandes (dos aquí abajo, dos en SeccionCTA), `px-3.5 py-1` de las
          cinco pastillas de kicker, `py-1.5` de los links del nav y los
          chips de IA, `py-2.5` de las pestañas del mockup, y el `mt-0.5`
          de 2px que alinea ópticamente icono contra primera línea. Un
          botón de `px-8 py-4` no es este botón con el padding corregido:
          es otro botón. No los "normalices" en una tanda futura.

          ⚠️ c3 RATIFICÓ EL BLINDAJE DEL `mt-0.5` Y RESOLVIÓ EL `mt-1`, QUE
          NO ES LO MISMO. El `mt-0.5` de 2px corrige un desalineamiento
          geométrico entre un cuadro de icono y la primera línea de texto:
          es una corrección, no un espacio, y sigue fuera de §3.3
          (SeccionExpediente, SeccionInterfaz, SeccionPortabilidad). El
          `mt-1` de 4px que había en SeccionHistoria y SeccionPortabilidad
          NO corregía nada —dos bloques de texto apilados en flujo normal,
          sin icono ni baseline de por medio—, así que se leía como espacio
          y c3 lo subió a 8. Criterio para futuras tandas: ¿hay una
          desalineación física que compensar? Es óptico. ¿Solo hay dos
          cosas apiladas? Es ritmo, y va a la escala.

          El `gap-px` de SeccionPortabilidad tampoco es ritmo — es la
          técnica que dibuja los divisores de la franja. Ver allí.

          ─── CONTRATO DE COSTURA ─── no tocar sin releer §3.3.
          pb-24 = 96px, la costura con SeccionProblema (no con Features:
          la franja se insertó en medio y esta línea se quedó vieja hasta
          c1). Es el mínimo de aire de §3.3, SIN variante responsive: vale
          96 en los tres breakpoints. La cadena completa:
            Hero (pb-24) → [96] → Problema (sin pt … pb-32) → [128] → Features
          Las dos costuras son exactas, asimétricas e iguales en todos los
          breakpoints. Los tres valores viven en tres archivos y son UN
          SOLO contrato: si cambias uno, actualiza los tres comentarios.

          ⚠️ QUEDAN POR DEBAJO DEL ENTORNO, Y ES DELIBERADO. Antes de c1 el
          entorno eran costuras de 192–224; ahora son 128/192/256, así que
          en lg estas dos valen 0.375× y 0.5× de la costura normal. Se
          decidió mantenerlas literales (opción (a) de la auditoría de c1)
          en vez de darles variante responsive: la alternativa exigía un
          pb-48 = 192px que tampoco está en la escala. Si el QA visual ve
          la segunda costura enana contra los 256 de lg, se ajusta ahí y
          con el render delante — no por aritmética.

          ⚠️ El pb-24 vive en ESTE div, el contenedor del grid. NO lo repartas
          por columna: la costura se pierde sin que nada falle visiblemente.
          A partir de lg el contenedor suelta su max-w y calcula a mano el
          gutter izquierdo que tendría max-w-6xl (72rem), con pr-0, para que
          la columna derecha sangre por el borde (§3.4, hero asimétrico).
          F1.3·b2: este div tampoco lleva ya `relative`. Era el bloque de
          contención del mismo orbe muerto, y con él fuera ningún descendiente
          de esta sección está posicionado. Sin offsets ni z-index, `relative`
          y `static` maquetan idéntico: retirarlo no mueve un píxel.
          ⚠️ Mismo aviso que en la <section>: si una tanda futura mete aquí
          una capa `absolute`, tendrá que reponer el `relative` — no lo des
          por presente. */}
      {/* ⚠️ `100%` Y NO `100vw` — F6·f2. Es el mismo defecto que
          `SeccionExpediente.tsx:66-71` documenta haber eliminado de allí: el
          navegador CUENTA LA BARRA DE SCROLL DENTRO DE `100vw`, y esta página
          siempre tiene barra. Medido a 1440 con barra de 15px, el cálculo daba
          176px de padding izquierdo cuando lo que alinea con un contenedor
          `max-w-6xl` centrado son 168.5px: la columna del hero quedaba ~7.5px
          a la derecha del borde izquierdo del resto de la página.
          `100%` resuelve contra el ancho de contenido del ancestro —la
          `<section>`, que no tiene padding propio—, o sea el viewport YA SIN
          la barra. Misma fórmula, origen correcto.
          El sangrado por la DERECHA sobrevive intacto: lo dan `lg:max-w-none`
          y `lg:pr-0`, que no se tocan. Es el recurso de §3.4·1 y sigue siendo
          asimétrico a propósito. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-24 lg:pt-32 pb-24 lg:max-w-none lg:pl-[max(2rem,calc((100%-72rem)/2+2rem))] lg:pr-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* ═══ §5.1·C — CAPA DE SALIDA ═══
              La columna de texto ENTERA es la capa que se va (−70px y hasta
              .25 de opacidad). Es el mismo criterio de a4 con `Parallax`: lo
              que se mueve es el bloque, nunca el titular suelto, porque el
              recorrido se comería el hueco entre el titular y su bajada.
              Aquí no hay conflicto con las entradas de §5.1·A aunque las dos
              animen `y`: la salida vive en el PADRE y las entradas en cada
              hijo. Son dos transforms anidados, no dos dueños de un mismo
              `transform` — que es lo que `Parallax` prohíbe.

              `data-lp-hero-salida` es el gancho del `@media (width < 40rem)`
              de globals.css: §5.1 ELIMINA esta fase en móvil (en viewport
              corto el texto se va mientras todavía se lee). La capa se monta
              igual y lo que se descarta son sus escrituras — ramificar el
              render con el ancho es el hydration mismatch de §4.3·7.
              `data-lp-reveal` es el otro gancho, el de reduced-motion, y
              hacen falta LOS DOS: son dos preferencias distintas. */}
          <motion.div
            data-lp-reveal=""
            data-lp-hero-salida=""
            style={{ y: salidaY, opacity: salidaOpacidad }}
          >
            {/* ═══ ROL KICKER DE LA LANDING (F1.3·d1) ═══
                12px · tracking +0.12em · leading 1.0 (§3.2). Vale para los
                SIETE kickers de la landing, no solo para este: aquí abajo,
                SeccionExpediente, SeccionInterfaz (el del texto, :87),
                SeccionHistoria, SeccionIA, SeccionPortabilidad y
                SeccionSeguridad.

                Antes eran 11px con `tracking-wider` (0.05em), salvo el de
                SeccionIA que iba en `tracking-widest` (0.1em). El tracking
                abierto es lo que hace legible una versalita a tamaño chico:
                +0.12em no es decoración, compensa el apelmazamiento que
                produce el uppercase.

                ⚠️ EL OCTAVO KICKER NO ENTRA. `SeccionInterfaz.tsx:57`
                ("Flujo de trabajo típico") vive DENTRO del panel simulado y
                queda fuera de F1.3 por la misma decisión que excluye el
                mockup de Expediente. Se queda en 11px a propósito: es UI
                falsa, no texto de la landing. Si una auditoría futura
                reporta "un kicker a 11px suelto", la respuesta es esta nota
                — no lo unifiques hasta que F0.c sustituya el panel. */}
            {/* §5.1·A · beat 1 — abre el escenario. Registro de TEJIDO
                (`--lp-dur-section` + `--sp-ease-out`), no cine: §5.1 solo
                manda el registro Apple a las dos líneas del H1. */}
            <motion.p
              data-lp-reveal=""
              className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none"
              initial={{ opacity: 0, y: HERO.y.kicker }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? sinMovimiento
                  : { duration: DUR.section, ease: EASE.out, delay: HERO.retraso.kicker }
              }
            >
              Expediente clínico electrónico para consultorios privados
            </motion.p>

            {/* ═══ ROL H1 DE LA LANDING (F1.3·d2) ═══
                text-[clamp(40px,7vw,72px)] · tracking -0.04em · leading 1.02
                (§3.2). Rol de un solo sitio: este es el único H1 de la
                página. El régimen de los OCHO titulares de sección es otro y
                está declarado en `SeccionFeatures.tsx`.

                Venía de `40px sm:56px` con `tracking-tight` (-0.025em) y
                `leading-[1.1]`. El techo sube de 56 a 72 y el tracking y el
                leading se cierran con él: a 72px lo que a 56 se leía normal
                queda suelto. Por eso este rol NO comparte valores con el
                titular de sección aunque los dos sean "texto grande en
                negrita" — a esta escala el ajuste óptico es distinto.

                ⚠️ 7vw es agresivo a propósito y el clamp entrega tamaño de
                ESCRITORIO sobre columna estrecha en un punto: a 1024px de
                viewport 7vw ya vale 71.7px —a un pelo del tope— pero la
                columna del texto mide solo 461px. Medido ahí: 5 líneas,
                H1 de 366px (eran 4L y 246px) y hero de 867 (era 748). Es el
                peor caso de la curva y es aceptable — pero si una tanda
                futura mete texto más largo en este H1, mídelo a 1024 antes
                que a 390 o a 1920.

                Medido en el resto de la curva: a 1920 pasa de 2 a 4 líneas,
                +171px de caja de H1 — el hero solo crece 50 porque es
                `items-center` y manda la columna del mockup. A 390 el tamaño
                no se mueve (el clamp topa en su piso de 40, que es lo que ya
                tenía) pero el bloque ADELGAZA 13px: el leading baja de 1.1 a
                1.02. En móvil esta tanda quita alto, no lo añade.

                El sangrado de la columna derecha por el borde (§3.4)
                sobrevive en los cinco anchos medidos: su borde derecho sigue
                coincidiendo con el ancho del documento (1018/1274/1434/1914).
                El alto del H1 no toca el cálculo del gutter.

                El corte entre las dos mitades es duro y no es responsive (a
                diferencia del `hidden sm:block` que usan los h2 de dos
                líneas). A 72px el corte forzado es lo que sostiene el balance
                de las dos mitades de la frase; a 40px cae igual donde caería
                solo.

                ⚠️ F2.b — ESE CORTE YA NO LO HACE UN `<br />`, y el cambio es
                obligado, no cosmético. §5.1 anima las DOS LÍNEAS POR SEPARADO
                (`y` + `blur`, con 90ms de desfase entre ellas), y `transform`
                y `filter` NO APLICAN a una caja inline: es la misma trampa que
                §5.2 documenta para el remate de la franja del problema. Ahí la
                salida fue renunciar al `y`; aquí la ficha lo exige, así que
                cada línea pasa a ser una caja `block`.
                **Maqueta idéntica al `<br />`**: cada mitad empieza en línea
                nueva y sigue partiéndose sola por dentro si no cabe —que es lo
                que ocurre a 1024, donde esta columna mide 461px y el H1 cae en
                5 líneas—. Lo que NO se puede hacer es `inline-block`: eso sí
                convertiría cada mitad en una caja indivisible. */}
            <h1 className="mt-4 text-[clamp(40px,7vw,72px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.04em] leading-[1.02]">
              {/* §5.1·A · beats 2 y 3 — el ÚNICO sitio de la landing con
                  registro cine en carga: 900ms y `--lp-ease-cine`.
                  El `blur` está presupuestado aquí y SOLO aquí (§4.3·6): es el
                  filtro más caro, existe durante la carga y desaparece. No lo
                  lleves a ninguna capa de scroll. */}
              <motion.span
                data-lp-reveal=""
                className="block"
                initial={{ opacity: 0, y: HERO.y.h1, filter: `blur(${HERO.blur}px)` }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={
                  reducedMotion
                    ? sinMovimiento
                    : { duration: DUR.cine, ease: EASE.cine, delay: HERO.retraso.h1a }
                }
              >
                Menos tiempo en la pantalla,
              </motion.span>
              {/* F1.3·e3 — ERA UN DEGRADADO RECORTADO
                  (`from-[#1a3a5c] to-[#4a9fd4]` + `bg-clip-text`). Se eliminó
                  por contraste: el barrido del degradado da 4.40:1 en su peor
                  punto (el extremo #4a9fd4 sobre el lavado del hero), por
                  debajo de AAA y sin margen. Sólido en --lp-accent da 6.10:1.
                  Con este cambio y el de SeccionHistoria, #4a9fd4 desaparece
                  de la landing entera. NO lo repongas: un texto cuyo contraste
                  depende de en qué píxel lo midas no es texto accesible. */}
              <motion.span
                data-lp-reveal=""
                className="block text-[var(--lp-accent)]"
                initial={{ opacity: 0, y: HERO.y.h1, filter: `blur(${HERO.blur}px)` }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={
                  reducedMotion
                    ? sinMovimiento
                    : { duration: DUR.cine, ease: EASE.cine, delay: HERO.retraso.h1b }
                }
              >
                más tiempo con tu paciente
              </motion.span>
            </h1>

            {/* F1.3·d4 (cerrado) — el crédito italic es rol CUERPO completo:
                17px plano · tracking normal · leading 1.65. Ver
                SeccionFeatures.tsx.

                Los dos desvíos que d4 dejó abiertos se cierran aquí:
                  · Era `text-[15px] sm:text-[17px]`. El par responsive cae:
                    en móvil era el ÚNICO texto de contenido de la landing a
                    15px, tamaño que a partir de d4 pertenece al rol BOTÓN.
                    Esto es una atribución de autoría, no un rótulo ni un
                    control — se lee, luego es cuerpo, y el cuerpo no cambia
                    de tamaño por breakpoint.
                  · Era `tracking-wide` (+0.025em). El cuerpo va en tracking
                    normal, que es AUSENCIA de clase.

                Lo que SÍ se conserva y no es desvío: `italic` y
                `font-semibold`. El rol fija tamaño, tracking y leading; el
                estilo y el peso son de este sitio. La cursiva es lo que marca
                la atribución. */}
            {/* F1.3·e3 — el alfa `/80` CAE. Era #1e5fa8 al 80% sobre el lavado
                del hero: 4.00:1, fallo de AA por 0.5 en un texto de 17px que
                no es decorativo. Sólido da 6.10:1. Si vuelves a bajarle opacidad
                a este párrafo, vuelves a romperlo. */}
            {/* §5.1·A · beat 4 — la autoría y la bajada son UNA SOLA CAPA en
                la ficha, así que comparten retraso, duración y easing exactos.
                Son dos `<p>` con la misma transición y NO un `motion.div` que
                las envuelva: el wrapper es justo lo que §4.4 prohíbe desde a2,
                y aquí además tendría que absorber los `mt-*` de los dos
                párrafos para no alterar el ritmo. Si tocas una transición,
                toca la otra — o dejan de ser una capa. */}
            <motion.p
              data-lp-reveal=""
              className="mt-6 text-[17px] font-semibold text-[var(--lp-accent)] italic leading-[1.65]"
              initial={{ opacity: 0, y: HERO.y.texto }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? sinMovimiento
                  : { duration: DUR.section, ease: EASE.out, delay: HERO.retraso.texto }
              }
            >
              Creada por un cirujano de columna que la usa todos los días
            </motion.p>

            {/* ═══ ROL BAJADA (F1.3·d3) ═══
                19px · tracking -0.01em · leading 1.55 (§3.2). La bajada es el
                párrafo que sigue al titular de una sección y lo explica: uno
                por sección, SEIS en total — este, SeccionFeatures,
                SeccionExpediente, SeccionInterfaz, SeccionPortabilidad y
                SeccionCTA. Las otras cuatro secciones no tienen bajada y no
                hay que inventarles una.

                Esta es la única que ya estaba en 19 (venía de `17px sm:19px`);
                las otras cinco subían desde 15 o 16. El `leading-relaxed` de
                Tailwind (1.625) baja a 1.55: a 19px, 1.625 abre demasiado y
                la bajada empieza a leerse como cuerpo. El -0.01em es la
                mitad del que lleva el titular de sección — a este tamaño
                todavía compensa algo, pero mucho menos.

                ⚠️⚠️ NUNCA APLIQUES ESTE ROL —NI EL DE CUERPO— CON UN SELECTOR.
                Un `section p { }` en globals.css o un `[&_p]:text-[17px]` en
                un contenedor parece la solución obvia y ES UN BUG SILENCIOSO:
                barre también los párrafos de los dos mockups (el panel
                simulado de SeccionInterfaz y la tarjeta de paciente de
                SeccionExpediente), que están calibrados a 13/14px para
                parecer UI real. Medido: con selector, a 390px de ancho el
                documento pasa de 390 a 493px de scrollWidth — scroll
                horizontal en móvil. Ni `npm run build` ni el lint lo
                detectan, y a 1440 no se nota. Los 12 sitios de d3 se
                escribieron CLASE POR CLASE por esto. Si añades un párrafo
                nuevo, dale la clase a mano.

                El régimen de CUERPO (17px · 1.65) está en SeccionFeatures.tsx
                y comparte esta advertencia. */}
            {/* §5.1·A · beat 4 (segunda mitad de la capa — ver la autoría). */}
            <motion.p
              data-lp-reveal=""
              className="mt-4 text-[19px] text-[var(--lp-ink-500)] max-w-2xl tracking-[-0.01em] leading-[1.55]"
              initial={{ opacity: 0, y: HERO.y.texto }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? sinMovimiento
                  : { duration: DUR.section, ease: EASE.out, delay: HERO.retraso.texto }
              }
            >
              Expedientes, agenda e inteligencia artificial en una sola plataforma. Sin vendedores, sin trámites.
            </motion.p>

            {/* F1.3·c2 — radio de CONTROL = 12px (`rounded-xl`). Los cuatro
                botones grandes de la landing (estos dos y los dos de
                SeccionCTA) bajaron aquí de 16 a 12: 16 es el radio de las
                SUPERFICIES (cards, bloques navy, foto), y con ambos al mismo
                valor un botón de 48px de alto y una card de 400px leían igual
                de redondeados. La escala completa está declarada en
                SeccionInterfaz.tsx. No los devuelvas a rounded-2xl. */}
            {/* F1.3·c3 — `mt-8` (32), no mt-10: 40 no está en la escala. */}
            {/* §5.1·A · beat 5 — cierra la secuencia del texto. Único sitio
                con `SPRING.soft` (§4.2): un muelle sin rebote visible, que es
                lo que pide la ficha para el par de botones. El contenedor que
                ya existía ES la capa; no se añade ninguno.
                ⚠️ El `scale` de entrada no pelea con el `active:scale-[0.97]`
                de los dos botones: viven en elementos distintos (este div
                contra cada `<Link>`) y son propiedades separadas del árbol de
                transform. El defecto de a2 —motion escribiendo `transform`
                inline y matando la utilidad de Tailwind— aparece cuando LOS
                DOS caen en el mismo elemento, y aquí no es el caso. */}
            <motion.div
              data-lp-reveal=""
              className="mt-8 flex flex-col sm:flex-row items-start gap-3"
              initial={{ opacity: 0, y: HERO.y.ctas, scale: HERO.ctasEscala }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                reducedMotion ? sinMovimiento : { ...SPRING.soft, delay: HERO.retraso.ctas }
              }
            >
              {/* F1.3·c3 — `gap-2` (8), no gap-2.5: 10 no está en la escala.
                  El separador texto↔icono NO es geometría de control (eso es
                  el px-7 py-3.5, que no se toca), y de paso iguala al botón
                  secundario de al lado, que ya usaba gap-2. */}
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-[var(--lp-navy)] to-[var(--lp-accent)] text-[var(--lp-ink-inverse)] px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none shadow-[0_4px_24px_rgb(var(--lp-accent-rgb)/0.3)] hover:shadow-[0_8px_32px_rgb(var(--lp-accent-rgb)/0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-[var(--sp-dur-micro)]"
              >
                Empieza gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-[var(--sp-dur-micro)]" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-[var(--lp-ink-700)] px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none bg-[var(--lp-surface)] border border-[var(--lp-border)] shadow-sm hover:shadow-md hover:border-[var(--lp-border-strong)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-[var(--sp-dur-micro)]"
              >
                Ver planes
              </Link>
            </motion.div>
          </motion.div>

          {/* ═══ CAPTURA REAL DEL PANEL PRINCIPAL (§7·1) — CIERRA LP-DT-17 ═══
              Aquí vivía el marco VACÍO que la deuda registraba, con su lienzo
              `--lp-surface-sunken` y su rótulo de espacio reservado. El marco
              se queda —proporción, cromo y sangrado ya estaban calculados—; lo
              que entra es la captura.

              ⚠️ RECORTE: LA CAPTURA NO ES 16:10 Y NO SE DEFORMA.
              El archivo mide 1882×958 (ratio 1.965), y el marco es 16:10
              (1.6). Para entrar sin deformar (regla 9 del spec de Control: el
              ancho fija la escala, el alto sigue) hay que RECORTAR ancho:
                alto útil     = 958 (todo)
                ancho a 16:10 = 958 × 1.6 = 1532.8 → 1533
                sobran        = 1882 − 1533 = 349px, el 18.5% del ancho
              La región mostrada es x 0–1533, y 0–958. Se recorta por la
              DERECHA, y eso lo decide §3.4·1: esta columna SANGRA por el borde
              del viewport (`lg:rounded-r-none` + el `lg:pr-0` del contenedor),
              o sea que su borde derecho ya está declarado como corte. Lo que
              queda fuera es el panel de accesos rápidos a partir de su mitad y
              la card de DICOM — ningún texto queda partido: las etiquetas del
              panel terminan en x≈1500 y el corte cae en el hueco entre la
              tercera y la cuarta card de módulos.
              Recortar por la izquierda habría costado la barra lateral, que es
              justo lo que §7·9 vende ("sidebar, atajos y expediente
              expandido") y lo que da borde oscuro al lado que toca la columna
              de texto.

              ⚠️ EL RECORTE LO HACE `object-cover` + `object-left`, NO
              ARITMÉTICA A MANO, y la diferencia con `SeccionControl.tsx` es
              deliberada: allí hay que anclar un SUJETO dentro de su bbox alfa
              y por eso se calculan escala, left y top; aquí el recorte es un
              simple anclaje de borde, que CSS resuelve nativamente y sin
              deformar. Si alguna tanda cambia la proporción del marco, el
              recorte se recalcula solo — con offsets a mano habría que
              rehacer los números.

              ⚠️ `priority` PORQUE ES EL LCP, y el `sizes` no es cosmético: el
              marco va `hidden lg:block`, así que por debajo de 1024 la imagen
              no se muestra. El tramo `1px` del `sizes` hace que el preload de
              `priority` elija ahí el candidato más pequeño del srcset en vez
              de bajar la captura entera a un móvil que nunca la va a pintar.
              El 56vw sale de medir el ancho renderizado real: el marco mide
              ~464 CSS px a 1024 y ~720 a 1920, y sobre él `object-cover`
              escala la fuente un 22.8% — pico de ~56vw a 1024, que es el ancho
              relativo mayor de la curva.

              ⚠️ YA NO VA `aria-hidden`. El marco vacío era decorativo; una
              captura del producto no lo es, y su `alt` describe lo que se ve
              en pantalla. El cromo de ventana sí queda oculto a la
              tecnología asistiva: no comunica nada.

              ⚠️ F2.b — LA CAPTURA NO ANIMA `opacity`, Y ES LA DECISIÓN DE ESTA
              TANDA SOBRE EL LCP. §5.1 pedía `opacity 0→1` junto con `y` y
              `scale`. Este elemento es el LCP de la página (por eso lleva
              `priority`), y Chrome DESCARTA como candidato a LCP cualquier
              elemento con opacidad 0: un fundido de entrada mueve la marca
              desde "la imagen pintó" —que con el preload de `priority` ocurre
              antes de que baje el bundle— hasta "hidrató y además terminó la
              animación". En red lenta son segundos contra el presupuesto de
              §4.3·9 (LCP < 2.5s), y por un fundido que nadie estaba pidiendo.
              `y` y `scale` no tienen ese efecto: el elemento SE PINTA, solo que
              desplazado y un 12% menor, y la marca se registra en ese pintado.
              Tampoco hay salto de layout — `transform` no reflowa, así que no
              computa CLS — ni depende de JS: el HTML del servidor ya sale con
              el transform escrito.
              Corolario para cualquier tanda futura: **ninguna capa que
              contenga al LCP puede arrancar en opacidad 0.** */}
          <div className="hidden lg:block">
            {/* §5.1·B (entrada) — el MARCO ENTERO es la capa que sube y asienta
                (120px, .88→1, registro cine). Va en el marco y no en la imagen
                porque lo que entra es "la ventana", con su cromo: partirlos
                delataría el montaje.
                `scale` SIEMPRE < 1 durante el recorrido, y eso importa: esta
                columna sangra por el borde derecho del viewport (ver arriba),
                así que una escala > 1 empujaría su borde fuera del documento y
                un `transform` SÍ genera área desbordable —al contrario que la
                `box-shadow` de la que habla la nota de F1.3·b2—. Sería scroll
                horizontal. Encoger es seguro; agrandar, no. */}
            <motion.div
              data-lp-reveal=""
              className="rounded-2xl lg:rounded-r-none border-[0.5px] border-[var(--lp-border)] bg-[var(--lp-surface)] shadow-sm overflow-hidden"
              initial={{ y: HERO.capturaY, scale: HERO.capturaEscala }}
              animate={{ y: 0, scale: 1 }}
              transition={
                reducedMotion
                  ? sinMovimiento
                  : { duration: DUR.cine, ease: EASE.cine, delay: HERO.retraso.captura }
              }
            >
              {/* F1.3·c3 — `gap-2` (8), no gap-1.5: 6 no está en la escala. */}
              {/* Semáforo macOS: los tres puntos eran `bg-slate-200` (grises).
                  Los colores salen de --lp-chrome-*, declarados en globals.css
                  con la única excepción razonada a §3.1 — son reproducción de
                  un control del sistema operativo, no semántica de producto.
                  Sin sombras dramáticas ni degradados (§3.1): el cromo tiene
                  que desaparecer detrás de la captura, no competir con ella. */}
              <div aria-hidden className="flex items-center gap-2 px-4 py-3 border-b-[0.5px] border-[var(--lp-border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-close)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-min)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--lp-chrome-max)]" />
              </div>
              {/* §5.1·B (deriva) — 1→1.03 mientras el hero termina de cruzar.
                  ⚠️ LA DERIVA VA EN LA CAPTURA, NO EN EL MARCO, y no es una
                  licencia: es lo que dice la ficha ("Captura deriva") y es
                  además lo único que no rompe nada. Sobre el marco, un 1.03
                  empujaría el borde derecho ~11px fuera del viewport —esta
                  columna ya llega justa al borde— y eso es scroll horizontal.
                  Aquí el `overflow-hidden` del marco recorta el excedente y lo
                  que se ve es la captura acercándose dentro de su ventana, que
                  es el gesto que pide el escenario.
                  Es una capa SEPARADA de la entrada de arriba a propósito: dos
                  dueños del mismo `transform` en un solo elemento (uno de
                  carga, otro de scroll) se pisan — el `style` con MotionValue
                  gana y la entrada se pierde. */}
              <motion.div
                data-lp-reveal=""
                className="relative aspect-[16/10]"
                style={{ scale: derivaEscala }}
              >
                <Image
                  src="/landing/dashboard-spinus.png"
                  alt="Panel principal de Spinus: barra lateral con Dashboard, Pacientes, Agenda, Calculadoras, Documentos y Administración; tarjeta de próximas citas con la consulta de un paciente y botones para iniciar consulta o abrir su expediente; y accesos directos a los módulos de expediente, agenda, documentos y visor DICOM."
                  fill
                  sizes="(min-width: 1024px) 56vw, 1px"
                  priority
                  className="object-cover object-left"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
