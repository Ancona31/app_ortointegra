-- Tanda L, punto 9 (20261124130000_agenda_l2_eliminar_cancelada.sql): «Eliminar cita» de una
-- CANCELADA la CIERRA sin sustituta (no la borra). Sólo el servidor (service_role) cierra; sólo una
-- cancelada que sigue cancelada; la sesión no; una cerrada sin sustituta no se reabre ni se le pone
-- sustituta después; el cierre con sustituta (tanda I) sigue igual; la auditoría lleva el NOMBRE de
-- la columna; cita_proteger_borrado sigue impidiendo BORRARLA con la v2 encendida.
-- Mutaciones comprobadas en rojo:
--   · la condición vieja `OR NEW.sustituida_por IS NULL` de vuelta en cita_proteger_cierre → «caso 2: … no cerró»;
--   · quitar `current_user <> 'service_role' OR` → «caso 1: la sesión cerró …»;
--   · el CHECK sin `status = 'cancelled'` → «caso 6: el CHECK dejó cerrar una AGENDADA».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-0000000b2cc1', 'L2 quitar');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000b2ca1'::uuid, 'l2q-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000b2ce1'::uuid, 'l2q-secre@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000b2cc1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000b2ca1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000b2cc1', role = 'secretaria' where id = '00000000-0000-4000-8000-0000000b2ce1';
-- La v2 ENCENDIDA: así cita_proteger_borrado veta el borrado de una cita con paciente (caso 5).
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000b2cc1', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000b2cf1', '00000000-0000-4000-8000-0000000b2cc1', 'Paciente', 'Uno');

-- q1, q2: canceladas. q3: agendada. q4: sustituta viva de q2.
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status)
select x.id::uuid, '00000000-0000-4000-8000-0000000b2cc1', '00000000-0000-4000-8000-0000000b2ca1', '00000000-0000-4000-8000-0000000b2cf1',
       'L2Q', now() + interval '3 days', now() + interval '3 days 30 minutes', x.st
  from (values ('00000000-0000-4000-8000-0000000b2d01', 'cancelled'), ('00000000-0000-4000-8000-0000000b2d02', 'cancelled'),
               ('00000000-0000-4000-8000-0000000b2d03', 'scheduled'), ('00000000-0000-4000-8000-0000000b2d04', 'scheduled')) x(id, st);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.servidor() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;

-- Caso 1: la sesión (administrador, secretaria) NO cierra sin sustituta, ni siquiera una cancelada suya.
do $$
declare v_quien uuid;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000b2ca1', '00000000-0000-4000-8000-0000000b2ce1']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000b2d01';
      raise exception 'L2Q caso 1: la sesión cerró una cancelada sin sustituta (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;

-- Caso 2: el servidor cierra la cancelada SIN sustituta: sigue cancelada, en la base, y la auditoría
-- del disparador lleva sólo el NOMBRE de la columna.
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  update public.appointments set cerrada_en = now()
   where id = '00000000-0000-4000-8000-0000000b2d01' and clinica_id = '00000000-0000-4000-8000-0000000b2cc1'
     and status = 'cancelled' and cerrada_en is null;
  reset role;
  if (select status || '|' || (cerrada_en is not null)::text || '|' || coalesce(sustituida_por::text, 'sin')
        from public.appointments where id = '00000000-0000-4000-8000-0000000b2d01') is distinct from 'cancelled|true|sin' then
    raise exception 'L2Q caso 2: el servidor no cerró la cancelada sin sustituta';
  end if;
  if not exists (select 1 from public.audit_log where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-0000000b2d01'
                    and accion = 'cita_editada' and descripcion::jsonb -> 'campos' = '["cerrada_en"]'::jsonb) then
    raise exception 'L2Q caso 2: el cierre no quedó en la auditoría con el nombre de su columna';
  end if;
end $$;

-- Caso 3: el servidor no cierra una AGENDADA, ni pone una sustituta sin cierre.
do $$
begin
  perform pg_temp.servidor();
  set local role service_role;
  begin
    update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000b2d03';
    raise exception 'L2Q caso 3: el servidor cerró una AGENDADA';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    update public.appointments set sustituida_por = '00000000-0000-4000-8000-0000000b2d04' where id = '00000000-0000-4000-8000-0000000b2d02';
    raise exception 'L2Q caso 3: el servidor puso una sustituta sin cerrar';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    update public.appointments set cerrada_en = now(), status = 'scheduled' where id = '00000000-0000-4000-8000-0000000b2d02';
    raise exception 'L2Q caso 3: el servidor cerró y reactivó a la vez';
  exception when insufficient_privilege or check_violation then null;
  end;
  reset role;
end $$;

-- Caso 4: la cerrada sin sustituta no se reabre (ni la sesión ni el servidor) y no se le PONE una
-- sustituta después. El cierre con sustituta viva (tanda I) sigue igual.
do $$
declare v_quien text;
begin
  foreach v_quien in array array['sesion', 'servidor'] loop
    if v_quien = 'sesion' then perform pg_temp.como('00000000-0000-4000-8000-0000000b2ca1'); set local role authenticated;
    else perform pg_temp.servidor(); set local role service_role; end if;
    begin
      update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-0000000b2d01';
      raise exception 'L2Q caso 4: % reabrió una cerrada sin sustituta', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set cerrada_en = null where id = '00000000-0000-4000-8000-0000000b2d01';
      raise exception 'L2Q caso 4: % le quitó el cierre', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      update public.appointments set sustituida_por = '00000000-0000-4000-8000-0000000b2d04' where id = '00000000-0000-4000-8000-0000000b2d01';
      raise exception 'L2Q caso 4: % le puso una sustituta a una cerrada', v_quien;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  perform pg_temp.servidor();
  set local role service_role;
  update public.appointments set cerrada_en = now(), sustituida_por = '00000000-0000-4000-8000-0000000b2d04'
   where id = '00000000-0000-4000-8000-0000000b2d02';
  reset role;
  if (select sustituida_por from public.appointments where id = '00000000-0000-4000-8000-0000000b2d02') is distinct from '00000000-0000-4000-8000-0000000b2d04' then
    raise exception 'L2Q caso 4: el cierre con sustituta (tanda I) dejó de funcionar';
  end if;
end $$;

-- Caso 5: cita_proteger_borrado intacto: con la v2 encendida la sesión no BORRA la cerrada con paciente.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000b2ca1');
  set local role authenticated;
  begin
    delete from public.appointments where id = '00000000-0000-4000-8000-0000000b2d01';
    raise exception 'L2Q caso 5: la sesión borró la cerrada con paciente';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if not exists (select 1 from public.appointments where id = '00000000-0000-4000-8000-0000000b2d01') then
    raise exception 'L2Q caso 5: la cerrada ya no está en la base';
  end if;
end $$;

-- Caso 6: el CHECK solo (como postgres, que salta el disparador): una cerrada tiene que estar
-- cancelada, y no hay sustituta sin cierre.
do $$
begin
  begin
    update public.appointments set cerrada_en = now() where id = '00000000-0000-4000-8000-0000000b2d03';
    raise exception 'L2Q caso 6: el CHECK dejó cerrar una AGENDADA';
  exception when check_violation then null;
  end;
  begin
    update public.appointments set sustituida_por = '00000000-0000-4000-8000-0000000b2d04' where id = '00000000-0000-4000-8000-0000000b2d03';
    raise exception 'L2Q caso 6: el CHECK dejó una sustituta sin cierre';
  exception when check_violation then null;
  end;
end $$;

rollback;
