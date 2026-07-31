import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PREGUNTAS_FAQ } from '@/components/landing/faq-contenido'

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

/* ⚠️ EL WRAPPER SIGUE DESNUDO — el `<script>` es hermano, no clase nueva.
   Todo lo que dice el comentario de arriba sobre no tocar este `<div>` sigue
   vigente; el fragmento existe solo para colgar el JSON-LD al lado. */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <div className={`${inter.variable} font-lp`}>{children}</div>
    </>
  )
}
