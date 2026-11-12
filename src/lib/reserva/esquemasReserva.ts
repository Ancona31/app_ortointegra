/**
 * esquemasReserva.ts — la forma de lo que entra por las rutas públicas de la
 * reserva por enlace (agenda D5). `strictObject`: una clave de más es 400.
 * Lo que dice el navegador nunca decide nada por sí solo: el servidor vuelve
 * a calcular turnos, ventana y candado.
 */
import { z } from 'zod'

const UUID = z.guid()
const FECHA = z.iso.date()

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
  nombre: z.string().trim().min(1).max(120),
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
