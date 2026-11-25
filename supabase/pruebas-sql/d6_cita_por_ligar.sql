-- Agenda D6 — la cita POR LIGAR (reserva por enlace sin paciente) es una cita:
-- lo que la base dice de ella y por qué la API la cancela en vez de borrarla.
-- No hay migración en D6: esto fija el comportamiento de las de D1-D3 del que
-- dependen `DELETE /api/appointments/[id]` y el interruptor.
--   1. Con el interruptor APAGADO, `reservar_por_enlace` contesta «apagado» y
--      no escribe nada: por el camino de la reserva no nacen citas por ligar.
--   2. Una cita que gastó un enlace de UN SOLO USO no se puede borrar (23503,
--      `reserva_enlaces_usado_cita_fkey` RESTRICT): era el 500 del DELETE.
--   3. Cancelarla sí se puede, deja su incidencia (D2) y el enlace sigue
--      apuntándola; y una vez cancelada sigue sin poder borrarse (además la
--      sostiene `reserva_incidencias_cita_fkey`, RESTRICT, que vale también
--      para las del enlace fijo).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000d6c001', 'D6 encendida', true, 'free'),
  ('00000000-0000-4000-8000-000000d6c002', 'D6 apagada',   true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000d6b001'::uuid, 'd6-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000d6b002'::uuid, 'd6-b2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d6c001', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Prueba', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-000000d6b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d6c002', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Apagado', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-000000d6b002';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000d6c001', true),
  ('00000000-0000-4000-8000-000000d6c002', false);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000d6cc001', '00000000-0000-4000-8000-000000d6c001', '00000000-0000-4000-8000-000000d6b001', 'Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-00000d6cc002', '00000000-0000-4000-8000-000000d6c002', '00000000-0000-4000-8000-000000d6b002', 'Dos', 'Dos', 'Calle 2', true);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-000000d6a001', '00000000-0000-4000-8000-000000d6c001', null, 'Primera vez', 30, true),
  ('00000000-0000-4000-8000-000000d6a002', '00000000-0000-4000-8000-000000d6c002', null, 'Primera vez', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-d6', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  ('00000000-0000-4000-8000-000000d6f001', '00000000-0000-4000-8000-000000d6c001', '00000000-0000-4000-8000-000000d6b001', 'unico', pg_temp.h('u1'), 7, now() + interval '7 days'),
  ('00000000-0000-4000-8000-000000d6f002', '00000000-0000-4000-8000-000000d6c001', '00000000-0000-4000-8000-000000d6b001', 'unico', pg_temp.h('u2'), 7, now() + interval '7 days'),
  ('00000000-0000-4000-8000-000000d6f003', '00000000-0000-4000-8000-000000d6c002', '00000000-0000-4000-8000-000000d6b002', 'unico', pg_temp.h('u3'), 7, now() + interval '7 days');

-- La reserva como el servidor: service_role, sin sub. Enlace único: sin código ni candado.
create function pg_temp.reservar(p_clinica uuid, p_hash text, p_cons uuid, p_tipo uuid, p_horas integer, p_tel text)
returns table (r_resultado text, r_cita_id uuid) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select x.r_resultado, x.r_cita_id from public.reservar_por_enlace(p_clinica, p_hash, p_cons, p_tipo,
    date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas), 'Persona Prueba', p_tel,
    'persona@prueba.local', pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_tel), null, 'v1-prueba-d6', pg_temp.h('aviso'),
    gen_random_uuid()) x;
  reset role;
end $$;

-- ── 1 · Interruptor apagado: «apagado» y ninguna cita ───────────────────
do $$
declare v record;
begin
  select * into v from pg_temp.reservar('00000000-0000-4000-8000-000000d6c002', pg_temp.h('u3'),
    '00000000-0000-4000-8000-00000d6cc002', '00000000-0000-4000-8000-000000d6a002', 10, '5500000003');
  if v.r_resultado is distinct from 'apagado' or v.r_cita_id is not null then
    raise exception 'D6 caso 1: con el interruptor apagado dio % (cita %)', v.r_resultado, v.r_cita_id;
  end if;
  if exists (select 1 from public.appointments where clinica_id = '00000000-0000-4000-8000-000000d6c002') then
    raise exception 'D6 caso 1: con el interruptor apagado quedó una cita';
  end if;
  if (select usado_en from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d6f003') is not null then
    raise exception 'D6 caso 1: con el interruptor apagado el enlace quedó gastado';
  end if;
end $$;

-- ── 2 · La cita que gastó un enlace único no se puede borrar (23503) ────
do $$
declare v record; v_borrada boolean := false;
begin
  select * into v from pg_temp.reservar('00000000-0000-4000-8000-000000d6c001', pg_temp.h('u1'),
    '00000000-0000-4000-8000-00000d6cc001', '00000000-0000-4000-8000-000000d6a001', 10, '5500000001');
  if v.r_resultado <> 'ok' then raise exception 'D6 caso 2: la reserva dio %', v.r_resultado; end if;
  if not exists (select 1 from public.appointments where id = v.r_cita_id and paciente_id is null and reserva_canal = 'unico') then
    raise exception 'D6 caso 2: la cita no quedó por ligar';
  end if;
  begin
    delete from public.appointments where id = v.r_cita_id;
    v_borrada := true;
  exception when foreign_key_violation then
    v_borrada := false;
  end;
  if v_borrada then raise exception 'D6 caso 2: la cita que gastó un enlace único se pudo borrar'; end if;
  perform set_config('d6.cita_unico', v.r_cita_id::text, true);
end $$;

-- ── 3 · Cancelarla sí: incidencia y enlace intacto; ya cancelada, tampoco se borra ──
do $$
declare v_cita uuid := current_setting('d6.cita_unico')::uuid; v2 record; v_borrada boolean := false;
begin
  update public.appointments set status = 'cancelled' where id = v_cita;
  if (select count(*) from public.reserva_incidencias where appointment_id = v_cita and tipo = 'cancelacion' and anulada_en is null) <> 1 then
    raise exception 'D6 caso 3: cancelar no dejó su incidencia';
  end if;
  if (select usado_cita_id from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d6f001') is distinct from v_cita then
    raise exception 'D6 caso 3: el enlace dejó de apuntar a la cita cancelada';
  end if;
  -- Otra por enlace único, cancelada: tampoco se borra (la sostienen el enlace y la incidencia).
  select * into v2 from pg_temp.reservar('00000000-0000-4000-8000-000000d6c001', pg_temp.h('u2'),
    '00000000-0000-4000-8000-00000d6cc001', '00000000-0000-4000-8000-000000d6a001', 12, '5500000002');
  update public.appointments set status = 'cancelled' where id = v2.r_cita_id;
  begin
    delete from public.appointments where id = v2.r_cita_id;
    v_borrada := true;
  exception when foreign_key_violation then
    v_borrada := false;
  end;
  if v_borrada then raise exception 'D6 caso 3: una cita por enlace cancelada se pudo borrar'; end if;
end $$;

rollback;
