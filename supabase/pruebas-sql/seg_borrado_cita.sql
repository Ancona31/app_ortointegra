-- Corrección de seguridad, punto 3 (20261117120000_agenda_seg_borrado_cita.sql): con la agenda
-- v2 encendida, la base no deja borrar una cita con paciente o por ligar, ni a la sesión
-- (PostgREST directo, sin la API) ni a service_role; sí una sin paciente. Con v2 apagada o sin
-- fila de ajustes, todo se borra como antes. postgres queda fuera (editor SQL, CASCADE).
-- Mutación comprobada en rojo: quitar el RAISE de cita_proteger_borrado() → «caso 1: la sesión
-- borró una cita con paciente».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-000000a3c001', 'Seg3 encendida'),
  ('00000000-0000-4000-8000-000000a3c002', 'Seg3 apagada'),
  ('00000000-0000-4000-8000-000000a3c003', 'Seg3 sin ajustes');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000a3a001'::uuid, 'seg3-admin1@prueba.local'),
               ('00000000-0000-4000-8000-000000a3e001'::uuid, 'seg3-secre1@prueba.local'),
               ('00000000-0000-4000-8000-000000a3a002'::uuid, 'seg3-admin2@prueba.local'),
               ('00000000-0000-4000-8000-000000a3a003'::uuid, 'seg3-admin3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a3c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a3a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a3c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000a3e001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a3c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a3a002';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a3c003', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a3a003';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000a3c001', true),
  ('00000000-0000-4000-8000-000000a3c002', false);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000a3f001', '00000000-0000-4000-8000-000000a3c001', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000a3f002', '00000000-0000-4000-8000-000000a3c002', 'Paciente', 'Dos'),
  ('00000000-0000-4000-8000-000000a3f003', '00000000-0000-4000-8000-000000a3c003', 'Paciente', 'Tres');
insert into public.reserva_avisos (version, texto_sha256) values ('seg3-aviso', repeat('a', 64));
-- reserva_enlaces: como postgres (la protección lo deja; sólo hace falta para la FK de la cita).
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000a3b001', '00000000-0000-4000-8000-000000a3c001',
   '00000000-0000-4000-8000-000000a3a001', 'fijo', repeat('b', 64));

-- Citas (como postgres): en la 1, con paciente (d1), por ligar (d2), sin paciente (d3) y otra
-- con paciente (d4, para service_role); en la 2 (v2 apagada) y en la 3 (sin ajustes), con paciente.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time) values
  ('00000000-0000-4000-8000-000000a3d001', '00000000-0000-4000-8000-000000a3c001', '00000000-0000-4000-8000-000000a3a001',
   '00000000-0000-4000-8000-000000a3f001', 'Con paciente', now() + interval '1 day', now() + interval '1 day 30 minutes'),
  ('00000000-0000-4000-8000-000000a3d003', '00000000-0000-4000-8000-000000a3c001', '00000000-0000-4000-8000-000000a3a001',
   null, 'Evento', now() + interval '1 day', now() + interval '1 day 30 minutes'),
  ('00000000-0000-4000-8000-000000a3d004', '00000000-0000-4000-8000-000000a3c001', '00000000-0000-4000-8000-000000a3a001',
   '00000000-0000-4000-8000-000000a3f001', 'Con paciente 2', now() + interval '2 days', now() + interval '2 days 30 minutes'),
  ('00000000-0000-4000-8000-000000a3d005', '00000000-0000-4000-8000-000000a3c002', '00000000-0000-4000-8000-000000a3a002',
   '00000000-0000-4000-8000-000000a3f002', 'Apagada', now() + interval '1 day', now() + interval '1 day 30 minutes'),
  ('00000000-0000-4000-8000-000000a3d006', '00000000-0000-4000-8000-000000a3c003', '00000000-0000-4000-8000-000000a3a003',
   '00000000-0000-4000-8000-000000a3f003', 'Sin ajustes', now() + interval '1 day', now() + interval '1 day 30 minutes');
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
  reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
values ('00000000-0000-4000-8000-000000a3d002', '00000000-0000-4000-8000-000000a3c001', '00000000-0000-4000-8000-000000a3a001',
        'Por ligar', now() + interval '3 days', now() + interval '3 days 30 minutes', '00000000-0000-4000-8000-000000a3b001',
        'fijo', 'Ana Reserva', repeat('c', 64), repeat('d', 64), 'seg3-aviso', now(), 0);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: v2 encendida. Administrador y secretaria, con su sesión, no borran la cita con
-- paciente ni la por ligar (42501); sí el evento sin paciente.
do $$
declare v_quien uuid;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-000000a3a001', '00000000-0000-4000-8000-000000a3e001']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d001';
      raise exception 'Seg3 caso 1: la sesión borró una cita con paciente (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d002';
      raise exception 'Seg3 caso 1: la sesión borró una cita por ligar (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  perform pg_temp.como('00000000-0000-4000-8000-000000a3a001');
  set local role authenticated;
  delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d003';
  reset role;
  if (select count(*) from public.appointments where id in ('00000000-0000-4000-8000-000000a3d001',
        '00000000-0000-4000-8000-000000a3d002')) <> 2
     or exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-000000a3d003') then
    raise exception 'Seg3 caso 1: no quedaron la cita con paciente y la por ligar, o no se borró el evento';
  end if;
end $$;

-- Caso 2: service_role tampoco (ningún camino del servidor borra una cita con paciente con v2).
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d004';
    raise exception 'Seg3 caso 2: service_role borró una cita con paciente con v2 encendida';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.appointments where clinica_id = '00000000-0000-4000-8000-000000a3c001';
    raise exception 'Seg3 caso 2: un borrado masivo de service_role pasó';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 3: v2 apagada, y clínica sin fila de ajustes: la sesión borra la cita con paciente como hoy.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a3a002');
  set local role authenticated;
  delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d005';
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-000000a3a003');
  set local role authenticated;
  delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d006';
  reset role;
  if exists (select 1 from public.appointments where id in ('00000000-0000-4000-8000-000000a3d005',
               '00000000-0000-4000-8000-000000a3d006')) then
    raise exception 'Seg3 caso 3: con v2 apagada o sin ajustes no se borró una cita con paciente';
  end if;
end $$;

-- Caso 4: al apagar v2, la sesión vuelve a poder (el disparador lee el interruptor en cada baja).
update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-000000a3c001';
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a3a001');
  set local role authenticated;
  delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d004';
  reset role;
  if exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-000000a3d004') then
    raise exception 'Seg3 caso 4: apagada v2, la cita con paciente no se borró';
  end if;
end $$;
update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-000000a3c001';

-- Caso 5: postgres (editor SQL, ayudantes de las e2e) sí borra con v2 encendida.
delete from public.appointments where id = '00000000-0000-4000-8000-000000a3d001';
do $$
begin
  if exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-000000a3d001') then
    raise exception 'Seg3 caso 5: postgres no borró';
  end if;
end $$;

rollback;
