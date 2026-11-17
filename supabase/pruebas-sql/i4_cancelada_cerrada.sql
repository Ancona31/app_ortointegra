-- Tanda I, punto 12 (20261121142000_agenda_i4_cancelada_cerrada.sql): una cita CANCELADA que se
-- sustituye queda CERRADA (cerrada_en) y LIGADA a la sustituta (sustituida_por). Sólo el servidor
-- (service_role) cierra; sólo una cancelada; con una sustituta de la MISMA clínica; ninguna nace
-- cerrada; una cerrada no se reabre; la sustituta no se borra mientras la cerrada la señale (FK
-- RESTRICT); cerrar no toca el candado (la incidencia de la cancelación sigue contando) y queda en
-- la auditoría con NOMBRES de columna. postgres queda fuera (semilla, e2e).
-- Mutaciones comprobadas en rojo:
--   · quitar `current_user <> 'service_role' OR` de cita_proteger_cierre → «caso 1: la sesión cerró …»;
--   · quitar el bloque «Ya cerrada» → «caso 4: … reabrió una cerrada»;
--   · la FK con ON DELETE SET NULL en vez de RESTRICT → «caso 6: se borró la sustituta …»;
--   · sin `s.status <> 'cancelled' AND s.cerrada_en IS NULL` en el EXISTS → «caso 3: … sustituta cancelada y cerrada».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000a4cc1', 'I4 cierre'),
  ('00000000-0000-4000-8000-0000000a4cc2', 'I4 cierre vecina');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000a4ca1'::uuid, 'i4c-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000a4ce1'::uuid, 'i4c-secre@prueba.local'),
               ('00000000-0000-4000-8000-0000000a4ca2'::uuid, 'i4c-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a4cc1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a4ca1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a4cc1', role = 'secretaria' where id = '00000000-0000-4000-8000-0000000a4ce1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a4cc2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a4ca2';
-- La v2 APAGADA en las dos: así el borrado de la sustituta no lo para cita_proteger_borrado (seg2) y
-- lo que se ve es la FK.
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000a4cc1', false), ('00000000-0000-4000-8000-0000000a4cc2', false);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000a4cf1', '00000000-0000-4000-8000-0000000a4cc1', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-0000000a4cf2', '00000000-0000-4000-8000-0000000a4cc2', 'Paciente', 'Dos');

create function pg_temp.h(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-i4c', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  ('00000000-0000-4000-8000-0000000a4c0e', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', 'unico', pg_temp.h('u'), 7, now() + interval '7 days');

-- k1: cancelada (venía de una reserva por enlace ya ligada: cuenta para el candado). k2: cancelada.
-- k3: agendada. s1, s2: sustitutas en la clínica 1. v1: una cita de la vecina.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status)
select x.id::uuid, x.cl::uuid, x.med::uuid, x.pac::uuid, 'I4C', now() + interval '3 days', now() + interval '3 days 30 minutes', 'scheduled'
  from (values
    ('00000000-0000-4000-8000-0000000a4d01', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1'),
    ('00000000-0000-4000-8000-0000000a4d02', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1'),
    ('00000000-0000-4000-8000-0000000a4d03', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1'),
    ('00000000-0000-4000-8000-0000000a4d11', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1'),
    ('00000000-0000-4000-8000-0000000a4d12', '00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1'),
    ('00000000-0000-4000-8000-0000000a4d21', '00000000-0000-4000-8000-0000000a4cc2', '00000000-0000-4000-8000-0000000a4ca2', '00000000-0000-4000-8000-0000000a4cf2')
  ) x(id, cl, med, pac);
update public.appointments
   set reserva_canal = 'unico', reserva_enlace_id = '00000000-0000-4000-8000-0000000a4c0e', reserva_nombre = 'Persona Uno',
       reserva_tel_hmac = pg_temp.h('t'), reserva_correo_hmac = pg_temp.h('c'), reserva_aviso_version = 'v1-prueba-i4c',
       reserva_aceptado_en = now(), reserva_historial_previo = 0
 where id = '00000000-0000-4000-8000-0000000a4d01';
update public.appointments set status = 'cancelled'
 where id in ('00000000-0000-4000-8000-0000000a4d01', '00000000-0000-4000-8000-0000000a4d02');

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.servidor() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;

-- Caso 1: la sesión (administrador, secretaria) NO cierra, ni siquiera una cancelada de su clínica.
do $$
declare v_quien uuid;
begin
  if (select count(*) from public.reserva_incidencias where appointment_id = '00000000-0000-4000-8000-0000000a4d01' and anulada_en is null) <> 1 then
    raise exception 'I4C caso 1: la prueba no vale: la cancelación por enlace no dejó su incidencia';
  end if;
  foreach v_quien in array array['00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4ce1']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d11'
       where id = '00000000-0000-4000-8000-0000000a4d01';
      raise exception 'I4C caso 1: la sesión cerró una cancelada (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;

-- Caso 2: el servidor cierra la cancelada con su sustituta: estado intacto, la incidencia del candado
-- sigue viva, y la auditoría lleva los NOMBRES de las dos columnas.
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d11'
   where id = '00000000-0000-4000-8000-0000000a4d01' and clinica_id = '00000000-0000-4000-8000-0000000a4cc1';
  reset role;
  if (select status || '|' || (cerrada_en is not null)::text || '|' || sustituida_por::text
        from public.appointments where id = '00000000-0000-4000-8000-0000000a4d01')
     <> 'cancelled|true|00000000-0000-4000-8000-0000000a4d11' then
    raise exception 'I4C caso 2: la cancelada no quedó cerrada y ligada a su sustituta';
  end if;
  if (select count(*) from public.reserva_incidencias where appointment_id = '00000000-0000-4000-8000-0000000a4d01' and anulada_en is null) <> 1 then
    raise exception 'I4C caso 2: cerrar cambió lo que cuenta para el candado';
  end if;
  if not exists (select 1 from public.audit_log where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-0000000a4d01'
                    and accion = 'cita_editada' and descripcion::jsonb -> 'campos' = '["cerrada_en", "sustituida_por"]'::jsonb) then
    raise exception 'I4C caso 2: el cierre no quedó en la auditoría con sus nombres de columna';
  end if;
end $$;

-- Caso 3: el servidor tampoco cierra una agendada, ni con una sustituta de otra clínica, ni consigo
-- misma, ni con una sola de las dos columnas.
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  begin
    update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d12'
     where id = '00000000-0000-4000-8000-0000000a4d03';
    raise exception 'I4C caso 3: el servidor cerró una AGENDADA';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d21'
     where id = '00000000-0000-4000-8000-0000000a4d02';
    raise exception 'I4C caso 3: el servidor cerró con una sustituta de OTRA clínica';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set cerrada_en = now(), sustituida_por = id where id = '00000000-0000-4000-8000-0000000a4d02';
    raise exception 'I4C caso 3: el servidor cerró una cita consigo misma';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000a4d02';
    raise exception 'I4C caso 3: el servidor cerró sin sustituta';
  exception when insufficient_privilege or check_violation then null;
  end;
  -- Auditoría independiente: la sustituta tiene que estar VIVA (k1 está cancelada y ya cerrada; con
  -- ella k2 quedaría oculta para siempre, y un par A↔B, las dos).
  begin
    update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d01'
     where id = '00000000-0000-4000-8000-0000000a4d02';
    raise exception 'I4C caso 3: el servidor cerró con una sustituta cancelada y cerrada';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 4: una cerrada no se reabre (ni la sesión ni el servidor), ni cambia de sustituta, ni se
-- «abre» quitándole el cierre. Lo demás de la fila (notas, Google) sí se puede escribir.
do $$
declare v_quien text;
begin
  foreach v_quien in array array['sesion', 'servidor'] loop
    if v_quien = 'sesion' then perform pg_temp.como('00000000-0000-4000-8000-0000000a4ca1'); set local role authenticated;
    else perform pg_temp.servidor(); set local role service_role; end if;
    begin
      update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-0000000a4d01';
      raise exception 'I4C caso 4: % reabrió una cerrada', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set cerrada_en = null, sustituida_por = null where id = '00000000-0000-4000-8000-0000000a4d01';
      raise exception 'I4C caso 4: % le quitó el cierre a una cerrada', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set sustituida_por = '00000000-0000-4000-8000-0000000a4d12' where id = '00000000-0000-4000-8000-0000000a4d01';
      raise exception 'I4C caso 4: % cambió la sustituta de una cerrada', v_quien;
    exception when insufficient_privilege then null;
    end;
    update public.appointments set notes = 'nota ' || v_quien, status = 'cancelled' where id = '00000000-0000-4000-8000-0000000a4d01';
    reset role;
  end loop;
end $$;

-- Caso 5: ninguna cita nace cerrada (sesión ni servidor).
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  begin
    insert into public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, cerrada_en, sustituida_por)
    values ('00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1', 'X',
            now(), now() + interval '1 hour', 'cancelled', now(), '00000000-0000-4000-8000-0000000a4d11');
    raise exception 'I4C caso 5: el servidor insertó una cita ya cerrada';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a4ca1');
  set local role authenticated;
  begin
    insert into public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, cerrada_en, sustituida_por)
    values ('00000000-0000-4000-8000-0000000a4cc1', '00000000-0000-4000-8000-0000000a4ca1', '00000000-0000-4000-8000-0000000a4cf1', 'X',
            now(), now() + interval '1 hour', 'cancelled', now(), '00000000-0000-4000-8000-0000000a4d11');
    raise exception 'I4C caso 5: la sesión insertó una cita ya cerrada';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 6: la sustituta no se borra mientras la cerrada la señale (23503, que la API traduce a 409);
-- la cerrada sí se queda. postgres borra las dos en una sola sentencia (lo que hacen la semilla y las e2e).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000a4ca1');
  set local role authenticated;
  begin
    delete from public.appointments where id = '00000000-0000-4000-8000-0000000a4d11';
    raise exception 'I4C caso 6: se borró la sustituta de una cerrada';
  exception when foreign_key_violation then null;
  end;
  reset role;
  delete from public.reserva_incidencias where appointment_id = '00000000-0000-4000-8000-0000000a4d01';
  delete from public.appointments where id in ('00000000-0000-4000-8000-0000000a4d01', '00000000-0000-4000-8000-0000000a4d11');
  if exists (select 1 from public.appointments where id in ('00000000-0000-4000-8000-0000000a4d01', '00000000-0000-4000-8000-0000000a4d11')) then
    raise exception 'I4C caso 6: postgres no pudo borrar la cerrada y su sustituta juntas';
  end if;
end $$;

-- Caso 7: borrar la clínica entera (el CASCADE de clinicas → appointments, como la semilla) no se
-- atasca con una cerrada dentro.
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000a4d12'
   where id = '00000000-0000-4000-8000-0000000a4d02';
  reset role;
  delete from public.appointments where clinica_id = '00000000-0000-4000-8000-0000000a4cc1';
  if exists (select 1 from public.appointments where clinica_id = '00000000-0000-4000-8000-0000000a4cc1') then
    raise exception 'I4C caso 7: no se pudieron borrar las citas de la clínica con una cerrada dentro';
  end if;
end $$;

rollback;
