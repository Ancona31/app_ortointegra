-- Agenda G2b — el médico cambia y archiva SUS tipos de cita y su duración
-- (policy tipos_cita_update, 20261119121000_agenda_g2_tipos_cita_update.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- c1 (VIP, v2 encendida): administrador a1, médicos invitados b1 y b2, secretaria d1.
-- c2: su administrador a2. Consultorios: k1 de b1, k2 de b2, k3 de a1.
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000063c1', 'G2b prueba uno', true),
  ('00000000-0000-4000-8000-0000000063c2', 'G2b prueba dos', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000063a1'::uuid, 'g2b-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000063b1'::uuid, 'g2b-medico-b@prueba.local'),
               ('00000000-0000-4000-8000-0000000063b2'::uuid, 'g2b-medico-c@prueba.local'),
               ('00000000-0000-4000-8000-0000000063d1'::uuid, 'g2b-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-0000000063a2'::uuid, 'g2b-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000063c1', es_admin_de_clinica = true,
                           nombres = 'Admin', apellido_paterno = 'Prueba'
 where id = '00000000-0000-4000-8000-0000000063a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000063c1', nombres = 'Invitado', apellido_paterno = 'Prueba'
 where id in ('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063b2');
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000063c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000063d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000063c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000063a2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000063c1', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000063cc01', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063b1', 'Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-00000063cc02', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063b2', 'Dos', 'Dos', 'Calle 2', true),
  ('00000000-0000-4000-8000-00000063cc03', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063a1', 'Tres', 'Tres', 'Calle 3', true);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.esperar(p_caso text, p_valor text, p_esperado text) returns void language plpgsql as $$
begin
  if p_valor is distinct from p_esperado then
    raise exception 'G2 %: dio [%], esperaba [%]', p_caso, p_valor, p_esperado;
  end if;
end $$;

-- Un UPDATE como `quien` sobre un tipo: 'ok:<filas>' o el SQLSTATE.
create function pg_temp.cambio(p_quien uuid, p_id uuid, p_set text) returns text language plpgsql as $$
declare v_n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quien, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute format('update public.tipos_cita set %s where id = %L', p_set, p_id);
  get diagnostics v_n = row_count;
  reset role;
  return 'ok:' || v_n;
exception when others then
  reset role;
  return sqlstate;
end $$;

-- Datos: b1 tiene su duración (f1) y un tipo de más (f2); b2 su duración (f3); uno de toda la clínica (f4).
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, principal) values
  ('00000000-0000-4000-8000-0000000063f1', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063b1', 'Consulta', 45, true),
  ('00000000-0000-4000-8000-0000000063f2', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063b1', 'Primera vez', 60, false),
  ('00000000-0000-4000-8000-0000000063f3', '00000000-0000-4000-8000-0000000063c1', '00000000-0000-4000-8000-0000000063b2', 'Consulta', 30, true),
  ('00000000-0000-4000-8000-0000000063f4', '00000000-0000-4000-8000-0000000063c1', null, 'Revisión', 20, false);

-- Caso 1: el invitado cambia su duración y archiva y reactiva su tipo de más.
select pg_temp.esperar('caso 1 cambia su duración',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f1', 'duracion_min = 60'), 'ok:1');
select pg_temp.esperar('caso 1 archiva lo suyo',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f2', 'activo = false'), 'ok:1');
select pg_temp.esperar('caso 1 reactiva lo suyo',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f2', 'activo = true'), 'ok:1');
select pg_temp.esperar('caso 1 en la base',
  (select duracion_min || '|' || activo from public.tipos_cita where id = '00000000-0000-4000-8000-0000000063f1'), '60|true');

-- Caso 2: no edita ni archiva lo de otro médico ni lo de toda la clínica (0 filas: la USING no lo deja).
select pg_temp.esperar('caso 2 lo de otro médico',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f3', 'activo = false'), 'ok:0');
select pg_temp.esperar('caso 2 lo de toda la clínica',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f4', 'duracion_min = 5'), 'ok:0');

-- Caso 3: no reasigna: ni a toda la clínica (NULL), ni a otra clínica, ni a otro médico.
select pg_temp.esperar('caso 3 a toda la clínica',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f2', 'medico_id = null'), '42501');
select pg_temp.esperar('caso 3 a otra clínica (no entra)',
  (pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f2',
                  $s$clinica_id = '00000000-0000-4000-8000-0000000063c2'$s$) in ('42501', '23514'))::text, 'true');
-- A otro médico: el disparador de B6 lo para antes si no ve su perfil (23514); si lo viera, la WITH CHECK (42501).
select pg_temp.esperar('caso 3 a otro médico (no entra)',
  (pg_temp.cambio('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063f2',
                  $s$medico_id = '00000000-0000-4000-8000-0000000063b2'$s$) in ('42501', '23514'))::text, 'true');
select pg_temp.esperar('caso 3 sigue siendo suyo',
  (select medico_id::text || '|' || clinica_id::text from public.tipos_cita where id = '00000000-0000-4000-8000-0000000063f2'),
  '00000000-0000-4000-8000-0000000063b1|00000000-0000-4000-8000-0000000063c1');

-- Caso 4: el administrador, como hoy: todo lo de su clínica; el de otra clínica, nada.
select pg_temp.esperar('caso 4 admin, tipo de b2',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063a1', '00000000-0000-4000-8000-0000000063f3', 'duracion_min = 40'), 'ok:1');
select pg_temp.esperar('caso 4 admin, de toda la clínica',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063a1', '00000000-0000-4000-8000-0000000063f4', 'activo = false'), 'ok:1');
select pg_temp.esperar('caso 4 admin de otra clínica, nada',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063a2', '00000000-0000-4000-8000-0000000063f4', 'activo = true'), 'ok:0');

-- Caso 5: la secretaria, como hoy: nada.
select pg_temp.esperar('caso 5 secretaria',
  pg_temp.cambio('00000000-0000-4000-8000-0000000063d1', '00000000-0000-4000-8000-0000000063f1', 'duracion_min = 5'), 'ok:0');

-- Caso 6: sigue sin haber DELETE para la sesión (se archiva).
select pg_temp.esperar('caso 6 sin DELETE',
  (select count(*)::text from pg_policy where polrelid = 'public.tipos_cita'::regclass and polcmd in ('d', '*'))
  || '|' || has_table_privilege('authenticated', 'public.tipos_cita', 'DELETE')::text, '0|false');

rollback;
