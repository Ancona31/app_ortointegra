import type { JSX } from 'react'

/* Franja del problema — §7·2, esqueleto de §3.4·2
   Tesis de producto (§2·3) enunciada de golpe, sin adorno: es la bisagra
   entre la promesa del hero y las capacidades del bento.

   ⚠️ CONTRATO DE COSTURA — no tocar sin releer §3.3.
   Esta sección NO declara padding superior y NO lleva superficie propia.
   Los 96px de aire por arriba los aporta el pb-24 de SeccionHero.tsx:30;
   los 96px por abajo los aporta el pb-24 de aquí, porque SeccionFeatures
   tampoco declara pt (ver su comentario de cabecera). La cadena es:
     Hero (pb-24) → [96px] → Franja (sin pt … pb-24) → [96px] → Features
   Dos costuras de 96px exactos, el mínimo de §3.3, iguales en todos los
   breakpoints: ninguno de los tres valores tiene variante responsive.
   Añadir pt aquí, o superficie de fondo, rompe las dos a la vez.

   ⚠️ El #8a99ac va LITERAL, no var(--sp-ink-350). El token se invierte a
   rgba(255,255,255,.38) bajo html.dark, y esa clase la añade
   ThemeProvider.tsx:17 sin retirarla nunca al salir de (app): un médico
   con dark activo que navegue del lado cliente a la landing la arrastra y
   dejaría esta frase en blanco al 38% sobre fondo claro.

   El slate-900 de la primera mitad sí es deuda de §3.1 (la tinta 900 es
   #14345c, azulada): se mantiene por coherencia con el h2 hermano de
   SeccionFeatures.tsx:67 y lo barre F1.3 en bloque, no esta sección sola. */
export default function SeccionProblema(): JSX.Element {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pb-24">
        {/* §3.4·2: a sangría izquierda, 74% de ancho, sin centrar. Por debajo
            de sm el 74% deja ~17 caracteres por línea, así que ahí va a ancho
            completo. */}
        <p className="w-full sm:w-[74%] text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
          Los sistemas de expediente electrónico son lentos, complejos y pensados para cumplir regulaciones{' '}
          <span className="text-[#8a99ac]">&mdash; no para ayudar al médico.</span>
        </p>
      </div>
    </section>
  )
}
