-- Auditoría independiente, ronda 1, hallazgo A3 (supabase/produccion/auditoria/RONDA-1.md) y su
-- barrido: en las tablas nuevas de la agenda v2 que la SESIÓN puede escribir y que tienen una
-- llave de UNA sola columna hacia una tabla de varias clínicas (profiles, consultorios), nadie de
-- una clínica deja una fila que apunte a un perfil o consultorio de OTRA, y el error es el MISMO
-- exista o no lo apuntado (sin oráculo de existencia).
--   1. reserva_contactos.medico_id (A3; proteger_reserva_contactos, F3): secretaria, administrador
--      y médico de la clínica A, con un médico de B o con un uuid que no existe → 23514 idéntico;
--      con un médico de A, entra; con una secretaria de A como «médico», 23514.
--   2. tipos_cita.medico_id y tipos_cita.consultorio_id (validar_tipo_cita_*, F1).
--   3. agenda_bloqueos.medico_id (policy agenda_bloqueos_insert, F5a; UPDATE sin la columna).
--   4. reserva_enlaces.medico_id (la sesión no inserta; al editar, la identidad no cambia).
--   5. avisos_clinica.revisado_por (sin FK; WITH CHECK revisado_por = auth.uid()).
-- Mutación comprobada en rojo: quitar de proteger_reserva_contactos() el IF NOT EXISTS del médico
-- → «cb caso 1: entró un contacto con el médico de otra clínica».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000cbc01', 'CB uno', true),
  ('00000000-0000-4000-8000-0000000cbc02', 'CB dos', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000cba01'::uuid, 'cb-a1@prueba.local'),
               ('00000000-0000-4000-8000-0000000cba02'::uuid, 'cb-a2@prueba.local'),
               ('00000000-0000-4000-8000-0000000cba03'::uuid, 'cb-a3@prueba.local'),
               ('00000000-0000-4000-8000-0000000cbb01'::uuid, 'cb-b1@prueba.local')) u(id, email);
-- a1 médico administrador de A, a2 médico invitado de A, a3 secretaria de A, b1 médico de B.
update public.profiles p
   set clinica_id = v.clinica, es_admin_de_clinica = v.admin, role = v.rol,
       nombres = 'Médico', apellido_paterno = 'CB', especialidad = 'Ortopedia', cedula_profesional = '1234567'
  from (values ('00000000-0000-4000-8000-0000000cba01'::uuid, '00000000-0000-4000-8000-0000000cbc01'::uuid, true, 'medico'),
               ('00000000-0000-4000-8000-0000000cba02'::uuid, '00000000-0000-4000-8000-0000000cbc01'::uuid, false, 'medico'),
               ('00000000-0000-4000-8000-0000000cba03'::uuid, '00000000-0000-4000-8000-0000000cbc01'::uuid, false, 'secretaria'),
               ('00000000-0000-4000-8000-0000000cbb01'::uuid, '00000000-0000-4000-8000-0000000cbc02'::uuid, true, 'medico')) v(id, clinica, admin, rol)
 where p.id = v.id;
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000cbc01', true), ('00000000-0000-4000-8000-0000000cbc02', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, es_default) values
  ('00000000-0000-4000-8000-0000000cbd11', '00000000-0000-4000-8000-0000000cbc01', '00000000-0000-4000-8000-0000000cba01', 'CB A', 'A', 'Calle', true, true),
  ('00000000-0000-4000-8000-0000000cbd12', '00000000-0000-4000-8000-0000000cbc02', '00000000-0000-4000-8000-0000000cbb01', 'CB B', 'B', 'Calle', true, true);

-- Corre p_sql como la sesión de p_como y devuelve 'ok' o «SQLSTATE mensaje».
create function pg_temp.error_de(p_como uuid, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_como, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql;
  exception when others then
    reset role;
    return sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  return 'ok';
end $$;

-- Caso 1 · reserva_contactos.medico_id (A3).
do $$
declare
  v_quien uuid;
  v_ajeno text;
  v_nadie text;
  c_ins constant text := 'insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en) '
                         'values (''00000000-0000-4000-8000-0000000cbc01'', %L, %L, ''telefono'', now())';
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000cba03', '00000000-0000-4000-8000-0000000cba01']::uuid[] loop
    v_ajeno := pg_temp.error_de(v_quien, format(c_ins, '00000000-0000-4000-8000-0000000cbb01', repeat('9', 64)));
    v_nadie := pg_temp.error_de(v_quien, format(c_ins, '00000000-0000-4000-8000-0000000ffff1', repeat('9', 64)));
    if v_ajeno = 'ok' then
      raise exception 'cb caso 1: entró un contacto con el médico de otra clínica (%)', v_quien;
    end if;
    if v_ajeno is distinct from v_nadie or v_ajeno not like '23514 %' then
      raise exception 'cb caso 1: oráculo de existencia (%): «%» contra «%»', v_quien, v_ajeno, v_nadie;
    end if;
    -- Una secretaria de la misma clínica no es «el médico» de un contacto.
    if pg_temp.error_de(v_quien, format(c_ins, '00000000-0000-4000-8000-0000000cba03', repeat('8', 64))) not like '23514 %' then
      raise exception 'cb caso 1: entró un contacto con una secretaria como médico (%)', v_quien;
    end if;
  end loop;
  -- El médico invitado, sobre sí mismo, y la secretaria, sobre un médico de A: entran.
  if pg_temp.error_de('00000000-0000-4000-8000-0000000cba02', format(c_ins, '00000000-0000-4000-8000-0000000cba02', repeat('7', 64))) <> 'ok'
     or pg_temp.error_de('00000000-0000-4000-8000-0000000cba03', format(c_ins, '00000000-0000-4000-8000-0000000cba01', repeat('6', 64))) <> 'ok' then
    raise exception 'cb caso 1: la sesión ya no puede bloquear un contacto de un médico de su clínica';
  end if;
  -- El médico invitado, con el médico de B: el mismo error que con un uuid inexistente.
  v_ajeno := pg_temp.error_de('00000000-0000-4000-8000-0000000cba02', format(c_ins, '00000000-0000-4000-8000-0000000cbb01', repeat('5', 64)));
  v_nadie := pg_temp.error_de('00000000-0000-4000-8000-0000000cba02', format(c_ins, '00000000-0000-4000-8000-0000000ffff1', repeat('5', 64)));
  if v_ajeno = 'ok' or v_ajeno is distinct from v_nadie then
    raise exception 'cb caso 1: el médico invitado: «%» contra «%»', v_ajeno, v_nadie;
  end if;
end $$;

-- Caso 2 · tipos_cita.medico_id y consultorio_id: el administrador de A no apunta a B.
do $$
declare v_ajeno text; v_nadie text;
begin
  v_ajeno := pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
    'insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min) values '
    '(''00000000-0000-4000-8000-0000000cbc01'', ''00000000-0000-4000-8000-0000000cbb01'', ''x'', 30)');
  v_nadie := pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
    'insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min) values '
    '(''00000000-0000-4000-8000-0000000cbc01'', ''00000000-0000-4000-8000-0000000ffff1'', ''x'', 30)');
  if v_ajeno = 'ok' or v_ajeno is distinct from v_nadie then
    raise exception 'cb caso 2: tipos_cita.medico_id de otra clínica: «%» contra «%»', v_ajeno, v_nadie;
  end if;
  v_ajeno := pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
    'insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal, consultorio_id) values '
    '(''00000000-0000-4000-8000-0000000cbc01'', ''00000000-0000-4000-8000-0000000cba01'', ''x'', 30, true, ''00000000-0000-4000-8000-0000000cbd12'')');
  v_nadie := pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
    'insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal, consultorio_id) values '
    '(''00000000-0000-4000-8000-0000000cbc01'', ''00000000-0000-4000-8000-0000000cba01'', ''x'', 30, true, ''00000000-0000-4000-8000-0000000ffff2'')');
  if v_ajeno = 'ok' or v_ajeno is distinct from v_nadie then
    raise exception 'cb caso 2: tipos_cita.consultorio_id de otra clínica: «%» contra «%»', v_ajeno, v_nadie;
  end if;
end $$;

-- Caso 3 · agenda_bloqueos.medico_id: la secretaria de A no bloquea a un médico de B.
do $$
declare v_ajeno text; v_nadie text;
  c_ins constant text := 'insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin) values '
                         '(''00000000-0000-4000-8000-0000000cbc01'', %L, date_trunc(''hour'', now()) + interval ''9 days'', '
                         'date_trunc(''hour'', now()) + interval ''9 days 1 hour'')';
begin
  v_ajeno := pg_temp.error_de('00000000-0000-4000-8000-0000000cba03', format(c_ins, '00000000-0000-4000-8000-0000000cbb01'));
  v_nadie := pg_temp.error_de('00000000-0000-4000-8000-0000000cba03', format(c_ins, '00000000-0000-4000-8000-0000000ffff1'));
  if v_ajeno = 'ok' or v_ajeno is distinct from v_nadie then
    raise exception 'cb caso 3: agenda_bloqueos.medico_id de otra clínica: «%» contra «%»', v_ajeno, v_nadie;
  end if;
  if pg_temp.error_de('00000000-0000-4000-8000-0000000cba03', format(c_ins, '00000000-0000-4000-8000-0000000cba01')) <> 'ok' then
    raise exception 'cb caso 3: la secretaria ya no bloquea a un médico de su clínica';
  end if;
  -- Al editar, la columna no está en el GRANT de UPDATE.
  if pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
       'update public.agenda_bloqueos set medico_id = ''00000000-0000-4000-8000-0000000cbb01''') not like '42501 %' then
    raise exception 'cb caso 3: la sesión cambió el médico de un bloqueo';
  end if;
end $$;

-- Caso 4 · reserva_enlaces.medico_id: emitido (como postgres), el administrador de A no lo pasa a B.
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
values ('00000000-0000-4000-8000-0000000cbe01', '00000000-0000-4000-8000-0000000cbc01',
        '00000000-0000-4000-8000-0000000cba01', 'fijo', repeat('a', 64));
do $$
begin
  if pg_temp.error_de('00000000-0000-4000-8000-0000000cba01',
       'update public.reserva_enlaces set medico_id = ''00000000-0000-4000-8000-0000000cbb01'' '
       'where id = ''00000000-0000-4000-8000-0000000cbe01''') not like '42501 %' then
    raise exception 'cb caso 4: la sesión cambió el médico de un enlace';
  end if;
end $$;

-- Caso 5 · avisos_clinica.revisado_por: sólo quien revisa (auth.uid()), nunca otra persona.
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time)
values ('00000000-0000-4000-8000-0000000cbf01', '00000000-0000-4000-8000-0000000cbc01',
        '00000000-0000-4000-8000-0000000cba01', 'Evento CB', now() + interval '10 days', now() + interval '10 days 1 hour');
insert into public.avisos_clinica (clinica_id, tipo, cita_id)
values ('00000000-0000-4000-8000-0000000cbc01', 'google_por_asignar', '00000000-0000-4000-8000-0000000cbf01');
do $$
begin
  if pg_temp.error_de('00000000-0000-4000-8000-0000000cba03',
       'update public.avisos_clinica set revisado_en = now(), revisado_por = ''00000000-0000-4000-8000-0000000cbb01'' '
       'where cita_id = ''00000000-0000-4000-8000-0000000cbf01''') not like '42501 %' then
    raise exception 'cb caso 5: la sesión marcó un aviso como revisado por otra persona';
  end if;
end $$;

rollback;
