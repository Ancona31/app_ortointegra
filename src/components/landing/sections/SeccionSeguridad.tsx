'use client'

import type { ReactNode } from 'react'
import { Shield, Scale, Database, DatabaseBackup } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Reveal from '@/components/landing/motion/Reveal'
import Stagger, { VARIANTES_ITEM } from '@/components/landing/motion/Stagger'
import { DIST, DUR, EASE, SPRING } from '@/components/landing/motion/tokens'

/* F1.3·e4 — AQUÍ HABÍA UN CAMPO `iconBg: string`. Cada tarjeta traía el suyo
   (blue-50, violet-50, emerald-50) con sus iconos a juego, y el propio comentario
   del campo ya lo declaraba deuda de §3.1: los semánticos decoraban en vez de
   representar un dato. La tanda e4 los unifica a --lp-accent-bg/--lp-accent, y
   un campo cuyo valor es idéntico en las tres filas no es dato: es una constante
   disfrazada de configuración. El fondo vive ahora en el JSX del render, una
   sola vez. Si alguna vez una tarjeta necesita OTRO fondo por un motivo real,
   reponer el campo es trivial — pero que el motivo exista primero. */
interface Tarjeta {
  icon: ReactNode
  title: string
  desc: ReactNode
}

/* ⚠️ Cada claim de esta sección está verificado contra el producto. Antes de
   añadir o endurecer uno, releer §7·10. Lo que se eliminó y POR QUÉ:

   · "Ni siquiera nosotros podemos leer tus notas médicas" — FALSO: existe
     service_role y la IA corre server-side. Riesgo legal, y de gremio: Angel
     es competidor de su propio cliente.
   · "Información cifrada donde solo tú tienes la llave" — implica cifrado
     extremo a extremo con custodia exclusiva del médico. No es el caso.
   · "cumple automáticamente con la NOM-004" — el obligado por la norma es el
     médico, no el software. Spinus da la estructura; no absuelve a nadie.
   · "sincronización total en la nube en tiempo real" — el bug de sync de
     Google Calendar sigue abierto (§11). Mismo motivo por el que §7·9 lo
     prohíbe en Portabilidad.
   · "Tu consultorio nunca se detiene" / "Acceso total" / "Privacidad
     Absoluta" / "blindada" — absolutos sin respaldo. Había 12 en 65 líneas.

   ⚠️ LA TARJETA 2 CAMBIÓ EN LA TANDA DE LA FAQ (2026-07-31) POR DOS MOTIVOS
   INDEPENDIENTES. No revientas nada revirtiéndola, pero reintroduces un claim
   falso:

   1. "Cada médico solo accede a sus pacientes" ERA FALSO para el médico
      administrador de clínica, que es el caso normal en cualquier cuenta
      multi-médico. La policy `pacientes_select_activos` admite tres ramas
      —`soy_admin_de_clinica()`, rol `secretaria`, o `soy_medico_tratante(id)`—
      (`20260524_etapa5e_bd1_policies_pacientes.sql:52-63`), y
      `consultas_select` deja pasar `medico_id = auth.uid() OR
      soy_admin_de_clinica()` (`20260530_etapa5f_paso3_policies_consultas.sql:80-92`).
      O sea: el admin ve los expedientes de todo su equipo. Decirlo en voz
      alta es mejor que esperar a que lo descubra un director médico.
   2. LA FRASE DE LA BITÁCORA YA PUEDE ESCRIBIRSE. La verificación de §10
      estaba abierta y esta tanda la cerró: `useAuditAccess` está montado en
      las cinco páginas que leen datos clínicos —expediente (`page.tsx:26`),
      consulta (`consulta/[consultaId]/page.tsx:38`), nueva nota (`:188`),
      documentos (`:44`) y laboratorios (`:18`)—, y `/api/audit` valida sesión
      server-side antes de escribir.
      ⚠️ CON UN ASTERISCO QUE CONVIENE NO OLVIDAR: el registro es
      fire-and-forget desde el cliente (`useAudit.ts:16-19`) y `logAudit`
      traga los errores (`audit.ts:84-86`). Si el POST falla, el acceso ocurre
      igual y no queda rastro. Es el mismo defecto que LP-DT-21 y por eso el
      copy dice "queda registrado", no "queda registrado siempre". */
const tarjetas: Tarjeta[] = [
  {
    icon: <Scale className="w-6 h-6 text-[var(--lp-accent)]" />,
    title: 'Conforme a la norma',
    desc: (
      <>
        La estructura del expediente y los formatos siguen la{' '}
        <strong className="text-[var(--lp-ink-700)]">NOM-004</strong>, y el tratamiento de datos se rige por la{' '}
        <strong className="text-[var(--lp-ink-700)]">LFPDPPP</strong> vigente.
      </>
    ),
  },
  {
    icon: <Database className="w-6 h-6 text-[var(--lp-accent)]" />,
    title: 'Tu información, separada',
    desc: 'Cada médico ve solo a sus pacientes. En cuentas de clínica, el administrador ve los expedientes de todo su equipo. Cada acceso queda registrado en bitácora.',
  },
  {
    icon: <DatabaseBackup className="w-6 h-6 text-[var(--lp-accent)]" />,
    title: 'Respaldo automático',
    desc: 'Tus expedientes se respaldan solos, todos los días. Si algo falla, la información sigue ahí.',
  },
]

/* ⚠️ NO REINTRODUCIR LA ESCALERA. §3.4·10 pide las 3 tarjetas escalonadas y
   §5.10 fija los offsets en 0/24/48px, pero la QA visual de F1.3·b1 lo
   descartó y la decisión es firme, no un pendiente. Aquí vivía
   `const ESCALERA = ['sm:mt-0','sm:mt-6','sm:mt-12']` aplicado con
   `items-start`. Falla por dos motivos:
     · Las 3 tarjetas tienen cuerpos de largo distinto, así que con
       `items-start` sus alturas también difieren. Offset desigual sobre
       altura desigual no dibuja una diagonal: dibuja un zigzag. Los tres
       títulos y los tres cuerpos acaban a alturas que no guardan relación
       entre sí y lee como error de maquetación, no como intención.
     · El `sm:mt-12` empujaba la tercera tarjeta fuera del ancho de
       contenido: su borde derecho se salía del contenedor.
   Si una tanda futura quiere recuperar el escalón, la condición previa es
   igualar las alturas de los cuerpos (o fijar altura de tarjeta), no
   reponer los `mt`. Registrado en DEUDA_TECNICA.md (LP-DT-20). */

/* Section: Seguridad
   El array no es adorno: F2.a necesita una lista iterable para el Stagger,
   porque §4.4 prohíbe envolver los hijos en wrappers extra (rompen el span
   del grid) y obliga a variantes padre→hijo sobre este map.

   ═══ SUPERFICIE: FRANJA #f5f8fc, y el motivo por el que ANTES era blanca
       ya no existe ═══
   Hasta la tanda de resecuenciación esta sección estaba clavada en blanco y
   el comentario que lo justificaba decía, con razón en su momento: «la fija
   el CTA — su lavado color-mix resuelve a ≈#f6f9fc, a un punto por canal de
   la franja #f5f8fc, así que una Seguridad en franja se fundiría con el
   bloque siguiente en una sola banda».
   Ese razonamiento CADUCÓ cuando se insertó `SeccionFAQ` entre Seguridad y
   el CTA. Seguridad ya no es vecina del cierre: entre las dos hay una
   sección blanca entera. El único argumento que la ataba al blanco era la
   adyacencia con el lavado, y la adyacencia se rompió. Nadie volvió a
   mirarlo, y el efecto colateral fue una tirada de TRES blancos seguidos
   —Control, Seguridad, FAQ— que dejaba el último tercio de la página sin
   corte cromático.
   Con la franja aquí, la cola queda `Historia (franja) → Control (blanco) →
   Seguridad (franja) → FAQ (blanco) → CTA (oscuro)`. Alternancia limpia y
   ninguna franja pegada a un lavado.

   ⚠️ QUÉ LA VOLVERÍA A BLOQUEAR — dos condiciones, cualquiera de las dos:
     1. Que el FAQ se mueva de sitio o desaparezca y Seguridad vuelva a ser
        vecina directa del CTA. Ahí regresa intacto el argumento de arriba:
        franja + lavado = una sola banda de ~1200px. Si tocas el orden en
        `(landing)/page.tsx`, esta superficie se revisa CON él.
     2. Que Control (`SeccionControl.tsx`) pase a franja. Hoy no puede
        —Historia está en franja y es la única sección sin contenedor
        interno que la defienda—, pero si algún día Historia se mueve y
        Control gana la franja, esta sección tendría franja arriba y tendría
        que volver a blanco.
   El `py-16 sm:py-24 lg:py-32` de abajo es PROPIO, no donado: cambiar el
   `bg` aquí no tiñe padding ajeno, al contrario de lo que pasa en la
   costura Problema↔Features (LP-DT-19).
   Las 3 tarjetas son `bg-white`, así que pasan de blanco-sobre-blanco a
   blanco-sobre-franja: el contraste interno GANA con este cambio. */
export default function SeccionSeguridad() {
  /* Un solo `useReducedMotion` para la sección, sin ramificar el render
     (§4.3·7). Ver `Reveal.tsx`. */
  const sinMovimiento = useReducedMotion()
  const transicionItem = sinMovimiento
    ? { duration: 0 }
    : { duration: DUR.section, ease: EASE.out }

  return (
    <section className="bg-[var(--lp-surface-alt)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* F1.3·c3 — `mb-12` (48). Ver SeccionFeatures.tsx. */}
        {/* §5.10 · F2.a·a1 — EL `<Reveal>` TOMA EL `mb-12`, no envuelve un div
            que lo lleve (7.1 de la auditoría de F2.a). Idéntico a
            `SeccionPortabilidad.tsx:16`, que es el mismo elemento: bloque de
            titular seguido de retícula.
            ⚠️ SOLO EL ENCABEZADO. Las 3 tarjetas de :186 NO entran en a1: su
            ficha pide `Stagger` (`STAGGER.siblings`) y eso es a2. Hasta
            entonces el encabezado entra y las tarjetas están quietas — es un
            estado intermedio, no un olvido.
            ⚠️ Y SIGUEN SIN ESCALERA (LP-DT-20). Ni a1 ni a2 reponen los
            offsets verticales: `items-stretch` de :164 es lo que los
            sustituyó. */}
        <Reveal className="text-center mb-12">
          {/* F1.3·e3 — pastilla de kicker unificada: --lp-accent-bg / --lp-accent.
              e4 llevó los fondos de icono de las tres cards al mismo par, así
              que la sección entera va con un solo acento. */}
          <div className="inline-flex items-center gap-2 bg-[var(--lp-accent-bg)] rounded-full px-3.5 py-1 mb-6">
            <Shield className="w-3.5 h-3.5 text-[var(--lp-accent)]" />
            {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
            <span className="text-[12px] font-semibold text-[var(--lp-accent)] uppercase tracking-[0.12em] leading-none">Seguridad clínica</span>
          </div>
          {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
              1.10. Ver SeccionFeatures.tsx. */}
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-[var(--lp-ink-900)] tracking-[-0.03em] leading-[1.10]">
            Tu práctica,{' '}
            <span className="text-[var(--lp-ink-500)]">protegida</span>
          </h2>
        </Reveal>

        {/* `items-stretch` explícito (es el default de grid, pero aquí importa
            que se lea): las 3 tarjetas arrancan alineadas arriba y comparten
            altura, que es justo lo que la escalera rompía. Cambiarlo a
            `items-start` devuelve las alturas desiguales. */}
        {/* ═══ §5.10 · STAGGER DE LAS 3 TARJETAS, 70ms (F2.a·a2) ═══
            El `<Stagger>` ES la retícula y no emite nada, así que el
            `items-stretch` de abajo sigue actuando sobre las tarjetas y las
            tres siguen compartiendo altura. Eso importa más aquí que en
            ninguna otra sección: es justo lo que sustituyó a la escalera
            descartada en LP-DT-20, y un wrapper por hijo lo habría deshecho.
            ⚠️ SIGUE SIN ESCALERA. a2 tampoco repone los offsets 0/24/48.

            ⚠️ EL LEVANTAMIENTO YA TIENE DUEÑO — a3 LO RECUPERÓ, Y ESTA SECCIÓN
            SE INCLUYÓ POR ESO. a2 lo dejó muerto: en cuanto la tarjeta anima
            `y`, motion escribe `transform` inline y gana a la utilidad
            `hover:-translate-y-1` (`motion-dom/.../build-transform.mjs:65-67`).
            Ahora es un `whileHover` con `DIST.elevacionHover` — el mismo 4px de
            antes, dicho donde motion sí lo respeta.

            ⚠️ AQUÍ NO HAY `useTilt`, Y ES DELIBERADO. La inclinación es solo
            del bento (§4.4 dice "5 cards del grid", y son esas cinco). Estas
            tres comparten el gesto de elevarse pero no el de inclinarse: el
            bento es la retícula de producto, donde el tilt premia la
            exploración; esta es la sección de garantías, donde tres tarjetas
            girando a la vez restarían seriedad al único bloque de la página
            cuyo trabajo es transmitir formalidad. Si una tanda futura quiere
            unificarlos, es decisión de PM, no limpieza.

            `hover:shadow-lg` se queda en CSS: la sombra no es transform, así
            que aquí nunca estuvo muerta y no hay nada que absorber. Por eso
            estas tarjetas conservan su `transition-all`, al revés que las del
            bento — allí motion reescribe el `box-shadow` cada cuadro y la
            transición CSS estorbaba. */}
        <Stagger className="grid sm:grid-cols-3 gap-6 items-stretch">
          {/* ⚠️ Estas tarjetas son las que MÁS pierden en b1: eran el último
              glass de la landing (bg-white/30 + backdrop-blur-md), es decir
              azulejos esmerilados, y pasan a blanco sobre una sección blanca
              — el relleno queda a 1.00:1 y solo las dibujan el filete y la
              sombra. Es deliberado: doctrina única de card de §3.1 (bg-white
              + border-[0.5px] #e6ebf2 + shadow-sm), la misma de las 5 del
              bento y las 3 de Portabilidad. Si la QA visual las considera
              insuficientes, la salida NO es devolver el blur: es rellenarlas
              de #f5f8fc invirtiendo card y sección. No abrir una segunda
              doctrina de card para esta sección sola.

              ⚠️ EL PADDING INTERIOR NO ENTRA EN ESA DOCTRINA (decisión de
              PM en c1). La doctrina única cubre fondo, borde y sombra —
              nada más. Que estas cards usen `p-8` (32) y las del bento
              `p-6` (24) NO es incoherencia pendiente de barrer: ambos
              están en la escala de §3.3 y responden a densidades de
              contenido distintas. No los unifiques.
              (Matiz: el `px-6 py-5` de los ítems de Portabilidad era otro
              caso. El 24 horizontal estaba en escala; el `py-5` = 20 no lo
              estaba, y c3 ya lo subió a `py-6` — por estar fuera de escala,
              no por divergir de estas dos.) */}
          {tarjetas.map((t) => (
            <motion.div
              key={t.title}
              data-lp-reveal=""
              variants={VARIANTES_ITEM}
              transition={transicionItem}
              whileHover={{ y: -DIST.elevacionHover, transition: SPRING.snap }}
              className="bg-[var(--lp-surface)] rounded-2xl border-[0.5px] border-[var(--lp-border)] p-8 shadow-sm hover:shadow-lg transition-all duration-[var(--sp-dur-micro)]"
            >
              {/* F1.3·c3 — `mb-6` (24), no mb-5: 20 no está en la escala. */}
              <div className="w-12 h-12 rounded-xl bg-[var(--lp-accent-bg)] flex items-center justify-center mb-6">
                {t.icon}
              </div>
              {/* F1.3·d4 — rol H3 de card: 19px · -0.015em · 1.30.
                  Ver SeccionFeatures.tsx. El `font-bold` (los otros dos sitios
                  van semibold) se conserva: el rol no define peso. */}
              <h3 className="text-[19px] font-bold text-[var(--lp-ink-900)] tracking-[-0.015em] leading-[1.30] mb-3">{t.title}</h3>
              {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx.
                  Estas 3 tarjetas tienen cuerpos de largo desigual y comparten
                  altura por `items-stretch` (ver la nota de la escalera arriba):
                  al subir de 14 a 17 crecen las tres a la vez, así que la
                  retícula no se descuadra — la más larga sigue mandando. */}
              <p className="text-[17px] text-[var(--lp-ink-500)] leading-[1.65]">{t.desc}</p>
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
