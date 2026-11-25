/**
 * mailpitOrden.test.ts — integración G1–G4 (2026-11-14): el ayudante de las e2e
 * que lee Mailpit tiene que devolver el correo MÁS RECIENTE. Mailpit recorta
 * los ceros de los milisegundos de `Created`, así que ordenar por texto ponía
 * «…26.5Z» delante de «…26.53Z» y `esperarCorreo` devolvía el código viejo
 * (`reserva-candado` «ya_tiene_cita», `verificar 400` de vez en cuando).
 */
import { describe, it, expect } from 'vitest'
import { masRecientesPrimero } from '../../../e2e/mailpit'

describe('masRecientesPrimero', () => {
  it('ordena por instante aunque Mailpit recorte los milisegundos', () => {
    const lista = [
      { ID: 'viejo', Created: '2026-11-15T03:36:26.5Z' },
      { ID: 'nuevo', Created: '2026-11-15T03:36:26.53Z' },
      { ID: 'antes', Created: '2026-11-15T03:36:25.999Z' },
    ]
    expect(masRecientesPrimero(lista).map(c => c.ID)).toEqual(['nuevo', 'viejo', 'antes'])
  })

  it('no cambia la lista de entrada', () => {
    const lista = [{ Created: '2026-11-15T03:36:26.1Z' }, { Created: '2026-11-15T03:36:26.12Z' }]
    masRecientesPrimero(lista)
    expect(lista[0]?.Created).toBe('2026-11-15T03:36:26.1Z')
  })
})
