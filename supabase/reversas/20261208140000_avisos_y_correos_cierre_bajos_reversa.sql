-- ══════════════════════════════════════════════════════════════════
-- REVERSA de BASE-2 · B3 (20261208140000_avisos_y_correos_cierre_bajos.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ══════════════════════════════════════════════════════════════════
-- QUÉ HACE: devuelve public.avisos_transaccion_mas_antigua() a su cuerpo de MA,
--   byte a byte (COPIADO de 20261203130000), con su EXECUTE para authenticated;
--   devuelve aviso_visto_hasta_sellar() a SECURITY INVOKER; y deja los
--   comentarios como estaban (el de MA, el de F4 en cita_recordatorios_pendientes,
--   y ninguno en cita_correo_tomar ni en el disparador).
-- QUÉ VUELVE: MA 1 (la lectura congelada de pg_stat_activity en la segunda
--   llamada de una transacción) y MA 2 (cualquier sesión puede llamarla).
-- QUÉ NO VUELVE: nada que deshacer; B3 no toca filas.
-- ORDEN EN LA CADENA: antes que la de MA. Si MA ya se deshizo (su reversa borra
--   la función y devuelve el disparador a INVOKER), aquí sólo quedan los dos
--   comentarios de correos. Independiente de B1 y B2.
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada distinto y sale bien.
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
END $$;

-- Los comentarios de correos, como los dejó F4 (R1 no los tocó).
DO $$
BEGIN
  IF to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)') IS NOT NULL THEN
    COMMENT ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) IS NULL;
  END IF;
  IF to_regprocedure('public.cita_recordatorios_pendientes(integer)') IS NOT NULL THEN
    COMMENT ON FUNCTION public.cita_recordatorios_pendientes(integer) IS
      'Listado ENTRE CLÍNICAS de recordatorios por mandar (sólo ids), para /api/cron/recordatorios. Sólo clínicas con la agenda v2 encendida, la puerta S3 (gcal_sync_clinica_habilitada) y el interruptor agenda_ajustes.recordatorio_encendido. CONVENIO: la expresión del destinatario va junta con la de cita_correo_tomar.';
  END IF;
END $$;

-- Las dos de avisos, sólo si MA sigue aplicada.
DO $do$
BEGIN
  IF to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NULL THEN
    RAISE NOTICE 'MA ya está deshecha: no hay función de avisos que devolver.';
    RETURN;
  END IF;
  CREATE OR REPLACE FUNCTION public.avisos_transaccion_mas_antigua()
 RETURNS timestamptz
 LANGUAGE sql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT min(s.xact_start)
    FROM pg_catalog.pg_stat_activity s
   WHERE s.datname = pg_catalog.current_database()
     AND s.pid <> pg_catalog.pg_backend_pid()
     AND s.xact_start IS NOT NULL
     AND s.backend_type NOT LIKE 'autovacuum%' AND s.backend_type <> 'walsender'
$function$;
  REVOKE EXECUTE ON FUNCTION public.avisos_transaccion_mas_antigua() FROM PUBLIC, anon, service_role;
  GRANT  EXECUTE ON FUNCTION public.avisos_transaccion_mas_antigua() TO authenticated;
  COMMENT ON FUNCTION public.avisos_transaccion_mas_antigua() IS
    'Avisos globales (MA): el inicio de la transacción abierta más antigua de esta base (sin la propia, autovacuum ni replicación), o NULL. La usa aviso_visto_hasta_sellar para que «Marcar todos» no adelante a un aviso cuya transacción aún no confirmó. SECURITY DEFINER a propósito: la sesión no ve el xact_start de las demás. Sólo devuelve un instante.';
  ALTER FUNCTION public.aviso_visto_hasta_sellar() SECURITY INVOKER;
  COMMENT ON FUNCTION public.aviso_visto_hasta_sellar() IS NULL;
  IF (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = 'public.avisos_transaccion_mas_antigua()'::regprocedure)
       <> '10bb6aac66d280186c632a078f607db7'
     OR NOT has_function_privilege('authenticated', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.aviso_visto_hasta_sellar()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: las funciones de avisos no quedaron como las dejó MA.';
  END IF;
END $do$;

COMMIT;

SELECT 1 AS n, 'avisos_transaccion_mas_antigua con el cuerpo de MA (md5) y authenticated la ejecuta; el disparador, INVOKER (o MA deshecha)' AS comprobacion,
       coalesce((SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                   FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_transaccion_mas_antigua()'))
                || ' / ' || (SELECT (NOT prosecdef)::text FROM pg_proc WHERE oid = to_regprocedure('public.aviso_visto_hasta_sellar()')), 'MA deshecha') AS valor,
       '10bb6aac66d280186c632a078f607db7 / true / true (o «MA deshecha»)' AS esperado;
