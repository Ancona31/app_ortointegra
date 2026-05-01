import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
]

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
        source: '/(.*)',
        headers: securityHeaders,
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
