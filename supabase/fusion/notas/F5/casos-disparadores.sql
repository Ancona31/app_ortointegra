-- F5 · Tabla de casos de los disparadores BEFORE de appointments.
-- Corre cada combinación (rol × operación × cita) y escribe una línea por caso:
--   clinica|operacion|cita|rol|SQLSTATE|HINT|mensaje|filas
-- Se corre igual en dos clones y se comparan las salidas (casos-disparadores.sh).
-- Todo en UNA transacción con ROLLBACK, y cada caso en su subtransacción (que
-- también se deshace cuando sale bien): ningún caso ve lo que hizo otro.
-- Clínica A: v2 ENCENDIDA. Clínica B: v2 APAGADA. Las dos con un bloqueo del
-- médico el día D de 09:00 a 12:00 UTC. Datos inventados.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
BEGIN;
SET LOCAL lock_timeout = '5s';

INSERT INTO public.clinicas (id, nombre, es_vip_grant) VALUES
  ('f5000000-0000-4000-8000-0000000ca001', 'F5 casos A', true),
  ('f5000000-0000-4000-8000-0000000cb001', 'F5 casos B', true);
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
SELECT u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.correo, now(), now()
  FROM (VALUES ('f5000000-0000-4000-8000-0000000b0a01'::uuid, 'f5-ma@prueba.local'),
               ('f5000000-0000-4000-8000-0000000b0a02'::uuid, 'f5-sa@prueba.local'),
               ('f5000000-0000-4000-8000-0000000b0a03'::uuid, 'f5-ma2@prueba.local'),
               ('f5000000-0000-4000-8000-0000000b0b01'::uuid, 'f5-mb@prueba.local')) u(id, correo);
UPDATE public.profiles p
   SET clinica_id = x.clinica, role = x.rol, es_admin_de_clinica = x.admin,
       nombres = 'Persona', apellido_paterno = 'F5', especialidad = 'Ortopedia', cedula_profesional = '1234567'
  FROM (VALUES ('f5000000-0000-4000-8000-0000000b0a01'::uuid, 'f5000000-0000-4000-8000-0000000ca001'::uuid, 'medico', true),
               ('f5000000-0000-4000-8000-0000000b0a02', 'f5000000-0000-4000-8000-0000000ca001', 'secretaria', false),
               ('f5000000-0000-4000-8000-0000000b0a03', 'f5000000-0000-4000-8000-0000000ca001', 'medico', false),
               ('f5000000-0000-4000-8000-0000000b0b01', 'f5000000-0000-4000-8000-0000000cb001', 'medico', true)) x(id, clinica, rol, admin)
 WHERE p.id = x.id;
INSERT INTO public.agenda_ajustes (clinica_id, agenda_v2_encendida) VALUES
  ('f5000000-0000-4000-8000-0000000ca001', true), ('f5000000-0000-4000-8000-0000000cb001', false);
INSERT INTO public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) VALUES
  ('f5000000-0000-4000-8000-0000000d0a01', 'f5000000-0000-4000-8000-0000000ca001', 'f5000000-0000-4000-8000-0000000b0a01', 'KA', 'KA', 'Calle 1', true, 'UTC'),
  ('f5000000-0000-4000-8000-0000000d0a02', 'f5000000-0000-4000-8000-0000000ca001', 'f5000000-0000-4000-8000-0000000b0a01', 'KA2', 'KA2', 'Calle 2', true, 'UTC'),
  ('f5000000-0000-4000-8000-0000000d0a03', 'f5000000-0000-4000-8000-0000000ca001', 'f5000000-0000-4000-8000-0000000b0a03', 'KA3', 'KA3', 'Calle 3', true, 'UTC'),
  ('f5000000-0000-4000-8000-0000000d0b01', 'f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01', 'KB', 'KB', 'Calle 1', true, 'UTC'),
  ('f5000000-0000-4000-8000-0000000d0b02', 'f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01', 'KB2', 'KB2', 'Calle 2', true, 'UTC');
INSERT INTO public.pacientes (id, clinica_id, nombre, apellidos) VALUES
  ('f5000000-0000-4000-8000-0000000e0a01', 'f5000000-0000-4000-8000-0000000ca001', 'Paciente', 'A'),
  ('f5000000-0000-4000-8000-0000000e0b01', 'f5000000-0000-4000-8000-0000000cb001', 'Paciente', 'B');
INSERT INTO public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) VALUES ('v1-f5-casos', repeat('d', 64), true, now());
INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) VALUES
  ('f5000000-0000-4000-8000-0000000f0a01', 'f5000000-0000-4000-8000-0000000ca001', 'f5000000-0000-4000-8000-0000000b0a01', 'fijo', repeat('a', 64)),
  ('f5000000-0000-4000-8000-0000000f0b01', 'f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01', 'fijo', repeat('b', 64));
-- Día D: lunes 1 de marzo de 2027 (futuro). El bloqueo, de 09:00 a 12:00 UTC.
INSERT INTO public.agenda_bloqueos (clinica_id, medico_id, inicio, fin)
VALUES ('f5000000-0000-4000-8000-0000000ca001', 'f5000000-0000-4000-8000-0000000b0a01', '2027-03-01 09:00+00', '2027-03-01 12:00+00'),
       ('f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01', '2027-03-01 09:00+00', '2027-03-01 12:00+00');

-- Las citas, como supabase_admin (exento de todos). etiqueta → id fijo por clínica.
CREATE TEMP TABLE f5_cita (etiqueta text, clinica char(1), id uuid, PRIMARY KEY (etiqueta, clinica));
INSERT INTO f5_cita
SELECT e.etiqueta, c.letra, ('f5000000-0000-4000-8000-0000000' || c.hex || lpad(e.n::text, 4, '0'))::uuid
  FROM (VALUES ('A', 'a'), ('B', 'b')) c(letra, hex),
       (VALUES (1, 'agendada'), (2, 'atendida_nota'), (3, 'atendida_sin'), (4, 'enlace'), (5, 'enlace_atendida_nota'),
               (6, 'cancelada'), (7, 'cerrada'), (8, 'viva'), (9, 'evento'), (10, 'dentro_bloqueo'), (11, 'enlace_pasada'),
               (12, 'evento_atendido')) e(n, etiqueta);
INSERT INTO public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status,
                                 consultorio_id, consultorio_nombre, consultorio_timezone, notes, cerrada_en)
SELECT f.id, cl.id, cl.medico, CASE WHEN f.etiqueta IN ('evento', 'enlace', 'enlace_pasada', 'evento_atendido') THEN NULL ELSE cl.paciente END,
       f.etiqueta, x.inicio, x.inicio + interval '30 minutes', x.estado, cl.consultorio, 'K', 'UTC', 'nota',
       CASE WHEN f.etiqueta = 'cerrada' THEN now() END
  FROM f5_cita f
  JOIN (VALUES ('A', 'f5000000-0000-4000-8000-0000000ca001'::uuid, 'f5000000-0000-4000-8000-0000000b0a01'::uuid,
                'f5000000-0000-4000-8000-0000000e0a01'::uuid, 'f5000000-0000-4000-8000-0000000d0a01'::uuid),
               ('B', 'f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01',
                'f5000000-0000-4000-8000-0000000e0b01', 'f5000000-0000-4000-8000-0000000d0b01')) cl(letra, id, medico, paciente, consultorio)
    ON cl.letra = f.clinica
  JOIN (VALUES ('agendada', timestamptz '2027-03-01 14:00+00', 'scheduled'), ('atendida_nota', '2027-03-01 15:00+00', 'attended'),
               ('atendida_sin', '2027-03-01 16:00+00', 'attended'), ('enlace', '2027-03-01 17:00+00', 'scheduled'),
               ('enlace_atendida_nota', '2027-03-01 18:00+00', 'attended'), ('cancelada', '2027-03-01 19:00+00', 'cancelled'),
               ('cerrada', '2027-03-01 20:00+00', 'cancelled'), ('viva', '2027-03-01 21:00+00', 'scheduled'),
               ('evento', '2027-03-01 13:00+00', 'scheduled'), ('dentro_bloqueo', '2027-03-01 10:00+00', 'scheduled'),
               ('enlace_pasada', '2026-01-05 15:00+00', 'scheduled'), ('evento_atendido', '2027-03-01 22:00+00', 'attended')) x(etiqueta, inicio, estado)
    ON x.etiqueta = f.etiqueta;
UPDATE public.appointments a
   SET reserva_canal = 'fijo', reserva_enlace_id = CASE f.clinica WHEN 'A' THEN 'f5000000-0000-4000-8000-0000000f0a01'::uuid
                                                                ELSE 'f5000000-0000-4000-8000-0000000f0b01'::uuid END,
       reserva_nombre = 'Persona', reserva_telefono = '5544440001', reserva_correo = 'p@prueba.local',
       reserva_tel_hmac = repeat('a', 64), reserva_correo_hmac = repeat('b', 64),
       reserva_aviso_version = 'v1-f5-casos', reserva_aceptado_en = now(), reserva_historial_previo = 0
  FROM f5_cita f
 WHERE a.id = f.id AND f.etiqueta IN ('enlace', 'enlace_atendida_nota', 'enlace_pasada');
-- Las notas clínicas ligadas.
INSERT INTO public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
SELECT a.paciente_id, a.medico_id, 'NOTA F5', 'manual', a.id
  FROM public.appointments a JOIN f5_cita f ON f.id = a.id
 WHERE f.etiqueta IN ('atendida_nota', 'enlace_atendida_nota');

-- Las operaciones. %1$s = id de la cita; %2$s = clínica; %3$s = médico; %4$s = paciente;
-- %5$s = otro consultorio del mismo médico; %6$s = otro médico de la clínica; %7$s = enlace; %8$s = sustituta viva.
CREATE TEMP TABLE f5_op (op text PRIMARY KEY, sobre_cita boolean, plantilla text);
INSERT INTO f5_op VALUES
  ('alta_fuera', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, consultorio_id, consultorio_nombre, consultorio_timezone) VALUES (%2$L, %3$L, %4$L, 'x', '2027-03-01 23:00+00', '2027-03-01 23:30+00', NULL, NULL, 'UTC')$q$),
  ('alta_en_bloqueo', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time) VALUES (%2$L, %3$L, %4$L, 'x', '2027-03-01 10:30+00', '2027-03-01 11:00+00')$q$),
  ('alta_en_bloqueo_sin_medico', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, title, start_time, end_time) VALUES (%2$L, NULL, 'x', '2027-03-01 10:30+00', '2027-03-01 11:00+00')$q$),
  ('alta_cerrada', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, cerrada_en) VALUES (%2$L, %3$L, %4$L, 'x', '2027-03-01 23:00+00', '2027-03-01 23:30+00', 'cancelled', now())$q$),
  ('alta_cerrada_en_bloqueo', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, cerrada_en) VALUES (%2$L, %3$L, %4$L, 'x', '2027-03-01 10:30+00', '2027-03-01 11:00+00', 'cancelled', now())$q$),
  ('alta_reserva_fuera', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_canal, reserva_enlace_id, reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) VALUES (%2$L, %3$L, 'x', '2027-03-01 23:00+00', '2027-03-01 23:30+00', 'fijo', %7$L, 'P', repeat('a', 64), repeat('b', 64), 'v1-f5-casos', now(), 0)$q$),
  ('alta_reserva_en_bloqueo', false, $q$INSERT INTO public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_canal, reserva_enlace_id, reserva_nombre, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) VALUES (%2$L, %3$L, 'x', '2027-03-01 10:30+00', '2027-03-01 11:00+00', 'fijo', %7$L, 'P', repeat('a', 64), repeat('b', 64), 'v1-f5-casos', now(), 0)$q$),
  ('notas', true, $q$UPDATE public.appointments SET notes = 'otra' WHERE id = %1$L$q$),
  ('put_fila_igual', true, $q$UPDATE public.appointments SET title = title, start_time = start_time, end_time = end_time, medico_id = medico_id, consultorio_id = consultorio_id, status = status, all_day = all_day, notes = 'otra', updated_at = now() WHERE id = %1$L$q$),
  ('mueve_fuera', true, $q$UPDATE public.appointments SET start_time = start_time + interval '7 days', end_time = end_time + interval '7 days' WHERE id = %1$L$q$),
  ('mueve_a_bloqueo', true, $q$UPDATE public.appointments SET start_time = '2027-03-01 10:30+00', end_time = '2027-03-01 11:00+00' WHERE id = %1$L$q$),
  ('alarga', true, $q$UPDATE public.appointments SET end_time = end_time + interval '15 minutes' WHERE id = %1$L$q$),
  ('alarga_a_bloqueo', true, $q$UPDATE public.appointments SET start_time = '2027-03-01 08:30+00', end_time = '2027-03-01 09:30+00' WHERE id = %1$L$q$),
  ('todo_el_dia', true, $q$UPDATE public.appointments SET all_day = true, start_time = date_trunc('day', start_time), end_time = date_trunc('day', start_time) + interval '1 day' WHERE id = %1$L$q$),
  ('consultorio', true, $q$UPDATE public.appointments SET consultorio_id = %5$L, consultorio_nombre = 'K2' WHERE id = %1$L$q$),
  ('medico', true, $q$UPDATE public.appointments SET medico_id = %6$L WHERE id = %1$L$q$),
  ('confirmar', true, $q$UPDATE public.appointments SET status = 'confirmed' WHERE id = %1$L$q$),
  ('agendar', true, $q$UPDATE public.appointments SET status = 'scheduled' WHERE id = %1$L$q$),
  ('cancelar', true, $q$UPDATE public.appointments SET status = 'cancelled' WHERE id = %1$L$q$),
  ('atender', true, $q$UPDATE public.appointments SET status = 'attended' WHERE id = %1$L$q$),
  ('cancelar_y_mover', true, $q$UPDATE public.appointments SET status = 'cancelled', start_time = start_time + interval '7 days', end_time = end_time + interval '7 days' WHERE id = %1$L$q$),
  ('cerrar', true, $q$UPDATE public.appointments SET cerrada_en = now() WHERE id = %1$L$q$),
  ('cerrar_con_sustituta', true, $q$UPDATE public.appointments SET cerrada_en = now(), sustituida_por = %8$L WHERE id = %1$L$q$),
  ('sustituta_sola', true, $q$UPDATE public.appointments SET sustituida_por = %8$L WHERE id = %1$L$q$),
  ('reabrir', true, $q$UPDATE public.appointments SET cerrada_en = NULL WHERE id = %1$L$q$),
  ('reserva_nombre', true, $q$UPDATE public.appointments SET reserva_nombre = 'Otra' WHERE id = %1$L$q$),
  ('reserva_tel_vacio', true, $q$UPDATE public.appointments SET reserva_telefono = NULL WHERE id = %1$L$q$),
  ('eco_google', true, $q$UPDATE public.appointments SET gcal_etag = 'e2', gcal_sync_status = 'synced' WHERE id = %1$L$q$),
  ('google_evento', true, $q$UPDATE public.appointments SET google_asignacion = 'evento' WHERE id = %1$L$q$),
  ('ligar_paciente', true, $q$UPDATE public.appointments SET paciente_id = %4$L WHERE id = %1$L$q$),
  ('borrar', true, $q$DELETE FROM public.appointments WHERE id = %1$L$q$);

CREATE TEMP TABLE f5_rol (rol text PRIMARY KEY, pg_rol text);
INSERT INTO f5_rol VALUES ('medico', 'authenticated'), ('secretaria', 'authenticated'), ('otro_medico', 'authenticated'),
  ('service', 'service_role'), ('service_google', 'service_role'), ('service_reagendar', 'service_role'), ('anon', 'anon');

CREATE TEMP TABLE f5_salida (linea text);
DO $casos$
DECLARE
  c record;
  v_sql text;
  v_estado text; v_msg text; v_hint text; v_n bigint;
  v_lineas text[] := '{}';
  v_claims text;
BEGIN
  FOR c IN
    SELECT cl.letra, o.op, o.plantilla, coalesce(f.etiqueta, '-') AS etiqueta, f.id AS cita, r.rol, r.pg_rol,
           cl.clinica, cl.medico, cl.paciente, cl.consultorio2, cl.otro_medico, cl.enlace,
           (SELECT v.id FROM f5_cita v WHERE v.etiqueta = 'viva' AND v.clinica = cl.letra) AS viva,
           cl.secretaria
      FROM (VALUES ('A', 'f5000000-0000-4000-8000-0000000ca001'::uuid, 'f5000000-0000-4000-8000-0000000b0a01'::uuid,
                    'f5000000-0000-4000-8000-0000000e0a01'::uuid, 'f5000000-0000-4000-8000-0000000d0a02'::uuid,
                    'f5000000-0000-4000-8000-0000000b0a03'::uuid, 'f5000000-0000-4000-8000-0000000f0a01'::uuid,
                    'f5000000-0000-4000-8000-0000000b0a02'::uuid),
                   ('B', 'f5000000-0000-4000-8000-0000000cb001', 'f5000000-0000-4000-8000-0000000b0b01',
                    'f5000000-0000-4000-8000-0000000e0b01', 'f5000000-0000-4000-8000-0000000d0b02',
                    'f5000000-0000-4000-8000-0000000b0b01', 'f5000000-0000-4000-8000-0000000f0b01',
                    'f5000000-0000-4000-8000-0000000b0a02')) cl(letra, clinica, medico, paciente, consultorio2, otro_medico, enlace, secretaria)
      CROSS JOIN f5_op o
      LEFT JOIN f5_cita f ON o.sobre_cita AND f.clinica = cl.letra
      CROSS JOIN f5_rol r
     WHERE o.sobre_cita = (f.id IS NOT NULL)
     ORDER BY cl.letra, o.op, f.etiqueta, r.rol
  LOOP
    v_sql := format(c.plantilla, c.cita, c.clinica, c.medico, c.paciente, c.consultorio2, c.otro_medico, c.enlace, c.viva);
    v_claims := CASE c.rol
      WHEN 'medico' THEN json_build_object('sub', c.medico, 'role', 'authenticated')::text
      WHEN 'otro_medico' THEN json_build_object('sub', c.otro_medico, 'role', 'authenticated')::text
      WHEN 'secretaria' THEN json_build_object('sub', c.secretaria, 'role', 'authenticated')::text
      WHEN 'anon' THEN '{"role":"anon"}'
      ELSE '{"role":"service_role"}' END;
    BEGIN
      PERFORM set_config('request.jwt.claims', v_claims, true);
      IF c.rol = 'service_google' THEN PERFORM set_config('spinus.via', 'google', true); END IF;
      IF c.rol = 'service_reagendar' THEN PERFORM set_config('spinus.reagendar_cita', coalesce(c.cita::text, ''), true); END IF;
      PERFORM set_config('role', c.pg_rol, true);
      EXECUTE v_sql;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RAISE EXCEPTION USING ERRCODE = 'F5000', MESSAGE = 'ok', DETAIL = v_n::text;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_hint = PG_EXCEPTION_HINT;
      IF v_estado = 'F5000' THEN
        GET STACKED DIAGNOSTICS v_msg = PG_EXCEPTION_DETAIL;
        v_estado := '00000'; v_msg := 'filas=' || v_msg; v_hint := '';
      END IF;
    END;
    v_lineas := v_lineas || concat_ws('|', c.letra, c.op, c.etiqueta, c.rol, v_estado, v_hint, v_msg);
  END LOOP;
  INSERT INTO f5_salida SELECT unnest(v_lineas);
END
$casos$;

SELECT linea FROM f5_salida ORDER BY linea;
ROLLBACK;
