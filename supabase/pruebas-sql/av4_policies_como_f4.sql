-- Avisos globales · M1 — las dos policies de avisos_clinica, con las columnas nuevas en NULL, dejan
-- ver y marcar EXACTAMENTE las mismas filas que las de F4. (Auditoría: el «OFFSET 0» que M1 mete en
-- su EXISTS es una barrera de optimización, no un cambio de qué se ve; esta prueba lo vigila.)
-- Cómo: se siembran avisos con la forma de F4, se apunta qué ve y qué puede marcar cada perfil con
-- las policies de M1, se cambian DENTRO de esta transacción por las de F4 (el texto de la reversa)
-- y se vuelve a apuntar. Tienen que coincidir fila a fila. Termina en rollback.
begin;

-- c1: b1 médico administrador, b2 y b6 médicos invitados, b4 secretaria. c2: b3 administrador.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000004e0c01', 'AV4 uno', true, 'free'),
  ('00000000-0000-4000-8000-0000004e0c02', 'AV4 dos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-0000004e0b0' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'av4-b' || n || '@prueba.local', now(), now() from (values (1), (2), (3), (4), (6)) x(n);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000004e0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01')
 where id::text ~ '4e0b0[126]$';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000004e0c01', role = 'secretaria', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-0000004e0b04';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000004e0c02', role = 'medico', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000004e0b03';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000004e0c01', true), ('00000000-0000-4000-8000-0000004e0c02', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000004e0f01', '00000000-0000-4000-8000-0000004e0c01', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-0000004e0f02', '00000000-0000-4000-8000-0000004e0c02', 'Paciente', 'Dos');
-- Citas (como postgres): dos de cada médico de c1 y dos de c2.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
select ('00000000-0000-4000-8000-0000004e0a' || lpad(n::text, 2, '0'))::uuid,
       case when n <= 6 then '00000000-0000-4000-8000-0000004e0c01'::uuid else '00000000-0000-4000-8000-0000004e0c02'::uuid end,
       case when n <= 6 then '00000000-0000-4000-8000-0000004e0f01'::uuid else '00000000-0000-4000-8000-0000004e0f02'::uuid end,
       ('00000000-0000-4000-8000-0000004e0b0' || (array[1, 1, 2, 2, 6, 6, 3, 3])[n])::uuid,
       'Cita ' || n, date_trunc('day', now()) + make_interval(days => 3, hours => 8 + n), date_trunc('day', now()) + make_interval(days => 3, hours => 8 + n, mins => 30), 'scheduled'
  from generate_series(1, 8) n;
-- Lo que esas altas hayan dejado no cuenta: la prueba siembra lo suyo.
delete from public.avisos_clinica where clinica_id in ('00000000-0000-4000-8000-0000004e0c01', '00000000-0000-4000-8000-0000004e0c02');
-- Avisos con la FORMA DE F4 (columnas nuevas en NULL): los 7 tipos repartidos entre las 8 citas, uno
-- ya cerrado, y uno de una cita que no existe (huérfano: nadie debe verlo).
insert into public.avisos_clinica (clinica_id, tipo, cita_id)
select a.clinica_id, t.tipo, a.id
  from public.appointments a
  join (values (1, 'reserva_enlace'), (2, 'cancelacion_paciente'), (3, 'reagendado_paciente'), (4, 'google_por_asignar'),
               (5, 'empalme_google'), (6, 'google_movimiento_rechazado'), (7, 'confirmacion_paciente'), (8, 'reserva_enlace'),
               (1, 'confirmacion_paciente'), (3, 'cancelacion_paciente'), (5, 'confirmacion_paciente'), (7, 'cancelacion_paciente')) t(n, tipo)
    on a.id = ('00000000-0000-4000-8000-0000004e0a' || lpad(t.n::text, 2, '0'))::uuid;
insert into public.avisos_clinica (clinica_id, tipo, cita_id) values
  ('00000000-0000-4000-8000-0000004e0c01', 'reserva_enlace', gen_random_uuid());
update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-0000004e0b01'
 where cita_id = '00000000-0000-4000-8000-0000004e0a02';

create temp table _visto (ronda text, perfil text, que text, filas text) on commit drop;
-- Qué VE (SELECT) y qué PUEDE MARCAR (UPDATE, deshecho en el acto) cada perfil, como lista ordenada de «tipo>cita».
create function pg_temp.apuntar(p_ronda text) returns void language plpgsql as $$
declare
  v_perfil record;
  v text;
begin
  for v_perfil in select * from (values ('administrador', '00000000-0000-4000-8000-0000004e0b01'::uuid), ('invitado b2', '00000000-0000-4000-8000-0000004e0b02'),
                                        ('invitado b6', '00000000-0000-4000-8000-0000004e0b06'), ('secretaria', '00000000-0000-4000-8000-0000004e0b04'),
                                        ('otra clínica', '00000000-0000-4000-8000-0000004e0b03')) x(nombre, id) loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_perfil.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select coalesce(string_agg(tipo || '>' || right(cita_id::text, 2) || (case when revisado_en is null then '' else '(cerrado)' end), ',' order by tipo, cita_id), '-')
      into v from public.avisos_clinica;
    reset role;
    insert into _visto values (p_ronda, v_perfil.nombre, 've', v);
    begin
      set local role authenticated;
      with u as (update public.avisos_clinica set revisado_en = now(), revisado_por = v_perfil.id returning tipo, cita_id)
      select coalesce(string_agg(tipo || '>' || right(cita_id::text, 2), ',' order by tipo, cita_id), '-') into v from u;
      raise exception using message = v, errcode = 'P0099';
    exception when sqlstate 'P0099' then
      v := sqlerrm;
    end;
    reset role;
    insert into _visto values (p_ronda, v_perfil.nombre, 'marca', v);
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.apuntar('M1');

-- Las policies de F4, tal cual (el texto que deja la reversa de M1). Sólo en esta transacción.
drop policy avisos_clinica_select on public.avisos_clinica;
drop policy avisos_clinica_update on public.avisos_clinica;
create policy avisos_clinica_select on public.avisos_clinica for select to authenticated
  using (clinica_id = public.get_clinica_id()
         and exists (select 1 from public.appointments a
                      where a.id = avisos_clinica.cita_id and a.clinica_id = public.get_clinica_id()));
create policy avisos_clinica_update on public.avisos_clinica for update to authenticated
  using (clinica_id = public.get_clinica_id() and revisado_en is null
         and exists (select 1 from public.appointments a
                      where a.id = avisos_clinica.cita_id and a.clinica_id = public.get_clinica_id()))
  with check (clinica_id = public.get_clinica_id() and revisado_por = auth.uid());

select pg_temp.apuntar('F4');

do $$
declare v text; v_n integer;
begin
  -- Fila a fila: perfil y operación, lo mismo con M1 que con F4.
  select string_agg(m.perfil || ' ' || m.que || ': M1 [' || m.filas || '] F4 [' || f.filas || ']', '; ') into v
    from _visto m join _visto f on f.perfil = m.perfil and f.que = m.que and f.ronda = 'F4'
   where m.ronda = 'M1' and m.filas is distinct from f.filas;
  if v is not null then raise exception 'AV4: las policies de M1 no dan lo mismo que las de F4 → %', v; end if;
  select count(*) into v_n from _visto;
  if v_n <> 20 then raise exception 'AV4: esperaba 20 apuntes (5 perfiles × 2 × 2), hay %', v_n; end if;
  -- Y que la prueba prueba algo: el administrador ve los 10 de su clínica con cita (uno cerrado) y puede
  -- marcar 9; cada invitado, sólo los de sus citas; la otra clínica, los suyos; el huérfano, nadie.
  select string_agg(perfil || '=' || (select count(*) from regexp_split_to_table(nullif(filas, '-'), ',')), ' ' order by perfil) into v
    from _visto where ronda = 'M1' and que = 've';
  if v <> 'administrador=9 invitado b2=3 invitado b6=3 otra clínica=3 secretaria=9' then
    raise exception 'AV4: lo que ve cada perfil no es lo esperado: %', v;
  end if;
  select string_agg(perfil || '=' || (select count(*) from regexp_split_to_table(nullif(filas, '-'), ',')), ' ' order by perfil) into v
    from _visto where ronda = 'M1' and que = 'marca';
  if v <> 'administrador=8 invitado b2=3 invitado b6=3 otra clínica=3 secretaria=8' then
    raise exception 'AV4: lo que puede marcar cada perfil no es lo esperado: %', v;
  end if;
end $$;

rollback;
