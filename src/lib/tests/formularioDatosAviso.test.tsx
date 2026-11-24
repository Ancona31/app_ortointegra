/**
 * formularioDatosAviso.test.tsx — privacidad 2026-12: en la reserva el aviso
 * simplificado se ve ABIERTO (nunca dentro de un <details>), con su texto
 * íntegro, y la dirección del aviso integral es un enlace a su página.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FormularioDatos from '@/app/reservar/[codigo]/FormularioDatos'

const URL_AVISO = 'https://x.test/reservar/abc/privacidad'
const AVISO = `Aviso de prueba.\n\nAviso de privacidad integral. Consúltalo en ${URL_AVISO}`

function pintar(avisoUrl: string): string {
  return renderToStaticMarkup(
    <FormularioDatos aviso={AVISO} avisoUrl={avisoUrl} avisoRuta="/reservar/abc/privacidad" casilla="Leí el aviso"
      ocupado={false} textoBoton="Reservar cita" onEnviar={() => undefined} />,
  )
}

describe('FormularioDatos: el aviso', () => {
  it('va abierto: sin <details> ni <summary>, y antes de la casilla', () => {
    const html = pintar(URL_AVISO)
    expect(html).not.toMatch(/<details|<summary/)
    expect(html.indexOf('Aviso de prueba.')).toBeGreaterThan(-1)
    expect(html.indexOf('Aviso de prueba.')).toBeLessThan(html.indexOf('Leí el aviso'))
  })
  it('la dirección del aviso integral es un enlace a su página, en otra pestaña', () => {
    const html = pintar(URL_AVISO)
    expect(html).toContain(`<a href="/reservar/abc/privacidad" target="_blank" rel="noopener noreferrer">${URL_AVISO}</a>`)
    expect(html.split(URL_AVISO).length - 1).toBe(1)
  })
  it('si el aviso no termina con esa dirección, el texto sale entero y sin enlace', () => {
    const html = pintar('https://otra.test/x')
    expect(html).toContain(URL_AVISO)
    expect(html).not.toContain('<a ')
  })
  it('la casilla nace desmarcada y el botón apagado', () => {
    const html = pintar(URL_AVISO)
    expect(html).toMatch(/<input type="checkbox"(?![^>]*checked)/)
    expect(html).toMatch(/<button type="submit"[^>]*disabled/)
  })
})
