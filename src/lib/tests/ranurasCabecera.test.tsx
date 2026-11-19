/**
 * Contrato de F3 en la superficie: las ranuras `selectorFecha`/`buscar` y
 * `aria-keyshortcuts` en la barra de escritorio y en la banda del teléfono.
 * Sin DOM en Vitest: se comprueba el marcado (`renderToStaticMarkup`). Los tres
 * botones nativos de FullCalendar reciben el atributo por un efecto sobre el
 * DOM y eso queda para la e2e del enchufe.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CabeceraEscritorio } from '@/components/agenda/CabeceraEscritorio'
import { BandaMovil } from '@/components/agenda/BandaMovil'
import { BotonLeyendaAgenda } from '@/components/agenda/MenuEngraneAgenda'

const nada = (): void => undefined

function cabecera(extra: { atajos?: boolean; selectorFecha?: string; buscar?: string; leyenda?: boolean }): string {
  return renderToStaticMarkup(
    <CabeceraEscritorio
      resumenConteo="3 citas" currentView="timeGridWeek" isMobile={false} onVista={nada}
      compactar={false} onCompactar={nada} densidadCompacta={false} onDensidad={nada}
      isSingleDoctor filtroEfectivo={null} mesSinTodos={false} medicos={[]} onFiltroMedico={nada}
      canEditHorario={false} onHorario={nada} onAgendar={nada} onIntencionAgendar={nada}
      atajos={extra.atajos}
      selectorFecha={extra.selectorFecha ? <span data-ranura="fecha">{extra.selectorFecha}</span> : undefined}
      buscar={extra.buscar ? <span data-ranura="buscar">{extra.buscar}</span> : undefined}
      leyenda={extra.leyenda ? <BotonLeyendaAgenda /> : undefined}
    />,
  )
}

function banda(atajos: boolean): string {
  return renderToStaticMarkup(
    <BandaMovil
      conteo="3 citas" vistaActual="listWeek" onVista={nada} titulo="9 – 15 de noviembre"
      onPrev={nada} onNext={nada} onHoy={nada} hoyDeshabilitado={false} onMenu={nada}
      medicos={[]} filtroMedico="" onFiltroMedico={nada} onHorario={null} onCompactar={null}
      compactado={false} mesSinTodos={false} atajos={atajos}
      buscar={<span data-ranura="buscar">lupa</span>}
    />,
  )
}

describe('CabeceraEscritorio · contrato de F3', () => {
  it('pinta las dos ranuras, el selector de fecha el primero de la fila', () => {
    const html = cabecera({ selectorFecha: 'minimes', buscar: 'lupa' })
    expect(html).toContain('data-ranura="fecha"')
    expect(html).toContain('data-ranura="buscar"')
    expect(html.indexOf('data-ranura="fecha"')).toBeLessThan(html.indexOf('ag-controles-conteo'))
  })
  it('aria-keyshortcuts en las vistas sólo con los atajos activos', () => {
    expect(cabecera({ atajos: true })).toMatch(/aria-keyshortcuts="S"[^>]*>Semana/)
    expect(cabecera({ atajos: true })).toMatch(/aria-keyshortcuts="M"[^>]*>Mes/)
    expect(cabecera({})).not.toContain('aria-keyshortcuts')
  })
})

/* Tanda L, punto 11: el botón de la leyenda, a la IZQUIERDA de Mes/Semana/Día, cerrado al pintarse;
   sin la ranura (v2 apagada o teléfono), la barra de siempre. MUTACIÓN: `{leyenda}` después del
   tablist en `CabeceraEscritorio` → rojo. */
describe('CabeceraEscritorio · el botón de la leyenda (tanda L, punto 11)', () => {
  it('va justo antes de las vistas, con su nombre y cerrado', () => {
    const html = cabecera({ leyenda: true })
    const boton = html.indexOf('data-boton-leyenda')
    expect(boton).toBeGreaterThan(-1)
    expect(boton).toBeLessThan(html.indexOf('aria-label="Vista del calendario"'))
    expect(html).toMatch(/data-boton-leyenda=""[^>]*aria-label="Leyenda de estados"[^>]*aria-haspopup="dialog" aria-expanded="false"/)
  })
  it('sin la ranura, no hay botón', () => {
    expect(cabecera({})).not.toContain('data-boton-leyenda')
  })
})

describe('BandaMovil · contrato de F3', () => {
  it('aria-keyshortcuts en ‹ Hoy › y en las vistas con los atajos activos', () => {
    const html = banda(true)
    expect(html).toMatch(/aria-label="Periodo anterior" aria-keyshortcuts="K P"/)
    expect(html).toMatch(/aria-keyshortcuts="T"[^>]*>Hoy/)
    expect(html).toMatch(/aria-label="Periodo siguiente" aria-keyshortcuts="J N"/)
    expect(html).toMatch(/aria-keyshortcuts="D"[^>]*>Día/)
    expect(html).toContain('data-ranura="buscar"')
  })
  it('sin atajos, ninguno', () => {
    expect(banda(false)).not.toContain('aria-keyshortcuts')
  })
})
