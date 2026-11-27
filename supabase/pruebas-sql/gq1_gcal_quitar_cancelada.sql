-- Google · BASE-2 · B1 (20261208120000) — una cita CANCELADA cuyo evento se borra en Google se quita de la
-- agenda (decisión de Angel, 2026-11-27) con UNA función de la base: gcal_cita_quitar_cancelada.
--   1 · cierra y desvincula a la vez una cancelada, con o sin paciente, sin tocar estado, hora, título ni
--       updated_at; devuelve (cerró, desvinculó); la segunda llamada no hace nada (false, false).
--   2 · una cancelada que YA estaba cerrada: sólo se desvincula y su cerrada_en no se mueve.
--   3 · no asistida, atendida y agendada: nada (y service_role sigue sin poder cerrarlas a mano:
--       cita_proteger_cierre no cambió).
--   4 · otra clínica, otro evento, otro calendario, la v2 apagada o la conexión no activa: nada.
--   5 · sólo service_role la ejecuta; argumentos en NULL, 22023.
--   6 · no deja avisos en la campana.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
begin;

insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000092c1', 'GQ1 uno', true, 'free', false),
  ('00000000-0000-4000-8000-0000000092c2', 'GQ1 dos', true, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000092a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gq1-a@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000092c1', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000092a1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000092c1', true), ('00000000-0000-4000-8000-0000000092c2', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = true;
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-0000000092c1', '00000000-0000-4000-8000-0000000092a1', 'clinica', 'cal-gq1', 'activa');
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000000092f1', '00000000-0000-4000-8000-0000000092c1', 'Paciente', 'GQ1');
-- e1 cancelada con paciente · e2 cancelada sin paciente · e3 no asistida · e4 atendida · e5 agendada.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                 google_event_id, gcal_calendar_id, gcal_etag, gcal_sync_status)
select ('00000000-0000-4000-8000-0000000092e' || x.n)::uuid, '00000000-0000-4000-8000-0000000092c1',
       case when x.n = 2 then null else '00000000-0000-4000-8000-0000000092f1'::uuid end,
       '00000000-0000-4000-8000-0000000092a1', 'Cita ' || x.n,
       now() + interval '3 days', now() + interval '3 days 30 minutes', x.st, false, 'ev' || x.n, 'cal-gq1', '"e"', 'synced'
  from (values (1, 'cancelled'), (2, 'cancelled'), (3, 'no_show'), (4, 'attended'), (5, 'scheduled')) x(n, st);

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'GQ1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

create function pg_temp.foto(p_n integer) returns text language sql as $$
  select status || '|' || (cerrada_en is not null)::text || '|' || coalesce(google_event_id, '-') || '|' || coalesce(gcal_calendar_id, '-')
         || '|' || coalesce(gcal_etag, '-') || '|' || gcal_sync_status || '|' || title || '|' || start_time::text || '|' || updated_at::text
    from public.appointments where id = ('00000000-0000-4000-8000-0000000092e' || p_n)::uuid;
$$;

-- La llamada, tal como la manda la app (quitarCanceladaDeGoogle). Devuelve «cerró/desvinculó».
create function pg_temp.quitar(p_clinica uuid, p_n integer, p_cal text, p_ev text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_cerrada::text || '/' || r_desvinculada::text into v
    from public.gcal_cita_quitar_cancelada(p_clinica, ('00000000-0000-4000-8000-0000000092e' || p_n)::uuid, p_cal, p_ev);
  reset role;
  return v;
end $$;

do $$
begin
  if to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') is null then
    raise exception 'GQ1 caso 0: falta gcal_cita_quitar_cancelada (falta B1, 20261208120000, o se deshizo)';
  end if;
end $$;

-- ── Caso 4 (antes que nada, con todo intacto): lo que NO es de esa clínica, evento, calendario o conexión ──
do $$
declare v_antes text := pg_temp.foto(1);
begin
  perform pg_temp.esperar('caso 4 otra clínica', pg_temp.quitar('00000000-0000-4000-8000-0000000092c2', 1, 'cal-gq1', 'ev1'), 'false/false');
  perform pg_temp.esperar('caso 4 otro evento', pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', 1, 'cal-gq1', 'ev2'), 'false/false');
  perform pg_temp.esperar('caso 4 otro calendario', pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', 1, 'cal-otro', 'ev1'), 'false/false');
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-0000000092c1';
  perform pg_temp.esperar('caso 4 v2 apagada', pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', 1, 'cal-gq1', 'ev1'), 'false/false');
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000092c1';
  update public.clinica_conexiones_google set estado = 'revocada' where clinica_id = '00000000-0000-4000-8000-0000000092c1';
  perform pg_temp.esperar('caso 4 conexión no activa', pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', 1, 'cal-gq1', 'ev1'), 'false/false');
  update public.clinica_conexiones_google set estado = 'activa' where clinica_id = '00000000-0000-4000-8000-0000000092c1';
  perform pg_temp.esperar('caso 4 intacta', pg_temp.foto(1), v_antes);
end $$;

-- ── Caso 1: cierra y desvincula una cancelada, con y sin paciente; idempotente ──
do $$
declare n integer; v_antes text;
begin
  for n in 1..2 loop
    v_antes := pg_temp.foto(n);
    perform pg_temp.esperar('caso 1 quita ' || n, pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', n, 'cal-gq1', 'ev' || n), 'true/true');
    -- Sólo cambian el cierre y el vínculo: estado, título, hora y updated_at, como estaban.
    perform pg_temp.esperar('caso 1 final ' || n, pg_temp.foto(n),
      replace(v_antes, 'cancelled|false|ev' || n || '|cal-gq1|"e"|synced', 'cancelled|true|-|-|-|unbound'));
    v_antes := pg_temp.foto(n);
    perform pg_temp.esperar('caso 1 otra vez ' || n, pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', n, 'cal-gq1', 'ev' || n), 'false/false');
    perform pg_temp.esperar('caso 1 otra vez, intacta ' || n, pg_temp.foto(n), v_antes);
  end loop;
end $$;

-- ── Caso 2: una cancelada que ya estaba CERRADA pero sigue ligada: sólo se desvincula ──
do $$
declare v_cierre timestamptz;
begin
  -- Como postgres (el disparador de cierre lo deja pasar): se vuelve a ligar la e2, ya cerrada.
  update public.appointments set google_event_id = 'ev2', gcal_calendar_id = 'cal-gq1', gcal_etag = '"e"', gcal_sync_status = 'synced'
   where id = '00000000-0000-4000-8000-0000000092e2';
  select cerrada_en into v_cierre from public.appointments where id = '00000000-0000-4000-8000-0000000092e2';
  perform pg_temp.esperar('caso 2 ya cerrada', pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', 2, 'cal-gq1', 'ev2'), 'false/true');
  perform pg_temp.esperar('caso 2 cierre sin mover',
    (select (cerrada_en = v_cierre)::text || '|' || coalesce(google_event_id, '-') || '|' || gcal_sync_status
       from public.appointments where id = '00000000-0000-4000-8000-0000000092e2'), 'true|-|unbound');
end $$;

-- ── Caso 3: una no asistida, una atendida y una agendada NO se quitan (ni service_role las cierra a mano) ──
do $$
declare n integer; v_antes text;
begin
  for n in 3..5 loop
    v_antes := pg_temp.foto(n);
    perform pg_temp.esperar('caso 3 función ' || n, pg_temp.quitar('00000000-0000-4000-8000-0000000092c1', n, 'cal-gq1', 'ev' || n), 'false/false');
    begin
      perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
      set local role service_role;
      update public.appointments set cerrada_en = now() where id = ('00000000-0000-4000-8000-0000000092e' || n)::uuid;
      reset role;
      raise exception 'GQ1 caso 3: service_role cerró una cita que no está cancelada (%)', n;
    exception when insufficient_privilege then reset role;
    end;
    perform pg_temp.esperar('caso 3 intacta ' || n, pg_temp.foto(n), v_antes);
  end loop;
end $$;

-- ── Caso 5: sólo service_role; argumentos en NULL ──
do $$
declare v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', v_rol);
      perform * from public.gcal_cita_quitar_cancelada('00000000-0000-4000-8000-0000000092c1', '00000000-0000-4000-8000-0000000092e1', 'cal-gq1', 'ev1');
      reset role;
      raise exception 'GQ1 caso 5: % ejecutó gcal_cita_quitar_cancelada', v_rol;
    exception when insufficient_privilege then reset role;
    end;
  end loop;
  begin
    perform * from public.gcal_cita_quitar_cancelada('00000000-0000-4000-8000-0000000092c1', '00000000-0000-4000-8000-0000000092e1', 'cal-gq1', null);
    raise exception 'GQ1 caso 5: aceptó un argumento en NULL';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Caso 6: quitar una cita no deja avisos en la campana (el único es el de la conexión que el caso 4 revocó) ──
select pg_temp.esperar('caso 6 avisos',
  (select coalesce(string_agg(tipo, ',' order by tipo), '-') from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000000092c1'),
  'google_desconectado');

rollback;
