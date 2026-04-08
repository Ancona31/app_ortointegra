/**
 * Sentry Server Config — con filtros de PII (LFPDPPP Art. 19)
 *
 * Las API routes procesan datos clínicos que podrían filtrarse en
 * mensajes de error. beforeSend redacta nombres, emails, CURP, RFC,
 * teléfonos y cualquier campo sensible antes de enviar a Sentry.
 */

import * as Sentry from '@sentry/nextjs'
import { beforeSend, beforeBreadcrumb } from '@/lib/sentryPiiFilter'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  beforeSend: beforeSend as Parameters<typeof Sentry.init>[0]['beforeSend'],
  beforeBreadcrumb: beforeBreadcrumb as Parameters<typeof Sentry.init>[0]['beforeBreadcrumb'],
})
