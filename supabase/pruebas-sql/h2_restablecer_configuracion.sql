-- Agenda H2 (punto 10) — «Restablecer configuración de la agenda»
-- (20261120121000_agenda_h2_restablecer_configuracion.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
-- Lo que toca (consultorios, tipos, enlaces vigentes, plazos, recordatorio,
-- audit_log) y lo que NO toca (citas, pacientes, auditoría previa, contactos
-- bloqueados, otra clínica, el interruptor de la v2 y el candado).
-- MUTACIONES (comprobadas en rojo): quitar el `WHERE c.clinica_id = …` de los
-- consultorios → «caso 1 resultado» (ok:8 en vez de ok:3); borrar los tipos en vez de archivarlos
-- → la FK RESTRICT de la cita da 23503; quitar la comprobación de
-- administrador → «caso 4»; GRANT a authenticated → «caso 5»; el horario de
-- partida en el DEFAULT de columna y sin horario propio (lo que dejaba H2 antes
-- de la integración) → «caso 2 consultorios».
begin;

-- c1: la clínica que se restablece (v2 encendida). c2: otra clínica, con lo mismo, que NO se toca.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000073c1', 'H2 reinicio',  true, null, 'free', false),
  ('00000000-0000-4000-8000-0000000073c2', 'H2 vecina',    true, null, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000073a1'::uuid, 'h2r-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000073b1'::uuid, 'h2r-medico@prueba.local'),
               ('00000000-0000-4000-8000-0000000073d1'::uuid, 'h2r-secre@prueba.local'),
               ('00000000-0000-4000-8000-0000000073a2'::uuid, 'h2r-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000073c1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000073a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000073c1' where id = '00000000-0000-4000-8000-0000000073b1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000073c1', role = 'secretaria' where id = '00000000-0000-4000-8000-0000000073d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000073c2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000073a2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_horas, anticipacion_min_horas, horizonte_dias,
                                   vigencia_enlace_unico_dias, recordatorio_encendido) values
  ('00000000-0000-4000-8000-0000000073c1', true, 48, 5, 90, 14, true),
  ('00000000-0000-4000-8000-0000000073c2', true, 48, 5, 90, 14, true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida, recordatorio_horas = excluded.recordatorio_horas, anticipacion_min_horas = excluded.anticipacion_min_horas, horizonte_dias = excluded.horizonte_dias, vigencia_enlace_unico_dias = excluded.vigencia_enlace_unico_dias, recordatorio_encendido = excluded.recordatorio_encendido;
-- El horario de cada clínica, distinto: el reinicio copia a sus consultorios el de SU clínica.
update public.clinicas set horario_consulta = '{"miercoles":{"activo":true,"inicio":"10:00","fin":"14:00"}}'::jsonb
 where id = '00000000-0000-4000-8000-0000000073c1';
update public.clinicas set horario_consulta = '{"jueves":{"activo":true,"inicio":"07:00","fin":"09:00"}}'::jsonb
 where id = '00000000-0000-4000-8000-0000000073c2';
-- Candado distinto del de fábrica en c1 (como postgres): el reinicio no lo toca.
update public.agenda_ajustes set candado_cancelaciones = 5 where clinica_id = '00000000-0000-4000-8000-0000000073c1';

create function pg_temp.h(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;

-- Consultorios con horario propio (uno archivado en c1).
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, horario_propio, horario) values
  ('00000000-0000-4000-8000-00000073cc01', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1', 'Uno', 'Uno', 'Calle 1', true, true,
   '{"lunes":{"activo":true,"inicio":"08:00","fin":"12:00"}}'::jsonb),
  ('00000000-0000-4000-8000-00000073cc02', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073b1', 'Dos', 'Dos', 'Calle 2', true, true,
   '{"martes":{"activo":true,"inicio":"08:00","fin":"12:00"}}'::jsonb),
  ('00000000-0000-4000-8000-00000073cc04', '00000000-0000-4000-8000-0000000073c2', '00000000-0000-4000-8000-0000000073a2', 'Vecino', 'Vecino', 'Calle 4', true, true,
   '{"lunes":{"activo":true,"inicio":"08:00","fin":"12:00"}}'::jsonb);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, horario_propio, horario) values
  ('00000000-0000-4000-8000-00000073cc03', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1', 'Viejo', 'Viejo', 'Calle 3', false, true,
   '{"lunes":{"activo":true,"inicio":"09:00","fin":"10:00"}}'::jsonb);

-- Tipos: uno con una cita ligada, uno sin nada, uno ya archivado, uno de la vecina.
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo, principal) values
  ('00000000-0000-4000-8000-00000073e001', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1', 'Consulta', 30, true, true),
  ('00000000-0000-4000-8000-00000073e002', '00000000-0000-4000-8000-0000000073c1', null, 'Primera vez', 45, true, false),
  ('00000000-0000-4000-8000-00000073e003', '00000000-0000-4000-8000-0000000073c1', null, 'Revisión', 20, false, false),
  ('00000000-0000-4000-8000-00000073e004', '00000000-0000-4000-8000-0000000073c2', null, 'Consulta', 30, true, false);
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-0000000073f1', '00000000-0000-4000-8000-0000000073c1', 'Paciente', 'Reinicio', 'reinicio.h2@prueba.local', true);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day, tipo_cita_id, tipo_cita_nombre) values
  ('00000000-0000-4000-8000-0000000073a9', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073f1', '00000000-0000-4000-8000-0000000073a1',
   'Cita', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, '00000000-0000-4000-8000-00000073e001', 'Consulta');

-- Enlaces: fijo vigente, único vigente, único caducado y uno ya revocado en c1; uno vigente en c2.
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en, revocado_en) values
  ('00000000-0000-4000-8000-00000073b0f1', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1', 'fijo',  pg_temp.h('f1'), null, null, null),
  ('00000000-0000-4000-8000-00000073b0f2', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073b1', 'unico', pg_temp.h('u2'), 7, now() + interval '7 days', null),
  ('00000000-0000-4000-8000-00000073b0f3', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073b1', 'unico', pg_temp.h('u3'), 7, now() - interval '1 day', null),
  ('00000000-0000-4000-8000-00000073b0f4', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1', 'fijo',  pg_temp.h('f4'), null, null, now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000073b0f5', '00000000-0000-4000-8000-0000000073c2', '00000000-0000-4000-8000-0000000073a2', 'fijo',  pg_temp.h('f5'), null, null, null);

-- Un contacto bloqueado (dato, no configuración).
insert into public.reserva_contactos (id, clinica_id, medico_id, clave_hmac, clase, bloqueado_en, bloqueado_por) values
  ('00000000-0000-4000-8000-00000073c0c1', '00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1',
   pg_temp.h('tel'), 'telefono', now() - interval '1 day', '00000000-0000-4000-8000-0000000073a1');

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'H2 reinicio %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- Como el servidor: service_role, sin sub.
create function pg_temp.restablecer(p_clinica uuid, p_actor uuid) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado || ':' || r_consultorios || ',' || r_tipos || ',' || r_enlaces into v
    from public.agenda_restablecer_configuracion(p_clinica, p_actor);
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

-- Huellas de lo que NO se debe tocar, antes.
create temp table antes as
select (select md5(string_agg(a::text, '|' order by a.id)) from public.appointments a
         where a.clinica_id in ('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073c2')) as citas,
       (select md5(string_agg(p::text, '|' order by p.id)) from public.pacientes p
         where p.clinica_id = '00000000-0000-4000-8000-0000000073c1') as pacientes,
       (select md5(string_agg(r::text, '|' order by r.id)) from public.reserva_contactos r
         where r.clinica_id = '00000000-0000-4000-8000-0000000073c1') as contactos,
       (select count(*) from public.audit_log) as filas_auditoria,
       (select md5(string_agg(x::text, '|' order by x.id)) from (
          select id, horario, horario_propio from public.consultorios where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(t), null from public.tipos_cita t where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(e), null from public.reserva_enlaces e where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(j) - 'updated_at', null from public.agenda_ajustes j where clinica_id = '00000000-0000-4000-8000-0000000073c2') x) as vecina;

create temp table auditoria_antes as select l.id, md5(l::text) as huella from public.audit_log l;

-- ── Caso 1: el reinicio, con sus conteos ──
select pg_temp.esperar('caso 1 resultado',
  pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1'), 'ok:3,2,2');

-- ── Caso 2: lo que SÍ toca ──
do $$
begin
  -- Consultorios (también el archivado) al horario de partida de la v2: el de SU
  -- clínica copiado y como horario propio (la herencia de G4); la única fuente
  -- sigue siendo el consultorio (integración de la tanda H).
  perform pg_temp.esperar('caso 2 consultorios',
    (select string_agg(k.nombre || '=' || k.horario_propio::text || '/' || (k.horario = c.horario_consulta)::text, ',' order by k.nombre)
       from public.consultorios k join public.clinicas c on c.id = k.clinica_id
      where k.clinica_id = '00000000-0000-4000-8000-0000000073c1'),
    'Dos=true/true,Uno=true/true,Viejo=true/true');
  -- Tipos: archivados, NO borrados (el de la cita sigue ahí, la cita lo sigue apuntando).
  perform pg_temp.esperar('caso 2 tipos',
    (select string_agg(nombre || '=' || activo::text, ',' order by nombre) from public.tipos_cita
      where clinica_id = '00000000-0000-4000-8000-0000000073c1'),
    'Consulta=false,Primera vez=false,Revisión=false');
  perform pg_temp.esperar('caso 2 cita con su tipo',
    (select tipo_cita_id::text from public.appointments where id = '00000000-0000-4000-8000-0000000073a9'),
    '00000000-0000-4000-8000-00000073e001');
  -- Enlaces: sólo los vigentes, revocados a nombre del administrador; el caducado y el ya revocado, igual.
  perform pg_temp.esperar('caso 2 enlaces',
    (select string_agg(right(id::text, 2) || '=' || (revocado_en is not null)::text || '/' || coalesce(right(revocado_por::text, 2), '-'), ',' order by id)
       from public.reserva_enlaces where clinica_id = '00000000-0000-4000-8000-0000000073c1'),
    'f1=true/a1,f2=true/a1,f3=false/-,f4=true/-');
  -- Plazos y recordatorio de fábrica; interruptor de la v2 y candado intactos.
  perform pg_temp.esperar('caso 2 ajustes',
    (select recordatorio_horas || ',' || anticipacion_min_horas || ',' || horizonte_dias || ',' || vigencia_enlace_unico_dias || ','
            || recordatorio_encendido || ',' || agenda_v2_encendida || ',' || candado_cancelaciones
       from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000073c1'),
    '24,2,60,7,false,true,5');
  -- El respaldo del horario de antes, en audit_log, una fila por consultorio (hallazgo 1 de la auditoría).
  perform pg_temp.esperar('caso 2 respaldo del horario',
    (select string_agg(c.nombre || '=' || (l.descripcion::jsonb ->> 'horario_propio') || '/' || coalesce(l.descripcion::jsonb -> 'horario' -> 'lunes' ->> 'inicio', '-'), ',' order by c.nombre)
       from public.audit_log l join public.consultorios c on c.id = l.registro_id
      where l.accion = 'agenda_horario_restablecido' and l.user_id = '00000000-0000-4000-8000-0000000073a1'),
    'Dos=true/-,Uno=true/08:00,Viejo=true/09:00');
  -- La fila de auditoría del reinicio, a nombre del administrador.
  perform pg_temp.esperar('caso 2 auditoría',
    (select user_id || ' / ' || descripcion from public.audit_log where accion = 'agenda_configuracion_restablecida'
      and registro_id = (select id from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000073c1')),
    '00000000-0000-4000-8000-0000000073a1 / consultorios: 3; tipos archivados: 2; enlaces revocados: 2');
end $$;

-- ── Caso 3: lo que NO toca: citas, pacientes, contactos bloqueados, auditoría previa, la otra clínica ──
do $$
declare v antes;
begin
  select * into v from antes;
  perform pg_temp.esperar('caso 3 citas', (select md5(string_agg(a::text, '|' order by a.id)) from public.appointments a
    where a.clinica_id in ('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073c2')), v.citas);
  perform pg_temp.esperar('caso 3 pacientes', (select md5(string_agg(p::text, '|' order by p.id)) from public.pacientes p
    where p.clinica_id = '00000000-0000-4000-8000-0000000073c1'), v.pacientes);
  perform pg_temp.esperar('caso 3 contactos', (select md5(string_agg(r::text, '|' order by r.id)) from public.reserva_contactos r
    where r.clinica_id = '00000000-0000-4000-8000-0000000073c1'), v.contactos);
  -- Las filas de auditoría de antes siguen todas, idénticas (sólo se añadieron).
  perform pg_temp.esperar('caso 3 auditoría previa', (select count(*)::text from public.audit_log l
    join auditoria_antes x on x.id = l.id and x.huella = md5(l::text)), v.filas_auditoria::text);
  perform pg_temp.esperar('caso 3 otra clínica', (select md5(string_agg(x::text, '|' order by x.id)) from (
          select id, horario, horario_propio from public.consultorios where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(t), null from public.tipos_cita t where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(e), null from public.reserva_enlaces e where clinica_id = '00000000-0000-4000-8000-0000000073c2'
          union all select id, to_jsonb(j) - 'updated_at', null from public.agenda_ajustes j where clinica_id = '00000000-0000-4000-8000-0000000073c2') x),
    v.vecina);
end $$;

-- ── Caso 4: segunda barrera: quien no es el administrador de ESA clínica no restablece nada ──
do $$
begin
  -- Se vuelve a ensuciar un poco c1 para ver que no cambia.
  update public.agenda_ajustes set recordatorio_horas = 30 where clinica_id = '00000000-0000-4000-8000-0000000073c1';
  perform pg_temp.esperar('caso 4 invitado', pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073b1'), 'sin_permiso:0,0,0');
  perform pg_temp.esperar('caso 4 secretaria', pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073d1'), 'sin_permiso:0,0,0');
  perform pg_temp.esperar('caso 4 admin de otra clínica', pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a2'), 'sin_permiso:0,0,0');
  perform pg_temp.esperar('caso 4 sin cambio', (select recordatorio_horas::text from public.agenda_ajustes
    where clinica_id = '00000000-0000-4000-8000-0000000073c1'), '30');
  -- Con la v2 apagada: 'apagado', nada cambia.
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-0000000073c1';
  perform pg_temp.esperar('caso 4 apagada', pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1'), 'apagado:0,0,0');
  perform pg_temp.esperar('caso 4 apagada sin cambio', (select recordatorio_horas::text from public.agenda_ajustes
    where clinica_id = '00000000-0000-4000-8000-0000000073c1'), '30');
  -- Apagada, quien no administra sigue recibiendo 'sin_permiso' (no aprende si está encendida).
  perform pg_temp.esperar('caso 4 apagada y no admin', pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a2'), 'sin_permiso:0,0,0');
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000073c1';
end $$;

-- ── Caso 5: permisos: sólo service_role; authenticated (el propio administrador) recibe 42501 ──
do $$
begin
  perform pg_temp.esperar('caso 5 permisos',
    has_function_privilege('anon', 'public.agenda_restablecer_configuracion(uuid, uuid)', 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', 'public.agenda_restablecer_configuracion(uuid, uuid)', 'EXECUTE')::text || ','
    || has_function_privilege('service_role', 'public.agenda_restablecer_configuracion(uuid, uuid)', 'EXECUTE')::text,
    'false,false,true');
end $$;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000073a1', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.agenda_restablecer_configuracion('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1');
  raise exception 'H2 reinicio caso 5: authenticated pudo restablecer';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$
begin
  perform public.agenda_restablecer_configuracion('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1');
  raise exception 'H2 reinicio caso 5: anon pudo restablecer';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ── Caso 6: repetirlo es inofensivo (nada vigente que revocar, nada activo que archivar) ──
select set_config('request.jwt.claims', '', true);
select pg_temp.esperar('caso 6 repetir',
  pg_temp.restablecer('00000000-0000-4000-8000-0000000073c1', '00000000-0000-4000-8000-0000000073a1'), 'ok:3,0,0');

rollback;
