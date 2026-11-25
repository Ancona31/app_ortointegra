-- Corrección de seguridad, punto 4 (20261117121000_agenda_seg_columnas_reserva.sql): la sesión
-- (PostgREST) no inserta ni modifica las columnas reserva_* de appointments; sólo el servidor
-- (service_role). Se permite vaciar reserva_telefono y reserva_correo (supresión a petición
-- del titular). Lo de siempre de la sesión (editar título, estado, ligar un paciente) sigue.
-- Mutación comprobada en rojo: quitar 'authenticated' del alcance (salir también con él) →
-- «caso 1: la sesión creó una cita con reserva_*».
-- Se corre con scripts/pruebas-sql.sh. Crea sus datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre) values ('00000000-0000-4000-8000-000000a4c001', 'Seg4 una');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000a4a001'::uuid, 'seg4-admin@prueba.local'),
               ('00000000-0000-4000-8000-000000a4e001'::uuid, 'seg4-secre@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a4c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000a4a001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a4c001', role = 'secretaria'
 where id = '00000000-0000-4000-8000-000000a4e001';
-- VIP: la puerta de suscripción (appointments_gates_insert) deja insertar a la sesión.
update public.clinicas set es_vip_grant = true where id = '00000000-0000-4000-8000-000000a4c001';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-000000a4c001', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000a4f001', '00000000-0000-4000-8000-000000a4c001', 'Paciente', 'Uno');
insert into public.reserva_avisos (version, texto_sha256) values ('seg4-aviso', repeat('a', 64));
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000a4b001', '00000000-0000-4000-8000-000000a4c001',
   '00000000-0000-4000-8000-000000a4a001', 'fijo', repeat('b', 64));
-- La cita por ligar la crea el servidor (como reservar_por_enlace): service_role.
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
  reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
  reserva_aceptado_en, reserva_historial_previo)
values ('00000000-0000-4000-8000-000000a4d001', '00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001',
        'Ana Reserva', now() + interval '1 day', now() + interval '1 day 30 minutes', '00000000-0000-4000-8000-000000a4b001',
        'fijo', 'Ana Reserva', '5512345678', 'ana@prueba.local', repeat('c', 64), repeat('d', 64), 'seg4-aviso', now(), 0);
reset role;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Caso 1: INSERT de la sesión. Con cualquier reserva_* no nulo (o reagendados ≠ 0) → 42501;
-- una cita normal, sí. Como la secretaria: perfil_completo() (puerta de suscripción) no le pide
-- consultorio, y al médico de prueba sí.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000a4e001');
  set local role authenticated;
  begin
    insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
      reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
    values ('00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001', 'Falsa', now() + interval '2 days',
            now() + interval '2 days 30 minutes', '00000000-0000-4000-8000-000000a4b001', 'fijo', 'Falsa',
            repeat('e', 64), repeat('f', 64), 'seg4-aviso', now(), 0);
    raise exception 'Seg4 caso 1: la sesión creó una cita con reserva_*';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_reagendados)
    values ('00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001', 'Reag', now() + interval '2 days',
            now() + interval '2 days 30 minutes', 3);
    raise exception 'Seg4 caso 1: la sesión creó una cita con reserva_reagendados ≠ 0';
  exception when insufficient_privilege then null;
  end;
  insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time)
  values ('00000000-0000-4000-8000-000000a4d002', '00000000-0000-4000-8000-000000a4c001', '00000000-0000-4000-8000-000000a4a001',
          '00000000-0000-4000-8000-000000a4f001', 'Normal', now() + interval '3 days', now() + interval '3 days 30 minutes');
  reset role;
end $$;

-- Caso 2: UPDATE de la sesión. Ninguna reserva_* cambia (una por una, desde el catálogo); sí
-- título, estado y ligar el paciente; y vaciar teléfono y correo.
do $$
declare
  v_col text;
  v_val text;
begin
  for v_col, v_val in select * from (values
      ('reserva_canal', '''unico'''), ('reserva_enlace_id', 'null'), ('reserva_nombre', '''Otro'''),
      ('reserva_telefono', '''5599999999'''), ('reserva_correo', '''otro@prueba.local'''),
      ('reserva_tel_hmac', 'repeat(''1'', 64)'), ('reserva_correo_hmac', 'repeat(''2'', 64)'),
      ('reserva_aviso_version', 'null'), ('reserva_aceptado_en', 'now() - interval ''1 day'''),
      ('reserva_historial_previo', '5'), ('reserva_reagendados', '1')) t(c, v)
  loop
    perform pg_temp.como('00000000-0000-4000-8000-000000a4e001');
    set local role authenticated;
    begin
      execute format('update public.appointments set %I = %s where id = %L', v_col, v_val, '00000000-0000-4000-8000-000000a4d001');
      raise exception 'Seg4 caso 2: la sesión cambió %', v_col;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  -- Las 11 columnas del catálogo están en la lista de arriba (una columna reserva_* nueva sin caso aquí → rojo).
  if (select count(*) from pg_attribute where attrelid = 'public.appointments'::regclass
        and attname like 'reserva\_%' and not attisdropped) <> 11 then
    raise exception 'Seg4 caso 2: appointments tiene columnas reserva_* que esta prueba no cubre';
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000a4e001');
  set local role authenticated;
  update public.appointments set title = 'Ana R.', status = 'confirmed', updated_at = now()
   where id = '00000000-0000-4000-8000-000000a4d001';
  update public.appointments set reserva_telefono = null, reserva_correo = null
   where id = '00000000-0000-4000-8000-000000a4d001';
  update public.appointments set paciente_id = '00000000-0000-4000-8000-000000a4f001', title = 'Paciente Uno'
   where id = '00000000-0000-4000-8000-000000a4d001';
  -- Una vez vacío, no se vuelve a llenar desde la sesión.
  begin
    update public.appointments set reserva_telefono = '5512345678' where id = '00000000-0000-4000-8000-000000a4d001';
    raise exception 'Seg4 caso 2: la sesión volvió a escribir el teléfono vaciado';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select row(paciente_id, status, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_nombre)::text
        from public.appointments where id = '00000000-0000-4000-8000-000000a4d001')
     <> row('00000000-0000-4000-8000-000000a4f001'::uuid, 'confirmed', null::text, null::text, repeat('c', 64), 'Ana Reserva')::text then
    raise exception 'Seg4 caso 2: lo permitido no quedó como debía';
  end if;
end $$;

-- Caso 3: service_role sí escribe reserva_* (el camino del reagendado, E6).
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  update public.appointments set reserva_reagendados = reserva_reagendados + 1 where id = '00000000-0000-4000-8000-000000a4d001';
  reset role;
  if (select reserva_reagendados from public.appointments where id = '00000000-0000-4000-8000-000000a4d001') <> 1 then
    raise exception 'Seg4 caso 3: service_role no pudo escribir reserva_reagendados';
  end if;
end $$;

-- Caso 4: anon tampoco (sin policy no ve filas; el disparador corre antes en el INSERT).
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    insert into public.appointments (clinica_id, title, start_time, end_time, reserva_nombre)
    values ('00000000-0000-4000-8000-000000a4c001', 'X', now(), now() + interval '1 hour', 'X');
    raise exception 'Seg4 caso 4: anon insertó';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
