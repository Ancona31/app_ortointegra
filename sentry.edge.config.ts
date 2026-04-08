/**
 * Sentry Edge Config — con filtros de PII (LFPDPPP Art. 19)
 *
 * El middleware (proxy.ts) corre en edge runtime y puede generar errores
 * que contengan URLs con IDs de pacientes o datos de sesión.
 * beforeSend redacta toda PII antes de transmitir a Sentry.
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
