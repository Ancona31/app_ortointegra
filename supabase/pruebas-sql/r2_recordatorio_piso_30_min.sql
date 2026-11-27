-- Agenda R2 (20261208120000_recordatorio_piso_30_min.sql) — el recordatorio sale mientras falten MÁS
-- DE 30 MINUTOS para la cita (antes, más de 1 hora). Con el recordatorio a 1 hora la ventana deja de
-- estar vacía: es (30 min, 1 h].
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- MUTACIÓN (comprobada en rojo): con los cuerpos de R1 (la reversa de R2) → caso 1 (a 1 hora no sale
-- ninguna: ni la de 45 min ni la de 31).
begin;

-- Caso 0: R2 está, en las dos, y sigue la condición de R1.
do $$
begin
  if (select count(*) from pg_proc p
       where p.oid in ('public.cita_correo_tomar(uuid, uuid, text, uuid)'::regprocedure,
                       'public.cita_recordatorios_pendientes(integer)'::regprocedure)
         and position('interval ''30 minutes''' in p.prosrc) > 0 and position('interval ''1 hour''' in p.prosrc) = 0
         and position('coalesce(k.enviado_en, k.tomado_en) >= ' in p.prosrc) > 0) <> 2 then
    raise exception 'R2 caso 0: las dos funciones no llevan el piso de 30 minutos con la condición de R1 (falta la migración o se deshizo)';
  end if;
end $$;

insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000082c1', 'R2 uno', true, null, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000082a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r2-admin@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000082c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000082a1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_encendido, recordatorio_horas)
values ('00000000-0000-4000-8000-0000000082c1', true, true, 1)
  on conflict (clinica_id) do update set agenda_v2_encendida = true, recordatorio_encendido = true, recordatorio_horas = 1;
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-0000000082f1', '00000000-0000-4000-8000-0000000082c1', 'Paciente', 'R2', 'paciente.r2@prueba.local', true);
-- Las citas, por los minutos que faltan: e1 = 45, e2 = 31, e3 = 29, e4 = 30 justos, e5 = 61, e6 = 119, e7 = 121.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day)
select ('00000000-0000-4000-8000-0000000082e' || x.n)::uuid, '00000000-0000-4000-8000-0000000082c1',
       '00000000-0000-4000-8000-0000000082f1', '00000000-0000-4000-8000-0000000082a1', 'Cita a ' || x.m || ' min',
       now() + x.m * interval '1 minute', now() + (x.m + 20) * interval '1 minute', 'scheduled', false
  from (values (1, 45), (2, 31), (3, 29), (4, 30), (5, 61), (6, 119), (7, 121)) x(n, m);

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'R2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

create function pg_temp.listadas() returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select string_agg(right(r_cita_id::text, 2), ',' order by r_cita_id) into v
    from public.cita_recordatorios_pendientes(500) where r_cita_id::text like '00000000-0000-4000-8000-0000000082e%';
  reset role;
  return coalesce(v, '-');
end $$;

-- ¿Se deja tomar (sin cerrarlo: se deshace para no gastar el envío)?
create function pg_temp.se_toma(p_n integer, p_tipo text) returns boolean language plpgsql as $$
declare v_id uuid;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    set local role service_role;
    select r_envio_id into v_id from public.cita_correo_tomar('00000000-0000-4000-8000-0000000082c1',
      ('00000000-0000-4000-8000-0000000082e' || p_n)::uuid, p_tipo, gen_random_uuid());
    reset role;
    raise exception 'deshacer' using errcode = 'R2000';
  exception when sqlstate 'R2000' then null;
  end;
  return v_id is not null;
end $$;

-- ── Caso 1: ventana de 1 HORA. Salen las de 45 y 31 min; no la de 29, ni la de 30 justos, ni las de más de 1 h ──
do $$
begin
  perform pg_temp.esperar('caso 1 listado (1 h)', pg_temp.listadas(), 'e1,e2');
  perform pg_temp.esperar('caso 1 toma (1 h)',
    (select string_agg(pg_temp.se_toma(n, 'recordatorio')::text, ',' order by n) from generate_series(1, 7) n),
    'true,true,false,false,false,false,false');
end $$;

-- ── Caso 2: ventana de 2 HORAS. Las mismas más las de 61 y 119 min; la de 121 todavía no; el piso, igual ──
do $$
begin
  update public.agenda_ajustes set recordatorio_horas = 2 where clinica_id = '00000000-0000-4000-8000-0000000082c1';
  perform pg_temp.esperar('caso 2 listado (2 h)', pg_temp.listadas(), 'e1,e2,e5,e6');
  perform pg_temp.esperar('caso 2 toma (2 h)',
    (select string_agg(pg_temp.se_toma(n, 'recordatorio')::text, ',' order by n) from generate_series(1, 7) n),
    'true,true,false,false,true,true,false');
end $$;

-- ── Caso 3: el piso es sólo del recordatorio. El comprobante y la confirmación de una cita a 29 min se toman ──
do $$
begin
  perform pg_temp.esperar('caso 3 comprobante a 29 min', pg_temp.se_toma(3, 'comprobante')::text, 'true');
  perform pg_temp.esperar('caso 3 confirmación a 29 min', pg_temp.se_toma(3, 'confirmacion')::text, 'true');
end $$;

-- ── Caso 4: sigue la regla de R1. Reserva hecha a 45 min con ventana de 1 h (dentro): sólo el comprobante;
--    la misma con el comprobante de 15 h antes: los dos ──
do $$
declare v_id uuid; v_t uuid := gen_random_uuid();
begin
  update public.agenda_ajustes set recordatorio_horas = 1 where clinica_id = '00000000-0000-4000-8000-0000000082c1';
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_envio_id into v_id from public.cita_correo_tomar('00000000-0000-4000-8000-0000000082c1',
    '00000000-0000-4000-8000-0000000082e1', 'comprobante', v_t);
  perform public.cita_correo_marcar('00000000-0000-4000-8000-0000000082c1', v_id, v_t, 'enviado', null);
  reset role;
  perform pg_temp.esperar('caso 4 dentro de la ventana', pg_temp.listadas(), 'e2');
  update public.cita_correos set tomado_en = now() - interval '14 hours', enviado_en = now() - interval '14 hours' where id = v_id;
  perform pg_temp.esperar('caso 4 comprobante de antes', pg_temp.listadas(), 'e1,e2');
  perform pg_temp.esperar('caso 4 toma', pg_temp.se_toma(1, 'recordatorio')::text, 'true');
end $$;

rollback;
