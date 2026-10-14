-- Fase 3 · P1 — EXECUTE sin PUBLIC en las funciones de public.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios objetos y termina en
-- rollback: no deja nada en la base ni depende de datos sembrados.
begin;

-- Simula la credencial de la consola: un rol que no es anon, authenticated
-- ni service_role, y que no es miembro de nada (solo le llega PUBLIC).
create role prueba_sin_permisos nologin;

-- Caso 1: prueba_sin_permisos no ejecuta ninguna función de public que no sea de extensión
do $$
declare v text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('prueba_sin_permisos', p.oid, 'EXECUTE');
  if v is not null then
    raise exception 'P1 caso 1: esperaba que prueba_sin_permisos no ejecutara nada, salió %', v;
  end if;
end $$;

-- Caso 2: criterio 1, ninguna función de public (sin extensiones) da EXECUTE a PUBLIC
do $$
declare v text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and (p.proacl is null
         or exists (select 1 from aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  if v is not null then
    raise exception 'P1 caso 2: esperaba cero funciones con PUBLIC, salió %', v;
  end if;
end $$;

-- Caso 3: criterio 2, las únicas cerradas a anon/authenticated/service_role son las de antes de P1.
-- Desde P1b (20261014130000_reasentar_permisos_funciones.sql) la lista de la base local reconstruida
-- con db reset es igual a la de producción: las 10 que cierran 20260912190416_remote_schema.sql y
-- 20260913_b5. Si una migración cierra o abre otra, esta lista cambia con ella.
do $$
declare v text;
begin
  select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '') into v
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and not (has_function_privilege('anon', p.oid, 'EXECUTE')
             and has_function_privilege('authenticated', p.oid, 'EXECUTE')
             and has_function_privilege('service_role', p.oid, 'EXECUTE'));
  if v <> 'alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()' then
    raise exception 'P1 caso 3: esperaba las diez funciones cerradas de producción, salió %', v;
  end if;
end $$;

-- Caso 4: criterio 3, existe la entrada global de privilegios por omisión de postgres sin PUBLIC
do $$
declare v bigint;
begin
  select count(*) into v from pg_default_acl d
  where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
    and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0);
  if v <> 1 then
    raise exception 'P1 caso 4: esperaba 1 entrada global sin PUBLIC, salió %', v;
  end if;
end $$;

-- Caso 5: una función nueva creada por postgres en public nace sin PUBLIC
set local role postgres;
create function public.p1_prueba_permisos() returns integer language sql as $$ select 1 $$;
reset role;
do $$
begin
  if has_function_privilege('prueba_sin_permisos', 'public.p1_prueba_permisos()'::regprocedure, 'EXECUTE') then
    raise exception 'P1 caso 5: esperaba que prueba_sin_permisos no ejecutara la función nueva, salió verdadero';
  end if;
  if not has_function_privilege('authenticated', 'public.p1_prueba_permisos()'::regprocedure, 'EXECUTE') then
    raise exception 'P1 caso 5: esperaba que authenticated ejecutara la función nueva, salió falso';
  end if;
end $$;

-- Caso 6: anon, authenticated y service_role ejecutan las dos funciones de acceso
do $$
declare r text; f text;
begin
  foreach f in array array['public.clinica_tiene_acceso()', 'public.clinica_no_suspendida()'] loop
    foreach r in array array['anon', 'authenticated', 'service_role'] loop
      if not has_function_privilege(r, f::regprocedure, 'EXECUTE') then
        raise exception 'P1 caso 6: esperaba que % ejecutara %, salió falso', r, f;
      end if;
    end loop;
  end loop;
end $$;

-- Caso 7: criterio 5, lista de Auth y Storage. Una sola función:
-- public.handle_new_user(), disparador de auth.users, la ejecuta supabase_auth_admin.
-- Storage no ejecuta ninguna función de public.
do $$
begin
  if not has_function_privilege('supabase_auth_admin', 'public.handle_new_user()'::regprocedure, 'EXECUTE') then
    raise exception 'P1 caso 7: esperaba que supabase_auth_admin ejecutara public.handle_new_user(), salió falso';
  end if;
end $$;

rollback;
