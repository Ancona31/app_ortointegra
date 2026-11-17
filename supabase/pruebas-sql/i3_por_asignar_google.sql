-- Tanda I, punto 10 (20261121130000_agenda_i3_por_asignar_google.sql): un evento NUEVO de Google
-- que importa el sondeo entra como «por asignar»; «¿No es una cita?» lo pasa a «evento» y ni una
-- sincronización posterior ni la sesión lo devuelven; la sesión no puede crear ni inventar el valor.
-- Mutaciones comprobadas en rojo:
--   · quitar la rama INSERT del disparador (dejar el valor de quien inserta) → «caso 1: … no entró
--     como por_asignar»;
--   · quitar `current_user = 'service_role'` de la rama INSERT → «caso 4: la sesión creó…»;
--   · quitar el RAISE del UPDATE → «caso 3: … volvió a por_asignar»;
--   · quitar `OLD.paciente_id IS NULL` de la excepción → «caso 6: desligó y marcó…».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre, es_vip_grant) values ('00000000-0000-4000-8000-0000000013c1', 'I3 por asignar', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000013a1'::uuid, 'i3-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000013e1'::uuid, 'i3-secre@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000013c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000013a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000013c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000013e1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000013c1', true);
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-0000000013c1', '00000000-0000-4000-8000-0000000013a1', 'clinica', 'cal-i3', 'activa');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to service_role, authenticated;

-- Caso 1: el sondeo (service_role, gcal_importar_evento) importa: uno futuro con hora → por_asignar;
-- uno de todo el día, uno ya terminado → NULL (eventos).
set local role service_role;
do $$
declare v uuid;
begin
  v := public.gcal_importar_evento('00000000-0000-4000-8000-0000000013c1', 'cal-i3', 'i3-futuro', '"f"', now(),
         'Revisión de rodilla', now() + interval '1 day', now() + interval '1 day 30 minutes', false, 'America/Merida',
         'Lo que dice Google', '00000000-0000-4000-8000-0000000013a1');
  insert into _ids values ('futuro', v);
  if (select google_asignacion from public.appointments where id = v) is distinct from 'por_asignar' then
    raise exception 'I3 caso 1: el evento futuro con hora no entró como por_asignar';
  end if;
  v := public.gcal_importar_evento('00000000-0000-4000-8000-0000000013c1', 'cal-i3', 'i3-todo-dia', '"t"', now(),
         'Congreso', (current_date + 2)::timestamp at time zone 'America/Merida', (current_date + 3)::timestamp at time zone 'America/Merida', true,
         'America/Merida', null, '00000000-0000-4000-8000-0000000013a1');
  if (select google_asignacion from public.appointments where id = v) is not null then
    raise exception 'I3 caso 1: un evento de todo el día entró como por asignar';
  end if;
  v := public.gcal_importar_evento('00000000-0000-4000-8000-0000000013c1', 'cal-i3', 'i3-pasado', '"p"', now(),
         'Junta', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', false, 'America/Merida',
         null, '00000000-0000-4000-8000-0000000013a1');
  if (select google_asignacion from public.appointments where id = v) is not null then
    raise exception 'I3 caso 1: un evento ya terminado entró como por asignar';
  end if;
end $$;
reset role;

-- Caso 2: la secretaria, con su sesión, contesta «¿No es una cita?» (por_asignar → evento).
select pg_temp.como('00000000-0000-4000-8000-0000000013e1');
set local role authenticated;
do $$
begin
  update public.appointments set google_asignacion = 'evento' where id = (select id from _ids where clave = 'futuro');
  if not found then raise exception 'I3 caso 2: la secretaria no pudo marcarlo como evento (RLS)'; end if;
  if (select google_asignacion from public.appointments where id = (select id from _ids where clave = 'futuro')) <> 'evento' then
    raise exception 'I3 caso 2: no quedó como evento';
  end if;
end $$;

-- Caso 3: ni la sesión ni el sondeo lo devuelven a por_asignar; ni se quita la marca.
do $$
begin
  begin
    update public.appointments set google_asignacion = 'por_asignar' where id = (select id from _ids where clave = 'futuro');
    raise exception 'I3 caso 3: la sesión lo volvió a por_asignar';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set google_asignacion = null where id = (select id from _ids where clave = 'futuro');
    raise exception 'I3 caso 3: la sesión le quitó la marca';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role service_role;
do $$
declare v_id uuid := (select id from _ids where clave = 'futuro'); v_upd timestamptz;
begin
  begin
    update public.appointments set google_asignacion = 'por_asignar' where id = v_id;
    raise exception 'I3 caso 3: service_role lo volvió a por_asignar';
  exception when insufficient_privilege then null;
  end;
  -- Una edición en Google (título y hora) que aplica el sondeo: la marca sigue siendo evento.
  select updated_at into v_upd from public.appointments where id = v_id;
  if public.gcal_aplicar_evento('00000000-0000-4000-8000-0000000013c1', v_id, v_upd, 'cal-i3', '"f2"', now() + interval '1 minute',
       null, false, now() + interval '1 day 1 hour', now() + interval '1 day 90 minutes', false, 'Revisión de rodilla (editado)',
       false, null, false) <> 1 then
    raise exception 'I3 caso 3: la edición de Google no prendió';
  end if;
  if (select title || '|' || google_asignacion from public.appointments where id = v_id) <> 'Revisión de rodilla (editado)|evento' then
    raise exception 'I3 caso 3: tras la edición de Google quedó %', (select title || '|' || coalesce(google_asignacion, '∅') from public.appointments where id = v_id);
  end if;
  -- Volver a importar el mismo evento no crea otra fila ni toca la marca.
  if public.gcal_importar_evento('00000000-0000-4000-8000-0000000013c1', 'cal-i3', 'i3-futuro', '"f3"', now(),
       'Otra vez', now() + interval '1 day', now() + interval '1 day 30 minutes', false, 'America/Merida', null,
       '00000000-0000-4000-8000-0000000013a1') is not null then
    raise exception 'I3 caso 3: reimportar creó otra fila';
  end if;
end $$;
reset role;

-- Caso 4: la sesión no crea una fila por_asignar (ni evento) a mano: la base pone NULL.
-- Como la secretaria: perfil_completo() (puerta del alta) no le pide cédula ni consultorio. Y con
-- spinus.via = 'google' todavía puesto en esta transacción (lo dejó el caso 1): no basta el GUC.
select pg_temp.como('00000000-0000-4000-8000-0000000013e1');
select set_config('spinus.via', 'google', true);
set local role authenticated;
do $$
declare v uuid;
begin
  insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen, google_asignacion)
  values ('00000000-0000-4000-8000-0000000013c1', '00000000-0000-4000-8000-0000000013a1', 'A mano',
          now() + interval '3 days', now() + interval '3 days 30 minutes', 'scheduled', 'google', 'por_asignar')
  returning id into v;
  if (select google_asignacion from public.appointments where id = v) is not null then
    raise exception 'I3 caso 4: la sesión creó una fila por asignar a mano';
  end if;
  -- Ni marcar como evento una fila que nunca estuvo por asignar.
  begin
    update public.appointments set google_asignacion = 'evento' where id = v;
    raise exception 'I3 caso 4: marcó como evento una fila sin por_asignar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Caso 5: el CHECK: sólo en filas de Google, y sólo los dos valores (como postgres, sin disparador).
do $$
begin
  begin
    insert into public.appointments (clinica_id, title, start_time, end_time, status, origen, google_asignacion)
    values ('00000000-0000-4000-8000-0000000013c1', 'X', now(), now() + interval '1 hour', 'scheduled', 'spinus', 'por_asignar');
    raise exception 'I3 caso 5: una fila de Spinus aceptó por_asignar';
  exception when check_violation then null;
  end;
  begin
    insert into public.appointments (clinica_id, title, start_time, end_time, status, origen, google_asignacion)
    values ('00000000-0000-4000-8000-0000000013c1', 'X', now(), now() + interval '1 hour', 'scheduled', 'google', 'otra');
    raise exception 'I3 caso 5: aceptó un valor fuera de la lista';
  exception when check_violation then null;
  end;
end $$;

-- Caso 6: ligar a un paciente una fila por_asignar no toca la marca (la clasificación va por el paciente).
insert into public.pacientes (id, clinica_id, nombre, apellidos)
values ('00000000-0000-4000-8000-0000000013f1', '00000000-0000-4000-8000-0000000013c1', 'Paciente', 'I3');
set local role service_role;
do $$
declare v uuid;
begin
  v := public.gcal_importar_evento('00000000-0000-4000-8000-0000000013c1', 'cal-i3', 'i3-ligar', '"l"', now(),
         'Ana', now() + interval '4 days', now() + interval '4 days 30 minutes', false, 'America/Merida', null,
         '00000000-0000-4000-8000-0000000013a1');
  insert into _ids values ('ligar', v);
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000013a1');
set local role authenticated;
do $$
begin
  update public.appointments set paciente_id = '00000000-0000-4000-8000-0000000013f1', title = 'Paciente I3'
   where id = (select id from _ids where clave = 'ligar');
  if (select google_asignacion from public.appointments where id = (select id from _ids where clave = 'ligar')) <> 'por_asignar' then
    raise exception 'I3 caso 6: ligar cambió la marca';
  end if;
  -- Ya con paciente, ni siquiera «¿No es una cita?» pasa.
  begin
    update public.appointments set google_asignacion = 'evento' where id = (select id from _ids where clave = 'ligar');
    raise exception 'I3 caso 6: marcó como evento una cita con paciente';
  exception when insufficient_privilege then null;
  end;
  -- Ni desligando el paciente en la misma sentencia (auditoría, hallazgo 2).
  begin
    update public.appointments set paciente_id = null, google_asignacion = 'evento'
     where id = (select id from _ids where clave = 'ligar');
    raise exception 'I3 caso 6: desligó y marcó como evento en una sola sentencia';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
