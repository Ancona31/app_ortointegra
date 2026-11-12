/**
 * El enchufe de F3 que vive fuera de la capa principal (`HerramientasV2.tsx`)
 * y el hueco `miniMes` de `PanelDia`, pintados en el servidor
 * (`renderToStaticMarkup`), como `capasAgenda.test.tsx`: sin DOM, lo que se
 * comprueba es el MARCADO (roles, nombres, `aria-*`). El teclado y el foco de
 * punta a punta van en las e2e `agenda-f-*`.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/components/ui/Portal', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))

import HerramientasV2, { MiniMesPanelV2 } from '@/components/agenda/HerramientasV2'
import { PanelDia } from '@/components/agenda/PanelDia'

const nada = (): void => undefined
const RANGO = '2026-11-09/2026-11-16'

describe('HerramientasV2', () => {
  const html = renderToStaticMarkup(<HerramientasV2 apiRef={{ current: null }} rango={RANGO} alIrAFecha={nada} />)
  it('el botón «Ir a una fecha» anuncia su diálogo y empieza cerrado', () => {
    expect(html).toContain('aria-label="Ir a una fecha"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
  })
  it('F3.6: la lupa anuncia su atajo `/` y su diálogo', () => {
    expect(html).toContain('aria-label="Buscar citas de un paciente"')
    expect(html).toContain('aria-keyshortcuts="/"')
    expect(html).toContain('data-buscar-citas=""')
  })
  it('cerrado no pinta ningún diálogo', () => {
    expect(html).not.toContain('role="dialog"')
  })
})

describe('MiniMesPanelV2', () => {
  const html = renderToStaticMarkup(<MiniMesPanelV2 rango={RANGO} alIrAFecha={nada} />)
  it('es la rejilla del mes del rango, con los días visibles marcados', () => {
    expect(html).toContain('role="grid"')
    expect(html).toContain('noviembre de 2026')
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(7)
  })
})

describe('PanelDia: el hueco `miniMes`', () => {
  const base = { titulo: 'Resumen del día', citas: 0, eventos: 0, resumen: null, unMedico: true, onHueco: nada, incompleto: false }
  it('MUTACIÓN `agendaV2 &&`: sin hueco (interruptor apagado) el panel es el de siempre', () => {
    expect(renderToStaticMarkup(<PanelDia {...base} />)).not.toContain('Calendario del mes')
  })
  it('con hueco, una tarjeta más del panel, nombrada', () => {
    const html = renderToStaticMarkup(<PanelDia {...base} miniMes={<span data-minimes="" />} />)
    expect(html).toContain('aria-label="Calendario del mes"')
    expect(html).toContain('data-minimes=""')
  })
})
