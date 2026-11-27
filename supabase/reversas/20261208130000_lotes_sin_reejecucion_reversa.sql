-- ══════════════════════════════════════════════════════════════════
-- REVERSA de BASE-2 · B2 (20261208130000_lotes_sin_reejecucion.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ══════════════════════════════════════════════════════════════════
-- QUÉ HACE: devuelve public.reserva_purgar(integer) y
--   public.reserva_empalmes_pendientes_procesar(uuid, integer) a su cuerpo de M4
--   y de M5, byte a byte (los dos bloques de abajo están COPIADOS de
--   20261204120000 y 20261205120000; sus huellas son las que exige el pre-vuelo
--   de B2).
-- QUÉ VUELVE: el defecto: con el plan «Nested Loop Semi Join» una pasada puede
--   llevarse más filas que el lote (docs/spec/base-2/INFORME-LOTES.md).
-- QUÉ NO VUELVE: nada que deshacer; B2 no toca filas.
-- ORDEN EN LA CADENA: antes que las de M5 y M4 (que BORRAN estas funciones: si
--   ya se deshicieron, esta reversa se niega). Independiente de B1 y B3.
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada distinto y sale bien (CREATE OR REPLACE).
-- Bloqueos: sólo catálogo.
-- Ensayo: stack local, 2026-11-27: ida, reversa, ida otra vez.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que correrla como postgres (current_user es %).', current_user;
  END IF;
  IF to_regprocedure('public.reserva_purgar(integer)') IS NULL OR to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no están las funciones de M4 o de M5 (ya deshechas): esta reversa no tiene nada que devolver.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserva_purgar(p_lote integer DEFAULT 5000)
 RETURNS TABLE (r_verificaciones integer, r_limites integer, r_correos integer, r_quedan boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '2s'
AS $function$
DECLARE
  c_plazo CONSTANT interval := interval '30 days';
  v_lote  integer := least(greatest(coalesce(p_lote, 5000), 1), 5000);
  v_corte timestamptz := now() - c_plazo;
BEGIN
  -- a) Códigos de verificación de la reserva.
  DELETE FROM public.reserva_verificaciones v
   WHERE v.id IN (SELECT x.id FROM public.reserva_verificaciones x
                   WHERE x.created_at < v_corte AND x.caduca_en < now()
                     AND (x.ficha_caduca_en IS NULL OR x.ficha_caduca_en < now())
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS r_verificaciones = ROW_COUNT;
  -- b) Intentos contados para los límites.
  DELETE FROM public.ip_rate_limits l
   WHERE l.id IN (SELECT x.id FROM public.ip_rate_limits x
                   WHERE x.created_at < v_corte
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS r_limites = ROW_COUNT;
  -- c) El correo de los enlaces de un solo uso que dejaron de servir hace más de 30 días. SÓLO a NULL,
  --    SÓLO estas dos columnas, SÓLO únicos. (least() ignora los NULL: el primero de los cuatro instantes.)
  UPDATE public.reserva_enlaces e SET correo = NULL, correo_hmac = NULL
   WHERE e.id IN (SELECT x.id FROM public.reserva_enlaces x
                   WHERE x.clase = 'unico' AND x.correo IS NOT NULL
                     AND least(x.usado_en, x.revocado_en, x.agotado_en, x.caduca_en) < v_corte
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS r_correos = ROW_COUNT;
  r_quedan := greatest(r_verificaciones, r_limites, r_correos) >= v_lote;
  -- d) El registro de la pasada: sólo números.
  INSERT INTO public.audit_log (user_id, accion, tabla, descripcion)
  VALUES ('system', 'reserva_purga', 'reserva_verificaciones',
          jsonb_build_object('dias', 30, 'reserva_verificaciones', r_verificaciones, 'ip_rate_limits', r_limites,
                             'correos_de_enlaces_unicos', r_correos, 'quedan', r_quedan)::text);
  RETURN NEXT;
END
$function$;

CREATE OR REPLACE FUNCTION public.reserva_empalmes_pendientes_procesar(p_clinica_id uuid, p_limite integer DEFAULT 500)
 RETURNS TABLE (r_procesados integer, r_pares integer, r_quedan boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_lim integer := least(greatest(coalesce(p_limite, 500), 1), 500);
  v_ids uuid[];
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'reserva_empalmes_pendientes_procesar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  WITH tomados AS (
    DELETE FROM public.gcal_empalmes_pendientes p
     WHERE p.clinica_id = p_clinica_id
       AND p.cita_id IN (SELECT x.cita_id FROM public.gcal_empalmes_pendientes x
                          WHERE x.clinica_id = p_clinica_id
                          ORDER BY x.creado_en LIMIT v_lim FOR UPDATE SKIP LOCKED)
    RETURNING p.cita_id)
  SELECT coalesce(array_agg(t.cita_id), ARRAY[]::uuid[]) INTO v_ids FROM tomados t;
  r_procesados := cardinality(v_ids);
  r_pares := 0;
  IF r_procesados > 0 THEN
    r_pares := public.reserva_empalmes_registrar(p_clinica_id, v_ids);
  END IF;
  r_quedan := r_procesados >= v_lim;
  RETURN NEXT;
END
$function$;

DO $$
BEGIN
  IF (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')) <> '7952fee050cef1d7ed739a03a5793a2f'
     OR (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')) <> '5a5a1cb08484653cca01e178e1affa76' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: alguna de las dos no quedó con el cuerpo de M4 / M5.';
  END IF;
  IF has_function_privilege('anon', 'public.reserva_purgar(integer)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.reserva_purgar(integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: anon o authenticated ejecutan alguna de las dos.';
  END IF;
END $$;

COMMIT;

SELECT 1 AS n, 'las dos funciones con el cuerpo de M4 / M5 (md5: purgar / procesar)' AS comprobacion,
       (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')) || ' / '
       || (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')) AS valor,
       '7952fee050cef1d7ed739a03a5793a2f / 5a5a1cb08484653cca01e178e1affa76' AS esperado;
