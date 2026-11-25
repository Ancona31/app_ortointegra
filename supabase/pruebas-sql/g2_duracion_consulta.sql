-- Agenda G2 — la duración de la consulta (tipo principal), la duración por
-- consultorio, la policy tipos_cita_insert (el médico crea SUS tipos) y los
-- tipos de reserva_contexto (20261119120000_agenda_g2_duracion_consulta.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- c1 (VIP, v2 encendida): administrador a1, médicos invitados b1 y b2, secretaria d1.
-- c2: su administrador a2. Consultorios: k1 de b1, k2 de b2, k3 de a1.
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000062c1', 'G2 prueba uno', true),
  ('00000000-0000-4000-8000-0000000062c2', 'G2 prueba dos', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000062a1'::uuid, 'g2-admin@prueba.local'),
               ('00000000-0000-4000-8000-0000000062b1'::uuid, 'g2-medico-b@prueba.local'),
               ('00000000-0000-4000-8000-0000000062b2'::uuid, 'g2-medico-c@prueba.local'),
               ('00000000-0000-4000-8000-0000000062d1'::uuid, 'g2-secretaria@prueba.local'),
               ('00000000-0000-4000-8000-0000000062a2'::uuid, 'g2-admin-dos@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000062c1', es_admin_de_clinica = true,
                           nombres = 'Admin', apellido_paterno = 'Prueba'
 where id = '00000000-0000-4000-8000-0000000062a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000062c1', nombres = 'Invitado', apellido_paterno = 'Prueba'
 where id in ('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062b2');
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000062c1', role = 'secretaria'
 where id = '00000000-0000-4000-8000-0000000062d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000062c2', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000062a2';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000062c1', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000062cc01', '00000000-0000-4000-8000-0000000062c1', '00000000-0000-4000-8000-0000000062b1', 'Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-00000062cc02', '00000000-0000-4000-8000-0000000062c1', '00000000-0000-4000-8000-0000000062b2', 'Dos', 'Dos', 'Calle 2', true),
  ('00000000-0000-4000-8000-00000062cc03', '00000000-0000-4000-8000-0000000062c1', '00000000-0000-4000-8000-0000000062a1', 'Tres', 'Tres', 'Calle 3', true);

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Un alta como `quien`; devuelve el SQLSTATE ('ok' si entró).
create function pg_temp.alta(p_quien uuid, p_clinica uuid, p_medico uuid, p_nombre text, p_dur integer,
                             p_principal boolean, p_consultorio uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quien, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal, consultorio_id)
  values (p_clinica, p_medico, p_nombre, p_dur, p_principal, p_consultorio);
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate;
end $$;
grant execute on function pg_temp.alta(uuid, uuid, uuid, text, integer, boolean, uuid) to authenticated;

create function pg_temp.esperar(p_caso text, p_valor text, p_esperado text) returns void language plpgsql as $$
begin
  if p_valor is distinct from p_esperado then
    raise exception 'G2 %: dio [%], esperaba [%]', p_caso, p_valor, p_esperado;
  end if;
end $$;

-- Caso 1 (punto 9): el médico invitado crea SU duración (principal) y otro tipo suyo.
select pg_temp.esperar('caso 1 principal del invitado',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Consulta', 45, true, null), 'ok');
select pg_temp.esperar('caso 1 tipo de más del invitado',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Primera vez', 60, false, null), 'ok');

-- Caso 2: el invitado NO crea de toda la clínica (la policy: 42501). De otro médico o en otra
-- clínica lo para antes validar_tipo_cita_medico (B6, 23514: no ve ese perfil o no es de esa
-- clínica), que va ANTES que el WITH CHECK; da igual cuál de los dos, pero no entra.
select pg_temp.esperar('caso 2 invitado, toda la clínica',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1', null, 'Intruso', 30, false, null), '42501');
select pg_temp.esperar('caso 2 invitado, de otro médico',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b2', 'Intruso', 30, true, null), '23514');
select pg_temp.esperar('caso 2 invitado, otra clínica',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c2',
               '00000000-0000-4000-8000-0000000062b1', 'Intruso', 30, false, null), '23514');

-- Caso 3: el administrador, como hoy: de toda la clínica y de cualquier médico.
-- La secretaria, como hoy: nada. El administrador de OTRA clínica: nada en ésta.
select pg_temp.esperar('caso 3 admin, toda la clínica',
  pg_temp.alta('00000000-0000-4000-8000-0000000062a1', '00000000-0000-4000-8000-0000000062c1', null, 'Revisión', 20, false, null), 'ok');
select pg_temp.esperar('caso 3 admin, principal de b2',
  pg_temp.alta('00000000-0000-4000-8000-0000000062a1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b2', 'Consulta', 30, true, null), 'ok');
select pg_temp.esperar('caso 3 secretaria, de la clínica',
  pg_temp.alta('00000000-0000-4000-8000-0000000062d1', '00000000-0000-4000-8000-0000000062c1', null, 'Intruso', 30, false, null), '42501');
select pg_temp.esperar('caso 3 secretaria, de sí misma',
  pg_temp.alta('00000000-0000-4000-8000-0000000062d1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062d1', 'Intruso', 30, false, null), '23514');  -- no es médico (B6)
select pg_temp.esperar('caso 3 admin de otra clínica',
  pg_temp.alta('00000000-0000-4000-8000-0000000062a2', '00000000-0000-4000-8000-0000000062c1', null, 'Intruso', 30, false, null), '42501');

-- Caso 4 (punto 7): duración distinta en UN consultorio, con el mismo nombre del principal.
-- La de un consultorio ajeno (de otro médico) la para validar_tipo_cita_consultorio (23514).
select pg_temp.esperar('caso 4 por consultorio propio',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Consulta', 60, true, '00000000-0000-4000-8000-00000062cc01'), 'ok');
select pg_temp.esperar('caso 4 consultorio de otro médico',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Consulta', 60, true, '00000000-0000-4000-8000-00000062cc02'), '23514');
-- El administrador no ve los consultorios de b2 (consultorios_select): falla cerrado.
select pg_temp.esperar('caso 4 admin, consultorio de otro',
  pg_temp.alta('00000000-0000-4000-8000-0000000062a1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b2', 'Consulta', 60, true, '00000000-0000-4000-8000-00000062cc02'), '23514');

-- Caso 5: uno activo por médico y uno por consultorio (23505); los CHECK (23514).
select pg_temp.esperar('caso 5 segundo principal general',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Otra', 30, true, null), '23505');
select pg_temp.esperar('caso 5 segundo principal en el mismo consultorio',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Otra', 30, true, '00000000-0000-4000-8000-00000062cc01'), '23505');
select pg_temp.esperar('caso 5 nombre repetido en el ámbito general',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', ' primera VEZ ', 30, false, null), '23505');
select pg_temp.esperar('caso 5 principal sin médico',
  pg_temp.alta('00000000-0000-4000-8000-0000000062a1', '00000000-0000-4000-8000-0000000062c1', null, 'Base', 30, true, null), '23514');
select pg_temp.esperar('caso 5 consultorio en un tipo que no es principal',
  pg_temp.alta('00000000-0000-4000-8000-0000000062b1', '00000000-0000-4000-8000-0000000062c1',
               '00000000-0000-4000-8000-0000000062b1', 'Suelta', 30, false, '00000000-0000-4000-8000-00000062cc01'), '23514');

-- Caso 6: desde G2b (20261119121000, decisión de Angel) el invitado SÍ edita sus tipos: los
-- tres suyos (principal general, el de su consultorio y el de más). Lo demás, en g2b_tipos_cita_update.sql.
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000062b1');
  set local role authenticated;
  update public.tipos_cita set color = color where medico_id = '00000000-0000-4000-8000-0000000062b1';  -- sin cambiar nada (lo usa el caso 8)
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 6 el invitado edita sus tipos', v_n::text, '3');
end $$;

-- Caso 7: lo ve quien debe (SELECT de B6 sin cambios): b2 no ve los de b1.
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000062b2');
  set local role authenticated;
  select count(*) into v_n from public.tipos_cita where medico_id = '00000000-0000-4000-8000-0000000062b1';
  reset role;
  perform pg_temp.esperar('caso 7 b2 ve tipos de b1', v_n::text, '0');
end $$;

-- Caso 8: reserva_contexto entrega consultorio_id y principal en cada tipo del médico.
create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-g2', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-0000000062f1', '00000000-0000-4000-8000-0000000062c1', '00000000-0000-4000-8000-0000000062b1', 'fijo', pg_temp.h('g2f1'));
do $$
declare v jsonb;
begin
  v := public.reserva_contexto(pg_temp.h('g2f1'), 'v1-prueba-g2', pg_temp.h('aviso'));
  perform pg_temp.esperar('caso 8 contexto', (v is not null)::text, 'true');
  perform pg_temp.esperar('caso 8 tipos (nombre:duración:principal:consultorio)',
    (select string_agg((t ->> 'nombre') || ':' || (t ->> 'duracion_min') || ':' || (t ->> 'principal') || ':'
                       || coalesce(right(t ->> 'consultorio_id', 4), '-'), ',' order by t ->> 'duracion_min', t ->> 'nombre')
       from jsonb_array_elements(v -> 'tipos') t),
    'Revisión:20:false:-,Consulta:45:true:-,Consulta:60:true:cc01,Primera vez:60:false:-');
end $$;

rollback;
