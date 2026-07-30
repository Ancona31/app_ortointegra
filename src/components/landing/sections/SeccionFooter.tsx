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
   El `border-slate-200/60` se queda tal cual: los bordes 0.5px/#e6ebf2 son
   la tanda b2. */
export default function SeccionFooter() {
  return (
    <footer className="border-t border-slate-200/60 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        {/* Fila 1 — marca + tagline · enlaces */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-7 w-auto" />
            <span className="text-[13px] text-slate-500">La columna vertebral de tu práctica médica</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
              Aviso de privacidad
            </Link>
            <Link href="/terms" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
              Términos de servicio
            </Link>
            <Link href="/pricing" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
              Planes
            </Link>
          </div>
        </div>

        {/* Fila 2 — contacto y copyright.
            Hex literal en vez de var(--sp-ink-350) por html.dark (ver
            SeccionProblema.tsx). */}
        <div className="mt-6 pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#8a99ac]">
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
