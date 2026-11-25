-- Agenda B1 — agenda_ajustes: fábrica, rangos, RLS, candado e interruptor
-- (20261112130000_agenda_b1_ajustes_interruptor.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Dos clínicas. En la 1: administrador, médico invitado y secretaria. En la 2: su administrador.
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000001c1', 'B1 prueba uno'),
  ('00000000-0000-4000-8000-0000000001c2', 'B1 prueba dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000001a1'::uuid, 'b1-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000001b1'::uuid, 'b1-medico@prueba.local'),
               ('00000000-0000-4000-8000-0000000001d1'::uuid, 'b1-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-0000000001a2'::uuid, 'b1-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000001c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000001a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000001c1'
 where id = '00000000-0000-4000-8000-0000000001b1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000001c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000001d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000001c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000001a2';

-- Pone el sub del JWT. Se llama ANTES de `set local role`: los privilegios por omisión de
-- postgres quitan EXECUTE a PUBLIC también en pg_temp, y authenticated no podría llamarla.
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: valores por omisión = fábrica de §2, candado 1/2/3/60 e interruptor apagado (insert como postgres)
insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000001c2');
do $$
declare r public.agenda_ajustes;
begin
  select * into r from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c2';
  if (r.recordatorio_horas, r.anticipacion_min_horas, r.horizonte_dias, r.vigencia_enlace_unico_dias,
      r.candado_citas_activas, r.candado_reagendados, r.candado_cancelaciones, r.candado_ventana_dias,
      r.agenda_v2_encendida) is distinct from (24, 2, 60, 7, 1, 2, 3, 60, false) then
    raise exception 'B1 caso 1: valores por omisión inesperados %', r;
  end if;
  if (select count(*) from public.audit_log
       where tabla = 'agenda_ajustes' and registro_id = r.id and accion = 'INSERT' and user_id = 'system') <> 1 then
    raise exception 'B1 caso 1: el alta no dejó su fila de log_tabla_change';
  end if;
end $$;

-- Caso 2: los CHECK rechazan lo que se sale de los límites de §2 (bordes ±1)
do $$
declare
  v_caso record;
  v_ok boolean;
begin
  for v_caso in select * from (values
      ('recordatorio_horas', 0), ('recordatorio_horas', 73),
      ('anticipacion_min_horas', -1), ('anticipacion_min_horas', 73),
      ('horizonte_dias', 0), ('horizonte_dias', 366),
      ('vigencia_enlace_unico_dias', 0), ('vigencia_enlace_unico_dias', 31),
      ('candado_citas_activas', 0), ('candado_reagendados', -1),
      ('candado_cancelaciones', 0), ('candado_ventana_dias', 0)) c(col, val)
  loop
    v_ok := false;
    begin
      execute format('update public.agenda_ajustes set %I = %s where clinica_id = %L',
                     v_caso.col, v_caso.val, '00000000-0000-4000-8000-0000000001c2');
    exception when check_violation then
      v_ok := true;
    end;
    if not v_ok then
      raise exception 'B1 caso 2: el CHECK dejó pasar % = %', v_caso.col, v_caso.val;
    end if;
  end loop;
  -- Los bordes de dentro sí entran.
  update public.agenda_ajustes
     set recordatorio_horas = 72, anticipacion_min_horas = 0, horizonte_dias = 365, vigencia_enlace_unico_dias = 30
   where clinica_id = '00000000-0000-4000-8000-0000000001c2';
  update public.agenda_ajustes
     set recordatorio_horas = 1, anticipacion_min_horas = 72, horizonte_dias = 1, vigencia_enlace_unico_dias = 1
   where clinica_id = '00000000-0000-4000-8000-0000000001c2';
end $$;

-- Caso 3: el administrador inserta su fila y actualiza los 4 ajustes; cada cambio queda en audit_log
select pg_temp.como('00000000-0000-4000-8000-0000000001a1');
set local role authenticated;
insert into public.agenda_ajustes (clinica_id, recordatorio_horas)
values ('00000000-0000-4000-8000-0000000001c1', 48);
update public.agenda_ajustes
   set recordatorio_horas = 12, anticipacion_min_horas = 4, horizonte_dias = 90, vigencia_enlace_unico_dias = 14
 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
reset role;
do $$
declare r public.agenda_ajustes;
begin
  select * into r from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  if (r.recordatorio_horas, r.anticipacion_min_horas, r.horizonte_dias, r.vigencia_enlace_unico_dias)
     is distinct from (12, 4, 90, 14) then
    raise exception 'B1 caso 3: el administrador no pudo escribir sus ajustes (%)', r;
  end if;
  if (select count(*) from public.audit_log
       where tabla = 'agenda_ajustes' and registro_id = r.id and user_id = '00000000-0000-4000-8000-0000000001a1'
         and accion in ('INSERT', 'UPDATE')) <> 2 then
    raise exception 'B1 caso 3: esperaba INSERT y UPDATE del administrador en audit_log';
  end if;
end $$;

-- Caso 4: el médico invitado y la secretaria no pueden escribir (0 filas en UPDATE, 42501 en INSERT)
do $$
declare
  v_quien uuid;
  v_n integer;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000001b1', '00000000-0000-4000-8000-0000000001d1']::uuid[]
  loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    if (select count(*) from public.agenda_ajustes) <> 1 then
      raise exception 'B1 caso 4: % no ve la fila de su clínica (sólo lectura)', v_quien;
    end if;
    update public.agenda_ajustes set recordatorio_horas = 2 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then
      raise exception 'B1 caso 4: % actualizó % fila(s) sin ser administrador', v_quien, v_n;
    end if;
  end loop;
  -- Tampoco dan de alta la fila de su clínica: se borra antes (como postgres, sin JWT) para que el
  -- INSERT no choque con el UNIQUE y lo que se pruebe sea la RLS.
  perform set_config('request.jwt.claims', '', true);
  delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  foreach v_quien in array array['00000000-0000-4000-8000-0000000001b1', '00000000-0000-4000-8000-0000000001d1']::uuid[]
  loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000001c1');
      raise exception 'B1 caso 4: % insertó la fila de ajustes sin ser administrador', v_quien;
    exception when insufficient_privilege then
      null;
    end;
    reset role;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000001c1');
end $$;

-- Caso 5: el administrador no puede tocar el interruptor, el candado ni la identidad de la fila (42501)
do $$
declare v_cambio text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000001a1');
  foreach v_cambio in array array['agenda_v2_encendida = true', 'candado_citas_activas = 5',
                                  'candado_reagendados = 0', 'candado_cancelaciones = 9', 'candado_ventana_dias = 30',
                                  'clinica_id = ''00000000-0000-4000-8000-0000000001c2''',
                                  'id = gen_random_uuid()', 'created_at = now() - interval ''1 day''']
  loop
    set local role authenticated;
    begin
      execute format('update public.agenda_ajustes set %s where clinica_id = %L',
                     v_cambio, '00000000-0000-4000-8000-0000000001c1');
      raise exception 'B1 caso 5: el administrador pudo hacer «%»', v_cambio;
    exception when insufficient_privilege then
      null;
    end;
    reset role;
  end loop;
  -- Tampoco al dar de alta: un INSERT con el interruptor encendido o un candado distinto.
  delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  set local role authenticated;
  begin
    insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000001c1', true);
    raise exception 'B1 caso 5: el administrador dio de alta con el interruptor encendido';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.agenda_ajustes (clinica_id, candado_reagendados) values ('00000000-0000-4000-8000-0000000001c1', 7);
    raise exception 'B1 caso 5: el administrador dio de alta con otro candado';
  exception when insufficient_privilege then
    null;
  end;
  insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000001c1');
  reset role;
end $$;

-- Caso 5b: service_role tampoco cambia el interruptor; postgres sí
set local role service_role;
do $$
begin
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  raise exception 'B1 caso 5b: service_role encendió el interruptor';
exception when insufficient_privilege then
  null;
end $$;
reset role;
update public.agenda_ajustes set agenda_v2_encendida = true, candado_reagendados = 4
 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
do $$
begin
  if not (select agenda_v2_encendida and candado_reagendados = 4 from public.agenda_ajustes
           where clinica_id = '00000000-0000-4000-8000-0000000001c1') then
    raise exception 'B1 caso 5b: postgres no pudo encender el interruptor ni cambiar el candado';
  end if;
end $$;

-- Caso 5c: un UPDATE pone updated_at = now() aunque no lo mande nadie
update public.agenda_ajustes set created_at = now() - interval '2 days', updated_at = now() - interval '2 days'
 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
select pg_temp.como('00000000-0000-4000-8000-0000000001a1');
set local role authenticated;
update public.agenda_ajustes set horizonte_dias = 120 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
reset role;
do $$
begin
  if (select updated_at from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1') <> now() then
    raise exception 'B1 caso 5c: updated_at no se movió con el UPDATE del administrador';
  end if;
end $$;

-- Caso 6: otra clínica no ve la fila ni la puede tocar (la dos tiene la suya, del caso 1)
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000001a2');
  set local role authenticated;
  if exists (select 1 from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1') then
    raise exception 'B1 caso 6: la clínica dos ve la fila de la clínica uno';
  end if;
  if (select count(*) from public.agenda_ajustes) <> 1 then
    raise exception 'B1 caso 6: la clínica dos no ve exactamente su fila';
  end if;
  update public.agenda_ajustes set recordatorio_horas = 3 where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'B1 caso 6: la clínica dos actualizó la fila de la clínica uno';
  end if;
  begin
    insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000001c1');
    raise exception 'B1 caso 6: la clínica dos insertó para la clínica uno';
  exception when insufficient_privilege then
    null;  -- la RLS, antes que el UNIQUE: no delata que la fila ajena existe
  end;
  reset role;
end $$;

-- Caso 7: anon no tiene privilegios; authenticated no puede borrar (ni con policy, ni con privilegio)
set local role anon;
do $$
begin
  perform 1 from public.agenda_ajustes;
  raise exception 'B1 caso 7: anon pudo leer agenda_ajustes';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000001a1');
set local role authenticated;
do $$
begin
  delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000001c1';
  raise exception 'B1 caso 7: el administrador pudo borrar su fila';
exception when insufficient_privilege then
  null;
end $$;
reset role;

-- Caso 8: la FK es RESTRICT: no se borra una clínica con fila de ajustes (como postgres, sin JWT)
select set_config('request.jwt.claims', '', true);
do $$
declare v_fk text;
begin
  delete from public.clinicas where id = '00000000-0000-4000-8000-0000000001c2';
  raise exception 'B1 caso 8: se borró una clínica con fila de ajustes';
exception when foreign_key_violation then
  get stacked diagnostics v_fk = constraint_name;
  if v_fk <> 'agenda_ajustes_clinica_id_fkey' then
    raise exception 'B1 caso 8: lo frenó otra FK (%), no la de agenda_ajustes', v_fk;
  end if;
end $$;

-- Caso 9: EXECUTE de proteger_agenda_ajustes quitado a PUBLIC y concedido a los tres roles
do $$
begin
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              where p.oid = 'public.proteger_agenda_ajustes()'::regprocedure and a.grantee = 0) then
    raise exception 'B1 caso 9: PUBLIC conserva EXECUTE sobre proteger_agenda_ajustes()';
  end if;
  if not (has_function_privilege('anon', 'public.proteger_agenda_ajustes()', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.proteger_agenda_ajustes()', 'EXECUTE')
          and has_function_privilege('service_role', 'public.proteger_agenda_ajustes()', 'EXECUTE')) then
    raise exception 'B1 caso 9: falta EXECUTE para anon, authenticated o service_role';
  end if;
end $$;

rollback;
