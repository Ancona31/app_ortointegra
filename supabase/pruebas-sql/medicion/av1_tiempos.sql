-- Avisos globales · M1 — medición del costo del disparador nuevo en appointments.
-- NO es una prueba (no vive en supabase/pruebas-sql/*.sql: scripts/pruebas-sql.sh no la corre).
-- Se corre A MANO, antes y después de aplicar M1, contra la base LOCAL con la semilla:
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -f - < supabase/pruebas-sql/medicion/av1_tiempos.sql
-- Mide, con la sesión de la SECRETARIA de la Clínica Semilla A (el caso que SÍ escribe aviso con M1)
-- y con la del MÉDICO dueño (el caso que no lo escribe), N altas, N cambios de hora y N cancelaciones
-- sobre la agenda del administrador, con la v2 encendida. Todo dentro de una transacción que termina
-- en ROLLBACK: no deja nada. Devuelve UNA rejilla: ms por operación.
begin;
set local lock_timeout = '5s';
create temp table _t (quien text, operacion text, n int, ms_por_op numeric) on commit drop;
grant all on _t to authenticated;

insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida)
select id, true from public.clinicas where nombre = 'Clínica Semilla A'
on conflict (clinica_id) do update set agenda_v2_encendida = true;

create function pg_temp.medir(p_quien text, p_correo text, p_n int) returns void language plpgsql as $$
declare
  v_uid uuid := (select id from auth.users where email = p_correo);
  v_cl  uuid := (select id from public.clinicas where nombre = 'Clínica Semilla A');
  v_med uuid := (select id from auth.users where email = 'admin.a@semilla.spinus.test');
  v_co  record;
  v_pac uuid;
  v_ids uuid[] := '{}';
  v_id  uuid;
  v_t0  timestamptz;
  i int;
begin
  select k.id, k.nombre, k.timezone into v_co from public.consultorios k where k.clinica_id = v_cl and k.medico_id = v_med order by k.nombre limit 1;
  select p.id into v_pac from public.pacientes p where p.clinica_id = v_cl order by p.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_t0 := clock_timestamp();
  for i in 1..p_n loop
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time,
                                     status, all_day, consultorio_nombre, consultorio_timezone, origen, client_id)
    values (v_cl, v_pac, v_med, v_co.id, 'Medición', timestamptz '2031-01-06 15:00+00' + (i || ' hours')::interval,
            timestamptz '2031-01-06 15:30+00' + (i || ' hours')::interval, 'scheduled', false, v_co.nombre, v_co.timezone,
            'spinus', gen_random_uuid())
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  insert into _t values (p_quien, '1 alta', p_n, round((extract(epoch from clock_timestamp() - v_t0) * 1000 / p_n)::numeric, 3));
  v_t0 := clock_timestamp();
  foreach v_id in array v_ids loop
    update public.appointments set start_time = start_time + interval '10 minutes', end_time = end_time + interval '10 minutes' where id = v_id;
  end loop;
  insert into _t values (p_quien, '2 mover', p_n, round((extract(epoch from clock_timestamp() - v_t0) * 1000 / p_n)::numeric, 3));
  v_t0 := clock_timestamp();
  foreach v_id in array v_ids loop
    update public.appointments set status = 'cancelled' where id = v_id;
  end loop;
  insert into _t values (p_quien, '3 cancelar', p_n, round((extract(epoch from clock_timestamp() - v_t0) * 1000 / p_n)::numeric, 3));
  reset role;
end $$;

-- Una pasada de calentamiento (planes y cachés) que no se apunta, y la que cuenta.
select pg_temp.medir('calentamiento', 'secretaria.a@semilla.spinus.test', 50);
delete from _t;
select pg_temp.medir('secretaria (con M1: escribe aviso)', 'secretaria.a@semilla.spinus.test', 300);
select pg_temp.medir('médico dueño (con M1: no escribe aviso)', 'admin.a@semilla.spinus.test', 300);

select quien, operacion, n, ms_por_op,
       (select count(*) from public.avisos_clinica a where a.creado_en >= transaction_timestamp()) as avisos_escritos_en_total
  from _t order by quien, operacion;
rollback;
