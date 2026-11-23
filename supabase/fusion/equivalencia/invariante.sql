-- E0 (segunda vuelta) · invariante de la fusión: tras CADA archivo fundido, aplicado en orden
-- (F1, F5a, F3, F2, F4, F5b), se puede crear, editar, mover y cancelar una cita. Sin ventana rota
-- entre archivos. Vale también sobre la base sin ningún archivo (sin agenda_ajustes).
-- Datos inventados, ids fijos; una transacción que termina en ROLLBACK (audit_log no se toca: lo que
-- escriben los disparadores dentro de la transacción nunca se confirma).
-- Uso: docker exec -i CONTENEDOR psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At -f - < invariante.sql
-- Salida: una fila por paso «paso|rol|resultado|sqlstate|mensaje»; todo debe ser «filas=1|ok».
begin;
set local client_min_messages = warning;

insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000f0c01', 'Inv encendida', true),
  ('00000000-0000-4000-8000-0000000f0c02', 'Inv apagada', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000f0b01'::uuid, 'inv-m1@prueba.local'),
               ('00000000-0000-4000-8000-0000000f0b05'::uuid, 'inv-s1@prueba.local'),
               ('00000000-0000-4000-8000-0000000f0b02'::uuid, 'inv-m2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000f0c01', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Uno', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000f0b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000f0c01', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000f0b05';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000f0c02', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Dos', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000f0b02';
do $$
begin
  if to_regclass('public.agenda_ajustes') is not null then
    insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
      ('00000000-0000-4000-8000-0000000f0c01', true),
      ('00000000-0000-4000-8000-0000000f0c02', false);
  end if;
end $$;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-0000000f0d01', '00000000-0000-4000-8000-0000000f0c01', '00000000-0000-4000-8000-0000000f0b01', 'Consultorio Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-0000000f0d02', '00000000-0000-4000-8000-0000000f0c02', '00000000-0000-4000-8000-0000000f0b02', 'Consultorio Dos', 'Dos', 'Calle 2', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000f0f01', '00000000-0000-4000-8000-0000000f0c01', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-0000000f0f02', '00000000-0000-4000-8000-0000000f0c02', 'Paciente', 'Dos');

-- Hoy (UTC, truncado al día) + 3 días + horas: siempre en el futuro.
create function pg_temp.d(p_horas numeric) returns timestamptz language sql as $$
  select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '3 days' + make_interval(secs => p_horas * 3600);
$$;
grant execute on function pg_temp.d(numeric) to authenticated, service_role;

create temp table _r (n serial, paso text, rol text, resultado text, estado text, mensaje text);
grant insert, select on _r to authenticated, service_role;

create function pg_temp.paso(p_paso text, p_rol text, p_sub uuid, p_sql text) returns void language plpgsql as $f$
declare v_n bigint; v text; v_st text := 'ok'; v_msg text;
begin
  begin
    perform set_config('request.jwt.claims',
      (case when p_sub is null then json_build_object('role', p_rol) else json_build_object('sub', p_sub, 'role', p_rol) end)::text, true);
    execute format('set local role %I', p_rol);
    execute p_sql;
    get diagnostics v_n = row_count;
    v := 'filas=' || v_n;
    reset role;
  exception when others then
    get stacked diagnostics v_st = returned_sqlstate, v_msg = message_text;
    reset role;
  end;
  perform set_config('request.jwt.claims', '', true);
  insert into _r (paso, rol, resultado, estado, mensaje) values (p_paso, p_rol, v, v_st, v_msg);
end $f$;

-- Un ciclo completo (crear, editar, mover, cancelar) por rol y clínica; con y sin paciente.
create function pg_temp.ciclo(p_etq text, p_rol text, p_sub uuid, p_cli uuid, p_med uuid, p_cons uuid, p_pac uuid, p_id uuid, p_h numeric)
returns void language plpgsql as $f$
begin
  perform pg_temp.paso(p_etq || ' crear', p_rol, p_sub, format(
    'insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time, created_by)
     values (%L, %L, %L, %L, %L, %L, %L, pg_temp.d(%s), pg_temp.d(%s), %L)',
    p_id, p_cli, p_pac, p_med, p_cons, 'Consultorio', 'Inv', p_h, p_h + 0.5, coalesce(p_sub, p_med)));
  perform pg_temp.paso(p_etq || ' editar', p_rol, p_sub, format(
    'update public.appointments set notes = %L, title = %L where id = %L', 'nota inv', 'Inv editada', p_id));
  perform pg_temp.paso(p_etq || ' mover', p_rol, p_sub, format(
    'update public.appointments set start_time = pg_temp.d(%s), end_time = pg_temp.d(%s) where id = %L', p_h + 1, p_h + 1.5, p_id));
  perform pg_temp.paso(p_etq || ' cancelar', p_rol, p_sub, format(
    'update public.appointments set status = %L where id = %L', 'cancelled', p_id));
end $f$;

select pg_temp.ciclo('v2 on · médico · con paciente', 'authenticated', '00000000-0000-4000-8000-0000000f0b01',
  '00000000-0000-4000-8000-0000000f0c01', '00000000-0000-4000-8000-0000000f0b01', '00000000-0000-4000-8000-0000000f0d01',
  '00000000-0000-4000-8000-0000000f0f01', '00000000-0000-4000-8000-0000000f0e01', 9);
select pg_temp.ciclo('v2 on · médico · sin paciente', 'authenticated', '00000000-0000-4000-8000-0000000f0b01',
  '00000000-0000-4000-8000-0000000f0c01', '00000000-0000-4000-8000-0000000f0b01', '00000000-0000-4000-8000-0000000f0d01',
  null, '00000000-0000-4000-8000-0000000f0e02', 12);
select pg_temp.ciclo('v2 on · secretaria · con paciente', 'authenticated', '00000000-0000-4000-8000-0000000f0b05',
  '00000000-0000-4000-8000-0000000f0c01', '00000000-0000-4000-8000-0000000f0b01', '00000000-0000-4000-8000-0000000f0d01',
  '00000000-0000-4000-8000-0000000f0f01', '00000000-0000-4000-8000-0000000f0e03', 15);
select pg_temp.ciclo('v2 on · service_role · con paciente', 'service_role', null,
  '00000000-0000-4000-8000-0000000f0c01', '00000000-0000-4000-8000-0000000f0b01', '00000000-0000-4000-8000-0000000f0d01',
  '00000000-0000-4000-8000-0000000f0f01', '00000000-0000-4000-8000-0000000f0e04', 18);
select pg_temp.ciclo('v2 off · médico · con paciente', 'authenticated', '00000000-0000-4000-8000-0000000f0b02',
  '00000000-0000-4000-8000-0000000f0c02', '00000000-0000-4000-8000-0000000f0b02', '00000000-0000-4000-8000-0000000f0d02',
  '00000000-0000-4000-8000-0000000f0f02', '00000000-0000-4000-8000-0000000f0e21', 9);
select pg_temp.ciclo('v2 off · service_role · con paciente', 'service_role', null,
  '00000000-0000-4000-8000-0000000f0c02', '00000000-0000-4000-8000-0000000f0b02', '00000000-0000-4000-8000-0000000f0d02',
  '00000000-0000-4000-8000-0000000f0f02', '00000000-0000-4000-8000-0000000f0e22', 12);

select format('%s|%s|%s|%s|%s', paso, rol, resultado, estado, coalesce(mensaje, '')) from _r order by n;
select format('RESUMEN pasos=%s fallidos=%s', count(*), count(*) filter (where resultado is distinct from 'filas=1' or estado <> 'ok')) from _r;
rollback;
