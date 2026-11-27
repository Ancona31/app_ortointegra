-- ═══════════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar R2 (20261208120000_recordatorio_piso_30_min) a producción
-- ───────────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones del pre-vuelo de R2 como consultas de SÓLO LECTURA, más lo que sólo los
--   datos reales dicen: cuántas clínicas tienen el recordatorio a 1 hora (hoy no les sale ninguno) y
--   cuántos recordatorios saldrían en la primera pasada de la tarea tras aplicar.
-- QUÉ DEVUELVE: UNA rejilla: id | migración | qué mira | valor | esperado | veredicto
--   (OK · ALTO · AVISO · INFO). NUNCA datos de personas: sólo números, nombres de objetos y huellas.
-- CÓMO SE CORRE: con el MISMO rol con el que se aplicará (postgres, por el pooler):
--     bash supabase/produccion/conteos/correr-conteos-recordatorio-piso.sh
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY y ROLLBACK al final.
-- SUPONE las 16 del plan aplicadas (hasta R1, 20261207120000).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (
SELECT 1, 'P.1', 'R2', 'rol con el que se pregunta (el mismo con el que se aplicará)',
       current_user::text, 'postgres', current_user IN ('postgres', 'supabase_admin'), 'ALTO'
UNION ALL
SELECT 2, 'P.2', 'R2', 'versiones del plan en el historial, de 20261125170000 a 20261207120000 (las 16 anteriores)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261207120000'), '16',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20261125170000' AND '20261207120000') = 16, 'ALTO'
UNION ALL
SELECT 3, 'P.3', 'R2', 'R2 ya registrada en el historial (20261208120000)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version = '20261208120000'), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20261208120000') = 0, 'ALTO'
UNION ALL
SELECT 4, 'P.4', 'R2', 'huella (md5 de prosrc) de cita_correo_tomar: la de R1, la exige el pre-vuelo',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')), '0339111d435e4592acb45261bd412f84',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')) = '0339111d435e4592acb45261bd412f84', 'ALTO'
UNION ALL
SELECT 5, 'P.5', 'R2', 'huella (md5 de prosrc) de cita_recordatorios_pendientes: la de R1, la exige el pre-vuelo',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')), 'dee6e983be793c1145b8c56bcb89937f',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')) = 'dee6e983be793c1145b8c56bcb89937f', 'ALTO'
UNION ALL
SELECT 6, 'P.6', 'R2', 'las dos: INVOKER, search_path vacío, sólo de service_role, y quien pregunta es su dueño',
       (SELECT count(*) FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND pg_has_role(current_user, p.proowner, 'USAGE')
           AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
           AND has_function_privilege('service_role', p.oid, 'EXECUTE'))::text, '2', (SELECT count(*) FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
           AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND pg_has_role(current_user, p.proowner, 'USAGE')
           AND NOT has_function_privilege('anon', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
           AND has_function_privilege('service_role', p.oid, 'EXECUTE')) = 2, 'ALTO'
UNION ALL
SELECT 10, 'P.7', 'R2', 'clínicas con el recordatorio encendido (y la v2): total / por horas de antelación (horas×clínicas)',
       (SELECT count(*)::text FROM public.agenda_ajustes WHERE agenda_v2_encendida AND recordatorio_encendido) || ' / '
       || coalesce((SELECT string_agg(h || '×' || n, ', ' ORDER BY h)
                      FROM (SELECT recordatorio_horas AS h, count(*) AS n FROM public.agenda_ajustes
                             WHERE agenda_v2_encendida AND recordatorio_encendido GROUP BY 1) x), '—'), NULL, NULL, 'INFO'
UNION ALL
SELECT 11, 'P.8', 'R2', 'clínicas con recordatorio_horas = 1 (encendido / total): hoy su ventana está vacía; tras R2 es (30 min, 1 h]',
       (SELECT count(*) FILTER (WHERE recordatorio_encendido)::text || ' / ' || count(*)::text FROM public.agenda_ajustes WHERE recordatorio_horas = 1),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 12, 'P.9', 'R2', 'AHORA MISMO: citas con destinatario a las que faltan entre 30 y 60 min, dentro de su ventana y sin recordatorio (las que R2 añade a la primera pasada; no mira el comprobante)',
       (SELECT count(*)::text FROM public.agenda_ajustes j JOIN public.appointments a ON a.clinica_id = j.clinica_id
         LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
         WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
           AND a.start_time > now() + interval '30 minutes' AND a.start_time <= now() + interval '1 hour'
           AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
           AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
           AND (CASE WHEN a.paciente_id IS NOT NULL
                     THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
                     ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id
                              AND k.inicio_cita = a.start_time AND k.tipo = 'recordatorio')), NULL, NULL, 'INFO'
UNION ALL
SELECT 13, 'P.10', 'R2', 'recordatorios enviados en los últimos 7 días (para comparar el volumen)',
       (SELECT count(*)::text FROM public.cita_correos WHERE tipo = 'recordatorio' AND estado = 'enviado' AND enviado_en > now() - interval '7 days'),
       NULL, NULL, 'INFO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
