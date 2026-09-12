/* ⚠ ESTE ARCHIVO NO SE EJECUTA. EL MIDDLEWARE NO REPORTA A SENTRY.
 *
 * Nada lo importa: los `sentry.edge.config.ts` solo se cargan desde el
 * `register()` de un `instrumentation.ts` en la raíz, y ese archivo NO EXISTE
 * en el repo. El `Sentry.init()` de abajo es, hoy, código muerto.
 *
 * Es DELIBERADO, no un olvido. Encender Sentry en servidor/edge implica cargar
 * el SDK en el arranque en frío de cada invocación, y esa factura se paga por
 * request. La decisión de asumirla o no se toma DESPUÉS de medir el costo
 * real, no antes.
 *
 * El archivo se conserva porque es la configuración lista —con sus filtros de
 * PII ya escritos— para el día que se decida encenderla. Si vas a crear
 * `instrumentation.ts`, mide primero y borra este bloque.
 *
 * El de navegador SÍ corre, desde `instrumentation-client.ts` en la raíz.
 */

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
