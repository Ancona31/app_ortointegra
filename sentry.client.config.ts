/**
 * Sentry Client Config — con filtros de PII (LFPDPPP Art. 19)
 *
 * Los eventos de error pueden contener datos de pacientes en mensajes,
 * breadcrumbs, contexto o stack traces. Los filtros en beforeSend y
 * beforeBreadcrumb redactan toda PII antes de transmitirla a Sentry.
 */

import * as Sentry from '@sentry/nextjs'
import { beforeSend, beforeBreadcrumb, denyUrls } from '@/lib/sentryPiiFilter'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  // Redactar PII de todos los eventos antes de enviar a Sentry
  beforeSend: beforeSend as Parameters<typeof Sentry.init>[0]['beforeSend'],
  beforeBreadcrumb: beforeBreadcrumb as Parameters<typeof Sentry.init>[0]['beforeBreadcrumb'],

  // No capturar errores de extensiones de navegador
  denyUrls,
})
