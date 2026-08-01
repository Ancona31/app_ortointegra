import type { JSX } from 'react'

/* Franja del problema — §7·2, esqueleto de §3.4·2
   Tesis de producto (§2·3) enunciada de golpe, sin adorno: es la bisagra
   entre la promesa del hero y las capacidades del bento.

   ⚠️ CONTRATO DE COSTURA — no tocar sin releer §3.3.
   Esta sección NO declara padding superior.
   Los 96px de aire por arriba los aporta el pb-24 de SeccionHero; los
   128px por abajo los aporta el pb-32 de aquí, porque SeccionFeatures
   tampoco declara pt (ver su comentario de cabecera). La cadena es:
     Hero (pb-24) → [96px] → Franja (sin pt … pb-32) → [128px] → Features
   Las dos costuras son EXACTAS y ASIMÉTRICAS, e iguales en todos los
   breakpoints: ninguno de los tres valores tiene variante responsive.
   Añadir pt aquí rompe las dos a la vez.

   La de abajo subió de 96 a 128 en el QA visual de b2, y la asimetría es
   deliberada. Con Features ya en blanco (ver más abajo), la costura de
   96px desapareció como límite: quedaba casi igual al interlineado de
   esta misma frase — leading-[1.10] sobre ~46px son ~50px entre líneas —
   y frase y titular del bento se leían como un solo bloque de texto. A
   128px la jerarquía vuelve. La de arriba se queda en 96 porque ahí sí
   hay corte cromático: el lavado del hero cambia de color contra este
   blanco y no necesita que el aire haga el trabajo solo.

   ⚠️ EL ENTORNO CAMBIÓ EN c1 — ESTOS DOS VALORES NO.
   Cuando b2 los fijó, las costuras vecinas medían 192–224px. Desde c1 el
   padding de sección es `py-16 sm:py-24 lg:py-32` y la costura normal
   mide 128 / 192 / 256 (móvil / sm / lg). Es decir: estas dos costuras
   pasaron de valer ~0.43–0.57× del entorno a valer 0.375× (la de 96) y
   0.5× (la de 128) en lg. En móvil, en cambio, la de 128 quedó EXACTA a
   la costura normal y la de 96 a 0.75× — ahí el contrato lee mejor que
   antes. El régimen completo está en el comentario de cabecera del div
   de SeccionHero.
   Se mantuvieron literales a propósito (opción (a) de la auditoría de
   c1): darles variante responsive exigía un pb-48 = 192px, que no está
   en la escala de §3.3 y habría que declarar como excepción. Si el QA
   visual ve la costura de abajo enana contra los 256 de lg, se ajusta
   con el render delante — no por aritmética, y actualizando los TRES
   comentarios en el mismo cambio.

   F1.3·b2 · el `bg-white` NO viola ese contrato: el contrato es de
   ESPACIADO, y una superficie no mueve ningún padding. Sí es un cambio
   visual real: sin la clase, esta sección heredaba el `--background:
   #f8fafc` del body (globals.css:25,135) y quedaba medio tono por debajo
   de sus hermanas blancas. Con blanco explícito, Franja y Features forman
   una superficie continua desde el borde superior de este texto hasta el
   final del bento, y los 128px de la segunda costura quedan pintados de
   blanco en vez de #f8fafc — que es lo que la alternancia de §3.1 pide.
   Ese blanco continuo es justo lo que obligó a subir la costura a 128:
   sin cambio de tono, el único límite que queda es el aire.
   Lo que SÍ rompería la costura es darle a esta sección un fondo distinto
   al de Features: ahí la segunda costura se vería como banda de color.

   ⚠️ LOS DOS COLORES VAN EN --lp-ink-*, Y LA PROHIBICIÓN VIEJA SEGUÍA
   SIENDO CORRECTA — lo que cambió es que ya existe un token que la cumple.
   Este comentario decía "los dos hex van LITERALES, no var(--sp-ink-500) ni
   var(--sp-ink-900) … no 'arregles' ninguno pasándolo a token", y el motivo
   era real: los tokens --sp-* SÍ se invierten bajo html.dark, y esa clase la
   añade ThemeProvider.tsx:17 sin retirarla nunca al salir de (app), así que
   un médico con dark activo que navegue del lado cliente a la landing la
   arrastra y dejaría esta frase en tinta clara sobre fondo blanco.
   La tanda F1.3·e2 cableó --lp-ink-500 / --lp-ink-900, que existen
   EXACTAMENTE para este problema: globals.css declara que no se redefinen
   bajo html.dark nunca ("esa inmunidad es su razón de existir"), y está
   verificado — html.dark redefine 64 variables y ninguna es --lp-*.
   O sea que la regla no se relajó: sigue prohibido usar --sp-* aquí. Lo que
   se permite es --lp-*, y solo mientras esa inmunidad se mantenga. Si alguien
   llega a redefinir un --lp-ink-* bajo html.dark, este archivo vuelve a hex
   literal el mismo día.

   ⚠️ ÉNFASIS INVERTIDO EN EL QA DE b2 — NO LO REVIERTAS AL LEERLO RARO.
   La primera mitad va en ink-500 (#5a6b81) y el remate en ink-900
   (#14345c), no al revés. La frase es una bisagra: el golpe está en el
   giro ("— no para ayudar al médico"), no en el enunciado del problema.
   Antes el gris caía sobre el remate y lo apagaba justo donde debía
   pegar. Contraste contra blanco: #5a6b81 = 5.45:1 (AA normal y AAA
   large), #14345c = 12.53:1.
   El #8a99ac anterior (2.90:1) NO vuelve: no pasa AA ni como texto
   grande de peso central. Si alguna tanda quiere aclarar más la primera
   mitad, ink-500 es el suelo.

   Con esto la sección ya NO usa slate-900, así que la deuda de §3.1 que
   este comentario registraba queda saldada aquí — pero SOLO aquí. El h2
   hermano de SeccionFeatures.tsx sigue en slate-900, y desde el QA de b2
   los dos titulares ya no comparten tinta. Esa divergencia es temporal y
   la cierra F1.3 en bloque; no la resuelvas devolviéndole slate-900 a
   esta sección. */
export default function SeccionProblema(): JSX.Element {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pb-32">
        {/* §3.4·2: a sangría izquierda, 74% de ancho, sin centrar. Por debajo
            de sm el 74% deja ~17 caracteres por línea, así que ahí va a ancho
            completo. */}
        <p className="w-full sm:w-[74%] text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-500)] tracking-[-0.03em] leading-[1.10]">
          Los sistemas de expediente electrónico son lentos, complejos y pensados para cumplir regulaciones{' '}
          <span className="text-[var(--lp-ink-900)]">&mdash; no para ayudar al médico.</span>
        </p>
      </div>
    </section>
  )
}
