import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/* ⚠ `camera=()` ES CORRECTO AUNQUE EL CONSENTIMIENTO TOME FOTOS. NO LO ABRAS.
 *
 * La foto de identificación del firmado (GUIA_FORMULARIOS_05 §6) se captura con
 * el campo de archivo nativo (`<input type="file" capture>`), que delega en la
 * aplicación de cámara del SISTEMA: no pasa por `getUserMedia` ni por esta
 * política — el permiso lo administra el sistema operativo a su propia app de
 * cámara, no el navegador a la página. Verificado en iPad y Android
 * (2026-08-12, paso 0 de la captura nativa).
 *
 * Hubo una excepción `camera=(self)` acotada a las tres rutas del firmado,
 * para un visor `getUserMedia` que se retiró — en móvil rechazaba con
 * `NotAllowedError` sin llegar a enseñar el diálogo—. Se revirtió al retirarse
 * su único consumidor: una función de dispositivo abierta que ninguna pantalla
 * usa es superficie de ataque gratis. Si algún día algo necesita `getUserMedia`
 * de verdad, la excepción se reabre POR RUTA (historial: dos bloques con
 * lookahead de exclusión derivado de una sola lista), nunca en `/(.*)`. */
const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
]

/* La política de caché de los estáticos servidos desde `public/`, en un solo
 * sitio para los tres directorios que la usan. El porqué de cada número —y por
 * qué NO lleva `immutable`— está junto a la primera regla que la aplica, en
 * `headers()`. Si algún día hace falta una política distinta por directorio,
 * esto se parte; hoy los tres quieren exactamente lo mismo. */
const cacheEstaticos = [
  { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
]

const nextConfig: NextConfig = {
  // Build ID único por deploy — usado por el Service Worker para nombrar
  // el cache. Garantiza que cada deploy tenga su propio cache y elimina
  // desajustes de hashes entre HTML cacheado y chunks físicos.
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'dev-local'
  },
  // Router Cache (Client Cache) del App Router. Por defecto en Next 15+ las
  // rutas dinámicas tienen stale time 0 — se refetchean en cada navegación.
  // Todas las rutas de (app) son dinámicas porque sus layouts leen cookies vía
  // getUser(), así que sin esto el prefetch se descarta al instante.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: './src/lib/stubs/empty.js' },
      path: { browser: './src/lib/stubs/empty.js' },
      crypto: { browser: './src/lib/stubs/empty.js' },
      stream: { browser: './src/lib/stubs/empty.js' },
      buffer: { browser: './src/lib/stubs/empty.js' },
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      /* ⚠️ SIN ESTO, LOS 20 ICONOS DE LA AGENDA SE REVALIDAN EN CADA NAVEGACIÓN.
       *
       * Next sólo pone caché inmutable a `/_next/static/`, que lleva hash en el
       * nombre. Lo de `public/` sale con `Cache-Control: public, max-age=0`
       * —comprobado con `curl -I` sobre `/icons/urgencias.svg`—, o sea que el
       * navegador vuelve a preguntar por cada uno cada vez.
       *
       * Los consume `IconoDelEvento` en `agenda/page.tsx:332`, con `mask-image`,
       * así que se piden al PINTAR: tarde en la cascada, cuando la agenda ya
       * está compitiendo por ancho de banda con sus dos peticiones de datos. En
       * producción se midió uno en 470 ms para 2,7 kB. La mayor parte de eso era
       * el middleware autenticando el archivo —ya arreglado, los estáticos salen
       * del matcher—; lo que queda y esta regla elimina es el viaje de
       * revalidación.
       *
       * ⚠️ NO PONGAS `immutable`, Y ÉSTA ES LA RAZÓN CONCRETA: estos SVG NO
       * LLEVAN HASH EN EL NOMBRE. `/icons/urgencias.svg` se llama igual antes y
       * después de un rediseño, así que `immutable` —que autoriza al navegador a
       * no volver a preguntar NUNCA durante el max-age— dejaría el icono viejo
       * clavado el tiempo que durase, sin forma de purgarlo salvo renombrando el
       * archivo. Con `/_next/static/` sí se puede porque ahí el nombre cambia con
       * el contenido; aquí no.
       *
       * EL REPARTO ELEGIDO:
       *  · `max-age=86400` — un día sin preguntar. Un icono no cambia en una
       *    jornada, y la jornada es justo la unidad de uso de esta aplicación.
       *  · `stale-while-revalidate=604800` — durante la semana siguiente el
       *    navegador PINTA el icono viejo al instante y revalida en segundo
       *    plano. O sea que ni siquiera al caducar hay una espera visible.
       *
       * EL PRECIO, ACEPTADO: tras cambiar un icono, quien ya lo tenía puede ver
       * el anterior hasta un día. Si algún día eso importa (un icono equivocado,
       * no feo), la salida es RENOMBRAR el archivo — el nombre es la clave de
       * caché y también lo que guarda la base en `appointments.icono`, así que
       * renombrar exige migrar esas filas. No es gratis; por eso el max-age es
       * de un día y no de un año. */
      {
        source: '/icons/:archivo*',
        headers: cacheEstaticos,
      },
      /* ⚠️ MISMA REGLA, Y AQUÍ HAY MUCHOS MÁS BYTES QUE EN LOS ICONOS: 29 mp3 de
       * los tutoriales (~5 MB) y 11 tipografías (~3,5 MB), revalidándose igual
       * que los SVG. Los dos directorios ya estaban excluidos del middleware
       * desde antes —`/fonts/` por el incidente de fontkit, `/audio/` por el
       * matcher—, así que lo único que faltaba era decirle al navegador que
       * puede quedárselos.
       *
       * ⚠️⚠️ SOBRE `/fonts/` Y LA GENERACIÓN DE PDF, QUE ES LA PREGUNTA OBVIA:
       * ESTA CABECERA NO PUEDE AFECTARLA. En el servidor, react-pdf NO pide las
       * tipografías por HTTP — las lee del DISCO. `PdfStyles.tsx:4-17` bifurca
       * por `typeof window === 'undefined'` y la rama de servidor registra
       * `path.join(process.cwd(), 'public', 'fonts', …)`. Una cabecera de
       * respuesta HTTP no tiene forma de tocar un `fs.readFile`.
       * Por URL se cargan sólo en el NAVEGADOR: la rama `else` de ese mismo
       * archivo, `pdfClientFallback.ts` y las dos familias de v2
       * (`pdf/v2/fonts.ts:75` y `:102`, que no tienen rama de servidor y cuyos
       * consumidores son los componentes de `taller-v2`). Ahí cachear sólo puede
       * ayudar: el archivo es inmutable de hecho y hoy se vuelve a pedir en cada
       * navegación que genere un documento.
       * Ninguna ruta de `src/app/api` renderiza con `@react-pdf/renderer`.
       *
       * ⚠️ Y AUN ASÍ NO SE USA `immutable`, por lo mismo que en los iconos y con
       * más razón: `Roboto-Bold.ttf` tampoco lleva hash. Que en la práctica no
       * cambie nunca no es garantía de nada — el día que se sustituya un .ttf
       * por otro con el mismo nombre, `immutable` lo dejaría clavado sin salida.
       * Un día de max-age y una semana de revalidación en segundo plano dan
       * prácticamente todo el beneficio sin esa esquina. */
      {
        source: '/audio/:archivo*',
        headers: cacheEstaticos,
      },
      {
        source: '/fonts/:archivo*',
        headers: cacheEstaticos,
      },
    ]
  },
  images: {
    // Permite cargar logos de clínicas desde Supabase Storage.
    // El hostname se deriva de NEXT_PUBLIC_SUPABASE_URL para mantener una sola
    // fuente de verdad entre entornos. El guard evita que el build truene si
    // la variable no está poblada al momento de cargar el config.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: 'https' as const,
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  serverExternalPackages: [
    '@cornerstonejs/core',
    '@cornerstonejs/tools',
    '@cornerstonejs/dicom-image-loader',
    '@cornerstonejs/codec-charls',
    '@cornerstonejs/codec-libjpeg-turbo-8bit',
    '@cornerstonejs/codec-openjpeg',
    '@cornerstonejs/codec-openjph',
    'dicom-parser',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      }
    }
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },
};

export default withSentryConfig(nextConfig, {
  org: "spinus",
  project: "spinus",
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,

  /* ⚠ APAGADAS A PROPÓSITO — Y HAY QUE REVISARLO SI APARECE `instrumentation.ts`.
   *
   * Encendidas (su valor por defecto), estas dos opciones hacen que el plugin
   * inyecte un `sentry-wrapper-module` en el bundle de servidor de CADA ruta,
   * que llama a `wrapServerComponentWithSentry`. Eso arrastra `@sentry/node`
   * con ~20 paquetes `@opentelemetry/instrumentation-*` detrás al grafo de
   * servidor de todas las rutas, y se paga en cada arranque en frío.
   *
   * Hoy eso es costo puro: los wrappers instrumentan contra un SDK que NUNCA
   * se inicializa, porque `Sentry.init()` de servidor solo corre desde el
   * `register()` de un `instrumentation.ts` en la raíz y ese archivo no existe
   * (el propio build lo avisa: "Could not find a Next.js instrumentation
   * file"). Ver la cabecera de `sentry.server.config.ts`.
   *
   * SI ALGÚN DÍA SE CREA `instrumentation.ts`, esta decisión deja de ser
   * gratis: con el SDK de servidor ya inicializado, los wrappers sí reportan
   * errores y trazas de Server Components y rutas de API. Vuelve a evaluarla
   * entonces, midiendo — no la des por buena por herencia.
   *
   * El Sentry de NAVEGADOR no se toca aquí: sigue vivo desde
   * `instrumentation-client.ts`, que no depende de estas opciones. */
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentAppDirectory: false,
  },
});
