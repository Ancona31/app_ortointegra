-- scripts/produccion/catalogo.sql
--
-- Foto de la ESTRUCTURA de una base Postgres leída de los catálogos. Sólo lee:
-- ningún dato de tablas de usuario, sólo pg_catalog. Una fila JSON por objeto:
--   {"t": tipo, "s": esquema|null, "k": clave, "v": {campos…}}
-- La consume comparar-estructura.py. Se corre con
--   psql -X -q -At -v ON_ERROR_STOP=1 -f catalogo.sql
--
-- Normalizaciones (para que dos bases equivalentes den lo mismo):
--   * permisos con aclexplode sobre coalesce(acl, acldefault(...)): un ACL nulo
--     y su equivalente explícito son iguales; sin el grantor (ruido de dueños);
--   * los objetos que pertenecen a una extensión NO se listan uno por uno: los
--     fija la versión de la extensión (tipo «extension»);
--   * se excluyen pg_catalog, information_schema, pg_toast y los pg_temp_*;
--   * las variables de configuración con pinta de secreto salen como <oculto>.

BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '120s';

-- Fragmentos reutilizados (variables de psql: una transacción de sólo lectura
-- no admite CREATE, ni siquiera de vistas temporales).
\set _ext '(SELECT classid, objid FROM pg_depend WHERE deptype = ''e'')'
\set _ns '(SELECT oid, nspname FROM pg_namespace WHERE nspname NOT IN (''pg_catalog'', ''information_schema'', ''pg_toast'') AND nspname !~ ''^pg_(temp|toast_temp)_'')'
\set _rol '(SELECT 0::oid AS oid, ''PUBLIC''::text AS rolname UNION ALL SELECT oid, rolname::text FROM pg_roles)'

-- ---------------------------------------------------------------- servidor
SELECT json_build_object('t','servidor','s',NULL,'k','version',
  'v', json_build_object('server_version_num', current_setting('server_version_num')));

-- ---------------------------------------------------------------- esquemas
SELECT json_build_object('t','esquema','s',n.nspname,'k',n.nspname,
  'v', json_build_object('dueno', pg_get_userbyid(x.nspowner)))
FROM :_ns n JOIN pg_namespace x ON x.oid = n.oid
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_namespace'::regclass AND e.objid=n.oid)
ORDER BY 1::text;

SELECT json_build_object('t','permiso','s',n.nspname,'k','esquema '||quote_ident(n.nspname)||' → '||r.rolname,
  'v', json_build_object('privilegios', string_agg(a.privilege_type || CASE WHEN a.is_grantable THEN '*' ELSE '' END, ',' ORDER BY a.privilege_type)))
FROM :_ns n JOIN pg_namespace x ON x.oid = n.oid
CROSS JOIN LATERAL aclexplode(coalesce(x.nspacl, acldefault('n', x.nspowner))) a
JOIN :_rol r ON r.oid = a.grantee
GROUP BY n.nspname, r.rolname ORDER BY 1::text;

-- ---------------------------------------------------------------- relaciones
SELECT json_build_object('t','relacion','s',n.nspname,'k',quote_ident(n.nspname)||'.'||quote_ident(c.relname),
  'v', json_build_object(
    'clase', c.relkind, 'dueno', pg_get_userbyid(c.relowner),
    'persistencia', c.relpersistence,
    'rls', c.relrowsecurity, 'rls_forzado', c.relforcerowsecurity,
    'replica_identity', c.relreplident::text,
    'particionada_de', (SELECT i.inhparent::regclass::text FROM pg_inherits i WHERE i.inhrelid=c.oid AND c.relispartition),
    'limite_particion', CASE WHEN c.relispartition THEN pg_get_expr(c.relpartbound, c.oid) END,
    'opciones', (SELECT string_agg(o, ',' ORDER BY o) FROM unnest(c.reloptions) o),
    'definicion_vista', CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid) END,
    'md5_vista', CASE WHEN c.relkind IN ('v','m') THEN md5(pg_get_viewdef(c.oid)) END))
FROM pg_class c JOIN :_ns n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p','v','m','S','f')
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
ORDER BY 1::text;

SELECT json_build_object('t','permiso','s',n.nspname,
  'k', CASE c.relkind WHEN 'S' THEN 'secuencia ' ELSE 'tabla ' END
       ||quote_ident(n.nspname)||'.'||quote_ident(c.relname)||' → '||r.rolname,
  'v', json_build_object('privilegios', string_agg(a.privilege_type || CASE WHEN a.is_grantable THEN '*' ELSE '' END, ',' ORDER BY a.privilege_type)))
FROM pg_class c JOIN :_ns n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault(CASE c.relkind WHEN 'S' THEN 's' ELSE 'r' END::"char", c.relowner))) a
JOIN :_rol r ON r.oid = a.grantee
WHERE c.relkind IN ('r','p','v','m','S','f')
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
GROUP BY n.nspname, c.relname, c.relkind, r.rolname ORDER BY 1::text;

-- ---------------------------------------------------------------- columnas
SELECT json_build_object('t','columna','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||quote_ident(c.relname)||'.'||quote_ident(a.attname),
  'v', json_build_object(
    'orden', row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum),
    'tipo', format_type(a.atttypid, a.atttypmod),
    'no_nulo', a.attnotnull,
    'default', CASE WHEN a.attgenerated = '' THEN pg_get_expr(d.adbin, d.adrelid) END,
    'generada', CASE WHEN a.attgenerated <> '' THEN a.attgenerated::text || ':' || pg_get_expr(d.adbin, d.adrelid) END,
    'identidad', NULLIF(a.attidentity::text, ''),
    'collation', CASE WHEN a.attcollation <> 0 AND a.attcollation <> (SELECT typcollation FROM pg_type WHERE oid=a.atttypid)
                      THEN a.attcollation::regcollation::text END))
FROM pg_class c JOIN :_ns n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relkind IN ('r','p','v','m','f')
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
ORDER BY 1::text;

SELECT json_build_object('t','permiso','s',n.nspname,
  'k', 'columna '||quote_ident(n.nspname)||'.'||quote_ident(c.relname)||'.'||quote_ident(a.attname)||' → '||r.rolname,
  'v', json_build_object('privilegios', string_agg(x.privilege_type || CASE WHEN x.is_grantable THEN '*' ELSE '' END, ',' ORDER BY x.privilege_type)))
FROM pg_class c JOIN :_ns n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
CROSS JOIN LATERAL aclexplode(a.attacl) x
JOIN :_rol r ON r.oid = x.grantee
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
GROUP BY n.nspname, c.relname, a.attname, r.rolname ORDER BY 1::text;

-- ---------------------------------------------------------------- restricciones
SELECT json_build_object('t','restriccion','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||coalesce(quote_ident(cl.relname), '(tipo '||con.contypid::regtype::text||')')||'.'||quote_ident(con.conname),
  'v', json_build_object('clase', con.contype, 'definicion', pg_get_constraintdef(con.oid),
                         'diferible', con.condeferrable, 'diferida', con.condeferred, 'validada', con.convalidated))
FROM pg_constraint con JOIN :_ns n ON n.oid = con.connamespace
LEFT JOIN pg_class cl ON cl.oid = con.conrelid
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=con.conrelid)
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_type'::regclass AND e.objid=con.contypid)
ORDER BY 1::text;

-- ---------------------------------------------------------------- índices
SELECT json_build_object('t','indice','s',n.nspname,'k',quote_ident(n.nspname)||'.'||quote_ident(ic.relname),
  'v', json_build_object('definicion', pg_get_indexdef(i.indexrelid), 'valido', i.indisvalid))
FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN :_ns n ON n.oid = ic.relnamespace
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=i.indrelid)
ORDER BY 1::text;

-- ---------------------------------------------------------------- secuencias
SELECT json_build_object('t','secuencia','s',n.nspname,'k',quote_ident(n.nspname)||'.'||quote_ident(c.relname),
  'v', json_build_object('tipo', s.seqtypid::regtype::text, 'inicio', s.seqstart, 'incremento', s.seqincrement,
                         'minimo', s.seqmin, 'maximo', s.seqmax, 'cache', s.seqcache, 'ciclo', s.seqcycle,
                         'propiedad_de', (SELECT d.refobjid::regclass::text||'.'||a.attname FROM pg_depend d
                                          JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
                                          WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('a','i') LIMIT 1)))
FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN :_ns n ON n.oid = c.relnamespace
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
ORDER BY 1::text;

-- ---------------------------------------------------------------- funciones
SELECT json_build_object('t','funcion','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||quote_ident(p.proname)||'('||pg_get_function_identity_arguments(p.oid)||')',
  'v', json_build_object(
    'clase', p.prokind, 'lenguaje', l.lanname, 'devuelve', pg_get_function_result(p.oid),
    'argumentos', pg_get_function_arguments(p.oid),
    'security_definer', p.prosecdef, 'volatilidad', p.provolatile, 'estricta', p.proisstrict,
    'leakproof', p.proleakproof, 'paralelo', p.proparallel,
    'config', (SELECT string_agg(o, ',' ORDER BY o) FROM unnest(p.proconfig) o),
    'dueno', pg_get_userbyid(p.proowner),
    'md5_cuerpo', md5(coalesce(p.prosrc, '')),
    'cuerpo', p.prosrc))
FROM pg_proc p JOIN :_ns n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_proc'::regclass AND e.objid=p.oid)
ORDER BY 1::text;

SELECT json_build_object('t','permiso','s',n.nspname,
  'k', 'funcion '||quote_ident(n.nspname)||'.'||quote_ident(p.proname)||'('||pg_get_function_identity_arguments(p.oid)||') → '||r.rolname,
  'v', json_build_object('privilegios', string_agg(a.privilege_type || CASE WHEN a.is_grantable THEN '*' ELSE '' END, ',' ORDER BY a.privilege_type)))
FROM pg_proc p JOIN :_ns n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
JOIN :_rol r ON r.oid = a.grantee
WHERE NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_proc'::regclass AND e.objid=p.oid)
GROUP BY n.nspname, p.proname, p.oid, r.rolname ORDER BY 1::text;

-- ---------------------------------------------------------------- disparadores
SELECT json_build_object('t','disparador','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||quote_ident(c.relname)||'.'||quote_ident(t.tgname),
  'v', json_build_object('definicion', pg_get_triggerdef(t.oid), 'estado', t.tgenabled))
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN :_ns n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid)
ORDER BY 1::text;

SELECT json_build_object('t','disparador_evento','s',NULL,'k',e.evtname,
  'v', json_build_object('evento', e.evtevent, 'estado', e.evtenabled, 'funcion', e.evtfoid::regproc::text,
                         'etiquetas', array_to_string(e.evttags, ','), 'dueno', pg_get_userbyid(e.evtowner)))
FROM pg_event_trigger e
WHERE NOT EXISTS (SELECT 1 FROM :_ext x WHERE x.classid='pg_event_trigger'::regclass AND x.objid=e.oid)
ORDER BY 1::text;

-- ---------------------------------------------------------------- reglas (no de vistas)
SELECT json_build_object('t','regla','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||quote_ident(c.relname)||'.'||quote_ident(r.rulename),
  'v', json_build_object('definicion', pg_get_ruledef(r.oid), 'estado', r.ev_enabled))
FROM pg_rewrite r JOIN pg_class c ON c.oid = r.ev_class JOIN :_ns n ON n.oid = c.relnamespace
WHERE r.rulename <> '_RETURN'
ORDER BY 1::text;

-- ---------------------------------------------------------------- policies
SELECT json_build_object('t','policy','s',n.nspname,
  'k', quote_ident(n.nspname)||'.'||quote_ident(c.relname)||'.'||quote_ident(p.polname),
  'v', json_build_object(
    'comando', p.polcmd, 'permisiva', p.polpermissive,
    'roles', (SELECT string_agg(y, ',' ORDER BY y) FROM unnest(p.polroles) x
              CROSS JOIN LATERAL (SELECT CASE WHEN x = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x)::text END AS y) z),
    'using', pg_get_expr(p.polqual, p.polrelid),
    'with_check', pg_get_expr(p.polwithcheck, p.polrelid)))
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN :_ns n ON n.oid = c.relnamespace
ORDER BY 1::text;

-- ---------------------------------------------------------------- tipos
SELECT json_build_object('t','tipo','s',n.nspname,'k',quote_ident(n.nspname)||'.'||quote_ident(t.typname),
  'v', json_build_object(
    'clase', t.typtype, 'dueno', pg_get_userbyid(t.typowner),
    'etiquetas_enum', (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid),
    'base_dominio', CASE WHEN t.typtype='d' THEN format_type(t.typbasetype, t.typtypmod) END,
    'no_nulo', t.typnotnull, 'default', t.typdefault,
    'atributos', CASE WHEN t.typtype='c' THEN (SELECT string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod), ', ' ORDER BY a.attnum)
                     FROM pg_attribute a WHERE a.attrelid=t.typrelid AND a.attnum>0 AND NOT a.attisdropped) END,
    'rango_de', (SELECT r.rngsubtype::regtype::text FROM pg_range r WHERE r.rngtypid=t.oid)))
FROM pg_type t JOIN :_ns n ON n.oid = t.typnamespace
WHERE (t.typtype IN ('e','d','r','m')
       OR (t.typtype = 'c' AND (SELECT relkind FROM pg_class WHERE oid=t.typrelid) = 'c'))
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid='pg_type'::regclass AND e.objid=t.oid)
ORDER BY 1::text;

-- ---------------------------------------------------------------- comentarios
SELECT json_build_object('t','comentario','s',o.schema,
  'k', o.type||' '||o.identity,
  'v', json_build_object('texto', d.description))
FROM pg_description d
CROSS JOIN LATERAL pg_identify_object(d.classoid, d.objoid, d.objsubid) o
WHERE (o.schema IS NULL OR o.schema IN (SELECT nspname FROM :_ns))
  AND d.classoid <> 'pg_database'::regclass
  AND NOT EXISTS (SELECT 1 FROM :_ext e WHERE e.classid=d.classoid AND e.objid=d.objoid)
  AND NOT (d.classoid = 'pg_namespace'::regclass AND d.objoid IN (SELECT oid FROM pg_namespace WHERE nspname IN ('pg_catalog','information_schema','pg_toast')))
  AND NOT (d.classoid IN ('pg_proc'::regclass,'pg_type'::regclass,'pg_operator'::regclass,'pg_am'::regclass,'pg_opclass'::regclass,'pg_opfamily'::regclass,'pg_cast'::regclass,'pg_language'::regclass,'pg_collation'::regclass,'pg_conversion'::regclass,'pg_ts_config'::regclass,'pg_ts_dict'::regclass,'pg_ts_parser'::regclass,'pg_ts_template'::regclass,'pg_aggregate'::regclass) AND o.schema IS NULL)
  AND d.objoid >= 16384
ORDER BY 1::text;

-- ---------------------------------------------------------------- default privileges
SELECT json_build_object('t','default_privileges','s',n.nspname,
  'k', 'de '||pg_get_userbyid(d.defaclrole)||' en '||coalesce(n.nspname,'(todos)')||' para '||
       CASE d.defaclobjtype WHEN 'r' THEN 'tablas' WHEN 'S' THEN 'secuencias' WHEN 'f' THEN 'funciones'
                            WHEN 'T' THEN 'tipos' WHEN 'n' THEN 'esquemas' ELSE d.defaclobjtype::text END||' → '||r.rolname,
  'v', json_build_object('privilegios', string_agg(a.privilege_type || CASE WHEN a.is_grantable THEN '*' ELSE '' END, ',' ORDER BY a.privilege_type)))
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
JOIN :_rol r ON r.oid = a.grantee
WHERE n.oid IS NULL OR n.nspname !~ '^pg_(temp|toast_temp)_'
GROUP BY n.nspname, d.defaclrole, d.defaclobjtype, r.rolname ORDER BY 1::text;

-- ---------------------------------------------------------------- extensiones
SELECT json_build_object('t','extension','s',NULL,'k',e.extname,
  'v', json_build_object('version', e.extversion, 'esquema', e.extnamespace::regnamespace::text))
FROM pg_extension e ORDER BY 1::text;

-- ---------------------------------------------------------------- publicaciones (Realtime)
SELECT json_build_object('t','publicacion','s',NULL,'k',p.pubname,
  'v', json_build_object('todas_las_tablas', p.puballtables, 'insert', p.pubinsert, 'update', p.pubupdate,
                         'delete', p.pubdelete, 'truncate', p.pubtruncate, 'via_raiz', p.pubviaroot,
                         'dueno', pg_get_userbyid(p.pubowner)))
FROM pg_publication p ORDER BY 1::text;

SELECT json_build_object('t','publicacion_tabla','s',pt.schemaname,'k',pt.pubname||' ← '||quote_ident(pt.schemaname)||'.'||quote_ident(pt.tablename),
  'v', json_build_object('columnas', array_to_string(pt.attnames, ','), 'filtro', pt.rowfilter))
FROM pg_publication_tables pt ORDER BY 1::text;

SELECT json_build_object('t','publicacion_esquema','s',n.nspname,'k',p.pubname||' ← '||n.nspname,'v', json_build_object())
FROM pg_publication_namespace pn JOIN pg_publication p ON p.oid=pn.pnpubid JOIN pg_namespace n ON n.oid=pn.pnnspid
ORDER BY 1::text;

-- ---------------------------------------------------------------- roles
SELECT json_build_object('t','rol','s',NULL,'k',r.rolname,
  'v', json_build_object('superusuario', r.rolsuper, 'hereda', r.rolinherit, 'crea_roles', r.rolcreaterole,
                         'crea_bd', r.rolcreatedb, 'login', r.rolcanlogin, 'replicacion', r.rolreplication,
                         'bypassrls', r.rolbypassrls, 'limite_conexiones', r.rolconnlimit,
                         'miembro_de', (SELECT string_agg(g.rolname::text || CASE WHEN m.admin_option THEN '*' ELSE '' END, ',' ORDER BY g.rolname)
                                        FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid WHERE m.member=r.oid)))
FROM pg_roles r WHERE r.rolname !~ '^pg_' ORDER BY 1::text;

-- Configuración por rol / base (ALTER ROLE … SET, ALTER DATABASE … SET).
SELECT json_build_object('t','config','s',NULL,
  'k', coalesce('rol '||pg_get_userbyid(NULLIF(s.setrole,0)), 'todos los roles')||' en '||coalesce((SELECT datname FROM pg_database WHERE oid=NULLIF(s.setdatabase,0))::text,'(todas)')||' : '||split_part(c, '=', 1),
  'v', json_build_object('valor', CASE WHEN split_part(c,'=',1) ~* '(secret|password|passwd|key|token|jwt)' THEN '<oculto>'
                                       ELSE substr(c, length(split_part(c,'=',1))+2) END))
FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) c
WHERE s.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname=current_database()))
ORDER BY 1::text;

COMMIT;
