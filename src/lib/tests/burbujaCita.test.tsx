/**
 * burbujaCita.test.tsx — tanda K, sección E, punto 21 de Angel: la burbuja de la cita como en
 * `docs/spec/Burbuja.dc.html`, con sus cuatro ajustes. Aquí lo que se ve sin navegador: qué va
 * en cada sitio (`burbujaDeTarjeta`), los textos y lo que pinta. El comportamiento (desplegar,
 * Escape, foco, las puertas de siempre) va en la e2e `agenda-k5-burbuja`.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `rejillaDeBurbuja` sin `'menu-confirmar'` en la agendada → «agendada»;
 *   · `'no-asistio'` fuera de la rejilla de la confirmada → «confirmada»;
 *   · cancelada con `rejilla: []` → «cancelada»;
 *   · `confirmar.correo: Boolean(o.conCorreo)` sin mirar el estado → «Confirmar: cada una si aplica»;
 *   · tanda M, punto 4: el panel de los tres puntos de vuelta (`aria-expanded` en el ⋮) → «los tres
 *     puntos abren el formulario»; `Observaciones` sin `title` o pintada sin observaciones → «observaciones».
 *   · `conDestacada` sin aplicar (`disposicionDeTarjeta` → `disposicionPorEstado`) → «desde un aviso»;
 *   · `'no-es-cita': '¿No es una cita?'` → «textos»;
 *   · `Procedencia` con `enlace = !cita.paciente_id && …` → «eslabón permanente»;
 *   · `<GoogleGIcon>` cambiado por una «G» de texto → «G a color»;
 *   · el engrane de vuelta en la cabecera → «sin engrane»;
 *   · `BotonCorreoCita` con `aria-label={nombre}` siempre → «correo con etiqueta».
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { burbujaDeTarjeta, diaLargoDeTarjeta, ETIQUETA_ACCION, inicialesDeMedico } from '@/lib/agenda/accionesTarjeta'
import BurbujaCita from '@/components/agenda/BurbujaCita'
import { BotonCorreoCita } from '@/components/agenda/BotonCorreoCita'

const CON = { paciente_id: 'p1', reserva_canal: null } as const
const POR_ASIGNAR = { paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar', origen: 'google' } as const
const EVENTO = { paciente_id: null, reserva_canal: null } as const
const TODO = { conWhatsApp: true, conCorreo: true }

describe('burbujaDeTarjeta: qué va en cada sitio', () => {
  it('agendada: «Iniciar consulta»; Confirmar | Reagendar | Editar; pie «Cancelar cita»', () => {
    const d = burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, TODO)
    expect(d.principal).toBe('iniciar-consulta')
    expect(d.rejilla).toEqual(['menu-confirmar', 'reagendar', 'editar'])
    expect(d.pie).toEqual(['cancelar'])
  })
  it('confirmada: Reagendar | Editar | No asistió (los recordatorios, en el formulario: tanda M, punto 4)', () => {
    const d = burbujaDeTarjeta({ ...CON, status: 'confirmed' }, true, TODO)
    expect(d.rejilla).toEqual(['reagendar', 'editar', 'no-asistio'])
  })
  /* B13 · AG5 (maqueta `ag-burbuja`): TODAS las burbujas llevan la fila «Editar» (la del lápiz). */
  it('cancelada: «Darle otra cita» de principal, «Reasignar el horario» y «Editar» de filas y «Eliminar cita» en el pie (tanda L, punto 9); no asistió: «Darle otra cita» y «Editar»', () => {
    const c = burbujaDeTarjeta({ ...CON, status: 'cancelled' }, true, TODO)
    expect(c).toMatchObject({ principal: 'reagendar-cita', rejilla: ['reasignar', 'editar'], pie: ['eliminar-cita'], ayuda: 'Esta cita se canceló. Su horario quedó libre.' })
    const n = burbujaDeTarjeta({ ...CON, status: 'no_show' }, true, TODO)
    expect(n).toMatchObject({ principal: 'reagendar-cita', rejilla: ['editar'], pie: [], ayuda: 'El paciente no llegó a esta cita.' })
  })
  it('atendida: «Ver la consulta» (si puede abrir expedientes); la fila «Editar» y el lápiz', () => {
    const d = burbujaDeTarjeta({ ...CON, status: 'attended' }, true, { ...TODO, puedeVerExpediente: true })
    expect(d).toMatchObject({ principal: 'ver-expediente', rejilla: ['editar'], pie: [] })
    expect(burbujaDeTarjeta({ ...CON, status: 'attended' }, true, TODO).principal).toBeNull()
  })
  it('Confirmar: cada una si aplica (WhatsApp, correo, marcar) y, sin ninguna, no hay «Confirmar»', () => {
    expect(burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, TODO).confirmar).toEqual({ whatsapp: true, correo: true, marcar: true })
    expect(burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, {}).confirmar).toEqual({ whatsapp: false, correo: false, marcar: true })
    const nada = burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, { conConfirmar: false })
    expect(nada.rejilla).toEqual(['reagendar', 'editar'])
    expect(burbujaDeTarjeta({ ...CON, status: 'confirmed' }, true, TODO).confirmar).toEqual({ whatsapp: false, correo: false, marcar: false })
  })
  it('agendada: «No asistió» no está en la burbuja (tanda M, punto 4: queda en el formulario)', () => {
    const d = burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, TODO)
    expect([...d.rejilla, ...d.pie, d.principal]).not.toContain('no-asistio')
  })
  it('sin expediente (Google por asignar): «Ligar expediente e iniciar» con su ayuda; pie «No es una cita» | «Cancelar cita»', () => {
    const d = burbujaDeTarjeta({ ...POR_ASIGNAR, status: 'scheduled' }, true, TODO)
    expect(d).toMatchObject({ principal: 'ligar', ayuda: 'Primero buscas su expediente o le creas uno.', pie: ['no-es-cita', 'cancelar'] })
    expect(d.rejilla).toEqual(['menu-confirmar', 'reagendar', 'editar'])
  })
  it('por enlace sin ligar: sin «No es una cita» (como hoy)', () => {
    expect(burbujaDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'scheduled' }, true).pie).toEqual(['cancelar'])
  })
  it('evento: Editar | Convertir; pie «Eliminar evento»', () => {
    const d = burbujaDeTarjeta({ ...EVENTO, origen: 'google', medico_id: 'm1', all_day: false, status: 'scheduled' }, false)
    expect(d).toMatchObject({ principal: null, rejilla: ['editar', 'convertir'], pie: ['eliminar'], ayuda: null })
  })
  it('desde un aviso (J4): «Reagendar» de principal y la principal de antes encabeza la rejilla', () => {
    const d = burbujaDeTarjeta({ ...CON, status: 'scheduled' }, true, { ...TODO, destacar: 'reagendar' })
    expect(d.principal).toBe('reagendar')
    expect(d.rejilla).toEqual(['iniciar-consulta', 'menu-confirmar', 'editar'])
  })
})

describe('textos de la maqueta', () => {
  it('las acciones', () => {
    expect([ETIQUETA_ACCION['ver-expediente'], ETIQUETA_ACCION['reagendar-cita'], ETIQUETA_ACCION.reasignar, ETIQUETA_ACCION.ligar,
      ETIQUETA_ACCION['no-es-cita'], ETIQUETA_ACCION['no-asistio'], ETIQUETA_ACCION.confirmar])
      .toEqual(['Ver la consulta', 'Darle otra cita', 'Reasignar el horario', 'Ligar expediente e iniciar', 'No es una cita', 'No asistió', 'Marcar como confirmada'])
  })
  it('el día largo y las iniciales del médico', () => {
    expect(diaLargoDeTarjeta({ start_time: '2026-11-18T22:00:00Z' }, 'America/Merida')).toBe('Miércoles 18 de noviembre')
    expect(inicialesDeMedico('Dr. Admin Semilla Uno')).toBe('AS')
  })
})

const CITA: Appointment = {
  id: 'a1', title: 'Reserva', start_time: '2026-11-18T22:00:00Z', end_time: '2026-11-18T22:30:00Z', all_day: false,
  status: 'scheduled', notes: null, paciente_id: 'p1', medico_id: 'm1', google_event_id: null, gcal_sync_status: 'synced',
  updated_at: '2026-11-01T00:00:00Z', consultorio_id: 'c1', consultorio_nombre: 'Centro', consultorio_nombre_corto: 'C',
  consultorio_direccion: null, consultorio_telefono: null, consultorio_timezone: 'America/Merida', icono: null, color: null,
  pacientes: { id: 'p1', nombre: 'Ana', apellidos: 'Prueba', telefono: null },
}
const pintar = (c: Partial<Appointment>, enlacePropio = true): string => renderToStaticMarkup(
  <BurbujaCita idTitulo="t" salir={() => undefined} autoFoco={false}
    props={{ cita: { ...CITA, ...c }, zonaVisor: 'America/Merida', puedeIniciarConsulta: true, alAccion: () => undefined, enlacePropio }} />)

describe('lo que pinta', () => {
  /* B13 · AG5 (CALMA §28, textos unificados): «Reservó por enlace», sea o no el enlace de quien mira. */
  it('eslabón permanente: ligada también dice «Reservó por enlace», sin expediente tachado', () => {
    const html = pintar({ reserva_canal: 'unico' })
    expect(html).toContain('Reservó por enlace')
    expect(html).toContain('ag-icono-enlace')
    expect(html).not.toContain('Sin expediente')
    expect(pintar({ reserva_canal: 'unico' }, false)).toContain('Reservó por enlace')
  })
  it('sin expediente: el botón con su nombre (y nada de píldoras «Por ligar»)', () => {
    const html = pintar({ reserva_canal: 'fijo', paciente_id: null, pacientes: null, reserva_nombre: 'Lucía' })
    expect(html).toContain('aria-label="Sin expediente: este paciente aún no tiene expediente"')
    expect(html).not.toMatch(/Por ligar/i)
  })
  it('G a color: «Agendada desde Google Calendar» (CALMA §28) con la «G» de cuatro tintas', () => {
    const html = pintar({ origen: 'google' })
    expect(html).toContain('Agendada desde Google Calendar')
    expect(html).toContain('fill="#4285F4"')
  })
  it('sin engrane: el lápiz «Más opciones de la cita» (CALMA §29.5) y la ✕', () => {
    const html = pintar({})
    expect(html).not.toContain('Configuración de la cita')
    expect(html).toContain('aria-label="Más opciones de la cita"')
    expect(html).toContain('aria-label="Cerrar"')
  })
  it('los tres puntos abren el formulario: un botón sin menú (ni `aria-expanded` ni panel)', () => {
    const html = pintar({ notes: 'Algo' })
    const puntos = html.match(/<button[^>]*aria-label="Más opciones de la cita"[^>]*>/)?.[0] ?? ''
    expect(puntos).not.toBe('')
    expect(puntos).not.toContain('aria-expanded')
    expect(puntos).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('role="group" aria-label="Más opciones de la cita"')
    expect(html).not.toContain('Sin observaciones')
    expect(html).not.toContain('Tipo de cita')
  })
  it('observaciones: una línea con el texto entero en el DOM y en `title`; sin observaciones, no hay línea', () => {
    const larga = 'Trae sus radiografías de rodilla y la receta anterior; pidió que se le llame antes'
    const html = pintar({ notes: `  ${larga}\n ` })
    expect(html).toContain(`<p class="ag-burbuja-obs" title="${larga}" data-burbuja-obs="">`)
    expect(html).toContain(`Observaciones: </span>${larga}</p>`)
    expect(pintar({ notes: null })).not.toContain('ag-burbuja-obs')
    expect(pintar({ notes: '   ' })).not.toContain('ag-burbuja-obs')
  })
  it('el pie de una por asignar dice «No es una cita», sin signos', () => {
    const html = pintar({ paciente_id: null, pacientes: null, google_asignacion: 'por_asignar', origen: 'google' })
    expect(html).toContain('>No es una cita<')
    expect(html).not.toContain('¿')
  })
})

describe('BotonCorreoCita con etiqueta (el «Enviar por correo» de Confirmar)', () => {
  it('el texto visible es su nombre; sin etiqueta, el de siempre', () => {
    const con = renderToStaticMarkup(<BotonCorreoCita citaId="c" enCapa etiqueta="Enviar por correo" />)
    expect(con).toContain('Enviar por correo</button>')
    expect(con).not.toContain('aria-label')
    expect(renderToStaticMarkup(<BotonCorreoCita citaId="c" enCapa />)).toContain('aria-label="Enviar confirmación por correo"')
  })
})
