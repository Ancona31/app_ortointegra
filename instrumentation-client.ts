/**
 * Sentry de navegador — con filtros de PII (LFPDPPP vigente, DOF 20/03/2025)
 *
 * Sustituye a `sentry.client.config.ts`, que se eliminó. Next.js ejecuta este
 * archivo después de cargar el HTML y ANTES de la hidratación de React, que es
 * la vía soportada desde Next 15.3. El archivo viejo solo seguía funcionando
 * porque el plugin webpack de `@sentry/nextjs` aún lo inyectaba a mano, con un
 * aviso de deprecación; con Turbopack habría dejado de cargarse en silencio.
 *
 * Los eventos de error pueden contener datos de pacientes en mensajes,
 * breadcrumbs, contexto o stack traces. Los filtros en beforeSend y
 * beforeBreadcrumb redactan toda PII antes de transmitirla a Sentry.
 *
 * Offline-first: si el navegador está offline al iniciar Sentry, la init
 * queda envuelta en try/catch para que no rompa el bootstrap de la app.
 * Si el usuario pierde conexión, Sentry dropea silenciosamente los eventos.
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
  console.warn('[Sentry] init falló — continuando sin telemetría:', err)
}

/**
 * Hook `onRouterTransitionStart` de Next.js (App Router). Sin este export,
 * las navegaciones cliente no generan spans de navegación en Sentry: solo se
 * instrumentaría la carga inicial. Era lo único que faltaba de verdad, porque
 * `sentry.client.config.ts` no admitía exports.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
