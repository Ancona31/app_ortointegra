'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
export default function SeccionHero() {
  return (
    <section style={{ background: 'color-mix(in srgb, #1e5fa8 4%, #fff)' }}>
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
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-24 lg:pt-32 pb-24 lg:max-w-none lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] lg:pr-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
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
            <p className="text-[12px] font-semibold text-[#1e5fa8] uppercase tracking-[0.12em] leading-none">
              Expediente clínico electrónico para consultorios privados
            </p>

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

                El <br /> de abajo es duro y no es responsive (a diferencia
                del `hidden sm:block` que usan los h2 de dos líneas). A 72px
                el corte forzado es lo que sostiene el balance de las dos
                mitades de la frase; a 40px cae igual donde caería solo. */}
            <h1 className="mt-4 text-[clamp(40px,7vw,72px)] font-bold text-slate-900 tracking-[-0.04em] leading-[1.02]">
              Menos tiempo en la pantalla,
              <br />
              <span className="bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent">
                más tiempo con tu paciente
              </span>
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
            <p className="mt-6 text-[17px] font-semibold text-[#1e5fa8]/80 italic leading-[1.65]">
              Creada por un cirujano de columna que la usa todos los días
            </p>

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
            <p className="mt-4 text-[19px] text-slate-500 max-w-2xl tracking-[-0.01em] leading-[1.55]">
              Expedientes, agenda e inteligencia artificial en una sola plataforma. Sin vendedores, sin trámites.
            </p>

            {/* F1.3·c2 — radio de CONTROL = 12px (`rounded-xl`). Los cuatro
                botones grandes de la landing (estos dos y los dos de
                SeccionCTA) bajaron aquí de 16 a 12: 16 es el radio de las
                SUPERFICIES (cards, bloques navy, foto), y con ambos al mismo
                valor un botón de 48px de alto y una card de 400px leían igual
                de redondeados. La escala completa está declarada en
                SeccionInterfaz.tsx. No los devuelvas a rounded-2xl. */}
            {/* F1.3·c3 — `mt-8` (32), no mt-10: 40 no está en la escala. */}
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
              {/* F1.3·c3 — `gap-2` (8), no gap-2.5: 10 no está en la escala.
                  El separador texto↔icono NO es geometría de control (eso es
                  el px-7 py-3.5, que no se toca), y de paso iguala al botón
                  secundario de al lado, que ya usaba gap-2. */}
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                Empieza gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-slate-700 px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                Ver planes
              </Link>
            </div>
          </div>

          {/* Espacio reservado para la captura real de la agenda (§7·1).
              F0.c mete aquí la captura; hasta entonces el marco va VACÍO a
              propósito. NO dibujar interfaz en JSX: sería una UI falsa, el
              mismo defecto de LP-DT-13. Ver LP-DT-17. */}
          <div aria-hidden className="hidden lg:block">
            <div className="rounded-2xl lg:rounded-r-none border-[0.5px] border-[#e6ebf2] bg-white shadow-sm overflow-hidden">
              {/* F1.3·c3 — `gap-2` (8), no gap-1.5: 6 no está en la escala. */}
              <div className="flex items-center gap-2 px-4 py-3 border-b-[0.5px] border-[#e6ebf2]">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              </div>
              <div className="aspect-[16/10] bg-[var(--sp-surface-muted)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
