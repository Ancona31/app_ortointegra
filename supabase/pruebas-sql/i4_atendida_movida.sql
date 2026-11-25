-- Tanda I, punto 1 (20261121140000_agenda_i4_atendida_no_se_mueve.sql): una cita ATENDIDA con nota
-- clínica tampoco se MUEVE (fecha, hora o todo el día) con la agenda v2 APAGADA, ni con la sesión
-- (PostgREST directo) ni como service_role. Sin nota, se mueve como siempre; reescribir los mismos
-- valores pasa; postgres queda fuera. Con la v2 encendida, como en H5.
-- Mutación comprobada en rojo: volver al cuerpo de 20261120130000 (mover sólo se cerraba con la v2)
-- → «caso 1: … movió una atendida con nota con la v2 apagada».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-000000a4c001', 'I4 apagada'),
  ('00000000-0000-4000-8000-000000a4c002', 'I4 encendida');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000a4a001'::uuid, 'i4m-admin1@prueba.local'),
               ('00000000-0000-4000-8000-000000a4e001'::uuid, 'i4m-secre1@prueba.local'),
               ('00000000-0000-4000-8000-000000a4a002'::uuid, 'i4m-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a4c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a4a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a4c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000a4e001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a4c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a4a002';
-- c001 APAGADA (con fila en false) y c002 encendida. Una clínica sin fila también cuenta como apagada (caso 1b).
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000a4c001', false),
  ('00000000-0000-4000-8000-000000a4c002', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000a4f001', '00000000-0000-4000-8000-000000a4c001', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000a4f002', '00000000-0000-4000-8000-000000a4c002', 'Paciente', 'Dos');

-- d1, d2: atendidas CON nota en la apagada; d3: atendida SIN nota en la apagada; d4: con nota en la encendida.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status)
select x.id::uuid, x.cl::uuid, x.med::uuid, x.pac::uuid, 'I4', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 'attended'
  from (values
    ('00000000-0000-4000-8000-000000a4d001', '00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001', '00000000-0000-4000-8000-000000a4f001'),
    ('00000000-0000-4000-8000-000000a4d002', '00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001', '00000000-0000-4000-8000-000000a4f001'),
    ('00000000-0000-4000-8000-000000a4d003', '00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001', '00000000-0000-4000-8000-000000a4f001'),
    ('00000000-0000-4000-8000-000000a4d004', '00000000-0000-4000-8000-000000a4c002', '00000000-0000-4000-8000-000000a4a002', '00000000-0000-4000-8000-000000a4f002')
  ) x(id, cl, med, pac);
insert into public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
select p, m, 'NOTA DE PRUEBA I4', 'manual', a
  from (values
    ('00000000-0000-4000-8000-000000a4f001'::uuid, '00000000-0000-4000-8000-000000a4a001'::uuid, '00000000-0000-4000-8000-000000a4d001'::uuid),
    ('00000000-0000-4000-8000-000000a4f001', '00000000-0000-4000-8000-000000a4a001', '00000000-0000-4000-8000-000000a4d002'),
    ('00000000-0000-4000-8000-000000a4f002', '00000000-0000-4000-8000-000000a4a002', '00000000-0000-4000-8000-000000a4d004')
  ) n(p, m, a);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: v2 APAGADA. Administrador y secretaria, con su sesión, no mueven una atendida con nota:
-- ni el inicio con el fin, ni sólo el fin, ni pasándola a todo el día (42501). Sí reescriben los
-- mismos valores y editan sus notas de agenda (lo que hace el formulario).
do $$
declare v_quien uuid;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-000000a4a001', '00000000-0000-4000-8000-000000a4e001']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
       where id = '00000000-0000-4000-8000-000000a4d001';
      raise exception 'I4 caso 1: % movió una atendida con nota con la v2 apagada', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set end_time = end_time + interval '15 minutes' where id = '00000000-0000-4000-8000-000000a4d001';
      raise exception 'I4 caso 1: % alargó una atendida con nota con la v2 apagada', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set all_day = true where id = '00000000-0000-4000-8000-000000a4d001';
      raise exception 'I4 caso 1: % pasó a todo el día una atendida con nota con la v2 apagada', v_quien;
    exception when insufficient_privilege then null;
    end;
    update public.appointments set notes = 'agenda ' || v_quien, status = 'attended', start_time = start_time, end_time = end_time
     where id = '00000000-0000-4000-8000-000000a4d001';
    reset role;
  end loop;
  if (select start_time from public.appointments where id = '00000000-0000-4000-8000-000000a4d001') > now() - interval '2 days' + interval '1 minute'
     or (select notes from public.appointments where id = '00000000-0000-4000-8000-000000a4d001') <> 'agenda 00000000-0000-4000-8000-000000a4e001' then
    raise exception 'I4 caso 1: la atendida con nota se movió, o no se guardaron sus notas de agenda';
  end if;
end $$;

-- Caso 1b: sin fila de agenda_ajustes (producción hoy: tabla sin fila) también se cierra.
do $$
begin
  delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-000000a4c001';
  perform pg_temp.como('00000000-0000-4000-8000-000000a4a001');
  set local role authenticated;
  begin
    update public.appointments set start_time = start_time - interval '1 day', end_time = end_time - interval '1 day'
     where id = '00000000-0000-4000-8000-000000a4d002';
    raise exception 'I4 caso 1b: sin fila de ajustes, la sesión movió una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  reset role;
  insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-000000a4c001', false);
end $$;

-- Caso 2: service_role tampoco, con la v2 apagada.
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    update public.appointments set start_time = start_time + interval '1 day', end_time = end_time + interval '1 day'
     where id = '00000000-0000-4000-8000-000000a4d002';
    raise exception 'I4 caso 2: service_role movió una atendida con nota con la v2 apagada';
  exception when insufficient_privilege then null;
  end;
  -- Lo que el servidor sí escribe sobre una atendida: Google y los mismos valores.
  update public.appointments set gcal_sync_status = 'synced', status = 'attended', start_time = start_time
   where id = '00000000-0000-4000-8000-000000a4d002';
  reset role;
end $$;

-- Caso 3: sin nota, con la v2 apagada, se mueve como siempre (sesión y service_role).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a4e001');
  set local role authenticated;
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = '00000000-0000-4000-8000-000000a4d003';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  update public.appointments set end_time = end_time + interval '15 minutes' where id = '00000000-0000-4000-8000-000000a4d003';
  reset role;
  if (select end_time - start_time from public.appointments where id = '00000000-0000-4000-8000-000000a4d003') <> interval '45 minutes'
     or (select start_time from public.appointments where id = '00000000-0000-4000-8000-000000a4d003') < now() - interval '2 days' + interval '59 minutes' then
    raise exception 'I4 caso 3: una atendida SIN nota no se movió con la v2 apagada';
  end if;
end $$;

-- Caso 4: con la v2 encendida, sigue cerrado (lo de H5).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a4a002');
  set local role authenticated;
  begin
    update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
     where id = '00000000-0000-4000-8000-000000a4d004';
    raise exception 'I4 caso 4: con la v2 encendida la sesión movió una atendida con nota';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 5: postgres (editor SQL, ayudantes de las e2e) sí la mueve.
update public.appointments set start_time = start_time + interval '1 day', end_time = end_time + interval '1 day'
 where id = '00000000-0000-4000-8000-000000a4d001';
do $$
begin
  if (select start_time from public.appointments where id = '00000000-0000-4000-8000-000000a4d001') < now() - interval '1 day' - interval '1 minute' then
    raise exception 'I4 caso 5: postgres no pudo mover una atendida con nota';
  end if;
end $$;

rollback;
