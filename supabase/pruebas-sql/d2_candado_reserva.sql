-- Agenda D2 — candado de la reserva por enlace: incidencias (cancelación y
-- no_show), bloqueo y desbloqueo manual, estado del contacto y lista de
-- bloqueados (20261114130000_agenda_d2_candado_reserva.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Clínica 1: administrador (a1), médicos invitados b1 y b2, secretaria (e1). Clínica 2: a2.
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-000000d2c001', 'D2 prueba uno'),
  ('00000000-0000-4000-8000-000000d2c002', 'D2 prueba dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000d2a001'::uuid, 'd2-admin@prueba.local'),
               ('00000000-0000-4000-8000-000000d2b001'::uuid, 'd2-medico-b@prueba.local'),
               ('00000000-0000-4000-8000-000000d2b002'::uuid, 'd2-medico-c@prueba.local'),
               ('00000000-0000-4000-8000-000000d2e001'::uuid, 'd2-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-000000d2a002'::uuid, 'd2-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d2c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d2a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d2c001'
 where id in ('00000000-0000-4000-8000-000000d2b001', '00000000-0000-4000-8000-000000d2b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d2c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000d2e001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d2c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d2a002';

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;

-- Enlaces fijos de b1 y b2 (como postgres: la protección no aplica) y un aviso.
insert into public.reserva_avisos (version, texto_sha256) values ('v1-prueba-d2', pg_temp.h('aviso'));
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000d2f001', '00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b001', 'fijo', pg_temp.h('f1')),
  ('00000000-0000-4000-8000-000000d2f002', '00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b002', 'fijo', pg_temp.h('f2'));

-- Cita por enlace: id, médico, teléfono y correo (texto: se seudonimizan con pg_temp.h).
create function pg_temp.cita(p_id uuid, p_medico uuid, p_tel text, p_correo text) returns void language sql as $$
  insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
    reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
    reserva_aceptado_en, reserva_historial_previo)
  values (p_id, '00000000-0000-4000-8000-000000d2c001', p_medico, 'Persona', now() + interval '2 days', now() + interval '2 days 30 min',
          case p_medico when '00000000-0000-4000-8000-000000d2b001' then '00000000-0000-4000-8000-000000d2f001'::uuid
                        else '00000000-0000-4000-8000-000000d2f002'::uuid end,
          'fijo', 'Persona', p_tel, p_correo || '@prueba.local', pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_correo), 'v1-prueba-d2', now(), 0);
$$;
create function pg_temp.estado(p_medico uuid, p_tel text, p_correo text)
returns table (bloqueado boolean, manual boolean, cancelaciones integer, no_shows integer, hasta timestamptz)
language sql as $$
  select * from public.reserva_contacto_estado('00000000-0000-4000-8000-000000d2c001', p_medico,
                                               pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_correo));
$$;
create function pg_temp.vivas(p_cita uuid) returns bigint language sql as $$
  select count(*) from public.reserva_incidencias where appointment_id = p_cita and anulada_en is null;
$$;

-- Persona P: 5500000001 / p. Cuatro citas con b1.
select pg_temp.cita(('00000000-0000-4000-8000-000000d2d00' || n)::uuid, '00000000-0000-4000-8000-000000d2b001', '5500000001', 'p')
  from generate_series(1, 4) n;
-- Una cita de b1 SIN reserva (la agenda el personal): su cancelación no cuenta.
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time)
values ('00000000-0000-4000-8000-000000d2d009', '00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b001',
        'Sin reserva', now() + interval '3 days', now() + interval '3 days 30 min');

-- Caso 1: cancelar cuenta 1; reactivar la anula; cancelled → no_show no cuenta doble; volver a
-- cancelar cuenta otra vez. La cita del personal no deja incidencia.
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000d2d001';
do $$
begin
  if pg_temp.vivas('00000000-0000-4000-8000-000000d2d001') <> 1
     or (select tipo from public.reserva_incidencias where appointment_id = '00000000-0000-4000-8000-000000d2d001') <> 'cancelacion' then
    raise exception 'D2 caso 1: cancelar no dejó una incidencia de cancelación';
  end if;
end $$;
update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000d2d001';
do $$
begin
  if pg_temp.vivas('00000000-0000-4000-8000-000000d2d001') <> 0 then
    raise exception 'D2 caso 1: reactivar no anuló la incidencia';
  end if;
end $$;
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000d2d001';
update public.appointments set status = 'no_show' where id = '00000000-0000-4000-8000-000000d2d001';
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000d2d009';
do $$
begin
  if pg_temp.vivas('00000000-0000-4000-8000-000000d2d001') <> 1
     or (select tipo from public.reserva_incidencias
          where appointment_id = '00000000-0000-4000-8000-000000d2d001' and anulada_en is null) <> 'no_show' then
    raise exception 'D2 caso 1: cancelled → no_show contó doble o no re-etiquetó';
  end if;
  if exists (select 1 from public.reserva_incidencias where appointment_id = '00000000-0000-4000-8000-000000d2d009') then
    raise exception 'D2 caso 1: la cancelación de una cita del personal dejó incidencia';
  end if;
  if (select (cancelaciones, no_shows, bloqueado) from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5500000001', 'p'))
     is distinct from (0, 1, false) then
    raise exception 'D2 caso 1: el estado no dice 0 cancelaciones / 1 no_show / sin bloqueo';
  end if;
end $$;

-- Caso 2: con 3 incidencias, bloqueado; «hasta» = la 3.ª más reciente + 60 días.
-- La segunda llega por el camino de C2 (service_role, sin sesión): también cuenta.
set local role service_role;
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000d2d002';
reset role;
update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000d2d003';
update public.reserva_incidencias set created_at = now() - interval '10 days'
 where appointment_id = '00000000-0000-4000-8000-000000d2d001';
update public.reserva_incidencias set created_at = now() - interval '5 days'
 where appointment_id = '00000000-0000-4000-8000-000000d2d002';
do $$
declare e record;
begin
  select * into e from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5500000001', 'p');
  if not e.bloqueado or e.manual or e.cancelaciones <> 2 or e.no_shows <> 1
     or e.hasta <> now() - interval '10 days' + interval '60 days' then
    raise exception 'D2 caso 2: con 3 incidencias esperaba bloqueo hasta now()+50d (%)', row_to_json(e);
  end if;
end $$;

-- Caso 3: una incidencia de hace 61 días ya no cuenta (el candado se levanta solo)
update public.reserva_incidencias set created_at = now() - interval '61 days'
 where appointment_id = '00000000-0000-4000-8000-000000d2d001';
do $$
declare e record;
begin
  select * into e from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5500000001', 'p');
  if e.bloqueado or e.no_shows <> 0 or e.cancelaciones <> 2 or e.hasta is not null then
    raise exception 'D2 caso 3: una incidencia de hace 61 días siguió contando (%)', row_to_json(e);
  end if;
end $$;
update public.reserva_incidencias set created_at = now() - interval '10 days'
 where appointment_id = '00000000-0000-4000-8000-000000d2d001';

-- Caso 4: basta coincidir sólo por correo; otro médico no hereda.
-- seg1 (decisión de Angel, 20261117130000): lo automático cuenta SÓLO por el
-- correo; coincidir sólo por el teléfono ya no bloquea (antes, sí).
do $$
begin
  if not (select bloqueado from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5599999999', 'p')) then
    raise exception 'D2 caso 4: coincidir sólo por el correo no bastó';
  end if;
  if (select bloqueado from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5500000001', 'otro-correo')) then
    raise exception 'D2 caso 4: coincidir sólo por el teléfono bloqueó (seg1: lo automático es por correo)';
  end if;
  if (select bloqueado from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5599999999', 'otro-correo')) then
    raise exception 'D2 caso 4: un contacto sin relación quedó bloqueado';
  end if;
  if (select bloqueado from pg_temp.estado('00000000-0000-4000-8000-000000d2b002', '5500000001', 'p')) then
    raise exception 'D2 caso 4: otro médico de la misma clínica heredó el bloqueo';
  end if;
end $$;

-- Caso 5: quién ve qué (tablas y funciones). b1 ve sus 3 incidencias; b2, ninguna; secretaria y
-- administrador, las 3; la otra clínica, ninguna; anon, nada.
do $$
declare
  v_caso record;
  v_n bigint;
  v_lista bigint;
begin
  for v_caso in select * from (values
      ('00000000-0000-4000-8000-000000d2b001'::uuid, 3, 1),
      ('00000000-0000-4000-8000-000000d2b002'::uuid, 0, 0),
      ('00000000-0000-4000-8000-000000d2e001'::uuid, 3, 1),
      ('00000000-0000-4000-8000-000000d2a001'::uuid, 3, 1),
      ('00000000-0000-4000-8000-000000d2a002'::uuid, 0, 0)) c(quien, incidencias, bloqueados)
  loop
    perform pg_temp.como(v_caso.quien);
    set local role authenticated;
    select count(*) into v_n from public.reserva_incidencias where anulada_en is null;
    select count(*) into v_lista from public.reserva_contactos_bloqueados();
    reset role;
    if v_n <> v_caso.incidencias or v_lista <> v_caso.bloqueados then
      raise exception 'D2 caso 5: % ve % incidencias y % bloqueados; esperaba % y %',
        v_caso.quien, v_n, v_lista, v_caso.incidencias, v_caso.bloqueados;
    end if;
  end loop;
  -- La otra clínica, aunque pase el clinica_id y los seudónimos correctos, no ve el bloqueo.
  perform pg_temp.como('00000000-0000-4000-8000-000000d2a002');
  set local role authenticated;
  if (select bloqueado from public.reserva_contacto_estado('00000000-0000-4000-8000-000000d2c001',
        '00000000-0000-4000-8000-000000d2b001', pg_temp.h('t:5500000001'), pg_temp.h('c:p'))) then
    raise exception 'D2 caso 5: otra clínica leyó el estado de un contacto ajeno';
  end if;
  reset role;
  set local role anon;
  begin
    perform 1 from public.reserva_incidencias;
    raise exception 'D2 caso 5: anon leyó reserva_incidencias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.reserva_contactos;
    raise exception 'D2 caso 5: anon leyó reserva_contactos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserva_contacto_estado('00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b001',
                                           pg_temp.h('t:5500000001'), pg_temp.h('c:p'));
    raise exception 'D2 caso 5: anon ejecutó reserva_contacto_estado';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 6: nadie con sesión escribe incidencias; no se falsea quién ni cuándo bloqueó; sin DELETE.
do $$
declare v public.reserva_contactos%rowtype;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000d2a001');
  set local role authenticated;
  begin
    insert into public.reserva_incidencias (clinica_id, medico_id, appointment_id, tipo, tel_hmac, correo_hmac)
    values ('00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b001',
            '00000000-0000-4000-8000-000000d2d004', 'cancelacion', pg_temp.h('x'), pg_temp.h('y'));
    raise exception 'D2 caso 6: authenticated insertó una incidencia';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reserva_incidencias set anulada_en = now();
    raise exception 'D2 caso 6: authenticated anuló incidencias';
  exception when insufficient_privilege then null;
  end;
  insert into public.reserva_contactos (id, clinica_id, medico_id, clave_hmac, clase, bloqueado_en, bloqueado_por, created_at)
  values ('00000000-0000-4000-8000-000000d2e0c1', '00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b002',
          pg_temp.h('t:5511111111'), 'telefono', now() - interval '1 year', '00000000-0000-4000-8000-000000d2a002',
          now() - interval '1 year');
  begin
    update public.reserva_contactos set bloqueado_en = null where id = '00000000-0000-4000-8000-000000d2e0c1';
    raise exception 'D2 caso 6: se quitó un bloqueo borrando bloqueado_en';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reserva_contactos set clave_hmac = pg_temp.h('t:otro') where id = '00000000-0000-4000-8000-000000d2e0c1';
    raise exception 'D2 caso 6: se cambió la identidad de un contacto';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.reserva_contactos where id = '00000000-0000-4000-8000-000000d2e0c1';
    raise exception 'D2 caso 6: authenticated borró un contacto';
  exception when insufficient_privilege then null;
  end;
  reset role;
  select * into v from public.reserva_contactos where id = '00000000-0000-4000-8000-000000d2e0c1';
  if v.bloqueado_en <> now() or v.created_at <> now() or v.bloqueado_por is distinct from '00000000-0000-4000-8000-000000d2a001' then
    raise exception 'D2 caso 6: el alta no selló fecha y autor del bloqueo (%)', row_to_json(v);
  end if;
  -- Un bloqueo manual sin incidencias basta (b2, sólo el teléfono).
  if not (select bloqueado and manual from pg_temp.estado('00000000-0000-4000-8000-000000d2b002', '5511111111', 'nadie')) then
    raise exception 'D2 caso 6: un bloqueo manual sin incidencias no bloqueó';
  end if;
  -- Ni la otra clínica ni service_role escriben contactos.
  set local role service_role;
  begin
    insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase)
    values ('00000000-0000-4000-8000-000000d2c001', '00000000-0000-4000-8000-000000d2b001', pg_temp.h('z'), 'correo');
    raise exception 'D2 caso 6: service_role escribió un contacto';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 7: desbloquear desde una cita pone el conteo en 0 (y vuelve a contar lo nuevo); volver a
-- bloquear es manual. Un invitado no marca citas de otro médico (0 filas); service_role no ejecuta.
do $$
declare
  e record;
  v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000d2b002');
  set local role authenticated;
  v_n := public.reserva_contacto_marcar('00000000-0000-4000-8000-000000d2d003', 'desbloquear');
  reset role;
  if v_n <> 0 then
    raise exception 'D2 caso 7: un invitado marcó el contacto de una cita de otro médico';
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000d2e001');
  set local role authenticated;
  v_n := public.reserva_contacto_marcar('00000000-0000-4000-8000-000000d2d003', 'desbloquear');
  reset role;
  select * into e from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5500000001', 'p');
  if v_n <> 2 or e.bloqueado or e.cancelaciones <> 0 or e.no_shows <> 0 then
    raise exception 'D2 caso 7: desbloquear no dejó el conteo en 0 (n=%, %)', v_n, row_to_json(e);
  end if;
  if (select count(*) from public.reserva_contactos where perdonado_por = '00000000-0000-4000-8000-000000d2e001') <> 2 then
    raise exception 'D2 caso 7: el desbloqueo no quedó firmado por la secretaria en las dos claves';
  end if;
  -- En la vida real el bloqueo llega en otra transacción, después: se adelanta el desbloqueo una
  -- hora para que bloqueado_en (now()) sea posterior.
  update public.reserva_contactos set perdonado_en = now() - interval '1 hour'
   where perdonado_por = '00000000-0000-4000-8000-000000d2e001';
  perform pg_temp.como('00000000-0000-4000-8000-000000d2b001');
  set local role authenticated;
  v_n := public.reserva_contacto_marcar('00000000-0000-4000-8000-000000d2d004', 'bloquear');
  reset role;
  select * into e from pg_temp.estado('00000000-0000-4000-8000-000000d2b001', '5599999999', 'p');
  if v_n <> 2 or not e.bloqueado or not e.manual then
    raise exception 'D2 caso 7: el médico no pudo volver a bloquear a su contacto (%)', row_to_json(e);
  end if;
  begin
    perform public.reserva_contacto_marcar('00000000-0000-4000-8000-000000d2d004', 'borrar');
    raise exception 'D2 caso 7: una acción desconocida pasó';
  exception when invalid_parameter_value then null;
  end;
  set local role service_role;
  begin
    perform public.reserva_contacto_marcar('00000000-0000-4000-8000-000000d2d004', 'desbloquear');
    raise exception 'D2 caso 7: service_role ejecutó reserva_contacto_marcar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.reserva_contactos_bloqueados();
    raise exception 'D2 caso 7: service_role ejecutó reserva_contactos_bloqueados';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Caso 8: lo que el disparador escribió quedó auditado por el cambio de la cita (no aparte), y
-- los contactos sí van a audit_log por log_tabla_change.
do $$
begin
  if (select count(*) from public.audit_log where tabla = 'reserva_incidencias') <> 0 then
    raise exception 'D2 caso 8: las incidencias se auditaron aparte';
  end if;
  if (select count(*) from public.audit_log where tabla = 'reserva_contactos'
        and registro_id in (select id from public.reserva_contactos where clinica_id = '00000000-0000-4000-8000-000000d2c001')) < 3 then
    raise exception 'D2 caso 8: los contactos no quedaron en audit_log';
  end if;
end $$;

rollback;
