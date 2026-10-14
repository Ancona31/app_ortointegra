-- Fase 3 · P1b — permisos iguales a producción en 7 funciones y candado de las sa_*.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios objetos y termina en
-- rollback: no deja nada en la base ni depende de datos sembrados.
begin;

-- Casos 1 a 7: cada función ejecutable exactamente por los roles que tiene en producción
-- (20260912190416_remote_schema.sql:3371-3475). postgres es el dueño y no se comprueba.
do $$
declare
  e record;
  v_anon boolean; v_auth boolean; v_srv boolean; v_pub boolean;
  k integer := 0;
begin
  for e in
    select * from (values
      ('public.alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint)', true),
      ('public.enforce_limite_documentos_paciente()',                           true),
      ('public.generar_folio(text)',                                            false),
      ('public.guardar_secretos_conexion(uuid,uuid,text,text,bigint)',          true),
      ('public.leer_conexion_google_con_secretos(uuid,uuid)',                   true),
      ('public.sync_antropometria_paciente(uuid)',                              true),
      ('public.trg_mediciones_antropometria()',                                 true)
    ) as t(firma, service_role)
  loop
    k := k + 1;
    select has_function_privilege('anon', p.oid, 'EXECUTE'),
           has_function_privilege('authenticated', p.oid, 'EXECUTE'),
           has_function_privilege('service_role', p.oid, 'EXECUTE'),
           exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
      into v_anon, v_auth, v_srv, v_pub
    from pg_proc p where p.oid = e.firma::regprocedure;
    if v_anon or v_auth or v_pub or v_srv is distinct from e.service_role then
      raise exception 'P1b caso %: % esperaba anon=f authenticated=f public=f service_role=%, salió anon=% authenticated=% public=% service_role=%',
        k, e.firma, e.service_role, v_anon, v_auth, v_pub, v_srv;
    end if;
  end loop;
end $$;

-- Caso 8: una función de disparador sin EXECUTE para quien escribe se dispara igual
-- (las dos de disparador de arriba quedan cerradas a authenticated y la app inserta como authenticated)
create table public.p1b_prueba_disparador (x integer);
grant insert, select on public.p1b_prueba_disparador to authenticated;
create function public.p1b_prueba_disparador_fn() returns trigger language plpgsql as $$
begin new.x := new.x + 1; return new; end $$;
revoke execute on function public.p1b_prueba_disparador_fn() from public, anon, authenticated, service_role;
create trigger p1b_prueba_disparador_trg before insert on public.p1b_prueba_disparador
  for each row execute function public.p1b_prueba_disparador_fn();
set local role authenticated;
insert into public.p1b_prueba_disparador (x) values (1);
reset role;
do $$
begin
  if has_function_privilege('authenticated', 'public.p1b_prueba_disparador_fn()'::regprocedure, 'EXECUTE') then
    raise exception 'P1b caso 8: esperaba authenticated sin EXECUTE sobre la función del disparador, salió verdadero';
  end if;
  if (select x from public.p1b_prueba_disparador) is distinct from 2 then
    raise exception 'P1b caso 8: esperaba que el disparador corriera (x = 2), salió %', (select x from public.p1b_prueba_disparador);
  end if;
end $$;

-- Caso 9: como anon sin claims, cada sa_* falla con su excepción (antes de P1b el candado se abría)
set local role anon;
select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.role', '', true);
do $$
declare f text;
begin
  foreach f in array array['sa_heatmap_horarios(90)', 'sa_ranking_funciones(20)', 'sa_top_medicos(30, 10)', 'sa_uso_ia(30)'] loop
    begin
      execute format('select count(*) from public.%s', f);
      raise exception 'P1b caso 9: esperaba unauthorized en % sin claims, no falló', f;
    exception when insufficient_privilege then
      if sqlerrm <> 'unauthorized: super_admin required' then
        raise exception 'P1b caso 9: esperaba unauthorized en % sin claims, salió %', f, sqlerrm;
      end if;
    end;
  end loop;
end $$;
reset role;

-- Caso 10: como anon con claims {"role":"anon"}, cada sa_* falla con su excepción
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('request.jwt.claim.role', '', true);
do $$
declare f text;
begin
  foreach f in array array['sa_heatmap_horarios(90)', 'sa_ranking_funciones(20)', 'sa_top_medicos(30, 10)', 'sa_uso_ia(30)'] loop
    begin
      execute format('select count(*) from public.%s', f);
      raise exception 'P1b caso 10: esperaba unauthorized en % con role anon, no falló', f;
    exception when insufficient_privilege then
      if sqlerrm <> 'unauthorized: super_admin required' then
        raise exception 'P1b caso 10: esperaba unauthorized en % con role anon, salió %', f, sqlerrm;
      end if;
    end;
  end loop;
end $$;
reset role;

-- Caso 11: con claims {"role":"service_role"}, ninguna sa_* falla por el candado
set local role anon;
select set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('request.jwt.claim.role', '', true);
do $$
declare f text;
begin
  foreach f in array array['sa_heatmap_horarios(90)', 'sa_ranking_funciones(20)', 'sa_top_medicos(30, 10)', 'sa_uso_ia(30)'] loop
    begin
      execute format('select count(*) from public.%s', f);
    exception when others then
      raise exception 'P1b caso 11: esperaba que % no fallara con role service_role, salió %', f, sqlerrm;
    end;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Caso 12: cada sa_* solo difiere de la del volcado en la condición del candado
-- (md5 del cuerpo del volcado tras deshacer el cambio, la condición nueva una vez y la vieja ninguna,
--  y firma, retorno, SECURITY DEFINER, volatilidad y search_path sin cambios)
do $$
declare e record; p record;
begin
  for e in
    select * from (values
      ('public.sa_heatmap_horarios(integer)',    '2c80c0512cdfa6225f3acac09b065920', 'dias_atras integer DEFAULT 90',                         'TABLE(hora integer, dia_semana integer, total bigint)'),
      ('public.sa_ranking_funciones(integer)',   '650ac29c6c0ace03c517fcf3d114f242', 'limite integer DEFAULT 20',                             'TABLE(accion text, total bigint)'),
      ('public.sa_top_medicos(integer,integer)', '820a1fd7de068d51f047b3d36e2d27ce', 'dias_atras integer DEFAULT 30, limite integer DEFAULT 10', 'TABLE(user_id text, nombre text, clinica_nombre text, total bigint)'),
      ('public.sa_uso_ia(integer)',              '7e67b0754d2482e96ea83022d560bb3d', 'dias_atras integer DEFAULT 30',                         'TABLE(accion text, total bigint)')
    ) as t(firma, md5_volcado, argumentos, retorno)
  loop
    select pr.* into p from pg_proc pr where pr.oid = e.firma::regprocedure;
    if md5(replace(p.prosrc, $c$auth.role() is distinct from 'service_role'$c$, $c$auth.role() <> 'service_role'$c$)) <> e.md5_volcado then
      raise exception 'P1b caso 12: % cambia algo más que la condición del candado', e.firma;
    end if;
    if position($c$auth.role() <> 'service_role'$c$ in p.prosrc) > 0
       or (length(p.prosrc) - length(replace(p.prosrc, $c$auth.role() is distinct from 'service_role'$c$, '')))
          <> length($c$auth.role() is distinct from 'service_role'$c$) then
      raise exception 'P1b caso 12: % esperaba la condición nueva una vez y la vieja ninguna', e.firma;
    end if;
    if pg_get_function_arguments(p.oid) <> e.argumentos or pg_get_function_result(p.oid) <> e.retorno
       or not p.prosecdef or p.provolatile <> 'v' or p.proconfig is distinct from array['search_path=public'] then
      raise exception 'P1b caso 12: % cambió de firma, retorno, SECURITY DEFINER, volatilidad o search_path', e.firma;
    end if;
  end loop;
end $$;

rollback;
