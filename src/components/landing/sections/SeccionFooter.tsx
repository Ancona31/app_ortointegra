'use client'

import Link from 'next/link'
import Image from 'next/image'

/* Footer — §7·13
   Dos filas porque entran dos elementos nuevos: tagline y contacto. La
   ausencia de un contacto real es, según §7·13, la mayor señal de
   desconfianza de una landing de SaaS médico.

   NO lleva la autoría ni las cédulas del fundador que §7·13 enumera: es un
   footer de SaaS, no una firma profesional. Esos datos viven en la sección
   Historia, que es donde el visitante busca quién está detrás.

   NO lleva enlace "Cómo protegemos tu información": la ruta no existe todavía
   y enlazarla sería un 404 en producción. Tampoco WhatsApp: no hay número.
   Ambos entran cuando existan, no antes.

   F1.3·b1: fuera `backdrop-blur-xl` y `bg-white/80` → `bg-white` opaco. El
   footer cierra el documento: nada se desplaza por debajo, así que el blur
   solo pagaba compositor sin producir efecto. El Nav SÍ lo conserva (§4.4)
   porque ahí el contenido sí pasa por debajo — no unificar los dos casos.

   F1.3·b2: los dos bordes de este archivo pasan a 0.5px/#e6ebf2. El de
   arriba es la excepción 2 (chrome, como el del Nav); el de la fila 2 es
   un divisor interno y va al mismo valor por coherencia.

   ⚠️ F1.3·c1 — EL `py-8` DE ABAJO ES CHROME Y NO SIGUE EL RÉGIMEN DE
   SECCIÓN, PERO LA COSTURA QUE FORMA ESTÁ EN EL SUELO DE §3.3.
   El footer no es una sección de contenido: se queda en `py-8` (32)
   mientras las 12 secciones pasaron a `py-16 sm:py-24 lg:py-32`. La
   costura con SeccionCTA es su pb + estos 32:
     móvil  64 + 32 =  96  ← EXACTAMENTE el mínimo de §3.3, sin margen
     sm     96 + 32 = 128
     lg    128 + 32 = 160
   Cualquier bajada futura de este `py-8` o del `py-16` base del CTA
   perfora el mínimo en móvil sin que nada falle visiblemente. Si hace
   falta comprimir el cierre, comprime por dentro (las filas), no por
   este padding. */
export default function SeccionFooter() {
  return (
    <footer className="border-t-[0.5px] border-[#e6ebf2] bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        {/* Fila 1 — marca + tagline · enlaces */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* F1.3·c3 — `gap-2` (8). Ver SeccionNav.tsx: mismo lockup. */}
          <div className="flex items-center gap-2">
            <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-7 w-auto" />
            {/* ═══ ROL CAPTION (F1.3·d4) ═══
                13px · tracking normal · leading 1.45 (§3.2). Es el escalón más
                bajo de la escala y el último de la tanda (d). Ocho instancias:
                esta línea, los 3 links de este footer, la fila de contacto y
                copyright de abajo, el cargo del Dr. Ancona en SeccionHistoria,
                el pie de SeccionPortabilidad y los 2 chips de SeccionIA.

                Casi todas ya estaban en 13; las que se movieron son la fila de
                copyright (12 → 13) y los chips de IA (11 → 13). Con eso, 11 y
                12px dejan de existir como tamaños de TEXTO en la landing —
                sobreviven solo dentro de los dos mockups, donde son UI falsa
                y están fuera de la tanda a propósito.

                ⚠️ TRACKING NORMAL = AUSENCIA DE CLASE, igual que en cuerpo
                (ver SeccionFeatures.tsx). A 13px la tentación es abrir el
                tracking, pero eso es el rol KICKER (12px, +0.12em, uppercase),
                que es otra cosa: el kicker es una versalita corta y el caption
                es texto en caja baja. No los mezcles.

                ⚠️ 1.45 es MÁS CERRADO que el 1.65 del cuerpo, al revés de lo
                que sugiere la regla "a menor tamaño, más interlínea". Es
                deliberado: los captions son de una o dos líneas y suelen vivir
                en filas horizontales, donde un leading abierto los descuadra
                contra el elemento vecino. La regla vale para texto corrido. */}
            <span className="text-[13px] text-[var(--lp-ink-500)] leading-[1.45]">La columna vertebral de tu práctica médica</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[13px] text-[var(--lp-ink-500)] leading-[1.45] hover:text-slate-700 transition-colors duration-200">
              Aviso de privacidad
            </Link>
            <Link href="/terms" className="text-[13px] text-[var(--lp-ink-500)] leading-[1.45] hover:text-slate-700 transition-colors duration-200">
              Términos de servicio
            </Link>
            <Link href="/pricing" className="text-[13px] text-[var(--lp-ink-500)] leading-[1.45] hover:text-slate-700 transition-colors duration-200">
              Planes
            </Link>
          </div>
        </div>

        {/* Fila 2 — contacto y copyright.
            Hex literal en vez de var(--sp-ink-350) por html.dark (ver
            SeccionProblema.tsx). */}
        <div className="mt-6 pt-6 border-t-[0.5px] border-[#e6ebf2] flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-[var(--lp-ink-500)] leading-[1.45]">
          <a
            href="mailto:soporte@spinus.com.mx"
            className="hover:text-slate-600 transition-colors duration-200"
          >
            soporte@spinus.com.mx
          </a>
          <span>&copy; {new Date().getFullYear()} Spinus. Todos los derechos reservados.</span>
        </div>
      </div>
    </footer>
  )
}
