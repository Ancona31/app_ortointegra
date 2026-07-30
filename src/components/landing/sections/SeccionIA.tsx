'use client'

import { Sparkles } from 'lucide-react'

/* Section: Powered by AI
   Superficie FRANJA (§3.1). Alternancia de F1.3·b1: Features blanca →
   IA franja → Expediente blanca. El `border-y border-white/30` del glass
   anterior NO se sustituye: con alternancia, filete y escalón de color son
   el mismo separador dicho dos veces, y el filete (1.20:1) tapa al escalón
   (1.065:1) dejándolo decorativo. Separa la superficie, no el borde. */
export default function SeccionIA() {
  return (
    <section className="bg-[#f5f8fc]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* F1.3·c2 — 16px, no 24. Mismo motivo que el bloque navy de
            SeccionCTA.tsx: eran las dos únicas superficies a rounded-3xl.
            El cuadro de icono de aquí abajo (w-20) se queda en rounded-2xl
            por la escalera declarada en SeccionInterfaz.tsx — coincide en
            valor con este contenedor por tamaño, no por copiarlo. */}
        {/* F1.3·c3 — `p-8 sm:p-12` (32/48). Eran 40/56, y ninguno de los dos
            está en la escala de §3.3. Mismo par en el bloque navy de
            SeccionCTA.tsx: son las dos superficies grandes de la landing y
            comparten padding interior a propósito. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12">
          {/* Subtle shine */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

          {/* F1.3·c3 — `lg:gap-12` (48), no gap-14: 56 no está en la escala.
              Baja en vez de subir a 64 porque el salto desde el gap-8 (32) de
              móvil ya es de un peldaño y medio; 32→64 duplicaría. */}
          <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* AI logo */}
            <div className="flex-shrink-0">
              {/* `bg-white/10` se queda: es un tinte sobre navy opaco, misma
                  familia que los chips de abajo y que el ghost del CTA — no es
                  glassmorphism. El `backdrop-blur-sm` sí salió: desenfocar un
                  degradado opaco no produce nada visible, solo coste. */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="text-center lg:text-left flex-1">
              {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx.
                  Este era el ÚNICO en `tracking-widest` (0.1em); los otros seis
                  venían de `tracking-wider` (0.05em). Ahora los siete van al
                  mismo +0.12em, así que este es el que menos se mueve en
                  tracking y el que más en tamaño relativo: es el kicker más
                  largo de la landing y el único sin pastilla que lo contenga. */}
              <p className="text-[12px] font-semibold text-white/50 uppercase tracking-[0.12em] leading-none mb-3">Potenciado por inteligencia artificial</p>
              {/* §7·4: el subtitular ES el titular. El h2 anterior ("Spinus es
                  tu aliado / para cada consulta") no salía del maestro, y la
                  primera oración del párrafo que vivía aquí se eliminó por dos
                  motivos: afirmaba "te asiste en tiempo real" (prohibido
                  mientras el bug de sync siga abierto, §11) y su contenido
                  —analiza laboratorios, estructura notas— ya lo dicen los
                  chips. */}
              {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
                  1.10. Ver SeccionFeatures.tsx. Este y el de SeccionCTA son
                  los dos que más suben (venían de 24/30px, dos escalones por
                  debajo del resto) y los únicos sobre superficie navy.
                  El `leading-tight` que tenía (1.25) también sale: el rol
                  declara 1.10.

                  ⚠️ NO es frágil pese a vivir en columna: la columna real de
                  este h2 mide 848px de 1280 en adelante (es el `flex-1` de un
                  flex que a lg pone el icono a la izquierda), no la mitad del
                  contenedor. A 4vw el clamp topa en 46 mucho antes de que esa
                  columna apriete: medido a 390/1024/1280/1440/1920, la frase
                  —la más larga de los ocho titulares— NO gana ni una línea en
                  ningún ancho (4/2/2/2/2, idéntico al antes). Los +26px que
                  crece la sección a 1280 son leading y tamaño, no reflow.
                  Medido, no deducido. */}
              <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-white tracking-[-0.03em] leading-[1.10]">
                Tú aportas el criterio clínico — Spinus se encarga del trabajo pesado.
              </h2>
              {/* Chips: HOY son etiquetas, no controles. En F4 se vuelven el
                  selector del Teaser 1 (§5.4) y ahí pasan a <button>; mientras
                  tanto siguen siendo <span> a propósito. El de búsqueda salió
                  en c2: Ctrl+K no es IA (§7·4). */}
              {/* F1.3·d4 — los 2 chips toman rol CAPTION (no botón): 13px ·
                  1.45. Ver SeccionFooter.tsx. Suben desde 11px, el salto más
                  grande de esta tanda.

                  ⚠️ CAPTION Y NO BOTÓN A PROPÓSITO, aunque la pastilla lo
                  insinúe. Hoy son spans: etiquetan lo que la IA hace, no se
                  pulsan. Darles el rol de botón (15px) los haría prometer una
                  interacción que no existe. En F4 se vuelven controles reales
                  como selector del Teaser 1 (§5.4) y ESE es el momento de
                  moverlos al rol botón — no antes.

                  ⚠️ El comentario va AQUÍ, en el div padre, y no pegado al
                  span: el callback del map devuelve JSX entre paréntesis y solo
                  admite UN hijo raíz. Un comentario JSX insertado delante del
                  span lo convierte en dos, y el build cae con
                  "Expected '</', got 'ident'". Mismo cuidado en cualquier map
                  de la landing. */}
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                {['Notas médicas con IA', 'Análisis de laboratorios'].map((tag) => (
                  <span key={tag} className="text-[13px] font-medium text-white/70 bg-white/10 px-3 py-1.5 rounded-full leading-[1.45]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
