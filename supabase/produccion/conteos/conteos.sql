-- ═══════════════════════════════════════════════════════════════════════
-- Conteos ANTES de aplicar el conjunto a producción (bloque 7.1)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ ES: las condiciones de los pre-vuelos (y de los post-vuelos que miran
--   el estado de antes) de las 8 migraciones nuevas, reescritas como
--   consultas de SÓLO LECTURA, más lo que depende de la versión, del
--   historial de migraciones, del tamaño de las tablas y de la actividad en
--   ese momento. Si una fila sale ALTO, la migración que nombra abortaría en
--   su pre-vuelo (o el estado no es el que el conjunto supone): no se aplica
--   nada hasta resolverla. Qué hacer con cada fila: LEEME.md.
--     20261125170000_audit_log_sin_truncate          (M1)
--     20261126120000_public_sin_truncate             (M2)
--     20261201120000_agenda_f1_ajustes_tipos_horarios (F1)
--     20261201130000_agenda_f5a_bloqueos             (F5a)
--     20261201140000_agenda_f3_reserva_enlace        (F3)
--     20261201150000_agenda_f2_google                (F2)
--     20261201160000_agenda_f4_confirmacion_correos_avisos (F4)
--     20261201170000_agenda_f5b_protecciones_cita    (F5b)
-- QUÉ DEVUELVE: UNA rejilla, una fila por comprobación:
--     id | migración | qué mira | valor | esperado | veredicto
--   veredicto: OK · ALTO (no seguir) · AVISO (seguir sólo tras leer el LEEME)
--   · INFO (sólo informa). NUNCA datos de pacientes ni de personas: sólo
--   números, nombres de objetos de la base, nombres de roles y versiones.
--   Ningún id de fila, de clínica ni de persona.
-- CÓMO SE CORRE: entero, con el MISMO rol con el que se aplicarán las
--   migraciones (postgres, por el pooler). Lo cómodo:
--     bash supabase/produccion/conteos/correr-conteos.sh
--   (pide la contraseña con read -rs y guarda la rejilla). A mano:
--     psql -X -v ON_ERROR_STOP=1 -P pager=off -f supabase/produccion/conteos/conteos.sql
--   En el SQL Editor de Supabase se puede pegar entero; si el editor sólo
--   enseña el resultado de la última sentencia (el ROLLBACK), pega sólo el
--   SELECT: todo él es de lectura.
-- POR QUÉ NO ESCRIBE NADA: BEGIN TRANSACTION READ ONLY (Postgres rechaza
--   cualquier escritura, también de catálogo) y ROLLBACK al final. No crea
--   funciones ni tablas temporales: las cuentas sobre tablas que pueden no
--   existir van con query_to_xml, que sólo lee. Las cuentas de filas son de
--   main (consultorios, el historial y, si existiera, el respaldo de F1);
--   appointments NO se recorre: su tamaño sale de pg_class.reltuples.
-- BLOQUEOS: ACCESS SHARE sobre lo que lee (como cualquier SELECT). Si una
--   tabla está tomada en exclusiva, espera como mucho lock_timeout (2 s) y
--   aborta con error: entonces es G.15 la que tiene la respuesta; repetir.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH
-- Roles de Supabase que nombran las migraciones (to_regrole: si faltara uno, NULL y su fila lo dice).
r AS (
  SELECT to_regrole('anon') AS anon, to_regrole('authenticated') AS authn, to_regrole('service_role') AS srv
),
-- Historial de migraciones, sin depender de que la tabla exista.
h AS (
  SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS existe,
         CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN ARRAY[]::text[]
              ELSE (SELECT coalesce(array_agg(v::text ORDER BY v::text), ARRAY[]::text[])
                      FROM unnest(xpath('/table/row/version/text()',
                                        query_to_xml('SELECT version FROM supabase_migrations.schema_migrations',
                                                     false, false, ''))) v)
         END AS versiones
),
-- Las 13 versiones del repo (supabase/migrations/, sin descartadas/).
repo AS (
  SELECT ARRAY['20260912190416', '20260913', '20260914', '20260919', '20260919230000'] AS main,
         ARRAY['20261125170000', '20261126120000', '20261201120000', '20261201130000', '20261201140000',
               '20261201150000', '20261201160000', '20261201170000'] AS nuevas
),
-- Las 11 tablas clínicas de M2.
m2 AS (
  SELECT ARRAY['addendums', 'appointments', 'calculadora_resultados', 'casos_clinicos', 'casos_clinicos_recursos',
               'consultas', 'documentos', 'mediciones_analitos', 'paciente_medico', 'pacientes', 'solicitudes_arco'] AS tablas
),
-- Cada (tabla de public, rol) con TRUNCATE efectivo que un REVOKE hecho por el dueño NO quitaría:
-- concedido a PUBLIC, concedido por otro otorgante, o heredado por pertenencia a otro rol.
trunc_resiste AS (
  SELECT c.oid, c.relname, x.rol
    FROM pg_class c
   CROSS JOIN LATERAL (VALUES ('anon'), ('authenticated'), ('service_role')) x(rol)
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
     AND to_regrole(x.rol) IS NOT NULL
     AND has_table_privilege(x.rol, c.oid, 'TRUNCATE')
     AND EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                  WHERE a.privilege_type = 'TRUNCATE'
                    AND (a.grantee = 0
                         OR (a.grantee = to_regrole(x.rol) AND a.grantor <> c.relowner)
                         OR (a.grantee <> to_regrole(x.rol) AND pg_has_role(to_regrole(x.rol), a.grantee, 'USAGE'))))
),
-- Comprobación de forma de la puerta S3 (copia de gcal_sync_clinica_habilitada de F2).
s3 AS (
  SELECT f.puerta,
         p.prosrc AS src,
         btrim(replace(p.prosrc, 'public.get_clinica_id()', '$1'), E' \t\r\n;') AS sql_sust,
         p.prosecdef AS definer
    FROM (VALUES ('public.clinica_no_suspendida()'), ('public.clinica_tiene_acceso()')) f(puerta)
    LEFT JOIN pg_proc p ON p.oid = to_regprocedure(f.puerta)
                       AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql')
                       AND p.prorettype = 'pg_catalog.bool'::regtype AND NOT p.proretset
),
filas (orden, id, migracion, que, valor, esperado, ok, si_falla) AS (

-- ─── G · general ─────────────────────────────────────────────────────
SELECT 1, 'G.01', 'todas', 'versión de PostgreSQL (F3 concede MAINTAIN, que sólo existe desde la 17; CREATE OR REPLACE TRIGGER pide 14)',
       current_setting('server_version'), '≥ 17',
       current_setting('server_version_num')::int >= 170000, 'ALTO'
UNION ALL
SELECT 2, 'G.02', 'F4 (y todas)', 'rol con el que se corre esto (= el que aplicará); F4 exige postgres exacto',
       current_user::text, 'postgres', current_user = 'postgres', 'ALTO'
UNION ALL
SELECT 3, 'G.03', 'F5b', 'atributos del rol: BYPASSRLS (F5b, cita_tiene_nota_ligada) / superusuario / miembro de supabase_admin',
       (SELECT rolbypassrls::text || ' / ' || rolsuper::text FROM pg_roles WHERE rolname = current_user)
         || ' / ' || coalesce(pg_has_role(current_user, to_regrole('supabase_admin'), 'MEMBER')::text, 'sin supabase_admin'),
       'true / (cualquiera) / (cualquiera)',
       coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false), 'ALTO'
UNION ALL
SELECT 4, 'G.04', 'F3, F2', 'search_path de la sesión con public visible (sin él abortan los post-vuelos de F3 y F2, que comparan nombres de función sin esquema; comprobado)',
       current_setting('search_path') || ' → public visible: '
         || coalesce(pg_function_is_visible(to_regprocedure('public.get_clinica_id()'))::text, 'sin get_clinica_id'),
       'public visible: true',
       coalesce(pg_function_is_visible(to_regprocedure('public.get_clinica_id()')), false), 'ALTO'
UNION ALL
SELECT 5, 'G.05', 'F2, F3, F4', 'service_role existe y tiene BYPASSRLS',
       coalesce((SELECT rolbypassrls::text FROM pg_roles WHERE rolname = 'service_role'), 'NO EXISTE'), 'true',
       coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false), 'ALTO'
UNION ALL
SELECT 6, 'G.06', 'todas', 'roles anon / authenticated / service_role existen',
       (SELECT (anon IS NOT NULL)::text || ' / ' || (authn IS NOT NULL)::text || ' / ' || (srv IS NOT NULL)::text FROM r),
       'true / true / true', (SELECT anon IS NOT NULL AND authn IS NOT NULL AND srv IS NOT NULL FROM r), 'ALTO'
UNION ALL
SELECT 7, 'G.07', 'historial', 'supabase_migrations.schema_migrations existe (versiones registradas)',
       (SELECT CASE WHEN existe THEN 'sí (' || cardinality(versiones) || ' versiones)' ELSE 'NO EXISTE' END FROM h), 'sí',
       (SELECT existe FROM h), 'ALTO'
UNION ALL
SELECT 8, 'G.08', 'historial', 'las 5 de main registradas (falta = la CLI intentaría aplicarlas otra vez)',
       coalesce((SELECT string_agg(v, ', ') FROM repo, h, unnest(repo.main) v WHERE NOT (v = ANY (h.versiones))), 'ninguna falta'),
       'ninguna falta',
       (SELECT bool_and(v = ANY (h.versiones)) FROM repo, h, unnest(repo.main) v), 'ALTO'
UNION ALL
SELECT 9, 'G.09', '20260919230000', 'auth_02 registrada (la foto del 2026-11-22 ya la enseña registrada y con su ACL)',
       (SELECT ('20260919230000' = ANY (versiones))::text FROM h), 'true',
       (SELECT '20260919230000' = ANY (versiones) FROM h), 'ALTO'
UNION ALL
SELECT 9.5, 'G.09b', '20260919230000', 'efecto de auth_02 presente: EXECUTE de rate_limit_intento / rate_limit_reset sólo para service_role (anon, authenticated, service_role)',
       coalesce((SELECT string_agg(f || '=' || has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')::text || ','
                                   || has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')::text || ','
                                   || has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE')::text, ' / ')
                   FROM unnest(ARRAY['public.rate_limit_intento(text,text,integer,integer)', 'public.rate_limit_reset(text)']) f
                  WHERE to_regprocedure(f) IS NOT NULL), 'NO EXISTEN'),
       'public.rate_limit_intento(text,text,integer,integer)=false,false,true / public.rate_limit_reset(text)=false,false,true',
       coalesce((SELECT string_agg(f || '=' || has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')::text || ','
                                   || has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')::text || ','
                                   || has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE')::text, ' / ')
                   FROM unnest(ARRAY['public.rate_limit_intento(text,text,integer,integer)', 'public.rate_limit_reset(text)']) f
                  WHERE to_regprocedure(f) IS NOT NULL), '')
         = 'public.rate_limit_intento(text,text,integer,integer)=false,false,true / public.rate_limit_reset(text)=false,false,true',
       'AVISO'
UNION ALL
SELECT 10, 'G.10', 'historial', 'alguna de las 8 nuevas YA registrada (la CLI la saltaría)',
       coalesce((SELECT string_agg(v, ', ') FROM repo, h, unnest(repo.nuevas) v WHERE v = ANY (h.versiones)), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM repo, h, unnest(repo.nuevas) v WHERE v = ANY (h.versiones)), 'ALTO'
UNION ALL
SELECT 11, 'G.11', 'historial', 'versiones registradas que el repo no conoce (la CLI se niega a empujar)',
       coalesce((SELECT string_agg(v, ', ' ORDER BY v) FROM h, repo, unnest(h.versiones) v
                  WHERE NOT (v = ANY (repo.main || repo.nuevas))), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM h, repo, unnest(h.versiones) v WHERE NOT (v = ANY (repo.main || repo.nuevas))), 'ALTO'
UNION ALL
SELECT 12, 'G.12', 'todas', 'extensiones instaladas (las 8 no usan ninguna; btree_gist la usa consultorios_default_unico de main)',
       (SELECT string_agg(e.extname || ' ' || e.extversion || ' @' || n.nspname, ', ' ORDER BY e.extname)
          FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace),
       'btree_gist presente', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'), 'AVISO'
UNION ALL
SELECT 13, 'G.13', 'F1, F3, F2, F5b', 'tamaño de las tablas que toman ACCESS EXCLUSIVE (filas estimadas por reltuples / tamaño total)',
       (SELECT string_agg(c.relname || ' ≈' || greatest(c.reltuples, 0)::bigint || ' (' || pg_size_pretty(pg_total_relation_size(c.oid)) || ')',
                          ', ' ORDER BY c.relname)
          FROM pg_class c
         WHERE c.oid IN (to_regclass('public.appointments'), to_regclass('public.consultorios'), to_regclass('public.clinicas'),
                         to_regclass('public.audit_log'), to_regclass('public.profiles'))),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 14, 'G.14', 'todas', 'otras sesiones con una transacción abierta hace más de 60 s / de ellas, «idle in transaction»',
       (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE state LIKE 'idle in transaction%')::text
          FROM pg_stat_activity
         WHERE pid <> pg_backend_pid() AND backend_type = 'client backend'
           AND xact_start < now() - interval '60 seconds'),
       '0 / 0',
       (SELECT count(*) = 0 FROM pg_stat_activity
         WHERE pid <> pg_backend_pid() AND backend_type = 'client backend' AND xact_start < now() - interval '60 seconds'),
       'AVISO'
UNION ALL
SELECT 15, 'G.15', 'todas', 'candados de OTRAS sesiones sobre las tablas que se alteran (tabla:modo, transacción de más de 5 s)',
       coalesce((SELECT string_agg(DISTINCT l.relation::regclass::text || ':' || l.mode, ', ')
                   FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
                  WHERE l.pid <> pg_backend_pid() AND l.locktype = 'relation'
                    AND a.xact_start < now() - interval '5 seconds'
                    AND l.relation IN (SELECT to_regclass('public.' || t) FROM m2, unnest(m2.tablas || ARRAY['consultorios', 'clinicas',
                                         'profiles', 'audit_log', 'firmas_documento']) t)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
                    WHERE l.pid <> pg_backend_pid() AND l.locktype = 'relation'
                      AND a.xact_start < now() - interval '5 seconds'
                      AND l.relation IN (SELECT to_regclass('public.' || t) FROM m2, unnest(m2.tablas || ARRAY['consultorios', 'clinicas',
                                           'profiles', 'audit_log', 'firmas_documento']) t)),
       'AVISO'
UNION ALL
SELECT 16, 'G.16', 'todas', 'este rol ve la actividad de las demás sesiones (pg_read_all_stats); si no, G.14 y G.15 cuentan de menos',
       coalesce(pg_has_role(current_user, to_regrole('pg_read_all_stats'), 'MEMBER')::text, 'false'), 'true',
       coalesce(pg_has_role(current_user, to_regrole('pg_read_all_stats'), 'MEMBER'), false), 'AVISO'

-- ─── M1 · 20261125170000_audit_log_sin_truncate ──────────────────────
UNION ALL
SELECT 20, 'M1.1', '20261125170000', 'public.audit_log existe y quien aplica actúa como su dueño',
       coalesce((SELECT relowner::regrole::text || ' / ' || pg_has_role(current_user, relowner, 'USAGE')::text
                   FROM pg_class WHERE oid = to_regclass('public.audit_log')), 'NO EXISTE'),
       'dueño / true',
       coalesce((SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class WHERE oid = to_regclass('public.audit_log')), false),
       'ALTO'
UNION ALL
SELECT 21, 'M1.2', '20261125170000', 'prevent_audit_modification(): RETURNS trigger, plpgsql, md5 exacto del cuerpo (y md5 con espacios normalizados)',
       coalesce((SELECT l.lanname || ' / ' || p.prorettype::regtype::text || ' / ' || md5(p.prosrc)
                        || ' / norm ' || md5(regexp_replace(p.prosrc, '\s+', ' ', 'g'))
                   FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
                  WHERE p.oid = to_regprocedure('public.prevent_audit_modification()')), 'NO EXISTE'),
       'plpgsql / trigger / f1fe023a49dae586103b5e80b52841ea',
       coalesce((SELECT md5(p.prosrc) = 'f1fe023a49dae586103b5e80b52841ea' AND l.lanname = 'plpgsql'
                        AND p.prorettype = 'pg_catalog.trigger'::regtype
                   FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
                  WHERE p.oid = to_regprocedure('public.prevent_audit_modification()')), false),
       'ALTO'
UNION ALL
SELECT 22, 'M1.3', '20261125170000', 'prevent_audit_truncate ya existe (con otra forma aborta; con la suya es que ya se aplicó)',
       coalesce((SELECT CASE WHEN t.tgtype = 34 AND t.tgfoid = to_regprocedure('public.prevent_audit_modification()')
                                  AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector
                             THEN 'existe, con su forma' ELSE 'existe, con OTRA forma' END
                   FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.audit_log')
                    AND t.tgname = 'prevent_audit_truncate' AND NOT t.tgisinternal), 'no existe'),
       'no existe',
       NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.audit_log')
                    AND t.tgname = 'prevent_audit_truncate' AND NOT t.tgisinternal),
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.audit_log')
                          AND t.tgname = 'prevent_audit_truncate' AND NOT t.tgisinternal
                          AND NOT (t.tgtype = 34 AND t.tgfoid = to_regprocedure('public.prevent_audit_modification()')
                                   AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector))
            THEN 'ALTO' ELSE 'AVISO' END
UNION ALL
SELECT 23, 'M1.4', '20261125170000', 'TRUNCATE sobre audit_log que el REVOKE no quitaría (PUBLIC, otro otorgante o pertenencia): el post-vuelo aborta',
       coalesce((SELECT string_agg(rol, ', ' ORDER BY rol) FROM trunc_resiste WHERE relname = 'audit_log'), 'ninguno'),
       'ninguno', NOT EXISTS (SELECT 1 FROM trunc_resiste WHERE relname = 'audit_log'), 'ALTO'
UNION ALL
SELECT 24, 'M1.5', '20261125170000', 'disparadores de fila de antes en audit_log (la rejilla de M1, fila 3)',
       coalesce((SELECT string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_trigger t
                  WHERE t.tgrelid = to_regclass('public.audit_log') AND NOT t.tgisinternal AND t.tgname <> 'prevent_audit_truncate'), 'NINGUNO'),
       'prevent_audit_delete:O,prevent_audit_update:O',
       coalesce((SELECT string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_trigger t
                  WHERE t.tgrelid = to_regclass('public.audit_log') AND NOT t.tgisinternal AND t.tgname <> 'prevent_audit_truncate'), '')
         = 'prevent_audit_delete:O,prevent_audit_update:O',
       'AVISO'
UNION ALL
SELECT 25, 'M1.6', '20261125170000', 'policies de audit_log (la rejilla de M1, fila 5)',
       coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'audit_log'), 'NINGUNA'),
       'audit_super_admin_select',
       coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'audit_log'), '') = 'audit_super_admin_select',
       'AVISO'

-- ─── M2 · 20261126120000_public_sin_truncate ─────────────────────────
UNION ALL
SELECT 30, 'M2.1', '20261126120000', 'quien aplica es miembro de postgres (ALTER DEFAULT PRIVILEGES FOR ROLE postgres)',
       coalesce(pg_has_role(current_user, to_regrole('postgres'), 'MEMBER')::text, 'false'), 'true',
       coalesce(pg_has_role(current_user, to_regrole('postgres'), 'MEMBER'), false), 'ALTO'
UNION ALL
SELECT 31, 'M2.2', '20261126120000', 'las 11 tablas clínicas existen y quien aplica actúa como su dueño (las que no)',
       coalesce((SELECT string_agg(t, ', ' ORDER BY t) FROM m2, unnest(m2.tablas) t
                  WHERE NOT coalesce((SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class
                                       WHERE oid = to_regclass('public.' || t)), false)), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM m2, unnest(m2.tablas) t
                    WHERE NOT coalesce((SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class
                                         WHERE oid = to_regclass('public.' || t)), false)),
       'ALTO'
UNION ALL
SELECT 32, 'M2.3', '20261126120000', 'TRUNCATE a PUBLIC o a los tres roles que el pre-vuelo declara imposible de quitar (tabla: a quién, por quién, dueño)',
       coalesce((SELECT string_agg(format('%s (a %s, por %s, dueño %s)', c.relname,
                                          CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
                                          a.grantor::regrole, c.relowner::regrole), '; ' ORDER BY c.relname)
                   FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a, r
                  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
                    AND a.privilege_type = 'TRUNCATE'
                    AND (a.grantee = 0 OR a.grantee IN (r.anon, r.authn, r.srv))
                    AND (a.grantee = 0 OR a.grantor <> c.relowner OR NOT pg_has_role(current_user, c.relowner, 'USAGE'))), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a, r
                    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
                      AND a.privilege_type = 'TRUNCATE'
                      AND (a.grantee = 0 OR a.grantee IN (r.anon, r.authn, r.srv))
                      AND (a.grantee = 0 OR a.grantor <> c.relowner OR NOT pg_has_role(current_user, c.relowner, 'USAGE'))),
       'ALTO'
UNION ALL
SELECT 33, 'M2.4', '20261126120000', 'TRUNCATE efectivo que sobreviviría al REVOKE (PUBLIC, otro otorgante o pertenencia): el post-vuelo aborta (tabla:rol)',
       coalesce((SELECT string_agg(relname || ':' || rol, ', ' ORDER BY relname, rol) FROM trunc_resiste), 'ninguno'),
       'ninguno', NOT EXISTS (SELECT 1 FROM trunc_resiste), 'ALTO'
UNION ALL
SELECT 34, 'M2.5', '20261126120000', 'public.prohibir_truncate ya existe (con otra forma o sobrecargas aborta)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate') THEN 'no existe'
            WHEN EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.prohibir_truncate()')
                           AND md5(p.prosrc) = 'e1b07ec42accc1b181ac24b3a3d63400' AND NOT p.prosecdef
                           AND p.prorettype = 'pg_catalog.trigger'::regtype AND p.proconfig = ARRAY['search_path=""'])
                 AND (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate') = 1
            THEN 'existe, con su forma' ELSE 'existe, con OTRA forma' END,
       'no existe',
       NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate'),
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.prohibir_truncate()')
                           AND md5(p.prosrc) = 'e1b07ec42accc1b181ac24b3a3d63400' AND NOT p.prosecdef
                           AND p.prorettype = 'pg_catalog.trigger'::regtype AND p.proconfig = ARRAY['search_path=""'])
                 AND (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate') = 1
            THEN 'AVISO' ELSE 'ALTO' END
UNION ALL
SELECT 35, 'M2.6', '20261126120000', 'disparadores trg_<tabla>_sin_truncate que ya existen (los de otra forma abortan)',
       coalesce((SELECT string_agg(t.tgname || CASE WHEN t.tgtype = 34 AND t.tgfoid = coalesce(to_regprocedure('public.prohibir_truncate()'), 0)
                                                     AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector
                                                THEN ' (su forma)' ELSE ' (OTRA forma)' END, ', ' ORDER BY t.tgname)
                   FROM m2, unnest(m2.tablas) x JOIN pg_trigger t ON t.tgrelid = to_regclass('public.' || x)
                    AND t.tgname = 'trg_' || x || '_sin_truncate' AND NOT t.tgisinternal), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM m2, unnest(m2.tablas) x JOIN pg_trigger t ON t.tgrelid = to_regclass('public.' || x)
                    AND t.tgname = 'trg_' || x || '_sin_truncate' AND NOT t.tgisinternal),
       CASE WHEN EXISTS (SELECT 1 FROM m2, unnest(m2.tablas) x JOIN pg_trigger t ON t.tgrelid = to_regclass('public.' || x)
                          AND t.tgname = 'trg_' || x || '_sin_truncate' AND NOT t.tgisinternal
                          AND NOT (t.tgtype = 34 AND t.tgfoid = coalesce(to_regprocedure('public.prohibir_truncate()'), 0)
                                   AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector))
            THEN 'ALTO' ELSE 'AVISO' END
UNION ALL
SELECT 36, 'M2.7', '20261126120000', 'tablas de public cuyo dueño no es postgres (p. ej. creadas por supabase_admin): tabla:dueño',
       coalesce((SELECT string_agg(c.relname || ':' || c.relowner::regrole::text, ', ' ORDER BY c.relname) FROM pg_class c
                  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
                    AND c.relowner <> to_regrole('postgres')), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
                    AND c.relowner <> to_regrole('postgres')),
       'AVISO'
UNION ALL
SELECT 37, 'M2.8', '20261126120000', 'tablas de public que hoy conceden TRUNCATE a alguno de los tres roles (lo que M1 y M2 quitarán; 29 en un clon de main sin M1 ni M2)',
       (SELECT count(DISTINCT c.oid)::text FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) x(rol)
         WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
           AND to_regrole(x.rol) IS NOT NULL AND has_table_privilege(x.rol, c.oid, 'TRUNCATE')),
       NULL, NULL, 'INFO'

-- ─── F1 · 20261201120000_agenda_f1_ajustes_tipos_horarios ────────────
UNION ALL
SELECT 40, 'F1.1', '20261201120000', 'tablas de main que usa: appointments, audit_log, clinicas, consultorios, profiles (las que faltan)',
       coalesce((SELECT string_agg(t, ', ') FROM unnest(ARRAY['appointments', 'audit_log', 'clinicas', 'consultorios', 'profiles']) t
                  WHERE to_regclass('public.' || t) IS NULL), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['appointments', 'audit_log', 'clinicas', 'consultorios', 'profiles']) t
                    WHERE to_regclass('public.' || t) IS NULL), 'ALTO'
UNION ALL
SELECT 41, 'F1.2', '20261201120000', 'get_clinica_id(), soy_admin_de_clinica(), get_my_role() existen y son SECURITY DEFINER; log_tabla_change() y auth.uid() existen (las que no)',
       coalesce((SELECT string_agg(x, ', ') FROM (
           SELECT f || ' (falta o no es DEFINER)' FROM unnest(ARRAY['public.get_clinica_id()', 'public.soy_admin_de_clinica()', 'public.get_my_role()']) f
            WHERE NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(f)), false)
           UNION ALL SELECT f || ' (falta)' FROM unnest(ARRAY['public.log_tabla_change()', 'auth.uid()']) f WHERE to_regprocedure(f) IS NULL) y(x)),
                'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['public.get_clinica_id()', 'public.soy_admin_de_clinica()', 'public.get_my_role()']) f
                    WHERE NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(f)), false))
         AND to_regprocedure('public.log_tabla_change()') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL,
       'ALTO'
UNION ALL
SELECT 42, 'F1.3', '20261201120000', 'las 18 columnas de main que lee o escribe, con su tipo (las que faltan o cambiaron)',
       coalesce((SELECT string_agg(e.t || '.' || e.c, ', ') FROM (VALUES
           ('appointments', 'id', 'uuid'), ('appointments', 'clinica_id', 'uuid'), ('appointments', 'status', 'text'),
           ('appointments', 'paciente_id', 'uuid'), ('appointments', 'origen', 'text'), ('audit_log', 'user_id', 'text'),
           ('audit_log', 'accion', 'text'), ('audit_log', 'tabla', 'text'), ('audit_log', 'registro_id', 'uuid'),
           ('audit_log', 'descripcion', 'text'), ('clinicas', 'id', 'uuid'), ('consultorios', 'id', 'uuid'),
           ('consultorios', 'medico_id', 'uuid'), ('consultorios', 'es_default', 'boolean'), ('consultorios', 'activo', 'boolean'),
           ('profiles', 'role', 'text'), ('profiles', 'clinica_id', 'uuid'), ('profiles', 'es_admin_de_clinica', 'boolean')) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND format_type(a.atttypid, a.atttypmod) = e.tipo)), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM (VALUES
           ('appointments', 'id', 'uuid'), ('appointments', 'clinica_id', 'uuid'), ('appointments', 'status', 'text'),
           ('appointments', 'paciente_id', 'uuid'), ('appointments', 'origen', 'text'), ('audit_log', 'user_id', 'text'),
           ('audit_log', 'accion', 'text'), ('audit_log', 'tabla', 'text'), ('audit_log', 'registro_id', 'uuid'),
           ('audit_log', 'descripcion', 'text'), ('clinicas', 'id', 'uuid'), ('consultorios', 'id', 'uuid'),
           ('consultorios', 'medico_id', 'uuid'), ('consultorios', 'es_default', 'boolean'), ('consultorios', 'activo', 'boolean'),
           ('profiles', 'role', 'text'), ('profiles', 'clinica_id', 'uuid'), ('profiles', 'es_admin_de_clinica', 'boolean')) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND format_type(a.atttypid, a.atttypmod) = e.tipo)),
       'ALTO'
UNION ALL
SELECT 43, 'F1.4', '20261201120000', 'consultorios.horario y clinicas.horario_consulta son jsonb NOT NULL (el backfill copia uno en otro)',
       (SELECT count(*)::text FROM pg_attribute WHERE NOT attisdropped AND attnotnull AND atttypid = 'jsonb'::regtype
           AND ((attrelid = to_regclass('public.consultorios') AND attname = 'horario')
             OR (attrelid = to_regclass('public.clinicas') AND attname = 'horario_consulta'))) || ' de 2',
       '2 de 2',
       (SELECT count(*) = 2 FROM pg_attribute WHERE NOT attisdropped AND attnotnull AND atttypid = 'jsonb'::regtype
           AND ((attrelid = to_regclass('public.consultorios') AND attname = 'horario')
             OR (attrelid = to_regclass('public.clinicas') AND attname = 'horario_consulta'))),
       'ALTO'
UNION ALL
SELECT 44, 'F1.5', '20261201120000 (y F3, F2, F5b)', 'quien aplica actúa como dueño de appointments, clinicas, consultorios y profiles (tabla:dueño de las que no)',
       coalesce((SELECT string_agg(t || ':' || coalesce((SELECT relowner::regrole::text FROM pg_class WHERE oid = to_regclass('public.' || t)), 'NO EXISTE'), ', ')
                   FROM unnest(ARRAY['appointments', 'clinicas', 'consultorios', 'profiles']) t
                  WHERE NOT coalesce((SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class WHERE oid = to_regclass('public.' || t)), false)),
                'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['appointments', 'clinicas', 'consultorios', 'profiles']) t
                    WHERE NOT coalesce((SELECT pg_has_role(current_user, relowner, 'USAGE') FROM pg_class WHERE oid = to_regclass('public.' || t)), false)),
       'ALTO'
UNION ALL
SELECT 45, 'F1.6', '20261201120000', 'appointments ya tiene un disparador con log_tabla_change() (duplicaría la auditoría)',
       coalesce((SELECT string_agg(tgname, ', ') FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND NOT tgisinternal
                  AND tgfoid = to_regprocedure('public.log_tabla_change()')), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND NOT tgisinternal
                    AND tgfoid = to_regprocedure('public.log_tabla_change()')), 'ALTO'
UNION ALL
SELECT 46, 'F1.7', '20261201120000', 'objetos de F1 que YA existen (cualquiera aborta F1)',
       coalesce((SELECT string_agg(o, ', ' ORDER BY o) FROM (
           SELECT 'tabla ' || t FROM unnest(ARRAY['agenda_ajustes', 'tipos_cita']) t WHERE to_regclass('public.' || t) IS NOT NULL
           UNION ALL SELECT 'función ' || p.proname FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico', 'validar_tipo_cita_consultorio',
                               'update_tipos_cita_updated_at', 'log_cita_change', 'agenda_restablecer_configuracion')
           UNION ALL SELECT 'disparador ' || tgname FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
             AND tgname IN ('audit_appointments', 'audit_appointments_update')
           UNION ALL SELECT 'columna ' || a.attrelid::regclass::text || '.' || a.attname FROM pg_attribute a
             WHERE NOT a.attisdropped AND ((a.attrelid = to_regclass('public.appointments') AND a.attname IN ('tipo_cita_id', 'tipo_cita_nombre'))
                OR (a.attrelid = to_regclass('public.consultorios') AND a.attname IN ('horario_propio', 'horario_revisado_en'))
                OR (a.attrelid = to_regclass('public.clinicas') AND a.attname = 'timezone'))
           UNION ALL SELECT 'índice idx_appointments_tipo_cita' WHERE to_regclass('public.idx_appointments_tipo_cita') IS NOT NULL) x(o)), 'ninguno'),
       'ninguno',
       to_regclass('public.agenda_ajustes') IS NULL AND to_regclass('public.tipos_cita') IS NULL
         AND to_regclass('public.idx_appointments_tipo_cita') IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND p.proname IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico', 'validar_tipo_cita_consultorio',
                                 'update_tipos_cita_updated_at', 'log_cita_change', 'agenda_restablecer_configuracion'))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
               AND tgname IN ('audit_appointments', 'audit_appointments_update'))
         AND NOT EXISTS (SELECT 1 FROM pg_attribute a
               WHERE NOT a.attisdropped AND ((a.attrelid = to_regclass('public.appointments') AND a.attname IN ('tipo_cita_id', 'tipo_cita_nombre'))
                  OR (a.attrelid = to_regclass('public.consultorios') AND a.attname IN ('horario_propio', 'horario_revisado_en'))
                  OR (a.attrelid = to_regclass('public.clinicas') AND a.attname = 'timezone'))),
       'ALTO'
UNION ALL
SELECT 47, 'F1.8', '20261201120000', 'esquema respaldos: existe / quien aplica puede crear en él',
       coalesce((SELECT 'sí / ' || has_schema_privilege(current_user, oid, 'CREATE')::text FROM pg_namespace WHERE nspname = 'respaldos'), 'NO EXISTE'),
       'sí / true',
       coalesce((SELECT has_schema_privilege(current_user, oid, 'CREATE') FROM pg_namespace WHERE nspname = 'respaldos'), false), 'ALTO'
UNION ALL
SELECT 48, 'F1.9', '20261201120000', 'respaldos.consultorios_horario_20261119: ¿existe ya? (con otra forma aborta; con la suya, cuántas filas)',
       CASE WHEN to_regclass('respaldos.consultorios_horario_20261119') IS NULL THEN 'no existe'
            WHEN (SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute
                   WHERE attrelid = to_regclass('respaldos.consultorios_horario_20261119') AND attnum > 0 AND NOT attisdropped)
                 = 'id:uuid,clinica_id:uuid,horario:jsonb,horario_propio:boolean,respaldado_en:timestamp with time zone'
            THEN 'existe, con su forma, ' || (xpath('/table/row/n/text()', query_to_xml(
                   'SELECT count(*) AS n FROM respaldos.consultorios_horario_20261119', false, false, '')))[1]::text || ' filas'
            ELSE 'existe, con OTRA forma' END,
       'no existe',
       to_regclass('respaldos.consultorios_horario_20261119') IS NULL,
       CASE WHEN to_regclass('respaldos.consultorios_horario_20261119') IS NOT NULL
             AND coalesce((SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute
                            WHERE attrelid = to_regclass('respaldos.consultorios_horario_20261119') AND attnum > 0 AND NOT attisdropped), '')
                 <> 'id:uuid,clinica_id:uuid,horario:jsonb,horario_propio:boolean,respaldado_en:timestamp with time zone'
            THEN 'ALTO' ELSE 'AVISO' END
UNION ALL
SELECT 49, 'F1.10', '20261201120000', 'médicos con consultorios activos y NINGUNO predeterminado (pre-vuelo 1.4: el backfill abortaría)',
       (SELECT count(*)::text FROM (SELECT medico_id FROM public.consultorios GROUP BY medico_id
                                     HAVING count(*) FILTER (WHERE activo) >= 1
                                        AND count(*) FILTER (WHERE activo AND es_default) = 0) m),
       '0',
       (SELECT count(*) = 0 FROM (SELECT medico_id FROM public.consultorios GROUP BY medico_id
                                   HAVING count(*) FILTER (WHERE activo) >= 1
                                      AND count(*) FILTER (WHERE activo AND es_default) = 0) m),
       'ALTO'
UNION ALL
SELECT 50, 'F1.11', '20261201120000', 'consultorios que el backfill reescribirá: total (activos / archivados) · clínicas · médicos',
       (SELECT count(*)::text || ' (' || count(*) FILTER (WHERE activo)::text || ' / ' || count(*) FILTER (WHERE NOT activo)::text || ') · '
               || count(DISTINCT clinica_id)::text || ' · ' || count(DISTINCT medico_id)::text FROM public.consultorios),
       NULL, NULL, 'INFO'
UNION ALL
SELECT 51, 'F1.12', '20261201120000', 'clínicas cuyo horario_consulta no tiene los 7 días (el backfill lo copia tal cual a cada consultorio)',
       (SELECT count(*)::text FROM public.clinicas c
         WHERE NOT (c.horario_consulta ?& ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']))
         || ' clínicas',
       '0 clínicas',
       (SELECT count(*) = 0 FROM public.clinicas c
         WHERE NOT (c.horario_consulta ?& ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])),
       'AVISO'
UNION ALL
SELECT 52, 'F1.13', '20261201120000', 'audit_log.created_at tiene DEFAULT now() (la rejilla de F1, fila 14, cruza el respaldo con la auditoría por el mismo instante)',
       coalesce((SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                  WHERE a.attrelid = to_regclass('public.audit_log') AND a.attname = 'created_at'), 'SIN DEFAULT'),
       'now()',
       coalesce((SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                  WHERE a.attrelid = to_regclass('public.audit_log') AND a.attname = 'created_at'), '') = 'now()',
       'AVISO'
UNION ALL
SELECT 53, 'F1.14', '20261201120000', 'policies de appointments y consultorios (la rejilla de F1, fila 15)',
       coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
                  WHERE schemaname = 'public' AND tablename IN ('appointments', 'consultorios')), 'NINGUNA'),
       'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update,consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update',
       coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
                  WHERE schemaname = 'public' AND tablename IN ('appointments', 'consultorios')), '')
         = 'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update,consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update',
       'AVISO'

-- ─── C · restricciones y disparadores que el backfill de F1 vuelve a pasar sobre filas que ya hay ─
UNION ALL
SELECT 60, 'C.1', '20261201120000', 'consultorios que violan una CHECK de consultorios (el UPDATE del backfill las vuelve a evaluar fila a fila): restricción=filas',
       coalesce((SELECT string_agg(k.conname || '=' || k.n, ', ' ORDER BY k.conname) FROM (
           SELECT c.conname,
                  (xpath('/table/row/n/text()', query_to_xml(format(
                     'SELECT count(*) AS n FROM public.consultorios WHERE NOT coalesce((%s), true)',
                     regexp_replace(regexp_replace(pg_get_constraintdef(c.oid), '^CHECK ', ''), ' NOT VALID$', '')),
                   false, false, '')))[1]::text::bigint AS n
             FROM pg_constraint c WHERE c.conrelid = to_regclass('public.consultorios') AND c.contype = 'c') k WHERE k.n > 0), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = to_regclass('public.consultorios') AND c.contype = 'c'
                    AND (xpath('/table/row/n/text()', query_to_xml(format(
                           'SELECT count(*) AS n FROM public.consultorios WHERE NOT coalesce((%s), true)',
                           regexp_replace(regexp_replace(pg_get_constraintdef(c.oid), '^CHECK ', ''), ' NOT VALID$', '')),
                         false, false, '')))[1]::text::bigint > 0),
       'ALTO'
UNION ALL
SELECT 61, 'C.2', '20261201120000', 'médicos con más de un consultorio activo predeterminado (EXCLUDE consultorios_default_unico, diferida: se revalida al COMMIT de F1)',
       (SELECT count(*)::text FROM (SELECT medico_id FROM public.consultorios WHERE es_default AND activo
                                     GROUP BY medico_id HAVING count(*) > 1) m),
       '0',
       (SELECT count(*) = 0 FROM (SELECT medico_id FROM public.consultorios WHERE es_default AND activo
                                   GROUP BY medico_id HAVING count(*) > 1) m),
       'ALTO'
UNION ALL
SELECT 62, 'C.3', '20261201120000', 'restricciones NOT VALID en appointments, consultorios y clinicas (una NOT VALID se impone a las filas que se reescriben)',
       coalesce((SELECT string_agg(conrelid::regclass::text || '.' || conname, ', ' ORDER BY 1) FROM pg_constraint
                  WHERE NOT convalidated AND conrelid IN (to_regclass('public.appointments'), to_regclass('public.consultorios'),
                                                           to_regclass('public.clinicas'))), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM pg_constraint WHERE NOT convalidated
                    AND conrelid IN (to_regclass('public.appointments'), to_regclass('public.consultorios'), to_regclass('public.clinicas'))),
       'AVISO'
UNION ALL
SELECT 63, 'C.4', '20261201120000', 'disparadores de consultorios (el UPDATE del backfill los dispara; uno desconocido podría abortarlo)',
       coalesce((SELECT string_agg(tgname || ':' || tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger
                  WHERE tgrelid = to_regclass('public.consultorios') AND NOT tgisinternal), 'NINGUNO'),
       'audit_consultorios:O,trg_consultorios_cap_10:O,trg_consultorios_default_existencia_delete:O,trg_consultorios_default_existencia_update:O,trg_consultorios_default_insert:O,trg_consultorios_updated_at:O',
       coalesce((SELECT string_agg(tgname || ':' || tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger
                  WHERE tgrelid = to_regclass('public.consultorios') AND NOT tgisinternal), '')
         = 'audit_consultorios:O,trg_consultorios_cap_10:O,trg_consultorios_default_existencia_delete:O,trg_consultorios_default_existencia_update:O,trg_consultorios_default_insert:O,trg_consultorios_updated_at:O',
       'AVISO'
UNION ALL
SELECT 64, 'C.5', 'F1, F3, F2, F5b', 'restricciones nuevas de appointments (2 de F1, 4 de F3, 1 de F2, 2 de F5b): sólo sobre columnas que nacen NULL; de esas columnas ya existen',
       coalesce((SELECT string_agg(attname, ', ' ORDER BY attname) FROM pg_attribute
                  WHERE attrelid = to_regclass('public.appointments') AND NOT attisdropped
                    AND (attname IN ('tipo_cita_id', 'tipo_cita_nombre', 'google_asignacion', 'cerrada_en', 'sustituida_por')
                         OR attname LIKE 'reserva\_%')), 'ninguna (0 filas pueden violarlas)'),
       'ninguna (0 filas pueden violarlas)',
       NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.appointments') AND NOT attisdropped
                    AND (attname IN ('tipo_cita_id', 'tipo_cita_nombre', 'google_asignacion', 'cerrada_en', 'sustituida_por')
                         OR attname LIKE 'reserva\_%')),
       'ALTO'

-- ─── F5a · 20261201130000_agenda_f5a_bloqueos ────────────────────────
UNION ALL
SELECT 70, 'F5a.1', '20261201130000', 'clinicas, profiles y las funciones de main que usan sus policies (auth.uid, get_clinica_id, soy_admin_de_clinica, get_my_role, perfil_completo, log_tabla_change): las que faltan',
       coalesce((SELECT string_agg(x, ', ') FROM (
           SELECT t FROM unnest(ARRAY['public.clinicas', 'public.profiles']) t WHERE to_regclass(t) IS NULL
           UNION ALL SELECT f FROM unnest(ARRAY['auth.uid()', 'public.get_clinica_id()', 'public.soy_admin_de_clinica()', 'public.get_my_role()',
                                                'public.perfil_completo()', 'public.log_tabla_change()']) f WHERE to_regprocedure(f) IS NULL) y(x)), 'ninguna'),
       'ninguna',
       to_regclass('public.clinicas') IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['auth.uid()', 'public.get_clinica_id()', 'public.soy_admin_de_clinica()', 'public.get_my_role()',
                                                    'public.perfil_completo()', 'public.log_tabla_change()']) f WHERE to_regprocedure(f) IS NULL),
       'ALTO'
UNION ALL
SELECT 71, 'F5a.2', '20261201130000 (y F2)', 'clinica_no_suspendida(): md5 exacto del cuerpo (y con espacios normalizados)',
       coalesce((SELECT md5(prosrc) || ' / norm ' || md5(regexp_replace(prosrc, '\s+', ' ', 'g')) FROM pg_proc
                  WHERE oid = to_regprocedure('public.clinica_no_suspendida()')), 'NO EXISTE'),
       'a2dcfa8f2cfda91bc9c7a7ff7b642e1e / norm 588de29d551f6d474eb24346748e1148',
       coalesce((SELECT md5(prosrc) = 'a2dcfa8f2cfda91bc9c7a7ff7b642e1e' FROM pg_proc WHERE oid = to_regprocedure('public.clinica_no_suspendida()')), false),
       'ALTO'
UNION ALL
SELECT 72, 'F5a.3', '20261201130000 (y F2)', 'clinica_tiene_acceso(): md5 exacto del cuerpo (y con espacios normalizados)',
       coalesce((SELECT md5(prosrc) || ' / norm ' || md5(regexp_replace(prosrc, '\s+', ' ', 'g')) FROM pg_proc
                  WHERE oid = to_regprocedure('public.clinica_tiene_acceso()')), 'NO EXISTE'),
       '2efd7734772dd4c7bea262e43a3779b5 / norm 59d2accdf9baff7f8cc5b4f95b7d77dc',
       coalesce((SELECT md5(prosrc) = '2efd7734772dd4c7bea262e43a3779b5' FROM pg_proc WHERE oid = to_regprocedure('public.clinica_tiene_acceso()')), false),
       'ALTO'
UNION ALL
SELECT 73, 'F5a.4', '20261201130000', 'objetos de F5a que YA existen (agenda_bloqueos, agenda_bloqueo_preparar)',
       coalesce((SELECT string_agg(o, ', ') FROM (
           SELECT 'tabla agenda_bloqueos' WHERE to_regclass('public.agenda_bloqueos') IS NOT NULL
           UNION ALL SELECT 'función agenda_bloqueo_preparar' WHERE EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                                                                             AND proname = 'agenda_bloqueo_preparar')) x(o)), 'ninguno'),
       'ninguno',
       to_regclass('public.agenda_bloqueos') IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'agenda_bloqueo_preparar'),
       'ALTO'

-- ─── F3 · 20261201140000_agenda_f3_reserva_enlace ────────────────────
UNION ALL
SELECT 80, 'F3.1', '20261201140000', 'tablas de main: appointments, clinicas, profiles, consultorios, audit_log, ip_rate_limits (las que faltan)',
       coalesce((SELECT string_agg(t, ', ') FROM unnest(ARRAY['appointments', 'clinicas', 'profiles', 'consultorios', 'audit_log', 'ip_rate_limits']) t
                  WHERE to_regclass('public.' || t) IS NULL), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['appointments', 'clinicas', 'profiles', 'consultorios', 'audit_log', 'ip_rate_limits']) t
                    WHERE to_regclass('public.' || t) IS NULL), 'ALTO'
UNION ALL
SELECT 81, 'F3.2', '20261201140000', 'las 16 columnas de main de appointments que nombra (más consultorios.horario y timezone): las que faltan',
       coalesce((SELECT string_agg(e.t || '.' || e.c, ', ') FROM (
           SELECT 'appointments', c FROM unnest(ARRAY['client_id', 'clinica_id', 'medico_id', 'paciente_id', 'start_time', 'end_time', 'status',
                  'all_day', 'origen', 'gcal_sync_status', 'consultorio_id', 'consultorio_nombre', 'consultorio_nombre_corto',
                  'consultorio_direccion', 'consultorio_telefono', 'consultorio_timezone']) c
           UNION ALL SELECT 'consultorios', c FROM unnest(ARRAY['horario', 'timezone']) c) e(t, c)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c AND NOT a.attisdropped)), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM (
           SELECT 'appointments', c FROM unnest(ARRAY['client_id', 'clinica_id', 'medico_id', 'paciente_id', 'start_time', 'end_time', 'status',
                  'all_day', 'origen', 'gcal_sync_status', 'consultorio_id', 'consultorio_nombre', 'consultorio_nombre_corto',
                  'consultorio_direccion', 'consultorio_telefono', 'consultorio_timezone']) c
           UNION ALL SELECT 'consultorios', c FROM unnest(ARRAY['horario', 'timezone']) c) e(t, c)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c AND NOT a.attisdropped)),
       'ALTO'
UNION ALL
SELECT 82, 'F3.3', '20261201140000', 'índice ÚNICO idx_appointments_client_id de appointments (reservar_por_enlace atrapa su nombre)',
       coalesce((SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid = to_regclass('public.idx_appointments_client_id')
                  AND indrelid = to_regclass('public.appointments')), 'NO EXISTE'),
       'CREATE UNIQUE INDEX idx_appointments_client_id …',
       coalesce((SELECT indisunique FROM pg_index WHERE indexrelid = to_regclass('public.idx_appointments_client_id')
                  AND indrelid = to_regclass('public.appointments')), false),
       'ALTO'
UNION ALL
SELECT 83, 'F3.4', '20261201140000', 'objetos de F3 que YA existen (cualquiera aborta F3)',
       coalesce((SELECT string_agg(o, ', ' ORDER BY o) FROM (
           SELECT 'tabla ' || t FROM unnest(ARRAY['reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones', 'reserva_incidencias',
                                                  'reserva_contactos']) t WHERE to_regclass('public.' || t) IS NOT NULL
           UNION ALL SELECT 'columna appointments.' || attname FROM pg_attribute WHERE attrelid = to_regclass('public.appointments')
             AND attname LIKE 'reserva\_%' AND NOT attisdropped
           UNION ALL SELECT 'función ' || proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'proteger_reserva_contactos', 'proteger_reserva_enlace_unico', 'proteger_reserva_enlaces', 'rate_limit_espera',
             'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reserva_contacto_estado', 'reserva_contacto_marcar',
             'reserva_contactos_bloqueados', 'reserva_contexto', 'reserva_enlace_emitir', 'reserva_enlace_regenerar_fijo',
             'reserva_espera_reenvio', 'reserva_ocupacion', 'reserva_registrar_incidencia', 'reservar_por_enlace')
           UNION ALL SELECT 'disparador ' || tgname FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
             AND tgname = 'trg_appointments_reserva_incidencia') x(o)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones', 'reserva_incidencias',
                                              'reserva_contactos']) t WHERE to_regclass('public.' || t) IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.appointments') AND attname LIKE 'reserva\_%' AND NOT attisdropped)
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'proteger_reserva_contactos', 'proteger_reserva_enlace_unico', 'proteger_reserva_enlaces', 'rate_limit_espera',
             'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reserva_contacto_estado', 'reserva_contacto_marcar',
             'reserva_contactos_bloqueados', 'reserva_contexto', 'reserva_enlace_emitir', 'reserva_enlace_regenerar_fijo',
             'reserva_espera_reenvio', 'reserva_ocupacion', 'reserva_registrar_incidencia', 'reservar_por_enlace'))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND tgname = 'trg_appointments_reserva_incidencia'),
       'ALTO'

-- ─── F2 · 20261201150000_agenda_f2_google ────────────────────────────
UNION ALL
SELECT 90, 'F2.1', '20261201150000', 'clinica_conexiones_google existe con sus 7 columnas (id, clinica_id, user_id, rol, estado, calendar_id, google_account_email)',
       (SELECT count(*)::text FROM pg_attribute WHERE attrelid = to_regclass('public.clinica_conexiones_google') AND attnum > 0 AND NOT attisdropped
           AND attname IN ('id', 'clinica_id', 'user_id', 'rol', 'estado', 'calendar_id', 'google_account_email')) || ' de 7',
       '7 de 7',
       (SELECT count(*) = 7 FROM pg_attribute WHERE attrelid = to_regclass('public.clinica_conexiones_google') AND attnum > 0 AND NOT attisdropped
           AND attname IN ('id', 'clinica_id', 'user_id', 'rol', 'estado', 'calendar_id', 'google_account_email')),
       'ALTO'
UNION ALL
SELECT 91, 'F2.2', '20261201150000', 'las 18 columnas de appointments con su tipo, y pacientes (5), profiles (2), audit_log (5): las que faltan',
       coalesce((SELECT string_agg(e.t || '.' || e.c, ', ') FROM (VALUES
           ('appointments', 'id', 'uuid'), ('appointments', 'clinica_id', 'uuid'), ('appointments', 'google_event_id', 'text'),
           ('appointments', 'gcal_etag', 'text'), ('appointments', 'gcal_calendar_id', 'text'), ('appointments', 'gcal_sync_status', 'text'),
           ('appointments', 'origen', 'text'), ('appointments', 'all_day', 'boolean'), ('appointments', 'consultorio_timezone', 'text'),
           ('appointments', 'updated_at', 'timestamp with time zone'), ('appointments', 'status', 'text'), ('appointments', 'title', 'text'),
           ('appointments', 'notes', 'text'), ('appointments', 'medico_id', 'uuid'), ('appointments', 'paciente_id', 'uuid'),
           ('appointments', 'created_by', 'uuid'), ('appointments', 'start_time', 'timestamp with time zone'),
           ('appointments', 'end_time', 'timestamp with time zone'),
           ('pacientes', 'id', NULL), ('pacientes', 'clinica_id', NULL), ('pacientes', 'nombre', NULL), ('pacientes', 'apellidos', NULL),
           ('pacientes', 'email', NULL), ('profiles', 'id', NULL), ('profiles', 'clinica_id', NULL), ('audit_log', 'user_id', NULL),
           ('audit_log', 'accion', NULL), ('audit_log', 'tabla', NULL), ('audit_log', 'registro_id', NULL), ('audit_log', 'descripcion', NULL)) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND (e.tipo IS NULL OR format_type(a.atttypid, a.atttypmod) = e.tipo))), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM (VALUES
           ('appointments', 'id', 'uuid'), ('appointments', 'clinica_id', 'uuid'), ('appointments', 'google_event_id', 'text'),
           ('appointments', 'gcal_etag', 'text'), ('appointments', 'gcal_calendar_id', 'text'), ('appointments', 'gcal_sync_status', 'text'),
           ('appointments', 'origen', 'text'), ('appointments', 'all_day', 'boolean'), ('appointments', 'consultorio_timezone', 'text'),
           ('appointments', 'updated_at', 'timestamp with time zone'), ('appointments', 'status', 'text'), ('appointments', 'title', 'text'),
           ('appointments', 'notes', 'text'), ('appointments', 'medico_id', 'uuid'), ('appointments', 'paciente_id', 'uuid'),
           ('appointments', 'created_by', 'uuid'), ('appointments', 'start_time', 'timestamp with time zone'),
           ('appointments', 'end_time', 'timestamp with time zone'),
           ('pacientes', 'id', NULL), ('pacientes', 'clinica_id', NULL), ('pacientes', 'nombre', NULL), ('pacientes', 'apellidos', NULL),
           ('pacientes', 'email', NULL), ('profiles', 'id', NULL), ('profiles', 'clinica_id', NULL), ('audit_log', 'user_id', NULL),
           ('audit_log', 'accion', NULL), ('audit_log', 'tabla', NULL), ('audit_log', 'registro_id', NULL), ('audit_log', 'descripcion', NULL)) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND (e.tipo IS NULL OR format_type(a.atttypid, a.atttypmod) = e.tipo))),
       'ALTO'
UNION ALL
SELECT 92, 'F2.3', '20261201150000', 'índice único parcial (clinica_id, google_event_id) WHERE google_event_id IS NOT NULL de appointments',
       coalesce((SELECT string_agg(indexrelid::regclass::text, ', ') FROM pg_index i WHERE i.indrelid = to_regclass('public.appointments') AND i.indisunique
                  AND pg_get_indexdef(i.indexrelid) LIKE '%(clinica_id, google_event_id) WHERE (google_event_id IS NOT NULL)'), 'NO EXISTE'),
       'appointments_clinica_google_event_id_uniq',
       EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = to_regclass('public.appointments') AND i.indisunique
                AND pg_get_indexdef(i.indexrelid) LIKE '%(clinica_id, google_event_id) WHERE (google_event_id IS NOT NULL)'),
       'ALTO'
UNION ALL
SELECT 93, 'F2.4', '20261201150000 y F4', 'privilegios de service_role que usan sus RPC (uno a uno; los que faltan)',
       coalesce((SELECT string_agg(e.t || ':' || e.p, ', ') FROM (VALUES
           ('clinica_conexiones_google', 'SELECT'), ('clinicas', 'SELECT'), ('pacientes', 'SELECT'), ('profiles', 'SELECT'),
           ('consultorios', 'SELECT'), ('appointments', 'SELECT'), ('appointments', 'INSERT'), ('appointments', 'UPDATE'),
           ('audit_log', 'INSERT')) e(t, p)
          WHERE NOT coalesce(has_table_privilege('service_role', to_regclass('public.' || e.t), e.p), false)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM (VALUES
           ('clinica_conexiones_google', 'SELECT'), ('clinicas', 'SELECT'), ('pacientes', 'SELECT'), ('profiles', 'SELECT'),
           ('consultorios', 'SELECT'), ('appointments', 'SELECT'), ('appointments', 'INSERT'), ('appointments', 'UPDATE'),
           ('audit_log', 'INSERT')) e(t, p)
          WHERE NOT coalesce(has_table_privilege('service_role', to_regclass('public.' || e.t), e.p), false)),
       'ALTO'
UNION ALL
SELECT 94, 'F2.5', '20261201150000', 'puerta S3: clinica_no_suspendida() y clinica_tiene_acceso() son SQL DEFINER boolean de una sola SELECT con public.get_clinica_id() y sin otra fuente de sesión (las que no)',
       coalesce((SELECT string_agg(puerta, ', ') FROM s3
                  WHERE src IS NULL OR NOT definer OR strpos(src, 'public.get_clinica_id()') = 0 OR sql_sust !~* '^select\s'
                     OR sql_sust ~* '(get_clinica_id|auth\.|current_setting|request\.jwt|current_user|session_user|current_role|set_config|;)'), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM s3
                    WHERE src IS NULL OR NOT definer OR strpos(src, 'public.get_clinica_id()') = 0 OR sql_sust !~* '^select\s'
                       OR sql_sust ~* '(get_clinica_id|auth\.|current_setting|request\.jwt|current_user|session_user|current_role|set_config|;)'),
       'ALTO'
UNION ALL
SELECT 95, 'F2.6', '20261201150000', 'objetos de F2 que YA existen (el pre-vuelo sólo admite los que tengan su forma exacta)',
       coalesce((SELECT string_agg(o, ', ' ORDER BY o) FROM (
           SELECT 'tabla ' || t FROM unnest(ARRAY['gcal_sync_estado', 'reserva_empalmes_google', 'gcal_movimientos_rechazados']) t
            WHERE to_regclass('public.' || t) IS NOT NULL
           UNION ALL SELECT 'columna appointments.google_asignacion' FROM pg_attribute WHERE attrelid = to_regclass('public.appointments')
             AND attname = 'google_asignacion' AND NOT attisdropped
           UNION ALL SELECT 'restricción ' || conname FROM pg_constraint WHERE conrelid = to_regclass('public.appointments')
             AND conname = 'appointments_google_asignacion_check'
           UNION ALL SELECT 'función ' || proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
             AND (proname LIKE 'gcal\_%' OR proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google', 'cita_asignacion_google',
                                                        'cita_movimiento_google_registrar'))
           UNION ALL SELECT 'disparador ' || tgname FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
             AND tgname = 'trg_appointments_asignacion_google') x(o)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['gcal_sync_estado', 'reserva_empalmes_google', 'gcal_movimientos_rechazados']) t
                    WHERE to_regclass('public.' || t) IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.appointments') AND attname = 'google_asignacion' AND NOT attisdropped)
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.appointments') AND conname = 'appointments_google_asignacion_check')
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
               AND (proname LIKE 'gcal\_%' OR proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google', 'cita_asignacion_google',
                                                          'cita_movimiento_google_registrar')))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND tgname = 'trg_appointments_asignacion_google'),
       'ALTO'
UNION ALL
SELECT 96, 'F2.7', '20261201150000 y F5b', 'disparadores BEFORE de fila que appointments ya tiene (las rejillas de F2 fila 6 y F5b fila 1 esperan sólo los de la agenda)',
       coalesce((SELECT string_agg(tgname, ', ' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                  AND NOT tgisinternal AND (tgtype & 2) = 2 AND (tgtype & 1) = 1), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                    AND NOT tgisinternal AND (tgtype & 2) = 2 AND (tgtype & 1) = 1),
       'AVISO'

-- ─── F4 · 20261201160000_agenda_f4_confirmacion_correos_avisos ───────
UNION ALL
SELECT 100, 'F4.1', '20261201160000', 'columnas de main que lee o escribe, con su tipo (las que faltan o cambiaron)',
       coalesce((SELECT string_agg(e.t || '.' || e.c, ', ') FROM (VALUES
           ('appointments', 'all_day', 'boolean'), ('appointments', 'client_id', 'text'), ('appointments', 'clinica_id', 'uuid'),
           ('appointments', 'consultorio_direccion', 'text'), ('appointments', 'consultorio_id', 'uuid'), ('appointments', 'consultorio_nombre', 'text'),
           ('appointments', 'consultorio_nombre_corto', 'text'), ('appointments', 'consultorio_telefono', 'text'),
           ('appointments', 'consultorio_timezone', 'text'), ('appointments', 'end_time', 'timestamp with time zone'),
           ('appointments', 'gcal_etag', 'text'), ('appointments', 'google_event_id', 'text'), ('appointments', 'id', 'uuid'),
           ('appointments', 'medico_id', 'uuid'), ('appointments', 'paciente_id', 'uuid'), ('appointments', 'start_time', 'timestamp with time zone'),
           ('appointments', 'status', 'text'), ('appointments', 'updated_at', 'timestamp with time zone'), ('audit_log', 'accion', 'text'),
           ('audit_log', 'descripcion', 'text'), ('audit_log', 'registro_id', 'uuid'), ('audit_log', 'tabla', 'text'), ('audit_log', 'user_id', 'text'),
           ('clinicas', 'id', 'uuid'), ('clinicas', 'suspendida', 'boolean'), ('consultorios', 'activo', 'boolean'), ('consultorios', 'clinica_id', 'uuid'),
           ('consultorios', 'direccion', 'text'), ('consultorios', 'id', 'uuid'), ('consultorios', 'medico_id', 'uuid'), ('consultorios', 'nombre', 'text'),
           ('consultorios', 'nombre_corto', 'text'), ('consultorios', 'telefono', 'text'), ('consultorios', 'timezone', 'text'),
           ('pacientes', 'activo', 'boolean'), ('pacientes', 'clinica_id', 'uuid'), ('pacientes', 'email', 'text'), ('pacientes', 'id', 'uuid'),
           ('pacientes', 'nombre', 'text'), ('profiles', 'apellido_materno', 'text'), ('profiles', 'apellido_paterno', 'text'),
           ('profiles', 'clinica_id', 'uuid'), ('profiles', 'es_admin_de_clinica', 'boolean'), ('profiles', 'id', 'uuid'), ('profiles', 'nombres', 'text'),
           ('profiles', 'role', 'text'), ('profiles', 'titulo', 'text')) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND format_type(a.atttypid, a.atttypmod) = e.tipo)), 'ninguna'),
       'ninguna',
       NOT EXISTS (SELECT 1 FROM (VALUES
           ('appointments', 'all_day', 'boolean'), ('appointments', 'client_id', 'text'), ('appointments', 'clinica_id', 'uuid'),
           ('appointments', 'consultorio_direccion', 'text'), ('appointments', 'consultorio_id', 'uuid'), ('appointments', 'consultorio_nombre', 'text'),
           ('appointments', 'consultorio_nombre_corto', 'text'), ('appointments', 'consultorio_telefono', 'text'),
           ('appointments', 'consultorio_timezone', 'text'), ('appointments', 'end_time', 'timestamp with time zone'),
           ('appointments', 'gcal_etag', 'text'), ('appointments', 'google_event_id', 'text'), ('appointments', 'id', 'uuid'),
           ('appointments', 'medico_id', 'uuid'), ('appointments', 'paciente_id', 'uuid'), ('appointments', 'start_time', 'timestamp with time zone'),
           ('appointments', 'status', 'text'), ('appointments', 'updated_at', 'timestamp with time zone'), ('audit_log', 'accion', 'text'),
           ('audit_log', 'descripcion', 'text'), ('audit_log', 'registro_id', 'uuid'), ('audit_log', 'tabla', 'text'), ('audit_log', 'user_id', 'text'),
           ('clinicas', 'id', 'uuid'), ('clinicas', 'suspendida', 'boolean'), ('consultorios', 'activo', 'boolean'), ('consultorios', 'clinica_id', 'uuid'),
           ('consultorios', 'direccion', 'text'), ('consultorios', 'id', 'uuid'), ('consultorios', 'medico_id', 'uuid'), ('consultorios', 'nombre', 'text'),
           ('consultorios', 'nombre_corto', 'text'), ('consultorios', 'telefono', 'text'), ('consultorios', 'timezone', 'text'),
           ('pacientes', 'activo', 'boolean'), ('pacientes', 'clinica_id', 'uuid'), ('pacientes', 'email', 'text'), ('pacientes', 'id', 'uuid'),
           ('pacientes', 'nombre', 'text'), ('profiles', 'apellido_materno', 'text'), ('profiles', 'apellido_paterno', 'text'),
           ('profiles', 'clinica_id', 'uuid'), ('profiles', 'es_admin_de_clinica', 'boolean'), ('profiles', 'id', 'uuid'), ('profiles', 'nombres', 'text'),
           ('profiles', 'role', 'text'), ('profiles', 'titulo', 'text')) e(t, c, tipo)
          WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c
                              AND a.attnum > 0 AND NOT a.attisdropped AND format_type(a.atttypid, a.atttypmod) = e.tipo)),
       'ALTO'
UNION ALL
SELECT 101, 'F4.2', '20261201160000', 'clinicas.suspendida es NOT NULL',
       coalesce((SELECT attnotnull::text FROM pg_attribute WHERE attrelid = to_regclass('public.clinicas') AND attname = 'suspendida' AND NOT attisdropped), 'NO EXISTE'),
       'true',
       coalesce((SELECT attnotnull FROM pg_attribute WHERE attrelid = to_regclass('public.clinicas') AND attname = 'suspendida' AND NOT attisdropped), false),
       'ALTO'
UNION ALL
SELECT 102, 'F4.3', '20261201160000', 'clinica_no_suspendida(): md5 con espacios normalizados (la copian contexto, responder, oferta y reagendar)',
       coalesce((SELECT md5(regexp_replace(prosrc, '\s+', ' ', 'g')) FROM pg_proc WHERE oid = to_regprocedure('public.clinica_no_suspendida()')), 'NO EXISTE'),
       '588de29d551f6d474eb24346748e1148',
       coalesce((SELECT md5(regexp_replace(prosrc, '\s+', ' ', 'g')) = '588de29d551f6d474eb24346748e1148' FROM pg_proc
                  WHERE oid = to_regprocedure('public.clinica_no_suspendida()')), false),
       'ALTO'
UNION ALL
SELECT 103, 'F4.4', '20261201160000', 'objetos de F4 que YA existen (cualquiera aborta F4)',
       coalesce((SELECT string_agg(o, ', ' ORDER BY o) FROM (
           SELECT 'tabla ' || t FROM unnest(ARRAY['cita_confirmaciones', 'cita_reagendos', 'cita_correos', 'avisos_clinica']) t
            WHERE to_regclass('public.' || t) IS NOT NULL
           UNION ALL SELECT 'función ' || proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'aviso_clinica_de_cita', 'aviso_clinica_de_confirmacion', 'aviso_clinica_de_empalme', 'aviso_clinica_de_movimiento_google',
             'aviso_clinica_de_reagendo', 'aviso_clinica_de_respuesta', 'aviso_clinica_revisar', 'cita_confirmacion_coincide',
             'cita_confirmacion_contexto', 'cita_confirmacion_emitir', 'cita_confirmacion_responder', 'cita_confirmacion_revocar',
             'cita_correo_marcar', 'cita_correo_tomar', 'cita_correos_pendientes', 'cita_nombre_saludo', 'cita_reagendar_clinica',
             'cita_reagendar_oferta', 'cita_recordatorios_pendientes', 'reagendar_por_enlace')
           UNION ALL SELECT 'disparador ' || tgname FROM pg_trigger WHERE NOT tgisinternal
             AND tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica', 'trg_gcal_movimientos_aviso_clinica')) x(o)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM unnest(ARRAY['cita_confirmaciones', 'cita_reagendos', 'cita_correos', 'avisos_clinica']) t
                    WHERE to_regclass('public.' || t) IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'aviso_clinica_de_cita', 'aviso_clinica_de_confirmacion', 'aviso_clinica_de_empalme', 'aviso_clinica_de_movimiento_google',
             'aviso_clinica_de_reagendo', 'aviso_clinica_de_respuesta', 'aviso_clinica_revisar', 'cita_confirmacion_coincide',
             'cita_confirmacion_contexto', 'cita_confirmacion_emitir', 'cita_confirmacion_responder', 'cita_confirmacion_revocar',
             'cita_correo_marcar', 'cita_correo_tomar', 'cita_correos_pendientes', 'cita_nombre_saludo', 'cita_reagendar_clinica',
             'cita_reagendar_oferta', 'cita_recordatorios_pendientes', 'reagendar_por_enlace'))
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
               AND tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica', 'trg_gcal_movimientos_aviso_clinica')),
       'ALTO'

-- ─── F5b · 20261201170000_agenda_f5b_protecciones_cita ───────────────
UNION ALL
SELECT 110, 'F5b.1', '20261201170000', 'appointments_status_check admite ''attended'' y ''cancelled''',
       coalesce(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_status_check'
                                       AND conrelid = to_regclass('public.appointments'))), 'NO EXISTE'),
       '… ''attended'' … ''cancelled'' …',
       coalesce(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_status_check'
                                       AND conrelid = to_regclass('public.appointments'))), '') ~ '''attended'''
         AND coalesce(pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_status_check'
                                       AND conrelid = to_regclass('public.appointments'))), '') ~ '''cancelled''',
       'ALTO'
UNION ALL
SELECT 111, 'F5b.2', '20261201170000', 'consultas.appointment_id y paciente_id, pacientes.id y clinica_id (uuid); get_clinica_id() devuelve uuid',
       (SELECT count(*)::text FROM pg_attribute WHERE NOT attisdropped AND atttypid = 'uuid'::regtype
           AND ((attrelid = to_regclass('public.consultas') AND attname IN ('appointment_id', 'paciente_id'))
             OR (attrelid = to_regclass('public.pacientes') AND attname IN ('id', 'clinica_id')))) || ' de 4 / '
         || coalesce((SELECT prorettype::regtype::text FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')), 'NO EXISTE'),
       '4 de 4 / uuid',
       (SELECT count(*) = 4 FROM pg_attribute WHERE NOT attisdropped AND atttypid = 'uuid'::regtype
           AND ((attrelid = to_regclass('public.consultas') AND attname IN ('appointment_id', 'paciente_id'))
             OR (attrelid = to_regclass('public.pacientes') AND attname IN ('id', 'clinica_id'))))
         AND coalesce((SELECT prorettype = 'uuid'::regtype FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')), false),
       'ALTO'
UNION ALL
SELECT 112, 'F5b.3', '20261201170000', 'índices de appointments que NO son válidos (el post-vuelo de F5b aborta con cualquiera)',
       coalesce((SELECT string_agg(indexrelid::regclass::text, ', ') FROM pg_index WHERE indrelid = to_regclass('public.appointments')
                  AND NOT (indisvalid AND indisready)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_index WHERE indrelid = to_regclass('public.appointments') AND NOT (indisvalid AND indisready)),
       'ALTO'
UNION ALL
SELECT 113, 'F5b.4', '20261201170000', 'objetos de F5b que YA existen (el pre-vuelo sólo admite los que tengan su forma exacta)',
       coalesce((SELECT string_agg(o, ', ' ORDER BY o) FROM (
           SELECT 'función ' || proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'cita_proteger_bloqueo', 'cita_proteger_atendida', 'cita_proteger_borrado', 'cita_proteger_cierre',
             'cita_proteger_eleccion', 'cita_proteger_reserva', 'cita_tiene_nota_ligada')
           UNION ALL SELECT 'columna appointments.' || attname FROM pg_attribute WHERE attrelid = to_regclass('public.appointments')
             AND attname IN ('cerrada_en', 'sustituida_por') AND NOT attisdropped
           UNION ALL SELECT 'restricción ' || conname FROM pg_constraint WHERE conrelid = to_regclass('public.appointments')
             AND conname IN ('appointments_cierre_check', 'appointments_sustituida_por_fkey')
           UNION ALL SELECT 'índice ' || x FROM unnest(ARRAY['idx_appointments_clinica_inicio', 'idx_appointments_clinica_medico_inicio',
                                                             'idx_appointments_sustituida_por']) x WHERE to_regclass('public.' || x) IS NOT NULL
           UNION ALL SELECT 'disparador ' || tgname FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND tgname IN (
             'trg_appointments_horario_bloqueado', 'trg_appointments_proteger_atendida', 'trg_appointments_proteger_borrado',
             'trg_appointments_proteger_cierre', 'trg_appointments_proteger_eleccion', 'trg_appointments_proteger_reserva')) x(o)), 'ninguno'),
       'ninguno',
       NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
             'cita_proteger_bloqueo', 'cita_proteger_atendida', 'cita_proteger_borrado', 'cita_proteger_cierre',
             'cita_proteger_eleccion', 'cita_proteger_reserva', 'cita_tiene_nota_ligada'))
         AND NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.appointments')
               AND attname IN ('cerrada_en', 'sustituida_por') AND NOT attisdropped)
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.appointments')
               AND conname IN ('appointments_cierre_check', 'appointments_sustituida_por_fkey'))
         AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['idx_appointments_clinica_inicio', 'idx_appointments_clinica_medico_inicio',
                                                    'idx_appointments_sustituida_por']) x WHERE to_regclass('public.' || x) IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments') AND tgname IN (
             'trg_appointments_horario_bloqueado', 'trg_appointments_proteger_atendida', 'trg_appointments_proteger_borrado',
             'trg_appointments_proteger_cierre', 'trg_appointments_proteger_eleccion', 'trg_appointments_proteger_reserva')),
       'ALTO'
)
SELECT id, migracion AS "migración", que AS "qué mira", coalesce(valor, '∅') AS valor, coalesce(esperado, '—') AS esperado,
       CASE WHEN si_falla = 'INFO' OR ok IS NULL THEN 'INFO' WHEN ok THEN 'OK' ELSE si_falla END AS veredicto
  FROM filas
 ORDER BY orden;

ROLLBACK;
