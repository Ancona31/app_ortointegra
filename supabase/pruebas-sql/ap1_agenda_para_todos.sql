-- Agenda para todos · M3 (20261206120000_agenda_para_todos.sql): la agenda v2 encendida por
-- omisión. Falla si la migración no está o se deshizo (caso 0).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback: no deja
-- nada en la base ni depende de la semilla. No borra nada de audit_log.
-- Mutaciones comprobadas en rojo: coalesce(…, false) en la función → caso 2; quitar el
-- disparador de clinicas → caso 0; quitar el EXCEPTION de la función del disparador → caso 5.
begin;

-- Caso 0: lo que deja M3 está (DEFAULT, función del disparador DEFINER sin PUBLIC, disparador).
do $$
begin
  if (select pg_get_expr(d.adbin, d.adrelid) from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = 'public.agenda_ajustes'::regclass and a.attname = 'agenda_v2_encendida') is distinct from 'true' then
    raise exception 'AP1 caso 0: agenda_v2_encendida no tiene DEFAULT true (falta M3 o se deshizo)';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.clinicas'::regclass and tgname = 'trg_clinicas_agenda_ajustes'
                    and tgenabled = 'O' and tgfoid = to_regprocedure('public.agenda_ajustes_de_clinica_nueva()')) then
    raise exception 'AP1 caso 0: falta el disparador trg_clinicas_agenda_ajustes en clinicas';
  end if;
  if not exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.agenda_ajustes_de_clinica_nueva()')
                    and p.prosecdef and p.proconfig = array['search_path=""']
                    and not exists (select 1 from aclexplode(p.proacl) x where x.grantee = 0)) then
    raise exception 'AP1 caso 0: agenda_ajustes_de_clinica_nueva() no es DEFINER con search_path vacío y sin PUBLIC';
  end if;
  if has_function_privilege('anon', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     or (select prosecdef from pg_proc where oid = 'public.agenda_v2_encendida(uuid)'::regprocedure) then
    raise exception 'AP1 caso 0: agenda_v2_encendida cambió de privilegios o dejó de ser INVOKER';
  end if;
end $$;

-- Tres clínicas, como las crea la app (POST /api/me/clinica): con service_role y sin decir nada de la agenda.
set local role service_role;
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000a91c1', 'AP1 nueva uno'),
  ('00000000-0000-4000-8000-0000000a91c2', 'AP1 nueva dos'),
  ('00000000-0000-4000-8000-0000000a91c3', 'AP1 nueva tres');
reset role;
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000a91a1'::uuid, 'ap1-admin1@prueba.local'),
               ('00000000-0000-4000-8000-0000000a91a2'::uuid, 'ap1-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a91c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000a91a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a91c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000a91a2';

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: cada clínica nueva nace con SU fila, de fábrica: v2 encendida, recordatorio y correo a la
-- clínica APAGADOS, plazos y candado de siempre; y el alta quedó auditada.
do $$
declare r public.agenda_ajustes; v_c uuid;
begin
  foreach v_c in array array['00000000-0000-4000-8000-0000000a91c1', '00000000-0000-4000-8000-0000000a91c2',
                             '00000000-0000-4000-8000-0000000a91c3']::uuid[] loop
    select * into r from public.agenda_ajustes where clinica_id = v_c;
    if not found then
      raise exception 'AP1 caso 1: la clínica % nació sin fila en agenda_ajustes', v_c;
    end if;
    if (r.agenda_v2_encendida, r.recordatorio_encendido, r.correo_reserva_clinica, r.recordatorio_horas,
        r.anticipacion_min_horas, r.horizonte_dias, r.vigencia_enlace_unico_dias, r.candado_citas_activas,
        r.candado_reagendados, r.candado_cancelaciones, r.candado_ventana_dias)
       is distinct from (true, false, false, 24, 2, 60, 7, 1, 2, 3, 60) then
      raise exception 'AP1 caso 1: la fila de fábrica no es la esperada: %', r;
    end if;
    if (select count(*) from public.audit_log where tabla = 'agenda_ajustes' and registro_id = r.id and accion = 'INSERT') <> 1 then
      raise exception 'AP1 caso 1: el alta de la fila de % no quedó en audit_log', v_c;
    end if;
  end loop;
end $$;

-- Caso 2: la función común. Fila true → true; fila false → false (apagada a propósito); SIN fila →
-- true. Y lo mismo con la sesión (que es como la llama la app, por RPC).
update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-0000000a91c2';
delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000a91c3';
do $$
begin
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c1') is distinct from true then
    raise exception 'AP1 caso 2: con fila en true no contesta true';
  end if;
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c2') is distinct from false then
    raise exception 'AP1 caso 2: una fila con false no la apaga';
  end if;
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c3') is distinct from true then
    raise exception 'AP1 caso 2: sin fila no contesta true';
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a91a1');
  set local role authenticated;
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c1') is distinct from true then
    raise exception 'AP1 caso 2: la sesión de la clínica 1 no la ve encendida';
  end if;
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a91a2');
  set local role authenticated;
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c2') is distinct from false then
    raise exception 'AP1 caso 2: la sesión de la clínica 2 (apagada a propósito) la ve encendida';
  end if;
  -- De OTRA clínica la sesión no ve la fila (RLS): contesta lo mismo que para un uuid que no existe.
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c1')
     is distinct from public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91ff') then
    raise exception 'AP1 caso 2: la respuesta sobre otra clínica delata si tiene fila';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Caso 3: el interruptor lo sigue cambiando SÓLO postgres (proteger_agenda_ajustes no se tocó).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000a91a1');
  set local role authenticated;
  begin
    update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-0000000a91c1';
    raise exception 'AP1 caso 3: el administrador apagó la agenda v2 de su clínica';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a91a2');
  set local role authenticated;
  begin
    update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000a91c2';
    raise exception 'AP1 caso 3: el administrador encendió la agenda v2 de su clínica';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;
  begin
    update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000a91c2';
    raise exception 'AP1 caso 3: service_role encendió la agenda v2';
  exception when insufficient_privilege then null;
  end;
  -- Ni dar de alta la fila que falta sin decir el interruptor: nacería encendida, y eso es de postgres.
  begin
    insert into public.agenda_ajustes (clinica_id) values ('00000000-0000-4000-8000-0000000a91c3');
    raise exception 'AP1 caso 3: service_role dio de alta una fila que nace encendida';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 4: una clínica recién nacida ya funciona para las funciones que leen la FILA (no la función
-- común): agenda_restablecer_configuracion contesta 'ok' para la 1 y 'apagado' para la 2 (fila false).
set local role service_role;
do $$
declare v text;
begin
  select r_resultado into v from public.agenda_restablecer_configuracion(
    '00000000-0000-4000-8000-0000000a91c1', '00000000-0000-4000-8000-0000000a91a1');
  if v is distinct from 'ok' then
    raise exception 'AP1 caso 4: una clínica nueva no puede restablecer su configuración (%): la fila no cuenta como encendida', v;
  end if;
  select r_resultado into v from public.agenda_restablecer_configuracion(
    '00000000-0000-4000-8000-0000000a91c2', '00000000-0000-4000-8000-0000000a91a2');
  if v is distinct from 'apagado' then
    raise exception 'AP1 caso 4: una clínica apagada a propósito restableció su configuración (%)', v;
  end if;
end $$;
reset role;

-- Caso 5: si el alta de la fila falla, la clínica se crea igual (con un WARNING) y queda sin fila.
-- Se provoca con un CHECK imposible sobre agenda_ajustes, que el rollback del final deshace.
alter table public.agenda_ajustes add constraint ap1_imposible check (clinica_id <> '00000000-0000-4000-8000-0000000a91c4') not valid;
set local role service_role;
insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-0000000a91c4', 'AP1 sin fila');
reset role;
do $$
begin
  if not exists (select 1 from public.clinicas where id = '00000000-0000-4000-8000-0000000a91c4') then
    raise exception 'AP1 caso 5: un fallo al crear la fila de ajustes impidió crear la clínica';
  end if;
  if exists (select 1 from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000a91c4') then
    raise exception 'AP1 caso 5: la fila se creó a pesar del CHECK (la prueba no provocó el fallo)';
  end if;
  if public.agenda_v2_encendida('00000000-0000-4000-8000-0000000a91c4') is distinct from true then
    raise exception 'AP1 caso 5: una clínica sin fila no cuenta como encendida';
  end if;
end $$;

-- Caso 6: borrar una clínica exige borrar antes su fila (FK RESTRICT, no CASCADE); con la fila
-- borrada, la clínica vacía se borra (la marcha atrás de POST /api/me/clinica, con service_role).
set local role service_role;
do $$
begin
  begin
    delete from public.clinicas where id = '00000000-0000-4000-8000-0000000a91c1';
    raise exception 'AP1 caso 6: se borró una clínica con su fila de ajustes (¿la FK es CASCADE?)';
  exception when foreign_key_violation then null;
  end;
  update public.profiles set clinica_id = null, es_admin_de_clinica = false where id = '00000000-0000-4000-8000-0000000a91a1';
  delete from public.agenda_ajustes where clinica_id = '00000000-0000-4000-8000-0000000a91c1';
  delete from public.clinicas where id = '00000000-0000-4000-8000-0000000a91c1';
  if exists (select 1 from public.clinicas where id = '00000000-0000-4000-8000-0000000a91c1') then
    raise exception 'AP1 caso 6: sin su fila de ajustes, la clínica vacía no se borró';
  end if;
end $$;
reset role;

rollback;
