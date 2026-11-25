import { test, expect } from '@playwright/test'
import { soloEscritorio } from './ayudas'
import {
  cancelarCita, cerrarEscenario, citaDe, desbloquearDesdeCita, emitirEnlace, personaNueva, prepararEscenario, reservar,
  turnosLibres, verificarCorreo, type Escenario, type Turno,
} from './reservaPublicaAyudas'

/**
 * El candado de la reserva por enlace (agenda D10, caso 4 de plan_D.md; §2:
 * 1 cita activa por persona y médico, 3 cancelaciones o inasistencias en 60
 * días cierran el autoservicio, el enlace único se lo salta, se levanta a
 * mano). Las cancelaciones se hacen como las haría el personal: cambio de
 * estado de la cita (el disparador de D2 cuenta la incidencia). Desbloquear
 * se hace con lo mismo que escribe «Desbloquear» (`reserva_contacto_marcar`),
 * por SQL: la lista de bloqueados de la pantalla es de D6.
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()

let e: Escenario
let libres: Turno[] = []
let siguiente = 0
function turno(): string {
  const t = libres[siguiente++]
  if (!t) throw new Error('Se acabaron los turnos libres de la semana elegida')
  return t.inicio
}

test.beforeAll(async () => {
  e = prepararEscenario()
  libres = await turnosLibres(e, emitirEnlace(e, 'unico').codigo, 14)
})
test.afterAll(() => { cerrarEscenario() })

/** Tres reservas por enlace único de esa persona, canceladas: tres incidencias. */
async function tresCancelaciones(p: ReturnType<typeof personaNueva>): Promise<string> {
  let ultima = ''
  for (let i = 0; i < 3; i++) {
    const r = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno(), persona: p })
    expect({ status: r.status, error: r.cuerpo.error }).toEqual({ status: 201, error: undefined })
    ultima = citaDe(p.correo)?.id ?? ''
    cancelarCita(ultima)
  }
  return ultima
}

test('una segunda reserva de la misma persona con el enlace fijo da 409 ya_tiene_cita', async () => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const p = personaNueva()
  expect((await reservar(e, codigo, { inicio: turno(), persona: p, ficha: await verificarCorreo(codigo, p.correo) })).status).toBe(201)
  const segunda = await reservar(e, codigo, { inicio: turno(), persona: p, ficha: await verificarCorreo(codigo, p.correo) })
  expect(segunda).toMatchObject({ status: 409, cuerpo: { error: 'ya_tiene_cita' } })
})

test('tres cancelaciones cierran el autoservicio (403 con el teléfono); desbloquear lo abre; el único se lo salta', async () => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const p = personaNueva()
  const ultima = await tresCancelaciones(p)

  const cerrado = await reservar(e, codigo, { inicio: turno(), persona: p, ficha: await verificarCorreo(codigo, p.correo) })
  expect(cerrado).toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
  expect(String(cerrado.cuerpo.mensaje)).toContain('Para agendar, comunícate con el consultorio')
  if (e.consultorioTelefono) expect(String(cerrado.cuerpo.mensaje)).toContain(e.consultorioTelefono)

  desbloquearDesdeCita(ultima)
  const abierto = await reservar(e, codigo, { inicio: turno(), persona: p, ficha: await verificarCorreo(codigo, p.correo) })
  expect({ status: abierto.status, error: abierto.cuerpo.error }).toEqual({ status: 201, error: undefined })

  // El único emitido por la clínica se salta candado y «1 activa» (§2).
  const unico = await reservar(e, emitirEnlace(e, 'unico').codigo, { inicio: turno(), persona: p })
  expect(unico.status).toBe(201)
})

// seg1 (decisión de Angel, mejora_agendaV2.md §6-bis): lo automático del candado
// decide por el CORREO verificado. Antes, coincidir sólo por el teléfono también
// bloqueaba; ahora no (cualquiera puede escribir un teléfono ajeno). Debilita el
// candado frente a quien cambie de correo; el bloqueo manual por teléfono sigue
// cortando (reserva-seg1.e2e.ts).
test('coincidir sólo por el teléfono ya NO bloquea; coincidir por el correo, sí', async () => {
  const { codigo } = emitirEnlace(e, 'fijo')
  const p = personaNueva()
  await tresCancelaciones(p)
  const mismoTelefonoOtroCorreo = { ...personaNueva(), telefono: p.telefono }
  const r = await reservar(e, codigo, {
    inicio: turno(), persona: mismoTelefonoOtroCorreo, ficha: await verificarCorreo(codigo, mismoTelefonoOtroCorreo.correo),
  })
  expect({ status: r.status, error: r.cuerpo.error }).toEqual({ status: 201, error: undefined })
  const mismoCorreoOtroTelefono = { ...personaNueva(), correo: p.correo }
  const c = await reservar(e, codigo, {
    inicio: turno(), persona: mismoCorreoOtroTelefono, ficha: await verificarCorreo(codigo, p.correo),
  })
  expect(c).toMatchObject({ status: 403, cuerpo: { error: 'autoservicio_cerrado' } })
})
