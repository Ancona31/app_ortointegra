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

const nada = (): void => undefined

function cabecera(extra: { atajos?: boolean; selectorFecha?: string; buscar?: string; engrane?: boolean }): string {
  return renderToStaticMarkup(
    <CabeceraEscritorio
      resumenConteo="3 citas" currentView="timeGridWeek" isMobile={false} onVista={nada}
      compactar={false} onCompactar={nada} densidadCompacta={false} onDensidad={nada}
      isSingleDoctor filtroEfectivo={null} mesSinTodos={false} medicos={[]} onFiltroMedico={nada}
      canEditHorario={false} onHorario={nada} onAgendar={nada} onIntencionAgendar={nada}
      atajos={extra.atajos}
      selectorFecha={extra.selectorFecha ? <span data-ranura="fecha">{extra.selectorFecha}</span> : undefined}
      buscar={extra.buscar ? <span data-ranura="buscar">{extra.buscar}</span> : undefined}
      engrane={extra.engrane ? <button type="button" data-engrane-agenda="">···</button> : undefined}
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

/* B13 (§28): la leyenda salió de la barra; su única puerta es «Opciones de la agenda». Sustituye a
   la prueba del botón de la tanda L, punto 11. */
describe('CabeceraEscritorio · la leyenda no está en la barra (B13, §28)', () => {
  it('con la barra v2 (engrane) no hay botón de la leyenda', () => {
    const html = cabecera({ engrane: true })
    expect(html).toContain('data-engrane-agenda')
    expect(html).not.toContain('data-boton-leyenda')
    expect(html).not.toContain('Leyenda de estados')
  })
})

/* B13 · La barra por formato (PIEZAS §4): con la v2 (engrane + conmutador de cuatro) la banda es la
   barra de la maqueta: sin «Abrir menú» (el encabezado de la app vuelve) y con el periodo en la ranura
   de la fecha. Apagada, la banda de siempre. */
describe('BandaMovil · la barra de la v2 (B13)', () => {
  const conV2 = (): string => renderToStaticMarkup(
    <BandaMovil
      conteo="3 citas" vistaActual="timeGridDay" onVista={nada} titulo="Jue, 19 de noviembre"
      onPrev={nada} onNext={nada} onHoy={nada} hoyDeshabilitado={false} onMenu={nada}
      medicos={[]} filtroMedico="" onFiltroMedico={nada} onHorario={null} onCompactar={null}
      compactado={false} mesSinTodos={false} cuatroVistas="telefono"
      selectorFecha={<span data-ranura="fecha">fecha</span>}
      engrane={<button type="button" data-engrane-agenda="">···</button>}
    />,
  )
  it('marca la barra, sin «Abrir menú», con el periodo en la ranura y las cuatro vistas', () => {
    const html = conV2()
    expect(html).toContain('data-barra-v2=""')
    expect(html).not.toContain('Abrir menú')
    expect(html).toContain('data-ranura="fecha"')
    expect(html).toMatch(/>3 días</)
    expect(html).toContain('aria-label="Periodo anterior"')
  })
  it('apagada (sin engrane) es la banda de siempre', () => {
    expect(banda(false)).not.toContain('data-barra-v2')
    expect(banda(false)).toContain('Abrir menú')
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
