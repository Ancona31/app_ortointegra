-- Corrección de seguridad, punto 7a (20261117122000_agenda_seg_emision_enlaces.sql): la sesión
-- no puede emitir por PostgREST un enlace de reserva con un código elegido por ella (ni con
-- INSERT directo ni con reserva_enlace_regenerar_fijo), ni cambiar el hash de uno emitido, ni
-- llamar a reserva_enlace_emitir; el servidor (service_role) sí, con la regla de las policies
-- aplicada al actor; y la sesión sigue revocando con su RLS.
-- Mutación comprobada en rojo: quitar el «IF current_user <> 'service_role'» del alta en
-- proteger_reserva_enlaces() → «caso 1: la sesión emitió un enlace con un hash elegido».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000007ac001', 'Seg7a una'),
  ('00000000-0000-4000-8000-0000007ac002', 'Seg7a dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000007aa001'::uuid, 'seg7a-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000007ab001'::uuid, 'seg7a-medico@prueba.local'),
               ('00000000-0000-4000-8000-0000007ab002'::uuid, 'seg7a-medico2@prueba.local'),
               ('00000000-0000-4000-8000-0000007ae001'::uuid, 'seg7a-secre@prueba.local'),
               ('00000000-0000-4000-8000-0000007aa002'::uuid, 'seg7a-admin2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000007ac001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000007aa001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000007ac001'
 where id in ('00000000-0000-4000-8000-0000007ab001', '00000000-0000-4000-8000-0000007ab002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000007ac001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000007ae001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000007ac002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000007aa002';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, vigencia_enlace_unico_dias)
values ('00000000-0000-4000-8000-0000007ac001', true, 4);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;
create function pg_temp.emitir(p_clinica uuid, p_actor uuid, p_id uuid, p_medico uuid, p_clase text, p_hash text,
                               p_etiqueta text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform public.reserva_enlace_emitir(p_clinica, p_actor, p_id, p_medico, p_clase, p_hash, p_etiqueta);
  reset role;
exception when others then
  reset role;
  raise;
end $$;

-- Caso 1: la sesión, con todos los permisos de RLS para hacerlo (el médico, para sí mismo; el
-- administrador), no inserta un enlace: ni fijo ni único, ni por la función vieja.
do $$
declare v_quien uuid;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000007ab001', '00000000-0000-4000-8000-0000007aa001']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    begin
      insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
      values (gen_random_uuid(), '00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ab001',
              'unico', pg_temp.h('codigo-elegido'));
      raise exception 'Seg7a caso 1: la sesión emitió un enlace con un hash elegido (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
      values (gen_random_uuid(), '00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ab001',
              'fijo', pg_temp.h('fijo-elegido'));
      raise exception 'Seg7a caso 1: la sesión emitió un fijo con un hash elegido (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.reserva_enlace_regenerar_fijo(gen_random_uuid(), '00000000-0000-4000-8000-0000007ab001',
                                                   pg_temp.h('regenerado-elegido'));
      raise exception 'Seg7a caso 1: la sesión regeneró un fijo con un hash elegido (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.reserva_enlace_emitir('00000000-0000-4000-8000-0000007ac001', v_quien, gen_random_uuid(),
                '00000000-0000-4000-8000-0000007ab001', 'unico', pg_temp.h('rpc-elegido'), null);
      raise exception 'Seg7a caso 1: la sesión ejecutó reserva_enlace_emitir (%)', v_quien;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  if exists (select 1 from public.reserva_enlaces where clinica_id = '00000000-0000-4000-8000-0000007ac001') then
    raise exception 'Seg7a caso 1: quedó algún enlace';
  end if;
end $$;

-- Caso 2: el servidor emite. Médico para sí (único, etiqueta, vigencia del ajuste), secretaria y
-- administrador para otro (fijo). created_by = el actor.
select pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ab001',
  '00000000-0000-4000-8000-0000007af001', '00000000-0000-4000-8000-0000007ab001', 'unico', pg_temp.h('u1'), 'Para Ana');
select pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ae001',
  '00000000-0000-4000-8000-0000007af002', '00000000-0000-4000-8000-0000007ab001', 'fijo', pg_temp.h('f1'), null);
select pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007aa001',
  '00000000-0000-4000-8000-0000007af003', '00000000-0000-4000-8000-0000007ab002', 'fijo', pg_temp.h('f2'), null);
do $$
begin
  if (select string_agg(right(id::text, 2) || ':' || clase || ':' || coalesce(etiqueta, '-') || ':' || right(created_by::text, 4)
                        || ':' || coalesce(vigencia_dias::text, '-'), ',' order by id)
        from public.reserva_enlaces where clinica_id = '00000000-0000-4000-8000-0000007ac001')
     <> '01:unico:Para Ana:b001:4,02:fijo:-:e001:-,03:fijo:-:a001:-' then
    raise exception 'Seg7a caso 2: las altas del servidor no quedaron como debían';
  end if;
end $$;

-- Caso 3: la regla del actor. Un médico no emite para otro; nadie de otra clínica emite en la
-- una; un actor sin perfil tampoco; argumentos inválidos (fijo con etiqueta) → 22023.
do $$
begin
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ab002', gen_random_uuid(),
                           '00000000-0000-4000-8000-0000007ab001', 'unico', pg_temp.h('x1'), null);
    raise exception 'Seg7a caso 3: un médico emitió para otro';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007aa002', gen_random_uuid(),
                           '00000000-0000-4000-8000-0000007ab001', 'unico', pg_temp.h('x2'), null);
    raise exception 'Seg7a caso 3: el administrador de otra clínica emitió en la una';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', gen_random_uuid(), gen_random_uuid(),
                           '00000000-0000-4000-8000-0000007ab001', 'unico', pg_temp.h('x3'), null);
    raise exception 'Seg7a caso 3: un actor sin perfil emitió';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007aa001', gen_random_uuid(),
                           '00000000-0000-4000-8000-0000007ab001', 'fijo', pg_temp.h('x4'), 'etiqueta');
    raise exception 'Seg7a caso 3: un fijo con etiqueta pasó';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Caso 4: regenerar el fijo por el servidor: el viejo queda revocado POR EL ACTOR, el nuevo vigente.
select pg_temp.emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007ab001',
  '00000000-0000-4000-8000-0000007af004', '00000000-0000-4000-8000-0000007ab001', 'fijo', pg_temp.h('f1-nuevo'), null);
do $$
begin
  if (select revocado_en is null or revocado_por is distinct from '00000000-0000-4000-8000-0000007ab001'
        from public.reserva_enlaces where id = '00000000-0000-4000-8000-0000007af002')
     or (select revocado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-0000007af004') is not null then
    raise exception 'Seg7a caso 4: regenerar no revocó el viejo con su autor o no dejó vigente el nuevo';
  end if;
end $$;

-- Caso 5: la sesión no cambia el hash de un enlace emitido; sí lo revoca (con su autor).
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000007ab001');
  set local role authenticated;
  begin
    update public.reserva_enlaces set codigo_hash = pg_temp.h('otro') where id = '00000000-0000-4000-8000-0000007af001';
    raise exception 'Seg7a caso 5: la sesión cambió el hash de un enlace emitido';
  exception when insufficient_privilege then null;
  end;
  update public.reserva_enlaces set revocado_en = now() where id = '00000000-0000-4000-8000-0000007af001';
  reset role;
  if (select revocado_por from public.reserva_enlaces where id = '00000000-0000-4000-8000-0000007af001')
       is distinct from '00000000-0000-4000-8000-0000007ab001' then
    raise exception 'Seg7a caso 5: la revocación de la sesión no quedó con su autor';
  end if;
end $$;

-- Caso 6: anon no ejecuta reserva_enlace_emitir.
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform public.reserva_enlace_emitir('00000000-0000-4000-8000-0000007ac001', '00000000-0000-4000-8000-0000007aa001',
              gen_random_uuid(), '00000000-0000-4000-8000-0000007ab001', 'unico', repeat('a', 64), null);
    raise exception 'Seg7a caso 6: anon ejecutó reserva_enlace_emitir';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
