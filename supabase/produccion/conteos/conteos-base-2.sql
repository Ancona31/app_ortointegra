-- ═══════════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar BASE-2 a producción: B1 (20261208120000_gcal_quitar_cancelada),
-- B2 (20261208130000_lotes_sin_reejecucion) y B3 (20261208140000_avisos_y_correos_cierre_bajos)
-- ───────────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones de los tres pre-vuelos como consultas de SÓLO LECTURA, más lo que sólo los
--   datos reales dicen: cuántas citas canceladas siguen ligadas a un evento de Google, cuánto hay por
--   purgar y en la cola de empalmes (y cómo de desfasadas están las estadísticas de esas tablas, que
--   es lo que hacía fallar el tope del lote), y si hay transacciones abiertas mucho rato.
--   Si una fila sale ALTO, esa migración abortaría en su pre-vuelo (limpia) o la base no está como se supone.
-- QUÉ DEVUELVE: UNA rejilla: id | migración | qué mira | valor | esperado | veredicto
--   (OK · ALTO · AVISO · INFO). NUNCA datos de personas: sólo números, nombres de objetos y huellas.
-- CÓMO SE CORRE: con el MISMO rol con el que se aplicará (postgres, por el pooler):
--     bash supabase/produccion/conteos/correr-conteos-base-2.sh
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY y ROLLBACK al final.
-- SUPONE las 16 del plan aplicadas (hasta R1, 20261207120000).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH f AS (
  SELECT to_regprocedure('public.reserva_purgar(integer)') AS purgar,
         to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') AS procesar,
         to_regprocedure('public.avisos_transaccion_mas_antigua()') AS antigua,
         to_regprocedure('public.aviso_visto_hasta_sellar()') AS sellar,
         to_regprocedure('public.cita_proteger_cierre()') AS cierre
), h AS (
  SELECT (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = f.purgar) AS purgar,
         (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = f.procesar) AS procesar,
         (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = f.antigua) AS antigua,
         (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = f.sellar) AS sellar,
         (SELECT md5(replace(p.prosrc, E'\r\n', E'\n')) FROM pg_proc p WHERE p.oid = f.cierre) AS cierre
    FROM f
), filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (
SELECT 1, 'B.1', 'todas', 'rol con el que se pregunta (el mismo con el que se aplicará)',
       current_user::text, 'postgres', current_user IN ('postgres', 'supabase_admin'), 'ALTO'
UNION ALL
SELECT 2, 'B.2', 'todas', 'versiones del plan en el historial, de 20261125170000 a 20261207120000 (las 16 anteriores)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261207120000'), '16',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261207120000') = 16, 'ALTO'
UNION ALL
SELECT 3, 'B.3', 'todas', 'alguna de las tres ya registrada en el historial (20261208120000, …130000, …140000)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version IN ('20261208120000', '20261208130000', '20261208140000')), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20261208120000', '20261208130000', '20261208140000')) = 0, 'ALTO'
-- ── B1 ──
UNION ALL
SELECT 10, 'B1.1', 'B1', 'la función nueva todavía no existe (gcal_cita_quitar_cancelada)',
       (to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NULL)::text, 'true',
       to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NULL, 'ALTO'
UNION ALL
SELECT 11, 'B1.2', 'B1', 'lo que nombra existe: agenda_v2_encendida(uuid), clinica_conexiones_google y las 7 columnas de appointments',
       ((to_regprocedure('public.agenda_v2_encendida(uuid)') IS NOT NULL)::text || ' / ' || (to_regclass('public.clinica_conexiones_google') IS NOT NULL)::text || ' / '
        || (SELECT count(*)::text FROM pg_attribute WHERE attrelid = to_regclass('public.appointments') AND NOT attisdropped
              AND attname IN ('clinica_id', 'status', 'cerrada_en', 'google_event_id', 'gcal_calendar_id', 'gcal_etag', 'gcal_sync_status'))), 'true / true / 7',
       to_regprocedure('public.agenda_v2_encendida(uuid)') IS NOT NULL AND to_regclass('public.clinica_conexiones_google') IS NOT NULL
       AND (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.appointments') AND NOT attisdropped
              AND attname IN ('clinica_id', 'status', 'cerrada_en', 'google_event_id', 'gcal_calendar_id', 'gcal_etag', 'gcal_sync_status')) = 7, 'ALTO'
UNION ALL
SELECT 12, 'B1.3', 'B1', 'cita_proteger_cierre(): su disparador está en appointments y encendido; huella de su cuerpo (la de F5b)',
       (SELECT (count(*) = 1)::text FROM pg_trigger t, f WHERE t.tgrelid = to_regclass('public.appointments') AND NOT t.tgisinternal AND t.tgfoid = f.cierre AND t.tgenabled = 'O')
       || ' / ' || coalesce((SELECT cierre FROM h), '∅'), 'true / 57510b8a6bddd4a2d9bfa9c2deff1bbb',
       (SELECT count(*) = 1 FROM pg_trigger t, f WHERE t.tgrelid = to_regclass('public.appointments') AND NOT t.tgisinternal AND t.tgfoid = f.cierre AND t.tgenabled = 'O')
       AND (SELECT cierre FROM h) = '57510b8a6bddd4a2d9bfa9c2deff1bbb', 'AVISO'
UNION ALL
SELECT 13, 'B1.4', 'B1', 'citas CANCELADAS, sin cerrar y todavía ligadas a un evento de Google (las que este camino podrá quitar si su evento se borra)',
       (SELECT count(*)::text FROM public.appointments a WHERE a.status = 'cancelled' AND a.cerrada_en IS NULL AND a.google_event_id IS NOT NULL), NULL, NULL, 'INFO'
UNION ALL
SELECT 14, 'B1.5', 'B1', 'clínicas con conexión de Google activa (rol clínica) / con la v2 encendida',
       (SELECT count(*)::text FROM public.clinica_conexiones_google g WHERE g.rol = 'clinica' AND g.estado = 'activa') || ' / '
       || (SELECT count(*)::text FROM public.agenda_ajustes WHERE agenda_v2_encendida), NULL, NULL, 'INFO'
-- ── B2 ──
UNION ALL
SELECT 20, 'B2.1', 'B2', 'huella (md5 de prosrc) de reserva_purgar: la exige el pre-vuelo (la de M4)',
       (SELECT purgar FROM h), '7952fee050cef1d7ed739a03a5793a2f', (SELECT purgar FROM h) = '7952fee050cef1d7ed739a03a5793a2f', 'ALTO'
UNION ALL
SELECT 21, 'B2.2', 'B2', 'huella (md5 de prosrc) de reserva_empalmes_pendientes_procesar: la exige el pre-vuelo (la de M5)',
       (SELECT procesar FROM h), '5a5a1cb08484653cca01e178e1affa76', (SELECT procesar FROM h) = '5a5a1cb08484653cca01e178e1affa76', 'ALTO'
UNION ALL
SELECT 22, 'B2.3', 'B2', 'atributos: purgar DEFINER con search_path vacío y lock_timeout 2s; procesar INVOKER con search_path vacío; las dos sólo de service_role y de quien pregunta',
       (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""', 'lock_timeout=2s'])::text FROM pg_proc p, f WHERE p.oid = f.purgar) || ' / '
       || (SELECT (NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])::text FROM pg_proc p, f WHERE p.oid = f.procesar) || ' / '
       || (SELECT count(*)::text FROM pg_proc p, f WHERE p.oid IN (f.purgar, f.procesar) AND pg_has_role(current_user, p.proowner, 'USAGE')
              AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
              AND has_function_privilege('service_role', p.oid, 'EXECUTE')), 'true / true / 2',
       (SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=""', 'lock_timeout=2s'] FROM pg_proc p, f WHERE p.oid = f.purgar)
       AND (SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] FROM pg_proc p, f WHERE p.oid = f.procesar)
       AND (SELECT count(*) FROM pg_proc p, f WHERE p.oid IN (f.purgar, f.procesar) AND pg_has_role(current_user, p.proowner, 'USAGE')
              AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
              AND has_function_privilege('service_role', p.oid, 'EXECUTE')) = 2, 'ALTO'
UNION ALL
SELECT 23, 'B2.4', 'B2', 'por purgar hoy (más de 30 días): códigos de reserva_verificaciones / intentos de ip_rate_limits / correos de enlaces únicos. Con más de 5000 de algo, la purga necesita varias pasadas',
       (SELECT count(*)::text FROM public.reserva_verificaciones x WHERE x.created_at < now() - interval '30 days' AND x.caduca_en < now()
           AND (x.ficha_caduca_en IS NULL OR x.ficha_caduca_en < now())) || ' / '
       || (SELECT count(*)::text FROM public.ip_rate_limits x WHERE x.created_at < now() - interval '30 days') || ' / '
       || (SELECT count(*)::text FROM public.reserva_enlaces x WHERE x.clase = 'unico' AND x.correo IS NOT NULL
             AND least(x.usado_en, x.revocado_en, x.agotado_en, x.caduca_en) < now() - interval '30 days'), NULL, NULL, 'INFO'
UNION ALL
SELECT 24, 'B2.5', 'B2', 'apuntes en la cola de empalmes de Google: total / la clínica que más tiene (más de 500 = el tope importaba)',
       (SELECT count(*)::text FROM public.gcal_empalmes_pendientes) || ' / '
       || coalesce((SELECT max(n)::text FROM (SELECT count(*) AS n FROM public.gcal_empalmes_pendientes GROUP BY clinica_id) x), '0'), NULL, NULL, 'INFO'
UNION ALL
SELECT 25, 'B2.6', 'B2', 'filas ESTIMADAS (pg_class.reltuples; -1 = nunca analizada) de las cuatro tablas: verificaciones / ip_rate_limits / reserva_enlaces / cola. Una estimación diminuta frente a muchas filas reales es la condición del defecto',
       (SELECT string_agg(c.reltuples::bigint::text, ' / ' ORDER BY x.o)
          FROM (VALUES (1, 'public.reserva_verificaciones'), (2, 'public.ip_rate_limits'), (3, 'public.reserva_enlaces'), (4, 'public.gcal_empalmes_pendientes')) x(o, t)
          JOIN pg_class c ON c.oid = to_regclass(x.t)), NULL, NULL, 'INFO'
UNION ALL
SELECT 26, 'B2.7', 'B2', 'pasadas de la purga registradas (audit_log, reserva_purga): total / las que se llevaron más de 5000 de algo (el tope superado)',
       (SELECT count(*)::text FROM public.audit_log WHERE accion = 'reserva_purga') || ' / '
       || (SELECT count(*)::text FROM public.audit_log a WHERE a.accion = 'reserva_purga' AND a.descripcion LIKE '{%'
             AND greatest((a.descripcion::jsonb ->> 'reserva_verificaciones')::int, (a.descripcion::jsonb ->> 'ip_rate_limits')::int,
                          (a.descripcion::jsonb ->> 'correos_de_enlaces_unicos')::int) > 5000), NULL, NULL, 'INFO'
-- ── B3 ──
UNION ALL
SELECT 30, 'B3.1', 'B3', 'huella (md5 de prosrc) de avisos_transaccion_mas_antigua: la exige el pre-vuelo (la de MA)',
       (SELECT antigua FROM h), '10bb6aac66d280186c632a078f607db7', (SELECT antigua FROM h) = '10bb6aac66d280186c632a078f607db7', 'ALTO'
UNION ALL
SELECT 31, 'B3.2', 'B3', 'huella de aviso_visto_hasta_sellar (la de MA) y que hoy es INVOKER con search_path vacío',
       (SELECT sellar FROM h) || ' / ' || (SELECT (NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])::text FROM pg_proc p, f WHERE p.oid = f.sellar),
       '36e828415cdf9e7e5a7f93da8b014712 / true',
       (SELECT sellar FROM h) = '36e828415cdf9e7e5a7f93da8b014712'
       AND (SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] FROM pg_proc p, f WHERE p.oid = f.sellar), 'ALTO'
UNION ALL
SELECT 32, 'B3.3', 'B3', 'aviso_visto_hasta_sellar es el disparador, único y encendido, de avisos_vistos_hasta',
       (SELECT count(*)::text FROM pg_trigger t, f WHERE t.tgfoid = f.sellar AND NOT t.tgisinternal) || ' / '
       || (SELECT count(*)::text FROM pg_trigger t, f WHERE t.tgfoid = f.sellar AND t.tgrelid = to_regclass('public.avisos_vistos_hasta') AND t.tgenabled = 'O'), '1 / 1',
       (SELECT count(*) FROM pg_trigger t, f WHERE t.tgfoid = f.sellar AND NOT t.tgisinternal) = 1
       AND (SELECT count(*) FROM pg_trigger t, f WHERE t.tgfoid = f.sellar AND t.tgrelid = to_regclass('public.avisos_vistos_hasta') AND t.tgenabled = 'O') = 1, 'ALTO'
UNION ALL
SELECT 33, 'B3.4', 'B3', 'otras funciones de public que llaman a avisos_transaccion_mas_antigua (quitarle el EXECUTE a la sesión las rompería)',
       (SELECT count(*)::text FROM pg_proc p, f WHERE p.pronamespace = 'public'::regnamespace AND position('avisos_transaccion_mas_antigua' IN p.prosrc) > 0
           AND p.oid NOT IN (f.sellar, f.antigua)), '0',
       (SELECT count(*) FROM pg_proc p, f WHERE p.pronamespace = 'public'::regnamespace AND position('avisos_transaccion_mas_antigua' IN p.prosrc) > 0
           AND p.oid NOT IN (f.sellar, f.antigua)) = 0, 'ALTO'
UNION ALL
SELECT 34, 'B3.5', 'B3', 'cita_correo_tomar y cita_recordatorios_pendientes son las de R1 (sólo se les pone comentario)',
       (SELECT count(*)::text FROM pg_proc p
         WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND position('R1 · Sólo si ese comprobante salió' IN p.prosrc) > 0), '2',
       (SELECT count(*) FROM pg_proc p
         WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND position('R1 · Sólo si ese comprobante salió' IN p.prosrc) > 0) = 2, 'ALTO'
UNION ALL
SELECT 35, 'B3.6', 'B3', 'transacciones abiertas AHORA en la base, sin contar ésta: cuántas / minutos de la más antigua. Una de muchos minutos retiene la marca de «Marcar todos» (MA 3: se documenta, no se arregla)',
       (SELECT count(*)::text || ' / ' || coalesce(round(extract(epoch FROM now() - min(s.xact_start)) / 60)::text, '—')
          FROM pg_catalog.pg_stat_activity s
         WHERE s.datname = current_database() AND s.pid <> pg_backend_pid() AND s.xact_start IS NOT NULL
           AND s.backend_type NOT LIKE 'autovacuum%' AND s.backend_type <> 'walsender'), NULL, NULL, 'INFO'
UNION ALL
SELECT 36, 'B3.7', 'B3', 'usuarios con marca de «Marcar todos» (avisos_vistos_hasta)',
       (SELECT count(*)::text FROM public.avisos_vistos_hasta), NULL, NULL, 'INFO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
