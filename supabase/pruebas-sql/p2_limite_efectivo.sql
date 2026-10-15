-- Fase 3 · P2 — columnas ajuste_*, public.limite_efectivo y protección de los ajustes.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de datos sembrados.
begin;

-- Caso 1: las cuatro columnas del contrato, con su tipo y anulables
do $$
declare v text;
begin
  select string_agg(column_name || ' ' || data_type || ' ' || is_nullable, ', ' order by column_name) into v
  from information_schema.columns
  where table_schema = 'public' and table_name = 'clinicas' and column_name like 'ajuste\_%';
  if v is distinct from 'ajuste_max_medicos integer YES, ajuste_max_secretarias integer YES, '
                        'ajuste_medicos_hasta timestamp with time zone YES, ajuste_secretarias_hasta timestamp with time zone YES' then
    raise exception 'P2 caso 1: esperaba las cuatro columnas ajuste_* del contrato, salió %', v;
  end if;
end $$;

-- Caso 2: las cuatro restricciones clinicas_ajuste_%
do $$
declare v text;
begin
  select string_agg(conname, ', ' order by conname) into v
  from pg_constraint where conrelid = 'public.clinicas'::regclass and conname like 'clinicas\_ajuste\_%';
  if v is distinct from 'clinicas_ajuste_medicos_hasta_con_valor, clinicas_ajuste_medicos_rango, '
                        'clinicas_ajuste_secretarias_hasta_con_valor, clinicas_ajuste_secretarias_rango' then
    raise exception 'P2 caso 2: esperaba las cuatro restricciones clinicas_ajuste_%%, salió %', v;
  end if;
end $$;

-- Caso 3: limite_efectivo es stable, security invoker, language sql y devuelve integer;
-- las dos funciones nuevas sin PUBLIC y con anon, authenticated y service_role
do $$
declare p record; f text; r text;
begin
  select pr.provolatile, pr.prosecdef, l.lanname, pg_get_function_result(pr.oid) as retorno into p
  from pg_proc pr join pg_language l on l.oid = pr.prolang
  where pr.oid = 'public.limite_efectivo(integer,integer,timestamptz)'::regprocedure;
  if p.provolatile <> 's' or p.prosecdef or p.lanname <> 'sql' or p.retorno <> 'integer' then
    raise exception 'P2 caso 3: esperaba stable, security invoker, sql, integer; salió %, secdef=%, %, %',
      p.provolatile, p.prosecdef, p.lanname, p.retorno;
  end if;
  foreach f in array array['public.limite_efectivo(integer,integer,timestamptz)', 'public.proteger_ajustes_clinica()'] loop
    if exists (select 1 from pg_proc pr
               where pr.oid = f::regprocedure
                 and (pr.proacl is null
                      or exists (select 1 from aclexplode(pr.proacl) a
                                 where a.grantee = 0 and a.privilege_type = 'EXECUTE'))) then
      raise exception 'P2 caso 3: esperaba % sin EXECUTE a PUBLIC', f;
    end if;
    foreach r in array array['anon', 'authenticated', 'service_role'] loop
      if not has_function_privilege(r, f::regprocedure, 'EXECUTE') then
        raise exception 'P2 caso 3: esperaba que % ejecutara %', r, f;
      end if;
    end loop;
  end loop;
end $$;

-- Casos 4 a 11: la regla del límite efectivo (§2 del plan)
do $$
declare e record; v integer; k integer := 3;
begin
  for e in
    select * from (values
      ('Ilimitado',         null::integer, 5,    null::timestamptz,               null::integer),
      ('Sin ajuste',        1,             null, null,                            1),
      ('Ajuste indefinido', 1,             3,    null,                            3),
      ('Ajuste vigente',    1,             3,    now() + interval '1 day',        3),
      ('Ajuste vencido',    1,             3,    now() - interval '1 second',     1),
      ('Vence justo ahora', 1,             3,    now(),                           1),
      ('El plan manda',     5,             3,    null,                            5),
      ('Igual al plan',     3,             3,    null,                            3)
    ) as t(nombre, base, ajuste, hasta, esperado)
  loop
    k := k + 1;
    v := public.limite_efectivo(e.base, e.ajuste, e.hasta);
    if v is distinct from e.esperado then
      raise exception 'P2 caso % (%): esperaba %, salió %', k, e.nombre, e.esperado, v;
    end if;
  end loop;
end $$;

-- Clínica de prueba (como postgres, que el disparador deja pasar)
insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-0000000000c2', 'P2 prueba');

-- Caso 12: los CHECK rechazan 0, negativos y «hasta» sin valor (23514)
do $$
declare s text;
begin
  foreach s in array array[
    'update public.clinicas set ajuste_max_medicos = 0 where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_medicos = -1 where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = 0 where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = -1 where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_medicos = null, ajuste_medicos_hasta = now() + interval ''1 day'' where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = null, ajuste_secretarias_hasta = now() + interval ''1 day'' where id = ''00000000-0000-4000-8000-0000000000c2'''
  ] loop
    begin
      execute s;
      raise exception 'P2 caso 12: esperaba check_violation, pasó: %', s;
    exception when check_violation then
      null;
    end;
  end loop;
end $$;

-- Caso 13: los CHECK aceptan valores sin máximo (R6)
do $$
declare s text;
begin
  foreach s in array array[
    'update public.clinicas set ajuste_max_medicos = 10, ajuste_medicos_hasta = now() - interval ''1 day'' where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_medicos = 11, ajuste_medicos_hasta = null where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_medicos = 50, ajuste_medicos_hasta = null where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = 3, ajuste_secretarias_hasta = null where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = 4, ajuste_secretarias_hasta = null where id = ''00000000-0000-4000-8000-0000000000c2''',
    'update public.clinicas set ajuste_max_secretarias = 20, ajuste_secretarias_hasta = null where id = ''00000000-0000-4000-8000-0000000000c2'''
  ] loop
    begin
      execute s;
    exception when check_violation then
      raise exception 'P2 caso 13: esperaba que pasara, falló por check: %', s;
    end;
  end loop;
end $$;

-- Punto de partida para la protección: ajustes 2 médicos y 1 secretaria, sin fecha (como postgres)
update public.clinicas
   set ajuste_max_medicos = 2, ajuste_medicos_hasta = null, ajuste_max_secretarias = 1, ajuste_secretarias_hasta = null
 where id = '00000000-0000-4000-8000-0000000000c2';

-- Administrador de la clínica: usuario de Auth, su perfil lo crea handle_new_user
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'p2-admin@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000000c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000000a2';

-- Caso 14: como authenticated (administrador de su clínica), cambiar ajuste_max_medicos no cambia nada
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a2', 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2') then
    raise exception 'P2 caso 14: el administrador debería ver su clínica y no la ve';
  end if;
  begin
    update public.clinicas set ajuste_max_medicos = 9 where id = '00000000-0000-4000-8000-0000000000c2';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  if (select ajuste_max_medicos from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2') is distinct from 2 then
    raise exception 'P2 caso 14: esperaba ajuste_max_medicos = 2 tras el intento de authenticated, salió %',
      (select ajuste_max_medicos from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2');
  end if;
end $$;

-- Caso 15: como service_role (el webhook), cambiar o crear ajustes falla con 42501 por el disparador
set local role service_role;
do $$
begin
  begin
    update public.clinicas set ajuste_max_medicos = 9 where id = '00000000-0000-4000-8000-0000000000c2';
    raise exception 'P2 caso 15: esperaba 42501 al cambiar ajuste_max_medicos como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.clinicas set ajuste_medicos_hasta = now() + interval '1 day' where id = '00000000-0000-4000-8000-0000000000c2';
    raise exception 'P2 caso 15: esperaba 42501 al cambiar ajuste_medicos_hasta como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.clinicas set ajuste_max_secretarias = 9 where id = '00000000-0000-4000-8000-0000000000c2';
    raise exception 'P2 caso 15: esperaba 42501 al cambiar ajuste_max_secretarias como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.clinicas set ajuste_secretarias_hasta = now() + interval '1 day' where id = '00000000-0000-4000-8000-0000000000c2';
    raise exception 'P2 caso 15: esperaba 42501 al cambiar ajuste_secretarias_hasta como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.clinicas (nombre, ajuste_max_medicos) values ('P2 alta con ajuste de médicos', 2);
    raise exception 'P2 caso 15: esperaba 42501 al crear una clínica con ajuste de médicos como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.clinicas (nombre, ajuste_max_secretarias) values ('P2 alta con ajuste', 2);
    raise exception 'P2 caso 15: esperaba 42501 al crear una clínica con ajuste como service_role, pasó';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;
do $$
begin
  if (select (ajuste_max_medicos, ajuste_medicos_hasta, ajuste_max_secretarias, ajuste_secretarias_hasta)
        from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2')
     is distinct from (2, null::timestamptz, 1, null::timestamptz) then
    raise exception 'P2 caso 15: esperaba los ajustes sin cambio tras el intento de service_role';
  end if;
end $$;

-- Caso 16: como service_role, actualizar otra columna con los ajustes sin tocar, y crear una clínica
-- sin ajustes (el alta de /api/me/clinica), no falla por el disparador
set local role service_role;
update public.clinicas set nombre_display = 'P2 nombre nuevo' where id = '00000000-0000-4000-8000-0000000000c2';
insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-0000000000c3', 'P2 alta sin ajuste');
reset role;
do $$
begin
  if (select nombre_display from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2') is distinct from 'P2 nombre nuevo'
     or not exists (select 1 from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3') then
    raise exception 'P2 caso 16: esperaba el nombre nuevo y la clínica sin ajustes creada como service_role';
  end if;
end $$;

-- Caso 17: como postgres (la consola), cambiar los ajustes sí cambia
update public.clinicas set ajuste_max_medicos = 4, ajuste_medicos_hasta = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000000c2';
do $$
begin
  if (select public.limite_efectivo(max_medicos, ajuste_max_medicos, ajuste_medicos_hasta)
        from public.clinicas where id = '00000000-0000-4000-8000-0000000000c2') is distinct from 4 then
    raise exception 'P2 caso 17: esperaba límite efectivo de médicos 4 tras el cambio como postgres';
  end if;
end $$;

-- Caso 18: con una política de UPDATE para el administrador (el escenario que la protección prevé),
-- el disparador sigue rechazando a authenticated y le deja cambiar otras columnas
create policy p2_prueba_update_admin on public.clinicas for update to authenticated
  using (id = public.get_clinica_id()) with check (id = public.get_clinica_id());
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a2', 'role', 'authenticated')::text, true);
do $$
declare n integer;
begin
  begin
    update public.clinicas set ajuste_max_medicos = 9 where id = '00000000-0000-4000-8000-0000000000c2';
    raise exception 'P2 caso 18: esperaba 42501 al cambiar ajuste_max_medicos como authenticated con política de UPDATE, pasó';
  exception when insufficient_privilege then
    null;
  end;
  update public.clinicas set nombre_display = 'P2 por el administrador' where id = '00000000-0000-4000-8000-0000000000c2';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'P2 caso 18: esperaba que el administrador cambiara nombre_display (1 fila), salió %', n;
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

rollback;
