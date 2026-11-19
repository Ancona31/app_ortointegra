/**
 * Tanda L (punto 1 de Angel, AG-DT-175): «Confirmo mi asistencia» del correo
 * confirma sólo tras un GESTO de la persona (`esGestoParaConfirmar`, en
 * `ConfirmarAlCargar.tsx`). Lo que se prueba sin navegador: qué cuenta como
 * gesto. La espera en sí (que no sale ningún POST sin gesto) la prueba la e2e
 * `confirmacion-k2-al-cargar`.
 *
 * MUTACIONES (comprobadas en rojo): `esControl` siempre false → «sobre un
 * control no cuenta»; sin mirar `isTrusted` → «un evento sintético no
 * cuenta»; `esTeclaDeGesto` que acepte cualquier tecla → «Tab y las de desplazar no cuentan».
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { esGestoParaConfirmar } from '@/app/confirmar/[codigo]/ConfirmarAlCargar'

/** Un elemento de mentira: `closest` responde si está DENTRO de un control (el selector no se interpreta aquí). */
class Elemento extends EventTarget {
  constructor(private readonly dentroDeControl: boolean) { super() }
  closest(): Elemento | null { return this.dentroDeControl ? this : null }
}

beforeAll(() => { vi.stubGlobal('Element', Elemento) })
afterAll(() => { vi.unstubAllGlobals() })

const texto = new Elemento(false)
const enlaceNoPodre = new Elemento(true)

describe('qué gesto confirma', () => {
  it('un clic de la persona en el texto de la página, sí', () => {
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto })).toBe(true)
  })
  it('sobre un control no cuenta: «No podré asistir» (o el propio botón) hacen lo suyo', () => {
    expect(esGestoParaConfirmar({ isTrusted: true, target: enlaceNoPodre })).toBe(false)
    expect(esGestoParaConfirmar({ isTrusted: true, target: enlaceNoPodre, key: 'Enter' })).toBe(false)
  })
  it('un evento sintético (dispatchEvent) no cuenta', () => {
    expect(esGestoParaConfirmar({ isTrusted: false, target: texto })).toBe(false)
    expect(esGestoParaConfirmar({ isTrusted: false, target: texto, key: 'Enter' })).toBe(false)
  })
  it('Tab, las de desplazar y las que no escriben (F6, Supr…) no cuentan: quien va con el teclado a «No podré asistir» no confirma por el camino', () => {
    for (const key of ['Tab', 'Shift', 'ArrowDown', ' ', 'PageDown', 'End', 'Escape', 'Meta', 'F6', 'F11', 'Backspace', 'Delete', 'ContextMenu', 'Dead', 'Unidentified']) {
      expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key }), key).toBe(false)
    }
  })
  it('Enter o una letra fuera de un control, sí; con modificador, repetida o componiendo, no', () => {
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key: 'Enter' })).toBe(true)
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key: 'a' })).toBe(true)
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key: 'a', ctrlKey: true })).toBe(false)
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key: 'a', repeat: true })).toBe(false)
    expect(esGestoParaConfirmar({ isTrusted: true, target: texto, key: 'a', isComposing: true })).toBe(false)
  })
  it('sin destino (o sin DOM) no es un control: cuenta si es de confianza', () => {
    expect(esGestoParaConfirmar({ isTrusted: true, target: null })).toBe(true)
  })
})
