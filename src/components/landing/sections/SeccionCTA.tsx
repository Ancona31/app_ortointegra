'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* CTA
   Lavado de --cs al 4% (§3.1, banda 3–5%) — sustituye al NeuralBackground.
   La <section> es full-bleed para que el lavado no quede como banda centrada;
   la restricción de ancho baja al <div> interior.

   F1.3·e5 — el lavado sale de --lp-wash. La prohibición vieja de este
   comentario ("hex literal, NO var(--cs): el provider que la define solo se
   monta en (app)/layout.tsx") SIGUE SIENDO CORRECTA y no se relajó: --cs y
   los demás --sp-* siguen prohibidos aquí por ese motivo exacto. Lo que
   cambió es que --lp-wash se declara en globals.css, que la landing pública
   sí carga, y que no se redefine bajo html.dark. Con fallback sólido propio.
   Es la misma variable que abre la página en SeccionHero.tsx. */
export default function SeccionCTA() {
  return (
    <section style={{ background: 'var(--lp-wash)' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* Degradado VERTICAL (to-b). §7·13 prohíbe izq→der aquí: en un bloque
            de ancho completo el eje horizontal delata la caja y parte el
            titular en dos temperaturas. El par de color no cambia. */}
        {/* F1.3·c2 — 16px (`rounded-2xl`), no 24. Los dos bloques navy de la
            landing (este y el de SeccionIA) eran las dos únicas superficies a
            rounded-3xl: un tercer radio existiendo solo para ellos. 16 es el
            valor de superficie del sistema y aquí no hay motivo para excepción.
            Ver la escala completa en SeccionInterfaz.tsx. */}
        {/* F1.3·c3 — `p-8 sm:p-12` (32/48), no 40/56. Ver SeccionIA.tsx: los
            dos bloques navy comparten padding interior. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[var(--lp-navy)] to-[var(--lp-accent)] p-8 sm:p-12 text-center shadow-[0_8px_32px_rgb(var(--lp-accent-rgb)/0.3)]">
          {/* Shine overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--lp-surface-inverse-10)] via-transparent to-transparent pointer-events-none" />

          {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
              1.10. Ver SeccionFeatures.tsx. Junto con el de SeccionIA, el que
              más sube (venía de 24/30px). Antes no declaraba leading y tomaba
              el del <body>; ahora lo declara como los otros siete.

              Este gana UNA LÍNEA (medido a 1280: 2L/90px → 3L/152px, +62 de
              bloque, +61 de sección) porque su `max-w-2xl` (672px) es más
              estrecho que lo que el clamp asume: a partir de ~1150px el
              tamaño topa en 46 pero la caja no crece. Es el titular que más
              alto añade de los ocho, y se aceptó. Si una tanda futura quiere recuperar esos 62px, el
              cambio es el max-w, no el tamaño — el rol no se rompe por una
              sección. */}
          <h2 className="relative text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-inverse)] tracking-[-0.03em] leading-[1.10] max-w-2xl mx-auto">
            Tu consultorio merece software hecho para ayudarte, no para cumplir un requisito.
          </h2>
          {/* F1.3·d3 — rol bajada: 19px · -0.01em · 1.55. Ver SeccionHero.tsx.
              Es la única bajada sobre superficie navy, y la única con un <br />
              duro: el corte entre las dos frases es intencional. */}
          {/* ⚠️ F1.3·e5 — `text-white/70` → --lp-ink-inverse-70, que es
              EXACTAMENTE rgb(255 255 255 / .70). El alfa no es cosmético: sobre
              el punto más claro del degradado navy esta línea mide 4.87:1, o
              sea AA con 0.37 de margen. Bajarlo a /60 la tumba. Si alguna vez
              hay que aclarar el degradado, este nodo se re-mide con él. */}
          <p className="relative mt-3 text-[19px] text-[var(--lp-ink-inverse-70)] max-w-lg mx-auto tracking-[-0.01em] leading-[1.55]">
            Sin pláticas con vendedores. Sin letras chiquitas. Sin trámites.
            <br />
            Crea tu cuenta y empieza a usarla hoy — así de simple.
          </p>
          {/* ═══ MENCIÓN MULTI-CUENTA — ANTES DE LOS BOTONES, NO DEBAJO ═══
              §7·13. La propuesta inicial la ponía bajo los botones; se movió
              aquí con argumento medido: cuesta los mismos ~43px de caja pero
              deja los botones como último elemento del documento antes del
              footer. Texto debajo del botón invita a leerlo en vez de
              pulsarlo, que es lo contrario de lo que un cierre debe hacer.
              El orden queda titular → promesa → matiz → acción.
              ⚠️ Si una tanda futura la baja, medir antes: a 390 esta línea ya
              ocupa 2 renglones, y ahí el bloque de cierre acumula ~487px.

              ⚠️ COPY ACOTADO A LO VERIFICADO. NO lo ensanches:
                · "da de alta", NUNCA "invita": no existe correo de
                  invitación. El admin teclea email y contraseña él mismo
                  (`admin/usuarios/page.tsx:36,74` → `/api/admin/crear-usuario`).
                · "asistente médico", NUNCA "secretaria". ⚠️ ESTO REVIERTE LA
                  DECISIÓN DEL 2026-07-30 POR LA MAÑANA, que había fijado
                  "secretaria" y así se escribió esta línea. La sección
                  SeccionControl.tsx usa "asistente médico" y la landing no
                  puede llamar de dos formas al mismo rol a un scroll de
                  distancia. El enum de la BD sigue siendo `secretaria` y NO
                  se toca (`permissions.ts:52-54`); lo que queda por alinear
                  es la ayuda (`ayuda/page.tsx:41`, dice "Secretaria"). La UI
                  de alta ya dice "Asistente Médico/a"
                  (`admin/usuarios/page.tsx:183`) y por tanto YA está bien.
                  Ver LP-DT-23, reescrita con esta decisión.
                · SIN PRECIO a propósito. El multi-cuenta empieza en Clínica
                  Básica ($1,990/mes, `plans.ts:63-83`), no en Individual, que
                  tiene `max_secretarias: 0` y `max_medicos: 1` (`:44-45`).
                  Nombrar el precio aquí mete un salto de 3× en un cierre que
                  hoy no habla de dinero.
                · La capacidad SÍ existe y es contratable: los 8 price IDs
                  están definidos, el checkout vive en
                  `api/stripe/checkout/route.ts` y la secretaria agenda de
                  verdad (`ROLES_POST_REFACTOR.md:171-176`, `agenda/page.tsx:526`).

              F1.3·d4 — rol caption: 13px · 1.45. Ver SeccionFooter.tsx.
              `mt-6` (24) está en la escala de §3.3 y los botones conservan su
              `mt-8`. El `relative` NO es opcional: sin él la línea queda por
              debajo del shine (mismo motivo que el del contenedor de botones,
              comentado abajo).

              ⚠️ `text-white` A PLENO, NO `text-white/70`. Es contraintuitivo
              —la bajada de aquí arriba SÍ va al 70%— y tiene medición detrás.
              El degradado es vertical (#1a3a5c → #1e5fa8) y esta línea cae más
              abajo que la bajada, o sea sobre el extremo CLARO. Muestreado en
              píxel real sobre la captura:
                white/70 → texto #bcccde sobre #225893 = 4.45:1  FALLA AA
                white/80 → 5.29:1 ok, pero el 80% NO existe en la escala
                           inversa que declaró e1 (100 / 70 / 50)
                white    → 7.28:1 ok
              A 13px el umbral es 4.5 sin excepción de texto grande, así que
              el 70% se queda a 0.05 de pasar. Curiosidad que explica por qué
              la bajada sí puede: a 19px el umbral es el mismo, pero ella vive
              más arriba en el degradado y mide 4.87.
              El matiz visual lo da el TAMAÑO (13 contra los 15 del botón y
              los 19 de la bajada), no el alfa. Si una tanda futura la baja al
              70% "por coherencia con la bajada", reintroduce el fallo. */}
          <p className="relative mt-6 text-[13px] text-[var(--lp-ink-inverse)] leading-[1.45]">
            &iquest;Cl&iacute;nica con varios m&eacute;dicos? Da de alta a tu equipo y a tu asistente m&eacute;dico en una sola cuenta.
          </p>
          {/* Mismo par de CTAs que el hero (§7·13), con las mismas etiquetas:
              "Empieza gratis" + "Ver planes". El secundario NO puede copiar el
              del hero (blanco sólido sobre fondo claro) porque aquí competiría
              con el primario blanco sobre navy — va en ghost. El `relative` se
              movió al contenedor: lo necesita para quedar sobre el shine. */}
          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[var(--lp-ink-inverse)] text-[var(--lp-navy)] px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Empieza gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center px-7 py-3.5 rounded-xl text-[15px] font-semibold tracking-[-0.01em] leading-none text-[var(--lp-ink-inverse)] border border-[var(--lp-border-inverse)] hover:bg-[var(--lp-surface-inverse-10)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
