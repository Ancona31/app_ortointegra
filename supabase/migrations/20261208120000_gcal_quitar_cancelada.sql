-- ════════════════════════════════════════════════════════════════════════
-- Agenda · BASE-2 · B1 — quitar de la agenda la cita CANCELADA cuyo evento se
-- borró en Google, por una función de la base (cierra y desvincula a la vez)
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-27
-- Guion: docs/spec/base-2/ENSAYO.md
-- ────────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-27, stack local de Supabase (CLI 2.117.0) con las 21
--   migraciones de main: aplicada, deshecha con su reversa y vuelta a aplicar;
--   prueba gq1_gcal_quitar_cancelada.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- DECISIÓN DE ANGEL (2026-11-27): si en Google se borra el evento de una cita ya
--   CANCELADA, Spinus la quita de la agenda (la CIERRA, como «Eliminar cita») y
--   la desvincula. El código lo hacía con una consulta directa a `appointments`
--   desde la sincronización (la única; commit d08ad0a3) seguida de
--   gcal_aplicar_evento: dos pasos. Angel decidió que lo correcto es UNA función
--   de la base, y que la sincronización vuelva a no tener ninguna consulta
--   directa a una tabla.
--
-- QUÉ HACE: crea public.gcal_cita_quitar_cancelada(p_clinica_id, p_cita_id,
--   p_calendar_id, p_google_event_id), INVOKER, sólo service_role. En UNA
--   sentencia cierra (cerrada_en) y desvincula (google_event_id, gcal_calendar_id
--   y gcal_etag a NULL, gcal_sync_status 'unbound') la cita si y sólo si:
--     · es de esa clínica, está CANCELADA y sigue ligada a ESE evento (y, si
--       tiene calendario, a ESE calendario);
--     · la v2 está encendida y la conexión activa de la clínica es la de ese
--       calendario (las dos puertas de gcal_aplicar_evento).
--   Devuelve (r_cerrada, r_desvinculada): si ESTA llamada la cerró (false si ya
--   estaba cerrada) y si la desvinculó. Idempotente: la segunda llamada ya no la
--   encuentra ligada y devuelve (false, false) sin escribir.
--   NO cambia estado, hora, título, notas ni updated_at. NO borra nada.
--
-- LO QUE NO TOCA: cita_proteger_cierre() (F5b) sigue igual y sigue mandando:
--   sólo deja a service_role cerrar una cancelada. gcal_aplicar_evento no
--   cambia. «Eliminar cita» (POST /api/appointments/[id]/quitar) no cambia.
--
-- Depende de: F2 (20261201150000: columnas gcal_* y clinica_conexiones_google),
--   F5b (20261201170000: cerrada_en y cita_proteger_cierre) y M3
--   (agenda_v2_encendida(uuid) existe desde F1).
-- Bloqueos: sólo catálogo (CREATE FUNCTION). No toca filas.
-- ⚠️ ORDEN DE DESPLIEGUE: ESTA MIGRACIÓN ANTES QUE EL CÓDIGO que la llama. Antes
--   del código no hace nada (nadie la llama). El código sin ella: ver ENSAYO.md §3.
-- Riesgo: BAJO. Una función nueva; ninguna existente cambia.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261208120000_gcal_quitar_cancelada_reversa.sql
-- Prueba: supabase/pruebas-sql/gq1_gcal_quitar_cancelada.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %).', current_user;
  END IF;
  IF to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada. No se repite.';
  END IF;
  IF to_regclass('public.clinica_conexiones_google') IS NULL
     OR to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL
     OR to_regprocedure('public.cita_proteger_cierre()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan objetos de F1, F2 o F5b (agenda_v2_encendida, clinica_conexiones_google, cita_proteger_cierre).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
         AND attname IN ('clinica_id', 'status', 'cerrada_en', 'google_event_id', 'gcal_calendar_id', 'gcal_etag', 'gcal_sync_status')) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.appointments no tiene las columnas que nombra esta migración.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.clinica_conexiones_google'::regclass AND NOT attisdropped
         AND attname IN ('clinica_id', 'rol', 'estado', 'calendar_id')) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.clinica_conexiones_google no tiene las columnas que nombra esta migración.';
  END IF;
  -- El disparador que hace valer «sólo una cancelada, sólo el servidor» tiene que estar puesto y encendido.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass AND NOT t.tgisinternal
                    AND t.tgfoid = 'public.cita_proteger_cierre()'::regprocedure AND t.tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el disparador de cita_proteger_cierre() no está en appointments o está apagado.';
  END IF;
END $$;

CREATE FUNCTION public.gcal_cita_quitar_cancelada(p_clinica_id uuid, p_cita_id uuid, p_calendar_id text, p_google_event_id text)
 RETURNS TABLE (r_cerrada boolean, r_desvinculada boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_cerrada_en timestamptz;
BEGIN
  r_cerrada := false;
  r_desvinculada := false;
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL
     OR length(p_calendar_id) > 1024 OR length(p_google_event_id) > 1024 THEN
    RAISE EXCEPTION 'gcal_cita_quitar_cancelada: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- Las mismas dos puertas que gcal_aplicar_evento: v2 encendida y la conexión activa de ESE calendario.
  IF NOT public.agenda_v2_encendida(p_clinica_id)
     OR NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                     WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                       AND g.calendar_id = p_calendar_id) THEN
    RETURN NEXT;
    RETURN;
  END IF;
  -- SÓLO una cancelada, de ESA clínica, que sigue ligada a ESE evento. Se bloquea la fila antes de escribir.
  SELECT a.cerrada_en INTO v_cerrada_en
    FROM public.appointments a
   WHERE a.id = p_cita_id
     AND a.clinica_id = p_clinica_id
     AND a.status = 'cancelled'
     AND a.google_event_id = p_google_event_id
     AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;
  PERFORM set_config('spinus.via', 'google', true);
  -- Cerrar y desvincular, juntas. cerrada_en no se pisa si ya estaba (una cerrada no se reabre ni se mueve).
  UPDATE public.appointments a
     SET cerrada_en       = coalesce(a.cerrada_en, now()),
         google_event_id  = NULL,
         gcal_calendar_id = NULL,
         gcal_etag        = NULL,
         gcal_sync_status = 'unbound'
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id AND a.status = 'cancelled';
  r_cerrada := v_cerrada_en IS NULL;
  r_desvinculada := true;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.gcal_cita_quitar_cancelada(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_cita_quitar_cancelada(uuid, uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.gcal_cita_quitar_cancelada(uuid, uuid, text, text) IS
  'BASE-2 (B1): el evento de una cita CANCELADA se borró en Google: la cierra (cerrada_en, como «Eliminar cita»; no se borra) y la desvincula de Google, en una sentencia. Sólo una cancelada de p_clinica_id que sigue ligada a ESE evento y calendario, con la v2 encendida y la conexión activa de ese calendario. Devuelve si esta llamada la cerró y si la desvinculó; idempotente (la segunda vez, false/false). No toca estado, hora, título, notas ni updated_at. INVOKER a propósito: quien manda sigue siendo cita_proteger_cierre(). Sólo service_role (la sincronización con Google).';

DO $$
DECLARE
  v_oid oid := to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)');
BEGIN
  IF v_oid IS NULL OR (SELECT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR provolatile <> 'v' FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: gcal_cita_quitar_cancelada falta, es DEFINER, no fija search_path vacío o no es VOLATILE.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE p.oid = v_oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
     OR has_function_privilege('anon', v_oid, 'EXECUTE') OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: gcal_cita_quitar_cancelada no es sólo de service_role.';
  END IF;
  -- Con una clínica que no existe: (false, false), nunca error y nunca una escritura.
  IF (SELECT r_cerrada OR r_desvinculada FROM public.gcal_cita_quitar_cancelada(
        '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'x', 'x')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: gcal_cita_quitar_cancelada dijo que tocó algo para una clínica inexistente.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS resultado
FROM (
  SELECT 1 AS n, 'gcal_cita_quitar_cancelada: INVOKER, VOLATILE, search_path vacío; anon/authenticated/service_role' AS comprobacion,
         (SELECT (NOT p.prosecdef AND p.provolatile = 'v' AND p.proconfig = ARRAY['search_path=""'])::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)')) AS valor,
         'true ; false/false/true' AS esperado
  UNION ALL
  SELECT 2, 'dueño de la función',
         (SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)')),
         'postgres'
  UNION ALL
  SELECT 3, 'cita_proteger_cierre() sigue siendo la de F5b (md5 de su cuerpo, sin \r)',
         (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_cierre()')),
         '57510b8a6bddd4a2d9bfa9c2deff1bbb'
  UNION ALL
  SELECT 4, 'con una clínica inexistente devuelve false/false',
         (SELECT r_cerrada::text || '/' || r_desvinculada::text FROM public.gcal_cita_quitar_cancelada(
            '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'x', 'x')),
         'false/false'
  UNION ALL
  SELECT 5, 'citas canceladas, sin cerrar y todavía ligadas a un evento de Google (las que este camino podría quitar)',
         (SELECT count(*)::text FROM public.appointments a
           WHERE a.status = 'cancelled' AND a.cerrada_en IS NULL AND a.google_event_id IS NOT NULL), NULL
) t
ORDER BY t.n;
