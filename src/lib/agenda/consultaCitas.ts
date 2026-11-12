/**
 * src/lib/agenda/consultaCitas.ts
 *
 * La consulta de citas de un rango, tal como la hace `GET /api/appointments`.
 * Salió de la ruta (A1.4b) para que la página de la agenda pueda sembrar la
 * primera pintura desde el servidor (A1.4c) con EXACTAMENTE la misma consulta:
 * mismo `select`, mismos filtros, mismo `count` y mismo `incompleta`.
 *
 * ⚠️ MÓDULO DE SERVIDOR. Sin `'use client'`, y nadie del cliente lo importa
 * salvo con `import type`.
 *
 * ⚠️⚠️ RECIBE EL CLIENTE DE SESIÓN, NUNCA `createAdminClient()`. Lo que esto
 * devuelve viaja al navegador tal cual —por la API o por la semilla—, y la
 * única barrera entre clínicas es la RLS más el `eq('clinica_id')` de abajo,
 * que es explícito aunque la RLS ya filtre (pendiente prioritario de
 * `CLAUDE.md`). Con el cliente de servicio la RLS no aplica.
 */
import type { createClient } from '@/lib/supabase/server'
import { APPOINTMENT_SELECT } from '@/lib/appointments'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

export interface ParametrosConsultaCitas {
  clinicaId: string
  /** Inicio de la ventana (inclusivo por `end_time`); `null` = sin corte. */
  from: string | null
  /** Fin EXCLUSIVO de la ventana (por `start_time`); `null` = sin corte. */
  to: string | null
  /** `null` o `''` = todos los médicos. */
  medicoId: string | null
}

export type ResultadoConsultaCitas<F> =
  | { ok: true; appointments: F[]; incompleta: boolean }
  | { ok: false; error: string }

/** La consulta sin ejecutar: `select`, clínica, orden, médico y ventana.
 *  ⚠️ `partirSemilla` (`semillaCitas.ts`) repite el criterio de la ventana al
 *  partir la semilla en semanas: si cambia aquí, cambia allí. */
function construirConsulta(supabase: ClienteSesion, { clinicaId, from, to, medicoId }: ParametrosConsultaCitas) {
  /* El `count: 'exact'` NO es una métrica: es la guarda del truncado, y su
     porqué entero está abajo, junto al `incompleta` que lo consume. */
  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT, { count: 'exact' })
    .eq('clinica_id', clinicaId)
    .order('start_time', { ascending: true })

  if (medicoId) query = query.eq('medico_id', medicoId)

  /* ⚠️⚠️ LA VENTANA SE COMPARA POR SOLAPE, NO POR `start_time` DENTRO DEL RANGO,
     Y ESTO ES UNA CORRECCIÓN, NO UN AFINADO. Filtrando por el inicio —que es lo
     que había— una fila que EMPEZÓ ANTES de `from` y sigue viva dentro de la
     ventana no se devolvía, así que un evento de VARIOS DÍAS desaparecía de
     todas las semanas menos la que lo inicia. Un congreso de lunes a lunes se
     veía la primera semana y no la segunda, sin error y sin hueco: simplemente
     no estaba.

     No lo tapaba `rangoQuePedir`: ése encaja la petición a semanas naturales, y
     en vista Semana el borde ya ES el lunes, o sea margen cero.

     ES EL MISMO CRITERIO QUE /api/google/events, donde está argumentado desde
     el principio: «filtrar las citas sólo por su inicio dejaría fuera del
     conjunto a la que empezó antes de `timeMin` y termina dentro». Allí el
     síntoma era otro —una cita sin restar, que salía duplicada como evento
     crudo— pero la causa es la misma y la cura también. Hasta ahora las dos
     rutas leían la misma tabla con dos reglas distintas.

     ⚠️ POR QUÉ EL CORTE DE ARRIBA ES ESTRICTO Y EL DE ABAJO NO. `to` es un fin
     EXCLUSIVO —lo manda FullCalendar y lo ensancha `rangoQuePedir`—, así que una
     cita que empieza justo en `to` cae FUERA de la ventana por definición: con
     `lte` se traía una fila que la vista no llega a pintar. Con `lt` no.
     Abajo se queda inclusivo a propósito: `end_time = from` también está fuera,
     pero en `appointments` NO existe un CHECK incondicional de
     `end_time > start_time` (sólo lo hay para las filas de todo el día), así que
     pueden quedar filas heredadas de duración cero; con un `gt` estricto una de
     ellas apoyada en el borde desaparecería. Esta consulta es la RED GRUESA: se
     permite una fila de más, que no cuesta nada. El corte fino lo hacen el
     propio FullCalendar al pintar y `contarVisibles` en el cliente, que sí
     aplica el solape estricto — ver su nota, que es la otra mitad de esto.

     ⚠️ LAS DOS PUNTAS SON OBLIGATORIAS Y VAN EN EL MISMO SENTIDO: `start_time`
     contra el FIN de la ventana y `end_time` contra su INICIO. Cruzadas, o con
     las dos contra `start_time`, se vuelve al fallo. */
  if (to)   query = query.lt('start_time', to)
  if (from) query = query.gte('end_time', from)
  return query
}

/**
 * ⚠️ `F` NO SE COMPRUEBA: la forma la fija `APPOINTMENT_SELECT`. El cliente de
 * Supabase no lleva el genérico `Database` (ver `(app)/layout.tsx`), así que las
 * filas llegan sin tipo y quien llama dice qué espera, igual que el cliente lo
 * dice al leer `res.json()`. La ruta no elige ninguno: las reenvía tal cual.
 *
 * ⚠️ B6: `tipo_cita_id` y `tipo_cita_nombre` llegan por el `*` de
 * `APPOINTMENT_SELECT` cuando existen, y por eso son OPCIONALES en
 * `Appointment`. NO LOS NOMBRES AQUÍ: esta consulta corre con el interruptor
 * apagado, y en una base sin la migración 20261112150000 PostgREST contestaría
 * 400 y la agenda no cargaría.
 */
export async function consultaCitas<F = unknown>(
  supabase: ClienteSesion,
  parametros: ParametrosConsultaCitas,
): Promise<ResultadoConsultaCitas<F>> {
  const { clinicaId, from, to } = parametros
  const { data, error, count } = await construirConsulta(supabase, parametros)
  if (error) return { ok: false, error: error.message }

  const filas: F[] = data ?? []

  /* ⚠️⚠️ `incompleta` ES LO ÚNICO QUE SEPARA «no hay citas» DE «no llegaron
     las citas», Y NO SE PUEDE DEDUCIR DESDE EL CLIENTE.

     El techo de filas del proveedor es DURO y GLOBAL —mil por respuesta—: no
     se sube desde la consulta y, al alcanzarlo, la respuesta llega RECORTADA
     sin error, sin cabecera de aviso y con un array perfectamente válido.

     ⚠️ Y LA FORMA DEL RECORTE ES LA PEOR POSIBLE, POR EL `.order()` DE
     ARRIBA. Se queda con las mil PRIMERAS por fecha, así que un mes cargado
     vuelve con las dos primeras semanas llenas y el resto EN BLANCO. No hay
     error que pintar, no hay hueco que se vea, y la banda de vacío tampoco
     sale porque el conteo no es cero. Parecen semanas libres de verdad, y
     encima de una de ellas se puede agendar encima de una cita que existe.

     ⚠️ NO LO "ARREGLES" CON UN `.limit()`. Un límite propio no supera el
     techo: sólo lo baja. La vía es saber CUÁNTAS había, no pedir menos.

     `count: 'exact'` viene del `Content-Range` y cuenta las filas que CUMPLEN
     el filtro, no las que caben en la respuesta. Si sobran, faltan.

     El `count === null` cuenta como incompleta A PROPÓSITO: sin conteo no se
     puede afirmar que la traída esté entera, y entre avisar de más y callarse
     de menos, este defecto se diagnostica tarde precisamente por lo segundo.
     El coste de equivocarse hacia aquí es una banda visible que alguien
     reporta el primer día; el de equivocarse hacia el otro lado es la agenda
     en blanco de arriba. */
  const incompleta = count === null || count > filas.length
  if (incompleta) {
    logger.warn(
      'agenda',
      `traída de citas incompleta: la clínica ${clinicaId} tiene ${count ?? 'un conteo que no llegó'} citas en [${from ?? 'sin from'}, ${to ?? 'sin to'}] y llegaron ${filas.length}`,
    )
  }

  return { ok: true, appointments: filas, incompleta }
}
