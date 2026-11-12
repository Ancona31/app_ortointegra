-- ═══════════════════════════════════════════════════════════════════════
-- Agenda D4 — lo que entra de Google trata una cita POR LIGAR (reservada por
-- enlace y aún sin paciente) como una cita CON paciente: Google no le cambia
-- el título, que es el nombre de la persona (C-d ampliado), ni la pasa a todo
-- el día; y el espejo devuelve ese nombre para que Spinus restablezca el
-- título si lo editan allí.
-- Rama: feature/agenda-v2 · Escrita: 2026-11-12 · Riesgo: BAJO (sólo
-- CREATE OR REPLACE de dos funciones; ninguna tabla).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 5 × OK, tras añadir
--   los COMMENT de la auditoría) y una segunda pasada igual (misma rejilla); no-op comprobado con la huella de
--   catálogo de las funciones gcal_* (md5 de prosrc, proacl, prosecdef,
--   proconfig, COMMENT), las policies de appointments y count(*) de
--   audit_log: sin diferencias entre la primera y la segunda pasada. Antes de
--   aplicarla, en una transacción con ROLLBACK, con gcal_citas_por_evento
--   alterada el pre-vuelo abortó («no es el cuerpo de C2 ni el de D4»).
--   Anotada a mano en supabase_migrations.schema_migrations (versión
--   20261114150000, 14 sentencias), como D1-D3.
--   Pruebas: supabase/pruebas-sql/d4_gcal_por_ligar.sql (falla sin esta
--   migración en el caso 1a; en verde con ella), y c2_gcal_aplicar.sql y
--   c4_gcal_flujo.sql siguen en verde.
--   Comprobación:
--     select md5(prosrc) from pg_proc
--      where oid = 'public.gcal_citas_por_evento(uuid, text[], uuid[])'::regprocedure;
--   → 66feb69a15e35a46bf9d4dad1443848d.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de C2 y D1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md), sin hallazgos en la lógica: el diff
-- C2→D4 cambia sólo los 5 predicados y las 4 columnas del espejo descritos
-- abajo; ningún otro lector de src/ consume r_con_paciente. Aplicado antes
-- del commit (dimensión 16): COMMENT ON de las dos funciones y de
-- appointments.reserva_nombre con el convenio «por ligar = con paciente»
-- (r_paciente_apellidos = '' a propósito), comprobado en la fila 4 del
-- veredicto; y un caso con enlace 'unico' en la prueba. Sin calificar, como
-- en B0-D3: cómo envuelve el SQL Editor un BEGIN/COMMIT explícito.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- C2 decidía «sin paciente» sólo con appointments.paciente_id IS NULL. Una
-- cita reservada por enlace (D3) nace sin paciente y con title = nombre de
-- quien reservó; con la regla de C2, Google podía reescribirle el título (un
-- dato personal que la clínica no eligió) y el sondeo lo aceptaba. Ahora
-- «por ligar» = paciente_id IS NULL AND reserva_canal IS NOT NULL (la
-- definición de D1) cuenta como «con paciente» en las dos funciones:
--   · gcal_aplicar_evento: las 5 apariciones de «a.paciente_id IS NULL»
--     (inicio y fin —pasar a todo el día—, todo el día, título y notas)
--     pasan a «(a.paciente_id IS NULL AND a.reserva_canal IS NULL)». La de
--     notas no cambia nada en la práctica (una reserva es origen = 'spinus'),
--     va por coherencia. La hora de una cita por ligar SÍ se sigue aceptando
--     desde Google, igual que la de una cita con paciente.
--   · En gcal_citas_por_evento, r_notas_de_google no cambia: sólo filas
--     origen = 'google', y una reserva nunca lo es.
--   · gcal_citas_por_evento: r_con_paciente es true también para una cita
--     por ligar; r_titulo_sin_paciente le sale NULL; y r_paciente_nombre /
--     r_paciente_apellidos llevan reserva_nombre / '' (el nombre completo va
--     en reserva_nombre). Con eso el código de C (resumenEsperado,
--     gcalSincronizacionRestablecer.ts) compone «Cita médica: {nombre}» —el
--     título que D8 manda a Google— y lo restablece si lo editan allí, sin
--     cambiar una línea de TypeScript.
-- Una cita ya LIGADA (paciente_id NOT NULL) sigue exactamente como en C2: su
-- nombre sale de pacientes. El resto de los cuerpos es el de C2, copiado tal
-- cual (bloque C cerrado, 7fefede); el pre-vuelo aborta si el cuerpo vigente
-- no es ni el de C2 ni el de esta migración (md5 de prosrc), así que no pisa
-- un cambio que no conoce.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere C2 (20261113130000) y D1 (20261114120000).
-- Bloqueos: sólo catálogo (CREATE OR REPLACE FUNCTION y COMMENT ON). El
--   COMMENT ON COLUMN toma SHARE UPDATE EXCLUSIVE sobre appointments un
--   instante (no bloquea lecturas ni escrituras de filas); lock_timeout 5 s.
-- Orden respecto al código: indiferente. Sin citas por ligar (no las hay
--   hasta que D5 publique la reserva) las dos funciones devuelven y escriben
--   lo mismo que en C2. Con citas por ligar y SIN esta migración, Google
--   podría cambiarles el título: aplicar ANTES de encender la reserva.
-- Alcance de los roles: no cambia en ninguna de las dos direcciones
--   (CREATE OR REPLACE conserva proacl; se repiten revoke y grant por la
--   regla de CLAUDE.md: sólo service_role, como en C2).
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- Volver a pegar SÓLO las secciones 2 y 3 de
-- 20261113130000_agenda_c2_gcal_aplicar.sql (los dos CREATE OR REPLACE) y
-- sus REVOKE/GRANT; COMMENT ON FUNCTION … IS NULL en las dos, y el COMMENT ON
-- COLUMN appointments.reserva_nombre de D1 (sección 5 de
-- 20261114120000_agenda_d1_enlaces_reserva.sql). Ningún dato cambia.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) del cuerpo de C2 y del de esta migración, por función.
  c_aplicar_c2  CONSTANT text := 'f5da38cc2fa9a0ddb37aaba5f890f1a2';
  c_aplicar_d4  CONSTANT text := '5ac551e4085881a13f10bf08cafa26e3';
  c_espejo_c2   CONSTANT text := 'a1a53c1db9a323cc4103da8d797aa0e8';
  c_espejo_d4   CONSTANT text := '66feb69a15e35a46bf9d4dad1443848d';
  v_aplicar oid := to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)');
  v_espejo  oid := to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])');
  v_md5 text;
BEGIN
  IF v_aplicar IS NULL OR v_espejo IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta C2 (gcal_aplicar_evento / gcal_citas_por_evento).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('reserva_canal', 'text'::regtype), ('reserva_nombre', 'text'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta D1 (appointments.reserva_canal / reserva_nombre).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (v_aplicar, v_espejo) AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una de las dos funciones es SECURITY DEFINER; C2 las dejó INVOKER.';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS (las funciones INVOKER no verían las filas).';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_aplicar;
  IF v_md5 NOT IN (c_aplicar_c2, c_aplicar_d4) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_aplicar_evento no es el cuerpo de C2 ni el de D4 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = v_espejo;
  IF v_md5 NOT IN (c_espejo_c2, c_espejo_d4) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_citas_por_evento no es el cuerpo de C2 ni el de D4 (md5 %). Alguien la cambió: revisar antes de pisarla.', v_md5;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Leer el espejo (cuerpo de C2 con «por ligar» = con paciente).
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
         (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL),
         CASE WHEN a.paciente_id IS NULL AND a.reserva_canal IS NULL THEN a.title END,
         CASE WHEN a.paciente_id IS NULL AND a.origen = 'google' THEN a.notes END,
         -- Una cita POR LIGAR (D4): el nombre de quien reservó, sin apellidos
         -- aparte (van dentro de reserva_nombre), como lo compone la reserva.
         coalesce(p.nombre, CASE WHEN a.paciente_id IS NULL THEN a.reserva_nombre END),
         coalesce(p.apellidos, CASE WHEN a.paciente_id IS NULL AND a.reserva_canal IS NOT NULL THEN '' END)
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.clinica_id = p_clinica_id
     AND (a.google_event_id = ANY (coalesce(p_eventos, ARRAY[]::text[]))
          OR a.id = ANY (coalesce(p_citas, ARRAY[]::uuid[])));
END
$fn$;

-- ---------------------------------------------------------------------
-- 3 · Aplicar un evento de Google (cuerpo de C2 con «por ligar» = con paciente).
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
                     AND (p_all_day IS NOT TRUE OR ((a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.consultorio_timezone IS NOT NULL))
                THEN p_start ELSE a.start_time END AS start_time,
           CASE WHEN p_end IS NOT NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR ((a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.consultorio_timezone IS NOT NULL))
                THEN p_end ELSE a.end_time END AS end_time,
           CASE WHEN p_all_day IS NOT NULL AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR a.consultorio_timezone IS NOT NULL)
                THEN p_all_day ELSE a.all_day END AS all_day,
           CASE WHEN p_title IS NOT NULL AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL)
                     AND a.status IN ('scheduled', 'confirmed') THEN p_title ELSE a.title END AS title,
           CASE WHEN p_tocar_notas AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.origen = 'google'
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

-- Permisos de funciones: los de C2, repetidos (CLAUDE.md). Sólo service_role:
-- las llama el sondeo de Google con el cliente de servicio; ninguna sesión ni
-- la consola deben escribir citas por aquí saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) TO service_role;

-- El convenio, donde viaja con la base (dimensión 16; auditoría de D4).
COMMENT ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) IS
  'Espejo del sondeo de Google (C2, ampliado en D4). Sólo service_role. Una cita POR LIGAR (paciente_id NULL y reserva_canal NOT NULL) cuenta como CON paciente: r_con_paciente = true, r_titulo_sin_paciente NULL, r_paciente_nombre = reserva_nombre (nombre completo) y r_paciente_apellidos = '''' (cadena vacía, no NULL), para que tituloParaGoogle componga «Cita médica: {nombre}» y C-d lo restablezca. No es una fila corrupta.';
COMMENT ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) IS
  'Aplica un evento de Google a una cita ligada (C2, ampliado en D4). Sólo service_role. «Sin paciente» = paciente_id NULL Y reserva_canal NULL: una cita por ligar no acepta título ni todo el día desde Google (C-d); su hora sí.';
COMMENT ON COLUMN public.appointments.reserva_nombre IS
  'Nombre de quien reservó por enlace, sin paciente todavía (D1). Se queda en la cita al ligarla a un paciente. Mientras la cita esté por ligar, el espejo de Google (gcal_citas_por_evento, D4) lo devuelve como nombre completo del «paciente» con apellidos vacíos.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'gcal_aplicar_evento: cuerpo D4 (md5) / invoker / search_path vacío' AS comprobacion,
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)')), 'AUSENTE') AS valor,
         '5ac551e4085881a13f10bf08cafa26e3 / false / true' AS esperado
  UNION ALL
  SELECT 2, 'gcal_citas_por_evento: cuerpo D4 (md5) / invoker / search_path vacío',
         coalesce((SELECT md5(p.prosrc) || ' / ' || p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])')), 'AUSENTE'),
         '66feb69a15e35a46bf9d4dad1443848d / false / true'
  UNION ALL
  SELECT 3, 'EXECUTE sólo service_role (de 2), sin PUBLIC',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])'),
                           to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
             AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND has_function_privilege('service_role', p.oid, 'EXECUTE')),
         '2'
  UNION ALL
  SELECT 4, 'COMMENT del convenio en las dos funciones y en reserva_nombre',
         ((obj_description(to_regprocedure('public.gcal_citas_por_evento(uuid, text[], uuid[])'), 'pg_proc') LIKE '%D4%')
          AND (obj_description(to_regprocedure('public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)'), 'pg_proc') LIKE '%D4%')
          AND (col_description('public.appointments'::regclass,
                 (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attname = 'reserva_nombre')) LIKE '%D4%'))::text,
         'true'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'), '5'
) t
ORDER BY t.n;
