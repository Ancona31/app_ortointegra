'use client'

import Link from 'next/link'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Reveal from '@/components/landing/motion/Reveal'
import Stagger, { VARIANTES_ITEM } from '@/components/landing/motion/Stagger'
import { DUR, EASE } from '@/components/landing/motion/tokens'
import { PLANS } from '@/lib/plans'

/* ═══ §5.12 · PRECIO — tejido (F5) ═══════════════════════════════════════════
   La landing no tenía precio: nav y footer mandaban a /pricing. Publicarlo es
   el argumento contra una competencia cuyo precio real se arma sumando
   complementos, y por eso la sección entera está construida sobre una regla:
   **cada cifra y cada viñeta salen de `src/lib/plans.ts`, no de este archivo.**
   Las `features` se leen del módulo, no se copian. Si alguien cambia un plan,
   esta sección cambia con él y no hay forma de que se desincronicen.

   ⚠️ SOLO DOS PLANES, Y ES DECISIÓN DE PM, NO FALTA DE SITIO. El médico
   individual es el comprador realista; los tres planes de clínica van con un
   enlace discreto a /pricing. Cuatro columnas convierten la landing en una
   página de precios y diluyen el foco. No añadas la tercera columna.

   ⚠️ UBICACIÓN: ANTES DE LA FAQ, NO DESPUÉS. Es lo que `(landing)/page.tsx:61`
   ya dejaba escrito antes de esta tanda —«12b queda entre el precio y el
   cierre, que es el orden canónico: cuánto cuesta → sí, pero… → empieza»— y
   sigue siendo lo correcto: la FAQ es el último manejador de objeciones y el
   precio es lo que MÁS objeciones genera. De hecho la respuesta «¿Puedo
   probarlo sin compromiso?» contesta de frente la objeción del precio, y leerla
   antes de saber cuánto cuesta la desperdicia.

   ⚠️ SUPERFICIE NAVY, Y SALE DE LA ARITMÉTICA DE LA ALTERNANCIA. La cadena
   alrededor es Control(`surface`) → Seguridad(`surface-alt`) → FAQ(`surface`) →
   CTA(`wash`). Al entrar entre Seguridad y FAQ, esta sección no puede ser
   `surface-alt` (repetiría con Seguridad) ni `surface` (repetiría con la FAQ).
   Quedan `wash` y navy: `wash` está reservado a apertura y cierre —lo dice su
   token en globals.css— y además es #f6f9fc contra el #f5f8fc de Seguridad, o
   sea que a ojo SERÍA la repetición que se intenta evitar. Queda navy, que
   tiene precedente no contiguo en §3.4·4 (IA) y §5.7 (Receta), y que de paso
   presta el idioma que §5.7 ya estableció: objetos blancos sobre una mesa
   oscura. Dos tarjetas de precio es exactamente eso.

   ⚠️ LO QUE NO SE PUBLICA, Y POR QUÉ (esto es la parte importante del archivo):
   · **El límite de notas con IA NO se menciona.** Hoy son 60 cada 24 h IGUALES
     para todos los planes, y Angel va a cambiarlo. Publicar cualquier número
     sería anunciar algo falso. El hueco está preparado abajo, en la lista de
     `free`: cuando el límite se diferencie por plan, se añade ahí y aquí se
     borra este párrafo.
   · **Ninguna escasez, ningún descuento, ninguna fecha.** La oferta de
     lanzamiento no existe todavía en Stripe. El bloque iría entre la bajada y
     las tarjetas, y no se monta hasta que el cupón esté configurado: anunciar
     un descuento que no se puede canjear es peor que no tenerlo.
   · **Free NO se vende como "pruébalo todo".** No trae visor DICOM —comparar
     las dos listas de `features` en `plans.ts`—, y eso se
     dice EN LA TARJETA, no en una nota al pie. El CTA final de la página
     promete «Sin letras chiquitas»; esa promesa solo se sostiene si los
     límites están a la vista, y publicarlos es lo que la convierte en prueba.
   · **Free es un TIER PERMANENTE, no un trial.** Nada de "14 días". El copy
     dice "no caduca" porque es lo que dice la FAQ y porque es verdad.

   ⚠️ COHERENCIA CON LA FAQ — verificada contra `faq-contenido.ts:94-96`, que
   responde «El plan gratuito no pide tarjeta y no caduca: puedes registrar
   hasta cinco pacientes… lo cancelas tú mismo desde tu cuenta, sin llamadas ni
   trámites». Las tres afirmaciones están aquí y dicen lo mismo. Si tocas una,
   toca la otra.

   La nota al pie es LITERAL de `/pricing:217` para que las dos páginas no se
   contradigan en moneda ni en IVA. No la reescribas por tu cuenta. */

/**
 * Separador de miles a mano y NO `toLocaleString`: el formato de `Intl` puede
 * diferir entre el Node del servidor y el navegador, y una cifra distinta en
 * SSR y en cliente es un hydration mismatch (§4.3·7) por 649 pesos.
 */
const pesos = (n: number): string => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

/**
 * Lo que el plan gratuito NO trae. Va a mano y no calculado como diferencia de
 * las dos listas de `features` de `plans.ts`: son cadenas de texto libre y
 * restar conjuntos de frases daría ruido ("Pacientes ilimitados" no es una
 * carencia, es el mismo límite dicho al revés).
 *
 * ⚠️ Era una lista de dos. «Extracción de labs con IA» salió el 2026-08-02
 * junto con su línea en `plans.ts`: la función ya no existe en el producto
 * (`/api/labs-extract` se eliminó en la sub-fase 8C1 del rediseño de labs), así
 * que no puede figurar ni como incluida ni como excluida. Anunciar por omisión
 * una función muerta sigue siendo anunciarla.
 */
const FREE_NO_INCLUYE = ['Visor DICOM'] as const

/**
 * Los haces que recorren el borde de la tarjeta recomendada.
 *
 * ⚠️ SON TRES ARCOS A 0°, 120° Y 240°, Y CADA UNO ES MÁS CORTO QUE EL ÚNICO
 * QUE HABÍA. Con un solo haz, cada punto del borde se quedaba a oscuras casi
 * toda la vuelta y había que esperar a que la luz llegara; con tres, siempre
 * hay luz en el perímetro. Pero tres arcos de la longitud del antiguo (~58°)
 * sumarían 173° —casi la mitad del círculo— y eso ya no son luces que
 * recorren, es un borde brillante que gira. La cuenta que gobierna esto:
 *
 *   · arco de 32° (núcleo ±16°) × 3 = 96° encendidos de 360 = **27%**
 *   · huecos de 88° entre arcos, que es lo que deja leer cada luz como una luz
 *
 * Antes era un arco de 58° = 16% encendido. O sea: la cobertura total sube
 * poco, pero cada haz individual es CASI LA MITAD de largo. Si alguien alarga
 * los arcos "para que se vea más", los funde entre sí y desaparece el efecto.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ EL NÚCLEO DEL HAZ ES BLANCO, NO `--lp-accent`. NO LO "CORRIJAS".
 * ═══════════════════════════════════════════════════════════════════════════
 * El efecto de referencia ("Animated Border Glow" de Linear/Vercel) es un haz
 * de color puro, y por eso esto se ve contraintuitivo y alguien va a querer
 * dejarlo en acento. **Ya se hizo, y no se veía.** El motivo es que aquella
 * referencia corre sobre un fondo casi negro y aquí el fondo YA ES AZUL, así
 * que el acento no tiene de dónde despegarse. Medido sobre el navy de la
 * sección (`--lp-navy` #1a3a5c):
 *
 *   · `--lp-accent` pleno .................... 1.81:1  ← techo del acento puro
 *   · `--lp-accent` al 40% (la base anterior)  1.27:1  ← indistinguible
 *   · `--lp-ink-inverse` (blanco) ........... 11.64:1
 *
 * 1.81:1 es el TECHO del haz en acento puro: no lo arregla más grosor, ni más
 * glow, ni más velocidad — no hay contraste que repartir. El blanco sí, y el
 * acento no se pierde: va en los FLANCOS, que son los que tiñen de azul el
 * halo desenfocado. Por eso se lee como luz azul y no como una línea blanca.
 * Si algún día el fondo de la sección deja de ser navy, RE-MIDE antes de
 * volver al acento puro.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Se declara aquí, fuera del componente, porque lo consumen DOS capas —el
 * anillo nítido y el glow desenfocado— y tienen que ser el mismo haz: si se
 * separan, la luz y su halo dejan de coincidir.
 */
/* En grados y no en `turn`: con tres arcos la lista tiene catorce paradas y en
   fracciones de vuelta (0.3108…, 0.6892…) es ilegible y se calibra a ciegas.
   Cada arco es núcleo ±16°, con el acento a ±8°. El de 0° va partido entre el
   final y el principio de la lista porque un `conic-gradient` no admite
   paradas negativas; por eso hay blanco a 0deg y a 360deg — es el MISMO haz y
   así la costura no se ve. */
const HAZ =
  'conic-gradient(from 0deg,' +
  ' var(--lp-ink-inverse) 0deg,' +
  ' var(--lp-accent) 8deg,' +
  ' transparent 16deg 104deg,' +
  ' var(--lp-accent) 112deg,' +
  ' var(--lp-ink-inverse) 120deg,' +
  ' var(--lp-accent) 128deg,' +
  ' transparent 136deg 224deg,' +
  ' var(--lp-accent) 232deg,' +
  ' var(--lp-ink-inverse) 240deg,' +
  ' var(--lp-accent) 248deg,' +
  ' transparent 256deg 344deg,' +
  ' var(--lp-accent) 352deg,' +
  ' var(--lp-ink-inverse) 360deg)'

export default function SeccionPrecio() {
  /* Un solo `useReducedMotion` para la sección, sin ramificar el render
     (§4.3·7). Mismo patrón que `SeccionExpediente`. */
  const sinMovimiento = useReducedMotion()
  const transicionItem = sinMovimiento
    ? { duration: 0 }
    : { duration: DUR.section, ease: EASE.out }

  const free = PLANS.free
  const individual = PLANS.individual
  /* El plan de clínica más barato, para el enlace discreto. Sale de `plans.ts`
     igual que todo lo demás: si cambia el precio de Básica, cambia aquí. */
  const desdeClinica = PLANS.basica.precio_mensual

  return (
    /* `[--lp-focus:…]` — sobre navy el anillo de foco pasa a blanco (11.64:1);
       el acento por defecto mediría 1.81:1. Ojo: la tarjeta de Individual es
       BLANCA y lo revierte a acento más abajo. */
    <section className="bg-[var(--lp-navy)] [--lp-focus:var(--lp-ink-inverse)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-ink-inverse-70)]">
            Precio
          </p>
          <h2 className="mt-3 text-[clamp(30px,4vw,46px)] font-bold tracking-[-0.03em] leading-[1.10] text-[var(--lp-ink-inverse)]">
            Lo que cuesta, sin que tengas que preguntarlo
          </h2>
          <p className="mt-4 text-[19px] tracking-[-0.01em] leading-[1.55] text-[var(--lp-ink-inverse-70)]">
            Dos planes con sus límites a la vista. Sin vendedor de por medio y sin complementos que se sumen después.
          </p>
        </Reveal>

        {/* ⚠️ AQUÍ VA EL BLOQUE DE LANZAMIENTO CUANDO EXISTA EL CUPÓN EN STRIPE
            —y no antes—. Ver el aviso de la cabecera. */}

        <Stagger className="mt-12 grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* ═══ FREE — secundario: contorno sobre navy ═══
              El contorno usa `--lp-ink-inverse` (blanco puro) y no
              `--lp-border-inverse` (blanco al 30%): sobre este fondo el 30% mide
              2.30:1, por debajo del 3:1 que WCAG 1.4.11 pide al contorno de un
              componente. Misma corrección que ya se hizo en los controles de
              §5.7; los swatches de esa sección siguen pendientes. */}
          <motion.div
            data-lp-reveal=""
            variants={VARIANTES_ITEM}
            transition={transicionItem}
            className="flex h-full flex-col rounded-2xl border border-[var(--lp-ink-inverse)] bg-[var(--lp-surface-inverse-5)] p-8"
          >
            <h3 className="text-[17px] font-semibold leading-none text-[var(--lp-ink-inverse)]">{free.nombre}</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[44px] font-bold leading-none tracking-[-0.03em] text-[var(--lp-ink-inverse)]">
                {pesos(free.precio_mensual)}
              </span>
              <span className="text-[15px] leading-none text-[var(--lp-ink-inverse-70)]">para siempre</span>
            </p>
            <p className="mt-3 text-[15px] leading-[1.5] text-[var(--lp-ink-inverse-70)]">
              {/* ⚠️ NO ESCRIBAS AQUÍ "no es una prueba de 14 días". Se intentó y
                  se retiró: negar el número lo imprime igual, y la instrucción
                  es que "14 días" no aparezca en la página. Se dice en positivo:
                  permanente. */}
              Sin tarjeta y no caduca. Es un plan permanente, no una prueba.
            </p>

            <ul className="mt-6 space-y-3">
              {free.features.map((f) => (
                /* El check de Free va en tinta inversa APAGADA (70%) frente al
                   acento del de Individual: la jerarquía se sostiene en el
                   color del check y no solo en la etiqueta. El TEXTO se queda a
                   opacidad plena — apagar la viñeta ordena, apagar el contenido
                   penaliza la lectura de lo que sí incluye el plan. */
                <li key={f} className="flex items-start gap-3 text-[15px] leading-[1.45] text-[var(--lp-ink-inverse)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lp-ink-inverse-70)]" aria-hidden />
                  {f}
                </li>
              ))}
              {/* Las carencias van en la MISMA lista y no en una nota al pie:
                  esconderlas abajo es exactamente la letra chiquita que la
                  página dice no tener. */}
              {FREE_NO_INCLUYE.map((f) => (
                /* -70 y no -50: sobre navy el 50% mide 4.20:1, bajo el 4.5 de
                   AA para texto normal. Este renglón sigue siendo secundario
                   —lo dice el icono de resta, no su opacidad—. */
                <li key={f} className="flex items-start gap-3 text-[15px] leading-[1.45] text-[var(--lp-ink-inverse-70)]">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {f} <span className="whitespace-nowrap">— no incluido</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[var(--lp-ink-inverse)] bg-[var(--lp-surface-inverse-10)] px-5 py-2.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-surface-inverse-5)]"
            >
              Crear cuenta gratis
            </Link>
          </motion.div>

          {/* ═══ INDIVIDUAL — primario: relleno blanco sólido ═══
              Misma jerarquía que los controles de §5.7: sólido = acción
              principal, contorno = secundaria. Es el comprador realista. */}
          <motion.div
            data-lp-reveal=""
            variants={VARIANTES_ITEM}
            transition={transicionItem}
            /* ═══ MARCO DE 2px + HAZ GIRATORIO + GLOW (Animated Border Glow) ══
               `p-[2px]` es EL GROSOR DEL BORDE: el relleno de dentro tapa el
               centro y lo que asoma alrededor son esos 2px de las capas de
               abajo. Con 1px —como estaba— el haz no tiene por dónde verse.

               ⚠️ ESTE CONTENEDOR NO LLEVA `overflow-hidden`, Y ES A PROPÓSITO.
               El glow tiene que SANGRAR HACIA AFUERA; recortarlo aquí lo mata,
               que es lo que pasaba antes. Quien recorta es cada capa por su
               cuenta (las dos `span` de abajo), así que el cuadrado giratorio
               nunca escapa y no hay desbordamiento de LAYOUT. Lo único que sale
               del borde es el desenfoque, que es ink overflow: no genera barra
               de scroll, igual que una `box-shadow`. Y son ~10px, muy dentro del
               `px-4 sm:px-8` de la sección.
               `isolate` es obligatorio: sin él, los `-z-*` de las capas se irían
               por detrás del fondo de la sección en vez de quedarse aquí.

               ⚠️ LA SOMBRA VA AQUÍ Y NO EN EL RELLENO BLANCO. Estaba en el
               relleno, y el relleno es hermano POSTERIOR de las capas del
               anillo: su `box-shadow` se pintaba ENCIMA del anillo y lo
               apagaba. En este contenedor la sombra se pinta en la primera
               capa del contexto de apilado —antes que los hijos de z negativo—,
               así que queda por detrás del anillo y del glow, que es su sitio. */
            className="relative isolate flex h-full flex-col rounded-2xl p-[3px] shadow-lg"
          >
            {/* ── GLOW ── la MISMA capa, desenfocada y por debajo. Es lo que
                hace que se lea como LUZ y no como una línea de color girando —
                sin esto el efecto no existe, por muy brillante que sea el haz.
                El `blur` se aplica DESPUÉS del recorte del propio span, así que
                el desenfoque se derrama fuera de su caja: halo con la forma de
                la tarjeta. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-20 overflow-hidden rounded-2xl blur-[10px]"
            >
              <span
                className="lp-borde-destello absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundImage: HAZ }}
              />
            </span>

            {/* ── ANILLO NÍTIDO ── base en reposo + haz. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
            >
              {/* El borde EN REPOSO. Es `--lp-border-inverse` —el mismo token
                  que da el borde de la tarjeta Free, así que las dos tarjetas
                  hablan el mismo idioma— y no `--lp-accent` al 40%, que es lo
                  que había y medía **1.27:1 contra el navy**: aritméticamente
                  invisible, y por eso el reporte decía que no se veía "ni
                  siquiera el borde estático". Este mide 2.45:1. */}
              <span className="absolute inset-0 bg-[var(--lp-border-inverse)]" />
              {/* Cuadrado del 200% del ancho: su círculo inscrito cubre la
                  diagonal de la tarjeta en cualquier ángulo, así que no quedan
                  esquinas sin barrer. */}
              <span
                className="lp-borde-destello absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundImage: HAZ }}
              />
            </span>

            {/* Relleno: tapa el centro y deja ver solo el anillo. El radio es
                el del marco menos su grosor (16 − 3), o si no se ve una luna
                de color en las esquinas. Sin `shadow-*`: la sombra vive en el
                contenedor, ver el aviso de arriba. */}
            {/* ⚠️ REVIERTE EL ANILLO DE FOCO A ACENTO. La sección puso blanco
                porque su fondo es navy, pero ESTA tarjeta es blanca: un anillo
                blanco sobre ella sería invisible (1.00:1). Con acento, 6.45:1.
                Cualquier tarjeta clara que se añada dentro de una franja
                oscura necesita esta misma línea. */}
            <div className="relative flex h-full flex-col rounded-[13px] bg-[var(--lp-surface)] p-8 [--lp-focus:var(--lp-accent)]">
            <p className="inline-flex w-fit items-center rounded-full bg-[var(--lp-accent-bg)] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] leading-none text-[var(--lp-accent)]">
              Recomendado
            </p>
            <h3 className="mt-4 text-[17px] font-semibold leading-none text-[var(--lp-ink-900)]">{individual.nombre}</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[44px] font-bold leading-none tracking-[-0.03em] text-[var(--lp-ink-900)]">
                {pesos(individual.precio_mensual)}
              </span>
              <span className="text-[15px] leading-none text-[var(--lp-ink-500)]">al mes</span>
            </p>
            {/* 6 490 / 649 = 10 meses exactos, así que "dos meses gratis" es
                aritmética de `plans.ts`, no una promesa de marketing. */}
            <p className="mt-3 text-[15px] leading-[1.5] text-[var(--lp-ink-500)]">
              O {pesos(individual.precio_anual)} al año — dos meses gratis.
            </p>

            <ul className="mt-6 space-y-3">
              {individual.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] leading-[1.45] text-[var(--lp-ink-700)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lp-accent)]" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>

            {/* ⚠️ APUNTA A /register Y NO AL CHECKOUT, Y NO ES UN OLVIDO.
                Hoy NO existe una vía de compra para quien no tiene cuenta:
                `/api/stripe/checkout` exige sesión (401 sin usuario), exige
                `clinica_id` y exige ser administrador de la clínica, y rechaza
                el plan `free`. `/pricing`, su único consumidor, resuelve el 401
                mandando a `/login?redirect=/pricing` — que para un visitante sin
                cuenta es un muro. Tampoco sirve `?plan=individual`: `/register`
                no lee ningún parámetro de plan. Enlazar a un checkout que no
                existe sería peor que el copy repetido que esto corrige. */}
            <Link
              href="/register"
              className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[var(--lp-accent)] px-5 py-2.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] transition-colors duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-navy)]"
            >
              Empezar con Individual
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            </div>
          </motion.div>
        </Stagger>

        <Reveal className="mt-10 text-center">
          <p className="text-[15px] leading-[1.55] text-[var(--lp-ink-inverse-70)]">
            ¿Clínica con varios médicos? Hay tres planes más, desde {pesos(desdeClinica)} al mes.{' '}
            <Link
              href="/pricing"
              className="font-semibold text-[var(--lp-ink-inverse)] underline underline-offset-4 decoration-[var(--lp-border-inverse)] transition-colors duration-[var(--sp-dur-micro)] hover:decoration-[var(--lp-ink-inverse)]"
            >
              Ver todos los planes
            </Link>
          </p>
          {/* Literal de `/pricing:217`. Si allá cambia, aquí también. */}
          {/* -70 y no -50: 4.20:1 sobre navy incumple AA, y a 13px con más
              razón. La letra pequeña legal es justo lo que no puede ser
              ilegible. */}
          <p className="mt-3 text-[13px] leading-[1.45] text-[var(--lp-ink-inverse-70)]">
            Todos los precios en MXN. IVA no incluido. Puedes cancelar en cualquier momento.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
