/**
 * textosLegales.test.ts — privacidad 2026-12: los textos legales de la app son
 * los documentos aprobados, byte a byte, y lo que los rodea no los contradice.
 *
 *   · documento 1 → `textoAvisoSpinus.ts` (aviso de Spinus para sus usuarios);
 *   · documento 4 → `textoEncargo.ts` (sección de encargo de los Términos);
 *   · las cuatro casillas del alta de paciente dicen lo mismo, sin artículo de
 *     la ley abrogada y sin enlazar al aviso de Spinus (que no es el del
 *     consultorio);
 *   · el registro pide aceptar el aviso y los términos, con sus enlaces.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TerminosContent from '@/components/legal/TerminosContent'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AVISO_SPINUS_FECHA, AVISO_SPINUS_PLANTILLA, AVISO_SPINUS_VERSION } from '@/components/legal/textoAvisoSpinus'
import { ENCARGO_PLANTILLA } from '@/components/legal/textoEncargo'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const aprobado = (archivo: string) => leer(`docs/spec/privacidad-2026-12/${archivo}`).replace(/\n+$/, '')

describe('documento 1 · aviso de Spinus para sus usuarios', () => {
  it('es el documento aprobado; sólo la fecha es un marcador', () => {
    expect(AVISO_SPINUS_PLANTILLA).toBe(aprobado('1-aviso-spinus-usuarios.md').replace('[FECHA DE PUBLICACIÓN]', '{FECHA}'))
    expect(AVISO_SPINUS_PLANTILLA).toContain(`Versión ${AVISO_SPINUS_VERSION} · Última actualización: {FECHA}`)
    expect(AVISO_SPINUS_VERSION).toBe('3.0')
    expect(AVISO_SPINUS_FECHA).toMatch(/^\d{1,2} de [a-z]+ de 20\d\d$/)
  })
  it('nombra a la SABG con su dirección, y no al INAI, ni artículos, ni la marca registrada', () => {
    expect(AVISO_SPINUS_PLANTILLA).toContain('Secretaría Anticorrupción y Buen Gobierno (www.gob.mx/buengobierno)')
    expect(AVISO_SPINUS_PLANTILLA).not.toMatch(/INAI|®|Anthropic|Claude/)
    expect(AVISO_SPINUS_PLANTILLA).not.toMatch(/art[íi]culo\s+\d|art\.\s*\d/i)
  })
  it('el componente pinta la plantilla y no lleva texto legal propio', () => {
    const fuente = leer('src/components/legal/AvisoPrivacidadContent.tsx')
    expect(fuente).toContain('AVISO_SPINUS_PLANTILLA')
    expect(fuente).not.toMatch(/LFPDPPP|INAI|ARCO/)
  })
  it('/privacy sólo redirige a /privacidad', () => {
    const fuente = leer('src/app/privacy/page.tsx')
    expect(fuente).toContain("redirect('/privacidad')")
    expect(fuente).not.toContain('AvisoPrivacidadContent')
  })
})

describe('documento 4 · sección de encargo de los Términos', () => {
  it('es el documento aprobado, con su marcador [N]', () => {
    expect(ENCARGO_PLANTILLA).toBe(aprobado('4-acuerdo-encargo-seccion-terminos.md'))
    expect(ENCARGO_PLANTILLA.match(/^## \[N\]\.\d+ /gm)).toHaveLength(14)
  })
})

describe('los Términos montan la sección 23 y no la contradicen en los hechos', () => {
  const html = renderToStaticMarkup(createElement(TerminosContent))
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
  it('la sección va numerada 23, en el índice y con sus catorce apartados', () => {
    expect(html).toContain('href="#encargo"')
    expect(texto).toContain('23. Tratamiento de datos personales por cuenta del Usuario')
    for (let i = 1; i <= 14; i++) expect(texto).toContain(`23.${i} `)
    expect(texto).not.toContain('[N]')
    expect(texto).toContain('periodo posterior previsto en el apartado 23.12')
  })
  it('la tabla de subencargados sale como tabla y la lista sigue en el 2', () => {
    expect(html).toMatch(/<th[^>]*>Proveedor<\/th>/)
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(5)
    expect(html).toContain('<ol start="2"')
    expect(html).not.toContain('|---|')
  })
  it('sin Anthropic, Claude ni Meta, y sin remitir a una sección del aviso que ya no existe', () => {
    expect(texto).not.toMatch(/Anthropic|Claude|Meta Platforms|sección VI del Aviso/)
    expect(texto).toContain('conforme se describe en la sección 23 de estos Términos')
    expect(texto).toContain('descrito en el aviso de privacidad de su consultorio')
    expect(texto).toMatch(/Versión v3\.0 · \d{1,2} de [a-z]+ de 20\d\d/)
  })
})

describe('alta de paciente · las cuatro casillas', () => {
  const TEXTO = 'Informé al paciente del aviso de privacidad del consultorio'
  const ARCHIVOS = [
    'src/app/(app)/pacientes/nuevo/page.tsx', 'src/components/ui/QuickPatientModal.tsx',
    'src/components/launcher/ConsultaRapidaModal.tsx', 'src/components/CommandPalette.tsx',
  ]
  for (const archivo of ARCHIVOS) {
    it(`${archivo}: el texto único, sin artículo y sin enlazar al aviso de Spinus`, () => {
      const fuente = leer(archivo)
      expect(fuente.split(TEXTO).length - 1).toBe(1)
      expect(fuente).not.toMatch(/LFPDPPP Art|Paciente informado del|ha leído y acepta/)
      expect(fuente).not.toContain('href="/privacidad"')
    })
  }
})

describe('registro · aceptación del aviso y de los términos', () => {
  it('la casilla es obligatoria, nace desmarcada, enlaza a los dos documentos y viaja al servidor', () => {
    const fuente = leer('src/app/register/page.tsx')
    expect(fuente).toContain('useState(false)')
    expect(fuente).toMatch(/<input type="checkbox" name="acepta_legal" required checked=\{aceptaLegal\}/)
    expect(fuente).toContain('href="/privacidad"')
    expect(fuente).toContain('href="/terms"')
    expect(fuente).toContain('acepta_legal: aceptaLegal')
  })
})
