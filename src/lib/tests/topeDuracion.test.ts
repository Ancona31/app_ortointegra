/**
 * topeDuracion.test.ts — el techo de duración de una fila de `appointments`.
 *
 * La regla que sostienen estos casos: un dedazo en el AÑO del campo de fin
 * —los `<input type="date">` del modal dejan escribir cualquiera— creaba una
 * fila que se solapa con TODAS las semanas de la agenda y que no rompe nada, así
 * que no se ve. Ver la cabecera de `@/lib/agenda/topeDuracion`.
 *
 * ⚠️ LAS PUNTAS SE ESCRIBEN COMO INSTANTES ISO CON `Z`, y no con
 * `new Date(a, m, d)` como en `ventanaRejilla.test.ts`. La diferencia es
 * deliberada y va en sentido contrario a la de aquel archivo: allí se mide
 * geometría de calendario, que depende del huso; aquí se mide una DURACIÓN
 * —una resta de dos instantes— que no depende de ninguno. Con `Z` los casos
 * frontera valen lo mismo corra donde corra, que es lo que hace fiable un test
 * de «justo por debajo / justo por encima». `vitest.config.ts` no fija `TZ`.
 */

import { describe, it, expect } from 'vitest'
import {
  comprobarTopeDuracion,
  TOPE_CITA_HORAS,
  TOPE_EVENTO_DIAS,
} from '@/lib/agenda/topeDuracion'

const CON_PACIENTE = true
const SIN_PACIENTE = false

/** Un instante desplazado en horas sobre un origen fijo y redondo. */
const ORIGEN = Date.UTC(2026, 8, 8, 0, 0, 0)
function masHoras(horas: number): string {
  return new Date(ORIGEN + horas * 3_600_000).toISOString()
}
function masDias(dias: number): string {
  return masHoras(dias * 24)
}
const INICIO = new Date(ORIGEN).toISOString()

describe('cita con paciente — tope de 10 horas', () => {
  it('una consulta normal de 1 h pasa', () => {
    expect(comprobarTopeDuracion(INICIO, masHoras(1), CON_PACIENTE)).toBeNull()
  })

  it('las 4 h de la cita más larga que existe hoy en producción pasan', () => {
    expect(comprobarTopeDuracion(INICIO, masHoras(4), CON_PACIENTE)).toBeNull()
  })

  it('JUSTO POR DEBAJO: 9 h 59 min pasa', () => {
    expect(comprobarTopeDuracion(INICIO, masHoras(9 + 59 / 60), CON_PACIENTE)).toBeNull()
  })

  it('EL TOPE EXACTO: 10 h clavadas pasan — la regla es «más de», no «desde»', () => {
    expect(comprobarTopeDuracion(INICIO, masHoras(TOPE_CITA_HORAS), CON_PACIENTE)).toBeNull()
  })

  it('JUSTO POR ENCIMA: 10 h y un minuto se rechaza', () => {
    const r = comprobarTopeDuracion(INICIO, masHoras(TOPE_CITA_HORAS + 1 / 60), CON_PACIENTE)
    expect(r).not.toBeNull()
    expect(r?.error).toBe('duracion_excesiva')
  })

  it('el dedazo que motivó todo esto —un año en el campo de fin— se rechaza', () => {
    const r = comprobarTopeDuracion('2026-09-08T09:00:00Z', '2027-09-08T10:00:00Z', CON_PACIENTE)
    expect(r?.error).toBe('duracion_excesiva')
  })

  it('el mensaje dice el tope y habla de la fecha de fin, que es lo que hay que corregir', () => {
    const r = comprobarTopeDuracion(INICIO, masDias(30), CON_PACIENTE)
    expect(r?.message).toContain(String(TOPE_CITA_HORAS))
    expect(r?.message).toMatch(/fecha de fin/i)
  })
})

describe('evento genérico sin paciente — tope de un año', () => {
  it('los 18 días del evento más largo que existe hoy en producción pasan', () => {
    expect(comprobarTopeDuracion(INICIO, masDias(18), SIN_PACIENTE)).toBeNull()
  })

  /* ⚠️ ÉSTE ES EL CASO QUE OBLIGA A QUE EL TOPE SEAN 366 DÍAS Y NO 365.
     `end_time` de una fila de todo el día es la medianoche del día SIGUIENTE al
     último incluido, así que un evento que CUBRE 365 días mide 366 de punta a
     punta. Con el tope en 365 este caso legítimo se rechazaría, que es
     exactamente lo que no puede pasar. */
  it('UN EVENTO DE TODO EL DÍA DE 365 DÍAS PASA, pese a medir 366 por el fin exclusivo', () => {
    const cubre365 = masDias(TOPE_EVENTO_DIAS + 1)
    expect(comprobarTopeDuracion(INICIO, cubre365, SIN_PACIENTE)).toBeNull()
  })

  it('JUSTO POR DEBAJO: 365 días de punta a punta pasan', () => {
    expect(comprobarTopeDuracion(INICIO, masDias(365), SIN_PACIENTE)).toBeNull()
  })

  it('JUSTO POR ENCIMA: 366 días y una hora se rechaza', () => {
    const r = comprobarTopeDuracion(INICIO, masHoras(366 * 24 + 1), SIN_PACIENTE)
    expect(r).not.toBeNull()
    expect(r?.error).toBe('duracion_excesiva')
  })

  it('el disparate contra el que esto protege —36 años— se rechaza', () => {
    const r = comprobarTopeDuracion('2026-09-08T00:00:00Z', '2062-09-08T00:00:00Z', SIN_PACIENTE)
    expect(r?.error).toBe('duracion_excesiva')
  })

  it('un evento de todo el día de UN SOLO día mide 24 h exactas y pasa', () => {
    expect(comprobarTopeDuracion(INICIO, masDias(1), SIN_PACIENTE)).toBeNull()
  })

  it('el mensaje habla de un año y no menciona horas', () => {
    const r = comprobarTopeDuracion(INICIO, masDias(400), SIN_PACIENTE)
    expect(r?.message).toMatch(/un año/i)
    expect(r?.message).not.toMatch(/\d+ horas/)
  })
})

describe('los dos topes son distintos, y el discriminador es el paciente', () => {
  /* La misma duración cae de un lado o del otro según `paciente_id`, que es el
     único discriminador que hay entre cita y evento genérico (§12.14). */
  it('48 h son evento válido y cita inválida', () => {
    expect(comprobarTopeDuracion(INICIO, masHoras(48), SIN_PACIENTE)).toBeNull()
    expect(comprobarTopeDuracion(INICIO, masHoras(48), CON_PACIENTE)?.error).toBe('duracion_excesiva')
  })

  it('los dos mensajes son distintos: no se le dice «10 horas» a un evento', () => {
    const cita   = comprobarTopeDuracion(INICIO, masDias(400), CON_PACIENTE)
    const evento = comprobarTopeDuracion(INICIO, masDias(400), SIN_PACIENTE)
    expect(cita?.message).not.toBe(evento?.message)
  })
})

describe('lo que este módulo NO hace, escrito para que nadie lo suponga', () => {
  /* El orden lo comprueba la validación que ya existe en las dos rutas, ANTES
     de llamar aquí. Una duración negativa es menor que cualquier tope y pasa —
     correcto, porque ya la rechazó quien va delante. */
  it('un rango invertido NO se rechaza aquí: de eso se encarga `rango_invalido`', () => {
    expect(comprobarTopeDuracion(masHoras(10), INICIO, CON_PACIENTE)).toBeNull()
  })

  it('una fecha ilegible no revienta ni rechaza: la forma la valida la ruta', () => {
    expect(comprobarTopeDuracion('vaya', masHoras(1), CON_PACIENTE)).toBeNull()
    expect(comprobarTopeDuracion(INICIO, 'vaya', SIN_PACIENTE)).toBeNull()
  })

  it('acepta Date además de cadena, que es lo que las rutas pueden tener a mano', () => {
    const fin = new Date(ORIGEN + 20 * 3_600_000)
    expect(comprobarTopeDuracion(new Date(ORIGEN), fin, CON_PACIENTE)?.error).toBe('duracion_excesiva')
    expect(comprobarTopeDuracion(new Date(ORIGEN), fin, SIN_PACIENTE)).toBeNull()
  })
})
