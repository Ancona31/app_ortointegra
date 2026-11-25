-- Avisos globales · M1 — medición de la LECTURA de la campana (avisos_pendientes) con muchos avisos.
-- NO es una prueba (scripts/pruebas-sql.sh no la corre). Se corre A MANO contra la base LOCAL:
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -v n=1200 -f - < supabase/pruebas-sql/medicion/av1_campana.sql
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -v n=21000 -f - < supabase/pruebas-sql/medicion/av1_campana.sql
--   (añade -v vieja=1 para medir la lectura SIN acotar, la de antes, con los mismos datos)
-- Crea una clínica con un administrador, un médico invitado y :n avisos SIN CERRAR (uno por cita;
-- las citas, repartidas a medias entre los dos médicos), en dos repartos:
--   «en 2 años»  los avisos nacieron a ritmo constante durante 730 días (lo que pasa de verdad:
--                el código nuevo no cierra avisos y se acumulan);
--   «en 60 días» el peor caso: TODOS dentro de la ventana de la lectura.
-- y mide la llamada que hace la campana (los 19 tipos, límite 50), mediana de 15, para:
--   · el administrador que no ha visto nada, · el administrador que ya lo vio TODO,
--   · el médico invitado (la RLS le oculta la mitad) sin ver nada y con todo visto.
-- Todo en una transacción que termina en ROLLBACK: no deja nada. Devuelve UNA rejilla.
\if :{?n}
\else
\set n 1200
\endif
begin;
set local lock_timeout = '5s';
create temp table _m (reparto text, quien text, avisos int, filas int, ms_mediana numeric) on commit drop;
grant all on _m to authenticated;

insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000004a0c01', 'Medición campana', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-0000004a0b0' || k)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'medicion-campana-' || k || '@prueba.local', now(), now() from generate_series(1, 2) k;
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000004a0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01'),
                           nombres = 'Médico', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id::text ~ '4a0b0[12]$';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000004a0c01', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000004a0f01', '00000000-0000-4000-8000-0000004a0c01', 'Paciente', 'Medición');

-- :n citas (pasadas, para no chocar con ninguna regla de la agenda), mitad de cada médico. Como postgres.
create temp table _citas on commit drop as
select gen_random_uuid() as id, g as k, ('00000000-0000-4000-8000-0000004a0b0' || (1 + g % 2))::uuid as medico
  from generate_series(1, :n) g;
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
select c.id, '00000000-0000-4000-8000-0000004a0c01', '00000000-0000-4000-8000-0000004a0f01', c.medico, 'Medición',
       timestamptz '2020-01-01 00:00+00' + make_interval(mins => 30 * c.k), timestamptz '2020-01-01 00:30+00' + make_interval(mins => 30 * c.k), 'scheduled'
  from _citas c;
-- Estadísticas al día, como las deja autovacuum en una base viva (sin esto el planificador cree que
-- la clínica no tiene citas y mide un plan que en producción no se daría).
analyze public.appointments;
-- Las citas pudieron dejar avisos propios: fuera de la cuenta (se van con el rollback).
create temp table _antes on commit drop as select id from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000004a0c01';

create function pg_temp.medir(p_reparto text, p_quien text, p_uid uuid) returns void language plpgsql as $$
declare
  v_ms numeric[] := '{}';
  v_t0 timestamptz;
  v_n  int;
  i int;
  c_tipos constant text[] := array['reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
    'google_movimiento_rechazado', 'confirmacion_paciente', 'google_movio_cita', 'google_cancelo_cita', 'correo_fallido', 'personal_agendo',
    'personal_movio', 'personal_cancelo', 'paciente_no_asistira', 'reserva_frenada', 'google_desconectado', 'google_sin_sincronizar',
    'personal_bloqueo', 'personal_desbloqueo'];
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..18 loop
    v_t0 := clock_timestamp();
    select count(*) into v_n from public.avisos_pendientes(c_tipos, 50);
    if i > 3 then v_ms := v_ms || round((extract(epoch from clock_timestamp() - v_t0) * 1000)::numeric, 3); end if;  -- 3 de calentamiento
  end loop;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into _m values (p_reparto, p_quien, (select count(*) from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000004a0c01'),
                         v_n, (select percentile_cont(0.5) within group (order by x) from unnest(v_ms) x));
end $$;
create function pg_temp.ver_todo(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
  select a.id, p_uid, a.clinica_id from public.avisos_clinica a where a.clinica_id = '00000000-0000-4000-8000-0000004a0c01'
  on conflict (aviso_id, usuario_id) do nothing;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.ronda(p_reparto text, p_dias int) returns void language plpgsql as $$
begin
  delete from public.avisos_vistos where clinica_id = '00000000-0000-4000-8000-0000004a0c01';
  delete from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000004a0c01';
  insert into public.avisos_clinica (clinica_id, tipo, cita_id, creado_en)
  select '00000000-0000-4000-8000-0000004a0c01', 'confirmacion_paciente', c.id,
         now() - make_interval(secs => (p_dias * 86400.0 * c.k / (select count(*) from _citas))::int)
    from _citas c;
  analyze public.avisos_clinica;
  perform pg_temp.medir(p_reparto, '1 administrador, nada visto', '00000000-0000-4000-8000-0000004a0b01');
  perform pg_temp.medir(p_reparto, '3 médico invitado, nada visto', '00000000-0000-4000-8000-0000004a0b02');
  perform pg_temp.ver_todo('00000000-0000-4000-8000-0000004a0b01');
  perform pg_temp.ver_todo('00000000-0000-4000-8000-0000004a0b02');
  analyze public.avisos_vistos;
  perform pg_temp.medir(p_reparto, '2 administrador, TODO visto', '00000000-0000-4000-8000-0000004a0b01');
  perform pg_temp.medir(p_reparto, '4 médico invitado, TODO visto', '00000000-0000-4000-8000-0000004a0b02');
end $$;

-- Con -v vieja=1 mide la lectura SIN ACOTAR (la de antes de la auditoría), para comparar. Sólo en esta transacción.
\if :{?vieja}
create or replace function public.avisos_pendientes(p_tipos text[], p_limite integer)
 returns setof public.avisos_clinica language sql stable set search_path to '' as $f$
  select a.* from public.avisos_clinica a
   where a.clinica_id = public.get_clinica_id() and a.revisado_en is null and a.tipo = any (coalesce(p_tipos, array[]::text[]))
     and not exists (select 1 from public.avisos_vistos v where v.aviso_id = a.id and v.usuario_id = auth.uid() and v.visto_en >= a.creado_en)
   order by a.creado_en desc limit least(greatest(coalesce(p_limite, 50), 1), 200)
$f$;
\endif

select pg_temp.ronda('a) repartidos en 2 años', 730);
select pg_temp.ronda('b) todos en 60 días (peor caso)', 59);

select reparto, quien, avisos, filas as filas_devueltas, ms_mediana from _m order by reparto, quien;
rollback;
