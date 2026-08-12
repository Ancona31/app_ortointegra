import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/* ============================================================================
 * ⚠ HAY DOS BLOQUES DE CABECERAS, Y NO SON DUPLICACIÓN. NO LOS UNAS.
 * ============================================================================
 *
 * Las cuatro cabeceras de `cabecerasComunes` son idénticas en los dos bloques.
 * Lo único que cambia es `Permissions-Policy`, y cambia en UNA función y en UNA
 * ruta:
 *
 *   Todo el sitio            camera=()      — nadie, ni el propio origen
 *   /expediente/:id/documentos  camera=(self)  — solo el propio origen
 *
 * ── POR QUÉ LA EXCEPCIÓN EXISTE ─────────────────────────────────────────────
 * El firmado del consentimiento captura la foto de la identificación del
 * firmante con la cámara (GUIA_FORMULARIOS_05 §6), y esa pantalla vive en esa
 * ruta. Con `camera=()` el navegador DENIEGA `getUserMedia` sin llegar a
 * preguntarle al usuario: no es que el médico rechace el permiso, es que nunca
 * se le ofrece. Se descubrió probando en iPad y en Android, donde fallaba igual
 * —lo que descartaba que fuera cosa de un navegador concreto—.
 *
 * ── POR QUÉ NO SE ABRE EN `/(.*)` Y YA ──────────────────────────────────────
 * Porque es la única pantalla que necesita cámara. Abrirla en todo el sitio
 * significa que CUALQUIER otra pantalla podría pedirla, y si algún día algo
 * inyecta contenido en una de ellas, la cámara estaría a su alcance. Partir el
 * bloque en dos cuesta estas líneas; abrir una función de dispositivo en toda la
 * aplicación cuesta bastante más.
 *
 * `microphone` y `geolocation` siguen cerrados a todos en los DOS bloques: la
 * excepción es de una función, no del renglón entero.
 *
 * ── ⚠ Y POR QUÉ LOS ORÍGENES SE EXCLUYEN ENTRE SÍ ───────────────────────────
 * Next aplica TODAS las reglas cuyo `source` coincida, así que si las dos
 * cubrieran la ruta de documentos el navegador recibiría dos `Permissions-Policy`
 * y mandaría la primera aparición de `camera` —el orden decidiría el permiso, en
 * silencio y sin error—. Por eso la regla general excluye esa ruta con un
 * lookahead en vez de confiar en el orden.
 *
 * ⚠ Y ESO OBLIGA A ESCRIBIR LA RUTA DOS VECES, en dos sintaxis distintas: la
 * regla concreta usa el `:id` de path-to-regexp y el lookahead usa `[^/]+`,
 * porque dentro de un grupo de exclusión el parámetro con nombre no vale. **Si
 * cambias una, cambia la otra**, o las dos reglas volverán a solaparse.
 * Comprobación, con el servidor levantado:
 *
 *   curl -sI http://localhost:3000/expediente/abc/documentos | grep -ci permissions-policy   → 1
 *   curl -sI http://localhost:3000/expediente/abc/documentos | grep -i  permissions-policy   → camera=(self)
 *   curl -sI http://localhost:3000/inicio                    | grep -i  permissions-policy   → camera=()
 * ========================================================================== */

const cabecerasComunes = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
]

/** Ni el propio origen. Es el valor de todo el sitio menos una ruta. */
const SIN_CAMARA = 'camera=(), microphone=(), geolocation=()'
/** Solo el propio origen, y solo donde se firma el consentimiento. */
const CON_CAMARA = 'camera=(self), microphone=(), geolocation=()'

/**
 * La pantalla del firmado, que es la única excepción. Su gemelo es el lookahead
 * de la regla general, más abajo: las dos tienen que decir la misma ruta.
 */
const RUTA_DOCUMENTOS = '/expediente/:id/documentos'

const nextConfig: NextConfig = {
  // Build ID único por deploy — usado por el Service Worker para nombrar
  // el cache. Garantiza que cada deploy tenga su propio cache y elimina
  // desajustes de hashes entre HTML cacheado y chunks físicos.
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'dev-local'
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
        source: RUTA_DOCUMENTOS,
        headers: [...cabecerasComunes, { key: 'Permissions-Policy', value: CON_CAMARA }],
      },
      {
        // Todo menos la ruta de arriba. El lookahead es lo que impide que las dos
        // reglas coincidan a la vez y lleguen dos `Permissions-Policy`.
        source: '/((?!expediente/[^/]+/documentos$).*)',
        headers: [...cabecerasComunes, { key: 'Permissions-Policy', value: SIN_CAMARA }],
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
});
