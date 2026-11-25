-- Google ↔ agenda · M5 (20261205120000_gcal_empalmes_pendientes.sql, AG-DT-264): la cola persistente
-- de empalmes con reservas por enlace. Falla si M5 no está o se deshizo (caso 0).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- Las escrituras «de Google» se hacen como las hacen gcal_aplicar_evento y la importación de F2: con
-- service_role y spinus.via = 'google' puesto en la transacción (es lo único que miran los disparadores).
-- El flujo entero, con el Google falso, lo cubren las e2e reserva-google y agenda-google-dos-sentidos.
-- Mutaciones comprobadas en rojo: quitar el WHEN de spinus.via → caso 1; quitar el EXCEPTION de
-- gcal_empalme_apuntar → caso 5; que el consumidor se trague el fallo del registro → caso 4.
begin;

-- Caso 0: lo que deja M5 está, cerrado a las sesiones.
do $$
begin
  if to_regclass('public.gcal_empalmes_pendientes') is null
     or to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') is null then
    raise exception 'AP3 caso 0: falta la cola o su consumidor (falta M5 o se deshizo)';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.appointments'::regclass and tgenabled = 'O'
        and tgname in ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')) <> 2 then
    raise exception 'AP3 caso 0: faltan los dos disparadores de appointments';
  end if;
  if has_table_privilege('authenticated', 'public.gcal_empalmes_pendientes', 'SELECT')
     or has_table_privilege('anon', 'public.gcal_empalmes_pendientes', 'SELECT')
     or has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'INSERT')
     or has_function_privilege('authenticated', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE')
     or exists (select 1 from pg_policy where polrelid = 'public.gcal_empalmes_pendientes'::regclass) then
    raise exception 'AP3 caso 0: la cola o su consumidor están abiertos a quien no deben';
  end if;
end $$;

-- ── Datos: dos clínicas con la v2 encendida; en cada una un médico, un enlace fijo y una reserva por
-- enlace pasado mañana de 10:00 a 10:30.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000000a93c1', 'AP3 uno', true, 'free'), ('00000000-0000-4000-8000-0000000a93c2', 'AP3 dos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000a93b1'::uuid, 'ap3-b1@prueba.local'),
               ('00000000-0000-4000-8000-0000000a93b2'::uuid, 'ap3-b2@prueba.local'),
               ('00000000-0000-4000-8000-0000000a93b3'::uuid, 'ap3-b3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a93c1', es_admin_de_clinica = (id::text like '%b1')
 where id in ('00000000-0000-4000-8000-0000000a93b1', '00000000-0000-4000-8000-0000000a93b3');
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a93c2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a93b2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000a93c1', true), ('00000000-0000-4000-8000-0000000a93c2', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.t(p_min integer) returns timestamptz language sql as $$
  select date_trunc('day', now()) + interval '2 days 10 hours' + p_min * interval '1 minute';
$$;
grant execute on function pg_temp.h(text), pg_temp.t(integer) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-ap3', pg_temp.h('aviso-ap3'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
select ('00000000-0000-4000-8000-0000000a93e' || n)::uuid, ('00000000-0000-4000-8000-0000000a93c' || n)::uuid,
       ('00000000-0000-4000-8000-0000000a93b' || n)::uuid, 'fijo', pg_temp.h('ap3-f' || n) from (values (1), (2)) x(n);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
select ('00000000-0000-4000-8000-0000000a93a' || n)::uuid, ('00000000-0000-4000-8000-0000000a93c' || n)::uuid, null,
       ('00000000-0000-4000-8000-0000000a93b' || n)::uuid, 'Persona AP3', pg_temp.t(0), pg_temp.t(30), 'scheduled',
       ('00000000-0000-4000-8000-0000000a93e' || n)::uuid, 'fijo', 'Persona AP3', '5500000033', 'ap3@prueba.local',
       pg_temp.h('t' || n), pg_temp.h('c' || n), 'v1-prueba-ap3', now(), 0
  from (values (1), (2)) x(n);

-- Una escritura «de Google»: con service_role y la vía puesta, como las funciones de F2.
create function pg_temp.google(p_sql text) returns void language plpgsql as $$
begin
  perform set_config('spinus.via', 'google', true);
  set local role service_role;
  execute p_sql;
  reset role;
  perform set_config('spinus.via', '', true);
end $$;
create function pg_temp.cola(p_clinica integer) returns text language sql as $$
  select coalesce(string_agg(right(cita_id::text, 3), ',' order by cita_id), 'vacía') from public.gcal_empalmes_pendientes
   where clinica_id = ('00000000-0000-4000-8000-0000000a93c' || p_clinica)::uuid;
$$;
create function pg_temp.procesar(p_clinica integer) returns text language plpgsql as $$
declare r record;
begin
  set local role service_role;
  select * into r from public.reserva_empalmes_pendientes_procesar(('00000000-0000-4000-8000-0000000a93c' || p_clinica)::uuid, 500);
  reset role;
  return r.r_procesados || '/' || r.r_pares || '/' || r.r_quedan;
end $$;

-- Caso 1: una escritura NORMAL (el personal, sin la vía de Google) no apunta nada: ni al crear, ni al mover.
do $$
begin
  insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time)
  values ('00000000-0000-4000-8000-0000000a93d1', '00000000-0000-4000-8000-0000000a93c1', '00000000-0000-4000-8000-0000000a93b1',
          'Del personal', pg_temp.t(120), pg_temp.t(150));
  update public.appointments set start_time = pg_temp.t(125) where id = '00000000-0000-4000-8000-0000000a93d1';
  set local role service_role;
  update public.appointments set end_time = pg_temp.t(155) where id = '00000000-0000-4000-8000-0000000a93d1';
  reset role;
  if pg_temp.cola(1) <> 'vacía' then
    raise exception 'AP3 caso 1: una escritura sin la vía de Google dejó apuntes (%)', pg_temp.cola(1);
  end if;
end $$;

-- Caso 2: lo que Google importa o mueve queda apuntado en su misma transacción; cambiar otra cosa, no.
do $$
begin
  perform pg_temp.google($q$insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, origen)
    values ('00000000-0000-4000-8000-0000000a93d2', '00000000-0000-4000-8000-0000000a93c1', '00000000-0000-4000-8000-0000000a93b1',
            'Evento de Google', pg_temp.t(15), pg_temp.t(60), 'google')$q$);
  if pg_temp.cola(1) <> '3d2' then raise exception 'AP3 caso 2: importar desde Google no apuntó la cita (%)', pg_temp.cola(1); end if;
  -- Moverla otra vez no duplica el apunte.
  perform pg_temp.google($q$update public.appointments set start_time = pg_temp.t(10) where id = '00000000-0000-4000-8000-0000000a93d2'$q$);
  if pg_temp.cola(1) <> '3d2' then raise exception 'AP3 caso 2: mover dos veces duplicó o perdió el apunte (%)', pg_temp.cola(1); end if;
  -- Mover desde Google la que creó el personal: apuntada.
  perform pg_temp.google($q$update public.appointments set start_time = pg_temp.t(200), end_time = pg_temp.t(230) where id = '00000000-0000-4000-8000-0000000a93d1'$q$);
  if pg_temp.cola(1) <> '3d1,3d2' then raise exception 'AP3 caso 2: mover desde Google no apuntó la cita (%)', pg_temp.cola(1); end if;
  -- Un cambio de Google que no toca inicio, fin ni médico (el título): sin apunte nuevo.
  delete from public.gcal_empalmes_pendientes where cita_id = '00000000-0000-4000-8000-0000000a93d1';
  perform pg_temp.google($q$update public.appointments set title = 'Otro título' where id = '00000000-0000-4000-8000-0000000a93d1'$q$);
  perform pg_temp.google($q$update public.appointments set start_time = start_time where id = '00000000-0000-4000-8000-0000000a93d1'$q$);
  if pg_temp.cola(1) <> '3d2' then raise exception 'AP3 caso 2: un cambio sin mover la cita dejó un apunte (%)', pg_temp.cola(1); end if;
end $$;

-- Caso 3: procesar registra el empalme (el evento d2 pisa la reserva a1) y vacía la cola; repetir no hace nada.
-- La cola de otra clínica no se toca.
do $$
declare v text;
begin
  perform pg_temp.google($q$insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, origen)
    values ('00000000-0000-4000-8000-0000000a93d9', '00000000-0000-4000-8000-0000000a93c2', '00000000-0000-4000-8000-0000000a93b2',
            'Evento de Google en la 2', pg_temp.t(5), pg_temp.t(20), 'google')$q$);
  v := pg_temp.procesar(1);
  if v <> '1/1/false' then raise exception 'AP3 caso 3: procesar dio % (esperaba 1 apunte, 1 par, no quedan)', v; end if;
  if pg_temp.cola(1) <> 'vacía' or pg_temp.cola(2) <> '3d9' then
    raise exception 'AP3 caso 3: tras procesar la clínica 1 las colas son % y % (esperaba vacía y 3d9)', pg_temp.cola(1), pg_temp.cola(2);
  end if;
  if (select count(*) from public.reserva_empalmes_google where clinica_id = '00000000-0000-4000-8000-0000000a93c1'
        and cita_reserva_id = '00000000-0000-4000-8000-0000000a93a1' and cita_otra_id = '00000000-0000-4000-8000-0000000a93d2') <> 1 then
    raise exception 'AP3 caso 3: el empalme no quedó registrado';
  end if;
  v := pg_temp.procesar(1);
  if v <> '0/0/false' then raise exception 'AP3 caso 3: procesar una cola vacía dio %', v; end if;
end $$;

-- Caso 4: si el registro falla, los apuntes SIGUEN en la cola (no se pierden) y la pasada siguiente los procesa.
-- Se provoca con un CHECK imposible sobre reserva_empalmes_google, que el rollback del final deshace.
alter table public.reserva_empalmes_google add constraint ap3_imposible check (false) not valid;
do $$
begin
  begin
    perform pg_temp.procesar(2);
    raise exception 'AP3 caso 4: procesar no falló con el registro roto (la prueba no provocó el fallo)';
  exception when check_violation then
    reset role;
  end;
  if pg_temp.cola(2) <> '3d9' then
    raise exception 'AP3 caso 4: el fallo del registro se llevó el apunte (%)', pg_temp.cola(2);
  end if;
end $$;
alter table public.reserva_empalmes_google drop constraint ap3_imposible;
do $$
declare v text := pg_temp.procesar(2);
begin
  if v <> '1/1/false' then raise exception 'AP3 caso 4: la pasada siguiente dio % (esperaba 1 apunte y 1 par)', v; end if;
end $$;

-- Caso 5: si el apunte no se puede escribir, la cita de Google se escribe igual (con un WARNING).
alter table public.gcal_empalmes_pendientes add constraint ap3_cola_imposible check (false) not valid;
do $$
begin
  perform pg_temp.google($q$insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, origen)
    values ('00000000-0000-4000-8000-0000000a93d5', '00000000-0000-4000-8000-0000000a93c1', '00000000-0000-4000-8000-0000000a93b1',
            'Evento sin apunte', pg_temp.t(300), pg_temp.t(330), 'google')$q$);
  if not exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-0000000a93d5') then
    raise exception 'AP3 caso 5: un fallo al apuntar impidió escribir la cita';
  end if;
  if pg_temp.cola(1) <> 'vacía' then raise exception 'AP3 caso 5: el apunte se escribió a pesar del CHECK'; end if;
end $$;
alter table public.gcal_empalmes_pendientes drop constraint ap3_cola_imposible;

-- Caso 6: el apunte no impide borrar la cita (un evento sin paciente se borra), y el de una cita que ya
-- no existe se descarta al procesarlo. El límite se respeta: con dos apuntes y límite 1, quedan.
do $$
declare r record;
begin
  perform pg_temp.google($q$update public.appointments set start_time = pg_temp.t(310) where id = '00000000-0000-4000-8000-0000000a93d5'$q$);
  perform pg_temp.google($q$update public.appointments set start_time = pg_temp.t(210) where id = '00000000-0000-4000-8000-0000000a93d1'$q$);
  delete from public.appointments where id = '00000000-0000-4000-8000-0000000a93d5';
  if pg_temp.cola(1) <> '3d1,3d5' then raise exception 'AP3 caso 6: cola inesperada (%)', pg_temp.cola(1); end if;
  set local role service_role;
  select * into r from public.reserva_empalmes_pendientes_procesar('00000000-0000-4000-8000-0000000a93c1', 1);
  reset role;
  if (r.r_procesados, r.r_quedan) is distinct from (1, true) then raise exception 'AP3 caso 6: con límite 1 dio %', r; end if;
  if pg_temp.procesar(1) <> '1/0/false' or pg_temp.cola(1) <> 'vacía' then
    raise exception 'AP3 caso 6: el apunte de una cita borrada no se descartó (%)', pg_temp.cola(1);
  end if;
end $$;

-- Caso 7: ninguna sesión ve la cola ni la procesa; service_role no escribe apuntes a mano.
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000a93b1', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform 1 from public.gcal_empalmes_pendientes;
    raise exception 'AP3 caso 7: la sesión leyó la cola';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserva_empalmes_pendientes_procesar('00000000-0000-4000-8000-0000000a93c1', 10);
    raise exception 'AP3 caso 7: la sesión procesó la cola';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role service_role;
  begin
    insert into public.gcal_empalmes_pendientes (clinica_id, cita_id)
    values ('00000000-0000-4000-8000-0000000a93c1', '00000000-0000-4000-8000-0000000a93d1');
    raise exception 'AP3 caso 7: service_role escribió un apunte a mano';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
