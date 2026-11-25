/**
 * Avisos globales (2026-11-24) · lo puro de la campana de toda la app.
 * MUTACIONES (comprobadas en rojo): `etiquetaCampanaGlobal` sin el número;
 * `useAvisosClinica` ignorando `pedir` (la global volvería a `GET /api/avisos`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { etiquetaCampanaGlobal, SONDEO_MS } from '@/components/avisos/CampanaAvisos'
import { AVISO_RECIENTE_MS } from '@/lib/avisos/avisosClinica'

const leer = (ruta: string): string => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8')

describe('campana global', () => {
  it('el número va en el nombre del botón, no sólo en el dibujo', () => {
    expect(etiquetaCampanaGlobal(null)).toBe('Avisos')
    expect(etiquetaCampanaGlobal(0)).toBe('Avisos')
    expect(etiquetaCampanaGlobal(3)).toBe('Avisos (3 sin revisar)')
  })
  it('el sondeo no es más lento que la ventana de «recién llegado»: si lo fuera, se perderían burbujas', () => {
    expect(SONDEO_MS).toBeLessThanOrEqual(AVISO_RECIENTE_MS)
  })
  it('lee directo bajo RLS: ni `/api/avisos` ni cliente de servicio', () => {
    const codigo = leer('components/avisos/CampanaAvisos.tsx')
    expect(codigo).toContain('leerAvisosClinica(createClient(), clinicaId)')
    expect(codigo).not.toContain("fetch('/api/avisos'")
    expect(leer('lib/avisos/avisosServidor.ts')).not.toMatch(/^import .*(supabase\/admin|server-only|next\/headers)/m)
  })
  it('el gancho usa la lectura que le pasan', () => {
    expect(leer('hooks/useAvisosClinica.ts')).toContain('void pedir().then')
  })
  it('en /agenda la global se calla (ruta exacta) y el layout sólo la monta con la v2', () => {
    expect(leer('components/avisos/CampanaGlobal.tsx')).toContain("if (pathname === '/agenda') return null")
    expect(leer('app/(app)/layout.tsx')).toContain('{avisosGlobales && <CampanaGlobal />}')
  })
})

/* Paso 3 (M1): los tipos nuevos, «mis avisos» y el aviso reabierto. MUTACIONES (comprobadas en rojo):
   `esAvisoMio` devolviendo true para la cita de otro médico; `avisosParaEmergente` con la llave
   sin la hora (un aviso reabierto no volvía a avisar); `textoAviso` sin el nombre tecleado. */
import {
  avisosParaEmergente, enlaceDeAviso, esAvisoClinica, esAvisoMio, textoAviso, textoEmergente, TIPOS_AVISO,
  type AvisoDeCita, type AvisoSinCita,
} from '@/lib/avisos/avisosClinica'

const cita = (medico: string): AvisoDeCita['cita'] => ({
  id: '00000000-0000-4000-8000-0000000000c1', title: 'Hugo Interián', start_time: '2026-12-17T16:45:00Z', end_time: '2026-12-17T17:15:00Z',
  status: 'scheduled', medico_id: medico, paciente_id: 'p1', reserva_nombre: null, zona: 'America/Merida',
})
const deCita = (tipo: AvisoDeCita['tipo'], extra: Partial<AvisoDeCita> = {}): AvisoDeCita =>
  ({ id: `a-${tipo}`, tipo, creado_en: '2026-12-10T12:00:00Z', cita: cita('m1'), ...extra })
const sinCita = (tipo: AvisoSinCita['tipo'], extra: Partial<AvisoSinCita> = {}): AvisoSinCita =>
  ({ id: `a-${tipo}`, tipo, creado_en: '2026-12-10T12:00:00Z', cita: null, medico_id: 'm1', datos: {}, ...extra })

describe('avisos de M1: textos', () => {
  it('19 tipos, como el CHECK de la base', () => {
    expect(TIPOS_AVISO).toHaveLength(19)
    expect(leer('../supabase/migrations/20261202120000_avisos_globales_modelo.sql')).toContain("'paciente_no_asistira', 'reserva_frenada'")
  })
  it('lo del personal nombra a quien lo hizo y al paciente; la burbuja dice lo mismo', () => {
    const a = deCita('personal_agendo', { actor: 'Ana López', dirigido: true })
    expect(textoAviso(a)).toBe('Ana López agendó a Hugo Interián en tu agenda para el jueves, 17 de diciembre a las 10:45')
    expect(textoEmergente(a)).toBe(`${textoAviso(a)}.`)
    expect(textoAviso(deCita('personal_movio', { actor: null }))).toBe('Alguien de la clínica movió la cita de Hugo Interián al jueves, 17 de diciembre a las 10:45')
    expect(textoAviso(deCita('personal_cancelo', { actor: 'Ana' }))).toBe('Ana canceló la cita de Hugo Interián del jueves, 17 de diciembre a las 10:45')
  })
  it('Google, correo y el «No» de la última hora', () => {
    expect(textoAviso(deCita('google_movio_cita'))).toBe('La cita de Hugo Interián se movió desde Google al jueves, 17 de diciembre a las 10:45')
    expect(textoAviso(deCita('google_cancelo_cita'))).toContain('se canceló porque se borró en Google')
    expect(textoAviso(deCita('correo_fallido'))).toBe('No se pudo enviar el correo a Hugo Interián por su cita del jueves, 17 de diciembre a las 10:45')
    expect(textoAviso(deCita('paciente_no_asistira'))).toBe('Hugo Interián indicó que no asistirá a su cita del jueves, 17 de diciembre a las 10:45')
  })
  it('la reserva frenada lleva el nombre tecleado y el contador; sin nombre, «Alguien»', () => {
    expect(textoAviso(sinCita('reserva_frenada', { datos: { nombre: 'Fulano de Tal', intentos: 3 } }))).toBe('Fulano de Tal intentó reservar por enlace y no pudo (3 intentos)')
    expect(textoAviso(sinCita('reserva_frenada', { datos: { nombre: 'Fulano', intentos: 1 } }))).toBe('Fulano intentó reservar por enlace y no pudo')
    expect(textoAviso(sinCita('reserva_frenada'))).toBe('Alguien intentó reservar por enlace y no pudo')
  })
  it('el bloqueo dice el día y las horas en la zona del bloqueo, y nunca su motivo', () => {
    const datos = { inicio: '2026-12-17T15:00:00Z', fin: '2026-12-17T18:00:00Z', todo_el_dia: false, zona: 'America/Merida' }
    expect(textoAviso(sinCita('personal_bloqueo', { actor: 'Ana', datos }))).toBe('Ana bloqueó tu agenda el jueves, 17 de diciembre de 09:00 a 12:00')
    expect(textoAviso(sinCita('personal_desbloqueo', { actor: 'Ana', datos }))).toBe('Ana quitó un bloqueo de tu agenda del jueves, 17 de diciembre de 09:00 a 12:00')
    expect(textoAviso(sinCita('personal_bloqueo', { actor: 'Ana', datos: { ...datos, todo_el_dia: true } }))).toBe('Ana bloqueó tu agenda el jueves, 17 de diciembre')
  })
  it('un aviso sin cita es válido por la red y enlaza a la agenda (los de Google, a su configuración)', () => {
    expect(esAvisoClinica(sinCita('google_desconectado', { medico_id: null }))).toBe(true)
    expect(esAvisoClinica({ ...sinCita('google_desconectado'), cita: cita('m1') })).toBe(false)
    expect(esAvisoClinica({ ...deCita('correo_fallido'), cita: null })).toBe(false)
    expect(enlaceDeAviso(sinCita('google_desconectado'))).toBe('/agenda/configuracion')
    expect(enlaceDeAviso(sinCita('reserva_frenada'))).toBe('/agenda')
  })
})

describe('«Solo mis avisos» (el médico administrador)', () => {
  it('míos: mis citas, los dirigidos a mí y los de Google de toda la clínica; no los de otro médico', () => {
    expect(esAvisoMio(deCita('cancelacion_paciente'), 'm1')).toBe(true)
    expect(esAvisoMio(deCita('cancelacion_paciente'), 'm2')).toBe(false)
    expect(esAvisoMio(deCita('personal_agendo', { dirigido: true, cita: cita('m2') }), 'm2')).toBe(true)
    expect(esAvisoMio(sinCita('google_desconectado', { medico_id: null }), 'm2')).toBe(true)
    expect(esAvisoMio(sinCita('reserva_frenada', { medico_id: 'm1' }), 'm2')).toBe(false)
  })
})

describe('un aviso reabierto vuelve a avisar', () => {
  it('mismo id, hora nueva: otra burbuja; misma hora: ninguna', () => {
    const AHORA = Date.parse('2026-12-10T12:00:30Z')
    const vistos = new Set<string>()
    const a = deCita('confirmacion_paciente')
    expect(avisosParaEmergente([a], vistos, AHORA, TIPOS_AVISO)).toHaveLength(1)
    expect(avisosParaEmergente([a], vistos, AHORA, TIPOS_AVISO)).toHaveLength(0)
    expect(avisosParaEmergente([{ ...a, creado_en: '2026-12-10T12:00:20Z' }], vistos, AHORA, TIPOS_AVISO)).toHaveLength(1)
  })
})
