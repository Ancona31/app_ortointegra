-- Agenda B5 — consultorios.horario_propio: valor por omisión, quién la cambia
-- y que la RLS de consultorios no cambió (20261112140000_agenda_b5_horario_propio.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Dos clínicas. En la 1: administrador, médico invitado y secretaria. En la 2: su administrador.
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000005c1', 'B5 prueba uno'),
  ('00000000-0000-4000-8000-0000000005c2', 'B5 prueba dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000005a1'::uuid, 'b5-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000005b1'::uuid, 'b5-medico@prueba.local'),
               ('00000000-0000-4000-8000-0000000005d1'::uuid, 'b5-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-0000000005a2'::uuid, 'b5-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000005c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000005a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000005c1'
 where id = '00000000-0000-4000-8000-0000000005b1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000005c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000005d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000005c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000005a2';

-- Un consultorio del administrador y otro del invitado (como postgres).
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion) values
  ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000005c1',
   '00000000-0000-4000-8000-0000000005a1', 'B5 admin', 'B5 admin', 'Calle 1'),
  ('00000000-0000-4000-8000-0000000005e2', '00000000-0000-4000-8000-0000000005c1',
   '00000000-0000-4000-8000-0000000005b1', 'B5 invitado', 'B5 inv', 'Calle 2');

-- Pone el sub del JWT. Se llama ANTES de `set local role`: los privilegios por omisión de
-- postgres quitan EXECUTE a PUBLIC también en pg_temp, y authenticated no podría llamarla.
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: valor por omisión false, y NOT NULL
do $$
begin
  if (select bool_or(horario_propio) from public.consultorios
       where id in ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000005e2')) then
    raise exception 'B5 caso 1: un consultorio nuevo nació con horario_propio = true';
  end if;
  begin
    update public.consultorios set horario_propio = null where id = '00000000-0000-4000-8000-0000000005e1';
    raise exception 'B5 caso 1: horario_propio aceptó NULL';
  exception when not_null_violation then
    null;
  end;
end $$;

-- Caso 2: el dueño (el invitado) la enciende junto con su horario; queda en audit_log con su user_id
select pg_temp.como('00000000-0000-4000-8000-0000000005b1');
set local role authenticated;
update public.consultorios
   set horario_propio = true,
       horario = jsonb_set(horario, '{lunes}', '{"activo": true, "inicio": "10:00", "fin": "14:00"}')
 where id = '00000000-0000-4000-8000-0000000005e2';
reset role;
do $$
begin
  if not (select horario_propio and horario -> 'lunes' ->> 'activo' = 'true' from public.consultorios
           where id = '00000000-0000-4000-8000-0000000005e2') then
    raise exception 'B5 caso 2: el dueño no pudo encender su horario propio';
  end if;
  if (select count(*) from public.audit_log
       where tabla = 'consultorios' and registro_id = '00000000-0000-4000-8000-0000000005e2'
         and accion = 'UPDATE' and user_id = '00000000-0000-4000-8000-0000000005b1') <> 1 then
    raise exception 'B5 caso 2: el cambio del dueño no dejó su fila en audit_log';
  end if;
end $$;

-- Caso 3: ni el administrador, ni la secretaria, ni otra clínica cambian el consultorio del invitado
-- (la RLS de consultorios_update es sólo del dueño, y no cambió)
do $$
declare
  v_quien uuid;
  v_n integer;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000005d1',
                                 '00000000-0000-4000-8000-0000000005a2']::uuid[]
  loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    update public.consultorios set horario_propio = false where id = '00000000-0000-4000-8000-0000000005e2';
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then
      raise exception 'B5 caso 3: % cambió el horario propio de un consultorio ajeno', v_quien;
    end if;
  end loop;
  if not (select horario_propio from public.consultorios where id = '00000000-0000-4000-8000-0000000005e2') then
    raise exception 'B5 caso 3: el horario propio del invitado cambió';
  end if;
end $$;

-- Caso 4: el administrador sí cambia el SUYO
select pg_temp.como('00000000-0000-4000-8000-0000000005a1');
set local role authenticated;
update public.consultorios set horario_propio = true where id = '00000000-0000-4000-8000-0000000005e1';
reset role;
do $$
begin
  if not (select horario_propio from public.consultorios where id = '00000000-0000-4000-8000-0000000005e1') then
    raise exception 'B5 caso 4: el administrador no pudo cambiar su propio consultorio';
  end if;
end $$;

-- Caso 5: la columna lleva el COMMENT del convenio (lo único que viaja con la base)
do $$
begin
  if coalesce(col_description('public.consultorios'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.consultorios'::regclass
           and attname = 'horario_propio')), '') not like 'false = la disponibilidad%' then
    raise exception 'B5 caso 5: falta el COMMENT del convenio de horario_propio';
  end if;
end $$;

rollback;
