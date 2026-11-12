/**
 * respuestasReserva.ts — de lo que devuelve la base a lo que contesta la ruta
 * pública (agenda D5). Puro.
 *
 * ⚠️ «ENLACE INVÁLIDO» ES UN 404 UNIFORME (lista A, 18): no existe, revocado,
 * interruptor apagado, aviso sin aprobar, clínica sin acceso, médico que ya
 * no está o RPC ausente contestan EXACTAMENTE lo mismo, para que nadie
 * distinga un enlace real apagado de uno inventado. Usado o caducado sí se
 * dicen (410): quien tiene ese enlace ya lo tuvo vigente.
 */

export interface Respuesta { status: number; cuerpo: Record<string, string | number | null> }

export const NO_ENCONTRADO: Respuesta = { status: 404, cuerpo: { error: 'no_encontrado' } }

/** El mensaje de §2 para quien tiene el autoservicio cerrado. */
export function mensajeBloqueo(telefono: string | null): string {
  return telefono
    ? `Para agendar, comunícate con el consultorio: ${telefono}.`
    : 'Para agendar, comunícate con el consultorio.'
}

/**
 * D11 · no se pudo comprobar la ocupación al día (la sincronización previa
 * falló o tardó y la última buena es más vieja que la ventana tolerada).
 * ⚠️ No dice por qué: ni que la clínica tiene Google ni qué falló. Texto
 * PENDIENTE DE REVISIÓN (Angel).
 */
export function respuestaNoPorAhora(telefono: string | null): Respuesta {
  const mensaje = telefono
    ? `Por ahora no se puede reservar en línea. Para agendar, comunícate con el consultorio: ${telefono}.`
    : 'Por ahora no se puede reservar en línea. Para agendar, comunícate con el consultorio.'
  return { status: 503, cuerpo: { error: 'no_disponible_por_ahora', mensaje, telefono } }
}

/** El resultado de `reservar_por_enlace` (D3) traducido a HTTP. */
export function respuestaReserva(resultado: string, telefono: string | null): Respuesta {
  switch (resultado) {
    case 'ok': return { status: 201, cuerpo: { estado: 'reservada' } }
    case 'repetida': return { status: 200, cuerpo: { estado: 'reservada' } }
    case 'ocupado': return { status: 409, cuerpo: { error: 'turno_ocupado' } }
    case 'ya_tiene_cita': return { status: 409, cuerpo: { error: 'ya_tiene_cita', mensaje: mensajeBloqueo(telefono) } }
    case 'bloqueado': return { status: 403, cuerpo: { error: 'autoservicio_cerrado', mensaje: mensajeBloqueo(telefono), telefono } }
    case 'correo_sin_verificar': return { status: 403, cuerpo: { error: 'correo_sin_verificar' } }
    case 'enlace_usado': return { status: 410, cuerpo: { error: 'enlace_usado' } }
    case 'enlace_caducado': return { status: 410, cuerpo: { error: 'enlace_caducado' } }
    case 'fuera_de_ventana': return { status: 400, cuerpo: { error: 'fuera_de_ventana' } }
    case 'consultorio_invalido': return { status: 400, cuerpo: { error: 'consultorio_invalido' } }
    case 'tipo_invalido': return { status: 400, cuerpo: { error: 'tipo_invalido' } }
    // E6 (reagendar): el tope y «ya reagendada» se dicen; reagendar_invalido es el 404 uniforme de abajo.
    case 'tope_reagendados': return { status: 403, cuerpo: { error: 'tope_reagendados', mensaje: mensajeBloqueo(telefono), telefono } }
    case 'ya_reagendada': return { status: 409, cuerpo: { error: 'ya_reagendada' } }
    // enlace_invalido, apagado, aviso_no_aprobado, clinica_sin_acceso, reagendar_invalido y cualquier otro: 404 uniforme.
    default: return NO_ENCONTRADO
  }
}

/** Un error de la RPC (código SQL o de PostgREST) traducido a HTTP. */
export function respuestaErrorRpc(ausente: boolean, codigo: string | null): Respuesta {
  if (ausente) return NO_ENCONTRADO
  // 22023: argumentos con forma inválida; 23505: ese client_id ya lo usó otra cita.
  if (codigo === '22023' || codigo === '23505') return { status: 400, cuerpo: { error: 'solicitud_invalida' } }
  return { status: 500, cuerpo: { error: 'no_disponible' } }
}

/** El resultado de `reserva_codigo_verificar` traducido a HTTP (sin la ficha, que pone la ruta). */
export function respuestaVerificacion(resultado: string): Respuesta {
  switch (resultado) {
    case 'ok': return { status: 200, cuerpo: { estado: 'verificado' } }
    case 'incorrecto': return { status: 400, cuerpo: { error: 'codigo_incorrecto' } }
    case 'caducado': return { status: 410, cuerpo: { error: 'codigo_caducado' } }
    case 'agotado': return { status: 429, cuerpo: { error: 'codigo_agotado' } }
    case 'sin_codigo': return { status: 400, cuerpo: { error: 'sin_codigo' } }
    default: return { status: 500, cuerpo: { error: 'no_disponible' } }
  }
}
