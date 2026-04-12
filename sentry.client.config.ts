/**
 * Sentry Client Config — con filtros de PII (LFPDPPP Art. 19)
 *
 * Los eventos de error pueden contener datos de pacientes en mensajes,
 * breadcrumbs, contexto o stack traces. Los filtros en beforeSend y
 * beforeBreadcrumb redactan toda PII antes de transmitirla a Sentry.
 *
 * Offline-first: si el navegador está offline al iniciar Sentry, la init
 * queda envuelta en try/catch para que no rompa el bootstrap de la app.
 * Si el usuario pierde conexión, Sentry drop silenciosamente los eventos.
 */

import * as Sentry from '@sentry/nextjs'
import { beforeSend, beforeBreadcrumb, denyUrls } from '@/lib/sentryPiiFilter'

try {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    // Solo activo en producción; si el browser está offline al cargar, Sentry
    // queda deshabilitado hasta el próximo refresh (evita reintentos ruidosos)
    enabled:
      process.env.NODE_ENV === 'production' &&
      (typeof navigator === 'undefined' || navigator.onLine !== false),

    beforeSend: ((event, hint) => {
      // Si el usuario está offline cuando se dispara el evento, no enviar
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return null
      }
      const fn = beforeSend as (
        e: Parameters<NonNullable<Parameters<typeof Sentry.init>[0]['beforeSend']>>[0],
        h: Parameters<NonNullable<Parameters<typeof Sentry.init>[0]['beforeSend']>>[1]
      ) => ReturnType<NonNullable<Parameters<typeof Sentry.init>[0]['beforeSend']>>
      return fn(event, hint)
    }) as Parameters<typeof Sentry.init>[0]['beforeSend'],

    beforeBreadcrumb: beforeBreadcrumb as Parameters<typeof Sentry.init>[0]['beforeBreadcrumb'],

    denyUrls,
  })
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[Sentry] init falló — continuando sin telemetría:', err)
}
