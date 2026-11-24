/**
 * avisosClinica.test.tsx — tanda I (I5), puntos 13 a 19 de Angel, en lo que
 * Vitest puede ver sin DOM: las reglas puras de los «Avisos» de la clínica,
 * qué cambio del canal recarga la campana, el marcado de la lista de avisos,
 * de la fila de «Por confirmar» (punto 17), del engrane y de la barra de la v2.
 * El teclado, el foco y el tiempo real de punta a punta van en las e2e de I5.
 *
 * MUTACIONES (comprobadas en rojo): `avisosParaEmergente` sin el filtro de
 * tipo (salen las cancelaciones, que ya avisa E8) o sin el de 2 min;
 * `textoEmergente` SIN el nombre (desde 2026-11-24 lo lleva); `citaDelEnlace` aceptando `nueva`;
 * `cambioPuedeAvisar` sin la rama de Google; `FilaManana` sin la celda vacía
 * del botón que falta; `CabeceraEscritorio` pintando el conteo con la v2.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/components/ui/Portal', () => ({ default: ({ children }: { children: ReactNode }) => children }))
// Punto 20: el correo a la clínica no debe tocar la red en pruebas.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('sin red en pruebas') } }))

import {
  avisosParaEmergente, citaDelEnlace, destacarDeAviso, enlaceDeAviso, leerRespuestaAvisos, textoAviso, textoEmergente,
  type AvisoClinica, type TipoAviso,
} from '@/lib/avisos/avisosClinica'
import { cambioPuedeAvisar, type CambioCita, type FilaCambioCita } from '@/lib/agenda/porConfirmarTiempoReal'
import { ListaAvisos } from '@/components/avisos/ListaAvisos'
import { ListaPorConfirmar } from '@/components/agenda/PanelPorConfirmar'
import { MenuEngraneAgenda } from '@/components/agenda/MenuEngraneAgenda'
import { CabeceraEscritorio } from '@/components/agenda/CabeceraEscritorio'
import { BandaMovil } from '@/components/agenda/BandaMovil'

const UUID = '00000000-0000-4000-8000-0000000015a1'
const AHORA = Date.parse('2026-11-17T16:00:00Z')
const nada = (): void => undefined

function aviso(tipo: TipoAviso, extra: Partial<AvisoClinica> = {}): AvisoClinica {
  return {
    id: `a-${tipo}`, tipo, creado_en: new Date(AHORA - 30_000).toISOString(),
    cita: {
      id: UUID, title: 'Cita de enlace', start_time: '2026-12-17T16:45:00Z', end_time: '2026-12-17T17:15:00Z',
      status: 'scheduled', medico_id: 'm1', paciente_id: null, reserva_nombre: 'María Ejemplo', zona: 'America/Merida',
    },
    ...extra,
  }
}

describe('leerRespuestaAvisos', () => {
  it('lee `{ avisos, avisos_disponibles }` y descarta lo que no es un aviso', () => {
    const r = leerRespuestaAvisos({ avisos_disponibles: true, avisos: [aviso('reserva_enlace'), { id: 'x', tipo: 'inventado' }] })
    expect(r).toEqual({ disponible: true, avisos: [aviso('reserva_enlace')] })
  })
  it('una respuesta sin la lista (servidor anterior) es null; sin la bandera, no disponible', () => {
    expect(leerRespuestaAvisos({ citas: [] })).toBeNull()
    expect(leerRespuestaAvisos({ avisos: [] })).toEqual({ disponible: false, avisos: [] })
  })
})

describe('textos', () => {
  it('la lista nombra a quien reservó; Google, el título del evento', () => {
    expect(textoAviso(aviso('reserva_enlace'))).toBe('María Ejemplo reservó por enlace')
    expect(textoAviso(aviso('cancelacion_paciente'))).toBe('María Ejemplo canceló su cita')
    expect(textoAviso(aviso('reagendado_paciente'))).toBe('María Ejemplo reagendó su cita')
    expect(textoAviso(aviso('google_por_asignar'))).toBe('Evento nuevo de Google por asignar: Cita de enlace')
    expect(textoAviso(aviso('empalme_google'))).toContain('se empalma con un evento de Google')
  })
  /* Avisos globales (2026-11-24): decisión de Angel, la burbuja lleva el nombre. Mutación en
     rojo: `textoEmergente` con «Un paciente» en vez del nombre. */
  it('el aviso emergente lleva el nombre y la fecha en la zona del consultorio; nada más de la cita', () => {
    expect(textoEmergente(aviso('reserva_enlace'))).toBe('María Ejemplo reservó por enlace para el jueves, 17 de diciembre a las 10:45.')
    expect(textoEmergente(aviso('cancelacion_paciente'))).toBe('María Ejemplo canceló su cita del jueves, 17 de diciembre a las 10:45.')
    expect(textoEmergente(aviso('reagendado_paciente'))).toBe('María Ejemplo reagendó su cita para el jueves, 17 de diciembre a las 10:45.')
    expect(textoEmergente(aviso('empalme_google'))).toBe('La reserva de María Ejemplo se empalma con un evento de Google.')
    // El evento de Google por asignar no es de un paciente todavía: sin nombre, con la hora (16:45 UTC = 10:45 en Mérida).
    expect(textoEmergente(aviso('google_por_asignar'))).toBe('Evento nuevo de Google por asignar el jueves, 17 de diciembre a las 10:45.')
  })
})

/* Tanda J, punto 10 · el aviso de una reservada por enlace movida en Google: el texto literal
   de Angel, lo acepta el lector y la tarjeta se abre con «Reagendar» destacado. Mutación en
   rojo: `destacarDeAviso` devolviendo undefined (la tarjeta se abría como siempre). */
describe('aviso «movida en Google» (tanda J, punto 10)', () => {
  const LITERAL = 'Desde Google no se pueden mover las citas reservadas por enlace. Para cambiarla, usa Reagendar: se le avisará al paciente.'
  it('el texto literal en la lista y en el emergente; el lector lo acepta', () => {
    expect(textoAviso(aviso('google_movimiento_rechazado'))).toBe(LITERAL)
    expect(textoEmergente(aviso('google_movimiento_rechazado'))).toBe(LITERAL)
    expect(leerRespuestaAvisos({ avisos_disponibles: true, avisos: [aviso('google_movimiento_rechazado')] })?.avisos).toHaveLength(1)
  })
  it('abre la tarjeta con «Reagendar» destacado; los demás tipos, sin destacar nada', () => {
    expect(destacarDeAviso(aviso('google_movimiento_rechazado'))).toBe('reagendar')
    for (const t of ['reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google'] as const) {
      expect(destacarDeAviso(aviso(t))).toBeUndefined()
    }
  })
})

describe('avisosParaEmergente', () => {
  const TIPOS: readonly TipoAviso[] = ['reserva_enlace', 'reagendado_paciente', 'google_por_asignar']
  it('sólo los recientes (≤ 2 min) de los tipos pedidos, y una vez por pestaña', () => {
    const vistos = new Set<string>()
    const viejo = aviso('reagendado_paciente', { id: 'viejo', creado_en: new Date(AHORA - 3 * 60_000).toISOString() })
    const lista = [aviso('reserva_enlace'), aviso('cancelacion_paciente'), viejo]
    expect(avisosParaEmergente(lista, vistos, AHORA, TIPOS).map(a => a.id)).toEqual(['a-reserva_enlace'])
    expect(avisosParaEmergente(lista, vistos, AHORA, TIPOS)).toEqual([])
  })
})

describe('enlaces', () => {
  it('`/agenda?cita=<uuid>` ida y vuelta; `nueva` (el alta de siempre) no es una cita', () => {
    expect(enlaceDeAviso(aviso('reserva_enlace'))).toBe(`/agenda?cita=${UUID}`)
    expect(citaDelEnlace(`?cita=${UUID}`)).toBe(UUID)
    expect(citaDelEnlace('?cita=nueva&paciente=p1')).toBeNull()
    expect(citaDelEnlace('?cita=1%20or%201')).toBeNull()
  })
})

describe('cambioPuedeAvisar (qué cambio del canal recarga la campana)', () => {
  const fila = (extra: Partial<FilaCambioCita>): FilaCambioCita => ({
    id: 'c1', paciente_id: 'p1', reserva_canal: null, status: 'scheduled', all_day: false, start_time: '2026-12-17T16:45:00Z', ...extra,
  })
  const c = (tipo: 'INSERT' | 'UPDATE', extra: Partial<FilaCambioCita>): CambioCita => ({ tipo, fila: fila(extra) })
  it('alta de una reserva por enlace o de un evento de Google sin paciente', () => {
    expect(cambioPuedeAvisar(c('INSERT', { paciente_id: null, reserva_canal: 'fijo' }))).toBe(true)
    expect(cambioPuedeAvisar(c('INSERT', { paciente_id: null, origen: 'google', google_asignacion: 'por_asignar' }))).toBe(true)
    // Integración I: sin la marca de I3 (todo el día, pasado, o no lo trajo el sondeo) no hay aviso que recargar.
    expect(cambioPuedeAvisar(c('INSERT', { paciente_id: null, origen: 'google', google_asignacion: null }))).toBe(false)
    expect(cambioPuedeAvisar(c('INSERT', { origen: 'spinus' }))).toBe(false)
  })
  it('una cancelación de cita con paciente o por ligar; nada más', () => {
    expect(cambioPuedeAvisar(c('UPDATE', { status: 'cancelled' }))).toBe(true)
    expect(cambioPuedeAvisar(c('UPDATE', { status: 'confirmed' }))).toBe(false)
    expect(cambioPuedeAvisar({ tipo: 'DELETE', id: 'c1' })).toBe(false)
  })
})

describe('ListaAvisos (pieza para toda la app)', () => {
  it('con manejador, cada aviso es un botón con su tipo y su cita', () => {
    const html = renderToStaticMarkup(<ListaAvisos avisos={[aviso('reserva_enlace')]} revisar={nada} revisarTodos={nada} alAbrir={nada} />)
    expect(html).toMatch(/<button[^>]*data-aviso-tipo="reserva_enlace"[^>]*data-aviso-cita="[0-9a-f-]+"/)
    expect(html).toContain('María Ejemplo reservó por enlace')
    expect(html).toContain('Marcar todos como revisados')
  })
  it('sin manejador (otra página), cada aviso enlaza a su cita en la agenda', () => {
    const html = renderToStaticMarkup(<ListaAvisos avisos={[aviso('reserva_enlace')]} revisar={nada} revisarTodos={nada} />)
    expect(html).toContain(`href="/agenda?cita=${UUID}"`)
  })
  it('vacía lo dice', () => {
    expect(renderToStaticMarkup(<ListaAvisos avisos={[]} revisar={nada} revisarTodos={nada} />)).toContain('No hay avisos sin revisar.')
  })
  it('integración I3 + I5: «¿No es una cita?» al lado del aviso de Google que SIGUE por asignar, y en ningún otro', () => {
    const conCita = (tipo: TipoAviso, cita: Partial<AvisoClinica['cita']>): AvisoClinica => {
      const a = aviso(tipo)
      return { ...a, id: `${a.id}-${cita.google_asignacion ?? cita.paciente_id ?? cita.reserva_canal ?? 'x'}`, cita: { ...a.cita, ...cita } }
    }
    const html = renderToStaticMarkup(<ListaAvisos avisos={[
      conCita('google_por_asignar', { google_asignacion: 'por_asignar' }),
      conCita('google_por_asignar', { google_asignacion: 'evento' }),
      conCita('google_por_asignar', { google_asignacion: 'por_asignar', paciente_id: 'p1' }),
      conCita('reserva_enlace', { reserva_canal: 'fijo' }),
    ]} revisar={nada} revisarTodos={nada} alAbrir={nada} />)
    expect(html.split('¿No es una cita?').length - 1).toBe(1)
    // Fuera del botón de la fila (un botón no va dentro de otro): el de la fila se cierra antes.
    expect(html.indexOf('</button>')).toBeLessThan(html.indexOf('data-aviso-no-es-cita'))
  })
})

describe('«Por confirmar» · punto 17: columnas fijas', () => {
  const base = { inicio: '2026-11-18T16:00:00Z', zona: 'America/Merida', titulo: 'P', consultorio: 'Centro', whatsapp_reminder_sent_at: null }
  it('cada fila tiene SIEMPRE sus dos celdas, en el mismo orden, aunque falte un botón', () => {
    const html = renderToStaticMarkup(<ListaPorConfirmar citas={[
      { ...base, id: 'f1', con_whatsapp: true, con_correo: true },
      { ...base, id: 'f2', con_whatsapp: false, con_correo: true },
    ]} />)
    const filas = html.split('data-fila-por-confirmar=').slice(1)
    expect(filas).toHaveLength(2)
    for (const f of filas) {
      expect(f.indexOf('ag-pc-celda--whatsapp')).toBeGreaterThan(-1)
      expect(f.indexOf('ag-pc-celda--whatsapp')).toBeLessThan(f.indexOf('ag-pc-celda--correo'))
    }
    expect(filas[1]).not.toContain('data-whatsapp-cita')
    expect(html).not.toContain('data-estado-fila') // sin nada hecho, ninguna línea de estado
  })
})

describe('MenuEngraneAgenda (punto 15)', () => {
  it('cerrado: un botón de menú (APG) sin el menú pintado', () => {
    const html = renderToStaticMarkup(<MenuEngraneAgenda onConfiguracion={nada} compactar={null} densidad={null} atajos={null} />)
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Opciones de la agenda"')
    expect(html).not.toContain('role="menu"')
  })
})

function cabecera(engrane?: ReactNode): string {
  return renderToStaticMarkup(
    <CabeceraEscritorio
      resumenConteo="3 citas" currentView="timeGridWeek" isMobile={false} onVista={nada}
      compactar={false} onCompactar={nada} densidadCompacta={false} onDensidad={nada}
      isSingleDoctor filtroEfectivo={null} mesSinTodos={false} medicos={[]} onFiltroMedico={nada}
      canEditHorario onHorario={nada} onAgendar={nada} onIntencionAgendar={nada}
      porConfirmar={<span data-ranura="campana" />} engrane={engrane}
    />,
  )
}

describe('CabeceraEscritorio · la barra de la v2 (punto 13)', () => {
  it('con el engrane: sin conteo, sin Compactar ni Densidad sueltos; campana, engrane y Agendar en ese orden', () => {
    const html = cabecera(<span data-ranura="engrane" />)
    expect(html).not.toContain('ag-controles-conteo')
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain('aria-label="Configurar horario de consulta"')
    const i = (s: string): number => html.indexOf(s)
    expect(i('data-ranura="campana"')).toBeLessThan(i('data-ranura="engrane"'))
    expect(i('data-ranura="engrane"')).toBeLessThan(i('Agendar'))
  })
  it('sin el engrane (v2 apagada): la barra de siempre', () => {
    const html = cabecera()
    expect(html).toContain('ag-controles-conteo')
    expect(html).toContain('aria-pressed')
  })
})

describe('BandaMovil · la banda de la v2 (puntos 13 y 18)', () => {
  const banda = (v2: boolean): string => renderToStaticMarkup(
    <BandaMovil
      conteo="3 citas" vistaActual="listWeek" onVista={nada} titulo="9 – 15 de noviembre"
      onPrev={nada} onNext={nada} onHoy={nada} hoyDeshabilitado={false} onMenu={nada}
      medicos={[]} filtroMedico="" onFiltroMedico={nada} onHorario={nada} onCompactar={nada}
      compactado={false} mesSinTodos={false}
      campana={v2 ? <span data-ranura="campana" /> : undefined} engrane={v2 ? <span data-ranura="engrane" /> : undefined}
    />,
  )
  it('con la v2: sin conteo, la campana junto a ‹ Hoy ›, y el engrane en lugar de Compactar y configuración', () => {
    const html = banda(true)
    expect(html).not.toContain('3 citas')
    expect(html.indexOf('data-ranura="campana"')).toBeLessThan(html.indexOf('aria-label="Periodo anterior"'))
    expect(html).toContain('data-ranura="engrane"')
    expect(html).not.toContain('aria-pressed')
  })
  it('apagada, la de siempre', () => {
    const html = banda(false)
    expect(html).toContain('3 citas')
    expect(html).toContain('aria-pressed')
  })
})

describe('punto 20 · el correo a la clínica', async () => {
  const { correoReservaClinica } = await import('@/lib/reserva/correoClinicaReserva')
  const { CorreoReservaClinicaSchema } = await import('@/lib/agenda/ajustesAgenda')
  const datos = { nombre: 'María Ejemplo', medico: 'Dra. Ana Pérez', consultorio: 'Centro', inicio: '2026-12-17T16:45:00Z', zona: 'America/Merida' }
  it('sólo nombre, fecha, hora, médico y consultorio; un reagendado lo dice en el asunto', () => {
    const c = correoReservaClinica({ ...datos, reagendada: false })
    expect(c.asunto).toMatch(/^Reserva nueva: María Ejemplo, .*10:45 h$/)
    for (const parte of [c.texto, c.html]) {
      expect(parte).toContain('Dra. Ana Pérez')
      expect(parte).toContain('Centro')
    }
    expect(correoReservaClinica({ ...datos, reagendada: true }).asunto).toMatch(/^Cita reagendada: /)
  })
  it('el PATCH acepta SÓLO `{ correo_reserva_clinica: boolean }`', () => {
    expect(CorreoReservaClinicaSchema.safeParse({ correo_reserva_clinica: true }).success).toBe(true)
    for (const malo of [{ correo_reserva_clinica: true, agenda_v2_encendida: true }, { correo_reserva_clinica: 'true' }, {}]) {
      expect(CorreoReservaClinicaSchema.safeParse(malo).success).toBe(false)
    }
  })
})
