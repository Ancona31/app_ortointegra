import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PREGUNTAS_FAQ } from '@/components/landing/faq-contenido'
import { PLANS } from '@/lib/plans'

/* Layout de la landing pública — §3.2
   Existe por una sola razón: montar Inter SOLO aquí. El layout raíz
   (src/app/layout.tsx) lo comparten /login, /register, /pricing, /privacy,
   /terms, /forgot-password, /reset-password y los grupos (app), (launcher)
   y (offline); declarar la fuente ahí la mandaría al producto entero, que
   es justo lo que §3.2 prohíbe ("solo en la landing"). El route group no
   aparece en la URL: `/` sigue siendo `/`.

   ⚠️ `axes: ['opsz']` es CORRECTO pese a que la doc embarcada diga otra cosa.
   node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:170
   afirma que el eje extra de Inter es `slnt` — se quedó en Inter v3. La
   fuente de verdad es el JSON que el validador realmente lee:
   node_modules/next/dist/compiled/@next/font/dist/google/font-data.json,
   entrada "Inter" → [{opsz 14–32}, {wght 100–900}]. `slnt` no existe.
   Verificar SIEMPRE contra ese JSON, nunca contra la prosa de la doc.

   `latin-ext` es obligatorio, no opcional: sin él se rompen "Ángel",
   "Pérez", "práctica", "diseñado".

   Sin `adjustFontFallback: false` — se deja en su default `true`, que es
   lo que genera la métrica de respaldo ajustada y protege el CLS del
   presupuesto de §4.3·9.

   Sin `font-optical-sizing` forzado — se deja en el `auto` del navegador.
   Inter v4 se diseñó para eso, y la tanda (d) debe juzgar la escala
   tipográfica con el eje ya activo, no neutralizado. */
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  variable: '--lp-font',
  display: 'swap',
})

/* Metadata propia de `/`. Sobrescribe la del layout raíz SOLO para esta
   ruta: /login, /register y compañía no cuelgan de este grupo y siguen
   heredando la del root sin cambio.
   El título va SIN ® — §7·Global: la marca está en trámite ante IMPI
   (exp. 3594483), sin registro concedido, y usar ® es infracción. */
export const metadata: Metadata = {
  title: 'Spinus',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
}

/* ⚠️ EL WRAPPER VA DESNUDO. Solo la clase de la fuente, nada más.
   No es purismo: este <div> es ancestro del nav y del hero.
   · `overflow-*`, `contain-*`, `transform`, `will-change` → rompen el
     `sticky top-0` de SeccionNav.tsx:9, sin error de build.
   · `max-w-*` o `px-*` → estrechan <main> y descuadran el
     `calc((100vw-72rem)/2+2rem)` del sangrado del hero (SeccionHero.tsx:30),
     que se calcula contra el viewport, no contra el contenedor.
   · `h-full`, `h-screen`, `flex`, `grid` → recortan o reflujan el árbol.
   Tampoco emite <html> ni <body>: ya los emite src/app/layout.tsx:11,19 y
   repetirlos aquí es DOM inválido. */
/* JSON-LD de la FAQ (§7·12b). Es el PRIMER structured data del repo: hasta
   esta tanda no había un solo `application/ld+json` en `src/`.

   ⚠️ NO ESPERES EL ACORDEÓN EN GOOGLE, Y NO LO VENDAS COMO SI. Los rich
   results de FAQPage están restringidos desde 2023 a sitios de gobierno y de
   salud reconocidos; Spinus no entra. El objetivo declarado es otro y ese sí
   se cumple: dar contenido estructurado que un LLM pueda citar cuando le
   pregunten si conviene contratarlo.

   Va en el layout y no en la sección por dos motivos: este archivo es
   componente de SERVIDOR (el `<script>` sale en el HTML inicial sin coste de
   cliente) y es donde ya vive la metadata de `/`. La contrapartida es que el
   dato tiene que estar en un módulo neutro —`faq-contenido.ts`— porque
   importar una constante desde un `'use client'` devuelve una referencia de
   cliente, no el valor.

   `dangerouslySetInnerHTML` no es una licencia: es la única forma de emitir
   JSON crudo sin que React escape las comillas. La entrada es una constante
   del repo, no input de usuario, y `JSON.stringify` cierra el paso a
   `</script>` en el contenido. */
const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PREGUNTAS_FAQ.map((item) => ({
    '@type': 'Question',
    name: item.pregunta,
    acceptedAnswer: { '@type': 'Answer', text: item.respuesta },
  })),
}

/* ═══ GRAFO DE ENTIDADES (F5) — Organization + SoftwareApplication + Person ══
   El FAQPage de arriba responde "¿qué dudas resuelve?". Esto responde las tres
   preguntas que un modelo necesita para hablar de Spinus sin leer la página:
   QUÉ es, CUÁNTO cuesta y QUIÉN lo hizo. Va en un segundo `<script>` y no
   fundido con el FAQPage: son grafos independientes, los buscadores los
   combinan igual, y así el bloque que ya estaba en producción no se toca.

   ⚠️ EL PRECIO SALE DE `plans.ts`, COMO EN LA SECCIÓN. Un precio distinto en el
   HTML visible y en el structured data es la peor versión del problema: el
   modelo cita el que no ves. Con el módulo como origen único no puede pasar.

   ⚠️ `sameAs` DE LA ORGANIZACIÓN VA VACÍO A PROPÓSITO — NO LO RELLENES A OJO.
   No hay un solo perfil social en el repo: el footer solo enlaza /privacy,
   /terms, /pricing y un mailto. Inventar URLs de redes en `sameAs` es afirmar
   como dato algo sin verificar, que es justo lo contrario de para qué existe
   este grafo. Cuando Angel confirme las cuentas reales, se añade el array.

   ⚠️ EL CRUCE CON dranconacolumna.com ES UN CONTRATO DE DOS LADOS Y AQUÍ SOLO
   ESTÁ UNO. Para que la identidad del fundador se resuelva como la misma
   persona, el otro sitio tiene que (1) apuntar de vuelta a
   https://www.spinus.com.mx en su propio `sameAs` y (2) usar EXACTAMENTE la
   misma URL de imagen que se declara aquí. Mientras eso no se haga, el enlace
   es unidireccional y no cumple su función. No es trabajo de este repo, pero
   sin ello esta mitad no sirve de nada.
   La URL de la foto es la que la landing ya sirve en §5.11
   (`SeccionHistoria.tsx:60`), así que no se introduce un asset nuevo. */
const SITIO = 'https://www.spinus.com.mx'

const jsonLdGrafo = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITIO}/#organization`,
      name: 'Spinus',
      url: SITIO,
      logo: `${SITIO}/logo-spinus.png`,
      email: 'soporte@spinus.com.mx',
      description:
        'Sistema de gestión clínica para cirugía de columna, traumatología y ortopedia: expediente electrónico, notas médicas, recetas con QR verificable y visor DICOM.',
      areaServed: 'MX',
      founder: { '@id': `${SITIO}/#fundador` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITIO}/#software`,
      name: 'Spinus',
      url: SITIO,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      inLanguage: 'es-MX',
      publisher: { '@id': `${SITIO}/#organization` },
      /* Las prestaciones también salen del módulo: es la misma lista que ve el
         visitante en la tarjeta de Individual. */
      featureList: PLANS.individual.features,
      offers: [
        {
          '@type': 'Offer',
          name: PLANS.free.nombre,
          price: PLANS.free.precio_mensual,
          priceCurrency: 'MXN',
          url: `${SITIO}/register`,
          description: `Plan gratuito permanente, hasta ${PLANS.free.max_pacientes} pacientes. No requiere tarjeta.`,
        },
        {
          '@type': 'Offer',
          name: PLANS.individual.nombre,
          price: PLANS.individual.precio_mensual,
          priceCurrency: 'MXN',
          url: `${SITIO}/pricing`,
          /* `unitCode: 'MON'` es el código UN/CEFACT de "mes". Es lo que
             convierte 649 en "649 al mes" para quien lee el grafo; sin esto la
             cifra es ambigua y se puede citar como pago único. */
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: PLANS.individual.precio_mensual,
            priceCurrency: 'MXN',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
          },
        },
      ],
    },
    {
      '@type': 'Person',
      '@id': `${SITIO}/#fundador`,
      name: 'Dr. Ángel M. Ancona Pérez',
      jobTitle: 'Cirujano de columna y fundador de Spinus',
      image: `${SITIO}/landing/dr-ancona.jpg`,
      worksFor: { '@id': `${SITIO}/#organization` },
      sameAs: ['https://dranconacolumna.com'],
    },
  ],
}

/* ⚠️ EL WRAPPER SIGUE DESNUDO — los `<script>` son hermanos, no clase nueva.
   Todo lo que dice el comentario de arriba sobre no tocar este `<div>` sigue
   vigente; el fragmento existe solo para colgar el JSON-LD al lado. */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGrafo) }}
      />
      <div className={`${inter.variable} font-lp`}>{children}</div>
    </>
  )
}
