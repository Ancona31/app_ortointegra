-- ═══════════════════════════════════════════════════════════════════════
-- Agenda C2 — lo que entra de Google: leer el espejo, aplicar cambios a citas
-- ligadas, importar eventos creados en Google, y marcar «vino de Google» en
-- la auditoría de citas (log_cita_change de B0)
-- Rama: feature/agenda-v2-c · Escrita: 2026-11-13
-- Riesgo estimado: MEDIO (reemplaza log_cita_change: si fallara, fallaría la
-- escritura de citas, igual que en B0; tres funciones nuevas que escriben en
-- appointments con service_role).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-13
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK), y una
--   segunda pasada igual: misma rejilla y no-op comprobado comparando antes y
--   después definición (md5), proacl y COMMENT de las tres funciones y de
--   log_cita_change, los disparadores y las 5 policies de appointments, y
--   count(*) de audit_log (sin diferencias). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261113130000), por la
--   misma razón que B0, B1 y C1.
--   Pruebas: supabase/pruebas-sql/c2_gcal_aplicar.sql
--   (bash scripts/pruebas-sql.sh).
--   Comprobación:
--     select position('spinus.via' in prosrc) > 0 from pg_proc
--      where oid = 'public.log_cita_change()'::regprocedure;
--   → t.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de C1).
-- AUDITORÍA INDEPENDIENTE 2026-11-13: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes del commit: una cita
-- sin paciente y SIN consultorio_timezone ya no intenta pasar a todo el día
-- (la CHECK appointments_all_day_medianoche_check tronaba el UPDATE): su hora
-- no se toca; el pre-vuelo comprueba BYPASSRLS de service_role; la prueba
-- cubre esa conversión, no_show, una clínica suspendida, vincular y
-- desvincular a la vez, puntas incoherentes, textos largos y el tope de 2500
-- ids. Notas sin cambio: "via":"google" lo decide sólo el GUC sin sesión;
-- D y E deberán poner otro literal, nunca 'google'. La auditoría no pudo
-- verificar por sí misma cómo envuelve el SQL Editor un BEGIN/COMMIT
-- explícito (mismo patrón que B0, B1 y C1). Propuso una dimensión 19
-- (columnas emparejadas por un CHECK multicolumna), sin añadir al archivo de
-- auditoría, que no se modifica.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Toda escritura del sondeo de Google en appointments pasa por aquí, con
-- p_clinica_id OBLIGATORIO y filtrado en cada sentencia (pendiente
-- prioritario de CLAUDE.md), más la comprobación de que el calendario es el
-- de la conexión activa de ESA clínica y de que su interruptor v2 está
-- encendido. INVOKER + service_role (BYPASSRLS): ninguna SECURITY DEFINER
-- nueva, ninguna escritura en agenda_ajustes (sólo se lee).
-- Reglas que la base impone aunque el código se equivoque (decisiones de
-- Angel, mejora_agendaV2.md §6-bis: C-d, C-e y S1):
--   · sólo citas scheduled/confirmed cambian de contenido desde Google;
--     attended, no_show y cancelled sólo reciben columnas técnicas (C-e);
--   · una cita CON paciente no cambia de título (C-d) ni pasa a todo el día;
--     una sin paciente sólo pasa a todo el día si tiene consultorio_timezone
--     (lo exige appointments_all_day_medianoche_check); si no, su hora no se toca;
--   · observaciones (notes): sólo en filas nacidas en Google (origen =
--     'google') y SIN paciente (S1); al ligarlas a un paciente dejan de
--     cambiar desde Google;
--   · nunca se reactiva una cita desde Google; cancelar sí;
--   · nunca se BORRA una fila: el borrado en Google es status = cancelled y
--     soltar el vínculo (google_event_id NULL, gcal_sync_status 'unbound');
--   · comparar-y-cambiar sobre updated_at: si Spinus escribió entre la
--     lectura y la escritura, no se toca nada (y Spinus es el más reciente).
-- Importar: INSERT … ON CONFLICT (clinica_id, google_event_id) DO NOTHING,
-- origen 'google', sin paciente. La puerta RESTRICTIVE de INSERT de
-- appointments no aplica a service_role, así que se evalúa a mano con
-- gcal_sync_clinica_habilitada (C1, S3). El médico es el dueño de la
-- conexión sólo si es de ESTA clínica (si no, NULL).
-- Leer el espejo (gcal_citas_por_evento) devuelve lo mínimo para decidir:
-- el título sólo de filas sin paciente; las notas sólo de filas de Google sin
-- paciente; y de las filas con paciente, su nombre y apellidos, para que el
-- código componga el título que Spinus manda a Google (eventoParaGoogle) y
-- detecte que lo editaron allí (C-d). Es lo mismo que ya viaja a Google.
-- Auditoría: log_cita_change añade "via":"google" cuando NO hay auth.uid()
-- y el GUC transaccional spinus.via = 'google' (lo ponen sólo estas RPC).
-- Con sesión se ignora: authenticated no puede fingir que vino de Google.
-- Hace falta distinguirlo: D y E también escribirán como 'system'. El resto
-- del cuerpo es el de B0 sin otro cambio; c_tecnicas y el WHEN no se tocan.
-- Es una migración NUEVA con CREATE OR REPLACE: la de B0 no se edita.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: sólo CREATE OR REPLACE FUNCTION (catálogo); ninguna tabla se
-- bloquea. lock_timeout 5 s por si hubiera cola.
-- Orden respecto al código: PRIMERO esta migración. Sin GUC, log_cita_change
-- se comporta exactamente como en B0, así que el código viejo no cambia; el
-- nuevo sin ella falla al llamar las RPC y no sincroniza (cerrado).
-- Alcance de los roles:
--   gana   — service_role: EXECUTE de las tres funciones (ya podía escribir
--            appointments directo; ahora tiene un camino acotado).
--   pierde — nadie. log_cita_change conserva sus grants (CREATE OR REPLACE)
--            y se repiten por la regla de CLAUDE.md.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid);
--   DROP FUNCTION IF EXISTS public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean);
--   DROP FUNCTION IF EXISTS public.gcal_citas_por_evento(uuid, text[], uuid[]);
--   y volver a pegar SÓLO la sección 2 de 20261112120000_agenda_b0_auditoria_citas.sql
--   (log_cita_change sin «via»). Las filas importadas se quedan (son citas).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_fn regprocedure;
  v_log oid := to_regprocedure('public.log_cita_change()');
BEGIN
  IF to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NULL OR to_regclass('public.gcal_sync_estado') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta C1 (20261113120000).';
  END IF;
  -- Las tres RPC son INVOKER: sin BYPASSRLS, service_role no vería las filas.
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS.';
  END IF;
  IF v_log IS NULL OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = v_log AND p.prosecdef
                                    AND p.prorettype = 'trigger'::regtype AND pg_has_role(current_user, p.proowner, 'USAGE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change() no existe o no es el trigger SECURITY DEFINER de B0 de este rol.';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass
        AND t.tgname IN ('audit_appointments', 'audit_appointments_update') AND t.tgfoid = v_log) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: los disparadores de B0 no apuntan a log_cita_change().';
  END IF;
  -- El WHEN de B0 y c_tecnicas van juntos; este archivo copia c_tecnicas tal cual.
  IF position($w$ARRAY['updated_at'::text, 'client_id'::text, 'gcal_sync_status'::text, 'gcal_etag'::text, 'gcal_calendar_id'::text, 'google_event_id'::text]$w$
              IN (SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t
                   WHERE t.tgrelid = 'public.appointments'::regclass AND t.tgname = 'audit_appointments_update')) = 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el WHEN de audit_appointments_update ya no es el de B0 (c_tecnicas divergiría).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attnum > 0 AND NOT attisdropped
        AND (attname, atttypid) IN (('google_event_id', 'text'::regtype), ('gcal_etag', 'text'::regtype),
              ('gcal_calendar_id', 'text'::regtype), ('gcal_sync_status', 'text'::regtype), ('origen', 'text'::regtype),
              ('all_day', 'boolean'::regtype), ('consultorio_timezone', 'text'::regtype),
              ('updated_at', 'timestamptz'::regtype), ('status', 'text'::regtype), ('title', 'text'::regtype),
              ('notes', 'text'::regtype), ('medico_id', 'uuid'::regtype), ('paciente_id', 'uuid'::regtype),
              ('created_by', 'uuid'::regtype), ('start_time', 'timestamptz'::regtype), ('end_time', 'timestamptz'::regtype))) <> 16 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments no tiene las columnas esperadas.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.pacientes'::regclass AND attnum > 0 AND NOT attisdropped
        AND attname IN ('id', 'clinica_id', 'nombre', 'apellidos')) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: pacientes no tiene id, clinica_id, nombre y apellidos.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                  WHERE i.indrelid = 'public.appointments'::regclass AND c.relname = 'appointments_clinica_google_event_id_uniq'
                    AND i.indisunique AND pg_get_expr(i.indpred, i.indrelid) ILIKE '%google_event_id IS NOT NULL%') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el índice único parcial (clinica_id, google_event_id) que usa el ON CONFLICT.';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.appointments', 'SELECT, INSERT, UPDATE')
          AND has_table_privilege('service_role', 'public.profiles', 'SELECT')
          AND has_table_privilege('service_role', 'public.pacientes', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin privilegios sobre appointments, profiles o pacientes.';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY[
      to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])'),
      to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)'),
      to_regprocedure('public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)')] LOOP
    IF v_fn IS NOT NULL AND (SELECT prosecdef FROM pg_proc WHERE oid = v_fn) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % existe como SECURITY DEFINER.', v_fn;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Leer el espejo: las citas de ESTA clínica ligadas a esos eventos o con
--     esos ids (extendedProperties.private.spinus_cita).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gcal_citas_por_evento(p_clinica_id uuid, p_eventos text[], p_citas uuid[])
RETURNS TABLE (r_id uuid, r_google_event_id text, r_gcal_calendar_id text, r_gcal_etag text, r_gcal_sync_status text,
               r_origen text, r_status text, r_start_time timestamptz, r_end_time timestamptz, r_all_day boolean,
               r_consultorio_timezone text, r_updated_at timestamptz, r_con_paciente boolean,
               r_titulo_sin_paciente text, r_notas_de_google text,
               r_paciente_nombre text, r_paciente_apellidos text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'gcal_citas_por_evento: clínica en NULL' USING ERRCODE = '22023';
  END IF;
  IF coalesce(cardinality(p_eventos), 0) > 2500 OR coalesce(cardinality(p_citas), 0) > 2500 THEN
    RAISE EXCEPTION 'gcal_citas_por_evento: demasiados ids' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.google_event_id, a.gcal_calendar_id, a.gcal_etag, a.gcal_sync_status, a.origen, a.status,
         a.start_time, a.end_time, a.all_day, a.consultorio_timezone, a.updated_at,
         a.paciente_id IS NOT NULL,
         CASE WHEN a.paciente_id IS NULL THEN a.title END,
         CASE WHEN a.paciente_id IS NULL AND a.origen = 'google' THEN a.notes END,
         p.nombre, p.apellidos
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.clinica_id = p_clinica_id
     AND (a.google_event_id = ANY (coalesce(p_eventos, ARRAY[]::text[]))
          OR a.id = ANY (coalesce(p_citas, ARRAY[]::uuid[])));
END
$fn$;

-- ---------------------------------------------------------------------
-- 3 · Aplicar un evento de Google a UNA cita ligada. NULL = no tocar.
--     Devuelve las filas tocadas (0 = no prendió; el código no reintenta).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gcal_aplicar_evento(
  p_clinica_id uuid, p_cita_id uuid, p_esperado_updated_at timestamptz,
  p_calendar_id text, p_etag text, p_google_updated timestamptz,
  p_vincular_evento text, p_desvincular boolean,
  p_start timestamptz, p_end timestamptz, p_all_day boolean,
  p_title text, p_tocar_notas boolean, p_notas text, p_cancelar boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL
     OR p_desvincular IS NULL OR p_cancelar IS NULL OR p_tocar_notas IS NULL
     OR (p_etag IS NULL AND NOT p_desvincular) THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF (p_start IS NULL) <> (p_end IS NULL) OR (p_start IS NOT NULL AND p_end <= p_start)
     OR (p_all_day IS NOT NULL AND p_start IS NULL) THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: puntas incoherentes' USING ERRCODE = '22023';
  END IF;
  IF p_vincular_evento IS NOT NULL AND p_desvincular THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: vincular y desvincular a la vez' USING ERRCODE = '22023';
  END IF;
  IF length(p_title) > 500 OR length(p_vincular_evento) > 1024 OR length(p_etag) > 300 OR length(p_notas) > 5000 THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: texto demasiado largo' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('spinus.via', 'google', true);

  -- Primero los valores nuevos (con las reglas), bloqueando la fila; luego el
  -- UPDATE. updated_at sólo se mueve si cambió contenido DE VERDAD: un campo
  -- que las reglas descartan no cuenta como cambio.
  WITH n AS (
    SELECT a.id,
           -- A todo el día sólo sin paciente Y con zona: appointments_all_day_medianoche_check
           -- exige consultorio_timezone, y esta función no la inventa. Si no, la hora no se toca.
           CASE WHEN p_start IS NOT NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR (a.paciente_id IS NULL AND a.consultorio_timezone IS NOT NULL))
                THEN p_start ELSE a.start_time END AS start_time,
           CASE WHEN p_end IS NOT NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR (a.paciente_id IS NULL AND a.consultorio_timezone IS NOT NULL))
                THEN p_end ELSE a.end_time END AS end_time,
           CASE WHEN p_all_day IS NOT NULL AND a.paciente_id IS NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR a.consultorio_timezone IS NOT NULL)
                THEN p_all_day ELSE a.all_day END AS all_day,
           CASE WHEN p_title IS NOT NULL AND a.paciente_id IS NULL
                     AND a.status IN ('scheduled', 'confirmed') THEN p_title ELSE a.title END AS title,
           CASE WHEN p_tocar_notas AND a.paciente_id IS NULL AND a.origen = 'google'
                     AND a.status IN ('scheduled', 'confirmed') THEN nullif(btrim(p_notas), '') ELSE a.notes END AS notes,
           CASE WHEN p_cancelar AND a.status IN ('scheduled', 'confirmed') THEN 'cancelled' ELSE a.status END AS status
      FROM public.appointments a
     WHERE a.id = p_cita_id
       AND a.clinica_id = p_clinica_id
       AND a.updated_at IS NOT DISTINCT FROM p_esperado_updated_at
       AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
       AND (p_vincular_evento IS NOT NULL OR a.google_event_id IS NOT NULL)
       AND (p_vincular_evento IS NULL OR a.google_event_id IS NULL OR a.google_event_id = p_vincular_evento)
       FOR UPDATE
  )
  UPDATE public.appointments a
     SET start_time = n.start_time, end_time = n.end_time, all_day = n.all_day,
         title = n.title, notes = n.notes, status = n.status,
         google_event_id  = CASE WHEN p_desvincular THEN NULL
                                 WHEN p_vincular_evento IS NOT NULL THEN coalesce(a.google_event_id, p_vincular_evento)
                                 ELSE a.google_event_id END,
         gcal_calendar_id = CASE WHEN p_desvincular THEN NULL ELSE p_calendar_id END,
         gcal_etag        = CASE WHEN p_desvincular THEN NULL ELSE p_etag END,
         gcal_sync_status = CASE WHEN p_desvincular THEN 'unbound' ELSE 'synced' END,
         -- La hora del cambio de GOOGLE, no now(): así un cambio posterior en
         -- Google no pierde la comparación de «gana el último».
         updated_at = CASE WHEN (n.start_time, n.end_time, n.all_day, n.title, n.notes, n.status)
                                IS DISTINCT FROM (a.start_time, a.end_time, a.all_day, a.title, a.notes, a.status)
                           THEN greatest(a.updated_at, coalesce(p_google_updated, now()))
                           ELSE a.updated_at END
    FROM n
   WHERE a.id = n.id AND a.clinica_id = p_clinica_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- ---------------------------------------------------------------------
-- 4 · Importar un evento creado en Google como fila origen = 'google'.
--     Devuelve el id nuevo, o NULL si ya existía / no procede.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gcal_importar_evento(
  p_clinica_id uuid, p_calendar_id text, p_google_event_id text, p_etag text,
  p_google_updated timestamptz, p_title text, p_start timestamptz, p_end timestamptz,
  p_all_day boolean, p_timezone text, p_notas text, p_medico_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_medico uuid;
  v_id     uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL OR p_etag IS NULL
     OR p_start IS NULL OR p_end IS NULL OR p_all_day IS NULL OR p_timezone IS NULL THEN
    RAISE EXCEPTION 'gcal_importar_evento: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF p_end <= p_start OR length(p_google_event_id) > 1024 OR length(p_etag) > 300
     OR length(p_title) > 500 OR length(p_notas) > 5000 THEN
    RAISE EXCEPTION 'gcal_importar_evento: datos incoherentes' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone) THEN
    RAISE EXCEPTION 'gcal_importar_evento: zona horaria desconocida' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN NULL;
  END IF;
  -- La puerta RESTRICTIVE de INSERT no aplica a service_role: se evalúa aquí (S3).
  IF NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN NULL;
  END IF;
  -- Médico sólo si es de ESTA clínica; si no, NULL (lo ven admin y secretaria).
  SELECT p.id INTO v_medico FROM public.profiles p WHERE p.id = p_medico_id AND p.clinica_id = p_clinica_id;

  PERFORM set_config('spinus.via', 'google', true);
  INSERT INTO public.appointments (clinica_id, paciente_id, created_by, title, start_time, end_time, all_day,
                                   status, notes, google_event_id, gcal_calendar_id, gcal_etag, gcal_sync_status,
                                   origen, medico_id, consultorio_timezone, updated_at)
  VALUES (p_clinica_id, NULL, NULL, coalesce(nullif(btrim(p_title), ''), 'Evento sin título'), p_start, p_end, p_all_day,
          'scheduled', nullif(btrim(p_notas), ''), p_google_event_id, p_calendar_id, p_etag, 'synced',
          'google', v_medico, p_timezone, coalesce(p_google_updated, now()))
  ON CONFLICT (clinica_id, google_event_id) WHERE google_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): SOLO service_role, justificado: son las
-- escrituras del sondeo, sin sesión; ni la consola ni una sesión de la app
-- deben poder escribir citas por aquí saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 5 · log_cita_change: el de B0 + «via». Nada más cambia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_cita_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- ⚠️ La misma lista que el WHEN de audit_appointments_update. Van juntas.
  c_tecnicas CONSTANT text[] := ARRAY['updated_at', 'client_id', 'gcal_sync_status',
                                      'gcal_etag', 'gcal_calendar_id', 'google_event_id'];
  v_uid    uuid := auth.uid();
  v_fila   record;
  v_campos text[];
  v_accion text;
  v_desc   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_fila := OLD; ELSE v_fila := NEW; END IF;
  v_desc := jsonb_build_object('clinica_id', v_fila.clinica_id,
                               'con_paciente', v_fila.paciente_id IS NOT NULL,
                               'origen', v_fila.origen);
  -- C2 · «vino de Google»: sólo sin sesión y sólo este literal. Lo ponen
  -- gcal_aplicar_evento y gcal_importar_evento (set_config local).
  IF v_uid IS NULL AND current_setting('spinus.via', true) = 'google' THEN
    v_desc := v_desc || jsonb_build_object('via', 'google');
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_accion := 'cita_alta';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'cita_eliminada';
  ELSE
    -- Sólo NOMBRES de columna: n.value se compara, nunca se escribe.
    SELECT coalesce(array_agg(n.key ORDER BY n.key), ARRAY[]::text[]) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n
     WHERE n.key <> ALL (c_tecnicas)
       AND (to_jsonb(OLD) -> n.key) IS DISTINCT FROM n.value;
    -- El WHEN ya lo garantiza; esto sólo evita una fila vacía si divergieran.
    IF cardinality(v_campos) = 0 THEN RETURN NULL; END IF;
    v_accion := CASE
      WHEN OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN 'cita_cancelada'
      WHEN OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN 'cita_reactivada'
      ELSE 'cita_editada'
    END;
    v_desc := v_desc || jsonb_build_object('campos', to_jsonb(v_campos));
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_desc := v_desc || jsonb_build_object('estado', jsonb_build_object('de', OLD.status, 'a', NEW.status));
    END IF;
  END IF;
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (coalesce(v_uid::text, 'system'), v_accion, 'appointments', v_fila.id, v_desc::text);
  RETURN NULL;  -- AFTER ... FOR EACH ROW: el valor de retorno se ignora.
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.log_cita_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cita_change() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.log_cita_change() IS
  'Auditoría de public.appointments (AG-DT-10). Escribe NOMBRES de columnas y estado de→a, nunca valores: audit_log es inmutable y no admite ARCO. "via":"google" sólo sin auth.uid() y con el GUC spinus.via (C2). La lista c_tecnicas está también en el WHEN de audit_appointments_update: cambiar las dos.';

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tres RPC INVOKER con search_path vacío' AS comprobacion,
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])'),
                           to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)'),
                           to_regprocedure('public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)'))
             AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']) AS valor,
         '3' AS esperado
  UNION ALL
  SELECT 2, 'EXECUTE sólo service_role (de 3)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])'),
                           to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)'),
                           to_regprocedure('public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
             AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND has_function_privilege('service_role', p.oid, 'EXECUTE')),
         '3'
  UNION ALL
  SELECT 3, 'log_cita_change: definer / search_path / lleva spinus.via',
         coalesce((SELECT p.prosecdef::text || ' / ' || coalesce(array_to_string(p.proconfig, ','), '') || ' / '
                          || (position('spinus.via' IN p.prosrc) > 0)::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE'),
         'true / search_path="" / true'
  UNION ALL
  SELECT 4, 'log_cita_change EXECUTE PUBLIC / anon / authenticated / service_role',
         coalesce((SELECT (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text
                          || ' / ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE'),
         'false / true / true / true'
  UNION ALL
  SELECT 5, 'disparadores audit_appointments* activos',
         (SELECT count(*)::text FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass
             AND t.tgname IN ('audit_appointments', 'audit_appointments_update')
             AND t.tgfoid = to_regprocedure('public.log_cita_change()') AND t.tgenabled = 'O'),
         '2'
  UNION ALL
  SELECT 6, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'), '5'
) t
ORDER BY t.n;
