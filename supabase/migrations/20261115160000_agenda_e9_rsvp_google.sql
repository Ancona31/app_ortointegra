-- ═══════════════════════════════════════════════════════════════════════
-- Agenda E9 — la respuesta del paciente a la invitación de Google (RSVP)
-- como segunda vía de confirmación: «accepted» pasa la cita a confirmada
-- Rama: feature/agenda-v2 · Escrita: 2026-11-12
-- Riesgo estimado: BAJO-MEDIO (una función nueva que escribe appointments con
-- service_role; el código sólo la llama con AGENDA_RSVP_GOOGLE=encendido).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 5 × OK) y una
--   segunda pasada: misma rejilla, sin NOTICE, y no-op comprobado con una
--   huella de catálogo (md5, proacl, prosecdef, provolatile, proconfig y
--   COMMENT de cita_rsvp_google y log_cita_change; policies de appointments;
--   count(*) de audit_log): sin diferencias. Pre-vuelo probado en ROLLBACK:
--   aborta con la función como SECURITY DEFINER y con una sobrecarga. Anotada
--   a mano en supabase_migrations.schema_migrations (versión 20261115160000).
--   Pruebas: supabase/pruebas-sql/e9_rsvp_google.sql (bash scripts/pruebas-sql.sh).
--   Comprobación:
--     select prosecdef, proacl from pg_proc
--      where oid = 'public.cita_rsvp_google(uuid, uuid, text, text, text[])'::regprocedure;
--   → false, EXECUTE sólo postgres y service_role.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, C1, C2 y E1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA, sin cambios.
--   Hallazgo 1 del auditor, DESCARTADO tras comprobarlo: decía que la rama
--   «por ligar» era inalcanzable porque el sondeo filtra con conPaciente =
--   paciente_id IS NOT NULL; desde D4 (20261114150000) gcal_citas_por_evento
--   devuelve r_con_paciente = (paciente_id IS NOT NULL OR reserva_canal IS
--   NOT NULL), así que la cita por ligar SÍ llega. Hallazgo 2 (BEGIN/COMMIT
--   explícito en el SQL Editor): lo resolvió el auditor de E4 leyendo
--   postgres-meta (correcto). Propuso una dimensión nueva (alcance del
--   llamador frente a las ramas de la función): anotada en mejora_agendaV2.md.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §5 E («leer la respuesta del paciente a la invitación
-- de Google … como segunda vía de confirmación, si el permiso actual la
-- devuelve») y §8; diseño en plan_E.md E9 (allí «E4 rsvp»).
-- attendees[].responseStatus llega en events.list con calendar.app.created
-- (el sondeo de C no pide `fields`). Que un RSVP llegue por syncToken NO
-- está documentado: por eso el código sólo llama esta función con la
-- variable AGENDA_RSVP_GOOGLE=encendido, apagada hasta la prueba de Angel
-- con su cuenta real.
-- REGLA (plan_E lista A 15): sólo 'accepted' de un asistente cuyo correo es
--   el del paciente de ESA cita (pacientes.email) o el de su reserva
--   (reserva_correo), y sólo desde 'scheduled', con la cita futura y con
--   hora: scheduled → confirmed. 'declined' no llega aquí (como hoy, lo ve el
--   organizador en su correo). Nunca cancela, nunca reactiva, nunca toca una
--   confirmada, cancelada, atendida o no_show.
-- Mismas comprobaciones que gcal_aplicar_evento (C2): interruptor encendido,
--   conexión 'clinica' activa de ESA clínica con ESE calendario, y la cita
--   ligada a ESE evento de ese calendario. FOR UPDATE sobre la cita.
-- updated_at = greatest(el que tenía, clock_timestamp()): «gana el último»
--   (bloque C) también para este cambio. Auditoría: log_cita_change con
--   "via":"google_rsvp" (lista blanca de E1), user_id 'system'.
-- Diferencia con plan_E: la firma lleva también p_google_event_id (la cita
--   tiene que estar ligada a ESE evento, no sólo a ese calendario).
-- INVOKER y sólo service_role (BYPASSRLS, comprobado). Ninguna SECURITY
--   DEFINER nueva. No escribe agenda_ajustes.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1, C1, C2 y E1. PG ≥ 14. Sólo catálogo: sin bloqueos de tabla.
-- Orden respecto al código: cualquiera. Sin esta función el sondeo recibe
--   PGRST202 y sigue como hoy (y con la variable apagada ni la llama).
-- Alcance de los roles: gana service_role EXECUTE de una función. Nadie
--   pierde nada. appointments: sin cambio de permisos ni de policies.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.cita_rsvp_google(uuid, uuid, text, text, text[]);
--   Las citas confirmadas por RSVP se quedan así (son hechos).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF position('google_rsvp' IN coalesce((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()')), '')) = 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change no tiene la lista blanca de E1 (google_rsvp).';
  END IF;
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes (B1) o clinica_conexiones_google.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.clinica_conexiones_google'::regclass AND NOT attisdropped
        AND attname IN ('clinica_id', 'rol', 'estado', 'calendar_id')) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_conexiones_google no tiene clinica_id, rol, estado y calendar_id.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('google_event_id', 'text'::regtype), ('gcal_calendar_id', 'text'::regtype),
              ('reserva_correo', 'text'::regtype), ('paciente_id', 'uuid'::regtype), ('status', 'text'::regtype),
              ('start_time', 'timestamptz'::regtype), ('all_day', 'bool'::regtype), ('updated_at', 'timestamptz'::regtype))) <> 8 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments no tiene las columnas esperadas (C1, D1).';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS; la función invoker no vería las filas.';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.appointments', 'SELECT')
          AND has_table_privilege('service_role', 'public.appointments', 'UPDATE')
          AND has_table_privilege('service_role', 'public.pacientes', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinica_conexiones_google', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin privilegios sobre appointments, pacientes o clinica_conexiones_google.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'cita_rsvp_google'
               AND (p.prosecdef OR p.oid IS DISTINCT FROM to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_rsvp_google existe como SECURITY DEFINER o con otra firma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función. Devuelve 'confirmada' o 'sin_cambio'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_rsvp_google(
  p_clinica_id uuid, p_cita_id uuid, p_calendar_id text, p_google_event_id text, p_aceptaron text[])
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_a      record;
  v_correos text[];
  v_ahora  timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL
     OR p_aceptaron IS NULL OR cardinality(p_aceptaron) > 50
     OR EXISTS (SELECT 1 FROM unnest(p_aceptaron) c WHERE c IS NULL OR length(c) > 254) THEN
    RAISE EXCEPTION 'cita_rsvp_google: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(DISTINCT lower(btrim(c))) FILTER (WHERE btrim(c) <> ''), ARRAY[]::text[])
    INTO v_correos FROM unnest(p_aceptaron) c;
  IF cardinality(v_correos) = 0
     OR NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida)
     OR NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                     WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                       AND g.calendar_id = p_calendar_id) THEN
    RETURN 'sin_cambio';
  END IF;
  SELECT a.id, a.updated_at INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.google_event_id = p_google_event_id
     AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
     AND a.status = 'scheduled' AND NOT a.all_day
     AND (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL)
     AND (lower(btrim(p.email)) = ANY (v_correos) OR lower(btrim(a.reserva_correo)) = ANY (v_correos))
   FOR UPDATE OF a;
  IF NOT FOUND THEN
    RETURN 'sin_cambio';
  END IF;
  -- Hora REAL tras el candado: la cita tiene que seguir siendo futura.
  v_ahora := clock_timestamp();
  IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = v_a.id AND a.start_time > v_ahora) THEN
    RETURN 'sin_cambio';
  END IF;
  PERFORM set_config('spinus.via', 'google_rsvp', true);
  UPDATE public.appointments
     SET status = 'confirmed', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
   WHERE id = v_a.id AND clinica_id = p_clinica_id AND status = 'scheduled';
  RETURN 'confirmada';
END
$fn$;

-- Permisos de funciones: SOLO service_role, justificado: la llama el sondeo de
-- Google sin sesión (bloque C) y escribe appointments saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) TO service_role;

COMMENT ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) IS
  'Agenda E9: RSVP «accepted» de Google como segunda vía de confirmación. Sólo scheduled → confirmed, cita futura con hora, ligada a ese evento y calendario de la conexión activa de la clínica, y sólo si un correo aceptado es pacientes.email o reserva_correo de ESA cita. Audita via google_rsvp. El código la llama sólo con AGENDA_RSVP_GOOGLE=encendido.';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_rsvp_google: definer / EXECUTE anon,authenticated,service_role / PUBLIC' AS comprobacion,
         coalesce((SELECT p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                          || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                       WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])')), 'AUSENTE') AS valor,
         'false/false,false,true/false' AS esperado
  UNION ALL
  SELECT 2, 'search_path de la función',
         coalesce((SELECT array_to_string(proconfig, ',') FROM pg_proc
                    WHERE oid = to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])')), '-'),
         'search_path=""'
  UNION ALL
  SELECT 3, 'log_cita_change con google_rsvp',
         (position('google_rsvp' IN (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()'))) > 0)::text, 'true'
  UNION ALL
  SELECT 4, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 5, 'ninguna SECURITY DEFINER escribe agenda_ajustes',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
           AND p.prosrc ~* '(insert\s+into|update)\s+public\.agenda_ajustes'), '0'
) t
ORDER BY t.n;
