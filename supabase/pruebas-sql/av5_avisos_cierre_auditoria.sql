-- Avisos globales · MA (20261203130000_avisos_globales_cierre_auditoria.sql) — cierre de la
-- tercera auditoría de M1: la copia del médico, «Marcar todos» frente a transacciones abiertas y
-- el cambio de médico de una cita. Falla si MA no está o se deshizo (caso 0).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- Lo que necesita DOS sesiones (el aviso que confirma después de la marca; la fila del aviso tomada
-- por otro) está en scripts/avisos-carrera.sh.
-- El recorte de la marca y el marcado uno a uno sólo se ven con otra transacción abierta: su prueba
-- en rojo es el control del guion de carreras (con el cuerpo de M1, el aviso se pierde).
begin;

-- Caso 0: lo que deja MA está.
do $$
begin
  if to_regprocedure('public.avisos_transaccion_mas_antigua()') is null then
    raise exception 'AV5 caso 0: falta avisos_transaccion_mas_antigua() (falta MA o se deshizo)';
  end if;
  if has_function_privilege('anon', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.avisos_transaccion_mas_antigua()', 'EXECUTE')
     or exists (select 1 from pg_proc p, aclexplode(p.proacl) x
                 where p.oid = 'public.avisos_transaccion_mas_antigua()'::regprocedure and x.grantee = 0) then
    raise exception 'AV5 caso 0: avisos_transaccion_mas_antigua() no es sólo para authenticated';
  end if;
  if (select count(*) from pg_proc p
       where (p.oid, md5(replace(p.prosrc, E'\r\n', E'\n'))) in (
               ('public.aviso_visto_hasta_sellar()'::regprocedure, '839f7457daa2d7c618daaea254106d7e'),
               ('public.avisos_revisar_todos(timestamptz)'::regprocedure, '5e1f662fee337d583e590d377425aec4'),
               ('public.aviso_clinica_de_cambio_medico()'::regprocedure, '200f5f6fec02d59bea2e51686ebf3a43'))) <> 0 then
    raise exception 'AV5 caso 0: alguna de las tres funciones sigue con el cuerpo de M1';
  end if;
  if exists (select 1 from public.avisos_clinica a join public.appointments ap on ap.id = a.cita_id and ap.clinica_id = a.clinica_id
              where a.medico_id is distinct from ap.medico_id) then
    raise exception 'AV5 caso 0: hay avisos con cita cuya copia no es el médico de su cita';
  end if;
end $$;

-- ── Datos: una clínica con la v2 encendida; b1 médico administrador, b2 médico invitado, b4 secretaria.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000005a0c01', 'AV5 uno', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-0000005a0b0' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'av5-b' || n || '@prueba.local', now(), now() from (values (1), (2), (4)) x(n);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000005a0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01'),
       nombres = 'Médico', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id::text ~ '5a0b0[12]$';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000005a0c01', role = 'secretaria', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-0000005a0b04';
insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone)
select '00000000-0000-4000-8000-0000005a0c01', ('00000000-0000-4000-8000-0000005a0b0' || n)::uuid, 'Consultorio ' || n, 'C' || n,
       'Calle falsa ' || n, true, 'America/Merida' from (values (1), (2)) x(n);
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000005a0c01', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000005a0f01', '00000000-0000-4000-8000-0000005a0c01', 'Paciente', 'Uno');
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time)
select ('00000000-0000-4000-8000-0000005a0a0' || n)::uuid, '00000000-0000-4000-8000-0000005a0c01',
       '00000000-0000-4000-8000-0000005a0b01', '00000000-0000-4000-8000-0000005a0f01', 'Cita ' || n,
       now() + n * interval '1 day', now() + n * interval '1 day' + interval '30 minutes'
  from generate_series(1, 3) n;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sin_sesion() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;
-- Los avisos pendientes de una persona (las citas, por sus dos últimos caracteres).
create function pg_temp.pend(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  select coalesce(string_agg(right(cita_id::text, 2), ',' order by cita_id), 'ninguno') into v
    from public.avisos_pendientes(array['reserva_enlace', 'cancelacion_paciente', 'confirmacion_paciente'], 50);
  reset role;
  perform pg_temp.sin_sesion();
  return v;
end $$;

-- Tres avisos, cada uno con su hora (creado_en por omisión es la de la transacción: se separan a mano).
insert into public.avisos_clinica (clinica_id, tipo, cita_id, creado_en)
select '00000000-0000-4000-8000-0000005a0c01', 'reserva_enlace', ('00000000-0000-4000-8000-0000005a0a0' || n)::uuid,
       clock_timestamp() - (4 - n) * interval '1 minute'
  from generate_series(1, 3) n;

-- Caso 1: el aviso con cita nace con la copia del médico de su cita, y la sigue si la cita cambia de
-- médico (sin nadie más tocando sus avisos, el camino normal: sin WARNING).
do $$
begin
  if (select count(*) from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000005a0c01'
        and medico_id = '00000000-0000-4000-8000-0000005a0b01') <> 3 then
    raise exception 'AV5 caso 1: los avisos no nacieron con la copia del médico de su cita';
  end if;
  update public.appointments set medico_id = '00000000-0000-4000-8000-0000005a0b02'
   where id = '00000000-0000-4000-8000-0000005a0a03';
  if (select medico_id from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000005a0a03')
     is distinct from '00000000-0000-4000-8000-0000005a0b02' then
    raise exception 'AV5 caso 1: al cambiar el médico de la cita, la copia de su aviso no le siguió';
  end if;
  if current_setting('lock_timeout') = '200ms' then
    raise exception 'AV5 caso 1: aviso_clinica_de_cambio_medico dejó su lock_timeout puesto en la transacción';
  end if;
end $$;

-- Caso 2: la marca de agua nunca queda por delante de una transacción abierta (aquí, la más antigua
-- de la base en este momento, si la hay), ni en el futuro, ni va hacia atrás.
do $$
declare v_abierta timestamptz; v_hasta timestamptz; v_antes timestamptz;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000005a0b04');
  set local role authenticated;
  v_abierta := public.avisos_transaccion_mas_antigua();
  perform public.avisos_revisar_todos(clock_timestamp() + interval '1 hour');
  select hasta into v_hasta from public.avisos_vistos_hasta where usuario_id = '00000000-0000-4000-8000-0000005a0b04';
  reset role;
  if v_hasta > clock_timestamp() then
    raise exception 'AV5 caso 2: la marca quedó en el futuro (%)', v_hasta;
  end if;
  if v_abierta is not null and v_hasta >= v_abierta then
    raise exception 'AV5 caso 2: la marca (%) quedó por delante de una transacción abierta (%)', v_hasta, v_abierta;
  end if;
  v_antes := v_hasta;
  set local role authenticated;
  perform public.avisos_revisar_todos(v_antes - interval '1 day');
  select hasta into v_hasta from public.avisos_vistos_hasta where usuario_id = '00000000-0000-4000-8000-0000005a0b04';
  reset role;
  perform pg_temp.sin_sesion();
  if v_hasta < v_antes then
    raise exception 'AV5 caso 2: la marca fue hacia atrás (% → %)', v_antes, v_hasta;
  end if;
end $$;

-- Caso 3: «Marcar todos» vacía la lista de quien pulsa, haya o no una transacción abierta que frene
-- la marca (si la frena, lo que ve se marca uno a uno), y no toca la de los demás.
do $$
begin
  if pg_temp.pend('00000000-0000-4000-8000-0000005a0b01') <> '01,02,03' then
    raise exception 'AV5 caso 3: el administrador no tenía los tres avisos pendientes (%)', pg_temp.pend('00000000-0000-4000-8000-0000005a0b01');
  end if;
  perform pg_temp.como('00000000-0000-4000-8000-0000005a0b01');
  set local role authenticated;
  perform public.avisos_revisar_todos((select max(creado_en) from public.avisos_clinica where revisado_en is null));
  reset role;
  perform pg_temp.sin_sesion();
  if pg_temp.pend('00000000-0000-4000-8000-0000005a0b01') <> 'ninguno' then
    raise exception 'AV5 caso 3: tras «Marcar todos» al administrador le quedan pendientes (%)', pg_temp.pend('00000000-0000-4000-8000-0000005a0b01');
  end if;
  -- El médico invitado no pulsó nada: conserva el suyo (el de la cita 3, que ahora es suya).
  if pg_temp.pend('00000000-0000-4000-8000-0000005a0b02') <> '03' then
    raise exception 'AV5 caso 3: el invitado no conserva su aviso pendiente (%)', pg_temp.pend('00000000-0000-4000-8000-0000005a0b02');
  end if;
end $$;

-- Caso 4: lo que se reabre DESPUÉS de marcar vuelve a estar pendiente (como en M1).
do $$
begin
  insert into public.avisos_clinica (clinica_id, tipo, cita_id)
  values ('00000000-0000-4000-8000-0000005a0c01', 'reserva_enlace', '00000000-0000-4000-8000-0000005a0a01');
  if pg_temp.pend('00000000-0000-4000-8000-0000005a0b01') <> '01' then
    raise exception 'AV5 caso 4: un aviso reabierto tras «Marcar todos» no volvió a salir (%)', pg_temp.pend('00000000-0000-4000-8000-0000005a0b01');
  end if;
end $$;

-- Caso 5: nadie sin sesión de la app llama a la función nueva, y con sesión sólo devuelve un instante.
do $$
declare v timestamptz;
begin
  set local role anon;
  begin
    perform public.avisos_transaccion_mas_antigua();
    raise exception 'AV5 caso 5: anon ejecutó avisos_transaccion_mas_antigua()';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role service_role;
  begin
    perform public.avisos_transaccion_mas_antigua();
    raise exception 'AV5 caso 5: service_role ejecutó avisos_transaccion_mas_antigua()';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  v := public.avisos_transaccion_mas_antigua();
  reset role;
  if v > clock_timestamp() then
    raise exception 'AV5 caso 5: devolvió un instante futuro';
  end if;
end $$;

rollback;
