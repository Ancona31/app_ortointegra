-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F2 — Google: sincronización, espejo, empalmes, RSVP,
-- «por asignar», movimientos rechazados y bloqueos movidos en Google
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE
--   Tablas nuevas (sólo service_role, RLS activa):
--     gcal_sync_estado            token, página pendiente y candado por clínica
--     reserva_empalmes_google     pares (reserva por enlace, cita que se le empalma)
--     gcal_movimientos_rechazados intentos de mover desde Google una cita con candado
--   Columna en appointments (main): google_asignacion + su CHECK, la función
--   cita_asignacion_google() y su disparador BEFORE.
--   Funciones (todas SECURITY INVOKER, search_path vacío, sólo service_role
--   salvo la de disparador):
--     gcal_sync_tomar / _avanzar / _reiniciar / _soltar / _clinicas_pendientes
--     gcal_sync_clinica_habilitada (puerta S3) · gcal_sync_frescura
--     gcal_citas_por_evento · gcal_aplicar_evento · gcal_importar_evento
--     reserva_empalmes_registrar · cita_rsvp_google
--     cita_movimiento_google_registrar · gcal_bloqueo_aplicar
--
-- DEPENDE DE (orden de aplicación: 4.º de 6, F1 → F5a → F3 → F2 → F4 → F5b)
--   PostgreSQL: no concede MAINTAIN, así que no exige la 17 (producción es
--   17.6). A service_role le deja el MAINTAIN de fábrica de la 17 sobre
--   gcal_sync_estado; la fila 2 de la rejilla lo ignora.
--   F1 (20261201120000): agenda_ajustes.agenda_v2_encendida y la función
--     public.agenda_v2_encendida(uuid). gcal_sync_clinicas_pendientes es SQL y
--     nombra agenda_ajustes al crearse.
--   F5a (20261201130000): agenda_bloqueos. gcal_bloqueo_aplicar declara
--     agenda_bloqueos%ROWTYPE, que PL/pgSQL resuelve AL CREAR la función.
--   F3 (20261201140000): appointments.reserva_canal. cita_asignacion_google()
--     (disparador BEFORE de appointments) lee NEW.reserva_canal: sin la
--     columna, TODA alta de cita que no haga postgres fallaría. Por eso F3 va
--     antes que este archivo, y el pre-vuelo lo exige.
--   main: clinicas, appointments (con google_event_id, gcal_etag,
--     gcal_calendar_id, gcal_sync_status, origen, all_day, consultorio_timezone
--     y el índice único parcial (clinica_id, google_event_id)), pacientes,
--     profiles, audit_log, clinica_conexiones_google, get_clinica_id(),
--     clinica_no_suspendida() y clinica_tiene_acceso() (la puerta S3 lee su
--     cuerpo; NO se modifican), y los privilegios de service_role sobre ellas.
--     El pre-vuelo comprueba cada cosa y dice cuál falta.
--   Lo que necesitan de éste los demás bloques: F3 (anterior) llama a la
--   puerta S3 sólo desde plpgsql, al ejecutarse: hasta este COMMIT la reserva
--   por enlace no funciona (no hay enlaces todavía). F4 (posterior) la nombra
--   en una función SQL, cuelga disparadores de reserva_empalmes_google y de
--   gcal_movimientos_rechazados y lee google_asignacion en un WHEN.
--
-- search_path: el resultado y las comprobaciones no dependen de él (todo va
--   calificado; la definición del disparador, que el catálogo imprime con o
--   sin public. según el search_path, se compara sin ese prefijo). Probado con
--   '', 'public' y el del rol postgres ("$user", public, extensions).
--
-- LA PUERTA S3 CON LOS CUERPOS DE PRODUCCIÓN: allí clinica_no_suspendida() y
--   clinica_tiene_acceso() tienen fines de línea CRLF (md5 crudos bff6c203… y
--   038f41ee…; sin los \r, a2dcfa8f… y 2efd7734…). La puerta tolera los \r
--   (son espacio para SQL) y abre: comprobado en el clon de la foto con una
--   clínica VIP, una sin estrenar y una de pago (true) y una degradada y una
--   suspendida (false). La fila 8 de la rejilla compara el md5 sin los \r.
--
-- BLOQUEOS (lock_timeout 5 s, statement_timeout 60 s). UNA transacción; cada
--   candado dura hasta el COMMIT:
--   · appointments: ACCESS EXCLUSIVE desde el ADD COLUMN google_asignacion
--     (sin DEFAULT: no reescribe); la CHECK la recorre una vez. No se baja con
--     NOT VALID + VALIDATE: el ACCESS EXCLUSIVE ya dura hasta el COMMIT.
--   · clinicas: SHARE ROW EXCLUSIVE desde el primer CREATE TABLE (FK): no se
--     escriben clínicas mientras dura.
--   Medido en el clon de la foto: 52 ms en total con appointments vacía; con
--   50 000 citas sintéticas, 161 ms en total y ~143 ms con ACCESS EXCLUSIVE
--   sobre appointments (de ellos ~120 ms el COMMIT).
--   Riesgo real: si una consulta larga tiene appointments, el ALTER espera
--   hasta 5 s y las consultas nuevas a appointments esperan detrás; a los 5 s
--   todo aborta sin dejar nada. Aplicar con poco tráfico.
--
-- RIESGO: MEDIO por el disparador nuevo en appointments (corre en cada INSERT
--   y en cada UPDATE OF google_asignacion). Lo demás nace vacío y detrás del
--   interruptor (apagado de fábrica). Si falla en cualquier punto, la
--   transacción se deshace entera.
--
-- SEGUNDA PASADA: RE-EJECUTABLE. Sobre una base que ya lo tiene (también con
--   F4 y F5b puestos) no cambia nada (IF NOT EXISTS, CREATE OR REPLACE, DROP
--   POLICY IF EXISTS) y la rejilla sale igual; comprobado en el clon de la
--   foto. Si algo de este bloque existe con OTRA forma, el pre-vuelo aborta
--   sin tocar.
--
-- CÓMO SE DESHACE: supabase/reversas/20261201150000_agenda_f2_google_reversa.sql
--   (después de deshacer F5b y F4; F3 se deshace DESPUÉS de éste). Se niega si
--   hay estado de sincronización, empalmes, movimientos rechazados o citas con
--   google_asignacion, salvo confirmación explícita (ver su cabecera).
--
-- QUIÉN PONE spinus.via (contrato con log_cita_change de F1, lista c_vias):
--   'google'      gcal_aplicar_evento y gcal_importar_evento, antes de escribir appointments;
--   'google_rsvp' cita_rsvp_google, antes de confirmar.
--   gcal_bloqueo_aplicar no lo pone: escribe agenda_bloqueos, no appointments.
--   Lo leen log_cita_change (F1), cita_proteger_bloqueo (F5b) y
--   cita_asignacion_google (aquí), siempre junto con current_user = 'service_role'.
--
-- A GOOGLE NO VIAJA NADA DE AQUÍ: estas funciones sólo leen de Google y
--   escriben en Spinus. gcal_citas_por_evento devuelve al código el nombre del
--   paciente para el título que Spinus ya manda; nunca las notas de una cita
--   con paciente.
--
-- EJECUTAR DE UNA SOLA VEZ, COMPLETO. El veredicto es el SELECT final.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_fn  regprocedure;
  v_src text;
  v_cols text[];
  v_n   bigint;
  -- Las 15 funciones del bloque. Cualquier otra de public con su nombre (u
  -- otra gcal_*) aborta: la rejilla, la reversa y el post-vuelo las cuentan
  -- por nombre.
  c_mias CONSTANT text[] := ARRAY[
    'public.gcal_sync_tomar(uuid, uuid, text, integer, integer)',
    'public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)',
    'public.gcal_sync_reiniciar(uuid, uuid)',
    'public.gcal_sync_soltar(uuid, uuid, text)',
    'public.gcal_sync_clinicas_pendientes(integer)',
    'public.gcal_sync_clinica_habilitada(uuid)',
    'public.gcal_sync_frescura(uuid)',
    'public.gcal_citas_por_evento(uuid, text[], uuid[])',
    'public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)',
    'public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)',
    'public.reserva_empalmes_registrar(uuid, uuid[])',
    'public.cita_rsvp_google(uuid, uuid, text, text, text[])',
    'public.cita_asignacion_google()',
    'public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)',
    'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)'];
BEGIN
  -- Las RPC son INVOKER y las llama service_role: sin BYPASSRLS no verían filas.
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS.';
  END IF;

  -- main
  IF to_regclass('public.clinicas') IS NULL OR to_regclass('public.appointments') IS NULL
     OR to_regclass('public.pacientes') IS NULL OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.audit_log') IS NULL OR to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta una tabla de main (clinicas, appointments, pacientes, profiles, audit_log, clinica_conexiones_google).';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE')
     OR NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.clinicas'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de appointments o de clinicas.', current_user;
  END IF;
  SELECT array_agg(c) INTO v_cols FROM (VALUES ('id', 'uuid'), ('clinica_id', 'uuid'), ('user_id', 'uuid'), ('rol', 'text'),
      ('estado', 'text'), ('calendar_id', 'text'), ('google_account_email', 'text')) v(c, t)
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.clinica_conexiones_google'::regclass
                      AND attname = v.c AND atttypid = v.t::regtype AND NOT attisdropped);
  IF v_cols IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a clinica_conexiones_google le faltan (o tienen otro tipo) las columnas %.', v_cols;
  END IF;
  SELECT array_agg(c) INTO v_cols FROM (VALUES ('id', 'uuid'), ('clinica_id', 'uuid'),
      ('google_event_id', 'text'), ('gcal_etag', 'text'), ('gcal_calendar_id', 'text'), ('gcal_sync_status', 'text'),
      ('origen', 'text'), ('all_day', 'boolean'), ('consultorio_timezone', 'text'), ('updated_at', 'timestamptz'),
      ('status', 'text'), ('title', 'text'), ('notes', 'text'), ('medico_id', 'uuid'), ('paciente_id', 'uuid'),
      ('created_by', 'uuid'), ('start_time', 'timestamptz'), ('end_time', 'timestamptz')) v(c, t)
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                      AND attname = v.c AND atttypid = v.t::regtype AND NOT attisdropped);
  IF v_cols IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a appointments le faltan (o tienen otro tipo) las columnas de main %.', v_cols;
  END IF;
  -- gcal_importar_evento hace ON CONFLICT (clinica_id, google_event_id) WHERE google_event_id IS NOT NULL.
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = 'public.appointments'::regclass AND i.indisunique
                   AND pg_get_indexdef(i.indexrelid) LIKE '%(clinica_id, google_event_id) WHERE (google_event_id IS NOT NULL)') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el índice único parcial (clinica_id, google_event_id) de appointments.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.pacientes'::regclass AND attnum > 0 AND NOT attisdropped
        AND attname IN ('id', 'clinica_id', 'nombre', 'apellidos', 'email')) <> 5
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
        AND attname IN ('id', 'clinica_id')) <> 2
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.audit_log'::regclass AND attnum > 0 AND NOT attisdropped
        AND attname IN ('user_id', 'accion', 'tabla', 'registro_id', 'descripcion')) <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: pacientes, profiles o audit_log no tienen las columnas esperadas.';
  END IF;
  -- Lo que leen y escriben las funciones de este bloque (INVOKER, las llama
  -- service_role) en tablas que no crea: sale de sus cuerpos. La puerta S3
  -- ejecuta el cuerpo de las dos de main, que leen clinicas. Si se añade una
  -- tabla a una función, se añade aquí.
  SELECT array_agg(v.t || ' ' || v.p) INTO v_cols FROM (VALUES
      ('public.clinica_conexiones_google', 'SELECT'), ('public.clinicas', 'SELECT'), ('public.pacientes', 'SELECT'),
      ('public.profiles', 'SELECT'), ('public.appointments', 'SELECT'), ('public.appointments', 'INSERT'),
      ('public.appointments', 'UPDATE'), ('public.audit_log', 'INSERT'), ('public.agenda_ajustes', 'SELECT'),
      ('public.agenda_bloqueos', 'SELECT'), ('public.agenda_bloqueos', 'UPDATE'), ('public.agenda_bloqueos', 'DELETE')) v(t, p)
   WHERE to_regclass(v.t) IS NOT NULL AND NOT has_table_privilege('service_role', v.t, v.p);
  IF v_cols IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a service_role le faltan privilegios que estas RPC necesitan: %.', v_cols;
  END IF;

  -- Las dos puertas de main que evalúa gcal_sync_clinica_habilitada: tienen que
  -- existir, ser SQL, DEFINER, devolver boolean y leer la clínica con
  -- public.get_clinica_id(). El paso 5 comprueba además que la puerta sabe
  -- evaluarlas en esta base.
  IF to_regprocedure('public.get_clinica_id()') IS NULL
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.get_clinica_id() o no es SECURITY DEFINER.';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY[to_regprocedure('public.clinica_no_suspendida()'), to_regprocedure('public.clinica_tiene_acceso()')] LOOP
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta clinica_no_suspendida() o clinica_tiene_acceso().';
    END IF;
    SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
     WHERE p.oid = v_fn AND l.lanname = 'sql' AND p.prosecdef AND p.prorettype = 'boolean'::regtype AND NOT p.proretset;
    IF v_src IS NULL OR strpos(v_src, 'public.get_clinica_id()') = 0 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % ya no es SQL DEFINER boolean con public.get_clinica_id(); la puerta S3 no sabría evaluarla.', v_fn;
    END IF;
  END LOOP;

  -- F1
  IF to_regclass('public.agenda_ajustes') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                     AND attname = 'agenda_v2_encendida' AND atttypid = 'boolean'::regtype AND NOT attisdropped)
     OR NOT has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes.agenda_v2_encendida (F1) o service_role no la lee.';
  END IF;
  IF to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL
     OR (SELECT prosecdef OR prorettype <> 'boolean'::regtype FROM pg_proc WHERE oid = to_regprocedure('public.agenda_v2_encendida(uuid)'))
     OR NOT has_function_privilege('service_role', 'public.agenda_v2_encendida(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_v2_encendida(uuid) de F1, no es INVOKER boolean o service_role no la ejecuta.';
  END IF;

  -- F3: cita_asignacion_google() lee NEW.reserva_canal (ver la cabecera).
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'reserva_canal' AND atttypid = 'text'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta appointments.reserva_canal (F3, 20261201140000): sin ella el disparador de «por asignar» rompería toda alta de cita.';
  END IF;

  -- F5a
  IF to_regclass('public.agenda_bloqueos') IS NULL
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_bloqueos'::regclass AND attnum > 0 AND NOT attisdropped
           AND attname IN ('id', 'clinica_id', 'medico_id', 'inicio', 'fin', 'todo_el_dia', 'zona',
                           'google_event_id', 'gcal_calendar_id', 'gcal_etag', 'updated_at')) <> 11
     OR NOT has_table_privilege('service_role', 'public.agenda_bloqueos', 'SELECT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_bloqueos (F5a) con sus columnas, o service_role no la lee, cambia y borra.';
  END IF;

  -- Re-ejecución: lo de este bloque, si ya existe, tiene esta forma.
  IF to_regclass('public.gcal_sync_estado') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.gcal_sync_estado'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> ARRAY['id', 'clinica_id', 'conexion_id', 'calendar_id', 'fase', 'sync_token', 'page_token',
              'ventana_desde', 'candado', 'candado_hasta', 'ultima_ok', 'ultimo_intento', 'ultimo_error',
              'errores_seguidos', 'completas', 'created_at', 'updated_at']
            AND cardinality(v_cols) = 17) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_sync_estado ya existe con otras columnas (%).', v_cols;
    END IF;
  END IF;
  IF to_regclass('public.reserva_empalmes_google') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.reserva_empalmes_google'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> ARRAY['id', 'clinica_id', 'cita_reserva_id', 'cita_otra_id', 'detectado_en'] AND cardinality(v_cols) = 5) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_empalmes_google ya existe con otras columnas (%).', v_cols;
    END IF;
  END IF;
  IF to_regclass('public.gcal_movimientos_rechazados') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.gcal_movimientos_rechazados'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> ARRAY['id', 'clinica_id', 'cita_id', 'google_updated', 'detectado_en'] AND cardinality(v_cols) = 5) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_movimientos_rechazados ya existe con otras columnas (%).', v_cols;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN (to_regclass('public.gcal_sync_estado'), to_regclass('public.reserva_empalmes_google'),
                                                       to_regclass('public.gcal_movimientos_rechazados'))
               AND NOT pg_has_role(current_user, c.relowner, 'USAGE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una tabla de este bloque existe y no es de %.', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attname = 'google_asignacion'
              AND NOT attisdropped AND atttypid <> 'text'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.google_asignacion existe con otro tipo.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
              AND conname = 'appointments_google_asignacion_check'
              AND pg_get_constraintdef(oid) <> 'CHECK (((google_asignacion IS NULL) OR ((origen = ''google''::text) AND (google_asignacion = ANY (ARRAY[''por_asignar''::text, ''evento''::text])))))') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_google_asignacion_check existe con otra fórmula.';
  END IF;
  -- La columna sin su CHECK (a medias): el ADD CONSTRAINT de la sección 3
  -- validaría las filas que ya hay; si alguna no cumple, se dice aquí cuántas.
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
              AND attname = 'google_asignacion' AND NOT attisdropped)
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                      AND conname = 'appointments_google_asignacion_check') THEN
    EXECUTE 'SELECT count(*) FROM public.appointments
              WHERE NOT (google_asignacion IS NULL
                         OR (origen = ''google'' AND google_asignacion IN (''por_asignar'', ''evento'')))' INTO v_n;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.google_asignacion existe sin su CHECK y % fila(s) no la cumplen; revisar a mano.', v_n;
    END IF;
  END IF;
  -- CREATE OR REPLACE no convierte una DEFINER en INVOKER: si existe, que no lo sea.
  FOREACH v_src IN ARRAY c_mias LOOP
    v_fn := to_regprocedure(v_src);
    IF v_fn IS NOT NULL AND (SELECT prosecdef OR NOT pg_has_role(current_user, proowner, 'USAGE') FROM pg_proc WHERE oid = v_fn) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % existe como SECURITY DEFINER o no es de %.', v_src, current_user;
    END IF;
  END LOOP;
  SELECT array_agg(p.oid::regprocedure::text) INTO v_cols FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE 'gcal\_%' OR p.proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google',
                                                    'cita_asignacion_google', 'cita_movimiento_google_registrar'))
     AND p.oid <> ALL (SELECT to_regprocedure(f) FROM unnest(c_mias) f WHERE to_regprocedure(f) IS NOT NULL);
  IF v_cols IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay funciones con nombre de este bloque que no son suyas: %.', v_cols;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Tablas: estructura, RLS, permisos y comentarios.
-- ---------------------------------------------------------------------

-- Una fila por clínica: el nextSyncToken, la página pendiente de una pasada a
-- medias, la ventana de la sincronización completa y el candado. Tabla propia y
-- no columnas en clinica_conexiones_google: esa tabla la escribe sólo
-- src/lib/gcalConexion.ts y su SELECT está abierto a toda la clínica.
-- SIN FK a la conexión, a propósito: borrar la conexión no debe fallar por
-- esto; gcal_sync_tomar reinicia la fila si la conexión ya no es la vigente.
-- Candado = lease con testigo (uuid + caducidad), no advisory lock: PostgREST
-- no conserva la sesión entre llamadas. Sin auditoría: se escribe en cada
-- sondeo y no es dato sensible.
CREATE TABLE IF NOT EXISTS public.gcal_sync_estado (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  conexion_id      uuid        NOT NULL,
  calendar_id      text        NOT NULL,
  fase             text        NOT NULL DEFAULT 'completa',
  sync_token       text,
  page_token       text,
  ventana_desde    timestamptz,
  candado          uuid,
  candado_hasta    timestamptz,
  ultima_ok        timestamptz,
  ultimo_intento   timestamptz,
  ultimo_error     text,
  errores_seguidos integer     NOT NULL DEFAULT 0,
  completas        integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gcal_sync_estado_pkey PRIMARY KEY (id),
  CONSTRAINT gcal_sync_estado_clinica_key UNIQUE (clinica_id),
  CONSTRAINT gcal_sync_estado_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT gcal_sync_estado_fase_check CHECK (fase IN ('completa', 'incremental')),
  CONSTRAINT gcal_sync_estado_incremental_con_token CHECK (fase = 'completa' OR sync_token IS NOT NULL),
  CONSTRAINT gcal_sync_estado_candado_par CHECK ((candado IS NULL) = (candado_hasta IS NULL)),
  CONSTRAINT gcal_sync_estado_error_corto CHECK (ultimo_error IS NULL OR length(ultimo_error) <= 300),
  CONSTRAINT gcal_sync_estado_contadores CHECK (errores_seguidos >= 0 AND completas >= 0)
);

ALTER TABLE public.gcal_sync_estado ENABLE ROW LEVEL SECURITY;
-- Sin policies: ninguna sesión la lee. Los privilegios de fábrica de Supabase
-- dan ALL a anon, authenticated y service_role: se quitan (TRUNCATE incluido).
-- A service_role se le quitan uno a uno para que conserve lo que
-- no se nombra (MAINTAIN, en PostgreSQL ≥ 17).
REVOKE ALL ON TABLE public.gcal_sync_estado FROM anon, authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.gcal_sync_estado FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gcal_sync_estado TO service_role;

COMMENT ON TABLE public.gcal_sync_estado IS
  'Estado de la sincronización incremental con Google por clínica. Sólo service_role, sólo vía gcal_sync_*. Sin FK a la conexión: si (conexion_id, calendar_id) no es la vigente, gcal_sync_tomar reinicia el token. ultimo_error lo compone el código, nunca texto de Google.';
COMMENT ON COLUMN public.gcal_sync_estado.ventana_desde IS
  'timeMin de la sincronización COMPLETA en curso o de la última; se repite idéntico en cada página. Las incrementales no lo mandan (Google lo prohíbe con syncToken) y el código lo usa para no importar eventos que terminan antes.';

-- Para no repetir el aviso de empalme en cada resincronización hay que recordar
-- qué pares ya se avisaron: UNIQUE (reserva, cita empalmada).
-- Sin FK a appointments, a propósito: el par es un aviso, no debe impedir nada
-- sobre la cita; el lector cruza con appointments.
CREATE TABLE IF NOT EXISTS public.reserva_empalmes_google (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  cita_reserva_id  uuid        NOT NULL,
  cita_otra_id     uuid        NOT NULL,
  detectado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_empalmes_google_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_empalmes_google_par_key UNIQUE (cita_reserva_id, cita_otra_id),
  CONSTRAINT reserva_empalmes_google_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_empalmes_google_distintas CHECK (cita_reserva_id <> cita_otra_id)
);

CREATE INDEX IF NOT EXISTS reserva_empalmes_google_clinica_idx
  ON public.reserva_empalmes_google (clinica_id, detectado_en DESC);

ALTER TABLE public.reserva_empalmes_google ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reserva_empalmes_google FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.reserva_empalmes_google TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reserva_empalmes_google TO service_role;

-- La policy consulta appointments, no esta tabla: no hay recursión de RLS.
DROP POLICY IF EXISTS reserva_empalmes_google_select ON public.reserva_empalmes_google;
CREATE POLICY reserva_empalmes_google_select ON public.reserva_empalmes_google FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = reserva_empalmes_google.cita_reserva_id AND a.clinica_id = public.get_clinica_id()));

COMMENT ON TABLE public.reserva_empalmes_google IS
  'Pares (cita reservada por enlace, cita que se le empalma) detectados por la sincronización con Google al importar o mover una cita. UNIQUE por par: una resincronización no repite el aviso. Sólo lo escribe reserva_empalmes_registrar (service_role), que audita cada par nuevo. Sin FK a appointments a propósito; el lector cruza con appointments. cita_otra_id puede ser también una reserva por enlace: entre dos reservas activas, cita_reserva_id es la de id menor; si sólo una está activa (scheduled/confirmed y sin terminar), es ésa.';

-- Un renglón por INTENTO rechazado (cita, updated del evento): dos sondeos del
-- mismo cambio son uno, y el aviso (disparador de F4) no se repite.
CREATE TABLE IF NOT EXISTS public.gcal_movimientos_rechazados (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  cita_id         uuid        NOT NULL,
  google_updated  timestamptz NOT NULL,
  detectado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gcal_movimientos_rechazados_pkey PRIMARY KEY (id),
  CONSTRAINT gcal_movimientos_rechazados_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT gcal_movimientos_rechazados_intento_key UNIQUE (cita_id, google_updated)
);
-- La FK RESTRICT a clinicas (borrar una clínica busca aquí).
CREATE INDEX IF NOT EXISTS gcal_movimientos_rechazados_clinica_idx ON public.gcal_movimientos_rechazados (clinica_id);

ALTER TABLE public.gcal_movimientos_rechazados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gcal_movimientos_rechazados FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.gcal_movimientos_rechazados TO service_role;

COMMENT ON TABLE public.gcal_movimientos_rechazados IS
  'Un renglón por INTENTO de mover desde Google una cita reservada por enlace que la base rechazó (cita_proteger_eleccion). Intento = (cita, updated del evento de Google): dos sondeos del mismo cambio son uno. Sólo lo escribe cita_movimiento_google_registrar (service_role); su disparador deja el aviso google_movimiento_rechazado en avisos_clinica. Nada clínico. Sin FK a appointments a propósito (como reserva_empalmes_google).';

-- ---------------------------------------------------------------------
-- 3 · «Por asignar»: la columna de appointments, su CHECK y su disparador.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_asignacion text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_google_asignacion_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_google_asignacion_check
      CHECK (google_asignacion IS NULL OR (origen = 'google' AND google_asignacion IN ('por_asignar', 'evento')));
  END IF;
END $$;

COMMENT ON COLUMN public.appointments.google_asignacion IS
  'Qué es un evento NUEVO de Google. NULL = lo de siempre; por_asignar = importado por el sondeo con la v2, se trata como cita por ligar (marca «Por asignar», «Próximas citas», se liga al iniciar la consulta); evento = alguien pulsó «¿No es una cita?» (evento sin paciente; el sondeo no lo devuelve). Lo pone la BASE al importar (cita_asignacion_google); el único cambio permitido es por_asignar → evento. No viaja a Google (S1). Sin reserva_canal: el título sigue viniendo de Google hasta ligarla (C-d).';

-- 'por_asignar' sólo con service_role + spinus.via = 'google' (lo pone
-- gcal_importar_evento). Es el ÚNICO BEFORE de appointments que escribe en NEW
-- y corre el primero por orden alfabético (trg_appointments_asignacion_google):
-- los demás BEFORE ven ya la marca. No le cambies el nombre al disparador.
-- INVOKER a propósito: decide por current_user.
CREATE OR REPLACE FUNCTION public.cita_asignacion_google()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.google_asignacion := CASE
      WHEN current_user = 'service_role' AND current_setting('spinus.via', true) = 'google' AND NEW.origen = 'google'
           AND NEW.paciente_id IS NULL AND NEW.reserva_canal IS NULL
           AND NEW.all_day IS NOT TRUE AND NEW.end_time > now()
      THEN 'por_asignar' END;
    RETURN NEW;
  END IF;
  IF NEW.google_asignacion IS DISTINCT FROM OLD.google_asignacion
     -- IS NOT DISTINCT FROM y no `=`: con OLD NULL, `=` daría NULL y el NOT dejaría pasar el cambio.
     AND NOT (OLD.google_asignacion IS NOT DISTINCT FROM 'por_asignar' AND NEW.google_asignacion IS NOT DISTINCT FROM 'evento'
              AND OLD.paciente_id IS NULL AND NEW.paciente_id IS NULL) THEN
    RAISE EXCEPTION 'google_asignacion sólo pasa de por_asignar a evento'
      USING ERRCODE = '42501', HINT = '«¿No es una cita?» es definitivo; para volver, «Convertir en cita»';
  END IF;
  RETURN NEW;
END
$fn$;

-- Función de disparador: la ejecuta quien escribe la cita (las tres).
REVOKE EXECUTE ON FUNCTION public.cita_asignacion_google() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_asignacion_google() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_asignacion_google() IS
  'Pone appointments.google_asignacion al INSERTAR (por_asignar sólo si la importa el sondeo de Google —service_role con spinus.via = google—, origen google, sin paciente ni reserva, con hora y sin terminar; si no, NULL) y en un UPDATE sólo deja pasar por_asignar → evento de una fila sin paciente (42501 lo demás). Sólo lee NEW/OLD, now() y el GUC; nunca tablas. postgres y supabase_admin quedan fuera.';

CREATE OR REPLACE TRIGGER trg_appointments_asignacion_google
  BEFORE INSERT OR UPDATE OF google_asignacion ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_asignacion_google();

-- ---------------------------------------------------------------------
-- 4 · Funciones. Todas INVOKER (las llama service_role, con BYPASSRLS), con
--     search_path vacío y p_clinica_id filtrado en cada sentencia. Ninguna
--     escribe agenda_ajustes. El interruptor se lee con agenda_v2_encendida().
-- ---------------------------------------------------------------------

-- 4.1 · El candado de sincronización (gcal_sync_estado).

-- Toma el candado de ESTA clínica si su interruptor está encendido, si la
-- conexión es la activa de esa clínica con ese calendario, si nadie lo tiene,
-- si no se sondeó hace poco (salvo página pendiente) y si no está en espera
-- por errores seguidos (30 s · 2^n, tope 1 h). Cero filas = no toca.
CREATE OR REPLACE FUNCTION public.gcal_sync_tomar(
  p_clinica_id uuid, p_conexion_id uuid, p_calendar_id text,
  p_lease_seg integer, p_min_intervalo_seg integer)
RETURNS TABLE (r_candado uuid, r_fase text, r_sync_token text, r_page_token text, r_ventana_desde timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_conexion_id IS NULL OR p_calendar_id IS NULL
     OR p_lease_seg IS NULL OR p_lease_seg NOT BETWEEN 10 AND 900
     OR p_min_intervalo_seg IS NULL OR p_min_intervalo_seg NOT BETWEEN 0 AND 86400 THEN
    RAISE EXCEPTION 'gcal_sync_tomar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- Detrás del interruptor de la clínica. agenda_ajustes sólo se LEE.
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN;
  END IF;
  -- LA conexión de esta clínica, activa, con ESE calendario.
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.id = p_conexion_id AND g.clinica_id = p_clinica_id
                    AND g.rol = 'clinica' AND g.estado = 'activa' AND g.calendar_id = p_calendar_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.gcal_sync_estado (clinica_id, conexion_id, calendar_id)
  VALUES (p_clinica_id, p_conexion_id, p_calendar_id)
  ON CONFLICT ON CONSTRAINT gcal_sync_estado_clinica_key DO NOTHING;

  -- Otra conexión u otro calendario: su token no vale aquí. Sólo sin candado vivo.
  UPDATE public.gcal_sync_estado e
     SET conexion_id = p_conexion_id, calendar_id = p_calendar_id, fase = 'completa',
         sync_token = NULL, page_token = NULL, ventana_desde = NULL, updated_at = now()
   WHERE e.clinica_id = p_clinica_id
     AND (e.conexion_id, e.calendar_id) IS DISTINCT FROM (p_conexion_id, p_calendar_id)
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now());

  RETURN QUERY
  UPDATE public.gcal_sync_estado e
     SET candado = gen_random_uuid(),
         candado_hasta = now() + make_interval(secs => p_lease_seg),
         ultimo_intento = now(),
         updated_at = now()
   WHERE e.clinica_id = p_clinica_id
     AND e.conexion_id = p_conexion_id
     AND e.calendar_id = p_calendar_id
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now())
     AND (e.page_token IS NOT NULL OR e.ultima_ok IS NULL
          OR e.ultima_ok <= now() - make_interval(secs => p_min_intervalo_seg))
     AND (e.errores_seguidos = 0 OR e.ultimo_intento IS NULL
          OR e.ultimo_intento < now() - make_interval(secs => least(3600, 30 * (2 ^ least(e.errores_seguidos, 7)))::integer))
  RETURNING e.candado, e.fase, e.sync_token, e.page_token, e.ventana_desde;
END
$fn$;

-- Una página aplicada: o hay página siguiente (se guarda y se alarga el
-- candado) o hay token final (pasa a incremental, se suelta el candado).
CREATE OR REPLACE FUNCTION public.gcal_sync_avanzar(
  p_clinica_id uuid, p_candado uuid, p_page_token text, p_sync_token text,
  p_ventana_desde timestamptz, p_lease_seg integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL OR p_lease_seg IS NULL OR p_lease_seg NOT BETWEEN 10 AND 900 THEN
    RAISE EXCEPTION 'gcal_sync_avanzar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF (p_page_token IS NULL) = (p_sync_token IS NULL) THEN
    RAISE EXCEPTION 'gcal_sync_avanzar: o página siguiente o token final, exactamente uno' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET page_token       = p_page_token,
         ventana_desde    = CASE WHEN e.fase = 'completa' THEN coalesce(e.ventana_desde, p_ventana_desde)
                                 ELSE e.ventana_desde END,
         sync_token       = coalesce(p_sync_token, e.sync_token),
         fase             = CASE WHEN p_sync_token IS NOT NULL THEN 'incremental' ELSE e.fase END,
         ultima_ok        = CASE WHEN p_sync_token IS NOT NULL THEN now() ELSE e.ultima_ok END,
         errores_seguidos = CASE WHEN p_sync_token IS NOT NULL THEN 0 ELSE e.errores_seguidos END,
         ultimo_error     = CASE WHEN p_sync_token IS NOT NULL THEN NULL ELSE e.ultimo_error END,
         candado          = CASE WHEN p_sync_token IS NOT NULL THEN NULL ELSE e.candado END,
         candado_hasta    = CASE WHEN p_sync_token IS NOT NULL THEN NULL
                                 ELSE now() + make_interval(secs => p_lease_seg) END,
         updated_at       = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado AND e.candado_hasta > now();
  RETURN FOUND;
END
$fn$;

-- 410 de Google: el token murió. Se vuelve a completa SIN soltar el candado.
CREATE OR REPLACE FUNCTION public.gcal_sync_reiniciar(p_clinica_id uuid, p_candado uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_reiniciar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET fase = 'completa', sync_token = NULL, page_token = NULL, ventana_desde = NULL,
         completas = e.completas + 1, updated_at = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado AND e.candado_hasta > now();
  RETURN FOUND;
END
$fn$;

-- Suelta el candado: por error (p_error = código corto) o por presupuesto
-- agotado a mitad (p_error NULL; la página pendiente se conserva).
CREATE OR REPLACE FUNCTION public.gcal_sync_soltar(p_clinica_id uuid, p_candado uuid, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_soltar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET candado = NULL, candado_hasta = NULL,
         ultimo_error     = CASE WHEN p_error IS NULL THEN e.ultimo_error ELSE left(p_error, 300) END,
         errores_seguidos = CASE WHEN p_error IS NULL THEN e.errores_seguidos ELSE e.errores_seguidos + 1 END,
         updated_at = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado;
  RETURN FOUND;
END
$fn$;

-- ⚠️ LA ÚNICA LECTURA ENTRE CLÍNICAS DEL BLOQUE, y es a propósito: el cron
-- tiene que saber a quién sondear. Sin secretos; sólo el descriptor.
-- El JOIN con agenda_ajustes se queda: aquí agenda_v2_encendida() iría fila a
-- fila y, con SET search_path, no se puede incrustar en la consulta.
CREATE OR REPLACE FUNCTION public.gcal_sync_clinicas_pendientes(p_limite integer)
RETURNS TABLE (r_conexion_id uuid, r_clinica_id uuid, r_user_id uuid, r_calendar_id text, r_google_account_email text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT g.id, g.clinica_id, g.user_id, g.calendar_id, g.google_account_email
    FROM public.clinica_conexiones_google g
    JOIN public.agenda_ajustes a ON a.clinica_id = g.clinica_id AND a.agenda_v2_encendida
    LEFT JOIN public.gcal_sync_estado e ON e.clinica_id = g.clinica_id
   WHERE g.rol = 'clinica' AND g.estado = 'activa' AND g.calendar_id IS NOT NULL
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now())
   ORDER BY e.ultima_ok ASC NULLS FIRST, g.clinica_id
   LIMIT least(greatest(coalesce(p_limite, 1), 1), 100);
$fn$;

-- La última sincronización buena de ESTA clínica y si alguien tiene el
-- candado ahora. La usa la reserva por enlace antes de ofrecer turnos.
CREATE OR REPLACE FUNCTION public.gcal_sync_frescura(p_clinica_id uuid)
RETURNS TABLE (r_ultima_ok timestamptz, r_ocupada boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT e.ultima_ok, coalesce(e.candado_hasta > now(), false)
    FROM public.gcal_sync_estado e
   WHERE e.clinica_id = p_clinica_id;
$fn$;

-- 4.2 · La puerta S3: el acceso de UNA clínica, sin sesión.
-- NO suplanta claims ni rol, y NO copia RN-1 (contrato con spinus-consola):
-- lee en cada llamada el cuerpo VIGENTE de clinica_no_suspendida() y de
-- clinica_tiene_acceso() desde pg_proc, sustituye su única fuente de sesión,
-- `public.get_clinica_id()`, por $1 (con USING: nada del texto lo pone quien
-- llama) y lo ejecuta. Si la consola cambia RN-1, esto evalúa la regla nueva.
-- Falla CERRADO y RUIDOSO (P0001): si alguna deja de ser `LANGUAGE sql` de una
-- sola sentencia SELECT que devuelve boolean, o si tras sustituir queda otra
-- fuente de sesión (auth.*, current_setting, request.jwt, current_user, …).
-- ⚠️ ACOPLAMIENTO A LA FORMA: reescribir cualquiera de las dos cambiando su
-- FORMA (plpgsql, dos sentencias, get_clinica_id() sin `public.`, o
-- `public.get_clinica_id()` dentro de un literal o un comentario) sin cambiar su
-- lógica detiene la sincronización con Google, cerrada, hasta revisar esto. El
-- aviso no va en el COMMENT de esas dos funciones de main: S3 prohíbe modificarlas.
-- perfil_completo(), la tercera puerta del INSERT de appointments, no aplica:
-- es del usuario que escribe, y aquí no hay usuario.
CREATE OR REPLACE FUNCTION public.gcal_sync_clinica_habilitada(p_clinica_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  c_puertas CONSTANT text[] := ARRAY['public.clinica_no_suspendida()', 'public.clinica_tiene_acceso()'];
  c_fuente  CONSTANT text   := 'public.get_clinica_id()';
  v_puerta text;
  v_src    text;
  v_sql    text;
  v_ok     boolean;
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_clinica_habilitada: clínica en NULL' USING ERRCODE = '22023';
  END IF;
  FOREACH v_puerta IN ARRAY c_puertas LOOP
    v_src := NULL;
    SELECT p.prosrc INTO v_src
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid = p.prolang
     WHERE p.oid = to_regprocedure(v_puerta) AND l.lanname = 'sql'
       AND p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype AND NOT p.proretset;
    v_sql := btrim(replace(v_src, c_fuente, '$1'), E' \t\r\n;');
    IF v_src IS NULL OR strpos(v_src, c_fuente) = 0 OR v_sql !~* '^select\s'
       OR v_sql ~* '(get_clinica_id|auth\.|current_setting|request\.jwt|current_user|session_user|current_role|set_config|;)' THEN
      RAISE EXCEPTION 'gcal_sync_clinica_habilitada: % ya no tiene la forma que se sabe evaluar por clínica', v_puerta
        USING ERRCODE = 'P0001', HINT = 'Revisar gcal_sync_clinica_habilitada (20261201150000_agenda_f2_google) contra la definición nueva; no se adivina.';
    END IF;
    EXECUTE v_sql INTO v_ok USING p_clinica_id;
    IF v_ok IS NOT TRUE THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END
$fn$;

-- 4.3 · El espejo: lo que entra de Google a appointments.
-- Reglas que la base impone aunque el código se equivoque:
--   · sólo citas scheduled/confirmed cambian de contenido desde Google;
--     attended, no_show y cancelled sólo reciben columnas técnicas;
--   · una cita CON paciente (o por ligar) no cambia de título ni pasa a todo
--     el día; una sin paciente sólo pasa a todo el día si tiene
--     consultorio_timezone (appointments_all_day_medianoche_check);
--   · observaciones: sólo en filas nacidas en Google y SIN paciente (S1);
--   · nunca se reactiva ni se BORRA una cita desde Google: el borrado es
--     status = cancelled y soltar el vínculo;
--   · comparar-y-cambiar sobre updated_at: si Spinus escribió entre la lectura
--     y la escritura, no se toca nada.

-- Lo mínimo para decidir: el título sólo de filas sin paciente; las notas sólo
-- de filas de Google sin paciente; de las filas con paciente, nombre y
-- apellidos para que el código componga el título que Spinus ya manda.
CREATE OR REPLACE FUNCTION public.gcal_citas_por_evento(p_clinica_id uuid, p_eventos text[], p_citas uuid[])
RETURNS TABLE(r_id uuid, r_google_event_id text, r_gcal_calendar_id text, r_gcal_etag text, r_gcal_sync_status text, r_origen text, r_status text, r_start_time timestamp with time zone, r_end_time timestamp with time zone, r_all_day boolean, r_consultorio_timezone text, r_updated_at timestamp with time zone, r_con_paciente boolean, r_titulo_sin_paciente text, r_notas_de_google text, r_paciente_nombre text, r_paciente_apellidos text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'gcal_citas_por_evento: clínica en NULL' USING ERRCODE = '22023';
  END IF;
  IF coalesce(cardinality(p_eventos), 0) > 2500 OR coalesce(cardinality(p_citas), 0) > 2500 THEN
    RAISE EXCEPTION 'gcal_citas_por_evento: demasiados ids' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.google_event_id, a.gcal_calendar_id, a.gcal_etag, a.gcal_sync_status, a.origen, a.status,
         a.start_time, a.end_time, a.all_day, a.consultorio_timezone, a.updated_at,
         (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL),
         CASE WHEN a.paciente_id IS NULL AND a.reserva_canal IS NULL THEN a.title END,
         CASE WHEN a.paciente_id IS NULL AND a.origen = 'google' THEN a.notes END,
         -- Una cita POR LIGAR: el nombre de quien reservó, sin apellidos
         -- aparte (van dentro de reserva_nombre), como lo compone la reserva.
         coalesce(p.nombre, CASE WHEN a.paciente_id IS NULL THEN a.reserva_nombre END),
         coalesce(p.apellidos, CASE WHEN a.paciente_id IS NULL AND a.reserva_canal IS NOT NULL THEN '' END)
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.clinica_id = p_clinica_id
     AND (a.google_event_id = ANY (coalesce(p_eventos, ARRAY[]::text[]))
          OR a.id = ANY (coalesce(p_citas, ARRAY[]::uuid[])));
END
$fn$;

CREATE OR REPLACE FUNCTION public.gcal_aplicar_evento(p_clinica_id uuid, p_cita_id uuid, p_esperado_updated_at timestamp with time zone, p_calendar_id text, p_etag text, p_google_updated timestamp with time zone, p_vincular_evento text, p_desvincular boolean, p_start timestamp with time zone, p_end timestamp with time zone, p_all_day boolean, p_title text, p_tocar_notas boolean, p_notas text, p_cancelar boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL
     OR p_desvincular IS NULL OR p_cancelar IS NULL OR p_tocar_notas IS NULL
     OR (p_etag IS NULL AND NOT p_desvincular) THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF (p_start IS NULL) <> (p_end IS NULL) OR (p_start IS NOT NULL AND p_end <= p_start)
     OR (p_all_day IS NOT NULL AND p_start IS NULL) THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: puntas incoherentes' USING ERRCODE = '22023';
  END IF;
  IF p_vincular_evento IS NOT NULL AND p_desvincular THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: vincular y desvincular a la vez' USING ERRCODE = '22023';
  END IF;
  IF length(p_title) > 500 OR length(p_vincular_evento) > 1024 OR length(p_etag) > 300 OR length(p_notas) > 5000 THEN
    RAISE EXCEPTION 'gcal_aplicar_evento: texto demasiado largo' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('spinus.via', 'google', true);

  -- Primero los valores nuevos (con las reglas), bloqueando la fila; luego el
  -- UPDATE. updated_at sólo se mueve si cambió contenido DE VERDAD: un campo
  -- que las reglas descartan no cuenta como cambio.
  WITH n AS (
    SELECT a.id,
           -- A todo el día sólo sin paciente Y con zona: appointments_all_day_medianoche_check
           -- exige consultorio_timezone, y esta función no la inventa. Si no, la hora no se toca.
           CASE WHEN p_start IS NOT NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR ((a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.consultorio_timezone IS NOT NULL))
                THEN p_start ELSE a.start_time END AS start_time,
           CASE WHEN p_end IS NOT NULL AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR ((a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.consultorio_timezone IS NOT NULL))
                THEN p_end ELSE a.end_time END AS end_time,
           CASE WHEN p_all_day IS NOT NULL AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.status IN ('scheduled', 'confirmed')
                     AND (p_all_day IS NOT TRUE OR a.consultorio_timezone IS NOT NULL)
                THEN p_all_day ELSE a.all_day END AS all_day,
           CASE WHEN p_title IS NOT NULL AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL)
                     AND a.status IN ('scheduled', 'confirmed') THEN p_title ELSE a.title END AS title,
           CASE WHEN p_tocar_notas AND (a.paciente_id IS NULL AND a.reserva_canal IS NULL) AND a.origen = 'google'
                     AND a.status IN ('scheduled', 'confirmed') THEN nullif(btrim(p_notas), '') ELSE a.notes END AS notes,
           CASE WHEN p_cancelar AND a.status IN ('scheduled', 'confirmed') THEN 'cancelled' ELSE a.status END AS status
      FROM public.appointments a
     WHERE a.id = p_cita_id
       AND a.clinica_id = p_clinica_id
       AND a.updated_at IS NOT DISTINCT FROM p_esperado_updated_at
       AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
       AND (p_vincular_evento IS NOT NULL OR a.google_event_id IS NOT NULL)
       AND (p_vincular_evento IS NULL OR a.google_event_id IS NULL OR a.google_event_id = p_vincular_evento)
       FOR UPDATE
  )
  UPDATE public.appointments a
     SET start_time = n.start_time, end_time = n.end_time, all_day = n.all_day,
         title = n.title, notes = n.notes, status = n.status,
         google_event_id  = CASE WHEN p_desvincular THEN NULL
                                 WHEN p_vincular_evento IS NOT NULL THEN coalesce(a.google_event_id, p_vincular_evento)
                                 ELSE a.google_event_id END,
         gcal_calendar_id = CASE WHEN p_desvincular THEN NULL ELSE p_calendar_id END,
         gcal_etag        = CASE WHEN p_desvincular THEN NULL ELSE p_etag END,
         gcal_sync_status = CASE WHEN p_desvincular THEN 'unbound' ELSE 'synced' END,
         -- La hora del cambio de GOOGLE, no now(): así un cambio posterior en
         -- Google no pierde la comparación de «gana el último».
         updated_at = CASE WHEN (n.start_time, n.end_time, n.all_day, n.title, n.notes, n.status)
                                IS DISTINCT FROM (a.start_time, a.end_time, a.all_day, a.title, a.notes, a.status)
                           THEN greatest(a.updated_at, coalesce(p_google_updated, now()))
                           ELSE a.updated_at END
    FROM n
   WHERE a.id = n.id AND a.clinica_id = p_clinica_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- Importar: origen 'google', sin paciente, ON CONFLICT (clinica_id,
-- google_event_id) DO NOTHING. spinus.via = 'google' va ANTES del INSERT: de
-- eso depende que cita_asignacion_google marque 'por_asignar'.
CREATE OR REPLACE FUNCTION public.gcal_importar_evento(p_clinica_id uuid, p_calendar_id text, p_google_event_id text, p_etag text, p_google_updated timestamp with time zone, p_title text, p_start timestamp with time zone, p_end timestamp with time zone, p_all_day boolean, p_timezone text, p_notas text, p_medico_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_medico uuid;
  v_id     uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL OR p_etag IS NULL
     OR p_start IS NULL OR p_end IS NULL OR p_all_day IS NULL OR p_timezone IS NULL THEN
    RAISE EXCEPTION 'gcal_importar_evento: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF p_end <= p_start OR length(p_google_event_id) > 1024 OR length(p_etag) > 300
     OR length(p_title) > 500 OR length(p_notas) > 5000 THEN
    RAISE EXCEPTION 'gcal_importar_evento: datos incoherentes' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone) THEN
    RAISE EXCEPTION 'gcal_importar_evento: zona horaria desconocida' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN NULL;
  END IF;
  -- La puerta RESTRICTIVE de INSERT no aplica a service_role: se evalúa aquí (S3).
  IF NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN NULL;
  END IF;
  -- Médico sólo si es de ESTA clínica; si no, NULL (lo ven admin y secretaria).
  SELECT p.id INTO v_medico FROM public.profiles p WHERE p.id = p_medico_id AND p.clinica_id = p_clinica_id;

  PERFORM set_config('spinus.via', 'google', true);
  INSERT INTO public.appointments (clinica_id, paciente_id, created_by, title, start_time, end_time, all_day,
                                   status, notes, google_event_id, gcal_calendar_id, gcal_etag, gcal_sync_status,
                                   origen, medico_id, consultorio_timezone, updated_at)
  VALUES (p_clinica_id, NULL, NULL, coalesce(nullif(btrim(p_title), ''), 'Evento sin título'), p_start, p_end, p_all_day,
          'scheduled', nullif(btrim(p_notas), ''), p_google_event_id, p_calendar_id, p_etag, 'synced',
          'google', v_medico, p_timezone, coalesce(p_google_updated, now()))
  ON CONFLICT (clinica_id, google_event_id) WHERE google_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

-- 4.4 · Empalmes con reservas por enlace: pares nuevos en los que participa
-- alguna de p_citas, de ESTA clínica y del mismo médico. Audita cada uno en la
-- misma sentencia.
CREATE OR REPLACE FUNCTION public.reserva_empalmes_registrar(p_clinica_id uuid, p_citas uuid[])
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_citas IS NULL OR cardinality(p_citas) > 500
     OR EXISTS (SELECT 1 FROM unnest(p_citas) c WHERE c IS NULL) THEN
    RAISE EXCEPTION 'reserva_empalmes_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_citas) = 0
     OR NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN 0;
  END IF;

  WITH pares AS (
    SELECT r.clinica_id, r.id AS reserva, o.id AS otra
      FROM public.appointments r
      JOIN public.appointments o
        ON o.clinica_id = r.clinica_id AND o.medico_id = r.medico_id AND o.id <> r.id
     WHERE r.clinica_id = p_clinica_id
       AND r.reserva_canal IS NOT NULL AND r.status IN ('scheduled', 'confirmed')
       AND NOT r.all_day AND r.end_time > now()
       AND o.status NOT IN ('cancelled', 'no_show') AND NOT o.all_day
       AND o.start_time < r.end_time AND o.end_time > r.start_time
       AND (r.id = ANY (p_citas) OR o.id = ANY (p_citas))
       -- Reserva contra reserva: un solo par por solape, en orden canónico,
       -- SÓLO si la otra también podría hacer de reserva (activa y sin
       -- terminar); si no, este r es el único representante posible.
       AND (o.reserva_canal IS NULL OR r.id < o.id
            OR o.status NOT IN ('scheduled', 'confirmed') OR o.end_time <= now())
  ), nuevos AS (
    INSERT INTO public.reserva_empalmes_google (clinica_id, cita_reserva_id, cita_otra_id)
    SELECT p.clinica_id, p.reserva, p.otra FROM pares p
    ON CONFLICT ON CONSTRAINT reserva_empalmes_google_par_key DO NOTHING
    RETURNING cita_reserva_id, cita_otra_id
  )
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  SELECT 'system', 'reserva_empalme_google', 'appointments', n.cita_reserva_id,
         jsonb_build_object('clinica_id', p_clinica_id, 'cita_empalmada', n.cita_otra_id, 'via', 'sondeo')::text
    FROM nuevos n;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- 4.5 · RSVP «accepted» de Google: segunda vía de confirmación de asistencia.
-- Sólo scheduled → confirmed, cita futura con hora, y sólo si un correo
-- aceptado es el del paciente o el de la reserva de ESA cita. Marca
-- spinus.via = 'google_rsvp' para la auditoría.
CREATE OR REPLACE FUNCTION public.cita_rsvp_google(p_clinica_id uuid, p_cita_id uuid, p_calendar_id text, p_google_event_id text, p_aceptaron text[])
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_a      record;
  v_correos text[];
  v_ahora  timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL
     OR p_aceptaron IS NULL OR cardinality(p_aceptaron) > 50
     OR EXISTS (SELECT 1 FROM unnest(p_aceptaron) c WHERE c IS NULL OR length(c) > 254) THEN
    RAISE EXCEPTION 'cita_rsvp_google: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(DISTINCT lower(btrim(c))) FILTER (WHERE btrim(c) <> ''), ARRAY[]::text[])
    INTO v_correos FROM unnest(p_aceptaron) c;
  IF cardinality(v_correos) = 0
     OR NOT public.agenda_v2_encendida(p_clinica_id)
     OR NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                     WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                       AND g.calendar_id = p_calendar_id) THEN
    RETURN 'sin_cambio';
  END IF;
  SELECT a.id, a.updated_at INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.google_event_id = p_google_event_id
     AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
     AND a.status = 'scheduled' AND NOT a.all_day
     AND (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL)
     AND (lower(btrim(p.email)) = ANY (v_correos) OR lower(btrim(a.reserva_correo)) = ANY (v_correos))
   FOR UPDATE OF a;
  IF NOT FOUND THEN
    RETURN 'sin_cambio';
  END IF;
  -- Hora REAL tras el candado: la cita tiene que seguir siendo futura.
  v_ahora := clock_timestamp();
  IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = v_a.id AND a.start_time > v_ahora) THEN
    RETURN 'sin_cambio';
  END IF;
  PERFORM set_config('spinus.via', 'google_rsvp', true);
  UPDATE public.appointments
     SET status = 'confirmed', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
   WHERE id = v_a.id AND clinica_id = p_clinica_id AND status = 'scheduled';
  RETURN 'confirmada';
END
$fn$;

-- 4.6 · Un intento de mover desde Google una cita reservada por enlace que
-- cita_proteger_eleccion rechazó (42501). Lo llama la sincronización después del
-- rechazo; el aviso lo deja el disparador de F4 sobre la tabla.
CREATE OR REPLACE FUNCTION public.cita_movimiento_google_registrar(
  p_clinica_id uuid, p_cita_id uuid, p_google_updated timestamptz)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_google_updated IS NULL THEN
    RAISE EXCEPTION 'cita_movimiento_google_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN false;
  END IF;
  -- El criterio de cita_proteger_eleccion: de ESTA clínica, por enlace y sin empezar.
  IF NOT EXISTS (SELECT 1 FROM public.appointments a
                  WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
                    AND a.reserva_canal IS NOT NULL AND a.start_time > now()) THEN
    RETURN false;
  END IF;
  INSERT INTO public.gcal_movimientos_rechazados (clinica_id, cita_id, google_updated)
  VALUES (p_clinica_id, p_cita_id, p_google_updated)
  ON CONFLICT ON CONSTRAINT gcal_movimientos_rechazados_intento_key DO NOTHING;
  RETURN FOUND;
END
$fn$;

-- 4.7 · Lo movido o borrado en Google de un evento de BLOQUEO vuelve al
-- bloqueo. Sólo un bloqueo que YA existe: nunca crea uno.
-- ⚠️ Candado consultivo 1790 del médico, la MISMA clave que reservar_por_enlace
-- (F3) y agenda_bloqueo_preparar (F5a): pg_advisory_xact_lock(1790,
-- hashtext(medico_id::text)), y ANTES que el FOR UPDATE de la fila, en el mismo
-- orden que ellas. Cambiar la clave o el orden abre carreras (o interbloqueos)
-- entre una reserva por enlace y un bloqueo movido en Google.
CREATE OR REPLACE FUNCTION public.gcal_bloqueo_aplicar(p_clinica_id uuid, p_calendar_id text, p_google_event_id text, p_bloqueo_id uuid, p_etag text, p_google_updated timestamp with time zone, p_borrar boolean, p_inicio timestamp with time zone, p_fin timestamp with time zone, p_desde date, p_hasta date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_b    public.agenda_bloqueos%ROWTYPE;
  v_zona text;
  v_ini  timestamptz;
  v_fin  timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL OR p_borrar IS NULL
     OR (NOT p_borrar AND (p_etag IS NULL
         OR ((p_inicio IS NULL OR p_fin IS NULL) AND (p_desde IS NULL OR p_hasta IS NULL))
         OR (p_inicio IS NOT NULL AND p_desde IS NOT NULL))) THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: argumentos incoherentes' USING ERRCODE = '22023';
  END IF;
  IF length(p_calendar_id) > 1024 OR length(p_google_event_id) > 1024 OR length(p_etag) > 300 THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: texto demasiado largo' USING ERRCODE = '22023';
  END IF;
  -- Las mismas dos puertas que gcal_aplicar_evento: v2 encendida y la conexión activa de ESE calendario.
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                    AND g.calendar_id = p_calendar_id) THEN
    RETURN 0;
  END IF;

  -- Sólo un bloqueo que YA existe: el ligado a ese evento, o el de la marca
  -- privada mientras aún no tenga evento. Un evento de Google no crea bloqueos.
  -- Primero sin bloquear, para tomar el candado 1790 del médico ANTES que la
  -- fila (el orden de agenda_bloqueo_preparar y de reservar_por_enlace).
  SELECT b.* INTO v_b FROM public.agenda_bloqueos b
   WHERE b.clinica_id = p_clinica_id
     AND (b.gcal_calendar_id IS NULL OR b.gcal_calendar_id = p_calendar_id)
     AND (b.google_event_id = p_google_event_id
          OR (p_bloqueo_id IS NOT NULL AND b.id = p_bloqueo_id AND b.google_event_id IS NULL))
   ORDER BY (b.google_event_id IS NOT DISTINCT FROM p_google_event_id) DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  PERFORM pg_advisory_xact_lock(1790, hashtext(v_b.medico_id::text));
  SELECT b.* INTO v_b FROM public.agenda_bloqueos b
   WHERE b.id = v_b.id AND b.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF p_borrar THEN
    DELETE FROM public.agenda_bloqueos WHERE id = v_b.id AND clinica_id = p_clinica_id;
    RETURN 1;
  END IF;
  -- Eco de lo que Spinus acaba de escribir, o Spinus más reciente: nada.
  IF p_etag IS NOT DISTINCT FROM v_b.gcal_etag
     OR (p_google_updated IS NOT NULL AND p_google_updated < v_b.updated_at) THEN
    RETURN 0;
  END IF;

  IF p_desde IS NOT NULL THEN
    v_zona := coalesce(v_b.zona, 'America/Mexico_City');
    v_ini := p_desde::timestamp AT TIME ZONE v_zona;
    v_fin := p_hasta::timestamp AT TIME ZONE v_zona;
  ELSE
    v_zona := v_b.zona;
    -- Al minuto (agenda_bloqueos_minuto_check): Google puede traer segundos.
    v_ini := date_trunc('minute', p_inicio);
    v_fin := date_trunc('minute', p_fin);
  END IF;
  IF v_fin <= v_ini OR v_fin - v_ini > interval '400 days' THEN
    RAISE EXCEPTION 'gcal_bloqueo_aplicar: puntas inválidas' USING ERRCODE = '22023';
  END IF;

  UPDATE public.agenda_bloqueos
     SET inicio = v_ini, fin = v_fin, todo_el_dia = (p_desde IS NOT NULL), zona = v_zona,
         google_event_id = p_google_event_id, gcal_calendar_id = p_calendar_id, gcal_etag = p_etag,
         -- La hora del cambio de GOOGLE, no now(): como gcal_aplicar_evento («gana el último»).
         updated_at = greatest(v_b.updated_at, coalesce(p_google_updated, now()))
   WHERE id = v_b.id AND clinica_id = p_clinica_id;
  RETURN 1;
END
$fn$;

-- ---------------------------------------------------------------------
-- 5 · Permisos y comentarios de las funciones. SÓLO service_role: la consola
--     y las sesiones de la app no mueven tokens, no escriben avisos ni leen la
--     puerta de otra clínica. (cita_asignacion_google, arriba.)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.gcal_sync_tomar(uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_tomar(uuid, uuid, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_reiniciar(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_reiniciar(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_soltar(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_soltar(uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_clinicas_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_clinicas_pendientes(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_frescura(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_frescura(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) TO service_role;

COMMENT ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) IS
  'S3: clinica_no_suspendida() Y clinica_tiene_acceso() para la clínica dada, sin sesión. NO copia RN-1: ejecuta el cuerpo vigente de las dos con public.get_clinica_id() sustituido por el parámetro, y lanza si su forma cambia. Sólo service_role.';
COMMENT ON FUNCTION public.gcal_sync_frescura(uuid) IS
  'ultima_ok y si el candado de sincronización de la clínica está tomado ahora. Sólo lectura, sólo service_role. Cero filas si nunca se tomó el candado; ultima_ok NULL si se tomó y ninguna pasada terminó bien.';
COMMENT ON FUNCTION public.gcal_citas_por_evento(uuid, text[], uuid[]) IS
  'Espejo del sondeo de Google. Sólo service_role. Una cita POR LIGAR (paciente_id NULL y reserva_canal NOT NULL) cuenta como CON paciente: r_con_paciente = true, r_titulo_sin_paciente NULL, r_paciente_nombre = reserva_nombre (nombre completo) y r_paciente_apellidos = '''' (cadena vacía, no NULL), para que tituloParaGoogle componga «Cita médica: {nombre}» y C-d lo restablezca. No es una fila corrupta.';
COMMENT ON FUNCTION public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean) IS
  'Aplica un evento de Google a una cita ligada. Sólo service_role. «Sin paciente» = paciente_id NULL Y reserva_canal NULL: una cita por ligar no acepta título ni todo el día desde Google (C-d); su hora sí.';
COMMENT ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) IS
  'Registra (sin repetir) los pares reserva por enlace / cita empalmada del mismo médico en los que participa alguna de p_citas (recién importadas o movidas desde Google) y audita cada par nuevo en la misma sentencia. Devuelve los pares nuevos. Sólo service_role; interruptor apagado = 0.';
COMMENT ON FUNCTION public.cita_rsvp_google(uuid, uuid, text, text, text[]) IS
  'RSVP «accepted» de Google como segunda vía de confirmación. Sólo scheduled → confirmed, cita futura con hora, ligada a ese evento y calendario de la conexión activa de la clínica, y sólo si un correo aceptado es pacientes.email o reserva_correo de ESA cita. Audita via google_rsvp. El código la llama sólo con AGENDA_RSVP_GOOGLE=encendido.';
COMMENT ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) IS
  'Registra un intento de mover desde Google una cita reservada por enlace que la base rechazó; true = intento nuevo (deja el aviso), false = repetido o no aplica (v2 apagada, otra clínica, no es por enlace, ya empezó). Sólo service_role (gcalSincronizacionBase.ts, tras el 42501 de cita_proteger_eleccion).';
COMMENT ON FUNCTION public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date) IS
  'Lo movido o borrado en Google de un evento de BLOQUEO vuelve al bloqueo, como un evento sin paciente. Sólo un bloqueo que ya existe (ligado al evento, o el de la marca privada spinus_bloqueo sin evento aún): nunca crea uno. Borrado = DELETE; movido = puntas (p_inicio/p_fin con hora, o p_desde/p_hasta de todo el día en la zona del bloqueo) si Google es más reciente; mismo etag = eco. Puertas: v2 encendida y conexión activa de ese calendario. Sólo service_role. Devuelve filas tocadas (0 o 1).';

-- ---------------------------------------------------------------------
-- 6 · Post-vuelo. Aborta (y deshace todo) si lo creado no quedó como debe.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_solo_service CONSTANT text[] := ARRAY[
    'public.gcal_sync_tomar(uuid, uuid, text, integer, integer)',
    'public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)',
    'public.gcal_sync_reiniciar(uuid, uuid)',
    'public.gcal_sync_soltar(uuid, uuid, text)',
    'public.gcal_sync_clinicas_pendientes(integer)',
    'public.gcal_sync_clinica_habilitada(uuid)',
    'public.gcal_sync_frescura(uuid)',
    'public.gcal_citas_por_evento(uuid, text[], uuid[])',
    'public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)',
    'public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)',
    'public.reserva_empalmes_registrar(uuid, uuid[])',
    'public.cita_rsvp_google(uuid, uuid, text, text, text[])',
    'public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)',
    'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)'];
  v_f text;
  v_oid oid;
  v_t text;
BEGIN
  -- Funciones: INVOKER, search_path vacío, sin PUBLIC; EXECUTE sólo service_role.
  FOREACH v_f IN ARRAY c_solo_service || ARRAY['public.cita_asignacion_google()'] LOOP
    v_oid := to_regprocedure(v_f);
    IF v_oid IS NULL OR (SELECT prosecdef OR NOT coalesce(proconfig @> ARRAY['search_path=""'], false) FROM pg_proc WHERE oid = v_oid)
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   WHERE p.oid = v_oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % falta, es DEFINER, no fija search_path, la ejecuta PUBLIC o no service_role.', v_f;
    END IF;
    IF v_f <> 'public.cita_asignacion_google()'
       AND (has_function_privilege('anon', v_oid, 'EXECUTE') OR has_function_privilege('authenticated', v_oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: anon o authenticated ejecutan %.', v_f;
    END IF;
  END LOOP;
  IF NOT (has_function_privilege('anon', 'public.cita_asignacion_google()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.cita_asignacion_google()', 'EXECUTE')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: cita_asignacion_google() es de disparador y la tienen que poder ejecutar las sesiones.';
  END IF;

  -- Tablas: RLS activa, ningún privilegio de más (TRUNCATE incluido).
  FOREACH v_t IN ARRAY ARRAY['public.gcal_sync_estado', 'public.reserva_empalmes_google', 'public.gcal_movimientos_rechazados'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_t::regclass) THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % sin RLS.', v_t;
    END IF;
    IF has_table_privilege('anon', v_t, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       OR has_table_privilege('authenticated', v_t, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       OR has_table_privilege('service_role', v_t, 'DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % da privilegios de más a anon, authenticated o service_role.', v_t;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.gcal_sync_estado', 'SELECT')
     OR has_table_privilege('authenticated', 'public.gcal_movimientos_rechazados', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.reserva_empalmes_google', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.gcal_sync_estado', 'SELECT, INSERT, UPDATE')
     OR has_table_privilege('service_role', 'public.reserva_empalmes_google', 'UPDATE')
     OR has_table_privilege('service_role', 'public.gcal_movimientos_rechazados', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: los privilegios de las tablas no son los esperados.';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid IN ('public.gcal_sync_estado'::regclass, 'public.gcal_movimientos_rechazados'::regclass)) <> 0
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.reserva_empalmes_google'::regclass) <> 1 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: policies inesperadas en las tablas de este bloque.';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confdeltype = 'r' AND confrelid = 'public.clinicas'::regclass
        AND conname IN ('gcal_sync_estado_clinica_id_fkey', 'reserva_empalmes_google_clinica_id_fkey',
                        'gcal_movimientos_rechazados_clinica_id_fkey')) <> 3 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: las FK a clinicas no son las tres ON DELETE RESTRICT.';
  END IF;

  -- «Por asignar»: CHECK validada y el disparador exacto.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_google_asignacion_check' AND convalidated) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: appointments_google_asignacion_check falta o no está validada.';
  END IF;
  -- pg_get_triggerdef pone «public.» delante de la función o no según el
  -- search_path; se compara sin él (la tabla siempre sale calificada), y la
  -- función se ata además por su oid.
  SELECT replace(pg_get_triggerdef(t.oid), 'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ') INTO v_t
    FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass
     AND t.tgname = 'trg_appointments_asignacion_google' AND t.tgenabled = 'O'
     AND t.tgfoid = 'public.cita_asignacion_google()'::regprocedure;
  IF v_t IS DISTINCT FROM 'CREATE TRIGGER trg_appointments_asignacion_google BEFORE INSERT OR UPDATE OF google_asignacion ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_asignacion_google()' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: trg_appointments_asignacion_google no quedó como debe (%).', coalesce(v_t, 'AUSENTE');
  END IF;

  -- Contratos que leen otros: spinus.via antes de escribir, y el candado 1790.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(
       'public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid)')
       AND prosrc ~ 'set_config\(''spinus\.via'', ''google'', true\);\s+INSERT INTO public\.appointments')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(
       'public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean)')
       AND prosrc ~ 'set_config\(''spinus\.via'', ''google'', true\)')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])')
       AND prosrc ~ 'set_config\(''spinus\.via'', ''google_rsvp'', true\)')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(
       'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)')
       AND strpos(prosrc, 'pg_advisory_xact_lock(1790, hashtext(v_b.medico_id::text))') > 0) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: un contrato (spinus.via o el candado 1790) no está en el cuerpo de su función.';
  END IF;

  -- La puerta S3 sabe evaluarse en ESTA base: una clínica que no existe da
  -- false, nunca error (si la forma de main cambió, lanza P0001 aquí).
  IF public.gcal_sync_clinica_habilitada('00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: la puerta S3 dio true para una clínica inexistente.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 7 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tablas con RLS (de 3)' AS comprobacion,
         (SELECT count(*)::text FROM pg_class WHERE relrowsecurity
            AND oid IN (to_regclass('public.gcal_sync_estado'), to_regclass('public.reserva_empalmes_google'),
                        to_regclass('public.gcal_movimientos_rechazados'))) AS valor,
         '3' AS esperado
  UNION ALL
  -- Sin MAINTAIN («m», sólo existe desde PostgreSQL 17) para que la fila valga en las dos versiones.
  SELECT 2, 'privilegios gcal_sync_estado / reserva_empalmes_google / gcal_movimientos_rechazados (sin «m»)',
         coalesce((SELECT replace(array_to_string(relacl, ','), 'm/', '/') FROM pg_class WHERE oid = to_regclass('public.gcal_sync_estado')), 'AUSENTE')
         || ' / ' || coalesce((SELECT replace(array_to_string(relacl, ','), 'm/', '/') FROM pg_class WHERE oid = to_regclass('public.reserva_empalmes_google')), 'AUSENTE')
         || ' / ' || coalesce((SELECT replace(array_to_string(relacl, ','), 'm/', '/') FROM pg_class WHERE oid = to_regclass('public.gcal_movimientos_rechazados')), 'AUSENTE'),
         'postgres=arwdDxt/postgres,service_role=arw/postgres'
         || ' / postgres=arwdDxt/postgres,authenticated=r/postgres,service_role=ar/postgres'
         || ' / postgres=arwdDxt/postgres,service_role=ar/postgres'
  UNION ALL
  SELECT 3, 'funciones del bloque INVOKER con search_path vacío (de 15)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND (p.proname LIKE 'gcal\_%' OR p.proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google',
                                                            'cita_asignacion_google', 'cita_movimiento_google_registrar'))
             AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']),
         '15'
  UNION ALL
  SELECT 4, 'funciones del bloque que ejecuta anon o authenticated (sólo la de disparador)',
         (SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND (p.proname LIKE 'gcal\_%' OR p.proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google',
                                                            'cita_asignacion_google', 'cita_movimiento_google_registrar'))
             AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
         'cita_asignacion_google'
  UNION ALL
  SELECT 5, 'google_asignacion text sin DEFAULT / CHECK validada',
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.atthasdef::text FROM pg_attribute a
                    WHERE a.attrelid = 'public.appointments'::regclass AND a.attname = 'google_asignacion' AND NOT a.attisdropped), 'AUSENTE')
         || ' / ' || coalesce((SELECT convalidated::text FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                                AND conname = 'appointments_google_asignacion_check'), 'AUSENTE'),
         'text / false / true'
  UNION ALL
  SELECT 6, 'trg_appointments_asignacion_google: el primer BEFORE de appointments por nombre',
         (SELECT t.tgname FROM pg_trigger t WHERE t.tgrelid = 'public.appointments'::regclass AND NOT t.tgisinternal
             AND (t.tgtype & 2) = 2 ORDER BY t.tgname LIMIT 1),
         'trg_appointments_asignacion_google'
  UNION ALL
  SELECT 7, 'la puerta S3 da false para una clínica inexistente',
         public.gcal_sync_clinica_habilitada('00000000-0000-0000-0000-000000000000'::uuid)::text, 'false'
  UNION ALL
  -- Sin los \r: en producción las dos tienen fines de línea CRLF (ver la cabecera).
  SELECT 8, 'md5 sin \r de clinica_no_suspendida / clinica_tiene_acceso (main; si cambian, la puerta sigue la regla nueva: revisar a mano)',
         (SELECT string_agg(md5(replace(p.prosrc, E'\r\n', E'\n')), ' / ' ORDER BY p.proname) FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.clinica_no_suspendida()'), to_regprocedure('public.clinica_tiene_acceso()'))),
         'a2dcfa8f2cfda91bc9c7a7ff7b642e1e / 2efd7734772dd4c7bea262e43a3779b5'
  UNION ALL
  SELECT 9, 'clínicas con estado de sincronización', (SELECT count(*)::text FROM public.gcal_sync_estado), NULL
) t
ORDER BY t.n;
