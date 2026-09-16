import { createHash } from 'crypto'
import { logger } from '@/lib/logger'

/**
 * ¿Aparece esta contraseña en las filtraciones públicas que recopila
 * HaveIBeenPwned?
 *
 * SOLO INFORMA. Quien llama decide qué hacer, y en Spinus la decisión es del
 * médico: se le avisa y elige. No se bloquea ninguna contraseña, y el
 * interruptor «Prevent use of leaked passwords» del panel de Supabase está
 * APAGADO a propósito — ese rechaza, que no es lo que queremos.
 *
 * ═══ QUÉ SALE HACIA FUERA, Y QUÉ NO ═══════════════════════════════════════
 * El protocolo es k-anonimato. Viajan los CINCO primeros caracteres del SHA-1
 * de la contraseña, y nada más: ni la contraseña, ni el hash completo, ni el
 * correo, ni el token, ni identificador ninguno. HIBP devuelve TODOS los
 * sufijos de su corpus que empiezan por ese prefijo —del orden de 800, porque
 * hay 16^5 cubos— y la comparación ocurre aquí dentro. El tercero no sabe cuál
 * de las 800 se consultaba, ni si alguna, ni cuál fue la respuesta.
 *
 * ⚠️ Y SE LLAMA DESDE EL SERVIDOR, NUNCA DESDE EL NAVEGADOR DEL MÉDICO. Así
 * HIBP ve la IP de Vercel y no la de un consultorio: sin esa condición, un
 * tercero podría correlacionar «esta IP comprobó una contraseña» con «esta IP
 * acaba de recuperar su cuenta».
 *
 * ⚠️ EL SHA-1 ES DEL PROTOCOLO DE HIBP, NO UNA ELECCIÓN CRIPTOGRÁFICA NUESTRA.
 * No lo «mejores» a SHA-256: la API responde por prefijos de SHA-1 y cambiarlo
 * rompe la integración sin dar ningún error — devolvería siempre `false`.
 *
 * ⚠️ `Add-Padding: true` hace que la respuesta tenga tamaño uniforme, para que
 * un observador de red no deduzca el cubo por el tamaño del paquete. A cambio,
 * la lista trae entradas falsas con contador 0: por eso abajo no basta con que
 * el sufijo coincida, tiene que venir con contador mayor que cero.
 *
 * ⚠️ FALLA ABIERTO, A PROPÓSITO. Si HIBP tarda más de 2 s o responde mal, se
 * devuelve `false` y el médico sigue su camino sin aviso. Fallar cerrado
 * convertiría la caída de un tercero en una caída del alta y de la
 * recuperación de contraseña de un sistema clínico, sin salida para nadie. El
 * `logger.warn` existe para que un problema sistemático se vea en vez de ser
 * silencioso; si esa línea empieza a aparecer, la decisión se revisa con datos.
 *
 * ⚠️ NO REGISTRA NADA EN `audit_log` NI NOMBRA A NADIE EN EL LOG. «Este médico
 * eligió una contraseña conocida» en una tabla inmutable por trigger, sin
 * cancelación ARCO y legible por cualquier `super_admin`, sería un dato
 * personal guardado para siempre a cambio de nada.
 *
 * Vive en `src/lib/` y no dentro de una ruta porque tiene DOS consumidores
 * —el alta y la recuperación—, y duplicar una llamada de red con su timeout y
 * su política de fallo es cómo se desincronizan.
 */
export async function contrasenaConocida(password: string): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefijo = hash.slice(0, 5)
  const sufijo = hash.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2000),
    })

    if (!res.ok) {
      logger.warn('HIBP', `respuesta ${res.status} — aviso omitido`)
      return false
    }

    const cuerpo = await res.text()
    for (const linea of cuerpo.split('\n')) {
      const [suf, cuenta] = linea.trim().split(':')
      // Contador 0 = entrada de relleno de `Add-Padding`, no una filtración real
      if (suf === sufijo && Number(cuenta) > 0) return true
    }
    return false
  } catch {
    // Incluye el AbortError de los 2 s. Sin detalle: no hay nada que añadir.
    logger.warn('HIBP', 'sin respuesta útil en 2 s — aviso omitido')
    return false
  }
}
