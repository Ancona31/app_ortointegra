/**
 * formularioDatosAviso.test.tsx — privacidad 2026-12 (decisión de Angel): en
 * «Tus datos» el aviso simplificado NO va desplegado. Va la casilla, con su
 * texto exacto, y dentro de ella «aviso de privacidad» es el botón que abre
 * el aviso en una capa (<dialog>), cerrada de origen. El texto del aviso va
 * íntegro en la capa, con la dirección del integral como enlace.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FormularioDatos from '@/app/reservar/[codigo]/FormularioDatos'
import { AVISO_CASILLA } from '@/lib/reserva/avisoReserva'

const URL_AVISO = 'https://x.test/reservar/abc/privacidad'
const AVISO = `Aviso de prueba.\n\nAviso de privacidad integral. Consúltalo en ${URL_AVISO}`
const sinEtiquetas = (html: string) => html.replace(/<[^>]+>/g, '')

function pintar(avisoUrl: string, casilla: string = AVISO_CASILLA): string {
  return renderToStaticMarkup(
    <FormularioDatos aviso={AVISO} avisoUrl={avisoUrl} avisoRuta="/reservar/abc/privacidad" casilla={casilla}
      ocupado={false} textoBoton="Reservar cita" onEnviar={() => undefined} />,
  )
}
const etiqueta = (html: string) => /<label class="rp-acepto">[\s\S]*?<\/label>/.exec(html)?.[0] ?? ''
const capa = (html: string) => /<dialog[\s\S]*<\/dialog>/.exec(html)?.[0] ?? ''

describe('FormularioDatos: la casilla y la capa del aviso', () => {
  it('la casilla dice el texto aprobado, letra por letra, y «aviso de privacidad» es el botón que abre la capa', () => {
    const html = etiqueta(pintar(URL_AVISO))
    expect(sinEtiquetas(html)).toBe(AVISO_CASILLA)
    expect(html).toContain('<button type="button" class="rp-aviso-abrir" aria-haspopup="dialog">aviso de privacidad</button>')
  })
  it('el aviso no va desplegado: vive en un <dialog> cerrado, fuera de la casilla', () => {
    const html = pintar(URL_AVISO)
    expect(html).not.toMatch(/<details|<summary/)
    expect(html).toMatch(/<dialog class="rp-capa" aria-labelledby="[^"]+">/)
    expect(html).not.toMatch(/<dialog[^>]*\sopen/)
    expect(html.replace(capa(html), '')).not.toContain('Aviso de prueba.')
  })
  it('en la capa el aviso va íntegro y la dirección del integral es un enlace en otra pestaña', () => {
    const html = capa(pintar(URL_AVISO))
    expect(sinEtiquetas(/<div class="rp-aviso-legal"[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] ?? '')).toBe(AVISO)
    expect(html).toContain(`<a href="/reservar/abc/privacidad" target="_blank" rel="noopener noreferrer">${URL_AVISO}</a>`)
    expect(html).toContain('>Cerrar</button>')
    expect(html).toMatch(/<h2 id="[^"]+" tabindex="-1" class="rp-titulo">Aviso de privacidad<\/h2>/)
  })
  it('si el aviso no termina con esa dirección, sale entero y sin enlace', () => {
    const html = capa(pintar('https://otra.test/x'))
    expect(html).toContain(URL_AVISO)
    expect(html).not.toContain('<a ')
  })
  it('una casilla sin esas palabras no se toca y el aviso sigue alcanzable con un botón aparte', () => {
    const html = pintar(URL_AVISO, 'Acepto')
    expect(sinEtiquetas(etiqueta(html))).toBe('Acepto')
    expect(html).toContain('>Ver el aviso de privacidad</button>')
  })
  it('la casilla nace desmarcada y el botón de enviar apagado', () => {
    const html = pintar(URL_AVISO)
    expect(html).toMatch(/<input type="checkbox"(?![^>]*checked)/)
    expect(html).toMatch(/<button type="submit"[^>]*disabled/)
  })
})
