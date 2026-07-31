'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { DIST, DUR, EASE, SPRING, STAGGER } from '@/components/landing/motion/tokens'

/* Section: Tu práctica, tuya — §7·10b · coreografía en §5.10b
   Cierra el bloque de confianza con las dos garantías que la landing callaba:
   que los expedientes se los puede llevar, y que puede dar de alta a su
   asistente médico.

   ═══ ESQUELETO (§3.4·10b) ═══
   DOS BLOQUES APILADOS, no dos columnas simétricas. El primero es una franja
   horizontal con el texto a la izquierda y un abanico de 3 hojas PDF a la
   derecha; el segundo es un zócalo con la foto anclada a su borde inferior y
   una tarjeta de agenda pisándole el borde derecho.
   ⚠️ EL FILETE DIVISOR VERTICAL YA NO EXISTE. La versión anterior de esta
   sección lo tenía como protagonista, con scaleY ligado al scroll. Al cambiar
   el esqueleto se quedó sin sitio: su ficha se retiró de §5.10b para no dejar
   una instrucción muerta. Si vuelves a ver `useScroll`/`useMotionValue` aquí,
   alguien lo resucitó sin leer esto.

   ⚠️ SUPERFICIE BLANCA — DECISIÓN CERRADA, NO UN PENDIENTE.
   Se intentó dos veces pasarla a franja `#f5f8fc` y las dos se bloqueó por lo
   mismo: el orden real del documento es Historia → ESTA → Seguridad
   (`(landing)/page.tsx`) e Historia está en franja (`SeccionHistoria.tsx:15`),
   así que franja aquí da franja→franja y funde las dos en una banda de
   ~1500px. Historia es la única sección sin contenedor interno que la
   defienda, y esa costura es lo único que la separa.
   RESOLUCIÓN DEL PM (2026-07-31): se queda en BLANCO, y no hace falta más.
   El `#f5f8fc` entra igual por dentro —la franja del bloque 1 y el zócalo del
   bloque 2 lo llevan— así que la sección tiene contraste interno sin pelearse
   con su vecina. No vuelvas a intentarlo sin mover Historia primero.

   ⚠️ EL KICKER NO DICE "TU PRÁCTICA, TUYA". Dice "CONTROL Y AUTONOMÍA".
   El anterior colisionaba con el titular de Seguridad ("Tu práctica,
   protegida"), que queda pocos cientos de px más abajo. Va SIN pastilla:
   Historia y Seguridad usan las dos `bg-blue-50` y una tercera igual
   seguidas serían tres idénticas consecutivas.

   ═══ QUÉ SE DESVÍA DEL SPEC DE DISEÑO, Y POR QUÉ ═══
   El spec se escribió sin conocer el sistema de la página. El PM corrigió
   seis puntos; aquí están aplicados, más un séptimo que se deduce del mismo
   criterio que los otros:
     1. Padding de sección `py-16 sm:py-24 lg:py-32` (64/96/128), no el
        "64px 56px 72px" del spec — contrato de §3.3.
     2. Roles tipográficos de la página, no los del spec: titular 1.10 (no
        1.08), título de bloque -0.015em (no -0.02em), nota 13px (no 14).
     3. Tinta de titulares `#14345c`, no `#1a3a5c`: en esta escala el navy es
        SUPERFICIE, no tinta.
     4. Bordes 0.5px `#e6ebf2` (coincidía). Ojo: Chrome computa 0.5px a 1px a
        DPR 1 — es lo que ya usa toda la página.
     5. Colores fuera de escala sustituidos: barras de texto simulado
        `#eef2f8` → `#e6ebf2`; punteado del hueco libre `#b9c8dc` → `#cad5e2`.
     6. La regla 7 del spec ("sin animaciones de entrada") queda ANULADA: esta
        sección anima, ver §5.10b.
     7. ⚠️ AÑADIDO POR MÍ, mismo criterio que (1): los gaps de RITMO del spec
        tampoco están en la escala de §3.3 y se bajaron al peldaño inmediato.
        Titular→bloques 56/36 → **48/32**; gap interno del bloque 1 56 → **48**;
        padding del bloque 1 "36px 40px" → **32** (`p-8`, el mismo que las
        cards de Seguridad). El precedente es explícito: la tanda c3 rechazó
        56 por este mismo motivo ("mb-14: 56 no está en la escala").
        Lo que NO se tocó es la GEOMETRÍA de componente —tamaños de hoja, del
        marco, de la tarjeta, sus paddings internos—, que queda fuera de §3.3
        por la decisión de c1 documentada en `SeccionHero.tsx`. */

/* ⚠️ EL COPY ESTÁ ACOTADO A LO VERIFICADO EN CÓDIGO y es el del spec, literal.
   NO lo ensanches:
     · "de cualquier paciente", NUNCA "todos los expedientes": el botón recibe
       UN paciente (`ExportarExpedienteButton.tsx:30`). No hay export masivo.
     · "historial clínico", NUNCA "expediente completo": el PDF lleva hoja
       frontal + notas y NO recetas, documentos, laboratorios ni DICOM
       (`ExpedienteCompletoPdf.tsx:25-29`).
     · "en tu dispositivo": 100% cliente (`mobileShare.ts:1-12`).
     · "si algún día dejas de usar Spinus…": las 9 policies RESTRICTIVE de
       gate son `FOR INSERT` y los SELECT no están gateados.
     · "asistente médico", NUNCA "secretaria". El enum de la BD sigue siendo
       `secretaria` y NO se toca (`permissions.ts:52-54`). Ver LP-DT-23.
     · "da de alta", NUNCA "invita": no hay correo de invitación.
     · Guion largo con espacios, sin emoji. */

/* Las 3 hojas del abanico, con la geometría del spec.
   ⚠️ EL ORDEN DEL ARRAY NO ES IZQUIERDA→DERECHA: es A(izq) · C(der) · B(centro).
   Sirve para dos cosas a la vez y por eso no se reordena:
     · PINTADO — el spec pide que la hoja central vaya AL FRENTE. Poniéndola
       última en el DOM queda encima sin necesidad de `z-index`.
     · ENTRADA — el mazo se arma HACIA el lector: las dos de atrás primero
       (delay 0 y 90ms) y la de delante al final (180ms). El delay sale del
       índice, así que el orden del array ES la coreografía.
   `barras` son los anchos de las dos líneas de texto simulado de cada hoja. */
const HOJAS = [
  { pos: 'left-0 top-2 md:top-2.5', rot: '-rotate-[8deg]', barras: ['72%', '88%'] },
  { pos: 'left-[104px] top-2 md:left-[124px] md:top-2.5', rot: 'rotate-[8deg]', barras: ['66%', '84%'] },
  { pos: 'left-[52px] top-0.5 md:left-[62px] md:top-1', rot: '', barras: ['80%', '64%'] },
] as const

/* Las 3 filas de la tarjeta de agenda. `estado` decide el relleno:
   existente = cita ya agendada · creada = la que acaba de meter el asistente
   (único azul sólido de la sección) · libre = hueco, punteado sin relleno. */
const FILAS = [
  { hora: '09:30', estado: 'existente' },
  { hora: '11:00', estado: 'creada' },
  { hora: '12:15', estado: 'libre' },
] as const

export default function SeccionControl() {
  /* Un solo `useReducedMotion` para toda la sección. NO ramifica el render: el
     árbol de DOM es idéntico con y sin la preferencia (ramificarlo provoca
     hydration mismatch — ver `Reveal.tsx`). Lo único que cambia es la
     transición, que se pone a 0; el estado final lo fuerza la regla
     `[data-lp-reveal]` de globals.css dentro de @media prefers-reduced-motion. */
  const sinMovimiento = useReducedMotion()
  const transicion = sinMovimiento ? { duration: 0, delay: 0 } : undefined

  return (
    /* ⚠️ `overflow-x-clip` NO ES DECORATIVO: corrige un desborde REAL medido.
       La tarjeta entra con `x: 24` y en móvil su borde en reposo queda a 374
       de un viewport de 390 — solo 16px de holgura—, así que MIENTRAS DURA LA
       ENTRADA sobresale 8px y el documento gana scroll horizontal. Medido con
       prueba causal: ocultando solo la tarjeta, `scrollWidth` cae de 398 a 390.
       Es la trampa que la regla "solo transform y opacity" no cubre: un
       `transform` no provoca relayout, pero SÍ cuenta para el área
       desbordable. `clip` y no `hidden` a propósito: `hidden` crearía un
       contenedor de scroll y además arrastraría el eje Y a `auto`, mientras
       que `overflow-x: clip` con el eje Y en `visible` es una combinación
       legal que no coerciona — y el eje Y hay que dejarlo intacto porque la
       tarjeta desborda 24px por abajo en móvil a propósito (`-bottom-6`). */
    <section className="bg-white overflow-x-clip">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* §5.10b · capa 1 — el encabezado entra como UN bloque (kicker y
            titular juntos) para no gastar dos capas del presupuesto. */}
        <motion.div
          data-lp-reveal=""
          className="max-w-2xl mb-8 lg:mb-12"
          initial={{ opacity: 0, y: DIST.reveal }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={transicion ?? { duration: DUR.section, ease: EASE.out }}
        >
          {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
          <p className="text-[12px] font-semibold text-[#1e5fa8] uppercase tracking-[0.12em] leading-none">
            Control y autonom&iacute;a
          </p>
          {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em · 1.10. */}
          <h2 className="mt-4 text-[clamp(30px,4vw,46px)] font-bold text-[#14345c] tracking-[-0.03em] leading-[1.10]">
            Tu informaci&oacute;n y tu equipo, bajo tu control
          </h2>
        </motion.div>

        {/* Regla 3 del spec: el aire entre hermanos con `gap`, nunca márgenes
            sueltos. 24 en móvil / 32 en escritorio, los dos en escala. */}
        <div className="flex flex-col gap-6 lg:gap-8">
          {/* ═══════════ BLOQUE 1 — expedientes portables ═══════════ */}
          <div className="rounded-2xl border-[0.5px] border-[#e6ebf2] bg-[#f5f8fc] p-8 grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-12 lg:items-center">
            <div>
              {/* ═══ H3 DE BLOQUE A 24px — EXCEPCIÓN DECLARADA ═══
                  El rol H3 de card de F1.3·d4 son 19px y cubre 11 instancias
                  (5 del bento, 3 de Portabilidad, 3 de Seguridad). Estos dos
                  NO entran: no encabezan una card de retícula, encabezan un
                  bloque que carga su propio visual —un abanico de 150px y un
                  zócalo de 410px—. A 19px el título quedaba por debajo de su
                  propia ilustración y el bloque perdía cabeza. 24 es el
                  escalón que faltaba entre el titular de sección (30–46) y el
                  rol de card (19), y solo se justifica donde hay DOS bloques,
                  no once tarjetas.
                  Tracking y leading SÍ son los del rol (−0.015em / 1.30): lo
                  que cambia es el tamaño, no el ajuste óptico. El spec pedía
                  −0.02em; manda el rol. Si una tanda futura mete un tercer
                  sitio con visual propio, este 24 pasa a ser rol y se declara
                  en §3.2. */}
              <h3 className="text-[24px] font-semibold text-[#14345c] tracking-[-0.015em] leading-[1.30]">
                Tus expedientes son tuyos
              </h3>
              {/* F1.3·d3 — rol cuerpo: 17px · tracking normal · 1.65. */}
              <p className="mt-3 max-w-[560px] text-[17px] text-[#3b4a5c] leading-[1.65]">
                Descarga el historial cl&iacute;nico de cualquier paciente en PDF cuando quieras. Se genera en tu dispositivo, sin pasar por nuestros servidores. Y si alg&uacute;n d&iacute;a dejas de usar Spinus, tus expedientes siguen ah&iacute; y los sigues pudiendo descargar.
              </p>
            </div>

            {/* Abanico. Contenedor 236×126 en móvil, 280×150 desde md.
                Centrado por debajo de lg, donde el bloque es una columna. */}
            <div className="relative mx-auto h-[126px] w-[236px] md:h-[150px] md:w-[280px] lg:mx-0" aria-hidden>
              {HOJAS.map((hoja, i) => (
                /* ⚠️ LA ROTACIÓN DEL ABANICO VIVE EN ESTE WRAPPER, NO EN LA
                   CAPA ANIMADA. El motivo: `motion` escribe su `rotate`
                   animado DENTRO de `transform` inline, y la regla
                   `[data-lp-reveal]` fuerza `transform: none !important` bajo
                   reduced-motion. Todo lo que dependa de ese transform
                   desaparece con la preferencia activa. Con la rotación en un
                   wrapper propio, queda fuera del alcance de motion.

                   ⚠️ MATIZ MEDIDO, porque el razonamiento obvio es INCOMPLETO:
                   Tailwind 4 NO compila `rotate-[8deg]` a `transform:
                   rotate()`, sino a la propiedad independiente `rotate:
                   -8deg` — y `transform: none` no la toca. Verificado: con
                   prefers-reduced-motion el computed del wrapper es
                   `rotate: -8deg` / `transform: none`, y el abanico se ve
                   entero. O sea que en ESTE código el abanico sobreviviría
                   incluso sin wrapper.
                   El wrapper se queda igual porque no depende de ese detalle
                   del compilador: la versión anterior de esta sección ponía la
                   rotación en un `style={{ transform: 'rotate(...)' }}`, y ahí
                   sí era un `transform` de verdad. Si alguien vuelve a hacerlo
                   así sobre la capa animada, el abanico SE APLANA en tres
                   hojas idénticas superpuestas. */
                <div key={i} className={`absolute ${hoja.pos} ${hoja.rot}`}>
                  {/* §5.10b · capa de hojas: cascada desde abajo y rotadas,
                      stagger 90ms (`STAGGER.deck`), spring soft. */}
                  <motion.div
                    data-lp-reveal=""
                    className="relative h-[112px] w-[88px] rounded-lg border-[0.5px] border-[#e6ebf2] bg-white px-3 pt-3.5 md:h-[132px] md:w-[104px]"
                    initial={{ opacity: 0, y: 28, rotate: -10, scale: 0.94 }}
                    whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={transicion ?? { ...SPRING.soft, delay: i * STAGGER.deck }}
                  >
                    <div className="flex flex-col gap-1.5">
                      {hoja.barras.map((ancho) => (
                        <div key={ancho} className="h-1 rounded-[2px] bg-[#e6ebf2]" style={{ width: ancho }} />
                      ))}
                    </div>
                    <span className="absolute bottom-3 left-3 text-[10px] font-bold text-[#1e5fa8] md:text-[11px]">PDF</span>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════ BLOQUE 2 — asistente médico ═══════════
              Regla 8 del spec: dos columnas desde 1024 con la visual a 520px;
              entre 768 y 1024, dos columnas con la visual a 420px; por debajo
              de 768, una columna. `items-end` alinea los dos por abajo, que es
              lo que hace que la figura se apoye en la línea del texto. */}
          <div className="grid gap-6 md:grid-cols-[420px_1fr] md:items-end md:gap-12 lg:grid-cols-[520px_1fr]">
            {/* Columna visual. El `mb-7` de móvil NO es ritmo y por eso escapa
                a §3.3: la tarjeta sobresale 24px por debajo del contenedor
                (`-bottom-6`), y un `gap` no puede compensar un desbordamiento
                —mide desde el borde de la caja, no desde lo que se sale—. Los
                28px dejan 4px de aire real bajo la tarjeta. Sin
                `overflow-hidden` aquí: lo recortaría. */}
            <div className="relative mb-7 h-[284px] md:mb-0 md:h-[358px] lg:h-[410px]">
              {/* §5.10b · capa 2 — zócalo + foto entran JUNTOS como una pieza.
                  `origin-bottom` porque la regla 4 del spec exige que la
                  figura quede anclada al borde inferior del zócalo: escalando
                  desde el centro, el anclaje se rompería durante la entrada.
                  Escala final 1 → bajo reduced-motion `transform: none` da el
                  estado correcto sin trabajo extra. */}
              <motion.div
                data-lp-reveal=""
                className="absolute inset-0 origin-bottom"
                initial={{ opacity: 0, scale: 0.72 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={transicion ?? SPRING.soft}
              >
                {/* Zócalo. Arranca 24px más abajo (20 en móvil) para que la
                    figura sobresalga por arriba. */}
                <div className="absolute inset-x-0 bottom-0 top-5 rounded-2xl border-[0.5px] border-[#e6ebf2] bg-[#f5f8fc] md:top-6" />
                {/* Marco de la foto, anclado al borde inferior del zócalo.
                    ⚠️ EL RECORTE ES GEOMETRÍA CALCULADA, NO UN ENCUADRE A OJO.
                    Recorta el PNG original (1281×832) a la región x 369–1009,
                    y 10–832 — comprobado que contiene el bbox real del sujeto,
                    que medido sobre el canal alfa es x 384–991, y 44–831.
                    Si el asset cambia, RECALCULA con la fórmula del spec:
                      escala   = anchoDelMarco / anchoDeLaRegión
                      imgWidth = anchoOriginal × escala
                      left     = −xRegión × escala
                      top      = −yRegión × escala
                    Los tres juegos de valores salen de ahí y cuadran:
                      lg  300/640=0.46875 → 601 · −173 · −5   (alto 386)
                      md  260/640=0.40625 → 521 · −150 · −4   (alto 334)
                      sm  202/640=0.31563 → 404 · −117 · −3   (alto 260)
                    `max-w-none` es obligatorio: el preflight de Tailwind pone
                    `max-width:100%` a toda `img` y aplastaría el encuadre.
                    `h-auto` cumple la regla 9 — el ancho fija la escala y el
                    alto sigue; nunca se deforma. */}
                <div className="absolute bottom-0 left-1.5 h-[260px] w-[202px] overflow-hidden md:left-6 md:h-[334px] md:w-[260px] lg:h-[386px] lg:w-[300px]">
                  <Image
                    src="/landing/asistente-medico.png"
                    alt="Asistente médica de clínica sosteniendo expedientes"
                    width={1281}
                    height={832}
                    sizes="(min-width: 1024px) 601px, (min-width: 768px) 521px, 404px"
                    className="absolute -left-[117px] -top-[3px] h-auto w-[404px] max-w-none md:-left-[150px] md:-top-[4px] md:w-[521px] lg:-left-[173px] lg:-top-[5px] lg:w-[601px]"
                  />
                </div>
              </motion.div>

              {/* §5.10b · capa 3 — la tarjeta entra 180ms DESPUÉS del avatar.
                  El retraso es el contenido: primero está la asistente, luego
                  aparece la cita. Sin él se lee como decoración simultánea.
                  Regla 6 del spec: es decorativa, así que `aria-hidden` — lo
                  que dice ya está en el cuerpo del texto de al lado.
                  Regla 5: pisa el borde derecho del marco sin tapar las manos.
                  A 1440 el marco acaba en x=324 y la tarjeta abre en x=304:
                  20px de solape, dentro del máximo de 20–36 que fija el spec. */}
              <motion.div
                data-lp-reveal=""
                aria-hidden
                className="absolute -bottom-6 right-0 w-[178px] overflow-hidden rounded-xl border-[0.5px] border-[#e6ebf2] bg-white md:bottom-7 md:w-[168px] lg:w-[216px]"
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={transicion ?? { ...SPRING.soft, delay: 0.18 }}
              >
                <div className="flex items-center justify-between border-b-[0.5px] border-[#e6ebf2] px-3 py-2.5">
                  <span className="text-[11.5px] font-semibold text-[#14345c] lg:text-[12px]">Agenda &middot; martes</span>
                  {/* Dos rótulos con visibilidad por breakpoint en vez de uno
                      recortado por JS: el árbol de DOM queda idéntico en
                      servidor y cliente, sin matchMedia ni hydration mismatch. */}
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5a6b81] lg:text-[10px]">
                    <span className="lg:hidden">Asist.</span>
                    <span className="hidden lg:inline">Asistente</span>
                  </span>
                </div>
                <div className="flex flex-col gap-[7px] px-3 py-2.5">
                  {FILAS.map((fila) => (
                    <div key={fila.hora} className="flex items-center gap-2">
                      <span
                        className={`w-8 shrink-0 text-[10.5px] lg:w-9 lg:text-[11px] ${
                          fila.estado === 'creada' ? 'font-semibold text-[#1e5fa8]' : 'text-[#5a6b81]'
                        }`}
                      >
                        {fila.hora}
                      </span>
                      {fila.estado === 'creada' ? (
                        <span className="flex h-5 flex-1 items-center rounded-md bg-[#1e5fa8] px-[9px] text-[9.5px] font-semibold text-white lg:h-[22px] lg:rounded-[7px] lg:text-[10px]">
                          Cita creada
                        </span>
                      ) : (
                        <span
                          className={`h-5 flex-1 rounded-md lg:h-[22px] lg:rounded-[7px] ${
                            fila.estado === 'existente'
                              ? 'border-[0.5px] border-[#e6ebf2] bg-[#f5f8fc]'
                              : 'border-[0.5px] border-dashed border-[#cad5e2]'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t-[0.5px] border-[#e6ebf2] bg-[#f5f8fc] px-3 py-[9px] text-[10px] text-[#5a6b81] lg:text-[10.5px]">
                  Expedientes y notas &middot; sin acceso
                </div>
              </motion.div>
            </div>

            {/* Columna de texto */}
            <div className="md:pb-6">
              <h3 className="text-[24px] font-semibold text-[#14345c] tracking-[-0.015em] leading-[1.30]">
                Tu asistente m&eacute;dico, en la misma cuenta
              </h3>
              {/* F1.3·d4 — rol caption: 13px · 1.45. El spec pedía 14; manda el
                  rol de la página. Ver SeccionFooter.tsx. */}
              <p className="mt-2 text-[13px] text-[#5a6b81] leading-[1.45]">
                (disponible en cuentas de cl&iacute;nica)
              </p>
              <p className="mt-3 max-w-[520px] text-[17px] text-[#3b4a5c] leading-[1.65]">
                Da de alta a tu asistente para que gestione tu agenda: crea, mueve y cancela citas. T&uacute; llegas y tu paciente ya est&aacute; en tu consulta. Sin acceso a expedientes ni a notas cl&iacute;nicas &mdash; solo a la agenda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
