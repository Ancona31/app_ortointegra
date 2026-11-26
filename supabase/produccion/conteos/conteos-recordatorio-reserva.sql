-- ═══════════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar R1 (20261207120000_recordatorio_tras_comprobante) a producción
-- ───────────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones del pre-vuelo de R1 como consultas de SÓLO LECTURA, más lo que sólo los
--   datos reales dicen: cuántas citas futuras reservadas por enlace están HOY sin recordatorio por
--   el defecto y lo recibirían tras aplicar, y cuántas clínicas tienen el recordatorio a 1 hora
--   (una ventana vacía: no sale ninguno; ver docs/spec/recordatorio-reserva/ENSAYO.md, §5).
--   Si una fila sale ALTO, R1 abortaría en su pre-vuelo (limpia) o la base no está como se supone.
-- QUÉ DEVUELVE: UNA rejilla: id | migración | qué mira | valor | esperado | veredicto
--   (OK · ALTO · AVISO · INFO). NUNCA datos de personas: sólo números, nombres de objetos y huellas.
-- CÓMO SE CORRE: con el MISMO rol con el que se aplicará (postgres, por el pooler):
--     bash supabase/produccion/conteos/correr-conteos-recordatorio-reserva.sh
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY y ROLLBACK al final.
-- SUPONE las 15 del plan aplicadas (nombra public.cita_correos y public.agenda_ajustes).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (
SELECT 1, 'R.1', 'R1', 'rol con el que se pregunta (el mismo con el que se aplicará)',
       current_user::text, 'postgres', current_user IN ('postgres', 'supabase_admin'), 'ALTO'
UNION ALL
SELECT 2, 'R.2', 'R1', 'versiones del plan en el historial, de 20261125170000 a 20261206120000 (las 15 anteriores)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261206120000'), '15',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261206120000') = 15, 'ALTO'
UNION ALL
SELECT 3, 'R.3', 'R1', 'R1 ya registrada en el historial (20261207120000)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version = '20261207120000'), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20261207120000') = 0, 'ALTO'
UNION ALL
SELECT 4, 'R.4', 'R1', 'huella (md5 de prosrc) de cita_correo_tomar: la exige el pre-vuelo',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')), '292eec972d66bd6ab312c4797c8c65fc',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')) = '292eec972d66bd6ab312c4797c8c65fc', 'ALTO'
UNION ALL
SELECT 5, 'R.5', 'R1', 'huella (md5 de prosrc) de cita_recordatorios_pendientes: la exige el pre-vuelo',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')), 'be18fa7735f7bf072bdc8178125694d0',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')) = 'be18fa7735f7bf072bdc8178125694d0', 'ALTO'
UNION ALL
SELECT 6, 'R.6', 'R1', 'las dos: INVOKER, search_path vacío, sólo de service_role, y quien pregunta es su dueño',
       (SELECT count(*)::text FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND pg_has_role(current_user, p.proowner, 'USAGE')
           AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
           AND has_function_privilege('service_role', p.oid, 'EXECUTE')), '2',
       (SELECT count(*) FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND pg_has_role(current_user, p.proowner, 'USAGE')
           AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
           AND has_function_privilege('service_role', p.oid, 'EXECUTE')) = 2, 'ALTO'
UNION ALL
SELECT 7, 'R.7', 'R1', 'columnas de cita_correos que nombra R1 (7)',
       (SELECT count(*)::text FROM pg_attribute WHERE attrelid = to_regclass('public.cita_correos') AND NOT attisdropped
           AND attname IN ('appointment_id', 'clinica_id', 'tipo', 'inicio_cita', 'estado', 'tomado_en', 'enviado_en')), '7',
       (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.cita_correos') AND NOT attisdropped
           AND attname IN ('appointment_id', 'clinica_id', 'tipo', 'inicio_cita', 'estado', 'tomado_en', 'enviado_en')) = 7, 'ALTO'
UNION ALL
SELECT 10, 'R.8', 'R1', 'clínicas con el recordatorio encendido (y la v2): total / por horas de antelación (horas×clínicas)',
       (SELECT count(*)::text FROM public.agenda_ajustes WHERE agenda_v2_encendida AND recordatorio_encendido) || ' / '
       || coalesce((SELECT string_agg(h || '×' || n, ', ' ORDER BY h)
                      FROM (SELECT recordatorio_horas AS h, count(*) AS n FROM public.agenda_ajustes
                             WHERE agenda_v2_encendida AND recordatorio_encendido GROUP BY 1) x), '—'), NULL, NULL, 'INFO'
UNION ALL
SELECT 11, 'R.9', 'R1', 'HOY SIN RECORDATORIO POR EL DEFECTO y lo recibirán tras aplicar: citas a más de 1 h, con comprobante enviado ANTES de su ventana y sin recordatorio',
       (SELECT count(*)::text FROM public.agenda_ajustes j JOIN public.appointments a ON a.clinica_id = j.clinica_id
         WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
           AND a.start_time > now() + interval '1 hour' AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
           AND NOT EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                              AND k.inicio_cita = a.start_time AND k.tipo = 'recordatorio')
           AND EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                          AND k.inicio_cita = a.start_time AND k.tipo = 'comprobante' AND k.estado = 'enviado'
                          AND coalesce(k.enviado_en, k.tomado_en) < a.start_time - make_interval(hours => j.recordatorio_horas))), NULL, NULL, 'INFO'
UNION ALL
SELECT 12, 'R.10', 'R1', 'de ésas, las que YA están dentro de su ventana: la tarea las manda en su primera pasada tras aplicar (un correo por cita, de golpe)',
       (SELECT count(*)::text FROM public.agenda_ajustes j JOIN public.appointments a ON a.clinica_id = j.clinica_id
         WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
           AND a.start_time > now() + interval '1 hour' AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
           AND NOT EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                              AND k.inicio_cita = a.start_time AND k.tipo = 'recordatorio')
           AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
           AND EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                          AND k.inicio_cita = a.start_time AND k.tipo = 'comprobante' AND k.estado = 'enviado'
                          AND coalesce(k.enviado_en, k.tomado_en) < a.start_time - make_interval(hours => j.recordatorio_horas))), NULL, NULL, 'INFO'
UNION ALL
SELECT 13, 'R.11', 'R1', 'citas a más de 1 h con comprobante enviado YA DENTRO de su ventana: siguen sin recordatorio, a propósito (reciben uno)',
       (SELECT count(*)::text FROM public.agenda_ajustes j JOIN public.appointments a ON a.clinica_id = j.clinica_id
         WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
           AND a.start_time > now() + interval '1 hour' AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
           AND NOT EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                              AND k.inicio_cita = a.start_time AND k.tipo = 'recordatorio')
           AND EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                          AND k.inicio_cita = a.start_time AND k.tipo = 'comprobante' AND k.estado = 'enviado'
                          AND coalesce(k.enviado_en, k.tomado_en) >= a.start_time - make_interval(hours => j.recordatorio_horas))), NULL, NULL, 'INFO'
UNION ALL
SELECT 14, 'R.12', 'R1', 'citas de los últimos 7 días que se quedaron sin recordatorio por el defecto (ya pasaron: no se recuperan)',
       (SELECT count(*)::text FROM public.agenda_ajustes j JOIN public.appointments a ON a.clinica_id = j.clinica_id
         WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
           AND a.start_time <= now() + interval '1 hour' AND a.start_time > now() - interval '7 days'
           AND a.status IN ('scheduled', 'confirmed', 'attended', 'no_show') AND NOT a.all_day
           AND NOT EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                              AND k.inicio_cita = a.start_time AND k.tipo = 'recordatorio')
           AND EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                          AND k.inicio_cita = a.start_time AND k.tipo = 'comprobante' AND k.estado = 'enviado'
                          AND coalesce(k.enviado_en, k.tomado_en) < a.start_time - make_interval(hours => j.recordatorio_horas))), NULL, NULL, 'INFO'
UNION ALL
SELECT 15, 'R.13', '—', 'clínicas con recordatorio_horas = 1 (encendido / total): su ventana (más de 1 h, hasta 1 h) está VACÍA y no sale ningún recordatorio',
       (SELECT count(*) FILTER (WHERE recordatorio_encendido)::text || ' / ' || count(*)::text FROM public.agenda_ajustes WHERE recordatorio_horas = 1),
       '0 / 0', (SELECT count(*) FROM public.agenda_ajustes WHERE recordatorio_horas = 1) = 0, 'AVISO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
