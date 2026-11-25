-- Integración de la tanda L: los disparadores de appointments de L1 y L2 juntos.
--   · L1 `trg_appointments_horario_bloqueado` (cita_proteger_bloqueo, BEFORE INSERT/UPDATE OF
--     start_time, end_time, medico_id) y L2 (20261124130000: cita_proteger_cierre deja al servidor
--     cerrar una cancelada SIN sustituta, «Eliminar cita»).
--   Caso 1: «Eliminar cita» de una CANCELADA que queda dentro de un bloqueo de su médico funciona
--           (el cierre no mueve inicio, fin ni médico) y la auditoría lleva sólo `cerrada_en`.
--   Caso 2: «Reasignar el horario» hacia dentro del bloqueo, no: la sustituta no nace (42501 del
--           bloqueo) y la cancelada sigue abierta.
--   Caso 3: el orden de los BEFORE (Postgres los dispara por nombre): una cita de enlace (candado de
--           la elección) que la sesión intenta meter en el bloqueo choca PRIMERO con el bloqueo
--           (horario_bloqueado < proteger_eleccion); las dos la rechazarían, y ninguna fila cambia. Lo
--           que prueba el orden es el HINT del rechazo; la consulta a pg_trigger sólo comprueba que
--           los tres disparadores existen.
--   Caso 4: lo mismo que el 1 con un PATCH que repite inicio, fin y médico sin cambiarlos (PostgREST
--           manda la fila entera): el atajo «no se mueve» de L1 la deja pasar.
-- Mutación vista en rojo (integración L): el disparador de L1 sin la lista de columnas y sin el
-- atajo «no se mueve» → «caso 1: … no cerró la cancelada dentro del bloqueo». Cada protección sola
-- basta para el caso 1 (un UPDATE de `cerrada_en` ni dispara `UPDATE OF …`); el atajo solo lo fija el
-- caso 4, que repite inicio, fin y médico y así sí lo dispara.
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre, es_vip_grant) values ('00000000-0000-4000-8000-00000011c001', 'L integración', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000011b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'li-admin@prueba.local', now(), now());
update public.profiles
   set clinica_id = '00000000-0000-4000-8000-00000011c001', es_admin_de_clinica = true, role = 'medico',
       nombres = 'Médico', apellido_paterno = 'LI', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id = '00000000-0000-4000-8000-00000011b001';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000011c001', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-00000011d001', '00000000-0000-4000-8000-00000011c001', '00000000-0000-4000-8000-00000011b001',
   'Consultorio LI', 'LI', 'Calle 1', true, 'America/Mexico_City');
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-00000011e001', '00000000-0000-4000-8000-00000011c001', 'Paciente', 'LI');

-- a1: cancelada a las 10:00 del día 6. a2: cancelada a las 14:00 (para el caso 2). a3: reservada
-- por enlace a las 16:00 (candado de la elección). Como postgres: existen ANTES del bloqueo.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status, consultorio_id, consultorio_nombre, consultorio_timezone)
select x.id::uuid, '00000000-0000-4000-8000-00000011c001', '00000000-0000-4000-8000-00000011b001', '00000000-0000-4000-8000-00000011e001',
       'LI', d + x.h, d + x.h + interval '30 minutes', x.st, '00000000-0000-4000-8000-00000011d001', 'Consultorio LI', 'America/Mexico_City'
  from (select date_trunc('day', now()) + interval '6 days' as d) dd,
       (values ('00000000-0000-4000-8000-00000011a001', interval '10 hours', 'cancelled'),
               ('00000000-0000-4000-8000-00000011a002', interval '14 hours', 'cancelled'),
               ('00000000-0000-4000-8000-00000011a003', interval '16 hours', 'scheduled')) x(id, h, st);
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-li', repeat('d', 64), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-00000011f001', '00000000-0000-4000-8000-00000011c001', '00000000-0000-4000-8000-00000011b001', 'fijo', repeat('c', 64));
update public.appointments
   set reserva_canal = 'fijo', reserva_enlace_id = '00000000-0000-4000-8000-00000011f001', reserva_nombre = 'Persona',
       reserva_telefono = '5544440001', reserva_tel_hmac = repeat('a', 64), reserva_correo_hmac = repeat('b', 64),
       reserva_aviso_version = 'v1-prueba-li', reserva_aceptado_en = now(), reserva_historial_previo = 0
 where id = '00000000-0000-4000-8000-00000011a003';

-- El bloqueo cubre de 09:00 a 12:00 (a1 queda dentro).
insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo)
select '00000000-0000-4000-8000-00000011c001', '00000000-0000-4000-8000-00000011b001',
       date_trunc('day', now()) + interval '6 days 9 hours', date_trunc('day', now()) + interval '6 days 12 hours',
       false, 'America/Mexico_City', 'Congreso';

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.servidor() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;
grant execute on function pg_temp.como(uuid), pg_temp.servidor() to authenticated, service_role;

-- Caso 1: «Eliminar cita» (el UPDATE de POST /api/appointments/[id]/quitar) dentro del bloqueo.
do $$
declare v_hint text;
begin
  perform pg_temp.servidor();
  set local role service_role;
  begin
    update public.appointments set cerrada_en = now()
     where id = '00000000-0000-4000-8000-00000011a001' and clinica_id = '00000000-0000-4000-8000-00000011c001'
       and status = 'cancelled' and cerrada_en is null;
  exception when insufficient_privilege then
    get stacked diagnostics v_hint = pg_exception_hint;
    reset role;
    raise exception 'LI caso 1: no cerró la cancelada dentro del bloqueo (%: %)', coalesce(v_hint, '-'), sqlerrm;
  end;
  reset role;
  if (select cerrada_en is null from public.appointments where id = '00000000-0000-4000-8000-00000011a001') then
    raise exception 'LI caso 1: no cerró la cancelada dentro del bloqueo';
  end if;
  if not exists (select 1 from public.audit_log where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-00000011a001'
                    and accion = 'cita_editada' and descripcion::jsonb -> 'campos' = '["cerrada_en"]'::jsonb) then
    raise exception 'LI caso 1: el cierre no quedó en la auditoría con sólo su columna';
  end if;
end $$;

-- Caso 2: «Reasignar el horario» de a2 hacia dentro del bloqueo: la sustituta (alta con la sesión)
-- choca con el bloqueo y a2 sigue cancelada y abierta.
do $$
declare v_hint text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-00000011b001');
  set local role authenticated;
  begin
    insert into public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, consultorio_id, consultorio_nombre, consultorio_timezone)
    values ('00000000-0000-4000-8000-00000011c001', '00000000-0000-4000-8000-00000011b001', '00000000-0000-4000-8000-00000011e001',
            'LI', date_trunc('day', now()) + interval '6 days 10 hours 30 minutes', date_trunc('day', now()) + interval '6 days 11 hours',
            'scheduled', '00000000-0000-4000-8000-00000011d001', 'Consultorio LI', 'America/Mexico_City');
    reset role;
    raise exception 'LI caso 2: la sustituta nació dentro del bloqueo';
  exception when insufficient_privilege then
    get stacked diagnostics v_hint = pg_exception_hint;
    reset role;
    if v_hint is distinct from 'agenda_horario_bloqueado' then
      raise exception 'LI caso 2: la sustituta se rechazó por otra cosa (%: %)', coalesce(v_hint, '-'), sqlerrm;
    end if;
  end;
  if (select status || '|' || (cerrada_en is null)::text from public.appointments where id = '00000000-0000-4000-8000-00000011a002')
       is distinct from 'cancelled|true' then
    raise exception 'LI caso 2: la cancelada cambió';
  end if;
end $$;

-- Caso 3: el orden. a3 (de enlace, candado de la elección) movida por la sesión a las 10:00, dentro
-- del bloqueo: los BEFORE disparan por nombre y horario_bloqueado va antes que proteger_eleccion.
do $$
declare v_hint text;
begin
  if (select array_agg(tgname order by tgname) from pg_trigger
       where tgrelid = 'public.appointments'::regclass and not tgisinternal and tgtype & 2 = 2
         and tgname in ('trg_appointments_horario_bloqueado', 'trg_appointments_proteger_cierre', 'trg_appointments_proteger_eleccion'))
     is distinct from array['trg_appointments_horario_bloqueado', 'trg_appointments_proteger_cierre', 'trg_appointments_proteger_eleccion']::name[] then
    raise exception 'LI caso 3: falta alguno de los tres disparadores BEFORE';
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-00000011b001');
  set local role authenticated;
  begin
    update public.appointments
       set start_time = date_trunc('day', now()) + interval '6 days 10 hours',
           end_time   = date_trunc('day', now()) + interval '6 days 10 hours 30 minutes'
     where id = '00000000-0000-4000-8000-00000011a003';
    reset role;
    raise exception 'LI caso 3: la cita de enlace se movió al bloqueo';
  exception when insufficient_privilege then
    get stacked diagnostics v_hint = pg_exception_hint;
    reset role;
    if v_hint is distinct from 'agenda_horario_bloqueado' then
      raise exception 'LI caso 3: esperaba que chocara primero con el bloqueo, chocó con %', coalesce(v_hint, '-');
    end if;
  end;
  if (select extract(hour from start_time - date_trunc('day', start_time)) from public.appointments
       where id = '00000000-0000-4000-8000-00000011a003') <> 16 then
    raise exception 'LI caso 3: la cita de enlace cambió de hora';
  end if;
end $$;

-- Caso 4: un PATCH que repite inicio, fin y médico de a2 (dentro del bloqueo tras moverlo como
-- postgres) sin cambiarlos, y la sesión cambia sólo las notas: pasa (L1 «lo que ya estaba dentro»).
update public.appointments
   set start_time = date_trunc('day', now()) + interval '6 days 11 hours',
       end_time   = date_trunc('day', now()) + interval '6 days 11 hours 30 minutes'
 where id = '00000000-0000-4000-8000-00000011a002';
do $$
declare v_hint text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-00000011b001');
  set local role authenticated;
  begin
    update public.appointments a
       set notes = 'LI nota', start_time = a.start_time, end_time = a.end_time, medico_id = a.medico_id
     where id = '00000000-0000-4000-8000-00000011a002';
  exception when insufficient_privilege then
    get stacked diagnostics v_hint = pg_exception_hint;
    reset role;
    raise exception 'LI caso 4: no dejó editar lo que ya estaba dentro (%: %)', coalesce(v_hint, '-'), sqlerrm;
  end;
  reset role;
  if (select notes from public.appointments where id = '00000000-0000-4000-8000-00000011a002') is distinct from 'LI nota' then
    raise exception 'LI caso 4: la nota no se guardó';
  end if;
end $$;

rollback;
