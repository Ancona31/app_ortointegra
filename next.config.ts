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
 * cubrieran una ruta de firmado el navegador recibiría dos `Permissions-Policy`
 * y mandaría la primera aparición de `camera` —el orden decidiría el permiso, en
 * silencio y sin error—. Por eso la regla general las excluye con un lookahead
 * en vez de confiar en el orden.
 *
 * ── ⚠ LAS RUTAS SE ESCRIBEN UNA SOLA VEZ. NO LAS DUPLIQUES A MANO ───────────
 * La exclusión necesita la misma lista en OTRA sintaxis —`[^/]+` en vez del
 * `:id` de path-to-regexp, porque dentro de un grupo de exclusión el parámetro
 * con nombre no vale—, así que la tentación es escribirlas dos veces. Con tres
 * rutas eso son seis sitios que tienen que coincidir, y la primera vez que
 * alguien añada una cuarta y actualice solo una mitad, las dos reglas volverán a
 * solaparse y el permiso lo volverá a decidir el orden, sin error y sin aviso.
 *
 * Por eso `EXCLUSION` se DERIVA de `RUTAS_CON_CAMARA` con una traducción de una
 * línea. **Para añadir o quitar una ruta se toca la lista y nada más.**
 *
 * Comprobación, con el servidor levantado —una cabecera por ruta, y la correcta—:
 *
 *   for r in /expediente/abc/documentos /expediente/abc/nueva-nota /documentos \
 *            /inicio /offline-mode; do
 *     printf '%-32s ' "$r"; curl -sI "http://localhost:3000$r" | grep -i permissions-policy
 *   done
 * ========================================================================== */

const cabecerasComunes = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
]

/** Ni el propio origen. Es el valor de todo el sitio menos las rutas de abajo. */
const SIN_CAMARA = 'camera=(), microphone=(), geolocation=()'
/** Solo el propio origen, y solo donde se firma el consentimiento. */
const CON_CAMARA = 'camera=(self), microphone=(), geolocation=()'

/**
 * LAS TRES RUTAS QUE MONTAN EL FORMULARIO DE CONSENTIMIENTO, que son las tres
 * desde las que se puede abrir el firmado y, por tanto, pedir la cámara.
 *
 * No es una lista de pantallas parecidas: es la lista de sitios donde
 * `ConsentimientoInformadoForm` se renderiza. Si mañana se monta desde una
 * cuarta, va aquí, o la cámara volverá a quedarse bloqueada solo en esa.
 *
 * ⚠ HAY UNA CUARTA QUE NO ESTÁ, Y ES DELIBERADO: `/offline-mode` también monta
 * el formulario, pero su firmado es inalcanzable —`iniciarFirmado` guarda el
 * borrador contra Supabase antes de abrir el modo, y sin red eso falla y el modo
 * no llega a montarse—. Abrirle la cámara sería abrirla en una pantalla que no
 * puede usarla. Si el búnker gana firmado algún día, entonces sí entra aquí.
 */
const RUTAS_CON_CAMARA = [
  '/expediente/:id/documentos',
  '/expediente/:id/nueva-nota',
  '/documentos',
] as const

/**
 * La misma lista, en la sintaxis que el lookahead entiende: sin la barra inicial
 * —que ya la pone el `source`— y con los parámetros con nombre convertidos en
 * `[^/]+`. Derivada, nunca escrita a mano: ver la advertencia de arriba.
 */
const EXCLUSION = RUTAS_CON_CAMARA
  .map(ruta => ruta.slice(1).replace(/:[^/]+/g, '[^/]+'))
  .join('|')

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
      // Una regla por ruta de firmado, todas con el mismo valor.
      ...RUTAS_CON_CAMARA.map(source => ({
        source,
        headers: [...cabecerasComunes, { key: 'Permissions-Policy', value: CON_CAMARA }],
      })),
      {
        // Todo lo demás. El lookahead es lo que impide que esta regla coincida a
        // la vez que una de arriba y lleguen dos `Permissions-Policy`.
        source: `/((?!(?:${EXCLUSION})$).*)`,
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
