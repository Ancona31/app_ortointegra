-- Agenda R1 (20261207120000_recordatorio_tras_comprobante.sql) — el comprobante de la reserva sólo
-- quita el recordatorio si salió YA DENTRO de la ventana del recordatorio de esa cita.
-- Reproduce el caso real de producción (2026-11-26): reserva hecha 15 h antes, recordatorio a 2 h:
-- salió el comprobante y el recordatorio no salió nunca.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- now() está quieto dentro de la transacción: «la reserva se hizo hace N horas» se escribe
-- retrasando, como postgres, las horas del comprobante que la propia base tomó y cerró.
-- MUTACIÓN (comprobada en rojo): con los cuerpos de F4 (la reversa) → caso 1 (la cita reservada
-- 15 h antes no sale en el listado ni se deja tomar).
begin;

-- Caso 0: R1 está.
do $$
begin
  if (select count(*) from pg_proc p
       where p.oid in ('public.cita_correo_tomar(uuid, uuid, text, uuid)'::regprocedure,
                       'public.cita_recordatorios_pendientes(integer)'::regprocedure)
         and position('coalesce(k.enviado_en, k.tomado_en) >= ' in p.prosrc) > 0) <> 2 then
    raise exception 'R1 caso 0: las dos funciones no llevan la condición de R1 (falta la migración o se deshizo)';
  end if;
end $$;

-- Una clínica VIP con la v2 y el recordatorio encendidos, a 2 horas.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000081c1', 'R1 uno', true, null, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000081a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r1-admin@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000081c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000081a1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_encendido, recordatorio_horas)
values ('00000000-0000-4000-8000-0000000081c1', true, true, 2)
  on conflict (clinica_id) do update set agenda_v2_encendida = true, recordatorio_encendido = true, recordatorio_horas = 2;
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-0000000081f1', '00000000-0000-4000-8000-0000000081c1', 'Paciente', 'R1', 'paciente.r1@prueba.local', true);
-- Seis citas a 1 h 30 de ahora: dentro de la ventana de 2 h y a más de 1 h.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day)
select ('00000000-0000-4000-8000-0000000081e' || n)::uuid, '00000000-0000-4000-8000-0000000081c1',
       '00000000-0000-4000-8000-0000000081f1', '00000000-0000-4000-8000-0000000081a1', 'Cita ' || n,
       now() + interval '90 minutes' + n * interval '1 second', now() + interval '120 minutes' + n * interval '1 second', 'scheduled', false
  from generate_series(1, 6) n;

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'R1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- El listado, como lo llama la tarea (service_role). Sólo las citas de esta prueba.
create function pg_temp.listadas() returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select string_agg(right(r_cita_id::text, 2), ',' order by r_cita_id) into v
    from public.cita_recordatorios_pendientes(500) where r_cita_id::text like '00000000-0000-4000-8000-0000000081e%';
  reset role;
  return coalesce(v, '-');
end $$;

-- Toma un envío como la app (service_role) y lo cierra 'enviado' si p_cerrar. Devuelve si se tomó.
create function pg_temp.tomar(p_n integer, p_tipo text, p_cerrar boolean) returns boolean language plpgsql as $$
declare v_id uuid; v_testigo uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_envio_id into v_id from public.cita_correo_tomar('00000000-0000-4000-8000-0000000081c1',
    ('00000000-0000-4000-8000-0000000081e' || p_n)::uuid, p_tipo, v_testigo);
  if v_id is not null and p_cerrar then
    perform public.cita_correo_marcar('00000000-0000-4000-8000-0000000081c1', v_id, v_testigo, 'enviado', null);
  end if;
  reset role;
  return v_id is not null;
end $$;

-- «El comprobante de la cita n salió hace p_hace»: retrasa sus horas (como postgres).
create function pg_temp.comprobante_de_hace(p_n integer, p_hace interval) returns void language sql as $$
  update public.cita_correos set tomado_en = now() - p_hace, enviado_en = case when estado = 'enviado' then now() - p_hace end
   where appointment_id = ('00000000-0000-4000-8000-0000000081e' || p_n)::uuid and tipo = 'comprobante';
$$;

-- ── Caso 1 (el de producción): reserva 15 h antes, ventana de 2 h → comprobante Y recordatorio ──
do $$
begin
  perform pg_temp.esperar('caso 1 comprobante', pg_temp.tomar(1, 'comprobante', true)::text, 'true');
  perform pg_temp.comprobante_de_hace(1, interval '13 hours 30 minutes');   -- 15 h antes de la cita
  if position('e1' in pg_temp.listadas()) = 0 then
    raise exception 'R1 caso 1: la cita reservada 15 h antes NO sale en el listado de recordatorios (%)', pg_temp.listadas();
  end if;
  perform pg_temp.esperar('caso 1 recordatorio', pg_temp.tomar(1, 'recordatorio', true)::text, 'true');
  perform pg_temp.esperar('caso 1 los dos enviados', (select string_agg(tipo || ':' || estado, ',' order by tipo) from public.cita_correos
     where appointment_id = '00000000-0000-4000-8000-0000000081e1'), 'comprobante:enviado,recordatorio:enviado');
  -- Y no se repite.
  if position('e1' in pg_temp.listadas()) > 0 then raise exception 'R1 caso 1: el recordatorio ya enviado vuelve a salir en el listado'; end if;
  perform pg_temp.esperar('caso 1 sin repetir', pg_temp.tomar(1, 'recordatorio', true)::text, 'false');
end $$;

-- ── Caso 2: reserva a 1 h 30 de la cita (dentro de la ventana) → SÓLO el comprobante ──
do $$
begin
  perform pg_temp.esperar('caso 2 comprobante', pg_temp.tomar(2, 'comprobante', true)::text, 'true');
  if position('e2' in pg_temp.listadas()) > 0 then
    raise exception 'R1 caso 2: la cita reservada dentro de la ventana sale en el listado: recibiría dos correos';
  end if;
  perform pg_temp.esperar('caso 2 recordatorio', pg_temp.tomar(2, 'recordatorio', true)::text, 'false');
  perform pg_temp.esperar('caso 2 sólo uno', (select string_agg(tipo, ',') from public.cita_correos
     where appointment_id = '00000000-0000-4000-8000-0000000081e2'), 'comprobante');
end $$;

-- ── Caso 3: el borde. Justo dentro (hace 29 min = 1 h 59 antes) no sale; justo fuera (2 h 01 antes) sí ──
do $$
begin
  perform pg_temp.tomar(3, 'comprobante', true);
  perform pg_temp.comprobante_de_hace(3, interval '29 minutes');
  if position('e3' in pg_temp.listadas()) > 0 then raise exception 'R1 caso 3: comprobante de 1 h 59 antes y aun así sale el recordatorio'; end if;
  perform pg_temp.esperar('caso 3 dentro', pg_temp.tomar(3, 'recordatorio', false)::text, 'false');
  perform pg_temp.comprobante_de_hace(3, interval '31 minutes 10 seconds');
  if position('e3' in pg_temp.listadas()) = 0 then raise exception 'R1 caso 3: comprobante de 2 h 01 antes y no sale el recordatorio'; end if;
end $$;

-- ── Caso 4: un comprobante que se está mandando AHORA (dentro de la ventana) también lo quita;
--    uno que se quedó a medias antes de la ventana, no ──
do $$
begin
  perform pg_temp.esperar('caso 4 toma', pg_temp.tomar(4, 'comprobante', false)::text, 'true');
  if position('e4' in pg_temp.listadas()) > 0 then raise exception 'R1 caso 4: comprobante mandándose ahora y sale el recordatorio'; end if;
  perform pg_temp.esperar('caso 4 enviando', pg_temp.tomar(4, 'recordatorio', false)::text, 'false');
  perform pg_temp.comprobante_de_hace(4, interval '5 hours');
  if position('e4' in pg_temp.listadas()) = 0 then raise exception 'R1 caso 4: comprobante colgado desde hace 5 h y no sale el recordatorio'; end if;
end $$;

-- ── Caso 5: cambia recordatorio_horas entre el comprobante y el recordatorio: se juzga con el vigente ──
do $$
begin
  perform pg_temp.tomar(5, 'comprobante', true);
  perform pg_temp.comprobante_de_hace(5, interval '13 hours 30 minutes');   -- 15 h antes
  if position('e5' in pg_temp.listadas()) = 0 then raise exception 'R1 caso 5: a 2 h, el comprobante de 15 h antes no deja salir el recordatorio'; end if;
  update public.agenda_ajustes set recordatorio_horas = 24 where clinica_id = '00000000-0000-4000-8000-0000000081c1';
  -- Con 24 h el comprobante de 15 h antes ya cae DENTRO de la ventana: sólo uno.
  if position('e5' in pg_temp.listadas()) > 0 then raise exception 'R1 caso 5: a 24 h, el comprobante de 15 h antes está dentro y aun así sale el recordatorio'; end if;
  perform pg_temp.esperar('caso 5 a 24 h', pg_temp.tomar(5, 'recordatorio', false)::text, 'false');
  update public.agenda_ajustes set recordatorio_horas = 2 where clinica_id = '00000000-0000-4000-8000-0000000081c1';
  perform pg_temp.esperar('caso 5 de vuelta a 2 h', pg_temp.tomar(5, 'recordatorio', true)::text, 'true');
end $$;

-- ── Caso 6: cita movida. El comprobante del inicio viejo no cuenta para el nuevo (como antes de R1);
--    y una cita sin comprobante recibe su recordatorio, como siempre ──
do $$
begin
  perform pg_temp.tomar(6, 'comprobante', true);   -- dentro de la ventana: quitaría el recordatorio…
  update public.appointments set start_time = start_time + interval '10 minutes', end_time = end_time + interval '10 minutes'
   where id = '00000000-0000-4000-8000-0000000081e6';
  if position('e6' in pg_temp.listadas()) = 0 then raise exception 'R1 caso 6: tras mover la cita, el comprobante del inicio viejo sigue quitando el recordatorio'; end if;
  perform pg_temp.esperar('caso 6 movida', pg_temp.tomar(6, 'recordatorio', true)::text, 'true');
end $$;

rollback;
