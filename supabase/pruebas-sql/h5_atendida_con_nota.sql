-- Tanda H, punto 22 (20261120130000_agenda_h5_atendida_con_nota.sql): una cita ATENDIDA con nota
-- clínica ligada no cambia de estado ni se borra (con la v2 encendida o apagada) y no se mueve
-- (con la v2 encendida; desde la tanda I, 20261121140000, también apagada), ni con la sesión (PostgREST directo, sin la API) ni como service_role.
-- Sin nota, todo como antes. postgres queda fuera (editor SQL, ayudantes de las e2e).
-- Mutaciones comprobadas en rojo:
--   · quitar los RAISE de cita_proteger_atendida() → «caso 1: admin cambió el estado…»;
--   · cita_tiene_nota_ligada() INVOKER en vez de DEFINER → «caso 1: … secretaria …» (la RLS de
--     consultas le oculta la nota) y «caso 2: el médico de la cita …».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

-- Clínica E (v2 encendida) y F (v2 apagada).
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-000000a5c001', 'H5 encendida'),
  ('00000000-0000-4000-8000-000000a5c002', 'H5 apagada');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000a5a001'::uuid, 'h5-admin1@prueba.local'),
               ('00000000-0000-4000-8000-000000a5e001'::uuid, 'h5-secre1@prueba.local'),
               ('00000000-0000-4000-8000-000000a5b001'::uuid, 'h5-medico1@prueba.local'),
               ('00000000-0000-4000-8000-000000a5a002'::uuid, 'h5-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a5c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a5a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a5c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000a5e001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a5c001', role = 'medico', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-000000a5b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a5c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a5a002';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000a5c001', true),
  ('00000000-0000-4000-8000-000000a5c002', false)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000a5f001', '00000000-0000-4000-8000-000000a5c001', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000a5f002', '00000000-0000-4000-8000-000000a5c002', 'Paciente', 'Dos');

-- Citas atendidas (como postgres). En E: d1/d2/d3/d5 con nota (d5 del médico sin administración, con
-- la nota del administrador, que la RLS de consultas no le enseña), d4 sin nota. En F: d6 con nota, d7 sin.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status)
select x.id::uuid, x.cl::uuid, x.med::uuid, x.pac::uuid, 'H5', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 'attended'
  from (values
    ('00000000-0000-4000-8000-000000a5d001', '00000000-0000-4000-8000-000000a5c001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5f001'),
    ('00000000-0000-4000-8000-000000a5d002', '00000000-0000-4000-8000-000000a5c001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5f001'),
    ('00000000-0000-4000-8000-000000a5d003', '00000000-0000-4000-8000-000000a5c001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5f001'),
    ('00000000-0000-4000-8000-000000a5d004', '00000000-0000-4000-8000-000000a5c001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5f001'),
    ('00000000-0000-4000-8000-000000a5d005', '00000000-0000-4000-8000-000000a5c001', '00000000-0000-4000-8000-000000a5b001', '00000000-0000-4000-8000-000000a5f001'),
    ('00000000-0000-4000-8000-000000a5d006', '00000000-0000-4000-8000-000000a5c002', '00000000-0000-4000-8000-000000a5a002', '00000000-0000-4000-8000-000000a5f002'),
    ('00000000-0000-4000-8000-000000a5d007', '00000000-0000-4000-8000-000000a5c002', '00000000-0000-4000-8000-000000a5a002', '00000000-0000-4000-8000-000000a5f002')
  ) x(id, cl, med, pac);
insert into public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
select p, m, 'NOTA DE PRUEBA H5', 'manual', a
  from (values
    ('00000000-0000-4000-8000-000000a5f001'::uuid, '00000000-0000-4000-8000-000000a5a001'::uuid, '00000000-0000-4000-8000-000000a5d001'::uuid),
    ('00000000-0000-4000-8000-000000a5f001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5d002'),
    ('00000000-0000-4000-8000-000000a5f001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5d003'),
    ('00000000-0000-4000-8000-000000a5f001', '00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5d005'),
    ('00000000-0000-4000-8000-000000a5f002', '00000000-0000-4000-8000-000000a5a002', '00000000-0000-4000-8000-000000a5d006')
  ) n(p, m, a);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: v2 encendida. Administrador y secretaria, con su sesión, no cambian el estado de una
-- atendida con nota (a ningún otro), no la mueven y no la borran (42501). Sí editan sus notas de
-- agenda y le reescriben el mismo estado (lo que hace el formulario).
do $$
declare v_quien uuid; v_estado text;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-000000a5a001', '00000000-0000-4000-8000-000000a5e001']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    foreach v_estado in array array['scheduled', 'confirmed', 'cancelled', 'no_show'] loop
      begin
        update public.appointments set status = v_estado where id = '00000000-0000-4000-8000-000000a5d001';
        raise exception 'H5 caso 1: % cambió el estado de una atendida con nota a %', v_quien, v_estado;
      exception when insufficient_privilege then null;
      end;
    end loop;
    begin
      update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
       where id = '00000000-0000-4000-8000-000000a5d001';
      raise exception 'H5 caso 1: % movió una atendida con nota', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set end_time = end_time + interval '15 minutes' where id = '00000000-0000-4000-8000-000000a5d001';
      raise exception 'H5 caso 1: % alargó una atendida con nota', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      delete from public.appointments where id = '00000000-0000-4000-8000-000000a5d001';
      raise exception 'H5 caso 1: % borró una atendida con nota', v_quien;
    exception when insufficient_privilege then null;
    end;
    update public.appointments set notes = 'nota de agenda ' || v_quien, status = 'attended',
           start_time = start_time, consultorio_id = null
     where id = '00000000-0000-4000-8000-000000a5d001';
    reset role;
  end loop;
  if (select status || '|' || coalesce(notes, '') from public.appointments where id = '00000000-0000-4000-8000-000000a5d001')
     <> 'attended|nota de agenda 00000000-0000-4000-8000-000000a5e001' then
    raise exception 'H5 caso 1: la atendida con nota no quedó atendida con la nota de agenda editada';
  end if;
end $$;

-- Caso 2: el médico de la cita que NO ve la nota (la escribió el administrador; consultas_select no
-- se la enseña) tampoco puede: la comprobación no depende de la RLS de quien escribe.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a5b001');
  set local role authenticated;
  if exists (select 1 from public.consultas where appointment_id = '00000000-0000-4000-8000-000000a5d005') then
    raise exception 'H5 caso 2: la prueba no vale: el médico ve la nota del administrador';
  end if;
  begin
    update public.appointments set status = 'no_show' where id = '00000000-0000-4000-8000-000000a5d005';
    raise exception 'H5 caso 2: el médico de la cita cambió el estado de una atendida con nota que no ve';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 3: service_role tampoco (ningún camino del servidor cambia una atendida), ni en masa.
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000a5d002';
    raise exception 'H5 caso 3: service_role cambió el estado de una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set start_time = start_time - interval '1 day', end_time = end_time - interval '1 day'
     where id = '00000000-0000-4000-8000-000000a5d002';
    raise exception 'H5 caso 3: service_role movió una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set status = 'scheduled' where clinica_id = '00000000-0000-4000-8000-000000a5c001';
    raise exception 'H5 caso 3: un cambio de estado masivo de service_role pasó';
  exception when insufficient_privilege then null;
  end;
  -- Lo que el servidor sí escribe sobre una atendida: Google y el mismo estado (gcal_aplicar_evento).
  update public.appointments set gcal_sync_status = 'synced', gcal_etag = 'e-h5', status = 'attended',
         start_time = start_time, end_time = end_time
   where id = '00000000-0000-4000-8000-000000a5d002';
  reset role;
end $$;

-- Caso 4: sin nota, como antes: la sesión (secretaria) mueve la atendida y corrige su estado, y
-- service_role también; y una atendida sin nota de la clínica apagada se borra.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a5e001');
  set local role authenticated;
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = '00000000-0000-4000-8000-000000a5d004';
  update public.appointments set status = 'no_show' where id = '00000000-0000-4000-8000-000000a5d004';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  update public.appointments set status = 'attended' where id = '00000000-0000-4000-8000-000000a5d004';
  update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000a5d004';
  reset role;
  if (select status from public.appointments where id = '00000000-0000-4000-8000-000000a5d004') <> 'scheduled' then
    raise exception 'H5 caso 4: la atendida sin nota no cambió de estado';
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000a5a002');
  set local role authenticated;
  delete from public.appointments where id = '00000000-0000-4000-8000-000000a5d007';
  reset role;
  if exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-000000a5d007') then
    raise exception 'H5 caso 4: con la v2 apagada no se borró una atendida sin nota';
  end if;
end $$;

-- Caso 5: v2 apagada. La atendida con nota no cambia de estado ni se borra (cita_proteger_borrado
-- no la cubre apagada: esto es sólo de este disparador). Tanda I (punto 1, 20261121140000): tampoco
-- se mueve (antes, con la v2 apagada, se movía como en la app; lo amplía i4_atendida_movida.sql).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a5a002');
  set local role authenticated;
  begin
    update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000a5d006';
    raise exception 'H5 caso 5: con la v2 apagada la sesión cambió el estado de una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.appointments where id = '00000000-0000-4000-8000-000000a5d006';
    raise exception 'H5 caso 5: con la v2 apagada la sesión borró una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
     where id = '00000000-0000-4000-8000-000000a5d006';
    raise exception 'H5 caso 5: con la v2 apagada la sesión movió una atendida con nota (tanda I, punto 1)';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select status from public.appointments where id = '00000000-0000-4000-8000-000000a5d006') <> 'attended' then
    raise exception 'H5 caso 5: con la v2 apagada la atendida con nota cambió de estado';
  end if;
end $$;

-- Caso 6: postgres (editor SQL, ayudantes de las e2e) sí cambia, mueve y borra; la nota queda sin
-- cita (SET NULL), como siempre que borra postgres.
update public.appointments set status = 'scheduled', start_time = start_time + interval '1 day', end_time = end_time + interval '1 day'
 where id = '00000000-0000-4000-8000-000000a5d002';
delete from public.appointments where id = '00000000-0000-4000-8000-000000a5d003';
do $$
begin
  if (select status from public.appointments where id = '00000000-0000-4000-8000-000000a5d002') <> 'scheduled'
     or exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-000000a5d003')
     or exists (select 1 from public.consultas where appointment_id = '00000000-0000-4000-8000-000000a5d003') then
    raise exception 'H5 caso 6: postgres no pudo cambiar o borrar una atendida con nota';
  end if;
end $$;

-- Caso 7: la comprobación sólo responde un booleano, sólo de la clínica de quien llama, y anon no
-- puede llamarla.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a5e001');
  set local role authenticated;
  if public.cita_tiene_nota_ligada('00000000-0000-4000-8000-000000a5d001', '00000000-0000-4000-8000-000000a5c001') is not true then
    raise exception 'H5 caso 7: no vio la nota de una cita de su clínica';
  end if;
  if public.cita_tiene_nota_ligada('00000000-0000-4000-8000-000000a5d006', '00000000-0000-4000-8000-000000a5c002') is not false then
    raise exception 'H5 caso 7: respondió de una cita de OTRA clínica';
  end if;
  if public.cita_tiene_nota_ligada('00000000-0000-4000-8000-000000a5d006', '00000000-0000-4000-8000-000000a5c001') is not false then
    raise exception 'H5 caso 7: respondió de una cita de otra clínica pasando la suya';
  end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform public.cita_tiene_nota_ligada('00000000-0000-4000-8000-000000a5d001', '00000000-0000-4000-8000-000000a5c001');
    raise exception 'H5 caso 7: anon ejecutó la comprobación';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
