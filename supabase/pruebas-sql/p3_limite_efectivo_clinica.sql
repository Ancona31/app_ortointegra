-- Fase 3 · P3 — limite_efectivo sobre las columnas de una clínica real, como lo pide la app.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de datos sembrados.
begin;

-- Clínica de prueba: 1 médico y 0 secretarias de base (como postgres, que puede escribir ajuste_*)
insert into public.clinicas (id, nombre, max_medicos, max_secretarias)
values ('00000000-0000-4000-8000-0000000000c3', 'P3 prueba', 1, 0);

-- Caso 1: max_medicos = 1 y ajuste_max_medicos = 2 sin fecha → 2
update public.clinicas set ajuste_max_medicos = 2, ajuste_medicos_hasta = null
 where id = '00000000-0000-4000-8000-0000000000c3';
do $$
declare v integer;
begin
  select public.limite_efectivo(max_medicos, ajuste_max_medicos, ajuste_medicos_hasta) into v
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if v is distinct from 2 then
    raise exception 'P3 caso 1: esperaba 2 con ajuste de 2 sin fecha, salió %', v;
  end if;
end $$;

-- Caso 2: con ajuste_medicos_hasta en el pasado → 1
update public.clinicas set ajuste_medicos_hasta = now() - interval '1 day'
 where id = '00000000-0000-4000-8000-0000000000c3';
do $$
declare v integer;
begin
  select public.limite_efectivo(max_medicos, ajuste_max_medicos, ajuste_medicos_hasta) into v
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if v is distinct from 1 then
    raise exception 'P3 caso 2: esperaba 1 con el ajuste vencido, salió %', v;
  end if;
end $$;

-- Caso 3: max_secretarias = 0 y sin ajuste → 0, no NULL (límite 0 = ninguno, R6)
do $$
declare v integer;
begin
  select public.limite_efectivo(max_secretarias, ajuste_max_secretarias, ajuste_secretarias_hasta) into v
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if v is null or v <> 0 then
    raise exception 'P3 caso 3: esperaba 0 (no NULL) sin ajuste de secretarias, salió %', coalesce(v::text, 'NULL');
  end if;
end $$;

-- Caso 4: con un ajuste de 1 secretaria sin fecha → 1 (el número con el que la invitación la acepta)
update public.clinicas set ajuste_max_secretarias = 1, ajuste_secretarias_hasta = null
 where id = '00000000-0000-4000-8000-0000000000c3';
do $$
declare v integer;
begin
  select public.limite_efectivo(max_secretarias, ajuste_max_secretarias, ajuste_secretarias_hasta) into v
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if v is distinct from 1 then
    raise exception 'P3 caso 4: esperaba 1 con ajuste de 1 secretaria sin fecha, salió %', v;
  end if;
end $$;

-- Administrador de la clínica e invitado pendiente: los dos con perfil (handle_new_user + update como postgres)
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at, invited_at)
values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p3-admin@prueba.local', now(), now(), null),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p3-invitado@prueba.local', now(), now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000000c3', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000000a3';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000000c3', invitado_por = '00000000-0000-4000-8000-0000000000a3'
 where id = '00000000-0000-4000-8000-0000000000b3';

-- Caso 5: como authenticated (Facturación usa la sesión) lee sus ajustes y ejecuta limite_efectivo
update public.clinicas set ajuste_medicos_hasta = null where id = '00000000-0000-4000-8000-0000000000c3';
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-0000000000a3', 'role', 'authenticated')::text, true);
do $$
declare m integer; s integer;
begin
  select public.limite_efectivo(max_medicos, ajuste_max_medicos, ajuste_medicos_hasta),
         public.limite_efectivo(max_secretarias, ajuste_max_secretarias, ajuste_secretarias_hasta)
    into m, s
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if m is distinct from 2 or s is distinct from 1 then
    raise exception 'P3 caso 5: esperaba 2 médicos y 1 secretaria como authenticated, salió % y %', m, s;
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Caso 6: como service_role (invitar y usuarios usan createAdminClient) da lo mismo
set local role service_role;
do $$
declare m integer; s integer;
begin
  select public.limite_efectivo(max_medicos, ajuste_max_medicos, ajuste_medicos_hasta),
         public.limite_efectivo(max_secretarias, ajuste_max_secretarias, ajuste_secretarias_hasta)
    into m, s
  from public.clinicas where id = '00000000-0000-4000-8000-0000000000c3';
  if m is distinct from 2 or s is distinct from 1 then
    raise exception 'P3 caso 6: esperaba 2 médicos y 1 secretaria como service_role, salió % y %', m, s;
  end if;
end $$;
reset role;

-- Caso 7: el conteo de api/admin/invitar escrito en SQL (lo usará P6): todos los perfiles de
-- la clínica con ese rol, el administrador y las invitaciones sin aceptar incluidos
do $$
declare v_medicos bigint; v_secretarias bigint;
begin
  select (select count(*) from public.profiles p where p.clinica_id = c.id and p.role = 'medico'),
         (select count(*) from public.profiles p where p.clinica_id = c.id and p.role = 'secretaria')
    into v_medicos, v_secretarias
  from public.clinicas c where c.id = '00000000-0000-4000-8000-0000000000c3';
  if v_medicos <> 2 or v_secretarias <> 0 then
    raise exception 'P3 caso 7: esperaba 2 médicos (admin + invitado pendiente) y 0 secretarias, salió % y %',
      v_medicos, v_secretarias;
  end if;
end $$;

rollback;
