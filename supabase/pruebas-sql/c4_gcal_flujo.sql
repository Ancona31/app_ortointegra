-- Agenda C4 — el flujo del orquestador (src/lib/gcalSincronizacion.ts) contra
-- las RPC de verdad de C1 y C2, en la base local y como service_role: dos
-- páginas de una completa, incremental, 410, eco, presupuesto agotado, dos
-- pasadas a la vez, comparar-y-cambiar y el interruptor apagado a media vida.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base (ni en audit_log) ni depende de la semilla.
begin;

insert into public.clinicas (id, nombre, es_vip_grant) values ('00000000-0000-4000-8000-00000000c4c1', 'C4 flujo', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c4a1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'c4-admin@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000000c4c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-00000000c4a1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000000c4c1', true);
insert into public.clinica_conexiones_google (id, clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-00000000c4e0', '00000000-0000-4000-8000-00000000c4c1',
   '00000000-0000-4000-8000-00000000c4a1', 'clinica', 'cal-c4', 'activa');
-- Dos citas de Spinus ya ligadas a Google.
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, status, google_event_id,
                                 gcal_calendar_id, gcal_etag, consultorio_timezone, updated_at) values
  ('00000000-0000-4000-8000-00000000c4f1', '00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4a1',
   'Junta', '2031-06-06 10:00-06', '2031-06-06 11:00-06', 'scheduled', 'ev1', 'cal-c4', '"1"', 'America/Mexico_City',
   '2031-05-01 00:00Z'),
  ('00000000-0000-4000-8000-00000000c4f2', '00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4a1',
   'Comida', '2031-06-07 14:00-06', '2031-06-07 15:00-06', 'confirmed', 'ev2', 'cal-c4', '"2"', 'America/Mexico_City',
   '2031-05-01 00:00Z');

-- El testigo de la pasada en curso, entre bloques DO.
create temp table c4_pasada (candado uuid);
grant all on c4_pasada to service_role;

create function pg_temp.audit_de(p_cita uuid) returns bigint language sql as $$
  select count(*) from public.audit_log where tabla = 'appointments' and registro_id = p_cita
$$;
grant execute on function pg_temp.audit_de(uuid) to service_role;

set local role service_role;

-- Pasada 1, página 1: tomar (completa), leer el espejo, mover ev1, importar uno nuevo, avanzar a p2
do $$
declare
  t record;
  v_espejo integer;
  v_id uuid;
begin
  select * into t from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
    '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 60);
  if t.r_candado is null or t.r_fase <> 'completa' or t.r_sync_token is not null then
    raise exception 'C4 paso 1: no tomó una completa nueva: %', t;
  end if;
  insert into c4_pasada values (t.r_candado);
  select count(*) into v_espejo from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c4c1',
    array['ev1', 'nuevo'], null);
  if v_espejo <> 1 then raise exception 'C4 paso 1: el espejo no dio sólo ev1'; end if;
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4f1',
       '2031-05-01 00:00Z', 'cal-c4', '"1b"', '2031-05-20 00:00Z', null, false,
       '2031-06-06 12:00-06', '2031-06-06 13:00-06', false, null, false, null, false) <> 1 then
    raise exception 'C4 paso 1: mover ev1 no prendió';
  end if;
  v_id := public.gcal_importar_evento('00000000-0000-4000-8000-00000000c4c1', 'cal-c4', 'nuevo', '"n"',
    '2031-05-21 00:00Z', 'Cirugía', '2031-06-08 08:00-06', '2031-06-08 10:00-06', false, 'America/Mexico_City',
    null, '00000000-0000-4000-8000-00000000c4a1');
  if v_id is null then raise exception 'C4 paso 1: no importó'; end if;
  if not public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c4c1', t.r_candado, 'p2', null,
       '2031-05-02 00:00Z', 60) then
    raise exception 'C4 paso 1: avanzar a p2 no prendió';
  end if;
end $$;

-- Dos pasadas a la vez: la segunda no toma mientras la primera tenga el candado
do $$
begin
  if exists (select 1 from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
               '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 0)) then
    raise exception 'C4 paso 2: una segunda pasada tomó el candado vivo';
  end if;
end $$;

-- Pasada 1, página 2: borrado de ev2 (cancela y desvincula) y token final
do $$
declare v_candado uuid := (select candado from c4_pasada);
begin
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4f2',
       '2031-05-01 00:00Z', 'cal-c4', null, '2031-05-22 00:00Z', null, true,
       null, null, null, null, false, null, true) <> 1 then
    raise exception 'C4 paso 3: el borrado no prendió';
  end if;
  if not public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c4c1', v_candado, null, 'tok-1', now(), 60) then
    raise exception 'C4 paso 3: el token final no prendió';
  end if;
end $$;
reset role;
do $$
begin
  if (select (fase, sync_token, page_token, candado, ventana_desde)
            is distinct from ('incremental'::text, 'tok-1'::text, null::text, null::uuid, '2031-05-02 00:00Z'::timestamptz)
        from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c4c1') then
    raise exception 'C4 paso 3: el estado no quedó incremental con tok-1 y la ventana de la primera página';
  end if;
  if (select (status, google_event_id, gcal_sync_status) is distinct from ('cancelled'::text, null::text, 'unbound'::text)
        from public.appointments where id = '00000000-0000-4000-8000-00000000c4f2') then
    raise exception 'C4 paso 3: ev2 no quedó cancelada y desvinculada';
  end if;
end $$;
set local role service_role;

-- Eco: la misma lectura otra vez (mismo etag, mismas puntas) no deja auditoría
do $$
declare v_antes bigint := pg_temp.audit_de('00000000-0000-4000-8000-00000000c4f1');
begin
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4f1',
       '2031-05-20 00:00Z', 'cal-c4', '"1b"', '2031-05-20 00:00Z', null, false,
       '2031-06-06 12:00-06', '2031-06-06 13:00-06', false, null, false, null, false) <> 1 then
    raise exception 'C4 paso 4: el eco no prendió (sólo columnas técnicas)';
  end if;
  if pg_temp.audit_de('00000000-0000-4000-8000-00000000c4f1') <> v_antes then
    raise exception 'C4 paso 4: un eco dejó auditoría';
  end if;
end $$;

-- 410: la pasada incremental reinicia; reimportar es no-op (idempotente); token nuevo
reset role;
update public.gcal_sync_estado set ultima_ok = now() - interval '2 minutes'
 where clinica_id = '00000000-0000-4000-8000-00000000c4c1';
set local role service_role;
do $$
declare t record;
begin
  select * into t from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
    '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 60);
  if t.r_fase <> 'incremental' or t.r_sync_token <> 'tok-1' then raise exception 'C4 paso 5: no retomó incremental'; end if;
  if not public.gcal_sync_reiniciar('00000000-0000-4000-8000-00000000c4c1', t.r_candado) then
    raise exception 'C4 paso 5: reiniciar no prendió';
  end if;
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c4c1', 'cal-c4', 'nuevo', '"n2"', null, 'Otra',
       '2031-06-08 08:00-06', '2031-06-08 10:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C4 paso 5: reimportar tras el 410 duplicó';
  end if;
  if not public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c4c1', t.r_candado, null, 'tok-2', now(), 60) then
    raise exception 'C4 paso 5: token tras el 410 no prendió';
  end if;
  if (select count(*) from public.appointments where clinica_id = '00000000-0000-4000-8000-00000000c4c1'
        and google_event_id = 'nuevo') <> 1 then
    raise exception 'C4 paso 5: quedaron dos filas del mismo evento';
  end if;
end $$;

-- Presupuesto agotado: soltar sin error conserva la página y se retoma aunque no pase el intervalo
reset role;
update public.gcal_sync_estado set ultima_ok = now() - interval '2 minutes'
 where clinica_id = '00000000-0000-4000-8000-00000000c4c1';
set local role service_role;
do $$
declare t record; t2 record;
begin
  select * into t from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
    '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 60);
  perform public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c4c1', t.r_candado, 'p-pendiente', null, null, 60);
  perform public.gcal_sync_soltar('00000000-0000-4000-8000-00000000c4c1', t.r_candado, null);
  select * into t2 from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
    '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 3600);
  if t2.r_page_token is distinct from 'p-pendiente' or t2.r_sync_token <> 'tok-2' then
    raise exception 'C4 paso 6: no retomó la página pendiente: %', t2;
  end if;
  if (select errores_seguidos from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c4c1') <> 0 then
    raise exception 'C4 paso 6: el presupuesto agotado contó como error';
  end if;
  -- El candado caduca a media pasada: avanzar ya no prende.
  delete from c4_pasada;
  insert into c4_pasada values (t2.r_candado);
end $$;
reset role;
update public.gcal_sync_estado set candado_hasta = now() - interval '1 second'
 where clinica_id = '00000000-0000-4000-8000-00000000c4c1';
set local role service_role;
do $$
begin
  if public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c4c1', (select candado from c4_pasada), null, 'tok-3', null, 60) then
    raise exception 'C4 paso 6: avanzó con un candado caducado';
  end if;
end $$;

-- Comparar-y-cambiar: Spinus edita entre la lectura del espejo y la escritura → 0 filas, gana Spinus
do $$
declare v_leido timestamptz;
begin
  select r_updated_at into v_leido from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c4c1', array['ev1'], null);
  update public.appointments set title = 'Junta (Spinus)', updated_at = now()
   where id = '00000000-0000-4000-8000-00000000c4f1' and clinica_id = '00000000-0000-4000-8000-00000000c4c1';
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4f1',
       v_leido, 'cal-c4', '"1c"', '2031-05-23 00:00Z', null, false, null, null, null, 'Junta (Google)', false, null, false) <> 0 then
    raise exception 'C4 paso 7: pisó una edición de Spinus posterior a la lectura';
  end if;
  if (select title from public.appointments where id = '00000000-0000-4000-8000-00000000c4f1') <> 'Junta (Spinus)' then
    raise exception 'C4 paso 7: el título de Spinus no se conservó';
  end if;
end $$;

-- Dos clínicas: con el p_clinica_id de otra clínica (encendida, con su conexión) no se ve ni se toca nada de ésta
reset role;
insert into public.clinicas (id, nombre, es_vip_grant) values ('00000000-0000-4000-8000-00000000c4c2', 'C4 otra', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c4a2', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'c4-otra@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000000c4c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-00000000c4a2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000000c4c2', true);
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-00000000c4c2', '00000000-0000-4000-8000-00000000c4a2', 'clinica', 'cal-c4-otra', 'activa');
set local role service_role;
do $$
begin
  if exists (select 1 from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c4c2', array['ev1', 'nuevo'],
               array['00000000-0000-4000-8000-00000000c4f1'::uuid])) then
    raise exception 'C4 paso 7-bis: la otra clínica ve las citas de ésta';
  end if;
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c2', '00000000-0000-4000-8000-00000000c4f1',
       (select updated_at from public.appointments where id = '00000000-0000-4000-8000-00000000c4f1'),
       'cal-c4-otra', '"x"', now(), null, false, null, null, null, 'Robada', false, null, true) <> 0 then
    raise exception 'C4 paso 7-bis: la otra clínica tocó una cita de ésta';
  end if;
  -- Importar el mismo id de evento en la otra clínica crea SU fila, sin tocar la de ésta.
  if public.gcal_importar_evento('00000000-0000-4000-8000-00000000c4c2', 'cal-c4-otra', 'nuevo', '"o"', null, 'De la otra',
       '2031-06-08 08:00-06', '2031-06-08 10:00-06', false, 'America/Mexico_City', null, null) is null then
    raise exception 'C4 paso 7-bis: el índice (clinica_id, google_event_id) cruzó clínicas';
  end if;
  if (select title from public.appointments where clinica_id = '00000000-0000-4000-8000-00000000c4c1' and google_event_id = 'nuevo') <> 'Cirugía'
     or (select status from public.appointments where id = '00000000-0000-4000-8000-00000000c4f1') <> 'scheduled' then
    raise exception 'C4 paso 7-bis: algo de esta clínica cambió';
  end if;
end $$;

-- Interruptor apagado a media vida: todo deja de correr, sin errores
reset role;
update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-00000000c4c1';
update public.gcal_sync_estado set candado = null, candado_hasta = null where clinica_id = '00000000-0000-4000-8000-00000000c4c1';
set local role service_role;
do $$
begin
  if exists (select 1 from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c4c1',
               '00000000-0000-4000-8000-00000000c4e0', 'cal-c4', 60, 0))
     or exists (select 1 from public.gcal_citas_por_evento('00000000-0000-4000-8000-00000000c4c1', array['ev1'], null))
     or exists (select 1 from public.gcal_sync_clinicas_pendientes(100) where r_clinica_id = '00000000-0000-4000-8000-00000000c4c1')
     or public.gcal_aplicar_evento('00000000-0000-4000-8000-00000000c4c1', '00000000-0000-4000-8000-00000000c4f1',
          now(), 'cal-c4', '"x"', now(), null, false, null, null, null, 'Apagado', false, null, false) <> 0
     or public.gcal_importar_evento('00000000-0000-4000-8000-00000000c4c1', 'cal-c4', 'otro', '"o"', null, 'X',
          '2031-06-09 08:00-06', '2031-06-09 09:00-06', false, 'America/Mexico_City', null, null) is not null then
    raise exception 'C4 paso 8: algo corrió con el interruptor apagado';
  end if;
end $$;

reset role;
rollback;
