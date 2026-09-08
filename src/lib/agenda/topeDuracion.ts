/**
 * topeDuracion.ts — el techo de duración de una fila de `appointments`.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 * La única regla de rango que había era «el fin después del inicio». Los campos
 * de fecha del modal son `<input type="date">` nativos, y el año es un segmento
 * numérico libre: un dedazo escribe 2027 donde iba 2026 sin que nada se queje, y
 * la fila resultante SE SOLAPA CON TODAS LAS SEMANAS de la agenda para siempre.
 * No rompe nada —se pinta— así que nadie la ve hasta que la agenda es inusable.
 *
 * ── LOS DOS TOPES, Y POR QUÉ SON DISTINTOS ─────────────────────────────────
 * Se discrimina por `paciente_id`, que es el único discriminador que hay
 * (`paciente_id` no nulo = cita; nulo = evento genérico, §12.14).
 *
 *   · CITA (con paciente): 10 horas. Una consulta larga es de 4 h en producción
 *     hoy, y el máximo histórico de las 147 citas es exactamente 4,00 h.
 *   · EVENTO GENÉRICO (sin paciente): un año. Cubre vacaciones, guardias y
 *     bloqueos largos; el más largo que existe hoy son 18 días.
 *
 * ⚠️ LOS EVENTOS DE GOOGLE NO NECESITAN EXENCIÓN, Y NO SE LES DA NINGUNA.
 * No pasan por aquí porque NUNCA SE INSERTAN en `appointments`:
 * `/api/google/events` es un paso a través de solo lectura que los devuelve al
 * cliente y sólo consulta la tabla para restar los que ya son citas. Las 154
 * filas de producción tienen `origen = 'spinus'`. Si algún día se importaran de
 * verdad, ESE es el momento de decidir si se les exime, y el sitio para hacerlo
 * es el llamador, no este módulo.
 *
 * ── EL CONVENIO DE FIN EXCLUSIVO, QUE ES LO QUE HACE QUE EL AÑO SEAN 366 ────
 * `appointments.end_time` de una fila `all_day` es la medianoche del día
 * SIGUIENTE al último incluido (ver el `COMMENT ON COLUMN` de
 * `20260826_agenda_all_day.sql:538`). Un evento de UN SOLO DÍA mide 24 h
 * exactas, y uno que cubre 365 días mide 366 días de punta a punta.
 *
 * Por eso `TOPE_EVENTO_MS` son 366 días y no 365: con 365 se rechazaría un
 * evento de un año completo por el desfase del día exclusivo, que es
 * precisamente el caso legítimo que el tope tiene que dejar pasar.
 *
 * ⚠️ EL BORDE QUE ESTO DEJA FUERA, DICHO EN VOZ ALTA: un evento de todo el día
 * que cubra un AÑO BISIESTO entero son 366 días cubiertos, o sea 367 de punta a
 * punta, y ESTE TOPE LO RECHAZA. Es un día de más sobre lo pedido —«un año»— y
 * se deja así a propósito en vez de subirlo a 367: el rechazo es visible y con
 * mensaje, mientras que cada día de holgura es un dedazo de año que se cuela.
 * Si algún día molesta, se sube aquí y en ningún otro sitio.
 *
 * ⚠️ Y LO QUE ESTE TOPE NO ATRAPA, para que nadie lo crea más fuerte de lo que
 * es: un dedazo de UN año EXACTO en un evento genérico (2026 → 2027) da 365
 * días y PASA. El tope de los eventos es una red contra el disparate —2026 →
 * 2062—, no contra el error de un dígito. Quien de verdad protege el caso común
 * es el tope de la CITA, que es donde vive el 95 % de las filas.
 *
 * ── DÓNDE VIVE LA BARRERA ──────────────────────────────────────────────────
 * En los dos route handlers, y sólo ahí: `POST /api/appointments` y
 * `PUT /api/appointments/[id]`. NO hay CHECK en la base —eso es otra pieza, con
 * su propia auditoría y su pre-vuelo— así que una escritura directa por
 * PostgREST se lo salta, igual que ya se salta la comprobación de orden.
 */

/** Horas máximas de una cita con paciente. */
export const TOPE_CITA_HORAS = 10

/** Días que un evento genérico puede CUBRIR. El fin exclusivo suma uno más. */
export const TOPE_EVENTO_DIAS = 365

const UNA_HORA_MS = 3_600_000
const UN_DIA_MS = 24 * UNA_HORA_MS

export const TOPE_CITA_MS = TOPE_CITA_HORAS * UNA_HORA_MS

/** Los 365 días cubiertos MÁS el día del fin exclusivo. Ver la cabecera. */
export const TOPE_EVENTO_MS = (TOPE_EVENTO_DIAS + 1) * UN_DIA_MS

/**
 * La forma de respuesta que ya usan `rango_invalido` y
 * `todo_el_dia_con_paciente` en las dos rutas. Se respeta letra por letra
 * porque los tres caminos de interfaz —modal, arrastre y redimensión— pintan
 * `message` tal cual, así que un código nuevo se ve solo, sin tocar el cliente.
 */
export type ErrorDeTope = { error: 'duracion_excesiva'; message: string }

/**
 * ¿La fila excede su tope? Devuelve el error listo para `NextResponse.json`, o
 * `null` si cabe.
 *
 * ⚠️ NO COMPRUEBA EL ORDEN, y no es un olvido: de eso se encarga la validación
 * que ya existe en las dos rutas, ANTES de llamar aquí. Un rango invertido da
 * una duración negativa, que es menor que cualquier tope y pasa por aquí sin
 * decir nada — correcto, porque ya lo rechazó quien va delante. Si algún día
 * esta función se llama sin esa comprobación delante, hay que revisarlo.
 *
 * @param inicio       `start_time` tal como se va a guardar.
 * @param fin          `end_time` tal como se va a guardar (exclusivo si es de
 *                     todo el día).
 * @param tienePaciente `true` = cita (tope de horas); `false` = evento genérico
 *                     (tope de un año).
 */
export function comprobarTopeDuracion(
  inicio: string | Date,
  fin: string | Date,
  tienePaciente: boolean,
): ErrorDeTope | null {
  const desde = inicio instanceof Date ? inicio.getTime() : new Date(inicio).getTime()
  const hasta = fin instanceof Date ? fin.getTime() : new Date(fin).getTime()

  /* Una fecha ilegible NO se rechaza aquí. `new Date('vaya')` da NaN y toda
     comparación con NaN es falsa, así que esto devolvería `null` igualmente;
     se sale antes para que quede escrito que es deliberado y no un descuido de
     la aritmética. Quien valida la forma de las puntas es la ruta, delante. */
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return null

  const duracion = hasta - desde

  if (tienePaciente && duracion > TOPE_CITA_MS) {
    return {
      error: 'duracion_excesiva',
      message: `Una cita no puede durar más de ${TOPE_CITA_HORAS} horas. Revisa la fecha de fin: un año o un día equivocado la alarga sin que se vea.`,
    }
  }

  if (!tienePaciente && duracion > TOPE_EVENTO_MS) {
    return {
      error: 'duracion_excesiva',
      message: `Un evento no puede durar más de un año. Revisa la fecha de fin: un año equivocado lo alarga sin que se vea, y queda cruzando toda la agenda.`,
    }
  }

  return null
}
