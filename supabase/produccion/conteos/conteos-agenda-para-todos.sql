-- ═══════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar «agenda para todos» (M3) a producción
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones del pre-vuelo de
--     20261203120000_agenda_para_todos  (M3)
--   reescritas como consultas de SÓLO LECTURA, más lo que sólo los datos
--   reales dicen: cuántas clínicas hay, cuántas tienen fila en agenda_ajustes
--   y en qué estado, cuántas pasará M3 de false a true, cuántas filas creará,
--   y cuántas clínicas tienen Google conectado (la carga que gana la tarea de
--   sincronización al encenderse todas).
--   Si una fila sale ALTO, M3 abortaría en su pre-vuelo (limpia, sin dejar
--   nada) o la base no está como se supone: no se aplica hasta resolverla.
-- QUÉ DEVUELVE: UNA rejilla, una fila por comprobación:
--     id | migración | qué mira | valor | esperado | veredicto
--   veredicto: OK · ALTO (no seguir) · AVISO (seguir sólo tras leerla) · INFO.
--   NUNCA datos de pacientes ni de personas: sólo números, nombres de objetos
--   de la base y versiones. Ningún id de fila, de clínica ni de persona.
-- CÓMO SE CORRE: con el MISMO rol con el que se aplicará (postgres, por el
--   pooler):
--     bash supabase/produccion/conteos/correr-conteos-agenda-para-todos.sh
--   A mano: psql -X -v ON_ERROR_STOP=1 -P pager=off -f <este archivo>
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY y ROLLBACK al final.
--   No crea funciones ni tablas temporales.
-- SUPONE las 9 de la agenda aplicadas (nombra public.agenda_ajustes y
--   public.clinica_conexiones_google).
-- BLOQUEOS: ACCESS SHARE sobre lo que lee. Si una tabla está tomada en
--   exclusiva espera como mucho lock_timeout (2 s) y aborta: repetir.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH
n AS (
  SELECT (SELECT count(*) FROM public.clinicas) AS clinicas,
         (SELECT count(*) FROM public.agenda_ajustes) AS filas,
         (SELECT count(*) FROM public.agenda_ajustes WHERE agenda_v2_encendida) AS encendidas,
         (SELECT count(*) FROM public.agenda_ajustes WHERE NOT agenda_v2_encendida) AS apagadas,
         (SELECT count(*) FROM public.agenda_ajustes WHERE NOT agenda_v2_encendida AND updated_at <> created_at) AS apagadas_tocadas,
         (SELECT count(*) FROM public.clinicas c
           WHERE NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = c.id)) AS sin_fila
),
filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (
SELECT 1, 'G.1', 'M3', 'rol con el que se pregunta (el mismo con el que se aplicará; M3 exige postgres o supabase_admin)',
       current_user::text, 'postgres', current_user IN ('postgres', 'supabase_admin'), 'ALTO'
UNION ALL
SELECT 2, 'G.2', 'M3', 'F1 (20261201120000) en el historial',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261201120000'), '1',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261201120000') = 1, 'ALTO'
UNION ALL
SELECT 3, 'G.3', 'M3', 'M3 en el historial (todavía no)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261203120000'), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261203120000') = 0, 'ALTO'
UNION ALL
SELECT 4, 'G.4', 'M3', 'M1 y M2 de avisos globales en el historial (M3 no depende de ellas; van antes en el orden del guion)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version IN ('20261202120000', '20261202130000')),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 10, 'A.1', 'M3', 'nada de M3 existe todavía (función y disparador de clinicas)',
       ((to_regprocedure('public.agenda_ajustes_de_clinica_nueva()') IS NOT NULL)::int
        + (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.clinicas'::regclass AND tgname = 'trg_clinicas_agenda_ajustes'))::text, '0',
       to_regprocedure('public.agenda_ajustes_de_clinica_nueva()') IS NULL
        AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.clinicas'::regclass AND tgname = 'trg_clinicas_agenda_ajustes'), 'ALTO'
UNION ALL
SELECT 11, 'A.2', 'M3', 'agenda_ajustes.agenda_v2_encendida: boolean NOT NULL DEFAULT false (la de F1)',
       (SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.attnotnull::text || ' / ' || pg_get_expr(d.adbin, d.adrelid)
          FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'agenda_v2_encendida' AND NOT a.attisdropped),
       'boolean / true / false',
       (SELECT a.atttypid = 'boolean'::regtype AND a.attnotnull AND pg_get_expr(d.adbin, d.adrelid) = 'false'
          FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'agenda_v2_encendida' AND NOT a.attisdropped), 'ALTO'
UNION ALL
SELECT 12, 'A.3', 'M3', 'agenda_v2_encendida(uuid): INVOKER, STABLE, search_path vacío y el cuerpo de F1 (huella con los fines de línea normalizados)',
       (SELECT (NOT p.prosecdef)::text || ' / ' || (p.provolatile = 's')::text || ' / ' || (p.proconfig = ARRAY['search_path=""'])::text
               || ' / ' || md5(replace(p.prosrc, E'\r\n', E'\n'))
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')),
       'true / true / true / 18288c1dd2adc17c6ef0b88ee701942b',
       (SELECT NOT p.prosecdef AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=""']
               AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '18288c1dd2adc17c6ef0b88ee701942b'
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')), 'ALTO'
UNION ALL
SELECT 13, 'A.4', 'M3', 'trg_agenda_ajustes_proteger y audit_agenda_ajustes, habilitados',
       (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.agenda_ajustes'::regclass AND NOT tgisinternal AND tgenabled = 'O'
           AND tgname IN ('trg_agenda_ajustes_proteger', 'audit_agenda_ajustes')), '2',
       (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.agenda_ajustes'::regclass AND NOT tgisinternal AND tgenabled = 'O'
           AND tgname IN ('trg_agenda_ajustes_proteger', 'audit_agenda_ajustes')) = 2, 'ALTO'
UNION ALL
SELECT 14, 'A.5', 'M3', 'quien pregunta es dueño de agenda_ajustes y de clinicas',
       (SELECT string_agg(c.relname || '=' || pg_has_role(current_user, c.relowner, 'USAGE')::text, ', ' ORDER BY c.relname)
          FROM pg_class c WHERE c.oid IN ('public.agenda_ajustes'::regclass, 'public.clinicas'::regclass)),
       'agenda_ajustes=true, clinicas=true',
       (SELECT bool_and(pg_has_role(current_user, c.relowner, 'USAGE'))
          FROM pg_class c WHERE c.oid IN ('public.agenda_ajustes'::regclass, 'public.clinicas'::regclass)), 'ALTO'
UNION ALL
SELECT 15, 'A.6', 'M3', 'columnas NOT NULL sin DEFAULT de agenda_ajustes distintas de clinica_id (el relleno no sabría qué poner)',
       (SELECT count(*)::text FROM pg_attribute a WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attnum > 0
           AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef AND a.attname <> 'clinica_id'), '0',
       (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attnum > 0
           AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef AND a.attname <> 'clinica_id') = 0, 'ALTO'
UNION ALL
SELECT 16, 'A.7', 'M3', 'otros disparadores de fila en clinicas (corren junto al nuevo en cada alta de clínica)',
       (SELECT coalesce(string_agg(tgname, ', ' ORDER BY tgname), '(ninguno)') FROM pg_trigger
         WHERE tgrelid = 'public.clinicas'::regclass AND NOT tgisinternal), NULL, NULL, 'INFO'
UNION ALL
SELECT 20, 'B.1', 'M3', 'clínicas', (SELECT clinicas::text FROM n), NULL, NULL, 'INFO'
UNION ALL
SELECT 21, 'B.2', 'M3', 'filas de agenda_ajustes: total / con la v2 ENCENDIDA / con la v2 APAGADA',
       (SELECT filas || ' / ' || encendidas || ' / ' || apagadas FROM n), NULL, NULL, 'INFO'
UNION ALL
SELECT 22, 'B.3', 'M3', 'clínicas SIN fila (M3 les crea la de fábrica, encendida)', (SELECT sin_fila::text FROM n), NULL, NULL, 'INFO'
UNION ALL
SELECT 23, 'B.4', 'M3', 'filas APAGADAS que alguien tocó después de crearlas (¿apagadas a propósito? M3 las ENCIENDE todas)',
       (SELECT apagadas_tocadas::text FROM n), '0', (SELECT apagadas_tocadas = 0 FROM n), 'AVISO'
UNION ALL
SELECT 24, 'B.5', 'M3', 'filas con el recordatorio / el correo a la clínica encendidos (M3 no enciende ninguno)',
       (SELECT count(*) FILTER (WHERE recordatorio_encendido)::text || ' / ' || count(*) FILTER (WHERE correo_reserva_clinica)::text
          FROM public.agenda_ajustes), NULL, NULL, 'INFO'
UNION ALL
SELECT 25, 'B.6', 'M3', 'filas de audit_log que escribirá M3 (una por fila creada y una por fila que pasa a true)',
       (SELECT (sin_fila + apagadas)::text FROM n), NULL, NULL, 'INFO'
UNION ALL
SELECT 30, 'C.1', 'M3', 'clínicas con Google conectado y calendario (las que recorrerá /api/cron/google-sync): total / hoy con la v2 encendida',
       (SELECT count(DISTINCT g.clinica_id)::text || ' / '
               || count(DISTINCT g.clinica_id) FILTER (WHERE EXISTS (SELECT 1 FROM public.agenda_ajustes a
                                                                      WHERE a.clinica_id = g.clinica_id AND a.agenda_v2_encendida))::text
          FROM public.clinica_conexiones_google g
         WHERE g.rol = 'clinica' AND g.estado = 'activa' AND g.calendar_id IS NOT NULL), NULL, NULL, 'INFO'
UNION ALL
SELECT 31, 'C.2', 'M3', 'clínicas suspendidas (M3 las enciende igual; las puertas de suspensión son las de siempre)',
       (SELECT count(*)::text FROM public.clinicas WHERE suspendida IS TRUE), NULL, NULL, 'INFO'
UNION ALL
SELECT 32, 'C.3', 'M3', 'citas con paciente, de hoy en adelante, en clínicas que M3 va a encender (dejarán de poder BORRARSE: se cancelan)',
       (SELECT count(*)::text FROM public.appointments ap
         WHERE ap.paciente_id IS NOT NULL AND ap.start_time >= now()
           AND NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = ap.clinica_id AND a.agenda_v2_encendida)),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 33, 'C.5', 'M3', 'citas agendadas o confirmadas, con paciente, de hace más de 48 h y sin nota, en clínicas que M3 va a encender: total / la clínica que más tiene (la agenda nueva preguntará «¿Asistió el paciente?» por ellas, de 50 en 50)',
       (SELECT coalesce(sum(x.n), 0)::text || ' / ' || coalesce(max(x.n), 0)::text
          FROM (SELECT count(*) AS n FROM public.appointments ap
                 WHERE ap.status IN ('scheduled', 'confirmed') AND NOT ap.all_day AND ap.paciente_id IS NOT NULL
                   AND ap.start_time < now() - interval '48 hours'
                   AND NOT EXISTS (SELECT 1 FROM public.consultas k WHERE k.appointment_id = ap.id)
                   AND NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a WHERE a.clinica_id = ap.clinica_id AND a.agenda_v2_encendida)
                 GROUP BY ap.clinica_id) x),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 34, 'C.4', 'M3', 'sesiones con candado fuerte sobre clinicas o agenda_ajustes en este momento (M3 esperaría 5 s y abortaría limpia)',
       (SELECT count(DISTINCT l.pid)::text FROM pg_locks l
         WHERE l.relation IN ('public.clinicas'::regclass, 'public.agenda_ajustes'::regclass) AND l.granted AND l.pid <> pg_backend_pid()
           AND l.mode IN ('ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')), '0',
       (SELECT count(DISTINCT l.pid) FROM pg_locks l
         WHERE l.relation IN ('public.clinicas'::regclass, 'public.agenda_ajustes'::regclass) AND l.granted AND l.pid <> pg_backend_pid()
           AND l.mode IN ('ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')) = 0, 'AVISO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
