/**
 * Filtro de PII para Sentry — LFPDPPP Art. 19
 *
 * La Ley Federal de Protección de Datos Personales en Posesión de los
 * Particulares exige que los responsables implementen medidas de seguridad
 * técnicas para proteger datos personales contra acceso no autorizado.
 *
 * Sentry captura errores y breadcrumbs que podrían contener datos de
 * pacientes (nombres, emails, CURP, teléfonos, diagnósticos). Este filtro
 * redacta toda PII antes de que se transmita a los servidores de Sentry.
 */

// ── Patrones de PII ──────────────────────────────────────────────────

const CURP_RE = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi
const RFC_RE = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}\b/gi
const PHONE_RE = /(?:\+?52\s?)?(?:\(?\d{2,3}\)?\s?)?[\d\s\-]{7,10}\d/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

// Keys sensibles — si el nombre del campo contiene estas palabras, redactar el valor
const SENSITIVE_KEYS = [
  'paciente', 'nombre', 'apellido', 'email', 'correo', 'telefono',
  'celular', 'curp', 'rfc', 'direccion', 'domicilio', 'diagnostico',
  'motivo_consulta', 'exploracion', 'antecedentes', 'medicamentos',
  'recomendaciones', 'contenido', 'notas_evolucion',
]

// Rutas API con datos clínicos sensibles
const SENSITIVE_API_PATHS = [
  '/api/pacientes', '/api/consultas', '/api/laboratorios',
  '/api/documentos', '/api/nota-medica', '/api/consulta-rapida',
  '/api/email/enviar-documento',
]

// ── Funciones de redacción ───────────────────────────────────────────

function redactString(text: string): string {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(CURP_RE, '[CURP-REDACTADO]')
    .replace(RFC_RE, '[RFC-REDACTADO]')
    .replace(EMAIL_RE, '[EMAIL-REDACTADO]')
    .replace(UUID_RE, '[ID-REDACTADO]')
    .replace(PHONE_RE, '[TEL-REDACTADO]')
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEYS.some(s => lower.includes(s))
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = '[PII-REDACTADO]'
    } else if (typeof value === 'string') {
      result[key] = redactString(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? redactString(item)
        : item && typeof item === 'object' ? redactObject(item as Record<string, unknown>)
        : item
      )
    } else {
      result[key] = value
    }
  }
  return result
}

// ── Exports para Sentry config ───────────────────────────────────────

type SentryEvent = {
  message?: string
  breadcrumbs?: { category?: string; message?: string; data?: Record<string, unknown> }[]
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  tags?: Record<string, string>
  exception?: { values?: { value?: string; stacktrace?: { frames?: { filename?: string }[] } }[] }
  request?: { url?: string; data?: unknown; headers?: Record<string, string> }
}

type SentryBreadcrumb = {
  category?: string
  message?: string
  data?: Record<string, unknown>
}

export function beforeSend(event: SentryEvent): SentryEvent | null {
  // Redactar message
  if (event.message) {
    event.message = redactString(event.message)
  }

  // Redactar breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(bc => ({
      ...bc,
      message: bc.message ? redactString(bc.message) : bc.message,
      data: bc.data ? redactObject(bc.data) as Record<string, unknown> : bc.data,
    }))
  }

  // Redactar extra
  if (event.extra) {
    event.extra = redactObject(event.extra)
  }

  // Redactar contexts
  if (event.contexts) {
    event.contexts = redactObject(event.contexts)
  }

  // Redactar tags
  if (event.tags) {
    const redactedTags: Record<string, string> = {}
    for (const [key, value] of Object.entries(event.tags)) {
      redactedTags[key] = isSensitiveKey(key) ? '[PII-REDACTADO]' : redactString(value)
    }
    event.tags = redactedTags
  }

  // Redactar exception values
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(ex => ({
      ...ex,
      value: ex.value ? redactString(ex.value) : ex.value,
    }))
  }

  // Redactar request data
  if (event.request) {
    if (event.request.url) {
      event.request.url = redactString(event.request.url)
    }
    if (event.request.data && typeof event.request.data === 'object') {
      event.request.data = redactObject(event.request.data as Record<string, unknown>)
    }
    if (event.request.headers) {
      const headers: Record<string, string> = {}
      for (const [key, value] of Object.entries(event.request.headers)) {
        headers[key] = key.toLowerCase() === 'cookie' ? '[REDACTADO]' : redactString(value)
      }
      event.request.headers = headers
    }
  }

  return event
}

export function beforeBreadcrumb(breadcrumb: SentryBreadcrumb): SentryBreadcrumb | null {
  // Filtrar breadcrumbs de console que contengan datos sensibles
  if (breadcrumb.category === 'console') {
    if (breadcrumb.message) {
      const lower = breadcrumb.message.toLowerCase()
      // Si el console.log contiene datos sensibles, redactar completamente
      if (SENSITIVE_KEYS.some(k => lower.includes(k))) {
        breadcrumb.message = '[LOG-CON-PII-REDACTADO]'
      } else {
        breadcrumb.message = redactString(breadcrumb.message)
      }
    }
  }

  // Redactar body de fetch/XHR a rutas sensibles
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    const url = breadcrumb.data?.url as string | undefined
    if (url && SENSITIVE_API_PATHS.some(p => url.includes(p))) {
      if (breadcrumb.data) {
        breadcrumb.data = { ...breadcrumb.data, body: '[BODY-REDACTADO]' }
      }
    }
    // Redactar UUIDs en URLs
    if (url) {
      breadcrumb.data = { ...breadcrumb.data, url: redactString(url) }
    }
  }

  return breadcrumb
}

// URLs de extensiones de navegador que no queremos capturar
export const denyUrls = [
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-extension:\/\//i,
  /^safari-web-extension:\/\//i,
]
