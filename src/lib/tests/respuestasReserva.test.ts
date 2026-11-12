/** respuestasReserva.test.ts — agenda D5: resultado de la RPC → HTTP, con el 404 uniforme. */
import { describe, it, expect } from 'vitest'
import { NO_ENCONTRADO, respuestaErrorRpc, respuestaReserva, respuestaVerificacion } from '@/lib/reserva/respuestasReserva'

describe('respuestaReserva', () => {
  it('cada resultado a su estado', () => {
    const esperado: Record<string, number> = {
      ok: 201, repetida: 200, ocupado: 409, ya_tiene_cita: 409, bloqueado: 403, correo_sin_verificar: 403,
      enlace_usado: 410, enlace_caducado: 410, fuera_de_ventana: 400, consultorio_invalido: 400, tipo_invalido: 400,
    }
    for (const [r, s] of Object.entries(esperado)) expect(respuestaReserva(r, null).status, r).toBe(s)
  })
  it('enlace inválido, apagado, aviso sin aprobar y sin acceso: el MISMO 404', () => {
    for (const r of ['enlace_invalido', 'apagado', 'aviso_no_aprobado', 'clinica_sin_acceso', 'lo_que_sea']) {
      expect(respuestaReserva(r, '9991234567')).toEqual(NO_ENCONTRADO)
    }
  })
  it('bloqueado dice el mensaje de §2 con el teléfono', () => {
    const r = respuestaReserva('bloqueado', '9991234567')
    expect(r.cuerpo.error).toBe('autoservicio_cerrado')
    expect(r.cuerpo.mensaje).toBe('Para agendar, comunícate con el consultorio: 9991234567.')
  })
  it('errores de la RPC: ausente 404; forma 400; lo demás 500', () => {
    expect(respuestaErrorRpc(true, 'PGRST202')).toEqual(NO_ENCONTRADO)
    expect(respuestaErrorRpc(false, '22023').status).toBe(400)
    expect(respuestaErrorRpc(false, '23505').status).toBe(400)
    expect(respuestaErrorRpc(false, '25001').status).toBe(500)
  })
  it('verificación', () => {
    expect(respuestaVerificacion('ok').status).toBe(200)
    expect(respuestaVerificacion('incorrecto').status).toBe(400)
    expect(respuestaVerificacion('agotado').status).toBe(429)
    expect(respuestaVerificacion('caducado').status).toBe(410)
  })
})
