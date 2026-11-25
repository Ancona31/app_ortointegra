-- Agenda C2 — leer el espejo, aplicar e importar desde Google, y «via» en la
-- auditoría de citas (20261113130000_agenda_c2_gcal_aplicar.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base (ni en audit_log) ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- A: VIP, encendida, conexión cal-A. B: encendida, conexión cal-B.
-- D: free degradada, encendida, conexión cal-D. E: apagada, conexión cal-E.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado) values
  ('00000000-0000-4000-8000-00000000c2ca', 'C2 A', true,  null,      'free'),
  ('00000000-0000-4000-8000-00000000c2cb', 'C2 B', true,  null,      'free'),
  ('00000000-0000-4000-8000-00000000c2cd', 'C2 D', false, 'sub_c2d', 'cancelado'),
  ('00000000-0000-4000-8000-00000000c2ce', 'C2 E', true,  null,      'free'),
  ('00000000-0000-4000-8000-00000000c2cf', 'C2 F suspendida', true, null, 'free');
update public.clinicas set suspendida = true where id = '00000000-0000-4000-8000-00000000c2cf';
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-00000000c2a' || x)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'c2-' || x || '@prueba.local', now(), now()
  from unnest(array['a', 'b', 'd', 'e', 'f']) x;
update public.profiles p set clinica_id = ('00000000-0000-4000-8000-00000000c2c' || right(p.id::text, 1))::uuid,
                             es_admin_de_clinica = true
 where p.id::text like '00000000-0000-4000-8000-00000000c2a_';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-00000000c2ca', true), ('00000000-0000-4000-8000-00000000c2cb', true),
  ('00000000-0000-4000-8000-00000000c2cd', true), ('00000000-0000-4000-8000-00000000c2ce', false),
  ('00000000-0000-4000-8000-00000000c2cf', true);
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado)
select ('00000000-0000-4000-8000-00000000c2c' || x)::uuid, ('00000000-0000-4000-8000-00000000c2a' || x)::uuid,
       'clinica', 'cal-' || x, 'activa'
  from unnest(array['a', 'b', 'd', 'e', 'f']) x;
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-00000000c2f1', '00000000-0000-4000-8000-00000000c2ca', 'NombreC2', 'ApellidosC2');

-- Citas de A (todas ligadas a cal-a, updated_at fijo para el comparar-y-cambiar):
--   e1 sin paciente, origen spinus · e2 con paciente · e3 attended · e4 origen google sin paciente
--   e5 cancelada · e6 con paciente, origen google
-- y una de B: eb.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, notes, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id, gcal_etag, origen, consultorio_timezone, updated_at) values
  ('00000000-0000-4000-8000-00000000c2e1', '00000000-0000-4000-8000-00000000c2ca', null, '00000000-0000-4000-8000-00000000c2aa',
   'Junta', 'NotaSpinusE1', '2031-05-06 10:00-06', '2031-05-06 11:00-06', 'scheduled', 'ev1', 'cal-a', '"1"', 'spinus',
   'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e2', '00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2f1',
   '00000000-0000-4000-8000-00000000c2aa', 'NombreC2 ApellidosC2', 'NotaClinicaE2', '2031-05-06 12:00-06', '2031-05-06 12:30-06',
   'confirmed', 'ev2', 'cal-a', '"2"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e3', '00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2f1',
   '00000000-0000-4000-8000-00000000c2aa', 'NombreC2 ApellidosC2', null, '2031-05-07 12:00-06', '2031-05-07 12:30-06',
   'attended', 'ev3', 'cal-a', '"3"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e4', '00000000-0000-4000-8000-00000000c2ca', null, '00000000-0000-4000-8000-00000000c2aa',
   'Comida', 'NotaGoogleE4', '2031-05-08 14:00-06', '2031-05-08 15:00-06', 'scheduled', 'ev4', 'cal-a', '"4"', 'google',
   'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e5', '00000000-0000-4000-8000-00000000c2ca', null, '00000000-0000-4000-8000-00000000c2aa',
   'Viaje', null, '2031-05-09 10:00-06', '2031-05-09 11:00-06', 'cancelled', 'ev5', 'cal-a', '"5"', 'spinus',
   'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e6', '00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2f1',
   '00000000-0000-4000-8000-00000000c2aa', 'Ligado', 'NotaE6', '2031-05-10 10:00-06', '2031-05-10 11:00-06', 'scheduled',
   'ev6', 'cal-a', '"6"', 'google', 'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e7', '00000000-0000-4000-8000-00000000c2ca', null, '00000000-0000-4000-8000-00000000c2aa',
   'SinZona', null, '2031-05-13 10:00-06', '2031-05-13 11:00-06', 'scheduled', 'ev7', 'cal-a', '"7"', 'spinus',
   null, '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2e8', '00000000-0000-4000-8000-00000000c2ca', null, '00000000-0000-4000-8000-00000000c2aa',
   'NoVino', null, '2031-05-14 10:00-06', '2031-05-14 11:00-06', 'no_show', 'ev8', 'cal-a', '"8"', 'spinus',
   'America/Mexico_City', '2031-01-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c2eb', '00000000-0000-4000-8000-00000000c2cb', null, '00000000-0000-4000-8000-00000000c2ab',
   'De B', null, '2031-05-06 10:00-06', '2031-05-06 11:00-06', 'scheduled', 'evb', 'cal-b', '"b"', 'spinus',
   'America/Mexico_City', '2031-01-01 00:00Z');

create function pg_temp.audit(p_cita uuid, p_accion text) returns bigint language sql as $$
  select count(*) from public.audit_log where tabla = 'appointments' and registro_id = p_cita and accion = p_accion
$$;
create function pg_temp.audit_via(p_cita uuid, p_accion text) returns bigint language sql as $$
  select count(*) from public.audit_log where tabla = 'appointments' and registro_id = p_cita and accion = p_accion
     and user_id = 'system' and descripcion::jsonb @> '{"via":"google"}'
$$;
-- aplicar con todos los opcionales en NULL salvo lo que se pase. Orden de la firma real.
create function pg_temp.aplicar(p_clinica uuid, p_cita uuid, p_cal text, p_etag text,
    p_start timestamptz default null, p_end timestamptz default null, p_all_day boolean default null,
    p_title text default null, p_tocar_notas boolean default false, p_notas text default null,
    p_cancelar boolean default false, p_desvincular boolean default false, p_vincular text default null,
    p_esperado timestamptz default '2031-01-01 00:00Z', p_updated timestamptz default '2031-02-01 00:00Z')
returns integer language sql as $$
  select public.gcal_aplicar_evento(p_clinica, p_cita, p_esperado, p_cal, p_etag, p_updated, p_vincular, p_desvincular,
                                    p_start, p_end, p_all_day, p_title, p_tocar_notas, p_notas, p_cancelar)
$$;
grant execute on function pg_temp.aplicar(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text, boolean, text,
                                          boolean, boolean, text, timestamptz, timestamptz) to service_role;
grant execute on function pg_temp.audit(uuid, text) to service_role;
grant execute on function pg_temp.audit_via(uuid, text) to service_role;

-- Caso 1: anon y authenticated no ejecutan las tres RPC (42501)
do $$
declare
  v_rol text;
  v_llamada text;
  v_ok boolean;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_llamada in array array[
        $q$select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c2ca', array['ev1'], null)$q$,
        $q$select public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1',
             '2031-01-01 00:00Z', 'cal-a', '"x"', now(), null, false, null, null, null, 'X', false, null, false)$q$,
        $q$select public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'evx', '"x"', now(), 'X',
             '2031-05-06 10:00-06', '2031-05-06 11:00-06', false, 'America/Mexico_City', null, null)$q$] loop
      v_ok := false;
      begin
        execute format('set local role %I', v_rol);
        execute v_llamada;
      exception when insufficient_privilege then
        v_ok := true;
      end;
      reset role;
      if not v_ok then raise exception 'C2 caso 1: % ejecutó %', v_rol, v_llamada; end if;
    end loop;
  end loop;
end $$;

set local role service_role;

-- Caso 2: el espejo da lo mínimo: título sólo sin paciente, notas sólo de Google sin paciente, nombre sólo con paciente
do $$
declare r record;
begin
  for r in select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c2ca',
                                                      array['ev1', 'ev2', 'ev4', 'ev6', 'evb'], null) loop
    if r.r_id = '00000000-0000-4000-8000-00000000c2e1'
       and (r.r_titulo_sin_paciente, r.r_notas_de_google, r.r_paciente_nombre) is distinct from ('Junta'::text, null::text, null::text) then
      raise exception 'C2 caso 2: e1 (spinus, sin paciente) no da título sin notas ni nombre: %', r;
    elsif r.r_id = '00000000-0000-4000-8000-00000000c2e2'
       and (r.r_titulo_sin_paciente, r.r_notas_de_google, r.r_paciente_nombre, r.r_paciente_apellidos, r.r_con_paciente)
           is distinct from (null::text, null::text, 'NombreC2'::text, 'ApellidosC2'::text, true) then
      raise exception 'C2 caso 2: e2 (con paciente) no da sólo su nombre: %', r;
    elsif r.r_id = '00000000-0000-4000-8000-00000000c2e4'
       and (r.r_titulo_sin_paciente, r.r_notas_de_google) is distinct from ('Comida'::text, 'NotaGoogleE4'::text) then
      raise exception 'C2 caso 2: e4 (google, sin paciente) no da título y notas: %', r;
    elsif r.r_id = '00000000-0000-4000-8000-00000000c2e6' and r.r_notas_de_google is not null then
      raise exception 'C2 caso 2: e6 (google, CON paciente) devuelve sus notas';
    elsif r.r_id = '00000000-0000-4000-8000-00000000c2eb' then
      raise exception 'C2 caso 2: el espejo de A devuelve una cita de B';
    end if;
  end loop;
  if (select count(*) from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c2ca', null,
        array['00000000-0000-4000-8000-00000000c2e1'::uuid, '00000000-0000-4000-8000-00000000c2eb'::uuid])) <> 1 then
    raise exception 'C2 caso 2: por id (spinus_cita), el espejo de A no da sólo la suya';
  end if;
  if exists (select 1 from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c2ce', array['ev1'], null)) then
    raise exception 'C2 caso 2: el espejo responde con el interruptor apagado';
  end if;
end $$;

-- Caso 3: aislamiento y llaves — 0 filas sin tocar nada
do $$
begin
  -- id de A con la cita de B
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2eb', 'cal-a', '"x"', p_title => 'Robado') <> 0 then
    raise exception 'C2 caso 3: A tocó una cita de B';
  end if;
  -- calendario que no es el de la conexión de A
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-b', '"x"', p_title => 'Otro') <> 0 then
    raise exception 'C2 caso 3: aplicó con el calendario de otra clínica';
  end if;
  -- interruptor apagado (E no tiene la cita, pero ni llega a buscar)
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ce', '00000000-0000-4000-8000-00000000c2e1', 'cal-e', '"x"', p_title => 'Apagado') <> 0 then
    raise exception 'C2 caso 3: aplicó con el interruptor apagado';
  end if;
  -- updated_at distinto: Spinus escribió entre medias
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"',
                     p_title => 'Tarde', p_esperado => '2030-12-31 00:00Z') <> 0 then
    raise exception 'C2 caso 3: el comparar-y-cambiar prendió con un updated_at viejo';
  end if;
  if (select title from public.appointments where id = '00000000-0000-4000-8000-00000000c2e1') <> 'Junta'
     or (select title from public.appointments where id = '00000000-0000-4000-8000-00000000c2eb') <> 'De B' then
    raise exception 'C2 caso 3: algo se escribió';
  end if;
end $$;

-- Caso 4: sólo el etag → ninguna fila de audit_log; queda synced con el etag nuevo
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"1b"') <> 1 then
    raise exception 'C2 caso 4: el solo-etag no prendió';
  end if;
  if (select (gcal_etag, gcal_sync_status, updated_at) is distinct from ('"1b"'::text, 'synced'::text, '2031-01-01 00:00Z'::timestamptz)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e1') then
    raise exception 'C2 caso 4: el solo-etag no dejó etag nuevo, synced y el updated_at de antes';
  end if;
  if pg_temp.audit('00000000-0000-4000-8000-00000000c2e1', 'cita_editada') <> 0 then
    raise exception 'C2 caso 4: un cambio sólo de etag dejó auditoría';
  end if;
end $$;

-- Caso 5: mover y retitular sin paciente → cita_editada via google, user system, updated_at = el de Google
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"1c"',
                     '2031-05-06 16:00-06', '2031-05-06 17:00-06', false, 'Junta movida') <> 1 then
    raise exception 'C2 caso 5: mover no prendió';
  end if;
  if (select (start_time, title, notes, updated_at)
            is distinct from ('2031-05-06 16:00-06'::timestamptz, 'Junta movida'::text, 'NotaSpinusE1'::text, '2031-02-01 00:00Z'::timestamptz)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e1') then
    raise exception 'C2 caso 5: la fila no quedó movida y retitulada con updated_at de Google';
  end if;
  if pg_temp.audit_via('00000000-0000-4000-8000-00000000c2e1', 'cita_editada') <> 1 then
    raise exception 'C2 caso 5: falta cita_editada con via=google y user system';
  end if;
end $$;

-- Caso 6 (S1): notas — sólo origen google sin paciente; spinus sin paciente y google con paciente no cambian
do $$
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"1d"',
                          p_tocar_notas => true, p_notas => 'Pisada', p_esperado => '2031-02-01 00:00Z');
  if (select notes from public.appointments where id = '00000000-0000-4000-8000-00000000c2e1') <> 'NotaSpinusE1' then
    raise exception 'C2 caso 6: una cita de Spinus sin paciente aceptó notas de Google';
  end if;
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e4', 'cal-a', '"4b"',
                          p_tocar_notas => true, p_notas => '  Nota nueva  ');
  if (select notes from public.appointments where id = '00000000-0000-4000-8000-00000000c2e4') <> 'Nota nueva' then
    raise exception 'C2 caso 6: un evento de Google sin paciente no recibió su descripción';
  end if;
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e6', 'cal-a', '"6b"',
                          p_tocar_notas => true, p_notas => 'Pisada');
  if (select notes from public.appointments where id = '00000000-0000-4000-8000-00000000c2e6') <> 'NotaE6' then
    raise exception 'C2 caso 6: un evento de Google YA LIGADO a paciente aceptó notas';
  end if;
end $$;

-- Caso 7 (C-d): con paciente no cambia de título ni pasa a todo el día; de hora a hora sí
do $$
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e2', 'cal-a', '"2b"',
                          '2031-05-06 00:00-06', '2031-05-07 00:00-06', true, 'Retitulada en Google');
  if (select (title, all_day, start_time) is distinct from ('NombreC2 ApellidosC2'::text, false, '2031-05-06 12:00-06'::timestamptz)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e2') then
    raise exception 'C2 caso 7: una cita con paciente cambió de título o pasó a todo el día';
  end if;
  -- Lo descartado no cuenta como cambio: updated_at no se mueve.
  if (select updated_at from public.appointments where id = '00000000-0000-4000-8000-00000000c2e2') <> '2031-01-01 00:00Z' then
    raise exception 'C2 caso 7: un cambio descartado movió updated_at';
  end if;
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e2', 'cal-a', '"2c"',
                          '2031-05-06 13:00-06', '2031-05-06 13:30-06', false);
  if (select start_time from public.appointments where id = '00000000-0000-4000-8000-00000000c2e2') <> '2031-05-06 13:00-06' then
    raise exception 'C2 caso 7: una cita con paciente no se movió de hora a hora';
  end if;
end $$;

-- Caso 8 (C-e): attended y cancelled sólo reciben columnas técnicas; nunca se reactiva
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e3', 'cal-a', '"3b"',
                     '2031-05-07 15:00-06', '2031-05-07 15:30-06', p_cancelar => true) <> 1 then
    raise exception 'C2 caso 8: ni siquiera el etag prendió en la attended';
  end if;
  if (select (status, start_time, gcal_etag) is distinct from ('attended'::text, '2031-05-07 12:00-06'::timestamptz, '"3b"'::text)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e3') then
    raise exception 'C2 caso 8: una cita attended cambió de contenido desde Google';
  end if;
  if pg_temp.audit('00000000-0000-4000-8000-00000000c2e3', 'cita_editada') + pg_temp.audit('00000000-0000-4000-8000-00000000c2e3', 'cita_cancelada') <> 0 then
    raise exception 'C2 caso 8: la attended dejó auditoría de contenido';
  end if;
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e5', 'cal-a', '"5b"',
                          '2031-05-09 12:00-06', '2031-05-09 13:00-06', p_title => 'Viaje restaurado');
  if (select (status, title) is distinct from ('cancelled'::text, 'Viaje'::text)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e5') then
    raise exception 'C2 caso 8: una cancelada cambió o se reactivó desde Google';
  end if;
end $$;

-- Caso 9: borrado en Google → cancelada y desvinculada, cita_cancelada via google; la fila sigue
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e4', 'cal-a', null,
                     p_cancelar => true, p_desvincular => true, p_esperado => '2031-02-01 00:00Z', p_updated => '2031-03-01 00:00Z') <> 1 then
    raise exception 'C2 caso 9: el borrado no prendió';
  end if;
  if (select (status, google_event_id, gcal_calendar_id, gcal_etag, gcal_sync_status)
            is distinct from ('cancelled'::text, null::text, null::text, null::text, 'unbound'::text)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e4') then
    raise exception 'C2 caso 9: el borrado no dejó cancelada y desvinculada';
  end if;
  if pg_temp.audit_via('00000000-0000-4000-8000-00000000c2e4', 'cita_cancelada') <> 1 then
    raise exception 'C2 caso 9: falta cita_cancelada con via=google';
  end if;
end $$;

-- Caso 10: vincular por spinus_cita una fila sin evento; no pisa un vínculo ajeno
reset role;
update public.appointments set google_event_id = null, gcal_calendar_id = null
 where id = '00000000-0000-4000-8000-00000000c2e6';
set local role service_role;
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e6', 'cal-a', '"6c"',
                     p_vincular => 'ev6-nuevo') <> 1 then
    raise exception 'C2 caso 10: no vinculó una fila sin evento';
  end if;
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e6', 'cal-a', '"6d"',
                     p_vincular => 'otro-evento') <> 0 then
    raise exception 'C2 caso 10: vincular pisó un vínculo que ya tenía';
  end if;
  if (select google_event_id from public.appointments where id = '00000000-0000-4000-8000-00000000c2e6') <> 'ev6-nuevo' then
    raise exception 'C2 caso 10: el vínculo quedó mal';
  end if;
end $$;

-- Caso 11: importar — dos veces deja 1 fila origen google, via google; médico de otra clínica = NULL
do $$
declare v_id uuid; v_id2 uuid; r record;
begin
  v_id := public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'ev-nuevo', '"n1"', '2031-02-02 00:00Z',
                                      '  Cirugía  ', '2031-05-11 08:00-06', '2031-05-11 10:00-06', false, 'America/Mexico_City',
                                      ' Quirófano 2 ', '00000000-0000-4000-8000-00000000c2ab');
  if v_id is null then raise exception 'C2 caso 11: la importación no devolvió id'; end if;
  v_id2 := public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'ev-nuevo', '"n2"', '2031-02-03 00:00Z',
                                       'Otra', '2031-05-11 08:00-06', '2031-05-11 10:00-06', false, 'America/Mexico_City',
                                       null, '00000000-0000-4000-8000-00000000c2aa');
  if v_id2 is not null then raise exception 'C2 caso 11: la segunda importación no fue no-op'; end if;
  select * into r from public.appointments where clinica_id = '00000000-0000-4000-8000-00000000c2ca' and google_event_id = 'ev-nuevo';
  if (r.id, r.origen, r.title, r.notes, r.medico_id, r.paciente_id, r.status, r.gcal_etag, r.updated_at)
     is distinct from (v_id, 'google'::text, 'Cirugía'::text, 'Quirófano 2'::text, null::uuid, null::uuid, 'scheduled'::text,
                       '"n1"'::text, '2031-02-02 00:00Z'::timestamptz) then
    raise exception 'C2 caso 11: la fila importada no es la esperada: %', r;
  end if;
  if pg_temp.audit_via(v_id, 'cita_alta') <> 1 then raise exception 'C2 caso 11: falta cita_alta con via=google'; end if;
  -- Todo el día, con el dueño de la conexión como médico.
  v_id := public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'ev-dia', '"d1"', null, 'Congreso',
                                      '2031-05-12 00:00-06', '2031-05-14 00:00-06', true, 'America/Mexico_City', null,
                                      '00000000-0000-4000-8000-00000000c2aa');
  if (select (all_day, medico_id) is distinct from (true, '00000000-0000-4000-8000-00000000c2aa'::uuid)
        from public.appointments where id = v_id) then
    raise exception 'C2 caso 11: el de todo el día no quedó con all_day y el dueño como médico';
  end if;
end $$;

-- Caso 12: importar en una clínica degradada, apagada o con calendario ajeno → NULL, sin fila
do $$
begin
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2cd', 'cal-d', 'ev-d', '"d"', null, 'X',
       '2031-05-11 08:00-06', '2031-05-11 09:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C2 caso 12: importó en una clínica free degradada';
  end if;
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ce', 'cal-e', 'ev-e', '"e"', null, 'X',
       '2031-05-11 08:00-06', '2031-05-11 09:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C2 caso 12: importó con el interruptor apagado';
  end if;
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-b', 'ev-ajeno', '"x"', null, 'X',
       '2031-05-11 08:00-06', '2031-05-11 09:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C2 caso 12: importó en A con el calendario de B';
  end if;
  begin
    perform public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'ev-tz', '"x"', null, 'X',
       '2031-05-11 08:00-06', '2031-05-11 09:00-06', false, 'Marte/Olympus', null, null);
    raise exception 'C2 caso 12: aceptó una zona horaria inventada';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.appointments where google_event_id in ('ev-d', 'ev-e', 'ev-ajeno', 'ev-tz')) then
    raise exception 'C2 caso 12: quedó alguna fila';
  end if;
end $$;

-- Caso 14: sin paciente, de hora a todo el día: con zona sí; sin zona la hora no se toca (CHECK)
do $$
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"1e"',
                          '2031-05-06 00:00-06', '2031-05-07 00:00-06', true, p_esperado => '2031-02-01 00:00Z');
  if (select (all_day, start_time) is distinct from (true, '2031-05-06 00:00-06'::timestamptz)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e1') then
    raise exception 'C2 caso 14: sin paciente y con zona no pasó a todo el día';
  end if;
  if pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e7', 'cal-a', '"7b"',
                     '2031-05-13 00:00-06', '2031-05-14 00:00-06', true) <> 1 then
    raise exception 'C2 caso 14: sin zona, ni el etag prendió (¿tronó la CHECK?)';
  end if;
  if (select (all_day, start_time, gcal_etag) is distinct from (false, '2031-05-13 10:00-06'::timestamptz, '"7b"'::text)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e7') then
    raise exception 'C2 caso 14: sin zona, la hora o el todo-el-día cambiaron';
  end if;
end $$;

-- Caso 15: no_show tampoco cambia (C-e); y los argumentos imposibles se rechazan (22023)
do $$
declare v_llamada text;
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e8', 'cal-a', '"8b"',
                          '2031-05-14 12:00-06', '2031-05-14 13:00-06', p_title => 'Otro', p_cancelar => true);
  if (select (status, title, start_time) is distinct from ('no_show'::text, 'NoVino'::text, '2031-05-14 10:00-06'::timestamptz)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c2e8') then
    raise exception 'C2 caso 15: una no_show cambió desde Google';
  end if;
  foreach v_llamada in array array[
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"', p_desvincular => true, p_vincular => 'y')$q$,
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"', p_start => now())$q$,
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"', now(), now() - interval '1 hour')$q$,
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', null)$q$,
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"', p_title => repeat('x', 501))$q$,
      $q$select pg_temp.aplicar('00000000-0000-4000-8000-00000000c2ca', '00000000-0000-4000-8000-00000000c2e1', 'cal-a', '"x"', p_tocar_notas => true, p_notas => repeat('x', 5001))$q$,
      $q$select * from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c2ca', array_fill('x'::text, array[2501]), null)$q$,
      $q$select public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2ca', 'cal-a', 'ev-z', '"z"', null, 'X',
           '2031-05-11 09:00-06', '2031-05-11 08:00-06', false, 'America/Mexico_City', null, null)$q$] loop
    begin
      execute v_llamada;
      raise exception 'C2 caso 15: se aceptó %', v_llamada;
    exception when invalid_parameter_value then null;
    end;
  end loop;
end $$;

-- Caso 16: importar en una clínica SUSPENDIDA (aunque VIP) → NULL (clinica_no_suspendida, S3)
do $$
begin
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c2cf', 'cal-f', 'ev-f', '"f"', null, 'X',
       '2031-05-11 08:00-06', '2031-05-11 09:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C2 caso 16: importó en una clínica suspendida';
  end if;
end $$;

-- Caso 13: con sesión, el GUC no hace «via»: authenticated no puede fingir que vino de Google
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-00000000c2aa', 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('spinus.via', 'google', true);
update public.appointments set title = 'Editada en Spinus' where id = '00000000-0000-4000-8000-00000000c2e5';
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  if (select count(*) from public.audit_log where registro_id = '00000000-0000-4000-8000-00000000c2e5'
        and accion = 'cita_editada' and user_id = '00000000-0000-4000-8000-00000000c2aa'
        and not (descripcion::jsonb ? 'via')) <> 1 then
    raise exception 'C2 caso 13: una edición con sesión y el GUC puesto quedó marcada via o sin su usuario';
  end if;
end $$;

rollback;
