-- Agenda D1 — enlaces de reserva y columnas reserva_* de appointments
-- (20261114120000_agenda_d1_enlaces_reserva.sql): RLS por rol y por clínica,
-- vigencia congelada, protección de lo emitido, un fijo vigente por médico,
-- regenerar atómico, CHECK de coherencia y FK compuesta de la cita.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Dos clínicas. En la 1: administrador (a1), dos médicos invitados (b1, b2) y secretaria (s1).
-- En la 2: su administrador (a2).
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-000000d1c001', 'D1 prueba uno'),
  ('00000000-0000-4000-8000-000000d1c002', 'D1 prueba dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000d1a001'::uuid, 'd1-admin@prueba.local'),
               ('00000000-0000-4000-8000-000000d1b001'::uuid, 'd1-medico-b@prueba.local'),
               ('00000000-0000-4000-8000-000000d1b002'::uuid, 'd1-medico-c@prueba.local'),
               ('00000000-0000-4000-8000-000000d1e001'::uuid, 'd1-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-000000d1a002'::uuid, 'd1-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d1a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c001'
 where id in ('00000000-0000-4000-8000-000000d1b001', '00000000-0000-4000-8000-000000d1b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000d1e001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d1a002';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, vigencia_enlace_unico_dias)
values ('00000000-0000-4000-8000-000000d1c001', true, 5);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
-- Sólo para esta prueba (rollback): los privilegios por omisión de postgres le quitan EXECUTE a
-- PUBLIC también en pg_temp, y la prueba la llama ya con el rol cambiado.
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;
-- Desde la corrección de seguridad 7a (20261117122000) los enlaces sólo los emite service_role,
-- por reserva_enlace_emitir con el actor que lo pide (la regla de las policies, repetida dentro).
-- Este ayudante la llama como lo hace POST /api/agenda/enlaces y deja el rol como estaba.
create function pg_temp.emitir(p_actor uuid, p_id uuid, p_medico uuid, p_clase text, p_hash text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform public.reserva_enlace_emitir('00000000-0000-4000-8000-000000d1c001', p_actor, p_id, p_medico, p_clase, p_hash, null);
  reset role;
exception when others then
  reset role;
  raise;
end $$;

-- Caso 1: altas. Invitado b1 emite su fijo y un único; la secretaria emite el fijo de b2; el
-- administrador uno suyo. Lo que mande quien escribe en caduca_en, usado_*, revocado_* y
-- created_at se reescribe (también siendo service_role); created_by es el actor; la vigencia
-- del único sale del ajuste (5 días). (Antes de 7a: con la sesión, y created_by = auth.uid().)
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en,
                                    created_by, usado_en, revocado_en, created_at)
values ('00000000-0000-4000-8000-000000d1f001', '00000000-0000-4000-8000-000000d1c001',
        '00000000-0000-4000-8000-000000d1b001', 'unico', pg_temp.h('u1'), 30, now() + interval '900 days',
        '00000000-0000-4000-8000-000000d1b001', null, null, now() - interval '9 days');
reset role;
select pg_temp.emitir('00000000-0000-4000-8000-000000d1b001', '00000000-0000-4000-8000-000000d1f002',
                      '00000000-0000-4000-8000-000000d1b001', 'fijo', pg_temp.h('f1'));
select pg_temp.emitir('00000000-0000-4000-8000-000000d1e001', '00000000-0000-4000-8000-000000d1f003',
                      '00000000-0000-4000-8000-000000d1b002', 'fijo', pg_temp.h('f2'));
select pg_temp.emitir('00000000-0000-4000-8000-000000d1a001', '00000000-0000-4000-8000-000000d1f004',
                      '00000000-0000-4000-8000-000000d1a001', 'fijo', pg_temp.h('fa'));
do $$
declare v public.reserva_enlaces%rowtype;
begin
  select * into v from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f001';
  if v.created_by is distinct from '00000000-0000-4000-8000-000000d1b001' or v.vigencia_dias <> 5
     or abs(extract(epoch from (v.caduca_en - (now() + interval '5 days')))) > 1
     or v.created_at <> now() then
    raise exception 'D1 caso 1: el alta no reescribió created_by / vigencia / caduca_en / created_at (%)', row_to_json(v);
  end if;
  if (select created_by from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f003')
     is distinct from '00000000-0000-4000-8000-000000d1e001' then
    raise exception 'D1 caso 1: created_by de la secretaria no quedó';
  end if;
  if (select count(*) from public.audit_log where tabla = 'reserva_enlaces' and accion = 'INSERT'
       and registro_id::text like '00000000-0000-4000-8000-000000d1f00_') <> 4 then
    raise exception 'D1 caso 1: las cuatro altas no quedaron en audit_log';
  end if;
end $$;

-- Caso 2: la vigencia del único queda congelada aunque el ajuste cambie después (§2)
update public.agenda_ajustes set vigencia_enlace_unico_dias = 20 where clinica_id = '00000000-0000-4000-8000-000000d1c001';
do $$
begin
  if (select vigencia_dias from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f001') <> 5 then
    raise exception 'D1 caso 2: el cambio del ajuste movió la vigencia de un enlace emitido';
  end if;
end $$;

-- Caso 3: quién ve qué. b1: los suyos (f001, f002). b2: ninguno propio. Secretaria y
-- administrador: los cuatro. Administrador de la otra clínica: nada.
do $$
declare
  v_caso record;
  v_vistos text;
begin
  for v_caso in select * from (values
      ('00000000-0000-4000-8000-000000d1b001'::uuid, '01,02'),
      ('00000000-0000-4000-8000-000000d1b002'::uuid, '03'),
      ('00000000-0000-4000-8000-000000d1e001'::uuid, '01,02,03,04'),
      ('00000000-0000-4000-8000-000000d1a001'::uuid, '01,02,03,04'),
      ('00000000-0000-4000-8000-000000d1a002'::uuid, '')) c(quien, esperado)
  loop
    perform pg_temp.como(v_caso.quien);
    set local role authenticated;
    select coalesce(string_agg(right(id::text, 2), ',' order by id), '') into v_vistos from public.reserva_enlaces;
    reset role;
    if v_vistos <> v_caso.esperado then
      raise exception 'D1 caso 3: % ve [%], esperaba [%]', v_caso.quien, v_vistos, v_caso.esperado;
    end if;
  end loop;
end $$;

-- Caso 4: alta inválida. Invitado b2 no emite para b1 (42501, la regla de reserva_enlace_emitir);
-- nadie emite para una secretaria ni para un médico de otra clínica (23514, el disparador); el
-- administrador de la otra clínica no emite en la 1 (42501).
do $$
begin
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1b002', gen_random_uuid(),
                           '00000000-0000-4000-8000-000000d1b001', 'unico', pg_temp.h('x1'));
    raise exception 'D1 caso 4: un invitado emitió un enlace de otro médico';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1a001', gen_random_uuid(),
                           '00000000-0000-4000-8000-000000d1e001', 'fijo', pg_temp.h('x2'));
    raise exception 'D1 caso 4: se emitió un enlace para una secretaria';
  exception when check_violation then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1a001', gen_random_uuid(),
                           '00000000-0000-4000-8000-000000d1a002', 'fijo', pg_temp.h('x3'));
    raise exception 'D1 caso 4: se emitió un enlace para un médico de otra clínica';
  exception when check_violation then null;
  end;
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1a002', gen_random_uuid(),
                           '00000000-0000-4000-8000-000000d1b001', 'unico', pg_temp.h('x4'));
    raise exception 'D1 caso 4: otra clínica emitió en la uno';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Caso 5: segundo fijo vigente del mismo médico → 23505 (insert directo del servidor; la
-- emisión normal revoca antes el vigente, caso 7)
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
    values (gen_random_uuid(), '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
            'fijo', pg_temp.h('f1-bis'));
    raise exception 'D1 caso 5: quedaron dos fijos vigentes';
  exception when unique_violation then null;
  end;
  reset role;
end $$;

-- Caso 6: lo emitido no se toca. authenticated no cambia código, médico ni vigencia, no marca
-- usado, no borra; revocar sí (sella fecha y autor) y no se reactiva.
do $$
declare v public.reserva_enlaces%rowtype;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000d1b001');
  set local role authenticated;
  begin
    update public.reserva_enlaces set codigo_hash = pg_temp.h('otro') where id = '00000000-0000-4000-8000-000000d1f002';
    raise exception 'D1 caso 6: se cambió el código de un enlace emitido';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reserva_enlaces set caduca_en = now() + interval '90 days' where id = '00000000-0000-4000-8000-000000d1f001';
    raise exception 'D1 caso 6: se alargó la vigencia de un único';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reserva_enlaces set usado_en = now(), usado_cita_id = gen_random_uuid()
     where id = '00000000-0000-4000-8000-000000d1f001';
    raise exception 'D1 caso 6: authenticated marcó un enlace como usado';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f001';
    raise exception 'D1 caso 6: authenticated borró un enlace';
  exception when insufficient_privilege then null;
  end;
  update public.reserva_enlaces set revocado_en = now() - interval '3 days', revocado_por = '00000000-0000-4000-8000-000000d1a002'
   where id = '00000000-0000-4000-8000-000000d1f001';
  begin
    update public.reserva_enlaces set revocado_en = null where id = '00000000-0000-4000-8000-000000d1f001';
    raise exception 'D1 caso 6: se reactivó un enlace revocado';
  exception when insufficient_privilege then null;
  end;
  reset role;
  select * into v from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f001';
  if v.revocado_en <> now() or v.revocado_por is distinct from '00000000-0000-4000-8000-000000d1b001' then
    raise exception 'D1 caso 6: la revocación no selló fecha y autor (%, %)', v.revocado_en, v.revocado_por;
  end if;
end $$;

-- Caso 7: regenerar el fijo. Si el alta falla (código mal formado), la revocación se deshace;
-- si va bien, el viejo queda revocado y el nuevo vigente. Un invitado no regenera el de otro.
-- (Desde 7a, regenerar es reserva_enlace_emitir con clase fijo; reserva_enlace_regenerar_fijo ya no
-- puede insertar con la sesión: falla entera, sin dejar revocado nada.)
do $$
begin
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1b001', '00000000-0000-4000-8000-000000d1f005',
                           '00000000-0000-4000-8000-000000d1b001', 'fijo', 'no-es-hex');
    raise exception 'D1 caso 7: regenerar aceptó un código mal formado';
  exception when check_violation then null;
  end;
  perform pg_temp.como('00000000-0000-4000-8000-000000d1b001');
  set local role authenticated;
  begin
    perform public.reserva_enlace_regenerar_fijo('00000000-0000-4000-8000-000000d1f005',
              '00000000-0000-4000-8000-000000d1b001', pg_temp.h('f1-sesion'));
    raise exception 'D1 caso 7: la sesión regeneró con reserva_enlace_regenerar_fijo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select revocado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f002') is not null then
    raise exception 'D1 caso 7: un regenerar fallido dejó revocado el fijo';
  end if;
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d1b001', '00000000-0000-4000-8000-000000d1f005',
                         '00000000-0000-4000-8000-000000d1b001', 'fijo', pg_temp.h('f1-nuevo'));
  begin
    perform pg_temp.emitir('00000000-0000-4000-8000-000000d1b001', gen_random_uuid(),
                           '00000000-0000-4000-8000-000000d1b002', 'fijo', pg_temp.h('f2-intruso'));
    raise exception 'D1 caso 7: un invitado regeneró el fijo de otro médico';
  exception when insufficient_privilege then null;
  end;
  if (select revocado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f002') is null
     or (select revocado_por from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f002')
          is distinct from '00000000-0000-4000-8000-000000d1b001'
     or (select revocado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f005') is not null
     or (select revocado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f003') is not null then
    raise exception 'D1 caso 7: regenerar no dejó viejo revocado (por b1) / nuevo vigente / el de b2 intacto';
  end if;
  -- Sin sesión (service_role, sin sub en los claims) no hay clínica: regenerar no hace nada y lo dice.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    perform public.reserva_enlace_regenerar_fijo(gen_random_uuid(), '00000000-0000-4000-8000-000000d1b001', pg_temp.h('sr'));
    raise exception 'D1 caso 7: service_role regeneró sin sesión';
  exception when invalid_parameter_value then null;
  end;
  reset role;
end $$;

-- Caso 8: service_role marca usado una sola vez; anon no ve nada ni ejecuta regenerar.
insert into public.reserva_avisos (version, texto_sha256) values ('v1-prueba-d1', pg_temp.h('aviso'));
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time,
  reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac,
  reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
values ('00000000-0000-4000-8000-000000d1d001', '00000000-0000-4000-8000-000000d1c001',
        '00000000-0000-4000-8000-000000d1b002', 'Ana Prueba', now() + interval '1 day', now() + interval '1 day 30 minutes',
        '00000000-0000-4000-8000-000000d1f003', 'fijo', 'Ana Prueba', '5512345678', 'ana@prueba.local',
        pg_temp.h('tel'), pg_temp.h('correo'), 'v1-prueba-d1', now(), 0);
do $$
begin
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d1b002', '00000000-0000-4000-8000-000000d1f006',
                         '00000000-0000-4000-8000-000000d1b002', 'unico', pg_temp.h('u2'));
  perform set_config('request.jwt.claims', '', true);
  insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time,
    reserva_enlace_id, reserva_canal, reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
    reserva_aceptado_en, reserva_historial_previo)
  values ('00000000-0000-4000-8000-000000d1d002', '00000000-0000-4000-8000-000000d1c001',
          '00000000-0000-4000-8000-000000d1b002', 'Beto Prueba', now() + interval '2 days', now() + interval '2 days 30 minutes',
          '00000000-0000-4000-8000-000000d1f006', 'unico', 'Beto Prueba', pg_temp.h('tel2'), pg_temp.h('correo2'),
          'v1-prueba-d1', now(), 0);
  set local role service_role;
  -- Con una cita que NO es de ese enlace (d001 nació de f003): no.
  begin
    update public.reserva_enlaces set usado_en = now(), usado_cita_id = '00000000-0000-4000-8000-000000d1d001'
     where id = '00000000-0000-4000-8000-000000d1f006';
    raise exception 'D1 caso 8: un enlace se marcó usado por la cita de otro enlace';
  exception when check_violation then null;
  end;
  update public.reserva_enlaces set usado_en = now() - interval '1 day', usado_cita_id = '00000000-0000-4000-8000-000000d1d002'
   where id = '00000000-0000-4000-8000-000000d1f006';
  begin
    update public.reserva_enlaces set usado_en = now() - interval '1 hour', usado_cita_id = '00000000-0000-4000-8000-000000d1d002'
     where id = '00000000-0000-4000-8000-000000d1f006';
    raise exception 'D1 caso 8: un enlace se marcó usado dos veces';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reserva_enlaces set usado_en = now(), usado_cita_id = '00000000-0000-4000-8000-000000d1d001'
     where id = '00000000-0000-4000-8000-000000d1f003';
    raise exception 'D1 caso 8: un fijo se marcó usado';
  exception when check_violation then null;
  end;
  begin
    delete from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f006';
    raise exception 'D1 caso 8: service_role borró un enlace';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select usado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d1f006') <> now() then
    raise exception 'D1 caso 8: usado_en no lo selló el disparador';
  end if;
  set local role anon;
  begin
    perform 1 from public.reserva_enlaces;
    raise exception 'D1 caso 8: anon leyó reserva_enlaces';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.reserva_avisos;
    raise exception 'D1 caso 8: anon leyó reserva_avisos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserva_enlace_regenerar_fijo(gen_random_uuid(), '00000000-0000-4000-8000-000000d1b001', pg_temp.h('an'));
    raise exception 'D1 caso 8: anon ejecutó regenerar';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 9: reserva_avisos. authenticated lee y no escribe; service_role tampoco escribe.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000d1b001');
  set local role authenticated;
  if not exists (select 1 from public.reserva_avisos where version = 'v1-prueba-d1') then
    raise exception 'D1 caso 9: authenticated no lee los avisos';
  end if;
  begin
    update public.reserva_avisos set aprobado = true, aprobado_en = now() where version = 'v1-prueba-d1';
    raise exception 'D1 caso 9: authenticated aprobó un aviso';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role service_role;
  begin
    insert into public.reserva_avisos (version, texto_sha256) values ('v2-intruso', pg_temp.h('x'));
    raise exception 'D1 caso 9: service_role escribió un aviso';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    update public.reserva_avisos set aprobado = true where version = 'v1-prueba-d1';
    raise exception 'D1 caso 9: un aviso quedó aprobado sin fecha';
  exception when check_violation then null;
  end;
end $$;

-- Caso 10: CHECK de coherencia de la cita y FK compuesta (misma clínica)
do $$
begin
  begin  -- canal sin seudónimos
    insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
      reserva_nombre, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
    values ('00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b002', 'X', now(), now() + interval '1 hour',
            '00000000-0000-4000-8000-000000d1f003', 'fijo', 'X', 'v1-prueba-d1', now(), 0);
    raise exception 'D1 caso 10: una reserva sin *_hmac pasó el CHECK';
  exception when check_violation then null;
  end;
  begin  -- datos de reserva sin canal
    insert into public.appointments (clinica_id, title, start_time, end_time, reserva_nombre)
    values ('00000000-0000-4000-8000-000000d1c001', 'X', now(), now() + interval '1 hour', 'Suelto');
    raise exception 'D1 caso 10: reserva_nombre sin canal pasó el CHECK';
  exception when check_violation then null;
  end;
  begin  -- teléfono que no es de 10 dígitos
    update public.appointments set reserva_telefono = '55-1234' where id = '00000000-0000-4000-8000-000000d1d001';
    raise exception 'D1 caso 10: un teléfono mal formado pasó el CHECK';
  exception when check_violation then null;
  end;
  begin  -- reagendados negativos
    update public.appointments set reserva_reagendados = -1 where id = '00000000-0000-4000-8000-000000d1d001';
    raise exception 'D1 caso 10: reagendados negativos pasaron';
  exception when check_violation then null;
  end;
  begin  -- cita de la clínica dos con un enlace de la uno
    insert into public.appointments (clinica_id, title, start_time, end_time, reserva_enlace_id, reserva_canal, reserva_nombre,
      reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
    values ('00000000-0000-4000-8000-000000d1c002', 'X', now(), now() + interval '1 hour', '00000000-0000-4000-8000-000000d1f003',
            'fijo', 'X', pg_temp.h('t'), pg_temp.h('c'), 'v1-prueba-d1', now(), 0);
    raise exception 'D1 caso 10: una cita apuntó al enlace de otra clínica';
  exception when foreign_key_violation then null;
  end;
  -- ARCO: teléfono y correo pueden quedar NULL; los seudónimos se quedan.
  update public.appointments set reserva_telefono = null, reserva_correo = null where id = '00000000-0000-4000-8000-000000d1d001';
  -- Ligar a un paciente no exige borrar los datos de contacto (lista A 9).
  if (select reserva_reagendados from public.appointments where id = '00000000-0000-4000-8000-000000d1d001') <> 0 then
    raise exception 'D1 caso 10: reserva_reagendados no nació en 0';
  end if;
  -- Una cita que usó un único no se borra (FK RESTRICT desde el enlace).
  begin
    delete from public.appointments where id = '00000000-0000-4000-8000-000000d1d002';
    raise exception 'D1 caso 10: se borró la cita que usó un enlace único';
  exception when foreign_key_violation then null;
  end;
end $$;

rollback;
