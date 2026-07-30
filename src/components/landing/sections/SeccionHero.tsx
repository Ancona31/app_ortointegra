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
            <p className="text-[11px] font-semibold text-[#1e5fa8] uppercase tracking-wider">
              Expediente clínico electrónico para consultorios privados
            </p>

            <h1 className="mt-4 text-[40px] sm:text-[56px] font-bold text-slate-900 tracking-tight leading-[1.1]">
              Menos tiempo en la pantalla,
              <br />
              <span className="bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent">
                más tiempo con tu paciente
              </span>
            </h1>

            <p className="mt-5 text-[15px] sm:text-[17px] font-semibold text-[#1e5fa8]/80 tracking-wide italic">
              Creada por un cirujano de columna que la usa todos los días
            </p>

            <p className="mt-4 text-[17px] sm:text-[19px] text-slate-500 max-w-2xl leading-relaxed">
              Expedientes, agenda e inteligencia artificial en una sola plataforma. Sin vendedores, sin trámites.
            </p>

            {/* F1.3·c2 — radio de CONTROL = 12px (`rounded-xl`). Los cuatro
                botones grandes de la landing (estos dos y los dos de
                SeccionCTA) bajaron aquí de 16 a 12: 16 es el radio de las
                SUPERFICIES (cards, bloques navy, foto), y con ambos al mismo
                valor un botón de 48px de alto y una card de 400px leían igual
                de redondeados. La escala completa está declarada en
                SeccionInterfaz.tsx. No los devuelvas a rounded-2xl. */}
            <div className="mt-10 flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-xl text-[15px] font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                Empieza gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-slate-700 px-7 py-3.5 rounded-xl text-[15px] font-semibold bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
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
              <div className="flex items-center gap-1.5 px-4 py-3 border-b-[0.5px] border-[#e6ebf2]">
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
