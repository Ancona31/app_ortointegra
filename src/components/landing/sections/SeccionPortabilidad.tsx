'use client'

import { Smartphone, Laptop, Globe } from 'lucide-react'
import Reveal from '@/components/landing/motion/Reveal'

/* Section: Portabilidad
   Superficie FRANJA (§3.1). Es la asignación que más trabaja de las seis:
   las 3 tarjetas de la franja horizontal son blancas, y sobre franja pasan
   a leerse como tarjetas en vez de como aire con filete. */
export default function SeccionPortabilidad() {
  return (
    <section className="bg-[var(--lp-surface-alt)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* Prueba de humo F0 del sistema de movimiento — único uso de <Reveal> por ahora */}
        {/* F1.3·c3 — `mb-12` (48). Ver SeccionFeatures.tsx. */}
        <Reveal className="text-center mb-12">
          {/* F1.3·e3 — ERA UNA PASTILLA VIOLETA (`bg-violet-50` +
              `text-violet-600`). Pasa a la pastilla única por §3.1 "los
              semánticos solo para datos reales": el violeta no representaba
              nada del producto. Ver la nota larga en SeccionInterfaz.tsx. */}
          <div className="inline-flex items-center gap-2 bg-[var(--lp-accent-bg)] rounded-full px-3.5 py-1 mb-6">
            <Smartphone className="w-3.5 h-3.5 text-[var(--lp-accent)]" />
            {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
            <span className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none">Portabilidad máxima</span>
          </div>
          {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
              1.10. Ver SeccionFeatures.tsx. */}
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.03em] leading-[1.10]">
            Tu consultorio en cualquier lugar
          </h2>
          {/* ⚠️ #5a6b81 (tinta 500 de §3.1) en vez de text-[var(--lp-ink-500)], y NO es
              adelanto del barrido de tinta: es reparación de lo que rompió el
              cambio de superficie. slate-500 da 4.76:1 sobre blanco (AA) pero
              4.47:1 sobre esta franja — falla el 4.5 por 0.03. #5a6b81 da
              5.11:1 aquí y 5.45:1 sobre blanco. Las únicas dos líneas de esta
              landing con slate-500 apoyado DIRECTAMENTE en franja son esta y
              la del pie de abajo; el slate-500 de las tarjetas va sobre
              blanco y se queda. Si esta sección vuelve a blanco, revertir. */}
          {/* F1.3·d3 — rol bajada: 19px · -0.01em · 1.55. Ver SeccionHero.tsx. */}
          <p className="mt-4 text-[19px] text-[var(--lp-ink-500)] max-w-2xl mx-auto tracking-[-0.01em] leading-[1.55]">
            Accede desde tu computadora, tablet o celular. Adaptada a cada pantalla, sin instalar nada de una tienda de apps.
          </p>
        </Reveal>

        {/* §3.4: franja horizontal delgada de 3 ítems (antes eran 3 tarjetas
            grandes). Siguen siendo 3 — ninguno se elimina; el tercero solo
            cambia de nombre. El gap-px sobre el fondo de borde dibuja los
            divisores como filete de 1px sin bordes por tarjeta.

            ⚠️ EL `gap-px` NO ES RITMO Y NO ENTRA EN LA ESCALA DE §3.3.
            Blindado explícitamente en F1.3·c3. Es la TÉCNICA que dibuja los
            divisores: el fondo #e6ebf2 del contenedor se ve por la rendija
            de 1px que dejan las 3 tarjetas blancas. Subirlo a 8 no
            "corrige" nada — abre tres canales grises de 8px y destruye la
            franja. Si una auditoría futura lo reporta como valor fuera de
            escala, la respuesta es esta nota. */}
        {/* F1.3·e4 — los 3 iconos eran #8a99ac: 2.90:1 sobre el blanco de la
            tarjeta, por debajo del 3:1 que WCAG pide a un gráfico informativo.
            Pasan a --lp-ink-500 (5.45:1) — tinta, no acento. Ver la nota del
            bento en SeccionFeatures.tsx: la decisión de PM fue la misma en los
            dos sitios y por el mismo motivo. */}
        <div className="grid sm:grid-cols-3 gap-px bg-[var(--lp-border)] rounded-2xl overflow-hidden border-[0.5px] border-[var(--lp-border)]">
          {[
            {
              icon: <Laptop className="w-5 h-5 text-[var(--lp-ink-500)]" />,
              title: 'Computadora',
              desc: 'La experiencia completa: sidebar, atajos y expediente expandido.',
            },
            {
              icon: <Smartphone className="w-5 h-5 text-[var(--lp-ink-500)]" />,
              title: 'Tablet y celular',
              desc: 'Interfaz adaptada al tacto. Revisa citas y consulta expedientes donde estés.',
            },
            {
              icon: <Globe className="w-5 h-5 text-[var(--lp-ink-500)]" />,
              title: 'Sin instalaciones',
              desc: 'Corre en el navegador y se actualiza sola.',
            },
          ].map((item) => (
            /* F1.3·c3 — tres decisiones distintas en estas cuatro líneas:
               · `py-6` (24), antes py-5: 20 no está en la escala. Este
                 padding SÍ entra en c3 aunque el p-6/p-8 de las cards no,
                 porque no diverge de la doctrina de card — está fuera de
                 escala, que es otro problema (ver SeccionSeguridad.tsx).
               · `mt-0.5` del icono: alineación óptica de 2px, BLINDADO.
                 F1.3·d4 (cierre) — MEDIDO Y CONFIRMADO CORRECTO, no se tocó.
                 Aquí el icono es un SVG suelto de 20px y se alinea contra la
                 primera línea del H3 (19px · 1.30 → 24.69px), no contra el
                 cuerpo. Fórmula: mt = (line-height − alto del elemento) / 2
                 = (24.69 − 20) / 2 = +2.35px. El valor puesto (2px) deja un
                 residuo de 0.34px, medido idéntico a 390 y a 1440. Se queda
                 en `mt-0.5`: corregir un tercio de píxel exigiría un
                 `mt-[2.35px]` fuera de escala que además caducaría al primer
                 cambio de line-height del H3.

                 ⚠️ EL SIGNO ES OPUESTO AL DE SeccionExpediente E Interfaz, y
                 no es incoherencia. Allí el cuadro (32px) es MÁS ALTO que su
                 línea (28.05) y hay que SUBIRLO (−2px); aquí el icono (20px)
                 es MÁS BAJO que la suya (24.69) y hay que BAJARLO (+2.35).
                 Es la misma fórmula con geometrías distintas. No las
                 unifiques al mismo valor.
               · `mt-2` de la descripción, antes mt-1: ritmo real, no
                 interlínea óptica. Justificación en SeccionHistoria.tsx. */
            <div key={item.title} className="bg-[var(--lp-surface)] px-6 py-6 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
              <div className="min-w-0">
                {/* F1.3·d4 — rol H3 de card: 19px · -0.015em · 1.30.
                    Ver SeccionFeatures.tsx. */}
                <h3 className="text-[19px] font-semibold text-[var(--lp-ink-900)] tracking-[-0.015em] leading-[1.30]">{item.title}</h3>
                {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx.
                    ⚠️ El `text-[13px]` de más abajo en este archivo es el pie
                    de la sección: es CAPTION, otro rol, y lo resuelve d4. */}
                <p className="mt-2 text-[17px] text-[var(--lp-ink-500)] leading-[1.65]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pie de franja, no un 4º ítem: aplica SOLO a la nota médica (§7·9,
            lo único verificado). No generalizar a "funciona sin conexión". */}
        {/* F1.3·d4 — rol caption: 13px · 1.45. Ver SeccionFooter.tsx. Es el
            caption que d3 dejó anotado aquí como "lo resuelve d4". */}
        <p className="mt-4 text-[13px] text-[var(--lp-ink-500)] leading-[1.45]">
          Si se te cae la conexión, el borrador de tu nota médica sigue donde lo dejaste.
        </p>
      </div>
    </section>
  )
}
