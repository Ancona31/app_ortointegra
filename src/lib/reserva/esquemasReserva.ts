/**
 * esquemasReserva.ts — la forma de lo que entra por las rutas públicas de la
 * reserva por enlace (agenda D5). `strictObject`: una clave de más es 400.
 * Lo que dice el navegador nunca decide nada por sí solo: el servidor vuelve
 * a calcular turnos, ventana y candado.
 */
import { z } from 'zod'

const UUID = z.guid()
const FECHA = z.iso.date()

/**
 * seg1 (punto 7b de Angel): el nombre de quien reserva llega al TÍTULO del
 * evento de Google («Cita médica: {nombre}», `googleReserva.ts`) y al de la
 * cita. Para que no pueda colar texto engañoso:
 *   · 80 caracteres como máximo: un nombre con dos apellidos rara vez pasa de
 *     60, y Google corta el título en la rejilla mucho antes; 120 (lo de D5)
 *     daba sitio para una frase entera;
 *   · sin saltos de línea ni caracteres de control o de formato (`\p{Cc}`,
 *     `\p{Cf}`: tabuladores, RTL override, espacios de ancho cero) ni
 *     separadores de línea o párrafo;
 *   · sin URLs ni dominios: `://`, `www.` o `algo.tld` (letra o dígito, punto
 *     y dos letras SEGUIDAS, sin espacio). «Ma. Guadalupe» pasa;
 *     «Ma.Guadalupe» no, y se acepta.
 * Lo que no cumple es el mismo 400 `solicitud_invalida` de cualquier forma
 * inválida. La base no lo repite (reservar_por_enlace sólo mira ≤ 120).
 */
export const NOMBRE_MAX = 80
const CONTROL_O_FORMATO = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u
const URL_O_DOMINIO = /:\/\/|www\.|[\p{L}\p{N}]\.\p{L}{2,}/iu

/** ¿Puede ir este nombre (ya recortado) al título de una cita y de Google? */
export function nombreSeguro(nombre: string): boolean {
  return !CONTROL_O_FORMATO.test(nombre) && !URL_O_DOMINIO.test(nombre)
}

/** GET /api/reservar/[codigo]/turnos?consultorio=&tipo=&desde= */
export const TurnosQuerySchema = z.strictObject({
  consultorio: UUID,
  tipo: UUID,
  desde: FECHA,
})

/** POST /api/reservar/[codigo]/codigo */
export const PedirCodigoSchema = z.strictObject({
  correo: z.string().trim().min(3).max(254),
})

/** POST /api/reservar/[codigo]/verificar */
export const VerificarCodigoSchema = z.strictObject({
  correo: z.string().trim().min(3).max(254),
  codigo: z.string().regex(/^[0-9]{6}$/),
})

/** POST /api/reservar/[codigo] */
export const ReservarSchema = z.strictObject({
  consultorio_id: UUID,
  tipo_cita_id: UUID,
  /** Instante ISO con zona (`Z` u offset): el de un turno ofrecido. */
  inicio: z.iso.datetime({ offset: true }),
  nombre: z.string().trim().min(1).max(NOMBRE_MAX).refine(nombreSeguro),
  telefono: z.string().trim().min(10).max(20),
  correo: z.string().trim().min(3).max(254),
  /** Sólo el enlace fijo: la ficha que devolvió /verificar. */
  ficha: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  /** La casilla del aviso. Sin `true` no se reserva. */
  acepta_aviso: z.literal(true),
  /** Idempotencia: el mismo envío repetido devuelve la misma cita. */
  client_id: UUID,
  /**
   * Agenda E6: el código del enlace de CONFIRMACIÓN de la cita que la persona
   * canceló y reagenda (de `/reservar/<fijo>?origen=`). La base lo valida
   * (`reagendar_por_enlace`); aquí sólo la forma.
   */
  origen: z.string().regex(/^[A-Za-z0-9_-]{22}$/).optional(),
})

export type ReservarEntrada = z.infer<typeof ReservarSchema>
