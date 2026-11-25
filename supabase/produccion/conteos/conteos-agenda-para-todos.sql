-- ═══════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar el bloque «agenda para todos» (MA, M4, M5 y M3) a producción
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones de los pre-vuelos de las cuatro migraciones del bloque
--   «agenda para todos», en el orden en que se aplican:
--     20261203130000_avisos_globales_cierre_auditoria  (MA; filas D.*)
--     20261204120000_reserva_purga_y_tope              (M4; filas E.*)
--     20261205120000_gcal_empalmes_pendientes          (M5; filas F.*)
--     20261206120000_agenda_para_todos                 (M3; filas G.*, A.*, B.*, C.*)
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
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261206120000'), '0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261206120000') = 0, 'ALTO'
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
SELECT 33, 'C.5', 'M3', 'citas agendadas o confirmadas, con paciente, de hace más de 48 h y sin nota, en clínicas que M3 va a encender: por las que la agenda nueva preguntará «¿Asistió el paciente?» (últimos 30 días, de 50 en 50) / las de la clínica que más tiene / las anteriores a 30 días, que quedan FUERA (no se preguntan ni se tocan) / las de la clínica que más tiene fuera',
       (SELECT coalesce(sum(x.n), 0)::text || ' / ' || coalesce(max(x.n), 0)::text || ' / ' || coalesce(sum(x.fuera), 0)::text || ' / ' || coalesce(max(x.fuera), 0)::text
          FROM (SELECT count(*) FILTER (WHERE ap.start_time >= now() - interval '30 days') AS n,
                       count(*) FILTER (WHERE ap.start_time < now() - interval '30 days') AS fuera
                  FROM public.appointments ap
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

-- ══ MA · 20261203130000_avisos_globales_cierre_auditoria ══
UNION ALL
SELECT 40, 'D.1', 'MA', 'MA en el historial (todavía no) / su función ya existe',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261203130000') || ' / '
       || (to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NOT NULL)::text, '0 / false',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261203130000') = 0
        AND to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NULL, 'ALTO'
UNION ALL
SELECT 41, 'D.2', 'MA', 'M1 aplicada (20261202120000 en el historial)',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261202120000'), '1',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261202120000') = 1, 'ALTO'
UNION ALL
SELECT 42, 'D.3', 'MA', 'las tres funciones de M1 que MA reescribe, con el cuerpo de M1 (huella con los fines de línea normalizados)',
       (SELECT count(*)::text FROM pg_proc p
         WHERE (p.oid, md5(replace(p.prosrc, E'\r\n', E'\n'))) IN (
                 (to_regprocedure('public.aviso_visto_hasta_sellar()'), '839f7457daa2d7c618daaea254106d7e'),
                 (to_regprocedure('public.avisos_revisar_todos(timestamptz)'), '5e1f662fee337d583e590d377425aec4'),
                 (to_regprocedure('public.aviso_clinica_de_cambio_medico()'), '200f5f6fec02d59bea2e51686ebf3a43'))), '3',
       (SELECT count(*) FROM pg_proc p
         WHERE (p.oid, md5(replace(p.prosrc, E'\r\n', E'\n'))) IN (
                 (to_regprocedure('public.aviso_visto_hasta_sellar()'), '839f7457daa2d7c618daaea254106d7e'),
                 (to_regprocedure('public.avisos_revisar_todos(timestamptz)'), '5e1f662fee337d583e590d377425aec4'),
                 (to_regprocedure('public.aviso_clinica_de_cambio_medico()'), '200f5f6fec02d59bea2e51686ebf3a43'))) = 3, 'ALTO'
UNION ALL
SELECT 43, 'D.4', 'MA', 'quien aplica ve las transacciones de las demás sesiones (superusuario o miembro de pg_read_all_stats)',
       ((SELECT rolsuper FROM pg_roles WHERE rolname = current_user) OR pg_has_role(current_user, 'pg_read_all_stats', 'USAGE'))::text, 'true',
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) OR pg_has_role(current_user, 'pg_read_all_stats', 'USAGE'), 'ALTO'
UNION ALL
SELECT 44, 'D.5', 'MA', 'avisos con cita: total / sin copia del médico / con copia vieja (MA rellena las dos últimas; una fila de audit_log por cada una)',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE a.medico_id IS NULL AND ap.medico_id IS NOT NULL)::text || ' / '
               || count(*) FILTER (WHERE a.medico_id IS NOT NULL AND a.medico_id IS DISTINCT FROM ap.medico_id)::text
          FROM public.avisos_clinica a JOIN public.appointments ap ON ap.id = a.cita_id AND ap.clinica_id = a.clinica_id), NULL, NULL, 'INFO'
UNION ALL
SELECT 45, 'D.6', 'MA', 'hallazgo 3 de la auditoría de M1 · restricciones o índices de avisos_clinica que NO son los de M1 (puestos a mano; el pre-vuelo de M1 no los mira al re-aplicar)',
       coalesce((SELECT string_agg(x.n, ', ' ORDER BY x.n) FROM (
                   SELECT conname::text AS n FROM pg_constraint WHERE conrelid = to_regclass('public.avisos_clinica')
                      AND conname NOT IN ('avisos_clinica_cita_tipo_check', 'avisos_clinica_clinica_id_fkey', 'avisos_clinica_datos_check',
                                          'avisos_clinica_pkey', 'avisos_clinica_revisado_check', 'avisos_clinica_tipo_check')
                   UNION ALL
                   SELECT c.relname::text FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = to_regclass('public.avisos_clinica')
                      AND c.relname NOT IN ('avisos_clinica_pkey', 'avisos_clinica_pendiente_key', 'avisos_clinica_pendientes_idx', 'avisos_clinica_clinica_idx',
                                            'avisos_clinica_medico_pendientes_idx', 'avisos_clinica_cita_idx', 'avisos_clinica_sin_cita_key')) x), '(ninguno)'),
       '(ninguno)',
       NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.avisos_clinica')
                      AND conname NOT IN ('avisos_clinica_cita_tipo_check', 'avisos_clinica_clinica_id_fkey', 'avisos_clinica_datos_check',
                                          'avisos_clinica_pkey', 'avisos_clinica_revisado_check', 'avisos_clinica_tipo_check'))
        AND NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = to_regclass('public.avisos_clinica')
                      AND c.relname NOT IN ('avisos_clinica_pkey', 'avisos_clinica_pendiente_key', 'avisos_clinica_pendientes_idx', 'avisos_clinica_clinica_idx',
                                            'avisos_clinica_medico_pendientes_idx', 'avisos_clinica_cita_idx', 'avisos_clinica_sin_cita_key')), 'AVISO'
-- ══ M4 · 20261204120000_reserva_purga_y_tope ══
UNION ALL
SELECT 50, 'E.1', 'M4', 'M4 en el historial (todavía no) / su función o sus índices ya existen',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261204120000') || ' / '
       || ((to_regprocedure('public.reserva_purgar(integer)') IS NOT NULL)::int
           + (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
                AND relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')))::text, '0 / 0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261204120000') = 0
        AND to_regprocedure('public.reserva_purgar(integer)') IS NULL
        AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace
                           AND relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')), 'ALTO'
UNION ALL
SELECT 51, 'E.2', 'M4', 'reserva_codigo_emitir: INVOKER, search_path vacío y el cuerpo de F3 (huella con los fines de línea normalizados)',
       (SELECT (NOT p.prosecdef)::text || ' / ' || (p.proconfig = ARRAY['search_path=""'])::text || ' / ' || md5(replace(p.prosrc, E'\r\n', E'\n'))
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')),
       'true / true / 3885430cced1c390068f8c6a168d0ddb',
       (SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '3885430cced1c390068f8c6a168d0ddb'
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')), 'ALTO'
UNION ALL
SELECT 52, 'E.3', 'M4', 'proteger_reserva_enlace_unico: INVOKER, deja pasar sólo a postgres y supabase_admin, guarda el correo, y su disparador está habilitado',
       (SELECT (NOT p.prosecdef AND position('current_user IN (''postgres'', ''supabase_admin'')' IN p.prosrc) > 0
                AND position('(NEW.correo, NEW.correo_hmac) IS DISTINCT FROM (OLD.correo, OLD.correo_hmac)' IN p.prosrc) > 0)::text
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.proteger_reserva_enlace_unico()')) || ' / '
       || (SELECT count(*)::text FROM pg_trigger g WHERE g.tgrelid = to_regclass('public.reserva_enlaces') AND NOT g.tgisinternal AND g.tgenabled = 'O'
             AND g.tgfoid = to_regprocedure('public.proteger_reserva_enlace_unico()')), 'true / 1',
       (SELECT NOT p.prosecdef AND position('current_user IN (''postgres'', ''supabase_admin'')' IN p.prosrc) > 0
               AND position('(NEW.correo, NEW.correo_hmac) IS DISTINCT FROM (OLD.correo, OLD.correo_hmac)' IN p.prosrc) > 0
          FROM pg_proc p WHERE p.oid = to_regprocedure('public.proteger_reserva_enlace_unico()'))
        AND (SELECT count(*) FROM pg_trigger g WHERE g.tgrelid = to_regclass('public.reserva_enlaces') AND NOT g.tgisinternal AND g.tgenabled = 'O'
               AND g.tgfoid = to_regprocedure('public.proteger_reserva_enlace_unico()')) = 1, 'ALTO'
UNION ALL
SELECT 53, 'E.4', 'M4', 'tablas que apuntan con una FK a reserva_verificaciones o a ip_rate_limits (la purga las borra)',
       (SELECT count(*)::text FROM pg_constraint WHERE contype = 'f'
           AND confrelid IN (to_regclass('public.reserva_verificaciones'), to_regclass('public.ip_rate_limits'))), '0',
       (SELECT count(*) FROM pg_constraint WHERE contype = 'f'
           AND confrelid IN (to_regclass('public.reserva_verificaciones'), to_regclass('public.ip_rate_limits'))) = 0, 'ALTO'
UNION ALL
SELECT 54, 'E.5', 'M4', 'quien pregunta es dueño de reserva_verificaciones y de ip_rate_limits (crea sus índices)',
       (SELECT string_agg(c.relname || '=' || pg_has_role(current_user, c.relowner, 'USAGE')::text, ', ' ORDER BY c.relname)
          FROM pg_class c WHERE c.oid IN (to_regclass('public.reserva_verificaciones'), to_regclass('public.ip_rate_limits'))),
       'ip_rate_limits=true, reserva_verificaciones=true',
       (SELECT bool_and(pg_has_role(current_user, c.relowner, 'USAGE'))
          FROM pg_class c WHERE c.oid IN (to_regclass('public.reserva_verificaciones'), to_regclass('public.ip_rate_limits'))), 'ALTO'
UNION ALL
SELECT 55, 'E.6', 'M4', 'códigos de verificación: total / de más de 30 días (los borrará la primera pasada de la tarea)',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE created_at < now() - interval '30 days')::text FROM public.reserva_verificaciones),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 56, 'E.7', 'M4', 'intentos de límites (ip_rate_limits): total / de más de 30 días (los borrará la primera pasada)',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE created_at < now() - interval '30 days')::text FROM public.ip_rate_limits),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 57, 'E.8', 'M4', 'enlaces de un solo uso con correo: total / que dejaron de servir hace más de 30 días (su correo se vaciará en la primera pasada)',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE least(e.usado_en, e.revocado_en, e.agotado_en, e.caduca_en) < now() - interval '30 days')::text
          FROM public.reserva_enlaces e WHERE e.clase = 'unico' AND e.correo IS NOT NULL), NULL, NULL, 'INFO'
UNION ALL
SELECT 58, 'E.9', 'M4', 'la ventana más larga que alguien cuenta sobre ip_rate_limits es de 24 h: filas de más de 24 h que siguen ahí (restos que nadie limpia)',
       (SELECT count(*)::text FROM public.ip_rate_limits WHERE created_at < now() - interval '24 hours'), NULL, NULL, 'INFO'
-- ══ M5 · 20261205120000_gcal_empalmes_pendientes ══
UNION ALL
SELECT 60, 'F.1', 'M5', 'M5 en el historial (todavía no) / su tabla, sus funciones o sus disparadores ya existen',
       (SELECT count(*)::text FROM supabase_migrations.schema_migrations h WHERE h.version = '20261205120000') || ' / '
       || ((to_regclass('public.gcal_empalmes_pendientes') IS NOT NULL)::int + (to_regprocedure('public.gcal_empalme_apuntar()') IS NOT NULL)::int
           + (to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NOT NULL)::int
           + (SELECT count(*) FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                AND tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')))::text, '0 / 0',
       (SELECT count(*) FROM supabase_migrations.schema_migrations h WHERE h.version = '20261205120000') = 0
        AND to_regclass('public.gcal_empalmes_pendientes') IS NULL AND to_regprocedure('public.gcal_empalme_apuntar()') IS NULL
        AND to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NULL
        AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                           AND tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')), 'ALTO'
UNION ALL
SELECT 61, 'F.2', 'M5', 'reserva_empalmes_registrar de F2: existe, INVOKER y la ejecuta service_role',
       (to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])') IS NOT NULL
        AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])'))
        AND has_function_privilege('service_role', 'public.reserva_empalmes_registrar(uuid, uuid[])', 'EXECUTE'))::text, 'true',
       to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])') IS NOT NULL
        AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])'))
        AND has_function_privilege('service_role', 'public.reserva_empalmes_registrar(uuid, uuid[])', 'EXECUTE'), 'ALTO'
UNION ALL
SELECT 62, 'F.3', 'M5', 'funciones que ponen spinus.via = google antes de escribir la cita (las de F2; hacen falta 2 o más)',
       (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
           AND position('set_config(''spinus.via'', ''google'', true)' IN p.prosrc) > 0), NULL,
       (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
           AND position('set_config(''spinus.via'', ''google'', true)' IN p.prosrc) > 0) >= 2, 'ALTO'
UNION ALL
SELECT 63, 'F.4', 'M5', 'disparadores de fila que ya tiene appointments (M5 añade 2, que sólo se ejecutan con la vía de Google)',
       (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND NOT tgisinternal), NULL, NULL, 'INFO'
UNION ALL
SELECT 64, 'F.5', 'M5', 'quien pregunta es dueño de appointments',
       (SELECT pg_has_role(current_user, relowner, 'USAGE')::text FROM pg_class WHERE oid = to_regclass('public.appointments')), 'true',
       (SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class WHERE oid = to_regclass('public.appointments')), 'ALTO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
