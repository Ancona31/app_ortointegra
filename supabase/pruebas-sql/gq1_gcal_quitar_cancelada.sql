-- Google · una cita CANCELADA cuyo evento se borra en Google se quita de la agenda (decisión de Angel,
-- 2026-11-27). NO hay migración: el código usa dos cosas que la base YA tiene, y esta prueba las fija
-- para que un cambio futuro de gcal_aplicar_evento (F2) o de cita_proteger_cierre (F5b) no lo rompa
-- en silencio:
--   1 · service_role cierra (cerrada_en) una cancelada sin sustituta, con los cuatro filtros de
--       cerrarCancelada (gcalSincronizacionBase.ts) y de POST …/quitar; y NO una atendida ni una no asistida.
--   2 · gcal_aplicar_evento con p_desvincular y sin cambios, sobre una cancelada (cerrada o no), la
--       desvincula (google_event_id, gcal_calendar_id y gcal_etag a NULL, 'unbound') sin tocar estado,
--       hora, título ni updated_at.
--   3 · cerrar no mueve updated_at (por eso se puede cerrar ANTES de desvincular con el mismo
--       p_esperado_updated_at) y ninguna de las dos escrituras deja avisos en la campana.
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

-- El cierre, tal como lo manda la app (los cuatro filtros). Devuelve las filas cerradas.
create function pg_temp.cerrar(p_clinica uuid, p_n integer) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  update public.appointments set cerrada_en = clock_timestamp()
   where id = ('00000000-0000-4000-8000-0000000092e' || p_n)::uuid and clinica_id = p_clinica
     and status = 'cancelled' and cerrada_en is null;
  get diagnostics v = row_count;
  reset role;
  return v;
end $$;

-- La desvinculación, tal como la manda la app (aplicarEvento con desvincular y sin cambios).
create function pg_temp.desvincular(p_n integer) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.gcal_aplicar_evento('00000000-0000-4000-8000-0000000092c1', ('00000000-0000-4000-8000-0000000092e' || p_n)::uuid,
         (select updated_at from public.appointments where id = ('00000000-0000-4000-8000-0000000092e' || p_n)::uuid),
         'cal-gq1', null, now(), null, true, null, null, null, null, false, null, false);
  reset role;
  return v;
end $$;

-- ── Caso 1: cerrar y luego desvincular una cancelada, con y sin paciente ──
do $$
declare n integer; v_antes text; v_despues text;
begin
  for n in 1..2 loop
    v_antes := pg_temp.foto(n);
    perform pg_temp.esperar('caso 1 cierra ' || n, pg_temp.cerrar('00000000-0000-4000-8000-0000000092c1', n)::text, '1');
    -- Cerrar no mueve updated_at ni el vínculo.
    perform pg_temp.esperar('caso 1 tras cerrar ' || n, pg_temp.foto(n), replace(v_antes, 'cancelled|false|', 'cancelled|true|'));
    perform pg_temp.esperar('caso 1 desvincula ' || n, pg_temp.desvincular(n)::text, '1');
    v_despues := pg_temp.foto(n);
    perform pg_temp.esperar('caso 1 final ' || n, v_despues,
      replace(v_antes, 'cancelled|false|ev' || n || '|cal-gq1|"e"|synced', 'cancelled|true|-|-|-|unbound'));
  end loop;
  -- Repetirlo no hace nada (idempotente): ni cierra otra vez ni encuentra el vínculo.
  perform pg_temp.esperar('caso 1 cerrar otra vez', pg_temp.cerrar('00000000-0000-4000-8000-0000000092c1', 1)::text, '0');
  perform pg_temp.esperar('caso 1 desvincular otra vez', pg_temp.desvincular(1)::text, '0');
end $$;

-- ── Caso 2: una no asistida, una atendida y una agendada NO se cierran (ni con el filtro quitado) ──
do $$
declare n integer;
begin
  for n in 3..5 loop
    perform pg_temp.esperar('caso 2 con filtro ' || n, pg_temp.cerrar('00000000-0000-4000-8000-0000000092c1', n)::text, '0');
    begin
      perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
      set local role service_role;
      update public.appointments set cerrada_en = now() where id = ('00000000-0000-4000-8000-0000000092e' || n)::uuid;
      reset role;
      raise exception 'GQ1 caso 2: service_role cerró una cita que no está cancelada (%)', n;
    exception when insufficient_privilege then reset role;
    end;
    perform pg_temp.esperar('caso 2 sigue abierta ' || n,
      (select (cerrada_en is null)::text || '|' || google_event_id from public.appointments where id = ('00000000-0000-4000-8000-0000000092e' || n)::uuid),
      'true|ev' || n);
  end loop;
end $$;

-- ── Caso 3: con la clínica de OTRO, nada (el filtro de clinica_id; y la RPC filtra por p_clinica_id) ──
do $$
begin
  update public.appointments set cerrada_en = null, google_event_id = 'ev1', gcal_calendar_id = 'cal-gq1', gcal_etag = '"e"', gcal_sync_status = 'synced'
   where id = '00000000-0000-4000-8000-0000000092e1';
  perform pg_temp.esperar('caso 3 otra clínica', pg_temp.cerrar('00000000-0000-4000-8000-0000000092c2', 1)::text, '0');
  perform pg_temp.esperar('caso 3 sigue abierta', (select (cerrada_en is null)::text from public.appointments where id = '00000000-0000-4000-8000-0000000092e1'), 'true');
end $$;

-- ── Caso 4: nada de esto deja avisos en la campana ──
select pg_temp.esperar('caso 4 avisos', (select count(*)::text from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000000092c1'), '0');

rollback;
