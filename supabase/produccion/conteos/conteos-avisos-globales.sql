-- ═══════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar «avisos globales» (M1 y M2) a producción
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones de los pre-vuelos de
--     20261202120000_avisos_globales_modelo        (M1)
--     20261202130000_avisos_globales_rsvp_rechazo  (M2)
--   reescritas como consultas de SÓLO LECTURA, más lo que sólo los datos
--   reales dicen (historial, cuántos avisos hay, quién tiene tomadas las
--   tablas en ese momento). conteos.sql (el de al lado) es de ANTES de las 9
--   de la agenda y contra la base de hoy da ALTO en casi todo: para M1 y M2
--   se corre ESTE.
--   Si una fila sale ALTO, la migración que nombra abortaría en su pre-vuelo
--   (limpia, sin dejar nada) o la base no está como se supone: no se aplica
--   nada hasta resolverla.
-- QUÉ DEVUELVE: UNA rejilla, una fila por comprobación:
--     id | migración | qué mira | valor | esperado | veredicto
--   veredicto: OK · ALTO (no seguir) · AVISO (seguir sólo tras leerla) · INFO.
--   NUNCA datos de pacientes ni de personas: sólo números, nombres de objetos
--   de la base y versiones. Ningún id de fila, de clínica ni de persona.
-- CÓMO SE CORRE: con el MISMO rol con el que se aplicará (postgres, por el
--   pooler):
--     bash supabase/produccion/conteos/correr-conteos-avisos.sh
--   A mano: psql -X -v ON_ERROR_STOP=1 -P pager=off -f <este archivo>
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY y ROLLBACK al final.
--   No crea funciones ni tablas temporales.
-- SUPONE las 9 de la agenda aplicadas (en producción lo están desde el
--   2026-11-23): nombra public.avisos_clinica y public.agenda_ajustes. Si
--   faltaran, este archivo falla con «no existe la relación» en vez de dar una
--   rejilla: entonces el que toca es conteos.sql.
-- BLOQUEOS: ACCESS SHARE sobre lo que lee. Si una tabla está tomada en
--   exclusiva espera como mucho lock_timeout (2 s) y aborta: repetir.
-- LOS TRES CONTEOS QUE PEDÍA EL GUION DEL ENSAYO son las filas A.4 (avisos que
--   el pre-vuelo de M1 rechazaría), A.5 (las dos policies de F4) y A.6 + B.1
--   (nada de M1 ni de M2 existe todavía).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH
c AS (
  SELECT ARRAY['aviso_clinica_de_cambio_cita', 'aviso_clinica_de_bloqueo', 'aviso_clinica_de_correo',
               'aviso_clinica_de_conexion_google', 'aviso_clinica_de_sync_google', 'aviso_clinica_registrar',
               'aviso_clinica_reabrir', 'avisos_pendientes', 'avisos_mas_antiguos', 'aviso_visto_sellar',
               'aviso_clinica_de_cambio_medico', 'avisos_candidatos', 'avisos_revisar_todos', 'aviso_visto_hasta_sellar', 'avisos_vistos_hasta_mia'] AS funciones_m1,
         ARRAY['trg_appointments_aviso_alta_personal', 'trg_appointments_aviso_cambio', 'trg_agenda_bloqueos_aviso_alta',
               'trg_agenda_bloqueos_aviso_baja', 'trg_cita_correos_aviso_clinica', 'trg_conexiones_google_aviso_clinica',
               'trg_gcal_sync_estado_aviso_clinica', 'trg_avisos_clinica_reabrir', 'trg_appointments_aviso_medico'] AS disparadores_m1,
         ARRAY['avisos_clinica', 'appointments', 'agenda_bloqueos', 'cita_correos', 'clinica_conexiones_google',
               'gcal_sync_estado', 'agenda_ajustes', 'profiles'] AS tablas,
         ARRAY['20261125170000', '20261126120000', '20261201120000', '20261201130000', '20261201140000', '20261201150000',
               '20261201160000', '20261201170000', '20261201180000'] AS las_nueve
),
m AS (  -- lo de M1 que ya exista
  SELECT (SELECT count(*) FROM pg_proc p, c WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c.funciones_m1)) AS funciones,
         (SELECT count(*) FROM pg_trigger g, c WHERE NOT g.tgisinternal AND g.tgname = ANY (c.disparadores_m1)) AS disparadores,
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'avisos_clinica'
             AND column_name IN ('destinatario_id', 'actor_id', 'medico_id', 'datos')) AS columnas,
         (to_regclass('public.avisos_vistos') IS NOT NULL OR to_regclass('public.avisos_vistos_hasta') IS NOT NULL) AS vistos
),
filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (
SELECT 1, 'G.1', 'las dos', 'rol con el que se pregunta (el mismo con el que se aplicará)', current_user::text, 'postgres',
       current_user = 'postgres', 'AVISO'
UNION ALL
SELECT 2, 'G.2', 'las dos', 'de las 9 de la agenda, cuántas están en el historial',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h, c WHERE h.version = ANY (c.las_nueve)), '9',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h, c WHERE h.version = ANY (c.las_nueve)) = 9, 'ALTO'
UNION ALL
SELECT 3, 'G.3', 'las dos', 'M1 y M2 en el historial (todavía no)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version IN ('20261202120000', '20261202130000')), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version IN ('20261202120000', '20261202130000')) = 0, 'ALTO'
UNION ALL
SELECT 10, 'A.1', '20261202120000', 'tablas que M1 necesita y NO existen',
       coalesce((SELECT string_agg(t, ', ') FROM c, unnest(c.tablas) t WHERE to_regclass('public.' || t) IS NULL), 'ninguna'), 'ninguna',
       NOT EXISTS (SELECT 1 FROM c, unnest(c.tablas) t WHERE to_regclass('public.' || t) IS NULL), 'ALTO'
UNION ALL
SELECT 11, 'A.2', '20261202120000', 'de esas tablas, las que no son del rol que pregunta',
       coalesce((SELECT string_agg(t, ', ') FROM c, unnest(c.tablas) t JOIN pg_class k ON k.oid = to_regclass('public.' || t)
                  WHERE NOT pg_has_role(current_user, k.relowner, 'USAGE')), 'ninguna'), 'ninguna',
       NOT EXISTS (SELECT 1 FROM c, unnest(c.tablas) t JOIN pg_class k ON k.oid = to_regclass('public.' || t)
                    WHERE NOT pg_has_role(current_user, k.relowner, 'USAGE')), 'ALTO'
UNION ALL
SELECT 12, 'A.3', '20261202120000', 'funciones que M1 usa y NO existen',
       coalesce((SELECT string_agg(f, ', ') FROM unnest(ARRAY['public.agenda_v2_encendida(uuid)', 'public.get_clinica_id()',
                   'public.get_my_role()', 'public.soy_admin_de_clinica()', 'auth.uid()', 'public.prohibir_truncate()']) f
                  WHERE to_regprocedure(f) IS NULL), 'ninguna'), 'ninguna',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['public.agenda_v2_encendida(uuid)', 'public.get_clinica_id()',
                   'public.get_my_role()', 'public.soy_admin_de_clinica()', 'auth.uid()', 'public.prohibir_truncate()']) f
                    WHERE to_regprocedure(f) IS NULL), 'ALTO'
UNION ALL
-- Sólo cuenta si se parte de la forma de F4 (sin las columnas de M1): desde la forma conservada, M1 no lo exige.
SELECT 13, 'A.4', '20261202120000', 'avisos que el pre-vuelo de M1 rechazaría (sin cita o de un tipo que no es de F4)',
       (SELECT count(*)::text FROM public.avisos_clinica a
         WHERE a.cita_id IS NULL OR a.tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
               'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')), '0',
       (SELECT m.columnas = 4 FROM m) OR NOT EXISTS (SELECT 1 FROM public.avisos_clinica a
         WHERE a.cita_id IS NULL OR a.tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
               'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente')), 'ALTO'
UNION ALL
SELECT 14, 'A.5', '20261202120000', 'policies de avisos_clinica (las dos de F4 y ninguna más)',
       coalesce((SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'avisos_clinica'), 'ninguna'),
       'avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE',
       (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'avisos_clinica')
         IS NOT DISTINCT FROM 'avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE', 'ALTO'
UNION ALL
SELECT 15, 'A.6', '20261202120000', 'lo de M1 que YA existe: funciones / disparadores / columnas / tablas avisos_vistos y avisos_vistos_hasta',
       (SELECT m.funciones || ' / ' || m.disparadores || ' / ' || m.columnas || ' / ' || m.vistos FROM m),
       '0 / 0 / 0 / false (o 0 / 0 / 4 / false: la forma conservada, ver A.6b)',
       (SELECT m.funciones = 0 AND m.disparadores = 0 AND m.columnas IN (0, 4) AND NOT m.vistos FROM m), 'ALTO'
UNION ALL
-- Explica A.6 cuando no es «nada»: lo único admisible además de «nada» es la forma conservada por la reversa.
SELECT 16, 'A.6b', '20261202120000', 'de qué forma parte avisos_clinica',
       (SELECT CASE WHEN m.funciones = 0 AND m.disparadores = 0 AND NOT m.vistos AND m.columnas = 0 THEN 'la de F4'
                    WHEN m.funciones = 0 AND m.disparadores = 0 AND NOT m.vistos AND m.columnas = 4
                      THEN 'la de M1, conservada por su reversa (M1 se puede aplicar: completa lo que falta)'
                    ELSE 'M1 ya aplicada, o a medias (M1 abortaría en su pre-vuelo)' END FROM m),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 17, 'A.7', '20261202120000', 'avisos_clinica_tipo_check (el CHECK de tipos de F4 que M1 sustituye)',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_clinica_tipo_check' AND conrelid = to_regclass('public.avisos_clinica'))::text,
       'true',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_clinica_tipo_check' AND conrelid = to_regclass('public.avisos_clinica')), 'ALTO'
UNION ALL
SELECT 18, 'A.8', '20261202120000', 'índice avisos_clinica_pendientes_idx (de F4; sirve la lectura acotada de la campana)',
       (to_regclass('public.avisos_clinica_pendientes_idx') IS NOT NULL)::text, 'true',
       to_regclass('public.avisos_clinica_pendientes_idx') IS NOT NULL, 'ALTO'
UNION ALL
SELECT 19, 'A.9', '20261202120000', 'avisos_clinica en la publicación supabase_realtime (M1 no la toca; se espera fuera)',
       (SELECT count(*)::text FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
           AND tablename = 'avisos_clinica'), '0',
       NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
           AND tablename = 'avisos_clinica'), 'AVISO'
UNION ALL
SELECT 20, 'A.10', '20261202120000', 'filas de avisos_clinica: todas / sin cerrar (los CHECK nuevos las recorren una vez)',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE revisado_en IS NULL)::text FROM public.avisos_clinica),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 21, 'A.11', '20261202120000', 'clínicas con la agenda v2 encendida (sólo en ellas escriben los avisos nuevos)',
       (SELECT count(*) FILTER (WHERE agenda_v2_encendida)::text || ' de ' || count(*)::text FROM public.agenda_ajustes),
       NULL, NULL, 'INFO'
UNION ALL
-- M1 pide SHARE ROW EXCLUSIVE sobre cinco tablas y ACCESS EXCLUSIVE sobre avisos_clinica, con lock_timeout 5 s.
SELECT 22, 'A.12', '20261202120000', 'otras sesiones con una transacción abierta hace más de 5 s (M1 esperaría sus candados y abortaría limpia)',
       (SELECT count(*)::text FROM pg_stat_activity
         WHERE pid <> pg_backend_pid() AND xact_start IS NOT NULL AND state <> 'idle' AND xact_start < now() - interval '5 seconds'
           AND datname = current_database()), '0',
       NOT EXISTS (SELECT 1 FROM pg_stat_activity
         WHERE pid <> pg_backend_pid() AND xact_start IS NOT NULL AND state <> 'idle' AND xact_start < now() - interval '5 seconds'
           AND datname = current_database()), 'AVISO'
UNION ALL
SELECT 30, 'B.1', '20261202130000', 'cita_rsvp_google_rechazo (todavía no existe)',
       (to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') IS NOT NULL)::text, 'false',
       to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') IS NULL, 'ALTO'
UNION ALL
SELECT 31, 'B.2', '20261202130000', 'lo que M2 usa de la agenda: cita_rsvp_google, agenda_v2_encendida, clinica_conexiones_google',
       (to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])') IS NOT NULL
        AND to_regprocedure('public.agenda_v2_encendida(uuid)') IS NOT NULL
        AND to_regclass('public.clinica_conexiones_google') IS NOT NULL)::text, 'true',
       to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])') IS NOT NULL
        AND to_regprocedure('public.agenda_v2_encendida(uuid)') IS NOT NULL
        AND to_regclass('public.clinica_conexiones_google') IS NOT NULL, 'ALTO'
UNION ALL
SELECT 32, 'B.3', '20261202130000', 'log_cita_change() reconoce la vía google_rsvp',
       EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()')
                  AND position('''google_rsvp''' IN prosrc) > 0)::text, 'true',
       EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()')
                  AND position('''google_rsvp''' IN prosrc) > 0), 'ALTO'
UNION ALL
SELECT 33, 'B.4', '20261202130000', 'M2 exige M1 aplicada ANTES (hoy no lo está: se aplican en orden, M1 y luego M2)',
       (to_regprocedure('public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)') IS NOT NULL)::text,
       NULL, NULL, 'INFO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
