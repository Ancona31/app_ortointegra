-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M4 (20261204120000_reserva_purga_y_tope.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: borra public.reserva_purgar(integer) y los tres índices, y devuelve
--   reserva_codigo_emitir al cuerpo de F3, byte a byte (el bloque de abajo está
--   COPIADO de 20261201140000_agenda_f3_reserva_enlace.sql; su huella es la que
--   exige el pre-vuelo de M4).
-- QUÉ VUELVE: AG-DT-274 (los códigos de la reserva y los intentos de los
--   límites dejan de purgarse; el tope de emisión vuelve a vivir sólo en la app).
--   La tarea /api/cron/purga-reserva recibe PGRST202 y contesta 500 hasta que se
--   quite de vercel.json o se vuelva a aplicar M4.
-- QUÉ NO VUELVE: lo ya purgado (códigos, intentos) ni los correos ya vaciados.
-- ORDEN EN LA CADENA: antes que la de F3. Respecto de M5, MA y M3 es indiferente.
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada distinto y sale bien (IF EXISTS, CREATE OR REPLACE).
-- Bloqueos: ACCESS EXCLUSIVE breve sobre reserva_verificaciones e ip_rate_limits
--   (DROP INDEX), en el último bloque.
-- Ensayo: stack local, 2026-11-25: ida, reversa, ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.reserva_verificaciones') IS NULL
     OR to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no están los objetos de F3 (ya deshecha): esta reversa no tiene nada que devolver.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserva_codigo_emitir(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL
     OR p_correo_hmac !~ '^[0-9a-f]{64}$' OR p_codigo_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_enlaces e
                  WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL
                    AND public.agenda_v2_encendida(e.clinica_id))
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN 'enlace_invalido';
  END IF;
  UPDATE public.reserva_verificaciones SET intentos = 5
   WHERE clinica_id = p_clinica_id AND enlace_id = p_enlace_id AND correo_hmac = p_correo_hmac
     AND verificado_en IS NULL AND intentos < 5;
  -- clock_timestamp(): dos códigos pedidos en la misma transacción no empatan
  -- en created_at, que es por donde verificar elige el último.
  INSERT INTO public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
  VALUES (p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, now() + interval '10 minutes', clock_timestamp());
  RETURN 'ok';
END
$fn$;

DROP FUNCTION IF EXISTS public.reserva_purgar(integer);

DO $$
BEGIN
  DROP INDEX IF EXISTS public.reserva_verificaciones_created_at_idx;
  DROP INDEX IF EXISTS public.reserva_verificaciones_correo_idx;
  DROP INDEX IF EXISTS public.ip_rate_limits_created_at_idx;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_purgar y los tres índices que quedan' AS comprobacion,
         ((to_regprocedure('public.reserva_purgar(integer)') IS NOT NULL)::int
          + (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
               AND relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')))::text AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'reserva_codigo_emitir: cuerpo de F3; quién la ejecuta (anon/authenticated/service_role)',
         (SELECT (md5(replace(p.prosrc, E'\r\n', E'\n')) = '3885430cced1c390068f8c6a168d0ddb')::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')),
         'true ; false/false/true'
) t
ORDER BY t.n;
