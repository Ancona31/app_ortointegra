-- Integración de la tanda M — el nombre del saludo del recordatorio
-- (20261125180000_agenda_m_saludo_recordatorio.sql). Se corre con scripts/pruebas-sql.sh.
-- Sobre la semilla (Clínica Semilla A y B). Todo en una transacción que termina en rollback.
--
-- Casos:
--   1 · cita con paciente ligado: el nombre del paciente, sin espacios de sobra.
--   2 · cita por ligar (sin paciente, con reserva_nombre): el de la reserva.
--   3 · el paciente ligado sin nombre (vacío): cae al de la reserva; sin ninguno, NULL.
--   4 · la cita con OTRA clínica, o una cita que no existe: NULL; un paciente de otra clínica ligado a la
--       cita (sólo posible a mano) no da su nombre.
--   5 · anon y authenticated no la ejecutan (42501); service_role sí.
--   6 · en toda la Clínica Semilla A, la función coincide con la regla de la ruta de la confirmación.
--
-- MUTACIONES (en rojo):
--   · el cuerpo sólo con reserva_nombre → «MS caso 1»;
--   · sin `a.clinica_id = p_clinica_id` → «MS caso 4 (otra clínica)»;
--   · sin `p.clinica_id = a.clinica_id` en el JOIN → «MS caso 4 (paciente ajeno)»;
--   · `grant execute … to authenticated` → «MS caso 5 (authenticated)».
begin;

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'MS %: dio %, esperaba %', p_caso, coalesce(p_obtenido, 'NULL'), coalesce(p_esperado, 'NULL');
  end if;
end $$;

create function pg_temp.como(p_rol text, p_clinica uuid, p_cita uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    execute format('set local role %I', p_rol);
    v := 'ok:' || coalesce(public.cita_nombre_saludo(p_clinica, p_cita), 'NULL');
  exception when others then
    v := sqlstate;
  end;
  reset role;
  return v;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.como(text, uuid, uuid) to anon, authenticated, service_role;

create temp table _c as
  select (select id from public.clinicas where nombre = 'Clínica Semilla A') as a,
         (select id from public.clinicas where nombre = 'Clínica Semilla B') as b;
create temp table _con as
  select x.id, x.paciente_id from public.appointments x, _c
   where x.clinica_id = _c.a and x.paciente_id is not null order by x.start_time limit 1;
-- Una cita por ligar propia (como crearCitaPorLigar de las e2e), deshecha con el rollback: la semilla no tiene.
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
  values ('ms-prueba-saludo', repeat('a', 64), true, now()) on conflict (version) do nothing;
create temp table _sin (id uuid, reserva_nombre text);
with m as (
    select p.id, p.clinica_id, co.id as consultorio, co.nombre, co.timezone
      from auth.users u join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.activo
     where u.email = 'admin.a@semilla.spinus.test' order by co.created_at limit 1
  ), nuevo as (
    insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
    select gen_random_uuid(), m.clinica_id, m.id, 'fijo', md5(random()::text) || md5(random()::text) from m
     where not exists (select 1 from public.reserva_enlaces y where y.medico_id = m.id and y.clase = 'fijo' and y.revocado_en is null)
    returning id
  ), e as (
    select id from nuevo
    union all select y.id from public.reserva_enlaces y, m where y.medico_id = m.id and y.clase = 'fijo' and y.revocado_en is null
    limit 1
  ), x as (
  insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone,
    title, start_time, end_time, status, origen, gcal_sync_status, reserva_enlace_id, reserva_canal, reserva_nombre,
    reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
    reserva_aceptado_en, reserva_historial_previo)
  select m.clinica_id, m.id, m.consultorio, m.nombre, m.timezone, 'Reserva MS', now() + interval '400 days',
         now() + interval '400 days 30 minutes', 'scheduled', 'spinus', 'pending', (select id from e), 'fijo', '  Ana   Pech ',
         '5512345678', 'persona.ms@ejemplo.test', md5('t') || md5('t2'), md5('c') || md5('c2'), 'ms-prueba-saludo', now(), 0
    from m returning id, reserva_nombre)
insert into _sin select id, reserva_nombre from x;
do $$ begin
  if not exists (select 1 from _con) then raise exception 'MS: la semilla no tiene una cita con paciente en A'; end if;
  if not exists (select 1 from _sin) then raise exception 'MS: no se pudo crear la cita por ligar en A'; end if;
end $$;

-- ── 1 · con paciente ─────────────────────────────────────────────────
update public.pacientes set nombre = '  Ana  ' where id = (select paciente_id from _con);
select pg_temp.esperar('caso 1', public.cita_nombre_saludo((select a from _c), (select id from _con)), 'Ana');

-- ── 2 · por ligar ────────────────────────────────────────────────────
select pg_temp.esperar('caso 2', public.cita_nombre_saludo((select a from _c), (select id from _sin)),
  (select btrim(reserva_nombre) from _sin));

-- ── 3 · el paciente sin nombre ───────────────────────────────────────
update public.pacientes set nombre = '   ' where id = (select paciente_id from _con);
select pg_temp.esperar('caso 3 (sin nombre ni reserva)', public.cita_nombre_saludo((select a from _c), (select id from _con)),
  (select nullif(btrim(reserva_nombre), '') from public.appointments where id = (select id from _con)));

-- ── 4 · otra clínica o cita inexistente ──────────────────────────────
select pg_temp.esperar('caso 4 (otra clínica)', public.cita_nombre_saludo((select b from _c), (select id from _sin)), null);
select pg_temp.esperar('caso 4 (otra clínica, con paciente)', public.cita_nombre_saludo((select b from _c), (select id from _con)), null);
select pg_temp.esperar('caso 4 (no existe)', public.cita_nombre_saludo((select a from _c), gen_random_uuid()), null);
-- Un paciente de la Clínica B ligado a la cita de A (lo deshace el rollback): su nombre no sale.
update public.pacientes set nombre = 'Ajeno' where id = (select id from public.pacientes where clinica_id = (select b from _c) order by id limit 1);
update public.appointments set paciente_id = (select id from public.pacientes where clinica_id = (select b from _c) order by id limit 1)
 where id = (select id from _con);
select pg_temp.esperar('caso 4 (paciente ajeno)', public.cita_nombre_saludo((select a from _c), (select id from _con)),
  (select nullif(btrim(reserva_nombre), '') from public.appointments where id = (select id from _con)));

-- ── 5 · quién la ejecuta ─────────────────────────────────────────────
select pg_temp.esperar('caso 5 (anon)', pg_temp.como('anon', (select a from _c), (select id from _sin)), '42501');
select pg_temp.esperar('caso 5 (authenticated)', pg_temp.como('authenticated', (select a from _c), (select id from _sin)), '42501');
select pg_temp.esperar('caso 5 (service_role)', pg_temp.como('service_role', (select a from _c), (select id from _sin)),
  'ok:' || (select btrim(reserva_nombre) from _sin));

-- ── 6 · la misma regla que la confirmación, en toda la clínica A ─────
select pg_temp.esperar('caso 6 (filas distintas)', (
  select count(*)::text from public.appointments x
    left join public.pacientes p on p.id = x.paciente_id and p.clinica_id = x.clinica_id
   where x.clinica_id = (select a from _c)
     and public.cita_nombre_saludo(x.clinica_id, x.id) is distinct from coalesce(nullif(btrim(p.nombre), ''), nullif(btrim(x.reserva_nombre), ''))),
  '0');

rollback;
