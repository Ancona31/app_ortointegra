/**
 * Tanda L (punto 4 de Angel, AG-DT-176): el código de 6 dígitos que «Continuar
 * mi reserva» lleva en el fragmento (`/reservar/<enlace>#codigo=123456`) no
 * llega a Sentry: ni en la URL del evento, ni en las migas de navegación o de
 * `fetch`, ni en el mensaje. Ningún filtro anterior lo tocaba (6 dígitos son
 * menos que `PHONE_RE`).
 *
 * MUTACIÓN (comprobada en rojo): sin la línea `#codigo=` de `redactString`.
 */
import { describe, it, expect } from 'vitest'
import { beforeBreadcrumb, beforeSend } from '@/lib/sentryPiiFilter'

const URL_CODIGO = 'https://spinus.prueba/reservar/AbCdEfGhIjKlMnOpQrStUv#codigo=012345'

describe('Sentry: el código del correo de la reserva', () => {
  it('se redacta en la URL, en las migas y en el mensaje del evento', () => {
    const e = beforeSend({
      message: `fallo en ${URL_CODIGO}`,
      request: { url: URL_CODIGO },
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/reservar/AbCdEfGhIjKlMnOpQrStUv#codigo=987654' } }],
      exception: { values: [{ value: `TypeError en ${URL_CODIGO}` }] },
    })
    const todo = JSON.stringify(e)
    expect(todo).not.toMatch(/012345|987654/)
    expect(e?.request?.url).toBe('https://spinus.prueba/reservar/AbCdEfGhIjKlMnOpQrStUv#codigo=[REDACTADO]')
    expect(e?.breadcrumbs?.[0]?.data?.to).toBe('/reservar/AbCdEfGhIjKlMnOpQrStUv#codigo=[REDACTADO]')
  })
  it('también en la miga de un fetch, antes de guardarla', () => {
    const b = beforeBreadcrumb({ category: 'fetch', data: { url: URL_CODIGO, method: 'GET' } })
    expect(b?.data?.url).toBe('https://spinus.prueba/reservar/AbCdEfGhIjKlMnOpQrStUv#codigo=[REDACTADO]')
  })
  it('lo demás sigue igual: un número suelto de 6 dígitos no se toca', () => {
    expect(beforeSend({ message: 'cita 123456 sin código' })?.message).toBe('cita 123456 sin código')
  })
})
