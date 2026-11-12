-- Agenda B6 — tipos_cita: RLS por rol y por clínica, archivo sin borrado, FK
-- compuesta desde appointments, validación del médico, unicidad y CHECK
-- (20261112150000_agenda_b6_tipos_cita.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Dos clínicas. En la 1: administrador, dos médicos invitados y secretaria. En la 2: su administrador.
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000006c1', 'B6 prueba uno'),
  ('00000000-0000-4000-8000-0000000006c2', 'B6 prueba dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000006a1'::uuid, 'b6-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000006b1'::uuid, 'b6-medico-b@prueba.local'),
               ('00000000-0000-4000-8000-0000000006b2'::uuid, 'b6-medico-c@prueba.local'),
               ('00000000-0000-4000-8000-0000000006d1'::uuid, 'b6-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-0000000006a2'::uuid, 'b6-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000006c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000006a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000006c1'
 where id in ('00000000-0000-4000-8000-0000000006b1', '00000000-0000-4000-8000-0000000006b2');
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000006c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000006d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000006c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000006a2';

-- Pone el sub del JWT. Se llama ANTES de `set local role`: los privilegios por omisión de
-- postgres quitan EXECUTE a PUBLIC también en pg_temp, y authenticated no podría llamarla.
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: el administrador crea un tipo de toda la clínica y uno personal para cada invitado;
-- cada alta queda en audit_log con su user_id
select pg_temp.como('00000000-0000-4000-8000-0000000006a1');
set local role authenticated;
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, color) values
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-0000000006c1', null, 'Primera vez', 45, 'indigo'),
  ('00000000-0000-4000-8000-0000000006f2', '00000000-0000-4000-8000-0000000006c1',
   '00000000-0000-4000-8000-0000000006b1', 'Valoración B', 30, null),
  ('00000000-0000-4000-8000-0000000006f3', '00000000-0000-4000-8000-0000000006c1',
   '00000000-0000-4000-8000-0000000006b2', 'Valoración C', 20, 'oliva');
update public.tipos_cita set duracion_min = 60, nombre = 'Primera vez (larga)'
 where id = '00000000-0000-4000-8000-0000000006f1';
reset role;
do $$
begin
  if (select count(*) from public.audit_log
       where tabla = 'tipos_cita' and user_id = '00000000-0000-4000-8000-0000000006a1'
         and registro_id in ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-0000000006f2',
                             '00000000-0000-4000-8000-0000000006f3')) <> 4 then
    raise exception 'B6 caso 1: esperaba 3 INSERT y 1 UPDATE del administrador en audit_log';
  end if;
  if (select duracion_min from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f1') <> 60 then
    raise exception 'B6 caso 1: el administrador no pudo editar el tipo';
  end if;
end $$;

-- Caso 2: quién ve qué. Invitado B: el de clínica y el suyo. Secretaria y administrador: los tres.
-- La otra clínica: nada.
do $$
declare
  v_caso record;
  v_vistos text;
begin
  for v_caso in select * from (values
      ('00000000-0000-4000-8000-0000000006b1'::uuid, 'f1,f2'),
      ('00000000-0000-4000-8000-0000000006b2'::uuid, 'f1,f3'),
      ('00000000-0000-4000-8000-0000000006d1'::uuid, 'f1,f2,f3'),
      ('00000000-0000-4000-8000-0000000006a1'::uuid, 'f1,f2,f3'),
      ('00000000-0000-4000-8000-0000000006a2'::uuid, '')) c(quien, esperado)
  loop
    perform pg_temp.como(v_caso.quien);
    set local role authenticated;
    select coalesce(string_agg(right(id::text, 2), ',' order by id), '') into v_vistos from public.tipos_cita;
    reset role;
    if v_vistos <> v_caso.esperado then
      raise exception 'B6 caso 2: % ve [%], esperaba [%]', v_caso.quien, v_vistos, v_caso.esperado;
    end if;
  end loop;
end $$;

-- Caso 3: ni el invitado, ni la secretaria, ni otra clínica crean o editan (42501 / 0 filas)
do $$
declare
  v_quien uuid;
  v_n integer;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000006b1', '00000000-0000-4000-8000-0000000006d1',
                                 '00000000-0000-4000-8000-0000000006a2']::uuid[]
  loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      insert into public.tipos_cita (clinica_id, nombre, duracion_min)
      values ('00000000-0000-4000-8000-0000000006c1', 'Intruso', 30);
      raise exception 'B6 caso 3: % creó un tipo en la clínica uno', v_quien;
    exception when insufficient_privilege then
      null;
    end;
    update public.tipos_cita set duracion_min = 5;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then
      raise exception 'B6 caso 3: % editó % tipo(s) sin ser administrador de la clínica', v_quien, v_n;
    end if;
  end loop;
  if (select duracion_min from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f2') <> 30 then
    raise exception 'B6 caso 3: un tipo cambió de duración';
  end if;
end $$;

-- Caso 4: el administrador no saca un tipo de su clínica (WITH CHECK) ni lo borra (sin privilegio)
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000006a1');
  set local role authenticated;
  begin
    update public.tipos_cita set clinica_id = '00000000-0000-4000-8000-0000000006c2'
     where id = '00000000-0000-4000-8000-0000000006f1';
    raise exception 'B6 caso 4: el administrador movió un tipo a otra clínica';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f1';
    raise exception 'B6 caso 4: el administrador borró un tipo';
  exception when insufficient_privilege then
    null;
  end;
  -- Archivar sí.
  update public.tipos_cita set activo = false where id = '00000000-0000-4000-8000-0000000006f3';
  reset role;
  if (select activo from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f3') then
    raise exception 'B6 caso 4: el administrador no pudo archivar';
  end if;
end $$;

-- Caso 5: anon no tiene ningún privilegio
set local role anon;
do $$
begin
  perform 1 from public.tipos_cita;
  raise exception 'B6 caso 5: anon pudo leer tipos_cita';
exception when insufficient_privilege then
  null;
end $$;
reset role;

-- Caso 6: validar_tipo_cita_medico. Como postgres: un médico de otra clínica o una secretaria → 23514.
-- Como el administrador: tampoco un médico de otra clínica (no lo ve por RLS, falla cerrado).
select set_config('request.jwt.claims', '', true);
do $$
declare v_medico uuid;
begin
  foreach v_medico in array array['00000000-0000-4000-8000-0000000006a2', '00000000-0000-4000-8000-0000000006d1']::uuid[]
  loop
    begin
      insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min)
      values ('00000000-0000-4000-8000-0000000006c1', v_medico, 'Ajeno', 30);
      raise exception 'B6 caso 6: se aceptó a % como médico del tipo', v_medico;
    exception when check_violation then
      null;
    end;
  end loop;
  perform pg_temp.como('00000000-0000-4000-8000-0000000006a1');
  set local role authenticated;
  begin
    insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min)
    values ('00000000-0000-4000-8000-0000000006c1', '00000000-0000-4000-8000-0000000006a2', 'Ajeno', 30);
    raise exception 'B6 caso 6: el administrador asignó un tipo a un médico de otra clínica';
  exception when check_violation then
    null;
  end;
  begin
    update public.tipos_cita set medico_id = '00000000-0000-4000-8000-0000000006a2'
     where id = '00000000-0000-4000-8000-0000000006f2';
    raise exception 'B6 caso 6: el administrador movió un tipo a un médico de otra clínica';
  exception when check_violation then
    null;
  end;
  reset role;
end $$;

-- Caso 7: el nombre es único entre los activos de cada ámbito, sin distinguir mayúsculas ni espacios;
-- un tipo personal puede llamarse igual que uno de clínica; archivar libera el nombre
select set_config('request.jwt.claims', '', true);
do $$
begin
  begin
    insert into public.tipos_cita (clinica_id, nombre, duracion_min)
    values ('00000000-0000-4000-8000-0000000006c1', '  primera VEZ (larga) ', 30);
    raise exception 'B6 caso 7: se repitió el nombre de un tipo de clínica';
  exception when unique_violation then
    null;
  end;
  insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min)
  values ('00000000-0000-4000-8000-0000000006c1', '00000000-0000-4000-8000-0000000006b1', 'Primera vez (larga)', 30);
  insert into public.tipos_cita (clinica_id, nombre, duracion_min)
  values ('00000000-0000-4000-8000-0000000006c2', 'Primera vez (larga)', 30);
  -- f3 («Valoración C», de C) está archivado: su nombre vuelve a estar libre en su ámbito.
  insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min)
  values ('00000000-0000-4000-8000-0000000006c1', '00000000-0000-4000-8000-0000000006b2', 'Valoración C', 25);
  begin
    update public.tipos_cita set activo = true where id = '00000000-0000-4000-8000-0000000006f3';
    raise exception 'B6 caso 7: se reactivó un tipo con un nombre ya tomado';
  exception when unique_violation then
    null;
  end;
end $$;

-- Caso 8: los CHECK (nombre 1-60 sin sólo espacios, duración 5-600 en múltiplos de 5, los seis colores)
do $$
declare
  v_caso record;
  v_ok boolean;
begin
  for v_caso in select * from (values
      ('nombre', '''   '''), ('nombre', quote_literal(repeat('x', 61))),
      ('duracion_min', '0'), ('duracion_min', '3'), ('duracion_min', '7'), ('duracion_min', '605'),
      ('color', '''rojo''')) c(col, val)
  loop
    v_ok := false;
    begin
      execute format('update public.tipos_cita set %I = %s where id = %L',
                     v_caso.col, v_caso.val, '00000000-0000-4000-8000-0000000006f2');
    exception when check_violation then
      v_ok := true;
    end;
    if not v_ok then
      raise exception 'B6 caso 8: el CHECK dejó pasar % = %', v_caso.col, v_caso.val;
    end if;
  end loop;
  update public.tipos_cita set duracion_min = 600, nombre = repeat('y', 60) where id = '00000000-0000-4000-8000-0000000006f2';
  update public.tipos_cita set duracion_min = 5, nombre = 'Valoración B' where id = '00000000-0000-4000-8000-0000000006f2';
end $$;

-- Caso 9: updated_at se mueve en cada UPDATE aunque nadie lo mande
update public.tipos_cita set created_at = now() - interval '2 days', updated_at = now() - interval '2 days'
 where id = '00000000-0000-4000-8000-0000000006f2';
do $$
begin
  if (select updated_at from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f2') <> now() then
    raise exception 'B6 caso 9: updated_at no se movió con el UPDATE';
  end if;
end $$;

-- Caso 10: appointments. Una cita usa un tipo de su clínica; uno de OTRA clínica → 23503;
-- tipo sin instantánea del nombre, o nombre sin tipo → 23514; borrar un tipo en uso → 23503 (RESTRICT)
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time) values
  ('00000000-0000-4000-8000-0000000006e1', '00000000-0000-4000-8000-0000000006c1',
   '00000000-0000-4000-8000-0000000006b1', 'B6 cita', now() + interval '1 day', now() + interval '1 day 30 minutes');
update public.appointments set tipo_cita_id = '00000000-0000-4000-8000-0000000006f2', tipo_cita_nombre = 'Valoración B'
 where id = '00000000-0000-4000-8000-0000000006e1';
do $$
declare
  v_otro uuid;
  v_fk text;
begin
  select id into v_otro from public.tipos_cita where clinica_id = '00000000-0000-4000-8000-0000000006c2' limit 1;
  begin
    update public.appointments set tipo_cita_id = v_otro, tipo_cita_nombre = 'X'
     where id = '00000000-0000-4000-8000-0000000006e1';
    raise exception 'B6 caso 10: una cita usó un tipo de otra clínica';
  exception when foreign_key_violation then
    get stacked diagnostics v_fk = constraint_name;
    if v_fk <> 'appointments_tipo_cita_fkey' then
      raise exception 'B6 caso 10: lo frenó otra FK (%)', v_fk;
    end if;
  end;
  begin
    update public.appointments set tipo_cita_nombre = null where id = '00000000-0000-4000-8000-0000000006e1';
    raise exception 'B6 caso 10: una cita con tipo quedó sin instantánea del nombre';
  exception when check_violation then
    null;
  end;
  begin
    update public.appointments set tipo_cita_id = null where id = '00000000-0000-4000-8000-0000000006e1';
    raise exception 'B6 caso 10: una cita quedó con nombre de tipo y sin tipo';
  exception when check_violation then
    null;
  end;
  begin
    delete from public.tipos_cita where id = '00000000-0000-4000-8000-0000000006f2';
    raise exception 'B6 caso 10: se borró un tipo en uso';
  exception when foreign_key_violation then
    null;
  end;
  -- Y un tipo sin uso, como postgres, tampoco deja de estar protegido por las FKs de la clínica.
  begin
    delete from public.clinicas where id = '00000000-0000-4000-8000-0000000006c2';
    raise exception 'B6 caso 10: se borró una clínica con tipos de cita';
  exception when foreign_key_violation then
    null;
  end;
end $$;

-- Caso 11: la edición del tipo de una cita queda en la auditoría de citas (B0) sólo con nombres de columna
do $$
begin
  if not exists (select 1 from public.audit_log
                  where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-0000000006e1'
                    and accion = 'cita_editada' and descripcion like '%tipo_cita_id%'
                    and position('Valoración' in descripcion) = 0) then
    raise exception 'B6 caso 11: asignar el tipo no dejó cita_editada con el nombre de la columna (o dejó el valor)';
  end if;
end $$;

-- Caso 12: EXECUTE de las dos funciones quitado a PUBLIC y concedido a los tres roles
do $$
declare v_f regprocedure;
begin
  foreach v_f in array array['public.validar_tipo_cita_medico()'::regprocedure,
                             'public.update_tipos_cita_updated_at()'::regprocedure]
  loop
    if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = v_f and a.grantee = 0) then
      raise exception 'B6 caso 12: PUBLIC conserva EXECUTE sobre %', v_f;
    end if;
    if not (has_function_privilege('anon', v_f, 'EXECUTE')
            and has_function_privilege('authenticated', v_f, 'EXECUTE')
            and has_function_privilege('service_role', v_f, 'EXECUTE')) then
      raise exception 'B6 caso 12: falta EXECUTE para anon, authenticated o service_role en %', v_f;
    end if;
    if (select prosecdef from pg_proc where oid = v_f) then
      raise exception 'B6 caso 12: % es SECURITY DEFINER', v_f;
    end if;
  end loop;
end $$;

rollback;
