'use client'

import Image from 'next/image'
import { Activity } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Parallax from '@/components/landing/motion/Parallax'
import Reveal from '@/components/landing/motion/Reveal'
import Stagger, { VARIANTES_ITEM } from '@/components/landing/motion/Stagger'
import { DUR, EASE } from '@/components/landing/motion/tokens'

/* Section: La Historia de Spinus
   Superficie FRANJA (§3.1). No es solo alternancia: Problema e Historia son
   las dos únicas secciones sin ningún contenedor interno que las defienda, y
   esta franja es lo único que separa a Historia de sus vecinas. Queda entre Interfaz
   (blanca) y Seguridad (blanca) — corte por ambos lados. Si alguna futura
   tanda la pasa a blanco, Historia y Seguridad se funden en una sola mancha
   de ~1400px. Verificar ese par antes de tocar esta línea. */
export default function SeccionHistoria() {
  /* Un solo `useReducedMotion` para la sección, sin ramificar el render
     (§4.3·7). Ver `Reveal.tsx`. */
  const sinMovimiento = useReducedMotion()
  const transicionItem = sinMovimiento
    ? { duration: 0 }
    : { duration: DUR.section, ease: EASE.out }

  return (
    <section className="bg-[var(--lp-surface-alt)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* F1.3·c3 — `lg:gap-24` (96). Ver SeccionExpediente.tsx. */}
        {/* §5.11 · F2.a·a1 — EL `<Reveal>` ES LA RETÍCULA, mismo criterio que
            Expediente e Interfaz.
            ⚠️ §5.11 NO PIDE UN REVEAL: su ficha dice "`Parallax` leve en
            retrato + `Stagger` de párrafos", y las dos cosas son a4 y a2.
            Este reveal lo añade el PM en a1 para que las ocho secciones
            quietas entren igual; las dos capas de la ficha anidan dentro, no
            lo sustituyen. Si a4 encuentra el retrato ya moviéndose, es por
            esto y no es un duplicado. */}
        <Reveal className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Foto del Dr. Ancona — §7·11 retira el badge de estetoscopio que
              flotaba sobre la esquina: adorno sin contenido sobre un retrato
              real. Pendiente (deuda, no bloqueante): foto en pasillo de
              hospital sin fondo IA, recorte hombros-arriba. */}
          {/* ═══ §5.11 · F2.a·a4 — "Parallax leve en retrato" ═══
              Es el ÚNICO de los siete que la ficha pedía literalmente sobre el
              elemento que se mueve, y el único caso limpio de manual: la foto
              tiene columna propia, así que no hay hermano al que pisar. Los
              otros seis tuvieron que pasar del titular al bloque o a la
              columna — ver `Parallax.tsx`.
              ⚠️ EL `Parallax` TOMA EL `flex justify-center` EN VEZ DE ENVOLVER
              LA IMAGEN, y no es cosmético: la `<Image>` lleva `w-full
              max-w-[420px]`, y ese `w-full` se resuelve contra su padre. Con un
              envoltorio de ancho ajustado al contenido, el ancho de la imagen
              pasaría a depender de sí mismo. Tomando la clase, la imagen sigue
              siendo hija directa del mismo contenedor flex de siempre.
              Holgura vertical: la columna vive en un grid `items-center` con
              `py-16` (64px) de sección, y en móvil queda a `gap-12` (48px) del
              texto — los ±24 despejan en los dos casos. */}
          <Parallax className="flex justify-center">
            <Image
              src="/landing/dr-ancona.jpg"
              alt="Dr. Ángel M. Ancona Pérez — Fundador de Spinus"
              width={480}
              height={600}
              className="rounded-2xl shadow-xl object-cover w-full max-w-[420px]"
            />
          </Parallax>

          {/* Narrativa */}
          <div>
            {/* F1.3·e3 — la pastilla de kicker es la MISMA en las cinco:
                --lp-accent-bg de fondo, --lp-accent en icono y texto. Aquí solo
                cambia el hex literal por la variable (el color no se mueve). */}
            <div className="inline-flex items-center gap-2 bg-[var(--lp-accent-bg)] rounded-full px-3.5 py-1 mb-6">
              <Activity className="w-3.5 h-3.5 text-[var(--lp-accent)]" />
              {/* §7·11: "MI historia", nunca "nuestra" — no hay equipo. El
                  uppercase lo pone el CSS, como en los kickers hermanos. */}
              {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
              <span className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none">Mi historia</span>
            </div>

            {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
                1.10. Ver SeccionFeatures.tsx. */}
            <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.03em] leading-[1.10]">
              La Historia de{' '}
              {/* F1.3·e3 — ERA UN DEGRADADO RECORTADO, gemelo del que había en
                  el H1 del hero. Aquí el peor punto del barrido daba 3.16:1
                  sobre el blanco de la sección — a 0.16 de fallar AA en un
                  titular. Sólido en --lp-accent da 6.05:1. Ver la nota larga en
                  SeccionHero.tsx. */}
              <span className="text-[var(--lp-accent)]">
                Spinus
              </span>
            </h2>

            {/* ⚠️ ESTOS 4 PÁRRAFOS SIGUEN EN TERCERA PERSONA A PROPÓSITO.
                §7·11 exige PRIMERA persona ("un software hecho por un médico"
                → "lo hice yo"), pero convertirlos no es cambiar pronombres:
                es reescribir la narrativa entera, y ese texto lo escribe
                Angel (pendiente §9). c2 solo aplicó lo mecánico: badge,
                cierre del 4º párrafo, DICOM en la lista de módulos, grafía
                "Ángel" y cédulas. NO lo tomes por olvido ni lo redactes tú. */}
            {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx.
                Único sitio donde el rol vive en el CONTENEDOR y no en el <p>:
                los 4 párrafos lo heredan. Se deja así a propósito —repetir la
                clase cuatro veces no añade nada—, pero ojo: esto es herencia
                sobre un div concreto, NO un selector. Si añades un 5º párrafo
                aquí dentro, hereda solo. Si lo sacas fuera de este div,
                dale la clase a mano. */}
            {/* ═══ §5.11 · STAGGER DE LOS 4 PÁRRAFOS, 70ms (F2.a·a2) ═══
                "Movimiento = calma": son hermanos, no una secuencia, así que
                van a `STAGGER.siblings` y no a `list`.
                ⚠️ EL `<Stagger>` HEREDA LAS CLASES DE TEXTO DEL DIV QUE
                SUSTITUYE, y eso es condición para que esto siga funcionando:
                el comentario de d3 de abajo avisa de que este es el único
                sitio de la landing donde el rol CUERPO vive en el CONTENEDOR y
                los 4 párrafos lo heredan. `Stagger` renderiza un `div` con la
                misma `className`, así que la cadena de herencia no se mueve —
                pero si alguien le quita la clase al contenedor, los cuatro
                párrafos caen al tamaño por defecto de golpe. */}
            <Stagger className="mt-6 space-y-4 text-[17px] text-[var(--lp-ink-700)] leading-[1.65]">
              <motion.p data-lp-reveal="" variants={VARIANTES_ITEM} transition={transicionItem}>
                Todo empezó en un quirófano. Entre cirugías de columna, notas médicas escritas a mano y un software que tardaba más en cargar que la propia consulta, el <strong className="text-[var(--lp-ink-900)]">Dr. Ángel Ancona</strong> se hizo una pregunta simple: <em className="text-[var(--lp-accent)]">&ldquo;¿Por qué la tecnología médica no funciona como la tecnología que usamos en nuestra vida diaria?&rdquo;</em>
              </motion.p>
              <motion.p data-lp-reveal="" variants={VARIANTES_ITEM} transition={transicionItem}>
                La respuesta no existía. Los sistemas de expedientes electrónicos estaban diseñados por ingenieros que nunca habían pisado un consultorio a las 7 de la mañana con 20 pacientes esperando. Eran lentos, complejos y pensados para cumplir regulaciones — no para ayudar al médico.
              </motion.p>
              <motion.p data-lp-reveal="" variants={VARIANTES_ITEM} transition={transicionItem}>
                Así nació <strong className="text-[var(--lp-ink-900)]">Spinus</strong>. El nombre viene de la raíz latina <em>spina</em> — columna. Porque así como la columna vertebral es el eje que sostiene y conecta todo el cuerpo humano, Spinus es el eje tecnológico que sostiene y conecta toda tu práctica médica: expedientes, agenda, recetas, laboratorios, imagen DICOM e inteligencia artificial en un solo lugar.
              </motion.p>
              <motion.p data-lp-reveal="" variants={VARIANTES_ITEM} transition={transicionItem}>
                {/* §7·11: "y el de miles de colegas" implicaba una base de
                    usuarios que no existe. El producto está en beta. */}
                No es un software hecho por una empresa de tecnología que luego buscó médicos. Es un software hecho por un médico que aprendió tecnología para resolver su propio problema — uno que comparten miles de colegas.
              </motion.p>
            </Stagger>

            {/* F1.3·b2: divisor de firma a 0.5px/#e6ebf2.
                F1.3·c3: `mt-8` (32), no mt-10 — 40 no está en la escala.
                Y el `mt-2` de abajo era `mt-1` (4): se resolvió como RITMO,
                no como interlínea óptica. El criterio de c3: el `mt-0.5` de
                2px corrige un desalineamiento geométrico entre un cuadro de
                icono y la primera línea de texto; aquí no hay nada que
                corregir — son dos bloques de texto apilados en flujo normal
                y los 4px se PERCIBEN como espacio. Sube a 8, que es además
                el valor que ya usaba el par título→descripción de las cards
                del bento (SeccionFeatures.tsx). */}
            <div className="mt-8 pt-6 border-t-[0.5px] border-[var(--lp-border)]">
              {/* F1.3·d4 — LA FIRMA NO TOMA ROL, pero se calibra al PAR DEL H3
                  DE CARD: 19px · -0.015em · 1.30 (ver SeccionFeatures.tsx).
                  Sube desde 17, donde coincidía con el cuerpo que tiene encima
                  y se leía como un párrafo más en vez de como el rótulo que
                  cierra la narrativa. No es H3 de card —no hay card— pero
                  necesita el mismo peso visual: es un nombre propio actuando
                  de rótulo. Su `tracking-tight` (-0.025em) baja a -0.015em por
                  lo mismo. Debajo va su cargo, que sí es caption. */}
              <p className="text-[19px] font-bold text-[var(--lp-ink-900)] tracking-[-0.015em] leading-[1.30]">
                Dr. Ángel M. Ancona Pérez
              </p>
              {/* F1.3·d4 — rol caption: 13px · 1.45. Ver SeccionFooter.tsx. */}
              <p className="text-[13px] text-[var(--lp-accent)] font-semibold leading-[1.45] mt-2">
                Fundador, Traumatólogo y Cirujano de Columna
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
