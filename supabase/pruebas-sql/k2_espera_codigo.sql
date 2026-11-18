-- Agenda tanda K (K2, punto 10) — cuánto falta para volver a pedir el código y
-- el código de un correo anterior (20261123130000_agenda_k2_espera_codigo.sql,
-- que lleva fundida la que era 20261123130100: los 30 s por enlace).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- MUTACIONES (comprobadas en rojo): sin la rama 'reemplazado' de
-- reserva_codigo_verificar (caso 2 da 'incorrecto' y suma un equivocado);
-- `OFFSET p_limite - 1` cambiado por `OFFSET 0` en rate_limit_espera (caso 5
-- da la espera del renglón más reciente, no la del que hace tope); sin el
-- filtro por enlace_id en reserva_espera_reenvio (caso 5c: f2 ve la espera de f1).
begin;

-- ── Datos: c1 VIP encendida, médico b1, enlace fijo f1 ──
insert into public.clinicas (id, nombre, es_vip_grant) values ('00000000-0000-4000-8000-0000000b2c01', 'k2 prueba', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000b2b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'k2-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000b2c01', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000000b2b01';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000b2c01', true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-0000000b2f01', '00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2b01', 'fijo', pg_temp.h('k2f1'));

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'K2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Como el servidor (service_role): pedir y verificar códigos de un correo en f1.
create function pg_temp.emitir(p_correo text, p_codigo text) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  v := public.reserva_codigo_emitir('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f01',
                                    pg_temp.h('c:' || p_correo), pg_temp.h('cod:' || p_codigo));
  reset role;
  return v;
end $$;
create function pg_temp.verificar(p_correo text, p_codigo text) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  v := public.reserva_codigo_verificar('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f01',
                                       pg_temp.h('c:' || p_correo), pg_temp.h('cod:' || p_codigo), pg_temp.h('ficha:' || p_codigo));
  reset role;
  return v;
end $$;
create function pg_temp.equivocados(p_correo text) returns text language sql as $$
  select string_agg(intentos::text, ',' order by created_at) from public.reserva_verificaciones
   where enlace_id = '00000000-0000-4000-8000-0000000b2f01' and correo_hmac = pg_temp.h('c:' || p_correo);
$$;
create function pg_temp.espera(p_ruta text, p_limite integer, p_ventana integer) returns text language plpgsql as $$
declare v integer;
begin
  set local role service_role;
  v := public.rate_limit_espera(p_ruta, p_limite, p_ventana);
  reset role;
  return v::text;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to service_role;

-- 1 · Pedir, reenviar: el primero queda invalidado (intentos = 5, D3, sin cambios).
select pg_temp.esperar('1 emitir', pg_temp.emitir('ana', '111111'), 'ok');
select pg_temp.esperar('1 reenviar', pg_temp.emitir('ana', '222222'), 'ok');
select pg_temp.esperar('1 el anterior invalidado', pg_temp.equivocados('ana'), '5,0');

-- 2 · El código del correo ANTERIOR: 'reemplazado' y NO suma equivocado al vigente.
select pg_temp.esperar('2 código anterior', pg_temp.verificar('ana', '111111'), 'reemplazado');
select pg_temp.esperar('2 no suma', pg_temp.equivocados('ana'), '5,0');

-- 3 · El tope no se relaja: un código que no es ni el vigente ni uno anterior suma, y el 5.º agota.
select pg_temp.esperar('3 equivocado ' || i, pg_temp.verificar('ana', '99999' || i), case when i < 5 then 'incorrecto' else 'agotado' end)
  from generate_series(1, 5) i;
select pg_temp.esperar('3 contados', pg_temp.equivocados('ana'), '5,5');
-- Agotado el vigente, ni el anterior ni el vigente valen.
select pg_temp.esperar('3 agotado y anterior', pg_temp.verificar('ana', '111111'), 'agotado');
select pg_temp.esperar('3 agotado y vigente', pg_temp.verificar('ana', '222222'), 'agotado');

-- 4 · Un anterior VENCIDO cuenta como equivocado (como antes); otro correo no comparte códigos.
select pg_temp.esperar('4 emitir', pg_temp.emitir('bea', '333333'), 'ok');
select pg_temp.esperar('4 reenviar', pg_temp.emitir('bea', '444444'), 'ok');
update public.reserva_verificaciones set caduca_en = now() - interval '1 second'
 where enlace_id = '00000000-0000-4000-8000-0000000b2f01' and correo_hmac = pg_temp.h('c:bea') and intentos = 5;
select pg_temp.esperar('4 anterior vencido', pg_temp.verificar('bea', '333333'), 'incorrecto');
select pg_temp.esperar('4 de otro correo', pg_temp.verificar('bea', '222222'), 'incorrecto');
select pg_temp.esperar('4 el vigente sigue valiendo', pg_temp.verificar('bea', '444444'), 'ok');

-- 4b · Un código anterior de OTRO enlace con el mismo correo NO es 'reemplazado' (auditoría H7). Otra clínica
--      con el mismo enlace no puede existir: la FK (enlace_id, clinica_id) de reserva_verificaciones lo impide.
-- Revocado (sólo puede haber un fijo vigente por médico); a verificar no le importa.
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, revocado_en) values
  ('00000000-0000-4000-8000-0000000b2f02', '00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2b01', 'fijo', pg_temp.h('k2f2'), now());
insert into public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, intentos, created_at) values
  ('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f02', pg_temp.h('c:eva'), pg_temp.h('cod:555555'), now() + interval '5 min', 5, clock_timestamp());
select pg_temp.esperar('4b emitir en f1', pg_temp.emitir('eva', '777777'), 'ok');
select pg_temp.esperar('4b anterior de otro enlace', pg_temp.verificar('eva', '555555'), 'incorrecto');

-- 5 · rate_limit_espera: 0 con sitio; con el tope, lo que falta para que salga el renglón que hace tope.
insert into public.ip_rate_limits (ip, ruta, created_at) values
  ('reserva', 'k2:prueba', now() - interval '50 minutes'),
  ('reserva', 'k2:prueba', now() - interval '20 minutes'),
  ('reserva', 'k2:prueba', now() - interval '10 seconds'),
  ('reserva', 'k2:vieja', now() - interval '2 hours');
select pg_temp.esperar('5 con sitio (4 en 1 h)', pg_temp.espera('k2:prueba', 4, 3600), '0');
select pg_temp.esperar('5 tope 3 en 1 h: sale el de hace 50 min', pg_temp.espera('k2:prueba', 3, 3600), '600');
select pg_temp.esperar('5 tope 1 en 30 s: sale el de hace 10 s', pg_temp.espera('k2:prueba', 1, 30), '20');
select pg_temp.esperar('5 fuera de la ventana no cuenta', pg_temp.espera('k2:vieja', 1, 3600), '0');
select pg_temp.esperar('5 otra ruta', pg_temp.espera('k2:otra', 1, 30), '0');

-- 5b · Coincide con rate_limit_intento DE VERDAD (auditoría H7): con 2 de 3 cabe (0); con 3, bloquea y la espera es > 0.
create function pg_temp.intento(p_ruta text) returns boolean language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  select bloqueado into v from public.rate_limit_intento('reserva', p_ruta, 3, 60);
  reset role;
  return v;
end $$;
select pg_temp.esperar('5b intento 1', pg_temp.intento('k2:real')::text, 'false');
select pg_temp.esperar('5b intento 2', pg_temp.intento('k2:real')::text, 'false');
select pg_temp.esperar('5b con 2 de 3 cabe', pg_temp.espera('k2:real', 3, 3600), '0');
select pg_temp.esperar('5b intento 3', pg_temp.intento('k2:real')::text, 'false');
select pg_temp.esperar('5b intento 4 bloquea', pg_temp.intento('k2:real')::text, 'true');
select pg_temp.esperar('5b y la espera lo dice (1 h)', pg_temp.espera('k2:real', 3, 3600), '3600');

-- 5c · Los 30 s entre códigos son POR ENLACE (20261123130000, revisión de seguridad): pedir con el mismo correo
--      en el enlace f1 no revela nada desde f2, ni desde otra clínica, ni para otro correo.
create function pg_temp.reenvio(p_clinica uuid, p_enlace uuid, p_correo text) returns text language plpgsql as $$
declare v integer;
begin
  set local role service_role;
  v := public.reserva_espera_reenvio(p_clinica, p_enlace, pg_temp.h('c:' || p_correo), 30);
  reset role;
  return v::text;
end $$;
select pg_temp.esperar('5c emitir fer en f1', pg_temp.emitir('fer', '888888'), 'ok');
-- emitir sella con clock_timestamp(); la cuenta usa now() (inicio de esta transacción): se iguala para un número exacto.
update public.reserva_verificaciones set created_at = now()
 where enlace_id = '00000000-0000-4000-8000-0000000b2f01' and correo_hmac = pg_temp.h('c:fer');
select pg_temp.esperar('5c f1: faltan 30 s', pg_temp.reenvio('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f01', 'fer'), '30');
select pg_temp.esperar('5c f2 (otro enlace): nada', pg_temp.reenvio('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f02', 'fer'), '0');
select pg_temp.esperar('5c otra clínica: nada', pg_temp.reenvio('00000000-0000-4000-8000-0000000b2c99', '00000000-0000-4000-8000-0000000b2f01', 'fer'), '0');
select pg_temp.esperar('5c otro correo: nada', pg_temp.reenvio('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f01', 'gil'), '0');
update public.reserva_verificaciones set created_at = now() - interval '31 seconds'
 where enlace_id = '00000000-0000-4000-8000-0000000b2f01' and correo_hmac = pg_temp.h('c:fer');
select pg_temp.esperar('5c pasados 31 s: ya', pg_temp.reenvio('00000000-0000-4000-8000-0000000b2c01', '00000000-0000-4000-8000-0000000b2f01', 'fer'), '0');

-- 6 · Argumentos inválidos: 22023; y sin permiso para anon ni authenticated.
do $$
begin
  begin
    perform public.rate_limit_espera('k2:prueba', 0, 30);
    raise exception 'K2 6: el límite 0 no falló';
  exception when sqlstate '22023' then null;
  end;
end $$;
select pg_temp.esperar('6 permisos anon/authenticated/service_role',
  has_function_privilege('anon', 'public.rate_limit_espera(text, integer, integer)', 'EXECUTE')::text || '/' ||
  has_function_privilege('authenticated', 'public.rate_limit_espera(text, integer, integer)', 'EXECUTE')::text || '/' ||
  has_function_privilege('service_role', 'public.rate_limit_espera(text, integer, integer)', 'EXECUTE')::text,
  'false/false/true');
select pg_temp.esperar('6 permisos de reserva_espera_reenvio anon/authenticated/service_role',
  has_function_privilege('anon', 'public.reserva_espera_reenvio(uuid, uuid, text, integer)', 'EXECUTE')::text || '/' ||
  has_function_privilege('authenticated', 'public.reserva_espera_reenvio(uuid, uuid, text, integer)', 'EXECUTE')::text || '/' ||
  has_function_privilege('service_role', 'public.reserva_espera_reenvio(uuid, uuid, text, integer)', 'EXECUTE')::text,
  'false/false/true');

rollback;
