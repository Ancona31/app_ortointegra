-- F5 · Costo de guardar una cita (disparadores de appointments).
-- Uso (lo llama medir-disparadores.sh):
--   psql -v rol=authenticated|service_role -v op=<op> -v n=2000 -f medir-disparadores.sql
-- op: alta | notas | notas_put | mueve | estado | eco_google | borra_evento
-- Todo ocurre en UNA transacción que termina en ROLLBACK: no queda ninguna fila
-- (tampoco en audit_log: las filas de auditoría nunca llegan a confirmarse).
-- Datos inventados: una clínica, un médico (administrador), un paciente, un
-- consultorio, la v2 encendida y 5 bloqueos lejos de las citas (para que la
-- búsqueda de solape de cita_proteger_bloqueo corra y no encuentre nada).
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
BEGIN;
SET LOCAL lock_timeout = '5s';

INSERT INTO public.clinicas (id, nombre, es_vip_grant) VALUES ('f5000000-0000-4000-8000-00000000c001', 'F5 medición', true);
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('f5000000-0000-4000-8000-00000000b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'f5-medicion@prueba.local', now(), now());
UPDATE public.profiles
   SET clinica_id = 'f5000000-0000-4000-8000-00000000c001', es_admin_de_clinica = true, role = 'medico',
       nombres = 'Médico', apellido_paterno = 'F5', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 WHERE id = 'f5000000-0000-4000-8000-00000000b001';
INSERT INTO public.agenda_ajustes (clinica_id, agenda_v2_encendida) VALUES ('f5000000-0000-4000-8000-00000000c001', true);
INSERT INTO public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) VALUES
  ('f5000000-0000-4000-8000-00000000d001', 'f5000000-0000-4000-8000-00000000c001', 'f5000000-0000-4000-8000-00000000b001',
   'Consultorio F5', 'F5', 'Calle 1', true, 'America/Mexico_City');
INSERT INTO public.pacientes (id, clinica_id, nombre, apellidos) VALUES
  ('f5000000-0000-4000-8000-00000000e001', 'f5000000-0000-4000-8000-00000000c001', 'Paciente', 'F5');
INSERT INTO public.agenda_bloqueos (clinica_id, medico_id, inicio, fin)
SELECT 'f5000000-0000-4000-8000-00000000c001', 'f5000000-0000-4000-8000-00000000b001',
       timestamptz '2030-01-01 09:00+00' + g * interval '1 day', timestamptz '2030-01-01 12:00+00' + g * interval '1 day'
  FROM generate_series(1, 5) g;

-- Citas con paciente (A: el bucle; B: el EXPLAIN) y eventos sin paciente (C y D, para borrar).
INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status,
                                 consultorio_id, consultorio_nombre, consultorio_timezone, notes)
SELECT 'f5000000-0000-4000-8000-00000000c001', 'f5000000-0000-4000-8000-00000000b001',
       CASE WHEN s.lote IN ('A', 'B') THEN 'f5000000-0000-4000-8000-00000000e001'::uuid END,
       'bench-' || s.lote, timestamptz '2027-01-04 15:00+00' + (g * interval '2 hours'),
       timestamptz '2027-01-04 15:30+00' + (g * interval '2 hours'), 'scheduled',
       'f5000000-0000-4000-8000-00000000d001', 'Consultorio F5', 'America/Mexico_City', 'nota'
  FROM (VALUES ('A', 0), ('B', 100000), ('C', 200000), ('D', 300000)) s(lote, base),
       generate_series(s.base + 1, s.base + :n + 300) g;

CREATE TEMP TABLE f5_resultado (op text, rol text, n int, mediana_us numeric, p10_us numeric, p90_us numeric,
                                explain_ms numeric, disparadores jsonb);
GRANT ALL ON f5_resultado TO authenticated, service_role;
SELECT set_config('f5.op', :'op', true), set_config('f5.n', :'n', true);
SELECT set_config('request.jwt.claims',
                  CASE WHEN :'rol' = 'authenticated'
                       THEN '{"sub":"f5000000-0000-4000-8000-00000000b001","role":"authenticated"}'
                       ELSE '{"role":"service_role"}' END, true);
SET LOCAL ROLE :"rol";

DO $medir$
DECLARE
  v_op  text := current_setting('f5.op');
  v_n   int  := current_setting('f5.n')::int;
  c_calentar CONSTANT int := 300;
  v_a   uuid[];
  v_b   uuid[];
  v_c   uuid[];
  v_d   uuid[];
  v_t0  timestamptz;
  v_us  float8[] := '{}';
  v_sql text;
  v_j   json;
  i     int;
BEGIN
  SELECT array_agg(id ORDER BY start_time) FILTER (WHERE title = 'bench-A'),
         array_agg(id ORDER BY start_time) FILTER (WHERE title = 'bench-B'),
         array_agg(id ORDER BY start_time) FILTER (WHERE title = 'bench-C'),
         array_agg(id ORDER BY start_time) FILTER (WHERE title = 'bench-D')
    INTO v_a, v_b, v_c, v_d
    FROM public.appointments WHERE clinica_id = 'f5000000-0000-4000-8000-00000000c001';
  -- El eco de Google como lo escribe la sincronización: service_role con spinus.via = 'google'.
  IF v_op = 'eco_google' AND current_user = 'service_role' THEN
    PERFORM set_config('spinus.via', 'google', true);
  END IF;

  FOR i IN 1 .. v_n + c_calentar LOOP
    v_t0 := clock_timestamp();
    IF v_op = 'alta' THEN
      INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status,
                                       consultorio_id, consultorio_nombre, consultorio_timezone)
      VALUES ('f5000000-0000-4000-8000-00000000c001', 'f5000000-0000-4000-8000-00000000b001',
              'f5000000-0000-4000-8000-00000000e001', 'alta', timestamptz '2028-01-04 15:00+00' + i * interval '1 hour',
              timestamptz '2028-01-04 15:30+00' + i * interval '1 hour', 'scheduled',
              'f5000000-0000-4000-8000-00000000d001', 'Consultorio F5', 'America/Mexico_City');
    ELSIF v_op = 'notas' THEN
      UPDATE public.appointments SET notes = 'n' || i WHERE id = v_a[i];
    ELSIF v_op = 'notas_put' THEN
      -- Lo que manda el formulario: la fila entera, cambiando sólo las notas.
      UPDATE public.appointments a
         SET title = a.title, start_time = a.start_time, end_time = a.end_time, status = a.status, all_day = a.all_day,
             medico_id = a.medico_id, consultorio_id = a.consultorio_id, notes = 'n' || i, updated_at = now()
       WHERE id = v_a[i];
    ELSIF v_op = 'mueve' THEN
      UPDATE public.appointments SET start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
       WHERE id = v_a[i];
    ELSIF v_op = 'estado' THEN
      UPDATE public.appointments SET status = 'confirmed' WHERE id = v_a[i];
    ELSIF v_op = 'eco_google' THEN
      UPDATE public.appointments SET gcal_etag = 'e' || i, gcal_sync_status = 'synced' WHERE id = v_a[i];
    ELSIF v_op = 'borra_evento' THEN
      DELETE FROM public.appointments WHERE id = v_c[i];
    ELSE
      RAISE EXCEPTION 'op desconocida: %', v_op;
    END IF;
    IF i > c_calentar THEN
      v_us := v_us || (extract(epoch FROM clock_timestamp() - v_t0) * 1e6)::float8;
    END IF;
  END LOOP;

  -- Lo mismo sobre n filas en UNA sentencia, para que EXPLAIN dé el tiempo de cada disparador.
  v_sql := CASE v_op
    WHEN 'alta' THEN format($q$INSERT INTO public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status,
                                       consultorio_id, consultorio_nombre, consultorio_timezone)
      SELECT 'f5000000-0000-4000-8000-00000000c001', 'f5000000-0000-4000-8000-00000000b001',
             'f5000000-0000-4000-8000-00000000e001', 'alta2', timestamptz '2029-01-04 15:00+00' + g * interval '1 hour',
             timestamptz '2029-01-04 15:30+00' + g * interval '1 hour', 'scheduled',
             'f5000000-0000-4000-8000-00000000d001', 'Consultorio F5', 'America/Mexico_City'
        FROM generate_series(1, %s) g$q$, v_n)
    WHEN 'notas' THEN format('UPDATE public.appointments SET notes = notes || ''x'' WHERE id = ANY (%L)', v_b[1:v_n])
    WHEN 'notas_put' THEN format('UPDATE public.appointments a SET title = a.title, start_time = a.start_time, end_time = a.end_time, status = a.status, all_day = a.all_day, medico_id = a.medico_id, consultorio_id = a.consultorio_id, notes = a.notes || ''x'', updated_at = now() WHERE id = ANY (%L)', v_b[1:v_n])
    WHEN 'mueve' THEN format('UPDATE public.appointments SET start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' WHERE id = ANY (%L)', v_b[1:v_n])
    WHEN 'estado' THEN format('UPDATE public.appointments SET status = ''confirmed'' WHERE id = ANY (%L)', v_b[1:v_n])
    WHEN 'eco_google' THEN format('UPDATE public.appointments SET gcal_etag = ''f'' || id, gcal_sync_status = ''synced'' WHERE id = ANY (%L)', v_b[1:v_n])
    WHEN 'borra_evento' THEN format('DELETE FROM public.appointments WHERE id = ANY (%L)', v_d[1:v_n])
  END;
  EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || v_sql INTO v_j;

  INSERT INTO f5_resultado
  SELECT v_op, current_user, v_n,
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY x)::numeric, 1),
         round(percentile_cont(0.1) WITHIN GROUP (ORDER BY x)::numeric, 1),
         round(percentile_cont(0.9) WITHIN GROUP (ORDER BY x)::numeric, 1),
         round((v_j -> 0 ->> 'Execution Time')::numeric, 1),
         coalesce((SELECT jsonb_object_agg(t ->> 'Trigger Name',
                                           jsonb_build_object('llamadas', (t ->> 'Calls')::int,
                                                              'us_por_llamada', round((t ->> 'Time')::numeric * 1000 / greatest((t ->> 'Calls')::int, 1), 2)))
                     FROM json_array_elements(v_j -> 0 -> 'Triggers') t), '{}')
    FROM unnest(v_us) x;
END
$medir$;

SELECT row_to_json(r) FROM f5_resultado r;
ROLLBACK;
