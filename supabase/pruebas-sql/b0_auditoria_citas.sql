-- Agenda B0 — auditoría de citas (log_cita_change, 20261112120000_agenda_b0_auditoria_citas.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base (ni en audit_log) ni depende de la semilla.
-- Las horas van en 2031 para poder comprobar que ninguna se escribe en descripcion.
begin;

-- Clínica, administrador y médico invitado (handle_new_user + update como postgres, como en p3)
insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-0000000000c0', 'B0 prueba');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b0-admin@prueba.local', now(), now()),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b0-medico@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000000c0', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000000a0';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000000c0'
 where id = '00000000-0000-4000-8000-0000000000b0';

-- Filas de audit_log de la cita de prueba con esa acción.
create function pg_temp.filas(p_accion text) returns bigint language sql as $$
  select count(*) from public.audit_log
   where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-0000000000e0' and accion = p_accion
$$;
-- Filas con esa acción cuya descripcion contiene el patrón (@>). No se busca «la última»:
-- dentro de una transacción created_at es el mismo now() para todas.
create function pg_temp.con(p_accion text, p_patron jsonb) returns bigint language sql as $$
  select count(*) from public.audit_log
   where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-0000000000e0' and accion = p_accion
     and descripcion::jsonb @> p_patron
$$;

-- Caso 1: alta como postgres → cita_alta con user_id = 'system'
insert into public.appointments (id, clinica_id, medico_id, title, notes, start_time, end_time)
values ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000c0',
        '00000000-0000-4000-8000-0000000000b0', 'TituloSecretoB0', 'NotaSecretaB0',
        '2031-03-04 10:00-06', '2031-03-04 10:30-06');
do $$
declare v_user text; v_desc jsonb;
begin
  if pg_temp.filas('cita_alta') <> 1 then
    raise exception 'B0 caso 1: esperaba 1 cita_alta, hay %', pg_temp.filas('cita_alta');
  end if;
  select user_id, descripcion::jsonb into v_user, v_desc from public.audit_log
   where registro_id = '00000000-0000-4000-8000-0000000000e0' and accion = 'cita_alta';
  if v_user <> 'system' then
    raise exception 'B0 caso 1: esperaba user_id system, salió %', v_user;
  end if;
  if v_desc <> jsonb_build_object('clinica_id', '00000000-0000-4000-8000-0000000000c0',
                                  'con_paciente', false, 'origen', 'spinus') then
    raise exception 'B0 caso 1: descripcion inesperada %', v_desc;
  end if;
end $$;

-- Caso 2: mover la hora como administrador autenticado → cita_editada, campos = [end_time, start_time], su user_id
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a0', 'role', 'authenticated')::text, true);
update public.appointments set start_time = '2031-03-04 11:00-06', end_time = '2031-03-04 11:30-06'
 where id = '00000000-0000-4000-8000-0000000000e0';
reset role;
do $$
declare v_user text;
begin
  if pg_temp.filas('cita_editada') <> 1 then
    raise exception 'B0 caso 2: esperaba 1 cita_editada (¿la RLS dejó pasar el UPDATE?), hay %', pg_temp.filas('cita_editada');
  end if;
  if (select descripcion::jsonb from public.audit_log
       where registro_id = '00000000-0000-4000-8000-0000000000e0' and accion = 'cita_editada')
     <> jsonb_build_object('clinica_id', '00000000-0000-4000-8000-0000000000c0', 'con_paciente', false,
                           'origen', 'spinus', 'campos', '["end_time", "start_time"]'::jsonb) then
    raise exception 'B0 caso 2: descripcion inesperada (esperaba campos [end_time, start_time] y sin estado)';
  end if;
  select user_id into v_user from public.audit_log
   where registro_id = '00000000-0000-4000-8000-0000000000e0' and accion = 'cita_editada';
  if v_user <> '00000000-0000-4000-8000-0000000000a0' then
    raise exception 'B0 caso 2: esperaba el user_id del administrador, salió %', v_user;
  end if;
end $$;

-- Caso 3: sólo columnas técnicas (gcal_sync_status, updated_at, gcal_etag) como service_role → 0 filas nuevas
set local role service_role;
update public.appointments set gcal_sync_status = 'pending', updated_at = now() + interval '1 minute',
       gcal_etag = 'etag-b0', client_id = 'cliente-b0'
 where id = '00000000-0000-4000-8000-0000000000e0';
reset role;
do $$
begin
  if (select count(*) from public.audit_log where registro_id = '00000000-0000-4000-8000-0000000000e0') <> 2 then
    raise exception 'B0 caso 3: un UPDATE sólo técnico dejó filas en audit_log (hay % en total, esperaba 2)',
      (select count(*) from public.audit_log where registro_id = '00000000-0000-4000-8000-0000000000e0');
  end if;
end $$;

-- Caso 3b: técnica + no técnica en el mismo UPDATE → 1 fila, y en campos sólo la no técnica
update public.appointments set gcal_sync_status = 'synced', notes = 'NotaSecretaB0 bis'
 where id = '00000000-0000-4000-8000-0000000000e0';
do $$
begin
  if pg_temp.filas('cita_editada') <> 2 or pg_temp.con('cita_editada', '{"campos": ["notes"]}') <> 1
     or pg_temp.con('cita_editada', '{"campos": ["gcal_sync_status"]}') <> 0 then
    raise exception 'B0 caso 3b: esperaba 2 cita_editada, una con campos exactamente ["notes"] (hay %)',
      pg_temp.filas('cita_editada');
  end if;
end $$;

-- Caso 4: scheduled → cancelled (como administrador) → cita_cancelada con estado de→a
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a0', 'role', 'authenticated')::text, true);
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-0000000000e0';
reset role;
do $$
begin
  if pg_temp.filas('cita_cancelada') <> 1
     or pg_temp.con('cita_cancelada', '{"campos": ["status"], "estado": {"de": "scheduled", "a": "cancelled"}}') <> 1 then
    raise exception 'B0 caso 4: esperaba 1 cita_cancelada scheduled→cancelled con campos [status] (hay %)',
      pg_temp.filas('cita_cancelada');
  end if;
end $$;

-- Caso 5: cancelled → scheduled → cita_reactivada
update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-0000000000e0';
do $$
begin
  if pg_temp.filas('cita_reactivada') <> 1
     or pg_temp.con('cita_reactivada', '{"estado": {"de": "cancelled", "a": "scheduled"}}') <> 1 then
    raise exception 'B0 caso 5: esperaba 1 cita_reactivada cancelled→scheduled (hay %)', pg_temp.filas('cita_reactivada');
  end if;
end $$;

-- Caso 5b: otro cambio de estado que no es cancelar ni reactivar → cita_editada con estado
update public.appointments set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000000e0';
do $$
begin
  if pg_temp.filas('cita_editada') <> 3
     or pg_temp.con('cita_editada', '{"estado": {"de": "scheduled", "a": "confirmed"}}') <> 1 then
    raise exception 'B0 caso 5b: esperaba una 3.ª cita_editada scheduled→confirmed (hay %)', pg_temp.filas('cita_editada');
  end if;
end $$;

-- Caso 9: sin EXECUTE para authenticated el disparador sigue escribiendo (al dispararse no se
-- comprueba EXECUTE; lo afirma la cabecera de la migración), y llamarla como RPC no se puede.
revoke execute on function public.log_cita_change() from authenticated;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a0', 'role', 'authenticated')::text, true);
update public.appointments set title = 'TituloSecretoB0 bis' where id = '00000000-0000-4000-8000-0000000000e0';
reset role;
grant execute on function public.log_cita_change() to authenticated;
do $$
begin
  if pg_temp.filas('cita_editada') <> 4 or pg_temp.con('cita_editada', '{"campos": ["title"]}') <> 1 then
    raise exception 'B0 caso 9: sin EXECUTE el disparador no escribió (cita_editada = %)', pg_temp.filas('cita_editada');
  end if;
end $$;
set local role authenticated;
do $$
begin
  perform public.log_cita_change();
  raise exception 'B0 caso 9: log_cita_change() se dejó llamar directamente';
exception when feature_not_supported then
  null;  -- «trigger functions can only be called as triggers»
end $$;
reset role;

-- Caso 10 (P10, auditoría estricta): si falla la escritura en audit_log, falla la de la cita
create function pg_temp.audit_rompe() returns trigger language plpgsql as $$
begin raise exception 'audit_log roto a propósito' using errcode = 'P0B00'; end $$;
create trigger b0_audit_rompe before insert on public.audit_log
  for each row execute function pg_temp.audit_rompe();
do $$
begin
  update public.appointments set notes = 'no debe quedar' where id = '00000000-0000-4000-8000-0000000000e0';
  raise exception 'B0 caso 10: la cita se escribió aunque audit_log falló';
exception when sqlstate 'P0B00' then
  null;
end $$;
drop trigger b0_audit_rompe on public.audit_log;
do $$
begin
  if (select notes from public.appointments where id = '00000000-0000-4000-8000-0000000000e0') <> 'NotaSecretaB0 bis' then
    raise exception 'B0 caso 10: la nota cambió aunque audit_log falló';
  end if;
end $$;

-- Caso 6: borrar (como administrador) → cita_eliminada
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a0', 'role', 'authenticated')::text, true);
delete from public.appointments where id = '00000000-0000-4000-8000-0000000000e0';
reset role;
do $$
begin
  if pg_temp.filas('cita_eliminada') <> 1 then
    raise exception 'B0 caso 6: esperaba 1 cita_eliminada (¿la RLS dejó pasar el DELETE?), hay %', pg_temp.filas('cita_eliminada');
  end if;
end $$;

-- Caso 7: ningún valor de la cita en descripcion: ni título, ni notas, ni horas (2031)
do $$
declare v_mal bigint;
begin
  select count(*) into v_mal from public.audit_log
   where registro_id = '00000000-0000-4000-8000-0000000000e0'
     and (position('TituloSecretoB0' in descripcion) > 0 or position('NotaSecretaB0' in descripcion) > 0
          or position('2031' in descripcion) > 0 or position('etag-b0' in descripcion) > 0
          or position('cliente-b0' in descripcion) > 0);
  if v_mal <> 0 then
    raise exception 'B0 caso 7: % fila(s) de audit_log llevan valores de la cita', v_mal;
  end if;
  if (select count(*) from public.audit_log where registro_id = '00000000-0000-4000-8000-0000000000e0') <> 8 then
    raise exception 'B0 caso 7: esperaba 8 filas en total (alta, 4 editadas, cancelada, reactivada, eliminada), hay %',
      (select count(*) from public.audit_log where registro_id = '00000000-0000-4000-8000-0000000000e0');
  end if;
end $$;

-- Caso 8: EXECUTE quitado a PUBLIC (y concedido a los tres roles de la regla de CLAUDE.md)
do $$
begin
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              where p.oid = 'public.log_cita_change()'::regprocedure and a.grantee = 0) then
    raise exception 'B0 caso 8: PUBLIC conserva EXECUTE sobre log_cita_change()';
  end if;
  if not (has_function_privilege('anon', 'public.log_cita_change()', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.log_cita_change()', 'EXECUTE')
          and has_function_privilege('service_role', 'public.log_cita_change()', 'EXECUTE')) then
    raise exception 'B0 caso 8: falta EXECUTE para anon, authenticated o service_role';
  end if;
end $$;

rollback;
