'use client'

import { Smartphone, Laptop, Globe } from 'lucide-react'
import Reveal from '@/components/landing/motion/Reveal'

/* Section: Portabilidad
   Superficie FRANJA (§3.1). Es la asignación que más trabaja de las seis:
   las 3 tarjetas de la franja horizontal son blancas, y sobre franja pasan
   a leerse como tarjetas en vez de como aire con filete. */
export default function SeccionPortabilidad() {
  return (
    <section className="bg-[#f5f8fc]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* Prueba de humo F0 del sistema de movimiento — único uso de <Reveal> por ahora */}
        {/* F1.3·c3 — `mb-12` (48). Ver SeccionFeatures.tsx. */}
        <Reveal className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-violet-50 rounded-full px-3.5 py-1 mb-6">
            <Smartphone className="w-3.5 h-3.5 text-violet-600" />
            {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
            <span className="text-[12px] font-semibold text-violet-600 uppercase tracking-[0.12em] leading-none">Portabilidad máxima</span>
          </div>
          <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
            Tu consultorio en cualquier lugar
          </h2>
          {/* ⚠️ #5a6b81 (tinta 500 de §3.1) en vez de text-slate-500, y NO es
              adelanto del barrido de tinta: es reparación de lo que rompió el
              cambio de superficie. slate-500 da 4.76:1 sobre blanco (AA) pero
              4.47:1 sobre esta franja — falla el 4.5 por 0.03. #5a6b81 da
              5.11:1 aquí y 5.45:1 sobre blanco. Las únicas dos líneas de esta
              landing con slate-500 apoyado DIRECTAMENTE en franja son esta y
              la del pie de abajo; el slate-500 de las tarjetas va sobre
              blanco y se queda. Si esta sección vuelve a blanco, revertir. */}
          <p className="mt-4 text-[16px] text-[#5a6b81] max-w-2xl mx-auto leading-relaxed">
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
        <div className="grid sm:grid-cols-3 gap-px bg-[#e6ebf2] rounded-2xl overflow-hidden border-[0.5px] border-[#e6ebf2]">
          {[
            {
              icon: <Laptop className="w-5 h-5 text-[#8a99ac]" />,
              title: 'Computadora',
              desc: 'La experiencia completa: sidebar, atajos y expediente expandido.',
            },
            {
              icon: <Smartphone className="w-5 h-5 text-[#8a99ac]" />,
              title: 'Tablet y celular',
              desc: 'Interfaz adaptada al tacto. Revisa citas y consulta expedientes donde estés.',
            },
            {
              icon: <Globe className="w-5 h-5 text-[#8a99ac]" />,
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
               · `mt-2` de la descripción, antes mt-1: ritmo real, no
                 interlínea óptica. Justificación en SeccionHistoria.tsx. */
            <div key={item.title} className="bg-white px-6 py-6 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pie de franja, no un 4º ítem: aplica SOLO a la nota médica (§7·9,
            lo único verificado). No generalizar a "funciona sin conexión". */}
        <p className="mt-4 text-[13px] text-[#5a6b81]">
          Si se te cae la conexión, el borrador de tu nota médica sigue donde lo dejaste.
        </p>
      </div>
    </section>
  )
}
