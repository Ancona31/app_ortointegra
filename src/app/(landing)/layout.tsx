import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

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
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} font-lp`}>{children}</div>
}
