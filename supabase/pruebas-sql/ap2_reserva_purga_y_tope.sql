-- Reserva por enlace · M4 (20261204120000_reserva_purga_y_tope.sql, AG-DT-274): la purga a los 30
-- días (códigos, intentos de límites y el correo de los enlaces de un solo uso que ya no sirven) y
-- el tope de emisión de códigos en la base. Falla si M4 no está o se deshizo (caso 0).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback. No borra nada
-- de audit_log (cuenta sus filas antes y después).
-- Que el RESTO de reserva_codigo_emitir sigue igual lo prueban, sin cambios, d3_reservar_por_enlace,
-- k2_espera_codigo, k3_enlace_pausado y seg1_candado_correo.
-- Mutaciones comprobadas en rojo: quitar el tope de reserva_codigo_emitir → caso 1; quitar el plazo
-- del vaciado de correos → caso 3.
begin;

-- Caso 0: lo que deja M4 está, y sólo el servidor lo ejecuta.
do $$
begin
  if to_regprocedure('public.reserva_purgar(integer)') is null then
    raise exception 'AP2 caso 0: falta reserva_purgar(integer) (falta M4 o se deshizo)';
  end if;
  if has_function_privilege('anon', 'public.reserva_purgar(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reserva_purgar(integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.reserva_purgar(integer)', 'EXECUTE')
     or exists (select 1 from pg_proc p, aclexplode(p.proacl) x where p.oid = 'public.reserva_purgar(integer)'::regprocedure and x.grantee = 0)
     or not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.reserva_purgar(integer)'::regprocedure) then
    raise exception 'AP2 caso 0: reserva_purgar no es DEFINER con search_path vacío y sólo para service_role';
  end if;
  if (select count(*) from pg_index i join pg_class c on c.oid = i.indexrelid
       where c.relname in ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')
         and i.indisvalid) <> 3 then
    raise exception 'AP2 caso 0: faltan los índices de M4';
  end if;
  if has_table_privilege('service_role', 'public.reserva_verificaciones', 'DELETE')
     or has_table_privilege('authenticated', 'public.reserva_verificaciones', 'DELETE') then
    raise exception 'AP2 caso 0: algún rol de la app tiene DELETE sobre reserva_verificaciones';
  end if;
end $$;

-- ── Datos: dos clínicas con la v2 encendida, cada una con su médico y su enlace fijo; en la 1, enlaces de un solo uso.
insert into public.clinicas (id, nombre) values
  ('00000000-0000-4000-8000-0000000a92c1', 'AP2 uno'), ('00000000-0000-4000-8000-0000000a92c2', 'AP2 dos');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000a92b1'::uuid, 'ap2-b1@prueba.local'),
               ('00000000-0000-4000-8000-0000000a92b2'::uuid, 'ap2-b2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a92c1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a92b1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000a92c2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000a92b2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000a92c1', true), ('00000000-0000-4000-8000-0000000a92c2', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-0000000a92f1', '00000000-0000-4000-8000-0000000a92c1', '00000000-0000-4000-8000-0000000a92b1', 'fijo', pg_temp.h('ap2f1')),
  ('00000000-0000-4000-8000-0000000a92f2', '00000000-0000-4000-8000-0000000a92c2', '00000000-0000-4000-8000-0000000a92b2', 'fijo', pg_temp.h('ap2f2'));
-- Únicos de la clínica 1 (como postgres), todos con correo:
--   e1 caducó hace 40 días · e2 vigente · e3 revocado hace 10 días (aún no caduca) · e4 agotado hace 31 días · e5 caducó hace 29 días.
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en, revocado_en, intentos, agotado_en,
                                    correo, correo_hmac, created_at)
select ('00000000-0000-4000-8000-0000000a92e' || n)::uuid, '00000000-0000-4000-8000-0000000a92c1', '00000000-0000-4000-8000-0000000a92b1',
       'unico', pg_temp.h('ap2e' || n), 7, x.caduca, x.revocado, x.intentos, x.agotado,
       'paciente' || n || '@prueba.local', pg_temp.h('c:paciente' || n), now() - interval '50 days'
  from (values (1, now() - interval '40 days', null::timestamptz, 0, null::timestamptz),
               (2, now() + interval '5 days',  null, 0, null),
               (3, now() + interval '5 days',  now() - interval '10 days', 0, null),
               (4, now() + interval '5 days',  null, 5, now() - interval '31 days'),
               (5, now() - interval '29 days', null, 0, null)) x(n, caduca, revocado, intentos, agotado);

-- Como el servidor: pedir un código en el enlace fijo de la clínica dada.
create function pg_temp.emitir(p_clinica integer, p_correo text, p_codigo text) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  v := public.reserva_codigo_emitir(('00000000-0000-4000-8000-0000000a92c' || p_clinica)::uuid, ('00000000-0000-4000-8000-0000000a92f' || p_clinica)::uuid,
                                    pg_temp.h('c:' || p_correo), pg_temp.h('cod:' || p_codigo));
  reset role;
  return v;
end $$;

-- Caso 1: el tope. Tres códigos por correo en 60 minutos, contados en TODA la tabla; el cuarto, 'limite',
-- y no escribe nada. Otro correo no se ve afectado. Pasada la hora, vuelve a haber sitio.
do $$
declare v text; v_n bigint;
begin
  for i in 1..3 loop
    v := pg_temp.emitir(1, 'ana', 'a' || i);
    if v <> 'ok' then raise exception 'AP2 caso 1: el código % salió %', i, v; end if;
  end loop;
  select count(*) into v_n from public.reserva_verificaciones where correo_hmac = pg_temp.h('c:ana');
  v := pg_temp.emitir(1, 'ana', 'a4');
  if v <> 'limite' then raise exception 'AP2 caso 1: el cuarto código en una hora salió % (esperaba limite)', v; end if;
  if (select count(*) from public.reserva_verificaciones where correo_hmac = pg_temp.h('c:ana')) <> v_n then
    raise exception 'AP2 caso 1: el código rechazado por el tope dejó una fila';
  end if;
  -- El rechazado no invalidó el código vigente (el UPDATE de intentos va después del tope).
  if (select count(*) from public.reserva_verificaciones where correo_hmac = pg_temp.h('c:ana') and intentos < 5) <> 1 then
    raise exception 'AP2 caso 1: tras el rechazo no queda exactamente un código vigente';
  end if;
  -- El mismo correo, por el enlace de OTRA clínica: el tope es global por correo.
  v := pg_temp.emitir(2, 'ana', 'a5');
  if v <> 'limite' then raise exception 'AP2 caso 1: el tope no cuenta el mismo correo en otro enlace (%)', v; end if;
  v := pg_temp.emitir(1, 'beto', 'b1');
  if v <> 'ok' then raise exception 'AP2 caso 1: el tope de un correo frenó a otro (%)', v; end if;
  update public.reserva_verificaciones set created_at = created_at - interval '61 minutes' where correo_hmac = pg_temp.h('c:ana');
  v := pg_temp.emitir(1, 'ana', 'a6');
  if v <> 'ok' then raise exception 'AP2 caso 1: pasada la hora no volvió a haber sitio (%)', v; end if;
end $$;

-- Caso 2: el correo de un enlace sigue sin poder cambiarse por ningún otro camino (la sesión y
-- service_role: 42501), tampoco para vaciarlo, tampoco en un enlace ya caducado.
do $$
declare v_sql text;
begin
  foreach v_sql in array array[
    $q$update public.reserva_enlaces set correo = null, correo_hmac = null where id = '00000000-0000-4000-8000-0000000a92e1'$q$,
    $q$update public.reserva_enlaces set correo = null, correo_hmac = null where id = '00000000-0000-4000-8000-0000000a92e2'$q$,
    $q$update public.reserva_enlaces set correo = 'otro@prueba.local' where id = '00000000-0000-4000-8000-0000000a92e2'$q$]
  loop
    set local role service_role;
    begin
      execute v_sql;
      raise exception 'AP2 caso 2: service_role pudo hacer «%»', v_sql;
    exception when insufficient_privilege then null;
    end;
    reset role;
    perform pg_temp.como('00000000-0000-4000-8000-0000000a92b1');
    set local role authenticated;
    begin
      execute v_sql;
      raise exception 'AP2 caso 2: la sesión del administrador pudo hacer «%»', v_sql;
    exception when insufficient_privilege then null;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
  end loop;
end $$;

-- Lo viejo que la purga tiene que llevarse, y lo reciente que no: códigos de 40 y 31 días y los de hoy;
-- intentos de límites de 45 días y de hoy.
update public.reserva_verificaciones set created_at = now() - interval '40 days', caduca_en = now() - interval '40 days' + interval '10 minutes'
 where correo_hmac = pg_temp.h('c:beto');
insert into public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
values ('00000000-0000-4000-8000-0000000a92c1', '00000000-0000-4000-8000-0000000a92f1', pg_temp.h('c:carla'), pg_temp.h('cod:c1'),
        now() - interval '31 days' + interval '10 minutes', now() - interval '31 days'),
       ('00000000-0000-4000-8000-0000000a92c1', '00000000-0000-4000-8000-0000000a92f1', pg_temp.h('c:dani'), pg_temp.h('cod:d1'),
        now() - interval '29 days' + interval '10 minutes', now() - interval '29 days');
insert into public.ip_rate_limits (ip, ruta, created_at) values
  ('ap2-viejo', 'ap2:prueba', now() - interval '45 days'), ('ap2-viejo', 'ap2:prueba', now() - interval '31 days'),
  ('ap2-nuevo', 'ap2:prueba', now() - interval '29 days'), ('ap2-nuevo', 'ap2:prueba', now());

-- Caso 3: la purga. Por lotes (con lote 1 se lleva una de cada y dice que quedan); se lleva sólo lo de
-- más de 30 días; vacía el correo sólo de los únicos que dejaron de servir hace más de 30 días (e1, e4)
-- y deja una fila de audit_log por pasada con sólo números.
do $$
declare r record; v_audit bigint; v_desc text;
begin
  select count(*) into v_audit from public.audit_log where accion = 'reserva_purga';
  set local role service_role;
  select * into r from public.reserva_purgar(1);
  reset role;
  if (r.r_verificaciones, r.r_limites, r.r_correos, r.r_quedan) is distinct from (1, 1, 1, true) then
    raise exception 'AP2 caso 3: con lote 1 la pasada dio % (esperaba 1, 1, 1, quedan)', r;
  end if;
  set local role service_role;
  select * into r from public.reserva_purgar(null);
  reset role;
  if r.r_quedan then raise exception 'AP2 caso 3: la segunda pasada dice que quedan (%)', r; end if;
  -- Códigos: quedan los de ana (hoy y de hace 61 min) y el de dani (29 días); se fueron el de beto (40) y el de carla (31).
  if exists (select 1 from public.reserva_verificaciones where correo_hmac in (pg_temp.h('c:beto'), pg_temp.h('c:carla')))
     or not exists (select 1 from public.reserva_verificaciones where correo_hmac = pg_temp.h('c:dani'))
     or (select count(*) from public.reserva_verificaciones where correo_hmac = pg_temp.h('c:ana')) <> 4 then
    raise exception 'AP2 caso 3: la purga de códigos no se llevó exactamente los de más de 30 días';
  end if;
  if (select count(*) from public.ip_rate_limits where ip = 'ap2-viejo') <> 0
     or (select count(*) from public.ip_rate_limits where ip = 'ap2-nuevo') <> 2 then
    raise exception 'AP2 caso 3: la purga de ip_rate_limits no se llevó exactamente lo de más de 30 días';
  end if;
  -- Correos: e1 (caducó hace 40 días) y e4 (agotado hace 31) vaciados; e2 (vigente), e3 (revocado hace 10) y e5 (caducó hace 29), intactos.
  if (select string_agg(right(id::text, 2), ',' order by id) from public.reserva_enlaces
       where clinica_id = '00000000-0000-4000-8000-0000000a92c1' and clase = 'unico' and correo is null and correo_hmac is null) is distinct from 'e1,e4' then
    raise exception 'AP2 caso 3: se vaciaron otros correos que e1 y e4 (%)',
      (select string_agg(right(id::text, 2) || '=' || coalesce(correo, 'NULL'), ' ' order by id) from public.reserva_enlaces
        where clinica_id = '00000000-0000-4000-8000-0000000a92c1' and clase = 'unico');
  end if;
  -- El enlace vaciado sigue ahí, con todo lo demás igual.
  if not exists (select 1 from public.reserva_enlaces where id = '00000000-0000-4000-8000-0000000a92e1'
                    and codigo_hash = pg_temp.h('ap2e1') and vigencia_dias = 7 and caduca_en < now()) then
    raise exception 'AP2 caso 3: el vaciado tocó algo más que el correo del enlace e1';
  end if;
  -- Dos pasadas, dos filas de registro, y sólo números.
  if (select count(*) from public.audit_log where accion = 'reserva_purga') <> v_audit + 2 then
    raise exception 'AP2 caso 3: no hay una fila de audit_log por pasada';
  end if;
  select descripcion into v_desc from public.audit_log where accion = 'reserva_purga' and user_id = 'system'
   order by id desc limit 1;
  if v_desc is null or (v_desc::jsonb ->> 'dias') <> '30' or v_desc ~ '[0-9a-f]{32}' or v_desc ~ '@' then
    raise exception 'AP2 caso 3: el registro de la pasada no es sólo números (%)', v_desc;
  end if;
  -- Una pasada sin nada que hacer también deja su fila.
  set local role service_role;
  select * into r from public.reserva_purgar(5000);
  reset role;
  if (r.r_verificaciones, r.r_limites, r.r_correos, r.r_quedan) is distinct from (0, 0, 0, false)
     or (select count(*) from public.audit_log where accion = 'reserva_purga') <> v_audit + 3 then
    raise exception 'AP2 caso 3: una pasada vacía no dio ceros o no dejó su registro (%)', r;
  end if;
end $$;

-- Caso 4: nadie con sesión ni sin ella la ejecuta.
do $$
begin
  set local role anon;
  begin
    perform public.reserva_purgar(1);
    raise exception 'AP2 caso 4: anon ejecutó reserva_purgar';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-0000000a92b1');
  set local role authenticated;
  begin
    perform public.reserva_purgar(1);
    raise exception 'AP2 caso 4: la sesión del administrador ejecutó reserva_purgar';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
