-- Tanda I, punto 3 (20261121141000_agenda_i4_horario_revisado.sql): la marca
-- consultorios.horario_revisado_en. Nace NULL (por revisar); la pone el dueño con su sesión (lo que
-- hace PATCH /api/consultorios/[id] al confirmar o guardar el horario); la secretaria no la pone (la
-- RLS de UPDATE de siempre); «Restablecer» la vuelve a NULL junto con el horario de partida, en su
-- clínica y en ninguna otra.
-- Mutación comprobada en rojo: quitar `horario_revisado_en = NULL` del UPDATE de consultorios de
-- agenda_restablecer_configuracion → «caso 3: Restablecer no dejó por revisar …».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000a43c1', 'I4 revisado',  true, 'free', false),
  ('00000000-0000-4000-8000-0000000a43c2', 'I4 vecina',    true, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000a43a1'::uuid, 'i4h-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000a43d1'::uuid, 'i4h-secre@prueba.local'),
               ('00000000-0000-4000-8000-0000000a43a2'::uuid, 'i4h-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a43c1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a43a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a43c1', role = 'secretaria' where id = '00000000-0000-4000-8000-0000000a43d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a43c2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a43a2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000a43c1', true), ('00000000-0000-4000-8000-0000000a43c2', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, horario_propio, horario) values
  ('00000000-0000-4000-8000-00000a43cc01', '00000000-0000-4000-8000-0000000a43c1', '00000000-0000-4000-8000-0000000a43a1', 'Uno', 'Uno', 'Calle 1', true, true,
   '{"lunes":{"activo":true,"inicio":"08:00","fin":"12:00"}}'::jsonb),
  ('00000000-0000-4000-8000-00000a43cc02', '00000000-0000-4000-8000-0000000a43c2', '00000000-0000-4000-8000-0000000a43a2', 'Vecino', 'Vecino', 'Calle 2', true, true,
   '{"lunes":{"activo":true,"inicio":"08:00","fin":"12:00"}}'::jsonb);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: nace NULL (por revisar), sin DEFAULT.
do $$
begin
  if (select horario_revisado_en from public.consultorios where id = '00000000-0000-4000-8000-00000a43cc01') is not null then
    raise exception 'I4 caso 1: un consultorio nuevo nació con el horario revisado';
  end if;
end $$;

-- Caso 2: el dueño la pone con su sesión; la secretaria no (la RLS no le deja la fila: 0 filas).
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000a43d1');
  set local role authenticated;
  update public.consultorios set horario_revisado_en = now() where id = '00000000-0000-4000-8000-00000a43cc01';
  get diagnostics v_n = row_count;
  reset role;
  if v_n <> 0 then raise exception 'I4 caso 2: la secretaria marcó como revisado un horario ajeno'; end if;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a43a1');
  set local role authenticated;
  update public.consultorios set horario_revisado_en = now() where id = '00000000-0000-4000-8000-00000a43cc01';
  reset role;
  if (select horario_revisado_en from public.consultorios where id = '00000000-0000-4000-8000-00000a43cc01') is null then
    raise exception 'I4 caso 2: el dueño no pudo marcar su horario como revisado';
  end if;
  update public.consultorios set horario_revisado_en = now() where id = '00000000-0000-4000-8000-00000a43cc02';
end $$;

-- Caso 3: «Restablecer» (service_role) deja el horario de partida POR REVISAR en su clínica, y la
-- vecina como estaba.
do $$
declare v_r text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v_r from public.agenda_restablecer_configuracion('00000000-0000-4000-8000-0000000a43c1', '00000000-0000-4000-8000-0000000a43a1');
  reset role;
  if v_r <> 'ok' then raise exception 'I4 caso 3: Restablecer contestó %', v_r; end if;
  if (select horario_revisado_en from public.consultorios where id = '00000000-0000-4000-8000-00000a43cc01') is not null then
    raise exception 'I4 caso 3: Restablecer no dejó por revisar el horario del consultorio';
  end if;
  if (select horario_revisado_en from public.consultorios where id = '00000000-0000-4000-8000-00000a43cc02') is null then
    raise exception 'I4 caso 3: Restablecer tocó la marca de otra clínica';
  end if;
end $$;

-- Caso 4: la marca del dueño queda en la auditoría de la tabla (log_tabla_change: quién, UPDATE, qué fila).
do $$
begin
  if not exists (select 1 from public.audit_log where tabla = 'consultorios' and registro_id = '00000000-0000-4000-8000-00000a43cc01'
                    and accion = 'UPDATE' and user_id = '00000000-0000-4000-8000-0000000a43a1') then
    raise exception 'I4 caso 4: el cambio de la marca no quedó en audit_log';
  end if;
end $$;

rollback;
