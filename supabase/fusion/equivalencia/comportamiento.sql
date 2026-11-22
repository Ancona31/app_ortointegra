-- E0 · equivalencia de COMPORTAMIENTO entre la base A (44 originales) y la B (6 fundidas).
-- El MISMO guion se corre en las dos; la salida (una fila por paso: resultado, SQLSTATE, mensaje,
-- HINT y filas nuevas de audit_log) se compara con diff. Datos inventados, ids fijos.
-- Una sola transacción que termina en ROLLBACK: no deja nada (audit_log no se toca: las filas que
-- escriben los disparadores dentro de esta transacción nunca llegan a confirmarse).
-- Uso: docker exec -i CONTENEDOR psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At -f - < comportamiento.sql
begin;
set local client_min_messages = warning;

-- ── Datos ── C1 (VIP, v2 ENCENDIDA): admin-médico M1, médico M3, secretaria S1, consultorio K1, paciente P1.
--            C2 (VIP, v2 APAGADA): admin-médico M2, consultorio K2, paciente P2.
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000e0c01', 'E0 encendida', true),
  ('00000000-0000-4000-8000-0000000e0c02', 'E0 apagada', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000e0b01'::uuid, 'e0-m1@prueba.local'),
               ('00000000-0000-4000-8000-0000000e0b03'::uuid, 'e0-m3@prueba.local'),
               ('00000000-0000-4000-8000-0000000e0b05'::uuid, 'e0-s1@prueba.local'),
               ('00000000-0000-4000-8000-0000000e0b02'::uuid, 'e0-m2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000e0c01', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Uno', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000e0b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000e0c01',
       nombres = 'Médico', apellido_paterno = 'Tres', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000e0b03';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000e0c01', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000e0b05';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000e0c02', es_admin_de_clinica = true,
       nombres = 'Médico', apellido_paterno = 'Dos', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-0000000e0b02';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000e0c01', true),
  ('00000000-0000-4000-8000-0000000e0c02', false);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'Consultorio Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-0000000e0d02', '00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0b02', 'Consultorio Dos', 'Dos', 'Calle 2', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000e0f01', '00000000-0000-4000-8000-0000000e0c01', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-0000000e0f02', '00000000-0000-4000-8000-0000000e0c02', 'Paciente', 'Dos');
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-0000000e0a01', '00000000-0000-4000-8000-0000000e0c01', null, 'Consulta', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
values ('v1-e0', pg_temp.h('aviso'), true, now());

-- El día base: hoy (truncado al día, UTC) + 3; así A y B, corridos el mismo día, dan las mismas horas.
create function pg_temp.d(p_horas numeric) returns timestamptz language sql as $$
  select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '3 days' + make_interval(secs => p_horas * 3600);
$$;
grant execute on function pg_temp.d(numeric), pg_temp.h(text) to anon, authenticated, service_role;

create temp table _r (n serial, paso text, rol text, resultado text, estado text, mensaje text, hint text, auditoria text);
create temp table _vistos (id uuid primary key);
insert into _vistos select id from public.audit_log;

create function pg_temp.paso(p_paso text, p_rol text, p_sub uuid, p_sql text) returns void language plpgsql as $f$
declare v text; v_n bigint; v_st text := 'ok'; v_msg text; v_hint text; v_aud text;
begin
  begin
    perform set_config('request.jwt.claims',
      (case when p_sub is null then json_build_object('role', p_rol) else json_build_object('sub', p_sub, 'role', p_rol) end)::text, true);
    execute format('set local role %I', p_rol);
    if p_sql ~* '^\s*(select|with)\s' then
      execute 'select coalesce(json_agg(t)::text, ''[]'') from (' || p_sql || ') t' into v;
    else
      execute p_sql;
      get diagnostics v_n = row_count;
      v := 'filas=' || v_n;
    end if;
    reset role;
  exception when others then
    get stacked diagnostics v_st = returned_sqlstate, v_msg = message_text, v_hint = pg_exception_hint;
    reset role;
  end;
  perform set_config('spinus.via', '', true);
  perform set_config('spinus.reagendar_cita', '', true);
  perform set_config('request.jwt.claims', '', true);
  select string_agg(format('%s|%s|%s|%s|%s', a.accion, a.tabla, a.registro_id, a.user_id, a.descripcion), ' ;; '
                    order by a.accion, a.tabla, a.registro_id::text, a.descripcion)
    into v_aud from public.audit_log a where not exists (select 1 from _vistos s where s.id = a.id);
  insert into _vistos select a.id from public.audit_log a where not exists (select 1 from _vistos s where s.id = a.id);
  insert into _r (paso, rol, resultado, estado, mensaje, hint, auditoria) values (p_paso, p_rol, v, v_st, v_msg, v_hint, v_aud);
end $f$;

-- Atajos de ids
\set C1 '''00000000-0000-4000-8000-0000000e0c01'''
\set C2 '''00000000-0000-4000-8000-0000000e0c02'''
\set M1 '00000000-0000-4000-8000-0000000e0b01'
\set M2 '00000000-0000-4000-8000-0000000e0b02'
\set M3 '00000000-0000-4000-8000-0000000e0b03'
\set S1 '00000000-0000-4000-8000-0000000e0b05'

-- ── 1. Altas de citas ──
select pg_temp.paso('01 anon inserta cita en C1', 'anon', null, $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e99', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0f01',
          '00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000e0d01', 'Consultorio Uno', 'x', pg_temp.d(15), pg_temp.d(15.5)) $q$);
select pg_temp.paso('02 M1 alta cita X1 con paciente (C1, v2)', 'authenticated', :'M1', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time, created_by)
  values ('00000000-0000-4000-8000-0000000e0e01', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0f01',
          '00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000e0d01', 'Consultorio Uno', 'Paciente Uno', pg_temp.d(15), pg_temp.d(15.5),
          '00000000-0000-4000-8000-0000000e0b01') $q$);
select pg_temp.paso('03 M1 alta con columnas reserva_* (deben quedar NULL)', 'authenticated', :'M1', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time, reserva_canal, reserva_nombre)
  values ('00000000-0000-4000-8000-0000000e0e02', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0f01',
          '00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000e0d01', 'Consultorio Uno', 'Paciente Uno', pg_temp.d(17), pg_temp.d(17.5), 'fijo', 'Falso') $q$);
select pg_temp.paso('04 lectura de X2 (reserva_* tras el alta)', 'postgres', null, $q$
  select reserva_canal, reserva_nombre, reserva_reagendados from public.appointments where id = '00000000-0000-4000-8000-0000000e0e02' $q$);
select pg_temp.paso('05 M2 (otra clínica) alta en C1', 'authenticated', :'M2', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e98', '00000000-0000-4000-8000-0000000e0c01', null,
          '00000000-0000-4000-8000-0000000e0b01', 'x', pg_temp.d(18), pg_temp.d(18.5)) $q$);
select pg_temp.paso('06 M2 alta cita Y1 con paciente (C2, v2 apagada)', 'authenticated', :'M2', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e21', '00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0f02',
          '00000000-0000-4000-8000-0000000e0b02', '00000000-0000-4000-8000-0000000e0d02', 'Consultorio Dos', 'Paciente Dos', pg_temp.d(15), pg_temp.d(15.5)) $q$);

-- ── 2. Ediciones ──
select pg_temp.paso('07 M1 edita notas de X1', 'authenticated', :'M1', $q$
  update public.appointments set notes = 'nota e0' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('08 M1 mueve X1', 'authenticated', :'M1', $q$
  update public.appointments set start_time = pg_temp.d(16), end_time = pg_temp.d(16.5) where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('09 S1 confirma X1', 'authenticated', :'S1', $q$
  update public.appointments set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('10 M2 edita X1 (otra clínica)', 'authenticated', :'M2', $q$
  update public.appointments set notes = 'intruso' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('11 anon edita X1', 'anon', null, $q$
  update public.appointments set notes = 'anon' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('12 M1 intenta reserva_* en edición', 'authenticated', :'M1', $q$
  update public.appointments set reserva_nombre = 'Falso' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('13 lectura X1', 'postgres', null, $q$
  select status, notes, start_time, reserva_nombre from public.appointments where id = '00000000-0000-4000-8000-0000000e0e01' $q$);

-- ── 3. Bloqueos ──
select pg_temp.paso('14 anon crea bloqueo', 'anon', null, $q$
  insert into public.agenda_bloqueos (motivo, clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
  values ('B-anon','00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
          pg_temp.d(19), pg_temp.d(21), false, 'America/Mexico_City') $q$);
select pg_temp.paso('15 M1 crea bloqueo B1 (C1)', 'authenticated', :'M1', $q$
  insert into public.agenda_bloqueos (motivo, clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
  values ('B1', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
          pg_temp.d(19), pg_temp.d(21), false, 'America/Mexico_City') $q$);
select pg_temp.paso('16 M2 crea bloqueo en C1', 'authenticated', :'M2', $q$
  insert into public.agenda_bloqueos (motivo, clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
  values ('B-intruso','00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
          pg_temp.d(22), pg_temp.d(23), false, 'America/Mexico_City') $q$);
select pg_temp.paso('17 M2 crea bloqueo en C2 (v2 apagada)', 'authenticated', :'M2', $q$
  insert into public.agenda_bloqueos (motivo, clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
  values ('B-C2', '00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0b02',
          pg_temp.d(19), pg_temp.d(21), false, 'America/Mexico_City') $q$);
select pg_temp.paso('18 M1 edita motivo de B1', 'authenticated', :'M1', $q$
  update public.agenda_bloqueos set fin = fin + interval '30 minutes' where motivo = 'B1' $q$);
select pg_temp.paso('19 M1 alta de cita dentro de B1', 'authenticated', :'M1', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e03', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0f01',
          '00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000e0d01', 'Consultorio Uno', 'Paciente Uno', pg_temp.d(19.5), pg_temp.d(20)) $q$);
select pg_temp.paso('20 M1 mueve X1 dentro de B1', 'authenticated', :'M1', $q$
  update public.appointments set start_time = pg_temp.d(20), end_time = pg_temp.d(20.5) where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('21 S1 evento sin paciente dentro de B1', 'authenticated', :'S1', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e04', '00000000-0000-4000-8000-0000000e0c01', null,
          '00000000-0000-4000-8000-0000000e0b01', 'Evento', pg_temp.d(19), pg_temp.d(19.5)) $q$);
select pg_temp.paso('22 service_role mueve X1 dentro de B1', 'service_role', null, $q$
  update public.appointments set start_time = pg_temp.d(20), end_time = pg_temp.d(20.5) where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('23 M2 alta dentro de su bloqueo (C2 apagada)', 'authenticated', :'M2', $q$
  insert into public.appointments (id, clinica_id, paciente_id, medico_id, consultorio_id, consultorio_nombre, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000e0e22', '00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0f02',
          '00000000-0000-4000-8000-0000000e0b02', '00000000-0000-4000-8000-0000000e0d02', 'Consultorio Dos', 'Paciente Dos', pg_temp.d(19.5), pg_temp.d(20)) $q$);

-- ── 4. Borrar, cancelar, cerrar ──
select pg_temp.paso('23b S1 borra el evento sin paciente (v2)', 'authenticated', :'S1', $q$
  delete from public.appointments where id = '00000000-0000-4000-8000-0000000e0e04' $q$);
select pg_temp.paso('24 M1 borra X1 (v2: se cancela, no se borra)', 'authenticated', :'M1', $q$
  delete from public.appointments where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('25 service_role borra X1', 'service_role', null, $q$
  delete from public.appointments where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('26 M2 borra Y1 (C2 apagada)', 'authenticated', :'M2', $q$
  delete from public.appointments where id = '00000000-0000-4000-8000-0000000e0e21' $q$);
select pg_temp.paso('27 M1 cancela X1', 'authenticated', :'M1', $q$
  update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('28 M1 cierra X1 con la sesión', 'authenticated', :'M1', $q$
  update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('29 service_role cierra X1 (Eliminar cita)', 'service_role', null, $q$
  update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('30 service_role reabre X1', 'service_role', null, $q$
  update public.appointments set cerrada_en = null where id = '00000000-0000-4000-8000-0000000e0e01' $q$);
select pg_temp.paso('31 M1 borra bloqueo B1', 'authenticated', :'M1', $q$
  delete from public.agenda_bloqueos where motivo = 'B1' $q$);

-- ── 5. Enlaces de reserva: emisión y el INSERT directo (la policy retirada) ──
select pg_temp.paso('32 anon INSERT reserva_enlaces', 'anon', null, $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  values ('00000000-0000-4000-8000-0000000e0791', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('x1')) $q$);
select pg_temp.paso('33 M1 INSERT reserva_enlaces (su clínica)', 'authenticated', :'M1', $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  values ('00000000-0000-4000-8000-0000000e0792', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('x2')) $q$);
select pg_temp.paso('34 S1 INSERT reserva_enlaces (su clínica, fijo de M1)', 'authenticated', :'S1', $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  values ('00000000-0000-4000-8000-0000000e0793', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'fijo', pg_temp.h('x3')) $q$);
select pg_temp.paso('35 M2 INSERT reserva_enlaces en C1 (otra clínica)', 'authenticated', :'M2', $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  values ('00000000-0000-4000-8000-0000000e0794', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('x4')) $q$);
select pg_temp.paso('36 M2 INSERT reserva_enlaces en C2 (la suya)', 'authenticated', :'M2', $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  values ('00000000-0000-4000-8000-0000000e0795', '00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0b02', 'unico', pg_temp.h('x5')) $q$);
select pg_temp.paso('37 service_role INSERT reserva_enlaces directo', 'service_role', null, $q$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias)
  values ('00000000-0000-4000-8000-0000000e0796', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('x6'), 7) $q$);
select pg_temp.paso('38 M1 emite por RPC (sólo servidor)', 'authenticated', :'M1', $q$
  select public.reserva_enlace_emitir('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
    '00000000-0000-4000-8000-0000000e0797', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('x7'), null, null, null) $q$);
select pg_temp.paso('39 servidor emite único U1 con correo', 'service_role', null, $q$
  select * from public.reserva_enlace_emitir('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
    '00000000-0000-4000-8000-0000000e0701', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('u1'), 'Para Ana',
    'ana@prueba.local', pg_temp.h('c:ana')) $q$);
select pg_temp.paso('40 servidor emite fijo F1', 'service_role', null, $q$
  select * from public.reserva_enlace_emitir('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
    '00000000-0000-4000-8000-0000000e0702', '00000000-0000-4000-8000-0000000e0b01', 'fijo', pg_temp.h('f1'), null, null, null) $q$);
select pg_temp.paso('41 servidor emite en C2 (apagada)', 'service_role', null, $q$
  select * from public.reserva_enlace_emitir('00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0b02',
    '00000000-0000-4000-8000-0000000e0703', '00000000-0000-4000-8000-0000000e0b02', 'fijo', pg_temp.h('f2'), null, null, null) $q$);
select pg_temp.paso('42 servidor emite con actor de otra clínica', 'service_role', null, $q$
  select * from public.reserva_enlace_emitir('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b02',
    '00000000-0000-4000-8000-0000000e0704', '00000000-0000-4000-8000-0000000e0b01', 'unico', pg_temp.h('u4'), null, null, null) $q$);
select pg_temp.paso('43 enlaces que hay', 'postgres', null, $q$
  select id, clinica_id, medico_id, clase, etiqueta, correo, intentos, revocado_en is not null as revocado from public.reserva_enlaces order by id $q$);

-- ── 6. Reserva por enlace, ocupación, código ──
select pg_temp.paso('44 contexto del único', 'service_role', null, $q$
  select public.reserva_contexto(pg_temp.h('u1'), 'v1-e0', pg_temp.h('aviso'))::jsonb - 'turnos' - 'ahora' as ctx $q$);
select pg_temp.paso('45 ocupación del único', 'service_role', null, $q$
  select * from public.reserva_ocupacion('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0701', pg_temp.d(0), pg_temp.d(48)) order by 1 $q$);
select pg_temp.paso('46 ocupación en C2 (apagada)', 'service_role', null, $q$
  select * from public.reserva_ocupacion('00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0703', pg_temp.d(0), pg_temp.d(48)) $q$);
select pg_temp.paso('47 reserva por el único (ok)', 'service_role', null, $q$
  select r_resultado, r_inicio, r_fin, r_historial from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('u1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(14), 'Ana Prueba', '5500000001',
    'otra@prueba.local', pg_temp.h('t:5500000001'), pg_temp.h('c:otra'), null, 'v1-e0', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-0000000e0e51') $q$);
select pg_temp.paso('48 la cita reservada', 'postgres', null, $q$
  select title, status, reserva_canal, reserva_nombre, reserva_correo, reserva_correo_hmac = pg_temp.h('c:ana') as hmac_de_la_clinica,
         start_time, end_time, tipo_cita_id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51' $q$);
select pg_temp.paso('49 reserva por el fijo sin código', 'service_role', null, $q$
  select r_resultado from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('f1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(13), 'Beto Prueba', '5500000002',
    'beto@prueba.local', pg_temp.h('t:5500000002'), pg_temp.h('c:beto'), null, 'v1-e0', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-0000000e0e52') $q$);
select pg_temp.paso('50 código para el fijo', 'service_role', null, $q$
  select public.reserva_codigo_emitir('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0702', pg_temp.h('c:beto'), pg_temp.h('cod:1')) $q$);
select pg_temp.paso('51 verificar código', 'service_role', null, $q$
  select public.reserva_codigo_verificar('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0702', pg_temp.h('c:beto'), pg_temp.h('cod:1'), pg_temp.h('ficha:1')) $q$);
select pg_temp.paso('52 reserva por el fijo con ficha', 'service_role', null, $q$
  select r_resultado, r_inicio from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('f1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(13), 'Beto Prueba', '5500000002',
    'beto@prueba.local', pg_temp.h('t:5500000002'), pg_temp.h('c:beto'), pg_temp.h('ficha:1'), 'v1-e0', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-0000000e0e52') $q$);
select pg_temp.paso('53 reserva por el fijo encima de la otra', 'service_role', null, $q$
  select r_resultado from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('f1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(14), 'Beto Prueba', '5500000002',
    'beto@prueba.local', pg_temp.h('t:5500000002'), pg_temp.h('c:beto'), pg_temp.h('ficha:1'), 'v1-e0', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-0000000e0e53') $q$);
select pg_temp.paso('54 bloqueo B2 y reserva dentro', 'postgres', null, $q$
  insert into public.agenda_bloqueos (id, clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
  values ('00000000-0000-4000-8000-0000000e0903', '00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
          pg_temp.d(26), pg_temp.d(28), false, 'America/Mexico_City') $q$);
select pg_temp.paso('55 reserva dentro de B2', 'service_role', null, $q$
  select r_resultado from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('f1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(27), 'Beto Prueba', '5500000002',
    'beto@prueba.local', pg_temp.h('t:5500000002'), pg_temp.h('c:beto'), pg_temp.h('ficha:1'), 'v1-e0', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-0000000e0e54') $q$);
select pg_temp.paso('56 ocupación tras reservas y B2', 'service_role', null, $q$
  select * from public.reserva_ocupacion('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0702', pg_temp.d(0), pg_temp.d(48)) order by 1 $q$);
select pg_temp.paso('57 anon llama a reservar_por_enlace', 'anon', null, $q$
  select r_resultado from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('f1'),
    '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0a01', pg_temp.d(12), 'x', '5500000009',
    'x@prueba.local', pg_temp.h('t:x'), pg_temp.h('c:x'), null, 'v1-e0', pg_temp.h('aviso'), null) $q$);

-- ── 7. Candado de elección, reagendar, confirmación ──
select pg_temp.paso('58 M1 mueve la cita reservada (candado)', 'authenticated', :'M1', $q$
  update public.appointments set start_time = pg_temp.d(15), end_time = pg_temp.d(15.5) where client_id = '00000000-0000-4000-8000-0000000e0e51' $q$);
select pg_temp.paso('59 M1 cambia médico de la reservada', 'authenticated', :'M1', $q$
  update public.appointments set medico_id = '00000000-0000-4000-8000-0000000e0b03' where client_id = '00000000-0000-4000-8000-0000000e0e51' $q$);
select pg_temp.paso('60 M1 notas de la reservada', 'authenticated', :'M1', $q$
  update public.appointments set notes = 'ok' where client_id = '00000000-0000-4000-8000-0000000e0e51' $q$);
select pg_temp.paso('61 reagendar por la clínica', 'service_role', null, $q$
  select r_resultado from public.cita_reagendar_clinica('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'), '00000000-0000-4000-8000-0000000e0d01',
    pg_temp.d(30), pg_temp.d(30.5), pg_temp.d(14)) $q$);
select pg_temp.paso('62 reagendar dentro de B2', 'service_role', null, $q$
  select r_resultado from public.cita_reagendar_clinica('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'), '00000000-0000-4000-8000-0000000e0d01',
    pg_temp.d(27), pg_temp.d(27.5), pg_temp.d(30)) $q$);
select pg_temp.paso('63 reagendar en C2 (apagada)', 'service_role', null, $q$
  select r_resultado from public.cita_reagendar_clinica('00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0b02',
    '00000000-0000-4000-8000-0000000e0e21', '00000000-0000-4000-8000-0000000e0d02', pg_temp.d(30), pg_temp.d(30.5), pg_temp.d(15)) $q$);
select pg_temp.paso('64 emitir confirmación de la reservada', 'service_role', null, $q$
  select r_codigo_hash from public.cita_confirmacion_emitir('00000000-0000-4000-8000-0000000e0c01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'),
    '00000000-0000-4000-8000-0000000e0601', pg_temp.h('conf1'), '00000000-0000-4000-8000-0000000e0b01') $q$);
select pg_temp.paso('65 contexto de la confirmación', 'service_role', null, $q$
  select public.cita_confirmacion_contexto(pg_temp.h('conf1'))::jsonb - 'ahora' as ctx $q$);
select pg_temp.paso('66 el paciente confirma', 'service_role', null, $q$
  select r_resultado from public.cita_confirmacion_responder('00000000-0000-4000-8000-0000000e0c01', pg_temp.h('conf1'), 'confirmar') $q$);
select pg_temp.paso('67 emitir confirmación en C2 (apagada)', 'service_role', null, $q$
  select r_codigo_hash from public.cita_confirmacion_emitir('00000000-0000-4000-8000-0000000e0c02',
    '00000000-0000-4000-8000-0000000e0e21', '00000000-0000-4000-8000-0000000e0602', pg_temp.h('conf2'), null) $q$);
select pg_temp.paso('68 avisos de la clínica', 'postgres', null, $q$
  select tipo, clinica_id, revisado_en is not null as revisado from public.avisos_clinica order by tipo $q$);
select pg_temp.paso('69 correo de la confirmación (tomar)', 'service_role', null, $q$
  select * from public.cita_correo_tomar('00000000-0000-4000-8000-0000000e0c01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'), 'confirmacion', '00000000-0000-4000-8000-0000000e0501') $q$);
select pg_temp.paso('70 recordatorios pendientes', 'service_role', null, $q$
  select * from public.cita_recordatorios_pendientes(50) $q$);

-- ── 8. Google (sin sesión) con v2 encendida y apagada ──
select pg_temp.paso('71 gcal_citas_por_evento C1', 'service_role', null, $q$
  select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-0000000e0c01', array['ev1'], array[]::uuid[]) $q$);
select pg_temp.paso('72 gcal_citas_por_evento C2', 'service_role', null, $q$
  select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-0000000e0c02', array['ev1'], array[]::uuid[]) $q$);
select pg_temp.paso('73 gcal_sync_tomar C1 sin conexión', 'service_role', null, $q$
  select * from public.gcal_sync_tomar('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0401', 'cal@prueba', 60, 0) $q$);
select pg_temp.paso('74 gcal_sync_tomar C2', 'service_role', null, $q$
  select * from public.gcal_sync_tomar('00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0402', 'cal@prueba', 60, 0) $q$);
select pg_temp.paso('75 gcal_importar_evento C1', 'service_role', null, $q$
  select public.gcal_importar_evento('00000000-0000-4000-8000-0000000e0c01', 'cal@prueba', 'ev-imp-1', 'etag1', pg_temp.d(1),
    'Evento de Google', pg_temp.d(40), pg_temp.d(41), false, 'America/Mexico_City', null, '00000000-0000-4000-8000-0000000e0b01') is not null as importada $q$);
select pg_temp.paso('76 gcal_importar_evento C2', 'service_role', null, $q$
  select public.gcal_importar_evento('00000000-0000-4000-8000-0000000e0c02', 'cal@prueba', 'ev-imp-2', 'etag1', pg_temp.d(1),
    'Evento de Google', pg_temp.d(40), pg_temp.d(41), false, 'America/Mexico_City', null, '00000000-0000-4000-8000-0000000e0b02') is not null as importada $q$);
select pg_temp.paso('77 gcal_sync_clinica_habilitada', 'service_role', null, $q$
  select public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-0000000e0c01') a, public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-0000000e0c02') b $q$);
select pg_temp.paso('78 reserva_empalmes_registrar C1', 'service_role', null, $q$
  select public.reserva_empalmes_registrar('00000000-0000-4000-8000-0000000e0c01', array[(select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51')]) $q$);
select pg_temp.paso('79 cita_movimiento_google_registrar C1', 'service_role', null, $q$
  select public.cita_movimiento_google_registrar('00000000-0000-4000-8000-0000000e0c01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'), pg_temp.d(2)) $q$);
select pg_temp.paso('80 cita_movimiento_google_registrar C2', 'service_role', null, $q$
  select public.cita_movimiento_google_registrar('00000000-0000-4000-8000-0000000e0c02', '00000000-0000-4000-8000-0000000e0e21', pg_temp.d(2)) $q$);
select pg_temp.paso('81 cita_rsvp_google C1', 'service_role', null, $q$
  select public.cita_rsvp_google('00000000-0000-4000-8000-0000000e0c01',
    (select id from public.appointments where client_id = '00000000-0000-4000-8000-0000000e0e51'), 'cal@prueba', 'ev-x', array['ana@prueba.local']) $q$);
select pg_temp.paso('82 gcal_bloqueo_aplicar C1 (no crea)', 'service_role', null, $q$
  select public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000e0c01', 'cal@prueba', 'ev-b', '00000000-0000-4000-8000-0000000e0903',
    'etag', pg_temp.d(1), false, pg_temp.d(26), pg_temp.d(29), null, null) $q$);
select pg_temp.paso('83 gcal_bloqueo_aplicar C2', 'service_role', null, $q$
  select public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000e0c02', 'cal@prueba', 'ev-b', (select id from public.agenda_bloqueos where motivo = 'B-C2'),
    'etag', pg_temp.d(1), false, pg_temp.d(26), pg_temp.d(29), null, null) $q$);
select pg_temp.paso('84 authenticated llama a una gcal_* (sólo servidor)', 'authenticated', :'M1', $q$
  select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-0000000e0c01', array['ev1'], array[]::uuid[]) $q$);
select pg_temp.paso('85 anon llama a cita_confirmacion_contexto', 'anon', null, $q$
  select public.cita_confirmacion_contexto(pg_temp.h('conf1')) $q$);

-- ── 9. Restablecer y lectura final ──
select pg_temp.paso('86 restablecer configuración C1', 'service_role', null, $q$
  select public.agenda_restablecer_configuracion('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0b01') $q$);
select pg_temp.paso('87 estado final de las citas', 'postgres', null, $q$
  select id, clinica_id, medico_id, title, status, start_time, end_time, notes, reserva_canal, reserva_nombre, reserva_reagendados,
         google_asignacion, origen, cerrada_en is not null as cerrada, sustituida_por, tipo_cita_id, gcal_sync_status
    from public.appointments where clinica_id in ('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0c02')
   order by clinica_id, start_time, title $q$);
select pg_temp.paso('88 estado final de bloqueos, enlaces, tipos y consultorios', 'postgres', null, $q$
  select (select json_agg(b order by b.motivo) from (select medico_id, inicio, fin, motivo from public.agenda_bloqueos) b) bloqueos,
         (select json_agg(e order by e.id) from (select id, clase, revocado_en is not null rev, pausado_en is not null pau, intentos from public.reserva_enlaces) e) enlaces,
         (select json_agg(t order by t.id) from (select id, activo, duracion_min from public.tipos_cita where clinica_id = '00000000-0000-4000-8000-0000000e0c01') t) tipos,
         (select json_agg(k order by k.id) from (select id, horario_propio, horario_revisado_en is null por_revisar, horario from public.consultorios
                                                  where clinica_id in ('00000000-0000-4000-8000-0000000e0c01', '00000000-0000-4000-8000-0000000e0c02')) k) consultorios,
         (select json_agg(c order by c.tipo) from (select tipo, estado from public.cita_correos) c) correos,
         (select json_agg(c) from (select respuesta from public.cita_confirmaciones) c) confirmaciones $q$);

-- Salida normalizada: uuid generados → <uuid>; instantes con fracción de segundo (now()) → <ahora>.
select n || E'\t' || paso || E'\t' || rol || E'\t' || estado || E'\t' ||
       coalesce(regexp_replace(regexp_replace(coalesce(resultado, ''),
         '[0-9a-f]{8}-(?!0000-4000-8000-)[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g'),
         '\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d\.\d+([+-]\d\d(:\d\d)?)?', '<ahora>', 'g'), '') || E'\t' ||
       coalesce(mensaje, '') || E'\t' || coalesce(hint, '') || E'\t' ||
       coalesce(regexp_replace(regexp_replace(auditoria,
         '[0-9a-f]{8}-(?!0000-4000-8000-)[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g'),
         '\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d\.\d+([+-]\d\d(:\d\d)?)?', '<ahora>', 'g'), '')
  from _r order by n;
rollback;
