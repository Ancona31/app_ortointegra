/* ⚠ ESTE ARCHIVO NO SE EJECUTA. NO HAY TELEMETRÍA DE SERVIDOR EN SPINUS.
 *
 * Nada lo importa: los `sentry.server.config.ts` solo se cargan desde el
 * `register()` de un `instrumentation.ts` en la raíz, y ese archivo NO EXISTE
 * en el repo. El `Sentry.init()` de abajo es, hoy, código muerto.
 *
 * Es DELIBERADO, no un olvido. Encender Sentry en servidor implica cargar
 * `@sentry/node` con OpenTelemetry detrás en el arranque en frío de cada
 * función, y esa factura se paga por invocación. La decisión de asumirla o no
 * se toma DESPUÉS de medir el costo real, no antes.
 *
 * El archivo se conserva porque es la configuración lista —con sus filtros de
 * PII ya escritos— para el día que se decida encenderla. Si vas a crear
 * `instrumentation.ts`, mide primero y borra este bloque.
 *
 * El de navegador SÍ corre, desde `instrumentation-client.ts` en la raíz.
 */

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
