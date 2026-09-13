/**
 * Escapa un valor para interpolarlo en HTML sin que pueda cerrar el elemento o
 * el atributo que lo contiene. Para los correos de autenticación, donde el
 * nombre lo escribe quien se registra.
 *
 * ⚠️ NO SE HACE CON REEMPLAZOS ENCADENADOS. La trampa clásica es que `&` tiene
 * que ir primero: con `.replace('<','&lt;').replace('&','&amp;')` el segundo
 * pase reescribe los `&` que acaba de meter el primero y sale `&amp;lt;`, texto
 * roto. Un solo barrido con tabla de consulta hace ese orden IRRELEVANTE por
 * construcción: cada carácter se visita una vez y su reemplazo ya no se vuelve
 * a mirar. Es la diferencia entre depender de un comentario y no poder fallar.
 *
 * ⚠️ LO QUE ESTO NO HACE: no valida esquemas de URL. Escapado o no,
 * `javascript:...` en un href sigue siendo `javascript:...`. Esto protege
 * contra romper el atributo, no contra un destino hostil.
 */
const ESCAPES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => ESCAPES_HTML[c])
}
