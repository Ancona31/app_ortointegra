-- E0 (3.ª vuelta) · proteger_reserva_contactos(): qué cambia de COMPORTAMIENTO entre las originales (A)
-- y el conjunto de hoy (B). El mismo guion en las dos; la salida se compara con diff. Se espera que
-- cambien SÓLO las filas de un médico de otra clínica o de quien no es médico (y, como mucho, el
-- SQLSTATE de inserciones que ya se rechazaban). Datos inventados, ids fijos; una transacción con ROLLBACK.
-- Uso: docker exec -i CONTENEDOR psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At -f - < proteger-contactos.sql
begin;
set local client_min_messages = warning;

insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000c0c01', 'PC uno', true),
  ('00000000-0000-4000-8000-0000000c0c02', 'PC dos', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000c0b01'::uuid, 'pc-m1@prueba.local'),
               ('00000000-0000-4000-8000-0000000c0b03'::uuid, 'pc-m3@prueba.local'),
               ('00000000-0000-4000-8000-0000000c0b05'::uuid, 'pc-s1@prueba.local'),
               ('00000000-0000-4000-8000-0000000c0b02'::uuid, 'pc-m2@prueba.local')) u(id, email);
-- M1 administrador-médico y M3 médico de C1; S1 secretaria de C1; M2 administrador-médico de C2.
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000c0c01', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Uno', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000c0b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000c0c01',
       nombres = 'Médico', apellido_paterno = 'Tres', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000c0b03';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000c0c01', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000c0b05';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000c0c02', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Dos', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000c0b02';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000c0c01', true), ('00000000-0000-4000-8000-0000000c0c02', true);
-- Dos citas reservadas por enlace (como postgres, el único que escribe reserva_* sin pasar por la RPC).
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
values ('v1-pc', repeat('0', 64), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-0000000c0701', '00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', 'fijo', repeat('a', 64)),
  ('00000000-0000-4000-8000-0000000c0703', '00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b03', 'fijo', repeat('b', 64));
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, reserva_canal, reserva_enlace_id,
                                 reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
                                 reserva_aceptado_en, reserva_historial_previo)
values ('00000000-0000-4000-8000-0000000c0e01', '00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01',
        'Reserva', now() + interval '3 days', now() + interval '3 days 30 minutes', 'fijo', '00000000-0000-4000-8000-0000000c0701',
        'Ana', repeat('1', 64), repeat('2', 64), 'v1-pc', now(), 0),
       ('00000000-0000-4000-8000-0000000c0e03', '00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b03',
        'Reserva', now() + interval '4 days', now() + interval '4 days 30 minutes', 'fijo', '00000000-0000-4000-8000-0000000c0703',
        'Beto', repeat('3', 64), repeat('4', 64), 'v1-pc', now(), 0);

create temp table _r (n serial, paso text, rol text, resultado text, estado text, mensaje text);
grant insert, select on _r to anon, authenticated, service_role;
create function pg_temp.paso(p_paso text, p_rol text, p_sub uuid, p_sql text) returns void language plpgsql as $f$
declare v text; v_n bigint; v_st text := 'ok'; v_msg text;
begin
  begin
    perform set_config('request.jwt.claims',
      (case when p_sub is null then json_build_object('role', p_rol) else json_build_object('sub', p_sub, 'role', p_rol) end)::text, true);
    execute format('set local role %I', p_rol);
    if p_sql ~* '^\s*(select|with)\s' then
      execute 'select coalesce(json_agg(t)::text, ''[]'') from (' || p_sql || ') t' into v;
    else
      execute p_sql; get diagnostics v_n = row_count; v := 'filas=' || v_n;
    end if;
    reset role;
  exception when others then
    get stacked diagnostics v_st = returned_sqlstate, v_msg = message_text;
    reset role;
  end;
  perform set_config('request.jwt.claims', '', true);
  insert into _r (paso, rol, resultado, estado, mensaje) values (p_paso, p_rol, v, v_st, v_msg);
end $f$;

\set M1 '00000000-0000-4000-8000-0000000c0b01'
\set M2 '00000000-0000-4000-8000-0000000c0b02'
\set M3 '00000000-0000-4000-8000-0000000c0b03'
\set S1 '00000000-0000-4000-8000-0000000c0b05'

-- ── Caminos legítimos (la app): reserva_contacto_marcar con la sesión ──
select pg_temp.paso('01 M1 (admin) bloquea su cita', 'authenticated', :'M1', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e01', 'bloquear') as n $q$);
select pg_temp.paso('02 M1 desbloquea su cita (ON CONFLICT)', 'authenticated', :'M1', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e01', 'desbloquear') as n $q$);
select pg_temp.paso('03 M1 (admin) bloquea la cita de M3', 'authenticated', :'M1', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e03', 'bloquear') as n $q$);
select pg_temp.paso('04 S1 (secretaria) desbloquea la cita de M3', 'authenticated', :'S1', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e03', 'desbloquear') as n $q$);
select pg_temp.paso('05 M3 bloquea su cita', 'authenticated', :'M3', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e03', 'bloquear') as n $q$);
select pg_temp.paso('06 M3 marca la cita de M1 (no la ve)', 'authenticated', :'M3', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e01', 'bloquear') as n $q$);
select pg_temp.paso('07 M2 (otra clínica) marca la cita de M1', 'authenticated', :'M2', $q$
  select public.reserva_contacto_marcar('00000000-0000-4000-8000-0000000c0e01', 'bloquear') as n $q$);
select pg_temp.paso('08 estado del candado manual (M1)', 'postgres', null, $q$
  select * from public.reserva_contacto_estado('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('1', 64), repeat('2', 64)) $q$);

-- ── INSERT directo por PostgREST ──
select pg_temp.paso('10 M1 inserta con médico de SU clínica (M3)', 'authenticated', :'M1', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b03', repeat('5', 64), 'telefono', now()) $q$);
select pg_temp.paso('11 S1 inserta con médico de su clínica (M1)', 'authenticated', :'S1', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('6', 64), 'telefono', now()) $q$);
select pg_temp.paso('12 M3 inserta con él mismo de médico', 'authenticated', :'M3', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, perdonado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b03', repeat('7', 64), 'correo', now()) $q$);
select pg_temp.paso('13 M1 inserta en C1 con médico de OTRA clínica (M2)  [el hueco]', 'authenticated', :'M1', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b02', repeat('8', 64), 'telefono', now()) $q$);
select pg_temp.paso('14 S1 inserta en C1 con médico de OTRA clínica (M2)  [el hueco]', 'authenticated', :'S1', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b02', repeat('9', 64), 'telefono', now()) $q$);
select pg_temp.paso('15 M1 inserta con quien NO es médico (S1)  [el hueco]', 'authenticated', :'M1', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b05', repeat('a', 64), 'telefono', now()) $q$);
select pg_temp.paso('16 M3 inserta con otro médico de su clínica (M1)', 'authenticated', :'M3', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('b', 64), 'telefono', now()) $q$);
select pg_temp.paso('17 M2 inserta en la clínica ajena C1', 'authenticated', :'M2', $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('c', 64), 'telefono', now()) $q$);
select pg_temp.paso('18 anon inserta', 'anon', null, $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('d', 64), 'telefono', now()) $q$);
select pg_temp.paso('19 service_role inserta', 'service_role', null, $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b01', repeat('e', 64), 'telefono', now()) $q$);
select pg_temp.paso('20 postgres inserta con médico ajeno (exento)', 'postgres', null, $q$
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-0000000c0c01', '00000000-0000-4000-8000-0000000c0b02', repeat('f', 64), 'telefono', now()) $q$);
select pg_temp.paso('21 M1 cambia el médico de una fila (identidad)', 'authenticated', :'M1', $q$
  update public.reserva_contactos set medico_id = '00000000-0000-4000-8000-0000000c0b03'
   where clinica_id = '00000000-0000-4000-8000-0000000c0c01' and clave_hmac = repeat('1', 64) $q$);
select pg_temp.paso('22 M1 desbloquea una fila (UPDATE legítimo)', 'authenticated', :'M1', $q$
  update public.reserva_contactos set perdonado_en = now()
   where clinica_id = '00000000-0000-4000-8000-0000000c0c01' and clave_hmac = repeat('5', 64) $q$);
select pg_temp.paso('23 filas finales (sin instantes)', 'postgres', null, $q$
  select medico_id, left(clave_hmac, 4) as clave, clase, bloqueado_en is not null as bloq, perdonado_en is not null as perd,
         bloqueado_por, perdonado_por
    from public.reserva_contactos where clinica_id = '00000000-0000-4000-8000-0000000c0c01' order by clave_hmac $q$);

select format('%s|%s|%s|%s|%s', paso, rol, coalesce(resultado, ''), estado, coalesce(mensaje, '')) from _r order by n;
rollback;
