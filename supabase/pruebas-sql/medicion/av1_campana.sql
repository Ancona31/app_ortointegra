-- Avisos globales · M1 — medición de la LECTURA de la campana (avisos_pendientes y avisos_mas_antiguos,
-- las dos que la campana pide en cada relectura) con muchos avisos.
-- NO es una prueba (scripts/pruebas-sql.sh no la corre). Se corre A MANO contra la base LOCAL:
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -v n=1200  -f - < supabase/pruebas-sql/medicion/av1_campana.sql
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -v n=6000  -f - < supabase/pruebas-sql/medicion/av1_campana.sql
--   docker exec -i supabase_db_app_ortointegra psql -U postgres -q -v n=21000 -f - < supabase/pruebas-sql/medicion/av1_campana.sql
--   -v franja=1   además, OTROS :n avisos de hace 60 a 120 días (sin ver), como los del auditor
--   -v version2=1 con las funciones de la versión 2 (7cac5d49), para comparar con los mismos datos
-- Una clínica con :n citas y un aviso sin cerrar por cita, repartidos en los últimos 59 días (el peor
-- caso: todos dentro de la ventana). Tres médicos: el administrador (b1); un invitado con la MITAD de
-- las citas (b2); un invitado con el 1 % («casi no ve nada», b3). Para cada uno, mediana de 15 de las
-- dos lecturas (19 tipos, límite 51, como la campana): sin nada visto; con TODO visto una a una
-- (lo peor); y tras «Marcar todos». Todo en una transacción con ROLLBACK. Devuelve UNA rejilla.
\if :{?n}
\else
\set n 1200
\endif
\if :{?franja}
\else
\set franja 0
\endif
begin;
set local lock_timeout = '5s';
create temp table _m (quien text, avisos int, franja int, filas int, ms_pendientes numeric, ms_mas_antiguos numeric) on commit drop;
grant all on _m to authenticated;

insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000004a0c01', 'Medición campana', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-0000004a0b0' || k)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'medicion-campana-' || k || '@prueba.local', now(), now() from generate_series(1, 3) k;
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000004a0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01'),
                           nombres = 'Médico', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id::text ~ '4a0b0[123]$';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000004a0c01', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000004a0f01', '00000000-0000-4000-8000-0000004a0c01', 'Paciente', 'Medición');

-- :n citas (más :n si hay franja), pasadas para no chocar con ninguna regla de la agenda. Como postgres.
-- Reparto: 1 de cada 100 a b3; del resto, mitad b1 y mitad b2.
create temp table _citas on commit drop as
select gen_random_uuid() as id, g as k,
       ('00000000-0000-4000-8000-0000004a0b0' || case when g % 100 = 0 then 3 else 1 + g % 2 end)::uuid as medico
  from generate_series(1, :n * (1 + :franja)) g;
create temp table _cfg on commit drop as select :franja::int as franja;
grant select on _cfg to authenticated;
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
select c.id, '00000000-0000-4000-8000-0000004a0c01', '00000000-0000-4000-8000-0000004a0f01', c.medico, 'Medición',
       timestamptz '2020-01-01 00:00+00' + make_interval(mins => 30 * c.k), timestamptz '2020-01-01 00:30+00' + make_interval(mins => 30 * c.k), 'scheduled'
  from _citas c;
-- Estadísticas al día, como las deja autovacuum en una base viva.
analyze public.appointments;
delete from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000004a0c01';
-- Los avisos, como los deja M1 (con la copia del médico de la cita): :n en los últimos 59 días y, con
-- franja, otros :n de hace 61 a 119 días.
insert into public.avisos_clinica (clinica_id, tipo, cita_id, medico_id, creado_en)
select '00000000-0000-4000-8000-0000004a0c01', 'confirmacion_paciente', c.id, c.medico,
       case when c.k <= :n then now() - make_interval(secs => (59 * 86400.0 * c.k / :n)::int)
            else now() - interval '61 days' - make_interval(secs => (58 * 86400.0 * (c.k - :n) / :n)::int) end
  from _citas c;
analyze public.avisos_clinica;

\if :{?version2}
-- Las dos funciones como en la versión 2 (7cac5d49): una rama, la RLS tirando lo ajeno. Sólo aquí.
create or replace function public.avisos_pendientes(p_tipos text[], p_limite integer)
 returns setof public.avisos_clinica language sql stable set search_path to '' as $f$
  select a.* from (select c.* from public.avisos_clinica c
           where c.clinica_id = public.get_clinica_id() and c.revisado_en is null and c.creado_en >= now() - interval '60 days'
             and c.tipo = any (coalesce(p_tipos, array[]::text[])) order by c.creado_en desc limit 500) a
   where coalesce((select v.visto_en from public.avisos_vistos v where v.aviso_id = a.id and v.usuario_id = auth.uid()) < a.creado_en, true)
   order by a.creado_en desc limit least(greatest(coalesce(p_limite, 50), 1), 200)
$f$;
create or replace function public.avisos_mas_antiguos(p_tipos text[])
 returns boolean language sql stable set search_path to '' as $f$
  select exists (select 1 from public.avisos_clinica c where c.clinica_id = public.get_clinica_id() and c.revisado_en is null
                    and c.creado_en >= now() - interval '60 days' and c.tipo = any (coalesce(p_tipos, array[]::text[]))
                  order by c.creado_en desc offset 500 limit 1)
      or exists (select 1 from public.avisos_clinica c where c.clinica_id = public.get_clinica_id() and c.revisado_en is null
                    and c.creado_en < now() - interval '60 days' and c.creado_en >= now() - interval '120 days'
                    and c.tipo = any (coalesce(p_tipos, array[]::text[]))
                    and coalesce((select v.visto_en from public.avisos_vistos v where v.aviso_id = c.id and v.usuario_id = auth.uid()) < c.creado_en, true))
$f$;
\endif

create function pg_temp.medir(p_quien text, p_uid uuid) returns void language plpgsql as $$
declare
  v_p numeric[] := '{}'; v_m numeric[] := '{}'; v_t0 timestamptz; v_n int; v_b boolean; i int;
  c_tipos constant text[] := array['reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
    'google_movimiento_rechazado', 'confirmacion_paciente', 'google_movio_cita', 'google_cancelo_cita', 'correo_fallido', 'personal_agendo',
    'personal_movio', 'personal_cancelo', 'paciente_no_asistira', 'reserva_frenada', 'google_desconectado', 'google_sin_sincronizar',
    'personal_bloqueo', 'personal_desbloqueo'];
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..18 loop
    v_t0 := clock_timestamp();
    select count(*) into v_n from public.avisos_pendientes(c_tipos, 51);
    if i > 3 then v_p := v_p || round((extract(epoch from clock_timestamp() - v_t0) * 1000)::numeric, 3); end if;
    v_t0 := clock_timestamp();
    v_b := public.avisos_mas_antiguos(c_tipos);
    if i > 3 then v_m := v_m || round((extract(epoch from clock_timestamp() - v_t0) * 1000)::numeric, 3); end if;
  end loop;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into _m values (p_quien, (select count(*) from _citas), (select franja from _cfg), v_n,
                         (select percentile_cont(0.5) within group (order by x) from unnest(v_p) x),
                         (select percentile_cont(0.5) within group (order by x) from unnest(v_m) x));
end $$;
-- Ver una a una TODO lo de la clínica que ese usuario ve (como postgres: es preparación, no se mide).
create function pg_temp.ver_todo(p_uid uuid) returns void language sql as $$
  insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
  select a.id, p_uid, a.clinica_id from public.avisos_clinica a join _citas c on c.id = a.cita_id
   where a.clinica_id = '00000000-0000-4000-8000-0000004a0c01'
     and (p_uid = '00000000-0000-4000-8000-0000004a0b01' or c.medico = p_uid)
  on conflict (aviso_id, usuario_id) do nothing;
$$;
create function pg_temp.marcar_todos(p_uid uuid) returns void language sql as $$
  insert into public.avisos_vistos_hasta (usuario_id, clinica_id) values (p_uid, '00000000-0000-4000-8000-0000004a0c01')
  on conflict (usuario_id) do update set hasta = clock_timestamp();
$$;

select pg_temp.medir('1 administrador · nada visto', '00000000-0000-4000-8000-0000004a0b01');
select pg_temp.medir('2 invitado con la mitad · nada visto', '00000000-0000-4000-8000-0000004a0b02');
select pg_temp.medir('3 invitado que casi no ve nada (1 %) · nada visto', '00000000-0000-4000-8000-0000004a0b03');
select pg_temp.ver_todo(u) from unnest(array['00000000-0000-4000-8000-0000004a0b01', '00000000-0000-4000-8000-0000004a0b02',
                                              '00000000-0000-4000-8000-0000004a0b03']::uuid[]) u;
analyze public.avisos_vistos;
select pg_temp.medir('4 administrador · TODO visto una a una', '00000000-0000-4000-8000-0000004a0b01');
select pg_temp.medir('5 invitado con la mitad · TODO visto una a una', '00000000-0000-4000-8000-0000004a0b02');
select pg_temp.medir('6 invitado que casi no ve nada · TODO visto una a una', '00000000-0000-4000-8000-0000004a0b03');
\if :{?version2}
\else
select pg_temp.marcar_todos(u) from unnest(array['00000000-0000-4000-8000-0000004a0b01', '00000000-0000-4000-8000-0000004a0b02',
                                                  '00000000-0000-4000-8000-0000004a0b03']::uuid[]) u;
select pg_temp.medir('7 administrador · tras «Marcar todos»', '00000000-0000-4000-8000-0000004a0b01');
select pg_temp.medir('8 invitado con la mitad · tras «Marcar todos»', '00000000-0000-4000-8000-0000004a0b02');
select pg_temp.medir('9 invitado que casi no ve nada · tras «Marcar todos»', '00000000-0000-4000-8000-0000004a0b03');
\endif

select quien, avisos, franja, filas as filas_devueltas, ms_pendientes, ms_mas_antiguos from _m order by quien;
rollback;
