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

      {/* pb-24 = 96px: mínimo de aire de §3.3 en la costura con Features, que
          no declara padding superior. Los 128/72 generales son F1.3.
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
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-20 sm:pt-28 pb-24 lg:max-w-none lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))] lg:pr-0">
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

            <div className="mt-10 flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                Empieza gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-slate-700 px-7 py-3.5 rounded-2xl text-[15px] font-semibold bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
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
